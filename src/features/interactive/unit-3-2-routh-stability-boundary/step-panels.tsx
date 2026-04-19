'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveConfig } from '@/features/interactive/types';
import {
  getUNIT_3_2PageContract,
  UNIT_3_2_COURSE_TITLE,
  UNIT_3_2_LESSON_STEPS,
  UNIT_3_2_STAGE_LABEL,
  type UNIT_3_2StepDefinition,
  type UNIT_3_2StepResponse,
} from '@/lib/unit-3-2-course';
import {
  BOUNDARY_MATCH_OPTIONS,
  STATE_MATCH_OPTIONS,
  type WorkspaceParameterChange,
} from './workspace';

type Tone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

interface StepSection {
  title: string;
  body?: string;
  bullets?: string[];
  formula?: string;
  tone?: Tone;
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

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'radio';
  placeholder?: string;
  answer?: string;
  options?: ChoiceOption[];
}

interface ActivitySpec {
  kind: 'none' | 'quiz' | 'form' | 'cards';
  helper: string;
  questions?: QuizQuestion[];
  fields?: FormField[];
  cards?: ActivityCardSpec[];
}

interface ActivityCardSpec {
  id: string;
  title: string;
  helper?: string;
  fields: FormField[];
}

export interface UNIT_3_2TeacherResponseItem {
  studentName: string;
  response: UNIT_3_2StepResponse;
}

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function getStepBlueprint(step: UNIT_3_2StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Roadmap',
        intro: '3-1 已经把稳定底线落回闭环极点语言，3-2 继续追问：没有显式根表达式时，怎样把稳定问题直接翻译成边界与区间语言。',
        sections: [
          {
            title: '本课在模块 3 中的位置',
            tone: 'cyan',
            bullets: ['3-1 讲纯极点语言。', '3-2 把稳定底线推进到边界语言。', '3-3 再解释极点为什么沿特定路径迁移。'],
          },
          {
            title: '今天的任务',
            tone: 'emerald',
            bullets: ['建立高阶系统判稳入口。', '分清两类特殊情况与处理动作。', '把判稳推进到参数可行域与区域约束。'],
          },
        ],
        prompts: ['3-2 和 3-1、3-3、4-1 的接口关系是什么？', '为什么本课出口是参数可行域，而不是根轨迹法则？'],
      };
    case 'step-02':
      return {
        kicker: 'Figure vs Rule',
        intro: '极点迁移图能给直觉，但它还不能直接替代对特征方程系数的系统判稳。3-2 要解决的正是这层缺口。',
        sections: [
          {
            title: '三问',
            tone: 'amber',
            bullets: ['哪一段参数仍稳定？', '触到边界之后到底发生了什么？', '不显式求根时怎样直接筛参数？'],
          },
          {
            title: '这页的结论',
            tone: 'violet',
            body: '图像直觉负责提醒我们“边界快到了”，系数规则负责告诉我们“边界到底在哪、区间到底多宽”。',
          },
        ],
        prompts: ['为什么图像直觉不能单独回答参数筛选？', '系数规则补上的到底是哪一层证据？'],
      };
    case 'step-03':
      return {
        kicker: 'Pre-assessment',
        intro: '前测只检查判断链是否已经成形，不拉开分数。三题会同时暴露“不求根判稳、特殊情况辨识、区域收紧”这三条线上最常见的误判。',
        sections: [
          {
            title: '本页任务',
            tone: 'cyan',
            body: '先用三道题把普通判稳、特殊情况与区域收紧的起点理解暴露出来，再带着错因进入后续例题。',
          },
          {
            title: '常见混淆',
            tone: 'amber',
            bullets: ['劳斯判据不是另一种求根法。', '首位为 0 不等于全零行。', '稳定区间不等于更强区域约束下的可行域。'],
          },
        ],
        prompts: ['为什么会算劳斯表，不等于已经建立了完整的边界语言？'],
      };
    case 'step-04':
      return {
        kicker: 'Ordinary Routh',
        intro: '这页先把普通劳斯表站稳。题面、对象公式和目标结论都必须常显，教师显影只控制递推步骤，不隐藏“本例到底在求什么”。',
        sections: [
          {
            title: '完整题面',
            tone: 'cyan',
            body: '取 k=4，对 D(s,k)=s^4+5s^3+9s^2+(7+k)s+(2+k) 列写普通劳斯表，并判断系统稳定性。',
          },
          {
            title: '固定对象',
            tone: 'emerald',
            formula: 'D(s)=s^4+5s^3+9s^2+11s+6',
          },
          {
            title: '第一列结论',
            tone: 'amber',
            formula: '1,\\ 5,\\ \\frac{34}{5},\\ \\frac{112}{17},\\ 6',
          },
        ],
        prompts: ['为什么本页已经能判稳，但还没有显式求出全部根？'],
      };
    case 'step-05':
      return {
        kicker: 'Feasible Range',
        intro: '把参数带进第一列之后，劳斯判据会自然推进到稳定区间。学生在这一页必须先看到条件链，再看到区间结论，不能只记住最后一行答案。',
        sections: [
          {
            title: '带参数对象',
            tone: 'cyan',
            formula: 'D(s,k)=s^4+5s^3+9s^2+(7+k)s+(2+k)',
          },
          {
            title: '稳定区间',
            tone: 'emerald',
            formula: '-2<k<18',
          },
          {
            title: '典型错因',
            tone: 'amber',
            bullets: ['漏掉 s^0 行条件。', '分式链条只看分子，不看符号一致性。', '把劳斯误当成先求根再验证的绕路工具。'],
          },
        ],
        prompts: ['第一列条件链最容易漏掉哪一步？'],
      };
    case 'step-06':
      return {
        kicker: 'Boundary Mapping',
        intro: '代数边界不能只停留在数字上，还要落回复平面根结构。参数点、图上位置与根结构需要在同一页里互相对照。',
        sections: [
          {
            title: '边界点与稳定区',
            tone: 'cyan',
            bullets: ['k=-2：原点根边界。', 'k=18：纯虚根边界。', 'k=22：已出现右半平面共轭根。'],
          },
          {
            title: '关键提醒',
            tone: 'amber',
            body: '两个边界点都压在稳定边界上，但对应的根结构并不相同；只有把边界重新翻译回复平面，参数区间才真正有了物理意义。',
          },
        ],
        prompts: ['为什么 k=-2 与 k=18 同在边界上，却不是同一种临界状态？'],
      };
    case 'step-07':
      return {
        kicker: 'Zero Leading Entry',
        intro: '“首位为 0 但该行不全为 0”要用 ε 做连续化处理，但 ε 只服务于第一列符号判断，不是系统的真实参数。',
        sections: [
          {
            title: '完整题面',
            tone: 'cyan',
            body: '对 D_1(s)=s^4+2s^3+3s^2+6s+5 建立劳斯表，处理“首位为 0 但该行不全为 0”的情况。',
          },
          {
            title: '关键量',
            tone: 'emerald',
            formula: 'c_1=6-\\frac{10}{\\varepsilon}',
          },
          {
            title: '结论目标',
            tone: 'amber',
            bullets: ['判断目标始终是第一列符号变化。', 'ε 用来保持符号连续化，不代表真实参数进入系统。', '本例右半平面根数应回到第一列来读。'],
          },
        ],
        prompts: ['为什么 ε 连续化只服务于符号判断，而不是系统真实参数？'],
      };
    case 'step-08':
      return {
        kicker: 'Full Zero Row',
        intro: '全零行不是“算不下去了”，而是对称根结构露出来了，所以必须通过辅助方程把这层信息重新写回劳斯表。',
        sections: [
          {
            title: '完整题面',
            tone: 'cyan',
            body: '对 D_2(s)=s^4+2s^3+2s^2+2s+1 建立劳斯表，并处理“某一整行为零”的情况。',
          },
          {
            title: '辅助方程规则',
            tone: 'emerald',
            bullets: ['全零行出现后，先取上一行系数构造 A(s)。', '再对 A(s) 求导，用导数系数替换零行。', '最后由辅助方程的根判断具体根结构。'],
          },
          {
            title: '关键链条',
            tone: 'amber',
            formula: 'A(s)=s^2+1,\\qquad A\'(s)=2s,\\qquad s=\\pm j',
          },
        ],
        prompts: ['为什么全零行会暴露对称根结构？'],
      };
    case 'step-09':
      return {
        kicker: 'Routh to Time Domain',
        intro: '劳斯结论要能翻译回时域。表格先说明极点结构，图像再说明响应形态，这两个证据不能拆开读。',
        sections: [
          {
            title: '对应表',
            tone: 'cyan',
            bullets: ['第一列全正 -> 左半平面极点 -> 衰减收敛。', '边界根 -> 虚轴或原点 -> 等幅振荡或边界停留。', '第一列变号 -> 右半平面根 -> 发散。'],
          },
          {
            title: '图后解释',
            tone: 'amber',
            body: '极点越逼近虚轴，振荡衰减越慢；进入右半平面后，振荡包络开始放大。原点根与纯虚根都属于边界，但时域表现并不相同。',
          },
        ],
        prompts: ['原点根与纯虚根在时域上的主要差异是什么？'],
      };
    case 'step-10':
      return {
        kicker: 'Routh to Frequency Domain',
        intro: '频域线索在 3-2 里仍是辅助证据，但必须能回译到边界类型。公式卡、Bode 图和三域总表需要同页出现。',
        sections: [
          {
            title: '频域线索',
            tone: 'cyan',
            bullets: ['接近稳定边界时峰值抬高。', '纯虚根会在有限频率附近留下尖锐共振痕迹。', '原点根首先改写低频特性。'],
          },
          {
            title: '关键提醒',
            tone: 'amber',
            body: '这里的频域现象仍由极点位置决定，不能把 Bode 图当成与稳定性无关的孤立图像。',
          },
        ],
        prompts: ['为什么靠近稳定边界时峰值会抬高？'],
      };
    case 'step-11':
      return {
        kicker: 'Shifted Constraint',
        intro: '更强的区域约束不是新方法，而是把竖线约束通过变量平移重新送回普通劳斯判定。旧区间与新区间必须同页对照。',
        sections: [
          {
            title: '完整题面',
            tone: 'cyan',
            body: '要求全部极点满足 Re(s)<-0.5，把区域约束转成普通劳斯判定，并写出新的可行域。',
          },
          {
            title: '变量平移',
            tone: 'emerald',
            formula: 's=z-\\frac{1}{2},\\qquad \\tilde D(z,k)=D\\left(z-\\frac12,k\\right)',
          },
          {
            title: '区间对比',
            tone: 'amber',
            formula: '-2<k<18,\\qquad -\\frac{3}{8}<k<4',
          },
        ],
        prompts: ['为什么更强约束会把可行区间收缩？'],
      };
    case 'step-12':
      return {
        kicker: 'Post-assessment',
        intro: '后测检查的不是算表速度，而是学生是否已经把“判稳、特殊情况、区域约束”连成一条边界语言链。',
        sections: [
          {
            title: '检查重点',
            tone: 'cyan',
            bullets: ['能否把边界点翻译到根结构。', '能否分清首位为 0 与全零行。', '能否解释更强约束为什么会收紧可行域。'],
          },
          {
            title: '答题口径',
            tone: 'amber',
            body: '答案不应只停留在会算，而要能说出边界意味着什么、为什么会这样以及它如何限制参数选择。',
          },
        ],
        prompts: ['如果学生会算表，却解释不出边界语言，说明缺了哪一层理解？'],
      };
    case 'step-13':
      return {
        kicker: 'Takeaways',
        intro: '3-2 的出口不是多记几条技巧，而是形成“先判稳、再识别边界、再进入参数可行域”的完整判断链，并把它交给后续根轨迹与设计任务。',
        sections: [
          {
            title: '四个带走的锚点',
            tone: 'emerald',
            bullets: ['普通劳斯表先回答高阶系统是否稳定。', '特殊情况必须先分型，再选处理动作。', '边界结论要翻译到极点、时域与频域线索。', '更强约束会把稳定区间收紧成更窄的参数可行域。'],
          },
          {
            title: '课程出口',
            tone: 'cyan',
            body: '下一课 3-3 会解释极点为何沿边界附近那条路径迁移，4-1 再把可行域语言推进到参数设计任务。',
          },
        ],
        prompts: ['为什么 3-2 的出口是参数设计入口，而不是直接开始整定？'],
      };
    default:
      return {
        kicker: 'Step',
        intro: step.hint,
        sections: [],
      };
  }
}

