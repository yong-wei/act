import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { eventRateLimiter } from '@/lib/rate-limiter';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import type { ClassroomInteractionEventInput } from '@/lib/classroom-analytics/types';
import { toLearningEvent } from '@/lib/data-governance/event-protocol';
import { routeEvent } from '@/lib/data-governance/event-buffer';
import { isCoreEvent } from '@/lib/data-governance/event-types';
import { resolveCanonicalEventType } from '@/lib/data-governance/event-normalization';
import { persistCoreLearningFact } from '@/lib/data-governance/learning-fact-materialization';
import { generateSessionSummaryReports } from '@/lib/data-governance/session-reports';
import {
  attachSourceLogIds,
  normalizeInteractionContexts,
  resolveClientEventId,
} from '@/lib/data-governance/interactive-event-ingestion';
import type { NormalizedInteractionEvent } from '@/lib/data-governance/interactive-event-ingestion';
import type { PageType } from '@/lib/data-governance/event-protocol';

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

function resolvePagePath(payload: Record<string, unknown>) {
  return typeof payload.originPath === 'string' && payload.originPath.trim().length > 0
    ? payload.originPath
    : '/unknown';
}

function resolvePageType(payload: Record<string, unknown>): PageType {
  const pageType = typeof payload.pageType === 'string' ? payload.pageType : null;
  if (
    pageType === 'theory'
    || pageType === 'practice'
    || pageType === 'workspace'
    || pageType === 'quiz'
    || pageType === 'reflection'
    || pageType === 'simulation'
    || pageType === 'resource'
    || pageType === 'knowledge'
    || pageType === 'dashboard'
    || pageType === 'classroom'
  ) {
    return pageType;
  }
  return 'dashboard';
}

function readJsonString(payload: Prisma.JsonValue, key: string): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readPayloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildStudentStepResponseRows(
  events: NormalizedInteractionEvent[],
  userId: string,
): Prisma.StudentStepResponseCreateManyInput[] {
  const rows: Prisma.StudentStepResponseCreateManyInput[] = [];

  for (const eventData of events) {
    const payload =
      eventData.event.data && typeof eventData.event.data === 'object'
        ? eventData.event.data
        : {};
    const canonicalEventType = resolveCanonicalEventType(eventData.event.type, payload);

    if (canonicalEventType !== 'lesson_submit' && canonicalEventType !== 'lesson_resubmit') {
      continue;
    }

    const sessionId = eventData.sessionId;
    const stepId = eventData.event.stepId ?? readPayloadString(payload, 'stepId');
    const sourceLogId = readPayloadString(payload, 'sourceLogId');
    const submittedAt = toDateTime(eventData.event.clientEventAt ?? eventData.event.timestamp);

    if (!sessionId || !stepId || !sourceLogId || !submittedAt) {
      continue;
    }

    const clientEventId = resolveClientEventId(eventData.event);

    rows.push({
      userId,
      sessionId,
      lessonKey: eventData.event.lessonKey ?? null,
      stepId,
      attemptKey: eventData.event.attemptKey ?? readPayloadString(payload, 'attemptKey'),
      sourceLogId,
      clientEventId,
      submittedAt,
      responseData: {
        ...payload,
        eventType: canonicalEventType,
        resourceKey: eventData.event.resourceKey,
        lessonKey: eventData.event.lessonKey ?? null,
        stepId,
        attemptKey: eventData.event.attemptKey ?? readPayloadString(payload, 'attemptKey'),
        clientEventId,
        learningContext: eventData.learningContext,
      },
    });
  }

  return rows;
}

