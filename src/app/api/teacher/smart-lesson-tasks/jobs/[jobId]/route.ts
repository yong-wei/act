import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { cancelGenerationJob, enqueueSmartLessonGenerationJob, resumeGenerationJob, retryGenerationJob } from '@/lib/smart-lesson-plan';

import { idempotencySchema, idSchema, publicJob, readStrictJson, requireSmartLessonActor, smartLessonErrorResponse } from '../../_shared';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('resume'), idempotencyKey: idempotencySchema }).strict(),
  z.object({ action: z.literal('cancel'), idempotencyKey: idempotencySchema }).strict(),
  z.object({ action: z.literal('retry'), idempotencyKey: idempotencySchema, stage: z.enum(['OUTLINE', 'BRIDGE_IN', 'OBJECTIVES', 'PRE_ASSESSMENT', 'PARTICIPATORY_LEARNING', 'POST_ASSESSMENT', 'SUMMARY']).optional() }).strict(),
]);

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const jobId = idSchema.parse((await context.params).jobId);
    const input = schema.parse(await readStrictJson(request));
    const common = { actor: auth.actor, jobId, idempotencyKey: input.idempotencyKey };
    const job = input.action === 'resume'
      ? await resumeGenerationJob(prisma, common)
      : input.action === 'cancel'
        ? await cancelGenerationJob(prisma, common)
        : await retryGenerationJob(prisma, { ...common, stage: input.stage });
    const delivery = input.action !== 'cancel' && (job as { state?: unknown }).state === 'QUEUED'
      ? await enqueueSmartLessonGenerationJob(prisma, (job as { id: string }).id)
      : { job, errorCode: null };
    const deliveredJob = delivery.job ?? job;
    return NextResponse.json(
      { job: publicJob(deliveredJob as Parameters<typeof publicJob>[0]), ...(delivery.errorCode ? { error: { code: delivery.errorCode, retryable: true } } : {}) },
      { status: delivery.errorCode ? 503 : 200 },
    );
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}
