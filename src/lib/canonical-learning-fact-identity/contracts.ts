/**
 * Canonical LearningFact fixed-identity contracts (#1116).
 *
 * Pre-cutover: production authority remains LEGACY. Canonical adapter and
 * shadow validation exist but cannot activate formal Canonical writes.
 * Candidate ReleaseSets never receive formal knowledge-scoped facts.
 * Historical facts are never backfilled or dual-written.
 */

import {
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
} from '@/lib/authoritative-knowledge/contracts';
import { AGGREGATE_COURSE_COVERAGE_OVERLAY_ID } from '@/lib/aggregate-governance/contracts';

export const CANONICAL_LEARNING_FACT_IDENTITY_VERSION =
  'act-canonical-learning-fact-identity/v1' as const;

export const LEARNING_FACT_IDENTITY_NAMESPACES = ['LEGACY', 'CANONICAL'] as const;
export type LearningFactIdentityNamespace =
  (typeof LEARNING_FACT_IDENTITY_NAMESPACES)[number];

/** Historical rows without an explicit stamp resolve as legacy-unversioned. */
export const LEGACY_UNVERSIONED_REVISION = 'legacy-unversioned' as const;

export const PINNED_LEARNING_FACT_AGGREGATE_RELEASE_SET_ID =
  CURRENT_AGGREGATE_RELEASE_SET_ID;
export const PINNED_LEARNING_FACT_AGGREGATE_RELEASE_ID =
  CURRENT_AGGREGATE_RELEASE_ID;
export const PINNED_LEARNING_FACT_COVERAGE_OVERLAY_ID =
  AGGREGATE_COURSE_COVERAGE_OVERLAY_ID;

export type LearningFactAuthorityMode =
  | 'LEGACY'
  | 'CANONICAL_SHADOW'
  | 'CANONICAL';

export type LearningFactAuthorityConsumer =
  | 'FORMAL_PRODUCTION'
  | 'SHADOW_VALIDATION'
  | 'CUTOVER_ACTIVATION';

export type LearningFactAuthoritySelector =
  | {
      consumer: 'FORMAL_PRODUCTION';
      authority: 'LEGACY';
      productionAuthoritative: true;
      canonicalWriterEnabled: false;
    }
  | {
      consumer: 'SHADOW_VALIDATION';
      authority: 'CANONICAL_SHADOW';
      productionAuthoritative: false;
      canonicalWriterEnabled: false;
    }
  | {
      consumer: 'CUTOVER_ACTIVATION';
      authority: 'CANONICAL';
      productionAuthoritative: true;
      canonicalWriterEnabled: true;
    };

/** Aggregate publication state relevant to formal fact writers. */
export type AggregateReleasePublicationState =
  | 'CANDIDATE'
  | 'ACTIVE'
  | 'LEGACY'
  | 'HISTORICAL';

/**
 * Complete fixed Canonical identity atom for one knowledge-scoped fact.
 * All fields are required for formal Canonical / Projection-bound writes.
 *
 * Spec aliases (#1275):
 * - canonicalId → canonicalObjectId
 * - authorityReleaseId → aggregateReleaseId
 * - projectionId → knowledgeProjectionId
 * - resourceId → resourceId (required for Projection-bound path/resource facts)
 */
export interface CanonicalLearningFactIdentity {
  schemaVersion: typeof CANONICAL_LEARNING_FACT_IDENTITY_VERSION;
  identityNamespace: 'CANONICAL';
  canonicalObjectId: string;
  aggregateReleaseSetId: string;
  aggregateReleaseId: string;
  /** Projection id when the fact is bound to a Teaching/Domain projection. */
  knowledgeProjectionId: string | null;
  /** Knowledge truth revision or projection digest. */
  knowledgeRevisionRef: string;
  /**
   * Governed projected resource identity for Projection-bound path/resource
   * activities. Required for formal Projection-bound writes (#1275).
   * Stored on the identity atom and stamped into contextJson (no schema expand).
   */
  resourceId?: string | null;
  /**
   * Teaching resource role/scope snapshot for admission diagnostics.
   * Does not replace ResourceNode registry authority.
   */
  resourceRole?: string | null;
  resourceScopeId?: string | null;
  /** Governed source identity (namespaced). */
  sourceEventId: string | null;
  sourceLogId: string | null;
  /** Aggregate publication state used for candidate rejection. */
  releasePublicationState: AggregateReleasePublicationState;
}

export interface LegacyLearningFactIdentity {
  schemaVersion: typeof CANONICAL_LEARNING_FACT_IDENTITY_VERSION;
  identityNamespace: 'LEGACY';
  knowledgeRevisionRef: string | null;
  legacyKnowledgeNodeIds: readonly string[];
  sourceEventId: string | null;
  sourceLogId: string | null;
}

export type LearningFactKnowledgeIdentity =
  | CanonicalLearningFactIdentity
  | LegacyLearningFactIdentity;

export type CanonicalWriteRejectionCode =
  | 'candidate-release-set'
  | 'incomplete-identity'
  | 'identity-drift'
  | 'not-in-course-coverage'
  | 'resource-or-kaq-support-missing'
  | 'resource-identity-missing'
  | 'node-not-projected'
  | 'source-identity-missing'
  | 'source-identity-mismatch'
  | 'dual-write-forbidden'
  | 'authority-not-canonical'
  | 'cutover-not-implemented'
  | 'cutover-local-activation-forbidden';

