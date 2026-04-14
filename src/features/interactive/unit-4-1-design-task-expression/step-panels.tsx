'use client';

import Image from 'next/image';
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { BlockMath, InlineMath } from 'react-katex';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveConfig } from '@/features/interactive/types';
import {
  getUnit41FallbackResult,
} from '@/resources/control-system/analysis/unit-4-1-fixtures';
import { buildUnit41AnalysisRequest } from '@/resources/control-system/analysis/unit-4-1-request-builder';
import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';
import {
  UNIT_4_1_COURSE_TITLE,
  type UNIT_4_1StepDefinition,
  type UNIT_4_1StepResponse,
} from '@/lib/unit-4-1-course';
import {
  BINARY_CHOICE_PROMPTS,
  CARD_SORT_FIELDS,
  PARAMETER_SLIDER_FIELDS,
  POSTTEST_QUESTIONS,
  PRETEST_QUESTIONS,
  TASK_CARD_CASE_OPTIONS,
  TASK_CARD_EVIDENCE_BANK,
  TASK_CARD_FIELDS,
  TASK_CARD_PRIORITY_OPTIONS,
  TRIPLE_MATCH_FIELDS,
  type WorkspaceParameterChange,
} from './workspace';

type Tone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

interface StepSection {
  title: string;
  tone?: Tone;
  body?: string;
  bullets?: string[];
  markdown?: string;
}

interface StepBlueprint {
  kicker: string;
  intro: string;
  sections: StepSection[];
  note?: string;
  prompts?: string[];
}

interface ChoiceOption {
  value: string;
  label: string;
}

export interface UNIT_4_1TeacherResponseItem {
  studentName: string;
  response: UNIT_4_1StepResponse;
}

const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: ReactNode }) => <p className="mt-2 text-sm leading-7">{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => <ul className="mt-3 grid gap-2 text-sm leading-7">{children}</ul>,
  li: ({ children }: { children?: ReactNode }) => <li className="ml-4 list-disc">{children}</li>,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-background/55">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => <thead className="bg-background/70">{children}</thead>,
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-border/60 px-3 py-2 font-medium text-foreground/80">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-border/40 px-3 py-2 align-top text-foreground/85">{children}</td>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded bg-background/80 px-1.5 py-0.5 text-[0.9em]">{children}</code>
  ),
};

