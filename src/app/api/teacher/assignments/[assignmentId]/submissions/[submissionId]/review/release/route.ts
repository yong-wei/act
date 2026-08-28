import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  assignmentErrorResponse,
  readBoundedAssignmentJson,
  requireAssignmentActor,
  requireAssignmentMutation,
} from '@/lib/assignments/assignment-route-guards';
import { teacherRequestFeedbackRelease } from '@/lib/assignments/public-api';

const releaseSchema = z.object({
  reviewId: z.string().trim().min(1).max(160),
  mode: z.enum(['RETRY_DERIVATIVE', 'STRUCTURED_ONLY']),
  limitationAcknowledgement: z.string().max(1_000).optional(),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string; submissionId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId, submissionId } = await context.params;
    const body = releaseSchema.parse(await readBoundedAssignmentJson(request, 8_000));
    const result = await teacherRequestFeedbackRelease(auth.actor, assignmentId, submissionId, body);
    return NextResponse.json(result);
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
