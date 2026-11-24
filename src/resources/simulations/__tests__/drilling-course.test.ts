import { describe, expect, it } from 'vitest';
import type { VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import { validateExperiment } from '../contracts/experiment-step';
import { drillingExperiment } from '../simulations/vessel-experiments';
import { drillingCourseExperiment } from '../experiments/drilling-experiment';
import { DRILLING_COURSE_STEPS, drillingCourseAdapter, drillingCourseConfiguration,
  drillingCourseDefaultSettings, drillingCourseInput } from '../experiments/drilling-course';
import { validateDrillingCourseEvidence } from '../experiments/drilling-evidence';
import { vesselCourseStepReviewLimits, vesselStepReviewLimits } from '@/features/ilab/course-report-review-contract';

const initial: VesselSessionInput = { controlMode: 'manual', pid: { kp: 0, ki: 0, kd: 0 }, targetHeadingDeg: 0,
  feedback: 'measurement', actuators: { shafts: [], surfaces: [] } };
const frame = (timeS: number) => ({ timeS }) as VesselSessionFrame;

function run(sequence: number, seed: 17 | 29 = 17): VesselRunSummary {
  const settings = { ...drillingCourseDefaultSettings(sequence), validationSeed: seed };
  return { id: crypto.randomUUID(), scopeKey: 'own-round', courseVersion: DRILLING_COURSE_STEPS[0].experimentVersion,
    stepSequence: sequence, createdAtMs: 10, stoppedAtMs: 20, lastTimeS: 600, durationS: 600, sampleCount: 12000,
    configuration: drillingCourseConfiguration(sequence, settings), initialInput: drillingCourseInput(sequence, settings, initial, frame(0)),
    courseSettings: { ...settings }, stopReason: 'duration' };
}

describe('981原页面二十步合同', () => {
  it('保留原入口，二十步和教师评分均使用同一课程定义', () => {
    expect(drillingCourseAdapter.experimentKey).toBe(drillingExperiment.key);
    expect(drillingCourseExperiment.key).toBe(drillingExperiment.key);
    expect(validateExperiment(DRILLING_COURSE_STEPS)).toEqual([]);
    expect(DRILLING_COURSE_STEPS).toHaveLength(20);
    expect(DRILLING_COURSE_STEPS.reduce((sum, step) => sum + step.points, 0)).toBe(100);
    expect(vesselCourseStepReviewLimits('drilling', 6)).toEqual(vesselStepReviewLimits(6, true));
    expect(vesselCourseStepReviewLimits('drilling', 5)).toEqual(vesselStepReviewLimits(5, false));
  });

  it('代表频率、差频切换、实际T2故障及两种未见样本均进入运行配置', () => {
    expect(drillingCourseConfiguration(10)).toMatchObject({ environment: 'V2', waveFrequencyBins: 16, secondOrderEnabled: false });
    expect(drillingCourseConfiguration(11)).toMatchObject({ environment: 'V2', secondOrderEnabled: true });
    expect(drillingCourseConfiguration(15)).toMatchObject({ environment: 'E1', driveCutFault: true, noiseLevel: 'N1' });
    expect(drillingCourseConfiguration(17).gnssOutageFault).toBe(true);
    expect(drillingCourseConfiguration(8)).not.toHaveProperty('initialWaterSpeedMps');
    for (const seed of [17, 29] as const) {
      expect(drillingCourseConfiguration(19, { ...drillingCourseDefaultSettings(19), validationSeed: seed }).seed).toBe(seed);
    }
  });

  it('参考位置和航向通过有限斜坡进入定位控制，缺少本人模型时拒绝解耦', () => {
    const saved = structuredClone(initial);
    const settings = { ...drillingCourseDefaultSettings(14), referenceRampS: 90 as const };
    expect(drillingCourseInput(14, settings, initial, frame(75)).semisubDp).toMatchObject({ targetPositionM: [10, 5], targetHeadingDeg: 7.5 });
    expect(() => drillingCourseInput(7, drillingCourseDefaultSettings(7), initial, frame(0))).toThrow('本人冻结');
    expect(initial).toEqual(saved);
  });

  it('差频对照只更改载荷开关，未见工况必须保留两个样本和冻结方案', () => {
    const answers = { prediction: '预期二阶慢漂会抬高平均定位偏移与推力均值', observation: '本人观测', interpretation: '因果与边界' };
    const first = run(10), second = run(11);
    expect(validateDrillingCourseEvidence(DRILLING_COURSE_STEPS[10], { runs: [first, second], models: [], comparisons: [], answers })).toBeNull();
    expect(validateDrillingCourseEvidence(DRILLING_COURSE_STEPS[10], { runs: [first, second], models: [], comparisons: [], answers: { observation: '本人观测', interpretation: '因果与边界' } })).toContain('预测');
    second.courseSettings!.energyWeight = 2;
    expect(validateDrillingCourseEvidence(DRILLING_COURSE_STEPS[10], { runs: [first, second], models: [], comparisons: [], answers })).toContain('第10步');
    const source = run(16), validation = run(19), unseen = run(19, 29);
    expect(validateDrillingCourseEvidence(DRILLING_COURSE_STEPS[18], { runs: [source, validation], models: [], comparisons: [], answers })).toContain('至少2');
    expect(validateDrillingCourseEvidence(DRILLING_COURSE_STEPS[18], { runs: [source, validation, unseen], models: [], comparisons: [], answers })).toBeNull();
    unseen.courseSettings!.bandwidthRadS = 0.04;
    expect(validateDrillingCourseEvidence(DRILLING_COURSE_STEPS[18], { runs: [source, validation, unseen], models: [], comparisons: [], answers })).toContain('冻结方案');
  });
});
