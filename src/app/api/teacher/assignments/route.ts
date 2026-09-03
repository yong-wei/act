import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assignmentErrorResponse, readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { assignmentDraftPersistenceSchema, teacherCreateDraft, teacherListAssignments } from '@/lib/assignments/public-api';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  courseContext: z.string().trim().max(200).optional(),
  draft: assignmentDraftPersistenceSchema,
}).strict();

export async function GET() {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const assignments = await teacherListAssignments(auth.actor);
  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const input = createSchema.parse(await readBoundedAssignmentJson(request));
    const assignment = await teacherCreateDraft(auth.actor, input);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
