import { describe, expect, it } from 'vitest';
import { buildVesselCourseReportHtml, type VesselReportEvidence } from '@/features/simulations/course-report';

const payload: VesselReportEvidence['models'][number]['payload'] = {
  structure: { kind: 'fopdt', k: .08, t_s: 210, delay_s: 1 },
  ioContract: { inputChannel: 'ShaftReference0', outputChannel: 'SpeedLog', inputUnit: 'rpm', outputUnit: 'm/s' },
  operatingPoint: { speedMps: 4 }, trainingRuns: [{ runRef: 'private-run', startS: 10, endS: 20 }],
};
const comparison: VesselReportEvidence['comparisons'][number] = {
  runId: 'private-run', modelId: 'private-model-first', actuatorModelId: null,
  mode: 'independent_closed_loop', purpose: 'validation', timeS: [10, 20],
  actual: [4, 4.2], predicted: [4, 4.1], outputUnit: 'm/s',
  metrics: { rmse: .07, fit_percent: 80, peak_error: .1 },
};
const evidence: VesselReportEvidence = {
  runs: [{ id: 'private-run', stepSequence: 10, timeS: 600, status: 'completed',
    configuration: { initialWaterSpeedMps: 4, environment: 'P0', noiseLevel: 'N0', seed: 20261106 },
    input: { controlMode: 'manual', pid: { kp: 0, ki: 0, kd: 0 }, targetHeadingDeg: 0,
      feedback: 'measurement', actuators: { shafts: [], surfaces: [] } } }],
  models: [
    { id: 'private-model-first', label: '基准模型', payload, frozenAtMs: 1 },
    { id: 'private-model-second', label: '修订模型', payload: { ...payload,
      structure: { kind: 'fopdt', k: .1, t_s: 200, delay_s: 1 } }, frozenAtMs: 2 },
  ],
  comparisons: [comparison, { ...comparison, modelId: 'private-model-second' }],
};

describe('本人实验报告的对照来源', () => {
  it('新版报告保留可从外部报告访问的固定版本指导书链接', () => {
    const run = structuredClone(evidence.runs[0]);
    run.configuration.vessel = 'dredger-tianjing';
    const html = buildVesselCourseReportHtml('天鲸号', {}, {...evidence, runs: [run]});
    expect(html).toContain('课程版本 seven-vessel-2026.11.14，指导书版本 2026.11.16');
    expect(html).toContain('https://act.adapt-learn.online/supporting/2026.11.16/guide-07-dredger.pdf');
    expect(buildVesselCourseReportHtml('旧报告', {})).not.toContain('查看本版实验指导书');
  });

  it('同一次运行的不同模型对照显示相应模型序号与真实窗口', () => {
    const html = buildVesselCourseReportHtml('实验', { problem: '<script>夹具</script>' }, evidence);
    expect(html).toContain('计算模型 本人冻结模型1');
    expect(html).toContain('计算模型 本人冻结模型2');
    expect(html).toContain('分析窗口 10.00–20.00 s');
    expect(html).toContain('RMSE 0.070 m/s');
    expect(html).toContain('&lt;script&gt;夹具&lt;/script&gt;');
    expect(html).not.toContain('private-model');
    expect(html).not.toContain('private-run');
  });

  it('运行前预测显示误差待验证的状态', () => {
    const html = buildVesselCourseReportHtml('实验', {}, { ...evidence, comparisons: [
      { ...comparison, purpose: 'forecast', actual: [], metrics: {} },
    ] });
    expect(html).toContain('运行前预测的误差指标待独立验证后生成。');
    expect(html).not.toContain('RMSE 未获得有效值');
  });

  it('靠泊计划与120Hz液面、末60秒约束按本人的实际结束状态出具', () => {
    const run = structuredClone(evidence.runs[0]);
    run.input.berthPlan = {brakingDistanceM:1200,nodes:[{distanceM:30,speedMps:0}],
      headingNodes:[{timeS:0,headingDeg:-9},{timeS:400,headingDeg:0}]};
    run.fineStepMetrics = {sampleCadenceS:1/120,algorithm:'post_physics_step_v1',rollWarningDeg:8,
      eventWindowBeforeS:1,eventWindowAfterS:1,values:{physicsSamples:72000,maximumRollDeg:1,maximumPitchDeg:1,
        maximumYawRateDegS:1,maximumSurfaceAngleDeg:1,maximumSurfaceRateDegS:1,maximumShaftPowerW:1e6,
        maximumPositiveSystemPowerW:2e6,rollWarningDurationS:0,surfaceAngleViolationS:0,surfaceRateViolationS:0,
        shaftPowerViolationS:0,systemPowerViolationS:0,shaftSpeedViolationS:0,surfaceSaturationDurationS:0,positiveMotorWorkJ:1e9,
        lng:{physicsSamples:72000,maximumCornerHeightM:.7,cornerHeightSquaredIntegralM2S:54,
          outsideLiquidDomainDurationS:.1,liquidDepthM:22.1,finalHeadingDeg:2,finalNorthGroundSpeedMps:.18,
          finalBowClearanceM:18,final60sLateralMaximumM:15,lateralWindowDurationS:60}}};
    const html = buildVesselCourseReportHtml('实验', {}, {...evidence,runs:[run]});
    expect(html).toContain('0.0 s处-9.00°');
    expect(html).toContain('120Hz全程液面角点峰值 0.700 m，均方根 0.300 m');
    expect(html).toContain('超出液舱小幅适用域 0.1000 s');
    expect(html).toContain('末60.0 s最大横偏 15.000 m');
    expect(html).toContain('结束时船艏剩余距离 18.000 m');
  });

  it('轴速参考联合模型的B对照保留相应输入路径及无效FIT状态', () => {
    const html = buildVesselCourseReportHtml('实验', {}, { ...evidence, comparisons: [
      { ...comparison, mode: 'command_to_output', metrics: { ...comparison.metrics, fit_percent: null } },
    ] });
    expect(html).toContain('B · 指令经联合模型驱动输出');
    expect(html).toContain('FIT 不适用');
    expect(html).not.toContain('不适用%');
  });

  it('破冰船报告保留吊舱通道、冰区未完成状态及不稳定局部模型的适用条件', () => {
    const run = structuredClone(evidence.runs[0]);
    run.configuration.vessel = 'icebreaker-xuelong2';
    run.configuration.ice = { thicknessM: .6, flexuralStrengthPa: 500000, frictionCoefficient: .1, contactSegments: 64 };
    run.metrics = { headingRmseDeg: 4, rudderTotalVariationDeg: 30, actualDistanceM: 600,
      iceTaskCompleted: 0, eligibleForEnergyComparison: 0, maximumCrossTrackM: 18, stallDurationS: 12,
      energyPerDistanceJPerM: 100000 };
    const model = { ...evidence.models[0], payload: { ...payload, structure: { kind: 'nomoto1' as const, k: -.03, t_s: -90 },
      ioContract: { inputChannel: 'EquivalentAzimuth', outputChannel: 'YawRate', inputUnit: '°', outputUnit: '°/s' } } };
    const html = buildVesselCourseReportHtml('雪龙2号', {}, { runs: [run], models: [model], comparisons: [
      { ...comparison, mode: 'command_to_output', outputUnit: '°/s' },
    ] });
    expect(html).toContain('B · 指令经吊舱伺服模型驱动船体模型');
    expect(html).toContain('等效偏转总变差 30.000°');
    expect(html).toContain('该局部模型具有开环不稳定极点');
    expect(html).toContain('尚未到达北向800m');
    expect(html).toContain('本次结果不进入能耗排序');
    expect(html).not.toContain('private-run');
  });
});
