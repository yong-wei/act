import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';

import { authOptions } from '@/lib/auth';
import { runCompanionProactiveTurn } from '@/features/ai/companion/proactive-turn';
import { isExpired, type CompanionResourceCardInput } from '@/features/ai/companion/trigger-engine';
import { readAdaptiveAttemptContext, type AdaptiveAttemptContextDb } from '@/features/assessment/adaptive-attempt-context';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const COMPANION_ORIGIN = 'companion';
const MAX_RESOURCE_CARDS = 3;

type CompanionResourceCard = CompanionResourceCardInput;

/** 资源卡可选（错题安慰等场景可为空）；提供时元素结构必须完整。 */
function parseResourceCards(value: unknown): CompanionResourceCard[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_RESOURCE_CARDS) return null;
  const cards: CompanionResourceCard[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const card = item as Record<string, unknown>;
    if (typeof card.resourceId !== 'string' || !card.resourceId
      || typeof card.versionHash !== 'string' || !card.versionHash
      || typeof card.reason !== 'string' || !card.reason
      || typeof card.kind !== 'string' || !card.kind) {
      return null;
    }
    cards.push({
      resourceId: card.resourceId,
      versionHash: card.versionHash,
      reason: card.reason,
      kind: card.kind,
      ...(typeof card.caption === 'string' && card.caption ? { caption: card.caption } : {}),
    });
  }
  return cards;
}

/** 随事件携带的上下文提示（错题知识点/答案 ID 等）：宽松解析并限幅，绝不包含答案载荷。 */
function parseContextHints(value: unknown): { knowledgePoints: string[]; answerId: string } {
  if (!value || typeof value !== 'object') return { knowledgePoints: [], answerId: '' };
  const hints = value as Record<string, unknown>;
  const raw = hints.knowledgePoints;
  const knowledgePoints = Array.isArray(raw)
    ? raw
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().slice(0, 64))
      .slice(0, 5)
    : [];
  const answerId = typeof hints.answerId === 'string' ? hints.answerId.slice(0, 64) : '';
  return { knowledgePoints, answerId };
}

/**
 * 错题场景的治理资源由服务端从 answer-time 固化快照解析（不信任客户端直传）：
 * 答题时 catalog reviewDecision 已把治理注册表资源固化为 remediationResources，
 * 这里按 verify 端点同一 updatedAt 口径补齐 versionHash；解析失败降级为空卡列表。
 */
async function resolveWrongAnswerResourceCards(input: {
  userId: string;
  answerId: string;
}): Promise<CompanionResourceCard[]> {
  if (!input.answerId) return [];
  try {
    const context = await readAdaptiveAttemptContext({
      // Prisma 委托与行投影类型存在窄化差异，按服务端消费先例以结构化 cast 交付。
      db: prisma as unknown as AdaptiveAttemptContextDb,
      authenticatedUserId: input.userId,
      answerId: input.answerId,
    });
    const resources = context?.question?.remediationResources ?? [];
    if (!Array.isArray(resources) || resources.length === 0) return [];
    const cards: CompanionResourceCard[] = [];
    for (const resource of resources.slice(0, MAX_RESOURCE_CARDS)) {
      const row = await prisma.teachingResource.findUnique({
        where: { id: resource.id },
        select: { updatedAt: true, teacherOnly: true },
      });
      if (!row || row.teacherOnly) continue;
      cards.push({
        resourceId: resource.id,
        versionHash: new Date(row.updatedAt).toISOString(),
        reason: resource.title || '错题相关的治理资源',
        kind: 'interactive-resource',
      });
    }
    return cards;
  } catch {
    return [];
  }
}

