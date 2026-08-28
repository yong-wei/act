import { describe, expect, it } from 'vitest';

import { resolveArenaCompanionContext } from '@/features/ai/companion/arena-companion-context';
import {
  generateIntervention,
  shouldIntervene,
  type StudentState,
} from '../policy';

function stateWithAttempts(attemptHistory: StudentState['attemptHistory']): StudentState {
  return {
    currentTask: 'Arena 练习',
    currentAttempt: attemptHistory.length + 1,
    attemptHistory,
  };
}

describe('method-aware companion intervention guidance', () => {
  it('uses registered MPC bounds as advisory practice constraint risks', () => {
    const context = resolveArenaCompanionContext('task-ship-roll-mpc-hidden-scenarios', 'mpc');
    const state = stateWithAttempts([
      {
        attemptNumber: 1,
        params: { predictionHorizon: 16, controlHorizon: 4 },
        result: { hiddenScenarioWorst: 2.6, settlingTime: 4.2, controlEnergy: 7, overshoot: 8 },
        isSuccessful: false,
      },
    ]);

    const decision = shouldIntervene(state, {}, context);
    const guidance = generateIntervention(decision, state, context);

    expect(decision).toMatchObject({ shouldIntervene: true, reason: 'constraint_violation' });
    expect(guidance.content).toContain('练习指标');
    expect(guidance.content).toContain('隐藏场景最差表现');
    expect(guidance.content).toContain('预测控制');
    expect(guidance.content).not.toContain('正式评测');
  });

  it('gives black-box learners experiment-coverage guidance after repeated failures', () => {
    const context = resolveArenaCompanionContext('task-cruise-roll-blackbox-identification', 'black-box-control');
    const state = stateWithAttempts([
      {
        attemptNumber: 1,
        params: { identificationQuality: 0.6, experimentCount: 3 },
        result: { trackingError: 0.2, worstCaseDeviation: 0.4, controlEnergy: 8, constraintViolations: 0 },
        isSuccessful: false,
      },
      {
        attemptNumber: 2,
        params: { identificationQuality: 0.65, experimentCount: 4 },
        result: { trackingError: 0.18, worstCaseDeviation: 0.35, controlEnergy: 9, constraintViolations: 0 },
        isSuccessful: false,
      },
    ]);

    const decision = shouldIntervene(state, {}, context);
    const guidance = generateIntervention(decision, state, context);

    expect(decision).toMatchObject({ shouldIntervene: true, reason: 'multiple_failures' });
    expect(guidance.content).toContain('黑箱');
    expect(guidance.suggestedNextSteps.join(' ')).toContain('实验覆盖');
    expect(guidance.highlightParams).toContain('identificationQuality');
    expect(guidance.highlightParams).not.toContain('kp');
  });

  it('preserves the existing PID-oriented behavior when no Arena context is supplied', () => {
    const state = stateWithAttempts([
      {
        attemptNumber: 1,
        params: { kp: 1.2, ki: 0.1, kd: 0.4 },
        result: { overshoot: 42, settlingTime: 35 },
        isSuccessful: false,
      },
    ]);

    const decision = shouldIntervene(state);
    const guidance = generateIntervention(decision, state);

    expect(decision).toMatchObject({ shouldIntervene: true, reason: 'constraint_violation' });
    expect(guidance.content).toContain('超调量接近或超过约束上限');
    expect(guidance.highlightParams).toEqual(['kp', 'kd']);
  });
});
