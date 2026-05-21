import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    class: {
      findUnique: vi.fn(),
    },
    studentProfile: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    learningFact: {
      findMany: vi.fn(),
    },
    studentStepResponse: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { GET } from '@/app/api/teacher/classes/[classId]/students/[studentId]/evidence/route';
import { GET as GET_LEGACY } from '@/app/api/teacher/students/[studentId]/evidence/route';

describe('GET /api/teacher/classes/[classId]/students/[studentId]/evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      teacherId: 'teacher-1',
    });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({
      id: 'profile-1',
      userId: 'student-1',
      studentNumber: 'S001',
      classId: 'class-1',
      user: {
        id: 'student-1',
        name: '学生甲',
        email: 'student@example.test',
      },
    });
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      userId: 'student-1',
      studentNumber: 'S001',
      classId: 'class-1',
      class: {
        id: 'class-1',
        name: '自动控制 1 班',
        teacherId: 'teacher-1',
      },
      user: {
        id: 'student-1',
        name: '学生甲',
        email: 'student@example.test',
      },
    });
    mocks.prisma.learningFact.findMany.mockResolvedValue([
      {
        id: 'fact-5-1',
        userId: 'student-1',
        factType: 'question',
        moduleId: 'step-05',
        sessionId: 'session-1',
        startedAt: new Date('2026-05-20T08:00:00.000Z'),
        finishedAt: new Date('2026-05-20T08:04:00.000Z'),
        outcome: 'partial',
        score: 64,
        timeSpent: 240,
        competencyContribution: { engineeringDecision: 0.6 },
        sourceEventId: 'event-1',
        sourceLogId: 'log-1',
        courseId: 'automatic-control',
        lessonId: 'unit-5-1-controller-parameter-observation',
        contextJson: {},
        createdAt: new Date('2026-05-20T08:04:01.000Z'),
      },
    ]);
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([]);
  });

  it('returns class-scoped evidence for the owning teacher', async () => {
    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/students/student-1/evidence?dimension=engineeringDecision'),
      { params: Promise.resolve({ classId: 'class-1', studentId: 'student-1' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.class.findUnique).toHaveBeenCalledWith({
      where: { id: 'class-1' },
      select: { id: true, name: true, teacherId: true },
    });
    expect(mocks.prisma.studentProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { classId: 'class-1', userId: 'student-1' },
    }));
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'student-1' }),
    }));
    expect(payload.student).toMatchObject({
      id: 'student-1',
      name: '学生甲',
      classId: 'class-1',
    });
    expect(payload.items[0]).toMatchObject({
      id: 'fact-5-1',
      lessonId: 'unit-5-1-controller-parameter-observation',
    });
  });

  it('denies teachers outside the class scope', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      teacherId: 'teacher-2',
    });

    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/students/student-1/evidence'),
      { params: Promise.resolve({ classId: 'class-1', studentId: 'student-1' }) }
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.studentProfile.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.learningFact.findMany).not.toHaveBeenCalled();
  });

  it('denies students outside the requested class', async () => {
    mocks.prisma.studentProfile.findFirst.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/students/student-2/evidence'),
      { params: Promise.resolve({ classId: 'class-1', studentId: 'student-2' }) }
    );

    expect(response.status).toBe(404);
    expect(mocks.prisma.learningFact.findMany).not.toHaveBeenCalled();
  });

  it('guards the legacy teacher evidence route by the student class owner', async () => {
    const response = await GET_LEGACY(
      new Request('http://localhost/api/teacher/students/student-1/evidence?lessonId=unit-5-1-controller-parameter-observation'),
      { params: Promise.resolve({ studentId: 'student-1' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1' },
    }));
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        lessonId: 'unit-5-1-controller-parameter-observation',
      }),
    }));
    expect(payload.student).toMatchObject({
      id: 'student-1',
      classId: 'class-1',
    });
  });
});
