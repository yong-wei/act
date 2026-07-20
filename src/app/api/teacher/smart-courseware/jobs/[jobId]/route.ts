import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  cancelCoursewareGenerationJob,
  enqueueCoursewareGenerationJob,
  getCoursewareGenerationJob,
  resumeCoursewareGenerationJob,
  retryCoursewareGenerationJob,
} from '@/lib/smart-courseware';

import {
  coursewareIdSchema,
  coursewareJobActionSchema,
  publicCoursewareJob,
  readCoursewareJson,
  requireSmartCoursewareActor,
  smartCoursewareErrorResponse,
} from '../../_shared';

type JobContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: JobContext) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const jobId = coursewareIdSchema.parse((await context.params).jobId);
    const job = await getCoursewareGenerationJob(prisma, { actor: auth.actor, jobId });
    return NextResponse.json({ job: publicCoursewareJob(job) });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}

export async function POST(request: Request, context: JobContext) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const jobId = coursewareIdSchema.parse((await context.params).jobId);
    const input = coursewareJobActionSchema.parse(await readCoursewareJson(request));
    const transition = input.action === 'resume'
      ? resumeCoursewareGenerationJob
      : input.action === 'retry'
        ? retryCoursewareGenerationJob
        : cancelCoursewareGenerationJob;
    const transitioned = await transition(prisma, { actor: auth.actor, jobId, idempotencyKey: input.idempotencyKey });
    const delivery = input.action === 'cancel'
      ? null
      : await enqueueCoursewareGenerationJob(prisma, transitioned.id);
    return NextResponse.json({
      job: publicCoursewareJob(delivery?.job ?? transitioned),
      ...(delivery ? { delivery: { queued: delivery.queued, errorCode: delivery.errorCode } } : {}),
    });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}
