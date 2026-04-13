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
  WORKED_EXAMPLE_REFERENCE,
  WORKED_EXAMPLE_SECTIONS,
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
  | { kind: 'worked_example'; helper: string }
  | { kind: 'formula_ordering'; helper: string }
  | { kind: 'tab_switch'; helper: string; defaultTab: string }
  | { kind: 'mapping_highlight'; helper: string; options: ChoiceOption[] }
  | { kind: 'quiz_group'; helper: string; questions: QuizQuestion[] };

export interface UNIT_3_3TeacherResponseItem {
  studentName: string;
  response: UNIT_3_3StepResponse;
}

const STEP_13_QUESTIONS: QuizQuestion[] = [
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
    prompt: '对 G(s)H(s)=K/[s(s+1)(s+2)] 这道主例，稳定范围是：',
    options: [
      { value: '0-3', label: '0<K<3' },
      { value: '0-6', label: '0<K<6' },
      { value: '6-infty', label: 'K>6' },
    ],
    answer: '0-6',
    explanation: 'K=6 是虚轴交点对应的稳定边界，真正的稳定范围是 0<K<6。',
  },
  {
    key: 'q3',
    prompt: '请用 1-2 句话说明：为什么广义根轨迹不是一套全新的算法？',
    type: 'text',
    explanation: '理想回答应提到 B(s)+aA(s)=0 改写成 1+aA(s)/B(s)=0，再复用普通根轨迹法则。',
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
        intro: '3-2 已经告诉我们稳定边界在哪里，3-3 要继续回答：参数变化时，闭环极点为什么会沿特定路径迁移，以及这条路径如何翻译成动态变化。',
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
        intro: '只知道 K=6 是边界点，还不足以回答“极点先往哪走、何时开始更振荡、边界之前发生了什么”。这正是根轨迹机制的入口。',
        sections: [
          {
            title: '三问',
            tone: 'amber',
            bullets: ['极点先往哪走？', '系统何时开始更振荡？', '边界点之前发生了什么迁移？'],
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
            title: '五项目标',
            tone: 'cyan',
            bullets: ['理解根轨迹定义。', '掌握 GH=-1 到两大条件的入口。', '会用骨架法则与关键节点读图。', '理解广义根轨迹如何转回普通根轨迹。', '把轨迹翻译回系统动态变化。'],
          },
          {
            title: '课程边界',
            tone: 'rose',
            bullets: ['不进入完整手工绘图训练。', '不进入控制器参数设计。', '不把 3-4 的读图窗口提前塞回本课。'],
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
        kicker: 'Condition Entry',
        intro: '完整法则并不是从一张表硬背，而是从闭环特征方程自然分出。',
        sections: [
          {
            title: '方程链',
            tone: 'cyan',
            formula: '1+G(s)H(s)=0  ->  G(s)H(s)=-1',
          },
          {
            title: '入口卡',
            tone: 'emerald',
            body: '后续的相角条件与幅值条件，都从 GH=-1 这一步分出。',
          },
        ],
        prompts: ['为什么 GH=-1 是根轨迹法则的共同入口？'],
      };
    case 'step-06':
      return {
        kicker: 'Angle Then Magnitude',
        intro: '两条条件缺一不可，但使用顺序不能颠倒：先资格、后参数。',
        sections: [
          {
            title: '相角条件',
            tone: 'cyan',
            formula: 'angle G(s)H(s)=(2k+1)pi',
          },
          {
            title: '幅值条件',
            tone: 'emerald',
            formula: '|G(s)H(s)|=1',
          },
          {
            title: '顺序提醒',
            tone: 'amber',
            body: '先资格、后参数。先看这个点能不能在轨迹上，再看它对应多大参数。',
          },
        ],
        prompts: ['为什么相角条件必须先于幅值条件？', '幅值条件到底补的是哪一层信息？'],
      };
    case 'step-07':
      return {
        kicker: 'Skeleton Rules',
        intro: '画图第一轮不先扑向关键节点，而是先搭骨架：起点终点、实轴区段、渐近线。',
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
    case 'step-08':
      return {
        kicker: 'Key Points',
        intro: '关键节点不是一团“细节”，而是分别回答不同问题：分离点、虚轴交点、起始角/终止角各司其职。',
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
            title: '起始角 / 终止角',
            tone: 'violet',
            body: '回答复极点、复零点附近的局部切线方向。',
          },
        ],
        prompts: ['为什么如果把三类关键节点混为一谈，画图顺序就会混乱？'],
      };
    case 'step-09':
      return {
        kicker: 'Worked Example',
        intro: '把骨架、关键点与稳定范围串到同一道主例里，才算真正把 3-3 的机制链条接起来。',
        sections: [
          {
            title: '题面',
            tone: 'cyan',
            formula: 'G(s)H(s)=K/[s(s+1)(s+2)]',
          },
          {
            title: '三步法',
            tone: 'emerald',
            bullets: ['先骨架。', '再关键点。', '最后稳定范围。'],
          },
          {
            title: '最终稳定范围',
            tone: 'amber',
            formula: '0<K<6',
          },
        ],
        note: '工作区只承接三步法和中间量，不一次性放出完整答案。',
        prompts: ['为什么 K=6 既是关键节点又是稳定边界？', '为什么必须按三步法而不是上来直接算边界？'],
      };
    case 'step-10':
      return {
        kicker: 'Generalized View',
        intro: '广义根轨迹没有发明新法则，它只是把一般参数问题改写回普通根轨迹入口。',
        sections: [
          {
            title: '一般参数形式',
            tone: 'cyan',
            formula: 'B(s)+aA(s)=0',
          },
          {
            title: '改写回标准入口',
            tone: 'emerald',
            formula: '1+aA(s)/B(s)=0',
          },
          {
            title: '等效开环卡',
            tone: 'violet',
            body: '没有新法则，只有新改写：把一般参数对象认成新的等效开环后，再复用普通根轨迹。',
          },
        ],
        prompts: ['为什么广义根轨迹不是一套新算法？', '等效开环卡到底在帮我们做什么？'],
      };
    case 'step-11':
      return {
        kicker: 'Compare',
        intro: '时间常数例子与 0° / 180° 根轨迹都在说明同一个事实：研究对象没变，变化的是参数入口和相角条件。',
        sections: [
          {
            title: '时间常数例子',
            tone: 'cyan',
            bullets: ['把非增益参数改写成等效开环。', '重点是“能转回普通根轨迹”，不是多背一个新算例。'],
          },
          {
            title: '0° 根轨迹 vs 180° 根轨迹',
            tone: 'emerald',
            bullets: ['同一研究对象：闭环根迁移。', '主要差异：相角条件方向不同。', '仍然属于统一的广义视角。'],
          },
        ],
        prompts: ['时间常数例子和 0°/180° 根轨迹为什么还能放在同一页比较？'],
      };
    case 'step-12':
      return {
        kicker: 'Dynamic Translation',
        intro: '根轨迹最终不是为了停在图上，而是要把图重新翻译成“更快、更振荡、更靠近边界”这类动态判断。',
        sections: [
          {
            title: '三条翻译线',
            tone: 'cyan',
            bullets: ['左右半平面：先看稳定与越轴。', '离虚轴距离：再看快慢与阻尼。', '实轴/复平面主导：再看振荡趋势。'],
          },
          {
            title: '阅读提醒',
            tone: 'amber',
            body: '别机械盯所有分支，而要先抓住主导分支。',
          },
        ],
        prompts: ['为什么动态翻译必须先抓主导分支？', '更快、更振荡、更靠近边界分别看哪里？'],
      };
    case 'step-13':
      return {
        kicker: 'Post-check',
        intro: '收束页同时承担三件事：后测诊断、五点总结，以及把出口稳稳送到 3-4 的读图窗口。',
        sections: [
          {
            title: '五点总结',
            tone: 'emerald',
            bullets: [
              '根轨迹研究的是参数变化下的闭环根集合。',
              'GH=-1 是相角/幅值条件的共同入口。',
              '先骨架，再关键节点，最后把图翻译回稳定范围。',
              '广义根轨迹只是把一般参数改写回普通根轨迹。',
              '动态翻译是为 3-4 的读图窗口做准备。',
            ],
          },
          {
            title: '下一课去向',
            tone: 'cyan',
            body: '3-4 将正式进入读图判断、关键节点验证与参数窗口。',
          },
        ],
        prompts: ['如果只抓一个总错误源，3-3 最该优先纠正什么？'],
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
        helper: '依次补全骨架、关键点与稳定范围，不一次性抄完整答案。',
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
        questions: STEP_13_QUESTIONS,
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
    case 'step-06':
      return '顺序必须是“先资格、后参数”：先用相角条件判断能否在轨迹上，再用幅值条件确定参数大小。';
    case 'step-07':
      return '骨架法则先锁定三件事：起点终点、实轴区段、渐近线。分离点和虚轴交点属于下一层关键节点。';
    case 'step-08':
      return '分离点回答“何时离开实轴”，虚轴交点回答“何时碰到稳定边界”，起始角/终止角回答“局部切线方向”。';
    case 'step-09':
      return '主例标准链：先骨架，再关键点，最后稳定范围；其中 K=6 对应虚轴交点，真正稳定范围是 0<K<6。';
    case 'step-10':
      return '广义根轨迹不是新算法，而是把 B(s)+aA(s)=0 改写成 1+aA(s)/B(s)=0，再复用普通根轨迹法则。';
    case 'step-12':
      return '动态翻译的三个抓手分别是：左右半平面、离虚轴距离、主导分支是在实轴还是复平面。';
    case 'step-13':
      return '3-3 的真正出口不是背法则，而是能把条件、骨架、关键节点与动态翻译串成一个整体判断。';
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
        WORKED_EXAMPLE_SECTIONS.forEach((section) => add(`${section.title} -> ${trimText(item.response.answers[section.key] ?? '未作答')}`));
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
        STEP_13_QUESTIONS.forEach((question) => {
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
  const activity = getActivitySpec(step);
  const [draft, setDraft] = useState<Record<string, string>>(savedResponse?.answers ?? {});
  const [selectedRegions, setSelectedRegions] = useState<string[]>(parseStoredList(savedResponse?.answers.selected));
  const [ordering, setOrdering] = useState<string[]>(getOrderingFromResponse(savedResponse));
  const [activeTab, setActiveTab] = useState(activity.kind === 'tab_switch' ? activity.defaultTab : TAB_SWITCH_OPTIONS[0]?.value ?? 'time-constant');

  useEffect(() => {
    setDraft(savedResponse?.answers ?? {});
    setSelectedRegions(parseStoredList(savedResponse?.answers.selected));
    setOrdering(getOrderingFromResponse(savedResponse));
    if (activity.kind === 'tab_switch') {
      setActiveTab(savedResponse?.answers.tab ?? activity.defaultTab);
    }
  }, [activity, savedResponse]);

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
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">本页无需提交</div>
        <SubmissionStatus submitted={false} idleText="本页以静态阅读和教师推进为主，不需要学生提交作答。" />
      </section>
    );
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
              主例：{WORKED_EXAMPLE_REFERENCE.plant}。按“{WORKED_EXAMPLE_REFERENCE.method.join(' -> ')}”推进。
            </div>
            {WORKED_EXAMPLE_SECTIONS.map((section) => (
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
              {submitted ? '重新提交三步法结果' : '提交三步法结果'}
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
      return WORKED_EXAMPLE_SECTIONS.map((section) => ({
        label: section.title,
        value: section.reference,
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
      return STEP_13_QUESTIONS.map((question) => ({
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

      {wordCloud.length && (step.pageType === 'short_response' || step.pageType === 'worked_example_workspace' || step.pageType === 'quiz_group') ? (
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
