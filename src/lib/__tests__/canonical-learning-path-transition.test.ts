import { describe, expect, it, vi } from 'vitest';

import {
  buildActkgTeachingProjectionRelation,
  buildReviewedKaqRoleCanonicalMapping,
  generateKaqCanonicalBindings,
  PINNED_KAQ_AGGREGATE_RELEASE_ID,
  PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
  PINNED_KAQ_COVERAGE_OVERLAY_ID,
  resolveTeachingProjectionAvailability,
  reviewKaqCanonicalBinding,
  type KaqCanonicalBinding,
  type VerifiedKaqPinnedContext,
} from '@/lib/canonical-kaq-binding';
import {
  mintFormalTeachingProjectionProofForTests,
  mintVerifiedKaqPinnedContextForTests,
} from '@/lib/canonical-kaq-binding/testing';
import {
  CANONICAL_PATH_REPLAN_PLANNER_VERSION,
  extractPreservedLearningIntent,
  isLearningPathWriteBlocked,
  LEGACY_STOPPED_PATH_STATUS,
  lockLearningPathRow,
  replanCanonicalLearningPath,
  stopUnfinishedLegacyLearningPathsAtCutover,
  type PreservedLearningIntent,
} from '@/lib/canonical-learning-path-transition';
import { assertPathMutableForWrite } from '@/app/api/learning-paths/route-helpers';
import {
  ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES,
  type AdaptiveLearningPathPlan,
} from '@/lib/adaptive-learning-path-planner';
import {
  getPathNodeSemanticsForResourceType,
  type ResourceNodeType,
} from '@/lib/resource-node-registry';
import {
  LearningPathMutationBlockedError,
  persistLearningPathRound,
  recordPathChoiceEvidence,
  recordPathDeviation,
  recordPathIntervention,
  recordPathNodeExecution,
  updateControlCorrectionPathRoundAfterExecution,
} from '@/lib/control-correction-path-rounds';
import type { CumulativePortraitReadModel } from '@/lib/data-governance/cumulative-portrait-read-model';
import {
  createPortraitV2Payload,
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_DIMENSION_IDS,
  projectPortraitV2ForConsumer,
} from '@/lib/data-governance/portrait-v2-model';
import { NextResponse } from 'next/server';

const releaseHash = 'a'.repeat(64);
const sourceDatasetHash = 'b'.repeat(64);
const coverageSourceHash = 'c'.repeat(64);
const coverageCaptureRevision = 'd'.repeat(40);
const deltaReceiptId = 'delta-receipt:accepted-aggregate-v1';

const GOAL_ROLES = [
  'kn:autocontrol:time-domain-performance',
  'kn:autocontrol:root-locus',
  'kn:autocontrol:controller-correction',
  'kn:autocontrol:simulation-validation',
] as const;

const GOAL_CANONICALS = [
  'ctr:object:time-domain-performance',
  'ctr:object:root-locus',
  'ctr:object:controller-correction',
  'ctr:object:simulation-validation',
] as const;

function pinned(admitted: readonly string[] = [...GOAL_CANONICALS]): VerifiedKaqPinnedContext {
  return mintVerifiedKaqPinnedContextForTests({
    releaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
    releaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
    releaseHash,
    sourceDatasetHash,
    deltaReceiptId,
    coverageOverlayId: PINNED_KAQ_COVERAGE_OVERLAY_ID,
    coverageOverlayVersion: '1',
    coverageSourceHash,
    coverageCaptureRevision,
    admittedCanonicalIds: [...admitted],
  });
}

function formalProof(context: VerifiedKaqPinnedContext) {
  return mintFormalTeachingProjectionProofForTests({
    pinned: context,
    projectionId: 'ctr:projection:teaching-v1',
    projectionDigest: '1'.repeat(64),
    formalReleaseAttestationId: 'attestation:teaching-projection-release-v1',
    formalReleaseAttestationDigest: '2'.repeat(64),
  });
}

function acceptBinding(
  binding: KaqCanonicalBinding,
  context: VerifiedKaqPinnedContext,
): KaqCanonicalBinding {
  return reviewKaqCanonicalBinding(
    binding,
    {
      bindingId: binding.id,
      outcome: 'ACCEPT',
      reviewIdentity: 'issue-1115-semantic-reviewer-v1',
      reviewRationale: 'Independent semantic alignment for path replan tests.',
    },
    context,
  );
}

/** Bind actual control-correction goal target role IDs. */
function reviewedGoalBindings(context: VerifiedKaqPinnedContext) {
  const generated = generateKaqCanonicalBindings({
    pinned: context,
    proposals: GOAL_ROLES.map((roleId, index) => ({
      kaqRoleId: roleId,
      targets: [{
        canonicalId: GOAL_CANONICALS[index]!,
        bindingRole: 'PRIMARY_IDENTITY' as const,
        evidenceRefs: [`e-${roleId}`],
        semanticRationale: `reviewed ${roleId}`,
        objectRevision: 'r1',
      }],
    })),
  });
  const bindings = generated.bindings.map((binding) => acceptBinding(binding, context));
  const mapping = buildReviewedKaqRoleCanonicalMapping({ bindings, pinned: context });
  return { bindings, mapping };
}

/** Unrelated feedback/TF bindings — must not satisfy control-correction. */
function reviewedUnrelatedBindings(context: VerifiedKaqPinnedContext) {
  const generated = generateKaqCanonicalBindings({
    pinned: context,
    proposals: [
      {
        kaqRoleId: 'kn:autocontrol:feedback-loop',
        targets: [{
          canonicalId: 'ctr:object:feedback-loop',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: ['e-feedback'],
          semanticRationale: 'unrelated feedback',
          objectRevision: 'r1',
        }],
      },
      {
        kaqRoleId: 'kn:autocontrol:transfer-function-model',
        targets: [{
          canonicalId: 'ctr:object:transfer-function',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: ['e-tf'],
          semanticRationale: 'unrelated tf',
          objectRevision: 'r1',
        }],
      },
    ],
  });
  const bindings = generated.bindings.map((binding) => acceptBinding(binding, context));
  return { bindings };
}