const PRETEST_QUESTIONS: QuizQuestion[] = [
  {
    key: 'q1',
    prompt: '劳斯判据最直接回答的问题是：',
    options: [
      { value: 'A', label: '把全部闭环根显式求出来' },
      { value: 'B', label: '判断右半平面根数，从而判断稳定性' },
      { value: 'C', label: '直接给出最优控制器参数' },
    ],
    answer: 'B',
    explanation: '劳斯判据的核心输出是右半平面根数与稳定底线，而不是完整求根。 ',
  },
  {
    key: 'q2',
    prompt: '下列哪种说法是错误的？',
    options: [
      { value: 'A', label: '首位为 0 与全零行需要不同处理动作' },
      { value: 'B', label: '稳定以后才有资格谈性能优化' },
      { value: 'C', label: '只要看图上边界点，就不必再看系数规则' },
    ],
    answer: 'C',
    explanation: '图像直觉不能替代系数规则，参数筛选仍要回到劳斯表。 ',
  },
  {
    key: 'q3',
    prompt: '带参数劳斯表最自然的下一步是：',
    options: [
      { value: 'A', label: '把稳定问题推进到参数可行域表达' },
      { value: 'B', label: '直接进入 Nyquist 判稳' },
      { value: 'C', label: '直接跳去控制器结构选型' },
    ],
    answer: 'A',
    explanation: '把参数带进第一列条件链后，劳斯会自然推进到稳定区间和可行域语言。 ',
  },
];

