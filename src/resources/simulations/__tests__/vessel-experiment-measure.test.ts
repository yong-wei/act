import { beforeAll, describe, expect, it } from 'vitest';

import { preloadServerControlEngine } from '@/lib/control-engine/wasm-server';
import { SIMULATION_FIXED_STEP_SECONDS } from '@/resources/simulations/lib/simulation-timing';
import { preloadVirtualSimulationRuntime } from '@/resources/simulations/physics/simulation-engine-facade';
import {
  assertVesselStepOrder,
  buildVesselReportHtml,
  chooseBetterVesselAttempt,
  collectSamples,
  validateVesselReportDraft,
  vesselMaxPoints,
  vesselValue,
  type VesselExperiment,
  type VesselReadings,
  type VesselReportDraftStep,
  type VesselSample,
  type VesselStep,
} from '@/resources/simulations/simulations/vessel-experiment';
import { sketchIdForLabel } from '@/features/ilab/sketch-plots';
import { VESSEL_EXPERIMENTS } from '@/resources/simulations/simulations/vessel-experiments';
import {
  createContainerDrive,
  createCruiseDrive,
  createDredgerDrive,
  createDrillingDrive,
  createIceDrive,
  createLngDrive,
} from '@/resources/simulations/simulations/vessel-drives';

type Drive = {
  reset: (command: ReturnType<VesselExperiment['command']>) => void;
  step: (command: ReturnType<VesselExperiment['command']>, dt: number, time: number) => VesselSample;
};

const DRIVES: Record<string, () => Drive> = {
  'lng-berthing': createLngDrive,
  'container-voyage': createContainerDrive,
  'cruise-comfort': createCruiseDrive,
  'drilling-dp': createDrillingDrive,
  'icebreaker-ice': createIceDrive,
  'dredger-mode': createDredgerDrive,
};

const CHOICES: Record<string, string> = {
  'lng-berthing:7': '航速几乎立刻跟上',
  'lng-berthing:9': '距离还够',
  'container-voyage:3': '低速更省',
  'container-voyage:8': '没有顶满',
  'container-voyage:9': '后半段更快',
  'cruise-comfort:2': '横摇变大',
  'cruise-comfort:3': '横摇小下来',
  'cruise-comfort:5': '过程中明显升高',
  'drilling-dp:3': '超过了',
  'drilling-dp:5': '偏差明显变大',
  'drilling-dp:6': '偏差小回来',
  'drilling-dp:7': '没有停机',
  'drilling-dp:9': '开解耦才能守住',
  'icebreaker-ice:2': '航向仍在零附近',
  'icebreaker-ice:6': '冰阻力明显上来了',
  'icebreaker-ice:8': '几乎没转到',
  'icebreaker-ice:9': '冰把航速压住了',
  'dredger-mode:4': '还没有回到原点',
  'dredger-mode:5': '还能守住',
  'dredger-mode:6': '被流带离',
  'dredger-mode:7': '定位',
  'dredger-mode:9': '离开定位才会漂',
  'lng-berthing:12': '向左转了',
  'lng-berthing:14': '比靠泊快',
  'lng-berthing:16': '航向留在零附近',
  'lng-berthing:18': '已经改用低速',
  'lng-berthing:19': '奈奎斯特图',
  'container-voyage:12': '后段更快',
  'container-voyage:19': '伯德图',
  'cruise-comfort:13': '减摇鳍没有出力',
  'cruise-comfort:14': '航向留在零附近',
  'cruise-comfort:17': '这是四级海况',
  'cruise-comfort:18': '航速在巡航附近',
  'cruise-comfort:19': '根轨迹图',
  'drilling-dp:13': '偏差变大了',
  'drilling-dp:14': '没有停机',
  'drilling-dp:16': '位置收得回来',
  'drilling-dp:18': '功率已经出现',
  'drilling-dp:19': '时域响应图',
  'icebreaker-ice:12': '冰阻力上来了',
  'icebreaker-ice:13': '航向留在零附近',
  'icebreaker-ice:15': '冰把航速压住了',
  'icebreaker-ice:18': '几乎没有冰阻力',
  'icebreaker-ice:19': '奈奎斯特图',
  'dredger-mode:12': '正在定位',
  'dredger-mode:15': '被流带离',
  'dredger-mode:18': '还离原点很远',
  'dredger-mode:19': '伯德图',
};

