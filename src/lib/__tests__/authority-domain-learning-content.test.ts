import { describe, expect, it } from 'vitest';

import {
  attachActiveAuthorityLearningContent,
  loadNodeDetailShard,
  readActiveAuthorityInfograph,
} from '@/lib/authority-domain-shards';

const ACCEPTED_NODE = 'ctc:modeling-865eb1c8824e157c2f05a903';
const BLOCKED_CARD_NODE = 'ctkg:v3e-object-8c4354096b719a1d5e090da4';
const NO_CARD_NODE = 'ctkg:v3e-canonical-62bea9217008b56901615d9a';

describe('Authority learning-content delivery', () => {
  it('binds an accepted runtime card and infograph to the selected active node', () => {
    const detail = attachActiveAuthorityLearningContent(loadNodeDetailShard(ACCEPTED_NODE));

    expect(detail.node.learningContent?.card.state).toBe('available');
    expect(detail.node.learningContent?.infograph.state).toBe('available');
    expect(detail.node.learningContent?.card).not.toMatchObject({
      summary: expect.stringMatching(/(?:ctc:|ctkg:|[a-f0-9]{64}|course-content\/)/i),
    });
    expect(detail.node.learningContent?.infograph).toMatchObject({
      alternativeText: expect.stringContaining('信息图'),
    });
    expect(readActiveAuthorityInfograph(loadNodeDetailShard(ACCEPTED_NODE))?.byteLength).toBeGreaterThan(1000);
  });

  it('keeps blocked and absent cards honest without suppressing semantic detail', () => {
    const blocked = attachActiveAuthorityLearningContent(loadNodeDetailShard(BLOCKED_CARD_NODE));
    const absent = attachActiveAuthorityLearningContent(loadNodeDetailShard(NO_CARD_NODE));

    expect(blocked.node.learningContent?.card).toEqual({
      state: 'blocked',
      message: '该学习卡片仍在完善中。',
    });
    expect(blocked.node.learningContent?.infograph.state).toBe('available');
    expect(absent.node.learningContent?.card).toEqual({
      state: 'missing',
      message: '当前节点暂无已发布学习卡片。',
    });
    expect(absent.node.description).toBeTruthy();
  });
});
