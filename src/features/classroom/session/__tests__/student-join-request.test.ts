import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupStudentClassroom } from '../student-join-request';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('student classroom lookup', () => {
  it('retries a network interruption and a temporary server error', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const result = lookupStudentClassroom('123456');
    await vi.runAllTimersAsync();
    expect((await result).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenLastCalledWith('/api/session/join?code=123456', expect.objectContaining({ cache: 'no-store' }));
  });

  it('surfaces an invalid classroom or unauthorized request immediately', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    vi.stubGlobal('fetch', fetch);
    expect((await lookupStudentClassroom('123456')).status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
