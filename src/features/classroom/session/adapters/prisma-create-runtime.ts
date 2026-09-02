import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateUniqueJoinCode } from '@/lib/join-code';
import { EMPTY_LESSON_PLAN_MESSAGE } from '@/lib/lesson-plan-readiness';
import {
  loadRuntimeLessonManifestSnapshot,
  loadSessionLessonSnapshot,
} from '@/lib/session-lesson-snapshot';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';
import { resolvePlanRuntimeBindings } from '@/lib/lesson-plan-runtime-binding';
import { CourseBundleCaptureError } from '@/lib/course-bundle';
import { captureRuntimeCourseBundleIdentity } from '@/lib/course-bundle';
import {
  persistCourseBundleRevision,
  planProjectionBundleIdentity,
  generatedCoursewareBundleIdentity,
} from '@/lib/course-bundle';
import {
  buildClassroomIdentityPayload,
  buildClassroomLifecycleEvidenceFields,
} from '@/lib/classroom-lifecycle-contract';
import { logClassroomEvent } from '@/lib/classroom-observability';
import {
  createClassBoundSession,
  SessionClassBindingError,
} from '@/lib/session-class-binding';
import { isTeacherClassBindingEnforced } from '@/lib/teacher-class-binding-enforcement';
import { ClassroomSessionError } from '../errors';
import type { ClassroomCreateRuntime } from '../application/create';

type ActiveClassroomSession = Prisma.ClassSessionGetPayload<{
  include: {
    plan: { select: { title: true } };
    class: { select: { name: true } };
  };
}>;

class DuplicateClassroomSessionError extends Error {
  constructor(
    public readonly session: ActiveClassroomSession,
    public readonly reuseExistingSession: boolean,
  ) {
    super('duplicate-classroom-session');
    this.name = 'DuplicateClassroomSessionError';
  }
}

