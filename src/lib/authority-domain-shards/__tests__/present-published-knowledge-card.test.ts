import { describe, expect, it } from 'vitest';

import { presentPublishedKnowledgeCard } from '@/lib/authority-domain-shards/binding-viewer-content';

describe('presentPublishedKnowledgeCard', () => {
  it('preserves authored Chinese teaching definitions instead of replacing them with graph summaries', () => {
    const summary = '负反馈由比较点相减定义，闭环分母须从明确的信号方程推导。';
    const presented = presentPublishedKnowledgeCard({
      resourceId: 'act:card:ctc_modeling-47e8eb68c1aa5cd068c72e54',
      title: '负反馈回路', canonicalIds: ['ctc:modeling-47e8eb68c1aa5cd068c72e54'],
      card: { summary, insight: null, explanation: '展开解释包含符号约定与稳定性边界。' },
    });
    expect(presented.summary).toBe(summary);
    expect(presented.explanation).toBe('展开解释包含符号约定与稳定性边界。');
  });
  it('prefers zh-CN graph labels and meanings over English v0.12 card copy', () => {
    const presented = presentPublishedKnowledgeCard({
      resourceId: 'act:card:ctc_v11g-21fba199a9fdef15887d600f',
      title: 'lag compensation | lag_compensation',
      canonicalIds: ['ctc:v11g-21fba199a9fdef15887d600f'],
      card: {
        summary: 'lag compensation：A compensation scheme that approximates PI control, used to improve steady-state accuracy of the system.',
        insight: null,
        explanation: 'A compensation scheme that approximates PI control, used to improve steady-state accuracy of the system.',
      },
    });
    expect(presented.title).toBe('滞后补偿');
    expect(presented.summary).toMatch(/校正|补偿/);
    expect(presented.summary).not.toMatch(/lag compensation/i);
    expect(presented.explanation).toBe(presented.summary);
  });
});
