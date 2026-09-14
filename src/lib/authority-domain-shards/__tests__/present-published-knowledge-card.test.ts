import { describe, expect, it } from 'vitest';

import { presentPublishedKnowledgeCard } from '@/lib/authority-domain-shards/binding-viewer-content';

describe('presentPublishedKnowledgeCard', () => {
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
