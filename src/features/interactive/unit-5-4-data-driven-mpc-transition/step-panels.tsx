'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  createManifestContentModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  renderInteractiveManifestStep,
  type InteractiveModuleRegistry,
  type InteractiveRuntimeModuleManifest,
  type InteractiveRuntimeStepManifest,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  getUNIT_5_4ManifestStepFromManifest,
  type UNIT_5_4StepDefinition,
} from '@/lib/unit-5-4-course';

type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };
type CsvRow = Record<string, number | string>;
type CurveSeries = { id: string; label: string; color: string; points: Array<{ x: number; y: number }>; dashed?: boolean };
type PredictionWindow = 'early' | 'late' | 'all';
type ErrorMarker = 'max' | 'early' | 'late';
type RouteWindow = 'before' | 'during' | 'after' | 'all';
type MetricFocus = 'IAE' | 'max_abs_error' | 'saturation_percent';
type ContentRegistryExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
};

const DATA_BASE = '/course-runtime/lessons/5-4/media/generated-data';
const ROUTE_METHOD_LABELS: Record<string, string> = {
  traditional_fixed: '传统固定控制',
  nominal_model_mpc: '名义模型 MPC',
  data_driven_model_mpc: '数据驱动模型 MPC',
  traditional: '传统固定控制',
  nominal: '名义模型 MPC',
  data: '数据驱动模型 MPC',
};

function requireUnit54Manifest(manifest: InteractiveRuntimeManifest | null | undefined) {
  if (!manifest) throw new Error('5-4 runtime manifest is required for page rendering.');
  return manifest;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function panelId(module: InteractiveRuntimeModuleManifest) {
  return asString(module.payload.panel_id ?? module.payload.panelId, module.id);
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines.shift()?.split(',') ?? [];
  return lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((header, index) => {
      const raw = cells[index] ?? '';
      const numeric = Number(raw);
      return [header, Number.isFinite(numeric) && raw.trim() !== '' ? numeric : raw];
    }));
  });
}

function useRuntimeCsv(filename: string) {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${DATA_BASE}/${filename}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setRows(parseCsv(text));
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [filename]);

  return { rows, error };
}

function numeric(row: CsvRow, key: string) {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value);
}

function routeMethodLabel(value: unknown) {
  const key = String(value);
  return ROUTE_METHOD_LABELS[key] ?? key;
}

