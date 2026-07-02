import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  buildGraphCenterCoverageSources: vi.fn(),
  prisma: {
    class: {
      findUnique: vi.fn(),
    },
    studentProfile: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/data-governance/graph-center-sources', () => ({
  buildGraphCenterCoverageSources: mocks.buildGraphCenterCoverageSources,
}));

import { GET } from '@/app/api/teacher/classes/[classId]/kaq-evidence-trace/route';

describe('GET /api/teacher/classes/[classId]/kaq-evidence-trace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      code: 'ABC123',
      teacherId: 'teacher-1',
    });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({
      id: 'profile-1',
      userId: 'student-1',
      studentNumber: 'S001',
      user: {
        id: 'student-1',
        name: '学生甲',
      },
    });
    mocks.buildGraphCenterCoverageSources.mockResolvedValue({});
  });

  it('returns an authorized teacher trace payload for a class node', async () => {
    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/kaq-evidence-trace?nodeId=kn:autocontrol:controller-correction'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.class.findUnique).toHaveBeenCalledWith({
      where: { id: 'class-1' },
      select: {
        id: true,
        name: true,
        code: true,
        teacherId: true,
      },
    });
    expect(mocks.buildGraphCenterCoverageSources).toHaveBeenCalledWith(expect.objectContaining({
      viewerRole: 'TEACHER',
      viewerUserId: 'teacher-1',
      requestedClassId: 'class-1',
    }));
    expect(payload.classInfo).toMatchObject({
      id: 'class-1',
      name: '自动控制 1 班',
    });
    expect(payload.node.id).toBe('kn:autocontrol:controller-correction');
    expect(payload.returnLinks.map((link: { id: string }) => link.id)).toContain('graph-center');
  });

  it('allows student-scoped traces only for students in the class', async () => {
    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/kaq-evidence-trace?nodeId=kn:autocontrol:controller-correction&studentId=student-1'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { classId: 'class-1', userId: 'student-1' },
    }));
    expect(mocks.buildGraphCenterCoverageSources).toHaveBeenCalledWith(expect.objectContaining({
      requestedLearnerId: 'student-1',
      requestedClassId: 'class-1',
    }));
    expect(payload.student).toMatchObject({
      id: 'student-1',
      name: '学生甲',
    });
    expect(payload.returnLinks.map((link: { id: string }) => link.id)).toContain('student-evidence');
  });

  it('denies teachers outside the class scope', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      code: 'ABC123',
      teacherId: 'teacher-2',
    });

    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/kaq-evidence-trace'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.buildGraphCenterCoverageSources).not.toHaveBeenCalled();
  });

  it('rejects students outside the requested class', async () => {
    mocks.prisma.studentProfile.findFirst.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/kaq-evidence-trace?studentId=student-2'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.buildGraphCenterCoverageSources).not.toHaveBeenCalled();
  });

  it('rejects non-teacher callers before building SAR trace payloads', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/kaq-evidence-trace'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();
    expect(mocks.buildGraphCenterCoverageSources).not.toHaveBeenCalled();
  });
});
