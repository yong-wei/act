import { notFound } from 'next/navigation';

import { renderBatchAWaiting } from '@/features/interactive/shared/batch-a-classroom-pages';
import { MANIFEST_COURSE_WAITING_LOADERS } from '@/features/interactive/shared/manifest-course-app-loaders';

export const dynamic = 'force-dynamic';

export default async function ManifestCourseWaitingPage(props: {
  params: Promise<{ routeSegment: string; sessionId: string }>;
}) {
  const { routeSegment, sessionId } = await props.params;
  const batchA = await renderBatchAWaiting({ routeSegment, sessionId });
  if (batchA) return batchA;
  const load = MANIFEST_COURSE_WAITING_LOADERS[routeSegment as keyof typeof MANIFEST_COURSE_WAITING_LOADERS];
  if (!load) notFound();
  const { default: Page } = await load();
  return await Promise.resolve(Page({
    params: Promise.resolve({ sessionId }),
  }));
}
