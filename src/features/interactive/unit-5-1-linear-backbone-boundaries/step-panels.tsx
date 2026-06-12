'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';

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
  type InteractiveRuntimeModuleManifest,
  type InteractiveRuntimeStepManifest,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import {
  getUNIT_5_1ManifestStepFromManifest,
  type UNIT_5_1StepDefinition,
} from '@/lib/unit-5-1-course';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { ControlChartPanel } from '@/resources/control-system/charts/control-chart-panel';

type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };
type ContentRecord = Record<string, unknown>;
type ChartPoint = [number, number];
type ModelResult = {
  response: Array<{ name: string; data: ChartPoint[] }>;
  auxiliary: Array<{ name: string; data: ChartPoint[] }>;
  responseTitle: string;
  auxiliaryTitle: string;
  metrics: string[];
};
export type Unit51BoundaryParameterSnapshot = Record<string, string>;

function asRecord(value: unknown): ContentRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ContentRecord) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
    .map((item) => String(item));
}

function asOptionItems(value: unknown): Array<{ value: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        const text = String(item);
        return { value: text, label: text };
      }
      const record = asRecord(item);
      const optionValue = record.value;
      const optionLabel = record.label;
      if (typeof optionValue !== 'string' && typeof optionLabel !== 'string') return null;
      return {
        value: String(optionValue ?? optionLabel),
        label: String(optionLabel ?? optionValue),
      };
    })
    .filter((item): item is { value: string; label: string } => Boolean(item));
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sat(value: number, limit: number) {
  return clamp(value, -Math.abs(limit), Math.abs(limit));
}

function deadzone(value: number, delta: number, slope: number) {
  if (Math.abs(value) <= delta) return 0;
  return slope * (value > 0 ? value - delta : value + delta);
}

function lineOption(series: Array<{ name: string; data: ChartPoint[] }>, yName: string): EChartsCoreOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 46, right: 18, top: 42, bottom: 34 },
    xAxis: { type: 'value', name: 't / s', min: 0, max: 12 },
    yAxis: { type: 'value', name: yName },
    series: series.map((item) => ({
      name: item.name,
      type: 'line',
      showSymbol: false,
      smooth: true,
      data: item.data,
    })),
  };
}

function bodeOption(series: Array<{ name: string; data: ChartPoint[] }>): EChartsCoreOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 50, right: 18, top: 42, bottom: 36 },
    xAxis: { type: 'log', name: 'omega', min: 0.05, max: 10 },
    yAxis: { type: 'value', name: '幅值 / dB', min: -35, max: 12 },
    series: series.map((item) => ({
      name: item.name,
      type: 'line',
      showSymbol: false,
      smooth: true,
      data: item.data,
    })),
  };
}

function firstOrderResponse(input: (t: number, y: number) => number, duration = 12, dt = 0.02) {
  let y = 0;
  const output: ChartPoint[] = [];
  const command: ChartPoint[] = [];
  for (let i = 0; i <= duration / dt; i += 1) {
    const t = Number((i * dt).toFixed(2));
    const u = input(t, y);
    y += ((-y + u) / 2) * dt;
    output.push([t, y]);
    command.push([t, u]);
  }
  return { output, command };
}

function feedbackResponse(input: {
  reference: number;
  nonlinear: (v: number, t: number, y: number) => number;
  duration?: number;
  dt?: number;
}) {
  const duration = input.duration ?? 12;
  const dt = input.dt ?? 0.02;
  let yLinear = 0;
  let yNonlinear = 0;
  const linear: ChartPoint[] = [];
  const nonlinear: ChartPoint[] = [];
  const desired: ChartPoint[] = [];
  const actual: ChartPoint[] = [];
  for (let i = 0; i <= duration / dt; i += 1) {
    const t = Number((i * dt).toFixed(2));
    const vLinear = 2 * (input.reference - yLinear);
    const vNonlinear = 2 * (input.reference - yNonlinear);
    const uNonlinear = input.nonlinear(vNonlinear, t, yNonlinear);
    yLinear += ((-yLinear + vLinear) / 2) * dt;
    yNonlinear += ((-yNonlinear + uNonlinear) / 2) * dt;
    linear.push([t, yLinear]);
    nonlinear.push([t, yNonlinear]);
    desired.push([t, vNonlinear]);
    actual.push([t, uNonlinear]);
  }
  return { linear, nonlinear, desired, actual };
}

