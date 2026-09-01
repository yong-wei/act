import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createKonlingContextEvent,
  KONLING_DEFAULT_CONVERSATION_TITLE,
  konlingLibraryRetentionWhere,
  resolveKonlingContextEventScope,
  serializeKonlingConversation,
} from '@/lib/konling-conversation-library';
import { verifyKonlingRuntimeScope } from '@/lib/konling-agent-runtime';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

const SEARCH_MAX_LENGTH = 64;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const search = searchParams.get('search')?.trim().slice(0, SEARCH_MAX_LENGTH);
    const courseId = searchParams.get('courseId')?.trim().slice(0, SEARCH_MAX_LENGTH);
    const pageId = searchParams.get('pageId')?.trim().slice(0, 256);
    const conversations = await prisma.konlingSession.findMany({
      where: {
        userId: session.user.id,
        ...konlingLibraryRetentionWhere(),
        ...(search ? {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        } : {}),
        ...(courseId && pageId ? { courseId, pageId } : {}),
      },
      select: {
        id: true,
        courseId: true,
        pageId: true,
        title: true,
        titleIsManual: true,
        pinnedAt: true,
        lastActivityAt: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
      orderBy: [
        { pinnedAt: { sort: 'desc', nulls: 'last' } },
        { lastActivityAt: 'desc' },
        { id: 'desc' },
      ],
    });

    return NextResponse.json({
      conversations: conversations.map((conversation) => ({
        ...conversation,
        pinned: Boolean(conversation.pinnedAt),
      })),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error in GET /api/ai/sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
    const pageId = typeof body.pageId === 'string' ? body.pageId.trim() : '';
    if (!courseId || !pageId) {
      return NextResponse.json({ error: 'Missing courseId or pageId' }, { status: 400 });
    }

    const scope = await verifyKonlingRuntimeScope(prisma, {
      authenticatedUserId: session.user.id,
      role: session.user.role,
      courseId,
      pageId,
      classId: typeof body.classId === 'string' ? body.classId : null,
      resourceId: typeof body.resourceId === 'string' ? body.resourceId : null,
      pathNodeId: typeof body.pathNodeId === 'string' ? body.pathNodeId : null,
      pageContextHint: body.pageContext,
    });
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }
    const contextEventScope = await resolveKonlingContextEventScope(prisma, scope.scope);
    if (!contextEventScope) {
      return NextResponse.json({ error: 'Page context is not registered for Konling.' }, { status: 400 });
    }

    const now = new Date();
    const conversationId = crypto.randomUUID();
    const initialContext = createKonlingContextEvent(contextEventScope);
    const conversation = await prisma.konlingSession.create({
      data: {
        id: conversationId,
        userId: session.user.id,
        courseId: contextEventScope.courseId,
        pageId: contextEventScope.pageId,
        title: KONLING_DEFAULT_CONVERSATION_TITLE,
        titleIsManual: false,
        migrationSourceId: `native:${conversationId}`,
        messages: [initialContext] as unknown as import('@prisma/client').Prisma.InputJsonValue,
        lastActivityAt: now,
      },
    });

    return NextResponse.json(serializeKonlingConversation(conversation), { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error in POST /api/ai/sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
