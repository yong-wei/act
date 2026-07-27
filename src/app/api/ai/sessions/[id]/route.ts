import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  normalizeKonlingManualTitle,
  serializeKonlingConversation,
} from '@/lib/konling-conversation-library';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
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
        libraryVisible: true,
        expiresAt: { gt: new Date() },
      },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json(serializeKonlingConversation(conversation));
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
        libraryVisible: true,
        expiresAt: { gt: new Date() },
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
    return NextResponse.json(serializeKonlingConversation(conversation));
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
