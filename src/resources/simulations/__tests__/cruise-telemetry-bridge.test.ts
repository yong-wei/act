import { describe, expect, it } from 'vitest';

import {
  CRUISE_ARENA_OBJECT_ID,
  CRUISE_TRACE_SCENE_ID,
  buildCruiseTelemetryBridgeSummary,
  validateCruiseTelemetryBridgeSummary,
  type CruiseTelemetryBridgeInput,
} from '../simulations/cruise/telemetry-bridge';

function buildInput(overrides: Partial<CruiseTelemetryBridgeInput> = {}): CruiseTelemetryBridgeInput {
  return {
    runId: 'cruise-run-1',
    startedAt: '2026-05-25T08:00:00.000Z',
    completedAt: '2026-05-25T08:05:00.000Z',
    seed: 'cruise-run-1',
    sampleFrameCount: 480,
    virtualModeEnabled: true,
    performance: {
      overshoot: 4.2,
      settlingTime: 38.4,
      accel: 0.082,
      settled: true,
    },
    consistencyScore: { score: 86 },
    state: {
      time: 300,
      heading: 30.8,
      targetHeading: 30,
      yawRate: 0.12,
      rudder: 3.5,
      speed: 9.3,
      rollAngle: 0.034,
      seaState: 3,
      waveDirection: 90,
      finStabilizerEnabled: true,
      notchFilterEnabled: true,
      finPower: 240,
      controlMode: 'pid',
      pidGains: { kp: 1.2, ki: 0.18, kd: 0.42 },
      targetForm: {
        overshoot: 10,
        settlingTime: 60,
        steadyError: 2,
        maxLateralAccel: 0.12,
      },
      comfort: {
        msi: 8.3,
        rollRms: 1.1,
        rollPeak: 3.4,
        comfortRating: 'good',
        vdv: 0.71,
        frequencyWeightedAccel: 0.032,
      },
    },
    ...overrides,
  };
}

describe('cruise telemetry bridge', () => {
  it('builds a SimulationTrace v1 compatible Cruise summary', () => {
    const summary = buildCruiseTelemetryBridgeSummary(buildInput());

    expect(summary.trace.envelope.sceneId).toBe(CRUISE_TRACE_SCENE_ID);
    expect(summary.trace.envelope.protocolVersion).toBe('1.0');
    expect(summary.trace.envelope.scenarioId).toBe('cruise-comfort-course-turn');
    expect(summary.trace.samples.channels).toEqual([
      'time',
      'position',
      'heading',
      'speed',
      'rudder',
      'yawRate',
      'roll',
      'comfort',
    ]);
    expect(summary.trace.summary.metrics).toMatchObject({
      comfort_msi_percent: 8.3,
      turn_overshoot_percent: 4.2,
      settling_time_s: 38.4,
      peak_lateral_accel_g: 0.082,
      consistency_score: 86,
    });
    expect(summary.trace.summary.passed).toBe(true);
  });

  it('marks the Cruise scene relation as separate from the Arena simplified object', () => {
    const summary = buildCruiseTelemetryBridgeSummary(buildInput());

    expect(summary.modelRelation.arenaObjectId).toBe(CRUISE_ARENA_OBJECT_ID);
    expect(summary.modelRelation.relation.relation).toBe('simplified');
    expect(summary.evidenceContext.boundary).toContain('Arena 官方隐藏评测指标');
  });

  it('computes deterministic checksums from normalized summary fields', () => {
    const input = buildInput();
    const first = buildCruiseTelemetryBridgeSummary(input);
    const second = buildCruiseTelemetryBridgeSummary(buildInput());
    const changed = buildCruiseTelemetryBridgeSummary(buildInput({
      performance: {
        ...input.performance,
        overshoot: 9.7,
      },
    }));

    expect(first.trace.envelope.checksum).toBe(second.trace.envelope.checksum);
    expect(first.trace.envelope.checksum).not.toBe(changed.trace.envelope.checksum);
    expect(validateCruiseTelemetryBridgeSummary(first)).toBe(true);
    expect(validateCruiseTelemetryBridgeSummary({
      ...first,
      trace: {
        ...first.trace,
        summary: {
          ...first.trace.summary,
          durationSeconds: 999,
        },
      },
    })).toBe(false);
  });
});