function portraitFor(
  userId: string,
  generatedAt = '2026-07-30T00:00:00.000Z',
): CumulativePortraitReadModel {
  const payload = createPortraitV2Payload({
    userId,
    generatedAt,
    now: generatedAt,
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id, index) => ({
      id,
      score: 60 + index,
      confidence: 0.8,
      freshness: { state: 'current', asOf: generatedAt, evidenceAgeDays: 0 },
      evidenceSummary: { totalCount: 4, sourceFamilyCounts: { LearningFact: 4 } },
      lastPositiveEvidenceAt: generatedAt,
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [
        { kind: 'evidence-family', ref: 'LearningFact', privacyScope: 'student-visible' },
      ],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
  });
  const projected = projectPortraitV2ForConsumer(payload, 'planner', { now: generatedAt });
  return {
    stateKind: 'SNAPSHOT',
    payload: projected,
    overallScore: 0.72,
    dimensionCoverage: { evidencedDimensionIds: [], missingDimensionIds: [] },
    evidenceAsOf: generatedAt,
    confidence: 0.8,
    lastTrend: 'stable',
    lastRisk: [],
    availabilityReason: 'available',
    generatedAt,
  };
}

function goalTeachingRelations(context: VerifiedKaqPinnedContext) {
  const availability = resolveTeachingProjectionAvailability({
    pinned: context,
    formalProof: formalProof(context),
  });
  if (!availability.available) throw new Error('expected teaching projection');
  return [
    buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-rel:td-prereq-rl',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:time-domain-performance',
      targetCanonicalId: 'ctr:object:root-locus',
      version: 'tp-rel/v1',
    }),
    buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-rel:rl-prereq-cc',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:root-locus',
      targetCanonicalId: 'ctr:object:controller-correction',
      version: 'tp-rel/v1',
    }),
    buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-rel:cc-prereq-sim',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:controller-correction',
      targetCanonicalId: 'ctr:object:simulation-validation',
      version: 'tp-rel/v1',
    }),
  ];
}

function unrelatedTeachingRelations(context: VerifiedKaqPinnedContext) {
  // Expand coverage to include unrelated objects for this fixture.
  const availability = resolveTeachingProjectionAvailability({
    pinned: context,
    formalProof: formalProof(context),
  });
  if (!availability.available) throw new Error('expected teaching projection');
  return [
    buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-rel:feedback-prereq-tf',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-rel/v1',
    }),
  ];
}

function legacyPathRow(overrides: Partial<{
  id: string;
  userId: string;
  goalId: string | null;
  title: string;
  pathStatus: string | null;
  nodeIds: string[];
  plannerVersion: string | null;
  pathPayload: Record<string, unknown>;
  inputSnapshot: Record<string, unknown> | null;
}> = {}) {
  return {
    id: overrides.id ?? 'legacy-path-1',
    userId: overrides.userId ?? 'student-1',
    goalId: overrides.goalId === undefined ? 'control-correction' : overrides.goalId,
    title: overrides.title ?? '控制系统校正设计',
    pathStatus: overrides.pathStatus === undefined ? 'active' : overrides.pathStatus,
    nodeIds: overrides.nodeIds ?? [
      'knowledge-card:control-correction-time-domain-targets',
      'arena-task:task-second-order-lead-pid',
    ],
    plannerVersion: overrides.plannerVersion ?? 'stage-1-rules-graph',
    pathPayload: overrides.pathPayload ?? {
      goalId: 'control-correction',
      mainPathNodeIds: [
        'knowledge-card:control-correction-time-domain-targets',
        'arena-task:task-second-order-lead-pid',
      ],
      planNodes: [
        { nodeId: 'knowledge-card:control-correction-time-domain-targets', type: 'knowledge_card' },
        { nodeId: 'arena-task:task-second-order-lead-pid', type: 'arena_task' },
      ],
      learningGoal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        intentType: 'controller-design',
        version: 'learning-goal-package/v1',
      },
    },
    inputSnapshot: overrides.inputSnapshot ?? { userIntent: '完成校正设计闭环' },
    explanationPayload: {},
  };
}

function stopDb(rows: ReturnType<typeof legacyPathRow>[]) {
  const store = new Map(rows.map((row) => [row.id, {
    ...row,
    pathPayload: { ...row.pathPayload },
  }]));
  return {
    learningPath: {
      findMany: vi.fn(async () => [...store.values()]),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => store.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const current = store.get(where.id);
        if (!current) throw new Error(`missing path ${where.id}`);
        const next = {
          ...current,
          ...data,
          pathPayload: data.pathPayload
            ? { ...(data.pathPayload as Record<string, unknown>) }
            : current.pathPayload,
        };
        store.set(where.id, next as typeof current);
        return next;
      }),
      updateMany: vi.fn(async ({ where, data }: {
        where: { id?: string; pathStatus?: unknown; OR?: unknown[] };
        data: Record<string, unknown>;
      }) => {
        const id = where.id;
        if (!id || !store.has(id)) return { count: 0 };
        const current = store.get(id)!;
        const status = current.pathStatus;
        const unfinished = status == null
          || status === 'active'
          || status === 'fallback'
          || status === 'legacy';
        if (!unfinished) return { count: 0 };
        store.set(id, {
          ...current,
          ...data,
          pathPayload: data.pathPayload
            ? { ...(data.pathPayload as Record<string, unknown>) }
            : current.pathPayload,
        } as typeof current);
        return { count: 1 };
      }),
    },
    store,
  };
}

