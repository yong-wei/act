'use client';

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import Image from 'next/image';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import {
  buildUnit43AnalysisRequest,
  formatUnit43ControllerFormula,
  formatUnit43PlantFormula,
  getUnit43FallbackResult,
  normalizeUnit43PanelParams,
  type Unit43PanelId,
} from '@/resources/control-system/analysis/unit-4-3-request-builder';
import { getUnit43DesignPayload } from '@/resources/control-system/analysis/unit-4-3-fixtures';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import { axisTooltipFormatter, formatAxisValue, getControlAxisPreset } from '@/resources/control-system/charts/control-bode-options';
import { ControlChartPanel } from '@/resources/control-system/charts/control-chart-panel';
import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';
import {
  getUNIT_4_3PageContract,
  type UNIT_4_3StepDefinition,
  type UNIT_4_3StepResponse,
} from '@/lib/unit-4-3-course';
import type { WorkspaceParameterChange } from './workspace';

type TeacherResponseItem = { studentName: string; response: UNIT_4_3StepResponse };
type MetricRow = { label: string; baseline: string; current: string };
type PromptContentBlock = { type: 'text' | 'math'; value: string };
type PromptContent = PromptContentBlock[];
type PromptField = { key: string; title: string; prompt: PromptContent; placeholder: string; half?: boolean };
type ComparisonPoint = { x: number; baseline: number | null; current: number | null };

const HEADING_PLANT_TEX = 'P_h(s)=\\dfrac{0.01715}{s(s+0.1)(s+2.14375)}';
const HEADING_CONTROLLER_TEX = 'C_h(s)=K\\dfrac{Ts+1}{\\alpha Ts+1},\\ 0<\\alpha<1';
const MINI_EXAMPLE_PLANT_TEX = 'P_e(s)=\\dfrac{1}{(s+1)(0.4s+1)(0.1s+1)}';

const QUIZ_OPTIONS = {
  'step-14': [
    [
      '对象已有积分时，为什么不一定先补低频能力。',
      ['因为本课不允许积分', '因为当前主矛盾未必在低频保持能力', '因为积分一定更慢'],
      '因为当前主矛盾未必在低频保持能力',
    ],
    [
      '参数方向至少应包含哪三项内容。',
      ['先改什么、希望换来什么、可能先透支什么', '结构名称、软件名称、截图', '只写一个参数值'],
      '先改什么、希望换来什么、可能先透支什么',
    ],
    [
      '首轮验证为何必须同时写收益、代价和下一轮优先项。',
      ['因为展示更漂亮', '因为第一版方案的价值在于形成下一轮入口', '因为教师端需要更多字数'],
      '因为第一版方案的价值在于形成下一轮入口',
    ],
  ],
} as const;

