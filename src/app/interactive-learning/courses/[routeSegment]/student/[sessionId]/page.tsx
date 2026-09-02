import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { batchAStudentMetadata, renderBatchAStudent } from '@/features/interactive/shared/batch-a-classroom-pages';
import { MANIFEST_COURSE_STUDENT_LOADERS } from '@/features/interactive/shared/manifest-course-app-loaders';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ routeSegment: string }>;
}): Promise<Metadata> {
  const { routeSegment } = await params;
  return batchAStudentMetadata(routeSegment) ?? {};
}

export default async function ManifestCourseStudentPage(props: {
  params: Promise<{ routeSegment: string; sessionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { routeSegment, sessionId } = await props.params;
  const batchA = await renderBatchAStudent({
    routeSegment,
    sessionId,
    searchParams: await props.searchParams,
  });
  if (batchA) return batchA;
  const load = MANIFEST_COURSE_STUDENT_LOADERS[routeSegment as keyof typeof MANIFEST_COURSE_STUDENT_LOADERS];
  if (!load) notFound();
  const { default: Page } = await load();
  return await Promise.resolve(Page({
    params: Promise.resolve({ sessionId }),
  }));
}
