import { notFound } from 'next/navigation';

import { renderBatchADemo } from '@/features/interactive/shared/batch-a-classroom-pages';
import { MANIFEST_COURSE_ROUTE_SEGMENTS } from '@/features/interactive/shared/manifest-course-app-loaders';

export const dynamic = 'force-dynamic';
export const dynamicParams = false;

export function generateStaticParams() {
  return MANIFEST_COURSE_ROUTE_SEGMENTS.map((routeSegment) => ({ routeSegment }));
}

export default async function ManifestCourseDemoPage({
  params,
}: {
  params: Promise<{ routeSegment: string }>;
}) {
  const { routeSegment } = await params;
  const batchA = await renderBatchADemo(routeSegment);
  if (batchA) return batchA;
  notFound();
}
