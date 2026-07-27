import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { deriveDraftFromRevision } from '@/lib/smart-lesson-plan';

import { idSchema, publicDraft, requireSmartLessonActor, smartLessonErrorResponse } from '../../../_shared';

export async function POST(_request: Request, context: { params: Promise<{ revisionId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const revisionId = idSchema.parse((await context.params).revisionId);
    const draft = await deriveDraftFromRevision(prisma, { actor: auth.actor, revisionId });
    return NextResponse.json({ draft: publicDraft(draft) }, { status: 201 });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}
