import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, POST } from '@/app/api/session/[sessionId]/state/route';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  classSessionFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  upsert: vi.fn(),
  logClassroomEvent: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    studentState: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      count: mocks.count,
      upsert: mocks.upsert,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
    classSession: {
      findUnique: mocks.classSessionFindUnique,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/classroom-observability', () => ({
  logClassroomEvent: mocks.logClassroomEvent,
}));

function params(sessionId = 'session-1') {
  return { params: Promise.resolve({ sessionId }) };
}

describe('/api/session/[sessionId]/state auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.classSessionFindUnique.mockResolvedValue({
      id: 'session-1',
      teacherId: 'teacher-1',
      joinCode: '123456',
      status: 'ACTIVE',
      classId: null,
      currentItemId: 'step-01',
      currentStage: 'BRIDGE_IN',
      plan: { title: '临时课堂教案' },
      class: null,
    });
  });

  it('rejects teacher-view state requests from student users', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.findMany.mockResolvedValue([]);

    const response = await GET(
      new Request('http://localhost/api/session/session-1/state?scope=teacher-view'),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('rejects default all-student state requests from student users', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.findMany.mockResolvedValue([]);

    const response = await GET(
      new Request('http://localhost/api/session/session-1/state'),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('allows teacher users to read teacher-view state', async () => {
    const submittedAt = new Date('2026-06-15T00:00:00.000Z');
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.findMany
      .mockResolvedValueOnce([{
        id: 'course-state-1',
        userId: 'student-1',
        itemId: 'step-other',
        submittedAt,
        user: { id: 'student-1', name: '学生甲', email: 'a@example.test' },
      }])
      .mockResolvedValueOnce([]);

    const response = await GET(
      new Request('http://localhost/api/session/session-1/state?scope=teacher-view'),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary).toEqual({
      totalStudents: 1,
      latestUpdate: submittedAt.toISOString(),
    });
    expect(body.classroom.identity).toMatchObject({
      kind: 'temporary',
      label: '临时课堂',
    });
    expect(body.delivery).toMatchObject({
      releasedStepId: 'step-01',
      submittedCount: 0,
      inProgressCount: 1,
      notStartedCount: 0,
    });
    expect(body.evidenceWriteback).toMatchObject({
      mode: 'live-state-and-event-materialization',
    });
    expect(body.evidenceWriteback.requiredEventFields).toEqual(expect.arrayContaining([
      'eventType',
      'actorRole',
      'clientEventId',
      'sourceLogId',
      'clientEventAt',
      'dedupeIdentity',
    ]));
    expect(body.evidenceWriteback.dedupeRule).toContain('sessionId');
    expect(body.evidenceWriteback.dedupeRule).toContain('cardId');
    expect(body.evidenceWriteback.dedupeRule).toContain('提交身份');
    expect(body.evidenceWriteback.dedupeRule).toContain('应用层串行');
    expect(body.evidenceWriteback.dedupeRule).toContain('数据库级并发幂等仍未关闭');
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });

  it('rejects teacher-view roster reads from other teachers', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-2', role: 'TEACHER' },
    });

    const response = await GET(
      new Request('http://localhost/api/session/session-1/state?scope=teacher-view'),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('returns class roster and not-submitted delivery state for class-bound teacher view', async () => {
    const submittedAt = new Date('2026-06-15T00:00:00.000Z');
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.classSessionFindUnique.mockResolvedValue({
      id: 'session-1',
      teacherId: 'teacher-1',
      joinCode: '123456',
      status: 'ACTIVE',
      classId: 'class-1',
      currentItemId: 'step-01',
      currentStage: 'BRIDGE_IN',
      plan: { title: '班级课堂教案' },
      class: {
        name: '2026 控制班',
        students: [
          { user: { id: 'student-1', name: '学生甲', email: 'a@example.test' } },
          { user: { id: 'student-2', name: '学生乙', email: 'b@example.test' } },
        ],
      },
    });
    mocks.findMany
      .mockResolvedValueOnce([{ id: 'course-state-1', userId: 'student-1', itemId: 'step-01', submittedAt, user: { id: 'student-1', name: '学生甲', email: 'a@example.test' } }])
      .mockResolvedValueOnce([]);

    const response = await GET(
      new Request('http://localhost/api/session/session-1/state?scope=teacher-view'),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.classroom.identity).toMatchObject({
      kind: 'class-bound',
      label: '2026 控制班 · 班级课堂',
    });
    expect(body.presence.roster).toEqual([
      expect.objectContaining({ id: 'student-1', online: true, submitted: true }),
      expect.objectContaining({ id: 'student-2', online: false, submitted: false }),
    ]);
    expect(body.delivery.notSubmitted).toEqual([
      expect.objectContaining({ id: 'student-2', name: '学生乙' }),
    ]);
  });

  it('enriches posted classroom state with complete lifecycle event evidence', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.userFindUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT' });
    mocks.upsert.mockImplementation(async (args) => ({
      id: 'state-1',
      ...args.create,
    }));

    const response = await POST(
      new Request('http://localhost/api/session/session-1/state', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'step-01',
          lessonKey: 'lesson-v1',
          eventType: 'submit',
          actorRole: 'student',
          clientEventId: 'client-event-1',
          sourceLogId: 'log-1',
          clientEventAt: '2026-06-15T00:00:00.000Z',
          data: { answer: 'A' },
        }),
      }),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.classroomEvent).toMatchObject({
      eventType: 'submit',
      actorRole: 'student',
      sessionId: 'session-1',
      stepId: 'step-01',
      clientEventId: 'client-event-1',
      sourceLogId: 'log-1',
      clientEventAt: '2026-06-15T00:00:00.000Z',
      dedupeIdentity: 'session-1:submit:student:step-01:log-1',
    });
    expect(mocks.logClassroomEvent).toHaveBeenCalledWith('session_state_post', expect.objectContaining({
      lifecycleEvent: expect.objectContaining({ clientEventId: 'client-event-1' }),
    }));
  });

  it('rejects class-bound state writes from students outside the session class', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-2', role: 'STUDENT', profile: { classId: 'class-2' } },
    });
    mocks.userFindUnique.mockResolvedValue({ id: 'student-2', role: 'STUDENT', profile: { classId: 'class-2' } });
    mocks.classSessionFindUnique.mockResolvedValue({
      id: 'session-1',
      teacherId: 'teacher-1',
      classId: 'class-1',
    });

    const response = await POST(
      new Request('http://localhost/api/session/session-1/state', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'step-01',
          data: { answer: 'A' },
        }),
      }),
      params(),
    );

    expect(response.status).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects lifecycle state writes without stable client event identity', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.userFindUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT' });

    const response = await POST(
      new Request('http://localhost/api/session/session-1/state', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'step-01',
          eventType: 'submit',
          data: { answer: 'A' },
        }),
      }),
      params(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Lifecycle event requires clientEventId and clientEventAt',
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects student attempts to write teacher sync state', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.userFindUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT' });

    const response = await POST(
      new Request('http://localhost/api/session/session-1/state', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'teacher:course-sync',
          stateKey: 'teacher-sync',
          data: { currentStepId: 'step-01' },
        }),
      }),
      params(),
    );

    expect(response.status).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('writes teacher lifecycle events to append-only state keys instead of overwriting teacher sync', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.userFindUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER' });
    mocks.upsert.mockImplementation(async (args) => ({
      id: 'state-1',
      ...args.create,
    }));

    await POST(
      new Request('http://localhost/api/session/session-1/state', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'teacher:course-sync',
          stateKey: 'teacher-sync',
          eventType: 'copy-code',
          clientEventId: 'teacher-event-1',
          clientEventAt: '2026-06-25T00:00:00.000Z',
          data: { kind: 'teacher-control' },
        }),
      }),
      params(),
    );
    await POST(
      new Request('http://localhost/api/session/session-1/state', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'teacher:course-sync',
          stateKey: 'teacher-sync',
          eventType: 'online-panel',
          clientEventId: 'teacher-event-2',
          clientEventAt: '2026-06-25T00:00:01.000Z',
          data: { kind: 'teacher-control' },
        }),
      }),
      params(),
    );

    expect(mocks.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: {
        sessionId_userId_stateKey: {
          sessionId: 'session-1',
          userId: 'teacher-1',
          stateKey: 'classroom-event:teacher-event-1',
        },
      },
    }));
    expect(mocks.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        sessionId_userId_stateKey: {
          sessionId: 'session-1',
          userId: 'teacher-1',
          stateKey: 'classroom-event:teacher-event-2',
        },
      },
    }));
  });

  it('derives lifecycle actor role from the authenticated user instead of trusting the client', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.userFindUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT' });
    mocks.upsert.mockImplementation(async (args) => ({
      id: 'state-1',
      ...args.create,
    }));

    const response = await POST(
      new Request('http://localhost/api/session/session-1/state', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'step-01',
          eventType: 'submit',
          actorRole: 'teacher',
          clientEventId: 'client-event-1',
          sourceLogId: 'log-1',
          clientEventAt: '2026-06-15T00:00:00.000Z',
          dedupeIdentity: 'client-spoofed-dedupe',
          data: { answer: 'A' },
        }),
      }),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.classroomEvent).toMatchObject({
      eventType: 'submit',
      actorRole: 'student',
      dedupeIdentity: 'session-1:submit:student:step-01:log-1',
    });
  });

  it('rejects lifecycle writes with blank client event identity', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.userFindUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT' });

    const response = await POST(
      new Request('http://localhost/api/session/session-1/state', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'step-01',
          eventType: 'submit',
          clientEventId: '   ',
          clientEventAt: '2026-06-15T00:00:00.000Z',
          data: { answer: 'A' },
        }),
      }),
      params(),
    );

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects lifecycle writes with invalid client event time', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.userFindUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT' });

    const response = await POST(
      new Request('http://localhost/api/session/session-1/state', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'step-01',
          eventType: 'submit',
          clientEventId: 'client-event-1',
          clientEventAt: 'not-a-date',
          data: { answer: 'A' },
        }),
      }),
      params(),
    );

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.logClassroomEvent).not.toHaveBeenCalled();
  });

  it('keeps student-view responses scoped to self and teacher sync without full-class aggregates', async () => {
    const submittedAt = new Date('2026-06-15T00:00:00.000Z');
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.findUnique.mockResolvedValue({
      id: 'self-state-1',
      userId: 'student-1',
      itemId: 'step-01',
      submittedAt,
      user: { id: 'student-1', name: '学生甲', email: 'a@example.test' },
    });
    mocks.findFirst.mockResolvedValue({
      id: 'teacher-state-1',
      userId: 'teacher-1',
      itemId: 'teacher:course-sync',
      submittedAt,
      user: { id: 'teacher-1', name: '教师甲', email: 't@example.test' },
    });

    const response = await GET(
      new Request('http://localhost/api/session/session-1/state?scope=student-view'),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.courseStates).toHaveLength(1);
    expect(body.teacherStates).toHaveLength(1);
    expect(body.summary).toEqual({ latestUpdate: submittedAt.toISOString() });
    expect(body.summary).not.toHaveProperty('totalStudents');
    expect(body).not.toHaveProperty('presence');
    expect(body).not.toHaveProperty('delivery');
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it('rejects class-bound student-view reads from students outside the session class', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-2', role: 'STUDENT', profile: { classId: 'class-2' } },
    });
    mocks.classSessionFindUnique.mockResolvedValue({
      id: 'session-1',
      teacherId: 'teacher-1',
      classId: 'class-1',
    });

    const response = await GET(
      new Request('http://localhost/api/session/session-1/state?scope=student-view'),
      params(),
    );

    expect(response.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
