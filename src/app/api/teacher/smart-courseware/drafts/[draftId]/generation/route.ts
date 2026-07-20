import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { enqueueCoursewareGenerationJob, startCoursewareGenerationJob } from '@/lib/smart-courseware';

import {
  coursewareIdempotencySchema,
  coursewareIdSchema,
  publicCoursewareJob,
  readCoursewareJson,
  requireSmartCoursewareActor,
  smartCoursewareErrorResponse,
} from '../../../_shared';

const startSchema = z.object({ idempotencyKey: coursewareIdempotencySchema }).strict();

export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const draftId = coursewareIdSchema.parse((await context.params).draftId);
    const input = startSchema.parse(await readCoursewareJson(request));
    const started = await startCoursewareGenerationJob(prisma, { actor: auth.actor, draftId, ...input });
    const delivery = await enqueueCoursewareGenerationJob(prisma, started.id);
    return NextResponse.json({
      job: publicCoursewareJob(delivery.job ?? started),
      delivery: { queued: delivery.queued, errorCode: delivery.errorCode },
    }, { status: 202 });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}
