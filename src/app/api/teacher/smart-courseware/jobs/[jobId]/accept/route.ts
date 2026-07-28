import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { acceptCoursewareModuleCandidate, getSmartCoursewareTeacherProjection } from '@/lib/smart-courseware';

import {
  coursewareIdempotencySchema,
  coursewareIdSchema,
  publicCoursewareJob,
  publicCoursewareTeacherPreview,
  readCoursewareJson,
  requireSmartCoursewareActor,
  smartCoursewareErrorResponse,
} from '../../../_shared';

const acceptSchema = z.object({
  expectedDraftVersion: z.number().int().positive(),
  expectedModuleHash: z.string().trim().min(1).max(128),
  idempotencyKey: coursewareIdempotencySchema,
}).strict();

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const jobId = coursewareIdSchema.parse((await context.params).jobId);
    const input = acceptSchema.parse(await readCoursewareJson(request));
    const job = await acceptCoursewareModuleCandidate(prisma, { actor: auth.actor, jobId, ...input });
    const preview = await getSmartCoursewareTeacherProjection(prisma, { actor: auth.actor, draftId: job.draftId });
    return NextResponse.json({ job: publicCoursewareJob(job), preview: publicCoursewareTeacherPreview(preview) });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}
