// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const globalAIMocks = vi.hoisted(() => ({
  updatePageContext: vi.fn(),
  clearDynamicPageContext: vi.fn(),
}));

vi.mock('@/components/providers/global-ai-provider', () => ({
  useGlobalAI: () => globalAIMocks,
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import { KnowledgeGraphWorkspace } from '../knowledge-graph-workspace';

const canvas = {
  projectionVersion: 'act.canvas.v2',
  source: {
    authorityState: 'candidate',
    releaseSetId: 'actkg-authoritative-candidate-v2',
    releaseId: 'control-theory-engineering-v0.2',
    productionAuthoritative: false,
    historical: false,
    releaseHash: 'b'.repeat(64),
    schemaVersion: '0.2.0',
    projectionDigest: 'f324255fd77cf5bf3bacf4cc55a7a082faca3339fff2b8410ddca37a00226255',
    sourceDatasetHash: 'd'.repeat(64),
  },
  release: { label: '控制理论工程聚合发布版', version: 'v0.2', scope: 'control-theory-engineering' },
  fields: {
    included: ['node.id', 'relation.direction'],
    hidden: ['node.payload', 'artifact.bytes'],
  },
  coverage: {
    status: 'partial',
    objectCount: 3,
    relationCount: 2,
    goldRelationCount: 1,
    silverRelationCount: 1,
    sourceObjectCount: 0,
    evidenceSegmentCount: 0,
    releaseEntryCount: 5,
    goldNodeCount: 2,
    silverNodeCount: 1,
    upstreamRagReferenceCount: 1,
  },
  teachingSemantics: { status: 'unavailable', message: '教学关系尚未发布' },
  nodes: [
    {
      id: 'concept',
      canonicalType: 'DomainConcept',
      label: '根轨迹',
      description: '根轨迹描述',
      governance: {
        reviewStatus: 'approved',
        publicationStatus: 'published',
        lifecycleStatus: null,
      },
      releaseTier: 'gold',
      candidate: false,
      semanticName: 'root_locus',
      sourceCoverageCount: 2,
      conceptKind: 'analysis_method',
      semanticSupport: { supported: true, readOnly: true },
    },
    {
      id: 'formula',
      canonicalType: 'Formula',
      label: '特征方程',
      description: null,
      governance: {
        reviewStatus: 'approved',
        publicationStatus: 'published',
        lifecycleStatus: null,
      },
      releaseTier: 'gold',
      candidate: false,
      semanticName: 'characteristic_equation',
      sourceCoverageCount: 1,
      conceptKind: null,
      semanticSupport: { supported: true, readOnly: true },
    },
    {
      id: 'model',
      canonicalType: 'SystemModel',
      label: '闭环模型',
      description: null,
      governance: {
        reviewStatus: 'approved',
        publicationStatus: 'published',
        lifecycleStatus: null,
      },
      releaseTier: 'silver',
      candidate: false,
      semanticName: 'closed_loop_model',
      sourceCoverageCount: 0,
      conceptKind: null,
      semanticSupport: { supported: true, readOnly: true },
    },
  ],
  relations: [
    {
      id: 'relation',
      predicate: 'association',
      sourceId: 'concept',
      targetId: 'formula',
      direction: 'unordered',
      direct: null,
      qualityTier: 'GOLD',
      governance: { reviewStatus: null, publicationStatus: null },
      relationFamily: 'domain_semantic',
      evidenceState: 'available',
      releaseTier: 'gold',
      semanticSupport: { supported: true, readOnly: true },
    },
    {
      id: 'silver-relation',
      predicate: 'applies_to',
      sourceId: 'concept',
      targetId: 'model',
      direction: 'source_to_target',
      direct: null,
      qualityTier: 'SILVER',
      governance: { reviewStatus: null, publicationStatus: null },
      relationFamily: 'domain_semantic',
      evidenceState: 'available',
      releaseTier: 'silver',
      semanticSupport: { supported: true, readOnly: true },
    },
  ],
};

function detail(nodeId: 'concept' | 'formula') {
  const incoming = nodeId === 'formula';
  return {
  projectionVersion: 'act.node-detail.v2',
  source: {
    authorityState: 'candidate',
    releaseSetId: 'actkg-authoritative-candidate-v2',
    releaseId: 'control-theory-engineering-v0.2',
    productionAuthoritative: false,
    historical: false,
    releaseHash: 'b'.repeat(64),
    schemaVersion: '0.2.0',
    projectionDigest: 'f324255fd77cf5bf3bacf4cc55a7a082faca3339fff2b8410ddca37a00226255',
    sourceDatasetHash: 'd'.repeat(64),
  },
  role: 'STUDENT',
  fields: {
    included: ['node.id', 'node.adjacency'],
    hidden: ['node.payload'],
  },
  node: {
    id: nodeId,
    canonicalType: incoming ? 'Formula' : 'DomainConcept',
    label: incoming ? '特征方程' : '根轨迹',
    description: incoming ? null : '根轨迹描述',
    releaseTier: 'gold',
    adjacency: [
      {
        relationId: 'relation',
        predicate: 'association',
        direction: 'unordered',
        relationFamily: 'domain_semantic',
        evidenceState: 'available',
        releaseTier: 'gold',
        qualityTier: 'GOLD',
        neighborId: incoming ? 'concept' : 'formula',
        traversal: incoming ? 'incoming' : 'outgoing',
        readOnly: true,
      },
      ...(!incoming ? [{
        relationId: 'silver-relation',
        predicate: 'applies_to',
        direction: 'source_to_target',
        relationFamily: 'domain_semantic',
        evidenceState: 'available',
        releaseTier: 'silver',
        qualityTier: 'SILVER',
        neighborId: 'model',
        traversal: 'outgoing',
        readOnly: true,
      }] : []),
    ],
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
    globalAIMocks.updatePageContext.mockClear();
    globalAIMocks.clearDynamicPageContext.mockClear();
    window.history.replaceState(null, '', '/knowledge');
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

    expect(container.textContent).toContain('控制理论工程聚合发布版');
    expect(container.textContent).toContain('教学关系尚未发布');
    expect(container.textContent).toContain('f324255fd77cf5bf3bacf4cc55a7a082faca3339fff2b8410ddca37a00226255');
    expect(container.textContent).toContain('发布条目 5 · 核心 2 · 扩展 1');
    expect(globalAIMocks.updatePageContext).toHaveBeenLastCalledWith(expect.objectContaining({
      candidateGraph: expect.objectContaining({
        releaseSetId: 'actkg-authoritative-candidate-v2',
        releaseId: 'control-theory-engineering-v0.2',
        coverageStatus: 'ready',
        projectionDigest: 'f324255fd77cf5bf3bacf4cc55a7a082faca3339fff2b8410ddca37a00226255',
        teachingSemanticsAvailability: 'unavailable',
      }),
    }));
    expect(container.querySelector('[data-candidate-relation-direction="undirected"]')).not.toBeNull();
    expect(container.textContent).toContain('关联 · 核心 · 无向/双向');
    const concept = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('根轨迹描述'))!;
    await act(async () => concept.click());
    await act(async () => Promise.resolve());
    expect(container.textContent).toContain('edition-1 · section-1');
    expect(container.querySelector('[data-candidate-detail-direction="undirected"]')?.textContent)
      .toContain('无向/双向');
    expect(container.querySelector('[data-candidate-detail-direction="undirected"]')?.textContent)
      .not.toMatch(/出向|入向/);
    expect(container.querySelector('[data-candidate-detail-quality-tier="GOLD"]')).not.toBeNull();
    expect(container.querySelector('[data-candidate-detail-quality-tier="SILVER"]')?.textContent)
      .toContain('适用于');

    const core = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === '核心')!;
    await act(async () => core.click());
    expect(core.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-candidate-detail-quality-tier="GOLD"]')).not.toBeNull();
    expect(container.querySelector('[data-candidate-detail-quality-tier="SILVER"]')).toBeNull();

    const extension = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === '扩展（含核心）')!;
    await act(async () => extension.click());
    expect(extension.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-candidate-detail-quality-tier="SILVER"]')?.textContent)
      .toContain('适用于');

    const formula = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('特征方程'))!;
    await act(async () => formula.click());
    await act(async () => Promise.resolve());
    expect(globalAIMocks.updatePageContext).toHaveBeenLastCalledWith(expect.objectContaining({
      candidateGraph: expect.objectContaining({
        selectedCanonicalId: 'formula',
        selectedCanonicalType: 'Formula',
        releaseTier: 'gold',
        selectedRelations: [
          expect.objectContaining({
            predicate: 'association',
            direction: 'unordered',
            relationFamily: 'domain_semantic',
            evidenceState: 'available',
            traversal: 'incoming',
            neighborId: 'concept',
          }),
        ],
      }),
    }));
    expect(container.querySelector('[data-candidate-detail-direction="undirected"]')?.textContent)
      .toContain('无向/双向');
    expect(container.querySelector('[data-candidate-detail-direction="undirected"]')?.textContent)
      .not.toMatch(/出向|入向/);

    const legacy = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === '旧版 Legacy')!;
    await act(async () => legacy.click());
    expect(container.querySelector('[data-legacy="true"]')).not.toBeNull();
    expect(globalAIMocks.clearDynamicPageContext).toHaveBeenCalled();

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

  it('restores a fixed-projection canonical selection from the citation URL', async () => {
    window.history.replaceState(null, '', '/knowledge?canonicalId=formula');
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'student',
        candidateAllowed: true,
        controlledVerification: false,
        legacy: createElement('div', { 'data-legacy': 'true' }, 'Legacy graph'),
      }));
    });
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-candidate-node-detail="formula"]')).not.toBeNull();
    expect(container.textContent).toContain('edition-1 · section-1');
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/knowledge/graph/v2',
      '/api/knowledge/nodes/v2/formula',
    ]);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/knowledge/graph'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/knowledge/graph')).toBe(false);
  });

  it('ignores an unknown canonical citation URL without requesting detail or Legacy', async () => {
    window.history.replaceState(null, '', '/knowledge?canonicalId=unknown%0Alegacy');
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'student',
        candidateAllowed: true,
        controlledVerification: false,
        legacy: createElement('div', { 'data-legacy': 'true' }, 'Legacy graph'),
      }));
    });
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-candidate-node-detail]')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/knowledge/graph/v2',
      expect.any(Object),
    );
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
