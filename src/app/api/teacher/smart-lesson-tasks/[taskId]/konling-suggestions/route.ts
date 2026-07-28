import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

import { idSchema, requireSmartLessonActor, smartLessonErrorResponse } from '../../_shared';

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const taskId = idSchema.parse((await context.params).taskId);
    const task = await prisma.smartLessonTask.findFirst({
      where: auth.actor.role === 'ADMIN' ? { id: taskId } : { id: taskId, ownerId: auth.actor.id },
      select: { id: true, ownerId: true },
    });
    if (!task) return NextResponse.json({ error: { code: 'smart-lesson-task-not-found' } }, { status: 404 });
    const rows = await prisma.agentToolRun.findMany({
      where: {
        ownerUserId: task.ownerId,
        toolName: 'propose_smart_lesson_task_change',
        status: 'succeeded',
        approvalState: { not: 'approved' },
        agentSession: { stateJson: { path: ['smartPrepBinding', 'taskId'], equals: task.id } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, agentSessionId: true, inputSummary: true, createdAt: true },
    });
    return NextResponse.json({ suggestions: rows.flatMap((row) => {
      const input = record(row.inputSummary);
      if (input.taskId !== task.id || typeof input.expectedRevision !== 'number' || typeof input.turnId !== 'string') return [];
      return [{
        id: row.id,
        agentSessionId: row.agentSessionId,
        expectedRevision: input.expectedRevision,
        turnId: input.turnId,
        proposedTask: recordOrUndefined(input.proposedTask),
        clarification: recordOrUndefined(input.clarification),
        createdAt: row.createdAt,
      }];
    }) });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recordOrUndefined(value: unknown) {
  const item = record(value);
  return Object.keys(item).length ? item : undefined;
}
