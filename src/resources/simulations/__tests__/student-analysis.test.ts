import { describe, expect, it, vi } from 'vitest';
import type { VesselObservedSample } from '@/lib/control-engine/vessel-session';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import { measuredWindow } from '../experiments/student-analysis';

vi.mock('../physics/simulation-engine-facade', () => ({ computeVirtualSimulationStep: vi.fn() }));

function evidence(missingYaw = false): VesselRunEvidence {
  const nativeSensorSamples: VesselObservedSample[] = [];
  for (let tick = 0; tick <= 100; tick++) {
    const time = tick*.02;
    nativeSensorSamples.push({ signal: { SurfaceEncoder: 0 }, measurement: {
      t_sample_s: time, t_arrive_s: time+.02, value: time, quality: 'Good',
    } });
  }
  for (let tick = 0; tick <= 40; tick++) {
    const time = tick*.05;
    nativeSensorSamples.push({ signal: 'YawRate', measurement: {
      t_sample_s: time, t_arrive_s: time+.05,
      value: missingYaw && tick === 20 ? null : time*2,
      quality: missingYaw && tick === 20 ? 'Missing' : 'Good',
    } });
  }
  return { id: 'owned-run', scopeKey: 'owned-scope', courseKey: 'destroyer', courseVersion: 'test',
    stepSequence: 3, prediction: '观测舵角与转艏速率', durationS: 2.1, createdAtMs: 1, lastTimeS: 2.1, stoppedAtMs: 2,
    configuration: {}, initialInput: { controlMode: 'manual', pid: { kp: 0, ki: 0, kd: 0 }, targetHeadingDeg: 0,
      feedback: 'measurement', actuators: { shafts: [], surfaces: [] } }, parameterHash: 'test',
    initialCheckpoint: '', checkpoint: '', nativeSensorSamples, changes: [], stopReason: 'duration', failure: null,
    trace: Array.from({ length: 43 }, (_,tick) => ({ timeS: tick*.05,
      command: { headingDeg: 0, shaftRpm: [], surfaceDeg: [5] }, measurements: {},
      estimate: { headingDeg: 0, yawRateDegS: 0, groundBodySpeedMps: 0, northM: 0, eastM: 0 },
      truth: { headingDeg: 999, yawRateDegS: 999, rollDeg: 999, pitchDeg: 999, rollRateDegS: 999, pitchRateDegS: 999,
        waterSpeedMps: 999, groundBodySpeedMps: 999, northM: 999, eastM: 999, shaftRpm: [], surfaceDeg: [999], azimuthDeg: [],
        windLoad: null, waveFirstLoad: null, waveSecondLoad: null, propellerWorkJ: [], motorPowerW: [], positiveMotorWorkJ: 0, fuelKg: null } })) };
}

describe('学生模型量测窗口', () => {
  it('按20Hz转艏率采样时间保持50Hz舵角量测，保留单位及原生记录', () => {
    const run = evidence();
    const window = measuredWindow(run,'rudder-to-yaw',0,2);
    expect(window.timeS).toHaveLength(41);
    expect(window.dtS).toBeCloseTo(.05,12);
    expect(window.input[1]).toBeCloseTo(.04,12);
    expect(window.output[1]).toBeCloseTo(.1,12);
    expect(window.input).not.toContain(999);
    expect(window.output).not.toContain(999);
    expect(run.nativeSensorSamples).toHaveLength(142);
  });

  it('舵机辨识使用50Hz编码器记录和已记录舵指令', () => {
    const window = measuredWindow(evidence(),'rudder-servo',0,2);
    expect(window.dtS).toBeCloseTo(.02,12);
    expect(window.input.every((value) => value === 5)).toBe(true);
    expect(window.output[1]).toBeCloseTo(.02,12);
  });

  it('缺测产生明确窗口错误', () => {
    expect(() => measuredWindow(evidence(true),'rudder-to-yaw',0,2)).toThrow('不连续采样');
  });
});
