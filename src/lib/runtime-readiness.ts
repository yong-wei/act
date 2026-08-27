import 'server-only';

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION,
  type ActRuntimeBlobReleaseManifest,
} from '@/lib/runtime-release';
import { readActiveRuntimeReleaseManifest, RuntimeActiveReleaseError } from '@/lib/runtime-active-release';
import { projectionDigest } from '@/lib/teaching-projection/hash';

export const RUNTIME_READINESS_BLOB_VIEW_MODE = 'ossfs-blob-view';

export type RuntimeReadinessIdentity = {
  schemaVersion: typeof ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION;
  releaseId: string;
  manifestSha256: string;
  treeSha256: string;
};

export type RuntimeReadinessProjection = {
  required: boolean;
  ready: boolean;
  identity: RuntimeReadinessIdentity | null;
};

export function isBlobViewRuntimeRequired(
  deliveryMode = process.env.RUNTIME_DELIVERY_MODE,
): boolean {
  return deliveryMode?.trim() === RUNTIME_READINESS_BLOB_VIEW_MODE;
}

export function projectRuntimeIdentity(
  manifest: ActRuntimeBlobReleaseManifest,
): RuntimeReadinessIdentity {
  return {
    schemaVersion: ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION,
    releaseId: manifest.releaseId,
    manifestSha256: manifest.manifestSha256,
    treeSha256: manifest.treeSha256,
  };
}

function isCoordinatedCutoverRequired(
  value = process.env.ACT_COORDINATED_CUTOVER_REQUIRED,
): boolean {
  return value?.trim() === 'true';
}

type CoordinatedActiveReceiptWire = {
  readonly contract: 'coordinated-active-receipt/v1';
  readonly receiptId: string;
  readonly sealedAt: string;
  readonly transactionId: string;
  readonly journalHash: string;
  readonly candidateReceiptHash: string;
  readonly committedSelectors: readonly { readonly selectorId: string; readonly identity: string }[];
  readonly mutationReceiptHashes: readonly string[];
  readonly runtimeActiveReceiptHash: string;
  readonly runtimeActiveIdentity: {
    readonly releaseId: string;
    readonly manifestSha256: string;
    readonly treeSha256: string;
  };
  readonly receiptHash: string;
};

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function resolveAuthorityCurrentPath(
  authorityRoot = process.env.ACT_AUTHORITY_STORE_ROOT?.trim()
    || process.env.AUTHORITY_STORE_ROOT?.trim()
    || path.join(process.cwd(), 'course-content', 'authoring', 'knowledge', 'authority'),
): string {
  return path.join(authorityRoot, 'current.json');
}

