/**
 * Active-baseline-plus-explicit-delta successor resource denominator
 * (#1509, tasks 3.x).
 *
 * The denominator is constructed only from the complete logical-resource
 * inventory and explicit non-resource dispositions of the production-active
 * Runtime Release v2, plus an ordered set of explicitly declared new or
 * changed release inputs. Historical releases, rollback-only content,
 * orphaned OSS blobs, and working-tree scans cannot enlarge or shrink it
 * because no other input exists in this construction.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  LatestAuthorityCutoverError,
  type ActiveBaseline,
  type ActiveBaselineEntry,
  type ActiveRuntimeReleaseIdentity,
  type CombinedDenominator,
  type DenominatorEntry,
  type ExplicitDelta,
  type ExplicitDeltaInput,
} from './contracts';

export interface BuildActiveBaselineInput {
  readonly activeRelease: ActiveRuntimeReleaseIdentity;
  readonly entries: readonly ActiveBaselineEntry[];
}

function assertReleaseIdentity(activeRelease: ActiveRuntimeReleaseIdentity): void {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(activeRelease.releaseId)) {
    throw new LatestAuthorityCutoverError(
      'baseline-release-invalid',
      'activeRelease.releaseId must be a non-empty slug.',
    );
  }
  for (const field of ['manifestSha256', 'treeSha256', 'activeReceiptHash'] as const) {
    if (!/^[a-f0-9]{64}$/u.test(activeRelease[field])) {
      throw new LatestAuthorityCutoverError(
        'baseline-release-invalid',
        `activeRelease.${field} must be a lowercase SHA-256 hex digest.`,
      );
    }
  }
  if (
    !Number.isInteger(activeRelease.lifecycleGeneration)
    || activeRelease.lifecycleGeneration < 1
  ) {
    throw new LatestAuthorityCutoverError(
      'baseline-release-invalid',
      'activeRelease.lifecycleGeneration must be a positive integer.',
    );
  }
}

/**
 * Freeze the immutable continuity baseline from the reopened active release.
 * Every logical inventory entry and explicit non-resource disposition from
 * that release enters the baseline; omitting one fails qualification later.
 */
export function buildActiveBaseline(input: BuildActiveBaselineInput): ActiveBaseline {
  assertReleaseIdentity(input.activeRelease);
  if (input.entries.length === 0) {
    throw new LatestAuthorityCutoverError(
      'baseline-empty',
      'The active release inventory cannot be empty.',
    );
  }
  const seen = new Set<string>();
  for (const entry of input.entries) {
    if (!entry.entryId || typeof entry.entryId !== 'string') {
      throw new LatestAuthorityCutoverError(
        'baseline-entry-invalid',
        'Every baseline entry needs a non-empty entryId.',
      );
    }
    if (seen.has(entry.entryId)) {
      throw new LatestAuthorityCutoverError(
        'baseline-entry-duplicate',
        `Duplicate baseline entryId: ${entry.entryId}`,
      );
    }
    seen.add(entry.entryId);
    if (entry.classification !== 'resource' && entry.classification !== 'non-resource') {
      throw new LatestAuthorityCutoverError(
        'baseline-entry-invalid',
        `Entry ${entry.entryId} has no resource/non-resource classification.`,
      );
    }
    if (entry.classification === 'resource' && !entry.resourceId) {
      throw new LatestAuthorityCutoverError(
        'baseline-entry-invalid',
        `Resource entry ${entry.entryId} has no logical resource identity.`,
      );
    }
  }
  const sorted = [...input.entries].sort((a, b) => a.entryId.localeCompare(b.entryId));
  const inventoryHash = projectionDigest(
    sorted.map((entry) => ({
      entryId: entry.entryId,
      resourceId: entry.resourceId,
      classification: entry.classification,
      subtype: entry.subtype,
      sourceKind: entry.sourceKind ?? null,
      runtimePath: entry.runtimePath ?? null,
      dbResourceId: entry.dbResourceId ?? null,
      registryId: entry.registryId ?? null,
      carrierEntryId: entry.carrierEntryId ?? null,
      courseScope: entry.courseScope ?? null,
      sourceIdentity: entry.sourceIdentity ?? null,
      sourceContentSha256: entry.sourceContentSha256 ?? null,
      dispositionReason: entry.dispositionReason ?? null,
    })),
  );
  const logicalResourceCount = sorted.filter((entry) => entry.classification === 'resource').length;
  const nonResourceCount = sorted.length - logicalResourceCount;
  const baselineHash = projectionDigest({
    contract: 'successor-resource-denominator/v1',
    activeRelease: input.activeRelease,
    inventoryHash,
    logicalResourceCount,
    nonResourceCount,
  });
  return {
    contract: 'successor-resource-denominator/v1',
    activeRelease: input.activeRelease,
    entries: sorted,
    logicalResourceCount,
    nonResourceCount,
    inventoryHash,
    baselineHash,
  };
}

/**
 * Accept an ordered, explicit successor delta of new or changed release
 * inputs. Duplicate resource ids, empty identities, or undeclared change
 * kinds are rejected before the denominator is combined.
 */
