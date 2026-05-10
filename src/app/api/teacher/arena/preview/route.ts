import { NextResponse } from 'next/server';

import { createArenaChallengePublication } from '@/features/arena/teacher/configuration';

export async function POST(request: Request) {
  const body = await request.json() as {
    taskId?: string;
    classId?: string;
    visibility?: 'class' | 'course' | 'public';
    deadline?: string;
    leaderboardPolicyId?: string;
    homeworkBinding?: boolean;
  };

  if (!body.taskId || !body.classId || !body.deadline || !body.leaderboardPolicyId) {
    return NextResponse.json({ error: 'taskId, classId, deadline, and leaderboardPolicyId are required' }, { status: 400 });
  }

  const publication = createArenaChallengePublication({
    taskId: body.taskId,
    classId: body.classId,
    visibility: body.visibility ?? 'class',
    deadline: body.deadline,
    leaderboardPolicyId: body.leaderboardPolicyId,
    homeworkBinding: body.homeworkBinding ?? false,
  });

  return NextResponse.json({ publication });
}
