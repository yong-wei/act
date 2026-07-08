import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildKnowledgeGraphActiveFilterPayload,
  buildKnowledgeGraphExpansionPayload,
  buildKnowledgeGraphManifestPayload,
  buildKnowledgeGraphRemainingPayload,
  buildKnowledgeGraphRootPayload,
  getKnowledgeGraphVersion,
  type UnifiedKnowledgeGraphPayload,
} from '@/lib/knowledge-graph-source';
import { injectChapterNodes } from '@/features/knowledge/graph/filter-utils';

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
    expect(active.links.map((link) => link.id)).toEqual(['link-ab']);
    expect(remaining.links.map((link) => link.id)).toEqual(['link-ab', 'link-bc']);
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

    expect(source).toContain("fetchProgressivePayload('root')");
    expect(source).not.toContain("fetch('/api/knowledge/graph'");
    expect(source).toContain('nodesById');
    expect(source).toContain('linksByKey');
    expect(source).toContain('loadedShardKeys');
    expect(source).toContain('loadingShardKeys');
    expect(source).toContain('expandedNodeIds');
    expect(source).toContain('loadingExpansionNodeIds');
    expect(source).toContain('resetForVersion');
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
});
