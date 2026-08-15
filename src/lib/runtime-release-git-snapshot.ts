import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { Readable } from 'node:stream';

import {
  buildRuntimeBlobReleaseManifestFromFiles,
  type ActRuntimeBlobReleaseManifest,
  type ActRuntimeBlobReleaseFileExternalBundleSource,
  type ActRuntimeBlobReleaseFileExternalSource,
  type RuntimeBlobReleaseFileMetadata,
  RuntimeReleaseValidationError,
} from '@/lib/runtime-release';
import {
  declarationInputForBundle,
  EXTERNAL_INPUT_BUNDLE_DECLARATION_PATH,
  parseExternalInputBundle,
  parseExternalInputBundleDeclaration,
  serializeExternalInputBundleDeclaration,
  type ExternalInputBundle,
  type ExternalInputBundleDeclaration,
  type ExternalInputBundleFile,
} from '@/lib/runtime-external-input-bundle';
import { stableStringify } from '@/lib/aggregate-governance/hash';

const RUNTIME_PREFIX = 'course-content/runtime/';
const GIT_OBJECT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const EXTERNAL_INPUT_MANIFEST_PATH = 'course-content/authoring/runtime-external-inputs.v1.json';
const EXTERNAL_INPUT_SCHEMA_VERSION = 'act-runtime-external-inputs.v1';

export interface GitRuntimeBlobSnapshotFile extends RuntimeBlobReleaseFileMetadata {
  blobObjectId: string;
  mode: '100644' | '100755';
}

export interface ExternalInputBundleSnapshotFile extends RuntimeBlobReleaseFileMetadata {
  source: ActRuntimeBlobReleaseFileExternalBundleSource;
  absolutePath: string;
}

export type GitRuntimeBlobSnapshotSourceFile = GitRuntimeBlobSnapshotFile | ExternalInputBundleSnapshotFile;

export interface GitRuntimeBlobReleaseSnapshotStats {
  reusedFileCount: number;
  reusedBytes: number;
  hashedFileCount: number;
  hashedBytes: number;
}

export interface GitRuntimeBlobReleaseSnapshot {
  repoRoot: string;
  sourceRevision: string;
  integrationRef: string;
  integrationRevision: string;
  gitTree: readonly Pick<GitRuntimeBlobSnapshotFile, 'path' | 'mode' | 'blobObjectId'>[];
  /**
   * The immutable parent used to prove reused Git objects.  Publishing passes
   * only this identity to the bridge, which rereads the small remote parent
   * documents before it trusts inherited blobs.
   */
  parentManifest?: ActRuntimeBlobReleaseManifest;
  manifest: ActRuntimeBlobReleaseManifest;
  stats: GitRuntimeBlobReleaseSnapshotStats;
  filesByPath: ReadonlyMap<string, GitRuntimeBlobSnapshotSourceFile>;
  /** Populated by the publisher after one external-byte snapshot validation. */
  externalSnapshotFiles: Map<string, string>;
  externalSnapshotRoot?: string;
  externalBundle?: ExternalInputBundle;
  openFile: (relativePath: string) => Promise<Readable>;
}

interface RuntimeExternalInput {
  pathPrefix: string;
  externalInputId: string;
  source: ActRuntimeBlobReleaseFileExternalSource;
}

interface RuntimeExternalInputBundleDeclaration {
  declaration: ExternalInputBundleDeclaration;
  declarationObjectId: string;
}

function gitError(code: string, message: string): RuntimeReleaseValidationError {
  return new RuntimeReleaseValidationError(code, message);
}

function runtimeGitTreeDigest(entries: readonly GitRuntimeBlobSnapshotFile[]) {
  return createHash('sha256').update(stableStringify([...entries].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0).map((entry) => ({ path: entry.path, objectId: entry.blobObjectId })))).digest('hex');
}

function assertRepoRoot(repoRoot: string) {
  if (!repoRoot || repoRoot.includes('\u0000')) throw gitError('runtime-release-git-repo-invalid', 'Git repository root must be a non-empty path.');
}

function assertRevisionInput(revision: string, context: string) {
  if (!revision || revision.includes('\u0000') || /[\r\n]/u.test(revision) || revision.startsWith('-')) {
    throw gitError('runtime-release-git-revision-invalid', `${context} is not a safe Git revision.`);
  }
}

