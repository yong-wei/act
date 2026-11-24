// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'student-test-1', name: '测试同学' } },
    status: 'authenticated',
    update: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/simulations/cruise',
}));

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    status: 'ready',
    stop: vi.fn(),
    setMessages: vi.fn(),
    error: null,
  }),
}));

const courseMocks = vi.hoisted(() => ({
  readExperimentDraft: vi.fn(),
  readStepExperimentDraft: vi.fn(),
  saveExperimentDraft: vi.fn(),
  listExperimentDrafts: vi.fn(),
  listRunEvidence: vi.fn(),
  readRunEvidence: vi.fn(),
  listFrozenStudentModels: vi.fn(),
  saveFrozenStudentModel: vi.fn(),
  listModelComparisons: vi.fn(),
  saveModelComparison: vi.fn(),
  listLocalStepAttempts: vi.fn(),
  saveLocalStepAttempt: vi.fn(),
  fetchCourseSessionRecovery: vi.fn(),
  hydrateRecoveredCourseSession: vi.fn(),
  uploadVesselCourseArtifacts: vi.fn(),
  uploadVesselCourseRun: vi.fn(),
  saveVesselCourseReport: vi.fn(),
  triggerCourseReportIlabUpload: vi.fn(),
  workspaceOpen: vi.fn(),
  workspaceStart: vi.fn(),
  workspacePause: vi.fn(),
}));

vi.mock('@/features/simulations/local-evidence-store', () => ({
  readExperimentDraft: courseMocks.readExperimentDraft,
  readStepExperimentDraft: courseMocks.readStepExperimentDraft,
  saveExperimentDraft: courseMocks.saveExperimentDraft,
  listExperimentDrafts: courseMocks.listExperimentDrafts,
  listRunEvidence: courseMocks.listRunEvidence,
  readRunEvidence: courseMocks.readRunEvidence,
  listFrozenStudentModels: courseMocks.listFrozenStudentModels,
  saveFrozenStudentModel: courseMocks.saveFrozenStudentModel,
  listModelComparisons: courseMocks.listModelComparisons,
  saveModelComparison: courseMocks.saveModelComparison,
  listLocalStepAttempts: courseMocks.listLocalStepAttempts,
  saveLocalStepAttempt: courseMocks.saveLocalStepAttempt,
}));

vi.mock('@/features/simulations/course-artifact-upload', () => ({
  fetchCourseSessionRecovery: courseMocks.fetchCourseSessionRecovery,
  hydrateRecoveredCourseSession: courseMocks.hydrateRecoveredCourseSession,
  hasRecoverableLocalDraft: vi.fn(() => false),
  resumeVesselVerifications: vi.fn().mockResolvedValue(undefined),
  uploadVesselCourseArtifacts: courseMocks.uploadVesselCourseArtifacts,
  uploadVesselCourseRun: courseMocks.uploadVesselCourseRun,
  saveVesselCourseReport: courseMocks.saveVesselCourseReport,
  triggerCourseReportIlabUpload: courseMocks.triggerCourseReportIlabUpload,
}));

vi.mock('@/features/simulations/course-workspace', () => ({
  VesselCourseWorkspace: {
    open: courseMocks.workspaceOpen,
  },
}));

vi.mock('chart.js', () => {
  class MockChart {
    static register = vi.fn();
    data = { labels: [], datasets: [] };
    options = { scales: { x: { ticks: {}, grid: {} }, y: { ticks: {}, grid: {} } } };
    update = vi.fn();
    destroy = vi.fn();
  }
  return {
    Chart: MockChart,
    registerables: [],
  };
});

import { ThemeProvider } from '@/components/providers/theme-provider';
import { GlobalAIProvider, useOptionalGlobalAI } from '@/components/providers/global-ai-provider';
import { GlobalAISidebar } from '@/components/ai/global-ai-sidebar';
import { ILAB_AI_DATA_KEYS } from '@/features/ilab/ai-data';
import { buildAuditTelemetry, maskOriginId } from '@/features/ilab/telemetry-redaction';
import { computeResidualDiagnostics } from '../experiments/mismatch-diagnostics';
import { ThreeLayerTopology } from '../experiments/three-layer-topology';
import { detectVesselCurveAnomalies } from '../experiments/curve-anomaly-detector';
import { buildSketchAnalyticalOverlay } from '../experiments/sketch-analytical-overlay';
import { SketchPad } from '../simulations/sketch-pad';
import { computeCruiseMultiObjectiveMetrics, CruiseComfortReadout } from '../experiments/cruise-comfort-readout';
import { computeContainerTradeoffMetrics, ContainerVoyageTradeoff } from '../experiments/container-voyage-tradeoff';
import { analyzeDrillingThrusters, DrillingThrusterRadar } from '../experiments/drilling-thruster-radar';
import {
  buildStep20EvidenceCapsules,
  evaluateStep20Rubric,
  Step20EvidenceWorkbench,
} from '../experiments/step20-evidence-workbench';
import { IlabTelemetryDrawer } from '../experiments/ilab-telemetry-inspector';

