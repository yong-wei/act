// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InteractiveProvider, type InteractiveConfig } from '@/features/interactive';
import { KnowledgeDeck } from '@/resources/interactive-learning/shared/knowledge-deck';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

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

vi.mock('@/resources/interactive-learning/shared/knowledge-card', () => ({
  KnowledgeCard: () => <div data-testid="knowledge-card" />,
}));

const config: InteractiveConfig = {
  resourceId: 'teaching-resource-1',
  registryId: 'lesson01-feedback-knowledge-deck-v1',
  title: '反馈控制知识卡片',
  config: {
    ai: { enabled: false },
    layout: { showHeader: false, showAIPanel: false },
  },
};

const cards: LessonKnowledgeCard[] = [
  {
    id: 'card-a',
    name: '第一张',
    nodeType: 'THEORY',
    description: '卡片 A',
    lessonId: 'lesson-01',
  },
  {
    id: 'card-b',
    name: '第二张',
    nodeType: 'THEORY',
    description: '卡片 B',
    lessonId: 'lesson-01',
  },
];

describe('knowledge deck path completion', () => {
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

  const renderDeck = async (onComplete: (result?: unknown) => void | Promise<void>) => {
    await act(async () => root.render(
      <InteractiveProvider config={config} embedded onComplete={onComplete}>
        <KnowledgeDeck
          cards={cards}
          title="测试知识卡片"
          description="两张卡片"
          footer="测完再继续"
        />
      </InteractiveProvider>,
    ));
  };

  const visitAllCards = async () => {
    expect(button('继续下一步')).toBeUndefined();
    await act(async () => button('2. 第二张')?.click());
    expect(container.textContent).toContain('已浏览 2/2');
  };

  it('does not complete the path until the visible continue action is used', async () => {
    const onComplete = vi.fn();
    await renderDeck(onComplete);
    expect(button('继续下一步')).toBeUndefined();
    expect(onComplete).not.toHaveBeenCalled();

    await visitAllCards();
    expect(onComplete).not.toHaveBeenCalled();
    expect(button('继续下一步')).toBeDefined();
  });

  it('awaits path completion, shows pending state, and stays idempotent', async () => {
    let resolveCompletion!: () => void;
    const pendingCompletion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    const onComplete = vi.fn(() => pendingCompletion);
    await renderDeck(onComplete);
    await visitAllCards();

    await act(async () => {
      button('继续下一步')?.click();
      button('继续下一步')?.click();
    });
    expect(onComplete).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('正在提交');
    expect(button('正在提交')?.disabled).toBe(true);
    expect(tracking.emit.mock.calls.filter(([event]) => event === 'complete')).toHaveLength(0);

    await act(async () => resolveCompletion());
    expect(button('继续下一步')?.disabled).toBe(true);
    expect(tracking.emit.mock.calls.filter(([event]) => event === 'complete')).toHaveLength(1);
  });

  it('shows a visible failure and allows retry', async () => {
    const onComplete = vi.fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce(undefined);
    await renderDeck(onComplete);
    await visitAllCards();

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
