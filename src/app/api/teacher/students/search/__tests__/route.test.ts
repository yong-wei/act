import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const findMany = vi.fn();
  const classFindFirst = vi.fn();
  const getServerSession = vi.fn();

  return {
    prisma: {
      user: {
        findMany,
      },
      class: {
        findFirst: classFindFirst,
      },
    },
    getServerSession,
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { GET } from '../route';

describe('GET /api/teacher/students/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    mocks.prisma.user.findMany.mockResolvedValue([]);
  });

  it('returns candidate students when q is omitted', async () => {
    const response = await GET(
      new Request('http://localhost/api/teacher/students/search?excludeClassId=class-1')
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.class.findFirst).toHaveBeenCalledWith({
      where: { id: 'class-1', teacherId: 'teacher-1' },
      select: { id: true },
    });
    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        role: 'STUDENT',
        AND: expect.arrayContaining([
          {
            OR: [
              { profile: { is: null } },
              { profile: { is: { classId: null } } },
              { profile: { is: { classId: { not: 'class-1' } } } },
            ],
          },
        ]),
      }),
    }));
  });

  it('builds name, email, and student-number search conditions when q is provided', async () => {
    await GET(
      new Request('http://localhost/api/teacher/students/search?q=li&excludeClassId=class-1')
    );

    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          {
            OR: [
              { name: { contains: 'li', mode: 'insensitive' } },
              { email: { contains: 'li', mode: 'insensitive' } },
              {
                profile: {
                  is: {
                    studentNumber: { contains: 'li', mode: 'insensitive' },
                  },
                },
              },
            ],
          },
        ]),
      }),
    }));
  });

  it('rejects a one-character q instead of silently returning an empty list', async () => {
    const response = await GET(
      new Request('http://localhost/api/teacher/students/search?q=l&excludeClassId=class-1')
    );

    expect(response.status).toBe(400);
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('requires a class context before returning candidate students', async () => {
    const response = await GET(
      new Request('http://localhost/api/teacher/students/search')
    );

    expect(response.status).toBe(400);
    expect(mocks.prisma.class.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('rejects classes outside the current teacher scope', async () => {
    mocks.prisma.class.findFirst.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/teacher/students/search?excludeClassId=foreign-class')
    );

    expect(response.status).toBe(404);
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });
});
