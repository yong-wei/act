'use client';

import { Fragment, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import type { InteractiveRuntimeManifest, InteractiveRuntimeStepManifest } from '@/lib/interactive-lesson-manifest';
import {
  renderInteractiveManifestStep,
  type InteractiveModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import {
  createManifestTeacherActivityRegistry,
  createManifestStudentActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type StudentInteractiveActivityRegistry,
  type TeacherInteractiveActivityRegistry,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  buildUnit43AnalysisRequest,
  formatUnit43ControllerFormula,
  formatUnit43PlantFormula,
  getUnit43FallbackResult,
  normalizeUnit43PanelParams,
  type Unit43PanelParams,
  type Unit43PanelId,
} from '@/resources/control-system/analysis/unit-4-3-request-builder';
import { getUnit43DesignPayload } from '@/resources/control-system/analysis/unit-4-3-fixtures';
import {
  buildUnit43RollBoundaryComparison,
  normalizeUnit43RollBoundaryParams,
} from '@/resources/control-system/analysis/unit-4-3-roll-boundary';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import { axisTooltipFormatter, formatAxisValue, getControlAxisPreset } from '@/resources/control-system/charts/control-bode-options';
import { ControlChartPanel } from '@/resources/control-system/charts/control-chart-panel';
import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';
import {
  isUNIT_4_3InteractivePageType,
  type UNIT_4_3RuntimeStepDefinition,
  type UNIT_4_3StepResponse,
} from '@/lib/unit-4-3-course';
import type { WorkspaceParameterChange } from './workspace';

type TeacherResponseItem = { studentName: string; response: UNIT_4_3StepResponse };
type MetricRow = { label: string; baseline: string; current: string };
type PromptContentBlock = Readonly<{ type: 'text' | 'math'; value: string }>;
type PromptContent = readonly PromptContentBlock[];
type ComparisonPoint = { x: number; baseline: number | null; current: number | null };

const HEADING_PLANT_TEX = 'P_h(s)=\\dfrac{0.01715}{s(s+0.1)(s+2.14375)}';
const HEADING_CONTROLLER_TEX = 'C_h(s)=K\\dfrac{Ts+1}{\\alpha Ts+1},\\ 0<\\alpha<1';
const MINI_EXAMPLE_PLANT_TEX = 'P_e(s)=\\dfrac{1}{(s+1)(0.4s+1)(0.1s+1)}';
const STEP_05_DEFAULT_PARAMS = { gain: 6, piPoleFrequency: 1 / 1.8, leadZeroFrequency: 1 / 0.9, leadPoleFrequency: 1 / 0.18 } as const;
const STEP_06_DEFAULT_PARAMS = { gain: 6, lagPoleFrequency: 1 / 20, lagZeroFrequency: 1 / 5, leadZeroFrequency: 1 / 0.8, leadPoleFrequency: 1 / 0.16 } as const;
const STEP_07_DEFAULT_PARAMS = { kp: 3.5, ki: 3.5 / 1.5, kd: 0.25 } as const;
const STEP_10_DEFAULT_PARAMS = { gain: 2.8, leadZeroFrequency: 0.1, leadPoleFrequency: 1 / 4.06 } as const;
const BASELINE_SERIES_COLOR = '#f59e0b';
const CURRENT_SERIES_COLOR = '#22d3ee';

const REVEALS = {
  'step-09': [
    {
      title: '由超调量反推阻尼要求',
      blocks: [
        { type: 'math', value: 'M_p=e^{-\\frac{\\pi\\zeta}{\\sqrt{1-\\zeta^2}}}' },
        { type: 'text', value: '若超调量要求为 20% 以内，阻尼比可先取 0.46 左右。' },
      ],
    },
    {
      title: '由调节时间估计速度下界',
      blocks: [
        { type: 'math', value: 't_s\\approx\\dfrac{4}{\\zeta\\omega_n}' },
        { type: 'math', value: '\\omega_c\\approx0.18\\ \\mathrm{rad/s}' },
        { type: 'text', value: '当调节时间目标压到 40 s 左右时，可先把设计交越频率放在这个量级。' },
      ],
    },
    {
      title: '由相位缺额确定超前量',
      blocks: [
        { type: 'math', value: '\\phi_m=\\sin^{-1}\\!\\left(\\dfrac{1-\\alpha}{1+\\alpha}\\right)' },
        { type: 'math', value: '\\alpha\\approx0.406' },
        { type: 'text', value: '设计点处原对象相位约为 -155.7°，因此可把超前峰值先放在 25° 左右。' },
      ],
    },
    {
      title: '由设计频率换算零极点位置',
      blocks: [
        { type: 'math', value: '\\dfrac{Ts+1}{\\alpha Ts+1}\\approx\\dfrac{10s+1}{4.06s+1}' },
        { type: 'text', value: '参数方向写法是：先补中频相位，希望提速，最可能先贴近超调量与控制峰值边界。' },
      ],
    },
    {
      title: '由幅值条件确定总增益',
      blocks: [
        { type: 'math', value: '|C_h(j\\omega_c)P_h(j\\omega_c)|=1' },
        { type: 'math', value: 'C_h(s)\\approx2.80\\dfrac{10s+1}{4.06s+1}' },
        { type: 'text', value: '这样就形成了可进入首轮验证的起步方案。' },
      ],
    },
  ],
  'step-11': [
    {
      title: '先写对象与要求',
      blocks: [
        { type: 'math', value: 'P_e(s)=\\dfrac{1}{(s+1)(0.4s+1)(0.1s+1)}' },
        { type: 'math', value: 'e_{ss}\\le0.12,\\ M_p\\le15\\%,\\ t_s\\le12\\ \\mathrm{s},\\ \\phi_m\\ge55^\\circ' },
      ],
    },
    {
      title: '判断为何不能继续只拉增益',
      blocks: [
        { type: 'text', value: '已知单纯提高增益会让相位储备明显下降，因此不能继续把所有任务压在单一机制线上。' },
      ],
    },
    {
      title: '确定复合结构分工',
      blocks: [
        { type: 'math', value: 'C(s)=K\\dfrac{T_\\ell s+1}{\\beta T_\\ell s+1}\\dfrac{T_\\alpha s+1}{\\alpha T_\\alpha s+1}' },
        { type: 'text', value: '更合理的起步口径是：滞后先抬低频增益，超前再把截止频率附近的相位拉回。' },
      ],
    },
    {
      title: '写清首轮验证重点',
      blocks: [
        { type: 'text', value: '首轮验证至少要同时检查稳态误差、超调量、调节时间和相角裕度，不能只看一张响应曲线。' },
      ],
    },
  ],
} as const;

type RevealChainStepId = keyof typeof REVEALS;

function isRevealChainStepId(stepId: string): stepId is RevealChainStepId {
  return stepId in REVEALS;
}

const ANALYSIS_CONFIG = {
  'step-05': {
    panelId: 'pi_lead' as Unit43PanelId,
    layout: 'quad' as const,
    title: 'PI + 超前原生统一面板',
    metrics: [
      ['超调量', 'overshootPct', '%'],
      ['调节时间', 'settlingTimeSec', ' s'],
      ['稳态误差', 'steadyError', ''],
      ['相角裕度', 'phaseMarginDeg', '°'],
      ['截止频率', 'gainCrossoverRadPerSec', ' rad/s'],
    ],
  },
  'step-06': {
    panelId: 'lag_lead' as Unit43PanelId,
    layout: 'quad' as const,
    title: '滞后 + 超前原生统一面板',
    metrics: [
      ['超调量', 'overshootPct', '%'],
      ['调节时间', 'settlingTimeSec', ' s'],
      ['稳态误差', 'steadyError', ''],
      ['相角裕度', 'phaseMarginDeg', '°'],
      ['截止频率', 'gainCrossoverRadPerSec', ' rad/s'],
    ],
  },
  'step-07': {
    panelId: 'pid_filtered' as Unit43PanelId,
    layout: 'quad' as const,
    title: '带滤波 PID 原生统一面板',
    metrics: [
      ['超调量', 'overshootPct', '%'],
      ['调节时间', 'settlingTimeSec', ' s'],
      ['稳态误差', 'steadyError', ''],
      ['相角裕度', 'phaseMarginDeg', '°'],
      ['截止频率', 'gainCrossoverRadPerSec', ' rad/s'],
    ],
  },
  'step-10': {
    panelId: 'heading_case' as Unit43PanelId,
    layout: 'quad' as const,
    title: '客船原生统一面板',
    metrics: [
      ['超调量', 'overshootPct', '%'],
      ['峰值时间', 'peakTimeSec', ' s'],
      ['调节时间', 'settlingTimeSec', ' s'],
      ['相角裕度', 'phaseMarginDeg', '°'],
      ['截止频率', 'gainCrossoverRadPerSec', ' rad/s'],
    ],
  },
} as const;

type AnalysisStepId = keyof typeof ANALYSIS_CONFIG;

function isAnalysisStepId(stepId: string): stepId is AnalysisStepId {
  return stepId in ANALYSIS_CONFIG;
}

const CONTROL_METADATA: Record<Unit43PanelId, Record<string, { label: string; min: number; max: number; step: number; note?: string }>> = {
  pi_lead: {
    gain: { label: '控制器增益 K', min: 0.2, max: 12, step: 0.01 },
    piPoleFrequency: { label: 'PI 等效极点频率 ω_i', min: 0.02, max: 2, step: 0.01 },
    leadZeroFrequency: { label: '超前第一转折频率 ω_z', min: 0.05, max: 4, step: 0.01, note: '系统自动保持 ω_z < ω_p。' },
    leadPoleFrequency: { label: '超前第二转折频率 ω_p', min: 0.1, max: 10, step: 0.01, note: '系统自动保持 ω_p > ω_z。' },
  },
  lag_lead: {
    gain: { label: '控制器增益 K', min: 0.2, max: 12, step: 0.01 },
    lagPoleFrequency: { label: '滞后第一转折频率 ω_{p\\ell}', min: 0.01, max: 0.5, step: 0.005, note: '系统自动保持 ω_{p\\ell} < ω_{z\\ell}。' },
    lagZeroFrequency: { label: '滞后第二转折频率 ω_{z\\ell}', min: 0.05, max: 2, step: 0.01, note: '系统自动保持 ω_{z\\ell} > ω_{p\\ell}。' },
    leadZeroFrequency: { label: '超前第一转折频率 ω_{z\\alpha}', min: 0.2, max: 4, step: 0.01, note: '系统自动保持 ω_{z\\alpha} < ω_{p\\alpha}。' },
    leadPoleFrequency: { label: '超前第二转折频率 ω_{p\\alpha}', min: 0.3, max: 10, step: 0.01, note: '系统自动保持 ω_{p\\alpha} > ω_{z\\alpha}。' },
  },
  pid_filtered: {
    kp: { label: '等效比例增益 K_p', min: 0.02, max: 12, step: 0.01 },
    ki: { label: '积分增益 K_i', min: 0.001, max: 12, step: 0.01 },
    kd: { label: '微分增益 K_d', min: 0, max: 4, step: 0.01, note: '微分通道固定配一阶滤波，滤波时间常数为 0.05 s。' },
  },
  heading_case: {
    gain: { label: '控制器增益 K', min: 0.2, max: 8, step: 0.01 },
    leadZeroFrequency: { label: '超前第一转折频率 ω_z', min: 0.02, max: 0.5, step: 0.001, note: '系统自动保持 ω_z < ω_p。' },
    leadPoleFrequency: { label: '超前第二转折频率 ω_p', min: 0.04, max: 1.2, step: 0.001, note: '系统自动保持 ω_p > ω_z。' },
  },
  roll_boundary: {
    kp: { label: '等效比例增益 K_p', min: 0, max: 2, step: 0.01 },
    ki: { label: '积分增益 K_i', min: 0, max: 4, step: 0.01 },
    kd: { label: '微分增益 K_d', min: 0, max: 8, step: 0.01 },
  },
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function fmt(value: number | null | undefined, suffix = '', digits = 2) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—';
}

function renderPromptContent(blocks: PromptContent) {
  return (
    <div className="space-y-2">
      {blocks.map((block, index) =>
        block.type === 'math' ? (
          <div key={`${block.type}-${index}`}>
            <BlockMath math={block.value} />
          </div>
        ) : (
          <p key={`${block.type}-${index}`} className="premium-lesson-muted text-sm leading-6">
            {block.value}
          </p>
        ),
      )}
    </div>
  );
}

function SurfaceCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="premium-lesson-panel mt-4 px-5 py-4">
      {title ? <h3 className="premium-lesson-title text-lg font-semibold">{title}</h3> : null}
      <div className={title ? 'mt-3 space-y-3' : 'space-y-3'}>{children}</div>
    </section>
  );
}