const POSTTEST_QUESTIONS: QuizQuestion[] = [
  {
    key: 'q1',
    prompt: '关于 $k=-2$ 与 $k=18$ 的边界，下列哪项正确？',
    options: [
      { value: 'A', label: '两者都是同一种纯虚根边界' },
      { value: 'B', label: '一个对应原点根边界，一个对应纯虚根边界' },
      { value: 'C', label: '两者都还在稳定区内部' },
    ],
    answer: 'B',
    explanation: '不同边界参数对应不同的根结构，这是 3-2 的关键出口。 ',
  },
  {
    key: 'q2',
    prompt: '加入竖线约束后，可行区间通常会：',
    options: [
      { value: 'A', label: '保持不变' },
      { value: 'B', label: '变得更宽' },
      { value: 'C', label: '收缩，因为约束更强' },
    ],
    answer: 'C',
    explanation: '更强的极点区域约束会压缩参数可行域。 ',
  },
  {
    key: 'q3',
    type: 'text',
    prompt: '请用 1-2 句话解释：为什么“会算劳斯表”还不等于“会解释稳定边界语言”？',
    explanation: '理想回答应同时提到根结构、时域/频域线索和参数可行域。 ',
  },
];

const STEP_REVEAL_SEGMENTS_BY_STEP: Partial<Record<string, ReadonlyArray<{ key: string; label: string }>>> = {
  'step-04': [
    { key: 'base-rows', label: '先排出 s^4 与 s^3 两行' },
    { key: 'coefficients', label: '依次算出 b_1、b_2 与 c_1' },
    { key: 'first-column', label: '读第一列并做数值求根交叉验证' },
  ],
  'step-05': [
    { key: 'table', label: '先列出带参数劳斯表' },
    { key: 'inequality-chain', label: '再写出第一列不等式链' },
    { key: 'interval', label: '最后合并条件得到稳定区间' },
  ],
  'step-07': [
    { key: 'zero-head', label: '先得到 b_1=0、b_2=5' },
    { key: 'epsilon', label: '再用 ε 替代首位零' },
    { key: 'sign-change', label: '根据第一列符号变化判断右半平面根数' },
  ],
  'step-08': [
    { key: 'zero-row', label: '先识别整行为零' },
    { key: 'aux-equation', label: '由上一行系数构造 A(s)' },
    { key: 'derivative', label: '对 A(s) 求导并替换零行' },
    { key: 'structure', label: '由辅助方程根判断对称根结构' },
  ],
  'step-11': [
    { key: 'shift-polynomial', label: '先写出平移后多项式' },
    { key: 'shifted-routh', label: '再列写平移后的劳斯表' },
    { key: 'compare-intervals', label: '最后比较旧区间与新区间' },
  ],
};

