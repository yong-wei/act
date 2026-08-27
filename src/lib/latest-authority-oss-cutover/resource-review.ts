/**
 * Reproducible per-resource review input for the active Runtime continuity
 * baseline.  It deliberately separates course-side legacy node references
 * and name-assisted Authority candidates from formal Canonical bindings.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import type { ActiveBaselineEntry, BaselineCourseScope } from './contracts';

export const ACTIVE_RESOURCE_REVIEW_CONTRACT = 'active-resource-review-pack/v1' as const;

export type FormalTeachingRole = 'COVERS' | 'EXPLAINS' | 'PRACTICES' | 'ASSESSES';

export interface ActiveResourceReviewSource {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly type: string;
  readonly registryId: string | null;
  readonly category: string | null;
  readonly displayName: string | null;
  readonly teacherOnly: boolean;
  readonly configSha256: string;
  readonly contentSha256: string;
  readonly aiHintsSha256: string;
  readonly updatedAt: string;
  readonly knowledgeNodeIds: readonly string[];
}

export interface ActiveResourceLessonPlacement {
  readonly id: string;
  readonly resourceId: string | null;
  readonly itemType: string;
  readonly stage: string;
  readonly order: number;
  readonly duration: number | null;
  readonly plan: {
    readonly id: string;
    readonly title: string;
    readonly isPublic: boolean;
    readonly presetKey: string | null;
  };
}

export interface RegisteredResourceReviewMetadata {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly renderTarget?: string | null;
  readonly launchTarget?: string | null;
  readonly knowledgeNodeIds?: readonly string[];
}

export interface LegacyKnowledgeNodeReviewSource {
  readonly id: string;
  readonly name: string;
}

export interface AuthorityReviewObject {
  readonly canonicalId: string;
  readonly semanticRevision: string;
  readonly displayName: string;
}

export interface ActiveResourceReviewInput {
  readonly sourceHash: string;
  readonly authority: {
    readonly releaseId: string;
    readonly snapshotHash: string;
  };
  readonly resources: readonly ActiveResourceReviewSource[];
  readonly lessonItems: readonly ActiveResourceLessonPlacement[];
  readonly registryMetadata: readonly RegisteredResourceReviewMetadata[];
  readonly legacyNodes: readonly LegacyKnowledgeNodeReviewSource[];
  /**
   * A controlled name crosswalk can produce an investigation candidate only.
   * It lacks the structural alignment required for a formal binding.
   */
  readonly nameCandidateCrosswalk: Readonly<Record<string, string>>;
  readonly authorityObjects: readonly AuthorityReviewObject[];
  readonly registryRepairCandidates: Readonly<Record<string, string>>;
}

export interface ActiveResourceMappingCandidate {
  readonly legacyNodeId: string;
  readonly legacyNodeName: string;
  readonly canonicalId: string;
  readonly canonicalSemanticRevision: string;
  readonly canonicalDisplayName: string;
  readonly state: 'CANDIDATE_ONLY';
  readonly reason: 'name-crosswalk-requires-structural-alignment';
}

export interface ActiveResourceRoleCandidate {
  readonly lessonItemId: string;
  readonly stage: string;
  readonly role: FormalTeachingRole;
  readonly rationale: string;
}

export interface ActiveResourceReviewItem {
  readonly reviewId: string;
  readonly logicalResourceId: string;
  readonly dbResourceId: string;
  readonly title: string;
  readonly registryId: string | null;
  readonly effectiveRegistryId: string | null;
  readonly registryIdentityState: 'CURRENT' | 'REPAIR_REQUIRED';
  readonly sourceIdentity: string;
  readonly sourceHash: string;
  readonly courseScope: BaselineCourseScope;
  readonly classification: 'resource';
  readonly subtype: string;
  readonly launchContract: {
    readonly registryId: string | null;
    readonly renderTarget: string | null;
    readonly launchTarget: string | null;
  };
  readonly legacyKnowledgeNodeIds: readonly string[];
  readonly roleCandidates: readonly ActiveResourceRoleCandidate[];
  readonly mappingCandidates: readonly ActiveResourceMappingCandidate[];
  readonly formalBindingCount: 0;
  readonly disposition: 'FORMAL_PENDING' | 'OUT_OF_COURSE';
  readonly blockerCodes: readonly string[];
}