const STEP_BLUEPRINTS: Record<string, StepBlueprint> = {
  'step-01': {
    kicker: 'Module 4 Map',
    intro: '4-1 是模块 4 的入口页。模块 3 带来的稳定、动态、稳态证据到了这里，必须先改写成“目标—约束—优先级—证据来源”的任务语言，后面两课才有输入可接。',
    sections: [
      {
        title: '本课主问题',
        tone: 'cyan',
        bullets: [
          '系统已经稳定，为什么还不能直接谈方法？',
          '同一组分析证据，为什么会因为场景不同而写出不同任务排序？',
        ],
      },
      {
        title: '本课边界',
        tone: 'amber',
        bullets: ['本课不做控制结构选择。', '本课不做参数整定。', '本课不做自动求优。'],
      },
    ],
    prompts: [
      '为什么稳定分析已经完成，4-1 还必须单独写任务表达卡？',
      '3-9 的综合映射结果进入 4-1 之后，最关键的翻译动作是什么？',
    ],
  },
  'step-02': {
    kicker: 'Goals And Boundary',
    intro: '4-1 的固定产出只有四件事：会重组指标、会分角色、会讲分层、会写任务卡。课程边界必须和 4-2/4-3 划清，否则学生很容易在这里提前越级。',
    sections: [
      {
        title: '四项目标',
        tone: 'emerald',
        bullets: ['会重组指标。', '会分角色。', '会讲分层。', '会写任务表达卡。'],
      },
      {
        title: '负责 / 不负责',
        tone: 'slate',
        markdown:
          '| 本课负责 | 本课不负责 |\n| --- | --- |\n| 任务语言、优先级、可行域表达、案例联读 | 控制结构选择、参数整定、最优搜索 |',
      },
    ],
    prompts: [
      '为什么 4-1 必须先停在任务表达，而不是直接进入结构筛选？',
      '4-1 的四个固定学习目标分别对应什么动作？',
    ],
  },
  'step-03': {
    kicker: 'Pre-Assessment',
    intro: '前测只负责暴露误区，不负责拉开成绩差距。这里最常见的三个偏差是：把稳定等同于完成、把带宽等同于无条件更好、把“全部都重要”误当成任务完整。',
    sections: [
      {
        title: '常见误区',
        tone: 'rose',
        bullets: ['稳定不是任务完成。', '更大带宽未必无条件更好。', '没有排序的任务卡不合格。'],
      },
      {
        title: '教师观察点',
        tone: 'violet',
        bullets: ['优先看错因分布。', '区分首答与重提。'],
      },
    ],
    prompts: [
      '为什么“稳定就够了”会让后续设计直接失去任务边界？',
      '为什么“所有指标都重要”反而说明任务还没写清？',
    ],
  },
  'step-04': {
    kicker: 'Case A',
    intro: '客船航向控制的任务语言强调“平顺与储备优先，再谈提速”。对象框图、根轨迹、幅频和相频信息必须同页并读，不能只盯其中一张图。',
    sections: [
      {
        title: '入口边界',
        tone: 'amber',
        bullets: ['超调量 Mp <= 15%', '调节时间 ts <= 45 s'],
      },
      {
        title: '三条任务判断',
        tone: 'cyan',
        bullets: ['当前系统稳定，但过程偏冲、偏拖。', '设计点还未进入当前任务可接受区域。', '客船场景先保平顺与储备，再谈提速。'],
      },
    ],
    note: '对象框图与四联图必须同页可见，分析区只允许写“矛盾 / 边界 / 证据”，不允许直接跳到控制器名。',
    prompts: [
      '为什么客船案例里，“更快一些”不能排在平顺和储备之前？',
      '哪些图上证据共同支持了“先守边界，再谈提速”的判断？',
    ],
  },
  'step-05': {
    kicker: 'Case B',
    intro: '稳定平台案例会把速度和带宽排得更前，但这不代表储备边界失效。它只是说明当前主任务重排了，证据语言和边界意识并没有消失。',
    sections: [
      {
        title: '三条任务判断',
        tone: 'cyan',
        bullets: ['当前工作点速度优势明显。', '超调与储备仍未整理到位。', '平台场景先保速度优势，再把超调与储备整理到位。'],
      },
      {
        title: '特殊布局说明',
        tone: 'amber',
        body: '案例 B 保留双根轨迹和右上双窄图，是为了把快速极点信息和储备代价同时保留下来。',
      },
    ],
    prompts: [
      '为什么平台案例会把速度和带宽排得更前？',
      '为什么速度前移不代表储备边界已经可以不看？',
    ],
  },
  'step-06': {
    kicker: 'Contrast Summary',
    intro: '双案例对照不是为了证明“哪一个更正确”，而是为了压实一句话：语言相同，排序不同。主矛盾不同，任务优先级就会重排。',
    sections: [
      {
        title: '对照矩阵',
        tone: 'slate',
        bullets: ['时域暴露的主要矛盾。', '根轨迹首先提示的问题。', '幅频首先提示的问题。', '相频/裕度首先提示的问题。'],
      },
      {
        title: '核心判断',
        tone: 'emerald',
        body: '变的是任务优先级，不是基础语言；同一套证据在不同场景里会读出不同排序。',
      },
    ],
    prompts: [
      '为什么同样的四联图语言，在两个案例里会读出不同排序？',
      '排序重排时，什么东西没有变？',
    ],
  },
  'step-07': {
    kicker: 'Role Matching',
    intro: '指标名称本身不等于任务角色。先问问题属于哪一类，再看最合适的指标。时域更偏过程接受度，频域更偏储备边界，积分误差更偏累计代价。',
    sections: [
      {
        title: '三类问题',
        tone: 'cyan',
        bullets: ['过程是否可接受。', '离风险边界还有多远。', '全过程累计代价有多大。'],
      },
      {
        title: '积分误差类指标',
        tone: 'violet',
        markdown:
          '$$J_{\\mathrm{ISE}}=\\int_{0}^{\\infty} e^2(t)\\,\\mathrm{d}t,\\qquad J_{\\mathrm{IAE}}=\\int_{0}^{\\infty} |e(t)|\\,\\mathrm{d}t,\\qquad J_{\\mathrm{ITAE}}=\\int_{0}^{\\infty} t|e(t)|\\,\\mathrm{d}t$$',
      },
    ],
    prompts: [
      '为什么相角裕度更适合回答“离风险边界还有多远”，而不是直接回答“过程是否舒服”？',
      '为什么不能把积分误差直接改写成“硬约束”用语？',
    ],
  },
  'step-08': {
    kicker: 'Task Roles',
    intro: '进入设计任务时，指标会变成三种角色：硬约束、软目标、观察指标。角色由任务决定，而不是由名词决定；同一个指标在不同场景里可能承担不同角色。',
    sections: [
      {
        title: '三种角色',
        tone: 'emerald',
        bullets: ['硬约束：不能破。', '软目标：守住底线后继续争取。', '观察指标：用来解释方案后果。'],
      },
      {
        title: '判断提醒',
        tone: 'amber',
        body: '遇到一个指标时，先问“它是不是不能破的底线”，再问“它是不是当前继续争取的方向”。',
      },
    ],
    prompts: [
      '为什么“超调量”在客船里更像硬约束，而“带宽”在平台里更像靠前的软目标？',
      '面对一个指标时，先分角色而不是先背定义，有什么好处？',
    ],
  },
  'step-09': {
    kicker: 'Task Card Workspace',
    intro: '任务表达卡不是总结作文，而是给 4-2/4-3 的输入卡。对象、目标、硬约束、软目标、观察指标、证据来源都要落地，优先级也必须写清楚。',
    sections: [
      {
        title: '七字段',
        tone: 'emerald',
        bullets: ['对象', '控制目标', '最紧矛盾', '硬约束', '软目标', '观察指标', '证据来源'],
      },
      {
        title: '五步判断清单',
        tone: 'amber',
        bullets: [
          '先问最不能接受的后果。',
          '再问先落在哪些指标。',
          '再问当前是否进入可行域。',
          '再问继续改善会先碰到什么代价。',
          '最后才写排序。',
        ],
      },
    ],
    note: '模板卡和证据区必须同屏；缺少优先级或证据来源时，提交后必须能看见缺项提示。',
    prompts: [
      '为什么一张任务表达卡如果没写优先级和证据来源，就不能作为 4-2/4-3 的输入？',
      '从图上证据改写成任务语言时，最容易漏掉哪两个字段？',
    ],
  },
  'step-10': {
    kicker: 'Layered Regions',
    intro: '稳定域、可行域、满意域、最优域不是一句话。4-1 的职责是先把“能做”和“已经可接受”写清楚，而不是在入口页里直接宣布最优。',
    sections: [
      {
        title: '分层关系',
        tone: 'violet',
        markdown: '$$\\mathcal{O}\\subseteq\\mathcal{S}\\subseteq\\mathcal{F}$$',
      },
      {
        title: '当前口径',
        tone: 'amber',
        bullets: ['可行域：先排除不能做。', '满意域：当前已经可接受。', '最优域：后续再比较。'],
      },
    ],
    prompts: [
      '为什么 4-1 只能先写到可行域和满意域，而不能直接宣布“最优”？',
      '稳定域和任务可接受域之间，最容易被忽略的差别是什么？',
    ],
  },
  'step-11': {
    kicker: 'Misconception Check',
    intro: '进入 4-2 前必须把三类高频误判清掉：稳定等于完成、所有指标同等重要、单看一张图就能写结论。它们都会直接破坏任务表达卡。',
    sections: [
      {
        title: '三类误判',
        tone: 'rose',
        bullets: ['稳定 = 任务完成', '所有指标同等重要', '单看一张图就能写结论'],
      },
      {
        title: '出口要求',
        tone: 'amber',
        body: '进入 4-2 前，至少要能把“证据、约束、优先级”三件事同时带出去。',
      },
    ],
    prompts: [
      '为什么单图线索不能直接替代完整任务结论？',
      '为什么把“稳定”误当成“完成”会让 4-2 的结构筛选起点直接跑偏？',
    ],
  },
  'step-12': {
    kicker: 'Post-Assessment',
    intro: '4-1 的收束不是“我会选控制器了”，而是“我能先把任务写清楚”。下一步 4-2 接结构筛选，4-3 接初始方案方向。',
    sections: [
      {
        title: '三句带走',
        tone: 'cyan',
        bullets: ['稳定只是起点，不是终点。', '变的是任务排序，不是基础语言。', '四联图联读的出口是任务表达卡。'],
      },
      {
        title: '后续去向',
        tone: 'emerald',
        bullets: ['4-2：根据任务排序筛结构。', '4-3：根据任务卡写初始方案方向。'],
      },
    ],
    prompts: [
      '4-1 结束时，最应该带走的三句判断是什么？',
      '为什么 4-2 和 4-3 都必须先吃到 4-1 写出来的任务卡？',
    ],
  },
};