it('审计抽屉使用真实控制采样数及已落库分块数', () => {
  const telemetry = {
    ...buildAuditTelemetry({
      originId: 'cruise_test_9001', uploadMode: 'local-only', uploadStatus: 'pending',
      completedStepCount: 0, totalSamplePoints: 1200, ledgerValue: null,
    }),
    controlSampleCadenceS: .05,
    persistedChunkCount: 10,
  };
  const samples = Array.from({length: 60}, (_, time) => ({time, values: {heading: 0}}));
  const html = renderToStaticMarkup(
    <IlabTelemetryDrawer auditTelemetry={telemetry} doneSeqs={new Set()}
      samples={samples} models={[]} controlSampleCount={1200} />,
  );
  expect(html).toContain('本轮20Hz采样进度');
  expect(html).toContain('1200');
  expect(html).toContain('10 块');
});
import { findHighlightTourNode, HIGHLIGHT_TOUR_NODES } from '../experiments/highlight-tour';
import { VesselCourseEvidencePanel, VesselCurve, VesselStepForm } from '../simulations/vessel-experiment-panels';
import { VESSEL_COURSE_VERSION } from '../experiments/destroyer-course';
import type { FrozenVesselStudentModel } from '../experiments/student-analysis';
import { useVesselExperiment } from '../simulations/use-vessel-experiment';
import type { VesselExperiment } from '../simulations/vessel-experiment';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(element: React.ReactElement): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(element);
  });
  return container;
}

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  vi.restoreAllMocks();
});

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'sessionStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    configurable: true,
    writable: true,
  });
  window.history.replaceState(null, '', '/simulations/cruise');
  Element.prototype.scrollIntoView = vi.fn();
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();

  courseMocks.readExperimentDraft.mockReset().mockResolvedValue(undefined);
  courseMocks.readStepExperimentDraft.mockReset().mockResolvedValue(undefined);
  courseMocks.saveExperimentDraft.mockReset().mockResolvedValue(undefined);
  courseMocks.listExperimentDrafts.mockReset().mockResolvedValue([]);
  courseMocks.listRunEvidence.mockReset().mockResolvedValue([]);
  courseMocks.readRunEvidence.mockReset().mockResolvedValue(undefined);
  courseMocks.listFrozenStudentModels.mockReset().mockResolvedValue([]);
  courseMocks.saveFrozenStudentModel.mockReset().mockResolvedValue(undefined);
  courseMocks.listModelComparisons.mockReset().mockResolvedValue([]);
  courseMocks.saveModelComparison.mockReset().mockResolvedValue(undefined);
  courseMocks.listLocalStepAttempts.mockReset().mockResolvedValue([]);
  courseMocks.saveLocalStepAttempt.mockReset().mockResolvedValue(undefined);
  courseMocks.fetchCourseSessionRecovery.mockReset().mockResolvedValue({
    authenticated: true,
    userId: 'student-test-1',
    recovery: {
      report: null,
      reportClientRef: null,
      runs: [],
      models: [],
      comparisons: [],
      attempts: [],
      ilabRun: null,
    },
  });
  courseMocks.hydrateRecoveredCourseSession.mockReset().mockResolvedValue(undefined);
  courseMocks.uploadVesselCourseArtifacts.mockReset().mockResolvedValue({ pendingCount: 0 });
  courseMocks.uploadVesselCourseRun.mockReset().mockResolvedValue({});
  courseMocks.saveVesselCourseReport.mockReset().mockResolvedValue({ id: 'rep-1' });
  courseMocks.triggerCourseReportIlabUpload.mockReset().mockResolvedValue({
    uploaded: false,
    retryableUpload: false,
    uploadMode: 'local-only',
    originId: null,
    message: 'ok',
  });
  courseMocks.workspaceStart.mockReset().mockResolvedValue(undefined);
  courseMocks.workspacePause.mockReset().mockResolvedValue(undefined);
  courseMocks.workspaceOpen.mockReset().mockImplementation(async (plan: Record<string, unknown>) => ({
    plan,
    running: false,
    initialInput: {},
    run: () => null,
    read: () => ({ timeS: 0 }),
    start: courseMocks.workspaceStart,
    pause: courseMocks.workspacePause,
    advance: () => ({ frame: { timeS: 0 }, saved: null }),
    fail: async () => undefined,
    previewInput: (input: unknown) => input,
    dispose: async () => undefined,
  }));
});

describe('1. 三层物理隔离拓扑与模型失配阴影诊断', () => {
  it('正确识别 |Truth - StudentModel| RMSE 超阈值区间并在拓扑组件给出提示', () => {
    const t = Array.from({ length: 24 }, (_, i) => i * 5);
    const pred = t.map(() => 1.0);
    const lowActual = t.map(() => 1.05);
    const lowDiag = computeResidualDiagnostics({
      timeS: t,
      actual: lowActual,
      predicted: pred,
      outputUnit: '°',
    });
    expect(lowDiag.isExceeded).toBe(false);

    const highActual = t.map((sec) => (sec >= 60 ? 3.2 : 1.05));
    const highDiag = computeResidualDiagnostics({
      timeS: t,
      actual: highActual,
      predicted: pred,
      outputChannel: 'roll_deg',
      outputUnit: '°',
    });
    expect(highDiag.isExceeded).toBe(true);
    expect(highDiag.intervals.length).toBeGreaterThan(0);

    const html = renderToStaticMarkup(
      <ThreeLayerTopology
        truthActive
        observerActive
        studentModelLabel="二阶横摇模型"
        studentModelActive
        diagnostics={highDiag}
      />,
    );
    expect(html).toContain('TruthPlant');
    expect(html).toContain('Observer');
    expect(html).toContain('StudentModel');
    expect(html).toContain('线性模型失配区（RMSE 超阈值）');
  });
});

