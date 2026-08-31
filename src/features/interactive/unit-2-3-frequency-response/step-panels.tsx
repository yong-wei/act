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
  UNIT_2_3_COURSE_TITLE,
  type UNIT_2_3StepDefinition,
  type UNIT_2_3StepResponse,
} from '@/lib/unit-2-3-course';
import {
  BODE_SORT_BUCKETS,
  BODE_WORKFLOW_STEPS,
  RECONSTRUCTION_PARAMETER_DEFAULTS,
  WORKED_EXAMPLE_SEQUENCE,
  WAVE_MEANING_TABS,
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

interface QuizQuestion {
  key: string;
  prompt: string;
  type?: 'choice' | 'text';
  options?: ChoiceOption[];
  answer?: string;
  explanation: string;
}

export interface UNIT_2_3TeacherResponseItem {
  studentName: string;
  response: UNIT_2_3StepResponse;
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

const PRETEST_QUESTIONS: QuizQuestion[] = [
  {
    key: 'q1',
    prompt: '同一对象面对低频命令与高频扰动时，最合理的判断是什么？',
    options: [
      { value: 'A', label: '两者都会被同样准确地跟随' },
      { value: 'B', label: '系统通常更愿意保留低频命令、压制高频扰动' },
      { value: 'C', label: '高频越高越应该被完整放大' },
    ],
    answer: 'B',
    explanation: '频率响应的入口直觉就是：系统会区分节奏，低频命令更值得保留，高频扰动更应被抑制。',
  },
  {
    key: 'q2',
    prompt: '正弦输入进入稳态后，输出与输入的关系应如何理解？',
    options: [
      { value: 'A', label: '频率、幅值、相位都不变' },
      { value: 'B', label: '频率不变，但幅值和相位可能改变' },
      { value: 'C', label: '频率会变成系统固有频率' },
    ],
    answer: 'B',
    explanation: '同频输出规律说明频率保持不变，系统主要改变幅值大小和相位偏移。',
  },
  {
    key: 'q3',
    prompt: '如果一个系统强烈压制高频分量，复杂波形在时域上通常会怎样？',
    options: [
      { value: 'A', label: '更尖锐、更抖动' },
      { value: 'B', label: '更平滑、更接近低频轮廓' },
      { value: 'C', label: '完全保持原样' },
    ],
    answer: 'B',
    explanation: '高频分量被压低后，重构出来的时域波形会更平滑，尖锐边缘不再明显。',
  },
];

const POSTTEST_QUESTIONS: QuizQuestion[] = [
  {
    key: 'q1',
    prompt: '为什么说正弦输入是频域分析的天然测试信号？',
    options: [
      { value: 'A', label: '因为所有系统都只接受正弦输入' },
      { value: 'B', label: '因为稳态后仍是同频输出，便于分别观察幅值和相位' },
      { value: 'C', label: '因为可以直接跳过传递函数' },
    ],
    answer: 'B',
    explanation: '正弦输入最重要的价值是：进入稳态后输出仍保持同频，便于把系统作用浓缩为幅值变化与相位变化。',
  },
  {
    key: 'q2',
    prompt: '高频分量被明显压制后，输出波形更可能呈现什么特征？',
    options: [
      { value: 'A', label: '更平滑，低频轮廓更突出' },
      { value: 'B', label: '更尖锐，边缘更陡' },
      { value: 'C', label: '完全不受影响' },
    ],
    answer: 'A',
    explanation: '抑制高频分量意味着尖锐变化被削弱，时域输出会更平滑，低频轮廓保留得更明显。',
  },
  {
    key: 'q3',
    type: 'text',
    prompt: 'Bode 首轮骨架手绘的第一步是什么？为什么不能跳过它？',
    explanation: '应先把对象写成标准型，再列转折频率。若不先标准型，就很容易漏掉转折点和斜率变化来源。',
  },
];

const STEP_BLUEPRINTS: Record<string, StepBlueprint> = {
  'step-01': {
    kicker: 'Roadmap',
    intro: '2-2 解决对象在时间里怎样运动，2-3 则继续追问：同一个对象面对不同频率成分时，会保留什么、压制什么，又如何第一次画成频域图形。',
    sections: [
      {
        title: '本课三项关键词',
        tone: 'cyan',
        bullets: ['频率分量：复杂信号可拆成不同节奏', '正弦稳态响应：输出保持同频，只改变幅值与相位', 'Bode 首轮骨架：把频率特性第一次画成图形对象'],
      },
    ],
  },
  'step-02': {
    kicker: 'Scenario',
    intro: '频域分析不是从公式开始，而是从一个工程判断开始：系统不需要追每一次高频抖动，却应该尽量保留真正代表任务意图的低频命令。',
    sections: [
      {
        title: '本页固定结论',
        tone: 'amber',
        bullets: ['系统并非对所有变化一视同仁', '低频命令更应被保留，高频扰动更应被抑制', '频率选择性是进入频域分析的真正入口'],
      },
    ],
  },
  'step-03': {
    kicker: 'Objectives',
    intro: '本课主线固定为：从复杂波形拆出频率分量，再用正弦稳态响应建立 G(jω)，最后把它第一次稳定地画成 Bode 骨架。',
    sections: [
      {
        title: '三项目标',
        tone: 'emerald',
        bullets: ['会拆频率成分', '会读单频响应', '会画 Bode 首轮骨架'],
      },
      {
        title: '主线链',
        tone: 'slate',
        body: '阶跃/方波 -> 频率分量 -> 正弦响应 -> G(jω) -> Bode 骨架',
      },
    ],
  },
  'step-04': {
    kicker: 'Pre-Assessment',
    intro: '前测只问最核心的起点判断：系统会不会区分低频和高频、同频输出到底意味着什么、高频被压制后时域波形会怎样变化。',
    sections: [
      {
        title: '三条误区提示',
        tone: 'amber',
        bullets: ['系统不是对所有频率都一样敏感', '同频不等于同幅', '滤掉高频后波形通常会更平滑'],
      },
    ],
  },
  'step-05': {
    kicker: 'Bridge',
    intro: '时域分析把一条完整曲线放在时间轴上观察，频域分析则把复杂输入拆成按频率逐项观察的规则表。这不是替代，而是观察角度切换。',
    sections: [
      {
        title: '时域 / 频域对照',
        tone: 'slate',
        markdown: `| 观察方式 | 更关注什么 | 典型问题 |\n| --- | --- | --- |\n| 时域分析 | 整体曲线如何展开 | 快不快、冲不冲、多久稳下来 |\n| 频域分析 | 不同节奏如何被处理 | 哪些频率被保留、哪些被抑制 |`,
      },
      {
        title: '过渡句',
        tone: 'cyan',
        body: '时域描述整体，频域揭示规则；正弦输入是最适合把这套规则显露出来的天然测试信号。',
      },
    ],
  },
  'step-06': {
    kicker: 'Reconstruction',
    intro: '频域分析之所以能解释时域现象，是因为复杂信号可以拆成频率分量，系统分别处理后，最终还会叠加回一个新的时域输出。',
    sections: [
      {
        title: '三段主链',
        tone: 'emerald',
        bullets: ['复杂信号可分解为不同频率分量', '系统对每个频率分量分别响应', '各分量叠加后重构为最终时域输出'],
      },
      {
        title: '观察提示',
        tone: 'slate',
        body: '当高频分量被压制时，波形会从尖锐转向平滑，最终更接近低频轮廓。',
      },
    ],
  },
  'step-07': {
    kicker: 'Sine Rule',
    intro: '正弦输入是频域分析的入口，因为进入稳态后，系统不会把频率改成别的东西，而是把作用集中到幅值大小与相位偏移上。',
    sections: [
      {
        title: '公式卡',
        tone: 'slate',
        markdown: `$$\nr(t)=A\\sin(\\omega t)\n$$\n\n$$\nc_{ss}(t)=A|G(j\\omega)|\\sin\\bigl(\\omega t+\\angle G(j\\omega)\\bigr)\n$$`,
      },
      {
        title: '三条结论',
        tone: 'violet',
        bullets: ['频率不变', '幅值改变', '相位改变'],
      },
    ],
  },
  'step-08': {
    kicker: 'Engineering Language',
    intro: '数学量必须翻译成工程语言：幅值变化对应放大或衰减，相位变化对应超前或滞后，而命令与扰动的价值又决定我们希望保留什么、压制什么。',
    sections: [
      {
        title: '物理意义对照',
        tone: 'slate',
        markdown: `| 频域量变化 | 工程语言 | 典型解释 |\n| --- | --- | --- |\n| 幅值变大 / 变小 | 放大 / 衰减 | 低频命令更容易保留，高频扰动更容易被压制 |\n| 相位提前 / 滞后 | 超前 / 滞后 | 输出相对输入在时间轴上前移或后移 |`,
      },
    ],
  },
  'step-09': {
    kicker: 'Definitions',
    intro: '频率特性不是一张孤立的图，而是一张“按频率索引的规则表”。它先给出对象 G(jω)，再拆成幅频和相频两个最常用的观察视角。',
    sections: [
      {
        title: '三条核心定义',
        tone: 'slate',
        markdown: `$$\nG(j\\omega)\n$$\n\n$$\nM(\\omega)=|G(j\\omega)|\n$$\n\n$$\n\\varphi(\\omega)=\\angle G(j\\omega)\n$$`,
      },
      {
        title: '三列表任务',
        tone: 'cyan',
        body: '把“数学对象 / 表示什么 / 最适合回答什么问题”这三件事配起来，才算真正理解频率特性、幅频特性与相频特性的分工。',
      },
    ],
  },
  'step-10': {
    kicker: 'Virtual Axis',
    intro: '写成 G(jω) 不是把拉氏方法丢掉，而是把注意力限制到研究正弦稳态响应最有用的虚轴观察线上。',
    sections: [
      {
        title: '核心提示',
        tone: 'slate',
        markdown: `$$\ns=\\sigma+j\\omega\n$$`,
      },
      {
        title: '解释卡',
        tone: 'amber',
        body: '频域分析不是抛弃 s 域，而是在研究正弦稳态响应时，只沿虚轴读取与频率有关的那部分信息。',
      },
    ],
  },
  'step-11': {
    kicker: 'Why Bode',
    intro: 'Bode 图之所以成为频域对象的第一可视化入口，是因为它同时解决了“频率跨度大、转折点难看清、串联乘法难叠加”这三类阅读问题。',
    sections: [
      {
        title: '幅值换算',
        tone: 'slate',
        markdown: `$$\nL(\\omega)=20\\log_{10}|G(j\\omega)|\n$$`,
      },
      {
        title: '三条理由',
        tone: 'emerald',
        bullets: ['频率范围常跨越多个数量级', '对数坐标更易识别转折频率', '分贝表示让乘法关系转为加法关系'],
      },
    ],
  },
  'step-12': {
    kicker: 'Typical Elements',
    intro: '典型环节的第一层频域直觉，不是精确读数，而是“谁偏低频通过、谁偏高频通过、谁会明显滞后”的首轮判断。',
    sections: [
      {
        title: '一阶惯性环节参考卡',
        tone: 'slate',
        markdown: `$$\nG(s)=\\frac{1}{Ts+1}\n$$\n\n$$\nG(j\\omega)=\\frac{1}{1+j\\omega T}\n$$`,
      },
      {
        title: '三段判断',
        tone: 'amber',
        bullets: ['ωT << 1：低频基本通过', 'ωT ≈ 1：转折附近开始明显衰减与滞后', 'ωT >> 1：高频显著被抑制'],
      },
    ],
  },
  'step-13': {
    kicker: 'Sketch Workflow',
    intro: '首轮 Bode 骨架只做四件事：写标准型、列转折点、判最低频段、依次画趋势。它的价值是把频率特性第一次稳定地变成图形对象。',
    sections: [
      {
        title: '四步流程卡',
        tone: 'violet',
        bullets: BODE_WORKFLOW_STEPS.map((item, index) => `${index + 1}. ${item}`),
      },
      {
        title: '边界提醒',
        tone: 'amber',
        body: '本页只做首轮渐近骨架，不追求精细修正，也不扩展到复杂组合对象。',
      },
    ],
  },
  'step-14': {
    kicker: 'Worked Example',
    intro: '单一正弦输入例题要严格按链条推进：识别频率、计算 G(jω)、求模与相位、写出稳态输出。结果卡必须同时交代频率、幅值和相位三层结论。',
    sections: [
      {
        title: '题面卡',
        tone: 'slate',
        markdown: `$$\nG(s)=\\frac{1}{0.5s+1}\n$$\n\n$$\nr(t)=2\\sin(4t)\n$$`,
      },
      {
        title: '最终表达式',
        tone: 'emerald',
        markdown: `$$\nc_{ss}(t)=0.894\\sin(4t-63.4^\\circ)\n$$`,
      },
      {
        title: '结果解释',
        tone: 'cyan',
        bullets: ['频率未变', '振幅缩小', '相位滞后'],
      },
    ],
  },
  'step-15': {
    kicker: 'Multi-Tone',
    intro: '多频输入把“单频规则”升级成“分量独立处理 -> 输出重构”的完整链条。先自己判断两条分量如何被处理，再用 AI 只核对推理链，不代写结论。',
    sections: [
      {
        title: '题面卡',
        tone: 'slate',
        markdown: `$$\nG(s)=\\frac{1}{s+1}\n$$\n\n$$\nr(t)=\\sin(0.2t)+0.5\\sin(5t)\n$$`,
      },
      {
        title: '方法链',
        tone: 'emerald',
        bullets: ['分量独立处理', '输出重构', '低频保留更明显'],
      },
      {
        title: '固定结论',
        tone: 'cyan',
        body: '低频分量在输出中保留得更充分，高频分量被明显压低，因此输出更接近平滑低频波形。',
      },
      {
        title: 'AI 边界',
        tone: 'amber',
        body: 'AI 只检查分量处理顺序、重构逻辑和解释链，不直接代写最后结论。',
      },
    ],
    prompts: [
      '我已经先判断：低频分量保留得更充分，高频分量被明显压低。请你不要直接给最终答案，只检查我的“分量独立处理 -> 输出重构”推理链哪里还不严谨。',
      '请围绕 2-3 的频率响应基础内容，只核对我对 G(s)=1/(s+1) 在 0.2 rad/s 与 5 rad/s 两个频率点上的判断思路，不要替我跳过中间分析。',
    ],
  },
  'step-16': {
    kicker: 'Post-Assessment',
    intro: '后测检验的不是死记定义，而是你能否把“会说”推进到“会画”：既能解释对象对什么频率更敏感，也能说出首轮骨架从哪里开始画。',
    sections: [
      {
        title: '提示卡',
        tone: 'amber',
        body: '既要会说出对象对什么频率更敏感，也要会把这种敏感性画成首轮骨架。',
      },
    ],
  },
  'step-17': {
    kicker: 'Takeaways',
    intro: '本课的价值不在于把所有频域结论一次讲完，而在于先建立一套稳定可复用的对象语言，让后续的 Nyquist 与频域指标建立在同一条主线上。',
    sections: [
      {
        title: '五条结论',
        tone: 'emerald',
        bullets: [
          '频域分析研究系统如何处理不同频率成分',
          '正弦输入稳态后仍是同频输出',
          'G(jω) 把传递函数对象翻译成频域对象',
          'Bode 图是频率特性第一次稳定可见的入口',
          '下一课将推进到 Nyquist 与频域指标，而不是重讲本节',
        ],
      },
      {
        title: '后续去向',
        tone: 'cyan',
        bullets: ['2-4：Nyquist 与频域指标', '3-5：三域联动与设计约束', '3-8：频域判稳与综合语言'],
      },
    ],
  },
};

const CARD_SORT_ITEMS = [
  { key: 'proportional', label: '比例环节', answer: 'low-pass' },
  { key: 'integrator', label: '积分环节', answer: 'low-pass' },
  { key: 'differentiator', label: '微分环节', answer: 'high-pass' },
  { key: 'inertia', label: '惯性环节', answer: 'lagging' },
  { key: 'oscillation', label: '振荡环节', answer: 'lagging' },
] as const;

function getStepBlueprint(step: UNIT_2_3StepDefinition) {
  return (
    STEP_BLUEPRINTS[step.id] ?? {
      kicker: 'Lesson',
      intro: step.hint,
      sections: [],
    }
  );
}

function getAiPrompts(step: UNIT_2_3StepDefinition) {
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_2_3StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit23:${step.id}`,
    registryId: 'unit23-inline-ai',
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

function getDefaultDraft(step: UNIT_2_3StepDefinition, savedResponse?: UNIT_2_3StepResponse) {
  if (savedResponse) {
    return savedResponse.answers;
  }

  switch (step.pageType) {
    case 'parameter_slider':
      return {
        harmonics: String(RECONSTRUCTION_PARAMETER_DEFAULTS.harmonics),
        attenuation: String(RECONSTRUCTION_PARAMETER_DEFAULTS.attenuation),
      };
    case 'reason_check':
      return { frequency: '', amplitude: '', phase: '' };
    case 'tab_switch':
      return { tab: WAVE_MEANING_TABS[0].key };
    case 'triple_match':
      return { gjw: '', magnitude: '', phase: '' };
    case 'highlight_toggle':
      return { highlight: 'range' };
    case 'card_sort':
      return Object.fromEntries(CARD_SORT_ITEMS.map((item) => [item.key, '']));
    case 'workspace_builder':
      return { standard: '', break: '', low: '', slope: '' };
    case 'worked_example_workspace':
      return { omega: '', magnitude: '', phase: '', output: '' };
    case 'ai_compare_workspace':
      return { low: '', high: '', rebuild: '', revision: '' };
    case 'short_response':
      return { response: '' };
    case 'binary_choice':
    case 'single_choice':
      return { choice: '' };
    case 'quiz_group':
      return step.id === 'step-16' ? { q1: '', q2: '', q3: '' } : { q1: '', q2: '', q3: '' };
    default:
      return {};
  }
}

function supportsAnswerReveal(step: UNIT_2_3StepDefinition) {
  return ['binary_choice', 'quiz_group', 'reason_check', 'triple_match', 'single_choice', 'card_sort', 'workspace_builder', 'worked_example_workspace'].includes(step.pageType);
}

function getChoiceAnswer(step: UNIT_2_3StepDefinition) {
  if (step.id === 'step-02') return 'B';
  if (step.id === 'step-10') return 'N';
  return '';
}

function getSelectionSummary(value: string) {
  if (value === 'changed') return '改变';
  if (value === 'unchanged') return '不变';
  if (value === 'Y') return '是';
  if (value === 'N') return '否';
  return value || '未作答';
}

function getRevealMarkdown(step: UNIT_2_3StepDefinition) {
  switch (step.id) {
    case 'step-02':
      return '正确判断是 **系统应对不同节奏有选择**。这正是进入频域分析的第一步。';
    case 'step-04':
      return PRETEST_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    case 'step-07':
      return '标准结论是：**频率不变，幅值改变，相位改变**。这三条缺一不可。';
    case 'step-09':
      return '配对要点：`G(jω)` 是按频率索引的规则表；`M(ω)` 回答“通过多少”；`φ(ω)` 回答“提前还是滞后”。';
    case 'step-10':
      return '正确项是 **否**。写成 $G(j\\omega)$ 不是丢掉拉氏方法，而是沿虚轴观察正弦稳态响应。';
    case 'step-12':
      return '首轮判断并不追求精确曲线，而是先把典型对象分成“偏低频通过 / 偏高频通过 / 明显滞后”三类。';
    case 'step-13':
      return '首轮骨架固定按 **写标准型 -> 列转折频率 -> 判最低频段 -> 画趋势变化** 四步推进。';
    case 'step-14':
      return '参考结果：$c_{ss}(t)=0.894\\sin(4t-63.4^\\circ)$，对应 **频率未变、振幅缩小、相位滞后**。';
    case 'step-16':
      return POSTTEST_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    default:
      return '';
  }
}

function getDistribution(entries: string[]) {
  const counts = new Map<string, number>();
  for (const item of entries) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function trimText(value: string, max = 60) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
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

function MediaPanel({
  mediaSrc,
  mediaAlt,
}: {
  mediaSrc: string;
  mediaAlt: string;
}) {
  return (
    <div className="premium-lesson-surface-elevated overflow-hidden rounded-3xl">
      <Image src={mediaSrc} alt={mediaAlt} width={1600} height={900} className="h-auto w-full object-cover" unoptimized />
    </div>
  );
}

export function UNIT_2_3KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 2 Map</div>
      <div className="premium-lesson-title mt-2 text-lg font-semibold">2-2 -&gt; 2-3 -&gt; 2-4</div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['2-2', '时间响应', '对象在时间里怎样运动'],
          ['2-3', '频率响应', '对象对不同频率怎样处理'],
          ['2-4', 'Nyquist 与指标', '把频域对象推进到判稳与综合判断'],
        ].map(([label, title, body], index) => (
          <div
            key={label}
            className={`premium-lesson-tone-block ${index === 1 ? 'premium-tone-cyan' : 'premium-tone-slate'}`}
          >
            <div className="premium-lesson-kicker">{label}</div>
            <div className="premium-lesson-title mt-1 text-sm font-semibold">{title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_2_3StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
}: {
  step: UNIT_2_3StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);

  return (
    <section className="premium-lesson-panel px-5 py-5">
      <div className="premium-lesson-kicker">{blueprint.kicker}</div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm leading-7 sm:text-base">{blueprint.intro}</p>

      {mediaSrc ? (
        <div className="mt-4">
          <MediaPanel mediaSrc={mediaSrc} mediaAlt={mediaAlt ?? step.title} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {blueprint.sections.map((section) => (
          <InfoSection key={`${step.id}-${section.title}`} section={section} />
        ))}
      </div>

      {step.id === 'step-13' ? (
        <div className="premium-lesson-tone-block premium-tone-slate mt-4">
          <div className="premium-lesson-title text-sm font-semibold">骨架工作区检查项</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {BODE_WORKFLOW_STEPS.map((item) => (
              <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-3 py-2 text-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step.id === 'step-14' ? (
        <div className="premium-lesson-tone-block premium-tone-violet mt-4">
          <div className="premium-lesson-title text-sm font-semibold">四步法</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {WORKED_EXAMPLE_SEQUENCE.map((item) => (
              <div key={item.key} className="premium-lesson-surface-elevated rounded-2xl px-3 py-2 text-sm">
                {item.label}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

function ChoiceGroup({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            onChange(option.value);
          }}
          className={`premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-left text-sm transition ${
            value === option.value ? 'ring-2 ring-cyan-400' : ''
          }`}
        >
          <span className="font-medium">{option.value}.</span> {option.label}
        </button>
      ))}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <textarea aria-label={placeholder}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="premium-lesson-input min-h-[110px] w-full resize-y"
    />
  );
}

export function UNIT_2_3StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  readOnly = false,
  onParameterChange,
}: {
  step: UNIT_2_3StepDefinition;
  savedResponse?: UNIT_2_3StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_2_3StepResponse) => void;
  readOnly?: boolean;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const commitStudentResponse: typeof onSubmit = (response) => {
    if (readOnly) return;
    onSubmit(response);
  };
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(step, savedResponse));

  useEffect(() => {
    setDraft(getDefaultDraft(step, savedResponse));
  }, [savedResponse, step]);

  const submitted = Boolean(savedResponse);
  const locked = !released && !submitted && step.pageType !== 'display' && step.pageType !== 'summary';
  const revealMarkdown = getRevealMarkdown(step);

  const updateDraft = (key: string, value: string, source = 'student') => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    onParameterChange?.({ key, value, source });
  };

  if (step.pageType === 'display' || step.pageType === 'summary') {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">本页无需提交</div>
        <SubmissionStatus submitted={false} idleText={readOnly ? '演示模式仅本机预览，不会同步到教师端汇总。' : '本页以阅读、观察和教师推进为主，不需要学生提交作答。'} />
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
            <ChoiceGroup disabled={Boolean(readOnly)}
              options={[
                { value: 'A', label: '系统应对所有变化都同样敏感' },
                { value: 'B', label: '系统应对不同节奏有选择' },
              ]}
              value={draft.choice ?? ''}
              onChange={(value) => updateDraft('choice', value)}
            />
          ) : null}

          {step.pageType === 'quiz_group' ? (
            (step.id === 'step-16' ? POSTTEST_QUESTIONS : PRETEST_QUESTIONS).map((question) => (
              <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                {question.type === 'text' ? (
                  <div className="mt-3">
                    <TextInput disabled={Boolean(readOnly)}
                      value={draft[question.key] ?? ''}
                      onChange={(value) => updateDraft(question.key, value)}
                      placeholder="用 1-2 句话说明理由"
                    />
                  </div>
                ) : (
                  <div className="mt-3">
                    <ChoiceGroup disabled={Boolean(readOnly)}
                      options={question.options ?? []}
                      value={draft[question.key] ?? ''}
                      onChange={(value) => updateDraft(question.key, value)}
                    />
                  </div>
                )}
              </div>
            ))
          ) : null}

          {step.pageType === 'short_response' ? (
            <TextInput disabled={Boolean(readOnly)}
              value={draft.response ?? ''}
              onChange={(value) => updateDraft('response', value)}
              placeholder="频域分析不是替代时域分析，而是……"
            />
          ) : null}

          {step.pageType === 'parameter_slider' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">保留谐波个数</div>
                <input aria-label="保留谐波个数"
                  type="range"
                  min={1}
                  max={9}
                  value={draft.harmonics ?? String(RECONSTRUCTION_PARAMETER_DEFAULTS.harmonics)}
                  onChange={(event) => updateDraft('harmonics', event.target.value, 'slider')}
                  className="mt-4 w-full"
                />
                <div className="premium-lesson-muted mt-2 text-sm">当前值：{draft.harmonics}</div>
              </div>
              <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">高频衰减强度</div>
                <input aria-label="高频衰减强度"
                  type="range"
                  min={0}
                  max={100}
                  value={draft.attenuation ?? String(RECONSTRUCTION_PARAMETER_DEFAULTS.attenuation)}
                  onChange={(event) => updateDraft('attenuation', event.target.value, 'slider')}
                  className="mt-4 w-full"
                />
                <div className="premium-lesson-muted mt-2 text-sm">当前值：{draft.attenuation}%</div>
              </div>
              <div className="premium-lesson-tone-block premium-tone-cyan md:col-span-2 text-sm">
                {Number(draft.attenuation ?? 0) > 55 ? '高频压制较强，波形会更平滑。' : '高频保留较多，波形仍会保留更尖锐的边缘。'}
              </div>
            </div>
          ) : null}

          {step.pageType === 'reason_check' ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['frequency', '输出频率'],
                ['amplitude', '输出幅值'],
                ['phase', '输出相位'],
              ].map(([key, label]) => (
                <div key={key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{label}</div>
                  <div className="mt-3 grid gap-2">
                    {[
                      ['unchanged', '不变'],
                      ['changed', '改变'],
                    ].map(([value, text]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateDraft(key, value)}
                        className={`premium-lesson-control justify-start ${draft[key] === value ? 'ring-2 ring-cyan-400' : ''}`}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'tab_switch' ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                {WAVE_MEANING_TABS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => updateDraft('tab', item.key, 'tab')}
                    className={`premium-lesson-control ${draft.tab === item.key ? 'ring-2 ring-cyan-400' : ''}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="premium-lesson-tone-block premium-tone-slate text-sm">
                {draft.tab === 'gain'
                  ? '幅值变化对应“通过得更多还是更少”。'
                  : draft.tab === 'phase'
                    ? '相位变化对应“提前还是滞后”。'
                    : '命令更应被保留，扰动更应被抑制。'}
              </div>
            </div>
          ) : null}

          {step.pageType === 'triple_match' ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  key: 'gjw',
                  label: 'G(jω)',
                  options: [
                    { value: 'rule', label: '按频率索引的规则表' },
                    { value: 'gain', label: '只表示通过多少' },
                    { value: 'phase', label: '只表示相位偏移' },
                  ],
                },
                {
                  key: 'magnitude',
                  label: 'M(ω)',
                  options: [
                    { value: 'rule', label: '频率特性总表' },
                    { value: 'gain', label: '回答“通过多少”' },
                    { value: 'phase', label: '回答“相位如何偏移”' },
                  ],
                },
                {
                  key: 'phase',
                  label: 'φ(ω)',
                  options: [
                    { value: 'rule', label: '频率特性总表' },
                    { value: 'gain', label: '回答“通过多少”' },
                    { value: 'phase', label: '回答“相位如何偏移”' },
                  ],
                },
              ].map((item) => (
                <label key={item.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">{item.label}</span>
                  <select disabled={Boolean(readOnly)}
                    value={draft[item.key] ?? ''}
                    onChange={(event) => updateDraft(item.key, event.target.value)}
                    className="premium-lesson-select mt-3 w-full"
                  >
                    <option value="">选择对应关系</option>
                    {item.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}

          {step.pageType === 'single_choice' ? (
            <ChoiceGroup disabled={Boolean(readOnly)}
              options={[
                { value: 'Y', label: '是，等于把拉氏方法完全丢掉' },
                { value: 'N', label: '否，只是把注意力限制到虚轴观察线' },
              ]}
              value={draft.choice ?? ''}
              onChange={(value) => updateDraft('choice', value)}
            />
          ) : null}

          {step.pageType === 'highlight_toggle' ? (
            <div className="grid gap-3">
              {[
                ['range', '线性坐标拥挤区'],
                ['log', '对数坐标均匀区'],
                ['db', '分贝叠加便利'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateDraft('highlight', key, 'toggle')}
                  className={`premium-lesson-control justify-start ${draft.highlight === key ? 'ring-2 ring-cyan-400' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {step.pageType === 'card_sort' ? (
            <div className="grid gap-3">
              {CARD_SORT_ITEMS.map((item) => (
                <label key={item.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">{item.label}</span>
                  <select disabled={Boolean(readOnly)}
                    value={draft[item.key] ?? ''}
                    onChange={(event) => updateDraft(item.key, event.target.value)}
                    className="premium-lesson-select mt-3 w-full"
                  >
                    <option value="">选择分类</option>
                    {BODE_SORT_BUCKETS.map((bucket) => (
                      <option key={bucket.key} value={bucket.key}>
                        {bucket.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}

          {step.pageType === 'workspace_builder' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                <span className="premium-lesson-title text-sm font-medium">第 1 步：标准型</span>
                <input disabled={Boolean(readOnly)}
                  value={draft.standard ?? ''}
                  onChange={(event) => updateDraft('standard', event.target.value)}
                  className="premium-lesson-input mt-3 w-full"
                  placeholder="例如：K/(Ts+1)"
                />
              </label>
              <label className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                <span className="premium-lesson-title text-sm font-medium">第 2 步：转折频率</span>
                <input disabled={Boolean(readOnly)}
                  value={draft.break ?? ''}
                  onChange={(event) => updateDraft('break', event.target.value)}
                  className="premium-lesson-input mt-3 w-full"
                  placeholder="例如：ω=1/T"
                />
              </label>
              <label className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                <span className="premium-lesson-title text-sm font-medium">第 3 步：最低频段趋势</span>
                <input disabled={Boolean(readOnly)}
                  value={draft.low ?? ''}
                  onChange={(event) => updateDraft('low', event.target.value)}
                  className="premium-lesson-input mt-3 w-full"
                  placeholder="例如：低频基本通过"
                />
              </label>
              <label className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                <span className="premium-lesson-title text-sm font-medium">第 4 步：转折后斜率</span>
                <input disabled={Boolean(readOnly)}
                  value={draft.slope ?? ''}
                  onChange={(event) => updateDraft('slope', event.target.value)}
                  className="premium-lesson-input mt-3 w-full"
                  placeholder="例如：每十倍频下降 20 dB"
                />
              </label>
            </div>
          ) : null}

          {step.pageType === 'worked_example_workspace' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['omega', 'ω'],
                ['magnitude', '|G(jω)|'],
                ['phase', '∠G(jω)'],
                ['output', '稳态输出表达式'],
              ].map(([key, label]) => (
                <label key={key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">{label}</span>
                  <input disabled={Boolean(readOnly)}
                    value={draft[key] ?? ''}
                    onChange={(event) => updateDraft(key, event.target.value)}
                    className="premium-lesson-input mt-3 w-full"
                    placeholder="填写中间量或结果"
                  />
                </label>
              ))}
            </div>
          ) : null}

          {step.pageType === 'ai_compare_workspace' ? (
            <div className="grid gap-4">
              <TextInput disabled={Boolean(readOnly)}
                value={draft.low ?? ''}
                onChange={(value) => updateDraft('low', value)}
                placeholder="先写低频分量为什么更容易保留"
              />
              <TextInput disabled={Boolean(readOnly)}
                value={draft.high ?? ''}
                onChange={(value) => updateDraft('high', value)}
                placeholder="再写高频分量为什么被明显压低"
              />
              <TextInput disabled={Boolean(readOnly)}
                value={draft.rebuild ?? ''}
                onChange={(value) => updateDraft('rebuild', value)}
                placeholder="最后写输出为何更接近平滑低频波形"
              />
              <TextInput disabled={Boolean(readOnly)}
                value={draft.revision ?? ''}
                onChange={(value) => updateDraft('revision', value)}
                placeholder="AI 对照后，如果你要修正自己的链条，请写在这里"
              />
            </div>
          ) : null}

          <button
            type="button" disabled={Boolean(readOnly)}
            onClick={() =>
              commitStudentResponse({
                stepId: step.id,
                submittedAt: Date.now(),
                answers: draft,
              })
            }
            className="premium-lesson-action-primary"
          >
            {submitted ? '重新提交本页作答' : '提交到教师端'}
          </button>
        </div>
      )}

      <SubmissionStatus submitted={submitted} />

      {answerVisible && revealMarkdown ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4">{renderMarkdown(revealMarkdown)}</div>
      ) : null}
    </section>
  );
}

function summarizeResponses(step: UNIT_2_3StepDefinition, responses: UNIT_2_3TeacherResponseItem[]) {
  if (!responses.length) {
    return [];
  }

  switch (step.pageType) {
    case 'binary_choice':
    case 'single_choice':
      return getDistribution(responses.map((item) => getSelectionSummary(item.response.answers.choice ?? '')));
    case 'quiz_group':
      return getDistribution(
        responses.flatMap((item) =>
          Object.entries(item.response.answers)
            .filter(([key, value]) => value)
            .map(([key, value]) => `${key}:${trimText(value)}`),
        ),
      );
    case 'reason_check':
      return getDistribution(
        responses.flatMap((item) => [
          `频率:${getSelectionSummary(item.response.answers.frequency ?? '')}`,
          `幅值:${getSelectionSummary(item.response.answers.amplitude ?? '')}`,
          `相位:${getSelectionSummary(item.response.answers.phase ?? '')}`,
        ]),
      );
    case 'tab_switch':
      return getDistribution(responses.map((item) => item.response.answers.tab ?? '未选择'));
    case 'triple_match':
      return getDistribution(
        responses.flatMap((item) => [
          `G(jω):${item.response.answers.gjw ?? '未选'}`,
          `M(ω):${item.response.answers.magnitude ?? '未选'}`,
          `φ(ω):${item.response.answers.phase ?? '未选'}`,
        ]),
      );
    case 'highlight_toggle':
      return getDistribution(responses.map((item) => item.response.answers.highlight ?? '未切换'));
    case 'card_sort':
      return getDistribution(
        responses.flatMap((item) =>
          CARD_SORT_ITEMS.map((card) => `${card.label}:${item.response.answers[card.key] || '未分配'}`),
        ),
      );
    case 'workspace_builder':
    case 'worked_example_workspace':
    case 'short_response':
    case 'ai_compare_workspace':
    case 'parameter_slider':
      return responses.map((item) => [item.studentName, trimText(Object.values(item.response.answers).join(' / '))]);
    default:
      return [];
  }
}

export function UNIT_2_3TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_2_3StepDefinition;
  responses: UNIT_2_3TeacherResponseItem[];
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

export function UNIT_2_3StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_2_3StepResponse>;
}) {
  const completed = Object.keys(responses).length;
  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-lg font-semibold">学习收束</div>
      <div className="premium-lesson-muted mt-2 text-sm">你已经提交了 {completed} 个环节的作答。本课真正要带走的不是孤立公式，而是一条稳定的频域对象链。</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          '频域分析研究对象如何处理不同频率成分',
          '同频输出规律让正弦输入成为天然测试信号',
          'G(jω)、幅频、相频三者分工明确',
          'Bode 首轮骨架要从标准型和转折频率开始',
        ].map((item) => (
          <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_2_3StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_2_3StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '2-3',
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
      <p className="premium-lesson-muted mt-2 text-sm">
        先完成你自己的分量处理判断，再使用下面的提示词与页内 AI 做对照。AI 只核对链条，不替你跳过第一步。
      </p>

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
            <DialogTitle>{UNIT_2_3_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription>当前只围绕 {step.title} 回答问题，帮助你核对“分量独立处理 -&gt; 输出重构”的推理链。</DialogDescription>
          </DialogHeader>
          <div className="h-[75vh]">
            <InteractiveAIPanel ai={ai} title={`${step.title} · AI 对照`} position="right" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
