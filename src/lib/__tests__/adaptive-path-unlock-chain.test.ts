import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildAdaptivePathUnlockChain,
  type AdaptivePathUnlockChainContextNode,
  type AdaptivePathUnlockChainNodeInput,
} from '@/lib/adaptive-path-unlock-chain';
import {
  buildAdaptivePathOptionDisplays,
  type AdaptivePathOptionWriteOption,
} from '@/lib/adaptive-path-option-display';

const repoRoot = process.cwd();

function node(
  overrides: Partial<AdaptivePathUnlockChainNodeInput> = {},
): AdaptivePathUnlockChainNodeInput {
  return {
    nodeId: 'node-e',
    title: '节点 E',
    prerequisiteNodeIds: [],
    readiness: null,
    ...overrides,
  };
}

describe('buildAdaptivePathUnlockChain', () => {
  it('builds a structured chain from multiple readiness gaps in stable order', () => {
    const chain = buildAdaptivePathUnlockChain(node({
      readiness: {
        state: 'locked',
        missingCompletedNodeIds: ['card:bode'],
        missingOutcomeRefs: ['outcome:lab'],
        missingEvidenceCount: 2,
        missingCompetencies: ['controlModeling'],
        fallbackNodeIds: [],
      },
    }), [
      { nodeId: 'card:bode', title: 'Bode 图知识卡', target: '/knowledge/cards/bode', type: 'knowledge_card' },
      { nodeId: 'node-e', title: '节点 E', target: '/simulations/node-e' },
    ]);

    expect(chain.canExplain).toBe(true);
    expect(chain.missingConditions.map((item) => item.kind)).toEqual([
      'completed-node',
      'outcome',
      'evidence',
      'competency',
    ]);
    expect(chain.missingConditions[0]).toMatchObject({
      title: '完成「Bode 图知识卡」',
      current: '未完成',
      required: '已完成',
    });
    expect(chain.nextAction).toMatchObject({
      title: '完成「Bode 图知识卡」后解锁',
      target: '/knowledge/cards/bode',
    });
  });

  it('uses fallback and prerequisite nodes when structured gaps are absent', () => {
    const chain = buildAdaptivePathUnlockChain(node({
      prerequisiteNodeIds: ['card:prep'],
      readiness: {
        state: 'locked',
        fallbackNodeIds: ['card:prep'],
        unlockMessage: '完成准备节点后会自动解锁。',
      },
    }), [
      { nodeId: 'card:prep', title: '准备知识卡' },
    ]);

    expect(chain.canExplain).toBe(true);
    expect(chain.missingConditions).toHaveLength(1);
    expect(chain.missingConditions[0].title).toBe('完成「准备知识卡」');
    expect(chain.nextAction?.title).toBe('完成「准备知识卡」后解锁');
    expect(chain.nextAction?.target).toBeUndefined();
  });

  it('does not link unauthorized or locked prerequisite targets', () => {
    const lockedChain = buildAdaptivePathUnlockChain(node({
      readiness: { state: 'locked', missingCompletedNodeIds: ['card:locked'] },
    }), [{
      nodeId: 'card:locked',
      title: 'Locked card',
      target: '/knowledge/cards/bode',
      type: 'knowledge_card',
      status: 'locked',
    }]);
    const restrictedChain = buildAdaptivePathUnlockChain(node({
      readiness: { state: 'locked', missingCompletedNodeIds: ['card:restricted'] },
    }), [{
      nodeId: 'card:restricted',
      title: 'Restricted card',
      target: '/admin',
      type: 'knowledge_card',
      status: 'available',
    }]);

    expect(lockedChain.nextAction?.target).toBeUndefined();
    expect(restrictedChain.nextAction?.target).toBeUndefined();
  });

  it('falls back to unlockMessage without fabricating a chain', () => {
    const chain = buildAdaptivePathUnlockChain(node({
      readiness: {
        state: 'locked',
        unlockMessage: 'Arena 暂未解锁，完成仿真验证后会自动进入。',
      },
    }));

    expect(chain.canExplain).toBe(false);
    expect(chain.missingConditions).toEqual([]);
    expect(chain.fallbackMessage).toContain('仿真验证');
    expect(chain.nextAction).toBeUndefined();
  });

  it('returns an explicit unavailable message instead of fabricating conditions', () => {
    const chain = buildAdaptivePathUnlockChain(node());

    expect(chain.canExplain).toBe(false);
    expect(chain.missingConditions).toEqual([]);
    expect(chain.reason).toContain('暂时无法展示具体解锁条件');
  });
});

describe('adaptive path option unlock chain display', () => {
  it('attaches a structured unlock chain to a locked option preview node', () => {
    const option: AdaptivePathOptionWriteOption = {
      optionId: 'foundation-route',
      label: '基础路径',
      nodeIds: ['card:bode', 'quiz:locked'],
      nodeSummaries: [
        {
          nodeId: 'card:bode',
          title: 'Bode 图知识卡',
          pathNodeType: 'knowledge_card',
          estimatedTimeMinutes: 8,
          status: 'current',
        },
        {
          nodeId: 'quiz:locked',
          title: '相位裕度练习',
          pathNodeType: 'adaptive_quiz',
          estimatedTimeMinutes: 12,
          status: 'locked',
        },
      ],
      lockedNodeIds: ['quiz:locked'],
      readinessSummary: [
        {
          nodeId: 'quiz:locked',
          state: 'locked',
          message: '完成知识卡后解锁。',
        },
      ],
      readinessDetails: [
        {
          nodeId: 'quiz:locked',
          title: '相位裕度练习',
          readiness: {
            state: 'locked',
            missingCompletedNodeIds: ['card:bode'],
          },
        },
        {
          nodeId: 'card:bode',
          title: 'Bode 图知识卡',
          target: '/knowledge/cards/bode',
          type: 'knowledge_card',
        },
      ],
      targetDeficits: [],
      evidenceBasis: ['学习证据'],
      resourceMix: { knowledge_card: 1, adaptive_quiz: 1 },
      effort: { estimatedMinutes: 20, relative: 'short' },
      terminalValidationNodeIds: [],
      terminalValidationStrategy: {},
      limitations: [],
    };

    const [display] = buildAdaptivePathOptionDisplays([option]);

    expect(display.orderedNodes?.[1]).toMatchObject({
      statusLabel: '稍后解锁',
      unlockMessage: '完成知识卡后解锁。',
    });
    expect(display.orderedNodes?.[1].unlockChain?.canExplain).toBe(true);
    expect(display.orderedNodes?.[1].unlockChain?.missingConditions[0].title).toContain('Bode 图知识卡');
    expect(display.orderedNodes?.[1].unlockChain?.nextAction?.target).toBe('/knowledge/cards/bode');
  });
});

describe('adaptive practice page unlock chain integration', () => {
  it('renders the shared unlock chain view and derives it from readiness', () => {
    const source = readFileSync(
      join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'),
      'utf8',
    );

    expect(source).toContain('buildAdaptivePathUnlockChain({');
    expect(source).toContain('AdaptivePathUnlockChainView chain={node.unlockChain}');
    expect(source).toContain('unlockChain?: AdaptivePathUnlockChain');
  });
});
