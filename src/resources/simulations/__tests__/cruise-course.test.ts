import { describe, expect, it } from 'vitest';
import type { VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { validateExperiment } from '../contracts/experiment-step';
import {
  CRUISE_COURSE_STEPS, cruiseCourseConfiguration, cruiseCourseDefaultSettings, cruiseCourseInput,
  cruiseStudentRollModel,
} from '../experiments/cruise-course';
import type { FrozenVesselStudentModel } from '../experiments/student-analysis';
import { vesselCourseStepReviewLimits, vesselStepReviewLimits } from '@/features/ilab/course-report-review-contract';
import { validateCruiseCourseEvidence } from '../experiments/cruise-evidence';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { CruiseCourseSettings } from '../experiments/cruise-course';

const initial = {
  controlMode: 'manual', pid: { kp: 0, ki: 0, kd: 0 }, targetHeadingDeg: 0, feedback: 'measurement',
  actuators: {
    shafts: [0, 1].map(() => ({ speed_reference_rad_s: 8, motor_torque_override_nm: null,
      azimuth_rad: 0, drive_cut: false, azimuth_jammed: false })),
    surfaces: [0, 1].map(() => ({ angle_rad: 0, enabled: false, jammed: false })),
  },
} as VesselSessionInput;
const frame = (timeS: number) => ({ timeS }) as VesselSessionFrame;
const model = {
  id: 'own-roll', channel: 'fin-to-roll',
  payload: {
    structure: { kind: 'roll_oscillator', natural_freq_rad_s: 0.32, damping: 0.04, control_gain: 1e6 },
    operatingPoint: { rollInertiaKgM2: 1e10 },
  },
} as FrozenVesselStudentModel;

describe('邮轮原页面课程合同', () => {
  it('导入即核验二十步、100分、独立窗口和真实故障工况', () => {
    expect(validateExperiment(CRUISE_COURSE_STEPS)).toEqual([]);
    expect(CRUISE_COURSE_STEPS).toHaveLength(20);
    expect(CRUISE_COURSE_STEPS.reduce((sum, step) => sum + step.points, 0)).toBe(100);
    expect(cruiseCourseConfiguration(2)).toMatchObject({ initialRollDeg: 2, environment: 'P0' });
    expect(cruiseCourseConfiguration(4).initialRollDeg).toBe(1);
    expect(cruiseCourseConfiguration(5).cruise).toMatchObject({ statisticsStartS: 120, statisticsEndS: 600 });
    expect(cruiseCourseConfiguration(16).cruise).toMatchObject({ statisticsStartS: 0, statisticsEndS: 400 });
    expect(cruiseCourseConfiguration(19)).toMatchObject({ seed: 29, noiseLevel: 'N1',
      cruise: { finFailureTimeS: 180, failedFinIndex: 0 } });
  });

  it('教师量规采用邮轮与集装箱各自的设计步骤起点', () => {
    expect(vesselCourseStepReviewLimits('cruise', 8)).toEqual(vesselStepReviewLimits(8, true));
    expect(vesselCourseStepReviewLimits('cruise', 7)).toEqual(vesselStepReviewLimits(7, false));
    expect(vesselCourseStepReviewLimits('container', 7)).toEqual(vesselStepReviewLimits(7, true));
  });

  it('自由衰减关闭鳍反馈，脉冲只改变有限伺服的目标角度', () => {
    const saved = structuredClone(initial);
    expect(cruiseCourseInput(2, cruiseCourseDefaultSettings(2), initial, frame(20)).cruiseFins).toBeUndefined();
    const pulse = cruiseCourseInput(3, cruiseCourseDefaultSettings(3), initial, frame(20));
    expect(pulse.actuators.surfaces.map((surface) => surface.angle_rad)).toEqual([2 * Math.PI / 180, -2 * Math.PI / 180]);
    expect(cruiseCourseInput(3, cruiseCourseDefaultSettings(3), initial, frame(60)).actuators.surfaces[0].angle_rad)
      .toBeCloseTo(-2 * Math.PI / 180);
    expect(cruiseCourseInput(4, cruiseCourseDefaultSettings(4), initial, frame(20)).actuators.surfaces[0].angle_rad)
      .toBeCloseTo(Math.PI / 180);
    expect(initial).toEqual(saved);
  });

  it('规则波绑定本人固有周期，三个周期比与三个航速独立运行', () => {
    const settings = { ...cruiseCourseDefaultSettings(6), identifiedPeriodS: 2 * Math.PI / 0.32 };
    for (const ratio of [0.7, 1, 1.3] as const) {
      const selected = { ...settings, resonanceRatio: ratio };
      expect(cruiseCourseConfiguration(6, selected).environmentOverrides?.wave?.tp_s).toBeCloseTo(settings.identifiedPeriodS * ratio);
      expect(cruiseCourseConfiguration(6, selected).regularWaveHeightM).toBe(0.5);
      expect(() => cruiseCourseInput(6, selected, initial, frame(0), model)).not.toThrow();
    }
    expect(() => cruiseCourseInput(6, cruiseCourseDefaultSettings(6), initial, frame(0), model)).toThrow('固有周期');
    for (const speedMps of [0, 2, 8] as const) {
      expect(cruiseCourseConfiguration(7, { ...cruiseCourseDefaultSettings(7), speedMps }).initialWaterSpeedMps).toBe(speedMps);
    }
  });

  it('本人模型决定鳍反馈，首轮目标阻尼固定为.5，停止使用缺少效能的自由衰减模型', () => {
    expect(cruiseStudentRollModel(model)).toEqual({ inertiaKgM2: 1e10, dampingNmSRad: 256e6, stiffnessNmRad: 1.024e9 });
    const settings = { ...cruiseCourseDefaultSettings(8), dampingRatio: 0.7 as const };
    expect(cruiseCourseInput(8, settings, initial, frame(0), model).cruiseFins?.dampingRatio).toBe(0.5);
    const decay = structuredClone(model);
    if (decay.payload.structure.kind === 'roll_oscillator') decay.payload.structure.control_gain = 0;
    expect(() => cruiseStudentRollModel(decay)).toThrow('差动鳍激励');
  });

  it('航向斜坡与故障策略改变命令，保留真实航速和执行器连续状态', () => {
    expect(cruiseCourseInput(11, cruiseCourseDefaultSettings(11), initial, frame(25), model).targetHeadingDeg).toBe(10);
    expect(cruiseCourseInput(12, cruiseCourseDefaultSettings(12), initial, frame(40), model).targetHeadingDeg).toBe(10);
    const settings = { ...cruiseCourseDefaultSettings(19), faultStrategy: 'slow' as const };
    expect(cruiseCourseInput(19, settings, initial, frame(179.95), model).actuators.shafts[0].speed_reference_rad_s).toBe(8);
    expect(cruiseCourseInput(19, settings, initial, frame(180), model).actuators.shafts[0].speed_reference_rad_s).toBe(4);
    expect(cruiseCourseInput(19, { ...settings, faultStrategy: 'long-turn' }, initial, frame(220), model).targetHeadingDeg).toBe(10);
  });

  it('航速与共振三次对照固定其余方案和本人模型', () => {
    function run(sequence: number, patch: Partial<CruiseCourseSettings>): VesselRunSummary {
      const settings = { ...cruiseCourseDefaultSettings(sequence), identifiedPeriodS: 2 * Math.PI / .32, ...patch };
      return { id: crypto.randomUUID(), scopeKey: 'fixture', courseVersion: CRUISE_COURSE_STEPS[0].experimentVersion,
        stepSequence: sequence, createdAtMs: 2, stoppedAtMs: 3, lastTimeS: 600, durationS: 600, sampleCount: 12000,
        configuration: cruiseCourseConfiguration(sequence, settings),
        initialInput: cruiseCourseInput(sequence, settings, initial, frame(0), model),
        designStudentModelId: model.id, courseSettings: { ...settings }, stopReason: 'duration' };
    }
    const answers = { prediction: '预期共振峰值随阻尼增大而降低', observation: 'fixture', interpretation: 'fixture' };
    const models = [{ ...model, createdAtMs: 1 }];
    const speeds = ([4, 8, 10] as const).map((speedMps) => run(13, { speedMps }));
    expect(validateCruiseCourseEvidence(CRUISE_COURSE_STEPS[12], { runs: speeds, models, comparisons: [], answers })).toBeNull();
    expect(validateCruiseCourseEvidence(CRUISE_COURSE_STEPS[12], { runs: speeds, models, comparisons: [], answers: { observation: 'fixture', interpretation: 'fixture' } })).toContain('预测');
    const mixedSpeeds = [...speeds.slice(0, 2), run(13, { speedMps: 10, dampingRatio: .7 })];
    expect(validateCruiseCourseEvidence(CRUISE_COURSE_STEPS[12], { runs: mixedSpeeds, models, comparisons: [], answers }))
      .toContain('固定其余条件');
    const periods = ([.7, 1, 1.3] as const).map((resonanceRatio) => run(6, { resonanceRatio }));
    expect(validateCruiseCourseEvidence(CRUISE_COURSE_STEPS[5], { runs: periods, models, comparisons: [], answers })).toBeNull();
    periods[2].designStudentModelId = 'another-model';
    expect(validateCruiseCourseEvidence(CRUISE_COURSE_STEPS[5], { runs: periods, models, comparisons: [], answers })).toContain('三次规则波');
  });
});
