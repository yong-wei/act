import { describe, expect, it } from 'vitest';

import { sketchIdForLabel } from '@/features/ilab/sketch-plots';
import { DEFAULT_PID_GAINS } from '@/resources/simulations/core/constants';
import { computeVirtualSimulationServerStep } from '@/lib/control-engine/server';
import {
  buildDestroyerHifiStepRequest,
  createDestroyerHifiStateFromSimulation,
  type DestroyerHifiState,
  type DestroyerHifiStepResult,
} from '@/resources/simulations/rust/destroyer-hifi-adapter';
import {
  DESTROYER_EXPERIMENT_STEPS,
  DESTROYER_MAX_POINTS,
  assertDestroyerStepOrder,
  buildDestroyerReportHtml,
  chooseBetterDestroyerAttempt,
  destroyerSceneMotion,
  validateDestroyerReportDraft,
  scoreDestroyerStep,
  scriptedManualRudder,
  signedHeading,
  type DestroyerExperimentStep,
  type DestroyerReadings,
  type DestroyerSample,
} from '@/resources/simulations/simulations/destroyer-experiment';

function studentSamples(step: DestroyerExperimentStep): DestroyerSample[] {
  const motion = destroyerSceneMotion(step, 15);
  const until = step.minRunS + 1;
  let state: DestroyerHifiState = createDestroyerHifiStateFromSimulation({
    timeS: 0,
    headingDeg: motion.start.headingDeg,
    yawRateDegS: 0,
    positionX: motion.start.x,
    positionZ: motion.start.z,
    rudderDeg: 0,
    speedMps: 15,
    surgeMps: 15,
    swayMps: 0,
    integralDegS: 0,
    prevErrorDeg: 0,
  });
  const samples: DestroyerSample[] = [];
  let nextSample = 0;
  const dt = 0.2;
  for (let time = 0; time <= until; time += dt) {
    const scripted = scriptedManualRudder(step, time);
    const manualRudder = scripted ?? (step.seq === 2 ? 15 : step.seq === 3 ? (time < 90 ? 15 : 0) : 0);
    const result = computeVirtualSimulationServerStep<DestroyerHifiStepResult>(buildDestroyerHifiStepRequest({
      dtS: dt,
      targetHeadingDeg: motion.desiredHeading(time),
      controlMode: step.defaultMode === 'manual' ? 'manual' : step.defaultMode,
      pid: DEFAULT_PID_GAINS,
      manualRudderDeg: manualRudder,
      disturbanceEnabled: motion.disturbance,
      state,
    }));
    state = result;
    if (time + 1e-6 >= nextSample) {
      samples.push({
        time,
        desiredHeading: signedHeading(motion.desiredHeading(time)),
        actualHeading: signedHeading(result.headingDeg),
        yawRate: result.yawRateDegS,
        rudder: result.rudderDeg,
        manualRudder,
        speed: result.speedMps,
        crossTrackError: 0,
      });
      nextSample += 0.5;
    }
  }
  return samples;
}

const DESTROYER_CHOICES: Record<number, string> = {
  12: '留在零附近',
  13: '航速还在',
  15: '向左转了',
  17: '船向右转',
};

function studentReadings(step: DestroyerExperimentStep, samples: DestroyerSample[]): DestroyerReadings {
  const last = samples[samples.length - 1];
  if (step.seq >= 10 && step.seq <= 19) {
    const readings: DestroyerReadings = {};
    for (const field of step.fields) {
      if (field.kind === 'choice' && field.key === 'plotKind') readings.plotKind = '奈奎斯特图';
      else if (field.kind === 'choice') readings.choice = DESTROYER_CHOICES[step.seq] ?? '';
      else if (field.kind === 'sketch') {
        readings.sketchKind = sketchIdForLabel(readings.plotKind ?? '') ?? '';
        readings.sketchBlank = '0';
        readings.sketchEvaluation = '曲线形状和所选图种一致。';
      } else if (field.kind === 'number') {
        const value = field.key === 'yawRate' ? last.yawRate : field.key === 'rudder' ? last.rudder : field.key === 'speed' ? last.speed : last.actualHeading;
        readings[field.key] = value.toFixed(field.key === 'yawRate' ? 2 : 1);
      }
    }
    return readings;
  }
  if (step.seq === 1) return { heading: last.actualHeading.toFixed(1), speed: last.speed.toFixed(1) };
  if (step.seq === 2) return { rudder: last.manualRudder.toFixed(0), yawRate: last.yawRate.toFixed(2) };
  if (step.seq === 3) return { yawRate: last.yawRate.toFixed(2) };
  if (step.seq === 4 || step.seq === 5) {
    const target = step.seq === 4 ? 15 : 90;
    const peak = samples
      .filter((sample) => Math.abs(signedHeading(sample.desiredHeading) - target) <= 1.5)
      .reduce((best, sample) => Math.max(best, sample.actualHeading), -Infinity);
    return { peakHeading: peak.toFixed(1) };
  }
  if (step.seq === 6) return { endError: Math.abs(signedHeading(last.actualHeading) - (-90)).toFixed(1) };
  if (step.seq === 7) return { saturated: samples.some((sample) => Math.abs(sample.rudder) >= 34) ? '顶满了' : '没有顶满' };
  if (step.seq === 8) return { yawRate: last.yawRate.toFixed(2), rudder: last.rudder.toFixed(1) };
  if (step.seq === 9) {
    const deviation = samples.reduce((best, sample) => Math.max(best, Math.abs(sample.actualHeading)), 0);
    return { maxHeadingDev: deviation.toFixed(1) };
  }
  return { note: '舵角变化之后，航向和转艏速率跟着变，回中后转艏变慢。' };
}

