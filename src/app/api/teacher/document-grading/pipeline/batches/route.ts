import { NextResponse } from 'next/server';
import { z } from 'zod';

import { gradingMathpixPolicyId, validatePipelineMutation } from '@/lib/data-governance/math-document-grading-contracts';
import { gradingApiError, readGradingJson, requireGradingTeacherActor } from '@/lib/data-governance/math-document-grading-api';
import { enforceGradingQuota } from '@/lib/data-governance/math-document-grading-lifecycle';
import { enqueueMathDocumentGradingJob } from '@/lib/data-governance/math-document-grading-queue';
import { createQuestionScopedGradingBatch } from '@/lib/data-governance/math-document-grading-batch';
import { assertPipelineActorScope } from '@/lib/data-governance/math-document-grading-persistence';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const batchRequestSchema = z.object({
  assignmentRevisionId: z.string().trim().min(1).max(160),
  questionId: z.string().trim().min(1).max(160),
  classId: z.string().trim().min(1).max(160),
  policyId: z.string().trim().min(1).max(160).nullable().optional(),
  conversionPolicyId: z.string().trim().min(1).max(160).nullable().optional(),
  conversionImagePolicyId: z.string().trim().min(1).max(160).nullable().optional(),
  conversionDocumentPolicyId: z.string().trim().min(1).max(160).nullable().optional(),
  maxItems: z.number().int().positive().max(200).optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
  rerunReason: z.string().trim().min(8).max(500).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const actorResult = await requireGradingTeacherActor();
    if ('response' in actorResult) return actorResult.response;
    const body = batchRequestSchema.parse(await readGradingJson(request));
    const mutation = validatePipelineMutation({ request, body, requiresRerunReason: Boolean(body.rerunReason) });
    const quota = await enforceGradingQuota({ db: prisma, subjectType: 'user', subjectId: actorResult.actor.id, scope: 'batch', maxRequests: 10 });
    if (!quota.allowed) return NextResponse.json({ error: 'grading-quota-exceeded' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds ?? 60) } });
    const mathpixEnabled = ['1', 'true', 'yes'].includes((process.env.GRADING_MATHPIX_ENABLED ?? '').trim().toLowerCase());
    const mathpixVersion = (process.env.GRADING_MATHPIX_POLICY_VERSION ?? process.env.MATHPIX_VERSION ?? '').trim();
    const useSeededPair = mathpixEnabled && Boolean(mathpixVersion) && !body.conversionPolicyId && !body.conversionImagePolicyId && !body.conversionDocumentPolicyId;
    const result = await createQuestionScopedGradingBatch({ db: prisma, request: {
      ...body,
      idempotencyKey: mutation.idempotencyKey,
      actor: actorResult.actor,
      policyId: body.policyId ?? null,
      conversionImagePolicyId: body.conversionImagePolicyId ?? (useSeededPair ? gradingMathpixPolicyId(mathpixVersion, 'image') : null),
      conversionDocumentPolicyId: body.conversionDocumentPolicyId ?? (useSeededPair ? gradingMathpixPolicyId(mathpixVersion, 'document') : null),
      rerunReason: mutation.rerunReason,
    } });
    const queueResult = result.batch.job ? await enqueueMathDocumentGradingJob({ kind: 'batch', jobId: result.batch.job.id, batchId: result.batch.id }, prisma) : { queued: true, queueJobId: null, state: 'QUEUED' as const, retryable: false };
    return NextResponse.json({ status: queueResult.queued ? result.batch.state : queueResult.state, batchId: result.batch.id, totalItems: result.items.length, queue: queueResult, replay: result.replay, questionScoped: true }, { status: queueResult.queued ? (result.replay ? 200 : 202) : 503 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return gradingApiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const actorResult = await requireGradingTeacherActor();
    if ('response' in actorResult) return actorResult.response;
    const batchId = new URL(request.url).searchParams.get('batchId');
    if (!batchId) return NextResponse.json({ error: 'batch-id-required' }, { status: 400 });
    const batch = await prisma.gradingBatch.findUnique({ where: { id: batchId }, include: { class: true, jobs: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, state: true, progress: true, attemptCount: true, lastErrorCode: true, nextRunAt: true } }, items: { select: { id: true, attemptId: true, state: true, progress: true, retryCount: true, failureCode: true, gradingRunId: true } } } });
    if (!batch) return NextResponse.json({ error: 'grading-batch-not-found' }, { status: 404 });
    if (!batch.assignmentRevisionId || !batch.classId || !batch.class) return NextResponse.json({ error: 'grading-batch-content-unavailable' }, { status: 410 });
    try {
      await assertPipelineActorScope({ db: prisma, actor: actorResult.actor, assignmentRevisionId: batch.assignmentRevisionId, classId: batch.classId, classTeacherId: batch.class.teacherId, ownerStudentId: 'class-batch', purpose: 'teacher-review', now: new Date() });
    } catch {
      return NextResponse.json({ error: 'batch-forbidden' }, { status: 403 });
    }
    return NextResponse.json({ batchId: batch.id, assignmentRevisionId: batch.assignmentRevisionId, questionId: batch.questionId, classId: batch.classId, state: batch.state, progress: { total: batch.totalItems, completed: batch.completedItems, failed: batch.failedItems, blocked: batch.blockedItems, percent: batch.progress }, job: batch.jobs[0] ?? null, items: batch.items });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return gradingApiError(error);
  }
}
