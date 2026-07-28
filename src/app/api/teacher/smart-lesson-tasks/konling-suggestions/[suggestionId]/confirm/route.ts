import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createSmartLessonTask } from '@/lib/smart-lesson-plan';

import {
  createTaskSchema,
  idSchema,
  publicTask,
  readStrictJson,
  requireSmartLessonActor,
  smartLessonErrorResponse,
} from '../../../_shared';

export async function POST(request: Request, context: { params: Promise<{ suggestionId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  if (auth.actor.role !== 'TEACHER') {
    return NextResponse.json({ error: { code: 'teacher-confirmation-required' } }, { status: 403 });
  }
  const failedAction: {
    current?: { suggestionId: string; agentSessionId: string; outputSummary: Record<string, unknown> };
  } = {};
  try {
    const suggestionId = idSchema.parse((await context.params).suggestionId);
    const body = await readStrictJson(request);
    if (Object.keys(record(body)).length) {
      return NextResponse.json({ error: { code: 'invalid-input' } }, { status: 400 });
    }
    const existing = await loadSuggestion(suggestionId, auth.actor.id);
    if (!existing) return NextResponse.json({ error: { code: 'konling-suggestion-not-found' } }, { status: 404 });
    const sessionState = record(existing.agentSession.stateJson);
    const input = record(existing.inputSummary);
    const turnId = stringValue(input.turnId);
    if (
      input.operation !== 'bootstrap'
      || !turnId
      || existing.agentSession.ownerUserId !== auth.actor.id
      || existing.agentSession.actorUserId !== auth.actor.id
      || !Array.isArray(sessionState.ownedTurnIds)
      || !sessionState.ownedTurnIds.includes(turnId)
    ) return NextResponse.json({ error: { code: 'konling-suggestion-scope-mismatch' } }, { status: 409 });
    const replayTaskId = stringValue(record(existing.outputSummary).confirmedTaskId);
    if (replayTaskId) return confirmedTaskResponse(replayTaskId, auth.actor.id);
    if (existing.approvalState !== 'not_required') {
      return NextResponse.json({ error: { code: `konling-suggestion-${existing.approvalState}` } }, { status: 409 });
    }
    const existingBinding = record(sessionState.smartPrepBinding);
    if (typeof existingBinding.taskId === 'string' && existingBinding.taskId) {
      await prisma.agentToolRun.updateMany({
        where: {
          id: existing.id,
          agentSessionId: existing.agentSessionId,
          ownerUserId: auth.actor.id,
          actorUserId: auth.actor.id,
          approvalState: 'not_required',
        },
        data: {
          approvalState: 'conflict',
          outputSummary: {
            ...record(existing.outputSummary),
            actionState: 'conflict',
          } as Prisma.InputJsonObject,
        },
      });
      return NextResponse.json({ error: { code: 'konling-bootstrap-session-already-bound' } }, { status: 409 });
    }

    const proposedTask = record(input.proposedTask);
    if (!Object.keys(proposedTask).length) {
      return NextResponse.json({ error: { code: 'konling-clarification-requires-answer' } }, { status: 409 });
    }
    // This endpoint is the teacher's explicit acceptance action. Model output
    // must not be allowed to downgrade that human confirmation into a draft.
    const parsed = createTaskSchema.parse({
      ...proposedTask,
      confirmScope: true,
      confirmGoals: true,
    });
    const claimed = await prisma.agentToolRun.updateMany({
      where: {
        id: existing.id,
        agentSessionId: existing.agentSessionId,
        ownerUserId: auth.actor.id,
        actorUserId: auth.actor.id,
        toolName: 'propose_smart_lesson_task_change',
        status: 'succeeded',
        approvalState: 'not_required',
      },
      data: { approvalState: 'confirmation_in_progress' },
    });
    if (claimed.count !== 1) throw new BootstrapConfirmationConflict();
    failedAction.current = {
      suggestionId: existing.id,
      agentSessionId: existing.agentSessionId,
      outputSummary: record(existing.outputSummary),
    };
    const task = await prisma.$transaction(async (tx) => {
      const currentSession = await tx.agentSession.findFirst({
        where: {
          id: existing.agentSessionId,
          ownerUserId: auth.actor.id,
          actorUserId: auth.actor.id,
        },
        select: { stateJson: true },
      });
      if (!currentSession || stringValue(record(record(currentSession.stateJson).smartPrepBinding).taskId)) {
        throw new BootstrapSessionBoundConflict();
      }
      const created = await createSmartLessonTask(tx as unknown as Parameters<typeof createSmartLessonTask>[0], {
        actor: auth.actor,
        ...parsed,
      });
      const approved = await tx.agentToolRun.updateMany({
        where: { id: existing.id, approvalState: 'confirmation_in_progress' },
        data: {
          approvalState: 'approved',
          outputSummary: {
            ...record(existing.outputSummary),
            confirmedTaskId: created.id,
            confirmedRevision: created.revision,
            affectedStageId: 'topic-goals',
          } as Prisma.InputJsonObject,
        },
      });
      if (approved.count !== 1) throw new BootstrapConfirmationConflict();
      const sessionUpdated = await tx.agentSession.updateMany({
        where: { id: existing.agentSessionId, ownerUserId: auth.actor.id, actorUserId: auth.actor.id },
        data: {
          stateJson: {
            ...sessionState,
            smartPrepBinding: { taskId: created.id, taskRevision: String(created.revision), ownerUserId: auth.actor.id },
          } as Prisma.InputJsonObject,
        },
      });
      if (sessionUpdated.count !== 1) throw new BootstrapSessionBoundConflict();
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({
      task: publicTask(task),
      affectedStageId: 'topic-goals',
    }, { status: 201 });
  } catch (error) {
    if (failedAction.current) {
      const conflict = error instanceof BootstrapSessionBoundConflict
        || error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
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
          } as Prisma.InputJsonObject,
        },
      });
    }
    if (error instanceof BootstrapConfirmationConflict) {
      return NextResponse.json({ error: { code: 'konling-bootstrap-confirmation-in-progress' } }, { status: 409 });
    }
    if (
      error instanceof BootstrapSessionBoundConflict
      || error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
    ) {
      return NextResponse.json({ error: { code: 'konling-bootstrap-session-already-bound' } }, { status: 409 });
    }
    return smartLessonErrorResponse(error);
  }
}

async function loadSuggestion(id: string, ownerId: string) {
  return prisma.agentToolRun.findFirst({
    where: {
      OR: [
        { id },
        { inputSummary: { path: ['publicActionId'], equals: id } },
      ],
      ownerUserId: ownerId,
      actorUserId: ownerId,
      toolName: 'propose_smart_lesson_task_change',
      status: 'succeeded',
    },
    include: { agentSession: { select: { ownerUserId: true, actorUserId: true, stateJson: true } } },
  });
}

async function confirmedTaskResponse(taskId: string, ownerId: string) {
  const task = await prisma.smartLessonTask.findFirst({
    where: { id: taskId, ownerId },
    include: { sources: true, knowledgePoints: true, goals: true, drafts: true },
  });
  if (!task) return NextResponse.json({ error: { code: 'smart-lesson-task-not-found' } }, { status: 404 });
  return NextResponse.json({
    task: publicTask(task),
    affectedStageId: 'topic-goals',
  });
}

class BootstrapConfirmationConflict extends Error {}
class BootstrapSessionBoundConflict extends Error {}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}
