import { describe, expect, it } from 'vitest';
import {
  createKnowledgeExpansionCommitQueue,
  isExpansionFilteredEmpty,
  resolveKnowledgeNodeActivation,
  shouldCommitKnowledgeExpansionPayload,
  shouldCommitKnowledgeNodeActivation,
} from '../graph/node-activation';

describe('knowledge node direct activation resolver', () => {
  it.each([
    [{ expansionState: 'expandable', expanded: false }, 'expand'],
    [{ expansionState: 'expandable', expanded: true }, 'collapse'],
    [{ expansionState: 'expandable', expanded: true, filteredEmpty: true }, 'collapse'],
    [{ expansionState: 'leaf', expanded: false }, 'inspect'],
    [{ expansionState: 'unknown', expanded: false }, 'resolve'],
    [{ expansionState: 'unknown', expanded: false, error: true }, 'resolve'],
    [{ expansionState: 'expandable', expanded: false, error: true }, 'expand'],
    [{ expansionState: 'expandable', expanded: false, loading: true }, 'ignore'],
  ] as const)('maps %o to %s', (input, expected) => {
    expect(resolveKnowledgeNodeActivation(input)).toBe(expected);
  });
});

describe('activation async and filter guards', () => {
  it('commits deferred expansion responses in activation-intent order', async () => {
    const queue = createKnowledgeExpansionCommitQueue();
    const committed: string[] = [];
    queue.register(1);
    queue.register(2);
    const second = Promise.resolve().then(() => queue.settle(2, () => committed.push('second')));
    await second;
    expect(committed).toEqual([]);
    await Promise.resolve().then(() => queue.settle(1, () => committed.push('first')));
    expect(committed).toEqual(['first', 'second']);
  });

  it('unblocks later responses when an earlier activation fails or is cancelled', () => {
    const queue = createKnowledgeExpansionCommitQueue();
    const committed: string[] = [];
    queue.register(1);
    queue.register(2);
    queue.settle(2, () => committed.push('second'));
    queue.settle(1);
    expect(committed).toEqual(['second']);
  });
  it('accepts a valid earlier expansion payload after a later node activation', () => {
    expect(shouldCommitKnowledgeExpansionPayload({
      mounted: true,
      aborted: false,
      expectedGeneration: 2,
      currentGeneration: 2,
    })).toBe(true);
  });
  it('recovers a cached filtered-empty expansion without another request', () => {
    expect(isExpansionFilteredEmpty({ shardLoaded: true, nodeId: 'a', visibleLinks: [] })).toBe(true);
    expect(isExpansionFilteredEmpty({
      shardLoaded: true,
      nodeId: 'a',
      visibleLinks: [{ sourceId: 'a', targetId: 'b' }],
    })).toBe(false);
    expect(resolveKnowledgeNodeActivation({ expansionState: 'expandable', expanded: true, filteredEmpty: true })).toBe('collapse');
  });

  it.each([
    { mounted: false, aborted: false, currentGeneration: 2, currentSequence: 3 },
    { mounted: true, aborted: true, currentGeneration: 2, currentSequence: 3 },
    { mounted: true, aborted: false, currentGeneration: 1, currentSequence: 3 },
    { mounted: true, aborted: false, currentGeneration: 2, currentSequence: 4 },
  ])('rejects stale failure/result state: %o', (state) => {
    expect(shouldCommitKnowledgeNodeActivation({
      ...state,
      expectedGeneration: 2,
      expectedSequence: 3,
    })).toBe(false);
  });
});
