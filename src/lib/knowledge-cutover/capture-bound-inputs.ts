/**
 * Capture-bound ACT input validation for the first ActKG activation.
 *
 * The validator deliberately works from the pinned Git tree.  Once a capture
 * is accepted, the builder consumes only the materialized snapshot returned by
 * this module; it never re-reads the caller's working tree.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { InventoryPackageSpec } from '../teaching-projection/active-inventory';

export const CAPTURE_BOUND_INPUT_MANIFEST_CONTRACT =
  'act-actkg-capture-bound-input-manifest/v1' as const;
export const CAPTURE_BOUND_INPUT_SCHEMA_VERSION = 1 as const;
export const DEFAULT_CAPTURE_BOUND_INPUT_MANIFEST_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/capture-bound-input-manifest.json' as const;

const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const GIT_FILE_MODES = new Set(['100644', '100755']);

function compareCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface CaptureBoundInputFileDefinition {
  path: string;
  /** Optional expected Git mode. The capture tree remains authoritative. */
  mode?: '100644' | '100755';
  sha256?: string;
}

export interface CaptureBoundInputCollectionDefinition {
  id: string;
  root: string;
  /** Optional explicit child prefixes selected from a larger root. */
  prefixes?: string[];
  /** When present, the member set is part of the versioned definition. */
  members?: string[];
}

export interface CaptureBoundInputManifest {
  contract: typeof CAPTURE_BOUND_INPUT_MANIFEST_CONTRACT;
  schemaVersion: typeof CAPTURE_BOUND_INPUT_SCHEMA_VERSION;
  /** A definition is reusable; the resolved receipt binds the real revision. */
  captureRevision: string | null;
  files: CaptureBoundInputFileDefinition[];
  collections: CaptureBoundInputCollectionDefinition[];
  inventorySelection: {
    registryPath: string;
    packages: InventoryPackageSpec[];
  };
}

export interface ResolvedCaptureBoundInputFile {
  path: string;
  mode: '100644' | '100755';
  sha256: string;
  bytes: number;
  source: 'file' | 'collection';
}

export interface ResolvedCaptureBoundInputCollection {
  id: string;
  root: string;
  members: ResolvedCaptureBoundInputFile[];
}

export interface CaptureBoundInputReceipt {
  contract: 'act-actkg-capture-bound-input-receipt/v1';
  manifestContract: typeof CAPTURE_BOUND_INPUT_MANIFEST_CONTRACT;
  schemaVersion: typeof CAPTURE_BOUND_INPUT_SCHEMA_VERSION;
  captureRevision: string;
  manifestPath: string;
  manifestDigest: string;
  inputDigest: string;
  files: ResolvedCaptureBoundInputFile[];
  collections: ResolvedCaptureBoundInputCollection[];
  inventorySelection: CaptureBoundInputManifest['inventorySelection'];
}

export interface MaterializedCaptureBoundInputs {
  manifest: CaptureBoundInputManifest;
  receipt: CaptureBoundInputReceipt;
  snapshotRoot: string;
  cleanup(): void;
}

export class CaptureBoundInputError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CaptureBoundInputError';
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new CaptureBoundInputError(code, message);
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function normalizeRelativePath(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('manifest-invalid', `${label} must be a non-empty relative path`);
  }
  const raw = value.trim().replaceAll('\\', '/');
  if (raw.startsWith('/') || raw === '.' || raw.split('/').includes('..')) {
    fail('path-escape', `${label} escapes the repository: ${raw}`);
  }
  const normalized = path.posix.normalize(raw);
  if (normalized.startsWith('../') || normalized === '..' || normalized === '.') {
    fail('path-escape', `${label} escapes the repository: ${raw}`);
  }
  return normalized;
}

function normalizeMode(value: unknown, label: string): '100644' | '100755' | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !GIT_FILE_MODES.has(value)) {
    fail('manifest-invalid', `${label} must be Git mode 100644 or 100755`);
  }
  return value as '100644' | '100755';
}

