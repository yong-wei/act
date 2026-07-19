import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { smartLessonOutlineOutputSchema, updatePausedGenerationOutline } from '@/lib/smart-lesson-plan';

import { idSchema, readStrictJson, requireSmartLessonActor, smartLessonErrorResponse } from '../../../_shared';

const schema = z.object({ output: smartLessonOutlineOutputSchema }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const jobId = idSchema.parse((await context.params).jobId);
    const input = schema.parse(await readStrictJson(request));
    const stage = await updatePausedGenerationOutline(prisma, { actor: auth.actor, jobId, output: input.output });
    return NextResponse.json({ stage: { id: stage.id, kind: stage.kind, state: stage.state, output: stage.output, updatedAt: stage.updatedAt } });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}
