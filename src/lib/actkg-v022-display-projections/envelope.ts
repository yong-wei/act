/**
 * Shared pinned v0.22 composite envelope for catalog, zh-CN, and teaching
 * rebuilds. Builders never resolve "latest" at runtime.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { sha256 } from '../../../scripts/actkg-release/authoritative-release';

export const V022_DISPLAY_PROJECTION_CONTRACT = 'actkg-v022-display-projections/1' as const;
export const V022_AUTHORITY_RELEASE_ID = 'ctr:release:control-theory-engineering-v0.22' as const;
export const V022_BUNDLE_ID = 'ctb:control-theory-engineering-v0.22:r5' as const;
export const V022_BUNDLE_DIGEST =
  '98f2d5b183f9c0e632e3e020fe45111140f00b935450189edf0869375ef45854' as const;
export const V022_SNAPSHOT_ID =
  'snap-9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151' as const;
export const V022_SNAPSHOT_HASH =
  '9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151' as const;
export const V022_RELEASE_SET_ID =
  'actkg-authority-candidate-v018-98f2d5b183f9c0e632e3e020fe45111140f00b935450189edf0869375ef45854' as const;
export const V022_INTEGRATION_VERSION = 'control-theory-integration-v0.20' as const;
export const V022_TERMINOLOGY_VERSION = 'control-theory-zh-cn-terminology-v0.5' as const;
export const V022_MULTILINGUAL_LABEL_COUNT = 2148 as const;
export const V022_CANDIDATE_RECEIPT_RELATIVE =
  'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.22/candidate-receipt.json' as const;
export const V022_CONTROLLED_RELEASE_RELATIVE =
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.22-r5' as const;
export const V022_MIRROR_RECEIPT_RELATIVE =
  `${V022_CONTROLLED_RELEASE_RELATIVE}.mirror-receipt.json` as const;

export const V022_CURRENT_POINTER_PATHS = [
  'course-content/authoring/knowledge/authority/current.json',
  'course-content/runtime/knowledge/projection/current.json',
  'course-content/runtime/knowledge/prerequisites/current.json',
  'course-content/runtime/knowledge/authority-domain-catalog/current.json',
  'course-content/runtime/knowledge/authority-domain-shards/current.json',
  'course-content/runtime/knowledge/consumer-activation/current.json',
  'course-content/runtime/knowledge/production-cutover-transactions/current.json',
] as const;

export interface V022PinnedEnvelope {
  contract: typeof V022_DISPLAY_PROJECTION_CONTRACT;
  releaseId: typeof V022_AUTHORITY_RELEASE_ID;
  releaseSetId: typeof V022_RELEASE_SET_ID;
  bundleId: typeof V022_BUNDLE_ID;
  bundleDigest: typeof V022_BUNDLE_DIGEST;
  snapshotId: typeof V022_SNAPSHOT_ID;
  snapshotHash: typeof V022_SNAPSHOT_HASH;
  integrationVersion: typeof V022_INTEGRATION_VERSION;
  terminologyVersion: typeof V022_TERMINOLOGY_VERSION;
  multilingualLabelCount: typeof V022_MULTILINGUAL_LABEL_COUNT;
  captureRevision: string;
}

export class V022EnvelopeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'V022EnvelopeError';
    this.code = code;
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new V022EnvelopeError('envelope-invalid', `${label} must be a non-empty string`);
  }
  return value;
}

function failLatest(value: string, label: string): void {
  if (value === 'latest' || value.endsWith('/latest') || value.includes('@latest')) {
    throw new V022EnvelopeError('latest-forbidden', `${label} must not resolve latest`);
  }
}

export function loadPinnedV022Envelope(repoRoot: string): V022PinnedEnvelope {
  const receiptPath = path.join(repoRoot, V022_CANDIDATE_RECEIPT_RELATIVE);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(receiptPath, 'utf8')) as unknown;
  } catch {
    throw new V022EnvelopeError('candidate-receipt-missing', `missing ${V022_CANDIDATE_RECEIPT_RELATIVE}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new V022EnvelopeError('candidate-receipt-invalid', 'candidate receipt must be an object');
  }
  const receipt = parsed as Record<string, unknown>;
  const validated = receipt.validated as Record<string, unknown> | undefined;
  const replays = receipt.replays as Array<Record<string, unknown>> | undefined;
  if (!validated || !Array.isArray(replays) || replays.length === 0) {
    throw new V022EnvelopeError('candidate-receipt-invalid', 'candidate receipt is incomplete');
  }
  if (receipt.nonActivation !== true || receipt.status !== 'staged') {
    throw new V022EnvelopeError('candidate-not-inactive', 'v0.22 candidate must remain inactive');
  }
  const releaseId = text(validated.releaseId, 'validated.releaseId');
  const bundleId = text(validated.bundleId, 'validated.bundleId');
  const bundleDigest = text(validated.bundleDigest, 'validated.bundleDigest');
  const releaseSetId = text(validated.releaseSetId, 'validated.releaseSetId');
  const snapshotId = text(replays[0]?.snapshotId, 'replays[0].snapshotId');
  const captureRevision = text(receipt.captureRevision, 'captureRevision');
  failLatest(releaseId, 'releaseId');
  failLatest(bundleId, 'bundleId');
  if (releaseId !== V022_AUTHORITY_RELEASE_ID
    || bundleId !== V022_BUNDLE_ID
    || bundleDigest !== V022_BUNDLE_DIGEST
    || releaseSetId !== V022_RELEASE_SET_ID
    || snapshotId !== V022_SNAPSHOT_ID
    || Number(validated.multilingualLabels) !== V022_MULTILINGUAL_LABEL_COUNT) {
    throw new V022EnvelopeError(
      'envelope-mismatch',
      'admitted v0.22 candidate does not match the pinned composite envelope',
    );
  }
  assertSealedV022ReleaseMirror(repoRoot, {
    releaseId,
    bundleDigest,
  });
  return {
    contract: V022_DISPLAY_PROJECTION_CONTRACT,
    releaseId: V022_AUTHORITY_RELEASE_ID,
    releaseSetId: V022_RELEASE_SET_ID,
    bundleId: V022_BUNDLE_ID,
    bundleDigest: V022_BUNDLE_DIGEST,
    snapshotId: V022_SNAPSHOT_ID,
    snapshotHash: V022_SNAPSHOT_HASH,
    integrationVersion: V022_INTEGRATION_VERSION,
    terminologyVersion: V022_TERMINOLOGY_VERSION,
    multilingualLabelCount: V022_MULTILINGUAL_LABEL_COUNT,
    captureRevision,
  };
}

export function assertSealedV022ReleaseMirror(
  repoRoot: string,
  expected: { releaseId: string; bundleDigest: string },
): void {
  const receiptPath = path.join(repoRoot, V022_MIRROR_RECEIPT_RELATIVE);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(receiptPath, 'utf8')) as unknown;
  } catch {
    throw new V022EnvelopeError('mirror-receipt-missing', `missing ${V022_MIRROR_RECEIPT_RELATIVE}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new V022EnvelopeError('mirror-receipt-invalid', 'mirror receipt must be an object');
  }
  const receipt = parsed as {
    bundleDigest?: unknown;
    controlledPath?: unknown;
    files?: unknown;
  };
  if (receipt.bundleDigest !== expected.bundleDigest) {
    throw new V022EnvelopeError('mirror-bundle-drift', 'controlled release mirror digest drifted from the admitted envelope');
  }
  if (receipt.controlledPath !== V022_CONTROLLED_RELEASE_RELATIVE) {
    throw new V022EnvelopeError('mirror-path-drift', 'controlled release mirror path drifted');
  }
  if (!Array.isArray(receipt.files) || receipt.files.length === 0) {
    throw new V022EnvelopeError('mirror-files-missing', 'controlled release mirror file list is empty');
  }
  for (const raw of receipt.files) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new V022EnvelopeError('mirror-file-invalid', 'mirror file entry is invalid');
    }
    const row = raw as { path?: unknown; rawSha256?: unknown; byteLength?: unknown };
    const relative = text(row.path, 'mirror.file.path');
    failLatest(relative, 'mirror.file.path');
    const expectedSha = text(row.rawSha256, 'mirror.file.rawSha256');
    const absolute = path.join(repoRoot, V022_CONTROLLED_RELEASE_RELATIVE, relative);
    let bytes: Buffer;
    try {
      bytes = readFileSync(absolute);
    } catch {
      throw new V022EnvelopeError('mirror-file-missing', `sealed release file is missing: ${relative}`);
    }
    if (typeof row.byteLength === 'number' && bytes.byteLength !== row.byteLength) {
      throw new V022EnvelopeError('mirror-file-drift', `sealed release file length drifted: ${relative}`);
    }
    if (sha256(bytes) !== expectedSha) {
      throw new V022EnvelopeError('mirror-file-drift', `sealed release file bytes drifted: ${relative}`);
    }
  }
}

export function assertSameV022Envelope(
  left: Pick<V022PinnedEnvelope, 'releaseId' | 'bundleDigest' | 'snapshotId'>,
  right: Pick<V022PinnedEnvelope, 'releaseId' | 'bundleDigest' | 'snapshotId'>,
): void {
  if (left.releaseId !== right.releaseId
    || left.bundleDigest !== right.bundleDigest
    || left.snapshotId !== right.snapshotId) {
    throw new V022EnvelopeError('envelope-mix', 'display builders must share one pinned v0.22 envelope');
  }
}
