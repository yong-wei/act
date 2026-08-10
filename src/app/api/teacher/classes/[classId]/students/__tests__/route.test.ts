import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const requestCumulativeLearnerReconciliation = vi.fn();
  const prisma = {
    class: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    studentProfile: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return {
    getServerSession: vi.fn(),
    requestCumulativeLearnerReconciliation,
    prisma,
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

vi.mock('@/lib/data-governance/cumulative-snapshot-jobs', () => ({
  requestCumulativeLearnerReconciliation: mocks.requestCumulativeLearnerReconciliation,
}));

import { DELETE, POST } from '../route';

const context = { params: Promise.resolve({ classId: 'class-new' }) };

describe('/api/teacher/classes/[classId]/students membership writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.class.findFirst.mockResolvedValue({
      id: 'class-new',
      name: '自动化 2401',
      teacherId: 'teacher-1',
    });
    mocks.prisma.user.findFirst.mockResolvedValue({
      id: 'student-1',
      name: '张同学',
      role: 'STUDENT',
      profile: { classId: 'class-old' },
    });
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      classId: 'class-old',
    });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({
      userId: 'student-1',
      classId: 'class-new',
      user: { name: '张同学' },
    });
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
    mocks.requestCumulativeLearnerReconciliation.mockResolvedValue(1);
  });

  it('persists old and new class reconciliation with a teacher transfer', async () => {
    const response = await POST(
      new Request('http://localhost/api/teacher/classes/class-new/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'student-1' }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      update: { classId: 'class-new', className: '自动化 2401' },
      create: {
        userId: 'student-1',
        classId: 'class-new',
        className: '自动化 2401',
      },
    });
    expect(mocks.requestCumulativeLearnerReconciliation).toHaveBeenCalledWith(
      mocks.prisma,
      {
        userId: 'student-1',
        classIds: ['class-old', 'class-new'],
        reason: 'class-membership:teacher-add',
      },
    );
  });

  it('fails a teacher transfer when the durable request cannot be written', async () => {
    mocks.requestCumulativeLearnerReconciliation.mockRejectedValue(
      new Error('durable request unavailable'),
    );

    const response = await POST(
      new Request('http://localhost/api/teacher/classes/class-new/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'student-1' }),
      }),
      context,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: '添加失败' });
  });

  it('persists reconciliation in the same transaction when removing a member', async () => {
    const response = await DELETE(
      new Request(
        'http://localhost/api/teacher/classes/class-new/students?userId=student-1',
        { method: 'DELETE' },
      ),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentProfile.update).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      data: { classId: null, className: null },
    });
    expect(mocks.requestCumulativeLearnerReconciliation).toHaveBeenCalledWith(
      mocks.prisma,
      {
        userId: 'student-1',
        classIds: ['class-new'],
        reason: 'class-membership:teacher-remove',
      },
    );
  });
});
