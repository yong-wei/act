/**
 * Layered knowledge graph payload contracts (#1273).
 *
 * Engineering Authority, ACT teaching prerequisites, and teaching resource
 * bindings are independent layers with their own identities and statuses.
 * Layers must never be silently mixed across versions.
 */

import type {
  AuthorityEngineeringObject,
  AuthorityEngineeringRelation,
  AuthoritySnapshotManifest,
} from '@/lib/authoritative-knowledge/authority-snapshot';
import type {
  PrerequisiteStrength,
  TeachingBindingRuntime,
  TeachingCardIndexEntry,
  TeachingCoreNodeRuntime,
  TeachingPrerequisiteRuntime,
  TeachingProjectionManifest,
  TeachingProjectionRole,
  TeachingResourceRuntime,
  TeachingResourceType,
} from '@/lib/teaching-projection/contracts';

export const LAYERED_GRAPH_PAYLOAD_CONTRACT =
  'act-layered-graph-payload/v1' as const;

export const LAYERED_GRAPH_LAYER_KINDS = [
  'engineering',
  'teachingPrerequisites',
  'teachingResources',
] as const;

export type LayeredGraphLayerKind = (typeof LAYERED_GRAPH_LAYER_KINDS)[number];

/**
 * Per-layer readiness. Absent layers stay absent; failed identity checks fail
 * closed for that layer only.
 */
export const LAYERED_GRAPH_LAYER_STATUSES = [
  'ready',
  'absent',
  'NOT_PROJECTED',
  'unavailable',
  'identity-drift',
  'fallback',
] as const;

export type LayeredGraphLayerStatus =
  (typeof LAYERED_GRAPH_LAYER_STATUSES)[number];

export const LAYERED_GRAPH_FALLBACK_KINDS = [
  'legacy',
  'pinned-previous',
  'none',
] as const;

export type LayeredGraphFallbackKind =
  (typeof LAYERED_GRAPH_FALLBACK_KINDS)[number];

export interface LayeredGraphLayerIdentity {
  layer: LayeredGraphLayerKind;
  status: LayeredGraphLayerStatus;
  /** Authority release identity when known. */
  authorityReleaseId: string | null;
  authoritySnapshotId: string | null;
  authoritySnapshotHash: string | null;
  /** Teaching Projection identity when known. */
  projectionId: string | null;
  projectionHash: string | null;
  /** Course/package/lesson scope for teaching layers. */
  scopeId: string | null;
  /** Explicit reasons for absent/unavailable/fallback. */
  reasons: string[];
}

export interface LayeredGraphFallbackProvenance {
  kind: LayeredGraphFallbackKind;
  /** Named adapter, e.g. legacy-runtime or pinned-previous-projection. */
  adapterId: string;
  authorityReleaseId: string | null;
  projectionId: string | null;
  projectionHash: string | null;
  scopeId: string | null;
  reasons: string[];
}

export interface EngineeringGraphLayer {
  identity: LayeredGraphLayerIdentity;
  nodes: AuthorityEngineeringObject[];
  relations: AuthorityEngineeringRelation[];
  /** Exact engineering predicates retained for consumers. */
  predicates: string[];
}

export interface TeachingPrerequisiteEdge {
  prerequisiteId: string;
  sourceCanonicalId: string;
  targetCanonicalId: string;
  strength: PrerequisiteStrength;
  scopeId: string | null;
  evidenceRef: string | null;
  rationale: string | null;
}

export interface TeachingPrerequisitesLayer {
  identity: LayeredGraphLayerIdentity;
  edges: TeachingPrerequisiteEdge[];
}

export interface TeachingResourceBindingView {
  bindingId: string;
  resourceId: string;
  canonicalId: string;
  role: TeachingProjectionRole;
  scopeId: string;
  primary: boolean;
  resourceType: TeachingResourceType | null;
  resourceTitle: string | null;
  projectionMode: TeachingResourceRuntime['projectionMode'] | null;
  sourcePath: string | null;
}

export interface TeachingResourcesLayer {
  identity: LayeredGraphLayerIdentity;
  resources: TeachingResourceRuntime[];
  bindings: TeachingResourceBindingView[];
  coreNodes: TeachingCoreNodeRuntime[];
  cards: TeachingCardIndexEntry[];
  /**
   * Canonical IDs present in Authority but without a teaching binding in the
   * active scope. Status only — never implies an upstream graph defect.
   */
  notProjectedCanonicalIds: string[];
}

