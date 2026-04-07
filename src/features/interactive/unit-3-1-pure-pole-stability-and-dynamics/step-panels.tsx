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
  UNIT_3_1_COURSE_TITLE,
  UNIT_3_1_LESSON_STEPS,
  UNIT_3_1_STAGE_LABEL,
  type UNIT_3_1StepDefinition,
  type UNIT_3_1StepResponse,
} from '@/lib/unit-3-1-course';
import {
  BANDWIDTH_CHECKLIST,
  DOMINANT_MODEL_CARDS,
  POLE_FAMILY_TABS,
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

export interface UNIT_3_1TeacherResponseItem {
  studentName: string;
  response: UNIT_3_1StepResponse;
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

function getStepBlueprint(step: UNIT_3_1StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Roadmap',
        intro:
          '模块 2 已经把系统写成可分析的对象，3-1 则继续追问：为什么极点能够统领稳定性、模态和低阶近似判断。',
        sections: [
          {
            title: '本课在主线中的位置',
            tone: 'cyan',
            bullets: ['2-2：会看响应曲线', '2-4：开始形成图形对象', '3-1：从对象语言切到机理语言'],
          },
          {
            title: '边界',
            tone: 'amber',
            bullets: ['本课只讲纯极点语言', '不进入劳斯、根轨迹、Nyquist/Bode 判稳', '不提前讲控制器设计'],
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Conflict',
        intro:
          '同一对主导极点并没有自动保证三条曲线“几乎一样”。附加极点是否足够靠左，会决定附加模态退场得够不够快。',
        sections: [
          {
            title: '三模型冲突',
            tone: 'amber',
            markdown: `$$
G_{\\mathrm{ref}}(s)=\\frac{3.2}{s^2+1.6s+3.2}
$$

$$
G_{\\mathrm{A}}(s)=\\frac{16}{(s+5)(s^2+1.6s+3.2)},\\qquad
G_{\\mathrm{B}}(s)=\\frac{4.48}{(s+1.4)(s^2+1.6s+3.2)}
$$`,
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Objectives',
        intro: '本课目标不是把所有稳定方法一次讲完，而是先站稳最核心的三句话：先守底线，再讲模态，再看双域证据。',
        sections: [
          {
            title: '三项目标',
            tone: 'emerald',
            bullets: ['会判稳定底线', '会把极点翻译成模态', '会判断时域和频域近似何时可信'],
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Pre-Assessment',
        intro: '前测只负责暴露混淆：稳定不等于够好，主导极点不是唯一极点，更靠左也不是无条件可忽略。',
        sections: [
          {
            title: '先暴露错觉',
            tone: 'amber',
            bullets: ['稳定不等于性能已经可接受', '主导极点不是唯一证据', '经验句必须配合额外证据'],
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Stability First',
        intro: '在谈任何近似和性能之前，先回答系统能不能收敛。只要稳定底线没有站稳，后面的近似语言都不成立。',
        sections: [
          {
            title: '稳定起点',
            tone: 'slate',
            markdown: `$$
\\Delta(s)=a_ns^n+\\cdots+a_1s+a_0=0
$$

$$
\\Re(p_i)<0,\\ \\forall i
$$

左半平面代表渐近稳定，虚轴代表临界稳定，右半平面代表不稳定。`,
          },
        ],
        note: '本页只立住半平面判据，不进入劳斯表与参数可行域。',
      };
    case 'step-06':
      return {
        kicker: 'Modes',
        intro: '极点不是“复平面上的点图标”，而是会直接进入时域响应表达式的运动模态。',
        sections: [
          {
            title: '一般模态展开',
            tone: 'slate',
            markdown: `$$
G(s)=\\sum_{i=1}^{m}\\sum_{r=1}^{q_i}\\frac{A_{i,r}}{(s-p_i)^r}
$$

$$
g(t)=\\sum_{i=1}^{m}\\sum_{r=1}^{q_i}\\frac{A_{i,r}}{(r-1)!}t^{r-1}e^{p_i t}
$$`,
          },
          {
            title: '为什么这两式重要',
            tone: 'cyan',
            bullets: ['极点位置决定指数骨架', '重根会带来额外时间因子', '留数决定每个模态被激发多强'],
          },
        ],
      };
    case 'step-07':
      return {
        kicker: 'Families',
        intro: '负实极点、左半平面共轭复根、右半平面极点和重根，虽然都叫“极点”，但时域形态完全不同。',
        sections: [
          {
            title: '三类极点 + 重根',
            tone: 'slate',
            markdown: `$$
e^{pt},\\qquad e^{\\sigma t}\\sin(\\omega t+\\phi),\\qquad (A_1+A_2t)e^{pt}
$$`,
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Time-Domain Approximation',
        intro:
          '主导极点近似之所以有时可靠，是因为附加模态退场得足够快；之所以有时失真，是因为附加模态还在主要动态窗口里持续发声。',
        sections: [
          {
            title: '本页关注的不是“谁更漂亮”',
            tone: 'cyan',
            bullets: ['谁最接近参考模型', '谁已明显改写主要动态', '判断理由来自附加模态退场快慢'],
          },
        ],
      };
    case 'step-09':
      return {
        kicker: 'Boundary',
        intro: '“更靠左 3 到 5 倍”是经验起点，不是定理。真正判断时，还要补看权重、重根和极点聚集。',
        sections: [
          {
            title: '经验之外还要看',
            tone: 'amber',
            bullets: ['附加模态权重是否很大', '是否存在重根带来的拖尾', '极点是否在局部区域内聚集'],
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'Bridge',
        intro: '时域曲线能告诉我们“像不像”，但未必能充分解释“为什么像/为什么不像”。这就需要回到频域，追问附加极点在主要带宽内有没有留下痕迹。',
        sections: [
          {
            title: '回到频域的三个追问',
            tone: 'cyan',
            bullets: ['附加极点从哪开始影响幅频与相频', '主要带宽落在什么量级', '这两者是否已经逼近'],
          },
        ],
      };
    case 'step-11':
      return {
        kicker: 'Bode Evidence',
        intro: '频域不是换一本教材，而是补充证据。固有频率、转折频率和带宽分别回答不同的问题。',
        sections: [
          {
            title: '幅频表达与锚点',
            tone: 'slate',
            markdown: `$$
\\left|G_{\\mathrm{ref}}(j\\omega)\\right|=\\frac{3.2}{\\sqrt{(3.2-\\omega^2)^2+(1.6\\omega)^2}}
$$

$$
\\omega_n=\\sqrt{3.2}\\approx1.79\\ \\text{rad/s}
$$

本页对照的关键锚点是附加极点转折频率 $1.4$、$5$ 与参考带宽约 $2.39$。`,
          },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Compare Then AI',
        intro:
          '双域近似判断必须先自己写，再用 AI 对照。AI 只检查你的证据链有没有站稳，不替你跳过“先观察、先判断”这一步。',
        sections: [
          {
            title: '本页标准动作',
            tone: 'emerald',
            bullets: ['先写时域证据', '再写频域证据', '最后让 AI 检查推理顺序和证据完整性'],
          },
        ],
      };
    case 'step-13':
      return {
        kicker: 'Convolution',
        intro: '卷积和模态叠加解释的是“输入怎样激发已有模态”，它不会凭空改写系统本身的极点结构。',
        sections: [
          {
            title: '卷积公式',
            tone: 'slate',
            markdown: `$$
y(t)=\\int_0^t g(t-\\tau)u(\\tau)\\,\\mathrm{d}\\tau
$$

$$
y_{\\text{step}}(t)=\\int_0^t g(t-\\tau)\\,\\mathrm{d}\\tau
$$

$$
G(s)=\\frac{12}{(s+1)(s+2)(s+6)},\\qquad g(t)=2.4e^{-t}-3e^{-2t}+0.6e^{-6t}
$$`,
          },
        ],
        note: '负模态来自留数符号，不等于系统不稳定。',
      };
    case 'step-14':
      return {
        kicker: 'Post-Assessment',
        intro: '后测不只考“会不会选”，也考“为什么能解释”。要把稳定底线、模态和双域证据串成一条话。',
        sections: [
          {
            title: '后测聚焦',
            tone: 'amber',
            bullets: ['先看系统会不会发散', '再看近似能不能成立', '最后能否用模态和双域证据解释'],
          },
        ],
      };
    case 'step-15':
      return {
        kicker: 'Takeaways',
        intro: '3-1 最重要的收束，不是多记几条经验句，而是形成一条判断链：先守底线，再看模态，再用双域证据决定近似是否可靠。',
        sections: [
          {
            title: '四句出口判断',
            tone: 'emerald',
            bullets: [
              '先判断稳定底线，再谈近似。',
              '时域里要看附加模态退场快慢。',
              '频域里要看附加极点是否侵入主要带宽。',
              '卷积激发模态，但不会改写系统极点结构。',
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
        kind: 'quiz',
        helper: '先做判断，再看参考纠偏。',
        submitLabel: '提交判断',
        releaseLabel: '释放判断区',
        questions: [
          {
            key: 'conflict-source',
            prompt: '同主导极点但响应仍不同，更关键的额外证据是什么？',
            options: [
              { value: 'same', label: '只要主导极点相同，主要响应就一定几乎一样' },
              { value: 'extra', label: '还要看附加模态退场快慢' },
            ],
            answer: 'extra',
            explanation: '主导极点很重要，但附加模态是否足够快地退场，仍会显著改变主要动态。',
          },
        ],
      };
    case 'step-04':
      return {
        kind: 'quiz',
        helper: '三题都只为暴露起点混淆。',
        submitLabel: '提交前测',
        releaseLabel: '释放前测',
        questions: [
          {
            key: 'pre-stability',
            prompt: '系统稳定后，下面哪句话仍然可能是对的？',
            options: [
              { value: 'good', label: '既然稳定，就一定已经足够快、足够平稳' },
              { value: 'not-enough', label: '稳定只是底线，动态品质仍可能不理想' },
            ],
            answer: 'not-enough',
            explanation: '稳定只回答“是否收敛”，不自动回答“是否够快、够平稳”。',
          },
          {
            key: 'pre-dominant',
            prompt: '主导极点更准确的理解是：',
            options: [
              { value: 'only', label: '系统中唯一真正重要的极点' },
              { value: 'main', label: '最能主导主要动态，但不是唯一证据的极点' },
            ],
            answer: 'main',
            explanation: '主导极点主导主要动态，但附加模态也可能保留影响。',
          },
          {
            key: 'pre-left',
            prompt: '“附加极点更靠左”最合理的理解是：',
            options: [
              { value: 'rule', label: '这是绝对判据，可以直接下结论' },
              { value: 'heuristic', label: '这是经验起点，还要配合权重和频域证据' },
            ],
            answer: 'heuristic',
            explanation: '更靠左常常有帮助，但还必须看权重、重根和主要带宽等因素。',
          },
        ],
      };
    case 'step-05':
      return {
        kind: 'form',
        helper: '先用一句话回答：如果有虚轴根或右半平面根，还能不能直接谈近似？',
        submitLabel: '提交理由',
        fields: [
          {
            key: 'stability-judgement',
            label: '你的判断理由',
            type: 'textarea',
            placeholder: '例如：系统连收敛都不能保证，后续近似语言就没有前提',
            answer: '近似讨论默认建立在系统可收敛的前提上。若出现虚轴根或右半平面根，就必须先重新确认稳定性与讨论前提。',
          },
        ],
      };
    case 'step-06':
      return {
        kind: 'form',
        helper: '把现象和模态语言一一对应。',
        submitLabel: '提交配对',
        fields: [
          {
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
          {
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
          {
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
        ],
      };
    case 'step-07':
      return {
        kind: 'form',
        helper: '切换不同极点家族后，选出你觉得最容易混淆的一类。',
        submitLabel: '记录当前关注点',
        fields: [
          {
            key: 'focus-tab',
            label: '当前最值得反复提醒的误区是：',
            type: 'radio',
            options: POLE_FAMILY_TABS.map((tab) => ({ value: tab.key, label: tab.misconception })),
          },
        ],
      };
    case 'step-08':
      return {
        kind: 'form',
        helper: '写出你认为最接近参考模型的一组，并说明理由。',
        submitLabel: '提交时域对照判断',
        fields: [
          {
            key: 'closest-model',
            label: '哪一组最接近参考模型？',
            type: 'radio',
            options: [
              { value: 'a', label: '模型 A' },
              { value: 'b', label: '模型 B' },
            ],
          },
          {
            key: 'why-close',
            label: '你判断的主要理由是什么？',
            type: 'textarea',
            placeholder: '例如：附加极点更靠左，附加模态退场更快',
          },
          {
            key: 'where-fail',
            label: '哪一组已经明显改写主要动态？为什么？',
            type: 'textarea',
            placeholder: '例如：模型 B，因为附加极点离主导极点太近',
          },
        ],
      };
    case 'step-09':
      return {
        kind: 'form',
        helper: '用一句话写出：为什么“更靠左”还不够？',
        submitLabel: '提交边界判断',
        fields: [
          {
            key: 'heuristic-boundary',
            label: '边界说明',
            type: 'textarea',
            placeholder: '例如：还要同时看附加模态权重、重根与主要动态窗口',
            answer: '“更靠左”只是经验起点，还要同时看附加模态权重、重根/聚集极点以及主要动态窗口是否仍被改写。',
          },
        ],
      };
    case 'step-10':
      return {
        kind: 'form',
        helper: '用两三句话说明：为什么要从时域再追问到频域。',
        submitLabel: '提交桥接回答',
        fields: [
          {
            key: 'bridge-to-frequency',
            label: '桥接说明',
            type: 'textarea',
            placeholder: '例如：时域只告诉我像不像，频域能补足附加极点在主要带宽里的影响证据',
          },
        ],
      };
    case 'step-11':
      return {
        kind: 'quiz',
        helper: '判断三个频率锚点分别在回答什么问题。',
        submitLabel: '提交频域判断',
        questions: [
          {
            key: 'wn-role',
            prompt: '固有频率最主要在回答什么？',
            options: [
              { value: 'break', label: '附加极点从哪开始显著影响频响' },
              { value: 'native', label: '原系统主要动态的本征节奏' },
              { value: 'bandwidth', label: '闭环主要响应频段的上边界' },
            ],
            answer: 'native',
            explanation: '固有频率首先是原系统主导动态的本征节奏，不是附加极点的转折频率。',
          },
          {
            key: 'break-role',
            prompt: '附加极点转折频率最主要在回答什么？',
            options: [
              { value: 'break', label: '附加极点从哪里开始明显改写幅频/相频' },
              { value: 'native', label: '原系统主导模态的自然节奏' },
              { value: 'steady', label: '系统稳态误差大小' },
            ],
            answer: 'break',
            explanation: '转折频率是附加极点开始显著影响频响的门槛。',
          },
          {
            key: 'bandwidth-role',
            prompt: '主要带宽最适合用来判断什么？',
            options: [
              { value: 'invade', label: '附加极点有没有侵入主要动态工作频段' },
              { value: 'pole-count', label: '系统总共有多少个极点' },
              { value: 'stable-only', label: '系统是否稳定，不再需要别的证据' },
            ],
            answer: 'invade',
            explanation: '主要带宽是判断附加极点影响是否已经侵入主要动态窗口的关键证据。',
          },
        ],
      };
    case 'step-12':
      return {
        kind: 'form',
        helper: '先提交你自己的双域判断，再打开页内 AI 做证据链对照。',
        submitLabel: '提交 AI 对照前判断',
        fields: [
          {
            key: 'time-domain-evidence',
            label: '时域证据',
            type: 'textarea',
            placeholder: '例如：模型 A 阶跃曲线更贴近参考模型，附加模态退场更快',
          },
          {
            key: 'frequency-domain-evidence',
            label: '频域证据',
            type: 'textarea',
            placeholder: '例如：转折频率远离主要带宽时，附加极点对主要频段影响更小',
          },
          {
            key: 'ai-reflection',
            label: 'AI 对照后，你修正了什么？',
            type: 'textarea',
            placeholder: '例如：我补上了带宽与转折频率关系这条证据',
          },
        ],
      };
    case 'step-13':
      return {
        kind: 'quiz',
        helper: '判断误区真假，并选择你最依赖的证据图。',
        submitLabel: '提交卷积判断',
        questions: [
          {
            key: 'convolution-change',
            prompt: '卷积最准确的作用是：',
            options: [
              { value: 'excite', label: '描述输入怎样激发已有模态' },
              { value: 'rewrite', label: '直接改写系统极点结构' },
              { value: 'stability', label: '单独决定系统是否稳定' },
            ],
            answer: 'excite',
            explanation: '卷积解释的是输入与脉冲响应如何组合，不会重新定义系统极点。',
          },
          {
            key: 'negative-mode',
            prompt: '负模态项意味着什么？',
            options: [
              { value: 'sign', label: '只说明留数符号为负，不等于失稳' },
              { value: 'unstable', label: '说明系统一定不稳定' },
              { value: 'new-pole', label: '说明系统多了一组右半平面极点' },
            ],
            answer: 'sign',
            explanation: '负模态来自留数符号，不等于系统有右半平面极点。',
          },
        ],
        fields: [
          {
            key: 'evidence-figure',
            label: '你更依赖哪张证据图完成判断？',
            type: 'radio',
            options: [
              { value: 'convolution', label: '卷积叠加图' },
              { value: 'modal', label: '模态叠加示意图' },
            ],
          },
        ],
      };
    case 'step-14':
      return {
        kind: 'quiz',
        helper: '后测既考客观判断，也考解释链。',
        submitLabel: '提交后测',
        releaseLabel: '释放后测',
        questions: [
          {
            key: 'post-stability',
            prompt: '遇到一个高阶系统，第一步最应该先判断什么？',
            options: [
              { value: 'stability', label: '系统是否稳定、是否具备讨论近似的前提' },
              { value: 'bode', label: '先画完整 Bode 图再说' },
              { value: 'controller', label: '先选择控制器结构' },
            ],
            answer: 'stability',
            explanation: '稳定底线永远先于近似、判图和设计。',
          },
          {
            key: 'post-approximation',
            prompt: '主导极点近似何时更可信？',
            options: [
              { value: 'left-only', label: '只要附加极点更靠左就一定可靠' },
              { value: 'dual', label: '时域与频域证据都支持附加模态已退场、附加极点未侵入主要带宽' },
            ],
            answer: 'dual',
            explanation: '必须把时域与频域证据一起补齐，不能只靠单一经验句。',
          },
        ],
        fields: [
          {
            key: 'post-explanation',
            label: '请用一句话解释：为什么卷积和模态语言能帮助我们解释高阶系统响应，但不会取代稳定底线？',
            type: 'textarea',
            placeholder: '例如：卷积和模态只解释输出形成机制，前提仍然是系统本身具备稳定收敛的基础',
            answer: '卷积和模态语言解释的是输出如何形成与哪些模态被激发，但它们都建立在系统极点结构已给定、稳定底线先成立的前提上。',
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

function getAiPrompts(step: UNIT_3_1StepDefinition) {
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_3_1StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit31:${step.id}`,
    registryId: 'unit31-inline-ai',
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

function getDefaultDraft(activity: ActivitySpec, savedResponse?: UNIT_3_1StepResponse) {
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

function StepInlineVisual({
  step,
  onParameterChange,
}: {
  step: UNIT_3_1StepDefinition;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [activeTab, setActiveTab] = useState<typeof POLE_FAMILY_TABS[number]['key']>('negative-real');
  const activeFamily = POLE_FAMILY_TABS.find((item) => item.key === activeTab) ?? POLE_FAMILY_TABS[0];

  if (step.id === 'step-07') {
    return (
      <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">极点家族切换器</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {POLE_FAMILY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                onParameterChange?.({ key: 'poleFamilyTab', value: POLE_FAMILY_TABS.findIndex((item) => item.key === tab.key), source: 'toggle' });
              }}
              className={`premium-lesson-tone-pill ${activeTab === tab.key ? 'premium-tone-cyan' : 'premium-tone-slate'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="premium-lesson-surface-elevated mt-4 px-4 py-4 text-sm">
          <div className="font-medium">{activeFamily.label}</div>
          <div className="premium-lesson-muted mt-2">{activeFamily.formula}</div>
          <div className="mt-2">{activeFamily.phenomenon}</div>
          <div className="premium-lesson-tone-block premium-tone-amber mt-3">{activeFamily.misconception}</div>
        </div>
      </section>
    );
  }

  if (step.id === 'step-08') {
    return (
      <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">三模型比较工作区</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {DOMINANT_MODEL_CARDS.map((card, index) => (
            <button
              key={card.key}
              type="button"
              onClick={() => onParameterChange?.({ key: 'dominantModelCard', value: index, source: 'toggle' })}
              className="premium-lesson-surface-elevated px-4 py-4 text-left text-sm"
            >
              <div className="font-medium">{card.label}</div>
              <div className="premium-lesson-muted mt-2">{card.formula}</div>
              <div className="mt-2">{card.takeaway}</div>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (step.id === 'step-11') {
    return (
      <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">频率锚点对照表</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {BANDWIDTH_CHECKLIST.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onParameterChange?.({ key: 'bandwidthChecklist', value: index, source: 'toggle' })}
              className="premium-lesson-surface-elevated px-4 py-4 text-left text-sm"
            >
              <div className="font-medium">{item.label}</div>
              <div className="premium-lesson-muted mt-2">{item.question}</div>
              <div className="mt-2">{item.meaning}</div>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (step.id === 'step-13') {
    return (
      <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">双图证据区</div>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <figure className="premium-lesson-surface-elevated overflow-hidden px-3 py-3">
            <Image
              src="/course-runtime/lessons/3-1/media/3-1-pp-04-modal-superposition-high-order.svg"
              alt="模态叠加示意图"
              width={1200}
              height={720}
              unoptimized
              className="h-auto w-full rounded-2xl border border-border/60 bg-background/60"
            />
            <figcaption className="premium-lesson-muted mt-2 text-xs">模态叠加图：解释不同模态如何共同构成输出。</figcaption>
          </figure>
          <div className="premium-lesson-tone-block premium-tone-cyan text-sm">
            <div className="font-medium">本页判断锚点</div>
            <div className="mt-2">输入改变的是各模态被激发的方式，不是系统极点的几何位置。</div>
          </div>
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
          ['2-4', '先用 Bode 与 Nyquist 收束频域图形对象。'],
          ['3-1', '开始解释极点为什么能统领稳定、模态与低阶近似。'],
          ['3-2', '下一课把稳定底线推进到稳定边界和劳斯可视化。'],
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

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="premium-lesson-tone-pill premium-tone-slate">{UNIT_3_1_STAGE_LABEL[step.stage]}</span>
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
            课程 runtime 配套图示。当前交互实现直接消费 `course-content/runtime/lessons/3-1/media/*`。
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}

export function UNIT_3_1StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
}: {
  step: UNIT_3_1StepDefinition;
  savedResponse?: UNIT_3_1StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_1StepResponse) => void;
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
  const instantFeedbackSteps = new Set(['step-11', 'step-13']);
  const showAnswers = answerVisible || instantFeedbackSteps.has(step.id);

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
            {showAnswers ? (
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
            {showAnswers && field.answer ? (
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

      {showAnswers && answerFields.length ? (
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
        {['稳定底线', '模态语言', '主导极点近似', '双域证据'].map((keyword) => (
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
        你已经把“稳定底线 -&gt; 极点到模态 -&gt; 时域证据 -&gt; 频域证据 -&gt; 卷积收束”这条链条搭起来了。下一课会把它推进到稳定边界可视化。
      </div>
    </section>
  );
}

export function UNIT_3_1StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_3_1StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '3-1',
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
        请先完成本页自判，再用下面的提示词与页内 AI 做证据链对照。AI 负责核对推理链，不替你跳过第一步。
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
            <DialogTitle>{UNIT_3_1_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription>
              当前只围绕 {step.title} 回答问题，帮助你核对“稳定底线 -&gt; 模态 -&gt; 双域证据”的推理链。
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
