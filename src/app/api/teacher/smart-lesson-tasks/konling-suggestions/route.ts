import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

import { requireSmartLessonActor, smartLessonErrorResponse } from '../_shared';

export async function GET() {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  if (auth.actor.role !== 'TEACHER') {
    return NextResponse.json({ error: { code: 'teacher-confirmation-required' } }, { status: 403 });
  }
  try {
    const rows = await prisma.agentToolRun.findMany({
      where: {
        ownerUserId: auth.actor.id,
        actorUserId: auth.actor.id,
        toolName: 'propose_smart_lesson_task_change',
        status: 'succeeded',
        agentSession: {
          ownerUserId: auth.actor.id,
          actorUserId: auth.actor.id,
          pageId: '/teacher/smart-prep',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, agentSessionId: true, inputSummary: true, outputSummary: true, approvalState: true, createdAt: true },
    });
    return NextResponse.json({
      suggestions: rows.flatMap((row) => {
        const input = record(row.inputSummary);
        if (input.operation !== 'bootstrap' || typeof input.turnId !== 'string') return [];
        return [{
          id: row.id,
          agentSessionId: row.agentSessionId,
          turnId: input.turnId,
          proposedTask: recordOrUndefined(input.proposedTask),
          clarification: recordOrUndefined(input.clarification),
          confirmedTaskId: stringValue(record(row.outputSummary).confirmedTaskId),
          approvalState: row.approvalState,
          createdAt: row.createdAt,
        }];
      }),
    });
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

function stringValue(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}
