// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { preloadServerControlEngine } from '@/lib/control-engine/wasm-server';
import { preloadVirtualSimulationRuntime } from '../physics/simulation-engine-facade';

import {
  listFrozenStudentModels,
  listModelComparisons,
  readRunEvidence,
  saveFrozenStudentModel,
  saveModelComparison,
  type VesselRunSummary,
} from '@/features/simulations/local-evidence-store';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import * as studentAnalysis from '../experiments/student-analysis';
import * as dpStudentAnalysis from '../experiments/dp-student-analysis';
import { VesselModelWorkbench } from '../experiments/model-workbench';
import { DpModelWorkbench } from '../experiments/dp-model-workbench';
import { clearWorkbenchStateCache } from '../experiments/workbench-state-cache';
import { buildSketchAnalyticalOverlay } from '../experiments/sketch-analytical-overlay';
import { buildSketchCoordinateTemplate } from '../experiments/sketch-coordinate-templates';
import { CONTAINER_COURSE_EXPERIMENT } from '../experiments/container-experiment';
import { cruiseCourseExperiment } from '../experiments/cruise-experiment';
import { DRILLING_COURSE_EXPERIMENT } from '../experiments/drilling-experiment';
import { ContainerCourseControls } from '../experiments/container-course-controls';
import { CruiseCourseControls } from '../experiments/cruise-course-controls';
import { DrillingCourseControls } from '../experiments/drilling-course-controls';
import { CruiseRollDesign } from '../experiments/cruise-roll-design';
import { containerCourseDefaultSettings } from '../experiments/container-course';
import { cruiseCourseDefaultSettings } from '../experiments/cruise-course';
import { drillingCourseDefaultSettings } from '../experiments/drilling-course';
import type { FrozenVesselStudentModel } from '../experiments/student-analysis';
import { SketchPad } from '../simulations/sketch-pad';
import { VesselStepForm } from '../simulations/vessel-experiment-panels';
import { resolveActiveObservationSlotKey, StepObservationStage, StepPredictionStage } from '../simulations/vessel-step-structured-fields';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';

vi.mock('@/features/simulations/local-evidence-store', () => ({
  listFrozenStudentModels: vi.fn().mockResolvedValue([]),
  listModelComparisons: vi.fn().mockResolvedValue([]),
  readRunEvidence: vi.fn().mockResolvedValue(null),
  saveFrozenStudentModel: vi.fn(),
  saveModelComparison: vi.fn(),
}));

const mountedRoots: Root[] = [];
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
}

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
  clearWorkbenchStateCache();
  vi.restoreAllMocks();
  vi.mocked(listFrozenStudentModels).mockResolvedValue([]);
  vi.mocked(listModelComparisons).mockResolvedValue([]);
  vi.mocked(readRunEvidence).mockResolvedValue(undefined);
  vi.mocked(saveFrozenStudentModel).mockResolvedValue(0 as never);
  vi.mocked(saveModelComparison).mockResolvedValue(0 as never);
});

beforeAll(async () => {
  preloadServerControlEngine();
  await preloadVirtualSimulationRuntime();
}, 30000);

const FORBIDDEN_CODES = /\b(?:P0|V1|V2|E1|N1|C1|W1|F2|5run|6run|zeta_d|DP3|seed17|seed29)\b|manoeuvring[–-]roll|\b(?:Rust|WASM)\b/i;

function makeRollModel(): FrozenVesselStudentModel {
  return {
    id: 'cruise-roll-1',
    scopeKey: 'cruise:round-1',
    courseVersion: 'seven-vessel-2026.11.14',
    channel: 'fin-to-roll',
    label: '邮轮横摇振子模型',
    createdAtMs: 1000,
    payload: {
      experimentKey: 'cruise',
      lineageKey: 'fixture',
      structure: { kind: 'roll_oscillator', natural_freq_rad_s: 0.32, damping: 0.08, control_gain: 0.015 },
      ioContract: { inputChannel: 'FinDifferential', outputChannel: 'EstimatedRoll', inputUnit: '°', outputUnit: '°' },
      operatingPoint: { speedMps: 8, rollInertiaKgM2: 3.8e8 },
      identification: { algorithm: 'oe_lsq', settings: {}, identifiedOk: true, residualRms: 0.04 },
      trainingRuns: [{ runRef: 'run-2', startS: 10, endS: 120 }, { runRef: 'run-3', startS: 20, endS: 140 }],
      validationRuns: [],
      sampleDt: 0.2,
    },
  };
}

