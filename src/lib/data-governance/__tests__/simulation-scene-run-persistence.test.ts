import { describe, expect, it, vi } from 'vitest';

import {
  persistControlWorkbenchSimulationRun,
  persistPathCourseDemoSimulationRun,
  persistSceneTraceSimulationRun,
} from '../simulation-scene-run-persistence';
import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import { ControlEngineFailure } from '@/lib/control-engine';
import {
  buildCruiseTelemetryBridgeSummary,
  type CruiseTelemetryBridgeInput,
} from '@/resources/simulations/simulations/cruise/telemetry-bridge';

function createDb() {
  return {
    simulationTaskSpec: {
      upsert: vi.fn().mockResolvedValue({ id: 'task-spec-1' }),
    },
    simulationRun: {
      upsert: vi.fn().mockResolvedValue({ id: 'run-1' }),
    },
    simulationTrace: {
      upsert: vi.fn().mockResolvedValue({ id: 'trace-1' }),
    },
  };
}

const request = {
  runtimeMode: 'analysis',
  caseId: 'case-1',
  plant: {
    numerator: [1],
    denominator: [1, 1],
    coefficientOrder: 'descending',
  },
  structures: [{ kind: 'gain', enabled: true, params: { k: 2 } }],
  outputs: ['step_response'],
  timeRange: { start: 0, end: 10, samples: 101 },
  frequencyRange: { min: 0.1, max: 10, samples: 50 },
  rootLocus: { minGain: 0, maxGain: 10, samples: 10, currentGain: 2 },
} satisfies ControlAnalysisRequest;

const result = {
  isFallback: false,
  metrics: {
    overshootPct: 5,
    riseTimeSec: 1,
    settlingTimeSec: 3,
    peakTimeSec: 2,
    finalValue: 1,
    phaseMarginDeg: 45,
    gainMarginDb: 10,
    gainCrossoverRadPerSec: 2,
    phaseCrossoverRadPerSec: 4,
    bandwidthRadPerSec: 3,
  },
  rootLocus: { currentPoles: [{ re: -1, im: 1 }] },
  stepResponse: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
} as ControlAnalysisResult;

