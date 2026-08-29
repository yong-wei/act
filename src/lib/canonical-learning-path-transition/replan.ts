/**
 * Canonical learning-path replan gate and draft generation (#1115).
 *
 * Requires a version-closed formal input set. Never maps Legacy steps, never
 * infers teaching paths from engineering relations, never fabricates a
 * production Teaching Projection.
 */

import { createHash } from 'node:crypto';

import {
  assertVerifiedKaqPinnedContext,
  type FormalTeachingProjectionProof,
  type VerifiedKaqPinnedContext,
} from '@/lib/canonical-kaq-binding/authority-capability';
import {
  assertReviewedKaqRoleCanonicalMapping,
  buildReviewedKaqRoleCanonicalMapping,
} from '@/lib/canonical-kaq-binding/bindings';
import { detectTeachingRelationCycles } from '@/lib/canonical-kaq-binding/conflict-review';
import {
  ENGINEERING_PREDICATES_NEVER_TEACHING,
  type ActkgTeachingProjectionRelation,
  type KaqCanonicalBinding,
  type ReviewedKaqRoleCanonicalMapping,
} from '@/lib/canonical-kaq-binding/contracts';
import {
  digestFormalTeachingProjectionRelationSet,
  isActkgTeachingProjectionPredicate,
  resolveTeachingProjectionAvailability,
} from '@/lib/canonical-kaq-binding/teaching-projection';
import {
  getRegisteredAdaptiveLearningPathGoal,
  type AdaptiveLearningPathRegisteredGoalDefinition,
} from '@/features/personalization/path-planning/public-api';
import type { CumulativePortraitReadModel } from '@/lib/data-governance/cumulative-portrait-read-model';
import {
  projectPortraitV2ForConsumer,
  summarizeCumulativePortraitV2,
  validatePortraitV2Payload,
  type PortraitV2Payload,
  type PortraitV2ProjectedPayload,
} from '@/lib/data-governance/portrait-v2-model';

import {
  CANONICAL_LEARNING_PATH_TRANSITION_VERSION,
  CANONICAL_PATH_REPLAN_PLANNER_VERSION,
  PRESERVED_LEARNING_INTENT_VERSION,
  type CanonicalLearningPathDraft,
  type CanonicalPathPlanNode,
  type CanonicalPathReplanDiagnosticReason,
  type CanonicalPathReplanDiagnostics,
  type CanonicalPathReplanFailReason,
  type CanonicalPathReplanPendingReason,
  type CanonicalPathReplanResult,
  type CanonicalPathVersionClosure,
  type CanonicalPortraitPlanningBasis,
  type PreservedLearningIntent,
} from './contracts';
import {
  extractPreservedLearningIntent,
  readPreservedLearningIntent,
  type LegacyPathStopCandidate,
} from './stop-legacy-paths';

const ENGINEERING_PREDICATE_SET = new Set<string>(
  ENGINEERING_PREDICATES_NEVER_TEACHING as readonly string[],
);

export interface CanonicalPathReplanInput {
  userId: string;
  /**
   * Stopped Legacy path (or any path providing preserved goal). Used only for
   * goal/intent extraction — never for node sequence inheritance.
   */
  sourcePath?: {
    id: string;
    goalId?: string | null;
    title?: string;
    pathStatus?: string | null;
    pathPayload?: unknown;
    inputSnapshot?: unknown;
    explanationPayload?: unknown;
    nodeIds?: unknown;
    plannerVersion?: string | null;
  } | null;
  /**
   * Explicit preserved intent. Raw objects that claim Legacy sequence
   * constraints are rejected before normalization.
   */
  preservedLearningIntent?: PreservedLearningIntent | Record<string, unknown> | null;
  /** Verified pinned aggregate context (ReleaseSet + Delta + CourseCoverage). */
  pinned: VerifiedKaqPinnedContext | null | unknown;
  /** Formal Teaching Projection proof — test-minted only until production release. */
  formalTeachingProjectionProof?: FormalTeachingProjectionProof | null | unknown;
  /** Reviewed ACCEPTED shadow bindings closed to the same pinned context. */
  reviewedBindings?: readonly KaqCanonicalBinding[] | null;
  /** Optional prebuilt reviewed mapping; re-validated against bindings+pinned. */
  reviewedMapping?: ReviewedKaqRoleCanonicalMapping | Record<string, unknown> | null;
  /** Current cumulative portrait v2 read model. */
  cumulativePortrait?: CumulativePortraitReadModel | null;
  /**
   * Formal ActKG teaching relations. Engineering-only graphs must not be passed
   * as a substitute; they are rejected when proof/availability is missing.
   */
  teachingRelations?: readonly ActkgTeachingProjectionRelation[] | null;
  /**
   * Optional engineering-only relations for explicit rejection tests.
   * Presence without formal TP always yields pending, never a path.
   */
  engineeringRelations?: ReadonlyArray<{
    id?: string;
    predicate: string;
    sourceId?: string;
    targetId?: string;
  }> | null;
  /** Optional goal id override when not available from preserved intent. */
  goalId?: string | null;
  now?: Date;
}

/**
 * Evaluate Canonical replan readiness and, when all gates pass, produce a
 * fresh Canonical path draft with independent identity and no Legacy progress.
 */
