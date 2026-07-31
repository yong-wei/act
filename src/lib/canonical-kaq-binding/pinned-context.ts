/**
 * Pinned aggregate + CourseCoverage context for shadow KAQ bindings.
 * Fail-closed: incomplete or non-pinned identities are rejected.
 */

import { createHash } from 'node:crypto';

import { admittedCanonicalIds } from '@/lib/aggregate-governance/course-coverage';
import type { CourseCoverageDisposition } from '@/lib/aggregate-governance/contracts';

import {
  PINNED_KAQ_AGGREGATE_RELEASE_ID,
  PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
  PINNED_KAQ_COVERAGE_OVERLAY_ID,
  KAQ_PINNED_CONTEXT_FIELD_KEYS,
  type KaqCanonicalPinnedContext,
  type KaqCanonicalPinnedContextFields,
} from './contracts';

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;

export class KaqPinnedContextError extends Error {
  readonly code:
    | 'incomplete-context'
    | 'invalid-context-format'
    | 'not-pinned-aggregate'
    | 'context-digest-mismatch';
  readonly field?: string;

  constructor(
    code: KaqPinnedContextError['code'],
    message: string,
    field?: string,
  ) {
    super(message);
    this.name = 'KaqPinnedContextError';
    this.code = code;
    this.field = field;
  }
}

export function computeKaqPinnedContextDigest(
  fields: KaqCanonicalPinnedContextFields,
): string {
  const lines = KAQ_PINNED_CONTEXT_FIELD_KEYS.map((key) => {
    const value = fields[key];
    if (key === 'admittedCanonicalIds') {
      return `${key}=${[...(value as readonly string[])].sort().join(',')}`;
    }
    return `${key}=${value}`;
  });
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}

export function assertKaqPinnedContextFields(
  fields: KaqCanonicalPinnedContextFields,
): KaqCanonicalPinnedContextFields {
  for (const key of KAQ_PINNED_CONTEXT_FIELD_KEYS) {
    if (key === 'admittedCanonicalIds') {
      if (!Array.isArray(fields.admittedCanonicalIds)) {
        throw new KaqPinnedContextError(
          'incomplete-context',
          'KAQ pinned context requires admittedCanonicalIds',
          key,
        );
      }
      continue;
    }
    const value = fields[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new KaqPinnedContextError(
        'incomplete-context',
        `KAQ pinned context missing ${key}`,
        key,
      );
    }
  }

  if (fields.releaseSetId !== PINNED_KAQ_AGGREGATE_RELEASE_SET_ID) {
    throw new KaqPinnedContextError(
      'not-pinned-aggregate',
      `KAQ bindings require pinned aggregate ReleaseSet ${PINNED_KAQ_AGGREGATE_RELEASE_SET_ID}`,
      'releaseSetId',
    );
  }
  if (fields.releaseId !== PINNED_KAQ_AGGREGATE_RELEASE_ID) {
    throw new KaqPinnedContextError(
      'not-pinned-aggregate',
      `KAQ bindings require pinned aggregate Release ${PINNED_KAQ_AGGREGATE_RELEASE_ID}`,
      'releaseId',
    );
  }
  if (fields.coverageOverlayId !== PINNED_KAQ_COVERAGE_OVERLAY_ID) {
    throw new KaqPinnedContextError(
      'not-pinned-aggregate',
      `KAQ bindings require aggregate CourseCoverage overlay ${PINNED_KAQ_COVERAGE_OVERLAY_ID}`,
      'coverageOverlayId',
    );
  }
  if (!SHA256.test(fields.releaseHash)) {
    throw new KaqPinnedContextError(
      'invalid-context-format',
      'releaseHash must be 64-char lowercase sha256 hex',
      'releaseHash',
    );
  }
  // Fail-closed like #1112 CandidateContextFingerprint: sourceDatasetHash is part of
  // contextDigest and must be a verified 64-char lowercase SHA-256, never an arbitrary token.
  if (!SHA256.test(fields.sourceDatasetHash)) {
    throw new KaqPinnedContextError(
      'invalid-context-format',
      'sourceDatasetHash must be 64-char lowercase sha256 hex',
      'sourceDatasetHash',
    );
  }
  if (!SHA256.test(fields.coverageSourceHash)) {
    throw new KaqPinnedContextError(
      'invalid-context-format',
      'coverageSourceHash must be 64-char lowercase sha256 hex',
      'coverageSourceHash',
    );
  }
  if (!GIT_COMMIT.test(fields.coverageCaptureRevision)) {
    throw new KaqPinnedContextError(
      'invalid-context-format',
      'coverageCaptureRevision must be a 40-char git commit',
      'coverageCaptureRevision',
    );
  }
  if (!fields.deltaReceiptId.trim() || /unbound/iu.test(fields.deltaReceiptId)) {
    throw new KaqPinnedContextError(
      'invalid-context-format',
      'deltaReceiptId must bind one accepted ReleaseSet Delta Receipt',
      'deltaReceiptId',
    );
  }

  return {
    ...fields,
    admittedCanonicalIds: [...new Set(fields.admittedCanonicalIds)].sort(),
  };
}