/**
 * Full layered graph payload. Each layer may be ready, absent, NOT_PROJECTED,
 * unavailable, identity-drift, or fallback independently.
 */
export interface LayeredGraphPayload {
  contract: typeof LAYERED_GRAPH_PAYLOAD_CONTRACT;
  engineering: EngineeringGraphLayer;
  teachingPrerequisites: TeachingPrerequisitesLayer;
  teachingResources: TeachingResourcesLayer;
  /** Explicit fallback provenance when any teaching layer uses fallback. */
  fallback: LayeredGraphFallbackProvenance | null;
  /** Requested course/lesson/step scope used for teaching layers. */
  requestedScope: LayeredGraphScope | null;
}

export interface LayeredGraphScope {
  /** Package or course scope id (projection scopeId). */
  scopeId: string;
  lessonKey?: string | null;
  stepId?: string | null;
  /** Optional step knowledge refs already resolved to Canonical IDs. */
  knowledgeRefs?: readonly string[];
}

export interface LayeredGraphResolveRequest {
  scope?: LayeredGraphScope | null;
  /**
   * When true, teaching layers are requested. Engineering always loads
   * independently when Authority is available.
   */
  includeTeaching?: boolean;
  /**
   * Optional pin used when the active/candidate projection is unavailable.
   */
  pinnedProjectionId?: string | null;
  pinnedProjectionHash?: string | null;
  /**
   * When set, require this Authority release identity for teaching projection
   * matching. Mismatch fails closed for teaching layers only.
   */
  requiredAuthorityReleaseId?: string | null;
  /**
   * Explicit candidate projection id (shadow/read-only). When missing and no
   * active projection, fall back to pin or Legacy.
   */
  candidateProjectionId?: string | null;
  /** When true, allow named Legacy fallback adapter. */
  allowLegacyFallback?: boolean;
}

export interface LayeredGraphAuthorityInput {
  status: 'ready' | 'unavailable';
  releaseId: string | null;
  releaseSetId: string | null;
  snapshotId: string | null;
  snapshotHash: string | null;
  engineering: {
    objects: AuthorityEngineeringObject[];
    relations: AuthorityEngineeringRelation[];
  } | null;
  manifest?: AuthoritySnapshotManifest | null;
  reason?: string;
}

export interface LayeredGraphProjectionInput {
  status:
    | 'ready'
    | 'absent'
    | 'NOT_PROJECTED'
    | 'unavailable'
    | 'identity-drift'
    | 'fallback';
  source: 'active' | 'candidate' | 'pinned' | 'legacy' | 'none';
  projectionId: string | null;
  projectionHash: string | null;
  authorityReleaseId: string | null;
  scopeId: string | null;
  manifest?: TeachingProjectionManifest | null;
  resources: TeachingResourceRuntime[];
  bindings: TeachingBindingRuntime[];
  prerequisites: TeachingPrerequisiteRuntime[];
  coreNodes: TeachingCoreNodeRuntime[];
  cards: TeachingCardIndexEntry[];
  notProjectedCanonicalIds: string[];
  reasons: string[];
  fallback?: LayeredGraphFallbackProvenance | null;
}

/** Inspector evidence group for a selected Canonical node. */
export interface LayeredNodeInspectorSections {
  canonicalId: string;
  engineering: {
    present: boolean;
    node: AuthorityEngineeringObject | null;
    relations: AuthorityEngineeringRelation[];
  };
  teachingPrerequisites: {
    status: LayeredGraphLayerStatus;
    incoming: TeachingPrerequisiteEdge[];
    outgoing: TeachingPrerequisiteEdge[];
  };
  teachingResources: {
    status: LayeredGraphLayerStatus | 'NOT_PROJECTED';
    bindings: TeachingResourceBindingView[];
    cards: TeachingCardIndexEntry[];
    optionalCardStatus: 'active' | 'absent' | 'inactive' | 'not-applicable';
  };
  fallback: LayeredGraphFallbackProvenance | null;
  projectionIdentity: {
    projectionId: string | null;
    projectionHash: string | null;
    scopeId: string | null;
    authorityReleaseId: string | null;
  };
}

export type LayerFilterMode =
  | 'engineering-only'
  | 'teaching-only'
  | 'resources-only'
  | 'mixed'
  | 'all';

export interface LayeredGraphWorkspaceFilterState {
  mode: LayerFilterMode;
  showEngineering: boolean;
  showTeachingPrerequisites: boolean;
  showTeachingResources: boolean;
  engineeringPredicateFilter: readonly string[] | null;
}
