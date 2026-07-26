// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InteractiveProvider, type InteractiveConfig } from '@/features/interactive';
import SeriesPrecheck from '@/resources/interactive-learning/lesson-15/series-precheck';

const tracking = vi.hoisted(() => ({
  emit: vi.fn(),
  getHistory: vi.fn(() => []),
  clearHistory: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}));

vi.mock('@/features/interactive/hooks/useInteractiveTracking', () => ({
  useInteractiveTracking: () => tracking,
}));

const config: InteractiveConfig = {
  resourceId: 'teaching-resource-1',
  registryId: 'lesson15-series-precheck',
  title: '串联校正前测',
  config: {
    ai: { enabled: false },
    layout: { showHeader: false, showAIPanel: false },
  },
};

describe('series precheck completion flow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    tracking.emit.mockClear();
    tracking.getHistory.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const button = (label: string) => [...container.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.trim() === label);

  const answerCurrentQuestion = async () => {
    const option = container.querySelector<HTMLButtonElement>('.grid.gap-3 button');
    expect(option).not.toBeNull();
    await act(async () => option?.click());
    await act(async () => button('检查')?.click());
  };

  const reachLastQuestion = async () => {
    for (let index = 0; index < 3; index += 1) {
      await answerCurrentQuestion();
      expect(button('下一题')).toBeDefined();
      await act(async () => button('下一题')?.click());
    }
    await answerCurrentQuestion();
  };

  const renderPrecheck = async (onComplete: (result?: unknown) => void | Promise<void>) => {
    await act(async () => root.render(
      <InteractiveProvider config={config} embedded onComplete={onComplete}>
        <SeriesPrecheck />
      </InteractiveProvider>,
    ));
  };

  it('uses an explicit, idempotent completion action on the final question', async () => {
    let resolveCompletion!: () => void;
    const pendingCompletion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    const onComplete = vi.fn(() => pendingCompletion);
    await renderPrecheck(onComplete);

    await reachLastQuestion();

    expect(button('下一题')).toBeUndefined();
    expect(button('完成检测')).toBeDefined();
    await act(async () => {
      button('完成检测')?.click();
      button('完成检测')?.click();
    });
    expect(onComplete).toHaveBeenCalledOnce();
    expect(tracking.emit.mock.calls.filter(([event]) => event === 'complete')).toHaveLength(0);
    expect(container.textContent).toContain('正在提交');
    expect(button('重新开始')?.disabled).toBe(true);

    await act(async () => resolveCompletion());
    expect(container.textContent).toContain('检测结果已保存');
    expect(container.textContent).toContain('可以返回学习路径继续学习');
    expect(tracking.emit.mock.calls.filter(([event]) => event === 'complete')).toHaveLength(1);
  });

  it('shows a visible failure and allows one retry', async () => {
    const onComplete = vi.fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderPrecheck(onComplete);

    await reachLastQuestion();
    await act(async () => button('完成检测')?.click());

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('检测结果提交失败');
    expect(button('重试完成检测')).toBeDefined();
    expect(tracking.emit.mock.calls.filter(([event]) => event === 'complete')).toHaveLength(0);

    await act(async () => button('重试完成检测')?.click());
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('检测结果已保存');
    expect(tracking.emit.mock.calls.filter(([event]) => event === 'complete')).toHaveLength(1);
  });
});