export function buildKaqPinnedContext(
  fields: KaqCanonicalPinnedContextFields,
): KaqCanonicalPinnedContext {
  const normalized = assertKaqPinnedContextFields(fields);
  return {
    ...normalized,
    contextDigest: computeKaqPinnedContextDigest(normalized),
  };
}

/**
 * Fail-closed fingerprint verification for any object claiming to be a pinned
 * context. Re-runs field format / fixed-aggregate checks and recomputes
 * contextDigest — a random or stale digest cannot pass.
 */
export function assertKaqPinnedContextFingerprint(
  value: KaqCanonicalPinnedContext | null | undefined | Record<string, unknown>,
): KaqCanonicalPinnedContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new KaqPinnedContextError(
      'incomplete-context',
      'KAQ pinned context fingerprint is required',
    );
  }
  const raw = value as Record<string, unknown>;
  const fields: KaqCanonicalPinnedContextFields = {
    releaseSetId: String(raw.releaseSetId ?? ''),
    releaseId: String(raw.releaseId ?? ''),
    releaseHash: String(raw.releaseHash ?? ''),
    sourceDatasetHash: String(raw.sourceDatasetHash ?? ''),
    deltaReceiptId: String(raw.deltaReceiptId ?? ''),
    coverageOverlayId: String(raw.coverageOverlayId ?? ''),
    coverageOverlayVersion: String(raw.coverageOverlayVersion ?? ''),
    coverageSourceHash: String(raw.coverageSourceHash ?? ''),
    coverageCaptureRevision: String(raw.coverageCaptureRevision ?? ''),
    admittedCanonicalIds: Array.isArray(raw.admittedCanonicalIds)
      ? raw.admittedCanonicalIds.map((id) => String(id))
      : [],
  };
  const normalized = assertKaqPinnedContextFields(fields);
  const expectedDigest = computeKaqPinnedContextDigest(normalized);
  const providedDigest = typeof raw.contextDigest === 'string' ? raw.contextDigest : '';
  if (!SHA256.test(providedDigest)) {
    throw new KaqPinnedContextError(
      'invalid-context-format',
      'contextDigest must be 64-char lowercase sha256 hex',
      'contextDigest',
    );
  }
  if (providedDigest !== expectedDigest) {
    throw new KaqPinnedContextError(
      'context-digest-mismatch',
      'contextDigest does not match pinned context fields (forged or drifted)',
      'contextDigest',
    );
  }
  return {
    ...normalized,
    contextDigest: expectedDigest,
  };
}

/**
 * @deprecated Prefer `buildKaqPinnedContextFromVerifiedAuthority` which requires
 * an ACCEPTED Delta receipt evidence + available CourseCoverage repository result.
 * This helper remains only for low-level fingerprint unit tests of field hashing;
 * production shadow paths must not call it with free-form delta/coverage inputs.
 */
export function buildKaqPinnedContextFromCoverage(input: {
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string;
  deltaReceiptId: string;
  coverageOverlayVersion: string;
  coverageSourceHash: string;
  coverageCaptureRevision: string;
  coverageEntries: readonly CourseCoverageDisposition[];
  coverageOverlayId?: string;
}): KaqCanonicalPinnedContext {
  return buildKaqPinnedContext({
    releaseSetId: input.releaseSetId,
    releaseId: input.releaseId,
    releaseHash: input.releaseHash,
    sourceDatasetHash: input.sourceDatasetHash,
    deltaReceiptId: input.deltaReceiptId,
    coverageOverlayId: input.coverageOverlayId ?? PINNED_KAQ_COVERAGE_OVERLAY_ID,
    coverageOverlayVersion: input.coverageOverlayVersion,
    coverageSourceHash: input.coverageSourceHash,
    coverageCaptureRevision: input.coverageCaptureRevision,
    admittedCanonicalIds: admittedCanonicalIds(input.coverageEntries),
  });
}

export function assertBindingMatchesPinnedContext(
  binding: {
    releaseSetId: string;
    releaseId: string;
    pinnedContextDigest: string;
    canonicalId: string;
  },
  pinned: KaqCanonicalPinnedContext,
): void {
  const closed = assertKaqPinnedContextFingerprint(pinned);
  if (binding.pinnedContextDigest !== closed.contextDigest) {
    throw new KaqPinnedContextError(
      'context-digest-mismatch',
      'Binding pinnedContextDigest does not match current aggregate context',
    );
  }
  if (
    binding.releaseSetId !== closed.releaseSetId
    || binding.releaseId !== closed.releaseId
  ) {
    throw new KaqPinnedContextError(
      'not-pinned-aggregate',
      'Binding Release identity does not match pinned aggregate',
    );
  }
  if (!closed.admittedCanonicalIds.includes(binding.canonicalId)) {
    throw new KaqPinnedContextError(
      'not-pinned-aggregate',
      `Canonical ${binding.canonicalId} is outside current aggregate CourseCoverage`,
      'canonicalId',
    );
  }
}
