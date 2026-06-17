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

function useStructuredAdaptiveAssessmentPath() {
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
            missingOutcomeRefs: ['adaptive_assessment:answer-1'],
          },
        },
      ],
    },
    terminalValidation: { nodeId: null, state: 'not-required' },
    lastExecutionMetadata: { completedNodeIds: [] },
  });
}

describe('learning path round API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      classId: 'class-1',
      goalId: 'control-correction',
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
        pathStatus: { in: ['active', 'fallback', 'completed'] },
      },
      select: {
        id: true,
        userId: true,
        classId: true,
        goalId: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    expect(mocks.readControlCorrectionPathRound).toHaveBeenCalledWith(expect.anything(), {
      pathId: 'path-1',
      userId: 'student-1',
    });
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
      lastExecutionMetadata: { completedNodeIds: ['node-1'], skippedNodeIds: [] },
    });
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
      lastExecutionMetadata: { completedNodeIds: ['node-1'], skippedNodeIds: [] },
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

  it('adopts the selected product option as the executable path', async () => {
    const response = await choosePath(post('http://localhost/api/learning-paths/path-1/choices', {
      action: 'selection',
      selectedOptionId: 'path-option-2',
      rejectedOptionIds: ['path-option-1'],
      idempotencyKey: 'choice-adopt-option-key',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.pathUpdate).toMatchObject({
      selectedOptionId: 'path-option-2',
      selectedStyleId: 'simulation-driven',
      currentNodeId: 'arena-task:terminal',
      nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
    });
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        nodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
        currentNodeId: 'arena-task:terminal',
        pathPayload: expect.objectContaining({
          selectedOptionId: 'path-option-2',
          selectedStyleId: 'simulation-driven',
          selectedPolicyFamily: 'simulation-driven',
          currentNodeId: 'arena-task:terminal',
          mainPathNodeIds: ['simulation:control-correction-step-response-lab', 'arena-task:terminal'],
          planNodes: [
            expect.objectContaining({
              nodeId: 'simulation:control-correction-step-response-lab',
              type: 'simulation',
            }),
            expect.objectContaining({
              nodeId: 'arena-task:terminal',
              type: 'arena_task',
              status: 'current',
            }),
          ],
        }),
        lastExecutionMetadata: expect.objectContaining({
          activeNodeId: 'arena-task:terminal',
          selectedOptionId: 'path-option-2',
          selectedStyleId: 'simulation-driven',
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
    mocks.prisma.learningPath.findUnique
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        pathPayload: {
          ...initialPathPayload,
          selectionHistory: latestSelectionHistory,
          activity: latestActivity,
        },
        lastExecutionMetadata: { completedNodeIds: [], activeNodeId: 'node-1' },
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
    mocks.prisma.learningPath.findUnique
      .mockResolvedValueOnce({
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
                nodeIds: ['simulation:legacy-step-lab', 'arena-task:legacy-terminal'],
                activeNodeIds: ['simulation:legacy-step-lab'],
                nodeSummaries: [
                  {
                    nodeId: 'simulation:legacy-step-lab',
                    title: '旧路径仿真节点',
                    pathNodeType: 'practice',
                    estimatedTimeMinutes: 20,
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
      })
      .mockResolvedValueOnce({
        pathPayload: {
          mainPathNodeIds: ['node-1'],
          planNodes: [{ nodeId: 'node-1', type: 'simulation', target: '/simulations/current' }],
        },
        lastExecutionMetadata: { completedNodeIds: [] },
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
        nodeIds: ['simulation:legacy-step-lab', 'arena-task:legacy-terminal'],
        currentNodeId: 'simulation:legacy-step-lab',
        pathPayload: expect.objectContaining({
          mainPathNodeIds: ['simulation:legacy-step-lab', 'arena-task:legacy-terminal'],
          planNodes: [
            expect.objectContaining({
              nodeId: 'simulation:legacy-step-lab',
              type: 'simulation',
              target: '/simulations/legacy-step-lab',
              status: 'current',
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

  it('does not let clients forge official terminal Arena evidence', async () => {
    configureSingleNodePath('node-1', 'arena_task', '/arena/challenges/task-second-order-lead-pid', {
      goalId: 'control-correction',
      terminalValidation: {
        nodeId: 'node-1',
        state: 'pending',
        target: '/arena/challenges/task-second-order-lead-pid',
      },
    });

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
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

    expect(response.status).toBe(200);
    expect(mocks.prisma.arenaSubmission.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'missing-arena-submission',
        userId: 'student-1',
      }),
    }));
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      arenaRef: expect.objectContaining({
        id: 'missing-arena-submission',
        provenance: 'unknown',
      }),
      simulationRef: expect.objectContaining({
        id: 'client-sim',
        provenance: 'unknown',
      }),
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'fallback',
        terminalValidation: expect.objectContaining({
          state: 'low-confidence',
          lowConfidenceMarkers: expect.arrayContaining([
            'arena-official-evidence-missing',
            'arena-replay-confidence-missing',
          ]),
        }),
      }),
    }));
    const executionCalls = JSON.stringify(mocks.recordPathNodeExecution.mock.calls);
    expect(executionCalls).not.toContain('hiddenEvaluation');
    expect(executionCalls).not.toContain('"score":100');
    expect(executionCalls).not.toContain('"valid":true');
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

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      arenaRef: expect.objectContaining({
        id: 'arena-submission-other-task',
        provenance: 'unknown',
        official: false,
        mismatchReason: 'arena-task-mismatch',
      }),
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'fallback',
        terminalValidation: expect.objectContaining({
          state: 'low-confidence',
          lowConfidenceMarkers: expect.arrayContaining(['arena-official-evidence-missing']),
        }),
      }),
    }));
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

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      arenaRef: expect.objectContaining({
        id: 'arena-preview-other-task',
        provenance: 'unknown',
        official: false,
        mismatchReason: 'arena-task-mismatch',
      }),
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'fallback',
      }),
    }));
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

  it('uses the existing execution payload when an idempotency key is reused with a different status', async () => {
    const existingExecution = {
      id: 'exec-existing',
      pathId: 'path-1',
      idempotencyKey: 'exec-key',
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'started',
      startedAt: new Date('2026-06-04T10:00:00.000Z'),
    };
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValue(existingExecution);
    mocks.recordPathNodeExecution.mockResolvedValueOnce(existingExecution);

    const response = await executePath(post('http://localhost/api/learning-paths/path-1/execute', {
      nodeId: 'node-1',
      resourceType: 'simulation',
      status: 'completed',
      completedAt: '2026-06-04T10:10:00.000Z',
      idempotencyKey: 'exec-key',
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: 'exec-key',
      status: 'started',
      completedAt: null,
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathStatus: 'active',
        lastExecutionMetadata: expect.objectContaining({
          lastExecution: expect.objectContaining({
            status: 'started',
            completedAt: null,
          }),
        }),
      }),
    }));
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

  it('preserves completed return replays and repairs checkpoint retries', async () => {
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
            status: 'completed',
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
