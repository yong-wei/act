'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import {
  getUNIT_4_4PageContract,
  isUNIT_4_4PerCardQuizStep,
  isUNIT_4_4PerCardTextStep,
  UNIT_4_4_PARETO_FRONT_READING_BULLETS,
  UNIT_4_4_PARETO_POINT_READING_BULLETS,
  type UNIT_4_4StepDefinition,
  type UNIT_4_4StepResponse,
} from '@/lib/unit-4-4-course';
import {
  getUnit44GradientRevealState,
  getUnit44ParetoPoint,
  getUnit44ProgressiveRevealVisibleCount,
  UNIT_4_4_PARETO_DEFAULT_POINT_ID,
  UNIT_4_4_STEP11_PARETO_ROWS,
} from './figure-data';
import {
  GradientDescentNativeFigure,
  ParetoFrontNativeFigure,
  ParetoPointStatsPanelInner,
} from './native-figures';
import type { WorkspaceParameterChange } from './workspace';

type TeacherResponseItem = { studentName: string; response: UNIT_4_4StepResponse };
type PromptContentBlock = Readonly<{ type: 'text' | 'math'; value: string }>;
type PromptField = {
  key: string;
  title: string;
  prompt: readonly PromptContentBlock[];
  placeholder: string;
  half?: boolean;
};
type ChoiceQuestion = {
  key: string;
  prompt: string;
  options: readonly { value: string; label: string }[];
  answer: string;
  explanation: string;
};
type RevealStep = {
  title: string;
  blocks: readonly PromptContentBlock[];
};
type RichTableCell = Readonly<{ type: 'text' | 'math'; value: string }>;
type TableValue = string | RichTableCell;
type MethodCard = Readonly<{
  title: string;
  text: string;
  formula?: string;
}>;

const HEADING_PLANT_TEX = 'P_h(s)=\\dfrac{0.01715}{s(s+0.1)(s+2.14375)}';
const HEADING_INITIAL_CONTROLLER_TEX = 'C_{h,0}(s)=2.796\\dfrac{10s+1}{4.06s+1}';
const HEADING_PARAMETERIZATION_TEX = 'C_h(s)=K\\dfrac{Ts+1}{\\alpha Ts+1},\\ \\theta=[K,T,\\alpha]^\\mathsf T,\\ 0<\\alpha<1';
const J_FREE_TEX =
  'J_{\\mathrm{free}}(\\theta)=w_1\\dfrac{t_s}{40}+w_2\\dfrac{ITAE}{ITAE_0}+w_3\\dfrac{ITSE}{ITSE_0}+w_4\\dfrac{E_u}{E_{u,0}}';
const FREE_OBJECTIVES_TEX = '(ITAE(\\theta),E_u(\\theta))';
const MINIMIZATION_TEX =
  '\\min_{\\theta}J_{\\mathrm{free}}(\\theta),\\ \\theta\\in[1,6]\\times[4,15]\\times[0.15,0.85]';
const MINI_EXAMPLE_TEX = 'f(x)=(x-3)^2+1,\\ x_0=0';
const ROLL_OBJECT_TEX = 'P_r(s)=\\dfrac{1}{2.052s^2+0.3929s+1}';
const ROLL_CONTROLLER_TEX = 'C_r(s)=k\\dfrac{2.052s^2+0.3929s+1}{s},\\ 0.5\\le k\\le 3.5';
const ROLL_OBJECT_AND_CONTROLLER_TEX =
  '\\begin{aligned}P_r(s)&=\\dfrac{1}{2.052s^2+0.3929s+1}\\\\C_r(s)&=k\\dfrac{2.052s^2+0.3929s+1}{s},\\ 0.5\\le k\\le 3.5\\end{aligned}';
const ROLL_OBJECTIVE_TEX =
  'J_r(k)=0.60\\dfrac{RMS(\\varphi)}{RMS(\\varphi)_0}+0.25\\dfrac{\\max_\\omega |T_d(j\\omega)|}{\\max_\\omega |T_d(j\\omega)|_0}+0.15\\dfrac{RMS(u)}{RMS(u)_0}';
const PARETO_TITLE = 'Pareto front';
const RUNTIME_MEDIA_ROOT = '/course-runtime/lessons/4-4/media/';

const STEP_02_GOALS = [
  '说明经典试凑为何停在多目标拉扯前。',
  '写清参数化入口与参数范围的职责。',
  '把四类自由目标写成同一套比较语言。',
  '理解数值优化怎样把偏好变成迭代搜索。',
  '比较三组无约束候选的时域与频域差异。',
  '理解 Pareto front 为什么保留一族候选。',
  '看懂横摇边界案例为什么必须改写目标语言。',
] as const;

const STEP_02_ROWS = [
  ['比例基线', '先给出最小可运行起点', '31.9677', '83.1', '2.2500', '37.4347', '速度慢，动态品质不够'],
  ['仅补低频', '继续改善低频行为', '41.2759', '176.1', '1.1195', '30.8006', '低频改善后，动态矛盾更突出'],
  ['方向过激', '直接把速度拉起来', '20.2410', '19.6', '25.0000', '47.8274', '速度收益显著，但动作代价骤增'],
  ['最小修正', '把动作强度收回一部分', '24.8740', '39.1', '6.0000', '43.4991', '动作被收回后，动态品质又开始回退'],
] as const;

const STEP_04_RANGE_ROWS = [
  ['K', '[1,6]', '保持整体作用强度在当前结构可解释范围内'],
  ['T', '[4,15]', '让超前零点继续落在主工作频段附近'],
  ['α', '[0.15,0.85]', '保持在超前结构有效区间内'],
] as const;

const STEP_04_PRIOR_METRIC_ROWS = [
  ['调节时间 t_s / s', '36.0', '主过程偏慢'],
  ['ITAE', '63.692', '拖尾仍偏大'],
  ['ITSE', '16.528', '前中段误差强度仍需继续压低'],
  ['控制能量 E_u', '125.715', '动作代价已不可忽视'],
  ['截止频率 ω_c / rad/s', '0.180', '带宽仍偏低'],
  ['相角裕度 / deg', '49.046', '仍有继续调整空间'],
  ['超调 / %', '18.864', '前段动态形状仍不理想'],
  ['控制峰值', '6.887', '动作峰值已开始抬高'],
] as const;

const STEP_05_NORMALIZATION_ROWS = [
  [mathCell('t_s / 40'), textCell('40'), textCell('来自当前任务书中的速度期望'), textCell('能否更快收住')],
  [mathCell('ITAE / ITAE_0'), textCell('63.6924'), textCell('4-3 起始方案的拖尾读数'), textCell('拖尾是否更短')],
  [mathCell('ITSE / ITSE_0'), textCell('16.5282'), textCell('4-3 起始方案的误差强度读数'), textCell('前中段误差强度是否被压下去')],
  [mathCell('E_u / E_{u,0}'), textCell('125.7148'), textCell('4-3 起始方案的控制能量读数'), textCell('动作代价是否被明显抬高')],
] as const;

