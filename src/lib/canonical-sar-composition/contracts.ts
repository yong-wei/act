/**
 * Canonical SAR composition contracts (#1114).
 *
 * Query-time composition over five authority domains. Results are
 * reconstructable candidate projections only — never a mixed-graph truth,
 * never a source mutation surface, never production authority before #1117.
 */

import {
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
} from '@/lib/authoritative-knowledge/contracts';
import { AGGREGATE_COURSE_COVERAGE_OVERLAY_ID } from '@/lib/aggregate-governance/contracts';

export const CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION =
  'act-canonical-sar-composition/v1' as const;
export const CANONICAL_SAR_CONSUMER_ID = 'canonical-sar-composition' as const;
export const SAR_CUTOVER_AUTHORITY_SCHEMA_VERSION =
  'act-sar-cutover-authority/v1' as const;

/** Pinned aggregate identity reused from #1125/#1126/#1113. */
export const PINNED_SAR_AGGREGATE_RELEASE_SET_ID = CURRENT_AGGREGATE_RELEASE_SET_ID;
export const PINNED_SAR_AGGREGATE_RELEASE_ID = CURRENT_AGGREGATE_RELEASE_ID;
export const PINNED_SAR_COVERAGE_OVERLAY_ID = AGGREGATE_COURSE_COVERAGE_OVERLAY_ID;

// ─── Source namespaces ───────────────────────────────────────────────────────

export const SAR_SOURCE_NAMESPACES = [
  'repository',
  'kaq',
  'resource',
  'path',
  'learner-state',
] as const;

export type SarSourceNamespace = (typeof SAR_SOURCE_NAMESPACES)[number];

export const SAR_AUTHORITY_OWNERS = {
  repository: 'AuthoritativeKnowledgeRepository',
  kaq: 'ActKaqOverlay',
  resource: 'ActResourceGovernance',
  path: 'ActPathOverlay',
  'learner-state': 'ActLearnerStateOverlay',
} as const satisfies Record<SarSourceNamespace, string>;

export type SarAuthorityOwner =
  (typeof SAR_AUTHORITY_OWNERS)[SarSourceNamespace];

// ─── Authority selector ──────────────────────────────────────────────────────

export type SarAuthorityMode = 'LEGACY' | 'CANONICAL_SHADOW' | 'CANONICAL';

export type SarAuthorityConsumer =
  | 'PRODUCTION_RETRIEVAL'
  | 'SHADOW_COMPARISON'
  | 'OFFLINE_EVAL'
  | 'PIPELINE_READINESS'
  | 'CUTOVER_ACTIVATION';

export type SarAuthoritySelector =
  | {
      consumer: 'PRODUCTION_RETRIEVAL';
      authority: 'LEGACY';
      productionAuthoritative: true;
      canonicalCompositionVisible: false;
      allowsLegacyFallback: true;
    }
  | {
      consumer: 'SHADOW_COMPARISON' | 'OFFLINE_EVAL' | 'PIPELINE_READINESS';
      authority: 'CANONICAL_SHADOW';
      productionAuthoritative: false;
      canonicalCompositionVisible: true;
      allowsLegacyFallback: false;
    }
  | {
      consumer: 'CUTOVER_ACTIVATION';
      authority: 'CANONICAL';
      productionAuthoritative: true;
      canonicalCompositionVisible: true;
      allowsLegacyFallback: false;
      cutoverReceiptId: string;
    };

export interface SarCutoverAuthorityReceipt {
  schemaVersion: typeof SAR_CUTOVER_AUTHORITY_SCHEMA_VERSION;
  receiptId: string;
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  captureRevision: string;
  authorityDigest: string;
  activatedAt: string;
}

// ─── Supported semantics (closed whitelist) ──────────────────────────────────

/**
 * Object types SAR may traverse semantically. Stored types outside this set
 * may appear as read-only context but never drive hop expansion.
 */
export const SAR_SUPPORTED_OBJECT_TYPES = [
  'DomainConcept',
  'Formula',
  'KnowledgeStatement',
  'SystemModel',
  'ModelRepresentation',
  'KaqRole',
  'ResourceSegment',
  'PathNode',
  'LearnerStateSlice',
] as const;

export type SarSupportedObjectType = (typeof SAR_SUPPORTED_OBJECT_TYPES)[number];

/**
 * Edge / binding predicates SAR may traverse. Presence in storage is not enough.
 */
