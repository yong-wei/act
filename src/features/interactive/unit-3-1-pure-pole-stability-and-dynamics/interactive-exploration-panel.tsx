'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import type { ECharts } from 'echarts/core';

import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import { RootLocusPanel } from '@/resources/control-system/charts/control-analysis-panels';
import { axisTooltipFormatter, formatAxisValue } from '@/resources/control-system/charts/control-bode-options';
import { ControlChartPanel } from '@/resources/control-system/charts/control-chart-panel';

import type { WorkspaceParameterChange } from './workspace';

const UNIT_31_REFERENCE_LABEL = '参考模型';
const UNIT_31_THREE_POLE_LABEL = '当前三极点系统';
const UNIT_31_DYNAMIC_CASE_ID = 'unit31_triple_pole_explorer';
const UNIT_31_REFERENCE_CASE_ID = 'unit31_reference_model';
const UNIT_31_ROOT_LOCUS_CASE_ID = 'unit31_triple_pole_root_locus';

const ROOT_LOCUS_AXIS_PRESET = {
  x: [-6.4, 0.8] as [number, number],
  y: [-3.2, 3.2] as [number, number],
};

const EXTRA_POLE_RANGE = {
  min: 1.2,
  max: 6,
} as const;

const EXTRA_POLE_PRESETS = [
  { label: '系统 A', value: 5 },
  { label: '中间态', value: 3 },
  { label: '系统 B', value: 1.4 },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildReferenceRequest(): ControlAnalysisRequest {
  return {
    runtimeMode: 'analysis',
    caseId: UNIT_31_REFERENCE_CASE_ID,
    plant: {
      numerator: [3.2],
      denominator: [1, 1.6, 0],
      coefficientOrder: 'descending',
      label: '参考模型开环等效',
    },
    structures: [
      {
        kind: 'gain',
        enabled: true,
        params: { k: 1 },
        label: 'K',
      },
    ],
    outputs: ['step_response', 'magnitude', 'phase', 'root_locus', 'bode'],
    timeRange: { start: 0, end: 8, samples: 360 },
    frequencyRange: { min: 1e-1, max: 1e2, samples: 320 },
    rootLocus: { minGain: 0, maxGain: 8, samples: 220, currentGain: 1 },
  };
}

function buildThreePoleDynamicRequest(extraPoleMagnitude: number): ControlAnalysisRequest {
  return {
    runtimeMode: 'analysis',
    caseId: UNIT_31_DYNAMIC_CASE_ID,
    plant: {
      numerator: [3.2 * extraPoleMagnitude],
      denominator: [1, extraPoleMagnitude + 1.6, 1.6 * extraPoleMagnitude + 3.2, 0],
      coefficientOrder: 'descending',
      label: '三极点动态比较对象',
    },
    structures: [
      {
        kind: 'gain',
        enabled: true,
        params: { k: 1 },
        label: 'K',
      },
    ],
    outputs: ['step_response', 'magnitude', 'phase', 'root_locus', 'bode'],
    timeRange: { start: 0, end: 8, samples: 360 },
    frequencyRange: { min: 1e-1, max: 1e2, samples: 320 },
    rootLocus: { minGain: 0, maxGain: 8, samples: 220, currentGain: 1 },
  };
}

function buildRootLocusRequest(extraPoleMagnitude: number): ControlAnalysisRequest {
  return {
    runtimeMode: 'analysis',
    caseId: UNIT_31_ROOT_LOCUS_CASE_ID,
    plant: {
      numerator: [3.2 * extraPoleMagnitude],
      denominator: [1, extraPoleMagnitude + 1.6, 1.6 * extraPoleMagnitude + 3.2, 3.2 * extraPoleMagnitude],
      coefficientOrder: 'descending',
      label: '三极点系统开环对象',
    },
    structures: [
      {
        kind: 'gain',
        enabled: true,
        params: { k: 1 },
        label: 'K',
      },
    ],
    outputs: ['root_locus'],
    timeRange: { start: 0, end: 8, samples: 240 },
    frequencyRange: { min: 1e-1, max: 1e2, samples: 240 },
    rootLocus: { minGain: 0, maxGain: 60, samples: 420, currentGain: 1 },
  };
}

function formatNumber(value: number | null | undefined, suffix = ''): string {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }
  return `${value.toFixed(2)}${suffix}`;
}

