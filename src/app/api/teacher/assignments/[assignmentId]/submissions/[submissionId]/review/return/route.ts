import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  assignmentErrorResponse,
  readBoundedAssignmentJson,
  requireAssignmentActor,
  requireAssignmentMutation,
} from '@/lib/assignments/assignment-route-guards';
import { teacherReturnReview } from '@/lib/assignments/public-api';

const returnSchema = z.object({
  reviewId: z.string().trim().min(1).max(160),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  reason: z.string().trim().min(8).max(2_000),
  allowedResponseType: z.enum(['SUBJECTIVE_TEXT', 'SUBJECTIVE_FILE']),
  newDeadlineAt: z.string().datetime(),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string; submissionId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId, submissionId } = await context.params;
    const body = returnSchema.parse(await readBoundedAssignmentJson(request, 32_000));
    const result = await teacherReturnReview(auth.actor, assignmentId, submissionId, {
      ...body,
      newDeadlineAt: new Date(body.newDeadlineAt),
    });
    return NextResponse.json(result, { status: result.replay ? 200 : 201 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
