import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { eventQueue } from '@/lib/event-queue';
import { eventRateLimiter } from '@/lib/rate-limiter';
import type { ClassroomInteractionEventInput } from '@/lib/classroom-analytics/types';
import { toLearningEvent, validateEvent, type LearningEvent } from '@/lib/data-governance/event-protocol';
import { routeEvent } from '@/lib/data-governance/event-buffer';
import { isCoreEvent } from '@/lib/data-governance/event-types';
import type { PageType } from '@/lib/data-governance/event-protocol';

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

/**
 * 验证 resourceId 是否合法
 * - 合法的resourceId必须是cuid格式（25个字符，以c开头）或null/undefined
 * - 返回null表示不合法，应该丢弃或降级处理
 */
function validateResourceId(resourceId: string | null | undefined): string | null {
  if (!resourceId) return null;

  // CUID格式校验: 以c开头，后跟24个字母数字字符，共25字符
  const cuidRegex = /^c[\w]{24}$/;
  if (cuidRegex.test(resourceId)) {
    return resourceId;
  }

  // 其他可能的合法格式（如特定的key格式）
  // resourceKey通常使用下划线分隔的格式，不是CUID
  return null;
}

/**
 * 降级日志 - 记录不合法的事件到控制台，不入库
 * 用于排查前端问题，避免数据库外键错误
 */
function logDegradedEvent(
  userId: string,
  event: ClassroomInteractionEventInput,
  reason: string
): void {
  console.warn('[InteractionLog Degraded]', {
    userId,
    reason,
    eventType: event.type,
    resourceId: event.resourceId,
    resourceKey: event.resourceKey,
    timestamp: event.timestamp,
  });
}

/**
 * POST /api/interactive/events
 *
 * 批量记录互动事件
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 限流检查：防止事件上报过载
    const clientId = session.user.id;
    const limitCheck = eventRateLimiter.check(clientId);

    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: limitCheck.retryAfter },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { events } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Events array is required' }, { status: 400 });
    }

    // 验证并过滤事件
    const validEvents: Array<{ event: ClassroomInteractionEventInput; resourceId: string | null }> = [];
    const degradedEvents: Array<{ event: ClassroomInteractionEventInput; reason: string }> = [];

    for (const event of events as ClassroomInteractionEventInput[]) {
      // 基础校验
      if (!event.type || typeof event.timestamp !== 'number') {
        degradedEvents.push({ event, reason: 'missing_type_or_timestamp' });
        continue;
      }

      if (!event.resourceKey && !event.resourceId) {
        degradedEvents.push({ event, reason: 'missing_resource_key_and_id' });
        continue;
      }

      // 校验resourceId - 不合法的ID会导致外键错误
      const validatedResourceId = validateResourceId(event.resourceId);

      if (event.resourceId && !validatedResourceId) {
        // resourceId存在但不合法 - 降级处理，只记录到控制台
        logDegradedEvent(session.user.id, event, 'invalid_resource_id_format');
        // 如果resourceKey存在，仍尝试记录（resourceKey是字符串，不会触发外键错误）
        if (event.resourceKey) {
          validEvents.push({ event, resourceId: null });
        } else {
          degradedEvents.push({ event, reason: 'invalid_resource_id_no_fallback' });
        }
        continue;
      }

      validEvents.push({ event, resourceId: validatedResourceId });
    }

    // 记录降级事件（不入库，避免外键错误）
    for (const { event, reason } of degradedEvents) {
      logDegradedEvent(session.user.id, event, reason);
    }

    // Route events based on priority
    const coreEvents: LearningEvent[] = [];
    const routingResults: Array<{ eventType: string; destination: string; reason?: string }> = [];

    for (const eventData of validEvents) {
      const learningEvent = toLearningEvent(
        { ...eventData.event, priority: isCoreEvent(eventData.event.type) ? 'core' : 'secondary' },
        {
          userId: session.user.id,
          role: (session.user.role?.toLowerCase() as 'student' | 'teacher' | 'admin') || 'student',
          pagePath: '/unknown',
          pageType: 'dashboard',
        }
      );

      const result = await routeEvent(learningEvent);
      routingResults.push({ eventType: learningEvent.actionType, ...result });

      // Core events still go through existing EventQueue for now
      if (result.destination === 'postgresql') {
        coreEvents.push(learningEvent);
      }
    }

    // Existing queue for core events (will be migrated later)
    if (coreEvents.length > 0) {
      const queueEvents = coreEvents.map(event => ({
        userId: event.userId,
        resourceId: null as string | null,
        resourceKey: event.moduleId || event.actionType,
        sessionId: event.sessionId || null,
        lessonKey: event.lessonId || null,
        stepId: event.targetId || null,
        actorRole: event.role,
        attemptKey: null as string | null,
        eventType: event.actionType,
        eventData: event.payload,
        clientEventAt: new Date(event.occurredAt),
      }));

      eventQueue.enqueueBatch(queueEvents);
    }

    // Update response
    return NextResponse.json({
      success: true,
      count: validEvents.length,
      degraded: degradedEvents.length,
      routing: routingResults.reduce((acc, r) => {
        acc[r.destination] = (acc[r.destination] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      pending: eventQueue.getStats().pending,
    });
  } catch (error) {
    console.error('[Interactive Events API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/interactive/events
 *
 * 查询资源的互动事件（教师端）
 *
 * Query params:
   * - resourceId: 资源 ID（可选）
   * - resourceKey: 资源逻辑标识（可选，推荐）
 * - sessionId: 课堂会话 ID（可选）
 * - userId: 用户 ID（可选）
 * - eventType: 事件类型（可选）
 * - limit: 返回数量（默认 100）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 只有教师和管理员可以查询所有用户的事件
    const isTeacherOrAdmin = session.user.role === 'TEACHER' || session.user.role === 'ADMIN';

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId');
    const resourceKey = searchParams.get('resourceKey');
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');
    const eventType = searchParams.get('eventType');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!resourceId && !resourceKey) {
      return NextResponse.json({ error: 'resourceId or resourceKey is required' }, { status: 400 });
    }

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (resourceKey) {
      where.resourceKey = resourceKey;
    }

    if (sessionId) {
      where.sessionId = sessionId;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    // 非教师/管理员只能查看自己的事件
    if (!isTeacherOrAdmin) {
      where.userId = session.user.id;
    } else if (userId) {
      where.userId = userId;
    }

    // 查询事件
    const events = await prisma.interactionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
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

    // 聚合统计
    const stats = await prisma.interactionLog.groupBy({
      by: ['eventType'],
      where,
      _count: { id: true },
    });

    const statsMap = Object.fromEntries(
      stats.map((s) => [s.eventType, s._count.id])
    );

    return NextResponse.json({
      events,
      stats: {
        total: events.length,
        byType: statsMap,
      },
    });
  } catch (error) {
    console.error('[Interactive Events API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
