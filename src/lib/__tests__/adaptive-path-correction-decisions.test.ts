import { describe, expect, it } from 'vitest';

import { buildAdaptivePathCorrectionApplication } from '../adaptive-path-correction-decisions';

const proposal = {
  trigger: {
    kind: 'deviation' as const,
    nodeId: 'node-2',
    title: '节点 2',
    reason: '已跳过节点。',
  },
  originalRemaining: [
    { nodeId: 'node-2', title: '节点 2', type: 'adaptive_quiz', estimatedTimeMinutes: 10 },
    { nodeId: 'node-3', title: '节点 3', type: 'checkpoint', estimatedTimeMinutes: 10 },
    { nodeId: 'node-4', title: '节点 4', type: 'reflection', estimatedTimeMinutes: 5 },
  ],
  proposedRemaining: [
    { nodeId: 'node-2', title: '节点 2', type: 'adaptive_quiz', estimatedTimeMinutes: 10 },
    { nodeId: 'node-4', title: '节点 4', type: 'reflection', estimatedTimeMinutes: 5 },
    { nodeId: 'node-3', title: '节点 3', type: 'checkpoint', estimatedTimeMinutes: 10 },
  ],
  changes: [{ kind: 'reordered' as const, nodeId: 'node-4', title: '节点 4', movedAfterNodeId: 'node-2' }],
  supportingFacts: ['存在可核验的偏离记录。'],
  estimatedRemainingWork: { originalMinutes: 25, proposedMinutes: 25, differenceMinutes: 0 },
};

describe('buildAdaptivePathCorrectionApplication', () => {
  it('preserves the entered current node and applies only later candidate nodes', () => {
    const result = buildAdaptivePathCorrectionApplication({
      nodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
      currentNodeId: 'node-2',
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
        planNodes: ['node-1', 'node-2', 'node-3', 'node-4'].map((nodeId) => ({ nodeId })),
      },
      lastExecutionMetadata: { activeNodeId: 'node-2', completedNodeIds: ['node-1'] },
    }, proposal);

    expect(result).toMatchObject({
      currentNodeId: 'node-2',
      nodeIds: ['node-1', 'node-2', 'node-4', 'node-3'],
      lastExecutionMetadata: { activeNodeId: 'node-2', completedNodeIds: ['node-1'] },
    });
  });

  it('refuses candidates that no longer make a material future-path change', () => {
    const result = buildAdaptivePathCorrectionApplication({
      nodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
      currentNodeId: 'node-2',
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
        planNodes: ['node-1', 'node-2', 'node-3', 'node-4'].map((nodeId) => ({ nodeId })),
      },
      lastExecutionMetadata: {},
    }, {
      ...proposal,
      proposedRemaining: proposal.originalRemaining,
      changes: [],
    });

    expect(result).toBeNull();
  });

  it('removes a skipped unfinished predecessor after current-node advancement', () => {
    const result = buildAdaptivePathCorrectionApplication({
      nodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
      currentNodeId: 'node-3',
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
        planNodes: ['node-1', 'node-2', 'node-3', 'node-4'].map((nodeId) => ({ nodeId })),
      },
      lastExecutionMetadata: {
        activeNodeId: 'node-3',
        completedNodeIds: ['node-1'],
        skippedNodeIds: ['node-2'],
      },
    }, {
      ...proposal,
      originalRemaining: [{ nodeId: 'node-4', title: '节点 4', type: 'reflection', estimatedTimeMinutes: 5 }],
      proposedRemaining: [{ nodeId: 'node-4', title: '节点 4', type: 'reflection', estimatedTimeMinutes: 5 }],
      changes: [{ kind: 'removed', nodeId: 'node-2', title: '节点 2', reason: '已跳过节点不应重写入后续路径。' }],
    });

    expect(result).toMatchObject({
      currentNodeId: 'node-3',
      nodeIds: ['node-1', 'node-3', 'node-4'],
      lastExecutionMetadata: {
        activeNodeId: 'node-3',
        completedNodeIds: ['node-1'],
        skippedNodeIds: ['node-2'],
      },
    });
  });

  it('preserves a non-skipped predecessor while applying replacement or abandonment candidates', () => {
    const result = buildAdaptivePathCorrectionApplication({
      nodeIds: ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'],
      currentNodeId: 'node-3',
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'],
        planNodes: ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'].map((nodeId) => ({ nodeId })),
      },
      lastExecutionMetadata: { activeNodeId: 'node-3', completedNodeIds: ['node-1'] },
    }, {
      ...proposal,
      originalRemaining: [
        { nodeId: 'node-4', title: '节点 4', type: 'reflection', estimatedTimeMinutes: 5 },
        { nodeId: 'node-5', title: '节点 5', type: 'checkpoint', estimatedTimeMinutes: 10 },
      ],
      proposedRemaining: [
        { nodeId: 'node-5', title: '节点 5', type: 'checkpoint', estimatedTimeMinutes: 10 },
        { nodeId: 'node-4', title: '节点 4', type: 'reflection', estimatedTimeMinutes: 5 },
      ],
      changes: [{
        kind: 'replaced',
        nodeId: 'node-4',
        title: '节点 4',
        replacementNodeId: 'node-5',
        replacementTitle: '替代资源',
      }],
    });

    expect(result?.nodeIds).toEqual(['node-1', 'node-2', 'node-3', 'node-5', 'node-4']);
  });

  it.each(['replacement', 'abandonment'] as const)('removes a governed %s predecessor after current-node advancement', (deviationType) => {
    const result = buildAdaptivePathCorrectionApplication({
      nodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
      currentNodeId: 'node-3',
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
        planNodes: ['node-1', 'node-2', 'node-3', 'node-4'].map((nodeId) => ({ nodeId })),
      },
      lastExecutionMetadata: { activeNodeId: 'node-3', completedNodeIds: ['node-1'] },
      deviations: [{ deviationType, priorNodeId: 'node-2', targetNodeId: deviationType === 'replacement' ? 'node-4' : null }],
    }, {
      ...proposal,
      proposedRemaining: [{ nodeId: 'node-4', title: '节点 4', type: 'reflection', estimatedTimeMinutes: 5 }],
      changes: [{ kind: 'removed', nodeId: 'node-2', title: '节点 2', reason: '已被处理' }],
    });

    expect(result?.nodeIds).toEqual(['node-1', 'node-3', 'node-4']);
  });

  it('preserves a completed predecessor even when a deviation references it', () => {
    const result = buildAdaptivePathCorrectionApplication({
      nodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
      currentNodeId: 'node-3',
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
        planNodes: ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'].map((nodeId) => ({ nodeId })),
      },
      lastExecutionMetadata: { activeNodeId: 'node-3', completedNodeIds: ['node-1', 'node-2'] },
      deviations: [{ deviationType: 'replacement', priorNodeId: 'node-2', targetNodeId: 'node-4' }],
    }, {
      ...proposal,
      proposedRemaining: [
        { nodeId: 'node-5', title: '节点 5', type: 'reflection', estimatedTimeMinutes: 5 },
        { nodeId: 'node-4', title: '节点 4', type: 'reflection', estimatedTimeMinutes: 5 },
      ],
      changes: [{ kind: 'replaced', nodeId: 'node-2', title: '节点 2', replacementNodeId: 'node-4', replacementTitle: '节点 4' }],
    });

    expect(result?.nodeIds).toEqual(['node-1', 'node-2', 'node-3', 'node-5', 'node-4']);
  });
});
