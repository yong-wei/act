import { describe, expect, it } from 'vitest';

import type { ActiveResourceBinding } from '../active-authority-graph-contracts';
import {
  groupSystemResourceBindingsByKind,
  isPinnedInspectorLearningBinding,
  systemResourceBindings,
} from '../active-authority-inspector-resources';

function binding(input: Partial<ActiveResourceBinding> & Pick<ActiveResourceBinding, 'title' | 'resourceKind'>): ActiveResourceBinding {
  return {
    bindingRole: '讲解',
    availability: 'available',
    launch: { kind: 'viewer-shell', href: null },
    ...input,
  };
}

const pinnedCard = {
  state: 'available',
  summary: '稳定性描述用于判断系统响应是否收敛。',
  insight: '先观察响应，再判断稳定性。',
  explanation: '稳定性反映系统在扰动后的响应趋势。',
};

const pinnedContext = {
  nodeKey: 'node-concept',
  nodeLabel: '稳定性',
  learningContent: {
    card: pinnedCard,
    infograph: { state: 'available', alternativeText: '稳定性 信息图' },
  },
  cardPinned: true,
  infographPinned: true,
};

describe('active Authority inspector system resources', () => {
  it('treats the always-visible node card and infograph as pinned', () => {
    expect(isPinnedInspectorLearningBinding(binding({
      title: '稳定性',
      resourceKind: '知识卡',
      viewer: {
        summary: pinnedCard.summary,
        insight: pinnedCard.insight,
        explanation: pinnedCard.explanation,
      },
    }), pinnedContext)).toBe(true);
    expect(isPinnedInspectorLearningBinding(binding({
      title: '稳定性 信息图',
      resourceKind: '信息图',
      viewer: { imageSrc: '/api/knowledge/published-infograph/safe-node' },
    }), pinnedContext)).toBe(true);
    expect(isPinnedInspectorLearningBinding(binding({
      title: '图甲',
      resourceKind: '信息图',
      viewer: { imageSrc: '/api/knowledge/published-infograph/safe-a' },
    }), pinnedContext)).toBe(false);
    expect(isPinnedInspectorLearningBinding(binding({
      title: '卡片甲',
      resourceKind: '知识卡',
      viewer: { summary: '甲的摘要', insight: '甲的直觉', explanation: '甲的解释' },
    }), pinnedContext)).toBe(false);
    expect(isPinnedInspectorLearningBinding(binding({
      title: '稳定性',
      resourceKind: '知识卡',
      viewer: { summary: '另一份时间常数卡片', insight: null, explanation: '另一份解释' },
    }), pinnedContext)).toBe(true);
  });

  it('keeps extra cards and groups leftover resources by kind', () => {
    const items = [
      binding({
        title: '稳定性',
        resourceKind: '知识卡',
        viewer: {
          summary: pinnedCard.summary,
          insight: pinnedCard.insight,
          explanation: pinnedCard.explanation,
        },
      }),
      binding({
        title: '卡片甲',
        resourceKind: '知识卡',
        viewer: { summary: '甲的摘要', insight: '甲的直觉', explanation: '甲的解释' },
      }),
      binding({
        title: '稳定性 信息图',
        resourceKind: '信息图',
        viewer: { imageSrc: '/api/knowledge/shards/active/nodes/node-concept/infograph' },
      }),
      binding({
        title: '稳定性课程',
        bindingRole: '练习',
        resourceKind: '课程',
        launch: { kind: 'registry-resource', href: '/interactive-learning/courses/unit-3-2-routh-stability-boundary' },
      }),
      binding({
        title: '闭环极点',
        bindingRole: '引用',
        resourceKind: '教材',
        launch: { kind: 'direct-route', href: '/knowledge/published-resource/textbook-a' },
      }),
    ];

    const visible = systemResourceBindings(items, pinnedContext);
    expect(visible.map((item) => item.title)).toEqual(['卡片甲', '稳定性课程', '闭环极点']);
    expect(groupSystemResourceBindingsByKind(visible).map((group) => group.kind)).toEqual(['课程', '教材', '知识卡']);
  });

  it('drops a single leftover infograph when the node already shows one', () => {
    const items = [
      binding({
        title: 'token-safeid 信息图',
        resourceKind: '信息图',
        viewer: { imageSrc: '/api/knowledge/published-infograph/token-safeid' },
      }),
      binding({
        title: '稳定性课程',
        resourceKind: '课程',
        launch: { kind: 'registry-resource', href: '/interactive-learning/courses/unit-3-2-routh-stability-boundary' },
      }),
    ];
    expect(systemResourceBindings(items, pinnedContext).map((item) => item.title)).toEqual(['稳定性课程']);
  });
});
