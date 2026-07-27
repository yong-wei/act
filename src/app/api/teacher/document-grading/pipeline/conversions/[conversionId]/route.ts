import { NextResponse } from 'next/server';
import { z } from 'zod';

import { buildGradingRequestHash, validatePipelineMutation } from '@/lib/data-governance/math-document-grading-contracts';
import { cancelDocumentConversion, retryDocumentConversion } from '@/lib/data-governance/math-document-grading-persistence';
import { enqueueMathDocumentGradingJob } from '@/lib/data-governance/math-document-grading-queue';
import { gradingApiError, readGradingJson, requireGradingTeacherActor } from '@/lib/data-governance/math-document-grading-api';
import { enforceGradingQuota } from '@/lib/data-governance/math-document-grading-lifecycle';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const mutationSchema = z.object({
  action: z.enum(['cancel', 'retry']),
  reason: z.string().trim().min(8).max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ conversionId: string }> }) {
  try {
    const actorResult = await requireGradingTeacherActor();
    if ('response' in actorResult) return actorResult.response;
    const { conversionId } = await context.params;
    const body = mutationSchema.parse(await readGradingJson(request));
    const mutation = validatePipelineMutation({ request, body });
    const quota = await enforceGradingQuota({ db: prisma, subjectType: 'user', subjectId: actorResult.actor.id, scope: 'conversion-control', maxRequests: 50 });
    if (!quota.allowed) return NextResponse.json({ error: 'grading-quota-exceeded' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds ?? 60) } });
    if (body.action === 'cancel') {
      const conversion = await cancelDocumentConversion({ db: prisma, conversionId, actor: actorResult.actor, idempotencyKey: mutation.idempotencyKey, requestHash: buildGradingRequestHash('document-conversion-cancel', { conversionId }), });
      return NextResponse.json({ conversionId: conversion.id, status: conversion.state, cancellationRequested: true, replay: Boolean(conversion.replay) }, { status: conversion.replay ? 200 : 202 });
    }
    if (!body.reason) return NextResponse.json({ error: 'conversion-retry-reason-required' }, { status: 400 });
    const result = await retryDocumentConversion({ db: prisma, conversionId, actor: actorResult.actor, idempotencyKey: mutation.idempotencyKey, reason: body.reason });
    const queue = result.job ? await enqueueMathDocumentGradingJob({ kind: 'conversion', jobId: result.job.id, conversionId: result.conversion.id }, prisma) : { queued: true, queueJobId: null, state: 'QUEUED' as const, retryable: false };
    return NextResponse.json({ conversionId: result.conversion.id, jobId: result.job?.id ?? null, status: queue.queued ? result.conversion.state : queue.state, queue, replay: result.replay }, { status: queue.queued ? (result.replay ? 200 : 202) : 503 });
  } catch (error) {
    return gradingApiError(error);
  }
}
