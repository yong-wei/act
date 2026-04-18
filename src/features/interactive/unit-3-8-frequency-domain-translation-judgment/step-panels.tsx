'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, Sparkles } from 'lucide-react';
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
  getUNIT_3_8PageContract,
  UNIT_3_8_COURSE_TITLE,
  type UNIT_3_8StepDefinition,
  type UNIT_3_8StepResponse,
} from '@/lib/unit-3-8-course';
import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';
import type { ControlAnalysisRequest, StructureSpec } from '@/resources/control-system/analysis/types';
import {
  ACTIVITY_CARD_FIELDS,
  BAND_FOCUS_ITEMS,
  CARD_SORT_SCENARIOS,
  CURVE_COMPARE_CONTROLS,
  CURVE_COMPARE_VARIANTS,
  EVIDENCE_MARK_FIELDS,
  GOAL_SWITCH_FIELDS,
  HOTSPOT_FIELDS,
  MATRIX_CHOICE_CARDS,
  POSTTEST_QUESTIONS,
  PRETEST_QUESTIONS,
  REASON_CHAIN_FIELDS,
  REFLECTION_PROMPTS,
  ROW_FOCUS_TOGGLE_ROWS,
  SCHEME_VOTE_OPTIONS,
  STEP_REVEAL_SEGMENTS,
  STABILITY_LABELS,
  STRUCTURED_COMPARE_FIELDS,
  type ChoiceOption,
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

export interface UNIT_3_8TeacherResponseItem {
  studentName: string;
  response: UNIT_3_8StepResponse;
}

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
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
    kicker: 'Module 3 Map',
    intro: '3-8 不是新章，而是把 3-5 的结构变化线和 3-7 的稳态改善线收成统一频域判断语言，再把出口交给 3-9 和 4-1。',
    sections: [
      {
        title: '路径定位',
        tone: 'cyan',
        bullets: ['固定高亮 3-5 -> 3-7 -> 3-8 -> 3-9。', '当前课次负责统一翻译、判稳和工程读回。'],
      },
      {
        title: '边界卡',
        tone: 'amber',
        bullets: ['不重讲模块 2 的作图基础。', '不提前进入模块 4 的完整整定。'],
      },
    ],
    prompts: [
      '为什么 3-8 不是新章，而是把模块 3 前半段知识重新收成统一判断语言？',
      '3-8 和 3-9、4-1 的关系分别是什么？',
    ],
  },
  'step-02': {
    kicker: 'Translation Chain',
    intro: '统一翻译器：结构变化如何接到稳定边界与闭环后果。学生脱离讲稿，也必须能说清“结构变化 -> 频域指纹 -> 稳定边界 -> 闭环后果”这条链。',
    sections: [
      {
        title: '统一翻译链',
        tone: 'violet',
        markdown: '结构变化 $\\rightarrow$ 开环频率特性改写 $\\rightarrow$ 稳定边界变化 $\\rightarrow$ 闭环性能后果',
      },
      {
        title: '三步判断法',
        tone: 'emerald',
        bullets: ['先判断哪一段频带被改写。', '再判断系统离稳定边界更近还是更远。', '最后把频域量读回速度、超调、稳态精度和高频代价。'],
      },
    ],
    prompts: [
      '为什么结构变化最终都要经过“频域指纹 -> 稳定边界变化 -> 闭环后果”这条翻译链？',
      '为什么判断频域问题时要先看频带，再看边界，最后再读回闭环后果？',
    ],
  },
  'step-03': {
    kicker: 'Pre-Assessment',
    intro: '前测页面必须先把四类误判讲清，再进入作答卡，不把错因解释压成教师口头提示。',
    sections: [
      {
        title: '四类误判',
        tone: 'rose',
        bullets: ['只看幅值，不看频带与相位。', 'Nyquist 快判跳过 P。', '截止频率与带宽混读。', '非最小相继续无边界推带宽。'],
      },
      {
        title: '教师观察点',
        tone: 'slate',
        body: '优先看错因分布，再看对错率；允许一次重提。',
      },
    ],
  },
  'step-04': {
    kicker: 'Four Patterns',
    intro: '四类结构变化总表：先看哪一段频带，再谈收益与代价。本页是阅读与聚焦页，不是把总表再次压缩成单选题。',
    sections: [
      {
        title: '阅读口令',
        tone: 'cyan',
        bullets: ['先看频带。', '再看幅值与相位。', '最后看收益与代价。'],
      },
    ],
  },
  'step-05': {
    kicker: 'Curve Compare',
    intro: '曲线互动页：四类结构变化为什么留下不同频域指纹。这里必须是真正可联动的曲线工作区，而不是静态截图加说明。',
    sections: [
      {
        title: '观察任务',
        tone: 'amber',
        bullets: ['先选结构变化类型。', '再读曲线主要改写的频段。', '最后回写典型收益与代价。'],
      },
    ],
  },
  'step-06': {
    kicker: 'Worked Example 1',
    intro: '例题 1：先从哪一段频带开始判断结构变化。题面、显影链和作答卡必须分离，不能只留结果。',
    sections: [
      {
        title: '解题节奏',
        tone: 'violet',
        bullets: ['先看题面与对象。', '再看教师显影链。', '最后提交两张作答卡。'],
      },
    ],
  },
  'step-07': {
    kicker: 'Argument Principle',
    intro: '幅角原理：总转角、`P` 与 `Z` 在说什么。逐步显影只隐藏步骤，不隐藏对象、题面和核心公式。',
    sections: [
      {
        title: '核心公式',
        tone: 'cyan',
        markdown: '$$\\Delta \\arg F(s)=2\\pi(Z-P)$$\n$$Z=P-N$$',
      },
    ],
  },
  'step-08': {
    kicker: 'Why F(s)=1+L(s)',
    intro: '为什么取 `F(s)=1+L(s)`，为什么盯住 `(-1,0)`。推导链必须有“起点公式 -> 中间推导 -> 目标公式 -> 结论解释”的节奏。',
    sections: [
      {
        title: '几何图景',
        tone: 'emerald',
        body: '闭环稳定问题被改写成 Nyquist 曲线怎样对待 (-1,0) 这个点。',
      },
    ],
  },
  'step-09': {
    kicker: 'Nyquist Quick Check',
    intro: '例题 2：第一组 Nyquist 快速判稳题。对象、P、N、Z 与稳定结论必须同屏映射。',
    sections: [
      {
        title: '判稳口径',
        tone: 'amber',
        bullets: ['先数 P。', '再数 N。', '最后算 Z。'],
      },
    ],
  },
  'step-10': {
    kicker: 'Boundary Compare',
    intro: '例题 3：靠近边界与越过边界有什么本质不同。这里要区分风险层级，不是简单排序卡。',
    sections: [
      {
        title: '判断基准',
        tone: 'rose',
        bullets: ['临界附近不等于已经失稳。', '继续推增益可能直接越界。'],
      },
    ],
  },
  'step-11': {
    kicker: 'Bode Judgment',
    intro: 'Bode 判稳：截止频率、相角裕度和增益裕度。Bode 判稳不是另一套规则，而是在对数坐标上读同一临界边界。',
    sections: [
      {
        title: '指标定义',
        tone: 'violet',
        markdown: '$$|L(j\\omega_c)|=1$$\n$$\\gamma = 180^\\circ + \\angle L(j\\omega_c)$$\n$$G_m = 1/|L(j\\omega_\\pi)|$$',
      },
    ],
  },
  'step-12': {
    kicker: 'Bode Example',
    intro: '例题 4：由 Bode 图直接判断系统在边界哪一侧。读图顺序必须先于作答卡，不允许只给图片和选择框。',
    sections: [
      {
        title: '读图顺序',
        tone: 'cyan',
        bullets: ['先找截止频率。', '再看相位余量和增益余量。', '最后决定系统位于边界哪一侧。'],
      },
    ],
  },
  'step-13': {
    kicker: 'Three Bands',
    intro: '三频段分工：精度、速度与代价不能混读。这里是阅读与聚焦页，不需要额外渲染“无需提交”的空壳模块。',
    sections: [
      {
        title: '三频段任务',
        tone: 'emerald',
        bullets: ['低频对应稳态精度。', '中频对应速度与相角裕度。', '高频对应噪声与执行器代价。'],
      },
    ],
  },
  'step-14': {
    kicker: 'Goal Switch',
    intro: '目标切换时，先改哪一段频带。这是本课唯一允许“先独立判断，再用页内 AI 对照”的页面。',
    sections: [
      {
        title: '先人后 AI',
        tone: 'amber',
        body: '学生必须先写出目标到频带的判断，再进入页内 AI 对照，不允许反过来。',
      },
    ],
    prompts: [
      '当控制目标切换时，为什么第一反应应该是重判目标对应的频带，而不是沿用上一题的补偿直觉？',
      '面对新的控制目标，应该如何把目标翻译成优先改写的频段，再读回收益与代价？',
    ],
  },
  'step-15': {
    kicker: 'Heading Control Baseline',
    intro: '航向控制案例：先把基线方案的问题读清楚。不能直接把案例压成“超前最好”的结果卡。',
    sections: [
      {
        title: '读证据',
        tone: 'cyan',
        bullets: ['先看时域现象。', '再看频域证据。', '最后写出基线核心问题。'],
      },
    ],
  },
  'step-16': {
    kicker: 'Heading Control Translation',
    intro: '航向控制案例：把时域指标翻译成频域目标，再看超前校正。这里必须明确“中频定向改写”的理由。',
    sections: [
      {
        title: '翻译链',
        tone: 'violet',
        bullets: ['把时域指标翻译成频域目标。', '比较超前校正对中频的改写。', '把收益与代价一起读回。'],
      },
    ],
  },
  'step-17': {
    kicker: 'Platform Scheme Debate',
    intro: '稳定平台案例：为什么“只改增益”会左右为难。学生必须看见“更稳但更慢”的真实代价。',
    sections: [
      {
        title: '三方案',
        tone: 'rose',
        bullets: ['激进基线。', '仅降增益。', '超前校正。'],
      },
    ],
  },
  'step-18': {
    kicker: 'Platform Compare',
    intro: '稳定平台案例：超前校正怎样兼顾速度和平稳。真正有效的动作是中频定向补角，不是继续低频补偿。',
    sections: [
      {
        title: '比较维度',
        tone: 'emerald',
        bullets: ['速度', '超调', '余量', '高频代价'],
      },
    ],
  },
  'step-19': {
    kicker: 'Posttest',
    intro: '后测：把完整判断链独立走一遍。页面必须把问题、复盘和班级剩余混淆点同时落页。',
    sections: [
      {
        title: '检查重点',
        tone: 'amber',
        bullets: ['顺序是否稳定。', '边界意识是否站稳。', '目标切换后是否会重判频带。'],
      },
    ],
  },
  'step-20': {
    kicker: 'Summary And Exit',
    intro: '总结与去向：`3-9` 和模块 4 从哪里接走本课。这里要把本课收束成一张统一判断地图，而不是只留一句口号。',
    sections: [
      {
        title: '带走四句',
        tone: 'cyan',
        bullets: ['频域是统一翻译器。', 'Nyquist 与 Bode 描述同一边界。', '三频段帮助拆开收益与代价。', '工程判断应先定频带，再看校正。'],
      },
    ],
  },
};

