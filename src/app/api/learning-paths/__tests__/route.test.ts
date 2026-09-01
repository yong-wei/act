import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  persistLearningPathRound: vi.fn(),
  persistControlCorrectionPathRound: vi.fn(),
  readControlCorrectionPathRound: vi.fn(),
  recordPathNodeExecution: vi.fn(),
  recordPathDeviation: vi.fn(),
  recordPathIntervention: vi.fn(),
  recordPathChoiceEvidence: vi.fn(),
  refreshStudentEvidenceFeatureCache: vi.fn(),
  currentCatalogSnapshots: new Map<string, unknown>(),
  prisma: {
    learningPath: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    learningPathExecution: {
      findFirst: vi.fn(),
    },
    learningPathDeviation: {
      findFirst: vi.fn(),
    },
    simulationRun: {
      findFirst: vi.fn(),
    },
    arenaSubmission: {
      findFirst: vi.fn(),
    },
    arenaVirtualSimulationRun: {
      findFirst: vi.fn(),
    },
    adaptiveAssessmentAnswer: {
      findFirst: vi.fn(),
    },
    adaptivePathCandidateBatch: {
      findUnique: vi.fn(),
    },
    agentToolRun: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    studentProfile: {
      findUnique: vi.fn(),
    },
    class: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/control-correction-path-rounds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/control-correction-path-rounds')>();
  return {
    ...actual,
    isControlCorrectionPathRoundPersistenceEnabled: () => process.env.CONTROL_CORRECTION_PATH_ROUNDS_ENABLED !== 'false',
    persistLearningPathRound: mocks.persistLearningPathRound,
    persistControlCorrectionPathRound: mocks.persistControlCorrectionPathRound,
    readControlCorrectionPathRound: mocks.readControlCorrectionPathRound,
    recordPathNodeExecution: mocks.recordPathNodeExecution,
    recordPathDeviation: mocks.recordPathDeviation,
    recordPathIntervention: mocks.recordPathIntervention,
    recordPathChoiceEvidence: mocks.recordPathChoiceEvidence,
  };
});

vi.mock('@/lib/data-governance/student-evidence-feature-cache', () => ({
  refreshStudentEvidenceFeatureCache: mocks.refreshStudentEvidenceFeatureCache,
}));

vi.mock('@/features/assessment/adaptive-assessment-catalog-selector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/assessment/adaptive-assessment-catalog-selector')>();
  return {
    ...actual,
    findAdaptiveAssessmentCatalogSnapshot: (questionId: string) =>
      mocks.currentCatalogSnapshots.get(questionId) ?? null,
  };
});

import { assessmentItemSemanticReviewSourceHash } from '@/features/assessment/adaptive-assessment-semantic-review';

import { POST as planPath } from '../plan/route';
import { GET as readLatestPath } from '../latest/route';
import { GET as readPath } from '../[id]/route';
import { GET as launchPathNode, POST as executePath } from '../[id]/execute/route';
import { POST as deviatePath } from '../[id]/deviations/route';
import { POST as intervenePath } from '../[id]/interventions/route';
import { POST as choosePath } from '../[id]/choices/route';

const params = { params: Promise.resolve({ id: 'path-1' }) };

function post(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function journeyPathRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'path-1',
    userId: 'student-1',
    classId: 'class-1',
    title: '校正学习路径',
    goalId: 'control-correction',
    pathStatus: 'active',
    currentNodeId: 'node-1',
    nodeIds: ['node-1', 'node-2'],
    pathPayload: {
      mainPathNodeIds: ['node-1', 'node-2'],
      planNodes: [
        { nodeId: 'node-1', title: '知识回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'current', readiness: { state: 'ready' } },
        { nodeId: 'node-2', title: '校正练习', type: 'adaptive_quiz', target: '/assessment/adaptive-practice', status: 'next', readiness: { state: 'ready' } },
      ],
    },
    terminalValidation: { nodeId: null, state: 'not-required' },
    lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [], skippedNodeIds: [] },
    ...overrides,
  };
}

function useStructuredTerminalPath() {
  mocks.prisma.learningPath.findUnique.mockResolvedValue({
    id: 'path-1',
    userId: 'student-1',
    classId: 'class-1',
    goalId: 'control-correction',
    pathStatus: 'active',
    currentNodeId: 'arena-task:task-second-order-lead-pid',
    nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
    pathPayload: {
      mainPathNodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      planNodes: [
        {
          nodeId: 'simulation:control-correction-step-response-lab',
          type: 'simulation',
          target: 'control-correction-step-response-lab',
        },
        {
          nodeId: 'arena-task:task-second-order-lead-pid',
          type: 'arena_task',
          sourceKind: 'arena_task',
          sourceRef: 'task-second-order-lead-pid',
          target: '/arena/challenges/task-second-order-lead-pid',
        },
      ],
    },
    terminalValidation: {
      nodeId: 'arena-task:task-second-order-lead-pid',
      state: 'pending',
      target: '/arena/challenges/task-second-order-lead-pid',
    },
    lastExecutionMetadata: { completedNodeIds: ['simulation:control-correction-step-response-lab'] },
  });
}

function useStructuredSimulationPath() {
  mocks.prisma.learningPath.findUnique.mockResolvedValue({
    id: 'path-1',
    userId: 'student-1',
    classId: 'class-1',
    goalId: 'control-correction',
    pathStatus: 'active',
    currentNodeId: 'simulation:control-correction-step-response-lab',
    nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
    pathPayload: {
      mainPathNodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      planNodes: [
        {
          nodeId: 'simulation:control-correction-step-response-lab',
          type: 'simulation',
          target: 'control-correction-step-response-lab',
        },
        {
          nodeId: 'arena-task:task-second-order-lead-pid',
          type: 'arena_task',
          target: '/arena/challenges/task-second-order-lead-pid',
          status: 'locked',
          readiness: {
            state: 'locked',
            missingCompletedNodeIds: ['simulation:control-correction-step-response-lab'],
            missingOutcomeRefs: ['simulation_run:control-correction-step-response-lab'],
          },
        },
      ],
    },
    terminalValidation: {
      nodeId: 'arena-task:task-second-order-lead-pid',
      state: 'pending',
      target: '/arena/challenges/task-second-order-lead-pid',
    },
    lastExecutionMetadata: { completedNodeIds: [] },
  });
}

function useStructuredAdaptiveAssessmentPath(answerOutcomeRef = 'adaptive_assessment:answer-1') {
  mocks.prisma.learningPath.findUnique.mockResolvedValue({
    id: 'path-1',
    userId: 'student-1',
    classId: 'class-1',
    goalId: 'control-correction',
    pathStatus: 'active',
    currentNodeId: 'adaptive-quiz:control-target-check',
    nodeIds: ['adaptive-quiz:control-target-check', 'control-workbench:lead-design'],
    pathPayload: {
      mainPathNodeIds: ['adaptive-quiz:control-target-check', 'control-workbench:lead-design'],
      planNodes: [
        {
          nodeId: 'adaptive-quiz:control-target-check',
          type: 'adaptive_quiz',
          target: '/assessment/adaptive-practice',
        },
        {
          nodeId: 'control-workbench:lead-design',
          type: 'control_workbench',
          target: '/interactive-learning/control-workbench',
          status: 'locked',
          readiness: {
            state: 'locked',
            missingCompletedNodeIds: [],
            missingOutcomeRefs: [answerOutcomeRef],
          },
        },
      ],
    },
    terminalValidation: { nodeId: null, state: 'not-required' },
    lastExecutionMetadata: { completedNodeIds: [] },
  });
}

function useStructuredCheckpointAssessmentPath() {
  mocks.prisma.learningPath.findUnique.mockResolvedValue({
    id: 'path-1',
    userId: 'student-1',
    classId: 'class-1',
    goalId: 'control-correction',
    pathStatus: 'active',
    currentNodeId: 'checkpoint:control-correction-review',
    nodeIds: ['checkpoint:control-correction-review', 'control-workbench:lead-design'],
    pathPayload: {
      mainPathNodeIds: ['checkpoint:control-correction-review', 'control-workbench:lead-design'],
      planNodes: [
        {
          nodeId: 'checkpoint:control-correction-review',
          type: 'checkpoint',
          target: '/assessment/adaptive-practice',
        },
        {
          nodeId: 'control-workbench:lead-design',
          type: 'control_workbench',
          target: '/interactive-learning/control-workbench',
          status: 'locked',
          readiness: {
            state: 'locked',
            missingCompletedNodeIds: ['checkpoint:control-correction-review'],
            missingOutcomeRefs: ['adaptive_assessment:answer-1'],
          },
        },
      ],
    },
    terminalValidation: { nodeId: null, state: 'not-required' },
    lastExecutionMetadata: { completedNodeIds: [] },
  });
}

function reviewedAdaptiveAssessmentAnswer(params: {
  id: string;
  questionId: string;
  purpose: 'readiness-gate' | 'checkpoint' | 'remediation' | 'practice' | 'terminal-validation';
  nodeId: string;
  goalId?: string;
  questionScope?: string;
  catalogStage?: 'readiness' | 'checkpoint' | 'remediation' | 'terminal-validation';
  includeCatalogRef?: boolean;
  createdAt?: Date;
  answeredAt?: Date;
}) {
  const goalId = params.goalId ?? 'control-correction';
  const metadata: Record<string, unknown> = {
    kaq: {
      immutableContentHash: `reviewed-${params.purpose}-hash-1`,
      learningGoalIds: [goalId],
      purpose: params.purpose,
      outcomeRefs: [`quiz-outcome:${goalId}:${params.purpose}:${params.questionId}`],
      review: { state: 'reviewed' },
    },
  };
  if (params.includeCatalogRef !== false && params.catalogStage) {
    metadata.adaptiveAssessmentItemRef = assessmentCatalogSnapshot(
      params.questionId,
      goalId,
      params.catalogStage,
    );
  }

  return {
    id: params.id,
    questionId: params.questionId,
    isCorrect: true,
    score: 100,
    abilityEstimate: 0.66,
    createdAt: params.createdAt ?? new Date('2026-06-04T09:58:00.000Z'),
    answeredAt: params.answeredAt ?? new Date('2026-06-04T09:59:00.000Z'),
    questionRef: {
      knowledgeTags: ['controller-tuning'],
      questionType: 'multi-criteria',
      difficulty: 0.7,
      metadata,
    },
    abilityEstimateSnapshot: {
      dimensions: {
        pathExecution: {
          pathId: 'path-1',
          nodeId: params.nodeId,
          goalId,
          ...(params.questionScope ? { questionScope: params.questionScope } : {}),
        },
      },
    },
  };
}

function assessmentCatalogSnapshot(
  questionId: string,
  goalId: string,
  stage: 'readiness' | 'checkpoint' | 'remediation' | 'terminal-validation',
) {
  const contentHash = `content-hash:${questionId}`;
  const kaqObjectiveIds = [`knowledge:${goalId}`];
  const graphNodeIds = [`kn:${goalId}`];
  const misconceptionRefs = [`misconception:${goalId}`];
  const remediationRefs = [`registry:${goalId}-remediation`];
  const versionRefs = { testAssessmentVersion: 'test-assessment.v1' };
  const reviewDecision = {
    catalogItemId: `adaptive-assessment-item:${stage}:${questionId}`,
    decisionKind: 'human-review' as const,
    outcome: 'approved' as const,
    reviewerId: 'reviewer:test',
    reviewedAt: '2026-06-03T00:00:00.000Z',
    reviewBatchId: 'test-assessment.v1',
    sourceContentHash: contentHash,
    selectedLearningGoalIds: [goalId],
    selectedKaqObjectiveIds: kaqObjectiveIds,
    selectedGraphNodeIds: graphNodeIds,
    selectedStagePurpose: stage,
    difficulty: 0.7,
    cognitiveLevel: 'apply',
    misconceptionRefs,
    remediationRefs,
    metadataVersionRefs: versionRefs,
    notes: 'Reviewed test assessment evidence contract.',
  };
  const snapshot = {
    catalogBacked: true,
    catalogItemId: `adaptive-assessment-item:${stage}:${questionId}`,
    sourceFamily: 'preset-adaptive-question',
    sourceId: questionId,
    sourceAnchor: `test:${questionId}`,
    sourceLineage: {
      sourceFamily: 'preset-adaptive-question',
      sourceId: questionId,
      sourcePath: null,
      sourceHash: contentHash,
    },
    contentHash,
    contentHashAlgorithm: 'sha256',
    reviewState: 'path-eligible',
    eligibilityState: 'path-eligible',
    allowedStages: ['low-stakes-practice', stage],
    questionRefs: {
      stem: 'Reviewed assessment fixture',
      answerKey: ['A'],
      rubricRef: 'rubric:test-assessment.v1',
    },
    semanticRefs: {
      learningGoalIds: [goalId],
      kaqObjectiveIds,
      graphNodeIds,
      knowledgeTags: [goalId],
      misconceptionTags: misconceptionRefs,
      remediationResourceNodeIds: remediationRefs,
      difficulty: 0.7,
      cognitiveLevel: 'apply',
      assessmentStage: stage,
    },
    versionRefs,
    limitations: [],
    reviewDecision: {
      ...reviewDecision,
      reviewSourceHash: assessmentItemSemanticReviewSourceHash(reviewDecision),
    },
    relationship: {
      relationship: 'answer-time-snapshot',
      immutable: true,
      mayReferenceCatalogItemId: true,
      mayReferenceContentHash: true,
      catalogUpdatesRewriteHistoricalAnswers: false,
    },
  };
  mocks.currentCatalogSnapshots.set(questionId, snapshot);
  return snapshot;
}

