import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { enqueueSmartLessonGenerationJob, startGenerationJob } from '@/lib/smart-lesson-plan';

import { idempotencySchema, idSchema, publicJob, readStrictJson, requireSmartLessonActor, smartLessonErrorResponse } from '../../../_shared';

const schema = z.object({ idempotencyKey: idempotencySchema }).strict();

export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const draftId = idSchema.parse((await context.params).draftId);
    const input = schema.parse(await readStrictJson(request));
    const job = await startGenerationJob(prisma, { actor: auth.actor, draftId, ...input });
    const delivery = job.state === 'QUEUED'
      ? await enqueueSmartLessonGenerationJob(prisma, job.id)
      : { queued: false, job, errorCode: null };
    const deliveredJob = delivery.job ?? job;
    return NextResponse.json(
      { job: publicJob(deliveredJob), ...(delivery.errorCode ? { error: { code: delivery.errorCode, retryable: true } } : {}) },
      { status: delivery.errorCode ? 503 : 202 },
    );
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}
