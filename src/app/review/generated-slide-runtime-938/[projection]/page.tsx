import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

import { GeneratedSlideRuntime938Review } from '../review-client';
import type { GeneratedSlideManifest } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { prisma } from '@/lib/prisma';

export default async function GeneratedSlideRuntime938ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projection: string }>;
  searchParams: Promise<{ sourceRevisionId?: string }>;
}) {
  const { projection } = await params;
  const { sourceRevisionId } = await searchParams;
  if ((process.env.NODE_ENV !== 'development' && !sourceRevisionId)
    || (projection !== 'student' && projection !== 'teacher')) notFound();
  if (!sourceRevisionId) return <GeneratedSlideRuntime938Review projection={projection} />;
  const requestHeaders = await headers();
  const secret = process.env.SMART_COURSEWARE_PUBLICATION_REVIEW_SECRET;
  const ownerId = requestHeaders.get('x-act-publication-owner');
  if (!secret
    || requestHeaders.get('x-act-publication-review-secret') !== secret
    || !ownerId) notFound();
  const revision = await prisma.smartCoursewareRevision.findFirst({
    where: { id: sourceRevisionId, ownerId },
    select: { manifestSnapshot: true, manifestHash: true },
  });
  if (!revision) notFound();
  return <GeneratedSlideRuntime938Review projection={projection} review={{
    manifest: revision.manifestSnapshot as unknown as GeneratedSlideManifest,
    manifestHash: revision.manifestHash,
  }} />;
}