function assertRuntimeRelativePath(value: string) {
  if (
    !value
    || value.includes('\\')
    || value.startsWith('/')
    || /^[A-Za-z]:\//.test(value)
    || /[\u0000-\u001f\u007f]/u.test(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw gitError('runtime-release-git-path-invalid', `Git runtime path is unsafe: ${value}`);
  }
  return value;
}

function spawnGit(repoRoot: string, args: readonly string[]) {
  assertRepoRoot(repoRoot);
  const child = spawn('git', [...args], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return child;
}

async function collectOutput(stream: Readable | null) {
  if (!stream) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function waitForGit(child: ChildProcess, context: string) {
  const stderrPromise = collectOutput(child.stderr);
  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  }).catch((error) => {
    throw gitError('runtime-release-git-command-failed', `${context} failed to start: ${error instanceof Error ? error.message : String(error)}`);
  });
  const stderr = (await stderrPromise).toString('utf8').trim();
  if (exit.code !== 0) {
    throw gitError('runtime-release-git-command-failed', `${context} failed${stderr ? `: ${stderr}` : '.'}`);
  }
  return stderr;
}

async function runGit(repoRoot: string, args: readonly string[], context: string) {
  const child = spawnGit(repoRoot, args);
  const stdoutPromise = collectOutput(child.stdout);
  const stderr = await waitForGit(child, context);
  return { stdout: await stdoutPromise, stderr };
}

function object(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw gitError('runtime-release-external-input-invalid', `${context} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], context: string) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw gitError('runtime-release-external-input-invalid', `${context} has unsupported or missing fields.`);
  }
}

function externalInputId(value: unknown, context: string) {
  if (typeof value !== 'string' || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u.test(value)) {
    throw gitError('runtime-release-external-input-invalid', `${context} is invalid.`);
  }
  return value;
}

function externalInputPathPrefix(value: unknown, context: string) {
  if (typeof value !== 'string' || !value.endsWith('/')) {
    throw gitError('runtime-release-external-input-invalid', `${context} must be a normalized directory prefix.`);
  }
  return `${assertRuntimeRelativePath(value.slice(0, -1))}/`;
}

function isGitSource(source: RuntimeBlobReleaseFileMetadata['source'] | undefined): source is { gitObjectId: string } {
  return !!source && 'gitObjectId' in source;
}

function isExternalSource(source: RuntimeBlobReleaseFileMetadata['source'] | undefined): source is ActRuntimeBlobReleaseFileExternalSource {
  return !!source && 'externalInputId' in source && 'externalInputManifestObjectId' in source && !('bundleSemanticSha256' in source);
}

function isExternalBundleSource(source: RuntimeBlobReleaseFileMetadata['source'] | undefined): source is ActRuntimeBlobReleaseFileExternalBundleSource {
  return !!source && 'externalInputId' in source && 'externalInputManifestObjectId' in source && 'bundleSemanticSha256' in source && 'bundleWireSha256' in source;
}

export async function resolveGitCommit(repoRoot: string, revision: string, context = 'Git revision') {
  assertRevisionInput(revision, context);
  const result = await runGit(repoRoot, ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`], context);
  const resolved = result.stdout.toString('utf8').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(resolved) && !/^[0-9a-f]{64}$/.test(resolved)) {
    throw gitError('runtime-release-git-revision-invalid', `${context} did not resolve to a complete commit.`);
  }
  return resolved;
}

async function assertIntegrationAncestor(repoRoot: string, sourceRevision: string, integrationRef: string) {
  assertRevisionInput(integrationRef, 'Integration ref');
  const integrationRevision = await resolveGitCommit(repoRoot, integrationRef, 'Integration ref');
  const child = spawnGit(repoRoot, ['merge-base', '--is-ancestor', sourceRevision, integrationRevision]);
  const stderrPromise = collectOutput(child.stderr);
  const exit = await new Promise<{ code: number | null }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve({ code }));
  }).catch((error) => {
    throw gitError('runtime-release-git-command-failed', `Integration ancestry check failed to start: ${error instanceof Error ? error.message : String(error)}`);
  });
  const stderr = (await stderrPromise).toString('utf8').trim();
  if (exit.code !== 0) {
    throw gitError('runtime-release-git-not-integration', `Source commit ${sourceRevision} is not an ancestor of ${integrationRef}${stderr ? `: ${stderr}` : '.'}`);
  }
  return integrationRevision;
}

function decodeGitPath(bytes: Buffer) {
  const value = bytes.toString('utf8');
  if (!Buffer.from(value, 'utf8').equals(bytes)) throw gitError('runtime-release-git-path-invalid', 'Git runtime path is not valid UTF-8.');
  return value;
}

function parseTreeEntry(bytes: Buffer): GitRuntimeBlobSnapshotFile {
  const tab = bytes.indexOf(9);
  if (tab <= 0) throw gitError('runtime-release-git-tree-invalid', 'Git ls-tree entry is missing its header or path.');
  const header = bytes.subarray(0, tab).toString('ascii');
  const pathValue = decodeGitPath(bytes.subarray(tab + 1));
  const match = /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40,64})$/u.exec(header);
  if (!match) throw gitError('runtime-release-git-tree-invalid', 'Git ls-tree entry has an unsupported format.');
  const [, mode, type, blobObjectId] = match;
  if (type !== 'blob' || !GIT_OBJECT_ID_PATTERN.test(blobObjectId) || (mode !== '100644' && mode !== '100755')) {
    throw gitError('runtime-release-git-tree-entry-forbidden', `Git runtime tree contains unsupported entry: ${mode} ${type} ${pathValue}`);
  }
  if (!pathValue.startsWith(RUNTIME_PREFIX)) {
    throw gitError('runtime-release-git-tree-entry-forbidden', `Git ls-tree returned a path outside ${RUNTIME_PREFIX}: ${pathValue}`);
  }
  const relativePath = assertRuntimeRelativePath(pathValue.slice(RUNTIME_PREFIX.length));
  return {
    path: relativePath,
    mode: mode as '100644' | '100755',
    blobObjectId,
    sizeBytes: 0,
    sha256: '',
  };
}

async function listRuntimeTree(repoRoot: string, sourceRevision: string) {
  const result = await runGit(repoRoot, ['ls-tree', '-r', '-z', '--full-tree', sourceRevision, '--', RUNTIME_PREFIX.slice(0, -1)], 'Git runtime tree listing');
  if (result.stdout.byteLength === 0) throw gitError('runtime-release-git-tree-empty', 'Git runtime tree is empty.');
  const entries: GitRuntimeBlobSnapshotFile[] = [];
  for (const entry of result.stdout.toString('binary').split('\u0000')) {
    if (!entry) continue;
    entries.push(parseTreeEntry(Buffer.from(entry, 'binary')));
  }
  if (entries.length === 0) throw gitError('runtime-release-git-tree-empty', 'Git runtime tree is empty.');
  entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index - 1].path === entries[index].path) throw gitError('runtime-release-git-tree-invalid', `Git runtime tree contains a duplicate path: ${entries[index].path}`);
  }
  return entries;
}

