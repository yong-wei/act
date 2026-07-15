// @vitest-environment jsdom

import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/dom';

vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => createElement('span', props) }));
vi.mock('../knowledge-card', () => ({
  extractInfographResource: () => null,
  extractMdxPaths: () => [],
  KnowledgeCardDialog: () => null,
}));

import { ResourcePanel } from '../resource-panel/resource-panel';

describe('ResourcePanel relation detail behavior', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders child, cycle, concrete provenance, and per-field truncation notices', async () => {
    const id = '节点 /?#% Ω';
    const detail = {
      id,
      name: '测试节点',
      nodeType: 'THEORY' as const,
      description: '详情',
      positionX: 0, positionY: 0, positionZ: 0,
      isActive: true,
      truncated: { metadata: true, content: true, resources: true, relatedNodes: true },
      relatedNodes: [
        {
          id: 'child', name: '子节点', nodeType: 'THEORY', canonicalType: 'contains',
          relationId: 'child-1', category: 'membership', family: 'child', direction: 'parent-to-child',
          inspectionSentence: '本节点包含目标子级', evidenceState: 'unavailable',
          sourceId: id, targetId: 'child', strength: 1,
        },
        {
          id: 'cycle', name: '循环节点', nodeType: 'THEORY', canonicalType: 'prerequisite',
          relationId: 'cycle-1', category: 'follows', family: 'post-requisite', direction: 'earlier-to-later',
          cycleState: 'cyclic', inspectionSentence: '本节点是目标节点的先修知识', evidenceState: 'available',
          sourceMetadata: { source_chapter: 2, target_chapter: 3 },
          sourceId: id, targetId: 'cycle', strength: 1,
        },
      ],
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(detail), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(createElement(ResourcePanel, { isOpen: true, selectedNode: detail, onClose: () => {} }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/knowledge/nodes/${encodeURIComponent(id)}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(container.textContent).toContain('层级与包含关系');
    expect(container.textContent).toContain('本节点包含目标子级');
    expect(container.textContent).toContain('元数据不完整');
    expect(container.textContent).toContain('知识内容不完整');
    expect(container.textContent).toContain('关联资源不完整');
    expect(container.textContent).toContain('关系列表不完整');

    const followsButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('后续关系'))!;
    await act(async () => fireEvent.click(followsButton));
    expect(container.textContent).toContain('概念相互依赖，建议结合学习');
    expect(container.textContent).toContain('章节依据：2 → 3');
    expect(container.textContent).not.toContain('关系依据可用');
  });

  it('keeps inline and portal close controls in one mobile focus loop and restores focus on Escape', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const returnTarget = document.createElement('button');
    returnTarget.textContent = '原节点';
    document.body.insertBefore(returnTarget, container);
    returnTarget.focus();
    const detail = {
      id: 'focus-node', name: '焦点节点', nodeType: 'THEORY' as const,
      description: '详情', positionX: 0, positionY: 0, positionZ: 0,
      metadata: {}, relatedNodes: [], resources: [],
    };
    function Harness({ mobileToolPanelOpen }: { mobileToolPanelOpen: boolean }) {
      const [open, setOpen] = useState(true);
      return createElement(ResourcePanel, {
        isOpen: open,
        selectedNode: detail,
        onClose: () => setOpen(false),
        mobileToolPanelOpen,
        mobileHeaderControl: createElement('button', { type: 'button' }, '关系控件'),
      });
    }
    const renderHarness = async (mobileToolPanelOpen: boolean) => {
      await act(async () => root.render(createElement(Harness, { mobileToolPanelOpen })));
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    };

    await renderHarness(true);
    let close = document.querySelector<HTMLButtonElement>('[aria-label="关闭知识节点检查器"]')!;
    const relationControl = container.querySelector<HTMLButtonElement>('[data-knowledge-inspector] button')!;
    expect(document.activeElement).toBe(close);
    await act(async () => fireEvent.keyDown(close, { key: 'Tab' }));
    expect(document.activeElement).toBe(relationControl);
    await act(async () => fireEvent.keyDown(relationControl, { key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(close);

    await renderHarness(false);
    close = container.querySelector<HTMLButtonElement>('[aria-label="关闭知识节点检查器"]')!;
    expect(document.activeElement).toBe(close);
    await act(async () => fireEvent.keyDown(close, { key: 'Tab' }));
    expect(document.activeElement).toBe(relationControl);
    await act(async () => fireEvent.keyDown(relationControl, { key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(close);
    await renderHarness(true);
    close = document.querySelector<HTMLButtonElement>('[aria-label="关闭知识节点检查器"]')!;
    expect(document.activeElement).toBe(close);

    await act(async () => fireEvent.keyDown(close, { key: 'Escape' }));
    expect(document.querySelector('[data-knowledge-inspector]')).toBeNull();
    expect(document.activeElement).toBe(returnTarget);
    returnTarget.remove();
  });

  it('preserves focused close control across exact mobile breakpoint changes and removes the listener', async () => {
    const listeners = new Set<() => void>();
    const media = {
      matches: true,
      addEventListener: vi.fn((event: string, listener: () => void) => {
        if (event === 'change') listeners.add(listener);
      }),
      removeEventListener: vi.fn((event: string, listener: () => void) => {
        if (event === 'change') listeners.delete(listener);
      }),
    };
    const matchMedia = vi.fn(() => media);
    vi.stubGlobal('matchMedia', matchMedia);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const detail = {
      id: 'breakpoint-node', name: '断点节点', nodeType: 'THEORY' as const,
      description: '详情', positionX: 0, positionY: 0, positionZ: 0,
      metadata: {}, relatedNodes: [], resources: [],
    };

    await act(async () => root.render(createElement(ResourcePanel, {
      isOpen: true, selectedNode: detail, onClose: () => {}, mobileToolPanelOpen: true,
    })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 1023px)');
    let closeButtons = document.querySelectorAll<HTMLButtonElement>('[aria-label="关闭知识节点检查器"]');
    expect(closeButtons).toHaveLength(1);
    expect(document.activeElement).toBe(closeButtons[0]);
    expect(container.contains(closeButtons[0])).toBe(false);

    await act(async () => {
      media.matches = false;
      listeners.forEach((listener) => listener());
    });
    closeButtons = document.querySelectorAll<HTMLButtonElement>('[aria-label="关闭知识节点检查器"]');
    expect(closeButtons).toHaveLength(1);
    expect(container.contains(closeButtons[0])).toBe(true);
    expect(document.activeElement).toBe(closeButtons[0]);

    await act(async () => {
      media.matches = true;
      listeners.forEach((listener) => listener());
    });
    closeButtons = document.querySelectorAll<HTMLButtonElement>('[aria-label="关闭知识节点检查器"]');
    expect(closeButtons).toHaveLength(1);
    expect(container.contains(closeButtons[0])).toBe(false);
    expect(document.activeElement).toBe(closeButtons[0]);

    await act(async () => root.unmount());
    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(listeners.size).toBe(0);
    root = createRoot(container);
  });
});
