import { describe, expect, it } from 'vitest';

import {
  createKnowledgeGraphNavigationState,
  knowledgeGraphNavigationReducer,
} from '@/features/knowledge/graph/domain-navigation';
import {
  buildInitialGraphCache,
  mergeProgressiveGraphPayload,
  selectKnowledgeNavigationSnapshot,
} from '@/features/knowledge/progressive-graph-cache';
import type { KnowledgeNodeData } from '@/features/knowledge/knowledge-graph-system';

const root = (id: string): KnowledgeNodeData => ({
  id,
  name: id,
  nodeType: 'THEORY',
  description: '',
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  metadata: { isCollapsedRoot: true },
  expansion: { state: 'expandable' },
});

const member = (id: string, chapterName: string): KnowledgeNodeData => ({
  id,
  name: id,
  nodeType: 'THEORY',
  description: '',
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  chapterName,
  metadata: { chapterName },
  expansion: { state: 'leaf' },
});

describe('knowledge graph root/domain navigation reducer', () => {
  it('enters one domain, reports filtered-empty, and returns to root', () => {
    const initial = createKnowledgeGraphNavigationState();
    const loading = knowledgeGraphNavigationReducer(initial, {
      type: 'enter-domain',
      domainId: 'chapter-node:系统模型',
      requestId: 1,
      cached: false,
    });
    expect(loading).toEqual(expect.objectContaining({
      view: { kind: 'domain', domainId: 'chapter-node:系统模型' },
      status: 'loading',
      requestId: 1,
    }));

    const ready = knowledgeGraphNavigationReducer(loading, {
      type: 'domain-loaded',
      domainId: 'chapter-node:系统模型',
      requestId: 1,
    });
    const empty = knowledgeGraphNavigationReducer(ready, {
      type: 'domain-filter-result',
      domainId: 'chapter-node:系统模型',
      visibleMemberCount: 0,
    });
    expect(empty.status).toBe('filtered-empty');
    expect(knowledgeGraphNavigationReducer(empty, { type: 'return-root' })).toEqual(
      createKnowledgeGraphNavigationState()
    );
  });

  it('ignores stale success and failure after a newer domain navigation', () => {
    const first = knowledgeGraphNavigationReducer(createKnowledgeGraphNavigationState(), {
      type: 'enter-domain', domainId: 'chapter-node:基本概念', requestId: 1, cached: false,
    });
    const second = knowledgeGraphNavigationReducer(first, {
      type: 'enter-domain', domainId: 'chapter-node:系统模型', requestId: 2, cached: false,
    });
    const staleSuccess = knowledgeGraphNavigationReducer(second, {
      type: 'domain-loaded', domainId: 'chapter-node:基本概念', requestId: 1,
    });
    const staleFailure = knowledgeGraphNavigationReducer(staleSuccess, {
      type: 'domain-failed', domainId: 'chapter-node:基本概念', requestId: 1, error: 'late',
    });
    expect(staleFailure).toBe(second);
  });

  it('retries the active failed domain with a new request identity', () => {
    const loading = knowledgeGraphNavigationReducer(createKnowledgeGraphNavigationState(), {
      type: 'enter-domain', domainId: 'chapter-node:系统模型', requestId: 1, cached: false,
    });
    const failed = knowledgeGraphNavigationReducer(loading, {
      type: 'domain-failed', domainId: 'chapter-node:系统模型', requestId: 1, error: 'failed',
    });
    const retrying = knowledgeGraphNavigationReducer(failed, {
      type: 'retry-domain', requestId: 2,
    });
    expect(retrying).toEqual(expect.objectContaining({ status: 'loading', requestId: 2, error: null }));
  });
});

