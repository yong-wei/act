import { NextResponse } from 'next/server';
import { z } from 'zod';

import { enqueueMathDocumentGradingJob } from '@/lib/data-governance/math-document-grading-queue';
import {
  validatePipelineMutation,
} from '@/lib/data-governance/math-document-grading-contracts';
import {
  enqueueDocumentConversion,
} from '@/lib/data-governance/math-document-grading-persistence';
import {
  gradingApiError,
  readGradingJson,
  requireGradingTeacherActor,
} from '@/lib/data-governance/math-document-grading-api';
import { enforceGradingQuota } from '@/lib/data-governance/math-document-grading-lifecycle';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const conversionRequestSchema = z.object({
  assetId: z.string().trim().min(1).max(160),
  attemptId: z.string().trim().min(1).max(160),
  adapterVersion: z.string().trim().min(1).max(120).default('router.v1'),
  policyId: z.string().trim().min(1).max(160).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const actorResult = await requireGradingTeacherActor();
    if ('response' in actorResult) return actorResult.response;
    const body = conversionRequestSchema.parse(await readGradingJson(request));
    const mutation = validatePipelineMutation({ request, body });
    const quota = await enforceGradingQuota({ db: prisma, subjectType: 'user', subjectId: actorResult.actor.id, scope: 'conversion', maxRequests: 50 });
    if (!quota.allowed) return NextResponse.json({ error: 'grading-quota-exceeded' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds ?? 60) } });
    const result = await enqueueDocumentConversion({
      db: prisma,
      assetId: body.assetId,
      attemptId: body.attemptId,
      actor: actorResult.actor,
      adapterVersion: body.adapterVersion,
      policyId: body.policyId ?? null,
      idempotencyKey: mutation.idempotencyKey,
      reason: body.reason,
    });
    const queueResult = result.job ? await enqueueMathDocumentGradingJob({ kind: 'conversion', jobId: result.job.id, conversionId: result.conversion.id }, prisma) : { queued: true, queueJobId: null, state: 'QUEUED' as const, retryable: false };
    return NextResponse.json({
      status: queueResult.queued ? result.conversion.state : queueResult.state,
      conversionId: result.conversion.id,
      jobId: result.job?.id ?? null,
      queue: queueResult,
      replay: result.replay,
      source: { assetId: body.assetId, attemptId: body.attemptId },
    }, { status: queueResult.queued ? (result.replay ? 200 : 202) : 503 });
  } catch (error) {
    return gradingApiError(error);
  }
}
