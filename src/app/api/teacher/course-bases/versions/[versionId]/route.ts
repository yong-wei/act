import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  confirmCourseBasisVersion,
  courseBasisErrorResponse,
  deleteCourseBasisVersion,
  rejectCourseBasisVersion,
  getCourseBasisVersionExtractionPreview,
  requireCourseBasisActor,
  retireCourseBasisVersion,
  retryCourseBasisExtraction,
} from '@/lib/course-basis';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({ action: z.enum(['confirm', 'reject', 'retry', 'retire']) }).strict();

export async function GET(request: Request, context: { params: Promise<{ versionId: string }> }) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  try {
    const { versionId } = await context.params;
    const url = new URL(request.url);
    const preview = await getCourseBasisVersionExtractionPreview(prisma, {
      actor: auth.actor,
      versionId,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 20),
    });
    return NextResponse.json({ preview });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return courseBasisErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ versionId: string }> }) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  try {
    const { versionId } = await context.params;
    const { action } = actionSchema.parse(await request.json());
    const input = { actor: auth.actor, versionId };
    const version = action === 'confirm'
      ? await confirmCourseBasisVersion(prisma, input)
      : action === 'reject'
        ? await rejectCourseBasisVersion(prisma, input)
        : action === 'retry'
          ? await retryCourseBasisExtraction(prisma, input)
          : await retireCourseBasisVersion(prisma, input);
    return NextResponse.json({ version });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return courseBasisErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ versionId: string }> }) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  try {
    const { versionId } = await context.params;
    await deleteCourseBasisVersion(prisma, { actor: auth.actor, versionId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return courseBasisErrorResponse(error);
  }
}
