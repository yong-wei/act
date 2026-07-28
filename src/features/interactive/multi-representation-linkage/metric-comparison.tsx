'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  ControlAnalysisResult,
  ControlEngineState,
  ControlMetrics,
} from '@/resources/control-system/analysis/types';
import { CONTROL_SIGNAL_CURVE_STYLES } from '@/resources/control-system/charts/control-signal-styles';
import type { DesignSnapshot } from './design-snapshots';

export const CURRENT_DESIGN_ID = 'current-design';

type MetricKey = Exclude<keyof ControlMetrics, 'phaseCrossoverStatus'>;
type ResponseType = DesignSnapshot['design']['responseType'];

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  symbol: string;
  unit: string;
  differenceUnit: string;
  category: '时域指标' | '频域指标';
  stepOnly?: boolean;
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: 'overshootPct', label: '超调量', symbol: 'Mp', unit: '%', differenceUnit: '个百分点', category: '时域指标', stepOnly: true },
  { key: 'riseTimeSec', label: '上升时间', symbol: 'tr', unit: 's', differenceUnit: 's', category: '时域指标', stepOnly: true },
  { key: 'settlingTimeSec', label: '调节时间', symbol: 'ts', unit: 's', differenceUnit: 's', category: '时域指标', stepOnly: true },
  { key: 'peakTimeSec', label: '峰值时间', symbol: 'tp', unit: 's', differenceUnit: 's', category: '时域指标', stepOnly: true },
  { key: 'finalValue', label: '最终值', symbol: 'y∞', unit: '', differenceUnit: '', category: '时域指标' },
  { key: 'phaseMarginDeg', label: '相位裕度', symbol: 'PM', unit: '°', differenceUnit: '°', category: '频域指标' },
  { key: 'gainMarginDb', label: '增益裕度', symbol: 'GM', unit: 'dB', differenceUnit: 'dB', category: '频域指标' },
  { key: 'gainCrossoverRadPerSec', label: '增益交叉频率', symbol: 'ωc', unit: 'rad/s', differenceUnit: 'rad/s', category: '频域指标' },
  { key: 'phaseCrossoverRadPerSec', label: '相位交叉频率', symbol: 'ωg', unit: 'rad/s', differenceUnit: 'rad/s', category: '频域指标' },
  { key: 'bandwidthRadPerSec', label: '带宽', symbol: 'ωb', unit: 'rad/s', differenceUnit: 'rad/s', category: '频域指标' },
];

export type MetricAnalysisState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unavailable' }
  | { status: 'ready'; result: ControlAnalysisResult };

export interface MetricComparisonDesign {
  id: string;
  name: string;
  color: string;
  responseType: ResponseType;
  analysis: MetricAnalysisState;
}

export type MetricReading =
  | { kind: 'value'; value: number }
  | { kind: 'infinite'; label: string }
  | { kind: 'unavailable'; label: string; title?: string };

export interface MetricCellPresentation {
  primary: string;
  secondary?: string;
  title?: string;
}

const numberFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

function formatNumber(value: number): string {
  return numberFormatter.format(Object.is(value, -0) ? 0 : value);
}

function formatWithUnit(value: number, unit: string): string {
  const formatted = formatNumber(value);
  if (!unit) return formatted;
  return unit === '%' || unit === '°'
    ? `${formatted}${unit}`
    : `${formatted} ${unit}`;
}

function formatDifference(value: number, unit: string): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  const magnitude = formatNumber(Math.abs(value));
  if (!unit) return `${sign}${magnitude}`;
  return unit === '°'
    ? `${sign}${magnitude}${unit}`
    : `${sign}${magnitude} ${unit}`;
}

export function toMetricAnalysisState(state: ControlEngineState | undefined): MetricAnalysisState {
  if (!state || state.isLoading) {
    return { status: 'loading' };
  }
  if (state.error) {
    return { status: 'error', message: state.error };
  }
  if (!state.result || state.isFallback || state.result.isFallback) {
    return { status: 'unavailable' };
  }
  return { status: 'ready', result: state.result };
}

