// @vitest-environment jsdom

import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeachingResourceType } from '@/lib/teaching-projection/contracts';
import type { ActiveAuthorityRendererProps } from '../graph/active-renderer/active-authority-renderer-types';

const ai = vi.hoisted(() => ({ updatePageContext: vi.fn(), clearDynamicPageContext: vi.fn() }));
vi.mock('@/components/providers/global-ai-provider', () => ({ useOptionalGlobalAI: () => ai }));

const renderer = vi.hoisted(() => ({
  props: null as ActiveAuthorityRendererProps | null,
  settleOnNodeCount: true,
}));
vi.mock('../graph/active-renderer/active-authority-renderer', () => ({
  ActiveAuthorityRenderer: (props: ActiveAuthorityRendererProps) => {
    renderer.props = props;
    const { onEngineSettled, nodes } = props;
    // 与真实 2D 一致：只在节点集变化时通知，不因回调身份重入。
    useEffect(() => {
      if (renderer.settleOnNodeCount) onEngineSettled?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意不跟随回调身份，避免测试里重入结算。
    }, [nodes.length]);
    return createElement('div', { 'data-test-active-renderer': true });
  },
}));

import { ActiveAuthorityGraph } from '../active-authority-graph';

const envelope = {
  contract: 'act-authority-shard-envelope/v1',
  authorityCatalogVersion: 'acv-production-regression',
  teachingVersion: null,
  localeProfileVersion: 'alp-production-zh-CN',
  match: { authority: true, catalog: true, teaching: null },
};

function object(id: string, label = id) {
  return {
    id, label, description: `${label}的课程定义`, aliases: [], canonicalType: 'DomainConcept',
    governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
    semanticSupport: { supported: true, readOnly: true },
    richTitle: { state: 'missing' }, richDescription: { state: 'missing' },
    memberships: [{ domainId: 'time-domain-analysis', visualRole: 'time', preferred: true }],
  };
}

const selectedId = 'concept-150';
const overview = Array.from({ length: 153 }, (_, i) => object(
  `concept-${i}`, i === 150 ? '峰值时间' : `课程概念${i}`,
));
const neighbor = object('new-neighbor', '动态性能指标');
const relation = {
  id: 'peak-component', sourceId: selectedId, targetId: neighbor.id,
  predicate: 'has_component', direction: 'source_to_target', direct: true,
  layer: 'ENGINEERING', relationFamily: 'structure', qualityTier: 'GOLD',
  governance: { reviewStatus: 'approved', publicationStatus: 'published' },
  semanticSupport: { supported: true, readOnly: true },
};
const rootShard = {
  shardClass: 'root', envelope,
  root: {
    kind: 'presentation-root-catalog',
    domains: [{
      kind: 'presentation-domain', order: 1, displayName: '时域分析', summary: '系统响应',
      presentationRole: 'domain', visualRole: 'time', memberCount: overview.length,
    }],
    aggregate: {
      kind: 'presentation-aggregate', order: 0, displayName: '控制理论综合', summary: '领域概览',
      presentationRole: 'aggregate', visualRole: 'aggregate', domainCount: 1,
    },
  },
};