const STEP_08_WEIGHT_ROWS = [
  ['A', '0.40', '0.30', '0.20', '0.10', '更愿意把调节时间和拖尾一起压下去'],
  ['B', '0.30', '0.30', '0.20', '0.20', '更希望在速度、拖尾和动作代价之间保持平衡'],
  ['C', '0.20', '0.25', '0.25', '0.30', '更愿意多保留一些控制余量'],
] as const;

const STEP_08_RESULT_ROWS = [
  [textCell('起始方案'), mathCell('2.796\\dfrac{10s+1}{4.06s+1}'), textCell('36.0'), textCell('63.692'), textCell('16.528'), textCell('125.715')],
  [textCell('速度优先 A'), mathCell('2.7566\\dfrac{9.9829s+1}{1.4999s+1}'), textCell('15.2'), textCell('16.033'), textCell('7.084'), textCell('293.446')],
  [textCell('平衡权重 B'), mathCell('2.0644\\dfrac{9.9804s+1}{2.0809s+1}'), textCell('13.5'), textCell('28.266'), textCell('12.405'), textCell('122.904')],
  [textCell('能量优先 C'), mathCell('1.9318\\dfrac{9.9472s+1}{2.2531s+1}'), textCell('20.9'), textCell('32.652'), textCell('14.210'), textCell('100.267')],
] as const;

const STEP_06_METHOD_CARDS: readonly MethodCard[] = [
  {
    title: '取参数',
    text: '先从当前固定结构里取一组可比较的参数。',
    formula: '\\theta=[K,T,\\alpha]^\\mathsf T',
  },
  {
    title: '跑闭环仿真',
    text: '把这组参数代回主案例闭环，得到响应与控制动作。',
  },
  {
    title: '回读指标',
    text: '从仿真结果里回读统一比较语言中的关键指标。',
    formula: 't_s,\\ ITAE,\\ ITSE,\\ E_u',
  },
  {
    title: '代回目标函数',
    text: '把同一组读数代回自由目标，判断是否更符合当前偏好。',
    formula: 'J_{\\mathrm{free}}(\\theta)',
  },
  {
    title: '比较后更新',
    text: '若当前方向更合适，就继续沿该方向搜索；否则换方向重试。',
  },
] as const;

const STEP_09_FREQ_ROWS = [
  ['起始方案', '0.180', '49.046', '18.864', '6.887'],
  ['速度优先 A', '0.209', '66.974', '2.305', '18.347'],
  ['平衡权重 B', '0.156', '67.748', '1.996', '9.901'],
  ['能量优先 C', '0.146', '67.762', '2.054', '8.528'],
] as const;

const STEP_12_ROLL_ROWS = [
  ['起始方案', '1.0', '1.172', '1.838', '1.839', '5.294', '0.352'],
  ['无约束优化结果', '3.5', '0.521', '0.817', '0.818', '-1.750', '0.548'],
] as const;

const QUIZ_GROUPS: Record<string, readonly ChoiceQuestion[]> = {
  'step-03': [
    {
      key: 'pre-quiz-1',
      prompt: '只要一组参数让时间更短、拖尾更小，是否就已经能当最终答案？',
      options: [
        { value: 'no', label: '否' },
        { value: 'yes', label: '是' },
      ],
      answer: 'no',
      explanation: '它仍然只是无约束候选，尚未经过输出过程的工程边界复核。',
    },
    {
      key: 'pre-quiz-2',
      prompt: '参数范围和工程硬边界是不是同一种东西？',
      options: [
        { value: 'no', label: '不是' },
        { value: 'yes', label: '是' },
      ],
      answer: 'no',
      explanation: '参数范围只负责保持当前固定结构可解释，工程硬边界还要到 4-5 再系统复核。',
    },
    {
      key: 'pre-quiz-3',
      prompt: '若任务从航向跟踪改成横摇抗扰，原目标函数能否直接照搬？',
      options: [
        { value: 'no', label: '不能' },
        { value: 'yes', label: '能' },
      ],
      answer: 'no',
      explanation: '通道职责一变，收益项和代价项的分配语言也必须跟着改写。',
    },
  ],
  'step-13': [
    {
      key: 'post-quiz-1',
      prompt: '为什么本课保留下来的只能叫“候选族”，而不是最终可用解？',
      options: [
        { value: 'A', label: '因为还没有经过 4-5 的工程复核' },
        { value: 'B', label: '因为参数还没有写成向量' },
        { value: 'C', label: '因为调节时间没有下降' },
      ],
      answer: 'A',
      explanation: '4-4 只完成无约束候选的筛选与展示，还没有进入输出侧工程边界复核。',
    },
    {
      key: 'post-quiz-2',
      prompt: '为什么 Pareto front 不是再选一个绝对最优？',
      options: [
        { value: 'A', label: '因为它保留的是一组非支配候选' },
        { value: 'B', label: '因为图还没画完' },
        { value: 'C', label: '因为权重没有归一化' },
      ],
      answer: 'A',
      explanation: 'Pareto front 的价值在于保留互相之间仍然存在收益与代价交换的一组非支配候选。',
    },
    {
      key: 'post-quiz-3',
      prompt: '为什么横摇案例不能继续沿用航向保持中的目标语言？',
      options: [
        { value: 'A', label: '因为任务通道变了，收益项和代价项必须跟着改写' },
        { value: 'B', label: '因为横摇对象没有积分环节' },
        { value: 'C', label: '因为参数范围必须改成负数' },
      ],
      answer: 'A',
      explanation: '对象任务从航向跟踪换成横摇抗扰后，收益项和代价项的定义必须同步改写。',
    },
  ],
};

