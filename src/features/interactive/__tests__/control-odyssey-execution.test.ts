import { describe, expect, it } from 'vitest';
import { computeControlOdysseyServerStep, createControlOdysseyReplayStep } from '@/lib/control-engine/server';
import { SimulationClock } from '@/lib/simulation';
import { computeReferenceY } from '@/resources/interactive-learning/control-odyssey/engine/level-generator';
import { CONTROL_ODYSSEY_LEVELS, getTransferFunctionModel } from '@/resources/interactive-learning/control-odyssey/level-data';
import { buildRustSimulationRequest, createInitialRustSimulationState } from '@/resources/interactive-learning/control-odyssey/engine/rust-runtime-adapter';
import { OdysseyExecution } from '@/resources/interactive-learning/control-odyssey/engine/run-execution';
import { replayOdysseyInput } from '@/resources/interactive-learning/control-odyssey/engine/official-simulation';
import { maximumOdysseySteps, validateOdysseyInputTrace, type OdysseyRunConfig } from '@/resources/interactive-learning/control-odyssey/engine/input-trace';

const levels = { P: 5, PI: 5, PD: 5, PID: 5, VFB: 5, FF: 5, SMITH: 5 };
const config: OdysseyRunConfig = {
  controlMode: 'AUTO', controllerId: 'P', pidParams: { kp: 1.6, ki: 0, kd: 0 },
  extraParams: { speedFeedbackTau: 0.05, feedforwardGain: 0.05, smithDelay: 0.1 },
  enableSpeedFeedback: false, enableFeedforward: false, enableSmithPredictor: false, difficultyScale: 1,
};