function normalizePackages(value: unknown): InventoryPackageSpec[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('manifest-invalid', 'inventorySelection must be an object');
  }
  const raw = value as Record<string, unknown>;
  const registryPath = normalizeRelativePath(raw.registryPath, 'inventorySelection.registryPath');
  if (!Array.isArray(raw.packages) || raw.packages.length === 0) {
    fail('manifest-invalid', 'inventorySelection.packages must be a non-empty array');
  }
  const packages = raw.packages.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail('manifest-invalid', `inventorySelection.packages[${index}] must be an object`);
    }
    const row = item as Record<string, unknown>;
    const packageId = typeof row.packageId === 'string' ? row.packageId.trim() : '';
    const runtimeLessonDir = normalizeRelativePath(
      row.runtimeLessonDir,
      `inventorySelection.packages[${index}].runtimeLessonDir`,
    );
    const lessonKey = typeof row.lessonKey === 'string' ? row.lessonKey.trim() : '';
    if (!packageId || !lessonKey) {
      fail('manifest-invalid', `inventorySelection.packages[${index}] requires packageId and lessonKey`);
    }
    const scopeId = typeof row.scopeId === 'string' && row.scopeId.trim().length > 0
      ? row.scopeId.trim()
      : `course-package:${packageId}`;
    const routeSegment = row.routeSegment == null ? null : String(row.routeSegment);
    const title = row.title == null ? null : String(row.title);
    return {
      packageId,
      scopeId,
      routeSegment,
      runtimeLessonDir,
      lessonKey,
      title,
    } satisfies InventoryPackageSpec;
  });
  const ids = packages.map((item) => item.packageId);
  if (new Set(ids).size !== ids.length) fail('manifest-invalid', 'inventory packageId must be unique');
  return packages.sort((a, b) => compareCodePoint(a.packageId, b.packageId));
}

function normalizeManifest(raw: unknown): CaptureBoundInputManifest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('manifest-invalid', 'capture-bound input manifest must be an object');
  }
  const value = raw as Record<string, unknown>;
  if (value.contract !== CAPTURE_BOUND_INPUT_MANIFEST_CONTRACT) {
    fail('manifest-invalid', `manifest contract must be ${CAPTURE_BOUND_INPUT_MANIFEST_CONTRACT}`);
  }
  if (value.schemaVersion !== CAPTURE_BOUND_INPUT_SCHEMA_VERSION) {
    fail('manifest-invalid', 'manifest schemaVersion is unsupported');
  }
  if (value.captureRevision !== null && value.captureRevision !== undefined) {
    if (typeof value.captureRevision !== 'string' || !COMMIT.test(value.captureRevision)) {
      fail('manifest-invalid', 'manifest captureRevision must be null or a Git SHA');
    }
  }
  if (!Array.isArray(value.files)) fail('manifest-invalid', 'manifest files must be an array');
  const files = value.files.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail('manifest-invalid', `manifest files[${index}] must be an object`);
    }
    const row = item as Record<string, unknown>;
    const filePath = normalizeRelativePath(row.path, `manifest files[${index}].path`);
    const mode = normalizeMode(row.mode, `manifest files[${index}].mode`);
    if (row.sha256 !== undefined && (typeof row.sha256 !== 'string' || !SHA256.test(row.sha256))) {
      fail('manifest-invalid', `manifest files[${index}].sha256 must be a SHA-256 digest`);
    }
    return { path: filePath, ...(mode ? { mode } : {}), ...(row.sha256 ? { sha256: row.sha256 } : {}) };
  });
  if (new Set(files.map((item) => item.path)).size !== files.length) {
    fail('manifest-invalid', 'manifest file paths must be unique');
  }
  if (!Array.isArray(value.collections)) fail('manifest-invalid', 'manifest collections must be an array');
  const collections = value.collections.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail('manifest-invalid', `manifest collections[${index}] must be an object`);
    }
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id) fail('manifest-invalid', `manifest collections[${index}].id is required`);
    const root = normalizeRelativePath(row.root, `manifest collections[${index}].root`);
    let prefixes: string[] | undefined;
    if (row.prefixes !== undefined) {
      if (!Array.isArray(row.prefixes)) fail('manifest-invalid', `collection ${id}.prefixes must be an array`);
      prefixes = row.prefixes.map((prefix, prefixIndex) => {
        const value = normalizeRelativePath(prefix, `collection ${id}.prefixes[${prefixIndex}]`);
        return value;
      }).sort();
      if (new Set(prefixes).size !== prefixes.length) fail('manifest-invalid', `collection ${id} prefixes must be unique`);
    }
    let members: string[] | undefined;
    if (row.members !== undefined) {
      if (!Array.isArray(row.members)) fail('manifest-invalid', `collection ${id}.members must be an array`);
      members = row.members.map((member, memberIndex) => {
        const memberPath = normalizeRelativePath(member, `collection ${id}.members[${memberIndex}]`);
        if (memberPath !== root && !memberPath.startsWith(`${root}/`)) {
          fail('manifest-invalid', `collection ${id} member escapes its root: ${memberPath}`);
        }
        return memberPath;
      }).sort();
      if (new Set(members).size !== members.length) fail('manifest-invalid', `collection ${id} members must be unique`);
    }
    return { id, root, ...(prefixes ? { prefixes } : {}), ...(members ? { members } : {}) };
  });
  if (new Set(collections.map((item) => item.id)).size !== collections.length) {
    fail('manifest-invalid', 'manifest collection ids must be unique');
  }
  const inventorySelection = normalizePackages(value.inventorySelection);
  return {
    contract: CAPTURE_BOUND_INPUT_MANIFEST_CONTRACT,
    schemaVersion: CAPTURE_BOUND_INPUT_SCHEMA_VERSION,
    captureRevision: value.captureRevision == null ? null : value.captureRevision as string,
    files: files.sort((a, b) => compareCodePoint(a.path, b.path)),
    collections: collections.sort((a, b) => compareCodePoint(a.id, b.id)),
    inventorySelection: {
      registryPath: normalizeRelativePath((value.inventorySelection as Record<string, unknown>).registryPath, 'inventorySelection.registryPath'),
      packages: inventorySelection,
    },
  };
}

