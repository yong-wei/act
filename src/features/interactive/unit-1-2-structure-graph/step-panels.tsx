'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Copy, Sparkles } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveConfig } from '@/features/interactive/types';
import {
  UNIT_1_2_COURSE_TITLE,
  UNIT_1_2_LESSON_STEPS,
  UNIT_1_2_STAGE_LABEL,
  type UNIT_1_2StepDefinition,
  type UNIT_1_2StepResponse,
} from '@/lib/unit-1-2-course';
import type { WorkspaceParameterChange } from './workspace';

type Tone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

interface StepSection {
  title: string;
  body?: string;
  bullets?: string[];
  tone?: Tone;
}

interface ChoiceOption {
  value: string;
  label: string;
}

interface QuizQuestion {
  key: string;
  prompt: string;
  options: ChoiceOption[];
  answer: string;
  explanation: string;
}

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'radio';
  placeholder?: string;
  answer?: string;
  options?: ChoiceOption[];
}

interface ActivitySpec {
  kind: 'none' | 'quiz' | 'form';
  helper: string;
  submitLabel?: string;
  releaseLabel?: string;
  questions?: QuizQuestion[];
  fields?: FormField[];
}

interface StepBlueprint {
  kicker: string;
  intro: string;
  sections: StepSection[];
  note?: string;
  prompts?: string[];
}

