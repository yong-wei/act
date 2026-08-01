/**
 * Complete candidate-context fingerprint for Canonical RAG shadow (#1112).
 *
 * Every executable member must carry this full identity. Partial membership
 * comparisons are forbidden.
 */

import { createHash } from 'node:crypto';

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;

/**
 * Complete, deterministic candidate-context identity.
 * All fields are required non-empty strings; no wildcard/null.
 */
export interface CandidateContextFingerprint {
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string;
  /**
   * Selected runtime Projection identity from
   * AuthoritativeProjectionIdentityRecord (isRuntime).
   */
  projectionId: string;
  projectionProfile: string;
  /** GraphProjection version_digest (versionDigest on the identity record). */
  projectionDigest: string;
  deltaReceiptId: string;
  coverageOverlayId: string;
  coverageOverlayVersion: string;
  coverageSourceHash: string;
  coverageCaptureRevision: string;
  inventoryRunId: string;
  /** Deterministic digest of the fields above (excluding this field). */
  contextDigest: string;
}

export type CandidateContextFields = Omit<CandidateContextFingerprint, 'contextDigest'>;

export const CANDIDATE_CONTEXT_FIELD_KEYS = [
  'releaseSetId',
  'releaseId',
  'releaseHash',
  'sourceDatasetHash',
  'projectionId',
  'projectionProfile',
  'projectionDigest',
  'deltaReceiptId',
  'coverageOverlayId',
  'coverageOverlayVersion',
  'coverageSourceHash',
  'coverageCaptureRevision',
  'inventoryRunId',
] as const satisfies ReadonlyArray<keyof CandidateContextFields>;

export class CandidateContextError extends Error {
  readonly code:
    | 'incomplete-context'
    | 'invalid-context-format'
    | 'context-digest-mismatch'
    | 'mixed-context';
  readonly field?: string;

  constructor(
    code: CandidateContextError['code'],
    message: string,
    field?: string,
  ) {
    super(message);
    this.name = 'CandidateContextError';
    this.code = code;
    this.field = field;
  }
}

export function computeContextDigest(fields: CandidateContextFields): string {
  const canonical = CANDIDATE_CONTEXT_FIELD_KEYS.map((key) => `${key}=${fields[key]}`).join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function buildCandidateContextFingerprint(
  fields: CandidateContextFields,
): CandidateContextFingerprint {
  assertCandidateContextFields(fields);
  return {
    ...fields,
    contextDigest: computeContextDigest(fields),
  };
}

export function assertCandidateContextFields(
  fields: CandidateContextFields,
): CandidateContextFields {
  for (const key of CANDIDATE_CONTEXT_FIELD_KEYS) {
    const value = fields[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new CandidateContextError(
        'incomplete-context',
        `Candidate context missing required field ${key}`,
        key,
      );
    }
  }
  if (!SHA256.test(fields.releaseHash)) {
    throw new CandidateContextError('invalid-context-format', 'releaseHash must be 64-char hex', 'releaseHash');
  }
  if (!SHA256.test(fields.sourceDatasetHash)) {
    throw new CandidateContextError('invalid-context-format', 'sourceDatasetHash must be 64-char hex', 'sourceDatasetHash');
  }
  if (!fields.projectionId.trim()) {
    throw new CandidateContextError('incomplete-context', 'projectionId is required', 'projectionId');
  }
  if (!fields.projectionProfile.trim()) {
    throw new CandidateContextError('incomplete-context', 'projectionProfile is required', 'projectionProfile');
  }
  if (!SHA256.test(fields.projectionDigest)) {
    throw new CandidateContextError('invalid-context-format', 'projectionDigest must be 64-char hex', 'projectionDigest');
  }
  if (!SHA256.test(fields.coverageSourceHash)) {
    throw new CandidateContextError('invalid-context-format', 'coverageSourceHash must be 64-char hex', 'coverageSourceHash');
  }
  if (!GIT_COMMIT.test(fields.coverageCaptureRevision)) {
    throw new CandidateContextError(
      'invalid-context-format',
      'coverageCaptureRevision must be a 40-char git commit',
      'coverageCaptureRevision',
    );
  }
  return fields;
}

export function assertCandidateContextFingerprint(
  context: CandidateContextFingerprint | null | undefined,
): CandidateContextFingerprint {
  if (!context) {
    throw new CandidateContextError(
      'incomplete-context',
      'Candidate context fingerprint is required',
    );
  }
  assertCandidateContextFields(context);
  const expected = computeContextDigest(context);
  if (context.contextDigest !== expected) {
    throw new CandidateContextError(
      'context-digest-mismatch',
      'contextDigest does not match candidate context fields',
      'contextDigest',
    );
  }
  if (!SHA256.test(context.contextDigest)) {
    throw new CandidateContextError(
      'invalid-context-format',
      'contextDigest must be 64-char hex',
      'contextDigest',
    );
  }
  return context;
}

/**
 * Compare every field of the complete fingerprint (including digest).
 * No subset comparison is permitted.
 */
export function membershipMatchesContext(
  member: CandidateContextFingerprint,
  expected: CandidateContextFingerprint,
): boolean {
  return CANDIDATE_CONTEXT_FIELD_KEYS.every((key) => member[key] === expected[key])
    && member.contextDigest === expected.contextDigest;
}

export function attachCandidateContext<T extends object>(
  row: T,
  context: CandidateContextFingerprint,
): T & CandidateContextFingerprint {
  const closed = assertCandidateContextFingerprint(context);
  return {
    ...row,
    releaseSetId: closed.releaseSetId,
    releaseId: closed.releaseId,
    releaseHash: closed.releaseHash,
    sourceDatasetHash: closed.sourceDatasetHash,
    projectionId: closed.projectionId,
    projectionProfile: closed.projectionProfile,
    projectionDigest: closed.projectionDigest,
    deltaReceiptId: closed.deltaReceiptId,
    coverageOverlayId: closed.coverageOverlayId,
    coverageOverlayVersion: closed.coverageOverlayVersion,
    coverageSourceHash: closed.coverageSourceHash,
    coverageCaptureRevision: closed.coverageCaptureRevision,
    inventoryRunId: closed.inventoryRunId,
    contextDigest: closed.contextDigest,
  };
}

export function pickContextFingerprint(
  value: CandidateContextFingerprint,
): CandidateContextFingerprint {
  return {
    releaseSetId: value.releaseSetId,
    releaseId: value.releaseId,
    releaseHash: value.releaseHash,
    sourceDatasetHash: value.sourceDatasetHash,
    projectionId: value.projectionId,
    projectionProfile: value.projectionProfile,
    projectionDigest: value.projectionDigest,
    deltaReceiptId: value.deltaReceiptId,
    coverageOverlayId: value.coverageOverlayId,
    coverageOverlayVersion: value.coverageOverlayVersion,
    coverageSourceHash: value.coverageSourceHash,
    coverageCaptureRevision: value.coverageCaptureRevision,
    inventoryRunId: value.inventoryRunId,
    contextDigest: value.contextDigest,
  };
}
