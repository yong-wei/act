import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSmartLessonTask, listSmartLessonTasks } from '@/lib/smart-lesson-plan';

import { createTaskSchema, publicTask, readStrictJson, requireSmartLessonActor, smartLessonErrorResponse } from './_shared';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const tasks = await listSmartLessonTasks(prisma, auth.actor);
    return NextResponse.json({ tasks: tasks.map(publicTask) });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const task = await createSmartLessonTask(prisma, { actor: auth.actor, ...createTaskSchema.parse(await readStrictJson(request)) });
    return NextResponse.json({ task: publicTask(task) }, { status: 201 });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}