function getActivitySpec(step: UNIT_3_2StepDefinition): ActivitySpec {
  switch (step.id) {
    case 'step-02':
      return {
        kind: 'form',
        helper: '先选立场，再看教师揭示后的纠偏。',
        fields: [
          {
            key: 'choice',
            label: '只看极点迁移图，是否已经足够写出参数可行域。',
            type: 'radio',
            answer: 'B',
            options: [
              { value: 'A', label: '足够，图上边界点已经全部给出。' },
              { value: 'B', label: '还需要一套从特征方程系数直接判稳的方法' },
            ],
          },
        ],
      };
    case 'step-03':
      return {
        kind: 'quiz',
        helper: '前测用于暴露错因，不用于拉开分数。',
        questions: PRETEST_QUESTIONS,
      };
    case 'step-04':
      return {
        kind: 'cards',
        helper: '先跟随显影链读出第一列，再完成两张独立作答卡。',
        cards: [
          {
            id: 'card-04-a',
            title: '本例右半平面根数是多少。',
            fields: [
              {
                key: 'rhpCount',
                label: '本例右半平面根数是多少。',
                type: 'radio',
                answer: '0',
                options: [
                  { value: '0', label: '0 个' },
                  { value: '1', label: '1 个' },
                  { value: '2', label: '2 个' },
                  { value: '3', label: '3 个' },
                ],
              },
            ],
          },
          {
            id: 'card-04-b',
            title: '为什么本页已经能判稳，但还没有显式求出全部根。',
            fields: [
              {
                key: 'methodMeaning',
                label: '为什么本页已经能判稳，但还没有显式求出全部根。',
                type: 'textarea',
                placeholder: '用 1-2 句话解释第一列与右半平面根数的关系。',
                answer: '因为第一列符号变化次数已经给出右半平面根数，所以劳斯可以先判稳；显式求根只是后续的交叉验证。',
              },
            ],
          },
        ],
      };
    case 'step-05':
      return {
        kind: 'cards',
        helper: '根据显影链写出稳定区间，并指出最容易遗漏的条件。',
        cards: [
          {
            id: 'card-05-a',
            title: '填写稳定区间。',
            fields: [
              {
                key: 'range',
                label: '填写稳定区间。',
                type: 'text',
                placeholder: '例如：-2 < k < 18',
                answer: '-2 < k < 18',
              },
            ],
          },
          {
            id: 'card-05-b',
            title: '哪一个条件最容易被遗漏。',
            fields: [
              {
                key: 'missingCondition',
                label: '哪一个条件最容易被遗漏。',
                type: 'radio',
                answer: 's0',
                options: [
                  { value: 's1', label: '只看高阶行，不看低阶行' },
                  { value: 's0', label: '漏掉 s^0 行条件' },
                  { value: 'solver', label: '把劳斯当成先求根再验证的工具' },
                ],
              },
            ],
          },
        ],
      };
    case 'step-06':
      return {
        kind: 'cards',
        helper: '把参数点与根结构对应起来，并解释两个边界点为何不是同一种临界状态。',
        cards: [
          {
            id: 'card-06-a',
            title: '把参数点与根结构做匹配。',
            fields: [
              { key: 'parameter', label: '边界参数', type: 'radio', answer: 'k=18', options: [...BOUNDARY_MATCH_OPTIONS.parameter] },
              { key: 'geometry', label: '图上位置', type: 'radio', answer: 'imaginary-pair', options: [...BOUNDARY_MATCH_OPTIONS.geometry] },
              { key: 'meaning', label: '根结构描述', type: 'radio', answer: 'cross-axis', options: [...BOUNDARY_MATCH_OPTIONS.meaning] },
            ],
          },
          {
            id: 'card-06-b',
            title: '为什么 k=-2 与 k=18 都在边界上，却不是同一种临界状态。',
            fields: [
              {
                key: 'boundaryDifference',
                label: '为什么 k=-2 与 k=18 都在边界上，却不是同一种临界状态。',
                type: 'textarea',
                placeholder: '说明原点根边界与纯虚根边界的差异。',
                answer: '因为 k=-2 对应原点根边界，而 k=18 对应纯虚根边界；两者虽然都在边界上，但极点结构和响应含义并不相同。',
              },
            ],
          },
        ],
      };
    case 'step-07':
      return {
        kind: 'cards',
        helper: '先跟随显影链完成连续化，再判断右半平面根数并说明 ε 的角色。',
        cards: [
          {
            id: 'card-07-a',
            title: '本例右半平面根数是多少。',
            fields: [
              {
                key: 'epsilonRhpCount',
                label: '本例右半平面根数是多少。',
                type: 'radio',
                answer: '2',
                options: [
                  { value: '0', label: '0 个' },
                  { value: '1', label: '1 个' },
                  { value: '2', label: '2 个' },
                  { value: '3', label: '3 个' },
                ],
              },
            ],
          },
          {
            id: 'card-07-b',
            title: '为什么 ε 只服务于符号连续化，而不是系统真实参数。',
            fields: [
              {
                key: 'epsilonRole',
                label: '为什么 ε 只服务于符号连续化，而不是系统真实参数。',
                type: 'textarea',
                placeholder: '说明 ε 在首位为 0 场景中的作用。',
                answer: 'ε 只是在首位为 0 时维持第一列符号连续判断的辅助量，不代表系统真的引入了一个可调参数。',
              },
            ],
          },
        ],
      };
    case 'step-08':
      return {
        kind: 'cards',
        helper: '先跟随显影链写出辅助方程，再判断本例对应的根结构。',
        cards: [
          {
            id: 'card-08-a',
            title: '写出本例辅助方程。',
            fields: [
              {
                key: 'auxEquation',
                label: '写出本例辅助方程。',
                type: 'text',
                placeholder: '例如：A(s)=s^2+1',
                answer: 'A(s)=s^2+1',
              },
            ],
          },
          {
            id: 'card-08-b',
            title: '本例对应哪一种根结构。',
            fields: [
              {
                key: 'rootStructure',
                label: '本例对应哪一种根结构。',
                type: 'radio',
                answer: 'pure-imaginary',
                options: [
                  { value: 'pure-imaginary', label: '纯虚根对' },
                  { value: 'origin-root', label: '原点根' },
                  { value: 'rhp-pair', label: '右半平面共轭根' },
                ],
              },
            ],
          },
        ],
      };
    case 'step-09':
      return {
        kind: 'cards',
        helper: '把劳斯现象与时域曲线对应起来，并区分原点根与纯虚根的时域差异。',
        cards: [
          {
            id: 'card-09-a',
            title: '把劳斯现象与时域曲线做匹配。',
            fields: [
              { key: 'curve', label: '曲线标签', type: 'radio', answer: 'critical', options: [...STATE_MATCH_OPTIONS.curve] },
              { key: 'pole', label: '极点结构', type: 'radio', answer: 'axis-boundary', options: [...STATE_MATCH_OPTIONS.pole] },
              { key: 'state', label: '稳定状态', type: 'radio', answer: 'critical', options: [...STATE_MATCH_OPTIONS.state] },
            ],
          },
          {
            id: 'card-09-b',
            title: '原点根与纯虚根在时域上的主要差异是什么。',
            fields: [
              {
                key: 'timeDomainDifference',
                label: '原点根与纯虚根在时域上的主要差异是什么。',
                type: 'textarea',
                placeholder: '说明两类边界在时域上的主要差异。',
                answer: '纯虚根更直接对应有限频率处的等幅振荡，而原点根首先表现为低频边界停留或积分型拖尾，两者虽然都在边界上，但时域特征不同。',
              },
            ],
          },
        ],
      };
    case 'step-10':
      return {
        kind: 'cards',
        helper: '辨识纯虚根、原点根与边界逼近在频域中的不同痕迹。',
        cards: [
          {
            id: 'card-10-a',
            title: '哪一种频域现象最直接对应纯虚根。',
            fields: [
              {
                key: 'frequencyPhenomenon',
                label: '哪一种频域现象最直接对应纯虚根。',
                type: 'radio',
                answer: 'sharp-resonance',
                options: [
                  { value: 'sharp-resonance', label: '有限频率处出现尖锐共振峰' },
                  { value: 'low-frequency-lift', label: '低频端首先持续抬升' },
                  { value: 'mild-peak', label: '整体峰值略升但没有尖锐峰' },
                ],
              },
            ],
          },
          {
            id: 'card-10-b',
            title: '为什么靠近稳定边界时峰值会抬高。',
            fields: [
              {
                key: 'peakReason',
                label: '为什么靠近稳定边界时峰值会抬高。',
                type: 'textarea',
                placeholder: '说明极点逼近边界与峰值抬高的关系。',
                answer: '因为主导极点逼近虚轴后阻尼减小，相关频段的响应被放大，所以频域峰值会先抬高，这是一条边界逼近的辅助线索。',
              },
            ],
          },
        ],
      };
    case 'step-11':
      return {
        kind: 'cards',
        helper: '根据平移后的劳斯表写出新区间，并判断给定参数是否越过新边界。',
        cards: [
          {
            id: 'card-11-a',
            title: '填写更强约束下的可行域。',
            fields: [
              {
                key: 'shiftedRange',
                label: '填写更强约束下的可行域。',
                type: 'text',
                placeholder: '例如：-3/8 < k < 4',
                answer: '-3/8 < k < 4',
              },
            ],
          },
          {
            id: 'card-11-b',
            title: 'k=4 是否仍满足新约束。',
            fields: [
              {
                key: 'k4Boundary',
                label: 'k=4 是否仍满足新约束。',
                type: 'radio',
                answer: 'no',
                options: [
                  { value: 'yes', label: '是，仍在新区间内' },
                  { value: 'no', label: '否，已经压在新边界上' },
                ],
              },
            ],
          },
        ],
      };
    case 'step-12':
      return {
        kind: 'quiz',
        helper: '后测检查边界语言是否已经成形。',
        questions: POSTTEST_QUESTIONS,
      };
    default:
      return {
        kind: 'none',
        helper: '本页以阅读、观察和教师推进为主。',
      };
  }
}

