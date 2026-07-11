'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import {
  AdaptivePathJourneyControlFromRoute,
  publishAdaptivePathJourneyResponse,
  requestAdaptivePathJourneyRefresh,
} from '@/features/adaptive/adaptive-path-journey-control';
import { buildArenaPathCompletionRequest, resolveArenaPathLaunchParams } from './arena-path-journey';

export function AdaptivePathJourneyControlForArenaTask({ taskId }: { taskId: string }) {
  const searchParams = useSearchParams();
  if (!searchParams) return null;
  if (!resolveArenaPathLaunchParams(searchParams, taskId)) return null;
  return <AdaptivePathJourneyControlFromRoute />;
}

export function useArenaPathLaunchContext(taskId: string) {
  const searchParams = useSearchParams();
  return Boolean(searchParams && resolveArenaPathLaunchParams(searchParams, taskId));
}

export function useArenaPathSubmissionCompletion(taskId: string) {
  const searchParams = useSearchParams();
  return useCallback(async (submissionId: string): Promise<boolean> => {
    const request = buildArenaPathCompletionRequest(searchParams, taskId, submissionId);
    if (!request) return false;
    try {
      const response = await fetch(request.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(request.body),
      });
      const payload = await response.json().catch(() => null);
      const published = publishAdaptivePathJourneyResponse(payload);
      if (!published) requestAdaptivePathJourneyRefresh();
      if (!response.ok) return false;
      return true;
    } catch {
      return false;
    }
  }, [searchParams, taskId]);
}
