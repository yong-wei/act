'use client';

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { axisTooltipFormatter, formatAxisValue } from '@/resources/control-system/charts/control-bode-options';
import { ControlChartPanel } from '@/resources/control-system/charts/control-chart-panel';
import {
  isUNIT_4_3InteractivePageType,
  type UNIT_4_3RuntimeStepDefinition,
  type UNIT_4_3StepResponse,
} from '@/lib/unit-4-3-course';
import type { WorkspaceParameterChange } from './workspace';

type TeacherResponseItem = { studentName: string; response: UNIT_4_3StepResponse };
type RawCurve = { t: number[]; y: number[] };
type CompoundCaseKey = 'disturbance_ff' | 'reference_ff' | 'setpoint_filter' | 'antiwindup';
type CompoundCaseData = Record<CompoundCaseKey, Record<string, RawCurve>> & {
  parameters: Record<string, string>;
};
type CompoundPanelConfig = {
  caseKey: CompoundCaseKey;
  title: string;
  formulaTitle: string;
  formula: string;
  baselineLabel: string;
  currentLabel: string;
  defaultParams: Record<string, number>;
  controls: Record<string, { label: string; min: number; max: number; step: number; unit?: string }>;
};

const BASELINE_SERIES_COLOR = '#f59e0b';
const CURRENT_SERIES_COLOR = '#22d3ee';
const REFERENCE_SERIES_COLOR = '#94a3b8';
const DISTURBANCE_SERIES_COLOR = '#f97316';
const COMPOUND_CASE_DATA_URL = '/course-runtime/lessons/4-3/media/generated-data/4-3-compound-control-case-data.json';

function isCompoundPanelStepId(stepId: string): stepId is keyof typeof COMPOUND_PANEL_CONFIG {
  return stepId in COMPOUND_PANEL_CONFIG;
}

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

const COMPOUND_PANEL_CONFIG: Record<string, CompoundPanelConfig> = {
  'step-14': {
    caseKey: 'disturbance_ff',
    title: '扰动前馈动态补偿面板',
    formulaTitle: '扰动前馈表达',
    formula: 'F_d(s)=\\lambda_d\\,k_z\\dfrac{s+z_d}{s+p_d}',
    baselineLabel: '无扰动前馈',
    currentLabel: '当前扰动前馈',
    defaultParams: {
      feedforward_zero: 2.14375,
      lowpass_cutoff: 0.125,
      feedforward_strength: 75,
    },
    controls: {
      feedforward_zero: { label: '扰动前馈零点', min: 0.02, max: 4, step: 0.001, unit: 'rad/s' },
      lowpass_cutoff: { label: '一阶低通截止频率', min: 0.02, max: 1, step: 0.001, unit: 'rad/s' },
      feedforward_strength: { label: '前馈强度', min: 0, max: 200, step: 1, unit: '%' },
    },
  },
  'step-15': {
    caseKey: 'reference_ff',
    title: '参考前馈动态补偿面板',
    formulaTitle: '参考前馈表达',
    formula: 'F_r(s)=\\lambda_r\\dfrac{9.375s}{8s+1}',
    baselineLabel: '无参考前馈',
    currentLabel: '当前参考前馈',
    defaultParams: {
      reference_lowpass_cutoff: 0.125,
      reference_feedforward_strength: 75,
    },
    controls: {
      reference_lowpass_cutoff: { label: '参考前馈低通截止频率', min: 0.02, max: 1, step: 0.001, unit: 'rad/s' },
      reference_feedforward_strength: { label: '参考前馈强度', min: 0, max: 200, step: 1, unit: '%' },
    },
  },
  'step-16': {
    caseKey: 'setpoint_filter',
    title: '给定滤波平顺性观察面板',
    formulaTitle: '给定滤波表达',
    formula: 'Q_f(s)=\\dfrac{1}{T_fs+1}',
    baselineLabel: '无给定滤波',
    currentLabel: '当前给定滤波',
    defaultParams: {
      setpoint_filter_cutoff: 0.0625,
    },
    controls: {
      setpoint_filter_cutoff: { label: '给定滤波截止频率', min: 0.01, max: 0.5, step: 0.001, unit: 'rad/s' },
    },
  },
  'step-17': {
    caseKey: 'antiwindup',
    title: '抗饱和动态验证面板',
    formulaTitle: '抗饱和反算表达',
    formula: '\\dot{x}_i=e+\\dfrac{u_{act}-u_{raw}}{T_{aw}}',
    baselineLabel: '无抗饱和',
    currentLabel: '当前抗饱和',
    defaultParams: {
      antiwindup_time_constant: 1.8,
    },
    controls: {
      antiwindup_time_constant: { label: '抗饱和时间常数', min: 0.3, max: 6, step: 0.01, unit: 's' },
    },
  },
};

