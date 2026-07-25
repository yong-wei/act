import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getPausedGenerationOutlineForEditing, smartLessonOutlineOutputSchema, updatePausedGenerationOutline } from '@/lib/smart-lesson-plan';

import { idSchema, readStrictJson, requireSmartLessonActor, smartLessonErrorResponse } from '../../../_shared';

const schema = z.object({
  expectedOutputHash: z.string().regex(/^[a-f0-9]{64}$/),
  output: smartLessonOutlineOutputSchema,
}).strict();

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const jobId = idSchema.parse((await context.params).jobId);
    const { job, outline } = await getPausedGenerationOutlineForEditing(prisma, { actor: auth.actor, jobId });
    return NextResponse.json({
      job: { id: job.id, state: job.state, task: job.draft.task },
      outline: { output: outline.output, outputHash: outline.outputHash, updatedAt: outline.updatedAt },
    });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireSmartLessonActor();
  if ('response' in auth) return auth.response;
  try {
    const jobId = idSchema.parse((await context.params).jobId);
    const input = schema.parse(await readStrictJson(request));
    const stage = await updatePausedGenerationOutline(prisma, { actor: auth.actor, jobId, ...input });
    return NextResponse.json({ stage: { id: stage.id, kind: stage.kind, state: stage.state, output: stage.output, outputHash: stage.outputHash, updatedAt: stage.updatedAt } });
  } catch (error) {
    return smartLessonErrorResponse(error);
  }
}