export function replanCanonicalLearningPath(
  input: CanonicalPathReplanInput,
): CanonicalPathReplanResult {
  const now = input.now ?? new Date();

  // 0) Reject raw Legacy sequence constraints before any normalization.
  const rawIntentRejection = rejectRawLegacySequenceConstraint(input.preservedLearningIntent);
  if (rawIntentRejection) {
    return failed('legacy-step-mapping-forbidden', {
      hasPreservedGoal: Boolean(
        input.goalId
        || asRecord(input.preservedLearningIntent).goalId
        || input.sourcePath?.goalId,
      ),
      teachingProjectionAvailable: false,
      portraitAvailable: false,
      reviewedBindingCount: 0,
      admittedCanonicalObjectCount: 0,
      teachingRelationCount: 0,
      resolvedGoalTargetCount: 0,
      codes: rawIntentRejection,
    });
  }

  const preserved = resolvePreservedIntent(input, now);
  const hasPreservedGoal = Boolean(
    preserved?.goalId
    || preserved?.userIntent
    || input.goalId,
  );

  // 1) Pinned context (implies accepted aggregate ReleaseSet + Delta + coverage)
  let pinned: VerifiedKaqPinnedContext;
  try {
    if (!input.pinned) {
      return pending('missing-pinned-context', {
        hasPreservedGoal,
        teachingProjectionAvailable: false,
        portraitAvailable: false,
        reviewedBindingCount: 0,
        admittedCanonicalObjectCount: 0,
        teachingRelationCount: 0,
        resolvedGoalTargetCount: 0,
      });
    }
    pinned = assertVerifiedKaqPinnedContext(input.pinned);
  } catch {
    return pending('missing-pinned-context', {
      hasPreservedGoal,
      teachingProjectionAvailable: false,
      portraitAvailable: false,
      reviewedBindingCount: 0,
      admittedCanonicalObjectCount: 0,
      teachingRelationCount: 0,
      resolvedGoalTargetCount: 0,
    });
  }

  // 2) Formal Teaching Projection availability — never mint/seal clones
  const availability = resolveTeachingProjectionAvailability({
    pinned,
    formalProof: input.formalTeachingProjectionProof as FormalTeachingProjectionProof | null,
  });
  if (!availability.available) {
    if (input.engineeringRelations && input.engineeringRelations.length > 0) {
      return pending('engineering-relations-insufficient', {
        hasPreservedGoal,
        teachingProjectionAvailable: false,
        portraitAvailable: false,
        reviewedBindingCount: countReviewedBindings(input.reviewedBindings, pinned),
        admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
        teachingRelationCount: 0,
        resolvedGoalTargetCount: 0,
        codes: [availability.reason, 'engineering-only-relations'],
      });
    }
    return pending(
      availability.reason === 'formal-teaching-projection-not-available'
        || availability.reason === 'missing-formal-teaching-proof'
        ? 'formal-teaching-projection-not-available'
        : availability.reason === 'missing-pinned-context'
          ? 'missing-pinned-context'
          : 'formal-teaching-projection-not-available',
      {
        hasPreservedGoal,
        teachingProjectionAvailable: false,
        portraitAvailable: false,
        reviewedBindingCount: countReviewedBindings(input.reviewedBindings, pinned),
        admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
        teachingRelationCount: 0,
        resolvedGoalTargetCount: 0,
        codes: [availability.reason],
      },
    );
  }

  if (input.engineeringRelations?.some((rel) => ENGINEERING_PREDICATE_SET.has(rel.predicate))) {
    if (!input.teachingRelations || input.teachingRelations.length === 0) {
      return pending('engineering-relations-insufficient', {
        hasPreservedGoal,
        teachingProjectionAvailable: true,
        portraitAvailable: false,
        reviewedBindingCount: countReviewedBindings(input.reviewedBindings, pinned),
        admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
        teachingRelationCount: 0,
        resolvedGoalTargetCount: 0,
      });
    }
  }

  // 3) Current cumulative portrait v2 — SNAPSHOT + learner match + valid payload
  const portraitGate = closeCumulativePortraitForReplan({
    portrait: input.cumulativePortrait,
    userId: input.userId,
    now,
  });
  if (portraitGate.status !== 'ready') {
    return pending(portraitGate.reason, {
      hasPreservedGoal,
      teachingProjectionAvailable: true,
      portraitAvailable: false,
      reviewedBindingCount: countReviewedBindings(input.reviewedBindings, pinned),
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: input.teachingRelations?.length ?? 0,
      resolvedGoalTargetCount: 0,
      codes: portraitGate.codes,
    });
  }
  const portraitBasis = portraitGate.basis;

  // 4) Reviewed KAQ Canonical bindings, version-matched to pinned context
  const bindings = input.reviewedBindings ?? [];
  let mapping: ReviewedKaqRoleCanonicalMapping;
  try {
    if (bindings.length === 0 && !input.reviewedMapping) {
      return pending('missing-reviewed-kaq-bindings', {
        hasPreservedGoal,
        teachingProjectionAvailable: true,
        portraitAvailable: true,
        reviewedBindingCount: 0,
        admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
        teachingRelationCount: input.teachingRelations?.length ?? 0,
        resolvedGoalTargetCount: 0,
      });
    }
    mapping = input.reviewedMapping
      ? assertReviewedKaqRoleCanonicalMapping(
          input.reviewedMapping,
          pinned,
          bindings,
        )
      : buildReviewedKaqRoleCanonicalMapping({ bindings, pinned });
    if (mapping.bindingIds.length === 0) {
      return pending('missing-reviewed-kaq-bindings', {
        hasPreservedGoal,
        teachingProjectionAvailable: true,
        portraitAvailable: true,
        reviewedBindingCount: 0,
        admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
        teachingRelationCount: input.teachingRelations?.length ?? 0,
        resolvedGoalTargetCount: 0,
      });
    }
    if (mapping.pinnedContextDigest !== pinned.contextDigest) {
      return pending('reviewed-binding-version-mismatch', {
        hasPreservedGoal,
        teachingProjectionAvailable: true,
        portraitAvailable: true,
        reviewedBindingCount: mapping.bindingIds.length,
        admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
        teachingRelationCount: input.teachingRelations?.length ?? 0,
        resolvedGoalTargetCount: 0,
      });
    }
    if (
      mapping.releaseSetId !== pinned.releaseSetId
      || mapping.releaseId !== pinned.releaseId
    ) {
      return pending('coverage-version-mismatch', {
        hasPreservedGoal,
        teachingProjectionAvailable: true,
        portraitAvailable: true,
        reviewedBindingCount: mapping.bindingIds.length,
        admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
        teachingRelationCount: input.teachingRelations?.length ?? 0,
        resolvedGoalTargetCount: 0,
      });
    }
  } catch {
    return pending('reviewed-binding-version-mismatch', {
      hasPreservedGoal,
      teachingProjectionAvailable: true,
      portraitAvailable: true,
      reviewedBindingCount: countReviewedBindings(bindings, pinned),
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: input.teachingRelations?.length ?? 0,
      resolvedGoalTargetCount: 0,
    });
  }

  // 5) Goal resolution — registered goal targets through reviewed mapping only
  const goalId = preserved?.goalId ?? firstString(input.goalId);
  if (!goalId) {
    return pending('unresolved-goal', {
      hasPreservedGoal: false,
      teachingProjectionAvailable: true,
      portraitAvailable: true,
      reviewedBindingCount: mapping.bindingIds.length,
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: input.teachingRelations?.length ?? 0,
      resolvedGoalTargetCount: 0,
    });
  }

  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(goalId);
  if (!registeredGoal) {
    return pending('goal-not-resolvable-to-canonical', {
      hasPreservedGoal: true,
      teachingProjectionAvailable: true,
      portraitAvailable: true,
      reviewedBindingCount: mapping.bindingIds.length,
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: input.teachingRelations?.length ?? 0,
      resolvedGoalTargetCount: 0,
      codes: ['goal-not-registered'],
    });
  }

  const admitted = new Set(pinned.admittedCanonicalIds);
  const goalResolution = resolveGoalCanonicalTargets(registeredGoal, mapping, admitted);
  if (goalResolution.targetCanonicalIds.length === 0) {
    return pending('goal-not-resolvable-to-canonical', {
      hasPreservedGoal: true,
      teachingProjectionAvailable: true,
      portraitAvailable: true,
      reviewedBindingCount: mapping.bindingIds.length,
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: input.teachingRelations?.length ?? 0,
      resolvedGoalTargetCount: 0,
      codes: [
        'no-goal-targets-resolved',
        ...goalResolution.unresolvedRoleIds.slice(0, 8),
      ],
    });
  }

  // 6) Formal teaching relations — validate whole-set membership without rebuild,
  // then restrict to goal-relevant subgraph.
  const teachingRelations = input.teachingRelations ?? [];
  if (teachingRelations.length === 0) {
    return pending('no-supported-teaching-relations', {
      hasPreservedGoal: true,
      teachingProjectionAvailable: true,
      portraitAvailable: true,
      reviewedBindingCount: mapping.bindingIds.length,
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: 0,
      resolvedGoalTargetCount: goalResolution.targetCanonicalIds.length,
    });
  }

  // Whole-set closure: submitted relation-set digest must equal proof-bound digest
  // exposed by availability. Never remint/rebuild relations from partial identity.
  const submittedRelationSetDigest = digestFormalTeachingProjectionRelationSet(
    teachingRelations,
    {
      projectionId: availability.projectionId,
      projectionDigest: availability.projectionDigest,
    },
  );
  if (submittedRelationSetDigest !== availability.relationSetDigest) {
    return pending('mixed-version-identity', {
      hasPreservedGoal: true,
      teachingProjectionAvailable: true,
      portraitAvailable: true,
      reviewedBindingCount: mapping.bindingIds.length,
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: teachingRelations.length,
      resolvedGoalTargetCount: goalResolution.targetCanonicalIds.length,
      codes: ['relation-set-digest-mismatch'],
    });
  }

  const validatedRelations: ActkgTeachingProjectionRelation[] = [];
  const seenRelationIds = new Set<string>();
  for (const relation of teachingRelations) {
    const membership = validateSubmittedTeachingRelationMembership(
      relation,
      availability,
      pinned,
      admitted,
    );
    if (membership !== null) {
      return pending(membership.reason, {
        hasPreservedGoal: true,
        teachingProjectionAvailable: true,
        portraitAvailable: true,
        reviewedBindingCount: mapping.bindingIds.length,
        admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
        teachingRelationCount: teachingRelations.length,
        resolvedGoalTargetCount: goalResolution.targetCanonicalIds.length,
        codes: membership.codes,
      });
    }
    if (seenRelationIds.has(relation.id)) {
      return pending('mixed-version-identity', {
        hasPreservedGoal: true,
        teachingProjectionAvailable: true,
        portraitAvailable: true,
        reviewedBindingCount: mapping.bindingIds.length,
        admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
        teachingRelationCount: teachingRelations.length,
        resolvedGoalTargetCount: goalResolution.targetCanonicalIds.length,
        codes: ['duplicate-relation-id', relation.id],
      });
    }
    seenRelationIds.add(relation.id);
    // Preserve submitted identity — never rebuild via availability.
    validatedRelations.push(relation);
  }

  // Cycle detection on full formal graph first (invalid release surface).
  const cycleEdges = detectTeachingRelationCycles(
    validatedRelations.map((relation) => ({
      edgeId: relation.id,
      sourceId: relation.sourceCanonicalId,
      targetId: relation.targetCanonicalId,
      active: true,
    })),
  );
  if (cycleEdges.length > 0) {
    return pending('teaching-relation-cycle', {
      hasPreservedGoal: true,
      teachingProjectionAvailable: true,
      portraitAvailable: true,
      reviewedBindingCount: mapping.bindingIds.length,
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: validatedRelations.length,
      resolvedGoalTargetCount: goalResolution.targetCanonicalIds.length,
      codes: cycleEdges.slice(0, 8),
    });
  }

  // Restrict to goal-target subgraph + required prerequisite ancestors only.
  // Ready paths require at least one goal-relevant formal teaching relation —
  // never isolated targets or lexicographic target ordering alone.
  const relevant = selectGoalRelevantTeachingSubgraph(
    validatedRelations,
    new Set(goalResolution.targetCanonicalIds),
  );
  if (relevant.relations.length === 0) {
    return pending('no-goal-relevant-teaching-relations', {
      hasPreservedGoal: true,
      teachingProjectionAvailable: true,
      portraitAvailable: true,
      reviewedBindingCount: mapping.bindingIds.length,
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: validatedRelations.length,
      resolvedGoalTargetCount: goalResolution.targetCanonicalIds.length,
      codes: validatedRelations.length > 0
        ? ['relations-unrelated-to-goal-targets']
        : ['no-goal-relevant-relations'],
    });
  }

  const orderedCanonicalIds = orderGoalRelevantCanonicalIds(
    goalResolution.targetCanonicalIds,
    relevant,
  );
  if (orderedCanonicalIds.length === 0) {
    return pending('no-goal-relevant-teaching-relations', {
      hasPreservedGoal: true,
      teachingProjectionAvailable: true,
      portraitAvailable: true,
      reviewedBindingCount: mapping.bindingIds.length,
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: validatedRelations.length,
      resolvedGoalTargetCount: goalResolution.targetCanonicalIds.length,
      codes: ['no-goal-relevant-nodes'],
    });
  }

  // Reject if ordered path came only from unrelated relations (no target overlap).
  const targetSet = new Set(goalResolution.targetCanonicalIds);
  if (!orderedCanonicalIds.some((id) => targetSet.has(id))) {
    return pending('no-goal-relevant-teaching-relations', {
      hasPreservedGoal: true,
      teachingProjectionAvailable: true,
      portraitAvailable: true,
      reviewedBindingCount: mapping.bindingIds.length,
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: validatedRelations.length,
      resolvedGoalTargetCount: goalResolution.targetCanonicalIds.length,
    });
  }

  const versionClosure = buildVersionClosure({
    pinned,
    availability,
    portraitBasis,
    goalTargetCanonicalIds: goalResolution.targetCanonicalIds,
    reviewedMapping: mapping,
    teachingRelations: relevant.relations,
  });
  const pathId = buildCanonicalPathId({
    userId: input.userId,
    goalId,
    versionIdentityDigest: versionClosure.versionIdentityDigest,
  });

  const planNodes = buildPlanNodes(
    orderedCanonicalIds,
    relevant.relations,
    targetSet,
  );
  const nodeIds = planNodes.map((node) => node.nodeId);
  const entryNodeId = nodeIds[0] ?? null;
  const registeredLearningGoal = registeredGoal.learningGoal;
  const intent: PreservedLearningIntent = preserved ?? {
    schemaVersion: PRESERVED_LEARNING_INTENT_VERSION,
    sourcePathId: input.sourcePath?.id ?? pathId,
    goalId,
    goalTitle: registeredLearningGoal?.title ?? goalId,
    userIntent: null,
    intentType: registeredLearningGoal?.intentType ?? null,
    learningGoalVersion: registeredLearningGoal?.version ?? null,
    preservedAt: now.toISOString(),
    legacyNodeSequenceConstraint: false,
    legacyNodeIds: null,
  };

  // Historical source nodeIds are history only — collision check is defense-in-depth.
  if (Array.isArray(input.sourcePath?.nodeIds) && input.sourcePath.nodeIds.length > 0) {
    const legacyIds = new Set(
      input.sourcePath.nodeIds.filter((id): id is string => typeof id === 'string'),
    );
    if (nodeIds.some((id) => legacyIds.has(id))) {
      return failed('legacy-step-mapping-forbidden', {
        hasPreservedGoal: true,
        teachingProjectionAvailable: true,
        portraitAvailable: true,
        reviewedBindingCount: mapping.bindingIds.length,
        admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
        teachingRelationCount: relevant.relations.length,
        resolvedGoalTargetCount: goalResolution.targetCanonicalIds.length,
        codes: ['new-path-collided-with-legacy-node-ids'],
      });
    }
  }

  const path: CanonicalLearningPathDraft = {
    id: pathId,
    userId: input.userId,
    goalId,
    title: intent.goalTitle ?? registeredLearningGoal?.title ?? goalId,
    description: registeredLearningGoal?.description
      ?? 'Canonical teaching projection replan',
    estimatedTime: Math.max(planNodes.length * 10, 10),
    plannerVersion: CANONICAL_PATH_REPLAN_PLANNER_VERSION,
    pathStatus: 'active',
    knowledgeAuthority: 'CANONICAL',
    nodeIds,
    currentNodeId: entryNodeId,
    entryNodeId,
    versionClosure,
    planNodes,
    inheritedLegacyProgress: false,
    sourceStoppedPathId: intent.sourcePathId !== pathId ? intent.sourcePathId : null,
    preservedLearningIntent: {
      ...intent,
      legacyNodeSequenceConstraint: false,
      legacyNodeIds: null,
    },
    portraitPlanningBasis: portraitBasis,
    goalTargetCanonicalIds: goalResolution.targetCanonicalIds,
    pathPayload: {
      knowledgeAuthority: 'CANONICAL',
      versionClosure,
      mainPathNodeIds: nodeIds,
      planNodes,
      preservedLearningIntent: {
        ...intent,
        legacyNodeSequenceConstraint: false,
        legacyNodeIds: null,
      },
      portraitPlanningBasis: portraitBasis,
      goalTargetCanonicalIds: goalResolution.targetCanonicalIds,
      inheritedLegacyProgress: false,
      executionStatus: {
        activeNodeId: entryNodeId,
        completedNodeIds: [],
        failedNodeIds: [],
        skippedNodeIds: [],
      },
    },
    lastExecutionMetadata: {
      activeNodeId: entryNodeId,
      completedNodeIds: [],
      failedNodeIds: [],
      skippedNodeIds: [],
      availableEvidenceCount: 0,
    },
  };

  return {
    status: 'ready',
    path,
    diagnostics: buildDiagnostics({
      reason: 'ready',
      hasPreservedGoal: true,
      teachingProjectionAvailable: true,
      portraitAvailable: true,
      reviewedBindingCount: mapping.bindingIds.length,
      admittedCanonicalObjectCount: pinned.admittedCanonicalIds.length,
      teachingRelationCount: relevant.relations.length,
      resolvedGoalTargetCount: goalResolution.targetCanonicalIds.length,
      codes: ['canonical-replan-ready'],
    }),
  };
}

