import 'server-only';

import { lstat, readFile } from 'node:fs/promises';
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
    || receiptKeys.some((key) => !['schemaVersion', 'selection', 'healthCheck', 'deployment'].includes(key))
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

export async function readActiveRuntimeReleaseManifest(
  runtimeRoot = path.join(process.cwd(), 'course-content', 'runtime'),
  activeReceiptPath = process.env[ACT_RUNTIME_ACTIVE_RECEIPT_PATH_ENV]?.trim() || path.join(runtimeRoot, ACT_RUNTIME_ACTIVE_RECEIPT_FILENAME),
): Promise<AnyActRuntimeReleaseManifest | null> {
  let manifest: AnyActRuntimeReleaseManifest | null = null;
  const manifestPaths = [
    path.join(runtimeRoot, ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME),
    path.join(runtimeRoot, ACT_RUNTIME_RELEASE_MANIFEST_FILENAME),
  ];
  for (const manifestPath of manifestPaths) {
    let source: string;
    try {
      source = await readFile(manifestPath, 'utf8');
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw new RuntimeActiveReleaseError('runtime-active-release-manifest-unreadable', 'Active runtime release manifest cannot be read.', { cause: error });
    }
    try {
      manifest = parseAnyRuntimeReleaseManifest(JSON.parse(source));
      break;
    } catch (error) {
      throw new RuntimeActiveReleaseError('runtime-active-release-manifest-invalid', 'Active runtime release manifest is invalid.', { cause: error });
    }
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