describe('2. 曲线异常拐点检测与单一共享控灵苏格拉底防代写护栏', () => {
  it('触发拐点问控灵时只打开唯一共享控灵入口并激活防代写护栏，不渲染第二助手', async () => {
    const cruiseTour = findHighlightTourNode('node-cruise')!;
    const minimalExp: VesselExperiment = {
      key: 'cruise-test',
      vesselId: 'cruise',
      title: '爱达·魔都号邮轮横摇控制',
      subtitle: '测试',
      originPrefix: 'crs_',
      route: '/simulations/cruise',
      series: [
        { id: 'roll', label: '横摇 °', digits: 2 },
        { id: 'portFin', label: '左鳍角 °', digits: 1 },
      ],
      command: () => ({
        mode: 'manual',
        targetHeading: 0,
        manualRudder: 0,
        manualSpeed: 8,
        targetX: 0,
        targetZ: 0,
        smith: false,
        fin: true,
        ice: false,
        iceThickness: 0,
        dredging: false,
      }),
      read: () => ({}),
      score: () => ({
        ok: true,
        message: 'ok',
        earnedPoints: 5,
        maxPoints: 5,
        evaluation: 'pass',
        remarks: 'ok',
      }),
      steps: [
        {
          seq: 19,
          title: '左鳍卡阻故障应对',
          goal: '分析 t=180s 后响应',
          watch: 'roll',
          suggestion: '降速观察',
          scene: 'cruise',
          duration: 300,
          minRunS: 180,
          maxPoints: 6,
          expectTime: 6,
          fields: [{ key: 'observation', label: '观测记录', kind: 'text' }],
        },
      ],
    };

    const anomalies = detectVesselCurveAnomalies({
      shipKey: 'cruise',
      stepSeq: 19,
      stepTitle: '左鳍卡阻故障',
      samples: cruiseTour.samples,
      primarySignalKey: 'roll',
      primaryLabel: '横摇',
      unit: '°',
      finKey: 'portFin',
    });
    expect(anomalies.some((a) => a.kind === 'fault_inflection_180s')).toBe(true);

    function Harness() {
      const ai = useOptionalGlobalAI();
      return (
        <div>
          <VesselCurve
            experiment={minimalExp}
            samples={cruiseTour.samples}
            visible={{ roll: true, portFin: true }}
            onToggle={vi.fn()}
            stepSeq={19}
            stepTitle="左鳍卡阻故障应对"
          />
          <GlobalAISidebar />
          <span data-testid="ai-open">{String(Boolean(ai?.isOpen))}</span>
        </div>
      );
    }

    const host = mount(
      <ThemeProvider defaultTheme="light">
        <GlobalAIProvider>
          <Harness />
        </GlobalAIProvider>
      </ThemeProvider>,
    );

    const askBtn = host.querySelector('[data-anomaly-ask-konling]') as HTMLButtonElement | null;
    expect(askBtn).not.toBeNull();
    await act(async () => {
      askBtn!.click();
    });

    expect(host.textContent).toContain('苏格拉底启发护栏已开启（屏蔽标准参数直出）');
    expect(host.querySelectorAll('[data-konling-global-sidebar], aside, form').length).toBeGreaterThanOrEqual(1);
    expect(host.querySelector('[data-testid="ai-open"]')?.textContent).toBe('true');
  });
});

describe('3. 第 19 步纯画布手绘识图与本人解析叠加隔离', () => {
  it('叠加本人模型 SVG 参考线后，发往识图模型的 canvas.toDataURL 字节流完全不变', async () => {
    const cruiseTour = findHighlightTourNode('node-cruise')!;
    const drawOps: Array<[number, number]> = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      return {
        fillStyle: '#fff',
        strokeStyle: '#000',
        lineWidth: 2,
        lineCap: 'round',
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn((x: number, y: number) => drawOps.push([x, y])),
        stroke: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
    });

    const dataUrls: string[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
      const encoded = `data:image/png;base64,STROKE_${drawOps.length}`;
      dataUrls.push(encoded);
      return encoded;
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          sketchKind: 'bode',
          sketchBlank: '0',
          sketchEvaluation: '伯德渐近线与转折频率匹配。',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const overlaySpec = buildSketchAnalyticalOverlay('bode', cruiseTour.models[0]);
    expect(overlaySpec.paths.length).toBeGreaterThan(0);

    const changes: string[] = [];
    const host = mount(
      <SketchPad
        label="机理草图"
        hint="手绘伯德图"
        studentModel={cruiseTour.models[0]}
        onChange={(val) => changes.push(val)}
      />,
    );

    const canvas = host.querySelector('canvas')!;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 320, height: 180, right: 320, bottom: 180, x: 0, y: 0, toJSON: () => '' }) as DOMRect;

    await act(async () => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 20, clientY: 20, bubbles: true }));
      for (let step = 1; step <= 10; step += 1) {
        canvas.dispatchEvent(
          new PointerEvent('pointermove', {
            clientX: 20 + step * 10,
            clientY: 20 + step * 6,
            buttons: 1,
            bubbles: true,
          }),
        );
      }
      canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 120, clientY: 80, bubbles: true }));
    });
    const rawSketchBeforeOverlay = changes[changes.length - 1];

    const recognizeBtn = host.querySelector('[data-sketch-recognize]') as HTMLButtonElement | null;
    expect(recognizeBtn).not.toBeNull();
    await act(async () => {
      recognizeBtn!.click();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const reqBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(reqBody.image).toBe(rawSketchBeforeOverlay);

    // SVG overlay rendered as sibling outside canvas, toggleable without touching canvas pixels
    expect(host.querySelector('[data-sketch-analytical-overlay]')).not.toBeNull();
    const toggleOverlay = host.querySelector('[data-sketch-overlay-toggle]') as HTMLButtonElement;
    expect(toggleOverlay).not.toBeNull();
    await act(async () => {
      toggleOverlay.click();
    });
    expect(host.querySelector('[data-sketch-analytical-overlay]')).toBeNull();
    expect(canvas.toDataURL()).toBe(rawSketchBeforeOverlay);
  });
});

