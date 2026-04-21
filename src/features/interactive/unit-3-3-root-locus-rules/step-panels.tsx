'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Sparkles } from 'lucide-react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveConfig } from '@/features/interactive/types';
import {
  UNIT_3_3_COURSE_TITLE,
  UNIT_3_3_LESSON_STEPS,
  UNIT_3_3_STAGE_LABEL,
  type UNIT_3_3StepDefinition,
  type UNIT_3_3StepResponse,
} from '@/lib/unit-3-3-course';
import {
  DYNAMIC_MAPPING_OPTIONS,
  DYNAMIC_MAPPING_ROWS,
  FORMULA_ORDERING_SEQUENCE,
  KEYPOINT_MATCH_GROUPS,
  KEYPOINT_MATCH_OPTIONS,
  RULE_HIGHLIGHT_OPTIONS,
  TAB_SWITCH_OPTIONS,
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

interface ActivityCardDefinition {
  key: string;
  title: string;
  prompt: string;
  placeholder: string;
  reference: string;
}

interface SequenceSortItem {
  id: string;
  label: string;
  explanation: string;
}

interface ClassificationCardDefinition {
  key: string;
  prompt: string;
  answer: string;
}

type ActivitySpec =
  | { kind: 'none'; helper: string }
  | { kind: 'binary_choice'; helper: string; options: ChoiceOption[]; correct: string }
  | { kind: 'short_response'; helper: string; prompt: string; placeholder: string; reference: string }
  | {
      kind: 'reason_check';
      helper: string;
      prompt: string;
      options: ChoiceOption[];
      correct: string;
      reasonPlaceholder: string;
      reasonReference: string;
    }
  | { kind: 'region_highlight'; helper: string; prompt: string; correct: string[] }
  | { kind: 'triple_match'; helper: string; options: ChoiceOption[] }
  | { kind: 'worked_example'; helper: string; plant: string; method: string[]; sections: ActivityCardDefinition[] }
  | { kind: 'activity_cards'; helper: string; cards: ActivityCardDefinition[] }
  | { kind: 'sequence_sort'; helper: string; items: SequenceSortItem[] }
  | { kind: 'classification_cards'; helper: string; options: ChoiceOption[]; cards: ClassificationCardDefinition[] }
  | { kind: 'formula_ordering'; helper: string }
  | { kind: 'tab_switch'; helper: string; defaultTab: string }
  | { kind: 'mapping_highlight'; helper: string; options: ChoiceOption[] }
  | { kind: 'quiz_group'; helper: string; questions: QuizQuestion[] };

export interface UNIT_3_3TeacherResponseItem {
  studentName: string;
  response: UNIT_3_3StepResponse;
}

const STEP_16_QUESTIONS: QuizQuestion[] = [
  {
    key: 'q1',
    prompt: '判断某个点是否属于根轨迹时，正确顺序是：',
    options: [
      { value: 'angle-first', label: '先看相角条件，再用幅值条件确定参数大小' },
      { value: 'magnitude-first', label: '先算参数，再回头看相角是否凑得上' },
      { value: 'either', label: '两者顺序无关，只要最后都算到即可' },
    ],
    answer: 'angle-first',
    explanation: '相角条件先回答“有没有资格在轨迹上”，幅值条件再回答“若在轨迹上，对应多大参数”。',
  },
  {
    key: 'q2',
    prompt: '读图时为什么必须先骨架、再关键点、最后补局部方向？',
    options: [
      { value: 'skeleton-first', label: '因为骨架先回答整体走向，再由关键点和局部方向补细节' },
      { value: 'keypoint-first', label: '因为关键点最难，所以应该最先抓住' },
      { value: 'any-order', label: '顺序无关，只要法则都算到即可' },
    ],
    answer: 'skeleton-first',
    explanation: '骨架先给整张图的大势，关键点和局部方向是在骨架之后做修正与补细节。',
  },
  {
    key: 'q3',
    prompt: '请用 1-2 句话说明：广义根轨迹为什么不是一套全新的算法？',
    type: 'text',
    explanation: '理想回答应提到 B(s)+aA(s)=0 改写成 1+aA(s)/B(s)=0，再复用普通根轨迹法则。',
  },
];

const WORKED_EXAMPLE_CONFIGS: Record<string, { plant: string; method: string[]; sections: ActivityCardDefinition[] }> = {
  'step-07': {
    plant: 'G(s)H(s)=K/[s(s+2)(s+4)]',
    method: ['先看起点终点', '再判实轴区段', '最后算渐近线并判断总体走向'],
    sections: [
      {
        key: 'real-axis',
        title: '实轴区段判断',
        prompt: '哪些实轴区段属于根轨迹。',
        placeholder: '例如：(-∞,-4) 与 (-2,0) 属于轨迹，因为右侧实极点与实零点总数为奇数。',
        reference: '(-∞,-4) 与 (-2,0) 属于轨迹。',
      },
      {
        key: 'asymptote',
        title: '渐近线重心与角度',
        prompt: '渐近线重心与角度如何确定。',
        placeholder: '例如：重心在 -2，角度为 60°、180°、300°。',
        reference: '重心在 -2，角度为 60°、180°、300°。',
      },
    ],
  },
  'step-09': {
    plant: 'G(s)H(s)=K/[s(s+1)(s+2)]',
    method: ['先筛候选分离点', '再用劳斯判据找虚轴交点', '最后回到关键节点职责'],
    sections: [
      {
        key: 'breakaway',
        title: '真实分离点筛选',
        prompt: '哪一个候选点是真实分离点。',
        placeholder: '例如：先由 dK/ds=0 得候选点，再筛掉不在实轴轨迹段上的点。',
        reference: '只保留位于根轨迹实轴区段上的候选点作为真实分离点。',
      },
      {
        key: 'imaginary-crossing',
        title: '临界增益与虚轴交点',
        prompt: '临界增益与虚轴交点如何对应。',
        placeholder: '例如：K=6 对应 s=±j√2，说明它回答的是稳定边界而不是实轴分离点。',
        reference: 'K=6 对应 s=±j√2，回答的是稳定边界。',
      },
    ],
  },
};

const STEP_10_ACTIVITY_CARDS: ActivityCardDefinition[] = [
  {
    key: 'departure-angle',
    title: '复极点出射角',
    prompt: '上半平面复极点的出射角是多少。',
    placeholder: '例如：先列角度平衡，再给出上半平面复极点的出射角结果。',
    reference: '先由角度平衡求出上半平面复极点的出射角，再用共轭对称得到下半平面结果。',
  },
  {
    key: 'root-sum',
    title: '根之和约束',
    prompt: '根之和原则如何限制另一实根的位置。',
    placeholder: '例如：根之和保持不变，因此局部方向判断不能破坏整张图的实轴对称与总和约束。',
    reference: '根之和保持常数，因此局部方向与整图位置必须同时自洽。',
  },
];

const WORKFLOW_SEQUENCE: SequenceSortItem[] = [
  { id: 'poles-zeros', label: '写出极点与零点', explanation: '先交代对象和分支出发/终止位置。' },
  { id: 'real-axis', label: '判实轴区段', explanation: '用奇偶判段找出真正属于轨迹的实轴段。' },
  { id: 'asymptote', label: '求渐近线', explanation: '先看无穷远方向的大势。' },
  { id: 'real-keypoints', label: '找实轴关键点', explanation: '再补分离点 / 汇合点等实轴关键点。' },
  { id: 'imaginary-axis', label: '查虚轴交点', explanation: '判断何时碰到稳定边界。' },
  { id: 'local-direction', label: '补局部方向', explanation: '再补复极点 / 复零点附近的局部切线方向。' },
  { id: 'global-check', label: '做全图复核', explanation: '最后用对称性、根之和等约束检查整图是否自洽。' },
];

const CLASSIFICATION_OPTIONS: ChoiceOption[] = [
  { value: 'origin-pole', label: '原点极点' },
  { value: 'real-pole', label: '实轴极点' },
  { value: 'complex-pole', label: '共轭复极点' },
];

const CLASSIFICATION_CARDS: ClassificationCardDefinition[] = [
  {
    key: 'integrator-trend',
    prompt: '“更接近积分型结构，需要优先警惕低频拖尾” 对应哪类开环极点？',
    answer: 'origin-pole',
  },
  {
    key: 'real-axis-trend',
    prompt: '“直接决定实轴区段与分离 / 汇合可能” 对应哪类开环极点？',
    answer: 'real-pole',
  },
  {
    key: 'oscillation-trend',
    prompt: '“必须补出射角，振荡趋势更明显” 对应哪类开环极点？',
    answer: 'complex-pole',
  },
];

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function getStepBlueprint(step: UNIT_3_3StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Map',
        intro: '3-2 已经告诉我们稳定边界在哪里，3-3 要继续回答：参数变化时，闭环极点究竟沿什么路径迁移，以及这条路径如何接到 3-4 的读图窗口。',
        sections: [
          {
            title: '路径图',
            tone: 'cyan',
            bullets: ['3-2：先守住稳定边界。', '3-3：解释极点迁移机制与完整法则。', '3-4：进入读图窗口与对象化判断。'],
          },
          {
            title: '任务卡',
            tone: 'emerald',
            bullets: ['补上“边界之前发生了什么”。', '建立相角/幅值条件与完整法则。', '把轨迹重新翻译回快慢、振荡和稳定边界。'],
          },
        ],
        note: '这一页只做模块定位，不提前展开具体算例。',
        prompts: ['为什么 3-3 必须接在 3-2 之后？', '“边界”与“迁移机制”分别回答什么问题？'],
      };
    case 'step-02':
      return {
        kicker: 'Question',
        intro: '只知道稳定区间或边界点，还不足以回答“极点先往哪走、何时更振荡、参数该朝哪里调”。这正是根轨迹机制的入口。',
        sections: [
          {
            title: '本页四问',
            tone: 'amber',
            bullets: ['极点先往哪走？', '什么时候开始更振荡？', '什么时候真正碰到稳定边界？', '参数应朝哪个方向继续调？'],
          },
          {
            title: '本页结论',
            tone: 'violet',
            body: '边界判断告诉我们“停在哪”，迁移机制才解释“怎么走到那儿”。',
          },
        ],
        prompts: ['为什么知道 K=6 仍不够？', '要判断“更快还是更振荡”，还缺哪层信息？'],
      };
    case 'step-03':
      return {
        kicker: 'Scope',
        intro: '本课主链固定为：参数变化 -> 闭环极点迁移 -> 轨迹条件 -> 完整法则 -> 动态翻译。',
        sections: [
          {
            title: '四项目标',
            tone: 'cyan',
            bullets: ['说清根轨迹研究的是闭环极点迁移。', '先用相角条件再用幅值条件。', '按层次使用九项法则。', '把图形重新翻译回系统动态变化。'],
          },
          {
            title: '负责与不负责',
            tone: 'rose',
            bullets: ['本课负责迁移机制、完整法则、广义改写与动态翻译。', '本课不进入控制器设计。', '本课不提前代替 3-4 的参数窗口判断。'],
          },
        ],
        prompts: ['为什么本课必须停在“迁移机制与法则”，而不是提前滑到设计？'],
      };
    case 'step-04':
      return {
        kicker: 'Definition',
        intro: '根轨迹不是某一个参数点的孤立求根，而是参数变化下的闭环根集合。',
        sections: [
          {
            title: '定义卡',
            tone: 'cyan',
            body: '研究对象必须固定写成“参数变化下的闭环根集合”，这样我们才能读出趋势，而不是只记住一个点。',
          },
          {
            title: '起点方程',
            tone: 'emerald',
            formula: '1+G(s)H(s)=0',
          },
          {
            title: '二阶对象例子',
            tone: 'violet',
            formula: 'G(s)=K^*/[s(s+2)]',
          },
        ],
        note: '短答区只补一句“为什么单点求根不够”，不把它改写成标准答案背诵。',
        prompts: ['为什么必须把对象看成“集合”而不是“单点”？', '逐点求根为什么不适合作为工程主判断方式？'],
      };
    case 'step-05':
      return {
        kicker: 'Condition Chain',
        intro: '完整法则并不是从一张表硬背，而是从 1+L(s)=0 到 L(s)=-1 这条链自然分出，并落成“先资格、后参数”的判断节奏。',
        sections: [
          {
            title: '方程链',
            tone: 'cyan',
            formula: '1+L(s)=0 \\rightarrow L(s)=-1',
          },
          {
            title: '两大判据',
            tone: 'emerald',
            bullets: ['相角条件先判断某点能不能在轨迹上。', '幅值条件再把轨迹点对应到具体参数值。'],
          },
        ],
        prompts: ['为什么 L(s)=-1 是根轨迹法则的共同入口？', '为什么这里必须先资格、后参数？'],
      };
    case 'step-06':
      return {
        kicker: 'Skeleton Rules',
        intro: '画图第一轮不是先扑向关键节点，而是先搭骨架：起点终点、实轴区段、渐近线。',
        sections: [
          {
            title: '起点与终点',
            tone: 'cyan',
            body: '根轨迹从开环极点出发，终止于开环零点或无穷远。',
          },
          {
            title: '实轴区段',
            tone: 'emerald',
            body: '先用奇偶判段找出真正属于根轨迹的实轴段。',
          },
          {
            title: '渐近线',
            tone: 'violet',
            bullets: ['先定中心，再定夹角。', '它们告诉我们分支走向无穷远时的大势展开方向。'],
          },
        ],
        prompts: ['为什么必须先骨架、后关键节点？', '只靠骨架法则时，已经能看清哪些大势信息？'],
      };
    case 'step-07':
      return {
        kicker: 'Worked Example 1',
        intro: '第一道例题只允许使用骨架法则，目的不是算满所有细节，而是先把整张图的总体走向搭起来。',
        sections: [
          {
            title: '本页方法',
            tone: 'cyan',
            bullets: ['先看起点终点。', '再判实轴区段。', '最后算渐近线并判断总体走向。'],
          },
          {
            title: '例题对象',
            tone: 'emerald',
            formula: 'G(s)H(s)=K/[s(s+2)(s+4)]',
          },
        ],
        note: '题面默认可见；逐步显影只负责步骤，不遮住题面。',
        prompts: ['这道题里哪些信息属于骨架层，哪些还不能提前算成关键节点？'],
      };
    case 'step-08':
      return {
        kicker: 'Key Points',
        intro: '关键节点不是一团“细节”，而是分别回答不同问题：分离点、虚轴交点、出射角 / 入射角、根之和各司其职。',
        sections: [
          {
            title: '分离点 / 汇合点',
            tone: 'cyan',
            body: '回答分支何时离开实轴，何时重新并回实轴。',
          },
          {
            title: '虚轴交点',
            tone: 'emerald',
            body: '回答根轨迹何时真正触碰稳定边界。',
          },
          {
            title: '出射角 / 入射角',
            tone: 'violet',
            body: '回答复极点、复零点附近的局部切线方向。',
          },
          {
            title: '根之和',
            tone: 'amber',
            body: '回答整张图是否与全局守恒约束自洽。',
          },
        ],
        prompts: ['为什么如果把这些关键节点混为一谈，画图顺序就会混乱？'],
      };
    case 'step-09':
      return {
        kicker: 'Worked Example 2',
        intro: '第二道例题把 dK/ds 和劳斯判据放到同一道题里，目的不是多背一套公式，而是分清“实轴关键点”和“稳定边界”是两类不同问题。',
        sections: [
          {
            title: '题面',
            tone: 'cyan',
            formula: 'G(s)H(s)=K/[s(s+1)(s+2)]',
          },
          {
            title: '双方法分工',
            tone: 'emerald',
            bullets: ['dK/ds 用于实轴关键点。', '劳斯判据用于虚轴交点与稳定边界。'],
          },
          {
            title: '关键边界',
            tone: 'amber',
            formula: 'K=6,\\ s=\\pm j\\sqrt{2}',
          },
          {
            title: '稳定范围回看',
            tone: 'violet',
            formula: '0<K<6',
          },
        ],
        note: '题面与主图始终可见；显影链只负责展开步骤，不吞掉题面。',
        prompts: ['为什么这道题里不能把 dK/ds 和劳斯判据混成一个黑箱步骤？'],
      };
    case 'step-10':
      return {
        kicker: 'Worked Example 3',
        intro: '第三道例题把“局部出射角”和“整图根之和校核”放在一起，目的是说明局部方向与全图自洽必须同时成立。',
        sections: [
          {
            title: '本页抓手',
            tone: 'cyan',
            bullets: ['局部方向看出射角。', '整图自洽看实轴对称与根之和。'],
          },
          {
            title: '例题对象',
            tone: 'emerald',
            formula: 'G(s)H(s)=K/[(s+2)(s^2+2s+5)]',
          },
        ],
        prompts: ['为什么局部出射角和根之和校核必须同时成立？'],
      };
    case 'step-11':
      return {
        kicker: 'Workflow',
        intro: '九项法则不是平铺清单，而是要重组为真实可执行的七步读图法：先骨架，再关键点，最后补局部方向。',
        sections: [
          {
            title: '七步读图法',
            tone: 'cyan',
            bullets: ['写出极点与零点。', '判实轴区段。', '求渐近线。', '找实轴关键点。', '查虚轴交点。', '补局部方向。', '做全图复核。'],
          },
          {
            title: '典型误判',
            tone: 'amber',
            body: '不要一上来先抓分离点，再回头补骨架；顺序一反，整张图就会失真。',
          },
        ],
        prompts: ['为什么“先骨架、后关键点、最后补局部方向”不是口号，而是读图顺序本身？'],
      };
    case 'step-12':
      return {
        kicker: 'Pole Types',
        intro: '不同开环极点类型会留下不同的轨迹趋势线索。把对象类型和图上现象直接对应起来，才能避免只背法则名称。',
        sections: [
          {
            title: '原点极点',
            tone: 'cyan',
            body: '更接近积分型结构，先警惕低频拖尾与主导分支贴近虚轴。',
          },
          {
            title: '实轴极点',
            tone: 'emerald',
            body: '直接决定实轴区段以及分离 / 汇合是否可能出现。',
          },
          {
            title: '共轭复极点',
            tone: 'violet',
            body: '必须补出射角，振荡趋势更明显，局部方向信息更关键。',
          },
          {
            title: '对象与趋势对照',
            tone: 'amber',
            body: '不要把对象类型和轨迹趋势拆开背诵，二者必须直接连起来。',
          },
        ],
        prompts: ['为什么必须重新回到对象类型，而不能只背法则名称？'],
      };
    case 'step-13':
      return {
        kicker: 'Generalized View',
        intro: '广义根轨迹没有发明新法则，它只是把一般参数问题改写回普通根轨迹入口，让原来的判断链继续可用。',
        sections: [
          {
            title: '改写链',
            tone: 'cyan',
            formula: 'B(s)+aA(s)=0 \\rightarrow 1+a\\dfrac{A(s)}{B(s)}=0',
          },
          {
            title: '等效开环',
            tone: 'emerald',
            body: '法则没有变，变化的是参数被改写到等效开环的位置。关键抓手就是“等效开环”。',
          },
        ],
        prompts: ['为什么广义根轨迹不是一套全新的算法？', '等效开环这一步到底在帮我们保留什么？'],
      };
    case 'step-14':
      return {
        kicker: 'Compare',
        intro: '时间常数例子与 0° / 180° 根轨迹都在说明同一个事实：研究对象没变，变化的是参数入口和相角条件。',
        sections: [
          {
            title: '时间常数例子',
            tone: 'cyan',
            bullets: ['先把非增益参数改写成等效开环。', '重点是“能转回普通根轨迹”，而不是多背一个新算例。'],
          },
          {
            title: '0° 根轨迹 vs 180° 根轨迹',
            tone: 'emerald',
            bullets: ['同一研究对象：闭环根迁移。', '主要差异：相角条件方向不同。', '仍然属于统一的广义视角。'],
          },
        ],
        prompts: ['时间常数例子和 0° / 180° 根轨迹为什么还能放在同一页比较？'],
      };
    case 'step-15':
      return {
        kicker: 'Dynamic Translation',
        intro: '根轨迹最终不是为了停在图上，而是要把图重新翻译成“更快、更振荡、更靠近边界”这类动态判断。',
        sections: [
          {
            title: '三条翻译线',
            tone: 'cyan',
            bullets: ['左右半平面：先看稳定与越轴。', '离虚轴距离：再看快慢与拖尾。', '主导极点在实轴还是复平面：再看振荡趋势。'],
          },
          {
            title: '阅读提醒',
            tone: 'amber',
            body: '别机械盯所有分支，而要先抓住主导极点所在位置。',
          },
        ],
        prompts: ['为什么动态翻译必须先抓主导极点？', '更快、更振荡、更靠近边界分别看哪里？'],
      };
    case 'step-16':
      return {
        kicker: 'Post-test',
        intro: '后测只检查链条是否形成，不再新增概念。真正要看的，是条件入口、法则层次、广义改写与动态翻译有没有连成一条判断链。',
        sections: [
          {
            title: '本页任务',
            tone: 'cyan',
            bullets: ['检查相角条件与幅值条件的先后顺序。', '检查读图顺序是否仍然坚持骨架优先。', '检查广义改写与动态翻译是否已经接通。'],
          },
          {
            title: '错因回看',
            tone: 'amber',
            body: '只显示错因标签，不直接把整题答案提前端出来。',
          },
        ],
        prompts: ['如果三道后测只允许抓一个总错误源，最该优先抓的是哪一类？'],
      };
    case 'step-17':
      return {
        kicker: 'Exit',
        intro: '收束页只做三件事：回收五条结论、用信息图压住主线、把出口清楚送到 3-4 的读图窗口。',
        sections: [
          {
            title: '五条带走',
            tone: 'emerald',
            bullets: [
              '研究对象是闭环极点迁移。',
              '先相角条件，后幅值条件。',
              '九项法则共同构成普通根轨迹。',
              '读图时先骨架后关键点再补局部方向。',
              '图上的迁移要重新翻回动态语言。',
            ],
          },
          {
            title: '下一课去向',
            tone: 'cyan',
            body: '3-4 将把这些法则真正用于主图判断、参数窗口与对象化验证。',
          },
        ],
        prompts: ['为什么 3-4 会从“先骨架后关键点再补局部方向”继续展开？'],
      };
    default:
      return {
        kicker: 'Step',
        intro: step.hint,
        sections: [],
      };
  }
}

