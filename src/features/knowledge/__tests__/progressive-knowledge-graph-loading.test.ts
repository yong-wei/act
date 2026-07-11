import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  knowledgeNode: {
    findMany: vi.fn(),
  },
  knowledgeLink: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(async () => {
      throw new Error('file graph unavailable in this test');
    }),
  },
}));

import {
  buildKnowledgeGraphActiveFilterPayload,
  buildKnowledgeGraphExpansionPayload,
  buildKnowledgeGraphManifestPayload,
  buildKnowledgeGraphRemainingPayload,
  buildKnowledgeGraphRootPayload,
  getKnowledgeGraphVersion,
  loadKnowledgeGraphData,
  loadKnowledgeGraphRootData,
  type UnifiedKnowledgeGraphPayload,
} from '@/lib/knowledge-graph-source';
import { injectChapterNodes } from '@/features/knowledge/graph/filter-utils';
import {
  buildInitialGraphCache,
  mergeProgressiveGraphPayload,
} from '@/features/knowledge/progressive-graph-cache';

vi.mock('server-only', () => ({}));

const graphFixture = (): UnifiedKnowledgeGraphPayload => ({
  source: 'file',
  nodes: [
    {
      id: 'node-a',
      name: '一阶系统',
      nodeType: 'THEORY',
      description: '一阶系统描述',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      chapter: 1,
      chapterName: '基本概念',
      metadata: { chapterName: '基本概念' },
    },
    {
      id: 'node-b',
      name: '传递函数',
      nodeType: 'THEORY',
      description: '传递函数描述',
      positionX: 1,
      positionY: 0,
      positionZ: 0,
      chapter: 2,
      chapterName: '系统模型',
      metadata: { chapterName: '系统模型' },
    },
    {
      id: 'node-c',
      name: '状态空间',
      nodeType: 'THEORY',
      description: '状态空间描述',
      positionX: 2,
      positionY: 0,
      positionZ: 0,
      chapter: 2,
      chapterName: '系统模型',
      metadata: { chapterName: '系统模型' },
    },
  ],
  links: [
    {
      id: 'link-ab',
      sourceId: 'node-a',
      targetId: 'node-b',
      relation: 'prerequisite',
      relationType: 'prerequisite',
      strength: 0.9,
    },
    {
      id: 'link-bc',
      sourceId: 'node-b',
      targetId: 'node-c',
      relation: 'related',
      relationType: 'related',
      strength: 0.4,
    },
    {
      id: 'link-ac-contains',
      sourceId: 'node-a',
      targetId: 'node-c',
      relation: 'contains',
      relationType: 'contains',
      strength: 0.7,
    },
  ],
});