describe('knowledge graph versioned root/domain cache', () => {
  it('shows only root nodes or the active domain shard and reuses a cached domain', () => {
    const domainA = 'chapter-node:基本概念';
    const domainB = 'chapter-node:系统模型';
    const roots = mergeProgressiveGraphPayload(buildInitialGraphCache([], []), {
      mode: 'root', graphVersion: 'v1', shardKey: 'v1:shard:root:chapters',
      nodes: [root(domainA), root(domainB)], links: [],
    });
    const withA = mergeProgressiveGraphPayload(roots, {
      mode: 'expansion', domainId: domainA, graphVersion: 'v1', shardKey: `v1:shard:expansion:${domainA}`,
      nodes: [root(domainA), member('a-1', '基本概念')], links: [],
    });
    const withBoth = mergeProgressiveGraphPayload(withA, {
      mode: 'expansion', domainId: domainB, graphVersion: 'v1', shardKey: `v1:shard:expansion:${domainB}`,
      nodes: [root(domainB), member('b-1', '系统模型')], links: [],
    });

    expect(selectKnowledgeNavigationSnapshot(withBoth, { kind: 'root' }).nodes.map((node) => node.id)).toEqual([
      domainA, domainB,
    ]);
    expect(selectKnowledgeNavigationSnapshot(withBoth, { kind: 'domain', domainId: domainA }).nodes.map((node) => node.id)).toEqual([
      domainA, 'a-1',
    ]);
    expect(withBoth.domainShardKeysByDomainId[domainA]).toBe(`v1:shard:expansion:${domainA}`);
  });

  it('clears domain records on a new root version and ignores a late old-domain response', () => {
    const domainId = 'chapter-node:系统模型';
    const v1 = mergeProgressiveGraphPayload(buildInitialGraphCache([], []), {
      mode: 'root', graphVersion: 'v1', shardKey: 'v1:shard:root:chapters', nodes: [root(domainId)], links: [],
    });
    const domainV1 = mergeProgressiveGraphPayload(v1, {
      mode: 'expansion', domainId, graphVersion: 'v1', shardKey: `v1:shard:expansion:${domainId}`,
      nodes: [root(domainId), member('old', '系统模型')], links: [],
    });
    const v2 = mergeProgressiveGraphPayload(domainV1, {
      mode: 'root', graphVersion: 'v2', shardKey: 'v2:shard:root:chapters', nodes: [root(domainId)], links: [],
    });
    const lateV1 = mergeProgressiveGraphPayload(v2, {
      mode: 'expansion', domainId, graphVersion: 'v1', shardKey: `v1:shard:expansion:${domainId}`,
      nodes: [root(domainId), member('late-old', '系统模型')], links: [],
    });

    expect(v2.domainShardKeysByDomainId).toEqual({});
    expect(lateV1).toBe(v2);
    expect(lateV1.nodesById['late-old']).toBeUndefined();
  });

  it.each([
    ['wrong mode', { mode: 'root' as const }],
    ['wrong domain', { domainId: 'chapter-node:基本概念' }],
    ['wrong version', { graphVersion: 'v2' }],
    ['wrong shard', { shardKey: 'v1:shard:expansion:chapter-node:基本概念' }],
  ])('rejects a domain payload with %s identity', (_name, override) => {
    const domainId = 'chapter-node:系统模型';
    const rootCache = mergeProgressiveGraphPayload(buildInitialGraphCache([], []), {
      mode: 'root', graphVersion: 'v1', shardKey: 'v1:shard:root:chapters',
      nodes: [root(domainId)], links: [],
    });
    const payload = {
      mode: 'expansion' as const,
      domainId,
      graphVersion: 'v1',
      shardKey: `v1:shard:expansion:${domainId}`,
      nodes: [root(domainId), member('member', '系统模型')],
      links: [],
      ...override,
    };

    expect(mergeProgressiveGraphPayload(rootCache, payload)).toBe(rootCache);
  });

  it('keeps a truncated domain incomplete and accepts a later complete retry', () => {
    const domainId = 'chapter-node:系统模型';
    const shardKey = `v1:shard:expansion:${domainId}`;
    const rootCache = mergeProgressiveGraphPayload(buildInitialGraphCache([], []), {
      mode: 'root', graphVersion: 'v1', shardKey: 'v1:shard:root:chapters',
      nodes: [root(domainId)], links: [],
    });
    const truncated = mergeProgressiveGraphPayload(rootCache, {
      mode: 'expansion', domainId, graphVersion: 'v1', shardKey,
      nodes: [root(domainId), member('partial', '系统模型')], links: [],
      truncated: { nodes: true, links: false, membershipLinks: false },
    });

    expect(truncated.loadedShardKeys).not.toContain(shardKey);
    expect(truncated.incompleteShardKeys).toContain(shardKey);
    expect(truncated.domainShardKeysByDomainId[domainId]).toBeUndefined();
    expect(truncated.nodesById.partial).toBeUndefined();

    const complete = mergeProgressiveGraphPayload(truncated, {
      mode: 'expansion', domainId, graphVersion: 'v1', shardKey,
      nodes: [root(domainId), member('complete', '系统模型')], links: [],
      truncated: { nodes: false, links: false, membershipLinks: false },
    });
    expect(complete.loadedShardKeys).toContain(shardKey);
    expect(complete.incompleteShardKeys).not.toContain(shardKey);
    expect(complete.domainShardKeysByDomainId[domainId]).toBe(shardKey);
    expect(complete.nodesById.complete).toBeDefined();
  });
});