function getActivitySpec(step: UNIT_3_3StepDefinition): ActivitySpec {
  switch (step.pageType) {
    case 'binary_choice':
      return {
        kind: 'binary_choice',
        helper: '先表态，再看教师统一揭示后的纠偏。',
        options: [
          { value: 'boundary-enough', label: 'A. 知道边界点已经足够' },
          { value: 'need-path', label: 'B. 还需要整条迁移路径' },
        ],
        correct: 'need-path',
      };
    case 'short_response':
      return {
        kind: 'short_response',
        helper: '用 1-2 句话说明：为什么单点求根不足以替代根轨迹。',
        prompt: '为什么单点求根不足以替代根轨迹？',
        placeholder: '例如：工程上要看参数连续变化下的趋势，而不是孤立记住一个点的闭环根。',
        reference: '因为工程判断要看参数连续变化下的闭环根迁移趋势，而不只是某个点的孤立求根结果。',
      };
    case 'reason_check':
      return {
        kind: 'reason_check',
        helper: '先判断“资格还是参数”，再写出一句理由。',
        prompt: '判断某个候选点是否属于根轨迹时，应先检查哪一项？',
        options: [
          { value: 'angle-first', label: '先查相角条件，再看幅值条件' },
          { value: 'magnitude-first', label: '先算参数，再回头看相角' },
        ],
        correct: 'angle-first',
        reasonPlaceholder: '例如：相角条件先回答“能不能在轨迹上”，幅值条件再回答“若在轨迹上，对应多大参数”。',
        reasonReference: '先相角、后幅值；相角先决定资格，幅值再决定参数大小。',
      };
    case 'region_highlight':
      return {
        kind: 'region_highlight',
        helper: '点出真正属于第一轮骨架法则的区域或线索。',
        prompt: '从下列候选中选出“属于骨架法则”的项目。',
        correct: RULE_HIGHLIGHT_OPTIONS.filter((item) => item.category === 'skeleton').map((item) => item.value),
      };
    case 'triple_match':
      return {
        kind: 'triple_match',
        helper: '把三类关键节点和“它们回答什么问题”一一配对。',
        options: [...KEYPOINT_MATCH_OPTIONS],
      };
    case 'worked_example_workspace':
      return {
        kind: 'worked_example',
        helper: '题面默认可见；逐步显影只展开步骤，按卡片分别作答。',
        ...(WORKED_EXAMPLE_CONFIGS[step.id] ?? WORKED_EXAMPLE_CONFIGS['step-07']),
      };
    case 'activity_cards':
      return {
        kind: 'activity_cards',
        helper: '先看完整题面，再按卡片分别完成局部方向与整图校核。',
        cards: STEP_10_ACTIVITY_CARDS,
      };
    case 'sequence_sort':
      return {
        kind: 'sequence_sort',
        helper: '把九项法则重组成七步读图法，而不是平铺背诵。',
        items: WORKFLOW_SEQUENCE,
      };
    case 'classification_cards':
      return {
        kind: 'classification_cards',
        helper: '把轨迹现象与对应开环极点类型匹配。',
        options: CLASSIFICATION_OPTIONS,
        cards: CLASSIFICATION_CARDS,
      };
    case 'formula_ordering':
      return {
        kind: 'formula_ordering',
        helper: '用正确顺序把一般参数问题改写回普通根轨迹入口。',
      };
    case 'tab_switch':
      return {
        kind: 'tab_switch',
        helper: '切换标签比较“时间常数例子”和“0° / 180° 根轨迹”。本页不需要提交。',
        defaultTab: TAB_SWITCH_OPTIONS[0]?.value ?? 'time-constant',
      };
    case 'mapping_highlight':
      return {
        kind: 'mapping_highlight',
        helper: '把图上位置变化翻译成更快、更振荡或更靠近边界。',
        options: [...DYNAMIC_MAPPING_OPTIONS],
      };
    case 'quiz_group':
      return {
        kind: 'quiz_group',
        helper: '后测只检查核心判断，不替代总结卡。',
        questions: STEP_16_QUESTIONS,
      };
    default:
      return {
        kind: 'none',
        helper: '本页以静态阅读与教师推进为主。',
      };
  }
}

