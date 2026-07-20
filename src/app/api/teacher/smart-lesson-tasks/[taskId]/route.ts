import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getSmartLessonTask, updateSmartLessonTask } from '@/lib/smart-lesson-plan';

import { idSchema, publicTask, readStrictJson, requireSmartLessonActor, smartLessonErrorResponse, updateTaskSchema } from '../_shared';

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const taskId = idSchema.parse((await context.params).taskId);
    const task = await getSmartLessonTask(prisma, { actor: auth.actor, taskId });
    return NextResponse.json({ task: publicTask(task) });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const taskId = idSchema.parse((await context.params).taskId);
    const input = updateTaskSchema.parse(await readStrictJson(request));
    const task = await updateSmartLessonTask(prisma, { actor: auth.actor, taskId, ...input });
    return NextResponse.json({ task: publicTask(task) });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}
