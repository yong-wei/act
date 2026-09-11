import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { completeAdaptivePathAfterPersistedRun } from '../persisted-run-client';

describe('completeAdaptivePathAfterPersistedRun', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      journey: null,
    }), { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes a governed path completion after a persisted simulation run', async () => {
    vi.stubGlobal('window', {
      location: {
        search: '?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=path-1&nodeId=node-sim&intent=path-execution&returnHref=%2Fassessment%2Fadaptive-practice%3Fgoal%3Dcontrol-correction%26intent%3Dpath-execution%26pathId%3Dpath-1%26nodeId%3Dnode-sim&resourceType=simulation',
      },
    });

    await completeAdaptivePathAfterPersistedRun({
      simulationRunId: 'sim-run-1',
      resourceType: 'simulation',
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/learning-paths/path-1/execute',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"simulationRef":{"id":"sim-run-1"}'),
      }),
    );
  });

  it('does not write path completion for standalone launches', async () => {
    vi.stubGlobal('window', { location: { search: '' } });
    await completeAdaptivePathAfterPersistedRun({
      simulationRunId: 'sim-run-1',
      resourceType: 'simulation',
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
