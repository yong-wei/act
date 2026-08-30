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
  UNIT_3_1_LESSON_STEPS,
  UNIT_3_1_STAGE_LABEL,
  type UNIT_3_1StepDefinition,
  type UNIT_3_1StepResponse,
} from '@/lib/unit-3-1-course';
import {
  POLE_FAMILY_TABS,
  type WorkspaceParameterChange,
} from './workspace';
import { UNIT_3_1InteractiveExplorationPanel } from './interactive-exploration-panel';

type Tone = 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate';

interface StepSection {
  title: string;
  body?: string;
  bullets?: string[];
  markdown?: string;
  tone?: Tone;
}

interface StepBlueprint {
  kicker: string;
  intro: string;
  sections: StepSection[];
  note?: string;
}

interface ChoiceOption {
  value: string;
  label: string;
}

interface ActivityQuestion {
  key: string;
  prompt: string;
  options: ChoiceOption[];
  answer: string;
  explanation: string;
}

interface ActivityField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'radio';
  placeholder?: string;
  options?: ChoiceOption[];
  answer?: string;
}

interface ActivityCard {
  id: string;
  title: string;
  kind: 'question' | 'field';
  question?: ActivityQuestion;
  field?: ActivityField;
}

interface ActivitySpec {
  kind: 'none' | 'cards';
  helper: string;
  releaseLabel?: string;
  grid: 'single' | 'double';
  cards: ActivityCard[];
}

