import { NextResponse } from 'next/server';

import {
  assignmentErrorResponse,
  readBoundedAssignmentJson,
  requireAssignmentActor,
  requireAssignmentMutation,
} from '@/lib/assignments/assignment-route-guards';
import { assignmentContentAssetUploadSchema, teacherSignContentAssetUpload } from '@/lib/assignments/public-api';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId } = await context.params;
    const upload = assignmentContentAssetUploadSchema.parse(
      await readBoundedAssignmentJson(request),
    );
    return NextResponse.json(await teacherSignContentAssetUpload(auth.actor, assignmentId, upload));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return assignmentErrorResponse(error);
  }
}
