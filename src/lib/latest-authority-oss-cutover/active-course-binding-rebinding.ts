/**
 * Deterministic re-binding of a frozen course resource after an Authority
 * revision. A preserved Canonical id with an approved successor revision is a
 * new binding derivation, never a copied historical publication identity.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  computeDerivationDelta,
  resourceBindingCacheIdentity,
} from './incremental';

export const ACTIVE_COURSE_BINDING_REBINDING_CONTRACT =
  'active-course-binding-rebinding/v1' as const;

export interface CourseBindingAuthorityObject {
  readonly canonicalId: string;
  readonly canonicalType: string;
  readonly semanticRevision: string;
  readonly reviewStatus: string;
  readonly publicationStatus: string;
}

export interface HistoricalCourseBinding {
  readonly bindingId: string;
  readonly resourceId: string;
  readonly canonicalId: string;
  readonly role: string;
  readonly scopeId: string;
}

export interface CourseBindingSource {
  readonly resourceId: string;
  readonly resourceContentSha256: string;
  readonly atomId: string;
  readonly atomContentSha256: string;
  readonly sourceIdentity: string;
  readonly anchorContract: string;
  readonly launcherContract: string;
}

export interface ReboundCourseBinding {
  readonly bindingId: string;
  readonly resourceId: string;
  readonly canonicalId: string;
  readonly role: string;
  readonly scopeId: string;
  readonly cacheIdentity: string | null;
  readonly disposition: 'REUSED' | 'RECOMPUTED' | 'BLOCKED';
  readonly blocker: string | null;
}

export interface CourseBindingRebindingResult {
  readonly contract: typeof ACTIVE_COURSE_BINDING_REBINDING_CONTRACT;
  readonly entries: readonly ReboundCourseBinding[];
  readonly summary: {
    readonly reusedCount: number;
    readonly recomputedCount: number;
    readonly blockedCount: number;
    readonly changedCanonicalRevisionCount: number;
  };
  readonly rebindHash: string;
}

function currentCacheIdentity(input: {
  source: CourseBindingSource;
  binding: HistoricalCourseBinding;
  authority: CourseBindingAuthorityObject;
  qualifiedPipelineIdentity: string;
}): string {
  return resourceBindingCacheIdentity({
    resourceId: input.source.resourceId,
    atomId: input.source.atomId,
    resourceContentSha256: input.source.resourceContentSha256,
    atomContentSha256: input.source.atomContentSha256,
    canonicalId: input.binding.canonicalId,
    canonicalSemanticRevision: input.authority.semanticRevision,
    role: input.binding.role,
    courseScopeId: input.binding.scopeId,
    sourceIdentity: input.source.sourceIdentity,
    qualifiedPipelineIdentity: input.qualifiedPipelineIdentity,
    anchorContract: input.source.anchorContract,
    launcherContract: input.source.launcherContract,
  });
}

/**
 * Reissue only explicitly historic course bindings. The caller must supply an
 * atom taken from the frozen active Runtime, while this function verifies that
 * the same Canonical identity is still a published, approved Authority node.
 */
export function buildActiveCourseBindingRebindings(input: {
  readonly bindings: readonly HistoricalCourseBinding[];
  readonly sources: readonly CourseBindingSource[];
  readonly predecessorAuthority: readonly CourseBindingAuthorityObject[];
  readonly successorAuthority: readonly CourseBindingAuthorityObject[];
  readonly qualifiedPipelineIdentity: string;
}): CourseBindingRebindingResult {
  const sourceByResourceId = new Map(input.sources.map((source) => [source.resourceId, source]));
  const predecessorById = new Map(input.predecessorAuthority.map((object) => [object.canonicalId, object]));
  const successorById = new Map(input.successorAuthority.map((object) => [object.canonicalId, object]));
  if (sourceByResourceId.size !== input.sources.length) {
    throw new Error('active course binding rebind input repeats a resource source');
  }
  if (predecessorById.size !== input.predecessorAuthority.length || successorById.size !== input.successorAuthority.length) {
    throw new Error('active course binding rebind input repeats a Canonical identity');
  }

  const predecessorCache: Record<string, string> = {};
  const successorCache: Record<string, string> = {};
  const entries = [...input.bindings]
    .sort((left, right) => left.bindingId.localeCompare(right.bindingId))
    .map((binding) => {
      const source = sourceByResourceId.get(binding.resourceId);
      const predecessor = predecessorById.get(binding.canonicalId);
      const successor = successorById.get(binding.canonicalId);
      if (!source) {
        return { ...binding, cacheIdentity: null, disposition: 'BLOCKED', blocker: 'source-atom-missing' } satisfies ReboundCourseBinding;
      }
      if (!predecessor || !successor) {
        return { ...binding, cacheIdentity: null, disposition: 'BLOCKED', blocker: 'canonical-identity-missing' } satisfies ReboundCourseBinding;
      }
      if (predecessor.canonicalType !== successor.canonicalType) {
        return { ...binding, cacheIdentity: null, disposition: 'BLOCKED', blocker: 'canonical-type-drift' } satisfies ReboundCourseBinding;
      }
      if (successor.reviewStatus !== 'approved' || successor.publicationStatus !== 'published') {
        return { ...binding, cacheIdentity: null, disposition: 'BLOCKED', blocker: 'successor-canonical-not-approved' } satisfies ReboundCourseBinding;
      }
      const oldIdentity = currentCacheIdentity({
        source,
        binding,
        authority: predecessor,
        qualifiedPipelineIdentity: input.qualifiedPipelineIdentity,
      });
      const newIdentity = currentCacheIdentity({
        source,
        binding,
        authority: successor,
        qualifiedPipelineIdentity: input.qualifiedPipelineIdentity,
      });
      predecessorCache[binding.bindingId] = oldIdentity;
      successorCache[binding.bindingId] = newIdentity;
      return {
        ...binding,
        cacheIdentity: newIdentity,
        disposition: 'RECOMPUTED',
        blocker: null,
      } satisfies ReboundCourseBinding;
    });
  const delta = computeDerivationDelta({ predecessor: predecessorCache, successor: successorCache });
  const recomputed = new Set(delta.recomputed);
  const normalizedEntries = entries.map((entry) => (
    entry.disposition === 'RECOMPUTED' && !recomputed.has(entry.bindingId)
      ? { ...entry, disposition: 'REUSED' as const }
      : entry
  ));
  const summary = {
    reusedCount: normalizedEntries.filter((entry) => entry.disposition === 'REUSED').length,
    recomputedCount: normalizedEntries.filter((entry) => entry.disposition === 'RECOMPUTED').length,
    blockedCount: normalizedEntries.filter((entry) => entry.disposition === 'BLOCKED').length,
    changedCanonicalRevisionCount: [...input.bindings].filter((binding) => {
      const previous = predecessorById.get(binding.canonicalId);
      const successor = successorById.get(binding.canonicalId);
      return previous !== undefined && successor !== undefined && previous.semanticRevision !== successor.semanticRevision;
    }).length,
  };
  return {
    contract: ACTIVE_COURSE_BINDING_REBINDING_CONTRACT,
    entries: normalizedEntries,
    summary,
    rebindHash: projectionDigest({
      contract: ACTIVE_COURSE_BINDING_REBINDING_CONTRACT,
      entries: normalizedEntries,
      summary,
      derivation: delta.receipt,
    }),
  };
}