const ACTIVITY_FIELDS: Record<string, PromptField[]> = {
  'step-02': [
    {
      key: 'mainConflict',
      title: '当前主矛盾',
      prompt: [{ type: 'text', value: '当前最紧矛盾在哪里？' }],
      placeholder: '写出对象最紧的矛盾。',
      half: true,
    },
    {
      key: 'hardConstraint',
      title: '当前硬约束',
      prompt: [{ type: 'text', value: '当前最不能越过的边界是什么？' }],
      placeholder: '写出当前硬约束。',
      half: true,
    },
    {
      key: 'singleRisk',
      title: '继续单结构最先失守处',
      prompt: [{ type: 'text', value: '若继续强推单结构，最可能先透支哪里？' }],
      placeholder: '写出最先失守的边界。',
      half: true,
    },
    {
      key: 'validationReadout',
      title: '首轮验证重点读数',
      prompt: [{ type: 'text', value: '第一轮最该盯哪组读数？' }],
      placeholder: '写出最该先看的读数。',
      half: true,
    },
  ],
  'step-05': [
    {
      key: 'piRole',
      title: 'PI 负责什么',
      prompt: [{ type: 'text', value: 'PI 的职责是什么？' }],
      placeholder: '说明 PI 如何托举低频。',
      half: true,
    },
    {
      key: 'leadRole',
      title: '超前负责什么',
      prompt: [{ type: 'text', value: '超前的职责是什么？' }],
      placeholder: '说明超前如何整理中频。',
      half: true,
    },
  ],
  'step-06': [
    {
      key: 'lagBenefit',
      title: '主要收益',
      prompt: [{ type: 'text', value: '这一版为什么更稳健？' }],
      placeholder: '写出主要收益。',
      half: true,
    },
    {
      key: 'lagCost',
      title: '主要代价',
      prompt: [{ type: 'text', value: '这一版最明显的代价是什么？' }],
      placeholder: '写出主要代价。',
      half: true,
    },
  ],
  'step-07': [
    {
      key: 'integralRole',
      title: '积分负责什么',
      prompt: [{ type: 'text', value: '积分主要补哪一段行为？' }],
      placeholder: '写出积分职责。',
      half: true,
    },
    {
      key: 'derivativeRole',
      title: '微分与滤波负责什么',
      prompt: [{ type: 'text', value: '微分与滤波分别负责什么？' }],
      placeholder: '写出微分与滤波职责。',
      half: true,
    },
  ],
  'step-08': [
    {
      key: 'headingLeadChoice',
      title: '为何先上超前',
      prompt: [{ type: 'text', value: '为什么此时不先补低频能力？' }],
      placeholder: '围绕积分特性与主矛盾作答。',
      half: true,
    },
  ],
  'step-10': [
    {
      key: 'satisfiedTargets',
      title: '已满足的目标',
      prompt: [{ type: 'text', value: '这一版已经接住了哪些目标？' }],
      placeholder: '写出已满足目标。',
      half: true,
    },
    {
      key: 'nextIssue',
      title: '已暴露代价与下一轮优先项',
      prompt: [{ type: 'text', value: '这一版开始透支什么、下一轮先改什么？' }],
      placeholder: '写出代价与下一轮优先项。',
      half: true,
    },
  ],
  'step-12': [
    {
      key: 'analysis-card',
      title: '对象分析记录单',
      prompt: [
        { type: 'text', value: '请围绕下列对象写出当前主矛盾，并判断继续拉高增益最可能先碰到哪条边界。' },
        { type: 'math', value: 'P_p(s)=\\dfrac{1}{(s+1)(0.4s+1)(0.1s+1)}' },
      ],
      placeholder: '写出主矛盾与边界。',
    },
    {
      key: 'scheme-card',
      title: '初始方案表达卡',
      prompt: [
        { type: 'text', value: '请写出你的初始控制器结构。' },
        { type: 'text', value: '同时说明每一部分负责什么、参数起步方向是什么。' },
      ],
      placeholder: '写出结构、职责与参数方向。',
    },
    {
      key: 'issue-card',
      title: '问题清单移交表',
      prompt: [
        { type: 'text', value: '请写出这版方案已经满足了什么、开始透支什么、下一轮先改什么。' },
      ],
      placeholder: '写出收益、代价与下一轮优先项。',
    },
  ],
  'step-13': [
    {
      key: 'rollBoundary',
      title: '为何不能继续沿用频段分工口径',
      prompt: [{ type: 'text', value: '为什么这里必须回到通道重写？' }],
      placeholder: '说明扰动抑制通道为何不同于给定跟踪。',
      half: true,
    },
  ],
};

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

