// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useKonlingConversationLibrary,
  type KonlingConversationAssistantBinding,
} from '@/hooks/useKonlingConversationLibrary';

const coachBinding: KonlingConversationAssistantBinding = {
  teachingAssistantModeId: 'resource-coach',
  modeClientContextHints: {
    resourceKind: 'structured-textbook-unit',
    resourceId: 'unit-3-1',
    sourceRevision: 'rev-2026-08',
    unitId: 'unit-3-1',
    contentHash: 'sha256:abc',
  },
};

function conversationSummary(id: string) {
  return {
    id,
    courseId: 'course-1',
    pageId: 'page-1',
    title: `会话 ${id}`,
    titleIsManual: false,
    pinned: false,
    pinnedAt: null,
    lastActivityAt: '2026-08-30T00:00:00.000Z',
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    expiresAt: null,
  };
}

function conversationDetail(id: string) {
  return {
    ...conversationSummary(id),
    userId: 'student-1',
    messages: [],
    assistantBinding: null,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type HookValue = ReturnType<typeof useKonlingConversationLibrary>;

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useKonlingConversationLibrary', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: HookValue | null;
  let fetchMock: ReturnType<typeof vi.fn>;

  function render(options?: Partial<Parameters<typeof useKonlingConversationLibrary>[0]>) {
    function Probe() {
      latest = useKonlingConversationLibrary({
        enabled: true,
        courseId: 'course-1',
        pageId: 'page-1',
        ...options,
      });
      return null;
    }
    act(() => {
      root.render(<Probe />);
    });
  }

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('normalizes a rejected conversation fetch into student-safe network copy', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render();

    await flush();
    await flush();

    expect(latest?.error?.message).toBe('网络连接不可用，请检查网络后重试。');
    expect(latest?.error?.message).not.toContain('Failed to fetch');
  });

  it('auto-selects the first listed conversation by default', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ conversations: [conversationSummary('c-1')] }));
    render();
    await flush();
    await flush();

    expect(latest?.hasHydratedList).toBe(true);
    expect(latest?.activeConversationId).toBe('c-1');
  });

  it('keeps an unselected blank state without creating while hydration is pending', async () => {
    let resolveList: ((response: Response) => void) | null = null;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') return Promise.resolve(jsonResponse(conversationDetail('created-1'), 201));
      if (url.includes('/api/ai/sessions/')) return Promise.resolve(jsonResponse(conversationDetail('c-9')));
      return new Promise<Response>((resolve) => {
        resolveList = resolve;
      });
    });
    render({ autoSelectFirstConversation: false, assistantBinding: coachBinding });

    // 列表仍未返回：不得选中也不得创建
    expect(latest?.hasHydratedList).toBe(false);
    expect(latest?.activeConversationId).toBeNull();
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(false);

    await act(async () => {
      resolveList?.(new Response(JSON.stringify({ conversations: [conversationSummary('c-9')] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    // 水合完成后仍不自动选中无关会话
    expect(latest?.hasHydratedList).toBe(true);
    expect(latest?.activeConversationId).toBeNull();
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
  });

  it('clears the selection without persisting anything when entering the blank state', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') return Promise.resolve(jsonResponse(conversationDetail('created-1'), 201));
      if (url.includes('/api/ai/sessions/c-9')) return Promise.resolve(jsonResponse(conversationDetail('c-9')));
      return Promise.resolve(jsonResponse({ conversations: [conversationSummary('c-9')] }));
    });
    render({ autoSelectFirstConversation: false });
    await flush();

    act(() => latest?.selectConversation('c-9'));
    await flush();
    expect(latest?.activeConversationId).toBe('c-9');

    act(() => latest?.enterBlankConversation());
    expect(latest?.activeConversationId).toBeNull();
    expect(latest?.activeConversation).toBeNull();
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
  });

  it('sends the assistant binding to the server on first-question creation', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          ...conversationDetail('created-1'),
          assistantBinding: coachBinding,
        }, 201));
      }
      if (url.includes('/api/ai/sessions/')) {
        return Promise.resolve(jsonResponse({
          ...conversationDetail('created-1'),
          assistantBinding: coachBinding,
        }));
      }
      return Promise.resolve(jsonResponse({ conversations: [] }));
    });
    render({ autoSelectFirstConversation: false, assistantBinding: coachBinding });
    await flush();

    await act(async () => {
      await latest?.ensureConversation();
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(postCall).toBeDefined();
    const body = JSON.parse(String((postCall?.[1] as RequestInit).body));
    expect(body.assistantBinding).toEqual({
      modeId: 'resource-coach',
      clientContextHints: coachBinding.modeClientContextHints,
    });
    expect(latest?.activeConversationId).toBe('created-1');
  });
});
