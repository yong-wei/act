import { describe, expect, it } from 'vitest';
import {
  createKnowledgeExpansionCommitQueue,
  isExpansionFilteredEmpty,
  resolveKnowledgeNodeActivation,
  shouldCommitKnowledgeExpansionPayload,
  shouldCommitKnowledgeNodeActivation,
  selectNewlyMaterializedKnowledgeNodeIds,
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

  it('flushes later responses when an unresolved queue head is explicitly cancelled', () => {
    const queue = createKnowledgeExpansionCommitQueue();
    const committed: string[] = [];
    queue.register(1);
    queue.register(2);
    queue.cancel(1);
    queue.settle(2, () => committed.push('second'));
    expect(committed).toEqual(['second']);
  });

  it('runs cancellation cleanup for a deferred expansion commit', () => {
    const queue = createKnowledgeExpansionCommitQueue();
    const events: string[] = [];
    queue.register(1);
    queue.register(2);
    queue.settle(2, () => events.push('committed'), () => events.push('cancelled'));
    queue.cancel(2);
    queue.settle(1);
    expect(events).toEqual(['cancelled']);
  });

  it('accepts a valid earlier expansion payload after a later node activation', () => {
    expect(shouldCommitKnowledgeExpansionPayload({
      mounted: true,
      aborted: false,
      expectedGeneration: 2,
      currentGeneration: 2,
    })).toBe(true);
  });

  it('materializes payload neighbors hidden at activation even when background cache already contains them', () => {
    expect(selectNewlyMaterializedKnowledgeNodeIds({
      payloadNodeIds: ['center', 'hidden-cached-neighbor', 'new-neighbor'],
      visibleNodeIdsAtActivation: new Set(['center', 'already-visible']),
    })).toEqual(['hidden-cached-neighbor', 'new-neighbor']);
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

  it('allows an active earlier expansion intent after a later parallel activation', () => {
    expect(shouldCommitKnowledgeNodeActivation({
      mounted: true,
      aborted: false,
      expectedGeneration: 2,
      currentGeneration: 2,
      cancelled: false,
    })).toBe(true);
  });

  it.each([
    { mounted: false, aborted: false, currentGeneration: 2, cancelled: false },
    { mounted: true, aborted: true, currentGeneration: 2, cancelled: false },
    { mounted: true, aborted: false, currentGeneration: 1, cancelled: false },
    { mounted: true, aborted: false, currentGeneration: 2, cancelled: true },
  ])('rejects stale or explicitly cancelled result state: %o', (state) => {
    expect(shouldCommitKnowledgeNodeActivation({
      ...state,
      expectedGeneration: 2,
    })).toBe(false);
  });
});
