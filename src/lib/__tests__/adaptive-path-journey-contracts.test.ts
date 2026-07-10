import { describe, expect, it } from 'vitest';

import { buildAuthorizedAdaptivePathJourney } from '@/features/adaptive/adaptive-path-journey-contracts';

function buildPath(overrides: Record<string, unknown> = {}) {
  return {
    id: 'path-1',
    userId: 'student-1',
    title: '校正学习路径',
    goalId: 'control-correction',
    pathStatus: 'active',
    currentNodeId: 'node-2',
    nodeIds: ['node-1', 'node-2'],
    pathPayload: {
      mainPathNodeIds: ['node-1', 'node-2'],
      planNodes: [
        { nodeId: 'node-1', title: '基础回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed' },
        { nodeId: 'node-2', title: '校正练习', type: 'adaptive_quiz', target: '/assessment/adaptive-practice', status: 'current', readiness: { state: 'ready' } },
      ],
    },
    terminalValidation: { nodeId: null, state: 'not-required' },
    lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [], skippedNodeIds: [] },
    ...overrides,
  };
}

describe('adaptive path journey contracts', () => {
  it('returns a path-aware ready action for the authoritative current node', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath(), { requestedNodeId: 'node-1' });

    expect(journey).toMatchObject({
      path: { id: 'path-1', title: '校正学习路径' },
      goal: { id: 'control-correction' },
      context: { requestedNodeId: 'node-1' },
      current: { nodeId: 'node-2', title: '校正练习', type: 'adaptive_quiz' },
      progress: { completed: 1, total: 2 },
      return: { href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1&nodeId=node-2' },
      pathStatus: 'active',
      nextAction: {
        state: 'ready',
        nodeId: 'node-2',
        title: '校正练习',
        type: 'adaptive_quiz',
        reason: null,
        recovery: null,
      },
    });
    expect(journey.nextAction.href).toContain('pathId=path-1');
    expect(journey.nextAction.href).toContain('nodeId=node-2');
  });

  it('blocks continuation while the authoritative current node remains incomplete', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      currentNodeId: 'node-1',
      lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [], skippedNodeIds: [] },
    }), { requestedNodeId: 'node-1' });

    expect(journey.nextAction).toMatchObject({
      state: 'blocked',
      nodeId: 'node-1',
      href: null,
    });
  });

  it('does not expose an href when the next node is locked', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', title: '基础回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed' },
          {
            nodeId: 'node-2',
            title: '校正练习',
            type: 'adaptive_quiz',
            target: '/assessment/adaptive-practice',
            status: 'locked',
            readiness: { state: 'locked', missingCompletedNodeIds: ['node-1'] },
          },
        ],
      },
    }), { requestedNodeId: 'node-1' });

    expect(journey.nextAction).toMatchObject({ state: 'blocked', nodeId: 'node-2', href: null });
  });

  it('uses pending-result when readiness is waiting for governed outcome references', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', title: '基础回顾', type: 'simulation', target: '/simulations/one', status: 'completed' },
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
    }), { requestedNodeId: 'node-1' });

    expect(journey.nextAction).toMatchObject({
      state: 'pending-result',
      nodeId: 'node-2',
      href: null,
      recovery: { label: '刷新结果状态' },
    });
  });

  it('blocks after an invalid governed result', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      currentNodeId: 'node-2',
      pathStatus: 'fallback',
      terminalValidation: {
        nodeId: 'node-2',
        state: 'failed',
        failureReasons: ['arena-submission-invalid'],
      },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: ['node-2'] },
    }), { requestedNodeId: 'node-2' });

    expect(journey.nextAction).toMatchObject({
      state: 'blocked',
      nodeId: 'node-2',
      href: null,
      reason: expect.stringContaining('验证'),
    });
  });

  it('normalizes all-complete paths without terminal validation to path-complete', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      currentNodeId: 'node-2',
      lastExecutionMetadata: { completedNodeIds: ['node-1', 'node-2'], failedNodeIds: [] },
    }), { requestedNodeId: 'node-2' });

    expect(journey.pathStatus).toBe('completed');
    expect(journey.nextAction).toMatchObject({
      state: 'path-complete',
      nodeId: null,
      title: '查看路径总结',
      href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1',
    });
  });

  it('does not count skipped nodes as completed path evidence', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      lastExecutionMetadata: {
        completedNodeIds: ['node-1'],
        skippedNodeIds: ['node-2'],
        failedNodeIds: [],
      },
    }), { requestedNodeId: 'node-2' });

    expect(journey.progress).toEqual({ completed: 1, total: 2 });
    expect(journey.pathStatus).toBe('active');
    expect(journey.nextAction.state).not.toBe('path-complete');
  });

  it('routes an external next node through the path center without leaking path params to the external site', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      pathPayload: {
        mainPathNodeIds: ['node-1', 'external-2'],
        planNodes: [
          { nodeId: 'node-1', title: '基础回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed' },
          { nodeId: 'external-2', title: '外部资料', type: 'external_resource', target: 'https://example.com/resource', status: 'current', readiness: { state: 'ready' } },
        ],
      },
      currentNodeId: 'external-2',
      nodeIds: ['node-1', 'external-2'],
    }), { requestedNodeId: 'node-1' });

    expect(journey.nextAction).toMatchObject({
      state: 'ready',
      nodeId: 'external-2',
      type: 'external_resource',
    });
    expect(journey.nextAction.href).toContain('/assessment/adaptive-practice?');
    expect(journey.nextAction.href).not.toContain('example.com');
  });

  it('fails closed for malformed legacy path payloads', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      currentNodeId: 'legacy-node',
      nodeIds: ['legacy-node'],
      pathPayload: { mainPathNodeIds: ['legacy-node'] },
      lastExecutionMetadata: { completedNodeIds: [] },
    }), { requestedNodeId: 'legacy-node' });

    expect(journey.nextAction).toMatchObject({
      state: 'blocked',
      nodeId: null,
      href: null,
      recovery: { label: '返回学习路径' },
    });
  });
});