describe('canonical learning path transition — stop Legacy paths', () => {
  it('stops active unfinished Legacy paths idempotently without rewriting goalId', async () => {
    const db = stopDb([legacyPathRow({
      goalId: 'control-correction',
      pathPayload: {
        goalId: 'payload-should-not-overwrite-column',
        mainPathNodeIds: ['legacy-a'],
        planNodes: [{ nodeId: 'legacy-a' }],
      },
    })]);
    const first = await stopUnfinishedLegacyLearningPathsAtCutover(db, {
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(first.stoppedPathIds).toEqual(['legacy-path-1']);

    const stopped = db.store.get('legacy-path-1')!;
    expect(stopped.pathStatus).toBe(LEGACY_STOPPED_PATH_STATUS);
    expect(stopped.goalId).toBe('control-correction');
    expect(stopped.nodeIds).toEqual([
      'knowledge-card:control-correction-time-domain-targets',
      'arena-task:task-second-order-lead-pid',
    ]);
    expect(stopped.plannerVersion).toBe('stage-1-rules-graph');
    expect(stopped.pathPayload.mainPathNodeIds).toEqual(['legacy-a']);
    expect(stopped.pathPayload.preservedLearningIntent).toMatchObject({
      goalId: 'control-correction',
      legacyNodeSequenceConstraint: false,
      legacyNodeIds: null,
    });

    const second = await stopUnfinishedLegacyLearningPathsAtCutover(db);
    expect(second.stoppedPathIds).toEqual([]);
    expect(second.alreadyStoppedPathIds).toEqual(['legacy-path-1']);
  });

  it('does not rewrite completed paths', async () => {
    const db = stopDb([
      legacyPathRow({ id: 'completed-1', pathStatus: 'completed' }),
      legacyPathRow({ id: 'active-1', pathStatus: 'active' }),
    ]);
    const result = await stopUnfinishedLegacyLearningPathsAtCutover(db);
    expect(result.skippedCompletedPathIds).toEqual(['completed-1']);
    expect(result.stoppedPathIds).toEqual(['active-1']);
    expect(db.store.get('completed-1')!.pathStatus).toBe('completed');
  });

  it('preserves goal/intent independently from Legacy steps', () => {
    const path = legacyPathRow({
      nodeIds: ['legacy-a', 'legacy-b', 'legacy-c'],
      inputSnapshot: { userIntent: '想学会超前校正' },
    });
    const intent = extractPreservedLearningIntent(path, new Date('2026-07-30T00:00:00.000Z'));
    expect(intent).toMatchObject({
      goalId: 'control-correction',
      userIntent: '想学会超前校正',
      legacyNodeSequenceConstraint: false,
      legacyNodeIds: null,
    });
    expect(JSON.stringify(intent)).not.toContain('legacy-a');
  });
});

describe('canonical learning path transition — mutation fail-closed', () => {
  function stoppedDb() {
    const stoppedPath = {
      id: 'legacy-path-1',
      userId: 'student-1',
      goalId: 'control-correction',
      pathStatus: LEGACY_STOPPED_PATH_STATUS,
      pathPayload: {
        legacyArchiveState: LEGACY_STOPPED_PATH_STATUS,
        readOnlyStopped: true,
        mainPathNodeIds: ['legacy-a'],
        selectionHistory: [],
        activity: [],
      },
    };
    return {
      stoppedPath,
      db: {
        learningPath: {
          findFirst: vi.fn(async () => stoppedPath),
          update: vi.fn(),
          updateMany: vi.fn(async () => ({ count: 0 })),
          upsert: vi.fn(),
        },
        learningPathExecution: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async ({ data }: { data: unknown }) => data),
        },
        learningPathDeviation: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async ({ data }: { data: unknown }) => data),
        },
        learningPathIntervention: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async ({ data }: { data: unknown }) => data),
        },
        evidenceOutbox: {
          createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
        },
        learningFact: {
          createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
        },
      },
    };
  }

  it('blocks execution, deviation, intervention, choice, and path-round update services', async () => {
    const { db, stoppedPath } = stoppedDb();
    expect(isLearningPathWriteBlocked(stoppedPath)).toBe(true);

    await expect(recordPathNodeExecution(db as any, {
      pathId: 'legacy-path-1',
      userId: 'student-1',
      nodeId: 'legacy-a',
      resourceType: 'knowledge_card',
      status: 'started',
      idempotencyKey: 'exec-1',
    })).rejects.toBeInstanceOf(LearningPathMutationBlockedError);

    await expect(recordPathDeviation(db as any, {
      pathId: 'legacy-path-1',
      userId: 'student-1',
      deviationType: 'skip',
      targetNodeId: 'legacy-a',
      idempotencyKey: 'dev-1',
    })).rejects.toBeInstanceOf(LearningPathMutationBlockedError);

    await expect(recordPathIntervention(db as any, {
      pathId: 'legacy-path-1',
      userId: 'student-1',
      interventionKind: 'hint',
      suggestedAction: 'review basics',
      privacySafeSummary: 'hint',
      idempotencyKey: 'int-1',
    })).rejects.toBeInstanceOf(LearningPathMutationBlockedError);

    await expect(recordPathChoiceEvidence(db as any, {
      pathId: 'legacy-path-1',
      userId: 'student-1',
      goalId: 'control-correction',
      action: 'selection',
      selectedStyleId: 'foundation-remediation',
      idempotencyKey: 'choice-1',
    })).rejects.toBeInstanceOf(LearningPathMutationBlockedError);

    await expect(updateControlCorrectionPathRoundAfterExecution(db as any, stoppedPath, {
      pathId: 'legacy-path-1',
      userId: 'student-1',
      nodeId: 'legacy-a',
      resourceType: 'knowledge_card',
      status: 'completed',
    })).rejects.toBeInstanceOf(LearningPathMutationBlockedError);

    expect(db.learningPathExecution.create).not.toHaveBeenCalled();
    expect(db.learningPathDeviation.create).not.toHaveBeenCalled();
    expect(db.learningPathIntervention.create).not.toHaveBeenCalled();
    expect(db.learningPath.update).not.toHaveBeenCalled();
  });

  it('returns consistent 409 API guard payload for stopped paths', () => {
    const response = assertPathMutableForWrite({
      id: 'legacy-path-1',
      pathStatus: LEGACY_STOPPED_PATH_STATUS,
      pathPayload: { legacyArchiveState: LEGACY_STOPPED_PATH_STATUS },
    });
    expect(response).toBeInstanceOf(NextResponse);
    expect(response?.status).toBe(409);
  });

  it('closes cutover race: write that loses the fence cannot commit after stop', async () => {
    let pathStatus: string = 'active';
    let lockHeld = false;
    const waiters: Array<() => void> = [];
    const acquire = async () => {
      if (!lockHeld) {
        lockHeld = true;
        return;
      }
      await new Promise<void>((resolve) => waiters.push(resolve));
      lockHeld = true;
    };
    const release = () => {
      lockHeld = false;
      const next = waiters.shift();
      if (next) next();
    };

    const creates: unknown[] = [];
    const db = {
      $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
        await acquire();
        try {
          return await fn(db);
        } finally {
          release();
        }
      }),
      learningPath: {
        findFirst: vi.fn(async () => ({
          id: 'legacy-path-1',
          pathStatus,
          pathPayload: {},
          userId: 'student-1',
          goalId: 'control-correction',
        })),
        findMany: vi.fn(async () => [{
          id: 'legacy-path-1',
          userId: 'student-1',
          goalId: 'control-correction',
          title: 'path',
          pathStatus,
          nodeIds: ['legacy-a'],
          plannerVersion: 'stage-1-rules-graph',
          pathPayload: {},
          inputSnapshot: null,
          explanationPayload: {},
        }]),
        update: vi.fn(async ({ data }: { data: { pathStatus?: string } }) => {
          if (data.pathStatus) pathStatus = data.pathStatus;
          return { id: 'legacy-path-1', pathStatus };
        }),
        updateMany: vi.fn(async ({ data }: { data: { pathStatus?: string } }) => {
          if (pathStatus === LEGACY_STOPPED_PATH_STATUS) return { count: 0 };
          if (data.pathStatus) pathStatus = data.pathStatus;
          return { count: 1 };
        }),
      },
      learningPathExecution: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: unknown }) => {
          creates.push(data);
          return data;
        }),
      },
    };

    // Start a write that will hold the fence after reading active status.
    let writeGateResolve!: () => void;
    const writeGate = new Promise<void>((resolve) => { writeGateResolve = resolve; });
    db.learningPath.findFirst = vi.fn(async () => {
      // Pause inside the write fence after lock acquired / status read.
      if (pathStatus === 'active') await writeGate;
      return {
        id: 'legacy-path-1',
        pathStatus,
        pathPayload: {},
        userId: 'student-1',
        goalId: 'control-correction',
      };
    });

    const writePromise = recordPathNodeExecution(db as any, {
      pathId: 'legacy-path-1',
      userId: 'student-1',
      nodeId: 'legacy-a',
      resourceType: 'knowledge_card',
      status: 'started',
      idempotencyKey: 'race-exec',
    });

    // Allow write to enter transaction and reach the pause.
    await new Promise((r) => setTimeout(r, 10));

    // Stop cannot finish while write holds the serializable lock — release write
    // first after we flip status underneath the re-check.
    pathStatus = LEGACY_STOPPED_PATH_STATUS;
    writeGateResolve();

    await expect(writePromise).rejects.toBeInstanceOf(LearningPathMutationBlockedError);
    expect(creates).toHaveLength(0);
  });

  function pathNodeSemantics(type: ResourceNodeType) {
    const semantics = getPathNodeSemanticsForResourceType(type);
    return {
      pathNodeType: semantics.type,
      displayName: semantics.displayName,
      iconKey: semantics.iconKey,
      shapeHint: semantics.shapeHint,
      evidenceBehavior: semantics.evidenceBehavior,
      evidenceStatus: 'instrumented' as const,
      externalResource: null,
      checkpoint: null,
    };
  }

  function samplePersistPlan(pathId = 'adaptive-path:student-1:control-correction'): AdaptiveLearningPathPlan {
    return {
      id: pathId,
      userId: 'student-1',
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: ['control-correction:arena-transfer'],
        competencyTargets: ['crossDomainTransfer'],
      },
      stage: 'stage-1-rules-graph',
      policyFamily: 'rules-plus-graph-search',
      policyMetadata: ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES['rules-plus-graph-search'],
      excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
      status: 'ready',
      currentNodeId: 'knowledge-card:control-correction-time-domain-targets',
      mainPath: [
        {
          nodeId: 'knowledge-card:control-correction-time-domain-targets',
          title: '时域指标知识卡',
          type: 'knowledge_card',
          ...pathNodeSemantics('knowledge_card'),
          sourceKind: 'knowledge_graph',
          sourceRef: 'control-correction:time-domain-targets:card',
          target: 'course-content/runtime/knowledge/cards/nodes/时域指标到目标极点区域_3_36001.md',
          estimatedTimeMinutes: 8,
          prerequisiteNodeIds: [],
          knowledgeCoverage: ['control-correction:time-domain-targets'],
          teacherPolicy: 'allowed',
          privacyLevel: 'student-visible',
          terminalConstraints: [],
          score: 0.8,
          reasonCodes: ['matches-knowledge-deficit'],
          status: 'current',
        },
        {
          nodeId: 'arena-task:task-second-order-lead-pid',
          title: '二阶对象超前校正 Arena',
          type: 'arena_task',
          ...pathNodeSemantics('arena_task'),
          sourceKind: 'arena_task',
          sourceRef: 'task-second-order-lead-pid',
          target: '/arena/challenges/task-second-order-lead-pid',
          estimatedTimeMinutes: 18,
          prerequisiteNodeIds: ['simulation:control-correction-step-response-lab'],
          knowledgeCoverage: ['control-correction:arena-transfer'],
          teacherPolicy: 'allowed',
          privacyLevel: 'student-visible',
          terminalConstraints: ['terminal-node', 'terminal-validation'],
          score: 1.2,
          reasonCodes: ['matches-competency-deficit'],
          status: 'next',
        },
      ],
      alternatives: [],
      score: {
        total: 0.88,
        objectives: {
          learningGain: 1,
          engagement: 0.4,
          constraintSatisfaction: 1,
          diversity: 0.5,
          fatigue: 0.7,
          dropoutRisk: 0.8,
        },
      },
      confidence: { level: 'medium', score: 0.72, sourceCoverage: 0.7 },
      explanations: {
        selectedReasons: ['matches-knowledge-deficit'],
        rejectedAlternatives: [],
        fallbackReasons: [],
      },
      executionStatus: {
        adopted: false,
        completedNodeIds: [],
        activeNodeId: 'knowledge-card:control-correction-time-domain-targets',
        updatedAt: '2026-06-04T08:00:00.000Z',
      },
      deviations: [],
      corrections: [],
      feedbackEvents: [],
      visualization: {
        map: {
          mainPathNodeIds: [
            'knowledge-card:control-correction-time-domain-targets',
            'arena-task:task-second-order-lead-pid',
          ],
          branchPaths: [],
          currentNodeId: 'knowledge-card:control-correction-time-domain-targets',
          completedNodeIds: [],
          riskNodeIds: [],
          blockedNodes: [],
          alternatives: [],
        },
        timeline: { generatedAt: '2026-06-04T08:00:00.000Z' },
      },
      studentFacing: { summary: 'path', nextAction: 'continue' },
    } as unknown as AdaptiveLearningPathPlan;
  }

  it('rejects persistLearningPathRound on stopped Legacy paths (no reactivate via upsert)', async () => {
    const { db } = stoppedDb();
    // Align stopped path id with valid plan id contract.
    const stoppedPath = {
      id: 'adaptive-path:student-1:control-correction',
      userId: 'student-1',
      goalId: 'control-correction',
      pathStatus: LEGACY_STOPPED_PATH_STATUS,
      pathPayload: {
        legacyArchiveState: LEGACY_STOPPED_PATH_STATUS,
        readOnlyStopped: true,
        selectionHistory: [],
        activity: [],
      },
    };
    db.learningPath.findFirst = vi.fn(async () => stoppedPath) as typeof db.learningPath.findFirst;
    db.learningPath.upsert = vi.fn(async () => {
      throw new Error('upsert must not run for stopped path');
    }) as typeof db.learningPath.upsert;

    await expect(persistLearningPathRound(db as any, {
      plan: samplePersistPlan(),
    })).rejects.toBeInstanceOf(LearningPathMutationBlockedError);
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  /**
   * Transaction-capable fake with real mutual exclusion: only one $transaction
   * body runs at a time (Serializable stand-in). Every write is tracked by the
   * tx instance identity so tests prove no outer-delegate escape.
   */
  function createTransactionalPathDb(initialStatus: string = 'active') {
    const PATH_ID = 'adaptive-path:student-1:control-correction';
    let pathStatus = initialStatus;
    let pathPayload: Record<string, unknown> = {
      selectionHistory: [],
      activity: [],
      mainPathNodeIds: ['knowledge-card:control-correction-time-domain-targets'],
    };
    let lockHeld = false;
    const waiters: Array<() => void> = [];
    const acquire = async () => {
      if (!lockHeld) {
        lockHeld = true;
        return;
      }
      await new Promise<void>((resolve) => waiters.push(resolve));
      lockHeld = true;
    };
    const release = () => {
      lockHeld = false;
      const next = waiters.shift();
      if (next) next();
    };

    const writeLog: Array<{ op: string; txId: number; pathStatus?: string }> = [];
    let txSeq = 0;
    // Gates controlled by tests (resolved inside a held transaction).
    let afterPersistLockResolve: (() => void) | null = null;
    let afterPersistLock: Promise<void> | null = null;
    let afterCutoverLockResolve: (() => void) | null = null;
    let afterCutoverLock: Promise<void> | null = null;

    const armPersistHold = () => {
      afterPersistLock = new Promise<void>((resolve) => {
        afterPersistLockResolve = resolve;
      });
    };
    const releasePersistHold = () => {
      afterPersistLockResolve?.();
      afterPersistLock = null;
      afterPersistLockResolve = null;
    };
    const armCutoverHold = () => {
      afterCutoverLock = new Promise<void>((resolve) => {
        afterCutoverLockResolve = resolve;
      });
    };
    const releaseCutoverHold = () => {
      afterCutoverLockResolve?.();
      afterCutoverLock = null;
      afterCutoverLockResolve = null;
    };

    const row = () => ({
      id: PATH_ID,
      userId: 'student-1',
      goalId: 'control-correction',
      title: '控制系统校正设计',
      pathStatus,
      nodeIds: ['knowledge-card:control-correction-time-domain-targets'],
      plannerVersion: 'stage-1-rules-graph',
      pathPayload: { ...pathPayload },
      inputSnapshot: null,
      explanationPayload: {},
    });

    const makeTx = (txId: number) => {
      const learningPath = {
        findFirst: vi.fn(async () => {
          // Persist path: first lock/read can optionally hold for interleaving.
          if (afterPersistLock && writeLog.every((e) => e.txId !== txId || e.op !== 'persist-find')) {
            writeLog.push({ op: 'persist-find', txId });
            await afterPersistLock;
          }
          return {
            id: PATH_ID,
            userId: 'student-1',
            goalId: 'control-correction',
            pathStatus,
            pathPayload: { ...pathPayload },
          };
        }),
        findMany: vi.fn(async () => {
          if (afterCutoverLock && writeLog.every((e) => e.txId !== txId || e.op !== 'cutover-findMany')) {
            writeLog.push({ op: 'cutover-findMany', txId });
            await afterCutoverLock;
          }
          return [row()];
        }),
        update: vi.fn(async ({ data }: {
          data: { pathStatus?: string; pathPayload?: Record<string, unknown> };
        }) => {
          writeLog.push({ op: 'update', txId, pathStatus: data.pathStatus });
          if (data.pathStatus) pathStatus = data.pathStatus;
          if (data.pathPayload) pathPayload = { ...data.pathPayload };
          return row();
        }),
        updateMany: vi.fn(async ({ data }: {
          data: { pathStatus?: string; pathPayload?: Record<string, unknown> };
        }) => {
          const unfinished = pathStatus == null
            || pathStatus === 'active'
            || pathStatus === 'fallback'
            || pathStatus === 'legacy';
          if (!unfinished) {
            writeLog.push({ op: 'updateMany-skip', txId, pathStatus });
            return { count: 0 };
          }
          writeLog.push({ op: 'updateMany', txId, pathStatus: data.pathStatus });
          if (data.pathStatus) pathStatus = data.pathStatus;
          if (data.pathPayload) pathPayload = { ...data.pathPayload };
          return { count: 1 };
        }),
        upsert: vi.fn(async ({ update }: { update: { pathStatus?: string } }) => {
          writeLog.push({ op: 'upsert', txId, pathStatus: update.pathStatus });
          if (update.pathStatus) pathStatus = update.pathStatus;
          return row();
        }),
      };
      return { learningPath, __txId: txId };
    };

    // Outer delegates must not receive writes when $transaction is used.
    const outerWrites: string[] = [];
    const outerLearningPath = {
      findFirst: vi.fn(async () => {
        outerWrites.push('outer-findFirst');
        return row();
      }),
      findMany: vi.fn(async () => {
        outerWrites.push('outer-findMany');
        return [row()];
      }),
      update: vi.fn(async () => {
        outerWrites.push('outer-update');
        throw new Error('outer learningPath.update must not be used inside $transaction');
      }),
      updateMany: vi.fn(async () => {
        outerWrites.push('outer-updateMany');
        throw new Error('outer learningPath.updateMany must not be used inside $transaction');
      }),
      upsert: vi.fn(async () => {
        outerWrites.push('outer-upsert');
        throw new Error('outer learningPath.upsert must not be used inside $transaction');
      }),
    };

    const db = {
      $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
        await acquire();
        const txId = ++txSeq;
        try {
          return await fn(makeTx(txId));
        } finally {
          release();
        }
      }),
      learningPath: outerLearningPath,
      getStatus: () => pathStatus,
      getWriteLog: () => [...writeLog],
      getOuterWrites: () => [...outerWrites],
      armPersistHold,
      releasePersistHold,
      armCutoverHold,
      releaseCutoverHold,
      PATH_ID,
    };
    return db;
  }

  it('persist-first: cutover waits on fence then stops; final status is legacy-stopped', async () => {
    const db = createTransactionalPathDb('active');
    db.armPersistHold();

    const persistPromise = persistLearningPathRound(db as any, {
      plan: samplePersistPlan(db.PATH_ID),
    });

    // Wait until persist holds the exclusive transaction.
    await new Promise((r) => setTimeout(r, 15));

    const stopPromise = stopUnfinishedLegacyLearningPathsAtCutover(db as any, {
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    // Cutover is blocked on mutex while persist holds the fence.
    await new Promise((r) => setTimeout(r, 15));
    expect(db.getStatus()).toBe('active');

    // Complete persist (upsert active inside tx), then cutover runs and stops.
    db.releasePersistHold();
    await persistPromise;
    const stopResult = await stopPromise;

    expect(stopResult.stoppedPathIds).toContain(db.PATH_ID);
    expect(db.getStatus()).toBe(LEGACY_STOPPED_PATH_STATUS);

    const log = db.getWriteLog();
    expect(log.some((e) => e.op === 'upsert' && e.pathStatus === 'active')).toBe(true);
    expect(log.some((e) => e.op === 'updateMany' && e.pathStatus === LEGACY_STOPPED_PATH_STATUS)).toBe(true);
    // Upsert tx must finish before cutover stop write (serialized by mutex).
    const upsertIdx = log.findIndex((e) => e.op === 'upsert');
    const stopIdx = log.findIndex((e) => e.op === 'updateMany' && e.pathStatus === LEGACY_STOPPED_PATH_STATUS);
    expect(upsertIdx).toBeGreaterThanOrEqual(0);
    expect(stopIdx).toBeGreaterThan(upsertIdx);
    expect(db.getOuterWrites().filter((w) => w.startsWith('outer-update') || w === 'outer-upsert' || w === 'outer-updateMany')).toEqual([]);
  });

  it('cutover-first: persist reads stopped under fence and refuses reactivation', async () => {
    const db = createTransactionalPathDb('active');
    db.armCutoverHold();

    const stopPromise = stopUnfinishedLegacyLearningPathsAtCutover(db as any, {
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    // Wait until cutover holds the exclusive transaction.
    await new Promise((r) => setTimeout(r, 15));

    const persistPromise = persistLearningPathRound(db as any, {
      plan: samplePersistPlan(db.PATH_ID),
    });

    // Persist is blocked; complete cutover stop first.
    await new Promise((r) => setTimeout(r, 15));
    db.releaseCutoverHold();
    const stopResult = await stopPromise;
    expect(stopResult.stoppedPathIds).toContain(db.PATH_ID);
    expect(db.getStatus()).toBe(LEGACY_STOPPED_PATH_STATUS);

    await expect(persistPromise).rejects.toBeInstanceOf(LearningPathMutationBlockedError);
    expect(db.getStatus()).toBe(LEGACY_STOPPED_PATH_STATUS);
    expect(db.getWriteLog().some((e) => e.op === 'upsert')).toBe(false);
    expect(db.getOuterWrites().filter((w) => w === 'outer-upsert' || w === 'outer-update' || w === 'outer-updateMany')).toEqual([]);
  });

  it('fails closed when transaction client lacks upsert (no outer fallback)', async () => {
    const db = {
      $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn({
        learningPath: {
          findFirst: vi.fn(async () => null),
          // intentionally no upsert
        },
      })),
      learningPath: {
        findFirst: vi.fn(async () => null),
        upsert: vi.fn(async () => {
          throw new Error('outer upsert must not run');
        }),
      },
    };

    await expect(persistLearningPathRound(db as any, {
      plan: samplePersistPlan(),
    })).rejects.toThrow(/upsert must be available on the write-fence transaction client/);
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('propagates $queryRaw errors from lockLearningPathRow without ORM fallback', async () => {
    const dbError = new Error('relation "LearningPath" does not exist');
    const db = {
      $queryRaw: vi.fn(async () => {
        throw dbError;
      }),
      learningPath: {
        findFirst: vi.fn(async () => ({
          id: 'legacy-path-1',
          pathStatus: 'active',
          pathPayload: {},
        })),
      },
    };

    await expect(lockLearningPathRow(db as any, 'legacy-path-1')).rejects.toBe(dbError);
    expect(db.learningPath.findFirst).not.toHaveBeenCalled();
  });

  it('uses ORM findFirst only when $queryRaw is absent (test doubles)', async () => {
    const db = {
      learningPath: {
        findFirst: vi.fn(async () => ({
          id: 'legacy-path-1',
          pathStatus: 'active',
          pathPayload: {},
        })),
      },
    };
    const path = await lockLearningPathRow(db as any, 'legacy-path-1');
    expect(path?.pathStatus).toBe('active');
    expect(db.learningPath.findFirst).toHaveBeenCalledOnce();
  });
});

describe('canonical learning path transition — replan', () => {
  it('rejects raw preserved intent that claims Legacy sequence constraints', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const result = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      preservedLearningIntent: {
        schemaVersion: 'act-preserved-learning-intent/v1',
        sourcePathId: 'legacy-path-1',
        goalId: 'control-correction',
        goalTitle: 'x',
        userIntent: null,
        intentType: null,
        learningGoalVersion: null,
        preservedAt: '2026-07-30T00:00:00.000Z',
        legacyNodeSequenceConstraint: true,
        legacyNodeIds: ['legacy-a', 'legacy-b'],
      } as unknown as PreservedLearningIntent,
      pinned: context,
      formalTeachingProjectionProof: formalProof(context),
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-1'),
      teachingRelations: goalTeachingRelations(context),
    });
    expect(result).toMatchObject({
      status: 'failed',
      reason: 'legacy-step-mapping-forbidden',
    });
  });

  it('returns pending when formal Teaching Projection is missing', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const result = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: null,
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-1'),
      engineeringRelations: [{ id: 'eng-1', predicate: 'part_of' }],
      teachingRelations: [],
    });
    expect(result.status).toBe('pending');
    if (result.status !== 'pending') return;
    expect([
      'formal-teaching-projection-not-available',
      'engineering-relations-insufficient',
    ]).toContain(result.reason);
  });

  it('returns pending for NO_EVIDENCE and null/invalid portrait payloads', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const proof = formalProof(context);
    const relations = goalTeachingRelations(context);

    const noEvidence = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: proof,
      reviewedBindings: bindings,
      cumulativePortrait: {
        stateKind: 'NO_EVIDENCE',
        payload: null,
        overallScore: null,
        dimensionCoverage: { evidencedDimensionIds: [], missingDimensionIds: [] },
        evidenceAsOf: null,
        confidence: null,
        lastTrend: null,
        lastRisk: [],
        availabilityReason: 'no-eligible-evidence',
        generatedAt: null,
      },
      teachingRelations: relations,
    });
    expect(noEvidence.status).toBe('pending');
    if (noEvidence.status === 'pending') {
      expect(noEvidence.reason).toBe('portrait-unavailable');
    }

    const nullPayload = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: proof,
      reviewedBindings: bindings,
      cumulativePortrait: {
        stateKind: 'SNAPSHOT',
        payload: null,
        overallScore: null,
        dimensionCoverage: { evidencedDimensionIds: [], missingDimensionIds: [] },
        evidenceAsOf: null,
        confidence: null,
        lastTrend: null,
        lastRisk: [],
        availabilityReason: 'available',
        generatedAt: '2026-07-30T00:00:00.000Z',
      },
      teachingRelations: relations,
    });
    expect(nullPayload.status).toBe('pending');
    if (nullPayload.status === 'pending') {
      expect(nullPayload.reason).toBe('portrait-payload-invalid');
    }
  });

  it('returns pending for SNAPSHOT portraits that are not availabilityReason=available', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const base = portraitFor('student-1');
    const result = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: formalProof(context),
      reviewedBindings: bindings,
      cumulativePortrait: {
        ...base,
        availabilityReason: 'reconciliation-pending',
      },
      teachingRelations: goalTeachingRelations(context),
    });
    expect(result).toMatchObject({
      status: 'pending',
      reason: 'portrait-unavailable',
    });
    if (result.status === 'pending') {
      expect(result.diagnostics.codes).toContain('reconciliation-pending');
    }
  });

  it('accepts official async/no-op materialization when read-model generatedAt differs from payload', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const base = portraitFor('student-1', '2026-07-28T00:00:00.000Z');
    // Official readCurrentCumulativePortrait: generatedAt is state-version
    // materialization time; payload.generatedAt is snapshot/evidence time.
    const result = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: formalProof(context),
      reviewedBindings: bindings,
      cumulativePortrait: {
        ...base,
        generatedAt: '2026-07-29T00:00:00.000Z',
      },
      teachingRelations: goalTeachingRelations(context),
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    // Content identity still follows payload.generatedAt, not materialization time.
    expect(result.path.portraitPlanningBasis.generatedAt).toBe('2026-07-28T00:00:00.000Z');
    expect(result.path.versionClosure.portraitGeneratedAt).toBe('2026-07-28T00:00:00.000Z');
  });

  it('returns pending when read-model generatedAt is present but not ISO', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const base = portraitFor('student-1', '2026-07-28T00:00:00.000Z');
    const result = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: formalProof(context),
      reviewedBindings: bindings,
      cumulativePortrait: {
        ...base,
        generatedAt: 'not-an-iso-timestamp',
      },
      teachingRelations: goalTeachingRelations(context),
    });
    expect(result.status).toBe('pending');
    if (result.status === 'pending') {
      expect(result.reason).toBe('portrait-payload-invalid');
      expect(result.diagnostics.codes).toContain('portrait-read-model-generatedAt-invalid');
    }
  });

  it('rejects another learner portrait', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const result = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: formalProof(context),
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-other'),
      teachingRelations: goalTeachingRelations(context),
    });
    expect(result).toMatchObject({
      status: 'pending',
      reason: 'portrait-learner-mismatch',
    });
  });

  it('returns pending when reviewed bindings are unrelated to the goal targets', () => {
    const context = pinned([
      'ctr:object:feedback-loop',
      'ctr:object:transfer-function',
    ]);
    const { bindings } = reviewedUnrelatedBindings(context);
    // Teaching relations only cover unrelated objects.
    const result = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: formalProof(context),
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-1'),
      teachingRelations: unrelatedTeachingRelations(context),
    });
    expect(result).toMatchObject({
      status: 'pending',
      reason: 'goal-not-resolvable-to-canonical',
    });
  });

  it('returns pending when goal bindings are valid but formal relations are all unrelated', () => {
    // Goal targets resolve, but every formal teaching relation stays outside that set.
    const context = pinned([
      ...GOAL_CANONICALS,
      'ctr:object:feedback-loop',
      'ctr:object:transfer-function',
    ]);
    const { bindings } = reviewedGoalBindings(context);
    const result = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: formalProof(context),
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-1'),
      teachingRelations: unrelatedTeachingRelations(context),
    });
    expect(result.status).toBe('pending');
    if (result.status === 'pending') {
      expect(result.reason).toBe('no-goal-relevant-teaching-relations');
      expect(result.diagnostics.codes).toContain('relations-unrelated-to-goal-targets');
      expect(result.diagnostics.resolvedGoalTargetCount).toBeGreaterThan(0);
    }
  });

  it('returns pending for cycles and out-of-coverage relations', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const proof = formalProof(context);
    const availability = resolveTeachingProjectionAvailability({
      pinned: context,
      formalProof: proof,
    });
    if (!availability.available) throw new Error('expected availability');

    const cycle = [
      buildActkgTeachingProjectionRelation({
        availability,
        pinned: context,
        id: 'tp-rel:a-to-b',
        predicate: 'prerequisite',
        sourceCanonicalId: 'ctr:object:time-domain-performance',
        targetCanonicalId: 'ctr:object:root-locus',
        version: 'tp-rel/v1',
      }),
      buildActkgTeachingProjectionRelation({
        availability,
        pinned: context,
        id: 'tp-rel:b-to-a',
        predicate: 'prerequisite',
        sourceCanonicalId: 'ctr:object:root-locus',
        targetCanonicalId: 'ctr:object:time-domain-performance',
        version: 'tp-rel/v1',
      }),
    ];
    const cycleResult = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: proof,
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-1'),
      teachingRelations: cycle,
    });
    expect(cycleResult.status).toBe('pending');
    if (cycleResult.status === 'pending') {
      expect(cycleResult.reason).toBe('teaching-relation-cycle');
    }

    const narrow = pinned(['ctr:object:time-domain-performance', 'ctr:object:root-locus']);
    const narrowBindings = reviewedGoalBindings(narrow);
    const narrowProof = formalProof(narrow);
    const narrowAvailability = resolveTeachingProjectionAvailability({
      pinned: narrow,
      formalProof: narrowProof,
    });
    if (!narrowAvailability.available) throw new Error('expected availability');
    const result = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: narrow,
      formalTeachingProjectionProof: narrowProof,
      reviewedBindings: narrowBindings.bindings,
      cumulativePortrait: portraitFor('student-1'),
      teachingRelations: [{
        id: 'tp-rel:out',
        namespace: 'actkg-teaching-projection',
        authority: 'ACTKG',
        predicate: 'prerequisite',
        sourceCanonicalId: 'ctr:object:time-domain-performance',
        targetCanonicalId: 'ctr:object:controller-correction',
        releaseSetId: narrowAvailability.releaseSetId,
        releaseId: narrowAvailability.releaseId,
        pinnedContextDigest: narrowAvailability.pinnedContextDigest,
        projectionId: narrowAvailability.projectionId,
        projectionDigest: narrowAvailability.projectionDigest,
        version: 'tp-rel/v1',
      }],
    });
    expect(result.status).toBe('pending');
    if (result.status === 'pending') {
      expect(result.reason).toBe('teaching-relation-out-of-coverage');
    }
  });

  it('creates a goal-closed Canonical path without inherited Legacy progress', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const proof = formalProof(context);
    const preserved: PreservedLearningIntent = {
      schemaVersion: 'act-preserved-learning-intent/v1',
      sourcePathId: 'legacy-path-1',
      goalId: 'control-correction',
      goalTitle: '控制系统校正设计',
      userIntent: '完成校正设计闭环',
      intentType: 'controller-design',
      learningGoalVersion: 'learning-goal-package/v1',
      preservedAt: '2026-07-30T00:00:00.000Z',
      legacyNodeSequenceConstraint: false,
      legacyNodeIds: null,
    };
    const legacyNodeIds = [
      'knowledge-card:control-correction-time-domain-targets',
      'arena-task:task-second-order-lead-pid',
    ];
    const result = replanCanonicalLearningPath({
      userId: 'student-1',
      preservedLearningIntent: preserved,
      sourcePath: {
        id: 'legacy-path-1',
        goalId: 'control-correction',
        nodeIds: legacyNodeIds,
        pathStatus: LEGACY_STOPPED_PATH_STATUS,
        pathPayload: {
          mainPathNodeIds: legacyNodeIds,
          preservedLearningIntent: preserved,
        },
      },
      pinned: context,
      formalTeachingProjectionProof: proof,
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-1'),
      teachingRelations: goalTeachingRelations(context),
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;

    const path = result.path;
    expect(path.id).toMatch(/^canonical-path:student-1:control-correction:/);
    expect(path.plannerVersion).toBe(CANONICAL_PATH_REPLAN_PLANNER_VERSION);
    expect(path.inheritedLegacyProgress).toBe(false);
    expect(path.lastExecutionMetadata.completedNodeIds).toEqual([]);
    expect(path.goalTargetCanonicalIds).toEqual([...GOAL_CANONICALS].sort());
    expect(path.nodeIds.every((id) => id.startsWith('canonical-object:ctr:object:'))).toBe(true);
    expect(path.nodeIds.some((id) => legacyNodeIds.includes(id))).toBe(false);
    expect(path.portraitPlanningBasis.portraitIdentityDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(path.versionClosure.portraitIdentityDigest).toBe(
      path.portraitPlanningBasis.portraitIdentityDigest,
    );
    // Goal-relevant order: time-domain → root-locus → controller → simulation
    expect(path.nodeIds[0]).toContain('time-domain-performance');
    expect(path.nodeIds.at(-1)).toContain('simulation-validation');
  });

  it('changes path identity when the effective teaching-relation subset changes', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const proof = formalProof(context);
    const availability = resolveTeachingProjectionAvailability({
      pinned: context,
      formalProof: proof,
    });
    if (!availability.available) throw new Error('expected availability');
    const full = goalTeachingRelations(context);
    const subset = full.slice(0, 2); // drop the last prereq edge

    const withFull = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: proof,
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-1'),
      teachingRelations: full,
    });
    const withSubset = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: proof,
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-1'),
      teachingRelations: subset,
    });

    expect(withFull.status).toBe('ready');
    expect(withSubset.status).toBe('ready');
    if (withFull.status !== 'ready' || withSubset.status !== 'ready') return;
    expect(withFull.path.versionClosure.teachingRelationSetDigest)
      .not.toBe(withSubset.path.versionClosure.teachingRelationSetDigest);
    expect(withFull.path.versionClosure.versionIdentityDigest)
      .not.toBe(withSubset.path.versionClosure.versionIdentityDigest);
    expect(withFull.path.id).not.toBe(withSubset.path.id);
    expect(withFull.path.versionClosure.reviewedMappingDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(withFull.path.versionClosure.teachingRelationSetDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes path identity when the cumulative portrait revision changes', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const proof = formalProof(context);
    const relations = goalTeachingRelations(context);

    const first = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: proof,
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-1', '2026-07-28T00:00:00.000Z'),
      teachingRelations: relations,
    });
    const second = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      pinned: context,
      formalTeachingProjectionProof: proof,
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-1', '2026-07-29T12:00:00.000Z'),
      teachingRelations: relations,
    });

    expect(first.status).toBe('ready');
    expect(second.status).toBe('ready');
    if (first.status !== 'ready' || second.status !== 'ready') return;
    expect(first.path.id).not.toBe(second.path.id);
    expect(first.path.versionClosure.versionIdentityDigest)
      .not.toBe(second.path.versionClosure.versionIdentityDigest);
    expect(first.path.versionClosure.portraitIdentityDigest)
      .not.toBe(second.path.versionClosure.portraitIdentityDigest);
  });

  it('does not let preserved goal force Legacy node sequence', () => {
    const context = pinned();
    const { bindings } = reviewedGoalBindings(context);
    const result = replanCanonicalLearningPath({
      userId: 'student-1',
      goalId: 'control-correction',
      sourcePath: {
        id: 'legacy-path-1',
        goalId: 'control-correction',
        nodeIds: ['legacy-step-1', 'legacy-step-2', 'legacy-step-3'],
        pathPayload: {
          mainPathNodeIds: ['legacy-step-1', 'legacy-step-2', 'legacy-step-3'],
        },
      },
      pinned: context,
      formalTeachingProjectionProof: formalProof(context),
      reviewedBindings: bindings,
      cumulativePortrait: portraitFor('student-1'),
      teachingRelations: goalTeachingRelations(context),
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.path.nodeIds).not.toContain('legacy-step-1');
    expect(result.path.nodeIds[0]).toContain('canonical-object:');
  });
});
