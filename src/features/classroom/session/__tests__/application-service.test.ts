import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { createClassroomSession } from '../application/create';
import { joinClassroomSession } from '../application/join';
import {
  advanceClassroomSession,
  endClassroomSession,
  openClassroomSessionStream,
  readClassroomSession,
  regenerateClassroomSessionJoinCode,
  type ClassroomLifecycleRuntime,
} from '../application/lifecycle';
import { readClassroomSessionState, writeClassroomSessionState } from '../application/state';
import {
  CLASSROOM_STREAM_HEARTBEAT_MS,
  CLASSROOM_STREAM_POLL_MS,
  selectClassroomStreamBackend,
} from '../application/stream-policy';
import { ClassroomSessionError } from '../errors';
import type { ClassroomCreateRuntime } from '../application/create';

function createRuntime(overrides: Partial<ClassroomCreateRuntime> = {}): ClassroomCreateRuntime {
  return {
    emptyLessonPlanMessage: 'empty',
    getUser: vi.fn().mockResolvedValue({ id: 'teacher-1', role: 'TEACHER' }),
    isTeacherClassBindingEnforced: vi.fn().mockResolvedValue(false),
    findPreset: vi.fn(),
    findActiveSession: vi.fn().mockResolvedValue(null),
    findPublication: vi.fn().mockResolvedValue(null),
    findPlan: vi.fn().mockResolvedValue({
      title: 'Plan',
      authorId: 'teacher-1',
      isPublic: true,
      generatedCoursewareManifestHash: null,
      generatedCoursewarePublication: null,
      items: [{}],
      itemCount: 1,
    }),
    resolvePlanRuntimeBindings: vi.fn().mockReturnValue({ state: 'unbound' }),
    resolveInteractiveLessonIdentity: vi.fn().mockReturnValue({ status: 'unresolved' }),
    loadRuntimeLessonManifestSnapshot: vi.fn(),
    loadSessionLessonSnapshot: vi.fn().mockReturnValue({
      lessonVersion: 'v1',
      manifestHash: 'hash',
      totalSteps: 1,
    }),
    captureRuntimeCourseBundleIdentity: vi.fn(),
    generatedCoursewareBundleIdentity: vi.fn(),
    planProjectionBundleIdentity: vi.fn().mockReturnValue({ bundleId: 'bundle' }),
    listPlanItems: vi.fn().mockResolvedValue([]),
    generateJoinCode: vi.fn().mockResolvedValue('123456'),
    persistAndCreateSession: vi.fn().mockResolvedValue({
      id: 'session-1',
      startTime: new Date('2026-01-01T00:00:00.000Z'),
      currentItemId: null,
    }),
    buildClassroomIdentity: vi.fn().mockReturnValue({ sessionId: 'session-1' }),
    logStart: vi.fn(),
    ...overrides,
  };
}

function accessSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    planId: 'plan-1',
    teacherId: 'teacher-1',
    status: 'ACTIVE',
    classId: 'class-1',
    coursewarePublicationRevisionId: null,
    coursewareDisplayName: null,
    coursewareRevisionNumber: null,
    coursewarePlanRevisionNumber: null,
    manifestHash: null,
    ...overrides,
  };
}

function readableSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    joinCode: '123456',
    status: 'ACTIVE',
    classId: 'class-1',
    currentItemId: 'item-1',
    currentStage: 'BRIDGE_IN',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    plan: { title: 'Plan' },
    class: { name: 'A' },
    ...overrides,
  };
}

function createLifecycleRuntime(
  overrides: Partial<ClassroomLifecycleRuntime> = {},
): ClassroomLifecycleRuntime {
  return {
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    loadAccessActor: vi.fn().mockResolvedValue({
      id: 'teacher-1',
      role: 'TEACHER',
      profile: null,
    }),
    loadAccessSession: vi.fn().mockResolvedValue(accessSession()),
    resolveGeneratedBinding: vi.fn().mockResolvedValue({ ok: true, identity: null }),
    readCachedState: vi.fn().mockResolvedValue(null),
    loadReadableSession: vi.fn().mockResolvedValue(readableSession()),
    writeCachedState: vi.fn(),
    buildIdentity: vi.fn().mockReturnValue({ sessionId: 'session-1' }),
    persistAdvance: vi.fn().mockImplementation(async (input) => readableSession({
      status: input.status ?? 'ACTIVE',
      currentItemId: input.currentItemId ?? 'item-1',
      currentStage: input.currentStage ?? 'BRIDGE_IN',
    })),
    publishSessionState: vi.fn(),
    logPatch: vi.fn(),
    finalizeEndedSession: vi.fn(),
    loadStreamSession: vi.fn().mockResolvedValue(accessSession({
      currentItemId: 'item-1',
      currentStage: 'BRIDGE_IN',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })),
    loadActorClassId: vi.fn().mockResolvedValue('class-1'),
    generateJoinCode: vi.fn().mockResolvedValue('654321'),
    persistJoinCode: vi.fn().mockResolvedValue({ joinCode: '654321' }),
    ...overrides,
  };
}

