import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { parsePortfolioReflectionDraftContentInput } from '@/lib/ai-task-boundary-contracts';
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
  provenance: true,
  idempotencyKey: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface RouteContext {
  params: Promise<{ draftId: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await requireStudentSession();
    if (session instanceof NextResponse) return session;

    const input = parsePortfolioReflectionDraftContentInput(await request.json().catch(() => null));
    if (input.status === 'invalid') {
      return NextResponse.json({ error: '草稿内容无效' }, { status: 400 });
    }

    const { draftId } = await context.params;
    const updated = await prisma.portfolioReflectionDraft.updateMany({
      where: {
        id: draftId,
        userId: session.user.id,
        status: 'DRAFT',
      },
      data: {
        content: input.input.content,
      },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: '草稿不存在' }, { status: 404 });
    }

    const draft = await prisma.portfolioReflectionDraft.findFirstOrThrow({
      where: {
        id: draftId,
        userId: session.user.id,
        status: 'DRAFT',
      },
      select: draftSelect,
    });

    return NextResponse.json({ draft: serializeDraft(draft) });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[PortfolioReflectionDraftAPI] update failed:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireStudentSession();
    if (session instanceof NextResponse) return session;

    const { draftId } = await context.params;
    const discarded = await prisma.portfolioReflectionDraft.updateMany({
      where: {
        id: draftId,
        userId: session.user.id,
        status: 'DRAFT',
      },
      data: { status: 'DISCARDED' },
    });
    if (discarded.count === 0) {
      return NextResponse.json({ error: '草稿不存在' }, { status: 404 });
    }

    return NextResponse.json({ discardedId: draftId });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[PortfolioReflectionDraftAPI] discard failed:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
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
  provenance: 'PLATFORM_VERIFIED' | 'STUDENT_PROVIDED' | 'LEGACY_UNVERIFIED';
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
