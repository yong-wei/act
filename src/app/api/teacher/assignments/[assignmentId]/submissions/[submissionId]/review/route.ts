import { NextResponse } from 'next/server';
import { z } from 'zod';

import { readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { createTeacherAssignmentReview, getTeacherAssignmentReview, saveTeacherAssignmentReview } from '@/lib/data-governance/teacher-assignment-review';
import { teacherAssignmentReviewErrorResponse } from '@/lib/data-governance/teacher-assignment-review-api';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const openSchema = z.object({ gradingRunId: z.string().trim().min(1).max(160) }).strict();

const criterionSchema = z.object({
  criterionId: z.string().trim().min(1).max(160),
  levelId: z.string().trim().min(1).max(160),
  score: z.number().finite().min(0).max(100_000),
  comment: z.string().max(2_000),
}).strict();

const annotationSchema = z.object({
  id: z.string().trim().min(1).max(160).optional(),
  criterionId: z.string().trim().min(1).max(160),
  status: z.enum(['ACTIVE', 'SUPPRESSED']),
  comment: z.string().max(2_000),
  anchor: z.object({
    blockId: z.string().trim().min(1).max(160).optional(),
    pageNumber: z.number().int().positive().optional(),
    spanStart: z.number().int().nonnegative().optional(),
    spanEnd: z.number().int().nonnegative().optional(),
    bbox: z.array(z.number().finite()).length(4).optional(),
    precision: z.enum(['SPAN', 'BLOCK', 'PAGE']),
    excerpt: z.string().max(2_000).optional(),
  }).strict(),
  origin: z.enum(['AI_DRAFT', 'TEACHER']).optional(),
}).strict();

const saveSchema = z.object({
  reviewId: z.string().trim().min(1).max(160),
  expectedVersion: z.number().int().positive(),
  criteria: z.array(criterionSchema).min(1).max(100),
  annotations: z.array(annotationSchema).max(500),
  overallComment: z.string().max(5_000),
}).strict();

export async function GET(request: Request, context: { params: Promise<{ assignmentId: string; submissionId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  try {
    const { assignmentId, submissionId } = await context.params;
    const url = new URL(request.url);
    const query = z.object({
      reviewId: z.string().trim().min(1).max(160).optional(),
      gradingRunId: z.string().trim().min(1).max(160).optional(),
    }).strict().parse(Object.fromEntries(url.searchParams));
    const review = await getTeacherAssignmentReview(prisma, { actor: auth.actor, assignmentId, submissionId, reviewId: query.reviewId, gradingRunId: query.gradingRunId });
    return NextResponse.json({ review });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return teacherAssignmentReviewErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string; submissionId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId, submissionId } = await context.params;
    const body = openSchema.parse(await readBoundedAssignmentJson(request, 32_000));
    const result = await createTeacherAssignmentReview(prisma, { actor: auth.actor, assignmentId, submissionId, gradingRunId: body.gradingRunId });
    return NextResponse.json(result, { status: result.replay ? 200 : 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return teacherAssignmentReviewErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ assignmentId: string; submissionId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId, submissionId } = await context.params;
    const body = saveSchema.parse(await readBoundedAssignmentJson(request));
    const review = await saveTeacherAssignmentReview(prisma, { actor: auth.actor, assignmentId, submissionId, ...body });
    return NextResponse.json({ review });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return teacherAssignmentReviewErrorResponse(error);
  }
}
