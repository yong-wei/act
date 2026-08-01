import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assignmentDraftPersistenceSchema } from '@/lib/assignments/assignment-domain';
import { assignmentErrorResponse, readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { deleteDraftRevision, updateAssignmentDraft } from '@/lib/assignments/assignment-service';
import { prisma } from '@/lib/prisma';

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
  const { assignmentId } = await context.params;
  const assignment = await prisma.assignment.findFirst({
    where: auth.actor.role === 'ADMIN' ? { id: assignmentId } : { id: assignmentId, authorId: auth.actor.id },
    include: {
      revisions: {
        orderBy: { revisionNumber: 'desc' },
        include: { questions: { orderBy: { orderIndex: 'asc' } }, audiences: true },
      },
    },
  });
  if (!assignment) return NextResponse.json({ error: 'assignment-not-found' }, { status: 404 });
  return NextResponse.json({ assignment });
}

export async function PATCH(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId } = await context.params;
    const input = updateSchema.parse(await readBoundedAssignmentJson(request));
    const revision = await updateAssignmentDraft(prisma, { actor: auth.actor, assignmentId, ...input });
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
    await deleteDraftRevision(prisma, { actor: auth.actor, assignmentId, ...input });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
