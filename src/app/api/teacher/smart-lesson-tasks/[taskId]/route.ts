import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  archiveSmartLessonTask,
  deleteSmartLessonTask,
  getSmartLessonTask,
  updateSmartLessonTask,
} from '@/lib/smart-lesson-plan';

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

export async function PUT(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const taskId = idSchema.parse((await context.params).taskId);
    const payload = await readStrictJson(request) as { action?: unknown };
    if (payload.action !== 'archive' && payload.action !== 'restore') {
      return NextResponse.json({ error: { code: 'invalid-lifecycle-action' } }, { status: 400 });
    }
    await archiveSmartLessonTask(prisma, {
      actor: auth.actor,
      taskId,
      archived: payload.action === 'archive',
    });
    const task = await getSmartLessonTask(prisma, { actor: auth.actor, taskId });
    return NextResponse.json({ task: publicTask(task as unknown as Record<string, unknown>) });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const taskId = idSchema.parse((await context.params).taskId);
    const result = await deleteSmartLessonTask(prisma, { actor: auth.actor, taskId });
    if (!result.deleted) {
      return NextResponse.json({
        error: {
          code: 'smart-lesson-task-referenced',
          message: '该任务已正式发布或用于课堂，只能归档。',
          blockers: result.blockers,
          nextAction: 'archive',
        },
      }, { status: 409 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}