function getRevealContent(step: UNIT_3_3StepDefinition) {
  switch (step.id) {
    case 'step-02':
      return '正确项：还需要整条迁移路径。K=6 只说明边界点，不能解释极点是如何走到边界附近的。';
    case 'step-04':
      return '根轨迹强调的是参数连续变化下的闭环根集合，而不是某一个参数点的孤立求根结果。';
    case 'step-05':
      return '顺序必须是“先资格、后参数”：先用相角条件判断能否在轨迹上，再用幅值条件确定参数大小。';
    case 'step-06':
      return '骨架法则先锁定三件事：起点终点、实轴区段、渐近线。分离点和虚轴交点属于下一层关键节点。';
    case 'step-07':
      return '例题 1 的关键不是算满细节，而是先用骨架法则搭出整张图的大势。';
    case 'step-08':
      return '分离点回答“何时离开实轴”，虚轴交点回答“何时碰到稳定边界”，出射角 / 入射角回答“局部切线方向”。';
    case 'step-09':
      return '例题 2 中，dK/ds 用来找实轴关键点，劳斯判据用来找虚轴交点和稳定边界，二者不能混成一步。';
    case 'step-10':
      return '例题 3 要同时满足两层约束：局部方向看出射角，整图位置看根之和与对称性。';
    case 'step-11':
      return '七步读图法的核心顺序是：先骨架，再关键点，最后补局部方向并做全图复核。';
    case 'step-12':
      return '三类开环极点会留下不同的轨迹趋势线索：原点极点更接近积分型，实轴极点影响区段，共轭复极点必须补方向。';
    case 'step-13':
      return '广义根轨迹不是新算法，而是把 B(s)+aA(s)=0 改写成 1+aA(s)/B(s)=0，再复用普通根轨迹法则。';
    case 'step-15':
      return '动态翻译的三个抓手分别是：左右半平面、离虚轴距离、主导分支是在实轴还是复平面。';
    case 'step-16':
      return '3-3 的真正出口不是背法则，而是能把条件、骨架、关键节点、广义改写与动态翻译串成一个整体判断。';
    default:
      return null;
  }
}