function buildBode(gain: number) {
  const data: ChartPoint[] = [];
  for (let i = 0; i < 100; i += 1) {
    const w = 0.05 * (10 / 0.05) ** (i / 99);
    const mag = Math.abs(gain) / Math.sqrt(1 + (2 * w) ** 2);
    data.push([Number(w.toFixed(3)), 20 * Math.log10(Math.max(mag, 0.001))]);
  }
  return data;
}

function simulateBoundaryModel(modelId: string, params: Record<string, number | string | boolean>): ModelResult {
  if (modelId === 'smooth_tanh_first_order') {
    const inputType = String(params.input_type ?? 'small_step');
    const amplitude = numberValue(params.input_amplitude, inputType === 'large_step' ? 1.5 : 0.2);
    const signal = (t: number) => {
      if (inputType === 'sine' || inputType === '正弦输入') return amplitude * Math.sin(1.2 * t);
      return amplitude;
    };
    const original = firstOrderResponse((t) => Math.tanh(signal(t)));
    const linear = firstOrderResponse((t) => signal(t));
    const equivalentGain = amplitude ? Math.tanh(amplitude) / amplitude : 1;
    return {
      responseTitle: '时域响应：原非线性 / 线性化',
      auxiliaryTitle: '一次谐波幅值估计',
      response: [
        { name: '原非线性', data: original.output },
        { name: '线性化', data: linear.output },
      ],
      auxiliary: [
        { name: '线性化 Glin', data: buildBode(1) },
        { name: '当前幅值等效增益', data: buildBode(equivalentGain) },
      ],
      metrics: [`输入幅值 ${amplitude.toFixed(2)}`, `等效增益约 ${equivalentGain.toFixed(2)}`],
    };
  }

  if (modelId === 'relay_bad_linearization_first_order') {
    const amplitude = numberValue(params.input_amplitude, 0.2);
    const relayAmplitude = numberValue(params.relay_amplitude, 1);
    const original = firstOrderResponse(() => relayAmplitude * Math.sign(amplitude || 1));
    const fake = firstOrderResponse(() => amplitude);
    return {
      responseTitle: '时域响应：继电器 / 伪线性',
      auxiliaryTitle: '伪线性与一次谐波估计',
      response: [
        { name: '继电器输出响应', data: original.output },
        { name: '伪线性响应', data: fake.output },
      ],
      auxiliary: [
        { name: '伪线性 Gfake', data: buildBode(1) },
        { name: '继电器一次谐波估计', data: buildBode(4 * relayAmplitude / (Math.PI * Math.max(amplitude, 0.05))) },
      ],
      metrics: [`继电器幅值 ${relayAmplitude.toFixed(2)}`, '零点不连续，普通导数不存在'],
    };
  }

  if (modelId === 'saturation_actuator_first_order') {
    const reference = numberValue(params.reference_r, 1.2);
    const uMax = numberValue(params.u_max, 1.2);
    const result = feedbackResponse({ reference, nonlinear: (v) => sat(v, uMax) });
    return {
      responseTitle: '响应：忽略饱和 / 实际饱和',
      auxiliaryTitle: '控制量：期望 / 实际',
      response: [
        { name: '线性预测', data: result.linear },
        { name: '饱和响应', data: result.nonlinear },
      ],
      auxiliary: [
        { name: '期望控制量 v', data: result.desired },
        { name: '实际控制量 u', data: result.actual },
      ],
      metrics: [`参考输入 ${reference.toFixed(2)}`, `饱和上限 ${uMax.toFixed(2)}`, Math.abs(2 * reference) > uMax ? '初始控制量触边' : '初始控制量未触边'],
    };
  }

  if (modelId === 'deadzone_feedback_first_order') {
    const reference = numberValue(params.reference_r, 0.12);
    const delta = numberValue(params.deadzone_delta, 0.2);
    const slope = numberValue(params.outer_slope, 1);
    const result = feedbackResponse({ reference, nonlinear: (v) => deadzone(v, delta, slope) });
    return {
      responseTitle: '响应：忽略死区 / 实际死区',
      auxiliaryTitle: '控制量：指令 / 死区输出',
      response: [
        { name: '线性预测', data: result.linear },
        { name: '死区响应', data: result.nonlinear },
      ],
      auxiliary: [
        { name: '指令 v', data: result.desired },
        { name: '实际 u', data: result.actual },
      ],
      metrics: [`参考输入 ${reference.toFixed(2)}`, `死区宽度 ${delta.toFixed(2)}`, `死区外斜率 ${slope.toFixed(2)}`],
    };
  }

  if (modelId === 'hysteresis_relay_feedback_first_order') {
    const reference = numberValue(params.reference_r, 0.5);
    const h = numberValue(params.hysteresis_h, 0.05);
    const amp = numberValue(params.relay_amplitude, 1);
    let memory = amp;
    const result = feedbackResponse({
      reference,
      nonlinear: (v) => {
        if (v > h) memory = amp;
        if (v < -h) memory = -amp;
        return memory;
      },
    });
    return {
      responseTitle: '响应：连续预测 / 滞环继电器',
      auxiliaryTitle: '控制量：连续 / 切换',
      response: [
        { name: '线性预测', data: result.linear },
        { name: '滞环响应', data: result.nonlinear },
      ],
      auxiliary: [
        { name: '连续控制量', data: result.desired },
        { name: '继电器输出', data: result.actual },
      ],
      metrics: [`目标 ${reference.toFixed(2)}`, `滞环宽度 ${h.toFixed(2)}`, `继电器幅值 ${amp.toFixed(2)}`],
    };
  }

  const reference = numberValue(params.reference_r, 1);
  const rateLimit = numberValue(params.rate_limit, 0.35);
  const actuatorTa = numberValue(params.actuator_Ta, 0.2);
  let actuator = 0;
  const result = feedbackResponse({
    reference,
    nonlinear: (v) => {
      const du = sat((v - actuator) / Math.max(actuatorTa, 0.05), rateLimit);
      actuator += du * 0.02;
      return actuator;
    },
  });
  return {
    responseTitle: '响应：理想执行器 / 速率受限',
    auxiliaryTitle: '控制量：期望 / 实际',
    response: [
      { name: '线性预测', data: result.linear },
      { name: '速率受限响应', data: result.nonlinear },
    ],
    auxiliary: [
      { name: '期望 v', data: result.desired },
      { name: '实际 u', data: result.actual },
    ],
    metrics: [`参考输入 ${reference.toFixed(2)}`, `最大变化率 ${rateLimit.toFixed(2)}`, `执行器时间常数 ${actuatorTa.toFixed(2)}`],
  };
}

