import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  prisma: {
    classSession: { findUnique: vi.fn() },
    studentState: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/classroom-observability', () => ({ logClassroomEvent: vi.fn() }));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));

import { GET, POST } from '../route';

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

describe('POST /api/session/[sessionId]/state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT', profile: { classId: 'class-1' } },
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'student-1',
      role: 'STUDENT',
      profile: null,
    });
    mocks.prisma.classSession.findUnique.mockResolvedValue({ teacherId: 'teacher-1', classId: 'class-1', status: 'ACTIVE' });
  });

  it('keeps live-state writes available while the session is active', async () => {
    mocks.prisma.studentState.upsert.mockResolvedValue({ id: 'state-1' });

    const response = await POST(
      new Request('http://localhost/api/session/session-1/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: 'student:unit14:state', data: { kind: 'unit14_student_state', version: 1 } }),
      }),
      { params: Promise.resolve({ sessionId: 'session-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentState.upsert).toHaveBeenCalledTimes(1);
  });

  it('rejects live-state writes after the session has finished as a read-only context', async () => {
    mocks.prisma.classSession.findUnique.mockResolvedValue({ teacherId: 'teacher-1', classId: 'class-1', status: 'FINISHED' });

    const response = await POST(
      new Request('http://localhost/api/session/session-1/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: 'student:unit14:state', data: { kind: 'unit14_student_state', version: 1 } }),
      }),
      { params: Promise.resolve({ sessionId: 'session-1' }) },
    );

    // live state 是课堂实时投影：闭课即只读，不再产生任何学生状态写入
    expect(response.status).toBe(410);
    expect(mocks.prisma.studentState.upsert).not.toHaveBeenCalled();
  });
});
