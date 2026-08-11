import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { stableStringify } from '@/lib/aggregate-governance/hash';

export const ACT_RUNTIME_RELEASE_SCHEMA_VERSION = 'act-runtime-release.v1';
export const ACT_RUNTIME_RELEASE_MANIFEST_FILENAME = '.act-runtime-release.v1.json';
const RELEASE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export interface ActRuntimeReleaseFile {
  path: string;
  objectKey: string;
  sizeBytes: number;
  sha256: string;
}

export interface ActRuntimeReleaseManifest {
  schemaVersion: typeof ACT_RUNTIME_RELEASE_SCHEMA_VERSION;
  releaseId: string;
  sourceRevision: string;
  fileCount: number;
  totalBytes: number;
  treeSha256: string;
  manifestSha256: string;
  files: ActRuntimeReleaseFile[];
}

export interface BuildRuntimeReleaseManifestOptions {
  releaseId: string;
  sourceRevision: string;
}

export class RuntimeReleaseValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'RuntimeReleaseValidationError';
  }
}

function sha256(bytes: string | Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

function compareCodePoints(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizedRelativePath(value: string) {
  if (value.includes('\\')) {
    throw new RuntimeReleaseValidationError('runtime-release-path-invalid', `Invalid runtime release path: ${value}`);
  }
  const normalized = value;
  if (
    !normalized
    || normalized.startsWith('/')
    || /^[A-Za-z]:\//.test(normalized)
    || /[\u0000-\u001f\u007f]/u.test(normalized)
    || normalized.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new RuntimeReleaseValidationError('runtime-release-path-invalid', `Invalid runtime release path: ${value}`);
  }
  return normalized;
}

export function assertRuntimeReleaseId(value: string) {
  if (!RELEASE_ID_PATTERN.test(value)) {
    throw new RuntimeReleaseValidationError('runtime-release-id-invalid', 'Runtime release id must be lowercase alphanumeric with optional internal hyphens.');
  }
}

export function runtimeReleaseObjectKey(releaseId: string, relativePath: string) {
  assertRuntimeReleaseId(releaseId);
  return `runtime/releases/${releaseId}/${normalizedRelativePath(relativePath)}`;
}

export function runtimeReleaseManifestObjectKey(releaseId: string) {
  return runtimeReleaseObjectKey(releaseId, ACT_RUNTIME_RELEASE_MANIFEST_FILENAME);
}

export function deriveRuntimeReleaseId(sourceRevision: string, treeSha256: string) {
  const normalizedRevision = sourceRevision.toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalizedRevision) || !SHA256_PATTERN.test(treeSha256)) {
    throw new RuntimeReleaseValidationError('runtime-release-identity-invalid', 'Runtime release identity requires a Git SHA and tree SHA-256.');
  }
  return `runtime-${sha256(stableStringify({ sourceRevision: normalizedRevision, treeSha256 })).slice(0, 55)}`;
}

export function assertContentAddressedRuntimeReleaseId(manifest: Pick<ActRuntimeReleaseManifest, 'releaseId' | 'sourceRevision' | 'treeSha256'>) {
  const expected = deriveRuntimeReleaseId(manifest.sourceRevision, manifest.treeSha256);
  if (manifest.releaseId !== expected) {
    throw new RuntimeReleaseValidationError('runtime-release-id-not-content-addressed', `Runtime release id must equal its immutable content identity: ${expected}`);
  }
}

function isIgnoredRuntimeFile(relativePath: string) {
  return path.posix.basename(relativePath) === '.DS_Store'
    || relativePath === ACT_RUNTIME_RELEASE_MANIFEST_FILENAME;
}

async function sha256File(absolutePath: string) {
  return await new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(absolutePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolve(hash.digest('hex')));
  });
}