// ─── Goal resolution ────────────────────────────────────────────────────────

/**
 * Resolve registered goal knowledge targets through reviewed KAQ mapping.
 *
 * Authorized role sources:
 * - learningGoal.targetGraphNodeIds (KAQ role IDs)
 * - goal.knowledgeTargets that themselves appear as reviewed mapping keys
 * - knowledgeTargetAliases keys are Legacy IDs only — never used as Canonical
 *   endpoints; alias *keys* (knowledgeTargets) may resolve only when mapped as roles
 *
 * knowledgeObjectiveIds are not binding role IDs unless present in mapping.
 */
export function resolveGoalCanonicalTargets(
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition,
  mapping: ReviewedKaqRoleCanonicalMapping,
  admitted: ReadonlySet<string>,
): {
  targetCanonicalIds: string[];
  resolvedRoleIds: string[];
  unresolvedRoleIds: string[];
} {
  const roleCandidates = uniqueSorted([
    ...(registeredGoal.learningGoal?.targetGraphNodeIds ?? []),
    ...registeredGoal.goal.knowledgeTargets.filter(
      (target) => Object.prototype.hasOwnProperty.call(mapping.roleToCanonicalIds, target),
    ),
    ...(registeredGoal.learningGoal?.knowledgeObjectiveIds ?? []).filter(
      (objectiveId) => Object.prototype.hasOwnProperty.call(mapping.roleToCanonicalIds, objectiveId),
    ),
  ]);

  // Goal must declare knowledgeTargets; empty means unresolved.
  if (registeredGoal.goal.knowledgeTargets.length === 0 && roleCandidates.length === 0) {
    return { targetCanonicalIds: [], resolvedRoleIds: [], unresolvedRoleIds: [] };
  }

  const resolvedRoleIds: string[] = [];
  const unresolvedRoleIds: string[] = [];
  const targetCanonicalIds = new Set<string>();

  // Prefer targetGraphNodeIds as the binding-facing role set for the goal package.
  const primaryRoles = uniqueSorted([
    ...(registeredGoal.learningGoal?.targetGraphNodeIds ?? []),
    ...registeredGoal.goal.knowledgeTargets.filter(
      (target) => Object.prototype.hasOwnProperty.call(mapping.roleToCanonicalIds, target),
    ),
  ]);

  for (const roleId of primaryRoles) {
    const mapped = mapping.roleToCanonicalIds[roleId];
    if (!mapped || mapped.length === 0) {
      unresolvedRoleIds.push(roleId);
      continue;
    }
    let anyAdmitted = false;
    for (const canonicalId of mapped) {
      if (admitted.has(canonicalId)) {
        targetCanonicalIds.add(canonicalId);
        anyAdmitted = true;
      }
    }
    if (anyAdmitted) resolvedRoleIds.push(roleId);
    else unresolvedRoleIds.push(roleId);
  }

  // knowledgeTargets that are not roles still require the goal package's
  // targetGraphNodeIds to resolve; if none of the package roles resolved, fail.
  return {
    targetCanonicalIds: [...targetCanonicalIds].sort(),
    resolvedRoleIds: resolvedRoleIds.sort(),
    unresolvedRoleIds: unresolvedRoleIds.sort(),
  };
}

