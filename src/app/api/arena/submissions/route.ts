import { NextResponse } from 'next/server';

import { getArenaChallengeTask } from '@/features/arena/data/seed-challenges';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId')?.trim();

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  if (!getArenaChallengeTask(taskId)) {
    return NextResponse.json({ error: 'Arena task not found' }, { status: 404 });
  }

  const submissions = await prismaArenaSubmissionStore.listSubmissions({ taskId });
  return NextResponse.json({ submissions });
}
