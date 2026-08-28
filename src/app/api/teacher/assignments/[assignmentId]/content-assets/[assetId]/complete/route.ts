import { NextResponse } from 'next/server';

import {
  assignmentErrorResponse,
  requireAssignmentActor,
  requireAssignmentMutation,
} from '@/lib/assignments/assignment-route-guards';
import { teacherCompleteContentAssetUpload } from '@/lib/assignments/public-api';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string; assetId: string }> },
) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId, assetId } = await context.params;
    return NextResponse.json(await teacherCompleteContentAssetUpload(auth.actor, assignmentId, assetId));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return assignmentErrorResponse(error);
  }
}