function selectGoalRelevantTeachingSubgraph(
  relations: readonly ActkgTeachingProjectionRelation[],
  targetCanonicalIds: ReadonlySet<string>,
): {
  nodeIds: Set<string>;
  relations: ActkgTeachingProjectionRelation[];
} {
  // Build reverse adjacency for prerequisite: target <- source
  const prereqParents = new Map<string, string[]>();
  for (const relation of relations) {
    if (relation.predicate !== 'prerequisite') continue;
    const list = prereqParents.get(relation.targetCanonicalId) ?? [];
    list.push(relation.sourceCanonicalId);
    prereqParents.set(relation.targetCanonicalId, list);
  }

  const nodeIds = new Set<string>(targetCanonicalIds);
  const queue = [...targetCanonicalIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const parent of prereqParents.get(current) ?? []) {
      if (nodeIds.has(parent)) continue;
      nodeIds.add(parent);
      queue.push(parent);
    }
  }

  // Include contains edges only when both ends are already in the selected set
  // or the contained object is a goal target / ancestor. Association edges are
  // not path-ordering constraints and are ignored for subgraph growth.
  const selectedRelations = relations.filter((relation) => {
    if (!nodeIds.has(relation.sourceCanonicalId) || !nodeIds.has(relation.targetCanonicalId)) {
      return false;
    }
    return relation.predicate === 'prerequisite' || relation.predicate === 'contains';
  });

  return { nodeIds, relations: selectedRelations };
}