function getRevealContent(step: UNIT_3_2StepDefinition) {
  switch (step.id) {
    case 'step-02':
      return '正确项：**B**。图像直觉只能提醒“边界快到了”，真正的参数筛选还要回到特征方程系数规则。';
    case 'step-03':
      return '前测纠偏：劳斯不是另一种求根法；首位为 0 与全零行必须先分辨；稳定之后才有资格继续谈性能优化。';
    case 'step-04':
      return '本例第一列为 `1, 5, 34/5, 112/17, 6`，因此右半平面根数为 0。劳斯先回答的是“有没有右半平面根”，不是先把全部根显式求出来。';
    case 'step-05':
      return '稳定区间：`-2 < k < 18`。典型错因是漏掉 $s^0$ 行条件，导致区间被假性放宽。';
    case 'step-06':
      return '边界翻译：`k=-2` 更接近原点根边界；`k=18` 对应纯虚根边界。不同参数触发的是不同的临界根结构。';
    case 'step-07':
      return '首位为 0 的处理重点是保持第一列符号连续判断。本例用 ε 连续化后，可读出右半平面根数为 2；ε 不是系统真实参数。';
    case 'step-08':
      return '全零行应先构造辅助方程 `A(s)=s^2+1`，再用 `A\'(s)=2s` 回填零行。本例暴露的是纯虚根对，而不是继续加 ε。';
    case 'step-09':
      return '时域翻译：稳定对应衰减收敛，边界根对应等幅振荡或边界停留，失稳对应发散。原点根与纯虚根同属边界，但响应形态并不相同。';
    case 'step-10':
      return '频域翻译：纯虚根最直接对应有限频率处的尖锐共振峰；原点根首先改写低频特性；峰值抬高说明系统在逼近稳定边界。';
    case 'step-11':
      return '变量平移后新区间：`-3/8 < k < 4`。更强的竖线约束会收紧可行域，所以 `k=4` 已经压在新边界上。';
    case 'step-12':
      return '后测标准：会算表只是起点，真正关键是能把边界翻译到根结构、时域表现和参数可行域语言。';
    default:
      return null;
  }
}

