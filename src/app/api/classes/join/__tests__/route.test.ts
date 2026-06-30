import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getServerAuthSession = vi.fn();
  const classFindUnique = vi.fn();
  const studentProfileFindUnique = vi.fn();
  const studentProfileCreate = vi.fn();
  const studentProfileUpdate = vi.fn();

  return {
    prisma: {
      class: {
        findUnique: classFindUnique,
      },
      studentProfile: {
        findUnique: studentProfileFindUnique,
        create: studentProfileCreate,
        update: studentProfileUpdate,
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

import { POST } from '../route';

describe('POST /api/classes/join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '2024自动化',
      code: 'B78429',
      isActive: true,
      teacher: { name: '王老师' },
    });
  });

  it('accepts a lower-case class code by uppercasing it before lookup', async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValue(null);
    mocks.prisma.studentProfile.create.mockResolvedValue({ id: 'profile-1' });

    const response = await POST(
      new Request('http://localhost/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'b78429' }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.class.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { code: 'B78429' },
    }));
    expect(mocks.prisma.studentProfile.create).toHaveBeenCalledWith({
      data: {
        userId: 'student-1',
        classId: 'class-1',
        className: '2024自动化',
      },
    });
    expect(payload.class).toEqual({
      id: 'class-1',
      name: '2024自动化',
      teacherName: '王老师',
    });
    expect(payload.classJoinState).toMatchObject({
      state: 'ready-to-enter',
      recoveryAction: '班级绑定已完成，可返回学习首页继续学习。',
    });
  });

  it('updates an existing student profile to the joined class', async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.studentProfile.update.mockResolvedValue({ id: 'profile-1' });

    const response = await POST(
      new Request('http://localhost/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'B78429' }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentProfile.update).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      data: {
        classId: 'class-1',
        className: '2024自动化',
      },
    });
  });

  it('returns a recoverable invalid-code state before looking up malformed class codes', async () => {
    const response = await POST(
      new Request('http://localhost/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'bad' }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: '请输入有效的6位班级加入码',
      classJoinState: {
        state: 'invalid-code',
        recoveryAction: '请核对教师提供的 6 位班级加入码后重试。',
      },
    });
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();
  });

  it('returns recoverable forbidden states for anonymous and non-student users', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    const anonymous = await POST(
      new Request('http://localhost/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'B78429' }),
      })
    );
    expect(anonymous.status).toBe(401);
    await expect(anonymous.json()).resolves.toMatchObject({
      classJoinState: {
        state: 'forbidden',
        recoveryAction: '登录学生账号后重新输入班级加入码。',
      },
    });

    mocks.getServerAuthSession.mockResolvedValueOnce({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    const teacher = await POST(
      new Request('http://localhost/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'B78429' }),
      })
    );
    expect(teacher.status).toBe(403);
    await expect(teacher.json()).resolves.toMatchObject({
      classJoinState: {
        state: 'forbidden',
        recoveryAction: '切换学生账号后重新输入班级加入码。',
      },
    });
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();
  });

  it('returns not-found and inactive recovery states for stale class codes', async () => {
    mocks.prisma.class.findUnique.mockResolvedValueOnce(null);

    const missing = await POST(
      new Request('http://localhost/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'B70000' }),
      })
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({
      classJoinState: {
        state: 'not-found',
        recoveryAction: '确认班级加入码仍在使用，或联系教师重新发放。',
      },
    });

    mocks.prisma.class.findUnique.mockResolvedValueOnce({
      id: 'class-closed',
      name: '关闭班级',
      code: 'CLOSED',
      isActive: false,
      teacher: { name: '王老师' },
    });

    const inactive = await POST(
      new Request('http://localhost/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'CLOSED' }),
      })
    );
    expect(inactive.status).toBe(410);
    await expect(inactive.json()).resolves.toMatchObject({
      classJoinState: {
        state: 'inactive',
        recoveryAction: '联系教师确认班级是否重新开放或加入新的班级。',
      },
    });
  });
});