describe('progressive knowledge graph loading', () => {
  it('builds a bounded chapter-root payload before full graph data is needed', () => {
    const root = buildKnowledgeGraphRootPayload(graphFixture());

    expect(root.mode).toBe('root');
    expect(root.nodes.map((node) => node.id)).toEqual([
      'chapter-node:基本概念',
      'chapter-node:系统模型',
    ]);
    expect(root.links).toEqual([]);
    expect(root.rootSummaries).toEqual([
      expect.objectContaining({ rootId: 'chapter-node:基本概念', nodeCount: 1, hasExpansion: true }),
      expect.objectContaining({ rootId: 'chapter-node:系统模型', nodeCount: 2, hasExpansion: true }),
    ]);
    expect(root.nodes.every((node) => node.knowledgeDim === undefined && node.bloomLevel === undefined)).toBe(true);
    expect(root.shardKey).toContain(':shard:root:chapters');
    expect(root.nodes.map((node) => node.expansion)).toEqual([
      { state: 'expandable', revealableNeighborCount: 1 },
      { state: 'expandable', revealableNeighborCount: 2 },
    ]);
  });

  it('describes canonical expandable and leaf nodes in every progressive payload', () => {
    const graph = graphFixture();
    graph.nodes.push({
      id: 'node-leaf',
      name: '孤立知识点',
      nodeType: 'THEORY',
      description: '没有可揭示邻居',
      positionX: 3,
      positionY: 0,
      positionZ: 0,
      chapter: 2,
      chapterName: '系统模型',
    });

    const expansion = buildKnowledgeGraphExpansionPayload(graph, 'chapter-node:系统模型');
    const active = buildKnowledgeGraphActiveFilterPayload(graph);
    const remaining = buildKnowledgeGraphRemainingPayload(graph);

    expect(expansion.nodes.find((node) => node.id === 'node-b')?.expansion).toEqual({
      state: 'expandable',
      revealableNeighborCount: 2,
    });
    expect(expansion.nodes.find((node) => node.id === 'node-leaf')?.expansion).toEqual({ state: 'leaf' });
    expect(active.nodes.find((node) => node.id === 'node-c')?.expansion).toEqual({
      state: 'expandable',
      revealableNeighborCount: 2,
    });
    expect(remaining.nodes.find((node) => node.id === 'node-leaf')?.expansion).toEqual({ state: 'leaf' });
    expect(expansion.graphVersion).toBe(active.graphVersion);
    expect(active.graphVersion).toBe(remaining.graphVersion);
  });

  it('normalizes compatibility nodes to unknown and discards descriptors across graph versions', () => {
    const graph = graphFixture();
    const initial = buildInitialGraphCache([graph.nodes[0]], []);
    expect(initial.nodesById['node-a']?.expansion).toEqual({ state: 'unknown' });

    const versionOne = mergeProgressiveGraphPayload(initial, {
      graphVersion: 'graph-v1',
      shardKey: 'graph-v1:root',
      nodes: [{
        ...graph.nodes[1],
        expansion: { state: 'expandable', revealableNeighborCount: 2 },
      }],
    });
    expect(versionOne.nodesById['node-a']?.expansion).toEqual({ state: 'unknown' });
    expect(versionOne.nodesById['node-b']?.expansion).toEqual({
      state: 'expandable',
      revealableNeighborCount: 2,
    });

    const versionTwo = mergeProgressiveGraphPayload(versionOne, {
      graphVersion: 'graph-v2',
      shardKey: 'graph-v2:root',
      nodes: [graph.nodes[2]],
    });
    expect(Object.keys(versionTwo.nodesById)).toEqual(['node-c']);
    expect(versionTwo.nodesById['node-c']?.expansion).toEqual({ state: 'unknown' });
    expect(versionTwo.loadedShardKeys).toEqual(['graph-v2:root']);
  });

  it('keeps virtual chapter roots out of category and Bloom filtering dimensions', () => {
    const graph = graphFixture();
    const injected = injectChapterNodes(graph.nodes, graph.links);
    const virtualRoots = injected.nodes.filter((node) => node.id.startsWith('chapter-node:'));

    expect(virtualRoots.length).toBeGreaterThan(0);
    expect(virtualRoots.every((node) => node.knowledgeDim === undefined && node.bloomLevel === undefined)).toBe(true);
  });

  it('builds expansion and background shards with stable graph version keys', () => {
    const graph = graphFixture();
    const manifest = buildKnowledgeGraphManifestPayload(graph);
    const expansion = buildKnowledgeGraphExpansionPayload(graph, 'chapter-node:系统模型');
    const active = buildKnowledgeGraphActiveFilterPayload(graph);
    const remaining = buildKnowledgeGraphRemainingPayload(graph);

    expect(expansion.graphVersion).toBe(manifest.graphVersion);
    expect(active.graphVersion).toBe(manifest.graphVersion);
    expect(remaining.graphVersion).toBe(manifest.graphVersion);
    expect(expansion.shardKey).toContain(':shard:expansion:chapter-node:系统模型');
    expect(active.shardKey).toBe(manifest.activeFilterShardKey);
    expect(remaining.shardKey).toBe(manifest.remainingShardKey);
    expect(expansion.nodes.map((node) => node.id)).toEqual([
      'chapter-node:系统模型',
      'node-b',
      'node-c',
    ]);
    expect(expansion.links.map((link) => link.id)).toEqual([
      'chapter-link:chapter-node:系统模型->node-b',
      'chapter-link:chapter-node:系统模型->node-c',
      'link-bc',
    ]);
    const nodeExpansion = buildKnowledgeGraphExpansionPayload(graph, 'node-a');
    expect(nodeExpansion.nodes.map((node) => node.id)).toEqual(['node-a', 'node-b', 'node-c']);
    expect(nodeExpansion.links.map((link) => link.id)).toEqual(['link-ab', 'link-ac-contains']);
    const missingExpansion = buildKnowledgeGraphExpansionPayload(graph, '');
    expect(missingExpansion.nodes).toEqual([]);
    expect(missingExpansion.links).toEqual([]);
    expect(missingExpansion.shardKey).toContain(':shard:expansion:missing-node');
    const unknownNodeExpansion = buildKnowledgeGraphExpansionPayload(graph, 'node-missing');
    expect(unknownNodeExpansion.nodes).toEqual([]);
    expect(unknownNodeExpansion.links).toEqual([]);
    const unknownRootExpansion = buildKnowledgeGraphExpansionPayload(graph, 'chapter-node:不存在的章节');
    expect(unknownRootExpansion.nodes).toEqual([]);
    expect(unknownRootExpansion.links).toEqual([]);
    expect(active.links.map((link) => link.id)).toEqual(['link-ab']);
    expect(remaining.links.map((link) => link.id)).toEqual(['link-ab', 'link-bc', 'link-ac-contains']);
  });

  it('keeps /knowledge first render on progressive endpoints and explicit cache state', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/knowledge/knowledge-graph-system.tsx'),
      'utf8'
    );
    const route = readFileSync(
      join(process.cwd(), 'src/app/api/knowledge/graph/route.ts'),
      'utf8'
    );
    const payloadSource = readFileSync(
      join(process.cwd(), 'src/lib/knowledge-graph-source.ts'),
      'utf8'
    );

    expect(source).toContain("fetchProgressivePayload('root')");
    expect(source).not.toContain("fetch('/api/knowledge/graph'");
    expect(source).toContain('nodesById');
    expect(source).toContain('linksByKey');
    expect(source).toContain('loadedShardKeys');
    expect(source).toContain('loadingShardKeys');
    expect(source).toContain('expandedNodeIds');
    expect(source).toContain('loadingExpansionNodeIds');
    expect(source).toContain('isExpansionLinkForNode');
    expect(source).toContain('expandedDirectLinks');
    expect(source).toContain('graphCache.loadedShardKeys.includes(expectedShardKey)');
    expect(source).toContain("fetchProgressivePayload('active-filter')");
    expect(source).toContain("fetchProgressivePayload('remaining')");
    expect(source).toContain('expansionHasVisibleDescendant');
    expect(source).toContain('collapsedRootChildNodesByRootId');
    expect(source).toContain('collapsedRootMatchesNodeFilters');
    expect(source).toContain("relation !== 'contains'");
    expect(source).toContain('data-knowledge-density-mode');
    expect(source).toContain('data-knowledge-full-graph-first-render="avoided"');
    expect(source).toContain('data-knowledge-expansion-control');
    expect(source).not.toContain('void handleToggleSelectedExpansion();');
    expect(route).toContain("mode === 'root'");
    expect(route).toContain("mode === 'expansion'");
    expect(route).toContain("mode === 'active-filter'");
    expect(route).toContain("mode === 'remaining'");
    expect(route).toContain('loadKnowledgeGraphRootData');
    expect(route.indexOf('const mode = searchParams.get')).toBeLessThan(route.indexOf('const graph = await loadKnowledgeGraphData();'));
    expect(route.indexOf("mode === 'root'")).toBeLessThan(route.indexOf('const graph = await loadKnowledgeGraphData();'));
    expect(route.indexOf("mode === 'manifest'")).toBeGreaterThan(route.indexOf('const graph = await loadKnowledgeGraphData();'));
    expect(route).toContain("Missing nodeId for expansion shard.");
    expect(route).toContain('{ status: 400 }');
    const rootFileLoader = payloadSource.slice(
      payloadSource.indexOf('async function loadKnowledgeGraphRootFromFiles'),
      payloadSource.indexOf('async function loadKnowledgeGraphFromDatabase')
    );
    expect(rootFileLoader).toContain('readFileGraphVersionMetadata(relationsPath)');
    expect(rootFileLoader).not.toContain("fs.readFile(relationsPath, 'utf-8')");
    expect(payloadSource).toContain('sharedGraphCacheExpiresAt');
    expect(payloadSource).toContain('rootGraphCache = null');
    expect(payloadSource).toContain('graphCache = null');
    expect(source).toContain('mergeProgressiveGraphPayload');
  });

  it('keeps the chapter sidebar aligned to parent-filtered progressive roots', () => {
    const sidebar = readFileSync(
      join(process.cwd(), 'src/features/knowledge/sidebar/knowledge-sidebar.tsx'),
      'utf8'
    );

    expect(sidebar).toContain('return buildChapterGroups(nodes)');
    expect(sidebar).not.toContain('nodes.filter((node)');
  });

  it('invalidates graph version when middle node content changes without count or edge changes', () => {
    const graph = graphFixture();
    const changed = graphFixture();
    changed.nodes[1] = {
      ...changed.nodes[1],
      description: '传递函数描述已更新',
      metadata: { chapterName: '系统模型', revision: 'middle-node-change' },
    };

    expect(getKnowledgeGraphVersion(changed)).not.toBe(getKnowledgeGraphVersion(graph));
  });

  it('keeps database root and full graph versions aligned while root omits returned links', async () => {
    const graph = graphFixture();
    const databaseNodes = graph.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      nodeType: node.nodeType,
      description: node.description,
      positionX: node.positionX,
      positionY: node.positionY,
      positionZ: node.positionZ,
      bloomLevel: node.bloomLevel ?? null,
      knowledgeDim: node.knowledgeDim ?? null,
      metadata: node.metadata ?? {},
      content: node.content ?? {},
      resources: node.resources ?? [],
      tags: node.tags ?? [],
    }));
    const databaseLinks = graph.links.map((link) => ({
      id: link.id,
      sourceId: link.sourceId,
      targetId: link.targetId,
      relation: link.relation,
    }));

    prismaMock.knowledgeNode.findMany.mockResolvedValue(databaseNodes);
    prismaMock.knowledgeLink.findMany.mockResolvedValue(databaseLinks);
    prismaMock.$queryRaw.mockResolvedValue([{
      linkCount: BigInt(databaseLinks.length),
      fingerprint: 'stable-relation-fingerprint',
    }]);
    prismaMock.knowledgeLink.count.mockResolvedValue(databaseLinks.length);

    const root = await loadKnowledgeGraphRootData();

    expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
    const relationVersionQuery = (prismaMock.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join('?');
    expect(relationVersionQuery).toContain('"id", "sourceId", "targetId", "relation"');
    expect(relationVersionQuery).toContain('ORDER BY "id", "sourceId", "targetId", "relation"');
    expect(prismaMock.knowledgeLink.findMany).not.toHaveBeenCalled();
    expect(root.links).toEqual([]);
    expect(root.versionLinkCount).toBe(databaseLinks.length);

    const full = await loadKnowledgeGraphData();

    expect(root.source).toBe('database');
    expect(full.source).toBe('database');
    expect(prismaMock.knowledgeLink.findMany).toHaveBeenCalledOnce();
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    expect(full.links.length).toBe(databaseLinks.length);
    expect(getKnowledgeGraphVersion(root)).toBe(getKnowledgeGraphVersion(full));
  });

  it('changes database graph version when relation content changes at the same count', async () => {
    const graph = graphFixture();
    const databaseNodes = graph.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      nodeType: node.nodeType,
      description: node.description,
      positionX: node.positionX,
      positionY: node.positionY,
      positionZ: node.positionZ,
      bloomLevel: node.bloomLevel ?? null,
      knowledgeDim: node.knowledgeDim ?? null,
      metadata: node.metadata ?? {},
      content: node.content ?? {},
      resources: node.resources ?? [],
      tags: node.tags ?? [],
    }));
    prismaMock.knowledgeNode.findMany.mockResolvedValue(databaseNodes);
    prismaMock.knowledgeLink.count.mockResolvedValue(graph.links.length);
    prismaMock.$queryRaw.mockResolvedValueOnce([{
      linkCount: BigInt(graph.links.length),
      fingerprint: 'endpoints-and-types-v1',
    }]);
    vi.resetModules();
    const firstModule = await import('@/lib/knowledge-graph-source');
    const firstRoot = await firstModule.loadKnowledgeGraphRootData();

    prismaMock.$queryRaw.mockResolvedValueOnce([{
      linkCount: BigInt(graph.links.length),
      fingerprint: 'endpoints-and-types-v2',
    }]);
    vi.resetModules();
    const secondModule = await import('@/lib/knowledge-graph-source');
    const secondRoot = await secondModule.loadKnowledgeGraphRootData();

    expect(firstRoot.versionLinkCount).toBe(secondRoot.versionLinkCount);
    expect(firstModule.getKnowledgeGraphVersion(firstRoot)).not.toBe(
      secondModule.getKnowledgeGraphVersion(secondRoot)
    );
  });
});
