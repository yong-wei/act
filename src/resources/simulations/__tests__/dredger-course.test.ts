import {describe, expect, it, vi} from 'vitest';
import {createServerVesselSession} from '@/lib/control-engine/wasm-server';
import type {VesselSessionFrame} from '@/lib/control-engine/vessel-session';
import {collectVesselTracePoint, type VesselRunEvidence} from '@/features/simulations/run-evidence';
import {validateExperiment} from '../contracts/experiment-step';
import {DREDGER_COURSE_STEPS, dredgerConfiguration, dredgerCourseControl, dredgerCourseInput,
  dredgerDefaultSettings, validateDredgerSettings} from '../experiments/dredger-course';
import {dredgerCourseAdapter} from '../experiments/dredger-course-adapter';
import {measuredWindow, type FrozenVesselStudentModel} from '../experiments/student-analysis';
import {validateDredgerEvidence} from '../experiments/dredger-evidence';
import type {VesselCourseEvidence} from '../experiments/course-adapter';

vi.mock('../physics/simulation-engine-facade', async () => {
  const runtime = await import('@/lib/control-engine/wasm-server');
  return {computeVirtualSimulationStep: (request: unknown) => JSON.parse(runtime.invokeServerWasm('compute_virtual_simulation_step', JSON.stringify(request)))};
});

