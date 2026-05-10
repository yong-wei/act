import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    class: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { POST } from '../route';

const validBody = {
  taskId: 'task-integrator-low-frequency-balance',
  classId: 'class-2026-control',
  visibility: 'class',
  deadline: '2026-06-01T15:00:00.000Z',
  leaderboardPolicyId: 'leaderboard-class-homework',
  homeworkBinding: true,
};

function postJson(body: unknown) {
  return POST(new Request('http://localhost/api/teacher/arena/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/teacher/arena/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects anonymous and student requests', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    expect((await postJson(validBody)).status).toBe(401);

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'student-1', role: 'STUDENT' } });
    expect((await postJson(validBody)).status).toBe(403);
  });

  it('rejects classes not owned by the teacher', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-2026-control', teacherId: 'teacher-2' });

    const response = await postJson(validBody);

    expect(response.status).toBe(403);
  });

  it('rejects invalid visibility and unknown task configurations with 400', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-2026-control', teacherId: 'teacher-1' });

    expect((await postJson({ ...validBody, visibility: 'school' })).status).toBe(400);
    expect((await postJson({ ...validBody, taskId: 'missing-task' })).status).toBe(400);
  });

  it('returns a publication preview for a teacher-owned class', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-2026-control', teacherId: 'teacher-1' });

    const response = await postJson(validBody);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.publication).toMatchObject({
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-2026-control',
      studentVisibility: 'class',
    });
  });
});
