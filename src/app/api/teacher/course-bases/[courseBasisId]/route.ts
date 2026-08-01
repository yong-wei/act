import { NextResponse } from 'next/server';

import {
  courseBasisErrorResponse,
  deleteCourseBasis,
  requireCourseBasisActor,
} from '@/lib/course-basis';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ courseBasisId: string }> },
) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  try {
    const { courseBasisId } = await context.params;
    await deleteCourseBasis(prisma, { actor: auth.actor, courseBasisId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return courseBasisErrorResponse(error);
  }
}
