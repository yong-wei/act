import { NextResponse } from 'next/server';
import { z } from 'zod';

import { readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { createManualQuestionGradingReview } from '@/lib/data-governance/assignment-grading-orchestration';
import { buildTeacherAssignmentReviewApiProjection } from '@/lib/assignments/assignment-review';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const manualSchema = z.object({
  submissionId: z.string().trim().min(1).max(160),
  questionId: z.string().trim().min(1).max(160),
  idempotencyKey: z.string().trim().min(8).max(200),
}).strict();

function manualErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : 'manual-grading-failed';
  const status = code.includes('before-deadline') ? 409 : code.includes('forbidden') ? 403 : code.includes('not-ready') ? 409 : 422;
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId } = await context.params;
    const body = manualSchema.parse(await readBoundedAssignmentJson(request, 16_000));
    const result = await createManualQuestionGradingReview({ db: prisma, assignmentId, actor: auth.actor, ...body });
    return NextResponse.json({
      run: { id: result.run.id, source: result.run.source, state: result.run.state },
      review: buildTeacherAssignmentReviewApiProjection(result.review),
      replay: result.replay,
    }, { status: result.replay ? 200 : 201 });
  } catch (error) {
    return manualErrorResponse(error);
  }
}
