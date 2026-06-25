
import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateUniqueJoinCode } from '@/lib/join-code';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { EMPTY_LESSON_PLAN_MESSAGE } from '@/lib/lesson-plan-readiness';
import { loadSessionLessonSnapshot } from '@/lib/session-lesson-snapshot';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons';
import {
  buildClassroomIdentityPayload,
  buildClassroomLifecycleEvidenceFields,
} from '@/lib/classroom-lifecycle-contract';
import { logClassroomEvent } from '@/lib/classroom-observability';

export const dynamic = 'force-dynamic';

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
    const { planId, classId, duplicateAction, sourcePresetKey } = body;

    if (!planId && sourcePresetKey && !classId && duplicateAction !== 'new-session') {
      const preset = ALL_PRESETS.find((item) => item.key === sourcePresetKey);
      if (!preset) {
        return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
      }
      const activeSession = await prisma.classSession.findFirst({
        where: {
          teacherId: user.id,
          classId: null,
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
          error: '该教案已有进行中的临时课堂，请选择进入已有课堂或确认新开课堂。',
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

    let classData: { id: string; teacherId: string; name: string } | null = null;

    if (classId) {
      // 验证班级存在且属于当前教师
      classData = await prisma.class.findUnique({
        where: { id: classId },
        select: { id: true, teacherId: true, name: true }
      });

      if (!classData) {
        return NextResponse.json({ error: '班级不存在' }, { status: 404 });
      }

      if (classData.teacherId !== user.id && user.role !== 'ADMIN') {
        return NextResponse.json({ error: '无权在此班级开始课堂' }, { status: 403 });
      }

    }

    const plan = await prisma.lessonPlan.findUnique({
      where: { id: planId },
      select: {
        title: true,
        authorId: true,
        isPublic: true,
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

    if (duplicateAction !== 'new-session') {
      const activeSession = await prisma.classSession.findFirst({
        where: {
          teacherId: user.id,
          classId: classId || null,
          status: 'ACTIVE',
          ...(sourcePresetKey && !classId
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
    const lessonSnapshot = loadSessionLessonSnapshot(plan.title);

    const newSession = await prisma.classSession.create({
      data: {
        joinCode,
        planId,
        teacherId: user.id,
        ...(classId ? { classId } : {}),
        status: 'ACTIVE',
        currentStage: 'BRIDGE_IN',
        currentItemId: undefined,
        lessonVersion: lessonSnapshot.lessonVersion,
        manifestHash: lessonSnapshot.manifestHash,
        totalSteps: lessonSnapshot.totalSteps
      },
      include: {
        plan: { select: { title: true } },
        class: { select: { name: true } }
      }
    });

    const sessionStartEventAt = newSession.startTime instanceof Date
      ? newSession.startTime.toISOString()
      : String(newSession.startTime ?? newSession.id);
    logClassroomEvent('session_start', {
      sessionId: newSession.id,
      actorUserId: user.id,
      planId,
      classId: classId ?? null,
      sourcePresetKey: typeof sourcePresetKey === 'string' ? sourcePresetKey : null,
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
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
