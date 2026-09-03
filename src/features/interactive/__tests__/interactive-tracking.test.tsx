// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { InteractiveTrackingContextValue } from '../types';
import { useInteractiveTracking } from '../hooks/useInteractiveTracking';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('useInteractiveTracking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('keeps demo session events local instead of posting to persisted event APIs', () => {
    const trackingRef: { current: InteractiveTrackingContextValue | null } = { current: null };

    function Harness() {
      trackingRef.current = useInteractiveTracking({
        resourceKey: 'unit-test-resource',
        sessionId: 'demo',
      });
      return null;
    }

    renderToString(<Harness />);

    const tracking = trackingRef.current;
    if (!tracking) throw new Error('Expected interactive tracking');
    tracking.emit('complete', { stepId: 'step-01' });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('persists critical events before starting asynchronous sync', async () => {
    let tracking: InteractiveTrackingContextValue | null = null;
    let releaseSync: (() => void) | undefined;
    const pendingSync = new Promise<void>((resolve) => { releaseSync = resolve; });
    const container = document.createElement('div');
    const root = createRoot(container);

    function Harness() {
      tracking = useInteractiveTracking({
        resourceKey: 'unit-test-resource',
        sessionId: 'session-1',
        userId: 'user-1',
        onSync: async () => pendingSync,
      });
      return null;
    }

    await act(async () => root.render(<Harness />));
    act(() => tracking?.emit('submit', { stepId: 'step-06' }));

    const stored = JSON.parse(localStorage.getItem('interactive_events_unit-test-resource:session-1:user-1') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ type: 'submit', stepId: 'step-06' });

    releaseSync?.();
    await act(async () => pendingSync);
    await act(async () => root.unmount());
  });

  it('serializes sync snapshots and retains events added during a failed follow-up sync', async () => {
    vi.useFakeTimers();
    const firstSync = deferred<void>();
    const secondSync = deferred<void>();
    const onSync = vi.fn()
      .mockImplementationOnce(() => firstSync.promise)
      .mockImplementationOnce(() => secondSync.promise)
      .mockResolvedValueOnce(undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const storageKey = 'interactive_events_unit-test-resource:session-race:user-race';
    let tracking: InteractiveTrackingContextValue | null = null;
    const container = document.createElement('div');
    const root = createRoot(container);

    function Harness() {
      tracking = useInteractiveTracking({
        resourceKey: 'unit-test-resource',
        sessionId: 'session-race',
        userId: 'user-race',
        syncInterval: 100,
        onSync,
      });
      return null;
    }

    await act(async () => root.render(<Harness />));
    act(() => tracking?.emit('submit', { stepId: 'step-a' }));
    await act(async () => Promise.resolve());
    expect(onSync).toHaveBeenCalledTimes(1);

    act(() => tracking?.emit('submit', { stepId: 'step-b' }));
    expect(onSync).toHaveBeenCalledTimes(1);

    firstSync.resolve();
    await act(async () => firstSync.promise);
    expect(onSync).toHaveBeenCalledTimes(2);

    secondSync.reject(new Error('B sync failed'));
    await act(async () => secondSync.promise.catch(() => undefined));

    const retained = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    expect(retained).toHaveLength(1);
    expect(retained[0]).toMatchObject({ type: 'submit', stepId: 'step-b' });

    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(onSync).toHaveBeenCalledTimes(3);
    expect(JSON.parse(localStorage.getItem(storageKey) ?? '[]')).toEqual([]);

    await act(async () => root.unmount());
    consoleError.mockRestore();
    vi.useRealTimers();
  });

  it('resets the queue when the identity key changes from guest to student (Issue #1913)', async () => {
    const onSync = vi.fn(async () => undefined);
    const identity: { userId?: string } = {};
    const trackingRef: { current: InteractiveTrackingContextValue | null } = { current: null };
    const container = document.createElement('div');
    const root = createRoot(container);

    function Harness() {
      trackingRef.current = useInteractiveTracking({
        resourceKey: 'standalone-resource',
        persistWithoutSession: true,
        userId: identity.userId,
        onSync,
      });
      return null;
    }

    await act(async () => root.render(<Harness />));
    act(() => trackingRef.current?.emit('complete', { stepId: 'guest-step' }));
    await act(async () => Promise.resolve());
    const guestKey = 'interactive_events_standalone-resource:no-session:no-user';
    expect(JSON.parse(localStorage.getItem(guestKey) ?? '[]')).toHaveLength(1);

    identity.userId = 'student-1';
    await act(async () => root.render(<Harness />));
    act(() => trackingRef.current?.emit('submit', { stepId: 'student-step' }));
    await act(async () => Promise.resolve());

    expect(onSync).toHaveBeenCalledTimes(1);
    expect(onSync.mock.calls[0][0]).toHaveLength(1);
    expect(onSync.mock.calls[0][0][0]).toMatchObject({ type: 'submit', stepId: 'student-step', userId: 'student-1' });
    // 访客事件保持在本键本地，不得被登录学生会话提交或清空。
    expect(JSON.parse(localStorage.getItem(guestKey) ?? '[]')).toHaveLength(1);
    const studentKey = 'interactive_events_standalone-resource:no-session:student-1';
    expect(JSON.parse(localStorage.getItem(studentKey) ?? '[]')).toEqual([]);
    await act(async () => root.unmount());
  });

  it('keeps each student\'s queue under their own identity key on A-to-B switch (Issue #1913)', async () => {
    vi.useFakeTimers();
    const onSync = vi.fn(async () => undefined);
    const identity = { userId: 'user-a' };
    const trackingRef: { current: InteractiveTrackingContextValue | null } = { current: null };
    const container = document.createElement('div');
    const root = createRoot(container);

    function Harness() {
      trackingRef.current = useInteractiveTracking({
        resourceKey: 'standalone-resource',
        sessionId: 'session-shared',
        userId: identity.userId,
        onSync,
      });
      return null;
    }

    await act(async () => root.render(<Harness />));
    act(() => trackingRef.current?.emit('complete', { stepId: 'a-synced' }));
    await act(async () => Promise.resolve());
    expect(onSync).toHaveBeenCalledTimes(1);
    act(() => trackingRef.current?.emit('view', { stepId: 'a-pending' }));
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const keyA = 'interactive_events_standalone-resource:session-shared:user-a';
    expect(JSON.parse(localStorage.getItem(keyA) ?? '[]')).toHaveLength(1);

    identity.userId = 'user-b';
    await act(async () => root.render(<Harness />));
    act(() => trackingRef.current?.emit('complete', { stepId: 'b-only' }));
    await act(async () => Promise.resolve());

    expect(onSync).toHaveBeenCalledTimes(2);
    expect(onSync.mock.calls[1][0]).toHaveLength(1);
    expect(onSync.mock.calls[1][0][0]).toMatchObject({ type: 'complete', stepId: 'b-only', userId: 'user-b' });
    // 用户 A 的待同步事件保留在 A 的键下，未被用户 B 提交或覆盖。
    expect(JSON.parse(localStorage.getItem(keyA) ?? '[]')).toHaveLength(1);
    const keyB = 'interactive_events_standalone-resource:session-shared:user-b';
    expect(JSON.parse(localStorage.getItem(keyB) ?? '[]')).toEqual([]);
    await act(async () => root.unmount());
    vi.useRealTimers();
  });

  it('restores pending events for the same identity after remount (Issue #1913)', async () => {
    const identity = { userId: 'user-a' };
    const trackingRef: { current: InteractiveTrackingContextValue | null } = { current: null };

    function Harness() {
      trackingRef.current = useInteractiveTracking({
        resourceKey: 'standalone-resource',
        userId: identity.userId,
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));
    act(() => trackingRef.current?.emit('complete', { stepId: 'pending-step' }));
    await act(async () => Promise.resolve());
    await act(async () => root.unmount());

    const trackingRefAfterRemount: { current: InteractiveTrackingContextValue | null } = { current: null };
    function RemountedHarness() {
      trackingRefAfterRemount.current = useInteractiveTracking({
        resourceKey: 'standalone-resource',
        userId: identity.userId,
      });
      return null;
    }
    const container2 = document.createElement('div');
    const root2 = createRoot(container2);
    await act(async () => root2.render(<RemountedHarness />));

    expect(trackingRefAfterRemount.current?.getHistory()).toMatchObject([
      { type: 'complete', stepId: 'pending-step' },
    ]);
    await act(async () => root2.unmount());
  });
});
