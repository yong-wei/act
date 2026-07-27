// @vitest-environment jsdom

import { act, createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
  pathname: '/knowledge',
  search: '',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: unknown }) =>
    createElement('a', { href, ...props }, children as never),
}));

import {
  AdaptivePathJourneyControlFromRoute,
  AdaptivePathOwnedResourceAction,
  publishAdaptivePathJourneyResponse,
  requestAdaptivePathJourneyRefresh,
} from '@/features/adaptive/adaptive-path-journey-control';
import type { AuthorizedAdaptivePathJourney } from '@/features/adaptive/adaptive-path-journey-contracts';
import { sendArenaCoreEvent } from '@/features/arena/telemetry';

function routeSearch(pathId: string, nodeId: string) {
  const returnHref = `/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=${pathId}&nodeId=${nodeId}`;
  return new URLSearchParams({
    source: 'adaptive-path-center',
    goal: 'control-correction',
    goalId: 'control-correction',
    pathId,
    nodeId,
    intent: 'path-execution',
    returnHref,
    resourceType: 'knowledge_card',
  }).toString();
}

function journey(
  pathId: string,
  nodeId: string,
  nextTitle: string,
  requestedNodeId: string | null = nodeId,
): AuthorizedAdaptivePathJourney {
  return {
    path: { id: pathId, title: `路径 ${pathId}` },
    goal: { id: 'control-correction' },
    context: { pathId, goalId: 'control-correction', requestedNodeId },
    current: { nodeId, title: `节点 ${nodeId}`, type: 'knowledge_card' },
    progress: { completed: 1, total: 2 },
    return: {
      label: '返回学习路径',
      href: `/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=${pathId}&nodeId=${nodeId}`,
    },
    pathStatus: 'active',
    nextAction: {
      state: 'ready',
      nodeId: `${nodeId}-next`,
      title: nextTitle,
      type: 'knowledge_card',
      href: `/knowledge?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=${pathId}&nodeId=${nodeId}-next&intent=path-execution&returnHref=%2Fassessment%2Fadaptive-practice&resourceType=knowledge_card`,
      reason: null,
      recovery: null,
    },
  };
}