function orderGoalRelevantCanonicalIds(
  targetCanonicalIds: readonly string[],
  relevant: { nodeIds: Set<string>; relations: ActkgTeachingProjectionRelation[] },
): string[] {
  if (relevant.relations.length === 0) return [];

  const prereqOrdered = topologicalOrderFromPrerequisites(
    relevant.relations.filter((r) => r.predicate === 'prerequisite'),
  ).filter((id) => relevant.nodeIds.has(id));

  if (prereqOrdered.length > 0) {
    // Append any selected targets missing from topo (ancestors already included).
    const seen = new Set(prereqOrdered);
    for (const id of [...relevant.nodeIds].sort()) {
      if (!seen.has(id)) prereqOrdered.push(id);
    }
    return prereqOrdered;
  }

  // Contains-only relevant graphs: order by appearance on relation endpoints.
  const fromContains = uniqueSorted(
    relevant.relations.flatMap((r) => [r.sourceCanonicalId, r.targetCanonicalId]),
  ).filter((id) => relevant.nodeIds.has(id));
  return fromContains;
}

// ─── Portrait closure ───────────────────────────────────────────────────────

type PortraitCloseResult =
  | { status: 'ready'; basis: CanonicalPortraitPlanningBasis; projected: PortraitV2ProjectedPayload }
  | { status: 'pending'; reason: CanonicalPathReplanPendingReason; codes: string[] };

