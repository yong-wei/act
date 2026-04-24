import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONTROL_ODYSSEY_LEVELS, getTransferFunctionModel } from '@/resources/interactive-learning/control-odyssey/level-data';
import { buildRustSimulationRequest, createInitialRustSimulationState } from '@/resources/interactive-learning/control-odyssey/engine/rust-runtime-adapter';

describe('control odyssey Rust runtime adapter', () => {
  it('marks level-data transfer function coefficients as ascending for Rust', () => {
    const level = CONTROL_ODYSSEY_LEVELS.find((item) => item.id === 'level-1');
    expect(level).toBeTruthy();

    const model = getTransferFunctionModel(level!.model);
    const request = buildRustSimulationRequest({
      dt: 1 / 60,
      inputCommand: 0,
      disturbance: 0,
      plantModel: model,
      mode: 'MANUAL',
      state: createInitialRustSimulationState(200),
      pid: { kp: 0, ki: 0, kd: 0 },
      outputLimits: { manual: 1 },
    });

    expect(request.model.coefficientOrder).toBe('ascending');
    expect(request.model.denominator).toEqual([0, 1]);
  });

  it('maps controller levels, setpoint state, and output disturbance into the Rust request', () => {
    const level = CONTROL_ODYSSEY_LEVELS.find((item) => item.id === 'level-15')!;
    const state = createInitialRustSimulationState(200);
    state.r = 240;

    const request = buildRustSimulationRequest({
      dt: 1 / 60,
      inputCommand: 0,
      disturbance: -18,
      plantModel: getTransferFunctionModel(level.model),
      mode: 'AUTO',
      state,
      pid: { kp: 2.2, ki: 0.4, kd: 0.1 },
      speedFeedback: { enabled: true, tau: 0.7 },
      feedforward: { enabled: true, gain: 0.5, base: 200 },
      smithPredictor: { enabled: true, delay: 0.3 },
      outputLimits: { manual: 3, p: 3, i: 2, d: 1, vfb: 4, ff: 5 },
    });

    expect(request.input.disturbance).toBe(-18);
    expect(request.state.r).toBe(240);
    expect(request.controller.limits).toEqual({ manual: 3, p: 3, i: 2, d: 1, vfb: 4, ff: 5 });
    expect(request.controller.speedFeedback?.enabled).toBe(true);
    expect(request.controller.feedforward?.enabled).toBe(true);
    expect(request.controller.smithPredictor?.enabled).toBe(true);
    expect(request.model.delay).toBe(0.3);
  });

  it('keeps the production PhysicsEngine facade off the old TypeScript numeric plant', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/resources/interactive-learning/control-odyssey/engine/physics.ts'),
      'utf8',
    );

    expect(source).not.toContain('createLinearPlant');
    expect(source).toContain('computeRustSimulationStep');
  });
});
