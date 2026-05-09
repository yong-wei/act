import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  resolveSessionClassContext,
  shouldPersistInferredClassAttribution,
  type SessionClassInfo,
} from '@/lib/data-governance/class-session-attribution';
import {
  enqueueSessionFinalizationEventIngestion,
  enqueueSessionFinalizationSnapshots,
} from '@/lib/data-governance/session-finalization-snapshots';
import { generateSessionSummaryReports } from '@/lib/data-governance/session-reports';
import { SessionStatus, BopppsStage } from '@prisma/client';
import { logClassroomEvent } from '@/lib/classroom-observability';
import { redisClient } from '@/lib/redis-client';
import { classroomRateLimiter } from '@/lib/rate-limiter';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

async function inferAndPersistSessionClass(sessionId: string, teacherId: string) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      classId: true,
      studentStates: {
        select: {
          user: {
            select: {
              profile: {
                select: {
                  classId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session || session.classId) {
    return session?.classId ?? null;
  }

  const participantClassIds = session.studentStates.map((state) => state.user.profile?.classId);
  const classIds = Array.from(
    new Set(
      participantClassIds.filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  );
  const classes = classIds.length
    ? await prisma.class.findMany({
        where: { id: { in: classIds } },
        select: {
          id: true,
          name: true,
          code: true,
          teacherId: true,
        },
      })
    : [];
  const classesById = new Map<string, SessionClassInfo>(
    classes.map((item) => [item.id, { id: item.id, name: item.name, code: item.code }]),
  );
  const classTeacherById = new Map(classes.map((item) => [item.id, item.teacherId]));
  const context = resolveSessionClassContext({
    sessionClassId: null,
    sessionClass: null,
    participantClassIds,
    classesById,
  });

  if (
    !context.classId
    || classTeacherById.get(context.classId) !== teacherId
    || !shouldPersistInferredClassAttribution({ attribution: context.attribution })
  ) {
    return null;
  }

  const updated = await prisma.classSession.updateMany({
    where: {
      id: sessionId,
      classId: null,
    },
    data: {
      classId: context.classId,
    },
  });

  return updated.count > 0 ? context.classId : null;
}

async function generateSessionSummaryReportsSafely(sessionId: string) {
  try {
    return await generateSessionSummaryReports(prisma, sessionId);
  } catch (error) {
    console.error('[SessionReports] Failed to generate session reports:', error);
    return { classReports: 0, studentReports: 0, skipped: true };
  }
}

export async function PATCH(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 限流检查：防止请求风暴
    const clientId = session.user.id;
    const limitCheck = classroomRateLimiter.check(clientId);

    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: limitCheck.retryAfter },
        { status: 429 }
      );
    }

    const { sessionId } = params;

    // 验证课堂存在且属于当前教师
    const existingSession = await prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { teacherId: true, status: true }
    });

    if (!existingSession) {
      return NextResponse.json({ error: '课堂不存在' }, { status: 404 });
    }

    if (existingSession.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限修改此课堂' }, { status: 403 });
    }

    const body = await request.json();
    const { currentItemId, currentStage, status } = body;

    // 构建更新数据 - 始终更新updatedAt以触发版本号递增
    const updateData: {
      currentItemId?: string;
      currentStage?: BopppsStage | null;
      status?: SessionStatus;
      endTime?: Date;
      updatedAt?: Date;
    } = {
      updatedAt: new Date(), // 强制更新时间戳作为版本控制依据
    };

    if (currentItemId !== undefined) updateData.currentItemId = currentItemId;
    if (currentStage !== undefined) {
      // 验证阶段值是否有效
      if (currentStage !== null && !Object.values(BopppsStage).includes(currentStage as BopppsStage)) {
        return NextResponse.json({ error: 'Invalid stage value' }, { status: 400 });
      }
      updateData.currentStage = currentStage as BopppsStage | null;
    }
    if (status !== undefined) {
      // 验证状态值是否有效
      if (!Object.values(SessionStatus).includes(status as SessionStatus)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      updateData.status = status as SessionStatus;
      // 当状态变为 FINISHED 时，自动设置结束时间
      if (status === 'FINISHED') {
        updateData.endTime = new Date();
      }
    }

    let updatedSession = await prisma.classSession.update({
      where: { id: sessionId },
      data: updateData
    });

    if (status === 'FINISHED' && !updatedSession.classId) {
      const inferredClassId = await inferAndPersistSessionClass(sessionId, updatedSession.teacherId);
      if (inferredClassId) {
        updatedSession = {
          ...updatedSession,
          classId: inferredClassId,
        };
      }
    }

    // 同步到 Redis 用于快速读取和 SSE 广播
    if (redisClient.isReady()) {
      const redisState = {
        classId: updatedSession.classId,
        currentItemId: updatedSession.currentItemId,
        currentStage: updatedSession.currentStage,
        status: updatedSession.status,
        updatedAt: updatedSession.updatedAt?.getTime() || Date.now(),
      };

      // 写入 Redis
      await redisClient.setSessionState(sessionId, redisState);

      // 发布状态变更通知
      await redisClient.publishStateChange(sessionId, {
        type: 'update',
        data: redisState,
        timestamp: Date.now(),
      });
    }

    if (currentItemId !== undefined || status !== undefined) {
      logClassroomEvent('session_patch', {
        sessionId,
        actorUserId: session.user.id,
        currentItemId: currentItemId ?? null,
        currentStage: currentStage ?? null,
        status: status ?? null,
      });
    }

    if (status === 'FINISHED') {
      await Promise.all([
        enqueueSessionFinalizationEventIngestion(sessionId),
        enqueueSessionFinalizationSnapshots(sessionId, updatedSession.classId),
        generateSessionSummaryReportsSafely(sessionId),
      ]);
    }

    return NextResponse.json(updatedSession);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: { sessionId: string } }) {
    try {
        const { sessionId } = params;

        // 优先从 Redis 读取会话状态（高性能缓存）
        if (redisClient.isReady()) {
            const cachedState = await redisClient.getSessionState(sessionId);
            if (cachedState) {
                return NextResponse.json({
                    id: sessionId,
                    joinCode: typeof cachedState.joinCode === 'string' ? cachedState.joinCode : '',
                    classId: typeof cachedState.classId === 'string' ? cachedState.classId : null,
                    currentItemId: cachedState.currentItemId ?? null,
                    currentStage: cachedState.currentStage ?? null,
                    status: cachedState.status ?? 'ACTIVE',
                    updatedAt: cachedState.updatedAt ?? Date.now(),
                    planTitle: typeof cachedState.planTitle === 'string' ? cachedState.planTitle : '',
                });
            }
        }

        // 回退到数据库查询
        const session = await prisma.classSession.findUnique({
            where: { id: sessionId },
            select: {
                id: true,
                joinCode: true,
                status: true,
                classId: true,
                currentItemId: true,
                currentStage: true,
                updatedAt: true, // 添加updatedAt用于前端版本控制
                // Include minimal plan info for student check
                plan: {
                    select: { title: true }
                }
            }
        });

        if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // 写入 Redis 缓存以便后续快速读取
        if (redisClient.isReady()) {
            await redisClient.setSessionState(sessionId, {
                joinCode: session.joinCode,
                classId: session.classId,
                currentItemId: session.currentItemId,
                currentStage: session.currentStage,
                status: session.status,
                planTitle: session.plan.title,
                updatedAt: session.updatedAt?.getTime() || Date.now(),
            });
        }

        return NextResponse.json({
            ...session,
            planTitle: session.plan.title,
        });
    } catch (error) {
        rethrowIfNextDynamicError(error);
        console.error('[Session GET] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
