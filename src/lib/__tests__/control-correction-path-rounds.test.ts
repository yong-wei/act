import { describe, expect, it, vi } from 'vitest';

import {
  ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES,
  type AdaptiveLearningPathPlan,
} from '../adaptive-learning-path-planner';
import {
  getPathNodeSemanticsForResourceType,
  type ResourceNodeType,
} from '../resource-node-registry';
import {
  persistControlCorrectionPathRound,
  persistLearningPathRound,
  ControlCorrectionPathRoundConflictError,
  ControlCorrectionPathRoundValidationError,
  readControlCorrectionPathRound,
  recordPathChoiceEvidence,
  recordPathDeviation,
  recordPathIntervention,
  recordPathNodeExecution,
  toControlCorrectionPathRoundView,
  toLegacyLearningPathSummary,
  updateControlCorrectionPathRoundAfterExecution,
} from '../control-correction-path-rounds';

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

function frequencyResponsePlan(): AdaptiveLearningPathPlan {
  const base = samplePlan();
  return {
    ...base,
    id: 'adaptive-path:student-1:frequency-response-foundations',
    goal: {
      id: 'frequency-response-foundations',
      title: '频率响应基础',
      knowledgeTargets: ['kn-bode'],
      competencyTargets: [],
    },
    policyFamily: 'foundation-remediation',
    policyMetadata: ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES['foundation-remediation'],
    status: 'fallback',
    confidence: {
      level: 'low',
      score: 0.2,
      sourceCoverage: 0.2,
    },
    currentNodeId: 'knowledge-card:frequency-response-basics',
    mainPath: [{
      nodeId: 'knowledge-card:frequency-response-basics',
      title: '频率响应基础卡',
      type: 'knowledge_card',
      ...pathNodeSemantics('knowledge_card'),
      sourceKind: 'knowledge_graph',
      sourceRef: 'frequency-response-basics',
      target: '/course-runtime/knowledge/cards/frequency-response-basics',
      estimatedTimeMinutes: 10,
      prerequisiteNodeIds: [],
      knowledgeCoverage: ['kn-bode'],
      teacherPolicy: 'allowed',
      privacyLevel: 'student-visible',
      terminalConstraints: [],
      score: 0.8,
      reasonCodes: ['matches-knowledge-deficit'],
      status: 'current',
    }],
    explanations: {
      selectedReasons: ['matches-knowledge-deficit'],
      rejectedAlternatives: [],
      fallbackReasons: ['learner-evidence-low-confidence'],
    },
    executionStatus: {
      adopted: false,
      completedNodeIds: [],
      activeNodeId: 'knowledge-card:frequency-response-basics',
      updatedAt: '2026-06-14T08:00:00.000Z',
    },
    visualization: {
      ...base.visualization,
      map: {
        ...base.visualization.map,
        mainPathNodeIds: ['knowledge-card:frequency-response-basics'],
        currentNodeId: 'knowledge-card:frequency-response-basics',
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
      update: vi.fn(async ({ data }) => ({ id: 'adaptive-path:student-1:control-correction', ...data })),
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
    learningFact: {
      createMany: vi.fn(async ({ data }) => ({ count: data.length })),
    },
  };
}

describe('control-correction path rounds', () => {
  it('persists a path round with additive planner, payload, explanation, and terminal validation fields', async () => {
    const db = mockDb();
    const plan: AdaptiveLearningPathPlan = {
      ...samplePlan(),
      policyBundle: {
        families: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
        overlapThreshold: 0.6,
        status: 'ready',
        paths: [{
          styleId: 'foundation-remediation',
          policyFamily: 'foundation-remediation',
          label: '基础补救',
          nodeIds: ['knowledge-card:control-correction-time-domain-targets', 'arena-task:task-second-order-lead-pid'],
          nodeSummaries: [
            {
              nodeId: 'knowledge-card:control-correction-time-domain-targets',
              title: '时域指标知识卡',
              ...pathNodeSemantics('knowledge_card'),
              estimatedTimeMinutes: 8,
              status: 'current',
            },
            {
              nodeId: 'arena-task:task-second-order-lead-pid',
              title: '二阶对象超前校正 Arena',
              ...pathNodeSemantics('arena_task'),
              estimatedTimeMinutes: 18,
              status: 'next',
            },
          ],
          targetDeficits: [{ targetId: 'control-correction:arena-transfer', kind: 'knowledge', value: 0.2, confidence: 0.6, evidenceCount: 1, reasonCode: 'low-mastery-target' }],
          evidenceBasis: ['adaptive-learner-state', 'LearningFact'],
          estimatedMinutes: 26,
          modalityMix: { knowledge_card: 1, arena_task: 1 },
          resourceMix: { knowledge_card: 1, arena_task: 1 },
          overlap: { maxWithOtherOptions: 0.4 },
          effort: { estimatedMinutes: 26, relative: 'short' },
          expectedTargetLift: 1.2,
          terminalValidationNodeIds: ['arena-task:task-second-order-lead-pid'],
          terminalValidationStrategy: {
            nodeIds: ['arena-task:task-second-order-lead-pid'],
            summary: 'terminal validation through arena-task:task-second-order-lead-pid',
          },
          checkpointNodeIds: ['arena-task:task-second-order-lead-pid'],
          limitations: ['some-targets-have-no-direct-evidence'],
        }],
        diversity: {
          maxResourceOverlap: 0.4,
          minModalityDistance: 0.5,
          minEstimatedEffortDifference: 0.2,
          minTerminalValidationDifference: 0,
          pairwiseResourceOverlap: [],
          pairwiseModalityDistance: [],
          pairwiseEstimatedEffortDifference: [],
          pairwiseTerminalValidationDifference: [],
          modalityMixByPolicy: { 'foundation-remediation': { knowledge_card: 1, arena_task: 1 } },
          estimatedEffortByPolicy: { 'foundation-remediation': 26 },
          terminalValidationDifference: 0,
        },
        fallbackReasons: [],
      },
      feedbackEvents: [{
        id: 'feedback-selection-1',
        type: 'selection',
        nodeId: null,
        createdAt: '2026-06-04T08:05:00.000Z',
        context: {
          selectedStyleId: 'foundation-remediation',
          rejectedStyleIds: ['arena-simulation-sprint'],
        },
      }, {
        id: 'feedback-helpfulness-1',
        type: 'helpfulness',
        nodeId: null,
        createdAt: '2026-06-04T08:07:00.000Z',
        helpful: false,
        context: {
          selectedStyleId: 'foundation-remediation',
        },
      }],
    };

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
          policyBundle: expect.objectContaining({
            paths: [
              expect.objectContaining({
                styleId: 'foundation-remediation',
                evidenceBasis: ['adaptive-learner-state', 'LearningFact'],
              }),
            ],
          }),
          selectionHistory: [
            expect.objectContaining({
              id: 'feedback-selection-1',
              type: 'selection',
              selectedStyleId: 'foundation-remediation',
              rejectedStyleIds: ['arena-simulation-sprint'],
            }),
            expect.objectContaining({
              id: 'feedback-helpfulness-1',
              type: 'helpfulness',
              selectedStyleId: 'foundation-remediation',
              helpful: false,
            }),
          ],
        }),
      }),
    }));
  });

  it('persists registered generic path rounds without requiring control-correction terminal validation', async () => {
    const db = mockDb();
    db.learningPath.findFirst = vi.fn(async () => null) as any;
    const plan: AdaptiveLearningPathPlan = {
      ...samplePlan(),
      id: 'adaptive-path:student-1:frequency-response-foundations',
      goal: {
        id: 'frequency-response-foundations',
        title: '频率响应基础',
        knowledgeTargets: ['kn-bode'],
        competencyTargets: [],
      },
      policyFamily: 'foundation-remediation',
      policyMetadata: ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES['foundation-remediation'],
      status: 'fallback',
      confidence: {
        level: 'low',
        score: 0.2,
        sourceCoverage: 0.2,
      },
      currentNodeId: 'knowledge-card:frequency-response-basics',
      mainPath: [{
        nodeId: 'knowledge-card:frequency-response-basics',
        title: '频率响应基础卡',
        type: 'knowledge_card',
        ...pathNodeSemantics('knowledge_card'),
        sourceKind: 'knowledge_graph',
        sourceRef: 'frequency-response-basics',
        target: '/course-runtime/knowledge/cards/frequency-response-basics',
        estimatedTimeMinutes: 10,
        prerequisiteNodeIds: [],
        knowledgeCoverage: ['kn-bode'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: [],
        score: 0.8,
        reasonCodes: ['matches-knowledge-deficit'],
        status: 'current',
      }],
      explanations: {
        selectedReasons: ['matches-knowledge-deficit'],
        rejectedAlternatives: [],
        fallbackReasons: ['learner-evidence-low-confidence'],
      },
      executionStatus: {
        adopted: false,
        completedNodeIds: [],
        activeNodeId: 'knowledge-card:frequency-response-basics',
        updatedAt: '2026-06-14T08:00:00.000Z',
      },
      visualization: {
        ...samplePlan().visualization,
        map: {
          ...samplePlan().visualization.map,
          mainPathNodeIds: ['knowledge-card:frequency-response-basics'],
          currentNodeId: 'knowledge-card:frequency-response-basics',
        },
      },
    };

    await persistLearningPathRound(db, {
      plan,
      learnerStateRef: 'learner-state-cache-frequency',
      inputSnapshot: { goalId: 'frequency-response-foundations' },
      classId: 'class-1',
    });

    expect(db.learningPath.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: plan.id },
      create: expect.objectContaining({
        id: plan.id,
        userId: 'student-1',
        goalId: 'frequency-response-foundations',
        plannerVersion: 'stage-1-rules-graph',
        pathStatus: 'fallback',
        currentNodeId: 'knowledge-card:frequency-response-basics',
        learnerStateRef: 'learner-state-cache-frequency',
        classId: 'class-1',
        terminalValidation: expect.objectContaining({
          nodeId: null,
          state: 'not-required',
        }),
        pathPayload: expect.objectContaining({
          mainPathNodeIds: ['knowledge-card:frequency-response-basics'],
          plannerVersion: 'stage-1-rules-graph',
        }),
        explanationPayload: expect.objectContaining({
          studentFacing: expect.objectContaining({
            summary: expect.stringContaining('当前证据不足'),
          }),
        }),
      }),
    }));
  });

  it('rejects registered generic path rounds when nodes exceed the goal resource contract', async () => {
    const db = mockDb();
    const plan = frequencyResponsePlan();
    plan.mainPath[0] = {
      ...plan.mainPath[0],
      type: 'project',
      nodeId: 'project:frequency-response-open-task',
      target: '/interactive-learning/projects/frequency-response-open-task',
    };
    plan.currentNodeId = 'project:frequency-response-open-task';

    await expect(persistLearningPathRound(db, {
      plan,
      inputSnapshot: { goalId: 'frequency-response-foundations' },
    })).rejects.toBeInstanceOf(ControlCorrectionPathRoundValidationError);
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('preserves existing path selection history and activity when upserting a revised round', async () => {
    const db = mockDb();
    const plan = samplePlan();
    db.learningPath.findFirst = vi.fn(async () => ({
      id: plan.id,
      userId: plan.userId,
      goalId: plan.goal.id,
      pathPayload: {
        selectionHistory: [{
          id: 'choice-before-revision',
          type: 'selection',
          selectedStyleId: 'foundation-remediation',
        }],
        activity: [{
          id: 'activity-before-revision',
          type: 'choice:selection',
          selectedStyleId: 'foundation-remediation',
        }],
      },
    })) as any;

    await persistLearningPathRound(db, {
      plan,
      inputSnapshot: { goalId: 'control-correction', operation: 'revised' },
    });

    expect(db.learningPath.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        pathPayload: expect.objectContaining({
          selectionHistory: expect.arrayContaining([
            expect.objectContaining({ id: 'choice-before-revision' }),
          ]),
          activity: expect.arrayContaining([
            expect.objectContaining({ id: 'activity-before-revision' }),
            expect.objectContaining({ id: `${plan.id}:generation` }),
          ]),
        }),
      }),
    }));
  });

  it('rejects registered generic path rounds that point students outside student-visible targets', async () => {
    const forbiddenTargets = [
      '/teacher/resources',
      '/data-center',
      '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/session-1',
      '/api/learning-paths/path-1',
      'https://example.com/lesson',
    ];

    for (const target of forbiddenTargets) {
      const db = mockDb();
      const plan = frequencyResponsePlan();
      plan.mainPath[0] = {
        ...plan.mainPath[0],
        target,
      };

      await expect(persistLearningPathRound(db, {
        plan,
        inputSnapshot: { goalId: 'frequency-response-foundations' },
      })).rejects.toBeInstanceOf(ControlCorrectionPathRoundValidationError);
      expect(db.learningPath.upsert).not.toHaveBeenCalled();
    }
  });

  it('persists governed external resource path nodes with verified metadata', async () => {
    const db = mockDb();
    db.learningPath.findFirst = vi.fn(async () => null) as any;
    const plan = frequencyResponsePlan();
    plan.mainPath[0] = {
      ...plan.mainPath[0],
      nodeId: 'external-resource:ocw-bode',
      title: '外部伯德图资料',
      type: 'external_resource',
      ...pathNodeSemantics('external_resource'),
      sourceKind: 'external_resource',
      sourceRef: 'ocw-bode',
      target: 'https://ocw.mit.edu/control/bode',
      estimatedTimeMinutes: 15,
      externalResource: {
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/bode',
        estimatedTimeMinutes: 15,
        knowledgeCoverage: ['kn-bode'],
        applicableGoalId: 'frequency-response-foundations',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      },
      evidenceStatus: 'explicit-access-required',
    };
    plan.currentNodeId = 'external-resource:ocw-bode';

    await persistLearningPathRound(db, {
      plan,
      inputSnapshot: { goalId: 'frequency-response-foundations' },
    });

    expect(db.learningPath.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        currentNodeId: 'external-resource:ocw-bode',
      }),
    }));
  });

  it('rejects external resource path nodes without governed metadata', async () => {
    const db = mockDb();
    const plan = frequencyResponsePlan();
    plan.mainPath[0] = {
      ...plan.mainPath[0],
      nodeId: 'external-resource:unsafe',
      title: '未治理外部资料',
      type: 'external_resource',
      ...pathNodeSemantics('external_resource'),
      sourceKind: 'external_resource',
      sourceRef: 'unsafe',
      target: '/interactive-learning/resources/unsafe-external',
      externalResource: null,
    };
    plan.currentNodeId = 'external-resource:unsafe';

    await expect(persistLearningPathRound(db, {
      plan,
      inputSnapshot: { goalId: 'frequency-response-foundations' },
    })).rejects.toBeInstanceOf(ControlCorrectionPathRoundValidationError);
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('rejects external resource path nodes with non-positive estimated time', async () => {
    const db = mockDb();
    const plan = frequencyResponsePlan();
    plan.mainPath[0] = {
      ...plan.mainPath[0],
      nodeId: 'external-resource:negative-time',
      title: '负时长外部资料',
      type: 'external_resource',
      ...pathNodeSemantics('external_resource'),
      sourceKind: 'external_resource',
      sourceRef: 'negative-time',
      target: 'https://ocw.mit.edu/control/negative-time',
      estimatedTimeMinutes: -5,
      externalResource: {
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/negative-time',
        estimatedTimeMinutes: -5,
        knowledgeCoverage: ['kn-bode'],
        applicableGoalId: 'frequency-response-foundations',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      },
      evidenceStatus: 'explicit-access-required',
    };
    plan.currentNodeId = 'external-resource:negative-time';

    await expect(persistLearningPathRound(db, {
      plan,
      inputSnapshot: { goalId: 'frequency-response-foundations' },
    })).rejects.toBeInstanceOf(ControlCorrectionPathRoundValidationError);
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('rejects external resource path nodes scoped to another registered goal', async () => {
    const db = mockDb();
    const plan = frequencyResponsePlan();
    plan.mainPath[0] = {
      ...plan.mainPath[0],
      nodeId: 'external-resource:wrong-goal',
      title: '错误目标外部资料',
      type: 'external_resource',
      ...pathNodeSemantics('external_resource'),
      sourceKind: 'external_resource',
      sourceRef: 'wrong-goal',
      target: 'https://ocw.mit.edu/control/wrong-goal',
      estimatedTimeMinutes: 15,
      externalResource: {
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/wrong-goal',
        estimatedTimeMinutes: 15,
        knowledgeCoverage: ['kn-bode'],
        applicableGoalId: 'control-correction',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      },
      evidenceStatus: 'explicit-access-required',
    };
    plan.currentNodeId = 'external-resource:wrong-goal';

    await expect(persistLearningPathRound(db, {
      plan,
      inputSnapshot: { goalId: 'frequency-response-foundations' },
    })).rejects.toBeInstanceOf(ControlCorrectionPathRoundValidationError);
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('persists ai intervention nodes that the planner can include in path options', async () => {
    const db = mockDb();
    const plan = samplePlan();
    plan.mainPath.splice(1, 0, {
      nodeId: 'ai_intervention:control-correction-path-coach',
      title: '控灵路径辅导',
      type: 'ai_intervention',
      ...pathNodeSemantics('ai_intervention'),
      sourceKind: 'ai_intervention',
      sourceRef: 'control-correction-path-coach',
      target: '/adaptive-learning/path-advisor',
      estimatedTimeMinutes: 6,
      prerequisiteNodeIds: ['knowledge-card:control-correction-time-domain-targets'],
      knowledgeCoverage: ['control-correction:path-reflection'],
      teacherPolicy: 'allowed',
      privacyLevel: 'student-visible',
      terminalConstraints: [],
      score: 0.6,
      reasonCodes: ['matches-resource-preference'],
      status: 'next',
    });

    await persistControlCorrectionPathRound(db, { plan });

    expect(db.learningPath.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        pathPayload: expect.objectContaining({
          mainPathNodeIds: expect.arrayContaining([
            'ai_intervention:control-correction-path-coach',
            'arena-task:task-second-order-lead-pid',
          ]),
        }),
      }),
    }));
  });

  it('persists governed control-correction nodes from the registered resource mix', async () => {
    const db = mockDb();
    const plan = samplePlan();
    plan.mainPath.splice(
      1,
      0,
      {
        nodeId: 'adaptive-quiz:control-correction-targets',
        title: '校正指标自适应测验',
        type: 'adaptive_quiz',
        ...pathNodeSemantics('adaptive_quiz'),
        sourceKind: 'resource_registry',
        sourceRef: 'control-correction-targets',
        target: '/assessment/quizzes/control-correction-targets',
        estimatedTimeMinutes: 8,
        prerequisiteNodeIds: ['knowledge-card:control-correction-time-domain-targets'],
        knowledgeCoverage: ['control-correction:time-domain-targets'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: [],
        score: 0.7,
        reasonCodes: ['matches-knowledge-deficit'],
        status: 'next',
      },
      {
        nodeId: 'control-workbench:control-correction-lead',
        title: '超前校正工作台',
        type: 'control_workbench',
        ...pathNodeSemantics('control_workbench'),
        sourceKind: 'control_workbench',
        sourceRef: 'control-correction-lead',
        target: '/simulations/control-correction/lead-workbench',
        estimatedTimeMinutes: 14,
        prerequisiteNodeIds: ['adaptive-quiz:control-correction-targets'],
        knowledgeCoverage: ['control-correction:root-locus-design'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: [],
        score: 0.9,
        reasonCodes: ['matches-resource-preference'],
        status: 'next',
      },
      {
        nodeId: 'checkpoint:control-correction-design-review',
        title: '校正方案检查点',
        type: 'checkpoint',
        ...pathNodeSemantics('checkpoint'),
        sourceKind: 'checkpoint',
        sourceRef: 'control-correction-design-review',
        target: '/assessment/checkpoints/control-correction-design-review',
        estimatedTimeMinutes: 6,
        prerequisiteNodeIds: ['control-workbench:control-correction-lead'],
        knowledgeCoverage: ['control-correction:simulation-validation'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: [],
        score: 0.8,
        reasonCodes: ['requires-terminal-validation'],
        status: 'next',
      },
      {
        nodeId: 'konling:control-correction-path-support',
        title: '控灵路径支持',
        type: 'konling',
        ...pathNodeSemantics('konling'),
        sourceKind: 'konling',
        sourceRef: 'control-correction-path-support',
        target: '/adaptive-learning/path-advisor',
        estimatedTimeMinutes: 5,
        prerequisiteNodeIds: ['checkpoint:control-correction-design-review'],
        knowledgeCoverage: ['control-correction:arena-transfer'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: [],
        score: 0.6,
        reasonCodes: ['matches-resource-preference'],
        status: 'next',
      },
    );

    await persistControlCorrectionPathRound(db, { plan });

    expect(db.learningPath.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        pathPayload: expect.objectContaining({
          mainPathNodeIds: expect.arrayContaining([
            'adaptive-quiz:control-correction-targets',
            'control-workbench:control-correction-lead',
            'checkpoint:control-correction-design-review',
            'konling:control-correction-path-support',
            'arena-task:task-second-order-lead-pid',
          ]),
        }),
      }),
    }));
  });

  it('rejects control-correction external resources scoped to another goal', async () => {
    const db = mockDb();
    const plan = samplePlan();
    plan.mainPath.splice(1, 0, {
      nodeId: 'external-resource:control-wrong-goal',
      title: '错误目标外部资料',
      type: 'external_resource',
      ...pathNodeSemantics('external_resource'),
      sourceKind: 'external_resource',
      sourceRef: 'control-wrong-goal',
      target: 'https://ocw.mit.edu/control/wrong-goal',
      estimatedTimeMinutes: 12,
      prerequisiteNodeIds: ['knowledge-card:control-correction-time-domain-targets'],
      knowledgeCoverage: ['control-correction:root-locus-design'],
      teacherPolicy: 'allowed',
      privacyLevel: 'student-visible',
      terminalConstraints: [],
      score: 0.7,
      reasonCodes: ['matches-resource-preference'],
      status: 'next',
      externalResource: {
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/wrong-goal',
        estimatedTimeMinutes: 12,
        knowledgeCoverage: ['control-correction:root-locus-design'],
        applicableGoalId: 'frequency-response-foundations',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      },
      evidenceStatus: 'explicit-access-required',
    });

    await expect(persistControlCorrectionPathRound(db, {
      plan,
    })).rejects.toBeInstanceOf(ControlCorrectionPathRoundValidationError);
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
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

  it('records governed path activity kind without exposing raw lift metadata in the student path view', async () => {
    const db = mockDb();

    const execution = await recordPathNodeExecution(db, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'continue-key',
      liftMetadata: {
        pathActivityKind: 'continued-interaction',
        rawPrompt: 'do-not-expose',
      },
    });

    expect(execution).toMatchObject({
      liftMetadata: expect.objectContaining({ pathActivityKind: 'continued-interaction' }),
    });
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          payload: expect.objectContaining({
            relatedRefs: expect.objectContaining({
              activityKind: 'continued-interaction',
            }),
          }),
        }),
      ],
      skipDuplicates: true,
    }));

    const view = toControlCorrectionPathRoundView({
      id: 'path-1',
      userId: 'student-1',
      pathPayload: { planNodes: [] },
      executions: [execution],
      deviations: [],
      interventions: [],
    });
    expect(view?.executions[0]).toMatchObject({
      id: 'exec-created',
      activityKind: 'continued-interaction',
    });
    expect(view?.executions[0]).not.toHaveProperty('liftMetadata');
    expect(JSON.stringify(view)).not.toContain('do-not-expose');
  });

  it('keeps completed-node continued interaction from double-counting first completion', async () => {
    const db = mockDb();
    const path = {
      id: 'path-1',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      terminalValidation: { nodeId: null, state: 'not-required' },
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
      },
      lastExecutionMetadata: {
        completedNodeIds: ['node-1'],
        failedNodeIds: [],
      },
    };

    await updateControlCorrectionPathRoundAfterExecution(db, path, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'continue-key',
      liftMetadata: { pathActivityKind: 'continued-interaction' },
    });

    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'node-2',
        lastExecutionMetadata: expect.objectContaining({
          completedNodeIds: ['node-1'],
          lastExecution: expect.objectContaining({
            nodeId: 'node-1',
            status: 'completed',
          }),
        }),
      }),
    }));
  });

  it('preserves completed terminal validation when reviewing the terminal node', async () => {
    const db = mockDb();
    const completedTerminalValidation = {
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      state: 'completed',
      fallbackRequired: false,
      evidence: {
        arena: {
          id: 'arena-submission-1',
          provenance: 'official',
          valid: true,
        },
      },
      failureReasons: [],
      lowConfidenceMarkers: [],
    };
    const path = {
      id: 'path-1',
      pathStatus: 'completed',
      currentNodeId: 'arena-task:task-second-order-lead-pid',
      nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      pathPayload: {
        mainPathNodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      },
      terminalValidation: completedTerminalValidation,
      lastExecutionMetadata: {
        activeNodeId: 'arena-task:task-second-order-lead-pid',
        completedNodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
        terminalValidationState: 'completed',
      },
    };

    await updateControlCorrectionPathRoundAfterExecution(db, path, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'started',
      startedAt: '2026-06-15T06:00:00.000Z',
      liftMetadata: { pathActivityKind: 'review' },
    });

    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'completed',
        terminalValidation: completedTerminalValidation,
        lastExecutionMetadata: expect.objectContaining({
          activeNodeId: 'arena-task:task-second-order-lead-pid',
          completedNodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
          terminalValidationState: 'completed',
          lastExecution: expect.objectContaining({
            nodeId: 'arena-task:task-second-order-lead-pid',
            status: 'started',
          }),
        }),
      }),
    }));
  });

  it('does not roll back current path position when historical activity is appended to an older completed node', async () => {
    const db = mockDb();
    const path = {
      id: 'path-1',
      pathStatus: 'active',
      currentNodeId: 'node-3',
      terminalValidation: { nodeId: null, state: 'not-required' },
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
      },
      lastExecutionMetadata: {
        completedNodeIds: ['node-1', 'node-2'],
        failedNodeIds: [],
      },
    };

    await updateControlCorrectionPathRoundAfterExecution(db, path, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'continue-key',
      liftMetadata: { pathActivityKind: 'continued-interaction' },
    });

    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'node-3',
        lastExecutionMetadata: expect.objectContaining({
          completedNodeIds: ['node-1', 'node-2'],
          lastExecution: expect.objectContaining({
            nodeId: 'node-1',
            status: 'completed',
          }),
        }),
      }),
    }));
  });

  it('skips already handled nodes when completing a returned skipped node', async () => {
    const db = mockDb();
    const path = {
      id: 'path-1',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      terminalValidation: { nodeId: null, state: 'not-required' },
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
      },
      lastExecutionMetadata: {
        completedNodeIds: ['node-1', 'node-3'],
        failedNodeIds: [],
        skippedNodeIds: ['node-2'],
      },
    };

    await updateControlCorrectionPathRoundAfterExecution(db, path, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'node-2',
      resourceType: 'simulation',
      status: 'completed',
      completedAt: '2026-06-15T08:00:00.000Z',
      idempotencyKey: 'complete-returned-skipped-node',
    });

    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'node-4',
        lastExecutionMetadata: expect.objectContaining({
          activeNodeId: 'node-4',
          completedNodeIds: ['node-1', 'node-3', 'node-2'],
          failedNodeIds: [],
          lastExecution: expect.objectContaining({
            nodeId: 'node-2',
            status: 'completed',
          }),
        }),
      }),
    }));
  });

  it('records path style selection evidence for preference writeback without raw rationale leakage', async () => {
    const db = mockDb();

    const result = await recordPathChoiceEvidence(db, {
      pathId: 'path-1',
      userId: 'student-1',
      action: 'selection',
      selectedStyleId: 'arena-simulation-sprint',
      selectedPolicyFamily: 'simulation-driven',
      rejectedStyleIds: ['foundation-remediation', 'preference-matched-route'],
      diagnosisSnapshotRef: 'diagnosis-snapshot-1',
      resourceMix: { simulation: 2, arena_task: 1 },
      rationaleMetadata: {
        reason: 'want-terminal-validation',
        rawPrompt: 'do-not-store',
        secretToken: 'sk-secret',
      },
      idempotencyKey: 'choice-key',
    });

    expect(result).toEqual({
      emitted: true,
      dedupeKey: 'control-correction-path:choice:path-1:choice-key',
    });
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          eventType: 'control_correction_path.selection_recorded',
          ownerUserId: 'student-1',
          correlationId: 'path-1',
          dedupeKey: 'control-correction-path:choice:path-1:choice-key',
          payload: expect.objectContaining({
            sourceCapability: 'three-style-learning-path-loop',
            payloadVersion: 'control-correction-path-choice-evidence.v1',
            relatedRefs: expect.objectContaining({
              selectedStyleId: 'arena-simulation-sprint',
              rejectedStyleIds: ['foundation-remediation', 'preference-matched-route'],
              diagnosisSnapshotRef: 'diagnosis-snapshot-1',
            }),
            preferenceEvidence: expect.objectContaining({
              action: 'selection',
              resourceMix: { simulation: 2, arena_task: 1 },
              rationaleMetadata: { reason: 'want-terminal-validation' },
            }),
          }),
        }),
      ],
      skipDuplicates: true,
    }));
    expect(db.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          userId: 'student-1',
          factType: 'control_correction_path.selection_recorded',
          moduleId: 'control-correction-path-advisor',
          outcome: 'success',
          sourceEventId: 'control-correction-path:choice:path-1:choice-key',
          contextJson: expect.objectContaining({
            eventType: 'control_correction_path.selection_recorded',
            sourceCapability: 'three-style-learning-path-loop',
            preferenceEvidence: expect.objectContaining({
              action: 'selection',
              resourceMix: { simulation: 2, arena_task: 1 },
            }),
          }),
        }),
      ],
      skipDuplicates: true,
    }));
    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        pathPayload: expect.objectContaining({
          selectionHistory: [
            expect.objectContaining({
              id: 'control-correction-path:choice:path-1:choice-key',
              type: 'selection',
              selectedStyleId: 'arena-simulation-sprint',
              selectedPolicyFamily: 'simulation-driven',
              rejectedStyleIds: ['foundation-remediation', 'preference-matched-route'],
              diagnosisSnapshotRef: 'diagnosis-snapshot-1',
              helpful: null,
            }),
          ],
        }),
      }),
    }));
    expect(JSON.stringify(db.evidenceOutbox.createMany.mock.calls)).not.toContain('do-not-store');
    expect(JSON.stringify(db.evidenceOutbox.createMany.mock.calls)).not.toContain('sk-secret');
    expect(JSON.stringify(db.learningFact.createMany.mock.calls)).not.toContain('do-not-store');
    expect(JSON.stringify(db.learningFact.createMany.mock.calls)).not.toContain('sk-secret');
  });

  it('keeps repeated path choice interactions distinct when idempotency is not supplied', async () => {
    const db = mockDb();

    const first = await recordPathChoiceEvidence(db, {
      pathId: 'path-1',
      userId: 'student-1',
      action: 'helpfulness',
      selectedStyleId: 'foundation-remediation',
      helpful: true,
      eventId: 'helpful-event-1',
    });
    const second = await recordPathChoiceEvidence(db, {
      pathId: 'path-1',
      userId: 'student-1',
      action: 'helpfulness',
      selectedStyleId: 'foundation-remediation',
      helpful: false,
      eventId: 'helpful-event-2',
    });

    expect(first.dedupeKey).toBe('control-correction-path:choice:path-1:helpful-event-1');
    expect(second.dedupeKey).toBe('control-correction-path:choice:path-1:helpful-event-2');
    expect(db.evidenceOutbox.createMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: [expect.objectContaining({
        dedupeKey: 'control-correction-path:choice:path-1:helpful-event-1',
        causationId: 'LearningPathChoice:helpful-event-1',
      })],
    }));
    expect(db.evidenceOutbox.createMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: [expect.objectContaining({
        dedupeKey: 'control-correction-path:choice:path-1:helpful-event-2',
        causationId: 'LearningPathChoice:helpful-event-2',
      })],
    }));
  });

  it('records generic path choice evidence without control-correction event names', async () => {
    const db = mockDb();

    const result = await recordPathChoiceEvidence(db, {
      pathId: 'path-frequency',
      userId: 'student-1',
      goalId: 'frequency-response-foundations',
      action: 'selection',
      selectedStyleId: 'foundation-remediation',
      selectedPolicyFamily: 'foundation-remediation',
      resourceMix: { knowledge_card: 1 },
      idempotencyKey: 'choice-key',
    });

    expect(result).toEqual({
      emitted: true,
      dedupeKey: 'learning-path:choice:path-frequency:choice-key',
    });
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          eventType: 'learning_path.selection_recorded',
          dedupeKey: 'learning-path:choice:path-frequency:choice-key',
          payload: expect.objectContaining({
            goalId: 'frequency-response-foundations',
            sourceCapability: 'generic-learning-path-loop',
            payloadVersion: 'learning-path-choice-evidence.v1',
          }),
        }),
      ],
      skipDuplicates: true,
    }));
    expect(db.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          factType: 'learning_path.selection_recorded',
          moduleId: 'frequency-response-foundations-path-advisor',
          sourceEventId: 'learning-path:choice:path-frequency:choice-key',
          contextJson: expect.objectContaining({
            goalId: 'frequency-response-foundations',
          }),
        }),
      ],
      skipDuplicates: true,
    }));
    expect(JSON.stringify(db.evidenceOutbox.createMany.mock.calls)).not.toContain('control_correction_path');
    expect(JSON.stringify(db.learningFact.createMany.mock.calls)).not.toContain('control-correction-path');
  });

  it('records generic path activity evidence without control-correction event names', async () => {
    const db = mockDb();

    await recordPathNodeExecution(db, {
      pathId: 'path-frequency',
      userId: 'student-1',
      goalId: 'frequency-response-foundations',
      nodeId: 'registry:bode-quiz',
      resourceType: 'quiz',
      status: 'completed',
      idempotencyKey: 'exec-key',
    });
    await recordPathDeviation(db, {
      pathId: 'path-frequency',
      userId: 'student-1',
      goalId: 'frequency-response-foundations',
      deviationType: 'skip',
      targetNodeId: 'registry:bode-card',
      evidenceConfidence: 'low',
      idempotencyKey: 'dev-key',
    });
    await recordPathIntervention(db, {
      pathId: 'path-frequency',
      userId: 'student-1',
      goalId: 'frequency-response-foundations',
      interventionKind: 'hint',
      suggestedAction: '回看伯德图基础卡。',
      privacySafeSummary: '建议回看伯德图基础卡。',
      idempotencyKey: 'int-key',
    });

    expect(db.evidenceOutbox.createMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: [expect.objectContaining({
        eventType: 'learning_path.execution_recorded',
        dedupeKey: 'learning-path:execution:path-frequency:exec-key',
        payload: expect.objectContaining({
          goalId: 'frequency-response-foundations',
          sourceCapability: 'generic-path-execution-evidence-cache',
          payloadVersion: 'learning-path-evidence.v1',
        }),
      })],
    }));
    expect(db.evidenceOutbox.createMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: [expect.objectContaining({
        eventType: 'learning_path.deviation_recorded',
        dedupeKey: 'learning-path:deviation:path-frequency:dev-key',
        payload: expect.objectContaining({
          goalId: 'frequency-response-foundations',
        }),
      })],
    }));
    expect(db.evidenceOutbox.createMany).toHaveBeenNthCalledWith(3, expect.objectContaining({
      data: [expect.objectContaining({
        eventType: 'learning_path.intervention_recorded',
        dedupeKey: 'learning-path:intervention:path-frequency:int-key',
        payload: expect.objectContaining({
          goalId: 'frequency-response-foundations',
        }),
      })],
    }));
    expect(JSON.stringify(db.evidenceOutbox.createMany.mock.calls)).not.toContain('control_correction_path');
    expect(JSON.stringify(db.evidenceOutbox.createMany.mock.calls)).not.toContain('control-correction-path');
  });

  it('does not append duplicate path choice history for idempotent retries', async () => {
    const db = mockDb();
    db.learningPath.findFirst = vi.fn(async () => ({
      id: 'path-1',
      userId: 'student-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'knowledge-card:control-correction-time-domain-targets',
      terminalValidation: { nodeId: 'arena-task:task-second-order-lead-pid', type: 'arena_task' },
      pathPayload: {
        selectionHistory: [{
          id: 'control-correction-path:choice:path-1:choice-key',
          type: 'selection',
        }],
      },
      executions: [],
      deviations: [],
      interventions: [],
    }));

    await recordPathChoiceEvidence(db, {
      pathId: 'path-1',
      userId: 'student-1',
      action: 'selection',
      selectedStyleId: 'arena-simulation-sprint',
      idempotencyKey: 'choice-key',
    });

    expect(db.learningPath.update).not.toHaveBeenCalled();
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
    }));
    expect(db.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
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

  it('rejects non-compatible policy families for control-correction persistence', async () => {
    const db = mockDb();
    const plan = {
      ...samplePlan(),
      policyFamily: 'simulation-driven' as const,
      policyMetadata: ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES['simulation-driven'],
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

  it('derives plan node status from current node and completed execution metadata', () => {
    const view = toControlCorrectionPathRoundView({
      id: 'path-1',
      userId: 'student-1',
      goalId: 'control-correction',
      currentNodeId: 'node-2',
      pathPayload: {
        planNodes: [
          { nodeId: 'node-1', status: 'current', type: 'external_resource' },
          { nodeId: 'node-2', status: 'next', type: 'knowledge_node' },
        ],
        executionStatus: {
          activeNodeId: 'node-1',
          completedNodeIds: [],
        },
        visualization: {
          map: {
            currentNodeId: 'node-1',
            completedNodeIds: [],
          },
        },
      },
      lastExecutionMetadata: {
        completedNodeIds: ['node-1'],
      },
    });
    const pathPayload = view?.pathPayload as {
      planNodes: Array<Record<string, unknown>>;
      executionStatus: Record<string, unknown>;
      visualization: { map: Record<string, unknown> };
    };

    expect(pathPayload.planNodes).toEqual([
      expect.objectContaining({ nodeId: 'node-1', status: 'completed' }),
      expect.objectContaining({ nodeId: 'node-2', status: 'current' }),
    ]);
    expect(pathPayload.executionStatus).toMatchObject({
      activeNodeId: 'node-2',
      completedNodeIds: ['node-1'],
    });
    expect(pathPayload.visualization.map).toMatchObject({
      currentNodeId: 'node-2',
      completedNodeIds: ['node-1'],
    });
  });

  it('shows a failed current node as blocked in the route view', () => {
    const view = toControlCorrectionPathRoundView({
      id: 'path-1',
      userId: 'student-1',
      goalId: 'control-correction',
      currentNodeId: 'node-1',
      pathPayload: {
        planNodes: [
          { nodeId: 'node-1', status: 'current', type: 'simulation' },
          { nodeId: 'node-2', status: 'next', type: 'knowledge_node' },
        ],
      },
      lastExecutionMetadata: {
        failedNodeIds: ['node-1'],
      },
    });
    const pathPayload = view?.pathPayload as {
      planNodes: Array<Record<string, unknown>>;
      executionStatus: Record<string, unknown>;
    };

    expect(pathPayload.planNodes[0]).toEqual(expect.objectContaining({
      nodeId: 'node-1',
      status: 'blocked',
    }));
    expect(pathPayload.executionStatus).toMatchObject({
      activeNodeId: 'node-1',
      failedNodeIds: ['node-1'],
    });
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

  it('omits undefined terminal validation evidence keys from JSON payloads', async () => {
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

    await updateControlCorrectionPathRoundAfterExecution(db, path, {
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
    });

    const terminalValidation = db.learningPath.update.mock.calls[0][0].data.terminalValidation;
    expect(Object.prototype.hasOwnProperty.call(terminalValidation.evidence, 'simulation')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(terminalValidation.evidence, 'arena')).toBe(false);
  });
});
