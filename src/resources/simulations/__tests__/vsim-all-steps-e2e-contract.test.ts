// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../physics/simulation-engine-facade', () => ({
  computeVirtualSimulationStep: (request: unknown) => JSON.parse(invokeServerWasm('compute_virtual_simulation_step', JSON.stringify(request))),
  preloadVirtualSimulationRuntime: vi.fn(),
}));

import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import { collectVesselTracePoint, type VesselTracePoint } from '@/features/simulations/run-evidence';
import type { VesselSessionConfiguration, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { createServerVesselSessionWithAssets, invokeServerWasm, preloadServerControlEngine } from '@/lib/control-engine/wasm-server';
import type { ModelStructureValue } from '@/lib/student-model-artifact-contract';
import type { VesselCourseAdapter, VesselCourseStep } from '../experiments/course-adapter';
import { containerCourseAdapter, containerCourseDefaultSettings, CONTAINER_COURSE_STEPS } from '../experiments/container-course';
import { CONTAINER_COURSE_EXPERIMENT } from '../experiments/container-experiment';
import { cruiseCourseAdapter, cruiseCourseDefaultSettings, CRUISE_COURSE_STEPS } from '../experiments/cruise-course';
import { cruiseCourseExperiment } from '../experiments/cruise-experiment';
import { DREDGER_COURSE_STEPS } from '../experiments/dredger-course';
import { dredgerCourseAdapter } from '../experiments/dredger-course-adapter';
import { dredgerCourseExperiment } from '../experiments/dredger-experiment';
import { drillingCourseAdapter, drillingCourseDefaultSettings, DRILLING_COURSE_STEPS } from '../experiments/drilling-course';
import { DRILLING_COURSE_EXPERIMENT } from '../experiments/drilling-experiment';
import { icebreakerDefaultSettings, ICEBREAKER_COURSE_STEPS } from '../experiments/icebreaker-course';
import { icebreakerCourseAdapter } from '../experiments/icebreaker-course-adapter';
import { icebreakerCourseExperiment } from '../experiments/icebreaker-experiment';
import { lngCourseAdapter } from '../experiments/course-adapter';
import { lngCourseDefaultSettings, LNG_COURSE_STEPS } from '../experiments/lng-course';
import { LNG_COURSE_EXPERIMENT } from '../experiments/lng-experiment';
import type { DestroyerComparisonEvidence, DestroyerModelEvidence } from '../experiments/destroyer-evidence';
import { validateDestroyerCourseEvidence } from '../experiments/destroyer-evidence';
import type { FrozenVesselStudentModel, IdentificationChannel } from '../experiments/student-analysis';
import { advanceDestroyerCourseSession } from '../rust/destroyer-hifi-adapter';
import { DESTROYER_COURSE_STEPS } from '../experiments/destroyer-course';
import { DESTROYER_CURRENT_STEPS } from '../simulations/destroyer-experiment';
import type { StepObservationSpec, StepPredictionSpec, VesselStep } from '../simulations/vessel-experiment';
import { synthesizeObservationSummary } from '../simulations/vessel-step-structured-fields';

function buildModel(
  id: string,
  channel: IdentificationChannel | 'dp-low-frequency',
  experimentKey: string,
  structure: ModelStructureValue,
  trainingRunIds: string[],
  operatingPoint: Record<string, unknown> = { speedMps: 8 },
): FrozenVesselStudentModel {
  return {
    id,
    scopeKey: `${experimentKey}:e2e`,
    label: `${id}`,
    channel,
    createdAtMs: 4500,
    serverId: id,
    contentHash: `hash-${id}`,
    payload: {
      experimentKey,
      lineageKey: 'step-3',
      structure,
      ioContract: { inputChannel: 'In', outputChannel: 'Out', inputUnit: 'u', outputUnit: 'y' },
      operatingPoint,
      identification: { algorithm: 'oe_lsq', settings: { trainingFitPercent: 92 }, identifiedOk: true, residualRms: 0.02 },
      trainingRuns: trainingRunIds.map((runRef) => ({ runRef, startS: 20, endS: 180 })),
      validationRuns: [],
      sampleDt: 0.2,
    },
  };
}

function buildModelsForVessel(courseKey: string): FrozenVesselStudentModel[] {
  switch (courseKey) {
    case 'destroyer':
      return [
        buildModel('destroyer-hull-8', 'rudder-to-yaw', 'destroyer-course', { kind: 'nomoto1', k: 0.085, t_s: 26 }, ['d-3-a'], { speedMps: 8, inputOrigin: 0, outputOrigin: 0 }),
        buildModel('destroyer-hull-4', 'rudder-to-yaw', 'destroyer-course', { kind: 'nomoto1', k: 0.045, t_s: 42 }, ['d-7-a'], { speedMps: 4, inputOrigin: 0, outputOrigin: 0 }),
        buildModel('destroyer-hull-12', 'rudder-to-yaw', 'destroyer-course', { kind: 'nomoto1', k: 0.115, t_s: 20 }, ['d-7-b'], { speedMps: 12, inputOrigin: 0, outputOrigin: 0 }),
        buildModel('destroyer-servo', 'rudder-servo', 'destroyer-course', { kind: 'fopdt', k: 1, t_s: 2.4, delay_s: 0.2 }, ['d-2-a'], { speedMps: 8, inputOrigin: 0, outputOrigin: 0 }),
      ];
    case 'container':
      return [
        buildModel('c-m20', 'shaft-reference-to-speed', 'container-voyage', { kind: 'fopdt', k: 0.055, t_s: 120, delay_s: 2 }, ['container-3-0', 'container-5-0', 'container-6-0'], { loadingRatio: 0.2, speedMps: 8, inputOrigin: 65, outputOrigin: 8 }),
        buildModel('c-m60', 'shaft-reference-to-speed', 'container-voyage', { kind: 'fopdt', k: 0.048, t_s: 165, delay_s: 2.5 }, ['container-3-1'], { loadingRatio: 0.6, speedMps: 8, inputOrigin: 68, outputOrigin: 8 }),
        buildModel('c-m90', 'shaft-reference-to-speed', 'container-voyage', { kind: 'fopdt', k: 0.042, t_s: 205, delay_s: 3 }, ['container-3-2', 'container-5-1', 'container-6-1'], { loadingRatio: 0.9, speedMps: 8, inputOrigin: 72, outputOrigin: 8 }),
      ];
    case 'cruise':
      return [
        buildModel('cr-fin', 'fin-to-roll', 'cruise-comfort', { kind: 'roll_oscillator', natural_freq_rad_s: 0.42, damping: 0.08, control_gain: 0.012 }, ['cruise-2-0', 'cruise-3-0'], { speedMps: 10, rollInertiaKgM2: 3.5e8, inputOrigin: 0, outputOrigin: 0 }),
      ];
    case 'drilling':
      return [
        buildModel('dp-3ch', 'dp-low-frequency', 'drilling-dp', { kind: 'dp_low_freq3', a: [0, 0, 0, 0, 0, 0, 0, 0, 0], b: [1e-4, 0, 0, 0, 1e-4, 0, 0, 0, 1e-6] }, ['drilling-3-0', 'drilling-3-1', 'drilling-3-2'], {}),
      ];
    case 'lng':
      return [
        buildModel('lng-joint', 'shaft-reference-to-speed', 'lng-berthing', { kind: 'fopdt', k: 0.046, t_s: 155, delay_s: 2 }, ['lng-2-0'], { speedMps: 4, loadingRatio: 0.85, inputOrigin: 45, outputOrigin: 4 }),
        buildModel('lng-actual', 'shaft-to-speed', 'lng-berthing', { kind: 'fopdt', k: 0.05, t_s: 145, delay_s: 1.5 }, ['lng-2-0'], { speedMps: 4, loadingRatio: 0.85, inputOrigin: 45, outputOrigin: 4 }),
        buildModel('lng-m30', 'shaft-reference-to-speed', 'lng-berthing', { kind: 'fopdt', k: 0.055, t_s: 130, delay_s: 1.5 }, ['lng-12-0'], { speedMps: 4, loadingRatio: 0.30, inputOrigin: 45, outputOrigin: 4 }),
        buildModel('lng-m70', 'shaft-reference-to-speed', 'lng-berthing', { kind: 'fopdt', k: 0.048, t_s: 150, delay_s: 2 }, ['lng-12-1'], { speedMps: 4, loadingRatio: 0.70, inputOrigin: 45, outputOrigin: 4 }),
        buildModel('lng-m95', 'shaft-reference-to-speed', 'lng-berthing', { kind: 'fopdt', k: 0.042, t_s: 170, delay_s: 2.5 }, ['lng-12-2'], { speedMps: 4, loadingRatio: 0.95, inputOrigin: 45, outputOrigin: 4 }),
      ];
    case 'icebreaker':
      return [
        buildModel('ice-hull-open', 'azimuth-to-yaw', 'icebreaker-course', { kind: 'nomoto1', k: 0.07, t_s: 28 }, ['icebreaker-3-0'], { speedMps: 4, iceThicknessM: 0 }),
        buildModel('ice-hull-level', 'azimuth-to-yaw', 'icebreaker-course', { kind: 'nomoto1', k: 0.055, t_s: 35 }, ['icebreaker-11-0'], { speedMps: 4, iceThicknessM: 1.2 }),
        buildModel('ice-servo', 'azimuth-servo', 'icebreaker-course', { kind: 'fopdt', k: 1, t_s: 3.2, delay_s: 0.1 }, ['icebreaker-2-0'], { speedMps: 4 }),
      ];
    case 'dredger':
      return [
        buildModel('drg-joint-sand', 'winch-reference-to-sway', 'dredger-course', { kind: 'nomoto1', k: 0.85, t_s: 8.5 }, ['dredger-2-0', 'dredger-5-0'], { dredgerSoil: 'sand', dredgerMode: 'cut_swing' }),
        buildModel('drg-joint-clay', 'winch-reference-to-sway', 'dredger-course', { kind: 'nomoto1', k: 0.72, t_s: 10.5 }, ['dredger-11-0'], { dredgerSoil: 'clay', dredgerMode: 'cut_swing' }),
        buildModel('drg-actual', 'winch-speed-to-sway', 'dredger-course', { kind: 'nomoto1', k: 0.9, t_s: 7.5 }, ['dredger-2-0', 'dredger-5-0'], { dredgerSoil: 'sand', dredgerMode: 'cut_swing' }),
      ];
    default:
      return [];
  }
}

function makeSummary(
  id: string,
  seq: number,
  durationS: number,
  configuration: VesselSessionConfiguration,
  initialInput: VesselSessionInput,
  overrides: Partial<VesselRunSummary> = {},
): VesselRunSummary {
  return {
    id,
    scopeKey: 'e2e',
    courseVersion: 'seven-vessel-2026.11.14',
    stepSequence: seq,
    createdAtMs: 1000,
    stoppedAtMs: 2000,
    lastTimeS: Math.max(durationS, 1),
    durationS: Math.max(durationS, 1),
    sampleCount: 120,
    stopReason: 'duration',
    configuration,
    initialInput,
    ...overrides,
  } as unknown as VesselRunSummary;
}

function makeComparison(
  id: string,
  runId: string,
  modelId: string,
  mode: DestroyerComparisonEvidence['mode'],
  actuatorModelId: string | null = null,
  purpose?: 'forecast' | 'validation',
  controllerInput?: VesselSessionInput,
): DestroyerComparisonEvidence {
  return {
    id,
    modelId,
    actuatorModelId,
    runId,
    mode,
    startS: 20,
    endS: 120,
    createdAtMs: 4600,
    actualSampleCount: 100,
    ...(purpose ? { purpose } : {}),
    ...(controllerInput ? { controllerInput } : {}),
  } as unknown as DestroyerComparisonEvidence;
}

function defaultAnswersForStep(step: VesselStep, seq: number): Record<string, string> {
  if (seq === 20) {
    return Object.fromEntries(step.fields.map((f) => [f.key, `${f.label}：已引用多步本人真实运行与参数证据完成对比总结。`]));
  }
  const answers: Record<string, string> = {};
  const pSpec: StepPredictionSpec | undefined = step.predictionSpec;
  if (pSpec?.kind === 'choice' && pSpec.options?.length) {
    answers.predictionChoice = pSpec.options[0].value;
    answers.prediction = `选择「${pSpec.options[0].label}」；依据动力学规律与工况约束预计响应将按该趋势演进。`;
  } else {
    answers.prediction = '运行前预估：受执行器速率、船体惯性与外扰约束，系统响应呈物理滞后并收敛至稳态或包络区间。';
  }

  const obsSpec: StepObservationSpec | undefined = step.observationSpec;
  if (obsSpec) {
    const slotValues: Record<string, string> = {};
    const metricEntries: string[] = [];
    for (const slot of obsSpec.slots ?? []) {
      const mText = slot.metrics.map((m) => `${m.label}=1.25${m.unit ?? ''}`).join('；');
      metricEntries.push(`[${slot.label}] ${mText}`);
      for (const m of slot.metrics) {
        slotValues[`obs_slot_${slot.id}_${m.key}`] = '1.25';
      }
    }
    for (const m of obsSpec.metrics ?? []) {
      slotValues[`obs_metric_${m.key}`] = '1.25';
      metricEntries.push(`${m.label}=1.25${m.unit ?? ''}`);
    }
    const synthesized = synthesizeObservationSummary(obsSpec, slotValues);
    answers.observation = synthesized.trim() || metricEntries.join('；') || '已采集仿真曲线特征读数并完成对照。';
    Object.assign(answers, slotValues);
  } else {
    answers.observation = '已完成运行观测并提取关键通道峰值、稳态与约束读数。';
  }

  if (step.fields.some((f) => f.key === 'capacity')) {
    answers.capacity = '静态推力裕度满足环境峰值需求；验证运行中实际需求功率低于总功上限。';
  }
  answers.interpretation = '因果链为指令→执行器→阻力/恢复力矩→运动响应，该线性或简化模型仅在当前激励幅值与标称航速邻域内适用。';
  return answers;
}

describe('vsim 全 7 船 × 20 步 = 140 步真实 WASM 与证据校验契约', () => {
  beforeAll(() => {
    preloadServerControlEngine();
  }, 30000);

  it('055 驱逐舰 20 步真实 WASM 步进与证据校验 20/20 通过', async () => {
    const models = buildModelsForVessel('destroyer');
    const allRuns: VesselRunSummary[] = [];
    const baseInput = {
      controlMode: 'manual' as const,
      pid: { kp: 1, ki: 0, kd: 10 },
      targetHeadingDeg: 0,
      feedback: 'measurement' as const,
      actuators: { shafts: [{ speed_reference_rad_s: 12, azimuth_rad: 0, enabled: true }], surfaces: [{ angle_rad: 0, enabled: true }] },
    };

    for (const step of DESTROYER_COURSE_STEPS) {
      if (step.stepKind === 'run') {
        const native = await createServerVesselSessionWithAssets(step.configuration);
        let init: VesselSessionInput = JSON.parse(native.snapshot()).input ?? structuredClone(baseInput);
        init = { ...init, controlMode: step.controlMode, pid: { kp: 1.5, ki: step.controlMode === 'pid' ? 0.05 : 0, kd: step.controlMode === 'manual' ? 0 : 12 } };
        const pts: VesselTracePoint[] = [];
        let prev = {};
        const wrapped = {
          runtimeVersion: 'test',
          read: () => JSON.parse(native.read()),
          advance: (dtS: number, cmd?: VesselSessionInput) => JSON.parse(native.advance(dtS, cmd ? JSON.stringify(cmd) : '')),
          setPaused: () => undefined,
          snapshot: () => native.snapshot(),
          restore: (s: string) => native.restore(s),
          reset: () => native.reset(),
          dispose: () => native.free(),
        };
        for (let t = 0; t < 25; t += 1) {
          const ev = step.events.find((e) => e.timeS <= t);
          const frame = advanceDestroyerCourseSession(wrapped, init, {
            dtS: 1,
            targetHeadingDeg: ev?.headingDeg ?? (step.controlMode === 'manual' ? 0 : 10),
            controlMode: step.controlMode,
            pid: init.pid,
            manualRudderDeg: ev?.rudderDeg ?? (step.sequence <= 2 ? 5 : 0),
            derivativeFilterTauS: 0.25,
            headingIntegralTracking: { enabled: step.sequence !== 12, timeS: 1 },
          });
          pts.push(...frame.controlSamples.map((s) => {
            const p = collectVesselTracePoint(s, prev);
            prev = p.measurements;
            return p;
          }));
        }
        expect(pts.length).toBeGreaterThan(0);
        expect(Number.isFinite(pts.at(-1)!.truth.headingDeg)).toBe(true);
        wrapped.dispose();
      }
    }

    const passed: number[] = [];
    for (const step of DESTROYER_COURSE_STEPS) {
      const seq = step.sequence;
      const vs = DESTROYER_CURRENT_STEPS[seq - 1];
      const dur = step.runDurationS ?? 300;
      const basePid = { kp: 1.5, ki: step.controlMode === 'pid' ? 0.04 : 0, kd: step.controlMode === 'manual' ? 0 : 12 };
      const runInput = (extra?: Partial<VesselSessionInput>): VesselSessionInput => ({
        ...baseInput,
        controlMode: seq === 11 ? 'pid' : step.controlMode,
        pid: basePid,
        derivativeFilterTauS: seq === 15 ? 0.05 : 0.25,
        headingIntegralTracking: { enabled: true, timeS: 1 },
        headingController: seq >= 9 ? { mode: step.controlMode, designModelId: 'destroyer-hull-8', actuatorModelId: 'destroyer-servo', kpMultiplier: 1 } : undefined,
        ...extra,
      });
      const step16Cfg = DESTROYER_COURSE_STEPS[15].configuration;
      const r1 = makeSummary(`d-${seq}-a`, seq, dur, {
        ...step.configuration,
        ...(seq === 7 ? { initialWaterSpeedMps: 4 } : {}),
      }, runInput(), {
        createdAtMs: 1000 + seq * 1000,
        designStudentModelId: 'destroyer-hull-8',
        ...([18, 19].includes(seq) ? { controllerSourceRunId: 'd-16-a' } : {}),
      });
      const r2 = makeSummary(`d-${seq}-b`, seq, dur, {
        ...step.configuration,
        initialWaterSpeedMps: seq === 7 ? 12 : seq === 19 ? 8 : step.configuration.initialWaterSpeedMps,
        environment: seq === 14 ? 'P0' : step.configuration.environment,
      }, runInput({
        controlMode: seq === 11 ? 'pd' : step.controlMode,
        pid: { kp: seq === 9 ? 3.0 : seq === 17 ? 2.1 : 1.5, ki: seq === 11 || step.controlMode !== 'pid' ? 0 : 0.04, kd: step.controlMode === 'manual' ? 0 : 12 },
        derivativeFilterTauS: seq === 15 ? 1.5 : 0.25,
        headingIntegralTracking: { enabled: seq !== 12, timeS: 1 },
        headingController: seq >= 9 ? {
          mode: step.controlMode,
          designModelId: 'destroyer-hull-8',
          actuatorModelId: 'destroyer-servo',
          kpMultiplier: seq === 9 ? 2 : seq === 17 ? 1.4 : 1,
        } : undefined,
      }), {
        createdAtMs: 1000 + seq * 1000 + 1,
        designStudentModelId: 'destroyer-hull-8',
        ...([18, 19].includes(seq) ? { controllerSourceRunId: 'd-16-a' } : {}),
      });
      if (seq === 17) allRuns.push(r2);
      else if (seq !== 4 && seq !== 8 && seq !== 20) allRuns.push(r1);
      expect(step16Cfg).toBeDefined();

      const s16 = allRuns.find((r) => r.stepSequence === 16);
      const stepRuns = seq === 4 ? [allRuns.find((r) => r.stepSequence === 3)!]
        : seq === 8 || seq === 20 ? allRuns
        : seq === 10 ? [r1]
        : seq === 17 ? [...(s16 ? [s16] : []), r2]
        : seq === 18 ? [...(s16 ? [s16] : []), r1]
        : seq === 19 ? [...(s16 ? [s16] : []), r1, r2]
        : [r1, r2];
      const ownForStep = stepRuns.filter((r) => r.stepSequence === seq);
      const targetRunId = (ownForStep[0] ?? stepRuns[0]).id;
      const comparisons = [
        makeComparison(`c-${seq}-f`, targetRunId, 'destroyer-hull-8', 'independent_closed_loop', 'destroyer-servo', 'forecast'),
        makeComparison(`c-${seq}-1`, targetRunId, 'destroyer-hull-8', [5, 6].includes(seq) ? 'hull_model' : [10, 17, 18].includes(seq) ? 'independent_closed_loop' : 'hull_model', 'destroyer-servo', 'validation'),
        makeComparison(`c-${seq}-2`, allRuns.find((r) => r.stepSequence === 3)?.id ?? targetRunId, 'destroyer-hull-8', 'hull_model'),
        ...(s16 ? [makeComparison(`c-20-16`, s16.id, 'destroyer-hull-8', 'independent_closed_loop', 'destroyer-servo', 'validation')] : []),
      ];
      const answers = defaultAnswersForStep({ ...vs, fields: vs.fields.map((f) => ({ key: f.key, label: f.label, kind: f.kind as 'number' | 'choice' | 'text', unit: f.unit, choices: f.choices })) } as unknown as VesselStep, seq);
      if (seq === 8) answers.sketchImage = 'data:image/png;base64,iVBORw0KGgo=';
      if (seq === 20) {
        for (const r of [allRuns[0], allRuns[1], allRuns[2], allRuns[3]]) {
          expect(r).toBeDefined();
        }
      }
      const err = validateDestroyerCourseEvidence(step, {
        runs: stepRuns,
        models: models as DestroyerModelEvidence[],
        comparisons,
        answers,
        designKp: () => 1.5,
      });
      expect(err, `destroyer step ${seq}`).toBeNull();
      passed.push(seq);

      if (step.requiredArtifacts.includes('prediction')) {
        const missing = validateDestroyerCourseEvidence(step, {
          runs: stepRuns,
          models: models as DestroyerModelEvidence[],
          comparisons,
          answers: { ...answers, prediction: '' },
          designKp: () => 1.5,
        });
        expect(missing, `destroyer step ${seq} missing prediction`).not.toBeNull();
      }
    }
    expect(passed).toHaveLength(20);
  }, 120000);

  it.each([
    { key: 'container', name: '集装箱船', adapter: containerCourseAdapter as VesselCourseAdapter<Record<string, unknown>>, steps: CONTAINER_COURSE_STEPS, experimentSteps: CONTAINER_COURSE_EXPERIMENT.steps, defaultSettings: (s: number) => containerCourseDefaultSettings(s) as unknown as Record<string, unknown> },
    { key: 'cruise', name: '大型邮轮', adapter: cruiseCourseAdapter as VesselCourseAdapter<Record<string, unknown>>, steps: CRUISE_COURSE_STEPS, experimentSteps: cruiseCourseExperiment.steps, defaultSettings: (s: number) => cruiseCourseDefaultSettings(s) as unknown as Record<string, unknown> },
    { key: 'drilling', name: '981 半潜平台', adapter: drillingCourseAdapter as VesselCourseAdapter<Record<string, unknown>>, steps: DRILLING_COURSE_STEPS, experimentSteps: DRILLING_COURSE_EXPERIMENT.steps, defaultSettings: (s: number) => drillingCourseDefaultSettings(s) as unknown as Record<string, unknown> },
    { key: 'lng', name: 'LNG 运输船', adapter: lngCourseAdapter as VesselCourseAdapter<Record<string, unknown>>, steps: LNG_COURSE_STEPS, experimentSteps: LNG_COURSE_EXPERIMENT.steps, defaultSettings: (s: number) => lngCourseDefaultSettings(s) as unknown as Record<string, unknown> },
    { key: 'icebreaker', name: '雪龙 2 破冰船', adapter: icebreakerCourseAdapter as VesselCourseAdapter<Record<string, unknown>>, steps: ICEBREAKER_COURSE_STEPS, experimentSteps: icebreakerCourseExperiment.steps, defaultSettings: (s: number) => icebreakerDefaultSettings(s) as unknown as Record<string, unknown> },
    { key: 'dredger', name: '天鲸号挖泥船', adapter: dredgerCourseAdapter as VesselCourseAdapter<Record<string, unknown>>, steps: DREDGER_COURSE_STEPS, experimentSteps: dredgerCourseExperiment.steps, defaultSettings: (s: number) => dredgerCourseAdapter.defaultSettings(s) as unknown as Record<string, unknown> },
  ])('$name ($key) 20 步真实 WASM 步进与证据校验 20/20 通过', async (entry) => {
    let validatedCount = 0;
    const models = buildModelsForVessel(entry.key);
    const historyRuns: VesselRunSummary[] = [];
    const historyComparisons: DestroyerComparisonEvidence[] = [];

    for (const step of entry.steps) {
        const seq = step.sequence;
        let settings = entry.defaultSettings(seq);
        if (entry.key === 'container' && seq >= 7 && seq <= 19) {
          settings = { ...settings, modelIds: models.map((m) => m.id) };
        }
        if (entry.key === 'cruise' && seq === 6) {
          settings = { ...settings, identifiedPeriodS: (2 * Math.PI) / 0.42 };
        }
        if (entry.key === 'icebreaker' && seq >= 14) {
          settings = { ...settings, iceModelId: 'ice-hull-level' };
        }
        const designModelId = models[0].id;
        const execSeq = entry.adapter.nativeSequence?.(seq) ?? seq;
        const config = entry.adapter.configuration(execSeq, settings);
        let initInput: VesselSessionInput = { controlMode: 'manual', pid: { kp: 1, ki: 0, kd: 5 }, targetHeadingDeg: 0, feedback: 'measurement', actuators: { shafts: [{ speed_reference_rad_s: 5, azimuth_rad: 0, enabled: true }], surfaces: [{ angle_rad: 0, enabled: true }] } };
        let baseFrame = { timeS: 0 } as VesselSessionFrame;

        if (step.stepKind === 'run' || entry.adapter.requiresForecast?.(seq)) {
          const native = await createServerVesselSessionWithAssets(config);
          initInput = JSON.parse(native.snapshot()).input ?? initInput;
          baseFrame = JSON.parse(native.read()) as VesselSessionFrame;
          const pts: VesselTracePoint[] = [];
          let prev = {};
          for (let t = 0; t < 25; t += 1) {
            const fakeFrame = { ...baseFrame, timeS: t } as VesselSessionFrame;
            const cmd = entry.adapter.input(execSeq, settings, initInput, fakeFrame, models, designModelId);
            let frame: VesselSessionFrame;
            try {
              frame = JSON.parse(native.advance(1, JSON.stringify(cmd))) as VesselSessionFrame;
            } catch (err) {
              throw new Error(`${entry.key} step ${seq} t=${t}: ${String(err)} | cmd=${JSON.stringify(cmd).slice(400, 650)}`);
            }
            for (const s of frame.controlSamples) {
              const pt = collectVesselTracePoint(s, prev);
              prev = pt.measurements;
              pts.push(pt);
            }
          }
          const chart = entry.adapter.traceSamples(pts);
          expect(chart.length, `${entry.key} step ${seq} trace`).toBeGreaterThan(0);
          expect(Number.isFinite(pts.at(-1)!.truth.northM)).toBe(true);
          native.free();
        }

        const dur = step.runDurationS ?? 300;
        const extraCount = (entry.key === 'icebreaker' && (seq === 6 || seq === 19)) ? (seq === 6 ? 2 : 3)
          : (entry.key === 'lng' && seq === 11) ? 4
          : (entry.key === 'lng' && [6, 12, 16, 19].includes(seq)) ? (seq === 12 || seq === 19 ? 3 : 2)
          : (entry.key === 'dredger' && [13, 17].includes(seq)) ? 3
          : (entry.key === 'dredger' && [1, 4, 10, 12, 14, 15, 16, 19].includes(seq)) ? 2
          : (entry.key === 'container' && [5, 6, 8, 9, 10, 12, 13, 14, 15, 16, 19].includes(seq)) ? 2
          : (entry.key === 'cruise' && [6, 7, 13].includes(seq)) ? 3
          : (entry.key === 'drilling' && [6, 7, 8, 9, 12, 13, 15, 18, 19].includes(seq)) ? 2
          : 1;
        const runCount = Math.max(step.minimumRuns, extraCount);
        const stepRuns: VesselRunSummary[] = [];
        for (let k = 0; k < runCount; k += 1) {
          const sAlt = { ...settings };
          if (entry.key === 'container') {
            if (seq === 2 || seq === 3) sAlt.loadingRatio = [0.2, 0.6, 0.9][k] ?? 0.6;
            if ([5, 8, 9, 14].includes(seq)) sAlt.loadingRatio = [0.2, 0.9][k] ?? 0.6;
            if (seq === 6) sAlt.initialSpeedMps = [6, 10][k] ?? 8;
            if (seq === 10) sAlt.bumpless = k === 1;
            if (seq === 11) sAlt.kpMultiplier = k === 0 ? 1 : 2;
            if (seq === 12) sAlt.segmentSpeedsMps = k === 0 ? [8, 8, 8, 8] : [7, 8, 9, 8];
            if (seq === 13) sAlt.feedback = k === 0 ? 'water' : 'ground';
            if (seq === 15) sAlt.meanWaveResistanceEnabled = k === 1;
            if (seq === 16) sAlt.filterTauS = k === 0 ? 0.2 : 3;
            if (seq === 18) Object.assign(sAlt, entry.defaultSettings(17), { modelIds: models.map((m) => m.id), kpMultiplier: 2 });
            if (seq === 19) Object.assign(sAlt, entry.defaultSettings(17), { modelIds: models.map((m) => m.id), validationSeed: [17, 29][k] ?? 17 });
          } else if (entry.key === 'cruise') {
            if (seq === 6) { sAlt.resonanceRatio = [0.7, 1, 1.3][k] ?? 1; sAlt.finsEnabled = false; sAlt.identifiedPeriodS = (2 * Math.PI) / 0.42; }
            if (seq === 7) sAlt.speedMps = [0, 2, 8][k] ?? 0;
            if (seq === 9) sAlt.finsEnabled = k === 1;
            if (seq === 10) sAlt.dampingRatio = [0.3, 0.7][k] ?? 0.5;
            if (seq === 12) sAlt.headingRampS = [40, 80][k] ?? 40;
            if (seq === 13) sAlt.speedMps = [4, 8, 10][k] ?? 8;
            if (seq === 14) sAlt.lowPassCutoffHz = [0.15, 0.6][k] ?? 0.3;
            if (seq === 15) sAlt.notchEnabled = k === 1;
            if (seq === 17) Object.assign(sAlt, entry.defaultSettings(16), { dampingRatio: 0.7 });
            if (seq === 18) Object.assign(sAlt, entry.defaultSettings(16));
            if (seq === 19) Object.assign(sAlt, entry.defaultSettings(16), { faultStrategy: settings.faultStrategy });
          } else if (entry.key === 'drilling') {
            if (seq === 3) sAlt.excitationAxis = (['x', 'y', 'yaw'] as const)[k];
            if (seq === 6) sAlt.bandwidthRadS = k === 0 ? 0.015 : 0.04;
            if (seq === 7) sAlt.decoupling = k === 1;
            if (seq === 8) sAlt.integralEnabled = k === 1;
            if (seq === 9) sAlt.windFeedforward = k === 1;
            if (seq === 11) Object.assign(sAlt, entry.defaultSettings(10));
            if (seq === 12) sAlt.feedback = k === 0 ? 'raw' : 'low_frequency';
            if (seq === 13) sAlt.allocation = k === 0 ? 'pseudoinverse' : 'sequential_convex';
            if (seq === 14) sAlt.energyWeight = k === 0 ? 0.5 : 2;
            if (seq === 15) sAlt.reallocate = k === 1;
            if (seq === 17) sAlt.navigationLossStrategy = k === 0 ? 'predict' : 'safe_exit';
            if (seq === 18) sAlt.windSpeedMps = [8, 18][k] ?? 8;
            if (seq === 19) Object.assign(sAlt, entry.defaultSettings(16), { validationSeed: [17, 29][k] ?? 17 });
          } else if (entry.key === 'lng') {
            if (seq === 6) sAlt.reverseFraction = [0.3, 0.6][k] ?? 0.3;
            if (seq === 9) sAlt.brakingDistanceM = [800, 1200][k] ?? 1200;
            if (seq === 10) sAlt.antiWindup = k === 1;
            if (seq === 11) { sAlt.additionalCommandDelayS = k < 2 ? 0 : 5; sAlt.smithEnabled = k % 2 === 1; }
            if (seq === 12 || seq === 14) sAlt.loadingRatio = [0.3, 0.7, 0.95][k] ?? 0.85;
            if (seq === 13 || seq === 15) sAlt.headingRampS = [5, 20][k] ?? 20;
            if (seq === 16) Object.assign(sAlt, entry.defaultSettings(8), { kpMultiplier: k === 0 ? entry.defaultSettings(8).kpMultiplier : 1.5 });
            if (seq === 17) sAlt.filterTauS = [0.2, 3][k] ?? 0.2;
            if (seq === 19) Object.assign(sAlt, entry.defaultSettings(18), { validationSeed: [17, 29, 29][k] ?? 17, ...(k === 2 ? { kpMultiplier: 1.5 } : {}) });
          } else if (entry.key === 'icebreaker') {
            if (seq === 1) sAlt.iceThicknessM = k === 0 ? 0 : 1.2;
            if (seq === 5) sAlt.kpMultiplier = [1, 1.5][k] ?? 1;
            if (seq === 6) sAlt.initialSpeedMps = [0.5, 4][k] ?? 4;
            if (seq === 7) sAlt.filterTauS = [0.2, 3][k] ?? 0.2;
            if (seq === 12) sAlt.thicknessM = [0.3, 0.6, 0.9][k] ?? 0.6;
            if (seq === 13) sAlt.strengthMpa = [0.35, 0.65][k] ?? 0.5;
            if (seq === 14) { sAlt.scheduling = k === 1; sAlt.iceModelId = 'ice-hull-level'; }
            if (seq === 15) sAlt.rampS = [10, 60][k] ?? 10;
            if (seq === 16) sAlt.initialSpeedMps = [0.5, 1, 1.5][k] ?? 1;
            if (seq >= 14) sAlt.iceModelId = 'ice-hull-level';
            if (seq === 18) Object.assign(sAlt, entry.defaultSettings(17), { iceModelId: 'ice-hull-level', kpMultiplier: 1.5 });
            if (seq === 19) Object.assign(sAlt, entry.defaultSettings(17), { iceModelId: 'ice-hull-level', validationSeed: [17, 29, 17][k] ?? 17, jamFault: k === 2 });
          } else if (entry.key === 'dredger') {
            if (seq === 1) sAlt.soil = k === 0 ? 'sand' : 'clay';
            if (seq === 4) sAlt.manualCable = k === 0 ? 'port' : 'starboard';
            if (seq === 10) sAlt.kpMultiplier = [1, 1.5][k] ?? 1;
            if (seq === 12) sAlt.targetDepthM = [20.3, 20.5][k] ?? 20.3;
            if (seq === 13) sAlt.reversalRampS = [5, 15, 30][k] ?? 5;
            if (seq === 14) sAlt.integralPolicy = ['track', 'reset'][k] ?? 'track';
            if (seq === 15) sAlt.kpMultiplier = [1, 1.5][k] ?? 1;
            if (seq === 16) sAlt.wavesEnabled = k === 1;
            if (seq === 17) sAlt.entryHoldS = [5, 10, 20][k] ?? 10;
            if (seq === 19) Object.assign(sAlt, entry.defaultSettings(17), { validationSeed: [17, 29][k] ?? 17 });
          }

          const cfg = entry.adapter.configuration(execSeq, sAlt);
          const cmd = entry.adapter.input(execSeq, sAlt, initInput, { ...baseFrame, timeS: 30 } as VesselSessionFrame, models, designModelId);
          const runSeq = seq === 20 ? k + 1 : seq;
          const run = makeSummary(`${entry.key}-${seq}-${k}`, runSeq, dur, cfg, cmd, {
            createdAtMs: 1000 + seq * 1000 + k,
            finalInput: cmd,
            designStudentModelId: designModelId,
            courseSettings: sAlt,
            ...(entry.key === 'dredger' && seq === 18 ? {
              dredgerModeEvents: [
                { timeS: 151, kind: 'mode_CutSwing', component: 0 },
                { timeS: 180, kind: 'cable_break', component: 1 },
                { timeS: 180.05, kind: 'mode_PauseCut', component: 0 },
              ],
            } : {}),
          });
          stepRuns.push(run);
        }
        if (seq !== 20 && step.stepKind === 'run') historyRuns.push(...stepRuns);
        const allForStep = seq === 20 ? historyRuns : [...historyRuns, ...stepRuns];
        const refRun = entry.key === 'lng' && seq === 7
          ? makeSummary('lng-8-future', 8, 600, entry.adapter.configuration(8, settings), stepRuns[0].initialInput, { createdAtMs: 40000 })
          : stepRuns[0];
        if (entry.key === 'lng' && seq === 7) allForStep.push(refRun);
        const comps: DestroyerComparisonEvidence[] = [refRun, ...stepRuns].flatMap((run, idx) => [
          makeComparison(`${entry.key}-cmp-${seq}-${idx}-f`, run.id, designModelId, 'independent_closed_loop', models[1]?.id ?? null, 'forecast', run.initialInput),
          makeComparison(`${entry.key}-cmp-${seq}-${idx}-c`, run.id, designModelId, 'command_to_output', models[1]?.id ?? null, 'validation', run.initialInput),
          makeComparison(`${entry.key}-cmp-${seq}-${idx}-h`, run.id, designModelId, 'hull_model', models[1]?.id ?? null, 'validation', run.initialInput),
          makeComparison(`${entry.key}-cmp-${seq}-${idx}-l`, run.id, designModelId, 'independent_closed_loop', models[1]?.id ?? null, 'validation', run.initialInput),
        ]);
        historyComparisons.push(...comps);
        const allComps = seq === 20 ? historyComparisons : [...historyComparisons, ...comps];
        const answers = defaultAnswersForStep(entry.experimentSteps[seq - 1], seq);
        const err = entry.adapter.validateEvidence(step, {
          runs: allForStep,
          models: models as DestroyerModelEvidence[],
          comparisons: allComps,
          answers,
        });
        expect(err, `${entry.key} step ${seq}`).toBeNull();
        validatedCount += 1;
        if (step.requiredArtifacts.includes('prediction')) {
          const missing = entry.adapter.validateEvidence(step, {
            runs: allForStep,
            models: models as DestroyerModelEvidence[],
            comparisons: allComps,
            answers: { ...answers, prediction: '' },
          });
          expect(missing, `${entry.key} step ${seq} missing prediction`).not.toBeNull();
        }
      }
    expect(validatedCount).toBe(20);
  }, 240000);
});
