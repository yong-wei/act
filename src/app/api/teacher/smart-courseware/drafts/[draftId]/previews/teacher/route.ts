import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getSmartCoursewareTeacherProjection } from '@/lib/smart-courseware';

import {
  coursewareIdSchema,
  publicCoursewareTeacherPreview,
  requireSmartCoursewareActor,
  smartCoursewareErrorResponse,
} from '../../../../_shared';

export async function GET(_request: Request, context: { params: Promise<{ draftId: string }> }) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const draftId = coursewareIdSchema.parse((await context.params).draftId);
    const preview = await getSmartCoursewareTeacherProjection(prisma, { actor: auth.actor, draftId });
    return NextResponse.json({ preview: publicCoursewareTeacherPreview(preview) });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}
