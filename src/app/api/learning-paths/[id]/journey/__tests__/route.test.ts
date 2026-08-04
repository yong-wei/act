import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    learningPath: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));

import { GET } from '../route';

const params = { params: Promise.resolve({ id: 'path-1' }) };

function pathRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'path-1',
    userId: 'student-1',
    classId: 'class-1',
    title: '校正学习路径',
    goalId: 'control-correction',
    pathStatus: 'active',
    currentNodeId: 'node-2',
    nodeIds: ['node-1', 'node-2'],
    pathPayload: {
      mainPathNodeIds: ['node-1', 'node-2'],
      planNodes: [
        { nodeId: 'node-1', title: '知识回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed' },
        { nodeId: 'node-2', title: '校正练习', type: 'adaptive_quiz', target: '/assessment/adaptive-practice', status: 'current', readiness: { state: 'ready' } },
      ],
    },
    terminalValidation: { nodeId: null, state: 'not-required' },
    lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [] },
    ...overrides,
  };
}

function request(nodeId = 'node-1', goalId = 'control-correction') {
  return new Request(`http://localhost/api/learning-paths/path-1/journey?nodeId=${encodeURIComponent(nodeId)}&goalId=${encodeURIComponent(goalId)}`);
}

function legacyArenaPathRecord(kind: 'registry' | 'yangfan') {
  const isRegistry = kind === 'registry';
  const legacyNodeId = isRegistry ? 'registry:arena-challenge-workbench' : '根轨迹_1_1';
  const taskId = 'task-second-order-lead-pid';
  return pathRecord({
    currentNodeId: legacyNodeId,
    nodeIds: [legacyNodeId],
    pathPayload: {
      ...(isRegistry ? {} : { fixtureScope: 'yangfan-diagnostic-fixture.v1' }),
      mainPathNodeIds: [legacyNodeId],
      planNodes: [{
        nodeId: legacyNodeId,
        title: isRegistry ? 'Arena 挑战工作台' : '杨帆根轨迹诊断',
        type: 'arena_task',
        sourceKind: isRegistry ? 'resource_registry' : 'knowledge_graph',
        sourceRef: isRegistry ? 'arena-challenge-workbench' : legacyNodeId,
        target: isRegistry
          ? `/arena/challenges/${taskId}`
          : `/arena?nodeId=${encodeURIComponent(legacyNodeId)}`,
        status: 'current',
        readiness: { state: 'ready' },
      }],
    },
    terminalValidation: {
      nodeId: legacyNodeId,
      state: 'pending',
      sourceKind: isRegistry ? 'resource_registry' : 'knowledge_graph',
      sourceRef: isRegistry ? 'arena-challenge-workbench' : legacyNodeId,
      target: isRegistry
        ? `/arena/challenges/${taskId}`
        : `/arena?nodeId=${encodeURIComponent(legacyNodeId)}`,
    },
    lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [] },
  });
}

