import { NextResponse } from 'next/server';
import { z } from 'zod';

import { buildGradingRequestHash, validatePipelineMutation } from '@/lib/data-governance/math-document-grading-contracts';
import { gradingApiError, readGradingJson, requireGradingTeacherActor } from '@/lib/data-governance/math-document-grading-api';
import { materializeTextAnswerEvidence } from '@/lib/data-governance/math-document-grading-persistence';
import { enforceGradingQuota } from '@/lib/data-governance/math-document-grading-lifecycle';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const evidenceRequestSchema = z.object({
  attemptId: z.string().trim().min(1).max(160),
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict();

export async function POST(request: Request) {
  try {
    const actorResult = await requireGradingTeacherActor();
    if ('response' in actorResult) return actorResult.response;
    const body = evidenceRequestSchema.parse(await readGradingJson(request));
    const mutation = validatePipelineMutation({ request, body });
    const quota = await enforceGradingQuota({ db: prisma, subjectType: 'user', subjectId: actorResult.actor.id, scope: 'evidence', maxRequests: 100 });
    if (!quota.allowed) return NextResponse.json({ error: 'grading-quota-exceeded' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds ?? 60) } });
    const result = await materializeTextAnswerEvidence({
      db: prisma,
      attemptId: body.attemptId,
      actor: actorResult.actor,
      operation: 'answer-evidence',
      idempotencyKey: mutation.idempotencyKey,
      requestHash: buildGradingRequestHash('answer-evidence', { attemptId: body.attemptId.trim(), sourceKind: 'TEXT_NATIVE' }),
    });
    return NextResponse.json({ status: result.evidence.readiness, evidenceId: result.evidence.id, sourceKind: result.evidence.sourceKind, precision: result.evidence.precision, replay: result.replay }, { status: result.replay ? 200 : 201 });
  } catch (error) {
    return gradingApiError(error);
  }
}
