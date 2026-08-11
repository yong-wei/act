import { describe, expect, it, vi } from 'vitest';

import {
  claimPathGenerationRequest,
  INITIAL_PATH_GENERATION_REQUEST_LIFECYCLE,
  settlePathGenerationRequest,
} from '@/lib/path-generation-request-lifecycle';

describe('path generation request lifecycle', () => {
  it('admits only one request before the first callback completes', () => {
    const createRequestId = vi.fn(() => 'request-1');
    const first = claimPathGenerationRequest(INITIAL_PATH_GENERATION_REQUEST_LIFECYCLE, createRequestId);

    expect(first?.requestId).toBe('request-1');
    expect(first && claimPathGenerationRequest(first.lifecycle, createRequestId)).toBeNull();
    expect(createRequestId).toHaveBeenCalledTimes(1);
  });

  it('reuses the same request id for running callbacks', () => {
    const first = claimPathGenerationRequest(
      INITIAL_PATH_GENERATION_REQUEST_LIFECYCLE,
      () => 'request-1',
    );
    const running = settlePathGenerationRequest(first!.lifecycle, 'running');
    const callback = claimPathGenerationRequest(running, () => 'request-2');

    expect(callback?.requestId).toBe('request-1');
  });

  it('reuses the same request id after an unknown 500 or lost response', () => {
    const first = claimPathGenerationRequest(
      INITIAL_PATH_GENERATION_REQUEST_LIFECYCLE,
      () => 'request-1',
    );
    const unknownFailure = settlePathGenerationRequest(first!.lifecycle, 'failed');
    const retry = claimPathGenerationRequest(unknownFailure, () => 'request-2');

    expect(retry?.requestId).toBe('request-1');
  });

  it('creates a new request id after a definitive failure', () => {
    const first = claimPathGenerationRequest(
      INITIAL_PATH_GENERATION_REQUEST_LIFECYCLE,
      () => 'request-1',
    );
    const failed = settlePathGenerationRequest(first!.lifecycle, 'failed', { definitive: true });
    const regeneration = claimPathGenerationRequest(failed, () => 'request-2');

    expect(regeneration?.requestId).toBe('request-2');
  });

  it('creates a new request id for explicit regeneration after success', () => {
    const first = claimPathGenerationRequest(
      INITIAL_PATH_GENERATION_REQUEST_LIFECYCLE,
      () => 'request-1',
    );
    const succeeded = settlePathGenerationRequest(first!.lifecycle, 'succeeded', { definitive: true });
    const regeneration = claimPathGenerationRequest(succeeded, () => 'request-2');

    expect(regeneration?.requestId).toBe('request-2');
  });
});