const EXTRA_MEDIA_BY_STEP: Partial<Record<string, Array<{ src: string; alt: string }>>> = {
  'step-04': [{ src: '/course-runtime/lessons/4-1/media/4-1-ship-heading-block.png', alt: '客船航向控制对象框图' }],
  'step-05': [{ src: '/course-runtime/lessons/4-1/media/4-1-platform-pitch-block.png', alt: '稳定平台对象框图' }],
};

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function getStepBlueprint(step: UNIT_4_1StepDefinition) {
  return STEP_BLUEPRINTS[step.id] ?? STEP_BLUEPRINTS['step-01'];
}

function getAiPrompts(step: UNIT_4_1StepDefinition) {
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_4_1StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit41:${step.id}`,
    registryId: 'unit41-inline-ai',
    title: `${step.title} · 页内 AI 助手`,
    description: '当前课程页的就地 AI 对照助手',
    aiHints: `围绕 ${step.title} 进行讲解，只回答当前页面问题。`,
    config: {
      ai: {
        enabled: true,
        persona: 'tutor',
      },
      layout: {
        showAIPanel: true,
      },
    },
  };
}

function renderMarkdown(markdown: string) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={MARKDOWN_COMPONENTS}>
      {markdown}
    </ReactMarkdown>
  );
}

function InfoSection({ section }: { section: StepSection }) {
  return (
    <div className={`premium-lesson-tone-block ${getToneClass(section.tone)} h-full`}>
      <div className="premium-lesson-title text-sm font-semibold">{section.title}</div>
      {section.body ? <p className="mt-2 text-sm leading-7">{section.body}</p> : null}
      {section.bullets ? (
        <ul className="mt-3 grid gap-2 text-sm leading-7">
          {section.bullets.map((item) => (
            <li key={item} className="ml-4 list-disc">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {section.markdown ? <div className="mt-2">{renderMarkdown(section.markdown)}</div> : null}
    </div>
  );
}

function MediaPanel({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="premium-lesson-surface-elevated overflow-hidden rounded-3xl">
      <Image src={src} alt={alt} width={1600} height={900} className="h-auto w-full object-cover" unoptimized />
    </div>
  );
}

function FormulaCard({ title, formula, body }: { title: string; formula: string; body?: string }) {
  return (
    <div className="premium-lesson-tone-block premium-tone-violet h-full">
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <div className="mt-3 overflow-x-auto text-sm">
        <BlockMath math={formula} />
      </div>
      {body ? <p className="mt-2 text-sm leading-7">{body}</p> : null}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  multiline = true,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  if (!multiline) {
    return <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="premium-lesson-input w-full" />;
  }

  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="premium-lesson-input min-h-[96px] w-full resize-y"
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
        (() => {
          const showOptionPrefix = /^[A-Z]$/.test(option.value);

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-left text-sm transition ${
                value === option.value ? 'ring-2 ring-cyan-400' : ''
              }`}
            >
              {showOptionPrefix ? <span className="font-medium">{option.value}. </span> : null}
              {option.label}
            </button>
          );
        })()
      ))}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly ChoiceOption[];
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="premium-lesson-select w-full">
      <option value="">请选择</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface CaseParameterConfig {
  key: 'K_h' | 'K_p';
  label: string;
  min: number;
  max: number;
  step: number;
  baseline: number;
  unitLabel: string;
  summaryTitle: string;
  baselineHint: string;
  lowHint: string;
  highHint: string;
  figureNote: string;
  formula: string;
  orderingSummary: string;
}

