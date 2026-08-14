// @vitest-environment jsdom

import { StrictMode, act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rendererRegistry = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/components/providers/global-ai-provider', () => ({
  useGlobalAI: () => ({ updatePageContext: vi.fn(), isOpen: false }),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    const renderer = rendererRegistry.count++ === 0 ? '3D' : '2D';
    return function GraphSurface(props: {
      nodes: Array<{ id: string; name: string }>;
      links: Array<{ id: string }>;
      teachingOrderLinks?: Array<{ id: string }>;
      selectedNode?: { id: string } | null;
      onNodeClick: (node: unknown) => void;
      onManipulationStart?: () => void;
      onBackgroundClick: () => void;
      fitViewRequest: { id: number; target: 'current' | 'root' };
      relayoutVersion: number;
      graphVersion: string;
      width: number;
    }) {
      return createElement('div', {
        'data-testid': `graph-surface-${renderer}`,
        'data-node-ids': props.nodes.map((node) => node.id).join(','),
        'data-rendered-link-ids': props.links.map((link) => link.id).join(','),
        'data-teaching-order-link-ids': props.teachingOrderLinks?.map((link) => link.id).join(',') ?? '',
        'data-selected-node-id': props.selectedNode?.id ?? '',
        'data-fit-view-version': String(props.fitViewRequest.id),
        'data-fit-view-target': props.fitViewRequest.target,
        'data-relayout-version': String(props.relayoutVersion),
        'data-graph-version': props.graphVersion,
        'data-renderer-width': String(props.width),
      }, createElement('button', {
        type: 'button', 'data-testid': `manipulation-${renderer}`, onClick: () => props.onManipulationStart?.(),
      }, 'manipulation'), createElement('button', {
        type: 'button', 'data-testid': `background-${renderer}`, onClick: props.onBackgroundClick,
      }, 'background'), props.nodes.map((node) => createElement('button', {
        key: node.id,
        type: 'button',
        'data-testid': `canvas-${renderer}-${node.id}`,
        onClick: () => props.onNodeClick(node),
      }, node.name)));
    };
  },
}));

vi.mock('../resource-panel/resource-panel', () => ({
  ResourcePanel: (props: {
    isOpen: boolean;
    selectedNode: { id: string } | null;
    onClose: () => void;
    onNodeClick: (nodeId: string) => void;
    mobileHeaderControl?: ReturnType<typeof createElement>;
  }) => createElement(
    'div',
    { 'data-testid': 'resource-panel', 'data-open': String(props.isOpen) },
    createElement('button', {
      type: 'button', 'data-testid': 'close-resource-panel', onClick: props.onClose,
    }, 'close'),
    createElement('button', {
      type: 'button', 'data-testid': 'related-b-1', onClick: () => props.onNodeClick('b-1'),
    }, 'related b-1'),
    props.mobileHeaderControl,
    props.selectedNode?.id ?? ''
  ),
}));

import { KnowledgeGraphSystem, type KnowledgeNodeData } from '../knowledge-graph-system';

const domainA = 'chapter-node:基本概念';
const domainB = 'chapter-node:系统模型';

const rootNode = (id: string): KnowledgeNodeData => ({
  id, name: id, nodeType: 'THEORY', description: '',
  positionX: 0, positionY: 0, positionZ: 0,
  metadata: { isCollapsedRoot: true }, expansion: { state: 'expandable' },
});

const memberNode = (id: string, name: string, chapterName: string): KnowledgeNodeData => ({
  id, name, nodeType: 'THEORY', description: '',
  positionX: 0, positionY: 0, positionZ: 0,
  chapterName, metadata: { chapterName }, expansion: { state: 'leaf' },
});

const roots = [rootNode(domainA), rootNode(domainB)];
const members = {
  'a-1': memberNode('a-1', 'A Node', '基本概念'),
  'a-2': memberNode('a-2', 'A Node 2', '基本概念'),
  'b-1': memberNode('b-1', 'B Node', '系统模型'),
};
const rootCatalog = [
  { nodeId: 'a-1', nodeName: 'A Node', nodeType: 'THEORY', domainId: domainA, chapterName: '基本概念' },
  { nodeId: 'a-2', nodeName: 'A Node 2', nodeType: 'THEORY', domainId: domainA, chapterName: '基本概念' },
  { nodeId: 'b-1', nodeName: 'B Node', nodeType: 'THEORY', domainId: domainB, chapterName: '系统模型' },
];