describe('天鲸号机构与二十步课程合同', () => {
  it('保持二十步一百分，限定已有水动力与教学土层，旧草稿补齐选项', () => {
    expect(DREDGER_COURSE_STEPS).toHaveLength(20);
    expect(DREDGER_COURSE_STEPS.reduce((sum, step) => sum + step.points, 0)).toBe(100);
    expect(validateExperiment(DREDGER_COURSE_STEPS)).toEqual([]);
    expect(dredgerConfiguration(11)).toMatchObject({dredger: {soil: 'clay'}});
    expect(dredgerConfiguration(18)).toMatchObject({noiseLevel: 'N1', dredger: {cableBreakTimeS: 180, brokenCableIndex: 1}});
    expect(dredgerConfiguration(19, {...dredgerDefaultSettings(19), validationSeed: 29}))
      .toMatchObject({seed: 29, dredger: {soil: 'clay'}});
    expect(dredgerCourseAdapter.restoreSettings({halfAngleDeg: 5}, 9)).toMatchObject({halfAngleDeg: 5, kpMultiplier: 0.2, tiMultiplier: 3});
    expect(validateDredgerSettings({...dredgerDefaultSettings(9), safetyFraction: 1.1})).toBeTruthy();
    expect(validateDredgerSettings({...dredgerDefaultSettings(9), manualWinchMps: NaN})).toBeTruthy();
    expect(() => dredgerConfiguration(0)).toThrow();
  });

  it('给定倒桩、两侧绞车及模式切换均通过声明的原生命令', () => {
    const settings = dredgerDefaultSettings(3);
    expect(dredgerCourseControl(3, settings, 60, null).requestedMode).toBe('exit');
    expect(dredgerCourseControl(3, settings, 90, null)).toMatchObject({requestedMode: 'transit', commands: {carriageSpeedMps: 0.025}});
    expect(dredgerCourseControl(3, settings, 140, null).requestedMode).toBe('prepare');
    expect(dredgerCourseControl(4, settings, 40, null).commands.winchSpeedMps).toEqual([-0.015, 0]);
    expect(dredgerCourseControl(4, {...settings, manualCable: 'starboard'}, 40, null).commands.winchSpeedMps).toEqual([0, -0.015]);
    expect(dredgerCourseControl(5, settings, 50, null).commands.winchSpeedMps).toEqual([0.015, -0.015]);
    expect(dredgerCourseControl(6, settings, 50, null).commands.winchSpeedMps).toEqual([-0.015, 0.015]);
    expect(() => dredgerCourseControl(9, settings, 0, null)).toThrow('本人');
    const model = {kind: 'nomoto1', k: 1.8, t_s: 3.3} as const;
    expect(dredgerCourseControl(14, settings, 200, model).requestedMode).toBe('spud_hold');
    expect(dredgerCourseControl(14, settings, 250, model).requestedMode).toBe('cut_swing');
  });

  it('20Hz专用量测、机构状态与检查点恢复未来保持一致，辨识拒绝跨模式窗口', () => {
    const configuration = dredgerConfiguration(5);
    const native = createServerVesselSession(configuration);
    const restored = createServerVesselSession(configuration);
    try {
      let frame = JSON.parse(native.read()) as VesselSessionFrame;
      const input = dredgerCourseInput(5, dredgerDefaultSettings(5), frame.input, frame, [], '');
      expect(input.feedback).toBe('measurement');
      expect((JSON.parse(native.advance(0, JSON.stringify(input))) as VesselSessionFrame).input.dredger)
        .toEqual(JSON.parse(JSON.stringify(input.dredger)));
      frame = JSON.parse(native.advance(1, JSON.stringify(input)));
      expect(frame.dredger?.mode).toBe('spud_hold');
      const points = frame.controlSamples.map((sample) => collectVesselTracePoint(sample, {}));
      expect(points).toHaveLength(20);
      expect(points.at(-1)?.measurements).toHaveProperty('DredgerSwaySpeed');
      expect(points.at(-1)?.dredger).not.toHaveProperty('samples');
      const run = {lastTimeS: 1, trace: points, nativeSensorSamples: []} as unknown as VesselRunEvidence;
      expect(measuredWindow(run, 'winch-reference-to-sway', 0, 1).output.length).toBeGreaterThan(10);
      points.at(-1)!.dredger!.mode = 'recover';
      expect(() => measuredWindow(run, 'winch-reference-to-sway', 0, 1)).toThrow('跨模式');
      restored.restore(native.snapshot());
      expect(JSON.parse(restored.advance(0.5, JSON.stringify(input))))
        .toEqual(JSON.parse(native.advance(0.5, JSON.stringify(input))));
    } finally {native.free(); restored.free();}
  });

  it('C预测只引用本人固定局部模型及运行前方案，保持原记录不变', () => {
    const settings = dredgerDefaultSettings(10);
    const native = createServerVesselSession(dredgerConfiguration(10));
    try {
      const frame = JSON.parse(native.read()) as VesselSessionFrame;
      const model = {id: 'own-model', scopeKey: 'own-round', channel: 'winch-reference-to-sway',
        payload: {structure: {kind: 'nomoto1', k: 1.88, t_s: 3.3}, operatingPoint: {inputOrigin: 0, outputOrigin: 0}}} as FrozenVesselStudentModel;
      const input = dredgerCourseInput(10, settings, frame.input, frame, [model], model.id);
      const before = native.snapshot();
      const forecast = dredgerCourseAdapter.forecast!('own-round', 'planned-run', 10, dredgerConfiguration(10), 60, input, frame, model, settings, [model]);
      expect(forecast.predicted).toHaveLength(1201);
      expect(forecast.actual).toEqual([]);
      expect(forecast.purpose).toBe('forecast');
      expect(forecast.controllerInput).toEqual(input);
      expect(native.snapshot()).toBe(before);
      expect(() => dredgerCourseAdapter.forecast!('foreign-round', 'planned-run', 10, dredgerConfiguration(10), 60, input, frame, model, settings, [model])).toThrow('本人');
    } finally {native.free();}
  });

  it('波浪开关对照与冻结方案按内容核对，恢复后的对象字段顺序保持兼容', () => {
    const model = {id: 'own-model', scopeKey: 'own-round', channel: 'winch-reference-to-sway', createdAtMs: 0,
      payload: {structure: {kind: 'nomoto1', k: 1.88, t_s: 3.3}, operatingPoint: {inputOrigin: 0, outputOrigin: 0}}} as FrozenVesselStudentModel;
    const runs = [false, true].map((wavesEnabled, index) => {
      const settings = {...dredgerDefaultSettings(16), wavesEnabled};
      const configuration = dredgerConfiguration(16, settings);
      const native = createServerVesselSession(configuration);
      try {
        const frame = JSON.parse(native.read()) as VesselSessionFrame;
        return {id: `wave-${index}`, stepSequence: 16, stoppedAtMs: 2, createdAtMs: 1, lastTimeS: 600,
          stopReason: 'duration', configuration, designStudentModelId: model.id,
          initialInput: dredgerCourseInput(16, settings, frame.input, frame, [model], model.id)};
      } finally {native.free();}
    });
    const comparisons = runs.map((run) => ({runId: run.id, modelId: model.id, purpose: 'forecast', createdAtMs: 0,
      actualSampleCount: 0, controllerInput: Object.fromEntries(Object.entries(run.initialInput).reverse())}));
    const evidence = {runs, models: [model], comparisons,
      answers: {prediction: '比较同一方案。', observation: '按实际刀深及张力观察。', interpretation: '说明波浪与模式的影响。'}} as unknown as VesselCourseEvidence;
    expect(validateDredgerEvidence(DREDGER_COURSE_STEPS[15], evidence)).toBeNull();
    runs[1].initialInput.dredger!.kpMultiplier = 0.4;
    expect(validateDredgerEvidence(DREDGER_COURSE_STEPS[15], evidence)).toContain('同一方案');
    const faultRun = {...runs[0], stepSequence: 18, configuration: dredgerConfiguration(18), dredgerModeEvents: [
      {timeS: 180, kind: 'cable_break', component: 1}, {timeS: 180.05, kind: 'mode_PauseCut', component: 0}]};
    const faultEvidence = {...evidence, runs: [faultRun]} as unknown as VesselCourseEvidence;
    expect(validateDredgerEvidence(DREDGER_COURSE_STEPS[17], faultEvidence)).toContain('180秒前进入横移切削');
    faultRun.dredgerModeEvents.unshift({timeS: 151, kind: 'mode_CutSwing', component: 0});
    expect(validateDredgerEvidence(DREDGER_COURSE_STEPS[17], faultEvidence)).toBeNull();
  });
});
