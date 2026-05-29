'use client';

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import {
  createManifestContentModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  ManifestTeacherControls,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type ManifestStepResponse,
  type StudentInteractiveActivityRegistry,
  type TeacherInteractiveActivityRegistry,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  renderInteractiveManifestStep,
  type InteractiveModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import type { InteractiveRuntimeManifest, InteractiveRuntimeStepManifest } from '@/lib/interactive-lesson-manifest';
import {
  buildUnit39AnalysisRequest,
  buildUnit39ControllerCurveRequest,
  buildUnit39RampAnalysisRequest,
  formatUnit39ControllerFormula,
  formatUnit39PlantFormula,
  normalizeUnit39PanelParams,
  type Unit39PanelId,
  type Unit39PanelParams,
} from '@/resources/control-system/analysis/unit-3-9-request-builder';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import type { ControlAnalysisResult, CurvePoint } from '@/resources/control-system/analysis/types';
import { axisTooltipFormatter, formatAxisValue, getControlAxisPreset } from '@/resources/control-system/charts/control-bode-options';
import { ControlChartPanel } from '@/resources/control-system/charts/control-chart-panel';
import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';
import { RootLocusPanel } from '@/resources/control-system/charts/control-analysis-panels';
import {
  isUNIT_3_9InteractivePageType,
  type UNIT_3_9StepDefinition,
  type UNIT_3_9StepResponse,
} from '@/lib/unit-3-9-course';
import { TABLE_BUILDER_COLUMNS, TABLE_BUILDER_ROWS, type WorkspaceParameterChange } from './workspace';

type TeacherResponseItem = { studentName: string; response: UNIT_3_9StepResponse };
type MetricRow = { key: string; label: string; reference: string };
type SeriesPoint = { x: number; baseline?: number | null; current?: number | null; controller?: number | null };
type PanelControl = { key: keyof Unit39PanelParams; label: string; min: number; max: number; step: number };

const BASELINE_COLOR = '#f59e0b';
const CURRENT_COLOR = '#22d3ee';
const CONTROLLER_COLOR = '#a78bfa';

const BASELINE_METRICS: MetricRow[] = [
  { key: 'overshoot', label: '超调量', reference: '约 18.7%' },
  { key: 'settling_time', label: '调节时间', reference: '约 46 s' },
  { key: 'phase_margin', label: '相角裕度', reference: '约 48°' },
  { key: 'gain_margin', label: '增益裕度', reference: '约 17 dB' },
  { key: 'ramp_error', label: '单位斜坡误差', reference: '约 25.9' },
];

const PANEL_CONFIG: Record<
  Unit39PanelId,
  {
    title: string;
    defaultParams: Unit39PanelParams;
    controls: PanelControl[];
    controllerLegend: string;
  }
> = {
  baseline: {
    title: '基准版本四联图',
    defaultParams: {},
    controls: [],
    controllerLegend: '基准控制器',
  },
  lead: {
    title: '超前校正互动面板',
    defaultParams: { gain: 2.25, zeroFrequency: 0.5, poleFrequency: 2 },
    controls: [
      { key: 'gain', label: '增益 K', min: 0.5, max: 6, step: 0.01 },
      { key: 'zeroFrequency', label: '超前零点频率', min: 0.03, max: 2, step: 0.01 },
      { key: 'poleFrequency', label: '超前极点频率', min: 0.05, max: 6, step: 0.01 },
    ],
    controllerLegend: '超前装置',
  },
  integral: {
    title: '积分校正互动面板',
    defaultParams: { gain: 2.25, integralZeroFrequency: 0.025 },
    controls: [
      { key: 'gain', label: '增益 K', min: 0.5, max: 6, step: 0.01 },
      { key: 'integralZeroFrequency', label: '积分零点频率', min: 0.002, max: 0.2, step: 0.001 },
    ],
    controllerLegend: '积分控制器',
  },
  integral_example: {
    title: '积分校正例子互动面板',
    defaultParams: { zeroFrequency: 0.05, poleFrequency: 0.5 },
    controls: [
      { key: 'zeroFrequency', label: '校正零点频率', min: 0.005, max: 1, step: 0.001 },
      { key: 'poleFrequency', label: '校正极点频率', min: 0.01, max: 3, step: 0.001 },
    ],
    controllerLegend: '完整控制器',
  },
  lag: {
    title: '滞后对照互动面板',
    defaultParams: { gain: 4.5, zeroFrequency: 0.025, poleFrequency: 0.0125 },
    controls: [
      { key: 'gain', label: '增益 K', min: 0.5, max: 8, step: 0.01 },
      { key: 'zeroFrequency', label: '滞后零点频率', min: 0.005, max: 0.2, step: 0.001 },
      { key: 'poleFrequency', label: '滞后极点频率', min: 0.002, max: 0.1, step: 0.001 },
    ],
    controllerLegend: '完整控制器',
  },
};

function fmt(value: number | null | undefined, suffix = '', digits = 2) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '-';
}

function SurfaceCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="premium-lesson-panel mt-4 px-5 py-4">
      {title ? <h3 className="premium-lesson-title text-lg font-semibold">{title}</h3> : null}
      <div className={title ? 'mt-3 space-y-4' : 'space-y-4'}>{children}</div>
    </section>
  );
}

function zipSeries(
  baseline: CurvePoint[] | undefined,
  current: CurvePoint[] | undefined,
  controller: CurvePoint[] | undefined,
) {
  const count = Math.max(baseline?.length ?? 0, current?.length ?? 0, controller?.length ?? 0);
  const points: SeriesPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const point = baseline?.[index] ?? current?.[index] ?? controller?.[index];
    if (!point) continue;
    points.push({
      x: point.x,
      baseline: baseline?.[index]?.y,
      current: current?.[index]?.y,
      controller: controller?.[index]?.y,
    });
  }
  return points;
}

function toRampErrorSeries(points: CurvePoint[] | undefined) {
  return points?.map((point) => ({ ...point, y: point.x - point.y }));
}

function usesRampErrorPanel(panelId: Unit39PanelId) {
  return panelId === 'integral' || panelId === 'integral_example' || panelId === 'lag';
}

function buildLineOption(input: {
  points: SeriesPoint[];
  title: string;
  xAxisName: string;
  yAxisName: string;
  xAxisType?: 'value' | 'log';
  controllerLegend: string;
}): EChartsCoreOption {
  const series = [
    { key: 'baseline', name: '校正前', color: BASELINE_COLOR },
    { key: 'current', name: '校正后', color: CURRENT_COLOR },
    { key: 'controller', name: input.controllerLegend, color: CONTROLLER_COLOR },
  ] as const;
  return {
    animation: false,
    legend: {
      top: 0,
      right: 8,
      data: series.map((item) => item.name),
      textStyle: { fontSize: 10 },
    },
    tooltip: { trigger: 'axis', formatter: axisTooltipFormatter },
    grid: { top: 34, right: 18, bottom: 42, left: 62 },
    xAxis: {
      type: input.xAxisType ?? 'value',
      name: input.xAxisName,
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { formatter: formatAxisValue },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    yAxis: {
      type: 'value',
      name: input.yAxisName,
      nameLocation: 'middle',
      nameGap: 42,
      axisLabel: { formatter: formatAxisValue },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series: series.map((item) => ({
      name: item.name,
      type: 'line',
      color: item.color,
      showSymbol: false,
      lineStyle: { color: item.color, width: 2.2 },
      data: input.points
        .filter((point) => typeof point[item.key] === 'number' && Number.isFinite(point[item.key]))
        .map((point) => [point.x, point[item.key] as number]),
    })),
  };
}

function evaluateDesign(panelId: Unit39PanelId, baseline: ControlAnalysisResult | null, current: ControlAnalysisResult | null) {
  if (!baseline || !current) return '控制分析结果尚未返回，已保存当前参数。';
  const before = baseline.metrics;
  const after = current.metrics;
  const overshootChange = (after.overshootPct ?? 0) - (before.overshootPct ?? 0);
  const settlingChange = (after.settlingTimeSec ?? 0) - (before.settlingTimeSec ?? 0);
  const phaseChange = (after.phaseMarginDeg ?? 0) - (before.phaseMarginDeg ?? 0);

  if (panelId === 'integral') {
    return phaseChange < -8
      ? '积分低频收益明显，但相角余量被压缩，需要继续回看中频代价。'
      : '积分路径保留了稳态改善目标，当前参数对中频代价较克制。';
  }

  if (panelId === 'lag') {
    return settlingChange > 8
      ? '滞后补偿压低低频误差的同时拉长了尾部，适合写成温和稳态改善。'
      : '当前滞后参数较温和，低频补偿和动态代价保持在可讨论范围。';
  }

  if (panelId === 'integral_example') {
    return phaseChange > -6
      ? '积分任务保留，同时中频校正把相角余量维持在可用范围，可写成综合折中。'
      : '积分收益仍在，但中频相位整理不足，需要继续调整校正零点和极点。';
  }

  return overshootChange < 0 || settlingChange < 0
    ? '超前校正已经表现出动态改善信号，请同时检查相角余量与高频代价。'
    : '当前超前参数的动态改善不明显，需要继续调整零点、极点和增益位置。';
}

function Unit39RustPanel({
  panelId,
  params,
  onParamChange,
}: {
  panelId: Unit39PanelId;
  params: Unit39PanelParams;
  onParamChange?: (key: string, value: number) => void;
}) {
  const config = PANEL_CONFIG[panelId];
  const deferred = useDeferredValue(params);
  const normalized = useMemo(() => normalizeUnit39PanelParams(panelId, deferred), [panelId, deferred]);
  const baselineRequest = useMemo(() => buildUnit39AnalysisRequest('baseline', {}), []);
  const currentRequest = useMemo(() => buildUnit39AnalysisRequest(panelId, normalized), [panelId, normalized]);
  const baselineRampRequest = useMemo(() => buildUnit39RampAnalysisRequest('baseline', {}), []);
  const currentRampRequest = useMemo(() => buildUnit39RampAnalysisRequest(panelId, normalized), [panelId, normalized]);
  const controllerRequest = useMemo(() => buildUnit39ControllerCurveRequest(panelId, normalized), [panelId, normalized]);
  const baseline = useControlEngine(baselineRequest);
  const current = useControlEngine(currentRequest);
  const baselineRamp = useControlEngine(baselineRampRequest);
  const currentRamp = useControlEngine(currentRampRequest);
  const controller = useControlEngine(controllerRequest);
  const showRampError = usesRampErrorPanel(panelId);

  const timeOption = buildLineOption({
    points: showRampError
      ? zipSeries(toRampErrorSeries(baselineRamp.result?.stepResponse.points), toRampErrorSeries(currentRamp.result?.stepResponse.points), undefined)
      : zipSeries(baseline.result?.stepResponse.points, current.result?.stepResponse.points, undefined),
    title: showRampError ? '单位斜坡误差' : '时域响应',
    xAxisName: 't / s',
    yAxisName: showRampError ? 'e(t)' : '输出',
    controllerLegend: config.controllerLegend,
  });
  const magnitudeOption = buildLineOption({
    points: zipSeries(baseline.result?.magnitude.points, current.result?.magnitude.points, controller.result?.magnitude.points),
    title: '幅频响应',
    xAxisName: 'ω / rad/s',
    yAxisName: '幅值 / dB',
    xAxisType: 'log',
    controllerLegend: config.controllerLegend,
  });
  const phaseOption = buildLineOption({
    points: zipSeries(baseline.result?.phase.points, current.result?.phase.points, controller.result?.phase.points),
    title: '相频响应',
    xAxisName: 'ω / rad/s',
    yAxisName: '相位 / deg',
    xAxisType: 'log',
    controllerLegend: config.controllerLegend,
  });

  return (
    <SurfaceCard title={config.title}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="premium-lesson-tone-block premium-tone-cyan">
          <div className="premium-lesson-title text-sm font-medium">控制对象</div>
          <BlockMath math={formatUnit39PlantFormula()} />
        </div>
        <div className="premium-lesson-tone-block premium-tone-cyan">
          <div className="premium-lesson-title text-sm font-medium">当前控制器传递函数</div>
          <BlockMath math={formatUnit39ControllerFormula(panelId, normalized)} />
        </div>
      </div>

      {panelId === 'baseline' ? (
        <ControlFigureWorkspace request={currentRequest} layout="quad" />
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)]">
          <div className="grid gap-4">
            <ControlChartPanel title={showRampError ? '单位斜坡误差：校正前 / 校正后' : '时域响应：校正前 / 校正后'} option={timeOption} />
            {current.result ? (
              <RootLocusPanel result={current.result} caseId={currentRequest.caseId} axisPresetOverride={getControlAxisPreset(currentRequest.caseId, 'rootLocus')} />
            ) : (
              <div className="premium-lesson-tone-block premium-tone-rose text-sm">根轨迹暂时不可用。</div>
            )}
          </div>
          <div className="grid gap-4">
            <ControlChartPanel title="幅频响应：校正前 / 校正后 / 控制器" option={magnitudeOption} />
            <ControlChartPanel title="相频响应：校正前 / 校正后 / 控制器" option={phaseOption} />
          </div>
        </div>
      )}

      {config.controls.length ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
          <div className="premium-lesson-title text-sm font-medium">参数调节</div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {config.controls.map((control) => {
              const value = Number(normalized[control.key] ?? 0);
              return (
                <label key={control.key} className="block">
                  <span className="premium-lesson-title text-sm font-medium">{control.label}</span>
                  <span className="premium-lesson-muted ml-2 text-xs">{fmt(value, '', 3)}</span>
                  <input
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={value}
                    onChange={(event) => onParamChange?.(control.key, Number(event.target.value))}
                    className="mt-2 w-full"
                  />
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </SurfaceCard>
  );
}

type Unit39ModuleExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
};

function createUNIT_3_9ModuleRegistry(extra: Unit39ModuleExtra): InteractiveModuleRegistry<Unit39ModuleExtra> {
  const sharedRegistry = createManifestContentModuleRegistry({
    revealProgress: extra.revealProgress,
    allowInlineReveal: extra.allowInlineReveal,
  });

  return {
    ...sharedRegistry,
    'compute.panel': (props) => {
      const legacyKind = typeof props.module.payload.legacyKind === 'string' ? props.module.payload.legacyKind : '';
      const capabilityRef = typeof props.module.payload.capabilityRef === 'string' ? props.module.payload.capabilityRef : '';
      if (legacyKind === 'rust-analysis-panel' || capabilityRef === 'rust-analysis') {
        const panelId = typeof props.module.payload.panel_id === 'string' ? props.module.payload.panel_id as Unit39PanelId : 'baseline';
        return <Unit39RustPanel panelId={panelId} params={PANEL_CONFIG[panelId]?.defaultParams ?? {}} />;
      }
      return sharedRegistry['compute.panel'](props);
    },
    'rust-analysis-panel': ({ module }) => {
      const panelId = typeof module.payload.panel_id === 'string' ? module.payload.panel_id as Unit39PanelId : 'baseline';
      return <Unit39RustPanel panelId={panelId} params={PANEL_CONFIG[panelId]?.defaultParams ?? {}} />;
    },
  };
}

export function UNIT_3_9StepContentPanel({
  manifest,
  step: _step,
  stepManifest,
  revealProgress,
  allowInlineReveal,
}: {
  manifest: InteractiveRuntimeManifest;
  step: UNIT_3_9StepDefinition;
  stepManifest: InteractiveRuntimeStepManifest;
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const extra = { revealProgress, allowInlineReveal };
  return (
    <div>
      {renderInteractiveManifestStep({
        manifest,
        step: stepManifest,
        moduleRegistry: createUNIT_3_9ModuleRegistry(extra),
        extra,
      })}
    </div>
  );
}

function BaselineMetricForm({
  stepManifest,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  savedResponse?: UNIT_3_9StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_9StepResponse) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(savedResponse?.answers ?? {});
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(savedResponse?.answers ?? {});
  }, [savedResponse]);

  if (!released) {
    return <div className="premium-lesson-panel">教师尚未发放本页填空。</div>;
  }

  return (
    <SurfaceCard title="读图指标填空">
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-background/55">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-border/60 px-3 py-2">指标</th>
              <th className="border-b border-border/60 px-3 py-2">读图填写</th>
              {answerVisible ? <th className="border-b border-border/60 px-3 py-2">参考值</th> : null}
            </tr>
          </thead>
          <tbody>
            {BASELINE_METRICS.map((metric) => (
              <tr key={metric.key}>
                <td className="border-b border-border/40 px-3 py-2 font-medium">{metric.label}</td>
                <td className="border-b border-border/40 px-3 py-2">
                  <input
                    value={draft[metric.key] ?? ''}
                    onChange={(event) => setDraft((prev) => ({ ...prev, [metric.key]: event.target.value }))}
                    className="premium-lesson-input w-full"
                    placeholder={`填写${metric.label}`}
                  />
                </td>
                {answerVisible ? <td className="border-b border-border/40 px-3 py-2 text-cyan-700">{metric.reference}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="premium-lesson-action-primary"
        onClick={() => {
          const timestamp = Date.now();
          setSubmittedAt(timestamp);
          onSubmit({ stepId: stepManifest.id, submittedAt: timestamp, answers: draft });
        }}
      >
        提交答案
      </button>
      <SubmissionStatus
        submitted={Boolean(submittedAt || savedResponse)}
        submittedText="指标填空已提交，修改后可以再次提交。"
        showLock={false}
      />
    </SurfaceCard>
  );
}

function ParameterSliderSubmission({
  stepManifest,
  savedResponse,
  released,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  savedResponse?: UNIT_3_9StepResponse;
  released: boolean;
  onSubmit: (response: UNIT_3_9StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const panelId = resolveUnit39PanelId(stepManifest);
  const initial = savedResponse?.answers ?? (PANEL_CONFIG[panelId].defaultParams as Record<string, string | number>);
  const [params, setParams] = useState<Record<string, string | number>>(initial);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const normalized = normalizeUnit39PanelParams(panelId, params as Unit39PanelParams);
  const baseline = useControlEngine(buildUnit39AnalysisRequest('baseline', {}));
  const current = useControlEngine(buildUnit39AnalysisRequest(panelId, normalized));

  if (!released) {
    return <div className="premium-lesson-panel">教师尚未开放本页参数调节，请先观察页面信息。</div>;
  }

  const updateParam = (key: string, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    onWorkspaceParameterChange?.({ key, value, source: 'slider' });
  };
  const evaluation = evaluateDesign(panelId, baseline.result, current.result);

  return (
    <div className="space-y-4">
      <Unit39RustPanel panelId={panelId} params={params as Unit39PanelParams} onParamChange={updateParam} />
      <SurfaceCard title="提交当前设计">
        <div className="premium-lesson-tone-block premium-tone-cyan text-sm leading-7">{evaluation}</div>
        <button
          type="button"
          className="premium-lesson-action-primary"
          onClick={() => {
            const timestamp = Date.now();
            setSubmittedAt(timestamp);
            onSubmit({
              stepId: stepManifest.id,
              submittedAt: timestamp,
              answers: {
                ...Object.fromEntries(Object.entries(normalized).map(([key, value]) => [key, String(value)])),
                evaluation,
              },
            });
          }}
        >
          提交设计
        </button>
        <SubmissionStatus
          submitted={Boolean(submittedAt || savedResponse)}
          submittedText="当前设计已提交，继续调节后可以再次提交。"
          showLock={false}
        />
      </SurfaceCard>
    </div>
  );
}

function resolveUnit39PanelId(stepManifest: InteractiveRuntimeStepManifest): Unit39PanelId {
  const panelModule = stepManifest.modules.find((item) => item.payload.panel_id);
  return (panelModule?.payload.panel_id as Unit39PanelId | undefined)
    ?? (stepManifest.id === 'step-06' ? 'lead' : stepManifest.id === 'step-07' ? 'integral' : stepManifest.id === 'step-08' ? 'integral_example' : 'lag');
}

function TeacherParameterWorkspace({ stepManifest }: { stepManifest: InteractiveRuntimeStepManifest }) {
  const panelId = resolveUnit39PanelId(stepManifest);
  const [params, setParams] = useState<Record<string, string | number>>(
    PANEL_CONFIG[panelId].defaultParams as Record<string, string | number>,
  );

  return (
    <Unit39RustPanel
      panelId={panelId}
      params={params as Unit39PanelParams}
      onParamChange={(key, value) => setParams((prev) => ({ ...prev, [key]: value }))}
    />
  );
}

function MappingTableForm({
  stepManifest,
  savedResponse,
  released,
  onSubmit,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  savedResponse?: UNIT_3_9StepResponse;
  released: boolean;
  onSubmit: (response: UNIT_3_9StepResponse) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(savedResponse?.answers ?? {});
  const [statusText, setStatusText] = useState<string | null>(savedResponse ? '表格记录已恢复，可以继续修改后提交。' : null);
  useEffect(() => setDraft(savedResponse?.answers ?? {}), [savedResponse]);

  if (!released) {
    return <div className="premium-lesson-panel">教师尚未发放综合映射表。</div>;
  }

  const save = () => {
    setStatusText('已暂存当前表格，切换页面后可以回来继续填写。');
    onSubmit({ stepId: stepManifest.id, submittedAt: Date.now(), answers: { ...draft, __draft: 'true' } });
  };
  const submit = () => {
    setStatusText('表格已提交，留空项也已按当前状态记录。');
    onSubmit({ stepId: stepManifest.id, submittedAt: Date.now(), answers: { ...draft, __submitted: 'true' } });
  };

  return (
    <SurfaceCard title="综合映射表填空">
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-background/55">
        <table className="min-w-[920px] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-border/60 px-3 py-2">版本</th>
              {TABLE_BUILDER_COLUMNS.map((column) => (
                <th key={column.key} className="border-b border-border/60 px-3 py-2">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TABLE_BUILDER_ROWS.map((row) => (
              <tr key={row.key}>
                <td className="border-b border-border/40 px-3 py-2 font-medium">{row.label}</td>
                {TABLE_BUILDER_COLUMNS.map((column) => {
                  const key = `${row.key}.${column.key}`;
                  return (
                    <td key={key} className="border-b border-border/40 px-2 py-2">
                      <textarea
                        value={draft[key] ?? ''}
                        onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                        className="premium-lesson-input min-h-[72px] w-full"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="premium-lesson-action-secondary" onClick={save}>暂存</button>
        <button type="button" className="premium-lesson-action-primary" onClick={submit}>提交</button>
      </div>
      <SubmissionStatus
        submitted={Boolean(statusText)}
        submittedText={statusText ?? '表格已记录。'}
        idleText="可以先暂存，也可以直接提交。"
        showLock={false}
      />
    </SurfaceCard>
  );
}

const SHARED_STUDENT_ACTIVITY = createManifestStudentActivityRegistry<UNIT_3_9StepDefinition>() as unknown as StudentInteractiveActivityRegistry<
  UNIT_3_9StepDefinition,
  UNIT_3_9StepResponse
>;

export function UNIT_3_9StudentActivityForm({
  stepManifest,
  step,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  step: UNIT_3_9StepDefinition;
  savedResponse?: UNIT_3_9StepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: UNIT_3_9StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  if (!isUNIT_3_9InteractivePageType(step.pageType)) return null;
  if (step.pageType === 'structured_compare') {
    return <BaselineMetricForm stepManifest={stepManifest} savedResponse={savedResponse} released={released} answerVisible={answerVisible} onSubmit={onSubmit} />;
  }
  if (step.pageType === 'parameter_slider') {
    return <ParameterSliderSubmission stepManifest={stepManifest} savedResponse={savedResponse} released={released} onSubmit={onSubmit} onWorkspaceParameterChange={onWorkspaceParameterChange} />;
  }
  if (step.pageType === 'table_builder') {
    return <MappingTableForm stepManifest={stepManifest} savedResponse={savedResponse} released={released} onSubmit={onSubmit} />;
  }
  return renderStudentInteractiveActivity({
    registry: SHARED_STUDENT_ACTIVITY,
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

const SHARED_TEACHER_ACTIVITY = createManifestTeacherActivityRegistry<UNIT_3_9StepDefinition>() as unknown as TeacherInteractiveActivityRegistry<
  UNIT_3_9StepDefinition,
  TeacherResponseItem
>;

function Unit39TeacherControlsBlock(props: {
  stepManifest: InteractiveRuntimeStepManifest;
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
  return <ManifestTeacherControls {...props} />;
}

export function UNIT_3_9TeacherActivitySummary({
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
  step: UNIT_3_9StepDefinition;
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
  if (!isUNIT_3_9InteractivePageType(step.pageType)) return null;
  return renderTeacherInteractiveActivity({
    registry: {
      ...SHARED_TEACHER_ACTIVITY,
      parameter_slider: (props) => (
        <div className="space-y-4">
          <Unit39TeacherControlsBlock {...props} />
          <TeacherParameterWorkspace stepManifest={props.stepManifest} />
          <SurfaceCard title="参数设计提交汇总">
            <div className="premium-lesson-muted text-sm">当前收到 {props.responses.length} 份提交。</div>
            {props.responses.slice(0, 6).map((item) => (
              <div key={item.studentName} className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-sm">
                <strong>{item.studentName}：</strong>{item.response.answers.evaluation ?? '已提交参数。'}
              </div>
            ))}
          </SurfaceCard>
        </div>
      ),
      table_builder: (props) => (
        <div className="space-y-4">
          <Unit39TeacherControlsBlock {...props} />
          <SurfaceCard title="综合映射表提交汇总">
            <div className="premium-lesson-muted text-sm">当前收到 {props.responses.length} 份表格记录。</div>
          </SurfaceCard>
        </div>
      ),
    },
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

export function UNIT_3_9StudentSummaryPanel({ responses }: { responses: Record<string, UNIT_3_9StepResponse> }) {
  return (
    <SurfaceCard title="学习收束">
      <div className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-sm leading-7">
        已记录 {Object.keys(responses).length} 个环节的提交。最终要带走的是四个版本的综合映射表，而不是单个参数答案。
      </div>
    </SurfaceCard>
  );
}
