'use client';

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import {
  getUNIT_4_2PageContract,
  type UNIT_4_2StepDefinition,
  type UNIT_4_2StepResponse,
} from '@/lib/unit-4-2-course';
import { getUnit41FallbackResult } from '@/resources/control-system/analysis/unit-4-1-fixtures';
import { buildUnit41AnalysisRequest } from '@/resources/control-system/analysis/unit-4-1-request-builder';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';
import type { WorkspaceParameterChange } from './workspace';

interface ChoiceOption {
  value: string;
  label: string;
}

interface QuestionCard {
  key: string;
  prompt: string;
  options: ChoiceOption[];
  answer: string;
  explanation: string;
}

interface TextCardDefinition {
  key: string;
  title: string;
  placeholder: string;
}

interface MultiSelectMatrixDefinition {
  key: string;
  title: string;
  options: ChoiceOption[];
}

type TeacherResponseItem = {
  studentName: string;
  response: UNIT_4_2StepResponse;
};

type NativeCasePanelId = 'ship' | 'platform';

const SHIP_FORMULA = 'P_h(s)=\\frac{0.01715}{s(s+0.1)(s+2.14375)}';
const SHIP_CONTROLLER_FORMULA = 'C_0(s)=K_h=2.25';
const SHIP_LOOP_FORMULA = 'L_h(s)=\\frac{0.0385875}{s(s+0.1)(s+2.14375)}';
const PLATFORM_FORMULA =
  'P_p(s)=\\frac{2960\\left(\\frac{s}{15}+1\\right)}{s\\left(\\frac{s}{3}+1\\right)\\left[(1.7s+1)(0.005s+1)(0.001s+1)+100\\right]}';
const PLATFORM_CONTROLLER_FORMULA = 'C_0(s)=K_p=5';
const INPUT_FEEDFORWARD_STRUCTURE_SRC =
  '/course-runtime/lessons/4-2/media/4-2-input-feedforward-vs-pd-structure.png';
const DISTURBANCE_FEEDFORWARD_STRUCTURE_SRC =
  '/course-runtime/lessons/4-2/media/4-2-disturbance-feedforward-structure-compare.png';
const INPUT_FEEDFORWARD_CORE_FORMULA = 'u(s)=C(s)(r(s)-y(s))+F(s)r(s)';
const INPUT_FEEDFORWARD_CLOSED_LOOP_FORMULA = 'T_r^{(ff)}(s)=\\frac{s+4}{s^2+s+4}';
const PD_CLOSED_LOOP_FORMULA = 'T_r^{(PD)}(s)=\\frac{s+4}{s^2+2s+4}';
const DISTURBANCE_FEEDFORWARD_FORMULA = 'T_{yd}(s)=\\frac{G(s)G_{ff}(s)+G_d(s)}{1+G(s)C(s)}';
const DISTURBANCE_IDEAL_FORMULA = 'G_{ff}(s)=-\\frac{G_d(s)}{G(s)}';

const PRETEST_QUESTIONS: QuestionCard[] = [
  {
    key: 'pre-q1',
    prompt: '既然 PID 看起来最全，能否默认先从 PID 开始？',
    options: [
      { value: 'A', label: '可以，功能最全就说明最适合作为所有任务的首轮答案' },
      { value: 'B', label: '不可以，先要判断当前主矛盾落在低频、中频还是通道补偿' },
      { value: 'C', label: '可以，只要后续再慢慢删掉不需要的部分就行' },
    ],
    answer: 'B',
    explanation: '结构名字不是答案；先看主矛盾，再看结构语义。',
  },
  {
    key: 'pre-q2',
    prompt: '前馈能提前补偿，是否就比反馈更高级？',
    options: [
      { value: 'A', label: '是，能提前补偿就意味着可以替代反馈保底' },
      { value: 'B', label: '不是，前馈负责补偿已知通道，反馈负责稳定与鲁棒性保底' },
      { value: 'C', label: '是，只要模型足够准，反馈就可以完全拿掉' },
    ],
    answer: 'B',
    explanation: '前馈是补偿，不是反馈保底的替代品。',
  },
  {
    key: 'pre-q3',
    prompt: '只要目标是“更快更稳”，PD/超前 是否一定优先？',
    options: [
      { value: 'A', label: '是，更快更稳听起来就说明应该先整理中频动态品质' },
      { value: 'B', label: '不一定，还要先看当前主要矛盾是不是低频精度或慢扰动抑制' },
      { value: 'C', label: '是，因为任何任务最终都想提高带宽' },
    ],
    answer: 'B',
    explanation: '“更快”不等于“更适合当前任务”，先看主矛盾落点。',
  },
] as const;

