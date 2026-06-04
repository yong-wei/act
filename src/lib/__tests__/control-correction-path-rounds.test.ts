import { describe, expect, it, vi } from 'vitest';

import {
  persistControlCorrectionPathRound,
  ControlCorrectionPathRoundConflictError,
  ControlCorrectionPathRoundValidationError,
  readControlCorrectionPathRound,
  recordPathDeviation,
  recordPathIntervention,
  recordPathNodeExecution,
  toControlCorrectionPathRoundView,
  toLegacyLearningPathSummary,
  updateControlCorrectionPathRoundAfterExecution,
} from '../control-correction-path-rounds';
import type { AdaptiveLearningPathPlan } from '../adaptive-learning-path-planner';

function samplePlan(): AdaptiveLearningPathPlan {
  return {
    id: 'adaptive-path:student-1:control-correction',
    userId: 'student-1',
    goal: {
      id: 'control-correction',
      title: '控制系统校正设计',
      knowledgeTargets: ['control-correction:arena-transfer'],
      competencyTargets: ['crossDomainTransfer'],
    },
    stage: 'stage-1-rules-graph',
    policyFamily: 'rules-plus-graph-search',
    excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
    status: 'ready',
    currentNodeId: 'knowledge-card:control-correction-time-domain-targets',
    mainPath: [
      {
        nodeId: 'knowledge-card:control-correction-time-domain-targets',
        title: '时域指标知识卡',
        type: 'knowledge_card',
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
    confidence: {
      level: 'medium',
      score: 0.72,
      sourceCoverage: 0.7,
    },
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
      timeline: {
        generatedAt: '2026-06-04T08:00:00.000Z',
        windows: [],
      },
      evidence: {
        evidenceBasis: 'adaptive-learner-state',
        confidence: {
          level: 'medium',
          score: 0.72,
          sourceCoverage: 0.7,
        },
        sourceCoverage: { LearningFact: 'available' },
        learnerStateDeficits: [],
        prerequisiteReasons: [],
        teacherPolicy: [],
        alternatives: [],
      },
    },
  };
}

function mockDb() {
  const existingExecutions = new Map<string, any>();
  const existingDeviations = new Map<string, any>();
  const existingInterventions = new Map<string, any>();
  return {
    learningPath: {
      upsert: vi.fn(async ({ create, update }) => ({ id: create.id, ...create, ...update })),
      findFirst: vi.fn(async () => ({
        id: 'adaptive-path:student-1:control-correction',
        userId: 'student-1',
        goalId: 'control-correction',
        pathStatus: 'active',
        currentNodeId: 'knowledge-card:control-correction-time-domain-targets',
        terminalValidation: { nodeId: 'arena-task:task-second-order-lead-pid', type: 'arena_task' },
        executions: [{ id: 'exec-1' }],
        deviations: [{ id: 'dev-1' }],
        interventions: [{ id: 'int-1' }],
      })),
    },
    learningPathExecution: {
      findFirst: vi.fn(async ({ where }) => existingExecutions.get(where.idempotencyKey)),
      create: vi.fn(async ({ data }) => {
        const row = { id: 'exec-created', ...data };
        if (data.idempotencyKey) existingExecutions.set(data.idempotencyKey, row);
        return row;
      }),
    },
    learningPathDeviation: {
      findFirst: vi.fn(async ({ where }) => existingDeviations.get(where.idempotencyKey)),
      create: vi.fn(async ({ data }) => {
        const row = { id: 'dev-created', ...data };
        if (data.idempotencyKey) existingDeviations.set(data.idempotencyKey, row);
        return row;
      }),
    },
    learningPathIntervention: {
      findFirst: vi.fn(async ({ where }) => existingInterventions.get(where.idempotencyKey)),
      create: vi.fn(async ({ data }) => {
        const row = { id: 'int-created', ...data };
        if (data.idempotencyKey) existingInterventions.set(data.idempotencyKey, row);
        return row;
      }),
    },
    evidenceOutbox: {
      createMany: vi.fn(async ({ data }) => ({ count: data.length })),
    },
  };
}

describe('control-correction path rounds', () => {
  it('persists a path round with additive planner, payload, explanation, and terminal validation fields', async () => {
    const db = mockDb();
    const plan = samplePlan();

    await persistControlCorrectionPathRound(db, {
      plan,
      learnerStateRef: 'learner-state-cache-1',
      inputSnapshot: { sourceCoverage: { LearningFact: 'available' } },
      classId: 'class-1',
    });

    expect(db.learningPath.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: plan.id },
      create: expect.objectContaining({
        id: plan.id,
        userId: 'student-1',
        goalId: 'control-correction',
        plannerVersion: 'stage-1-rules-graph',
        pathStatus: 'active',
        currentNodeId: 'knowledge-card:control-correction-time-domain-targets',
        learnerStateRef: 'learner-state-cache-1',
        classId: 'class-1',
        entryNodeId: 'knowledge-card:control-correction-time-domain-targets',
        terminalValidation: expect.objectContaining({
          nodeId: 'arena-task:task-second-order-lead-pid',
          resourceType: 'arena_task',
          state: 'pending',
        }),
        pathPayload: expect.objectContaining({
          mainPathNodeIds: [
            'knowledge-card:control-correction-time-domain-targets',
            'arena-task:task-second-order-lead-pid',
          ],
        }),
      }),
    }));
  });

  it('records execution, deviation, and intervention rows append-only with idempotency keys', async () => {
    const db = mockDb();

    const execution = await recordPathNodeExecution(db, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'exec-key',
      evidenceRefs: [{ kind: 'LearningFact', id: 'fact-1' }],
    });
    const executionRetry = await recordPathNodeExecution(db, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'exec-key',
    });
    const deviation = await recordPathDeviation(db, {
      pathId: 'path-1',
      userId: 'student-1',
      deviationType: 'skip',
      priorNodeId: 'node-1',
      idempotencyKey: 'dev-key',
      context: { reason: 'too-hard' },
    });
    const intervention = await recordPathIntervention(db, {
      pathId: 'path-1',
      userId: 'student-1',
      interventionKind: 'hint',
      suggestedAction: 'review-root-locus',
      privacySafeSummary: '建议回看根轨迹规则。',
      idempotencyKey: 'int-key',
    });

    expect(executionRetry).toBe(execution);
    expect(deviation).toMatchObject({ deviationType: 'skip', evidenceConfidence: 'unknown' });
    expect(intervention).toMatchObject({ interventionKind: 'hint', studentOutcome: 'pending' });
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledTimes(4);
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          eventType: 'control_correction_path.execution_recorded',
          ownerUserId: 'student-1',
          correlationId: 'path-1',
          causationId: 'LearningPathExecution:exec-created',
          dedupeKey: 'control-correction-path:execution:path-1:exec-key',
          payload: expect.objectContaining({
            eventType: 'control_correction_path.execution_recorded',
            sourceCapability: 'connect-path-execution-to-evidence-cache',
            payloadVersion: 'control-correction-path-evidence.v1',
            privacyLevel: 'student-visible',
            confidence: 'medium',
            relatedRefs: expect.objectContaining({
              pathId: 'path-1',
              nodeId: 'node-1',
            }),
          }),
        }),
      ],
      skipDuplicates: true,
    }));
  });

  it('rejects a client supplied path id when it already belongs to another owner or goal', async () => {
    const db = mockDb();
    db.learningPath.findFirst = vi.fn(async () => ({
      id: 'adaptive-path:student-1:control-correction',
      userId: 'student-2',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      terminalValidation: { nodeId: 'node-1', type: 'simulation' },
      executions: [],
      deviations: [],
      interventions: [],
    }));

    await expect(persistControlCorrectionPathRound(db, {
      plan: samplePlan(),
    })).rejects.toBeInstanceOf(ControlCorrectionPathRoundConflictError);
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('rejects malformed persisted plans before writing LearningPath rows', async () => {
    const db = mockDb();
    const plan = samplePlan();
    plan.id = 'client-forged-path';
    plan.mainPath[1] = {
      ...plan.mainPath[1],
      type: 'knowledge_card',
    };

    await expect(persistControlCorrectionPathRound(db, {
      plan,
    })).rejects.toBeInstanceOf(ControlCorrectionPathRoundValidationError);
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('returns the existing append-only row when a concurrent idempotent create hits the unique constraint', async () => {
    const existing = {
      id: 'exec-existing',
      pathId: 'path-1',
      idempotencyKey: 'exec-key',
    };
    const db = mockDb();
    db.learningPathExecution.findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    db.learningPathExecution.create = vi.fn().mockRejectedValue(Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
    }));

    const execution = await recordPathNodeExecution(db, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'exec-key',
    });

    expect(execution).toBe(existing);
    expect(db.learningPathExecution.findFirst).toHaveBeenCalledTimes(2);
  });

  it('repairs missing outbox events on idempotent retry', async () => {
    const existing = {
      id: 'exec-existing',
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'exec-key',
    };
    const db = mockDb();
    db.learningPathExecution.findFirst = vi.fn().mockResolvedValue(existing);

    const execution = await recordPathNodeExecution(db, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'exec-key',
    });

    expect(execution).toBe(existing);
    expect(db.learningPathExecution.create).not.toHaveBeenCalled();
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          dedupeKey: 'control-correction-path:execution:path-1:exec-key',
          causationId: 'LearningPathExecution:exec-existing',
        }),
      ],
      skipDuplicates: true,
    }));
  });

  it('reads the path round with append-only children and maps legacy summary output', async () => {
    const db = mockDb();

    const round = await readControlCorrectionPathRound(db, {
      pathId: 'adaptive-path:student-1:control-correction',
      userId: 'student-1',
    });
    const legacy = toLegacyLearningPathSummary({
      id: 'path-1',
      title: '控制校正路径',
      description: 'path',
      estimatedTime: 26,
      nodeIds: ['node-1'],
      isAiGenerated: true,
      pathStatus: 'active',
      currentNodeId: 'node-1',
    });

    expect(round).toMatchObject({
      id: 'adaptive-path:student-1:control-correction',
      executions: [{ id: 'exec-1' }],
      deviations: [{ id: 'dev-1' }],
      interventions: [{ id: 'int-1' }],
    });
    expect(legacy).toEqual({
      id: 'path-1',
      title: '控制校正路径',
      description: 'path',
      estimatedTime: 26,
      nodeIds: ['node-1'],
      isAiGenerated: true,
      status: 'active',
      currentNodeId: 'node-1',
    });
  });

  it('maps path round reads to a privacy-safe route view', () => {
    const view = toControlCorrectionPathRoundView({
      id: 'path-1',
      userId: 'student-1',
      executions: [{
        id: 'exec-1',
        nodeId: 'node-1',
        evidenceRefs: [{ kind: 'LearningFact', id: 'fact-1' }],
        liftMetadata: { raw: true },
      }],
      deviations: [{
        id: 'dev-1',
        deviationType: 'skip',
        context: { private: true },
      }],
      interventions: [{
        id: 'int-1',
        interventionKind: 'hint',
        suggestedAction: 'private-dialogue',
        citedEvidence: [{ id: 'fact-1' }],
        privacySafeSummary: '建议回看根轨迹规则。',
      }],
    });

    expect(view?.executions[0]).toEqual(expect.objectContaining({ id: 'exec-1', nodeId: 'node-1' }));
    expect(view?.executions[0]).not.toHaveProperty('evidenceRefs');
    expect(view?.executions[0]).not.toHaveProperty('liftMetadata');
    expect(view?.deviations[0]).not.toHaveProperty('context');
    expect(view?.interventions[0]).toEqual(expect.objectContaining({ privacySafeSummary: '建议回看根轨迹规则。' }));
    expect(view?.interventions[0]).not.toHaveProperty('suggestedAction');
    expect(view?.interventions[0]).not.toHaveProperty('citedEvidence');
  });

  it('completes terminal validation only with governed simulation plus official Arena replay evidence', async () => {
    const db = mockDb();
    const path = {
      id: 'path-1',
      pathStatus: 'active',
      currentNodeId: 'arena-task:task-second-order-lead-pid',
      nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      pathPayload: {
        mainPathNodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      },
      terminalValidation: {
        nodeId: 'arena-task:task-second-order-lead-pid',
        resourceType: 'arena_task',
        target: '/arena/challenges/task-second-order-lead-pid',
        state: 'pending',
      },
      lastExecutionMetadata: {},
    };
    db.learningPath.update = vi.fn(async ({ data }) => ({ id: 'path-1', ...data }));

    await updateControlCorrectionPathRoundAfterExecution(db, path, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      simulationRef: {
        kind: 'SimulationRun',
        id: 'sim-run-1',
        status: 'completed',
        provenance: 'official',
        replayConfidence: 0.86,
        summaryMetrics: { settlingTime: 3.1, overshoot: 0.08 },
      },
      arenaRef: {
        kind: 'ArenaSubmission',
        id: 'arena-submission-1',
        taskId: 'task-second-order-lead-pid',
        provenance: 'official',
        valid: true,
        score: 82,
        replayConfidence: 0.91,
        hiddenEvaluation: { privateScenario: 'do-not-leak' },
      },
      evidenceRefs: [
        { kind: 'SimulationRun', id: 'sim-run-1' },
        { kind: 'ArenaSubmission', id: 'arena-submission-1' },
      ],
    });

    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'completed',
        terminalValidation: expect.objectContaining({
          state: 'completed',
          policy: expect.objectContaining({
            mustIncludeSimulation: true,
            mustEndWithArena: true,
            requireOfficialArenaEvidence: true,
          }),
          evidence: expect.objectContaining({
            simulation: expect.objectContaining({
              id: 'sim-run-1',
              provenance: 'official',
              replayConfidence: 0.86,
            }),
            arena: expect.objectContaining({
              id: 'arena-submission-1',
              provenance: 'official',
              valid: true,
              replayConfidence: 0.91,
            }),
          }),
          lowConfidenceMarkers: [],
          fallbackRequired: false,
        }),
      }),
    }));
    expect(JSON.stringify(db.learningPath.update.mock.calls)).not.toContain('privateScenario');
    expect(JSON.stringify(db.learningPath.update.mock.calls)).not.toContain('hiddenEvaluation');
    expect(JSON.stringify(db.learningPath.update.mock.calls)).not.toContain('trace');
  });

  it('falls back when repeated simulation failure reaches terminal validation', async () => {
    const db = mockDb();
    const path = {
      id: 'path-1',
      pathStatus: 'active',
      currentNodeId: 'simulation:control-correction-step-response-lab',
      nodeIds: ['simulation:control-correction-step-response-lab'],
      terminalValidation: {
        nodeId: 'simulation:control-correction-step-response-lab',
        resourceType: 'simulation',
        state: 'pending',
      },
      lastExecutionMetadata: { failedNodeIds: ['simulation:control-correction-step-response-lab'] },
    };
    db.learningPath.update = vi.fn(async ({ data }) => ({ id: 'path-1', ...data }));

    await updateControlCorrectionPathRoundAfterExecution(db, path, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'simulation:control-correction-step-response-lab',
      resourceType: 'simulation',
      status: 'failed',
      failedAt: '2026-06-04T10:00:00.000Z',
      simulationRef: {
        kind: 'SimulationRun',
        id: 'sim-run-failed',
        status: 'failed',
        replayConfidence: 0.84,
        failureCount: 2,
        summaryMetrics: { overshoot: 0.42 },
      },
    });

    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'fallback',
        terminalValidation: expect.objectContaining({
          state: 'failed',
          fallbackRequired: true,
          failureReasons: expect.arrayContaining(['simulation-failed']),
        }),
        lastExecutionMetadata: expect.objectContaining({
          terminalValidationState: 'failed',
          fallbackReasons: expect.arrayContaining(['simulation-failed']),
        }),
      }),
    }));
  });

  it('marks preview-only Arena evidence as low confidence unless policy allows preview validation', async () => {
    const db = mockDb();
    const path = {
      id: 'path-1',
      pathStatus: 'active',
      currentNodeId: 'arena-task:task-second-order-lead-pid',
      nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      terminalValidation: {
        nodeId: 'arena-task:task-second-order-lead-pid',
        resourceType: 'arena_task',
        state: 'pending',
      },
      lastExecutionMetadata: {},
    };
    db.learningPath.update = vi.fn(async ({ data }) => ({ id: 'path-1', ...data }));

    await updateControlCorrectionPathRoundAfterExecution(db, path, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      simulationRef: { kind: 'SimulationRun', id: 'sim-run-1', status: 'completed', replayConfidence: 0.8 },
      arenaRef: {
        kind: 'ArenaVirtualSimulationRun',
        id: 'preview-run-1',
        provenance: 'preview',
        valid: true,
        score: 91,
        replayConfidence: 0.88,
      },
    });

    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'fallback',
        terminalValidation: expect.objectContaining({
          state: 'low-confidence',
          fallbackRequired: true,
          lowConfidenceMarkers: expect.arrayContaining(['arena-preview-only']),
          evidence: expect.objectContaining({
            arena: expect.objectContaining({
              provenance: 'preview',
              official: false,
            }),
          }),
        }),
      }),
    }));
  });

  it('does not treat official eligibility as official Arena validation evidence', async () => {
    const db = mockDb();
    const path = {
      id: 'path-1',
      pathStatus: 'active',
      currentNodeId: 'arena-task:task-second-order-lead-pid',
      nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      terminalValidation: {
        nodeId: 'arena-task:task-second-order-lead-pid',
        resourceType: 'arena_task',
        state: 'pending',
      },
      lastExecutionMetadata: {},
    };
    db.learningPath.update = vi.fn(async ({ data }) => ({ id: 'path-1', ...data }));

    await updateControlCorrectionPathRoundAfterExecution(db, path, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      simulationRef: { kind: 'SimulationRun', id: 'sim-run-1', status: 'completed', replayConfidence: 0.8 },
      arenaRef: {
        kind: 'ArenaVirtualSimulationRun',
        id: 'eligible-preview-run',
        officialEligible: true,
        valid: true,
        replayConfidence: 0.88,
      },
    });

    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'fallback',
        terminalValidation: expect.objectContaining({
          state: 'low-confidence',
          lowConfidenceMarkers: expect.arrayContaining(['arena-official-evidence-missing']),
          evidence: expect.objectContaining({
            arena: expect.objectContaining({
              official: false,
            }),
          }),
        }),
      }),
    }));
  });

  it('does not complete terminal validation with official Arena evidence from another task', async () => {
    const db = mockDb();
    const path = {
      id: 'path-1',
      pathStatus: 'active',
      currentNodeId: 'arena-task:task-second-order-lead-pid',
      nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      terminalValidation: {
        nodeId: 'arena-task:task-second-order-lead-pid',
        resourceType: 'arena_task',
        target: 'task-second-order-lead-pid',
        state: 'pending',
      },
      lastExecutionMetadata: {},
    };
    db.learningPath.update = vi.fn(async ({ data }) => ({ id: 'path-1', ...data }));

    await updateControlCorrectionPathRoundAfterExecution(db, path, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      simulationRef: {
        kind: 'SimulationRun',
        id: 'sim-run-1',
        status: 'completed',
        replayConfidence: 0.8,
      },
      arenaRef: {
        kind: 'ArenaSubmission',
        id: 'arena-submission-other-task',
        taskId: 'unrelated-task',
        provenance: 'official',
        valid: true,
        replayConfidence: 0.9,
      },
    });

    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'fallback',
        terminalValidation: expect.objectContaining({
          state: 'low-confidence',
          fallbackRequired: true,
          lowConfidenceMarkers: expect.arrayContaining(['arena-task-mismatch']),
        }),
      }),
    }));
  });

  it('marks missing replay confidence as low confidence without exposing hidden Arena internals', async () => {
    const db = mockDb();
    const path = {
      id: 'path-1',
      pathStatus: 'active',
      currentNodeId: 'arena-task:task-second-order-lead-pid',
      nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      terminalValidation: {
        nodeId: 'arena-task:task-second-order-lead-pid',
        resourceType: 'arena_task',
        state: 'pending',
      },
      lastExecutionMetadata: {},
    };
    db.learningPath.update = vi.fn(async ({ data }) => ({ id: 'path-1', ...data }));

    await updateControlCorrectionPathRoundAfterExecution(db, path, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      simulationRef: { kind: 'SimulationRun', id: 'sim-run-1', status: 'completed' },
      arenaRef: {
        kind: 'ArenaSubmission',
        id: 'arena-submission-1',
        provenance: 'official',
        valid: true,
        score: 88,
        hiddenTrace: [{ t: 0, y: 1 }],
        hiddenScenarioOrder: ['private-scenario'],
      },
    });

    const updateCall = JSON.stringify(db.learningPath.update.mock.calls);
    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'fallback',
        terminalValidation: expect.objectContaining({
          state: 'low-confidence',
          fallbackRequired: true,
          lowConfidenceMarkers: expect.arrayContaining([
            'simulation-replay-confidence-missing',
            'arena-replay-confidence-missing',
          ]),
        }),
      }),
    }));
    expect(updateCall).not.toContain('hiddenTrace');
    expect(updateCall).not.toContain('hiddenScenarioOrder');
    expect(updateCall).not.toContain('private-scenario');
  });
});
