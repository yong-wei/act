import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis-client';
import { classroomRateLimiter } from '@/lib/rate-limiter';

/**
 * SSE 流端点
 *
 * 学生端订阅此端点接收课堂状态实时更新
 * - 替代轮询，延迟 < 200ms
 * - 自动重连支持
 * - 心跳保活
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // SSE端点限流：更宽松的限制（60请求/分钟，无封禁）
    const clientId = `sse:${session.user.id}`;
    const limitCheck = classroomRateLimiter.check(clientId, {
      windowMs: 60000,    // 1分钟
      maxRequests: 60,    // 60请求/分钟
      blockDuration: 0,   // SSE连接不封禁，只限流
    });

    if (!limitCheck.allowed) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    const { sessionId } = params;

    // 验证会话存在且用户有权限访问
    const classSession = await prisma.classSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        currentItemId: true,
        currentStage: true,
        updatedAt: true,
        teacherId: true,
        classId: true,
      },
    });

    if (!classSession) {
      return new Response('Session not found', { status: 404 });
    }

    // 学生只能访问自己班级的会话
    const isTeacher = classSession.teacherId === session.user.id;
    if (!isTeacher && classSession.classId) {
      const userProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { classId: true },
      });

      if (userProfile?.classId !== classSession.classId) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    // 创建 SSE 流
    const encoder = new TextEncoder();
    let isClosed = false;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const stream = new ReadableStream({
      start: async (controller) => {
        // 发送初始状态
        const initialState = {
          type: 'initial',
          data: {
            sessionId: classSession.id,
            currentItemId: classSession.currentItemId,
            currentStage: classSession.currentStage,
            status: classSession.status,
            updatedAt: classSession.updatedAt?.getTime() || Date.now(),
          },
          timestamp: Date.now(),
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initialState)}\n\n`)
        );

        // 尝试从 Redis 订阅更新
        if (redisClient.isReady()) {
          const redis = redisClient.getClient();
          if (redis) {
            const subscriber = redis.duplicate();
            await subscriber.connect();

            const channel = `channel:session:${sessionId}`;
            await subscriber.subscribe(channel, (message) => {
              if (!isClosed && typeof message === 'string') {
                try {
                  const parsed = JSON.parse(message);
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`)
                  );
                } catch {
                  controller.enqueue(
                    encoder.encode(`data: ${message}\n\n`)
                  );
                }
              }
            });

            // 清理函数
            const cleanup = () => {
              isClosed = true;
              if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
              }
              subscriber.unsubscribe(channel).catch(() => {});
              subscriber.quit().catch(() => {});
            };

            // 心跳保活
            heartbeatInterval = setInterval(() => {
              if (!isClosed) {
                controller.enqueue(encoder.encode(':heartbeat\n\n'));
              }
            }, 15000);

            // 客户端断开时清理
            request.signal.addEventListener('abort', cleanup);
          }
        } else {
          // Redis 不可用时，使用轮询降级
          const pollInterval = setInterval(async () => {
            if (isClosed) {
              clearInterval(pollInterval);
              return;
            }

            try {
              const latest = await prisma.classSession.findUnique({
                where: { id: sessionId },
                select: {
                  currentItemId: true,
                  currentStage: true,
                  status: true,
                  updatedAt: true,
                },
              });

              if (latest) {
                const update = {
                  type: 'update',
                  data: {
                    currentItemId: latest.currentItemId,
                    currentStage: latest.currentStage,
                    status: latest.status,
                    updatedAt: latest.updatedAt?.getTime() || Date.now(),
                  },
                  timestamp: Date.now(),
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(update)}\n\n`)
                );
              }
            } catch (error) {
              console.error('[SSE] Poll error:', error);
            }
          }, 2000);

          // 清理函数
          request.signal.addEventListener('abort', () => {
            isClosed = true;
            clearInterval(pollInterval);
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
            }
          });
        }
      },

      cancel() {
        isClosed = true;
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[SSE] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