export interface UNIT_1_2TeacherResponseItem {
  studentName: string;
  response: UNIT_1_2StepResponse;
}

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function getStepBlueprint(step: UNIT_1_2StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Roadmap',
        intro: '上一课我们学会了提取单个环节的传递函数与典型环节，现在要进入“系统蓝图”视角：多个积木块如何连接、化简，并最终得到总传递函数。',
        sections: [
          {
            title: '本课的四个目标',
            tone: 'cyan',
            bullets: [
              '识别结构图的四种基本元素',
              '掌握串联、并联、反馈三种基本连接规则',
              '用六条等效变换规则完成结构图化简',
              '用梅森公式直接从信号流图写出传递函数',
            ],
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Engineering Scenario',
        intro: '船舶航向控制系统把控制器、舵机、船体和罗经连成闭环。每个环节的传递函数都不陌生，但“它们怎么接起来”必须靠结构图说明。',
        sections: [
          {
            title: '从照片到结构图',
            tone: 'amber',
            bullets: [
              '控制器 Gc(s)：根据偏差生成舵角指令',
              '舵机 Ga(s)：把指令变成实际舵角',
              '船体 Gp(s)：把舵角转成航向变化',
              '罗经 H(s)：测量实际航向并反馈',
            ],
          },
          {
            title: '为什么今天要学结构图',
            bullets: ['连接关系决定总传递函数', '反馈方向决定分母正负号', '系统蓝图决定后续时域与频域分析的入口'],
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Syntax',
        intro: '结构图像一种图形语法：方框写传递函数，信号线指示流向，比较点做代数求和，引出点复制同一信号。',
        sections: [
          {
            title: '四种元素的本质',
            tone: 'emerald',
            bullets: [
              '方框：表达输入到输出的动态关系',
              '信号线：表达信号沿箭头单向传播',
              '比较点：把多个信号按正负号代数相加',
              '引出点：把同一信号复制给多条支路',
            ],
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Series Rule',
        intro: '串联的核心是“前一个输出就是后一个输入”。一旦把中间信号消掉，等效传递函数自然就是各环节相乘。',
        sections: [
          {
            title: '推导骨架',
            tone: 'cyan',
            bullets: ['Z(s)=G1(s)X(s)', 'Y(s)=G2(s)Z(s)', '代入消元后得到 Y/X = G1G2'],
          },
          {
            title: '记忆口诀',
            body: '串联相乘。n 个环节首尾相接时，总传递函数就是每个环节传递函数的乘积。',
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Parallel Rule',
        intro: '并联的核心是“共享同一输入、输出在比较点相加”。因此总输出会保留同一个 X(s)，支路传递函数则在括号里相加或相减。',
        sections: [
          {
            title: '推导骨架',
            tone: 'cyan',
            bullets: ['Y1(s)=G1(s)X(s)', 'Y2(s)=G2(s)X(s)', 'Y(s)=Y1(s) ± Y2(s) = [G1(s) ± G2(s)]X(s)'],
          },
          {
            title: '记忆口诀',
            body: '并联相加。若分母不同，必须先通分再整理，不能把分子分母分别相加。',
          },
        ],
      };
    case 'step-06':
      return {
        kicker: 'Feedback Rule',
        intro: '反馈连接是本课最核心的公式。先写偏差信号 E(s)=R(s)-H(s)Y(s)，再代入前向通路关系 Y(s)=G(s)E(s)，就能推到闭环公式。',
        sections: [
          {
            title: '负反馈闭环公式',
            tone: 'violet',
            body: 'Phi(s)=G(s) / [1 + G(s)H(s)]',
          },
          {
            title: '两个概念不要混',
            bullets: ['开环传递函数 Go(s)=G(s)H(s)', '闭环传递函数 Phi(s)=Y(s)/R(s)', '单位反馈是 H(s)=1 的特例'],
          },
        ],
        note: '口诀：负反馈，分母加；正反馈，分母减。',
      };
    case 'step-07':
      return {
        kicker: 'Pre-Assessment',
        intro: '前测只问三件事：串联会不会、偏差信号正负号有没有搞清、单位负反馈的闭环公式能不能一眼写出。',
        sections: [
          {
            title: '请先用前测暴露错误',
            tone: 'amber',
            bullets: ['串联最容易错成相加', '比较点最容易漏负号', '闭环公式最容易和开环公式混淆'],
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Equivalent Transform',
        intro: '真实结构图往往不会乖乖排成三种基本连接。比较点和引出点的位置会挡住化简，于是我们要移动它们，但必须保证同一信号线上的值不变。',
        sections: [
          {
            title: '统一原则',
            tone: 'emerald',
            bullets: ['逆流移动：信号还没被 G(s) 放大，需要补乘', '顺流移动：信号已经被 G(s) 放大，需要补除', '先判断元素类型，再判断移动方向'],
          },
          {
            title: '最容易混的地方',
            bullets: ['比较点前移：补乘 G(s)', '引出点前移：补除 G(s)', '看起来都叫“前移”，但规则恰好相反'],
          },
        ],
        note: '这一页的目标不是背六条规则，而是理解“为什么要补偿”。',
      };
    case 'step-09':
      return {
        kicker: 'Rule Drill',
        intro: '现在用一个具体结构图做判断：把比较点从 G(s) 后移到前面时，支路应该补什么？再顺手和引出点前移做对照。',
        sections: [
          {
            title: '练习目标',
            tone: 'amber',
            bullets: ['先说清元素类型', '再判断移动方向是否逆流', '最后写出补偿环节'],
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'Algebraic Simplification',
        intro: '代数化简法的策略很明确：从最内层反馈环开始，先把它化成单方框，再做串联，最后处理外环反馈。每一步只做一种基本连接。',
        sections: [
          {
            title: '例题 2 的三段式策略',
            tone: 'cyan',
            bullets: [
              '先化简内环：10/s 与 2 构成负反馈',
              '再做串联：和 1/(s+5) 串成新的前向通路',
              '最后化简外环：再和 0.5 形成闭环',
            ],
          },
        ],
        note: '工程意义：内环反馈把原本的积分环节改造成更快的等效惯性环节。',
      };
    case 'step-11':
      return {
        kicker: 'AI Verification',
        intro: '这里必须先手算，再让 AI 检查。把内环从负反馈改成正反馈后，公式看似只改一个符号，但稳定性判断会完全不同。',
        sections: [
          {
            title: '变形题数据',
            tone: 'rose',
            bullets: ['G1=10/s，G3=2，内环改为正反馈', 'G2=1/(s+5)，外环仍为 H=0.5 的负反馈', '目标：求总传递函数，并解释稳定性变化'],
          },
          {
            title: '推荐工作流',
            bullets: ['先手算三步：内环 -> 串联 -> 外环', '再让 AI 验证你每一步的符号与分母', '最后写出 s-20 对系统稳定性的含义'],
          },
        ],
        note: '如果 AI 的路径和你不同，不要只看结果，要比较哪种路径更省步骤、更不容易出错。',
        prompts: [
          '请逐步验证以下双环系统的传递函数化简：内环为正反馈，G1 = 10/s，G3 = 2；之后与 G2 = 1/(s+5) 串联，再与 H = 0.5 构成外环负反馈。请明确写出每一步的分母符号。',
          '请解释为什么内环正反馈会出现 s-20 这一项，以及这对极点位置和系统稳定性意味着什么。',
        ],
      };
    case 'step-12':
      return {
        kicker: 'Signal Flow Graph',
        intro: '如果结构图越来越复杂，反复移动比较点和引出点会让人迷失。信号流图把视角从“元件连接”切到“信号节点与拓扑关系”。',
        sections: [
          {
            title: '转换规则',
            tone: 'emerald',
            bullets: ['每个信号量对应一个节点', '每个方框对应一条带增益的支路', '比较点的加减关系隐含在节点汇聚关系中'],
          },
          {
            title: '为什么值钱',
            bullets: ['复杂交叉回路更容易整体观察', '为梅森公式提供直接输入', '能避免在局部等效变换里迷路'],
          },
        ],
      };
    case 'step-13':
      return {
        kicker: 'Mason Formula',
        intro: '梅森增益公式把传递函数拆成两类信息：从输入到输出的前向通路，以及系统内部所有回路的综合作用。',
        sections: [
          {
            title: '公式本体',
            tone: 'violet',
            body: 'G = (sum Pk * Delta_k) / Delta',
          },
          {
            title: '三步法',
            bullets: ['先找所有前向通路 Pk', '再找所有回路 Li 并判断是否接触', '最后算 Delta、Delta_k 并代入'],
          },
        ],
      };
    case 'step-14':
      return {
        kicker: 'Worked Example',
        intro: '在 5 节点信号流图里，我们不做任何等效变换，直接数出两条前向通路、五个回路，再判断是否存在不接触回路。',
        sections: [
          {
            title: '本题最关键的清单',
            tone: 'cyan',
            bullets: ['P1 = abcd，P2 = aed', 'L1 = bf，L2 = cg，L3 = bcdh，L4 = edh，L5 = egf', '所有回路两两接触，因此没有不接触回路对'],
          },
        ],
        note: '这道题的重点不是代数计算，而是拓扑信息是否数全、数准。',
      };
    case 'step-15':
      return {
        kicker: 'Post-Assessment',
        intro: '后测把今天的四条主线放到同一张卷子里：基本连接、等效变换、代数化简和梅森公式。请用它检查自己究竟卡在哪一层。',
        sections: [
          {
            title: '后测关注点',
            tone: 'amber',
            bullets: ['题 1：三环节串联负反馈能否一眼写公式', '题 2：引出点前移是否还能判断补除', '题 3：双环系统代数化简是否稳', '题 4：同一系统能否用梅森公式复核'],
          },
        ],
      };
    case 'step-16':
      return {
        kicker: 'Engineering Mindset',
        intro: '梅森公式的价值不只是一道公式，而是一种工程思维：面对复杂系统时，先看结构，再决定从哪里下手。',
        sections: [
          {
            title: '两种思维方式',
            tone: 'slate',
            bullets: ['代数化简法：局部操作、逐步推进', '梅森公式：先看全局拓扑，再一步到位', '简单系统适合前者，复杂系统更偏向后者'],
          },
        ],
        note: '课程理念呼应：先见森林，再见树木。',
      };
    case 'step-17':
      return {
        kicker: 'Wrap-Up',
        intro: '把今天的内容压缩成五个关键词：四元素、三连接、六规则、代数化简、梅森公式。学完它们，下一课就能从闭环传函走向时域响应分析。',
        sections: [
          {
            title: '为什么下一课自然是 1-3',
            tone: 'emerald',
            bullets: ['今天求出了总传递函数', '下一课要把闭环传函变成精确响应曲线', '结构图化简是时域分析的前置桥梁'],
          },
        ],
      };
    default:
      return {
        kicker: 'Interactive Lesson',
        intro: step.hint,
        sections: [],
      };
  }
}

function getStepActivity(step: UNIT_1_2StepDefinition): ActivitySpec {
  switch (step.id) {
    case 'step-02':
      return {
        kind: 'quiz',
        helper: '教师释放投票后作答，目的是判断大家最先注意到的是串联、反馈还是并联。',
        submitLabel: '提交投票',
        releaseLabel: '释放投票',
        questions: [
          {
            key: 'connectionFocus',
            prompt: '你觉得船舶航向控制系统中最关键的连接关系是什么？',
            options: [
              { value: 'A', label: '各环节首尾相接的串联' },
              { value: 'B', label: '输出回到输入端形成的反馈' },
              { value: 'C', label: '多个环节共享同一输入的并联' },
              { value: 'D', label: '暂时说不清' },
            ],
            answer: 'B',
            explanation: '船舶航向控制系统当然包含串联链路，但真正把它变成“控制系统”的关键，是输出经罗经返回比较点形成反馈闭环。',
          },
        ],
      };
    case 'step-04':
      return {
        kind: 'form',
        helper: '请把三个串联环节的分子和分母分别写出来，再用一句话说明你如何判断。',
        submitLabel: '提交串联练习',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'numerator',
            label: '分子',
            type: 'text',
            placeholder: '例如：6',
            answer: '6',
          },
          {
            key: 'denominator',
            label: '分母',
            type: 'text',
            placeholder: '例如：s(s+1)(s+2)',
            answer: 's(s+1)(s+2)',
          },
          {
            key: 'reasoning',
            label: '你是怎么判断“串联相乘”的？',
            type: 'textarea',
            placeholder: '写出你消去中间信号的思路',
          },
        ],
      };
    case 'step-05':
      return {
        kind: 'form',
        helper: '重点检查你是否先保留共同输入，再把两个支路通分相加。',
        submitLabel: '提交并联练习',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'numerator',
            label: '通分后的分子',
            type: 'text',
            placeholder: '例如：5s+7',
            answer: '5s+7',
          },
          {
            key: 'denominator',
            label: '通分后的分母',
            type: 'text',
            placeholder: '例如：(s+1)(s+2)',
            answer: '(s+1)(s+2)',
          },
          {
            key: 'reasoning',
            label: '一句话说明你为什么要先通分',
            type: 'textarea',
            placeholder: '例如：分母不同，不能直接把分子相加',
          },
        ],
      };
    case 'step-07':
      return {
        kind: 'quiz',
        helper: '这是开课前的热身速测，请用它暴露自己的易错点。',
        submitLabel: '提交前测',
        releaseLabel: '释放前测',
        questions: [
          {
            key: 'series',
            prompt: 'G1(s)=1/(s+1) 与 G2(s)=5/(s+3) 串联后的等效传递函数是？',
            options: [
              { value: 'A', label: '1/(s+1) + 5/(s+3)' },
              { value: 'B', label: '5/[(s+1)(s+3)]' },
              { value: 'C', label: '6/(s+4)' },
              { value: 'D', label: '无法确定' },
            ],
            answer: 'B',
            explanation: '串联相乘，所以直接得到 5 / [(s+1)(s+3)]。',
          },
          {
            key: 'errorSignal',
            prompt: '负反馈系统中的偏差信号 E(s) 等于？',
            options: [
              { value: 'A', label: 'R(s) + B(s)' },
              { value: 'B', label: 'R(s) - B(s)' },
              { value: 'C', label: 'R(s)B(s)' },
              { value: 'D', label: 'R(s)/B(s)' },
            ],
            answer: 'B',
            explanation: '负反馈比较点的输出是参考输入减去反馈信号。',
          },
          {
            key: 'unitFeedback',
            prompt: '单位负反馈系统的闭环传递函数是？',
            options: [
              { value: 'A', label: 'G(s)' },
              { value: 'B', label: 'G(s) / [1 - G(s)]' },
              { value: 'C', label: 'G(s) / [1 + G(s)]' },
              { value: 'D', label: '1 + G(s)' },
            ],
            answer: 'C',
            explanation: '单位负反馈即 H(s)=1，因此 Phi(s)=G(s) / [1 + G(s)]。',
          },
        ],
      };
    case 'step-09':
      return {
        kind: 'form',
        helper: '把补乘与补除的判断写清楚，不要让“前移”两个字遮住了元素差别。',
        submitLabel: '提交规则练习',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'sumForward',
            label: '比较点前移越过 G(s) 时，支路应补什么？',
            type: 'radio',
            options: [
              { value: 'g', label: '串联 G(s)（补乘）' },
              { value: 'inv', label: '串联 1/G(s)（补除）' },
              { value: 'none', label: '不需要补偿' },
            ],
            answer: 'g',
          },
          {
            key: 'pickoffForward',
            label: '引出点前移越过 G(s) 时，支路应补什么？',
            type: 'radio',
            options: [
              { value: 'g', label: '串联 G(s)（补乘）' },
              { value: 'inv', label: '串联 1/G(s)（补除）' },
              { value: 'none', label: '不需要补偿' },
            ],
            answer: 'inv',
          },
          {
            key: 'why',
            label: '用一句话解释你为什么这样判断',
            type: 'textarea',
            placeholder: '提示：从“信号是否已经被 G(s) 放大”来解释',
          },
        ],
      };
    case 'step-11':
      return {
        kind: 'form',
        helper: '先手算，再打开 AI。提交时请把你和 AI 的差异也记录下来。',
        submitLabel: '提交 AI 反思',
        releaseLabel: '释放 AI 练习',
        fields: [
          {
            key: 'manualSolution',
            label: '先写下你手算得到的总传递函数',
            type: 'textarea',
            placeholder: '例如：先写内环，再写串联，再写外环闭环',
          },
          {
            key: 'samePath',
            label: 'AI 的化简路径与你的一致吗？',
            type: 'radio',
            options: [
              { value: 'yes', label: '一致，步骤顺序相同' },
              { value: 'partly', label: '部分一致，但顺序不同' },
              { value: 'no', label: '不一致，我需要重新检查' },
            ],
          },
          {
            key: 'stabilityMeaning',
            label: 's-20 这一项意味着什么？',
            type: 'textarea',
            placeholder: '提示：正实部极点意味着什么稳定性结论？',
          },
          {
            key: 'reflection',
            label: '写下你这一步最大的修正或收获',
            type: 'textarea',
            placeholder: '例如：我一开始把正反馈也写成了 1+GH',
          },
        ],
      };
    case 'step-15':
      return {
        kind: 'form',
        helper: '后测不追求题量，追求闭环：请尽量用自己的语言说明你为什么选择某种方法。',
        submitLabel: '提交后测',
        releaseLabel: '释放后测',
        fields: [
          {
            key: 'q1Numerator',
            label: '题 1：三环节串联负反馈的闭环传函分子',
            type: 'text',
            placeholder: '例如：G1G2G3',
            answer: 'G1G2G3',
          },
          {
            key: 'q1Denominator',
            label: '题 1：三环节串联负反馈的闭环传函分母',
            type: 'text',
            placeholder: '例如：1+G1G2G3H',
            answer: '1+G1G2G3H',
          },
          {
            key: 'q2Compensation',
            label: '题 2：引出点从方框后移到方框前，应补什么？',
            type: 'radio',
            options: [
              { value: 'g', label: '串联 G(s)' },
              { value: 'inv', label: '串联 1/G(s)' },
              { value: 'none', label: '不需要补偿' },
            ],
            answer: 'inv',
          },
          {
            key: 'q3Result',
            label: '题 3：若 G1=5/s，G2=1/(s+3)，内环 H1=4、外环 H2=1，写出总传递函数',
            type: 'text',
            placeholder: '例如：5/(s^2+23s+65)',
            answer: '5/(s^2+23s+65)',
          },
          {
            key: 'q4Compare',
            label: '题 4：同一系统若改用梅森公式复核，你觉得它比代数法更省在哪里？',
            type: 'textarea',
            placeholder: '例如：不用反复移动比较点，直接数通路和回路',
          },
        ],
      };
    default:
      return {
        kind: 'none',
        helper: '本页以讲授、观察和板书推进为主。',
      };
  }
}

function getAiPrompts(step: UNIT_1_2StepDefinition) {
  if (step.id !== 'step-11') {
    return [];
  }
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_1_2StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit12:${step.id}`,
    registryId: 'unit12-inline-ai',
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

function getDefaultDraft(activity: ActivitySpec, savedResponse?: UNIT_1_2StepResponse) {
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

function getWordCloudEntries(responses: UNIT_1_2TeacherResponseItem[]) {
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

function renderFieldValue(field: FormField | undefined, value: string) {
  if (!field) {
    return value || '未作答';
  }
  if (field.type !== 'radio') {
    return value || '未作答';
  }
  return field.options?.find((option) => option.value === value)?.label ?? value ?? '未作答';
}

function RuleDirectionMiniLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [nodeType, setNodeType] = useState<'sum' | 'pickoff'>('sum');
  const [direction, setDirection] = useState<'upstream' | 'downstream'>('upstream');

  const answer =
    nodeType === 'sum'
      ? direction === 'upstream'
        ? '串联 G(s)（补乘）'
        : '串联 1/G(s)（补除）'
      : direction === 'upstream'
        ? '串联 1/G(s)（补除）'
        : '串联 G(s)（补乘）';

  const explanation =
    direction === 'upstream'
      ? '逆流移动时，目标支路拿到的是还没经过 G(s) 放大的信号，所以必须补偿这个差额。'
      : '顺流移动时，目标支路拿到的是已经经过 G(s) 放大的信号，因此需要把多出来的增益补掉。';

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">口诀小实验：比较点和引出点别混</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        先选元素类型，再选移动方向，系统会立即给出补偿结论。
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { value: 'sum', label: '比较点' },
          { value: 'pickoff', label: '引出点' },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              const value = item.value as 'sum' | 'pickoff';
              setNodeType(value);
              onParameterChange?.({ key: 'nodeType', value: value === 'sum' ? 1 : 2, source: 'preset' });
            }}
            className={`premium-lesson-action-secondary ${nodeType === item.value ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {item.label}
          </button>
        ))}
        {[
          { value: 'upstream', label: '前移 / 逆流' },
          { value: 'downstream', label: '后移 / 顺流' },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              const value = item.value as 'upstream' | 'downstream';
              setDirection(value);
              onParameterChange?.({ key: 'moveDirection', value: value === 'upstream' ? 1 : 2, source: 'preset' });
            }}
            className={`premium-lesson-action-secondary ${direction === item.value ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">
        <div className="font-medium">当前结论：{answer}</div>
        <div className="mt-2">{explanation}</div>
      </div>
    </section>
  );
}

function MasonFocusMiniLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [focus, setFocus] = useState<'path' | 'loop' | 'delta'>('path');

  const copy =
    focus === 'path'
      ? '前向通路：从输入到输出，沿箭头方向前进，且不重复经过任何节点。'
      : focus === 'loop'
        ? '回路：从某个节点出发，沿箭头方向走一圈又回到原节点的闭合路径。'
        : 'Delta：把所有回路、以及不接触回路的乘积，按正负交替方式组织起来。';

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">梅森公式阅读器</div>
      <div className="premium-lesson-muted mt-2 text-sm">切换关注对象，练习把拓扑清点语言说完整。</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { value: 'path', label: '前向通路' },
          { value: 'loop', label: '回路' },
          { value: 'delta', label: '特征式 Delta' },
        ].map((item, index) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              const value = item.value as 'path' | 'loop' | 'delta';
              setFocus(value);
              onParameterChange?.({ key: 'masonFocus', value: index + 1, source: 'preset' });
            }}
            className={`premium-lesson-action-secondary ${focus === item.value ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm">{copy}</div>
    </section>
  );
}

function StepInlineVisual({
  step,
  onParameterChange,
}: {
  step: UNIT_1_2StepDefinition;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  switch (step.id) {
    case 'step-03':
      return (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['方框', '写 G(s)，表示一个环节的输入输出关系'],
            ['信号线', '箭头决定信号流动方向，默认单向'],
            ['比较点', '圆圈带正负号，对多个信号做代数求和'],
            ['引出点', '实心点，从同一信号引出多条等值支路'],
          ].map(([title, body]) => (
            <div key={title} className="premium-lesson-surface-elevated px-4 py-4 text-sm">
              <div className="premium-lesson-title text-base font-semibold">{title}</div>
              <div className="premium-lesson-muted mt-2">{body}</div>
            </div>
          ))}
        </div>
      );
    case 'step-06':
      return (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ['串联', 'G = G1 · G2', '串联相乘'],
            ['并联', 'G = G1 ± G2', '并联相加'],
            ['反馈', 'Phi = G / (1 + GH)', '负反馈分母加'],
          ].map(([title, formula, memory]) => (
            <div key={title} className="premium-lesson-surface-elevated px-4 py-4 text-sm">
              <div className="premium-lesson-title text-base font-semibold">{title}</div>
              <div className="mt-2 font-mono text-[13px]">{formula}</div>
              <div className="premium-lesson-muted mt-2">{memory}</div>
            </div>
          ))}
        </div>
      );
    case 'step-08':
    case 'step-09':
      return <RuleDirectionMiniLab onParameterChange={onParameterChange} />;
    case 'step-10':
      return (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Step 1', '先化简内环：10/s 与 2 构成负反馈，得到 10/(s+20)'],
            ['Step 2', '再与 1/(s+5) 串联，得到新的前向通路'],
            ['Step 3', '最后和 H=0.5 形成外环负反馈'],
            ['Step 4', '整理分母，得到最终闭环传递函数'],
          ].map(([title, body]) => (
            <div key={title} className="premium-lesson-surface-elevated px-4 py-4 text-sm">
              <div className="premium-lesson-title text-base font-semibold">{title}</div>
              <div className="premium-lesson-muted mt-2">{body}</div>
            </div>
          ))}
        </div>
      );
    case 'step-12':
      return (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="premium-lesson-surface-elevated px-4 py-4 text-sm">
            <div className="premium-lesson-title text-base font-semibold">结构图视角</div>
            <div className="premium-lesson-muted mt-2">强调控制器、舵机、船体、传感器这些元件怎样连接。</div>
          </div>
          <div className="premium-lesson-surface-elevated px-4 py-4 text-sm">
            <div className="premium-lesson-title text-base font-semibold">信号流图视角</div>
            <div className="premium-lesson-muted mt-2">强调节点之间的信号拓扑关系，便于直接数通路与回路。</div>
          </div>
        </div>
      );
    case 'step-13':
    case 'step-14':
      return <MasonFocusMiniLab onParameterChange={onParameterChange} />;
    case 'step-16':
      return (
        <div className="premium-lesson-tone-block premium-tone-slate mt-5 text-sm">
          <div className="premium-lesson-title text-base font-semibold">Samuel Mason（1921-1974）</div>
          <div className="mt-2">MIT 电气工程教授，1953 年提出信号流图理论与梅森增益公式。</div>
          <div className="mt-2">方法启示：复杂系统里，先看结构，再决定从哪里下手，比盲目局部操作更重要。</div>
        </div>
      );
    default:
      return null;
  }
}