export const SAR_SUPPORTED_TRAVERSAL_PREDICATES = [
  // Engineering (Repository) — directed adapters
  'is_a',
  'part_of',
  'has_component',
  'has_formula',
  'has_representation',
  'applies_to',
  'used_to_analyze',
  'derived_from',
  'association',
  // Cross-namespace reviewed binding roles
  'kaq_primary_identity',
  'kaq_composition_part',
  'kaq_supporting_object',
  'resource_explains',
  'resource_practices',
  'resource_assesses',
  'resource_references',
  'path_covers',
  'learner_targets',
] as const;

export type SarSupportedTraversalPredicate =
  (typeof SAR_SUPPORTED_TRAVERSAL_PREDICATES)[number];

/** Stored predicates that must never expand (read-only context only). */
export const SAR_UNSUPPORTED_STORED_PREDICATES = [
  'mentions',
  'refers_to',
  'contains',
  'prerequisite',
  'same-name-similarity',
  'legacy-id-equality',
] as const;

export type SarUnsupportedStoredPredicate =
  (typeof SAR_UNSUPPORTED_STORED_PREDICATES)[number];

export const SAR_EXPANSION_DEFAULTS = Object.freeze({
  maxHops: 1 as const,
  maxPerSourceCandidates: 16 as const,
  maxTotalCandidates: 48 as const,
  latencyBudgetMs: 250 as const,
  harnessLatencyBudgetMs: 2_000 as const,
});

// ─── Version / provenance ────────────────────────────────────────────────────

/**
 * Complete version identity for a composition request. Cache keys and
 * provenance stamps must cover every field.
 */
export interface SarCompositionVersionContext {
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string;
  projectionId: string;
  projectionProfile: string;
  projectionDigest: string;
  deltaReceiptId: string;
  coverageOverlayId: string;
  coverageOverlayVersion: string;
  coverageSourceHash: string;
  coverageCaptureRevision: string;
  inventoryRunId: string;
  /** KAQ binding / catalog version identity. */
  kaqBindingVersion: string;
  /** Resource governance binding version identity. */
  resourceBindingVersion: string;
  /** Path overlay version. */
  pathOverlayVersion: string;
  /** Learner-state overlay version. */
  learnerStateOverlayVersion: string;
  /** Deterministic digest of the fields above (excluding this field). */
  contextDigest: string;
}

export type SarCompositionVersionFields = Omit<
  SarCompositionVersionContext,
  'contextDigest'
>;

export const SAR_VERSION_CONTEXT_FIELD_KEYS = [
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
] as const satisfies ReadonlyArray<keyof SarCompositionVersionFields>;

/**
 * Provenance stamp carried by every candidate node and edge.
 */
export interface SarProvenance {
  namespace: SarSourceNamespace;
  authorityOwner: SarAuthorityOwner;
  sourceIdentity: string;
  /**
   * ReleaseSet/Release for repository/kaq/resource bindings, or overlay
   * version string for path / learner-state.
   */
  versionRef: string;
  releaseSetId: string;
  releaseId: string | null;
  overlayVersion: string | null;
}

// ─── Scope / seed / budget ───────────────────────────────────────────────────

export interface SarCompositionScope {
  courseId?: string;
  learningGoalId?: string;
  studentId?: string;
  classId?: string;
  admittedCanonicalIds: readonly string[];
}

export interface SarCompositionSeed {
  /** Stable seed identity (canonical id, kaq role id, resource segment id, …). */
  id: string;
  namespace: SarSourceNamespace;
}

export interface SarCompositionBudget {
  maxHops: 0 | 1 | 2;
  maxPerSourceCandidates: number;
  maxTotalCandidates: number;
}

// ─── Cross-namespace bindings ────────────────────────────────────────────────

export type SarCrossNamespaceBindingKind =
  | 'kaq-canonical'
  | 'resource-canonical'
  | 'path-canonical'
  | 'learner-canonical';

export type SarCrossNamespaceBindingReviewState =
  | 'CANDIDATE'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'STALE';

export type SarKaqBindingPredicate =
  | 'kaq_primary_identity'
  | 'kaq_composition_part'
  | 'kaq_supporting_object';

export type SarResourceBindingPredicate =
  | 'resource_explains'
  | 'resource_practices'
  | 'resource_assesses'
  | 'resource_references';

/**
 * Shared ACCEPTED shadow fields. Kind-specific endpoint/predicate/scope are
 * enforced by the discriminated union and runtime matrix.
 */
interface SarBindingCommon {
  id: string;
  releaseSetId: string;
  releaseId: string;
  reviewState: SarCrossNamespaceBindingReviewState;
  authorityState: 'SHADOW';
  productionAuthoritative: false;
  inheritedFromLegacyId: null;
  sameNameAutoMatch: false;
  objectRevision: string | null;
  evidenceDigest: string | null;
  reviewIdentity: string | null;
  overlayVersion: string | null;
}