async function readGitExternalInputManifest(repoRoot: string, sourceRevision: string): Promise<RuntimeExternalInput[]> {
  const tree = await runGit(
    repoRoot,
    ['ls-tree', '-z', '--full-tree', sourceRevision, '--', EXTERNAL_INPUT_MANIFEST_PATH],
    'Git runtime external-input listing',
  );
  if (tree.stdout.byteLength === 0) return [];
  const entries = tree.stdout.toString('binary').split('\u0000').filter(Boolean);
  if (entries.length !== 1) {
    throw gitError('runtime-release-external-input-invalid', 'Git runtime external-input declaration must resolve to exactly one file.');
  }
  const entry = entries[0] as string;
  const tab = entry.indexOf('\t');
  const header = tab > 0 ? entry.slice(0, tab) : '';
  const inputPath = tab > 0 ? entry.slice(tab + 1) : '';
  const match = /^(100644|100755) blob ([0-9a-f]{40,64})$/u.exec(header);
  if (!match || inputPath !== EXTERNAL_INPUT_MANIFEST_PATH) {
    throw gitError('runtime-release-external-input-invalid', 'Git runtime external-input declaration is not a regular tracked file.');
  }
  const declarationObjectId = match[2] as string;
  const bytes = await collectOutput(openGitBlobStream(repoRoot, declarationObjectId));
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw gitError('runtime-release-external-input-invalid', 'Git runtime external-input declaration is not valid JSON.');
  }
  const raw = object(parsed, 'runtime external inputs');
  assertExactKeys(raw, ['schemaVersion', 'inputs'], 'runtime external inputs');
  if (raw.schemaVersion !== EXTERNAL_INPUT_SCHEMA_VERSION || !Array.isArray(raw.inputs)) {
    throw gitError('runtime-release-external-input-invalid', 'Git runtime external-input declaration has an unsupported schema.');
  }
  const inputs = raw.inputs.map((value, index) => {
    const item = object(value, `runtime external inputs.inputs[${index}]`);
    assertExactKeys(item, ['pathPrefix', 'externalInputId'], `runtime external inputs.inputs[${index}]`);
    const pathPrefix = externalInputPathPrefix(item.pathPrefix, `runtime external inputs.inputs[${index}].pathPrefix`);
    const inputId = externalInputId(item.externalInputId, `runtime external inputs.inputs[${index}].externalInputId`);
    return {
      pathPrefix,
      externalInputId: inputId,
      source: {
        externalInputId: inputId,
        externalInputManifestObjectId: declarationObjectId,
      },
    } satisfies RuntimeExternalInput;
  }).sort((left, right) => left.pathPrefix < right.pathPrefix ? -1 : left.pathPrefix > right.pathPrefix ? 1 : 0);
  for (let index = 1; index < inputs.length; index += 1) {
    if (inputs[index - 1]?.pathPrefix === inputs[index]?.pathPrefix) {
      throw gitError('runtime-release-external-input-invalid', 'Git runtime external-input declaration contains duplicate path prefixes.');
    }
  }
  return inputs;
}

async function readGitExternalInputManifestObjectId(repoRoot: string, sourceRevision: string): Promise<string | undefined> {
  const tree = await runGit(
    repoRoot,
    ['ls-tree', '-z', '--full-tree', sourceRevision, '--', EXTERNAL_INPUT_MANIFEST_PATH],
    'Git runtime external-input listing',
  );
  if (tree.stdout.byteLength === 0) return undefined;
  const entries = tree.stdout.toString('binary').split('\u0000').filter(Boolean);
  if (entries.length !== 1) {
    throw gitError('runtime-release-external-input-invalid', 'Git runtime external-input declaration must resolve to exactly one file.');
  }
  const entry = entries[0] as string;
  const tab = entry.indexOf('\t');
  const header = tab > 0 ? entry.slice(0, tab) : '';
  const inputPath = tab > 0 ? entry.slice(tab + 1) : '';
  const match = /^(100644|100755) blob ([0-9a-f]{40,64})$/u.exec(header);
  if (!match || inputPath !== EXTERNAL_INPUT_MANIFEST_PATH) {
    throw gitError('runtime-release-external-input-invalid', 'Git runtime external-input declaration is not a regular tracked file.');
  }
  return match[2];
}

async function readGitExternalInputBundleDeclaration(repoRoot: string, sourceRevision: string): Promise<RuntimeExternalInputBundleDeclaration | undefined> {
  const tree = await runGit(
    repoRoot,
    ['ls-tree', '-z', '--full-tree', sourceRevision, '--', EXTERNAL_INPUT_BUNDLE_DECLARATION_PATH],
    'Git runtime external-input bundle declaration listing',
  );
  if (tree.stdout.byteLength === 0) return undefined;
  const entries = tree.stdout.toString('binary').split('\u0000').filter(Boolean);
  if (entries.length !== 1) throw gitError('runtime-release-external-input-bundle-invalid', 'Git external-input bundle declaration must resolve to exactly one file.');
  const entry = entries[0] as string;
  const tab = entry.indexOf('\t');
  const header = tab > 0 ? entry.slice(0, tab) : '';
  const inputPath = tab > 0 ? entry.slice(tab + 1) : '';
  const match = /^(100644|100755) blob ([0-9a-f]{40,64})$/u.exec(header);
  if (!match || inputPath !== EXTERNAL_INPUT_BUNDLE_DECLARATION_PATH) {
    throw gitError('runtime-release-external-input-bundle-invalid', 'Git external-input bundle declaration is not a regular tracked file.');
  }
  const declarationObjectId = match[2] as string;
  const bytes = await collectOutput(openGitBlobStream(repoRoot, declarationObjectId));
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw gitError('runtime-release-external-input-bundle-invalid', 'Git external-input bundle declaration is not valid JSON.');
  }
  let declaration: ExternalInputBundleDeclaration;
  try {
    declaration = parseExternalInputBundleDeclaration(parsed);
    if (serializeExternalInputBundleDeclaration(declaration) !== bytes.toString('utf8')) {
      throw new Error('declaration wire is not canonical');
    }
  } catch (cause) {
    throw gitError('runtime-release-external-input-bundle-invalid', cause instanceof Error ? cause.message : String(cause));
  }
  return { declaration, declarationObjectId };
}

