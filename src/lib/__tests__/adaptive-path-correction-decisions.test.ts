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
});
