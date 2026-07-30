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
      const speed = (nomoto?.speed as number) ?? 7.5;
      return JSON.stringify({
        trace: Array.from({ length: 50 }, (_, i) => ({
          t: i * 0.1,
          x: speed * i * 0.1,
          z: 0,
          heading: 0,
          rudder: 0,
        })),
        metrics: {
          avgError: 50,
          maxRudderRate: 2,
          settlingTime: 30,
          overshoot: 5,
        },
      });
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