function TextareaCard({
  title,
  prompt,
  value,
  placeholder,
  onChange,
  half,
}: {
  title: string;
  prompt: PromptContent;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  half?: boolean;
}) {
  return (
    <div className={cn('premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4', half && 'md:col-span-1')}>
      <div className="premium-lesson-title text-sm font-medium">{title}</div>
      <div className="mt-2">{renderPromptContent(prompt)}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="premium-lesson-input mt-3 min-h-[128px] resize-y text-sm"
      />
    </div>
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
  stepId: 'step-09' | 'step-11';
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const steps = REVEALS[stepId];
  const [localVisibleCount, setLocalVisibleCount] = useState(1);

  useEffect(() => {
    setLocalVisibleCount(1);
  }, [stepId]);

  const visibleCount = Math.min(
    steps.length,
    Math.max(1, revealProgress, allowInlineReveal ? localVisibleCount : 1),
  );

  return (
    <div className="space-y-3" data-progressive-reveal="step_click_reveal">
      {steps.map((item, index) => {
        const visible = index < visibleCount;
        const canAdvance = allowInlineReveal && visible && index === visibleCount - 1 && visibleCount < steps.length;

        return (
          <button
            key={`${stepId}-${item.title}`}
            type="button"
            className={cn(
              'block w-full rounded-[28px] border px-4 py-4 text-left transition',
              visible ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-white/10 bg-slate-950/40 opacity-70',
            )}
            onClick={() => {
              if (canAdvance) {
                setLocalVisibleCount((current) => current + 1);
              }
            }}
          >
            <div className="premium-lesson-title text-sm font-medium">{item.title}</div>
            {visible ? <div className="mt-3">{renderPromptContent(item.blocks as PromptContent)}</div> : null}
          </button>
        );
      })}
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
  },
): EChartsCoreOption {
  const baselineData = series
    .filter((point) => typeof point.baseline === 'number' && Number.isFinite(point.baseline))
    .map((point) => [point.x, point.baseline as number]);
  const currentData = series
    .filter((point) => typeof point.current === 'number' && Number.isFinite(point.current))
    .map((point) => [point.x, point.current as number]);

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      formatter: axisTooltipFormatter,
    },
    grid: { top: 18, right: 18, bottom: 42, left: 62 },
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
      min: config.axisPreset?.y[0],
      max: config.axisPreset?.y[1],
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
        name: '校正前',
        type: 'line',
        showSymbol: false,
        smooth: false,
        lineStyle: { color: '#f59e0b', width: 2.2 },
        data: baselineData,
      },
      {
        name: '当前',
        type: 'line',
        showSymbol: false,
        smooth: false,
        lineStyle: { color: '#22d3ee', width: 2.4 },
        data: currentData,
      },
    ],
  };
}

