import { Suspense } from 'react';

import { ReviewVisualStageRuntime561 } from './review-client';

type SearchParams = Record<string, string | string[] | undefined>;

function stringParam(params: SearchParams, key: string, fallback: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default async function VisualStageRuntime561ReviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={null}>
      <ReviewVisualStageRuntime561
        role={stringParam(params ?? {}, 'role', 'student')}
        state={stringParam(params ?? {}, 'state', 'student-released')}
        theme={stringParam(params ?? {}, 'theme', 'light')}
      />
    </Suspense>
  );
}
