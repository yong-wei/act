'use client';

import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import type { InteractiveRuntimeManifest, InteractiveRuntimeStepManifest } from '@/lib/interactive-lesson-manifest';
import {
  createManifestContentModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/content-renderers';
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
type ComparisonPoint = { x: number; baseline: number | null; current: number | null };

const STEP_05_DEFAULT_PARAMS = { gain: 6, piPoleFrequency: 1 / 1.8, leadZeroFrequency: 1 / 0.9, leadPoleFrequency: 1 / 0.18 } as const;
const STEP_06_DEFAULT_PARAMS = { gain: 6, lagPoleFrequency: 1 / 20, lagZeroFrequency: 1 / 5, leadZeroFrequency: 1 / 0.8, leadPoleFrequency: 1 / 0.16 } as const;
const STEP_07_DEFAULT_PARAMS = { kp: 3.5, ki: 3.5 / 1.5, kd: 0.25 } as const;
const STEP_10_DEFAULT_PARAMS = { gain: 2.8, leadZeroFrequency: 0.1, leadPoleFrequency: 1 / 4.06 } as const;
const BASELINE_SERIES_COLOR = '#f59e0b';
const CURRENT_SERIES_COLOR = '#22d3ee';

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

function fmt(value: number | null | undefined, suffix = '', digits = 2) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—';
}

function SurfaceCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="premium-lesson-panel mt-4 px-5 py-4">
      {title ? <h3 className="premium-lesson-title text-lg font-semibold">{title}</h3> : null}
      <div className={title ? 'mt-3 space-y-3' : 'space-y-3'}>{children}</div>
    </section>
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

type Unit43ModuleExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
};

function createUNIT_4_3ModuleRegistry(
  manifest: InteractiveRuntimeManifest,
  extra: Unit43ModuleExtra,
): InteractiveModuleRegistry<Unit43ModuleExtra> {
  const sharedRegistry = createManifestContentModuleRegistry({
    revealProgress: extra.revealProgress,
    allowInlineReveal: extra.allowInlineReveal,
  });

  return {
    ...sharedRegistry,
    'stage-map': (props) => (
      <>
        {sharedRegistry['stage-map']?.({
          manifest,
          step: props.step,
          module: props.module,
          extra: {
            revealProgress: extra.revealProgress,
            allowInlineReveal: extra.allowInlineReveal,
          },
        })}
        <UNIT_4_3KnowledgeMapVisual />
      </>
    ),
    'rust-analysis-panel': ({ step, module }) =>
      isAnalysisStepId(step.id) ? (
        <UnifiedAnalysisPanel
          stepId={step.id}
          onWorkspaceParameterChange={extra.onWorkspaceParameterChange}
        />
      ) : (
        sharedRegistry['rust-analysis-panel']?.({
          manifest,
          step,
          module,
          extra: {
            revealProgress: extra.revealProgress,
            allowInlineReveal: extra.allowInlineReveal,
          },
        }) ?? null
      ),
    'rust-time-compare-panel': ({ step, module }) =>
      module.id === 'roll-native-time-compare' ? (
        <RollBoundaryPanel onWorkspaceParameterChange={extra.onWorkspaceParameterChange} />
      ) : (
        sharedRegistry['rust-time-compare-panel']?.({
          manifest,
          step,
          module,
          extra: {
            revealProgress: extra.revealProgress,
            allowInlineReveal: extra.allowInlineReveal,
          },
        }) ?? null
      ),
    'rust-bode-compare-panel': ({ module }) => (
      <SurfaceCard title={String(module.payload.title ?? 'Bode 对比')}>
        <div className="premium-lesson-muted text-sm leading-6">
          Bode 对比与时域响应共用同一组横摇减摇鳍参数，已在上方双栏联动面板中同步呈现。
        </div>
      </SurfaceCard>
    ),
  };
}

export function UNIT_4_3StepContentPanel({
  manifest,
  step: _step,
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
  const moduleExtra = {
    revealProgress,
    allowInlineReveal,
    onWorkspaceParameterChange,
  };
  const moduleRegistry = createUNIT_4_3ModuleRegistry(manifest, moduleExtra);

  return (
    <div>
      {renderInteractiveManifestStep({
        manifest,
        step: stepManifest,
        moduleRegistry,
        extra: moduleExtra,
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
