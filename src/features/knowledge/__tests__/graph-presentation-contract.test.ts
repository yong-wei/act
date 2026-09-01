import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { projectActiveNodeMathematics } from '../active-authority-graph-contracts';
import {
  KNOWLEDGE_GRAPH_PRODUCT_VERSION,
  knowledgeGraphProductVersionLabel,
  layoutKnowledgeNodeLabel,
  layoutKnowledgeRootLabel,
} from '../graph/graph-presentation-contract';
import {
  KNOWLEDGE_GRAPH_COMPACT_MAX_WIDTH,
  KNOWLEDGE_GRAPH_SUPPORTED_VIEWPORTS,
} from '../graph/viewport-fit';
import { REGISTERED_PEER_DOMAIN_IDS } from '@/lib/authority-domain-catalog/contracts';

describe('shared graph presentation contract', () => {
  it('exposes ordinary product version names without internal Authority or Legacy titles', () => {
    expect(knowledgeGraphProductVersionLabel('active')).toBe('新版');
    expect(knowledgeGraphProductVersionLabel('legacy')).toBe('旧版');
    expect(KNOWLEDGE_GRAPH_PRODUCT_VERSION.active.label).toBe('新版');
    expect(KNOWLEDGE_GRAPH_PRODUCT_VERSION.legacy.label).toBe('旧版');
  });

  it('reuses the established node and root label layouts', () => {
    const node = layoutKnowledgeNodeLabel('传递函数建模基础对象');
    expect(node.lines.length).toBeGreaterThan(1);
    expect(node.truncated).toBe(false);
    const root = layoutKnowledgeRootLabel('传递函数、系统模型与时域分析方法');
    expect(root.lines.length).toBeGreaterThan(1);
    expect(root.truncated).toBe(false);
  });

  it('projects only declared formula_latex as governed mathematics', () => {
    expect(projectActiveNodeMathematics({ formula_latex: 'G(s)=\\frac{1}{s}' })).toEqual({
      state: 'available',
      expression: 'G(s)=\\frac{1}{s}',
      display: 'block',
    });
    expect(projectActiveNodeMathematics({ concept_kind: 'engineering' })).toEqual({ state: 'missing' });
    expect(projectActiveNodeMathematics({ formula_latex: '   ' })).toEqual({ state: 'missing' });
  });

  it('keeps the active graph on shared presentation contracts without Legacy DTOs', () => {
    const workspace = readFileSync(path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-workspace.tsx'), 'utf8');
    const activeGraph = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-graph.tsx'), 'utf8');
    expect(workspace).toContain('knowledgeGraphProductVersionLabel');
    expect(workspace).toContain("knowledgeGraphProductVersionLabel('active')");
    expect(workspace).toContain("knowledgeGraphProductVersionLabel('legacy')");
    expect(activeGraph).toContain('ActiveAuthorityRuntimeView');
    expect(activeGraph).not.toMatch(/from ['"]\.\/knowledge-graph-system['"]/);
    expect(activeGraph).not.toContain('KnowledgeGraphSystem');
    expect(activeGraph).not.toContain('ActiveAuthorityForceCanvas');
    expect(activeGraph).not.toContain('ActiveAuthorityRootCanvas');
  });

  it('keeps every catalog domain on bounded shared-runtime shards with identical denominators', () => {
    const runtimeRoot = path.join(process.cwd(), 'course-content/runtime/knowledge');
    const catalog = JSON.parse(readFileSync(
      path.join(runtimeRoot, 'authority-domain-catalog/catalog.json'),
      'utf8',
    )) as {
      domains: Array<{ domainId: string; memberCount: number }>;
      memberships: unknown[];
    };
    const catalogDomainIds = catalog.domains.map((domain) => domain.domainId);
    // The denominator is the exact active catalog; the historical constant
    // must not stand in for it (#1738).
    expect(catalogDomainIds).toHaveLength(15);
    expect(catalogDomainIds).not.toEqual([...REGISTERED_PEER_DOMAIN_IDS]);
    expect(REGISTERED_PEER_DOMAIN_IDS).toHaveLength(8);

    const pointer = JSON.parse(readFileSync(
      path.join(runtimeRoot, 'authority-domain-shards/current.json'),
      'utf8',
    )) as { shardSetId: string };
    const setRoot = path.join(runtimeRoot, 'authority-domain-shards/sets', pointer.shardSetId);
    const manifest = JSON.parse(readFileSync(path.join(setRoot, 'manifest.json'), 'utf8')) as {
      counts: {
        domainDefault: number;
        relationFamily: number;
        searchIndex: number;
        coverage: number;
      };
      files: Record<string, string>;
    };
    const coverage = JSON.parse(readFileSync(path.join(setRoot, 'coverage.json'), 'utf8')) as {
      catalogDomainCount: number;
      defaultShardCount: number;
      searchIndexCount: number;
      domains: Array<{ domainId: string; overviewTypes: string[] }>;
      closure: { complete: boolean; catalogMemberCount: number };
    };
    // Structural identity: catalog count, manifest counts, sealed defaults,
    // search indexes and the coverage denominator are all the same fifteen.
    expect(manifest.counts.domainDefault).toBe(catalogDomainIds.length);
    expect(manifest.counts.searchIndex).toBe(catalogDomainIds.length);
    expect(manifest.counts.coverage).toBe(1);
    expect(coverage.catalogDomainCount).toBe(catalogDomainIds.length);
    expect(coverage.defaultShardCount).toBe(catalogDomainIds.length);
    expect(coverage.searchIndexCount).toBe(catalogDomainIds.length);
    expect(coverage.closure.complete).toBe(true);
    expect(coverage.domains.map((row) => row.domainId).sort()).toEqual([...catalogDomainIds].sort());
    for (const domain of coverage.domains) {
      expect(domain.overviewTypes).toEqual(['DomainConcept']);
      expect(manifest.files[`domains/${domain.domainId}/default.json`]).toMatch(/^[a-f0-9]{64}$/u);
      expect(manifest.files[`domains/${domain.domainId}/search-index.json`]).toMatch(/^[a-f0-9]{64}$/u);
    }

    // Every visible root entry resolves to a sealed bounded concept overview;
    // the seven formerly missing v0.37 domains are no longer ghost entries.
    const largestShard = JSON.parse(readFileSync(
      path.join(setRoot, 'domains/state-space-control-analysis-and-design/default.json'),
      'utf8',
    )) as {
      shardClass: string;
      objects: Array<{ canonicalType: string }>;
      teachingRelations: unknown[];
    };
    expect(largestShard.shardClass).toBe('domain-default');
    expect(largestShard.objects.length).toBeLessThan(catalog.memberships.length);
    expect(largestShard.objects.every((object) => object.canonicalType === 'DomainConcept')).toBe(true);
    expect(largestShard).not.toHaveProperty('fullGraph');
    expect(largestShard).not.toHaveProperty('engineering');

    const activeGraph = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/active-authority-graph.tsx'),
      'utf8',
    );
    expect(activeGraph).toContain('data-latest-cutover-ready');
    expect(activeGraph).toContain("teachingCoverage?.note !== '教学关系暂不可用'");
    expect(activeGraph).toContain("showUnavailableTeachingDirectory={!latestCutoverReady && teachingCoverage?.note === '教学关系暂不可用'}");
    expect(KNOWLEDGE_GRAPH_COMPACT_MAX_WIDTH).toBe(639);
    expect(KNOWLEDGE_GRAPH_SUPPORTED_VIEWPORTS).toMatchObject({
      desktop: { width: 1440 },
      mobileNarrow: { width: 320 },
      mobile: { width: 390 },
    });
  });
});
