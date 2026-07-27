import { NextResponse, type NextRequest } from 'next/server';

import type { GeneratedSlideManifest } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.SMART_COURSEWARE_PUBLICATION_REVIEW_SECRET;
  const ownerId = request.headers.get('x-act-publication-owner');
  const sourceRevisionId = request.nextUrl.searchParams.get('sourceRevisionId');
  if (!secret
    || request.headers.get('x-act-publication-review-secret') !== secret
    || !ownerId
    || !sourceRevisionId) {
    return new NextResponse(null, { status: 404 });
  }
  const revision = await prisma.smartCoursewareRevision.findFirst({
    where: { id: sourceRevisionId, ownerId },
    select: { manifestSnapshot: true, manifestHash: true },
  });
  if (!revision) return new NextResponse(null, { status: 404 });
  return NextResponse.json({
    manifest: revision.manifestSnapshot as unknown as GeneratedSlideManifest,
    manifestHash: revision.manifestHash,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
