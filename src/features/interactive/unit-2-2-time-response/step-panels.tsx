'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveConfig } from '@/features/interactive/types';
import {
  UNIT_2_2_COURSE_TITLE,
  UNIT_2_2_LESSON_STEPS,
  UNIT_2_2_STAGE_LABEL,
  type UNIT_2_2StepDefinition,
  type UNIT_2_2StepResponse,
} from '@/lib/unit-2-2-course';
import { calculateFirstOrderAnchorRatio, solveSecondOrderWorkedExample } from './time-response-math';
import {
  SECOND_ORDER_PARAMETER_CARDS,
  TIME_DOMAIN_METRIC_CALLOUTS,
  WORKED_EXAMPLE_SEQUENCE,
  type WorkspaceParameterChange,
} from './workspace';

type Tone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

interface StepSection {
  title: string;
  body?: string;
  bullets?: string[];
  markdown?: string;
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
  type: 'text' | 'textarea' | 'radio';
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

export interface UNIT_2_2TeacherResponseItem {
  studentName: string;
  response: UNIT_2_2StepResponse;
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

function getStepBlueprint(step: UNIT_2_2StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Roadmap',
        intro:
          '2-1 教会我们把对象写成可分析的标准模型，2-2 则继续追问：这个闭环系统到底快不快、稳不稳、会不会冲过头。',
        sections: [
          {
            title: '本课新增的观察语言',
            tone: 'cyan',
            bullets: ['响应曲线：把抽象传函翻译成随时间变化的过程', '四个指标：用快、冲、稳三类语言评价系统表现', '极点桥接：为后续设计与约束分析铺路'],
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Scenario',
        intro:
          '两条曲线都能稳定到目标值，但一个拖沓、一个冲得太猛。仅凭“最终能不能稳住”并不足以评判控制系统，动态过程本身就是设计对象。',
        sections: [
          {
            title: '本页想回答的问题',
            tone: 'amber',
            bullets: ['为什么“稳定”不等于“表现好”', '为什么操作者会对同样稳定的系统产生截然不同的信任感', '为什么必须引入时域性能指标'],
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Objectives',
        intro: '本课围绕三类能力展开：先会看曲线，再会算指标，最后把时域语言连到极点区域与后续设计。',
        sections: [
          {
            title: '会看、会算、会连',
            tone: 'emerald',
            bullets: ['会看：识别一阶、二阶曲线的动态品质', '会算：推导并使用上升时间、峰值时间、超调量、调节时间', '会连：把指标要求翻译成极点区域约束'],
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Pre-Assessment',
        intro: '前测只问最核心的概念边界：快看什么、冲看什么、稳看什么。先把这些词站稳，后面的公式才有对象。',
        sections: [
          {
            title: '请先暴露概念混淆',
            tone: 'amber',
            bullets: ['稳定并不等于无超调', '时间常数变大通常意味着更慢', '超调量专门描述“冲过头”'],
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Input & Output',
        intro: '时域分析首先要说明研究对象：在什么输入下观察什么输出。教材会提脉冲、阶跃、斜坡三类典型输入，但本课默认围绕单位阶跃讨论动态性能。',
        sections: [
          {
            title: '为什么默认用单位阶跃',
            tone: 'cyan',
            bullets: ['阶跃输入最接近日常“给一个目标值”的控制场景', '四个经典时域指标都天然围绕阶跃响应定义', '它既保留动态过程，又方便比较系统快慢与超调'],
          },
          {
            title: '从对象语言切到时间语言',
            tone: 'slate',
            markdown: `$$
C(s)=G(s)R(s)
$$

$$
c(t)=\\mathcal{L}^{-1}\\{C(s)\\}
$$

| 典型输入 | 常问问题 | 本课定位 |
| --- | --- | --- |
| 单位脉冲 | 系统对瞬时激励有何反应 | 只做补充认知 |
| 单位阶跃 | 命令值突然变化后，曲线如何展开 | **本课默认场景** |
| 单位斜坡 | 对持续变化命令的跟踪能力如何 | 暂不展开指标体系 |`,
          },
        ],
      };
    case 'step-06':
      return {
        kicker: 'First Order',
        intro: '一阶系统最重要的直觉锚点不是整条公式，而是时间常数 T：它决定时间轴被拉长还是压缩，t=T 时恰好达到终值的 63.2%。',
        sections: [
          {
            title: '本页只抓一个锚点',
            tone: 'emerald',
            bullets: ['T 小：曲线更快贴近终值', 'T 大：曲线更慢、更拖尾', '终值不变时，T 改变的是时间尺度，不是最终高度'],
          },
          {
            title: '公式与 63.2% 锚点',
            tone: 'slate',
            markdown: `$$
G(s)=\\frac{K}{Ts+1},\\qquad c(t)=K(1-e^{-t/T})
$$

$$
c(T)=K(1-e^{-1})\\approx0.632K
$$

$$
t_r\\approx2.2T,\\qquad t_s\\approx4T
$$

时间常数不是抽象符号，而是“整条曲线沿时间轴被拉长还是压缩”的直接刻度。`,
          },
        ],
        note: '工程近似里，常把一阶系统的上升时间估作 2.2T、调节时间估作 4T。',
      };
    case 'step-07':
      return {
        kicker: 'Second Order',
        intro: '标准二阶系统要读三件事：wn 给时间尺度，zeta 给阻尼品质，wd 给实际振荡节奏。三者分工明确，不能混成一个参数。',
        sections: [
          {
            title: '三参数各管什么',
            tone: 'violet',
            bullets: ['wn：系统整体快慢的基准尺', 'zeta：振荡是否明显、衰减是否温和', 'wd：真正波峰之间的节奏快慢'],
          },
          {
            title: '标准二阶三参数',
            tone: 'slate',
            markdown: `$$
\\Phi(s)=\\frac{\\omega_n^2}{s^2+2\\zeta\\omega_n s+\\omega_n^2}
$$

$$
\\omega_d=\\omega_n\\sqrt{1-\\zeta^2}
$$

先看 $\\omega_n$ 给出的时间尺度，再看 $\\zeta$ 给出的阻尼品质，最后用 $\\omega_d$ 解释“为什么第一个峰在那个时刻出现”。`,
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Family Compare',
        intro: '无阻尼、欠阻尼、临界阻尼、过阻尼并不是四张孤立图片，而是阻尼比逐渐变化时曲线品质的连续谱。',
        sections: [
          {
            title: '四类响应的工程语言',
            tone: 'amber',
            bullets: ['无阻尼：持续振荡，没有收束', '欠阻尼：有超调、有振荡，但能衰减到稳态', '临界阻尼：不振荡且通常是最快的不振荡响应', '过阻尼：不振荡，但比临界阻尼更慢'],
          },
        ],
      };
    case 'step-09':
      return {
        kicker: 'Metrics Map',
        intro: '四个时域指标其实分别回答四类问题：起步快不快、第一次冲顶多快、冲过头多少、多久真正稳定。',
        sections: [
          {
            title: '四个问题对应四个指标',
            tone: 'slate',
            bullets: ['上升时间 tr：起步快慢', '峰值时间 tp：第一个峰出现多快', '超调量 Mp：第一次冲过头多少', '调节时间 ts：多久真正稳定在允许误差带内'],
          },
          {
            title: '先看全景，再分项推导',
            tone: 'slate',
            markdown: `| 指标 | 它在问什么 | 对应曲线读法 |
| --- | --- | --- |
| $t_r$ | 起步快不快 | 第一次到达终值有多快 |
| $t_p$ | 第一个峰来得快不快 | 什么时候第一次冲到最高点 |
| $M_p$ | 冲过头多少 | 峰值比终值高出多少 |
| $t_s$ | 何时真正稳定 | 何时进入并保持在误差带内 |`,
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'Rise Time',
        intro: '对欠阻尼系统，上升时间常取“第一次达到终值”的时刻。这个定义把“快到目标”的含义抓得更清楚。',
        sections: [
          {
            title: '判断重点',
            tone: 'cyan',
            bullets: ['wn 增大时，时间尺度缩短，通常更快到达终值', 'zeta 影响相位项，因此也会影响 tr', '定义先于公式，先知道测什么，再去记公式'],
          },
          {
            title: '定义与公式',
            tone: 'slate',
            markdown: `对欠阻尼标准二阶系统，本课把上升时间定义为“**第一次达到终值**”的时刻。

$$
t_r=\\frac{\\pi-\\arccos\\zeta}{\\omega_n\\sqrt{1-\\zeta^2}}
$$

因此 $t_r$ 不是单独由一个参数决定的：$\\omega_n$ 改时间尺度，$\\zeta$ 改第一次摸到终值的位置。`,
          },
        ],
      };
    case 'step-11':
      return {
        kicker: 'Peak & Overshoot',
        intro: '峰值时间关心“什么时候冲到最高”，超调量关心“冲过头多少”。两个指标都与振荡品质有关，但角色并不一样。',
        sections: [
          {
            title: '本页最重要的一句话',
            tone: 'rose',
            body: '超调量 Mp 主要由阻尼比 zeta 决定，而不是由自然频率 wn 决定。',
          },
          {
            title: '两条核心公式',
            tone: 'slate',
            markdown: `$$
t_p=\\frac{\\pi}{\\omega_n\\sqrt{1-\\zeta^2}}
$$

$$
M_p=e^{-\\frac{\\zeta\\pi}{\\sqrt{1-\\zeta^2}}}\\times100\\%
$$

$t_p$ 回答“第一个峰什么时候来”，$M_p$ 回答“第一次冲过头多少”，两者角色不能混。`,
          },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Settling Time',
        intro: '调节时间看的是系统何时真正进入并保持在误差带内。教材中的 2% 与 5% 误差带，其实是在改变“稳定下来”的判定标准。',
        sections: [
          {
            title: '定义与近似要分开',
            tone: 'emerald',
            bullets: ['严格定义：进入误差带后不再出去', '工程近似：2% 常用 4/(zeta*wn)，5% 常用 3/(zeta*wn)', '本质上都指向极点实部决定的衰减速度'],
          },
          {
            title: '误差带与极点实部',
            tone: 'slate',
            markdown: `$$
t_s\\approx\\frac{4}{\\zeta\\omega_n}\\qquad (2\\%\\text{误差带})
$$

$$
t_s\\approx\\frac{3}{\\zeta\\omega_n}\\qquad (5\\%\\text{误差带})
$$

$$
t_s\\approx\\frac{4}{\\sigma},\\qquad \\sigma=\\zeta\\omega_n
$$

所以调节时间最终在读“指数包络压下去需要多久”，本质上就是在读极点实部。`,
          },
        ],
      };
    case 'step-13':
      return {
        kicker: 'Worked Example I',
        intro: '例题一的重点不是套公式，而是组织解题顺序：先读参数，再求中间量 wd，最后顺推四个指标，避免一上来四条公式乱飞。',
        sections: [
          {
            title: '推荐三步法',
            tone: 'cyan',
            bullets: ['先由标准型读出 wn 与 zeta', '再求阻尼振荡频率 wd', '最后依次求 tr、tp、Mp、ts'],
          },
          {
            title: '题面与中间量',
            tone: 'slate',
            markdown: `$$
\\Phi(s)=\\frac{25}{s^2+4s+25}
$$

先不要急着四个公式一起代。例题一真正训练的是顺序感：先认出 $\\omega_n,\\zeta$，再求

$$
\\omega_d=\\omega_n\\sqrt{1-\\zeta^2}
$$

然后再顺推 $t_r,t_p,M_p,t_s$。`,
          },
        ],
      };
    case 'step-14':
      return {
        kicker: 'AI Compare',
        intro: '这一步必须坚持“先个人判断、后 AI 对照”。你要先把讲义例题二里的指标要求翻译成参数区域，再用 AI 帮你核对推理链有没有漏约束、错方向。',
        sections: [
          {
            title: '逆向设计三步法',
            tone: 'cyan',
            bullets: ['先由超调量约束反推阻尼比下界', '再由调节时间约束反推 zeta*wn 下界', '最后把参数边界翻译成极点区域语言'],
          },
          {
            title: '本页 AI 的职责',
            tone: 'violet',
            bullets: ['核对你的指标到参数的翻译链条', '指出是 zeta 约束、wn 约束还是二者联立区域', '帮你比较不同推理路径谁更清楚'],
          },
          {
            title: '例题二静态骨架',
            tone: 'slate',
            markdown: `题面先固定为：

- $M_p\\le10\\%$
- $t_s\\le2\\,\\text{s}$（2% 误差带）

$$
M_p=e^{-\\frac{\\zeta\\pi}{\\sqrt{1-\\zeta^2}}}\\le0.1
$$

$$
t_s\\approx\\frac{4}{\\zeta\\omega_n}\\le2
$$

$$
\\zeta\\ge0.591,\\qquad \\zeta\\omega_n\\ge2
$$

这一步的重点不是背两个数字，而是看懂：**指标要求可以直接改写成参数约束，参数约束又可以继续投影为极点约束。**`,
          },
        ],
        prompts: [
          '我先给出自己的判断，请你不要直接重算，而是逐步检查我的推理：若要求超调量不超过 10%、2% 误差带下调节时间不超过 2s，我把它翻译成 zeta 与 wn 的哪些约束？请指出我是否漏掉了条件。',
          '请把“更快、更小超调、更短调节时间”分别对应到哪些时域指标，再进一步说明它们通常如何投影到 zeta、wn 与极点区域语言。',
        ],
      };
    case 'step-15':
      return {
        kicker: 'Bridge to Poles',
        intro: '时域指标不是孤立存在的，它们最终都会投影到极点位置上。先用方法链收束，再做轻量桥接：更快看实部，更小超调看阻尼比，更稳定的品质看区域约束而不是单点。',
        sections: [
          {
            title: '方法链收束',
            tone: 'cyan',
            bullets: ['正向分析：已知参数 -> 求时域指标', '逆向设计：已知指标 -> 反推参数区域', '跨域迁移：参数区域 -> 极点与后续设计语言'],
          },
          {
            title: '三句翻译',
            tone: 'amber',
            bullets: ['更快：极点整体左移，衰减更快', '更小超调：阻尼比更大，极点角度更受约束', '更短调节时间：允许的实部边界继续左移'],
          },
          {
            title: '指标到极点趋势表',
            tone: 'slate',
            markdown: `| 时域语言 | 参数语言 | 极点语言 |
| --- | --- | --- |
| 更快 | $\\omega_n$ 更大、$\\sigma$ 更大 | 极点整体更靠左 |
| 更小超调 | $\\zeta$ 更大 | 阻尼角度约束更强 |
| 更短调节时间 | $\\zeta\\omega_n$ 更大 | 实部边界继续左移 |`,
          },
        ],
      };
    case 'step-16':
      return {
        kicker: 'Post-Assessment',
        intro: '后测不仅看会不会代公式，更看你能不能把公式结果翻译回系统品质语言。如果只会算不会解释，说明概念还没真正站稳。',
        sections: [
          {
            title: '后测关注的两层能力',
            tone: 'amber',
            bullets: ['计算层：能否正确读取参数并代公式', '解释层：能否把结果说回“快、冲、稳”的语言'],
          },
        ],
      };
    case 'step-17':
      return {
        kicker: 'Wrap-Up',
        intro: '把今天的内容压缩成一条线：单位阶跃 -> 一阶/二阶曲线 -> 四个动态指标 -> 极点区域桥接。时域分析的语言已经搭起来了。',
        sections: [
          {
            title: '下一步会发生什么',
            tone: 'emerald',
            bullets: ['继续把时域指标和极点、设计约束连起来', '为根轨迹、频域与设计可行域做铺垫', '把“会看曲线”提升为“会拿指标做判断”'],
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

function getStepActivity(step: UNIT_2_2StepDefinition): ActivitySpec {
  switch (step.id) {
    case 'step-02':
      return {
        kind: 'quiz',
        helper: '先给出你的直觉判断：稳定之外，还要不要评价动态过程？',
        submitLabel: '提交投票',
        releaseLabel: '释放投票',
        questions: [
          {
            key: 'scenarioVote',
            prompt: '面对两条都稳定的响应曲线，你更认同哪种说法？',
            options: [
              { value: 'A', label: '只要最终稳定，系统就算“好”' },
              { value: 'B', label: '动态过程也必须纳入评价' },
              { value: 'C', label: '只看超调量就够了' },
              { value: 'D', label: '暂时说不清' },
            ],
            answer: 'B',
            explanation: '稳定只是底线，动态过程中的快慢、超调与平稳性同样决定系统是否“好用”。',
          },
        ],
      };
    case 'step-04':
      return {
        kind: 'quiz',
        helper: '这是开课前的三道速测题，目的是暴露概念边界。',
        submitLabel: '提交前测',
        releaseLabel: '释放前测',
        questions: [
          {
            key: 'timeConstant',
            prompt: '时间常数 T 变大通常意味着什么？',
            options: [
              { value: 'A', label: '响应更快' },
              { value: 'B', label: '响应更慢' },
              { value: 'C', label: '超调量更大' },
              { value: 'D', label: '系统一定不稳定' },
            ],
            answer: 'B',
            explanation: '时间常数增大相当于把时间轴拉长，系统通常表现得更慢。',
          },
          {
            key: 'overshoot',
            prompt: '哪个指标最直接描述“冲过头多少”？',
            options: [
              { value: 'A', label: '上升时间' },
              { value: 'B', label: '峰值时间' },
              { value: 'C', label: '超调量' },
              { value: 'D', label: '调节时间' },
            ],
            answer: 'C',
            explanation: '超调量专门度量第一次峰值超过终值的幅度。',
          },
          {
            key: 'stability',
            prompt: '“稳定”与“无超调”是否等价？',
            options: [
              { value: 'A', label: '等价' },
              { value: 'B', label: '不等价' },
              { value: 'C', label: '只对一阶系统等价' },
              { value: 'D', label: '只对二阶系统等价' },
            ],
            answer: 'B',
            explanation: '稳定只说明最终能收敛，无超调只是动态过程中的一种品质要求，两者不等价。',
          },
        ],
      };
    case 'step-05':
      return {
        kind: 'form',
        helper: '请用一句话把本课默认研究对象写完整。',
        submitLabel: '提交判断',
        fields: [
          {
            key: 'defaultInput',
            label: '“本课默认研究的是 ________ 下的动态性能。”',
            type: 'text',
            placeholder: '例如：单位阶跃输入',
            answer: '单位阶跃输入',
          },
          {
            key: 'whyStep',
            label: '为什么时域性能指标常围绕阶跃响应定义？',
            type: 'textarea',
            placeholder: '写一句工程上的理由',
          },
        ],
      };
    case 'step-06':
      return {
        kind: 'form',
        helper: '先拨动时间常数，再用自己的话描述曲线变化。',
        submitLabel: '提交观察',
        fields: [
          {
            key: 'anchor',
            label: 't=T 时，一阶阶跃响应约达到终值的多少？',
            type: 'text',
            placeholder: '例如：63.2%',
            answer: '63.2%',
          },
          {
            key: 'trend',
            label: '若 T 增大，tr 与 ts 会怎样变化？',
            type: 'textarea',
            placeholder: '例如：都变大，响应更慢',
          },
        ],
      };
    case 'step-07':
      return {
        kind: 'form',
        helper: '请把参数和现象对应起来，不要把三个量混成一个。',
        submitLabel: '提交对应',
        fields: [
          {
            key: 'wnMeaning',
            label: 'wn 最直接控制什么？',
            type: 'textarea',
            placeholder: '例如：整体快慢 / 时间尺度',
          },
          {
            key: 'zetaMeaning',
            label: 'zeta 最直接控制什么？',
            type: 'textarea',
            placeholder: '例如：振荡与衰减品质',
          },
          {
            key: 'wdMeaning',
            label: 'wd 最直接控制什么？',
            type: 'textarea',
            placeholder: '例如：实际振荡频率 / 波峰节奏',
          },
        ],
      };
    case 'step-08':
      return {
        kind: 'form',
        helper: '先选你认为最贴切的家族，再解释原因。',
        submitLabel: '提交判断',
        fields: [
          {
            key: 'bestNoOscillation',
            label: '以下哪一类通常可视为“最快的不振荡响应”？',
            type: 'radio',
            options: [
              { value: 'undamped', label: '无阻尼' },
              { value: 'underdamped', label: '欠阻尼' },
              { value: 'critical', label: '临界阻尼' },
              { value: 'overdamped', label: '过阻尼' },
            ],
            answer: 'critical',
          },
          {
            key: 'familyReason',
            label: '为什么它不是过阻尼或欠阻尼？',
            type: 'textarea',
            placeholder: '写出你的工程语言解释',
          },
        ],
      };
    case 'step-10':
      return {
        kind: 'form',
        helper: '请先写出趋势判断，再回头看公式。',
        submitLabel: '提交判断',
        fields: [
          {
            key: 'riseTrend',
            label: '若 wn 增大且 zeta 不变，tr 将如何变化？',
            type: 'radio',
            options: [
              { value: 'down', label: '减小' },
              { value: 'same', label: '不变' },
              { value: 'up', label: '增大' },
            ],
            answer: 'down',
          },
          {
            key: 'riseWhy',
            label: '请用一句话解释你的判断',
            type: 'textarea',
            placeholder: '例如：时间尺度变小，所以更快到达终值',
          },
        ],
      };
    case 'step-11':
      return {
        kind: 'form',
        helper: '本页重点是把“什么时候冲顶”和“冲多少”分开。',
        submitLabel: '提交配对',
        fields: [
          {
            key: 'tpFormula',
            label: '峰值时间对应哪个公式特征？',
            type: 'textarea',
            placeholder: '写出你识别公式的关键词',
          },
          {
            key: 'mpDependence',
            label: '哪个量主要决定 Mp？为什么？',
            type: 'textarea',
            placeholder: '提示：重点看 zeta',
          },
        ],
      };
    case 'step-12':
      return {
        kind: 'form',
        helper: '请比较两种误差带下的调节时间定义。',
        submitLabel: '提交观察',
        fields: [
          {
            key: 'bandChoice',
            label: '2% 误差带与 5% 误差带下，哪个通常对应更长的 ts？',
            type: 'radio',
            options: [
              { value: '2', label: '2% 误差带' },
              { value: '5', label: '5% 误差带' },
              { value: 'same', label: '一样长' },
            ],
            answer: '2',
          },
          {
            key: 'bandReason',
            label: '为什么会这样？',
            type: 'textarea',
            placeholder: '例如：误差带更严格，所以更晚满足条件',
          },
        ],
      };
    case 'step-13':
      return {
        kind: 'form',
        helper: '先列解题顺序，再说说你最怕哪一步出错。',
        submitLabel: '提交例题思路',
        fields: [
          {
            key: 'order',
            label: '请写出这道题的三步解题顺序',
            type: 'textarea',
            placeholder: '例如：读 wn、zeta -> 求 wd -> 顺推四指标',
          },
          {
            key: 'sensitive',
            label: '你觉得哪一个量最容易算错？为什么？',
            type: 'textarea',
            placeholder: '例如：wd，因为容易漏掉 sqrt(1-zeta^2)',
          },
        ],
      };
    case 'step-14':
      return {
        kind: 'form',
        helper: '请先提交你自己的参数区域判断，再打开页内 AI 做对照。',
        submitLabel: '提交 AI 对照前判断',
        fields: [
          {
            key: 'constraintTranslation',
            label: '把“Mp <= 10%, ts <= 1s”翻译成你认为的参数约束',
            type: 'textarea',
            placeholder: '例如：先给出 zeta 约束，再给出 wn / zeta*wn 约束',
          },
          {
            key: 'selfConfidence',
            label: '你最不确定的是哪一段推理？',
            type: 'textarea',
            placeholder: '例如：Mp 到 zeta 的翻译',
          },
          {
            key: 'aiReflection',
            label: 'AI 对照后，你修正了什么？',
            type: 'textarea',
            placeholder: '完成 AI 对照后再补写',
          },
        ],
      };
    case 'step-15':
      return {
        kind: 'form',
        helper: '请把一句时域语言翻译成一句极点语言。',
        submitLabel: '提交桥接判断',
        fields: [
          {
            key: 'fasterToPole',
            label: '“更快”在极点平面里通常意味着什么？',
            type: 'textarea',
            placeholder: '例如：极点整体更靠左',
          },
          {
            key: 'overshootToPole',
            label: '“更小超调”通常对应什么阻尼要求？',
            type: 'textarea',
            placeholder: '例如：更大的阻尼比 / 更受限的角度区域',
          },
        ],
      };
    case 'step-16':
      return {
        kind: 'quiz',
        helper: '后测既考公式，也考解释。请先独立作答。',
        submitLabel: '提交后测',
        releaseLabel: '释放后测',
        questions: [
          {
            key: 'metricMeaning',
            prompt: '哪个指标最直接回答“系统多久真正稳定下来”？',
            options: [
              { value: 'tr', label: '上升时间' },
              { value: 'tp', label: '峰值时间' },
              { value: 'mp', label: '超调量' },
              { value: 'ts', label: '调节时间' },
            ],
            answer: 'ts',
            explanation: '调节时间专门描述系统何时进入并保持在允许误差带内。',
          },
          {
            key: 'mpCause',
            prompt: '若想降低超调量，通常首先关注哪个参数？',
            options: [
              { value: 'wn', label: '自然频率 wn' },
              { value: 'zeta', label: '阻尼比 zeta' },
              { value: 'k', label: '静态增益 K' },
              { value: 't', label: '时间常数 T' },
            ],
            answer: 'zeta',
            explanation: '对标准二阶系统，超调量主要由阻尼比决定。',
          },
          {
            key: 'poleBridge',
            prompt: '“更快且更稳”的极点区域语言，哪种说法更贴切？',
            options: [
              { value: 'right', label: '极点向右且更靠近虚轴' },
              { value: 'left', label: '极点向左并具有更好的阻尼约束' },
              { value: 'origin', label: '极点向原点靠近' },
              { value: 'vertical', label: '极点只需上下移动' },
            ],
            answer: 'left',
            explanation: '更快通常看实部左移，更稳与更小超调则需要更好的阻尼比约束。',
          },
        ],
        fields: [
          {
            key: 'poleReason',
            label: '请用一句话解释：为什么说调节时间本质上对应极点实部约束？',
            type: 'textarea',
            placeholder: '例如：实部越靠左，指数衰减越快，进入误差带的时间越短',
            answer: '因为调节时间最终由指数包络压下去的速度决定，而这个速度主要由极点实部（或 sigma=zeta*wn）控制。',
          },
        ],
      };
    default:
      return {
        kind: 'none',
        helper: '本页以教师讲授、观察和板书推进为主。',
      };
  }
}

function getAiPrompts(step: UNIT_2_2StepDefinition) {
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_2_2StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit22:${step.id}`,
    registryId: 'unit22-inline-ai',
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

function getDefaultDraft(activity: ActivitySpec, savedResponse?: UNIT_2_2StepResponse) {
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

function getWordCloudEntries(responses: UNIT_2_2TeacherResponseItem[]) {
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

function buildPolylinePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function buildStudentFieldId(stepId: string, fieldKey: string) {
  return `${stepId}-${fieldKey}`;
}

const RESPONSE_FAMILY_CONFIG = {
  undamped: { label: '无阻尼', body: '持续振荡，没有收束。', zeta: 0, color: '#f97316' },
  underdamped: { label: '欠阻尼', body: '有超调、有振荡，但能回到稳态。', zeta: 0.32, color: '#38bdf8' },
  critical: { label: '临界阻尼', body: '通常可视为最快的不振荡响应。', zeta: 1, color: '#22c55e' },
  overdamped: { label: '过阻尼', body: '不振荡，但比临界阻尼更慢。', zeta: 1.6, color: '#a78bfa' },
} as const;

function FirstOrderTimeConstantMiniLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [timeConstant, setTimeConstant] = useState(1.2);
  const riseTime = Number((2.2 * timeConstant).toFixed(2));
  const settlingTime = Number((4 * timeConstant).toFixed(2));
  const currentRatio = calculateFirstOrderAnchorRatio(timeConstant);
  const chartPoints = useMemo(() => {
    const width = 520;
    const height = 220;
    const paddingLeft = 34;
    const paddingBottom = 28;
    const innerWidth = width - paddingLeft - 18;
    const innerHeight = height - 24 - paddingBottom;
    const totalTime = 6;

    return Array.from({ length: 81 }, (_, index) => {
      const t = (totalTime / 80) * index;
      const response = 1 - Math.exp(-t / timeConstant);
      return {
        x: paddingLeft + (t / totalTime) * innerWidth,
        y: 24 + innerHeight - response * innerHeight,
      };
    });
  }, [timeConstant]);
  const chartPath = useMemo(() => buildPolylinePath(chartPoints), [chartPoints]);
  const markerX = chartPoints[Math.round((timeConstant / 6) * 80)]?.x ?? chartPoints[0]?.x ?? 34;
  const markerY = 24 + (220 - 24 - 28) * (1 - 0.632);

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">时间常数小实验</div>
      <div className="premium-lesson-muted mt-2 text-sm">拖动 T，观察同样终值下系统快慢如何变化。</div>
      <label className="premium-lesson-caption mt-4 block text-xs">
        当前 T = {timeConstant.toFixed(1)} s
        <input
          id="unit-2-2-time-constant-slider"
          name="timeConstant"
          aria-label={`时间常数滑块，当前 T = ${timeConstant.toFixed(1)} s`}
          type="range"
          min="0.5"
          max="4"
          step="0.1"
          value={timeConstant}
          onChange={(event) => {
            const value = Number(event.target.value);
            setTimeConstant(value);
            onParameterChange?.({ key: 'timeConstant', value, source: 'slider' });
          }}
          className="mt-2 w-full"
        />
      </label>
      <div className="mt-4 overflow-hidden rounded-[24px] border border-border/70 bg-background/70 px-3 py-3">
        <svg viewBox="0 0 520 220" className="h-[220px] w-full">
          <line x1="34" y1="24" x2="34" y2="192" stroke="currentColor" opacity="0.22" />
          <line x1="34" y1="192" x2="502" y2="192" stroke="currentColor" opacity="0.22" />
          <line x1="34" y1={markerY} x2="502" y2={markerY} stroke="currentColor" opacity="0.16" strokeDasharray="6 6" />
          <line x1={markerX} y1="24" x2={markerX} y2="192" stroke="currentColor" opacity="0.16" strokeDasharray="6 6" />
          <path d={chartPath} fill="none" stroke="url(#first-order-gradient)" strokeWidth="4" strokeLinecap="round" />
          <circle cx={markerX} cy={markerY} r="6" fill="#22c55e" />
          <text x="46" y={markerY - 8} fontSize="12" fill="currentColor" opacity="0.7">
            63.2%
          </text>
          <text x={Math.min(markerX + 10, 420)} y="42" fontSize="12" fill="currentColor" opacity="0.7">
            t = T
          </text>
          <text x="42" y="36" fontSize="12" fill="currentColor" opacity="0.65">
            c(t)/c(inf)
          </text>
          <text x="470" y="210" fontSize="12" fill="currentColor" opacity="0.65">
            t
          </text>
          <defs>
            <linearGradient id="first-order-gradient" x1="34" y1="192" x2="502" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#34d399" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="premium-lesson-surface-elevated px-4 py-3 text-sm">
          <div className="font-medium">63.2% 锚点</div>
          <div className="premium-lesson-muted mt-1">当前在 t = T 时约达到终值的 {currentRatio}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-4 py-3 text-sm">
          <div className="font-medium">估计上升时间</div>
          <div className="premium-lesson-muted mt-1">tr ≈ {riseTime} s</div>
        </div>
        <div className="premium-lesson-surface-elevated px-4 py-3 text-sm">
          <div className="font-medium">估计调节时间</div>
          <div className="premium-lesson-muted mt-1">ts ≈ {settlingTime} s</div>
        </div>
      </div>
      <div className="premium-lesson-muted mt-2 text-xs">T 越大，曲线向终值贴近得越慢；T 越小，整条曲线沿时间轴被压缩。</div>
    </section>
  );
}

function SecondOrderParameterMapMiniLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [activeKey, setActiveKey] = useState<(typeof SECOND_ORDER_PARAMETER_CARDS)[number]['key']>('wn');
  const activeCard = SECOND_ORDER_PARAMETER_CARDS.find((card) => card.key === activeKey) ?? SECOND_ORDER_PARAMETER_CARDS[0];

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">标准二阶三列表</div>
      <div className="premium-lesson-muted mt-2 text-sm">先把参数名、数学式和响应现象一一对应，再进入你自己的语言表达。</div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-border/70 bg-background/70">
        <div className="grid grid-cols-[1fr_1.2fr_1.8fr] border-b border-border/60 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground/65">
          <div>参数名</div>
          <div>数学式</div>
          <div>控制的响应现象</div>
        </div>
        {SECOND_ORDER_PARAMETER_CARDS.map((card, index) => {
          const isActive = card.key === activeKey;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                setActiveKey(card.key);
                onParameterChange?.({ key: 'secondOrderParameter', value: index + 1, source: 'toggle' });
              }}
              className={`grid w-full grid-cols-[1fr_1.2fr_1.8fr] gap-3 border-b border-border/50 px-4 py-4 text-left transition last:border-b-0 ${
                isActive ? 'bg-[var(--interactive-accent-soft)]/45' : 'hover:bg-background/60'
              }`}
            >
              <div className="text-sm font-medium">{card.label}</div>
              <div className="premium-lesson-muted text-sm">{card.formula}</div>
              <div className="text-sm leading-7">{card.phenomenon}</div>
            </button>
          );
        })}
      </div>

      <div className="premium-lesson-tone-block premium-tone-violet mt-4 text-sm">
        <div className="font-medium">当前追问：{activeCard.label}</div>
        <div className="mt-2">{activeCard.question}</div>
      </div>
    </section>
  );
}

function ResponseFamilyMiniLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [active, setActive] = useState<keyof typeof RESPONSE_FAMILY_CONFIG>('underdamped');
  const familyPath = useMemo(() => {
    const width = 520;
    const height = 220;
    const paddingLeft = 30;
    const paddingBottom = 26;
    const innerWidth = width - paddingLeft - 18;
    const innerHeight = height - 24 - paddingBottom;
    const zeta = RESPONSE_FAMILY_CONFIG[active].zeta;

    const points = Array.from({ length: 101 }, (_, index) => {
      const t = (index / 100) * 6;
      let response = 0;
      if (active === 'undamped') {
        response = 1 - Math.cos(1.6 * t);
      } else if (active === 'underdamped') {
        const wd = Math.sqrt(1 - zeta ** 2);
        response = 1 - (Math.exp(-zeta * t) / Math.max(wd, 0.001)) * Math.sin(wd * 2.4 * t + Math.acos(zeta));
      } else if (active === 'critical') {
        response = 1 - Math.exp(-1.2 * t) * (1 + 1.2 * t);
      } else {
        response = 1 - 0.55 * Math.exp(-0.7 * t) - 0.45 * Math.exp(-2.2 * t);
      }
      const normalized = Math.max(0, Math.min(1.32, response));
      return {
        x: paddingLeft + (t / 6) * innerWidth,
        y: 24 + innerHeight - (normalized / 1.32) * innerHeight,
      };
    });

    return buildPolylinePath(points);
  }, [active]);

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">响应家族切换器</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(RESPONSE_FAMILY_CONFIG).map(([key, item], index) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActive(key as keyof typeof RESPONSE_FAMILY_CONFIG);
              onParameterChange?.({ key: 'responseFamily', value: index + 1, source: 'toggle' });
            }}
            className={`premium-lesson-action-secondary ${active === key ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-[24px] border border-border/70 bg-background/70 px-3 py-3">
        <svg viewBox="0 0 520 220" className="h-[220px] w-full">
          <line x1="30" y1="24" x2="30" y2="194" stroke="currentColor" opacity="0.22" />
          <line x1="30" y1="194" x2="502" y2="194" stroke="currentColor" opacity="0.22" />
          <line x1="30" y1="65" x2="502" y2="65" stroke="currentColor" opacity="0.12" strokeDasharray="6 6" />
          <line x1="30" y1="112" x2="502" y2="112" stroke="currentColor" opacity="0.08" strokeDasharray="4 8" />
          <path d={familyPath} fill="none" stroke={RESPONSE_FAMILY_CONFIG[active].color} strokeWidth="4" strokeLinecap="round" />
          <text x="40" y="36" fontSize="12" fill="currentColor" opacity="0.65">
            c(t)
          </text>
          <text x="470" y="212" fontSize="12" fill="currentColor" opacity="0.65">
            t
          </text>
        </svg>
      </div>
      <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">
        <div className="font-medium">当前聚焦：{RESPONSE_FAMILY_CONFIG[active].label}</div>
        <div className="mt-2">{RESPONSE_FAMILY_CONFIG[active].body}</div>
      </div>
    </section>
  );
}

function MetricOverviewMiniLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [activeKey, setActiveKey] = useState<(typeof TIME_DOMAIN_METRIC_CALLOUTS)[number]['key']>('tr');
  const activeMetric = TIME_DOMAIN_METRIC_CALLOUTS.find((item) => item.key === activeKey) ?? TIME_DOMAIN_METRIC_CALLOUTS[0];
  const curvePath = useMemo(
    () =>
      buildPolylinePath([
        { x: 36, y: 192 },
        { x: 92, y: 182 },
        { x: 138, y: 152 },
        { x: 186, y: 88 },
        { x: 232, y: 52 },
        { x: 278, y: 68 },
        { x: 330, y: 116 },
        { x: 396, y: 142 },
        { x: 480, y: 144 },
      ]),
    []
  );

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">四指标叠加总览</div>
      <div className="premium-lesson-muted mt-2 text-sm">在同一条欠阻尼曲线上读四个问题，先会说“它在问什么”，再去记公式。</div>

      <div className="mt-3 flex flex-wrap gap-2">
        {TIME_DOMAIN_METRIC_CALLOUTS.map((item, index) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setActiveKey(item.key);
              onParameterChange?.({ key: 'metricOverview', value: index + 1, source: 'toggle' });
            }}
            className={`premium-lesson-action-secondary ${activeKey === item.key ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-border/70 bg-background/70 px-3 py-3">
        <svg viewBox="0 0 520 220" className="h-[220px] w-full">
          <line x1="36" y1="24" x2="36" y2="192" stroke="currentColor" opacity="0.22" />
          <line x1="36" y1="144" x2="494" y2="144" stroke="currentColor" opacity="0.14" strokeDasharray="6 6" />
          <line x1="36" y1="192" x2="494" y2="192" stroke="currentColor" opacity="0.22" />
          <path d={curvePath} fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
          {TIME_DOMAIN_METRIC_CALLOUTS.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <g key={item.key}>
                <line
                  x1={item.position.x}
                  y1="192"
                  x2={item.position.x}
                  y2={item.position.y}
                  stroke={isActive ? '#f59e0b' : 'currentColor'}
                  opacity={isActive ? 0.95 : 0.18}
                  strokeDasharray="6 6"
                />
                <circle cx={item.position.x} cy={item.position.y} r={isActive ? 8 : 6} fill={isActive ? '#f59e0b' : '#22c55e'} />
                <text x={item.position.x + 10} y={item.position.y - 10} fontSize="12" fill="currentColor" opacity={isActive ? 0.95 : 0.65}>
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {TIME_DOMAIN_METRIC_CALLOUTS.map((item) => (
          <div
            key={item.key}
            className={`premium-lesson-surface-elevated px-4 py-4 text-sm ${item.key === activeKey ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            <div className="font-medium">{item.label}</div>
            <div className="premium-lesson-muted mt-2">{item.question}</div>
            <div className="mt-2 leading-7">{item.meaning}</div>
          </div>
        ))}
      </div>

      <div className="premium-lesson-tone-block premium-tone-slate mt-4 text-sm">
        <div className="font-medium">当前聚焦：{activeMetric.label}</div>
        <div className="mt-2">{activeMetric.anchor}</div>
      </div>
    </section>
  );
}

function SettlingBandMiniLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [band, setBand] = useState<2 | 5>(2);
  const [zeta, setZeta] = useState(0.5);
  const [wn, setWn] = useState(4);
  const settlingTime = Number(((band === 2 ? 4 : 3) / (zeta * wn)).toFixed(2));
  const settlingCurve = useMemo(() => {
    const width = 520;
    const height = 220;
    const paddingLeft = 28;
    const paddingBottom = 26;
    const innerWidth = width - paddingLeft - 18;
    const innerHeight = height - 24 - paddingBottom;
    const bandRatio = band / 100;
    const points = Array.from({ length: 121 }, (_, index) => {
      const t = (index / 120) * 6;
      const wd = wn * Math.sqrt(Math.max(1 - zeta ** 2, 0.02));
      const response =
        1 - (Math.exp(-zeta * wn * t) / Math.sqrt(Math.max(1 - zeta ** 2, 0.02))) * Math.sin(wd * t + Math.acos(Math.min(zeta, 0.999)));
      const normalized = Math.max(0.78, Math.min(1.22, response));
      return {
        x: paddingLeft + (t / 6) * innerWidth,
        y: 24 + innerHeight - ((normalized - 0.78) / (1.22 - 0.78)) * innerHeight,
      };
    });
    const upperY = 24 + innerHeight - ((1 + bandRatio - 0.78) / (1.22 - 0.78)) * innerHeight;
    const lowerY = 24 + innerHeight - ((1 - bandRatio - 0.78) / (1.22 - 0.78)) * innerHeight;
    return {
      path: buildPolylinePath(points),
      upperY,
      lowerY,
    };
  }, [band, wn, zeta]);

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">误差带与调节时间近似</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[2, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setBand(value as 2 | 5);
              onParameterChange?.({ key: 'errorBand', value, source: 'toggle' });
            }}
            className={`premium-lesson-action-secondary ${band === value ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {value}% 误差带
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="premium-lesson-caption text-xs">
          zeta = {zeta.toFixed(2)}
          <input
            id="unit-2-2-zeta-slider"
            name="zeta"
            aria-label={`阻尼比滑块，当前 zeta = ${zeta.toFixed(2)}`}
            type="range"
            min="0.2"
            max="0.9"
            step="0.05"
            value={zeta}
            onChange={(event) => {
              const value = Number(event.target.value);
              setZeta(value);
              onParameterChange?.({ key: 'zeta', value, source: 'slider' });
            }}
            className="mt-2 w-full"
          />
        </label>
        <label className="premium-lesson-caption text-xs">
          wn = {wn.toFixed(1)} rad/s
          <input
            id="unit-2-2-wn-slider"
            name="wn"
            aria-label={`自然频率滑块，当前 wn = ${wn.toFixed(1)} rad/s`}
            type="range"
            min="2"
            max="8"
            step="0.2"
            value={wn}
            onChange={(event) => {
              const value = Number(event.target.value);
              setWn(value);
              onParameterChange?.({ key: 'wn', value, source: 'slider' });
            }}
            className="mt-2 w-full"
          />
        </label>
      </div>
      <div className="mt-4 overflow-hidden rounded-[24px] border border-border/70 bg-background/70 px-3 py-3">
        <svg viewBox="0 0 520 220" className="h-[220px] w-full">
          <line x1="28" y1="24" x2="28" y2="194" stroke="currentColor" opacity="0.22" />
          <line x1="28" y1="194" x2="502" y2="194" stroke="currentColor" opacity="0.22" />
          <rect
            x="28"
            y={settlingCurve.upperY}
            width="474"
            height={Math.max(8, settlingCurve.lowerY - settlingCurve.upperY)}
            fill={band === 2 ? 'rgba(34,197,94,0.12)' : 'rgba(56,189,248,0.12)'}
            stroke="none"
          />
          <path d={settlingCurve.path} fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
          <text x="40" y={settlingCurve.upperY - 8} fontSize="12" fill="currentColor" opacity="0.65">
            +{band}%
          </text>
          <text x="40" y={settlingCurve.lowerY + 16} fontSize="12" fill="currentColor" opacity="0.65">
            -{band}%
          </text>
        </svg>
      </div>
      <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
        <div className="font-medium">当前近似调节时间：ts ≈ {settlingTime} s</div>
        <div className="mt-2">误差带越严格，或 zeta*wn 越小，系统越晚满足“真正稳定下来”的判定。</div>
      </div>
    </section>
  );
}

function WorkedExampleMiniLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [wn, setWn] = useState(4);
  const [zeta, setZeta] = useState(0.5);
  const [settlingBand, setSettlingBand] = useState<2 | 5>(2);
  const result = useMemo(() => solveSecondOrderWorkedExample({ wn, zeta, settlingBand }), [settlingBand, wn, zeta]);

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">例题三步法计算面板</div>
      <div className="premium-lesson-muted mt-2 text-sm">先读参数，再求 wd，最后顺推四指标。把中间量显式化，能减少代公式时的混乱。</div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="premium-lesson-caption text-xs">
          wn = {wn.toFixed(1)} rad/s
          <input
            id="unit-2-2-example-wn-slider"
            name="exampleWn"
            aria-label={`例题自然频率滑块，当前 wn = ${wn.toFixed(1)} rad/s`}
            type="range"
            min="2"
            max="8"
            step="0.2"
            value={wn}
            onChange={(event) => {
              const value = Number(event.target.value);
              setWn(value);
              onParameterChange?.({ key: 'exampleWn', value, source: 'slider' });
            }}
            className="mt-2 w-full"
          />
        </label>
        <label className="premium-lesson-caption text-xs">
          zeta = {zeta.toFixed(2)}
          <input
            id="unit-2-2-example-zeta-slider"
            name="exampleZeta"
            aria-label={`例题阻尼比滑块，当前 zeta = ${zeta.toFixed(2)}`}
            type="range"
            min="0.2"
            max="0.8"
            step="0.05"
            value={zeta}
            onChange={(event) => {
              const value = Number(event.target.value);
              setZeta(value);
              onParameterChange?.({ key: 'exampleZeta', value, source: 'slider' });
            }}
            className="mt-2 w-full"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[2, 5].map((band) => (
          <button
            key={band}
            type="button"
            onClick={() => {
              setSettlingBand(band as 2 | 5);
              onParameterChange?.({ key: 'exampleBand', value: band, source: 'toggle' });
            }}
            className={`premium-lesson-action-secondary ${settlingBand === band ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {band}% 误差带
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {WORKED_EXAMPLE_SEQUENCE.map((item) => (
          <div key={item.key} className="premium-lesson-surface-elevated px-4 py-4 text-sm">
            <div className="font-medium">{item.title}</div>
            <div className="premium-lesson-muted mt-2">{item.focus}</div>
            <div className="mt-2 leading-7">{item.detail}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['wd', `${result.wd.toFixed(3)} rad/s`, '先算阻尼振荡频率，后面两个时间指标都要用它。'],
          ['tr', `${result.tr.toFixed(3)} s`, '第一次到达终值的时间。'],
          ['tp', `${result.tp.toFixed(3)} s`, '第一个峰值出现的时间。'],
          ['Mp', `${result.mpPercent.toFixed(1)} %`, '第一次冲过头的比例。'],
          ['ts', `${result.ts.toFixed(3)} s`, `${settlingBand}% 误差带下的近似调节时间。`],
        ].map(([label, value, body]) => (
          <div key={label} className="premium-lesson-surface-elevated px-4 py-4 text-sm">
            <div className="font-medium">{label}</div>
            <div className="mt-2 text-lg font-semibold">{value}</div>
            <div className="premium-lesson-muted mt-2">{body}</div>
          </div>
        ))}
      </div>

      <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm">
        <div className="font-medium">容易出错的地方</div>
        <div className="mt-2">最常见的问题不是四个指标不会代，而是把 `wd = wn * sqrt(1-zeta^2)` 这一步跳掉，导致 `tr` 与 `tp` 直接算错。</div>
      </div>
    </section>
  );
}

function PoleRegionBridgeMiniLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const options = {
    faster: { label: '更快', body: '优先看极点实部左移，衰减速度提高。' },
    smallerMp: { label: '更小超调', body: '优先看阻尼比增大，极点角度受更强约束。' },
    shorterTs: { label: '更短调节时间', body: '等价于要求实部边界继续左移。' },
  } as const;
  const [active, setActive] = useState<keyof typeof options>('faster');
  const lineX = active === 'faster' || active === 'shorterTs' ? 176 : 262;
  const wedgePath = active === 'smallerMp' ? 'M 262 38 L 470 110 L 262 182 Z' : null;

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">指标到极点区域翻译器</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(options).map(([key, item], index) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActive(key as keyof typeof options);
              onParameterChange?.({ key: 'poleBridge', value: index + 1, source: 'preset' });
            }}
            className={`premium-lesson-action-secondary ${active === key ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-[24px] border border-border/70 bg-background/70 px-3 py-3">
        <svg viewBox="0 0 520 220" className="h-[220px] w-full">
          <line x1="260" y1="24" x2="260" y2="194" stroke="currentColor" opacity="0.2" />
          <line x1="30" y1="110" x2="500" y2="110" stroke="currentColor" opacity="0.16" />
          {wedgePath ? <path d={wedgePath} fill="rgba(56,189,248,0.18)" stroke="#38bdf8" strokeWidth="2" /> : null}
          {!wedgePath ? <line x1={lineX} y1="24" x2={lineX} y2="194" stroke="#22c55e" strokeWidth="3" strokeDasharray="8 8" /> : null}
          <circle cx="130" cy="84" r="7" fill="#f59e0b" />
          <circle cx="160" cy="132" r="7" fill="#f59e0b" />
          <circle cx="332" cy="72" r="7" fill="#38bdf8" />
          <circle cx="332" cy="148" r="7" fill="#38bdf8" />
          <text x="34" y="38" fontSize="12" fill="currentColor" opacity="0.65">
            Im
          </text>
          <text x="478" y="104" fontSize="12" fill="currentColor" opacity="0.65">
            Re
          </text>
          <text x="40" y="210" fontSize="12" fill="currentColor" opacity="0.65">
            左侧更快，楔形区域更小超调
          </text>
        </svg>
      </div>
      <div className="premium-lesson-tone-block premium-tone-violet mt-4 text-sm">
        <div className="font-medium">当前翻译：{options[active].label}</div>
        <div className="mt-2">{options[active].body}</div>
      </div>
    </section>
  );
}

function StepInlineVisual({
  step,
  onParameterChange,
}: {
  step: UNIT_2_2StepDefinition;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  switch (step.workspaceKind) {
    case 'time-constant':
      return <FirstOrderTimeConstantMiniLab onParameterChange={onParameterChange} />;
    case 'second-order-parameter-map':
      return <SecondOrderParameterMapMiniLab onParameterChange={onParameterChange} />;
    case 'response-family':
      return <ResponseFamilyMiniLab onParameterChange={onParameterChange} />;
    case 'metric-overview':
      return <MetricOverviewMiniLab onParameterChange={onParameterChange} />;
    case 'settling-band':
      return <SettlingBandMiniLab onParameterChange={onParameterChange} />;
    case 'worked-example':
      return <WorkedExampleMiniLab onParameterChange={onParameterChange} />;
    case 'pole-region':
      return <PoleRegionBridgeMiniLab onParameterChange={onParameterChange} />;
    default:
      return null;
  }
}

export function UNIT_2_2KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft px-4 py-5">
      <div className="premium-lesson-kicker">Course Bridge</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 2-1 到 2-3：2-2 是动态品质这座桥</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['2-1', '先把工程对象写成可分析、可连接、可运算的标准模型。'],
          ['2-2', '把标准模型翻译成响应曲线，并用快、冲、稳的指标语言描述它。'],
          ['2-3', '继续把时域对象推广到频率响应对象，准备进入更完整的结构机理层。'],
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

export function UNIT_2_2StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  onWorkspaceParameterChange,
}: {
  step: UNIT_2_2StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = useMemo(() => getStepBlueprint(step), [step]);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="premium-lesson-tone-pill premium-tone-slate">{UNIT_2_2_STAGE_LABEL[step.stage]}</span>
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
            {section.markdown ? (
              <div className="text-sm leading-7">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={MARKDOWN_COMPONENTS}
                >
                  {section.markdown}
                </ReactMarkdown>
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
            className="h-auto w-full rounded-2xl border border-border/60 bg-background/60"
          />
          <figcaption className="premium-lesson-muted mt-3 text-xs">
            课程 runtime 配套图示。当前交互实现直接消费 `course-content/runtime/lessons/2-2/media/*`。
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}

export function UNIT_2_2StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
}: {
  step: UNIT_2_2StepDefinition;
  savedResponse?: UNIT_2_2StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_2_2StepResponse) => void;
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
                  <span className="text-sm leading-6">{option.label}</span>
                </label>
              ))}
            </div>
            {answerVisible ? (
              <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
                <div className="font-medium">参考答案：{question.options.find((option) => option.value === question.answer)?.label}</div>
                <div className="mt-2">{question.explanation}</div>
              </div>
            ) : null}
          </div>
        ))}

        {activity.fields?.map((field) => (
          <div key={field.key} className="premium-lesson-surface-elevated px-4 py-4">
            <label
              htmlFor={field.type === 'radio' ? undefined : buildStudentFieldId(step.id, field.key)}
              className="premium-lesson-title block text-sm font-medium"
            >
              {field.label}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                id={buildStudentFieldId(step.id, field.key)}
                name={field.key}
                aria-label={field.label}
                value={draft[field.key] ?? ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
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
                      onChange={() => setDraft((prev) => ({ ...prev, [field.key]: option.value }))}
                    />
                    <span className="text-sm leading-6">{option.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type="text"
                id={buildStudentFieldId(step.id, field.key)}
                name={field.key}
                aria-label={field.label}
                value={draft[field.key] ?? ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="premium-lesson-input mt-3"
              />
            )}
            {answerVisible && field.answer ? (
              <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
                参考答案：{renderFieldValue(field, field.answer)}
              </div>
            ) : null}
          </div>
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
        className="premium-lesson-action-primary mt-4"
      >
        {activity.submitLabel ?? '提交作答'}
      </button>

      <SubmissionStatus submitted={Boolean(savedResponse)} />

      {answerVisible && answerFields.length ? (
        <div className="premium-lesson-panel mt-4 px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">答案锚点</div>
          <div className="mt-3 grid gap-3">
            {answerFields.map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
                <div className="font-medium">{field.label}</div>
                <div className="premium-lesson-muted mt-1">{renderFieldValue(field, field.answer ?? '')}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_2_2TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_2_2StepDefinition;
  responses: UNIT_2_2TeacherResponseItem[];
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
            const total = Math.max(1, responses.length);
            return (
              <div key={question.key} className="premium-lesson-surface-elevated px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                <div className="mt-3 grid gap-2">
                  {counts.map(({ option, count }) => (
                    <div key={option.value} className="text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span>{option.label}</span>
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
                    <div className="font-medium">参考答案：{question.options.find((option) => option.value === question.answer)?.label}</div>
                    <div className="mt-2">{question.explanation}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {activity.fields?.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">参考答案 / 锚点</div>
            <div className="mt-3 grid gap-3">
              {answerFields.length ? (
                answerFields.map((field) => (
                  <div key={field.key} className="text-sm">
                    <div className="font-medium">{field.label}</div>
                    <div className="premium-lesson-muted mt-1">{renderFieldValue(field, field.answer ?? '')}</div>
                  </div>
                ))
              ) : (
                <div className="premium-lesson-muted text-sm">本页以开放作答为主，没有唯一答案。</div>
              )}
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
                        const field = (activity.fields ?? []).find((entry) => entry.key === key);
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

export function UNIT_2_2StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_2_2StepResponse>;
}) {
  const finishedSteps = UNIT_2_2_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_2_2_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {['单位阶跃', '时间常数', '标准二阶', '超调量', '调节时间'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是本课判断系统动态品质的关键词。</div>
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
        你已经把“闭环传函 -&gt; 响应曲线 -&gt; 指标语言 -&gt; 极点桥接”这条链条搭起来了。后续课程会继续把这些指标转化为设计约束。
      </div>
    </section>
  );
}

export function UNIT_2_2StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_2_2StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '2-2',
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
        先提交你自己的参数区域判断，再使用下面的提示词与页内 AI 做对照。AI 负责核对推理链，不替你跳过第一步。
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
            <DialogTitle>{UNIT_2_2_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription>
              当前只围绕 {step.title} 回答问题，帮助你核对“时域指标 -&gt; 参数区域”的推理链。
            </DialogDescription>
          </DialogHeader>
          <div className="h-[75vh]">
            <InteractiveAIPanel ai={ai} title={`${step.title} · AI 对照`} position="right" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
