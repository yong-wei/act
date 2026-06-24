import { Suspense } from 'react';

import { ReviewStructureDiagramRuntime563 } from './review-client';

type SearchParams = Record<string, string | string[] | undefined>;

function stringParam(params: SearchParams, key: string, fallback: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default async function StructureDiagramRuntime563ReviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={null}>
      <ReviewStructureDiagramRuntime563
        role={stringParam(params ?? {}, 'role', 'student')}
        state={stringParam(params ?? {}, 'state', 'student-highlight')}
        theme={stringParam(params ?? {}, 'theme', 'light')}
      />
    </Suspense>
  );
}
