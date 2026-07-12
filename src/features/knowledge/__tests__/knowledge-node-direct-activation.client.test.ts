// @vitest-environment jsdom

import { StrictMode, act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/dom';

const rendererRegistry = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/components/providers/global-ai-provider', () => ({
  useGlobalAI: () => ({ updatePageContext: vi.fn(), isOpen: false }),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    const renderer = rendererRegistry.count++ === 0 ? '3D' : '2D';
    return function GraphSurface(props: {
      nodes: Array<{ id: string; name: string }>;
      selectedNode?: { id: string } | null;
      expandedNodeIds?: string[];
      onNodeClick: (node: unknown) => void;
      onManipulationStart: () => void;
      collapsingNodeId?: string | null;
      onCollapsePresentationComplete?: (nodeId: string) => void;
    }) {
      const {
        collapsingNodeId,
        onCollapsePresentationComplete,
        nodes,
        onManipulationStart,
        onNodeClick,
        selectedNode,
        expandedNodeIds,
      } = props;
      useEffect(() => {
        if (collapsingNodeId) onCollapsePresentationComplete?.(collapsingNodeId);
      }, [collapsingNodeId, onCollapsePresentationComplete]);
      return createElement('div', {
        'data-testid': `graph-surface-${renderer}`,
        'data-selected-node-id': selectedNode?.id ?? '',
        'data-expanded-node-ids': expandedNodeIds?.join(',') ?? '',
      }, createElement('button', {
        type: 'button', 'data-testid': `background-${renderer}`, onClick: onManipulationStart,
      }, 'background'), createElement('button', {
        type: 'button', 'data-testid': `drag-${renderer}`, onClick: onManipulationStart,
      }, 'drag'), nodes.map((node) => createElement('button', {
      key: node.id,
      type: 'button',
      'data-testid': `canvas-${renderer}-${node.id}`,
      onClick: () => onNodeClick(node),
      }, node.name)));
    };
  },
}));

vi.mock('../resource-panel/resource-panel', () => ({
  ResourcePanel: (props: { isOpen: boolean; selectedNode: { id: string } | null; onNodeClick: (id: string) => void }) => createElement(
  'div',
  { 'data-testid': 'resource-panel', 'data-open': String(props.isOpen) },
  createElement('button', { type: 'button', 'data-testid': 'related-expandable', onClick: () => props.onNodeClick('expandable') }, 'related'),
  createElement('button', { type: 'button', 'data-testid': 'related-missing', onClick: () => props.onNodeClick('related-missing') }, 'related missing'),
  props.selectedNode?.id ?? '',
 ),
}));

import { KnowledgeGraphSystem, type KnowledgeNodeData } from '../knowledge-graph-system';

const nodes: KnowledgeNodeData[] = [
  { id: 'expandable', name: 'Expandable', nodeType: 'THEORY', description: '', positionX: 0, positionY: 0, positionZ: 0, metadata: { isCollapsedRoot: true }, expansion: { state: 'expandable' } },
  { id: 'leaf', name: 'Leaf', nodeType: 'THEORY', description: '', positionX: 0, positionY: 0, positionZ: 0, metadata: { isCollapsedRoot: true }, expansion: { state: 'leaf' } },
  { id: 'unknown', name: 'Unknown', nodeType: 'THEORY', description: '', positionX: 0, positionY: 0, positionZ: 0, metadata: { isCollapsedRoot: true }, expansion: { state: 'unknown' } },
];

function payload(payloadNodes = nodes, links: unknown[] = [], mode = 'root') {
  const shardKey = mode === 'expansion' ? 'v1:shard:expansion:expandable' : `v1:shard:${mode}`;
  return { graphVersion: 'v1', mode, source: 'database', nodes: payloadNodes, links, shardKey };
}

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }));
}