const rootPayload = (
  version = 'v1',
  lessonContext: { lessonId: string } | null = null
) => ({
  mode: 'root', graphVersion: version, shardKey: `${version}:shard:root:chapters`,
  source: 'database', nodes: roots, links: [], rootCatalog,
  lessonContext: lessonContext ? {
    ...lessonContext,
    overlayRevision: `${lessonContext.lessonId}-${version}`,
    cardOrderNodeIds: ['a-1'],
    mappingGaps: { cardOrder: [], links: [] },
  } : null,
  truncated: { nodes: false, links: false, membershipLinks: false },
});
const domainPayload = (
  domainId: string,
  nodes: KnowledgeNodeData[],
  version = 'v1',
  truncated = false,
  links: Array<Record<string, unknown>> = []
) => ({
  mode: 'expansion', domainId, graphVersion: version,
  shardKey: `${version}:shard:expansion:${domainId}`,
  source: 'database', nodes, links,
  truncated: { nodes: truncated, links: false, membershipLinks: false },
});

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json' },
  }));
}

const flush = (milliseconds = 30) => act(async () => new Promise((resolve) => setTimeout(resolve, milliseconds)));

const denseDomainNodes = (domainId: string, chapterName: string, prefix: string) => [
  rootNode(domainId),
  ...Array.from({ length: 100 }, (_, index) => memberNode(`${prefix}-${index}`, `${prefix} ${index}`, chapterName)),
];