function buildStepComparisonOption(reference: ControlAnalysisResult, current: ControlAnalysisResult): EChartsCoreOption {
  const allPoints = [...reference.stepResponse.points, ...current.stepResponse.points];
  const xMax = Math.max(...allPoints.map((point) => point.x), 6);
  const yMin = Math.min(0, ...allPoints.map((point) => point.y)) - 0.05;
  const yMax = Math.max(...allPoints.map((point) => point.y), 1.2) + 0.05;

  return {
    animation: false,
    legend: {
      top: 8,
      data: [UNIT_31_REFERENCE_LABEL, UNIT_31_THREE_POLE_LABEL],
    },
    tooltip: {
      trigger: 'axis',
      formatter: axisTooltipFormatter,
    },
    grid: { left: 56, right: 20, top: 52, bottom: 42 },
    xAxis: {
      type: 'value',
      name: 't / s',
      nameLocation: 'middle',
      nameGap: 28,
      min: 0,
      max: xMax,
      axisLabel: { formatter: formatAxisValue },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    yAxis: {
      type: 'value',
      name: 'y(t)',
      nameLocation: 'middle',
      nameGap: 38,
      min: yMin,
      max: yMax,
      axisLabel: { formatter: formatAxisValue },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series: [
      {
        name: UNIT_31_REFERENCE_LABEL,
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 2.4, color: '#38bdf8' },
        data: reference.stepResponse.points.map((point) => [point.x, point.y]),
      },
      {
        name: UNIT_31_THREE_POLE_LABEL,
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 2.4, color: '#fb7185' },
        data: current.stepResponse.points.map((point) => [point.x, point.y]),
      },
    ],
  };
}

function buildVerticalMarker(
  x: number,
  yMin: number,
  yMax: number,
  xAxisIndex: number,
  yAxisIndex: number,
  color: string,
  name: string,
) {
  return {
    name,
    type: 'line',
    showSymbol: false,
    xAxisIndex,
    yAxisIndex,
    lineStyle: { color, type: 'dashed', width: 1.6 },
    data: [[x, yMin], [x, yMax]],
    tooltip: { show: false },
  };
}

