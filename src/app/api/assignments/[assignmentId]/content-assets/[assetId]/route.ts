import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { assignmentErrorResponse } from '@/lib/assignments/assignment-route-guards';
import { readAssignmentContentAsset } from '@/lib/assignments/assignment-content-assets';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ assignmentId: string; assetId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  try {
    const { assignmentId, assetId } = await context.params;
    const asset = await readAssignmentContentAsset(prisma, {
      actorId: session.user.id,
      actorRole: session.user.role,
      assignmentId,
      assetId,
    });
    return new NextResponse(asset.bytes as BodyInit, {
      headers: {
        'Content-Type': asset.mimeType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return assignmentErrorResponse(error);
  }
}