describe('KnowledgeGraphSystem direct activation behavior', () => {
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

  it('keeps pointer, semantic Enter/Space, directory/deep-link/Related and 2D/3D on one activation path', async () => {
    const fetchMock = vi.fn((url: string) => url.includes('mode=expansion')
      ? json(payload(nodes, [{ id: 'l', sourceId: 'expandable', targetId: 'leaf', relation: 'related', strength: 0.9 }], 'expansion'))
      : json(payload()));
    vi.stubGlobal('fetch', fetchMock);
    history.replaceState({}, '', '/knowledge?nodeId=leaf');
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, { initialNodes: nodes }))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');

    const canvas = container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-expandable"]')!;
    await act(async () => canvas.click());
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(1);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-command-trigger="relation-filters"]')!.click());
    const relationPanel = container.querySelector('[data-knowledge-local-panel="relation-filters"]')!;
    const strength = relationPanel.querySelector<HTMLInputElement>('input[type="range"]')!;
    await act(async () => fireEvent.change(strength, { target: { value: '1' } }));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    const expandableControl = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="expandable"]')!;
    expect(expandableControl.getAttribute('aria-expanded')).toBe('true');
    expect(expandableControl.getAttribute('data-filtered-empty')).toBe('false');
    expect(expandableControl.getAttribute('data-shard-cached')).toBe('true');
    expect(container.querySelector('[data-knowledge-filtered-empty-explanation="visible"]')).toBeNull();
    expect(container.querySelector('[data-testid="canvas-2D-leaf"]')).not.toBeNull();
    await act(async () => fireEvent.change(strength, { target: { value: '0' } }));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(container.querySelector('[data-testid="canvas-2D-leaf"]')).not.toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(1);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-expandable"]')!.click());
    expect(container.querySelector('#knowledge-node-activation-status')?.textContent).toContain('折叠显示');
    const requestsBeforeRelated = fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion')).length;
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="related-expandable"]')!.click());
    expect(container.querySelector('[data-knowledge-node-control="expandable"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(requestsBeforeRelated);

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-command-trigger="view-layout"]')!.click());
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === '3D 视图')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-3D-leaf"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('leaf');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-command-trigger="chapter-directory"]')!.click());
    const directory = container.querySelector('[data-knowledge-local-panel="chapter-directory"]')!;
    await act(async () => directory.querySelector<HTMLButtonElement>('button')!.click());
    await act(async () => Array.from(directory.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Leaf'))!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('leaf');
    const search = directory.querySelector<HTMLInputElement>('input[aria-label="搜索知识点..."]')!;
    const directoryUser = userEvent.setup();
    await directoryUser.type(search, 'Leaf');
    await act(async () => Array.from(directory.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Leaf'))!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('leaf');

    const semanticLeaf = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="leaf"]')!;
    const user = userEvent.setup();
    semanticLeaf.focus();
    const requestsBeforeKeyboard = fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion')).length;
    await act(async () => user.keyboard('{Enter}'));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(requestsBeforeKeyboard);
    await act(async () => user.keyboard(' '));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(requestsBeforeKeyboard);
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('leaf');
  });

  it('preserves an initial selected node when the URL has no node query', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json(payload())));
    await act(async () => root.render(createElement(KnowledgeGraphSystem, {
      initialNodes: nodes,
      initialSelectedNodeId: 'leaf',
    })));

    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('leaf');
  });

  it('suppresses duplicate loading, retries errors, branches unknown canonically, and ignores stale/unmounted results', async () => {
    let rejectExpansion: ((reason: Error) => void) | undefined;
    let expansionSignal: AbortSignal | undefined;
    let abortObserved = false;
    const pending = new Promise<Response>((_resolve, reject) => { rejectExpansion = reject; });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (!url.includes('mode=expansion')) return json(payload());
      expansionSignal = init?.signal ?? undefined;
      expansionSignal?.addEventListener('abort', () => { abortObserved = true; });
      return pending;
    });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, { initialNodes: nodes }))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));
    const unknown = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="unknown"]')!;
    await act(async () => { unknown.click(); unknown.click(); });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(1);
    await act(async () => root.unmount());
    expect(expansionSignal?.aborted).toBe(true);
    expect(abortObserved).toBe(true);
    await act(async () => rejectExpansion?.(new Error('late network failure')));
    expect(container.textContent).toBe('');
  });

  it('uses native Space for collapsed expandable and Enter for unknown with one outcome each', async () => {
    const fetchMock = vi.fn((url: string) => url.includes('mode=expansion')
      ? json(payload(nodes, [{ id: 'l', sourceId: 'expandable', targetId: 'leaf', relation: 'related', strength: 1 }], 'expansion'))
      : json(payload()));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, { initialNodes: nodes }))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));
    const user = userEvent.setup();
    const expandable = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="expandable"]')!;
    expandable.focus();
    expect(document.activeElement).toBe(expandable);
    expect(expandable.className).toContain('focus:opacity-100');
    await act(async () => user.keyboard(' '));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(1);
    expect(expandable.getAttribute('aria-expanded')).toBe('true');

    const unknown = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="unknown"]')!;
    unknown.focus();
    expect(document.activeElement).toBe(unknown);
    await act(async () => user.keyboard('{Enter}'));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(2);
    expect(unknown.getAttribute('aria-busy')).toBe('false');
  });

  it('dismisses the inspector on blank canvas and drag start without collapsing cached expansion', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('mode=expansion')
      ? json(payload(nodes, [{ id: 'l', sourceId: 'expandable', targetId: 'leaf', relation: 'related', strength: 1 }], 'expansion'))
      : json(payload())));
    await act(async () => root.render(createElement(KnowledgeGraphSystem, { initialNodes: nodes })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 40)));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-expandable"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-leaf"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="background-2D"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('false');
    expect(container.querySelector('[data-knowledge-node-control="expandable"]')?.getAttribute('aria-expanded')).toBe('true');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-leaf"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="drag-2D"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('false');
    expect(container.querySelector('[data-knowledge-node-control="expandable"]')?.getAttribute('data-shard-cached')).toBe('true');
  });

  it('retries HTTP errors and opens the inspector only after canonical unknown resolves to leaf', async () => {
    let expansionCall = 0;
    const canonicalLeaf = { ...nodes[2], expansion: { state: 'leaf' as const } };
    const fetchMock = vi.fn((url: string) => {
      if (!url.includes('mode=expansion')) return json(payload());
      expansionCall += 1;
      if (expansionCall === 1) return json({ error: 'failed' }, 500);
      return json(payload([canonicalLeaf], [], 'expansion'));
    });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, { initialNodes: nodes }))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));
    const unknown = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="unknown"]')!;
    await act(async () => unknown.click());
    expect(unknown.getAttribute('data-error')).toBe('true');
    await act(async () => unknown.click());
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(2);
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('unknown');
  });

  it('resolves a Related target absent from the current cache through the canonical expansion contract', async () => {
    const relatedExpandable: KnowledgeNodeData = {
      id: 'related-missing',
      name: 'Related missing',
      nodeType: 'THEORY',
      description: '',
      positionX: 24,
      positionY: 0,
      positionZ: 0,
      metadata: { isCollapsedRoot: true },
      expansion: { state: 'expandable' },
    };
    const fetchMock = vi.fn((url: string) => url.includes('nodeId=related-missing')
      ? json(payload([relatedExpandable, nodes[1]], [{
        id: 'related-link', sourceId: 'related-missing', targetId: 'leaf', relation: 'related', strength: 1,
      }], 'expansion'))
      : json(payload()));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, { initialNodes: nodes }))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-leaf"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="related-missing"]')!.click());
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('mode=expansion') && String(url).includes('nodeId=related-missing'))).toBe(true);
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('false');
    expect(container.querySelector('[data-knowledge-node-control="related-missing"]')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps a newer leaf target selected when an older expandable success resolves late', async () => {
    let resolveExpansion: ((response: Response) => void) | undefined;
    const deferredExpansion = new Promise<Response>((resolve) => { resolveExpansion = resolve; });
    vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('mode=expansion')
      ? deferredExpansion
      : json(payload())));
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, { initialNodes: nodes }))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-expandable"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-leaf"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('leaf');

    await act(async () => resolveExpansion?.(new Response(JSON.stringify(payload(nodes, [{
      id: 'expandable-leaf', sourceId: 'expandable', targetId: 'leaf', relation: 'related', strength: 1,
    }], 'expansion')), { status: 200 })));

    expect(container.querySelector('[data-testid="resource-panel"]')?.getAttribute('data-open')).toBe('true');
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('leaf');
    expect(container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-selected-node-id')).toBe('leaf');
    expect(container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-expanded-node-ids')).not.toContain('expandable');
    expect(container.querySelector('[data-knowledge-node-control="expandable"]')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('commits two legitimate expandable intents in activation order even when responses return in reverse order', async () => {
    const pending = new Map<string, (response: Response) => void>();
    const fetchMock = vi.fn((url: string) => {
      if (!url.includes('mode=expansion')) return json(payload());
      const nodeId = new URL(`http://localhost${url}`).searchParams.get('nodeId') ?? '';
      return new Promise<Response>((resolve) => pending.set(nodeId, resolve));
    });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, { initialNodes: nodes }))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="expandable"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="unknown"]')!.click());
    expect(pending.has('expandable')).toBe(true);
    expect(pending.has('unknown')).toBe(true);

    await act(async () => pending.get('unknown')?.(new Response(JSON.stringify(payload([
      { ...nodes[2], expansion: { state: 'expandable' as const } },
    ], [], 'expansion')), { status: 200 })));
    await act(async () => pending.get('expandable')?.(new Response(JSON.stringify(payload(nodes, [{
      id: 'expandable-leaf', sourceId: 'expandable', targetId: 'leaf', relation: 'related', strength: 1,
    }], 'expansion')), { status: 200 })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(container.querySelector('[data-knowledge-node-control="expandable"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[data-knowledge-node-control="unknown"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-expanded-node-ids')).toContain('expandable');
    expect(container.querySelector('[data-testid="graph-surface-2D"]')?.getAttribute('data-expanded-node-ids')).toContain('unknown');
  });

  it('unblocks a later expansion when an earlier request is cancelled by a leaf selection', async () => {
    let resolveExpandable: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((url: string) => {
      if (!url.includes('mode=expansion')) return json(payload());
      const nodeId = new URL(`http://localhost${url}`).searchParams.get('nodeId');
      if (nodeId === 'expandable') {
        return new Promise<Response>((resolve) => { resolveExpandable = resolve; });
      }
      return json(payload([
        { ...nodes[2], expansion: { state: 'expandable' as const } },
      ], [], 'expansion'));
    });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, { initialNodes: nodes }))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="expandable"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="leaf"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('leaf');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="unknown"]')!.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(container.querySelector('[data-knowledge-node-control="unknown"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[data-knowledge-node-control="expandable"]')?.getAttribute('aria-expanded')).toBe('false');

    await act(async () => resolveExpandable?.(new Response(JSON.stringify(payload(nodes, [{
      id: 'late-expandable-leaf', sourceId: 'expandable', targetId: 'leaf', relation: 'related', strength: 1,
    }], 'expansion')), { status: 200 })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(container.querySelector('[data-knowledge-node-control="unknown"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[data-knowledge-node-control="expandable"]')?.getAttribute('aria-expanded')).toBe('false');
  });

  it.each(['success', 'error'] as const)('does not commit a queued cache expansion after a newer leaf selection (%s)', async (outcome) => {
    let settleBlocking: ((response?: Response) => void) | undefined;
    const fetchMock = vi.fn((url: string) => {
      if (!url.includes('mode=expansion')) return json(payload());
      const nodeId = new URL(`http://localhost${url}`).searchParams.get('nodeId');
      if (nodeId === 'expandable') {
        return json(payload(nodes, [{ id: 'expandable-leaf', sourceId: 'expandable', targetId: 'leaf', relation: 'related', strength: 1 }], 'expansion'));
      }
      return new Promise<Response>((resolve, reject) => {
        settleBlocking = (response) => {
          if (response) resolve(response);
          else reject(new Error('queued expansion failure'));
        };
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, { initialNodes: nodes }))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));

    const expandable = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="expandable"]')!;
    await act(async () => expandable.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    await act(async () => expandable.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(expandable.getAttribute('aria-expanded')).toBe('false');
    expect(expandable.getAttribute('data-shard-cached')).toBe('true');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="unknown"]')!.click());
    await act(async () => expandable.click());
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('nodeId=expandable'))).toHaveLength(1);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="leaf"]')!.click());
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('leaf');

    await act(async () => settleBlocking?.(outcome === 'success'
      ? new Response(JSON.stringify(payload([{ ...nodes[2], expansion: { state: 'expandable' as const } }], [], 'expansion')), { status: 200 })
      : undefined));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('leaf');
    expect(container.querySelector('[data-knowledge-node-control="expandable"]')?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-knowledge-node-control="unknown"]')?.getAttribute('data-error')).toBe('false');
  });

  it.each(['success', 'network', 'http', 'json'] as const)('ignores stale %s completion after switching targets', async (kind) => {
    let settle: (() => void) | undefined;
    const late = new Promise<Response>((resolve, reject) => {
      settle = () => {
        if (kind === 'network') reject(new Error('late network'));
        else if (kind === 'http') resolve(new Response('{}', { status: 500 }));
        else if (kind === 'json') resolve(new Response('{', { status: 200 }));
        else resolve(new Response(JSON.stringify(payload([{ ...nodes[2], expansion: { state: 'leaf' } }], [], 'expansion')), { status: 200 }));
      };
    });
    vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('mode=expansion') ? late : json(payload())));
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, { initialNodes: nodes }))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="unknown"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="leaf"]')!.click());
    await act(async () => settle?.());
    expect(container.querySelector('[data-testid="resource-panel"]')?.textContent).toContain('leaf');
    expect(container.querySelector('[data-knowledge-node-control="unknown"]')?.getAttribute('data-error')).toBe('false');
  });
});