describe('classroom session application service', () => {
  it('rejects unauthenticated create actors that are not teachers', async () => {
    const runtime = createRuntime({
      getUser: vi.fn().mockResolvedValue({ id: 'student-1', role: 'STUDENT' }),
    });
    await expect(createClassroomSession(runtime, {
      actor: { id: 'student-1', role: 'STUDENT' },
    })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('reuses an active duplicate when requested', async () => {
    const runtime = createRuntime({
      findActiveSession: vi.fn().mockResolvedValue({ id: 'existing', plan: { title: 'Plan' } }),
      buildClassroomIdentity: vi.fn().mockReturnValue({ sessionId: 'existing' }),
    });
    await expect(createClassroomSession(runtime, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      planId: 'plan-1',
      duplicateAction: 'reuse',
    })).rejects.toMatchObject({ code: 'reuse-session' });
  });

  it('denies join when the class-bound student is in another class', async () => {
    await expect(joinClassroomSession({
      findByJoinCode: vi.fn().mockResolvedValue({
        id: 'session-1',
        joinCode: '123456',
        status: 'ACTIVE',
        currentStage: null,
        currentItemId: null,
        classId: 'class-1',
        plan: { id: 'plan-1', title: 'Plan' },
        teacher: { name: 'T' },
        class: { name: 'A' },
        courseBundleRevisionId: null,
        courseBundleRevision: null,
      }),
      getStudentClassId: vi.fn().mockResolvedValue('class-2'),
      resolveRoute: vi.fn(),
      logJoin: vi.fn(),
    }, {
      actor: { id: 'student-1', role: 'STUDENT' },
      joinCode: '123456',
    })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('denies class-bound reads from a student in another class', async () => {
    const runtime = createLifecycleRuntime({
      loadAccessActor: vi.fn().mockResolvedValue({
        id: 'student-2',
        role: 'STUDENT',
        profile: { classId: 'class-2' },
      }),
    });
    await expect(readClassroomSession(runtime, {
      actor: { id: 'student-2', role: 'STUDENT', profile: { classId: 'class-2' } },
      sessionId: 'session-1',
    })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('keeps classless sessions readable by authenticated students', async () => {
    const runtime = createLifecycleRuntime({
      loadAccessActor: vi.fn().mockResolvedValue({
        id: 'student-1',
        role: 'STUDENT',
        profile: { classId: null },
      }),
      loadAccessSession: vi.fn().mockResolvedValue(accessSession({ classId: null })),
    });
    await expect(readClassroomSession(runtime, {
      actor: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
    })).resolves.toMatchObject({ id: 'session-1', planTitle: 'Plan' });
  });

  it('rejects invalid advance transitions', async () => {
    const runtime = createLifecycleRuntime();
    await expect(advanceClassroomSession(runtime, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      sessionId: 'session-1',
      currentStage: 'NOT_A_STAGE',
    })).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(advanceClassroomSession(runtime, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      sessionId: 'session-1',
      status: 'UNKNOWN',
    })).rejects.toMatchObject({ code: 'invalid-input' });
  });

  it('finalizes once and treats a second end as idempotent', async () => {
    const runtime = createLifecycleRuntime({
      loadAccessSession: vi.fn()
        .mockResolvedValueOnce(accessSession({ status: 'ACTIVE' }))
        .mockResolvedValueOnce(accessSession({ status: 'FINISHED' })),
    });
    await endClassroomSession(runtime, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      sessionId: 'session-1',
    });
    await endClassroomSession(runtime, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      sessionId: 'session-1',
    });
    expect(runtime.finalizeEndedSession).toHaveBeenCalledTimes(1);
    expect(runtime.persistAdvance).toHaveBeenCalledTimes(1);
  });

  it('maps generated-courseware recovery to a conflict', async () => {
    const runtime = createLifecycleRuntime({
      resolveGeneratedBinding: vi.fn().mockResolvedValue({
        ok: false,
        recovery: { code: 'generated-courseware-revision-missing' },
      }),
    });
    await expect(readClassroomSession(runtime, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      sessionId: 'session-1',
    })).rejects.toMatchObject({ code: 'conflict', message: 'generated-courseware' });
  });

  it('denies stream access for a student in another class', async () => {
    const runtime = createLifecycleRuntime({
      loadActorClassId: vi.fn().mockResolvedValue('class-2'),
    });
    await expect(openClassroomSessionStream(runtime, {
      actor: { id: 'student-2', role: 'STUDENT' },
      sessionId: 'session-1',
    })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('rejects join-code regeneration after the session is finished', async () => {
    const runtime = createLifecycleRuntime({
      loadAccessSession: vi.fn().mockResolvedValue(accessSession({ status: 'FINISHED' })),
    });
    await expect(regenerateClassroomSessionJoinCode(runtime, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      sessionId: 'session-1',
    })).rejects.toMatchObject({ code: 'conflict' });
  });

  it('selects redis or poll from the shared stream policy', () => {
    expect(CLASSROOM_STREAM_HEARTBEAT_MS).toBe(15_000);
    expect(CLASSROOM_STREAM_POLL_MS).toBe(2_000);
    expect(selectClassroomStreamBackend(true)).toBe('redis');
    expect(selectClassroomStreamBackend(false)).toBe('poll');
  });

  it('denies teacher-sync state writes from students', async () => {
    await expect(writeClassroomSessionState({
      loadUser: vi.fn().mockResolvedValue({ id: 'student-1', role: 'STUDENT', profile: { classId: 'class-1' } }),
      loadSessionAccess: vi.fn().mockResolvedValue({ teacherId: 'teacher-1', classId: 'class-1' }),
      loadTeacherViewSession: vi.fn(),
      listCourseStates: vi.fn(),
      listTeacherStates: vi.fn(),
      loadSelfState: vi.fn(),
      loadLatestTeacherSync: vi.fn(),
      upsertStudentState: vi.fn(),
      buildIdentity: vi.fn(),
      logState: vi.fn(),
    }, {
      actor: { id: 'student-1', role: 'STUDENT', profile: { classId: 'class-1' } },
      sessionId: 'session-1',
      body: { itemId: 'teacher:course-sync', data: { ok: true } },
    })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('strips teacher identity from student-view teacher sync rows', async () => {
    const result = await readClassroomSessionState({
      loadUser: vi.fn(),
      loadSessionAccess: vi.fn().mockResolvedValue({ teacherId: 'teacher-1', classId: 'class-1' }),
      loadTeacherViewSession: vi.fn(),
      listCourseStates: vi.fn(),
      listTeacherStates: vi.fn(),
      loadSelfState: vi.fn().mockResolvedValue(null),
      loadLatestTeacherSync: vi.fn().mockResolvedValue({
        itemId: 'teacher:course-sync',
        stateKey: 'teacher-sync',
        lessonKey: 'unit',
        submittedAt: new Date('2026-07-16T00:01:00.000Z'),
        data: { activeStepId: 'step-05' },
        userId: 'teacher-1',
        user: { id: 'teacher-1', name: '教师甲', email: 'teacher@example.test' },
      }),
      upsertStudentState: vi.fn(),
      buildIdentity: vi.fn(),
      logState: vi.fn(),
    }, {
      actor: { id: 'student-1', role: 'STUDENT', profile: { classId: 'class-1' } },
      sessionId: 'session-1',
      scope: 'student-view',
    });
    expect(result.teacherStates).toEqual([{
      itemId: 'teacher:course-sync',
      stateKey: 'teacher-sync',
      lessonKey: 'unit',
      submittedAt: new Date('2026-07-16T00:01:00.000Z'),
      data: { activeStepId: 'step-05' },
    }]);
    expect(JSON.stringify(result.teacherStates)).not.toContain('teacher-1');
  });

  it('keeps application modules free of Prisma, Next, Redis, and React', () => {
    const applicationDir = join(process.cwd(), 'src/features/classroom/session/application');
    for (const file of ['create.ts', 'join.ts', 'lifecycle.ts', 'state.ts', 'stream-policy.ts']) {
      const source = readFileSync(join(applicationDir, file), 'utf8');
      expect(source).not.toMatch(/from '@prisma\/client'|from 'next|from 'react'|@\/lib\/prisma|@\/lib\/redis-client/);
    }
  });

  it('keeps session HTTP routes free of Prisma orchestration', () => {
    const routes = [
      'src/app/api/session/route.ts',
      'src/app/api/session/join/route.ts',
      'src/app/api/session/[sessionId]/route.ts',
      'src/app/api/session/[sessionId]/state/route.ts',
      'src/app/api/session/[sessionId]/stream/route.ts',
      'src/app/api/session/[sessionId]/join-code/route.ts',
    ];
    for (const file of routes) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toContain("from '@/lib/prisma'");
      expect(source).not.toContain("from '@prisma/client'");
    }
  });
});
