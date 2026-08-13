import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { stableStringify } from '@/lib/aggregate-governance/hash';

export const ACT_RUNTIME_RELEASE_SCHEMA_VERSION = 'act-runtime-release.v1';
export const ACT_RUNTIME_RELEASE_MANIFEST_FILENAME = '.act-runtime-release.v1.json';
export const ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION = 'act-runtime-release.v2';
export const ACT_RUNTIME_BLOB_RELEASE_MANIFEST_FILENAME = 'manifest.json';
export const ACT_RUNTIME_BLOB_RELEASE_RECEIPT_SCHEMA_VERSION = 'act-runtime-release-receipt.v2';
export const ACT_RUNTIME_BLOB_RELEASE_RECEIPT_FILENAME = 'receipt.json';
export const ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME = '.act-runtime-release.v2.json';
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

export interface ActRuntimeBlobReleaseManifest {
  schemaVersion: typeof ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION;
  releaseId: string;
  sourceRevision: string;
  fileCount: number;
  totalBytes: number;
  treeSha256: string;
  manifestSha256: string;
  files: ActRuntimeReleaseFile[];
}

export interface ActRuntimeBlobReleaseReceiptBlob {
  objectKey: string;
  sizeBytes: number;
  sha256: string;
}

export interface ActRuntimeBlobReleaseReceipt {
  schemaVersion: typeof ACT_RUNTIME_BLOB_RELEASE_RECEIPT_SCHEMA_VERSION;
  releaseId: string;
  manifestVersion: typeof ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION;
  manifestObjectKey: string;
  manifestSha256: string;
  manifestWireSha256: string;
  manifestWireSizeBytes: number;
  treeSha256: string;
  fileCount: number;
  totalBytes: number;
  blobs: ActRuntimeBlobReleaseReceiptBlob[];
  receiptSha256: string;
}

export type AnyActRuntimeReleaseManifest = ActRuntimeReleaseManifest | ActRuntimeBlobReleaseManifest;

export interface BuildRuntimeReleaseManifestOptions {
  releaseId: string;
  sourceRevision: string;
}

export interface BuildRuntimeBlobReleaseManifestOptions {
  sourceRevision: string;
}

export interface RuntimeBlobReleaseFileMetadata {
  path: string;
  sizeBytes: number;
  sha256: string;
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

export function runtimeBlobObjectKey(sha256: string) {
  if (!SHA256_PATTERN.test(sha256)) {
    throw new RuntimeReleaseValidationError('runtime-release-blob-key-invalid', 'Runtime blob key requires a SHA-256 digest.');
  }
  return `runtime/blobs/sha256/${sha256}`;
}

export function runtimeBlobReleaseManifestObjectKey(releaseId: string) {
  assertRuntimeReleaseId(releaseId);
  return `runtime/blob-releases/${releaseId}/${ACT_RUNTIME_BLOB_RELEASE_MANIFEST_FILENAME}`;
}

export function runtimeBlobReleaseReceiptObjectKey(releaseId: string) {
  assertRuntimeReleaseId(releaseId);
  return `runtime/blob-releases/${releaseId}/${ACT_RUNTIME_BLOB_RELEASE_RECEIPT_FILENAME}`;
}

export function deriveRuntimeReleaseId(sourceRevision: string, treeSha256: string) {
  const normalizedRevision = sourceRevision.toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalizedRevision) || !SHA256_PATTERN.test(treeSha256)) {
    throw new RuntimeReleaseValidationError('runtime-release-identity-invalid', 'Runtime release identity requires a Git SHA and tree SHA-256.');
  }
  return `runtime-${sha256(stableStringify({ sourceRevision: normalizedRevision, treeSha256 })).slice(0, 55)}`;
}

