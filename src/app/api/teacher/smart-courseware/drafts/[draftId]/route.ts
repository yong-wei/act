import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getSmartCoursewareDraft, getSmartCoursewareTeacherProjection, updateSmartCoursewareComposition } from '@/lib/smart-courseware';

import {
  coursewareIdSchema,
  publicCoursewareDraft,
  publicCoursewareTeacherPreview,
  readCoursewareJson,
  requireSmartCoursewareActor,
  smartCoursewareErrorResponse,
  updateCoursewareDraftSchema,
} from '../../_shared';

type DraftContext = { params: Promise<{ draftId: string }> };

export async function GET(_request: Request, context: DraftContext) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const draftId = coursewareIdSchema.parse((await context.params).draftId);
    const draft = await getSmartCoursewareDraft(prisma, { actor: auth.actor, draftId });
    return NextResponse.json({ draft: publicCoursewareDraft(draft) });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: DraftContext) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const draftId = coursewareIdSchema.parse((await context.params).draftId);
    const input = updateCoursewareDraftSchema.parse(await readCoursewareJson(request));
    const draft = await updateSmartCoursewareComposition(prisma, { actor: auth.actor, draftId, ...input });
    const preview = await getSmartCoursewareTeacherProjection(prisma, { actor: auth.actor, draftId });
    return NextResponse.json({ draft: publicCoursewareDraft(draft), preview: publicCoursewareTeacherPreview(preview) });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}
