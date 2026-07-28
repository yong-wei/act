import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { SmartLessonPlanError, updateSmartLessonTask } from '@/lib/smart-lesson-plan';

import { idSchema, publicTask, readStrictJson, requireSmartLessonActor, smartLessonErrorResponse, updateTaskSchema } from '../../../../_shared';

export async function POST(request: Request, context: { params: Promise<{ taskId: string; suggestionId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  if (auth.actor.role !== 'TEACHER') return NextResponse.json({ error: { code: 'teacher-confirmation-required' } }, { status: 403 });
  const failedAction: {
    current?: { suggestionId: string; agentSessionId: string; outputSummary: Record<string, unknown> };
  } = {};
  try {
    const params = await context.params;
    const taskId = idSchema.parse(params.taskId);
    const suggestionId = idSchema.parse(params.suggestionId);
    const body = await readStrictJson(request);
    if (Object.keys(record(body)).length) throw new SmartLessonPlanError('invalid-input', 400);
    const run = await prisma.agentToolRun.findFirst({
      where: {
        OR: [
          { id: suggestionId },
          { inputSummary: { path: ['publicActionId'], equals: suggestionId } },
        ],
        ownerUserId: auth.actor.id,
        actorUserId: auth.actor.id,
        toolName: 'propose_smart_lesson_task_change',
        status: 'succeeded',
      },
      include: { agentSession: { select: { ownerUserId: true, actorUserId: true, stateJson: true } } },
    });
    if (!run) throw new SmartLessonPlanError('konling-suggestion-not-found', 404);
    const sessionState = record(run.agentSession.stateJson);
    const input = record(run.inputSummary);
    const turnId = stringValue(input.turnId);
    if (
      run.agentSession.ownerUserId !== auth.actor.id
      || run.agentSession.actorUserId !== auth.actor.id
      || input.taskId !== taskId
      || !turnId
      || !Array.isArray(sessionState.ownedTurnIds)
      || !sessionState.ownedTurnIds.includes(turnId)
    ) throw new SmartLessonPlanError('konling-suggestion-scope-mismatch', 409);
    const existingOutput = record(run.outputSummary);
    if (run.approvalState === 'approved' && existingOutput.confirmedTaskId === taskId) {
      const replayTask = await prisma.smartLessonTask.findFirst({
        where: { id: taskId, ownerId: auth.actor.id },
        include: { sources: true, knowledgePoints: true, goals: true, drafts: true },
      });
      if (!replayTask) throw new SmartLessonPlanError('smart-lesson-task-not-found', 404);
      return NextResponse.json({
        task: publicTask(replayTask),
        affectedStageId: stringValue(existingOutput.affectedStageId) ?? 'topic-goals',
      });
    }
    if (run.approvalState !== 'not_required') {
      throw new SmartLessonPlanError(`konling-suggestion-${run.approvalState}`, 409);
    }
    const binding = record(record(run.agentSession.stateJson).smartPrepBinding);
    if (
      binding.taskId !== taskId || binding.ownerUserId !== auth.actor.id
      || binding.taskRevision !== String(input.expectedRevision)
    ) {
      await prisma.agentToolRun.updateMany({
        where: {
          id: run.id,
          agentSessionId: run.agentSessionId,
          ownerUserId: auth.actor.id,
          actorUserId: auth.actor.id,
          approvalState: 'not_required',
        },
        data: {
          approvalState: 'conflict',
          outputSummary: { ...existingOutput, actionState: 'conflict' },
        },
      });
      throw new SmartLessonPlanError('konling-suggestion-scope-mismatch', 409);
    }
    const proposedTask = record(input.proposedTask);
    if (!Object.keys(proposedTask).length) throw new SmartLessonPlanError('konling-clarification-requires-answer', 409);
    const parsed = updateTaskSchema.parse({
      ...proposedTask,
      // The teacher has explicitly accepted this revision in this endpoint.
      // Confirmation state is therefore server-owned, not model-owned.
      confirmScope: true,
      confirmGoals: true,
      expectedRevision: input.expectedRevision,
      confirmingTurnId: turnId,
      agentSessionId: run.agentSessionId,
    });
    const claimed = await prisma.agentToolRun.updateMany({
      where: {
        id: run.id,
        agentSessionId: run.agentSessionId,
        ownerUserId: auth.actor.id,
        actorUserId: auth.actor.id,
        toolName: 'propose_smart_lesson_task_change',
        status: 'succeeded',
        approvalState: 'not_required',
      },
      data: { approvalState: 'confirmation_in_progress' },
    });
    if (claimed.count !== 1) throw new SmartLessonPlanError('konling-suggestion-conflict', 409);
    failedAction.current = {
      suggestionId: run.id,
      agentSessionId: run.agentSessionId,
      outputSummary: existingOutput,
    };
    const result = await prisma.$transaction(async (tx) => {
      const updatedTask = await updateSmartLessonTask(tx, { actor: auth.actor, taskId, ...parsed });
      const sessionUpdated = await tx.agentSession.updateMany({
        where: { id: run.agentSessionId, ownerUserId: auth.actor.id, actorUserId: auth.actor.id },
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
        data: {
          approvalState: 'approved',
          outputSummary: {
            ...existingOutput,
            confirmedTaskId: updatedTask.id,
            confirmedRevision: updatedTask.revision,
            affectedStageId: stringValue(input.affectedStageId) ?? 'topic-goals',
          },
        },
      });
      if (approved.count !== 1) throw new SmartLessonPlanError('konling-suggestion-conflict', 409);
      return {
        task: updatedTask,
        affectedStageId: stringValue(input.affectedStageId) ?? 'topic-goals',
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({
      task: publicTask(result.task),
      affectedStageId: result.affectedStageId,
    });
  } catch (error) {
    if (failedAction.current) {
      const conflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
        || error instanceof SmartLessonPlanError
          && ['task-revision-conflict', 'konling-suggestion-scope-mismatch'].includes(error.code);
      await prisma.agentToolRun.updateMany({
        where: {
          id: failedAction.current.suggestionId,
          agentSessionId: failedAction.current.agentSessionId,
          ownerUserId: auth.actor.id,
          actorUserId: auth.actor.id,
          approvalState: 'confirmation_in_progress',
        },
        data: {
          approvalState: conflict ? 'conflict' : 'action_failed',
          outputSummary: {
            ...failedAction.current.outputSummary,
            actionState: conflict ? 'conflict' : 'failed',
          },
        },
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return smartLessonErrorResponse(new SmartLessonPlanError('task-revision-conflict', 409));
    }
    return smartLessonErrorResponse(error);
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}