export function assertContentAddressedRuntimeReleaseId(manifest: Pick<AnyActRuntimeReleaseManifest, 'releaseId' | 'sourceRevision' | 'treeSha256'>) {
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

function blobManifestDigestBody(manifest: Omit<ActRuntimeBlobReleaseManifest, 'manifestSha256'>) {
  return stableStringify(manifest);
}

export function serializeRuntimeBlobReleaseManifest(manifest: ActRuntimeBlobReleaseManifest) {
  return `${stableStringify(manifest)}\n`;
}

export function runtimeBlobReleaseManifestWireSha256(manifest: ActRuntimeBlobReleaseManifest) {
  return sha256(Buffer.from(serializeRuntimeBlobReleaseManifest(manifest), 'utf8'));
}

function blobReceiptBlobs(manifest: ActRuntimeBlobReleaseManifest) {
  const blobs = new Map<string, ActRuntimeBlobReleaseReceiptBlob>();
  for (const file of manifest.files) {
    const existing = blobs.get(file.objectKey);
    if (existing && (existing.sizeBytes !== file.sizeBytes || existing.sha256 !== file.sha256)) {
      throw new RuntimeReleaseValidationError('runtime-release-blob-binding-inconsistent', `Runtime blob has inconsistent bindings: ${file.objectKey}`);
    }
    blobs.set(file.objectKey, {
      objectKey: file.objectKey,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
    });
  }
  return [...blobs.values()].sort((left, right) => compareCodePoints(left.objectKey, right.objectKey));
}

function blobReceiptDigestBody(receipt: Omit<ActRuntimeBlobReleaseReceipt, 'receiptSha256'>) {
  return stableStringify(receipt);
}

export function buildRuntimeBlobReleaseReceipt(manifest: ActRuntimeBlobReleaseManifest): ActRuntimeBlobReleaseReceipt {
  const parsed = parseRuntimeBlobReleaseManifest(manifest);
  const withoutReceiptDigest = {
    schemaVersion: ACT_RUNTIME_BLOB_RELEASE_RECEIPT_SCHEMA_VERSION,
    releaseId: parsed.releaseId,
    manifestVersion: parsed.schemaVersion,
    manifestObjectKey: runtimeBlobReleaseManifestObjectKey(parsed.releaseId),
    manifestSha256: parsed.manifestSha256,
    manifestWireSha256: runtimeBlobReleaseManifestWireSha256(parsed),
    manifestWireSizeBytes: Buffer.byteLength(serializeRuntimeBlobReleaseManifest(parsed)),
    treeSha256: parsed.treeSha256,
    fileCount: parsed.fileCount,
    totalBytes: parsed.totalBytes,
    blobs: blobReceiptBlobs(parsed),
  } satisfies Omit<ActRuntimeBlobReleaseReceipt, 'receiptSha256'>;
  return {
    ...withoutReceiptDigest,
    receiptSha256: sha256(blobReceiptDigestBody(withoutReceiptDigest)),
  };
}

export function serializeRuntimeBlobReleaseReceipt(receipt: ActRuntimeBlobReleaseReceipt) {
  return `${stableStringify(receipt)}\n`;
}

export async function buildRuntimeBlobReleaseManifest(
  root: string,
  options: BuildRuntimeBlobReleaseManifestOptions,
): Promise<ActRuntimeBlobReleaseManifest> {
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
  return buildRuntimeBlobReleaseManifestFromFiles(options.sourceRevision, collected);
}

export function buildRuntimeBlobReleaseManifestFromFiles(
  sourceRevision: string,
  entries: readonly RuntimeBlobReleaseFileMetadata[],
): ActRuntimeBlobReleaseManifest {
  if (!/^[0-9a-f]{40}$/i.test(sourceRevision)) {
    throw new RuntimeReleaseValidationError('runtime-release-source-revision-invalid', 'Runtime source revision must be a 40-character Git SHA.');
  }
  const sortedEntries = [...entries].sort((left, right) => compareCodePoints(left.path, right.path));
  const paths = sortedEntries.map((entry) => normalizedRelativePath(entry.path));
  if (new Set(paths).size !== paths.length) {
    throw new RuntimeReleaseValidationError('runtime-release-path-duplicate', 'Runtime source normalizes to duplicate paths.');
  }
  const files = sortedEntries.map((entry, index) => {
    const sizeBytes = entry.sizeBytes;
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
      throw new RuntimeReleaseValidationError('runtime-release-file-size-invalid', `Runtime source size is invalid: ${paths[index]}`);
    }
    if (!SHA256_PATTERN.test(entry.sha256)) {
      throw new RuntimeReleaseValidationError('runtime-release-file-hash-invalid', `Runtime source SHA-256 is invalid: ${paths[index]}`);
    }
    return {
      path: paths[index],
      objectKey: runtimeBlobObjectKey(entry.sha256),
      sizeBytes,
      sha256: entry.sha256,
    };
  });
  if (files.length === 0) {
    throw new RuntimeReleaseValidationError('runtime-release-empty', 'Runtime release must contain at least one file.');
  }
  const treeSha256 = treeDigest(files);
  const withoutManifestDigest = {
    schemaVersion: ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION,
    releaseId: deriveRuntimeReleaseId(sourceRevision, treeSha256),
    sourceRevision: sourceRevision.toLowerCase(),
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    treeSha256,
    files,
  } satisfies Omit<ActRuntimeBlobReleaseManifest, 'manifestSha256'>;
  return {
    ...withoutManifestDigest,
    manifestSha256: sha256(blobManifestDigestBody(withoutManifestDigest)),
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

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], context: string) {
  const actual = Object.keys(value).sort(compareCodePoints);
  const expected = [...keys].sort(compareCodePoints);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', `${context} has unsupported or missing fields.`);
  }
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

