// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionState = vi.hoisted(() => ({ user: { id: 'user-1' } as { id: string } | null }));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: sessionState.user ? { user: sessionState.user } : null }),
}));

import {
  resolveInteractiveLaunchProvenance,
} from '../hooks/resource-interaction-utils';
import { InteractiveProvider } from '../InteractiveProvider';
import { useResourceInteractionTracking } from '../hooks/useResourceInteractionTracking';
import type { InteractiveConfig } from '../types';

describe('resolveInteractiveLaunchProvenance (Issue #1914)', () => {
  it('keeps the legacy embedded/sessionId inference when no explicit contract is given', () => {
    expect(resolveInteractiveLaunchProvenance({ embedded: true })).toBe('classroom');
    expect(resolveInteractiveLaunchProvenance({ embedded: true, sessionId: 'session-1' })).toBe('classroom');
    expect(resolveInteractiveLaunchProvenance({ sessionId: 'session-1' })).toBe('classroom');
    expect(resolveInteractiveLaunchProvenance({})).toBe('standalone');
  });

  it('treats the explicit launch contract as authoritative over presentation flags', () => {
    expect(resolveInteractiveLaunchProvenance({
      embedded: true,
      launchContext: { provenance: 'standalone' },
    })).toBe('standalone');
    expect(resolveInteractiveLaunchProvenance({
      embedded: false,
      launchContext: { provenance: 'classroom' },
    })).toBe('classroom');
    expect(resolveInteractiveLaunchProvenance({
      embedded: false,
      launchContext: { provenance: 'preview' },
    })).toBe('preview');
  });
});

function minimalConfig(): InteractiveConfig {
  return {
    resourceId: 'res-standalone-1',
    registryId: 'registry-1',
    title: '独立互动资源',
    config: {
      props: {},
      tracking: { syncInterval: 100000 },
      layout: { showHeader: false, showAIPanel: false },
    },
  };
}

function interactiveEventSyncCalls() {
  return (fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter((call) => String(call[0]).includes('/api/interactive/events'));
}

describe('InteractiveProvider standalone launch persistence (Issue #1914)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sessionState.user = { id: 'user-1' };
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  });

  it('classifies and persists authenticated standalone launches through the shared renderer path', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => root.render(
      <InteractiveProvider
        config={minimalConfig()}
        embedded={true}
        userId="user-1"
        launchContext={{ provenance: 'standalone' }}
        showHeader={false}
        showAIPanel={false}
      >
        <div>resource body</div>
      </InteractiveProvider>,
    ));

    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const stored = JSON.parse(
      localStorage.getItem('interactive_events_res-standalone-1:no-session:user-1') ?? '[]',
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].data).toMatchObject({
      surface: 'interactive_resource',
      pageType: 'resource',
      eventType: 'resource_view',
    });

    await act(async () => vi.advanceTimersByTimeAsync(100000));
    const syncCalls = interactiveEventSyncCalls();
    expect(syncCalls).toHaveLength(1);
    const body = JSON.parse(syncCalls[0][1].body);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].data).toMatchObject({ surface: 'interactive_resource' });
    await act(async () => root.unmount());
    vi.useRealTimers();
  });

  it('keeps classroom launches local when there is no classroom session and no standalone contract', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => root.render(
      <InteractiveProvider
        config={minimalConfig()}
        embedded={true}
        userId="user-1"
        launchContext={{ provenance: 'classroom' }}
        showHeader={false}
        showAIPanel={false}
      >
        <div>resource body</div>
      </InteractiveProvider>,
    ));

    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const stored = JSON.parse(
      localStorage.getItem('interactive_events_res-standalone-1:no-session:user-1') ?? '[]',
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].data).toMatchObject({
      surface: 'classroom_resource',
      pageType: 'classroom',
      eventType: 'page_view',
    });

    await act(async () => vi.advanceTimersByTimeAsync(100000));
    expect(interactiveEventSyncCalls()).toHaveLength(0);
    await act(async () => root.unmount());
    vi.useRealTimers();
  });

  it('keeps authenticated teacher orchestration previews non-persistent (Issue #1914 Codex R1)', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => root.render(
      <InteractiveProvider
        config={minimalConfig()}
        embedded={true}
        userId="teacher-1"
        launchContext={{ provenance: 'preview' }}
        showHeader={false}
        showAIPanel={false}
      >
        <div>preview body</div>
      </InteractiveProvider>,
    ));

    await act(async () => vi.advanceTimersByTimeAsync(1000));
    await act(async () => vi.advanceTimersByTimeAsync(100000));
    expect(interactiveEventSyncCalls()).toHaveLength(0);
    // 临时化预览完全不写可同步队列：教师稍后从独立入口打开同资源时
    // 不会恢复并提交任何预览事件（Issue #1914 Codex R2）。
    expect(localStorage.getItem('interactive_events_res-standalone-1:no-session:teacher-1')).toBeNull();
    await act(async () => root.unmount());
    vi.useRealTimers();
  });

  it('keeps anonymous standalone launches local without server persistence', async () => {
    sessionState.user = null;
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => root.render(
      <InteractiveProvider
        config={minimalConfig()}
        embedded={true}
        launchContext={{ provenance: 'standalone' }}
        showHeader={false}
        showAIPanel={false}
      >
        <div>resource body</div>
      </InteractiveProvider>,
    ));

    await act(async () => vi.advanceTimersByTimeAsync(1000));
    await act(async () => vi.advanceTimersByTimeAsync(100000));
    expect(interactiveEventSyncCalls()).toHaveLength(0);
    const stored = JSON.parse(
      localStorage.getItem('interactive_events_res-standalone-1:no-session:no-user') ?? '[]',
    );
    expect(stored).toHaveLength(1);
    await act(async () => root.unmount());
    vi.useRealTimers();
  });
});

