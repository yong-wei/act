import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { approveSmartCoursewareDraft } from '@/lib/smart-courseware';

import {
  coursewareIdempotencySchema,
  coursewareIdSchema,
  publicCoursewareRevision,
  readCoursewareJson,
  requireSmartCoursewareActor,
  smartCoursewareErrorResponse,
} from '../../../_shared';

const approveSchema = z.object({ idempotencyKey: coursewareIdempotencySchema }).strict();

export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const draftId = coursewareIdSchema.parse((await context.params).draftId);
    const input = approveSchema.parse(await readCoursewareJson(request));
    const revision = await approveSmartCoursewareDraft(prisma, { actor: auth.actor, draftId, ...input });
    return NextResponse.json({ revision: publicCoursewareRevision(revision) }, { status: 201 });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}
