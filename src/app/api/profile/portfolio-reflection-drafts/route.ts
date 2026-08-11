import { NextResponse } from 'next/server';

import { Prisma } from '@prisma/client';
import { getServerAuthSession } from '@/lib/auth';
import { parsePortfolioReflectionDraftInput } from '@/lib/ai-task-boundary-contracts';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const draftSelect = {
  id: true,
  source: true,
  assignment: true,
  intent: true,
  title: true,
  content: true,
  status: true,
  idempotencyKey: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  try {
    const session = await requireStudentSession();
    if (session instanceof NextResponse) return session;

    const drafts = await prisma.portfolioReflectionDraft.findMany({
      where: {
        userId: session.user.id,
        status: 'DRAFT',
      },
      select: draftSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    return NextResponse.json({ drafts: drafts.map(serializeDraft) });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[PortfolioReflectionDraftsAPI] list failed:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStudentSession();
    if (session instanceof NextResponse) return session;

    const input = parsePortfolioReflectionDraftInput(await request.json().catch(() => null));
    if (input.status === 'invalid') {
      return NextResponse.json({ error: '草稿内容无效' }, { status: 400 });
    }

    const draft = await prisma.$transaction(async (tx) => {
      const existing = await tx.portfolioReflectionDraft.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: session.user.id,
            idempotencyKey: input.input.idempotencyKey,
          },
        },
        select: { id: true, status: true },
      });

      if (existing?.status === 'DISCARDED') {
        throw new DiscardedDraftReplayError();
      }

      if (existing) {
        return tx.portfolioReflectionDraft.findUniqueOrThrow({
          where: { id: existing.id },
          select: draftSelect,
        });
      }

      return tx.portfolioReflectionDraft.create({
        data: {
          userId: session.user.id,
          source: input.input.source,
          assignment: input.input.assignment,
          intent: input.input.intent,
          title: input.input.title,
          content: input.input.content,
          status: 'DRAFT',
          idempotencyKey: input.input.idempotencyKey,
        },
        select: draftSelect,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ draft: serializeDraft(draft) });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof DiscardedDraftReplayError) {
      return NextResponse.json({ error: '已丢弃的草稿不能使用旧请求重新激活' }, { status: 409 });
    }
    console.error('[PortfolioReflectionDraftsAPI] save failed:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

class DiscardedDraftReplayError extends Error {
  constructor() {
    super('discarded portfolio reflection draft replay');
  }
}

async function requireStudentSession() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  if (session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '仅学生可管理反思草稿' }, { status: 403 });
  }
  return session;
}

function serializeDraft(draft: {
  id: string;
  source: string;
  assignment: string | null;
  intent: string;
  title: string;
  content: string;
  status: 'DRAFT' | 'DISCARDED';
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...draft,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  };
}
