import { describe, expect, it, vi } from 'vitest';

import { getArenaChallengeObject, getArenaChallengeTask } from '../data/seed-challenges';
import { buildArenaControlAnalysisRequest } from '../evaluation/controller-to-analysis-request';
import {
  defaultControlAnalysisService,
  type ControlAnalysisService,
} from '../evaluation/control-analysis-service';
import { getArenaEvaluationProtocolVersion } from '../evaluation/evaluator';
import { evaluateWhiteBoxSubmission } from '../evaluation/whitebox-evaluator';
import {
  createAnalysisWhiteBoxMetricProvider,
  normalizeWhiteBoxMetricProviderOutput,
} from '../evaluation/whitebox-metric-provider';
import type { ControllerArtifact } from '../types';
import type { ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import { ControlEngineFailure } from '@/lib/control-engine';

const pidArtifact: ControllerArtifact = {
  id: 'artifact-analysis-pid',
  taskId: 'task-second-order-lead-pid',
  method: 'pid',
  params: { kp: 2.4, ki: 0.8, kd: 0.35 },
  createdAt: '2026-05-15T12:00:00.000Z',
};

function makeAnalysisResult(overrides: Partial<ControlAnalysisResult> = {}): ControlAnalysisResult {
  return {
    metrics: {
      overshootPct: 6.5,
      riseTimeSec: 0.7,
      settlingTimeSec: 2.2,
      peakTimeSec: 1.1,
      finalValue: 0.99,
      phaseMarginDeg: 54,
      gainMarginDb: 11,
      gainCrossoverRadPerSec: 3.4,
      phaseCrossoverRadPerSec: 8.2,
      bandwidthRadPerSec: 5.1,
      ...overrides.metrics,
    },
    stepResponse: {
      points: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.62 },
        { x: 1, y: 1.04 },
        { x: 2, y: 0.99 },
      ],
      ...overrides.stepResponse,
    },
    magnitude: overrides.magnitude ?? { points: [] },
    phase: overrides.phase ?? { points: [] },
    nyquist: overrides.nyquist ?? { points: [] },
    rootLocus: {
      branches: [],
      currentPoles: [{ re: -1.4, im: 1.2 }],
      openLoopPoles: [],
      openLoopZeros: [],
      ...overrides.rootLocus,
    },
    isFallback: overrides.isFallback,
    fallbackMessage: overrides.fallbackMessage,
  };
}

describe('arena analysis-backed white-box evaluation', () => {
  it('computes a server-side ControlAnalysisResult for a second-order PID request', async () => {
    const task = getArenaChallengeTask('task-second-order-lead-pid')!;
    const object = getArenaChallengeObject(task.objectId)!;
    const request = buildArenaControlAnalysisRequest({ task, object, artifact: pidArtifact });

    const result = await defaultControlAnalysisService.compute(request);

    expect(result.stepResponse.points.length).toBeGreaterThan(100);
    expect(result.metrics.overshootPct).toBeGreaterThanOrEqual(0);
    expect(result.metrics.settlingTimeSec).toBeGreaterThan(0);
    expect(result.rootLocus.currentPoles.length).toBeGreaterThan(0);
  });

  it('uses analysis-whitebox-v1 for supported PID and serial-compensator methods', () => {
    expect(getArenaEvaluationProtocolVersion({
      taskId: 'task-second-order-lead-pid',
      method: 'pid',
    })).toBe('analysis-whitebox-v1');
    expect(getArenaEvaluationProtocolVersion({
      taskId: 'task-second-order-lead-pid',
      method: 'serial-compensator',
    })).toBe('analysis-whitebox-v1');
    expect(getArenaEvaluationProtocolVersion({
      taskId: 'task-ship-roll-mpc-hidden-scenarios',
      method: 'mpc',
    })).toBe('template-whitebox-v1');
  });

  it('derives official PID metrics from the selected analysis provider', async () => {
    const service: ControlAnalysisService = {
      compute: vi.fn(async () => makeAnalysisResult()),
    };

    const result = await evaluateWhiteBoxSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      controlAnalysisService: service,
    });

    expect(service.compute).toHaveBeenCalledOnce();
    expect(result.valid).toBe(true);
    expect(result.metrics.settlingTime).toBe(2.2);
    expect(result.metrics.overshoot).toBe(6.5);
    expect(result.metrics.phaseMargin).toBe(54);
    expect(result.explanation.join(' ')).toContain('ControlAnalysisResult');
  });

  it('does not convert unavailable required analysis metrics to zero', async () => {
    const service: ControlAnalysisService = {
      compute: vi.fn(async () => makeAnalysisResult({
        metrics: {
          overshootPct: 6.5,
          riseTimeSec: 0.7,
          settlingTimeSec: null,
          peakTimeSec: 1.1,
          finalValue: 0.99,
          phaseMarginDeg: 54,
          gainMarginDb: 11,
          gainCrossoverRadPerSec: 3.4,
          phaseCrossoverRadPerSec: 8.2,
          bandwidthRadPerSec: 5.1,
        },
      })),
    };

    const result = await evaluateWhiteBoxSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      controlAnalysisService: service,
    });

    expect(result.valid).toBe(false);
    expect(result.metrics.settlingTime).toBeUndefined();
    expect(result.hardConstraintResults.find((item) => item.id === 'analysis_metrics_available')?.passed).toBe(false);
    expect(result.explanation.join(' ')).toContain('settlingTime');
  });

  it('labels response-derived control effort separately from direct actuator energy', async () => {
    const provider = createAnalysisWhiteBoxMetricProvider({
      compute: vi.fn(async () => makeAnalysisResult()),
    });
    const task = getArenaChallengeTask('task-second-order-lead-pid')!;
    const object = getArenaChallengeObject(task.objectId)!;

    const output = normalizeWhiteBoxMetricProviderOutput(
      await provider.evaluate({ task, object, artifact: pidArtifact }),
    );

    expect(output.metricSources.controlEnergy).toBe('derived-from-response');
    expect(output.explanation.join(' ')).toContain('derived');
  });

  it('ignores forged client score, trace, and checksum when deriving official metrics', async () => {
    const service: ControlAnalysisService = {
      compute: vi.fn(async () => makeAnalysisResult()),
    };
    const forged = {
      ...pidArtifact,
      params: {
        ...pidArtifact.params,
        score: 100,
        trace: [{ t: 0, output: 9 }],
        checksum: 'sha256:deadbeef',
      },
    };

    const result = await evaluateWhiteBoxSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: forged,
      controlAnalysisService: service,
    });

    expect(service.compute).toHaveBeenCalledOnce();
    const analysisRequest = vi.mocked(service.compute).mock.calls[0]?.[0];
    expect(JSON.stringify(analysisRequest)).not.toContain('"score":100');
    expect(JSON.stringify(analysisRequest)).not.toContain('deadbeef');
    expect(result.score).not.toBe(100);
    expect(result.metrics.settlingTime).toBe(2.2);
  });

  it('fails closed when the analysis facade is unavailable instead of using client or zero scores', async () => {
    const service: ControlAnalysisService = {
      compute: vi.fn(async () => {
        throw new ControlEngineFailure({
          state: 'unavailable',
          category: 'wasm-unavailable',
          message: 'control-engine runtime unavailable',
          retryable: true,
        });
      }),
    };

    await expect(evaluateWhiteBoxSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: { ...pidArtifact, params: { ...pidArtifact.params, score: 0 } },
      controlAnalysisService: service,
    })).rejects.toBeInstanceOf(ControlEngineFailure);
  });
});