describe('4. 三大核心船工业多目标权衡 HUD 与安全包络', () => {
  it('邮轮：正确计算 MSI、减摇鳍磨损积分与左鳍 t>=180s 卡阻指示', () => {
    const metrics = computeCruiseMultiObjectiveMetrics({
      comfort: {
        rollRmsDeg: 2.1,
        rollPeakDeg: 5.8,
        rollRateRmsDegS: 0.9,
        positivePropulsionWorkJ: 4.2e6,
        finServoElectricWorkJ: 0.75e6,
        statisticsWindowS: [120, 300],
        durationS: 180,
        passengers: [
          {
            positionBodyM: [10, 0, 20],
            horizontalAccelerationRmsMps2: 0.32,
            horizontalAccelerationPeakMps2: 0.85,
            accelerationRmsMps2: 0.35,
            jerkRmsMps3: 0.4,
          },
        ],
      },
      finAnglesDeg: [-25, 8],
      timeS: 195,
      finWearIntegralDeg: 1420,
      finFaultLocked: true,
    });

    expect(metrics.msiPercent).toBeGreaterThan(20);
    expect(metrics.finSaturated).toBe(true);
    expect(metrics.stallOrFaultLabel).toContain('左减摇鳍卡阻/冻结');

    const html = renderToStaticMarkup(
      <CruiseComfortReadout
        comfort={null}
        finAnglesDeg={[-25, 4]}
        timeS={190}
        finWearIntegralDeg={950}
        finFaultLocked
      />,
    );
    expect(html).toContain('data-cruise-msi-meter');
    expect(html).toContain('data-cruise-fin-lamp');
    expect(html).toContain('950°');
  });

  it('集装箱船：计算 ETA 900s ↔ SFOC 立方油耗与 35° 满舵掉速警报', () => {
    const metrics = computeContainerTradeoffMetrics({
      timeS: 120,
      positionX: 1200,
      speedMps: 6.5,
      powerW: 18_500_000,
      fuelKg: 210,
      rudderDeg: 35,
    });
    expect(metrics.rudderSaturated).toBe(true);
    expect(metrics.projectedEtaS).toBeGreaterThan(750);
    expect(metrics.cubicLoadRatio).toBeCloseTo(Math.pow(6.5 / 8, 3), 5);

    const html = renderToStaticMarkup(
      <ContainerVoyageTradeoff
        timeS={120}
        positionX={1200}
        speedMps={6.5}
        powerW={18_500_000}
        fuelKg={210}
        rudderDeg={35}
      />,
    );
    expect(html).toContain('data-rudder-saturation-alert');
    expect(html).toContain('35° 满舵饱和掉速');
  });

  it('981 半潜平台：8 推雷达图呈现尾流禁区、32MW 封顶与 T2 断桨 7 推重分配', () => {
    const thrusters = Array.from({ length: 8 }, (_, idx) => ({
      id: idx + 1,
      azimuth: idx * 35,
      thrust: idx === 1 ? 0 : 420,
      power: idx === 1 ? 0 : 3800,
      rpm: idx === 1 ? 0 : 120,
      enabled: true,
      failed: idx === 1,
    }));
    const summary = analyzeDrillingThrusters(thrusters, 26_600_000);
    expect(summary.t2Failed).toBe(true);
    expect(summary.activeCount).toBe(7);
    expect(summary.powerCapMw).toBe(32);

    const html = renderToStaticMarkup(
      <DrillingThrusterRadar thrusters={thrusters} totalPowerW={26_600_000} timeS={185} />,
    );
    expect(html).toContain('data-t2-fault-active="true"');
    expect(html).toContain('T2 推进器于 t=180.0s 发生断桨停机');
    expect(html).toContain('在线 7/8');
    expect(html).toContain('立柱尾流禁区');
    expect(html).toContain('32.00 MW');
  });
});