describe('1. 七船共用评估工作台与空态防回退（Phase 1）', () => {
  it('集装箱船、LNG 与天鲸号在空运行/空模型时不显示「冻结的舵机模型」且展示前置指引', async () => {
    for (const [courseKey, channel, hintSnippet] of [
      ['container', 'shaft-reference-to-speed', '先在第 3 步'],
      ['lng', 'shaft-reference-to-speed', '第 2 步'],
      ['dredger', 'winch-reference-to-sway', '第 5 步'],
    ] as const) {
      const host = mount(
        <VesselModelWorkbench
          scopeKey={`${courseKey}:round-1`}
          runs={[]}
          onArtifactsChange={vi.fn()}
          courseKey={courseKey}
          stepSequence={courseKey === 'dredger' ? 5 : 3}
          defaultChannel={channel}
        />,
      );
      await act(async () => {
        await Promise.resolve();
      });
      const channelSelect = host.querySelector('select[aria-label="辨识量测通道"]') as HTMLSelectElement | null;
      const optionValues = channelSelect ? Array.from(channelSelect.options).map((o) => o.value) : [];
      expect(optionValues).not.toContain('rudder-to-yaw');
      expect(optionValues).not.toContain('rudder-servo');
      expect(host.textContent).not.toContain('冻结的舵机模型');
      expect(host.textContent).toContain(hintSnippet);
    }

    const containerStep2 = mount(
      <VesselModelWorkbench
        scopeKey="container:round-1"
        runs={[]}
        onArtifactsChange={vi.fn()}
        courseKey="container"
        stepSequence={2}
        defaultChannel="shaft-reference-to-speed"
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(containerStep2.textContent).toContain('本步仅对比不同装载下的真实物理参数');
    expect(Array.from(containerStep2.querySelectorAll('button')).some((b) => b.textContent?.includes('辨识并冻结模型'))).toBe(false);
  });

  it('邮轮与雪龙 2 无运行记录时不回退舵角通道，并按步隔离自由衰减/吊舱伺服与验证步骤', async () => {
    const cruiseStep2 = mount(
      <VesselModelWorkbench scopeKey="cruise:r1" runs={[]} onArtifactsChange={vi.fn()} courseKey="cruise" stepSequence={2} defaultChannel="fin-to-roll" />,
    );
    await act(async () => { await Promise.resolve(); });
    const cruiseSelect = cruiseStep2.querySelector('select[aria-label="辨识量测通道"]') as HTMLSelectElement;
    expect(cruiseSelect.value).toBe('fin-to-roll');
    expect(cruiseStep2.querySelector('select[aria-label="自由衰减运行记录"]')).toBeNull();

    const cruiseStep3 = mount(
      <VesselModelWorkbench scopeKey="cruise:r1" runs={[]} onArtifactsChange={vi.fn()} courseKey="cruise" stepSequence={3} defaultChannel="fin-to-roll" />,
    );
    await act(async () => { await Promise.resolve(); });
    expect(cruiseStep3.querySelector('select[aria-label="自由衰减运行记录"]')).not.toBeNull();

    const cruiseStep4 = mount(
      <VesselModelWorkbench scopeKey="cruise:r1" runs={[]} onArtifactsChange={vi.fn()} courseKey="cruise" stepSequence={4} defaultChannel="fin-to-roll" />,
    );
    await act(async () => { await Promise.resolve(); });
    expect(cruiseStep4.textContent).not.toContain('辨识并冻结模型');
    expect(cruiseStep4.textContent).toContain('运行独立对照');

    const iceStep4 = mount(
      <VesselModelWorkbench scopeKey="icebreaker:r1" runs={[]} onArtifactsChange={vi.fn()} courseKey="icebreaker" stepSequence={4} defaultChannel="azimuth-to-yaw" />,
    );
    await act(async () => { await Promise.resolve(); });
    expect(iceStep4.textContent).not.toContain('实际舵角 → 转艏速率');
    expect(iceStep4.textContent).not.toContain('辨识并冻结模型');
    const modeSelect = iceStep4.querySelector('select[aria-label="模型对照方式"]') as HTMLSelectElement;
    await act(async () => {
      modeSelect.value = 'command_to_output';
      modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(iceStep4.textContent).toContain('冻结的吊舱伺服模型');
    expect(iceStep4.textContent).not.toContain('冻结的舵机模型');

    const desStep4 = mount(
      <VesselModelWorkbench scopeKey="destroyer:r1" runs={[]} onArtifactsChange={vi.fn()} courseKey="destroyer" stepSequence={4} defaultChannel="rudder-to-yaw" />,
    );
    await act(async () => { await Promise.resolve(); });
    expect(desStep4.textContent).toContain('辨识并冻结模型');
    expect(desStep4.textContent).not.toContain('运行独立对照');
  });

  it('集装箱第 3 步与 981 第 4 步切换评估/控制页签重挂载后保留辨识状态，修改条件后提示重新辨识', async () => {
    const setNativeInputValue = (input: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const run3Summary = {
      id: 'run-container-step3',
      scopeKey: 'container:persist',
      courseVersion: 'seven-vessel-2026.11.14',
      stepSequence: 3,
      createdAtMs: 1000,
      stoppedAtMs: 2000,
      lastTimeS: 600,
      durationS: 600,
      sampleCount: 300,
      stopReason: 'duration',
      configuration: { loadingRatio: 0.6, initialWaterSpeedMps: 8 },
      initialInput: { controlMode: 'pd', pid: { kp: 1, ki: 0, kd: 0 }, targetHeadingDeg: 0, feedback: 'measurement', actuators: { shafts: [], surfaces: [] } },
    } as unknown as VesselRunSummary;
    const run3Full = {
      ...run3Summary,
      courseKey: 'container',
      prediction: 'p',
      parameterHash: 'h',
      initialCheckpoint: '{"timeS":0}',
      checkpoint: '{"timeS":0}',
      trace: [],
      nativeSensorSamples: [],
      changes: [],
      failure: null,
    } as unknown as VesselRunEvidence;

    const frozenFopdt: FrozenVesselStudentModel = {
      id: 'model-container-fopdt-1',
      scopeKey: 'container:persist',
      courseVersion: 'seven-vessel-2026.11.14',
      channel: 'shaft-reference-to-speed',
      label: '轴速参考 → 对水航速',
      createdAtMs: 2100,
      payload: {
        experimentKey: 'container-voyage',
        lineageKey: 'step-3',
        structure: { kind: 'fopdt', k: 0.048, t_s: 155, delay_s: 2.5 },
        ioContract: { inputChannel: 'ShaftReference0', outputChannel: 'SpeedLog', inputUnit: 'rpm', outputUnit: 'm/s' },
        operatingPoint: { loadingRatio: 0.6, speedMps: 8, inputOrigin: 55 },
        identification: { algorithm: 'oe_lsq', settings: { trainingFitPercent: 94.2 }, identifiedOk: true, residualRms: 0.0234 },
        trainingRuns: [{ runRef: 'run-container-step3', startS: 20, endS: 500 }],
        validationRuns: [],
        sampleDt: 0.2,
      },
    };

    const storedModels: FrozenVesselStudentModel[] = [];
    vi.mocked(saveFrozenStudentModel).mockImplementation(async (m) => { storedModels.push(m); return 1; });
    vi.mocked(listFrozenStudentModels).mockImplementation(async () => [...storedModels]);
    vi.mocked(readRunEvidence).mockResolvedValue(run3Full);
    vi.spyOn(studentAnalysis, 'identifyVesselStudentModel').mockReturnValue(frozenFopdt);

    const mount1 = document.createElement('div');
    document.body.appendChild(mount1);
    const root1 = createRoot(mount1);
    act(() => {
      root1.render(
        <VesselModelWorkbench
          scopeKey="container:persist"
          runs={[run3Summary]}
          onArtifactsChange={vi.fn()}
          courseKey="container"
          stepSequence={3}
          defaultChannel="shaft-reference-to-speed"
        />,
      );
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    await act(async () => {
      setNativeInputValue(mount1.querySelector('input[aria-label="分析窗口起点"]') as HTMLInputElement, '20');
      setNativeInputValue(mount1.querySelector('input[aria-label="分析窗口终点"]') as HTMLInputElement, '500');
    });

    const idBtn = Array.from(mount1.querySelectorAll('button')).find((b) => b.textContent?.includes('辨识并冻结模型'))!;
    await act(async () => {
      idBtn.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mount1.textContent).toContain('本次辨识模型已冻结');
    expect(mount1.textContent).toContain('0.048');

    // Simulate switching 评估 -> 控制 (unmount) then back 控制 -> 评估 (remount)
    act(() => root1.unmount());
    mount1.remove();

    const mount2 = mount(
      <VesselModelWorkbench
        scopeKey="container:persist"
        runs={[run3Summary]}
        onArtifactsChange={vi.fn()}
        courseKey="container"
        stepSequence={3}
        defaultChannel="shaft-reference-to-speed"
      />,
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect((mount2.querySelector('select[aria-label="分析运行记录"]') as HTMLSelectElement).value).toBe('run-container-step3');
    expect((mount2.querySelector('input[aria-label="分析窗口起点"]') as HTMLInputElement).value).toBe('20');
    expect((mount2.querySelector('input[aria-label="分析窗口终点"]') as HTMLInputElement).value).toBe('500');
    expect((mount2.querySelector('select[aria-label="冻结的学生模型"]') as HTMLSelectElement).value).toBe('model-container-fopdt-1');
    expect(mount2.textContent).toContain('本次辨识模型已冻结');
    expect(mount2.textContent).toContain('94.2%');

    // Modifying a condition clears active identification result status & prompts re-identify
    await act(async () => {
      setNativeInputValue(mount2.querySelector('input[aria-label="分析窗口起点"]') as HTMLInputElement, '35');
    });
    expect((mount2.querySelector('select[aria-label="冻结的学生模型"]') as HTMLSelectElement).value).toBe('');
    expect(mount2.textContent).toContain('辨识条件已修改');

    // Also verify DpModelWorkbench Step 4 preserves freeze result & window across unmount/remount
    const dpModels: FrozenVesselStudentModel[] = [];
    const dpRun = (axis: 'x' | 'y' | 'yaw') => ({
      ...run3Summary,
      id: `dp-${axis}`,
      scopeKey: 'drilling:persist',
      stepSequence: 3,
      lastTimeS: 300,
      durationS: 300,
      courseSettings: { excitationAxis: axis },
    }) as unknown as VesselRunSummary;
    const dpFrozen: FrozenVesselStudentModel = {
      ...frozenFopdt,
      id: 'dp-model-1',
      scopeKey: 'drilling:persist',
      channel: 'dp-low-frequency',
      label: '981 三通道低频模型',
      payload: {
        ...frozenFopdt.payload,
        experimentKey: 'drilling',
        structure: { kind: 'dp_low_freq3', a: [0, 0, 0, 0, 0, 0, 0, 0, 0], b: [1e-4, 0, 0, 0, 1e-4, 0, 0, 0, 1e-6] },
      },
    };
    vi.mocked(saveFrozenStudentModel).mockImplementation(async (m) => { dpModels.push(m); return 1; });
    vi.mocked(listFrozenStudentModels).mockImplementation(async () => [...dpModels]);
    vi.mocked(readRunEvidence).mockResolvedValue({ ...run3Full, scopeKey: 'drilling:persist' });
    vi.spyOn(dpStudentAnalysis, 'identifyDpStudentModel').mockReturnValue(dpFrozen);

    const dpHost1 = document.createElement('div');
    document.body.appendChild(dpHost1);
    const dpRoot1 = createRoot(dpHost1);
    const dpRuns = [dpRun('x'), dpRun('y'), dpRun('yaw')];
    act(() => {
      dpRoot1.render(<DpModelWorkbench scopeKey="drilling:persist" runs={dpRuns} onArtifactsChange={vi.fn()} courseKey="drilling" stepSequence={4} />);
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => {
      setNativeInputValue(dpHost1.querySelector('input[aria-label="分析窗口起点"]') as HTMLInputElement, '25');
      setNativeInputValue(dpHost1.querySelector('input[aria-label="分析窗口终点"]') as HTMLInputElement, '260');
    });
    const dpBtn = Array.from(dpHost1.querySelectorAll('button')).find((b) => b.textContent?.includes('冻结本人三通道模型'))!;
    await act(async () => {
      dpBtn.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(dpHost1.textContent).toContain('本人三通道模型已冻结');
    act(() => dpRoot1.unmount());
    dpHost1.remove();

    const dpHost2 = mount(<DpModelWorkbench scopeKey="drilling:persist" runs={dpRuns} onArtifactsChange={vi.fn()} courseKey="drilling" stepSequence={4} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect((dpHost2.querySelector('input[aria-label="分析窗口起点"]') as HTMLInputElement).value).toBe('25');
    expect((dpHost2.querySelector('input[aria-label="分析窗口终点"]') as HTMLInputElement).value).toBe('260');
    expect((dpHost2.querySelector('select[aria-label="三通道冻结模型"]') as HTMLSelectElement).value).toBe('dp-model-1');
    expect(dpHost2.textContent).toContain('本人三通道模型已冻结');
  });

  it('981 平台 DpModelWorkbench 按第 3/4/5/6 步隔离激励计数、三通道冻结与独立验证', async () => {
    const dp3 = mount(<DpModelWorkbench scopeKey="drilling:r1" runs={[]} onArtifactsChange={vi.fn()} courseKey="drilling" stepSequence={3} />);
    await act(async () => { await Promise.resolve(); });
    expect(dp3.textContent).toContain('纯纵向');
    expect(dp3.textContent).not.toContain('冻结本人三通道模型');

    const dp4 = mount(<DpModelWorkbench scopeKey="drilling:r1" runs={[]} onArtifactsChange={vi.fn()} courseKey="drilling" stepSequence={4} />);
    await act(async () => { await Promise.resolve(); });
    expect(dp4.textContent).toContain('冻结本人三通道模型');
    expect(dp4.textContent).not.toContain('保存独立三通道对照');

    const dp5 = mount(<DpModelWorkbench scopeKey="drilling:r1" runs={[]} onArtifactsChange={vi.fn()} courseKey="drilling" stepSequence={5} />);
    await act(async () => { await Promise.resolve(); });
    expect(Array.from(dp5.querySelectorAll('button')).some((b) => b.textContent?.includes('冻结本人三通道模型'))).toBe(false);
    expect(dp5.textContent).toContain('保存独立三通道对照');

    const dp6 = mount(<DpModelWorkbench scopeKey="drilling:r1" runs={[]} onArtifactsChange={vi.fn()} courseKey="drilling" stepSequence={6} />);
    await act(async () => { await Promise.resolve(); });
    expect(Array.from(dp6.querySelectorAll('button')).some((b) => b.textContent?.includes('冻结本人三通道模型'))).toBe(false);
    expect(Array.from(dp6.querySelectorAll('button')).some((b) => b.textContent?.includes('保存独立三通道对照'))).toBe(false);
  });
});

describe('2. 坐标系多模态 SketchPad、三层隔离与 VLM 上下文', () => {
  it('6 套坐标系均生成网格与标尺，预测草图仅在覆盖层叠合实船轨迹且向 VLM 传递上下文', async () => {
    for (const id of ['nyquist', 'bode', 'root-locus', 'time-response', 'frequency-amplitude', 'planar-envelope'] as const) {
      const tpl = buildSketchCoordinateTemplate(id);
      expect(tpl.bounds.xLabel.length).toBeGreaterThan(0);
      expect(tpl.bounds.yLabel.length).toBeGreaterThan(0);
    }

    const rollOverlay = buildSketchAnalyticalOverlay('frequency-amplitude', makeRollModel());
    expect(rollOverlay.supported).toBe(true);
    expect(rollOverlay.paths.length).toBeGreaterThan(0);

    const drawOps: Array<[number, number]> = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      fillStyle: '#fff',
      strokeStyle: '#000',
      lineWidth: 2,
      lineCap: 'round',
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn((x: number, y: number) => drawOps.push([x, y])),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D));
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => `data:image/png;base64,PURE_${drawOps.length}`);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ sketchKind: 'planar-envelope', sketchBlank: '0', sketchEvaluation: '避碰轨迹接近警戒区。', featureChecks: ['识别 1.5m 黄圈'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const host = mount(
      <SketchPad
        mode="prediction"
        defaultPlotId="planar-envelope"
        lockPlotId
        label="井口安全包络预测草图"
        hint="先绘预期漂移轨迹"
        actualSeries={[{ label: '实测轨迹', color: '#0284c7', points: [{ x: 0, y: 0 }, { x: 1.2, y: 0.8 }] }]}
        context={{ vesselKey: 'drilling', stepSeq: 15, promptFocus: 'T2 断桨轨迹' }}
        onChange={vi.fn()}
      />,
    );
    expect(host.querySelector('[data-sketch-coordinate-layer]')).not.toBeNull();
    expect(host.querySelector('[data-sketch-actual-overlay]')).not.toBeNull();

    const canvas = host.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 420, height: 240, right: 420, bottom: 240, x: 0, y: 0, toJSON: () => '' }) as DOMRect;
    await act(async () => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 60, clientY: 120, bubbles: true }));
      for (let i = 1; i <= 10; i += 1) {
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 60 + i * 10, clientY: 120 - i * 4, buttons: 1, bubbles: true }));
      }
      canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 80, bubbles: true }));
    });
    await act(async () => {
      (host.querySelector('[data-sketch-recognize]') as HTMLButtonElement).click();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(body.context).toMatchObject({ mode: 'prediction', plotId: 'planar-envelope', vesselKey: 'drilling', stepSeq: 15 });
  });
});

