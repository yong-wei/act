/**
 * Legacy → Canonical learning-path transition contract (#1115).
 *
 * Reusable stop/archive + replan boundary for the later unified cutover (#1117).
 * Does not flip production authority selectors.
 */

export const CANONICAL_LEARNING_PATH_TRANSITION_VERSION =
  'act-canonical-learning-path-transition/v1' as const;

export const PRESERVED_LEARNING_INTENT_VERSION =
  'act-preserved-learning-intent/v1' as const;

export const CANONICAL_PATH_REPLAN_PLANNER_VERSION =
  'canonical-teaching-projection-replan/v1' as const;

/** Read-only stopped archive status for unfinished Legacy paths at cutover. */
export const LEGACY_STOPPED_PATH_STATUS = 'legacy-stopped' as const;

/** Path statuses considered unfinished and eligible for cutover stop. */
export const UNFINISHED_LEGACY_PATH_STATUSES = [
  'active',
  'fallback',
  'legacy',
] as const;

export type UnfinishedLegacyPathStatus =
  (typeof UNFINISHED_LEGACY_PATH_STATUSES)[number];

/** Statuses that must never be rewritten by cutover stop. */
export const IMMUTABLE_COMPLETED_PATH_STATUSES = [
  'completed',
] as const;

export type LearningPathKnowledgeAuthority = 'LEGACY' | 'CANONICAL';

/**
 * Declared goal / user intent preserved independently of Legacy node sequence.
 * Must never carry nodeIds or step constraints for replanning.
 */
export interface PreservedLearningIntent {
  schemaVersion: typeof PRESERVED_LEARNING_INTENT_VERSION;
  sourcePathId: string;
  goalId: string | null;
  goalTitle: string | null;
  userIntent: string | null;
  intentType: string | null;
  learningGoalVersion: string | null;
  preservedAt: string;
  /** Explicit non-inheritance: Legacy steps are not planning constraints. */
  legacyNodeSequenceConstraint: false;
  legacyNodeIds: null;
}

/**
 * Privacy-safe cumulative portrait basis bound into path version identity.
 * No raw lineage, evidence payloads, or absolute paths.
 */
export interface CanonicalPortraitPlanningBasis {
  schemaVersion: typeof CANONICAL_LEARNING_PATH_TRANSITION_VERSION;
  stateKind: 'SNAPSHOT';
  payloadVersion: string;
  migrationVersion: string;
  generatedAt: string;
  /** SHA-256 over privacy-safe portrait identity fields + learner id. */
  portraitIdentityDigest: string;
  overallScore: number | null;
  confidence: number | null;
  evidencedDimensionCount: number;
  missingDimensionCount: number;
}

export interface CanonicalPathVersionClosure {
  schemaVersion: typeof CANONICAL_LEARNING_PATH_TRANSITION_VERSION;
  knowledgeAuthority: 'CANONICAL';
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string;
  deltaReceiptId: string;
  pinnedContextDigest: string;
  coverageOverlayId: string;
  coverageOverlayVersion: string;
  coverageSourceHash: string;
  coverageCaptureRevision: string;
  projectionId: string;
  projectionDigest: string;
  plannerVersion: typeof CANONICAL_PATH_REPLAN_PLANNER_VERSION;
  /** Privacy-safe portrait identity contributing to path identity. */
  portraitIdentityDigest: string;
  portraitGeneratedAt: string;
  portraitPayloadVersion: string;
  portraitMigrationVersion: string;
  /** Sorted Canonical Object IDs selected from goal-resolved targets. */
  goalTargetCanonicalIds: readonly string[];
  /**
   * SHA-256 over the reviewed KAQ mapping actually consumed for this replan
   * (bindingIds + role→canonical sets). Privacy-safe ids only.
   */
  reviewedMappingDigest: string;
  /**
   * SHA-256 over the goal-relevant formal Teaching Projection relation set
   * actually used (sorted id/version/predicate/source/target).
   */
  teachingRelationSetDigest: string;
  versionIdentityDigest: string;
}

export type CanonicalPathReplanPendingReason =
  | 'missing-pinned-context'
  | 'missing-accepted-delta'
  | 'coverage-version-mismatch'
  | 'missing-reviewed-kaq-bindings'
  | 'reviewed-binding-version-mismatch'
  | 'missing-cumulative-portrait'
  | 'portrait-unavailable'
  | 'portrait-learner-mismatch'
  | 'portrait-payload-invalid'
  | 'formal-teaching-projection-not-available'
  | 'engineering-relations-insufficient'
  | 'unresolved-goal'
  | 'goal-not-resolvable-to-canonical'
  | 'teaching-relation-cycle'
  | 'teaching-relation-out-of-coverage'
  | 'no-supported-teaching-relations'
  | 'no-goal-relevant-teaching-relations'
  | 'mixed-version-identity';

