import { notFound } from 'next/navigation';

import { GeneratedSlideRuntime938Review } from '../review-client';

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
  return <GeneratedSlideRuntime938Review projection={projection} />;
}