function compoundBlendFactor(config: CompoundPanelConfig, params: Record<string, number>) {
  if (config.caseKey === 'disturbance_ff') {
    const strength = (params.feedforward_strength ?? 75) / 75;
    const zeroFitness = 1 - Math.min(1, Math.abs((params.feedforward_zero ?? 2.14375) - 2.14375) / 2.14375);
    const cutoffFitness = 1 - Math.min(1, Math.abs((params.lowpass_cutoff ?? 0.125) - 0.125) / 0.6);
    return Math.max(0, Math.min(1.35, strength * (0.6 + 0.2 * zeroFitness + 0.2 * cutoffFitness)));
  }
  if (config.caseKey === 'reference_ff') {
    const strength = (params.reference_feedforward_strength ?? 75) / 75;
    const cutoffFitness = 1 - Math.min(1, Math.abs((params.reference_lowpass_cutoff ?? 0.125) - 0.125) / 0.6);
    return Math.max(0, Math.min(1.35, strength * (0.75 + 0.25 * cutoffFitness)));
  }
  if (config.caseKey === 'setpoint_filter') {
    const cutoff = params.setpoint_filter_cutoff ?? 0.0625;
    return Math.max(0, Math.min(1.25, 0.0625 / Math.max(0.01, cutoff)));
  }
  const tau = params.antiwindup_time_constant ?? 1.8;
  return Math.max(0, Math.min(1.25, 1.8 / Math.max(0.3, tau)));
}

function curvePoints(curve?: RawCurve, targetCount = 360) {
  if (!curve) return [];
  const step = Math.max(1, Math.ceil(Math.min(curve.t.length, curve.y.length) / targetCount));
  const points: Array<[number, number]> = [];
  for (let index = 0; index < Math.min(curve.t.length, curve.y.length); index += step) {
    points.push([curve.t[index]!, curve.y[index]!]);
  }
  const lastIndex = Math.min(curve.t.length, curve.y.length) - 1;
  if (lastIndex >= 0 && points[points.length - 1]?.[0] !== curve.t[lastIndex]) {
    points.push([curve.t[lastIndex]!, curve.y[lastIndex]!]);
  }
  return points;
}

function blendedCurve(base?: RawCurve, target?: RawCurve, factor = 1) {
  if (!base || !target) return [];
  const count = Math.min(base.t.length, base.y.length, target.y.length);
  const step = Math.max(1, Math.ceil(count / 360));
  const points: Array<[number, number]> = [];
  for (let index = 0; index < count; index += step) {
    points.push([base.t[index]!, base.y[index]! + (target.y[index]! - base.y[index]!) * factor]);
  }
  const lastIndex = count - 1;
  if (lastIndex >= 0 && points[points.length - 1]?.[0] !== base.t[lastIndex]) {
    points.push([base.t[lastIndex]!, base.y[lastIndex]! + (target.y[lastIndex]! - base.y[lastIndex]!) * factor]);
  }
  return points;
}