function seriesFrom(rows: CsvRow[], xKey: string, yKey: string, label: string, color: string, dashed = false): CurveSeries {
  return {
    id: yKey,
    label,
    color,
    dashed,
    points: rows
      .map((row) => ({ x: numeric(row, xKey), y: numeric(row, yKey) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  };
}

function filterPredictionRows(rows: CsvRow[], windowName: PredictionWindow) {
  return rows.filter((row) => {
    const t = numeric(row, 't');
    if (windowName === 'early') return t <= 32;
    if (windowName === 'late') return t >= 32;
    return true;
  });
}

function filterRouteRows(rows: CsvRow[], windowName: RouteWindow) {
  return rows.filter((row) => {
    const t = numeric(row, 't');
    if (windowName === 'before') return t < 28;
    if (windowName === 'during') return t >= 28 && t < 108;
    if (windowName === 'after') return t >= 108;
    return true;
  });
}

function scale(series: CurveSeries[], defaults: { minX: number; maxX: number; minY: number; maxY: number }) {
  const points = series.flatMap((item) => item.points);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(defaults.minX, ...xs);
  const maxX = Math.max(defaults.maxX, ...xs);
  const minY = Math.min(defaults.minY, ...ys);
  const maxY = Math.max(defaults.maxY, ...ys);
  return {
    x: (value: number) => 48 + ((value - minX) / Math.max(1e-6, maxX - minX)) * 560,
    y: (value: number) => 300 - ((value - minY) / Math.max(1e-6, maxY - minY)) * 230,
  };
}

function LineChart({
  title,
  series,
  xLabel,
  yLabel,
  defaults,
  markers = [],
}: {
  title: string;
  series: CurveSeries[];
  xLabel: string;
  yLabel: string;
  defaults: { minX: number; maxX: number; minY: number; maxY: number };
  markers?: number[];
}) {
  const s = scale(series, defaults);
  const xTicks = [defaults.minX, (defaults.minX + defaults.maxX) / 2, defaults.maxX];
  const yTicks = [defaults.minY, (defaults.minY + defaults.maxY) / 2, defaults.maxY];

  return (
    <svg viewBox="0 0 640 350" className="h-[350px] w-full rounded-xl border border-border/70 bg-white" aria-label={title}>
      <text x="48" y="30" className="fill-slate-800 text-[15px] font-semibold">{title}</text>
      <line x1="48" y1="300" x2="608" y2="300" stroke="#cbd5e1" />
      <line x1="48" y1="70" x2="48" y2="300" stroke="#cbd5e1" />
      {markers.map((marker) => (
        <line key={marker} x1={s.x(marker)} y1="70" x2={s.x(marker)} y2="300" stroke="#f59e0b" strokeDasharray="5 5" opacity="0.55" />
      ))}
      {xTicks.map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={s.x(tick)} y1="300" x2={s.x(tick)} y2="306" stroke="#94a3b8" />
          <text x={s.x(tick)} y="324" textAnchor="middle" className="fill-slate-500 text-[10px]">{tick.toFixed(0)}</text>
        </g>
      ))}
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line x1="42" y1={s.y(tick)} x2="48" y2={s.y(tick)} stroke="#94a3b8" />
          <text x="36" y={s.y(tick) + 3} textAnchor="end" className="fill-slate-500 text-[10px]">{tick.toFixed(1)}</text>
        </g>
      ))}
      <text x="602" y="342" textAnchor="end" className="fill-slate-500 text-[10px]">{xLabel}</text>
      <text x="16" y="96" textAnchor="middle" className="fill-slate-500 text-[10px]" transform="rotate(-90 16 96)">{yLabel}</text>
      {series.map((item) => {
        const d = item.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${s.x(point.x).toFixed(1)} ${s.y(point.y).toFixed(1)}`).join(' ');
        return <path key={item.id} d={d} fill="none" stroke={item.color} strokeWidth="2.5" strokeDasharray={item.dashed ? '6 5' : undefined} />;
      })}
      {series.map((item, index) => (
        <g key={item.id} transform={`translate(376, ${34 + index * 18})`}>
          <line x1="0" y1="0" x2="24" y2="0" stroke={item.color} strokeWidth="3" strokeDasharray={item.dashed ? '6 5' : undefined} />
          <text x="30" y="4" className="fill-slate-600 text-[11px]">{item.label}</text>
        </g>
      ))}
    </svg>
  );
}

function DiagnosticFallback({ message, image }: { message: string; image?: string }) {
  return (
    <div className="premium-lesson-tone-block premium-tone-amber text-sm leading-7">
      <p>{message}</p>
      {image ? <p className="mt-2 break-all">诊断回退图：{image}</p> : null}
    </div>
  );
}

function PredictionErrorPanel({
  stepId,
  module,
  onParameterChange,
}: {
  stepId: string;
  module: InteractiveRuntimeModuleManifest;
  onParameterChange?: (stepId: string, values: Record<string, string>) => void;
}) {
  const { rows, error } = useRuntimeCsv('5-4-model-mismatch-prediction.csv');
  const [visible, setVisible] = useState({ nominal: true, actual: true, fitted: true });
  const [windowName, setWindowName] = useState<PredictionWindow>('all');
  const [errorMarker, setErrorMarker] = useState<ErrorMarker>('max');
  const filteredRows = useMemo(() => filterPredictionRows(rows, windowName), [rows, windowName]);
  const maxNominal = useMemo(() => Math.max(0, ...rows.map((row) => Math.abs(numeric(row, 'err_nominal')))), [rows]);
  const maxFitted = useMemo(() => Math.max(0, ...rows.map((row) => Math.abs(numeric(row, 'err_fitted')))), [rows]);
  const markerWindowRows = useMemo(() => {
    if (errorMarker === 'early') return filterPredictionRows(rows, 'early');
    if (errorMarker === 'late') return filterPredictionRows(rows, 'late');
    return rows;
  }, [errorMarker, rows]);
  const markerReading = useMemo(() => Math.max(0, ...markerWindowRows.map((row) => Math.abs(numeric(row, 'err_nominal')))), [markerWindowRows]);
  const series = [
    visible.actual ? seriesFrom(filteredRows, 't', 'psi_actual', '真实对象', '#111827') : null,
    visible.nominal ? seriesFrom(filteredRows, 't', 'psi_nominal', '名义模型预测', '#dc2626', true) : null,
    visible.fitted ? seriesFrom(filteredRows, 't', 'psi_fitted', '数据修正预测', '#2563eb') : null,
  ].filter((item): item is CurveSeries => Boolean(item));

  useEffect(() => {
    if (!rows.length) return;
    onParameterChange?.(stepId, {
      data_source: '5-4-model-mismatch-prediction.csv',
      observation_window: windowName,
      error_marker: errorMarker,
      max_error_reading: markerReading.toFixed(2),
      max_nominal_error_deg: maxNominal.toFixed(2),
      max_fitted_error_deg: maxFitted.toFixed(2),
    });
  }, [errorMarker, markerReading, maxFitted, maxNominal, onParameterChange, rows.length, stepId, windowName]);

  return (
    <section className="premium-lesson-panel space-y-4" data-testid="unit-5-4-prediction-error-panel" data-runtime-data="5-4-model-mismatch-prediction.csv">
      <div>
        <div className="premium-lesson-kicker">Runtime Data Panel</div>
        <h3 className="premium-lesson-title mt-1 text-lg font-semibold">预测偏差读图面板</h3>
      </div>
      {rows.length ? (
        <LineChart title="同一舵角序列下的航向预测" series={series} xLabel="时间 / s" yLabel="航向角 / deg" defaults={{ minX: 0, maxX: 60, minY: 0, maxY: 45 }} markers={[32]} />
      ) : (
        <DiagnosticFallback message={`仿真数据暂未载入：${error ?? '等待 runtime CSV'}`} image={asString(module.payload.fallback_image)} />
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <button type="button" onClick={() => setVisible((prev) => ({ ...prev, nominal: !prev.nominal }))} className="premium-lesson-action-tone premium-tone-slate">名义预测 {visible.nominal ? '显示' : '隐藏'}</button>
        <button type="button" onClick={() => setVisible((prev) => ({ ...prev, actual: !prev.actual }))} className="premium-lesson-action-tone premium-tone-slate">真实对象 {visible.actual ? '显示' : '隐藏'}</button>
        <button type="button" onClick={() => setVisible((prev) => ({ ...prev, fitted: !prev.fitted }))} className="premium-lesson-action-tone premium-tone-slate">数据修正 {visible.fitted ? '显示' : '隐藏'}</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="premium-lesson-control inline-flex items-center gap-2">
          <span>观察区间</span>
          <select value={windowName} onChange={(event) => setWindowName(event.target.value as PredictionWindow)} className="premium-lesson-select">
            <option value="all">全段</option>
            <option value="early">早段</option>
            <option value="late">后段</option>
          </select>
        </label>
        <label className="premium-lesson-control inline-flex items-center gap-2">
          <span>误差标注</span>
          <select value={errorMarker} onChange={(event) => setErrorMarker(event.target.value as ErrorMarker)} className="premium-lesson-select">
            <option value="max">最大误差</option>
            <option value="early">早段误差</option>
            <option value="late">后段误差</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="premium-lesson-surface-elevated px-4 py-3">
          <div className="premium-lesson-caption text-xs">名义预测最大误差</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{maxNominal.toFixed(2)}°</div>
        </div>
        <div className="premium-lesson-surface-elevated px-4 py-3">
          <div className="premium-lesson-caption text-xs">数据修正预测最大误差</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{maxFitted.toFixed(2)}°</div>
        </div>
        <div className="premium-lesson-surface-elevated px-4 py-3 md:col-span-2">
          <div className="premium-lesson-caption text-xs">当前误差标注读数</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{markerReading.toFixed(2)}°</div>
        </div>
      </div>
    </section>
  );
}

function RouteComparePanel({
  stepId,
  module,
  onParameterChange,
}: {
  stepId: string;
  module: InteractiveRuntimeModuleManifest;
  onParameterChange?: (stepId: string, values: Record<string, string>) => void;
}) {
  const { rows, error } = useRuntimeCsv('5-4-mpc-drift-comparison.csv');
  const { rows: metricRows } = useRuntimeCsv('5-4-mpc-drift-metrics.csv');
  const [routeVisible, setRouteVisible] = useState({
    traditional: true,
    nominal: true,
    data: true,
  });
  const [metricFocus, setMetricFocus] = useState<MetricFocus>('IAE');
  const [timeWindow, setTimeWindow] = useState<RouteWindow>('all');
  const filteredRows = useMemo(() => filterRouteRows(rows, timeWindow), [rows, timeWindow]);
  const focusedMetricLabel = {
    IAE: '累计绝对误差 IAE',
    max_abs_error: '最大误差',
    saturation_percent: '舵角触边比例',
  }[metricFocus];
  const bestFocusedRow = useMemo(() => {
    if (!metricRows.length) return null;
    return [...metricRows].sort((left, right) => numeric(left, metricFocus) - numeric(right, metricFocus))[0];
  }, [metricFocus, metricRows]);
  const headingSeries = [
    seriesFrom(filteredRows, 't', 'ref', '参考航向', '#111827', true),
    routeVisible.traditional ? seriesFrom(filteredRows, 't', 'psi_traditional', '传统固定控制', '#dc2626') : null,
    routeVisible.nominal ? seriesFrom(filteredRows, 't', 'psi_mpc_nominal', '名义模型 MPC', '#f59e0b') : null,
    routeVisible.data ? seriesFrom(filteredRows, 't', 'psi_mpc_data', '数据驱动模型 MPC', '#2563eb') : null,
  ].filter((item): item is CurveSeries => Boolean(item));
  const parameterSeries = [
    seriesFrom(filteredRows, 't', 'K_actual', '实际增益 K', '#111827'),
    seriesFrom(filteredRows, 't', 'K_est_data', '在线推断 K', '#2563eb'),
  ];

  useEffect(() => {
    if (!metricRows.length) return;
    const best = [...metricRows].sort((left, right) => numeric(left, 'IAE') - numeric(right, 'IAE'))[0];
    const focused = bestFocusedRow ?? best;
    onParameterChange?.(stepId, {
      data_source: '5-4-mpc-drift-comparison.csv',
      metrics_source: '5-4-mpc-drift-metrics.csv',
      route: routeMethodLabel(focused.method),
      time_window: timeWindow,
      benefit: `${focusedMetricLabel}最低路线：${routeMethodLabel(focused.method)} (${numeric(focused, metricFocus).toFixed(1)})`,
      cost: `触边比例：${numeric(focused, 'saturation_percent').toFixed(1)}%`,
      metric_focus: focusedMetricLabel,
      route_visibility: Object.entries(routeVisible).filter(([, value]) => value).map(([key]) => routeMethodLabel(key)).join('，'),
      lowest_iae_method: routeMethodLabel(best.method),
      lowest_iae: numeric(best, 'IAE').toFixed(1),
    });
  }, [bestFocusedRow, focusedMetricLabel, metricFocus, metricRows, onParameterChange, routeVisible, stepId, timeWindow]);

  return (
    <section className="premium-lesson-panel space-y-4" data-testid="unit-5-4-route-compare-panel" data-runtime-data="5-4-mpc-drift-comparison.csv">
      <div>
        <div className="premium-lesson-kicker">Runtime Data Panel</div>
        <h3 className="premium-lesson-title mt-1 text-lg font-semibold">三路线仿真比较面板</h3>
      </div>
      {rows.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <LineChart title="长时漂移下的闭环航向跟踪" series={headingSeries} xLabel="时间 / s" yLabel="航向角 / deg" defaults={{ minX: 0, maxX: 180, minY: -12, maxY: 18 }} markers={[28, 108]} />
          <LineChart title="实际参数与在线推断参数" series={parameterSeries} xLabel="时间 / s" yLabel="增益 K" defaults={{ minX: 0, maxX: 180, minY: 0.04, maxY: 0.2 }} markers={[28, 108]} />
        </div>
      ) : (
        <DiagnosticFallback message={`三路线仿真数据暂未载入：${error ?? '等待 runtime CSV'}`} image={Array.isArray(module.payload.fallback_images) ? String(module.payload.fallback_images[0]) : undefined} />
      )}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="premium-lesson-surface-elevated px-4 py-3">
          <div className="premium-lesson-caption text-xs">路线显隐</div>
          <div className="mt-2 space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={routeVisible.traditional} onChange={(event) => setRouteVisible((prev) => ({ ...prev, traditional: event.target.checked }))} />
              传统固定控制
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={routeVisible.nominal} onChange={(event) => setRouteVisible((prev) => ({ ...prev, nominal: event.target.checked }))} />
              名义模型 MPC
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={routeVisible.data} onChange={(event) => setRouteVisible((prev) => ({ ...prev, data: event.target.checked }))} />
              数据驱动模型 MPC
            </label>
          </div>
        </div>
        <label className="premium-lesson-control flex flex-col gap-2 px-4 py-3">
          <span>指标高亮</span>
          <select value={metricFocus} onChange={(event) => setMetricFocus(event.target.value as MetricFocus)} className="premium-lesson-select">
            <option value="IAE">累计绝对误差 IAE</option>
            <option value="max_abs_error">最大误差</option>
            <option value="saturation_percent">舵角触边比例</option>
          </select>
          {bestFocusedRow ? (
            <span className="premium-lesson-muted text-xs">
              当前最低：{routeMethodLabel(bestFocusedRow.method)} · {numeric(bestFocusedRow, metricFocus).toFixed(1)}
            </span>
          ) : null}
        </label>
        <label className="premium-lesson-control flex flex-col gap-2 px-4 py-3">
          <span>时间区间</span>
          <select value={timeWindow} onChange={(event) => setTimeWindow(event.target.value as RouteWindow)} className="premium-lesson-select">
            <option value="before">漂移前</option>
            <option value="during">漂移中</option>
            <option value="after">漂移后</option>
            <option value="all">全段</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">路线</th>
              <th className="px-3 py-2">最大误差</th>
              <th className="px-3 py-2">IAE</th>
              <th className="px-3 py-2">触边比例</th>
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row) => (
              <tr key={String(row.method)} className={`border-t border-border/60 ${bestFocusedRow?.method === row.method ? 'bg-cyan-50/70' : ''}`}>
                <td className="px-3 py-2">{routeMethodLabel(row.method)}</td>
                <td className={`px-3 py-2 ${metricFocus === 'max_abs_error' ? 'font-semibold text-cyan-700' : ''}`}>{numeric(row, 'max_abs_error').toFixed(2)}°</td>
                <td className={`px-3 py-2 ${metricFocus === 'IAE' ? 'font-semibold text-cyan-700' : ''}`}>{numeric(row, 'IAE').toFixed(1)}</td>
                <td className={`px-3 py-2 ${metricFocus === 'saturation_percent' ? 'font-semibold text-cyan-700' : ''}`}>{numeric(row, 'saturation_percent').toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryStats({
  viewedStepIds,
  submittedCount,
  figureSubmissionCount,
  postTestSubmitted,
}: {
  viewedStepIds: string[];
  submittedCount: number;
  figureSubmissionCount: number;
  postTestSubmitted: boolean;
}) {
  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-4-student-summary-stats">
      <div className="premium-lesson-kicker">个人课堂表现</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">已浏览页面</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{viewedStepIds.length}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">已提交互动</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{submittedCount}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">曲线观察提交</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{figureSubmissionCount}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">后测完成情况</div><div className="premium-lesson-title mt-1 text-sm font-semibold">{postTestSubmitted ? '已完成后测' : '尚未提交后测'}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3 md:col-span-2"><div className="premium-lesson-caption text-xs">关键误判标签</div><div className="premium-lesson-title mt-1 text-sm font-semibold">{submittedCount ? '查看教师端聚合反馈' : '提交后形成个人证据'}</div></div>
      </div>
    </section>
  );
}

function TeacherStats({
  submittedStudents,
  totalStudents,
  totalResponses,
  figureCoverage,
  objectiveAccuracy,
  postTestCompletion,
  misconceptionSummary,
}: {
  submittedStudents: number;
  totalStudents: number;
  totalResponses: number;
  figureCoverage: number;
  objectiveAccuracy: number;
  postTestCompletion: number;
  misconceptionSummary: string;
}) {
  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-4-teacher-summary-stats">
      <div className="premium-lesson-kicker">班级课堂表现</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">提交学生</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{submittedStudents}/{totalStudents}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">曲线观察覆盖</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{figureCoverage}%</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">累计提交</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{totalResponses}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">客观题正确率</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{objectiveAccuracy}%</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">后测完成率</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{postTestCompletion}%</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">三路线比较观察分布</div><div className="premium-lesson-title mt-1 text-sm font-semibold">曲线观察覆盖 {figureCoverage}%</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">数据进入条件漏选项</div><div className="premium-lesson-title mt-1 text-sm font-semibold">{objectiveAccuracy < 70 ? '需查看多选题细节' : '暂无高频漏选'}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">责任分配常见误判</div><div className="premium-lesson-title mt-1 text-sm font-semibold">{misconceptionSummary}</div></div>
      </div>
    </section>
  );
}

export function UNIT_5_4StepContentPanel({
  step,
  manifest,
  revealProgress = 0,
  allowInlineReveal = false,
  onInlineReveal,
  onParameterChange,
  viewedStepIds = [],
  submittedCount = 0,
  figureSubmissionCount = 0,
  postTestSubmitted = false,
  submittedStudents = 0,
  totalStudents = 0,
  totalResponses = 0,
  figureCoverage = 0,
  objectiveAccuracy = 0,
  postTestCompletion = 0,
  misconceptionSummary = '暂无聚合',
  mode = 'student',
}: {
  step: UNIT_5_4StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  revealProgress?: number;
  allowInlineReveal?: boolean;
  onInlineReveal?: () => void;
  onParameterChange?: (stepId: string, values: Record<string, string>) => void;
  viewedStepIds?: string[];
  submittedCount?: number;
  figureSubmissionCount?: number;
  postTestSubmitted?: boolean;
  submittedStudents?: number;
  totalStudents?: number;
  totalResponses?: number;
  figureCoverage?: number;
  objectiveAccuracy?: number;
  postTestCompletion?: number;
  misconceptionSummary?: string;
  mode?: 'student' | 'teacher';
}) {
  const activeManifest = requireUnit54Manifest(manifest);
  const stepManifest = getUNIT_5_4ManifestStepFromManifest(activeManifest, step.id);
  const baseRegistry = useMemo(() => createManifestContentModuleRegistry({ revealProgress, allowInlineReveal, onInlineReveal }), [allowInlineReveal, onInlineReveal, revealProgress]);
  const contentRegistry = useMemo<InteractiveModuleRegistry<ContentRegistryExtra>>(() => ({
    ...baseRegistry,
    'interactive-figure-panel': ({ module }) => {
      if (panelId(module) === 'rust_prediction_error_panel') {
        return <PredictionErrorPanel stepId={step.id} module={module} onParameterChange={onParameterChange} />;
      }
      if (panelId(module) === 'rust_three_route_compare_panel') {
        return <RouteComparePanel stepId={step.id} module={module} onParameterChange={onParameterChange} />;
      }
      return baseRegistry['interactive-figure-panel']({ manifest: activeManifest, step: stepManifest, module, extra: { revealProgress, allowInlineReveal, onInlineReveal } });
    },
    'learning-stat-panel': () => mode === 'teacher'
      ? (
        <TeacherStats
          submittedStudents={submittedStudents}
          totalStudents={totalStudents}
          totalResponses={totalResponses}
          figureCoverage={figureCoverage}
          objectiveAccuracy={objectiveAccuracy}
          postTestCompletion={postTestCompletion}
          misconceptionSummary={misconceptionSummary}
        />
      )
      : <SummaryStats viewedStepIds={viewedStepIds} submittedCount={submittedCount} figureSubmissionCount={figureSubmissionCount} postTestSubmitted={postTestSubmitted} />,
  }), [activeManifest, allowInlineReveal, baseRegistry, figureCoverage, figureSubmissionCount, misconceptionSummary, mode, objectiveAccuracy, onInlineReveal, postTestCompletion, postTestSubmitted, revealProgress, step.id, stepManifest, submittedCount, submittedStudents, totalResponses, totalStudents, viewedStepIds, onParameterChange]);

  return renderInteractiveManifestStep({
    manifest: activeManifest,
    step: stepManifest,
    moduleRegistry: contentRegistry,
    extra: { revealProgress, allowInlineReveal, onInlineReveal },
  });
}

export function UNIT_5_4StudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: UNIT_5_4StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  const activeManifest = requireUnit54Manifest(manifest);
  const stepManifest = getUNIT_5_4ManifestStepFromManifest(activeManifest, step.id);
  return (
    <>
      {renderStudentInteractiveActivity({
        registry: createManifestStudentActivityRegistry<UNIT_5_4StepDefinition>(),
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

export function UNIT_5_4TeacherActivitySummary({
  step,
  manifest,
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
  step: UNIT_5_4StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
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
  const activeManifest = requireUnit54Manifest(manifest);
  const stepManifest = getUNIT_5_4ManifestStepFromManifest(activeManifest, step.id);
  return (
    <>
      {renderTeacherInteractiveActivity({
        registry: createManifestTeacherActivityRegistry<UNIT_5_4StepDefinition>(),
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