function readingsFor(experiment: VesselExperiment, step: VesselStep, samples: VesselSample[]): VesselReadings {
  const readings: VesselReadings = {};
  const last = samples[samples.length - 1];
  for (const field of step.fields) {
    if (field.kind === 'text') {
      readings[field.key] = '曲线终点和过程已经看过。';
    } else if (field.kind === 'choice') {
      const choice = CHOICES[`${experiment.key}:${step.seq}`];
      if (!choice) throw new Error(`missing fixed choice ${experiment.key}:${step.seq}`);
      readings[field.key] = choice;
    } else if (field.kind === 'sketch') {
      const kind = sketchIdForLabel(readings.plotKind ?? '');
      if (!kind) throw new Error(`missing sketch choice ${experiment.key}:${step.seq}`);
      readings.sketchKind = kind;
      readings.sketchBlank = '0';
      readings.sketchEvaluation = '曲线形状和所选图种一致。';
    } else {
      const digits = experiment.series.find((series) => series.id === field.key)?.digits ?? 1;
      readings[field.key] = vesselValue(last, field.key).toFixed(digits);
    }
  }
  return readings;
}

describe('vessel experiment acceptance', () => {
  beforeAll(async () => {
    preloadServerControlEngine();
    await preloadVirtualSimulationRuntime();
  }, 120000);

  it('keeps step order, best score, and a valid report', () => {
    const steps = VESSEL_EXPERIMENTS[0]?.steps ?? [];
    expect(assertVesselStepOrder(steps, [], 2)).toBe('请先完成当前步骤，后面的步骤还不能提交。');
    expect(assertVesselStepOrder(steps, [1], 2)).toBeNull();
    expect(assertVesselStepOrder(steps, [], 99)).toBe('实验步骤不存在。');
    const worse = chooseBetterVesselAttempt({ earnedPoints: 10, id: 'kept' }, { earnedPoints: 4, id: 'dropped' });
    expect(worse.keptPrevious).toBe(true);
    expect(worse.record.id).toBe('kept');
    const tie = chooseBetterVesselAttempt({ earnedPoints: 8, id: 'older' }, { earnedPoints: 8, id: 'newer' });
    expect(tie.keptPrevious).toBe(false);
    expect(tie.record.id).toBe('newer');
    for (const experiment of VESSEL_EXPERIMENTS) {
      expect(vesselMaxPoints(experiment.steps)).toBe(100);
      expect(experiment.steps).toHaveLength(20);
      expect(experiment.steps.some((step) => step.fields.some((field) => field.kind === 'sketch'))).toBe(true);
      const plots = experiment.steps.flatMap((step) => step.fields.find((field) => field.key === 'plotKind')?.choices ?? []);
      expect(plots).toEqual(['奈奎斯特图', '伯德图', '根轨迹图', '时域响应图']);
    }
  });

  it('scores every scripted step from the 1/60 endpoint', () => {
    const drafts: VesselReportDraftStep[] = [];
    for (const experiment of VESSEL_EXPERIMENTS) {
      const create = DRIVES[experiment.key];
      if (!create) throw new Error(`missing drive ${experiment.key}`);
      const drive = create();
      let earned = 0;
      for (const step of experiment.steps) {
        drive.reset(experiment.command(step, 0));
        const samples = collectSamples(step.duration, SIMULATION_FIXED_STEP_SECONDS, (time, dt) => (
          drive.step(experiment.command(step, time), dt, time)
        ));
        const last = samples[samples.length - 1];
        const score = experiment.score(step, samples, readingsFor(experiment, step, samples));
        console.log(`${experiment.key} ${step.seq} ok=${score.ok} earned=${score.earnedPoints} ${score.ok ? '' : score.message}`);
        expect(
          score.ok,
          `${experiment.key} step ${step.seq} ${score.message} last=${JSON.stringify(last?.values ?? null)}`,
        ).toBe(true);
        expect(score.earnedPoints).toBe(step.maxPoints);
        earned += score.earnedPoints;
        drafts.push({
          seq: step.seq,
          title: step.title,
          earnedPoints: score.earnedPoints,
          maxPoints: step.maxPoints,
          evaluation: score.evaluation,
          remarks: score.remarks,
        });
      }
      expect(earned, experiment.key).toBe(100);
      const reportSteps = drafts.splice(0, drafts.length);
      const reportHtml = buildVesselReportHtml(experiment, { displayName: '验收', steps: reportSteps });
      const validated = validateVesselReportDraft(experiment, { reportHtml, steps: reportSteps });
      expect(validated.ok, validated.ok ? '' : validated.message).toBe(true);
      if (validated.ok) expect(validated.score).toBe(100);
    }
  }, 600000);
});
