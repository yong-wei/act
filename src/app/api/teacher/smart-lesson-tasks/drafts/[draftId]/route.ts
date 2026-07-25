import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getSmartLessonDraftForEditing, smartLessonPlanSchema, updateSmartLessonDraft } from '@/lib/smart-lesson-plan';

import { idSchema, normalizeSourceStatesForService, publicDraft, readStrictJson, requireSmartLessonActor, smartLessonErrorResponse } from '../../_shared';

const updateSchema = z.object({ expectedVersion: z.number().int().nonnegative(), content: smartLessonPlanSchema }).strict();

export async function GET(_request: Request, context: { params: Promise<{ draftId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const draftId = idSchema.parse((await context.params).draftId);
    const draft = await getSmartLessonDraftForEditing(prisma, { actor: auth.actor, draftId });
    return NextResponse.json({
      draft: publicDraft(draft as unknown as Record<string, unknown>),
      task: draft.task,
    });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ draftId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const draftId = idSchema.parse((await context.params).draftId);
    const input = updateSchema.parse(normalizeSourceStatesForService(await readStrictJson(request)));
    const draft = await updateSmartLessonDraft(prisma, { actor: auth.actor, draftId, ...input });
    return NextResponse.json({ draft: publicDraft(draft) });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}
