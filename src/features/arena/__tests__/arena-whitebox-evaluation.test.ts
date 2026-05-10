import { describe, expect, it } from 'vitest';

import { evaluateWhiteBoxSubmission } from '../evaluation/whitebox-evaluator';
import { normalizeMetricValue, scoreMetricSatisfaction } from '../evaluation/scoring';
import type { ControllerArtifact } from '../types';

const validPidArtifact: ControllerArtifact = {
  id: 'artifact-pid-good',
  taskId: 'task-second-order-lead-pid',
  method: 'pid',
  params: { kp: 2.4, ki: 0.8, kd: 0.35 },
  createdAt: '2026-05-10T10:00:00.000Z',
};

describe('arena white-box evaluation', () => {
  it('evaluates a valid PID artifact with metrics, satisfaction, and explanation', () => {
    const result = evaluateWhiteBoxSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: validPidArtifact,
    });

    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.metrics.settlingTime).toBeGreaterThan(0);
    expect(result.metrics.overshoot).toBeGreaterThanOrEqual(0);
    expect(result.satisfaction.settlingTime).toBeGreaterThanOrEqual(0);
    expect(result.explanation.join(' ')).toContain('硬约束');
  });

  it('rejects unstable or non-finite artifacts before ranking', () => {
    const result = evaluateWhiteBoxSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...validPidArtifact,
        id: 'artifact-pid-invalid',
        params: { kp: -1, ki: Number.NaN, kd: 0 },
      },
    });

    expect(result.valid).toBe(false);
    expect(result.score).toBe(0);
    expect(result.hardConstraintResults.some((item) => !item.passed)).toBe(true);
    expect(result.explanation.join(' ')).toContain('未进入正式排名');
  });

  it('normalizes metric values and uses weighted geometric scoring', () => {
    expect(normalizeMetricValue({ direction: 'minimize', idealValue: 2, unacceptableValue: 8 }, 2)).toBe(1);
    expect(normalizeMetricValue({ direction: 'minimize', idealValue: 2, unacceptableValue: 8 }, 8)).toBe(0);

    const score = scoreMetricSatisfaction(
      { settlingTime: 0.8, overshoot: 0.7, steadyStateError: 1, itae: 0.6 },
      { settlingTime: 1, overshoot: 1, steadyStateError: 1, itae: 1 },
    );

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });
});