describe('Odyssey versioned execution', () => {
  it('keeps the per-replay sealed executor numerically equal to the ordinary step facade', () => {
    const direct = new OdysseyExecution('level-1', 'bronze', levels);
    const replay = new OdysseyExecution('level-1', 'bronze', levels);
    const execute = createControlOdysseyReplayStep();
    for (let index = 0; index < 300; index += 1) {
      direct.advance(config, 0, computeControlOdysseyServerStep);
      replay.advance(config, 0, execute);
      expect(replay.state).toEqual(direct.state);
    }
    expect(replay.getMetrics()).toEqual(direct.getMetrics());
  });

  it('delays an actual Rust plant response by zero, one or two samples exactly', () => {
    const model = getTransferFunctionModel(CONTROL_ODYSSEY_LEVELS[0].model);
    const execute = createControlOdysseyReplayStep();
    const run = (samples: number) => {
      let state = { ...createInitialRustSimulationState(200), u: 1 };
      return Array.from({ length: 8 }, () => {
        state = execute(buildRustSimulationRequest({
          dt: 1 / 60, inputCommand: 0, disturbance: 0, state,
          plantModel: { ...model, delay: samples / 60 }, mode: 'MANUAL',
          pid: { kp: 0, ki: 0, kd: 0 }, outputLimits: { manual: 1 },
        })).state;
        return state.y;
      });
    };
    const zero = run(0);
    for (const delay of [1, 2]) {
      const delayed = run(delay);
      expect(delayed.slice(0, delay)).toEqual(Array(delay).fill(200));
      expect(delayed.slice(delay)).toEqual(zero.slice(0, -delay));
    }
  });

  it('replays automatic offsets and parameter changes from their actual steps', () => {
    const runtime = new OdysseyExecution('level-1', 'bronze', levels);
    while (!runtime.terminal) {
      const step = runtime.trace.totalSteps;
      const command = step < 5 ? 1 : step < 10 ? -1 : 0;
      runtime.advance({ ...config, pidParams: { ...config.pidParams, kp: step > 400 ? 1.4 : 1.6 } }, command, computeControlOdysseyServerStep);
    }
    expect(runtime.terminal).toBe('VICTORY');
    expect(runtime.trace.changes).toHaveLength(4);
    const replay = replayOdysseyInput({ levelId: 'level-1', tier: 'bronze', controllerLevels: levels, inputTrace: runtime.trace });
    expect(replay.metrics).toEqual(runtime.getMetrics());
    expect(replay.metrics.settlingTime).toBeGreaterThan(0);
  });

  it('records mode and output-limit changes and resets the automatic offset on mode changes', () => {
    const runtime = new OdysseyExecution('level-1', 'bronze', levels);
    const execute = createControlOdysseyReplayStep();
    runtime.advance({ ...config, outputLevels: { ...levels, P: 4 } }, 1, execute);
    expect(runtime.autoOffset).toBe(2);
    runtime.advance({ ...config, controlMode: 'MANUAL', outputLevels: levels }, 0, execute);
    expect(runtime.autoOffset).toBe(0);
    runtime.advance(config, 0, execute);
    expect(runtime.autoOffset).toBe(0);
    expect(runtime.trace.changes).toHaveLength(3);
    expect(() => validateOdysseyInputTrace(runtime.trace, 'level-1', 'bronze', { ...levels, P: 3 })).toThrow();
  });

  it('replays a successful manual run without substituting its final controller settings', () => {
    const runtime = new OdysseyExecution('level-1', 'bronze', levels);
    const manual = { ...config, controlMode: 'MANUAL' as const };
    while (!runtime.terminal) {
      const r = computeReferenceY(runtime.tierConfig.reference, runtime.scrollX + 102.5);
      const desired = 1.6 * (r - runtime.state.y) / 200;
      const command = Math.abs(desired - runtime.state.u) < 0.0125 ? 0 : Math.sign(desired - runtime.state.u);
      runtime.advance(manual, command, computeControlOdysseyServerStep);
    }
    expect(runtime.terminal).toBe('VICTORY');
    const replay = replayOdysseyInput({ levelId: 'level-1', tier: 'bronze', controllerLevels: levels, inputTrace: runtime.trace });
    expect(replay.metrics).toEqual(runtime.getMetrics());
  });

  it('stops remaining low-frame-rate substeps at the exact winning sample', () => {
    const runtime = new OdysseyExecution('level-1', 'bronze', levels);
    const clock = new SimulationClock({ dt: 1 / 60, maxSubSteps: 120 });
    let calls = 0;
    while (!runtime.terminal) clock.advance(0.1, () => {
      calls += 1;
      return runtime.advance(config, 0, computeControlOdysseyServerStep);
    });
    expect(runtime.terminal).toBe('VICTORY');
    expect(calls).toBe(maximumOdysseySteps('level-1', 'bronze'));
    expect(runtime.getMetrics().settlingTime).toBeCloseTo(2.8, 10);
    const snapshot = runtime.getMetrics();
    expect(runtime.advance(config, 1, computeControlOdysseyServerStep)).toBe(false);
    expect(runtime.getMetrics()).toEqual(snapshot);
    expect(runtime.trace.totalSteps).toBe(calls);
  });

  it('checks the actual finish segment for collision before declaring victory', () => {
    const runtime = new OdysseyExecution('level-1', 'bronze', levels);
    runtime.scrollX = runtime.tierConfig.distance - 102.5;
    const keepOutside = (request: Parameters<typeof computeControlOdysseyServerStep>[0]) => {
      const result = computeControlOdysseyServerStep(request);
      result.state.y = 0;
      return result;
    };
    expect(runtime.advance(config, 0, keepOutside)).toBe(false);
    expect(runtime.terminal).toBe('GAME_OVER');
  });

  it('rejects unbounded, unordered, missing, unowned and incomplete input records', () => {
    const trace = { version: 1, totalSteps: 1160, changes: [{ step: 0, command: 0, config }] };
    for (const invalid of [
      undefined, { ...trace, version: 2 }, { ...trace, totalSteps: 1e9 },
      { ...trace, changes: [{ step: 1, command: 0, config }] },
      { ...trace, changes: [{ step: 0, command: 2, config }] },
      { ...trace, changes: [{ step: 0, command: 0, config: { ...config, difficultyScale: Infinity } }] },
      { ...trace, changes: [{ step: 0, command: 0, config: { ...config, enableSmithPredictor: true } }] },
    ]) expect(() => validateOdysseyInputTrace(invalid, 'level-1', 'bronze', { ...levels, SMITH: 0 })).toThrow();
    expect(() => validateOdysseyInputTrace(trace, 'unknown', 'bronze', levels)).toThrow();
    expect(() => validateOdysseyInputTrace(trace, 'level-1', 'bronze', { ...levels, P: 1 })).toThrow();
    expect(() => replayOdysseyInput({ levelId: 'level-1', tier: 'bronze', controllerLevels: levels, inputTrace: { ...trace, totalSteps: 2 } })).toThrow('运行未合法通关');
  });

  it('executes all fifteen models and Smith with finite shared metrics after the delay correction', () => {
    for (const level of CONTROL_ODYSSEY_LEVELS) {
      const runtime = new OdysseyExecution(level.id, 'bronze', levels);
      for (let index = 0; index < 260 && !runtime.terminal; index += 1) {
        runtime.advance({ ...config, enableSmithPredictor: true, extraParams: { ...config.extraParams, smithDelay: 0.3 } }, 0, computeControlOdysseyServerStep);
      }
      expect(Object.values(runtime.getMetrics()).every(Number.isFinite), level.id).toBe(true);
      expect(Number.isFinite(runtime.state.y), level.id).toBe(true);
    }
  });
});