async function readGitExternalInputBundleDeclarationObjectId(repoRoot: string, sourceRevision: string): Promise<string | undefined> {
  const tree = await runGit(
    repoRoot,
    ['ls-tree', '-z', '--full-tree', sourceRevision, '--', EXTERNAL_INPUT_BUNDLE_DECLARATION_PATH],
    'Git runtime external-input bundle declaration listing',
  );
  if (tree.stdout.byteLength === 0) return undefined;
  const entries = tree.stdout.toString('binary').split('\u0000').filter(Boolean);
  if (entries.length !== 1) throw gitError('runtime-release-external-input-bundle-invalid', 'Git external-input bundle declaration must resolve to exactly one file.');
  const entry = entries[0] as string;
  const tab = entry.indexOf('\t');
  const header = tab > 0 ? entry.slice(0, tab) : '';
  const inputPath = tab > 0 ? entry.slice(tab + 1) : '';
  const match = /^(100644|100755) blob ([0-9a-f]{40,64})$/u.exec(header);
  if (!match || inputPath !== EXTERNAL_INPUT_BUNDLE_DECLARATION_PATH) {
    throw gitError('runtime-release-external-input-bundle-invalid', 'Git external-input bundle declaration is not a regular tracked file.');
  }
  return match[2];
}

function externalInputForPath(inputs: readonly RuntimeExternalInput[], relativePath: string) {
  const matches = inputs.filter((input) => relativePath.startsWith(input.pathPrefix));
  if (matches.length === 0) return undefined;
  return [...matches].sort((left, right) => right.pathPrefix.length - left.pathPrefix.length)[0];
}

function inheritedExternalParentFiles(input: {
  parentManifest: ActRuntimeBlobReleaseManifest | undefined;
  targetEntries: readonly GitRuntimeBlobSnapshotFile[];
  externalInputs: readonly RuntimeExternalInput[];
}) {
  if (!input.parentManifest) return [] as RuntimeBlobReleaseFileMetadata[];
  const targetPaths = new Set(input.targetEntries.map((entry) => entry.path));
  const inherited: RuntimeBlobReleaseFileMetadata[] = [];
  for (const file of input.parentManifest.files) {
    if (targetPaths.has(file.path) || isGitSource(file.source)) continue;
    const externalInput = externalInputForPath(input.externalInputs, file.path);
    if (!externalInput) {
      throw gitError('runtime-release-external-source-missing', `Parent runtime entry has no Git source identity or declared external input: ${file.path}`);
    }
    if (isExternalBundleSource(file.source)) {
      throw gitError('runtime-release-external-source-missing', `Parent runtime entry requires its exact external bundle identity: ${file.path}`);
    }
    if (
      isExternalSource(file.source)
      && (
        file.source.externalInputId !== externalInput.source.externalInputId
        || file.source.externalInputManifestObjectId !== externalInput.source.externalInputManifestObjectId
      )
    ) {
      throw gitError('runtime-release-external-source-changed', `External runtime input identity changed without a declared source validation: ${file.path}`);
    }
    inherited.push({
      path: file.path,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
      source: externalInput.source,
    });
  }
  return inherited;
}

function inheritedExternalParentFilesFromManifest(input: {
  parentManifest: ActRuntimeBlobReleaseManifest | undefined;
  targetEntries: readonly GitRuntimeBlobSnapshotFile[];
  manifest: ActRuntimeBlobReleaseManifest;
}) {
  if (!input.parentManifest) return [] as RuntimeBlobReleaseFileMetadata[];
  const targetPaths = new Set(input.targetEntries.map((entry) => entry.path));
  const manifestByPath = new Map(input.manifest.files.map((file) => [file.path, file] as const));
  const inherited: RuntimeBlobReleaseFileMetadata[] = [];
  for (const parentFile of input.parentManifest.files) {
    if (targetPaths.has(parentFile.path) || isGitSource(parentFile.source)) continue;
    const manifestFile = manifestByPath.get(parentFile.path);
    if (!manifestFile || !manifestFile.source || isGitSource(manifestFile.source)) {
      throw gitError('runtime-release-external-source-missing', `Planned runtime entry is missing its external source identity: ${parentFile.path}`);
    }
    if (manifestFile.sizeBytes !== parentFile.sizeBytes || manifestFile.sha256 !== parentFile.sha256) {
      throw gitError('runtime-release-external-source-changed', `External runtime bytes changed without a new source validation: ${parentFile.path}`);
    }
    if (parentFile.source) {
      if (!isExternalSource(parentFile.source) || !isExternalSource(manifestFile.source)
        || parentFile.source.externalInputId !== manifestFile.source.externalInputId
        || parentFile.source.externalInputManifestObjectId !== manifestFile.source.externalInputManifestObjectId) {
        throw gitError('runtime-release-external-source-changed', `External runtime source identity changed without a new source validation: ${parentFile.path}`);
      }
    }
    inherited.push(manifestFile);
  }
  return inherited;
}

function bundleSource(bundle: ExternalInputBundle, declarationObjectId: string): ActRuntimeBlobReleaseFileExternalBundleSource {
  return {
    externalInputId: bundle.externalInputId,
    externalInputManifestObjectId: declarationObjectId,
    bundleSemanticSha256: bundle.manifestSha256,
    bundleWireSha256: bundle.wireSha256,
  };
}

