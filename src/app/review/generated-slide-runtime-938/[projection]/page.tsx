import { notFound } from 'next/navigation';

import { GeneratedSlideRuntime938Review } from '../review-client';

export default async function GeneratedSlideRuntime938ReviewPage({
  params,
}: {
  params: Promise<{ projection: string }>;
}) {
  const { projection } = await params;
  if (process.env.NODE_ENV !== 'development'
    || (projection !== 'student' && projection !== 'teacher')) notFound();
  return <GeneratedSlideRuntime938Review projection={projection} />;
}
