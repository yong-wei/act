import { describe, expect, it, vi } from 'vitest';
import type { VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { validateExperiment } from '../contracts/experiment-step';
import { ICEBREAKER_COURSE_STEPS, icebreakerConfiguration, icebreakerDefaultSettings,
  icebreakerCourseInput, icebreakerHeadingReference } from '../experiments/icebreaker-course';
import { icebreakerCourseAdapter } from '../experiments/icebreaker-course-adapter';
import { createServerVesselSession, invokeServerWasm } from '@/lib/control-engine/wasm-server';

vi.mock('../physics/simulation-engine-facade', async () => {
  const runtime = await import('@/lib/control-engine/wasm-server');
  return { computeVirtualSimulationStep: (request: unknown) => JSON.parse(runtime.invokeServerWasm('compute_virtual_simulation_step', JSON.stringify(request))) };
});

const initial: VesselSessionInput = {
  controlMode: 'manual', pid: { kp: 0, ki: 0, kd: 0 }, targetHeadingDeg: 0, feedback: 'measurement',
  actuators: { shafts: [0, 1].map(() => ({ speed_reference_rad_s: 5, motor_torque_override_nm: null,
    azimuth_rad: 0, drive_cut: false, azimuth_jammed: false })), surfaces: [] },
};

function read(native: ReturnType<typeof createServerVesselSession>): VesselSessionFrame {
  return JSON.parse(native.read());
}

describe('雪龙2号专项课程合同', () => {
  it('固定20步100分、真实冰域和开水波浪工况，旧草稿补齐新增控制选项', () => {
    expect(ICEBREAKER_COURSE_STEPS).toHaveLength(20);
    expect(ICEBREAKER_COURSE_STEPS.reduce((sum, step) => sum + step.points, 0)).toBe(100);
    expect(validateExperiment(ICEBREAKER_COURSE_STEPS)).toEqual([]);
    expect(icebreakerConfiguration(7)).toMatchObject({ environment: 'V1', noiseLevel: 'N1' });
    expect(icebreakerConfiguration(16)).toMatchObject({ environmentSwitches: { wave_enabled: false, current_enabled: true, wind_force_enabled: true } });
    expect(icebreakerConfiguration(19, { ...icebreakerDefaultSettings(19), validationSeed: 29 })).toMatchObject({
      seed: 29, ice: { thicknessM: .75, flexuralStrengthPa: 650000 },
    });
    expect(icebreakerCourseAdapter.restoreSettings({ thicknessM: .9 }, 12)).toMatchObject({ thicknessM: .9, integralTimeS: 100, stopOnJam: true });
    expect(ICEBREAKER_COURSE_STEPS[7].runDurationS).toBe(1200);
  });

  it('伺服激励保持正负号，冰区第11步使用航向参考，斜坡终值一致', () => {
    const settings = icebreakerDefaultSettings(2);
    const frame = { timeS: 30 } as VesselSessionFrame;
    const input = icebreakerCourseInput(2, settings, initial, frame, [], '');
    expect(input.actuators.shafts[0].azimuth_rad).toBeCloseTo(-3 * Math.PI / 180);
    expect(initial.actuators.shafts[0].azimuth_rad).toBe(0);
    expect(ICEBREAKER_COURSE_STEPS[10].closedLoop).toBe(true);
    expect(icebreakerHeadingReference(11, 30, settings)).toBe(5);
    expect(icebreakerHeadingReference(11, 310, settings)).toBe(-5);
    expect(icebreakerHeadingReference(15, 50, { ...settings, rampS: 60 })).toBe(7.5);
    expect(icebreakerHeadingReference(15, 80, { ...settings, rampS: 60 })).toBe(15);
    expect(icebreakerHeadingReference(17, 30, { ...settings, headingBiasDeg: 6 })).toBe(6);
    expect(icebreakerCourseAdapter.restoreSettings({}, 17).headingBiasDeg).toBe(0);
    expect(() => icebreakerCourseInput(11, settings, initial, frame, [], '')).toThrow('本人冻结');
  });

  it('实际航程、前进停滞与未完成能耗资格由原生评价复算', () => {
    const points = Array.from({ length: 241 }, (_, index) => ({ timeS: index * .05,
      northM: 100 + index * .002, eastM: 0, positiveMotorWorkJ: index * 1000, forwardRequested: true }));
    const evaluate = (values: typeof points) => JSON.parse(invokeServerWasm('compute_virtual_simulation_step', JSON.stringify({
      modelId: 'student_model_analysis', operation: 'ice_metrics', points: values,
    })));
    expect(evaluate(points)).toMatchObject({ iceTaskCompleted: 0, eligibleForEnergyComparison: 0, stalled: 1 });
    const completed = points.map((point, index) => ({ ...point, northM: 799 + index * .05 }));
    expect(evaluate(completed)).toMatchObject({ iceTaskCompleted: 1, eligibleForEnergyComparison: 1, stalled: 0 });
    expect(evaluate(completed.map((point) => ({ ...point, eastM: 30 })))).toMatchObject({ eligibleForEnergyComparison: 0 });
    expect(() => evaluate([points[0], points[2]])).toThrow();
    const lastBeforeArrival = [{ timeS: 0, northM: 799.95, eastM: 0, positiveMotorWorkJ: 0, forwardRequested: true }];
    const terminalPoint = { timeS: .025, northM: 800.01, eastM: 0, positiveMotorWorkJ: 300, forwardRequested: true };
    const terminalMetrics = (terminal = terminalPoint) => JSON.parse(invokeServerWasm('compute_virtual_simulation_step', JSON.stringify({
      modelId: 'student_model_analysis', operation: 'ice_metrics', points: lastBeforeArrival, terminalPoint: terminal,
    })));
    expect(terminalMetrics()).toMatchObject({ iceTaskCompleted: 1, eligibleForEnergyComparison: 1, finalNorthM: 800.01 });
    expect(terminalMetrics().actualDistanceM).toBeCloseTo(.06);
    expect(terminalMetrics().energyPerDistanceJPerM).toBeCloseTo(5000);
    expect(() => terminalMetrics({ ...terminalPoint, timeS: .1 })).toThrow('紧接');
  });

  it('独立闭环与物理控制使用同一份已声明冰厚增益插值', () => {
    const evaluate = (controller: VesselSessionInput) => JSON.parse(invokeServerWasm('compute_virtual_simulation_step', JSON.stringify({
      modelId: 'student_model_analysis', operation: 'heading_closed_loop',
      structure: { kind: 'nomoto1', k: .2, t_s: 10 }, reference: Array(201).fill(10),
      inputOrigin: 0, outputOrigin: 0, initialHeadingDeg: 0, initialYawRateDegS: 0, dtS: .05, controller,
    })));
    const scheduled: VesselSessionInput = { ...initial, controlMode: 'pd', pid: { kp: 1, ki: 0, kd: 3 },
      iceHeadingSchedule: { declaredThicknessM: .6, iceGains: { kp: 2, ki: 0, kd: 6 } } };
    const fixed = { ...scheduled, pid: scheduled.iceHeadingSchedule!.iceGains };
    delete fixed.iceHeadingSchedule;
    expect(evaluate(scheduled)).toEqual(evaluate(fixed));
  });

  it('冰区航速PI的暂停恢复与完整未来一致', () => {
    const configuration = icebreakerConfiguration(11);
    const first = createServerVesselSession(configuration);
    const second = createServerVesselSession(configuration);
    try {
      const frame = read(first);
      const rpm = frame.input.actuators.shafts[0].speed_reference_rad_s * 30 / Math.PI;
      const input = { ...frame.input, controlMode: 'pd' as const, pid: { kp: 2, ki: 0, kd: 40 },
        longitudinal: { localModel: { structure: { kind: 'fopdt' as const, k: 1 / rpm, t_s: 60, delay_s: 0 },
          speedMps: 1, shaftReferenceRpm: rpm }, referenceMps: 1, kpMultiplier: 1, tiMultiplier: 1,
          antiWindup: true, smithEnabled: false, filterTauS: .2, additionalCommandDelayS: 0 as const } };
      first.advance(.2, JSON.stringify(input));
      const checkpoint = first.snapshot();
      second.restore(checkpoint);
      expect(second.snapshot()).toBe(checkpoint);
      expect(second.advance(.15, JSON.stringify(input))).toBe(first.advance(.15, JSON.stringify(input)));
      expect(second.snapshot()).toBe(first.snapshot());
    } finally { first.free(); second.free(); }
  });

  it('真实双吊舱产生正确转艏方向，接触场景只显示原生位姿且不进入20Hz主记录', () => {
    const native = createServerVesselSession(icebreakerConfiguration(3));
    try {
      const opening = read(native);
      expect(opening.waveModel?.waterDepthM).toBe(200);
      const input = icebreakerCourseInput(3, icebreakerDefaultSettings(3), opening.input,
        { ...opening, timeS: 20 }, [], '');
      let frame = opening;
      for (let second = 0; second < 30; second++) frame = JSON.parse(native.advance(1, JSON.stringify(input)));
      expect(frame.attitudeDeg.heading).toBeGreaterThan(0);
      expect(frame.truth.actuator_states.azimuth_angles_rad[0]).toBeLessThan(0);
    } finally { native.free(); }
    const ice = createServerVesselSession({ ...icebreakerConfiguration(8), initialPositionNed: [145, 0, 0] });
    try {
      let frame = read(ice);
      for (let second = 0; second < 20; second++) frame = JSON.parse(ice.advance(1, ''));
      expect(frame.iceContact?.brokenAreaM2).toBeGreaterThan(0);
      expect(frame.iceScene?.frontsNorthM).toHaveLength(64);
      expect(frame.iceScene?.floes.length).toBeGreaterThan(0);
      expect(frame.iceScene!.floes.length).toBeLessThanOrEqual(128);
      expect(JSON.stringify(frame.controlSamples)).not.toContain('frontsNorthM');
      expect(JSON.stringify(frame.controlSamples)).not.toContain('iceScene');
    } finally { ice.free(); }
  }, 120000);
});
