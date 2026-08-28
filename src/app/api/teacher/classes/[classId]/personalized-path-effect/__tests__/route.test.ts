import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    class: { findUnique: vi.fn() },
    learningPath: { findMany: vi.fn() },
    adaptivePathCandidateBatch: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('server-only', () => ({}));

import { GET } from '../route';

const params = { params: Promise.resolve({ classId: 'class-1' }) };

function get(url = 'http://localhost/api/teacher/classes/class-1/personalized-path-effect') {
  return new Request(url);
}

describe('GET /api/teacher/classes/[classId]/personalized-path-effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.learningPath.findMany.mockResolvedValue([]);
    mocks.prisma.adaptivePathCandidateBatch.findMany.mockResolvedValue([]);
  });

  it('rejects unauthenticated and unauthorized readers', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    expect((await GET(get(), params)).status).toBe(401);

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'student-1', role: 'STUDENT' } });
    expect((await GET(get(), params)).status).toBe(403);
  });

  it('returns a snapshot-bound evaluation for the owning teacher without writes', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-1',
      students: [{ userId: 'student-1' }],
    });
    mocks.prisma.learningPath.findMany.mockResolvedValue([{
      id: 'path-1',
      userId: 'student-1',
      goalId: 'control-correction',
      pathStatus: 'active',
      plannerVersion: 'adaptive-learning-path-planner.v1',
      nodeIds: ['n1'],
      pathPayload: { policyFamily: 'rules-plus-graph-search' },
      createdAt: new Date('2026-08-26T00:00:00.000Z'),
      executions: [],
    }]);

    const response = await GET(get(), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.evaluation.conclusion).toBe('insufficient-data');
    expect(payload.evaluation.classId).toBe('class-1');
    expect(mocks.prisma.learningPath.findMany).toHaveBeenCalled();
    expect(JSON.stringify(mocks.prisma)).not.toContain('update');
  });
});