const GALLERY_BY_STEP: Partial<Record<string, Array<{ src: string; alt: string }>>> = {
  'step-02': [
    { src: '/course-runtime/lessons/3-8/media/3-8-gain-effect.png', alt: '增益提升的频域变化' },
    { src: '/course-runtime/lessons/3-8/media/3-8-zero-effect.png', alt: '左半平面零点的频域变化' },
    { src: '/course-runtime/lessons/3-8/media/3-8-pole-effect.png', alt: '极点变化的频域变化' },
    { src: '/course-runtime/lessons/3-8/media/3-8-rhp-zero-effect.png', alt: '右半平面零点的频域变化' },
  ],
  'step-09': [{ src: '/course-runtime/lessons/3-8/media/3-8-nyquist-quickcheck.png', alt: 'Nyquist 快判图组' }],
  'step-10': [{ src: '/course-runtime/lessons/3-8/media/3-8-nyquist-example-check.png', alt: '边界比较图' }],
};

const REVEAL_ANSWER_BY_STEP: Partial<Record<string, string>> = {
  'step-03': '先看频带与相位，再看结论；Nyquist 快判固定顺序是 **P -> N -> Z**；开环读余量、闭环看带宽；非最小相必须先识别边界。',
  'step-05': '四类结构变化的频域指纹分别对应不同主频段，不能只保留“更好/更坏”的一句总结。',
  'step-06': '例题 1 的标准口径是：**先判断主要被改写的频带，再写收益与代价**，不能跳步直接写结果。',
  'step-08': '辅助函数、几何图景和稳定结论必须连成同一条推导链，不能只背 `Z=P-N`。',
  'step-09': '面对 Nyquist 快判题，先数 `P`，再看包围数 `N`，最后算 `Z` 并下结论。',
  'step-10': '靠近边界和已经越界是两种不同风险；排序时优先看边界安全性，不只看增益更大还是更小。',
  'step-11': 'Bode 判稳是在对数坐标上读同一临界边界；截止频率、相角裕度和增益裕度必须一起读。',
  'step-12': 'Bode 图判断边界位置时，先读截止频率，再看相位与增益余量，最后决定修正方向。',
  'step-14': '目标切换后先重判频带，再看 AI 是否帮助修订你的链条；AI 不是起点。',
  'step-15': '航向控制基线问题必须先从时域与频域双证据中读出，不能直接宣布超前校正更优。',
  'step-16': '航向控制案例的关键是把时域指标翻译成频域目标，并说明超前校正主要改写的是中频。',
  'step-17': '“只改增益”会出现更稳但更慢的两难，不能把更大裕量直接等同于更优方案。',
  'step-18': '稳定平台案例中更优的动作是中频定向补角，不是继续堆低频补偿。',
  'step-19': '完整判断链要能独立复现：**先翻译频带，再读边界，最后读回闭环后果并决定校正方向**。',
};

