'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import type { EChartsCoreOption } from 'echarts/core';

import {
  createManifestContentModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  renderInteractiveManifestStep,
  type InteractiveModuleRegistry,
  type InteractiveRuntimeModuleManifest,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  getUNIT_3_8ManifestStepFromManifest,
  getUNIT_3_8PageContract,
  type UNIT_3_8StepDefinition,
  type UNIT_3_8StepResponse,
} from '@/lib/unit-3-8-course';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import type { ComplexPoint, ControlAnalysisRequest, ControlAnalysisResult, CurvePoint, StructureSpec } from '@/resources/control-system/analysis/types';
import { ControlChartPanel } from '@/resources/control-system/charts/control-chart-panel';
import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';
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
    intro: '目标切换时，先改哪一段频带。学生先独立判断目标对应的频段，再用三频段分工核对收益与代价。',
    sections: [
      {
        title: '先判断再核对',
        tone: 'amber',
        body: '学生必须先写出目标到频带的判断，再回看低频、中频、高频的分工，不允许跳过频段重判。',
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
    return <input aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="premium-lesson-input w-full" />;
  }
  return (
    <textarea aria-label={placeholder}
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
        <input aria-label={activeControl.label}
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

type Unit38RustVariant = 'gain' | 'lhp-zero' | 'added-pole' | 'rhp-zero';

function convolve(left: number[], right: number[]) {
  const result = Array.from({ length: left.length + right.length - 1 }, () => 0);
  left.forEach((leftValue, leftIndex) => {
    right.forEach((rightValue, rightIndex) => {
      result[leftIndex + rightIndex] += leftValue * rightValue;
    });
  });
  return result;
}

const UNIT38_BASE_DENOMINATOR = [1, 1.6, 0.64];

function normalizeRustVariant(value: unknown): Unit38RustVariant {
  if (value === 'lhp-zero' || value === 'added-pole' || value === 'rhp-zero') return value;
  return 'gain';
}

function buildUnit38RustRequest(input: {
  variant: Unit38RustVariant;
  value: number;
  enabled: boolean;
  baseline: boolean;
}): ControlAnalysisRequest {
  const gain = input.baseline || input.variant !== 'gain' ? 1 : input.value;
  const zeroPosition = Math.max(0.2, input.value);
  const denominator =
    !input.baseline && input.variant === 'added-pole' && input.enabled
      ? convolve(UNIT38_BASE_DENOMINATOR, [1, 0])
      : UNIT38_BASE_DENOMINATOR;
  const numerator =
    !input.baseline && input.variant === 'lhp-zero'
      ? [1 / zeroPosition, 1]
      : !input.baseline && input.variant === 'rhp-zero'
        ? [-1 / zeroPosition, 1]
        : [1];

  return {
    runtimeMode: 'analysis',
    caseId: `unit38-${input.variant}${input.baseline ? '-baseline' : '-variant'}`,
    plant: {
      numerator,
      denominator,
      coefficientOrder: 'descending',
      label: input.baseline ? '基准对象' : '变参数对象',
    },
    structures: [{ kind: 'gain', enabled: true, params: { k: gain }, label: input.baseline ? '基准增益' : '当前增益' }],
    outputs: ['step_response', 'root_locus', 'magnitude', 'phase', 'bode'],
    timeRange: { start: 0, end: 18, samples: 420 },
    frequencyRange: { min: 1e-2, max: 1e2, samples: 320 },
    rootLocus: {
      minGain: 0,
      maxGain: input.variant === 'added-pole' ? 8 : 12,
      samples: 96,
      currentGain: input.variant === 'gain' ? Math.max(0.2, input.value) : 1,
    },
  };
}

function pointsToSeries(points: CurvePoint[]) {
  return points.map((point) => [point.x, point.y]);
}

function complexToSeries(points: ComplexPoint[]) {
  return points.map((point) => [point.re, point.im]);
}

function formatMetric(value: number | null | undefined, suffix = '') {
  return value == null || !Number.isFinite(value) ? '--' : `${value.toFixed(2)}${suffix}`;
}

function buildUnit38TimeCompareOption(baseline: ControlAnalysisResult, variant: ControlAnalysisResult): EChartsCoreOption {
  return {
    animation: false,
    legend: { top: 0 },
    grid: { top: 42, right: 18, bottom: 42, left: 58 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', name: '时间 / s' },
    yAxis: { type: 'value', name: '响应' },
    series: [
      {
        name: '基准',
        type: 'line',
        showSymbol: false,
        data: pointsToSeries(baseline.stepResponse.points),
        lineStyle: { color: '#64748b', width: 2, type: 'dashed' },
      },
      {
        name: '变参数',
        type: 'line',
        showSymbol: false,
        data: pointsToSeries(variant.stepResponse.points),
        lineStyle: { color: '#22d3ee', width: 2.4 },
      },
    ],
  };
}

function buildUnit38BodeCompareOption(baseline: ControlAnalysisResult, variant: ControlAnalysisResult): EChartsCoreOption {
  return {
    animation: false,
    legend: { top: 0 },
    grid: { top: 42, right: 58, bottom: 42, left: 58 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'log', name: 'ω / rad/s' },
    yAxis: [
      { type: 'value', name: '幅值 / dB' },
      { type: 'value', name: '相位 / deg' },
    ],
    series: [
      {
        name: '基准幅频',
        type: 'line',
        showSymbol: false,
        data: pointsToSeries(baseline.magnitude.points),
        lineStyle: { color: '#64748b', width: 1.8, type: 'dashed' },
      },
      {
        name: '变参数幅频',
        type: 'line',
        showSymbol: false,
        data: pointsToSeries(variant.magnitude.points),
        lineStyle: { color: '#22d3ee', width: 2.2 },
      },
      {
        name: '基准相频',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        data: pointsToSeries(baseline.phase.points),
        lineStyle: { color: '#94a3b8', width: 1.6, type: 'dotted' },
      },
      {
        name: '变参数相频',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        data: pointsToSeries(variant.phase.points),
        lineStyle: { color: '#fb7185', width: 2 },
      },
    ],
  };
}

function rootLocusLineSeries(result: ControlAnalysisResult, name: string, color: string, dashed = false) {
  return result.rootLocus.branches.map((branch, index) => ({
    name: `${name}${index + 1}`,
    type: 'line' as const,
    showSymbol: false,
    data: complexToSeries(branch),
    lineStyle: { color, width: dashed ? 1.2 : 1.8, type: dashed ? 'dashed' : 'solid' },
  }));
}

function buildUnit38RootCompareOption(baseline: ControlAnalysisResult, variant: ControlAnalysisResult): EChartsCoreOption {
  return {
    animation: false,
    legend: { show: false },
    grid: { top: 22, right: 18, bottom: 42, left: 58 },
    tooltip: { trigger: 'item' },
    xAxis: { type: 'value', name: 'Re(s)' },
    yAxis: { type: 'value', name: 'Im(s)' },
    series: [
      ...rootLocusLineSeries(baseline, '基准根轨迹', '#64748b', true),
      ...rootLocusLineSeries(variant, '变参数根轨迹', '#22d3ee'),
      {
        name: '当前闭环极点',
        type: 'scatter',
        symbolSize: 9,
        data: complexToSeries(variant.rootLocus.currentPoles),
        itemStyle: { color: '#f97316' },
      },
    ],
  };
}

function Unit38RustControlPanel({
  variant,
  value,
  enabled,
  onValueChange,
  onEnabledChange,
}: {
  variant: Unit38RustVariant;
  value: number;
  enabled: boolean;
  onValueChange: (value: number) => void;
  onEnabledChange: (value: boolean) => void;
}) {
  const config =
    variant === 'gain'
      ? { title: '增益 K', min: 0.6, max: 2.4, step: 0.05, unit: '' }
      : variant === 'lhp-zero'
        ? { title: '左半平面零点位置 z', min: 0.3, max: 3, step: 0.05, unit: '零点位于 -z' }
        : variant === 'rhp-zero'
          ? { title: '右半平面零点位置 z', min: 0.3, max: 3, step: 0.05, unit: '零点位于 +z' }
          : { title: '加入极点', min: 0, max: 1, step: 1, unit: '原点极点' };

  return (
    <div className="premium-lesson-tone-block premium-tone-amber h-full">
      <div className="premium-lesson-title text-sm font-semibold">参数控件</div>
      {variant === 'added-pole' ? (
        <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-background/55 px-4 py-3 text-sm">
          <span>开启加入极点</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            className="h-4 w-4 accent-cyan-500"
          />
        </label>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span>{config.title}</span>
            <span className="premium-lesson-caption">{value.toFixed(2)}</span>
          </div>
          <input aria-label={config.title}
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={value}
            onChange={(event) => onValueChange(Number(event.target.value))}
            className="mt-3 w-full"
          />
          <div className="premium-lesson-muted mt-3 text-xs">{config.unit}</div>
        </>
      )}
      <div className="premium-lesson-muted mt-4 text-xs leading-6">
        左上比较时域响应，右上把幅频和相频放在同一个 Bode 面板中，左下显示变参数对闭环极点轨迹的影响。
      </div>
    </div>
  );
}

function Unit38RustAnalysisPanel({
  module,
}: {
  module: InteractiveRuntimeModuleManifest;
}) {
  const variant = normalizeRustVariant(module.payload.variant);
  const defaultValue = variant === 'gain' ? 1.45 : variant === 'lhp-zero' ? 1.1 : variant === 'rhp-zero' ? 0.8 : 1;
  const [value, setValue] = useState(defaultValue);
  const [enabled, setEnabled] = useState(true);
  const baselineRequest = useMemo(
    () => buildUnit38RustRequest({ variant, value, enabled, baseline: true }),
    [enabled, value, variant],
  );
  const variantRequest = useMemo(
    () => buildUnit38RustRequest({ variant, value, enabled, baseline: false }),
    [enabled, value, variant],
  );
  const baselineState = useControlEngine(baselineRequest);
  const variantState = useControlEngine(variantRequest);
  const baselineResult = baselineState.result;
  const variantResult = variantState.result;

  if (!baselineResult || !variantResult) {
    return <div className="premium-lesson-tone-block premium-tone-rose text-sm">控制分析图暂时不可用。</div>;
  }

  const error = baselineState.error || variantState.error;
  const marginText = `PM ${formatMetric(variantResult.metrics.phaseMarginDeg, '°')} | GM ${formatMetric(variantResult.metrics.gainMarginDb, ' dB')}`;

  return (
    <div className="mt-4 space-y-4">
      {error ? <div className="premium-lesson-tone-block premium-tone-amber text-sm">{error}</div> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <ControlChartPanel
          title="时域曲线：基准 / 变参数"
          meta={`Mp ${formatMetric(variantResult.metrics.overshootPct, '%')} | ts ${formatMetric(variantResult.metrics.settlingTimeSec, ' s')}`}
          option={buildUnit38TimeCompareOption(baselineResult, variantResult)}
        />
        <ControlChartPanel
          title="Bode 图：幅频 / 相频合并"
          meta={marginText}
          option={buildUnit38BodeCompareOption(baselineResult, variantResult)}
        />
        <ControlChartPanel
          title="根轨迹：变参数影响闭环极点"
          meta={`当前极点 ${variantResult.rootLocus.currentPoles.length} 个`}
          option={buildUnit38RootCompareOption(baselineResult, variantResult)}
        />
        <Unit38RustControlPanel
          variant={variant}
          value={value}
          enabled={enabled}
          onValueChange={setValue}
          onEnabledChange={setEnabled}
        />
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
    case 'goal_cards':
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

function createUNIT_3_8ModuleRegistry(input: {
  revealProgress: number;
  allowInlineReveal: boolean;
}): InteractiveModuleRegistry<{ revealProgress: number; allowInlineReveal: boolean }> {
  const sharedRegistry = createManifestContentModuleRegistry({
    revealProgress: input.revealProgress,
    allowInlineReveal: input.allowInlineReveal,
  });

  return {
    ...sharedRegistry,
    'compute.panel': (props) => {
      const legacyKind = typeof props.module.payload.legacyKind === 'string' ? props.module.payload.legacyKind : '';
      const capabilityRef = typeof props.module.payload.capabilityRef === 'string' ? props.module.payload.capabilityRef : '';
      if (legacyKind === 'rust-analysis-panel' || capabilityRef === 'rust-analysis') {
        return <Unit38RustAnalysisPanel module={props.module} />;
      }
      if (legacyKind === 'interactive-figure-panel' || capabilityRef === 'interactive-figure') {
        return sharedRegistry['interactive-figure-panel'](props);
      }
      return sharedRegistry['compute.panel'](props);
    },
  };
}

export function UNIT_3_8StepContentPanel({
  step,
  manifest,
  revealProgress = 0,
  allowInlineReveal = false,
}: {
  step: UNIT_3_8StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  revealProgress?: number;
  allowInlineReveal?: boolean;
}) {
  const stepManifest = getUNIT_3_8ManifestStepFromManifest(manifest, step.id);
  if (!manifest || !stepManifest) {
    return (
      <section className="premium-lesson-panel">
        <div className="premium-lesson-title text-base font-semibold">{step.title}</div>
        <p className="premium-lesson-muted mt-2 text-sm">本页运行时内容正在加载。</p>
      </section>
    );
  }
  const moduleRegistry = createUNIT_3_8ModuleRegistry({
    revealProgress,
    allowInlineReveal,
  });
  return (
    <section className="space-y-4">
      {renderInteractiveManifestStep({
        manifest,
        step: stepManifest,
        moduleRegistry,
        extra: { revealProgress, allowInlineReveal },
      })}
    </section>
  );
}

export function UNIT_3_8StudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled = true,
  answerVisible,
  revealProgress = 0,
  onSubmit,
  readOnly = false,
}: {
  step: UNIT_3_8StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  savedResponse?: UNIT_3_8StepResponse;
  released: boolean;
  browseEnabled?: boolean;
  answerVisible: boolean;
  revealProgress?: number;
  onSubmit: (response: UNIT_3_8StepResponse) => void;
  readOnly?: boolean;
}) {

  void readOnly;
  const stepManifest = getUNIT_3_8ManifestStepFromManifest(manifest, step.id);
  if (!stepManifest) return null;
  return (
    <>
      {renderStudentInteractiveActivity({
        registry: createManifestStudentActivityRegistry<UNIT_3_8StepDefinition>(),
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

export function UNIT_3_8TeacherActivitySummary({
  step,
  manifest,
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
  manifest?: InteractiveRuntimeManifest | null;
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
  const stepManifest = getUNIT_3_8ManifestStepFromManifest(manifest, step.id);
  if (!stepManifest) return null;
  return (
    <>
      {renderTeacherInteractiveActivity({
        registry: createManifestTeacherActivityRegistry<UNIT_3_8StepDefinition>(),
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
