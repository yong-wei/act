'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  ManifestTeacherControls,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  renderInteractiveManifestStep,
  type InteractiveModuleRegistry,
  type InteractiveRuntimeModuleManifest,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  getUNIT_5_6ManifestStepFromManifest,
  type UNIT_5_6StepDefinition,
} from '@/lib/unit-5-6-course';

type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };
type CsvRow = Record<string, number | string>;
type RouteId = 'classic' | 'data' | 'policy';
type TemperatureChannel = 'air_C' | 'product_C';
type MetricView = 'recovery_min' | 'energy_norm_h' | 'compressor_switches' | 'verify_load';
type CurveSeries = { id: RouteId; label: string; color: string; points: Array<{ x: number; y: number }> };
type SummaryMetric = {
  scenario: string;
  method: RouteId;
  method_label: string;
  recovery_min: number;
  energy_norm_h: number;
  compressor_switches: number;
  verify_load: string;
};
type ContentRegistryExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
};

const DATA_BASE = '/course-runtime/lessons/5-6/media/generated-data';
const STATIC_FALLBACK = '/course-runtime/lessons/5-6/media/5-6-three-route-comparison.png';
const ROUTE_LABELS: Record<RouteId, string> = {
  classic: '经典 PI/PID',
  data: '预测补偿',
  policy: '策略监督',
};
const ROUTE_COLORS: Record<RouteId, string> = {
  classic: '#dc2626',
  data: '#2563eb',
  policy: '#16a34a',
};
const METRIC_LABELS: Record<MetricView, string> = {
  recovery_min: '恢复时间',
  energy_norm_h: '能耗',
  compressor_switches: '切换次数',
  verify_load: '验证负担',
};

function requireUnit56Manifest(manifest: InteractiveRuntimeManifest | null | undefined) {
  if (!manifest) throw new Error('5-6 runtime manifest is required for page rendering.');
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

function useRuntimeSummary() {
  const [items, setItems] = useState<SummaryMetric[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${DATA_BASE}/5-6-cold-chain-summary.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SummaryMetric[]>;
      })
      .then((data) => {
        if (!cancelled) setItems(data.filter((item) => item.scenario === 'E2'));
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, error };
}

function numeric(row: CsvRow, key: string) {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value);
}

function pathFrom(points: Array<{ x: number; y: number }>, scale: (point: { x: number; y: number }) => { x: number; y: number }) {
  return points.map((point, index) => {
    const scaled = scale(point);
    return `${index === 0 ? 'M' : 'L'} ${scaled.x.toFixed(1)} ${scaled.y.toFixed(1)}`;
  }).join(' ');
}

