import type { RegisteredPeerDomainId } from '@/lib/authority-domain-catalog/contracts';
import {
  TEACHING_LAYER,
  type AuthorityShardRelation,
  type AuthorityShardTeachingCoverage,
} from '@/lib/authority-domain-shards/contracts';

import {
  LEGACY_FOUR_PREREQUISITE_PROJECTION_ID,
  LEGACY_FOUR_PREREQUISITE_PUBLICATION_ID,
  type ActTeachingProjectionArtifacts,
  type ActTeachingAuthorityIdentity,
} from './contracts';

export type TeachingShardRelationFamily =
  | 'teaching-containment'
  | 'teaching-prerequisite'
  | 'teaching-association';

const FAMILY_PRESENTATION: Record<
  ActTeachingProjectionArtifacts['edges'][number]['family'],
  TeachingShardRelationFamily
> = {
  containment: 'teaching-containment',
  prerequisite: 'teaching-prerequisite',
  association: 'teaching-association',
};

export function teachingProjectionMatchesEnvelope(input: {
  artifacts: ActTeachingProjectionArtifacts | null;
  authority: ActTeachingAuthorityIdentity;
  scopeHash: string;
}): boolean {
  if (!input.artifacts) return false;
  const receipt = input.artifacts.receipt;
  return receipt.scopeHash === input.scopeHash
    && receipt.authority.releaseId === input.authority.releaseId
    && receipt.authority.snapshotHash === input.authority.snapshotHash
    && receipt.projectionId !== LEGACY_FOUR_PREREQUISITE_PROJECTION_ID
    && receipt.projectionId !== LEGACY_FOUR_PREREQUISITE_PUBLICATION_ID;
}

export function projectPublishedTeachingRelations(input: {
  artifacts: ActTeachingProjectionArtifacts | null;
  authority: ActTeachingAuthorityIdentity;
  scopeHash: string;
  domainId: RegisteredPeerDomainId;
}): AuthorityShardRelation[] {
  if (!input.artifacts) return [];
  if (!teachingProjectionMatchesEnvelope(input)) return [];
  return input.artifacts.edges
    .filter((edge) => edge.domainKeys.includes(input.domainId))
    .map((edge) => ({
      id: edge.edgeId,
      predicate: edge.relationType,
      sourceId: edge.sourceCanonicalId,
      targetId: edge.targetCanonicalId,
      direction: edge.direction,
      direct: true,
      qualityTier: 'GOLD',
      governance: {
        reviewStatus: null,
        publicationStatus: 'published',
      },
      semanticSupport: { supported: true, readOnly: true as const },
      layer: TEACHING_LAYER,
      relationFamily: FAMILY_PRESENTATION[edge.family],
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function publicTeachingCoverage(input: {
  artifacts: ActTeachingProjectionArtifacts | null;
  authority: ActTeachingAuthorityIdentity;
  scopeHash: string;
  domainId: RegisteredPeerDomainId;
}): AuthorityShardTeachingCoverage {
  const matched = input.artifacts
    && teachingProjectionMatchesEnvelope(input);
  const relationCount = matched
    ? input.artifacts!.edges.filter((edge) => edge.domainKeys.includes(input.domainId)).length
    : 0;
  return {
    status: !matched ? 'unavailable' : relationCount > 0 ? 'partial' : 'empty',
    domainId: input.domainId,
    relationCount,
    coreNodeCount: 0,
    uncoveredCoreNodeCount: 0,
    note: !matched
      ? '教学关系暂不可用'
      : relationCount > 0
        ? '已发布部分教学关系'
        : '该领域尚无已发布的教学关系',
  };
}

export function runtimeResponseLeaksGovernance(value: unknown): boolean {
  const json = JSON.stringify(value);
  return [
    'PENDING_REVIEW',
    'reviewPack',
    'pendingCount',
    'confidence',
    'reviewerId',
    'candidateId',
    '"PARTIAL"',
    'packHash',
  ].some((token) => json.includes(token));
}