const SINGLE_CHOICE_QUESTIONS: Record<string, ChoiceQuestion> = {
  'step-08': {
    key: 'preserve-which',
    prompt: '若当前更担心动作代价继续抬高，更应优先保留哪一组候选？',
    options: [
      { value: 'A', label: 'A 组：更偏向速度和拖尾' },
      { value: 'B', label: 'B 组：速度与代价均衡' },
      { value: 'C', label: 'C 组：更重视动作代价与误差强度边界' },
    ],
    answer: 'C',
    explanation: 'C 组把动作代价拉回到更保守的位置，因此更适合作为“先别继续透支动作”的候选。',
  },
  'step-10': {
    key: 'pareto-meaning',
    prompt: '为什么 Pareto front 不是再选一个绝对最优？',
    options: [
      { value: 'A', label: '因为它保留的是一组非支配候选' },
      { value: 'B', label: '因为图还没画完' },
      { value: 'C', label: '因为权重没有填完' },
    ],
    answer: 'A',
    explanation: '前沿的价值在于把不同偏好下依然值得保留的一族候选显性呈现出来。',
  },
  'step-11': {
    key: 'pareto-point-why',
    prompt: '为什么 P1、P2、P3 能在 Pareto 意义下“同样好”？',
    options: [
      { value: 'A', label: '因为它们彼此之间都存在收益与代价交换' },
      { value: 'B', label: '因为三个点的数值完全一样' },
      { value: 'C', label: '因为只要在前沿上就自动可交付' },
    ],
    answer: 'A',
    explanation: '它们没有任何一个点能同时把另一点在两个目标上都彻底压倒。',
  },
};

const TEXT_PROMPTS: Record<string, readonly PromptField[]> = {
  'step-04': [
    {
      key: 'improvement-gap',
      title: '上一轮方案还能从哪些地方继续改进',
      prompt: [{ type: 'text', value: '你认为上一课中的方案还有哪些可以改进的地方？' }],
      placeholder: '可围绕调节时间、拖尾、误差强度、控制能量、带宽或动作峰值作答。',
    },
  ],
  'step-05': [
    {
      key: 'term-role',
      title: '收益项与代价项',
      prompt: [{ type: 'text', value: '请写出哪两项更像收益，哪一项最明显是在记录动作代价。' }],
      placeholder: '例如：速度与拖尾更像收益，控制能量最直接记录动作代价。',
    },
  ],
  'step-09': [
    {
      key: 'tradeoff-reading',
      title: '同一方向并不会一起变化',
      prompt: [
        {
          type: 'text',
          value:
            '请用一句话说明，为什么同样是无约束优化，时域收益、频域读数和动作代价不会朝同一个方向同步变化。',
        },
      ],
      placeholder: '围绕权重偏好改变、带宽变化与动作代价重新分配作答。',
    },
  ],
  'step-12': [
    {
      key: 'roll-language',
      title: '为什么原航向保持目标函数不能直接照搬',
      prompt: [{ type: 'text', value: '请写出横摇案例中，为什么原航向保持目标函数不能直接照搬。' }],
      placeholder: '围绕跟踪通道与抗扰通道的收益项不同作答。',
    },
    {
      key: 'roll-evidence',
      title: '哪两项数值最能说明搜索方向已经改变',
      prompt: [{ type: 'text', value: '请写出哪两项数值变化最能说明目标语言改了，搜索方向也改了。' }],
      placeholder: '例如 RMS(phi) 与谐振峰值同时下降。',
    },
    {
      key: 'roll-cost',
      title: '收益与代价如何重新分配',
      prompt: [{ type: 'text', value: '请用一句话说明横摇案例里收益与代价是怎样重新分配的。' }],
      placeholder: '围绕摆幅下降、谐振峰下降与 RMS(u) 上升作答。',
    },
  ],
};

const REFERENCE_ANSWERS: Record<string, readonly string[]> = {
  'step-04': [
    '上一轮结果已经暴露出过程偏慢、拖尾仍大、动作代价不可忽视等改进空间，因此适合作为参数化入口。',
    '本页不是重新随机起步，而是把上一轮证据继续整理成可优化的参数向量与比较语言。',
  ],
  'step-05': [
    '更像收益的通常是速度项、拖尾项和误差强度项；最明显记录动作代价的是控制能量。',
    '本页只建立自由目标比较语言，不引入罚项和硬约束。',
  ],
  'step-08': ['若当前更担心动作代价继续抬高，应先保留 C 组，因为它更保守地照顾动作代价与误差强度边界。'],
  'step-09': [
    '权重改变以后，带宽、相角裕度、控制峰值与拖尾缩短不会同步朝一个方向变化。',
    '无约束优化展示的是偏好差异，不是把所有指标同时推向同一端点。',
  ],
  'step-10': ['Pareto front 不是“再找一个绝对最优”，而是把互相无法同时压倒的候选显性保留下来。'],
  'step-11': [
    'P_1 / P_2 / P_3 在 ITAE 与动作代价之间承担不同取舍，因此都可能对应合理的偏好落点。',
  ],
  'step-12': [
    '横摇案例改写了目标语言：更关心整体摆幅和谐振峰，因此搜索方向必然不同于航向保持。',
    '收益没有白拿，RMS(u) 上升说明动作代价被重新分配了。',
  ],
  'step-13': [
    '候选族之所以不能直接当最终可用解，是因为 4-4 还没有对输出过程做工程边界复核。',
    'Pareto front 保留的是一组非支配候选，不是一个绝对最优点。',
    '横摇案例必须改写目标语言，因为抗扰通道的收益项与代价项已经不同于航向跟踪。',
  ],
};

const STEP_07_REVEALS: readonly RevealStep[] = [
  {
    title: '先看当前位置的函数值',
    blocks: [
      { type: 'math', value: MINI_EXAMPLE_TEX },
      { type: 'text', value: '从 x_0=0 出发时，函数值明显高于谷底，说明还有下降空间。' },
    ],
  },
  {
    title: '局部梯度告诉我们该往哪边走',
    blocks: [
      { type: 'math', value: 'f^\\prime(x)=2(x-3)' },
      { type: 'text', value: '在 x_0=0 附近，梯度为负，沿负梯度更新就会把点推向谷底。' },
    ],
  },
  {
    title: '更新后为什么会更接近谷底',
    blocks: [
      { type: 'math', value: 'x_{k+1}=x_k-\\eta f^\\prime(x_k)' },
      { type: 'text', value: '只要步长选得合理，新的点会把函数值继续往下压。' },
    ],
  },
];

function Panel({
  title,
  kicker,
  children,
  tone,
}: {
  title?: string;
  kicker?: string;
  children: ReactNode;
  tone?: 'amber' | 'cyan' | 'emerald' | 'rose' | 'slate';
}) {
  const toneClass = tone ? ` premium-tone-${tone}` : '';
  return (
    <section className={`premium-lesson-panel-soft px-4 py-4${toneClass ? ` premium-lesson-tone-block${toneClass}` : ''}`}>
      {kicker ? <div className="premium-lesson-kicker">{kicker}</div> : null}
      {title ? <h3 className="premium-lesson-title mt-2 text-lg font-semibold">{title}</h3> : null}
      <div className={title || kicker ? 'mt-3 space-y-3' : 'space-y-3'}>{children}</div>
    </section>
  );
}

