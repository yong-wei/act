'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
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

interface CurvePoint {
  w: number;
  mag: number;
}

interface CurveSeries {
  key: 'pi' | 'lag' | 'lead';
  label: string;
  color: string;
  description: string;
  points: readonly CurvePoint[];
}

const REVEAL_STEP_CONTENT: Record<string, readonly RevealStepItem[]> = {
  'step-05': [
    {
      title: '第 1 步：先选误差通道',
      markdown: '$$\\frac{E(s)}{R(s)}=\\frac{1}{1+G(s)}$$\n只要问稳态误差，就先写误差通道，而不是直接盯住输出通道。',
    },
    {
      title: '第 2 步：把输入写成统一拉氏形式',
      markdown: '$$R(s)=\\frac{3}{s}+\\frac{2}{s^2}+\\frac{1}{s^3}$$\n将常值、斜坡、抛物线三部分保留在同一个表达式中，避免中途丢项。',
    },
    {
      title: '第 3 步：使用终值定理',
      markdown: '$$e_{ss}=\\lim_{s\\to 0}sE(s)$$\n把 $E(s)=\\dfrac{R(s)}{1+G(s)}$ 代入后，再看哪一项在 $s\\to 0$ 时主导最终极限。',
    },
    {
      title: '第 4 步：解释结果为什么是 1/K',
      markdown: '本题最终由抛物线分量决定稳态误差，因此保留下来的结果是 **$e_{ss}=1/K$**。',
    },
  ],
  'step-07': [
    {
      title: '第 1 步：先把给定与扰动分通道',
      markdown:
        '$$\\Phi_r(s)=\\frac{G_1(s)G_2(s)}{1+G_1(s)G_2(s)},\\quad \\Phi_d(s)=\\frac{G_2(s)}{1+G_1(s)G_2(s)}$$\n同一个闭环里，给定和扰动必须各走各的通道。',
    },
    {
      title: '第 2 步：写总误差而不是套表',
      markdown:
        '$$E(s)=\\frac{1}{1+G_1(s)G_2(s)}R(s)-\\frac{G_2(s)}{1+G_1(s)G_2(s)}D(s)$$\n标准误差系数表只适合典型给定输入，不适合这里的双输入结构。',
    },
    {
      title: '第 3 步：分别代入输入信号',
      markdown: '$$R(s)=\\frac{1}{s},\\quad D(s)=\\frac{0.2}{s}$$\n把两部分一起带入，再通过同一个极限得到总稳态误差。',
    },
    {
      title: '第 4 步：得到结果并解释',
      markdown: '$$e_{ss}=0.4$$\n这个结果来自给定项与扰动项的共同作用，所以不能跳过总误差列式。',
    },
  ],
  'step-10': [
    {
      title: '第 1 步：先证明纯增益不够',
      markdown: '$$L_0(s)=\\frac{4K}{s(s+4)}$$\n纯增益只能改变数值大小，不能改变型别。',
    },
    {
      title: '第 2 步：说明斜坡误差不会被结构性消除',
      markdown: '$$K_v=K,\\quad e_{ss,\\mathrm{ramp}}=\\frac{1}{K}$$\n只调增益只能把有限误差压小，不能把它变成 0。',
    },
    {
      title: '第 3 步：把时域指标换成可行域',
      markdown:
        '$$\\zeta \\ge 0.456,\\quad \\sigma \\ge 0.333$$\n超调量与调节时间都要先翻译成可行域边界，再判断极点位置。',
    },
    {
      title: '第 4 步：引入 PI 结构',
      markdown:
        '$$G_{PI}(s)=\\frac{s+0.3}{s}$$\n增加积分极点，把系统型别提高到 II 型，同时保留一个实零点帮助动态指标回到可行域。',
    },
    {
      title: '第 5 步：解释零点选择',
      markdown: '零点取在 **-0.3**，目标是把低频精度提升与动态约束同时纳入同一套极点布局。',
    },
    {
      title: '第 6 步：完成结论',
      markdown: '结论不是“PI 更高级”，而是 **PI 先解决结构性误差归零，再检查动态代价是否还能接受**。',
    },
  ],
  'step-11': [
    {
      title: '第 1 步：写出纯增益约束',
      markdown: '$$K_v\\ge 10 \\Rightarrow K\\ge 10$$\n如果只靠纯增益，就会立刻把动态指标推向新的约束冲突。',
    },
    {
      title: '第 2 步：解释为什么会跌出阻尼边界',
      markdown: '$$\\zeta=\\frac{1}{\\sqrt{10}}\\approx 0.316$$\n这已经低于允许边界，所以纯增益方案不可取。',
    },
    {
      title: '第 3 步：引入滞后结构',
      markdown: '$$G_{lag}(s)=\\frac{s+0.2}{s+0.02}$$\n它不新增积分个数，而是在低频与中频之间重新分配增益。',
    },
    {
      title: '第 4 步：说明零极点相对位置',
      markdown: '零点在左、极点在右，目的是 **先抬低频增益，再尽量少动中频骨架**。',
    },
    {
      title: '第 5 步：得到静态指标',
      markdown: '$$K_v=10$$\n因此本页的重点不是型别提高，而是型别不变条件下的低频增益重分配。',
    },
    {
      title: '第 6 步：完成结论',
      markdown: '滞后校正的关键词是：**保留动态边界，抬高低频增益**。',
    },
  ],
  'step-13': [
    {
      title: '第 1 步：先比较纯增益两端的代价',
      markdown: '$$K\\ge 10 \\Rightarrow PM\\approx 34.9^\\circ$$\n满足低频精度时，相位裕度明显不足。',
    },
    {
      title: '第 2 步：再看保守增益',
      markdown: '$$K=4 \\Rightarrow PM\\approx 51.8^\\circ,\\ K_v=4$$\n若只顾裕量，低频精度又掉下来了。',
    },
    {
      title: '第 3 步：先定目标截止频率',
      markdown: '$$\\omega_c^\\ast=2.5\\,\\mathrm{rad/s}$$\n先把希望系统穿越的位置定下来，后续零点与增益都围绕它安排。',
    },
    {
      title: '第 4 步：再放 PI 零点',
      markdown: '$$\\omega_z=0.125\\,\\mathrm{rad/s}$$\n零点放在截止频率以下，是为了减小目标频带附近的附加相位滞后。',
    },
    {
      title: '第 5 步：由幅值条件求比例系数',
      markdown: '$$G_{PI}(s)=K\\frac{s+0.125}{s},\\quad K\\approx 2.94$$\n因此最终取 $G_{PI}(s)=3\\dfrac{s+0.125}{s}$。',
    },
    {
      title: '第 6 步：回查核验',
      markdown: '$$PM\\approx 54.8^\\circ,\\quad \\omega_c\\approx 2.54\\,\\mathrm{rad/s}$$\n低频精度、截止频率与相位裕度在这里一起被平衡。',
    },
  ],
  'step-14': [
    {
      title: '第 1 步：先读已给出的 PD 方案',
      markdown: '$$G_{PD}(s)=8(1+0.1s)$$\n本页不是重新整定，而是读取现成方案并做核验。',
    },
    {
      title: '第 2 步：写出频域指标',
      markdown: '$$PM_{PD}\\approx 64.9^\\circ,\\quad \\omega_{c,PD}\\approx 5.41\\,\\mathrm{rad/s}$$\n它对应更高的截止频率与更充足的相位裕度。',
    },
    {
      title: '第 3 步：保留型别判断',
      markdown: '$$K_{v,PD}=8$$\n该方案仍然是 I 型，所以斜坡误差仍是有限非零。',
    },
    {
      title: '第 4 步：联系时域现象',
      markdown: '更高的截止频率和相位裕度，通常对应更快、更利落的动态响应。',
    },
    {
      title: '第 5 步：给出设计取向',
      markdown: '因此本页要读出的结论是：**PD 更偏动态速度优先，而不是低频精度优先**。',
    },
  ],
};

