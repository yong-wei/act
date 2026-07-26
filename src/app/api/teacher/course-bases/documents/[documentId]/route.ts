import { NextResponse } from 'next/server';

import {
  courseBasisErrorResponse,
  deleteCourseBasisDocument,
  requireCourseBasisActor,
} from '@/lib/course-basis';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  try {
    const { documentId } = await context.params;
    await deleteCourseBasisDocument(prisma, { actor: auth.actor, documentId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return courseBasisErrorResponse(error);
  }
}