function FormulaCard({ title, formula, note }: { title: string; formula: string; note?: string }) {
  return (
    <div className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <div className="mt-3 overflow-x-auto">
        <BlockMath math={formula} />
      </div>
      {note ? <div className="premium-lesson-muted mt-3 text-sm leading-6">{note}</div> : null}
    </div>
  );
}

function textCell(value: string): RichTableCell {
  return { type: 'text', value };
}

function mathCell(value: string): RichTableCell {
  return { type: 'math', value };
}

function BulletCard({ title, bullets }: { title: string; bullets: readonly string[] }) {
  return (
    <div className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <ul className="premium-lesson-muted mt-3 space-y-2 text-sm leading-6">
        {bullets.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function SimpleTable({
  columns,
  rows,
}: {
  columns: readonly string[];
  rows: readonly (readonly TableValue[])[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="align-top">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="border-b border-slate-100 px-3 py-2 text-slate-700">
                  {typeof cell === 'string' ? (
                    cell
                  ) : cell.type === 'math' ? (
                    <span className="inline-block overflow-x-auto align-middle">
                      <InlineMath math={cell.value} />
                    </span>
                  ) : (
                    cell.value
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FigureCard({
  src,
  alt,
  caption,
  conclusion,
}: {
  src: string | null;
  alt: string;
  caption: string;
  conclusion?: string;
}) {
  if (!src) return null;
  return (
    <div className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <Image src={src} alt={alt} width={1600} height={900} className="h-auto w-full object-contain" />
      </div>
      <div className="premium-lesson-title mt-3 text-sm font-semibold">{caption}</div>
      {conclusion ? <div className="premium-lesson-muted mt-2 text-sm leading-6">{conclusion}</div> : null}
    </div>
  );
}

function withRuntimeFallback(src: string | null, filename: string) {
  return src ?? `${RUNTIME_MEDIA_ROOT}${filename}`;
}

function renderPromptContent(blocks: readonly PromptContentBlock[]) {
  return blocks.map((block, index) =>
    block.type === 'math' ? (
      <div key={`${block.type}-${index}`} className="overflow-x-auto">
        <BlockMath math={block.value} />
      </div>
    ) : (
      <p key={`${block.type}-${index}`} className="premium-lesson-muted text-sm leading-6">
        {block.value}
      </p>
    ),
  );
}

function ProgressiveReveal({
  steps,
  visibleCount,
  allowInlineReveal,
  canRevealMore,
  onAdvanceReveal,
}: {
  steps: readonly RevealStep[];
  visibleCount: number;
  allowInlineReveal: boolean;
  canRevealMore: boolean;
  onAdvanceReveal: () => void;
}) {
  const visibleSteps = steps.slice(0, visibleCount);

  return (
    <div className="space-y-3">
      {visibleSteps.map((step, index) => {
        const isLastVisible = index === visibleSteps.length - 1;
        return (
          <button
            key={step.title}
            type="button"
            data-progressive-reveal="step_click_reveal"
            disabled={!isLastVisible || !canRevealMore}
            onClick={() => {
              if (isLastVisible && canRevealMore) {
                onAdvanceReveal();
              }
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm disabled:cursor-default"
          >
            <div className="premium-lesson-title text-sm font-semibold">{step.title}</div>
            <div className="mt-3 space-y-2">{renderPromptContent(step.blocks)}</div>
          </button>
        );
      })}
      <div className="premium-lesson-muted text-xs">
        {allowInlineReveal ? '点击当前最下方已显影步骤可继续展开下一层。' : '当前显影由教师推进。'}
      </div>
    </div>
  );
}

function ReferenceAnswerPanel({ stepId }: { stepId: string }) {
  const items = REFERENCE_ANSWERS[stepId];
  if (!items?.length) return null;
  return (
    <Panel title="参考答案揭示" tone="emerald">
      <ul className="premium-lesson-muted space-y-2 text-sm leading-6">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </Panel>
  );
}

function Step03Or13Intro({ stepId }: { stepId: string }) {
  if (stepId === 'step-03') {
    return (
      <Panel title="前测：先判断哪些边界还没有被正式写进模型" kicker="P1">
        <p className="premium-lesson-muted text-sm leading-6">
          看完四组试凑证据后，再判断哪些话现在还不能说满。
        </p>
        <p className="premium-lesson-muted text-sm leading-6">
          若这三题里仍有判断不稳，后面的参数化、自由目标和边界案例就会被误读成“优化已经替工程裁决”。
        </p>
      </Panel>
    );
  }
  return (
    <Panel title="阶段判断后测" kicker="P3">
      <p className="premium-lesson-muted text-sm leading-6">这一页只检查判断链，不负责总结和移交。</p>
      <p className="premium-lesson-muted text-sm leading-6">
        答题时必须同时回接本课中的证据页，而不是只重复名词定义。
      </p>
    </Panel>
  );
}

function Step14Summary() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Panel title="本课带走的六句话" kicker="Summary">
        <ul className="premium-lesson-muted space-y-2 text-sm leading-6">
          <li>• 多目标拉扯先由证据暴露，而不是由求解器神秘决定。</li>
          <li>• 参数化入口直接来自 4-3 的第一版方案。</li>
          <li>• 归一化基准来自任务书或首轮方案的真实读数。</li>
          <li>• 数值优化在本课里的职责是把偏好变成可重复的证据迭代链。</li>
          <li>• Pareto front 让一族仍然值得保留的候选被显性看见。</li>
          <li>• 边界案例说明任务语言变化会直接改写目标函数。</li>
        </ul>
      </Panel>
      <Panel title="4-5 去向" kicker="Handoff">
        <p className="premium-lesson-muted text-sm leading-6">
          4-5 将接手这组候选，对输出侧工程边界做系统复核，再决定哪些候选还能继续保留。
        </p>
      </Panel>
    </div>
  );
}

function buildInitialAnswers(savedResponse: UNIT_4_4StepResponse | undefined, keys: readonly string[]) {
  const next: Record<string, string> = {};
  for (const key of keys) {
    next[key] = savedResponse?.answers?.[key] ?? '';
  }
  return next;
}

function QuizGroupForm({
  stepId,
  questions,
  savedResponse,
  onSubmit,
}: {
  stepId: string;
  questions: readonly ChoiceQuestion[];
  savedResponse?: UNIT_4_4StepResponse;
  onSubmit: (response: UNIT_4_4StepResponse) => void;
}) {
  const keys = useMemo(() => questions.map((item) => item.key), [questions]);
  const [answers, setAnswers] = useState<Record<string, string>>(() => buildInitialAnswers(savedResponse, keys));

  useEffect(() => {
    setAnswers(buildInitialAnswers(savedResponse, keys));
  }, [keys, savedResponse]);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (keys.some((key) => !answers[key])) return;
        onSubmit({
          stepId,
          submittedAt: Date.now(),
          answers,
        });
      }}
    >
      {questions.map((question) => (
        <Panel key={question.key} title={question.prompt}>
          <div className="grid gap-2">
            {question.options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <input
                  type="radio"
                  name={question.key}
                  value={option.value}
                  checked={answers[question.key] === option.value}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.key]: event.target.value,
                    }))
                  }
                  className="mt-1"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </Panel>
      ))}
      <button type="submit" className="premium-lesson-action-primary">
        提交本页作答
      </button>
      <SubmissionStatus submitted={Boolean(savedResponse)} submittedText="作答已提交，可继续等待教师揭示参考答案。" />
    </form>
  );
}

function PerCardQuizForm({
  stepId,
  questions,
  savedResponse,
  onSubmit,
}: {
  stepId: string;
  questions: readonly ChoiceQuestion[];
  savedResponse?: UNIT_4_4StepResponse;
  onSubmit: (response: UNIT_4_4StepResponse) => void;
}) {
  const keys = useMemo(() => questions.map((item) => item.key), [questions]);
  const [answers, setAnswers] = useState<Record<string, string>>(() => buildInitialAnswers(savedResponse, keys));

  useEffect(() => {
    setAnswers(buildInitialAnswers(savedResponse, keys));
  }, [keys, savedResponse]);

  const submittedKeys = new Set(
    Object.entries(savedResponse?.answers ?? {})
      .filter(([, value]) => String(value ?? '').trim().length > 0)
      .map(([key]) => key),
  );

  return (
    <div className="grid gap-4">
      {questions.map((question) => (
        <Panel key={question.key} title={question.prompt}>
          <div className="grid gap-2">
            {question.options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <input
                  type="radio"
                  name={question.key}
                  value={option.value}
                  checked={answers[question.key] === option.value}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.key]: event.target.value,
                    }))
                  }
                  className="mt-1"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (!answers[question.key]) return;
                onSubmit({
                  stepId,
                  submittedAt: Date.now(),
                  answers: {
                    ...(savedResponse?.answers ?? {}),
                    ...answers,
                    [question.key]: answers[question.key],
                  },
                });
              }}
              className="premium-lesson-action-primary"
            >
              单独提交本卡
            </button>
            <SubmissionStatus
              submitted={submittedKeys.has(question.key)}
              submittedText="本卡已提交。"
              idleText="本卡独立提交后会进入教师端汇总。"
            />
          </div>
        </Panel>
      ))}
    </div>
  );
}

