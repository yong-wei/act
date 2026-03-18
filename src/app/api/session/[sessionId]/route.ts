import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SessionStatus, BopppsStage } from '@prisma/client';
import { logClassroomEvent } from '@/lib/classroom-observability';
import { redisClient } from '@/lib/redis-client';
import { classroomRateLimiter } from '@/lib/rate-limiter';

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

    const updatedSession = await prisma.classSession.update({
      where: { id: sessionId },
      data: updateData
    });

    // 同步到 Redis 用于快速读取和 SSE 广播
    if (redisClient.isReady()) {
      const redisState = {
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

    return NextResponse.json(updatedSession);
  } catch (error) {
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
                // 获取课程标题（不经常变化，可以从缓存读取或简单查询）
                const planTitle = await prisma.classSession.findUnique({
                    where: { id: sessionId },
                    select: { plan: { select: { title: true } } }
                });

                return NextResponse.json({
                    id: sessionId,
                    currentItemId: cachedState.currentItemId ?? null,
                    currentStage: cachedState.currentStage ?? null,
                    status: cachedState.status ?? 'ACTIVE',
                    updatedAt: cachedState.updatedAt ?? Date.now(),
                    planTitle: planTitle?.plan?.title ?? '',
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
                currentItemId: session.currentItemId,
                currentStage: session.currentStage,
                status: session.status,
                updatedAt: session.updatedAt?.getTime() || Date.now(),
            });
        }

        return NextResponse.json({
            ...session,
            planTitle: session.plan.title,
        });
    } catch (error) {
        console.error('[Session GET] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
