
import { Prisma, UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateUniqueJoinCode } from '@/lib/join-code';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { EMPTY_LESSON_PLAN_MESSAGE } from '@/lib/lesson-plan-readiness';
import {
  loadRuntimeLessonManifestSnapshot,
  loadSessionLessonSnapshot,
} from '@/lib/session-lesson-snapshot';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons';
import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';
import { resolvePlanRuntimeBindings } from '@/lib/lesson-plan-runtime-binding';
import {
  CourseBundleCaptureError,
  type CourseBundleIdentity,
} from '@/lib/course-bundle/contract';
import { captureRuntimeCourseBundleIdentity } from '@/lib/course-bundle/capture';
import {
  persistCourseBundleRevision,
  planProjectionBundleIdentity,
  generatedCoursewareBundleIdentity,
} from '@/lib/course-bundle/session-binding';
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

export const dynamic = 'force-dynamic';

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

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: '只有教师或管理员可以开始课堂' }, { status: 403 });
    }

    const body = await request.json();
    const {
      planId: requestedPlanId,
      coursewarePublicationRevisionId: requestedPublicationRevisionId,
      classId: requestedClassId,
      duplicateAction,
      sourcePresetKey,
    } = body;
    const classId = typeof requestedClassId === 'string' ? requestedClassId.trim() : '';
    if (requestedClassId !== undefined && !classId) {
      return NextResponse.json({ error: '请选择一个已启用的班级' }, { status: 400 });
    }
    if (user.role === UserRole.TEACHER
      && await isTeacherClassBindingEnforced()
      && !classId) {
      return NextResponse.json({ error: '请选择一个已启用的班级' }, { status: 400 });
    }
    const publicationRevisionId = typeof requestedPublicationRevisionId === 'string'
      ? requestedPublicationRevisionId.trim()
      : '';
    let planId = typeof requestedPlanId === 'string' ? requestedPlanId.trim() : '';
    let generatedBinding: {
      id: string;
      ownerId: string;
      manifestHash: string;
      displayName: string;
      revisionNumber: number;
      planRevisionNumber: number;
      projectedLessonPlanId: string;
    } | null = null;

    if (publicationRevisionId) {
      const publication = await prisma.smartCoursewarePublicationRevision.findUnique({
        where: { id: publicationRevisionId },
        select: {
          id: true,
          ownerId: true,
          manifestHash: true,
          displayName: true,
          revisionNumber: true,
          planRevisionNumber: true,
          projectedLessonPlans: { select: { id: true, generatedCoursewareManifestHash: true } },
        },
      });
      const projection = publication?.projectedLessonPlans[0];
      if (!publication || publication.projectedLessonPlans.length !== 1 || !projection
        || projection.generatedCoursewareManifestHash !== publication.manifestHash) {
        return NextResponse.json({ error: '已发布互动课件投影不可用' }, { status: 409 });
      }
      if (user.role !== UserRole.ADMIN && publication.ownerId !== user.id) {
        return NextResponse.json({ error: '无权启动此互动课件版本' }, { status: 403 });
      }
      planId = projection.id;
      generatedBinding = { ...publication, projectedLessonPlanId: projection.id };
    }

    if (!planId && sourcePresetKey && duplicateAction !== 'new-session') {
      const preset = ALL_PRESETS.find((item) => item.key === sourcePresetKey);
      if (!preset) {
        return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
      }
      const activeSession = await prisma.classSession.findFirst({
        where: {
          teacherId: user.id,
          classId: classId || null,
          status: 'ACTIVE',
          plan: { is: { title: `${preset.title} (副本)` } },
        },
        include: {
          plan: { select: { title: true } },
          class: { select: { name: true } },
        },
      });

      if (activeSession) {
        const classroomIdentity = buildClassroomIdentityPayload(activeSession);
        if (duplicateAction === 'reuse') {
          return NextResponse.json({
            ...activeSession,
            classroomIdentity,
            reusedExistingSession: true,
          });
        }

        return NextResponse.json({
          error: classId
            ? '该班级已有进行中的预置互动课堂，请选择进入已有课堂或确认新开课堂。'
            : '该教案已有进行中的临时课堂，请选择进入已有课堂或确认新开课堂。',
          existingSessionId: activeSession.id,
          requiresExplicitChoice: true,
          allowedActions: ['reuse', 'new-session'],
          classroomIdentity,
        }, { status: 409 });
      }
    }

    if (!planId) {
      return NextResponse.json({ error: '请选择教案' }, { status: 400 });
    }

    const plan = await prisma.lessonPlan.findUnique({
      where: { id: planId },
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
        items: {
          select: {
            overrideConfig: true,
          },
        },
        _count: { select: { items: true } },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: '教案不存在' }, { status: 404 });
    }
    if (user.role !== UserRole.ADMIN && !plan.isPublic && plan.authorId !== user.id) {
      return NextResponse.json({ error: '无权启动此教案' }, { status: 403 });
    }
    if (plan._count.items === 0) {
      return NextResponse.json({ error: EMPTY_LESSON_PLAN_MESSAGE }, { status: 400 });
    }

    if (!generatedBinding && plan.generatedCoursewarePublication) {
      const publication = plan.generatedCoursewarePublication;
      if (user.role !== UserRole.ADMIN && publication.ownerId !== user.id) {
        return NextResponse.json({ error: '无权启动此互动课件版本' }, { status: 403 });
      }
      if (plan.generatedCoursewareManifestHash !== publication.manifestHash) {
        return NextResponse.json({ error: '已发布互动课件投影完整性校验失败' }, { status: 409 });
      }
      generatedBinding = { ...publication, projectedLessonPlanId: planId };
    }

    if (!classId && duplicateAction !== 'new-session') {
      const activeSession = await prisma.classSession.findFirst({
        where: {
          teacherId: user.id,
          classId: classId || null,
          status: 'ACTIVE',
          ...(sourcePresetKey
            ? { plan: { is: { title: plan.title } } }
            : { planId }),
        },
        include: {
          plan: { select: { title: true } },
          class: { select: { name: true } },
        },
      });

      if (activeSession) {
        const classroomIdentity = buildClassroomIdentityPayload(activeSession);
        if (duplicateAction === 'reuse') {
          return NextResponse.json({
            ...activeSession,
            classroomIdentity,
            reusedExistingSession: true,
          });
        }

        return NextResponse.json({
          error: classId
            ? '该班级和教案已有进行中的课堂，请选择进入已有课堂或确认新开课堂。'
            : '该教案已有进行中的临时课堂，请选择进入已有课堂或确认新开课堂。',
          existingSessionId: activeSession.id,
          requiresExplicitChoice: true,
          allowedActions: ['reuse', 'new-session'],
          classroomIdentity,
        }, { status: 409 });
      }
    }

    const joinCode = await generateUniqueJoinCode(prisma);
    let lessonSnapshot;
    let bundleIdentity: CourseBundleIdentity;
    if (generatedBinding) {
      lessonSnapshot = {
        lessonVersion: generatedBinding.displayName,
        manifestHash: generatedBinding.manifestHash,
        totalSteps: plan._count.items,
      };
      const publicationRecord = publicationRevisionId
        ? await prisma.smartCoursewarePublicationRevision.findUnique({
          where: { id: publicationRevisionId },
          select: { id: true, manifestHash: true, contentHash: true, sourceRevisionId: true },
        })
        : plan.generatedCoursewarePublication
          ? await prisma.smartCoursewarePublicationRevision.findUnique({
            where: { id: plan.generatedCoursewarePublication.id },
            select: { id: true, manifestHash: true, contentHash: true, sourceRevisionId: true },
          })
          : null;
      if (!publicationRecord) {
        return NextResponse.json({ error: '已发布互动课件投影不可用' }, { status: 409 });
      }
      bundleIdentity = generatedCoursewareBundleIdentity({
        id: publicationRecord.id,
        manifestHash: publicationRecord.manifestHash,
        contentHash: publicationRecord.contentHash,
        sourceRevision: publicationRecord.sourceRevisionId,
      });
    } else {
      const runtimeBindings = resolvePlanRuntimeBindings(plan.items ?? []);
      if (runtimeBindings.state === 'invalid') {
        return NextResponse.json({ error: '教案互动课来源绑定无效' }, { status: 409 });
      }
      if (runtimeBindings.state === 'valid') {
        const preset = ALL_PRESETS.find((candidate) =>
          candidate.key === runtimeBindings.sourcePresetKey);
        const presetIdentity = resolveInteractiveLessonIdentity({
          kind: 'presetKey',
          value: runtimeBindings.sourcePresetKey,
        });
        const runtimeIdentity = resolveInteractiveLessonIdentity({
          kind: 'runtimeLessonDir',
          value: runtimeBindings.runtimeLessonId,
        });
        const runtimeSnapshot = loadRuntimeLessonManifestSnapshot(runtimeBindings.runtimeLessonId);
        if (
          !preset
          || presetIdentity.status !== 'resolved'
          || runtimeIdentity.status !== 'resolved'
          || presetIdentity.record.canonicalId !== runtimeIdentity.record.canonicalId
          || presetIdentity.record.canonicalId !== runtimeBindings.runtimeLessonId
          || !runtimeSnapshot
        ) {
          return NextResponse.json({ error: '教案互动课来源绑定不可用' }, { status: 409 });
        }
        lessonSnapshot = runtimeSnapshot.snapshot;
        // Capture the immutable bundle identity from the resolved canonical
        // lesson before the session is written; capture failures block creation.
        try {
          bundleIdentity = await captureRuntimeCourseBundleIdentity(presetIdentity.record.canonicalId);
        } catch (error) {
          if (error instanceof CourseBundleCaptureError) {
            return NextResponse.json({ error: '教案互动课运行时内容不可用' }, { status: 409 });
          }
          throw error;
        }
      } else {
        lessonSnapshot = loadSessionLessonSnapshot(plan.title);
        // Bounded ingress alias: a plan title that resolves to a registered
        // runtime lesson persists that lesson's canonical bundle, never the
        // title itself; otherwise the pure DB plan projection is captured.
        const titleIdentity = resolveInteractiveLessonIdentity({ kind: 'planTitleAlias', value: plan.title });
        if (titleIdentity.status === 'resolved') {
          try {
            bundleIdentity = await captureRuntimeCourseBundleIdentity(titleIdentity.record.canonicalId);
          } catch (error) {
            if (error instanceof CourseBundleCaptureError) {
              return NextResponse.json({ error: '教案互动课运行时内容不可用' }, { status: 409 });
            }
            throw error;
          }
        } else {
          const planItems = await prisma.lessonItem.findMany({
            where: { planId },
            select: {
              stage: true,
              order: true,
              resourceId: true,
              knowledgeNodeId: true,
              overrideConfig: true,
            },
            orderBy: [{ stage: 'asc' }, { order: 'asc' }],
          });
          bundleIdentity = planProjectionBundleIdentity(planId, planItems);
        }
      }
    }

    const createSession = async (
      db: Pick<Prisma.TransactionClient, 'classSession' | 'courseBundleRevision'>,
    ) => {
      const bundleRevision = await persistCourseBundleRevision(db, bundleIdentity);
      return db.classSession.create({
        data: {
          joinCode,
          planId,
          teacherId: user.id,
          ...(classId ? { classId } : {}),
          status: 'ACTIVE',
          currentStage: 'BRIDGE_IN',
          currentItemId: undefined,
          lessonVersion: lessonSnapshot.lessonVersion,
          manifestHash: bundleRevision.manifestHash ?? lessonSnapshot.manifestHash,
          totalSteps: lessonSnapshot.totalSteps,
          courseBundleRevisionId: bundleRevision.id,
          bundleRuntimeReleaseId: bundleRevision.runtimeReleaseId,
          bundleDigest: bundleRevision.bundleDigest,
          ...(generatedBinding ? {
            coursewarePublicationRevisionId: generatedBinding.id,
            coursewareDisplayName: generatedBinding.displayName,
            coursewareRevisionNumber: generatedBinding.revisionNumber,
            coursewarePlanRevisionNumber: generatedBinding.planRevisionNumber,
          } : {}),
        },
        include: {
          plan: { select: { title: true } },
          class: { select: { name: true } },
        },
      });
    };
    const newSession = classId
      ? await createClassBoundSession(prisma, {
        actorId: user.id,
        actorRole: user.role,
        classId,
        create: async (tx) => {
          if (duplicateAction !== 'new-session') {
            const activeSession = await tx.classSession.findFirst({
              where: {
                teacherId: user.id,
                classId,
                status: 'ACTIVE',
                ...(sourcePresetKey
                  ? { plan: { is: { title: plan.title } } }
                  : { planId }),
              },
              include: {
                plan: { select: { title: true } },
                class: { select: { name: true } },
              },
            });
            if (activeSession) {
              throw new DuplicateClassroomSessionError(activeSession, duplicateAction === 'reuse');
            }
          }
          return createSession(tx);
        },
      })
      : await createSession(prisma);

    const sessionStartEventAt = newSession.startTime instanceof Date
      ? newSession.startTime.toISOString()
      : String(newSession.startTime ?? newSession.id);
    logClassroomEvent('session_start', {
      sessionId: newSession.id,
      actorUserId: user.id,
      planId,
      classId: classId ?? null,
      sourcePresetKey: typeof sourcePresetKey === 'string' ? sourcePresetKey : null,
      coursewarePublicationRevisionId: generatedBinding?.id ?? null,
      coursewareManifestHash: generatedBinding?.manifestHash ?? null,
      classroomEvent: buildClassroomLifecycleEvidenceFields({
        eventType: 'start-class',
        actorRole: 'teacher',
        sessionId: newSession.id,
        stepId: newSession.currentItemId ?? null,
        clientEventId: `classroom-session:${newSession.id}:start-class`,
        clientEventAt: sessionStartEventAt,
        sourceLogId: 'api-session-start',
      }),
    });

    return NextResponse.json({
      ...newSession,
      classroomIdentity: buildClassroomIdentityPayload(newSession),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof DuplicateClassroomSessionError) {
      const classroomIdentity = buildClassroomIdentityPayload(error.session);
      if (error.reuseExistingSession) {
        return NextResponse.json({
          ...error.session,
          classroomIdentity,
          reusedExistingSession: true,
        });
      }
      return NextResponse.json({
        error: '该班级和教案已有进行中的课堂，请选择进入已有课堂或确认新开课堂。',
        existingSessionId: error.session.id,
        requiresExplicitChoice: true,
        allowedActions: ['reuse', 'new-session'],
        classroomIdentity,
      }, { status: 409 });
    }
    if (error instanceof SessionClassBindingError) {
      if (error.code === 'class-not-found') {
        return NextResponse.json({ error: '班级不存在' }, { status: 404 });
      }
      if (error.code === 'class-not-active') {
        return NextResponse.json({ error: '班级未启用，请刷新后重新选择。' }, { status: 409 });
      }
      if (error.code === 'class-not-owned') {
        return NextResponse.json({ error: '无权在此班级开始课堂' }, { status: 403 });
      }
      return NextResponse.json({ error: '班级状态正在更新，请刷新后重试。' }, { status: 409 });
    }
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
