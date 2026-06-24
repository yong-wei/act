import { Suspense } from 'react';

import { ReviewDerivationStageRuntime562 } from './review-client';

type SearchParams = Record<string, string | string[] | undefined>;

function stringParam(params: SearchParams, key: string, fallback: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default async function DerivationStageRuntime562ReviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={null}>
      <ReviewDerivationStageRuntime562
        role={stringParam(params ?? {}, 'role', 'student')}
        state={stringParam(params ?? {}, 'state', 'student-released')}
        theme={stringParam(params ?? {}, 'theme', 'light')}
      />
    </Suspense>
  );
}