function seriesFrom(rows: CsvRow[], id: RouteId, channel: TemperatureChannel): CurveSeries {
  return {
    id,
    label: ROUTE_LABELS[id],
    color: ROUTE_COLORS[id],
    points: rows
      .map((row) => ({ x: numeric(row, 'minute'), y: numeric(row, channel) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  };
}

function routeMetric(items: SummaryMetric[], route: RouteId) {
  return items.find((item) => item.method === route);
}

function metricText(metric: SummaryMetric | undefined, metricView: MetricView) {
  if (!metric) return '-';
  if (metricView === 'verify_load') return metric.verify_load;
  const value = metric[metricView];
  if (metricView === 'recovery_min') return `${value} min`;
  if (metricView === 'energy_norm_h') return value.toFixed(2);
  return String(value);
}

function ColdChainLineChart({
  series,
  channel,
}: {
  series: CurveSeries[];
  channel: TemperatureChannel;
}) {
  const points = series.flatMap((item) => item.points);
  const minX = Math.min(0, ...points.map((point) => point.x));
  const maxX = Math.max(160, ...points.map((point) => point.x));
  const minY = Math.min(4.8, ...points.map((point) => point.y));
  const maxY = Math.max(7.8, ...points.map((point) => point.y));
  const plotLeft = 54;
  const plotRight = 620;
  const plotTop = 48;
  const plotBottom = 304;
  const scale = (point: { x: number; y: number }) => ({
    x: plotLeft + ((point.x - minX) / Math.max(1e-6, maxX - minX)) * (plotRight - plotLeft),
    y: plotBottom - ((point.y - minY) / Math.max(1e-6, maxY - minY)) * (plotBottom - plotTop),
  });
  const yTicks = [5, 6, 7, 8];
  const xTicks = [0, 40, 80, 120, 160];

  return (
    <svg viewBox="0 0 660 352" className="h-[352px] w-full rounded-xl border border-border/70 bg-white" aria-label="入库高峰三路线温度曲线">
      <text x={plotLeft} y="30" className="fill-slate-800 text-[15px] font-semibold">
        {channel === 'air_C' ? '空气温度曲线' : '货品核心温度曲线'}
      </text>
      <RecoveryThreshold scale={scale} x1={plotLeft} x2={plotRight} />
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line x1={plotLeft} y1={scale({ x: 0, y: tick }).y} x2={plotRight} y2={scale({ x: 0, y: tick }).y} stroke="#e2e8f0" />
          <text x={plotLeft - 8} y={scale({ x: 0, y: tick }).y + 3} textAnchor="end" className="fill-slate-500 text-[10px]">{tick}</text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={scale({ x: tick, y: minY }).x} y1={plotTop} x2={scale({ x: tick, y: minY }).x} y2={plotBottom} stroke="#f1f5f9" />
          <text x={scale({ x: tick, y: minY }).x} y={plotBottom + 18} textAnchor="middle" className="fill-slate-500 text-[10px]">{tick}</text>
        </g>
      ))}
      <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="#94a3b8" />
      <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} stroke="#94a3b8" />
      <text x={plotRight} y="346" textAnchor="end" className="fill-slate-500 text-[10px]">时间 / min</text>
      <text x="16" y="92" textAnchor="middle" className="fill-slate-500 text-[10px]" transform="rotate(-90 16 92)">温度 / °C</text>
      {series.map((item) => (
        <path key={item.id} d={pathFrom(item.points, scale)} fill="none" stroke={item.color} strokeWidth="2.6" />
      ))}
      {series.map((item, index) => (
        <g key={item.id} transform={`translate(430, ${31 + index * 18})`}>
          <line x1="0" y1="0" x2="24" y2="0" stroke={item.color} strokeWidth="3" />
          <text x="30" y="4" className="fill-slate-600 text-[11px]">{item.label}</text>
        </g>
      ))}
    </svg>
  );
}

function RecoveryThreshold({
  scale,
  x1,
  x2,
}: {
  scale: (point: { x: number; y: number }) => { x: number; y: number };
  x1: number;
  x2: number;
}) {
  const y = scale({ x: 0, y: 6.5 }).y;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#f59e0b" strokeDasharray="6 5" />
      <text x={x1 + 8} y={y - 6} className="fill-amber-700 text-[10px]">恢复阈值 6.5 °C</text>
    </g>
  );
}

function DiagnosticFallback({ message, image }: { message: string; image: string }) {
  return (
    <div className="premium-lesson-panel space-y-3" data-testid="unit-5-6-cold-chain-diagnostic-fallback">
      <div className="premium-lesson-tone-block premium-tone-amber text-sm leading-7">{message}</div>
      <Image src={image} alt="入库高峰三路线比较静态图" width={1600} height={960} className="h-auto w-full rounded-xl border border-border/70 bg-white" unoptimized />
    </div>
  );
}

