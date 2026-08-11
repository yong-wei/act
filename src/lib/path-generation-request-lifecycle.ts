export type PathGenerationRequestStatus = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed';

export interface PathGenerationRequestLifecycle {
  requestId: string | null;
  status: PathGenerationRequestStatus;
  reusable: boolean;
  inFlight: boolean;
}

export const INITIAL_PATH_GENERATION_REQUEST_LIFECYCLE: PathGenerationRequestLifecycle = {
  requestId: null,
  status: 'idle',
  reusable: false,
  inFlight: false,
};

export function claimPathGenerationRequest(
  current: PathGenerationRequestLifecycle,
  createRequestId: () => string,
): { requestId: string; lifecycle: PathGenerationRequestLifecycle } | null {
  if (current.inFlight) return null;
  const requestId = current.requestId !== null
    && (current.status === 'running' || (current.status === 'failed' && current.reusable))
    ? current.requestId
    : createRequestId();
  return {
    requestId,
    lifecycle: {
      requestId,
      status: 'pending',
      reusable: true,
      inFlight: true,
    },
  };
}

export function settlePathGenerationRequest(
  current: PathGenerationRequestLifecycle,
  status: Exclude<PathGenerationRequestStatus, 'idle' | 'pending'>,
  options: { definitive?: boolean } = {},
): PathGenerationRequestLifecycle {
  return {
    ...current,
    status,
    reusable: status === 'running' || (status === 'failed' && !options.definitive),
    inFlight: false,
  };
}

export function releasePathGenerationRequest(
  current: PathGenerationRequestLifecycle,
): PathGenerationRequestLifecycle {
  return current.inFlight ? { ...current, inFlight: false } : current;
}
