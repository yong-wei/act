import { beforeEach, describe, expect, it, vi } from 'vitest';

const { computeVirtualSimulationServerStepMock } = vi.hoisted(() => ({
  computeVirtualSimulationServerStepMock: vi.fn(() => ({
    trajectory: [],
    chartData: {
      time: [150, 180, 240],
      desiredHeading: [90, 90, 90],
      actualHeading: [86, 90, 90],
      speed: [15, 15, 15],
      rudder: [5, 0, 0],
    },
    metrics: {
      avgError: 26,
      maxRudderRate: 5,
    },
  })),
}));

vi.mock('../rust/control-engine-server-runtime', () => ({
  computeVirtualSimulationServerStep: computeVirtualSimulationServerStepMock,
}));

import {
  DEFAULT_TARGET,
  optimizePIDParams,
  type SimpleSimConfig,
} from '../lib/monte-carlo-optimizer';

describe('PID turn scenario calibration', () => {
  beforeEach(() => {
    computeVirtualSimulationServerStepMock.mockClear();
  });

  it('sends one calibrated reference and actuator limit to the runtime', () => {
    const config: SimpleSimConfig = {
      nomotoK: 0.08,
      nomotoT: 55,
      shipSpeed: 15,
    };

    const result = optimizePIDParams(
      config,
      DEFAULT_TARGET,
      {
        kpRange: [3, 3],
        kiRange: [0.001, 0.001],
        kdRange: [5, 5],
      },
      0,
    );

    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.replay).toMatchObject({
      scenarioId: 'turn90-calibrated-v1',
      runtimeVersion: 'simulation-optimizer-runtime-v2',
      scenario: {
        id: 'turn90-calibrated-v1',
        duration: 240,
        referenceCompletedAt: 150,
        start: { x: 0, z: 0, headingDeg: 0 },
        maxRudderRateDegPerSec: 5,
        headingSchedule: [
          { time: 0, headingDeg: 0 },
          { time: 60, headingDeg: 0 },
          { time: 150, headingDeg: 90 },
          { time: 240, headingDeg: 90 },
        ],
      },
    });
    expect(computeVirtualSimulationServerStepMock).toHaveBeenCalledWith(expect.objectContaining({
      duration: 240,
      start: { x: 0, z: 0, headingDeg: 0 },
      headingSchedule: [
        { time: 0, headingDeg: 0 },
        { time: 60, headingDeg: 0 },
        { time: 150, headingDeg: 90 },
        { time: 240, headingDeg: 90 },
      ],
      nomoto: expect.objectContaining({
        maxRudderRateDegPerSec: 5,
      }),
    }));
  });

  it('evaluates both the initial candidate and each search iteration', () => {
    const result = optimizePIDParams(
      { nomotoK: 0.08, nomotoT: 55, shipSpeed: 15 },
      DEFAULT_TARGET,
      { kpRange: [3, 3], kiRange: [0.001, 0.001], kdRange: [5, 5] },
      1,
    );

    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(computeVirtualSimulationServerStepMock).toHaveBeenCalledTimes(2);
  });

  it('builds the calibrated heading schedule from the requested target heading', () => {
    optimizePIDParams(
      { nomotoK: 0.08, nomotoT: 55, shipSpeed: 15 },
      {
        ...DEFAULT_TARGET,
        targetHeading: 30,
      },
      { kpRange: [3, 3], kiRange: [0.001, 0.001], kdRange: [5, 5] },
      0,
    );

    expect(computeVirtualSimulationServerStepMock).toHaveBeenCalledWith(expect.objectContaining({
      targetHeadingDeg: 30,
      headingSchedule: [
        { time: 0, headingDeg: 0 },
        { time: 60, headingDeg: 0 },
        { time: 150, headingDeg: 30 },
        { time: 240, headingDeg: 30 },
      ],
    }));
  });

  it('keeps caller identity but overrides stale scenario replay semantics', () => {
    const result = optimizePIDParams(
      { nomotoK: 0.08, nomotoT: 55, shipSpeed: 15 },
      DEFAULT_TARGET,
      { kpRange: [3, 3], kiRange: [0.001, 0.001], kdRange: [5, 5] },
      0,
      20,
      {
        runContext: {
          runId: 'api-run',
          sceneId: 'simulation/optimizer/nomoto-quick-sim',
          scenarioId: 'turn90',
          seed: 12345,
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-optimizer-runtime-v1',
          modelVersion: 'nomoto-quick-sim-v1',
        },
      },
    );

    expect(result.replay).toMatchObject({
      runId: 'api-run',
      seed: 12345,
      scenarioId: 'turn90-calibrated-v1',
      runtimeVersion: 'simulation-optimizer-runtime-v2',
    });
  });

  it('does not award a settling score when the heading leaves the tolerance band', () => {
    computeVirtualSimulationServerStepMock.mockReturnValueOnce({
      trajectory: [],
      chartData: {
        time: [150, 180, 240],
        desiredHeading: [90, 90, 90],
        actualHeading: [90, 100, 90],
        speed: [15, 15, 15],
        rudder: [5, 0, 0],
      },
      metrics: {
        avgError: 26,
        maxRudderRate: 5,
      },
    });

    const result = optimizePIDParams(
      { nomotoK: 0.08, nomotoT: 55, shipSpeed: 15 },
      DEFAULT_TARGET,
      { kpRange: [3, 3], kiRange: [0.001, 0.001], kdRange: [5, 5] },
      0,
    );

    expect(result.metrics.settlingTime).toBe(90);
    expect(result.score).toBeLessThan(90);
  });
});
