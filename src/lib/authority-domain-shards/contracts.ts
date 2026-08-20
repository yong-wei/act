/**
 * Versioned Authority domain shard contracts (#1375).
 *
 * Runtime product path reads only these small artifacts. Root and
 * domain-default resolvers never open engineering.json.
 */

import type {
  AggregateRootPresentationEntry,
  DomainRootPresentationEntry,
  DomainVisualRole,
  RegisteredPeerDomainId,
} from '@/lib/authority-domain-catalog/contracts';
import type { TeachingCoverageState } from '@/lib/teaching-projection/domain-fragments/contracts';

export const AUTHORITY_SHARD_ENVELOPE_CONTRACT =
  'act-authority-shard-envelope/v1' as const;
export const AUTHORITY_SHARD_SET_CONTRACT =
  'act-authority-domain-shard-set/v1' as const;
export const AUTHORITY_SHARD_CURRENT_CONTRACT =
  'act-authority-domain-shard-current/v1' as const;
export const AUTHORITY_SHARD_BUILDER_VERSION =
  'act-authority-domain-shard-builder/v1' as const;

export const DEFAULT_AUTHORITY_DOMAIN_SHARD_RUNTIME_RELATIVE =
  'course-content/runtime/knowledge/authority-domain-shards' as const;

export const AUTHORITY_SHARD_CLASSES = [
  'root',
  'domain-default',
  'relation-family',
  'node-neighborhood',
  'node-detail',
] as const;

export type AuthorityShardClass = (typeof AUTHORITY_SHARD_CLASSES)[number];

export const ENGINEERING_RELATION_FAMILIES = [
  'structure',
  'derivation-and-representation',
  'application-and-analysis',
  'association',
] as const;

export type EngineeringRelationFamily =
  (typeof ENGINEERING_RELATION_FAMILIES)[number];

export const ENGINEERING_LAYER = 'ENGINEERING' as const;
export const TEACHING_LAYER = 'ACT_TEACHING' as const;
export type AuthorityRelationLayer =
  | typeof ENGINEERING_LAYER
  | typeof TEACHING_LAYER;

export const AUTHORITY_SHARD_PAYLOAD_BUDGETS = {
  root: 64 * 1024,
  'domain-default': 2 * 1024 * 1024,
  'relation-family': 2 * 1024 * 1024,
  'node-neighborhood': 128 * 1024,
  'node-detail': 64 * 1024,
} as const;

export const AUTHORITY_SHARD_NEIGHBORHOOD_LIMIT = 32;

export interface AuthorityShardAuthorityIdentity {
  snapshotId: string;
  snapshotHash: string;
  releaseId: string;
  releaseSetId: string;
  activationId: string;
  activationHash: string;
  /** Engineering-graph has no Teaching Projection selector. */
  projectionId: null;
  projectionHash: null;
}

export interface AuthorityShardCatalogIdentity {
  catalogId: string;
  catalogHash: string;
  catalogVersion: string;
}

export interface AuthorityShardTeachingIdentity {
  status: TeachingCoverageState;
  projectionId: string | null;
  projectionHash: string | null;
  teachingCacheFamily: string | null;
}

export interface AuthorityShardEnvelope {
  contract: typeof AUTHORITY_SHARD_ENVELOPE_CONTRACT;
  authority: AuthorityShardAuthorityIdentity;
  catalog: AuthorityShardCatalogIdentity;
  teaching: AuthorityShardTeachingIdentity;
  match: {
    authority: true;
    catalog: true;
    teaching: boolean | null;
  };
}

/**
 * Browser transport identity. The composite Authority/catalog and optional
 * Teaching bindings are represented by derived version tokens so normal
 * learner responses never serialize activation, release, snapshot, catalog
 * or projection identifiers.
 */
export interface AuthorityShardPublicEnvelope {
  contract: typeof AUTHORITY_SHARD_ENVELOPE_CONTRACT;
  authorityCatalogVersion: string;
  teachingVersion: string | null;
  match: {
    authority: true;
    catalog: true;
    teaching: boolean | null;
  };
}

export interface AuthorityShardObject {
  id: string;
  canonicalType: string;
  label: string;
  /** Localized search/detail aliases; never used as identity. */
  aliases: readonly string[];
  description: string | null;
  governance: {
    reviewStatus: string | null;
    publicationStatus: string | null;
    lifecycleStatus: string | null;
  };
  semanticSupport: { supported: boolean; readOnly: true };
  memberships: readonly AuthorityShardMembership[];
  conceptKind?: string | null;
}

export interface AuthorityShardMembership {
  domainId: RegisteredPeerDomainId;
  visualRole: Exclude<DomainVisualRole, 'aggregate'>;
  preferred: boolean;
}

export interface AuthorityShardRelation {
  id: string;
  predicate: string;
  sourceId: string;
  targetId: string;
  direction: string | null;
  direct: boolean | null;
  qualityTier: string;
  governance: {
    reviewStatus: string | null;
    publicationStatus: string | null;
  };
  semanticSupport: { supported: boolean; readOnly: true };
  layer: AuthorityRelationLayer;
  relationFamily: EngineeringRelationFamily | 'teaching-prerequisite' | null;
}

export interface AuthorityShardBoundaryRef {
  canonicalId: string;
  label: string;
  /** Localized search/detail aliases when the boundary is materialized. */
  aliases?: readonly string[];
  canonicalType: string;
  adjacentDomainIds: readonly RegisteredPeerDomainId[];
}

export interface AuthorityShardTeachingCoverage {
  status: TeachingCoverageState;
  domainId: RegisteredPeerDomainId;
  relationCount: number;
  coreNodeCount: number;
  uncoveredCoreNodeCount: number;
  note: string;
}

