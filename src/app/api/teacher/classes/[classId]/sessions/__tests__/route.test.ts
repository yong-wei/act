import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getServerSession = vi.fn();
  const classFindUnique = vi.fn();
  const classSessionFindMany = vi.fn();

  return {
    getServerSession,
    prisma: {
      class: {
        findUnique: classFindUnique,
      },
      classSession: {
        findMany: classSessionFindMany,
      },
    },
  };
});

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { GET } from '../route';

describe('GET /api/teacher/classes/[classId]/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses governance report statistics for class-scoped classroom history', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-1',
    });
    mocks.prisma.classSession.findMany.mockResolvedValue([
      {
        id: 'session-with-report',
        joinCode: '703810',
        status: 'FINISHED',
        startTime: new Date('2026-05-12T00:22:20.391Z'),
        endTime: new Date('2026-05-12T02:05:09.624Z'),
        currentStage: null,
        classId: 'class-1',
        plan: { id: 'plan-1', title: '4-4' },
        studentStates: [
          { user: { profile: { classId: 'class-1' } } },
        ],
        _count: { studentStates: 1 },
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

    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/sessions'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload[0]).toMatchObject({
      id: 'session-with-report',
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
