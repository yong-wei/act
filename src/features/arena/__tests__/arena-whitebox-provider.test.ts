import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectWhiteBoxMetricProvider: vi.fn(),
  createHeuristicWhiteBoxMetricProvider: vi.fn(() => ({
    evaluate: vi.fn(() => ({})),
  })),
}));

vi.mock('../evaluation/whitebox-metric-provider', () => ({
  selectWhiteBoxMetricProvider: mocks.selectWhiteBoxMetricProvider,
  createHeuristicWhiteBoxMetricProvider: mocks.createHeuristicWhiteBoxMetricProvider,
}));

import { evaluateWhiteBoxSubmission } from '../evaluation/whitebox-evaluator';

describe('arena white-box metric provider selection', () => {
  it('routes official template metrics through the selected provider', () => {
    const provider = {
      id: 'test-template-provider',
      protocolVersion: 'template-whitebox-v1',
      evaluate: vi.fn(() => ({
        settlingTime: 1.25,
        overshoot: 2.5,
        steadyStateError: 0.01,
        itae: 0.7,
        controlEnergy: 1.4,
        comfortBandPeak: 0.2,
        hiddenScenarioWorst: 0.1,
      })),
    };
    mocks.selectWhiteBoxMetricProvider.mockReturnValue(provider);

    const result = evaluateWhiteBoxSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        id: 'artifact-provider-path',
        taskId: 'task-second-order-lead-pid',
        method: 'pid',
        params: { kp: 2.4, ki: 0.8, kd: 0.35 },
        createdAt: '2026-05-15T10:00:00.000Z',
      },
    });

    expect(mocks.selectWhiteBoxMetricProvider).toHaveBeenCalledWith('pid');
    expect(provider.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      artifact: expect.objectContaining({ method: 'pid' }),
      task: expect.objectContaining({ id: 'task-second-order-lead-pid' }),
      object: expect.objectContaining({ id: 'plant-second-order-underdamped' }),
    }));
    expect(result.metrics.settlingTime).toBe(1.25);
  });

  it('exposes template protocol metadata for all current white-box template methods', async () => {
    const actual = await vi.importActual<typeof import('../evaluation/whitebox-metric-provider')>(
      '../evaluation/whitebox-metric-provider',
    );

    for (const method of ['pid', 'serial-compensator', 'composite-compensation', 'optimized-pid', 'mpc']) {
      expect(actual.selectWhiteBoxMetricProvider(method).protocolVersion).toBe('template-whitebox-v1');
    }
  });
});