function ColdChainRouteComparePanel({
  onPanelSubmit,
}: {
  onPanelSubmit?: (response: ManifestStepResponse) => void;
}) {
  const classic = useRuntimeCsv('5-6-E2-classic-trace.csv');
  const data = useRuntimeCsv('5-6-E2-data-trace.csv');
  const policy = useRuntimeCsv('5-6-E2-policy-trace.csv');
  const summary = useRuntimeSummary();
  const [visibleRoutes, setVisibleRoutes] = useState<Record<RouteId, boolean>>({ classic: true, data: true, policy: true });
  const [temperatureChannel, setTemperatureChannel] = useState<TemperatureChannel>('product_C');
  const [metricView, setMetricView] = useState<MetricView>('recovery_min');
  const [activeRoute, setActiveRoute] = useState<RouteId>('data');
  const [benefitJudgment, setBenefitJudgment] = useState('预测补偿在 E2 中把恢复时间从 22 min 缩短到 0 min，并略降空气与核心峰值。');
  const [boundaryJudgment, setBoundaryJudgment] = useState('该结果不能单独证明某一个机制贡献全部改善，也不能证明未见扰动可部署。');

  const error = classic.error ?? data.error ?? policy.error ?? summary.error;
  const routeRows: Record<RouteId, CsvRow[]> = {
    classic: classic.rows,
    data: data.rows,
    policy: policy.rows,
  };
  const series = (Object.keys(routeRows) as RouteId[])
    .filter((route) => visibleRoutes[route])
    .map((route) => seriesFrom(routeRows[route], route, temperatureChannel))
    .filter((item) => item.points.length);
  const activeMetric = routeMetric(summary.items, activeRoute);

  if (error || !series.length || !summary.items.length) {
    return (
      <DiagnosticFallback
        message={`运行时数据缺失或解析失败：${error ?? 'CSV/JSON 尚未载入'}。当前显示静态三路线比较图供诊断。`}
        image={STATIC_FALLBACK}
      />
    );
  }

  const submitObservation = () => {
    onPanelSubmit?.({
      stepId: 'step-11',
      submittedAt: Date.now(),
      answers: {
        cold_chain_route_observation: JSON.stringify({
          route: activeRoute,
          recovery_time: `${activeMetric?.recovery_min ?? ''} min`,
          benefit_judgment: benefitJudgment,
          boundary_judgment: boundaryJudgment,
        }),
      },
    });
  };

  return (
    <section className="premium-lesson-panel space-y-4" data-testid="unit-5-6-cold-chain-route-compare-panel">
      <div>
        <div className="premium-lesson-kicker">入库高峰三路线比较</div>
        <h3 className="premium-lesson-title mt-1 text-lg font-semibold">入库高峰温度曲线与指标读数</h3>
      </div>
      <ColdChainLineChart series={series} channel={temperatureChannel} />
      <div className="grid gap-3 md:grid-cols-3">
        {summary.items.map((item) => (
          <button
            key={item.method}
            type="button"
            onClick={() => setActiveRoute(item.method)}
            className={`premium-lesson-surface-elevated px-4 py-3 text-left ${activeRoute === item.method ? 'ring-2 ring-cyan-500' : ''}`}
          >
            <div className="premium-lesson-title text-sm font-semibold">{ROUTE_LABELS[item.method]}</div>
            <div className="premium-lesson-muted mt-1 text-xs">{METRIC_LABELS[metricView]}：{metricText(item, metricView)}</div>
          </button>
        ))}
      </div>
      <div className="premium-lesson-surface-elevated space-y-3 px-4 py-3">
        <div className="grid gap-3 lg:grid-cols-3">
          <fieldset className="premium-lesson-control flex flex-col gap-2 px-3 py-2">
            <legend className="premium-lesson-caption text-xs">路线曲线</legend>
            {(Object.keys(ROUTE_LABELS) as RouteId[]).map((route) => (
              <label key={route} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={visibleRoutes[route]}
                  onChange={() => setVisibleRoutes((prev) => ({ ...prev, [route]: !prev[route] }))}
                />
                <span>{ROUTE_LABELS[route]}</span>
              </label>
            ))}
          </fieldset>
          <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 text-sm">
            <span>温度通道</span>
            <select value={temperatureChannel} onChange={(event) => setTemperatureChannel(event.target.value as TemperatureChannel)} className="premium-lesson-select">
              <option value="air_C">空气温度</option>
              <option value="product_C">货品核心温度</option>
            </select>
          </label>
          <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 text-sm">
            <span>指标视图</span>
            <select value={metricView} onChange={(event) => setMetricView(event.target.value as MetricView)} className="premium-lesson-select">
              <option value="recovery_min">恢复时间</option>
              <option value="energy_norm_h">能耗</option>
              <option value="compressor_switches">切换次数</option>
              <option value="verify_load">验证负担</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 text-sm">
            <span>收益判断</span>
            <textarea value={benefitJudgment} onChange={(event) => setBenefitJudgment(event.target.value)} className="premium-lesson-input min-h-[92px]" />
          </label>
          <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 text-sm">
            <span>证据边界判断</span>
            <textarea value={boundaryJudgment} onChange={(event) => setBoundaryJudgment(event.target.value)} className="premium-lesson-input min-h-[92px]" />
          </label>
        </div>
        <button type="button" onClick={submitObservation} className="premium-lesson-action-primary px-4 py-2 text-sm">
          提交路线观察
        </button>
      </div>
    </section>
  );
}