export function UNIT_1_2KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft px-4 py-5">
      <div className="premium-lesson-kicker">Course Bridge</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 1-1 到 1-3：1-2 是系统蓝图这一桥</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['1-1', '提取单个环节的传递函数，认识典型环节这些“积木块”'],
          ['1-2', '学习结构图、化简与梅森公式，把积木块组装成系统蓝图'],
          ['1-3', '基于闭环传递函数进入时域响应分析，预测系统动态行为'],
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

export function UNIT_1_2StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  onWorkspaceParameterChange,
}: {
  step: UNIT_1_2StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = useMemo(() => getStepBlueprint(step), [step]);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="premium-lesson-tone-pill premium-tone-slate">{UNIT_1_2_STAGE_LABEL[step.stage]}</span>
        <span className="premium-lesson-tone-pill premium-tone-cyan">{blueprint.kicker}</span>
        <span className="premium-lesson-tone-pill premium-tone-amber">⏱ {step.duration}</span>
      </div>
      <h2 className="premium-lesson-title mt-4 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm leading-7">{blueprint.intro}</p>

      <div className="mt-5 grid gap-4">
        {blueprint.sections.map((section) => (
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
          </div>
        ))}
      </div>

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
            className="mx-auto max-h-[420px] w-full rounded-2xl object-contain"
          />
        </figure>
      ) : null}
    </section>
  );
}

