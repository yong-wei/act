import { NextResponse } from 'next/server';

import { reorderAssetsSchema } from '@/lib/assignments/submission-domain';
import {
  guardSubmissionMutation,
  readBoundedSubmissionJson,
  requireStudentActor,
  submissionErrorResponse,
} from '@/lib/assignments/submission-route-guards';
import { reorderQuestionAssets } from '@/lib/assignments/submission-service';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string; questionId: string }> },
) {
  const auth = await requireStudentActor();
  if ('response' in auth) return auth.response;
  const blocked = await guardSubmissionMutation(request, auth.actor.id, 'autosave');
  if (blocked) return blocked;
  try {
    const ids = await params;
    const body = reorderAssetsSchema.parse(await readBoundedSubmissionJson(request));
    const answer = await reorderQuestionAssets(prisma, {
      studentId: auth.actor.id,
      ...ids,
      ...body,
    });
    return NextResponse.json({
      answer: {
        id: answer.id,
        version: answer.version,
        attachmentOrderProvenance: answer.attachmentOrderProvenance,
      },
    });
  } catch (error) {
    return submissionErrorResponse(error);
  }
}
