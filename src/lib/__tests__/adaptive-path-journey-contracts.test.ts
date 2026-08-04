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

  it('uses the immediate unfinished node when persistence keeps a completed current node', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      currentNodeId: 'node-1',
      nodeIds: ['node-1', 'node-2', 'node-3'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
        planNodes: [
          { nodeId: 'node-1', title: '基础回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed' },
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
    }), { requestedNodeId: 'node-1' });

    expect(journey.current).toMatchObject({ nodeId: 'node-2' });
    expect(journey.nextAction).toMatchObject({
      state: 'pending-result',
      nodeId: 'node-2',
      href: null,
    });
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

  it('fails closed when a failed checkpoint has only an unrelated later learning node', () => {
    const path = buildPath({
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2', 'node-3'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
        planNodes: [
          { nodeId: 'node-1', title: '基础回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed', estimatedTimeMinutes: 10 },
          { nodeId: 'node-2', title: '校正检查点', type: 'checkpoint', target: '/assessment/adaptive-practice', status: 'current', checkpoint: true, estimatedTimeMinutes: 15, readiness: { state: 'ready' } },
          { nodeId: 'node-3', title: '误差复习', type: 'knowledge_card', target: '/knowledge/card-2', status: 'next', estimatedTimeMinutes: 20, readiness: { state: 'ready' } },
        ],
      },
      terminalValidation: { nodeId: 'node-2', state: 'failed' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: ['node-2'] },
    });
    const before = JSON.stringify(path);

    const journey = buildAuthorizedAdaptivePathJourney(path, { requestedNodeId: 'node-2' });

    expect(journey.correction).toEqual({
      proposal: null,
      unavailableReason: '检查点未通过，但当前路径未提供可核验的补救关系，暂时无法生成可靠的纠偏方案。',
    });
    expect(JSON.stringify(path)).toBe(before);
  });

  it('projects a read-only correction when a failed checkpoint has an eligible governed prerequisite', () => {
    const path = buildPath({
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2', 'node-3'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
        planNodes: [
          { nodeId: 'node-1', title: '基础回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed', estimatedTimeMinutes: 10 },
          { nodeId: 'node-2', title: '校正检查点', type: 'checkpoint', target: '/assessment/adaptive-practice', status: 'current', checkpoint: true, prerequisiteNodeIds: ['node-3'], estimatedTimeMinutes: 15, readiness: { state: 'ready' } },
          { nodeId: 'node-3', title: '误差复习', type: 'knowledge_card', target: '/knowledge/card-2', status: 'next', estimatedTimeMinutes: 20, readiness: { state: 'ready' } },
        ],
      },
      terminalValidation: { nodeId: 'node-2', state: 'failed' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: ['node-2'] },
    });
    const before = JSON.stringify(path);

    const journey = buildAuthorizedAdaptivePathJourney(path, { requestedNodeId: 'node-2' });

    expect(journey.correction).toMatchObject({
      proposal: {
        trigger: { kind: 'failed-checkpoint', nodeId: 'node-2' },
        proposedRemaining: [{ nodeId: 'node-3' }, { nodeId: 'node-2' }],
        changes: [{ kind: 'reordered', nodeId: 'node-2', movedAfterNodeId: 'node-3' }],
      },
      unavailableReason: null,
    });
    expect(JSON.stringify(path)).toBe(before);
  });

  it('projects a read-only removal after a recorded skip when both nodes are unfinished', () => {
    const path = buildPath({
      currentNodeId: 'node-2',
      lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [] },
      deviations: [{ deviationType: 'skip', priorNodeId: 'node-1', targetNodeId: 'node-1' }],
    });

    const journey = buildAuthorizedAdaptivePathJourney(path, { requestedNodeId: 'node-2' });

    expect(journey.correction).toMatchObject({
      proposal: {
        trigger: { kind: 'deviation', nodeId: 'node-1' },
        originalRemaining: [{ nodeId: 'node-1' }, { nodeId: 'node-2' }],
        proposedRemaining: [{ nodeId: 'node-2' }],
        changes: [{ kind: 'removed', nodeId: 'node-1' }],
      },
      unavailableReason: null,
    });
  });

  it('fails closed when a skip record does not name the skipped current node as its target', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      currentNodeId: 'node-2',
      lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [] },
      deviations: [{ deviationType: 'skip', priorNodeId: 'node-2', targetNodeId: 'node-1' }],
    }), { requestedNodeId: 'node-2' });

    expect(journey.correction).toEqual({
      proposal: null,
      unavailableReason: '候选调整与当前未完成路径没有实质差异。',
    });
  });

  it('fails closed when removing a skipped node would violate an unfinished prerequisite', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      currentNodeId: 'node-1',
      nodeIds: ['node-1', 'node-2'],
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', title: '先修复习', type: 'knowledge_card', target: '/knowledge/card-1', status: 'current', readiness: { state: 'ready' } },
          { nodeId: 'node-2', title: '校正练习', type: 'adaptive_quiz', target: '/assessment/adaptive-practice', status: 'next', prerequisiteNodeIds: ['node-1'], readiness: { state: 'ready' } },
        ],
      },
      lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [] },
      deviations: [{ deviationType: 'skip', priorNodeId: 'node-1', targetNodeId: 'node-1' }],
    }), { requestedNodeId: 'node-1' });

    expect(journey.correction).toEqual({
      proposal: null,
      unavailableReason: '已记录偏离会破坏当前未完成路径的先修约束，暂时无法生成可靠的纠偏方案。',
    });
  });

  it('fails closed when a failed checkpoint is followed by an ineligible resource', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      currentNodeId: 'node-2',
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3'],
        planNodes: [
          { nodeId: 'node-1', title: '基础回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed' },
          { nodeId: 'node-2', title: '校正检查点', type: 'checkpoint', target: '/assessment/adaptive-practice', status: 'current', checkpoint: true, readiness: { state: 'ready' } },
          { nodeId: 'node-3', title: '未解锁复习', type: 'knowledge_card', target: '/knowledge/card-2', status: 'locked', readiness: { state: 'locked' } },
        ],
      },
      terminalValidation: { nodeId: 'node-2', state: 'failed' },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: ['node-2'] },
    }), { requestedNodeId: 'node-2' });

    expect(journey.correction).toEqual({
      proposal: null,
      unavailableReason: '检查点未通过，但当前路径未提供可核验的补救关系，暂时无法生成可靠的纠偏方案。',
    });
  });

  it('does not derive a correction from an incomplete path structure', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      currentNodeId: 'node-1',
      pathPayload: {
        mainPathNodeIds: ['node-1'],
        planNodes: [{ nodeId: 'node-1', type: 'checkpoint', target: '/assessment/adaptive-practice' }],
      },
      terminalValidation: { nodeId: 'node-1', state: 'failed' },
      lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: ['node-1'] },
    }), { requestedNodeId: 'node-1' });

    expect(journey.correction).toEqual({
      proposal: null,
      unavailableReason: '学习路径结构不完整，暂时无法生成可靠的纠偏方案。',
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

  it.each([
    'https://evil.example/collect',
    'javascript:alert(1)',
    '//evil.example/collect',
    '/api/private-path-state',
  ])('fails closed for unsupported platform-owned target %s', (target) => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath({
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', title: '基础回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed' },
          { nodeId: 'node-2', title: '恶意目标', type: 'knowledge_card', target, status: 'current', readiness: { state: 'ready' } },
        ],
      },
    }), { requestedNodeId: 'node-1' });

    expect(journey.nextAction).toMatchObject({
      state: 'blocked',
      nodeId: 'node-2',
      href: null,
    });
    expect(JSON.stringify(journey.nextAction)).not.toContain(target);
  });

  it('keeps a supported platform-owned relative target ready', () => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath(), { requestedNodeId: 'node-1' });

    expect(journey.nextAction).toMatchObject({ state: 'ready', nodeId: 'node-2' });
    expect(journey.nextAction.href).toContain('/assessment/adaptive-practice?');
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

  it.each([
    {
      label: 'duplicate main-path ids',
      overrides: {
        currentNodeId: 'node-1',
        nodeIds: ['node-1'],
        pathPayload: {
          mainPathNodeIds: ['node-1', 'node-1'],
          planNodes: [
            { nodeId: 'node-1', title: '基础回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed' },
          ],
        },
        terminalValidation: { nodeId: null, state: 'not-required' },
        lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [] },
      },
    },
    {
      label: 'malformed plan node',
      overrides: {
        currentNodeId: 'node-1',
        nodeIds: ['node-1'],
        pathPayload: {
          mainPathNodeIds: ['node-1'],
          planNodes: [
            { nodeId: 'node-1', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed' },
          ],
        },
        terminalValidation: { nodeId: null, state: 'not-required' },
        lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [] },
      },
    },
    {
      label: 'missing terminal-validation contract',
      overrides: {
        currentNodeId: 'node-1',
        nodeIds: ['node-1'],
        pathPayload: {
          mainPathNodeIds: ['node-1'],
          planNodes: [
            { nodeId: 'node-1', title: '基础回顾', type: 'knowledge_card', target: '/knowledge/card-1', status: 'completed' },
          ],
        },
        terminalValidation: undefined,
        lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [] },
      },
    },
  ])('validates $label before declaring the path complete', ({ overrides }) => {
    const journey = buildAuthorizedAdaptivePathJourney(buildPath(overrides), { requestedNodeId: 'node-1' });

    expect(journey.pathStatus).toBe('active');
    expect(journey.nextAction).toMatchObject({
      state: 'blocked',
      href: null,
      reason: '学习路径结构需要重新生成。',
    });
  });
});
