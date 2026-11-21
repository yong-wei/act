// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classroomWaitFragment, studentEntryTarget } from '@/features/classroom/session/student-entry-target';
import { useStudentClassroomEntry } from '../shared/student-classroom-admission';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const href = '/interactive-learning/courses/unit-1-2/student/test-session';
function Entry({ enabled = true }: { enabled?: boolean }) {
  const { enter, waiting } = useStudentClassroomEntry();
  return waiting ?? <button onClick={() => enter(href, enabled)}>进入课堂</button>;
}

describe('student entry waiting', () => {
  let root: Root;
  let node: HTMLDivElement;
  const fetch = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('fetch', fetch);
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/classroom/join?code=123456');
    node = document.createElement('div');
    root = createRoot(node);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens the canonical route immediately when the server did not offer entry-page waiting', async () => {
    await act(async () => root.render(<Entry enabled={false} />));
    await act(async () => node.querySelector('button')!.click());
    expect(router.push).toHaveBeenCalledWith(href);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('restores waiting from the fragment and follows the server delay before entering', async () => {
    window.history.replaceState(null, '', classroomWaitFragment + href);
    fetch.mockResolvedValueOnce(Response.json({ admission: 'waiting', retryAfterMs: 2000 }, { status: 202 }));
    fetch.mockResolvedValueOnce(Response.json({ admission: 'ready', status: 'ACTIVE' }));
    await act(async () => root.render(<Entry />));
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(node.textContent).toContain('正在连接课堂');
    await act(async () => { await vi.advanceTimersByTimeAsync(1998); });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(360); });
    expect(router.replace).toHaveBeenCalledWith(href);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('ignores a late grant after leaving the waiting history entry', async () => {
    let complete!: (r: Response) => void;
    fetch.mockReturnValueOnce(new Promise<Response>(resolve => { complete = resolve; }));
    await act(async () => root.render(<Entry />));
    await act(async () => { node.querySelector('button')!.click(); await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetch).toHaveBeenCalledTimes(1);
    window.history.replaceState(null, '', '/classroom/join');
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      complete(Response.json({ admission: 'ready' }));
    });
    expect(router.replace).not.toHaveBeenCalled();
    expect(node.querySelector('button')).not.toBeNull();
  });

  it('only recognizes same-origin interactive student targets', () => {
    for (const route of ['//elsewhere.test/a', href + '?next=elsewhere', href.replace('/student/', '/teacher/'),
      href.replace('test-session', 'demo'), '/classroom/student/test-session']) {
      expect(studentEntryTarget(route)).toBeNull();
    }
  });
});