async function collectRuntimeFiles(root: string, current = root): Promise<Array<{ path: string; absolutePath: string; sizeBytes: number; sha256: string }>> {
  const entries = await readdir(current, { withFileTypes: true });
  const ordered = [...entries].sort((left, right) => compareCodePoints(left.name, right.name));
  const results: Array<{ path: string; absolutePath: string; sizeBytes: number; sha256: string }> = [];

  for (const entry of ordered) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = normalizedRelativePath(path.relative(root, absolutePath));
    if (entry.isSymbolicLink()) {
      throw new RuntimeReleaseValidationError('runtime-release-symlink-forbidden', `Runtime source contains symlink: ${relativePath}`);
    }
    if (entry.isDirectory()) {
      results.push(...await collectRuntimeFiles(root, absolutePath));
      continue;
    }
    if (!entry.isFile()) {
      throw new RuntimeReleaseValidationError('runtime-release-special-file-forbidden', `Runtime source contains unsupported entry: ${relativePath}`);
    }
    if (isIgnoredRuntimeFile(relativePath)) {
      continue;
    }
    const before = await stat(absolutePath);
    const fileSha256 = await sha256File(absolutePath);
    const after = await stat(absolutePath);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw new RuntimeReleaseValidationError('runtime-release-source-drift', `Runtime source changed while hashing: ${relativePath}`);
    }
    results.push({ path: relativePath, absolutePath, sizeBytes: before.size, sha256: fileSha256 });
  }
  return results;
}

function manifestDigestBody(manifest: Omit<ActRuntimeReleaseManifest, 'manifestSha256'>) {
  return stableStringify(manifest);
}

function treeDigest(files: readonly Pick<ActRuntimeReleaseFile, 'path' | 'sizeBytes' | 'sha256'>[]) {
  return sha256(stableStringify(files.map(({ path: relativePath, sizeBytes, sha256: fileSha256 }) => ({ path: relativePath, sizeBytes, sha256: fileSha256 }))));
}

export function serializeRuntimeReleaseManifest(manifest: ActRuntimeReleaseManifest) {
  return `${stableStringify(manifest)}\n`;
}

/**
 * Digest of the bytes that are put on the wire for the completion manifest.
 *
 * `manifestSha256` deliberately describes the canonical manifest body without
 * its own digest field.  The wire digest is a separate transport invariant and
 * therefore must be calculated only after the final newline has been added.
 */
export function runtimeReleaseManifestWireSha256(manifest: ActRuntimeReleaseManifest) {
  return sha256(Buffer.from(serializeRuntimeReleaseManifest(manifest), 'utf8'));
}

export const computeRuntimeReleaseManifestWireSha256 = runtimeReleaseManifestWireSha256;

export async function buildRuntimeReleaseManifest(root: string, options: BuildRuntimeReleaseManifestOptions): Promise<ActRuntimeReleaseManifest> {
  assertRuntimeReleaseId(options.releaseId);
  if (!/^[0-9a-f]{40}$/i.test(options.sourceRevision)) {
    throw new RuntimeReleaseValidationError('runtime-release-source-revision-invalid', 'Runtime source revision must be a 40-character Git SHA.');
  }
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new RuntimeReleaseValidationError('runtime-release-root-invalid', 'Runtime source root must be a real directory.');
  }
  const collected = await collectRuntimeFiles(root);
  const paths = collected.map((file) => file.path);
  if (new Set(paths).size !== paths.length) {
    throw new RuntimeReleaseValidationError('runtime-release-path-duplicate', 'Runtime source normalizes to duplicate paths.');
  }
  const files = collected
    .sort((left, right) => compareCodePoints(left.path, right.path))
    .map(({ path: relativePath, sizeBytes, sha256: fileSha256 }) => ({
      path: relativePath,
      objectKey: runtimeReleaseObjectKey(options.releaseId, relativePath),
      sizeBytes,
      sha256: fileSha256,
    }));
  if (files.length === 0) {
    throw new RuntimeReleaseValidationError('runtime-release-empty', 'Runtime release must contain at least one file.');
  }
  const withoutManifestDigest = {
    schemaVersion: ACT_RUNTIME_RELEASE_SCHEMA_VERSION,
    releaseId: options.releaseId,
    sourceRevision: options.sourceRevision.toLowerCase(),
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    treeSha256: treeDigest(files),
    files,
  } satisfies Omit<ActRuntimeReleaseManifest, 'manifestSha256'>;
  return {
    ...withoutManifestDigest,
    manifestSha256: sha256(manifestDigestBody(withoutManifestDigest)),
  };
}

