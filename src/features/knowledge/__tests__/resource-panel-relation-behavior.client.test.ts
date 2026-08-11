// @vitest-environment jsdom

import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

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

  it('does not render a launch anchor when an invalid authoritative target coexists with safe fallbacks', async () => {
    const node = {
      id: 'unsafe-launch', name: '不安全启动节点', nodeType: 'THEORY' as const,
      description: '详情', positionX: 0, positionY: 0, positionZ: 0,
      resources: ['/safe-resource-fallback'],
      metadata: {
        launchTarget: '\n',
        renderTarget: '/safe-render-fallback',
        lessonEntry: '/safe-lesson-fallback',
        lessonId: 'lesson-safe-fallback',
      },
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));

    await act(async () => {
      root.render(createElement(ResourcePanel, { isOpen: true, selectedNode: node, onClose: () => {} }));
      await Promise.resolve();
    });

    expect(container.querySelector('a[data-resource-node-action="launch"]')).toBeNull();
    expect(container.querySelector('[data-resource-node-action="launch"][aria-disabled="true"]')).not.toBeNull();
    expect(container.textContent).toContain('资源启动地址未通过安全校验');
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
          cycleState: 'cyclic', inspectionSentence: '本节点是目标节点的先修知识', evidenceState: 'unavailable',
          sourceChapter: 2, targetChapter: 3,
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
    expect(container.textContent).toContain('元数据不完整');
    expect(container.textContent).toContain('知识内容不完整');
    expect(container.textContent).toContain('关联资源不完整');
    expect(container.textContent).toContain('关系列表不完整');

    const overviewButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('关联知识点'))!;
    expect(overviewButton.getAttribute('aria-expanded')).toBe('false');
    const overviewRegion = document.getElementById(overviewButton.getAttribute('aria-controls')!);
    expect(overviewRegion?.hidden).toBe(true);
    await act(async () => fireEvent.click(overviewButton));
    expect(overviewRegion?.hidden).toBe(false);

    const membershipButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('层级与包含关系'))!;
    expect(membershipButton.getAttribute('aria-expanded')).toBe('false');
    await act(async () => fireEvent.click(membershipButton));
    expect(container.textContent).toContain('本节点包含目标子级');

    const followsButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('后续关系'))!;
    expect(followsButton.getAttribute('aria-expanded')).toBe('false');
    const followsPanelId = followsButton.getAttribute('aria-controls');
    expect(followsPanelId).toBeTruthy();
    await act(async () => fireEvent.click(followsButton));
    expect(followsButton.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector(`#${followsPanelId}`)).not.toBeNull();
    expect(container.textContent).toContain('需共同理解或待审查');
    expect(container.textContent).toContain('节点章节：2 → 3');
    expect(container.textContent).toContain('关系依据未提供');
  });

  it('shows a non-2xx detail error owned by the current node and retries in place', async () => {
    const detail = {
      id: 'retry-detail', name: '重试节点', nodeType: 'THEORY' as const,
      description: '即时摘要', positionX: 0, positionY: 0, positionZ: 0,
      chapterName: '系统模型', metadata: { chapterName: '系统模型' },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'temporary' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...detail, description: '重试后的详情', relatedNodes: [], resources: [],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(createElement(ResourcePanel, { isOpen: true, selectedNode: detail, onClose: () => {} }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const inspector = container.querySelector<HTMLElement>('[data-knowledge-inspector]')!;
    inspector.scrollTop = 90;
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('节点详情加载失败');
    const retry = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('重试详情'))!;
    await act(async () => {
      fireEvent.click(retry);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('重试后的详情');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(inspector.scrollTop).toBe(90);
  });

  it('keeps the inspector shell and scroll owner stable while rejecting stale detail responses', async () => {
    const pending = new Map<string, (response: Response) => void>();
    const fetchMock = vi.fn((url: string) => new Promise<Response>((resolve) => {
      pending.set(url, resolve);
    }));
    vi.stubGlobal('fetch', fetchMock);
    const selected = (id: string, name: string, description: string) => ({
      id, name, nodeType: 'THEORY' as const, description,
      positionX: 0, positionY: 0, positionZ: 0,
      chapterName: '系统模型', metadata: { chapterName: '系统模型' },
    });

    await act(async () => root.render(createElement(ResourcePanel, {
      isOpen: true, selectedNode: selected('node-a', '节点 A', '节点 A 的即时摘要'), onClose: () => {},
    })));
    const inspector = container.querySelector<HTMLElement>('[data-knowledge-inspector]')!;
    expect(container.textContent).toContain('节点 A 的即时摘要');
    expect(container.textContent).toContain('所属领域');
    expect(container.textContent).toContain('系统模型');
    inspector.scrollTop = 140;

    await act(async () => root.render(createElement(ResourcePanel, {
      isOpen: true, selectedNode: selected('node-a', '节点 A', '节点 A 更新摘要'), onClose: () => {},
    })));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(inspector.scrollTop).toBe(140);

    await act(async () => root.render(createElement(ResourcePanel, {
      isOpen: true, selectedNode: selected('node-b', '节点 B', '节点 B 的即时摘要'), onClose: () => {},
    })));
    expect(container.querySelector('[data-knowledge-inspector]')).toBe(inspector);
    expect(container.textContent).toContain('节点 B 的即时摘要');
    expect(inspector.scrollTop).toBe(0);

    await act(async () => {
      pending.get('/api/knowledge/nodes/node-b')?.(new Response(JSON.stringify({
        ...selected('node-b', '节点 B', '节点 B 的服务端详情'), relatedNodes: [], resources: [],
      }), { status: 200 }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('节点 B 的服务端详情');

    await act(async () => {
      pending.get('/api/knowledge/nodes/node-a')?.(new Response(JSON.stringify({
        ...selected('node-a', '节点 A', '过期的节点 A 详情'), relatedNodes: [], resources: [],
      }), { status: 200 }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('节点 B 的服务端详情');
    expect(container.textContent).not.toContain('过期的节点 A 详情');
  });

  it('uses a keyboard-accessible single-open accordion while preserving raw relation provenance', async () => {
    const detail = {
      id: 'selected', name: '当前节点', nodeType: 'THEORY' as const, description: '详情',
      positionX: 0, positionY: 0, positionZ: 0, chapterName: '当前领域',
      relatedNodes: [
        {
          id: 'peer', name: '相邻节点', nodeType: 'THEORY', canonicalType: 'supports',
          relationId: 'supports-1', category: 'related', family: 'association', direction: 'unordered',
          rawType: 'supports',
          inspectionSentence: '本节点支撑目标结论', evidenceState: 'unavailable',
          sourceId: 'selected', targetId: 'peer', strength: 0.8,
          visualMergeKey: 'association|peer|selected', visualMergeCount: 2,
        },
        {
          id: 'peer', name: '相邻节点', nodeType: 'THEORY', canonicalType: 'applies_to',
          relationId: 'applies-1', category: 'related', family: 'association', direction: 'unordered',
          rawType: '电路应用',
          inspectionSentence: '本节点可应用于目标', evidenceState: 'available', rationale: '评审依据',
          sourceId: 'selected', targetId: 'peer', strength: 0.7,
          visualMergeKey: 'association|peer|selected', visualMergeCount: 2,
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(detail), { status: 200 })));
    await act(async () => root.render(createElement(ResourcePanel as never, {
      isOpen: true, selectedNode: detail, onClose: () => {},
      canonicalCorridor: {
        ancestors: [{ id: 'ancestor', name: '前置节点' }],
        descendants: [{ id: 'descendant', name: '后续节点' }],
        cycleState: 'cyclic',
      },
      adjacentDomainNavigations: [{
        direction: 'descendant', edgeId: 'cross-1', nodeId: 'remote', nodeName: '跨域节点',
        domainId: 'chapter-node:相邻领域',
      }],
    })));
    await act(async () => Promise.resolve());

    const overviewButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('关联知识点'))!;
    const corridorButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('当前规范路径'))!;
    const adjacentButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('相邻领域路径'))!;
    const learningActionsButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('学习路径动作'))!;
    const accordionIds = new Set<string>();
    for (const button of [overviewButton, corridorButton, adjacentButton, learningActionsButton]) {
      expect(button.getAttribute('aria-expanded')).toBe('false');
      const regionId = button.getAttribute('aria-controls');
      expect(regionId).toBeTruthy();
      expect(button.id).toMatch(/^knowledge-resource-panel-[A-Za-z0-9_-]+$/u);
      expect(regionId).toMatch(/^knowledge-resource-panel-[A-Za-z0-9_-]+$/u);
      const region = document.getElementById(regionId!);
      expect(container.querySelector(`#${button.id}`)).toBe(button);
      expect(container.querySelector(`#${regionId}`)).toBe(region);
      expect(region?.getAttribute('role')).toBe('region');
      expect(region?.getAttribute('aria-labelledby')).toBe(button.id);
      expect(region?.hidden).toBe(true);
      accordionIds.add(button.id);
      accordionIds.add(regionId!);
    }
    expect(accordionIds.size).toBe(8);

    corridorButton.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(corridorButton.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(corridorButton.getAttribute('aria-controls')!)?.hidden).toBe(false);
    expect(container.textContent).toContain('前置节点');
    expect(container.textContent).toContain('后续节点');
    expect(container.textContent).toContain('需共同理解或待审查');

    await act(async () => fireEvent.click(learningActionsButton));
    expect(learningActionsButton.getAttribute('aria-expanded')).toBe('true');
    expect(corridorButton.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(learningActionsButton.getAttribute('aria-controls')!)?.hidden).toBe(false);
    const launchContract = container.querySelector('[data-resource-node-launch-contract="launch-return-evidence"]');
    expect(launchContract?.querySelector('[data-resource-node-action="launch"]')).not.toBeNull();
    expect(launchContract?.querySelector('[data-resource-node-action="return-to-learning-path"]')).not.toBeNull();
    const evidenceLink = launchContract?.querySelector('[data-resource-node-action="review-evidence"]');
    expect(evidenceLink).not.toBeNull();
    expect(evidenceLink?.getAttribute('target')).toBe('_blank');
    expect(evidenceLink?.getAttribute('href')).toContain('node=');

    await act(async () => fireEvent.click(overviewButton));
    expect(overviewButton.getAttribute('aria-expanded')).toBe('true');
    expect(learningActionsButton.getAttribute('aria-expanded')).toBe('false');
    expect(corridorButton.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(corridorButton.getAttribute('aria-controls')!)?.hidden).toBe(true);
    const relatedButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('关联关系'))!;
    expect(relatedButton.getAttribute('aria-expanded')).toBe('false');
    await act(async () => fireEvent.click(relatedButton));
    expect(container.textContent).toContain('本节点支撑目标结论');
    expect(container.textContent).toContain('本节点可应用于目标');
    expect(container.textContent).toContain('电路应用');
    expect(container.textContent).toContain('规范方向：selected → peer');
    expect(container.textContent).toContain('关系依据未提供');
    expect(container.textContent).toContain('画布合并呈现：2 条原始关系');
  });

  it('preserves disclosure and scroll for same-node updates, then resets both for a new node id', async () => {
    const selected = (id: string, description: string) => ({
      id, name: `节点 ${id}`, nodeType: 'THEORY' as const, description,
      positionX: 0, positionY: 0, positionZ: 0,
      relatedNodes: [{
        id: `${id}-peer`, name: '相邻节点', nodeType: 'THEORY', canonicalType: 'related',
        relationId: `${id}-related`, category: 'related' as const, family: 'association' as const,
        direction: 'unordered' as const, sourceId: id, targetId: `${id}-peer`, strength: 1,
      }],
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const id = decodeURIComponent(url.split('/').pop()!);
      return new Response(JSON.stringify(selected(id, `服务端详情 ${id}`)), { status: 200 });
    }));

    await act(async () => {
      root.render(createElement(ResourcePanel, {
        isOpen: true, selectedNode: selected('node-a', '即时详情 A'), onClose: () => {},
      }));
      await Promise.resolve();
    });
    const inspector = container.querySelector<HTMLElement>('[data-knowledge-inspector]')!;
    const overview = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('关联知识点'))!;
    await act(async () => fireEvent.click(overview));
    const related = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('关联关系'))!;
    await act(async () => fireEvent.click(related));
    inspector.scrollTop = 120;

    await act(async () => root.render(createElement(ResourcePanel, {
      isOpen: true, selectedNode: selected('node-a', '同节点异步更新'), onClose: () => {},
    })));
    expect(overview.getAttribute('aria-expanded')).toBe('true');
    expect(related.getAttribute('aria-expanded')).toBe('true');
    expect(inspector.scrollTop).toBe(120);

    await act(async () => {
      root.render(createElement(ResourcePanel, {
        isOpen: true, selectedNode: selected('node-b', '新节点详情'), onClose: () => {},
      }));
      await Promise.resolve();
    });
    const nextOverview = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('关联知识点'))!;
    const nextRelated = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('关联关系'))!;
    expect(nextOverview.getAttribute('aria-expanded')).toBe('false');
    expect(nextRelated.getAttribute('aria-expanded')).toBe('false');
    expect(inspector.scrollTop).toBe(0);
  });

  it('keeps the mobile inspector non-modal, does not trap Tab, and restores focus on Escape', async () => {
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
    expect(document.activeElement).toBe(close);
    expect(fireEvent.keyDown(close, { key: 'Tab' })).toBe(true);

    await renderHarness(false);
    close = container.querySelector<HTMLButtonElement>('[aria-label="关闭知识节点检查器"]')!;
    expect(document.activeElement).toBe(close);
    expect(fireEvent.keyDown(close, { key: 'Tab' })).toBe(true);
    await renderHarness(true);
    close = document.querySelector<HTMLButtonElement>('[aria-label="关闭知识节点检查器"]')!;
    expect(document.activeElement).toBe(close);

    await act(async () => fireEvent.keyDown(close, { key: 'Escape' }));
    expect(document.querySelector('[data-knowledge-inspector]')).toBeNull();
    expect(document.activeElement).toBe(returnTarget);
    returnTarget.remove();
  });

  it('synchronously focuses the mobile inspector from a node control and closes on Escape from the panel', async () => {
    let matchMediaCalls = 0;
    vi.stubGlobal('matchMedia', () => ({
      matches: matchMediaCalls++ === 0,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const detail = {
      id: 'pointer-node', name: '指针节点', nodeType: 'THEORY' as const, description: '详情',
      positionX: 0, positionY: 0, positionZ: 0,
      metadata: {}, relatedNodes: [], resources: [],
    };
    function Harness() {
      const [open, setOpen] = useState(false);
      return createElement('div', null,
        createElement('button', {
          type: 'button',
          onClick: () => setOpen(true),
          'data-knowledge-node-control': detail.id,
        }, detail.name),
        createElement(ResourcePanel, {
          isOpen: open,
          selectedNode: detail,
          onClose: () => setOpen(false),
        }),
      );
    }

    await act(async () => root.render(createElement(Harness)));
    const trigger = container.querySelector<HTMLButtonElement>('[data-knowledge-node-control="pointer-node"]')!;
    trigger.focus();
    const user = userEvent.setup();
    await user.click(trigger);

    const inspector = document.querySelector<HTMLElement>('[data-knowledge-inspector]')!;
    const close = document.querySelector<HTMLButtonElement>('[aria-label="关闭知识节点检查器"]')!;
    expect(matchMediaCalls).toBeGreaterThanOrEqual(2);
    expect(document.activeElement).toBe(close);

    const panelButton = Array.from(inspector.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button !== close)!;
    panelButton.focus();
    await act(async () => fireEvent.keyDown(panelButton, { key: 'Escape' }));
    expect(document.querySelector('[data-knowledge-inspector]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
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
