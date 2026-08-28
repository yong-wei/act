import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  computeVirtualSimulationServerStep: vi.fn(),
}));

vi.mock('@/lib/control-engine/server', () => ({
  computeVirtualSimulationServerStep: mocks.computeVirtualSimulationServerStep,
}));

import { ControlEngineFailure } from '@/lib/control-engine';
import { POST as postCruise } from '@/app/api/simulation/cruise-comfort-analysis/route';
import { POST as postIcebreaker } from '@/app/api/simulation/icebreaker-robust-analysis/route';

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/simulation/virtual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('virtual simulation analysis routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the facade result for cruise comfort analysis', async () => {
    mocks.computeVirtualSimulationServerStep.mockReturnValue({ blendedScore: 0.42 });
    const response = await postCruise(jsonRequest({
      objectives: { comfortWeight: 0.5, performanceWeight: 0.3, energyWeight: 0.2 },
      metrics: { msi: 12, settlingTime: 45, overshoot: 8, finPower: 120 },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ blendedScore: 0.42 });
  });

  it('does not return a stale client result when the cruise facade is unavailable', async () => {
    mocks.computeVirtualSimulationServerStep.mockImplementation(() => {
      throw new ControlEngineFailure({
        state: 'unavailable',
        category: 'timeout',
        message: 'virtual simulation timed out',
        retryable: true,
      });
    });
    const response = await postCruise(jsonRequest({
      objectives: { comfortWeight: 0.5, performanceWeight: 0.3, energyWeight: 0.2 },
      metrics: { msi: 12, settlingTime: 45, overshoot: 8, finPower: 120 },
    }));
    const payload = await response.json() as { state?: string; blendedScore?: number };
    expect(response.status).toBe(503);
    expect(payload.state).toBe('unavailable');
    expect(payload.blendedScore).toBeUndefined();
  });

  it('does not persist or synthesize an icebreaker result on facade timeout', async () => {
    mocks.computeVirtualSimulationServerStep.mockImplementation(() => {
      throw new ControlEngineFailure({
        state: 'timeout',
        category: 'timeout',
        message: 'virtual simulation timed out',
        retryable: true,
      });
    });
    const response = await postIcebreaker(jsonRequest({
      uncertaintyRange: { paramK: [0.05, 0.1], paramT: [40, 70] },
      disturbanceScenarios: [{ name: 'ice', intensity: 0.4 }],
    }));
    expect(response.status).toBe(503);
    expect(mocks.computeVirtualSimulationServerStep).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'icebreaker_robust_analysis',
    }));
  });
});
