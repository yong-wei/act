import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { SmartLessonPlanError, updateSmartLessonTask } from '@/lib/smart-lesson-plan';

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
    const task = await prisma.$transaction(async (tx) => {
      const run = await tx.agentToolRun.findFirst({
        where: {
          id: suggestionId,
          agentSessionId: confirmation.agentSessionId,
          ownerUserId: auth.actor.id,
          actorUserId: auth.actor.id,
          toolName: 'propose_smart_lesson_task_change',
          status: 'succeeded',
          approvalState: { notIn: ['approved', 'confirmation_in_progress'] },
        },
        include: { agentSession: { select: { ownerUserId: true, actorUserId: true, stateJson: true } } },
      });
      if (!run) throw new SmartLessonPlanError('konling-suggestion-not-found', 404);
      const binding = record(record(run.agentSession.stateJson).smartPrepBinding);
      const sessionState = record(run.agentSession.stateJson);
      const input = record(run.inputSummary);
      if (
        run.agentSession.ownerUserId !== auth.actor.id || run.agentSession.actorUserId !== auth.actor.id
        || binding.taskId !== taskId || binding.ownerUserId !== auth.actor.id
        || binding.taskRevision !== String(input.expectedRevision)
        || input.taskId !== taskId || input.turnId !== confirmation.turnId
        || !Array.isArray(sessionState.ownedTurnIds) || !sessionState.ownedTurnIds.includes(confirmation.turnId)
      ) throw new SmartLessonPlanError('konling-suggestion-scope-mismatch', 409);
      const proposedTask = record(input.proposedTask);
      if (!Object.keys(proposedTask).length) throw new SmartLessonPlanError('konling-clarification-requires-answer', 409);
      const parsed = updateTaskSchema.parse({
        ...proposedTask,
        // The teacher has explicitly accepted this revision in this endpoint.
        // Confirmation state is therefore server-owned, not model-owned.
        confirmScope: true,
        confirmGoals: true,
        expectedRevision: input.expectedRevision,
        confirmingTurnId: confirmation.turnId,
        agentSessionId: confirmation.agentSessionId,
      });
      const claimed = await tx.agentToolRun.updateMany({
        where: {
          id: run.id,
          agentSessionId: confirmation.agentSessionId,
          ownerUserId: auth.actor.id,
          actorUserId: auth.actor.id,
          toolName: 'propose_smart_lesson_task_change',
          status: 'succeeded',
          approvalState: { notIn: ['approved', 'confirmation_in_progress'] },
        },
        data: { approvalState: 'confirmation_in_progress' },
      });
      if (claimed.count !== 1) throw new SmartLessonPlanError('konling-suggestion-conflict', 409);
      const updatedTask = await updateSmartLessonTask(tx, { actor: auth.actor, taskId, ...parsed });
      const sessionUpdated = await tx.agentSession.updateMany({
        where: { id: confirmation.agentSessionId, ownerUserId: auth.actor.id, actorUserId: auth.actor.id },
        data: {
          stateJson: {
            ...sessionState,
            smartPrepBinding: { taskId, taskRevision: String(updatedTask.revision), ownerUserId: auth.actor.id },
          },
        },
      });
      if (sessionUpdated.count !== 1) throw new SmartLessonPlanError('konling-suggestion-scope-mismatch', 409);
      const approved = await tx.agentToolRun.updateMany({
        where: { id: run.id, approvalState: 'confirmation_in_progress' },
        data: { approvalState: 'approved' },
      });
      if (approved.count !== 1) throw new SmartLessonPlanError('konling-suggestion-conflict', 409);
      return updatedTask;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ task: publicTask(task), agentSessionId: confirmation.agentSessionId });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return smartLessonErrorResponse(new SmartLessonPlanError('task-revision-conflict', 409));
    }
    return smartLessonErrorResponse(error);
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