function defaultParamsFromControls(controls: ContentRecord[]) {
  return Object.fromEntries(
    controls.map((control) => [String(control.id ?? ''), control.default ?? 0]),
  ) as Record<string, number | string | boolean>;
}

function stringifySnapshot(params: Record<string, number | string | boolean>): Unit51BoundaryParameterSnapshot {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]));
}

function Unit51ControlField({
  control,
  value,
  onChange,
}: {
  control: ContentRecord;
  value: number | string | boolean;
  onChange: (value: number | string | boolean) => void;
}) {
  const id = String(control.id ?? '');
  const label = String(control.label ?? id);
  const kind = String(control.kind ?? 'slider');
  const options = asOptionItems(control.options);

  if (kind === 'toggle') {
    return (
      <label className="premium-lesson-control flex items-center justify-between gap-3 px-3 py-2">
        <span>{label}</span>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
      </label>
    );
  }

  if (kind === 'segmented') {
    return (
      <label className="premium-lesson-caption grid gap-2 text-xs">
        <span>{label}</span>
        <select value={String(value)} onChange={(event) => onChange(event.target.value)} className="premium-lesson-select w-full">
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const min = numberValue(control.min, 0);
  const max = numberValue(control.max, 1);
  const step = numberValue(control.step, 0.05);
  const numericValue = numberValue(value, numberValue(control.default, min));

  return (
    <label className="premium-lesson-caption grid gap-2 text-xs">
      <span className="flex items-center justify-between gap-3">
        {label}
        <span>{numericValue.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numericValue}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-cyan-500"
      />
    </label>
  );
}

function Unit51NonlinearBoundaryPanel({
  step,
  module,
  onParameterChange,
}: {
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onParameterChange?: (stepId: string, snapshot: Unit51BoundaryParameterSnapshot) => void;
}) {
  const blockKey = typeof module.payload.block_key === 'string' ? module.payload.block_key : 'rust_panel';
  const panelBlock = asRecord(step.contentBlocks[blockKey]);
  const controls = Array.isArray(panelBlock.controls) ? panelBlock.controls.map(asRecord) : [];
  const modelId = String(panelBlock.model_id ?? '');
  const [params, setParams] = useState<Record<string, number | string | boolean>>(() => defaultParamsFromControls(controls));
  const result = useMemo(() => simulateBoundaryModel(modelId, params), [modelId, params]);
  const text = typeof module.payload.text === 'string' ? module.payload.text : undefined;

  useEffect(() => {
    onParameterChange?.(step.id, stringifySnapshot(params));
  }, [onParameterChange, params, step.id]);

  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-1-nonlinear-boundary-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">{module.title ?? '非线性边界曲线面板'}</h3>
          {text ? <p className="premium-lesson-muted mt-2 text-sm leading-7">{text}</p> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ControlChartPanel title={result.responseTitle} option={lineOption(result.response, 'y')} chartClassName="h-[300px]" />
        <ControlChartPanel
          title={result.auxiliaryTitle}
          option={modelId.includes('linearization') || modelId.includes('smooth') || modelId.includes('relay_bad') ? bodeOption(result.auxiliary) : lineOption(result.auxiliary, 'u')}
          chartClassName="h-[300px]"
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {controls.map((control) => {
          const id = String(control.id ?? '');
          if (!id) return null;
          return (
            <Unit51ControlField
              key={id}
              control={control}
              value={params[id] ?? control.default ?? 0}
              onChange={(value) => {
                setParams((prev) => {
                  return { ...prev, [id]: value };
                });
              }}
            />
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {result.metrics.map((metric) => (
          <div key={metric} className="premium-lesson-surface-elevated px-3 py-2 text-sm">
            {metric}
          </div>
        ))}
      </div>
    </section>
  );
}

export function Unit51StudentSummaryStats({
  submittedCount,
  viewedCount,
  parameterSubmissionCount,
  prePostCompletion,
}: {
  submittedCount: number;
  viewedCount: number;
  parameterSubmissionCount: number;
  prePostCompletion: string;
}) {
  const abilitySummary = (() => {
    if (!submittedCount) return '等待形成边界证据';
    if (parameterSubmissionCount > 0 && prePostCompletion === '前测与后测均已提交') {
      return '已形成边界证据与参数探索记录';
    }
    if (parameterSubmissionCount > 0) return '已记录参数探索，后测链条待补';
    return '已提交判断，参数探索待补';
  })();

  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-1-student-summary-stats">
      <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">个人课堂表现统计</div>
      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">已浏览页面</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{viewedCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">已提交互动</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{submittedCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">前后测状态</div>
          <div className="premium-lesson-title mt-1 text-sm font-semibold">{prePostCompletion}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">参数探索提交</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{parameterSubmissionCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">关键能力摘要</div>
          <div className="premium-lesson-title mt-1 text-sm font-semibold">{abilitySummary}</div>
        </div>
      </div>
    </section>
  );
}

export function Unit51TeacherSummaryStats({
  studentCount,
  submittedStudents,
  totalResponses,
  parameterCoverage,
  objectiveAccuracy,
  shortAnswerCompleteness,
  misconceptionSummary,
}: {
  studentCount: number;
  submittedStudents: number;
  totalResponses: number;
  parameterCoverage: number;
  objectiveAccuracy: number;
  shortAnswerCompleteness: number;
  misconceptionSummary: string;
}) {
  const rate = studentCount ? Math.round((submittedStudents / studentCount) * 100) : 0;
  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-1-teacher-summary-stats">
      <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">班级整体表现统计</div>
      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">参与学生</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{studentCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">提交覆盖</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{rate}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">客观题正确率</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{objectiveAccuracy}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">主观题完整率</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{shortAnswerCompleteness}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">参数探索覆盖</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{parameterCoverage}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3 md:col-span-5">
          <div className="premium-lesson-caption text-xs">常见误判标签</div>
          <div className="premium-lesson-title mt-1 text-sm font-semibold">
            {misconceptionSummary} · 提交总数 {totalResponses}
          </div>
        </div>
      </div>
    </section>
  );
}

export function UNIT_5_1StepContentPanel({
  step,
  manifest,
  revealProgress,
  allowInlineReveal,
  viewerRole,
  submittedCount = 0,
  viewedCount = 0,
  studentCount = 0,
  submittedStudents = 0,
  totalResponses = 0,
  parameterSubmissionCount = 0,
  prePostCompletion = '等待提交',
  parameterCoverage = 0,
  objectiveAccuracy = 0,
  shortAnswerCompleteness = 0,
  misconceptionSummary = '暂无聚合',
  onParameterChange,
  onAdvanceReveal,
}: {
  step: UNIT_5_1StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  revealProgress: number;
  allowInlineReveal: boolean;
  viewerRole: 'student' | 'teacher';
  submittedCount?: number;
  viewedCount?: number;
  studentCount?: number;
  submittedStudents?: number;
  totalResponses?: number;
  parameterSubmissionCount?: number;
  prePostCompletion?: string;
  parameterCoverage?: number;
  objectiveAccuracy?: number;
  shortAnswerCompleteness?: number;
  misconceptionSummary?: string;
  onParameterChange?: (stepId: string, snapshot: Unit51BoundaryParameterSnapshot) => void;
  onAdvanceReveal?: () => void;
}) {
  const role = viewerRole;
  if (!manifest) {
    throw new Error('5-1 runtime manifest is required for page rendering.');
  }
  const activeManifest = manifest;
  const stepManifest = getUNIT_5_1ManifestStepFromManifest(activeManifest, step.id);
  const sharedRegistry = createManifestContentModuleRegistry({
    revealProgress,
    allowInlineReveal,
    onInlineReveal: onAdvanceReveal,
  });
  const renderRustAnalysisPanel = ({
    step: manifestStep,
    module,
  }: {
    step: InteractiveRuntimeStepManifest;
    module: InteractiveRuntimeModuleManifest;
  }) => (
    <Unit51NonlinearBoundaryPanel
      key={`${manifestStep.id}:${module.id}`}
      step={manifestStep}
      module={module}
      onParameterChange={onParameterChange}
    />
  );
  const renderStatPanel = ({ module }: { module: InteractiveRuntimeModuleManifest }) => {
    const visibility = String(module.payload.role_visibility ?? '');
    if (visibility === 'student_only' && viewerRole !== 'student') {
      return <div hidden aria-hidden="true" data-role-hidden-module={module.id} />;
    }
    if (visibility === 'teacher_only' && viewerRole !== 'teacher') {
      return <div hidden aria-hidden="true" data-role-hidden-module={module.id} />;
    }
    if (viewerRole === 'student') {
      return (
        <Unit51StudentSummaryStats
          submittedCount={submittedCount}
          viewedCount={viewedCount}
          parameterSubmissionCount={parameterSubmissionCount}
          prePostCompletion={prePostCompletion}
        />
      );
    }
    return (
      <Unit51TeacherSummaryStats
        studentCount={studentCount}
        submittedStudents={submittedStudents}
        totalResponses={totalResponses}
        parameterCoverage={parameterCoverage}
        objectiveAccuracy={objectiveAccuracy}
        shortAnswerCompleteness={shortAnswerCompleteness}
        misconceptionSummary={misconceptionSummary}
      />
    );
  };
  const moduleRegistry = {
    ...sharedRegistry,
    'compute.panel': (props: { step: InteractiveRuntimeStepManifest; module: InteractiveRuntimeModuleManifest }) => {
      const legacyKind = typeof props.module.payload.legacyKind === 'string' ? props.module.payload.legacyKind : '';
      const capabilityRef = typeof props.module.payload.capabilityRef === 'string' ? props.module.payload.capabilityRef : '';
      if (legacyKind === 'rust-analysis-panel' || capabilityRef === 'rust-analysis') {
        return renderRustAnalysisPanel(props);
      }
      return sharedRegistry['compute.panel']({
        manifest: activeManifest,
        step: props.step,
        module: props.module,
        extra: { revealProgress, allowInlineReveal, onInlineReveal: onAdvanceReveal },
      });
    },
    'analytics.summary': ({ module }: { module: InteractiveRuntimeModuleManifest }) => {
      const legacyKind = typeof module.payload.legacyKind === 'string' ? module.payload.legacyKind : '';
      if (legacyKind === 'stat-panel') {
        return renderStatPanel({ module });
      }
      return sharedRegistry['analytics.summary']({
        manifest: activeManifest,
        step: stepManifest,
        module,
        extra: { revealProgress, allowInlineReveal, onInlineReveal: onAdvanceReveal },
      });
    },
  };

  return (
    <section className="space-y-4">
      {renderInteractiveManifestStep({
        manifest: activeManifest,
        step: stepManifest,
        moduleRegistry,
        extra: { revealProgress, allowInlineReveal, onInlineReveal: onAdvanceReveal },
      })}
    </section>
  );
}

export function UNIT_5_1StudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: UNIT_5_1StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  const stepManifest = getUNIT_5_1ManifestStepFromManifest(manifest, step.id);
  return (
    <>
      {renderStudentInteractiveActivity({
        registry: createManifestStudentActivityRegistry<UNIT_5_1StepDefinition>(),
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

export function UNIT_5_1TeacherActivitySummary({
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
  step: UNIT_5_1StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
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
  const stepManifest = getUNIT_5_1ManifestStepFromManifest(manifest, step.id);
  return (
    <>
      {renderTeacherInteractiveActivity({
        registry: createManifestTeacherActivityRegistry<UNIT_5_1StepDefinition>(),
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
