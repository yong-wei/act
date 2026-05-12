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
});