function UnifiedAnalysisPanel({
  stepId,
  onWorkspaceParameterChange,
}: {
  stepId: keyof typeof ANALYSIS_CONFIG;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const config = ANALYSIS_CONFIG[stepId];
  const [params, setParams] = useState<Record<string, number>>(() => {
    if (stepId === 'step-05') {
      return { gain: 6, piPoleFrequency: 1 / 1.8, leadZeroFrequency: 1 / 0.9, leadPoleFrequency: 1 / 0.18 };
    }
    if (stepId === 'step-06') {
      return { gain: 6, lagPoleFrequency: 1 / 20, lagZeroFrequency: 1 / 5, leadZeroFrequency: 1 / 0.8, leadPoleFrequency: 1 / 0.16 };
    }
    if (stepId === 'step-07') {
      return { kp: 3.5, ki: 3.5 / 1.5, kd: 0.25 };
    }
    return { gain: 2.8, leadZeroFrequency: 0.1, leadPoleFrequency: 1 / 4.06 };
  });
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
  const normalized = useMemo(() => normalizeUnit43PanelParams('roll_boundary', deferred), [deferred]);
  const request = useMemo(() => buildUnit43AnalysisRequest('roll_boundary', normalized), [normalized]);
  const fallbackResult = useMemo(() => getUnit43FallbackResult('roll_boundary'), []);
  const analysis = useControlEngine(request, fallbackResult);
  const result = analysis.result ?? fallbackResult;
  const before = getUnit43DesignPayload('roll_boundary');
  const resonance = before.resonance;

  const timeData: ComparisonPoint[] =
    before.time_open?.t?.slice(0, 240).map((x: number, index: number) => ({
      x,
      baseline: before.time_open?.y?.[index] ?? null,
      current: result.stepResponse.points[index]?.y ?? null,
    })) ?? [];

  const bodeData: ComparisonPoint[] =
    before.bode_before?.w?.slice(0, 240).map((x: number, index: number) => ({
      x,
      baseline: before.bode_before?.mag_db?.[index] ?? null,
      current: result.magnitude.points[index]?.y ?? null,
    })) ?? [];

  const magnitudePoints = result.magnitude.points ?? [];
  const currentPeak = magnitudePoints.reduce<{ x: number; y: number } | null>(
    (best, point) => (!best || point.y > best.y ? point : best),
    null,
  );
  const ratio =
    typeof currentPeak?.y === 'number' && typeof resonance?.open_peak_db === 'number'
      ? Math.pow(10, (currentPeak.y - resonance.open_peak_db) / 20)
      : null;

  const timeOption = buildComparisonChartOption(timeData, {
    axisPreset: getControlAxisPreset('unit43_roll_boundary', 'step'),
    xAxisName: 't / s',
    yAxisName: '响应',
  });
  const bodeOption = buildComparisonChartOption(bodeData, {
    axisPreset: getControlAxisPreset('unit43_roll_boundary', 'magnitude'),
    xAxisType: 'log',
    xAxisName: 'ω / rad/s',
    yAxisName: '幅值 / dB',
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
          { label: '共振峰值', baseline: fmt(resonance?.open_peak_db, ' dB'), current: fmt(currentPeak?.y, ' dB') },
          { label: '共振频率', baseline: fmt(resonance?.open_w, ' rad/s', 3), current: fmt(currentPeak?.x, ' rad/s', 3) },
          { label: '振幅比', baseline: '1.000', current: fmt(ratio, '', 3) },
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
  step: UNIT_4_3StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  return null;
}

function renderStepBody(
  step: UNIT_4_3StepDefinition,
  mediaSrc: string | null,
  mediaAlt: string,
  revealProgress: number,
  allowInlineReveal: boolean,
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void,
) {
  switch (step.id) {
    case 'step-01':
      return (
        <SurfaceCard title="课程目标">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              '对象分析：把模型、任务和约束改写成设计入口。',
              '结构分流：判断继续单结构、进入复合结构还是改写通道。',
              '参数方向：写清先改哪段行为、预期改善什么、最可能先透支什么。',
              '首轮验证与问题清单：确认这一版是否值得继续推进。',
            ].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm leading-6">
                {item}
              </div>
            ))}
          </div>
        </SurfaceCard>
      );
    case 'step-02':
      return (
        <SurfaceCard title="对象分析四问">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              '当前最紧矛盾在哪里。',
              '原有单结构还能否继续推。',
              '新机制应当补到哪里。',
              '首轮验证先盯什么。',
            ].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
                {item}
              </div>
            ))}
          </div>
          <div className="premium-lesson-tone-block premium-tone-cyan">
            对象分析记录单：当前主矛盾、当前硬约束、继续单结构最先失守处、首轮验证重点读数。
          </div>
        </SurfaceCard>
      );
    case 'step-03':
      return (
        <>
          <TablePanel
            title="表 1 · 结构分流判断"
            headers={['当前观察', '更合适的起步方向', '设计含义']}
            rows={[
              ['低频精度不足，但动态品质尚可', '继续 PI/滞后 单结构', '先把低频能力补上，再验证是否带来过大动态代价'],
              ['超调、相角裕度或阻尼更紧', '继续 PD/超前 单结构', '先整理中频动态品质，再看速度与高频代价'],
              ['单结构已经改善一项，却明显透支另一项', '进入复合结构', '第二条机制线用来分担职责，而不是把第一条机制线越推越激进'],
              ['给定或扰动通道可测且主问题来自该通道', '反馈 + 前馈组合', '让前馈定向补偿通道，反馈继续保底'],
            ]}
          />
          <SurfaceCard title="职责重分配结论">
            <p className="premium-lesson-muted text-sm leading-6">
              复合结构意味着职责重分配：原来压在一条机制线上的任务，需要改由两条或多条职责线共同承担。
            </p>
          </SurfaceCard>
        </>
      );
    case 'step-04':
      return (
        <>
          <TablePanel
            title="表 2 · 三类复合结构总览"
            headers={['形式', '一般表达式', '更适合解决的问题', '结构分工']}
            rows={[
              ['PI + 超前', 'C(s)=K\\left(1+\\dfrac{1}{T_i s}\\right)\\dfrac{T_\\alpha s+1}{\\alpha T_\\alpha s+1}', '既要压低静差，又要把中频相位和阻尼拉回可接受范围', 'PI 负责低频托举，超前负责中频整理'],
              ['滞后 + 超前', 'C(s)=K\\dfrac{T_\\ell s+1}{\\beta T_\\ell s+1}\\dfrac{T_\\alpha s+1}{\\alpha T_\\alpha s+1}', '速度尚可但低频增益不够，同时又不希望明显牺牲相位裕量', '滞后补低频，超前补相位'],
              ['带微分滤波 PID', 'C(s)=K_p+\\dfrac{K_i}{s}+\\dfrac{K_d s}{T_f s+1}', '需要零静差，又希望提前整理动态品质，同时控制高频放大', '积分补低频，微分改善中频，滤波限制高频代价'],
            ]}
          />
          <SurfaceCard title="职责总览">
            <p className="premium-lesson-muted text-sm leading-6">
              同一条机制线不足以完成任务时，第二条机制线通常用来补足另一段行为。
            </p>
          </SurfaceCard>
        </>
      );
    case 'step-05':
      return (
        <>
          <SurfaceCard title="对象与讲义基线">
            <div className="grid gap-3 md:grid-cols-2">
              <BlockMath math="P_1(s)=\\dfrac{1}{(s+1)(0.4s+1)}" />
              <BlockMath math="C_1(s)=6\\left(1+\\dfrac{1}{1.8s}\\right)\\dfrac{0.9s+1}{0.18s+1}" />
            </div>
            <div className="premium-lesson-muted text-sm leading-6">
              PI 环节负责提高低频增益，超前环节负责在截止频率附近补相位。
            </div>
          </SurfaceCard>
          <TablePanel
            title="表 3 · PI + 超前结果摘要"
            headers={['指标', '校正前', '校正后', '说明']}
            rows={[
              ['超调量', '1.93%', '12.30%', '动态更积极，超调仍处在可接受范围'],
              ['调节时间', '1.63 s', '3.35 s', '引入积分后，系统愿意为零静差付出时间代价'],
              ['稳态误差', '0.50', '约 0', '低频保持能力显著提高'],
              ['相角裕度', '无代表值', '49.36°', '超前环节把中频相位重新托住'],
              ['截止频率', '无代表值', '7.60 rad/s', '响应速度提高，同时控制作用更强'],
            ]}
          />
          <UnifiedAnalysisPanel stepId="step-05" onWorkspaceParameterChange={onWorkspaceParameterChange} />
        </>
      );
    case 'step-06':
      return (
        <>
          <SurfaceCard title="对象与讲义基线">
            <div className="grid gap-3 md:grid-cols-2">
              <BlockMath math="P_2(s)=\\dfrac{1}{(s+1)(0.5s+1)(0.1s+1)}" />
              <BlockMath math="C_2(s)=6\\dfrac{5s+1}{20s+1}\\dfrac{0.8s+1}{0.16s+1}" />
            </div>
            <div className="premium-lesson-muted text-sm leading-6">
              滞后环节负责提高低频增益，超前环节负责补回相位储备。
            </div>
          </SurfaceCard>
          <TablePanel
            title="表 4 · 滞后 + 超前结果摘要"
            headers={['指标', '校正前', '校正后', '说明']}
            rows={[
              ['超调量', '4.75%', '0%', '动态明显变得更保守'],
              ['调节时间', '3.14 s', '17.28 s', '为换取高储备，速度付出了显著代价'],
              ['稳态误差', '0.50', '0.146', '低频能力得到改善，但仍不是零静差'],
              ['相角裕度', '无代表值', '108.70°', '首轮设计明显偏保守'],
              ['截止频率', '无代表值', '1.52 rad/s', '速度下降，说明这一版更偏稳健'],
            ]}
          />
          <UnifiedAnalysisPanel stepId="step-06" onWorkspaceParameterChange={onWorkspaceParameterChange} />
        </>
      );
    case 'step-07':
      return (
        <>
          <SurfaceCard title="对象与讲义基线">
            <div className="grid gap-3 md:grid-cols-2">
              <BlockMath math="P_3(s)=\\dfrac{1}{(s+1)(s+2)}" />
              <BlockMath math="C_3(s)=3.5+\\dfrac{2.333}{s}+\\dfrac{0.25s}{0.05s+1}" />
            </div>
            <div className="premium-lesson-muted text-sm leading-6">
              积分补低频、微分整理中频、滤波限制高频代价。
            </div>
          </SurfaceCard>
          <TablePanel
            title="表 5 · 带微分滤波 PID 结果摘要"
            headers={['指标', '校正前', '校正后', '说明']}
            rows={[
              ['超调量', '0.43%', '0%', '动态保持平稳'],
              ['调节时间', '2.52 s', '3.34 s', '速度略有下降，但稳态和储备更完整'],
              ['稳态误差', '0.667', '约 0', '积分项决定了低频保持能力'],
              ['相角裕度', '无代表值', '84.63°', '微分补偿改善了中频相位'],
              ['截止频率', '无代表值', '1.21 rad/s', '整体更偏稳健而非激进提速'],
            ]}
          />
          <UnifiedAnalysisPanel stepId="step-07" onWorkspaceParameterChange={onWorkspaceParameterChange} />
        </>
      );
    case 'step-08':
      return (
        <SurfaceCard title="客船案例入口">
          <div className="grid gap-3 md:grid-cols-2">
            <BlockMath math={HEADING_PLANT_TEX} />
            <div className="premium-lesson-tone-block premium-tone-amber">
              对象已含积分特性，因此单位反馈下的稳态误差本来就很小。
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {['超调量不超过 20%', '调节时间压到 40 s 左右', '控制峰值不超过 7'].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm">
                {item}
              </div>
            ))}
          </div>
          <div className="premium-lesson-muted text-sm leading-6">
            当前主矛盾在修航过程偏慢与越摆风险，不在继续强化低频保持，因此首轮先用超前整理中频动态品质。
          </div>
        </SurfaceCard>
      );
    case 'step-09':
      return (
        <>
          <SurfaceCard title="客船参数方向显影">
            <div className="grid gap-3 md:grid-cols-2">
              <BlockMath math={HEADING_PLANT_TEX} />
              <BlockMath math={HEADING_CONTROLLER_TEX} />
            </div>
            <div className="premium-lesson-muted text-sm leading-6">
              三项目标：超调量不超过 20%，调节时间压到 40 s 左右，控制峰值不超过 7。
            </div>
          </SurfaceCard>
          <SurfaceCard title="逐步显影链">
            <RevealChain stepId="step-09" revealProgress={revealProgress} allowInlineReveal={allowInlineReveal} />
          </SurfaceCard>
        </>
      );
    case 'step-10':
      return (
        <>
          <TablePanel
            title="表 6 · 客船首轮验证"
            headers={['指标', '校正前', '校正后', '结果解释']}
            rows={[
              ['超调量', '13.50%', '18.86%', '仍满足 20% 约束，但已接近上限'],
              ['峰值时间', '42.16 s', '15.72 s', '修航过程显著加快'],
              ['调节时间', '65.48 s', '36.02 s', '已达到约 40 s 的目标'],
              ['稳态误差', '1.96×10^-4', '约 0', '对象原有积分特性已保证良好低频保持'],
              ['控制峰值', '1.00', '6.89', '接近约束上限，控制力度已较强'],
              ['相角裕度', '54.57°', '49.05°', '超前校正把裕度压到目标附近'],
              ['截止频率', '无代表值', '0.18 rad/s', '与参数方向设定一致'],
            ]}
          />
          <UnifiedAnalysisPanel stepId="step-10" onWorkspaceParameterChange={onWorkspaceParameterChange} />
        </>
      );
    case 'step-11':
      return (
        <>
          <SurfaceCard title="最小例题">
            <div className="grid gap-3 md:grid-cols-2">
              <BlockMath math={MINI_EXAMPLE_PLANT_TEX} />
              <div className="premium-lesson-muted text-sm leading-6">
                要求：稳态误差不大于 0.12，超调量不高于 15%，调节时间不超过 12 s，相角裕度不低于 55°。已知单纯提高增益会让相位储备明显下降。
              </div>
            </div>
          </SurfaceCard>
          <SurfaceCard title="逐步显影链">
            <RevealChain stepId="step-11" revealProgress={revealProgress} allowInlineReveal={allowInlineReveal} />
          </SurfaceCard>
          <SurfaceCard title="分层练习">
            <div className="grid gap-3 md:grid-cols-3">
              {['练习 1：结构判断', '练习 2：参数方向表达', '练习 3：问题清单整理'].map((item) => (
                <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm">
                  {item}
                </div>
              ))}
            </div>
          </SurfaceCard>
        </>
      );
    case 'step-12':
      return (
        <SurfaceCard title="实践工作区">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              '对象分析记录单：主矛盾、硬约束、继续单结构风险、首轮验证重点',
              '初始方案表达卡：控制器结构、各部分职责、参数起步方向',
              '问题清单移交表：已满足目标、已暴露代价、下一轮优先项',
            ].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm leading-6">
                {item}
              </div>
            ))}
          </div>
        </SurfaceCard>
      );
    case 'step-13':
      return (
        <>
          <SurfaceCard title="边界案例：横摇减摇鳍首先是扰动通道重写">
            <div className="grid gap-3 md:grid-cols-2">
              <BlockMath math="G_{\\varphi M_f}(s)=\\dfrac{1}{2.052s^2+0.3929s+1}" />
              <BlockMath math="G_c(s)=0.7858+\\dfrac{2}{s}+4.104s" />
            </div>
            <div className="premium-lesson-muted text-sm leading-6">
              这里的复合结构不是单纯按频段叠加，而是为了重写扰动抑制通道。{mediaSrc ? ` 参考图：${mediaAlt}` : ''}
            </div>
          </SurfaceCard>
          <TablePanel
            title="表 7 · 横摇减摇鳍结果"
            headers={['指标', '原系统', '校正后', '含义']}
            rows={[
              ['共振峰值', '11.32 dB', '1.77 dB', '横摇共振被显著压低'],
              ['共振频率', '0.687 rad/s', '0.687 rad/s', '主要改的是峰值高度，而不是移动共振点'],
              ['振幅比', '1', '0.333', '共振处横摇响应约降为原来的三分之一'],
            ]}
          />
          <RollBoundaryPanel onWorkspaceParameterChange={onWorkspaceParameterChange} />
        </>
      );
    case 'step-14':
      return (
        <SurfaceCard title="收束与去向">
          <div className="grid gap-3">
            {[
              '第一版方案必须包含对象分析、结构分流、参数方向、首轮验证与问题清单。',
              '复合结构的意义在于职责分配，而不是公式长度。',
              '首轮验证的价值在于形成下一轮入口。',
              '4-4 将继续处理多个指标同时拉扯时，下一轮该先改什么。',
            ].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm leading-6">
                {item}
              </div>
            ))}
          </div>
        </SurfaceCard>
      );
    default:
      return mediaSrc ? (
        <SurfaceCard title={step.title}>
          <Image
            src={mediaSrc}
            alt={mediaAlt}
            width={1600}
            height={900}
            unoptimized
            className="h-auto w-full rounded-3xl"
          />
        </SurfaceCard>
      ) : null;
  }
}