export interface AuthorityRootShard {
  shardClass: 'root';
  envelope: AuthorityShardEnvelope;
  root: {
    kind: 'presentation-root-catalog';
    domains: readonly DomainRootPresentationEntry[];
    aggregate: AggregateRootPresentationEntry;
  };
}

export interface AuthorityDomainDefaultShard {
  shardClass: 'domain-default';
  envelope: AuthorityShardEnvelope;
  domainId: RegisteredPeerDomainId;
  visualRole: Exclude<DomainVisualRole, 'aggregate'>;
  objects: readonly AuthorityShardObject[];
  teachingRelations: readonly AuthorityShardRelation[];
  teachingCoverage: AuthorityShardTeachingCoverage;
}

export interface AuthorityRelationFamilyShard {
  shardClass: 'relation-family';
  envelope: AuthorityShardEnvelope;
  domainId: RegisteredPeerDomainId;
  family: EngineeringRelationFamily;
  objects: readonly AuthorityShardObject[];
  relations: readonly AuthorityShardRelation[];
  boundaries: readonly AuthorityShardBoundaryRef[];
}

export interface AuthorityNodeNeighborhoodShard {
  shardClass: 'node-neighborhood';
  envelope: AuthorityShardEnvelope;
  nodeId: string;
  limit: number;
  truncated: boolean;
  objects: readonly AuthorityShardObject[];
  relations: readonly AuthorityShardRelation[];
  boundaries: readonly AuthorityShardBoundaryRef[];
}

export interface AuthorityNodeDetailShard {
  shardClass: 'node-detail';
  envelope: AuthorityShardEnvelope;
  node: {
    id: string;
    canonicalType: string;
    label: string;
    /** Localized search/detail aliases; never used as identity. */
    aliases?: readonly string[];
    description: string | null;
    teachingFields: Record<string, unknown>;
    governance: {
      reviewStatus: string | null;
      publicationStatus: string | null;
      lifecycleStatus: string | null;
    };
    sources: Array<{ sourceEditionId: string; sectionId: string }>;
    media: {
      cardAvailable: false;
      infographAvailable: false;
    };
    /**
     * Filled only by the authenticated node-detail API. Immutable shard bytes
     * deliberately contain no card body or media locator.
     */
    learningContent?: AuthorityNodeLearningContent;
    semanticSupport: { supported: boolean; readOnly: true };
  };
}

export type AuthorityLearningCard =
  | {
    state: 'available';
    summary: string;
    insight: string | null;
    explanation: string | null;
  }
  | {
    state: 'missing' | 'blocked' | 'unavailable';
    message: string;
  };

export type AuthorityLearningInfograph =
  | {
    state: 'available';
    alternativeText: string;
  }
  | {
    state: 'missing' | 'unavailable';
    message: string;
  };

/** Learner-safe, selection-bound supplement to a sealed node-detail shard. */
export interface AuthorityNodeLearningContent {
  card: AuthorityLearningCard;
  infograph: AuthorityLearningInfograph;
}

export type AuthorityLearnerShard =
  | AuthorityRootShard
  | AuthorityDomainDefaultShard
  | AuthorityRelationFamilyShard
  | AuthorityNodeNeighborhoodShard
  | AuthorityNodeDetailShard;

export type PublicAuthorityShard<T extends { envelope: AuthorityShardEnvelope }> =
  Omit<T, 'envelope'> & { envelope: AuthorityShardPublicEnvelope };

export type PublicAuthorityRootShard = PublicAuthorityShard<AuthorityRootShard>;
export type PublicAuthorityDomainDefaultShard = PublicAuthorityShard<AuthorityDomainDefaultShard>;
export type PublicAuthorityRelationFamilyShard = PublicAuthorityShard<AuthorityRelationFamilyShard>;
export type PublicAuthorityNodeNeighborhoodShard = PublicAuthorityShard<AuthorityNodeNeighborhoodShard>;
export type PublicAuthorityNodeDetailShard = PublicAuthorityShard<AuthorityNodeDetailShard>;

export type PublicAuthorityLearnerShard =
  | PublicAuthorityRootShard
  | PublicAuthorityDomainDefaultShard
  | PublicAuthorityRelationFamilyShard
  | PublicAuthorityNodeNeighborhoodShard
  | PublicAuthorityNodeDetailShard;

export interface AuthorityShardSetManifest {
  contract: typeof AUTHORITY_SHARD_SET_CONTRACT;
  builderVersion: typeof AUTHORITY_SHARD_BUILDER_VERSION;
  shardSetId: string;
  shardSetHash: string;
  envelope: AuthorityShardEnvelope;
  files: Record<string, string>;
  counts: {
    root: 1;
    domainDefault: number;
    relationFamily: number;
    neighborhood: number;
    detail: number;
  };
}

export interface AuthorityShardCurrentPointer {
  contract: typeof AUTHORITY_SHARD_CURRENT_CONTRACT;
  shardSetId: string;
  shardSetHash: string;
  snapshotId: string;
  snapshotHash: string;
  releaseId: string;
  catalogId: string;
  catalogHash: string;
  teachingProjectionId: string | null;
  teachingProjectionHash: string | null;
  activatedAt: string;
}

export function isEngineeringRelationFamily(
  value: string,
): value is EngineeringRelationFamily {
  return (ENGINEERING_RELATION_FAMILIES as readonly string[]).includes(value);
}

export function isAuthorityShardClass(
  value: string,
): value is AuthorityShardClass {
  return (AUTHORITY_SHARD_CLASSES as readonly string[]).includes(value);
}

export function relationCacheKey(relation: Pick<AuthorityShardRelation, 'layer' | 'id'>): string {
  return `${relation.layer}:${relation.id}`;
}
