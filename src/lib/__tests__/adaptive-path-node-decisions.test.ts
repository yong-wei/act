import { describe, expect, it } from 'vitest';

import {
  projectConfirmedAdjustmentsOntoPlanNodes,
  projectSelectionBasisOntoPlanNodes,
} from '../adaptive-path-node-decisions';

const recommendationProvenance = {
  summary: '依据相位裕度的学习证据安排本路径。',
  confidence: 'medium',
  entries: [{
    targetLabel: '相位裕度',
    targetKind: 'knowledge',
    confidence: 'medium',
    evidenceSummary: '掌握状态 42%，来自 3 条有效证据。',
    judgment: '优先安排频域到时域检查题。',
    affectedNodeIds: ['node-2'],
    affectedResourceTitles: ['频域到时域检查题'],
  }],
  evidenceReviewHref: '/profile/evidence',
  limitations: ['证据仅覆盖最近四周。'],
  nextAction: null,
};

const correctionProposal = {
  trigger: { kind: 'failed-checkpoint' as const, nodeId: 'node-3', title: '检查题', reason: '检查点结果未通过。' },
  originalRemaining: [
    { nodeId: 'node-3', title: '节点 3', type: 'checkpoint', estimatedTimeMinutes: 10 },
    { nodeId: 'node-4', title: '节点 4', type: 'reflection', estimatedTimeMinutes: 5 },
  ],
  proposedRemaining: [
    { nodeId: 'node-4', title: '节点 4', type: 'reflection', estimatedTimeMinutes: 5 },
    { nodeId: 'node-3', title: '节点 3', type: 'checkpoint', estimatedTimeMinutes: 10 },
  ],
  changes: [{ kind: 'reordered' as const, nodeId: 'node-3', title: '节点 3', movedAfterNodeId: 'node-4' }],
  supportingFacts: ['检查点结果未通过。'],
  estimatedRemainingWork: { originalMinutes: 15, proposedMinutes: 15, differenceMinutes: 0 },
};

