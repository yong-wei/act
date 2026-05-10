import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { createArenaSubmission } from '@/features/arena/submissions/submission-service';
import type { ArenaSubmissionRecord } from '@/features/arena/submissions/submission-service';
import type { ControllerArtifact } from '@/features/arena/types';

const arenaEvaluateSubmissions: ArenaSubmissionRecord[] = [];

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      taskId?: string;
      artifact?: ControllerArtifact;
      studentLabel?: string;
    };

    if (!body.taskId || !body.artifact) {
      return NextResponse.json({ error: 'taskId and artifact are required' }, { status: 400 });
    }

    const submission = createArenaSubmission({
      taskId: body.taskId,
      artifact: body.artifact,
      studentLabel: body.studentLabel ?? session.user.name ?? '匿名学生',
      submittedAt: new Date().toISOString(),
      existingSubmissions: arenaEvaluateSubmissions,
    });
    arenaEvaluateSubmissions.push(submission);

    return NextResponse.json({ submission });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const message = error instanceof Error ? error.message : 'Invalid Arena evaluation request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