/**
 * Discriminated cross-namespace binding contract (#1114 final review).
 *
 * Matrix (production ACCEPTED traversal):
 * - kaq-canonical:      kaq → repository, predicate ∈ kaq_*
 * - resource-canonical: resource → repository, predicate ∈ resource_*
 * - path-canonical:     path → repository, predicate = path_covers
 * - learner-canonical:  learner-state → repository, predicate = learner_targets
 *
 * Reversed / non-Repository / mismatched-kind / self-loop endpoints are invalid.
 * Composition consumes only `VerifiedSarBindingSet` (WeakSet capability).
 */
export type SarCrossNamespaceBinding =
  | (SarBindingCommon & {
      kind: 'kaq-canonical';
      predicate: SarKaqBindingPredicate;
      fromNamespace: 'kaq';
      fromIdentity: string;
      toNamespace: 'repository';
      toIdentity: string;
      courseId: null;
      learningGoalId: null;
      studentId: null;
      classId: null;
    })
  | (SarBindingCommon & {
      kind: 'resource-canonical';
      predicate: SarResourceBindingPredicate;
      fromNamespace: 'resource';
      fromIdentity: string;
      toNamespace: 'repository';
      toIdentity: string;
      courseId: null;
      learningGoalId: null;
      studentId: null;
      classId: null;
    })
  | (SarBindingCommon & {
      kind: 'path-canonical';
      predicate: 'path_covers';
      fromNamespace: 'path';
      fromIdentity: string;
      toNamespace: 'repository';
      toIdentity: string;
      /** Governed path scope — compared to composition scope at traversal. */
      courseId: string;
      learningGoalId: string;
      studentId: null;
      classId: null;
    })
  | (SarBindingCommon & {
      kind: 'learner-canonical';
      predicate: 'learner_targets';
      fromNamespace: 'learner-state';
      fromIdentity: string;
      toNamespace: 'repository';
      toIdentity: string;
      courseId: string;
      learningGoalId: string;
      studentId: string;
      classId: string;
    });

// ─── Candidate projection (request-scoped, non-authoritative) ────────────────

export type SarCandidateKind = 'node' | 'edge' | 'read-only-context';

export interface SarCandidateNode {
  kind: 'node';
  /**
   * Namespace-qualified identity: `${namespace}::${localId}`.
   * Distinct observations with the same bare id in different namespaces
   * remain distinct.
   */
  id: string;
  /** Bare source-local id (not unique across namespaces). */
  localId: string;
  objectType: string;
  label: string;
  supportedForTraversal: boolean;
  provenance: SarProvenance;
  /** True when type is stored but not on the SAR whitelist. */
  readOnlyContext: boolean;
}

export interface SarCandidateEdge {
  kind: 'edge';
  /** Namespace-qualified edge identity. */
  id: string;
  predicate: string;
  /** Namespace-qualified endpoint ids. */
  fromId: string;
  toId: string;
  hop: number;
  supportedForTraversal: boolean;
  provenance: SarProvenance;
  skipReason?: SarTraversalSkipReason | null;
}

export type SarTraversalSkipReason =
  | 'unsupported-predicate'
  | 'unsupported-object-type'
  | 'missing-binding'
  | 'same-name-only'
  | 'version-mismatch'
  | 'outside-scope'
  | 'hop-limit'
  | 'per-source-budget'
  | 'total-budget'
  | 'unreviewed-binding'
  | 'missing-evidence'
  | 'wrong-direction'
  | 'self-loop';

/**
 * Request-time reconstructable candidate projection.
 * No write methods; not a mixed-graph store; not source mutation.
 */
export interface SarCandidateProjection {
  schemaVersion: typeof CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION;
  consumerId: typeof CANONICAL_SAR_CONSUMER_ID;
  /** Always candidate — never promoted to authority. */
  projectionKind: 'request-candidate';
  /** Explicit non-persistence contract. */
  writable: false;
  materializesMixedGraph: false;
  mutatesSources: false;
  version: SarCompositionVersionContext;
  seedIds: string[];
  scope: SarCompositionScope;
  budget: SarCompositionBudget;
  nodes: SarCandidateNode[];
  edges: SarCandidateEdge[];
  readOnlyContext: SarCandidateNode[];
  limitations: string[];
  cacheKey: string;
  reconstructable: true;
}

// ─── Composition I/O ─────────────────────────────────────────────────────────

export interface SarSourceHit {
  id: string;
  objectType: string;
  label: string;
  namespace: SarSourceNamespace;
  sourceIdentity: string;
  versionRef: string;
  releaseSetId: string;
  releaseId: string | null;
  overlayVersion: string | null;
  /** In-source neighbor edges (Repository relations only). */
  neighborEdges?: readonly SarSourceNeighborEdge[];
}

