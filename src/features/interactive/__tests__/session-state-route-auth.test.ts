import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/session/[sessionId]/state/route';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    studentState: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      count: mocks.count,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/classroom-observability', () => ({
  logClassroomEvent: vi.fn(),
}));

function params(sessionId = 'session-1') {
  return { params: Promise.resolve({ sessionId }) };
}

describe('/api/session/[sessionId]/state auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects teacher-view state requests from student users', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.findMany.mockResolvedValue([]);

    const response = await GET(
      new Request('http://localhost/api/session/session-1/state?scope=teacher-view'),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('rejects default all-student state requests from student users', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.findMany.mockResolvedValue([]);

    const response = await GET(
      new Request('http://localhost/api/session/session-1/state'),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('allows teacher users to read teacher-view state', async () => {
    const submittedAt = new Date('2026-06-15T00:00:00.000Z');
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.findMany
      .mockResolvedValueOnce([{ id: 'course-state-1', submittedAt }])
      .mockResolvedValueOnce([]);

    const response = await GET(
      new Request('http://localhost/api/session/session-1/state?scope=teacher-view'),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary).toEqual({
      totalStudents: 1,
      latestUpdate: submittedAt.toISOString(),
    });
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });
});
