import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { updateSmartLessonTask } from '@/lib/smart-lesson-plan';

import { idSchema, publicTask, readStrictJson, requireSmartLessonActor, smartLessonErrorResponse, updateTaskSchema } from '../../../../_shared';

const confirmationSchema = z.object({ agentSessionId: idSchema, turnId: idSchema }).strict();

export async function POST(request: Request, context: { params: Promise<{ taskId: string; suggestionId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  if (auth.actor.role !== 'TEACHER') return NextResponse.json({ error: { code: 'teacher-confirmation-required' } }, { status: 403 });
  try {
    const params = await context.params;
    const taskId = idSchema.parse(params.taskId);
    const suggestionId = idSchema.parse(params.suggestionId);
    const confirmation = confirmationSchema.parse(await readStrictJson(request));
    const run = await prisma.agentToolRun.findFirst({
      where: {
        id: suggestionId,
        agentSessionId: confirmation.agentSessionId,
        ownerUserId: auth.actor.id,
        actorUserId: auth.actor.id,
        toolName: 'propose_smart_lesson_task_change',
        status: 'succeeded',
        approvalState: { not: 'approved' },
      },
      include: { agentSession: { select: { ownerUserId: true, actorUserId: true, stateJson: true } } },
    });
    if (!run) return NextResponse.json({ error: { code: 'konling-suggestion-not-found' } }, { status: 404 });
    const binding = record(record(run.agentSession.stateJson).smartPrepBinding);
    const sessionState = record(run.agentSession.stateJson);
    const input = record(run.inputSummary);
    if (
      run.agentSession.ownerUserId !== auth.actor.id || run.agentSession.actorUserId !== auth.actor.id
      || binding.taskId !== taskId || binding.ownerUserId !== auth.actor.id
      || input.taskId !== taskId || input.turnId !== confirmation.turnId
      || !Array.isArray(sessionState.ownedTurnIds) || !sessionState.ownedTurnIds.includes(confirmation.turnId)
    ) return NextResponse.json({ error: { code: 'konling-suggestion-scope-mismatch' } }, { status: 409 });
    const proposedTask = record(input.proposedTask);
    if (!Object.keys(proposedTask).length) return NextResponse.json({ error: { code: 'konling-clarification-requires-answer' } }, { status: 409 });
    const parsed = updateTaskSchema.parse({
      ...proposedTask,
      expectedRevision: input.expectedRevision,
      confirmingTurnId: confirmation.turnId,
      agentSessionId: confirmation.agentSessionId,
    });
    const task = await updateSmartLessonTask(prisma, { actor: auth.actor, taskId, ...parsed });
    await prisma.agentToolRun.updateMany({
      where: { id: run.id, approvalState: { not: 'approved' } },
      data: { approvalState: 'approved' },
    });
    await prisma.agentSession.updateMany({
      where: { id: confirmation.agentSessionId, ownerUserId: auth.actor.id, actorUserId: auth.actor.id },
      data: {
        stateJson: {
          ...sessionState,
          smartPrepBinding: { taskId, taskRevision: String(task.revision), ownerUserId: auth.actor.id },
        },
      },
    });
    return NextResponse.json({ task: publicTask(task), agentSessionId: confirmation.agentSessionId });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
