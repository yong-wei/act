import { NextResponse } from 'next/server';

import { createArenaSubmission } from '@/features/arena/submissions/submission-service';
import type { ControllerArtifact } from '@/features/arena/types';

export async function POST(request: Request) {
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
    studentLabel: body.studentLabel ?? '匿名学生',
    submittedAt: new Date().toISOString(),
    existingSubmissions: [],
  });

  return NextResponse.json({ submission });
}
