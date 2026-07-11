// @vitest-environment jsdom

import { StrictMode, act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

const rendererRegistry = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/components/providers/global-ai-provider', () => ({
  useGlobalAI: () => ({ updatePageContext: vi.fn(), isOpen: false }),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    const renderer = rendererRegistry.count++ === 0 ? '3D' : '2D';
    return function GraphSurface(props: { nodes: Array<{ id: string; name: string }>; onNodeClick: (node: unknown) => void }) {
      return createElement('div', { 'data-testid': `graph-surface-${renderer}` }, props.nodes.map((node) => createElement('button', {
      key: node.id,
      type: 'button',
      'data-testid': `canvas-${renderer}-${node.id}`,
      onClick: () => props.onNodeClick(node),
      }, node.name)));
    };
  },
}));

vi.mock('../resource-panel/resource-panel', () => ({
  ResourcePanel: (props: { isOpen: boolean; selectedNode: { id: string } | null; onNodeClick: (id: string) => void }) => createElement(
    'div',
    { 'data-testid': 'resource-panel', 'data-open': String(props.isOpen) },
    createElement('button', { type: 'button', 'data-testid': 'related-expandable', onClick: () => props.onNodeClick('expandable') }, 'related'),
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
  return { graphVersion: 'v1', mode, source: 'database', nodes: payloadNodes, links, loadedShardKeys: [`v1:shard:${mode}`] };
}

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }));
}

describe('KnowledgeGraphSystem direct activation behavior', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
    const activeRelationButtons = Array.from(relationPanel.querySelectorAll<HTMLButtonElement>('button[aria-pressed="true"]'));
    await act(async () => activeRelationButtons.forEach((button) => button.click()));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    await act(async () => activeRelationButtons.forEach((button) => button.click()));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(1);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-2D-expandable"]')!.click());
    expect(container.querySelector('#knowledge-node-activation-status')?.textContent).toContain('折叠显示');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="related-expandable"]')!.click());

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-command-trigger="view-layout"]')!.click());
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === '3D 视图')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="canvas-3D-leaf"]')!.click());

    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-command-trigger="chapter-directory"]')!.click());
    const directory = container.querySelector('[data-knowledge-local-panel="chapter-directory"]')!;
    await act(async () => directory.querySelector<HTMLButtonElement>('button')!.click());
    await act(async () => Array.from(directory.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Leaf'))!.click());
    const search = directory.querySelector<HTMLInputElement>('input[aria-label="搜索知识点..."]')!;
    const directoryUser = userEvent.setup();
    await directoryUser.type(search, 'Leaf');
    await act(async () => Array.from(directory.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Leaf'))!.click());

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

  it('suppresses duplicate loading, retries errors, branches unknown canonically, and ignores stale/unmounted results', async () => {
    let rejectExpansion: ((reason: Error) => void) | undefined;
    const pending = new Promise<Response>((_resolve, reject) => { rejectExpansion = reject; });
    const fetchMock = vi.fn((url: string) => url.includes('mode=expansion') ? pending : json(payload()));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(StrictMode, null, createElement(KnowledgeGraphSystem, { initialNodes: nodes }))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));
    const unknown = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="unknown"]')!;
    await act(async () => { unknown.click(); unknown.click(); });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(1);
    await act(async () => root.unmount());
    await act(async () => rejectExpansion?.(new Error('late network failure')));
    expect(container.textContent).toBe('');
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