export type CanonicalPathReplanFailReason =
  | CanonicalPathReplanPendingReason
  | 'invalid-inputs'
  | 'legacy-step-mapping-forbidden';

export type CanonicalPathReplanDiagnosticReason =
  | CanonicalPathReplanPendingReason
  | CanonicalPathReplanFailReason
  | 'ready';

/**
 * Privacy-safe diagnostics only — no raw student evidence, absolute paths,
 * or parser dumps.
 */
export interface CanonicalPathReplanDiagnostics {
  schemaVersion: typeof CANONICAL_LEARNING_PATH_TRANSITION_VERSION;
  reason: CanonicalPathReplanDiagnosticReason;
  codes: string[];
  teachingProjectionAvailable: boolean;
  portraitAvailable: boolean;
  reviewedBindingCount: number;
  admittedCanonicalObjectCount: number;
  teachingRelationCount: number;
  hasPreservedGoal: boolean;
  resolvedGoalTargetCount: number;
}

export interface CanonicalPathPlanNode {
  nodeId: string;
  canonicalObjectId: string;
  title: string;
  order: number;
  prerequisiteCanonicalIds: string[];
  relationIds: string[];
  /** True when this object is a goal-resolved target (not only a prereq ancestor). */
  isGoalTarget: boolean;
}

export interface CanonicalLearningPathDraft {
  id: string;
  userId: string;
  goalId: string;
  title: string;
  description: string;
  estimatedTime: number;
  plannerVersion: typeof CANONICAL_PATH_REPLAN_PLANNER_VERSION;
  pathStatus: 'active';
  knowledgeAuthority: 'CANONICAL';
  nodeIds: string[];
  currentNodeId: string | null;
  entryNodeId: string | null;
  versionClosure: CanonicalPathVersionClosure;
  planNodes: CanonicalPathPlanNode[];
  /** Fresh path: no inherited Legacy progress. */
  inheritedLegacyProgress: false;
  sourceStoppedPathId: string | null;
  preservedLearningIntent: PreservedLearningIntent;
  portraitPlanningBasis: CanonicalPortraitPlanningBasis;
  goalTargetCanonicalIds: readonly string[];
  pathPayload: {
    knowledgeAuthority: 'CANONICAL';
    versionClosure: CanonicalPathVersionClosure;
    mainPathNodeIds: string[];
    planNodes: CanonicalPathPlanNode[];
    preservedLearningIntent: PreservedLearningIntent;
    portraitPlanningBasis: CanonicalPortraitPlanningBasis;
    goalTargetCanonicalIds: readonly string[];
    inheritedLegacyProgress: false;
    executionStatus: {
      activeNodeId: string | null;
      completedNodeIds: [];
      failedNodeIds: [];
      skippedNodeIds: [];
    };
  };
  lastExecutionMetadata: {
    activeNodeId: string | null;
    completedNodeIds: [];
    failedNodeIds: [];
    skippedNodeIds: [];
    availableEvidenceCount: 0;
  };
}

export type CanonicalPathReplanResult =
  | {
      status: 'ready';
      path: CanonicalLearningPathDraft;
      diagnostics: CanonicalPathReplanDiagnostics;
    }
  | {
      status: 'pending';
      path: null;
      reason: CanonicalPathReplanPendingReason;
      diagnostics: CanonicalPathReplanDiagnostics;
    }
  | {
      status: 'failed';
      path: null;
      reason: CanonicalPathReplanFailReason;
      diagnostics: CanonicalPathReplanDiagnostics;
    };

export interface StopLegacyPathsAtCutoverResult {
  stoppedPathIds: string[];
  alreadyStoppedPathIds: string[];
  skippedCompletedPathIds: string[];
  skippedCanonicalPathIds: string[];
}

export function isUnfinishedLegacyPathStatus(
  value: unknown,
): value is UnfinishedLegacyPathStatus {
  return typeof value === 'string'
    && (UNFINISHED_LEGACY_PATH_STATUSES as readonly string[]).includes(value);
}

export function isLegacyStoppedPathStatus(value: unknown): boolean {
  return value === LEGACY_STOPPED_PATH_STATUS;
}

export function isCompletedPathStatus(value: unknown): boolean {
  return typeof value === 'string'
    && (IMMUTABLE_COMPLETED_PATH_STATUSES as readonly string[]).includes(value);
}