const CASE_PARAMETER_CONFIG: Record<'step-04' | 'step-05', CaseParameterConfig> = {
  'step-04': {
    key: 'K_h',
    label: '共享增益 K_h',
    min: 1.4,
    max: 3.2,
    step: 0.05,
    baseline: 2.25,
    unitLabel: '',
    summaryTitle: '客船四联图镜像',
    baselineHint: '基线状态下，平顺与储备较为均衡，默认曲线位置与讲义静态图一致。',
    lowHint: '降低增益后，响应更稳妥，但速度与穿越频率会一起回落。',
    highHint: '继续抬高增益会换来更快的趋势，但超调和储备压力会同步上升。',
    figureNote: '图像模块保持 2×2 阅读语义；控件栏默认折叠在图像下方。',
    formula:
      'P_h(s)=\\frac{0.01715}{s(s+0.1)(s+2.14375)},\\qquad L_h(s)=K_hP_h(s)=\\frac{0.0385875}{s(s+0.1)(s+2.14375)}',
    orderingSummary: '顺序固定为：对象框图 -> 开环传函 -> 动态四联图。',
  },
  'step-05': {
    key: 'K_p',
    label: '共享增益 K_p',
    min: 3.2,
    max: 6.8,
    step: 0.1,
    baseline: 5,
    unitLabel: '',
    summaryTitle: '平台综合图镜像',
    baselineHint: '基线状态下，速度优势已经可见，但储备与超调仍需整理。',
    lowHint: '减小增益会缓和代价，但速度优势会一并回落。',
    highHint: '继续抬高增益能进一步推高速度与带宽，但储备代价会更快显现。',
    figureNote: '保留“双根轨迹 + 右上双窄图”的综合布局语义，不压缩成普通单图。',
    formula:
      'P_p(s)=\\frac{2960\\left(\\frac{s}{15}+1\\right)}{s\\left(\\frac{s}{3}+1\\right)\\left[(1.7s+1)(0.005s+1)(0.001s+1)+100\\right]},\\qquad L_p(s)=K_pP_p(s)',
    orderingSummary: '顺序固定为：对象框图 -> 开环传函 -> 综合动态曲线区。',
  },
};

function describeParameterState(stepId: 'step-04' | 'step-05', value: number) {
  const config = CASE_PARAMETER_CONFIG[stepId];
  const delta = value - config.baseline;

  if (delta < -0.2) {
    return {
      headline: '偏保守',
      body: config.lowHint,
      cards:
        stepId === 'step-04'
          ? ['时域：超调趋缓', '根轨迹：离边界更远', '幅频：带宽回落', '相频：储备略放松']
          : ['速度：优势回落', '主根轨迹：更保守', '紧凑 Bode：穿越频率下降', '储备：压力有所减轻'],
    };
  }

  if (delta > 0.2) {
    return {
      headline: '偏激进',
      body: config.highHint,
      cards:
        stepId === 'step-04'
          ? ['时域：提速更明显', '根轨迹：更接近边界', '幅频：带宽上移', '相频：储备被压紧']
          : ['速度：继续前移', '主根轨迹：更靠近边界', '紧凑 Bode：带宽继续上抬', '储备：代价更明显'],
    };
  }

  return {
    headline: '基线状态',
    body: config.baselineHint,
    cards:
      stepId === 'step-04'
        ? ['时域：平顺与速度折中', '根轨迹：位于可接受区入口', '幅频：工作带宽适中', '相频：储备仍需重点关注']
        : ['速度：优势已建立', '主根轨迹：仍需谨慎整理', '紧凑 Bode：工作带宽较高', '储备：不能放松'],
  };
}

