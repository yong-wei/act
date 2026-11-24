import { describe, expect, it } from 'vitest';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { DestroyerComparisonEvidence, DestroyerModelEvidence } from '../experiments/destroyer-evidence';
import { LNG_COURSE_STEPS, lngCourseDefaultSettings, lngCourseInput } from '../experiments/lng-course';
import { validateLngCourseEvidence } from '../experiments/lng-evidence';
import type { VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';

const model: DestroyerModelEvidence = {id: 'own-model', channel: 'shaft-reference-to-speed', createdAtMs: 1,
  payload: {experimentKey: 'lng', lineageKey: 'fixture', structure: {kind: 'fopdt', k: .05, t_s: 100, delay_s: 2},
    ioContract: {inputChannel: 'ShaftReference0', outputChannel: 'SpeedLog', inputUnit: 'r/min', outputUnit: 'm/s'},
    operatingPoint: {speedMps: 4, inputOrigin: 50, loadingRatio: .85},
    identification: {algorithm: 'fixture', settings: {}, identifiedOk: true},
    trainingRuns: [{runRef: 'training', startS: 10, endS: 580}], validationRuns: [], sampleDt: .2}};
const baseInput: VesselSessionInput = {controlMode: 'pd', pid: {kp: 1.5, ki: 0, kd: 20}, targetHeadingDeg: 0,
  feedback: 'measurement', actuators: {shafts: [0, 1].map(() => ({speed_reference_rad_s: 50 * Math.PI / 30,
    motor_torque_override_nm: null, azimuth_rad: 0, drive_cut: false, azimuth_jammed: false})), surfaces: []}};
const parameters = {shaftConfigurations: [{ratedRpm: 110}, {ratedRpm: 110}]} as VesselSessionFrame['parameters'];
function run(sequence: number, id: string): VesselRunSummary {
  const step = LNG_COURSE_STEPS[sequence - 1];
  const settings = lngCourseDefaultSettings(sequence);
  const input = lngCourseInput(step, settings, baseInput, {timeS: 0, parameters},
    {structure: {kind: 'fopdt', k: .05, t_s: 100, delay_s: 2}, speedMps: 4, shaftReferenceRpm: 50});
  return {id, scopeKey: 'fixture', courseVersion: step.experimentVersion, stepSequence: sequence,
    createdAtMs: 10, stoppedAtMs: 20, durationS: step.runDurationS ?? 1200, lastTimeS: step.runDurationS ?? 1200,
    sampleCount: 12000, configuration: step.configuration, initialInput: input, finalInput: input,
    stopReason: 'duration', designStudentModelId: model.id, courseSettings: {...settings}};
}
const answers = {prediction: '预期制动与降速滞后', observation: '已记录本人证据', interpretation: '依据量测解释惯性与外推边界'};
function validate(sequence: number, runs: VesselRunSummary[], comparisons: DestroyerComparisonEvidence[] = [], models = [model], customAnswers = answers) {
  return validateLngCourseEvidence(LNG_COURSE_STEPS[sequence - 1], {runs, models, comparisons, answers: customAnswers});
}

describe('LNG专项证据验收', () => {
  it('缺少运行前预测时应明确拦截第1至19步提交', () => {
    const first = run(1, 'step1');
    expect(validate(1, [first], [], [model], {prediction: '', observation: '已记录', interpretation: '已解释'})).toContain('预测');
  });

  it('两种反车强度需要不同的真实末端命令', () => {
    const first = run(6, 'first'), second = run(6, 'second');
    expect(validate(6, [first, second])).toContain('两种反车强度');
    second.finalInput = structuredClone(second.initialInput);
    second.finalInput.actuators.shafts[0].speed_reference_rad_s = -6;
    expect(validate(6, [first, second])).toBeNull();
  });

  it('四次重复不能替代0/5秒时延与Smith开关的四种同条件组合', () => {
    const runs = [0, 1, 2, 3].map((index) => run(11, String(index)));
    expect(validate(11, runs)).toContain('四种完整运行');
    runs.forEach((item, index) => {
      item.initialInput.longitudinal!.additionalCommandDelayS = index >= 2 ? 5 : 0;
      item.initialInput.longitudinal!.smithEnabled = index % 2 === 1;
    });
    expect(validate(11, runs)).toBeNull();
    expect(validate(11, runs, [], [{...model, createdAtMs: 11}])).toContain('完整运行');
  });

  it('第7步可冻结尚未物理启动的预测，第8步需要独立验证及相应运行', () => {
    const future: DestroyerComparisonEvidence = {id: 'forecast', modelId: model.id, actuatorModelId: null,
      runId: 'future', mode: 'independent_closed_loop', purpose: 'forecast', createdAtMs: 5, actualSampleCount: 0};
    expect(validate(7, [], [future])).toBeNull();
    const physical = run(8, 'future');
    expect(validate(8, [physical], [future])).toContain('独立验证');
    const comparison = {...future, id: 'validation', purpose: 'validation' as const, createdAtMs: 30, actualSampleCount: 6000};
    expect(validate(8, [physical], [future, comparison])).toBeNull();
    physical.lastTimeS = 600; physical.durationS = 600; physical.stopReason = 'student';
    expect(validate(8, [physical], [future, comparison])).toBeNull();
    expect(validate(8, [{...physical,stoppedAtMs:null}], [future, comparison])).not.toBeNull();
    expect(validate(8, [physical], [future, comparison], [{...model, createdAtMs: 15}])).not.toBeNull();
  });

  it('转向斜坡的同条件对照保留两种设置', () => {
    const first = run(15, 'first'), second = run(15, 'second');
    expect(validate(15, [first, second])).toContain('两种转向斜坡');
    second.courseSettings!.headingRampS = 60;
    expect(validate(15, [first, second])).toBeNull();
  });

  it('风流干扰第16步缺少静水参考或同套参数重复提交被拦截，复现静水后再改一项策略通过', () => {
    const first = run(16, 'rerun'), second = run(16, 'revised');
    expect(validate(16, [first, second])).toContain('静水');
    const source8 = run(8, 'still8');
    source8.createdAtMs = 5;
    expect(validate(16, [source8, first, second])).toContain('修改');
    const bothChanged = [structuredClone(first), structuredClone(second)];
    bothChanged[0].initialInput.berthPlan!.brakingDistanceM = 1350;
    bothChanged[1].initialInput.berthPlan!.brakingDistanceM = 1400;
    expect(validate(16, [source8, ...bothChanged])).toContain('复现');
    second.initialInput = structuredClone(second.initialInput);
    second.initialInput.berthPlan!.headingNodes = [{timeS: 0, headingDeg: 0}, {timeS: 120, headingDeg: -6}];
    expect(validate(16, [source8, first, second])).toBeNull();
  });

  it('未见工况先保留同一冻结方案的两种种子，再保留有据修正', () => {
    const source = run(18, 'source'); source.createdAtMs = 5;
    const first = run(19, 'seed17'), second = run(19, 'seed29'), revised = run(19, 'revision');
    second.configuration = {...second.configuration, seed: 29, loadingRatio: .95};
    expect(validate(19, [source, first, second, revised])).toContain('修正');
    revised.initialInput = structuredClone(revised.initialInput);
    revised.initialInput.berthPlan!.brakingDistanceM = 1400;
    expect(validate(19, [source, first, second, revised])).toBeNull();
  });
});
