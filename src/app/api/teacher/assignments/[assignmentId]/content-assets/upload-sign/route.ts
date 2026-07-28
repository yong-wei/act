import { NextResponse } from 'next/server';

import {
  assignmentErrorResponse,
  readBoundedAssignmentJson,
  requireAssignmentActor,
  requireAssignmentMutation,
} from '@/lib/assignments/assignment-route-guards';
import {
  assignmentContentAssetUploadSchema,
  signAssignmentContentAssetUpload,
} from '@/lib/assignments/assignment-content-assets';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

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
    return NextResponse.json(await signAssignmentContentAssetUpload(prisma, {
      ...auth,
      actorId: auth.actor.id,
      actorRole: auth.actor.role,
      assignmentId,
      upload,
    }));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return assignmentErrorResponse(error);
  }
}