export function resolveMetricBaselineId(
  selectedBaselineId: string | null,
  visibleSnapshotIds: string[],
): string {
  if (visibleSnapshotIds.length === 0) {
    return CURRENT_DESIGN_ID;
  }
  if (selectedBaselineId === CURRENT_DESIGN_ID) {
    return CURRENT_DESIGN_ID;
  }
  if (selectedBaselineId && visibleSnapshotIds.includes(selectedBaselineId)) {
    return selectedBaselineId;
  }
  return visibleSnapshotIds[0]!;
}

export function readMetric(
  definition: MetricDefinition,
  design: MetricComparisonDesign,
): MetricReading {
  if (design.analysis.status !== 'ready') {
    return { kind: 'unavailable', label: '分析数据不可用' };
  }

  if (definition.stepOnly && design.responseType !== 'step') {
    return { kind: 'unavailable', label: '当前响应类型不适用' };
  }

  const metrics = design.analysis.result.metrics;
  const hasFrequencyResponseData = design.analysis.result.magnitude.points.some(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  ) && design.analysis.result.phase.points.some(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  const phaseCrossoverNotObserved = metrics.phaseCrossoverStatus === 'notObservedInFrequencyRange'
    || (
      metrics.phaseCrossoverStatus == null
      && metrics.phaseCrossoverRadPerSec == null
      && hasFrequencyResponseData
    );
  if (
    (definition.key === 'gainMarginDb' || definition.key === 'phaseCrossoverRadPerSec')
    && phaseCrossoverNotObserved
  ) {
    return {
      kind: 'unavailable',
      label: '未观测到相位交叉',
      title: '未在当前频率范围内观测到相位交叉',
    };
  }

  const value = metrics[definition.key];
  if (
    definition.key === 'gainMarginDb'
    && value === Number.POSITIVE_INFINITY
    && (
      metrics.phaseCrossoverStatus === 'finite'
      || metrics.phaseCrossoverRadPerSec != null
    )
  ) {
    return { kind: 'infinite', label: '∞ dB' };
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { kind: 'unavailable', label: '指标数据不可用' };
  }
  return { kind: 'value', value };
}

export function presentMetricCell(
  definition: MetricDefinition,
  design: MetricComparisonDesign,
  baseline: MetricComparisonDesign,
): MetricCellPresentation {
  if (design.analysis.status === 'loading') {
    return { primary: '计算中' };
  }
  if (design.analysis.status === 'error') {
    return { primary: '分析失败', title: design.analysis.message };
  }
  if (design.analysis.status === 'unavailable') {
    return { primary: '分析数据不可用' };
  }

  const reading = readMetric(definition, design);
  if (reading.kind === 'unavailable') {
    return { primary: reading.label, title: reading.title };
  }
  if (reading.kind === 'infinite') {
    return {
      primary: reading.label,
      secondary: design.id === baseline.id ? '对照基线' : undefined,
    };
  }

  const primary = formatWithUnit(reading.value, definition.unit);
  if (design.id === baseline.id) {
    return { primary, secondary: '对照基线' };
  }
  if (baseline.analysis.status !== 'ready') {
    return { primary };
  }

  const baselineReading = readMetric(definition, baseline);
  if (baselineReading.kind !== 'value') {
    return { primary };
  }

  return {
    primary,
    secondary: formatDifference(
      reading.value - baselineReading.value,
      definition.differenceUnit,
    ),
  };
}

function createDesignColumns(
  currentState: ControlEngineState,
  currentResponseType: ResponseType,
  snapshots: DesignSnapshot[],
  snapshotStates: Record<string, ControlEngineState>,
): MetricComparisonDesign[] {
  return [
    {
      id: CURRENT_DESIGN_ID,
      name: '当前方案',
      color: CONTROL_SIGNAL_CURVE_STYLES.correctedOutput.color,
      responseType: currentResponseType,
      analysis: toMetricAnalysisState(currentState),
    },
    ...snapshots.map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      color: snapshot.color,
      responseType: snapshot.design.responseType,
      analysis: toMetricAnalysisState(snapshotStates[snapshot.id]),
    })),
  ];
}

