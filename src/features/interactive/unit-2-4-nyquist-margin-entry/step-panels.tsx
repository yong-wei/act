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
  UNIT_2_4_COURSE_TITLE,
  type UNIT_2_4StepDefinition,
  type UNIT_2_4StepResponse,
} from '@/lib/unit-2-4-course';
import {
  BODE_SORT_BUCKETS,
  BODE_WORKFLOW_STEPS,
  RECONSTRUCTION_PARAMETER_DEFAULTS,
  WORKED_EXAMPLE_SEQUENCE,
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

export interface UNIT_2_4TeacherResponseItem {
  studentName: string;
  response: UNIT_2_4StepResponse;
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
    prompt: '关于 Nyquist 图与 Bode 图，下列哪一项判断正确？',
    options: [
      { value: 'A', label: 'Nyquist 图是在 Bode 图之外新引入的系统对象' },
      { value: 'B', label: 'Nyquist 图与 Bode 图观察的是同一个 G(jω)' },
      { value: 'C', label: 'Nyquist 图只适用于闭环系统' },
    ],
    answer: 'B',
    explanation: 'Nyquist 图不是新对象，而是把同一个 G(jω) 从“分开看”改成“合起来看”的另一种图形语言。',
  },
  {
    key: 'q2',
    prompt: '阅读 Nyquist 图时，最先应该抓住哪一类信息？',
    options: [
      { value: 'A', label: '先看对象名字，起点终点以后再说' },
      { value: 'B', label: '先看起点、终点，再看方向和总转角' },
      { value: 'C', label: '先直接判断闭环稳定性' },
    ],
    answer: 'B',
    explanation: '本课固定“四步读法”是起点、终点、方向、总转角，不能跳过起点和终点直接谈结论。',
  },
  {
    key: 'q3',
    prompt: '关于相位裕度和增益裕度，本课边界最准确的说法是：',
    options: [
      { value: 'A', label: '一旦读出裕度，就可以直接给出完整闭环结论' },
      { value: 'B', label: '本课只要求会定义、读图和基础计算，不进入完整闭环判稳' },
      { value: 'C', label: '本课不需要知道任何频域指标' },
    ],
    answer: 'B',
    explanation: '2-4 只建立频域指标入口，不把裕度直接升级成完整闭环稳定性结论。',
  },
];

const POSTTEST_QUESTIONS: QuizQuestion[] = [
  {
    key: 'q1',
    prompt: '在 Nyquist 图上，相位裕度首先要围绕哪个锚点来理解？',
    options: [
      { value: 'A', label: '负实轴与单位幅值点附近的几何余量' },
      { value: 'B', label: '原点到轨迹的最短距离' },
      { value: 'C', label: '任意频率点到虚轴的距离' },
    ],
    answer: 'A',
    explanation: '相位裕度要回到穿越频率和负实轴方向附近的几何余量来读，不能只看离原点远近。',
  },
  {
    key: 'q2',
    prompt: '关于 2-4 的课程边界，下列哪一项最准确？',
    options: [
      { value: 'A', label: '本课负责 Nyquist 入口、指标读取、手工绘图入口和基础反向识别' },
      { value: 'B', label: '本课已经完整覆盖 Nyquist 判据和频域校正设计' },
      { value: 'C', label: '本课只讲手工绘图，不讲任何频域指标' },
    ],
    answer: 'A',
    explanation: '本课负责图形对象入口与指标入口，不负责 Nyquist 判据、Bode 判稳、闭环结论和频域校正设计。',
  },
  {
    key: 'q3',
    type: 'text',
    prompt: '为什么读出频域指标后，本课仍强调“只到入口、不作闭环结论”？',
    explanation: '因为 2-4 只要求会定义、读图和基础计算，完整闭环判稳需要后续判据和结构机理支撑，不能在这里偷渡。',
  },
];