function ParameterMirrorPanel({
  stepId,
  onWorkspaceParameterChange,
}: {
  stepId: 'step-04' | 'step-05';
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const config = CASE_PARAMETER_CONFIG[stepId];
  const [value, setValue] = useState(config.baseline);
  const deferredValue = useDeferredValue(value);
  const state = describeParameterState(stepId, value);
  const request = useMemo(
    () =>
      buildUnit41AnalysisRequest(stepId, {
        gain: deferredValue,
        structures: [{ kind: 'gain', enabled: true, params: { k: deferredValue }, label: config.label }],
      }),
    [config.label, deferredValue, stepId],
  );
  const fallbackResult = useMemo(() => getUnit41FallbackResult(stepId), [stepId]);

  return (
    <div className="premium-lesson-surface-elevated mt-4 rounded-3xl px-4 py-4">
      <div className="premium-lesson-title text-sm font-semibold">{config.summaryTitle}</div>
      <div className="premium-lesson-muted mt-2 text-sm">{config.figureNote}</div>
      <div className="premium-lesson-caption mt-2 text-xs">{config.orderingSummary}</div>
      <ControlFigureWorkspace
        request={request}
        fallbackResult={fallbackResult}
        layout={stepId === 'step-04' ? 'quad' : 'platform'}
      />
      <details className="mt-4 rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
          控件栏
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="premium-lesson-title text-sm font-medium">
              <InlineMath math={config.key} /> 共享增益滑块
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
                onWorkspaceParameterChange?.({ key: config.key, value: nextValue, source: 'slider' });
              }}
              className="mt-3 w-full"
            />
            <div className="premium-lesson-caption mt-2 text-xs">
              当前值：<InlineMath math={`${config.key}=${value.toFixed(stepId === 'step-04' ? 2 : 1)}`} />
              {config.unitLabel}
            </div>
          </div>
          <div className="premium-lesson-tone-block premium-tone-cyan text-sm">
            <div className="premium-lesson-title text-sm font-semibold">{state.headline}</div>
            <div className="mt-2">{state.body}</div>
          </div>
        </div>
      </details>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {state.cards.map((item) => (
          <div key={item} className="premium-lesson-tone-block premium-tone-slate text-sm">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleMatrixPanel() {
  return (
    <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
      <div className="premium-lesson-title text-sm font-semibold">指标角色矩阵</div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          {
            title: '过程是否可接受',
            tone: 'premium-tone-cyan',
            lines: ['超调量 Mp', '调节时间 ts', '上升时间 tr'],
          },
          {
            title: '离风险边界还有多远',
            tone: 'premium-tone-amber',
            lines: ['相角裕度 γ', '增益裕度 Kg', '穿越频率 / 带宽'],
          },
          {
            title: '全过程累计付出什么代价',
            tone: 'premium-tone-violet',
            lines: ['ISE', 'IAE', 'ITAE'],
          },
        ].map((column) => (
          <div key={column.title} className={`premium-lesson-tone-block ${column.tone}`}>
            <div className="premium-lesson-title text-sm font-semibold">{column.title}</div>
            <ul className="mt-3 grid gap-2 text-sm">
              {column.lines.map((line) => (
                <li key={line} className="ml-4 list-disc">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskCardTemplatePanel() {
  return (
    <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
      <div className="premium-lesson-title text-sm font-semibold">任务表达卡模板</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          '对象',
          '控制目标',
          '最紧矛盾',
          '硬约束',
          '软目标',
          '观察指标',
          '证据来源',
        ].map((field) => (
          <div key={field} className="premium-lesson-tone-block premium-tone-slate min-h-[84px]">
            <div className="premium-lesson-title text-sm font-medium">{field}</div>
            <div className="premium-lesson-muted mt-3 text-sm">由跨域证据压缩成可以交给后续课次的输入项。</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LayeredRegionPanel() {
  return (
    <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
      <div className="premium-lesson-title text-sm font-semibold">区域分层示意</div>
      <div className="mt-4 rounded-3xl border border-border/60 bg-background/55 p-4">
        <div className="rounded-3xl border border-cyan-300/60 p-5">
          <div className="rounded-2xl border border-emerald-300/60 p-5">
            <div className="rounded-2xl border border-amber-300/60 p-5">
              <div className="premium-lesson-title text-center text-sm font-semibold">最优域 O</div>
              <div className="premium-lesson-muted mt-2 text-center text-sm">后续课程才有资格比较</div>
            </div>
            <div className="premium-lesson-title mt-4 text-center text-sm font-semibold">满意域 S</div>
            <div className="premium-lesson-muted mt-2 text-center text-sm">当前已经可接受，但还不能直接宣称最优</div>
          </div>
          <div className="premium-lesson-title mt-4 text-center text-sm font-semibold">可行域 F</div>
          <div className="premium-lesson-muted mt-2 text-center text-sm">先排除不能做的方案，稳定只是进入这里的最低门槛之一</div>
        </div>
      </div>
    </div>
  );
}

function getDefaultDraft(step: UNIT_4_1StepDefinition, savedResponse?: UNIT_4_1StepResponse) {
  if (savedResponse) {
    return savedResponse.answers;
  }

  switch (step.pageType) {
    case 'binary_choice':
      return { choice: '' };
    case 'quiz_group':
      return step.id === 'step-03' ? { q1: '', q2: '', q3: '' } : { q1: '', q2: '', q3: '', q4: '' };
    case 'parameter_slider':
      return Object.fromEntries(
        PARAMETER_SLIDER_FIELDS[step.id as 'step-04' | 'step-05'].map((field) => [field.key, '']),
      );
    case 'triple_match':
      return Object.fromEntries(TRIPLE_MATCH_FIELDS.map((field) => [field.key, '']));
    case 'card_sort':
      return Object.fromEntries(CARD_SORT_FIELDS[step.id as 'step-06' | 'step-08'].items.map((item) => [item.key, '']));
    case 'task_card_workspace':
      return Object.fromEntries([
        ['caseId', ''],
        ['priority', ''],
        ...TASK_CARD_FIELDS.map((field) => [field.key, '']),
      ]);
    default:
      return {};
  }
}

function supportsAnswerReveal(step: UNIT_4_1StepDefinition) {
  return step.pageType !== 'display';
}

function trimText(value: string, max = 72) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function getDistribution(entries: string[]) {
  const counts = new Map<string, number>();
  for (const item of entries) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function getRevealMarkdown(step: UNIT_4_1StepDefinition) {
  switch (step.id) {
    case 'step-03':
      return PRETEST_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    case 'step-04':
      return '客船案例的入口判断是：**先进入可接受区域，再谈提速；平顺与储备优先，速度后移。**';
    case 'step-05':
      return '平台案例的入口判断是：**速度与带宽可以前移，但储备边界不能放松。**';
    case 'step-06':
      return '双案例对照的关键句是：**语言相同，排序不同；变的是任务优先级，不是基础证据。**';
    case 'step-07':
      return '一条最稳定的记忆链是：**时域看过程可接受，频域看边界储备，积分误差看累计代价。**';
    case 'step-08':
      return '先分角色：**不能破的是硬约束，继续争取的是软目标，用来解释后果的是观察指标。**';
    case 'step-09':
      return '合格任务卡至少补齐：**对象、控制目标、最紧矛盾、硬约束、软目标、观察指标、证据来源和优先级。**';
    case 'step-10':
      return BINARY_CHOICE_PROMPTS['step-10'].explanation;
    case 'step-11':
      return BINARY_CHOICE_PROMPTS['step-11'].explanation;
    case 'step-12':
      return POSTTEST_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    default:
      return '';
  }
}

function summarizeResponses(step: UNIT_4_1StepDefinition, responses: UNIT_4_1TeacherResponseItem[]) {
  switch (step.pageType) {
    case 'binary_choice':
      return getDistribution(responses.map((item) => item.response.answers.choice || '未作答'));
    case 'quiz_group':
      return getDistribution(
        responses.flatMap((item) =>
          Object.entries(item.response.answers)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}:${trimText(value)}`),
        ),
      );
    case 'parameter_slider':
      return responses.map((item) => [item.studentName, trimText(Object.values(item.response.answers).join(' / '))]);
    case 'task_card_workspace':
      return responses.map((item) => {
        const filled = Object.values(item.response.answers).filter(Boolean).length;
        return [item.studentName, `已填写 ${filled} 项 / ${Object.keys(item.response.answers).length}`];
      });
    case 'triple_match':
    case 'card_sort':
      return responses.map((item) => [item.studentName, trimText(Object.values(item.response.answers).join(' / '))]);
    default:
      return [];
  }
}

export function UNIT_4_1KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 4 Map</div>
      <div className="premium-lesson-title mt-2 text-lg font-semibold">3-9 -&gt; 4-1 -&gt; 4-2 -&gt; 4-3</div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ['3-9', '综合映射', '把稳定、动态、稳态证据收成首轮任务判断。'],
          ['4-1', '任务表达', '把目标、约束、优先级和证据来源写清。'],
          ['4-2', '筛结构', '根据任务排序筛选可行结构。'],
          ['4-3', '初始方案', '根据任务卡写出第一轮方案方向。'],
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

export function UNIT_4_1StepContentPanel({
  step,
  mediaSrc,
  onWorkspaceParameterChange,
}: {
  step: UNIT_4_1StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);
  const extraMedia = EXTRA_MEDIA_BY_STEP[step.id] ?? [];

  if (step.id === 'step-04' || step.id === 'step-05') {
    const config = CASE_PARAMETER_CONFIG[step.id];

    return (
      <section className="premium-lesson-panel px-5 py-5">
        <div className="premium-lesson-kicker">{blueprint.kicker}</div>
        <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
        <p className="premium-lesson-muted mt-3 text-sm leading-7 sm:text-base">{blueprint.intro}</p>

        <div className={`mt-4 grid gap-4 ${extraMedia.length ? 'xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]' : ''}`}>
          {extraMedia.length ? <MediaPanel src={extraMedia[0].src} alt={extraMedia[0].alt} /> : null}
          <FormulaCard title="对象与开环传函" formula={config.formula} body={config.orderingSummary} />
        </div>

        <ParameterMirrorPanel stepId={step.id} onWorkspaceParameterChange={onWorkspaceParameterChange} />

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {blueprint.sections.map((section) => (
            <InfoSection key={`${step.id}-${section.title}`} section={section} />
          ))}
        </div>

        {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
      </section>
    );
  }

  return (
    <section className="premium-lesson-panel px-5 py-5">
      <div className="premium-lesson-kicker">{blueprint.kicker}</div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm leading-7 sm:text-base">{blueprint.intro}</p>

      {mediaSrc && !extraMedia.length ? (
        <div className="mt-4">
          <MediaPanel src={mediaSrc} alt={step.title} />
        </div>
      ) : null}

      {extraMedia.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {extraMedia.map((item) => (
            <MediaPanel key={item.src} src={item.src} alt={item.alt} />
          ))}
        </div>
      ) : null}

      {step.id === 'step-07' ? (
        <div className="mt-4">
          <RoleMatrixPanel />
        </div>
      ) : null}

      {step.id === 'step-09' ? (
        <div className="mt-4">
          <TaskCardTemplatePanel />
        </div>
      ) : null}

      {step.id === 'step-10' ? (
        <div className="mt-4">
          <LayeredRegionPanel />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {blueprint.sections.map((section) => (
          <InfoSection key={`${step.id}-${section.title}`} section={section} />
        ))}
      </div>

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

export function UNIT_4_1StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  step: UNIT_4_1StepDefinition;
  savedResponse?: UNIT_4_1StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_4_1StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(step, savedResponse));

  useEffect(() => {
    setDraft(getDefaultDraft(step, savedResponse));
  }, [savedResponse, step]);

  const submitted = Boolean(savedResponse);
  const locked = !released && !submitted && step.pageType !== 'display';
  const revealMarkdown = getRevealMarkdown(step);

  const updateDraft = (key: string, value: string, source = 'student') => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    onWorkspaceParameterChange?.({ key, value, source });
  };

  const submit = (answers: Record<string, string> = draft) => {
    onSubmit({
      stepId: step.id,
      submittedAt: Date.now(),
      answers,
    });
  };

  if (step.pageType === 'display') {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">本页无需提交</div>
        <SubmissionStatus submitted={false} idleText="本页以阅读、观察和教师推进为主，不需要学生提交作答。" />
      </section>
    );
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
      <p className="premium-lesson-muted mt-2 text-sm">{locked ? '教师尚未释放本页互动，请先阅读上方静态内容。' : '先完成自己的判断，再提交到教师端汇总。'}</p>

      {locked ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">当前互动尚未释放。</div>
      ) : (
        <div className="mt-4 grid gap-4">
          {step.pageType === 'binary_choice' ? (
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{BINARY_CHOICE_PROMPTS[step.id as 'step-10' | 'step-11'].prompt}</div>
              <div className="mt-3">
                <ChoiceGroup
                  options={BINARY_CHOICE_PROMPTS[step.id as 'step-10' | 'step-11'].options}
                  value={draft.choice ?? ''}
                  onChange={(value) => updateDraft('choice', value)}
                />
              </div>
            </div>
          ) : null}

          {step.pageType === 'quiz_group' ? (
            (step.id === 'step-03' ? PRETEST_QUESTIONS : POSTTEST_QUESTIONS).map((question) => (
              <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                <div className="mt-3">
                  <ChoiceGroup options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} />
                </div>
              </div>
            ))
          ) : null}

          {step.pageType === 'parameter_slider' ? (
            <div className="grid gap-4 md:grid-cols-3">
              {PARAMETER_SLIDER_FIELDS[step.id as 'step-04' | 'step-05'].map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="mt-3">
                    <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.label} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'triple_match' ? (
            <div className="grid gap-4 md:grid-cols-3">
              {TRIPLE_MATCH_FIELDS.map((field) => (
                <label key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">{field.label}</span>
                  <div className="mt-3">
                    <SelectField value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value, 'select')} options={field.options} />
                  </div>
                </label>
              ))}
            </div>
          ) : null}

          {step.pageType === 'card_sort' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {CARD_SORT_FIELDS[step.id as 'step-06' | 'step-08'].items.map((item) => (
                <label key={item.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">{item.label}</span>
                  <div className="mt-3">
                    <SelectField
                      value={draft[item.key] ?? ''}
                      onChange={(value) => updateDraft(item.key, value, 'select')}
                      options={CARD_SORT_FIELDS[step.id as 'step-06' | 'step-08'].options}
                    />
                  </div>
                </label>
              ))}
            </div>
          ) : null}

          {step.pageType === 'task_card_workspace' ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">选择案例</span>
                  <div className="mt-3">
                    <SelectField value={draft.caseId ?? ''} onChange={(value) => updateDraft('caseId', value, 'select')} options={TASK_CARD_CASE_OPTIONS} />
                  </div>
                </label>
                <label className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">优先级</span>
                  <div className="mt-3">
                    <SelectField value={draft.priority ?? ''} onChange={(value) => updateDraft('priority', value, 'select')} options={TASK_CARD_PRIORITY_OPTIONS} />
                  </div>
                </label>
              </div>

              <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">证据库</div>
                <div className="mt-3 grid gap-2">
                  {TASK_CARD_EVIDENCE_BANK.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => updateDraft('evidenceSource', draft.evidenceSource ? `${draft.evidenceSource}\n${item}` : item, 'preset')}
                      className="premium-lesson-tone-block premium-tone-slate text-left text-sm"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                {TASK_CARD_FIELDS.map((field) => (
                  <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                    <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                    <div className="mt-3">
                      <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.label} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <button type="button" onClick={() => submit()} className="premium-lesson-action-primary">
            {submitted ? '重新提交本页作答' : '提交本页作答'}
          </button>
        </div>
      )}

      <div className="mt-4">
        <SubmissionStatus
          submitted={submitted}
          submittedText="已提交本页作答，教师端将看到你的当前答案。"
          idleText="尚未提交本页作答。"
        />
      </div>

      {answerVisible && revealMarkdown ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4">
          <div className="premium-lesson-title text-sm font-semibold">参考答案</div>
          <div className="mt-2">{renderMarkdown(revealMarkdown)}</div>
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_4_1TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_4_1StepDefinition;
  responses: UNIT_4_1TeacherResponseItem[];
  released: boolean;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const summary = useMemo(() => summarizeResponses(step, responses), [responses, step]);
  const canReveal = supportsAnswerReveal(step);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-medium">教师汇总</div>
          <div className="premium-lesson-muted mt-1 text-sm">当前收到 {responses.length} 份本页作答。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
            {released ? '撤回互动' : '释放互动'}
          </button>
          <button
            type="button"
            onClick={onToggleAnswerVisible}
            disabled={!canReveal}
            className="premium-lesson-action-primary disabled:opacity-40"
          >
            {answerVisible ? '隐藏参考答案' : '显示参考答案'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {summary.length ? (
          summary.slice(0, 12).map(([label, value]) => (
            <div key={`${label}-${value}`} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm">
              <span>{label}</span>
              <span className="premium-lesson-caption">{typeof value === 'number' ? `${value} 人` : value}</span>
            </div>
          ))
        ) : (
          <div className="premium-lesson-muted text-sm">本页暂无学生提交。</div>
        )}
      </div>
    </section>
  );
}

export function UNIT_4_1StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_4_1StepResponse>;
}) {
  const completed = Object.keys(responses).length;
  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-lg font-semibold">学习收束</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已经提交了 {completed} 个环节的作答。本课真正要带走的不是“我现在就会选控制器”，而是先把任务写清楚：目标、约束、优先级和证据来源都要落到卡上。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          '稳定只是起点，不是终点。',
          '语言相同，排序不同；变的是优先级，不是基础证据。',
          '先写任务表达卡，再进入结构筛选和初始方案。',
          '单图线索不能替代完整任务结论。',
        ].map((item) => (
          <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_4_1StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_4_1StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '4-1',
      stepId: step.id,
      prompts,
    },
    onEvent: onAiEvent,
  });

  useEffect(() => {
    if (!copiedPrompt) return undefined;
    const timer = window.setTimeout(() => setCopiedPrompt(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copiedPrompt]);

  if (!prompts.length) {
    return null;
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4" />
        页内 AI 助手
      </div>
      <p className="premium-lesson-muted mt-2 text-sm">先完成自己的判断，再使用下面的提示词与页内 AI 对照。AI 只核对当前步骤的推理链，不替你跳到下一课。</p>

      <div className="mt-4 grid gap-3">
        {prompts.map((prompt) => (
          <div key={prompt} className="premium-lesson-surface-elevated flex flex-wrap items-start justify-between gap-3 px-4 py-4">
            <pre className="whitespace-pre-wrap text-sm leading-7 text-foreground">{prompt}</pre>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(prompt);
                setCopiedPrompt(prompt);
              }}
              className="premium-lesson-action-secondary"
            >
              <Copy className="h-4 w-4" />
              {copiedPrompt === prompt ? '已复制' : '复制提示词'}
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={ai.togglePanel} className="premium-lesson-action-primary mt-4">
        向 AI 核对推理链
      </button>

      <Dialog open={ai.isPanelOpen} onOpenChange={ai.togglePanel}>
        <DialogContent className="max-w-5xl border-border bg-background p-0 text-foreground">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>{UNIT_4_1_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription>当前只围绕 {step.title} 回答问题，帮助你核对“目标 -&gt; 约束 -&gt; 优先级 -&gt; 证据”的推理链。</DialogDescription>
          </DialogHeader>
          <InteractiveAIPanel ai={ai} title={`${step.title} · AI 对照`} position="right" />
        </DialogContent>
      </Dialog>
    </section>
  );
}
