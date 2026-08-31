import { notFound } from 'next/navigation';

import {
  MANIFEST_COURSE_DEMO_LOADERS,
  MANIFEST_COURSE_ROUTE_SEGMENTS,
} from '@/features/interactive/shared/manifest-course-app-loaders';

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
  const load = MANIFEST_COURSE_DEMO_LOADERS[routeSegment as keyof typeof MANIFEST_COURSE_DEMO_LOADERS];
  if (!load) notFound();
  const { default: Page } = await load();
  return await Promise.resolve(Page());
}
