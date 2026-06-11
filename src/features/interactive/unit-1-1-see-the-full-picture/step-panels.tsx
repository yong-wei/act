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
  UNIT_1_1_COURSE_TITLE,
  UNIT_1_1_LESSON_STEPS,
  UNIT_1_1_STAGE_LABEL,
  type UNIT_1_1StepDefinition,
  type UNIT_1_1StepResponse,
} from '@/lib/unit-1-1-course';

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

interface MatchingPair {
  key: string;
  left: string;
  right: string;
}

interface ActivitySpec {
  kind: 'none' | 'quiz' | 'binary_choice' | 'matching';
  helper: string;
  submitLabel?: string;
  releaseLabel?: string;
  questions?: QuizQuestion[];
  fields?: FormField[];
  pairs?: MatchingPair[];
}

interface StepBlueprint {
  kicker: string;
  intro: string;
  sections: StepSection[];
  note?: string;
  prompts?: string[];
}

export interface UNIT_1_1TeacherResponseItem {
  studentName: string;
  response: UNIT_1_1StepResponse;
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

function renderFieldValue(field: FormField | undefined, value: string) {
  if (!field) {
    return value || '未作答';
  }
  if (field.type !== 'radio') {
    return value || '未作答';
  }
  return field.options?.find((option) => option.value === value)?.label ?? value ?? '未作答';
}

function buildStudentFieldId(stepId: string, fieldKey: string) {
  return `${stepId}-${fieldKey}`;
}

function getWordCloudEntries(responses: UNIT_1_1TeacherResponseItem[]) {
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

function getStepBlueprint(step: UNIT_1_1StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Roadmap',
        intro:
          '用一条船贯穿全部八个核心问题，90分钟把自动控制原理全部核心主题走一遍——不是深挖，而是先看见全景：对象是什么、怎样分析、怎样干预。',
        sections: [
          {
            title: '本课的回答',
            tone: 'cyan',
            bullets: [
              '控制理论到底在解决什么问题——用一个生活中的"反馈"直觉先踩住',
              '开环诊断的七条路线：模型、结构、时域、指标、稳定、根轨迹、频域',
              '闭环校正的核心逻辑：诊断 → 干预 → 验证',
            ],
          },
          {
            title: '贯穿对象',
            tone: 'amber',
            body: '一条需要航向保持的船。控制目标：在风浪干扰下，舵角自动调节使航向稳定在设定值。整门课的每个主题都可以在这个对象上找到对应。',
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Objectives',
        intro: '本课目标不是掌握某一领域的深度，而是在90分钟内建立起整门课的认知骨架——知道每一条路通向哪里、每条路之间的关系是什么。',
        sections: [
          {
            title: '五条布鲁姆能力目标',
            tone: 'emerald',
            bullets: [
              '说出：能用"一条船"说出自动控制原理的全部核心主题',
              '解释：能用一句话解释"反馈"是什么',
              '识别：能说出六个核心函数（tf/step/rlocus/bode/margin/feedback）的名称和用途',
              '翻译：能把一句话的工程需求（如"稳一点、快一点"）翻译成对应核心主题',
              '连接：能说出开环诊断与闭环校正之间的逻辑顺序',
            ],
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Pre-Assessment',
        intro: '前测三道题只检查学习本课所需的最低限度的直觉与数学准备，不涉及任何控制理论术语。',
        sections: [
          {
            title: '先暴露概念混淆',
            tone: 'amber',
            bullets: [
              '反馈直觉：你是否本能地觉得"把输出送回输入端"是有用的？',
              '开环局限：在没有反馈的情况下，系统能否自动抵抗扰动？',
              '变化率概念：你对"导数/变化趋势"的直觉是否准确？',
            ],
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Seven Questions',
        intro:
          '面对任何一个控制对象，我们都可以用七条问题对其做"开环诊断"——先看清对象，再讨论怎样干预它。这七个问题构成整门课的诊断路线。',
        sections: [
          {
            title: '七问路线',
            tone: 'cyan',
            bullets: [
              '1. 对象是什么——怎样用数学模型描述它？（建模）',
              '2. 内部结构如何——怎样用框图表达信号流向？（结构表达）',
              '3. 给一个阶跃，系统怎么动——时域响应是什么形状？（时域分析）',
              '4. 系统表现好不好——用哪些指标打分？（性能指标）',
              '5. 系统会不会发散——它稳定吗？（稳定性）',
              '6. 调整增益后极点怎么跑——根轨迹揭示什么？（根轨迹）',
              '7. 系统对不同频率的扰动态度如何——频域分析告诉我们什么？（频域分析）',
            ],
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Modeling & Structure',
        intro: '分析的第一步是"把对象写出来"。一阶电机模型的传递函数是最简单的入口，然后从电机迁移到船舶航向对象的结构表达。',
        sections: [
          {
            title: '从电机到航向',
            tone: 'emerald',
            bullets: [
              '一阶电机：G(s) = K/(Ts+1)，时间常数 T 决定快慢，增益 K 决定稳态',
              '船舶航向：Nomoto 模型同样是二阶近似，把"舵角→航向"映射为传函',
              '表达方式：传递函数是最紧凑的数学形式，框图是结构直觉的图形等价',
            ],
          },
          {
            title: '公式骨架',
            tone: 'slate',
            markdown: `$$
G(s)=\\frac{\\text{输出}(s)}{\\text{输入}(s)}
$$

电机模型：
$$
G_{\\text{motor}}(s)=\\frac{K_m}{T_m s+1}
$$

船舶航向 Nomoto 模型：
$$
G_{\\text{ship}}(s)=\\frac{K}{s(Ts+1)}
$$

起点不是公式，是"把一个真实对象的因果关系写成一个比值"。`,
          },
        ],
      };
    case 'step-06':
      return {
        kicker: 'Time Response',
        intro: '给系统一个阶跃命令，看它怎么动——这是最直观的"表现"评价方式。时域响应的形状直接回答"快不快、稳不稳、冲不冲"。',
        sections: [
          {
            title: '三条曲线判系统',
            tone: 'amber',
            bullets: [
              '一阶系统：单调上升接近终值，时间常数 T 决定多快到达',
              '二阶系统（欠阻尼）：有超调、振荡但能回到稳态',
              '三个指标初步：tr（快不快）、Mp（冲过头多少）、ts（多久稳定）',
            ],
          },
          {
            title: '例子：船舶阶跃响应',
            tone: 'slate',
            markdown: `舵角给定一个阶跃，航向如何变化：

- 要求"快" → tr 小，希望快速响应命令
- 要求"准" → 稳态误差小，最终航向等于设定值
- 要求"稳" → 超调适中、振荡不剧烈

一个系统好不好，不是靠感觉，而是靠这些指标打分。`,
          },
        ],
      };
    case 'step-07':
      return {
        kicker: 'Stability & Root Locus',
        intro: '稳定是不发散，是控制的底线。根轨迹告诉我们：当增益 K 变化时，闭环极点在复平面上怎样移动——揭示"调整一个参数会如何影响稳定性"。',
        sections: [
          {
            title: '两个核心判断',
            tone: 'violet',
            bullets: [
              '全部极点在左半平面 → 系统稳定；有极点在右半平面 → 系统发散',
              '根轨迹：从开环极点出发，到开环零点结束——增益 K 从 0 到无穷时极点的轨迹',
              '根轨迹与虚轴的交点就是稳定边界——增益在该点以下系统稳定',
            ],
          },
          {
            title: '船的例子',
            tone: 'slate',
            markdown: `船的航向控制闭环：

开环传函 $G(s)=\\frac{K}{s(Ts+1)}$，在 K 从 0 增大时：

- K 小 → 极点靠近原点，响应慢但稳定
- K 增大 → 极点沿根轨迹移动，变快但振荡增加
- K 过大 → 越过稳定边界，系统发散

根轨迹把"增益多大才稳定"这个工程问题可视化。`,
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Frequency Domain',
        intro: '同一个对象还可以从"频率响应"的角度观察——系统对低频/高频扰动表现出完全不同的态度。Bode 图和稳定裕度给出另一种视角。',
        sections: [
          {
            title: '频域独有的洞察',
            tone: 'cyan',
            bullets: [
              'Bode 图：幅频 + 相频两张图，揭示系统在不同频率下的行为',
              '剪切频率 wc：增益降到 0 dB 的频率，大致对应闭环带宽',
              '相位裕度 PM：衡量系统在临界频率附近离不稳定还有多远',
            ],
          },
          {
            title: '一条船对应的频域语言',
            tone: 'slate',
            markdown: `海浪可以看作不同频率的扰动输入：

- 低频扰动（长周期波浪）→ 系统应能有效抑制
- 高频扰动（短周期波浪）→ 系统应不被激发出不必要的振荡
- 相位裕度 PM > 45° 通常是工程设计的基本要求

所以频域分析不是多余的——它回答了时域回答不了的问题："系统对不同频率输入的过滤能力如何？"`,
          },
        ],
      };
    case 'step-09':
      return {
        kicker: 'Feedback & Correction',
        intro:
          '开环诊断做完了——我们知道了对象的模型、时域表现、稳定性边界和频域特征。现在的问题是：如果系统表现不够好，怎么改？答案是：把输出信息送回输入端，再用控制器改写闭环行为。',
        sections: [
          {
            title: '反馈的核心逻辑',
            tone: 'rose',
            bullets: [
              '反馈：把实际输出与期望输出之差送给控制器',
              '校正（补偿）：控制器根据误差再产生新的控制信号',
              '诊断 → 校正 → 验证：这是控制工程的完整工作流',
            ],
          },
          {
            title: '本页 AI 的职责',
            tone: 'violet',
            bullets: [
              '帮助理解反馈为什么能改善系统表现',
              '指出开环与闭环的根本区别',
              '解释"诊断→校正→验证"的内在逻辑',
            ],
          },
        ],
        prompts: [
          '请用最简单的话解释：为什么"把输出送回输入端"就能让系统表现更好？',
          '请比较开环控制与闭环控制的根本区别。如果我不能用一句话说清，请帮我精简。',
        ],
      };
    case 'step-10':
      return {
        kicker: 'Three Domains',
        intro: '反馈到底改变了什么？同一组证据——时域响应、根轨迹图、Bode 图——开环和闭环分别是什么表现？一张对照表就能看清反馈的全方位影响。',
        sections: [
          {
            title: '三域对比',
            tone: 'emerald',
            bullets: [
              '时域：闭环通常更快到达稳态，且能抑制扰动',
              '根轨迹：反馈改变了闭环极点位置，从而改变动态品质',
              '频域：反馈改变系统的频率响应特性，拓宽或缩窄带宽',
            ],
          },
          {
            title: '诊断循环闭环',
            tone: 'cyan',
            body: '诊断→校正→验证不是一次性的。第一轮校正完成后，需要重新回到时域/根轨迹/频域去验证是否满足要求。这就是控制工程的"诊断循环"。',
          },
        ],
      };
    case 'step-11':
      return {
        kicker: 'Course Map',
        intro: '这门课接下来的五个模块（2-1 到 2-5），对应五个核心追问。同时介绍四个能提高学习效率的习惯——它们帮你从"听懂"到"会做"。',
        sections: [
          {
            title: '五个追问 → 五个模块',
            tone: 'cyan',
            bullets: [
              '2-1 建模与变换语言：怎样把一个真实对象写成一个数学对象？',
              '2-2 时域响应基础：给一个命令，系统怎么动？',
              '2-3 频率响应入门：系统对不同频率的输入态度如何？',
              '2-4 Nyquist 与频域指标：怎样把频域信息收束为可判断的指标？',
              '2-5 从开环诊断到闭环校正：诊断完了，怎么改？',
            ],
          },
          {
            title: '四个学习习惯',
            tone: 'amber',
            bullets: [
              '每节课先用一句话复述核心问题——能说清问题，才算真正开始',
              '每个概念至少找两个不同角度理解它（公式 + 图形 + 工程直觉）',
              '遇到新函数（tf/step/rlocus 等），先动手跑一遍再读文档',
              '每节课结束时，用一句话回答"今天解决了一个什么工程问题"',
            ],
          },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Code Walkthrough',
        intro: '用一个真实的二阶系统对象，把开环诊断的全部步骤用 Python 代码走一遍——从创建传递函数到时域响应、根轨迹、Bode 图与稳定裕度。',
        sections: [
          {
            title: '代码路线：开环诊断',
            tone: 'emerald',
            bullets: [
              'tf(Numerator, Denominator) → 创建传递函数对象',
              'step(G) → 画阶跃响应曲线，读 tr, Mp, ts',
              'rlocus(G) → 画根轨迹图，找到稳定增益范围',
              'bode(G) → 画 Bode 图，读剪切频率与相位裕度',
              'margin(G) → 直接打印幅值裕度与相位裕度数值',
            ],
          },
          {
            title: '船的例子代码片段',
            tone: 'slate',
            markdown: "```python\nimport control as ct\n\n# 船舶 Nomoto 模型：G(s) = 0.08 / (s(55s + 1))\nG = ct.tf([0.08], [55, 1, 0])\n\n# 时域\nT, yout = ct.step_response(G)\n\n# 根轨迹\nct.rlocus(G)\n\n# 频域\nct.bode(G)\nct.margin(G)\n```\n\n不需要记住全部参数，重点是把这五个函数对应到五个诊断问题。",
          },
        ],
      };
    case 'step-13':
      return {
        kicker: 'Closed-Loop Milestone',
        intro: '加入比例反馈，把开环诊断的结论用起来——见证诊断→校正→验证的完整闭环。这是本课最重要的里程碑。',
        sections: [
          {
            title: '比例反馈校正',
            tone: 'violet',
            bullets: [
              'feedback(G, K) → 创建闭环系统，K 是控制器增益',
              '同一个对象，加反馈后再做 step/rlocus/bode',
              '对比开环与闭环的三域表现——你能看出反馈改变了哪些参数吗？',
            ],
          },
          {
            title: '验证闭环前后对比',
            tone: 'slate',
            markdown: "```python\nimport control as ct\n\n# 开环\nG = ct.tf([0.08], [55, 1, 0])\n\n# 闭环：单位比例反馈\nK = 0.5\nG_cl = ct.feedback(G, K)  # 默认负反馈\n\n# 对比时域\nT_open, yout_open = ct.step_response(G)\nT_closed, yout_closed = ct.step_response(G_cl)\n\n# 对比频域\nct.bode(G, label='开环')\nct.bode(G_cl, label='闭环')\n```\n\n你现在已经走通了「诊断→校正→验证」的完整闭环。",
          },
        ],
      };
    case 'step-14':
      return {
        kicker: 'Post-Assessment',
        intro: '后测检验的是你能否把学到的概念、函数、流程与正确类别对应起来。不是背诵，而是"在这个场景下，它属于哪个类别"。',
        sections: [
          {
            title: '配对题检验三层能力',
            tone: 'amber',
            bullets: [
              '概念层：把控制术语与正确描述配对',
              '工具层：把 Python 函数与它的用途配对',
              '流程层：把工程步骤与正确阶段配对',
            ],
          },
        ],
      };
    case 'step-15':
      return {
        kicker: 'Wrap-Up',
        intro: '用一张信息图把本节课的五条核心判断收束在一起，同时带着三个拓展思考离开——它们会把你引向后续课程的更深问题。',
        sections: [
          {
            title: '五个核心判断',
            tone: 'emerald',
            bullets: [
              '反馈是把输出信息送回比较端——这是控制思想的核心',
              '六个函数（tf/step/rlocus/bode/margin/feedback）覆盖了诊断和校正',
              '开环诊断先于闭环校正——先看清对象，再讨论干预手段',
              '时域/根轨迹/频域是三个互补视角——三张图帮你看到全貌',
              '诊断→校正→验证不是一次性的——它是控制工程的循环工作流',
            ],
          },
          {
            title: '三条拓展思考',
            tone: 'violet',
            bullets: [
              '如果对象不是线性系统，现有的方法还能用吗？',
              '比例反馈是最简单的控制器——稍后我们会看到更复杂的校正方式（PI、PID、超前滞后）',
              '你能否用这节课学到的方法，分析一个非工科的"系统"（如经济系统、生态系统中是否存在反馈？）',
            ],
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

function getStepActivity(step: UNIT_1_1StepDefinition): ActivitySpec {
  switch (step.id) {
    case 'step-03':
      return {
        kind: 'quiz',
        helper: '这是开课前的三道速测题，用来暴露你在反馈直觉和基础概念上的边界。',
        submitLabel: '提交前测',
        releaseLabel: '释放前测',
        questions: [
          {
            key: 'feedbackIntuition',
            prompt: '想象你正在淋浴。你想把水温调到舒适的温度，你用手感知水温，然后调节旋钮。这是否涉及"反馈"？',
            options: [
              { value: 'A', label: '是，用手感知水温就是"测量输出"，调节旋钮是"根据误差行动"' },
              { value: 'B', label: '否，这只是一个简单的调节动作' },
              { value: 'C', label: '只有用自动控制器才算反馈' },
              { value: 'D', label: '只有工业系统才有反馈' },
            ],
            answer: 'A',
            explanation:
              '是的！用手感知水温就是"测量输出"，将感知到的温度与舒适温度比较就是"计算误差"，调节旋钮就是"根据误差行动"。这就是反馈的雏形。',
          },
          {
            key: 'openLoopLimit',
            prompt: '一个水泵以恒定功率向水箱注水，没有水位传感器。如果出水管意外堵塞，会发生什么？',
            options: [
              { value: 'A', label: '系统会自动减小流量' },
              { value: 'B', label: '水箱最终会溢出' },
              { value: 'C', label: '系统会发出警告' },
              { value: 'D', label: '水泵会自动关闭' },
            ],
            answer: 'B',
            explanation:
              '没有水位传感器（没有反馈），系统不知道出水管堵塞了，会继续以恒定功率注水，最终水箱溢出。开环系统无法感知和处理未预见的扰动。',
          },
          {
            key: 'derivativeConcept',
            prompt: '温度传感器显示当前温度每分钟上升 2°C。这个"每分钟上升 2°C"描述的是什么？',
            options: [
              { value: 'A', label: '当前温度值' },
              { value: 'B', label: '温度的变化率（导数）' },
              { value: 'C', label: '温度的平均值' },
              { value: 'D', label: '温度的累积量' },
            ],
            answer: 'B',
            explanation:
              '"每分钟上升 2°C"是在描述温度随时间的变化率，也就是导数。导数是控制理论的重要工具——它不仅告诉你"现在是多少"，还告诉你"趋势是什么"。',
          },
        ],
      };
    case 'step-09':
      return {
        kind: 'binary_choice',
        helper: '请基于本课的学习来判断：反馈控制最主要的优势是什么？',
        submitLabel: '提交选择',
        releaseLabel: '释放题目',
        fields: [
          {
            key: 'feedbackAdvantage',
            label: '反馈控制最主要的优势是什么？',
            type: 'radio',
            options: [
              { value: 'faster', label: '让所有系统都变快' },
              { value: 'robust', label: '使系统对扰动和模型不确定性更鲁棒' },
              { value: 'simpler', label: '比开环控制更简单' },
              { value: 'cheaper', label: '成本更低' },
            ],
            answer: 'robust',
          },
        ],
      };
    case 'step-14':
      return {
        kind: 'matching',
        helper: '请将左侧的控制概念/函数与右侧的正确描述配对。',
        submitLabel: '提交配对',
        releaseLabel: '释放后测',
        pairs: [
          { key: 'tf', left: 'tf()', right: '创建传递函数对象' },
          { key: 'step', left: 'step()', right: '画阶跃响应曲线' },
          { key: 'rlocus', left: 'rlocus()', right: '画根轨迹图' },
          { key: 'bode', left: 'bode()', right: '画 Bode 图' },
          { key: 'feedback', left: 'feedback()', right: '创建闭环系统' },
          { key: 'openLoop', left: '开环诊断', right: '先看清对象，再讨论怎样干预' },
          { key: 'closedLoop', left: '闭环校正', right: '根据误差行动，改写系统行为' },
        ],
      };
    default:
      return {
        kind: 'none',
        helper: '本页以教师讲授、观察和板书推进为主。',
      };
  }
}

function getAiPrompts(step: UNIT_1_1StepDefinition) {
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_1_1StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit11:${step.id}`,
    registryId: 'unit11-inline-ai',
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

function getDefaultDraft(activity: ActivitySpec, savedResponse?: UNIT_1_1StepResponse) {
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
  for (const pair of activity.pairs ?? []) {
    defaults[pair.key] = '';
  }
  return defaults;
}

// ---- Knowledge Map ----

export function UNIT_1_1KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft px-4 py-5">
      <div className="premium-lesson-kicker">Course Bridge</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 1-1 到 2-1：先看见全景，再深入细节</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['1-1 看见整门课', '从反馈思想出发，90 分钟闪电遍历建模、时域、稳定、根轨迹、频域、反馈校正全部核心主题。'],
          ['2-1 建模与变换语言', '深入第一步：怎样把真实对象写成一个标准的数学对象？'],
          ['2-2 时域响应基础', '深入第二步：阶跃响应之下，一阶/二阶的每一项指标如何推导与使用？'],
        ].map(([title, body], index) => (
          <div
            key={title}
            className={`premium-lesson-surface-elevated px-4 py-4 ${index === 0 ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            <div className="premium-lesson-title text-base font-semibold">{title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Step Content Panel ----

export function UNIT_1_1StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
}: {
  step: UNIT_1_1StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
}) {
  const blueprint = useMemo(() => getStepBlueprint(step), [step]);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="premium-lesson-tone-pill premium-tone-slate">{UNIT_1_1_STAGE_LABEL[step.stage]}</span>
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
            课程 runtime 配套图示。当前交互实现直接消费 `course-content/runtime/lessons/1-1/media/*`。
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}

// ---- Student Activity Form ----

export function UNIT_1_1StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
}: {
  step: UNIT_1_1StepDefinition;
  savedResponse?: UNIT_1_1StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_1_1StepResponse) => void;
}) {
  const activity = useMemo(() => getStepActivity(step), [step]);
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(activity, savedResponse));
  const [matchingDraft, setMatchingDraft] = useState<Record<string, string>>(() => {
    if (savedResponse) return savedResponse.answers;
    const initial: Record<string, string> = {};
    for (const pair of activity.pairs ?? []) {
      initial[pair.key] = '';
    }
    return initial;
  });

  useEffect(() => {
    setDraft(getDefaultDraft(activity, savedResponse));
    if (activity.kind === 'matching') {
      if (savedResponse) {
        setMatchingDraft(savedResponse.answers);
      } else {
        const initial: Record<string, string> = {};
        for (const pair of activity.pairs ?? []) {
          initial[pair.key] = '';
        }
        setMatchingDraft(initial);
      }
    }
  }, [activity, savedResponse]);

  const answerFields = (activity.fields ?? []).filter((field) => field.answer);
  const shuffledPairs = useMemo<{
    lefts: MatchingPair[];
    shuffledRights: { key: string; text: string }[];
  } | null>(() => {
    if (activity.kind !== 'matching' || !activity.pairs) return null;
    const rights = activity.pairs.map((pair) => ({ key: pair.key, text: pair.right }));
    // Shuffle the right-side options.
    const shuffled = [...rights].sort(() => Math.random() - 0.5);
    return { lefts: activity.pairs, shuffledRights: shuffled };
  }, [activity]);

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

  // Quiz / Binary_choice rendering
  if (activity.kind === 'quiz' || activity.kind === 'binary_choice') {
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
                htmlFor={buildStudentFieldId(step.id, field.key)}
                className="premium-lesson-title block text-sm font-medium"
              >
                {field.label}
              </label>
              {field.type === 'radio' ? (
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
                <textarea
                  id={buildStudentFieldId(step.id, field.key)}
                  name={field.key}
                  aria-label={field.label}
                  value={draft[field.key] ?? ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  placeholder={field.placeholder}
                  className="premium-lesson-input mt-3 min-h-[120px]"
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
      </section>
    );
  }

  // Matching pairs rendering
  if (activity.kind === 'matching' && shuffledPairs) {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
        <div className="premium-lesson-muted mt-2 text-sm">{activity.helper}</div>

        <div className="mt-4 grid gap-4">
          {shuffledPairs.lefts.map((pair) => (
            <div key={pair.key} className="premium-lesson-surface-elevated px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium mb-2">{pair.left}</div>
              <select
                aria-label={`配对：${pair.left}`}
                value={matchingDraft[pair.key] ?? ''}
                onChange={(event) =>
                  setMatchingDraft((prev) => ({ ...prev, [pair.key]: event.target.value }))
                }
                className="premium-lesson-select w-full"
              >
                <option value="" disabled>
                  选择配对项...
                </option>
                {shuffledPairs.shuffledRights.map((right) => (
                  <option key={right.key} value={right.key}>
                    {right.text}
                  </option>
                ))}
              </select>
              {answerVisible ? (
                <div className="premium-lesson-tone-block premium-tone-emerald mt-3 text-sm">
                  正确配对：{pair.right}
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
              answers: matchingDraft,
            })
          }
          className="premium-lesson-action-primary mt-4"
        >
          {activity.submitLabel ?? '提交作答'}
        </button>

        <SubmissionStatus submitted={Boolean(savedResponse)} />
      </section>
    );
  }

  return null;
}

// ---- Teacher Activity Summary ----

export function UNIT_1_1TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_1_1StepDefinition;
  responses: UNIT_1_1TeacherResponseItem[];
  released: boolean;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const activity = getStepActivity(step);
  const wordCloud = getWordCloudEntries(responses);
  const answerFields = (activity.fields ?? []).filter((field) => field.answer);

  if (activity.kind === 'none') {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="premium-lesson-title text-sm font-medium">教师端汇总</div>
            <div className="premium-lesson-muted mt-1 text-sm">当前步骤已收到 {responses.length} 份提交。</div>
          </div>
        </div>
      </section>
    );
  }

  // Quiz / Binary choice summary
  if (activity.kind === 'quiz' || activity.kind === 'binary_choice') {
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
            {(activity.questions?.length ?? 0) > 0 || answerFields.length ? (
              <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-secondary">
                {answerVisible ? '已显示答案' : '显示答案'}
              </button>
            ) : null}
          </div>
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
                        <div className="mt-1 h-2 rounded-full bg-platform-surface-muted">
                          <div className="h-2 rounded-full bg-platform-accent" style={{ width: `${(count / total) * 100}%` }} />
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
                          const question = (activity.questions ?? []).find((entry) => entry.key === key);
                          return (
                            <div key={key}>
                              <span className="premium-lesson-muted">{field?.label ?? question?.prompt ?? key}：</span>
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
      </section>
    );
  }

  // Matching pairs summary
  if (activity.kind === 'matching' && activity.pairs) {
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

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">正确配对</div>
            <div className="mt-3 grid gap-3">
              {activity.pairs.map((pair) => (
                <div key={pair.key} className="text-sm">
                  <div className="font-medium">{pair.left}</div>
                  <div className="premium-lesson-muted mt-1">{pair.right}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">最近提交</div>
            <div className="mt-3 grid gap-3">
              {responses.length ? (
                responses.slice(0, 6).map((item) => {
                  const correctCount = activity.pairs!.filter(
                    (pair) => item.response.answers[pair.key] === pair.key
                  ).length;
                  return (
                    <div key={`${item.studentName}-${item.response.submittedAt}`} className="rounded-2xl border border-border/60 px-3 py-3 text-sm">
                      <div className="font-medium">{item.studentName}</div>
                      <div className="premium-lesson-muted mt-1">
                        正确 {correctCount} / {activity.pairs!.length}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="premium-lesson-muted text-sm">暂无提交。</div>
              )}
            </div>
          </div>
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

  return null;
}

// ---- Student Summary Panel ----

export function UNIT_1_1StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_1_1StepResponse>;
}) {
  const finishedSteps = UNIT_1_1_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_1_1_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {['反馈思想', '传递函数', '时域指标', '根轨迹', 'Bode 图'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是本课认知地图上的关键节点。</div>
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
        你已经走通了“诊断 → 校正 → 验证”的完整闭环。接下来的课程会带你深入每一个主题——从建模语言到时域分析、从稳定判据到校正设计。
      </div>
    </section>
  );
}

// ---- Step AI Assistant ----

export function UNIT_1_1StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_1_1StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '1-1',
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
        先仔细阅读页面内容，再使用下面的提示词与 AI 进行对话。AI 帮助你检验理解、澄清概念。
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
            <DialogTitle>{UNIT_1_1_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription>
              当前只围绕 {step.title} 回答问题，帮助你巩固“反馈思想 → 开环诊断 → 闭环校正”的认知骨架。
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
