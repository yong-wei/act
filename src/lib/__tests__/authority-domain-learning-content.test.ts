import { afterEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';

import * as teachingProjectionStore from '@/lib/teaching-projection/store';

import {
  attachActiveAuthorityLearningContent,
  loadNodeDetailShard,
  readActiveAuthorityInfograph,
} from '@/lib/authority-domain-shards';

const ACCEPTED_NODE = 'ctc:modeling-865eb1c8824e157c2f05a903';
const BLOCKED_CARD_NODE = 'ctkg:v3e-object-8c4354096b719a1d5e090da4';
const NO_CARD_NODE = 'ctkg:v3e-canonical-62bea9217008b56901615d9a';

function alignedDetail(nodeId: string) {
  const detail = loadNodeDetailShard(nodeId);
  const active = teachingProjectionStore.resolveActiveTeachingProjection(
    teachingProjectionStore.resolveTeachingProjectionStorePaths(
      join(process.cwd(), 'course-content/runtime/knowledge/projection'),
    ),
  );
  expect(active.status).toBe('available');
  expect(active.staged).not.toBeNull();
  const staged = active.staged!;
  return {
    ...detail,
    envelope: {
      ...detail.envelope,
      teaching: {
        status: 'available' as const,
        projectionId: staged.projectionId,
        projectionHash: staged.projectionHash,
        teachingCacheFamily: 'fixture-aligned-teaching',
      },
      match: { ...detail.envelope.match, teaching: true as const },
    },
  };
}

describe('Authority learning-content delivery', () => {
  afterEach(() => vi.restoreAllMocks());

  it('binds an accepted runtime card and infograph to the selected active node', () => {
    const detail = attachActiveAuthorityLearningContent(alignedDetail(ACCEPTED_NODE));

    expect(detail.node.learningContent?.card.state).toBe('available');
    expect(detail.node.learningContent?.infograph.state).toBe('available');
    expect(detail.node.learningContent?.card).not.toMatchObject({
      summary: expect.stringMatching(/(?:ctc:|ctkg:|[a-f0-9]{64}|course-content\/)/i),
    });
    expect(detail.node.learningContent?.infograph).toMatchObject({
      alternativeText: expect.stringContaining('信息图'),
    });
    expect(readActiveAuthorityInfograph(alignedDetail(ACCEPTED_NODE))?.byteLength).toBeGreaterThan(1000);
  });

  it('keeps blocked and absent cards honest without suppressing semantic detail', () => {
    const blocked = attachActiveAuthorityLearningContent(alignedDetail(BLOCKED_CARD_NODE));
    const absent = attachActiveAuthorityLearningContent(alignedDetail(NO_CARD_NODE));

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

  it('does not read an independently current projection when the shard Teaching binding is unavailable', () => {
    const projectionResolver = vi.spyOn(teachingProjectionStore, 'resolveActiveTeachingProjection');
    const detail = attachActiveAuthorityLearningContent(loadNodeDetailShard(ACCEPTED_NODE));

    expect(projectionResolver).not.toHaveBeenCalled();
    expect(detail.node.learningContent?.card).toEqual({
      state: 'unavailable',
      message: '当前学习卡片暂时不可用。',
    });
    expect(detail.node.learningContent?.infograph).toEqual({
      state: 'unavailable',
      message: '当前信息图暂时不可用。',
    });
    expect(readActiveAuthorityInfograph(loadNodeDetailShard(ACCEPTED_NODE))).toBeNull();
    expect(projectionResolver).not.toHaveBeenCalled();
  });

  it('does not bridge a stale current projection whose identity differs from the shard envelope', () => {
    const detail = alignedDetail(ACCEPTED_NODE);
    const stale = {
      ...detail,
      envelope: {
        ...detail.envelope,
        teaching: {
          ...detail.envelope.teaching,
          projectionId: `${detail.envelope.teaching.projectionId}-stale`,
          projectionHash: '0'.repeat(64),
        },
      },
    };

    const resolved = attachActiveAuthorityLearningContent(stale);

    expect(resolved.node.learningContent?.card.state).toBe('unavailable');
    expect(resolved.node.learningContent?.infograph.state).toBe('unavailable');
    expect(readActiveAuthorityInfograph(stale)).toBeNull();
  });
});
