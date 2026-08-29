import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  MANIFEST_COURSE_STUDENT_LOADERS,
  MANIFEST_COURSE_STUDENT_METADATA,
} from '@/features/interactive/shared/manifest-course-app-loaders';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ routeSegment: string }>;
}): Promise<Metadata> {
  const { routeSegment } = await params;
  return MANIFEST_COURSE_STUDENT_METADATA[routeSegment as keyof typeof MANIFEST_COURSE_STUDENT_METADATA] ?? {};
}

export default async function ManifestCourseStudentPage(props: {
  params: Promise<{ routeSegment: string; sessionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { routeSegment, sessionId } = await props.params;
  const load = MANIFEST_COURSE_STUDENT_LOADERS[routeSegment as keyof typeof MANIFEST_COURSE_STUDENT_LOADERS];
  if (!load) notFound();
  const { default: Page } = await load();
  return await Promise.resolve(Page({
    params: Promise.resolve({ sessionId }),
    searchParams: props.searchParams,
  }));
}
