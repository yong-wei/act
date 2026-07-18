import { NextResponse } from 'next/server';

import { assignmentErrorResponse, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { createNextDraftRevision } from '@/lib/assignments/assignment-service';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId } = await context.params;
    const revision = await createNextDraftRevision(prisma, { actor: auth.actor, assignmentId });
    return NextResponse.json({ revision });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
