import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  courseBasisErrorResponse,
  deleteCourseBasisVersion,
  rejectCourseBasisVersion,
  getCourseBasisVersionExtractionPreview,
  getCourseBasisVersionForEditing,
  requireCourseBasisActor,
  retireCourseBasisVersion,
  retryCourseBasisExtraction,
  saveCourseBasisVersionEdit,
} from '@/lib/course-basis';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({ action: z.enum(['reject', 'retry', 'retire']) }).strict();
const editSchema = z.object({
  expectedContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  markdown: z.string().max(2_000_000).refine((value) => value.trim().length > 0),
}).strict();

export async function GET(request: Request, context: { params: Promise<{ versionId: string }> }) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  try {
    const { versionId } = await context.params;
    const url = new URL(request.url);
    if (url.searchParams.get('mode') === 'editor') {
      const document = await getCourseBasisVersionForEditing(prisma, { actor: auth.actor, versionId });
      return NextResponse.json({ document });
    }
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
    const body = await request.json();
    if (body && typeof body === 'object' && !Array.isArray(body) && 'markdown' in body) {
      const edit = editSchema.parse(body);
      const result = await saveCourseBasisVersionEdit(prisma, { actor: auth.actor, versionId, ...edit });
      return NextResponse.json(result);
    }
    const { action } = actionSchema.parse(body);
    const input = { actor: auth.actor, versionId };
    const version = action === 'reject'
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
