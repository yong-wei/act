/**
 * KAQ knowledge-role → Canonical Object binding contracts (#1113).
 *
 * Shadow-only before final production cutover. Bindings never rewrite historical
 * LearningFacts, never auto-inherit from Legacy IDs / same-name labels, and never
 * promote formal KAQ consumers off Legacy authority.
 */

import {
  AGGREGATE_COURSE_COVERAGE_OVERLAY_ID,
  type CourseCoverageDisposition,
} from '@/lib/aggregate-governance/contracts';
import {
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
} from '@/lib/authoritative-knowledge/contracts';

export const CANONICAL_KAQ_BINDING_SCHEMA_VERSION =
  'act-canonical-kaq-binding/v1' as const;
export const KAQ_TEACHING_PROJECTION_BOUNDARY_VERSION =
  'act-kaq-teaching-projection-boundary/v1' as const;
export const KAQ_RELATION_CONFLICT_REVIEW_VERSION =
  'act-kaq-teaching-relation-conflict/v1' as const;

/** Pinned aggregate identity reused from #1125/#1126. */
export const PINNED_KAQ_AGGREGATE_RELEASE_SET_ID = CURRENT_AGGREGATE_RELEASE_SET_ID;
export const PINNED_KAQ_AGGREGATE_RELEASE_ID = CURRENT_AGGREGATE_RELEASE_ID;
export const PINNED_KAQ_COVERAGE_OVERLAY_ID = AGGREGATE_COURSE_COVERAGE_OVERLAY_ID;

/**
 * Role of a KAQ knowledge role relative to one Canonical Object.
 * One role may span multiple objects; one object may serve multiple roles.
 */
export const KAQ_CANONICAL_BINDING_ROLES = [
  'PRIMARY_IDENTITY',
  'COMPOSITION_PART',
  'SUPPORTING_OBJECT',
] as const;

export type KaqCanonicalBindingRole =
  (typeof KAQ_CANONICAL_BINDING_ROLES)[number];

export type KaqCanonicalBindingReviewState =
  | 'CANDIDATE'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'STALE'
  | 'SUPERSEDED';

export type KaqCanonicalBindingLifecycleState = 'CURRENT' | 'SUPERSEDED' | 'RETIRED';

/**
 * Forbidden auto-match sources. Generators must never create bindings from these.
 */
export const FORBIDDEN_KAQ_BINDING_AUTO_SOURCES = [
  'legacy-id',
  'same-name',
] as const;

export type ForbiddenKaqBindingAutoSource =
  (typeof FORBIDDEN_KAQ_BINDING_AUTO_SOURCES)[number];

/**
 * Complete pinned authority context for shadow KAQ bindings.
 * Reuses the full-fingerprint fail-closed pattern from #1126/#1112.
 */
export interface KaqCanonicalPinnedContext {
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string;
  deltaReceiptId: string;
  coverageOverlayId: string;
  coverageOverlayVersion: string;
  coverageSourceHash: string;
  coverageCaptureRevision: string;
  /** Active CourseCoverage admissions only (formal_objective / necessary_prerequisite / explicit_extension). */
  admittedCanonicalIds: readonly string[];
  /** Deterministic digest of the fields above (excluding this field). */
  contextDigest: string;
}

export type KaqCanonicalPinnedContextFields = Omit<
  KaqCanonicalPinnedContext,
  'contextDigest'
>;

export const KAQ_PINNED_CONTEXT_FIELD_KEYS = [
  'releaseSetId',
  'releaseId',
  'releaseHash',
  'sourceDatasetHash',
  'deltaReceiptId',
  'coverageOverlayId',
  'coverageOverlayVersion',
  'coverageSourceHash',
  'coverageCaptureRevision',
  'admittedCanonicalIds',
] as const satisfies ReadonlyArray<keyof KaqCanonicalPinnedContextFields>;

/**
 * Explicit semantic proposal. Callers must supply independent evidence —
 * never a Legacy ID match or same-label auto-pick.
 */
export interface KaqCanonicalBindingProposalTarget {
  canonicalId: string;
  bindingRole: KaqCanonicalBindingRole;
  evidenceRefs: readonly string[];
  semanticRationale: string;
  objectRevision: string;
}

export interface KaqCanonicalBindingProposal {
  kaqRoleId: string;
  targets: readonly KaqCanonicalBindingProposalTarget[];
  /**
   * When present, documents rejected auto sources so generators prove they did
   * not inherit Legacy IDs or same-name matches.
   */
  rejectedAutoSources?: readonly ForbiddenKaqBindingAutoSource[];
}

export interface KaqCanonicalBinding {
  id: string;
  schemaVersion: typeof CANONICAL_KAQ_BINDING_SCHEMA_VERSION;
  kaqRoleId: string;
  canonicalId: string;
  bindingRole: KaqCanonicalBindingRole;
  releaseSetId: string;
  releaseId: string;
  objectRevision: string;
  evidenceRefs: string[];
  evidenceDigest: string;
  semanticRationale: string;
  reviewState: KaqCanonicalBindingReviewState;
  reviewIdentity: string | null;
  reviewRationale: string | null;
  lifecycleState: KaqCanonicalBindingLifecycleState;
  /** Always SHADOW until the final multi-consumer cutover. */
  authorityState: 'SHADOW';
  productionAuthoritative: false;
  pinnedContextDigest: string;
  /** Explicit non-inheritance markers — always null / false. */
  inheritedFromLegacyId: null;
  sameNameAutoMatch: false;
}

