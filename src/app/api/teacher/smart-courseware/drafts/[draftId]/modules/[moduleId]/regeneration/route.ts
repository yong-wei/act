import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { requestCoursewareModuleRegeneration } from '@/lib/smart-courseware';

import {
  coursewareIdempotencySchema,
  coursewareIdSchema,
  publicCoursewareJob,
  readCoursewareJson,
  requireSmartCoursewareActor,
  smartCoursewareErrorResponse,
} from '../../../../../_shared';

const requestSchema = z.object({ idempotencyKey: coursewareIdempotencySchema }).strict();

export async function POST(request: Request, context: { params: Promise<{ draftId: string; moduleId: string }> }) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const params = await context.params;
    const draftId = coursewareIdSchema.parse(params.draftId);
    const moduleId = coursewareIdSchema.parse(params.moduleId);
    const input = requestSchema.parse(await readCoursewareJson(request));
    const requested = await requestCoursewareModuleRegeneration(prisma, {
      actor: auth.actor, draftId, moduleId, idempotencyKey: input.idempotencyKey,
    });
    return NextResponse.json({
      job: publicCoursewareJob(requested.job),
      ...(requested.delivery ? { delivery: requested.delivery } : {}),
    }, { status: 202 });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}
