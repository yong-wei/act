// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { VESSEL_REPORT_SECTION_LABELS } from '@/features/ilab/course-artifact-contract';
import {
  listFrozenStudentModels,
  listModelComparisons,
  readRunEvidence,
  saveFrozenStudentModel,
  saveModelComparison,
} from '@/features/simulations/local-evidence-store';
import type {
  StepInterpretationSpec,
  StepObservationSpec,
  StepPredictionSpec,
  StepSketchSpec,
  VesselStep,
} from '../simulations/vessel-experiment';
import { DESTROYER_CURRENT_STEPS, DESTROYER_CURVE_SERIES } from '../simulations/destroyer-experiment';
import { DestroyerStepForm } from '../simulations/destroyer-experiment-panels';
import { SketchPad } from '../simulations/sketch-pad';
import { LNG_COURSE_EXPERIMENT } from '../experiments/lng-experiment';
import { lngCourseDefaultSettings } from '../experiments/lng-course';
import { LngCourseControls } from '../experiments/lng-course-controls';
import { icebreakerCourseExperiment } from '../experiments/icebreaker-experiment';
import { icebreakerDefaultSettings } from '../experiments/icebreaker-course';
import { IcebreakerCourseControls } from '../experiments/icebreaker-course-controls';
import { dredgerCourseExperiment } from '../experiments/dredger-experiment';
import { dredgerDefaultSettings } from '../experiments/dredger-course';
import { DredgerCourseControls } from '../experiments/dredger-course-controls';
import { buildSketchCoordinateTemplate } from '../experiments/sketch-coordinate-templates';
import type { FrozenVesselStudentModel } from '../experiments/student-analysis';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';

vi.mock('@/features/simulations/local-evidence-store', () => ({
  listFrozenStudentModels: vi.fn().mockResolvedValue([]),
  listModelComparisons: vi.fn().mockResolvedValue([]),
  readRunEvidence: vi.fn().mockResolvedValue(undefined),
  saveFrozenStudentModel: vi.fn(),
  saveModelComparison: vi.fn(),
}));

const mountedRoots: Root[] = [];
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
}

beforeAll(() => {
  const noop = () => undefined;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({
      clearRect: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      stroke: noop,
      arc: noop,
      fill: noop,
      fillRect: noop,
      strokeRect: noop,
      scale: noop,
      save: noop,
      restore: noop,
      setLineDash: noop,
      fillText: noop,
      measureText: () => ({ width: 20 }),
      canvas: { width: 480, height: 240 },
    })),
  });
});

function mount(node: React.ReactElement): HTMLDivElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => {
    root.render(node);
  });
  return host;
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop()!;
    act(() => root.unmount());
  }
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.mocked(listFrozenStudentModels).mockResolvedValue([]);
  vi.mocked(listModelComparisons).mockResolvedValue([]);
  vi.mocked(readRunEvidence).mockResolvedValue(undefined);
  vi.mocked(saveFrozenStudentModel).mockResolvedValue(0 as never);
  vi.mocked(saveModelComparison).mockResolvedValue(0 as never);
});

const FORBIDDEN_CODES = /\b(?:P0|V1|V2|E1|N0|N1|C1|W1|W2|F2|5run|6run|zeta_d|DP3|seed17|seed29|Rust|WASM)\b|manoeuvring[–-]roll|T级/i;

function collectLearnerTexts(step: {
  goal?: string;
  watch?: string;
  suggestion?: string;
  actionSteps?: readonly string[];
  conditionText?: string;
  fields: readonly { label: string; choices?: readonly string[]; unit?: string }[];
  predictionSpec?: StepPredictionSpec;
  observationSpec?: StepObservationSpec;
  interpretationSpec?: StepInterpretationSpec;
  sketchSpec?: StepSketchSpec;
}): string[] {
  const texts: string[] = [];
  const push = (value: string | undefined) => {
    if (value && value.trim()) texts.push(value);
  };
  push(step.goal);
  push(step.watch);
  push(step.suggestion);
  push(step.conditionText);
  step.actionSteps?.forEach(push);
  for (const field of step.fields) {
    push(field.label);
    push(field.unit);
    field.choices?.forEach(push);
  }
  if (step.predictionSpec) {
    push(step.predictionSpec.prompt);
    push(step.predictionSpec.placeholder);
    step.predictionSpec.options?.forEach((o) => {
      push(o.label);
      push(o.detail);
    });
  }
  if (step.observationSpec) {
    push(step.observationSpec.prompt);
    push(step.observationSpec.summaryPlaceholder);
    step.observationSpec.slots?.forEach((slot) => {
      push(slot.label);
      push(slot.conditionHint);
      slot.metrics.forEach((m) => {
        push(m.label);
        push(m.unit);
        push(m.placeholder);
      });
    });
    step.observationSpec.metrics?.forEach((m) => {
      push(m.label);
      push(m.unit);
      push(m.placeholder);
    });
  }
  if (step.interpretationSpec) {
    push(step.interpretationSpec.prompt);
    push(step.interpretationSpec.placeholder);
    step.interpretationSpec.guidingQuestions?.forEach(push);
  }
  if (step.sketchSpec) {
    push(step.sketchSpec.label);
    push(step.sketchSpec.hint);
  }
  return texts;
}