function response(payload: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('adaptive path journey client behavior', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    navigation.pathname = '/knowledge';
    navigation.search = routeSearch('path-1', 'node-1');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('aborts stale reads and follows same-route query identity changes without old response overwrite', async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(createElement(AdaptivePathJourneyControlFromRoute)));
    const firstSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/learning-paths/path-1/journey');

    navigation.search = routeSearch('path-2', 'node-2');
    await act(async () => root.render(createElement(AdaptivePathJourneyControlFromRoute)));
    expect(firstSignal.aborted).toBe(true);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/api/learning-paths/path-2/journey');

    await act(async () => second.resolve(await response({ journey: journey('path-2', 'node-2', '进入第二条路径') })));
    expect(container.textContent).toContain('进入第二条路径');

    await act(async () => first.resolve(await response({ journey: journey('path-1', 'node-1', '旧路径动作') })));
    expect(container.textContent).not.toContain('旧路径动作');
    expect(container.textContent).toContain('进入第二条路径');
  });

  it('refreshes on focus, visible visibilitychange, and pageshow', async () => {
    const fetchMock = vi.fn(() => response({ journey: journey('path-1', 'node-1', '下一节点') }));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(createElement(AdaptivePathJourneyControlFromRoute));
      await Promise.resolve();
    });
    await act(async () => window.dispatchEvent(new Event('focus')));
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => window.dispatchEvent(new Event('pageshow')));

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each([
    ['403 response', () => response({ error: 'forbidden' }, 403)],
    ['invalid payload', () => response({ journey: { path: { id: 'path-1' } } })],
    ['network failure', () => Promise.reject(new TypeError('network unavailable'))],
  ])('clears a previously ready action after %s', async (_label, rejectedResponse) => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response({ journey: journey('path-1', 'node-1', '可执行下一步') }))
      .mockImplementationOnce(rejectedResponse);
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(createElement(AdaptivePathJourneyControlFromRoute));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('可执行下一步');

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain('可执行下一步');
    expect(container.textContent).toContain('路径进度暂时无法读取');
  });

  it('shows completion without a second start and advances from the published external completion journey', async () => {
    const onStart = vi.fn();
    const onComplete = vi.fn(() => publishAdaptivePathJourneyResponse({
      journey: journey('path-1', 'node-2', '进入外部资料后的下一节点', 'node-1'),
    }));
    vi.stubGlobal('fetch', vi.fn(() => response({ journey: journey('path-1', 'node-1', '完成前动作') })));

    await act(async () => {
      root.render(createElement(Fragment, null,
        createElement(AdaptivePathJourneyControlFromRoute),
        createElement(AdaptivePathOwnedResourceAction, {
          opened: true,
          completionAllowed: true,
          pending: false,
          onStart,
          onComplete,
        }),
      ));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('已学习该资料，继续路径');
    expect(container.textContent).not.toContain('开始学习');
    const button = [...container.querySelectorAll('button')]
      .find((candidate) => candidate.textContent?.includes('已学习该资料'));
    await act(async () => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
    expect(container.textContent).toContain('进入外部资料后的下一节点');
  });

  it('replaces the current action with the authoritative next journey after completion', async () => {
    const fetchMock = vi.fn(() => response({ journey: journey('path-1', 'node-1', '完成前动作') }));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(createElement(AdaptivePathJourneyControlFromRoute));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('完成前动作');

    await act(async () => {
      expect(publishAdaptivePathJourneyResponse({
        journey: journey('path-1', 'node-2', '进入完成后的下一节点', 'node-1'),
      })).toBe(true);
    });

    expect(container.textContent).not.toContain('完成前动作');
    expect(container.textContent).toContain('进入完成后的下一节点');
  });

  it.each([
    ['blocked', '当前结果未通过路径验证'],
    ['path-complete', '查看路径总结'],
  ] as const)('replaces the current action with an authoritative %s state', async (state, title) => {
    vi.stubGlobal('fetch', vi.fn(() => response({ journey: journey('path-1', 'node-1', '完成前动作') })));
    await act(async () => {
      root.render(createElement(AdaptivePathJourneyControlFromRoute));
      await Promise.resolve();
    });

    const updated = journey('path-1', 'node-1', title);
    updated.nextAction = state === 'blocked'
      ? {
          state,
          nodeId: 'node-1',
          title,
          type: 'knowledge_card',
          href: null,
          reason: title,
          recovery: { label: '恢复学习路径', href: updated.return.href },
        }
      : {
          state,
          nodeId: null,
          title,
          type: null,
          href: updated.return.href,
          reason: null,
          recovery: null,
        };
    await act(async () => expect(publishAdaptivePathJourneyResponse({ journey: updated })).toBe(true));

    expect(container.textContent).not.toContain('完成前动作');
    expect(container.textContent).toContain(title);
    expect(container.querySelector(`[data-adaptive-path-journey-control="${state}"]`)).not.toBeNull();
    if (state === 'blocked') {
      expect(container.querySelectorAll(`a[href="${updated.return.href}"]`)).toHaveLength(1);
      expect(container.textContent).not.toContain('恢复学习路径');
    }
  });

  it('does not mount journey behavior for a non-path route', async () => {
    navigation.search = 'goal=control-correction';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(createElement(AdaptivePathJourneyControlFromRoute)));

    expect(container.innerHTML).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not let a same-path event for an old node abort the current-node read', async () => {
    navigation.search = routeSearch('path-1', 'node-2');
    const currentRead = deferredResponse();
    const fetchMock = vi.fn((_input: string | URL | Request, _init?: RequestInit) => currentRead.promise);
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(createElement(AdaptivePathJourneyControlFromRoute)));
    const currentSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    await act(async () => {
      expect(publishAdaptivePathJourneyResponse({
        journey: journey('path-1', 'node-1', '旧节点动作'),
      })).toBe(true);
      expect(publishAdaptivePathJourneyResponse({
        journey: journey('path-1', 'node-1', '旧节点空请求动作', null),
      })).toBe(true);
    });

    expect(currentSignal.aborted).toBe(false);
    expect(container.textContent).not.toContain('旧节点动作');
    expect(container.textContent).not.toContain('旧节点空请求动作');
    await act(async () => currentRead.resolve(await response({
      journey: journey('path-1', 'node-2', '当前节点动作'),
    })));
    expect(container.textContent).toContain('当前节点动作');
  });

  it('refreshes authoritative journey after a governed simulation result signal', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response({ journey: journey('path-1', 'node-1', '等待受治理结果') }))
      .mockImplementationOnce(() => response({ journey: journey('path-1', 'node-2', '结果绑定后的下一节点') }));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(createElement(AdaptivePathJourneyControlFromRoute));
      await Promise.resolve();
    });
    await act(async () => window.dispatchEvent(new CustomEvent('simulation:trace-summary')));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('结果绑定后的下一节点');
  });

  it('refreshes authoritative journey after a successful Arena workbench evaluation emitter', async () => {
    const journeyResponses = [
      journey('path-1', 'node-1', '等待工作台结果'),
      journey('path-1', 'node-2', '工作台结果绑定后的下一节点'),
    ];
    const fetchMock = vi.fn((input: string | URL | Request) => {
      if (String(input) === '/api/interactive/events') return response({ accepted: true });
      return response({ journey: journeyResponses.shift() });
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(createElement(AdaptivePathJourneyControlFromRoute));
      await Promise.resolve();
    });
    await act(async () => {
      await sendArenaCoreEvent('arena_evaluation_complete', { taskId: 'task-1', valid: true });
    });

    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/journey'))).toHaveLength(2);
    expect(container.textContent).toContain('工作台结果绑定后的下一节点');
  });

  it('exposes an explicit refresh bridge for other governed result emitters', async () => {
    const fetchMock = vi.fn(() => response({ journey: journey('path-1', 'node-1', '权威刷新结果') }));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => {
      root.render(createElement(AdaptivePathJourneyControlFromRoute));
      await Promise.resolve();
    });
    await act(async () => requestAdaptivePathJourneyRefresh());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