export interface CanonicalWriteAdmissionContext {
  /** Admitted Canonical Object IDs from current aggregate CourseCoverage. */
  admittedCanonicalIds: readonly string[];
  /**
   * Canonical Object IDs supported by current aggregate resource binding
   * (SHADOW_PUBLISHED / CURRENT) or reviewed KAQ producer contract.
   */
  resourceOrKaqSupportedCanonicalIds: readonly string[];
  /**
   * Canonical IDs admitted by the active ACT Teaching Projection.
   * Engineering-only / unprojected nodes fail formal knowledge facts (#1275).
   */
  projectedCanonicalIds?: readonly string[];
  /**
   * Accessible projected resource IDs under the active Teaching Projection.
   * When provided, identity.resourceId must be a member.
   */
  accessibleResourceIds?: readonly string[];
  /**
   * Exact (canonicalId, resourceId) pairs from governed projection bindings.
   * When present, identity must match a pair — not just set membership —
   * so resources cannot be cross-applied across nodes (#1275).
   */
  projectedResourceBindings?: readonly {
    canonicalId: string;
    resourceId: string;
  }[];
  /**
   * When true (default for Projection-bound path/resource producers), require
   * identity.resourceId and knowledgeProjectionId.
   */
  requireProjectionBoundResourceIdentity?: boolean;
  /**
   * Expected aggregate identity from verified pinned context.
   * Drift against write identity fails closed.
   */
  expectedReleaseSetId: string;
  expectedReleaseId: string;
  expectedProjectionId?: string | null;
  expectedKnowledgeRevisionRef?: string | null;
  /** Allowed source identity prefixes for this producer (e.g. arena-official). */
  allowedSourcePrefixes: readonly string[];
}

/** Prisma-shaped LearningFact create payload used by adapters. */
export interface LearningFactWriteRow {
  id?: string;
  userId: string;
  factType: string;
  moduleId?: string | null;
  sessionId?: string | null;
  startedAt: Date | string;
  finishedAt?: Date | string | null;
  outcome: string;
  score?: number | null;
  timeSpent?: number | null;
  competencyContribution: unknown;
  sourceEventId?: string | null;
  sourceLogId?: string | null;
  courseId?: string | null;
  lessonId?: string | null;
  contextJson?: unknown;
  createdAt?: Date | string;
  knowledgeIdentityNamespace?: LearningFactIdentityNamespace | null;
  canonicalObjectId?: string | null;
  aggregateReleaseSetId?: string | null;
  aggregateReleaseId?: string | null;
  knowledgeProjectionId?: string | null;
  knowledgeRevisionRef?: string | null;
}

export interface LearningFactWriteResult {
  authority: LearningFactAuthorityMode;
  written: number;
  skipped: boolean;
  shadowValidated: boolean;
  sinkInvoked: boolean;
  rejectionCodes: CanonicalWriteRejectionCode[];
}

/**
 * Sink accepts LearningFact write rows. `data` is intentionally loose so
 * Prisma createMany delegates and plain test doubles can both be passed
 * without dual-casting at every producer boundary.
 */
/**
 * Sink delegate for adapters. Parameter type is intentionally a broad mutable
 * array so Prisma createMany wrappers and test doubles remain assignable.
 */
export interface LearningFactSink {
  learningFact: {
    createMany: (args: {
      data: LearningFactWriteRow[];
      skipDuplicates?: boolean;
    }) => Promise<{ count: number }>;
  };
}

/**
 * Inventory entry for a governed knowledge-scoped LearningFact producer.
 * Static gate asserts each path imports the controlled adapter.
 */
export interface KnowledgeScopedLearningFactProducer {
  id: string;
  path: string;
  adapter: 'legacy' | 'canonical-selector';
  sourcePrefixes: readonly string[];
  notes: string;
}

/** Serving projection that preserves each fact's own namespace/revision. */
export interface LearningFactServingIdentity {
  factId: string;
  identityNamespace: LearningFactIdentityNamespace | 'LEGACY_UNVERSIONED';
  knowledgeRevisionRef: string;
  canonicalObjectId: string | null;
  aggregateReleaseSetId: string | null;
  aggregateReleaseId: string | null;
  knowledgeProjectionId: string | null;
  resourceId: string | null;
  legacyKnowledgeNodeIds: readonly string[];
  /** True when interpretation must not use the current Canonical graph. */
  historicalRevisionBound: true;
}

/**
 * Read-time display resolution for historical Legacy facts via immutable
 * old-ID → Canonical crosswalk. Never mutates stored fact bytes.
 */
export interface HistoricalLearningFactDisplayContext {
  factId: string;
  identityNamespace: LearningFactIdentityNamespace | 'LEGACY_UNVERSIONED';
  knowledgeRevisionRef: string;
  /** Original Legacy node ids from the fact (unchanged). */
  legacyKnowledgeNodeIds: readonly string[];
  /** Display-only Canonical IDs resolved through crosswalk. */
  displayCanonicalIds: readonly string[];
  /** Display resource context when crosswalk rows carry role/evidence. */
  displayResourceContext: ReadonlyArray<{
    legacyId: string;
    canonicalId: string;
    role: string | null;
    sourceEvidence: string | null;
    stale: boolean;
  }>;
  /** Always true: original fact bytes and authority revision stay intact. */
  originalFactUnchanged: true;
  crosswalkApplied: boolean;
  unresolvedLegacyIds: readonly string[];
}
