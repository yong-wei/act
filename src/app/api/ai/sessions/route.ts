import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import {
  createKonlingAssistantBindingEvent,
  createKonlingContextEvent,
  KONLING_DEFAULT_CONVERSATION_TITLE,
  konlingLibraryRetentionWhere,
  normalizeKonlingConversationAssistantBinding,
  resolveKonlingContextEventScope,
  serializeKonlingConversation,
} from '@/lib/konling-conversation-library';
import { loadTextbookCoachContext } from '@/lib/textbook-resource-coach/loader';
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

    // 资源辅导首轮提问时的创建：服务端重新验证完整资源身份后才落库绑定；
    // 以用户与完整身份的确定性来源键保证并发首问幂等复用同一会话。
    const requestedBinding = normalizeKonlingConversationAssistantBinding({
      modeId: typeof body.assistantBinding?.modeId === 'string' ? body.assistantBinding.modeId : null,
      clientContextHints: body.assistantBinding?.clientContextHints
        && typeof body.assistantBinding.clientContextHints === 'object'
        && !Array.isArray(body.assistantBinding.clientContextHints)
        ? body.assistantBinding.clientContextHints as Record<string, unknown>
        : null,
    });
    let boundConversation: {
      binding: NonNullable<ReturnType<typeof normalizeKonlingConversationAssistantBinding>>;
      sourceKey: string;
    } | null = null;
    if (requestedBinding?.teachingAssistantModeId === 'resource-coach') {
      const loaded = await loadTextbookCoachContext({
        actorUserId: session.user.id,
        declared: requestedBinding.modeClientContextHints,
      });
      if (loaded.status !== 'ready') {
        return NextResponse.json({
          error: 'KONLING_MODE_UNAVAILABLE',
          mode: 'resource-coach',
          status: 'unavailable',
          unavailableReasons: [`textbook-coach:${loaded.reason}`],
        }, { status: 409 });
      }
      const identity = loaded.identity;
      boundConversation = {
        binding: { ...requestedBinding, pinnedTextbookResourceIdentity: identity },
        sourceKey: [
          'resource-coach',
          session.user.id,
          identity.unitId,
          identity.sourceRevision,
          identity.contentHash,
          identity.anchorId ?? '-',
        ].join(':'),
      };
    }

    let conversation;
    try {
      conversation = await prisma.konlingSession.create({
        data: {
          id: conversationId,
          userId: session.user.id,
          courseId: contextEventScope.courseId,
          pageId: contextEventScope.pageId,
          title: KONLING_DEFAULT_CONVERSATION_TITLE,
          titleIsManual: false,
          migrationSourceId: boundConversation?.sourceKey ?? `native:${conversationId}`,
          messages: [
            initialContext,
            ...(boundConversation
              ? [createKonlingAssistantBindingEvent(boundConversation.binding)]
              : []),
          ] as unknown as import('@prisma/client').Prisma.InputJsonValue,
          lastActivityAt: now,
        },
      });
    } catch (error) {
      const isIdentityRace = boundConversation !== null
        && error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002';
      if (!boundConversation || !isIdentityRace) throw error;
      // 并发首问竞争：复用已落库的胜者会话，不产生重复空会话
      const winner = await prisma.konlingSession.findFirst({
        where: {
          migrationSourceId: boundConversation.sourceKey,
          userId: session.user.id,
          ...konlingLibraryRetentionWhere(),
        },
      });
      if (!winner) throw error;
      return NextResponse.json(serializeKonlingConversation(winner), { status: 200 });
    }

    return NextResponse.json(serializeKonlingConversation(conversation), { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error in POST /api/ai/sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
