'use client';

import { useEffect, useState } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';

import type { StudentFeedbackTaskContext } from '@/lib/student-feedback-task-contract';

export function useVerifiedFeedbackTaskContext(
  context: StudentFeedbackTaskContext | null,
  searchParams: ReadonlyURLSearchParams,
) {
  const [verifiedContext, setVerifiedContext] = useState(context);
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    setVerifiedContext(context);
    const currentParams = new URLSearchParams(searchParamsKey);
    const status = currentParams.get('status');
    const teacherInterventionId = currentParams.get('teacherInterventionId');
    if (!context || !teacherInterventionId || (status !== 'teacher-visible' && status !== 'written-back')) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    fetch(`/api/student-feedback-task/context?${searchParamsKey}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { context?: StudentFeedbackTaskContext | null } | null) => {
        if (!cancelled && payload?.context) setVerifiedContext(payload.context);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.warn('[StudentFeedbackTaskContext] verification failed', error);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  // The local context is derived from this same search string; using the string
  // avoids revalidating on every render when callers construct a fresh object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey]);

  return verifiedContext;
}
