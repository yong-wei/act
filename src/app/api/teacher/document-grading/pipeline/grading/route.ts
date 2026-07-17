import { NextResponse } from 'next/server';
import { z } from 'zod';

import { validatePipelineMutation } from '@/lib/data-governance/math-document-grading-contracts';
import { GradingMutationError } from '@/lib/data-governance/math-document-grading-contracts';
import { gradingApiError, readGradingJson, requireGradingTeacherActor } from '@/lib/data-governance/math-document-grading-api';
import { enforceGradingQuota } from '@/lib/data-governance/math-document-grading-lifecycle';
import { enqueueMathDocumentGradingJob } from '@/lib/data-governance/math-document-grading-queue';
import { enqueueGradingRun } from '@/lib/data-governance/math-document-grading-persistence';
import { prisma } from '@/lib/prisma';
import { assertPipelineReviewActor, buildPipelineReviewListItem, PIPELINE_GRADING_REVIEW_INCLUDE, validatePipelineReviewContract, validatePipelineUnavailableListLineage } from '@/lib/data-governance/math-document-grading-review';

export const dynamic = 'force-dynamic';

const gradingRequestSchema = z.object({
  attemptId: z.string().trim().min(1).max(160),
  evidenceId: z.string().trim().min(1).max(160),
  policyId: z.string().trim().min(1).max(160),
  idempotencyKey: z.string().trim().min(8).max(160),
  rerunReason: z.string().trim().min(8).max(500).optional(),
}).strict();

export async function GET() {
  try {
    const actorResult = await requireGradingTeacherActor();
    if ('response' in actorResult) return actorResult.response;
    const now = new Date();
    const frozenAuthorizationScope = actorResult.actor.role === 'ADMIN' ? [] : [
      ...(await prisma.class.findMany({
        where: { teacherId: actorResult.actor.id },
        select: { id: true },
      })).map(({ id }) => ({ authorizationSnapshot: { path: ['classId'], equals: id } })),
      ...(await prisma.assignmentRevision.findMany({
        where: { assignment: { OR: [
          { authorId: actorResult.actor.id },
          { reviewGrants: { some: { teacherId: actorResult.actor.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } },
        ] } },
        select: { id: true },
      })).map(({ id }) => ({ authorizationSnapshot: { path: ['assignmentRevisionId'], equals: id } })),
    ];
    const rows = await prisma.gradingRun.findMany({
      where: {
        state: { in: ['AWAITING_REVIEW', 'CONTENT_UNAVAILABLE'] },
        ...(actorResult.actor.role === 'ADMIN' ? {} : { OR: [
          { answerAttempt: { answer: { submission: { audience: { class: { teacherId: actorResult.actor.id } } } } } },
          { question: { revision: { assignment: { authorId: actorResult.actor.id } } } },
          { question: { revision: { assignment: { reviewGrants: { some: { teacherId: actorResult.actor.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } } } } },
          ...frozenAuthorizationScope,
        ] }),
      },
      include: PIPELINE_GRADING_REVIEW_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const visible = [];
    for (const run of rows) {
      try {
        const lineageReasons = run.state === 'CONTENT_UNAVAILABLE'
          ? validatePipelineUnavailableListLineage(run)
          : validatePipelineReviewContract(run, now);
        if (lineageReasons.length > 0) continue;
        await assertPipelineReviewActor({ db: prisma, run, actor: actorResult.actor, now });
        visible.push(buildPipelineReviewListItem(run));
      } catch (error) {
        if (error instanceof GradingMutationError) continue;
        if (!(error instanceof Error) || !['grading-forbidden', 'grading-review-class-drift'].includes(error.message)) throw error;
      }
    }
    return NextResponse.json({ items: visible });
  } catch (error) {
    return gradingApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actorResult = await requireGradingTeacherActor();
    if ('response' in actorResult) return actorResult.response;
    const body = gradingRequestSchema.parse(await readGradingJson(request));
    const mutation = validatePipelineMutation({ request, body, requiresRerunReason: Boolean(body.rerunReason) });
    const quota = await enforceGradingQuota({ db: prisma, subjectType: 'user', subjectId: actorResult.actor.id, scope: 'grading', maxRequests: 40 });
    if (!quota.allowed) return NextResponse.json({ error: 'grading-quota-exceeded' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds ?? 60) } });
    const result = await enqueueGradingRun({ db: prisma, attemptId: body.attemptId, evidenceId: body.evidenceId, actor: actorResult.actor, idempotencyKey: mutation.idempotencyKey, policyId: body.policyId, rerunReason: mutation.rerunReason });
    const queueResult = result.job ? await enqueueMathDocumentGradingJob({ kind: 'grading', jobId: result.job.id, gradingRunId: result.run.id }, prisma) : { queued: true, queueJobId: null, state: 'QUEUED' as const, retryable: false };
    return NextResponse.json({ status: queueResult.queued ? result.run.state : queueResult.state, gradingRunId: result.run.id, jobId: result.job?.id ?? null, queue: queueResult, replay: result.replay, draftOnly: true }, { status: queueResult.queued ? (result.replay ? 200 : 202) : 503 });
  } catch (error) {
    return gradingApiError(error);
  }
}
