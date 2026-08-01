/**
 * Version-closed candidate context enforcement for Canonical RAG shadow (#1112).
 */

import {
  assertCandidateContextFingerprint,
  CandidateContextError,
  membershipMatchesContext,
  type CandidateContextFingerprint,
} from './context-fingerprint';
import type {
  ActStructuralCitationTarget,
  CanonicalRagReleaseContext,
  CanonicalRagShadowInput,
  VersionBoundCrosswalk,
} from './contracts';

export type VersionContextFailureCode =
  | 'missing-release-context'
  | 'incomplete-release-context'
  | 'mixed-object-context'
  | 'mixed-relation-context'
  | 'mixed-coverage-context'
  | 'mixed-crosswalk-context'
  | 'mixed-structural-context'
  | 'mixed-upstream-context'
  | 'missing-upstream-context';

export class CanonicalRagVersionContextError extends Error {
  readonly code: VersionContextFailureCode;
  readonly field?: string;

  constructor(code: VersionContextFailureCode, message: string, field?: string) {
    super(message);
    this.name = 'CanonicalRagVersionContextError';
    this.code = code;
    this.field = field;
  }
}

export function isCompleteReleaseContext(
  release: CanonicalRagReleaseContext | null | undefined,
): release is CanonicalRagReleaseContext {
  if (!release) return false;
  try {
    assertCandidateContextFingerprint(release);
    return true;
  } catch {
    return false;
  }
}

export function assertCompleteReleaseContext(
  release: CanonicalRagReleaseContext | null | undefined,
): CanonicalRagReleaseContext {
  try {
    return assertCandidateContextFingerprint(release);
  } catch (error) {
    if (error instanceof CandidateContextError) {
      throw new CanonicalRagVersionContextError(
        error.code === 'incomplete-context' ? 'incomplete-release-context' : 'incomplete-release-context',
        error.message,
        error.field,
      );
    }
    throw error;
  }
}

/**
 * Full-fingerprint membership comparison (every field including digest).
 * Alias for membershipMatchesContext — no subset comparison.
 */
export function membershipMatchesRelease(
  row: CandidateContextFingerprint,
  release: CanonicalRagReleaseContext,
): boolean {
  return membershipMatchesContext(row, release);
}

/**
 * Fail closed before alignment/expansion when any input is incomplete or mixed.
 * Changing only releaseHash / sourceDatasetHash / projectionDigest / coverage
 * overlay / delta / capture / inventory rejects the whole input.
 */
export function assertVersionClosedShadowInput(
  input: CanonicalRagShadowInput,
): CanonicalRagReleaseContext {
  const release = assertCompleteReleaseContext(input.release);

  for (const object of input.objects) {
    assertMembership(object, release, 'mixed-object-context', `object:${object.canonicalId}`);
  }
  for (const relation of input.relations) {
    assertMembership(relation, release, 'mixed-relation-context', `relation:${relation.relationId}`);
  }
  for (const coverage of input.coverage) {
    assertMembership(coverage, release, 'mixed-coverage-context', `coverage:${coverage.canonicalId}`);
  }
  for (const crosswalk of input.crosswalks) {
    assertMembership(crosswalk, release, 'mixed-crosswalk-context', `crosswalk:${crosswalk.row.id}`);
    assertCrosswalkRowEndpoints(crosswalk, release);
  }
  for (const unit of input.structuralUnits) {
    assertMembership(unit, release, 'mixed-structural-context', `structural:${unit.structuralUnitId}`);
    if (unit.captureRevision !== release.coverageCaptureRevision) {
      throw new CanonicalRagVersionContextError(
        'mixed-structural-context',
        `Structural unit captureRevision disagrees with context fingerprint`,
        unit.structuralUnitId,
      );
    }
    if (unit.inventoryRunId !== release.inventoryRunId) {
      throw new CanonicalRagVersionContextError(
        'mixed-structural-context',
        `Structural unit inventoryRunId disagrees with context fingerprint`,
        unit.structuralUnitId,
      );
    }
  }
  for (const [canonicalId, seeds] of input.upstreamByCanonicalId) {
    for (const seed of seeds) {
      if (!seed.context) {
        throw new CanonicalRagVersionContextError(
          'missing-upstream-context',
          `Upstream seed for ${canonicalId} is missing mandatory context fingerprint`,
          canonicalId,
        );
      }
      if (!membershipMatchesRelease(seed.context, release)) {
        throw new CanonicalRagVersionContextError(
          'mixed-upstream-context',
          `Upstream seed for ${canonicalId} is not bound to the closed candidate context`,
          canonicalId,
        );
      }
    }
  }
  return release;
}

function assertMembership(
  row: CandidateContextFingerprint,
  release: CanonicalRagReleaseContext,
  code: VersionContextFailureCode,
  label: string,
): void {
  if (!membershipMatchesRelease(row, release)) {
    throw new CanonicalRagVersionContextError(
      code,
      `Version-mixed input rejected (${label})`,
      label,
    );
  }
}

function assertCrosswalkRowEndpoints(
  crosswalk: VersionBoundCrosswalk,
  release: CanonicalRagReleaseContext,
): void {
  const row = crosswalk.row;
  // Raw row must at least agree on the subset it stores.
  if (
    row.releaseSetId !== release.releaseSetId
    || row.releaseId !== release.releaseId
    || row.deltaReceiptId !== release.deltaReceiptId
    || row.captureRevision !== release.coverageCaptureRevision
    || (row.inventoryRunId != null && row.inventoryRunId !== release.inventoryRunId)
  ) {
    throw new CanonicalRagVersionContextError(
      'mixed-crosswalk-context',
      `Crosswalk row ${row.id} raw identity disagrees with wrapper fingerprint`,
      row.id,
    );
  }
}

/**
 * @internal Test/fixture helper only. Not a public authority stamping API.
 * Prefer constructing members via authoritative loaders.
 */
export function bindCandidateContextForFixtureOnly<T extends object>(
  row: T,
  context: CanonicalRagReleaseContext,
): T & CandidateContextFingerprint {
  const closed = assertCompleteReleaseContext(context);
  return {
    ...row,
    ...closed,
  };
}

/** @deprecated Use bindCandidateContextForFixtureOnly — stamps full fingerprint. */
export const bindVersionContext = bindCandidateContextForFixtureOnly;
