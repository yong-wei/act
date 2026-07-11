import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assignmentDraftSchema } from '@/lib/assignments/assignment-domain';
import { assignmentErrorResponse, readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { createAssignmentDraft } from '@/lib/assignments/assignment-service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  courseContext: z.string().trim().max(200).optional(),
  draft: assignmentDraftSchema,
}).strict();

export async function GET() {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const assignments = await prisma.assignment.findMany({
    where: auth.actor.role === 'ADMIN' ? {} : { authorId: auth.actor.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      revisions: { orderBy: { revisionNumber: 'desc' }, take: 1, include: { audiences: { select: { classId: true, availableAt: true, dueAt: true } } } },
    },
  });
  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const input = createSchema.parse(await readBoundedAssignmentJson(request));
    const assignment = await createAssignmentDraft(prisma, { actor: auth.actor, ...input });
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