export function parseRuntimeBlobReleaseManifest(value: unknown): ActRuntimeBlobReleaseManifest {
  const raw = object(value, 'manifest');
  assertExactKeys(raw, [
    'schemaVersion',
    'releaseId',
    'sourceRevision',
    'fileCount',
    'totalBytes',
    'treeSha256',
    'manifestSha256',
    'files',
  ], 'manifest');
  if (raw.schemaVersion !== ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION) {
    throw new RuntimeReleaseValidationError('runtime-release-manifest-version-invalid', 'Unsupported runtime blob release manifest version.');
  }
  const releaseId = string(raw.releaseId, 'manifest.releaseId');
  assertRuntimeReleaseId(releaseId);
  const sourceRevision = string(raw.sourceRevision, 'manifest.sourceRevision').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sourceRevision)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest.sourceRevision must be a Git SHA.');
  if (!Array.isArray(raw.files)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest.files must be an array.');
  const files = raw.files.map((entry, index) => {
    const item = object(entry, `manifest.files[${index}]`);
    assertExactKeys(item, ['path', 'objectKey', 'sizeBytes', 'sha256'], `manifest.files[${index}]`);
    const relativePath = normalizedRelativePath(string(item.path, `manifest.files[${index}].path`));
    const sizeBytes = nonNegativeInteger(item.sizeBytes, `manifest.files[${index}].sizeBytes`);
    const fileSha256 = string(item.sha256, `manifest.files[${index}].sha256`);
    if (!SHA256_PATTERN.test(fileSha256)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', `manifest.files[${index}].sha256 is invalid.`);
    const objectKey = string(item.objectKey, `manifest.files[${index}].objectKey`);
    if (objectKey !== runtimeBlobObjectKey(fileSha256)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', `manifest.files[${index}].objectKey is not blob-addressed.`);
    return { path: relativePath, objectKey, sizeBytes, sha256: fileSha256 };
  });
  if (files.some((file, index) => index > 0 && compareCodePoints(files[index - 1].path, file.path) >= 0)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest.files must be strictly code-point sorted.');
  const blobBindings = new Map<string, { sizeBytes: number; sha256: string }>();
  for (const file of files) {
    const existing = blobBindings.get(file.objectKey);
    if (existing && (existing.sizeBytes !== file.sizeBytes || existing.sha256 !== file.sha256)) {
      throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', `manifest blob binding is inconsistent: ${file.objectKey}`);
    }
    blobBindings.set(file.objectKey, { sizeBytes: file.sizeBytes, sha256: file.sha256 });
  }
  const fileCount = nonNegativeInteger(raw.fileCount, 'manifest.fileCount');
  const totalBytes = nonNegativeInteger(raw.totalBytes, 'manifest.totalBytes');
  const treeSha256 = string(raw.treeSha256, 'manifest.treeSha256');
  const manifestSha256 = string(raw.manifestSha256, 'manifest.manifestSha256');
  if (!SHA256_PATTERN.test(treeSha256) || !SHA256_PATTERN.test(manifestSha256)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest digest is invalid.');
  const parsed = {
    schemaVersion: ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION,
    releaseId,
    sourceRevision,
    fileCount,
    totalBytes,
    treeSha256,
    manifestSha256,
    files,
  } satisfies ActRuntimeBlobReleaseManifest;
  if (fileCount === 0) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest.files must not be empty.');
  if (fileCount !== files.length || totalBytes !== files.reduce((total, file) => total + file.sizeBytes, 0) || treeSha256 !== treeDigest(files)) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest file summary is inconsistent.');
  assertContentAddressedRuntimeReleaseId(parsed);
  const { manifestSha256: _ignored, ...withoutManifestDigest } = parsed;
  if (manifestSha256 !== sha256(blobManifestDigestBody(withoutManifestDigest))) throw new RuntimeReleaseValidationError('runtime-release-manifest-invalid', 'manifest digest does not match canonical content.');
  return parsed;
}

export function parseRuntimeBlobReleaseReceipt(value: unknown): ActRuntimeBlobReleaseReceipt {
  const raw = object(value, 'receipt');
  assertExactKeys(raw, [
    'schemaVersion',
    'releaseId',
    'manifestVersion',
    'manifestObjectKey',
    'manifestSha256',
    'manifestWireSha256',
    'manifestWireSizeBytes',
    'treeSha256',
    'fileCount',
    'totalBytes',
    'blobs',
    'receiptSha256',
  ], 'receipt');
  if (raw.schemaVersion !== ACT_RUNTIME_BLOB_RELEASE_RECEIPT_SCHEMA_VERSION) {
    throw new RuntimeReleaseValidationError('runtime-release-receipt-version-invalid', 'Unsupported runtime blob release receipt version.');
  }
  const releaseId = string(raw.releaseId, 'receipt.releaseId');
  assertRuntimeReleaseId(releaseId);
  if (raw.manifestVersion !== ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION) {
    throw new RuntimeReleaseValidationError('runtime-release-receipt-invalid', 'receipt.manifestVersion is invalid.');
  }
  const manifestObjectKey = string(raw.manifestObjectKey, 'receipt.manifestObjectKey');
  if (manifestObjectKey !== runtimeBlobReleaseManifestObjectKey(releaseId)) {
    throw new RuntimeReleaseValidationError('runtime-release-receipt-invalid', 'receipt.manifestObjectKey is not release-bound.');
  }
  const manifestSha256 = string(raw.manifestSha256, 'receipt.manifestSha256');
  const manifestWireSha256 = string(raw.manifestWireSha256, 'receipt.manifestWireSha256');
  const treeSha256 = string(raw.treeSha256, 'receipt.treeSha256');
  const receiptSha256 = string(raw.receiptSha256, 'receipt.receiptSha256');
  if (![manifestSha256, manifestWireSha256, treeSha256, receiptSha256].every((digest) => SHA256_PATTERN.test(digest))) {
    throw new RuntimeReleaseValidationError('runtime-release-receipt-invalid', 'receipt digest is invalid.');
  }
  const manifestWireSizeBytes = nonNegativeInteger(raw.manifestWireSizeBytes, 'receipt.manifestWireSizeBytes');
  const fileCount = nonNegativeInteger(raw.fileCount, 'receipt.fileCount');
  const totalBytes = nonNegativeInteger(raw.totalBytes, 'receipt.totalBytes');
  if (!Array.isArray(raw.blobs) || raw.blobs.length === 0) {
    throw new RuntimeReleaseValidationError('runtime-release-receipt-invalid', 'receipt.blobs must be a non-empty array.');
  }
  const blobs = raw.blobs.map((entry, index) => {
    const item = object(entry, `receipt.blobs[${index}]`);
    assertExactKeys(item, ['objectKey', 'sizeBytes', 'sha256'], `receipt.blobs[${index}]`);
    const sha256 = string(item.sha256, `receipt.blobs[${index}].sha256`);
    if (!SHA256_PATTERN.test(sha256)) throw new RuntimeReleaseValidationError('runtime-release-receipt-invalid', `receipt.blobs[${index}].sha256 is invalid.`);
    const objectKey = string(item.objectKey, `receipt.blobs[${index}].objectKey`);
    if (objectKey !== runtimeBlobObjectKey(sha256)) throw new RuntimeReleaseValidationError('runtime-release-receipt-invalid', `receipt.blobs[${index}].objectKey is not blob-addressed.`);
    return {
      objectKey,
      sizeBytes: nonNegativeInteger(item.sizeBytes, `receipt.blobs[${index}].sizeBytes`),
      sha256,
    };
  });
  if (blobs.some((blob, index) => index > 0 && compareCodePoints(blobs[index - 1].objectKey, blob.objectKey) >= 0)) {
    throw new RuntimeReleaseValidationError('runtime-release-receipt-invalid', 'receipt.blobs must be strictly code-point sorted.');
  }
  const parsed = {
    schemaVersion: ACT_RUNTIME_BLOB_RELEASE_RECEIPT_SCHEMA_VERSION,
    releaseId,
    manifestVersion: ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION,
    manifestObjectKey,
    manifestSha256,
    manifestWireSha256,
    manifestWireSizeBytes,
    treeSha256,
    fileCount,
    totalBytes,
    blobs,
    receiptSha256,
  } satisfies ActRuntimeBlobReleaseReceipt;
  const { receiptSha256: _ignored, ...withoutReceiptDigest } = parsed;
  if (receiptSha256 !== sha256(blobReceiptDigestBody(withoutReceiptDigest))) {
    throw new RuntimeReleaseValidationError('runtime-release-receipt-invalid', 'receipt digest does not match canonical content.');
  }
  return parsed;
}

export function assertRuntimeBlobReleaseReceiptMatchesManifest(
  receipt: ActRuntimeBlobReleaseReceipt,
  manifest: ActRuntimeBlobReleaseManifest,
) {
  const expected = buildRuntimeBlobReleaseReceipt(manifest);
  if (serializeRuntimeBlobReleaseReceipt(receipt) !== serializeRuntimeBlobReleaseReceipt(expected)) {
    throw new RuntimeReleaseValidationError('runtime-release-receipt-invalid', 'Runtime blob release receipt does not match the manifest identity and reachable blobs.');
  }
}

export function parseAnyRuntimeReleaseManifest(value: unknown): AnyActRuntimeReleaseManifest {
  const raw = object(value, 'manifest');
  if (raw.schemaVersion === ACT_RUNTIME_RELEASE_SCHEMA_VERSION) return parseRuntimeReleaseManifest(raw);
  if (raw.schemaVersion === ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION) return parseRuntimeBlobReleaseManifest(raw);
  throw new RuntimeReleaseValidationError('runtime-release-manifest-version-invalid', 'Unsupported runtime release manifest version.');
}

export async function readRuntimeBlobReleaseManifest(absolutePath: string) {
  return parseRuntimeBlobReleaseManifest(JSON.parse(await readFile(absolutePath, 'utf8')));
}

export async function verifyRuntimeBlobReleaseManifestBlobs(
  manifest: ActRuntimeBlobReleaseManifest,
  readBlob: (objectKey: string) => Promise<Uint8Array>,
) {
  for (const file of manifest.files) {
    const bytes = await readBlob(file.objectKey);
    if (bytes.byteLength !== file.sizeBytes || sha256(bytes) !== file.sha256) {
      throw new RuntimeReleaseValidationError('runtime-release-blob-mismatch', `Runtime blob does not match manifest: ${file.path}`);
    }
  }
  return {
    releaseId: manifest.releaseId,
    fileCount: manifest.fileCount,
    totalBytes: manifest.totalBytes,
    treeSha256: manifest.treeSha256,
    manifestSha256: manifest.manifestSha256,
  };
}

export async function verifyRuntimeBlobReleaseDirectory(root: string, manifest: ActRuntimeBlobReleaseManifest) {
  const actual = await buildRuntimeBlobReleaseManifest(root, { sourceRevision: manifest.sourceRevision });
  if (actual.treeSha256 !== manifest.treeSha256 || actual.manifestSha256 !== manifest.manifestSha256 || actual.releaseId !== manifest.releaseId) {
    throw new RuntimeReleaseValidationError('runtime-release-directory-mismatch', 'Runtime directory does not match blob release manifest.');
  }
  return actual;
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