describe('3. 核心三船 60 步教学规约与结构化三段论', () => {
  it('集装箱船、邮轮、981 平台全部 60 步目标≠观察、含操作步骤且无内部缩写泄露', () => {
    for (const exp of [CONTAINER_COURSE_EXPERIMENT, cruiseCourseExperiment, DRILLING_COURSE_EXPERIMENT]) {
      expect(exp.steps).toHaveLength(20);
      expect(exp.steps.reduce((sum, s) => sum + s.maxPoints, 0)).toBe(100);
      for (const step of exp.steps) {
        expect(step.goal.trim().length).toBeGreaterThan(4);
        expect(step.watch.trim()).not.toBe(step.goal.trim());
        expect(step.actionSteps?.length ?? 0).toBeGreaterThanOrEqual(2);
        const corpus = [step.title, step.goal, step.watch, step.conditionText ?? '', step.suggestion, ...(step.actionSteps ?? [])].join('\n');
        expect(corpus, `${exp.key} step ${step.seq}`).not.toMatch(FORBIDDEN_CODES);
      }
    }
  });

  it('StepPredictionStage 跑前可交互、跑后锁定，StepObservationStage 多工况槽自动匹配并合成可读摘要', async () => {
    const state: Record<string, string> = {};
    const step = CONTAINER_COURSE_EXPERIMENT.steps[1];
    const onChange = (k: string, v: string) => { state[k] = v; };

    const predHost = mount(
      <StepPredictionStage
        spec={step.predictionSpec!}
        stepSeq={step.seq}
        stepTitle={step.title}
        vesselTitle="集装箱船"
        readings={state}
        samples={[]}
        runs={[]}
        locked
        onChange={onChange}
      />,
    );
    const lockBtn = predHost.querySelector('button');
    expect(lockBtn?.disabled).toBe(true);

    const mockRun = {
      id: 'run-loading-02',
      scopeKey: 'container:r1',
      courseVersion: 'seven-vessel-2026.11.14',
      stepSequence: 2,
      createdAtMs: 100,
      stoppedAtMs: 200,
      lastTimeS: 20,
      durationS: 20,
      sampleCount: 400,
      stopReason: 'duration',
      configuration: { loadingRatio: 0.2, initialWaterSpeedMps: 0, initialHeadingDeg: 0 },
      initialInput: { controlMode: 'manual', pid: { kp: 1, ki: 0, kd: 0 }, targetHeadingDeg: 0, feedback: 'measurement', actuators: { shafts: [], surfaces: [] } },
      parameters: {
        massKg: 146_000_000,
        draftM: 10.65,
        effectiveGmTransverseM: 2.345,
        windAreasM2: { lateral: 9850.4, frontal: 2140.2 },
      },
    } as unknown as VesselRunSummary;

    const obsHost = mount(
      <StepObservationStage
        spec={step.observationSpec!}
        readings={state}
        samples={[]}
        runs={[mockRun]}
        models={[]}
        comparisons={[]}
        stepSeq={2}
        onChange={onChange}
        onChangeActivePickSlot={vi.fn()}
      />,
    );
    expect(obsHost.textContent).toContain('已采集');
    expect(obsHost.textContent).not.toContain('曲线填入');
    expect(resolveActiveObservationSlotKey(step.observationSpec!, null, 'speed', state)).toBeNull();
    const extractBtn = Array.from(obsHost.querySelectorAll('button')).find((b) => b.textContent?.includes('一键提取本工况读数'));
    expect(extractBtn).toBeDefined();
    await act(async () => { extractBtn!.click(); });
    expect(state.obs_slot_load_02_loading).toBe('0.20');
    expect(state.obs_slot_load_02_mass_kt).toBe('146.000');
    expect(state.obs_slot_load_02_draft_m).toBe('10.65');
    expect(state.obs_slot_load_02_gm_m).toBe('2.345');
    expect(state.obs_slot_load_02_wind_lat).toBe('9850.4');
    expect(state.obs_slot_load_02_wind_front).toBe('2140.2');
    expect(state.observation).toContain('质量=146.000 千吨');
    expect(state.observation).toContain('正向风面积=2140.2 m²');

    const completedFormHost = mount(
      <VesselStepForm
        step={step}
        readings={state}
        message=""
        busy={false}
        reportEnabled={false}
        showReport={false}
        runs={[{ ...mockRun, lastTimeS: 1, durationS: 1 }]}
        samples={[{ time: 0.9, values: { speed: 0 } }]}
        courseRunning={false}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onReport={vi.fn()}
        onAsk={vi.fn()}
      />,
    );
    expect(completedFormHost.querySelector('[data-window-gate-notice]')).toBeNull();
    expect((completedFormHost.querySelector('[data-vessel-submit]') as HTMLButtonElement | null)?.disabled).toBe(false);

    const runningFormHost = mount(
      <VesselStepForm
        step={step}
        readings={state}
        message=""
        busy={false}
        reportEnabled={false}
        showReport={false}
        runs={[]}
        samples={[{ time: 0.9, values: { speed: 0 } }]}
        courseRunning
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onReport={vi.fn()}
        onAsk={vi.fn()}
      />,
    );
    expect(runningFormHost.querySelector('[data-window-gate-notice]')).not.toBeNull();
    expect((runningFormHost.querySelector('[data-vessel-submit]') as HTMLButtonElement | null)?.disabled).toBe(true);
  });

  it('控制面板按步隔离与漏接控件：集装箱 17 步滤波/19 步锁、邮轮 notch 阻带、981 步 4 隐藏模型框', async () => {
    const c17 = {
      activeSeq: 17, busy: false,
      course: { ready: true, running: false, completed: false, models: [], settings: containerCourseDefaultSettings(17), reportRunIds: [], setSettings: vi.fn(), runs: [], freezePrediction: vi.fn(), comparisons: [], read: () => null },
    } as unknown as VesselExperimentController<ReturnType<typeof containerCourseDefaultSettings>>;
    const cHost = mount(<ContainerCourseControls session={c17} timeS={0} />);
    expect(cHost.textContent).toContain('量测滤波');

    const rHost = mount(<CruiseRollDesign model={makeRollModel()} settings={{ ...cruiseCourseDefaultSettings(15), notchEnabled: true, notchCenterHz: 0.16, notchBandwidthHz: 0.06 }} />);
    expect(rHost.querySelector('[data-cruise-notch-stopband]')).not.toBeNull();
    expect(rHost.textContent).toContain('陷波中心 0.16 Hz');

    const d4 = {
      activeSeq: 4, busy: false,
      course: { ready: true, running: false, completed: false, models: [], settings: drillingCourseDefaultSettings(4), reportRunIds: [], runs: [] },
    } as unknown as VesselExperimentController<ReturnType<typeof drillingCourseDefaultSettings>>;
    const dHost = mount(<DrillingCourseControls session={d4} timeS={0} />);
    expect(dHost.querySelector('select[aria-label="本人三通道模型"]')).toBeNull();
    expect(dHost.textContent).toContain('评估');

    const cr18 = {
      activeSeq: 18, busy: false,
      course: { ready: true, running: false, completed: false, designModelId: '', setDesignModelId: vi.fn(), setSettings: vi.fn(), models: [makeRollModel()], settings: cruiseCourseDefaultSettings(18), reportRunIds: [], runs: [] },
    } as unknown as VesselExperimentController<ReturnType<typeof cruiseCourseDefaultSettings>>;
    const crHost = mount(<CruiseCourseControls session={cr18} timeS={0} />);
    expect(crHost.querySelector('select[aria-label="引用邮轮联合方案"]')).not.toBeNull();
  });
});