function getStepBlueprint(step: UNIT_3_8StepDefinition) {
  return STEP_BLUEPRINTS[step.id] ?? STEP_BLUEPRINTS['step-01'];
}

function buildInteractiveAiConfig(step: UNIT_3_8StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit38:${step.id}`,
    registryId: 'unit38-inline-ai',
    title: `${step.title} · 页内 AI 助手`,
    description: '当前课程页的就地 AI 对照助手',
    aiHints: `围绕 ${step.title} 回答，只核对当前页的判断链。`,
    config: {
      ai: { enabled: true, persona: 'tutor' },
      layout: { showAIPanel: true },
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

function trimText(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 48 ? `${normalized.slice(0, 48)}…` : normalized;
}

function MediaCard({ src, alt, contain = false }: { src: string; alt: string; contain?: boolean }) {
  return (
    <div className="premium-lesson-surface-elevated overflow-hidden rounded-3xl">
      <Image
        src={src}
        alt={alt}
        width={1600}
        height={900}
        className={`h-auto w-full ${contain ? 'bg-background/60 object-contain' : 'object-cover'}`}
        unoptimized
      />
    </div>
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

function getCurvePlant(variant: string, sliderValue: number) {
  if (variant === 'nmp') {
    return {
      numerator: [-1 / Math.max(sliderValue, 0.2), 1],
      denominator: [1, 1.6, 0.64, 0],
      coefficientOrder: 'descending' as const,
      label: '非最小相示例对象',
    };
  }
  if (variant === 'lhp-zero') {
    return {
      numerator: [1 / Math.max(sliderValue, 0.2), 1],
      denominator: [1, 1.6, 0.64, 0],
      coefficientOrder: 'descending' as const,
      label: '左半平面零点示例对象',
    };
  }
  return {
    numerator: [1],
    denominator: [1, 1.6, 0.64, 0],
    coefficientOrder: 'descending' as const,
    label: '统一对比对象',
  };
}

function getCurveStructures(variant: string, sliderValue: number): StructureSpec[] {
  if (variant === 'gain') {
    return [{ kind: 'gain', enabled: true, params: { k: sliderValue }, label: '增益 K' }];
  }
  if (variant === 'integral-lag') {
    return [{ kind: 'lag', enabled: true, params: { k: 1, t: 1, beta: sliderValue }, label: '低频补偿' }];
  }
  if (variant === 'lhp-zero') {
    return [{ kind: 'lead', enabled: true, params: { k: 1, t: 1 / sliderValue, alpha: 0.2 }, label: '左半平面零点 / 超前' }];
  }
  return [{ kind: 'gain', enabled: true, params: { k: 1 }, label: 'RHP 零点对象对比' }];
}

function buildCurveCompareRequest(variant: string, sliderValue: number): ControlAnalysisRequest {
  return {
    runtimeMode: 'analysis',
    caseId: `unit38-${variant}`,
    plant: getCurvePlant(variant, sliderValue),
    structures: getCurveStructures(variant, sliderValue),
    outputs: ['step_response', 'root_locus', 'magnitude', 'phase', 'nyquist', 'bode'],
    timeRange: { start: 0, end: 20, samples: 480 },
    frequencyRange: { min: 1e-2, max: 1e2, samples: 360 },
    rootLocus: { minGain: 0, maxGain: 12, samples: 96, currentGain: Math.max(0.5, sliderValue) },
  };
}

function CurveComparePanel({
  onWorkspaceParameterChange,
}: {
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [variant, setVariant] = useState<(typeof CURVE_COMPARE_VARIANTS)[number]['key']>('gain');
  const [sliderValue, setSliderValue] = useState<number>(CURVE_COMPARE_CONTROLS.gain.defaultValue);

  useEffect(() => {
    const nextDefault =
      variant === 'gain'
        ? CURVE_COMPARE_CONTROLS.gain.defaultValue
        : variant === 'lhp-zero'
          ? CURVE_COMPARE_CONTROLS.zero.defaultValue
          : variant === 'integral-lag'
            ? CURVE_COMPARE_CONTROLS.lag.defaultValue
            : CURVE_COMPARE_CONTROLS.nmp.defaultValue;
    setSliderValue(nextDefault);
  }, [variant]);

  const activeControl =
    variant === 'gain'
      ? CURVE_COMPARE_CONTROLS.gain
      : variant === 'lhp-zero'
        ? CURVE_COMPARE_CONTROLS.zero
        : variant === 'integral-lag'
          ? CURVE_COMPARE_CONTROLS.lag
          : CURVE_COMPARE_CONTROLS.nmp;

  const request = useMemo(() => buildCurveCompareRequest(variant, sliderValue), [sliderValue, variant]);

  return (
    <div className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">频域曲线联动工作区</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {CURVE_COMPARE_VARIANTS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setVariant(item.key);
              onWorkspaceParameterChange?.({ key: 'variant', value: item.key, source: 'curve_compare_panel' });
            }}
            className={`premium-lesson-tone-pill px-3 py-1 text-xs ${variant === item.key ? 'premium-tone-cyan' : 'premium-tone-slate'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-border/50 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="premium-lesson-title text-sm font-medium">{activeControl.label}</div>
          <div className="premium-lesson-caption text-xs">{sliderValue.toFixed(variant === 'integral-lag' ? 1 : 2)}</div>
        </div>
        <input
          type="range"
          min={activeControl.min}
          max={activeControl.max}
          step={activeControl.step}
          value={sliderValue}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            setSliderValue(nextValue);
            onWorkspaceParameterChange?.({ key: activeControl.key, value: nextValue, source: 'curve_compare_panel' });
          }}
          className="mt-3 w-full"
        />
      </div>

      <ControlFigureWorkspace request={request} layout="platform" />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ROW_FOCUS_TOGGLE_ROWS.map((row) => (
          <div key={row.key} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4 text-sm">
            <div className="premium-lesson-title text-sm font-medium">{row.label}</div>
            <div className="premium-lesson-muted mt-2">优先频带：{row.band}</div>
            <div className="mt-2">收益：{row.benefit}</div>
            <div className="mt-2">代价：{row.cost}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevealTrack({
  title,
  items,
  revealProgress,
}: {
  title: string;
  items: readonly { key: string; label: string }[];
  revealProgress: number;
}) {
  return (
    <div className="premium-lesson-tone-block premium-tone-violet mt-4">
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <div className="mt-3 grid gap-2">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`rounded-2xl border px-3 py-2 text-sm ${index < revealProgress ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-border/50 bg-background/40 text-foreground/60'}`}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function getDefaultDraft(step: UNIT_3_8StepDefinition, savedResponse?: UNIT_3_8StepResponse) {
  if (savedResponse) {
    return savedResponse.answers;
  }

  switch (step.pageType) {
    case 'quiz_group':
      return Object.fromEntries((step.id === 'step-03' ? PRETEST_QUESTIONS : POSTTEST_QUESTIONS).map((item) => [item.key, '']));
    case 'row_focus_toggle':
      return { row: '' };
    case 'curve_compare_panel':
      return { variant: 'gain', band: '', tradeoff: '' };
    case 'activity_cards':
      return Object.fromEntries((ACTIVITY_CARD_FIELDS[step.id as 'step-06' | 'step-12'] ?? []).map((item) => [item.key, '']));
    case 'step_reveal':
      return { summary: '' };
    case 'reason_chain':
      return Object.fromEntries(REASON_CHAIN_FIELDS.map((item) => [item.key, '']));
    case 'matrix_choice_cards':
      return Object.fromEntries(MATRIX_CHOICE_CARDS.map((item) => [item.key, '']));
    case 'card_sort':
      return Object.fromEntries(CARD_SORT_SCENARIOS.map((item) => [item.key, '']));
    case 'hotspot_labeling':
      return Object.fromEntries(HOTSPOT_FIELDS.map((item) => [item.key, '']));
    case 'band_focus_panel':
      return { band: '' };
    case 'goal_cards_plus_ai':
      return Object.fromEntries(GOAL_SWITCH_FIELDS.map((item) => [item.key, '']));
    case 'evidence_mark_cards':
      return Object.fromEntries(EVIDENCE_MARK_FIELDS.map((item) => [item.key, '']));
    case 'structured_compare':
      return Object.fromEntries((STRUCTURED_COMPARE_FIELDS[step.id as 'step-16' | 'step-18'] ?? []).map((item) => [item.key, '']));
    case 'scheme_vote_cards':
      return { selectedScheme: '', selectedTradeoff: '' };
    case 'reflection_card':
      return Object.fromEntries(REFLECTION_PROMPTS.map((item) => [item.key, '']));
    default:
      return {};
  }
}

function supportsAnswerReveal(step: UNIT_3_8StepDefinition) {
  return getUNIT_3_8PageContract(step.id).teacherControls.revealReferenceAnswer !== 'not_applicable';
}

function summarizeResponses(step: UNIT_3_8StepDefinition, responses: UNIT_3_8TeacherResponseItem[]) {
  const counts = new Map<string, number>();
  for (const item of responses) {
    const value = trimText(Object.values(item.response.answers).join(' / ') || '空白作答');
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]).slice(0, 12);
}

export function UNIT_3_8KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Map</div>
      <div className="premium-lesson-title mt-2 text-lg font-semibold">3-5 -&gt; 3-7 -&gt; 3-8 -&gt; 3-9</div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ['3-5', '结构变化怎样改动态', '先看结构变化。'],
          ['3-7', '低频补偿怎样改精度', '再看稳态误差改善。'],
          ['3-8', '统一频域判断语言', '把收益、代价与边界收成同一张地图。'],
          ['3-9', '综合映射与出口实验', '继续把这张地图接到综合判断。'],
        ].map(([label, title, body], index) => (
          <div key={label} className={`premium-lesson-tone-block ${index === 2 ? 'premium-tone-cyan' : 'premium-tone-slate'}`}>
            <div className="premium-lesson-kicker">{label}</div>
            <div className="premium-lesson-title mt-1 text-sm font-semibold">{title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_3_8StepContentPanel({
  step,
  mediaSrc,
  onWorkspaceParameterChange,
  revealProgress = 0,
}: {
  step: UNIT_3_8StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
  revealProgress?: number;
}) {
  const blueprint = getStepBlueprint(step);
  const gallery = GALLERY_BY_STEP[step.id] ?? [];

  return (
    <section className="premium-lesson-panel px-5 py-5">
      <div className="premium-lesson-kicker">{blueprint.kicker}</div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm leading-7 sm:text-base">{blueprint.intro}</p>

      {mediaSrc ? (
        <div className="mt-4">
          <MediaCard src={mediaSrc} alt={step.title} contain={step.id === 'step-11' || step.id === 'step-20'} />
        </div>
      ) : null}

      {gallery.length ? (
        <div className={`mt-4 grid gap-4 ${gallery.length === 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2'}`}>
          {gallery.map((item) => (
            <MediaCard key={item.src} src={item.src} alt={item.alt} contain />
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {blueprint.sections.map((section) => (
          <InfoSection key={`${step.id}-${section.title}`} section={section} />
        ))}
      </div>

      {step.pageType === 'curve_compare_panel' ? <CurveComparePanel onWorkspaceParameterChange={onWorkspaceParameterChange} /> : null}
      {step.pageType === 'step_reveal' ? <RevealTrack title="教师逐步显影" items={STEP_REVEAL_SEGMENTS} revealProgress={revealProgress} /> : null}
      {step.pageType === 'reason_chain' ? <RevealTrack title="推导链显影" items={REASON_CHAIN_FIELDS} revealProgress={revealProgress} /> : null}

      {step.id === 'step-11' ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4">
          <div className="premium-lesson-title text-sm font-semibold">指标表</div>
          <div className="mt-3">{renderMarkdown('| 指标 | 读图位置 |\n| --- | --- |\n| 截止频率 $\\omega_c$ | 幅值穿越 0 dB 处 |\n| 相位穿越频率 $\\omega_\\pi$ | 相位穿越 -180° 处 |\n| 相角裕度 $\\gamma$ | 截止频率处读相位余量 |\n| 增益裕度 $G_m$ | 相位穿越频率处读幅值余量 |')}</div>
        </div>
      ) : null}

      {step.id === 'step-18' ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4">
          <div className="premium-lesson-title text-sm font-semibold">三方案对照</div>
          <div className="mt-3">{renderMarkdown('| 方案 | 速度 | 超调 | 余量 | 高频代价 |\n| --- | --- | --- | --- | --- |\n| 激进基线 | 快 | 偏大 | 紧张 | 易被放大 |\n| 仅降增益 | 慢 | 下降 | 增大 | 速度牺牲明显 |\n| 超前校正 | 更快且更稳 | 更受控 | 更合理 | 代价可控 |')}</div>
        </div>
      ) : null}

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

export function UNIT_3_8StudentActivityForm({
  step,
  savedResponse,
  released,
  browseEnabled = true,
  answerVisible,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_8StepDefinition;
  savedResponse?: UNIT_3_8StepResponse;
  released: boolean;
  browseEnabled?: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_8StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(step, savedResponse));

  useEffect(() => {
    setDraft(getDefaultDraft(step, savedResponse));
  }, [savedResponse, step]);

  const contract = getUNIT_3_8PageContract(step.id);
  const submitted = Boolean(savedResponse);
  const requiresRelease = contract.teacherControls.releaseActivity === 'separate_toggle';
  const requiresBrowse = contract.teacherControls.openBrowse === 'separate_toggle';
  const locked = (requiresRelease && !released && !submitted) || (requiresBrowse && !browseEnabled);
  const revealMarkdown = REVEAL_ANSWER_BY_STEP[step.id];

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

  if (step.pageType === 'none') {
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
      <p className="premium-lesson-muted mt-2 text-sm">
        {locked ? '当前互动尚未开放，请先阅读上方静态内容。' : '先完成自己的判断，再提交到教师端汇总。'}
      </p>

      {locked ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">当前互动尚未开放。</div>
      ) : (
        <div className="mt-4 grid gap-4">
          {step.pageType === 'quiz_group'
            ? (step.id === 'step-03' ? PRETEST_QUESTIONS : POSTTEST_QUESTIONS).map((question) => (
                <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                  <div className="mt-3">
                    <ChoiceGroup options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} />
                  </div>
                </div>
              ))
            : null}

          {step.pageType === 'row_focus_toggle' ? (
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">请选择本轮最该聚焦的一行</div>
              <div className="mt-3">
                <ChoiceGroup
                  options={ROW_FOCUS_TOGGLE_ROWS.map((row, index) => ({ value: row.key, label: `${index + 1}. ${row.label} -> ${row.band}` }))}
                  value={draft.row ?? ''}
                  onChange={(value) => updateDraft('row', value)}
                />
              </div>
            </div>
          ) : null}

          {step.pageType === 'curve_compare_panel' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">变体判断</div>
                <div className="mt-3">
                  <ChoiceGroup
                    options={CURVE_COMPARE_VARIANTS.map((item) => ({ value: item.key, label: item.label }))}
                    value={draft.variant ?? ''}
                    onChange={(value) => updateDraft('variant', value)}
                  />
                </div>
              </div>
              <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">频带与代价</div>
                <div className="mt-3 grid gap-3">
                  <TextInput value={draft.band ?? ''} onChange={(value) => updateDraft('band', value)} placeholder="主要被改写的频带" multiline={false} />
                  <TextInput value={draft.tradeoff ?? ''} onChange={(value) => updateDraft('tradeoff', value)} placeholder="典型收益 / 代价" />
                </div>
              </div>
            </div>
          ) : null}

          {step.pageType === 'activity_cards'
            ? (ACTIVITY_CARD_FIELDS[step.id as 'step-06' | 'step-12'] ?? []).map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="mt-3">
                    <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.label} />
                  </div>
                </div>
              ))
            : null}

          {step.pageType === 'step_reveal' ? (
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">本页关键理解</div>
              <div className="mt-3">
                <TextInput value={draft.summary ?? ''} onChange={(value) => updateDraft('summary', value)} placeholder="用一句话写出总转角、P 与 Z 的关系" />
              </div>
            </div>
          ) : null}

          {step.pageType === 'reason_chain' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {REASON_CHAIN_FIELDS.map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="mt-3">
                    <SelectField
                      value={draft[field.key] ?? ''}
                      onChange={(value) => updateDraft(field.key, value)}
                      options={[
                        { value: '1', label: '第 1 步' },
                        { value: '2', label: '第 2 步' },
                        { value: '3', label: '第 3 步' },
                        { value: '4', label: '第 4 步' },
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'matrix_choice_cards' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {MATRIX_CHOICE_CARDS.map((item) => (
                <div key={item.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{item.label}</div>
                  <div className="mt-3">
                    <SelectField value={draft[item.key] ?? ''} onChange={(value) => updateDraft(item.key, value)} options={STABILITY_LABELS} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'card_sort' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {CARD_SORT_SCENARIOS.map((item) => (
                <div key={item.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{item.label}</div>
                  <div className="mt-3">
                    <TextInput value={draft[item.key] ?? ''} onChange={(value) => updateDraft(item.key, value)} placeholder="写出风险判断" multiline={false} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'hotspot_labeling' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {HOTSPOT_FIELDS.map((item) => (
                <div key={item.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{item.label}</div>
                  <div className="mt-3">
                    <TextInput value={draft[item.key] ?? ''} onChange={(value) => updateDraft(item.key, value)} placeholder={`写出 ${item.label} 的读图位置`} multiline={false} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'band_focus_panel' ? (
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">当前任务最该聚焦的频段</div>
              <div className="mt-3">
                <ChoiceGroup options={BAND_FOCUS_ITEMS.map((item) => ({ value: item.key, label: `${item.label}：${item.role}` }))} value={draft.band ?? ''} onChange={(value) => updateDraft('band', value)} />
              </div>
            </div>
          ) : null}

          {step.pageType === 'goal_cards_plus_ai'
            ? GOAL_SWITCH_FIELDS.map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="mt-3">
                    <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.label} />
                  </div>
                </div>
              ))
            : null}

          {step.pageType === 'evidence_mark_cards'
            ? EVIDENCE_MARK_FIELDS.map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="mt-3">
                    <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.label} />
                  </div>
                </div>
              ))
            : null}

          {step.pageType === 'structured_compare'
            ? (STRUCTURED_COMPARE_FIELDS[step.id as 'step-16' | 'step-18'] ?? []).map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="mt-3">
                    <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.label} />
                  </div>
                </div>
              ))
            : null}

          {step.pageType === 'scheme_vote_cards' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">请选择当前更合理的方案</div>
                <div className="mt-3">
                  <ChoiceGroup options={SCHEME_VOTE_OPTIONS} value={draft.selectedScheme ?? ''} onChange={(value) => updateDraft('selectedScheme', value)} />
                </div>
              </div>
              <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">写出主要代价</div>
                <div className="mt-3">
                  <TextInput value={draft.selectedTradeoff ?? ''} onChange={(value) => updateDraft('selectedTradeoff', value)} placeholder="更稳但更慢、或代价可控等" />
                </div>
              </div>
            </div>
          ) : null}

          {step.pageType === 'reflection_card'
            ? REFLECTION_PROMPTS.map((item) => (
                <div key={item.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{item.label}</div>
                  <div className="mt-3">
                    <TextInput value={draft[item.key] ?? ''} onChange={(value) => updateDraft(item.key, value)} placeholder={item.label} />
                  </div>
                </div>
              ))
            : null}

          <button type="button" onClick={() => submit()} className="premium-lesson-action-primary">
            {submitted ? '重新提交本页作答' : '提交答案'}
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

export function UNIT_3_8TeacherActivitySummary({
  step,
  responses,
  released,
  browseEnabled = true,
  answerVisible,
  revealProgress = 0,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  step: UNIT_3_8StepDefinition;
  responses: UNIT_3_8TeacherResponseItem[];
  released: boolean;
  browseEnabled?: boolean;
  answerVisible: boolean;
  revealProgress?: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const summary = useMemo(() => summarizeResponses(step, responses), [responses, step]);
  const controls = getUNIT_3_8PageContract(step.id).teacherControls;

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-medium">教师汇总</div>
          <div className="premium-lesson-muted mt-1 text-sm">当前收到 {responses.length} 份本页作答。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {controls.releaseActivity === 'separate_toggle' ? (
            <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
              {released ? '撤回互动' : '发放作答'}
            </button>
          ) : null}
          {controls.openBrowse === 'separate_toggle' ? (
            <button type="button" onClick={onToggleBrowse} className="premium-lesson-action-secondary">
              {browseEnabled ? '关闭浏览' : '开放浏览'}
            </button>
          ) : null}
          {controls.teacherStepReveal === 'teacher_only' ? (
            <>
              <button type="button" onClick={onAdvanceReveal} className="premium-lesson-action-secondary">
                教师逐步显影
              </button>
              <button type="button" onClick={onResetReveal} className="premium-lesson-action-secondary">
                重置显影
              </button>
            </>
          ) : null}
          {controls.revealReferenceAnswer === 'separate_toggle' ? (
            <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-primary">
              {answerVisible ? '隐藏参考答案' : '显示参考答案'}
            </button>
          ) : null}
        </div>
      </div>

      {controls.teacherStepReveal === 'teacher_only' ? (
        <div className="premium-lesson-muted mt-3 text-sm">当前显影层级：{revealProgress}</div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {summary.length ? (
          summary.map(([label, value]) => (
            <div key={`${label}-${value}`} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm">
              <span>{label}</span>
              <span className="premium-lesson-caption">{value} 人</span>
            </div>
          ))
        ) : (
          <div className="premium-lesson-muted text-sm">本页暂无学生提交。</div>
        )}
      </div>
    </section>
  );
}

export function UNIT_3_8StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_3_8StepResponse>;
}) {
  const completed = Object.keys(responses).length;
  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-lg font-semibold">学习收束</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已经提交了 {completed} 个环节的作答。本课真正要带走的是一张统一判断地图：先把结构变化翻成频域指纹，再用 Nyquist 或 Bode 读同一临界边界，最后按三频段拆开收益、速度和代价。
      </div>
    </section>
  );
}

export function UNIT_3_8StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_3_8StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getStepBlueprint(step).prompts ?? [];
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '3-8',
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
      <p className="premium-lesson-muted mt-2 text-sm">先完成自己的目标到频带判断，再使用下面的提示词与页内 AI 对照。AI 只核对推理链，不替你跳过第一步。</p>

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
            <DialogTitle>{UNIT_3_8_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription>
              当前只围绕 {step.title} 回答问题，帮助你核对“目标 {'->'} 频带 {'->'} 边界 {'->'} 工程读回”的推理链。
            </DialogDescription>
          </DialogHeader>
          <div className="h-[75vh]">
            <InteractiveAIPanel ai={ai} title={`${step.title} · AI 对照`} position="right" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
