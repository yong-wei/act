import { NextResponse } from 'next/server';
import { z } from 'zod';

import { validatePipelineMutation } from '@/lib/data-governance/math-document-grading-contracts';
import { gradingApiError, readGradingJson, requireGradingTeacherActor } from '@/lib/data-governance/math-document-grading-api';
import { enforceGradingQuota } from '@/lib/data-governance/math-document-grading-lifecycle';
import { enqueueMathDocumentGradingJob } from '@/lib/data-governance/math-document-grading-queue';
import { enqueueGradingRun } from '@/lib/data-governance/math-document-grading-persistence';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const gradingRequestSchema = z.object({
  attemptId: z.string().trim().min(1).max(160),
  evidenceId: z.string().trim().min(1).max(160),
  policyId: z.string().trim().min(1).max(160).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
  rerunReason: z.string().trim().min(8).max(500).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const actorResult = await requireGradingTeacherActor();
    if ('response' in actorResult) return actorResult.response;
    const body = gradingRequestSchema.parse(await readGradingJson(request));
    const mutation = validatePipelineMutation({ request, body, requiresRerunReason: Boolean(body.rerunReason) });
    const quota = await enforceGradingQuota({ db: prisma, subjectType: 'user', subjectId: actorResult.actor.id, scope: 'grading', maxRequests: 40 });
    if (!quota.allowed) return NextResponse.json({ error: 'grading-quota-exceeded' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds ?? 60) } });
    const result = await enqueueGradingRun({ db: prisma, attemptId: body.attemptId, evidenceId: body.evidenceId, actor: actorResult.actor, idempotencyKey: mutation.idempotencyKey, policyId: body.policyId ?? null, rerunReason: mutation.rerunReason });
    const queueResult = result.job ? await enqueueMathDocumentGradingJob({ kind: 'grading', jobId: result.job.id, gradingRunId: result.run.id }, prisma) : { queued: true, queueJobId: null, state: 'QUEUED' as const, retryable: false };
    return NextResponse.json({ status: queueResult.queued ? result.run.state : queueResult.state, gradingRunId: result.run.id, jobId: result.job?.id ?? null, queue: queueResult, replay: result.replay, draftOnly: true }, { status: queueResult.queued ? (result.replay ? 200 : 202) : 503 });
  } catch (error) {
    return gradingApiError(error);
  }
}
