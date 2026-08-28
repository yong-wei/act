import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  readBoundedAssignmentJson,
  requireAssignmentActor,
  requireAssignmentMutation,
  teacherAssignmentReviewErrorResponse,
} from '@/lib/assignments/assignment-route-guards';
import { teacherApproveReview } from '@/lib/assignments/public-api';

const approveSchema = z.object({
  reviewId: z.string().trim().min(1).max(160),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  confirmIncompleteEvidence: z.boolean().optional().default(false),
  omittedAssetIds: z.array(z.string().trim().min(1).max(160)).max(10)
    .refine((ids) => new Set(ids).size === ids.length, 'duplicate-omitted-asset-id')
    .optional(),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string; submissionId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId, submissionId } = await context.params;
    const body = approveSchema.parse(await readBoundedAssignmentJson(request, 32_000));
    const result = await teacherApproveReview(auth.actor, assignmentId, submissionId, body);
    return NextResponse.json(result, { status: result.replay ? 200 : 201 });
  } catch (error) {
    return teacherAssignmentReviewErrorResponse(error);
  }
}