export function MetricComparisonTable({
  currentState,
  currentResponseType,
  snapshots,
  snapshotStates,
}: {
  currentState: ControlEngineState;
  currentResponseType: ResponseType;
  snapshots: DesignSnapshot[];
  snapshotStates: Record<string, ControlEngineState>;
}) {
  const visibleSnapshots = useMemo(
    () => snapshots.filter((snapshot) => snapshot.visible),
    [snapshots],
  );
  const visibleSnapshotIds = useMemo(
    () => visibleSnapshots.map((snapshot) => snapshot.id),
    [visibleSnapshots],
  );
  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(null);
  const baselineId = resolveMetricBaselineId(selectedBaselineId, visibleSnapshotIds);
  const designs = useMemo(
    () => createDesignColumns(currentState, currentResponseType, visibleSnapshots, snapshotStates),
    [currentResponseType, currentState, snapshotStates, visibleSnapshots],
  );
  const baseline = designs.find((design) => design.id === baselineId) ?? designs[0]!;

  useEffect(() => {
    setSelectedBaselineId((current) => {
      if (visibleSnapshotIds.length === 0) {
        return null;
      }
      return resolveMetricBaselineId(current, visibleSnapshotIds);
    });
  }, [visibleSnapshotIds]);

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4" data-testid="metric-comparison-table">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="premium-lesson-kicker">关键性能指标对照</div>
          <p className="premium-lesson-caption mt-1 text-xs">原值与差值仅用于量化比较，不代表方案优劣。</p>
        </div>
        {visibleSnapshots.length > 0 && (
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>对照基线</span>
            <select
              aria-label="选择指标对照基线"
              className="premium-lesson-control min-w-40"
              value={baselineId}
              onChange={(event) => setSelectedBaselineId(event.target.value)}
            >
              {designs.map((design) => (
                <option key={design.id} value={design.id}>{design.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {visibleSnapshots.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
          保存并显示方案快照后，可在此比较关键性能指标。
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto" tabIndex={0} aria-label="关键性能指标横向对照区域">
          <table className="min-w-max border-separate border-spacing-0 text-left text-sm">
            <caption className="sr-only">当前方案与可见方案快照的关键性能指标对照</caption>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-40 border-b border-r border-border bg-card px-3 py-3 font-medium">
                  指标
                </th>
                {designs.map((design) => (
                  <th key={design.id} className="min-w-48 border-b border-border bg-card px-3 py-3 font-medium">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: design.color }} />
                      <span>{design.name}</span>
                    </span>
                    {design.id === baseline.id && (
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">当前基线</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            {(['时域指标', '频域指标'] as const).map((category) => (
              <tbody key={category}>
                <tr>
                  <th colSpan={designs.length + 1} className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                    {category}
                  </th>
                </tr>
                {METRIC_DEFINITIONS.filter((definition) => definition.category === category).map((definition) => (
                  <tr key={definition.key}>
                    <th className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-3 font-normal">
                      <span className="block font-medium text-foreground">{definition.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {definition.symbol}{definition.unit ? ` / ${definition.unit}` : ''}
                      </span>
                    </th>
                    {designs.map((design) => {
                      const presentation = presentMetricCell(definition, design, baseline);
                      return (
                        <td key={design.id} className="border-b border-border px-3 py-3 align-top">
                          <span className="block whitespace-nowrap font-medium" title={presentation.title}>
                            {presentation.primary}
                          </span>
                          {presentation.secondary && (
                            <span className="mt-1 block whitespace-nowrap text-xs text-muted-foreground">
                              {presentation.secondary}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}
