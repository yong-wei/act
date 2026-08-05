import { describe, expect, it } from 'vitest';

import {
  ArenaCompanionContextError,
  resolveArenaCompanionContext,
} from '../companion/arena-companion-context';

describe('Arena companion context', () => {
  it('derives PID parameter and time-domain metric guidance from the registered task', () => {
    const context = resolveArenaCompanionContext('task-second-order-lead-pid', 'pid');

    expect(context.method).toBe('pid');
    expect(context.parameters.map((parameter) => parameter.id)).toEqual(['kp', 'ki', 'kd']);
    expect(context.metrics.map((metric) => metric.id)).toEqual([
      'settlingTime',
      'overshoot',
      'steadyStateError',
      'itae',
    ]);
  });

  it('uses the registered MPC aggregate and time-domain metrics without exposing hidden scenarios', () => {
    const context = resolveArenaCompanionContext('task-ship-roll-mpc-hidden-scenarios', 'mpc');

    expect(context.parameters.map((parameter) => parameter.id)).toEqual([
      'predictionHorizon',
      'controlHorizon',
      'outputWeight',
      'controlWeight',
      'terminalWeight',
      'inputLimit',
      'sampleTime',
    ]);
    expect(context.metrics.map((metric) => metric.id)).toEqual([
      'hiddenScenarioWorst',
      'settlingTime',
      'controlEnergy',
      'overshoot',
    ]);
    expect(context.learningActions.join(' ')).toContain('预测控制');
    expect(context.learningActions.join(' ')).not.toContain('场景参数');
  });

  it('uses black-box experiment and identification guidance instead of PID gains', () => {
    const context = resolveArenaCompanionContext('task-cruise-roll-blackbox-identification', 'black-box-control');

    expect(context.parameters.map((parameter) => parameter.id)).toEqual([
      'identificationQuality',
      'experimentCount',
      'controllerGain',
      'dampingCompensation',
      'energyBudget',
    ]);
    expect(context.metrics.map((metric) => metric.id)).toEqual([
      'trackingError',
      'worstCaseDeviation',
      'controlEnergy',
      'constraintViolations',
    ]);
    expect(context.learningActions.join(' ')).toContain('实验覆盖');
  });

  it('covers every controller method that is currently registered by an Arena task', () => {
    expect(resolveArenaCompanionContext('task-second-order-lead-pid', 'serial-compensator').parameters[0]?.id).toBe('gain');
    expect(resolveArenaCompanionContext('task-third-order-block-diagram', 'composite-compensation').parameters[0]?.id).toBe('prefilterGain');
    expect(resolveArenaCompanionContext('task-ship-roll-optimized-pid-robust', 'optimized-pid').parameters[0]?.id).toBe('speedWeight');
  });

  it('rejects an unknown task and a method that the task does not allow', () => {
    expect(() => resolveArenaCompanionContext('missing-task', 'pid')).toThrow(ArenaCompanionContextError);
    expect(() => resolveArenaCompanionContext('task-ship-roll-mpc-hidden-scenarios', 'pid')).toThrow(
      ArenaCompanionContextError,
    );
  });
});
