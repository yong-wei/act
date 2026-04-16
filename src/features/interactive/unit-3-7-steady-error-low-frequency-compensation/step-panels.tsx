'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import {
  type UNIT_3_7StepDefinition,
  type UNIT_3_7StepResponse,
} from '@/lib/unit-3-7-course';
import {
  CARD_SORT_ITEMS,
  HOTSPOT_FIELDS,
  POSTTEST_QUESTIONS,
  PRETEST_QUESTIONS,
  STRUCTURED_COMPARE_FIELDS,
  TRIPLE_MATCH_FIELDS,
  WORKED_EXAMPLE_FIELDS,
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
        bullets: [
          '系统稳定了，为什么误差还可能留在比较点上？',
          '为什么“更快更稳”并不等于已经“更准”？',
        ],
      },
      {
        title: '边界提醒',
        tone: 'amber',
        bullets: [
          '本课不进入 Nyquist 判据。',
          '本课不进入模块 4 的完整整定流程。',
          '本课先建立误差分析与低频补偿入口。',
        ],
      },
    ],
    note: '首屏必须看见路径图、主问题卡和边界卡，不能用互动题替代导入本体。',
    prompts: [
      '为什么 3-6 解决了“更快更稳”之后，3-7 还必须单独回答“为什么更准”？',
      '3-7 与 3-8 的关系是什么，为什么今天先从低频精度切入？',
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
        markdown: `| 本课负责 | 本课不负责 |\n| --- | --- |\n| 通道分析、稳态误差求解、低频补偿路径、频域过渡 | Nyquist 判据、完整整定、模块 4 控制器选型 |`,
      },
    ],
    note: '目标卡与边界表必须同屏，本页不需要学生提交。',
    prompts: [
      '本课四项目标分别围绕哪四个动作展开？',
      '为什么 3-7 必须停在误差分析和低频补偿入口，而不提前滑进完整频域设计？',
    ],
  },
  'step-03': {
    kicker: 'Pre-Assessment',
    intro: '前测不为了拉开成绩差距，而是为了暴露三个最容易把 3-7 做偏的误判：扰动也能套表、增益变大等于型别提高、滞后只是弱积分。',
    sections: [
      {
        title: '常见混淆',
        tone: 'rose',
        bullets: [
          '扰动不是另一种输入型别。',
          '增益变大不等于型别提高。',
          '滞后不是更弱一点的积分。',
        ],
      },
      {
        title: '教师观察点',
        tone: 'violet',
        bullets: ['区分首答与重提。', '优先看错因分布，而不是只看对错率。'],
      },
    ],
    prompts: [
      '为什么显式扰动问题不能直接当成另一种输入型别来套 Kp/Kv/Ka 表？',
      '为什么把滞后看成“更弱一点的积分”会带来错误判断？',
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
    prompts: [
      '为什么四类传函的分母相同？',
      '为什么同一结构下，通道差异会体现在分子上？',
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
        title: '终值定理',
        tone: 'violet',
        markdown: '$$e_{ss}=\\lim_{s\\to 0} sE(s)$$',
      },
      {
        title: '例题 1 题面与结果摘要',
        tone: 'slate',
        markdown: '$$R(s)=\\dfrac{3}{s}+\\dfrac{2}{s^2}+\\dfrac{1}{s^3}$$\n\n本题最终稳态误差为 1/K。',
      },
    ],
    note: '三步法卡和例题题面必须同屏，工作区只能提示漏步，不能直接给答案。',
    prompts: [
      '为什么用终值定理前必须先判断系统稳定？',
      '为什么即使后面学了型别快判，终值定理直接求仍然是通用路径？',
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
        markdown:
          '| 系统型别 | 首个有限静态误差系数 |\n| --- | --- |\n| 0 型 | K_p |\n| I 型 | K_v |\n| II 型 | K_a |',
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
        bullets: [
          '标准负反馈、只问典型给定输入稳态误差：优先快速判。',
          '显式给定与扰动共同存在：优先直接求。',
          '目标是判断是否必须引入积分：先看型别。',
        ],
      },
    ],
    prompts: [
      '什么时候可以优先用型别和静态误差系数快速判断稳态误差？',
      '如果把显式扰动问题也强行折成快判题，最容易漏掉什么？',
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
          '$$G_1(s)=\\dfrac{10}{s(s+2)}$$\n$$G_2(s)=\\dfrac{2}{s+5},\\quad R(s)=\\dfrac{1}{s},\\quad D(s)=\\dfrac{0.2}{s}$$',
      },
      {
        title: '总误差式',
        tone: 'violet',
        markdown:
          '$$E(s)=\\frac{1}{1+G_1(s)G_2(s)}R(s)-\\frac{G_2(s)}{1+G_1(s)G_2(s)}D(s)$$\n$$E(s)=\\frac{s^2+7s+10}{s^2+7s+20}\\cdot\\frac{1}{s}-\\frac{2(s+5)}{s^2+7s+20}\\cdot\\frac{0.2}{s}$$',
      },
      {
        title: '结果解释',
        tone: 'rose',
        bullets: ['结果固定为 e_ss = 0.4。', '0.4 不是套表来的，而是双通道叠加后的极限结果。'],
      },
    ],
    prompts: [
      '为什么给定与扰动共同存在时，第一步必须先写总误差式？',
      '例题 2 的稳态误差 0.4 反映的是哪两条通道叠加后的结果？',
    ],
  },
  'step-08': {
    kicker: 'Gain Vs Type',
    intro: '“误差变小”并不自动等于“误差归零”。先把压小有限误差和结构性归零分开，才能判断什么时候必须引入积分。',
    sections: [
      {
        title: '对照卡',
        tone: 'emerald',
        bullets: [
          '增益调节：压小有限误差，但不改变误差阶次。',
          '型别提高：可能把原本有限误差变成 0。',
        ],
      },
      {
        title: '结论句',
        tone: 'amber',
        body: '想消除结构性误差，第一步不是继续调 K，而是判断是否必须引入积分。',
      },
    ],
    prompts: [
      '为什么增益变大和型别提高都可能让误差变小，但它们不是同一种动作？',
      '遇到想把有限误差结构性变成 0 的目标时，为什么第一步常常是判断是否必须引入积分？',
    ],
  },
  'step-09': {
    kicker: 'Low-Frequency Compensation',
    intro: 'PI 与滞后都站在低频补偿线上，但 PI 的抓手是改型别，滞后的抓手是抬低频增益。收益和代价必须配套理解。',
    sections: [
      {
        title: '路径比较表',
        tone: 'slate',
        markdown:
          '| 路径 | 是否改型别 | 主要收益 | 主要代价 |\n| --- | --- | --- | --- |\n| PI | 是 | 可把某些有限误差结构性变成 0 | 会影响截止频率、相位裕度与时域速度 |\n| 滞后 | 否 | 压小有限误差、抬高 Kv | 引入相位滞后、常把截止频率拉低 |',
      },
      {
        title: '共同点句',
        tone: 'cyan',
        body: 'PI 与滞后都在低频补偿线上，但抓手不同：前者直接改型别，后者主要通过低频增益重分配压小有限误差。',
      },
      {
        title: '禁止误判',
        tone: 'rose',
        bullets: ['不要把滞后简化成“弱一点的积分”。', '不要只记收益，不看代价落点。'],
      },
    ],
    prompts: [
      'PI 为什么会直接改变型别，而滞后通常不会？',
      '滞后怎样通过低频增益重分配来改善有限误差？',
    ],
  },
  'step-10': {
    kicker: 'Time-Domain Design Compare',
    intro: '两张时域设计图必须和指标卡同屏阅读：PI 直接提高型别，滞后则在型别不变的前提下把 Kv 抬到目标值。',
    sections: [
      {
        title: '指标卡',
        tone: 'cyan',
        bullets: ['PI：提高型别，斜坡误差归零。', '滞后：型别不变，把 Kv 抬高到目标值。'],
      },
      {
        title: '比较要求',
        tone: 'violet',
        bullets: ['结构抓手是什么？', '精度收益是什么？', '动态代价落在哪里？'],
      },
    ],
    prompts: [
      'PI 时域设计图上最能体现“提高型别”的证据是什么？',
      '滞后时域设计图里，哪些量说明它没有改型别，但把 Kv 抬到了目标值？',
    ],
  },
  'step-11': {
    kicker: 'Frequency-Domain Transition',
    intro: '3-7 到 3-8 的桥就搭在这里：为什么 PI 更准、PD 更快，先用低频与中频的语言说清楚，再把它接到下一课的统一频域判别。',
    sections: [
      {
        title: '设计顺序卡',
        tone: 'emerald',
        bullets: [
          '纯增益若取 K ≥ 10 才能满足 Kv ≥ 10，但相位裕度不足。',
          '先定 ωc* = 2.5 rad/s。',
          '再布置 PI 零点 ωz = 0.125 rad/s。',
          '最后由幅值条件求 G_PI(s)=3(s+0.125)/s 并回查 PM、ωc。',
        ],
      },
      {
        title: 'PI / PD 对照',
        tone: 'amber',
        markdown:
          '| 方法 | 低频精度 | 截止频率 | 相位裕度 | 时域形态 |\n| --- | --- | --- | --- | --- |\n| PI | 更偏低频精度优先 | 常向低频侧移动 | 容易被压缩，需要回查 | 更容易变慢 |\n| PD | 不主打低频补偿 | 可向高频侧推进 | 更利于抬高 | 更偏动态速度优先 |',
      },
    ],
    prompts: [
      '为什么单纯把 K 调到满足 Kv≥10，常常会先在相位裕度上出问题？',
      '为什么 PI 更偏低频精度优先，而 PD 更偏动态速度优先？',
    ],
  },
  'step-12': {
    kicker: 'Post-Assessment And Wrap-Up',
    intro: '最后只检查两件事：你会不会先选路径，再认代价；你能不能把 3-7 的低频收益和中频代价，平滑翻译成 3-8 的频域判别入口。',
    sections: [
      {
        title: '六条小结',
        tone: 'slate',
        bullets: [
          '稳态误差先分通道。',
          '终值定理是通用路径。',
          '型别和误差系数是标准快判。',
          '增益变大不等于型别提高。',
          'PI 与滞后都不是免费午餐。',
          '下一课转入频域判别语言。',
        ],
      },
      {
        title: '规则表',
        tone: 'violet',
        markdown:
          '| 题型 | 优先路径 |\n| --- | --- |\n| 标准负反馈、只问典型给定输入稳态误差 | 快速判 |\n| 输入与扰动共同存在 | 直接求 |\n| 输入是多项式叠加 | 直接求与快速判均可 |\n| 判断是否必须引入积分 | 先看型别 |',
      },
      {
        title: '下一课去向',
        tone: 'cyan',
        body: '3-8 将把低频收益和中频代价翻译成统一频域判断，用频域语言继续回答“更准”和“更快”如何一起被约束。',
      },
    ],
    prompts: [
      '遇到哪些题型时，应该优先直接求而不是先套型别和误差系数表？',
      '为什么 3-7 的低频收益和中频代价，会自然过渡到 3-8 的统一频域判别语言？',
    ],
  },
};

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
      return step.id === 'step-03' ? { q1: '', q2: '', q3: '' } : { q1: '', q2: '', q3: '', q4: '' };
    case 'hotspot_labeling':
      return Object.fromEntries(HOTSPOT_FIELDS.map((field) => [field.key, '']));
    case 'worked_example_workspace':
      return Object.fromEntries(WORKED_EXAMPLE_FIELDS[step.id as 'step-05' | 'step-07'].map((field) => [field.key, '']));
    case 'triple_match':
      return Object.fromEntries(TRIPLE_MATCH_FIELDS[step.id as 'step-06' | 'step-11'].map((field) => [field.key, '']));
    case 'card_sort':
      return Object.fromEntries(CARD_SORT_ITEMS.map((item) => [item.key, '']));
    case 'structured_compare':
      return Object.fromEntries(STRUCTURED_COMPARE_FIELDS.map((field) => [field.key, '']));
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
      return '正确判断是 **B：若型别不变，斜坡误差最多被压小，不能结构性归零**。';
    case 'step-09':
      return '排序时应抓住两件事：**PI 改型别；滞后抬低频增益但常带来相位滞后和截止频率下降。**';
    case 'step-10':
      return '比较时不要只写“更好”，必须分别写出**结构抓手 / 精度收益 / 动态代价**。';
    case 'step-11':
      return '本页要把“更准 / 更快 / 裕量代价 / 低频补偿”分别配回**PI 或 PD**以及对应频段。';
    case 'step-12':
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
      return getDistribution(
        responses.flatMap((item) =>
          Object.entries(item.response.answers)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}:${trimText(value)}`),
        ),
      );
    case 'hotspot_labeling':
    case 'worked_example_workspace':
    case 'triple_match':
    case 'card_sort':
    case 'structured_compare':
      return responses.map((item) => [item.studentName, trimText(Object.values(item.response.answers).join(' / '))]);
    default:
      return [];
  }
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
  const showPrimaryMedia = Boolean(mediaSrc) && step.id !== 'step-10' && step.id !== 'step-11';

  return (
    <section className="premium-lesson-panel px-5 py-5">
      <div className="premium-lesson-kicker">{blueprint.kicker}</div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm leading-7 sm:text-base">{blueprint.intro}</p>

      {showPrimaryMedia && mediaSrc ? (
        <div className="mt-4">
          <MediaPanel src={mediaSrc} alt={step.title} />
        </div>
      ) : null}

      {step.id === 'step-10' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <MediaPanel src="/course-runtime/lessons/3-7/media/3-7-pi-time-domain-design.png" alt="PI 时域设计图" />
          <MediaPanel src="/course-runtime/lessons/3-7/media/3-7-lag-time-domain-design.png" alt="滞后时域设计图" />
        </div>
      ) : null}

      {step.id === 'step-11' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <MediaPanel src="/course-runtime/lessons/3-7/media/3-7-pi-frequency-design.png" alt="PI 频域设计图" />
          <MediaPanel src="/course-runtime/lessons/3-7/media/3-7-pi-pd-comparison.png" alt="PI 与 PD 对照图" />
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
            (step.id === 'step-03' ? PRETEST_QUESTIONS : POSTTEST_QUESTIONS).map((question) => (
              <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                <div className="mt-3">
                  <ChoiceGroup options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} />
                </div>
              </div>
            ))
          ) : null}

          {step.pageType === 'hotspot_labeling' ? (
            HOTSPOT_FIELDS.map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <TextInput
                    value={draft[field.key] ?? ''}
                    onChange={(value) => updateDraft(field.key, value)}
                    placeholder={`写出图中对应的 ${field.label} 位置说明`}
                  />
                </div>
              </div>
            ))
          ) : null}

          {step.pageType === 'worked_example_workspace' ? (
            WORKED_EXAMPLE_FIELDS[step.id as 'step-05' | 'step-07'].map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.label} />
                </div>
              </div>
            ))
          ) : null}

          {step.pageType === 'triple_match' ? (
            TRIPLE_MATCH_FIELDS[step.id as 'step-06' | 'step-11'].map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.label} />
                </div>
              </div>
            ))
          ) : null}

          {step.pageType === 'card_sort' ? (
            CARD_SORT_ITEMS.map((item) => (
              <div key={item.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{item.label}</div>
                <div className="mt-3">
                  <SelectField
                    value={draft[item.key] ?? ''}
                    onChange={(value) => updateDraft(item.key, value, 'select')}
                    options={[
                      { value: 'pi', label: '归到 PI' },
                      { value: 'lag', label: '归到滞后' },
                    ]}
                  />
                </div>
              </div>
            ))
          ) : null}

          {step.pageType === 'structured_compare' ? (
            STRUCTURED_COMPARE_FIELDS.map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.label} />
                </div>
              </div>
            ))
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