describe('simulation scene run persistence', () => {
  it('recomputes and persists a student-owned control workbench run with a canonical trace', async () => {
    const db = createDb();
    const compute = vi.fn().mockReturnValue(result);

    const persisted = await persistControlWorkbenchSimulationRun(
      db,
      'student-1',
      {
        clientRunId: 'step-1:module-1:1',
        capabilityId: 'control-linked-comparison',
        request,
        launchContext: {
          lessonId: 'lesson-1',
          moduleId: 'module-1',
          resourceId: 'module-1',
        },
      },
      compute,
    );

    expect(persisted).toEqual({ simulationRunId: 'run-1' });
    expect(compute).toHaveBeenCalledWith(request);
    expect(db.simulationRun.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        ownerUserId: 'student-1',
        runKind: 'scene_simulation',
        sourceDomain: 'simulation_scene',
        status: 'completed',
        resourceId: 'module-1',
        summary: expect.objectContaining({
          qualityTargetMet: true,
          runContract: expect.objectContaining({
            sourceKind: 'simulation-run',
            evaluationVisibility: 'practice',
            officialEligible: false,
            executor: 'server',
            authoritySource: 'control-engine-server-facade',
          }),
        }),
      }),
    }));
    expect(db.simulationTrace.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        runId: 'run-1',
        sampleCount: 2,
      }),
    }));
  });

  it('fails closed when the server runtime returns a fallback result', async () => {
    const db = createDb();
    await expect(persistControlWorkbenchSimulationRun(
      db,
      'student-1',
      {
        clientRunId: 'run-fallback',
        capabilityId: 'control-linked-comparison',
        request,
        launchContext: {},
      },
      () => ({ ...result, isFallback: true }),
    )).rejects.toThrow('control-analysis-fallback-result');
    expect(db.simulationRun.upsert).not.toHaveBeenCalled();
  });

  it('does not write a SimulationRun when the server facade throws unavailable', async () => {
    const db = createDb();
    await expect(persistControlWorkbenchSimulationRun(
      db,
      'student-1',
      {
        clientRunId: 'run-unavailable',
        capabilityId: 'control-linked-comparison',
        request,
        launchContext: {},
      },
      () => {
        throw new ControlEngineFailure({
          state: 'unavailable',
          category: 'non-finite-result',
          message: 'analysis is not a finite numerical result.',
          retryable: false,
        });
      },
    )).rejects.toBeInstanceOf(ControlEngineFailure);
    expect(db.simulationRun.upsert).not.toHaveBeenCalled();
    expect(db.simulationTrace.upsert).not.toHaveBeenCalled();
  });

  it('changes the task spec identity when the analysis request identity changes', async () => {
    const db = createDb();
    const compute = vi.fn().mockReturnValue(result);
    await persistControlWorkbenchSimulationRun(
      db,
      'student-1',
      {
        clientRunId: 'run-identity-a',
        capabilityId: 'control-linked-comparison',
        request,
        launchContext: {},
      },
      compute,
    );
    await persistControlWorkbenchSimulationRun(
      db,
      'student-1',
      {
        clientRunId: 'run-identity-b',
        capabilityId: 'control-linked-comparison',
        request: { ...request, caseId: 'case-2' },
        launchContext: {},
      },
      compute,
    );
    const firstSpec = db.simulationTaskSpec.upsert.mock.calls[0]?.[0] as { create: { specHash: string } };
    const secondSpec = db.simulationTaskSpec.upsert.mock.calls[1]?.[0] as { create: { specHash: string } };
    expect(firstSpec.create.specHash).not.toBe(secondSpec.create.specHash);
  });

  it('persists a completed cruise trace under the current student and registered resource', async () => {
    const db = createDb();
    const traceInput: CruiseTelemetryBridgeInput = {
      runId: 'cruise-run-1',
      startedAt: '2026-07-25T01:00:00.000Z',
      completedAt: '2026-07-25T01:10:00.000Z',
      seed: 42,
      state: {
        time: 600,
        heading: 10,
        targetHeading: 10,
        yawRate: 0,
        rudder: 0,
        speed: 10,
        rollAngle: 0.01,
        seaState: 3,
        waveDirection: 90,
        finStabilizerEnabled: true,
        notchFilterEnabled: true,
        comfort: {
          msi: 1,
          rollRms: 0.5,
          rollPeak: 1,
          comfortRating: 'excellent',
          vdv: 0.2,
          frequencyWeightedAccel: 0.1,
        },
        finPower: 20,
        controlMode: 'pid',
        pidGains: { kp: 1, ki: 0.1, kd: 0.2 },
        targetForm: {
          overshoot: 10,
          settlingTime: 60,
          steadyError: 1,
          maxLateralAccel: 0.2,
        },
      },
      performance: {
        overshoot: 50,
        settlingTime: 120,
        accel: 0.5,
        settled: false,
      },
      consistencyScore: { score: 90 },
      sampleFrameCount: 1200,
      virtualModeEnabled: true,
    };

    const persisted = await persistSceneTraceSimulationRun(
      db,
      'student-1',
      {
        traceSummary: buildCruiseTelemetryBridgeSummary(traceInput),
        launchContext: {
          registryId: 'sim-scene-cruise',
          sessionId: 'session-1',
        },
      },
      () => ({
        score: 90,
        metrics: {
          avgError: 1,
          maxRudderRate: 2,
          settlingTime: 40,
          overshoot: 5,
        },
      }),
    );

    expect(persisted).toEqual({ simulationRunId: 'run-1' });
    expect(db.simulationRun.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        ownerUserId: 'student-1',
        resourceId: 'sim-scene-cruise',
        sessionId: 'session-1',
        status: 'completed',
        summary: expect.objectContaining({
          qualityTargetMet: true,
          runContract: expect.objectContaining({
            sourceKind: 'practice-outcome',
            evaluationVisibility: 'practice',
            officialEligible: false,
          }),
        }),
      }),
    }));
    expect(db.simulationTrace.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        checksum: expect.stringMatching(/^sha256:/),
        sampleCount: 241,
        sampleStorageUri: null,
      }),
    }));
  });

  it('persists a path-bound course demo completion without a client-reported trace', async () => {
    const db = createDb();

    const persisted = await persistPathCourseDemoSimulationRun(db, 'student-1', {
      launchContext: {
        pathId: 'path-1',
        pathNodeId: 'simulation:control-correction-step-response-lab',
        resourceId: 'simulation:control-correction-step-response-lab',
        stepId: 'step-11',
      },
    });

    expect(persisted).toEqual({ simulationRunId: 'run-1' });
    expect(db.simulationRun.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        ownerUserId: 'student-1',
        resourceId: 'simulation:control-correction-step-response-lab',
        status: 'completed',
        sceneSpecVersion: 'path-course-demo',
        taskSpecSnapshot: expect.objectContaining({
          launchContext: {
            pathId: 'path-1',
            pathNodeId: 'simulation:control-correction-step-response-lab',
            resourceId: 'simulation:control-correction-step-response-lab',
            stepId: 'step-11',
          },
        }),
      }),
    }));
    expect(db.simulationTrace.upsert).not.toHaveBeenCalled();
  });
});