function SummaryStats({
  viewedStepIds,
  submittedCount,
  routeObservationCount,
  postTestSubmitted,
}: {
  viewedStepIds: string[];
  submittedCount: number;
  routeObservationCount: number;
  postTestSubmitted: boolean;
}) {
  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-6-student-summary-stats">
      <div className="premium-lesson-kicker">个人课堂表现</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">已浏览页面</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{viewedStepIds.length}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">已提交互动</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{submittedCount}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">路线观察提交</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{routeObservationCount}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">后测完成情况</div><div className="premium-lesson-title mt-1 text-sm font-semibold">{postTestSubmitted ? '已完成后测' : '尚未提交后测'}</div></div>
      </div>
    </section>
  );
}

function TeacherStats({
  submittedStudents,
  totalStudents,
  totalResponses,
  routeObservationCoverage,
  objectiveAccuracy,
  postTestCompletion,
}: {
  submittedStudents: number;
  totalStudents: number;
  totalResponses: number;
  routeObservationCoverage: number;
  objectiveAccuracy: number;
  postTestCompletion: number;
}) {
  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-6-teacher-summary-stats">
      <div className="premium-lesson-kicker">班级课堂表现</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">提交学生</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{submittedStudents}/{totalStudents}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">路线观察覆盖</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{routeObservationCoverage}%</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">累计提交</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{totalResponses}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">客观题正确率</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{objectiveAccuracy}%</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">后测完成率</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{postTestCompletion}%</div></div>
      </div>
    </section>
  );
}

export function UNIT_5_6StepContentPanel({
  step,
  manifest,
  revealProgress = 0,
  allowInlineReveal = false,
  onInlineReveal,
  onPanelSubmit,
  viewedStepIds = [],
  submittedCount = 0,
  routeObservationCount = 0,
  postTestSubmitted = false,
  submittedStudents = 0,
  totalStudents = 0,
  totalResponses = 0,
  routeObservationCoverage = 0,
  objectiveAccuracy = 0,
  postTestCompletion = 0,
  mode = 'student',
}: {
  step: UNIT_5_6StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  revealProgress?: number;
  allowInlineReveal?: boolean;
  onInlineReveal?: () => void;
  onPanelSubmit?: (response: ManifestStepResponse) => void;
  viewedStepIds?: string[];
  submittedCount?: number;
  routeObservationCount?: number;
  postTestSubmitted?: boolean;
  submittedStudents?: number;
  totalStudents?: number;
  totalResponses?: number;
  routeObservationCoverage?: number;
  objectiveAccuracy?: number;
  postTestCompletion?: number;
  mode?: 'student' | 'teacher';
}) {
  const activeManifest = requireUnit56Manifest(manifest);
  const stepManifest = getUNIT_5_6ManifestStepFromManifest(activeManifest, step.id);
  const baseRegistry = useMemo(() => createManifestContentModuleRegistry({ revealProgress, allowInlineReveal, onInlineReveal }), [allowInlineReveal, onInlineReveal, revealProgress]);
  const contentRegistry = useMemo<InteractiveModuleRegistry<ContentRegistryExtra>>(() => ({
    ...baseRegistry,
    'interactive-figure-panel': ({ manifest: renderManifest, step: renderStep, module, extra }) => {
      if (panelId(module) === 'rust_cold_chain_route_compare_panel') {
        return <ColdChainRouteComparePanel onPanelSubmit={onPanelSubmit} />;
      }
      return baseRegistry['interactive-figure-panel']({ manifest: renderManifest, step: renderStep, module, extra });
    },
    'learning-stat-panel': () => mode === 'teacher'
      ? <TeacherStats submittedStudents={submittedStudents} totalStudents={totalStudents} totalResponses={totalResponses} routeObservationCoverage={routeObservationCoverage} objectiveAccuracy={objectiveAccuracy} postTestCompletion={postTestCompletion} />
      : <SummaryStats viewedStepIds={viewedStepIds} submittedCount={submittedCount} routeObservationCount={routeObservationCount} postTestSubmitted={postTestSubmitted} />,
  }), [baseRegistry, mode, objectiveAccuracy, onPanelSubmit, postTestCompletion, postTestSubmitted, routeObservationCount, routeObservationCoverage, submittedCount, submittedStudents, totalResponses, totalStudents, viewedStepIds]);

  return renderInteractiveManifestStep({
    manifest: activeManifest,
    step: stepManifest,
    moduleRegistry: contentRegistry,
    extra: { revealProgress, allowInlineReveal, onInlineReveal },
  });
}

