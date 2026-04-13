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
  UNIT_3_2_COURSE_TITLE,
  UNIT_3_2_LESSON_STEPS,
  UNIT_3_2_STAGE_LABEL,
  type UNIT_3_2StepDefinition,
  type UNIT_3_2StepResponse,
} from '@/lib/unit-3-2-course';
import {
  BOUNDARY_MATCH_OPTIONS,
  CASE_BUCKETS,
  CONSTRAINT_REASON_OPTIONS,
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
  kind: 'none' | 'quiz' | 'form';
  helper: string;
  questions?: QuizQuestion[];
  fields?: FormField[];
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
        kicker: 'Scope',
        intro: '本课不追求一次讲完所有稳定方法，而是先把“普通判稳、特殊情况、三域翻译、参数可行域”这条链条站稳。',
        sections: [
          {
            title: '四项目标',
            tone: 'cyan',
            bullets: ['会判稳。', '会分辨两类特殊情况。', '会做三域翻译。', '会表达参数可行域。'],
          },
          {
            title: '本课主线',
            tone: 'emerald',
            body: '普通判稳 -> 参数区间 -> 特殊情况 -> 三域翻译 -> 区域约束',
          },
          {
            title: '刻意不做的事',
            tone: 'rose',
            bullets: ['不提前展开根轨迹法则。', '不进入 Nyquist 判稳与裕度计算。', '不直接进入控制器结构选型。'],
          },
        ],
        prompts: ['为什么 3-2 要停在边界语言，不继续滑向根轨迹法则？'],
      };
    case 'step-04':
      return {
        kicker: 'Pre-check',
        intro: '前测不为分层，而是为暴露错因。3-2 最常见的三类混淆：把劳斯当求根法、把两类特殊情况混为一谈、把稳定直接当成可以优化。',
        sections: [
          {
            title: '检查重点',
            tone: 'amber',
            bullets: ['劳斯回答的是“有没有右半平面根”，不是“把全部根算出来”。', '首位为 0 不等于全零行。', '先守住稳定可行域，再谈性能优化。'],
          },
        ],
        prompts: ['为什么会算表不代表已经建立了边界语言？'],
      };
    case 'step-05':
      return {
        kicker: 'Routh Axis',
        intro: '普通劳斯表的核心不是“表格很会算”，而是第一列已经把稳定性问题收束成右半平面根数问题。',
        sections: [
          {
            title: '固定参数对象',
            tone: 'cyan',
            formula: 'D(s)=s^4+5s^3+9s^2+11s+6',
          },
          {
            title: '核心规则',
            tone: 'emerald',
            body: '第一列符号变化次数 = 右半平面根数。先判稳，再决定是否需要显式求根验证。',
          },
        ],
        prompts: ['为什么只看第一列就已经足以回答稳定性？', '为什么这一页判稳了，却还没有求出全部根？'],
      };
    case 'step-06':
      return {
        kicker: 'Feasible Range',
        intro: '一旦把参数带进第一列条件链，劳斯判据就从“判稳”自然推进到“稳定区间”。',
        sections: [
          {
            title: '带参数对象',
            tone: 'cyan',
            formula: 'D(s,k)=s^4+5s^3+9s^2+(7+k)s+(2+k)',
          },
          {
            title: '区间结论',
            tone: 'emerald',
            formula: '-2<k<18',
          },
          {
            title: '这一页最容易漏掉什么',
            tone: 'amber',
            bullets: ['漏掉 $s^0$ 行条件。', '分式链条只看分子、不看符号一致性。', '把劳斯误当成“先求根再验证”的绕路工具。'],
          },
        ],
        prompts: ['条件链最容易漏掉哪一步？', '为什么漏条件会把区间假性放宽？'],
      };
    case 'step-07':
      return {
        kicker: 'Boundary Mapping',
        intro: '代数边界不是抽象符号，而会落成不同的根结构与不同的图上边界位置。',
        sections: [
          {
            title: '边界参数',
            tone: 'cyan',
            formula: 'k=-2,\\qquad k=18',
          },
          {
            title: '两类边界并不一样',
            tone: 'amber',
            bullets: ['原点根边界：系统触到稳定底线。', '纯虚根边界：共轭根逼近并穿越虚轴。', '稳定区内部：全部根仍留在左半平面。'],
          },
        ],
        prompts: ['为什么 $k=-2$ 与 $k=18$ 的根结构不是同一种临界状态？'],
      };
    case 'step-08':
      return {
        kicker: 'Split First',
        intro: '特殊情况处理前，第一动作不是下公式，而是先分辨“首位为 0”还是“全零行”。',
        sections: [
          {
            title: '短例 A',
            tone: 'cyan',
            formula: 'D_1(s)=s^4+2s^3+3s^2+6s+5',
          },
          {
            title: '短例 B',
            tone: 'violet',
            formula: 'D_2(s)=s^4+2s^3+2s^2+2s+1',
          },
          {
            title: '操作顺序',
            tone: 'amber',
            bullets: ['先辨识属于哪类特殊情况。', '再选择 epsilon 延拓或辅助方程。', '辨识错误会让整条处理链跑偏。'],
          },
        ],
        prompts: ['为什么如果分类错了，后续处理就会整体错位？'],
      };
    case 'step-09':
      return {
        kicker: 'Method Chain',
        intro: '全零行不是“算不下去了”，而是边界根结构露出来了，所以必须通过辅助方程把这层信息接回劳斯表。',
        sections: [
          {
            title: '辅助方程',
            tone: 'cyan',
            formula: 'A(s)=s^2+1',
          },
          {
            title: '导数替换',
            tone: 'emerald',
            formula: 'A\'(s)=2s',
          },
          {
            title: '方法提醒',
            tone: 'amber',
            bullets: ['epsilon 延拓处理的是首位为 0。', '辅助方程处理的是全零行。', '导数替换来自上一行的结构信息，不是随手凑一行。'],
          },
        ],
        prompts: ['为什么全零行会暴露对称根信息？', '为什么辅助方程求导后能回填劳斯表？'],
      };
    case 'step-10':
      return {
        kicker: 'Three Domains',
        intro: '劳斯结论不能只停在“符号变化次数”，还要翻译到时域响应和极点半平面位置。',
        sections: [
          {
            title: '三域翻译',
            tone: 'cyan',
            bullets: ['稳定 -> 衰减收敛 -> 左半平面极点', '临界 -> 等幅振荡或边界停留 -> 虚轴或原点根', '失稳 -> 发散 -> 右半平面根'],
          },
          {
            title: '关键提醒',
            tone: 'amber',
            body: '“临界稳定”不是“更慢一点的稳定”，而是系统已经触到稳定底线。',
          },
        ],
        prompts: ['为什么临界状态不能被理解成“只是更慢一点”？'],
      };
    case 'step-11':
      return {
        kicker: 'Frequency Warning',
        intro: '接近稳定边界时，相关频段的峰值往往先抬高，但在 3-2 里这仍只是辅助观察线索。',
        sections: [
          {
            title: '两条结论',
            tone: 'cyan',
            bullets: ['接近边界时，相关频段峰值会抬高。', '频域在本课只做辅助观察，不升级成主判据。'],
          },
        ],
        prompts: ['为什么这里的频域现象不能直接替代判稳规则？'],
      };
    case 'step-12':
      return {
        kicker: 'Shifted Constraint',
        intro: '当稳定要求从“在左半平面”变成“在竖线左侧”时，变量平移把它重新送回普通劳斯判稳。',
        sections: [
          {
            title: '竖线约束',
            tone: 'cyan',
            formula: '\\operatorname{Re}(s)<-0.5',
          },
          {
            title: '变量平移',
            tone: 'emerald',
            formula: 's=z-\\frac{1}{2}',
          },
          {
            title: '新区间',
            tone: 'violet',
            formula: '-\\frac{3}{8}<k<4',
          },
        ],
        prompts: ['为什么更强约束会把可行区间收缩？', '为什么平移后问题还能回到普通劳斯判稳？'],
      };
    case 'step-13':
      return {
        kicker: 'Post-check',
        intro: '后测检查的不是算表速度，而是学生能不能真正说出“边界语言”在解释什么。',
        sections: [
          {
            title: '检查口径',
            tone: 'amber',
            body: '会算表只是最低层，真正要带走的是：边界对应什么根结构、什么时域表现、什么参数窗口。',
          },
        ],
        prompts: ['如果学生会算表却解释不出边界含义，说明缺了哪一层理解？'],
      };
    case 'step-14':
      return {
        kicker: 'Takeaways',
        intro: '3-2 的出口不是多记几条技巧，而是形成“先判稳、再识别边界、再进入参数可行域”的一条稳定判断链。',
        sections: [
          {
            title: '五条结论',
            tone: 'emerald',
            bullets: [
              '劳斯首先回答高阶系统的稳定底线。',
              '第一列符号变化次数对应右半平面根数。',
              '两类特殊情况对应两种不同处理动作。',
              '劳斯结论要翻译到极点、时域和频域线索。',
              '先有稳定可行域，后谈性能优化。',
            ],
          },
          {
            title: '去向卡',
            tone: 'cyan',
            body: '3-3 会解释极点为何沿边界附近那条路径迁移，4-1 再把可行域语言推进到参数设计任务。',
          },
        ],
        prompts: ['3-2 最值得带走的五条结论是什么？', '为什么 3-3 和 4-1 会分别接住 3-2 的出口？'],
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

function getActivitySpec(step: UNIT_3_2StepDefinition): ActivitySpec {
  switch (step.pageType) {
    case 'binary_choice':
      return {
        kind: 'form',
        helper: '先选立场，再看教师揭示后的纠偏。',
        fields: [
          {
            key: 'choice',
            label: '你的判断',
            type: 'radio',
            answer: 'B',
            options: [
              { value: 'A', label: '只要图上看见边界点，就足够判断参数' },
              { value: 'B', label: '还需要一套从特征方程系数直接判稳的方法' },
            ],
          },
        ],
      };
    case 'quiz_group':
      return {
        kind: 'quiz',
        helper: step.id === 'step-13' ? '后测检查边界语言是否已经成形。' : '前测用于暴露错因，不用于拉开分数。',
        questions: step.id === 'step-13' ? POSTTEST_QUESTIONS : PRETEST_QUESTIONS,
      };
    case 'short_response':
      return {
        kind: 'form',
        helper: '用一句话说清“为什么能判稳但还没有显式求根”。',
        fields: [
          {
            key: 'reason',
            label: '一句话解释',
            type: 'textarea',
            placeholder: '例如：第一列符号变化已经回答了右半平面根数，所以先能判稳，不必先把全部根算出来。',
            answer: '第一列符号变化次数已经给出右半平面根数，因此劳斯可以先判稳，再决定是否需要显式求根验证。',
          },
        ],
      };
    case 'interval_input':
      return {
        kind: 'form',
        helper: '填写区间，并明确最容易漏掉的条件。',
        fields: [
          {
            key: 'range',
            label: '稳定区间',
            type: 'text',
            placeholder: '例如：-2 < k < 18',
            answer: '-2 < k < 18',
          },
          {
            key: 'missingCondition',
            label: '最容易漏掉的条件',
            type: 'radio',
            answer: 's0',
            options: [
              { value: 's1', label: '只看高阶行，不看低阶行' },
              { value: 's0', label: '漏掉 s^0 行条件' },
              { value: 'solver', label: '把劳斯当成先求根再验证的工具' },
            ],
          },
        ],
      };
    case 'triple_match':
      if (step.id === 'step-07') {
        return {
          kind: 'form',
          helper: '把边界参数、图上位置和根结构描述对起来。',
          fields: [
            { key: 'parameter', label: '边界参数', type: 'radio', answer: 'k=18', options: [...BOUNDARY_MATCH_OPTIONS.parameter] },
            { key: 'geometry', label: '图上位置', type: 'radio', answer: 'imaginary-pair', options: [...BOUNDARY_MATCH_OPTIONS.geometry] },
            { key: 'meaning', label: '根结构描述', type: 'radio', answer: 'cross-axis', options: [...BOUNDARY_MATCH_OPTIONS.meaning] },
          ],
        };
      }
      return {
        kind: 'form',
        helper: '把响应曲线、极点结构和稳定状态标签对应起来。',
        fields: [
          { key: 'curve', label: '曲线标签', type: 'radio', answer: 'critical', options: [...STATE_MATCH_OPTIONS.curve] },
          { key: 'pole', label: '极点结构', type: 'radio', answer: 'axis-boundary', options: [...STATE_MATCH_OPTIONS.pole] },
          { key: 'state', label: '稳定状态', type: 'radio', answer: 'critical', options: [...STATE_MATCH_OPTIONS.state] },
        ],
      };
    case 'classification_drag':
      return {
        kind: 'form',
        helper: '先分辨异常类型，再决定处理动作。',
        fields: [
          { key: 'caseA', label: '短例 A 属于', type: 'radio', answer: 'zero-head', options: [...CASE_BUCKETS] },
          { key: 'caseB', label: '短例 B 属于', type: 'radio', answer: 'zero-row', options: [...CASE_BUCKETS] },
        ],
      };
    case 'formula_completion':
      return {
        kind: 'form',
        helper: '把“上一行 -> 辅助方程 -> 导数替换”链条补齐。',
        fields: [
          { key: 'upperRow', label: '来自上一行的结构', type: 'text', placeholder: '例如：由 s^2 行构造偶多项式', answer: '由上一行偶次幂项构造辅助方程' },
          { key: 'auxEquation', label: '辅助方程', type: 'text', placeholder: '例如：A(s)=s^2+1', answer: 'A(s)=s^2+1' },
          { key: 'derivative', label: '导数替换', type: 'text', placeholder: '例如：A\'(s)=2s', answer: 'A\'(s)=2s' },
        ],
      };
    case 'reason_check':
      return {
        kind: 'form',
        helper: '判断峰值抬高与边界接近的关系，并写一句边界提醒。',
        fields: [
          {
            key: 'selection',
            label: '你的判断',
            type: 'radio',
            answer: 'yes',
            options: [
              { value: 'yes', label: '峰值抬高常是接近边界的辅助线索' },
              { value: 'no', label: '峰值抬高与边界接近没有关系' },
            ],
          },
          {
            key: 'reason',
            label: '边界提醒',
            type: 'textarea',
            placeholder: '例如：它只能做辅助观察，不能代替劳斯判稳。',
            answer: '接近稳定边界时相关频段峰值会抬高，但本课仍以劳斯判稳为主，频域只做辅助观察。',
          },
        ],
      };
    case 'parameter_workspace':
      return {
        kind: 'form',
        helper: '把区域约束转成变量平移后的新区间，并说清“为什么更窄”。',
        fields: [
          { key: 'range', label: '新区间', type: 'text', placeholder: '例如：-3/8 < k < 4', answer: '-3/8 < k < 4' },
          { key: 'reasonTag', label: '原因标签', type: 'radio', answer: 'interval-shrinks', options: [...CONSTRAINT_REASON_OPTIONS] },
        ],
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
    case 'step-04':
      return '前测纠偏：劳斯不是另一种求根法；首位为 0 与全零行必须先分辨；稳定之后才有资格继续谈性能优化。';
    case 'step-06':
      return '稳定区间：`-2 < k < 18`。典型错因是漏掉 $s^0$ 行条件，导致区间被假性放宽。';
    case 'step-07':
      return '边界翻译：`k=-2` 更接近原点根边界；`k=18` 对应纯虚根边界。不同参数触发的是不同的临界根结构。';
    case 'step-08':
      return '分类结论：短例 A 先走 epsilon 延拓；短例 B 需要辅助方程。顺序永远是“先辨识，再处理”。';
    case 'step-09':
      return '处理链：上一行结构 -> 辅助方程 $A(s)$ -> 导数替换 $A\'(s)$。全零行不是算不下去，而是根结构露出来了。';
    case 'step-10':
      return '三域翻译：稳定 -> 衰减收敛 -> 左半平面；临界 -> 等幅振荡/边界停留 -> 虚轴或原点；失稳 -> 发散 -> 右半平面。';
    case 'step-11':
      return '边界提醒：峰值抬高是接近边界的辅助观察线索，但 3-2 仍以劳斯判稳为主，不引入 Nyquist 判据。';
    case 'step-12':
      return '变量平移后新区间：`-3/8 < k < 4`。更强的竖线约束会让可行域收缩。';
    case 'step-13':
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

function supportsAnswerReveal(step: UNIT_3_2StepDefinition) {
  return step.pageType !== 'display' && step.pageType !== 'summary' && Boolean(getRevealContent(step));
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
}: {
  step: UNIT_3_2StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);

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

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

export function UNIT_3_2StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
}: {
  step: UNIT_3_2StepDefinition;
  savedResponse?: UNIT_3_2StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_2StepResponse) => void;
}) {
  const activity = getActivitySpec(step);
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(activity, savedResponse));

  useEffect(() => {
    setDraft(getDefaultDraft(activity, savedResponse));
  }, [activity, savedResponse]);

  const submitted = Boolean(savedResponse);
  const locked = !released && activity.kind !== 'none';
  const revealContent = getRevealContent(step);

  const updateDraft = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  if (activity.kind === 'none') {
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
      <p className="premium-lesson-muted mt-2 text-sm">{locked ? '教师尚未释放本页互动，请先阅读上方静态内容。' : activity.helper}</p>

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

          <button
            type="button"
            onClick={() =>
              onSubmit({
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
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_3_2StepDefinition;
  responses: UNIT_3_2TeacherResponseItem[];
  released: boolean;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const summary = useMemo(() => summarizeResponses(step, responses), [responses, step]);
  const activity = getActivitySpec(step);
  const wordCloud = getWordCloudEntries(responses);

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

      {activity.fields?.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">参考锚点</div>
            <div className="mt-3 grid gap-3 text-sm">
              {activity.fields.map((field) => (
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
                        const field = activity.fields?.find((entry) => entry.key === key);
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
