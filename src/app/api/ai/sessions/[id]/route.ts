import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  conversationMessages,
  konlingLibraryRetentionWhere,
  konlingStructuredActionToolRunIds,
  mergeLegacyKonlingStructuredActionToolRuns,
  normalizeKonlingManualTitle,
  serializeKonlingConversation,
} from '@/lib/konling-conversation-library';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function refreshConversationStructuredActions(input: {
  conversationId: string;
  ownerUserId: string;
  messages: Prisma.JsonValue;
}) {
  const persistedMessages = conversationMessages(input.messages);
  const toolRunIds = konlingStructuredActionToolRunIds(persistedMessages);
  const referencedToolRuns = toolRunIds.length
    ? await prisma.agentToolRun.findMany({
        where: {
          id: { in: toolRunIds },
          ownerUserId: input.ownerUserId,
          agentSession: { konlingSessionId: input.conversationId },
        },
        select: {
          id: true,
          toolName: true,
          status: true,
          approvalState: true,
          inputSummary: true,
          outputSummary: true,
          errorSummary: true,
        },
      })
    : [];
  const legacyToolRuns = await prisma.agentToolRun.findMany({
    where: {
      ownerUserId: input.ownerUserId,
      agentSession: { konlingSessionId: input.conversationId },
      toolName: 'propose_smart_lesson_task_change',
    },
    orderBy: [
      { startedAt: 'desc' },
      { id: 'desc' },
    ],
    take: 100,
    select: {
      id: true,
      toolName: true,
      status: true,
      approvalState: true,
      inputSummary: true,
      outputSummary: true,
      errorSummary: true,
    },
  });
  const toolRuns = [...new Map(
    [...legacyToolRuns, ...referencedToolRuns].map((run) => [run.id, run]),
  ).values()];
  return mergeLegacyKonlingStructuredActionToolRuns(persistedMessages, toolRuns);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await context.params;
    const conversation = await prisma.konlingSession.findFirst({
      where: {
        id,
        userId: session.user.id,
        ...konlingLibraryRetentionWhere(),
      },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    const refreshedMessages = await refreshConversationStructuredActions({
      conversationId: id,
      ownerUserId: session.user.id,
      messages: conversation.messages,
    });
    return NextResponse.json(serializeKonlingConversation(conversation, refreshedMessages));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error in GET /api/ai/sessions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const data: {
      title?: string;
      titleIsManual?: boolean;
      pinnedAt?: Date | null;
    } = {};

    if (Object.hasOwn(body, 'title')) {
      const title = normalizeKonlingManualTitle(body.title);
      if (!title) {
        return NextResponse.json({ error: 'Title must not be empty' }, { status: 400 });
      }
      data.title = title;
      data.titleIsManual = true;
    }
    if (Object.hasOwn(body, 'pinned')) {
      if (typeof body.pinned !== 'boolean') {
        return NextResponse.json({ error: 'Pinned must be boolean' }, { status: 400 });
      }
      data.pinnedAt = body.pinned ? new Date() : null;
    }
    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'No supported changes' }, { status: 400 });
    }

    const updated = await prisma.konlingSession.updateMany({
      where: {
        id,
        userId: session.user.id,
        ...konlingLibraryRetentionWhere(),
      },
      data,
    });
    if (updated.count !== 1) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    const conversation = await prisma.konlingSession.findUnique({ where: { id } });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    const refreshedMessages = await refreshConversationStructuredActions({
      conversationId: id,
      ownerUserId: session.user.id,
      messages: conversation.messages,
    });
    return NextResponse.json(serializeKonlingConversation(conversation, refreshedMessages));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error in PATCH /api/ai/sessions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    if (body?.confirmed !== true) {
      return NextResponse.json({ error: 'Deletion confirmation required' }, { status: 400 });
    }
    const { id } = await context.params;
    const deleted = await prisma.$transaction(async (tx) => {
      const conversation = await tx.konlingSession.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
      });
      if (!conversation) return { count: 0 };

      await tx.agentSession.deleteMany({
        where: {
          konlingSessionId: id,
          ownerUserId: session.user.id,
          actorUserId: session.user.id,
        },
      });
      return tx.konlingSession.deleteMany({
        where: { id, userId: session.user.id },
      });
    });
    if (deleted.count !== 1) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, deletedConversationId: id });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error in DELETE /api/ai/sessions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
