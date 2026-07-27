import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logClassroomEvent } from '@/lib/classroom-observability';
import type { ClassroomStateMutationInput } from '@/lib/classroom-analytics/types';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  buildClassroomIdentityPayload,
  buildClassroomLifecycleEvidenceFields,
  normalizeClassroomLifecycleClientEventAt,
} from '@/lib/classroom-lifecycle-contract';
import {
  canAccessClassroomSession,
  canManageClassroomSession,
  isClassroomTeacherOrAdmin,
  normalizeClassroomActorRole,
} from '@/lib/classroom-session-access';

export const dynamic = 'force-dynamic';

function toDateTime(value: number | string | null | undefined): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function resolveStateKey(itemId: string | null | undefined, explicitStateKey: string | null | undefined) {
  if (explicitStateKey && explicitStateKey.trim().length > 0) {
    return explicitStateKey;
  }

  if (itemId === 'teacher:course-sync') {
    return 'teacher-sync';
  }

  return 'course';
}

function resolveWriteStateKey(
  itemId: string | null | undefined,
  explicitStateKey: string | null | undefined,
  lifecycleEvent: { clientEventId: string } | null,
) {
  const baseStateKey = resolveStateKey(itemId, explicitStateKey);
  if (baseStateKey === 'teacher-sync' && lifecycleEvent) {
    return `classroom-event:${lifecycleEvent.clientEventId}`;
  }
  return baseStateKey;
}

function readLifecycleClientEventId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readLifecycleClientEventAt(value: unknown): number | string | null {
  return normalizeClassroomLifecycleClientEventAt(value);
}

function buildClassroomEvidenceWriteback() {
  return {
    mode: 'live-state-and-event-materialization',
    explanation:
      '本接口保存课堂运行态 StudentState；互动提交由 /api/interactive/events 写入 InteractionLog、StudentStepResponse 并实时物化 LearningFact，课堂结束后的 finalization 刷新教师复盘与学生证据页。',
    requiredEventFields: [
      'eventType',
      'actorRole',
      'sessionId',
      'stepId',
      'cardId',
      'clientEventId',
      'sourceLogId',
      'clientEventAt',
      'dedupeIdentity',
    ],
    dedupeRule: '具备 attemptKey、submissionIdentity、submissionId 或 attemptId 的课堂提交，会在互动事件入口按 userId、sessionId、lessonKey、stepId、cardId 和提交身份做应用层串行归并；cardId 是去重键的一部分，不能单独作为提交身份。重复提交不保留 raw InteractionLog，数据库级并发幂等仍未关闭。',
  };
}

function toStudentTeacherSyncRecord(state: {
  itemId: string | null;
  stateKey: string;
  lessonKey: string | null;
  submittedAt: Date;
  data: unknown;
}) {
  return {
    itemId: state.itemId,
    stateKey: state.stateKey,
    lessonKey: state.lessonKey,
    submittedAt: state.submittedAt,
    data: state.data,
  };
}

function appendLifecycleEvent(data: unknown, event: unknown | null): Prisma.InputJsonValue {
  if (!event || typeof data !== 'object' || data === null || Array.isArray(data)) {
    return data as Prisma.InputJsonValue;
  }
  return {
    ...(data as Record<string, unknown>),
    classroomEvent: event,
  } as Prisma.InputJsonValue;
}

/**
 * POST: 学生提交状态数据
 * GET: 教师获取所有学生状态（用于数据大屏）
 */

