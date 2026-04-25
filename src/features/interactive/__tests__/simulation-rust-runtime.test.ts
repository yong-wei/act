import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildDestroyerHifiStepRequest,
  createDestroyerHifiStateFromSimulation,
  mapDestroyerHifiStepResult,
} from '@/resources/simulations/rust/destroyer-hifi-adapter';

describe('simulation Rust runtime adapter', () => {
  it('builds the destroyer_hifi request in engineering units', () => {
    const request = buildDestroyerHifiStepRequest({
      dtS: 1 / 60,
      targetHeadingDeg: 90,
      controlMode: 'pid',
      pid: { kp: 2, ki: 0.2, kd: 8 },
      manualRudderDeg: -6,
      disturbanceEnabled: true,
      state: createDestroyerHifiStateFromSimulation({
        timeS: 12,
        headingDeg: 14,
        yawRateDegS: 0.8,
        positionX: -120,
        positionZ: 35,
        rudderDeg: 4,
        speedMps: 15,
      }),
    });

    expect(request.modelId).toBe('destroyer_hifi');
    expect(request.dtS).toBeCloseTo(1 / 60);
    expect(request.state.positionYM).toBe(35);
    expect(request.state.headingDeg).toBe(14);
    expect(request.state).not.toHaveProperty('headingRad');
    expect(request.pid).toEqual({ kp: 2, ki: 0.2, kd: 8 });
  });

  it('maps Rust positionYM back to the page z axis', () => {
    const mapped = mapDestroyerHifiStepResult({
      timeS: 2,
      targetHeadingDeg: 30,
      headingDeg: 12,
      yawRateDegS: 0.5,
      positionXM: 40,
      positionYM: -75,
      rudderDeg: 8,
      speedMps: 14.8,
    });

    expect(mapped.position.x).toBe(40);
    expect(mapped.position.z).toBe(-75);
    expect(mapped.headingRad).toBeCloseTo((12 * Math.PI) / 180);
    expect(mapped.yawRateRad).toBeCloseTo((0.5 * Math.PI) / 180);
  });

  it('keeps the destroyer page off the old local Nomoto step', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'),
      'utf8',
    );

    expect(source).toContain('computeDestroyerHifiStep');
    expect(source).not.toContain('nomotoStep');
    expect(source).not.toContain('nomotoParams.K * rudderRad');
    expect(source).not.toContain('nomotoParams.T');
  });
});
