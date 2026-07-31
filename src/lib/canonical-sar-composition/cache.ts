/**
 * Version-complete cache keys for Canonical SAR composition (#1114).
 *
 * Any change to seed, scope, budget, supported semantics, or any source /
 * binding / ReleaseSet / Delta / CourseCoverage / KAQ / resource / path /
 * learner version MUST produce a different key.
 *
 * Binding contributions hash the full traversal-relevant record (endpoints,
 * predicate, review/evidence state, overlay version), not merely sorted IDs.
 */

import { createHash } from 'node:crypto';

import {
  CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION,
  SAR_SUPPORTED_OBJECT_TYPES,
  SAR_SUPPORTED_TRAVERSAL_PREDICATES,
  type SarCompositionBudget,
  type SarCompositionScope,
  type SarCompositionSeed,
  type SarCompositionVersionContext,
  type SarCrossNamespaceBinding,
  type SarSourceAdapterSet,
} from './contracts';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

/** Canonical traversal-relevant fields of one binding for cache digest. */
export function bindingTraversalRecord(
  binding: SarCrossNamespaceBinding,
): Record<string, unknown> {
  return {
    id: binding.id,
    kind: binding.kind,
    predicate: binding.predicate,
    fromNamespace: binding.fromNamespace,
    fromIdentity: binding.fromIdentity,
    toNamespace: binding.toNamespace,
    toIdentity: binding.toIdentity,
    releaseSetId: binding.releaseSetId,
    releaseId: binding.releaseId,
    reviewState: binding.reviewState,
    authorityState: binding.authorityState,
    productionAuthoritative: binding.productionAuthoritative,
    inheritedFromLegacyId: binding.inheritedFromLegacyId,
    sameNameAutoMatch: binding.sameNameAutoMatch,
    objectRevision: binding.objectRevision,
    evidenceDigest: binding.evidenceDigest,
    reviewIdentity: binding.reviewIdentity,
    overlayVersion: binding.overlayVersion,
    courseId: binding.courseId,
    learningGoalId: binding.learningGoalId,
    studentId: binding.studentId,
    classId: binding.classId,
  };
}

/**
 * Stable digest over the complete set of traversal-relevant binding records.
 * Same id with changed endpoints/predicate/review/evidence/version invalidates.
 */
export function computeBindingSetDigest(
  bindings: readonly SarCrossNamespaceBinding[],
): string {
  const lines = [...bindings]
    .map((binding) => stableStringify(bindingTraversalRecord(binding)))
    .sort((a, b) => a.localeCompare(b));
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}

export interface SarCacheKeyInput {
  seeds: readonly SarCompositionSeed[];
  scope: SarCompositionScope;
  budget: SarCompositionBudget;
  version: SarCompositionVersionContext;
  adapters: SarSourceAdapterSet;
  /**
   * Full binding records or a verified set — IDs alone are insufficient.
   * When a verified set is provided, digests its underlying bindings.
   */
  bindings: readonly SarCrossNamespaceBinding[] | { bindings: readonly SarCrossNamespaceBinding[] };
}

function resolveBindingsForCache(
  bindings: SarCacheKeyInput['bindings'],
): readonly SarCrossNamespaceBinding[] {
  if (Array.isArray(bindings)) return bindings;
  return (bindings as { bindings: readonly SarCrossNamespaceBinding[] }).bindings;
}

/**
 * Build a deterministic, version-complete cache key.
 */
export function buildSarCompositionCacheKey(input: SarCacheKeyInput): string {
  const seedPayload = [...input.seeds]
    .map((seed) => `${seed.namespace}::${seed.id}`)
    .sort();
  const admitted = [...input.scope.admittedCanonicalIds].sort();
  const adapterVersions = {
    repository: input.adapters.repository.versionIdentity,
    kaq: input.adapters.kaq.versionIdentity,
    resource: input.adapters.resource.versionIdentity,
    path: input.adapters.path.versionIdentity,
    'learner-state': input.adapters['learner-state'].versionIdentity,
  };
  const bindingDigest = computeBindingSetDigest(resolveBindingsForCache(input.bindings));
  const payload = {
    schemaVersion: CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION,
    seeds: seedPayload,
    scope: {
      courseId: input.scope.courseId ?? null,
      learningGoalId: input.scope.learningGoalId ?? null,
      studentId: input.scope.studentId ?? null,
      classId: input.scope.classId ?? null,
      admittedCanonicalIds: admitted,
    },
    budget: {
      maxHops: input.budget.maxHops,
      maxPerSourceCandidates: input.budget.maxPerSourceCandidates,
      maxTotalCandidates: input.budget.maxTotalCandidates,
    },
    supportedObjectTypes: [...SAR_SUPPORTED_OBJECT_TYPES],
    supportedPredicates: [...SAR_SUPPORTED_TRAVERSAL_PREDICATES],
    version: {
      releaseSetId: input.version.releaseSetId,
      releaseId: input.version.releaseId,
      releaseHash: input.version.releaseHash,
      sourceDatasetHash: input.version.sourceDatasetHash,
      projectionId: input.version.projectionId,
      projectionProfile: input.version.projectionProfile,
      projectionDigest: input.version.projectionDigest,
      deltaReceiptId: input.version.deltaReceiptId,
      coverageOverlayId: input.version.coverageOverlayId,
      coverageOverlayVersion: input.version.coverageOverlayVersion,
      coverageSourceHash: input.version.coverageSourceHash,
      coverageCaptureRevision: input.version.coverageCaptureRevision,
      inventoryRunId: input.version.inventoryRunId,
      kaqBindingVersion: input.version.kaqBindingVersion,
      resourceBindingVersion: input.version.resourceBindingVersion,
      pathOverlayVersion: input.version.pathOverlayVersion,
      learnerStateOverlayVersion: input.version.learnerStateOverlayVersion,
      contextDigest: input.version.contextDigest,
    },
    adapterVersions,
    bindingDigest,
  };

  return createHash('sha256')
    .update(stableStringify(payload), 'utf8')
    .digest('hex');
}

/**
 * Prove two cache inputs differ when any version/scope/budget/seed field changes.
 */
export function cacheKeysDiffer(
  left: SarCacheKeyInput,
  right: SarCacheKeyInput,
): boolean {
  return buildSarCompositionCacheKey(left) !== buildSarCompositionCacheKey(right);
}

/**
 * Enumerate version fields that must invalidate the cache when changed.
 */
export const SAR_CACHE_INVALIDATION_FIELDS = [
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
  'kaqBindingVersion',
  'resourceBindingVersion',
  'pathOverlayVersion',
  'learnerStateOverlayVersion',
] as const satisfies ReadonlyArray<keyof SarCompositionVersionContext>;