function compoundChartOption({
  title,
  caseData,
  params,
  config,
  output,
}: {
  title: string;
  caseData: Record<string, RawCurve>;
  params: Record<string, number>;
  config: CompoundPanelConfig;
  output: 'heading' | 'rudder';
}): EChartsCoreOption {
  const suffix = output === 'heading' ? '_y' : '_u';
  const before = caseData[`before${suffix}`];
  const after = caseData[`after${suffix}`];
  const factor = compoundBlendFactor(config, params);
  const dynamicData = blendedCurve(before, after, factor);
  const yValues = [...curvePoints(before), ...dynamicData].map((point) => point[1]);
  const yMin = yValues.length ? Math.min(...yValues) : undefined;
  const yMax = yValues.length ? Math.max(...yValues) : undefined;
  const ySpan = typeof yMin === 'number' && typeof yMax === 'number' ? Math.max(yMax - yMin, 1e-3) : 1;
  const yPad = Math.max(ySpan * 0.1, 0.02);

  return {
    animation: false,
    legend: {
      top: 0,
      right: 8,
      data: ['参考输入', '扰动输入', config.baselineLabel, config.currentLabel],
      textStyle: { fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
    },
    tooltip: { trigger: 'axis', formatter: axisTooltipFormatter },
    grid: { top: 38, right: 18, bottom: 42, left: 62 },
    xAxis: {
      type: 'value',
      name: 't / s',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { formatter: formatAxisValue },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    yAxis: {
      type: 'value',
      min: typeof yMin === 'number' ? yMin - yPad : undefined,
      max: typeof yMax === 'number' ? yMax + yPad : undefined,
      name: output === 'heading' ? '航向 / rad' : '舵角 / rad',
      nameLocation: 'middle',
      nameGap: 42,
      axisLabel: { formatter: formatAxisValue },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series: [
      {
        name: '参考输入',
        type: 'line',
        color: REFERENCE_SERIES_COLOR,
        showSymbol: false,
        lineStyle: { color: REFERENCE_SERIES_COLOR, width: 1.6, type: 'dashed' },
        data: curvePoints(caseData.reference, 240),
      },
      {
        name: '扰动输入',
        type: 'line',
        color: DISTURBANCE_SERIES_COLOR,
        showSymbol: false,
        lineStyle: { color: DISTURBANCE_SERIES_COLOR, width: 1.4, type: 'dotted' },
        data: curvePoints(caseData.disturbance, 240),
      },
      {
        name: config.baselineLabel,
        type: 'line',
        color: BASELINE_SERIES_COLOR,
        showSymbol: false,
        lineStyle: { color: BASELINE_SERIES_COLOR, width: 2.2 },
        itemStyle: { color: BASELINE_SERIES_COLOR },
        data: curvePoints(before),
      },
      {
        name: config.currentLabel,
        type: 'line',
        color: CURRENT_SERIES_COLOR,
        showSymbol: false,
        lineStyle: { color: CURRENT_SERIES_COLOR, width: 2.4 },
        itemStyle: { color: CURRENT_SERIES_COLOR },
        data: dynamicData,
      },
    ],
    title: { text: title, show: false },
  };
}

function CompoundControlPanel({
  stepId,
  onWorkspaceParameterChange,
}: {
  stepId: keyof typeof COMPOUND_PANEL_CONFIG;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const config = COMPOUND_PANEL_CONFIG[stepId];
  const [params, setParams] = useState<Record<string, number>>(config.defaultParams);
  const [caseBundle, setCaseBundle] = useState<CompoundCaseData | null>(null);
  const deferred = useDeferredValue(params);
  const caseData = caseBundle?.[config.caseKey];
  const feedbackFormula = caseBundle?.parameters.feedback ?? 'C_b(s)';

  useEffect(() => {
    for (const [key, value] of Object.entries(config.defaultParams)) {
      onWorkspaceParameterChange?.({ key, value, source: 'default' });
    }
  }, [config.defaultParams, onWorkspaceParameterChange]);

  useEffect(() => {
    let cancelled = false;
    void fetch(COMPOUND_CASE_DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${COMPOUND_CASE_DATA_URL}`);
        return response.json() as Promise<CompoundCaseData>;
      })
      .then((payload) => {
        if (!cancelled) setCaseBundle(payload);
      })
      .catch(() => {
        if (!cancelled) setCaseBundle(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const headingOption = useMemo(
    () => caseData ? compoundChartOption({ title: '航向响应', caseData, params: deferred, config, output: 'heading' }) : null,
    [caseData, config, deferred],
  );
  const rudderOption = useMemo(
    () => caseData ? compoundChartOption({ title: '舵角响应', caseData, params: deferred, config, output: 'rudder' }) : null,
    [caseData, config, deferred],
  );
  const parameterRows = Object.entries(deferred).map(([key, value]) => {
    const control = config.controls[key];
    return {
      key,
      label: control?.label ?? key,
      value: `${fmt(value, control?.unit ? ` ${control.unit}` : '', control?.step && control.step < 0.01 ? 3 : 2)}`,
    };
  });

  return (
    <SurfaceCard title={config.title}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="premium-lesson-tone-block premium-tone-cyan">
          <div className="premium-lesson-title text-sm font-medium">反馈主结构</div>
          <div className="mt-2 overflow-x-auto">
            <BlockMath math={feedbackFormula} />
          </div>
        </div>
        <div className="premium-lesson-tone-block premium-tone-cyan">
          <div className="premium-lesson-title text-sm font-medium">{config.formulaTitle}</div>
          <div className="mt-2 overflow-x-auto">
            <BlockMath math={config.formula} />
          </div>
        </div>
      </div>
      {headingOption && rudderOption ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ControlChartPanel title="航向响应" option={headingOption} chartClassName="h-[320px]" />
          <ControlChartPanel title="舵角响应" option={rudderOption} chartClassName="h-[320px]" />
        </div>
      ) : (
        <div className="premium-lesson-tone-block premium-tone-amber">
          正在读取本页运行时曲线数据。
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {parameterRows.map((row) => (
          <div key={row.key} className="premium-lesson-surface-elevated rounded-2xl border border-white/10 p-3">
            <div className="premium-lesson-kicker">{row.label}</div>
            <div className="premium-lesson-title mt-2 text-base font-semibold">{row.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
        <div className="premium-lesson-title text-sm font-medium">参数控件</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {Object.entries(config.controls).map(([key, meta]) => (
            <div key={key}>
              <div className="premium-lesson-title text-sm font-medium">{meta.label}</div>
              <div className="premium-lesson-muted mt-1 text-xs">
                {fmt(deferred[key], meta.unit ? ` ${meta.unit}` : '', meta.step < 0.01 ? 3 : 2)}
              </div>
              <input aria-label="初始方案验证参数"
                type="range"
                min={meta.min}
                max={meta.max}
                step={meta.step}
                value={params[key]}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setParams((current) => ({ ...current, [key]: next }));
                  onWorkspaceParameterChange?.({ key, value: next, source: 'slider' });
                }}
                className="mt-2 w-full"
              />
            </div>
          ))}
        </div>
      </div>
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
  const renderInteractiveFigurePanel: InteractiveModuleRegistry<Unit43ModuleExtra>[string] = ({ step, module }) =>
    isCompoundPanelStepId(step.id) ? (
      <CompoundControlPanel
        stepId={step.id}
        onWorkspaceParameterChange={extra.onWorkspaceParameterChange}
      />
    ) : (
      sharedRegistry['interactive-figure-panel']?.({
        manifest,
        step,
        module,
        extra: {
          revealProgress: extra.revealProgress,
          allowInlineReveal: extra.allowInlineReveal,
        },
      }) ?? null
    );

  return {
    ...sharedRegistry,
    'content.stageMap': (props) => (
      <>
        {sharedRegistry['content.stageMap']?.({
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
    'compute.panel': (props) => {
      const legacyKind = typeof props.module.payload.legacyKind === 'string' ? props.module.payload.legacyKind : '';
      const capabilityRef = typeof props.module.payload.capabilityRef === 'string' ? props.module.payload.capabilityRef : '';
      if (legacyKind === 'interactive-figure-panel' || capabilityRef === 'interactive-figure') {
        return renderInteractiveFigurePanel(props);
      }
      return sharedRegistry['compute.panel']?.(props) ?? null;
    },
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

const UNIT_4_3_STUDENT_ACTIVITY_REGISTRY: StudentInteractiveActivityRegistry<
  UNIT_4_3RuntimeStepDefinition,
  UNIT_4_3StepResponse
> = {
  none: () => null,
  display: () => null,
  summary: () => null,
  single_choice: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.single_choice,
  card_sort: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.card_sort,
  step_reveal: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.step_reveal,
  quiz_group: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.quiz_group,
  activity_card_set: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.activity_card_set,
  interactive_figure_submit: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.interactive_figure_submit,
  task_card_workspace: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.task_card_workspace,
  worked_example_reveal: UNIT_4_3_SHARED_STUDENT_ACTIVITY_REGISTRY.worked_example_reveal,
};

const UNIT_4_3_TEACHER_ACTIVITY_REGISTRY = createManifestTeacherActivityRegistry<UNIT_4_3RuntimeStepDefinition>() as unknown as TeacherInteractiveActivityRegistry<
  UNIT_4_3RuntimeStepDefinition,
  TeacherResponseItem
>;

export function UNIT_4_3StudentActivityForm({
  stepManifest,
  step,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  workspaceParameters,
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
  workspaceParameters?: Record<string, string | number | boolean>;
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
        workspaceParameters,
        onSubmit,
      })}
    </>
  );
}

export function UNIT_4_3StudentSummaryPanel({ responses }: { responses: Record<string, UNIT_4_3StepResponse> }) {
  return (
    <SurfaceCard title="第一版方案学习收束">
      <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm leading-6">
        已完成 {Object.keys(responses).length} 个步骤的作答记录。请把反馈主结构、前馈补偿、给定滤波、执行器保护与抗饱和验证一起带到下一轮权衡优化。
      </div>
    </SurfaceCard>
  );
}

export function UNIT_4_3TeacherSummaryPanel({
  studentCount,
  totalSubmittedSteps,
}: {
  studentCount: number;
  totalSubmittedSteps: number;
}) {
  return (
    <SurfaceCard title="班级整体表现统计">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
          <div className="premium-lesson-kicker">参与人数</div>
          <div className="premium-lesson-title mt-2 text-2xl font-semibold">{studentCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
          <div className="premium-lesson-kicker">累计提交页次</div>
          <div className="premium-lesson-title mt-2 text-2xl font-semibold">{totalSubmittedSteps}</div>
        </div>
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
  return (
    <>
      {renderTeacherInteractiveActivity({
        registry: UNIT_4_3_TEACHER_ACTIVITY_REGISTRY,
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
