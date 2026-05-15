import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  ArenaPublicationPermissionError,
  updateArenaPublicationStatus,
  type ArenaPublicationStatus,
} from '@/features/arena/teacher/publication-store';

export const dynamic = 'force-dynamic';

function parseStatus(value: unknown): ArenaPublicationStatus | null {
  return value === 'draft' || value === 'active' || value === 'paused' || value === 'archived' || value === 'closed'
    ? value
    : null;
}

function actorFromSession(session: Awaited<ReturnType<typeof getServerAuthSession>>) {
  if (!session?.user?.id || !['TEACHER', 'ADMIN'].includes(session.user.role ?? '')) {
    return null;
  }
  return { id: session.user.id, role: session.user.role as 'TEACHER' | 'ADMIN' };
}

export async function PATCH(
  request: Request,
  { params }: { params: { publicationId: string } },
) {
  const session = await getServerAuthSession();
  const actor = actorFromSession(session);
  if (!actor) {
    return NextResponse.json({ error: session?.user?.id ? '权限不足' : '未登录' }, { status: session?.user?.id ? 403 : 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const status = parseStatus(body.status);
    if (!status) {
      return NextResponse.json({ error: 'status must be draft, active, paused, archived, or closed' }, { status: 400 });
    }
    const publication = await updateArenaPublicationStatus(prisma as any, {
      actor,
      publicationId: params.publicationId,
      status,
    });
    return NextResponse.json({ publication });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ArenaPublicationPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Invalid Arena publication status request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