export interface UNIT_3_1TeacherResponseItem {
  studentName: string;
  response: UNIT_3_1StepResponse;
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

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function renderMarkdown(markdown: string) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={MARKDOWN_COMPONENTS}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function renderInlineMathText(text: string) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <span>{children}</span>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function getStepBlueprint(step: UNIT_3_1StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Roadmap',
        intro: '3-1 的任务不是重复二阶指标，而是把模块 2 的低阶直觉推进到极点统领稳定、模态和近似判断的机理语言。',
        sections: [
          {
            title: '本课位置',
            tone: 'cyan',
            bullets: ['2-4：对象越来越完整', '3-1：开始用极点解释为什么会这样', '3-2：再把稳定边界推到可视化层面'],
          },
          {
            title: '课堂边界',
            tone: 'amber',
            bullets: ['只讨论纯极点系统', '不进入劳斯、根轨迹与判稳图法', '不提前讲控制器设计'],
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Conflict',
        intro: '把参考模型和一个可拖动的三极点系统放到同一块面板里，直接观察：同一对主导极点之下，附加模态退场得够不够快，决定了右侧响应是否还会跟着走。',
        sections: [
          {
            title: '参考模型与三极点模板',
            tone: 'amber',
            markdown: `$$
G_{\\mathrm{ref}}(s)=\\frac{3.2}{s^2+1.6s+3.2}
$$

$$
G_3(s,p_3)=\\frac{3.2|p_3|}{(s+|p_3|)(s^2+1.6s+3.2)},\\qquad p_3<0
$$`,
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Goals',
        intro: '本课只形成一条判断链：先守稳定底线，再把极点翻译成模态，再用时域与频域证据决定近似是否可信。',
        sections: [
          {
            title: '四项目标',
            tone: 'emerald',
            bullets: ['判稳定底线', '把极点翻译成模态', '用时域证据筛选近似', '用频域证据复核近似'],
          },
          {
            title: '主线顺序',
            tone: 'slate',
            bullets: ['稳定底线', '模态语言', '时域筛选', '频域复核', '卷积收束'],
          },
          {
            title: '课堂边界',
            tone: 'amber',
            bullets: ['不进入劳斯判据', '不进入根轨迹与 Nyquist/Bode 判稳', '不进入频域校正设计'],
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Pre-Assessment',
        intro: '前测不是为了算分，而是为了先暴露三个起点误区：稳定不等于够好，同主导极点不等于同响应，更靠左也不是绝对判据。',
        sections: [
          {
            title: '本页只暴露误区',
            tone: 'amber',
            bullets: ['稳定不等于性能已可接受', '主导极点不是唯一证据', '经验句必须配合额外证据'],
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Stability First',
        intro: '在谈近似和性能之前，先回答系统能不能收敛。只要稳定底线没有站稳，后面的模态语言和低阶近似都没有前提。',
        sections: [
          {
            title: '稳定起点',
            tone: 'slate',
            markdown: `$$
\\Delta(s)=a_ns^n+\\cdots+a_1s+a_0=0,\\qquad \\Re(p_i)<0
$$`,
          },
          {
            title: '三种情况',
            tone: 'cyan',
            bullets: ['左半平面：渐近稳定', '虚轴：临界稳定，前提要重审', '右半平面：不稳定，先停止谈近似'],
          },
        ],
      };
    case 'step-06':
      return {
        kicker: 'Modes',
        intro: '极点并不是复平面上的静态标签，而是直接写进响应表达式的运动模态。',
        sections: [
          {
            title: '一般模态展开',
            tone: 'slate',
            markdown: `$$
G(s)=\\sum_{i=1}^{m}\\sum_{r=1}^{q_i}\\frac{A_{i,r}}{(s-p_i)^r},\\qquad
g(t)=\\sum_{i=1}^{m}\\sum_{r=1}^{q_i}\\frac{A_{i,r}}{(r-1)!}t^{r-1}e^{p_i t}
$$`,
          },
          {
            title: '紧凑读法',
            tone: 'cyan',
            bullets: ['实部决定衰减速度', '虚部决定振荡节奏', '重数决定时间因子', '留数决定模态权重'],
          },
        ],
      };
    case 'step-07':
      return {
        kicker: 'Families',
        intro: '负实极点、共轭复根、右半平面极点和重根，虽然都叫极点，但对应的响应形态并不一样。',
        sections: [
          {
            title: '三类极点与重根',
            tone: 'slate',
            markdown: `$$
e^{pt},\\qquad e^{\\sigma t}\\sin(\\omega t+\\phi),\\qquad (A_1+A_2t)e^{pt}
$$`,
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Worked Example',
        intro: '最小例题先给出三个传递函数与分析问题，再按讲义顺序逐步显影共享主导极点、显式响应、时间尺度比较和指标核验。',
        sections: [
          {
            title: '三个传递函数',
            tone: 'slate',
            markdown: `$$
G_{\\mathrm{ref}}(s)=\\frac{3.2}{s^2+1.6s+3.2}
$$

$$
G_{\\mathrm{A}}(s)=\\frac{16}{(s+5)(s^2+1.6s+3.2)}
$$

$$
G_{\\mathrm{B}}(s)=\\frac{4.48}{(s+1.4)(s^2+1.6s+3.2)}
$$`,
          },
          {
            title: '题目',
            tone: 'cyan',
            markdown: `$$
 p_{1,2}=-0.8 \\pm j1.6
$$

- 分析三组模型在时域响应、运动模态与动态性能上的差异。
- 判断附加极点什么时候还能忽略，什么时候已经改写了主要动态。
- 说明为什么系统 A 仍接近参考模型，而系统 B 已明显偏离参考模型。`,
          },
        ],
        note: '显影只能隐藏推导、显式响应、时间尺度比较与指标核验，不能隐藏题面和三个传递函数。点击当前步骤可继续显影下一层。',
      };
    case 'step-09':
      return {
        kicker: 'Boundary',
        intro: '“更靠左 3 到 5 倍”只是时域筛选的第一轮经验，不是完整定理。',
        sections: [
          {
            title: '还要补看的风险',
            tone: 'amber',
            bullets: ['附加模态权重是否仍大', '是否存在重根拖尾', '极点是否局部聚集', '图形和数值证据是否已经反驳经验句'],
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'Bridge',
        intro: '时域曲线能告诉我们“像不像”，但还不足以说明“为什么像/为什么不像”。这一步要把问题重新抛回频域。',
        sections: [
          {
            title: '频域追问',
            tone: 'cyan',
            bullets: ['附加极点从哪开始影响频响', '主要带宽落在什么量级', '两者是否已经逼近'],
          },
        ],
      };
    case 'step-11':
      return {
        kicker: 'Bode Evidence',
        intro: '频域页必须把三条频率特性表达式一次性写全，再把左侧附加极点位置与右侧 Bode 图上的转折频率、带宽读数直接连起来。',
        sections: [
          {
            title: '三条频率特性表达式',
            tone: 'slate',
            markdown: `$$
\\left|G_{\\mathrm{ref}}(j\\omega)\\right|=\\frac{3.2}{\\sqrt{(3.2-\\omega^2)^2+(1.6\\omega)^2}}
$$

$$
\\left|G_{A}(j\\omega)\\right|=\\frac{16}{\\sqrt{\\omega^2+5^2}\\,\\sqrt{(3.2-\\omega^2)^2+(1.6\\omega)^2}}
$$

$$
\\left|G_{B}(j\\omega)\\right|=\\frac{4.48}{\\sqrt{\\omega^2+1.4^2}\\,\\sqrt{(3.2-\\omega^2)^2+(1.6\\omega)^2}}
$$

$$
\\omega_n\\approx1.79\\ \\text{rad/s},\\qquad \\omega_{BW}\\approx2.39\\ \\text{rad/s},\\qquad
\\omega_{\\mathrm{break}}=|p_3|
$$`,
          },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Judge Then Compare',
        intro: '双域判断必须先自己写，再用悬浮 AI 助手核对证据链。AI 只检查推理顺序，不替你跳过观察和判断。',
        sections: [
          {
            title: '本页标准动作',
            tone: 'emerald',
            bullets: ['先写时域证据', '再写频域证据', '最后打开全局 AI 助手核对证据链'],
          },
        ],
        note: 'AI 对照默认通过全局悬浮助手完成，不在正文里额外渲染页内 AI 面板。',
      };
    case 'step-13':
      return {
        kicker: 'Convolution',
        intro: '这一页先把卷积原理写清楚，再看图 6，随后用一个三阶模态例子做具体分析，最后才回到图 7 总结“输入激发模态，但不改写极点结构”。',
        sections: [
          {
            title: '卷积原理',
            tone: 'slate',
            markdown: `$$
y(t)=\\int_0^t g(t-\\tau)u(\\tau)\\,\\mathrm{d}\\tau
$$

$$
y_{\\text{step}}(t)=\\int_0^t g(t-\\tau)\\,\\mathrm{d}\\tau
$$`,
          },
        ],
        note: '负留数只说明权重方向为负，不等于系统不稳定。',
      };
    case 'step-14':
      return {
        kicker: 'Post-Assessment',
        intro: '后测要把稳定底线、主导极点近似和卷积/模态语言重新串回一条完整解释链。',
        sections: [
          {
            title: '本页任务',
            tone: 'amber',
            bullets: ['先判断会不会发散', '再判断近似能否成立', '最后说明为什么能解释'],
          },
        ],
      };
    case 'step-15':
      return {
        kicker: 'Takeaways',
        intro: '3-1 最重要的产出，是形成“先守底线，再谈模态，再谈双域近似”的出口判断。',
        sections: [
          {
            title: '六条结论',
            tone: 'emerald',
            bullets: [
              '稳定底线先于一切近似。',
              '极点会直接写进模态表达式。',
              '主导极点重要，但不是唯一证据。',
              '时域筛选只是第一轮判断。',
              '频域要复核带宽是否被侵入。',
              '卷积激发模态，但不改写极点结构。',
            ],
          },
        ],
      };
    default:
      return {
        kicker: 'Lesson',
        intro: step.hint,
        sections: [],
      };
  }
}

function getStepActivity(step: UNIT_3_1StepDefinition): ActivitySpec {
  switch (step.id) {
    case 'step-02':
      return {
        kind: 'cards',
        helper: '先完成判断，再等待教师揭示参考解释。',
        releaseLabel: '释放判断区',
        grid: 'single',
        cards: [
          {
            id: 'conflict-source',
            title: '同主导极点但响应仍不同，更关键的额外证据是什么？',
            kind: 'question',
            question: {
              key: 'conflict-source',
              prompt: '同主导极点但响应仍不同，更关键的额外证据是什么？',
              options: [
                { value: 'same', label: '只要主导极点相同，主要响应就一定几乎一样' },
                { value: 'extra', label: '还要看附加模态退场快慢' },
              ],
              answer: 'extra',
              explanation: '主导极点很重要，但附加模态是否足够快地退场，仍会显著改写主要动态。',
            },
          },
        ],
      };
    case 'step-04':
      return {
        kind: 'cards',
        helper: '三道前测题都要求先判断，再用一句话说明理由。',
        releaseLabel: '释放前测',
        grid: 'single',
        cards: [
          {
            id: 'pre-stability',
            title: '系统稳定后，下面哪句话仍然可能是对的？',
            kind: 'question',
            question: {
              key: 'pre-stability',
              prompt: '系统稳定后，下面哪句话仍然可能是对的？',
              options: [
                { value: 'good', label: '既然稳定，就一定已经足够快、足够平稳' },
                { value: 'not-enough', label: '稳定只是底线，动态品质仍可能不理想' },
              ],
              answer: 'not-enough',
              explanation: '稳定只回答“是否收敛”，不自动回答“是否够快、够平稳”。',
            },
          },
          {
            id: 'pre-dominant',
            title: '主导极点更准确的理解是：',
            kind: 'question',
            question: {
              key: 'pre-dominant',
              prompt: '主导极点更准确的理解是：',
              options: [
                { value: 'only', label: '系统中唯一真正重要的极点' },
                { value: 'main', label: '最能主导主要动态，但不是唯一证据的极点' },
              ],
              answer: 'main',
              explanation: '主导极点主导主要动态，但附加模态仍可能保留影响。',
            },
          },
          {
            id: 'pre-left',
            title: '“附加极点更靠左”最合理的理解是：',
            kind: 'question',
            question: {
              key: 'pre-left',
              prompt: '“附加极点更靠左”最合理的理解是：',
              options: [
                { value: 'rule', label: '这是绝对判据，可以直接下结论' },
                { value: 'heuristic', label: '这是经验起点，还要配合权重和频域证据' },
              ],
              answer: 'heuristic',
              explanation: '更靠左常常有帮助，但还必须看权重、重根和主要带宽等因素。',
            },
          },
        ],
      };
    case 'step-05':
      return {
        kind: 'cards',
        helper: '先写出一句判断理由，再等待教师揭示参考解释。',
        grid: 'single',
        cards: [
          {
            id: 'stability-judgement',
            title: '若出现虚轴根或右半平面根，为什么不能直接谈高阶近似？',
            kind: 'field',
            field: {
              key: 'stability-judgement',
              label: '你的判断理由',
              type: 'textarea',
              placeholder: '例如：系统连收敛都不能保证，后续近似语言就没有前提。',
              answer: '近似讨论默认建立在系统可收敛的前提上。若出现虚轴根或右半平面根，就必须先重新确认稳定性与讨论前提。',
            },
          },
        ],
      };
    case 'step-06':
      return {
        kind: 'cards',
        helper: '把三个判断分别配对到正确的响应现象。',
        grid: 'single',
        cards: [
          {
            id: 'negative-real',
            title: '负实极点最直接对应哪种现象？',
            kind: 'field',
            field: {
              key: 'negative-real',
              label: '负实极点最直接对应哪种现象？',
              type: 'radio',
              answer: 'decay',
              options: [
                { value: 'decay', label: '单调衰减、不过零振荡' },
                { value: 'grow', label: '指数发散' },
                { value: 'factor', label: '自动带出时间因子 t' },
              ],
            },
          },
          {
            id: 'complex-pair',
            title: '左半平面共轭复根最直接对应哪种现象？',
            kind: 'field',
            field: {
              key: 'complex-pair',
              label: '左半平面共轭复根最直接对应哪种现象？',
              type: 'radio',
              answer: 'oscillation',
              options: [
                { value: 'oscillation', label: '振荡但衰减收敛' },
                { value: 'grow', label: '指数发散' },
                { value: 'flat', label: '完全不振荡' },
              ],
            },
          },
          {
            id: 'repeated-pole',
            title: '重根相比单根，额外带来了什么？',
            kind: 'field',
            field: {
              key: 'repeated-pole',
              label: '重根相比单根，额外带来了什么？',
              type: 'radio',
              answer: 'time-factor',
              options: [
                { value: 'time-factor', label: '额外时间因子，拖尾更明显' },
                { value: 'new-pole', label: '一组全新的极点' },
                { value: 'stability-switch', label: '稳定性必然改变' },
              ],
            },
          },
        ],
      };
    case 'step-07':
      return {
        kind: 'cards',
        helper: '两张卡分开提交：一张做对应判断，一张解释重根风险。',
        grid: 'double',
        cards: [
          {
            id: 'pole-family-match',
            title: '把负实极点、左半平面共轭复极点、右半平面极点与响应形态对应起来。',
            kind: 'field',
            field: {
              key: 'pole-family-match',
              label: '最容易混淆的是哪一种？',
              type: 'radio',
              answer: 'complex-pair',
              options: POLE_FAMILY_TABS.map((tab) => ({ value: tab.key, label: tab.label })),
            },
          },
          {
            id: 'repeated-root-reason',
            title: '说明为什么重根不能只按“位置差不多”处理。',
            kind: 'field',
            field: {
              key: 'repeated-root-reason',
              label: '你的解释',
              type: 'textarea',
              placeholder: '例如：重根会引入额外时间因子，使拖尾更明显。',
              answer: '重根会引入额外的时间因子，即使位置接近也可能显著改变拖尾和过渡过程，不能只看“位置差不多”。',
            },
          },
        ],
      };
    case 'step-08':
      return {
        kind: 'cards',
        helper: '两张半宽卡分别解释系统 A 与系统 B 的时域判断，不合并提交。',
        grid: 'double',
        cards: [
          {
            id: 'model-a-reason',
            title: '说明系统 A 为什么仍接近参考模型。',
            kind: 'field',
            field: {
              key: 'model-a-reason',
              label: '系统 A 的理由',
              type: 'textarea',
              placeholder: '例如：附加极点更靠左，附加模态在主要动态窗口前已退场。',
              answer: '系统 A 的附加极点更靠左，附加模态退场更快，因此主要动态仍主要由主导共轭极点决定。',
            },
          },
          {
            id: 'model-b-reason',
            title: '说明系统 B 为什么已明显偏离参考模型。',
            kind: 'field',
            field: {
              key: 'model-b-reason',
              label: '系统 B 的理由',
              type: 'textarea',
              placeholder: '例如：附加极点离主导极点太近，附加模态仍在主要动态窗口内持续发声。',
              answer: '系统 B 的附加极点离主导极点过近，附加模态没有及时退场，因此已经改写了主要动态。',
            },
          },
        ],
      };
    case 'step-09':
      return {
        kind: 'cards',
        helper: '两张卡分别做时域初判与证据边界说明。',
        grid: 'double',
        cards: [
          {
            id: 'time-screening',
            title: '若主导极点为 -1 ± j2，附加极点为 -6，你会先做怎样的时域判断？',
            kind: 'field',
            field: {
              key: 'time-screening',
              label: '你的时域初判',
              type: 'textarea',
              placeholder: '例如：先把它视为可能可近似，但还要继续检查图形与权重证据。',
              answer: '我会先把它视为“可能可近似”的候选对象，但还必须继续检查模态权重、图形和数值证据。',
            },
          },
          {
            id: 'visual-evidence-boundary',
            title: '说明为什么这一步仍不能取代图形和数值证据。',
            kind: 'field',
            field: {
              key: 'visual-evidence-boundary',
              label: '你的边界说明',
              type: 'textarea',
              placeholder: '例如：经验句只做筛选，真正结论仍要回到图形和指标。',
              answer: '“更靠左”只是筛选起点，真正结论仍要回到图形、指标和权重证据，不能直接替代可视比较。',
            },
          },
        ],
      };
    case 'step-10':
      return {
        kind: 'cards',
        helper: '先回答是否还要看频域，再进入下一步 Bode 对照。',
        grid: 'single',
        cards: [
          {
            id: 'need-frequency-check',
            title: '时域已经相近时，是否还必须检查频域证据？',
            kind: 'question',
            question: {
              key: 'need-frequency-check',
              prompt: '时域已经相近时，是否还必须检查频域证据？',
              options: [
                { value: 'no', label: '不需要，时域看起来像就足够了' },
                { value: 'yes', label: '需要，还要检查附加极点是否已侵入主要带宽' },
              ],
              answer: 'yes',
              explanation: '时域相近并不自动等于频域相近，还必须补看附加极点是否已经侵入主要带宽。',
            },
          },
        ],
      };
    case 'step-11':
      return {
        kind: 'cards',
        helper: '先判断哪一个附加极点侵入带宽，再单独说明为什么系统 B 已不宜继续看成原来的低阶对象。',
        grid: 'double',
        cards: [
          {
            id: 'bandwidth-intrusion',
            title: '哪一个附加极点已经侵入主要带宽？',
            kind: 'question',
            question: {
              key: 'bandwidth-intrusion',
              prompt: '哪一个附加极点已经侵入主要带宽？',
              options: [
                { value: 'a', label: '系统 A 的附加极点（-5）' },
                { value: 'b', label: '系统 B 的附加极点（-1.4）' },
              ],
              answer: 'b',
              explanation: '系统 B 的附加极点转折频率更接近主要带宽，因此更容易侵入主要动态工作频段。',
            },
          },
          {
            id: 'system-b-frequency-reason',
            title: '说明为什么系统 B 不宜继续视为原来的低阶对象。',
            kind: 'field',
            field: {
              key: 'system-b-frequency-reason',
              label: '你的频域说明',
              type: 'textarea',
              placeholder: '例如：附加极点的转折频率已经逼近主要带宽。',
              answer: '因为系统 B 的附加极点转折频率已经逼近主要带宽，附加模态在主频段内留下了不可忽略的频域痕迹。',
            },
          },
        ],
      };
    case 'step-12':
      return {
        kind: 'cards',
        helper: '两张卡先完成自判，再到悬浮 AI 助手里核对证据链，不在正文里额外开页内 AI 面板。',
        grid: 'double',
        cards: [
          {
            id: 'time-domain-evidence',
            title: '给出时域判断，并说明依据。',
            kind: 'field',
            field: {
              key: 'time-domain-evidence',
              label: '你的时域证据',
              type: 'textarea',
              placeholder: '例如：模型 A 的曲线更贴近参考模型，附加模态退场更快。',
              answer: '时域上，模型 A 更接近参考模型，因为附加模态退场更快；模型 B 仍保留明显附加模态影响。',
            },
          },
          {
            id: 'frequency-domain-evidence',
            title: '给出频域判断，并说明依据。',
            kind: 'field',
            field: {
              key: 'frequency-domain-evidence',
              label: '你的频域证据',
              type: 'textarea',
              placeholder: '例如：附加极点转折频率若逼近主要带宽，就不能再把它当作无关高频扰动。',
              answer: '频域上，要检查附加极点转折频率是否逼近主要带宽；一旦侵入主要带宽，就不能继续把它当作无关高频扰动。',
            },
          },
        ],
      };
    case 'step-13':
      return {
        kind: 'cards',
        helper: '两张卡分别判断退场最快的模态和“负留数不等于不稳定”的原因。',
        grid: 'double',
        cards: [
          {
            id: 'fastest-modal',
            title: '在 $2.4e^{-t}$、$-3e^{-2t}$、$0.6e^{-6t}$ 中，哪一个模态退场最快？',
            kind: 'question',
            question: {
              key: 'fastest-modal',
              prompt: '在 $2.4e^{-t}$、$-3e^{-2t}$、$0.6e^{-6t}$ 中，哪一个模态退场最快？',
              options: [
                { value: 'e1', label: '$2.4e^{-t}$' },
                { value: 'e2', label: '$-3e^{-2t}$' },
                { value: 'e6', label: '$0.6e^{-6t}$' },
              ],
              answer: 'e6',
              explanation: '指数衰减率由实部大小决定，-6 对应的模态退场最快。',
            },
          },
          {
            id: 'negative-residue-reason',
            title: '说明为什么负留数不等于系统不稳定。',
            kind: 'field',
            field: {
              key: 'negative-residue-reason',
              label: '你的解释',
              type: 'textarea',
              placeholder: '例如：负留数只说明该模态权重方向为负，不改变极点所在半平面。',
              answer: '负留数只说明该模态的权重方向为负，不会把极点移到右半平面，因此不等于系统不稳定。',
            },
          },
        ],
      };
    case 'step-14':
      return {
        kind: 'cards',
        helper: '后测三张卡逐题提交，先判断稳定，再判断近似，再解释卷积为什么成立。',
        releaseLabel: '释放后测',
        grid: 'single',
        cards: [
          {
            id: 'post-stability',
            title: '若存在右半平面极点，系统是否还能稳定？',
            kind: 'question',
            question: {
              key: 'post-stability',
              prompt: '若存在右半平面极点，系统是否还能稳定？',
              options: [
                { value: 'stable', label: '仍可稳定，只是超调更大' },
                { value: 'unstable', label: '不能稳定，必须先停止谈近似' },
              ],
              answer: 'unstable',
              explanation: '右半平面极点意味着指数发散，首先就失去了讨论近似和性能的前提。',
            },
          },
          {
            id: 'post-approximation',
            title: '当附加极点转折频率落入主要带宽时，低阶近似是否仍可靠，并说明理由。',
            kind: 'field',
            field: {
              key: 'post-approximation',
              label: '你的近似判断',
              type: 'textarea',
              placeholder: '例如：不可靠，因为附加极点已经侵入主要动态工作频段。',
              answer: '通常不再可靠，因为附加极点已经侵入主要带宽，会在主要动态工作频段内留下不可忽略的频域痕迹。',
            },
          },
          {
            id: 'post-step-convolution',
            title: '为什么阶跃响应可以看成多个延时脉冲响应的叠加？',
            kind: 'field',
            field: {
              key: 'post-step-convolution',
              label: '你的卷积解释',
              type: 'textarea',
              placeholder: '例如：阶跃可以看成一连串持续叠加的输入微元，每个微元都会激发一份脉冲响应。',
              answer: '因为阶跃输入可以看成不断叠加的输入微元，每个微元都会激发一份脉冲响应，整体输出就是这些延时脉冲响应的卷积叠加。',
            },
          },
        ],
      };
    default:
      return {
        kind: 'none',
        helper: '本页以教师讲授和观察推进为主。',
        grid: 'single',
        cards: [],
      };
  }
}

function getDefaultDraft(activity: ActivitySpec, savedResponse?: UNIT_3_1StepResponse) {
  if (savedResponse) {
    return savedResponse.answers;
  }
  const defaults: Record<string, string> = {};
  for (const card of activity.cards) {
    if (card.kind === 'question' && card.question) {
      defaults[card.question.key] = '';
    }
    if (card.kind === 'field' && card.field) {
      defaults[card.field.key] = '';
    }
  }
  return defaults;
}

function getWordCloudEntries(responses: UNIT_3_1TeacherResponseItem[]) {
  const counts = new Map<string, number>();
  for (const item of responses) {
    Object.values(item.response.answers)
      .join(' ')
      .split(/[\s,，。；;、/]+/)
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)
      .forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12);
}

function renderFieldValue(field: ActivityField | undefined, value: string): ReactNode {
  if (!field) {
    return value || '未作答';
  }
  if (field.type !== 'radio') {
    return value || '未作答';
  }
  const label = field.options?.find((option) => option.value === value)?.label ?? value ?? '未作答';
  return typeof label === 'string' ? renderInlineMathText(label) : label;
}

function buildStudentFieldId(stepId: string, fieldKey: string) {
  return `${stepId}-${fieldKey}`;
}

function StepInlineVisual({
  step,
  onParameterChange,
}: {
  step: UNIT_3_1StepDefinition;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  return <StepInlineVisualContent key={step.id} step={step} onParameterChange={onParameterChange} />;
}

function StepInlineVisualContent({
  step,
  onParameterChange,
}: {
  step: UNIT_3_1StepDefinition;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [activeTab, setActiveTab] = useState<typeof POLE_FAMILY_TABS[number]['key']>('negative-real');
  const [revealedCount, setRevealedCount] = useState(0);
  const activeFamily = POLE_FAMILY_TABS.find((item) => item.key === activeTab) ?? POLE_FAMILY_TABS[0];

  if (step.id === 'step-02') {
    return <UNIT_3_1InteractiveExplorationPanel mode="step" defaultPoleMagnitude={5} onParameterChange={onParameterChange} />;
  }

  if (step.id === 'step-07') {
    return (
      <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">极点家族对照</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {POLE_FAMILY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                onParameterChange?.({
                  key: 'poleFamilyTab',
                  value: POLE_FAMILY_TABS.findIndex((item) => item.key === tab.key),
                  source: 'toggle',
                });
              }}
              className={`premium-lesson-tone-pill ${activeTab === tab.key ? 'premium-tone-cyan' : 'premium-tone-slate'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="premium-lesson-surface-elevated mt-4 px-4 py-4 text-sm">
          <div className="font-medium">{activeFamily.label}</div>
          <div className="premium-lesson-muted mt-2 text-sm">{renderMarkdown(`$$${activeFamily.formula}$$`)}</div>
          <div className="mt-2">{activeFamily.phenomenon}</div>
          <div className="premium-lesson-tone-block premium-tone-amber mt-3">{activeFamily.misconception}</div>
        </div>
      </section>
    );
  }

  if (step.id === 'step-08') {
    const revealSteps = [
      {
        title: '先抽出共同主导极点与参考二阶参数',
        markdown: `三组模型共享主导共轭极点 $p_{1,2}=-0.8\\pm j1.6$。  
参考二阶模型满足
$$
\\omega_n=\\sqrt{3.2}\\approx1.789,\\qquad
\\zeta=\\frac{1.6}{2\\sqrt{3.2}}\\approx0.447,\\qquad
\\omega_d=\\omega_n\\sqrt{1-\\zeta^2}=1.6
$$`,
      },
      {
        title: '写出三条显式阶跃响应',
        markdown: `$$
y_{\\mathrm{ref}}(t)=1-e^{-0.8t}\\left(\\cos 1.6t+0.5\\sin 1.6t\\right)
$$

$$
y_{\\mathrm{A}}(t)=1-0.1584e^{-5t}-0.8416e^{-0.8t}\\cos 1.6t-0.9158e^{-0.8t}\\sin 1.6t
$$

$$
y_{\\mathrm{B}}(t)=1-1.0959e^{-1.4t}+0.0959e^{-0.8t}\\cos 1.6t-0.9110e^{-0.8t}\\sin 1.6t
$$`,
      },
      {
        title: '比较时间尺度与附加模态',
        markdown: `主导模态时间常数约为 $1/0.8=1.25\\ \\text{s}$。  
系统 A 的附加模态是 $0.1584e^{-5t}$，时间常数约为 $0.2\\ \\text{s}$，会在主要动态真正展开前快速退场。  
系统 B 的附加模态是 $1.0959e^{-1.4t}$，时间常数约为 $0.714\\ \\text{s}$，已经落入主要动态的同一时间尺度。`,
      },
      {
        title: '回到动态性能指标核验',
        markdown: `参考模型满足
$$
M_p\\approx20.79\\%,\\qquad t_p=\\frac{\\pi}{1.6}\\approx1.963\\ \\text{s},\\qquad t_s(2\\%)\\approx\\frac{4}{0.8}=5.00\\ \\text{s}
$$

系统 A 的数值结果仍与基线接近；系统 B 的 $t_p$ 被拉长到约 $2.829\\ \\text{s}$、$M_p$ 下降到约 $7.04\\%$，已经不能继续当作同一条主要动态。`,
      },
    ];
    const nextStep = revealSteps[revealedCount];
    const canRevealMore = revealedCount < revealSteps.length;

    return (
      <>
        <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="premium-lesson-title text-sm font-medium">例题逐步显影区</div>
              <div className="premium-lesson-muted mt-1 text-sm">
                {nextStep ? `当前阅读焦点：${nextStep.title}` : '全部步骤已显影，可回看并串联完整判断链。'}
              </div>
              <div className="premium-lesson-caption mt-2 text-xs">点击当前步骤可继续显影下一层。</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRevealedCount((count) => Math.min(count + 1, revealSteps.length))}
                disabled={revealedCount >= revealSteps.length}
                className="premium-lesson-action-secondary disabled:opacity-40"
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
                题面已固定显示：先看三个传递函数，再分析三组模型在时域响应、运动模态与动态性能上的差异。点击此处或上方“显示下一步”，逐步展开推导和计算过程。
              </button>
            ) : null}
            {revealSteps.slice(0, revealedCount).map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => {
                  if (index === revealedCount - 1 && canRevealMore) {
                    setRevealedCount((count) => Math.min(count + 1, revealSteps.length));
                  }
                }}
                className={`premium-lesson-surface-elevated rounded-2xl px-4 py-4 text-left ${
                  index === revealedCount - 1 && canRevealMore ? 'cursor-pointer ring-1 ring-cyan-400/40' : 'cursor-default'
                }`}
              >
                <div className="premium-lesson-kicker">步骤 {index + 1}</div>
                <div className="premium-lesson-title mt-1 text-sm font-semibold">{item.title}</div>
                <div className="mt-2 text-sm leading-7">{renderMarkdown(item.markdown)}</div>
                {index === revealedCount - 1 && canRevealMore ? (
                  <div className="premium-lesson-caption mt-3 text-xs">点击当前步骤可继续显影下一层。</div>
                ) : null}
              </button>
            ))}
          </div>
        </section>
        <UNIT_3_1InteractiveExplorationPanel mode="step" defaultPoleMagnitude={5} onParameterChange={onParameterChange} />
      </>
    );
  }

  if (step.id === 'step-11') {
    return <UNIT_3_1InteractiveExplorationPanel mode="bode" defaultPoleMagnitude={5} onParameterChange={onParameterChange} />;
  }

  if (step.id === 'step-13') {
    return (
      <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">卷积与模态双图证据区</div>
        <div className="premium-lesson-muted mt-2 text-sm">
          先看图 6 理解“阶跃响应来自延时脉冲响应的连续叠加”，再看具体例子和图 7 读出留数符号与衰减节奏如何共同进入总响应。
        </div>
        <div className="mt-4 grid gap-4">
          <figure className="premium-lesson-surface-elevated overflow-hidden px-3 py-3">
            <Image
              src="/course-runtime/lessons/3-1/media/3-1-pp-06-convolution-step-from-impulse.svg"
              alt="卷积叠加图"
              width={1200}
              height={720}
              unoptimized
              className="h-auto w-full rounded-2xl border border-border/60 bg-background/60"
            />
            <figcaption className="premium-lesson-muted mt-2 text-xs">
              图 6：把单位阶跃响应读成许多延时脉冲响应沿时间轴连续叠加。
            </figcaption>
          </figure>
          <div className="premium-lesson-tone-block premium-tone-cyan text-sm">
            <div className="font-medium">卷积图下面继续给出具体例子</div>
            <div className="mt-2 text-sm leading-7">
              {renderMarkdown(`$$
G(s)=\\frac{12}{(s+1)(s+2)(s+6)}
$$

$$
g(t)=2.4e^{-t}-3e^{-2t}+0.6e^{-6t}
$$`)}
            </div>
          </div>
          <div className="premium-lesson-tone-block premium-tone-cyan text-sm">
            <div className="font-medium">具体例子怎么读</div>
            <div className="mt-2 text-sm leading-7">
              {renderMarkdown(`在 $2.4e^{-t}-3e^{-2t}+0.6e^{-6t}$ 里，衰减最快的是 $0.6e^{-6t}$；负号只说明 $-3e^{-2t}$ 这一项在总响应中起抵消作用，不会把极点推到右半平面。`)}
            </div>
          </div>
          <figure className="premium-lesson-surface-elevated overflow-hidden px-3 py-3">
            <Image
              src="/course-runtime/lessons/3-1/media/3-1-pp-04-modal-superposition-high-order.svg"
              alt="模态叠加示意图"
              width={1200}
              height={720}
              unoptimized
              className="h-auto w-full rounded-2xl border border-border/60 bg-background/60"
            />
            <figcaption className="premium-lesson-muted mt-2 text-xs">图 7：三阶模态例子里，不同留数与不同衰减节奏怎样共同构成总响应。</figcaption>
          </figure>
        </div>
      </section>
    );
  }

  return null;
}

export function UNIT_3_1KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft px-4 py-5">
      <div className="premium-lesson-kicker">Course Bridge</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 2-4 到 3-2：3-1 是结构机理层的入口</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['2-4', '先用频域图形对象收束模块 2 的基础直觉。'],
          ['3-1', '开始解释极点为什么能统领稳定、模态与低阶近似。'],
          ['3-2', '下一课把稳定底线推进到稳定边界可视化。'],
        ].map(([title, body], index) => (
          <div
            key={title}
            className={`premium-lesson-surface-elevated px-4 py-4 ${index === 1 ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            <div className="premium-lesson-title text-base font-semibold">{title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getMediaCaption(stepId: string) {
  switch (stepId) {
    case 'step-05':
      return '复平面稳定区、临界边界与失稳区对照图。';
    case 'step-07':
      return '三类极点与典型响应形态的对应图。';
    case 'step-15':
      return '本课总结信息图：先守稳定底线，再读模态，再做双域近似判断。';
    default:
      return null;
  }
}

export function UNIT_3_1StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_1StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = useMemo(() => getStepBlueprint(step), [step]);
  const primarySections = step.id === 'step-03' ? blueprint.sections.slice(0, 2) : blueprint.sections;
  const trailingSections = step.id === 'step-03' ? blueprint.sections.slice(2) : [];

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="premium-lesson-tone-pill premium-tone-slate">{UNIT_3_1_STAGE_LABEL[step.stage]}</span>
        <span className="premium-lesson-tone-pill premium-tone-cyan">{blueprint.kicker}</span>
        <span className="premium-lesson-tone-pill premium-tone-amber">⏱ {step.duration}</span>
      </div>
      <h2 className="premium-lesson-title mt-4 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm leading-7">{blueprint.intro}</p>

      <div className={`mt-5 grid gap-4 ${step.id === 'step-03' ? 'lg:grid-cols-2' : ''}`}>
        {primarySections.map((section) => (
          <div key={section.title} className={`premium-lesson-tone-block ${getToneClass(section.tone)}`}>
            <div className="premium-lesson-title text-sm font-medium">{section.title}</div>
            {section.body ? <p className="mt-2 text-sm leading-7">{section.body}</p> : null}
            {section.bullets?.length ? (
              <div className={`mt-3 grid gap-2 ${step.id === 'step-06' && section.title === '紧凑读法' ? 'sm:grid-cols-2' : ''}`}>
                {section.bullets.map((bullet) => (
                  <div key={bullet} className="text-sm leading-7">
                    {bullet}
                  </div>
                ))}
              </div>
            ) : null}
            {section.markdown ? (
              <div className="text-sm leading-7">{renderMarkdown(section.markdown)}</div>
            ) : null}
          </div>
        ))}
      </div>

      {trailingSections.length ? (
        <div className="mt-4 grid gap-4">
          {trailingSections.map((section) => (
            <div key={section.title} className={`premium-lesson-tone-block ${getToneClass(section.tone)}`}>
              <div className="premium-lesson-title text-sm font-medium">{section.title}</div>
              {section.body ? <p className="mt-2 text-sm leading-7">{section.body}</p> : null}
              {section.bullets?.length ? (
                <div className="mt-3 grid gap-2">
                  {section.bullets.map((bullet) => (
                    <div key={bullet} className="text-sm leading-7">
                      {bullet}
                    </div>
                  ))}
                </div>
              ) : null}
              {section.markdown ? <div className="text-sm leading-7">{renderMarkdown(section.markdown)}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      <StepInlineVisual step={step} onParameterChange={onWorkspaceParameterChange} />

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}

      {mediaSrc ? (
        <figure className="premium-lesson-panel-soft mt-5 overflow-hidden px-4 py-4">
          <Image
            src={mediaSrc}
            alt={mediaAlt ?? step.title}
            width={1200}
            height={720}
            unoptimized
            className="h-auto w-full rounded-2xl border border-border/60 bg-background/60"
          />
          {getMediaCaption(step.id) ? <figcaption className="premium-lesson-muted mt-3 text-xs">{getMediaCaption(step.id)}</figcaption> : null}
        </figure>
      ) : null}
    </section>
  );
}

function renderQuestionCard({
  card,
  draft,
  setDraft,
  showAnswers,
  disabled = false,
}: {
  card: ActivityCard;
  draft: Record<string, string>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showAnswers: boolean;
  disabled?: boolean;
}) {
  const question = card.question!;
  return (
    <>
      <div className="premium-lesson-title text-sm font-medium">{renderInlineMathText(card.title)}</div>
      <div className="mt-3 grid gap-2">
        {question.options.map((option) => (
          <label key={option.value} className="premium-lesson-control flex items-start gap-2">
            <input
              type="radio"
              name={question.key}
              checked={draft[question.key] === option.value}
              disabled={disabled}
              onChange={() => {
                if (disabled) return;
                setDraft((prev) => ({ ...prev, [question.key]: option.value }));
              }}
            />
            <span className="text-sm leading-6">{renderInlineMathText(option.label)}</span>
          </label>
        ))}
      </div>
      {showAnswers ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
          <div className="font-medium">
            参考答案：
            {renderInlineMathText(question.options.find((option) => option.value === question.answer)?.label ?? '')}
          </div>
          <div className="mt-2">{question.explanation}</div>
        </div>
      ) : null}
    </>
  );
}

function renderFieldCard({
  stepId,
  card,
  draft,
  setDraft,
  showAnswers,
  disabled = false,
}: {
  stepId: string;
  card: ActivityCard;
  draft: Record<string, string>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showAnswers: boolean;
  disabled?: boolean;
}) {
  const field = card.field!;
  return (
    <>
      <label
        htmlFor={field.type === 'radio' ? undefined : buildStudentFieldId(stepId, field.key)}
        className="premium-lesson-title block text-sm font-medium"
      >
        {renderInlineMathText(card.title)}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          id={buildStudentFieldId(stepId, field.key)}
          name={field.key}
          aria-label={field.label}
          value={draft[field.key] ?? ''}
          disabled={disabled}
          onChange={(event) => {
            if (disabled) return;
            setDraft((prev) => ({ ...prev, [field.key]: event.target.value }));
          }}
          placeholder={field.placeholder}
          className="premium-lesson-input mt-3 min-h-[120px]"
        />
      ) : field.type === 'radio' ? (
        <div className="mt-3 grid gap-2">
          {field.options?.map((option) => (
            <label key={option.value} className="premium-lesson-control flex items-start gap-2">
              <input
                type="radio"
                name={field.key}
                aria-label={`${field.label}：${option.label}`}
                checked={draft[field.key] === option.value}
                disabled={disabled}
                onChange={() => {
                  if (disabled) return;
                  setDraft((prev) => ({ ...prev, [field.key]: option.value }));
                }}
              />
              <span className="text-sm leading-6">{renderInlineMathText(option.label)}</span>
            </label>
          ))}
        </div>
      ) : (
        <input
          type="text"
          id={buildStudentFieldId(stepId, field.key)}
          name={field.key}
          aria-label={field.label}
          value={draft[field.key] ?? ''}
          disabled={disabled}
          onChange={(event) => {
            if (disabled) return;
            setDraft((prev) => ({ ...prev, [field.key]: event.target.value }));
          }}
          placeholder={field.placeholder}
          className="premium-lesson-input mt-3"
        />
      )}
      {showAnswers && field.answer ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
          参考答案：{renderFieldValue(field, field.answer)}
        </div>
      ) : null}
    </>
  );
}

export function UNIT_3_1StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  readOnly = false,
}: {
  step: UNIT_3_1StepDefinition;
  savedResponse?: UNIT_3_1StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_1StepResponse) => void;
  readOnly?: boolean;
}) {
  const commitStudentResponse: typeof onSubmit = (response) => {
    if (readOnly) return;
    onSubmit(response);
  };

  const activity = useMemo(() => getStepActivity(step), [step]);
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(activity, savedResponse));

  useEffect(() => {
    setDraft(getDefaultDraft(activity, savedResponse));
  }, [activity, savedResponse]);

  if (activity.kind === 'none') {
    return null;
  }

  if (!released) {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">等待教师释放</div>
        <div className="premium-lesson-muted mt-2 text-sm">本题尚未开放，请先跟随教师讲解，等待教师释放后再作答。</div>
      </section>
    );
  }

  const showAnswers = answerVisible;
  const isDoubleGrid = activity.grid === 'double' || step.id === 'step-06';
  const gridClass = isDoubleGrid ? 'mt-4 grid gap-4 md:grid-cols-2' : 'mt-4 grid gap-4';

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">作答卡片</div>
      <div className="premium-lesson-muted mt-2 text-sm">{activity.helper}</div>

      <div className={gridClass}>
        {activity.cards.map((card) => {
          const answerKey = card.kind === 'question' ? card.question?.key : card.field?.key;
          const isCardSubmitted = Boolean(answerKey && savedResponse?.answers?.[answerKey]);
          return (
            <div key={card.id} className="premium-lesson-surface-elevated px-4 py-4">
              {card.kind === 'question'
                ? renderQuestionCard({ card, draft, setDraft, showAnswers, disabled: Boolean(readOnly) })
                : renderFieldCard({ stepId: step.id, card, draft, setDraft, showAnswers, disabled: Boolean(readOnly) })}
              <button
                type="button" disabled={Boolean(readOnly)}
                onClick={() => {
                  const key = answerKey;
                  commitStudentResponse({
                    stepId: step.id,
                    submittedAt: Date.now(),
                    answers: {
                      ...(savedResponse?.answers ?? {}),
                      ...(key ? { [key]: draft[key] ?? '' } : {}),
                    },
                  });
                }}
                className="premium-lesson-action-primary mt-4"
              >
                提交答案
              </button>
              <SubmissionStatus submitted={isCardSubmitted}
          idleText={readOnly ? '演示模式仅本机预览，不会同步到教师端汇总。' : undefined} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function UNIT_3_1TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_3_1StepDefinition;
  responses: UNIT_3_1TeacherResponseItem[];
  released: boolean;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const activity = getStepActivity(step);
  const wordCloud = getWordCloudEntries(responses);

  if (activity.kind === 'none') {
    return null;
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-medium">教师端汇总</div>
          <div className="premium-lesson-muted mt-1 text-sm">当前步骤已收到 {responses.length} 份提交。</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
            {released ? '已释放活动' : activity.releaseLabel ?? '释放活动'}
          </button>
          <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-secondary">
            {answerVisible ? '已显示答案' : '显示答案'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {activity.cards.map((card) => {
          if (card.kind === 'question' && card.question) {
            const question = card.question;
            const total = Math.max(1, responses.length);
            const counts = question.options.map((option) => ({
              option,
              count: responses.filter((item) => item.response.answers[question.key] === option.value).length,
            }));
            return (
              <div key={card.id} className="premium-lesson-surface-elevated px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{renderInlineMathText(card.title)}</div>
                <div className="mt-3 grid gap-2">
                  {counts.map(({ option, count }) => (
                    <div key={option.value} className="text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span>{renderInlineMathText(option.label)}</span>
                        <span className="premium-lesson-muted">{count} 人</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-800/70">
                        <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${(count / total) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {answerVisible ? (
                  <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
                    <div className="font-medium">
                      参考答案：
                      {renderInlineMathText(question.options.find((option) => option.value === question.answer)?.label ?? '')}
                    </div>
                    <div className="mt-2">{question.explanation}</div>
                  </div>
                ) : null}
              </div>
            );
          }

          const field = card.field!;
          return (
            <div key={card.id} className="premium-lesson-surface-elevated px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{renderInlineMathText(card.title)}</div>
              {answerVisible && field.answer ? (
                <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
                  参考答案：{renderFieldValue(field, field.answer)}
                </div>
              ) : null}
              <div className="mt-4 grid gap-3">
                {responses.length ? (
                  responses.slice(0, 6).map((item) => (
                    <div key={`${card.id}-${item.studentName}-${item.response.submittedAt}`} className="rounded-2xl border border-border/60 px-3 py-3 text-sm">
                      <div className="font-medium">{item.studentName}</div>
                      <div className="premium-lesson-muted mt-2">
                        {renderFieldValue(field, item.response.answers[field.key] ?? '')}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="premium-lesson-muted text-sm">暂无提交。</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {wordCloud.length ? (
        <div className="premium-lesson-panel mt-4 px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">高频词速览</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {wordCloud.map(([word, count]) => (
              <span key={word} className="premium-lesson-tone-pill premium-tone-slate">
                {word} · {count}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_3_1StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_3_1StepResponse>;
}) {
  const finishedSteps = UNIT_3_1_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_3_1_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {['稳定底线', '模态语言', '时域筛选', '频域复核'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是 3-1 最值得带走的判断锚点。</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {finishedSteps.map((item) => (
          <div key={item.id} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{item.title}</div>
            <div className="premium-lesson-muted mt-1">{item.hint}</div>
          </div>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
        你已经把“稳定底线 -&gt; 极点到模态 -&gt; 时域筛选 -&gt; 频域复核 -&gt; 卷积收束”这条链条搭起来了。下一课会把它推进到稳定边界可视化。
      </div>
    </section>
  );
}
