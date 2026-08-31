import { NextResponse } from 'next/server';
import { z } from 'zod';

import { readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { teacherRetryAssignmentGradingBatchItem } from '@/lib/assignments/public-api';

export const dynamic = 'force-dynamic';

const retrySchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  reason: z.string().trim().min(1).max(2_000),
}).strict();

function retryErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : 'grading-retry-failed';
  const status = code.includes('forbidden') ? 403 : code.includes('not-found') ? 404 : code.includes('not-retryable') || code.includes('quota') ? 409 : 422;
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string; batchId: string; itemId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId, batchId, itemId } = await context.params;
    const body = retrySchema.parse(await readBoundedAssignmentJson(request, 16_000));
    const result = await teacherRetryAssignmentGradingBatchItem({ actor: auth.actor, assignmentId, batchId, itemId, idempotencyKey: body.idempotencyKey, reason: body.reason });
    if (result.kind === 'not-found') return NextResponse.json({ error: 'grading-batch-not-found' }, { status: 404 });
    if (result.kind === 'conversion') return NextResponse.json({ job: result.job, replay: result.replay, stage: 'conversion' }, { status: result.replay ? 200 : 202 });
    return NextResponse.json({ job: result.job, replay: result.replay }, { status: result.replay ? 200 : 202 });
  } catch (error) {
    return retryErrorResponse(error);
  }
}
