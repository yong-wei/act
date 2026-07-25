import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSmartLessonTask, listSmartLessonTaskSummaries, listSmartLessonTasks } from '@/lib/smart-lesson-plan';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

import { createTaskSchema, publicTask, publicTaskSummary, readStrictJson, requireSmartLessonActor, smartLessonErrorResponse } from './_shared';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const url = new URL(request.url);
    const archived = url.searchParams.get('archived') === 'true';
    const summary = url.searchParams.get('view') === 'summary';
    if (summary) {
      const tasks = await listSmartLessonTaskSummaries(prisma, auth.actor, {
        archived,
        query: url.searchParams.get('query') ?? undefined,
      });
      return NextResponse.json({ tasks: tasks.map((task) => publicTaskSummary(task as unknown as Record<string, unknown>)) });
    }
    const tasks = await listSmartLessonTasks(prisma, auth.actor, { archived });
    return NextResponse.json({ tasks: tasks.map((task) => publicTask(task as unknown as Record<string, unknown>)) });
  } catch (error) {
    rethrowIfNextDynamicError(error);
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
    rethrowIfNextDynamicError(error);
    return smartLessonErrorResponse(error);
  }
}