function bundleFilePath(bundle: ExternalInputBundle, file: ExternalInputBundleFile) {
  if (file.absolutePath) return file.absolutePath;
  const generatedPrefix = bundle.overlay.generatedPrefixes.find((prefix) => file.path.startsWith(prefix));
  if (generatedPrefix && bundle.generatedRoot) {
    return path.join(bundle.generatedRoot, file.path.slice('resources/'.length));
  }
  if (generatedPrefix) return '';
  if (!bundle.root) return '';
  return path.join(bundle.root, file.path);
}

function externalBundleMetadata(bundle: ExternalInputBundle, declarationObjectId: string) {
  const source = bundleSource(bundle, declarationObjectId);
  return bundle.files.map((file) => ({
    path: file.path,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
    source,
    absolutePath: bundleFilePath(bundle, file),
  } satisfies ExternalInputBundleSnapshotFile));
}

function inheritedExternalBundleParentFiles(input: {
  parentManifest: ActRuntimeBlobReleaseManifest | undefined;
  targetEntries: readonly GitRuntimeBlobSnapshotFile[];
  bundleFiles: readonly ExternalInputBundleSnapshotFile[];
}) {
  if (!input.parentManifest) return [] as RuntimeBlobReleaseFileMetadata[];
  const targetPaths = new Set(input.targetEntries.map((entry) => entry.path));
  const bundleByPath = new Map(input.bundleFiles.map((file) => [file.path, file] as const));
  const inherited: RuntimeBlobReleaseFileMetadata[] = [];
  for (const file of input.parentManifest.files) {
    if (targetPaths.has(file.path)) continue;
    if (!file.source) throw gitError('runtime-release-external-source-missing', `Parent runtime entry has no source identity for the exact external bundle: ${file.path}`);
    const bundleFile = bundleByPath.get(file.path);
    if (bundleFile && isGitSource(file.source)) throw gitError('runtime-release-external-source-conflict', `Parent Git source conflicts with the exact external bundle: ${file.path}`);
    if (isGitSource(file.source)) continue;
    if (!bundleFile) throw gitError('runtime-release-external-source-missing', `Parent runtime entry is outside the exact external bundle: ${file.path}`);
    if (file.sizeBytes !== bundleFile.sizeBytes || file.sha256 !== bundleFile.sha256) {
      throw gitError('runtime-release-external-source-changed', `External runtime bytes changed without a new bundle identity: ${file.path}`);
    }
    inherited.push(bundleFile);
  }
  return inherited;
}

async function assertExternalBundleFileAvailable(file: ExternalInputBundleSnapshotFile) {
  const details = await lstat(file.absolutePath).catch(() => undefined);
  if (!details || details.isSymbolicLink() || !details.isFile()) {
    throw gitError('runtime-release-external-source-missing', `External bundle file is not a regular local file: ${file.path}`);
  }
}

async function openExternalBundleFile(file: ExternalInputBundleSnapshotFile) {
  await assertExternalBundleFileAvailable(file);
  return createReadStream(file.absolutePath);
}

async function inspectExternalBundleFile(file: ExternalInputBundleSnapshotFile) {
  await assertExternalBundleFileAvailable(file);
  const source = createReadStream(file.absolutePath);
  const hash = createHash('sha256');
  let sizeBytes = 0;
  for await (const chunk of source) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(bytes);
    sizeBytes += bytes.byteLength;
  }
  return { sizeBytes, sha256: hash.digest('hex') };
}

export function openGitBlobStream(repoRoot: string, blobObjectId: string) {
  assertRepoRoot(repoRoot);
  if (!GIT_OBJECT_ID_PATTERN.test(blobObjectId)) throw gitError('runtime-release-git-blob-invalid', 'Git blob object id is invalid.');
  const child = spawnGit(repoRoot, ['cat-file', 'blob', blobObjectId]);
  let settled = false;
  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    child.stdout.destroy(error);
  };
  child.once('error', (error) => fail(error));
  child.once('close', (code, signal) => {
    if (settled) return;
    settled = true;
    if (code !== 0) child.stdout.destroy(gitError('runtime-release-git-blob-read-failed', `Git blob read failed${signal ? ` (${signal})` : ''}.`));
  });
  return child.stdout;
}

async function inspectBlob(repoRoot: string, blobObjectId: string) {
  const source = openGitBlobStream(repoRoot, blobObjectId);
  const hash = createHash('sha256');
  let sizeBytes = 0;
  for await (const chunk of source) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(bytes);
    sizeBytes += bytes.byteLength;
  }
  return { sizeBytes, sha256: hash.digest('hex') };
}

function parentFilesByGitObjectId(parentManifest: ActRuntimeBlobReleaseManifest | undefined) {
  const parent = new Map<string, { sizeBytes: number; sha256: string }>();
  if (!parentManifest) return parent;
  for (const file of parentManifest.files) {
    if (!isGitSource(file.source)) continue;
    const { gitObjectId } = file.source;
    const current = { sizeBytes: file.sizeBytes, sha256: file.sha256 };
    const existing = parent.get(gitObjectId);
    if (existing && (existing.sizeBytes !== current.sizeBytes || existing.sha256 !== current.sha256)) {
      throw gitError('runtime-release-git-parent-source-inconsistent', `Parent release maps Git object ${gitObjectId} to incompatible blob identities.`);
    }
    parent.set(gitObjectId, current);
  }
  return parent;
}

