import { NextResponse } from 'next/server';
import { z } from 'zod';

import { readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { teacherStartAssignmentAiGrading } from '@/lib/assignments/public-api';

export const dynamic = 'force-dynamic';

const startSchema = z.object({
  revisionId: z.string().trim().min(1).max(160).optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
  studentIds: z.array(z.string().trim().min(1).max(160)).max(500).optional(),
  excludedStudentIds: z.array(z.string().trim().min(1).max(160)).max(500).optional(),
  policyId: z.string().trim().min(1).max(160).nullable().optional(),
  conversionPolicyId: z.string().trim().min(1).max(160).nullable().optional(),
  conversionImagePolicyId: z.string().trim().min(1).max(160).nullable().optional(),
  conversionDocumentPolicyId: z.string().trim().min(1).max(160).nullable().optional(),
  visualPolicyId: z.string().trim().min(1).max(160).nullable().optional(),
  evaluatorId: z.string().trim().min(1).max(160).optional(),
  evaluatorVersion: z.string().trim().min(1).max(160).optional(),
}).strict();

function gradingErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : 'assignment-grading-failed';
  const status = code.includes('forbidden') ? 403
    : code.includes('not-found') ? 404
      : code.includes('before-deadline') || code.includes('operation-conflict') ? 409
        : 422;
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId } = await context.params;
    const body = startSchema.parse(await readBoundedAssignmentJson(request, 32_000));
    const result = await teacherStartAssignmentAiGrading({
      assignmentId,
      revisionId: body.revisionId,
      actor: auth.actor,
      idempotencyKey: body.idempotencyKey,
      studentIds: body.studentIds,
      excludedStudentIds: body.excludedStudentIds,
      batchOptions: {
        policyId: body.policyId,
        conversionPolicyId: body.conversionPolicyId,
        conversionImagePolicyId: body.conversionImagePolicyId,
        conversionDocumentPolicyId: body.conversionDocumentPolicyId,
        visualPolicyId: body.visualPolicyId,
        evaluatorId: body.evaluatorId,
        evaluatorVersion: body.evaluatorVersion,
      },
    });
    return NextResponse.json(result, { status: result.replay ? 200 : 202 });
  } catch (error) {
    return gradingErrorResponse(error);
  }
}