function git(repoRoot: string, args: string[], maxBuffer = 64 * 1024 * 1024): Buffer {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      maxBuffer,
      stdio: ['ignore', 'pipe', 'pipe'],
    }) as Buffer;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail('git-failed', `git ${args.join(' ')} failed: ${detail}`);
  }
}

function gitText(repoRoot: string, args: string[]): string {
  return git(repoRoot, args).toString('utf8');
}

function gitTreeEntries(repoRoot: string, revision: string, root: string): Map<string, { mode: string; type: string; object: string }> {
  const raw = git(repoRoot, ['ls-tree', '-r', '-z', '--full-tree', revision, '--', root]);
  const entries = new Map<string, { mode: string; type: string; object: string }>();
  for (const item of raw.toString('utf8').split('\0')) {
    if (!item) continue;
    const tab = item.indexOf('\t');
    const header = tab >= 0 ? item.slice(0, tab) : item;
    const filePath = tab >= 0 ? item.slice(tab + 1) : '';
    const [mode, type, object] = header.split(' ');
    if (!mode || !type || !object || !filePath) continue;
    entries.set(filePath.replaceAll('\\', '/'), { mode, type, object });
  }
  return entries;
}

function gitBlob(repoRoot: string, revision: string, filePath: string): Buffer {
  try {
    return git(repoRoot, ['show', `${revision}:${filePath}`], 128 * 1024 * 1024);
  } catch {
    fail('missing-blob', `capture Git tree has no blob for ${filePath}`);
  }
}

function worktreeMode(filePath: string): '100644' | '100755' {
  const stat = lstatSync(filePath);
  if (!stat.isFile()) fail('worktree-type-mismatch', `declared input is not a regular file: ${filePath}`);
  return (stat.mode & 0o111) !== 0 ? '100755' : '100644';
}

function assertNoSymlinkComponents(repoRoot: string, relativePath: string): void {
  const parts = relativePath.split('/');
  let current = path.resolve(repoRoot);
  for (const part of parts) {
    current = path.join(current, part);
    if (lstatSync(current).isSymbolicLink()) {
      fail('symlink-rejected', `declared input path contains a symlink: ${relativePath}`);
    }
  }
}

function selectedPath(relativePath: string, root: string, prefixes?: readonly string[]): boolean {
  if (!prefixes || prefixes.length === 0) return true;
  const child = relativePath === root ? '' : relativePath.slice(`${root}/`.length);
  return prefixes.some((prefix) => child === prefix || child.startsWith(`${prefix}/`));
}