export interface KaqCanonicalBindingReviewInput {
  bindingId: string;
  outcome: 'ACCEPT' | 'REJECT';
  reviewIdentity: string;
  reviewRationale: string;
}

/**
 * KAQ-owned relation namespaces that remain under KAQ even after Canonical
 * identity binding or Teaching Projection activation.
 */
export const KAQ_OWNED_RELATION_NAMESPACES = [
  'knowledge-capability-quality',
  'learning-goal',
  'runtime-pedagogical',
] as const;

export type KaqOwnedRelationNamespace =
  (typeof KAQ_OWNED_RELATION_NAMESPACES)[number];

/**
 * Future ActKG Teaching Projection knowledge-to-knowledge predicates.
 * Distinct from engineering predicates on the Engineering Release.
 */
export const ACTKG_TEACHING_PROJECTION_PREDICATES = [
  'contains',
  'prerequisite',
  'association',
] as const;

export type ActkgTeachingProjectionPredicate =
  (typeof ACTKG_TEACHING_PROJECTION_PREDICATES)[number];

/**
 * Engineering predicates that must never be promoted to teaching relations
 * when no formal Teaching Projection is released.
 */
export const ENGINEERING_PREDICATES_NEVER_TEACHING = [
  'is_a',
  'part_of',
  'has_component',
  'has_formula',
  'has_representation',
  'applies_to',
  'used_to_analyze',
  'derived_from',
  'refers_to',
  'mentions',
  // Schema-legal names that can appear on engineering graphs but are not a
  // formal Teaching Projection release for ACT planning.
  'contains',
  'prerequisite',
  'association',
] as const;

export type EngineeringPredicateNeverTeaching =
  (typeof ENGINEERING_PREDICATES_NEVER_TEACHING)[number];

export type TeachingProjectionUnavailableReason =
  | 'formal-teaching-projection-not-available'
  | 'missing-pinned-context'
  | 'release-identity-not-pinned'
  | 'invalid-projection-digest'
  | 'missing-projection-identity'
  | 'pinned-context-fingerprint-invalid'
  | 'missing-formal-teaching-proof'
  | 'teaching-proof-mismatch';

export const REVIEWED_KAQ_ROLE_CANONICAL_MAPPING_VERSION =
  'act-kaq-reviewed-role-canonical-mapping/v1' as const;

/**
 * Role→Canonical map built only from ACCEPTED/CURRENT/SHADOW bindings that
 * match a verified pinned context. Conflict detection and planner gates MUST
 * consume this contract — never a raw self-minted map.
 */
export interface ReviewedKaqRoleCanonicalMapping {
  schemaVersion: typeof REVIEWED_KAQ_ROLE_CANONICAL_MAPPING_VERSION;
  pinnedContextDigest: string;
  releaseSetId: string;
  releaseId: string;
  /** Role id → sorted unique Canonical Object ids from reviewed shadow bindings. */
  roleToCanonicalIds: Readonly<Record<string, readonly string[]>>;
  /** Binding ids that contributed to the map (audit). */
  bindingIds: readonly string[];
}

export type TeachingProjectionAvailability =
  | {
      available: false;
      blocked: true;
      reason: TeachingProjectionUnavailableReason;
      boundaryVersion: typeof KAQ_TEACHING_PROJECTION_BOUNDARY_VERSION;
    }
  | {
      available: true;
      blocked: false;
      boundaryVersion: typeof KAQ_TEACHING_PROJECTION_BOUNDARY_VERSION;
      /** Always equal to the verified pinned aggregate ReleaseSet. */
      releaseSetId: string;
      /** Always equal to the verified pinned aggregate Release. */
      releaseId: string;
      /** Digest of the same KaqCanonicalPinnedContext used to admit availability. */
      pinnedContextDigest: string;
      projectionId: string;
      /** 64-char lowercase SHA-256 of the formal Teaching Projection artifact. */
      projectionDigest: string;
      /**
       * Complete formal Teaching Projection relation-set digest bound by the
       * formal proof. Consumers must reject submitted sets that do not match.
       */
      relationSetDigest: string;
    };

/**
 * Typed Teaching Projection relation for future ActKG ownership of
 * knowledge-to-knowledge teaching edges. Not inferred from engineering graphs.
 */
export interface ActkgTeachingProjectionRelation {
  id: string;
  namespace: 'actkg-teaching-projection';
  authority: 'ACTKG';
  predicate: ActkgTeachingProjectionPredicate;
  sourceCanonicalId: string;
  targetCanonicalId: string;
  releaseSetId: string;
  releaseId: string;
  /** Same pinned context digest that admitted Teaching Projection availability. */
  pinnedContextDigest: string;
  projectionId: string;
  projectionDigest: string;
  version: string;
}

