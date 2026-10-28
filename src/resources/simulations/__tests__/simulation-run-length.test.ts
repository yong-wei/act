import { describe, expect, it } from 'vitest';

import {
  DESTROYER_EXPERIMENT_STEPS,
  scoreDestroyerStep,
  type DestroyerSample,
} from '@/resources/simulations/simulations/destroyer-experiment';
import {
  requireSamples,
  runReachesMinimum,
  withLatestSample,
  type VesselSample,
} from '@/resources/simulations/simulations/vessel-experiment';
import { VESSEL_EXPERIMENTS } from '@/resources/simulations/simulations/vessel-experiments';

const RUN_LENGTH_MESSAGE = '请至少运行';

function destroyerSample(time: number): DestroyerSample {
  return { time, desiredHeading: 0, actualHeading: 0, yawRate: 0, rudder: 0, manualRudder: 0, speed: 10, crossTrackError: 0 };
}

function chartSamples<T>(until: number, interval: number, make: (time: number) => T): T[] {
  const samples: T[] = [];
  for (let time = 0; time <= until + 1e-9; time += interval) samples.push(make(Number(time.toFixed(3))));
  return samples;
}

describe('运行时长与仿真时间读数一致', () => {
  it('读数显示已到最短时长即算到', () => {
    expect(runReachesMinimum(19.96, 20)).toBe(true);
    expect(runReachesMinimum(20, 20)).toBe(true);
    expect(runReachesMinimum(19.94, 20)).toBe(false);
  });

  it('交卷时补上晚于曲线终点的最新采样', () => {
    const samples = chartSamples(19.5, 0.5, destroyerSample);
    expect(withLatestSample(samples, destroyerSample(19.96)).at(-1)?.time).toBe(19.96);
    expect(withLatestSample(samples, destroyerSample(19.5))).toBe(samples);
    expect(withLatestSample(samples, null)).toBe(samples);
    expect(withLatestSample([], destroyerSample(19.96))).toEqual([]);
  });

  it('驱逐舰：读数 20.0 s 暂停时不再以运行时长不足拒收', () => {
    const step = DESTROYER_EXPERIMENT_STEPS.find((item) => item.seq === 1)!;
    const samples = chartSamples(step.minRunS - 0.5, 0.5, destroyerSample);
    expect(scoreDestroyerStep(step.seq, samples, {}).message).toContain(RUN_LENGTH_MESSAGE);
    const paused = withLatestSample(samples, destroyerSample(step.minRunS - 0.04));
    expect(scoreDestroyerStep(step.seq, paused, {}).message).not.toContain(RUN_LENGTH_MESSAGE);
  });

  it('六船：整秒曲线加上暂停时刻后满足运行时长', () => {
    for (const experiment of VESSEL_EXPERIMENTS) {
      const step = experiment.steps.find((item) => item.minRunS > 1 && item.fields.some((field) => field.kind !== 'text'))!;
      const make = (time: number): VesselSample => ({ time, values: {} });
      const samples = chartSamples(step.minRunS - 1, 1, make);
      expect(requireSamples(step, samples)?.message, experiment.key).toContain(RUN_LENGTH_MESSAGE);
      expect(requireSamples(step, withLatestSample(samples, make(step.minRunS - 0.04))), experiment.key).toBeNull();
    }
  });
});
