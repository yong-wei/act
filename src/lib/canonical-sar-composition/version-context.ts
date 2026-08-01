/**
 * Version-closed context fingerprint for Canonical SAR composition (#1114).
 */

import { createHash } from 'node:crypto';

import {
  PINNED_SAR_AGGREGATE_RELEASE_ID,
  PINNED_SAR_AGGREGATE_RELEASE_SET_ID,
  PINNED_SAR_COVERAGE_OVERLAY_ID,
  SAR_VERSION_CONTEXT_FIELD_KEYS,
  type SarCompositionVersionContext,
  type SarCompositionVersionFields,
} from './contracts';

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;

export type SarVersionContextFailureCode =
  | 'incomplete-context'
  | 'invalid-context-format'
  | 'not-pinned-aggregate'
  | 'context-digest-mismatch';

export class SarVersionContextError extends Error {
  readonly code: SarVersionContextFailureCode;
  readonly field?: string;

  constructor(code: SarVersionContextFailureCode, message: string, field?: string) {
    super(message);
    this.name = 'SarVersionContextError';
    this.code = code;
    this.field = field;
  }
}

export function computeSarVersionContextDigest(
  fields: SarCompositionVersionFields,
): string {
  const lines = SAR_VERSION_CONTEXT_FIELD_KEYS.map(
    (key) => `${key}=${fields[key]}`,
  );
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}

export function buildSarVersionContext(
  fields: SarCompositionVersionFields,
): SarCompositionVersionContext {
  assertSarVersionContextFields(fields);
  return {
    ...fields,
    contextDigest: computeSarVersionContextDigest(fields),
  };
}

export function assertSarVersionContextFields(
  fields: SarCompositionVersionFields,
): SarCompositionVersionFields {
  for (const key of SAR_VERSION_CONTEXT_FIELD_KEYS) {
    const value = fields[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new SarVersionContextError(
        'incomplete-context',
        `SAR version context missing required field ${key}`,
        key,
      );
    }
  }

  if (fields.releaseSetId !== PINNED_SAR_AGGREGATE_RELEASE_SET_ID) {
    throw new SarVersionContextError(
      'not-pinned-aggregate',
      `SAR composition requires pinned aggregate ReleaseSet ${PINNED_SAR_AGGREGATE_RELEASE_SET_ID}`,
      'releaseSetId',
    );
  }
  if (fields.releaseId !== PINNED_SAR_AGGREGATE_RELEASE_ID) {
    throw new SarVersionContextError(
      'not-pinned-aggregate',
      `SAR composition requires pinned aggregate Release ${PINNED_SAR_AGGREGATE_RELEASE_ID}`,
      'releaseId',
    );
  }
  if (fields.coverageOverlayId !== PINNED_SAR_COVERAGE_OVERLAY_ID) {
    throw new SarVersionContextError(
      'not-pinned-aggregate',
      `SAR composition requires aggregate CourseCoverage overlay ${PINNED_SAR_COVERAGE_OVERLAY_ID}`,
      'coverageOverlayId',
    );
  }
  if (!SHA256.test(fields.releaseHash)) {
    throw new SarVersionContextError(
      'invalid-context-format',
      'releaseHash must be 64-char hex',
      'releaseHash',
    );
  }
  if (!SHA256.test(fields.sourceDatasetHash)) {
    throw new SarVersionContextError(
      'invalid-context-format',
      'sourceDatasetHash must be 64-char hex',
      'sourceDatasetHash',
    );
  }
  if (!SHA256.test(fields.projectionDigest)) {
    throw new SarVersionContextError(
      'invalid-context-format',
      'projectionDigest must be 64-char hex',
      'projectionDigest',
    );
  }
  if (!SHA256.test(fields.coverageSourceHash)) {
    throw new SarVersionContextError(
      'invalid-context-format',
      'coverageSourceHash must be 64-char hex',
      'coverageSourceHash',
    );
  }
  if (!GIT_COMMIT.test(fields.coverageCaptureRevision)) {
    throw new SarVersionContextError(
      'invalid-context-format',
      'coverageCaptureRevision must be a 40-char git commit',
      'coverageCaptureRevision',
    );
  }
  return fields;
}

export function assertCompleteSarVersionContext(
  version: SarCompositionVersionContext | null | undefined,
): SarCompositionVersionContext {
  if (!version) {
    throw new SarVersionContextError(
      'incomplete-context',
      'SAR version context is required',
    );
  }
  assertSarVersionContextFields(version);
  const expected = computeSarVersionContextDigest(version);
  if (version.contextDigest !== expected) {
    throw new SarVersionContextError(
      'context-digest-mismatch',
      'SAR version contextDigest does not match fields',
      'contextDigest',
    );
  }
  return version;
}

export function membershipMatchesSarVersion(
  left: SarCompositionVersionContext,
  right: SarCompositionVersionContext,
): boolean {
  return left.contextDigest === right.contextDigest
    && SAR_VERSION_CONTEXT_FIELD_KEYS.every((key) => left[key] === right[key]);
}
