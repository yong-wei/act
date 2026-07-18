import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveKnowledgeResourceLaunch } from '../resource-panel/resource-panel';
import {
  buildKnowledgeGraphDomainRequestUrl,
  buildKnowledgeGraphRootRequestUrl,
} from '../graph/knowledge-graph-request';
import {
  DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES,
  KNOWLEDGE_GRAPH_RELATION_FAMILIES,
  selectLearnerVisibleRelationEdges,
} from '../graph/relation-family-controls';

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

const learnerEntryFiles = [
  'src/features/knowledge/knowledge-graph-system.tsx',
  'src/features/knowledge/resource-panel/resource-panel.tsx',
];

function resolveLocalImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/')
    ? join(repoRoot, 'src', specifier.slice(2))
    : resolve(dirname(join(repoRoot, fromFile)), specifier);
  const candidates = extname(base)
    ? [base]
    : [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, join(base, 'index.ts'), join(base, 'index.tsx')];
  const resolved = candidates.find(existsSync);
  return resolved ? normalize(relative(repoRoot, resolved)) : null;
}

function productionImportGraph(entries: string[]): { files: Set<string>; edges: Array<[string, string]> } {
  const visited = new Set<string>();
  const edges: Array<[string, string]> = [];
  const pending = [...entries];
  const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/gu;
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    for (const match of read(file).matchAll(importPattern)) {
      const dependency = resolveLocalImport(file, match[1]);
      if (dependency) {
        edges.push([file, dependency]);
        if (!visited.has(dependency)) pending.push(dependency);
      }
    }
  }
  return { files: visited, edges };
}

describe('knowledge graph archive contract', () => {
  it('keeps learner entry imports outside persisted path ownership', () => {
    const graph = productionImportGraph(learnerEntryFiles);
    expect(graph.files.size).toBeGreaterThan(learnerEntryFiles.length);
    expect(graph.edges.filter(([from, dependency]) => (
      from.startsWith('src/features/knowledge/')
      && (
        dependency.includes('/adaptive/')
        || dependency.includes('adaptive-learning-path')
        || dependency.includes('/learning-paths/')
      )
    ))).toEqual([]);
  });

  it('exposes only root and domain-scoped graph request contracts', () => {
    expect(buildKnowledgeGraphRootRequestUrl({ lessonId: null })).toBe('/api/knowledge/graph?mode=root');
    expect(buildKnowledgeGraphDomainRequestUrl({ domainId: 'chapter-node:第一章' }))
      .toBe('/api/knowledge/graph?mode=expansion&domainId=chapter-node%3A%E7%AC%AC%E4%B8%80%E7%AB%A0');
  });

  it('exposes only the three learner relation families and bounded selected associations', () => {
    const links = Array.from({ length: 30 }, (_, index) => ({
      id: `association-${String(index).padStart(2, '0')}`,
      relation: 'related',
      sourceId: 'selected',
      targetId: `peer-${index}`,
      strength: index / 30,
    }));
    const nodeIds = new Set(['selected', ...links.map((link) => link.targetId)]);
    expect(KNOWLEDGE_GRAPH_RELATION_FAMILIES).toEqual(['child', 'post-requisite', 'association']);
    expect(DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES).toEqual(['post-requisite', 'association']);
    expect(selectLearnerVisibleRelationEdges({
      links,
      activeDomainNodeIds: nodeIds,
      enabledFamilies: KNOWLEDGE_GRAPH_RELATION_FAMILIES,
      selectedNodeId: 'selected',
    }).filter((edge) => edge.family === 'association')).toHaveLength(24);
  });

  it('keeps source-owned launch opaque and independent from persisted path metadata', () => {
    const metadata = {
      launchTarget: 'adaptive-learning/path-node/opaque-7',
      get persistedLearningPath(): never { throw new Error('persisted path was consumed'); },
      get plannedSegments(): never { throw new Error('planned segments were consumed'); },
      get pathEligibility(): never { throw new Error('path eligibility was consumed'); },
    };
    const node = {
      id: 'adaptive-node',
      name: '自适应节点',
      nodeType: 'SCENARIO' as const,
      description: '由自适应路径功能拥有的启动目标',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      resources: [],
      metadata,
    };

    expect(resolveKnowledgeResourceLaunch(node)).toMatchObject({
      href: 'adaptive-learning/path-node/opaque-7',
      label: '启动关联资源',
    });
  });

  it('uses only the normative relation projector contract', () => {
    const sources = [
      read('src/features/knowledge/graph/filter-utils.ts'),
      read('src/lib/knowledge-labels.ts'),
    ].join('\n');

    expect(sources).not.toContain('getRelationCategory');
    expect(read('src/features/knowledge/graph/filter-utils.ts'))
      .toContain('getKnowledgeGraphRelationContract');
  });
});
