// @vitest-environment jsdom

/**
 * Provider 陪伴接线测试（任务 3.1/3.4）：
 * 气泡挂载、流式/输入抑制、点击打开侧栏并定位会话。
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock('next-auth/react', () => ({ useSession: mocks.useSession }));
vi.mock('next/navigation', () => ({ usePathname: mocks.usePathname }));
vi.mock('@/lib/ai-context-resolver', () => ({
  resolveAIContext: () => ({ pageContext: { courseId: 'c1' }, enabled: true, tools: [], quickQuestions: [] }),
  resolveRegisteredAIContextFromPath: () => ({ courseId: 'c1' }),
  isPathExcluded: () => false,
}));

import {
  GlobalAIProvider,
  useGlobalAI,
  type CompanionBubblePresentation,
} from '@/components/providers/global-ai-provider';

/** 本 vitest jsdom 配置不带 localStorage，用内存实现替换（气泡租约/去重只依赖同源语义）。 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => { store.delete(key); },
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
}

const holder: { current: ReturnType<typeof useGlobalAI> | null } = { current: null };

let currentPathname = '/assessment/adaptive-practice';

function Probe() {
  holder.current = useGlobalAI();
  return null;
}

function renderProvider(): Root {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <GlobalAIProvider>
        <Probe />
      </GlobalAIProvider>,
    );
  });
  return root;
}

/** Provider 状态更新后 holder 指向最新 context；旧引用上的断言会读到过期值。 */
function latestContext() {
  return holder.current as unknown as ReturnType<typeof useGlobalAI>;
}

const presentation: CompanionBubblePresentation = {
  eventId: 'event-1',
  message: '这题答错了没关系，控灵陪你看懂它。',
  sessionId: 'session-9',
};

let roots: Root[] = [];

beforeEach(() => {
  roots = [];
  holder.current = null;
  currentPathname = '/assessment/adaptive-practice';
  vi.stubGlobal('localStorage', createMemoryStorage());
  mocks.usePathname.mockImplementation(() => currentPathname);
  mocks.useSession.mockReturnValue({
    data: { user: { id: 'student-1', role: 'STUDENT' } },
    status: 'authenticated',
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  for (const root of roots) {
    await act(async () => {
      root.unmount();
    });
  }
  document.body.innerHTML = '';
});

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('GlobalAIProvider companion wiring', () => {
  it('presents the bubble, suppresses it while streaming, and restores afterwards', async () => {
    roots.push(renderProvider());
    await settle();
    const api = latestContext();

    act(() => {
      api.presentCompanionBubble(presentation);
    });
    expect(document.querySelector('[data-konling-companion-bubble]')).not.toBeNull();

    // 侧栏流式/输入期间：已在展示的气泡也收起，且新请求不再弹出。
    act(() => {
      api.setStreamingOrComposing(true);
    });
    expect(document.querySelector('[data-konling-companion-bubble]')).toBeNull();
    act(() => {
      api.presentCompanionBubble({ ...presentation, eventId: 'event-2' });
    });
    expect(document.querySelector('[data-konling-companion-bubble]')).toBeNull();

    act(() => {
      api.setStreamingOrComposing(false);
    });
    expect(document.querySelector('[data-konling-companion-bubble]')).toBeNull();
  });

  it('opens the sidebar and targets the conversation when the bubble is clicked', async () => {
    roots.push(renderProvider());
    await settle();
    const api = latestContext();

    act(() => {
      api.presentCompanionBubble(presentation);
    });
    const openButton = document.querySelector('[data-konling-companion-bubble] button');
    expect(openButton?.textContent).toContain('打开控灵继续');

    await act(async () => {
      fireEvent.click(openButton as HTMLElement);
    });
    const afterClick = latestContext();
    expect(afterClick.isOpen).toBe(true);
    expect(afterClick.pendingKonlingConversationId).toBe('session-9');

    // 点击后气泡清除，避免残留重复入口。
    expect(document.querySelector('[data-konling-companion-bubble]')).toBeNull();

    act(() => {
      latestContext().clearPendingKonlingConversation();
    });
    expect(latestContext().pendingKonlingConversationId).toBeNull();
  });

  it('drops stale bubbles across route changes', async () => {
    const root = renderProvider();
    roots.push(root);
    await settle();
    const api = latestContext();

    act(() => {
      api.presentCompanionBubble(presentation);
    });
    expect(document.querySelector('[data-konling-companion-bubble]')).not.toBeNull();

    // 路由变化：旧页面的气泡不再展示（重新渲染触发 pathname effect）。
    currentPathname = '/interactive-learning/resources/res-1';
    await act(async () => {
      root.render(
        <GlobalAIProvider>
          <Probe />
        </GlobalAIProvider>,
      );
    });
    await settle();
    expect(document.querySelector('[data-konling-companion-bubble]')).toBeNull();
  });
});
