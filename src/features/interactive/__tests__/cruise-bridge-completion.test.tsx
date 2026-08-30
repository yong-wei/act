// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InteractiveProvider, type InteractiveConfig } from '@/features/interactive';
import CruiseBridgeVideo from '@/resources/interactive-learning/lesson-13/cruise-bridge-video';

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
  registryId: 'lesson13-cruise-bridge',
  title: '邮轮舒适度导入视频',
  config: {
    ai: { enabled: false },
    layout: { showHeader: false, showAIPanel: false },
  },
};

describe('cruise bridge completion and narration', () => {
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
    .find((candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === label);

  const renderBridge = async (
    onComplete: (result?: unknown) => void | Promise<void>,
    duration = 0.3,
  ) => {
    await act(async () => root.render(
      <InteractiveProvider config={config} embedded onComplete={onComplete}>
        <CruiseBridgeVideo duration={duration} />
      </InteractiveProvider>,
    ));
  };

  const waitForProgress = async (ms: number) => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  };

  it('keeps narration away from the split-scene center and hides it before the continue action', async () => {
    await renderBridge(vi.fn(), 8);
    await waitForProgress(1700);

    const narration = container.querySelector('[data-cruise-bridge-narration]');
    expect(narration).not.toBeNull();
    expect(narration?.className).toContain('top-12');
    expect(narration?.className).not.toContain('left-1/2');
    expect(narration?.className).not.toContain('-translate-x-1/2');
    expect(button('继续下一步')).toBeUndefined();
  });

  it('awaits path completion, shows pending state, and stays idempotent', async () => {
    let resolveCompletion!: () => void;
    const pendingCompletion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    const onComplete = vi.fn(() => pendingCompletion);
    await renderBridge(onComplete);
    await waitForProgress(500);

    expect(button('继续下一步')).toBeDefined();
    expect(container.querySelector('[data-cruise-bridge-narration]')).toBeNull();

    await act(async () => {
      button('继续下一步')?.click();
      button('继续下一步')?.click();
    });
    expect(onComplete).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('正在提交');
    expect(button('正在提交')?.disabled).toBe(true);
    expect(tracking.emit.mock.calls.filter(([event]) => event === 'complete')).toHaveLength(0);

    await act(async () => resolveCompletion());
    expect(container.textContent).toContain('继续下一步');
    expect(button('继续下一步')?.disabled).toBe(true);
    expect(tracking.emit.mock.calls.filter(([event]) => event === 'complete')).toHaveLength(1);
  });

  it('shows a visible failure and allows retry', async () => {
    const onComplete = vi.fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderBridge(onComplete);
    await waitForProgress(500);

    await act(async () => button('继续下一步')?.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('路径进度未能确认，请重试。');
    expect(button('重试')).toBeDefined();
    expect(tracking.emit.mock.calls.filter(([event]) => event === 'complete')).toHaveLength(0);

    await act(async () => button('重试')?.click());
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(button('继续下一步')?.disabled).toBe(true);
    expect(tracking.emit.mock.calls.filter(([event]) => event === 'complete')).toHaveLength(1);
  });
});
