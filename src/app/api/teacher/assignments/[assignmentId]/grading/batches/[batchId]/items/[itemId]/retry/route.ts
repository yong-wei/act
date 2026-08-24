import { NextResponse } from 'next/server';
import { z } from 'zod';

import { readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { retryQuestionGradingBatchItem } from '@/lib/data-governance/math-document-grading-batch';
import { retryDocumentConversion } from '@/lib/data-governance/math-document-grading-persistence';
import { enqueueMathDocumentGradingJob } from '@/lib/data-governance/math-document-grading-queue';
import { prisma } from '@/lib/prisma';

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
    const batch = await prisma.gradingBatch.findUnique({
      where: { id: batchId },
      select: {
        revision: { select: { assignmentId: true } },
        items: {
          where: { id: itemId },
          select: { conversionId: true, conversion: { select: { state: true } } },
        },
      },
    });
    if (!batch || batch.revision?.assignmentId !== assignmentId) return NextResponse.json({ error: 'grading-batch-not-found' }, { status: 404 });
    const conversion = batch.items[0]?.conversion;
    const conversionId = batch.items[0]?.conversionId;
    if (conversionId && conversion && ['FAILED', 'RETRYABLE', 'BLOCKED'].includes(conversion.state)) {
      const result = await retryDocumentConversion({ db: prisma, conversionId, actor: auth.actor, ...body });
      const queue = result.job
        ? await enqueueMathDocumentGradingJob({ kind: 'conversion', jobId: result.job.id, conversionId: result.conversion.id }, prisma)
        : { queued: true };
      if (!queue.queued) return NextResponse.json({ error: 'conversion-retry-queue-unavailable' }, { status: 503 });
      return NextResponse.json({ job: result.job, replay: result.replay, stage: 'conversion' }, { status: result.replay ? 200 : 202 });
    }
    const result = await retryQuestionGradingBatchItem({ db: prisma, batchId, itemId, actor: auth.actor, ...body });
    return NextResponse.json({ job: result.job, replay: result.replay }, { status: result.replay ? 200 : 202 });
  } catch (error) {
    return retryErrorResponse(error);
  }
}
