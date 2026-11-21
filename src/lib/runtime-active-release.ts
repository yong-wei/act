import 'server-only';

import type { BigIntStats } from 'node:fs';
import { lstat, open, readFile, type FileHandle } from 'node:fs/promises';
import path from 'node:path';

import {
  ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION,
  ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME,
  ACT_RUNTIME_RELEASE_MANIFEST_FILENAME,
  type ActRuntimeReleaseFile,
  type AnyActRuntimeReleaseManifest,
  parseAnyRuntimeReleaseManifest,
} from '@/lib/runtime-release';

const MEDIA_PATH = /^lessons\/[^/]+\/media\/[^/]+\.(?:mp4|webm|m4a|mp3|wav|pdf|png|jpe?g|webp|svg|gif)$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
export const ACT_RUNTIME_ACTIVE_RECEIPT_FILENAME = 'act-runtime-active-receipt.json';
export const ACT_RUNTIME_ACTIVE_RECEIPT_PATH_ENV = 'ACT_RUNTIME_ACTIVE_RECEIPT_PATH';

export class RuntimeActiveReleaseError extends Error {
  constructor(public readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RuntimeActiveReleaseError';
  }
}

async function assertActiveReceiptMatchesManifest(receiptPath: string, manifest: AnyActRuntimeReleaseManifest) {
  let details;
  try {
    details = await lstat(receiptPath);
  } catch (error) {
    throw new RuntimeActiveReleaseError('runtime-active-release-receipt-unreadable', 'Active runtime release receipt cannot be read.', { cause: error });
  }
  if (!details.isFile() || details.isSymbolicLink()) {
    throw new RuntimeActiveReleaseError('runtime-active-release-receipt-invalid', 'Active runtime release receipt must be a regular file.');
  }

  let source: string;
  try {
    source = await readFile(receiptPath, 'utf8');
  } catch (error) {
    throw new RuntimeActiveReleaseError('runtime-active-release-receipt-unreadable', 'Active runtime release receipt cannot be read.', { cause: error });
  }
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch (error) {
    throw new RuntimeActiveReleaseError('runtime-active-release-receipt-invalid', 'Active runtime release receipt is invalid.', { cause: error });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeActiveReleaseError('runtime-active-release-receipt-invalid', 'Active runtime release receipt is invalid.');
  }
  const receipt = value as Record<string, unknown>;
  const receiptKeys = Object.keys(receipt);
  if (
    receipt.schemaVersion !== 'runtime-release-active-receipt.v1'
    || receipt.healthCheck !== 'readyz'
    || receiptKeys.some((key) => !['schemaVersion', 'selection', 'healthCheck', 'deployment', 'compatibility'].includes(key))
    || !receipt.selection
    || typeof receipt.selection !== 'object'
    || Array.isArray(receipt.selection)
  ) {
    throw new RuntimeActiveReleaseError('runtime-active-release-receipt-invalid', 'Active runtime release receipt is invalid.');
  }
  const selection = receipt.selection as Record<string, unknown>;
  const selectionKeys = Object.keys(selection);
  if (
    selection.schemaVersion !== 'runtime-release-selection.v1'
    || selectionKeys.some((key) => !['schemaVersion', 'generation', 'releaseId', 'manifestSha256', 'treeSha256'].includes(key))
    || typeof selection.generation !== 'number'
    || !Number.isInteger(selection.generation)
    || selection.generation < 1
    || selection.releaseId !== manifest.releaseId
    || selection.manifestSha256 !== manifest.manifestSha256
    || selection.treeSha256 !== manifest.treeSha256
  ) {
    throw new RuntimeActiveReleaseError('runtime-active-release-receipt-mismatch', 'Active runtime release receipt does not match the mounted manifest.');
  }
}

// Cache the verified, immutable document only. The active receipt is checked on every read.
const cacheKey = Symbol.for('act.verified-mounted-runtime-manifest.v1');
const shared = globalThis as typeof globalThis & {
  [cacheKey]?: { key: string; result: Promise<AnyActRuntimeReleaseManifest> };
};

function fileVersion(filePath: string, stat: BigIntStats) {
  return [filePath, stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
}

async function verifyManifestFile(file: FileHandle, filePath: string, key: string) {
  const source = await file.readFile('utf8');
  if (fileVersion(filePath, await file.stat({ bigint: true })) !== key) {
    throw new RuntimeActiveReleaseError('runtime-active-release-manifest-invalid', 'Runtime manifest changed during verification.');
  }
  try {
    const manifest = parseAnyRuntimeReleaseManifest(JSON.parse(source));
    for (const item of manifest.files) {
      if ('source' in item && item.source) Object.freeze(item.source);
      Object.freeze(item);
    }
    Object.freeze(manifest.files);
    return Object.freeze(manifest);
  } catch (error) {
    throw new RuntimeActiveReleaseError('runtime-active-release-manifest-invalid', 'Active runtime release manifest is invalid.', { cause: error });
  }
}

async function readMountedManifest(filePath: string) {
  let file: FileHandle | undefined;
  try {
    file = await open(filePath, 'r');
    const key = fileVersion(filePath, await file.stat({ bigint: true }));
    const cached = shared[cacheKey];
    if (cached?.key === key) return await cached.result;
    const result = verifyManifestFile(file, filePath, key);
    shared[cacheKey] = { key, result };
    try {
      return await result;
    } catch (error) {
      if (shared[cacheKey]?.result === result) delete shared[cacheKey];
      throw error;
    }
  } catch (error) {
    if (!file && (error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    if (error instanceof RuntimeActiveReleaseError) throw error;
    throw new RuntimeActiveReleaseError('runtime-active-release-manifest-unreadable', 'Active runtime release manifest cannot be read.', { cause: error });
  } finally {
    await file?.close();
  }
}

export async function readActiveRuntimeReleaseManifest(
  runtimeRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), 'course-content', 'runtime'),
  activeReceiptPath = process.env[ACT_RUNTIME_ACTIVE_RECEIPT_PATH_ENV]?.trim() || path.join(runtimeRoot, ACT_RUNTIME_ACTIVE_RECEIPT_FILENAME),
): Promise<AnyActRuntimeReleaseManifest | null> {
  let manifest: AnyActRuntimeReleaseManifest | null = null;
  const manifestPaths = [
    path.join(runtimeRoot, ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME),
    path.join(runtimeRoot, ACT_RUNTIME_RELEASE_MANIFEST_FILENAME),
  ];
  for (const manifestPath of manifestPaths) {
    manifest = await readMountedManifest(manifestPath);
    if (manifest) break;
  }
  if (!manifest) return null;
  // v1 remains the activated filesystem fallback; the candidate race exists
  // only for a mounted v2 blob manifest, so receipt fencing is scoped there.
  if (manifest.schemaVersion === ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION) {
    await assertActiveReceiptMatchesManifest(activeReceiptPath, manifest);
  }
  return manifest;
}

export function findRuntimeMediaReleaseObject(manifest: AnyActRuntimeReleaseManifest, runtimePath: string): ActRuntimeReleaseFile | null {
  if (!MEDIA_PATH.test(runtimePath)) return null;
  return manifest.files.find((file) => file.path === runtimePath) ?? null;
}

export function isRuntimeMediaPath(runtimePath: string) {
  return MEDIA_PATH.test(runtimePath);
}