function validateFile(
  repoRoot: string,
  revision: string,
  relativePath: string,
  expectedMode: string | undefined,
  expectedSha: string | undefined,
  tree: Map<string, { mode: string; type: string; object: string }>,
  source: 'file' | 'collection',
): ResolvedCaptureBoundInputFile {
  const entry = tree.get(relativePath);
  if (!entry) fail('missing-blob', `capture Git tree is missing declared input: ${relativePath}`);
  if (entry.type !== 'blob' || !GIT_FILE_MODES.has(entry.mode)) {
    fail('git-mode-mismatch', `declared input is not a regular Git blob: ${relativePath} (${entry.mode}/${entry.type})`);
  }
  if (expectedMode && expectedMode !== entry.mode) {
    fail('git-mode-mismatch', `${relativePath} expects mode ${expectedMode}, capture tree has ${entry.mode}`);
  }
  const bytes = gitBlob(repoRoot, revision, relativePath);
  const digest = sha256(bytes);
  if (expectedSha && expectedSha !== digest) fail('git-bytes-mismatch', `${relativePath} digest does not match the manifest`);
  const absolute = path.resolve(repoRoot, relativePath);
  if (!existsSync(absolute)) fail('missing-input', `declared input is missing from the working tree: ${relativePath}`);
  assertNoSymlinkComponents(repoRoot, relativePath);
  const mode = worktreeMode(absolute);
  if (mode !== entry.mode) fail('worktree-mode-mismatch', `${relativePath} mode ${mode} differs from capture mode ${entry.mode}`);
  const worktreeBytes = readFileSync(absolute);
  if (sha256(worktreeBytes) !== digest) fail('worktree-bytes-mismatch', `${relativePath} differs from captureRevision ${revision}`);
  return { path: relativePath, mode: entry.mode as '100644' | '100755', sha256: digest, bytes: bytes.length, source };
}