async function loadSessionEndMetadata(
  events: Array<{ event: ClassroomInteractionEventInput; resourceId: string | null }>,
) {
  const sessionIds = Array.from(
    new Set(
      events
        .map(({ event }) => event.sessionId)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    ),
  );

  if (sessionIds.length === 0) {
    return new Map();
  }

  const sessions = await prisma.classSession.findMany({
    where: { id: { in: sessionIds } },
    select: {
      id: true,
      status: true,
      endTime: true,
    },
  });

  return new Map(
    sessions.map((item) => [
      item.id,
      {
        status: item.status,
        endTime: item.endTime,
      },
    ]),
  );
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
      const resolvedResourceKey = event.resourceKey ?? event.resourceId;
      const normalizedEvent: ClassroomInteractionEventInput = {
        ...event,
        resourceKey: event.resourceKey || event.resourceId || '',
      };

      // 基础校验
      if (!normalizedEvent.type || typeof normalizedEvent.timestamp !== 'number') {
        degradedEvents.push({ event: normalizedEvent, reason: 'missing_type_or_timestamp' });
        continue;
      }

      if (!resolvedResourceKey && !normalizedEvent.resourceId) {
        degradedEvents.push({ event: normalizedEvent, reason: 'missing_resource_key_and_id' });
        continue;
      }

      // 校验resourceId - 不合法的ID会导致外键错误
      const validatedResourceId = validateResourceId(normalizedEvent.resourceId);

      if (normalizedEvent.resourceId && !validatedResourceId) {
        // resourceId存在但不合法 - 降级处理，只记录到控制台
        logDegradedEvent(session.user.id, normalizedEvent, 'invalid_resource_id_format');
        // 如果resourceKey存在，仍尝试记录（resourceKey是字符串，不会触发外键错误）
        if (normalizedEvent.resourceKey) {
          validEvents.push({ event: normalizedEvent, resourceId: null });
        } else {
          degradedEvents.push({ event: normalizedEvent, reason: 'invalid_resource_id_no_fallback' });
        }
        continue;
      }

      validEvents.push({ event: normalizedEvent, resourceId: validatedResourceId });
    }

    // 记录降级事件（不入库，避免外键错误）
    for (const { event, reason } of degradedEvents) {
      logDegradedEvent(session.user.id, event, reason);
    }

    const sessionEndById = await loadSessionEndMetadata(validEvents);
    const enrichedValidEvents = normalizeInteractionContexts(validEvents, sessionEndById);
    const clientEventIds = Array.from(
      new Set(
        enrichedValidEvents
          .map((item) => item.clientEventId)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    );
    const existingLogs = clientEventIds.length > 0
      ? await prisma.interactionLog.findMany({
        where: {
          userId: session.user.id,
          clientEventId: { in: clientEventIds },
        },
        select: {
          clientEventId: true,
        },
      })
      : [];
    const persistedClientEventIds = new Set(
      existingLogs
        .map((log) => log.clientEventId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    );
    const seenClientEventIds = new Set<string>();
    let duplicateEvents = 0;
    const dedupedEvents = enrichedValidEvents.filter((item) => {
      if (!item.clientEventId) {
        return true;
      }
      if (persistedClientEventIds.has(item.clientEventId) || seenClientEventIds.has(item.clientEventId)) {
        duplicateEvents += 1;
        return false;
      }
      seenClientEventIds.add(item.clientEventId);
      return true;
    });

    // Persist valid events before materializing facts so governance facts can
    // retain a direct InteractionLog sourceLogId.
    const interactionLogEvents = dedupedEvents.map((item) => {
      const { sourceLogId: _untrustedSourceLogId, ...eventData } = item.event.data ?? {};
      return {
        userId: session.user.id,
        resourceId: item.resourceId,
        resourceKey: item.event.resourceKey,
        sessionId: item.sessionId,
        lessonKey: item.event.lessonKey ?? null,
        stepId: item.event.stepId ?? null,
        actorRole: item.event.actorRole ?? null,
        attemptKey: item.event.attemptKey ?? null,
        eventType: item.event.type,
        clientEventId: item.clientEventId,
        learningContext: item.learningContext,
        invalidContextReason: item.invalidContextReason,
        eventData,
        clientEventAt: toDateTime(item.event.clientEventAt ?? item.event.timestamp),
      };
    });

    const persistedLogs = interactionLogEvents.length > 0
      ? await prisma.interactionLog.createManyAndReturn({
        data: interactionLogEvents.map((event) => ({
          userId: event.userId,
          resourceId: event.resourceId,
          resourceKey: event.resourceKey,
          sessionId: event.sessionId,
          lessonKey: event.lessonKey,
          stepId: event.stepId,
          actorRole: event.actorRole,
          attemptKey: event.attemptKey,
          eventType: event.eventType,
          clientEventId: event.clientEventId,
          learningContext: event.learningContext,
          invalidContextReason: event.invalidContextReason,
          eventData: event.eventData as Prisma.InputJsonValue,
          clientEventAt: event.clientEventAt,
        })),
        skipDuplicates: true,
        select: {
          id: true,
          clientEventId: true,
          eventData: true,
        },
      })
      : [];

    const sourceLinkedEvents = attachSourceLogIds(
      dedupedEvents,
      persistedLogs.map((log) => ({
        id: log.id,
        clientEventId: log.clientEventId ?? readJsonString(log.eventData, 'clientEventId'),
      })),
    );

    const studentStepResponseRows = buildStudentStepResponseRows(sourceLinkedEvents, session.user.id);
    if (studentStepResponseRows.length > 0) {
      try {
        await prisma.studentStepResponse.createMany({
          data: studentStepResponseRows,
          skipDuplicates: true,
        });
      } catch (error) {
        console.error('[Interactive Events API] Failed to persist immutable student step responses:', error);
      }
    }

    // Route events based on priority
    const routingResults: Array<{
      eventType: string;
      destination: 'postgresql' | 'redis' | 'dropped';
      reason?: string;
      factsCreated: number;
      factActionType: string;
    }> = [];
    const sessionsNeedingReportRefresh = new Set<string>();

    for (const eventData of sourceLinkedEvents) {
      const payload =
        eventData.event.data && typeof eventData.event.data === 'object'
          ? eventData.event.data
          : {};
      const canonicalEventType = resolveCanonicalEventType(eventData.event.type, payload);
      const learningEvent = toLearningEvent(
        {
          ...eventData.event,
          eventId: typeof eventData.event.id === 'string' ? eventData.event.id : undefined,
          actionType: canonicalEventType,
          payload: {
            ...payload,
            ...(resolveClientEventId(eventData.event) ? { clientEventId: resolveClientEventId(eventData.event) } : {}),
            learningContext: eventData.learningContext,
            ...(eventData.invalidContextReason ? { invalidContextReason: eventData.invalidContextReason } : {}),
            originalEventType: eventData.event.type,
          },
          priority: isCoreEvent(canonicalEventType) ? 'core' : 'secondary',
        },
        {
          userId: session.user.id,
          role: (session.user.role?.toLowerCase() as 'student' | 'teacher' | 'admin') || 'student',
          pagePath: resolvePagePath(payload),
          pageType: resolvePageType(payload),
        }
      );

      const result = await routeEvent(learningEvent);
      const factResult = await persistCoreLearningFact(prisma, learningEvent);
      routingResults.push({
        eventType: learningEvent.actionType,
        ...result,
        factsCreated: factResult.created,
        factActionType: factResult.actionType,
      });

      if (learningEvent.actionType === 'session_finalize' && learningEvent.sessionId) {
        sessionsNeedingReportRefresh.add(learningEvent.sessionId);
      }

      // Core facts now keep the persisted InteractionLog id through sourceLogId.
    }

    for (const sessionId of Array.from(sessionsNeedingReportRefresh)) {
      try {
        await generateSessionSummaryReports(prisma, sessionId);
      } catch (error) {
        console.error('[Interactive Events API] Failed to refresh session report:', error);
      }
    }

    // Update response
    return NextResponse.json({
      success: true,
      count: dedupedEvents.length,
      degraded: degradedEvents.length,
      duplicates: duplicateEvents,
      routing: routingResults.reduce((acc, r) => {
        acc[r.destination] = (acc[r.destination] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      pending: 0,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
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
    rethrowIfNextDynamicError(error);
    console.error('[Interactive Events API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
