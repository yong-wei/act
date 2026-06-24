import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  generateUniqueJoinCode: vi.fn(),
  loadSessionLessonSnapshot: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn() },
    class: { findUnique: vi.fn() },
    classSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    lessonPlan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    lessonItem: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/join-code', () => ({
  generateUniqueJoinCode: mocks.generateUniqueJoinCode,
}));

vi.mock('@/lib/session-lesson-snapshot', () => ({
  loadSessionLessonSnapshot: mocks.loadSessionLessonSnapshot,
}));

import { POST as createLessonPlan } from '../api/lesson-plans/route';
import { PATCH as updateLessonPlan } from '../api/lesson-plans/[id]/route';
import { POST as startSession } from '../api/session/route';

describe('lesson plan empty-item guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER' });
    mocks.generateUniqueJoinCode.mockResolvedValue('123456');
    mocks.loadSessionLessonSnapshot.mockReturnValue({
      lessonVersion: 'lesson.v1',
      manifestHash: 'hash',
      totalSteps: 1,
    });
  });

  it('rejects creating zero-item lesson plans before creating a record', async () => {
    const response = await createLessonPlan(new Request('http://localhost/api/lesson-plans', {
      method: 'POST',
      body: JSON.stringify({ title: '空教案', items: [] }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('至少 1 个环节');
    expect(mocks.prisma.lessonPlan.create).not.toHaveBeenCalled();
  });

  it('rejects updates that would leave a lesson plan with zero items', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({ authorId: 'teacher-1' });

    const response = await updateLessonPlan(
      new Request('http://localhost/api/lesson-plans/plan-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: '空教案', items: [] }),
      }),
      { params: Promise.resolve({ id: 'plan-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('至少 1 个环节');
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects direct launch for a zero-item lesson plan', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      title: '空教案',
      authorId: 'teacher-1',
      isPublic: false,
      _count: { items: 0 },
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ planId: 'plan-empty' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('至少 1 个环节');
    expect(mocks.prisma.classSession.create).not.toHaveBeenCalled();
  });

  it('rejects direct launch by students before creating a classroom session', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT' });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ planId: 'public-plan' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toContain('教师或管理员');
    expect(mocks.prisma.lessonPlan.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.classSession.create).not.toHaveBeenCalled();
  });

  it('rejects teachers launching another teacher private lesson plan', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      title: '他人私有教案',
      authorId: 'teacher-2',
      isPublic: false,
      _count: { items: 2 },
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ planId: 'private-plan' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toContain('无权启动');
    expect(mocks.prisma.classSession.create).not.toHaveBeenCalled();
  });
});
