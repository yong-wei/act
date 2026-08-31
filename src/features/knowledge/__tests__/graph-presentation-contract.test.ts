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

  it('keeps the largest admitted peer domain on bounded shared-runtime shards and governed viewports', () => {
    const runtimeRoot = path.join(process.cwd(), 'course-content/runtime/knowledge');
    const catalog = JSON.parse(readFileSync(
      path.join(runtimeRoot, 'authority-domain-catalog/catalog.json'),
      'utf8',
    )) as {
      domains: Array<{ domainId: string; memberCount: number }>;
      memberships: unknown[];
    };
    const largest = catalog.domains
      .filter((domain) => (REGISTERED_PEER_DOMAIN_IDS as readonly string[]).includes(domain.domainId))
      .sort((left, right) => right.memberCount - left.memberCount)[0];
    expect(largest).toMatchObject({
      domainId: 'state-space-control-analysis-and-design',
    });

    const pointer = JSON.parse(readFileSync(
      path.join(runtimeRoot, 'authority-domain-shards/current.json'),
      'utf8',
    )) as { shardSetId: string };
    const setRoot = path.join(runtimeRoot, 'authority-domain-shards/sets', pointer.shardSetId);
    const manifest = JSON.parse(readFileSync(path.join(setRoot, 'manifest.json'), 'utf8')) as {
      counts: { domainDefault: number; relationFamily: number };
      files: Record<string, string>;
    };
    const domainRelative = `domains/${largest?.domainId}/default.json`;
    const largestShard = JSON.parse(readFileSync(path.join(setRoot, domainRelative), 'utf8')) as {
      shardClass: string;
      objects: unknown[];
      teachingRelations: unknown[];
    };
    expect(manifest.counts.domainDefault).toBe(REGISTERED_PEER_DOMAIN_IDS.length);
    expect(manifest.counts.relationFamily).toBeGreaterThan(REGISTERED_PEER_DOMAIN_IDS.length);
    expect(manifest.files[domainRelative]).toMatch(/^[a-f0-9]{64}$/u);
    expect(largestShard.shardClass).toBe('domain-default');
    expect(largestShard.objects.length).toBeLessThan(catalog.memberships.length);
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
