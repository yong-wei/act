import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis-client';
import {
  CLASSROOM_STREAM_HEARTBEAT_MS,
  CLASSROOM_STREAM_POLL_MS,
  selectClassroomStreamBackend,
} from '../application/stream-policy';

export function openClassroomSessionStreamAdapter(
  request: Request,
  classSession: {
    id: string;
    currentItemId: string | null;
    currentStage: string | null;
    status: string;
    updatedAt: Date | null;
  },
) {
  const encoder = new TextEncoder();
  let isClosed = false;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  const sessionId = classSession.id;

  const stream = new ReadableStream({
    start: async (controller) => {
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
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialState)}\n\n`));

      if (selectClassroomStreamBackend(redisClient.isReady()) === 'redis') {
        const redis = redisClient.getClient();
        if (redis) {
          const subscriber = redis.duplicate();
          await subscriber.connect();
          const channel = `channel:session:${sessionId}`;
          await subscriber.subscribe(channel, (message) => {
            if (!isClosed && typeof message === 'string') {
              try {
                const parsed = JSON.parse(message);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
              } catch {
                controller.enqueue(encoder.encode(`data: ${message}\n\n`));
              }
            }
          });
          const cleanup = () => {
            isClosed = true;
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            subscriber.unsubscribe(channel).catch(() => {});
            subscriber.quit().catch(() => {});
          };
          heartbeatInterval = setInterval(() => {
            if (!isClosed) controller.enqueue(encoder.encode(':heartbeat\n\n'));
          }, CLASSROOM_STREAM_HEARTBEAT_MS);
          request.signal.addEventListener('abort', cleanup);
          return;
        }
      }

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
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'update',
              data: {
                currentItemId: latest.currentItemId,
                currentStage: latest.currentStage,
                status: latest.status,
                updatedAt: latest.updatedAt?.getTime() || Date.now(),
              },
              timestamp: Date.now(),
            })}\n\n`));
          }
        } catch (error) {
          console.error('[SSE] Poll error:', error);
        }
      }, CLASSROOM_STREAM_POLL_MS);
      request.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(pollInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
      });
    },
    cancel() {
      isClosed = true;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