export interface SarSourceNeighborEdge {
  id: string;
  predicate: string;
  fromId: string;
  toId: string;
  /**
   * Relation/source identity for the edge itself (not the seed node).
   * Emitted Repository edge provenance must use this identity.
   */
  sourceIdentity: string;
}

export interface SarSourceQueryResult {
  namespace: SarSourceNamespace;
  authorityOwner: SarAuthorityOwner;
  versionIdentity: string;
  hits: SarSourceHit[];
  /** Stored-but-unsupported items returned as read-only context. */
  readOnlyContext: SarSourceHit[];
  limitations: string[];
}

export type SarCompositionStatus =
  | 'composed'
  | 'legacy-only'
  | 'cutover-fail-closed'
  | 'version-context-rejected'
  | 'adapter-result-rejected'
  | 'binding-set-rejected'
  | 'empty';

export interface SarCompositionDiagnostics {
  schemaVersion: typeof CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION;
  authority: SarAuthoritySelector;
  version: SarCompositionVersionContext;
  sourceResults: SarSourceQueryResult[];
  traversedBindingIds: string[];
  skippedBindings: Array<{ bindingId: string; reason: SarTraversalSkipReason }>;
  skippedSameNamePairs: Array<{ left: string; right: string }>;
  latencyMs: number;
  withinLatencyBudget: boolean;
  latencyBudgetMs: number;
  productionUsesCanonical: false;
  shadowSeparated: boolean;
  cacheKey: string;
  sourcesMutated: false;
}

export interface SarShadowEvidence {
  schemaVersion: typeof CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION;
  recordedAt: string;
  consumer: SarAuthorityConsumer;
  authority: SarAuthoritySelector;
  candidateNodeIds: string[];
  candidateEdgeIds: string[];
  limitations: string[];
  cacheKey: string;
  /** Explicit: never replaces production response. */
  replacesProduction: false;
}

export interface SarCompositionInput {
  seeds: readonly SarCompositionSeed[];
  scope: SarCompositionScope;
  version: SarCompositionVersionContext;
  /**
   * Runtime-authenticated verified binding set only.
   * Raw arrays / clones / forged structural objects fail closed.
   */
  bindings: VerifiedSarBindingSet;
  /**
   * Independent source adapters. Callers inject fixtures or live adapters;
   * composition never mutates them.
   */
  adapters: SarSourceAdapterSet;
  budget?: Partial<SarCompositionBudget>;
  authorityConsumer?: SarAuthorityConsumer;
  cutoverReceipt?: SarCutoverAuthorityReceipt | null;
  latencyBudgetMs?: number;
  /** Monotonic performance clock (defaults to performance.now). */
  now?: () => number;
  /**
   * Wall-clock for shadow evidence `recordedAt` (defaults to () => new Date()).
   * Separated from `now` so latency stays monotonic while evidence time is real.
   */
  recordedAt?: () => Date;
  /**
   * Optional read-only probe for tests. Composition NEVER writes through this
   * or any other caller-owned reference (adapters, bindings, seeds, scope,
   * version). Callers may freeze the probe to prove write-freedom.
   */
  sourceMutationProbe?: Readonly<{ mutated: boolean }>;
}

/**
 * Opaque verified binding set — only mint-registered instances pass assert.
 * Defined fully in binding-capability.ts; structural shell here for contracts.
 */
export type VerifiedSarBindingSet = {
  readonly schemaVersion: 'act-verified-sar-binding-set/v1';
  readonly bindings: readonly SarCrossNamespaceBinding[];
  readonly bindingSetDigest: string;
  readonly versionContextDigest: string;
};

export interface SarCompositionResult {
  status: SarCompositionStatus;
  authority: SarAuthoritySelector;
  projection: SarCandidateProjection | null;
  shadowEvidence: SarShadowEvidence | null;
  diagnostics: SarCompositionDiagnostics;
}

/**
 * Explicit source adapter contract — public boundary only, no write surface.
 */
export interface SarSourceAdapter {
  readonly namespace: SarSourceNamespace;
  readonly authorityOwner: SarAuthorityOwner;
  /** Version identity that must enter the cache key. */
  readonly versionIdentity: string;
  /**
   * Query source by seed identities within scope.
   * Implementations MUST be side-effect free (no source mutation).
   */
  query(input: {
    seedIds: readonly string[];
    scope: SarCompositionScope;
    version: SarCompositionVersionContext;
    budget: number;
  }): SarSourceQueryResult | Promise<SarSourceQueryResult>;
}

export type SarSourceAdapterSet = Readonly<
  Record<SarSourceNamespace, SarSourceAdapter>
>;