async function coordinatedActiveReceiptMatchesRuntime(
  value: unknown,
  identity: RuntimeReadinessIdentity,
  authorityCurrentPath: string,
): Promise<boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const receipt = value as Record<string, unknown>;
  const expectedKeys = [
    'candidateReceiptHash', 'committedSelectors', 'contract', 'journalHash',
    'mutationReceiptHashes', 'receiptHash', 'receiptId', 'runtimeActiveIdentity',
    'runtimeActiveReceiptHash', 'sealedAt', 'transactionId',
  ];
  if (Object.keys(receipt).sort().join('\u0000') !== expectedKeys.join('\u0000')) return false;
  if (receipt.contract !== 'coordinated-active-receipt/v1'
    || !isSha256(receipt.journalHash)
    || !isSha256(receipt.candidateReceiptHash)
    || !isSha256(receipt.runtimeActiveReceiptHash)
    || !isSha256(receipt.receiptHash)
    || typeof receipt.receiptId !== 'string'
    || typeof receipt.sealedAt !== 'string'
    || typeof receipt.transactionId !== 'string'
    || !Array.isArray(receipt.committedSelectors)
    || !Array.isArray(receipt.mutationReceiptHashes)
    || receipt.committedSelectors.length === 0
    || !receipt.mutationReceiptHashes.every(isSha256)) return false;
  const selectors = receipt.committedSelectors;
  if (!selectors.every((selector) => selector
    && typeof selector === 'object'
    && !Array.isArray(selector)
    && Object.keys(selector).sort().join('\u0000') === 'identity\u0000selectorId'
    && typeof (selector as Record<string, unknown>).selectorId === 'string'
    && typeof (selector as Record<string, unknown>).identity === 'string')) return false;
  const authoritySelectors = selectors.filter((selector) => (selector as Record<string, unknown>).selectorId === 'authority:current');
  if (authoritySelectors.length !== 1) return false;
  const runtimeIdentity = receipt.runtimeActiveIdentity;
  if (!runtimeIdentity || typeof runtimeIdentity !== 'object' || Array.isArray(runtimeIdentity)) return false;
  const runtime = runtimeIdentity as Record<string, unknown>;
  const semanticKeys = 'manifestSha256\u0000releaseId\u0000treeSha256';
  const lifecycleKeys = 'manifestSha256\u0000manifestVersion\u0000manifestWireSha256\u0000manifestWireSizeBytes\u0000releaseId\u0000schemaVersion\u0000treeSha256';
  const runtimeKeys = Object.keys(runtime).sort().join('\u0000');
  if ((runtimeKeys !== semanticKeys && runtimeKeys !== lifecycleKeys)
    || runtime.releaseId !== identity.releaseId
    || runtime.manifestSha256 !== identity.manifestSha256
    || runtime.treeSha256 !== identity.treeSha256) return false;
  if (runtimeKeys === lifecycleKeys
    && (runtime.schemaVersion !== 'runtime-blob-release-identity.v1'
      || runtime.manifestVersion !== 'act-runtime-release.v2'
      || !isSha256(runtime.manifestWireSha256)
      || !Number.isInteger(runtime.manifestWireSizeBytes)
      || (runtime.manifestWireSizeBytes as number) < 1)) return false;
  const expectedHash = projectionDigest({
    transactionId: receipt.transactionId,
    journalHash: receipt.journalHash,
    candidateReceiptHash: receipt.candidateReceiptHash,
    committedSelectors: receipt.committedSelectors,
    mutationReceiptHashes: receipt.mutationReceiptHashes,
    runtimeActiveReceiptHash: receipt.runtimeActiveReceiptHash,
    runtimeActiveIdentity: receipt.runtimeActiveIdentity,
  });
  if (receipt.receiptHash !== expectedHash || receipt.receiptId !== `act-${expectedHash.slice(0, 24)}`) return false;
  try {
    const authorityWire = await readFile(authorityCurrentPath);
    return createHash('sha256').update(authorityWire).digest('hex')
      === (authoritySelectors[0] as Record<string, unknown>).identity;
  } catch {
    return false;
  }
}

async function hasMatchingCoordinatedActiveReceipt(
  identity: RuntimeReadinessIdentity,
  receiptPath = process.env.ACT_COORDINATED_ACTIVE_RECEIPT_PATH,
  authorityCurrentPath = resolveAuthorityCurrentPath(),
): Promise<boolean> {
  if (!receiptPath) return false;
  try {
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as unknown;
    return await coordinatedActiveReceiptMatchesRuntime(receipt, identity, authorityCurrentPath);
  } catch {
    return false;
  }
}

export async function projectRuntimeReadiness(
  runtimeRoot?: string,
  activeReceiptPath?: string,
  coordinatedActiveReceiptPath?: string,
  authorityCurrentPath?: string,
): Promise<RuntimeReadinessProjection> {
  const required = isBlobViewRuntimeRequired();
  if (!required) {
    return { required: false, ready: true, identity: null };
  }

  try {
    const manifest = await readActiveRuntimeReleaseManifest(runtimeRoot, activeReceiptPath);
    if (!manifest || manifest.schemaVersion !== ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION) {
      return { required: true, ready: false, identity: null };
    }
    const identity = projectRuntimeIdentity(manifest);
    if (isCoordinatedCutoverRequired()
      && !await hasMatchingCoordinatedActiveReceipt(identity, coordinatedActiveReceiptPath, authorityCurrentPath)) {
      return { required: true, ready: false, identity: null };
    }
    return {
      required: true,
      ready: true,
      identity,
    };
  } catch (error) {
    if (error instanceof RuntimeActiveReleaseError) {
      return { required: true, ready: false, identity: null };
    }
    throw error;
  }
}