export interface ActiveResourceReviewPack {
  readonly contract: typeof ACTIVE_RESOURCE_REVIEW_CONTRACT;
  readonly sourceHash: string;
  readonly authority: ActiveResourceReviewInput['authority'];
  readonly entries: readonly ActiveBaselineEntry[];
  readonly items: readonly ActiveResourceReviewItem[];
  readonly summary: {
    readonly resourceCount: number;
    readonly inCourseCount: number;
    readonly outOfCourseCount: number;
    readonly registryRepairRequiredCount: number;
    readonly mappingCandidateCount: number;
    readonly formallyBoundCount: 0;
    readonly unresolvedInCourseCount: number;
  };
  readonly reviewHash: string;
}

function roleForStage(stage: string): FormalTeachingRole {
  if (stage === 'PRE_ASSESSMENT' || stage === 'POST_ASSESSMENT') return 'ASSESSES';
  if (stage === 'PARTICIPATORY') return 'PRACTICES';
  if (stage === 'OBJECTIVE') return 'COVERS';
  return 'EXPLAINS';
}

function roleRationale(stage: string, role: FormalTeachingRole): string {
  return `BOPPPS stage ${stage} proposes ${role}; the role remains unbound until the atomic resource-to-Canonical review closes.`;
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`active resource review input repeats ${label}`);
  }
}

/**
 * Assemble a complete, fail-closed review pack.  No output from this function
 * is a formal binding: a legacy node name and an Authority label can only
 * identify a candidate that still needs structural alignment and atom review.
 */