function parseManifestBytes(raw: Buffer): CaptureBoundInputManifest {
  try {
    return normalizeManifest(JSON.parse(raw.toString('utf8')) as unknown);
  } catch (error) {
    if (error instanceof CaptureBoundInputError) throw error;
    fail('manifest-invalid', `manifest JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function manifestDefinitionDigest(manifest: CaptureBoundInputManifest): string {
  return sha256(canonical(manifest));
}

export function captureInputDigest(input: {
  captureRevision: string;
  manifestDigest: string;
  files: readonly ResolvedCaptureBoundInputFile[];
  collections: readonly ResolvedCaptureBoundInputCollection[];
}): string {
  return sha256(canonical({
    captureRevision: input.captureRevision,
    manifestDigest: input.manifestDigest,
    files: input.files,
    collections: input.collections.map((collection) => ({
      id: collection.id,
      root: collection.root,
      members: collection.members,
    })),
  }));
}

/**
 * Validate the manifest and all declared inputs without writing to the
 * repository. This function is useful for tests that want the fail-closed
 * boundary without materializing a snapshot.
 */
export function resolveCaptureBoundInputs(input: {
  repoRoot: string;
  captureRevision: string;
  manifestPath?: string;
}): { manifest: CaptureBoundInputManifest; receipt: CaptureBoundInputReceipt; blobs: Map<string, Buffer> } {
  const repoRoot = path.resolve(input.repoRoot);
  const captureRevision = input.captureRevision.trim();
  if (!COMMIT.test(captureRevision)) fail('invalid-capture-revision', 'captureRevision must be a 40-character Git SHA');
  const head = gitText(repoRoot, ['rev-parse', 'HEAD']).trim();
  if (head !== captureRevision) fail('capture-head-mismatch', `HEAD ${head} differs from captureRevision ${captureRevision}`);
  const manifestPath = normalizeRelativePath(
    input.manifestPath ?? DEFAULT_CAPTURE_BOUND_INPUT_MANIFEST_RELATIVE,
    'manifestPath',
  );
  const manifestTree = gitTreeEntries(repoRoot, captureRevision, manifestPath);
  const manifestEntry = manifestTree.get(manifestPath);
  if (!manifestEntry || manifestEntry.type !== 'blob') fail('missing-manifest', `capture manifest is absent from ${captureRevision}: ${manifestPath}`);
  const manifestBytes = gitBlob(repoRoot, captureRevision, manifestPath);
  const absoluteManifest = path.resolve(repoRoot, manifestPath);
  if (!existsSync(absoluteManifest)) fail('missing-manifest', `capture manifest is missing from the working tree: ${manifestPath}`);
  assertNoSymlinkComponents(repoRoot, manifestPath);
  if (sha256(readFileSync(absoluteManifest)) !== sha256(manifestBytes)) fail('manifest-drift', `${manifestPath} differs from captureRevision ${captureRevision}`);
  const manifest = parseManifestBytes(manifestBytes);
  if (manifest.captureRevision && manifest.captureRevision !== captureRevision) fail('manifest-capture-mismatch', `manifest captureRevision ${manifest.captureRevision} differs from ${captureRevision}`);

  const direct = new Map<string, ResolvedCaptureBoundInputFile>();
  const blobs = new Map<string, Buffer>();
  for (const file of manifest.files) {
    const tree = gitTreeEntries(repoRoot, captureRevision, file.path);
    const resolved = validateFile(repoRoot, captureRevision, file.path, file.mode, file.sha256, tree, 'file');
    direct.set(file.path, resolved);
    blobs.set(file.path, gitBlob(repoRoot, captureRevision, file.path));
  }

  const collections: ResolvedCaptureBoundInputCollection[] = [];
  for (const collection of manifest.collections) {
    if (!existsSync(path.resolve(repoRoot, collection.root))) {
      fail('missing-input', `declared collection root is missing: ${collection.root}`);
    }
    assertNoSymlinkComponents(repoRoot, collection.root);
    const captureMembers = gitTreeEntries(repoRoot, captureRevision, collection.root);
    for (const memberPath of [...captureMembers.keys()]) {
      if (!selectedPath(memberPath, collection.root, collection.prefixes)) captureMembers.delete(memberPath);
    }
    const capturePaths = [...captureMembers.keys()].sort();
    if (capturePaths.length === 0) fail('missing-input', `declared collection has no Git members: ${collection.root}`);
    if (collection.members && canonical(collection.members) !== canonical(capturePaths)) {
      fail('collection-membership-mismatch', `collection ${collection.id} members differ from captureRevision`);
    }
    // The capture tree defines membership. Inspect the working tree only at
    // those paths so unrelated ignored or untracked artifacts cannot drift
    // the selected input set or enter the materialized snapshot.
    const members: ResolvedCaptureBoundInputFile[] = [];
    for (const memberPath of capturePaths) {
      const resolved = validateFile(repoRoot, captureRevision, memberPath, undefined, undefined, captureMembers, 'collection');
      members.push(resolved);
      blobs.set(memberPath, gitBlob(repoRoot, captureRevision, memberPath));
    }
    collections.push({ id: collection.id, root: collection.root, members });
  }

  const files = [...direct.values()].sort((a, b) => compareCodePoint(a.path, b.path));
  const receiptBase = {
    contract: 'act-actkg-capture-bound-input-receipt/v1' as const,
    manifestContract: manifest.contract,
    schemaVersion: manifest.schemaVersion,
    captureRevision,
    manifestPath,
    manifestDigest: manifestDefinitionDigest(manifest),
    inputDigest: '',
    files,
    collections: collections.sort((a, b) => compareCodePoint(a.id, b.id)),
    inventorySelection: manifest.inventorySelection,
  };
  const receipt = {
    ...receiptBase,
    inputDigest: captureInputDigest({
      captureRevision,
      manifestDigest: receiptBase.manifestDigest,
      files,
      collections: receiptBase.collections,
    }),
  };
  return { manifest, receipt, blobs };
}

/** Validate first, then materialize only Git-tree bytes into an isolated root. */
export function materializeCaptureBoundInputs(input: {
  repoRoot: string;
  captureRevision: string;
  manifestPath?: string;
  snapshotRoot?: string;
}): MaterializedCaptureBoundInputs {
  const resolved = resolveCaptureBoundInputs(input);
  const snapshotRoot = input.snapshotRoot
    ? path.resolve(input.snapshotRoot)
    : mkdtempSync(path.join(os.tmpdir(), 'act-capture-bound-'));
  mkdirSync(snapshotRoot, { recursive: true });
  const allMembers = new Map<string, Buffer>();
  for (const [filePath, bytes] of resolved.blobs) allMembers.set(filePath, bytes);
  for (const collection of resolved.receipt.collections) {
    for (const member of collection.members) {
      const bytes = resolved.blobs.get(member.path);
      if (bytes) allMembers.set(member.path, bytes);
    }
  }
  try {
    for (const [filePath, bytes] of allMembers) {
      const target = path.resolve(snapshotRoot, filePath);
      const rel = path.relative(snapshotRoot, target);
      if (rel.startsWith('..') || path.isAbsolute(rel)) fail('path-escape', `snapshot path escapes root: ${filePath}`);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, bytes);
      const resolvedFile = resolved.receipt.files.find((file) => file.path === filePath)
        ?? resolved.receipt.collections.flatMap((collection) => collection.members).find((file) => file.path === filePath);
      chmodSync(target, resolvedFile?.mode === '100755' ? 0o755 : 0o644);
    }
  } catch (error) {
    rmSync(snapshotRoot, { recursive: true, force: true });
    throw error;
  }
  return {
    manifest: resolved.manifest,
    receipt: resolved.receipt,
    snapshotRoot,
    cleanup: () => rmSync(snapshotRoot, { recursive: true, force: true }),
  };
}
