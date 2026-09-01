import { beforeEach, describe, expect, it, vi } from 'vitest';

const at = new Date('2026-08-04T09:00:00.000Z');

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  rootFindUnique: vi.fn(),
  rootDecisionFindFirst: vi.fn(),
  txFindFirst: vi.fn(),
  txDecisionFindFirst: vi.fn(),
  txUpdateMany: vi.fn(),
  txDecisionCreate: vi.fn(),
  buildJourney: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    learningPath: { findUnique: mocks.rootFindUnique },
    learningPathCorrectionDecision: { findFirst: mocks.rootDecisionFindFirst },
  },
}));
vi.mock('@/features/personalization/path-planning/control-correction-path-rounds', () => ({
  isControlCorrectionPathRoundPersistenceEnabled: () => true,
}));
vi.mock('@/lib/canonical-learning-path-transition/write-fence', () => ({
  runWithLearningPathWriteFence: async (_db: unknown, _pathId: string, work: (tx: unknown) => Promise<unknown>) => work({
    learningPath: { findFirst: mocks.txFindFirst, updateMany: mocks.txUpdateMany },
    learningPathCorrectionDecision: {
      findFirst: mocks.txDecisionFindFirst,
      create: mocks.txDecisionCreate,
    },
  }),
}));
vi.mock('@/features/personalization/experience/adaptive-path-journey-contracts', () => ({
  buildAuthorizedAdaptivePathJourney: mocks.buildJourney,
}));

import { POST } from '../route';

const proposal = {
  trigger: { kind: 'failed-checkpoint', nodeId: 'node-3', title: '节点 3', reason: '检查点未通过。' },
  originalRemaining: [
    { nodeId: 'node-2', title: '节点 2', type: 'adaptive_quiz', estimatedTimeMinutes: 10 },
    { nodeId: 'node-3', title: '节点 3', type: 'checkpoint', estimatedTimeMinutes: 10 },
    { nodeId: 'node-4', title: '节点 4', type: 'knowledge_card', estimatedTimeMinutes: 5 },
  ],
  proposedRemaining: [
    { nodeId: 'node-2', title: '节点 2', type: 'adaptive_quiz', estimatedTimeMinutes: 10 },
    { nodeId: 'node-4', title: '节点 4', type: 'knowledge_card', estimatedTimeMinutes: 5 },
    { nodeId: 'node-3', title: '节点 3', type: 'checkpoint', estimatedTimeMinutes: 10 },
  ],
  changes: [{ kind: 'reordered', nodeId: 'node-4', title: '节点 4', movedAfterNodeId: 'node-2' }],
  supportingFacts: ['检查点未通过，且存在可核验的先修节点。'],
  estimatedRemainingWork: { originalMinutes: 25, proposedMinutes: 25, differenceMinutes: 0 },
};

function pathRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'path-1',
    userId: 'student-1',
    title: '控制系统校正路径',
    goalId: 'control-correction',
    pathStatus: 'active',
    updatedAt: at,
    currentNodeId: 'node-2',
    nodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
    pathPayload: {
      mainPathNodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
      planNodes: [{ nodeId: 'node-1' }, { nodeId: 'node-2' }, { nodeId: 'node-3' }, { nodeId: 'node-4' }],
    },
    terminalValidation: {},
    lastExecutionMetadata: { activeNodeId: 'node-2', completedNodeIds: ['node-1'] },
    deviations: [],
    correctionDecisions: [],
    ...overrides,
  };
}

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/learning-paths/path-1/correction-decisions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'confirmed',
      candidateFingerprint: 'correction-12345678',
      pathUpdatedAt: at.toISOString(),
      idempotencyKey: 'decision-1',
      ...body,
    }),
  });
}

const params = { params: Promise.resolve({ id: 'path-1' }) };