const STEP_04_MATRIX: MultiSelectMatrixDefinition[] = [
  {
    key: 'low-frequency',
    title: '哪些结构更适合先解决低频保持能力与慢扰动抑制？',
    options: [
      { value: 'PI', label: 'PI' },
      { value: 'lag', label: '滞后' },
      { value: 'PD', label: 'PD' },
      { value: 'feedforward', label: '前馈' },
      { value: 'PID', label: 'PID（仅当单一结构解释不了任务时）' },
    ],
  },
  {
    key: 'mid-frequency',
    title: '哪些结构更适合先整理中频动态品质与阻尼？',
    options: [
      { value: 'PD', label: 'PD' },
      { value: 'lead', label: '超前' },
      { value: 'PI', label: 'PI' },
      { value: 'lag', label: '滞后' },
      { value: 'PID', label: 'PID（仅当低频与中频同时吃紧时）' },
    ],
  },
  {
    key: 'channel-compensation',
    title: '哪些结构首先服务“已知给定 / 可测扰动通道”的补偿？',
    options: [
      { value: 'feedforward', label: '前馈' },
      { value: 'P', label: 'P' },
      { value: 'PI', label: 'PI' },
      { value: 'PD', label: 'PD' },
    ],
  },
];

const ACTIVITY_CARD_FIELDS: Record<string, TextCardDefinition[]> = {
  'step-05': [
    { key: 'ship-main-conflict', title: '补出客船当前主矛盾为何属于低频问题', placeholder: '围绕低频保持能力、慢扰动抑制和平顺边界作答。' },
    { key: 'ship-first-cost', title: '写出客船首轮最先需要警惕的代价', placeholder: '例如相位余量变紧、速度未必立刻缩短。' },
  ],
  'step-07': [
    { key: 'platform-main-conflict', title: '写出平台主矛盾为何落在中频', placeholder: '围绕速度已建立、阻尼仍紧、储备要整理作答。' },
    { key: 'platform-first-benefit', title: '写出平台首个预期收益为何不是更快', placeholder: '例如超调先降、阻尼更稳、过程更利落。' },
  ],
  'step-10': [
    { key: 'disturbance-feedback-role', title: '解释为什么扰动前馈加入后反馈仍然有价值', placeholder: '围绕稳定性、鲁棒性与未知扰动保底作答。' },
    { key: 'disturbance-risks', title: '写出阻止照搬理想公式的任意两类工程风险', placeholder: '例如模型失配、测量噪声、因果性或高频放大。' },
  ],
};

const WORKED_EXAMPLE_FIELDS: Record<string, TextCardDefinition[]> = {
  'step-06': [
    { key: 'ship-choice', title: '为什么客船案例不应先上 PD', placeholder: '用低频主矛盾、作用带宽和表 5 结论作答。' },
    { key: 'ship-cost', title: '补低频后最先要警惕的代价是什么', placeholder: '写出相位余量、速度或储备边界变化。' },
  ],
  'step-08': [
    { key: 'platform-choice', title: '为什么稳定平台案例不应先补 PI', placeholder: '用截止频率附近的相位、阻尼与超调比较作答。' },
    { key: 'platform-benefit', title: '若 PD/超前 起步正确，最先该看到什么改善', placeholder: '写出超调、阻尼或动态利落度变化。' },
  ],
  'step-09': [
    { key: 'input-ff-difference', title: '输入前馈与 PD 的核心区别是什么', placeholder: '围绕“参考通道补偿”和“反馈主链改动”作答。' },
    { key: 'input-ff-risk', title: '为什么不能盲目追求任何输入都完全不变', placeholder: '结合过补偿、噪声敏感性和模型依赖作答。' },
  ],
};

const START_CARD_FIELDS = [
  { key: 'currentTask', label: '当前任务', placeholder: '对象是谁，当前主要要解决什么问题' },
  { key: 'mainConflict', label: '最紧矛盾', placeholder: '当前最不能接受的后果是什么' },
  { key: 'preferredStructure', label: '首选单结构', placeholder: '例如：PI / 滞后、PD / 超前、前馈候选' },
  { key: 'parameterDirection', label: '参数起步方向', placeholder: '第一轮先增强哪一类作用' },
  { key: 'expectedBenefit', label: '预期收益', placeholder: '最先希望看到什么改善' },
  { key: 'tradeoff', label: '主要代价', placeholder: '预计会牺牲什么或哪条边界会收紧' },
] as const;

const ASSESSMENT_CARD_FIELDS: QuestionCard[] = [
  {
    key: 'post-q1',
    prompt: '若当前主矛盾是低频保持能力不足，首轮起步更应优先想到哪类结构？',
    options: [
      { value: 'A', label: 'PI / 滞后' },
      { value: 'B', label: 'PD / 超前' },
      { value: 'C', label: '任何任务都先 PID' },
    ],
    answer: 'A',
    explanation: '低频问题先补低频能力。',
  },
  {
    key: 'post-q2',
    prompt: '若速度已经建立但超调与阻尼仍紧，首轮更该先整理哪一段行为？',
    options: [
      { value: 'A', label: '先补低频精度' },
      { value: 'B', label: '先整理中频动态品质' },
      { value: 'C', label: '先取消反馈换成前馈' },
    ],
    answer: 'B',
    explanation: '速度已建立后，超调与阻尼通常对应中频动态品质问题。',
  },
  {
    key: 'post-q3',
    prompt: '前馈进入候选时，哪句话最准确？',
    options: [
      { value: 'A', label: '前馈进入候选后，反馈就不重要了' },
      { value: 'B', label: '前馈负责补偿已知通道，反馈继续承担保底职责' },
      { value: 'C', label: '前馈就是把 PD 换了一个名字' },
    ],
    answer: 'B',
    explanation: '前馈是通道补偿，不替代反馈保底。',
  },
  {
    key: 'post-q4',
    prompt: '4-2 结束时最正式的产物是什么？',
    options: [
      { value: 'A', label: '完整参数整定结果表' },
      { value: 'B', label: '单结构首轮起步卡' },
      { value: 'C', label: '复合结构最终方案' },
    ],
    answer: 'B',
    explanation: '4-2 只产出单结构首轮起步卡，复合结构骨架交给 4-3。',
  },
] as const;

