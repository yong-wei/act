import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  resolveSnapshot: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getServerAuthSession }));
vi.mock('@/lib/konling-learning-continuity', () => ({ resolveKonlingContinuitySnapshot: mocks.resolveSnapshot }));
vi.mock('@/lib/prisma', () => ({ prisma: { marker: 'prisma' } }));

import { GET } from '@/app/api/ai/konling-continuity/route';

describe('Konling continuity route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveSnapshot.mockResolvedValue({ snapshotId: 'continuity:1', state: 'cold_start', evidenceAsOf: null });
  });

  it('rejects unauthenticated reads', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mocks.resolveSnapshot).not.toHaveBeenCalled();
  });

  it('restricts continuity snapshots to students', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    expect((await GET()).status).toBe(403);
    expect(mocks.resolveSnapshot).not.toHaveBeenCalled();
  });

  it('derives the snapshot from the authenticated student only', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.resolveSnapshot).toHaveBeenCalledWith(expect.anything(), { userId: 'student-1' });
  });
});