const STEP_BLUEPRINTS: Record<string, StepBlueprint> = {
  'step-01': {
    kicker: 'Roadmap',
    intro: '2-3 已经把对象第一次画成 Bode 骨架，2-4 则继续把同一个 G(jω) 收束成 Nyquist 轨迹、频域指标入口和最小反向识别。',
    sections: [
      {
        title: '本课关键词',
        tone: 'cyan',
        bullets: ['双图表达：同一个 G(jω) 的两种图形语言', '频域指标：ωc、ωg、γ、Kg、ωb 的第一入口', '图形对象出口：从模块 2 走向模块 3 结构机理'],
      },
    ],
  },
  'step-02': {
    kicker: 'Scenario',
    intro: '本页只钉一件事：Nyquist 图不是新对象，而是把同一个频率特性从“拆开看”改成“合起来看”的另一种图形表达。',
    sections: [
      {
        title: '两问',
        tone: 'amber',
        bullets: ['为什么已有 Bode 图，还要再画 Nyquist 图？', '两张图是不是在讲两套不同对象？'],
      },
      {
        title: '固定结论',
        tone: 'cyan',
        body: 'Nyquist 不是新对象，而是同一条 G(jω) 频率特性的另一种图形语言。',
      },
    ],
  },
  'step-03': {
    kicker: 'Objectives',
    intro: '2-4 的价值不是把判据一次讲完，而是先把图形对象立住：会解释双图表达、会读纯极点 Nyquist、会读指标、会做最小反向识别。',
    sections: [
      {
        title: '三项目标',
        tone: 'emerald',
        bullets: ['会解释双图表达', '会按四步读纯极点 Nyquist', '会读频域指标与做最小反向识别'],
      },
      {
        title: '本课边界',
        tone: 'slate',
        bullets: ['负责：Nyquist 入口、指标读取、手工绘图入口、基础反向识别', '不负责：Nyquist 判据、Bode 判稳、闭环结论、频域校正设计'],
      },
    ],
  },
  'step-04': {
    kicker: 'Pre-Assessment',
    intro: '前测不拉开成绩，只暴露三类误区：把 Nyquist 当新对象、不会按四步读起点、把裕度直接升级成闭环结论。',
    sections: [
      {
        title: '三条误区提示',
        tone: 'amber',
        bullets: ['Nyquist 不是新对象', '起点和低频信息直接相连', '裕度只是入口，不是本课的闭环结论'],
      },
    ],
  },
  'step-05': {
    kicker: 'Bridge',
    intro: '同一个 G(jω) 既可以写成极坐标形式，也可以写成直角坐标形式。Bode 把幅值和相位拆开看，Nyquist 则把复数点连成轨迹看。',
    sections: [
      {
        title: '两条公式',
        tone: 'slate',
        markdown: `$$\nG(j\\omega)=|G(j\\omega)|e^{j\\phi(\\omega)}\n$$\n\n$$\nG(j\\omega)=\\operatorname{Re}\\{G(j\\omega)\\}+j\\operatorname{Im}\\{G(j\\omega)\\}\n$$`,
      },
      {
        title: '双图分工',
        tone: 'cyan',
        bullets: ['Bode：更适合读幅值与相位随频率如何变化', 'Nyquist：更适合看复平面轨迹怎样接近关键几何锚点'],
      },
    ],
  },
  'step-06': {
    kicker: 'Four-Step Reading',
    intro: '读 Nyquist 图时，本课固定“四步读法”：起点、终点、方向、总转角。先把顺序看稳，再谈读图结论。',
    sections: [
      {
        title: '四步流程',
        tone: 'emerald',
        bullets: ['起点：低频如何通过', '终点：高频极限走向哪里', '方向：相位趋势怎样拖后', '总转角：累计拖后如何形成'],
      },
      {
        title: '观察提示',
        tone: 'slate',
        body: '阅读顺序不能从“想下结论”开始，而必须先落回起点和终点。',
      },
    ],
  },
  'step-07': {
    kicker: 'First-Order Track',
    intro: '一阶惯性 Nyquist 轨迹是本课最重要的第一张典型图：从正实轴出发，向下弯曲，最终收向原点。',
    sections: [
      {
        title: '对象公式卡',
        tone: 'slate',
        markdown: `$$\nG(s)=\\frac{1}{Ts+1}\n$$\n\n$$\nG(j\\omega)=\\frac{1}{1+j\\omega T}=\\frac{1-j\\omega T}{1+(\\omega T)^2}\n$$`,
      },
      {
        title: '三条结论',
        tone: 'violet',
        bullets: ['起点在正实轴单位附近', '轨迹向下弯曲', '终点收向原点'],
      },
    ],
  },
  'step-08': {
    kicker: 'Pure Poles',
    intro: '纯极点系统比较页只强调一件事：极点越多，累计拖后越深，Nyquist 轨迹通常转得更深。',
    sections: [
      {
        title: '比较视角',
        tone: 'slate',
        markdown: `| 对象变化 | Nyquist 典型现象 |\n| --- | --- |\n| 极点数增多 | 轨迹转得更深 |\n| 拖后累积 | 更靠近负实轴方向 |\n| 和 Bode 对照 | 相位拖后更明显 |`,
      },
    ],
  },
  'step-09': {
    kicker: 'Indicators',
    intro: '本课第一次正式把频域图形推进到指标入口，但仍然只做定义、读图和基础计算，不直接偷渡闭环结论。',
    sections: [
      {
        title: '五个指标',
        tone: 'slate',
        markdown: `$$\n\\omega_c,\\ \\omega_g,\\ \\gamma,\\ K_g,\\ \\omega_b\n$$`,
      },
      {
        title: '边界提醒',
        tone: 'cyan',
        body: '这五个量在 2-4 只服务于定义、读图和基础计算，不直接输出完整闭环稳定性结论。',
      },
    ],
  },
  'step-10': {
    kicker: 'Dual-Graph Locator',
    intro: '双图对照页要建立“同一指标，两张图，不同锚点”的读图链：Bode 看穿越点，Nyquist 看单位圆、负实轴与关键方向。',
    sections: [
      {
        title: '定位规则',
        tone: 'slate',
        bullets: ['截止频率回到幅值 0 dB 附近', '穿越频率回到相位 -180° 附近', '相位裕度与增益裕度都要回到负实轴方向理解'],
      },
      {
        title: '本页重点',
        tone: 'amber',
        body: '不要只会在 Bode 图上读点，也要知道同一指标在 Nyquist 图上靠什么几何锚点定位。',
      },
    ],
  },
  'step-11': {
    kicker: 'Bode Sketch',
    intro: '本页只做最基础的手工绘图入口：先定基线，再找折点，再看斜率变化。目标不是完整自由作图，而是把骨架顺序钉住。',
    sections: [
      {
        title: '四步流程',
        tone: 'emerald',
        bullets: BODE_WORKFLOW_STEPS.map((item, index) => `${index + 1}. ${item}`),
      },
    ],
  },
  'step-12': {
    kicker: 'Nyquist Sketch',
    intro: 'Nyquist 手工绘图入口只保留四类锚点：端点、过轴点、渐近线和方向，顺序固定为先正频率支，再标关键点。',
    sections: [
      {
        title: '关键点规则',
        tone: 'slate',
        bullets: ['先看端点', '再找过实轴 / 过虚轴', '再看渐近线与方向', '最后收束到整体轨迹'],
      },
    ],
  },
  'step-13': {
    kicker: 'Worked Example 1',
    intro: '例题一把“Bode 基线 -> 折点 -> Nyquist 锚点 -> 最终轨迹”串成一条三步链，重点是过程链而不是只记最后图形。',
    sections: [
      {
        title: '三步链',
        tone: 'slate',
        bullets: ['先定 Bode 基线', '再找折点与相位拖后', '最后回到 Nyquist 锚点和轨迹'],
      },
      {
        title: '边界提醒',
        tone: 'emerald',
        body: '本页依旧只到对象级工作链，不展开 Nyquist 判据。',
      },
    ],
  },
  'step-14': {
    kicker: 'Worked Example 2',
    intro: '例题二只读取频域指标和解释来源，不把本课偷渡成闭环判稳课。',
    sections: [
      {
        title: '题面卡',
        tone: 'slate',
        bullets: ['找截止频率', '找穿越频率', '读相位裕度与增益裕度'],
      },
      {
        title: '固定提醒',
        tone: 'emerald',
        body: '只到指标入口，不作闭环结论。',
      },
    ],
  },
  'step-15': {
    kicker: 'Reverse Reading',
    intro: '反向识别的边界很克制：先认对象轮廓，再估参数量级。AI 只核对线索链，不代做完整辨识。',
    sections: [
      {
        title: '观察线索',
        tone: 'slate',
        bullets: ['低频平直还是斜降', '是否存在明显折点', '有无显著峰起或更深拖后'],
      },
      {
        title: 'AI 边界',
        tone: 'amber',
        body: 'AI 只核对“对象轮廓 -> 参数量级”的推理链，不代写完整辨识结果。',
      },
    ],
    prompts: [
      '我已经先根据图形轮廓判断对象类型，并估了一次参数量级。请你不要直接给最终答案，只检查我的“对象轮廓 -> 参数量级”推理链哪里还不严谨。',
      '请围绕 2-4 的 Nyquist 与频域指标入口内容，只核对我对图形轮廓、折点和低频量级的判断思路，不要替我跳过中间分析。',
    ],
  },
  'step-16': {
    kicker: 'Post-Assessment',
    intro: '后测要同时检查三件事：会不会读图、会不会读指标、会不会守住“只到入口”的课程边界。',
    sections: [
      {
        title: '提示卡',
        tone: 'amber',
        body: '会读图很重要，但会守边界同样重要。',
      },
    ],
  },
  'step-17': {
    kicker: 'Takeaways',
    intro: '2-4 的任务是把对象从 Bode 骨架推进到 Nyquist 与指标入口，再把问题送到模块 3 的结构机理与判稳语言。',
    sections: [
      {
        title: '五条结论',
        tone: 'emerald',
        bullets: [
          'Bode 与 Nyquist 共享同一个 G(jω)',
          'Nyquist 读图先抓起点、终点、方向、总转角',
          '频域指标在 2-4 只做到定义、读图和基础计算',
          '手工绘图入口只要求看懂基线、折点、关键点与渐近线',
          '反向识别要先认对象轮廓，再估参数量级',
        ],
      },
      {
        title: '后续去向',
        tone: 'cyan',
        bullets: ['3-1：纯极点视角下的稳定与动态基础', '3-7：误差分析总入口', '3-8：频域判稳与综合语言'],
      },
    ],
  },
};