function companionAssistantMessage(input: {
  eventType: string;
  pageKind: string;
  pageRef: string;
  resources: CompanionResourceCard[];
  knowledgePoints: string[];
  deliveredAt: Date;
}) {
  return {
    id: `companion-${input.deliveredAt.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    role: 'assistant',
    origin: COMPANION_ORIGIN,
    content: `陪伴提醒已就绪（${input.eventType}）。点击下方资源卡继续。`,
    companionContext: {
      eventType: input.eventType,
      pageKind: input.pageKind,
      pageRef: input.pageRef,
      resources: input.resources,
      ...(input.knowledgePoints.length > 0 ? { knowledgePoints: input.knowledgePoints } : {}),
    },
    createdAt: input.deliveredAt.toISOString(),
  };
}

/** 气泡文案为按事件类型的固定模板：不显示知识点、不含答案，错题场景安全。 */
function companionBubbleMessage(eventType: string): string {
  switch (eventType) {
    case 'wrong-answer':
      return '这题答错了没关系，控灵陪你看懂它。';
    case 'progress-milestone':
      return '有进步！控灵想给你点个赞。';
    case 'resource-completed':
      return '资源学完了，看看控灵建议的下一步。';
    default:
      return '需要控灵陪你看会儿这个页面吗？';
  }
}

/**
 * 会话投递：复用最近匹配的学生私有控灵会话或创建新会话，
 * 写入 companion-origin 助手消息（不伪造用户消息），并以 Delivery 唯一约束兜底去重。
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (process.env.KONLING_COMPANION_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Companion disabled' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const eventId = String(body?.eventId ?? '');
    const courseId = String(body?.courseId ?? '').slice(0, 256);
    const resources = parseResourceCards(body?.resources);
    const contextHints = parseContextHints(body?.contextHints);
    if (!eventId || !courseId || !resources) {
      return NextResponse.json({ error: 'Invalid delivery request' }, { status: 400 });
    }

    const userId = session.user.id;
    const event = await prisma.konlingCompanionEvent.findFirst({
      where: { id: eventId, userId, status: { in: ['confirmed', 'delivered'] } },
    });
    if (!event) {
      return NextResponse.json({ error: 'Confirmed event not found' }, { status: 404 });
    }

    // 已有投递优先收敛返回（即使事件已过有效期，也不把 delivered 终态改写为 expired）。
    const existingDelivery = await prisma.konlingCompanionDelivery.findUnique({
      where: { eventId: event.id },
      select: { sessionId: true },
    });
    if (existingDelivery) {
      return NextResponse.json({
        sessionId: existingDelivery.sessionId,
        message: companionBubbleMessage(event.eventType),
        deduplicated: true,
      }, { status: 200 });
    }

    // 超过有效期且尚未投递的确认事件不再投递（标签页休眠/离线重试的陈旧提醒）。
    if (isExpired(event, new Date())) {
      await prisma.konlingCompanionEvent.update({
        where: { id: event.id },
        data: { status: 'expired' },
      });
      return NextResponse.json({ error: 'Confirmed event not found' }, { status: 404 });
    }

    // 错题场景的治理资源以服务端快照解析为准（仅来自治理注册表），其余事件沿用布点页面提供的卡。
    const effectiveResources = event.eventType === 'wrong-answer' && contextHints.answerId
      ? await resolveWrongAnswerResourceCards({ userId, answerId: contextHints.answerId })
      : resources;

    const deliveredAt = new Date();
    const message = companionAssistantMessage({
      eventType: event.eventType,
      pageKind: event.pageKind,
      pageRef: event.pageRef,
      resources: effectiveResources,
      knowledgePoints: contextHints.knowledgePoints,
      deliveredAt,
    });

    // 事务内原子认领：会话写入、Delivery 唯一约束与事件终态同进同出，
    // 并发投递的失败方整体回滚，不会留下孤立会话或重复 companion 消息。
    let sessionId: string;
    try {
      sessionId = await prisma.$transaction(async (tx) => {
        // 复用最近匹配的学生私有会话（同课程同页面上下文），否则创建新会话。
        const matched = await tx.konlingSession.findFirst({
          where: { userId, courseId, pageId: event.pageRef },
          orderBy: { lastActivityAt: 'desc' },
          select: { id: true, messages: true },
        });
        let targetId: string;
        if (matched) {
          const history = Array.isArray(matched.messages) ? matched.messages : [];
          await tx.konlingSession.update({
            where: { id: matched.id },
            data: {
              messages: [...history, message] as unknown as Prisma.InputJsonValue,
              lastActivityAt: deliveredAt,
            },
          });
          targetId = matched.id;
        } else {
          targetId = (await tx.konlingSession.create({
            data: {
              userId,
              courseId,
              pageId: event.pageRef,
              title: '控灵陪伴',
              messages: [message] as unknown as Prisma.InputJsonValue,
            },
            select: { id: true },
          })).id;
        }
        await tx.konlingCompanionDelivery.create({
          data: {
            eventId: event.id,
            userId,
            sessionId: targetId,
            resources: effectiveResources as unknown as Prisma.InputJsonValue,
          },
          select: { id: true },
        });
        await tx.konlingCompanionEvent.update({
          where: { id: event.id },
          data: { status: 'delivered' },
        });
        return targetId;
      });
    } catch {
      // 唯一约束决出胜者：收敛返回胜者会话；无胜者说明事务因其他原因失败。
      const winner = await prisma.konlingCompanionDelivery.findUnique({
        where: { eventId: event.id },
        select: { sessionId: true },
      });
      if (winner) {
        return NextResponse.json({
          sessionId: winner.sessionId,
          message: companionBubbleMessage(event.eventType),
          deduplicated: true,
        }, { status: 200 });
      }
      throw new Error('companion delivery transaction failed');
    }

    // 主动回合：围绕 companion 上下文生成一条真实回复（不伪造用户消息）。
    // 失败静默降级为静态文案消息，不影响投递结果。
    const proactiveContent = await runCompanionProactiveTurn({
      userId,
      eventType: event.eventType,
      pageKind: event.pageKind,
      pageRef: event.pageRef,
      reasons: effectiveResources.map((card) => card.reason),
      knowledgePoints: contextHints.knowledgePoints,
    });
    if (proactiveContent) {
      const proactiveMessage = {
        id: `companion-turn-${deliveredAt.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
        role: 'assistant',
        origin: COMPANION_ORIGIN,
        content: proactiveContent,
        metadata: {
          companionProactiveTurn: { eventId: event.id, generatedAt: deliveredAt.toISOString() },
        },
        createdAt: new Date().toISOString(),
      };
      const current = await prisma.konlingSession.findUnique({
        where: { id: sessionId },
        select: { messages: true },
      });
      if (current) {
        const history = Array.isArray(current.messages) ? current.messages : [];
        // 仅当消息尾部仍是本事件的首条 companion 消息时追加，避免并发重复。
        const lastMessage = history[history.length - 1];
        if (lastMessage && typeof lastMessage === 'object' && !Array.isArray(lastMessage)
          && (lastMessage as Record<string, unknown>).id === message.id) {
          await prisma.konlingSession.update({
            where: { id: sessionId },
            data: {
              messages: [...history, proactiveMessage] as unknown as Prisma.InputJsonValue,
              lastActivityAt: new Date(),
            },
          });
        }
      }
    }

    return NextResponse.json({
      sessionId,
      message: companionBubbleMessage(event.eventType),
      deduplicated: false,
    }, { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('companion delivery failed', error);
    return NextResponse.json({ error: 'Companion delivery failed' }, { status: 500 });
  }
}
