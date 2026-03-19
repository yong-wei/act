import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const findMany = vi.fn();
  const findUnique = vi.fn();
  const update = vi.fn();
  const deleteFn = vi.fn();
  const getServerAuthSession = vi.fn();

  return {
    prisma: {
      classSession: {
        findMany,
        findUnique,
        update,
        delete: deleteFn,
      },
    },
    getServerAuthSession,
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

import { DELETE, GET, PATCH } from '../route';

describe('GET /api/teacher/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only finished sessions for the current teacher by default', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.classSession.findMany.mockResolvedValue([]);

    const response = await GET(new Request('http://localhost/api/teacher/sessions'));

    expect(response.status).toBe(200);
    expect(mocks.prisma.classSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teacherId: 'teacher-1',
          status: 'FINISHED',
        }),
      })
    );
  });
});

describe('PATCH /api/teacher/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the class binding of a finished session owned by the teacher', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-1',
      teacherId: 'teacher-1',
      status: 'FINISHED',
    });
    mocks.prisma.classSession.update.mockResolvedValue({
      id: 'session-1',
      classId: 'class-2',
    });

    const response = await PATCH(
      new Request('http://localhost/api/teacher/sessions?id=session-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: 'class-2' }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.classSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { classId: 'class-2' },
    });
  });
});

describe('DELETE /api/teacher/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a finished session owned by the teacher', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-1',
      teacherId: 'teacher-1',
      status: 'FINISHED',
    });
    mocks.prisma.classSession.delete.mockResolvedValue({ id: 'session-1' });

    const response = await DELETE(
      new Request('http://localhost/api/teacher/sessions?id=session-1', {
        method: 'DELETE',
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.classSession.delete).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    });
  });
});
