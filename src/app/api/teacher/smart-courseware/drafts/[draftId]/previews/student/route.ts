import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getSmartCoursewareStudentProjection } from '@/lib/smart-courseware';
import { resolveSmartCoursewareOrderingSecret } from '@/lib/smart-courseware/student-projection-secret';

import {
  coursewareIdSchema,
  publicCoursewareStudentPreview,
  requireSmartCoursewareActor,
  smartCoursewareErrorResponse,
} from '../../../../_shared';

export async function GET(_request: Request, context: { params: Promise<{ draftId: string }> }) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const draftId = coursewareIdSchema.parse((await context.params).draftId);
    const preview = await getSmartCoursewareStudentProjection(
      prisma,
      { actor: auth.actor, draftId },
      { orderingPermutationSecret: resolveSmartCoursewareOrderingSecret() },
    );
    return NextResponse.json({ preview: publicCoursewareStudentPreview(preview) });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}