export function buildActiveResourceReviewPack(
  input: ActiveResourceReviewInput,
): ActiveResourceReviewPack {
  assertUnique(input.resources.map((row) => row.id), 'TeachingResource id');
  assertUnique(input.registryMetadata.map((row) => row.id), 'registry metadata id');
  assertUnique(input.legacyNodes.map((row) => row.id), 'legacy knowledge node id');
  assertUnique(input.authorityObjects.map((row) => row.canonicalId), 'Authority canonical id');

  const registryById = new Map(input.registryMetadata.map((row) => [row.id, row]));
  const legacyNodeById = new Map(input.legacyNodes.map((row) => [row.id, row]));
  const authorityById = new Map(input.authorityObjects.map((row) => [row.canonicalId, row]));
  const placementsByResourceId = new Map<string, ActiveResourceLessonPlacement[]>();
  for (const placement of input.lessonItems) {
    if (!placement.resourceId || placement.itemType !== 'RESOURCE') continue;
    const rows = placementsByResourceId.get(placement.resourceId) ?? [];
    rows.push(placement);
    placementsByResourceId.set(placement.resourceId, rows);
  }

  const items: ActiveResourceReviewItem[] = [];
  const entries: ActiveBaselineEntry[] = [];
  for (const resource of [...input.resources].sort((left, right) => left.id.localeCompare(right.id))) {
    const placements = [...(placementsByResourceId.get(resource.id) ?? [])]
      .sort((left, right) => left.id.localeCompare(right.id));
    const courseScope: BaselineCourseScope = placements.length > 0 ? 'in-course' : 'out-of-course';
    const repairedRegistryId = resource.registryId ?? input.registryRepairCandidates[resource.id] ?? null;
    const registry = repairedRegistryId ? registryById.get(repairedRegistryId) : undefined;
    const sourceHash = projectionDigest({
      id: resource.id,
      updatedAt: resource.updatedAt,
      configSha256: resource.configSha256,
      contentSha256: resource.contentSha256,
      aiHintsSha256: resource.aiHintsSha256,
      registryId: resource.registryId,
    });
    const legacyKnowledgeNodeIds = [...new Set(registry?.knowledgeNodeIds ?? resource.knowledgeNodeIds)].sort();
    const mappingCandidates: ActiveResourceMappingCandidate[] = [];
    for (const legacyNodeId of legacyKnowledgeNodeIds) {
      const legacyNode = legacyNodeById.get(legacyNodeId);
      if (!legacyNode) continue;
      const canonicalId = input.nameCandidateCrosswalk[legacyNode.name];
      if (!canonicalId) continue;
      const authority = authorityById.get(canonicalId);
      if (!authority) {
        throw new Error(
          `name candidate ${legacyNode.name} targets missing Authority object ${canonicalId}`,
        );
      }
      mappingCandidates.push({
        legacyNodeId,
        legacyNodeName: legacyNode.name,
        canonicalId,
        canonicalSemanticRevision: authority.semanticRevision,
        canonicalDisplayName: authority.displayName,
        state: 'CANDIDATE_ONLY',
        reason: 'name-crosswalk-requires-structural-alignment',
      });
    }
    const roleCandidates = placements.map((placement) => {
      const role = roleForStage(placement.stage);
      return {
        lessonItemId: placement.id,
        stage: placement.stage,
        role,
        rationale: roleRationale(placement.stage, role),
      } satisfies ActiveResourceRoleCandidate;
    });
    const blockerCodes = new Set<string>();
    if (!registry) blockerCodes.add('registry-metadata-missing');
    if (resource.registryId === null) blockerCodes.add('registry-identity-repair-required');
    if (courseScope === 'in-course') {
      if (mappingCandidates.length === 0) blockerCodes.add('canonical-candidate-missing');
      blockerCodes.add('formal-structural-alignment-missing');
      blockerCodes.add('atomic-binding-review-pending');
    }
    const logicalResourceId = `teaching-resource:${resource.id}`;
    const reviewId = `active-resource-review:${projectionDigest({
      logicalResourceId,
      resourceSourceHash: sourceHash,
      authority: input.authority,
      productionObservationHash: input.sourceHash,
    })}`;
    items.push({
      reviewId,
      logicalResourceId,
      dbResourceId: resource.id,
      title: resource.title,
      registryId: resource.registryId,
      effectiveRegistryId: repairedRegistryId,
      registryIdentityState: resource.registryId === null ? 'REPAIR_REQUIRED' : 'CURRENT',
      sourceIdentity: `db:TeachingResource:${resource.id}:revision:${sourceHash}`,
      sourceHash,
      courseScope,
      classification: 'resource',
      subtype: resource.type,
      launchContract: {
        registryId: repairedRegistryId,
        renderTarget: registry?.renderTarget ?? null,
        launchTarget: registry?.launchTarget ?? null,
      },
      legacyKnowledgeNodeIds,
      roleCandidates,
      mappingCandidates: mappingCandidates.sort((left, right) => (
        `${left.legacyNodeId}:${left.canonicalId}`.localeCompare(`${right.legacyNodeId}:${right.canonicalId}`)
      )),
      formalBindingCount: 0,
      disposition: courseScope === 'in-course' ? 'FORMAL_PENDING' : 'OUT_OF_COURSE',
      blockerCodes: [...blockerCodes].sort(),
    });
    entries.push({
      entryId: logicalResourceId,
      resourceId: logicalResourceId,
      classification: 'resource',
      subtype: resource.type,
      sourceKind: 'db-teaching-resource',
      dbResourceId: resource.id,
      registryId: repairedRegistryId,
      courseScope,
    });
  }

  const sortedItems = items.sort((left, right) => left.logicalResourceId.localeCompare(right.logicalResourceId));
  const sortedEntries = entries.sort((left, right) => left.entryId.localeCompare(right.entryId));
  const summary = {
    resourceCount: sortedItems.length,
    inCourseCount: sortedItems.filter((row) => row.courseScope === 'in-course').length,
    outOfCourseCount: sortedItems.filter((row) => row.courseScope === 'out-of-course').length,
    registryRepairRequiredCount: sortedItems.filter((row) => row.registryIdentityState === 'REPAIR_REQUIRED').length,
    mappingCandidateCount: sortedItems.reduce((count, row) => count + row.mappingCandidates.length, 0),
    formallyBoundCount: 0 as const,
    unresolvedInCourseCount: sortedItems.filter((row) => row.disposition === 'FORMAL_PENDING').length,
  };
  const reviewHash = projectionDigest({
    contract: ACTIVE_RESOURCE_REVIEW_CONTRACT,
    sourceHash: input.sourceHash,
    authority: input.authority,
    entries: sortedEntries,
    items: sortedItems,
    summary,
  });
  return {
    contract: ACTIVE_RESOURCE_REVIEW_CONTRACT,
    sourceHash: input.sourceHash,
    authority: input.authority,
    entries: sortedEntries,
    items: sortedItems,
    summary,
    reviewHash,
  };
}
