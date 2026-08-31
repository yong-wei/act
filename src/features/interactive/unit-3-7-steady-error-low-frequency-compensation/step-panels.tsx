'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import type { ControlAnalysisRequest, ControlAnalysisResult, CurvePoint } from '@/resources/control-system/analysis/types';
import { BodePanel } from '@/resources/control-system/charts/control-analysis-panels';
import { buildBodeComparisonOption, UNIT_37_LOW_FREQUENCY_BODE_CASE_ID } from '@/resources/control-system/charts/control-bode-options';
import { ControlChartPanel } from '@/resources/control-system/charts/control-chart-panel';
import type { UNIT_3_7StepDefinition, UNIT_3_7StepResponse } from '@/lib/unit-3-7-course';
import {
  ACTIVITY_CARD_FIELDS,
  ASSESSMENT_CARD_FIELDS,
  HOTSPOT_FIELDS,
  POSTTEST_QUESTIONS,
  PRETEST_QUESTIONS,
  WORKED_EXAMPLE_FIELDS,
  type ActivityCardField,
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

export interface UNIT_3_7TeacherResponseItem {
  studentName: string;
  response: UNIT_3_7StepResponse;
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

const INLINE_MARKDOWN_COMPONENTS = {
  code: MARKDOWN_COMPONENTS.code,
  p: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
};

const STEP_BLUEPRINTS: Record<string, StepBlueprint> = {
  'step-01': {
    kicker: 'Module 3 Map',
    intro: '本页先把 3-7 放回模块 3 的主线：3-6 刚刚解决“怎样更快更稳”，3-7 接着回答“为什么还能更准”，3-8 再把这条语言翻成统一频域判别。',
    sections: [
      {
        title: '本课主问题',
        tone: 'cyan',
        bullets: ['系统稳定了，为什么误差还可能留在比较点上？', '为什么“更快更稳”并不等于已经“更准”？'],
      },
      {
        title: '边界提醒',
        tone: 'amber',
        bullets: ['本课不进入 Nyquist 判据。', '本课不进入模块 4 的完整整定流程。', '本课先建立误差分析与低频补偿入口。'],
      },
    ],
  },
  'step-02': {
    kicker: 'Goals And Boundary',
    intro: '本页把 3-7 的四个固定产出一次钉死：会分通道、会选路径、会区分增益与型别、会比较 PI 与滞后，同时明确本课不提前滑向完整频域判据。',
    sections: [
      {
        title: '四项目标',
        tone: 'emerald',
        bullets: ['会分通道。', '会选路径。', '会区分增益与型别。', '会比较 PI 与滞后。'],
      },
      {
        title: '负责 / 不负责',
        tone: 'slate',
        markdown:
          '| 本课负责 | 本课不负责 |\n| --- | --- |\n| 通道分析、稳态误差求解、低频补偿路径、频域过渡 | Nyquist 判据、完整整定、模块 4 控制器选型 |',
      },
    ],
  },
  'step-03': {
    kicker: 'Pre-Assessment',
    intro: '前测不为了拉开成绩差距，而是为了暴露三个最容易把 3-7 做偏的误判：扰动也能套表、增益变大等于型别提高、滞后只是弱积分。',
    sections: [
      {
        title: '常见混淆',
        tone: 'rose',
        bullets: ['扰动不是另一种输入型别。', '增益变大不等于型别提高。', '滞后不是更弱一点的积分。'],
      },
    ],
  },
  'step-04': {
    kicker: 'Dual Channel Skeleton',
    intro: '先把给定与扰动的进入位置钉死，再把四类传函一次并列：结构问题看共同分母，通道问题看不同分子和信号入口。',
    sections: [
      {
        title: '四类传函',
        tone: 'cyan',
        markdown:
          '$$\\Phi_r(s)=\\frac{C(s)}{R(s)}=\\frac{G_c(s)G_p(s)}{1+G_c(s)G_p(s)H(s)}$$\n$$\\Phi_d(s)=\\frac{C(s)}{D(s)}=\\frac{G_p(s)}{1+G_c(s)G_p(s)H(s)}$$\n$$\\frac{E_r(s)}{R(s)}=\\frac{1}{1+G_c(s)G_p(s)H(s)}$$\n$$\\frac{E_d(s)}{D(s)}=-\\frac{G_p(s)H(s)}{1+G_c(s)G_p(s)H(s)}$$',
      },
      {
        title: '总输出与总误差',
        tone: 'violet',
        markdown: '$$C(s)=\\Phi_r(s)R(s)+\\Phi_d(s)D(s)$$\n$$E(s)=E_r(s)+E_d(s)$$',
      },
      {
        title: '核心判断',
        tone: 'amber',
        bullets: ['分母相同反映结构。', '分子不同反映通道。', '先分通道，再谈稳态误差。'],
      },
    ],
  },
  'step-05': {
    kicker: 'Direct Path',
    intro: '终值定理直接求是通用路径。即使后面学了型别快判，遇到复合输入或显式扰动，最稳妥的动作仍然是稳定、列式、取极限三步走。',
    sections: [
      {
        title: '三步法',
        tone: 'emerald',
        bullets: ['先判稳定。', '写出误差传函。', '再做终值极限。'],
      },
      {
        title: '例题 1 题面与结果摘要',
        tone: 'slate',
        markdown:
          '$$G(s)=\\dfrac{K}{s^2(0.5s+1)}$$\n$$R(s)=\\dfrac{3}{s}+\\dfrac{2}{s^2}+\\dfrac{1}{s^3}$$\n\n本题最终稳态误差为 1/K。',
      },
    ],
  },
  'step-06': {
    kicker: 'Quick Check Boundary',
    intro: '型别和静态误差系数能显著加快标准给定输入问题，但快判有边界，显式扰动和双输入问题不能偷换成套表题。',
    sections: [
      {
        title: '型别与静态误差系数',
        tone: 'cyan',
        markdown:
          '$$G(s)H(s)=\\frac{K_0}{s^v}G_0(s),\\quad G_0(0)\\neq 0$$\n$$K_p=\\lim_{s\\to 0}G(s)H(s),\\quad K_v=\\lim_{s\\to 0}sG(s)H(s),\\quad K_a=\\lim_{s\\to 0}s^2G(s)H(s)$$',
      },
      {
        title: '型别与误差系数关系',
        tone: 'slate',
        markdown: '| 型别 | 首个有限误差系数 |\n| --- | --- |\n| 0 型 | K_p |\n| I 型 | K_v |\n| II 型 | K_a |',
      },
      {
        title: '型别与典型输入误差关系',
        tone: 'emerald',
        markdown:
          '| 输入类型 | 0 型 | I 型 | II 型 |\n| --- | --- | --- | --- |\n| 单位阶跃 | 有限 | 0 | 0 |\n| 单位斜坡 | ∞ | 有限 | 0 |\n| 单位抛物 | ∞ | ∞ | 有限 |',
      },
      {
        title: '边界提醒',
        tone: 'amber',
        bullets: ['标准给定输入优先快判。', '显式扰动问题优先直接求。', '判断是否必须积分时，先看型别。'],
      },
    ],
  },
  'step-07': {
    kicker: 'Dual-Input Example',
    intro: '例题 2 的目标不是再算一个数字，而是把“给定 + 扰动共同存在时不能只套表”这件事做成固定动作：先分通道，列总误差，再求极限。',
    sections: [
      {
        title: '题面卡',
        tone: 'slate',
        markdown:
          '$$G_1(s)=\\dfrac{5}{s+5},\\quad G_2(s)=\\dfrac{2}{s+2}$$\n$$R(s)=\\dfrac{1}{s},\\quad D(s)=\\dfrac{0.2}{s}$$',
      },
      {
        title: '总误差式与结果',
        tone: 'violet',
        markdown:
          '$$E(s)=\\frac{1}{1+G_1(s)G_2(s)}R(s)-\\frac{G_2(s)}{1+G_1(s)G_2(s)}D(s)$$\n\n结果固定为 $e_{ss}=0.4$。',
      },
    ],
  },
  'step-08': {
    kicker: 'Gain Vs Type',
    intro: '“误差变小”并不自动等于“误差归零”。先把压小有限误差和结构性归零分开，才能判断什么时候必须引入积分。',
    sections: [
      {
        title: '对照卡',
        tone: 'emerald',
        bullets: ['增益调节：压小有限误差，但不改变误差阶次。', '型别提高：可能把原本有限误差变成 0。'],
      },
      {
        title: '结论句',
        tone: 'amber',
        body: '想消除结构性误差，第一步不是继续调 K，而是判断是否必须引入积分。',
      },
    ],
  },
  'step-09': {
    kicker: 'Low-Frequency Compensation',
    intro: 'PI 与滞后都在低频补偿线上，但抓手不同：前者改型别，后者抬低频增益。收益和代价必须配套理解。',
    sections: [
      {
        title: '两条补偿路径',
        tone: 'cyan',
        markdown:
          '$$G_{PI}(s)=K\\left(1+\\frac{1}{T_i s}\\right)$$\n$$G_{lag}(s)=K\\frac{Ts+1}{\\beta Ts+1},\\ \\beta>1$$',
      },
      {
        title: '比较表',
        tone: 'slate',
        markdown:
          '| 路径 | 是否改型别 | 主要收益 | 主要代价 |\n| --- | --- | --- | --- |\n| PI | 是 | 改变误差阶次 | 相位滞后增加、响应变慢 |\n| 滞后 | 否 | 提高低频增益、压小有限误差 | 截止频率下降、速度受限 |',
      },
      {
        title: '禁止误判',
        tone: 'rose',
        bullets: ['不要把滞后简化成“弱一点的积分”。', '不要只记收益，不看代价落点。'],
      },
    ],
  },
  'step-10': {
    kicker: 'Time-Domain PI',
    intro: '时域 PI 设计必须按“题面 -> 纯增益局限 -> 可行域 -> PI 选点 -> 验证”顺序展开。关键不是把图看懂，而是先认清为什么纯增益不能把斜坡误差变为 0。',
    sections: [
      {
        title: '对象与目标',
        tone: 'slate',
        markdown:
          '$$G_p(s)=\\dfrac{4}{s(s+4)}$$\n\n目标：斜坡输入稳态误差为 0，$M_p\\le 20\\%$，$t_s(2\\%)\\le 12\\,\\mathrm{s}$。',
      },
      {
        title: '关键步骤',
        tone: 'violet',
        bullets: [
          '纯增益不能把斜坡误差变为 0。',
          '由时域指标换成可行域：阻尼比边界与实部边界同时成立。',
          '引入 PI 后，提高型别到 II 型，使斜坡误差从结构上归零。',
        ],
      },
    ],
  },
  'step-11': {
    kicker: 'Time-Domain Lag',
    intro: '时域滞后页必须独立承载“纯增益矛盾 -> 零极点相对位置 -> Kv 提升 -> 验证结果”。这里的核心句是：型别不变时，尽量把低频增益和中频动态分开安排。',
    sections: [
      {
        title: '对象与目标',
        tone: 'slate',
        markdown:
          '$$G_p(s)=\\dfrac{4}{s(s+4)}$$\n\n目标：保持 $M_p\\le 20\\%$、$t_s(2\\%)\\le 12\\,\\mathrm{s}$，同时使 $K_v\\ge 10$。',
      },
      {
        title: '关键步骤',
        tone: 'violet',
        bullets: [
          '纯增益若要满足 $K_v\\ge 10$，会先跌出阻尼边界。',
          '滞后通过“零点在左、极点在右”的结构，把低频增益单独抬高。',
          '型别不变时，尽量把低频增益和中频动态分开安排。',
        ],
      },
    ],
  },
  'step-12': {
    kicker: 'Time-Domain Compare',
    intro: '比较页只负责归纳，不再重复承载完整求解链。这里要把“斜坡误差为 0”和“型别不变但 Kv 提高”分别归到不同方法。',
    sections: [
      {
        title: '比较维度',
        tone: 'cyan',
        bullets: ['型别是否变化', '主要收益', '主要代价', '适用问题'],
      },
      {
        title: '结论句',
        tone: 'amber',
        body: 'PI 更偏结构性误差消除；滞后更偏在保留动态指标前提下抬高低频增益。',
      },
    ],
  },
  'step-13': {
    kicker: 'Frequency-Domain PI',
    intro: '频域 PI 设计的重点是顺序而不是答案：先判断纯增益不可能兼顾低频精度和相位裕度，再定截止频率、布置零点，最后由幅值条件求比例系数。',
    sections: [
      {
        title: '对象与目标',
        tone: 'slate',
        markdown:
          '$$G_p(s)=\\dfrac{4}{s(s+4)}$$\n\n目标：$K_v\\ge 10$，$PM\\ge 55^\\circ$，$\\omega_c\\approx 2.5\\,\\mathrm{rad/s}$。',
      },
      {
        title: '四步设计链',
        tone: 'violet',
        bullets: [
          '先判断纯增益不可能兼顾低频精度和相位裕度。',
          '先定目标截止频率，再把 PI 零点放在截止频率以下。',
          '由幅值条件求 K，并回查相位裕度、截止频率和时域指标。',
        ],
      },
    ],
  },
  'step-14': {
    kicker: 'Frequency-Domain PD Readout',
    intro: '本页明确是“方案读取与核验”，不是凭空补造讲义未给出的完整整定链。它的教学任务是把动态速度优先的证据读出来。',
    sections: [
      {
        title: '方案题面',
        tone: 'slate',
        markdown:
          '$$G_p(s)=\\dfrac{4}{s(s+4)}$$\n$$G_{PD}(s)=8(1+0.1s)$$',
      },
      {
        title: '核验结论',
        tone: 'violet',
        bullets: [
          '该方案仍为 I 型，因此斜坡误差有限非零。',
          '更高截止频率和更高相位裕度对应更快、更利落的动态形态。',
          '本方案代表动态速度优先，而不是低频精度优先。',
        ],
      },
    ],
  },
  'step-15': {
    kicker: 'Frequency-Domain Compare',
    intro: '频域比较页必须把低频精度、截止频率、相位裕度和时域形态统一到一张表里。PI 更偏低频精度优先，PD 更偏动态速度优先。',
    sections: [
      {
        title: '比较维度',
        tone: 'cyan',
        bullets: ['低频精度', '截止频率', '相位裕度', '时域形态', '设计取向'],
      },
      {
        title: '结论句',
        tone: 'amber',
        body: '二者不是“谁更高级”，而是对应不同设计取向：低频精度优先 vs 动态速度优先。',
      },
    ],
  },
  'step-16': {
    kicker: 'Post-Assessment',
    intro: '后测单独成页，只检查两件事：你会不会先选路径，再认方法与代价落点。每道题独立成卡，不再与总结合并。',
    sections: [
      {
        title: '错因标签',
        tone: 'rose',
        bullets: ['所有稳态误差都能套表。', 'PI 没有代价。', '滞后只是更弱积分。'],
      },
    ],
  },
  'step-17': {
    kicker: 'Wrap-Up And Next',
    intro: '收束页只承载工程视角、小结、规则表、信息图与 3-8 去向，不再混入任何后测题。',
    sections: [
      {
        title: '工程视角',
        tone: 'amber',
        body: '长期偏一点，整段航程都在付代价。工程上真正关心的是：误差来自哪里、该不该加积分、该用 PI 还是滞后，以及代价会被推向哪里。',
      },
      {
        title: '选用规则表',
        tone: 'slate',
        markdown:
          '| 当前问题 | 建议路径 | 关键提醒 |\n| --- | --- | --- |\n| 标准负反馈、只问典型给定输入稳态误差 | 优先快速判 | 先看型别，再看 $K_p/K_v/K_a$ |\n| 输入与扰动共同存在 | 优先直接求 | 先分通道，再做终值极限 |\n| 输入是多项式叠加 | 两条路径都可用 | 终值定理看全式，静态误差系数看保留分量 |\n| 目标是判断是否必须引入积分 | 先看型别 | 判断误差能否从结构上变成零 |',
      },
      {
        title: '下一课去向',
        tone: 'cyan',
        body: '3-8 将把低频收益和中频代价翻译成统一频域判断，并继续回答“更准”和“更快”如何一起被约束。',
      },
    ],
  },
};

interface RevealStepItem {
  title: string;
  markdown: string;
}

interface LowFrequencyStructureOption {
  key: 'pi' | 'lag' | 'lead';
  label: string;
  color: string;
  description: string;
  parameters: Record<string, number>;
  fallbackMagnitude: readonly CurvePoint[];
  fallbackPhase: readonly CurvePoint[];
}

const REVEAL_STEP_CONTENT: Record<string, readonly RevealStepItem[]> = {
  'step-05': [
    {
      title: '先选误差通道',
      markdown: '$$\\frac{E(s)}{R(s)}=\\frac{1}{1+G(s)}$$\n只要问稳态误差，就先写误差通道，而不是直接盯住输出通道。',
    },
    {
      title: '把输入写成统一拉氏形式',
      markdown: '$$R(s)=\\frac{3}{s}+\\frac{2}{s^2}+\\frac{1}{s^3}$$\n将常值、斜坡、抛物线三部分保留在同一个表达式中，避免中途丢项。',
    },
    {
      title: '使用终值定理',
      markdown: '$$e_{ss}=\\lim_{s\\to 0}sE(s)$$\n把 $E(s)=\\dfrac{R(s)}{1+G(s)}$ 代入后，再看哪一项在 $s\\to 0$ 时主导最终极限。',
    },
    {
      title: '解释结果为什么是 1/K',
      markdown: '本题最终由抛物线分量决定稳态误差，因此保留下来的结果是 **$e_{ss}=1/K$**。',
    },
  ],
  'step-07': [
    {
      title: '先把给定与扰动分通道',
      markdown:
        '$$\\Phi_r(s)=\\frac{G_1(s)G_2(s)}{1+G_1(s)G_2(s)},\\quad \\Phi_d(s)=\\frac{G_2(s)}{1+G_1(s)G_2(s)}$$\n同一个闭环里，给定和扰动必须各走各的通道。',
    },
    {
      title: '写总误差而不是套表',
      markdown:
        '$$E(s)=\\frac{1}{1+G_1(s)G_2(s)}R(s)-\\frac{G_2(s)}{1+G_1(s)G_2(s)}D(s)$$\n标准误差系数表只适合典型给定输入，不适合这里的双输入结构。',
    },
    {
      title: '分别代入输入信号',
      markdown: '$$R(s)=\\frac{1}{s},\\quad D(s)=\\frac{0.2}{s}$$\n把两部分一起带入，再通过同一个极限得到总稳态误差。',
    },
    {
      title: '得到结果并解释',
      markdown: '$$e_{ss}=0.4$$\n这个结果来自给定项与扰动项的共同作用，所以不能跳过总误差列式。',
    },
  ],
  'step-10': [
    {
      title: '先证明纯增益不够',
      markdown: '$$L_0(s)=\\frac{4K}{s(s+4)}$$\n纯增益只能改变数值大小，不能改变型别。',
    },
    {
      title: '说明斜坡误差不会被结构性消除',
      markdown: '$$K_v=K,\\quad e_{ss,\\mathrm{ramp}}=\\frac{1}{K}$$\n只调增益只能把有限误差压小，不能把它变成 0。',
    },
    {
      title: '把时域指标换成可行域',
      markdown:
        '$$\\zeta \\ge 0.456,\\quad \\sigma \\ge 0.333$$\n超调量与调节时间都要先翻译成可行域边界，再判断极点位置。',
    },
    {
      title: '引入 PI 结构',
      markdown:
        '$$G_{PI}(s)=\\frac{s+0.3}{s}$$\n增加积分极点，把系统型别提高到 II 型，同时保留一个实零点帮助动态指标回到可行域。',
    },
    {
      title: '解释零点选择',
      markdown: '零点取在 **-0.3**，目标是把低频精度提升与动态约束同时纳入同一套极点布局。',
    },
    {
      title: '完成结论',
      markdown: '结论不是“PI 更高级”，而是 **PI 先解决结构性误差归零，再检查动态代价是否还能接受**。',
    },
  ],
  'step-11': [
    {
      title: '写出纯增益约束',
      markdown: '$$K_v\\ge 10 \\Rightarrow K\\ge 10$$\n如果只靠纯增益，就会立刻把动态指标推向新的约束冲突。',
    },
    {
      title: '解释为什么会跌出阻尼边界',
      markdown: '$$\\zeta=\\frac{1}{\\sqrt{10}}\\approx 0.316$$\n这已经低于允许边界，所以纯增益方案不可取。',
    },
    {
      title: '引入滞后结构',
      markdown: '$$G_{lag}(s)=\\frac{s+0.2}{s+0.02}$$\n它不新增积分个数，而是在低频与中频之间重新分配增益。',
    },
    {
      title: '说明零极点相对位置',
      markdown: '零点在左、极点在右，目的是 **先抬低频增益，再尽量少动中频骨架**。',
    },
    {
      title: '得到静态指标',
      markdown: '$$K_v=10$$\n因此本页的重点不是型别提高，而是型别不变条件下的低频增益重分配。',
    },
    {
      title: '完成结论',
      markdown: '滞后校正的关键词是：**保留动态边界，抬高低频增益**。',
    },
  ],
  'step-13': [
    {
      title: '先比较纯增益两端的代价',
      markdown: '$$K\\ge 10 \\Rightarrow PM\\approx 34.9^\\circ$$\n满足低频精度时，相位裕度明显不足。',
    },
    {
      title: '再看保守增益',
      markdown: '$$K=4 \\Rightarrow PM\\approx 51.8^\\circ,\\ K_v=4$$\n若只顾裕量，低频精度又掉下来了。',
    },
    {
      title: '先定目标截止频率',
      markdown: '$$\\omega_c^\\ast=2.5\\,\\mathrm{rad/s}$$\n先把希望系统穿越的位置定下来，后续零点与增益都围绕它安排。',
    },
    {
      title: '再放 PI 零点',
      markdown: '$$\\omega_z=0.125\\,\\mathrm{rad/s}$$\n零点放在截止频率以下，是为了减小目标频带附近的附加相位滞后。',
    },
    {
      title: '由幅值条件求比例系数',
      markdown: '$$G_{PI}(s)=K\\frac{s+0.125}{s},\\quad K\\approx 2.94$$\n因此最终取 $G_{PI}(s)=3\\dfrac{s+0.125}{s}$。',
    },
    {
      title: '回查核验',
      markdown: '$$PM\\approx 54.8^\\circ,\\quad \\omega_c\\approx 2.54\\,\\mathrm{rad/s}$$\n低频精度、截止频率与相位裕度在这里一起被平衡。',
    },
  ],
  'step-14': [
    {
      title: '先读已给出的 PD 方案',
      markdown: '$$G_{PD}(s)=8(1+0.1s)$$\n本页不是重新整定，而是读取现成方案并做核验。',
    },
    {
      title: '写出频域指标',
      markdown: '$$PM_{PD}\\approx 64.9^\\circ,\\quad \\omega_{c,PD}\\approx 5.41\\,\\mathrm{rad/s}$$\n它对应更高的截止频率与更充足的相位裕度。',
    },
    {
      title: '保留型别判断',
      markdown: '$$K_{v,PD}=8$$\n该方案仍然是 I 型，所以斜坡误差仍是有限非零。',
    },
    {
      title: '联系时域现象',
      markdown: '更高的截止频率和相位裕度，通常对应更快、更利落的动态响应。',
    },
    {
      title: '给出设计取向',
      markdown: '因此本页要读出的结论是：**PD 更偏动态速度优先，而不是低频精度优先**。',
    },
  ],
};

const LOW_FREQUENCY_SAMPLE_POINTS = [0.01, 0.028, 0.078, 0.216, 0.602, 1.678, 4.673, 13.019, 36.267, 100] as const;

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function buildFallbackPhase(
  key: LowFrequencyStructureOption['key'],
  parameters: Record<string, number>,
): readonly CurvePoint[] {
  return LOW_FREQUENCY_SAMPLE_POINTS.map((omega) => {
    if (key === 'pi') {
      const ti = parameters.ti ?? 1;
      return { x: omega, y: toDegrees(-Math.atan(1 / (omega * ti))) };
    }
    if (key === 'lag') {
      const t = parameters.t ?? 1;
      const beta = parameters.beta ?? 10;
      return { x: omega, y: toDegrees(Math.atan(omega * t) - Math.atan(omega * beta * t)) };
    }
    const t = parameters.t ?? 1;
    const alpha = parameters.alpha ?? 0.1;
    return { x: omega, y: toDegrees(Math.atan(omega * t) - Math.atan(omega * alpha * t)) };
  });
}

const LOW_FREQUENCY_STRUCTURE_OPTIONS: readonly LowFrequencyStructureOption[] = [
  {
    key: 'pi',
    label: 'PI',
    color: '#0ea5e9',
    description: '通过积分提高型别，低频收益最强，但也会带来更多相位滞后。',
    parameters: { k: 1, ti: 1 },
    fallbackMagnitude: [
      { x: 0.01, y: 33.98 },
      { x: 0.028, y: 25.09 },
      { x: 0.078, y: 16.29 },
      { x: 0.216, y: 8.03 },
      { x: 0.602, y: 2.28 },
      { x: 1.678, y: 0.37 },
      { x: 4.673, y: 0.05 },
      { x: 13.019, y: 0.01 },
      { x: 36.267, y: 0.0 },
      { x: 100, y: 0.0 },
    ],
    fallbackPhase: buildFallbackPhase('pi', { k: 1, ti: 1 }),
  },
  {
    key: 'lag',
    label: '滞后',
    color: '#10b981',
    description: '型别不变，重点是把低频增益抬高，再尽量少动中频骨架。',
    parameters: { k: 1, t: 1, beta: 10 },
    fallbackMagnitude: [
      { x: 0.01, y: -0.96 },
      { x: 0.028, y: -4.6 },
      { x: 0.078, y: -11.45 },
      { x: 0.216, y: -17.35 },
      { x: 0.602, y: -19.55 },
      { x: 1.678, y: -19.94 },
      { x: 4.673, y: -19.99 },
      { x: 13.019, y: -20.0 },
      { x: 36.267, y: -20.0 },
      { x: 100, y: -20.0 },
    ],
    fallbackPhase: buildFallbackPhase('lag', { k: 1, t: 1, beta: 10 }),
  },
  {
    key: 'lead',
    label: '超前',
    color: '#f97316',
    description: '更偏中频相位与带宽改善，动态速度更积极，但不以低频误差归零为主。',
    parameters: { k: 1, t: 1, alpha: 0.1 },
    fallbackMagnitude: [
      { x: 0.01, y: 0.01 },
      { x: 0.028, y: 0.08 },
      { x: 0.078, y: 0.58 },
      { x: 0.216, y: 3.16 },
      { x: 0.602, y: 8.68 },
      { x: 1.678, y: 12.72 },
      { x: 4.673, y: 13.79 },
      { x: 13.019, y: 13.95 },
      { x: 36.267, y: 13.98 },
      { x: 100, y: 13.98 },
    ],
    fallbackPhase: buildFallbackPhase('lead', { k: 1, t: 1, alpha: 0.1 }),
  },
];

function getStepBlueprint(step: UNIT_3_7StepDefinition) {
  return STEP_BLUEPRINTS[step.id] ?? STEP_BLUEPRINTS['step-01'];
}

function renderMarkdown(markdown: string) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={MARKDOWN_COMPONENTS}>
      {markdown}
    </ReactMarkdown>
  );
}