const LOW_FREQUENCY_CURVES: readonly CurveSeries[] = [
  {
    key: 'pi',
    label: 'PI 幅频特性',
    color: '#0ea5e9',
    description: '低频增益显著抬高，本质是通过积分提高型别。',
    points: [
      { w: 0.01, mag: 33.98 },
      { w: 0.028, mag: 25.09 },
      { w: 0.078, mag: 16.29 },
      { w: 0.216, mag: 8.03 },
      { w: 0.602, mag: 2.28 },
      { w: 1.678, mag: 0.37 },
      { w: 4.673, mag: 0.05 },
      { w: 13.019, mag: 0.01 },
      { w: 36.267, mag: 0.0 },
      { w: 100, mag: 0.0 },
    ],
  },
  {
    key: 'lag',
    label: '滞后幅频特性',
    color: '#10b981',
    description: '型别不变，但把低频增益整体抬高，中频以后快速贴回去。',
    points: [
      { w: 0.01, mag: -0.96 },
      { w: 0.028, mag: -4.6 },
      { w: 0.078, mag: -11.45 },
      { w: 0.216, mag: -17.35 },
      { w: 0.602, mag: -19.55 },
      { w: 1.678, mag: -19.94 },
      { w: 4.673, mag: -19.99 },
      { w: 13.019, mag: -20.0 },
      { w: 36.267, mag: -20.0 },
      { w: 100, mag: -20.0 },
    ],
  },
  {
    key: 'lead',
    label: '超前幅频特性',
    color: '#f97316',
    description: '更强调中频附近的相位与带宽改善，不以低频误差归零为主。',
    points: [
      { w: 0.01, mag: 0.01 },
      { w: 0.028, mag: 0.08 },
      { w: 0.078, mag: 0.58 },
      { w: 0.216, mag: 3.16 },
      { w: 0.602, mag: 8.68 },
      { w: 1.678, mag: 12.72 },
      { w: 4.673, mag: 13.79 },
      { w: 13.019, mag: 13.95 },
      { w: 36.267, mag: 13.98 },
      { w: 100, mag: 13.98 },
    ],
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

function ProgressiveRevealPanel({
  stepId,
  title = '逐步求解过程',
}: {
  stepId: string;
  title?: string;
}) {
  const steps = REVEAL_STEP_CONTENT[stepId] ?? [];
  const [revealedCount, setRevealedCount] = useState(0);
  const nextStep = steps[revealedCount];

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
          <div className="premium-lesson-tone-block premium-tone-slate text-sm">题面已固定显示，点击“显示下一步”后逐步展开求解链。</div>
        ) : null}
        {steps.slice(0, revealedCount).map((item, index) => (
          <div key={`${stepId}-${item.title}`} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
            <div className="premium-lesson-kicker">步骤 {index + 1}</div>
            <div className="premium-lesson-title mt-1 text-sm font-semibold">{item.title}</div>
            <div className="mt-2">{renderMarkdown(item.markdown)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LowFrequencyMagnitudeBoard() {
  const [visibleKeys, setVisibleKeys] = useState<Array<CurveSeries['key']>>(['pi', 'lag', 'lead']);
  const selectedSeries = LOW_FREQUENCY_CURVES.filter((series) => visibleKeys.includes(series.key));
  const width = 540;
  const height = 280;
  const padding = 28;

  const getX = (w: number) => {
    const min = Math.log10(0.01);
    const max = Math.log10(100);
    return padding + ((Math.log10(w) - min) / (max - min)) * (width - padding * 2);
  };

  const getY = (mag: number) => {
    const min = -22;
    const max = 36;
    return height - padding - ((mag - min) / (max - min)) * (height - padding * 2);
  };

  const toggleSeries = (key: CurveSeries['key']) => {
    setVisibleKeys((prev) => {
      if (prev.includes(key)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== key);
      }
      return [...prev, key];
    });
  };

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
        <div className="premium-lesson-title text-base font-semibold">幅频特性</div>
        <div className="premium-lesson-muted mt-1 text-sm">左图只负责读幅值随频率变化的趋势，不再在图里重复堆放说明文字。</div>
        <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-auto w-full">
          <rect x="0" y="0" width={width} height={height} rx="18" fill="rgba(15,23,42,0.18)" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.35)" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.35)" />
          {[0.01, 0.1, 1, 10, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={getX(tick)}
                y1={padding}
                x2={getX(tick)}
                y2={height - padding}
                stroke="rgba(255,255,255,0.12)"
              />
              <text x={getX(tick)} y={height - 8} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.75)">
                {tick}
              </text>
            </g>
          ))}
          {[-20, -10, 0, 10, 20, 30].map((tick) => (
            <g key={tick}>
              <line
                x1={padding}
                y1={getY(tick)}
                x2={width - padding}
                y2={getY(tick)}
                stroke="rgba(255,255,255,0.12)"
              />
              <text x={8} y={getY(tick) + 4} fontSize="11" fill="rgba(255,255,255,0.75)">
                {tick}
              </text>
            </g>
          ))}
          {selectedSeries.map((series) => (
            <path
              key={series.key}
              d={series.points
                .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(point.w)} ${getY(point.mag)}`)
                .join(' ')}
              fill="none"
              stroke={series.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>

      <div className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-base font-semibold">幅频特性切换</div>
        <div className="premium-lesson-muted mt-1 text-sm">默认勾选即为叠加显示；若只保留一项，就是单独显示该类幅频特性。</div>
        <div className="premium-lesson-tone-block premium-tone-amber mt-3 text-sm">叠加显示用于比较三类补偿的低频抓手，不再把图中文字塞回曲线区域。</div>
        <div className="mt-4 grid gap-3">
          {LOW_FREQUENCY_CURVES.map((series) => (
            <label key={series.key} className="premium-lesson-surface-elevated flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-cyan-400"
                checked={visibleKeys.includes(series.key)}
                onChange={() => toggleSeries(series.key)}
              />
              <div>
                <div className="text-sm font-medium">{series.label}</div>
                <div className="premium-lesson-muted mt-1 text-sm">{series.description}</div>
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
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
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
) {
  if (field.inputKind === 'single_choice' && field.options) {
    return <ChoiceGroup options={field.options} value={value} onChange={onChange} />;
  }
  if (field.inputKind === 'match' && field.options) {
    return <SelectField value={value} onChange={onChange} options={field.options} />;
  }
  return <TextInput value={value} onChange={onChange} placeholder={field.placeholder ?? field.prompt} />;
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
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormulaSection
                title="给定到输出传函"
                markdown="$$\\Phi_r(s)=\\frac{C(s)}{R(s)}=\\frac{G_c(s)G_p(s)}{1+G_c(s)G_p(s)H(s)}$$"
              />
              <FormulaSection
                title="扰动到输出传函"
                markdown="$$\\Phi_d(s)=\\frac{C(s)}{D(s)}=\\frac{G_p(s)}{1+G_c(s)G_p(s)H(s)}$$"
              />
              <FormulaSection
                title="给定到误差传函"
                markdown="$$\\frac{E_r(s)}{R(s)}=\\frac{1}{1+G_c(s)G_p(s)H(s)}$$"
                tone="violet"
              />
              <FormulaSection
                title="扰动到误差传函"
                markdown="$$\\frac{E_d(s)}{D(s)}=-\\frac{G_p(s)H(s)}{1+G_c(s)G_p(s)H(s)}$$"
                tone="violet"
              />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
              <FormulaSection
                title="总输出与总误差"
                markdown="$$C(s)=\\Phi_r(s)R(s)+\\Phi_d(s)D(s)$$\n$$E(s)=E_r(s)+E_d(s)$$"
                tone="emerald"
              />
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
              <FormulaSection
                title="终值定理公式"
                markdown="$$e_{ss}=\\lim_{s\\to 0}sE(s)$$\n先判闭环稳定，再决定这个极限是否有意义。"
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
              <FormulaSection
                title="例题 1 题面"
                markdown="已知 $$G(s)=\\dfrac{K}{s^2(0.5s+1)}$$，输入 $$r(t)=3+2t+\\dfrac{1}{2}t^2$$，即 $$R(s)=\\dfrac{3}{s}+\\dfrac{2}{s^2}+\\dfrac{1}{s^3}$$。\n\n求系统的稳态误差，并判断最终保留下来的主导项。"
                tone="slate"
              />
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
              <FormulaSection
                title="开环低频结构与判断口令"
                markdown="$$G(s)H(s)=\\frac{K_0}{s^v}G_0(s),\\quad G_0(0)\\neq 0$$\n先看积分个数，再决定是否可能把某类稳态误差结构性变成 0。"
                tone="cyan"
              />
              <FormulaSection
                title="三个静态误差系数"
                markdown="$$K_p=\\lim_{s\\to 0}G(s)H(s)$$\n$$K_v=\\lim_{s\\to 0}sG(s)H(s)$$\n$$K_a=\\lim_{s\\to 0}s^2G(s)H(s)$$"
                tone="violet"
              />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <FormulaSection
                title="表 2｜各型别系统的静态误差系数"
                markdown="| 型别 | 首个有限误差系数 |\n| --- | --- |\n| 0 型 | $K_p$ |\n| I 型 | $K_v$ |\n| II 型 | $K_a$ |"
                tone="slate"
              />
              <FormulaSection
                title="表 3｜各型别系统对典型输入的稳态误差"
                markdown="| 输入类型 | 0 型 | I 型 | II 型 |\n| --- | --- | --- | --- |\n| 单位阶跃 | 有限 | 0 | 0 |\n| 单位斜坡 | $\\infty$ | 有限 | 0 |\n| 单位抛物 | $\\infty$ | $\\infty$ | 有限 |"
                tone="emerald"
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
              <FormulaSection
                title="问题文案"
                markdown="已知 $G_1(s)$ 为执行机构，$G_2(s)$ 为被控对象，扰动加在两者之间。求给定与扰动共同作用时的总稳态误差。"
                tone="slate"
              />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-4">
                <FormulaSection
                  title="系统传函"
                  markdown="$$G_1(s)=\\dfrac{5}{s+5},\\quad G_2(s)=\\dfrac{2}{s+2}$$"
                  tone="cyan"
                />
                <FormulaSection
                  title="输入信号"
                  markdown="$$R(s)=\\dfrac{1}{s},\\quad D(s)=\\dfrac{0.2}{s}$$"
                  tone="emerald"
                />
              </div>
              {mediaSrc ? <MediaPanel src={mediaSrc} alt={step.title} /> : null}
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
              <FormulaSection
                title="PI 控制器"
                markdown="$$G_{PI}(s)=K\\left(1+\\frac{1}{T_i s}\\right)=K\\frac{T_i s+1}{T_i s}$$"
              />
              <FormulaSection
                title="一级滞后校正"
                markdown="$$G_{lag}(s)=K\\frac{Ts+1}{\\beta Ts+1},\\ \\beta>1$$"
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
              <FormulaSection
                title="比较表"
                markdown="| 路径 | 型别是否变化 | 主要收益 | 主要代价 | 更像哪条设计线 |\n| --- | --- | --- | --- | --- |\n| PI | 是 | 结构性改善低频误差 | 相位滞后增加、响应变慢 | 精度优先 |\n| 滞后 | 否 | 压小有限误差、抬低频增益 | 截止频率下降 | 折中提精度 |\n| 超前 | 否 | 提高相位裕度、利于更快动态 | 不以低频归零为主 | 速度优先 |"
                tone="slate"
              />
            </div>
            <div className="premium-lesson-tone-block premium-tone-rose mt-4 text-sm">
              误判点：不要把滞后理解成“弱积分”，也不要把超前误判成“另一种低频补偿”。
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
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_7StepDefinition;
  savedResponse?: UNIT_3_7StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_7StepResponse) => void;
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

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
      <p className="premium-lesson-muted mt-2 text-sm">{locked ? '教师尚未释放本页互动，请先阅读上方静态内容。' : '先完成自己的判断，再提交到教师端汇总。'}</p>

      {locked ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">当前互动尚未释放。</div>
      ) : (
        <div className="mt-4 grid gap-4">
          {step.pageType === 'binary_choice' ? (
            <ChoiceGroup
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
                  <ChoiceGroup options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} />
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
                    <ChoiceGroup options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} />
                  </div>
                  <button type="button" onClick={() => submit({ ...draft, [question.key]: draft[question.key] ?? '' })} className="premium-lesson-action-secondary mt-4">
                    保存本题
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
                  <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={`写出图中对应的 ${field.label} 位置说明`} />
                </div>
              </div>
            ))
          ) : null}

          {step.pageType === 'worked_example_workspace' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(WORKED_EXAMPLE_FIELDS[step.id] ?? []).map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <p className="premium-lesson-muted mt-2 text-sm">{field.prompt}</p>
                  <div className="mt-3">{renderActivityCard(field, draft[field.key] ?? '', (value) => updateDraft(field.key, value))}</div>
                  <button
                    type="button"
                    onClick={() => submit({ ...draft, [field.key]: draft[field.key] ?? '' })}
                    className="premium-lesson-action-secondary mt-4"
                  >
                    提交本卡
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
                  <p className="premium-lesson-muted mt-2 text-sm">{field.prompt}</p>
                  <div className="mt-3">{renderActivityCard(field, draft[field.key] ?? '', (value) => updateDraft(field.key, value))}</div>
                  <button
                    type="button"
                    onClick={() => submit({ ...draft, [field.key]: draft[field.key] ?? '' })}
                    className="premium-lesson-action-secondary mt-4"
                  >
                    提交本卡
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {step.pageType === 'quiz_group' || step.pageType === 'binary_choice' || step.pageType === 'hotspot_labeling' ? (
            <button type="button" onClick={() => submit()} className="premium-lesson-action-primary">
              {submitted ? '重新提交本页作答' : '提交本页作答'}
            </button>
          ) : null}
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
          <div className="premium-lesson-muted mt-1 text-sm">当前收到 {responses.length} 份本页作答。</div>
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