export function UNIT_5_6StudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: UNIT_5_6StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  const activeManifest = requireUnit56Manifest(manifest);
  const stepManifest = getUNIT_5_6ManifestStepFromManifest(activeManifest, step.id);
  if (stepManifest.modules.some((module) => panelId(module) === 'rust_cold_chain_route_compare_panel')) return null;
  return renderStudentInteractiveActivity({
    registry: createManifestStudentActivityRegistry<UNIT_5_6StepDefinition>(),
    step,
    stepManifest,
    savedResponse,
    released,
    browseEnabled,
    answerVisible,
    revealProgress,
    onSubmit,
  });
}

function parseRouteObservation(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as {
      route?: RouteId;
      recovery_time?: string;
      benefit_judgment?: string;
      boundary_judgment?: string;
    };
    if (!parsed.route) return null;
    return parsed;
  } catch {
    return null;
  }
}

function RouteObservationTeacherSummary({ responses }: { responses: TeacherResponseItem[] }) {
  const rows = responses
    .map((item) => {
      const parsed = parseRouteObservation(item.response.answers.cold_chain_route_observation);
      return parsed ? { studentName: item.studentName, observation: parsed } : null;
    })
    .filter(Boolean) as Array<{ studentName: string; observation: NonNullable<ReturnType<typeof parseRouteObservation>> }>;

  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-title text-base font-semibold leading-7">路线观察聚合</div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border/70">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">学生</th><th className="px-3 py-2">路线</th><th className="px-3 py-2">恢复时间</th><th className="px-3 py-2">收益判断</th><th className="px-3 py-2">证据边界</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={`${row.studentName}-${row.observation.route}`} className="border-t">
                <td className="px-3 py-2">{row.studentName}</td>
                <td className="px-3 py-2">{ROUTE_LABELS[row.observation.route ?? 'data']}</td>
                <td className="px-3 py-2">{row.observation.recovery_time ?? '-'}</td>
                <td className="px-3 py-2">{row.observation.benefit_judgment ?? '-'}</td>
                <td className="px-3 py-2">{row.observation.boundary_judgment ?? '-'}</td>
              </tr>
            )) : (
              <tr><td className="px-3 py-3 premium-lesson-muted" colSpan={5}>暂无路线观察提交。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UNIT_5_6TeacherActivitySummary({
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
  step: UNIT_5_6StepDefinition;
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
  const activeManifest = requireUnit56Manifest(manifest);
  const stepManifest = getUNIT_5_6ManifestStepFromManifest(activeManifest, step.id);
  if (stepManifest.modules.some((module) => panelId(module) === 'rust_cold_chain_route_compare_panel')) {
    return (
      <div className="space-y-4">
        <ManifestTeacherControls stepManifest={stepManifest} released={released} browseEnabled={browseEnabled} answerVisible={answerVisible} revealProgress={revealProgress} onToggleRelease={onToggleRelease} onToggleBrowse={onToggleBrowse} onToggleAnswerVisible={onToggleAnswerVisible} onAdvanceReveal={onAdvanceReveal} onResetReveal={onResetReveal} />
        <RouteObservationTeacherSummary responses={responses} />
      </div>
    );
  }

  return renderTeacherInteractiveActivity({
    registry: createManifestTeacherActivityRegistry<UNIT_5_6StepDefinition>(),
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
  });
}
