import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { recordAdvisoryReview } from '@/lib/smart-lesson-plan';

import { idempotencySchema, idSchema, readStrictJson, requireSmartLessonActor, smartLessonErrorResponse } from '../../../_shared';

const schema = z.object({ idempotencyKey: idempotencySchema }).strict();

export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const draftId = idSchema.parse((await context.params).draftId);
    const input = schema.parse(await readStrictJson(request));
    const review = await recordAdvisoryReview(prisma, { actor: auth.actor, draftId, ...input });
    return NextResponse.json({ review: { id: review.id, draftId: review.draftId, contentHash: review.contentHash, report: review.report, advisoryOnly: review.advisoryOnly, createdAt: review.createdAt } }, { status: 201 });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}
