import { NextResponse } from 'next/server';
import { z } from 'zod';

import { buildGradingRequestHash, validatePipelineMutation } from '@/lib/data-governance/math-document-grading-contracts';
import { cancelQuestionGradingBatch, retryQuestionGradingBatchItem } from '@/lib/data-governance/math-document-grading-batch';
import { gradingApiError, readGradingJson, requireGradingTeacherActor } from '@/lib/data-governance/math-document-grading-api';
import { enqueueMathDocumentGradingJob } from '@/lib/data-governance/math-document-grading-queue';
import { enforceGradingQuota } from '@/lib/data-governance/math-document-grading-lifecycle';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const mutationSchema = z.object({
  action: z.enum(['cancel', 'retry-item']),
  itemId: z.string().trim().min(1).max(160).optional(),
  reason: z.string().trim().min(8).max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const actorResult = await requireGradingTeacherActor();
    if ('response' in actorResult) return actorResult.response;
    const { batchId } = await context.params;
    const body = mutationSchema.parse(await readGradingJson(request));
    const mutation = validatePipelineMutation({ request, body, requiresRerunReason: body.action === 'retry-item' });
    const quota = await enforceGradingQuota({ db: prisma, subjectType: 'user', subjectId: actorResult.actor.id, scope: 'batch-control', maxRequests: 50 });
    if (!quota.allowed) return NextResponse.json({ error: 'grading-quota-exceeded' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds ?? 60) } });
    if (body.action === 'cancel') {
      const batch = await cancelQuestionGradingBatch({ db: prisma, batchId, actor: actorResult.actor, idempotencyKey: mutation.idempotencyKey, requestHash: buildGradingRequestHash('grading-batch-cancel', { batchId }) });
      return NextResponse.json({ status: batch.state, batchId: batch.id, cancellationRequested: true });
    }
    if (!body.itemId || !body.reason) return NextResponse.json({ error: 'retry-item-requires-item-and-reason' }, { status: 400 });
    const result = await retryQuestionGradingBatchItem({ db: prisma, batchId, itemId: body.itemId, actor: actorResult.actor, idempotencyKey: mutation.idempotencyKey, requestHash: buildGradingRequestHash('grading-batch-item-retry', { batchId, itemId: body.itemId, reason: body.reason.trim() }), reason: body.reason });
    const queueResult = await enqueueMathDocumentGradingJob({ kind: 'retry', jobId: result.job.id, batchId, batchItemId: body.itemId }, prisma);
    return NextResponse.json({ status: queueResult.queued ? result.job.state : queueResult.state, batchId, itemId: body.itemId, rerunIdentity: result.rerunIdentity, queue: queueResult }, { status: queueResult.queued ? 202 : 503 });
  } catch (error) {
    return gradingApiError(error);
  }
}
