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
import type { PublicLocaleCapability } from '@/lib/authority-locale-readiness/contracts';
import type {
  GovernedFormulaProjection,
  GovernedRichTextProjection,
} from '@/lib/governed-math';

export const AUTHORITY_SHARD_ENVELOPE_CONTRACT =
  'act-authority-shard-envelope/v1' as const;
export const AUTHORITY_SHARD_SET_CONTRACT =
  'act-authority-domain-shard-set/v1' as const;
export const AUTHORITY_SHARD_CURRENT_CONTRACT =
  'act-authority-domain-shard-current/v1' as const;
export const AUTHORITY_SHARD_BUILDER_VERSION =
  'act-authority-domain-shard-builder/v2' as const;

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
  'prerequisite-order',
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
  'domain-default': 512 * 1024,
  'relation-family': 2 * 1024 * 1024,
  'node-neighborhood': 128 * 1024,
  'node-detail': 64 * 1024,
  'domain-search-index': 512 * 1024,
} as const;

export const AUTHORITY_SHARD_NEIGHBORHOOD_LIMIT = 32;

/**
 * Fail-closed object-count ceiling for one domain-default overview (#1738).
 * Observed v0.37 maximum is 273 DomainConcept members; exceeding this limit
 * fails qualification instead of silently shipping a larger overview.
 */
export const AUTHORITY_DOMAIN_DEFAULT_OBJECT_LIMIT = 320;

/**
 * The domain default is a concept overview only. Secondary types stay
 * reachable through the sealed search index and published one-hop shards.
 */
export const AUTHORITY_DOMAIN_DEFAULT_TYPES = ['DomainConcept'] as const;
export type AuthorityDomainDefaultObjectType =
  (typeof AUTHORITY_DOMAIN_DEFAULT_TYPES)[number];

/** Server-side search paging ceiling for one domain-search response. */
export const AUTHORITY_DOMAIN_SEARCH_PAGE_LIMIT = 24;

/** Minimum non-empty query length before a bounded search is issued. */
export const AUTHORITY_DOMAIN_SEARCH_MIN_QUERY_CHARS = 1;

export const AUTHORITY_DOMAIN_SEARCH_CONTRACT =
  'act-authority-domain-search/v1' as const;
export const AUTHORITY_SHARD_COVERAGE_CONTRACT =
  'act-authority-shard-coverage/v1' as const;

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
  localeProfileVersion: string;
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
  /** Complete-locale type term; omitted on sealed historical shards. */
  typeLabel?: string | null;
  richTitle?: GovernedRichTextProjection;
  richDescription?: GovernedRichTextProjection;
  searchText?: string;
  accessibleName?: string;
  /** Bounded governed formula projection for materialized Formula objects (#1740). */
  mathematics?: GovernedFormulaProjection;
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
  strength?: 'REQUIRED' | 'RECOMMENDED' | null;
  qualityTier: string;
  governance: {
    reviewStatus: string | null;
    publicationStatus: string | null;
  };
  semanticSupport: { supported: boolean; readOnly: true };
  layer: AuthorityRelationLayer;
  relationFamily:
    | EngineeringRelationFamily
    | 'teaching-prerequisite'
    | 'teaching-containment'
    | 'teaching-association'
    | null;
  /** Complete-locale relation term; omitted on sealed historical shards. */
  predicateLabel?: string | null;
  /** Complete-locale direction term; omitted on sealed historical shards. */
  directionLabel?: string | null;
}

export interface AuthorityShardBoundaryRef {
  canonicalId: string;
  label: string;
  /** Localized search/detail aliases when the boundary is materialized. */
  aliases?: readonly string[];
  canonicalType: string;
  adjacentDomainIds: readonly RegisteredPeerDomainId[];
  typeLabel?: string | null;
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
  teachingBoundaryObjects?: readonly AuthorityShardObject[];
  teachingBoundaries?: readonly AuthorityShardBoundaryRef[];
  teachingCoverage: AuthorityShardTeachingCoverage;
}

/**
 * Identity-safe per-domain search rows for every catalog member (#1738).
 * Internal sealed artifact: served only through the bounded domain-search
 * API projection, never returned wholesale to the browser.
 */
export interface AuthorityDomainSearchIndexShard {
  shardClass: 'domain-search-index';
  envelope: AuthorityShardEnvelope;
  domainId: RegisteredPeerDomainId;
  entries: readonly AuthorityDomainSearchEntry[];
}

/** One searchable member row; labels and aliases only, no descriptions. */
export interface AuthorityDomainSearchEntry {
  id: string;
  canonicalType: string;
  label: string;
  aliases: readonly string[];
  memberships: readonly AuthorityShardMembership[];
}

export interface AuthorityDomainSearchHit extends AuthorityDomainSearchEntry {
  typeLabel?: string | null;
  /** Bounded governed formula projection for Formula hits (#1740). */
  mathematics?: GovernedFormulaProjection;
}

/** Bounded, version-matched search response returned by the search API. */
export interface AuthorityDomainSearchResponse {
  contract: typeof AUTHORITY_DOMAIN_SEARCH_CONTRACT;
  envelope: AuthorityShardPublicEnvelope;
  domainId: RegisteredPeerDomainId;
  query: string;
  canonicalType: string | null;
  page: number;
  pageSize: number;
  total: number;
  hits: readonly AuthorityDomainSearchHit[];
}

/** Per-domain coverage statistics recorded in the sealed coverage receipt. */
export interface AuthorityShardCoverageDomain {
  domainId: RegisteredPeerDomainId;
  catalogMemberCount: number;
  overviewObjectCount: number;
  overviewTypes: readonly string[];
  searchEntryCount: number;
  teachingRelationCount: number;
}

/**
 * Sealed candidate gate (#1738): catalog denominator, per-domain overview
 * budgets, search coverage and follow-on closure under one shard-set
 * identity. Root entries may only be published when every recorded domain
 * has its default, search, neighborhood and detail closure.
 */
export interface AuthorityShardCoverageReceipt {
  shardClass: 'coverage-receipt';
  contract: typeof AUTHORITY_SHARD_COVERAGE_CONTRACT;
  builderVersion: typeof AUTHORITY_SHARD_BUILDER_VERSION;
  envelope: AuthorityShardEnvelope;
  catalogDomainCount: number;
  defaultShardCount: number;
  searchIndexCount: number;
  domains: readonly AuthorityShardCoverageDomain[];
  closure: {
    catalogMemberCount: number;
    neighborhoodCount: number;
    detailCount: number;
    /** Every catalog member owns a neighborhood and detail shard. */
    complete: boolean;
  };
  /**
   * Node-detail source provenance (#2043). Absence of a governed mapping
   * ledger input stays visible here instead of being silently implied by
   * empty shard sources.
   */
  sourceCitations: {
    ledgerProvided: boolean;
    ledgerContract: string | null;
    nodesWithSources: number;
    nodesCappedToLimit: number;
    snapshotSourceMappingsPreserved: number;
  };
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
    /** Complete-locale type term; omitted on sealed historical shards. */
    typeLabel?: string | null;
    richTitle?: GovernedRichTextProjection;
    richDescription?: GovernedRichTextProjection;
    searchText?: string;
    accessibleName?: string;
    mathematics?: GovernedFormulaProjection;
    sources: Array<{ sourceEditionId: string; sectionId: string; label?: string | null }>;
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

export type PublicAuthorityRootShard = PublicAuthorityShard<AuthorityRootShard> & {
  localeCapability?: PublicLocaleCapability;
};
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
    searchIndex: number;
    coverage: 1;
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
