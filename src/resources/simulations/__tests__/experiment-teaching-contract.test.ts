import { describe, expect, it } from 'vitest';

import {
  EXPERIMENT_TOTAL_SCORE,
  type ExperimentStep,
  validateExperiment,
  validateScoring,
  validateStep,
} from '../contracts/experiment-step';

function validStep(overrides: Partial<ExperimentStep> = {}): ExperimentStep {
  return {
    experimentId: 'exp-01-055-heading',
    experimentVersion: 'v1',
    stepId: 'step-07',
    title: 'Nomoto 辨识',
    learningObjective: '由小激励响应辨识局部 K/T',
    cognitiveLevel: 'analyze',
    stepKind: 'run',
    trainValidationRole: 'training',
    prerequisites: [],
    initialCondition: { headingDeg: 0 },
    factorMask: ['P0', 'N0'],
    studentControls: [
      { key: 'rudderDeg', label: '舵角', min: -10, max: 10, unit: 'deg' },
    ],
    eventTimeline: ['t=0 舵阶跃'],
    runDurationS: 120,
    termination: '仿真时间到 120 s',
    measurementSignals: ['headingDeg', 'yawRateDegS'],
    observationWindowS: [0, 120],
    requiredArtifacts: ['辨识拟合曲线'],
    rubric: { kind: 'standard' },
    hints: ['观察首波峰值'],
    retryPolicy: 'free',
    ...overrides,
  };
}

describe('步骤合同校验', () => {
  it('合法步骤通过', () => {
    expect(validateStep(validStep())).toEqual([]);
  });

  it('未知实验标识拒绝', () => {
    const errors = validateStep(validStep({ experimentId: 'exp-99' }));
    expect(errors.some((e) => e.field === 'experimentId')).toBe(true);
  });

  it('非法认知层级拒绝', () => {
    const bad = validStep({ cognitiveLevel: 'memorize' as ExperimentStep['cognitiveLevel'] });
    expect(validateStep(bad).some((e) => e.field === 'cognitiveLevel')).toBe(true);
  });

  it('可控变量缺范围拒绝', () => {
    const bad = validStep({
      studentControls: [{ key: 'k', label: 'K', min: 5, max: 5, unit: '1/s' }],
    });
    expect(validateStep(bad).some((e) => e.field === 'studentControls')).toBe(true);
  });

  it('运行步骤缺测量信号拒绝；分析步骤不要求', () => {
    const runBad = validStep({ measurementSignals: [] });
    expect(validateStep(runBad).some((e) => e.field === 'measurementSignals')).toBe(true);
    const analysis = validStep({ stepKind: 'analysis', measurementSignals: [], eventTimeline: [] });
    expect(validateStep(analysis)).toEqual([]);
  });

  it('跨实验前置拒绝（七船不共享通关资格）', () => {
    const bad = validStep({ prerequisites: ['exp-04-cruise-comfort#step-03'] });
    expect(validateStep(bad).some((e) => e.field === 'prerequisites')).toBe(true);
    const ok = validStep({ prerequisites: ['step-06'] });
    expect(validateStep(ok)).toEqual([]);
  });

  it('设计型步骤缺性能判据拒绝', () => {
    const bad = validStep({ rubric: { kind: 'design' } });
    expect(validateStep(bad).some((e) => e.field === 'rubric')).toBe(true);
  });

  it('整组校验检出步数偏差', () => {
    const errors = validateExperiment([validStep()]);
    expect(errors.some((e) => e.field === 'steps')).toBe(true);
  });
});

describe('冻结评分合同', () => {
  it('分值分布、占比与第 20 步四分自洽', () => {
    expect(validateScoring()).toEqual([]);
    expect(EXPERIMENT_TOTAL_SCORE).toBe(100);
  });

  it('保持总和不变的漂移逐项检出（PR review 回归）', () => {
    // 交换第 1/5 步分值（3↔4，总和不变）。
    const dist = [3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 10];
    dist[0] = 4; dist[4] = 3;
    const problems = validateScoring(dist);
    expect(problems.some((p) => p.includes('第 1 步分值 4'))).toBe(true);
    expect(problems.some((p) => p.includes('第 5 步分值 3'))).toBe(true);
    // 占比 40/30 互换（合计仍 1）。
    const ratioDrift = validateScoring(undefined, { prediction: 0.4, operation: 0.3, interpretation: 0.3 });
    expect(ratioDrift.some((p) => p.includes('prediction=0.4'))).toBe(true);
    // 末步前两项 4/2（合计仍 10）。
    const finalDrift = validateScoring(undefined, undefined, { modelAssumptions: 4, ownEvidence: 2, comparison: 2, boundary: 2 });
    expect(finalDrift.some((p) => p.includes('modelAssumptions=4'))).toBe(true);
  });

  it('缺字段与非法枚举拒绝（PR review 回归）', () => {
    const missing = validStep({ initialCondition: undefined as unknown as Record<string, number> });
    expect(validateStep(missing).some((e) => e.field === 'initialCondition')).toBe(true);
    const badKind = validStep({ stepKind: 'animation' as ExperimentStep['stepKind'], measurementSignals: [] });
    expect(validateStep(badKind).some((e) => e.field === 'stepKind')).toBe(true);
    const badRole = validStep({ trainValidationRole: 'exam' as ExperimentStep['trainValidationRole'] });
    expect(validateStep(badRole).some((e) => e.field === 'trainValidationRole')).toBe(true);
    const badRetry = validStep({ retryPolicy: 'unlimited' as ExperimentStep['retryPolicy'] });
    expect(validateStep(badRetry).some((e) => e.field === 'retryPolicy')).toBe(true);
    const noSignals = validStep({ measurementSignals: undefined as unknown as string[] });
    expect(validateStep(noSignals).some((e) => e.field === 'measurementSignals')).toBe(true);
  });
});