const CASE_PANEL_CONFIG = {
  ship: {
    requestStepId: 'step-04' as const,
    layout: 'quad' as const,
    sliderKey: 'K_h',
    baseline: 2.25,
    min: 1.2,
    max: 4.4,
    step: 0.05,
    label: '客船航向保持共享增益',
    summaryTitle: '客船原生统一面板',
  },
  platform: {
    requestStepId: 'step-05' as const,
    layout: 'platform' as const,
    sliderKey: 'K_p',
    baseline: 5,
    min: 2,
    max: 10,
    step: 0.1,
    label: '稳定平台共享增益',
    summaryTitle: '平台原生统一面板',
  },
} as const;

function toggleDelimitedValue(source: string, value: string) {
  const next = new Set(source ? source.split('|').filter(Boolean) : []);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return Array.from(next).join('|');
}

function FormulaBlock({ formula }: { formula: string }) {
  return <BlockMath math={formula} />;
}

function InfoCard({
  title,
  children,
  tone = 'slate',
}: {
  title: string;
  children: ReactNode;
  tone?: 'slate' | 'cyan' | 'amber' | 'emerald';
}) {
  return (
    <div className={`premium-lesson-tone-block premium-tone-${tone}`}>
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <div className="mt-2 text-sm leading-7">{children}</div>
    </div>
  );
}

function MediaPanel({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="premium-lesson-surface-elevated overflow-hidden rounded-[28px] border border-black/5 bg-white/70">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-auto w-full" />
    </div>
  );
}

function FormulaCard({
  title,
  formula,
  note,
}: {
  title: string;
  formula: string;
  note?: ReactNode;
}) {
  return (
    <div className="premium-lesson-surface-elevated rounded-[28px] px-4 py-4">
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <div className="mt-3 text-sm leading-7">
        <FormulaBlock formula={formula} />
      </div>
      {note ? <div className="premium-lesson-muted mt-2 text-sm leading-7">{note}</div> : null}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">
      <div className="premium-lesson-kicker">{label}</div>
      <div className="premium-lesson-title mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function formatMetric(value: number | null | undefined, digits = 2, suffix = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(digits)}${suffix}`;
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="premium-lesson-input min-h-[104px] w-full resize-y"
    />
  );
}