describe('knowledge-node-direct-activation-contract', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    rendererRegistry.count = 0;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    history.replaceState({}, '', '/knowledge');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exposes root pending, failure, and retry before accepting the exact root identity', async () => {
    let attempts = 0;
    let settleFirstRoot: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => {
      attempts += 1;
      return attempts === 1
        ? new Promise<Response>((resolve) => { settleFirstRoot = resolve; })
        : json(rootPayload());
    }));

    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    expect(container.querySelector('[data-knowledge-navigation-view]')?.getAttribute('data-knowledge-root-state')).toBe('loading');
    await act(async () => settleFirstRoot?.(new Response('{}', { status: 500 })));
    expect(container.querySelector('[data-knowledge-root-retry]')).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-root-retry]')!.click());
    expect(container.querySelector('[data-knowledge-navigation-view]')?.getAttribute('data-knowledge-root-state')).toBe('ready');
    expect(container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-node-ids')).toBe(`${domainA},${domainB}`);
  });

  it('refits the root and restores focus to the actual root domain control after return', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (
      url.includes('mode=expansion')
        ? json(domainPayload(domainA, [rootNode(domainA), members['a-1']]))
        : json(rootPayload())
    )));

    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    const initialFitVersion = Number(
      container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-fit-view-version')
    );
    expect(Number.isFinite(initialFitVersion)).toBe(true);
    expect(
      container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-fit-view-target')
    ).toBe('root');
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await flush();
    const returnAction = container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!;
    returnAction.focus();
    await act(async () => returnAction.click());
    await flush();

    expect(Number(
      container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-fit-view-version')
    )).toBeGreaterThan(initialFitVersion);
    expect(document.activeElement).toBe(
      container.querySelector(`[data-knowledge-node-control="${domainA}"]`)
    );
  });

  it('restores inspector close focus to the selected node control after the child panel unmounts', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (
      url.includes('mode=expansion')
        ? json(domainPayload(domainA, [rootNode(domainA), members['a-1']]))
        : json(rootPayload())
    )));

    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await flush();

    const nodeControl = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="a-1"]')!;
    nodeControl.focus();
    await act(async () => nodeControl.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="close-resource-panel"]')!.click());
    await flush();
    expect(document.activeElement).toBe(nodeControl);
  });

  it('requests one current-view fit after each dense ordinary domain materializes without a view switch', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes(encodeURIComponent(domainA))) return json(domainPayload(domainA, denseDomainNodes(domainA, '基本概念', 'dense-a')));
      if (url.includes(encodeURIComponent(domainB))) return json(domainPayload(domainB, denseDomainNodes(domainB, '系统模型', 'dense-b')));
      return json(rootPayload());
    }));
    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    const surface = () => container.querySelector('[data-testid="graph-surface-2D"]');
    const initialVersion = surface()?.getAttribute('data-fit-view-version');

    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await flush();
    expect(container.querySelector('[data-knowledge-domain-state]')?.getAttribute('data-knowledge-domain-state')).toBe('ready');
    expect(surface()?.getAttribute('data-node-ids')?.split(',').length).toBeGreaterThan(1);
    expect(Number(surface()?.getAttribute('data-fit-view-version'))).toBeGreaterThan(Number(initialVersion));
    expect(surface()?.getAttribute('data-fit-view-target')).toBe('current');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!.click());
    await flush();
    const returnedVersion = surface()?.getAttribute('data-fit-view-version');
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainB}"]`)!.click());
    await flush();
    expect(Number(surface()?.getAttribute('data-fit-view-version'))).toBeGreaterThan(Number(returnedVersion));
    expect(surface()?.getAttribute('data-fit-view-target')).toBe('current');
  });

  it('finishes dense lesson-domain materialization with a current-domain fit', async () => {
    history.replaceState({}, '', '/knowledge?lessonId=1-1');
    vi.stubGlobal('fetch', vi.fn((url: string) => url.includes(encodeURIComponent(domainA))
      ? json(domainPayload(domainA, denseDomainNodes(domainA, '基本概念', 'lesson-a')))
      : json(rootPayload('v1', { lessonId: '1-1' }))));
    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    expect(container.querySelector('[data-knowledge-active-lesson-id]')?.getAttribute('data-knowledge-active-lesson-id')).toBe('1-1');
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await flush(100);
    expect(Number(container.querySelector('[data-knowledge-layout-fit-scale]')?.getAttribute('data-knowledge-layout-fit-scale'))).toBeLessThan(1);

    expect(container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-fit-view-target')).toBe('current');
  });

  it('shares compact family state while keeping complete post-requisite layout input and inspector state', async () => {
    const canonicalLinks = [
      { id: 'visible-skeleton', sourceId: 'a-1', targetId: 'a-2', relationType: 'prerequisite', strength: 0.95 },
      { id: 'low-strength', sourceId: 'a-2', targetId: 'a-3', relationType: 'leads_to', strength: 0.1 },
      { id: 'child-edge', sourceId: 'a-1', targetId: 'a-2', relationType: 'contains', strength: 1 },
      { id: 'association-edge', sourceId: 'a-1', targetId: 'a-2', relationType: 'related', strength: 0.4 },
    ];
    vi.stubGlobal('fetch', vi.fn((url: string) => (
      url.includes('mode=expansion')
        ? json(domainPayload(domainA, [
            rootNode(domainA),
            members['a-1'],
            members['a-2'],
            memberNode('a-3', 'A Node 3', '基本概念'),
          ], 'v1', false, canonicalLinks))
        : json(rootPayload())
    )));

    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await flush();

    const graph = container.querySelector('[data-testid="graph-surface-2D"]')!;
    expect(graph.getAttribute('data-rendered-link-ids')).toContain('visible-skeleton');
    expect(graph.getAttribute('data-rendered-link-ids')).toContain('low-strength');
    expect(graph.getAttribute('data-rendered-link-ids')).not.toContain('child-edge');
    expect(graph.getAttribute('data-rendered-link-ids')).not.toContain('association-edge');
    expect(graph.getAttribute('data-teaching-order-link-ids')?.split(',').sort()).toEqual(
      canonicalLinks.map((link) => link.id).sort()
    );

    const allControl = container.querySelector<HTMLButtonElement>('[data-knowledge-relation-family="all"]')!;
    expect(allControl.getAttribute('aria-checked')).toBe('mixed');
    await act(async () => allControl.click());
    expect(allControl.getAttribute('aria-checked')).toBe('true');
    expect(graph.getAttribute('data-rendered-link-ids')).toContain('child-edge');

    await act(async () => allControl.click());
    expect(allControl.getAttribute('aria-checked')).toBe('mixed');
    expect(graph.getAttribute('data-rendered-link-ids')).not.toContain('child-edge');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-a-1"]')!.click());
    expect(graph.getAttribute('data-rendered-link-ids')).toContain('association-edge');
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-relation-family="child"]')!.click());
    expect(graph.getAttribute('data-rendered-link-ids')).toContain('child-edge');
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');

    const associationControl = container.querySelector<HTMLButtonElement>('[data-knowledge-relation-family="association"]')!;
    associationControl.focus();
    await userEvent.setup().keyboard(' ');

    expect(associationControl.getAttribute('aria-checked')).toBe('false');
    expect(graph.getAttribute('data-rendered-link-ids')).not.toContain('association-edge');
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');
    expect(graph.getAttribute('data-teaching-order-link-ids')?.split(',').sort()).toEqual(
      canonicalLinks.map((link) => link.id).sort()
    );
  });

  it('exposes domain pending/failure/retry and keeps truncation incomplete until a complete retry', async () => {
    const pending: Array<(response: Response) => void> = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (!url.includes('mode=expansion')) return json(rootPayload());
      return new Promise<Response>((resolve) => pending.push(resolve));
    }));

    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    expect(container.querySelector('[data-knowledge-domain-state]')?.getAttribute('data-knowledge-domain-state')).toBe('loading');
    await act(async () => pending.shift()?.(new Response('{}', { status: 500 })));
    expect(container.querySelector('[data-knowledge-domain-state]')?.getAttribute('data-knowledge-domain-state')).toBe('failure');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-domain-retry]')!.click());
    expect(container.querySelector('[data-knowledge-domain-state]')?.getAttribute('data-knowledge-domain-state')).toBe('loading');
    await act(async () => pending.shift()?.(new Response(JSON.stringify(
      domainPayload(domainA, [rootNode(domainA), members['a-1']], 'v1', true)
    ), { status: 200 })));
    expect(container.querySelector('[data-knowledge-domain-state]')?.getAttribute('data-knowledge-domain-state')).toBe('incomplete');
    expect(container.querySelector('[data-knowledge-domain-retry]')).not.toBeNull();
    expect(container.querySelector('[data-testid="canvas-2D-a-1"]')).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-domain-retry]')!.click());
    await act(async () => pending.shift()?.(new Response(JSON.stringify(
      domainPayload(domainA, [rootNode(domainA), members['a-1']]
      )), { status: 200 })));
    expect(container.querySelector('[data-knowledge-domain-state]')?.getAttribute('data-knowledge-domain-state')).toBe('ready');
    expect(container.querySelector('[data-testid="canvas-2D-a-1"]')).not.toBeNull();
  });

  it('routes deep-link, pointer, Enter, Space, directory, and search through one navigation resolver', async () => {
    history.replaceState({}, '', '/knowledge?nodeId=a-1');
    const fetchMock = vi.fn((url: string) => {
      if (url.includes(encodeURIComponent(domainA))) return json(domainPayload(domainA, [rootNode(domainA), members['a-1']]));
      if (url.includes(encodeURIComponent(domainB))) return json(domainPayload(domainB, [rootNode(domainB), members['b-1']]));
      return json(rootPayload());
    });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem))));
    await flush(80);
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('a-1');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!.click());
    const domainButton = container.querySelector<HTMLButtonElement>(`[data-knowledge-node-control="${domainB}"]`)!;
    domainButton.focus();
    await userEvent.setup().keyboard('{Enter}');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-b-1"]')!.click());
    const semanticNode = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="b-1"]')!;
    semanticNode.focus();
    await userEvent.setup().keyboard(' ');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-command-trigger="chapter-directory"]')!.click());
    const directory = container.querySelector('[data-knowledge-local-panel="chapter-directory"]')!;
    const groupButton = Array.from(directory.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('系统模型'))!;
    await act(async () => groupButton.click());
    const search = directory.querySelector<HTMLInputElement>('input[aria-label="搜索知识点..."]')!;
    await userEvent.setup().type(search, 'B Node');
    await act(async () => Array.from(directory.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('B Node'))!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('b-1');

    history.replaceState({}, '', '/knowledge');
    await act(async () => root.render(createElement(KnowledgeGraphSystem, {
      key: 'initial-selection',
      initialSelectedNodeId: 'a-1',
    })));
    await flush();
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('a-1');
  });

  it('resolves an uncached cross-domain Related target and return-root clears inspector state', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes(encodeURIComponent(domainA))) return json(domainPayload(domainA, [rootNode(domainA), members['a-1']]));
      if (url.includes(encodeURIComponent(domainB))) return json(domainPayload(domainB, [rootNode(domainB), members['b-1']]));
      return json(rootPayload());
    }));
    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await flush(100);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-a-1"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="related-b-1"]')!.click());
    expect(container.querySelector('[data-knowledge-active-domain-id]')?.getAttribute('data-knowledge-active-domain-id')).toBe(domainB);
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('b-1');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('false');
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainB}"]`)!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('false');
  });

  it('preserves inspection through manipulation while a true blank-canvas activation dismisses without changing layout inputs', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes(encodeURIComponent(domainA))) {
        return json(domainPayload(domainA, [rootNode(domainA), members['a-1']]));
      }
      return json(rootPayload());
    }));
    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await flush(100);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-a-1"]')!.click());

    const graph = container.querySelector<HTMLElement>('[data-testid="graph-surface-2D"]')!;
    const stableLayoutInputs = {
      fit: graph.getAttribute('data-fit-view-version'),
      relayout: graph.getAttribute('data-relayout-version'),
      graphVersion: graph.getAttribute('data-graph-version'),
    };
    expect(graph.getAttribute('data-selected-node-id')).toBe('a-1');
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="manipulation-2D"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');
    expect(graph.getAttribute('data-selected-node-id')).toBe('a-1');
    expect(container.querySelector('[data-knowledge-active-domain-id]')?.getAttribute('data-knowledge-active-domain-id')).toBe(domainA);

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="background-2D"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('false');
    expect(graph.getAttribute('data-selected-node-id')).toBe('');
    expect(container.querySelector('[data-knowledge-active-domain-id]')?.getAttribute('data-knowledge-active-domain-id')).toBe(domainA);
    expect({
      fit: graph.getAttribute('data-fit-view-version'),
      relayout: graph.getAttribute('data-relayout-version'),
      graphVersion: graph.getAttribute('data-graph-version'),
    }).toEqual(stableLayoutInputs);
  });

  it('keeps selection when the inspector closes and reopens it only through explicit node activation', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes(encodeURIComponent(domainA))) {
        return json(domainPayload(domainA, [rootNode(domainA), members['a-1']]));
      }
      return json(rootPayload());
    }));
    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-a-1"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="close-resource-panel"]')!.click());

    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('false');
    expect(container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-selected-node-id')).toBe('a-1');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-a-1"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');
  });

  it('treats repeated activation of the cached current domain center as idempotent', async () => {
    const fetchMock = vi.fn((url: string) => url.includes(encodeURIComponent(domainA))
      ? json(domainPayload(domainA, [rootNode(domainA), members['a-1']]))
      : json(rootPayload()));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await flush(100);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-a-1"]')!.click());
    const graph = container.querySelector('[data-testid="graph-surface-2D"]')!;
    const layoutInputs = [
      graph.getAttribute('data-fit-view-version'),
      graph.getAttribute('data-relayout-version'),
      graph.getAttribute('data-graph-version'),
    ];

    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-knowledge-active-domain-id]')?.getAttribute('data-knowledge-active-domain-id')).toBe(domainA);
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('a-1');
    expect([
      graph.getAttribute('data-fit-view-version'),
      graph.getAttribute('data-relayout-version'),
      graph.getAttribute('data-graph-version'),
    ]).toEqual(layoutInputs);
  });

  it('keeps an explicit cross-domain target across failure and retry without restoring the old inspector', async () => {
    const pendingB: Array<(response: Response) => void> = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes(encodeURIComponent(domainA))) {
        return json(domainPayload(domainA, [rootNode(domainA), members['a-1']]));
      }
      if (url.includes(encodeURIComponent(domainB))) {
        return new Promise<Response>((resolve) => pendingB.push(resolve));
      }
      return json(rootPayload());
    }));
    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-a-1"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="related-b-1"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('false');

    await act(async () => pendingB.shift()?.(new Response('{}', { status: 500 })));
    expect(container.querySelector('[data-knowledge-domain-state]')?.getAttribute('data-knowledge-domain-state')).toBe('failure');
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).not.toContain('a-1');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-domain-retry]')!.click());
    await act(async () => pendingB.shift()?.(new Response(JSON.stringify(
      domainPayload(domainB, [rootNode(domainB), members['b-1']])
    ), { status: 200 })));

    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('b-1');
  });

  it('keeps the same independent selected/open state contract at a mobile renderer width', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(375);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(720);
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes(encodeURIComponent(domainA))) {
        return json(domainPayload(domainA, [
          rootNode(domainA),
          { ...members['a-1'], metadata: { ...members['a-1'].metadata, category: '核心' } },
          { ...members['a-2'], metadata: { ...members['a-2'].metadata, category: '拓展' } },
        ]));
      }
      return json(rootPayload());
    }));
    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-a-1"]')!.click());

    expect(container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-renderer-width')).toBe('375');
    expect(container.querySelector('[data-knowledge-relation-family-control="compact-bottom-left"]')).toBeNull();
    expect(container.querySelector('[data-knowledge-relation-family-control="inspector-header"]')).not.toBeNull();
    expect(container.querySelector('[data-knowledge-mobile-equivalent="same-state-same-control"]')).not.toBeNull();
    expect(container.querySelector('[data-knowledge-relation-family="all"]')?.getAttribute('aria-checked')).toBe('mixed');
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');
    const child = container.querySelector<HTMLButtonElement>('[data-knowledge-relation-family="child"]')!;
    await act(async () => child.click());
    expect(child.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');

    const mobileSurface = container.querySelector<HTMLElement>('[data-knowledge-mobile-command-surface="single-tool-panel"]')!;
    await act(async () => Array.from(mobileSurface.querySelectorAll('button')).find((button) => button.textContent === '筛选')!.click());
    expect(mobileSurface.querySelector('[data-knowledge-mobile-tool-return-safe-area="reserved"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-label="关系族显示"]')).toHaveLength(1);
    expect(container.querySelector('[data-knowledge-relation-family-control="inspector-header"]')).not.toBeNull();

    const search = mobileSurface.querySelector<HTMLInputElement>('input[aria-label="关键词搜索"]')!;
    const user = userEvent.setup();
    await act(async () => user.type(search, '不存在的节点'));
    expect(container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-selected-node-id')).toBe('');
    expect(container.querySelector('[data-knowledge-relation-family-control="inspector-header"]')).toBeNull();
    expect(container.querySelector('[data-knowledge-relation-family-control="tool-panel-header"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-label="关系族显示"]')).toHaveLength(1);
    expect(container.querySelector('[data-knowledge-relation-family="child"]')?.getAttribute('aria-checked')).toBe('true');

    await act(async () => user.clear(search));
    await flush();
    const categoryDetails = mobileSurface.querySelectorAll('details')[0];
    categoryDetails.open = true;
    const extensionCategory = Array.from(categoryDetails.querySelectorAll('label')).find((label) => label.textContent?.includes('拓展'))!;
    await act(async () => extensionCategory.querySelector<HTMLInputElement>('input')!.click());
    expect(container.querySelector('[data-knowledge-relation-family-control="tool-panel-header"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-label="关系族显示"]')).toHaveLength(1);

    await act(async () => mobileSurface.querySelector<HTMLButtonElement>('[data-knowledge-mobile-panel-toggle="true"]')!.click());
    expect(container.querySelector('[data-knowledge-relation-family-control="compact-bottom-left"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-label="关系族显示"]')).toHaveLength(1);
    expect(container.querySelector('[data-knowledge-relation-family="child"]')?.getAttribute('aria-checked')).toBe('true');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="close-resource-panel"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('false');
    expect(container.querySelector('[data-knowledge-relation-family-control="compact-bottom-left"]')).not.toBeNull();
    expect(container.querySelector('[data-knowledge-relation-family="child"]')?.getAttribute('aria-checked')).toBe('true');
    await act(async () => Array.from(mobileSurface.querySelectorAll('button')).find((button) => button.textContent === '筛选')!.click());
    await act(async () => Array.from(mobileSurface.querySelectorAll('button')).find((button) => button.textContent === '清空节点筛选条件')!.click());
    expect(container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-selected-node-id')).toBe('a-1');
  });

  it('ignores stale success, HTTP, JSON, and network completion after navigation changes', async () => {
    for (const outcome of ['success', 'http', 'json', 'network'] as const) {
      let settleA: (() => void) | undefined;
      const pendingA = new Promise<Response>((resolve, reject) => {
        settleA = () => {
          if (outcome === 'network') reject(new Error('late network'));
          else if (outcome === 'http') resolve(new Response('{}', { status: 500 }));
          else if (outcome === 'json') resolve(new Response('{', { status: 200 }));
          else resolve(new Response(JSON.stringify(domainPayload(domainA, [rootNode(domainA), members['a-1']])), { status: 200 }));
        };
      });
      const fetchMock = vi.fn((url: string) => {
        if (url.includes(encodeURIComponent(domainA))) return pendingA;
        if (url.includes(encodeURIComponent(domainB))) return json(domainPayload(domainB, [rootNode(domainB), members['b-1']]));
        return json(rootPayload());
      });
      vi.stubGlobal('fetch', fetchMock);
      await act(async () => root.render(createElement(KnowledgeGraphSystem, { key: outcome })));
      await flush();
      await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
      await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!.click());
      await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainB}"]`)!.click());
      await act(async () => settleA?.());
      expect(container.querySelector('[data-knowledge-active-domain-id]')?.getAttribute('data-knowledge-active-domain-id')).toBe(domainB);
      expect(container.querySelector('[data-testid="canvas-2D-a-1"]')).toBeNull();
    }
  });

  it('owns loading keys per request and aborts pending work on replacement and unmount', async () => {
    const signals: AbortSignal[] = [];
    const pending = new Map<string, Array<(response: Response) => void>>();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (!url.includes('mode=expansion')) return json(rootPayload());
      signals.push(init?.signal as AbortSignal);
      const domainId = new URL(`http://localhost${url}`).searchParams.get('domainId')!;
      return new Promise<Response>((resolve) => {
        pending.set(domainId, [...(pending.get(domainId) ?? []), resolve]);
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();

    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainB}"]`)!.click());
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => pending.get(domainA)?.[0]?.(new Response(JSON.stringify(domainPayload(domainA, [rootNode(domainA), members['a-1']])), { status: 200 })));
    expect(container.querySelector('[data-knowledge-loading-shard-count]')?.getAttribute('data-knowledge-loading-shard-count')).toBe('1');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    expect(signals[1]?.aborted).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    expect(signals[2]?.aborted).toBe(true);
    await act(async () => pending.get(domainA)?.[1]?.(new Response(JSON.stringify(
      domainPayload(domainA, [rootNode(domainA), members['a-1']])
    ), { status: 200 })));
    expect(container.querySelector('[data-knowledge-loading-shard-count]')?.getAttribute('data-knowledge-loading-shard-count')).toBe('1');
    await act(async () => root.unmount());
    expect(signals.at(-1)?.aborted).toBe(true);
  });

  it('normalizes a trusted lesson launch and preserves node precedence beside lessonId', async () => {
    history.replaceState({}, '', '/knowledge?node=preferred&nodeId=legacy');
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('mode=expansion')) {
        return json(domainPayload(domainA, [rootNode(domainA), members['a-1']]));
      }
      expect(url).toContain('lessonId=1-1');
      return json(rootPayload('v1', { lessonId: '1-1' }));
    }));

    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, {
      initialSelectedNodeId: 'a-1',
      trustedLessonId: '1-1',
    }))));
    await flush(80);

    expect(new URLSearchParams(location.search).get('lessonId')).toBe('1-1');
    expect(container.querySelector('[data-knowledge-active-lesson-id]')?.getAttribute('data-knowledge-active-lesson-id')).toBe('1-1');
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).not.toContain('a-1');
  });

  it.each(['invalid', 'deleted'] as const)('clears %s lesson context from URL and component state', async (kind) => {
    history.replaceState({}, '', kind === 'invalid'
      ? '/knowledge?lessonId=..%2F1-1&nodeId=a-1'
      : '/knowledge?lessonId=deleted-lesson&nodeId=a-1');
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('mode=expansion')) {
        return json(domainPayload(domainA, [rootNode(domainA), members['a-1']]));
      }
      return json(rootPayload());
    }));

    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush(80);

    expect(new URLSearchParams(location.search).has('lessonId')).toBe(false);
    expect(container.querySelector('[data-knowledge-active-lesson-id]')?.getAttribute('data-knowledge-active-lesson-id')).toBe('');
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('a-1');
  });

  it('switches and removes lesson context through history without accepting a stale response', async () => {
    history.replaceState({}, '', '/knowledge?lessonId=1-1');
    const pending = new Map<string, Array<(response: Response) => void>>();
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('mode=expansion')) throw new Error('unexpected domain request');
      const lessonId = new URL(`http://localhost${url}`).searchParams.get('lessonId') ?? 'none';
      signals.push(init?.signal as AbortSignal);
      return new Promise<Response>((resolve) => {
        pending.set(lessonId, [...(pending.get(lessonId) ?? []), resolve]);
      });
    }));

    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem))));
    history.pushState({}, '', '/knowledge?lessonId=2-1');
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(container.querySelector('[data-knowledge-lesson-overlay-revision]')?.getAttribute('data-knowledge-lesson-overlay-revision')).toBe('');
    expect(container.querySelector('[data-knowledge-lesson-card-order-count]')?.getAttribute('data-knowledge-lesson-card-order-count')).toBe('0');
    expect(container.querySelector('[data-knowledge-teaching-order-source]')?.getAttribute('data-knowledge-teaching-order-source')).toBe('post-only');
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('false');
    expect(container.querySelector('[data-knowledge-selected-node-id]')?.getAttribute('data-knowledge-selected-node-id')).toBe('');
    expect(signals.some((signal) => signal.aborted)).toBe(true);
    await act(async () => pending.get('1-1')?.at(-1)?.(new Response(JSON.stringify(
      rootPayload('v1', { lessonId: '1-1' })
    ), { status: 200 })));
    await act(async () => pending.get('2-1')?.at(-1)?.(new Response(JSON.stringify(
      rootPayload('v1', { lessonId: '2-1' })
    ), { status: 200 })));
    await flush();
    expect(container.querySelector('[data-knowledge-active-lesson-id]')?.getAttribute('data-knowledge-active-lesson-id')).toBe('2-1');

    history.pushState({}, '', '/knowledge');
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(container.querySelector('[data-knowledge-lesson-overlay-revision]')?.getAttribute('data-knowledge-lesson-overlay-revision')).toBe('');
    expect(container.querySelector('[data-knowledge-lesson-card-order-count]')?.getAttribute('data-knowledge-lesson-card-order-count')).toBe('0');
    await act(async () => pending.get('none')?.at(-1)?.(new Response(JSON.stringify(rootPayload()), { status: 200 })));
    await flush();
    expect(container.querySelector('[data-knowledge-active-lesson-id]')?.getAttribute('data-knowledge-active-lesson-id')).toBe('');
    expect(new URLSearchParams(location.search).has('lessonId')).toBe(false);
  });

  it('clears inspection explicitly throughout lesson-driven root loading, failure, retry, and stale completion', async () => {
    const rootRequests: Array<(response: Response) => void> = [];
    let initialRoot = true;
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('mode=expansion')) {
        return json(domainPayload(domainA, [rootNode(domainA), members['a-1']]));
      }
      if (initialRoot) {
        initialRoot = false;
        return json(rootPayload());
      }
      return new Promise<Response>((resolve) => rootRequests.push(resolve));
    }));

    await act(async () => root.render(createElement(KnowledgeGraphSystem)));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="canvas-2D-${domainA}"]`)!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-a-1"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('a-1');

    history.pushState({}, '', '/knowledge?lessonId=2-1');
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('false');
    expect(container.querySelector('[data-knowledge-selected-node-id]')?.getAttribute('data-knowledge-selected-node-id')).toBe('');

    await act(async () => rootRequests.shift()?.(new Response('{}', { status: 500 })));
    expect(container.querySelector('[data-knowledge-root-state]')?.getAttribute('data-knowledge-root-state')).toBe('failure');
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).not.toContain('a-1');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-root-retry]')!.click());
    history.pushState({}, '', '/knowledge?lessonId=3-1');
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
    const stale = rootRequests.shift();
    const current = rootRequests.shift();
    await act(async () => stale?.(new Response(JSON.stringify(rootPayload('v1', { lessonId: '2-1' })), { status: 200 })));
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).not.toContain('a-1');
    await act(async () => current?.(new Response(JSON.stringify(rootPayload('v1', { lessonId: '3-1' })), { status: 200 })));
    await flush();
    expect(container.querySelector('[data-knowledge-active-lesson-id]')?.getAttribute('data-knowledge-active-lesson-id')).toBe('3-1');
    expect(container.querySelector('[data-knowledge-konling-selected-node-id]')?.getAttribute('data-knowledge-konling-selected-node-id')).toBe('');
  });
});
