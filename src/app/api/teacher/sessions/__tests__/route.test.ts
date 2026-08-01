import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const findMany = vi.fn();
  const findUnique = vi.fn();
  const update = vi.fn();
  const deleteFn = vi.fn();
  const classFindMany = vi.fn();
  const classFindUnique = vi.fn();
  const getServerAuthSession = vi.fn();

  return {
    prisma: {
      classSession: {
        findMany,
        findUnique,
        update,
        delete: deleteFn,
      },
      class: {
        findMany: classFindMany,
        findUnique: classFindUnique,
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
    mocks.prisma.class.findMany.mockResolvedValue([]);

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

  it('returns classless direct-start sessions as unattributed history', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.classSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        joinCode: '187470',
        status: 'FINISHED',
        startTime: new Date('2026-04-28T01:00:00.000Z'),
        endTime: new Date('2026-04-28T02:03:00.000Z'),
        currentStage: null,
        classId: null,
        class: null,
        plan: { id: 'plan-1', title: '3-7' },
        studentStates: [
          { user: { profile: { classId: 'class-1' } } },
          { user: { profile: { classId: 'class-1' } } },
          { user: { profile: { classId: 'class-2' } } },
        ],
        _count: { studentStates: 3 },
        classSessionReports: [],
      },
    ]);
    const response = await GET(new Request('http://localhost/api/teacher/sessions'));
    const payload = await response.json();

    expect(payload[0]).toMatchObject({
      id: 'session-1',
      classId: null,
      className: null,
      classAttribution: {
        classId: null,
        mode: 'unassigned',
        confidence: 0,
      },
    });
  });

  it('uses governance report statistics for classroom history counts when available', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.classSession.findMany.mockResolvedValue([
      {
        id: 'session-4-4',
        joinCode: '703810',
        status: 'FINISHED',
        startTime: new Date('2026-05-12T00:22:20.391Z'),
        endTime: new Date('2026-05-12T02:05:09.624Z'),
        currentStage: null,
        classId: 'class-1',
        class: { id: 'class-1', name: '2024自动化' },
        plan: { id: 'plan-4-4', title: '4-4' },
        studentStates: [],
        _count: { studentStates: 0 },
        classSessionReports: [{
          reportData: {
            sessionGovernanceSummary: {
              sessionParticipants: 77,
              loggedParticipants: 73,
              factParticipants: 50,
              submittedParticipants: 49,
              snapshotUpdatedParticipants: 50,
              syncErrorUsers: 11,
            },
          },
        }],
      },
    ]);
    mocks.prisma.class.findMany.mockResolvedValue([
      { id: 'class-1', name: '2024自动化' },
    ]);

    const response = await GET(new Request('http://localhost/api/teacher/sessions'));
    const payload = await response.json();

    expect(payload[0]).toMatchObject({
      id: 'session-4-4',
      studentCount: 77,
      durationMinutes: 103,
      sessionStatistics: {
        studentCount: 77,
        hasGovernanceSummary: true,
        governanceSummary: {
          loggedParticipants: 73,
          submittedParticipants: 49,
          syncErrorUsers: 11,
        },
      },
    });
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
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-2',
      teacherId: 'teacher-1',
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
    expect(mocks.prisma.classSession.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'session-1' },
      data: { classId: 'class-2' },
    }));
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