function renderInlineMarkdown(markdown: string) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={INLINE_MARKDOWN_COMPONENTS}>
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
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      ) : null}
      {section.markdown ? <div className="mt-2">{renderMarkdown(section.markdown)}</div> : null}
    </div>
  );
}

function FormulaSection({
  title,
  markdown,
  tone = 'cyan',
}: {
  title: string;
  markdown: string;
  tone?: Tone;
}) {
  return (
    <div className={`premium-lesson-tone-block ${getToneClass(tone)} h-full`}>
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <div className="mt-2">{renderMarkdown(markdown)}</div>
    </div>
  );
}

function MathBlock({ expression }: { expression: string }) {
  return (
    <div className="[&_.katex-display]:m-0">
      <BlockMath math={expression} />
    </div>
  );
}

function MathCard({
  title,
  expression,
  tone = 'cyan',
  description,
}: {
  title: string;
  expression: string;
  tone?: Tone;
  description?: ReactNode;
}) {
  return (
    <div className={`premium-lesson-tone-block ${getToneClass(tone)} h-full`}>
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <div className="mt-3">
        <MathBlock expression={expression} />
      </div>
      {description ? <div className="mt-3 text-sm leading-7">{description}</div> : null}
    </div>
  );
}

function NativeTableCard({
  title,
  tone = 'slate',
  headers,
  rows,
}: {
  title: string;
  tone?: Tone;
  headers: ReactNode[];
  rows: ReactNode[][];
}) {
  return (
    <div className={`premium-lesson-tone-block ${getToneClass(tone)} h-full`}>
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-background/60">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-background/75">
            <tr>
              {headers.map((header, index) => (
                <th key={`${title}-header-${index}`} className="border-b border-border/60 px-3 py-2 font-medium text-foreground/80">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-cell-${rowIndex}-${cellIndex}`} className="border-b border-border/40 px-3 py-2 align-top text-foreground/85">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildLowFrequencyRequest(structureKey: LowFrequencyStructureOption['key']): ControlAnalysisRequest {
  const selected = LOW_FREQUENCY_STRUCTURE_OPTIONS.find((item) => item.key === structureKey) ?? LOW_FREQUENCY_STRUCTURE_OPTIONS[0];
  return {
    runtimeMode: 'analysis',
    caseId: UNIT_37_LOW_FREQUENCY_BODE_CASE_ID,
    plant: {
      numerator: [1],
      denominator: [1],
      coefficientOrder: 'descending',
      label: '低频补偿结构',
    },
    structures: [
      {
        kind: selected.key,
        enabled: true,
        params: selected.parameters,
        label: selected.label,
      },
    ],
    outputs: ['magnitude', 'phase'],
    timeRange: { start: 0, end: 10, samples: 240 },
    frequencyRange: { min: 1e-2, max: 1e2, samples: 240 },
    rootLocus: { minGain: 0, maxGain: 10, samples: 120, currentGain: 1 },
  };
}

function buildLowFrequencyFallbackResult(structureKey: LowFrequencyStructureOption['key']): ControlAnalysisResult {
  const selected = LOW_FREQUENCY_STRUCTURE_OPTIONS.find((item) => item.key === structureKey) ?? LOW_FREQUENCY_STRUCTURE_OPTIONS[0];
  return {
    metrics: {
      overshootPct: 0,
      riseTimeSec: null,
      settlingTimeSec: null,
      peakTimeSec: null,
      finalValue: 0,
      phaseMarginDeg: null,
      gainMarginDb: null,
      gainCrossoverRadPerSec: null,
      phaseCrossoverRadPerSec: null,
      bandwidthRadPerSec: null,
    },
    stepResponse: { points: [] },
    magnitude: { points: [...selected.fallbackMagnitude] },
    phase: { points: [...selected.fallbackPhase] },
    nyquist: { points: [] },
    rootLocus: {
      branches: [],
      currentPoles: [],
      openLoopPoles: [],
      openLoopZeros: [],
    },
    isFallback: true,
    fallbackMessage: '当前显示离线基线 Bode 曲线。',
  };
}

function useLowFrequencyAnalysis(structureKey: LowFrequencyStructureOption['key']) {
  const option = LOW_FREQUENCY_STRUCTURE_OPTIONS.find((item) => item.key === structureKey) ?? LOW_FREQUENCY_STRUCTURE_OPTIONS[0];
  const request = useMemo(() => buildLowFrequencyRequest(structureKey), [structureKey]);
  const fallbackResult = useMemo(() => buildLowFrequencyFallbackResult(structureKey), [structureKey]);
  const analysis = useControlEngine(request, fallbackResult);

  return {
    option,
    request,
    ...analysis,
  };
}

function ProgressiveRevealPanel({
  stepId,
  title = '逐步求解过程',
}: {
  stepId: string;
  title?: string;
}) {
  return <ProgressiveRevealPanelContent key={stepId} stepId={stepId} title={title} />;
}

function ProgressiveRevealPanelContent({
  stepId,
  title,
}: {
  stepId: string;
  title?: string;
}) {
  const steps = REVEAL_STEP_CONTENT[stepId] ?? [];
  const [revealedCount, setRevealedCount] = useState(0);
  const nextStep = steps[revealedCount];
  const canRevealMore = revealedCount < steps.length;

  if (!steps.length) {
    return null;
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-base font-semibold">{title}</div>
          <div className="premium-lesson-muted mt-1 text-sm">
            {nextStep ? `当前阅读焦点：${nextStep.title}` : '全部步骤已显影，可回看并串联整条求解链。'}
          </div>
          <div className="premium-lesson-caption mt-2 text-xs">点击当前步骤可继续显影下一层。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRevealedCount((count) => Math.min(count + 1, steps.length))}
            disabled={revealedCount >= steps.length}
            className="premium-lesson-action-primary disabled:opacity-40"
          >
            显示下一步
          </button>
          <button type="button" onClick={() => setRevealedCount(0)} className="premium-lesson-action-secondary">
            重置步骤
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {revealedCount === 0 ? (
          <button
            type="button"
            onClick={() => setRevealedCount(1)}
            className="premium-lesson-tone-block premium-tone-slate text-left text-sm"
          >
            题面已固定显示。点击此处或上方“显示下一步”，逐步展开求解链。
          </button>
        ) : null}
        {steps.slice(0, revealedCount).map((item, index) => (
          <button
            key={`${stepId}-${item.title}`}
            type="button"
            onClick={() => {
              if (index === revealedCount - 1 && canRevealMore) {
                setRevealedCount((count) => Math.min(count + 1, steps.length));
              }
            }}
            className={`premium-lesson-surface-elevated rounded-2xl px-4 py-4 text-left ${
              index === revealedCount - 1 && canRevealMore ? 'cursor-pointer ring-1 ring-cyan-400/40' : 'cursor-default'
            }`}
          >
            <div className="premium-lesson-kicker">步骤 {index + 1}</div>
            <div className="premium-lesson-title mt-1 text-sm font-semibold">{item.title}</div>
            <div className="mt-2">{renderMarkdown(item.markdown)}</div>
            {index === revealedCount - 1 && canRevealMore ? (
              <div className="premium-lesson-caption mt-3 text-xs">点击当前步骤可继续显影下一层。</div>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function LowFrequencyMagnitudeBoard() {
  const [selectedKeys, setSelectedKeys] = useState<Array<LowFrequencyStructureOption['key']>>(['pi', 'lag', 'lead']);
  const piAnalysis = useLowFrequencyAnalysis('pi');
  const lagAnalysis = useLowFrequencyAnalysis('lag');
  const leadAnalysis = useLowFrequencyAnalysis('lead');
  const analyses = [piAnalysis, lagAnalysis, leadAnalysis];
  const selectedAnalyses = analyses.filter((analysis) => selectedKeys.includes(analysis.option.key));
  const readyAnalyses = selectedAnalyses.filter((analysis) => Boolean(analysis.result)) as Array<
    (typeof selectedAnalyses)[number] & { result: ControlAnalysisResult }
  >;
  const comparisonOption = useMemo(
    () =>
      readyAnalyses.length > 1
        ? buildBodeComparisonOption(
            readyAnalyses.map((analysis) => ({
              label: analysis.option.label,
              color: analysis.option.color,
              result: analysis.result,
            })),
            UNIT_37_LOW_FREQUENCY_BODE_CASE_ID,
          )
        : null,
    [readyAnalyses],
  );
  const hasFallback = readyAnalyses.some((analysis) => analysis.result.isFallback);
  const combinedError = analyses.find((analysis) => analysis.error)?.error;
  const isLoading = selectedAnalyses.some((analysis) => analysis.isLoading) && !readyAnalyses.length;

  const toggleSelection = (key: LowFrequencyStructureOption['key']) => {
    setSelectedKeys((current) => {
      if (current.includes(key)) {
        return current.length === 1 ? current : current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  };

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(320px,0.78fr)]">
      <div className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4">
        <div className="premium-lesson-title text-base font-semibold">Bode 对比图</div>
        <div className="premium-lesson-muted mt-2 text-sm leading-7">
          幅频与相频放在同一频率轴下读取。单选时看单条结构，多选时直接叠加比较低频收益与中频代价。
        </div>
        <div className="mt-4">
          {!selectedAnalyses.length ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border/60 bg-background/70 px-6 text-sm text-foreground/70">
              请至少勾选一种补偿结构。
            </div>
          ) : selectedAnalyses.length === 1 && readyAnalyses[0]?.result ? (
            <BodePanel result={readyAnalyses[0].result} caseId={selectedAnalyses[0].request.caseId} />
          ) : comparisonOption ? (
            <ControlChartPanel
              title="组合 Bode 图"
              meta="实线读幅频，虚线读相频；上下共用同一频率轴。"
              option={comparisonOption}
              chartClassName="h-[420px]"
              isFallback={hasFallback}
              fallback="当前使用离线基线曲线。"
            />
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border/60 bg-background/70 px-6 text-sm text-foreground/70">
              {isLoading ? '正在生成 Bode 对比图。' : 'Bode 对比图暂不可用。'}
            </div>
          )}
        </div>
        {combinedError ? <div className="premium-lesson-muted mt-3 text-xs">{combinedError}</div> : null}
      </div>

      <div className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-base font-semibold">对比控制面板</div>
        <div className="premium-lesson-muted mt-1 text-sm">可多选叠加。先看低频端谁抬得更高，再看相频拖后或提前落在什么频段。</div>
        <div className="premium-lesson-tone-block premium-tone-amber mt-3 text-sm">
          读取口径：低频收益不等于没有代价，比较时务必同时看幅频抬升和相频变化。
        </div>
        <div className="mt-4 grid gap-3">
          {analyses.map((analysis) => (
            <label key={analysis.option.key} className="premium-lesson-surface-elevated flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-cyan-400"
                checked={selectedKeys.includes(analysis.option.key)}
                onChange={() => toggleSelection(analysis.option.key)}
              />
              <div>
                <div className="text-sm font-medium" style={{ color: analysis.option.color }}>{analysis.option.label}</div>
                <div className="premium-lesson-muted mt-1 text-sm">{analysis.option.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
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
    <textarea aria-label="稳态误差补偿学习记录"
      value={value}
      disabled={disabled}
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
  disabled = false,
}: {
  options: readonly ChoiceOption[];
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
          <span className="font-medium">{option.value}.</span> {renderInlineMarkdown(option.label)}
        </button>
      ))}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly ChoiceOption[];
  disabled?: boolean;
}) {
  return (
    <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="premium-lesson-select w-full">
      <option value="">请选择</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function getDefaultDraft(step: UNIT_3_7StepDefinition, savedResponse?: UNIT_3_7StepResponse) {
  if (savedResponse) {
    return savedResponse.answers;
  }

  switch (step.pageType) {
    case 'binary_choice':
      return { choice: '' };
    case 'quiz_group':
      return Object.fromEntries(PRETEST_QUESTIONS.map((question) => [question.key, '']));
    case 'quiz_card_grid':
      return Object.fromEntries(ASSESSMENT_CARD_FIELDS.map((question) => [question.key, '']));
    case 'hotspot_labeling':
      return Object.fromEntries(HOTSPOT_FIELDS.map((field) => [field.key, '']));
    case 'worked_example_workspace':
      return Object.fromEntries((WORKED_EXAMPLE_FIELDS[step.id] ?? []).map((field) => [field.key, '']));
    case 'activity_card_set':
      return Object.fromEntries((ACTIVITY_CARD_FIELDS[step.id] ?? []).map((field) => [field.key, '']));
    default:
      return {};
  }
}

function supportsAnswerReveal(step: UNIT_3_7StepDefinition) {
  return step.pageType !== 'display';
}

function trimText(value: string, max = 64) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function getDistribution(entries: string[]) {
  const counts = new Map<string, number>();
  for (const item of entries) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function getRevealMarkdown(step: UNIT_3_7StepDefinition) {
  switch (step.id) {
    case 'step-03':
      return PRETEST_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    case 'step-04':
      return '正确动作是：**先分给定入口、扰动入口、总输出和总误差的位置，再把四类传函对应回图中的信号通道。**';
    case 'step-05':
      return '三步法固定为：**先判稳定 -> 写误差传函 -> 再做终值极限**。';
    case 'step-06':
      return '快判只优先服务于**标准给定输入**；显式扰动和双输入问题仍要优先直接求。';
    case 'step-07':
      return '例题 2 的关键词是：**先分通道，再写总误差式，最后由终值定理得到 e_ss = 0.4**。';
    case 'step-08':
      return '正确判断是：**增益变大只能压小有限误差，结构性归零必须依赖型别提高。**';
    case 'step-09':
      return '总览页要同时看到收益和代价：**PI 负责改型别；滞后负责在型别不变时抬低频增益。**';
    case 'step-10':
      return '时域 PI 页的关键词：**纯增益不能把斜坡误差变为 0 -> 时域指标换可行域 -> PI 提高型别。**';
    case 'step-11':
      return '时域滞后页的关键词：**型别不变时，尽量把低频增益和中频动态分开安排。**';
    case 'step-12':
      return '比较页只负责归纳：**PI 更偏结构性归零，滞后更偏 Kv 提升与低频增益重分配。**';
    case 'step-13':
      return '频域 PI 设计顺序：**先判断纯增益不可能兼顾低频精度和相位裕度，再定截止频率、布置零点、由幅值条件求 K。**';
    case 'step-14':
      return 'PD 方案页的关键词：**该方案仍为 I 型，因此斜坡误差有限非零，但更偏动态速度优先。**';
    case 'step-15':
      return '频域比较页要同时看：**低频精度、截止频率、相位裕度和动态速度优先。**';
    case 'step-16':
      return POSTTEST_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    default:
      return '';
  }
}

function summarizeResponses(step: UNIT_3_7StepDefinition, responses: UNIT_3_7TeacherResponseItem[]) {
  switch (step.pageType) {
    case 'binary_choice':
      return getDistribution(responses.map((item) => item.response.answers.choice || '未作答'));
    case 'quiz_group':
    case 'quiz_card_grid':
      return getDistribution(
        responses.flatMap((item) =>
          Object.entries(item.response.answers)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}:${trimText(value)}`),
        ),
      );
    case 'hotspot_labeling':
    case 'worked_example_workspace':
    case 'activity_card_set':
      return responses.map((item) => [item.studentName, trimText(Object.values(item.response.answers).join(' / '))]);
    default:
      return [];
  }
}