function getAiPrompts(step: UNIT_3_2StepDefinition) {
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_3_2StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit32:${step.id}`,
    registryId: 'unit32-inline-ai',
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

function getDefaultDraft(activity: ActivitySpec, savedResponse?: UNIT_3_2StepResponse) {
  if (savedResponse) {
    return savedResponse.answers;
  }
  const defaults: Record<string, string> = {};
  for (const field of activity.fields ?? []) {
    defaults[field.key] = '';
  }
  for (const question of activity.questions ?? []) {
    defaults[question.key] = '';
  }
  for (const card of activity.cards ?? []) {
    for (const field of card.fields) {
      defaults[field.key] = '';
    }
  }
  return defaults;
}

function getWordCloudEntries(responses: UNIT_3_2TeacherResponseItem[]) {
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

function trimText(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

function renderFieldValue(field: FormField | undefined, value: string) {
  if (!field) return value;
  if (field.type !== 'radio') return value;
  return field.options?.find((option) => option.value === value)?.label ?? value;
}

function getActivityFields(activity: ActivitySpec) {
  return [...(activity.fields ?? []), ...(activity.cards?.flatMap((card) => card.fields) ?? [])];
}

function ChoiceGroup({
  options,
  value,
  onChange,
}: {
  options: ChoiceOption[];
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
          className={`premium-lesson-control justify-start text-left ${value === option.value ? 'ring-2 ring-cyan-400' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="premium-lesson-input min-h-[112px] w-full resize-y"
      />
    );
  }
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="premium-lesson-input w-full"
    />
  );
}

