// @vitest-environment jsdom

/**
 * 端到端链路测试（任务 4.5）：页面 Hook → 事件上报（confirmed）→ 投递 → 气泡呈现。
 * mock 全局 fetch 与 Provider 的 presentCompanionBubble，验证降级路径不弹气泡。
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const presentCompanionBubble = vi.fn();

vi.mock('@/components/providers/global-ai-provider', () => ({
  useGlobalAI: () => ({ presentCompanionBubble }),
}));

import { useKonlingCompanionReporter } from '@/features/ai/companion/use-konling-companion-reporter';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

type Reporter = ReturnType<typeof useKonlingCompanionReporter>;

function renderHook(props: Parameters<typeof useKonlingCompanionReporter>[0]): { reporter: Reporter; root: Root } {
  let reporter: Reporter | null = null;
  function Probe() {
    reporter = useKonlingCompanionReporter(props);
    return null;
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Probe />);
  });
  return { reporter: reporter as Reporter, root };
}

let roots: Root[] = [];

beforeEach(() => {
  roots = [];
  fetchMock.mockReset();
  presentCompanionBubble.mockReset();
  vi.stubGlobal('fetch', fetchMock);
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

describe('useKonlingCompanionReporter delivery flow', () => {
  it('delivers a confirmed direct event and presents the bubble', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (url.includes('/api/ai/companion/events') && init?.method === 'POST') {
        expect(body.pageKind).toBe('adaptive-practice');
        return jsonResponse({ eventId: 'event-1', status: 'confirmed' }, 201);
      }
      if (url.includes('/api/ai/companion/delivery')) {
        expect(body).toMatchObject({ eventId: 'event-1', courseId: 'adaptive-practice' });
        return jsonResponse({ sessionId: 'session-1', message: '这题答错了没关系，控灵陪你看懂它。' }, 201);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const { reporter, root } = renderHook({
      enabled: true,
      pageKind: 'adaptive-practice',
      pageRef: 'practice-1',
      delivery: { courseId: 'adaptive-practice' },
    });
    roots.push(root);

    await act(async () => {
      reporter.reportActivity('wrong-answer');
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(presentCompanionBubble).toHaveBeenCalledWith({
      eventId: 'event-1',
      message: '这题答错了没关系，控灵陪你看懂它。',
      sessionId: 'session-1',
    });
  });

  it('forwards knowledge-point hints to the delivery payload', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (url.includes('/api/ai/companion/events')) {
        return jsonResponse({ eventId: 'event-kp', status: 'confirmed' }, 201);
      }
      if (url.includes('/api/ai/companion/delivery')) {
        expect(body).toMatchObject({
          eventId: 'event-kp',
          contextHints: { knowledgePoints: ['拉普拉斯变换'] },
        });
        return jsonResponse({ sessionId: 'session-kp', message: '这题答错了没关系，控灵陪你看懂它。' }, 201);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const { reporter, root } = renderHook({
      enabled: true,
      pageKind: 'adaptive-practice',
      pageRef: 'practice-1',
      delivery: { courseId: 'adaptive-practice' },
    });
    roots.push(root);

    await act(async () => {
      reporter.reportActivity('wrong-answer', { knowledgePoints: ['拉普拉斯变换'] });
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(presentCompanionBubble).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event-kp' }));
  });

  it('does not deliver when the event is suppressed by the server', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/ai/companion/events')) {
        void init;
        return jsonResponse({ status: 'suppressed', reason: 'cooldown' });
      }
      throw new Error('delivery must not be called for suppressed events');
    });
    const { reporter, root } = renderHook({
      enabled: true,
      pageKind: 'adaptive-practice',
      pageRef: 'practice-1',
      delivery: { courseId: 'adaptive-practice' },
    });
    roots.push(root);

    await act(async () => {
      reporter.reportActivity('progress-milestone');
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(presentCompanionBubble).not.toHaveBeenCalled();
  });

  it('disables itself after a 404 (flag off) and stops calling the API', async () => {
    fetchMock.mockImplementationOnce(() => jsonResponse({ error: 'Companion disabled' }, 404));
    const { reporter, root } = renderHook({
      enabled: true,
      pageKind: 'resource-textbook',
      pageRef: 'res-1',
      delivery: { courseId: 'interactive' },
    });
    roots.push(root);

    await act(async () => {
      reporter.reportActivity('resource-completed');
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(presentCompanionBubble).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      reporter.reportActivity('resource-completed');
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never presents a bubble when delivery fails', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/ai/companion/events')) return jsonResponse({ eventId: 'event-2', status: 'confirmed' }, 201);
      return Promise.reject(new Error('network'));
    });
    const { reporter, root } = renderHook({
      enabled: true,
      pageKind: 'resource-textbook',
      pageRef: 'res-1',
      delivery: { courseId: 'interactive' },
    });
    roots.push(root);

    await act(async () => {
      reporter.reportActivity('resource-completed');
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(presentCompanionBubble).not.toHaveBeenCalled();
  });

  it('re-arms the pause watcher after a learning action so natural pauses stay reachable', async () => {
    vi.useFakeTimers();
    const hasFocusSpy = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    try {
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/ai/companion/events') && init?.method === 'POST') {
          return jsonResponse({ eventId: `event-${fetchMock.mock.calls.length}`, status: 'candidate' }, 201);
        }
        return jsonResponse({ status: 'confirmed' });
      });
      const { reporter, root } = renderHook({
        enabled: true,
        pageKind: 'resource-textbook',
        pageRef: 'res-1',
        delivery: { courseId: 'interactive' },
      });
      roots.push(root);

      const eventPosts = () => fetchMock.mock.calls.filter(([url, init]) => String(url).includes('/api/ai/companion/events') && init?.method === 'POST');

      // 首个空闲窗口产生候选。
      await act(async () => { await vi.advanceTimersByTimeAsync(30_500); });
      expect(eventPosts().length).toBeGreaterThanOrEqual(1);

      // 有效操作清掉计时器后必须重新布置：再等完整空闲窗口仍应产生新候选。
      await act(async () => {
        reporter.reportActivity();
      });
      expect(eventPosts().length).toBe(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(30_500); });
      expect(eventPosts().length).toBeGreaterThanOrEqual(2);
    } finally {
      hasFocusSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