async function buildSnapshotFiles(
  repoRoot: string,
  entries: GitRuntimeBlobSnapshotFile[],
  parentManifest: ActRuntimeBlobReleaseManifest | undefined,
  inheritedExternalFiles: readonly RuntimeBlobReleaseFileMetadata[],
  bundleFiles: readonly ExternalInputBundleSnapshotFile[] = [],
) {
  const metadata: RuntimeBlobReleaseFileMetadata[] = [...(bundleFiles.length > 0 ? bundleFiles : inheritedExternalFiles)];
  const parent = parentFilesByGitObjectId(parentManifest);
  // A target tree can reference one new Git blob from more than one logical
  // path. Keep the first streamed result for the duration of this snapshot so
  // the daily proof boundary is unique source objects, not logical entries.
  const resolved = new Map(parent);
  const stats: GitRuntimeBlobReleaseSnapshotStats = {
    reusedFileCount: (bundleFiles.length > 0 ? bundleFiles : inheritedExternalFiles).length,
    reusedBytes: (bundleFiles.length > 0 ? bundleFiles : inheritedExternalFiles).reduce((total, file) => total + file.sizeBytes, 0),
    hashedFileCount: 0,
    hashedBytes: 0,
  };
  for (const entry of entries) {
    const parentDigest = parent.get(entry.blobObjectId);
    const cachedDigest = resolved.get(entry.blobObjectId);
    const digest = cachedDigest ?? await inspectBlob(repoRoot, entry.blobObjectId);
    if (!cachedDigest) resolved.set(entry.blobObjectId, digest);
    entry.sizeBytes = digest.sizeBytes;
    entry.sha256 = digest.sha256;
    if (parentDigest) {
      stats.reusedFileCount += 1;
      stats.reusedBytes += digest.sizeBytes;
    } else if (!cachedDigest) {
      stats.hashedFileCount += 1;
      stats.hashedBytes += digest.sizeBytes;
    }
    metadata.push({
      path: entry.path,
      sizeBytes: digest.sizeBytes,
      sha256: digest.sha256,
      source: { gitObjectId: entry.blobObjectId },
    });
  }
  return { metadata, stats };
}

export async function buildGitRuntimeBlobReleaseSnapshot(input: {
  repoRoot: string;
  sourceRevision: string;
  integrationRef?: string;
  parentManifest?: ActRuntimeBlobReleaseManifest;
  externalBundle?: ExternalInputBundle;
}): Promise<GitRuntimeBlobReleaseSnapshot> {
  assertRepoRoot(input.repoRoot);
  const sourceRevision = await resolveGitCommit(input.repoRoot, input.sourceRevision, 'Source revision');
  const integrationRef = input.integrationRef ?? 'origin/integration';
  const integrationRevision = await assertIntegrationAncestor(input.repoRoot, sourceRevision, integrationRef);
  const entries = await listRuntimeTree(input.repoRoot, sourceRevision);
  const externalInputs = await readGitExternalInputManifest(input.repoRoot, sourceRevision);
  const bundleDeclaration = await readGitExternalInputBundleDeclaration(input.repoRoot, sourceRevision);
  let bundleFiles: ExternalInputBundleSnapshotFile[] = [];
  let inheritedExternalFiles: RuntimeBlobReleaseFileMetadata[] = [];
  if (input.externalBundle) {
    if (!bundleDeclaration) throw gitError('runtime-release-external-input-bundle-undeclared', 'External bundle is not bound by a tracked declaration.');
    try {
      declarationInputForBundle(bundleDeclaration.declaration, input.externalBundle);
      const baseEntries = await listRuntimeTree(input.repoRoot, input.externalBundle.overlay.baseSourceRevision);
      if (runtimeGitTreeDigest(baseEntries) !== input.externalBundle.overlay.baseRuntimeTreeSha256 || runtimeGitTreeDigest(entries) !== input.externalBundle.overlay.baseRuntimeTreeSha256) {
        throw new Error('external bundle base Git runtime capture drifted');
      }
      // Parsing is repeated here so callers cannot smuggle local-only fields or
      // a stale wire digest through a hand-built object.
      const { root: localRoot, generatedRoot: localGeneratedRoot, wireSha256: _ignoredWireSha256, ...wireBundle } = input.externalBundle;
      input.externalBundle = {
        ...parseExternalInputBundle(wireBundle),
        ...(localRoot ? { root: localRoot } : {}),
        ...(localGeneratedRoot ? { generatedRoot: localGeneratedRoot } : {}),
      };
    } catch (cause) {
      throw gitError('runtime-release-external-input-bundle-mismatch', cause instanceof Error ? cause.message : String(cause));
    }
    bundleFiles = externalBundleMetadata(input.externalBundle, bundleDeclaration.declarationObjectId);
    const targetPaths = new Set(entries.map((entry) => entry.path));
    for (const file of bundleFiles) {
      if (targetPaths.has(file.path)) throw gitError('runtime-release-external-source-conflict', `Git and external bundle both provide ${file.path}.`);
    }
    inheritedExternalFiles = inheritedExternalBundleParentFiles({ parentManifest: input.parentManifest, targetEntries: entries, bundleFiles });
  } else {
    inheritedExternalFiles = inheritedExternalParentFiles({
      parentManifest: input.parentManifest,
      targetEntries: entries,
      externalInputs,
    });
  }
  const { metadata, stats } = await buildSnapshotFiles(input.repoRoot, entries, input.parentManifest, inheritedExternalFiles, bundleFiles);
  const manifest = buildRuntimeBlobReleaseManifestFromFiles(sourceRevision, metadata);
  const filesByPath = new Map<string, GitRuntimeBlobSnapshotSourceFile>();
  for (const entry of entries) filesByPath.set(entry.path, entry);
  for (const file of bundleFiles) filesByPath.set(file.path, file);
  const externalSnapshotFiles = new Map<string, string>();
  return {
    repoRoot: input.repoRoot,
    sourceRevision,
    integrationRef,
    integrationRevision,
    gitTree: entries.map(({ path: relativePath, mode, blobObjectId }) => ({ path: relativePath, mode, blobObjectId })),
    parentManifest: input.parentManifest,
    manifest,
    stats,
    filesByPath,
    externalSnapshotFiles,
    ...(input.externalBundle ? { externalBundle: input.externalBundle } : {}),
    openFile: async (relativePath: string) => {
      const file = filesByPath.get(relativePath);
      if (!file) throw gitError('runtime-release-git-path-missing', `Git runtime path is absent from the snapshot: ${relativePath}`);
      if (isExternalBundleSource(file.source)) {
        const snapshotPath = externalSnapshotFiles.get(relativePath);
        return snapshotPath ? createReadStream(snapshotPath) : openExternalBundleFile(file as ExternalInputBundleSnapshotFile);
      }
      if (!('blobObjectId' in file)) throw gitError('runtime-release-git-source-mismatch', `Snapshot source identity is not a Git blob: ${relativePath}`);
      return openGitBlobStream(input.repoRoot, file.blobObjectId);
    },
  };
}