export async function POST(request: Request, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        profile: { select: { classId: true } },
      },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = (await request.json()) as ClassroomStateMutationInput;
    const { itemId, data, lessonKey } = body;
    const lastClientEventAt = toDateTime(body.clientEventAt);
    const actorRole = normalizeClassroomActorRole(user.role);
    const sessionRecord = await prisma.classSession.findUnique({
      where: { id: params.sessionId },
      select: { teacherId: true, classId: true },
    });
    if (!sessionRecord) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const accessUser = {
      id: user.id,
      role: user.role,
      profile: user.profile ?? session.user.profile ?? null,
    };
    if (!canAccessClassroomSession(sessionRecord, accessUser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const lifecycleClientEventId = readLifecycleClientEventId(body.clientEventId);
    const lifecycleClientEventAt = readLifecycleClientEventAt(body.clientEventAt);
    if (body.eventType && (!lifecycleClientEventId || lifecycleClientEventAt === null)) {
      return NextResponse.json({ error: 'Lifecycle event requires clientEventId and clientEventAt' }, { status: 400 });
    }

    let lifecycleEvent: ReturnType<typeof buildClassroomLifecycleEvidenceFields> | null = null;
    if (body.eventType && lifecycleClientEventId && lifecycleClientEventAt !== null) {
      lifecycleEvent = buildClassroomLifecycleEvidenceFields({
          eventType: body.eventType,
          actorRole,
          sessionId: params.sessionId,
          stepId: body.stepId ?? itemId ?? null,
          cardId: body.cardId ?? null,
          clientEventId: lifecycleClientEventId,
          sourceLogId: body.sourceLogId ?? null,
          clientEventAt: lifecycleClientEventAt,
        });
    }
    const stateKey = resolveWriteStateKey(itemId, body.stateKey, lifecycleEvent);
    const isTeacherSyncWrite = resolveStateKey(itemId, body.stateKey) === 'teacher-sync';

    if (!data) {
      return NextResponse.json({ error: 'Data is required' }, { status: 400 });
    }

    if (isTeacherSyncWrite && !isClassroomTeacherOrAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (isTeacherSyncWrite && !canManageClassroomSession(sessionRecord, accessUser)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Upsert: 更新或创建学生状态
    const studentState = await prisma.studentState.upsert({
      where: {
        sessionId_userId_stateKey: {
          sessionId: params.sessionId,
          userId: user.id,
          stateKey,
        }
      },
      update: {
        stateKey,
        lessonKey: lessonKey || null,
        itemId,
        data: appendLifecycleEvent(data, lifecycleEvent),
        submittedAt: new Date(),
        lastClientEventAt,
      },
      create: {
        sessionId: params.sessionId,
        userId: user.id,
        stateKey,
        lessonKey: lessonKey || null,
        itemId,
        data: appendLifecycleEvent(data, lifecycleEvent),
        lastClientEventAt,
      }
    });

    if (itemId === 'student:presence' || itemId === 'teacher:course-sync' || lifecycleEvent) {
      logClassroomEvent('session_state_post', {
        sessionId: params.sessionId,
        userId: user.id,
        itemId,
        lifecycleEvent,
      });
    }

    return NextResponse.json(studentState);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error submitting student state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const courseStateKey = 'course';
    const teacherStateKey = 'teacher-sync';

    if (scope === 'teacher-view') {
      if (!isClassroomTeacherOrAdmin(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const sessionRecord = await prisma.classSession.findUnique({
        where: { id: params.sessionId },
        select: {
          id: true,
          teacherId: true,
          joinCode: true,
          status: true,
          classId: true,
          currentItemId: true,
          currentStage: true,
          plan: { select: { title: true } },
          class: {
            select: {
              name: true,
              students: {
                select: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!sessionRecord) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      if (!canManageClassroomSession(sessionRecord, session.user)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const [courseStates, teacherStates] = await Promise.all([
        prisma.studentState.findMany({
          where: {
            sessionId: params.sessionId,
            stateKey: courseStateKey,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        }),
        prisma.studentState.findMany({
          where: {
            sessionId: params.sessionId,
            stateKey: teacherStateKey,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        }),
      ]);

      const latestUpdate =
        courseStates[0]?.submittedAt ||
        teacherStates[0]?.submittedAt ||
        null;
      const currentItemId = sessionRecord?.currentItemId ?? null;
      const expectedRoster = sessionRecord?.class?.students.map((student) => student.user) ?? [];
      const observedRoster = courseStates
        .map((state) => state.user)
        .filter((user): user is NonNullable<typeof user> => Boolean(user));
      const roster = expectedRoster.length > 0 ? expectedRoster : observedRoster;
      const submittedCurrentStep = currentItemId
        ? courseStates.filter((state) => state.itemId === currentItemId)
        : courseStates;
      const onlineUserIds = new Set(observedRoster.map((user) => user.id));
      const submittedUserIds = new Set(submittedCurrentStep.map((state) => state.userId));
      const notSubmitted = roster.filter((user) => !submittedUserIds.has(user.id));

      return NextResponse.json({
        states: courseStates,
        courseStates,
        teacherStates,
        classroom: {
          identity: sessionRecord ? buildClassroomIdentityPayload(sessionRecord) : null,
          currentStepId: currentItemId,
          currentStage: sessionRecord?.currentStage ?? null,
          status: sessionRecord?.status ?? null,
        },
        presence: {
          roster: roster.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            online: onlineUserIds.has(user.id),
            submitted: submittedUserIds.has(user.id),
          })),
          onlineCount: onlineUserIds.size,
          expectedCount: roster.length,
          latestUpdate,
        },
        delivery: {
          releasedStepId: currentItemId,
          submittedCount: submittedUserIds.size,
          inProgressCount: Math.max(onlineUserIds.size - submittedUserIds.size, 0),
          notStartedCount: Math.max(roster.length - onlineUserIds.size, 0),
          notSubmitted,
          latestUpdate,
        },
        evidenceWriteback: buildClassroomEvidenceWriteback(),
        summary: {
          totalStudents: courseStates.length,
          latestUpdate,
        },
      });
    }

    if (scope === 'self') {
      const sessionRecord = await prisma.classSession.findUnique({
        where: { id: params.sessionId },
        select: { teacherId: true, classId: true },
      });
      if (!sessionRecord) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      if (!canAccessClassroomSession(sessionRecord, session.user)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const state = await prisma.studentState.findUnique({
        where: {
          sessionId_userId_stateKey: {
            sessionId: params.sessionId,
            userId: session.user.id,
            stateKey: courseStateKey,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json({
        states: state ? [state] : [],
        courseStates: state ? [state] : [],
        teacherStates: [],
        evidenceWriteback: buildClassroomEvidenceWriteback(),
        summary: {
          totalStudents: state ? 1 : 0,
          latestUpdate: state?.submittedAt || null,
        },
      });
    }

    if (scope === 'student-view') {
      const sessionRecord = await prisma.classSession.findUnique({
        where: { id: params.sessionId },
        select: { teacherId: true, classId: true },
      });
      if (!sessionRecord) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      if (!canAccessClassroomSession(sessionRecord, session.user)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const [selfState, teacherSyncState] = await Promise.all([
        prisma.studentState.findUnique({
          where: {
            sessionId_userId_stateKey: {
              sessionId: params.sessionId,
              userId: session.user.id,
              stateKey: courseStateKey,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        prisma.studentState.findFirst({
          where: {
            sessionId: params.sessionId,
            stateKey: teacherStateKey,
            itemId: 'teacher:course-sync',
          },
          orderBy: { submittedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
      ]);

      const studentTeacherSyncState = teacherSyncState ? toStudentTeacherSyncRecord(teacherSyncState) : null;
      const states = [studentTeacherSyncState, selfState].filter(Boolean);

      return NextResponse.json({
        states,
        courseStates: selfState ? [selfState] : [],
        teacherStates: studentTeacherSyncState ? [studentTeacherSyncState] : [],
        evidenceWriteback: buildClassroomEvidenceWriteback(),
        summary: {
          latestUpdate: teacherSyncState?.submittedAt || selfState?.submittedAt || null,
        },
      });
    }

    // 获取所有学生状态
    if (!isClassroomTeacherOrAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sessionRecord = await prisma.classSession.findUnique({
      where: { id: params.sessionId },
      select: { teacherId: true, classId: true },
    });
    if (!sessionRecord) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (!canManageClassroomSession(sessionRecord, session.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [states, teacherStates] = await Promise.all([
      prisma.studentState.findMany({
        where: {
          sessionId: params.sessionId,
          stateKey: courseStateKey,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { submittedAt: 'desc' }
      }),
      prisma.studentState.findMany({
        where: {
          sessionId: params.sessionId,
          stateKey: teacherStateKey,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { submittedAt: 'desc' }
      }),
    ]);

    // 计算统计信息
    const summary = {
      totalStudents: states.length,
      latestUpdate: states[0]?.submittedAt || teacherStates[0]?.submittedAt || null
    };

    return NextResponse.json({
      states,
      courseStates: states,
      teacherStates,
      evidenceWriteback: buildClassroomEvidenceWriteback(),
      summary,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error fetching student states:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