const CARD_SORT_ITEMS = [
  { key: 'single-pole', label: '单极点对象', answer: 'axis-near' },
  { key: 'double-pole', label: '双极点对象', answer: 'deep' },
  { key: 'triple-pole', label: '三极点对象', answer: 'deep' },
  { key: 'with-integrator', label: '含积分环节对象', answer: 'shallow' },
] as const;

function getStepBlueprint(step: UNIT_2_4StepDefinition) {
  return (
    STEP_BLUEPRINTS[step.id] ?? {
      kicker: 'Lesson',
      intro: step.hint,
      sections: [],
    }
  );
}

function getAiPrompts(step: UNIT_2_4StepDefinition) {
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_2_4StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit24:${step.id}`,
    registryId: 'unit24-inline-ai',
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

function getDefaultDraft(step: UNIT_2_4StepDefinition, savedResponse?: UNIT_2_4StepResponse) {
  if (savedResponse) {
    return savedResponse.answers;
  }

  switch (step.pageType) {
    case 'parameter_slider':
      return {
        timeConstant: String(RECONSTRUCTION_PARAMETER_DEFAULTS.timeConstant),
        probeFrequency: String(RECONSTRUCTION_PARAMETER_DEFAULTS.probeFrequency),
      };
    case 'reason_check':
      return { start: '', end: '', direction: '', rotation: '' };
    case 'triple_match':
      return step.id === 'step-05'
        ? { bode: '', nyquist: '', sameObject: '' }
        : { omegaC: '', omegaG: '', gamma: '', kg: '', omegaB: '' };
    case 'card_sort':
      return Object.fromEntries(CARD_SORT_ITEMS.map((item) => [item.key, '']));
    case 'hotspot_labeling':
      return { omegaC: '', omegaG: '', gamma: '', kg: '' };
    case 'workspace_builder':
      return { standard: '', break: '', low: '', slope: '' };
    case 'path_highlight':
      return { endpoint: '', crossing: '', asymptote: '', direction: '' };
    case 'worked_example_workspace':
      return { baseline: '', break: '', nyquist: '', result: '' };
    case 'metric_overlay':
      return { omegaC: '', omegaG: '', gamma: '', kg: '', note: '' };
    case 'ai_compare_workspace':
      return { objectType: '', parameterScale: '', evidence: '', revision: '' };
    case 'binary_choice':
      return { choice: '' };
    case 'quiz_group':
      return { q1: '', q2: '', q3: '' };
    default:
      return {};
  }
}

function supportsAnswerReveal(step: UNIT_2_4StepDefinition) {
  return [
    'binary_choice',
    'quiz_group',
    'reason_check',
    'triple_match',
    'card_sort',
    'hotspot_labeling',
    'workspace_builder',
    'path_highlight',
    'worked_example_workspace',
    'metric_overlay',
  ].includes(step.pageType);
}

function getSelectionSummary(value: string) {
  if (value === 'changed') return '改变';
  if (value === 'unchanged') return '不变';
  if (value === 'Y') return '是';
  if (value === 'N') return '否';
  return value || '未作答';
}

function getRevealMarkdown(step: UNIT_2_4StepDefinition) {
  switch (step.id) {
    case 'step-02':
      return '正确判断是 **B：Nyquist 图与 Bode 图观察的是同一个 $G(j\\omega)$**。';
    case 'step-04':
      return PRETEST_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    case 'step-06':
      return '固定顺序是：**起点 -> 终点 -> 方向 -> 总转角**。';
    case 'step-08':
      return '纯极点系统比较的要点是：**极点越多，累计拖后越深，Nyquist 轨迹通常转得更深**。';
    case 'step-09':
      return '指标要点：**$\\omega_c$、$\\omega_g$、$\\gamma$、$K_g$、$\\omega_b$** 在本课只到定义、读图和基础计算。';
    case 'step-10':
      return '双图对照时，必须把 **Bode 图上的穿越点** 和 **Nyquist 图上的几何锚点** 连起来理解。';
    case 'step-11':
      return 'Bode 手工绘图入口固定按 **写标准型 -> 列转折频率 -> 判最低频段 -> 依次画趋势变化**。';
    case 'step-12':
      return 'Nyquist 手工绘图入口固定抓 **端点 / 过轴点 / 渐近线 / 方向** 四类锚点。';
    case 'step-13':
      return '例题一的关键不是背结果，而是把 **Bode 基线 -> 折点 -> Nyquist 锚点** 串起来。';
    case 'step-14':
      return '例题二必须同时保留一句：**只到指标入口，不作闭环结论**。';
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

export function UNIT_2_4KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 2 Map</div>
      <div className="premium-lesson-title mt-2 text-lg font-semibold">2-3 -&gt; 2-4 -&gt; 3-1</div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['2-3', 'Bode 骨架', '第一次把频率对象画成图'],
          ['2-4', 'Nyquist 与指标', '把同一个 G(jω) 收束为轨迹与锚点'],
          ['3-1', '结构机理', '从图形对象走向稳定与动态基础'],
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

export function UNIT_2_4StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
}: {
  step: UNIT_2_4StepDefinition;
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

export function UNIT_2_4StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  readOnly = false,
  onParameterChange,
}: {
  step: UNIT_2_4StepDefinition;
  savedResponse?: UNIT_2_4StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_2_4StepResponse) => void;
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

          {step.pageType === 'parameter_slider' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">时间常数 T</div>
                <input aria-label="时间常数 T"
                  type="range"
                  min={0.2}
                  max={3}
                  step={0.1}
                  value={draft.timeConstant ?? String(RECONSTRUCTION_PARAMETER_DEFAULTS.timeConstant)}
                  onChange={(event) => updateDraft('timeConstant', event.target.value, 'slider')}
                  className="mt-4 w-full"
                />
                <div className="premium-lesson-muted mt-2 text-sm">当前值：{draft.timeConstant}</div>
              </div>
              <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">观察频率 ω</div>
                <input aria-label="观察频率 omega"
                  type="range"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={draft.probeFrequency ?? String(RECONSTRUCTION_PARAMETER_DEFAULTS.probeFrequency)}
                  onChange={(event) => updateDraft('probeFrequency', event.target.value, 'slider')}
                  className="mt-4 w-full"
                />
                <div className="premium-lesson-muted mt-2 text-sm">当前值：{draft.probeFrequency}</div>
              </div>
              <div className="premium-lesson-tone-block premium-tone-cyan md:col-span-2 text-sm">
                {Number(draft.probeFrequency ?? 0) > 1 / Number(draft.timeConstant ?? 1)
                  ? '当前频率高于拐点，轨迹会更靠近原点并继续向下拖后。'
                  : '当前频率仍偏低，轨迹更接近正实轴起点。'}
              </div>
            </div>
          ) : null}

          {step.pageType === 'reason_check' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['start', '起点先看什么'],
                ['end', '终点先看什么'],
                ['direction', '方向反映什么'],
                ['rotation', '总转角对应什么'],
              ].map(([key, label]) => (
                <div key={key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{label}</div>
                  <div className="mt-3 grid gap-2">
                    {[
                      ['right', '本页正确对应'],
                      ['wrong', '本页错误对应'],
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

          {step.pageType === 'triple_match' ? (
            <div className={`grid gap-4 ${step.id === 'step-05' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              {(step.id === 'step-05'
                ? [
                    {
                      key: 'bode',
                      label: 'Bode 图',
                      options: [
                        { value: 'split', label: '把幅值与相位拆开看' },
                        { value: 'track', label: '把复平面点连成轨迹' },
                      ],
                    },
                    {
                      key: 'nyquist',
                      label: 'Nyquist 图',
                      options: [
                        { value: 'track', label: '把复平面点连成轨迹' },
                        { value: 'split', label: '把幅值与相位拆开看' },
                      ],
                    },
                    {
                      key: 'sameObject',
                      label: '同一对象',
                      options: [
                        { value: 'same', label: '两张图都在观察同一个 G(jω)' },
                        { value: 'different', label: '两张图在讲两套不同对象' },
                      ],
                    },
                  ]
                : [
                    {
                      key: 'omegaC',
                      label: '截止频率 ωc',
                      options: [
                        { value: 'mag-zero', label: '幅值穿越 0 dB 位置' },
                        { value: 'phase-180', label: '相位穿越 -180° 位置' },
                      ],
                    },
                    {
                      key: 'omegaG',
                      label: '穿越频率 ωg',
                      options: [
                        { value: 'phase-180', label: '相位穿越 -180° 位置' },
                        { value: 'mag-zero', label: '幅值穿越 0 dB 位置' },
                      ],
                    },
                    {
                      key: 'gamma',
                      label: '相位裕度 γ',
                      options: [
                        { value: 'phase-margin', label: '在截止频率处看相位余量' },
                        { value: 'gain-margin', label: '在穿越频率处看幅值余量' },
                      ],
                    },
                    {
                      key: 'kg',
                      label: '增益裕度 Kg',
                      options: [
                        { value: 'gain-margin', label: '在穿越频率处看幅值余量' },
                        { value: 'phase-margin', label: '在截止频率处看相位余量' },
                      ],
                    },
                    {
                      key: 'omegaB',
                      label: '带宽频率 ωb',
                      options: [
                        { value: 'closed-loop-entry', label: '闭环带宽的第一入口' },
                        { value: 'nyquist-criterion', label: 'Nyquist 判据本体' },
                      ],
                    },
                  ]
              ).map((item) => (
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

          {step.pageType === 'hotspot_labeling' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['omegaC', '截止频率 ωc'],
                ['omegaG', '穿越频率 ωg'],
                ['gamma', '相位裕度 γ'],
                ['kg', '增益裕度 Kg'],
              ].map(([key, label]) => (
                <label key={key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">{label}</span>
                  <select disabled={Boolean(readOnly)}
                    value={draft[key] ?? ''}
                    onChange={(event) => updateDraft(key, event.target.value)}
                    className="premium-lesson-select mt-3 w-full"
                  >
                    <option value="">选择 Nyquist 锚点</option>
                    <option value="unit-circle">单位圆附近</option>
                    <option value="negative-real">负实轴附近</option>
                    <option value="crossing">穿越点附近</option>
                    <option value="origin">原点附近</option>
                  </select>
                </label>
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

          {step.pageType === 'path_highlight' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['endpoint', '端点'],
                ['crossing', '过轴点'],
                ['asymptote', '渐近线'],
                ['direction', '方向'],
              ].map(([key, label]) => (
                <label key={key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">{label}</span>
                  <input disabled={Boolean(readOnly)}
                    value={draft[key] ?? ''}
                    onChange={(event) => updateDraft(key, event.target.value)}
                    className="premium-lesson-input mt-3 w-full"
                    placeholder="写出该锚点的判断或规则"
                  />
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
                ['baseline', 'Bode 基线'],
                ['break', '转折频率'],
                ['nyquist', 'Nyquist 锚点'],
                ['result', '结果收束'],
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

          {step.pageType === 'metric_overlay' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['omegaC', '截止频率 ωc'],
                ['omegaG', '穿越频率 ωg'],
                ['gamma', '相位裕度 γ'],
                ['kg', '增益裕度 Kg'],
                ['note', '边界提醒'],
              ].map(([key, label]) => (
                <label key={key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">{label}</span>
                  <input disabled={Boolean(readOnly)}
                    value={draft[key] ?? ''}
                    onChange={(event) => updateDraft(key, event.target.value)}
                    className="premium-lesson-input mt-3 w-full"
                    placeholder={key === 'note' ? '例如：只到指标入口，不作闭环结论' : '填写读图结果'}
                  />
                </label>
              ))}
            </div>
          ) : null}

          {step.pageType === 'ai_compare_workspace' ? (
            <div className="grid gap-4">
              <TextInput disabled={Boolean(readOnly)}
                value={draft.objectType ?? ''}
                onChange={(value) => updateDraft('objectType', value)}
                placeholder="先写你判断的对象类型"
              />
              <TextInput disabled={Boolean(readOnly)}
                value={draft.parameterScale ?? ''}
                onChange={(value) => updateDraft('parameterScale', value)}
                placeholder="再写你估计的参数量级"
              />
              <TextInput disabled={Boolean(readOnly)}
                value={draft.evidence ?? ''}
                onChange={(value) => updateDraft('evidence', value)}
                placeholder="最后写支撑你判断的图形证据"
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

function summarizeResponses(step: UNIT_2_4StepDefinition, responses: UNIT_2_4TeacherResponseItem[]) {
  if (!responses.length) {
    return [];
  }

  switch (step.pageType) {
    case 'binary_choice':
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
          `起点:${getSelectionSummary(item.response.answers.start ?? '')}`,
          `终点:${getSelectionSummary(item.response.answers.end ?? '')}`,
          `方向:${getSelectionSummary(item.response.answers.direction ?? '')}`,
          `总转角:${getSelectionSummary(item.response.answers.rotation ?? '')}`,
        ]),
      );
    case 'triple_match':
      return getDistribution(
        responses.flatMap((item) =>
          step.id === 'step-05'
            ? [
                `Bode:${item.response.answers.bode ?? '未选'}`,
                `Nyquist:${item.response.answers.nyquist ?? '未选'}`,
                `同一对象:${item.response.answers.sameObject ?? '未选'}`,
              ]
            : [
                `ωc:${item.response.answers.omegaC ?? '未选'}`,
                `ωg:${item.response.answers.omegaG ?? '未选'}`,
                `γ:${item.response.answers.gamma ?? '未选'}`,
                `Kg:${item.response.answers.kg ?? '未选'}`,
                `ωb:${item.response.answers.omegaB ?? '未选'}`,
              ],
        ),
      );
    case 'card_sort':
      return getDistribution(
        responses.flatMap((item) =>
          CARD_SORT_ITEMS.map((card) => `${card.label}:${item.response.answers[card.key] || '未分配'}`),
        ),
      );
    case 'hotspot_labeling':
    case 'path_highlight':
    case 'metric_overlay':
    case 'workspace_builder':
    case 'worked_example_workspace':
    case 'ai_compare_workspace':
    case 'parameter_slider':
      return responses.map((item) => [item.studentName, trimText(Object.values(item.response.answers).join(' / '))]);
    default:
      return [];
  }
}

export function UNIT_2_4TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_2_4StepDefinition;
  responses: UNIT_2_4TeacherResponseItem[];
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

export function UNIT_2_4StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_2_4StepResponse>;
}) {
  const completed = Object.keys(responses).length;
  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-lg font-semibold">学习收束</div>
      <div className="premium-lesson-muted mt-2 text-sm">你已经提交了 {completed} 个环节的作答。本课真正要带走的不是孤立公式，而是一条稳定的双图表达与指标入口链。</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          'Bode 与 Nyquist 共享同一个 G(jω)',
          'Nyquist 图先看起点、终点、方向、总转角',
          '相位裕度和增益裕度在本课只做到定义、读图和基础计算',
          '反向识别要先认对象轮廓，再估参数量级',
        ].map((item) => (
          <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_2_4StepAiAssistant({
  step,
  onAiEvent,
  classroomSessionId,
}: {
  step: UNIT_2_4StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
  classroomSessionId?: string;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    classroomSessionId,
    contextData: {
      lessonId: '2-4',
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
        先完成你自己的对象判断或指标定位，再使用下面的提示词与页内 AI 做对照。AI 只核对推理链，不替你跳过第一步。
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
            <DialogTitle>{UNIT_2_4_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription>当前只围绕 {step.title} 回答问题，帮助你核对“图形锚点 -&gt; 对象判断”或“指标读图 -&gt; 边界提醒”的推理链。</DialogDescription>
          </DialogHeader>
          <div className="h-[75vh]">
            <InteractiveAIPanel ai={ai} title={`${step.title} · AI 对照`} position="right" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