describe('5. 步 20 证据胶囊、四维量规与有效时间窗口门禁', () => {
  it('兼容六段式报告键计算四维 3+3+2+2=10 量规分并支持一键插入实测胶囊', async () => {
    const tourStep20 = findHighlightTourNode('node-step20')!;
    const capsules = buildStep20EvidenceCapsules({
      models: tourStep20.models,
      comparisons: tourStep20.comparisons,
      runs: tourStep20.runs,
    });
    expect(capsules.length).toBeGreaterThanOrEqual(4);

    const fullRubric = evaluateStep20Rubric(tourStep20.readings, {
      models: tourStep20.models.length,
      comparisons: tourStep20.comparisons.length,
      runs: tourStep20.runs.length,
    });
    expect(fullRubric.totalPreviewScore).toBe(10);
    expect(fullRubric.dimensions.every((d) => d.met)).toBe(true);

    const inserted: Array<{ section: string; text: string }> = [];
    const host = mount(
      <Step20EvidenceWorkbench
        readings={{ problem: '初始假设' }}
        activeSection="problem"
        onSelectSection={vi.fn()}
        onInsertSnippet={(section, text) => inserted.push({ section, text })}
        models={tourStep20.models}
        comparisons={tourStep20.comparisons}
        runs={tourStep20.runs}
      />,
    );

    const insertBtn = host.querySelector(`[data-insert-capsule="${capsules[0].id}"]`) as HTMLButtonElement;
    await act(async () => {
      insertBtn.click();
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0].text).toContain(capsules[0].snippet);
  });

  it('有效故障/稳态时间窗口到达前阻塞正式提交按钮并显示明确提示', () => {
    const html = renderToStaticMarkup(
      <VesselStepForm
        step={{
          seq: 19,
          title: '故障处置',
          goal: '坚持至故障注入后',
          watch: 'roll',
          suggestion: '继续运行',
          scene: 'cruise',
          duration: 300,
          minRunS: 180,
          maxPoints: 6,
          expectTime: 6,
          fields: [{ key: 'observation', label: '观测', kind: 'text' }],
        }}
        readings={{}}
        message=""
        busy={false}
        reportEnabled={false}
        showReport={false}
        samples={[{ time: 30, values: { roll: 1.2 } }]}
        courseRunning
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onReport={vi.fn()}
        onAsk={vi.fn()}
      />,
    );
    expect(html).toContain('data-window-gate-notice');
    expect(html).toContain('需运行至 ≥180s');
    expect(html).toContain('disabled=""');
  });
});

describe('6. iLab-X 与 ai_data 合规脱敏审计抽屉', () => {
  it('maskOriginId 隐藏中段敏感字符且 IlabTelemetryDrawer 展示全 6 项字段不泄露凭据', () => {
    const masked = maskOriginId('cruise_secretSessionToken_9876');
    expect(masked).toContain('***');
    expect(masked).toContain('9876');
    expect(masked).not.toContain('secretSessionToken');

    const audit = buildAuditTelemetry({
      originId: 'cruise_secretSessionToken_9876',
      uploadMode: 'ilab-remote',
      uploadStatus: 'uploaded',
      completedStepCount: 14,
      totalSamplePoints: 1200,
      ledgerValue: {
        callCount: 3,
        inputTokens: 420,
        outputTokens: 310,
        scenarios: ['curves-anomaly-socratic'],
        model: 'qwen-plus',
        provider: 'siliconflow',
        deployment: '公有云服务',
        remark: 'token 用量来自服务商真实计数。',
      },
    });

    const html = renderToStaticMarkup(
      <IlabTelemetryDrawer
        auditTelemetry={audit}
        doneSeqs={new Set([1, 2, 3])}
        samples={findHighlightTourNode('node-cruise')!.samples}
        models={findHighlightTourNode('node-cruise')!.models}
      />,
    );

    expect(html).not.toContain('secretSessionToken');
    expect(html).toContain(masked);
    for (const key of ILAB_AI_DATA_KEYS) {
      expect(html).toContain(key);
    }
    expect(html).toContain('qwen-plus');
  });
});

