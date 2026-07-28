import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

import {
  idSchema,
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
  try {
    const suggestionId = idSchema.parse((await context.params).suggestionId);
    const body = await readStrictJson(request);
    if (Object.keys(record(body)).length) {
      return NextResponse.json({ error: { code: 'invalid-input' } }, { status: 400 });
    }
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
    if (!run) return NextResponse.json({ error: { code: 'konling-suggestion-not-found' } }, { status: 404 });
    if (run.approvalState === 'ignored') {
      return NextResponse.json({ state: 'ignored' });
    }
    if (['approved', 'conflict', 'action_failed', 'confirmation_in_progress'].includes(run.approvalState)) {
      return NextResponse.json({ error: { code: 'konling-suggestion-conflict' } }, { status: 409 });
    }
    const sessionState = record(run.agentSession.stateJson);
    const suggestion = record(run.inputSummary);
    const binding = record(sessionState.smartPrepBinding);
    const turnId = typeof suggestion.turnId === 'string' ? suggestion.turnId : null;
    const validOperation = suggestion.operation === 'bootstrap'
      ? true
      : (suggestion.operation === 'revise'
        && typeof suggestion.taskId === 'string'
        && binding.taskId === suggestion.taskId
        && binding.ownerUserId === auth.actor.id);
    if (
      !validOperation
      || !turnId
      || run.agentSession.ownerUserId !== auth.actor.id
      || run.agentSession.actorUserId !== auth.actor.id
      || !Array.isArray(sessionState.ownedTurnIds)
      || !sessionState.ownedTurnIds.includes(turnId)
    ) {
      return NextResponse.json({ error: { code: 'konling-suggestion-scope-mismatch' } }, { status: 409 });
    }
    const ignored = await prisma.agentToolRun.updateMany({
      where: {
        id: run.id,
        agentSessionId: run.agentSessionId,
        ownerUserId: auth.actor.id,
        actorUserId: auth.actor.id,
        approvalState: 'not_required',
      },
      data: {
        approvalState: 'ignored',
        outputSummary: {
          ...record(run.outputSummary),
          actionState: 'ignored',
        } as Prisma.InputJsonObject,
      },
    });
    if (ignored.count !== 1) {
      return NextResponse.json({ error: { code: 'konling-suggestion-conflict' } }, { status: 409 });
    }
    return NextResponse.json({ state: 'ignored' });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