function response(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('production-shaped Active graph regressions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let domainObjects: Array<ReturnType<typeof object> & { resourceTypes?: readonly TeachingResourceType[] }> ;
  let structureObjects: Array<ReturnType<typeof object> & { resourceTypes?: readonly TeachingResourceType[] }> ;
  let detailResponse: Promise<ReturnType<typeof response>> | null;
  let neighborhoodResponse: Promise<ReturnType<typeof response>> | null;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    domainObjects = [...overview];
    structureObjects = [];
    ai.updatePageContext.mockClear();
    ai.clearDynamicPageContext.mockClear();
    detailResponse = null;
    neighborhoodResponse = null;
    renderer.props = null;
    renderer.settleOnNodeCount = true;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://act.test');
      if (url.pathname.endsWith('/shards/active')) return response(rootShard);
      if (url.pathname.includes('/families/')) return response({
        shardClass: 'relation-family', envelope, domainId: 'time-domain-analysis',
        visualRole: 'time', family: url.pathname.split('/').at(-1), objects: url.pathname.endsWith('/structure') ? structureObjects : [], relations: [], boundaries: [],
      });
      if (url.pathname.includes('/domains/')) return response({
        shardClass: 'domain-default', envelope, domainId: 'time-domain-analysis', visualRole: 'time',
        objects: domainObjects, teachingRelations: [],
        teachingCoverage: { status: 'empty', domainId: 'time-domain-analysis', relationCount: 0, coreNodeCount: 0, note: '当前没有关系' },
      });
      if (url.pathname.includes('/neighborhoods/')) return neighborhoodResponse ?? response({
        shardClass: 'node-neighborhood', envelope, nodeId: url.pathname.split('/').at(-1),
        objects: [overview[150], neighbor], relations: [relation], boundaries: [], limit: 24, truncated: false,
      });
      if (url.pathname.includes('/nodes/')) return detailResponse ?? response({
        shardClass: 'node-detail', envelope, node: {
          ...(url.pathname.endsWith('/new-neighbor') ? neighbor : overview[150]), sources: [], media: { cardAvailable: false, infographAvailable: false },
          resourceBindings: { state: 'unavailable', message: '当前系统资源暂时不可用。' },
        },
      });
      throw new Error(`Unexpected request: ${url.pathname}`);
    }));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function enterDomain() {
    await act(async () => root.render(createElement(ActiveAuthorityGraph, { viewerRole: 'student' })));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-authority-domain-entry="time"]')!.click());
  }

  async function selectPeak() {
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-active-authority-node="${selectedId}"]`)!.click());
  }

  it('dismisses the entry gate after the domain overview is visible even if the engine never settles', async () => {
    renderer.settleOnNodeCount = false;
    await enterDomain();
    expect(renderer.props!.nodes).toHaveLength(153);
    expect(container.querySelector('[data-active-authority-entry-gate]')).toBeNull();
    await selectPeak();
    expect(container.querySelector('[data-active-authority-entry-gate]')).toBeNull();
  });

  it('keeps the 153-node overview visible when selection discloses a neighbor', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    neighborhoodResponse = pending.promise;
    await enterDomain();
    expect(renderer.props!.nodes).toHaveLength(153);
    expect(container.querySelector('[data-active-authority-entry-gate]')).toBeNull();
    await selectPeak();
    expect(renderer.props!.nodes).toHaveLength(153);
    expect(container.querySelector('[data-active-authority-entry-gate]')).toBeNull();
    await act(async () => pending.resolve(response({
      shardClass: 'node-neighborhood', envelope, nodeId: selectedId,
      objects: [overview[150], neighbor], relations: [relation], boundaries: [], limit: 24, truncated: false,
    })));
    expect(renderer.props!.nodes).toHaveLength(154);
    expect(container.querySelector('[data-active-authority-entry-gate]')).toBeNull();
    expect(container.querySelector('[data-active-authority-relation="peak-component"]')).not.toBeNull();
    expect(container.querySelector('[data-authority-relation-family="structure"]')?.getAttribute('aria-checked')).toBe('true');
  });

  it('shows the selected name while loading and falls back from missing rich text', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    detailResponse = pending.promise;
    await enterDomain();
    await selectPeak();
    expect(container.querySelector('[data-active-node-detail]')?.textContent).toContain('峰值时间');
    await act(async () => pending.resolve(response({
      shardClass: 'node-detail', envelope, node: { ...overview[150], sources: [] },
    })));
    expect(container.querySelector('[data-active-node-detail]')?.textContent).toContain('峰值时间的课程定义');
  });

  it('closes only the inspector and reopens the same selected neighborhood', async () => {
    await enterDomain();
    await selectPeak();
    const ids = renderer.props!.nodes.map((node) => node.id);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="关闭节点详情"]')!.click());
    expect(container.querySelector('[data-active-node-detail]')).toBeNull();
    expect(renderer.props!.selectedNodeId).toBe(selectedId);
    expect(renderer.props!.nodes.map((node) => node.id)).toEqual(ids);
    await selectPeak();
    expect(container.querySelector('[data-active-node-detail]')?.textContent).toContain('峰值时间');
  });

  it('updates Konling selection before opening and while another node is selected', async () => {
    await enterDomain();
    await selectPeak();
    expect(ai.updatePageContext.mock.calls.at(-1)?.[0]).toMatchObject({ topic: '峰值时间', knowledgeWorkspaceHint: { selectedNodeId: selectedId, status: 'selected-node' } });
    await act(async () => container.querySelector<HTMLButtonElement>('[data-active-authority-node="new-neighbor"]')!.click());
    expect(ai.updatePageContext.mock.calls.at(-1)?.[0]).toMatchObject({ topic: '动态性能指标', knowledgeWorkspaceHint: { selectedNodeId: 'new-neighbor', status: 'selected-node' } });
    const ids = renderer.props!.nodes.map((node) => node.id);
    await act(async () => renderer.props!.onBackgroundClick?.());
    expect(renderer.props!.selectedNodeId).toBeNull();
    expect(renderer.props!.nodes.map((node) => node.id)).toEqual(ids);
    expect(ai.updatePageContext.mock.calls.at(-1)?.[0].knowledgeWorkspaceHint).toMatchObject({ selectedNodeId: null, status: 'no-selection' });
  });

  it('defaults to concepts and combines an upward type menu with resource presence', async () => {
    domainObjects = [{ ...overview[150], resourceTypes: ['card'] }, overview[0]];
    structureObjects = [{ ...object('formula-node', '公式节点'), canonicalType: 'Formula', resourceTypes: ['simulation'] }];
    await enterDomain();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-authority-relation-family="structure"]')!.click());
    expect(renderer.props!.nodes.map((node) => node.id)).not.toContain('formula-node');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-active-authority-type-menu-trigger]')!.click());
    const menu = document.querySelector<HTMLElement>('[data-active-authority-type-menu]')!;
    expect(menu.dataset.side).toBe('top');
    const formula = menu.querySelector<HTMLButtonElement>('[data-active-authority-type-filter="Formula"]')!;
    expect(formula.getAttribute('aria-checked')).toBe('false');
    await act(async () => formula.click());
    expect(renderer.props!.nodes.map((node) => node.id)).toContain('formula-node');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-active-authority-resource-menu-trigger]')!.click());
    const resourceMenu = document.querySelector<HTMLElement>('[data-active-authority-resource-menu]')!;
    expect(resourceMenu.dataset.side).toBe('top');
    await act(async () => resourceMenu.querySelector<HTMLButtonElement>('[data-active-authority-resource-type="card"]')!.click());
    expect(renderer.props!.nodes.map((node) => node.id)).toEqual([selectedId]);
    await act(async () => resourceMenu.querySelector<HTMLButtonElement>('[data-active-authority-resource-type="simulation"]')!.click());
    expect(renderer.props!.nodes.map((node) => node.id).sort()).toEqual([selectedId, 'formula-node'].sort());
    await act(async () => resourceMenu.querySelector<HTMLButtonElement>('[data-active-authority-resource-type="all"]')!.click());
    expect(renderer.props!.nodes).toHaveLength(3);
  });

  it('keeps runtime arrays stable through hover and renders the plain preview', async () => {
    await enterDomain();
    const nodes = renderer.props!.nodes;
    const links = renderer.props!.links;
    await act(async () => renderer.props!.onNodeHover(nodes.find((node) => node.id === selectedId)!));
    expect(renderer.props!.nodes).toBe(nodes);
    expect(renderer.props!.links).toBe(links);
    expect(container.querySelector('[data-active-authority-hover-preview]')?.textContent).toContain('峰值时间的课程定义');
    await act(async () => renderer.props!.onNodeHover(null));
    expect(renderer.props!.nodes).toBe(nodes);
  });
});
