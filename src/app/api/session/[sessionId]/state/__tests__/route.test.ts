import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  prisma: {
    classSession: { findUnique: vi.fn() },
    studentState: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/classroom-observability', () => ({ logClassroomEvent: vi.fn() }));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));

import { GET } from '../route';

describe('GET /api/session/[sessionId]/state?scope=student-view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT', profile: { classId: 'class-1' } },
    });
    mocks.prisma.classSession.findUnique.mockResolvedValue({ teacherId: 'teacher-1', classId: 'class-1' });
    mocks.prisma.studentState.findUnique.mockResolvedValue({
      id: 'self-state',
      userId: 'student-1',
      itemId: 'student:unit14:state',
      stateKey: 'course',
      lessonKey: 'unit-1-4-time-frequency-views-v1',
      submittedAt: new Date('2026-07-16T00:00:00.000Z'),
      data: { kind: 'unit14_student_state', version: 1 },
      user: { id: 'student-1', name: '学生甲', email: 'student@example.test' },
    });
    mocks.prisma.studentState.findFirst.mockResolvedValue({
      id: 'teacher-state',
      userId: 'teacher-1',
      itemId: 'teacher:course-sync',
      stateKey: 'teacher-sync',
      lessonKey: 'unit-1-4-time-frequency-views-v1',
      submittedAt: new Date('2026-07-16T00:01:00.000Z'),
      data: { kind: 'teacher_sync_unit14', activeStepId: 'step-05' },
      user: { id: 'teacher-1', name: '教师甲', email: 'teacher@example.test' },
    });
  });

  it('returns teacher sync data without teacher identity fields', async () => {
    const response = await GET(
      new Request('http://localhost/api/session/session-1/state?scope=student-view&courseStateKey=course&teacherStateKey=teacher-sync'),
      { params: Promise.resolve({ sessionId: 'session-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.teacherStates).toEqual([{
      itemId: 'teacher:course-sync',
      stateKey: 'teacher-sync',
      lessonKey: 'unit-1-4-time-frequency-views-v1',
      submittedAt: '2026-07-16T00:01:00.000Z',
      data: { kind: 'teacher_sync_unit14', activeStepId: 'step-05' },
    }]);
    expect(body.states[0]).toEqual(body.teacherStates[0]);
    expect(JSON.stringify(body.teacherStates)).not.toContain('teacher-1');
    expect(JSON.stringify(body.teacherStates)).not.toContain('教师甲');
    expect(JSON.stringify(body.teacherStates)).not.toContain('teacher@example.test');
  });
});
