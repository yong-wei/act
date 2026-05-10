import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { ArenaSubmissionInputError, createPersistedArenaSubmission } from '@/features/arena/submissions/persistence';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import type { ControllerArtifact } from '@/features/arena/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Only students can submit Arena entries' }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      taskId?: string;
      artifact?: ControllerArtifact;
    };

    if (!body.taskId || !body.artifact) {
      return NextResponse.json({ error: 'taskId and artifact are required' }, { status: 400 });
    }

    const submission = await createPersistedArenaSubmission({
      taskId: body.taskId,
      artifact: body.artifact,
      userId: session.user.id,
      studentLabel: session.user.name ?? '匿名学生',
      submittedAt: new Date().toISOString(),
      store: prismaArenaSubmissionStore,
    });

    return NextResponse.json({ submission });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ArenaSubmissionInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Arena evaluation failed', error);
    return NextResponse.json({ error: 'Arena evaluation failed' }, { status: 500 });
  }
}
