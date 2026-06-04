import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  persistControlCorrectionPathRound: vi.fn(),
  readControlCorrectionPathRound: vi.fn(),
  recordPathNodeExecution: vi.fn(),
  recordPathDeviation: vi.fn(),
  recordPathIntervention: vi.fn(),
  refreshStudentEvidenceFeatureCache: vi.fn(),
  prisma: {
    learningPath: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    learningPathExecution: {
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
    persistControlCorrectionPathRound: mocks.persistControlCorrectionPathRound,
    readControlCorrectionPathRound: mocks.readControlCorrectionPathRound,
    recordPathNodeExecution: mocks.recordPathNodeExecution,
    recordPathDeviation: mocks.recordPathDeviation,
    recordPathIntervention: mocks.recordPathIntervention,
  };
});

vi.mock('@/lib/data-governance/student-evidence-feature-cache', () => ({
  refreshStudentEvidenceFeatureCache: mocks.refreshStudentEvidenceFeatureCache,
}));

import { POST as planPath } from '../plan/route';
import { GET as readPath } from '../[id]/route';
import { POST as executePath } from '../[id]/execute/route';
import { POST as deviatePath } from '../[id]/deviations/route';
import { POST as intervenePath } from '../[id]/interventions/route';

const params = { params: Promise.resolve({ id: 'path-1' }) };

function post(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
      pathPayload: { mainPathNodeIds: ['node-1'] },
      terminalValidation: { nodeId: 'node-1', state: 'pending' },
      lastExecutionMetadata: { completedNodeIds: [] },
    });
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({ userId: 'student-1', classId: 'class-1' });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.learningPath.update.mockResolvedValue({ id: 'path-1' });
    mocks.prisma.learningPathExecution.findFirst.mockResolvedValue(null);
    mocks.persistControlCorrectionPathRound.mockResolvedValue({ id: 'path-1' });
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
    mocks.refreshStudentEvidenceFeatureCache.mockResolvedValue({ userId: 'student-1' });
  });

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
      idempotencyKey: 'dev-key',
    }), params);

    expect(executionResponse.status).toBe(200);
    expect(deviationResponse.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: 'exec-key',
    }));
    expect(mocks.prisma.learningPath.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        terminalValidation: true,
        lastExecutionMetadata: true,
      }),
    }));
    expect(mocks.prisma.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        currentNodeId: 'node-1',
        pathStatus: 'completed',
        terminalValidation: expect.objectContaining({ state: 'completed' }),
      }),
    }));
    expect(mocks.recordPathDeviation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: 'dev-key',
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
      pathPayload: { mainPathNodeIds: ['node-1', 'node-2'] },
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

  it('does not roll back the parent path on idempotent retry for an older node', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue({
      id: 'path-1',
      userId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2'],
      pathPayload: { mainPathNodeIds: ['node-1', 'node-2'] },
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

    expect(response.status).toBe(200);
    expect(mocks.recordPathNodeExecution).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: 'exec-key',
      status: 'completed',
    }));
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