function TextCardForm({
  step,
  fields,
  savedResponse,
  onSubmit,
}: {
  step: UNIT_4_4StepDefinition;
  fields: readonly PromptField[];
  savedResponse?: UNIT_4_4StepResponse;
  onSubmit: (response: UNIT_4_4StepResponse) => void;
}) {
  const keys = useMemo(() => fields.map((item) => item.key), [fields]);
  const [answers, setAnswers] = useState<Record<string, string>>(() => buildInitialAnswers(savedResponse, keys));

  useEffect(() => {
    setAnswers(buildInitialAnswers(savedResponse, keys));
  }, [keys, savedResponse]);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          stepId: step.id,
          submittedAt: Date.now(),
          answers,
        });
      }}
    >
      <div className={fields.some((field) => field.half) ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4'}>
        {fields.map((field) => (
          <Panel key={field.key} title={field.title}>
            <div className="space-y-2">{renderPromptContent(field.prompt)}</div>
            <textarea
              value={answers[field.key] ?? ''}
              onChange={(event) =>
                setAnswers((prev) => ({
                  ...prev,
                  [field.key]: event.target.value,
                }))
              }
              rows={field.half ? 5 : 6}
              placeholder={field.placeholder}
              className="premium-lesson-input min-h-[132px] w-full resize-y"
            />
          </Panel>
        ))}
      </div>
      <button type="submit" className="premium-lesson-action-primary">
        提交本页作答
      </button>
      <SubmissionStatus submitted={Boolean(savedResponse)} submittedText="本页作答已提交，可继续补充或等待教师揭示参考答案。" />
    </form>
  );
}

function PerCardTextForm({
  step,
  fields,
  savedResponse,
  onSubmit,
}: {
  step: UNIT_4_4StepDefinition;
  fields: readonly PromptField[];
  savedResponse?: UNIT_4_4StepResponse;
  onSubmit: (response: UNIT_4_4StepResponse) => void;
}) {
  const keys = useMemo(() => fields.map((item) => item.key), [fields]);
  const [answers, setAnswers] = useState<Record<string, string>>(() => buildInitialAnswers(savedResponse, keys));

  useEffect(() => {
    setAnswers(buildInitialAnswers(savedResponse, keys));
  }, [keys, savedResponse]);

  const submittedKeys = new Set(
    Object.entries(savedResponse?.answers ?? {})
      .filter(([, value]) => String(value ?? '').trim().length > 0)
      .map(([key]) => key),
  );

  return (
    <div className="grid gap-4">
      {fields.map((field) => (
        <Panel key={field.key} title={field.title}>
          <div className="space-y-2">{renderPromptContent(field.prompt)}</div>
          <textarea
            value={answers[field.key] ?? ''}
            onChange={(event) =>
              setAnswers((prev) => ({
                ...prev,
                [field.key]: event.target.value,
              }))
            }
            rows={6}
            placeholder={field.placeholder}
            className="premium-lesson-input min-h-[132px] w-full resize-y"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                onSubmit({
                  stepId: step.id,
                  submittedAt: Date.now(),
                  answers: {
                    ...(savedResponse?.answers ?? {}),
                    ...answers,
                    [field.key]: answers[field.key] ?? '',
                  },
                })
              }
              className="premium-lesson-action-primary"
            >
              单独提交本卡
            </button>
            <SubmissionStatus
              submitted={submittedKeys.has(field.key)}
              submittedText="本卡已提交。"
              idleText="本卡独立提交后会进入教师端汇总。"
            />
          </div>
        </Panel>
      ))}
    </div>
  );
}