function getAiPrompts(step: UNIT_3_3StepDefinition) {
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_3_3StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit33:${step.id}`,
    registryId: 'unit33-inline-ai',
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

function parseStoredList(value?: string) {
  return value ? value.split('||').filter(Boolean) : [];
}

function getWordCloudEntries(responses: UNIT_3_3TeacherResponseItem[]) {
  const counts = new Map<string, number>();
  for (const item of responses) {
    Object.values(item.response.answers)
      .join(' ')
      .split(/[\s,，。；;、/()]+/)
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
  return normalized.length > 64 ? `${normalized.slice(0, 61)}...` : normalized;
}

function getOrderingFromResponse(savedResponse?: UNIT_3_3StepResponse) {
  const stored = parseStoredList(savedResponse?.answers.order);
  return stored.length === FORMULA_ORDERING_SEQUENCE.length
    ? stored
    : FORMULA_ORDERING_SEQUENCE.map((item) => item.id);
}

function getWorkflowOrderingFromResponse(savedResponse?: UNIT_3_3StepResponse) {
  const stored = parseStoredList(savedResponse?.answers.order);
  return stored.length === WORKFLOW_SEQUENCE.length
    ? stored
    : WORKFLOW_SEQUENCE.map((item) => item.id);
}

function summarizeResponses(step: UNIT_3_3StepDefinition, responses: UNIT_3_3TeacherResponseItem[]) {
  if (!responses.length || step.pageType === 'tab_switch') {
    return [];
  }

  const activity = getActivitySpec(step);
  const counts = new Map<string, number>();
  const add = (label: string) => counts.set(label, (counts.get(label) ?? 0) + 1);

  responses.forEach((item) => {
    switch (step.pageType) {
      case 'binary_choice': {
        const value = item.response.answers.choice;
        const label = activity.kind === 'binary_choice' ? activity.options.find((option) => option.value === value)?.label ?? '未作答' : '未作答';
        add(label);
        break;
      }
      case 'reason_check': {
        const value = item.response.answers.choice;
        if (activity.kind === 'reason_check') {
          add(activity.options.find((option) => option.value === value)?.label ?? '未作答');
        }
        break;
      }
      case 'region_highlight': {
        const labels = parseStoredList(item.response.answers.selected)
          .map((value) => RULE_HIGHLIGHT_OPTIONS.find((option) => option.value === value)?.label ?? value)
          .join(' + ');
        add(labels || '未作答');
        break;
      }
      case 'triple_match': {
        KEYPOINT_MATCH_GROUPS.forEach((group) => {
          const value = item.response.answers[group.key];
          const label = KEYPOINT_MATCH_OPTIONS.find((option) => option.value === value)?.label ?? '未作答';
          add(`${group.prompt} -> ${label}`);
        });
        break;
      }
      case 'worked_example_workspace': {
        if (activity.kind === 'worked_example') {
          activity.sections.forEach((section) => add(`${section.title} -> ${trimText(item.response.answers[section.key] ?? '未作答')}`));
        }
        break;
      }
      case 'activity_cards': {
        if (activity.kind === 'activity_cards') {
          activity.cards.forEach((card) => add(`${card.title} -> ${trimText(item.response.answers[card.key] ?? '未作答')}`));
        }
        break;
      }
      case 'sequence_sort': {
        const order = parseStoredList(item.response.answers.order)
          .map((value) => WORKFLOW_SEQUENCE.find((entry) => entry.id === value)?.label ?? value)
          .join(' -> ');
        add(order || '未作答');
        break;
      }
      case 'classification_cards': {
        CLASSIFICATION_CARDS.forEach((card) => {
          const value = item.response.answers[card.key];
          const label = CLASSIFICATION_OPTIONS.find((option) => option.value === value)?.label ?? '未作答';
          add(`${card.prompt} -> ${label}`);
        });
        break;
      }
      case 'formula_ordering': {
        const order = parseStoredList(item.response.answers.order)
          .map((value) => FORMULA_ORDERING_SEQUENCE.find((entry) => entry.id === value)?.label ?? value)
          .join(' -> ');
        add(order || '未作答');
        break;
      }
      case 'mapping_highlight': {
        DYNAMIC_MAPPING_ROWS.forEach((row) => {
          const value = item.response.answers[row.key];
          const label = DYNAMIC_MAPPING_OPTIONS.find((option) => option.value === value)?.label ?? '未作答';
          add(`${row.cue} -> ${label}`);
        });
        break;
      }
      case 'quiz_group': {
        STEP_16_QUESTIONS.forEach((question) => {
          const value = item.response.answers[question.key];
          const label = question.type === 'text'
            ? trimText(value ?? '未作答')
            : question.options?.find((option) => option.value === value)?.label ?? '未作答';
          add(`${question.prompt} -> ${label}`);
        });
        break;
      }
      default:
        Object.values(item.response.answers).forEach((value) => add(trimText(value)));
        break;
    }
  });

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
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
        className="premium-lesson-input min-h-[120px] w-full resize-y"
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

function renderFieldValue(step: UNIT_3_3StepDefinition, key: string, value: string) {
  const activity = getActivitySpec(step);

  switch (step.pageType) {
    case 'binary_choice':
      return (activity.kind === 'binary_choice' ? activity.options.find((option) => option.value === value)?.label : value) ?? value;
    case 'reason_check':
      return (activity.kind === 'reason_check' ? activity.options.find((option) => option.value === value)?.label : value) ?? value;
    case 'triple_match':
      return KEYPOINT_MATCH_OPTIONS.find((option) => option.value === value)?.label ?? value;
    case 'classification_cards':
      return CLASSIFICATION_OPTIONS.find((option) => option.value === value)?.label ?? value;
    case 'mapping_highlight':
      return DYNAMIC_MAPPING_OPTIONS.find((option) => option.value === value)?.label ?? value;
    default:
      return value;
  }
}

function supportsAnswerReveal(step: UNIT_3_3StepDefinition) {
  return step.pageType !== 'display' && step.pageType !== 'summary' && step.pageType !== 'tab_switch' && Boolean(getRevealContent(step));
}

export function UNIT_3_3KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从稳定边界走向迁移机制，再走向读图窗口</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { label: '3-2', title: '稳定边界', body: '先回答“稳定边界在哪里”。', active: false },
          { label: '3-3', title: '迁移机制', body: '再回答“极点怎样走向边界”。', active: true },
          { label: '3-4', title: '读图窗口', body: '最后把图读回对象与参数窗口。', active: false },
        ].map((item) => (
          <div key={item.label} className={`premium-lesson-surface-elevated px-4 py-4 ${item.active ? 'ring-2 ring-cyan-400' : ''}`}>
            <div className="premium-lesson-kicker">{item.label}</div>
            <div className="premium-lesson-title mt-2 text-base font-semibold">{item.title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{item.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_3_3StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  onWorkspaceParameterChange: _onWorkspaceParameterChange,
}: {
  step: UNIT_3_3StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">
        {blueprint.kicker} · {UNIT_3_3_STAGE_LABEL[step.stage]}
      </div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>

      {mediaSrc ? (
        <figure className="premium-lesson-surface-elevated mt-4 overflow-hidden px-4 py-4">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/60 bg-background/60">
            <Image src={mediaSrc} alt={mediaAlt ?? step.title} fill className="object-contain" />
          </div>
          <figcaption className="premium-lesson-muted mt-2 text-xs">图示用于支撑当前环节的读图与判断。</figcaption>
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

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

export function UNIT_3_3StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_3StepDefinition;
  savedResponse?: UNIT_3_3StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_3StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const activity = useMemo(() => getActivitySpec(step), [step]);
  const isTabSwitch = activity.kind === 'tab_switch';
  const defaultTab = isTabSwitch ? activity.defaultTab : TAB_SWITCH_OPTIONS[0]?.value ?? 'time-constant';
  const [draft, setDraft] = useState<Record<string, string>>(savedResponse?.answers ?? {});
  const [selectedRegions, setSelectedRegions] = useState<string[]>(parseStoredList(savedResponse?.answers.selected));
  const [ordering, setOrdering] = useState<string[]>(getOrderingFromResponse(savedResponse));
  const [workflowOrdering, setWorkflowOrdering] = useState<string[]>(getWorkflowOrderingFromResponse(savedResponse));
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setDraft(savedResponse?.answers ?? {});
    setSelectedRegions(parseStoredList(savedResponse?.answers.selected));
    setOrdering(getOrderingFromResponse(savedResponse));
    setWorkflowOrdering(getWorkflowOrderingFromResponse(savedResponse));
    if (isTabSwitch) {
      setActiveTab(savedResponse?.answers.tab ?? defaultTab);
    }
  }, [defaultTab, isTabSwitch, savedResponse]);

  const submitted = Boolean(savedResponse);
  const locked = !released && activity.kind !== 'none' && activity.kind !== 'tab_switch';
  const revealContent = getRevealContent(step);

  const updateDraft = (key: string, value: string, source: WorkspaceParameterChange['source'] = 'input') => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    onWorkspaceParameterChange?.({ key, value, source });
  };

  const handleSubmit = (answers: Record<string, string>) => {
    onSubmit({
      stepId: step.id,
      submittedAt: Date.now(),
      answers,
    });
  };

  if (activity.kind === 'none') {
    return null;
  }

  if (activity.kind === 'tab_switch') {
    const currentTab = TAB_SWITCH_OPTIONS.find((item) => item.value === activeTab) ?? TAB_SWITCH_OPTIONS[0];

    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">对照切换区</div>
        <p className="premium-lesson-muted mt-2 text-sm">{activity.helper}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TAB_SWITCH_OPTIONS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setActiveTab(tab.value);
                onWorkspaceParameterChange?.({ key: 'tab', value: tab.value, source: 'button' });
              }}
              className={`premium-lesson-control ${activeTab === tab.value ? 'ring-2 ring-cyan-400' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {currentTab ? (
          <div className="premium-lesson-surface-elevated mt-4 rounded-3xl px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">{currentTab.heading}</div>
            <ul className="mt-3 grid gap-2 text-sm leading-7">
              {currentTab.bullets.map((item) => (
                <li key={item} className="ml-4 list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <SubmissionStatus submitted={false} idleText="本页只记录你的关注切换，不需要提交到教师端。" />
      </section>
    );
  }

  const renderActivityBody = () => {
    switch (activity.kind) {
      case 'binary_choice':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">你的判断</div>
              <div className="mt-3">
                <ChoiceGroup
                  options={activity.options}
                  value={draft.choice ?? ''}
                  onChange={(value) => updateDraft('choice', value, 'button')}
                />
              </div>
            </div>
            <button type="button" onClick={() => handleSubmit({ choice: draft.choice ?? '' })} className="premium-lesson-action-primary">
              {submitted ? '重新提交本页判断' : '提交判断'}
            </button>
          </div>
        );
      case 'short_response':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{activity.prompt}</div>
              <div className="mt-3">
                <TextInput
                  value={draft.reason ?? ''}
                  onChange={(value) => updateDraft('reason', value)}
                  placeholder={activity.placeholder}
                  multiline
                />
              </div>
            </div>
            <button type="button" onClick={() => handleSubmit({ reason: draft.reason ?? '' })} className="premium-lesson-action-primary">
              {submitted ? '重新提交短答' : '提交短答'}
            </button>
          </div>
        );
      case 'reason_check':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{activity.prompt}</div>
              <div className="mt-3">
                <ChoiceGroup
                  options={activity.options}
                  value={draft.choice ?? ''}
                  onChange={(value) => updateDraft('choice', value, 'button')}
                />
              </div>
            </div>
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">一句理由</div>
              <div className="mt-3">
                <TextInput
                  value={draft.reason ?? ''}
                  onChange={(value) => updateDraft('reason', value)}
                  placeholder={activity.reasonPlaceholder}
                  multiline
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSubmit({ choice: draft.choice ?? '', reason: draft.reason ?? '' })}
              className="premium-lesson-action-primary"
            >
              {submitted ? '重新提交判断' : '提交判断'}
            </button>
          </div>
        );
      case 'region_highlight':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{activity.prompt}</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {RULE_HIGHLIGHT_OPTIONS.map((option) => {
                  const active = selectedRegions.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSelectedRegions((prev) => {
                          const next = prev.includes(option.value)
                            ? prev.filter((value) => value !== option.value)
                            : [...prev, option.value];
                          onWorkspaceParameterChange?.({ key: 'selected', value: next.join('||'), source: 'button' });
                          return next;
                        });
                      }}
                      className={`premium-lesson-surface-elevated rounded-3xl border px-4 py-4 text-left ${
                        active ? 'border-cyan-400 ring-2 ring-cyan-400' : 'border-border/60'
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="premium-lesson-muted mt-2 text-sm">{option.figureCue}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedRegions.length ? (
              <div className="premium-lesson-tone-block premium-tone-slate text-sm">
                已选：
                {selectedRegions
                  .map((value) => RULE_HIGHLIGHT_OPTIONS.find((option) => option.value === value)?.label ?? value)
                  .join('、')}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => handleSubmit({ selected: selectedRegions.join('||') })}
              className="premium-lesson-action-primary"
            >
              {submitted ? '重新提交高亮选择' : '提交高亮选择'}
            </button>
          </div>
        );
      case 'triple_match':
        return (
          <div className="grid gap-4">
            {KEYPOINT_MATCH_GROUPS.map((group) => (
              <div key={group.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{group.prompt}</div>
                <div className="mt-3">
                  <ChoiceGroup
                    options={activity.options}
                    value={draft[group.key] ?? ''}
                    onChange={(value) => updateDraft(group.key, value, 'button')}
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => handleSubmit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交配对' : '提交配对'}
            </button>
          </div>
        );
      case 'worked_example':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-tone-block premium-tone-cyan text-sm">
              主例：{activity.plant}。按“{activity.method.join(' -> ')}”推进。
            </div>
            {activity.sections.map((section) => (
              <div key={section.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{section.title}</div>
                <div className="premium-lesson-muted mt-2 text-sm">{section.prompt}</div>
                <div className="mt-3">
                  <TextInput
                    value={draft[section.key] ?? ''}
                    onChange={(value) => updateDraft(section.key, value)}
                    placeholder={section.placeholder}
                    multiline
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => handleSubmit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交本页作答' : '提交本页作答'}
            </button>
          </div>
        );
      case 'activity_cards':
        return (
          <div className="grid gap-4">
            {activity.cards.map((card) => (
              <div key={card.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{card.title}</div>
                <div className="premium-lesson-muted mt-2 text-sm">{card.prompt}</div>
                <div className="mt-3">
                  <TextInput
                    value={draft[card.key] ?? ''}
                    onChange={(value) => updateDraft(card.key, value)}
                    placeholder={card.placeholder}
                    multiline
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => handleSubmit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交作答卡' : '提交作答卡'}
            </button>
          </div>
        );
      case 'sequence_sort':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">按读图顺序重排步骤</div>
              <div className="mt-3 grid gap-3">
                {workflowOrdering.map((id, index) => {
                  const item = activity.items.find((entry) => entry.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} className="rounded-2xl border border-border/60 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {index + 1}. {item.label}
                          </div>
                          <div className="premium-lesson-muted mt-1 text-sm">{item.explanation}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => {
                              setWorkflowOrdering((prev) => {
                                const next = [...prev];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                onWorkspaceParameterChange?.({ key: 'order', value: next.join('||'), source: 'button' });
                                return next;
                              });
                            }}
                            className="premium-lesson-control disabled:opacity-40"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={index === workflowOrdering.length - 1}
                            onClick={() => {
                              setWorkflowOrdering((prev) => {
                                const next = [...prev];
                                [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                onWorkspaceParameterChange?.({ key: 'order', value: next.join('||'), source: 'button' });
                                return next;
                              });
                            }}
                            className="premium-lesson-control disabled:opacity-40"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSubmit({ order: workflowOrdering.join('||') })}
              className="premium-lesson-action-primary"
            >
              {submitted ? '重新提交排序' : '提交排序'}
            </button>
          </div>
        );
      case 'classification_cards':
        return (
          <div className="grid gap-4">
            {activity.cards.map((card) => (
              <div key={card.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{card.prompt}</div>
                <div className="mt-3">
                  <ChoiceGroup
                    options={activity.options}
                    value={draft[card.key] ?? ''}
                    onChange={(value) => updateDraft(card.key, value, 'button')}
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => handleSubmit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交分类' : '提交分类'}
            </button>
          </div>
        );
      case 'formula_ordering':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">拖顺序之前，先确认每一步在讲什么</div>
              <div className="mt-3 grid gap-3">
                {ordering.map((id, index) => {
                  const item = FORMULA_ORDERING_SEQUENCE.find((entry) => entry.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} className="rounded-2xl border border-border/60 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {index + 1}. {item.label}
                          </div>
                          <div className="premium-lesson-muted mt-1 text-sm">{item.explanation}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => {
                              setOrdering((prev) => {
                                const next = [...prev];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                onWorkspaceParameterChange?.({ key: 'order', value: next.join('||'), source: 'button' });
                                return next;
                              });
                            }}
                            className="premium-lesson-control disabled:opacity-40"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={index === ordering.length - 1}
                            onClick={() => {
                              setOrdering((prev) => {
                                const next = [...prev];
                                [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                onWorkspaceParameterChange?.({ key: 'order', value: next.join('||'), source: 'button' });
                                return next;
                              });
                            }}
                            className="premium-lesson-control disabled:opacity-40"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSubmit({ order: ordering.join('||') })}
              className="premium-lesson-action-primary"
            >
              {submitted ? '重新提交排序' : '提交排序'}
            </button>
          </div>
        );
      case 'mapping_highlight':
        return (
          <div className="grid gap-4">
            {DYNAMIC_MAPPING_ROWS.map((row) => (
              <div key={row.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{row.cue}</div>
                <div className="mt-3">
                  <ChoiceGroup
                    options={activity.options}
                    value={draft[row.key] ?? ''}
                    onChange={(value) => updateDraft(row.key, value, 'button')}
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => handleSubmit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交映射' : '提交映射'}
            </button>
          </div>
        );
      case 'quiz_group':
        return (
          <div className="grid gap-4">
            {activity.questions.map((question) => (
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
                      onChange={(value) => updateDraft(question.key, value, 'button')}
                    />
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => handleSubmit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交后测' : '提交后测'}
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
      <p className="premium-lesson-muted mt-2 text-sm">{locked ? '教师尚未释放本页互动，请先阅读上方静态内容。' : activity.helper}</p>

      {locked ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">当前互动尚未释放。</div>
      ) : (
        <div className="mt-4">{renderActivityBody()}</div>
      )}

      <SubmissionStatus submitted={submitted} />

      {answerVisible && revealContent ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm leading-7">{revealContent}</div>
      ) : null}
    </section>
  );
}

function getTeacherReferenceItems(step: UNIT_3_3StepDefinition) {
  switch (step.pageType) {
    case 'binary_choice':
      return [{ label: '正确项', value: 'B. 还需要整条迁移路径' }];
    case 'short_response':
      return [{ label: '参考口径', value: '强调趋势与集合视角，而非孤立单点求根。' }];
    case 'reason_check':
      return [
        { label: '正确顺序', value: '先相角、后幅值' },
        { label: '理由锚点', value: '相角先判资格，幅值再定参数。' },
      ];
    case 'region_highlight':
      return RULE_HIGHLIGHT_OPTIONS.filter((item) => item.category === 'skeleton').map((item) => ({
        label: item.label,
        value: item.detail,
      }));
    case 'triple_match':
      return KEYPOINT_MATCH_GROUPS.map((group) => ({
        label: group.prompt,
        value: KEYPOINT_MATCH_OPTIONS.find((option) => option.value === group.answer)?.label ?? group.answer,
      }));
    case 'worked_example_workspace':
      return (WORKED_EXAMPLE_CONFIGS[step.id]?.sections ?? []).map((section) => ({
        label: section.title,
        value: section.reference,
      }));
    case 'activity_cards':
      return STEP_10_ACTIVITY_CARDS.map((card) => ({
        label: card.title,
        value: card.reference,
      }));
    case 'sequence_sort':
      return WORKFLOW_SEQUENCE.map((item, index) => ({
        label: `顺序 ${index + 1}`,
        value: item.label,
      }));
    case 'classification_cards':
      return CLASSIFICATION_CARDS.map((card) => ({
        label: card.prompt,
        value: CLASSIFICATION_OPTIONS.find((option) => option.value === card.answer)?.label ?? card.answer,
      }));
    case 'formula_ordering':
      return FORMULA_ORDERING_SEQUENCE.map((item, index) => ({
        label: `顺序 ${index + 1}`,
        value: item.label,
      }));
    case 'mapping_highlight':
      return DYNAMIC_MAPPING_ROWS.map((row) => ({
        label: row.cue,
        value: DYNAMIC_MAPPING_OPTIONS.find((option) => option.value === row.answer)?.label ?? row.answer,
      }));
    case 'quiz_group':
      return STEP_16_QUESTIONS.map((question) => ({
        label: question.prompt,
        value: question.type === 'text'
          ? question.explanation
          : question.options?.find((option) => option.value === question.answer)?.label ?? '',
      }));
    default:
      return [];
  }
}

export function UNIT_3_3TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_3_3StepDefinition;
  responses: UNIT_3_3TeacherResponseItem[];
  released: boolean;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const summary = useMemo(() => summarizeResponses(step, responses), [responses, step]);
  const wordCloud = getWordCloudEntries(responses);
  const referenceItems = getTeacherReferenceItems(step);

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
            disabled={!supportsAnswerReveal(step)}
            className="premium-lesson-action-primary disabled:opacity-40"
          >
            {answerVisible ? '隐藏参考答案' : '显示参考答案'}
          </button>
        </div>
      </div>

      {step.pageType === 'tab_switch' ? (
        <div className="premium-lesson-tone-block premium-tone-slate mt-4 text-sm">
          本页主要依赖切换行为埋点，不要求学生提交表单。教师端重点关注学生在“时间常数例子 / 0° vs 180°”之间的停留分布。
        </div>
      ) : summary.length ? (
        <div className="mt-4 grid gap-2">
          {summary.slice(0, 10).map(([label, count]) => (
            <div key={label} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm">
              <span>{label}</span>
              <span className="premium-lesson-caption">{count} 人</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="premium-lesson-muted mt-4 text-sm">本页暂无学生提交。</div>
      )}

      {referenceItems.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">参考锚点</div>
            <div className="mt-3 grid gap-3 text-sm">
              {referenceItems.map((item) => (
                <div key={item.label}>
                  <div className="font-medium">{item.label}</div>
                  <div className="premium-lesson-muted mt-1">{item.value}</div>
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
                      {Object.entries(item.response.answers).map(([key, value]) => (
                        <div key={key}>
                          <span className="premium-lesson-muted">{key}：</span>
                          <span>{renderFieldValue(step, key, value)}</span>
                        </div>
                      ))}
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

      {wordCloud.length && (
        step.pageType === 'short_response'
        || step.pageType === 'worked_example_workspace'
        || step.pageType === 'activity_cards'
        || step.pageType === 'quiz_group'
      ) ? (
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

export function UNIT_3_3StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_3_3StepResponse>;
}) {
  const finishedSteps = UNIT_3_3_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_3_3_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {['根轨迹定义', '骨架法则', '广义改写', '动态翻译'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是 3-3 需要带走的判断锚点。</div>
          </div>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
        你已经把“定义、条件、骨架、关键节点、动态翻译”这条链条搭起来了。下一课将进入读图窗口与对象化判断。
      </div>
    </section>
  );
}

export function UNIT_3_3StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_3_3StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '3-3',
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
        当前只围绕 {step.title} 回答问题，帮助你核对“定义、条件、骨架、关键节点、动态翻译”的推理链。
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
            <DialogTitle>{UNIT_3_3_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
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