describe('驱逐舰实验步骤', () => {
  it('未完成当前步骤时不能提交后面的步骤', () => {
    expect(assertDestroyerStepOrder([], 2)).toContain('当前步骤');
    expect(assertDestroyerStepOrder([1], 1)).toBeNull();
    expect(assertDestroyerStepOrder([1, 2], 3)).toBeNull();
    expect(chooseBetterDestroyerAttempt({ earnedPoints: 8 }, { earnedPoints: 4 }).keptPrevious).toBe(true);
    expect(chooseBetterDestroyerAttempt({ earnedPoints: 8 }, { earnedPoints: 8 }).keptPrevious).toBe(false);
  });

  it('读数和曲线对不上时不能通过', () => {
    const step = DESTROYER_EXPERIMENT_STEPS[0];
    const samples = Array.from({ length: 8 }, (_, index) => ({
      time: index * 2,
      desiredHeading: 0,
      actualHeading: 1,
      yawRate: 0,
      rudder: 0,
      manualRudder: 0,
      speed: 15,
      crossTrackError: 0,
    }));
    const scored = scoreDestroyerStep(step.seq, samples, { heading: '40', speed: '15' });
    expect(scored.ok).toBe(false);
  });

  it('一般学生按曲线读数可以走完二十步并生成报告', () => {
    const done: number[] = [];
    const stored: Array<{ seq: number; title: string; earnedPoints: number; maxPoints: number; evaluation: string; remarks: string }> = [];
    for (const step of DESTROYER_EXPERIMENT_STEPS) {
      expect(assertDestroyerStepOrder(done, step.seq), step.title).toBeNull();
      const samples = step.scene === 'review' ? [] : studentSamples(step);
      const readings = studentReadings(step, samples.length ? samples : [{
        time: 0, desiredHeading: 0, actualHeading: 0, yawRate: 0, rudder: 0, manualRudder: 0, speed: 15, crossTrackError: 0,
      }]);
      const scored = scoreDestroyerStep(step.seq, samples, readings);
      expect(scored.ok, `${step.title}: ${scored.message}`).toBe(true);
      stored.push({
        seq: step.seq,
        title: step.title,
        earnedPoints: scored.earnedPoints,
        maxPoints: scored.maxPoints,
        evaluation: scored.evaluation,
        remarks: scored.remarks,
      });
      done.push(step.seq);
      expect(assertDestroyerStepOrder(done, step.seq)).toBeNull();
      if (step.seq < 9) expect(assertDestroyerStepOrder(done, step.seq + 2)).not.toBeNull();
      expect(maneuverCompleted(step, samples), step.title).toBe(true);
    }
    expect(done).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(stored.reduce((sum, step) => sum + step.earnedPoints, 0)).toBe(DESTROYER_MAX_POINTS);
    const html = buildDestroyerReportHtml({ displayName: '学生', steps: stored });
    for (const step of DESTROYER_EXPERIMENT_STEPS) {
      expect(html).toContain(step.title);
    }
    expect(html).toContain('实验得分：100/100');
    expect(validateDestroyerReportDraft({
      reportHtml: html,
      steps: stored.map((step) => ({ ...step, evaluation: step.evaluation, remarks: step.remarks })),
    }).ok).toBe(true);
  }, 180000);
});

function maneuverCompleted(step: DestroyerExperimentStep, samples: DestroyerSample[]): boolean {
  if (step.scene === 'review') return true;
  const near = (target: number) => samples.some((sample) => Math.abs(sample.actualHeading - target) <= 1);
  const last = samples[samples.length - 1];
  if (!last) return false;
  if (step.seq === 2) return last.yawRate > 0.7;
  if (step.seq === 3) return Math.abs(last.manualRudder) < 0.1 && Math.abs(last.yawRate) < 0.2;
  if (step.seq === 4) return near(15);
  if (step.seq === 5) return near(90);
  if (step.seq === 6) return near(-90);
  if (step.seq === 7) return near(45) && near(-45);
  if (step.seq === 8) return Math.abs(last.yawRate - 0.55) < 0.15 && Math.abs(last.rudder) < 20;
  if (step.seq === 9) {
    const deviation = samples.reduce((best, sample) => Math.max(best, Math.abs(sample.actualHeading)), 0);
    return deviation > 5 && samples.some((sample) => sample.time > 120 && Math.abs(sample.actualHeading) < 2);
  }
  if (step.seq === 14 || step.seq === 17) return last.yawRate > 0.05;
  if (step.seq === 15) return last.yawRate < -0.05;
  if (step.seq === 16) return Math.abs(last.manualRudder) < 0.1 && samples.some((sample) => Math.abs(sample.manualRudder) >= 8);
  if (step.seq >= 10 && step.seq <= 19) return Math.abs(last.actualHeading) < 8 && last.speed > 8;
  return Math.abs(last.actualHeading) < 2;
}
