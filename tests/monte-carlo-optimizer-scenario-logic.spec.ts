import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  optimizePIDParams,
  getLegacySceneLogic,
  getScenarioLogic,
  DEFAULT_TARGET,
} from '@/resources/simulations/lib/monte-carlo-optimizer';
import type { SimpleSimConfig } from '@/resources/simulations/lib/monte-carlo-optimizer';

vi.mock('@/resources/simulations/rust/control-engine-server-runtime', () => {
  const mockNomotoRequests: unknown[] = [];
  return {
    mockNomotoRequests,
    preloadVirtualSimulationServerRuntime: vi.fn(),
    computeVirtualSimulationServerStep: vi.fn((request: unknown) => {
      mockNomotoRequests.push(request);
      const req = request as Record<string, unknown>;
      const nomoto = req.nomoto as Record<string, unknown> | undefined;
      const speed = (nomoto?.speedMps as number) ?? 7.5;
      const duration = (req.duration as number) ?? 240;
      const dt = (req.dt as number) ?? 0.5;
      const steps = Math.floor(duration / dt);

      const time: number[] = [];
      const desiredHeading: number[] = [];
      const actualHeading: number[] = [];
      const speedArr: number[] = [];
      const rudder: number[] = [];
      const trajectory: Array<{ time: number; x: number; z: number; heading: number; rudder: number }> = [];

      let x = 0;
      let z = 0;
      let heading = 0;

      for (let i = 0; i <= steps; i++) {
        const t = i * dt;
        time.push(t);

        const targetHeading = t < 90 ? (t / 90) * 90 : 90;
        const headingError = targetHeading - heading;
        const rudderCmd = Math.max(-5, Math.min(5, headingError * 0.1));

        heading += rudderCmd * dt;
        heading = Math.max(0, Math.min(90, heading));

        desiredHeading.push(targetHeading);
        actualHeading.push(heading);
        speedArr.push(speed);
        rudder.push(rudderCmd);

        const headingRad = (heading * Math.PI) / 180;
        x += speed * Math.cos(headingRad) * dt;
        z += speed * Math.sin(headingRad) * dt;

        trajectory.push({ time: t, x, z, heading, rudder: rudderCmd });
      }

      let totalError = 0;
      for (let i = 0; i < time.length; i++) {
        totalError += Math.abs(desiredHeading[i] - actualHeading[i]);
      }

      return {
        trajectory,
        chartData: { time, desiredHeading, actualHeading, speed: speedArr, rudder },
        metrics: {
          avgError: totalError / time.length,
          maxRudderRate: 1.5,
        },
      };
    }),
  };
});

const legacyConfig: SimpleSimConfig = {
  nomotoK: 0.156,
  nomotoT: 28.68,
  shipSpeed: 7.5,
};

describe('PID optimizer scenario rudder rate isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('legacy v1 runtime request does NOT include maxRudderRateDegPerSec', async () => {
    const { mockNomotoRequests } = await import(
      '@/resources/simulations/rust/control-engine-server-runtime'
    ) as { mockNomotoRequests: unknown[] };
    const legacyScenario = getLegacySceneLogic('turn90', DEFAULT_TARGET.targetHeading);

    expect(legacyScenario.runtimeVersion).toBe('simulation-optimizer-runtime-v1');

    optimizePIDParams(
      legacyConfig,
      DEFAULT_TARGET,
      undefined,
      3,
      3,
      { scenario: legacyScenario, seed: 42 }
    );

    expect(mockNomotoRequests.length).toBeGreaterThan(0);
    for (const request of mockNomotoRequests) {
      const req = request as Record<string, unknown>;
      const nomoto = req.nomoto as Record<string, unknown> | undefined;
      expect(nomoto).toBeDefined();
      expect(nomoto).not.toHaveProperty('maxRudderRateDegPerSec');
    }
  });

  it('calibrated v2 runtime request DOES include maxRudderRateDegPerSec: 5', async () => {
    const { mockNomotoRequests } = await import(
      '@/resources/simulations/rust/control-engine-server-runtime'
    ) as { mockNomotoRequests: unknown[] };
    mockNomotoRequests.length = 0;

    const v2Scenario = getScenarioLogic('turn90', DEFAULT_TARGET.targetHeading);

    expect(v2Scenario.runtimeVersion).toBe('simulation-optimizer-runtime-v2');

    optimizePIDParams(
      legacyConfig,
      DEFAULT_TARGET,
      undefined,
      3,
      3,
      { scenario: v2Scenario, seed: 42 }
    );

    expect(mockNomotoRequests.length).toBeGreaterThan(0);
    for (const request of mockNomotoRequests) {
      const req = request as Record<string, unknown>;
      const nomoto = req.nomoto as Record<string, unknown> | undefined;
      expect(nomoto).toBeDefined();
      expect(nomoto.maxRudderRateDegPerSec).toBe(5);
    }
  });

  it('legacy v1 uses 120s duration and 60s reference, v2 uses 240s duration and 150s reference', () => {
    const legacy = getLegacySceneLogic('turn90', 90);
    const v2 = getScenarioLogic('turn90', 90);

    expect(legacy.duration).toBe(120);
    expect(legacy.referenceCompletedAt).toBe(60);
    expect(legacy.runtimeVersion).toBe('simulation-optimizer-runtime-v1');

    expect(v2.duration).toBe(240);
    expect(v2.referenceCompletedAt).toBe(150);
    expect(v2.runtimeVersion).toBe('simulation-optimizer-runtime-v2');
  });

  it('default v2 scenario achieves at least 60 score', () => {
    const result = optimizePIDParams(
      legacyConfig,
      DEFAULT_TARGET,
      undefined,
      10,
      10,
      { seed: 42 }
    );

    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.replay).toBeDefined();
  });
});