/**
 * Reopen a manifest that was just planned from the immutable Git tree without
 * hashing its source blobs again.  The publisher still hashes a source while
 * it streams each blob that the remote reports missing; immutable Git object
 * identities make a second preflight body pass unnecessary.
 */
export async function openGitRuntimeBlobReleaseSnapshot(input: {
  repoRoot: string;
  sourceRevision: string;
  integrationRef?: string;
  parentManifest?: ActRuntimeBlobReleaseManifest;
  manifest: ActRuntimeBlobReleaseManifest;
  externalBundle?: ExternalInputBundle;
}): Promise<GitRuntimeBlobReleaseSnapshot> {
  assertRepoRoot(input.repoRoot);
  const sourceRevision = await resolveGitCommit(input.repoRoot, input.sourceRevision, 'Source revision');
  const integrationRef = input.integrationRef ?? 'origin/integration';
  const integrationRevision = await assertIntegrationAncestor(input.repoRoot, sourceRevision, integrationRef);
  if (input.manifest.sourceRevision !== sourceRevision) {
    throw gitError('runtime-release-git-source-mismatch', 'Planned runtime blob manifest source revision does not match the requested Git revision.');
  }
  const entries = await listRuntimeTree(input.repoRoot, sourceRevision);
  let bundleFiles: ExternalInputBundleSnapshotFile[] = [];
  let inheritedExternalFiles: RuntimeBlobReleaseFileMetadata[] = [];
  if (input.externalBundle) {
    const bundleDeclarationObjectId = await readGitExternalInputBundleDeclarationObjectId(input.repoRoot, sourceRevision);
    if (!bundleDeclarationObjectId) throw gitError('runtime-release-external-input-bundle-undeclared', 'External bundle is not bound by a tracked declaration.');
    try {
      const baseEntries = await listRuntimeTree(input.repoRoot, input.externalBundle.overlay.baseSourceRevision);
      if (runtimeGitTreeDigest(baseEntries) !== input.externalBundle.overlay.baseRuntimeTreeSha256 || runtimeGitTreeDigest(entries) !== input.externalBundle.overlay.baseRuntimeTreeSha256) {
        throw new Error('external bundle base Git runtime capture drifted');
      }
      const localRoot = input.externalBundle.root;
      const localGeneratedRoot = input.externalBundle.generatedRoot;
      const { root: _ignoredRoot, generatedRoot: _ignoredGeneratedRoot, wireSha256: _ignoredWireSha256, ...wireBundle } = input.externalBundle;
      input.externalBundle = {
        ...parseExternalInputBundle(wireBundle),
        ...(localRoot ? { root: localRoot } : {}),
        ...(localGeneratedRoot ? { generatedRoot: localGeneratedRoot } : {}),
      };
    } catch (cause) {
      throw gitError('runtime-release-external-input-bundle-mismatch', cause instanceof Error ? cause.message : String(cause));
    }
    bundleFiles = externalBundleMetadata(input.externalBundle, bundleDeclarationObjectId);
    const targetPaths = new Set(entries.map((entry) => entry.path));
    for (const file of bundleFiles) {
      if (targetPaths.has(file.path)) throw gitError('runtime-release-external-source-conflict', `Git and external bundle both provide ${file.path}.`);
    }
    inheritedExternalFiles = inheritedExternalBundleParentFiles({ parentManifest: input.parentManifest, targetEntries: entries, bundleFiles });
  } else {
    const externalInputManifestObjectId = await readGitExternalInputManifestObjectId(input.repoRoot, sourceRevision);
    inheritedExternalFiles = inheritedExternalParentFilesFromManifest({
      parentManifest: input.parentManifest,
      targetEntries: entries,
      manifest: input.manifest,
    });
    for (const file of inheritedExternalFiles) {
      if (!isExternalSource(file.source) || !externalInputManifestObjectId || file.source.externalInputManifestObjectId !== externalInputManifestObjectId) {
        throw gitError('runtime-release-external-source-changed', `External runtime declaration identity changed without a new source validation: ${file.path}`);
      }
    }
  }
  const expectedFiles = new Map<string, RuntimeBlobReleaseFileMetadata>();
  for (const externalFile of (bundleFiles.length > 0 ? bundleFiles : inheritedExternalFiles)) expectedFiles.set(externalFile.path, externalFile);
  for (const entry of entries) {
    expectedFiles.set(entry.path, {
      path: entry.path,
      sizeBytes: 0,
      sha256: '',
      source: { gitObjectId: entry.blobObjectId },
    });
  }
  if (expectedFiles.size !== input.manifest.files.length) {
    throw gitError('runtime-release-git-source-mismatch', 'Planned runtime blob manifest file count does not match its Git and declared external inputs.');
  }
  for (const manifestFile of input.manifest.files) {
    const expected = expectedFiles.get(manifestFile.path);
    if (!expected || !manifestFile.source) {
      throw gitError('runtime-release-git-source-mismatch', 'Planned runtime blob manifest source identities do not match the requested Git tree.');
    }
    if (isGitSource(expected.source)) {
      if (!isGitSource(manifestFile.source) || manifestFile.source.gitObjectId !== expected.source.gitObjectId) {
        throw gitError('runtime-release-git-source-mismatch', 'Planned runtime blob manifest Git source identities do not match the requested Git tree.');
      }
      const entry = entries.find((candidate) => candidate.path === manifestFile.path);
      if (!entry) throw gitError('runtime-release-git-source-mismatch', 'Planned runtime blob manifest is missing a Git source entry.');
      entry.sizeBytes = manifestFile.sizeBytes;
      entry.sha256 = manifestFile.sha256;
      continue;
    }
    const expectedSource = expected.source;
    const manifestSource = manifestFile.source;
    if (
      !manifestSource
      || !expectedSource
      || !('externalInputId' in manifestSource)
      || !('externalInputId' in expectedSource)
      || manifestSource.externalInputId !== expectedSource.externalInputId
      || manifestSource.externalInputManifestObjectId !== expectedSource.externalInputManifestObjectId
      || manifestFile.sizeBytes !== expected.sizeBytes
      || manifestFile.sha256 !== expected.sha256
    ) {
      throw gitError('runtime-release-git-source-mismatch', 'Planned runtime blob manifest external inputs do not match the validated parent binding.');
    }
    if (isExternalBundleSource(expectedSource)) {
      if (!isExternalBundleSource(manifestSource) || manifestSource.bundleSemanticSha256 !== expectedSource.bundleSemanticSha256 || manifestSource.bundleWireSha256 !== expectedSource.bundleWireSha256) {
        throw gitError('runtime-release-git-source-mismatch', 'Planned runtime blob manifest external bundle identity does not match the validated declaration.');
      }
    } else if (!isExternalSource(manifestSource)) {
      throw gitError('runtime-release-git-source-mismatch', 'Planned runtime blob manifest legacy external source identity is invalid.');
    }
  }
  const filesByPath = new Map<string, GitRuntimeBlobSnapshotSourceFile>();
  for (const entry of entries) filesByPath.set(entry.path, entry);
  for (const file of bundleFiles) filesByPath.set(file.path, file);
  const externalSnapshotFiles = new Map<string, string>();
  return {
    repoRoot: input.repoRoot,
    sourceRevision,
    integrationRef,
    integrationRevision,
    gitTree: entries.map(({ path: relativePath, mode, blobObjectId }) => ({ path: relativePath, mode, blobObjectId })),
    parentManifest: input.parentManifest,
    manifest: input.manifest,
    stats: {
      reusedFileCount: 0,
      reusedBytes: 0,
      hashedFileCount: 0,
      hashedBytes: 0,
    },
    ...(input.externalBundle ? { externalBundle: input.externalBundle } : {}),
    filesByPath,
    externalSnapshotFiles,
    openFile: async (relativePath: string) => {
      const file = filesByPath.get(relativePath);
      if (!file) throw gitError('runtime-release-git-path-missing', `Git runtime path is absent from the snapshot: ${relativePath}`);
      if (isExternalBundleSource(file.source)) {
        const snapshotPath = externalSnapshotFiles.get(relativePath);
        return snapshotPath ? createReadStream(snapshotPath) : openExternalBundleFile(file as ExternalInputBundleSnapshotFile);
      }
      if (!('blobObjectId' in file)) throw gitError('runtime-release-git-source-mismatch', `Snapshot source identity is not a Git blob: ${relativePath}`);
      return openGitBlobStream(input.repoRoot, file.blobObjectId);
    },
  };
}