describe('POST /api/learning-paths/[id]/correction-decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.rootFindUnique.mockResolvedValue(pathRecord());
    mocks.rootDecisionFindFirst.mockResolvedValue(null);
    mocks.txDecisionFindFirst.mockResolvedValue(null);
    mocks.txFindFirst.mockResolvedValue(pathRecord());
    mocks.txUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txDecisionCreate.mockResolvedValue({
      id: 'decision-1',
      decision: 'confirmed',
      candidateFingerprint: 'correction-12345678',
      applicationResult: { applied: true },
      createdAt: at,
    });
    mocks.buildJourney.mockReturnValue({
      correction: {
        proposal,
        candidateFingerprint: 'correction-12345678',
        pathUpdatedAt: at.toISOString(),
        decision: null,
        history: [],
      },
    });
  });

  it('confirms only future nodes and records the server-derived candidate', async () => {
    const response = await POST(request({}), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ replayed: false, decision: { decision: 'confirmed', applied: true } });
    expect(mocks.txUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1', updatedAt: at },
      data: expect.objectContaining({ nodeIds: ['node-1', 'node-2', 'node-4', 'node-3'] }),
    }));
    expect(mocks.txDecisionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ candidateFingerprint: 'correction-12345678', decision: 'confirmed' }),
    }));
  });

  it('defers without updating the persisted path', async () => {
    mocks.txDecisionCreate.mockResolvedValue({
      id: 'decision-2', decision: 'deferred', candidateFingerprint: 'correction-12345678',
      applicationResult: { applied: false }, createdAt: at,
    });

    const response = await POST(request({ decision: 'deferred', idempotencyKey: 'decision-2' }), params);

    expect(response.status).toBe(200);
    expect(mocks.txUpdateMany).not.toHaveBeenCalled();
    expect(mocks.txDecisionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ decision: 'deferred', applicationResult: { applied: false } }),
    }));
  });

  it('returns a refresh conflict without writes when the candidate is stale', async () => {
    mocks.buildJourney.mockReturnValue({
      correction: { proposal, candidateFingerprint: 'correction-newer', pathUpdatedAt: at.toISOString(), decision: null, history: [] },
    });

    const response = await POST(request({}), params);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.refreshRequired).toBe(true);
    expect(mocks.txUpdateMany).not.toHaveBeenCalled();
    expect(mocks.txDecisionCreate).not.toHaveBeenCalled();
  });

  it('replays the existing decision found after the write fence without duplicating work', async () => {
    const existing = {
      id: 'decision-1', decision: 'confirmed', candidateFingerprint: 'correction-12345678',
      applicationResult: { applied: true }, createdAt: at,
    };
    mocks.txDecisionFindFirst.mockResolvedValue(existing);

    const response = await POST(request({}), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ replayed: true, decision: { id: 'decision-1', applied: true } });
    expect(mocks.txUpdateMany).not.toHaveBeenCalled();
    expect(mocks.txDecisionCreate).not.toHaveBeenCalled();
  });

  it('confirms a candidate after a current-node skip advances past the skipped node', async () => {
    const skippedPath = pathRecord({
      currentNodeId: 'node-3',
      lastExecutionMetadata: {
        activeNodeId: 'node-3',
        completedNodeIds: ['node-1'],
        skippedNodeIds: ['node-2'],
      },
    });
    mocks.rootFindUnique.mockResolvedValue(skippedPath);
    mocks.txFindFirst.mockResolvedValue(skippedPath);
    mocks.buildJourney.mockReturnValue({
      correction: {
        proposal: {
          ...proposal,
          originalRemaining: [{ nodeId: 'node-4', title: '节点 4', type: 'knowledge_card', estimatedTimeMinutes: 5 }],
          proposedRemaining: [{ nodeId: 'node-4', title: '节点 4', type: 'knowledge_card', estimatedTimeMinutes: 5 }],
          changes: [{ kind: 'removed', nodeId: 'node-2', title: '节点 2', reason: '已跳过节点。' }],
        },
        candidateFingerprint: 'correction-12345678',
        pathUpdatedAt: at.toISOString(),
        decision: null,
        history: [],
      },
    });

    const response = await POST(request({ idempotencyKey: 'decision-after-skip' }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ decision: { decision: 'confirmed', applied: true } });
    expect(mocks.txUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nodeIds: ['node-1', 'node-3', 'node-4'],
        currentNodeId: 'node-3',
        lastExecutionMetadata: expect.objectContaining({ skippedNodeIds: ['node-2'] }),
      }),
    }));
  });

  it.each(['replacement', 'abandonment'] as const)('confirms a candidate after a governed %s deviation without restoring the prior node', async (deviationType) => {
    const deviatedPath = pathRecord({
      currentNodeId: 'node-3',
      lastExecutionMetadata: { activeNodeId: 'node-3', completedNodeIds: ['node-1'] },
      deviations: [{ deviationType, priorNodeId: 'node-2', targetNodeId: deviationType === 'replacement' ? 'node-4' : null }],
    });
    mocks.rootFindUnique.mockResolvedValue(deviatedPath);
    mocks.txFindFirst.mockResolvedValue(deviatedPath);
    mocks.buildJourney.mockReturnValue({
      correction: {
        proposal: {
          ...proposal,
          originalRemaining: [{ nodeId: 'node-2', title: '节点 2', type: 'knowledge_card', estimatedTimeMinutes: 5 }, { nodeId: 'node-4', title: '节点 4', type: 'knowledge_card', estimatedTimeMinutes: 5 }],
          proposedRemaining: [{ nodeId: 'node-4', title: '节点 4', type: 'knowledge_card', estimatedTimeMinutes: 5 }],
          changes: deviationType === 'replacement'
            ? [{ kind: 'replaced', nodeId: 'node-2', title: '节点 2', replacementNodeId: 'node-4', replacementTitle: '节点 4' }]
            : [{ kind: 'removed', nodeId: 'node-2', title: '节点 2', reason: '已放弃节点。' }],
        },
        candidateFingerprint: 'correction-12345678',
        pathUpdatedAt: at.toISOString(),
        decision: null,
        history: [],
      },
    });

    const response = await POST(request({ idempotencyKey: `decision-after-${deviationType}` }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ decision: { decision: 'confirmed', applied: true } });
    expect(mocks.txUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nodeIds: ['node-1', 'node-3', 'node-4'], currentNodeId: 'node-3' }),
    }));
  });
});