export function UNIT_1_2StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
}: {
  step: UNIT_1_2StepDefinition;
  savedResponse?: UNIT_1_2StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_1_2StepResponse) => void;
}) {
  const activity = useMemo(() => getStepActivity(step), [step]);
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(activity, savedResponse));

  useEffect(() => {
    setDraft(getDefaultDraft(activity, savedResponse));
  }, [activity, savedResponse]);

  if (activity.kind === 'none') {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">本页互动状态</div>
        <div className="premium-lesson-muted mt-2 text-sm">{activity.helper}</div>
      </section>
    );
  }

  if (!released) {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">等待教师释放</div>
        <div className="premium-lesson-muted mt-2 text-sm">本题尚未开放，请先跟随教师讲解，等待教师释放后再作答。</div>
      </section>
    );
  }

  const answerFields = (activity.fields ?? []).filter((field) => field.answer);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
      <div className="premium-lesson-muted mt-2 text-sm">{activity.helper}</div>

      <div className="mt-4 grid gap-4">
        {activity.questions?.map((question) => (
          <div key={question.key} className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
            <div className="mt-3 grid gap-2">
              {question.options.map((option) => (
                <label key={option.value} className="premium-lesson-control flex items-start gap-2">
                  <input
                    type="radio"
                    name={question.key}
                    checked={draft[question.key] === option.value}
                    onChange={() => setDraft((prev) => ({ ...prev, [question.key]: option.value }))}
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {activity.fields?.map((field) => (
          <label key={field.key} className="premium-lesson-caption block text-xs">
            {field.label}
            {field.type === 'textarea' ? (
              <textarea
                value={draft[field.key] ?? ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="premium-lesson-input mt-2 min-h-28"
              />
            ) : field.type === 'radio' ? (
              <div className="mt-2 grid gap-2">
                {field.options?.map((option) => (
                  <label key={option.value} className="premium-lesson-control flex items-center gap-2">
                    <input
                      type="radio"
                      name={field.key}
                      checked={draft[field.key] === option.value}
                      onChange={() => setDraft((prev) => ({ ...prev, [field.key]: option.value }))}
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type={field.type}
                value={draft[field.key] ?? ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="premium-lesson-input mt-2"
              />
            )}
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          onSubmit({
            stepId: step.id,
            submittedAt: Date.now(),
            answers: draft,
          })
        }
        className="premium-lesson-action-primary mt-5"
      >
        {activity.submitLabel ?? '提交'}
      </button>

      <SubmissionStatus
        submitted={Boolean(savedResponse)}
        submittedText="提交成功，教师端已收到你的作答。"
        idleText="提交后会同步到教师端汇总。"
      />

      {answerVisible && activity.questions?.length ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4">
          <div className="premium-lesson-title text-sm font-medium">客观题答案</div>
          <div className="mt-3 grid gap-3">
            {activity.questions.map((question) => (
              <div key={question.key} className="text-sm leading-7">
                <div className="font-medium">{question.prompt}</div>
                <div>答案：{question.options.find((option) => option.value === question.answer)?.label ?? question.answer}</div>
                <div className="premium-lesson-muted">{question.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {answerVisible && answerFields.length ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4">
          <div className="premium-lesson-title text-sm font-medium">参考答案</div>
          <div className="mt-3 grid gap-2 text-sm">
            {answerFields.map((field) => (
              <div key={field.key}>
                <span className="font-medium">{field.label}：</span>
                <span>{renderFieldValue(field, field.answer ?? '')}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_1_2TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_1_2StepDefinition;
  responses: UNIT_1_2TeacherResponseItem[];
  released: boolean;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const activity = getStepActivity(step);
  const wordCloud = getWordCloudEntries(responses);
  const answerFields = (activity.fields ?? []).filter((field) => field.answer);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-medium">教师端汇总</div>
          <div className="premium-lesson-muted mt-1 text-sm">当前步骤已收到 {responses.length} 份提交。</div>
        </div>
        {activity.kind !== 'none' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
              {released ? '已释放活动' : activity.releaseLabel ?? '释放活动'}
            </button>
            {(activity.questions?.length ?? 0) > 0 || answerFields.length ? (
              <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-secondary">
                {answerVisible ? '已显示答案' : '显示答案'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {activity.questions?.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {activity.questions.map((question) => {
            const counts = question.options.map((option) => ({
              option,
              count: responses.filter((item) => item.response.answers[question.key] === option.value).length,
            }));
            return (
              <div key={question.key} className="premium-lesson-surface-elevated px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                <div className="mt-3 grid gap-2">
                  {counts.map(({ option, count }) => (
                    <div key={option.value} className="flex items-center justify-between text-sm">
                      <span>{option.label}</span>
                      <span>{count} 人</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {activity.fields?.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">词云</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {wordCloud.length ? (
                wordCloud.map(([word, count]) => (
                  <span key={word} className="premium-lesson-tone-pill premium-tone-cyan">
                    {word} × {count}
                  </span>
                ))
              ) : (
                <span className="premium-lesson-muted text-sm">暂无文本提交，词云将在学生提交后出现。</span>
              )}
            </div>
          </div>

          <details className="premium-lesson-surface-elevated px-4 py-4">
            <summary className="premium-lesson-title cursor-pointer text-sm font-medium">学生回复列表</summary>
            <div className="mt-3 grid gap-3">
              {responses.length ? (
                responses.map((item) => (
                  <div key={`${item.studentName}-${item.response.submittedAt}`} className="rounded-2xl border border-border px-3 py-3 text-sm">
                    <div className="font-medium">{item.studentName}</div>
                    <div className="premium-lesson-muted mt-1 text-xs">
                      {new Date(item.response.submittedAt).toLocaleString('zh-CN', { hour12: false })}
                    </div>
                    <div className="mt-2 grid gap-2">
                      {Object.entries(item.response.answers).map(([key, value]) => {
                        const field = activity.fields?.find((candidate) => candidate.key === key);
                        return (
                          <div key={key}>
                            <span className="font-medium">{field?.label ?? key}：</span>
                            <span>{renderFieldValue(field, value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="premium-lesson-muted text-sm">暂无学生提交。</div>
              )}
            </div>
          </details>
        </div>
      ) : null}

      {answerVisible && answerFields.length ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm">
          <div className="premium-lesson-title text-sm font-medium">参考答案</div>
          <div className="mt-3 grid gap-2">
            {answerFields.map((field) => (
              <div key={field.key}>
                <span className="font-medium">{field.label}：</span>
                <span>{renderFieldValue(field, field.answer ?? '')}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_1_2StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_1_2StepResponse>;
}) {
  const finishedSteps = UNIT_1_2_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_1_2_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {['四元素', '三连接', '六规则', '代数化简', '梅森公式'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是本课收束结构图能力的关键词。</div>
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
        下一课 1-3 会从今天得到的闭环传递函数继续出发，进入时域响应分析：系统到底快不快、稳不稳、超调多少，都将在响应曲线上展开。
      </div>
    </section>
  );
}

export function UNIT_1_2StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_1_2StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '1-2',
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
        先完成手算，再把下面的提示词发给 AI 做对照。AI 只围绕当前页面问题解释，不替你跳过第一步。
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
        向 AI 验证
      </button>

      <Dialog open={ai.isPanelOpen} onOpenChange={ai.togglePanel}>
        <DialogContent className="max-w-5xl border-border bg-background p-0 text-foreground">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="premium-lesson-title">{UNIT_1_2_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription className="premium-lesson-muted">
              围绕当前步骤进行解释、核对和反思，不离开课程页。
            </DialogDescription>
          </DialogHeader>
          <div className="h-[560px] overflow-hidden">
            <InteractiveAIPanel ai={ai} title={`${step.title} · 页内 AI 助手`} onClose={ai.togglePanel} position="right" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
