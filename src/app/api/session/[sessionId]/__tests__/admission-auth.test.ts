import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/features/classroom/session', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/classroom/session')>(),
  readClassroomSessionUseCase: mocks.read,
}));
import { GET } from '../route';

describe('课堂候场的中央准入', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('measures the current session and queue checks separately without caching a waiting response', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'test-student', role: 'STUDENT' } });
    mocks.read.mockResolvedValue({ admission: 'waiting', retryAfterMs: 900 });
    const response = await GET(new Request('http://localhost/api/session/test?admission=only'), {
      params: Promise.resolve({ sessionId: 'test' }),
    });
    expect(response.status).toBe(202);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('server-timing')).toMatch(/^session;dur=\d+\.\d, classroom;dur=\d+\.\d$/);
  });

  it.each([
    ['admission=only', 'ACT_ACCESS_UNAVAILABLE', 202],
    ['studentSync=1&admission=1', 'ACT_ACCESS_UNAVAILABLE', 202],
    ['studentSync=1', 'ACT_ACCESS_UNAVAILABLE', 503],
    ['admission=only', 'ACT_ACCESS_DENIED', 403],
    ['admission=only', undefined, 401],
  ])('%s / %s → %i，未确认身份时不读取课堂', async (query, error, status) => {
    mocks.session.mockResolvedValue(error ? { error } : null);
    const response = await GET(new Request(`http://localhost/api/session/test?${query}`), {
      params: Promise.resolve({ sessionId: 'test' }),
    });
    expect(response.status).toBe(status);
    expect(mocks.read).not.toHaveBeenCalled();
    if (status === 202) {
      expect(await response.json()).toEqual({ admission: 'waiting', retryAfterMs: 3000 });
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    }
  });
});
