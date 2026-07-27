// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeGraphWorkspace } from '../knowledge-graph-workspace';

const canvas = {
  projectionVersion: 'act.canvas.v2',
  source: {
    authorityState: 'candidate',
    releaseSetId: 'actkg-authoritative-candidate-v1',
    releaseId: 'root-locus-engineering-v0.1',
    productionAuthoritative: false,
  },
  release: { label: '根轨迹局部发布版', version: 'v0.1', scope: 'root-locus' },
  coverage: {
    status: 'partial',
    objectCount: 2,
    relationCount: 1,
    goldRelationCount: 1,
    silverRelationCount: 0,
    sourceObjectCount: 1,
    evidenceSegmentCount: 1,
  },
  teachingSemantics: { status: 'unavailable', message: '教学关系尚未发布' },
  nodes: [
    {
      id: 'concept',
      canonicalType: 'DomainConcept',
      label: '根轨迹',
      description: '根轨迹描述',
      governance: {
        reviewStatus: 'REVIEWED',
        publicationStatus: 'PUBLISHED',
        lifecycleStatus: 'ACTIVE',
      },
      semanticSupport: { supported: true, readOnly: true },
    },
    {
      id: 'formula',
      canonicalType: 'Formula',
      label: '特征方程',
      description: null,
      governance: {
        reviewStatus: 'REVIEWED',
        publicationStatus: 'PUBLISHED',
        lifecycleStatus: 'ACTIVE',
      },
      semanticSupport: { supported: true, readOnly: true },
    },
  ],
  relations: [{
    id: 'relation',
    predicate: 'association',
    sourceId: 'concept',
    targetId: 'formula',
    direction: 'unordered',
    direct: true,
    qualityTier: 'GOLD',
    governance: { reviewStatus: 'REVIEWED', publicationStatus: 'PUBLISHED' },
    semanticSupport: { supported: true, readOnly: true },
  }],
};

function detail(nodeId: 'concept' | 'formula') {
  const incoming = nodeId === 'formula';
  return {
  projectionVersion: 'act.node-detail.v2',
  source: {
    authorityState: 'candidate',
    releaseSetId: 'actkg-authoritative-candidate-v1',
    releaseId: 'root-locus-engineering-v0.1',
    productionAuthoritative: false,
  },
  role: 'STUDENT',
  node: {
    id: nodeId,
    canonicalType: incoming ? 'Formula' : 'DomainConcept',
    label: incoming ? '特征方程' : '根轨迹',
    description: incoming ? null : '根轨迹描述',
    adjacency: [{
      relationId: 'relation',
      predicate: 'association',
      direction: 'unordered',
      neighborId: incoming ? 'concept' : 'formula',
      traversal: incoming ? 'incoming' : 'outgoing',
      readOnly: true,
    }],
    sources: [{ sourceEditionId: 'edition-1', sectionId: 'section-1' }],
    semanticSupport: { supported: true, readOnly: true },
  },
  };
}

describe('candidate authoritative graph client isolation', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const nodeId = url.endsWith('/formula') ? 'formula' : 'concept';
      return {
        ok: true,
        status: 200,
        json: async () => url.includes('/nodes/v2/') ? detail(nodeId) : canvas,
      };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('uses only independent V2 requests, renders detail, and resets state after switching', async () => {
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'student',
        candidateAllowed: true,
        controlledVerification: false,
        legacy: createElement('div', { 'data-legacy': 'true' }, 'Legacy graph'),
      }));
    });
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain('根轨迹局部发布版');
    expect(container.textContent).toContain('教学关系尚未发布');
    expect(container.querySelector('[data-candidate-relation-direction="undirected"]')).not.toBeNull();
    expect(container.textContent).toContain('关联 · 核心 · 无向/双向');
    const core = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === '核心')!;
    await act(async () => core.click());
    expect(core.getAttribute('aria-pressed')).toBe('true');

    const concept = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('根轨迹描述'))!;
    await act(async () => concept.click());
    await act(async () => Promise.resolve());
    expect(container.textContent).toContain('edition-1 · section-1');
    expect(container.querySelector('[data-candidate-detail-direction="undirected"]')?.textContent)
      .toContain('无向/双向');
    expect(container.querySelector('[data-candidate-detail-direction="undirected"]')?.textContent)
      .not.toMatch(/出向|入向/);

    const formula = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('特征方程'))!;
    await act(async () => formula.click());
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-candidate-detail-direction="undirected"]')?.textContent)
      .toContain('无向/双向');
    expect(container.querySelector('[data-candidate-detail-direction="undirected"]')?.textContent)
      .not.toMatch(/出向|入向/);

    const legacy = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === '旧版 Legacy')!;
    await act(async () => legacy.click());
    expect(container.querySelector('[data-legacy="true"]')).not.toBeNull();

    const candidate = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === '新版候选')!;
    await act(async () => candidate.click());
    await act(async () => Promise.resolve());
    const resetCore = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === '核心')!;
    expect(resetCore.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-candidate-node-detail]')).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/knowledge/graph/v2',
      '/api/knowledge/nodes/v2/concept',
      '/api/knowledge/nodes/v2/formula',
      '/api/knowledge/graph/v2',
    ]);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/knowledge/graph')).toBe(false);
  });

  it('never mounts candidate mode for an ordinary user while the gate is closed', async () => {
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'student',
        candidateAllowed: false,
        controlledVerification: false,
        legacy: createElement('div', { 'data-legacy': 'true' }, 'Legacy graph'),
      }));
    });
    expect(container.querySelector('[data-legacy="true"]')).not.toBeNull();
    expect(container.textContent).not.toContain('新版候选');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a candidate error without requesting Legacy fallback', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ code: 'CANDIDATE_GRAPH_DRIFT' }),
    });
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'admin',
        candidateAllowed: true,
        controlledVerification: true,
        legacy: createElement('div', { 'data-legacy': 'true' }, 'Legacy graph'),
      }));
    });
    await act(async () => Promise.resolve());
    expect(container.textContent).toContain('证据发生漂移');
    expect(container.textContent).toContain('未请求 Legacy API');
    expect(container.querySelector('[data-legacy="true"]')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