export async function verifyGitRuntimeSnapshotFile(input: {
  snapshot: GitRuntimeBlobReleaseSnapshot;
  file: RuntimeBlobReleaseFileMetadata;
}) {
  const snapshotFile = input.snapshot.filesByPath.get(input.file.path);
  if (!snapshotFile || snapshotFile.sizeBytes !== input.file.sizeBytes || snapshotFile.sha256 !== input.file.sha256) {
    throw gitError('runtime-release-git-source-mismatch', `Git snapshot does not match manifest: ${input.file.path}`);
  }
  if (isExternalBundleSource(snapshotFile.source)) {
    const digest = await inspectExternalBundleFile(snapshotFile as ExternalInputBundleSnapshotFile);
    if (digest.sizeBytes !== input.file.sizeBytes || digest.sha256 !== input.file.sha256) {
      throw gitError('runtime-release-external-source-changed', `External bundle bytes changed after preparation: ${input.file.path}`);
    }
    return snapshotFile;
  }
  if (!isGitSource(snapshotFile.source)) throw gitError('runtime-release-git-source-mismatch', `Snapshot source identity is not verifiable: ${input.file.path}`);
  if (!('blobObjectId' in snapshotFile)) throw gitError('runtime-release-git-source-mismatch', `Snapshot source identity is not a Git blob: ${input.file.path}`);
  const digest = await inspectBlob(input.snapshot.repoRoot, snapshotFile.blobObjectId);
  if (digest.sizeBytes !== input.file.sizeBytes || digest.sha256 !== input.file.sha256) {
    throw gitError('runtime-release-git-source-mismatch', `Git blob changed or does not match manifest: ${input.file.path}`);
  }
  return snapshotFile;
}