function closeCumulativePortraitForReplan(input: {
  portrait: CumulativePortraitReadModel | null | undefined;
  userId: string;
  now: Date;
}): PortraitCloseResult {
  const portrait = input.portrait;
  if (!portrait) {
    return {
      status: 'pending',
      reason: 'missing-cumulative-portrait',
      codes: ['portrait-missing'],
    };
  }
  if (portrait.stateKind === 'NO_EVIDENCE') {
    return {
      status: 'pending',
      reason: 'portrait-unavailable',
      codes: ['no-evidence-snapshot'],
    };
  }
  if (portrait.stateKind !== 'SNAPSHOT') {
    return {
      status: 'pending',
      reason: 'missing-cumulative-portrait',
      codes: [portrait.availabilityReason ?? 'portrait-unavailable'],
    };
  }
  // Only fully available SNAPSHOT read-models may replan. Other availability
  // reasons (including non-available SNAPSHOT) stay pending for #1117 cutover.
  if (portrait.availabilityReason !== 'available') {
    return {
      status: 'pending',
      reason: 'portrait-unavailable',
      codes: [portrait.availabilityReason],
    };
  }
  if (!portrait.payload) {
    return {
      status: 'pending',
      reason: 'portrait-payload-invalid',
      codes: ['snapshot-payload-null'],
    };
  }

  let projected: PortraitV2ProjectedPayload;
  try {
    // Accept already-projected payloads or raw persistable shapes.
    validatePortraitV2Payload(portrait.payload, { now: input.now });
    projected = projectPortraitV2ForConsumer(
      portrait.payload as unknown as PortraitV2Payload,
      'planner',
      { now: input.now },
    );
  } catch {
    return {
      status: 'pending',
      reason: 'portrait-payload-invalid',
      codes: ['portrait-v2-contract-failed'],
    };
  }

  if (projected.userId !== input.userId) {
    return {
      status: 'pending',
      reason: 'portrait-learner-mismatch',
      codes: ['portrait-userId-mismatch'],
    };
  }

  if (!projected.generatedAt || !isIsoTimestamp(projected.generatedAt)) {
    return {
      status: 'pending',
      reason: 'portrait-payload-invalid',
      codes: ['portrait-generatedAt-invalid'],
    };
  }

  // Official read-model generatedAt is state-version materialization time and may
  // legitimately differ from payload.generatedAt (snapshot/evidence time). Require
  // each non-null timestamp to be valid ISO; do not require equality. Path portrait
  // content identity continues to use projected.payload.generatedAt only.
  if (portrait.generatedAt != null && !isIsoTimestamp(portrait.generatedAt)) {
    return {
      status: 'pending',
      reason: 'portrait-payload-invalid',
      codes: ['portrait-read-model-generatedAt-invalid'],
    };
  }

  const summary = summarizeCumulativePortraitV2(projected);
  const portraitIdentityDigest = createHash('sha256')
    .update(JSON.stringify({
      userId: projected.userId,
      payloadVersion: projected.payloadVersion,
      migrationVersion: projected.migrationVersion,
      generatedAt: projected.generatedAt,
      overallScore: summary.overallScore,
      confidence: summary.confidence,
      evidencedDimensionIds: summary.evidencedDimensionIds,
      missingDimensionIds: summary.missingDimensionIds,
      // Dimension scores only — no lineage/evidence refs.
      dimensionScores: projected.dimensions
        .map((dimension) => ({
          id: dimension.id,
          score: dimension.score,
          confidence: dimension.confidence,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }), 'utf8')
    .digest('hex');

  return {
    status: 'ready',
    projected,
    basis: {
      schemaVersion: CANONICAL_LEARNING_PATH_TRANSITION_VERSION,
      stateKind: 'SNAPSHOT',
      payloadVersion: projected.payloadVersion,
      migrationVersion: projected.migrationVersion,
      generatedAt: projected.generatedAt,
      portraitIdentityDigest,
      overallScore: summary.overallScore,
      confidence: summary.confidence,
      evidencedDimensionCount: summary.evidencedDimensionIds.length,
      missingDimensionCount: summary.missingDimensionIds.length,
    },
  };
}

// ─── Intent resolution ──────────────────────────────────────────────────────

function rejectRawLegacySequenceConstraint(
  value: PreservedLearningIntent | Record<string, unknown> | null | undefined,
): string[] | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const codes: string[] = [];
  if (record.legacyNodeSequenceConstraint === true) {
    codes.push('legacyNodeSequenceConstraint');
  }
  if (record.legacyNodeIds != null) {
    codes.push('legacyNodeIds');
  }
  return codes.length > 0 ? codes : null;
}

function resolvePreservedIntent(
  input: CanonicalPathReplanInput,
  now: Date,
): PreservedLearningIntent | null {
  if (input.preservedLearningIntent && typeof input.preservedLearningIntent === 'object') {
    const raw = input.preservedLearningIntent as Record<string, unknown>;
    // Already rejected sequence constraints above; normalize safe fields only.
    return {
      schemaVersion: PRESERVED_LEARNING_INTENT_VERSION,
      sourcePathId: firstString(raw.sourcePathId) ?? input.sourcePath?.id ?? 'unbound',
      goalId: firstString(raw.goalId, input.goalId),
      goalTitle: firstString(raw.goalTitle),
      userIntent: firstString(raw.userIntent),
      intentType: firstString(raw.intentType),
      learningGoalVersion: firstString(raw.learningGoalVersion),
      preservedAt: firstString(raw.preservedAt) ?? now.toISOString(),
      legacyNodeSequenceConstraint: false,
      legacyNodeIds: null,
    };
  }
  if (input.sourcePath) {
    const fromPayload = readPreservedLearningIntent(input.sourcePath);
    if (fromPayload) return fromPayload;
    return extractPreservedLearningIntent(
      {
        id: input.sourcePath.id,
        userId: input.userId,
        goalId: input.sourcePath.goalId ?? null,
        title: input.sourcePath.title ?? input.sourcePath.goalId ?? 'learning-path',
        pathStatus: input.sourcePath.pathStatus ?? null,
        nodeIds: input.sourcePath.nodeIds ?? [],
        plannerVersion: input.sourcePath.plannerVersion ?? null,
        pathPayload: input.sourcePath.pathPayload ?? {},
        inputSnapshot: input.sourcePath.inputSnapshot ?? null,
        explanationPayload: input.sourcePath.explanationPayload ?? null,
      } satisfies LegacyPathStopCandidate,
      now,
    );
  }
  if (input.goalId) {
    return {
      schemaVersion: PRESERVED_LEARNING_INTENT_VERSION,
      sourcePathId: 'unbound',
      goalId: input.goalId,
      goalTitle: null,
      userIntent: null,
      intentType: null,
      learningGoalVersion: null,
      preservedAt: now.toISOString(),
      legacyNodeSequenceConstraint: false,
      legacyNodeIds: null,
    };
  }
  return null;
}

// ─── Version identity ───────────────────────────────────────────────────────

function buildVersionClosure(input: {
  pinned: VerifiedKaqPinnedContext;
  availability: Extract<
    ReturnType<typeof resolveTeachingProjectionAvailability>,
    { available: true }
  >;
  portraitBasis: CanonicalPortraitPlanningBasis;
  goalTargetCanonicalIds: readonly string[];
  reviewedMapping: ReviewedKaqRoleCanonicalMapping;
  teachingRelations: readonly ActkgTeachingProjectionRelation[];
}): CanonicalPathVersionClosure {
  const reviewedMappingDigest = digestReviewedMapping(input.reviewedMapping);
  const teachingRelationSetDigest = digestTeachingRelationSet(input.teachingRelations);
  const base = {
    schemaVersion: CANONICAL_LEARNING_PATH_TRANSITION_VERSION,
    knowledgeAuthority: 'CANONICAL' as const,
    releaseSetId: input.pinned.releaseSetId,
    releaseId: input.pinned.releaseId,
    releaseHash: input.pinned.releaseHash,
    sourceDatasetHash: input.pinned.sourceDatasetHash,
    deltaReceiptId: input.pinned.deltaReceiptId,
    pinnedContextDigest: input.pinned.contextDigest,
    coverageOverlayId: input.pinned.coverageOverlayId,
    coverageOverlayVersion: input.pinned.coverageOverlayVersion,
    coverageSourceHash: input.pinned.coverageSourceHash,
    coverageCaptureRevision: input.pinned.coverageCaptureRevision,
    projectionId: input.availability.projectionId,
    projectionDigest: input.availability.projectionDigest,
    plannerVersion: CANONICAL_PATH_REPLAN_PLANNER_VERSION,
    portraitIdentityDigest: input.portraitBasis.portraitIdentityDigest,
    portraitGeneratedAt: input.portraitBasis.generatedAt,
    portraitPayloadVersion: input.portraitBasis.payloadVersion,
    portraitMigrationVersion: input.portraitBasis.migrationVersion,
    goalTargetCanonicalIds: [...input.goalTargetCanonicalIds].sort(),
    reviewedMappingDigest,
    teachingRelationSetDigest,
  };
  const versionIdentityDigest = createHash('sha256')
    .update(JSON.stringify(base), 'utf8')
    .digest('hex');
  return { ...base, versionIdentityDigest };
}

function digestReviewedMapping(mapping: ReviewedKaqRoleCanonicalMapping): string {
  const roleEntries = Object.keys(mapping.roleToCanonicalIds)
    .sort()
    .map((roleId) => ({
      roleId,
      canonicalIds: [...(mapping.roleToCanonicalIds[roleId] ?? [])].sort(),
    }));
  return createHash('sha256')
    .update(JSON.stringify({
      bindingIds: [...mapping.bindingIds].sort(),
      roleEntries,
      pinnedContextDigest: mapping.pinnedContextDigest,
      releaseSetId: mapping.releaseSetId,
      releaseId: mapping.releaseId,
    }), 'utf8')
    .digest('hex');
}

function digestTeachingRelationSet(
  relations: readonly ActkgTeachingProjectionRelation[],
): string {
  // Goal-relevant path-identity digest (subset). Whole-set membership is bound
  // separately via FormalTeachingProjectionProof.relationSetDigest.
  const rows = relations
    .map((relation) => ({
      id: relation.id,
      version: relation.version,
      predicate: relation.predicate,
      sourceCanonicalId: relation.sourceCanonicalId,
      targetCanonicalId: relation.targetCanonicalId,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256')
    .update(JSON.stringify(rows), 'utf8')
    .digest('hex');
}

/**
 * Field-by-field membership check for a submitted formal TP relation.
 * Does not rebuild or overwrite identity from availability.
 */
function validateSubmittedTeachingRelationMembership(
  relation: ActkgTeachingProjectionRelation,
  availability: Extract<
    ReturnType<typeof resolveTeachingProjectionAvailability>,
    { available: true }
  >,
  pinned: VerifiedKaqPinnedContext,
  admitted: ReadonlySet<string>,
): { reason: CanonicalPathReplanPendingReason; codes: string[] } | null {
  if (
    relation.namespace !== 'act-teaching-projection'
    || relation.authority !== 'ACT'
  ) {
    return {
      reason: 'no-supported-teaching-relations',
      codes: ['relation-authority-or-namespace-invalid', relation.id],
    };
  }
  if (!isActkgTeachingProjectionPredicate(relation.predicate)) {
    return {
      reason: 'no-supported-teaching-relations',
      codes: ['relation-predicate-invalid', relation.id],
    };
  }
  if (
    !relation.id?.trim()
    || !relation.version?.trim()
    || !relation.sourceCanonicalId?.trim()
    || !relation.targetCanonicalId?.trim()
  ) {
    return {
      reason: 'no-supported-teaching-relations',
      codes: ['relation-fields-incomplete', relation.id ?? ''],
    };
  }
  if (
    relation.releaseSetId !== availability.releaseSetId
    || relation.releaseId !== availability.releaseId
    || relation.pinnedContextDigest !== availability.pinnedContextDigest
    || relation.projectionId !== availability.projectionId
    || relation.projectionDigest !== availability.projectionDigest
    || relation.pinnedContextDigest !== pinned.contextDigest
    || relation.releaseSetId !== pinned.releaseSetId
    || relation.releaseId !== pinned.releaseId
  ) {
    return {
      reason: 'mixed-version-identity',
      codes: ['relation-identity-mismatch', relation.id],
    };
  }
  if (
    !admitted.has(relation.sourceCanonicalId)
    || !admitted.has(relation.targetCanonicalId)
  ) {
    return {
      reason: 'teaching-relation-out-of-coverage',
      codes: [relation.id],
    };
  }
  return null;
}

function buildCanonicalPathId(input: {
  userId: string;
  goalId: string;
  versionIdentityDigest: string;
}): string {
  const digest = createHash('sha256')
    .update(
      `canonical-path|${input.userId}|${input.goalId}|${input.versionIdentityDigest}`,
      'utf8',
    )
    .digest('hex')
    .slice(0, 24);
  return `canonical-path:${input.userId}:${input.goalId}:${digest}`;
}

function buildPlanNodes(
  orderedCanonicalIds: string[],
  relations: readonly ActkgTeachingProjectionRelation[],
  goalTargets: ReadonlySet<string>,
): CanonicalPathPlanNode[] {
  return orderedCanonicalIds.map((canonicalObjectId, index) => {
    const prereqIds = relations
      .filter(
        (r) => r.predicate === 'prerequisite' && r.targetCanonicalId === canonicalObjectId,
      )
      .map((r) => r.sourceCanonicalId)
      .sort();
    const relationIds = relations
      .filter(
        (r) => r.sourceCanonicalId === canonicalObjectId
          || r.targetCanonicalId === canonicalObjectId,
      )
      .map((r) => r.id)
      .sort();
    return {
      nodeId: `canonical-object:${canonicalObjectId}`,
      canonicalObjectId,
      title: canonicalObjectId,
      order: index,
      prerequisiteCanonicalIds: prereqIds,
      relationIds,
      isGoalTarget: goalTargets.has(canonicalObjectId),
    };
  });
}

function topologicalOrderFromPrerequisites(
  relations: readonly ActkgTeachingProjectionRelation[],
): string[] {
  if (relations.length === 0) return [];

  const nodes = new Set<string>();
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const edge of relations) {
    nodes.add(edge.sourceCanonicalId);
    nodes.add(edge.targetCanonicalId);
    if (!adjacency.has(edge.sourceCanonicalId)) adjacency.set(edge.sourceCanonicalId, []);
    adjacency.get(edge.sourceCanonicalId)!.push(edge.targetCanonicalId);
    indegree.set(
      edge.targetCanonicalId,
      (indegree.get(edge.targetCanonicalId) ?? 0) + 1,
    );
    if (!indegree.has(edge.sourceCanonicalId)) indegree.set(edge.sourceCanonicalId, 0);
  }

  const queue = [...nodes]
    .filter((node) => (indegree.get(node) ?? 0) === 0)
    .sort();
  const ordered: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    ordered.push(node);
    for (const next of (adjacency.get(node) ?? []).slice().sort()) {
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }
  if (ordered.length !== nodes.size) return [];
  return ordered;
}

// ─── Diagnostics helpers ────────────────────────────────────────────────────

function buildDiagnostics(
  partial: {
    reason: CanonicalPathReplanDiagnosticReason;
    hasPreservedGoal: boolean;
    teachingProjectionAvailable: boolean;
    portraitAvailable: boolean;
    reviewedBindingCount: number;
    admittedCanonicalObjectCount: number;
    teachingRelationCount: number;
    resolvedGoalTargetCount: number;
    codes?: string[];
  },
): CanonicalPathReplanDiagnostics {
  return {
    schemaVersion: CANONICAL_LEARNING_PATH_TRANSITION_VERSION,
    reason: partial.reason,
    codes: partial.codes ?? [partial.reason],
    teachingProjectionAvailable: partial.teachingProjectionAvailable,
    portraitAvailable: partial.portraitAvailable,
    reviewedBindingCount: partial.reviewedBindingCount,
    admittedCanonicalObjectCount: partial.admittedCanonicalObjectCount,
    teachingRelationCount: partial.teachingRelationCount,
    hasPreservedGoal: partial.hasPreservedGoal,
    resolvedGoalTargetCount: partial.resolvedGoalTargetCount,
  };
}

function pending(
  reason: CanonicalPathReplanPendingReason,
  partial: Omit<Parameters<typeof buildDiagnostics>[0], 'reason'>,
): CanonicalPathReplanResult {
  return {
    status: 'pending',
    path: null,
    reason,
    diagnostics: buildDiagnostics({ ...partial, reason }),
  };
}

function failed(
  reason: CanonicalPathReplanFailReason,
  partial: Omit<Parameters<typeof buildDiagnostics>[0], 'reason'>,
): CanonicalPathReplanResult {
  return {
    status: 'failed',
    path: null,
    reason,
    diagnostics: buildDiagnostics({ ...partial, reason }),
  };
}

function countReviewedBindings(
  bindings: readonly KaqCanonicalBinding[] | null | undefined,
  pinned: VerifiedKaqPinnedContext,
): number {
  if (!bindings || bindings.length === 0) return 0;
  try {
    return buildReviewedKaqRoleCanonicalMapping({ bindings, pinned }).bindingIds.length;
  } catch {
    return 0;
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
