import { notFound } from 'next/navigation';

import { renderBatchATeacher } from '@/features/interactive/shared/batch-a-classroom-pages';

export const dynamic = 'force-dynamic';

export default async function ManifestCourseTeacherPage(props: {
  params: Promise<{ routeSegment: string; sessionId: string }>;
}) {
  const { routeSegment, sessionId } = await props.params;
  const batchA = await renderBatchATeacher({ routeSegment, sessionId });
  if (batchA) return batchA;
  notFound();
}
