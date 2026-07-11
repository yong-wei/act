// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeSearch = new URLSearchParams({
  source: 'adaptive-path-center',
  goal: 'control-correction',
  goalId: 'control-correction',
  pathId: 'path-arena',
  nodeId: 'arena-task:task-second-order-lead-pid',
  intent: 'path-execution',
  returnHref: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-arena&nodeId=arena-task%3Atask-second-order-lead-pid',
  resourceType: 'arena_task',
});

vi.mock('next/navigation', () => ({
  useSearchParams: () => routeSearch,
}));

import { useArenaPathSubmissionCompletion } from '../arena-path-journey-control';

function SubmissionHarness() {
  const complete = useArenaPathSubmissionCompletion('task-second-order-lead-pid');
  return createElement('button', {
    type: 'button',
    onClick: () => void complete('submission-invalid'),
  }, '提交结果');
}

function pendingJourney() {
  return {
    path: { id: 'path-arena', title: 'Arena 校正路径' },
    goal: { id: 'control-correction' },
    context: {
      pathId: 'path-arena',
      goalId: 'control-correction',
      requestedNodeId: 'arena-task:task-second-order-lead-pid',
    },
    current: {
      nodeId: 'arena-task:task-second-order-lead-pid',
      title: '完成 Arena 挑战',
      type: 'arena_task',
    },
    progress: { completed: 1, total: 2 },
    return: {
      label: '返回学习路径',
      href: '/assessment/adaptive-practice?goal=control-correction',
    },
    pathStatus: 'active',
    nextAction: {
      state: 'pending-result',
      nodeId: 'arena-task:task-second-order-lead-pid',
      title: '完成 Arena 挑战',
      type: 'arena_task',
      href: null,
      reason: '结果正在同步，完成绑定后即可继续。',
      recovery: {
        label: '刷新结果状态',
        href: '/assessment/adaptive-practice?goal=control-correction',
      },
    },
  };
}

describe('Arena path completion client', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  it('publishes the authoritative pending journey from a rejected Arena completion', async () => {
    const journeyUpdated = vi.fn();
    window.addEventListener('adaptive-path:journey-updated', journeyUpdated);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: 'Arena 结果尚未满足路径完成条件',
      state: 'pending-result',
      journey: pendingJourney(),
    }), { status: 409, headers: { 'Content-Type': 'application/json' } })));

    await act(async () => root.render(createElement(SubmissionHarness)));
    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(journeyUpdated).toHaveBeenCalledTimes(1);
    const event = journeyUpdated.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail.nextAction).toMatchObject({ state: 'pending-result', href: null });
    expect(JSON.stringify(event.detail)).not.toMatch(/hidden|score|valid/i);
    window.removeEventListener('adaptive-path:journey-updated', journeyUpdated);
  });
});