export function UNIT_4_4KnowledgeMapVisual() {
  return (
    <Panel title="本课判断链地图" kicker="4-4 · Route">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ['4-3', '固定结构与问题清单', '先把起始方案与参数方向写清。'],
          ['4-4', '无约束优化建模与候选族', '把多目标拉扯写成统一可比的自由目标。'],
          ['4-5', '工程边界复核', '对输出过程和工程约束做进一步筛选。'],
        ].map(([stage, title, text]) => (
          <div key={stage} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
            <div className="premium-lesson-kicker">{stage}</div>
            <div className="premium-lesson-title mt-2 text-sm font-semibold">{title}</div>
            <div className="premium-lesson-muted mt-2 text-sm leading-6">{text}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function UNIT_4_4StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  revealProgress,
  allowInlineReveal,
  onWorkspaceParameterChange,
}: {
  step: UNIT_4_4StepDefinition;
  mediaSrc: string | null;
  mediaAlt: string;
  revealProgress: number;
  allowInlineReveal: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  void onWorkspaceParameterChange;
  const [selectedParetoPointId, setSelectedParetoPointId] = useState(UNIT_4_4_PARETO_DEFAULT_POINT_ID);
  const [step07LocalRevealCount, setStep07LocalRevealCount] = useState(1);

  useEffect(() => {
    setSelectedParetoPointId(UNIT_4_4_PARETO_DEFAULT_POINT_ID);
  }, [step.id]);

  const step07TeacherVisibleCount = getUnit44ProgressiveRevealVisibleCount(
    revealProgress,
    1,
    false,
    STEP_07_REVEALS.length,
  );

  useEffect(() => {
    setStep07LocalRevealCount(step07TeacherVisibleCount);
  }, [step.id, step07TeacherVisibleCount]);

  if (step.id === 'step-01') {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <FormulaCard title="主案例对象" formula={HEADING_PLANT_TEX} note="对象自带积分特性，当前最紧的矛盾不是稳态误差，而是多目标拉扯。" />
          <BulletCard
            title="当前已经同时出现的四类愿望"
            bullets={[
              '希望修航过程更快。',
              '希望误差拖尾更短。',
              '希望前中段误差强度不要被放大。',
              '希望控制动作不要变得过于粗暴。',
            ]}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <BulletCard
            title="课程路径"
            bullets={[
              '4-3 固定结构与问题清单',
              '4-4 无约束优化建模与候选族',
              '4-5 工程边界复核',
            ]}
          />
          <Panel title="当前真正缺的不是更多试凑，而是统一的比较语言">
            <p className="premium-lesson-muted text-sm leading-6">
              经典试凑已经告诉我们方向，却还没有告诉我们这些收益和代价该怎样放进同一套比较语言。
            </p>
          </Panel>
        </div>
      </div>
    );
  }

  if (step.id === 'step-02') {
    return (
      <div className="space-y-4">
        <Panel title="本次课程目标：这一课要把哪些判断写实" kicker="Objective">
          <p className="premium-lesson-muted text-sm leading-6">完成本次课程后，学习者能够：</p>
        </Panel>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STEP_02_GOALS.map((goal, index) => (
            <div key={goal} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
              <div className="premium-lesson-kicker">Goal {index + 1}</div>
              <div className="premium-lesson-muted mt-2 text-sm leading-6">{goal}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step.id === 'step-03') {
    return (
      <div className="space-y-4">
        <Panel title="四组经典试凑结果：多目标拉扯先被证据看见">
          <SimpleTable
            columns={['方案', '设计意图', '超调 / %', '调节时间 / s', '控制峰值', '相角裕度 / deg', '读数结论']}
            rows={STEP_02_ROWS}
          />
        </Panel>
        <FigureCard
          src={withRuntimeFallback(mediaSrc, '4-4-ship-heading-diagnosis-compare.png')}
          alt={mediaAlt}
          caption="客船航向保持首轮验证对比"
        />
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <BulletCard
            title="读图口令"
            bullets={[
              '先看哪一组更快。',
              '再看哪一组拖尾更短。',
              '随后看哪一组主要在收动作代价。',
              '最后判断为什么这些变化还没进入同一套评价语言。',
            ]}
          />
          <Panel title="图后结论">
            <p className="premium-lesson-muted text-sm leading-6">
              固定结构没有失效，真正暴露出来的是多目标拉扯还缺一套统一评价语言。
            </p>
          </Panel>
        </div>
        <Step03Or13Intro stepId={step.id} />
      </div>
    );
  }

  if (step.id === 'step-04') {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <FormulaCard title="4-3 起始方案" formula={HEADING_INITIAL_CONTROLLER_TEX} />
          <FormulaCard title="本课参数化入口" formula={HEADING_PARAMETERIZATION_TEX} />
        </div>
        <Panel title="上一轮设计结果与性能指标">
          <FigureCard
            src={withRuntimeFallback(mediaSrc, '4-4-ship-heading-optimization-compare.png')}
            alt={mediaAlt}
            caption="上一轮设计结果回看"
          />
          <div className="mt-4">
            <SimpleTable columns={['指标', '数值', '上一轮结果说明']} rows={STEP_04_PRIOR_METRIC_ROWS} />
          </div>
        </Panel>
        <Panel title="参数范围表">
          <SimpleTable columns={['参数', '取值范围', '结构解释']} rows={STEP_04_RANGE_ROWS} />
          <p className="premium-lesson-muted text-sm leading-6">
            参数范围只负责保持当前固定结构可解释，并不等于输出过程的工程复核条件。
          </p>
        </Panel>
      </div>
    );
  }

  if (step.id === 'step-05') {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['调节时间 t_s', '代表收敛速度'],
            ['ITAE', '代表误差拖尾是否被压短'],
            ['ITSE', '代表前中段强误差是否真的被压下去'],
            ['控制能量 E_u', '代表控制动作整体是否过于激进'],
          ].map(([title, note]) => (
            <div key={title} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4 text-center">
              <div className="premium-lesson-title text-sm font-semibold">{title}</div>
              <div className="premium-lesson-muted mt-2 text-sm leading-6">{note}</div>
            </div>
          ))}
        </div>
        <FormulaCard title="无约束加权自由目标" formula={J_FREE_TEX} />
        <Panel title="归一化来源与每一项正在回答的问题">
          <SimpleTable
            columns={['归一化项', '数值', '来源', '这一项正在回答的问题']}
            rows={STEP_05_NORMALIZATION_ROWS}
          />
        </Panel>
        <Panel title="讲义 5.3：权重代表的是偏好，而不是客观真理">
          <p className="premium-lesson-muted text-sm leading-6">
            权重不是脱离任务的固定常数，而是偏好的数值化表达。只要偏好一变，数值搜索的推进方向也会跟着变。
          </p>
        </Panel>
      </div>
    );
  }

  if (step.id === 'step-06') {
    return (
      <div className="space-y-4">
        <FormulaCard title="本课中的优化问题" formula={MINIMIZATION_TEX} />
        <Panel title="五步迭代链" kicker="Method">
          <div className="grid gap-3 md:grid-cols-5">
            {STEP_06_METHOD_CARDS.map((card, index) => (
              <div key={card.title} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
                <div className="premium-lesson-kicker">Step {index + 1}</div>
                <div className="premium-lesson-title mt-2 text-sm font-semibold">{card.title}</div>
                <div className="premium-lesson-muted mt-2 text-sm leading-6">{card.text}</div>
                {card.formula ? (
                  <div className="premium-lesson-muted mt-2 text-sm leading-6">
                    <InlineMath math={card.formula} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <p className="premium-lesson-muted text-sm leading-6">
            本课里的数值优化不是神秘黑箱，而是把偏好表达变成可重复的证据迭代。
          </p>
        </Panel>
      </div>
    );
  }

  if (step.id === 'step-07') {
    const step07VisibleRevealCount = getUnit44ProgressiveRevealVisibleCount(
      revealProgress,
      step07LocalRevealCount,
      allowInlineReveal,
      STEP_07_REVEALS.length,
    );
    const gradientRevealState = getUnit44GradientRevealState(step07VisibleRevealCount - 1);
    const step07CanRevealMore = allowInlineReveal && step07VisibleRevealCount < STEP_07_REVEALS.length;
    return (
      <div className="space-y-4">
        <Panel title="为什么搜索会沿代价面下滑" kicker="Teacher Reveal">
          <p className="premium-lesson-muted text-sm leading-6">
            这一页只解决一件事：目标函数一旦写出，搜索为何会留下可读轨迹。
          </p>
          <div className="mt-3 overflow-x-auto">
            <BlockMath math={MINI_EXAMPLE_TEX} />
          </div>
          <p className="premium-lesson-muted text-sm leading-6">
            先看一维目标函数，从 x_0=0 出发，按当前位置的负梯度方向不断更新。
          </p>
        </Panel>
        <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <GradientDescentNativeFigure
            visiblePointCount={gradientRevealState.visiblePointCount}
            visibleSegmentCount={gradientRevealState.visibleSegmentCount}
            activePointIndex={gradientRevealState.activePointIndex}
          />
          <Panel title="当前位置与代价函数值的逐步显影">
            <ProgressiveReveal
              steps={STEP_07_REVEALS}
              visibleCount={step07VisibleRevealCount}
              allowInlineReveal={allowInlineReveal}
              canRevealMore={step07CanRevealMore}
              onAdvanceReveal={() =>
                setStep07LocalRevealCount((current) => Math.min(current + 1, STEP_07_REVEALS.length))
              }
            />
          </Panel>
        </div>
      </div>
    );
  }

  if (step.id === 'step-08') {
    return (
      <div className="space-y-4">
        <FormulaCard title="统一固定结构" formula={HEADING_PARAMETERIZATION_TEX} />
        <Panel title="三组权重与偏好说明">
          <SimpleTable columns={['权重组', 'w1', 'w2', 'w3', 'w4', '偏好说明']} rows={STEP_08_WEIGHT_ROWS} />
        </Panel>
        <Panel title="起始方案与三组无约束权重方案">
          <SimpleTable columns={['方案', '控制器传函', '调节时间 / s', 'ITAE', 'ITSE', '控制能量']} rows={STEP_08_RESULT_ROWS} />
        </Panel>
      </div>
    );
  }

  if (step.id === 'step-09') {
    return (
      <div className="space-y-4">
        <FigureCard
          src={withRuntimeFallback(mediaSrc, '4-4-ship-heading-unconstrained-weight-compare.png')}
          alt={mediaAlt}
          caption="主案例四联综合图"
          conclusion="起始方案偏慢，A 与 B 都明显压短主过程，其中 B 更平衡；C 更保守，动作代价被照顾后过程也回到更平缓的形态。"
        />
        <Panel title="频域回读表">
          <SimpleTable columns={['方案', '截止频率 ω_c / rad/s', '相角裕度 / deg', '超调 / %', '控制峰值']} rows={STEP_09_FREQ_ROWS} />
        </Panel>
      </div>
    );
  }

  if (step.id === 'step-10') {
    const selectedPoint = getUnit44ParetoPoint(selectedParetoPointId);
    return (
      <div className="space-y-4">
        <FormulaCard
          title="二目标设计对"
          formula={FREE_OBJECTIVES_TEX}
          note="任何一个目标再改善一点，就一定会让另一个目标变差，这组非支配候选才会构成 Pareto front。"
        />
        <Panel title="拖动曲线上的候选点">
          <p className="premium-lesson-muted text-sm leading-6">
            左侧原生曲线和右侧统计面板读取同一组前沿数据，用来说明为什么 Pareto front 保留的是一组非支配候选。
          </p>
          <p className="premium-lesson-muted text-sm leading-6">
            越往左走，控制能量更省；越往上走，ITAE 更大，说明拖尾会更差。
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
            <ParetoFrontNativeFigure selectedPointId={selectedParetoPointId} onSelectPoint={setSelectedParetoPointId} />
            <ParetoPointStatsPanelInner point={selectedPoint} />
          </div>
        </Panel>
        <BulletCard title="front 读法" bullets={UNIT_4_4_PARETO_FRONT_READING_BULLETS} />
      </div>
    );
  }

  if (step.id === 'step-11') {
    return (
      <div className="space-y-4">
        <FormulaCard title="仍然是同一固定结构" formula={HEADING_PARAMETERIZATION_TEX} />
        <Panel title="三个典型前沿点参数表">
          <SimpleTable columns={['前沿点', 'K', 'T', 'αT', 'ITAE', 'E_u', '调节时间 / s', '控制峰值']} rows={UNIT_4_4_STEP11_PARETO_ROWS} />
        </Panel>
        <FigureCard
          src={withRuntimeFallback(mediaSrc, '4-4-pareto-response-compare.png')}
          alt={mediaAlt}
          caption="Pareto 前沿上的典型候选：时域与频域对比"
          conclusion="图上保留下来的三点都没有把另外两点彻底压倒，因此必须回到收益与代价交换来读。"
        />
        <BulletCard title="图后解释" bullets={UNIT_4_4_PARETO_POINT_READING_BULLETS} />
        <BulletCard
          title="三条工程意义"
          bullets={[
            '这条前沿先筛掉同时输给别人的候选。',
            '它把偏好从口头争论变成可视化对象。',
            '后续工程复核是在这组可解释候选上继续做筛选。',
          ]}
        />
      </div>
    );
  }

  if (step.id === 'step-13') {
    return <Step03Or13Intro stepId={step.id} />;
  }

  if (step.id === 'step-12') {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <FormulaCard title="横摇对象与控制器" formula={ROLL_OBJECT_AND_CONTROLLER_TEX} />
          <FormulaCard title="横摇自由目标" formula={ROLL_OBJECTIVE_TEX} note="目标语言一变，搜索方向就不再围绕跟踪拖尾，而是围绕摆幅、谐振峰与动作再分配。"/>
        </div>
        <Panel title="横摇案例数值对比">
          <SimpleTable columns={['方案', 'k', 'RMS(φ)', '横摇峰值', '谐振峰值', '谐振峰值 / dB', 'RMS(u)']} rows={STEP_12_ROLL_ROWS} />
        </Panel>
        <FigureCard
          src={withRuntimeFallback(mediaSrc, '4-4-roll-optimization-compare.png')}
          alt={mediaAlt}
          caption="横摇边界案例：扰动通道、横摇响应与减摇鳍动作对比"
          conclusion="目标语言改写后，搜索开始主动压低横摇整体强度和谐振峰。收益没有白拿，RMS(u) 的上升说明动作代价被重新分配。"
        />
        <BulletCard
          title="两条回读结论"
          bullets={[
            '目标语言改写后，搜索开始主动压低横摇整体强度和谐振峰。',
            '收益没有白拿，RMS(u) 的上升说明动作代价被重新分配。',
          ]}
        />
      </div>
    );
  }

  if (step.id === 'step-14') {
    return (
      <div className="space-y-4">
        {mediaSrc ? <FigureCard src={mediaSrc} alt={mediaAlt} caption="本课收束信息图" /> : null}
        <Step14Summary />
      </div>
    );
  }

  return null;
}

export function UNIT_4_4StudentActivityForm({
  step,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  step: UNIT_4_4StepDefinition;
  savedResponse?: UNIT_4_4StepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: UNIT_4_4StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  void onWorkspaceParameterChange;
  void revealProgress;

  if (step.pageType === 'display') {
    return null;
  }

  if (step.pageType === 'teacher_reveal_only') {
    return (
      <Panel title="显影状态">
        <p className="premium-lesson-muted text-sm leading-6">
          这一页只做教师逐步显影。{browseEnabled ? '当前仅同步教师已放出的层级，不开放学生本地点显影。' : '当前仍以教师控制为准。'}
        </p>
      </Panel>
    );
  }

  if (!released) {
    return (
      <Panel title="等待教师释放">
        <p className="premium-lesson-muted text-sm leading-6">本页作答尚未开放，教师释放后即可提交。</p>
      </Panel>
    );
  }

  const quizGroup = QUIZ_GROUPS[step.id];
  if (quizGroup) {
    return (
      <div className="space-y-4">
        {isUNIT_4_4PerCardQuizStep(step.id) ? (
          <PerCardQuizForm stepId={step.id} questions={quizGroup} savedResponse={savedResponse} onSubmit={onSubmit} />
        ) : (
          <QuizGroupForm stepId={step.id} questions={quizGroup} savedResponse={savedResponse} onSubmit={onSubmit} />
        )}
        {answerVisible ? <ReferenceAnswerPanel stepId={step.id} /> : null}
      </div>
    );
  }

  const singleChoice = SINGLE_CHOICE_QUESTIONS[step.id];
  if (singleChoice) {
    return (
      <div className="space-y-4">
        <QuizGroupForm stepId={step.id} questions={[singleChoice]} savedResponse={savedResponse} onSubmit={onSubmit} />
        {answerVisible ? <ReferenceAnswerPanel stepId={step.id} /> : null}
      </div>
    );
  }

  const textFields = TEXT_PROMPTS[step.id];
  if (textFields) {
    return (
      <div className="space-y-4">
        {isUNIT_4_4PerCardTextStep(step.id) ? (
          <PerCardTextForm step={step} fields={textFields} savedResponse={savedResponse} onSubmit={onSubmit} />
        ) : (
          <TextCardForm step={step} fields={textFields} savedResponse={savedResponse} onSubmit={onSubmit} />
        )}
        {answerVisible ? <ReferenceAnswerPanel stepId={step.id} /> : null}
      </div>
    );
  }

  return null;
}

export function UNIT_4_4TeacherActivitySummary({
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
  step: UNIT_4_4StepDefinition;
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
  const pageContract = getUNIT_4_4PageContract(step.id);
  const latestCount = responses.length;

  return (
    <div className="space-y-4">
      <Panel title="教师控制台" kicker="Teacher">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pageContract.teacherControls.releaseActivity !== 'not_applicable' ? (
            <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
              {released ? '关闭作答释放' : '释放作答'}
            </button>
          ) : null}
          {pageContract.teacherControls.openBrowse !== 'not_applicable' ? (
            <button type="button" onClick={onToggleBrowse} className="premium-lesson-action-secondary">
              {browseEnabled ? '关闭浏览同步' : '开放浏览'}
            </button>
          ) : null}
          {pageContract.teacherControls.revealReferenceAnswer !== 'not_applicable' ? (
            <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-secondary">
              {answerVisible ? '隐藏参考答案' : '显示参考答案'}
            </button>
          ) : null}
          {pageContract.teacherControls.teacherStepReveal !== 'not_applicable' ? (
            <div className="flex gap-2">
              <button type="button" onClick={onAdvanceReveal} className="premium-lesson-action-secondary flex-1">
                推进显影
              </button>
              <button type="button" onClick={onResetReveal} className="premium-lesson-action-secondary flex-1">
                重置
              </button>
            </div>
          ) : null}
        </div>
        {pageContract.teacherControls.teacherStepReveal !== 'not_applicable' ? (
          <p className="premium-lesson-muted text-sm leading-6">当前教师显影层级：{revealProgress + 1}</p>
        ) : null}
      </Panel>

      <Panel title="课堂提交汇总" kicker="Telemetry">
        <div className="premium-lesson-muted text-sm leading-6">当前页已收到 {latestCount} 份学生作答。</div>
        {responses.length ? (
          <div className="space-y-3">
            {responses.map((item) => (
              <div key={`${item.studentName}-${item.response.submittedAt}`} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-semibold">{item.studentName}</div>
                <div className="premium-lesson-muted mt-2 space-y-1 text-sm leading-6">
                  {Object.entries(item.response.answers)
                    .slice(0, 3)
                    .map(([key, value]) => (
                      <div key={key}>
                        <strong>{key}</strong>：{String(value).slice(0, 80) || '未填写'}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="premium-lesson-muted text-sm">当前页暂无学生提交。</div>
        )}
      </Panel>
    </div>
  );
}

export function UNIT_4_4StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_4_4StepResponse>;
}) {
  const completedIds = Object.keys(responses);
  return (
    <Panel title="个人课堂小结" kicker="Student">
      <p className="premium-lesson-muted text-sm leading-6">你已完成 {completedIds.length} 个可提交环节。</p>
      {completedIds.length ? (
        <div className="flex flex-wrap gap-2">
          {completedIds.map((id) => (
            <span key={id} className="premium-lesson-tone-pill premium-tone-cyan px-3 py-1 text-xs">
              {id}
            </span>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

export function UNIT_4_4StepAiAssistant(_: { step: UNIT_4_4StepDefinition; onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void }) {
  return null;
}