export function buildExplicitDelta(orderedInputs: readonly ExplicitDeltaInput[]): ExplicitDelta {
  if (orderedInputs.length === 0) {
    return {
      contract: 'successor-resource-denominator/v1',
      orderedInputs: [],
      deltaHash: projectionDigest({ contract: 'successor-resource-denominator/v1', orderedInputs: [] }),
    };
  }
  const seen = new Set<string>();
  for (const item of orderedInputs) {
    if (!item.resourceId || typeof item.resourceId !== 'string') {
      throw new LatestAuthorityCutoverError(
        'delta-input-invalid',
        'Every declared delta input needs a non-empty resourceId.',
      );
    }
    if (seen.has(item.resourceId)) {
      throw new LatestAuthorityCutoverError(
        'delta-input-duplicate',
        `Delta input declared more than once: ${item.resourceId}`,
      );
    }
    seen.add(item.resourceId);
    if (!item.subtype || typeof item.subtype !== 'string') {
      throw new LatestAuthorityCutoverError(
        'delta-input-invalid',
        `Delta input ${item.resourceId} has no subtype.`,
      );
    }
    if (item.change !== 'NEW' && item.change !== 'CHANGED') {
      throw new LatestAuthorityCutoverError(
        'delta-input-invalid',
        `Delta input ${item.resourceId} has an undeclared change kind.`,
      );
    }
    if (!item.sourceIdentity || typeof item.sourceIdentity !== 'string') {
      throw new LatestAuthorityCutoverError(
        'delta-input-invalid',
        `Delta input ${item.resourceId} has no governed source identity.`,
      );
    }
  }
  const deltaHash = projectionDigest({
    contract: 'successor-resource-denominator/v1',
    orderedInputs: orderedInputs.map((item) => ({
      resourceId: item.resourceId,
      subtype: item.subtype,
      change: item.change,
      sourceIdentity: item.sourceIdentity,
    })),
  });
  return {
    contract: 'successor-resource-denominator/v1',
    orderedInputs: [...orderedInputs],
    deltaHash,
  };
}

/** Combine the continuity baseline and the explicit delta into the successor denominator. */
export function buildCombinedDenominator(
  baseline: ActiveBaseline,
  delta: ExplicitDelta,
): CombinedDenominator {
  const entries: DenominatorEntry[] = [];
  const baselineResourceIds = new Set(
    baseline.entries.filter((entry) => entry.classification === 'resource').map((entry) => entry.resourceId as string),
  );
  for (const entry of baseline.entries) {
    if (entry.classification !== 'resource') continue;
    entries.push({
      key: `baseline:${entry.resourceId}`,
      resourceId: entry.resourceId as string,
      origin: 'BASELINE',
      subtype: entry.subtype ?? 'unknown',
      classification: 'resource',
    });
  }
  for (const item of delta.orderedInputs) {
    if (baselineResourceIds.has(item.resourceId)) {
      // A declared CHANGED input refreezes an existing baseline resource; it
      // must not create a second denominator entry.
      if (item.change !== 'CHANGED') {
        throw new LatestAuthorityCutoverError(
          'denominator-delta-conflict',
          `Delta input ${item.resourceId} already exists in the baseline and must be declared CHANGED.`,
        );
      }
      continue;
    }
    entries.push({
      key: `delta:${item.resourceId}`,
      resourceId: item.resourceId,
      origin: 'DELTA',
      subtype: item.subtype,
      classification: 'resource',
    });
  }
  const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key));
  const denominatorHash = projectionDigest({
    contract: 'successor-resource-denominator/v1',
    baselineHash: baseline.baselineHash,
    deltaHash: delta.deltaHash,
    entries: sorted,
  });
  return {
    contract: 'successor-resource-denominator/v1',
    baselineHash: baseline.baselineHash,
    deltaHash: delta.deltaHash,
    denominatorHash,
    entries: sorted,
  };
}

/**
 * No undeclared workspace or OSS object may enter the denominator by
 * discovery. The guard compares any discovered object set (OSS listing,
 * working-tree scan, output scan) against the sealed denominator and fails
 * on any object that claims to be a successor resource but was never
 * declared. Purely historical or orphaned objects do not fail this check —
 * they simply have no effect on the denominator.
 */
export function assertNoDiscoveredObjectsEnterDenominator(
  discoveredResourceIds: readonly string[],
  denominator: CombinedDenominator,
): void {
  const declared = new Set(denominator.entries.map((entry) => entry.resourceId));
  const intruders = discoveredResourceIds.filter((id) => !declared.has(id));
  if (intruders.length > 0) {
    throw new LatestAuthorityCutoverError(
      'denominator-discovery-rejected',
      `Undeclared resources cannot enter the successor denominator: ${intruders.join(', ')}`,
    );
  }
}

/**
 * Active-receipt drift guard: if the live active receipt no longer matches
 * the baseline's sealed active release, qualification must fail instead of
 * silently rebinding the denominator to a different release.
 */
export function assertBaselineMatchesActiveReceipt(
  baseline: ActiveBaseline,
  observed: ActiveRuntimeReleaseIdentity,
): void {
  if (
    baseline.activeRelease.releaseId !== observed.releaseId
    || baseline.activeRelease.manifestSha256 !== observed.manifestSha256
    || baseline.activeRelease.treeSha256 !== observed.treeSha256
    || baseline.activeRelease.activeReceiptHash !== observed.activeReceiptHash
  ) {
    throw new LatestAuthorityCutoverError(
      'baseline-active-receipt-drift',
      `The active release drifted from the sealed baseline (${baseline.activeRelease.releaseId} -> ${observed.releaseId}); rebuild the denominator.`,
    );
  }
}

/** Historical, rollback-only, retained, orphaned, and abandoned releases never enter the baseline. */
export function assertReleaseNotHistorical(
  candidate: { releaseId: string; state: string },
): void {
  const nonActiveStates = ['historical', 'rollback', 'retained', 'orphaned', 'abandoned'];
  if (nonActiveStates.includes(candidate.state)) {
    throw new LatestAuthorityCutoverError(
      'baseline-source-not-active',
      `Release ${candidate.releaseId} is ${candidate.state} and cannot determine the denominator.`,
    );
  }
}
