import { NextResponse } from 'next/server';
import { z } from 'zod';

import { readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import {
  AssignmentSubmissionGradeError,
  teacherConfirmAssignmentResult,
  teacherConcludeAssignmentQuestion,
  teacherGetAssignmentGradingClosure,
  teacherRefreshAssignmentGradingClosure,
  teacherReleaseAssignmentResult,
  teacherReturnAssignmentQuestion,
} from '@/lib/assignments/public-api';

const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('REFRESH'), snapshotId: z.string().trim().min(1).max(160) }).strict(),
  z.object({ action: z.literal('CONCLUDE'), snapshotId: z.string().trim().min(1).max(160), snapshotItemId: z.string().trim().min(1).max(160), kind: z.enum(['UNANSWERED', 'EXEMPT']), scoreEffect: z.number().finite().min(0).max(100_000), reason: z.string().trim().min(1).max(2_000) }).strict(),
  z.object({ action: z.literal('CONFIRM'), snapshotId: z.string().trim().min(1).max(160) }).strict(),
  z.object({ action: z.literal('RELEASE'), snapshotId: z.string().trim().min(1).max(160) }).strict(),
  z.object({ action: z.literal('RETURN'), snapshotId: z.string().trim().min(1).max(160), snapshotItemId: z.string().trim().min(1).max(160), reason: z.string().trim().min(8).max(2_000), newDeadlineAt: z.string().datetime(), idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/) }).strict(),
]);

const querySchema = z.object({ snapshotId: z.string().trim().min(1).max(160) }).strict();

export async function GET(request: Request, context: { params: Promise<{ assignmentId: string; submissionId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  try {
    const { assignmentId, submissionId } = await context.params;
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return NextResponse.json(await teacherGetAssignmentGradingClosure({ actor: auth.actor, assignmentId, submissionId, snapshotId: query.snapshotId }));
  } catch (error) {
    const status = error instanceof AssignmentSubmissionGradeError ? error.status : 422;
    const code = error instanceof AssignmentSubmissionGradeError ? error.code : 'assignment-result-invalid-request';
    const details = error instanceof AssignmentSubmissionGradeError ? error.details : undefined;
    return NextResponse.json({ error: code, ...(details === undefined ? {} : { details }) }, { status });
  }
}

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string; submissionId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response!;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId, submissionId } = await context.params;
    const body = requestSchema.parse(await readBoundedAssignmentJson(request, 32_000));
    const base = { actor: auth.actor, assignmentId, submissionId, snapshotId: body.snapshotId };
    const result = body.action === 'REFRESH'
      ? await teacherRefreshAssignmentGradingClosure(base)
      : body.action === 'CONCLUDE'
        ? await teacherConcludeAssignmentQuestion({ ...base, snapshotItemId: body.snapshotItemId, kind: body.kind, scoreEffect: body.scoreEffect, reason: body.reason })
        : body.action === 'CONFIRM'
          ? await teacherConfirmAssignmentResult(base)
          : body.action === 'RELEASE'
            ? await teacherReleaseAssignmentResult(base)
            : await teacherReturnAssignmentQuestion({ ...base, snapshotItemId: body.snapshotItemId, reason: body.reason, newDeadlineAt: new Date(body.newDeadlineAt), idempotencyKey: body.idempotencyKey });
    return NextResponse.json({ submissionId, ...result }, { status: (result as any).replay ? 200 : 201 });
  } catch (error) {
    const status = error instanceof AssignmentSubmissionGradeError ? error.status : 422;
    const code = error instanceof AssignmentSubmissionGradeError ? error.code : 'assignment-result-invalid-request';
    const details = error instanceof AssignmentSubmissionGradeError ? error.details : undefined;
    return NextResponse.json({ error: code, ...(details === undefined ? {} : { details }) }, { status });
  }
}