function makeNomotoModel(id = 'destroyer-hull-1'): FrozenVesselStudentModel {
  return {
    id,
    scopeKey: 'destroyer:test',
    label: '055 一阶航向模型',
    channel: 'rudder-to-yaw',
    createdAtMs: 1000,
    serverId: null,
    contentHash: null,
    payload: {
      experimentKey: 'destroyer-course',
      lineageKey: 'step-4',
      structure: { kind: 'nomoto1', k: 0.085, t_s: 26 },
      ioContract: { inputChannel: 'SurfaceEncoder0', outputChannel: 'YawRate', inputUnit: '°', outputUnit: '°/s' },
      operatingPoint: { speedMps: 8 },
      identification: { algorithm: 'oe_lsq', settings: { trainingFitPercent: 95.1 }, identifiedOk: true, residualRms: 0.01 },
      trainingRuns: [{ runRef: 'run-4', startS: 20, endS: 180 }],
      validationRuns: [],
      sampleDt: 0.2,
    },
  };
}

function makeSession<T>(seq: number, settings: T, extra?: Partial<VesselExperimentController<T>['course']>): VesselExperimentController<T> {
  return {
    activeSeq: seq,
    busy: false,
    tour: { active: false },
    course: {
      ready: true,
      running: false,
      completed: false,
      settings,
      models: [],
      comparisons: [],
      runs: [],
      reportRunIds: [],
      designModelId: '',
      actuatorModelId: '',
      setSettings: vi.fn(),
      setDesignModelId: vi.fn(),
      setActuatorModelId: vi.fn(),
      freezePrediction: vi.fn(),
      read: () => null,
      ...extra,
    },
  } as unknown as VesselExperimentController<T>;
}