describe('7. 典型高光工况只读导览模式强拦截与退出状态恢复', () => {
  it('进入导览态严禁调用正式提分或回传接口，退出后无损恢复原有步序与草稿读数', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === '/api/ilab/vessel/session') {
        return new Response(
          JSON.stringify({
            connected: true,
            originId: 'cruise_local_1234',
            uploadMode: 'local-only',
            steps: [],
            stepDrafts: { '1': { observation: '真实实验草稿A' } },
            currentSeq: 1,
            draftActiveSeq: 1,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ reports: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const legacyExp: VesselExperiment = {
      key: 'cruise-legacy-tour-test',
      vesselId: 'cruise',
      title: '邮轮只读导览测试',
      subtitle: 'test',
      originPrefix: 'crs_',
      route: '/simulations/cruise',
      series: [{ id: 'roll', label: '横摇 °' }],
      command: () => ({
        mode: 'manual',
        targetHeading: 0,
        manualRudder: 0,
        manualSpeed: 8,
        targetX: 0,
        targetZ: 0,
        smith: false,
        fin: true,
        ice: false,
        iceThickness: 0,
        dredging: false,
      }),
      read: () => ({}),
      score: () => ({
        ok: true,
        message: 'pass',
        earnedPoints: 3,
        maxPoints: 3,
        evaluation: 'ok',
        remarks: 'ok',
      }),
      steps: Array.from({ length: 20 }, (_, i) => ({
        seq: i + 1,
        title: `第${i + 1}步`,
        goal: 'goal',
        watch: 'roll',
        suggestion: 'tip',
        scene: 'cruise',
        duration: 60,
        minRunS: 0,
        maxPoints: 5,
        expectTime: 5,
        fields: [{ key: 'observation', label: '观测', kind: 'text' }],
      })),
    };

    let ctrl!: ReturnType<typeof useVesselExperiment>;
    function TourHarness() {
      ctrl = useVesselExperiment(legacyExp);
      return (
        <div>
          <span data-testid="active-seq">{ctrl.activeSeq}</span>
          <span data-testid="tour-active">{String(ctrl.tour.active)}</span>
          <span data-testid="obs">{ctrl.readings.observation ?? ''}</span>
          <span data-testid="msg">{ctrl.message}</span>
        </div>
      );
    }

    const host = mount(<TourHarness />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    await act(async () => {
      ctrl.setReading('observation', '学生真实填写的笔记');
    });
    expect(host.querySelector('[data-testid="obs"]')?.textContent).toBe('学生真实填写的笔记');

    const callCountBeforeTour = fetchSpy.mock.calls.length;

    await act(async () => {
      ctrl.tour.enter('node-cruise');
    });
    expect(host.querySelector('[data-testid="tour-active"]')?.textContent).toBe('true');
    expect(host.querySelector('[data-testid="active-seq"]')?.textContent).toBe('19');
    expect(HIGHLIGHT_TOUR_NODES).toHaveLength(5);

    // Try modifying tour draft + calling formal submit / retry upload -> must block completely with 0 network writes
    await act(async () => {
      ctrl.setReading('observation', '导览临时体验输入');
      await ctrl.submitStep();
      await ctrl.retryIlabUpload();
    });
    expect(host.querySelector('[data-testid="msg"]')?.textContent).toContain('只读高光工况导览模式下严禁');

    const writesDuringTour = fetchSpy.mock.calls.slice(callCountBeforeTour).filter((call) => {
      const url = String(call[0]);
      return /\/steps|\/complete|\/reports|\/api\/ilab\/vessel\/session\//.test(url);
    });
    expect(writesDuringTour).toHaveLength(0);

    await act(async () => {
      ctrl.tour.exit();
    });
    expect(host.querySelector('[data-testid="tour-active"]')?.textContent).toBe('false');
    expect(host.querySelector('[data-testid="active-seq"]')?.textContent).toBe('1');
    expect(host.querySelector('[data-testid="obs"]')?.textContent).toBe('学生真实填写的笔记');
  });

  it('原生 course 工作区在导览态完全隔离为只读沙箱，严禁写草稿/启停工作区，退出后无损恢复', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === '/api/ilab/vessel/session') {
        return new Response(
          JSON.stringify({
            connected: true,
            userId: 'student-test-1',
            experimentVersion: VESSEL_COURSE_VERSION,
            originId: 'lng_native_1234',
            uploadMode: 'local-only',
            steps: [],
            stepDrafts: {},
            currentSeq: 1,
            draftActiveSeq: 1,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ reports: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const nativeExp: VesselExperiment = {
      key: 'lng-berthing',
      vesselId: 'lng',
      courseVersion: VESSEL_COURSE_VERSION,
      title: '原生课程只读导览测试',
      subtitle: 'native test',
      originPrefix: 'lng_',
      route: '/simulations/lng',
      series: [{ id: 'speed', label: '航速' }],
      command: () => ({
        mode: 'manual',
        targetHeading: 0,
        manualRudder: 0,
        manualSpeed: 6,
        targetX: 0,
        targetZ: 0,
        smith: false,
        fin: false,
        ice: false,
        iceThickness: 0,
        dredging: false,
      }),
      read: () => ({}),
      score: () => ({
        ok: true,
        message: 'ok',
        earnedPoints: 3,
        maxPoints: 3,
        evaluation: 'ok',
        remarks: 'ok',
      }),
      steps: Array.from({ length: 20 }, (_, i) => ({
        seq: i + 1,
        title: `第${i + 1}步`,
        goal: 'goal',
        watch: 'speed',
        suggestion: 'tip',
        scene: 'lng',
        duration: 120,
        minRunS: 0,
        maxPoints: 5,
        expectTime: 5,
        fields: [{ key: 'observation', label: '观测', kind: 'text' }],
      })),
    };

    let ctrl!: ReturnType<typeof useVesselExperiment>;
    function NativeHarness() {
      ctrl = useVesselExperiment(nativeExp);
      return (
        <div>
          <span data-testid="ready">{String(Boolean(ctrl.course?.ready))}</span>
          <span data-testid="scope">{ctrl.course?.scopeKey ?? ''}</span>
          <span data-testid="loading-ratio">{String(ctrl.course?.settings.loadingRatio ?? '')}</span>
          <VesselCourseEvidencePanel session={ctrl} defaultChannel="shaft-reference-to-speed" />
        </div>
      );
    }

    const host = mount(<NativeHarness />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });

    expect(host.querySelector('[data-testid="ready"]')?.textContent).toBe('true');

    await act(async () => {
      ctrl.course?.setSettings((prev) => ({ ...prev, loadingRatio: 0.7 }));
      ctrl.setReading('observation', '真实原生实验笔记');
    });
    expect(host.querySelector('[data-testid="loading-ratio"]')?.textContent).toBe('0.7');

    await act(async () => {
      ctrl.tour.enter('node-cruise');
    });

    // Clear counters after entering tour so debounced draft timers are proven dead during tour
    courseMocks.saveExperimentDraft.mockClear();
    courseMocks.workspaceStart.mockClear();
    const fetchCallsAtTourEnter = fetchSpy.mock.calls.length;

    expect(host.querySelector('[data-testid="scope"]')?.textContent).toBe('tour-readonly:node-cruise');
    expect(host.querySelector('[data-testid="ready"]')?.textContent).toBe('false');
    expect(host.querySelector('[data-tour-workbench-locked]')).not.toBeNull();

    await act(async () => {
      ctrl.course?.setSettings((prev) => ({ ...prev, loadingRatio: 0.95 }));
      await ctrl.course?.start();
      await ctrl.course?.reset();
      await ctrl.course?.selectRound('account:student-test-1:lng-berthing:course-v2:round:other');
      await new Promise((r) => setTimeout(r, 250));
    });

    expect(courseMocks.workspaceStart).not.toHaveBeenCalled();
    expect(courseMocks.saveExperimentDraft).not.toHaveBeenCalled();
    expect(fetchSpy.mock.calls.slice(fetchCallsAtTourEnter)).toHaveLength(0);

    await act(async () => {
      ctrl.tour.exit();
    });

    expect(ctrl.tour.active).toBe(false);
    expect(host.querySelector('[data-testid="ready"]')?.textContent).toBe('true');
    expect(host.querySelector('[data-testid="loading-ratio"]')?.textContent).toBe('0.7');
    expect(ctrl.readings.observation).toBe('真实原生实验笔记');
    expect(host.querySelector('[data-tour-workbench-locked]')).toBeNull();
  });
});

describe('8. Round 2 Review 回归护栏：故障胶囊、模型根轨迹与审计遥测刷新', () => {
  it('步 20 胶囊不再把常规 300s 无故障运行误标为 fault_run，仅真实故障工况归类为 fault_run', () => {
    const capsules = buildStep20EvidenceCapsules({
      models: [],
      comparisons: [],
      runs: [
        {
          id: 'normal-300s',
          stepSequence: 2,
          lastTimeS: 300,
          stopReason: 'completed',
          createdAtMs: 1700000000000,
          configuration: {
            cruise: { statisticsStartS: 120, statisticsEndS: 300, finFailureTimeS: null, failedFinIndex: null },
          },
        },
        {
          id: 'cruise-fin-fault',
          stepSequence: 19,
          lastTimeS: 210,
          stopReason: 'completed',
          createdAtMs: 1700000001000,
          configuration: {
            cruise: { statisticsStartS: 180, statisticsEndS: 300, finFailureTimeS: 180, failedFinIndex: 0 },
          },
        },
        {
          id: 'drilling-t2-cut',
          stepSequence: 19,
          lastTimeS: 205,
          stopReason: 'completed',
          createdAtMs: 1700000002000,
          configuration: {
            driveCutFault: true,
          },
        },
      ],
    });

    const normalCap = capsules.find((c) => c.id === 'run-normal-300s');
    const cruiseFaultCap = capsules.find((c) => c.id === 'run-cruise-fin-fault');
    const drillingFaultCap = capsules.find((c) => c.id === 'run-drilling-t2-cut');

    expect(normalCap?.category).toBe('run');
    expect(normalCap?.snippet).not.toContain('故障');
    expect(cruiseFaultCap?.category).toBe('fault_run');
    expect(drillingFaultCap?.category).toBe('fault_run');
  });

  it('SketchAnalyticalOverlay 按真实模型结构绘制根轨迹，并在含纯时滞或多变量模型时禁用叠合', async () => {
    const nomoto1Model: FrozenVesselStudentModel = {
      id: 'm-nomoto1',
      scopeKey: 's',
      label: '一阶 Nomoto 模型',
      channel: 'rudder-to-yaw',
      createdAtMs: 1,
      serverId: null,
      contentHash: 'h1',
      payload: {
        experimentKey: 'destroyer-course',
        lineageKey: 'r2y',
        structure: { kind: 'nomoto1', k: 0.15, t_s: 20 },
        ioContract: { inputChannel: 'rudder', outputChannel: 'yaw_rate', inputUnit: 'deg', outputUnit: 'deg/s' },
        operatingPoint: { speedMps: 8 },
        identification: { algorithm: 'lsq', settings: {}, identifiedOk: true, residualRms: 0.1 },
        trainingRuns: [],
        validationRuns: [],
        sampleDt: 0.5,
      },
    };

    const nomotoSpec = buildSketchAnalyticalOverlay('root-locus', nomoto1Model);
    expect(nomotoSpec.supported).toBe(true);
    expect(nomotoSpec.markers).toHaveLength(1);
    expect(nomotoSpec.paths.some((p) => p.id === 'locus-real-ray')).toBe(true);
    expect(nomotoSpec.paths.some((p) => p.id === 'locus-vertical-asymptote')).toBe(false);

    const cruiseTour = findHighlightTourNode('node-cruise')!;
    const underdampedSpec = buildSketchAnalyticalOverlay('root-locus', cruiseTour.models[0]);
    expect(underdampedSpec.supported).toBe(true);
    expect(underdampedSpec.markers).toHaveLength(2);
    expect(underdampedSpec.markers.every((m) => m.y !== 80)).toBe(true);
    expect(underdampedSpec.paths.some((p) => p.id === 'locus-conjugate-branches')).toBe(true);

    const containerTour = findHighlightTourNode('node-container')!;
    const fopdtDelaySpec = buildSketchAnalyticalOverlay('root-locus', containerTour.models[0]);
    expect(fopdtDelaySpec.supported).toBe(false);
    expect(fopdtDelaySpec.paths).toHaveLength(0);
    expect(fopdtDelaySpec.unsupportedReason).toContain('纯时滞');

    const drillingTour = findHighlightTourNode('node-drilling')!;
    expect(buildSketchAnalyticalOverlay('root-locus', drillingTour.models[0]).supported).toBe(false);

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      fillStyle: '#fff',
      strokeStyle: '#000',
      lineWidth: 2,
      lineCap: 'round',
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D));
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,ROOTLOCUS');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          sketchKind: 'root-locus',
          sketchBlank: '0',
          sketchEvaluation: '根轨迹特征识别成功',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const host = mount(
      <SketchPad
        label="根轨迹草图"
        hint="手绘根轨迹"
        studentModel={containerTour.models[0]}
        onChange={vi.fn()}
      />,
    );

    const canvas = host.querySelector('canvas')!;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 280, height: 160, right: 280, bottom: 160, x: 0, y: 0, toJSON: () => '' }) as DOMRect;

    await act(async () => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));
      for (let i = 1; i <= 9; i += 1) {
        canvas.dispatchEvent(
          new PointerEvent('pointermove', { clientX: 10 + i * 8, clientY: 10 + i * 5, buttons: 1, bubbles: true }),
        );
      }
      canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 82, clientY: 55, bubbles: true }));
    });

    await act(async () => {
      (host.querySelector('[data-sketch-recognize]') as HTMLButtonElement).click();
    });

    const toggle = host.querySelector('[data-sketch-overlay-toggle]') as HTMLInputElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle?.disabled).toBe(true);
    expect(toggle?.checked).toBe(false);
    expect(host.querySelector('[data-sketch-analytical-overlay]')).toBeNull();
    expect(host.querySelector('[data-sketch-overlay-unsupported]')?.textContent).toContain('纯时滞');
  });

  it('控灵对话完成触发 notifyAiTurnCompleted 后，自动重拉会话审计遥测并更新 ai_call_count', async () => {
    const initialTelemetry = buildAuditTelemetry({
      originId: 'cruise_telemetry_9001',
      uploadMode: 'local-only',
      uploadStatus: 'pending',
      completedStepCount: 1,
      totalSamplePoints: 10,
      ledgerValue: { callCount: 0, inputTokens: 0, outputTokens: 0, scenarios: [] },
    });
    const updatedTelemetry = buildAuditTelemetry({
      originId: 'cruise_telemetry_9001',
      uploadMode: 'local-only',
      uploadStatus: 'pending',
      completedStepCount: 1,
      totalSamplePoints: 10,
      ledgerValue: {
        callCount: 2,
        inputTokens: 280,
        outputTokens: 190,
        scenarios: ['curves-anomaly-socratic'],
        model: 'qwen-plus',
        provider: 'siliconflow',
        deployment: '公有云服务',
        remark: 'token 用量来自服务商真实计数。',
      },
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === '/api/ilab/vessel/session') {
        return new Response(
          JSON.stringify({
            connected: true,
            originId: 'cruise_telemetry_9001',
            uploadMode: 'local-only',
            auditTelemetry: initialTelemetry,
            steps: [],
            stepDrafts: {},
            currentSeq: 1,
            draftActiveSeq: 1,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url === '/api/ilab/vessel/session/cruise_telemetry_9001') {
        return new Response(
          JSON.stringify({
            originId: 'cruise_telemetry_9001',
            auditTelemetry: updatedTelemetry,
            steps: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ reports: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const simpleExp: VesselExperiment = {
      key: 'cruise-telemetry-test',
      vesselId: 'cruise',
      title: '审计遥测刷新测试',
      subtitle: 'test',
      originPrefix: 'crs_',
      route: '/simulations/cruise',
      series: [{ id: 'roll', label: '横摇 °' }],
      command: () => ({
        mode: 'manual',
        targetHeading: 0,
        manualRudder: 0,
        manualSpeed: 8,
        targetX: 0,
        targetZ: 0,
        smith: false,
        fin: true,
        ice: false,
        iceThickness: 0,
        dredging: false,
      }),
      read: () => ({}),
      score: () => ({
        ok: true,
        message: 'ok',
        earnedPoints: 3,
        maxPoints: 3,
        evaluation: 'ok',
        remarks: 'ok',
      }),
      steps: [
        {
          seq: 1,
          title: '第1步',
          goal: 'goal',
          watch: 'roll',
          suggestion: 'tip',
          scene: 'cruise',
          duration: 60,
          minRunS: 0,
          maxPoints: 3,
          expectTime: 5,
          fields: [{ key: 'observation', label: '观测', kind: 'text' }],
        },
      ],
    };

    let aiCtx: ReturnType<typeof useOptionalGlobalAI> = null;
    function TelemetryHarness() {
      const ctrl = useVesselExperiment(simpleExp);
      aiCtx = useOptionalGlobalAI();
      return (
        <div>
          <span data-testid="ai-calls">{ctrl.auditTelemetry?.aiData.ai_call_count ?? -1}</span>
          <span data-testid="ctx-origin">{aiCtx?.pageContext?.simulationOriginId ?? ''}</span>
        </div>
      );
    }

    const host = mount(
      <ThemeProvider defaultTheme="light">
        <GlobalAIProvider>
          <TelemetryHarness />
        </GlobalAIProvider>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(host.querySelector('[data-testid="ai-calls"]')?.textContent).toBe('0');
    expect(host.querySelector('[data-testid="ctx-origin"]')?.textContent).toBe('cruise_telemetry_9001');

    await act(async () => {
      aiCtx?.notifyAiTurnCompleted();
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(
      fetchSpy.mock.calls.some((call) => String(call[0]) === '/api/ilab/vessel/session/cruise_telemetry_9001'),
    ).toBe(true);
    expect(host.querySelector('[data-testid="ai-calls"]')?.textContent).toBe('2');
  });
});