/**
 * KAQ knowledge-to-knowledge edge under review against Teaching Projection.
 */
export interface KaqKnowledgeToKnowledgeRelation {
  edgeId: string;
  sourceRoleId: string;
  targetRoleId: string;
  relation: string;
  strength?: string;
  rationale?: string;
  lifecycleState: 'ACTIVE' | 'RETIRED';
  ownership: 'KAQ';
}

export type TeachingRelationConflictReviewState =
  | 'UNRESOLVED'
  | 'ACCEPTED_ACTKG'
  | 'RETAIN_KAQ'
  | 'RETIRED_KAQ';

export interface TeachingRelationConflict {
  id: string;
  schemaVersion: typeof KAQ_RELATION_CONFLICT_REVIEW_VERSION;
  kaqEdgeId: string;
  kaqSourceRoleId: string;
  kaqTargetRoleId: string;
  kaqRelation: string;
  actkgRelationId: string;
  actkgSourceCanonicalId: string;
  actkgTargetCanonicalId: string;
  actkgPredicate: ActkgTeachingProjectionPredicate;
  reviewState: TeachingRelationConflictReviewState;
  reviewIdentity: string | null;
  reviewRationale: string | null;
}

export type KaqAuthorityMode = 'LEGACY' | 'CANONICAL_SHADOW' | 'CANONICAL';

export type KaqAuthorityConsumer =
  | 'FORMAL_DIAGNOSIS'
  | 'FORMAL_RECOMMENDATION'
  | 'FORMAL_PLANNING'
  | 'MIGRATION_REVIEW'
  | 'CUTOVER_ACTIVATION';

export type KaqAuthoritySelector =
  | {
      consumer: 'FORMAL_DIAGNOSIS' | 'FORMAL_RECOMMENDATION' | 'FORMAL_PLANNING';
      authority: 'LEGACY';
      productionAuthoritative: true;
      canonicalBindingsVisible: false;
      teachingProjectionVisible: false;
    }
  | {
      consumer: 'MIGRATION_REVIEW';
      authority: 'CANONICAL_SHADOW';
      productionAuthoritative: false;
      canonicalBindingsVisible: true;
      teachingProjectionVisible: true;
    }
  | {
      consumer: 'CUTOVER_ACTIVATION';
      authority: 'CANONICAL';
      productionAuthoritative: true;
      canonicalBindingsVisible: true;
      teachingProjectionVisible: true;
      cutoverReceiptId: string;
    };

export interface KaqCatalogBindingReadinessRole {
  kaqRoleId: string;
  ready: boolean;
  reasonCodes: Array<
    | 'binding-missing'
    | 'binding-not-accepted'
    | 'binding-stale'
    | 'canonical-outside-coverage'
    | 'pinned-context-mismatch'
    | 'release-not-pinned-aggregate'
  >;
  acceptedBindingIds: string[];
}

export interface KaqCatalogBindingReadiness {
  schemaVersion: typeof CANONICAL_KAQ_BINDING_SCHEMA_VERSION;
  ready: boolean;
  roles: KaqCatalogBindingReadinessRole[];
  /** Formal consumers always remain on Legacy before cutover. */
  formalConsumerAuthority: 'LEGACY';
  /** Readiness is exposed only to migration review. */
  migrationReviewVisible: true;
  productionAuthoritative: false;
  authorityState: 'SHADOW';
}

export interface HistoricalLearningFactIdentity {
  factId: string;
  knowledgeRevision: string;
  knowledgeAuthority: 'LEGACY';
  legacyKnowledgeNodeId: string;
}

export interface HistoricalFactRebindingResult {
  rewritten: false;
  sidecarCreated: false;
  retainedLegacyRevision: true;
  facts: HistoricalLearningFactIdentity[];
}

export interface PlannerTeachingRelationGate {
  available: boolean;
  blocked: boolean;
  reason:
    | 'no-conflicts'
    | 'unresolved-conflict'
    | 'parallel-conflict-versions'
    | 'cycle-detected'
    | 'teaching-projection-unavailable-using-kaq'
    | 'accepted-actkg-active'
    /** Formal Teaching Projection is authority; KAQ K2K edges are not planner-active. */
    | 'teaching-projection-authority'
    | 'unmapped-role-endpoint'
    | 'invalid-reviewed-mapping'
    | 'mixed-actkg-relation-identity'
    | 'invalid-conflict-ledger'
    /** Formal consumers must not receive ActKG active edges before cutover. */
    | 'formal-selector-cannot-activate-actkg'
    | 'cutover-selector-not-implemented';
  activeKaqEdgeIds: string[];
  activeActkgRelationIds: string[];
  blockedEdgeIds: string[];
  /**
   * Consumer that requested this gate. Formal selectors never get ActKG edges
   * before final multi-consumer cutover.
   */
  selectorConsumer?: KaqAuthorityConsumer;
}

export type { CourseCoverageDisposition };
