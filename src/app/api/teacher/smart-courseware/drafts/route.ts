import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createSmartCoursewareDraft } from '@/lib/smart-courseware';

import {
  createCoursewareDraftSchema,
  publicCoursewareDraft,
  readCoursewareJson,
  requireSmartCoursewareActor,
  smartCoursewareErrorResponse,
} from '../_shared';

export async function POST(request: Request) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const input = createCoursewareDraftSchema.parse(await readCoursewareJson(request));
    const draft = await createSmartCoursewareDraft(prisma, { actor: auth.actor, ...input });
    return NextResponse.json({ draft: publicCoursewareDraft(draft) }, { status: 201 });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}
