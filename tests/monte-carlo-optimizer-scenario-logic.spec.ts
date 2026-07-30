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

      // Read actual request fields matching production contract
      const nomoto = req.nomoto as Record<string, unknown> | undefined;
      const pid = req.pid as Record<string, unknown> | undefined;
      const headingSchedule = req.headingSchedule as Array<{ time: number; headingDeg: number }>;
      const duration = (req.duration as number) ?? 240;
      const dt = (req.dt as number) ?? 0.5;
      const start = req.start as Record<string, unknown> | undefined;

      // Nomoto params from production request shape
      const K = (nomoto?.K as number) ?? 0.08;
      const T = (nomoto?.T as number) ?? 55;
      const speedMps = (nomoto?.speedMps as number) ?? 7.5;
      const maxRudderDeg = (nomoto?.maxRudderDeg as number) ?? 35;
      const maxRudderRate = (nomoto?.maxRudderRateDegPerSec as number) ?? 0;

      // PID params from request
      const kp = (pid?.kp as number) ?? 1;
      const ki = (pid?.ki as number) ?? 0.01;
      const kd = (pid?.kd as number) ?? 1;

      // Start state from request
      let heading = (start?.headingDeg as number) ?? 0;
      let x = (start?.x as number) ?? 0;
      let z = (start?.z as number) ?? 0;
      let headingRate = 0;
      let integral = 0;
      let prevError = 0;
      let prevRudder = 0;

      // Interpolate desired heading from schedule
      const getDesired = (t: number) => {
        if (!headingSchedule || headingSchedule.length === 0) return 0;
        const first = headingSchedule[0];
        if (t <= first.time) return first.headingDeg;
        for (let i = 1; i < headingSchedule.length; i++) {
          const prev = headingSchedule[i - 1];
          const next = headingSchedule[i];
          if (t <= next.time) {
            if (next.time === prev.time) return next.headingDeg;
            const progress = (t - prev.time) / (next.time - prev.time);
            return prev.headingDeg + (next.headingDeg - prev.headingDeg) * progress;
          }
        }
        return headingSchedule[headingSchedule.length - 1].headingDeg;
      };

      const timeCount = Math.floor(duration / dt);
      const time: number[] = [];
      const desiredHeading: number[] = [];
      const actualHeading: number[] = [];
      const speedArr: number[] = [];
      const rudderArr: number[] = [];
      const trajectory: Array<{ time: number; x: number; z: number; heading: number; rudder: number }> = [];

      let maxRudderRateActual = 0;

      for (let i = 0; i <= timeCount; i++) {
        const t = i * dt;
        time.push(t);
        const desired = getDesired(t);
        desiredHeading.push(desired);

        // PID controller
        const error = desired - heading;
        integral += error * dt;
        const derivative = dt > 0 ? (error - prevError) / dt : 0;
        let rudder = kp * error + ki * integral + kd * derivative;

        // Clamp rudder to actuator limit
        rudder = Math.max(-maxRudderDeg, Math.min(maxRudderDeg, rudder));

        // Apply rudder rate limit (v2 only)
        if (maxRudderRate > 0) {
          const maxChange = maxRudderRate * dt;
          const change = rudder - prevRudder;
          if (Math.abs(change) > maxChange) {
            rudder = prevRudder + Math.sign(change) * maxChange;
          }
        }

        // Track max rudder rate
        if (i > 0) {
          const rate = Math.abs(rudder - prevRudder) / dt;
          if (rate > maxRudderRateActual) maxRudderRateActual = rate;
        }

        prevRudder = rudder;
        prevError = error;

        // Nomoto first-order model: T * dω/dt + ω = K * δ
        headingRate += (K * rudder - headingRate) / T * dt;

        // Update heading
        heading += headingRate * dt;

        // Update position
        const headingRad = heading * Math.PI / 180;
        x += speedMps * Math.cos(headingRad) * dt;
        z += speedMps * Math.sin(headingRad) * dt;

        actualHeading.push(heading);
        speedArr.push(speedMps);
        rudderArr.push(rudder);
        trajectory.push({ time: t, x, z, heading, rudder });
      }

      // Compute avgError
      let totalError = 0;
      for (let i = 0; i < desiredHeading.length; i++) {
        totalError += Math.abs(desiredHeading[i] - actualHeading[i]);
      }
      const avgError = desiredHeading.length > 0 ? totalError / desiredHeading.length : 0;

      return {
        trajectory,
        chartData: { time, desiredHeading, actualHeading, speed: speedArr, rudder: rudderArr },
        metrics: {
          avgError,
          maxRudderRate: maxRudderRateActual,
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

  it('default v2 scenario achieves at least 60 score with realistic PID+Nomoto dynamics', () => {
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
    expect(result.metrics.avgError).toBeLessThan(DEFAULT_TARGET.maxError);
  });
});
