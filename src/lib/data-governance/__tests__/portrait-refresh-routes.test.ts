import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  requestReconciliation: vi.fn(),
  readStatus: vi.fn(),
  readTaskInput: vi.fn(),
  prisma: {
    class: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/data-governance/cumulative-snapshot-jobs', () => ({
  requestCumulativeLearnerReconciliation: mocks.requestReconciliation,
  readCumulativeLearnerReconciliationStatus: mocks.readStatus,
}));
vi.mock('@/lib/data-governance/simulation-task-reconciliation', () => ({
  readSimulationTaskInputIdentityForScheduling: mocks.readTaskInput,
}));

import {
  GET as studentGet,
  POST as studentPost,
} from '@/app/api/student/portrait-refresh/route';
import {
  GET as teacherGet,
  POST as teacherPost,
} from '@/app/api/teacher/classes/[classId]/students/[studentId]/portrait-refresh/route';

const teacherParams = {
  params: Promise.resolve({ classId: 'class-1', studentId: 'student-1' }),
};

describe('portrait refresh routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
    mocks.readTaskInput.mockResolvedValue({ inputDigest: 'task-input-1' });
    mocks.requestReconciliation.mockResolvedValue(3);
    mocks.readStatus.mockResolvedValue({ status: 'processing', generation: 3, errorCode: null });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      teacherId: 'teacher-1',
    });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({
      userId: 'student-1',
      studentNumber: 'S001',
      user: { id: 'student-1', name: '学生甲', email: null },
    });
  });

  it('rejects student task and score injection before scheduling', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    const response = await studentPost(new Request('http://localhost/api/student/portrait-refresh', {
      method: 'POST',
      body: JSON.stringify({ task: 'arena', score: 100 }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.requestReconciliation).not.toHaveBeenCalled();
  });

  it('schedules only the authenticated student and reads only that student status', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({ classId: 'class-1' });
    expect((await studentPost(new Request('http://localhost/api/student/portrait-refresh', {
      method: 'POST',
      body: '{}',
    }))).status).toBe(202);
    expect(mocks.requestReconciliation).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({ userId: 'student-1', classIds: ['class-1'] }),
    );
    await studentGet(new Request(
      'http://localhost/api/student/portrait-refresh?generation=3&userId=other',
    ));
    expect(mocks.readStatus).toHaveBeenCalledWith(
      mocks.prisma,
      { userId: 'student-1', generation: 3 },
    );
  });

  it('uses the same class ownership and current-roster authorization for teacher POST and GET', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.studentProfile.findFirst.mockResolvedValueOnce(null);
    expect((await teacherPost(new Request('http://localhost/refresh', {
      method: 'POST',
      body: '{}',
    }), teacherParams))?.status).toBe(404);
    expect(mocks.requestReconciliation).not.toHaveBeenCalled();

    expect((await teacherGet(new Request(
      'http://localhost/refresh?generation=3',
    ), teacherParams))?.status).toBe(200);
    expect(mocks.readStatus).toHaveBeenCalledWith(
      mocks.prisma,
      { userId: 'student-1', generation: 3 },
    );
  });
});