function buildBodeComparisonOption(
  reference: ControlAnalysisResult,
  current: ControlAnalysisResult,
  extraPoleMagnitude: number,
): EChartsCoreOption {
  const magnitudeValues = [...reference.magnitude.points, ...current.magnitude.points].map((point) => point.y);
  const phaseValues = [...reference.phase.points, ...current.phase.points].map((point) => point.y);
  const magMin = Math.min(...magnitudeValues, -45) - 4;
  const magMax = Math.max(...magnitudeValues, 4) + 4;
  const phaseMin = Math.min(...phaseValues, -230) - 8;
  const phaseMax = Math.max(...phaseValues, 5) + 8;
  const referenceBandwidth = reference.metrics.bandwidthRadPerSec;
  const currentBandwidth = current.metrics.bandwidthRadPerSec;

  return {
    animation: false,
    legend: {
      top: 8,
      data: [UNIT_31_REFERENCE_LABEL, UNIT_31_THREE_POLE_LABEL],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: axisTooltipFormatter,
    },
    axisPointer: {
      link: [{ xAxisIndex: [0, 1] }],
    },
    grid: [
      { left: 56, right: 24, top: 52, height: '32%' },
      { left: 56, right: 24, top: '60%', height: '24%' },
    ],
    xAxis: [
      {
        type: 'log',
        min: 1e-1,
        max: 1e2,
        gridIndex: 0,
        axisLabel: { formatter: formatAxisValue },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
      {
        type: 'log',
        min: 1e-1,
        max: 1e2,
        gridIndex: 1,
        name: 'ω / rad/s',
        nameLocation: 'middle',
        nameGap: 34,
        axisLabel: { formatter: formatAxisValue },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: '幅值 / dB',
        min: magMin,
        max: magMax,
        axisLabel: { formatter: formatAxisValue },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        name: '相位 / deg',
        min: phaseMin,
        max: phaseMax,
        axisLabel: { formatter: formatAxisValue },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
    ],
    series: [
      {
        name: UNIT_31_REFERENCE_LABEL,
        type: 'line',
        showSymbol: false,
        xAxisIndex: 0,
        yAxisIndex: 0,
        lineStyle: { width: 2.2, color: '#38bdf8' },
        data: reference.magnitude.points.map((point) => [point.x, point.y]),
      },
      {
        name: UNIT_31_THREE_POLE_LABEL,
        type: 'line',
        showSymbol: false,
        xAxisIndex: 0,
        yAxisIndex: 0,
        lineStyle: { width: 2.2, color: '#fb7185' },
        data: current.magnitude.points.map((point) => [point.x, point.y]),
      },
      {
        name: UNIT_31_REFERENCE_LABEL,
        type: 'line',
        showSymbol: false,
        xAxisIndex: 1,
        yAxisIndex: 1,
        lineStyle: { width: 2.2, type: 'dashed', color: '#38bdf8' },
        data: reference.phase.points.map((point) => [point.x, point.y]),
      },
      {
        name: UNIT_31_THREE_POLE_LABEL,
        type: 'line',
        showSymbol: false,
        xAxisIndex: 1,
        yAxisIndex: 1,
        lineStyle: { width: 2.2, type: 'dashed', color: '#fb7185' },
        data: current.phase.points.map((point) => [point.x, point.y]),
      },
      buildVerticalMarker(extraPoleMagnitude, magMin, magMax, 0, 0, '#f59e0b', 'ω_break'),
      buildVerticalMarker(extraPoleMagnitude, phaseMin, phaseMax, 1, 1, '#f59e0b', 'ω_break'),
      ...(referenceBandwidth
        ? [
            buildVerticalMarker(referenceBandwidth, magMin, magMax, 0, 0, '#22c55e', 'ω_bw,ref'),
            buildVerticalMarker(referenceBandwidth, phaseMin, phaseMax, 1, 1, '#22c55e', 'ω_bw,ref'),
          ]
        : []),
      ...(currentBandwidth
        ? [
            buildVerticalMarker(currentBandwidth, magMin, magMax, 0, 0, '#a855f7', 'ω_bw,3p'),
            buildVerticalMarker(currentBandwidth, phaseMin, phaseMax, 1, 1, '#a855f7', 'ω_bw,3p'),
          ]
        : []),
    ],
  };
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'cyan' | 'amber' | 'emerald' | 'rose';
}) {
  return (
    <div className={`premium-lesson-tone-block premium-tone-${tone}`}>
      <div className="premium-lesson-caption text-[11px]">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

export function UNIT_3_1InteractiveExplorationPanel({
  mode,
  defaultPoleMagnitude = 5,
  onParameterChange,
}: {
  mode: 'step' | 'bode';
  defaultPoleMagnitude?: number;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [extraPoleMagnitude, setExtraPoleMagnitude] = useState(defaultPoleMagnitude);
  const [isDraggingPole, setIsDraggingPole] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);

  const referenceRequest = useMemo(() => buildReferenceRequest(), []);
  const currentDynamicRequest = useMemo(() => buildThreePoleDynamicRequest(extraPoleMagnitude), [extraPoleMagnitude]);
  const rootLocusRequest = useMemo(() => buildRootLocusRequest(extraPoleMagnitude), [extraPoleMagnitude]);

  const referenceAnalysis = useControlEngine(referenceRequest);
  const currentDynamicAnalysis = useControlEngine(currentDynamicRequest);
  const rootLocusAnalysis = useControlEngine(rootLocusRequest);

  const referenceResult = referenceAnalysis.result;
  const currentDynamicResult = currentDynamicAnalysis.result;
  const rootLocusResult = rootLocusAnalysis.result;

  const comparisonOption = useMemo(() => {
    if (!referenceResult || !currentDynamicResult) {
      return null;
    }
    return mode === 'step'
      ? buildStepComparisonOption(referenceResult, currentDynamicResult)
      : buildBodeComparisonOption(referenceResult, currentDynamicResult, extraPoleMagnitude);
  }, [currentDynamicResult, extraPoleMagnitude, mode, referenceResult]);

  const updatePole = useCallback((value: number, source: WorkspaceParameterChange['source']) => {
    const nextValue = Number(clamp(value, EXTRA_POLE_RANGE.min, EXTRA_POLE_RANGE.max).toFixed(2));
    setExtraPoleMagnitude(nextValue);
    onParameterChange?.({
      key: 'extraPoleMagnitude',
      value: nextValue,
      source,
    });
  }, [onParameterChange]);

  useEffect(() => {
    if (!isDraggingPole) {
      return undefined;
    }

    const handleMove = (event: PointerEvent) => {
      const track = trackRef.current;
      if (!track) {
        return;
      }
      const rect = track.getBoundingClientRect();
      const chart = chartRef.current;
      if (!chart) {
        return;
      }
      const axisPoint = chart.convertFromPixel(
        { xAxisIndex: 0, yAxisIndex: 0 },
        [event.clientX - rect.left, event.clientY - rect.top],
      );
      if (!Array.isArray(axisPoint) || axisPoint.length < 2 || !Number.isFinite(Number(axisPoint[0]))) {
        return;
      }
      updatePole(-Number(axisPoint[0]), 'drag');
    };

    const handleUp = () => setIsDraggingPole(false);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDraggingPole, updatePole]);

  const currentBandwidth = currentDynamicResult?.metrics.bandwidthRadPerSec;
  const referenceBandwidth = referenceResult?.metrics.bandwidthRadPerSec;
  const intrusionJudgement =
    referenceBandwidth != null && extraPoleMagnitude <= referenceBandwidth
      ? '附加极点已经进入参考模型主要带宽'
      : '附加极点仍在参考模型主要带宽之外';
  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-medium">
            {mode === 'step' ? '三极点互动探索' : '三极点频域互动探索'}
          </div>
          <div className="premium-lesson-muted mt-1 text-sm">
            直接在根轨迹图里拖动开环附加极点，左侧根轨迹与右侧曲线会同时重算；原系统开环极点固定标在
            {' '}
            <span className="font-medium">-0.8 ± j1.6</span>
            {' '}
            与
            {' '}
            <span className="font-medium">-p₃</span>
            。
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXTRA_POLE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => updatePole(preset.value, 'preset')}
              className="premium-lesson-tone-pill premium-tone-slate"
            >
              {preset.label} · p₃ = -{preset.value}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="relative">
          {rootLocusResult ? (
            <RootLocusPanel
              result={rootLocusResult}
              caseId={UNIT_31_ROOT_LOCUS_CASE_ID}
              axisPresetOverride={ROOT_LOCUS_AXIS_PRESET}
              interactiveLayerRef={trackRef}
              onChartReady={(chart) => {
                chartRef.current = chart;
              }}
              interactiveHandles={[
                {
                  id: 'extra-open-loop-pole',
                  kind: 'pole',
                  point: { re: -extraPoleMagnitude, im: 0 },
                  draggable: true,
                  ariaLabel: '拖动附加极点',
                  cursor: 'ew-resize',
                },
              ]}
              onHandlePointerDown={(_handleId, event) => {
                event.preventDefault();
                setIsDraggingPole(true);
              }}
              className="flex h-full flex-col"
              chartClassName="h-[420px]"
            />
          ) : (
            <div className="premium-lesson-tone-block premium-tone-slate">
              正在生成左侧根轨迹面板。
            </div>
          )}
        </div>

        {comparisonOption ? (
          <ControlChartPanel
            title={mode === 'step' ? '原系统与三极点系统响应对比' : '原系统与三极点系统 Bode 对比'}
            meta={
              mode === 'step'
                ? '左图拖动开环极点后，右图实时重算参考模型与当前三极点系统的响应。'
                : '左图拖动开环极点后，右图实时重算 Bode 对比；橙线为转折频率，绿线/紫线为参考与当前带宽。'
            }
            option={comparisonOption}
            chartClassName="h-[420px]"
          />
        ) : (
          <div className="premium-lesson-tone-block premium-tone-slate">
            正在生成右侧对照面板。
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricCard
          label={mode === 'step' ? '附加极点位置' : '附加极点转折频率'}
          value={mode === 'step' ? `p₃ = -${extraPoleMagnitude.toFixed(2)}` : `ω_break = ${extraPoleMagnitude.toFixed(2)} rad/s`}
          tone="amber"
        />
        {mode === 'step' ? (
          <>
            <MetricCard
              label="当前系统超调量"
              value={formatNumber(currentDynamicResult?.metrics.overshootPct, '%')}
              tone="rose"
            />
            <MetricCard
              label="当前系统峰值时间"
              value={formatNumber(currentDynamicResult?.metrics.peakTimeSec, ' s')}
              tone="cyan"
            />
            <MetricCard
              label="当前系统调节时间"
              value={formatNumber(currentDynamicResult?.metrics.settlingTimeSec, ' s')}
              tone="emerald"
            />
          </>
        ) : (
          <>
            <MetricCard label="参考模型带宽" value={formatNumber(referenceBandwidth, ' rad/s')} tone="emerald" />
            <MetricCard label="当前系统带宽" value={formatNumber(currentBandwidth, ' rad/s')} tone="rose" />
            <MetricCard label="频域判断" value={intrusionJudgement} tone="cyan" />
          </>
        )}
      </div>
    </section>
  );
}
