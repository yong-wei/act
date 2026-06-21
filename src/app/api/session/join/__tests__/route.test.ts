import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  prisma: {
    classSession: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/classroom-observability', () => ({
  logClassroomEvent: vi.fn(),
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

import { GET } from '../route';

describe('GET /api/session/join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
  });

  it('returns a generic evidence route for finished sessions without exposing raw classroom links', async () => {
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-finished-1',
      joinCode: '123456',
      status: 'FINISHED',
      currentStage: 'ENDED',
      currentItemId: null,
      classId: 'class-1',
      plan: {
        id: 'plan-1',
        title: '课堂计划',
      },
      teacher: {
        name: '教师甲',
      },
      class: {
        name: '一班',
      },
    });

    const response = await GET(new Request('http://localhost/api/session/join?code=123456'));
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toMatchObject({
      error: '该课堂已结束',
      reviewHref: '/profile/evidence',
      joinState: {
        state: 'finished',
      },
    });
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('sessionId');
    expect(body).not.toHaveProperty('studentHref');
    expect(body).not.toHaveProperty('teacherHref');
  });
});