describe('learning path round API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentCatalogSnapshots.clear();
    delete process.env.CONTROL_CORRECTION_PATH_ROUNDS_ENABLED;
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        planNodes: [
          {
            nodeId: 'node-1',
            type: 'simulation',
            target: '/simulations/cruise',
          },
        ],
        executionStatus: {
          activeNodeId: 'node-1',
          completedNodeIds: ['node-1', 'arena-task:terminal'],
          failedNodeIds: ['node-failed', 'simulation:control-correction-step-response-lab'],
          skippedNodeIds: ['node-skipped'],
        },
        visualization: {
          map: {
            currentNodeId: 'node-1',
            mainPathNodeIds: ['node-1'],
            completedNodeIds: ['node-1', 'arena-task:terminal'],
            failedNodeIds: ['node-failed', 'simulation:control-correction-step-response-lab'],
            skippedNodeIds: ['node-skipped'],
          },
        },
        policyBundle: {
          status: 'ready',
          paths: [
            {
              styleId: 'foundation-remediation',
              policyFamily: 'foundation-remediation',
              nodeIds: ['knowledge-card:targets', 'arena-task:terminal'],
              activeNodeIds: ['knowledge-card:targets', 'arena-task:terminal'],
              planNodes: [
                { nodeId: 'knowledge-card:targets', type: 'knowledge_card', target: '/knowledge/cards/targets' },
                { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
              ],
              resourceMix: { knowledge_card: 1, arena_task: 1 },
              evidenceBasis: ['adaptive-learner-state'],
              limitations: ['terminal-validation-required'],
              terminalValidationNodeIds: ['arena-task:terminal'],
            },
            {
              styleId: 'simulation-driven',
              policyFamily: 'simulation-driven',
              nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
              activeNodeIds: ['arena-task:terminal'],
              planNodes: [
                { nodeId: 'simulation:control-correction-step-response-lab', type: 'simulation', target: '/simulations/control-correction-step-response-lab' },
                { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
              ],
              resourceMix: { simulation: 1, arena_task: 1 },
              evidenceBasis: ['simulation-run'],
              terminalValidationNodeIds: ['arena-task:terminal'],
            },
          ],
        },
      },
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });
    // Fence re-reads use findFirst without consuming findUnique once-queues.
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' }],
      },
      lastExecutionMetadata: { completedNodeIds: [] },
      terminalValidation: { nodeId: null, state: 'not-required' },
    });
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({ userId: 'student-1', classId: 'class-1' });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.learningPath.update.mockResolvedValue({ id: 'path-1' });
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValue(null);
    mocks.prisma.learningPathDeviation.findFirst.mockResolvedValue(null);
    mocks.prisma.simulationRun.findFirst.mockResolvedValue(null);
    mocks.prisma.arenaSubmission.findFirst.mockResolvedValue(null);
    mocks.prisma.arenaVirtualSimulationRun.findFirst.mockResolvedValue(null);
    mocks.persistControlCorrectionPathRound.mockResolvedValue({ id: 'path-1' });
    mocks.persistLearningPathRound.mockResolvedValue({ id: 'path-1' });
    mocks.readControlCorrectionPathRound.mockResolvedValue({
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
    mocks.recordPathNodeExecution.mockResolvedValue({
      id: 'exec-1',
      nodeId: 'node-1',
      status: 'completed',
      evidenceRefs: [{ raw: true }],
      liftMetadata: { rawTracePayload: true },
      simulationRef: { raw: true },
    });
    mocks.recordPathDeviation.mockResolvedValue({ id: 'dev-1', deviationType: 'skip', context: { raw: true } });
    mocks.recordPathIntervention.mockResolvedValue({
      id: 'int-1',
      interventionKind: 'hint',
      studentOutcome: 'accepted',
      suggestedAction: 'raw model text',
      citedEvidence: [{ raw: true }],
      privacySafeSummary: '建议回看根轨迹规则。',
    });
    mocks.recordPathChoiceEvidence.mockResolvedValue({
      emitted: true,
      dedupeKey: 'control-correction-path:choice:path-1:choice-key',
    });
    mocks.refreshStudentEvidenceFeatureCache.mockResolvedValue({ userId: 'student-1' });
  });

  function configureSingleNodePath(
    nodeId: string,
    type: string,
    target: string,
    options: {
      goalId?: string;
      includePlanNodes?: boolean;
      terminalValidation?: Record<string, unknown>;
      planNode?: Record<string, unknown>;
    } = {},
  ) {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: options.goalId ?? 'frequency-response-foundations',
      pathStatus: 'active',
      currentNodeId: nodeId,
      nodeIds: [nodeId],
      pathPayload: {
        mainPathNodeIds: [nodeId],
        ...(options.includePlanNodes === false
          ? {}
          : {
              planNodes: [
                {
                  nodeId,
                  type,
                  target,
                  ...options.planNode,
                },
              ],
            }),
      },
      terminalValidation: options.terminalValidation ?? { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });
  }

  function legacyRegistryDependentPath(registryId: string, taskId: string) {
    const legacyNodeId = `registry:${registryId}`;
    const canonicalNodeId = `arena-task:${taskId}`;
    return {
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: legacyNodeId,
      entryNodeId: legacyNodeId,
      nodeIds: [legacyNodeId, canonicalNodeId, 'reflection:post-arena-review'],
      pathPayload: {
        mainPathNodeIds: [legacyNodeId, canonicalNodeId, 'reflection:post-arena-review'],
        planNodes: [
          {
            nodeId: legacyNodeId,
            type: 'arena_task',
            sourceKind: 'resource_registry',
            sourceRef: registryId,
            target: `/arena/challenges/${taskId}`,
          },
          {
            nodeId: 'reflection:post-arena-review',
            type: 'reflection',
            target: '/profile/growth?prompt=post-arena-review',
            prerequisiteNodeIds: [legacyNodeId, canonicalNodeId],
            readiness: {
              state: 'locked',
              requiredCompletedNodeIds: [legacyNodeId, canonicalNodeId],
              fallbackNodeIds: [legacyNodeId, canonicalNodeId],
              missingCompletedNodeIds: [legacyNodeId, canonicalNodeId],
              missingCompetencies: [],
              missingEvidenceCount: 0,
              missingOutcomeRefs: [],
            },
          },
        ],
        executionStatus: {
          activeNodeId: legacyNodeId,
          completedNodeIds: [],
        },
        activity: [
          { id: 'activity-node', nodeId: legacyNodeId, type: 'execution' },
          { id: 'activity-nodes', nodeIds: [legacyNodeId, canonicalNodeId], type: 'correction' },
        ],
        selectionHistory: [{
          id: 'selection-legacy-arena',
          nodeId: legacyNodeId,
          selectedStyleId: 'simulation-driven',
        }],
        graphContext: {
          limitations: [{ nodeId: legacyNodeId, code: 'graph-node-alias-collision' }],
          objectiveBoundaryDiagnostics: {
            selectedResourceMatches: [{ nodeId: legacyNodeId, matchedRefs: ['graph:legacy'] }],
          },
        },
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: [] },
      deviations: [{
        id: 'legacy-deviation-1',
        priorNodeId: legacyNodeId,
        targetNodeId: legacyNodeId,
      }],
    };
  }

  it('requires authentication before creating a path round', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      plan: { goal: { id: 'control-correction' }, userId: 'student-1' },
    }));

    expect(response.status).toBe(401);
    expect(mocks.persistControlCorrectionPathRound).not.toHaveBeenCalled();
  });

  it('prevents a student from forging another owner during plan creation', async () => {
    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      plan: { id: 'path-1', goal: { id: 'control-correction' }, userId: 'student-2' },
    }));

    expect(response.status).toBe(403);
    expect(mocks.persistControlCorrectionPathRound).not.toHaveBeenCalled();
  });

  it('prevents a student from directly submitting a persisted path plan', async () => {
    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      plan: { id: 'path-1', goal: { id: 'control-correction' }, userId: 'student-1' },
      classId: 'class-1',
    }));

    expect(response.status).toBe(403);
    expect(mocks.persistControlCorrectionPathRound).not.toHaveBeenCalled();
  });

  it('rejects plan creation when the feature flag is disabled', async () => {
    process.env.CONTROL_CORRECTION_PATH_ROUNDS_ENABLED = 'false';

    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      plan: { id: 'path-1', goal: { id: 'control-correction' }, userId: 'student-1' },
      classId: 'class-1',
    }));

    expect(response.status).toBe(503);
    expect(mocks.persistControlCorrectionPathRound).not.toHaveBeenCalled();
  });

  it('persists a teacher scoped control-correction path round for a student', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      plan: { id: 'path-1', goal: { id: 'control-correction' }, userId: 'student-1' },
      learnerStateRef: 'cache-1',
      classId: 'class-1',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.path.id).toBe('path-1');
    expect(mocks.persistControlCorrectionPathRound).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      learnerStateRef: 'cache-1',
      classId: 'class-1',
    }));
  });

  it('persists a teacher scoped registered non-control path round for a student', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningPath.findUnique.mockResolvedValue(null);
    mocks.persistLearningPathRound.mockResolvedValue({ id: 'path-frequency' });

    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      plan: {
        id: 'path-frequency',
        goal: {
          id: 'frequency-response-foundations',
          title: '频率响应基础',
          knowledgeTargets: ['kn-bode'],
        },
        userId: 'student-1',
        stage: 'stage-1-rules-graph',
        policyFamily: 'foundation-remediation',
        mainPath: [{
          nodeId: 'registry:bode-card',
          title: '伯德图知识卡',
          type: 'knowledge_card',
          sourceKind: 'resource_registry',
          sourceRef: 'bode-card',
          target: '/interactive-learning/resources/bode-card',
          estimatedTimeMinutes: 10,
          prerequisiteNodeIds: [],
          knowledgeCoverage: ['kn-bode'],
          teacherPolicy: 'allowed',
          privacyLevel: 'student-visible',
          terminalConstraints: [],
          score: 1,
          reasonCodes: ['matches-knowledge-deficit'],
          status: 'current',
        }],
        alternatives: [],
        confidence: { level: 'low', score: 0.2, sourceCoverage: 0.2 },
        explanations: { selectedReasons: ['matches-knowledge-deficit'], rejectedAlternatives: [], fallbackReasons: ['learner-evidence-low-confidence'] },
        executionStatus: { adopted: false, completedNodeIds: [], activeNodeId: 'registry:bode-card', updatedAt: '2026-06-14T08:00:00.000Z' },
        deviations: [],
        corrections: [],
        feedbackEvents: [],
        visualization: {
          map: { mainPathNodeIds: ['registry:bode-card'], branchPaths: [], currentNodeId: 'registry:bode-card', completedNodeIds: [], riskNodeIds: [], blockedNodes: [], alternatives: [] },
          timeline: { generatedAt: '2026-06-14T08:00:00.000Z', windows: [] },
          evidence: { evidenceBasis: 'adaptive-learner-state', confidence: { level: 'low', score: 0.2, sourceCoverage: 0.2 }, sourceCoverage: {}, learnerStateDeficits: [], prerequisiteReasons: [], teacherPolicy: [], alternatives: [] },
        },
      },
      learnerStateRef: 'cache-frequency',
      classId: 'class-1',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.path.id).toBe('path-frequency');
    expect(mocks.persistLearningPathRound).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      learnerStateRef: 'cache-frequency',
      classId: 'class-1',
    }));
    expect(mocks.persistControlCorrectionPathRound).not.toHaveBeenCalled();
  });

  it('returns the latest authenticated student path for a registered goal', async () => {
    const response = await readLatestPath(new Request('http://localhost/api/learning-paths/latest?goal=control-correction'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.path.id).toBe('path-1');
    expect(mocks.prisma.learningPath.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'student-1',
        goalId: 'control-correction',
        isAiGenerated: true,
        pathStatus: 'active',
      },
      select: {
        id: true,
        userId: true,
        classId: true,
        goalId: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    expect(mocks.prisma.learningPath.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.readControlCorrectionPathRound).toHaveBeenCalledWith(expect.anything(), {
      pathId: 'path-1',
      userId: 'student-1',
    });
  });

  it('falls back to completed latest paths only when no active or fallback path exists', async () => {
    mocks.prisma.learningPath.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'completed-path',
        userId: 'student-1',
        classId: 'class-1',
        goalId: 'control-correction',
      });
    mocks.readControlCorrectionPathRound.mockResolvedValueOnce({
      id: 'completed-path',
      userId: 'student-1',
      pathStatus: 'completed',
      executions: [],
      deviations: [],
      interventions: [],
    });

    const response = await readLatestPath(new Request('http://localhost/api/learning-paths/latest?goal=control-correction'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.path.id).toBe('completed-path');
    expect(mocks.prisma.learningPath.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ pathStatus: 'active' }),
    }));
    expect(mocks.prisma.learningPath.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ pathStatus: 'fallback' }),
    }));
    expect(mocks.prisma.learningPath.findFirst).toHaveBeenNthCalledWith(3, expect.objectContaining({
      where: expect.objectContaining({ pathStatus: 'completed' }),
    }));
  });

  it('prevents a student from reading another learner latest path', async () => {
    const response = await readLatestPath(
      new Request('http://localhost/api/learning-paths/latest?goal=control-correction&userId=student-2'),
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.learningPath.findFirst).not.toHaveBeenCalled();
  });

  it('allows a teacher to read the latest path only after class ownership is proven', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await readLatestPath(
      new Request('http://localhost/api/learning-paths/latest?goal=control-correction&userId=student-1'),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      select: { userId: true, classId: true },
    });
    expect(mocks.prisma.class.findUnique).toHaveBeenCalledWith({
      where: { id: 'class-1' },
      select: { id: true, teacherId: true },
    });
    expect(mocks.prisma.learningPath.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        goalId: 'control-correction',
        classId: 'class-1',
      }),
    }));
  });

  it('rejects teacher latest path reads outside the authorized class before querying paths', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-2', role: 'TEACHER' } });

    const response = await readLatestPath(
      new Request('http://localhost/api/learning-paths/latest?goal=control-correction&userId=student-1'),
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.learningPath.findFirst).not.toHaveBeenCalled();
  });

  it('rejects unknown learning goals during plan creation', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      plan: {
        id: 'path-unknown',
        goal: { id: 'unknown-goal', title: '未知目标', knowledgeTargets: ['kn-x'] },
        userId: 'student-1',
      },
      classId: 'class-1',
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('未注册');
    expect(mocks.persistLearningPathRound).not.toHaveBeenCalled();
    expect(mocks.persistControlCorrectionPathRound).not.toHaveBeenCalled();
  });

  it('rejects a client supplied path id that already belongs to another owner', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-2',
      classId: 'class-2',
      goalId: 'control-correction',
      pathStatus: 'active',
      nodeIds: ['node-1'],
      pathPayload: { mainPathNodeIds: ['node-1'] },
    });

    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      plan: { id: 'path-1', goal: { id: 'control-correction' }, userId: 'student-1' },
      classId: 'class-1',
    }));

    expect(response.status).toBe(409);
    expect(mocks.persistControlCorrectionPathRound).not.toHaveBeenCalled();
  });

  it('prevents a student from forging class scope during plan creation', async () => {
    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      plan: { id: 'path-1', goal: { id: 'control-correction' }, userId: 'student-1' },
      classId: 'class-2',
    }));

    expect(response.status).toBe(403);
    expect(mocks.persistControlCorrectionPathRound).not.toHaveBeenCalled();
  });

  it('rejects teacher plan creation outside the authorized class scope', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-2', role: 'TEACHER' } });

    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      plan: { id: 'path-1', goal: { id: 'control-correction' }, userId: 'student-1' },
      classId: 'class-1',
    }));

    expect(response.status).toBe(403);
    expect(mocks.persistControlCorrectionPathRound).not.toHaveBeenCalled();
  });

  it('rejects teacher plan creation for a student outside the class scope', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({ userId: 'student-2', classId: 'class-2' });

    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      plan: { id: 'path-1', goal: { id: 'control-correction' }, userId: 'student-2' },
      classId: 'class-1',
    }));

    expect(response.status).toBe(403);
    expect(mocks.persistControlCorrectionPathRound).not.toHaveBeenCalled();
  });

  it('allows the owner to read a path round with append-only children', async () => {
    const response = await readPath(new Request('http://localhost/api/learning-paths/path-1'), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.readControlCorrectionPathRound).toHaveBeenCalledWith(expect.anything(), {
      pathId: 'path-1',
      userId: 'student-1',
    });
    expect(payload.path.executions[0]).toMatchObject({ id: 'exec-1', nodeId: 'node-1' });
    expect(payload.path.executions[0]).not.toHaveProperty('evidenceRefs');
    expect(payload.path.executions[0]).not.toHaveProperty('liftMetadata');
    expect(payload.path.deviations[0]).not.toHaveProperty('context');
    expect(payload.path.interventions[0]).toMatchObject({ privacySafeSummary: '建议回看根轨迹规则。' });
    expect(payload.path.interventions[0]).not.toHaveProperty('suggestedAction');
    expect(payload.path.interventions[0]).not.toHaveProperty('citedEvidence');
  });

  it('allows an authorized teacher to read and intervene on a class-scoped path', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const readResponse = await readPath(new Request('http://localhost/api/learning-paths/path-1'), params);
    const interventionResponse = await intervenePath(post('http://localhost/api/learning-paths/path-1/interventions', {
      interventionKind: 'hint',
      suggestedAction: 'review-root-locus',
      privacySafeSummary: '建议回看根轨迹规则。',
      idempotencyKey: 'int-key',
    }), params);

    expect(readResponse.status).toBe(200);
    expect(interventionResponse.status).toBe(200);
    expect(mocks.prisma.class.findUnique).toHaveBeenCalledWith({
      where: { id: 'class-1' },
      select: { id: true, teacherId: true },
    });
    expect(mocks.recordPathIntervention).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'student-1',
      idempotencyKey: 'int-key',
    }));
  });

  it('rejects malformed intervention writes before persistence', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await intervenePath(post('http://localhost/api/learning-paths/path-1/interventions', {
      interventionKind: 'random-kind',
      studentOutcome: 'maybe',
      suggestedAction: '',
      privacySafeSummary: '',
      idempotencyKey: 'int-key',
    }), params);

    expect(response.status).toBe(400);
    expect(mocks.recordPathIntervention).not.toHaveBeenCalled();
  });

  it.each(['ignored', 'rejected', 'partially-accepted'] as const)(
    'accepts intervention outcome %s used by path evidence counters',
    async (studentOutcome) => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await intervenePath(post('http://localhost/api/learning-paths/path-1/interventions', {
      interventionKind: 'hint',
      studentOutcome,
      suggestedAction: 'review-root-locus',
      privacySafeSummary: `学生反馈路径干预结果：${studentOutcome}。`,
      idempotencyKey: `int-${studentOutcome}`,
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathIntervention).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      studentOutcome,
      idempotencyKey: `int-${studentOutcome}`,
    }));
    },
  );

  it('rejects a teacher outside the class scope', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-2', role: 'TEACHER' } });

    const response = await readPath(new Request('http://localhost/api/learning-paths/path-1'), params);

    expect(response.status).toBe(403);
    expect(mocks.readControlCorrectionPathRound).not.toHaveBeenCalled();
  });

  it('records execution and deviation writes for the student owner with idempotency keys', async () => {
    const executionResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'exec-key',
    }), params);
    const deviationResponse = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'skip',
      priorNodeId: 'node-1',
      targetNodeId: 'node-1',
      idempotencyKey: 'dev-key',
    }), params);

    expect(executionResponse.status).toBe(200);
    expect(deviationResponse.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: 'exec-key',
    }));
    expect(mocks.prisma.learningPath.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        currentNodeId: true,
        terminalValidation: true,
        lastExecutionMetadata: true,
      }),
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        currentNodeId: 'node-1',
        pathStatus: 'fallback',
        terminalValidation: expect.objectContaining({
          state: 'low-confidence',
          lowConfidenceMarkers: expect.arrayContaining([
            'arena-terminal-evidence-missing',
            'simulation-evidence-missing',
          ]),
        }),
      }),
    }));
    expect(mocks.recordPathDeviation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: 'dev-key',
      context: {
        consequence: '跳过后该资源不会计入完成进度，但会记录为路径偏离，可稍后返回。',
        returnEligible: true,
      },
    }));
    expect(mocks.refreshStudentEvidenceFeatureCache).toHaveBeenCalledTimes(2);
    expect(mocks.refreshStudentEvidenceFeatureCache).toHaveBeenCalledWith(expect.anything(), 'student-1');
    expect(await executionResponse.json()).toMatchObject({
      execution: {
        id: 'exec-1',
        nodeId: 'node-1',
        status: 'completed',
      },
      cacheRefresh: 'completed',
    });
    expect(await deviationResponse.json()).toMatchObject({
      deviation: {
        id: 'dev-1',
        deviationType: 'skip',
      },
      cacheRefresh: 'completed',
    });
  });

  it('accepts a governed replacement deviation for the student owner', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue(journeyPathRecord());
    const response = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'replacement',
      priorNodeId: 'node-1',
      targetNodeId: 'node-2',
      idempotencyKey: 'replacement-dev-key',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathDeviation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      deviationType: 'replacement',
      priorNodeId: 'node-1',
      targetNodeId: 'node-2',
      idempotencyKey: 'replacement-dev-key',
    }));
  });

  it('keeps a sanitized simple resource completion result for governed path advancement', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValueOnce({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'registry:lesson09-correction-precheck',
      nodeIds: ['registry:lesson09-correction-precheck', 'simulation:control-correction-step-response-lab'],
      pathPayload: {
        mainPathNodeIds: ['registry:lesson09-correction-precheck', 'simulation:control-correction-step-response-lab'],
        planNodes: [
          {
            nodeId: 'registry:lesson09-correction-precheck',
            type: 'quiz',
            target: '/interactive-learning/resources/lesson09-correction-precheck',
          },
          {
            nodeId: 'simulation:control-correction-step-response-lab',
            type: 'simulation',
            target: '/simulations/control-correction-step-response-lab',
          },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'registry:lesson09-correction-precheck',
      resourceType: 'quiz',
      status: 'completed',
      completedAt: '2026-06-18T11:50:05.777Z',
      idempotencyKey: 'path-resource-completion:path-1:registry:lesson09-correction-precheck:quiz',
      liftMetadata: {
        pathActivityKind: 'initial-completion',
        completionSource: 'interactive-resource',
        completionResult: {
          success: true,
          score: 100,
          data: { correct: 5, total: 5, rawAnswer: 'discard-me' },
          privateTrace: 'discard-me',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      liftMetadata: {
        pathActivityKind: 'initial-completion',
        completionResult: {
          success: true,
          score: 100,
          data: { correct: 5, total: 5 },
        },
      },
    }));
  });

  it('does not unlock simulation outcome gates from forged client evidence refs', async () => {
    useStructuredSimulationPath();
    mocks.prisma.simulationRun.findFirst.mockResolvedValue(null);

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'simulation:control-correction-step-response-lab',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'forged-simulation-outcome',
      evidenceRefs: ['simulation_run:control-correction-step-response-lab'],
      simulationRef: { id: 'sim-run-forged' },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      simulationRef: expect.objectContaining({
        id: 'sim-run-forged',
        provenance: 'unknown',
        official: false,
        status: 'unverified',
      }),
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'simulation:control-correction-step-response-lab',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('does not unlock simulation outcome gates from forged structured evidence refs', async () => {
    useStructuredSimulationPath();
    mocks.prisma.simulationRun.findFirst.mockResolvedValue(null);

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'simulation:control-correction-step-response-lab',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'forged-structured-simulation-outcome',
      evidenceRefs: [{
        kind: 'SimulationRun',
        id: 'sim-run-forged',
        provenance: 'official',
        status: 'completed',
      }],
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      simulationRef: null,
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'simulation:control-correction-step-response-lab',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('normalizes adaptive assessment refs through server-owned answers before unlocking outcome gates', async () => {
    useStructuredAdaptiveAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue(reviewedAdaptiveAssessmentAnswer({
      id: 'answer-1',
      questionId: 'preset-q-01',
      purpose: 'readiness-gate',
      nodeId: 'adaptive-quiz:control-target-check',
      questionScope: 'readiness',
      catalogStage: 'readiness',
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      idempotencyKey: 'server-owned-adaptive-outcome',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-1',
          rawClientField: 'discarded',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-1',
          provenance: 'official',
          score: 100,
        }),
      }),
      evidenceRefs: [{ kind: 'AdaptiveAssessmentAnswer', id: 'answer-1' }],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'control-workbench:lead-design',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: expect.arrayContaining(['adaptive_assessment:answer-1']),
        }),
      }),
    }));
  });

  it('preserves legacy readiness answers that predate catalog snapshots and question scopes', async () => {
    useStructuredAdaptiveAssessmentPath('adaptive_assessment:answer-legacy-readiness');
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue(reviewedAdaptiveAssessmentAnswer({
      id: 'answer-legacy-readiness',
      questionId: 'preset-q-01',
      purpose: 'readiness-gate',
      nodeId: 'adaptive-quiz:control-target-check',
      includeCatalogRef: false,
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'legacy-readiness-adaptive-outcome',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-legacy-readiness',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-legacy-readiness',
          provenance: 'official',
          readinessGateEligible: true,
          pathCompletionEligible: true,
        }),
      }),
      evidenceRefs: [{ kind: 'AdaptiveAssessmentAnswer', id: 'answer-legacy-readiness' }],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'control-workbench:lead-design',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: expect.arrayContaining(['adaptive_assessment:answer-legacy-readiness']),
        }),
      }),
    }));
  });

  it.each([
    ['post-cutoff answeredAt', new Date('2026-07-03T23:59:59.999Z'), new Date('2026-07-04T00:00:00.001Z')],
    ['exact-cutoff createdAt', new Date('2026-07-04T00:00:00.000Z'), new Date('2026-07-03T23:59:59.999Z')],
    ['exact-cutoff answeredAt', new Date('2026-07-03T23:59:59.999Z'), new Date('2026-07-04T00:00:00.000Z')],
    ['invalid createdAt', new Date('invalid'), new Date('2026-07-03T23:59:59.999Z')],
    ['invalid answeredAt', new Date('2026-07-03T23:59:59.999Z'), new Date('invalid')],
  ])('rejects legacy readiness recovery with %s', async (_label, createdAt, answeredAt) => {
    useStructuredAdaptiveAssessmentPath('adaptive_assessment:answer-legacy-readiness');
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue(reviewedAdaptiveAssessmentAnswer({
      id: 'answer-legacy-readiness',
      questionId: 'preset-q-01',
      purpose: 'readiness-gate',
      nodeId: 'adaptive-quiz:control-target-check',
      includeCatalogRef: false,
      createdAt,
      answeredAt,
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      idempotencyKey: `legacy-readiness-${_label}`,
      liftMetadata: {
        adaptiveAssessmentRef: { id: 'answer-legacy-readiness' },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      completedAt: null,
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-readiness-not-eligible',
        }),
      }),
      evidenceRefs: [],
    }));
  });

  it('does not complete readiness answers without a readiness path question scope', async () => {
    useStructuredAdaptiveAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue(reviewedAdaptiveAssessmentAnswer({
      id: 'answer-1',
      questionId: 'preset-q-01',
      purpose: 'readiness-gate',
      nodeId: 'adaptive-quiz:control-target-check',
      questionScope: 'remediation',
      catalogStage: 'readiness',
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'readiness-adaptive-outcome-wrong-scope',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-1',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      completedAt: null,
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-1',
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-readiness-not-eligible',
        }),
      }),
      evidenceRefs: [],
    }));
  });

  it('keeps adaptive outcome gates locked when readiness evidence belongs to another learning goal', async () => {
    useStructuredAdaptiveAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue({
      id: 'answer-other-goal',
      questionId: 'preset-q-02',
      score: 100,
      abilityEstimate: 0.62,
      answeredAt: new Date('2026-06-04T09:59:00.000Z'),
      questionRef: {
        knowledgeTags: ['frequency-response:bode-basics'],
        questionType: 'bode-to-stability',
        difficulty: 0.58,
        metadata: {
          kaq: {
            immutableContentHash: 'reviewed-other-goal-hash-1',
            learningGoalIds: ['frequency-response-foundations'],
            purpose: 'readiness-gate',
            outcomeRefs: ['quiz-outcome:frequency-response-foundations:readiness-gate:preset-q-02'],
            review: { state: 'reviewed' },
          },
        },
      },
      abilityEstimateSnapshot: {
        dimensions: {
          pathExecution: {
            pathId: 'path-1',
            nodeId: 'adaptive-quiz:control-target-check',
            goalId: 'control-correction',
          },
        },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      idempotencyKey: 'other-goal-adaptive-outcome',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-other-goal',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-other-goal',
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-goal-mismatch',
        }),
      }),
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'adaptive-quiz:control-target-check',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('keeps adaptive outcome gates locked when the answer ref is missing from server ownership', async () => {
    useStructuredAdaptiveAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue(null);

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      idempotencyKey: 'forged-adaptive-outcome',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-1',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-1',
          provenance: 'unknown',
        }),
      }),
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'adaptive-quiz:control-target-check',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('does not complete adaptive quiz nodes when no answer ref is provided', async () => {
    useStructuredAdaptiveAssessmentPath();

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'missing-adaptive-answer-ref',
      liftMetadata: {},
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.prisma.adaptiveAssessmentAnswer.findFirst).not.toHaveBeenCalled();
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      completedAt: null,
      failedAt: null,
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          provenance: 'pending',
        }),
      }),
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'adaptive-quiz:control-target-check',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('does not complete checkpoint assessment nodes when no answer ref is provided', async () => {
    useStructuredCheckpointAssessmentPath();

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'checkpoint:control-correction-review',
      resourceType: 'checkpoint',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'missing-checkpoint-answer-ref',
      liftMetadata: { pathActivityKind: 'checkpoint-pass' },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.prisma.adaptiveAssessmentAnswer.findFirst).not.toHaveBeenCalled();
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      completedAt: null,
      failedAt: null,
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          provenance: 'pending',
        }),
      }),
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'checkpoint:control-correction-review',
        lastExecutionMetadata: expect.objectContaining({
          completedNodeIds: [],
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('does not complete checkpoint assessment nodes when the reviewed readiness answer failed', async () => {
    useStructuredCheckpointAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue({
      id: 'answer-1',
      questionId: 'preset-q-01',
      isCorrect: false,
      score: 0,
      abilityEstimate: 0.34,
      answeredAt: new Date('2026-06-04T09:59:00.000Z'),
      questionRef: {
        knowledgeTags: ['controller-tuning'],
        questionType: 'multi-criteria',
        difficulty: 0.7,
        metadata: {
          kaq: {
            immutableContentHash: 'reviewed-hash-1',
            learningGoalIds: ['control-correction'],
            purpose: 'readiness-gate',
            outcomeRefs: ['quiz-outcome:control-correction:readiness-gate:preset-q-01'],
            review: { state: 'reviewed' },
          },
        },
      },
      abilityEstimateSnapshot: {
        dimensions: {
          pathExecution: {
            pathId: 'path-1',
            nodeId: 'checkpoint:control-correction-review',
            goalId: 'control-correction',
          },
        },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'checkpoint:control-correction-review',
      resourceType: 'checkpoint',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'failed-checkpoint-answer-ref',
      liftMetadata: {
        pathActivityKind: 'checkpoint-pass',
        adaptiveAssessmentRef: { id: 'answer-1' },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      completedAt: null,
      failedAt: null,
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-1',
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-readiness-not-eligible',
        }),
      }),
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'checkpoint:control-correction-review',
        lastExecutionMetadata: expect.objectContaining({
          completedNodeIds: [],
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('completes checkpoint assessment nodes with reviewed checkpoint answers', async () => {
    useStructuredCheckpointAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue({
      id: 'answer-1',
      questionId: 'preset-q-04',
      isCorrect: true,
      score: 100,
      abilityEstimate: 0.74,
      answeredAt: new Date('2026-06-04T09:59:00.000Z'),
      questionRef: {
        knowledgeTags: ['controller-tuning'],
        questionType: 'multi-criteria',
        difficulty: 0.7,
        metadata: {
          kaq: {
            immutableContentHash: 'reviewed-checkpoint-hash-1',
            learningGoalIds: ['control-correction'],
            purpose: 'checkpoint',
            outcomeRefs: ['quiz-outcome:control-correction:checkpoint:preset-q-04'],
            review: { state: 'reviewed' },
          },
          adaptiveAssessmentItemRef: assessmentCatalogSnapshot(
            'preset-q-04',
            'control-correction',
            'checkpoint',
          ),
        },
      },
      abilityEstimateSnapshot: {
        dimensions: {
          pathExecution: {
            pathId: 'path-1',
            nodeId: 'checkpoint:control-correction-review',
            goalId: 'control-correction',
            questionScope: 'checkpoint',
          },
        },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'checkpoint:control-correction-review',
      resourceType: 'checkpoint',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'checkpoint-answer-ref',
      liftMetadata: {
        pathActivityKind: 'checkpoint-pass',
        adaptiveAssessmentRef: { id: 'answer-1' },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-1',
          provenance: 'official',
          readinessGateEligible: false,
          pathCompletionEligible: true,
          terminalValidationEligible: false,
          isCorrect: true,
          score: 100,
        }),
      }),
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'control-workbench:lead-design',
        lastExecutionMetadata: expect.objectContaining({
          completedNodeIds: ['checkpoint:control-correction-review'],
          availableOutcomeRefs: expect.arrayContaining(['adaptive_assessment:answer-1']),
        }),
      }),
    }));
  });

  it('preserves legacy checkpoint answers that predate catalog snapshots and question scopes', async () => {
    useStructuredCheckpointAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue(reviewedAdaptiveAssessmentAnswer({
      id: 'answer-legacy-checkpoint',
      questionId: 'preset-q-04',
      purpose: 'checkpoint',
      nodeId: 'checkpoint:control-correction-review',
      includeCatalogRef: false,
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'checkpoint:control-correction-review',
      resourceType: 'checkpoint',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'legacy-checkpoint-answer-ref',
      liftMetadata: {
        pathActivityKind: 'checkpoint-pass',
        adaptiveAssessmentRef: { id: 'answer-legacy-checkpoint' },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-legacy-checkpoint',
          provenance: 'official',
          readinessGateEligible: false,
          pathCompletionEligible: true,
          terminalValidationEligible: false,
        }),
      }),
      evidenceRefs: [{ kind: 'AdaptiveAssessmentAnswer', id: 'answer-legacy-checkpoint' }],
    }));
  });

  it('does not let new unsupported checkpoint answers bypass the catalog snapshot contract', async () => {
    useStructuredCheckpointAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue({
      ...reviewedAdaptiveAssessmentAnswer({
        id: 'answer-new-legacy-checkpoint',
        questionId: 'preset-q-04',
        purpose: 'checkpoint',
        nodeId: 'checkpoint:control-correction-review',
        includeCatalogRef: false,
      }),
      answeredAt: new Date('2026-07-05T09:59:00.000Z'),
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'checkpoint:control-correction-review',
      resourceType: 'checkpoint',
      status: 'completed',
      completedAt: '2026-07-05T10:00:00.000Z',
      idempotencyKey: 'new-legacy-checkpoint-answer-ref',
      liftMetadata: {
        pathActivityKind: 'checkpoint-pass',
        adaptiveAssessmentRef: { id: 'answer-new-legacy-checkpoint' },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      completedAt: null,
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-readiness-not-eligible',
        }),
      }),
      evidenceRefs: [],
    }));
  });

  it('rejects legacy checkpoint answers created after the cutoff even when answeredAt predates it', async () => {
    useStructuredCheckpointAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue({
      ...reviewedAdaptiveAssessmentAnswer({
        id: 'answer-created-after-cutoff',
        questionId: 'preset-q-04',
        purpose: 'checkpoint',
        nodeId: 'checkpoint:control-correction-review',
        includeCatalogRef: false,
      }),
      createdAt: new Date('2026-07-05T09:58:00.000Z'),
      answeredAt: new Date('2026-07-03T09:59:00.000Z'),
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'checkpoint:control-correction-review',
      resourceType: 'checkpoint',
      status: 'completed',
      completedAt: '2026-07-05T10:00:00.000Z',
      idempotencyKey: 'created-after-cutoff-checkpoint-answer-ref',
      liftMetadata: {
        pathActivityKind: 'checkpoint-pass',
        adaptiveAssessmentRef: { id: 'answer-created-after-cutoff' },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      completedAt: null,
      evidenceRefs: [],
    }));
  });

  it('does not complete checkpoint assessment nodes with readiness-gate answers', async () => {
    useStructuredCheckpointAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue({
      id: 'answer-1',
      questionId: 'preset-q-01',
      isCorrect: true,
      score: 100,
      abilityEstimate: 0.74,
      answeredAt: new Date('2026-06-04T09:59:00.000Z'),
      questionRef: {
        knowledgeTags: ['controller-tuning'],
        questionType: 'multi-criteria',
        difficulty: 0.7,
        metadata: {
          kaq: {
            immutableContentHash: 'reviewed-readiness-hash-1',
            learningGoalIds: ['control-correction'],
            purpose: 'readiness-gate',
            outcomeRefs: ['quiz-outcome:control-correction:readiness-gate:preset-q-01'],
            review: { state: 'reviewed' },
          },
        },
      },
      abilityEstimateSnapshot: {
        dimensions: {
          pathExecution: {
            pathId: 'path-1',
            nodeId: 'checkpoint:control-correction-review',
            goalId: 'control-correction',
          },
        },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'checkpoint:control-correction-review',
      resourceType: 'checkpoint',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'checkpoint-readiness-answer-ref',
      liftMetadata: {
        pathActivityKind: 'checkpoint-pass',
        adaptiveAssessmentRef: { id: 'answer-1' },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      completedAt: null,
      failedAt: null,
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-1',
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-readiness-not-eligible',
        }),
      }),
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'checkpoint:control-correction-review',
        lastExecutionMetadata: expect.objectContaining({
          completedNodeIds: [],
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('keeps adaptive outcome gates locked when the answer is provisional K/A/Q evidence', async () => {
    useStructuredAdaptiveAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue({
      id: 'answer-generated',
      questionId: 'generated-q-01',
      score: 100,
      abilityEstimate: 0.62,
      answeredAt: new Date('2026-06-04T09:59:00.000Z'),
      questionRef: {
        knowledgeTags: ['controller-tuning'],
        questionType: 'multi-criteria',
        difficulty: 0.7,
        metadata: {
          kaq: {
            immutableContentHash: 'generated-hash-1',
            learningGoalIds: ['control-correction'],
            purpose: 'practice',
            outcomeRefs: ['quiz-outcome:control-correction:practice:generated-q-01'],
            review: { state: 'provisional' },
          },
        },
      },
      abilityEstimateSnapshot: {
        dimensions: {
          pathExecution: {
            pathId: 'path-1',
            nodeId: 'adaptive-quiz:control-target-check',
            goalId: 'control-correction',
          },
        },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      idempotencyKey: 'provisional-adaptive-outcome',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-generated',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-generated',
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-readiness-not-eligible',
        }),
      }),
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'adaptive-quiz:control-target-check',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('keeps adaptive outcome gates locked when reviewed K/A/Q evidence is not readiness-gate purpose', async () => {
    useStructuredAdaptiveAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue({
      id: 'answer-practice',
      questionId: 'preset-q-03',
      score: 100,
      abilityEstimate: 0.62,
      answeredAt: new Date('2026-06-04T09:59:00.000Z'),
      questionRef: {
        knowledgeTags: ['controller-tuning'],
        questionType: 'multi-criteria',
        difficulty: 0.7,
        metadata: {
          kaq: {
            immutableContentHash: 'reviewed-practice-hash-1',
            learningGoalIds: ['control-correction'],
            purpose: 'practice',
            outcomeRefs: ['quiz-outcome:control-correction:practice:preset-q-03'],
            review: { state: 'reviewed' },
          },
        },
      },
      abilityEstimateSnapshot: {
        dimensions: {
          pathExecution: {
            pathId: 'path-1',
            nodeId: 'adaptive-quiz:control-target-check',
            goalId: 'control-correction',
          },
        },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      idempotencyKey: 'practice-adaptive-outcome',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-practice',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-practice',
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-readiness-not-eligible',
        }),
      }),
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'adaptive-quiz:control-target-check',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('completes adaptive quiz nodes with reviewed remediation answers', async () => {
    useStructuredAdaptiveAssessmentPath('adaptive_assessment:answer-remediation');
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue(reviewedAdaptiveAssessmentAnswer({
      id: 'answer-remediation',
      questionId: 'checkpoint-authored-remediation-01',
      purpose: 'practice',
      nodeId: 'adaptive-quiz:control-target-check',
      questionScope: 'remediation',
      catalogStage: 'remediation',
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'remediation-adaptive-outcome',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-remediation',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-remediation',
          provenance: 'official',
          readinessGateEligible: false,
          pathCompletionEligible: true,
          terminalValidationEligible: false,
          isCorrect: true,
          score: 100,
        }),
      }),
      evidenceRefs: [{ kind: 'AdaptiveAssessmentAnswer', id: 'answer-remediation' }],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'control-workbench:lead-design',
        lastExecutionMetadata: expect.objectContaining({
          completedNodeIds: ['adaptive-quiz:control-target-check'],
          availableOutcomeRefs: expect.arrayContaining(['adaptive_assessment:answer-remediation']),
        }),
      }),
    }));
  });

  it('completes adaptive quiz nodes with reviewed terminal-validation answers without treating them as typed evidence', async () => {
    useStructuredAdaptiveAssessmentPath('adaptive_assessment:answer-terminal-validation');
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue(reviewedAdaptiveAssessmentAnswer({
      id: 'answer-terminal-validation',
      questionId: 'frequency-response-foundations-terminal-validation-01',
      purpose: 'terminal-validation',
      nodeId: 'adaptive-quiz:control-target-check',
      questionScope: 'terminal-validation',
      catalogStage: 'terminal-validation',
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'terminal-validation-adaptive-outcome',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-terminal-validation',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-terminal-validation',
          provenance: 'official',
          readinessGateEligible: false,
          pathCompletionEligible: true,
          terminalValidationEligible: false,
          isCorrect: true,
          score: 100,
        }),
      }),
      evidenceRefs: [{ kind: 'AdaptiveAssessmentAnswer', id: 'answer-terminal-validation' }],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'control-workbench:lead-design',
        lastExecutionMetadata: expect.objectContaining({
          completedNodeIds: ['adaptive-quiz:control-target-check'],
          availableOutcomeRefs: expect.arrayContaining(['adaptive_assessment:answer-terminal-validation']),
        }),
      }),
    }));
  });

  it('does not complete terminal-validation answers without catalog-backed path eligibility', async () => {
    useStructuredAdaptiveAssessmentPath('adaptive_assessment:answer-terminal-validation');
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue(reviewedAdaptiveAssessmentAnswer({
      id: 'answer-terminal-validation',
      questionId: 'frequency-response-foundations-terminal-validation-01',
      purpose: 'terminal-validation',
      nodeId: 'adaptive-quiz:control-target-check',
      questionScope: 'terminal-validation',
      catalogStage: 'terminal-validation',
      includeCatalogRef: false,
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'terminal-validation-adaptive-outcome-missing-catalog',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-terminal-validation',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      completedAt: null,
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-terminal-validation',
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-readiness-not-eligible',
        }),
      }),
      evidenceRefs: [],
    }));
  });

  it('does not complete remediation answers without catalog-backed path eligibility', async () => {
    useStructuredAdaptiveAssessmentPath('adaptive_assessment:answer-remediation');
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue(reviewedAdaptiveAssessmentAnswer({
      id: 'answer-remediation',
      questionId: 'checkpoint-authored-remediation-01',
      purpose: 'remediation',
      nodeId: 'adaptive-quiz:control-target-check',
      questionScope: 'remediation',
      catalogStage: 'remediation',
      includeCatalogRef: false,
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'remediation-adaptive-outcome-missing-catalog',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-remediation',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      completedAt: null,
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-remediation',
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-readiness-not-eligible',
        }),
      }),
      evidenceRefs: [],
    }));
  });

  it('does not complete remediation answers without a remediation path question scope', async () => {
    useStructuredAdaptiveAssessmentPath('adaptive_assessment:answer-remediation');
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue(reviewedAdaptiveAssessmentAnswer({
      id: 'answer-remediation',
      questionId: 'checkpoint-authored-remediation-01',
      purpose: 'remediation',
      nodeId: 'adaptive-quiz:control-target-check',
      questionScope: 'readiness',
      catalogStage: 'remediation',
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      completedAt: '2026-06-04T10:00:00.000Z',
      idempotencyKey: 'remediation-adaptive-outcome-wrong-scope',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-remediation',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'started',
      completedAt: null,
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-remediation',
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-readiness-not-eligible',
        }),
      }),
      evidenceRefs: [],
    }));
  });

  it('keeps adaptive outcome gates locked when the answer belongs to another path node', async () => {
    useStructuredAdaptiveAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue({
      id: 'answer-1',
      questionId: 'preset-q-01',
      score: 100,
      abilityEstimate: 0.62,
      answeredAt: new Date('2026-06-04T09:59:00.000Z'),
      questionRef: {
        knowledgeTags: ['control-correction:time-domain-targets'],
        questionType: 'pole-to-behavior',
        difficulty: 0.58,
        metadata: {
          kaq: {
            immutableContentHash: 'reviewed-hash-1',
            learningGoalIds: ['control-correction'],
            purpose: 'readiness-gate',
            outcomeRefs: ['quiz-outcome:control-correction:readiness-gate:preset-q-01'],
            review: { state: 'reviewed' },
          },
        },
      },
      abilityEstimateSnapshot: {
        dimensions: {
          pathExecution: {
            pathId: 'path-1',
            nodeId: 'adaptive-quiz:other-node',
            goalId: 'control-correction',
          },
        },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      idempotencyKey: 'wrong-node-adaptive-outcome',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-1',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-1',
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-path-mismatch',
        }),
      }),
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'adaptive-quiz:control-target-check',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('keeps adaptive outcome gates locked when the answer path context omits the path goal', async () => {
    useStructuredAdaptiveAssessmentPath();
    mocks.prisma.adaptiveAssessmentAnswer.findFirst.mockResolvedValue({
      id: 'answer-1',
      questionId: 'preset-q-01',
      score: 100,
      abilityEstimate: 0.62,
      answeredAt: new Date('2026-06-04T09:59:00.000Z'),
      questionRef: {
        knowledgeTags: ['control-correction:time-domain-targets'],
        questionType: 'pole-to-behavior',
        difficulty: 0.58,
        metadata: {
          kaq: {
            immutableContentHash: 'reviewed-hash-1',
            learningGoalIds: ['control-correction'],
            purpose: 'readiness-gate',
            outcomeRefs: ['quiz-outcome:control-correction:readiness-gate:preset-q-01'],
            review: { state: 'reviewed' },
          },
        },
      },
      abilityEstimateSnapshot: {
        dimensions: {
          pathExecution: {
            pathId: 'path-1',
            nodeId: 'adaptive-quiz:control-target-check',
          },
        },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'adaptive-quiz:control-target-check',
      resourceType: 'adaptive_quiz',
      status: 'completed',
      idempotencyKey: 'missing-goal-adaptive-outcome',
      liftMetadata: {
        adaptiveAssessmentRef: {
          id: 'answer-1',
        },
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      liftMetadata: expect.objectContaining({
        adaptiveAssessmentRef: expect.objectContaining({
          kind: 'AdaptiveAssessmentAnswer',
          id: 'answer-1',
          provenance: 'unknown',
          mismatchReason: 'adaptive-assessment-path-mismatch',
        }),
      }),
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'adaptive-quiz:control-target-check',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('unlocks simulation outcome gates from server-owned simulation runs', async () => {
    useStructuredSimulationPath();
    mocks.prisma.simulationRun.findFirst.mockResolvedValue({
      id: 'sim-run-1',
      ownerUserId: 'student-1',
      runKind: 'course_validation',
      sourceDomain: 'control_workbench',
      sourceRefId: 'control-correction-step-response-lab',
      resourceId: 'control-correction-step-response-lab',
      taskSpecId: null,
      status: 'completed',
      summary: { replayConfidence: 0.84 },
      protocolVersion: '1.0',
      completedAt: new Date('2026-06-04T09:59:00.000Z'),
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'simulation:control-correction-step-response-lab',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'server-owned-simulation-outcome',
      evidenceRefs: ['simulation_run:control-correction-step-response-lab'],
      simulationRef: { id: 'sim-run-1' },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      simulationRef: expect.objectContaining({
        id: 'sim-run-1',
        sourceRefId: 'control-correction-step-response-lab',
        provenance: 'official',
        status: 'completed',
      }),
      evidenceRefs: [{ kind: 'SimulationRun', id: 'sim-run-1' }],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'arena-task:task-second-order-lead-pid',
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: expect.arrayContaining(['simulation_run:control-correction-step-response-lab']),
        }),
      }),
    }));
  });

  it('derives governed simulation outcome refs from instrumented lesson-step completion', async () => {
    configureSingleNodePath(
      'registry:lesson09-time-domain-synthesis',
      'lesson_step',
      '/interactive-learning/resources/lesson09-time-domain-synthesis',
      {
        goalId: 'control-correction',
        planNode: {
          knowledgeCoverage: ['control-correction:simulation-validation'],
        },
      }
    );

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'registry:lesson09-time-domain-synthesis',
      resourceType: 'lesson_step',
      status: 'completed',
      idempotencyKey: 'time-domain-synthesis-complete',
      liftMetadata: {
        pathActivityKind: 'initial-completion',
        completionSource: 'interactive-resource',
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      evidenceRefs: expect.arrayContaining([
        expect.objectContaining({
          kind: 'SimulationRun',
          ref: 'simulation_run:lesson09-time-domain-synthesis',
          provenance: 'official',
          status: 'completed',
        }),
      ]),
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: expect.arrayContaining(['simulation_run:lesson09-time-domain-synthesis']),
        }),
      }),
    }));
  });

  it('attaches governed knowledge-card event refs to path execution completion', async () => {
    configureSingleNodePath(
      'knowledge-card:feedback-loop',
      'knowledge_card',
      '/knowledge?node=feedback-loop',
      {
        goalId: 'control-correction',
        planNode: {
          knowledgeCoverage: ['feedback-loop'],
        },
      },
    );

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'knowledge-card:feedback-loop',
      resourceType: 'knowledge_card',
      status: 'completed',
      idempotencyKey: 'knowledge-card-feedback-complete',
      evidenceRefs: [{ kind: 'client', rawPayload: 'hidden answer text' }],
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      evidenceRefs: [{
        kind: 'ResourceEvent',
        eventType: 'knowledge_card_open',
        provenance: 'platform-instrumented',
        status: 'completed',
        ref: 'knowledge_card_open:knowledge-card:feedback-loop',
        sourceEventId: 'knowledge_card_open:knowledge-card:feedback-loop',
        nodeId: 'knowledge-card:feedback-loop',
        resourceType: 'knowledge_card',
        privacyLevel: 'student-visible',
      }],
    }));
  });

  it('accepts textbook section completion events for generated learning paths', async () => {
    configureSingleNodePath(
      'textbook-section:dorf-modern-control-systems:ch08-example-0801',
      'textbook_section',
      '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch08-example-0801.md',
      {
        goalId: 'frequency-response-foundations',
        planNode: {
          knowledgeCoverage: ['Bode图_1_1', '频域响应_1_1'],
        },
      },
    );

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'textbook-section:dorf-modern-control-systems:ch08-example-0801',
      resourceType: 'textbook_section',
      status: 'completed',
      idempotencyKey: 'textbook-section-complete',
      evidenceRefs: ['citation:textbook-section:dorf-modern-control-systems:ch08-example-0801#chunk-001'],
      liftMetadata: {
        pathActivityKind: 'continued-interaction',
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      nodeId: 'textbook-section:dorf-modern-control-systems:ch08-example-0801',
      resourceType: 'textbook_section',
      status: 'completed',
      evidenceRefs: ['citation:textbook-section:dorf-modern-control-systems:ch08-example-0801#chunk-001'],
      liftMetadata: expect.objectContaining({
        pathActivityKind: 'continued-interaction',
      }),
    }));
  });

  it('accepts slides completion events returned by platform resource surfaces', async () => {
    configureSingleNodePath(
      'registry:frequency-response-slides',
      'slides',
      '/course-runtime/media/frequency-response-slides.pdf',
    );

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'registry:frequency-response-slides',
      resourceType: 'slides',
      status: 'completed',
      idempotencyKey: 'frequency-response-slides-complete',
      liftMetadata: { pathActivityKind: 'initial-completion' },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      nodeId: 'registry:frequency-response-slides',
      resourceType: 'slides',
      status: 'completed',
    }));
  });

  it('does not derive simulation outcome refs from unrelated lesson-step completions', async () => {
    configureSingleNodePath(
      'registry:lesson09-time-domain-synthesis',
      'lesson_step',
      '/interactive-learning/resources/lesson09-time-domain-synthesis',
      {
        goalId: 'control-correction',
        planNode: {
          knowledgeCoverage: ['control-correction:time-domain-targets'],
        },
      }
    );

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'registry:lesson09-time-domain-synthesis',
      resourceType: 'lesson_step',
      status: 'completed',
      idempotencyKey: 'time-domain-synthesis-without-simulation-validation',
      liftMetadata: {
        pathActivityKind: 'initial-completion',
        completionSource: 'interactive-resource',
      },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      evidenceRefs: [],
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastExecutionMetadata: expect.objectContaining({
          availableOutcomeRefs: [],
        }),
      }),
    }));
  });

  it('rejects server-owned simulation runs from a different path simulation node', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'simulation:simulation-a',
      nodeIds: ['simulation:simulation-a', 'simulation:simulation-b', 'arena-task:task-second-order-lead-pid'],
      pathPayload: {
        mainPathNodeIds: ['simulation:simulation-a', 'simulation:simulation-b', 'arena-task:task-second-order-lead-pid'],
        planNodes: [
          {
            nodeId: 'simulation:simulation-a',
            type: 'simulation',
            target: 'simulation-a',
            sourceRef: 'simulation-a',
          },
          {
            nodeId: 'simulation:simulation-b',
            type: 'simulation',
            target: 'simulation-b',
            sourceRef: 'simulation-b',
          },
          {
            nodeId: 'arena-task:task-second-order-lead-pid',
            type: 'arena_task',
            target: '/arena/challenges/task-second-order-lead-pid',
          },
        ],
      },
      terminalValidation: {
        nodeId: 'arena-task:task-second-order-lead-pid',
        state: 'pending',
        target: '/arena/challenges/task-second-order-lead-pid',
      },
      lastExecutionMetadata: { completedNodeIds: [] },
    });
    mocks.prisma.simulationRun.findFirst.mockResolvedValue({
      id: 'sim-run-b',
      ownerUserId: 'student-1',
      runKind: 'course_validation',
      sourceDomain: 'control_workbench',
      sourceRefId: 'simulation-b',
      resourceId: 'simulation-b',
      taskSpecId: null,
      status: 'completed',
      summary: { replayConfidence: 0.84 },
      protocolVersion: '1.0',
      completedAt: new Date('2026-06-04T09:59:00.000Z'),
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'simulation:simulation-a',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'wrong-simulation-node-outcome',
      simulationRef: { id: 'sim-run-b' },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      simulationRef: expect.objectContaining({
        id: 'sim-run-b',
        provenance: 'unknown',
        official: false,
        mismatchReason: 'simulation-scope-mismatch',
      }),
      evidenceRefs: [],
    }));
  });

  it('records completed-node continue and return-to-skipped as governed path activity without opening arbitrary nodes', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [] },
    });
    mocks.recordPathNodeExecution.mockResolvedValueOnce({
      id: 'exec-continue',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      liftMetadata: { pathActivityKind: 'continued-interaction' },
    });

    const continueResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      idempotencyKey: 'continue-node-1',
      liftMetadata: { pathActivityKind: 'continued-interaction' },
    }), params);
    expect(continueResponse.status).toBe(200);
    expect(await continueResponse.json()).toMatchObject({
      execution: {
        id: 'exec-continue',
        nodeId: 'node-1',
        activityKind: 'continued-interaction',
      },
    });
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      nodeId: 'node-1',
      liftMetadata: { pathActivityKind: 'continued-interaction' },
    }));
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();

    const forgedContinueResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'forged-continue-node-1',
      liftMetadata: { pathActivityKind: 'continued-interaction' },
    }), params);
    expect(forgedContinueResponse.status).toBe(409);

    const rejectedResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'arbitrary-node-1',
    }), params);
    expect(rejectedResponse.status).toBe(409);

    const forgedReturnResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'forged-return-node-1',
      liftMetadata: { pathActivityKind: 'return-to-skipped' },
    }), params);
    expect(forgedReturnResponse.status).toBe(409);

    const missingSkipReturnResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      idempotencyKey: 'missing-skip-return-node-1',
      liftMetadata: { pathActivityKind: 'return-to-skipped' },
    }), params);
    expect(missingSkipReturnResponse.status).toBe(409);

    const blockedReturnResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      idempotencyKey: 'blocked-skip-return-node-1',
      liftMetadata: { pathActivityKind: 'return-to-skipped' },
    }), params);
    expect(blockedReturnResponse.status).toBe(409);

    const completedReturnResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      idempotencyKey: 'completed-skip-return-node-1',
      liftMetadata: { pathActivityKind: 'return-to-skipped' },
    }), params);
    expect(completedReturnResponse.status).toBe(409);

  });

  it('rejects reference activities for future external and Konling path nodes', async () => {
    const pathWithFutureReferenceNodes = {
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1', 'external-node', 'konling-node'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'external-node', 'konling-node'],
        planNodes: [
          { nodeId: 'node-1', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
          {
            nodeId: 'external-node',
            type: 'external_resource',
            target: 'https://example.edu/control',
            externalResource: {
              source: 'Example Open Course',
              url: 'https://example.edu/control',
              estimatedTimeMinutes: 15,
              knowledgeCoverage: ['control-correction'],
              applicableGoalId: 'control-correction',
              evidenceUseStatus: 'explicit-access-required',
              privacyPolicy: 'student-visible',
            },
          },
          { nodeId: 'konling-node', type: 'konling', target: '/assessment/adaptive-practice?goal=control-correction' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [], skippedNodeIds: [] },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValueOnce(pathWithFutureReferenceNodes);

    const futureExternalResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'external-node',
      resourceType: 'external_resource',
      status: 'started',
      idempotencyKey: 'future-external-reference',
      liftMetadata: { pathActivityKind: 'external-resource-reference' },
    }), params);
    expect(futureExternalResponse.status).toBe(409);

    mocks.prisma.learningPath.findUnique.mockResolvedValueOnce(pathWithFutureReferenceNodes);
    const futureKonlingResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'konling-node',
      resourceType: 'konling',
      status: 'started',
      idempotencyKey: 'future-konling-support',
      liftMetadata: { pathActivityKind: 'konling-support' },
    }), params);
    expect(futureKonlingResponse.status).toBe(409);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();

    mocks.prisma.learningPath.findUnique.mockResolvedValueOnce({
      ...pathWithFutureReferenceNodes,
      lastExecutionMetadata: {
        completedNodeIds: ['external-node'],
        failedNodeIds: [],
        skippedNodeIds: [],
      },
    });
    mocks.recordPathNodeExecution.mockResolvedValueOnce({
      id: 'exec-external-reference',
      nodeId: 'external-node',
      resourceType: 'external_resource',
      status: 'started',
      liftMetadata: { pathActivityKind: 'external-resource-reference' },
    });
    const reachedExternalResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'external-node',
      resourceType: 'external_resource',
      status: 'started',
      idempotencyKey: 'reached-external-reference',
      liftMetadata: { pathActivityKind: 'external-resource-reference' },
    }), params);
    expect(reachedExternalResponse.status).toBe(200);
  });

  it('returns to a skipped node only while it remains unfinished', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [] },
    });
    mocks.prisma.learningPathDeviation.findFirst.mockResolvedValueOnce({
      id: 'dev-skip-node-1',
      pathId: 'path-1',
      userId: 'student-1',
      deviationType: 'skip',
      targetNodeId: 'node-1',
      context: { returnEligible: false },
    });
    const blockedReturnResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      idempotencyKey: 'blocked-unfinished-skip-return-node-1',
      liftMetadata: { pathActivityKind: 'return-to-skipped' },
    }), params);
    expect(blockedReturnResponse.status).toBe(409);

    mocks.recordPathNodeExecution.mockResolvedValueOnce({
      id: 'exec-return',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      liftMetadata: { pathActivityKind: 'return-to-skipped' },
    });
    mocks.prisma.learningPathDeviation.findFirst.mockResolvedValueOnce({
      id: 'dev-skip-node-1',
      pathId: 'path-1',
      userId: 'student-1',
      deviationType: 'skip',
      targetNodeId: 'node-1',
      context: { returnEligible: true },
    });
    const returnResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      idempotencyKey: 'return-node-1',
      liftMetadata: { pathActivityKind: 'return-to-skipped' },
    }), params);
    expect(returnResponse.status).toBe(200);
    expect(await returnResponse.json()).toMatchObject({
      execution: {
        id: 'exec-return',
        activityKind: 'return-to-skipped',
      },
    });
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'node-1',
      }),
    }));
  });

  it('rejects skip deviations for completed historical nodes and rebuilds skip context server-side', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2', 'node-3'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
          { nodeId: 'node-3', type: 'checkpoint', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [] },
    });

    const forgedHistoryResponse = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'skip',
      priorNodeId: 'node-2',
      targetNodeId: 'node-1',
      idempotencyKey: 'skip-node-1',
      context: { returnEligible: true, rawClientClaim: 'forged' },
    }), params);
    expect(forgedHistoryResponse.status).toBe(409);
    expect(mocks.recordPathDeviation).not.toHaveBeenCalled();

    const futureSkipResponse = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'skip',
      priorNodeId: 'node-2',
      targetNodeId: 'node-3',
      idempotencyKey: 'skip-node-3',
      context: { returnEligible: false, rawClientClaim: 'ignored' },
    }), params);

    expect(futureSkipResponse.status).toBe(409);
    expect(await futureSkipResponse.json()).toMatchObject({ error: '只能跳过当前路径节点' });
    expect(mocks.recordPathDeviation).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('advances the server current node after skipping the current node', async () => {
    const skipPath = {
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2', 'node-3'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
          { nodeId: 'node-3', type: 'checkpoint', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], skippedNodeIds: [] },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue(skipPath);
    mocks.prisma.learningPath.findFirst.mockResolvedValue(skipPath);
    mocks.recordPathDeviation.mockResolvedValueOnce({
      id: 'dev-2',
      deviationType: 'skip',
      targetNodeId: 'node-2',
      context: { ignored: true },
    });

    const response = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'skip',
      priorNodeId: 'node-2',
      targetNodeId: 'node-2',
      idempotencyKey: 'skip-current-node-2',
      context: { returnEligible: false, rawClientClaim: 'ignored' },
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.pathUpdate).toEqual({ currentNodeId: 'node-3' });
    expect(mocks.recordPathDeviation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      targetNodeId: 'node-2',
      context: {
        consequence: '跳过后该资源不会计入完成进度，但会记录为路径偏离，可稍后返回。',
        returnEligible: true,
      },
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        currentNodeId: 'node-3',
        lastExecutionMetadata: expect.objectContaining({
          activeNodeId: 'node-3',
          completedNodeIds: ['node-1'],
          skippedNodeIds: ['node-2'],
        }),
      }),
    }));
  });

  it('returns idempotent success when a current-node skip is retried after current advancement', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-3',
      nodeIds: ['node-1', 'node-2', 'node-3'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
          { nodeId: 'node-3', type: 'checkpoint', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], skippedNodeIds: ['node-2'] },
    });
    mocks.prisma.learningPathDeviation.findFirst.mockResolvedValueOnce({
      id: 'dev-2',
      pathId: 'path-1',
      userId: 'student-1',
      deviationType: 'skip',
      priorNodeId: 'node-2',
      targetNodeId: 'node-2',
      evidenceConfidence: 'medium',
      idempotencyKey: 'skip-current-node-2',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
    });

    const response = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'skip',
      priorNodeId: 'node-2',
      targetNodeId: 'node-2',
      idempotencyKey: 'skip-current-node-2',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      deviation: {
        id: 'dev-2',
        deviationType: 'skip',
        priorNodeId: 'node-2',
        targetNodeId: 'node-2',
        evidenceConfidence: 'medium',
      },
      pathUpdate: { currentNodeId: 'node-3' },
    });
    expect(mocks.recordPathDeviation).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('repairs parent path advancement when an idempotent current-node skip replay finds an existing deviation', async () => {
    const skipPath = {
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2', 'node-3'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
          { nodeId: 'node-3', type: 'checkpoint', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], skippedNodeIds: [] },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue(skipPath);
    mocks.prisma.learningPath.findFirst.mockResolvedValue(skipPath);
    mocks.prisma.learningPathDeviation.findFirst.mockResolvedValueOnce({
      id: 'dev-2',
      pathId: 'path-1',
      userId: 'student-1',
      deviationType: 'skip',
      priorNodeId: 'node-2',
      targetNodeId: 'node-2',
      evidenceConfidence: 'medium',
      idempotencyKey: 'skip-current-node-2',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
    });

    const response = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'skip',
      priorNodeId: 'node-2',
      targetNodeId: 'node-2',
      idempotencyKey: 'skip-current-node-2',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      deviation: {
        id: 'dev-2',
        deviationType: 'skip',
        priorNodeId: 'node-2',
        targetNodeId: 'node-2',
      },
      pathUpdate: { currentNodeId: 'node-3' },
    });
    expect(mocks.recordPathDeviation).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        currentNodeId: 'node-3',
        lastExecutionMetadata: expect.objectContaining({
          activeNodeId: 'node-3',
          skippedNodeIds: ['node-2'],
        }),
      }),
    }));
  });

  it('records path choice evidence for the student owner with current style ids', async () => {
    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedStyleId: 'foundation-remediation',
      selectedPolicyFamily: 'forged-policy-family',
      rejectedStyleIds: ['simulation-driven'],
      resourceMix: { forged_resource: 99 },
      rationaleMetadata: { evidenceBasis: ['forged-client-evidence'] },
      diagnosisSnapshotRef: 'diagnosis-snapshot:forged-client',
      idempotencyKey: 'choice-key',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.recordPathChoiceEvidence).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'selection',
      pathId: 'path-1',
      userId: 'student-1',
      selectedStyleId: 'foundation-remediation',
      selectedPolicyFamily: 'foundation-remediation',
      rejectedStyleIds: ['simulation-driven'],
      diagnosisSnapshotRef: 'diagnosis-snapshot:server-owned',
      resourceMix: { knowledge_card: 1, arena_task: 1 },
      rationaleMetadata: expect.objectContaining({
        evidenceBasis: ['adaptive-learner-state'],
        limitations: ['terminal-validation-required'],
        terminalValidationNodeIds: ['arena-task:terminal'],
      }),
      idempotencyKey: 'choice-key',
    }));
    expect(mocks.refreshStudentEvidenceFeatureCache).toHaveBeenCalledWith(expect.anything(), 'student-1');
    expect(payload).toMatchObject({
      choice: {
        emitted: true,
        dedupeKey: 'control-correction-path:choice:path-1:choice-key',
      },
      cacheRefresh: 'completed',
    });
  });

  it('records product option ids through server-owned style evidence', async () => {
    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      rejectedOptionIds: ['path-option-2'],
      resourceMix: { forged_resource: 99 },
      rationaleMetadata: { evidenceBasis: ['forged-client-evidence'] },
      idempotencyKey: 'choice-option-key',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathChoiceEvidence).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      selectedStyleId: 'foundation-remediation',
      selectedPolicyFamily: 'foundation-remediation',
      rejectedStyleIds: ['simulation-driven'],
      resourceMix: { knowledge_card: 1, arena_task: 1 },
      rationaleMetadata: expect.objectContaining({
        evidenceBasis: ['adaptive-learner-state'],
        limitations: ['terminal-validation-required'],
        terminalValidationNodeIds: ['arena-task:terminal'],
      }),
      idempotencyKey: 'choice-option-key',
    }));
  });

  it('rejects a candidate identity that is not bound to the selected path batch', async () => {
    mocks.prisma.adaptivePathCandidateBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      userId: 'student-1',
      goalId: 'control-correction',
      sourcePathId: 'another-path',
      status: 'succeeded',
      candidates: [{
        id: 'candidate-1',
        styleId: 'foundation-remediation',
        snapshot: { styleId: 'foundation-remediation' },
      }],
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      batchId: 'batch-1',
      candidateId: 'candidate-1',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'candidate-mismatch-key',
    }), params);

    expect(response.status).toBe(404);
    expect(mocks.recordPathChoiceEvidence).not.toHaveBeenCalled();
  });

  it('executes the immutable candidate snapshot instead of mutable source path options', async () => {
    mocks.prisma.agentToolRun.findFirst.mockResolvedValue({
      id: 'tool-run-selection-1', status: 'running', startedAt: new Date('2026-08-05T00:00:00Z'),
      inputSummary: {
        batchId: 'batch-1', candidateId: 'candidate-1', pathId: 'path-1', goalId: 'control-correction',
      },
      outputSummary: null,
    });
    mocks.prisma.agentToolRun.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.adaptivePathCandidateBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      userId: 'student-1',
      goalId: 'control-correction',
      sourcePathId: 'path-1',
      status: 'succeeded',
      candidates: [{
        id: 'candidate-1',
        styleId: 'foundation-remediation',
        snapshot: {
          optionId: 'path-option-a',
          styleId: 'foundation-remediation',
          policyFamily: 'foundation-remediation',
          nodeIds: ['snapshot-a-1', 'snapshot-a-2'],
          activeNodeIds: ['snapshot-a-1'],
          planNodes: [
            { nodeId: 'snapshot-a-1', type: 'knowledge_card', target: '/knowledge/snapshot-a-1' },
            { nodeId: 'snapshot-a-2', type: 'adaptive_quiz', target: '/assessment/snapshot-a-2' },
          ],
          resourceMix: { knowledge_card: 1, adaptive_quiz: 1 },
          evidenceBasis: ['candidate-snapshot-a'],
          terminalValidationNodeIds: [],
        },
      }],
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      batchId: 'batch-1',
      candidateId: 'candidate-1',
      selectedOptionId: 'path-option-a',
      selectedStyleId: 'foundation-remediation',
      idempotencyKey: 'candidate-snapshot-key',
      toolRunId: 'tool-run-selection-1',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathChoiceEvidence).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      resourceMix: { knowledge_card: 1, adaptive_quiz: 1 },
      rationaleMetadata: expect.objectContaining({ evidenceBasis: ['candidate-snapshot-a'] }),
    }));
    expect(mocks.prisma.agentToolRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tool-run-selection-1', status: 'running' },
      data: expect.objectContaining({ status: 'succeeded' }),
    }));
    expect(mocks.recordPathChoiceEvidence.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.prisma.agentToolRun.updateMany.mock.invocationCallOrder[0]);
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        nodeIds: ['snapshot-a-1', 'snapshot-a-2'],
        currentNodeId: 'snapshot-a-1',
        pathPayload: expect.objectContaining({
          selectedOptionId: 'path-option-a',
          selectedStyleId: 'foundation-remediation',
        }),
      }),
    }));
    expect(JSON.stringify(mocks.prisma.learningPath.update.mock.calls)).not.toContain('knowledge-card:targets');
  });

  it('records an immutable candidate rejection without selecting or adopting it', async () => {
    mocks.prisma.adaptivePathCandidateBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      userId: 'student-1',
      goalId: 'control-correction',
      sourcePathId: 'path-1',
      status: 'succeeded',
      candidates: [{
        id: 'candidate-1',
        styleId: 'foundation-remediation',
        snapshot: {
          optionId: 'path-option-a',
          styleId: 'foundation-remediation',
          policyFamily: 'foundation-remediation',
          nodeIds: ['snapshot-a-1'],
          activeNodeIds: ['snapshot-a-1'],
          planNodes: [
            { nodeId: 'snapshot-a-1', type: 'knowledge_card', target: '/knowledge/snapshot-a-1' },
          ],
          resourceMix: { knowledge_card: 1 },
          evidenceBasis: ['candidate-snapshot-a'],
          terminalValidationNodeIds: [],
        },
      }],
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'rejection',
      batchId: 'batch-1',
      candidateId: 'candidate-1',
      rejectedOptionIds: ['path-option-a'],
      idempotencyKey: 'candidate-rejection-key',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathChoiceEvidence).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      selectedStyleId: null,
      selectedPolicyFamily: null,
      rejectedStyleIds: ['foundation-remediation'],
    }));
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('rejects non-selection actions that attempt to complete a candidate selection tool run', async () => {
    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'rejection',
      batchId: 'batch-1',
      candidateId: 'candidate-1',
      rejectedOptionIds: ['path-option-a'],
      idempotencyKey: 'candidate-rejection-tool-run-key',
      toolRunId: 'tool-run-selection-1',
    }), params);

    expect(response.status).toBe(400);
    expect(mocks.recordPathChoiceEvidence).not.toHaveBeenCalled();
    expect(mocks.prisma.agentToolRun.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.agentToolRun.updateMany).not.toHaveBeenCalled();
  });

  it('records choices from persisted fallback pathOptions when no policy bundle paths exist', async () => {
    const fallbackPath = {
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'feedback-loop-concept-foundations',
      pathStatus: 'fallback',
      currentNodeId: 'registry:lesson01-feedback-bridge-v1',
      nodeIds: ['registry:lesson01-feedback-bridge-v1', 'registry:lesson01-feedback-exit-quiz-v1'],
      pathPayload: {
        mainPathNodeIds: ['registry:lesson01-feedback-bridge-v1', 'registry:lesson01-feedback-exit-quiz-v1'],
        planNodes: [
          { nodeId: 'registry:lesson01-feedback-bridge-v1', type: 'lesson_step', target: '/interactive-learning/unit-1-1-see-the-full-picture' },
          { nodeId: 'registry:lesson01-feedback-exit-quiz-v1', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
        ],
        pathOptions: [{
          optionId: 'path-option-1',
          styleId: 'recommended',
          policyFamily: 'rules-plus-graph-search',
          nodeIds: ['registry:lesson01-feedback-bridge-v1', 'registry:lesson01-feedback-exit-quiz-v1'],
          activeNodeIds: ['registry:lesson01-feedback-bridge-v1'],
          planNodes: [
            { nodeId: 'registry:lesson01-feedback-bridge-v1', type: 'lesson_step', target: '/interactive-learning/unit-1-1-see-the-full-picture' },
            { nodeId: 'registry:lesson01-feedback-exit-quiz-v1', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
          ],
          resourceMix: { lesson_step: 1, adaptive_quiz: 1 },
          evidenceBasis: ['adaptive-learner-state'],
          terminalValidationNodeIds: [],
        }],
      },
      learnerStateRef: 'adaptive-learner-state:student-1',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: [] },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue(fallbackPath);

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'fallback-option-choice-key',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathChoiceEvidence).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      goalId: 'feedback-loop-concept-foundations',
      selectedStyleId: 'recommended',
      selectedPolicyFamily: 'rules-plus-graph-search',
      resourceMix: { lesson_step: 1, adaptive_quiz: 1 },
      idempotencyKey: 'fallback-option-choice-key',
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        nodeIds: ['registry:lesson01-feedback-bridge-v1', 'registry:lesson01-feedback-exit-quiz-v1'],
        currentNodeId: 'registry:lesson01-feedback-bridge-v1',
        pathStatus: 'active',
        pathPayload: expect.objectContaining({
          selectedOptionId: 'path-option-1',
          selectedStyleId: 'recommended',
        }),
      }),
    }));
  });

  it('does not adopt an option again for a repeated idempotency key', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
        selectionHistory: [{
          id: 'control-correction-path:choice:path-1:choice-replay-key',
          type: 'selection',
          selectedStyleId: 'foundation-remediation',
          rejectedStyleIds: ['simulation-driven'],
        }],
        policyBundle: {
          status: 'ready',
          paths: [
            {
              styleId: 'foundation-remediation',
              policyFamily: 'foundation-remediation',
              nodeIds: ['knowledge-card:targets', 'arena-task:terminal'],
              activeNodeIds: ['knowledge-card:targets'],
              planNodes: [
                { nodeId: 'knowledge-card:targets', type: 'knowledge_card', target: '/knowledge/cards/targets' },
                { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
              ],
              resourceMix: { knowledge_card: 1, arena_task: 1 },
              evidenceBasis: ['adaptive-learner-state'],
              terminalValidationNodeIds: ['arena-task:terminal'],
            },
            {
              styleId: 'simulation-driven',
              policyFamily: 'simulation-driven',
              nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
              activeNodeIds: ['simulation:control-correction-step-response-lab'],
              planNodes: [
                { nodeId: 'simulation:control-correction-step-response-lab', type: 'simulation', target: '/simulations/control-correction-step-response-lab' },
                { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
              ],
              resourceMix: { simulation: 1, arena_task: 1 },
              evidenceBasis: ['simulation-run'],
              terminalValidationNodeIds: ['arena-task:terminal'],
            },
          ],
        },
      },
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedStyleId: 'foundation-remediation',
      rejectedStyleIds: ['simulation-driven'],
      idempotencyKey: 'choice-replay-key',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      choice: {
        emitted: false,
        dedupeKey: 'control-correction-path:choice:path-1:choice-replay-key',
      },
      pathUpdate: null,
    });
    expect(mocks.recordPathChoiceEvidence).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('rejects conflicting path option replays for the same idempotency key', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
        selectionHistory: [{
          id: 'control-correction-path:choice:path-1:choice-conflict-key',
          type: 'selection',
          selectedStyleId: 'foundation-remediation',
          rejectedStyleIds: ['simulation-driven'],
        }],
        policyBundle: {
          status: 'ready',
          paths: [
            {
              styleId: 'foundation-remediation',
              policyFamily: 'foundation-remediation',
              nodeIds: ['knowledge-card:targets', 'arena-task:terminal'],
              activeNodeIds: ['knowledge-card:targets'],
              planNodes: [
                { nodeId: 'knowledge-card:targets', type: 'knowledge_card', target: '/knowledge/cards/targets' },
                { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
              ],
              resourceMix: { knowledge_card: 1, arena_task: 1 },
              evidenceBasis: ['adaptive-learner-state'],
            },
            {
              styleId: 'simulation-driven',
              policyFamily: 'simulation-driven',
              nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
              activeNodeIds: ['simulation:control-correction-step-response-lab'],
              planNodes: [
                { nodeId: 'simulation:control-correction-step-response-lab', type: 'simulation', target: '/simulations/control-correction-step-response-lab' },
                { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
              ],
              resourceMix: { simulation: 1, arena_task: 1 },
              evidenceBasis: ['simulation-run'],
            },
          ],
        },
      },
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedStyleId: 'simulation-driven',
      rejectedStyleIds: ['foundation-remediation'],
      idempotencyKey: 'choice-conflict-key',
    }), params);

    expect(response.status).toBe(409);
    expect(mocks.recordPathChoiceEvidence).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('rejects conflicting helpfulness replays for the same idempotency key', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
        selectionHistory: [{
          id: 'control-correction-path:choice:path-1:helpfulness-replay-key',
          type: 'helpfulness',
          selectedStyleId: 'foundation-remediation',
          rejectedStyleIds: [],
          helpful: true,
        }],
        policyBundle: {
          status: 'ready',
          paths: [
            {
              styleId: 'foundation-remediation',
              policyFamily: 'foundation-remediation',
              nodeIds: ['knowledge-card:targets', 'arena-task:terminal'],
              activeNodeIds: ['knowledge-card:targets'],
              planNodes: [
                { nodeId: 'knowledge-card:targets', type: 'knowledge_card', target: '/knowledge/cards/targets' },
                { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
              ],
              resourceMix: { knowledge_card: 1, arena_task: 1 },
              evidenceBasis: ['adaptive-learner-state'],
            },
          ],
        },
      },
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'helpfulness',
      selectedStyleId: 'foundation-remediation',
      helpful: false,
      idempotencyKey: 'helpfulness-replay-key',
    }), params);

    expect(response.status).toBe(409);
    expect(mocks.recordPathChoiceEvidence).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('does not adopt an option when evidence dedupe already handled the choice key', async () => {
    mocks.recordPathChoiceEvidence.mockResolvedValueOnce({
      emitted: false,
      dedupeKey: 'control-correction-path:choice:path-1:choice-concurrent-key',
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      rejectedOptionIds: ['path-option-2'],
      idempotencyKey: 'choice-concurrent-key',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      choice: {
        emitted: false,
        dedupeKey: 'control-correction-path:choice:path-1:choice-concurrent-key',
      },
      pathUpdate: null,
    });
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('adopts the selected product option as the executable path', async () => {
    const latestPathPayload = {
      mainPathNodeIds: ['node-1'],
      planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
      policyBundle: {
        status: 'ready',
        paths: [
          {
            styleId: 'simulation-driven',
            policyFamily: 'simulation-driven',
            nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
            activeNodeIds: ['arena-task:terminal'],
            planNodes: [
              { nodeId: 'simulation:control-correction-step-response-lab', type: 'simulation', target: '/simulations/control-correction-step-response-lab' },
              { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
            ],
            resourceMix: { simulation: 1, arena_task: 1 },
            evidenceBasis: ['simulation-run'],
            recommendationProvenance: {
              summary: '依据仿真实验与终点检查证据安排本路径。',
              confidence: 'medium',
              entries: [{
                evidenceSummary: '最近一次仿真实验已形成有效记录。',
                judgment: '先复核仿真，再进入终点检查。',
                affectedNodeIds: ['simulation:control-correction-step-response-lab'],
              }],
              limitations: ['终点检查仍需补充结果。'],
            },
            terminalValidationNodeIds: ['arena-task:terminal'],
          },
        ],
      },
    };
    const accessPath = {
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: latestPathPayload,
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'passed' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'] },
    };
    // Fence re-read must see empty completed set so the adopted current node advances.
    const fencedPath = {
      ...accessPath,
      lastExecutionMetadata: { completedNodeIds: [] },
      terminalValidation: { nodeId: 'node-1', state: 'passed' },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue(accessPath);
    mocks.prisma.learningPath.findFirst.mockResolvedValue(fencedPath);

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-adopt-option-key',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.pathUpdate).toMatchObject({
      selectedOptionId: 'path-option-1',
      selectedStyleId: 'simulation-driven',
      currentNodeId: 'arena-task:terminal',
      nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
    });
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
        currentNodeId: 'arena-task:terminal',
        pathStatus: 'active',
        pathPayload: expect.objectContaining({
          selectedOptionId: 'path-option-1',
          selectedStyleId: 'simulation-driven',
          selectedPolicyFamily: 'simulation-driven',
          currentNodeId: 'arena-task:terminal',
          mainPathNodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
          executionStatus: expect.objectContaining({
            activeNodeId: 'arena-task:terminal',
            completedNodeIds: [],
            failedNodeIds: [],
            skippedNodeIds: [],
          }),
          visualization: expect.objectContaining({
            map: expect.objectContaining({
              currentNodeId: 'arena-task:terminal',
              mainPathNodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
              completedNodeIds: [],
              failedNodeIds: [],
              skippedNodeIds: [],
            }),
          }),
          planNodes: [
            expect.objectContaining({
              nodeId: 'simulation:control-correction-step-response-lab',
              type: 'simulation',
              decisionExplanation: {
                selectionBasis: {
                  summary: '依据仿真实验与终点检查证据安排本路径。',
                  confidence: 'medium',
                  supportingFacts: [
                    '最近一次仿真实验已形成有效记录。',
                    '先复核仿真，再进入终点检查。',
                  ],
                  limitations: ['终点检查仍需补充结果。'],
                },
              },
            }),
            expect.objectContaining({
              nodeId: 'arena-task:terminal',
              type: 'arena_task',
              status: 'current',
              decisionExplanation: {
                selectionBasis: expect.objectContaining({
                  summary: '依据仿真实验与终点检查证据安排本路径。',
                  supportingFacts: [],
                }),
              },
            }),
          ],
        }),
        lastExecutionMetadata: expect.objectContaining({
          activeNodeId: 'arena-task:terminal',
          selectedOptionId: 'path-option-1',
          selectedStyleId: 'simulation-driven',
        }),
        terminalValidation: expect.objectContaining({
          nodeId: 'arena-task:terminal',
          resourceType: 'arena_task',
          state: 'pending',
          target: '/arena/tasks/terminal',
          taskId: 'terminal',
        }),
      }),
    }));
  });

  it('maps LearningPathMutationBlockedError from execute service to 409 LEGACY_PATH_STOPPED', async () => {
    const { LearningPathMutationBlockedError } = await import('@/lib/canonical-learning-path-transition/mutation-guard');
    mocks.recordPathNodeExecution.mockRejectedValueOnce(new LearningPathMutationBlockedError({
      blocked: true,
      code: 'LEGACY_PATH_STOPPED',
      reason: 'legacy-stopped-immutable',
      pathStatus: 'legacy-stopped',
      pathId: 'path-1',
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      idempotencyKey: 'exec-stopped-fence',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: 'LEGACY_PATH_STOPPED',
      reason: 'legacy-stopped-immutable',
      pathStatus: 'legacy-stopped',
      pathId: 'path-1',
    });
  });

  it('maps LearningPathMutationBlockedError from intervention service to 409 LEGACY_PATH_STOPPED', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    const { LearningPathMutationBlockedError } = await import('@/lib/canonical-learning-path-transition/mutation-guard');
    mocks.recordPathIntervention.mockRejectedValueOnce(new LearningPathMutationBlockedError({
      blocked: true,
      code: 'LEGACY_PATH_STOPPED',
      reason: 'legacy-stopped-immutable',
      pathStatus: 'legacy-stopped',
      pathId: 'path-1',
    }));

    const response = await intervenePath(post('http://localhost/api/learning-paths/path-1/interventions', {
      interventionKind: 'hint',
      suggestedAction: 'review',
      privacySafeSummary: 'hint summary',
      idempotencyKey: 'intv-stopped-fence',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: 'LEGACY_PATH_STOPPED',
      reason: 'legacy-stopped-immutable',
    });
  });

  it('maps LearningPathMutationBlockedError from plan persist to 409 LEGACY_PATH_STOPPED', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({ userId: 'student-1', classId: 'class-1' });
    mocks.prisma.learningPath.findUnique.mockResolvedValue(null);
    const { LearningPathMutationBlockedError } = await import('@/lib/canonical-learning-path-transition/mutation-guard');
    mocks.persistControlCorrectionPathRound.mockRejectedValueOnce(new LearningPathMutationBlockedError({
      blocked: true,
      code: 'LEGACY_PATH_STOPPED',
      reason: 'legacy-stopped-immutable',
      pathStatus: 'legacy-stopped',
      pathId: 'adaptive-path:student-1:control-correction',
    }));

    const response = await planPath(post('http://localhost/api/learning-paths/plan', {
      classId: 'class-1',
      plan: {
        id: 'adaptive-path:student-1:control-correction',
        userId: 'student-1',
        goal: { id: 'control-correction', title: '控制系统校正设计', knowledgeTargets: [] },
        stage: 'stage-1-rules-graph',
        status: 'ready',
        currentNodeId: 'node-1',
        mainPath: [],
      },
    }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: 'LEGACY_PATH_STOPPED',
      reason: 'legacy-stopped-immutable',
      pathStatus: 'legacy-stopped',
    });
  });

  it('returns 409 and skips adopt update when cutover stops the path after choice evidence', async () => {
    const pathPayload = {
      mainPathNodeIds: ['node-1'],
      planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
      policyBundle: {
        status: 'ready',
        paths: [
          {
            styleId: 'simulation-driven',
            policyFamily: 'simulation-driven',
            nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
            activeNodeIds: ['arena-task:terminal'],
            planNodes: [
              { nodeId: 'simulation:control-correction-step-response-lab', type: 'simulation', target: '/simulations/control-correction-step-response-lab' },
              { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
            ],
            resourceMix: { simulation: 1, arena_task: 1 },
            evidenceBasis: ['simulation-run'],
            terminalValidationNodeIds: ['arena-task:terminal'],
          },
        ],
      },
    };
    const activePath = {
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload,
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue(activePath);
    // Initial guard passes via findUnique; fence re-read sees stopped after cutover.
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      ...activePath,
      pathStatus: 'legacy-stopped',
      pathPayload: {
        ...pathPayload,
        legacyArchiveState: 'legacy-stopped',
        readOnlyStopped: true,
      },
    });
    mocks.recordPathChoiceEvidence.mockResolvedValue({
      emitted: true,
      dedupeKey: 'control-correction-path:choice:path-1:choice-after-cutover',
    });
    mocks.prisma.learningPath.update.mockClear();

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-after-cutover',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: 'LEGACY_PATH_STOPPED',
      reason: 'legacy-stopped-immutable',
      pathStatus: 'legacy-stopped',
    });
    expect(mocks.recordPathChoiceEvidence).toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('returns 409 and skips skip-advance update when cutover stops path after deviation', async () => {
    const activePath = {
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2', 'node-3'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
          { nodeId: 'node-3', type: 'checkpoint', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], skippedNodeIds: [] },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue(activePath);
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      ...activePath,
      pathStatus: 'legacy-stopped',
      pathPayload: {
        ...activePath.pathPayload,
        legacyArchiveState: 'legacy-stopped',
        readOnlyStopped: true,
      },
    });
    mocks.recordPathDeviation.mockResolvedValue({
      id: 'dev-after-cutover',
      deviationType: 'skip',
      priorNodeId: 'node-2',
      targetNodeId: 'node-2',
      evidenceConfidence: 'medium',
    });
    mocks.prisma.learningPath.update.mockClear();

    const response = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'skip',
      priorNodeId: 'node-2',
      targetNodeId: 'node-2',
      idempotencyKey: 'skip-after-cutover',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: 'LEGACY_PATH_STOPPED',
      reason: 'legacy-stopped-immutable',
      pathStatus: 'legacy-stopped',
    });
    expect(mocks.recordPathDeviation).toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('returns 409 on idempotent skip repair when path is stopped under fence', async () => {
    const activePath = {
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2', 'node-3'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
          { nodeId: 'node-3', type: 'checkpoint', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], skippedNodeIds: [] },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue(activePath);
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      ...activePath,
      pathStatus: 'legacy-stopped',
    });
    mocks.prisma.learningPathDeviation.findFirst.mockResolvedValue({
      id: 'dev-existing',
      pathId: 'path-1',
      userId: 'student-1',
      deviationType: 'skip',
      priorNodeId: 'node-2',
      targetNodeId: 'node-2',
      evidenceConfidence: 'medium',
      idempotencyKey: 'skip-repair-stopped',
    });
    mocks.prisma.learningPath.update.mockClear();

    const response = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'skip',
      priorNodeId: 'node-2',
      targetNodeId: 'node-2',
      idempotencyKey: 'skip-repair-stopped',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: 'LEGACY_PATH_STOPPED',
      reason: 'legacy-stopped-immutable',
    });
    expect(mocks.recordPathDeviation).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('selects the next unfinished node when adopting an option with stale active nodes', async () => {
    const pathPayload = {
      mainPathNodeIds: ['node-1'],
      planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
      policyBundle: {
        status: 'ready',
        paths: [
          {
            styleId: 'simulation-driven',
            policyFamily: 'simulation-driven',
            nodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
            activeNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
            planNodes: [
              { nodeId: 'simulation:shared-lab', type: 'simulation', target: '/simulations/shared-lab' },
              { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
            ],
            resourceMix: { simulation: 1, arena_task: 1 },
            evidenceBasis: ['simulation-run'],
            terminalValidationNodeIds: ['arena-task:terminal'],
          },
        ],
      },
    };
    const accessPath = {
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload,
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue(accessPath);
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      ...accessPath,
      pathPayload: {
        ...pathPayload,
        executionStatus: { completedNodeIds: ['simulation:shared-lab'] },
      },
      lastExecutionMetadata: { completedNodeIds: ['simulation:shared-lab'] },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-stale-active-node-key',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'arena-task:terminal',
        pathStatus: 'active',
        pathPayload: expect.objectContaining({
          currentNodeId: 'arena-task:terminal',
          executionStatus: expect.objectContaining({
            activeNodeId: 'arena-task:terminal',
            completedNodeIds: ['simulation:shared-lab'],
          }),
        }),
        lastExecutionMetadata: expect.objectContaining({
          activeNodeId: 'arena-task:terminal',
          completedNodeIds: ['simulation:shared-lab'],
        }),
      }),
    }));
  });

  it('keeps an adopted option completed when every selected node is already complete', async () => {
    const pathPayload = {
      mainPathNodeIds: ['node-1'],
      planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
      policyBundle: {
        status: 'ready',
        paths: [
          {
            styleId: 'completed-shared-route',
            policyFamily: 'simulation-driven',
            nodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
            activeNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
            planNodes: [
              { nodeId: 'simulation:shared-lab', type: 'simulation', target: '/simulations/shared-lab' },
              { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
            ],
            resourceMix: { simulation: 1, arena_task: 1 },
            evidenceBasis: ['simulation-run'],
            terminalValidationNodeIds: ['arena-task:terminal'],
          },
        ],
      },
    };
    const accessPath = {
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload,
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue(accessPath);
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      ...accessPath,
      pathPayload: {
        ...pathPayload,
        executionStatus: { completedNodeIds: ['simulation:shared-lab'] },
      },
      lastExecutionMetadata: { completedNodeIds: ['simulation:shared-lab', 'arena-task:terminal'] },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-completed-option-key',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.pathUpdate).toMatchObject({
      selectedOptionId: 'path-option-1',
      selectedStyleId: 'completed-shared-route',
      currentNodeId: null,
    });
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: null,
        pathStatus: 'completed',
        pathPayload: expect.objectContaining({
          currentNodeId: null,
          executionStatus: expect.objectContaining({
            activeNodeId: null,
            completedNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
          }),
        }),
        lastExecutionMetadata: expect.objectContaining({
          activeNodeId: null,
          completedNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
        }),
        terminalValidation: expect.objectContaining({
          nodeId: 'arena-task:terminal',
          state: 'completed',
        }),
      }),
    }));
  });

  it('keeps a completed selected option in fallback when terminal validation is low confidence', async () => {
    const terminalValidation = {
      nodeId: 'arena-task:terminal',
      state: 'low-confidence',
      evidenceRefs: ['arena:evidence:terminal'],
      lowConfidenceMarkers: ['arena-terminal-evidence-missing'],
      fallbackRequired: true,
    };
    const pathPayload = {
      mainPathNodeIds: ['node-1'],
      planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
      policyBundle: {
        status: 'ready',
        paths: [
          {
            styleId: 'completed-low-confidence-route',
            policyFamily: 'simulation-driven',
            nodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
            activeNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
            planNodes: [
              { nodeId: 'simulation:shared-lab', type: 'simulation', target: '/simulations/shared-lab' },
              { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
            ],
            resourceMix: { simulation: 1, arena_task: 1 },
            evidenceBasis: ['simulation-run'],
            terminalValidationNodeIds: ['arena-task:terminal'],
          },
        ],
      },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
        id: 'path-1',
        userId: 'student-1',
        classId: 'class-1',
        goalId: 'control-correction',
        pathStatus: 'active',
        currentNodeId: 'node-1',
        nodeIds: ['node-1'],
        pathPayload,
        learnerStateRef: 'diagnosis-snapshot:server-owned',
        inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
        terminalValidation,
        lastExecutionMetadata: { completedNodeIds: [] },
      });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      pathStatus: 'active',
      ...({
        pathPayload: {
          ...pathPayload,
          executionStatus: {
            activeNodeId: null,
            attemptCount: 2,
            completedNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
          },
        },
        lastExecutionMetadata: {
          completedNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
          terminalValidationState: 'low-confidence',
        },
        terminalValidation,
      }),
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-low-confidence-completed-option-key',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: null,
        pathStatus: 'fallback',
        pathPayload: expect.objectContaining({
          currentNodeId: null,
          executionStatus: expect.objectContaining({
            activeNodeId: null,
            attemptCount: 2,
            completedNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
          }),
        }),
        terminalValidation: expect.objectContaining({
          nodeId: 'arena-task:terminal',
          state: 'low-confidence',
          evidenceRefs: ['arena:evidence:terminal'],
          lowConfidenceMarkers: ['arena-terminal-evidence-missing'],
          fallbackRequired: true,
        }),
      }),
    }));
  });

  it('does not carry stale terminal validation evidence to a newly selected terminal node', async () => {
    const pathPayload = {
      mainPathNodeIds: ['node-1'],
      planNodes: [{ nodeId: 'node-1', type: 'arena_task', target: '/arena/tasks/old-terminal' }],
      policyBundle: {
        status: 'ready',
        paths: [
          {
            styleId: 'new-completed-terminal-route',
            policyFamily: 'simulation-driven',
            nodeIds: ['simulation:shared-lab', 'arena-task:new-terminal'],
            activeNodeIds: ['simulation:shared-lab', 'arena-task:new-terminal'],
            planNodes: [
              { nodeId: 'simulation:shared-lab', type: 'simulation', target: '/simulations/shared-lab' },
              { nodeId: 'arena-task:new-terminal', type: 'arena_task', target: '/arena/tasks/new-terminal' },
            ],
            resourceMix: { simulation: 1, arena_task: 1 },
            evidenceBasis: ['simulation-run'],
            terminalValidationNodeIds: ['arena-task:new-terminal'],
          },
        ],
      },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
        id: 'path-1',
        userId: 'student-1',
        classId: 'class-1',
        goalId: 'control-correction',
        pathStatus: 'fallback',
        currentNodeId: null,
        nodeIds: ['arena-task:old-terminal'],
        pathPayload,
        learnerStateRef: 'diagnosis-snapshot:server-owned',
        inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
        terminalValidation: {
          nodeId: 'arena-task:old-terminal',
          state: 'low-confidence',
          evidenceRefs: ['arena:evidence:old-terminal'],
          lowConfidenceMarkers: ['old-terminal-low-confidence'],
          fallbackRequired: true,
        },
        lastExecutionMetadata: { completedNodeIds: [] },
      });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      pathStatus: 'active',
      ...({
        pathPayload,
        lastExecutionMetadata: {
          completedNodeIds: ['simulation:shared-lab', 'arena-task:new-terminal'],
          terminalValidationState: 'low-confidence',
        },
        terminalValidation: {
          nodeId: 'arena-task:old-terminal',
          state: 'low-confidence',
          evidenceRefs: ['arena:evidence:old-terminal'],
          lowConfidenceMarkers: ['old-terminal-low-confidence'],
          fallbackRequired: true,
        },
      }),
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-new-terminal-completed-option-key',
    }), params);
    const updateCall = mocks.prisma.learningPath.update.mock.calls.at(-1)?.[0];

    expect(response.status).toBe(200);
    expect(updateCall).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: null,
        pathStatus: 'completed',
        terminalValidation: expect.objectContaining({
          nodeId: 'arena-task:new-terminal',
          state: 'completed',
          target: '/arena/tasks/new-terminal',
        }),
      }),
    }));
    expect(updateCall?.data.terminalValidation).not.toMatchObject({
      evidenceRefs: ['arena:evidence:old-terminal'],
      lowConfidenceMarkers: ['old-terminal-low-confidence'],
      fallbackRequired: true,
    });
  });

  it('prefers failed terminal node state over stale completed validation on the same terminal', async () => {
    const terminalValidation = {
      nodeId: 'arena-task:terminal',
      state: 'completed',
      evidenceRefs: ['arena:evidence:terminal'],
    };
    const pathPayload = {
      mainPathNodeIds: ['node-1'],
      planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
      policyBundle: {
        status: 'ready',
        paths: [
          {
            styleId: 'failed-terminal-route',
            policyFamily: 'simulation-driven',
            nodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
            activeNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
            planNodes: [
              { nodeId: 'simulation:shared-lab', type: 'simulation', target: '/simulations/shared-lab' },
              { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
            ],
            resourceMix: { simulation: 1, arena_task: 1 },
            evidenceBasis: ['simulation-run'],
            terminalValidationNodeIds: ['arena-task:terminal'],
          },
        ],
      },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
        id: 'path-1',
        userId: 'student-1',
        classId: 'class-1',
        goalId: 'control-correction',
        pathStatus: 'completed',
        currentNodeId: null,
        nodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
        pathPayload,
        learnerStateRef: 'diagnosis-snapshot:server-owned',
        inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
        terminalValidation,
        lastExecutionMetadata: { completedNodeIds: [] },
      });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      pathStatus: 'active',
      ...({
        pathPayload,
        lastExecutionMetadata: {
          completedNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
          failedNodeIds: ['arena-task:terminal'],
        },
        terminalValidation,
      }),
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-failed-terminal-option-key',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: null,
        pathStatus: 'fallback',
        lastExecutionMetadata: expect.objectContaining({
          completedNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
          failedNodeIds: ['arena-task:terminal'],
        }),
        terminalValidation: expect.objectContaining({
          nodeId: 'arena-task:terminal',
          state: 'failed',
          evidenceRefs: ['arena:evidence:terminal'],
        }),
      }),
    }));
  });

  it('keeps the selected path in fallback when a non-terminal selected node has failed', async () => {
    const terminalValidation = {
      nodeId: 'arena-task:terminal',
      state: 'completed',
      evidenceRefs: ['arena:evidence:terminal'],
    };
    const pathPayload = {
      mainPathNodeIds: ['node-1'],
      planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
      policyBundle: {
        status: 'ready',
        paths: [
          {
            styleId: 'partial-failed-route',
            policyFamily: 'simulation-driven',
            nodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
            activeNodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
            planNodes: [
              { nodeId: 'simulation:shared-lab', type: 'simulation', target: '/simulations/shared-lab' },
              { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
            ],
            resourceMix: { simulation: 1, arena_task: 1 },
            evidenceBasis: ['simulation-run'],
            terminalValidationNodeIds: ['arena-task:terminal'],
          },
        ],
      },
    };
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
        id: 'path-1',
        userId: 'student-1',
        classId: 'class-1',
        goalId: 'control-correction',
        pathStatus: 'completed',
        currentNodeId: null,
        nodeIds: ['simulation:shared-lab', 'arena-task:terminal'],
        pathPayload,
        learnerStateRef: 'diagnosis-snapshot:server-owned',
        inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
        terminalValidation,
        lastExecutionMetadata: { completedNodeIds: [] },
      });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      pathStatus: 'active',
      ...({
        pathPayload,
        lastExecutionMetadata: {
          completedNodeIds: ['arena-task:terminal'],
          failedNodeIds: ['simulation:shared-lab'],
        },
        terminalValidation,
      }),
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-partial-failed-option-key',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: null,
        pathStatus: 'fallback',
        pathPayload: expect.objectContaining({
          executionStatus: expect.objectContaining({
            activeNodeId: null,
            completedNodeIds: ['arena-task:terminal'],
            failedNodeIds: ['simulation:shared-lab'],
          }),
        }),
        lastExecutionMetadata: expect.objectContaining({
          completedNodeIds: ['arena-task:terminal'],
          failedNodeIds: ['simulation:shared-lab'],
        }),
        terminalValidation: expect.objectContaining({
          nodeId: 'arena-task:terminal',
          state: 'completed',
          evidenceRefs: ['arena:evidence:terminal'],
        }),
      }),
    }));
  });

  it('preserves the latest path choice history when adopting the selected option', async () => {
    const initialPathPayload = {
      mainPathNodeIds: ['node-1'],
      planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
      policyBundle: {
        status: 'ready',
        paths: [
          {
            styleId: 'simulation-driven',
            policyFamily: 'simulation-driven',
            nodeIds: ['simulation:selected', 'arena-task:terminal'],
            activeNodeIds: ['simulation:selected'],
            planNodes: [
              { nodeId: 'simulation:selected', type: 'simulation', target: '/simulations/selected' },
              { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
            ],
            resourceMix: { simulation: 1, arena_task: 1 },
            evidenceBasis: ['simulation-run'],
            limitations: [],
          },
        ],
      },
    };
    const latestSelectionHistory = [{ id: 'choice-history-1', type: 'selection', selectedStyleId: 'simulation-driven' }];
    const latestActivity = [{ id: 'choice-history-1', type: 'choice:selection', selectedStyleId: 'simulation-driven' }];
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
        id: 'path-1',
        userId: 'student-1',
        classId: 'class-1',
        goalId: 'control-correction',
        pathStatus: 'active',
        currentNodeId: 'node-1',
        nodeIds: ['node-1'],
        pathPayload: initialPathPayload,
        learnerStateRef: 'diagnosis-snapshot:server-owned',
        inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
        terminalValidation: { nodeId: 'node-1', state: 'pending' },
        lastExecutionMetadata: { completedNodeIds: [] },
      });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      pathStatus: 'active',
      ...({
        pathPayload: {
          ...initialPathPayload,
          selectionHistory: latestSelectionHistory,
          activity: latestActivity,
        },
        lastExecutionMetadata: { completedNodeIds: [], activeNodeId: 'node-1' },
      }),
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-history-preserved-key',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        pathPayload: expect.objectContaining({
          selectionHistory: latestSelectionHistory,
          activity: latestActivity,
          currentNodeId: 'simulation:selected',
          mainPathNodeIds: ['simulation:selected', 'arena-task:terminal'],
        }),
      }),
    }));
  });

  it('adopts legacy product options from node summaries when option plan nodes are absent', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
        id: 'path-1',
        userId: 'student-1',
        classId: 'class-1',
        goalId: 'control-correction',
        pathStatus: 'active',
        currentNodeId: 'node-1',
        nodeIds: ['node-1'],
        pathPayload: {
          mainPathNodeIds: ['node-1'],
          planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
          policyBundle: {
            status: 'ready',
            paths: [
              {
                styleId: 'legacy-simulation-option',
                policyFamily: 'simulation-driven',
                nodeIds: ['simulation:legacy-step-lab', 'teaching-resource:legacy-card', 'lesson-step:legacy-lesson', 'arena-task:legacy-terminal'],
                activeNodeIds: ['simulation:legacy-step-lab'],
                nodeSummaries: [
                  {
                    nodeId: 'simulation:legacy-step-lab',
                    title: '旧路径仿真节点',
                    pathNodeType: 'practice',
                    launchTarget: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11',
                    estimatedTimeMinutes: 20,
                  },
                  {
                    nodeId: 'teaching-resource:legacy-card',
                    title: '旧路径知识卡',
                    pathNodeType: 'knowledge_card',
                    estimatedTimeMinutes: 8,
                  },
                  {
                    nodeId: 'lesson-step:legacy-lesson',
                    title: '旧路径互动课',
                    pathNodeType: 'interactive_lesson',
                    estimatedTimeMinutes: 12,
                  },
                  {
                    nodeId: 'arena-task:legacy-terminal',
                    title: '旧路径终端验证',
                    pathNodeType: 'checkpoint',
                    estimatedTimeMinutes: 15,
                  },
                ],
                resourceMix: { simulation: 1, arena_task: 1 },
                evidenceBasis: ['simulation-run'],
                limitations: [],
              },
            ],
          },
        },
        learnerStateRef: 'diagnosis-snapshot:server-owned',
        inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
        terminalValidation: { nodeId: 'node-1', state: 'pending' },
        lastExecutionMetadata: { completedNodeIds: [] },
      });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      pathStatus: 'active',
      ...({
        pathPayload: {
          mainPathNodeIds: ['node-1'],
          planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
        },
        lastExecutionMetadata: { completedNodeIds: [] },
      }),
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-legacy-option-key',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        nodeIds: ['simulation:legacy-step-lab', 'teaching-resource:legacy-card', 'lesson-step:legacy-lesson', 'arena-task:legacy-terminal'],
        currentNodeId: 'simulation:legacy-step-lab',
        pathPayload: expect.objectContaining({
          mainPathNodeIds: ['simulation:legacy-step-lab', 'teaching-resource:legacy-card', 'lesson-step:legacy-lesson', 'arena-task:legacy-terminal'],
          planNodes: [
            expect.objectContaining({
              nodeId: 'simulation:legacy-step-lab',
              type: 'simulation',
              target: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11',
              status: 'current',
            }),
            expect.objectContaining({
              nodeId: 'teaching-resource:legacy-card',
              type: 'knowledge_card',
              pathNodeType: 'knowledge_card',
              target: '/assessment/adaptive-practice',
            }),
            expect.objectContaining({
              nodeId: 'lesson-step:legacy-lesson',
              type: 'lesson_step',
              pathNodeType: 'interactive_lesson',
              target: '/assessment/adaptive-practice',
            }),
            expect.objectContaining({
              nodeId: 'arena-task:legacy-terminal',
              type: 'arena_task',
              target: '/arena/challenges/legacy-terminal',
            }),
          ],
        }),
      }),
    }));
  });

  it('rejects summary-only legacy simulation options without a governed launch target', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
        policyBundle: {
          status: 'ready',
          paths: [
            {
              styleId: 'legacy-simulation-option',
              policyFamily: 'simulation-driven',
              nodeIds: ['simulation:control-correction-step-response-lab'],
              activeNodeIds: ['simulation:control-correction-step-response-lab'],
              nodeSummaries: [
                {
                  nodeId: 'simulation:control-correction-step-response-lab',
                  title: '旧路径仿真节点',
                  pathNodeType: 'practice',
                  launchTarget: '//example.invalid/simulation',
                  estimatedTimeMinutes: 20,
                },
              ],
              resourceMix: { simulation: 1 },
              evidenceBasis: ['simulation-run'],
              limitations: [],
            },
          ],
        },
      },
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-legacy-simulation-without-launch-target-key',
    }), params);

    expect(response.status).toBe(409);
    expect(mocks.recordPathChoiceEvidence).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('rejects legacy option summaries when node type cannot be recovered', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
        policyBundle: {
          status: 'ready',
          paths: [
            {
              styleId: 'legacy-unknown-option',
              policyFamily: 'simulation-driven',
              nodeIds: ['legacy:unknown'],
              activeNodeIds: ['legacy:unknown'],
              nodeSummaries: [
                {
                  nodeId: 'legacy:unknown',
                  title: '无法恢复类型的旧节点',
                  pathNodeType: 'practice',
                  estimatedTimeMinutes: 10,
                },
              ],
              resourceMix: { simulation: 1 },
              evidenceBasis: ['simulation-run'],
              limitations: [],
            },
          ],
        },
      },
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-legacy-unknown-option-key',
    }), params);

    expect(response.status).toBe(409);
    expect(mocks.recordPathChoiceEvidence).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('rejects summary-only legacy external resource options without governed metadata', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
        policyBundle: {
          status: 'ready',
          paths: [
            {
              styleId: 'legacy-external-resource-option',
              policyFamily: 'simulation-driven',
              nodeIds: ['external-resource:legacy-paper'],
              activeNodeIds: ['external-resource:legacy-paper'],
              nodeSummaries: [
                {
                  nodeId: 'external-resource:legacy-paper',
                  title: '旧路径外部资料',
                  pathNodeType: 'external_resource',
                  estimatedTimeMinutes: 10,
                },
              ],
              resourceMix: { external_resource: 1 },
              evidenceBasis: ['external-resource-access'],
              limitations: [],
            },
          ],
        },
      },
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-legacy-external-resource-key',
    }), params);

    expect(response.status).toBe(409);
    expect(mocks.recordPathChoiceEvidence).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('rejects product option adoption when selected plan nodes are not executable', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
        policyBundle: {
          status: 'ready',
          paths: [
            {
              styleId: 'broken-option',
              policyFamily: 'simulation-driven',
              nodeIds: ['simulation:broken'],
              activeNodeIds: ['simulation:broken'],
              planNodes: [{ nodeId: 'simulation:broken', target: '/simulations/broken' }],
              resourceMix: { simulation: 1 },
              evidenceBasis: ['simulation-run'],
              limitations: [],
            },
          ],
        },
      },
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });

    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'choice-broken-option-key',
    }), params);

    expect(response.status).toBe(409);
    expect(mocks.recordPathChoiceEvidence).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('rejects empty path options while preserving original option ids for valid choices', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        policyBundle: {
          status: 'low-resource-fallback',
          paths: [
            {
              styleId: 'empty-low-resource',
              policyFamily: 'preference-matched',
              nodeIds: [],
              resourceMix: {},
              evidenceBasis: ['adaptive-learner-state'],
              limitations: ['policy-path-resource-missing'],
            },
            {
              styleId: 'foundation-remediation',
              policyFamily: 'foundation-remediation',
              nodeIds: ['knowledge-card:targets', 'arena-task:terminal'],
              activeNodeIds: ['knowledge-card:targets', 'arena-task:terminal'],
              planNodes: [
                { nodeId: 'knowledge-card:targets', type: 'knowledge_card', target: '/knowledge/cards/targets' },
                { nodeId: 'arena-task:terminal', type: 'arena_task', target: '/arena/tasks/terminal' },
              ],
              resourceMix: { knowledge_card: 1, arena_task: 1 },
              evidenceBasis: ['adaptive-learner-state'],
              limitations: ['terminal-validation-required'],
              terminalValidationNodeIds: ['arena-task:terminal'],
            },
          ],
        },
      },
      learnerStateRef: 'diagnosis-snapshot:server-owned',
      inputSnapshot: { diagnosisSnapshotRef: 'diagnosis-snapshot:input' },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });

    const emptyResponse = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-1',
      idempotencyKey: 'empty-choice-key',
    }), params);
    const validResponse = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-2',
      idempotencyKey: 'valid-choice-key',
    }), params);

    expect(emptyResponse.status).toBe(400);
    expect(validResponse.status).toBe(200);
    expect(mocks.recordPathChoiceEvidence).toHaveBeenCalledTimes(1);
    expect(mocks.recordPathChoiceEvidence).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      selectedStyleId: 'foundation-remediation',
      selectedPolicyFamily: 'foundation-remediation',
      idempotencyKey: 'valid-choice-key',
    }));
  });

  it('rejects path choice evidence for style ids outside the current path options', async () => {
    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'switch',
      selectedStyleId: 'unrelated-style',
      rejectedStyleIds: ['foundation-remediation'],
      idempotencyKey: 'choice-key',
    }), params);

    expect(response.status).toBe(400);
    expect(mocks.recordPathChoiceEvidence).not.toHaveBeenCalled();
  });

  it('rejects contradictory path choice and helpfulness payloads', async () => {
    const contradictory = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedStyleId: 'foundation-remediation',
      rejectedStyleIds: ['foundation-remediation'],
      idempotencyKey: 'choice-key',
    }), params);
    const helpfulnessWithRejected = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'helpfulness',
      selectedStyleId: 'foundation-remediation',
      rejectedStyleIds: ['simulation-driven'],
      helpful: true,
      idempotencyKey: 'helpful-key',
    }), params);

    expect(contradictory.status).toBe(400);
    expect(helpfulnessWithRejected.status).toBe(400);
    expect(mocks.recordPathChoiceEvidence).not.toHaveBeenCalled();
  });

  it('allows ai intervention path node execution to match planner resource types', async () => {
    configureSingleNodePath('node-1', 'ai_intervention', '/adaptive-learning/path-advisor', {
      goalId: 'control-correction',
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'ai_intervention',
      status: 'completed',
      idempotencyKey: 'exec-ai-intervention',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      nodeId: 'node-1',
      resourceType: 'ai_intervention',
      idempotencyKey: 'exec-ai-intervention',
    }));
  });

  it('allows registered non-control path quiz execution to write activity', async () => {
    for (const resourceType of ['quiz', 'handout', 'lesson_step']) {
      const nodeId = `registry:bode-${resourceType}`;
      configureSingleNodePath(nodeId, resourceType, `/interactive-learning/resources/bode-${resourceType}`);

      const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
        nodeId,
        resourceType,
        status: 'completed',
        idempotencyKey: `exec-bode-${resourceType}`,
      }), params);

      expect(response.status).toBe(200);
      expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        goalId: 'frequency-response-foundations',
        nodeId,
        resourceType,
        idempotencyKey: `exec-bode-${resourceType}`,
      }));
    }
  });

  it('rejects execution when resource type does not match the persisted path node', async () => {
    configureSingleNodePath('registry:bode-quiz', 'quiz', '/interactive-learning/resources/bode-quiz');

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'registry:bode-quiz',
      resourceType: 'handout',
      status: 'completed',
      idempotencyKey: 'exec-bode-quiz',
    }), params);

    expect(response.status).toBe(400);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
  });

  it('rejects execution when the current path node is missing from planNodes', async () => {
    configureSingleNodePath('registry:bode-quiz', 'quiz', '/interactive-learning/resources/bode-quiz', {
      includePlanNodes: false,
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'registry:bode-quiz',
      resourceType: 'quiz',
      status: 'completed',
      idempotencyKey: 'exec-bode-quiz',
    }), params);

    expect(response.status).toBe(400);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
  });

  it('requires governed access evidence before completing external resource nodes', async () => {
    configureSingleNodePath('external-resource:ocw-bode', 'external_resource', 'https://ocw.mit.edu/control/bode', {
      planNode: {
        pathNodeType: 'external_resource',
        externalResource: {
          source: 'MIT OCW',
          url: 'https://ocw.mit.edu/control/bode',
          estimatedTimeMinutes: 15,
          knowledgeCoverage: ['kn-bode'],
          applicableGoalId: 'frequency-response-foundations',
          evidenceUseStatus: 'explicit-access-required',
          privacyPolicy: 'student-visible',
        },
      },
    });

    const rejected = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'external-resource:ocw-bode',
      resourceType: 'external_resource',
      status: 'completed',
      idempotencyKey: 'external-missing-evidence',
      evidenceRefs: [{ kind: 'external_resource_access', id: 'client-forged-access' }],
    }), params);

    expect(rejected.status).toBe(400);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();

    const started = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'external-resource:ocw-bode',
      resourceType: 'external_resource',
      status: 'started',
      idempotencyKey: 'external-started',
    }), params);

    expect(started.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      nodeId: 'external-resource:ocw-bode',
      resourceType: 'external_resource',
      status: 'started',
      evidenceRefs: [expect.objectContaining({
        kind: 'LearningPathExternalResourceAccess',
        pathId: 'path-1',
        nodeId: 'external-resource:ocw-bode',
        userId: 'student-1',
        url: 'https://ocw.mit.edu/control/bode',
      })],
    }));

    mocks.recordPathNodeExecution.mockClear();
    mocks.prisma.learningPathExecution.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'exec-started',
        pathId: 'path-1',
        userId: 'student-1',
        nodeId: 'external-resource:ocw-bode',
        resourceType: 'external_resource',
        status: 'started',
        evidenceRefs: [{
          kind: 'LearningPathExternalResourceAccess',
          pathId: 'path-1',
          nodeId: 'external-resource:ocw-bode',
          userId: 'student-1',
          url: 'https://ocw.mit.edu/control/bode',
        }],
      });
    const accepted = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'external-resource:ocw-bode',
      resourceType: 'external_resource',
      status: 'completed',
      idempotencyKey: 'external-with-evidence',
    }), params);

    expect(accepted.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      nodeId: 'external-resource:ocw-bode',
      resourceType: 'external_resource',
      status: 'completed',
      evidenceRefs: [expect.objectContaining({
        kind: 'LearningPathExternalResourceAccess',
        evidenceSource: 'learning-path-execution',
        accessExecutionId: 'exec-started',
      })],
    }));
  });

  it('advances an external node only after started access and returns the ready next journey', async () => {
    const externalNode = {
      nodeId: 'external-resource:ocw-bode',
      title: '外部伯德图资料',
      type: 'external_resource',
      target: 'https://ocw.mit.edu/control/bode',
      status: 'current',
      readiness: { state: 'ready' },
      pathNodeType: 'external_resource',
      externalResource: {
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/bode',
        estimatedTimeMinutes: 15,
        knowledgeCoverage: ['kn-bode'],
        applicableGoalId: 'frequency-response-foundations',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      },
    };
    const nextNode = {
      nodeId: 'node-2',
      title: '回到平台练习',
      type: 'adaptive_quiz',
      target: '/assessment/adaptive-practice',
      status: 'next',
      readiness: { state: 'ready' },
    };
    const before = journeyPathRecord({
      goalId: 'frequency-response-foundations',
      currentNodeId: externalNode.nodeId,
      nodeIds: [externalNode.nodeId, nextNode.nodeId],
      pathPayload: {
        mainPathNodeIds: [externalNode.nodeId, nextNode.nodeId],
        planNodes: [externalNode, nextNode],
      },
      lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [], skippedNodeIds: [] },
    });
    const after = journeyPathRecord({
      goalId: 'frequency-response-foundations',
      currentNodeId: nextNode.nodeId,
      nodeIds: [externalNode.nodeId, nextNode.nodeId],
      pathPayload: {
        mainPathNodeIds: [externalNode.nodeId, nextNode.nodeId],
        planNodes: [{ ...externalNode, status: 'completed' }, { ...nextNode, status: 'current' }],
      },
      lastExecutionMetadata: { completedNodeIds: [externalNode.nodeId], failedNodeIds: [], skippedNodeIds: [] },
    });
    mocks.prisma.learningPath.findUnique
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    const startedExecution = {
      id: 'exec-external-started',
      pathId: 'path-1',
      userId: 'student-1',
      nodeId: externalNode.nodeId,
      resourceType: 'external_resource',
      status: 'started',
      evidenceRefs: [{
        kind: 'LearningPathExternalResourceAccess',
        pathId: 'path-1',
        nodeId: externalNode.nodeId,
        userId: 'student-1',
        url: externalNode.target,
      }],
      liftMetadata: { pathActivityKind: 'initial-completion' },
    };
    mocks.prisma.learningPathExecution.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(startedExecution);
    mocks.recordPathNodeExecution
      .mockResolvedValueOnce(startedExecution)
      .mockResolvedValueOnce({ ...startedExecution, id: 'exec-external-completed', status: 'completed' });

    const startedResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: externalNode.nodeId,
      resourceType: 'external_resource',
      status: 'started',
      idempotencyKey: 'external-journey-started',
      liftMetadata: { pathActivityKind: 'initial-completion' },
    }), params);
    const startedPayload = await startedResponse.json();

    expect(startedResponse.status).toBe(200);
    expect(startedPayload.journey.nextAction).toMatchObject({ state: 'blocked', nodeId: externalNode.nodeId });

    const completedResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: externalNode.nodeId,
      resourceType: 'external_resource',
      status: 'completed',
      idempotencyKey: 'external-journey-completed',
      liftMetadata: { pathActivityKind: 'initial-completion' },
    }), params);
    const completedPayload = await completedResponse.json();

    expect(completedResponse.status).toBe(200);
    expect(completedPayload.journey).toMatchObject({
      current: { nodeId: 'node-2' },
      progress: { completed: 1, total: 2 },
      nextAction: { state: 'ready', nodeId: 'node-2' },
    });
  });

  it('returns existing external-resource completion on idempotent replay after the path advances', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'frequency-response-foundations',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['external-resource:ocw-bode', 'node-2'],
      pathPayload: {
        mainPathNodeIds: ['external-resource:ocw-bode', 'node-2'],
        planNodes: [
          {
            nodeId: 'external-resource:ocw-bode',
            type: 'external_resource',
            target: 'https://ocw.mit.edu/control/bode',
            externalResource: {
              source: 'MIT OCW',
              url: 'https://ocw.mit.edu/control/bode',
              estimatedTimeMinutes: 15,
              knowledgeCoverage: ['kn-bode'],
              applicableGoalId: 'frequency-response-foundations',
              evidenceUseStatus: 'explicit-access-required',
              privacyPolicy: 'student-visible',
            },
          },
          { nodeId: 'node-2', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: ['external-resource:ocw-bode'] },
    });
    const existingExecution = {
      id: 'exec-external-completed',
      pathId: 'path-1',
      userId: 'student-1',
      idempotencyKey: 'external-resource-completion:path-1:external-resource:ocw-bode',
      nodeId: 'external-resource:ocw-bode',
      resourceType: 'external_resource',
      status: 'completed',
      completedAt: new Date('2026-06-04T10:00:00.000Z'),
    };
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValue(existingExecution);

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'external-resource:ocw-bode',
      resourceType: 'external_resource',
      status: 'completed',
      idempotencyKey: 'external-resource-completion:path-1:external-resource:ocw-bode',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.execution.id).toBe('exec-external-completed');
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('does not serve external resource launch through GET navigation probes', async () => {
    configureSingleNodePath('external-resource:ocw-bode', 'external_resource', 'https://ocw.mit.edu/control/bode', {
      planNode: {
        pathNodeType: 'external_resource',
        externalResource: {
          source: 'MIT OCW',
          url: 'https://ocw.mit.edu/control/bode',
          estimatedTimeMinutes: 15,
          knowledgeCoverage: ['kn-bode'],
          applicableGoalId: 'frequency-response-foundations',
          evidenceUseStatus: 'explicit-access-required',
          privacyPolicy: 'student-visible',
        },
      },
    });

    const response = await launchPathNode();

    expect(response.status).toBe(405);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
  });

  it('rejects external resource execution when metadata belongs to a different goal', async () => {
    configureSingleNodePath('external-resource:ocw-bode', 'external_resource', 'https://ocw.mit.edu/control/bode', {
      goalId: 'control-correction',
      planNode: {
        pathNodeType: 'external_resource',
        externalResource: {
          source: 'MIT OCW',
          url: 'https://ocw.mit.edu/control/bode',
          estimatedTimeMinutes: 15,
          knowledgeCoverage: ['kn-bode'],
          applicableGoalId: 'frequency-response-foundations',
          evidenceUseStatus: 'explicit-access-required',
          privacyPolicy: 'student-visible',
        },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'external-resource:ocw-bode',
      resourceType: 'external_resource',
      status: 'started',
      idempotencyKey: 'external-wrong-goal',
    }), params);

    expect(response.status).toBe(400);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
  });

  it('rejects external resource execution when governed metadata has non-positive estimated time', async () => {
    configureSingleNodePath('external-resource:ocw-bode', 'external_resource', 'https://ocw.mit.edu/control/bode', {
      planNode: {
        pathNodeType: 'external_resource',
        externalResource: {
          source: 'MIT OCW',
          url: 'https://ocw.mit.edu/control/bode',
          estimatedTimeMinutes: -5,
          knowledgeCoverage: ['kn-bode'],
          applicableGoalId: 'frequency-response-foundations',
          evidenceUseStatus: 'explicit-access-required',
          privacyPolicy: 'student-visible',
        },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'external-resource:ocw-bode',
      resourceType: 'external_resource',
      status: 'started',
      idempotencyKey: 'external-negative-time',
    }), params);

    expect(response.status).toBe(400);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
  });

  it('rejects missing server-owned Arena evidence without recording completion', async () => {
    configureSingleNodePath('arena-task:task-second-order-lead-pid', 'arena_task', '/arena/challenges/task-second-order-lead-pid', {
      goalId: 'control-correction',
      planNode: {
        sourceKind: 'arena_task',
        sourceRef: 'task-second-order-lead-pid',
      },
      terminalValidation: {
        nodeId: 'arena-task:task-second-order-lead-pid',
        state: 'pending',
        target: '/arena/challenges/task-second-order-lead-pid',
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'forged-terminal',
      simulationRef: {
        id: 'client-sim',
        official: true,
        status: 'completed',
        replayConfidence: 1,
      },
      arenaRef: {
        id: 'missing-arena-submission',
        kind: 'ArenaSubmission',
        provenance: 'official',
        official: true,
        valid: true,
        score: 100,
        replayConfidence: 1,
        hiddenEvaluation: { private: true },
      },
    }), params);

    expect(response.status).toBe(409);
    expect(mocks.prisma.arenaSubmission.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'missing-arena-submission',
        userId: 'student-1',
      }),
    }));
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(payload).toMatchObject({
      state: 'pending-result',
      journey: {
        nextAction: {
          state: expect.stringMatching(/^(blocked|pending-result)$/),
          href: null,
          reason: expect.any(String),
          recovery: { label: expect.any(String), href: expect.stringContaining('/assessment/adaptive-practice') },
        },
      },
    });
    expect(mocks.prisma.learningPath.findUnique).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(payload)).not.toMatch(/hidden|score|valid/i);
  });

  it('rejects an invalid official ArenaSubmission before any path node advances', async () => {
    configureSingleNodePath('arena-task:task-second-order-lead-pid', 'arena_task', '/arena/challenges/task-second-order-lead-pid', {
      goalId: 'control-correction',
      planNode: { sourceKind: 'arena_task', sourceRef: 'task-second-order-lead-pid' },
    });
    mocks.prisma.arenaSubmission.findFirst.mockResolvedValue({
      id: 'arena-invalid',
      taskId: 'task-second-order-lead-pid',
      userId: 'student-1',
      score: 0,
      valid: false,
      submittedAt: new Date('2026-07-11T01:00:00.000Z'),
      evaluationRun: { protocolVersion: 'v1', metrics: {}, metadata: {}, completedAt: new Date('2026-07-11T01:00:00.000Z') },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'invalid-arena-result',
      arenaRef: { id: 'arena-invalid' },
    }), params);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      state: 'pending-result',
      journey: { nextAction: { state: expect.stringMatching(/^(blocked|pending-result)$/), href: null } },
    });
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('returns a fresh pending journey when an Arena completion arrives before any result ref', async () => {
    configureSingleNodePath('arena-task:task-second-order-lead-pid', 'arena_task', '/arena/challenges/task-second-order-lead-pid', {
      goalId: 'control-correction',
      planNode: { sourceKind: 'arena_task', sourceRef: 'task-second-order-lead-pid' },
      terminalValidation: {
        nodeId: 'arena-task:task-second-order-lead-pid',
        state: 'pending',
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'arena-result-pending',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      state: 'pending-result',
      journey: {
        nextAction: {
          state: expect.stringMatching(/^(blocked|pending-result)$/),
          href: null,
          reason: expect.any(String),
          recovery: { label: expect.any(String), href: expect.any(String) },
        },
      },
    });
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(JSON.stringify(payload)).not.toMatch(/hidden|score|valid/i);
  });

  it('accepts a server-owned Arena preview only when terminal policy explicitly allows it', async () => {
    configureSingleNodePath('arena-task:task-second-order-lead-pid', 'arena_task', '/arena/challenges/task-second-order-lead-pid', {
      goalId: 'control-correction',
      planNode: { sourceKind: 'arena_task', sourceRef: 'task-second-order-lead-pid' },
      terminalValidation: {
        nodeId: 'arena-task:task-second-order-lead-pid',
        state: 'pending',
        policy: {
          allowPreviewValidation: true,
          requireOfficialArenaEvidence: false,
          minimumReplayConfidence: 0.7,
        },
      },
    });
    mocks.prisma.arenaSubmission.findFirst.mockResolvedValue(null);
    mocks.prisma.arenaVirtualSimulationRun.findFirst.mockResolvedValue({
      id: 'arena-preview-allowed',
      taskId: 'task-second-order-lead-pid',
      simulationRunId: 'simulation-run-preview',
      payload: { replay: { confidence: 0.91 }, summary: { settlingTime: 0.8 } },
      createdAt: new Date('2026-07-11T01:00:00.000Z'),
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'allowed-arena-preview',
      arenaRef: { id: 'arena-preview-allowed' },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'completed',
      arenaRef: expect.objectContaining({
        id: 'arena-preview-allowed',
        provenance: 'preview',
      }),
    }));
  });

  it('completes terminal validation from server-owned SimulationRun and ArenaSubmission records', async () => {
    useStructuredTerminalPath();
    mocks.prisma.simulationRun.findFirst.mockResolvedValue({
      id: 'sim-run-1',
      ownerUserId: 'student-1',
      runKind: 'course_validation',
      sourceDomain: 'control_workbench',
      sourceRefId: 'control-correction-step-response-lab',
      resourceId: 'control-correction-step-response-lab',
      taskSpecId: null,
      status: 'completed',
      summary: {
        replayConfidence: 0.84,
        metrics: { overshoot: 0.08, hiddenTraceScore: 999 },
      },
      protocolVersion: '1.0',
      completedAt: new Date('2026-06-04T09:59:00.000Z'),
    });
    mocks.prisma.arenaSubmission.findFirst.mockResolvedValue({
      id: 'arena-submission-1',
      taskId: 'task-second-order-lead-pid',
      userId: 'student-1',
      score: 86,
      valid: true,
      submittedAt: new Date('2026-06-04T10:00:00.000Z'),
      evaluationRun: {
        protocolVersion: 'template-whitebox-v1',
        metrics: { settlingTime: 0.9, hiddenScenarioWorst: 0.7 },
        metadata: { replayConfidence: 0.9, hiddenEvaluation: { private: true } },
        completedAt: new Date('2026-06-04T10:00:00.000Z'),
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'official-terminal',
      simulationRef: { id: 'sim-run-1' },
      arenaRef: { id: 'arena-submission-1' },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      simulationRef: expect.objectContaining({
        id: 'sim-run-1',
        provenance: 'official',
        replayConfidence: 0.84,
      }),
      arenaRef: expect.objectContaining({
        id: 'arena-submission-1',
        provenance: 'official',
        official: true,
        valid: true,
        replayConfidence: 0.9,
      }),
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'completed',
        terminalValidation: expect.objectContaining({
          state: 'completed',
          lowConfidenceMarkers: [],
        }),
      }),
    }));
    const executionCalls = JSON.stringify(mocks.recordPathNodeExecution.mock.calls);
    expect(executionCalls).not.toContain('hiddenScenarioWorst');
    expect(executionCalls).not.toContain('hiddenEvaluation');
  });

  it('rejects official ArenaSubmission records from a different terminal Arena task', async () => {
    useStructuredTerminalPath();
    mocks.prisma.simulationRun.findFirst.mockResolvedValue({
      id: 'sim-run-1',
      ownerUserId: 'student-1',
      runKind: 'course_validation',
      sourceDomain: 'control_workbench',
      sourceRefId: 'control-correction-step-response-lab',
      resourceId: 'control-correction-step-response-lab',
      taskSpecId: null,
      status: 'completed',
      summary: { replayConfidence: 0.84 },
      protocolVersion: '1.0',
      completedAt: new Date('2026-06-04T09:59:00.000Z'),
    });
    mocks.prisma.arenaSubmission.findFirst.mockResolvedValue({
      id: 'arena-submission-other-task',
      taskId: 'unrelated-task',
      userId: 'student-1',
      score: 100,
      valid: true,
      submittedAt: new Date('2026-06-04T10:00:00.000Z'),
      evaluationRun: {
        protocolVersion: 'template-whitebox-v1',
        metrics: { settlingTime: 0.9 },
        metadata: { replayConfidence: 0.95 },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'wrong-arena-task',
      simulationRef: { id: 'sim-run-1' },
      arenaRef: { id: 'arena-submission-other-task' },
    }), params);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      state: 'pending-result',
      journey: { nextAction: { state: expect.stringMatching(/^(blocked|pending-result)$/), href: null } },
    });
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('executes the canonical Arena identity against a verified Yang Fan legacy persisted target', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: '根轨迹_1_1',
      nodeIds: ['根轨迹_1_1'],
      pathPayload: {
        fixtureScope: 'yangfan-diagnostic-fixture.v1',
        mainPathNodeIds: ['根轨迹_1_1'],
        planNodes: [{
          nodeId: '根轨迹_1_1',
          type: 'arena_task',
          sourceKind: 'knowledge_graph',
          sourceRef: '根轨迹_1_1',
          target: '/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
        }],
      },
      terminalValidation: {
        nodeId: '根轨迹_1_1',
        state: 'pending',
      },
      lastExecutionMetadata: { completedNodeIds: [] },
    });
    mocks.prisma.arenaSubmission.findFirst.mockResolvedValue({
      id: 'arena-submission-yangfan',
      taskId: 'task-second-order-lead-pid',
      userId: 'student-1',
      score: 86,
      valid: true,
      submittedAt: new Date('2026-07-10T10:00:00.000Z'),
      evaluationRun: {
        protocolVersion: 'template-whitebox-v1',
        metrics: { settlingTime: 0.9 },
        metadata: { replayConfidence: 0.9 },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'verified-yangfan-legacy-arena',
      arenaRef: { id: 'arena-submission-yangfan' },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      nodeId: 'arena-task:task-second-order-lead-pid',
      arenaRef: expect.objectContaining({
        id: 'arena-submission-yangfan',
        taskId: 'task-second-order-lead-pid',
        provenance: 'official',
      }),
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'arena-task:task-second-order-lead-pid',
        terminalValidation: expect.objectContaining({
          nodeId: 'arena-task:task-second-order-lead-pid',
        }),
      }),
    }));
  });

  it('rejects the old Yang Fan Arena node id with an explicit canonical recovery target', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: '根轨迹_1_1',
      nodeIds: ['根轨迹_1_1'],
      pathPayload: {
        fixtureScope: 'yangfan-diagnostic-fixture.v1',
        mainPathNodeIds: ['根轨迹_1_1'],
        planNodes: [{
          nodeId: '根轨迹_1_1',
          type: 'arena_task',
          sourceKind: 'knowledge_graph',
          sourceRef: '根轨迹_1_1',
          target: '/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
        }],
      },
      terminalValidation: { nodeId: '根轨迹_1_1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: '根轨迹_1_1',
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'old-yangfan-arena-id',
      arenaRef: { id: 'arena-submission-yangfan' },
    }), params);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'Arena 路径节点身份已修复，请使用规范节点重试',
      canonicalNodeId: 'arena-task:task-second-order-lead-pid',
    });
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
  });

  it.each([
    ['arena-challenge-workbench', 'task-second-order-lead-pid'],
    ['arena-cruise-blackbox-workbench', 'task-cruise-roll-blackbox-identification'],
  ])('executes canonical Arena identity through verified legacy registry path %s', async (registryId, taskId) => {
    const legacyNodeId = `registry:${registryId}`;
    const canonicalNodeId = `arena-task:${taskId}`;
    mocks.prisma.learningPath.findUnique.mockResolvedValue(legacyRegistryDependentPath(registryId, taskId));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: canonicalNodeId,
      resourceType: 'arena_task',
      status: 'started',
      idempotencyKey: `verified-registry-${registryId}`,
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      nodeId: canonicalNodeId,
      resourceType: 'arena_task',
    }));
    const update = mocks.prisma.learningPath.update.mock.calls[0][0];
    expect(update).toMatchObject({
      data: {
        nodeIds: [canonicalNodeId, 'reflection:post-arena-review'],
        entryNodeId: canonicalNodeId,
        pathPayload: {
          graphContext: {
            limitations: [{ nodeId: legacyNodeId }],
            objectiveBoundaryDiagnostics: {
              selectedResourceMatches: [{ nodeId: legacyNodeId }],
            },
          },
          planNodes: expect.arrayContaining([
            expect.objectContaining({
              nodeId: 'reflection:post-arena-review',
              prerequisiteNodeIds: [canonicalNodeId],
              readiness: expect.objectContaining({
                requiredCompletedNodeIds: [canonicalNodeId],
                fallbackNodeIds: [canonicalNodeId],
                missingCompletedNodeIds: [canonicalNodeId],
              }),
            }),
          ]),
          activity: [
            expect.objectContaining({ nodeId: canonicalNodeId }),
            expect.objectContaining({ nodeIds: [canonicalNodeId] }),
          ],
          selectionHistory: [expect.objectContaining({ nodeId: canonicalNodeId })],
        },
        deviations: {
          update: [{
            where: { id: 'legacy-deviation-1' },
            data: {
              priorNodeId: canonicalNodeId,
              targetNodeId: canonicalNodeId,
            },
          }],
        },
      },
    });
  });

  it('persists legacy Arena aliases so a second read remains canonical', async () => {
    const legacyNodeId = 'registry:arena-challenge-workbench';
    const canonicalNodeId = 'arena-task:task-second-order-lead-pid';
    const initialPath = legacyRegistryDependentPath(
      'arena-challenge-workbench',
      'task-second-order-lead-pid',
    );
    mocks.prisma.learningPath.findUnique.mockResolvedValue(initialPath);

    const firstResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: canonicalNodeId,
      resourceType: 'arena_task',
      status: 'started',
      idempotencyKey: 'legacy-registry-first-read',
    }), params);

    expect(firstResponse.status).toBe(200);
    const firstData = mocks.prisma.learningPath.update.mock.calls[0][0].data;
    expect(firstData).toMatchObject({
      nodeIds: [canonicalNodeId, 'reflection:post-arena-review'],
      entryNodeId: canonicalNodeId,
    });
    const deviationUpdates = firstData.deviations.update as Array<{
      where: { id: string };
      data: { priorNodeId: string; targetNodeId: string };
    }>;
    const persistedPath = {
      ...initialPath,
      ...firstData,
      deviations: initialPath.deviations.map((deviation) => ({
        ...deviation,
        ...deviationUpdates.find((update) => update.where.id === deviation.id)?.data,
      })),
    };

    mocks.prisma.learningPath.update.mockClear();
    mocks.prisma.learningPath.findUnique.mockResolvedValue(persistedPath);
    const secondResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: canonicalNodeId,
      resourceType: 'arena_task',
      status: 'started',
      idempotencyKey: 'legacy-registry-second-read',
    }), params);

    expect(secondResponse.status).toBe(200);
    const secondData = mocks.prisma.learningPath.update.mock.calls[0][0].data;
    const { graphContext, ...pathPayloadWithoutGraphContext } = secondData.pathPayload;
    expect(JSON.stringify({
      nodeIds: secondData.nodeIds,
      entryNodeId: secondData.entryNodeId,
      currentNodeId: secondData.currentNodeId,
      pathPayload: pathPayloadWithoutGraphContext,
      deviationUpdates: secondData.deviations,
    })).not.toContain(legacyNodeId);
    expect(graphContext).toMatchObject({
      limitations: [{ nodeId: legacyNodeId }],
      objectiveBoundaryDiagnostics: {
        selectedResourceMatches: [{ nodeId: legacyNodeId }],
      },
    });
  });

  it('unlocks a dependent node after completing a canonicalized legacy registry Arena node', async () => {
    const legacyNodeId = 'registry:arena-challenge-workbench';
    const canonicalNodeId = 'arena-task:task-second-order-lead-pid';
    mocks.prisma.learningPath.findUnique.mockResolvedValue(
      legacyRegistryDependentPath('arena-challenge-workbench', 'task-second-order-lead-pid'),
    );
    mocks.prisma.arenaSubmission.findFirst.mockResolvedValue({
      id: 'arena-registry-completion',
      taskId: 'task-second-order-lead-pid',
      userId: 'student-1',
      score: 86,
      valid: true,
      submittedAt: new Date('2026-07-11T01:00:00.000Z'),
      evaluationRun: { protocolVersion: 'v1', metrics: {}, metadata: {}, completedAt: new Date('2026-07-11T01:00:00.000Z') },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: canonicalNodeId,
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'complete-verified-registry-arena',
      arenaRef: { id: 'arena-registry-completion' },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        currentNodeId: 'reflection:post-arena-review',
        pathPayload: expect.objectContaining({
          planNodes: expect.arrayContaining([
            expect.objectContaining({
              nodeId: 'reflection:post-arena-review',
              status: 'current',
              prerequisiteNodeIds: [canonicalNodeId],
              readiness: expect.objectContaining({
                state: 'ready',
                missingCompletedNodeIds: [],
              }),
            }),
          ]),
        }),
      }),
    }));
  });

  it.each([
    ['arena-challenge-workbench', 'task-second-order-lead-pid'],
    ['arena-cruise-blackbox-workbench', 'task-cruise-roll-blackbox-identification'],
  ])('returns canonicalNodeId for verified legacy registry request %s', async (registryId, taskId) => {
    const legacyNodeId = `registry:${registryId}`;
    configureSingleNodePath(legacyNodeId, 'arena_task', `/arena/challenges/${taskId}`, {
      goalId: 'control-correction',
      planNode: {
        sourceKind: 'resource_registry',
        sourceRef: registryId,
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: legacyNodeId,
      resourceType: 'arena_task',
      status: 'started',
      idempotencyKey: `legacy-registry-${registryId}`,
    }), params);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'Arena 路径节点身份已修复，请使用规范节点重试',
      canonicalNodeId: `arena-task:${taskId}`,
    });
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
  });

  it('canonically replays an existing legacy-id execution without writing the old identity', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1', userId: 'student-1', classId: 'class-1', goalId: 'control-correction',
      pathStatus: 'active', currentNodeId: '根轨迹_1_1', nodeIds: ['根轨迹_1_1'],
      pathPayload: {
        fixtureScope: 'yangfan-diagnostic-fixture.v1',
        mainPathNodeIds: ['根轨迹_1_1'],
        planNodes: [{
          nodeId: '根轨迹_1_1', type: 'arena_task', sourceKind: 'knowledge_graph',
          sourceRef: '根轨迹_1_1', target: '/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
        }],
      },
      terminalValidation: { nodeId: '根轨迹_1_1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValue({
      id: 'legacy-execution', nodeId: '根轨迹_1_1', resourceType: 'arena_task', status: 'completed',
      evidenceRefs: [], liftMetadata: {}, simulationRef: null,
      arenaRef: { id: 'arena-submission-yangfan' }, idempotencyKey: 'legacy-replay',
    });
    mocks.prisma.arenaSubmission.findFirst.mockResolvedValue({
      id: 'arena-submission-yangfan', taskId: 'task-second-order-lead-pid', userId: 'student-1',
      score: 86, valid: true, submittedAt: new Date('2026-07-10T10:00:00.000Z'),
      evaluationRun: { protocolVersion: 'v1', metrics: {}, metadata: { replayConfidence: 0.9 } },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'legacy-replay',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      nodeId: 'arena-task:task-second-order-lead-pid',
    }));
  });

  it.each([
    ['generic target', {
      nodeId: 'arena-task:legacy',
      sourceKind: 'arena_task',
      sourceRef: 'legacy',
      target: '/arena',
    }, 'generic-arena-target'],
    ['unknown task', {
      nodeId: 'arena-task:unknown-task',
      sourceKind: 'arena_task',
      sourceRef: 'unknown-task',
      target: '/arena/challenges/unknown-task',
    }, 'unknown-arena-task'],
  ])('blocks persisted Arena execution with a %s', async (_label, planNode, reason) => {
    configureSingleNodePath(planNode.nodeId, 'arena_task', planNode.target, {
      goalId: 'control-correction',
      planNode,
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: planNode.nodeId,
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: `blocked-${reason}`,
      arenaRef: { id: 'arena-submission-1' },
    }), params);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'Arena 路径目标不可执行',
      reason,
    });
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.arenaSubmission.findFirst).not.toHaveBeenCalled();
  });

  it('rejects Arena preview records from a different terminal Arena task', async () => {
    useStructuredTerminalPath();
    mocks.prisma.simulationRun.findFirst.mockResolvedValue({
      id: 'sim-run-1',
      ownerUserId: 'student-1',
      runKind: 'course_validation',
      sourceDomain: 'control_workbench',
      sourceRefId: 'control-correction-step-response-lab',
      resourceId: 'control-correction-step-response-lab',
      taskSpecId: null,
      status: 'completed',
      summary: { replayConfidence: 0.84 },
      protocolVersion: '1.0',
      completedAt: new Date('2026-06-04T09:59:00.000Z'),
    });
    mocks.prisma.arenaSubmission.findFirst.mockResolvedValue(null);
    mocks.prisma.arenaVirtualSimulationRun.findFirst.mockResolvedValue({
      id: 'arena-preview-other-task',
      taskId: 'unrelated-task',
      simulationRunId: 'sim-run-1',
      payload: { replay: { confidence: 0.92 }, summary: { settlingTime: 0.8 } },
      createdAt: new Date('2026-06-04T10:00:00.000Z'),
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'wrong-preview-task',
      simulationRef: { id: 'sim-run-1' },
      arenaRef: { id: 'arena-preview-other-task' },
    }), params);

    expect(response.status).toBe(409);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('rejects SimulationRun records from outside the path simulation source', async () => {
    useStructuredTerminalPath();
    mocks.prisma.simulationRun.findFirst.mockResolvedValue({
      id: 'sim-run-other-source',
      ownerUserId: 'student-1',
      runKind: 'course_validation',
      sourceDomain: 'control_workbench',
      sourceRefId: 'unrelated-simulation',
      resourceId: 'unrelated-simulation',
      taskSpecId: null,
      status: 'completed',
      summary: { replayConfidence: 0.94 },
      protocolVersion: '1.0',
      completedAt: new Date('2026-06-04T09:59:00.000Z'),
    });
    mocks.prisma.arenaSubmission.findFirst.mockResolvedValue({
      id: 'arena-submission-1',
      taskId: 'task-second-order-lead-pid',
      userId: 'student-1',
      score: 86,
      valid: true,
      submittedAt: new Date('2026-06-04T10:00:00.000Z'),
      evaluationRun: {
        protocolVersion: 'template-whitebox-v1',
        metrics: { settlingTime: 0.9 },
        metadata: { replayConfidence: 0.9 },
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
      status: 'completed',
      idempotencyKey: 'wrong-simulation-source',
      simulationRef: { id: 'sim-run-other-source' },
      arenaRef: { id: 'arena-submission-1' },
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      simulationRef: expect.objectContaining({
        id: 'sim-run-other-source',
        provenance: 'unknown',
        status: 'unverified',
        mismatchReason: 'simulation-scope-mismatch',
      }),
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'fallback',
        terminalValidation: expect.objectContaining({
          state: 'low-confidence',
          lowConfidenceMarkers: expect.arrayContaining(['simulation-replay-confidence-missing']),
        }),
      }),
    }));
  });

  it('refreshes the owner feature cache after teacher intervention writes', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await intervenePath(post('http://localhost/api/learning-paths/path-1/interventions', {
      interventionKind: 'hint',
      suggestedAction: 'review-root-locus',
      privacySafeSummary: '建议回看根轨迹规则。',
      studentOutcome: 'accepted',
      idempotencyKey: 'int-key',
    }), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      intervention: {
        id: 'int-1',
        interventionKind: 'hint',
        studentOutcome: 'accepted',
        privacySafeSummary: '建议回看根轨迹规则。',
      },
      cacheRefresh: 'completed',
    });
    expect(mocks.recordPathIntervention).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'student-1',
    }));
    expect(mocks.refreshStudentEvidenceFeatureCache).toHaveBeenCalledWith(expect.anything(), 'student-1');
  });

  it('returns pending cache refresh instead of failing a successful path write', async () => {
    mocks.refreshStudentEvidenceFeatureCache.mockRejectedValue(new Error('cache unavailable'));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'exec-key',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      execution: { id: 'exec-1' },
      cacheRefresh: 'pending',
    });
  });

  it('requires idempotency keys for path evidence writes', async () => {
    const executionResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
    }), params);
    const deviationResponse = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'skip',
      priorNodeId: 'node-1',
    }), params);

    expect(executionResponse.status).toBe(400);
    expect(deviationResponse.status).toBe(400);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.recordPathDeviation).not.toHaveBeenCalled();
  });

  it('prevents students from writing teacher-scoped interventions', async () => {
    const response = await intervenePath(post('http://localhost/api/learning-paths/path-1/interventions', {
      interventionKind: 'hint',
      suggestedAction: 'review-root-locus',
      privacySafeSummary: '建议回看根轨迹规则。',
      idempotencyKey: 'int-key',
    }), params);

    expect(response.status).toBe(403);
    expect(mocks.recordPathIntervention).not.toHaveBeenCalled();
    expect(mocks.refreshStudentEvidenceFeatureCache).not.toHaveBeenCalled();
  });

  it('rejects malformed execution writes before persistence', async () => {
    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'outside-node',
      resourceType: 'simulation',
      status: 'done',
      idempotencyKey: 'exec-key',
    }), params);

    expect(response.status).toBe(400);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
  });

  it('rejects new execution writes for non-current path nodes', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      nodeIds: ['node-1', 'node-2'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'simulation', target: '/simulations/lng' },
        ],
      },
      terminalValidation: { nodeId: 'node-2', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-2',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'new-node-2',
    }), params);

    expect(response.status).toBe(409);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('fills the parent path update on idempotent execution retry when the path still points at that node', async () => {
    const existingExecution = {
      id: 'exec-existing',
      pathId: 'path-1',
      idempotencyKey: 'exec-key',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      completedAt: new Date('2026-06-04T10:00:00.000Z'),
    };
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValue(existingExecution);
    mocks.recordPathNodeExecution.mockResolvedValueOnce(existingExecution);

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'exec-key',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.execution.id).toBe('exec-existing');
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: 'exec-key',
      status: 'completed',
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        lastExecutionMetadata: expect.objectContaining({
          lastExecution: expect.objectContaining({ status: 'completed' }),
        }),
      }),
    }));
  });

  it.each([
    {
      label: 'node identity',
      existing: { nodeId: 'node-1', resourceType: 'knowledge_card', status: 'completed' },
      body: { nodeId: 'outside-node', resourceType: 'knowledge_card', status: 'completed' },
    },
    {
      label: 'resource type',
      existing: { nodeId: 'node-1', resourceType: 'knowledge_card', status: 'completed' },
      body: { nodeId: 'node-1', resourceType: 'simulation', status: 'completed' },
    },
    {
      label: 'execution status',
      existing: { nodeId: 'node-1', resourceType: 'knowledge_card', status: 'started' },
      body: { nodeId: 'node-1', resourceType: 'knowledge_card', status: 'completed' },
    },
  ])('rejects an idempotency replay with conflicting $label before repair or advancement', async ({ existing, body }) => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue(journeyPathRecord());
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValue({
      id: 'exec-existing',
      pathId: 'path-1',
      idempotencyKey: 'exec-key',
      ...existing,
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      ...body,
      idempotencyKey: 'exec-key',
    }), params);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: '幂等键已绑定到不同的执行请求' });
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
    expect(mocks.refreshStudentEvidenceFeatureCache).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns an idempotent older-node replay without governed activity metadata without re-emitting evidence', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'simulation', target: '/simulations/lng' },
        ],
      },
      terminalValidation: { nodeId: 'node-2', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'] },
    });
    const existingExecution = {
      id: 'exec-existing',
      pathId: 'path-1',
      idempotencyKey: 'exec-key',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
    };
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValue(existingExecution);
    mocks.recordPathNodeExecution.mockResolvedValueOnce(existingExecution);

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'exec-key',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.execution.id).toBe('exec-existing');
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('preserves return replays and does not complete checkpoint retries without answer refs', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'checkpoint', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: ['node-2'] },
    });
    const existingReturn = {
      id: 'exec-return-existing',
      pathId: 'path-1',
      idempotencyKey: 'return-key',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      liftMetadata: { pathActivityKind: 'return-to-skipped' },
    };
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValueOnce(existingReturn);

    const returnResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      idempotencyKey: 'return-key',
      liftMetadata: { pathActivityKind: 'return-to-skipped' },
    }), params);

    expect(returnResponse.status).toBe(200);
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();

    const existingCheckpoint = {
      id: 'exec-checkpoint-existing',
      pathId: 'path-1',
      idempotencyKey: 'checkpoint-key',
      nodeId: 'node-2',
      resourceType: 'checkpoint',
      status: 'completed',
      liftMetadata: { pathActivityKind: 'checkpoint-pass' },
      completedAt: new Date('2026-06-04T10:30:00.000Z'),
    };
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValueOnce(existingCheckpoint);
    mocks.recordPathNodeExecution.mockResolvedValueOnce(existingCheckpoint);

    const checkpointResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-2',
      resourceType: 'checkpoint',
      status: 'completed',
      idempotencyKey: 'checkpoint-key',
      liftMetadata: { pathActivityKind: 'checkpoint-pass' },
    }), params);

    expect(checkpointResponse.status).toBe(200);
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastExecutionMetadata: expect.objectContaining({
          lastExecution: expect.objectContaining({
            nodeId: 'node-2',
            status: 'started',
            completedAt: null,
          }),
        }),
      }),
    }));
  });

  it('returns invalid idempotent historical return without re-emitting execution evidence', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [] },
    });
    mocks.prisma.learningPathDeviation.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValueOnce({
      id: 'exec-return-existing',
      pathId: 'path-1',
      idempotencyKey: 'return-key',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      liftMetadata: {
        pathActivityKind: 'return-to-skipped',
        rawClientPayload: 'must-not-be-re-emitted',
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      idempotencyKey: 'return-key',
      liftMetadata: { pathActivityKind: 'return-to-skipped' },
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.execution.id).toBe('exec-return-existing');
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('returns idempotent historical executions without governed activity metadata before re-emitting evidence', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', type: 'simulation', target: '/simulations/cruise' },
          { nodeId: 'node-2', type: 'adaptive_quiz', target: '/assessment/adaptive-practice' },
        ],
      },
      terminalValidation: { nodeId: null, state: 'not-required' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [] },
    });
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValueOnce({
      id: 'exec-old-history',
      pathId: 'path-1',
      idempotencyKey: 'old-history-key',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      liftMetadata: { rawLegacyPayload: true },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'old-history-key',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.execution.id).toBe('exec-old-history');
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('returns a fresh persisted journey after a new completion advances the path', async () => {
    const before = journeyPathRecord();
    const after = journeyPathRecord({
      currentNodeId: 'node-2',
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [], skippedNodeIds: [] },
    });
    mocks.prisma.learningPath.findUnique
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'knowledge_card',
      status: 'completed',
      idempotencyKey: 'journey-new-completion',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.journey).toMatchObject({
      current: { nodeId: 'node-2' },
      progress: { completed: 1, total: 2 },
      nextAction: { state: 'ready', nodeId: 'node-2' },
    });
    expect(mocks.prisma.learningPath.findUnique).toHaveBeenCalledTimes(2);
  });

  it('returns the immediate pending node when the fresh update keeps the completed current id', async () => {
    const before = journeyPathRecord();
    const after = journeyPathRecord({
      currentNodeId: 'node-1',
      nodeIds: ['node-1', 'node-2', 'node-3'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
        planNodes: [
          { nodeId: 'node-1', title: '知识回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed' },
          {
            nodeId: 'node-2',
            title: '等待仿真结果',
            type: 'control_workbench',
            target: '/interactive-learning/control-workbench',
            status: 'locked',
            readiness: { state: 'evidence-needed', missingOutcomeRefs: ['simulation_run:one'] },
          },
          { nodeId: 'node-3', title: '后续练习', type: 'adaptive_quiz', target: '/assessment/adaptive-practice', status: 'next', readiness: { state: 'ready' } },
        ],
      },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [], skippedNodeIds: [] },
    });
    mocks.prisma.learningPath.findUnique
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'knowledge_card',
      status: 'completed',
      idempotencyKey: 'journey-pending-after-update',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.journey).toMatchObject({
      current: { nodeId: 'node-2' },
      nextAction: { state: 'pending-result', nodeId: 'node-2', href: null },
    });
  });

  it('persists path completion when every node is complete and terminal validation is not required', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue(journeyPathRecord({
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        planNodes: [
          { nodeId: 'node-1', title: '知识回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'current', readiness: { state: 'ready' } },
        ],
      },
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'knowledge_card',
      status: 'completed',
      idempotencyKey: 'journey-non-terminal-complete',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pathStatus: 'completed' }),
    }));
  });

  it('does not persist path completion when a remaining node was only skipped', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue(journeyPathRecord({
      currentNodeId: 'node-1',
      lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [], skippedNodeIds: ['node-2'] },
    }));

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'knowledge_card',
      status: 'completed',
      idempotencyKey: 'journey-skipped-not-complete',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pathStatus: 'active' }),
    }));
  });

  it('repairs the parent path on a current-node replay and returns the fresh journey once', async () => {
    const before = journeyPathRecord();
    const after = journeyPathRecord({
      currentNodeId: 'node-2',
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [], skippedNodeIds: [] },
    });
    const existing = {
      id: 'exec-existing-current',
      pathId: 'path-1',
      idempotencyKey: 'journey-parent-repair',
      nodeId: 'node-1',
      resourceType: 'knowledge_card',
      status: 'completed',
      completedAt: new Date('2026-07-10T10:00:00.000Z'),
      liftMetadata: { pathActivityKind: 'initial-completion' },
      evidenceRefs: [],
    };
    mocks.prisma.learningPath.findUnique
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValueOnce(existing);
    mocks.recordPathNodeExecution.mockResolvedValueOnce(existing);

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'knowledge_card',
      status: 'completed',
      idempotencyKey: 'journey-parent-repair',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.journey.nextAction).toMatchObject({ state: 'ready', nodeId: 'node-2' });
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledTimes(1);
  });

  it('returns the current authoritative journey for a historical replay without advancing again', async () => {
    const current = journeyPathRecord({
      currentNodeId: 'node-2',
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [], skippedNodeIds: [] },
    });
    mocks.prisma.learningPath.findUnique.mockResolvedValue(current);
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValueOnce({
      id: 'exec-existing-history',
      pathId: 'path-1',
      idempotencyKey: 'journey-historical-replay',
      nodeId: 'node-1',
      resourceType: 'knowledge_card',
      status: 'completed',
      liftMetadata: { rawLegacyPayload: true },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'knowledge_card',
      status: 'completed',
      idempotencyKey: 'journey-historical-replay',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.journey).toMatchObject({
      current: { nodeId: 'node-2' },
      nextAction: { state: 'ready', nodeId: 'node-2' },
    });
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
    expect(mocks.prisma.learningPath.update).not.toHaveBeenCalled();
  });

  it('rejects malformed deviation writes before persistence', async () => {
    const response = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'manual_jump',
      priorNodeId: 'outside-node',
      evidenceConfidence: 'certain',
      idempotencyKey: 'dev-key',
    }), params);

    expect(response.status).toBe(400);
    expect(mocks.recordPathDeviation).not.toHaveBeenCalled();
  });

  it('rejects read and writes when the feature flag is disabled', async () => {
    process.env.CONTROL_CORRECTION_PATH_ROUNDS_ENABLED = 'false';

    const readResponse = await readPath(new Request('http://localhost/api/learning-paths/path-1'), params);
    const executionResponse = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
    }), params);

    expect(readResponse.status).toBe(503);
    expect(executionResponse.status).toBe(503);
    expect(mocks.prisma.learningPath.findUnique).not.toHaveBeenCalled();
    expect(mocks.recordPathNodeExecution).not.toHaveBeenCalled();
  });

  it('rejects legacy or non-control-correction paths on new route contracts', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'legacy-goal',
      pathStatus: 'legacy',
      nodeIds: ['node-1'],
      pathPayload: { mainPathNodeIds: ['node-1'] },
    });

    const readResponse = await readPath(new Request('http://localhost/api/learning-paths/path-1'), params);
    const deviationResponse = await deviatePath(post('http://localhost/api/learning-paths/path-1/deviations', {
      deviationType: 'skip',
    }), params);

    expect(readResponse.status).toBe(404);
    expect(deviationResponse.status).toBe(404);
    expect(mocks.readControlCorrectionPathRound).not.toHaveBeenCalled();
    expect(mocks.recordPathDeviation).not.toHaveBeenCalled();
  });
});