describe('adaptive path node decision projections', () => {
  it('projects candidate provenance onto each adopted node without inventing node facts', () => {
    const nodes = projectSelectionBasisOntoPlanNodes([
      { nodeId: 'node-1' },
      { nodeId: 'node-2' },
    ], recommendationProvenance);

    expect(nodes[0]).toMatchObject({
      decisionExplanation: {
        selectionBasis: {
          summary: recommendationProvenance.summary,
          confidence: 'medium',
          supportingFacts: [],
          limitations: ['证据仅覆盖最近四周。'],
        },
      },
    });
    expect(nodes[1]).toMatchObject({
      decisionExplanation: {
        selectionBasis: {
          supportingFacts: [
            '掌握状态 42%，来自 3 条有效证据。',
            '优先安排频域到时域检查题。',
          ],
        },
      },
    });
  });

  it('leaves legacy nodes missing when no persisted recommendation provenance exists', () => {
    const nodes = [{ nodeId: 'legacy-node', reasonCodes: ['current-state-only'] }];

    expect(projectSelectionBasisOntoPlanNodes(nodes, {})).toEqual(nodes);
  });

  it('classifies adjacent-version reordering and preserves unrelated earlier adjustments', () => {
    const nodes = projectConfirmedAdjustmentsOntoPlanNodes({
      planNodes: [
        { nodeId: 'node-1' },
        {
          nodeId: 'node-2',
          decisionExplanation: {
            latestAdjustment: { kind: 'retained', summary: '此前调整', supportingFacts: ['此前事实'] },
          },
        },
        { nodeId: 'node-3' },
        { nodeId: 'node-4' },
      ],
      previousNodeIds: ['node-1', 'node-2', 'node-3', 'node-4'],
      nextNodeIds: ['node-1', 'node-2', 'node-4', 'node-3'],
      completedNodeIds: new Set(['node-1']),
      skippedNodeIds: new Set(),
      proposal: correctionProposal,
    });

    expect(nodes[1]).toMatchObject({
      decisionExplanation: { latestAdjustment: { summary: '此前调整' } },
    });
    expect(nodes[2]).toMatchObject({
      nodeId: 'node-4',
      decisionExplanation: { latestAdjustment: { kind: 'advanced', summary: expect.stringContaining('提前 1 位') } },
    });
    expect(nodes[3]).toMatchObject({
      nodeId: 'node-3',
      decisionExplanation: { latestAdjustment: { kind: 'delayed', summary: expect.stringContaining('延后 1 位') } },
    });
  });

  it('retains a skipped historical node outside the executable sequence with a removal explanation', () => {
    const nodes = projectConfirmedAdjustmentsOntoPlanNodes({
      planNodes: [
        { nodeId: 'node-1' },
        { nodeId: 'node-2', decisionExplanation: { selectionBasis: { summary: '生成时依据' } } },
        { nodeId: 'node-3' },
      ],
      previousNodeIds: ['node-1', 'node-2', 'node-3'],
      nextNodeIds: ['node-1', 'node-3'],
      completedNodeIds: new Set(['node-1']),
      skippedNodeIds: new Set(['node-2']),
      proposal: {
        ...correctionProposal,
        originalRemaining: [{ nodeId: 'node-2', title: '节点 2', type: 'reflection', estimatedTimeMinutes: 5 }],
        proposedRemaining: [],
        changes: [{ kind: 'removed', nodeId: 'node-2', title: '节点 2', reason: '已记录跳过。' }],
      },
    });

    expect(nodes.map((node) => node.nodeId)).toEqual(['node-1', 'node-2', 'node-3']);
    expect(nodes[1]).toMatchObject({
      decisionExplanation: {
        selectionBasis: { summary: '生成时依据' },
        latestAdjustment: { kind: 'removed', summary: expect.stringContaining('已记录跳过') },
      },
    });
  });

  it('records replacement facts on the replacement node', () => {
    const nodes = projectConfirmedAdjustmentsOntoPlanNodes({
      planNodes: [{ nodeId: 'node-1' }, { nodeId: 'node-2' }, { nodeId: 'node-3' }],
      previousNodeIds: ['node-1', 'node-2'],
      nextNodeIds: ['node-1', 'node-3'],
      completedNodeIds: new Set(['node-1']),
      skippedNodeIds: new Set(),
      proposal: {
        ...correctionProposal,
        changes: [{
          kind: 'replaced',
          nodeId: 'node-2',
          title: '原练习',
          replacementNodeId: 'node-3',
          replacementTitle: '替代练习',
        }],
      },
    });

    expect(nodes[1]).toMatchObject({
      nodeId: 'node-3',
      decisionExplanation: {
        latestAdjustment: { kind: 'replaced', summary: '本次确认纠偏用“替代练习”替换了“原练习”。' },
      },
    });
  });

  it('keeps older skipped history across a later correction', () => {
    const nodes = projectConfirmedAdjustmentsOntoPlanNodes({
      planNodes: [
        { nodeId: 'node-1' },
        {
          nodeId: 'node-old-skip',
          decisionExplanation: {
            latestAdjustment: { kind: 'removed', summary: '此前已跳过', supportingFacts: [] },
          },
        },
        { nodeId: 'node-2' },
        { nodeId: 'node-3' },
      ],
      previousNodeIds: ['node-1', 'node-2', 'node-3'],
      nextNodeIds: ['node-1', 'node-3', 'node-2'],
      completedNodeIds: new Set(['node-1']),
      skippedNodeIds: new Set(['node-old-skip']),
      proposal: correctionProposal,
    });

    expect(nodes.map((node) => node.nodeId)).toEqual(['node-1', 'node-3', 'node-old-skip', 'node-2']);
    expect(nodes.find((node) => node.nodeId === 'node-old-skip')).toMatchObject({
      decisionExplanation: { latestAdjustment: { summary: '此前已跳过' } },
    });
  });
});
