import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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

const confirmationSchema = z.object({ agentSessionId: idSchema, turnId: idSchema }).strict();

export async function POST(request: Request, context: { params: Promise<{ suggestionId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  if (auth.actor.role !== 'TEACHER') {
    return NextResponse.json({ error: { code: 'teacher-confirmation-required' } }, { status: 403 });
  }
  try {
    const suggestionId = idSchema.parse((await context.params).suggestionId);
    const confirmation = confirmationSchema.parse(await readStrictJson(request));
    const existing = await loadSuggestion(suggestionId, confirmation.agentSessionId, auth.actor.id);
    if (!existing) return NextResponse.json({ error: { code: 'konling-suggestion-not-found' } }, { status: 404 });
    const replayTaskId = stringValue(record(existing.outputSummary).confirmedTaskId);
    if (replayTaskId) return confirmedTaskResponse(replayTaskId, confirmation.agentSessionId, auth.actor.id);

    const sessionState = record(existing.agentSession.stateJson);
    const input = record(existing.inputSummary);
    if (
      input.operation !== 'bootstrap'
      || input.turnId !== confirmation.turnId
      || existing.agentSession.ownerUserId !== auth.actor.id
      || existing.agentSession.actorUserId !== auth.actor.id
      || !Array.isArray(sessionState.ownedTurnIds)
      || !sessionState.ownedTurnIds.includes(confirmation.turnId)
    ) return NextResponse.json({ error: { code: 'konling-suggestion-scope-mismatch' } }, { status: 409 });
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
    const task = await prisma.$transaction(async (tx) => {
      const claimed = await tx.agentToolRun.updateMany({
        where: { id: suggestionId, approvalState: { notIn: ['approved', 'confirmation_in_progress'] } },
        data: { approvalState: 'confirmation_in_progress' },
      });
      if (claimed.count !== 1) throw new BootstrapConfirmationConflict();
      const created = await createSmartLessonTask(tx as unknown as Parameters<typeof createSmartLessonTask>[0], {
        actor: auth.actor,
        ...parsed,
      });
      await tx.agentToolRun.update({
        where: { id: suggestionId },
        data: {
          approvalState: 'approved',
          outputSummary: { confirmedTaskId: created.id, confirmedRevision: created.revision } as Prisma.InputJsonObject,
        },
      });
      await tx.agentSession.updateMany({
        where: { id: confirmation.agentSessionId, ownerUserId: auth.actor.id, actorUserId: auth.actor.id },
        data: {
          stateJson: {
            ...sessionState,
            smartPrepBinding: { taskId: created.id, taskRevision: String(created.revision), ownerUserId: auth.actor.id },
          } as Prisma.InputJsonObject,
        },
      });
      return created;
    });
    return NextResponse.json({ task: publicTask(task), agentSessionId: confirmation.agentSessionId }, { status: 201 });
  } catch (error) {
    if (error instanceof BootstrapConfirmationConflict) {
      return NextResponse.json({ error: { code: 'konling-bootstrap-confirmation-in-progress' } }, { status: 409 });
    }
    return smartLessonErrorResponse(error);
  }
}

async function loadSuggestion(id: string, agentSessionId: string, ownerId: string) {
  return prisma.agentToolRun.findFirst({
    where: {
      id,
      agentSessionId,
      ownerUserId: ownerId,
      actorUserId: ownerId,
      toolName: 'propose_smart_lesson_task_change',
      status: 'succeeded',
    },
    include: { agentSession: { select: { ownerUserId: true, actorUserId: true, stateJson: true } } },
  });
}

async function confirmedTaskResponse(taskId: string, agentSessionId: string, ownerId: string) {
  const task = await prisma.smartLessonTask.findFirst({
    where: { id: taskId, ownerId },
    include: { sources: true, knowledgePoints: true, goals: true, drafts: true },
  });
  if (!task) return NextResponse.json({ error: { code: 'smart-lesson-task-not-found' } }, { status: 404 });
  return NextResponse.json({ task: publicTask(task), agentSessionId });
}

class BootstrapConfirmationConflict extends Error {}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}
