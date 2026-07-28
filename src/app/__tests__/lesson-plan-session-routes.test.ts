import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  generateUniqueJoinCode: vi.fn(),
  loadSessionLessonSnapshot: vi.fn(),
  loadRuntimeLessonManifestSnapshot: vi.fn(),
  logClassroomEvent: vi.fn(),
  enqueueSessionFinalizationEventIngestion: vi.fn(),
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
    platformSetting: { findUnique: vi.fn() },
    classSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
    smartCoursewarePublicationRevision: { findUnique: vi.fn() },
    classSessionIntegrityIncident: { upsert: vi.fn() },
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
  loadRuntimeLessonManifestSnapshot: mocks.loadRuntimeLessonManifestSnapshot,
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
import { ALL_PRESETS } from '@/features/teacher/preset-lessons';

describe('lesson plan empty-item guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER' });
    mocks.generateUniqueJoinCode.mockResolvedValue('123456');
    mocks.prisma.classSession.findFirst.mockResolvedValue(null);
    mocks.prisma.smartCoursewarePublicationRevision.findUnique.mockResolvedValue(null);
    mocks.prisma.platformSetting.findUnique.mockResolvedValue(null);
    mocks.redisClient.isReady.mockReturnValue(false);
    mocks.redisClient.getSessionState.mockResolvedValue(null);
    mocks.classroomRateLimiter.check.mockReturnValue({ allowed: true });
    mocks.loadSessionLessonSnapshot.mockReturnValue({
      lessonVersion: 'lesson.v1',
      manifestHash: 'hash',
      totalSteps: 1,
    });
    mocks.loadRuntimeLessonManifestSnapshot.mockReturnValue(null);
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
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({ authorId: 'teacher-1', items: [] });

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

  it('preserves server-owned runtime binding across reorder and override replacement', async () => {
    const binding = {
      schemaVersion: 'preset-runtime-step-binding-v1',
      sourcePresetKey: 'unit-1-4-time-frequency-views-v1',
      runtimeLessonId: '1-4',
      runtimeStepId: 'step-01',
    };
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      authorId: 'teacher-1',
      items: [{
        id: 'item-1',
        overrideConfig: {
          titleOverride: '原标题',
          __presetRuntimeBinding: binding,
        },
      }],
    });
    mocks.prisma.$transaction.mockImplementation(async (operation) => operation(mocks.prisma));
    mocks.prisma.lessonPlan.update.mockResolvedValue({ id: 'plan-1', items: [] });

    const response = await updateLessonPlan(
      new Request('http://localhost/api/lesson-plans/plan-1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: '改名后的教案',
          items: [{
            id: 'item-1',
            itemType: 'RESOURCE',
            resourceId: 'resource-1',
            stage: 'SUMMARY',
            order: 1,
            duration: 5,
            overrideConfig: {
              titleOverride: '新标题',
              __presetRuntimeBinding: {
                ...binding,
                runtimeStepId: 'forged-step',
              },
            },
          }],
        }),
      }),
      { params: Promise.resolve({ id: 'plan-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.lessonPlan.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: '改名后的教案',
        items: {
          create: [expect.objectContaining({
            stage: 'SUMMARY',
            overrideConfig: {
              titleOverride: '新标题',
              __presetRuntimeBinding: binding,
            },
          })],
        },
      }),
    }));
  });

  it('rejects a lesson item id that does not belong to the edited plan', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      authorId: 'teacher-1',
      items: [{ id: 'item-1', overrideConfig: {} }],
    });

    const response = await updateLessonPlan(
      new Request('http://localhost/api/lesson-plans/plan-1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: '教案',
          items: [{
            id: 'item-from-another-plan',
            itemType: 'RESOURCE',
            resourceId: 'resource-1',
            stage: 'BRIDGE_IN',
            order: 1,
            duration: 5,
            overrideConfig: {},
          }],
        }),
      }),
      { params: Promise.resolve({ id: 'plan-1' }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('strips client-forged runtime binding when creating a lesson plan', async () => {
    mocks.prisma.lessonPlan.create.mockResolvedValue({ id: 'plan-1' });

    const response = await createLessonPlan(new Request('http://localhost/api/lesson-plans', {
      method: 'POST',
      body: JSON.stringify({
        title: '新教案',
        items: [{
          itemType: 'RESOURCE',
          resourceId: 'resource-1',
          stage: 'BRIDGE_IN',
          order: 1,
          duration: 5,
          overrideConfig: {
            titleOverride: '标题',
            __presetRuntimeBinding: {
              schemaVersion: 'preset-runtime-step-binding-v1',
              sourcePresetKey: 'forged',
              runtimeLessonId: '1-4',
              runtimeStepId: 'step-01',
            },
          },
        }],
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.lessonPlan.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        items: {
          create: [expect.objectContaining({
            overrideConfig: { titleOverride: '标题' },
          })],
        },
      }),
    }));
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

  it('rejects teacher temporary classroom creation after the binding gates are recorded', async () => {
    mocks.prisma.platformSetting.findUnique.mockResolvedValue({
      value: {
        version: 1,
        enabled: true,
        invariantVerifiedAt: '2026-07-24T00:00:00.000Z',
        producerInventoryVerifiedAt: '2026-07-24T00:00:00.000Z',
      },
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ planId: 'public-plan' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('请选择一个已启用的班级');
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

  it('rejects a teacher launching another teacher generated publication', async () => {
    mocks.prisma.smartCoursewarePublicationRevision.findUnique.mockResolvedValue({
      id: 'publication-other',
      ownerId: 'teacher-2',
      manifestHash: 'manifest-other',
      displayName: '互动课件第1版（基于教案第1版）',
      revisionNumber: 1,
      planRevisionNumber: 1,
      projectedLessonPlans: [{ id: 'projection-other', generatedCoursewareManifestHash: 'manifest-other' }],
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ coursewarePublicationRevisionId: 'publication-other' }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.prisma.lessonPlan.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.classSession.create).not.toHaveBeenCalled();
  });

  it('derives every generated classroom identity field from the owned publication', async () => {
    mocks.prisma.smartCoursewarePublicationRevision.findUnique.mockResolvedValue({
      id: 'publication-v1',
      ownerId: 'teacher-1',
      manifestHash: 'manifest-v1',
      displayName: '互动课件第1版（基于教案第2版）',
      revisionNumber: 1,
      planRevisionNumber: 2,
      projectedLessonPlans: [{ id: 'projection-v1', generatedCoursewareManifestHash: 'manifest-v1' }],
    });
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      title: '互动课件第1版（基于教案第2版）',
      authorId: 'teacher-1',
      isPublic: false,
      generatedCoursewareManifestHash: 'manifest-v1',
      generatedCoursewarePublication: null,
      _count: { items: 8 },
    });
    mocks.prisma.classSession.create.mockResolvedValue({
      id: 'generated-session-v1',
      joinCode: '123456',
      classId: null,
      startTime: new Date('2026-07-20T12:00:00.000Z'),
      plan: { title: '互动课件第1版（基于教案第2版）' },
      class: null,
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({
        planId: 'forged-client-plan',
        manifestHash: 'forged-client-hash',
        coursewareRevisionNumber: 999,
        coursewarePublicationRevisionId: 'publication-v1',
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.lessonPlan.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'projection-v1' },
    }));
    expect(mocks.prisma.classSession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      planId: 'projection-v1',
      manifestHash: 'manifest-v1',
      lessonVersion: '互动课件第1版（基于教案第2版）',
      totalSteps: 8,
      coursewarePublicationRevisionId: 'publication-v1',
      coursewareDisplayName: '互动课件第1版（基于教案第2版）',
      coursewareRevisionNumber: 1,
      coursewarePlanRevisionNumber: 2,
    }) }));
    expect(mocks.loadSessionLessonSnapshot).not.toHaveBeenCalled();
  });

  it('automatically binds catalog planId launches to their generated publication', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      title: '互动课件第1版（基于教案第2版）',
      authorId: 'teacher-1',
      isPublic: false,
      generatedCoursewareManifestHash: 'manifest-v1',
      generatedCoursewarePublication: {
        id: 'publication-v1', ownerId: 'teacher-1', manifestHash: 'manifest-v1',
        displayName: '互动课件第1版（基于教案第2版）', revisionNumber: 1, planRevisionNumber: 2,
      },
      _count: { items: 8 },
    });
    mocks.prisma.classSession.create.mockResolvedValue({
      id: 'generated-session-v1', joinCode: '123456', classId: null,
      startTime: new Date('2026-07-20T12:00:00.000Z'),
      plan: { title: '互动课件第1版（基于教案第2版）' }, class: null,
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ planId: 'projection-v1' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.classSession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      planId: 'projection-v1', coursewarePublicationRevisionId: 'publication-v1', manifestHash: 'manifest-v1',
    }) }));
  });

  it('loads a renamed preset clone session snapshot from server-owned runtime binding', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      title: '教师改名后的课堂',
      authorId: 'teacher-1',
      isPublic: false,
      items: [{
        overrideConfig: {
          __presetRuntimeBinding: {
            schemaVersion: 'preset-runtime-step-binding-v1',
            sourcePresetKey: 'unit-1-4-time-frequency-views-v1',
            runtimeLessonId: '1-4',
            runtimeStepId: 'step-01',
          },
        },
      }],
      _count: { items: 1 },
    });
    mocks.loadRuntimeLessonManifestSnapshot.mockReturnValue({
      manifest: {},
      snapshot: {
        lessonVersion: 'runtime-v2',
        manifestHash: 'runtime-hash',
        totalSteps: 14,
      },
    });
    mocks.prisma.classSession.create.mockResolvedValue({
      id: 'session-runtime-bound',
      joinCode: '123456',
      classId: null,
      startTime: new Date('2026-07-25T08:00:00.000Z'),
      plan: { title: '教师改名后的课堂' },
      class: null,
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ planId: 'plan-runtime-bound' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.loadRuntimeLessonManifestSnapshot).toHaveBeenCalledWith('1-4');
    expect(mocks.loadSessionLessonSnapshot).not.toHaveBeenCalled();
    expect(mocks.prisma.classSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lessonVersion: 'runtime-v2',
        manifestHash: 'runtime-hash',
        totalSteps: 14,
      }),
    }));
  });

  it('fails closed when a normal lesson plan contains malformed runtime binding', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      title: '绑定损坏的课堂',
      authorId: 'teacher-1',
      isPublic: false,
      items: [{
        overrideConfig: {
          __presetRuntimeBinding: {
            schemaVersion: 'unknown-version',
          },
        },
      }],
      _count: { items: 1 },
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ planId: 'plan-malformed-binding' }),
    }));

    expect(response.status).toBe(409);
    expect(mocks.loadSessionLessonSnapshot).not.toHaveBeenCalled();
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

  it('preflights preset temporary classroom duplicates before a clone exists', async () => {
    const preset = ALL_PRESETS[0];
    mocks.prisma.classSession.findFirst.mockResolvedValue({
      id: 'existing-session',
      joinCode: '654321',
      classId: null,
      status: 'ACTIVE',
      plan: { title: `${preset.title} (副本)` },
      class: null,
    });

    const response = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({
        launchContext: 'temporary',
        sourcePresetKey: preset.key,
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      existingSessionId: 'existing-session',
      requiresExplicitChoice: true,
      classroomIdentity: { kind: 'temporary' },
    });
    expect(mocks.prisma.classSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        plan: { is: { title: `${preset.title} (副本)` } },
      }),
    }));
    expect(mocks.prisma.lessonPlan.findUnique).not.toHaveBeenCalled();
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

  it('preflights and deduplicates class-bound preset classrooms by preset title', async () => {
    const preset = ALL_PRESETS[0];
    mocks.prisma.classSession.findFirst.mockResolvedValue({
      id: 'class-session-existing',
      joinCode: '654321',
      classId: 'class-1',
      status: 'ACTIVE',
      plan: { title: `${preset.title} (副本)` },
      class: { name: '2026 控制班' },
    });

    const preflightResponse = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({
        classId: 'class-1',
        sourcePresetKey: preset.key,
      }),
    }));
    const preflightPayload = await preflightResponse.json();

    expect(preflightResponse.status).toBe(409);
    expect(preflightPayload).toMatchObject({
      existingSessionId: 'class-session-existing',
      requiresExplicitChoice: true,
      classroomIdentity: { kind: 'class-bound', classId: 'class-1' },
    });
    expect(mocks.prisma.classSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        classId: 'class-1',
        plan: { is: { title: `${preset.title} (副本)` } },
      }),
    }));
    expect(mocks.prisma.lessonPlan.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.classSession.create).not.toHaveBeenCalled();

    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      title: `${preset.title} (副本)`,
      authorId: 'teacher-1',
      isPublic: false,
      _count: { items: 2 },
    });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-1',
      isActive: true,
    });
    mocks.prisma.$transaction.mockImplementation(async (operation) => operation(mocks.prisma));
    const createResponse = await startSession(new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({
        planId: 'new-clone-plan',
        classId: 'class-1',
        sourcePresetKey: preset.key,
      }),
    }));

    expect(createResponse.status).toBe(409);
    expect(mocks.prisma.classSession.create).not.toHaveBeenCalled();
  });

  it('creates class-bound sessions with class identity and duplicate override', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-1',
      name: '2026 控制班',
      isActive: true,
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
    mocks.prisma.$transaction.mockImplementation(async (operation) => operation(mocks.prisma));

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

  it('finalizes only after resolving the exact generated revision and preserves it in Redis', async () => {
    const identity = {
      id: 'publication-v1',
      displayName: '互动课件第1版（基于教案第2版）',
      revisionNumber: 1,
      planRevisionNumber: 2,
      manifestHash: 'manifest-v1',
      projectedLessonPlans: [{ id: 'projection-v1', generatedCoursewareManifestHash: 'manifest-v1' }],
    };
    mocks.prisma.smartCoursewarePublicationRevision.findUnique.mockResolvedValue(identity);
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-v1',
      planId: 'projection-v1',
      teacherId: 'teacher-1',
      status: 'ACTIVE',
      classId: 'class-1',
      manifestHash: 'manifest-v1',
      coursewarePublicationRevisionId: 'publication-v1',
      coursewareDisplayName: identity.displayName,
      coursewareRevisionNumber: 1,
      coursewarePlanRevisionNumber: 2,
    });
    mocks.prisma.classSession.update.mockResolvedValue({
      id: 'session-v1',
      joinCode: '123456',
      planId: 'projection-v1',
      classId: 'class-1',
      teacherId: 'teacher-1',
      currentItemId: 'step-8',
      currentStage: 'SUMMARY',
      status: 'FINISHED',
      manifestHash: 'manifest-v1',
      coursewarePublicationRevisionId: 'publication-v1',
      coursewareDisplayName: identity.displayName,
      coursewareRevisionNumber: 1,
      coursewarePlanRevisionNumber: 2,
      updatedAt: new Date('2026-07-20T12:30:00.000Z'),
      plan: { title: identity.displayName },
      class: { name: '2026 控制班' },
    });
    mocks.redisClient.isReady.mockReturnValue(true);

    const response = await updateSession(
      new Request('http://localhost/api/session/session-v1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'FINISHED' }),
      }),
      { params: Promise.resolve({ sessionId: 'session-v1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.redisClient.setSessionState).toHaveBeenCalledWith('session-v1', expect.objectContaining({
      coursewarePublicationRevisionId: 'publication-v1',
      manifestHash: 'manifest-v1',
      coursewareRevisionNumber: 1,
      coursewarePlanRevisionNumber: 2,
      planId: 'projection-v1',
    }));
    expect(mocks.enqueueSessionFinalizationEventIngestion).toHaveBeenCalledWith('session-v1');
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

  it('does not let a stale Redis entry substitute another generated revision', async () => {
    const access = {
      id: 'session-v1',
      planId: 'projection-v1',
      teacherId: 'teacher-1',
      classId: 'class-1',
      manifestHash: 'manifest-v1',
      coursewarePublicationRevisionId: 'publication-v1',
      coursewareDisplayName: '互动课件第1版（基于教案第2版）',
      coursewareRevisionNumber: 1,
      coursewarePlanRevisionNumber: 2,
    };
    mocks.getServerSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER', profile: null });
    mocks.prisma.classSession.findUnique
      .mockResolvedValueOnce(access)
      .mockResolvedValueOnce({
        ...access,
        joinCode: '123456',
        currentItemId: 'step-1',
        currentStage: 'BRIDGE_IN',
        status: 'ACTIVE',
        updatedAt: new Date('2026-07-20T12:00:00.000Z'),
        plan: { title: access.coursewareDisplayName },
        class: { name: '2026 控制班' },
      });
    mocks.prisma.smartCoursewarePublicationRevision.findUnique.mockResolvedValue({
      id: 'publication-v1',
      displayName: access.coursewareDisplayName,
      revisionNumber: 1,
      planRevisionNumber: 2,
      manifestHash: 'manifest-v1',
      projectedLessonPlans: [{ id: 'projection-v1', generatedCoursewareManifestHash: 'manifest-v1' }],
    });
    mocks.redisClient.isReady.mockReturnValue(true);
    mocks.redisClient.getSessionState.mockResolvedValue({
      coursewarePublicationRevisionId: 'publication-v2',
      manifestHash: 'manifest-v2',
      planId: 'projection-v2',
      status: 'ACTIVE',
    });

    const response = await getSession(
      new Request('http://localhost/api/session/session-v1'),
      { params: Promise.resolve({ sessionId: 'session-v1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.coursewarePublicationRevisionId).toBe('publication-v1');
    expect(payload.manifestHash).toBe('manifest-v1');
    expect(mocks.prisma.classSession.findUnique).toHaveBeenCalledTimes(2);
    expect(mocks.redisClient.setSessionState).toHaveBeenCalledWith('session-v1', expect.objectContaining({
      coursewarePublicationRevisionId: 'publication-v1',
      manifestHash: 'manifest-v1',
    }));
  });
});
