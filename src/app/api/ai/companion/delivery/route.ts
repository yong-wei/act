import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';

import { authOptions } from '@/lib/auth';
import { runCompanionProactiveTurn } from '@/features/ai/companion/proactive-turn';
import type { CompanionResourceCardInput } from '@/features/ai/companion/trigger-engine';
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

function companionAssistantMessage(input: {
  eventType: string;
  pageKind: string;
  pageRef: string;
  resources: CompanionResourceCard[];
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

    // 复用最近匹配的学生私有会话（同课程同页面上下文），否则创建新会话。
    const matched = await prisma.konlingSession.findFirst({
      where: { userId, courseId, pageId: event.pageRef },
      orderBy: { lastActivityAt: 'desc' },
      select: { id: true, messages: true },
    });
    const deliveredAt = new Date();
    const message = companionAssistantMessage({
      eventType: event.eventType,
      pageKind: event.pageKind,
      pageRef: event.pageRef,
      resources,
      deliveredAt,
    });
    let sessionId: string;
    if (matched) {
      const history = Array.isArray(matched.messages) ? matched.messages : [];
      await prisma.konlingSession.update({
        where: { id: matched.id },
        data: {
          messages: [...history, message] as unknown as Prisma.InputJsonValue,
          lastActivityAt: deliveredAt,
        },
      });
      sessionId = matched.id;
    } else {
      sessionId = (await prisma.konlingSession.create({
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

    // 唯一约束兜底多标签页并发：重复投递以 409 收敛，客户端复用既有会话。
    const delivery = await prisma.konlingCompanionDelivery.create({
      data: {
        eventId: event.id,
        userId,
        sessionId,
        resources: resources as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    }).catch(() => null);
    if (!delivery) {
      const winner = await prisma.konlingCompanionDelivery.findUnique({
        where: { eventId: event.id },
        select: { sessionId: true },
      });
      return NextResponse.json({
        sessionId: winner?.sessionId ?? sessionId,
        message: companionBubbleMessage(event.eventType),
        deduplicated: true,
      }, { status: 200 });
    }

    await prisma.konlingCompanionEvent.update({
      where: { id: event.id },
      data: { status: 'delivered' },
    });

    // 主动回合：围绕 companion 上下文生成一条真实回复（不伪造用户消息）。
    // 失败静默降级为静态文案消息，不影响投递结果。
    const proactiveContent = await runCompanionProactiveTurn({
      userId,
      eventType: event.eventType,
      pageKind: event.pageKind,
      pageRef: event.pageRef,
      reasons: resources.map((card) => card.reason),
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
