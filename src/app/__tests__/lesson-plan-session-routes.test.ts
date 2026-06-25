import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  generateUniqueJoinCode: vi.fn(),
  loadSessionLessonSnapshot: vi.fn(),
  logClassroomEvent: vi.fn(),
  enqueueSessionFinalizationEventIngestion: vi.fn(),
  enqueueSessionFinalizationSnapshots: vi.fn(),
  enqueueSessionFinalizationEvidenceFeatureCacheRefresh: vi.fn(),
  enqueueSessionSummaryReportRefresh: vi.fn(),
  generateSessionSummaryReports: vi.fn(),
  redisClient: {
    isReady: vi.fn(),
    getSessionState: vi.fn(),
    setSessionState: vi.fn(),
    publishStateChange: vi.fn(),
  },
  classroomRateLimiter: {
    check: vi.fn(),
  },
  prisma: {
    user: { findUnique: vi.fn() },
    class: { findUnique: vi.fn() },
    classSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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

vi.mock('@/lib/classroom-observability', () => ({
  logClassroomEvent: mocks.logClassroomEvent,
}));

vi.mock('@/lib/redis-client', () => ({
  redisClient: mocks.redisClient,
}));

vi.mock('@/lib/rate-limiter', () => ({
  classroomRateLimiter: mocks.classroomRateLimiter,
}));

vi.mock('@/lib/data-governance/session-finalization-snapshots', () => ({
  enqueueSessionFinalizationEventIngestion: mocks.enqueueSessionFinalizationEventIngestion,
  enqueueSessionFinalizationSnapshots: mocks.enqueueSessionFinalizationSnapshots,
  enqueueSessionFinalizationEvidenceFeatureCacheRefresh: mocks.enqueueSessionFinalizationEvidenceFeatureCacheRefresh,
  enqueueSessionSummaryReportRefresh: mocks.enqueueSessionSummaryReportRefresh,
}));

vi.mock('@/lib/data-governance/session-reports', () => ({
  generateSessionSummaryReports: mocks.generateSessionSummaryReports,
}));

import { POST as createLessonPlan } from '../api/lesson-plans/route';
import { PATCH as updateLessonPlan } from '../api/lesson-plans/[id]/route';
import { POST as startSession } from '../api/session/route';
import { GET as getSession, PATCH as updateSession } from '../api/session/[sessionId]/route';

describe('lesson plan empty-item guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER' });
    mocks.generateUniqueJoinCode.mockResolvedValue('123456');
    mocks.prisma.classSession.findFirst.mockResolvedValue(null);
    mocks.redisClient.isReady.mockReturnValue(false);
    mocks.redisClient.getSessionState.mockResolvedValue(null);
    mocks.classroomRateLimiter.check.mockReturnValue({ allowed: true });
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

  it('creates temporary classrooms with a shared identity payload', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      title: '临时课堂教案',
      authorId: 'teacher-1',
      isPublic: false,
      _count: { items: 2 },
    });
    mocks.prisma.classSession.create.mockResolvedValue({
      id: 'session-temporary',
      joinCode: '123456',
      classId: null,
      startTime: new Date('2026-06-25T08:00:00.000Z'),
      plan: { title: '临时课堂教案' },
      class: null,
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ planId: 'plan-1', launchContext: 'temporary' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.classroomIdentity).toMatchObject({
      kind: 'temporary',
      label: '临时课堂',
      lessonTitle: '临时课堂教案',
    });
    expect(mocks.prisma.classSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ classId: expect.anything() }),
    }));
    expect(mocks.logClassroomEvent).toHaveBeenCalledWith('session_start', expect.objectContaining({
      sessionId: 'session-temporary',
      actorUserId: 'teacher-1',
      classroomEvent: expect.objectContaining({
        eventType: 'start-class',
        actorRole: 'teacher',
        sessionId: 'session-temporary',
        clientEventId: 'classroom-session:session-temporary:start-class',
        clientEventAt: '2026-06-25T08:00:00.000Z',
        sourceLogId: 'api-session-start',
      }),
    }));
  });

  it('blocks duplicate temporary classrooms until the teacher chooses reuse or new session', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      title: '临时课堂教案',
      authorId: 'teacher-1',
      isPublic: false,
      _count: { items: 2 },
    });
    mocks.prisma.classSession.findFirst.mockResolvedValue({
      id: 'session-existing',
      joinCode: '654321',
      classId: null,
      plan: { title: '临时课堂教案' },
      class: null,
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ planId: 'plan-1', launchContext: 'temporary' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      existingSessionId: 'session-existing',
      requiresExplicitChoice: true,
      allowedActions: ['reuse', 'new-session'],
      classroomIdentity: { kind: 'temporary' },
    });
    expect(mocks.prisma.classSession.create).not.toHaveBeenCalled();
  });

  it('checks clone-based temporary classrooms by source preset title instead of the new clone id', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      title: '预置互动课 (副本)',
      authorId: 'teacher-1',
      isPublic: false,
      _count: { items: 2 },
    });
    mocks.prisma.classSession.findFirst.mockResolvedValue({
      id: 'session-existing',
      joinCode: '654321',
      classId: null,
      plan: { title: '预置互动课 (副本)' },
      class: null,
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({
        planId: 'new-clone-plan',
        launchContext: 'temporary',
        sourcePresetKey: 'unit-test-preset-v1',
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      existingSessionId: 'session-existing',
      requiresExplicitChoice: true,
      classroomIdentity: { kind: 'temporary' },
    });
    expect(mocks.prisma.classSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        teacherId: 'teacher-1',
        classId: null,
        status: 'ACTIVE',
        plan: { is: { title: '预置互动课 (副本)' } },
      }),
    }));
    expect(mocks.prisma.classSession.create).not.toHaveBeenCalled();
  });

  it('creates class-bound sessions with class identity and duplicate override', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-1',
      name: '2026 控制班',
    });
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      title: '班级课堂教案',
      authorId: 'teacher-1',
      isPublic: false,
      _count: { items: 2 },
    });
    mocks.prisma.classSession.create.mockResolvedValue({
      id: 'session-class',
      joinCode: '123456',
      classId: 'class-1',
      startTime: new Date('2026-06-25T08:05:00.000Z'),
      plan: { title: '班级课堂教案' },
      class: { name: '2026 控制班' },
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({
        planId: 'plan-1',
        classId: 'class-1',
        launchContext: 'class-bound',
        duplicateAction: 'new-session',
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.classroomIdentity).toMatchObject({
      kind: 'class-bound',
      label: '2026 控制班 · 班级课堂',
      classId: 'class-1',
    });
    expect(mocks.prisma.classSession.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.classSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ classId: 'class-1' }),
    }));
  });

  it('logs teacher session patches with normalized classroom lifecycle evidence', async () => {
    const updatedAt = new Date('2026-06-25T10:00:00.000Z');
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      teacherId: 'teacher-1',
      status: 'ACTIVE',
    });
    mocks.prisma.classSession.update.mockResolvedValue({
      id: 'session-1',
      joinCode: '123456',
      classId: 'class-1',
      teacherId: 'teacher-1',
      currentItemId: 'step-2',
      currentStage: 'OBJECTIVE',
      status: 'ACTIVE',
      updatedAt,
      plan: { title: '班级课堂教案' },
      class: { name: '2026 控制班' },
    });

    const response = await updateSession(
      new Request('http://localhost/api/session/session-1', {
        method: 'PATCH',
        body: JSON.stringify({
          currentItemId: 'step-2',
          currentStage: 'OBJECTIVE',
          classroomEvent: {
            eventType: 'page-change',
            actorRole: 'teacher',
            stepId: 'step-2',
            clientEventId: 'event-1',
            sourceLogId: 'teacher-player',
            clientEventAt: '2026-06-25T10:00:00.000Z',
          },
        }),
      }),
      { params: Promise.resolve({ sessionId: 'session-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.logClassroomEvent).toHaveBeenCalledWith('session_patch', expect.objectContaining({
      sessionId: 'session-1',
      actorUserId: 'teacher-1',
      currentItemId: 'step-2',
      currentStage: 'OBJECTIVE',
      classroomEvent: expect.objectContaining({
        eventType: 'page-change',
        actorRole: 'teacher',
        sessionId: 'session-1',
        stepId: 'step-2',
        clientEventId: 'event-1',
        sourceLogId: 'teacher-player',
        dedupeIdentity: 'session-1:page-change:teacher:step-2:teacher-player',
      }),
    }));
  });

  it('derives session patch lifecycle actor role from the authenticated user', async () => {
    const updatedAt = new Date('2026-06-25T10:00:00.000Z');
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      teacherId: 'teacher-1',
      status: 'ACTIVE',
      classId: 'class-1',
    });
    mocks.prisma.classSession.update.mockResolvedValue({
      id: 'session-1',
      joinCode: '123456',
      classId: 'class-1',
      teacherId: 'teacher-1',
      currentItemId: 'step-2',
      currentStage: 'OBJECTIVE',
      status: 'ACTIVE',
      updatedAt,
      plan: { title: '班级课堂教案' },
      class: { name: '2026 控制班' },
    });

    const response = await updateSession(
      new Request('http://localhost/api/session/session-1', {
        method: 'PATCH',
        body: JSON.stringify({
          currentItemId: 'step-2',
          classroomEvent: {
            eventType: 'page-change',
            actorRole: 'student',
            dedupeIdentity: 'client-spoofed',
            stepId: 'step-2',
            clientEventId: 'event-1',
            sourceLogId: 'teacher-player',
            clientEventAt: '2026-06-25T10:00:00.000Z',
          },
        }),
      }),
      { params: Promise.resolve({ sessionId: 'session-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.logClassroomEvent).toHaveBeenCalledWith('session_patch', expect.objectContaining({
      classroomEvent: expect.objectContaining({
        actorRole: 'teacher',
        dedupeIdentity: 'session-1:page-change:teacher:step-2:teacher-player',
      }),
    }));
  });

  it('rejects session patch lifecycle events without stable client identity', async () => {
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      teacherId: 'teacher-1',
      status: 'ACTIVE',
      classId: 'class-1',
    });

    const response = await updateSession(
      new Request('http://localhost/api/session/session-1', {
        method: 'PATCH',
        body: JSON.stringify({
          currentItemId: 'step-2',
          classroomEvent: {
            eventType: 'page-change',
            stepId: 'step-2',
          },
        }),
      }),
      { params: Promise.resolve({ sessionId: 'session-1' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Lifecycle event requires clientEventId and clientEventAt',
    });
    expect(mocks.prisma.classSession.update).not.toHaveBeenCalled();
  });

  it('rejects session patch lifecycle events with invalid client event time', async () => {
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      teacherId: 'teacher-1',
      status: 'ACTIVE',
      classId: 'class-1',
    });

    const response = await updateSession(
      new Request('http://localhost/api/session/session-1', {
        method: 'PATCH',
        body: JSON.stringify({
          currentItemId: 'step-2',
          classroomEvent: {
            eventType: 'page-change',
            stepId: 'step-2',
            clientEventId: 'event-1',
            clientEventAt: 'not-a-date',
          },
        }),
      }),
      { params: Promise.resolve({ sessionId: 'session-1' }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.prisma.classSession.update).not.toHaveBeenCalled();
    expect(mocks.logClassroomEvent).not.toHaveBeenCalledWith('session_patch', expect.anything());
  });

  it('rejects session GET for class-bound students outside the session class before reading cache', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'student-1',
      role: 'STUDENT',
      profile: { classId: 'class-1' },
    });
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      teacherId: 'teacher-1',
      classId: 'class-2',
    });
    mocks.redisClient.isReady.mockReturnValue(true);
    mocks.redisClient.getSessionState.mockResolvedValue({
      joinCode: '123456',
      classId: 'class-2',
      className: '2026 控制班',
      planTitle: '班级课堂教案',
    });

    const response = await getSession(
      new Request('http://localhost/api/session/session-1'),
      { params: Promise.resolve({ sessionId: 'session-1' }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.redisClient.getSessionState).not.toHaveBeenCalled();
  });

  it('rejects session GET DB fallback for class-bound students outside the session class', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'student-1',
      role: 'STUDENT',
      profile: { classId: 'class-1' },
    });
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      teacherId: 'teacher-1',
      classId: 'class-2',
    });
    mocks.redisClient.isReady.mockReturnValue(false);

    const response = await getSession(
      new Request('http://localhost/api/session/session-1'),
      { params: Promise.resolve({ sessionId: 'session-1' }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.classSession.findUnique).toHaveBeenCalledTimes(1);
  });

  it('allows session GET from cache after owner access is verified', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'teacher-1',
      role: 'TEACHER',
      profile: null,
    });
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      teacherId: 'teacher-1',
      classId: 'class-1',
    });
    mocks.redisClient.isReady.mockReturnValue(true);
    mocks.redisClient.getSessionState.mockResolvedValue({
      joinCode: '123456',
      classId: 'class-1',
      className: '2026 控制班',
      currentItemId: 'step-1',
      currentStage: 'BRIDGE_IN',
      status: 'ACTIVE',
      planTitle: '班级课堂教案',
      updatedAt: 123,
    });

    const response = await getSession(
      new Request('http://localhost/api/session/session-1'),
      { params: Promise.resolve({ sessionId: 'session-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.classroomIdentity).toMatchObject({
      kind: 'class-bound',
      label: '2026 控制班 · 班级课堂',
    });
  });
});
