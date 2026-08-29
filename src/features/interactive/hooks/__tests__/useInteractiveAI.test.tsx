// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import type { InteractiveAIContextValue, InteractiveConfig } from '@/features/interactive/types';

const auth = vi.hoisted(() => ({
  status: 'authenticated' as 'loading' | 'authenticated' | 'unauthenticated',
  userId: 'student-1' as string | null,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: auth.status,
    data: auth.userId ? { user: { id: auth.userId } } : null,
  }),
}));

const config: InteractiveConfig = {
  resourceId: 'pid-tuner',
  registryId: 'pid-tuner',
  title: 'PID 调节',
  config: { ai: { enabled: true } },
};

function jsonResponse(body: unknown, init?: { status?: number }) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function chatStream(text: string, sessionKind: 'recoverable' | 'ephemeral') {
  return new Response(`0:${JSON.stringify(text)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Interactive-AI-Session': sessionKind,
    },
  });
}

describe('useInteractiveAI governed session', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: InteractiveAIContextValue | null;

  function Probe(props: { classroomSessionId?: string | null }) {
    latest = useInteractiveAI({
      config,
      classroomSessionId: props.classroomSessionId,
      contextData: { progress: 87, isComplete: true },
    });
    return null;
  }

  async function mount(classroomSessionId?: string | null) {
    await act(async () => {
      root.render(<Probe classroomSessionId={classroomSessionId} />);
    });
  }

  async function waitFor(predicate: () => boolean, timeout = 1000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (predicate()) return;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    throw new Error('timed out waiting for interactive AI state');
  }

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    auth.status = 'authenticated';
    auth.userId = 'student-1';
    latest = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('marks unauthenticated development callers as ephemeral and does not create a session', async () => {
    auth.status = 'unauthenticated';
    auth.userId = null;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(chatStream('一轮回答', 'ephemeral'));

    await mount();
    await waitFor(() => latest?.recoveryStatus === 'ephemeral');

    await act(async () => {
      await latest?.sendMessage('这题怎么做？');
    });

    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/ai/sessions'))).toBe(false);
    const chatCall = fetchMock.mock.calls.find(([input]) => String(input) === '/api/ai/chat');
    expect(chatCall).toBeTruthy();
    const body = JSON.parse(String(chatCall?.[1]?.body)) as Record<string, unknown>;
    expect(body.conversationId).toBeUndefined();
    expect(body).not.toHaveProperty('contextData');
    expect(latest?.recoveryStatus).toBe('ephemeral');
  });

  it('recovers governed history, sends only the current question, and isolates a mismatched resource', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/ai/sessions?') && (!init || init.method === undefined || init.method === 'GET')) {
        expect(url).toContain('courseId=interactive');
        expect(url).toContain('pageId=');
        return jsonResponse({ conversations: [{ id: 'conv-pid' }] });
      }
      if (url === '/api/ai/sessions/conv-pid') {
        return jsonResponse({
          id: 'conv-pid',
          messages: [
            { id: 'u1', role: 'user', content: 'P 增益过大会怎样？' },
            { id: 'a1', role: 'assistant', content: '超调会变大。' },
          ],
        });
      }
      if (url === '/api/ai/chat') {
        const body = JSON.parse(String(init?.body)) as {
          conversationId?: string;
          messages: Array<{ content: string }>;
          contextData?: unknown;
        };
        expect(body.conversationId).toBe('conv-pid');
        expect(body.messages).toEqual([{ role: 'user', content: '那积分项呢？' }]);
        expect(body).not.toHaveProperty('contextData');
        return new Response(JSON.stringify({ error: 'INTERACTIVE_AI_RESOURCE_MISMATCH' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    await mount();
    await waitFor(() => latest?.recoveryStatus === 'ready' && latest.messages.length === 2);
    expect(latest?.messages.map((message) => message.content)).toEqual([
      'P 增益过大会怎样？',
      '超调会变大。',
    ]);

    await expect(act(async () => {
      await latest?.sendMessage('那积分项呢？');
    })).rejects.toThrow('当前资源的对话已隔离，请重新提问。');

    await waitFor(() => latest?.messages.length === 1 && latest.messages[0]?.content === '那积分项呢？');
  });

  it('does not create a session while recovery is loading or unavailable', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/ai/sessions?')) {
        await new Promise(() => undefined);
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    await mount();
    await waitFor(() => latest?.recoveryStatus === 'loading');
    await expect(act(async () => {
      await latest?.sendMessage('还没恢复完');
    })).rejects.toThrow('正在恢复学习对话，请稍候。');
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/ai/sessions')).toBe(false);

    act(() => {
      root.unmount();
    });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, { status: 500 }));
    root = createRoot(container);
    latest = null;
    await mount();
    await waitFor(() => latest?.recoveryStatus === 'unavailable');
    await expect(act(async () => {
      await latest?.sendMessage('恢复失败后继续问');
    })).rejects.toThrow('无法恢复学习对话');
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/ai/sessions')).toBe(false);
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/ai/chat')).toBe(false);
  });
});