export function createPrismaClassroomCreateRuntime(): ClassroomCreateRuntime {
  return {
    emptyLessonPlanMessage: EMPTY_LESSON_PLAN_MESSAGE,
    getUser: async (id) => prisma.user.findUnique({ where: { id }, select: { id: true, role: true } }),
    isTeacherClassBindingEnforced,
    findPreset: (key) => ALL_PRESETS.find((item) => item.key === key),
    findActiveSession: async (query) => prisma.classSession.findFirst({
      where: {
        teacherId: query.teacherId,
        classId: query.classId,
        status: 'ACTIVE',
        ...(query.planTitle ? { plan: { is: { title: query.planTitle } } } : {}),
        ...(query.planId ? { planId: query.planId } : {}),
      },
      include: {
        plan: { select: { title: true } },
        class: { select: { name: true } },
      },
    }),
    findPublication: async (id) => prisma.smartCoursewarePublicationRevision.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        manifestHash: true,
        displayName: true,
        revisionNumber: true,
        planRevisionNumber: true,
        contentHash: true,
        sourceRevisionId: true,
        projectedLessonPlans: { select: { id: true, generatedCoursewareManifestHash: true } },
      },
    }),
    findPlan: async (id) => {
      const plan = await prisma.lessonPlan.findUnique({
        where: { id },
        select: {
          title: true,
          authorId: true,
          isPublic: true,
          generatedCoursewareManifestHash: true,
          generatedCoursewarePublication: {
            select: {
              id: true,
              ownerId: true,
              manifestHash: true,
              displayName: true,
              revisionNumber: true,
              planRevisionNumber: true,
            },
          },
          items: { select: { overrideConfig: true } },
          _count: { select: { items: true } },
        },
      });
      if (!plan) return null;
      return { ...plan, itemCount: plan._count.items };
    },
    resolvePlanRuntimeBindings: (items) => {
      const resolved = resolvePlanRuntimeBindings(items);
      if (resolved.state === 'valid') {
        return {
          state: 'valid',
          sourcePresetKey: resolved.sourcePresetKey,
          runtimeLessonId: resolved.runtimeLessonId,
        };
      }
      if (resolved.state === 'invalid') return { state: 'invalid' };
      return { state: 'unbound' };
    },
    resolveInteractiveLessonIdentity: (input) => resolveInteractiveLessonIdentity(input as never),
    loadRuntimeLessonManifestSnapshot: (id) => loadRuntimeLessonManifestSnapshot(id),
    loadSessionLessonSnapshot: (title) => loadSessionLessonSnapshot(title),
    captureRuntimeCourseBundleIdentity: async (canonicalLessonId) => {
      try {
        return await captureRuntimeCourseBundleIdentity(canonicalLessonId);
      } catch (error) {
        if (error instanceof CourseBundleCaptureError) {
          const wrapped = new Error('CourseBundleCaptureError');
          wrapped.name = 'CourseBundleCaptureError';
          throw wrapped;
        }
        throw error;
      }
    },
    generatedCoursewareBundleIdentity,
    planProjectionBundleIdentity,
    listPlanItems: async (planId) => prisma.lessonItem.findMany({
      where: { planId },
      select: {
        stage: true,
        order: true,
        resourceId: true,
        knowledgeNodeId: true,
        overrideConfig: true,
      },
      orderBy: [{ stage: 'asc' }, { order: 'asc' }],
    }),
    generateJoinCode: () => generateUniqueJoinCode(prisma),
    persistAndCreateSession: async (input) => {
      const createSession = async (
        db: Pick<Prisma.TransactionClient, 'classSession' | 'courseBundleRevision'>,
      ) => {
        const bundleRevision = await persistCourseBundleRevision(db, input.bundleIdentity as never);
        return db.classSession.create({
          data: {
            joinCode: input.joinCode,
            planId: input.planId,
            teacherId: input.actorId,
            ...(input.classId ? { classId: input.classId } : {}),
            status: 'ACTIVE',
            currentStage: 'BRIDGE_IN',
            currentItemId: undefined,
            lessonVersion: input.lessonSnapshot.lessonVersion,
            manifestHash: bundleRevision.manifestHash ?? input.lessonSnapshot.manifestHash,
            totalSteps: input.lessonSnapshot.totalSteps,
            courseBundleRevisionId: bundleRevision.id,
            bundleRuntimeReleaseId: bundleRevision.runtimeReleaseId,
            bundleDigest: bundleRevision.bundleDigest,
            ...(input.generatedBinding ? {
              coursewarePublicationRevisionId: input.generatedBinding.id,
              coursewareDisplayName: input.generatedBinding.displayName,
              coursewareRevisionNumber: input.generatedBinding.revisionNumber,
              coursewarePlanRevisionNumber: input.generatedBinding.planRevisionNumber,
            } : {}),
          },
          include: {
            plan: { select: { title: true } },
            class: { select: { name: true } },
          },
        });
      };
      try {
        const newSession = input.classId
          ? await createClassBoundSession(prisma, {
            actorId: input.actorId,
            actorRole: input.actorRole as never,
            classId: input.classId,
            create: async (tx) => {
              if (input.duplicateAction !== 'new-session') {
                const activeSession = await tx.classSession.findFirst({
                  where: {
                    teacherId: input.actorId,
                    classId: input.classId,
                    status: 'ACTIVE',
                    ...(input.sourcePresetKey
                      ? { plan: { is: { title: input.planTitle } } }
                      : { planId: input.planId }),
                  },
                  include: {
                    plan: { select: { title: true } },
                    class: { select: { name: true } },
                  },
                });
                if (activeSession) {
                  throw new DuplicateClassroomSessionError(activeSession, input.duplicateAction === 'reuse');
                }
              }
              return createSession(tx);
            },
          })
          : await createSession(prisma);
        return newSession as Record<string, unknown>;
      } catch (error) {
        if (error instanceof DuplicateClassroomSessionError) {
          const classroomIdentity = buildClassroomIdentityPayload(error.session);
          if (error.reuseExistingSession) {
            throw new ClassroomSessionError('reuse-session', 'reuse', {
              session: { ...error.session, classroomIdentity, reusedExistingSession: true },
            });
          }
          throw new ClassroomSessionError(
            'duplicate-session',
            '该班级和教案已有进行中的课堂，请选择进入已有课堂或确认新开课堂。',
            {
              existingSessionId: error.session.id,
              requiresExplicitChoice: true,
              allowedActions: ['reuse', 'new-session'],
              classroomIdentity,
            },
          );
        }
        if (error instanceof SessionClassBindingError) {
          if (error.code === 'class-not-found') {
            throw new ClassroomSessionError('class-not-found', '班级不存在');
          }
          if (error.code === 'class-not-active') {
            throw new ClassroomSessionError('class-not-active', '班级未启用，请刷新后重新选择。');
          }
          if (error.code === 'class-not-owned') {
            throw new ClassroomSessionError('class-not-owned', '无权在此班级开始课堂');
          }
          throw new ClassroomSessionError('class-busy', '班级状态正在更新，请刷新后重试。');
        }
        throw error;
      }
    },
    buildClassroomIdentity: (session) => buildClassroomIdentityPayload(session as never),
    logStart: (payload) => {
      logClassroomEvent('session_start', {
        sessionId: payload.sessionId,
        actorUserId: payload.actorUserId,
        planId: payload.planId,
        classId: payload.classId,
        sourcePresetKey: payload.sourcePresetKey,
        coursewarePublicationRevisionId: payload.coursewarePublicationRevisionId,
        coursewareManifestHash: payload.coursewareManifestHash,
        classroomEvent: buildClassroomLifecycleEvidenceFields({
          eventType: 'start-class',
          actorRole: 'teacher',
          sessionId: String(payload.sessionId),
          stepId: payload.currentItemId ? String(payload.currentItemId) : null,
          clientEventId: `classroom-session:${String(payload.sessionId)}:start-class`,
          clientEventAt: String(payload.clientEventAt ?? payload.sessionId),
          sourceLogId: 'api-session-start',
        }),
      });
    },
  };
}
