import { notFound } from 'next/navigation';

import { renderBatchAWaiting } from '@/features/interactive/shared/batch-a-classroom-pages';

export const dynamic = 'force-dynamic';

export default async function ManifestCourseWaitingPage(props: {
  params: Promise<{ routeSegment: string; sessionId: string }>;
}) {
  const { routeSegment, sessionId } = await props.params;
  const batchA = await renderBatchAWaiting({ routeSegment, sessionId });
  if (batchA) return batchA;
  notFound();
}