function RevealTrack({
  title,
  items,
  revealProgress,
}: {
  title: string;
  items: ReadonlyArray<{ key: string; label: string }>;
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

function supportsAnswerReveal(step: UNIT_3_2StepDefinition) {
  return getUNIT_3_2PageContract(step.id).teacherControls.revealReferenceAnswer !== 'not_applicable' && Boolean(getRevealContent(step));
}

function summarizeResponses(step: UNIT_3_2StepDefinition, responses: UNIT_3_2TeacherResponseItem[]) {
  if (!responses.length) {
    return [];
  }

  const counts = new Map<string, number>();
  const add = (value: string) => counts.set(value, (counts.get(value) ?? 0) + 1);

  if (step.pageType === 'quiz_group') {
    responses.forEach((item) => {
      Object.entries(item.response.answers).forEach(([key, value]) => add(`${key}: ${trimText(value)}`));
    });
  } else if (step.pageType === 'binary_choice') {
    responses.forEach((item) => add(`选择: ${item.response.answers.choice ?? '未选'}`));
  } else {
    responses.forEach((item) => {
      Object.entries(item.response.answers).forEach(([key, value]) => add(`${key}: ${trimText(value)}`));
    });
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
}

export function UNIT_3_2KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 3-1 的纯极点语言，到 3-2 的稳定边界，再到 3-3 的迁移机制</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['3-1', '纯极点语言', '先把稳定底线压实到极点位置。'],
          ['3-2', '稳定边界语言', '把高阶判稳推进到参数可行域和区域约束。'],
          ['3-3', '迁移机制', '解释极点为什么会沿边界附近那条路径运动。'],
        ].map(([label, title, body]) => (
          <div key={label} className={`premium-lesson-surface-elevated px-4 py-4 ${label === '3-2' ? 'ring-2 ring-cyan-400' : ''}`}>
            <div className="premium-lesson-kicker">{label}</div>
            <div className="premium-lesson-title mt-2 text-base font-semibold">{title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_3_2StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  revealProgress = 0,
}: {
  step: UNIT_3_2StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
  revealProgress?: number;
}) {
  const blueprint = getStepBlueprint(step);
  const revealItems = STEP_REVEAL_SEGMENTS_BY_STEP[step.id] ?? [];

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">
        {blueprint.kicker} · {UNIT_3_2_STAGE_LABEL[step.stage]}
      </div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>

      {mediaSrc ? (
        <figure className="premium-lesson-surface-elevated mt-4 overflow-hidden px-4 py-4">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/60 bg-background/60">
            <Image src={mediaSrc} alt={mediaAlt ?? step.title} fill className="object-contain" />
          </div>
          <figcaption className="premium-lesson-muted mt-2 text-xs">图示用于支撑当前环节的判断与比较。</figcaption>
        </figure>
      ) : null}

      <div className="mt-4 grid gap-4">
        {blueprint.sections.map((section) => (
          <div key={section.title} className={`premium-lesson-tone-block ${getToneClass(section.tone)}`}>
            <div className="font-medium">{section.title}</div>
            {section.body ? <div className="mt-2 text-sm leading-7">{section.body}</div> : null}
            {section.formula ? (
              <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <BlockMath math={section.formula} />
              </div>
            ) : null}
            {section.bullets?.length ? (
              <ul className="mt-3 grid gap-2 text-sm leading-7">
                {section.bullets.map((item) => (
                  <li key={item} className="ml-4 list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {revealItems.length ? <RevealTrack title="教师逐步显影" items={revealItems} revealProgress={Math.min(revealItems.length, revealProgress)} /> : null}

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

export function UNIT_3_2StudentActivityForm({
  step,
  savedResponse,
  released,
  browseEnabled = true,
  answerVisible,
  revealProgress = 0,
  onSubmit,
}: {
  step: UNIT_3_2StepDefinition;
  savedResponse?: UNIT_3_2StepResponse;
  released: boolean;
  browseEnabled?: boolean;
  answerVisible: boolean;
  revealProgress?: number;
  onSubmit: (response: UNIT_3_2StepResponse) => void;
}) {
  const activity = getActivitySpec(step);
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(activity, savedResponse));

  useEffect(() => {
    setDraft(getDefaultDraft(activity, savedResponse));
  }, [activity, savedResponse]);

  const contract = getUNIT_3_2PageContract(step.id);
  const submitted = Boolean(savedResponse);
  const requiresRelease = contract.teacherControls.releaseActivity === 'separate_toggle';
  const requiresBrowse = contract.teacherControls.openBrowse === 'separate_toggle';
  const locked = activity.kind !== 'none' && ((requiresRelease && !released && !submitted) || (requiresBrowse && !browseEnabled));
  const revealContent = getRevealContent(step);
  const savedAnswers = savedResponse?.answers ?? {};

  const updateDraft = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  if (activity.kind === 'none') {
    return null;
  }

  const submit = (answers: Record<string, string>) => {
    onSubmit({
      stepId: step.id,
      submittedAt: Date.now(),
      answers,
    });
  };

  const submitCard = (card: ActivityCardSpec) => {
    const nextAnswers = {
      ...savedAnswers,
      ...Object.fromEntries(card.fields.map((field) => [field.key, draft[field.key] ?? ''])),
    };
    submit(nextAnswers);
  };

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
      <p className="premium-lesson-muted mt-2 text-sm">
        {locked
          ? requiresBrowse && !browseEnabled
            ? '教师尚未开放浏览，请先阅读已显示的静态内容。'
            : '教师尚未发放本页互动，请先阅读上方静态内容。'
          : activity.helper}
      </p>

      {contract.teacherControls.teacherStepReveal === 'teacher_only' && activity.kind === 'cards' ? (
        <div className="premium-lesson-muted mt-2 text-xs">当前显影层级：{revealProgress}</div>
      ) : null}

      {locked ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">当前互动尚未释放。</div>
      ) : (
        <div className="mt-4 grid gap-4">
          {activity.questions?.map((question) => (
            <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
              <div className="mt-3">
                {question.type === 'text' ? (
                  <TextInput
                    value={draft[question.key] ?? ''}
                    onChange={(value) => updateDraft(question.key, value)}
                    placeholder="用 1-2 句话说明理由"
                    multiline
                  />
                ) : (
                  <ChoiceGroup
                    options={question.options ?? []}
                    value={draft[question.key] ?? ''}
                    onChange={(value) => updateDraft(question.key, value)}
                  />
                )}
              </div>
            </div>
          ))}

          {activity.fields?.map((field) => (
            <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
              <div className="mt-3">
                {field.type === 'radio' ? (
                  <ChoiceGroup
                    options={field.options ?? []}
                    value={draft[field.key] ?? ''}
                    onChange={(value) => updateDraft(field.key, value)}
                  />
                ) : (
                  <TextInput
                    value={draft[field.key] ?? ''}
                    onChange={(value) => updateDraft(field.key, value)}
                    placeholder={field.placeholder}
                    multiline={field.type === 'textarea'}
                  />
                )}
              </div>
            </div>
          ))}

          {activity.cards?.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {activity.cards.map((card) => {
                const cardSubmitted = card.fields.every((field) => Boolean(savedAnswers[field.key]?.trim()));
                return (
                  <div key={card.id} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                    <div className="premium-lesson-title text-sm font-medium">{card.title}</div>
                    {card.helper ? <div className="premium-lesson-muted mt-2 text-sm">{card.helper}</div> : null}
                    <div className="mt-3 grid gap-3">
                      {card.fields.map((field) => (
                        <div key={field.key}>
                          {field.type === 'radio' ? (
                            <ChoiceGroup
                              options={field.options ?? []}
                              value={draft[field.key] ?? ''}
                              onChange={(value) => updateDraft(field.key, value)}
                            />
                          ) : (
                            <TextInput
                              value={draft[field.key] ?? ''}
                              onChange={(value) => updateDraft(field.key, value)}
                              placeholder={field.placeholder}
                              multiline={field.type === 'textarea'}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => submitCard(card)} className="premium-lesson-action-primary mt-4 w-full">
                      {cardSubmitted ? '重新提交答案' : '提交答案'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {activity.kind === 'form' || activity.kind === 'quiz' ? (
            <button
              type="button"
              onClick={() => submit(draft)}
              className="premium-lesson-action-primary"
            >
              {submitted ? '重新提交本页作答' : '提交答案'}
            </button>
          ) : null}
        </div>
      )}

      <SubmissionStatus
        submitted={submitted}
        submittedText="已提交当前作答，教师端会看到你的最新答案。"
        idleText="尚未提交当前页面作答。"
      />

      {answerVisible && revealContent ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm leading-7">{revealContent}</div>
      ) : null}
    </section>
  );
}

export function UNIT_3_2TeacherActivitySummary({
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
  step: UNIT_3_2StepDefinition;
  responses: UNIT_3_2TeacherResponseItem[];
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
  const activity = getActivitySpec(step);
  const controls = getUNIT_3_2PageContract(step.id).teacherControls;
  const wordCloud = getWordCloudEntries(responses);
  const activityFields = getActivityFields(activity);

  if (activity.kind === 'none') {
    return null;
  }

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
            <button
              type="button"
              onClick={onToggleAnswerVisible}
              disabled={!supportsAnswerReveal(step)}
              className="premium-lesson-action-primary disabled:opacity-40"
            >
              {answerVisible ? '隐藏参考答案' : '显示参考答案'}
            </button>
          ) : null}
        </div>
      </div>

      {controls.teacherStepReveal === 'teacher_only' ? (
        <div className="premium-lesson-muted mt-3 text-sm">当前显影层级：{revealProgress}</div>
      ) : null}

      {summary.length ? (
        <div className="mt-4 grid gap-2">
          {summary.slice(0, 12).map(([label, count]) => (
            <div key={label} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm">
              <span>{label}</span>
              <span className="premium-lesson-caption">{count} 人</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="premium-lesson-muted mt-4 text-sm">本页暂无学生提交。</div>
      )}

      {activityFields.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">参考锚点</div>
            <div className="mt-3 grid gap-3 text-sm">
              {activityFields.map((field) => (
                <div key={field.key}>
                  <div className="font-medium">{field.label}</div>
                  <div className="premium-lesson-muted mt-1">{renderFieldValue(field, field.answer ?? '')}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">最近提交</div>
            <div className="mt-3 grid gap-3">
              {responses.length ? (
                responses.slice(0, 6).map((item) => (
                  <div key={`${item.studentName}-${item.response.submittedAt}`} className="rounded-2xl border border-border/60 px-3 py-3 text-sm">
                    <div className="font-medium">{item.studentName}</div>
                    <div className="mt-2 grid gap-2">
                      {Object.entries(item.response.answers).map(([key, value]) => {
                        const field = activityFields.find((entry) => entry.key === key);
                        return (
                          <div key={key}>
                            <span className="premium-lesson-muted">{field?.label ?? key}：</span>
                            <span>{renderFieldValue(field, value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="premium-lesson-muted text-sm">暂无提交。</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {wordCloud.length ? (
        <div className="premium-lesson-panel mt-4 px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">关键词速览</div>
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

export function UNIT_3_2StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_3_2StepResponse>;
}) {
  const finishedSteps = UNIT_3_2_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_3_2_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {['普通判稳', '特殊情况', '三域翻译', '参数可行域'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是 3-2 最值得带走的判断锚点。</div>
          </div>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
        {'你已经把“普通判稳 -> 参数区间 -> 特殊情况 -> 三域翻译 -> 区域约束”这条链条搭起来了。下一课会解释极点为何沿稳定边界附近那条路径迁移。'}
      </div>
    </section>
  );
}

export function UNIT_3_2StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_3_2StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '3-2',
      stepId: step.id,
      prompts,
    },
    onEvent: onAiEvent,
  });

  useEffect(() => {
    if (!copiedPrompt) {
      return undefined;
    }
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
        当前只围绕 {step.title} 回答问题，帮助你核对“判稳规则 -&gt; 边界结构 -&gt; 参数可行域”的推理链。
      </p>
      <div className="mt-4 grid gap-3">
        {prompts.map((prompt) => (
          <div key={prompt} className="premium-lesson-surface-elevated flex flex-wrap items-start justify-between gap-3 px-4 py-4">
            <div className="text-sm leading-7">{prompt}</div>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(prompt);
                setCopiedPrompt(prompt);
              }}
              className="premium-lesson-control shrink-0"
            >
              <Copy className="h-4 w-4" />
              {copiedPrompt === prompt ? '已复制' : '复制提示词'}
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={ai.togglePanel} className="premium-lesson-action-primary mt-4">
        打开页内 AI
      </button>

      <Dialog open={ai.isPanelOpen} onOpenChange={ai.togglePanel}>
        <DialogContent className="max-w-5xl border-border bg-background p-0 text-foreground">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>{UNIT_3_2_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription>{step.title}</DialogDescription>
          </DialogHeader>
          <div className="h-[75vh]">
            <InteractiveAIPanel ai={ai} title={`${step.title} · AI 对照`} position="right" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