describe('useResourceInteractionTracking classroom session propagation (Issue #1914)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sessionState.user = { id: 'user-1' };
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  });

  it('carries the classroom session identity on knowledge-card events', async () => {
    const trackerRef: { current: ReturnType<typeof useResourceInteractionTracking> | null } = { current: null };

    function Probe() {
      trackerRef.current = useResourceInteractionTracking({
        resourceKey: 'knowledge-card:node-1',
        sessionId: 'session-class-1',
        surface: 'knowledge_card',
        pageType: 'knowledge',
        targetType: 'knowledge_card',
        targetId: 'node-1',
        targetLabel: '节点一',
        provider: 'resource-renderer',
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<Probe />));
    act(() => trackerRef.current?.trackKnowledgeCardOpen({}));
    await act(async () => vi.advanceTimersByTimeAsync(1000));

    const stored = JSON.parse(
      localStorage.getItem('interactive_events_knowledge-card:node-1:session-class-1:user-1') ?? '[]',
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ sessionId: 'session-class-1', userId: 'user-1' });
    expect(stored[0].data).toMatchObject({ surface: 'knowledge_card', eventType: 'knowledge_card_open' });
    await act(async () => root.unmount());
    vi.useRealTimers();
  });

  it('carries path launch identity on resource events and omits it for standalone opens', async () => {
    const trackerRef: { current: ReturnType<typeof useResourceInteractionTracking> | null } = { current: null };

    function Probe({ withPath }: { withPath: boolean }) {
      trackerRef.current = useResourceInteractionTracking({
        resourceKey: 'resource-renderer',
        surface: 'interactive_resource',
        pageType: 'resource',
        targetType: 'interactive_resource',
        targetId: 'res-1',
        provider: 'resource-renderer',
        resourceType: 'quiz',
        ...(withPath ? { pathId: 'path-1', goalId: 'control-correction', nodeId: 'node-1' } : {}),
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<Probe withPath={true} />));
    await act(async () => {
      await trackerRef.current?.trackResourceComplete({ score: 100 });
    });
    const pathBody = JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body));
    const pathEvent = pathBody.events.at(-1);
    expect(pathEvent?.id).toBe(pathEvent?.data.clientEventId);
    expect(pathEvent?.data).toMatchObject({
      pathId: 'path-1',
      goalId: 'control-correction',
      nodeId: 'node-1',
      score: 100,
      clientEventId: expect.any(String),
    });

    await act(async () => root.render(<Probe withPath={false} />));
    act(() => trackerRef.current?.clearHistory());
    await act(async () => {
      await trackerRef.current?.trackResourceComplete({});
    });
    const standaloneBody = JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body));
    expect(standaloneBody.events.at(-1)?.data).not.toMatchObject({
      pathId: 'path-1',
    });
    await act(async () => root.unmount());
    vi.useRealTimers();
  });
});