export function UNIT_4_3StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  revealProgress,
  allowInlineReveal,
  onWorkspaceParameterChange,
}: {
  step: UNIT_4_3StepDefinition;
  mediaSrc: string | null;
  mediaAlt: string;
  revealProgress: number;
  allowInlineReveal: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  return <div>{renderStepBody(step, mediaSrc, mediaAlt, revealProgress, allowInlineReveal, onWorkspaceParameterChange)}</div>;
}

export function UNIT_4_3StudentActivityForm({
  step,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
  onWorkspaceParameterChange: _onWorkspaceParameterChange,
}: {
  step: UNIT_4_3StepDefinition;
  savedResponse?: UNIT_4_3StepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: UNIT_4_3StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const pageContract = getUNIT_4_3PageContract(step.id);
  const [answers, setAnswers] = useState<Record<string, string>>(savedResponse?.answers ?? {});

  useEffect(() => {
    setAnswers(savedResponse?.answers ?? {});
  }, [savedResponse, step.id]);

  const disabled =
    !released || (pageContract.teacherControls.openBrowse === 'teacher_toggle' && !browseEnabled && revealProgress === 0);
  const submit = () => onSubmit({ stepId: step.id, submittedAt: Date.now(), answers });

  if (pageContract.interactionKind === 'none' || step.id === 'step-09' || step.id === 'step-11') {
    return null;
  }

  return (
    <SurfaceCard title="学生作答区">
      <SubmissionStatus
        submitted={Boolean(savedResponse)}
        submittedText="已提交当前页面作答。"
        idleText={disabled ? '等待教师发放或开放浏览后再提交。' : '提交后会同步到教师端汇总。'}
      />
      {step.id === 'step-03' ? (
        <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
          <div className="premium-lesson-title text-sm font-medium">当前观察更适合走哪一路分流？</div>
          {['继续单结构', '进入复合结构', '反馈 + 前馈组合'].map((option) => (
            <label key={option} className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="branch-choice"
                checked={answers['branch-choice'] === option}
                disabled={disabled}
                onChange={() => setAnswers((current) => ({ ...current, 'branch-choice': option }))}
              />
              <span>{option}</span>
            </label>
          ))}
          {answerVisible ? (
            <div className="premium-lesson-muted mt-3 text-sm">
              参考答案：进入哪一路分流，必须和表 1 的当前观察一一对应。
            </div>
          ) : null}
        </div>
      ) : null}
      {step.id === 'step-14' ? (
        <div className="space-y-3">
          {QUIZ_OPTIONS['step-14'].map(([prompt, options, answer], index) => (
            <div
              key={`${prompt}-${index}`}
              className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4"
            >
              <div className="premium-lesson-title text-sm font-medium">{prompt}</div>
              {options.map((option) => (
                <label key={option} className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name={`post-${index}`}
                    checked={answers[`post-${index}`] === option}
                    disabled={disabled}
                    onChange={() => setAnswers((current) => ({ ...current, [`post-${index}`]: option }))}
                  />
                  <span>{option}</span>
                </label>
              ))}
              {answerVisible ? <div className="premium-lesson-muted mt-3 text-sm">参考答案：{answer}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      {ACTIVITY_FIELDS[step.id] ? (
        <div className={step.id === 'step-12' ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}>
          {ACTIVITY_FIELDS[step.id].map((field) => (
            <div key={field.key}>
              <TextareaCard
                title={field.title}
                prompt={field.prompt}
                value={answers[field.key] ?? ''}
                onChange={(value) => setAnswers((current) => ({ ...current, [field.key]: value }))}
                placeholder={field.placeholder}
                half={field.half}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={submit}
                  className="premium-lesson-action-primary"
                >
                  提交答案
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </SurfaceCard>
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
  step: UNIT_4_3StepDefinition;
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
}
