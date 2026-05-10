import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { createArenaChallengePublication } from '@/features/arena/teacher/configuration';
import type { ArenaPublicationVisibility } from '@/features/arena/teacher/configuration';

export const dynamic = 'force-dynamic';

function parseVisibility(value: unknown): ArenaPublicationVisibility | null {
  return value === 'class' || value === 'course' || value === 'public' ? value : null;
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id || !['TEACHER', 'ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: session?.user?.id ? '权限不足' : '未登录' }, { status: session?.user?.id ? 403 : 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (
      typeof body.taskId !== 'string' ||
      typeof body.classId !== 'string' ||
      typeof body.deadline !== 'string' ||
      typeof body.leaderboardPolicyId !== 'string'
    ) {
      return NextResponse.json({ error: 'taskId, classId, deadline, and leaderboardPolicyId are required' }, { status: 400 });
    }
    const visibility = parseVisibility(body.visibility ?? 'class');
    if (!visibility) {
      return NextResponse.json({ error: 'visibility must be class, course, or public' }, { status: 400 });
    }

    const targetClass = await prisma.class.findUnique({
      where: { id: body.classId },
      select: { id: true, teacherId: true },
    });
    if (!targetClass) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    if (session.user.role !== 'ADMIN' && targetClass.teacherId !== session.user.id) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const publication = createArenaChallengePublication({
      taskId: body.taskId,
      classId: body.classId,
      visibility,
      deadline: body.deadline,
      leaderboardPolicyId: body.leaderboardPolicyId,
      homeworkBinding: body.homeworkBinding === true,
    });

    return NextResponse.json({ publication });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const message = error instanceof Error ? error.message : 'Invalid Arena teacher preview request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
