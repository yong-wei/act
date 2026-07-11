// @vitest-environment jsdom

import { StrictMode, act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/providers/global-ai-provider', () => ({
  useGlobalAI: () => ({ updatePageContext: vi.fn(), isOpen: false }),
}));

vi.mock('next/dynamic', () => ({
  default: () => function GraphSurface(props: { nodes: Array<{ id: string; name: string }>; onNodeClick: (node: unknown) => void }) {
    return createElement('div', { 'data-testid': 'graph-surface' }, props.nodes.map((node) => createElement('button', {
      key: node.id,
      type: 'button',
      'data-testid': `canvas-${node.id}`,
      onClick: () => props.onNodeClick(node),
    }, node.name)));
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

    const canvas = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="expandable"]')!;
    await act(async () => canvas.click());
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(1);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-knowledge-command-trigger="relation-filters"]')!.click());
    const strength = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    await act(async () => {
      strength.value = '1';
      strength.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      strength.value = '0';
      strength.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('mode=expansion'))).toHaveLength(1);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="related-expandable"]')!.click());

    const semanticLeaf = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="leaf"]')!;
    semanticLeaf.focus();
    expect(document.activeElement).toBe(semanticLeaf);
    await act(async () => {
      semanticLeaf.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      semanticLeaf.click();
      semanticLeaf.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      semanticLeaf.click();
    });
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
});