function TablePanel({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <SurfaceCard title={title}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-300">
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`} className="border-b border-white/5 align-top last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${rowIndex}-${cellIndex}`} className="px-3 py-3 text-slate-100">
                    {cell.includes('\\') ? <BlockMath math={cell.replace(/^\$+|\$+$/g, '')} /> : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}

function MetricGrid({ rows }: { rows: MetricRow[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {rows.map((row) => (
        <div key={row.label} className="premium-lesson-surface-elevated rounded-2xl border border-white/10 p-3">
          <div className="premium-lesson-kicker">{row.label}</div>
          <div className="mt-2 text-xs text-slate-400">校正前性能指标</div>
          <div className="premium-lesson-title text-base font-semibold">{row.baseline}</div>
          <div className="mt-2 text-xs text-slate-400">当前性能指标</div>
          <div className="premium-lesson-title text-base font-semibold text-cyan-200">{row.current}</div>
        </div>
      ))}
    </div>
  );
}

function buildMetricRows(stepId: keyof typeof ANALYSIS_CONFIG, result: ReturnType<typeof useControlEngine>['result']) {
  const source = getUnit43DesignPayload(ANALYSIS_CONFIG[stepId].panelId);
  const current = result?.metrics;
  const steadyError = current ? Math.abs(1 - current.finalValue) : null;

  return ANALYSIS_CONFIG[stepId].metrics.map(([label, key, suffix]) => {
    const baselineValue =
      key === 'steadyError'
        ? source.metrics_before?.steady_state_error
        : key === 'overshootPct'
          ? source.metrics_before?.overshoot
          : key === 'peakTimeSec'
            ? source.metrics_before?.peak_time
            : key === 'settlingTimeSec'
              ? source.metrics_before?.settling_time
              : key === 'phaseMarginDeg'
                ? source.margins_before?.pm
                : key === 'gainCrossoverRadPerSec'
                  ? source.margins_before?.wc
                  : null;
    const currentValue = key === 'steadyError' ? steadyError : current?.[key as keyof typeof current] ?? null;

    return {
      label,
      baseline: fmt(baselineValue as number | null | undefined, suffix),
      current: fmt(currentValue as number | null | undefined, suffix),
    };
  });
}

function RevealChain({
  stepId,
  revealProgress,
  allowInlineReveal,
}: {
  stepId: RevealChainStepId;
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const steps = REVEALS[stepId];
  const teacherVisibleCount = Math.max(1, Math.min(steps.length, revealProgress || 1));
  const [localVisibleCount, setLocalVisibleCount] = useState(teacherVisibleCount);

  useEffect(() => {
    setLocalVisibleCount(teacherVisibleCount);
  }, [stepId, teacherVisibleCount]);

  const visibleCount = Math.max(teacherVisibleCount, allowInlineReveal ? localVisibleCount : teacherVisibleCount);
  const canRevealMore = allowInlineReveal && visibleCount < steps.length;

  return (
    <div className="space-y-3" data-progressive-reveal="step_click_reveal">
      {steps.slice(0, visibleCount).map((item, index) => (
        <button
          key={`${stepId}-${item.title}`}
          type="button"
          className={cn(
            'block w-full rounded-[28px] border border-cyan-400/40 bg-cyan-500/10 px-4 py-4 text-left transition',
            index === visibleCount - 1 && canRevealMore && 'ring-1 ring-cyan-400/40',
          )}
          onClick={() => {
            if (index === visibleCount - 1 && canRevealMore) {
              setLocalVisibleCount((current) => Math.min(current + 1, steps.length));
            }
          }}
        >
          <div className="premium-lesson-title text-sm font-medium">{item.title}</div>
          <div className="mt-3">{renderPromptContent(item.blocks)}</div>
          {index === visibleCount - 1 && canRevealMore ? (
            <div className="premium-lesson-muted mt-3 text-xs">点击当前最下方已显影步骤可继续展开下一层。</div>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function buildComparisonChartOption(
  series: ComparisonPoint[],
  config: {
    axisPreset?: { x: [number, number]; y: [number, number] };
    xAxisType?: 'value' | 'log';
    xAxisName: string;
    yAxisName: string;
    dynamicYAxis?: boolean;
  },
): EChartsCoreOption {
  const baselineData = series
    .filter((point) => typeof point.baseline === 'number' && Number.isFinite(point.baseline))
    .map((point) => [point.x, point.baseline as number]);
  const currentData = series
    .filter((point) => typeof point.current === 'number' && Number.isFinite(point.current))
    .map((point) => [point.x, point.current as number]);
  const yValues = [...baselineData, ...currentData].map((point) => point[1] as number);
  const yMin = yValues.length ? Math.min(...yValues) : config.axisPreset?.y[0];
  const yMax = yValues.length ? Math.max(...yValues) : config.axisPreset?.y[1];
  const ySpan = typeof yMin === 'number' && typeof yMax === 'number' ? Math.max(yMax - yMin, 1e-3) : 1;
  const yPad = Math.max(ySpan * 0.08, config.xAxisType === 'log' ? 0.5 : 0.02);
  const derivedYAxis =
    config.dynamicYAxis && typeof yMin === 'number' && typeof yMax === 'number'
      ? {
          min: Math.min(yMin, 0) - yPad,
          max: yMax + yPad,
        }
      : {
          min: config.axisPreset?.y[0],
          max: config.axisPreset?.y[1],
        };

  return {
    animation: false,
    legend: {
      top: 0,
      right: 8,
      data: ['原系统', '当前参数'],
      textStyle: { fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
    },
    tooltip: {
      trigger: 'axis',
      formatter: axisTooltipFormatter,
    },
    grid: { top: 34, right: 18, bottom: 42, left: 62 },
    xAxis: {
      type: config.xAxisType ?? 'value',
      min: config.axisPreset?.x[0],
      max: config.axisPreset?.x[1],
      name: config.xAxisName,
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: {
        formatter: formatAxisValue,
      },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    yAxis: {
      type: 'value',
      min: derivedYAxis.min,
      max: derivedYAxis.max,
      name: config.yAxisName,
      nameLocation: 'middle',
      nameGap: 42,
      axisLabel: {
        formatter: formatAxisValue,
      },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series: [
      {
        name: '原系统',
        type: 'line',
        color: BASELINE_SERIES_COLOR,
        showSymbol: false,
        smooth: false,
        lineStyle: { color: BASELINE_SERIES_COLOR, width: 2.2 },
        itemStyle: { color: BASELINE_SERIES_COLOR },
        data: baselineData,
      },
      {
        name: '当前参数',
        type: 'line',
        color: CURRENT_SERIES_COLOR,
        showSymbol: false,
        smooth: false,
        lineStyle: { color: CURRENT_SERIES_COLOR, width: 2.4 },
        itemStyle: { color: CURRENT_SERIES_COLOR },
        data: currentData,
      },
    ],
  };
}

function getDefaultAnalysisParams(stepId: AnalysisStepId): Unit43PanelParams {
  if (stepId === 'step-05') {
    return STEP_05_DEFAULT_PARAMS;
  }
  if (stepId === 'step-06') {
    return STEP_06_DEFAULT_PARAMS;
  }
  if (stepId === 'step-07') {
    return STEP_07_DEFAULT_PARAMS;
  }
  return STEP_10_DEFAULT_PARAMS;
}

function UnifiedAnalysisPanel({
  stepId,
  onWorkspaceParameterChange,
}: {
  stepId: AnalysisStepId;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const config = ANALYSIS_CONFIG[stepId];
  const [params, setParams] = useState<Unit43PanelParams>(() => getDefaultAnalysisParams(stepId));
  const deferred = useDeferredValue(params);
  const normalized = useMemo(
    () => normalizeUnit43PanelParams(config.panelId, deferred),
    [config.panelId, deferred],
  );
  const request = useMemo(
    () => buildUnit43AnalysisRequest(config.panelId, normalized),
    [config.panelId, normalized],
  );
  const fallbackResult = useMemo(() => getUnit43FallbackResult(config.panelId), [config.panelId]);
  const analysis = useControlEngine(request, fallbackResult);
  const controlMeta = CONTROL_METADATA[config.panelId];

  return (
    <SurfaceCard title={config.title}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="premium-lesson-tone-block premium-tone-cyan">
          <div className="premium-lesson-title text-sm font-medium">对象传函</div>
          <div className="mt-2">
            <BlockMath math={formatUnit43PlantFormula(config.panelId)} />
          </div>
        </div>
        <div className="premium-lesson-tone-block premium-tone-cyan">
          <div className="premium-lesson-title text-sm font-medium">当前控制器传函</div>
          <div className="mt-2">
            <BlockMath math={formatUnit43ControllerFormula(config.panelId, normalized)} />
          </div>
        </div>
      </div>
      <ControlFigureWorkspace request={request} fallbackResult={fallbackResult} layout={config.layout} />
      <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">控件区</summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {Object.entries(normalized).map(([key, value]) => {
            const meta = controlMeta[key] ?? { label: key, min: 0, max: 10, step: 0.01 };
            return (
              <div key={key}>
                <div className="premium-lesson-title text-sm font-medium">{meta.label}</div>
                <div className="premium-lesson-muted mt-1 text-xs">{fmt(value as number)}</div>
                {meta.note ? <div className="premium-lesson-muted mt-1 text-xs">{meta.note}</div> : null}
                <input
                  type="range"
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={value as number}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setParams((current) => ({ ...current, [key]: next }));
                    onWorkspaceParameterChange?.({ key, value: next, source: 'slider' });
                  }}
                  className="mt-2 w-full"
                />
              </div>
            );
          })}
        </div>
      </details>
      <MetricGrid rows={buildMetricRows(stepId, analysis.result)} />
    </SurfaceCard>
  );
}

function RollBoundaryPanel({
  onWorkspaceParameterChange,
}: {
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [params, setParams] = useState({ kp: 0.7858, ki: 2, kd: 4.104 });
  const deferred = useDeferredValue(params);
  const normalized = useMemo(
    () => normalizeUnit43RollBoundaryParams(deferred),
    [deferred],
  );
  const comparison = useMemo(
    () =>
      buildUnit43RollBoundaryComparison({
        kp: normalized.kp,
        ki: normalized.ki,
        kd: normalized.kd,
      }),
    [normalized.kd, normalized.ki, normalized.kp],
  );

  const timeData: ComparisonPoint[] = comparison.timeSeries.baseline.map((point, index) => ({
    x: point.x,
    baseline: point.y,
    current: comparison.timeSeries.current[index]?.y ?? null,
  }));

  const bodeData: ComparisonPoint[] = comparison.magnitudeSeries.baseline.map((point, index) => ({
    x: point.x,
    baseline: point.y,
    current: comparison.magnitudeSeries.current[index]?.y ?? null,
  }));

  const timeOption = buildComparisonChartOption(timeData, {
    axisPreset: getControlAxisPreset('unit43_roll_boundary', 'step'),
    xAxisName: 't / s',
    yAxisName: '\\varphi / rad',
    dynamicYAxis: true,
  });
  const bodeOption = buildComparisonChartOption(bodeData, {
    axisPreset: getControlAxisPreset('unit43_roll_boundary', 'magnitude'),
    xAxisType: 'log',
    xAxisName: 'ω / rad/s',
    yAxisName: '幅值 / dB',
    dynamicYAxis: true,
  });

  return (
    <SurfaceCard title="横摇减摇鳍双栏联动面板">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="premium-lesson-tone-block premium-tone-cyan">
          <div className="premium-lesson-title text-sm font-medium">对象传函</div>
          <div className="mt-2">
            <BlockMath math={formatUnit43PlantFormula('roll_boundary')} />
          </div>
        </div>
        <div className="premium-lesson-tone-block premium-tone-cyan">
          <div className="premium-lesson-title text-sm font-medium">当前控制器传函</div>
          <div className="mt-2">
            <BlockMath math={formatUnit43ControllerFormula('roll_boundary', normalized)} />
          </div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ControlChartPanel title="时域响应对比" option={timeOption} />
        <ControlChartPanel title="Bode 对比" option={bodeOption} />
      </div>
      <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">控件区</summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {Object.entries(normalized).map(([key, value]) => {
            const meta = CONTROL_METADATA.roll_boundary[key]!;
            return (
              <div key={key}>
                <div className="premium-lesson-title text-sm font-medium">{meta.label}</div>
                <div className="premium-lesson-muted mt-1 text-xs">{fmt(value as number)}</div>
                <input
                  type="range"
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={value as number}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setParams((current) => ({ ...current, [key]: next }));
                    onWorkspaceParameterChange?.({ key, value: next, source: 'slider' });
                  }}
                  className="mt-2 w-full"
                />
              </div>
            );
          })}
        </div>
      </details>
      <MetricGrid
        rows={[
          {
            label: '共振峰值',
            baseline: fmt(comparison.metrics.resonancePeakDb.baseline, ' dB'),
            current: fmt(comparison.metrics.resonancePeakDb.current, ' dB'),
          },
          {
            label: '共振频率',
            baseline: fmt(comparison.metrics.resonanceFrequencyRadPerSec.baseline, ' rad/s', 3),
            current: fmt(comparison.metrics.resonanceFrequencyRadPerSec.current, ' rad/s', 3),
          },
          {
            label: '振幅比',
            baseline: '1.000',
            current: fmt(comparison.metrics.amplitudeRatio.current, '', 3),
          },
        ]}
      />
    </SurfaceCard>
  );
}

export function UNIT_4_3KnowledgeMapVisual() {
  return (
    <SurfaceCard title="4-2 → 4-3 → 4-4 路径图">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ['4-2', '单结构起步卡'],
          ['4-3', '第一版方案与首轮验证'],
          ['4-4', '多目标权衡与下一轮调整'],
        ].map(([stage, detail]) => (
          <div key={stage} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
            <div className="premium-lesson-kicker">{stage}</div>
            <div className="premium-lesson-title mt-2 text-base font-semibold">{detail}</div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

export function UNIT_4_3StepAiAssistant({
  step: _step,
  onAiEvent: _onAiEvent,
}: {
  step: UNIT_4_3RuntimeStepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function pickFirstTableLikeBlock(stepManifest: InteractiveRuntimeStepManifest, moduleId: string) {
  const contentBlocks = stepManifest.contentBlocks;

  if (moduleId.includes('summary')) {
    const resultSummary = asRecord(contentBlocks.result_summary);
    if (Array.isArray(resultSummary.rows) && Array.isArray(resultSummary.columns)) {
      return resultSummary;
    }
  }

  for (const key of ['table_1', 'table_2', 'table_6', 'table_7', 'result_summary']) {
    const candidate = asRecord(contentBlocks[key]);
    if (Array.isArray(candidate.rows) && Array.isArray(candidate.columns)) {
      return candidate;
    }
  }

  for (const value of Object.values(contentBlocks)) {
    const candidate = asRecord(value);
    if (Array.isArray(candidate.rows) && Array.isArray(candidate.columns)) {
      return candidate;
    }
  }

  return null;
}

function pickProblemStatementBlock(stepManifest: InteractiveRuntimeStepManifest) {
  for (const key of ['problem_statement', 'fixed_problem', 'formula_block']) {
    const candidate = asRecord(stepManifest.contentBlocks[key]);
    if (Object.keys(candidate).length) {
      return candidate;
    }
  }
  return null;
}

function renderSentenceList(items: string[], columns = 'md:grid-cols-2') {
  return (
    <div className={cn('grid gap-3', columns)}>
      {items.map((item) => (
        <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm leading-6">
          {item}
        </div>
      ))}
    </div>
  );
}

type Unit43ModuleExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
};

const UNIT_4_3_MODULE_REGISTRY: InteractiveModuleRegistry<Unit43ModuleExtra> = {
  'stage-map': ({ step }) => {
    const intro = asRecord(step.contentBlocks.page_intro);
    const items = asStringArray(intro.path_items);
    return (
      <SurfaceCard title={String(intro.title ?? '路径定位')}>
        {items.length ? (
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
            {items.map((item, index) => (
              <Fragment key={item}>
                <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-center text-sm font-semibold">
                  {item}
                </div>
                {index < items.length - 1 ? <div className="hidden items-center text-slate-300 md:flex">→</div> : null}
              </Fragment>
            ))}
          </div>
        ) : null}
        {intro.lead ? <div className="premium-lesson-muted text-sm leading-6">{String(intro.lead)}</div> : null}
        <UNIT_4_3KnowledgeMapVisual />
      </SurfaceCard>
    );
  },
  'goal-card-row': ({ step }) => {
    const items = asStringArray(step.contentBlocks.goal_cards);
    return items.length ? <SurfaceCard title="课程目标">{renderSentenceList(items)}</SurfaceCard> : null;
  },
  'question-card-set': ({ step }) => {
    const items = asStringArray(step.contentBlocks.question_cards);
    return items.length ? <SurfaceCard title="对象分析四问">{renderSentenceList(items)}</SurfaceCard> : null;
  },
  'goal-card-set': ({ step }) => {
    const items = asStringArray(step.contentBlocks.target_constraints);
    return items.length ? <SurfaceCard title="目标约束">{renderSentenceList(items, 'md:grid-cols-3')}</SurfaceCard> : null;
  },
  'single-choice-card': ({ step }) => {
    const cards = step.interactionSpec.activityCards ?? [];
    return cards.length ? (
      <SurfaceCard title="本页选择">
        <div className="space-y-3">
          {cards.map((card) => (
            <div key={card.id} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
              <div className="premium-lesson-title text-sm font-medium">{card.prompt}</div>
              {card.options.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {card.options.map((option) => (
                    <span key={option.value} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                      {option.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SurfaceCard>
    ) : null;
  },
  'activity-card': ({ module }) => (
    <div data-manifest-activity-anchor={module.id} className="hidden" aria-hidden="true" />
  ),
  'activity-card-set': ({ module }) => (
    <div data-manifest-activity-anchor={module.id} className="hidden" aria-hidden="true" />
  ),
  'quiz-stack': ({ step }) => {
    const items = asStringArray(step.contentBlocks.post_quiz_items);
    return items.length ? <SurfaceCard title="后测题组">{renderSentenceList(items, 'grid-cols-1')}</SurfaceCard> : null;
  },
  'formula-card': ({ step }) => {
    const block = asRecord(step.contentBlocks.formula_block);
    const formulas = [block.object, block.controller]
      .filter(Boolean)
      .map((item) => String(item).replace(/^\$|\$$/g, ''));
    const explanation = String(block.explanation ?? '').trim();
    if (!formulas.length && !explanation) {
      return null;
    }
    return (
      <SurfaceCard title="对象与讲义基线">
        {formulas.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {formulas.map((formula) => (
              <BlockMath key={formula} math={formula} />
            ))}
          </div>
        ) : null}
        {explanation ? <div className="premium-lesson-muted text-sm leading-6">{explanation}</div> : null}
      </SurfaceCard>
    );
  },
  'native-table': ({ step, module }) => {
    const table = pickFirstTableLikeBlock(step, module.id);
    if (!table) return null;
    return (
      <TablePanel
        title={module.id.includes('validation') ? '表 6 · 客船首轮验证' : module.id.includes('roll') ? '表 7 · 横摇减摇鳍结果' : '结构判断表'}
        headers={asStringArray(table.columns)}
        rows={(table.rows as Array<unknown[]>).map((row) => row.map((cell) => String(cell)))}
      />
    );
  },
  'native-formula-table': ({ step }) => {
    const table = pickFirstTableLikeBlock(step, 'table_2');
    if (!table) return null;
    return (
      <TablePanel
        title="表 2 · 三类复合结构总览"
        headers={asStringArray(table.columns)}
        rows={(table.rows as Array<unknown[]>).map((row) => row.map((cell) => String(cell)))}
      />
    );
  },
  'table-card': ({ step, module }) => {
    const table = pickFirstTableLikeBlock(step, module.id);
    if (!table) return null;
    return (
      <TablePanel
        title={module.id.includes('pi') ? '表 3 · PI + 超前结果摘要' : module.id.includes('lag') ? '表 4 · 滞后 + 超前结果摘要' : '表 5 · 带微分滤波 PID 结果摘要'}
        headers={asStringArray(table.columns)}
        rows={(table.rows as Array<unknown[]>).map((row) => row.map((cell) => String(cell)))}
      />
    );
  },
  'problem-statement': ({ step }) => {
    const block = pickProblemStatementBlock(step);
    if (!block) return null;
    const formulas = [block.object, block.controller, block.controller_form]
      .filter(Boolean)
      .map((item) => String(item).replace(/^\$|\$$/g, ''));
    const notes = [
      block.note,
      block.task,
      block.given_condition,
      asRecord(step.contentBlocks.why_lead_first).text,
      asRecord(step.contentBlocks.final_sentence).text,
      asRecord(step.contentBlocks.closing_sentence).text,
    ]
      .filter(Boolean)
      .map((item) => String(item));
    const requirementItems = [
      ...asStringArray(block.requirements),
      ...asStringArray(block.goals),
    ];

    return (
      <SurfaceCard title={step.id === 'step-13' ? '边界案例：横摇减摇鳍首先是扰动通道重写' : step.id === 'step-11' ? '最小例题' : '题面与对象'}>
        {formulas.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {formulas.map((formula) => (
              <BlockMath key={formula} math={formula} />
            ))}
          </div>
        ) : null}
        {notes.map((note) => (
          <div key={note} className="premium-lesson-muted text-sm leading-6">
            {note}
          </div>
        ))}
        {requirementItems.length ? renderSentenceList(requirementItems, 'md:grid-cols-2') : null}
      </SurfaceCard>
    );
  },
  'summary-card': ({ step }) => {
    const takeaways = asStringArray(step.contentBlocks.takeaways);
    if (takeaways.length) {
      return <SurfaceCard title="收束与带走">{renderSentenceList(takeaways, 'grid-cols-1')}</SurfaceCard>;
    }
    const sentence = [
      asRecord(step.contentBlocks.branch_summary).text,
      asRecord(step.contentBlocks.summary_sentence).text,
      asRecord(step.contentBlocks.closing_sentence).text,
    ]
      .find(Boolean);
    return sentence ? (
      <SurfaceCard title="要点总结">
        <div className="premium-lesson-muted text-sm leading-6">{String(sentence)}</div>
      </SurfaceCard>
    ) : null;
  },
  'template-card': ({ step, module }) => {
    const templateCards = asRecord(step.contentBlocks.template_cards);
    const key = module.id.startsWith('analysis')
      ? 'analysis_card'
      : module.id.startsWith('scheme')
        ? 'scheme_card'
        : 'issue_card';
    const items = asStringArray(templateCards[key]);
    if (!items.length) return null;
    const title = key === 'analysis_card' ? '对象分析记录单' : key === 'scheme_card' ? '初始方案表达卡' : '问题清单移交表';
    return <SurfaceCard title={title}>{renderSentenceList(items, 'grid-cols-1')}</SurfaceCard>;
  },
  'step-reveal-chain': ({ step, extra }) => (
    <SurfaceCard title="逐步显影链">
      {isRevealChainStepId(step.id) ? (
        <RevealChain
          stepId={step.id}
          revealProgress={extra.revealProgress}
          allowInlineReveal={extra.allowInlineReveal}
        />
      ) : null}
    </SurfaceCard>
  ),
  'rust-analysis-panel': ({ step, extra }) =>
    isAnalysisStepId(step.id) ? (
      <UnifiedAnalysisPanel
        stepId={step.id}
        onWorkspaceParameterChange={extra.onWorkspaceParameterChange}
      />
    ) : null,
  'rust-time-compare-panel': ({ step, module, extra }) =>
    module.id === 'roll-native-time-compare' ? (
      <RollBoundaryPanel onWorkspaceParameterChange={extra.onWorkspaceParameterChange} />
    ) : null,
  'rust-bode-compare-panel': () => null,
  'figure-note': ({ step }) => {
    const sentence = String(asRecord(step.contentBlocks.closing_sentence).text ?? '').trim();
    return sentence ? (
      <SurfaceCard title="边界结论">
        <div className="premium-lesson-muted text-sm leading-6">{sentence}</div>
      </SurfaceCard>
    ) : null;
  },
  'title-card': ({ step }) => {
    const text = String(asRecord(step.contentBlocks.post_quiz_title).text ?? '').trim();
    return text ? (
      <SurfaceCard title="后测提示">
        <div className="premium-lesson-muted text-sm leading-6">{text}</div>
      </SurfaceCard>
    ) : null;
  },
  'route-card': ({ step }) => {
    const text = String(asRecord(step.contentBlocks.next_route).text ?? '').trim();
    return text ? (
      <SurfaceCard title="去向">
        <div className="premium-lesson-muted text-sm leading-6">{text}</div>
      </SurfaceCard>
    ) : null;
  },
};

export function UNIT_4_3StepContentPanel({
  manifest,
  step,
  stepManifest,
  revealProgress,
  allowInlineReveal,
  onWorkspaceParameterChange,
}: {
  manifest: InteractiveRuntimeManifest;
  step: UNIT_4_3RuntimeStepDefinition;
  stepManifest: InteractiveRuntimeStepManifest;
  revealProgress: number;
  allowInlineReveal: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  return (
    <div>
      {renderInteractiveManifestStep({
        manifest,
        step: stepManifest,
        moduleRegistry: UNIT_4_3_MODULE_REGISTRY,
        extra: {
          revealProgress,
          allowInlineReveal,
          onWorkspaceParameterChange,
        },
      })}
    </div>
  );
}

const UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY = createManifestStudentActivityRegistry<UNIT_4_3RuntimeStepDefinition>() as unknown as StudentInteractiveActivityRegistry<
  UNIT_4_3RuntimeStepDefinition,
  UNIT_4_3StepResponse
>;

const UNIT_4_3_SHARED_TEACHER_ACTIVITY_REGISTRY = createManifestTeacherActivityRegistry<UNIT_4_3RuntimeStepDefinition>() as unknown as TeacherInteractiveActivityRegistry<
  UNIT_4_3RuntimeStepDefinition,
  TeacherResponseItem
>;

const UNIT_4_3_STUDENT_ACTIVITY_REGISTRY: StudentInteractiveActivityRegistry<
  UNIT_4_3RuntimeStepDefinition,
  UNIT_4_3StepResponse
> = {
  none: () => null,
  display: () => null,
  summary: () => null,
  worked_example_reveal: () => null,
  single_choice: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.single_choice,
  quiz_group: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.quiz_group,
  activity_card_set: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.activity_card_set,
  task_card_workspace: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.task_card_workspace,
};

export function UNIT_4_3StudentActivityForm({
  stepManifest,
  step,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
  onWorkspaceParameterChange: _onWorkspaceParameterChange,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  step: UNIT_4_3RuntimeStepDefinition;
  savedResponse?: UNIT_4_3StepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: UNIT_4_3StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  if (!isUNIT_4_3InteractivePageType(step.pageType)) {
    return null;
  }

  return (
    <>
      {renderStudentInteractiveActivity({
        registry: UNIT_4_3_STUDENT_ACTIVITY_REGISTRY,
        step,
        stepManifest,
        savedResponse,
        released,
        browseEnabled,
        answerVisible,
        revealProgress,
        onSubmit,
      })}
    </>
  );
}

export function UNIT_4_3StudentSummaryPanel({ responses }: { responses: Record<string, UNIT_4_3StepResponse> }) {
  return (
    <SurfaceCard title="第一版方案学习收束">
      <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm leading-6">
        已完成 {Object.keys(responses).length} 个步骤的作答记录。请把对象分析、结构分流、参数方向、首轮验证与问题清单一起带到 4-4。
      </div>
    </SurfaceCard>
  );
}

export function UNIT_4_3TeacherActivitySummary({
  stepManifest,
  step,
  responses,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  step: UNIT_4_3RuntimeStepDefinition;
  responses: TeacherResponseItem[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const renderSummary = () => (
    <SurfaceCard title="教师汇总与控制">
      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
          {released ? '收起作答' : '发放作答'}
        </button>
        <button type="button" onClick={onToggleBrowse} className="premium-lesson-action-secondary">
          {browseEnabled ? '关闭浏览' : '开放浏览'}
        </button>
        <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-secondary">
          {answerVisible ? '隐藏参考答案' : '显示参考答案'}
        </button>
        {step.pageType === 'worked_example_reveal' ? (
          <div className="flex gap-2">
            <button type="button" onClick={onAdvanceReveal} className="premium-lesson-action-secondary flex-1">
              教师逐步显影 +1
            </button>
            <button type="button" onClick={onResetReveal} className="premium-lesson-action-secondary flex-1">
              重置显影
            </button>
          </div>
        ) : null}
      </div>
      <div className="premium-lesson-muted text-sm">当前显影层级：{revealProgress}</div>
      <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
        <div className="premium-lesson-title text-sm font-medium">学生提交概览</div>
        <div className="premium-lesson-muted mt-2 text-sm">当前页已收到 {responses.length} 份提交。</div>
        <div className="mt-3 space-y-2">
          {responses.length ? (
            responses.map((item) => (
              <div key={`${step.id}-${item.studentName}`} className="rounded-2xl border border-white/10 px-3 py-2 text-sm">
                <div className="font-medium">{item.studentName}</div>
                <div className="mt-1 text-slate-300">
                  {Object.values(item.response.answers).filter(Boolean).join(' / ') || '已提交空白内容'}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-300">当前尚无学生提交。</div>
          )}
        </div>
      </div>
    </SurfaceCard>
  );

  const registry: TeacherInteractiveActivityRegistry<UNIT_4_3RuntimeStepDefinition, TeacherResponseItem> = {
    none: renderSummary,
    display: renderSummary,
    summary: renderSummary,
    activity_card_set: UNIT_4_3_SHARED_TEACHER_ACTIVITY_REGISTRY.activity_card_set,
    single_choice: UNIT_4_3_SHARED_TEACHER_ACTIVITY_REGISTRY.single_choice,
    worked_example_reveal: renderSummary,
    task_card_workspace: UNIT_4_3_SHARED_TEACHER_ACTIVITY_REGISTRY.task_card_workspace,
    quiz_group: UNIT_4_3_SHARED_TEACHER_ACTIVITY_REGISTRY.quiz_group,
  };

  return (
    <>
      {renderTeacherInteractiveActivity({
        registry,
        step,
        stepManifest,
        responses,
        released,
        browseEnabled,
        answerVisible,
        revealProgress,
        onToggleRelease,
        onToggleBrowse,
        onToggleAnswerVisible,
        onAdvanceReveal,
        onResetReveal,
      })}
    </>
  );
}