describe('GET /api/learning-paths/[id]/journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONTROL_CORRECTION_PATH_ROUNDS_ENABLED = 'true';
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.learningPath.findUnique.mockResolvedValue(pathRecord());
  });

  it('rejects unauthenticated reads before returning path details', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await GET(request(), params);

    expect(response.status).toBe(401);
    expect(mocks.prisma.learningPath.findUnique).not.toHaveBeenCalled();
  });

  it('rejects teachers and non-owners without disclosing journey structure', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await GET(request(), params);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: '无权访问该学习路径旅程' });
    expect(payload).not.toHaveProperty('journey');
  });

  it('rejects a foreign node or goal without returning path structure', async () => {
    const nodeResponse = await GET(request('foreign-node'), params);
    const nodePayload = await nodeResponse.json();
    const goalResponse = await GET(request('node-1', 'foreign-goal'), params);

    expect(nodeResponse.status).toBe(403);
    expect(nodePayload).not.toHaveProperty('journey');
    expect(goalResponse.status).toBe(403);
  });

  it('returns the authorized ready journey state', async () => {
    const response = await GET(request(), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.journey).toMatchObject({
      current: { nodeId: 'node-2' },
      progress: { completed: 1, total: 2 },
      nextAction: { state: 'ready', nodeId: 'node-2' },
    });
  });

  it('returns a read-only correction proposal for a recorded skip', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue(pathRecord({
      currentNodeId: 'node-2',
      lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [] },
      deviations: [{ deviationType: 'skip', priorNodeId: 'node-1', targetNodeId: 'node-1' }],
    }));

    const response = await GET(request('node-2'), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.journey.correction).toMatchObject({
      proposal: {
        trigger: { kind: 'deviation', nodeId: 'node-1' },
        originalRemaining: [{ nodeId: 'node-1' }, { nodeId: 'node-2' }],
        proposedRemaining: [{ nodeId: 'node-2' }, { nodeId: 'node-1' }],
      },
      unavailableReason: null,
    });
    expect(payload.journey.current).toMatchObject({ nodeId: 'node-2' });
    expect(payload.journey.nextAction).toMatchObject({ state: 'blocked', nodeId: 'node-2' });
  });

  it.each([
    ['legacy registry', 'registry' as const],
    ['Yang Fan fixture', 'yangfan' as const],
  ])('returns a canonical journey for the verified %s persisted Arena path', async (_label, kind) => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue(legacyArenaPathRecord(kind));

    const response = await GET(request('arena-task:task-second-order-lead-pid'), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.journey).toMatchObject({
      current: {
        nodeId: 'arena-task:task-second-order-lead-pid',
        type: 'arena_task',
      },
      nextAction: {
        nodeId: 'arena-task:task-second-order-lead-pid',
      },
    });
    expect(JSON.stringify(payload.journey)).not.toContain(
      kind === 'registry' ? 'registry:arena-challenge-workbench' : '根轨迹_1_1',
    );
  });

  it('does not authorize raw legacy, wrong canonical, or unknown Arena node ids', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue(legacyArenaPathRecord('registry'));

    for (const nodeId of [
      'registry:arena-challenge-workbench',
      'arena-task:task-cruise-roll-blackbox-identification',
      'arena-task:unknown-task',
    ]) {
      const response = await GET(request(nodeId), params);
      const payload = await response.json();
      expect(response.status).toBe(403);
      expect(payload).toEqual({ error: '无权访问该学习路径旅程' });
      expect(payload).not.toHaveProperty('journey');
    }
  });

  it('returns pending-result without a next href', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue(pathRecord({
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', title: '知识回顾', type: 'simulation', target: '/simulations/one', status: 'completed' },
          {
            nodeId: 'node-2',
            title: '结果分析',
            type: 'control_workbench',
            target: '/interactive-learning/control-workbench',
            status: 'locked',
            readiness: { state: 'evidence-needed', missingOutcomeRefs: ['simulation_run:one'] },
          },
        ],
      },
    }));

    const response = await GET(request(), params);
    const payload = await response.json();

    expect(payload.journey.nextAction).toMatchObject({ state: 'pending-result', href: null });
  });

  it('returns blocked without a next href while the requested current node is incomplete', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue(pathRecord({
      currentNodeId: 'node-1',
      lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [] },
    }));

    const response = await GET(request('node-1'), params);
    const payload = await response.json();

    expect(payload.journey.nextAction).toMatchObject({
      state: 'blocked',
      nodeId: 'node-1',
      href: null,
    });
  });

  it('returns path-complete for a completed non-terminal path', async () => {
    mocks.prisma.learningPath.findUnique.mockResolvedValue(pathRecord({
      lastExecutionMetadata: { completedNodeIds: ['node-1', 'node-2'], failedNodeIds: [] },
    }));

    const response = await GET(request('node-2'), params);
    const payload = await response.json();

    expect(payload.journey).toMatchObject({
      pathStatus: 'completed',
      nextAction: { state: 'path-complete', nodeId: null },
    });
    expect(payload.journey.nextAction.href).toContain('pathId=path-1');
  });
});