describe('vsim-step-workbench Phase 2 契约与界面验证', () => {
  const destroyerStepsAsVessel = DESTROYER_CURRENT_STEPS.map((s) => ({
    ...s,
    fields: s.fields.map((f) => ({ key: f.key, label: f.label, kind: f.kind as 'number' | 'choice' | 'text', unit: f.unit, choices: f.choices })),
  }));
  const destroyerSeriesIds = new Set<string>(DESTROYER_CURVE_SERIES.map((s) => s.id));

  const phase2Vessels = [
    { key: 'destroyer', name: '055 驱逐舰', steps: destroyerStepsAsVessel as unknown as VesselStep[], seriesIds: destroyerSeriesIds },
    { key: 'lng', name: 'LNG 船', steps: LNG_COURSE_EXPERIMENT.steps, seriesIds: new Set(LNG_COURSE_EXPERIMENT.series.map((s) => s.id)) },
    { key: 'icebreaker', name: '雪龙 2 破冰船', steps: icebreakerCourseExperiment.steps, seriesIds: new Set(icebreakerCourseExperiment.series.map((s) => s.id)) },
    { key: 'dredger', name: '天鲸号挖泥船', steps: dredgerCourseExperiment.steps, seriesIds: new Set(dredgerCourseExperiment.series.map((s) => s.id)) },
  ];

  it('后四船全部 80 步具备四段式任务书、结构化三段表单、有效通道与清洁学生文案', () => {
    const reportKeys = Object.keys(VESSEL_REPORT_SECTION_LABELS);
    let totalSteps = 0;

    for (const vessel of phase2Vessels) {
      expect(vessel.steps).toHaveLength(20);
      for (const step of vessel.steps) {
        totalSteps += 1;
        expect(step.goal.trim().length).toBeGreaterThan(0);
        expect(step.watch.trim().length).toBeGreaterThan(0);
        expect(step.goal).not.toBe(step.watch);
        expect((step.actionSteps ?? []).length).toBeGreaterThanOrEqual(2);
        expect((step.conditionText ?? '').trim().length).toBeGreaterThan(0);
        expect(step.suggestion.trim().length).toBeGreaterThan(0);

        if (step.seq < 20) {
          const isDestroyerAnalysis = vessel.key === 'destroyer' && [4, 8].includes(step.seq);
          if (!isDestroyerAnalysis) expect(step.predictionSpec, `${vessel.key} step ${step.seq} predictionSpec`).toBeDefined();
          expect(step.observationSpec, `${vessel.key} step ${step.seq} observationSpec`).toBeDefined();
          expect(step.interpretationSpec, `${vessel.key} step ${step.seq} interpretationSpec`).toBeDefined();
        } else {
          const keys = step.fields.map((f) => f.key);
          for (const rk of reportKeys) expect(keys).toContain(rk);
        }

        const metrics = [
          ...(step.observationSpec?.metrics ?? []),
          ...(step.observationSpec?.slots?.flatMap((slot) => slot.metrics) ?? []),
        ];
        for (const metric of metrics) {
          if (metric.seriesId) {
            expect(vessel.seriesIds.has(metric.seriesId)).toBe(true);
          }
        }

        if (step.sketchSpec) {
          const tpl = buildSketchCoordinateTemplate(step.sketchSpec.plotId);
          expect(tpl.plotArea.right - tpl.plotArea.left).toBeGreaterThanOrEqual(200);
          expect(tpl.plotArea.bottom - tpl.plotArea.top).toBeGreaterThanOrEqual(100);
          expect(tpl.bounds.xTicks.length).toBeGreaterThanOrEqual(2);
          expect(tpl.bounds.yTicks.length).toBeGreaterThanOrEqual(2);
        }

        for (const text of collectLearnerTexts(step)) {
          expect(text).not.toMatch(FORBIDDEN_CODES);
        }
      }
    }
    expect(totalSteps).toBe(80);
  });

  it('DredgerCourseControls 按步隔离步 1 锁参、步 15 导入静水基线、步 18 应急防抖、步 19 盲测锁控', () => {
    const s1 = mount(<DredgerCourseControls session={makeSession(1, dredgerDefaultSettings(1))} timeS={0} />);
    expect(s1.textContent).toMatch(/无需调节参数|锁定/);
    expect(s1.textContent).not.toContain('比例增益倍率');

    const calmRun = {
      id: 'dredger-run-14',
      scopeKey: 'dredger:test',
      courseVersion: 'seven-vessel-2026.11.14',
      stepSequence: 14,
      createdAtMs: 1000,
      stoppedAtMs: 2000,
      lastTimeS: 200,
      durationS: 200,
      stopReason: 'duration',
      courseSettings: dredgerDefaultSettings(14),
    };
    const s15 = mount(<DredgerCourseControls session={makeSession(15, dredgerDefaultSettings(15), { runs: [calmRun as never] })} timeS={0} />);
    expect(s15.textContent).toContain('静水');

    const s18 = mount(<DredgerCourseControls session={makeSession(18, dredgerDefaultSettings(18))} timeS={0} />);
    expect(s18.textContent).toMatch(/提前中止阈值|积分策略|只读锁定/);
    expect(s18.textContent).not.toMatch(FORBIDDEN_CODES);

    const s19 = mount(<DredgerCourseControls session={makeSession(19, dredgerDefaultSettings(19))} timeS={0} />);
    expect(s19.textContent).toMatch(/盲测|锁定|不可/);
  });

  it('IcebreakerCourseControls 隔离步 3/7/18/19 滤波与积分控件并屏蔽内部代号', () => {
    const s3 = mount(<IcebreakerCourseControls session={makeSession(3, icebreakerDefaultSettings(3))} timeS={0} />);
    expect(s3.textContent).not.toContain('量测滤波');

    const s7 = mount(<IcebreakerCourseControls session={makeSession(7, icebreakerDefaultSettings(7))} timeS={0} />);
    expect(s7.textContent).toContain('滤波');

    const s18Off = mount(
      <IcebreakerCourseControls
        session={makeSession(18, { ...icebreakerDefaultSettings(18), integralEnabled: false })}
        timeS={0}
      />,
    );
    expect(s18Off.textContent).not.toContain('积分时间');

    const s18On = mount(
      <IcebreakerCourseControls
        session={makeSession(18, { ...icebreakerDefaultSettings(18), integralEnabled: true })}
        timeS={0}
      />,
    );
    expect(s18On.textContent).toContain('积分时间');

    const s19 = mount(<IcebreakerCourseControls session={makeSession(19, icebreakerDefaultSettings(19))} timeS={0} />);
    expect(s19.textContent).toMatch(/未见|检验/);
    expect(s19.textContent).not.toMatch(FORBIDDEN_CODES);
  });

  it('LngCourseControls 按步隔离步 2/3/6/12/13/17/19 控件并保持纯中文未见工况', () => {
    const s2 = mount(<LngCourseControls session={makeSession(2, lngCourseDefaultSettings(2))} timeS={0} />);
    expect(s2.textContent).toContain('轴速参考阶跃');

    const s3 = mount(<LngCourseControls session={makeSession(3, lngCourseDefaultSettings(3))} timeS={0} />);
    expect(s3.textContent).toContain('评估');

    const s6 = mount(<LngCourseControls session={makeSession(6, lngCourseDefaultSettings(6))} timeS={0} />);
    expect(s6.textContent).toContain('反车额定转速比例');

    const s12 = mount(<LngCourseControls session={makeSession(12, lngCourseDefaultSettings(12))} timeS={0} />);
    expect(s12.textContent).toContain('液舱填充率');

    const s13 = mount(<LngCourseControls session={makeSession(13, lngCourseDefaultSettings(13))} timeS={0} />);
    expect(s13.textContent).toContain('转向斜坡');

    const s17 = mount(<LngCourseControls session={makeSession(17, lngCourseDefaultSettings(17))} timeS={0} />);
    expect(s17.textContent).toContain('航速量测滤波');

    const s19 = mount(<LngCourseControls session={makeSession(19, lngCourseDefaultSettings(19))} timeS={0} />);
    expect(s19.textContent).toContain('未见工况');
    expect(s19.textContent).not.toMatch(FORBIDDEN_CODES);
  });

  it('055 DestroyerStepForm 步 8 叠加学生模型解析参考且步 20 渲染六段式报告工作台', () => {
    const step8 = DESTROYER_CURRENT_STEPS[7];
    const nomoto = makeNomotoModel();
    const s8Host = mount(
      <DestroyerStepForm
        step={step8}
        readings={{ prediction: '预测文字', observation: '模型特征整理完成。', interpretation: '说明完整因果。' }}
        message=""
        busy={false}
        reportEnabled={false}
        studentModel={nomoto}
        models={[nomoto]}
        comparisons={[]}
        runs={[]}
        samples={[]}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onReport={vi.fn()}
        onAsk={vi.fn()}
      />,
    );
    expect(s8Host.textContent).toContain('叠合本人冻结模型的解析特征线');
    expect(s8Host.querySelector('canvas')).not.toBeNull();
    expect(s8Host.querySelector('svg')).not.toBeNull();

    const step20 = DESTROYER_CURRENT_STEPS[19];
    const s20Host = mount(
      <DestroyerStepForm
        step={step20}
        readings={{}}
        message=""
        busy={false}
        reportEnabled
        studentModel={nomoto}
        models={[nomoto]}
        comparisons={[]}
        runs={[]}
        samples={[]}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onReport={vi.fn()}
        onAsk={vi.fn()}
      />,
    );
    for (const label of Object.values(VESSEL_REPORT_SECTION_LABELS)) {
      expect(s20Host.textContent).toContain(label);
    }
    expect(s20Host.textContent).toMatch(/自检|量规|证据胶囊/);
  });

  it('SketchPad 配合步 8 坐标系模板渲染刻度标签与绘制画布', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        sketchKind: 'bode',
        sketchBlank: '0',
        sketchEvaluation: 'ok',
        featureChecks: [{ label: '转折频率位置合理', passed: true }],
      }),
    } as unknown as Response);
    const tpl = buildSketchCoordinateTemplate('bode');
    const host = mount(
      <SketchPad
        label="手绘模型伯德图特征"
        hint="请标出转折频率与高频衰减斜率"
        defaultPlotId="bode"
        lockPlotId
        value="data:image/png;base64,iVBORw0KGgo="
        coordinateOverride={tpl}
        studentModel={makeNomotoModel()}
        onChange={vi.fn()}
      />,
    );
    expect(host.querySelector('canvas')).not.toBeNull();
    expect(host.querySelector('svg')?.textContent).toContain('0');
    const recognizeBtn = host.querySelector('[data-sketch-recognize]') as HTMLButtonElement | null;
    expect(recognizeBtn).not.toBeNull();
    await act(async () => {
      recognizeBtn!.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain('叠加本人模型参考特征');
  });
});
