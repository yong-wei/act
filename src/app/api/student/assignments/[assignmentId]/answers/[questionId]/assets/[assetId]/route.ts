import { NextResponse } from 'next/server';

import {
  guardSubmissionMutation,
  readBoundedSubmissionJson,
  requireStudentActor,
  submissionErrorResponse,
} from '@/lib/assignments/submission-route-guards';
import { removeAssetSchema, studentRemoveQuestionAsset } from '@/lib/assignments/public-api';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string; questionId: string; assetId: string }> },
) {
  const auth = await requireStudentActor();
  if ('response' in auth) return auth.response;
  const blocked = await guardSubmissionMutation(request, auth.actor.id, 'autosave');
  if (blocked) return blocked;
  try {
    const ids = await params;
    const body = removeAssetSchema.parse(await readBoundedSubmissionJson(request));
    const result = await studentRemoveQuestionAsset(auth.actor, {
      ...ids,
      ...body,
    });
    return NextResponse.json({
      removedAssetId: result.assetId,
      answer: {
        id: result.answer.id,
        version: result.answer.version,
        state: result.answer.state,
      },
    });
  } catch (error) {
    return submissionErrorResponse(error);
  }
}
