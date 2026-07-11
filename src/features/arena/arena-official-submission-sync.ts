'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  useArenaPathLaunchContext,
  useArenaPathSubmissionCompletion,
} from './arena-path-journey-control';

export interface ArenaOfficialSubmission {
  id: string;
}

export async function submitAndSynchronizeArenaPath<T extends ArenaOfficialSubmission>(
  input: {
    submission?: T;
    submit: () => Promise<T>;
    hasArenaPathContext: boolean;
    completeArenaPath: (submissionId: string) => Promise<boolean>;
  },
): Promise<{ submission: T; pathSync: 'not-applicable' | 'succeeded' | 'failed' }> {
  const submission = input.submission ?? await input.submit();
  if (!input.hasArenaPathContext) {
    return { submission, pathSync: 'not-applicable' };
  }
  const synchronized = await input.completeArenaPath(submission.id);
  return {
    submission,
    pathSync: synchronized ? 'succeeded' : 'failed',
  };
}

export type ArenaSubmissionPathSyncState = 'idle' | 'pending' | 'succeeded' | 'failed';

export function useArenaOfficialSubmissionPathSync(taskId: string) {
  const hasArenaPathContext = useArenaPathLaunchContext(taskId);
  const completeArenaPath = useArenaPathSubmissionCompletion(taskId);
  const [state, setState] = useState<ArenaSubmissionPathSyncState>('idle');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const synchronize = useCallback(async (nextSubmissionId: string) => {
    if (!hasArenaPathContext) return 'not-applicable' as const;
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    setSubmissionId(nextSubmissionId);
    setState('pending');
    try {
      const outcome = await submitAndSynchronizeArenaPath({
        submission: { id: nextSubmissionId },
        submit: async () => ({ id: nextSubmissionId }),
        hasArenaPathContext,
        completeArenaPath,
      });
      if (outcome.pathSync === 'not-applicable') return outcome.pathSync;
      if (mountedRef.current) setState(outcome.pathSync);
      return outcome.pathSync;
    } finally {
      inFlightRef.current = false;
    }
  }, [completeArenaPath, hasArenaPathContext]);

  const retry = useCallback(async () => {
    if (!submissionId) return null;
    return synchronize(submissionId);
  }, [submissionId, synchronize]);

  return {
    hasArenaPathContext,
    state,
    submissionId,
    synchronize,
    retry,
    isSynchronizing: state === 'pending',
  };
}
