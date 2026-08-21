/**
 * Authority domain display catalog contracts (#1369).
 *
 * Reviewed human navigation projection bound to one Authority selection.
 * Presentation artifact only — never mutates ActKG engineering facts.
 */

export const AUTHORITY_DOMAIN_CATALOG_AUTHORING_CONTRACT =
  'act-authority-domain-display-catalog-authoring/v1' as const;
export const AUTHORITY_DOMAIN_CATALOG_RUNTIME_CONTRACT =
  'act-authority-domain-display-catalog-runtime/v1' as const;
export const AUTHORITY_DOMAIN_CATALOG_CURRENT_CONTRACT =
  'act-authority-domain-display-catalog-current/v1' as const;
export const AUTHORITY_DOMAIN_CATALOG_BUILDER_VERSION =
  'act-authority-domain-display-catalog-builder/v1' as const;

export const DEFAULT_AUTHORITY_DOMAIN_CATALOG_AUTHORING_RELATIVE =
  'course-content/authoring/knowledge/authority-domain-catalog' as const;
export const DEFAULT_AUTHORITY_DOMAIN_CATALOG_RUNTIME_RELATIVE =
  'course-content/runtime/knowledge/authority-domain-catalog' as const;

/**
 * Peer domain IDs currently served by the v0.9 production catalog. This list
 * is production data, not a size invariant: candidate catalogs derive their
 * domain entries from the bound release envelope.
 */
export const REGISTERED_PEER_DOMAIN_IDS = [
  'system-modeling',
  'time-domain-analysis',
  'stability-analysis',
  'frequency-domain-analysis',
  'root-locus',
  'classical-control-design',
  'discrete-time-control-analysis',
  'state-space-control-analysis-and-design',
] as const;

const PEER_DOMAIN_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

export type RegisteredPeerDomainId = string;

/** Aggregate navigation entry — not a peer domain. */
export const AGGREGATE_ENTRY_ID = 'control-theory-integration' as const;
export type AggregateEntryId = typeof AGGREGATE_ENTRY_ID;

export const PRESENTATION_ROLES = ['domain', 'aggregate'] as const;
export type PresentationRole = (typeof PRESENTATION_ROLES)[number];

export const DOMAIN_VISUAL_ROLES = [
  'modeling',
  'time',
  'stability',
  'frequency',
  'root-locus',
  'design',
  'discrete',
  'state-space',
  'nonlinear-analysis',
  'lyapunov',
  'discrete-design',
  'robustness',
  'optimal',
  'robust-design',
  'nonlinear-design',
  'aggregate',
] as const;
export type DomainVisualRole = (typeof DOMAIN_VISUAL_ROLES)[number];

export interface AuthorityCatalogBinding {
  snapshotId: string;
  snapshotHash: string;
  releaseId: string;
  releaseSetId?: string | null;
}

export interface DomainPresentationAuthoring {
  domainId: RegisteredPeerDomainId;
  order: number;
  displayName: string;
  summary: string;
  presentationRole: 'domain';
  visualRole: Exclude<DomainVisualRole, 'aggregate'>;
}

export interface AggregatePresentationAuthoring {
  entryId: AggregateEntryId;
  order: number;
  displayName: string;
  summary: string;
  presentationRole: 'aggregate';
  visualRole: 'aggregate';
}

export interface DomainMembershipAuthoring {
  /** Canonical Authority object identity (server-private in presentation DTOs). */
  canonicalId: string;
  /** Reviewed many-to-many membership; must be registered peer domains. */
  domainIds: readonly RegisteredPeerDomainId[];
  /** Deterministic preferred navigation domain; must be one of domainIds. */
  preferredDomainId: RegisteredPeerDomainId;
}

export interface AuthorityDomainCatalogAuthoring {
  contract: typeof AUTHORITY_DOMAIN_CATALOG_AUTHORING_CONTRACT;
  catalogVersion: string;
  reviewStatus: 'reviewed' | 'draft';
  authorityBinding: AuthorityCatalogBinding;
  domains: readonly DomainPresentationAuthoring[];
  aggregate: AggregatePresentationAuthoring;
  memberships: readonly DomainMembershipAuthoring[];
}

export interface DomainPresentationRuntime {
  domainId: RegisteredPeerDomainId;
  order: number;
  displayName: string;
  summary: string;
  presentationRole: 'domain';
  visualRole: Exclude<DomainVisualRole, 'aggregate'>;
  memberCount: number;
}

export interface AggregatePresentationRuntime {
  entryId: AggregateEntryId;
  order: number;
  displayName: string;
  summary: string;
  presentationRole: 'aggregate';
  visualRole: 'aggregate';
  /** Peer domain count of this catalog; never includes the aggregate entry. */
  domainCount: number;
}

/**
 * Server-private membership mapping. Canonical IDs stay here and must not enter
 * product presentation DTOs.
 */
export interface DomainMembershipRuntime {
  canonicalId: string;
  domainIds: readonly RegisteredPeerDomainId[];
  preferredDomainId: RegisteredPeerDomainId;
}

export interface AuthorityDomainCatalogRuntime {
  contract: typeof AUTHORITY_DOMAIN_CATALOG_RUNTIME_CONTRACT;
  catalogId: string;
  catalogHash: string;
  catalogVersion: string;
  builderVersion: typeof AUTHORITY_DOMAIN_CATALOG_BUILDER_VERSION;
  authorityBinding: {
    snapshotId: string;
    snapshotHash: string;
    releaseId: string;
    releaseSetId: string | null;
  };
  domains: readonly DomainPresentationRuntime[];
  aggregate: AggregatePresentationRuntime;
  /** Server-private mapping only. */
  memberships: readonly DomainMembershipRuntime[];
}

export interface AuthorityDomainCatalogCurrentPointer {
  contract: typeof AUTHORITY_DOMAIN_CATALOG_CURRENT_CONTRACT;
  catalogId: string;
  catalogHash: string;
  snapshotId: string;
  snapshotHash: string;
  releaseId: string;
  activatedAt: string;
}

/**
 * Product-facing root DTO: human text, controlled presentation metadata, counts.
 * Excludes Authority object/relation/node/edge counts and canonical IDs.
 */
export interface DomainRootPresentationEntry {
  kind: 'presentation-domain';
  order: number;
  displayName: string;
  summary: string;
  presentationRole: 'domain';
  visualRole: Exclude<DomainVisualRole, 'aggregate'>;
  memberCount: number;
}

export interface AggregateRootPresentationEntry {
  kind: 'presentation-aggregate';
  order: number;
  displayName: string;
  summary: string;
  presentationRole: 'aggregate';
  visualRole: 'aggregate';
  domainCount: number;
}

export interface AuthorityDomainRootPresentation {
  kind: 'presentation-root-catalog';
  domains: readonly DomainRootPresentationEntry[];
  aggregate: AggregateRootPresentationEntry;
}

export interface AuthorityNodeEndpoint {
  canonicalId: string;
}

export function isRegisteredPeerDomainId(value: string): value is RegisteredPeerDomainId {
  return PEER_DOMAIN_ID.test(value) && value !== AGGREGATE_ENTRY_ID;
}

export function isAggregateEntryId(value: string): value is AggregateEntryId {
  return value === AGGREGATE_ENTRY_ID;
}
