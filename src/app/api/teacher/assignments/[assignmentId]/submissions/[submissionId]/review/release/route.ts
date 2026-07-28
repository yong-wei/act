import { NextResponse } from 'next/server';
import { z } from 'zod';

import { readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { requestTeacherAssignmentFeedbackRelease } from '@/lib/data-governance/teacher-assignment-review';
import { teacherAssignmentReviewErrorResponse } from '@/lib/data-governance/teacher-assignment-review-api';
import { prisma } from '@/lib/prisma';

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
    const result = await requestTeacherAssignmentFeedbackRelease(prisma, { actor: auth.actor, assignmentId, submissionId, ...body });
    return NextResponse.json(result);
  } catch (error) {
    return teacherAssignmentReviewErrorResponse(error);
  }
}