function ChoiceGroup({
  options,
  value,
  onChange,
}: {
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-left text-sm transition ${
            value === option.value ? 'ring-2 ring-cyan-400' : ''
          }`}
        >
          <span className="font-medium">{option.value}. </span>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CaseNativeWorkspace({
  panelId,
  onWorkspaceParameterChange,
}: {
  panelId: NativeCasePanelId;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const config = CASE_PANEL_CONFIG[panelId];
  const [value, setValue] = useState<number>(config.baseline);
  const deferredValue = useDeferredValue(value);
  const request = useMemo(
    () =>
      buildUnit41AnalysisRequest(config.requestStepId, {
        gain: deferredValue,
        structures: [{ kind: 'gain', enabled: true, params: { k: deferredValue }, label: config.label }],
      }),
    [config.label, config.requestStepId, deferredValue],
  );
  const fallbackResult = useMemo(() => getUnit41FallbackResult(config.requestStepId), [config.requestStepId]);
  const { result } = useControlEngine(request, fallbackResult);

  return (
    <div className="premium-lesson-surface-elevated rounded-[28px] px-4 py-4">
      <div className="premium-lesson-title text-sm font-semibold">{config.summaryTitle}</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        保持现有四面板板式，底部通过统一增益控件联动，实时显示性能指标。
      </div>
      <ControlFigureWorkspace request={request} fallbackResult={fallbackResult} layout={config.layout} />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricPill label="Mp" value={formatMetric(result?.metrics.overshootPct, 2, '%')} />
        <MetricPill label="t_s" value={formatMetric(result?.metrics.settlingTimeSec, panelId === 'ship' ? 2 : 3, ' s')} />
        <MetricPill label="ω_c" value={formatMetric(result?.metrics.gainCrossoverRadPerSec, 4, ' rad/s')} />
        <MetricPill label="PM" value={formatMetric(result?.metrics.phaseMarginDeg, 2, '°')} />
      </div>
      <div className="mt-4 rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
        <div className="premium-lesson-title text-sm font-medium">控件栏</div>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="text-sm">
              当前调节：<InlineMath math={`${config.sliderKey}=${value.toFixed(panelId === 'ship' ? 2 : 1)}`} />
            </div>
            <input
              type="range"
              min={config.min}
              max={config.max}
              step={config.step}
              value={value}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setValue(nextValue);
                onWorkspaceParameterChange?.({ key: config.sliderKey, value: nextValue, source: 'slider' });
              }}
              className="mt-3 w-full"
            />
          </div>
          <InfoCard title="读图提醒" tone="cyan">
            {panelId === 'ship'
              ? '客船先看低频保持能力与慢扰动抑制是否站稳，再看速度与储备代价。'
              : '平台先看截止频率附近的相位、阻尼和超调是否整理得更可接受。'}
          </InfoCard>
        </div>
      </div>
    </div>
  );
}

const TOOLBOX_TABLE_ROWS = [
  ['P', '比例放大当前误差', '提高响应力度；但不能单独消除稳态误差。'],
  ['PI', '补低频与稳态误差', '适合低频保持、慢扰动抑制；代价是相位余量可能收紧。'],
  ['PD', '整理中频阻尼与速度感', '适合超调、阻尼和相位储备问题；代价是噪声敏感。'],
  ['PID', '低频与中频同时参与', '只有单一语义解释不了任务时才压后进入候选。'],
  ['超前', '工程化相位超前', '改善截止频率附近相位与动态品质；高频风险需检查。'],
  ['滞后', '克制地补低频', '低频收益更温和，适合不想大幅牺牲中频储备的场景。'],
  ['前馈', '已知给定或扰动通道补偿', '先削弱误差来源，但不能替代反馈保底。'],
] as const;

const SHIP_TABLE5_ROWS = [
  ['比较项', 'PI / 滞后', 'PD'],
  ['主要作用点', '低频保持能力、慢扰动抑制、稳态误差来源', '截止频率附近的阻尼与相位'],
  ['客船当前矛盾', '直接命中“航向保持先站稳”的低频问题', '没有先处理低频保持能力'],
  ['首个收益', '低频支撑更强，慢扰动下误差更不容易积累', '过程可能更利落，但主矛盾未必改善'],
  ['首个代价', '相位余量与速度边界需要回看', '噪声和高频放大风险更早出现'],
] as const;

const PLATFORM_COMPARE_ROWS = [
  ['比较项', 'PD / 超前', 'PI'],
  ['主要作用点', '截止频率附近的相位、阻尼与超调', '低频精度和稳态误差'],
  ['平台当前矛盾', '速度已建立，首轮更需要整理中频动态品质', '会把问题拉回低频，偏离当前主矛盾'],
  ['首个收益', '超调下降、阻尼改善、过程更利落', '低频收益可能增加，但动态品质改善不直接'],
  ['首个代价', '噪声、高频放大与实现滤波需要检查', '相位余量可能继续收紧'],
] as const;

const REVEAL_STEPS: Record<string, Array<{ title: string; formula?: string; body: string }>> = {
  'step-06': [
    { title: '第 1 步：锁定对象', formula: SHIP_FORMULA, body: '客船对象含积分环节，低频误差积累会直接变成航向保持问题。' },
    { title: '第 2 步：写出基线', formula: SHIP_LOOP_FORMULA, body: '基线只说明对象可被闭环带住，不说明慢扰动和低频保持已经足够。' },
    { title: '第 3 步：对照表5', body: '表5显示 PI / 滞后更直接命中低频保持，而 PD 更偏中频动态整理。' },
    { title: '第 4 步：形成起步句', body: '首轮可从 PI / 滞后起步，并同步检查相位余量和速度代价。' },
  ],
  'step-08': [
    { title: '第 1 步：锁定对象', formula: PLATFORM_FORMULA, body: '稳定平台对象速度优势已经可见，问题不应再先回到低频精度。' },
    { title: '第 2 步：定位中频', body: '若超调和阻尼仍紧，首轮目标应落到截止频率附近的相位与阻尼整理。' },
    { title: '第 3 步：比较 PI 与 PD/超前', body: 'PD / 超前更直接服务中频动态品质，PI 的低频收益不是当前第一矛盾。' },
    { title: '第 4 步：形成起步句', body: '首轮可从 PD / 超前起步，并检查噪声、高频放大和实现滤波。' },
  ],
  'step-09': [
    { title: '第 1 步：区分通道', formula: INPUT_FEEDFORWARD_CORE_FORMULA, body: '输入前馈从参考通道进入，不是把反馈主链里的 PD 改名。' },
    { title: '第 2 步：比较闭环结果', formula: `${INPUT_FEEDFORWARD_CLOSED_LOOP_FORMULA},\\quad ${PD_CLOSED_LOOP_FORMULA}`, body: '根轨迹近似相似不等于结构等价，通道职责不同。' },
    { title: '第 3 步：写验证目标', body: '先验证参考跟踪误差是否减少，再检查过补偿、噪声与模型依赖。' },
  ],
};

function SimpleTable({ rows }: { rows: readonly (readonly string[])[] }) {
  const [head, ...body] = rows;
  return (
    <div className="overflow-x-auto rounded-3xl border border-border/60 bg-background/55">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-background/70">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="border-b border-border/60 px-3 py-3 font-medium text-foreground/80">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row) => (
            <tr key={row.join('-')}>
              {row.map((cell) => (
                <td key={cell} className="border-b border-border/40 px-3 py-3 align-top leading-7 text-foreground/85">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevealChain({ stepId, revealProgress }: { stepId: string; revealProgress: number }) {
  const steps = REVEAL_STEPS[stepId] ?? [];
  const visibleCount = Math.max(1, Math.min(steps.length, revealProgress || 1));

  if (!steps.length) {
    return null;
  }

  return (
    <div data-progressive-reveal="step_click_reveal" className="mt-4 grid gap-3">
      {steps.slice(0, visibleCount).map((item, index) => (
        <div key={item.title} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
          <div className="premium-lesson-kicker">Reveal {index + 1}</div>
          <div className="premium-lesson-title mt-1 text-sm font-semibold">{item.title}</div>
          {item.formula ? (
            <div className="mt-3 overflow-x-auto">
              <FormulaBlock formula={item.formula} />
            </div>
          ) : null}
          <p className="premium-lesson-muted mt-2 text-sm leading-7">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export function UNIT_4_2KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 4 Map</div>
      <div className="premium-lesson-title mt-2 text-lg font-semibold">4-1 -&gt; 4-2 -&gt; 4-3</div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['4-1', '任务表达卡', '写清目标、约束、优先级和证据来源。'],
          ['4-2', '单结构首轮起步', '判断主矛盾，选择首轮单结构和参数方向。'],
          ['4-3', '复合结构骨架', '在 4-2 产物基础上组织完整初始方案。'],
        ].map(([label, title, body], index) => (
          <div key={label} className={`premium-lesson-tone-block ${index === 1 ? 'premium-tone-cyan' : 'premium-tone-slate'}`}>
            <div className="premium-lesson-kicker">{label}</div>
            <div className="premium-lesson-title mt-1 text-sm font-semibold">{title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ToolboxTablePanel() {
  return (
    <div className="grid gap-4">
      <InfoCard title="结构工具箱总表" tone="cyan">
        上方表格至少复现讲义表 3 的前三列：结构、最小作用语义、首轮使用边界。互动区只做多选判断，不再退回单选配对。
      </InfoCard>
      <SimpleTable rows={[['结构', '最小作用语义', '首轮使用边界'], ...TOOLBOX_TABLE_ROWS]} />
      <InfoCard title="PID 压后原则" tone="amber">
        只有低频保持、中频动态和实现代价同时无法由单一结构解释时，PID 或复合结构才进入候选；4-2 只写首轮单结构起步，不直接生成完整复合方案。
      </InfoCard>
    </div>
  );
}

function ReasoningChainPanel() {
  return (
    <div className="grid gap-4">
      <FormulaCard title="开环表达" formula="L(s)=C(s)P(s)" />
      <SimpleTable
        rows={[
          ['判断环节', '判断问题', '输出句式'],
          ['1', '当前最紧的矛盾是什么', '先写不能接受的后果，而不是先写结构名。'],
          ['2', '矛盾主要落在哪段频率或哪条通道', '低频 / 中频 / 已知输入或扰动通道。'],
          ['3', '哪类单结构更直接', 'PI/滞后、PD/超前、前馈分别对应不同作用机制。'],
          ['4', '第一轮参数先朝哪个方向起', '参数方向必须服务主矛盾。'],
          ['5', '最先想验证什么改善', '先验证最紧矛盾是否缓解。'],
          ['6', '最可能先透支什么代价', '收益句后必须补代价句。'],
        ]}
      />
      <InfoCard title="参数方向句式" tone="emerald">
        “先补低频”“先整理中频”“先打开补偿通道”都不是口号，必须能接上第一轮参数变化方向、首个验证指标和主要代价。
      </InfoCard>
    </div>
  );
}

function StartCardTemplatePanel() {
  return (
    <div className="grid gap-4">
      <InfoCard title="六字段最小起步卡" tone="emerald">
        起步卡只保留实践中真正会用到的六个字段：当前任务、最紧矛盾、首选单结构、参数起步方向、预期收益、主要代价。
      </InfoCard>
      <div className="grid gap-3 md:grid-cols-2">
        {START_CARD_FIELDS.map((field) => (
          <div key={field.key} className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">
            <div className="premium-lesson-title font-medium">{field.label}</div>
            <div className="premium-lesson-muted mt-1">{field.placeholder}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UNIT_4_2StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  revealProgress,
  onWorkspaceParameterChange,
}: {
  step: UNIT_4_2StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  revealProgress: number;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  return (
    <section className="premium-lesson-panel px-5 py-5">
      <div className="premium-lesson-kicker">{step.stage} · 4-2</div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm leading-7 sm:text-base">{step.hint}</p>

      {step.id === 'step-01' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          {mediaSrc ? <MediaPanel src={mediaSrc} alt={mediaAlt ?? step.title} /> : null}
          <div className="grid gap-4">
            <InfoCard title="本课只做什么" tone="cyan">
              4-2 只把 4-1 的任务表达卡推进成“单结构首轮起步卡”，不做完整参数整定，也不提前展开复合结构骨架。
            </InfoCard>
            <InfoCard title="本课不做什么" tone="amber">
              不直接喊 PID，不把前馈讲成反馈替代品，不把“更快”直接等同于“更适合当前任务”。
            </InfoCard>
          </div>
        </div>
      ) : null}

      {step.id === 'step-02' ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {PRETEST_QUESTIONS.map((question) => (
            <InfoCard key={question.key} title={question.prompt} tone="slate">
              前测只暴露误区；提交后再看教师是否释放参考答案。
            </InfoCard>
          ))}
        </div>
      ) : null}

      {step.id === 'step-03' ? <div className="mt-4"><ReasoningChainPanel /></div> : null}
      {step.id === 'step-04' ? <div className="mt-4"><ToolboxTablePanel /></div> : null}

      {step.id === 'step-05' ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <FormulaCard title="客船对象" formula={SHIP_FORMULA} />
            <FormulaCard title="基线控制器" formula={SHIP_CONTROLLER_FORMULA} />
            <FormulaCard title="基线开环" formula={SHIP_LOOP_FORMULA} />
          </div>
          <CaseNativeWorkspace panelId="ship" onWorkspaceParameterChange={onWorkspaceParameterChange} />
          <InfoCard title="读图结论" tone="emerald">
            客船首轮不是先追更快，而是先看低频保持能力和慢扰动抑制是否站稳。
          </InfoCard>
        </div>
      ) : null}

      {step.id === 'step-06' ? (
        <div className="mt-4 grid gap-4">
          <InfoCard title="完整题面" tone="cyan">
            已知客船航向保持对象和基线增益，判断首轮结构为何更像 PI / 滞后，而不是先上 PD。
          </InfoCard>
          <SimpleTable rows={SHIP_TABLE5_ROWS} />
          <RevealChain stepId={step.id} revealProgress={revealProgress} />
        </div>
      ) : null}

      {step.id === 'step-07' ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <FormulaCard title="稳定平台对象" formula={PLATFORM_FORMULA} />
            <FormulaCard title="基线控制器" formula={PLATFORM_CONTROLLER_FORMULA} />
          </div>
          <CaseNativeWorkspace panelId="platform" onWorkspaceParameterChange={onWorkspaceParameterChange} />
          <InfoCard title="读图结论" tone="emerald">
            平台速度优势已经建立，首轮要先整理中频动态品质与储备边界。
          </InfoCard>
        </div>
      ) : null}

      {step.id === 'step-08' ? (
        <div className="mt-4 grid gap-4">
          <InfoCard title="完整题面" tone="cyan">
            已知平台对象速度已建立但阻尼与超调仍紧，判断首轮结构为何更像 PD / 超前，而不是先补 PI。
          </InfoCard>
          <SimpleTable rows={PLATFORM_COMPARE_ROWS} />
          <RevealChain stepId={step.id} revealProgress={revealProgress} />
        </div>
      ) : null}

      {step.id === 'step-09' ? (
        <div className="mt-4 grid gap-4">
          <MediaPanel src={INPUT_FEEDFORWARD_STRUCTURE_SRC} alt="输入前馈与 PD 结构对比" />
          <div className="grid gap-4 lg:grid-cols-3">
            <FormulaCard title="输入前馈结构式" formula={INPUT_FEEDFORWARD_CORE_FORMULA} />
            <FormulaCard title="输入前馈闭环" formula={INPUT_FEEDFORWARD_CLOSED_LOOP_FORMULA} />
            <FormulaCard title="PD 闭环" formula={PD_CLOSED_LOOP_FORMULA} />
          </div>
          {mediaSrc ? <MediaPanel src={mediaSrc} alt={mediaAlt ?? step.title} /> : null}
          <RevealChain stepId={step.id} revealProgress={revealProgress} />
        </div>
      ) : null}

      {step.id === 'step-10' ? (
        <div className="mt-4 grid gap-4">
          <MediaPanel src={DISTURBANCE_FEEDFORWARD_STRUCTURE_SRC} alt="扰动前馈结构对比" />
          <div className="grid gap-4 lg:grid-cols-2">
            <FormulaCard title="扰动到输出传递" formula={DISTURBANCE_FEEDFORWARD_FORMULA} />
            <FormulaCard title="理想扰动补偿" formula={DISTURBANCE_IDEAL_FORMULA} />
          </div>
          {mediaSrc ? <MediaPanel src={mediaSrc} alt={mediaAlt ?? step.title} /> : null}
          <InfoCard title="边界结论" tone="amber">
            扰动前馈负责削弱已知扰动来源；反馈仍负责稳定、鲁棒性和未知误差保底。
          </InfoCard>
        </div>
      ) : null}

      {step.id === 'step-11' ? <div className="mt-4"><StartCardTemplatePanel /></div> : null}

      {step.id === 'step-12' ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <InfoCard title="后测范围" tone="cyan">只检查主矛盾、结构语义、前馈边界和起步卡完整性。</InfoCard>
          <InfoCard title="错因标签" tone="amber">重点观察是否仍把结构名字当答案、是否漏写方向和代价。</InfoCard>
        </div>
      ) : null}

      {step.id === 'step-13' ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            {['先看主矛盾，再说结构名。', '收益句后必须补代价句。', '前馈进入候选，但不能替代反馈。', '4-2 的正式产物是单结构首轮起步卡。'].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">{item}</div>
            ))}
          </div>
          {mediaSrc ? <MediaPanel src={mediaSrc} alt={mediaAlt ?? step.title} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function getDefaultDraft(step: UNIT_4_2StepDefinition, savedResponse?: UNIT_4_2StepResponse) {
  if (savedResponse?.answers) {
    return savedResponse.answers;
  }

  if (step.pageType === 'quiz_group') {
    return Object.fromEntries(PRETEST_QUESTIONS.map((question) => [question.key, '']));
  }
  if (step.pageType === 'quiz_card_grid') {
    return Object.fromEntries(ASSESSMENT_CARD_FIELDS.map((question) => [question.key, '']));
  }
  if (step.pageType === 'multi_select_matrix') {
    return Object.fromEntries(STEP_04_MATRIX.map((item) => [item.key, '']));
  }
  if (step.pageType === 'task_card_workspace') {
    return Object.fromEntries(START_CARD_FIELDS.map((field) => [field.key, '']));
  }

  const textFields = ACTIVITY_CARD_FIELDS[step.id] ?? WORKED_EXAMPLE_FIELDS[step.id] ?? [];
  return Object.fromEntries(textFields.map((field) => [field.key, '']));
}

function getRevealText(step: UNIT_4_2StepDefinition) {
  if (step.pageType === 'quiz_group') {
    return PRETEST_QUESTIONS.map((question) => `${question.prompt}\n- 正确答案：${question.answer}\n- 解释：${question.explanation}`).join('\n\n');
  }
  if (step.pageType === 'quiz_card_grid') {
    return ASSESSMENT_CARD_FIELDS.map((question) => `${question.prompt}\n- 正确答案：${question.answer}\n- 解释：${question.explanation}`).join('\n\n');
  }
  if (step.id === 'step-04') {
    return '低频保持通常先联想到 PI / 滞后；中频动态品质通常先联想到 PD / 超前；前馈首先服务已知输入或扰动通道。';
  }
  if (step.id === 'step-06') {
    return '客船案例用表5对照后，应先写 PI / 滞后为何命中低频主矛盾，再补相位余量与速度代价。';
  }
  if (step.id === 'step-08') {
    return '平台案例应先写 PD / 超前为何命中中频动态品质，再补噪声与高频代价。';
  }
  if (step.id === 'step-09') {
    return '输入前馈先改参考通道；根轨迹近似相似不等于结构等价。';
  }
  if (step.id === 'step-10') {
    return '扰动前馈负责削弱可测扰动来源，反馈继续承担稳定与鲁棒性保底。';
  }
  if (step.id === 'step-11') {
    return '六字段最小起步卡必须同时写清结构理由、参数方向、预期收益与主要代价。';
  }
  return '';
}

export function UNIT_4_2StudentActivityForm({
  step,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  step: UNIT_4_2StepDefinition;
  savedResponse?: UNIT_4_2StepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: UNIT_4_2StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(step, savedResponse));

  useEffect(() => {
    setDraft(getDefaultDraft(step, savedResponse));
  }, [savedResponse, step]);

  if (step.pageType === 'display') {
    return null;
  }

  const submitted = Boolean(savedResponse);
  const locked = !released && !submitted;

  const updateDraft = (key: string, value: string, source = 'student') => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    onWorkspaceParameterChange?.({ key, value, source });
  };

  const submit = () =>
    onSubmit({
      stepId: step.id,
      submittedAt: Date.now(),
      answers: draft,
    });

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        {locked ? '教师尚未释放本页互动，请先阅读上方内容。' : browseEnabled ? '先完成自己的判断，再提交给教师端汇总。' : '教师尚未开放逐步显影浏览，请先完成当前可见任务。'}
      </div>

      {locked ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">当前互动尚未释放。</div>
      ) : (
        <div className="mt-4 grid gap-4">
          {step.pageType === 'quiz_group' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {PRETEST_QUESTIONS.map((question) => (
                <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                  <div className="mt-3">
                    <ChoiceGroup options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'multi_select_matrix' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {STEP_04_MATRIX.map((item) => {
                const selected = new Set((draft[item.key] ?? '').split('|').filter(Boolean));
                return (
                  <div key={item.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                    <div className="premium-lesson-title text-sm font-medium">{item.title}</div>
                    <div className="mt-3 grid gap-2">
                      {item.options.map((option) => {
                        const active = selected.has(option.value);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateDraft(item.key, toggleDelimitedValue(draft[item.key] ?? '', option.value), 'multi-select')}
                            className={`premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-left text-sm ${active ? 'ring-2 ring-cyan-400' : ''}`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {step.pageType === 'activity_card_set' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(ACTIVITY_CARD_FIELDS[step.id] ?? []).map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.title}</div>
                  <div className="mt-3">
                    <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.placeholder} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'worked_example_reveal' ? (
            <>
              <div className="premium-lesson-caption text-xs">当前逐步显影进度：{Math.max(1, revealProgress || 1)}</div>
              <div className="grid gap-4 md:grid-cols-2">
                {(WORKED_EXAMPLE_FIELDS[step.id] ?? []).map((field) => (
                  <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                    <div className="premium-lesson-title text-sm font-medium">{field.title}</div>
                    <div className="mt-3">
                      <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.placeholder} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {step.pageType === 'task_card_workspace' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {START_CARD_FIELDS.map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="mt-3">
                    <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.placeholder} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'quiz_card_grid' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {ASSESSMENT_CARD_FIELDS.map((question) => (
                <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                  <div className="mt-3">
                    <ChoiceGroup options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <button type="button" onClick={submit} className="premium-lesson-action-primary">
            {submitted ? '重新提交本页作答' : '提交本页作答'}
          </button>
        </div>
      )}

      <div className="mt-4">
        <SubmissionStatus submitted={submitted} submittedText="已提交本页作答。" idleText="尚未提交本页作答。" />
      </div>

      {answerVisible && getRevealText(step) ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4">
          <div className="premium-lesson-title text-sm font-semibold">参考提示</div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-7">{getRevealText(step)}</div>
        </div>
      ) : null}
    </section>
  );
}

function summarizeResponses(step: UNIT_4_2StepDefinition, responses: TeacherResponseItem[]) {
  const counts = new Map<string, number>();

  responses.forEach(({ response }) => {
    Object.values(response.answers).forEach((value) => {
      const normalized = value.trim();
      if (!normalized) return;
      normalized.split('|').filter(Boolean).forEach((item) => {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      });
    });
  });

  if (!counts.size) {
    return step.pageType === 'display' ? [] : [['已提交人数', responses.length]];
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
}

export function UNIT_4_2TeacherActivitySummary({
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
  step: UNIT_4_2StepDefinition;
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
  if (step.pageType === 'display') {
    return null;
  }

  const pageContract = getUNIT_4_2PageContract(step.id);
  const summary = summarizeResponses(step, responses);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-medium">教师汇总</div>
          <div className="premium-lesson-muted mt-1 text-sm">当前收到 {responses.length} 份本页作答。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {pageContract.teacherControls.releaseActivity !== 'not_applicable' ? (
            <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
              {released ? '撤回互动' : '释放互动'}
            </button>
          ) : null}
          {pageContract.teacherControls.openBrowse !== 'not_applicable' ? (
            <button type="button" onClick={onToggleBrowse} className="premium-lesson-action-secondary">
              {browseEnabled ? '关闭浏览' : '开放浏览'}
            </button>
          ) : null}
          <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-primary">
            {answerVisible ? '隐藏参考提示' : '显示参考提示'}
          </button>
          {step.pageType === 'worked_example_reveal' ? (
            <>
              <button type="button" onClick={onAdvanceReveal} className="premium-lesson-action-secondary">
                推进显影
              </button>
              <button type="button" onClick={onResetReveal} className="premium-lesson-action-secondary">
                重置显影
              </button>
            </>
          ) : null}
        </div>
      </div>

      {step.pageType === 'worked_example_reveal' ? (
        <div className="premium-lesson-caption mt-3 text-xs">当前逐步显影进度：{Math.max(1, revealProgress || 1)}</div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {summary.length ? (
          summary.slice(0, 12).map(([label, value]) => (
            <div key={`${label}-${value}`} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm">
              <span>{label}</span>
              <span className="premium-lesson-caption">{typeof value === 'number' ? `${value} 次` : value}</span>
            </div>
          ))
        ) : (
          <div className="premium-lesson-muted text-sm">本页暂无学生提交。</div>
        )}
      </div>
    </section>
  );
}

export function UNIT_4_2StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_4_2StepResponse>;
}) {
  const completed = Object.keys(responses).length;

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-lg font-semibold">学习收束</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已经提交了 {completed} 个环节。4-2 结束时应当把“先看主矛盾，再选结构，再补方向、收益和代价”的判断链固定下来。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {['结构名字不是答案。', '收益句后必须补代价句。', '前馈进入候选，但不替代反馈。', '4-3 才进入复合结构骨架。'].map((item) => (
          <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">{item}</div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_4_2StepAiAssistant({
  step: _step,
  onAiEvent: _onAiEvent,
}: {
  step: UNIT_4_2StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  return null;
}
