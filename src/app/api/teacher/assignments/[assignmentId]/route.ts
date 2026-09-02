import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assignmentErrorResponse, readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { assignmentDraftPersistenceSchema, teacherDeleteDraft, teacherGetAssignment, teacherUpdateDraft } from '@/lib/assignments/public-api';

const updateSchema = z.object({
  revisionId: z.string().trim().min(1).max(120),
  expectedVersion: z.number().int().positive(),
  draft: assignmentDraftPersistenceSchema,
}).strict();

const deleteSchema = z.object({
  revisionId: z.string().trim().min(1).max(120),
  expectedVersion: z.number().int().positive(),
}).strict();

export async function GET(_request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  try {
    const { assignmentId } = await context.params;
    return NextResponse.json({ assignment: await teacherGetAssignment(auth.actor, assignmentId) });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId } = await context.params;
    const input = updateSchema.parse(await readBoundedAssignmentJson(request));
    const revision = await teacherUpdateDraft(auth.actor, { assignmentId, ...input });
    return NextResponse.json({ revision });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId } = await context.params;
    const input = deleteSchema.parse(await readBoundedAssignmentJson(request));
    await teacherDeleteDraft(auth.actor, { assignmentId, ...input });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
