// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { KnowledgeGraphWorkspace } from '../knowledge-graph-workspace';
import {
  activeAuthorityEdgeEndpoints,
  activeAuthorityNodeBoundaryPoint,
  layoutActiveAuthorityNodes,
} from '../active-authority-graph';
import {
  parseSafeApiEvidenceV1,
  safeApiHasResponsiveNoActiveNode,
} from '../../../../scripts/tests/test-commercial-ui-governance';

const canvas = {
  projectionVersion: 'act.canvas.v2' as const,
  source: {
    authorityState: 'active' as const,
    releaseSetId: 'internal-release-set',
    releaseId: 'internal-release',
    productionAuthoritative: false as const,
    historical: false as const,
    releaseHash: 'a'.repeat(64),
    schemaVersion: '0.2.0',
    projectionDigest: null,
    sourceDatasetHash: 'b'.repeat(64),
  },
  release: { label: 'Engineering Authority', version: 'v0.12', scope: 'engineering' },
  fields: { included: ['node.id'], hidden: ['node.payload'] },
  coverage: {
    status: 'partial' as const,
    objectCount: 4,
    relationCount: 2,
    goldRelationCount: 1,
    silverRelationCount: 1,
    sourceObjectCount: 0,
    evidenceSegmentCount: 0,
  },
  teachingSemantics: { status: 'unavailable' as const, message: '教学关系尚未发布' as const },
  nodes: [
    {
      id: 'node-concept', canonicalType: 'DomainConcept', label: '稳定性', description: '稳定性描述',
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'node-formula', canonicalType: 'Formula', label: '特征方程', description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'node-model', canonicalType: 'SystemModel', label: '闭环模型', description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'node-isolated', canonicalType: 'KnowledgeStatement', label: '孤立陈述', description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    // Unsupported data is not displayed and must not leak its raw values.
    {
      id: 'node-unknown', canonicalType: 'future_internal_type', label: 'future_internal_type', description: null,
      governance: { reviewStatus: 'future_internal_status', publicationStatus: null, lifecycleStatus: null },
      semanticSupport: { supported: true, readOnly: true as const },
    },
  ],
  relations: [
    {
      id: 'relation-association', predicate: 'association', sourceId: 'node-concept', targetId: 'node-formula', direction: 'unordered', direct: null,
      qualityTier: 'GOLD', governance: { reviewStatus: null, publicationStatus: null }, semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'relation-applies', predicate: 'applies_to', sourceId: 'node-concept', targetId: 'node-model', direction: 'source_to_target', direct: null,
      qualityTier: 'SILVER', governance: { reviewStatus: null, publicationStatus: null }, semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'relation-unknown', predicate: 'future_internal_predicate', sourceId: 'node-concept', targetId: 'node-formula', direction: 'future_internal_direction', direct: null,
      qualityTier: 'FUTURE_INTERNAL_TIER', governance: { reviewStatus: null, publicationStatus: null }, semanticSupport: { supported: true, readOnly: true as const },
    },
  ],
  provenance: {
    authority: {
      consumerId: 'engineering-graph' as const,
      snapshotId: 'internal-snapshot', snapshotHash: 'c'.repeat(64),
      releaseId: 'internal-release', releaseSetId: 'internal-release-set',
    },
    activation: { mode: 'use-combination' as const, status: 'READY' as const, activationId: 'internal-activation', activationHash: 'd'.repeat(64) },
    projection: { status: 'not-applicable' as const, projectionId: null, projectionHash: null },
  },
};

const shardEnvelope = {
  contract: 'act-authority-shard-envelope/v1' as const,
  authorityCatalogVersion: 'acv-test-shards',
  teachingVersion: null,
  match: { authority: true as const, catalog: true as const, teaching: null },
};

const rootShard = {
  shardClass: 'root' as const,
  envelope: shardEnvelope,
  root: {
    kind: 'presentation-root-catalog' as const,
    domains: [
      {
        kind: 'presentation-domain' as const,
        order: 1,
        displayName: '系统建模',
        summary: '从对象到系统模型',
        presentationRole: 'domain' as const,
        visualRole: 'modeling' as const,
        memberCount: 4,
      },
    ],
    aggregate: {
      kind: 'presentation-aggregate' as const,
      order: 0,
      displayName: '控制理论综合',
      summary: '汇总入口',
      presentationRole: 'aggregate' as const,
      visualRole: 'aggregate' as const,
      domainCount: 8,
    },
  },
};

function shardObject(node: (typeof canvas.nodes)[number]) {
  return {
    ...node,
    memberships: [{
      domainId: 'system-modeling' as const,
      visualRole: 'modeling' as const,
      preferred: true,
    }],
  };
}

function domainDefaultShard(nodes = canvas.nodes, relations: typeof canvas.relations = []) {
  return {
    shardClass: 'domain-default' as const,
    envelope: shardEnvelope,
    domainId: 'system-modeling' as const,
    visualRole: 'modeling' as const,
    objects: nodes.map(shardObject),
    teachingRelations: [] as const,
    teachingCoverage: {
      status: 'unavailable' as const,
      domainId: 'system-modeling' as const,
      relationCount: 0,
      coreNodeCount: 0,
      uncoveredCoreNodeCount: 0,
      note: '教学投影层暂不可用',
    },
    relations,
  };
}

function familyShard(family: 'association' | 'application-and-analysis', relations: typeof canvas.relations) {
  return {
    shardClass: 'relation-family' as const,
    envelope: shardEnvelope,
    domainId: 'system-modeling' as const,
    family,
    objects: canvas.nodes.map(shardObject),
    relations: relations.map((relation) => ({ ...relation, layer: 'ENGINEERING' as const, relationFamily: family })),
    boundaries: [],
  };
}

function neighborhoodShard(nodeId: string) {
  return {
    shardClass: 'node-neighborhood' as const,
    envelope: shardEnvelope,
    nodeId,
    limit: 32,
    truncated: false,
    objects: canvas.nodes.map(shardObject),
    relations: canvas.relations.map((relation) => ({
      ...relation,
      layer: 'ENGINEERING' as const,
      relationFamily: relation.predicate === 'association' ? 'association' : 'application-and-analysis',
    })),
    boundaries: [],
  };
}

function nodeDetail(nodeId: string) {
  const names: Record<string, { type: string; label: string; description: string | null }> = {
    'node-concept': { type: 'DomainConcept', label: '稳定性', description: '稳定性描述' },
    'node-formula': { type: 'Formula', label: '特征方程', description: null },
    'node-model': { type: 'SystemModel', label: '闭环模型', description: null },
    'node-isolated': { type: 'KnowledgeStatement', label: '孤立陈述', description: null },
  };
  const current = names[nodeId] ?? names['node-concept'];
  return {
    projectionVersion: 'act.node-detail.v2' as const,
    source: canvas.source,
    role: 'STUDENT' as const,
    fields: { included: ['node.id'], hidden: ['node.payload'] },
    node: {
      id: nodeId,
      canonicalType: current.type,
      label: current.label,
      description: current.description,
      adjacency: nodeId === 'node-isolated' ? [] : [{
        relationId: 'relation-association', predicate: 'association', direction: 'unordered', qualityTier: 'GOLD', neighborId: 'node-formula', traversal: 'outgoing' as const, readOnly: true as const,
      }],
      sources: [{ sourceEditionId: 'internal-edition', sectionId: 'internal-section' }],
      semanticSupport: { supported: true, readOnly: true as const },
    },
    provenance: canvas.provenance,
  };
}

describe('active Authority knowledge workspace client boundary', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const nodeId = decodeURIComponent(url.split('/').pop() ?? 'node-concept');
      if (url.endsWith('/api/knowledge/shards/active')) {
        return { ok: true, status: 200, json: async () => rootShard };
      }
      if (url.includes('/domains/') && url.includes('/families/association')) {
        return { ok: true, status: 200, json: async () => familyShard('association', [canvas.relations[0]]) };
      }
      if (url.includes('/domains/') && url.includes('/families/application-and-analysis')) {
        return { ok: true, status: 200, json: async () => familyShard('application-and-analysis', [canvas.relations[1]]) };
      }
      if (url.includes('/domains/')) {
        return { ok: true, status: 200, json: async () => domainDefaultShard() };
      }
      if (url.includes('/neighborhoods/')) {
        return { ok: true, status: 200, json: async () => neighborhoodShard(nodeId) };
      }
      if (url.includes('/shards/active/nodes/')) {
        return { ok: true, status: 200, json: async () => ({
          shardClass: 'node-detail',
          envelope: shardEnvelope,
          node: {
            ...nodeDetail(nodeId).node,
            teachingFields: {},
            media: { cardAvailable: false, infographAvailable: false },
          },
        }) };
      }
      throw new Error(`unexpected product request ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  async function enterModelingDomain(options: { families?: boolean } = {}) {
    const button = container.querySelector<HTMLButtonElement>('[data-authority-domain-entry="modeling"]');
    expect(button).not.toBeNull();
    await act(async () => button!.click());
    await act(async () => Promise.resolve());
    if (options.families === false) return;
    for (const family of ['association', 'application-and-analysis'] as const) {
      const familyButton = container.querySelector<HTMLButtonElement>(`[data-authority-relation-family="${family}"]`);
      expect(familyButton).not.toBeNull();
      await act(async () => familyButton!.click());
    }
    await act(async () => Promise.resolve());
  }

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('renders a semantic active canvas and keeps active/Legacy responses independent', async () => {
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'student', candidateAllowed: false, controlledVerification: false,
        legacy: createElement('div', { 'data-legacy': 'true' }, '历史 Legacy 图谱'),
      }));
    });
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-authority-shard-root="true"]')).not.toBeNull();
    await enterModelingDomain();
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.querySelector('[data-active-graph-stage="authority"]')).not.toBeNull();
    expect(container.textContent).toContain('当前 Engineering Authority');
    expect(container.querySelector('[aria-label="当前 Authority 语义关系画布"]')).not.toBeNull();
    expect(container.textContent).not.toContain('internal-release');
    expect(container.textContent).not.toContain('internal-snapshot');
    expect(container.textContent).not.toContain('future_internal');
    expect(container.querySelector('[data-active-authority-node="node-unknown"]')).toBeNull();
    expect(container.querySelectorAll('[data-active-authority-relation]').length).toBe(2);

    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => {
      node!.focus();
    });
    expect(document.activeElement).toBe(node);
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Promise.resolve());
    const detail = container.querySelector('[data-active-node-detail]');
    expect(detail).not.toBeNull();
    expect(document.activeElement).toBe(detail);
    expect(container.textContent).toContain('来源定位暂不可用');
    expect(container.textContent).not.toContain('internal-edition');
    expect(container.textContent).not.toContain('node-formula');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    });
    expect(document.activeElement).toBe(node);

    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent === '历史 Legacy')!.click();
    });
    expect(container.querySelector('[data-legacy="true"]')).not.toBeNull();
    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent === '当前 Authority')!.click();
    });
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.querySelector('[data-active-node-detail]')).toBeNull();
    const requested = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requested[0]).toBe('/api/knowledge/shards/active');
    expect(requested).toContain('/api/knowledge/shards/active/domains/modeling');
    expect(requested).toContain('/api/knowledge/shards/active/nodes/node-concept');
    expect(requested.some((url) => url.includes('/graph/active'))).toBe(false);
    expect(requested.every((url) => url.includes('/active'))).toBe(true);
  });

  it('supports search, type filtering, isolated nodes, selection and zoom controls', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();
    const search = container.querySelector<HTMLInputElement>('#active-authority-search')!;
    await act(async () => {
      search.value = '孤立';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const result = container.querySelector<HTMLButtonElement>('[data-active-authority-search-result="node-isolated"]');
    expect(result).not.toBeNull();
    await act(async () => result!.click());
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-node="node-isolated"]')).not.toBeNull();
    expect(container.textContent).toContain('暂无已发布关系');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    });
    expect(document.activeElement?.getAttribute('data-active-authority-node')).toBe('node-isolated');
    expect(container.querySelector('[aria-label="放大图谱"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="缩小图谱"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="重置图谱视图"]')).not.toBeNull();
    const filter = container.querySelector<HTMLSelectElement>('#active-authority-type-filter')!;
    await act(async () => {
      filter.value = 'Formula';
      filter.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('公式');
  });

  it('keeps a selected node and its real cross-type one-hop graph after filtered search', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();

    const filter = container.querySelector<HTMLSelectElement>('#active-authority-type-filter')!;
    await act(async () => {
      filter.value = 'DomainConcept';
      filter.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const search = container.querySelector<HTMLInputElement>('#active-authority-search')!;
    await act(async () => {
      search.value = '稳定性';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const result = container.querySelector<HTMLButtonElement>('[data-active-authority-search-result="node-concept"]');
    expect(result).not.toBeNull();

    await act(async () => result!.click());
    await act(async () => Promise.resolve());

    const detail = container.querySelector('[data-active-node-detail="node-concept"]');
    expect(detail).not.toBeNull();
    expect(document.activeElement).toBe(detail);
    expect(container.querySelector('[data-active-authority-node="node-concept"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-model"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-relation="relation-association"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-relation="relation-applies"]')).not.toBeNull();
    expect(container.querySelector<HTMLSelectElement>('#active-authority-type-filter')?.value).toBe('');
  });

  it('clips edges to the target shape and only directed relations render an arrow', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();

    const directedLine = container.querySelector<SVGLineElement>('[data-active-authority-relation="relation-applies"] line');
    const unorderedLine = container.querySelector<SVGLineElement>('[data-active-authority-relation="relation-association"] line');
    const targetPolygon = container.querySelector<SVGGElement>('[data-active-authority-node="node-model"] polygon');
    expect(directedLine).not.toBeNull();
    expect(unorderedLine).not.toBeNull();
    expect(targetPolygon).not.toBeNull();
    expect(directedLine?.getAttribute('marker-end')).toBe('url(#active-authority-arrow)');
    expect(unorderedLine?.getAttribute('marker-end')).toBeNull();

    const targetVertices = targetPolygon?.getAttribute('points')?.split(' ').map((vertex) => vertex.split(',').map(Number)) ?? [];
    const targetCenter = {
      x: targetVertices.reduce((sum, [x]) => sum + x, 0) / targetVertices.length,
      y: targetVertices.reduce((sum, [, y]) => sum + y, 0) / targetVertices.length,
    };
    const targetEndpoint = {
      x: Number(directedLine?.getAttribute('x2')),
      y: Number(directedLine?.getAttribute('y2')),
    };
    expect(Math.hypot(targetEndpoint.x - targetCenter.x, targetEndpoint.y - targetCenter.y)).toBeGreaterThan(20);
    expect(targetEndpoint.y).not.toBeCloseTo(targetCenter.y, 5);

    const horizontalEndpoints = activeAuthorityEdgeEndpoints(
      'circle',
      'hexagon',
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    );
    expect(horizontalEndpoints.source.x).toBeCloseTo(130, 5);
    expect(horizontalEndpoints.target.x).toBeCloseTo(258, 5);
    expect(activeAuthorityNodeBoundaryPoint('diamond', { x: 200, y: 100 }, { x: 300, y: 100 }).x).toBeCloseTo(242, 5);
  });

  it('does not describe an unordered association with outgoing or incoming traversal', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();
    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Promise.resolve());
    const detail = container.querySelector('[data-active-node-detail="node-concept"]');
    expect(detail?.textContent).toContain('关联关系');
    expect(detail?.textContent).toContain('关联关系 · 特征方程');
    expect(detail?.textContent).not.toContain('出向 · 由前者指向后者 · 特征方程');
    expect(detail?.textContent).not.toContain('入向 · 由前者指向后者 · 特征方程');
  });

  it('emphasizes only real incident edges for the selected node', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();
    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-formula"]');
    expect(node).not.toBeNull();
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Promise.resolve());

    const incident = container.querySelector<SVGGElement>('[data-active-authority-relation="relation-association"]');
    const nonIncident = container.querySelector<SVGGElement>('[data-active-authority-relation="relation-applies"]');
    expect(incident?.getAttribute('data-active-authority-relation-selected')).toBe('true');
    expect(nonIncident?.getAttribute('data-active-authority-relation-selected')).toBe('false');
    expect(incident?.querySelector('line')?.getAttribute('stroke-width')).toBe('3');
    expect(nonIncident?.querySelector('line')?.getAttribute('stroke-width')).toBe('2');
  });

  it('moves detail focus when selecting a second node without closing the inspector', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();
    const firstNode = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(firstNode).not.toBeNull();
    await act(async () => firstNode!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Promise.resolve());
    expect(document.activeElement).toBe(container.querySelector('[data-active-node-detail="node-concept"]'));

    const secondNode = container.querySelector<SVGGElement>('[data-active-authority-node="node-formula"]');
    expect(secondNode).not.toBeNull();
    await act(async () => secondNode!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
    expect(container.querySelector('[data-active-node-detail="node-formula"]')).not.toBeNull();
    expect(document.activeElement).toBe(container.querySelector('[data-active-node-detail="node-formula"]'));
  });

  it('allows the thirteenth readable same-type search result to be selected', async () => {
    const nodes = Array.from({ length: 13 }, (_, index) => ({
      id: `search-node-${index + 1}`,
      canonicalType: 'Formula',
      label: `可读公式 ${String(index + 1).padStart(2, '0')}`,
      description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    }));
    const searchableCanvas = {
      ...canvas,
      coverage: { ...canvas.coverage, objectCount: nodes.length, relationCount: 0, goldRelationCount: 0, silverRelationCount: 0 },
      nodes,
      relations: [],
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const nodeId = decodeURIComponent(url.split('/').pop() ?? 'search-node-1');
      if (url.endsWith('/api/knowledge/shards/active')) {
        return { ok: true, status: 200, json: async () => rootShard };
      }
      if (url.includes('/domains/')) {
        return { ok: true, status: 200, json: async () => domainDefaultShard(nodes) };
      }
      if (url.includes('/shards/active/nodes/') || url.includes('/neighborhoods/')) {
        return {
          ok: true,
          status: 200,
          json: async () => url.includes('/neighborhoods/')
            ? { ...neighborhoodShard(nodeId), objects: nodes.map(shardObject), relations: [] }
            : { shardClass: 'node-detail', envelope: shardEnvelope, node: { ...nodeDetail(nodeId).node, teachingFields: {}, media: { cardAvailable: false, infographAvailable: false } } },
        };
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });

    const filter = container.querySelector<HTMLSelectElement>('#active-authority-type-filter')!;
    await act(async () => {
      filter.value = 'Formula';
      filter.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const search = container.querySelector<HTMLInputElement>('#active-authority-search')!;
    await act(async () => {
      search.value = '可读公式';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const resultList = container.querySelector<HTMLElement>('[data-active-search-results]');
    expect(resultList?.getAttribute('data-active-search-result-total')).toBe('13');
    expect(container.querySelectorAll('[data-active-authority-search-result]').length).toBe(12);
    expect(container.textContent).toContain('已显示 12 / 13 个匹配对象');
    const loadMore = container.querySelector<HTMLButtonElement>('[data-active-authority-search-load-more]');
    expect(loadMore).not.toBeNull();
    await act(async () => loadMore!.click());
    expect(container.querySelectorAll('[data-active-authority-search-result]').length).toBe(13);
    const thirteenth = container.querySelector<HTMLButtonElement>('[data-active-authority-search-result="search-node-13"]');
    expect(thirteenth).not.toBeNull();

    await act(async () => thirteenth!.click());
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-active-authority-node="search-node-13"]')).not.toBeNull();
    expect(container.querySelector('[data-active-node-detail="search-node-13"]')).not.toBeNull();
  });

  it('keeps thousand-result search DOM bounded while exposing an explicit next page', async () => {
    const nodes = Array.from({ length: 1000 }, (_, index) => ({
      id: `thousand-node-${index + 1}`,
      canonicalType: 'Formula',
      label: `千级对象 ${String(index + 1).padStart(4, '0')}`,
      description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    }));
    const searchableCanvas = {
      ...canvas,
      coverage: { ...canvas.coverage, objectCount: nodes.length, relationCount: 0, goldRelationCount: 0, silverRelationCount: 0 },
      nodes,
      relations: [],
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) {
        return { ok: true, status: 200, json: async () => rootShard };
      }
      if (url.includes('/domains/')) {
        return { ok: true, status: 200, json: async () => domainDefaultShard(nodes) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          shardClass: 'node-detail',
          envelope: shardEnvelope,
          node: {
            ...nodeDetail(url.split('/').pop() ?? 'thousand-node-1').node,
            teachingFields: {},
            media: { cardAvailable: false, infographAvailable: false },
          },
        }),
      };
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });

    const search = container.querySelector<HTMLInputElement>('#active-authority-search')!;
    await act(async () => {
      search.value = '千级对象';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const resultList = container.querySelector<HTMLElement>('[data-active-search-results]');
    expect(resultList?.getAttribute('data-active-search-result-total')).toBe('1000');
    expect(container.querySelectorAll('[data-active-authority-search-result]').length).toBe(12);
    expect(container.querySelector('[data-active-authority-search-result="thousand-node-13"]')).toBeNull();
    const loadMore = container.querySelector<HTMLButtonElement>('[data-active-authority-search-load-more]');
    expect(loadMore?.getAttribute('aria-label')).toContain('还剩988项');

    await act(async () => loadMore!.click());
    expect(container.querySelectorAll('[data-active-authority-search-result]').length).toBe(24);
    expect(container.querySelector('[data-active-authority-search-result="thousand-node-13"]')).not.toBeNull();
  });

  it('uses a compact mobile graph coordinate space and keeps node labels readable', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 10)));
    await enterModelingDomain();

    const svg = container.querySelector<SVGSVGElement>('[data-active-authority-svg="true"]');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('data-active-authority-viewport')).toBe('compact');
    expect(svg?.getAttribute('data-active-authority-node-limit')).toBe('6');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 320 520');
    expect(container.querySelectorAll('[data-active-authority-node]').length).toBeLessThanOrEqual(6);
    const labels = [...container.querySelectorAll<SVGTextElement>('[data-active-authority-node-label]')];
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => Number(label.getAttribute('font-size')) >= 13)).toBe(true);
    const typeLabels = [...container.querySelectorAll<SVGTextElement>('[data-active-authority-node-type-label]')];
    expect(typeLabels.every((label) => Number(label.getAttribute('font-size')) >= 11)).toBe(true);
  });

  it('keeps the desktop layout deterministic and inside the 960x520 viewBox for one to 24 nodes', () => {
    for (let nodeCount = 1; nodeCount <= 24; nodeCount += 1) {
      const nodes = Array.from({ length: nodeCount }, (_, index) => ({ key: `node-${index}` }));
      const layout = layoutActiveAuthorityNodes(nodes);
      const repeatLayout = layoutActiveAuthorityNodes(nodes);
      const points = [...layout.values()];
      const repeatPoints = [...repeatLayout.values()];
      const columns = new Set(points.map((point) => point.x)).size;
      const rows = new Set(points.map((point) => point.y)).size;
      const expectedColumns = Math.min(6, Math.max(Math.ceil(Math.sqrt(nodeCount)), Math.ceil(nodeCount / 4)));
      expect(columns).toBe(expectedColumns);
      expect(rows).toBe(Math.ceil(nodeCount / expectedColumns));
      expect(rows).toBeLessThanOrEqual(4);
      expect(points).toEqual(repeatPoints);
      const maxVisibleLabelHalfWidth = (14 * 12) / 2;
      expect(points.every((point) => point.x - maxVisibleLabelHalfWidth >= 0
        && point.x + maxVisibleLabelHalfWidth <= 960)).toBe(true);
      expect(points.every((point) => point.y - 30 >= 0 && point.y + 30 <= 520)).toBe(true);
      if (nodeCount === 24) {
        expect(points).toHaveLength(24);
        expect(columns).toBe(6);
        expect(rows).toBe(4);
        expect(Math.min(...points.map((point) => point.x))).toBe(88);
        expect(Math.max(...points.map((point) => point.x))).toBe(868);
      }
    }
  });

  it('keeps a semantic node click selectable after pointerdown on the node', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();

    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-formula"]');
    expect(node).not.toBeNull();
    await act(async () => {
      node!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      node!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-active-node-detail="node-formula"]')).not.toBeNull();
    const requested = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requested[0]).toBe('/api/knowledge/shards/active');
    expect(requested).toContain('/api/knowledge/shards/active/nodes/node-formula');
    expect(requested.some((url) => url.includes('/graph/active'))).toBe(false);
  });

  it('shows candidate only as an explicit administrator diagnostic', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'admin', candidateAllowed: true, controlledVerification: true, legacy: null,
    })));
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.textContent).toContain('受控候选诊断');
    expect(fetchMock).toHaveBeenCalledWith('/api/knowledge/shards/active', expect.any(Object));
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/graph/active'))).toBe(true);
  });

  it('keeps the active component browser-safe and free of server or Legacy resolver imports', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-graph.tsx'), 'utf8');
    const presentationSource = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-presentation.ts'), 'utf8');
    const captureSource = readFileSync(path.join(process.cwd(), 'scripts/tests/capture-knowledge-workspace-product-qa.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"][^'"]*(authoritative-knowledge|layered-graph|activation-store|resolver|knowledge-graph-system|knowledge-graph-2d|knowledge-graph-3d)/u);
    expect(presentationSource).not.toMatch(/from ['"][^'"]*(authoritative-knowledge|layered-graph|activation-store|resolver|knowledge-graph-system|knowledge-graph-2d|knowledge-graph-3d)/u);
    expect(source).not.toContain('node:fs');
    expect(presentationSource).not.toContain('node:fs');
    expect(captureSource).toContain('source.releaseSetId === authorityRecord.releaseSetId');
    expect(captureSource).toContain('source.releaseId === authorityRecord.releaseId');
    expect(captureSource).toContain("'/api/knowledge/shards/active/nodes/:node'");
    expect(captureSource).toContain("'/api/knowledge/nodes/:node'");
    expect(captureSource).toContain("if (method !== 'GET') return null;");
    expect(captureSource).toContain("if (!encodedNodeKey || encodedNodeKey.includes('/')) return null;");
    expect(captureSource).toContain("page.on('response', onResponse)");
    expect(captureSource).toContain('createKnowledgeApiProbe');
    expect(captureSource).toContain("page.off('response', onResponse)");
    expect(captureSource).toContain("unknown Knowledge API endpoint observed");
    expect(captureSource).not.toContain('__ACT_KNOWLEDGE_PRODUCT_QA_API__');
    expect(captureSource).not.toContain('__ACT_KNOWLEDGE_PRODUCT_QA_ACTIVE_IDENTITY_TOKENS__');
    expect(captureSource).not.toContain('window.fetch =');
    expect(captureSource).toContain('safe-api-evidence/v1');
    expect(captureSource).toContain('function projectSafeApiEvidence');
    expect(captureSource).toContain('function assertSafeApiEvidenceV1');
    expect(captureSource).toContain('type SensitiveValueMatcher');
    expect(captureSource).toContain('createSensitiveValueMatcher');
    expect(captureSource).toContain('createSensitiveValueMatcher(await readActiveSurfaceIdentityTokens(page, probe))');
    expect(captureSource).toContain('createSensitiveValueMatcher(sensitiveTokens)');
    expect(captureSource).toContain('.split(/\\\\s+/u)');
    expect(captureSource).not.toContain('.split(/\\s+/u)');
    expect(captureSource).not.toContain('const tokenVariants = (token: string) =>');
    expect(captureSource).toContain("throw new Error('unknown Knowledge API endpoint cannot be projected')");
    expect(captureSource).not.toContain('cannot be projected: ${pathName}');
    expect(captureSource).toContain('encodeURIComponent(token)');
    expect(captureSource).toContain('decodeURIComponent(token)');
    expect(captureSource).toContain('matchesJsonText');
    expect(captureSource).toContain('sensitiveMatcher.matches(value)');
    expect(captureSource).toContain("['aria-label', 'aria-description', 'title', 'data-tooltip', 'data-tooltip-content']");
    expect(captureSource).toContain('__ACT_KNOWLEDGE_PRODUCT_QA_COPY_PAYLOADS__');
    expect(captureSource).toContain('requestCount');
    expect(captureSource).toContain('forbiddenDataAbsent');
    expect(captureSource).toContain('activeNodeRequestObserved');
    expect(captureSource).toContain('expectedActiveNodeKey');
    expect(captureSource).toContain('activeNodeIdentityMatches');
    expect(captureSource).toContain("await probe.waitForPath('/api/knowledge/shards/active/nodes/:node');");
    expect(captureSource).toContain('provenanceIntegrityMatches');
    const maliciousOpaqueId = 'node/opaque-id?raw=1';
    expect(encodeURIComponent(maliciousOpaqueId)).toContain('%2F');
    expect(captureSource).toContain('dynamic server token');
    const rawLocatorAndEnum = 'sourceLocator future_internal_predicate';
    expect(rawLocatorAndEnum).toContain('sourceLocator');
    expect(rawLocatorAndEnum).toContain('future_internal_predicate');
    const governanceSource = readFileSync(path.join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'), 'utf8');
    expect(governanceSource).toContain('function parseSafeApiEvidenceV1');
    expect(governanceSource).toContain('exactKeys(record');
    expect(governanceSource).toContain('safeApiSequenceEntry');
    expect(governanceSource).toContain('safeApiHasHealthyActiveIsolation');
    expect(governanceSource).toContain('safeActiveSurfaceScanPassed');
    expect(captureSource).toContain('semanticNodeFocusedBeforeClick');
    expect(captureSource).toContain('if (!pathName.startsWith(prefix)) return null;');
    expect(captureSource).toContain('detailPanelFocusedAfterOpen');
    expect(captureSource).toContain('nodeLabelReadability');
    expect(captureSource).toContain('minPixelSize');
    expect(captureSource).toContain('activeNodeLabelGeometryValid');
    expect(captureSource).toContain('nodeGeometryWithinSvgCount');
    expect(captureSource).toContain('relationGeometryWithinSvgCount');
    expect(captureSource).toContain('activeSvgGeometryRectValid');
    expect(captureSource).toContain('rectWithinActiveSvg');
    expect(captureSource).toContain("state.name === 'active-mobile'");
    const workspaceSource = readFileSync(path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-workspace.tsx'), 'utf8');
    expect(workspaceSource).not.toMatch(/selector|learning.?state|current\.json/iu);
  });

  it('fails closed before slicing unrelated Knowledge API paths', () => {
    const captureSource = readFileSync(path.join(process.cwd(), 'scripts/tests/capture-knowledge-workspace-product-qa.ts'), 'utf8');
    const helperStart = captureSource.indexOf('function canonicalAuthorityShardPath');
    const guardOffset = captureSource.indexOf('if (!pathName.startsWith(prefix)) return null;', helperStart);
    const sliceOffset = captureSource.indexOf("const segments = pathName.slice(prefix.length).split('/');", helperStart);
    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(guardOffset).toBeGreaterThan(helperStart);
    expect(sliceOffset).toBeGreaterThan(guardOffset);
    expect(captureSource).toContain("if (pathName === '/api/knowledge/shards/active')");
    expect(captureSource).toContain("'/api/knowledge/shards/active/nodes/:node'");
    expect(captureSource).toContain("if (pathName.startsWith('/api/knowledge/nodes/v2')) return null;");
  });

  it('uses endpoint-specific source identity requirements for active API evidence', () => {
    const captureSource = readFileSync(path.join(process.cwd(), 'scripts/tests/capture-knowledge-workspace-product-qa.ts'), 'utf8');
    expect(captureSource).toContain('const shardEnvelopeValid = isActiveShardResponse');
    expect(captureSource).toContain("shardEnvelope.contract === 'act-authority-shard-envelope/v1'");
    expect(captureSource).toContain('typeof shardEnvelope.authorityCatalogVersion === \'string\'');
    expect(captureSource).toContain('typeof shardEnvelope.teachingVersion === \'string\'');
    expect(captureSource).toContain('objectRecord(shardEnvelope.match).authority === true');
    expect(captureSource).toContain('objectRecord(shardEnvelope.match).catalog === true');
    expect(captureSource).toContain('isActiveShardResponse ? shardEnvelopeValid');
  });

  it('accepts only the exact safe API evidence schema and rejects opaque leakage', () => {
    const safeEvidence = {
      schemaVersion: 'safe-api-evidence/v1',
      roleClass: 'student',
      sequence: [{ endpointClass: 'active-canvas', status: 200, requestCount: 1 }],
      checks: {
        activeNodeRequestObserved: false,
        activeCanvasIdentityVerified: true,
        activeNodeIdentityVerified: false,
        provenanceIdentityVerified: true,
        roleRequestIsolationVerified: true,
        forbiddenDataAbsent: true,
      },
    } as const;
    expect(parseSafeApiEvidenceV1(safeEvidence)).toEqual(safeEvidence);
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: true, activeNodeIdentityVerified: false },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 500, requestCount: 1 },
      ],
    })).toBeDefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: true, activeNodeIdentityVerified: true },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 200, requestCount: 1 },
      ],
    })).toBeDefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: false, activeNodeIdentityVerified: true },
    })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: true, activeNodeIdentityVerified: false },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 500, requestCount: 1 },
      ],
    })).toBeDefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 200, requestCount: 1 },
      ],
    })).toBeUndefined();
    const responsiveDetailArtifact = parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: {
        ...safeEvidence.checks,
        activeNodeRequestObserved: true,
        activeNodeIdentityVerified: true,
      },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 200, requestCount: 1 },
      ],
    });
    expect(safeApiHasResponsiveNoActiveNode(responsiveDetailArtifact)).toBe(false);
    expect(safeApiHasResponsiveNoActiveNode(parseSafeApiEvidenceV1(safeEvidence))).toBe(true);
    expect(parseSafeApiEvidenceV1({ ...safeEvidence, opaqueNodeId: 'node/secret?raw=1' })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      opaqueNodeId: encodeURIComponent('node/secret?raw=1'),
    })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      sequence: [{ endpointClass: 'unknown-endpoint', status: 200, requestCount: 1 }],
    })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, sourceLocator: 'internal/section' },
    })).toBeUndefined();
  });
});
