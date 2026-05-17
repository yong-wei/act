import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CONTROL_ODYSSEY_LEVELS,
  buildRuntimeTierConfig,
  getTierConfig,
  getTransferFunctionModel,
} from '@/resources/interactive-learning/control-odyssey/level-data';
import { buildRustSimulationRequest, createInitialRustSimulationState } from '@/resources/interactive-learning/control-odyssey/engine/rust-runtime-adapter';
import {
  buildOfficialOdysseyReplayControllerConfig,
  computeOfficialOdysseyTelemetry,
} from '@/resources/interactive-learning/control-odyssey/engine/official-simulation';

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

  it('initializes derivative-on-measurement state for the Rust stepper', () => {
    const state = createInitialRustSimulationState(200);

    expect(state.prevFeedbackY).toBe(200);
    expect(state.derivativeState).toBe(0);
  });

  it('keeps game level transfer functions strictly proper to avoid instant ship teleports', () => {
    for (const level of CONTROL_ODYSSEY_LEVELS) {
      const model = getTransferFunctionModel(level.model);
      const numeratorOrder = model.numerator.length - 1;
      const denominatorOrder = model.denominator.length - 1;

      expect(
        numeratorOrder,
        `${level.id} should not have a direct feedthrough term in the game plant`,
      ).toBeLessThan(denominatorOrder);
    }
  });

  it('keeps the production PhysicsEngine facade off the old TypeScript numeric plant', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/resources/interactive-learning/control-odyssey/engine/physics.ts'),
      'utf8',
    );

    expect(source).not.toContain('createLinearPlant');
    expect(source).toContain('computeRustSimulationStep');
  });

  it('computes official Odyssey telemetry on the server instead of trusting client metrics', () => {
    const metrics = computeOfficialOdysseyTelemetry({
      levelId: 'level-1',
      tier: 'bronze',
      controllerId: 'PID',
      controlMode: 'AUTO',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      controllerLevels: { P: 3, PI: 3, PD: 3, PID: 1, VFB: 0, FF: 0, SMITH: 0 },
    });

    expect(metrics.officialTelemetrySource).toBe('server-rust-simulation');
    expect(metrics.settlingTime).toBeGreaterThan(0);
    expect(metrics.settlingTime).toBeLessThan(20);
    expect(metrics.controlEnergy).toBeGreaterThanOrEqual(0);
  });

  it('builds deterministic sequence references for random Odyssey tiers', () => {
    for (const tier of ['silver', 'gold'] as const) {
      const first = buildRuntimeTierConfig(getTierConfig('level-1', tier));
      const second = buildRuntimeTierConfig(getTierConfig('level-1', tier));

      expect(first.reference.seed).toBe(second.reference.seed);
      expect(first.reference.events).toEqual(second.reference.events);
      expect(first.reference.events).toHaveLength(4);
    }
  });

  it('clamps official replay controller parameters to server-side unlock levels', () => {
    const replayController = buildOfficialOdysseyReplayControllerConfig({
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      extraParams: { speedFeedbackTau: 2, feedforwardGain: 2, smithDelay: 2 },
      enableSpeedFeedback: true,
      enableFeedforward: true,
      enableSmithPredictor: true,
      controllerLevels: { P: 1, PI: 0, PD: 0, PID: 0, VFB: 0, FF: 0, SMITH: 0 },
    });

    expect(replayController.controllerId).toBe('P');
    expect(replayController.pid).toEqual({ kp: 0.1, ki: 0, kd: 0 });
    expect(replayController.enableSpeedFeedback).toBe(false);
    expect(replayController.enableFeedforward).toBe(false);
    expect(replayController.enableSmithPredictor).toBe(false);
    expect(replayController.extraParams).toEqual({
      speedFeedbackTau: 0,
      feedforwardGain: 0,
      smithDelay: 0,
    });
  });

  it('rejects manual official Odyssey replay until input traces are persisted', () => {
    expect(() => computeOfficialOdysseyTelemetry({
      levelId: 'level-1',
      tier: 'bronze',
      controllerId: 'P',
      controlMode: 'MANUAL',
      pidParams: { kp: 2.1, ki: 0, kd: 0 },
      controllerLevels: { P: 3, PI: 0, PD: 0, PID: 0, VFB: 0, FF: 0, SMITH: 0 },
    })).toThrow('Manual Odyssey runs require input trace replay');
  });

  it('keeps the PD visual layer from redrawing the full ship silhouette', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/resources/interactive-learning/control-odyssey/components/ShipAvatar.tsx'),
      'utf8',
    );
    const dLayerStart = source.indexOf('className={styles.dAura}');
    const dLayerEnd = source.indexOf('<g className={cn(styles.layer, hasFF', dLayerStart);
    const dLayerSource = source.slice(dLayerStart, dLayerEnd);

    expect(dLayerStart).toBeGreaterThan(0);
    expect(dLayerSource).not.toContain('baseHullPath');
    expect(dLayerSource).not.toContain('wingTopPath');
    expect(dLayerSource).not.toContain('engineTopPath');
  });
});