function object(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', `${context} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, context: string) {
  if (typeof value !== 'string') throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', `${context} must be a string.`);
  return value;
}

function nonNegativeInteger(value: unknown, context: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', `${context} must be a non-negative integer.`);
  return Number(value);
}

export function parseRuntimeReleaseManifest(value: unknown): ActRuntimeReleaseManifest {
  const raw = object(value, 'manifest');
  if (raw.schemaVersion !== ACT_RUNTIME_RELEASE_SCHEMA_VERSION) {
    throw new RuntimeReleaseValidationError('runtime-release-manifest-version-invalid', 'Unsupported runtime release manifest version.');
  }
  const releaseId = string(raw.releaseId, 'manifest.releaseId');
  assertRuntimeReleaseId(releaseId);
  const sourceRevision = string(raw.sourceRevision, 'manifest.sourceRevision').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sourceRevision)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest.sourceRevision must be a Git SHA.');
  if (!Array.isArray(raw.files)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest.files must be an array.');
  const files = raw.files.map((entry, index) => {
    const item = object(entry, `manifest.files[${index}]`);
    const relativePath = normalizedRelativePath(string(item.path, `manifest.files[${index}].path`));
    const objectKey = string(item.objectKey, `manifest.files[${index}].objectKey`);
    if (objectKey !== runtimeReleaseObjectKey(releaseId, relativePath)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', `manifest.files[${index}].objectKey is not release-bound.`);
    const sizeBytes = nonNegativeInteger(item.sizeBytes, `manifest.files[${index}].sizeBytes`);
    const fileSha256 = string(item.sha256, `manifest.files[${index}].sha256`);
    if (!SHA256_PATTERN.test(fileSha256)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', `manifest.files[${index}].sha256 is invalid.`);
    return { path: relativePath, objectKey, sizeBytes, sha256: fileSha256 };
  });
  if (files.some((file, index) => index > 0 && compareCodePoints(files[index - 1].path, file.path) >= 0)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest.files must be strictly code-point sorted.');
  const fileCount = nonNegativeInteger(raw.fileCount, 'manifest.fileCount');
  const totalBytes = nonNegativeInteger(raw.totalBytes, 'manifest.totalBytes');
  const treeSha256 = string(raw.treeSha256, 'manifest.treeSha256');
  const manifestSha256 = string(raw.manifestSha256, 'manifest.manifestSha256');
  if (!SHA256_PATTERN.test(treeSha256) || !SHA256_PATTERN.test(manifestSha256)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest digest is invalid.');
  const parsed = { schemaVersion: ACT_RUNTIME_RELEASE_SCHEMA_VERSION, releaseId, sourceRevision, fileCount, totalBytes, treeSha256, manifestSha256, files } satisfies ActRuntimeReleaseManifest;
  if (fileCount === 0) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest.files must not be empty.');
  if (fileCount !== files.length || totalBytes !== files.reduce((total, file) => total + file.sizeBytes, 0) || treeSha256 !== treeDigest(files)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest file summary is inconsistent.');
  const { manifestSha256: _ignored, ...withoutManifestDigest } = parsed;
  if (manifestSha256 !== sha256(manifestDigestBody(withoutManifestDigest))) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest digest does not match canonical content.');
  return parsed;
}

export async function readRuntimeReleaseManifest(absolutePath: string) {
  return parseRuntimeReleaseManifest(JSON.parse(await readFile(absolutePath, 'utf8')));
}

export async function verifyRuntimeReleaseDirectory(root: string, manifest: ActRuntimeReleaseManifest) {
  const actual = await buildRuntimeReleaseManifest(root, { releaseId: manifest.releaseId, sourceRevision: manifest.sourceRevision });
  if (actual.treeSha256 !== manifest.treeSha256 || actual.manifestSha256 !== manifest.manifestSha256) {
    throw new RuntimeReleaseValidationError('runtime-release-directory-mismatch', 'Runtime directory does not match release manifest.');
  }
  return actual;
}