function renderActivityCard(
  field: ActivityCardField,
  value: string,
  onChange: (value: string) => void,
  disabled = false,
) {
  if (field.inputKind === 'single_choice' && field.options) {
    return <ChoiceGroup options={field.options} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (field.inputKind === 'match' && field.options) {
    return <SelectField value={value} onChange={onChange} options={field.options} disabled={disabled} />;
  }
  return <TextInput value={value} onChange={onChange} placeholder={field.placeholder ?? field.prompt} disabled={disabled} />;
}

export function UNIT_3_7KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Map</div>
      <div className="premium-lesson-title mt-2 text-lg font-semibold">3-6 -&gt; 3-7 -&gt; 3-8</div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['3-6', '动态改善设计', '先解决“怎样更快更稳”。'],
          ['3-7', '稳态误差与低频补偿', '继续回答“为什么还能更准”。'],
          ['3-8', '频域判别语言', '把低频收益和中频代价翻成统一频域判断。'],
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

export function UNIT_3_7StepContentPanel({
  step,
  mediaSrc,
}: {
  step: UNIT_3_7StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);
  const renderDefaultBlueprint = () => {
    const validationLastSteps = new Set(['step-17']);
    const showMediaFirst = Boolean(mediaSrc) && !validationLastSteps.has(step.id);
    const showMediaLast = Boolean(mediaSrc) && validationLastSteps.has(step.id);

    return (
      <>
        {showMediaFirst && mediaSrc ? (
          <div className="mt-4">
            <MediaPanel src={mediaSrc} alt={step.title} />
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {blueprint.sections.map((section) => (
            <InfoSection key={`${step.id}-${section.title}`} section={section} />
          ))}
        </div>

        {showMediaLast && mediaSrc ? (
          <div className="mt-4">
            <MediaPanel src={mediaSrc} alt={step.title} />
          </div>
        ) : null}
      </>
    );
  };

  const renderStructuredContent = () => {
    switch (step.id) {
      case 'step-04':
        return (
          <>
            {mediaSrc ? (
              <div className="mt-4">
                <MediaPanel src={mediaSrc} alt={step.title} />
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <MathCard
                title="给定到输出传函"
                expression="\Phi_r(s)=\frac{C(s)}{R(s)}=\frac{G_c(s)G_p(s)}{1+G_c(s)G_p(s)H(s)}"
              />
              <MathCard
                title="扰动到输出传函"
                expression="\Phi_d(s)=\frac{C(s)}{D(s)}=\frac{G_p(s)}{1+G_c(s)G_p(s)H(s)}"
              />
              <MathCard
                title="给定到误差传函"
                expression="\frac{E_r(s)}{R(s)}=\frac{1}{1+G_c(s)G_p(s)H(s)}"
                tone="violet"
              />
              <MathCard
                title="扰动到误差传函"
                expression="\frac{E_d(s)}{D(s)}=-\frac{G_p(s)H(s)}{1+G_c(s)G_p(s)H(s)}"
                tone="violet"
              />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
              <div className={`premium-lesson-tone-block ${getToneClass('emerald')} h-full`}>
                <div className="premium-lesson-title text-sm font-semibold">总输出与总误差</div>
                <div className="mt-3 grid gap-3">
                  <MathBlock expression="C(s)=\Phi_r(s)R(s)+\Phi_d(s)D(s)" />
                  <MathBlock expression="E(s)=E_r(s)+E_d(s)" />
                </div>
              </div>
              <InfoSection
                section={{
                  title: '通道判断口令',
                  tone: 'amber',
                  bullets: ['先看当前在求输出还是误差。', '再看信号是从给定入口还是扰动入口进入。', '分母相同反映结构，分子不同反映通道。'],
                }}
              />
            </div>
          </>
        );
      case 'step-05':
        return (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <MathCard
                title="终值定理公式"
                expression="e_{ss}=\lim_{s\to 0}sE(s)"
                description="先判闭环稳定，再决定这个极限是否有意义。"
              />
              <InfoSection
                section={{
                  title: '三步法文案',
                  tone: 'emerald',
                  bullets: ['先判闭环稳定。', '再写所关心通道的误差传递函数。', '最后代入输入并取终值极限。'],
                }}
              />
            </div>
            <div className="mt-4">
              <div className={`premium-lesson-tone-block ${getToneClass('slate')}`}>
                <div className="premium-lesson-title text-sm font-semibold">例题 1 题面</div>
                <div className="mt-3 grid gap-3">
                  <MathBlock expression="G(s)=\dfrac{K}{s^2(0.5s+1)}" />
                  <MathBlock expression="R(s)=\dfrac{3}{s}+\dfrac{2}{s^2}+\dfrac{1}{s^3}" />
                </div>
                <p className="mt-3 text-sm leading-7">求系统的稳态误差，并判断最终保留下来的主导项。</p>
              </div>
            </div>
            <div className="mt-4">
              <ProgressiveRevealPanel stepId="step-05" />
            </div>
          </>
        );
      case 'step-06':
        return (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <MathCard
                title="开环低频结构与判断口令"
                expression="G(s)H(s)=\frac{K_0}{s^v}G_0(s),\quad G_0(0)\neq 0"
                description="先看积分个数，再决定是否可能把某类稳态误差结构性变成 0。"
                tone="cyan"
              />
              <div className={`premium-lesson-tone-block ${getToneClass('violet')} h-full`}>
                <div className="premium-lesson-title text-sm font-semibold">三个静态误差系数</div>
                <div className="mt-3 grid gap-3">
                  <MathBlock expression="K_p=\lim_{s\to 0}G(s)H(s)" />
                  <MathBlock expression="K_v=\lim_{s\to 0}sG(s)H(s)" />
                  <MathBlock expression="K_a=\lim_{s\to 0}s^2G(s)H(s)" />
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <NativeTableCard
                title="表 2｜各型别系统的静态误差系数"
                tone="slate"
                headers={['型别', '首个有限误差系数']}
                rows={[
                  ['0 型', <InlineMath key="kp" math="K_p" />],
                  ['I 型', <InlineMath key="kv" math="K_v" />],
                  ['II 型', <InlineMath key="ka" math="K_a" />],
                ]}
              />
              <NativeTableCard
                title="表 3｜各型别系统对典型输入的稳态误差"
                tone="emerald"
                headers={['输入类型', '0 型', 'I 型', 'II 型']}
                rows={[
                  ['单位阶跃', '有限', '0', '0'],
                  ['单位斜坡', <InlineMath key="inf01" math="\infty" />, '有限', '0'],
                  ['单位抛物', <InlineMath key="inf02" math="\infty" />, <InlineMath key="inf03" math="\infty" />, '有限'],
                ]}
              />
            </div>
            <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">
              标准给定输入可以优先快判；显式扰动和双输入问题必须先回到通道列式。
            </div>
          </>
        );
      case 'step-07':
        return (
          <>
            <div className="mt-4">
              <div className={`premium-lesson-tone-block ${getToneClass('slate')}`}>
                <div className="premium-lesson-title text-sm font-semibold">问题文案</div>
                <p className="mt-3 text-sm leading-7">
                  已知 <InlineMath math="G_1(s)" /> 为执行机构，<InlineMath math="G_2(s)" /> 为被控对象，扰动加在两者之间。求给定与扰动共同作用时的总稳态误差。
                </p>
              </div>
            </div>
            {mediaSrc ? (
              <div className="mt-4">
                <MediaPanel src={mediaSrc} alt={step.title} />
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <MathCard
                title="系统传函"
                expression="G_1(s)=\dfrac{5}{s+5},\quad G_2(s)=\dfrac{2}{s+2}"
                tone="slate"
              />
              <MathCard
                title="输入信号"
                expression="R(s)=\dfrac{1}{s},\quad D(s)=\dfrac{0.2}{s}"
                tone="emerald"
              />
            </div>
            <div className="mt-4">
              <ProgressiveRevealPanel stepId="step-07" title="例题 2 求解过程" />
            </div>
          </>
        );
      case 'step-09':
        return (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <MathCard
                title="PI 控制器"
                expression="G_{PI}(s)=K\left(1+\frac{1}{T_i s}\right)=K\frac{T_i s+1}{T_i s}"
              />
              <MathCard
                title="一级滞后校正"
                expression="G_{lag}(s)=K\frac{Ts+1}{\beta Ts+1},\ \beta>1"
                tone="emerald"
              />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <InfoSection
                section={{
                  title: '低频补偿文案',
                  tone: 'slate',
                  bullets: ['PI 通过新增积分极点提高型别。', '滞后不改型别，而是把低频增益抬高。', '超前更偏向目标频带的相位与速度补偿。'],
                }}
              />
              <InfoSection
                section={{
                  title: '阅读提醒',
                  tone: 'amber',
                  bullets: ['先看公式与结构抓手。', '再看幅频特性曲线。', '最后回到比较表和误判点。'],
                }}
              />
            </div>
            <LowFrequencyMagnitudeBoard />
            <div className="mt-4">
              <NativeTableCard
                title="比较表"
                tone="slate"
                headers={['路径', '型别是否变化', '主要收益', '主要代价', '更像哪条设计线']}
                rows={[
                  ['PI', '是', '结构性改善低频误差', '相位滞后增加、响应变慢', '精度优先'],
                  ['滞后', '否', '压小有限误差、抬低频增益', '截止频率下降', '折中提精度'],
                  ['超前', '否', '提高相位裕度、利于更快动态', '不以低频归零为主', '速度优先'],
                ]}
              />
            </div>
            <div className="premium-lesson-tone-block premium-tone-rose mt-4 text-sm">
              误判点：不要把滞后理解成“弱积分”，也不要把超前误判成“另一种低频补偿”。
            </div>
          </>
        );
      case 'step-16':
        return (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
              <div className="premium-lesson-tone-block premium-tone-cyan h-full">
                <div className="premium-lesson-kicker">Post-Assessment</div>
                <div className="premium-lesson-title mt-2 text-lg font-semibold">后测：路径选择与方法判断</div>
                <p className="mt-3 text-sm leading-7">
                  本页只检查两件事：是否会先选分析路径，以及是否能辨认 PI、滞后与动态速度优先方案的收益和代价落点。
                </p>
              </div>
              <div className="grid gap-4">
                {blueprint.sections.map((section) => (
                  <InfoSection key={`${step.id}-${section.title}`} section={section} />
                ))}
              </div>
            </div>
          </>
        );
      case 'step-10':
      case 'step-11':
      case 'step-13':
      case 'step-14':
        return (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {blueprint.sections.map((section) => (
                <InfoSection key={`${step.id}-${section.title}`} section={section} />
              ))}
            </div>
            <div className="mt-4">
              <ProgressiveRevealPanel stepId={step.id} />
            </div>
            {mediaSrc ? (
              <div className="mt-4">
                <MediaPanel src={mediaSrc} alt={step.title} />
              </div>
            ) : null}
          </>
        );
      case 'step-12':
      case 'step-15':
        return (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              {blueprint.sections.map((section) => (
                <InfoSection key={`${step.id}-${section.title}`} section={section} />
              ))}
            </div>
            <div className="mt-4">
              <FormulaSection
                title={step.id === 'step-12' ? '时域比较表' : '频域比较表'}
                markdown={
                  step.id === 'step-12'
                    ? '| 方法 | 主要收益 | 主要代价 | 适用场景 |\n| --- | --- | --- | --- |\n| PI | 提高型别，斜坡误差可归零 | 引入额外相位滞后 | 结构性误差消除 |\n| 滞后 | 型别不变时抬低频增益 | 带宽下降、速度受限 | 先保动态，再提精度 |'
                    : '| 方法 | 低频精度 | 截止频率 | 相位裕度 | 设计取向 |\n| --- | --- | --- | --- | --- |\n| PI | 更强，可把斜坡误差归零 | 较低 | 中等 | 低频精度优先 |\n| PD | 保留有限斜坡误差 | 更高 | 更高 | 动态速度优先 |'
                }
                tone="slate"
              />
            </div>
          </>
        );
      default:
        return renderDefaultBlueprint();
    }
  };

  return (
    <section className="premium-lesson-panel px-5 py-5">
      <div className="premium-lesson-kicker">{blueprint.kicker}</div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm leading-7 sm:text-base">{blueprint.intro}</p>

      {renderStructuredContent()}

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

export function UNIT_3_7StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  readOnly = false,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_7StepDefinition;
  savedResponse?: UNIT_3_7StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_7StepResponse) => void;
  readOnly?: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
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
  const locked = !released && !submitted && step.pageType !== 'display';
  const revealMarkdown = getRevealMarkdown(step);

  const updateDraft = (key: string, value: string, source = 'student') => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    onWorkspaceParameterChange?.({ key, value, source });
  };

  const submit = (answers: Record<string, string> = draft) => {
    commitStudentResponse({
      stepId: step.id,
      submittedAt: Date.now(),
      answers,
    });
  };

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
                { value: 'A', label: '只要把增益调大，I 型系统的斜坡误差总能变成 0' },
                { value: 'B', label: '若型别不变，斜坡误差最多被压小，不能结构性归零' },
              ]}
              value={draft.choice ?? ''}
              onChange={(value) => updateDraft('choice', value)}
            />
          ) : null}

          {step.pageType === 'quiz_group' ? (
            PRETEST_QUESTIONS.map((question) => (
              <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                <div className="mt-3">
                  <ChoiceGroup disabled={Boolean(readOnly)} options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} />
                </div>
              </div>
            ))
          ) : null}

          {step.pageType === 'quiz_card_grid' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {ASSESSMENT_CARD_FIELDS.map((question) => (
                <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                  <div className="mt-3">
                    <ChoiceGroup disabled={Boolean(readOnly)} options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} />
                  </div>
                  <button type="button" disabled={Boolean(readOnly)} onClick={() => submit({ ...draft, [question.key]: draft[question.key] ?? '' })} className="premium-lesson-action-secondary mt-4">
                    提交答案
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'hotspot_labeling' ? (
            HOTSPOT_FIELDS.map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <TextInput disabled={Boolean(readOnly)} value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={`写出图中对应的 ${field.label} 位置说明`} />
                </div>
              </div>
            ))
          ) : null}

          {step.pageType === 'worked_example_workspace' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(WORKED_EXAMPLE_FIELDS[step.id] ?? []).map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="mt-3">{renderActivityCard(field, draft[field.key] ?? '', (value) => updateDraft(field.key, value), Boolean(readOnly))}</div>
                  <button
                    type="button" disabled={Boolean(readOnly)}
                    onClick={() => submit({ ...draft, [field.key]: draft[field.key] ?? '' })}
                    className="premium-lesson-action-secondary mt-4"
                  >
                    提交答案
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'activity_card_set' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(ACTIVITY_CARD_FIELDS[step.id] ?? []).map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="mt-3">{renderActivityCard(field, draft[field.key] ?? '', (value) => updateDraft(field.key, value), Boolean(readOnly))}</div>
                  <button
                    type="button" disabled={Boolean(readOnly)}
                    onClick={() => submit({ ...draft, [field.key]: draft[field.key] ?? '' })}
                    className="premium-lesson-action-secondary mt-4"
                  >
                    提交答案
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'quiz_group' || step.pageType === 'binary_choice' || step.pageType === 'hotspot_labeling' ? (
            <button type="button" disabled={Boolean(readOnly)} onClick={() => submit()} className="premium-lesson-action-primary">
              {submitted ? '重新提交本页作答' : '提交本页作答'}
            </button>
          ) : null}
        </div>
      )}

      <div className="mt-4">
        <SubmissionStatus
          submitted={submitted}
          submittedText="已提交本页作答，教师端将看到你的当前答案。"
          idleText={readOnly ? '演示模式仅本机预览，不会同步到教师端汇总。' : '尚未提交本页作答。'}
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

export function UNIT_3_7TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_3_7StepDefinition;
  responses: UNIT_3_7TeacherResponseItem[];
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
          <div className="premium-lesson-muted mt-1 text-sm">已收集 {responses.length} 份学生作答。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
            {released ? '撤回互动' : '释放互动'}
          </button>
          <button type="button" onClick={onToggleAnswerVisible} disabled={!canReveal} className="premium-lesson-action-primary disabled:opacity-40">
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

export function UNIT_3_7StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_3_7StepResponse>;
}) {
  const completed = Object.keys(responses).length;
  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-lg font-semibold">学习收束</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已经提交了 {completed} 个环节的作答。本课真正要带走的不是一张 Kp/Kv/Ka 表，而是一条稳定的判断链：先分通道，再选路径，再识别低频收益和代价。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          '稳态误差先分通道，再谈快判。',
          '终值定理是通用路径。',
          '增益变大不等于型别提高。',
          'PI 与滞后都在低频线上，但都不是免费午餐。',
        ].map((item) => (
          <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
