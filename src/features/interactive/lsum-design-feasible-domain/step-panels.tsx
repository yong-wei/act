'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Sparkles,
} from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveConfig } from '@/features/interactive/types';
import {
  LSUM_LESSON_STEPS,
  LSUM_STAGE_LABEL,
  type LSUMStepDefinition,
  type LSUMStepResponse,
} from '@/lib/lsum-course';

type Tone = 'cyan' | 'sky' | 'amber' | 'emerald' | 'violet' | 'rose' | 'slate';

interface StepSection {
  title: string;
  tone: Tone;
  body?: string;
  bullets?: string[];
}

interface StepBlueprint {
  kicker: string;
  intro: string;
  sections: StepSection[];
  controls?: string[];
}

interface ChoiceOption {
  value: string;
  label: string;
}

interface QuestionSpec {
  key: string;
  prompt: string;
  type: 'single' | 'text';
  options?: ChoiceOption[];
  answer?: string;
  placeholder?: string;
}

interface FieldSpec {
  key: string;
  label: string;
  type: 'radio' | 'textarea';
  options?: ChoiceOption[];
  placeholder?: string;
}

type ActivitySpec =
  | {
      kind: 'none';
      helper?: string;
    }
  | {
      kind: 'quiz';
      helper?: string;
      submitLabel?: string;
      releaseLabel: '释放前测' | '释放后测';
      questions: QuestionSpec[];
    }
  | {
      kind: 'form';
      helper?: string;
      submitLabel?: string;
      fields: FieldSpec[];
    };

export interface LSUMTeacherResponseItem {
  studentName: string;
  response: LSUMStepResponse;
}

function toneClass(tone: Tone) {
  switch (tone) {
    case 'sky':
      return 'premium-lesson-tone-block premium-tone-sky';
    case 'amber':
      return 'premium-lesson-tone-block premium-tone-amber';
    case 'emerald':
      return 'premium-lesson-tone-block premium-tone-emerald';
    case 'violet':
      return 'premium-lesson-tone-block premium-tone-violet';
    case 'rose':
      return 'premium-lesson-tone-block premium-tone-rose';
    case 'slate':
      return 'premium-lesson-tone-block premium-tone-slate';
    case 'cyan':
    default:
      return 'premium-lesson-tone-block premium-tone-cyan';
  }
}

function getStepBlueprint(step: LSUMStepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Layer 0 Wrap-up',
        intro: '这一页把 L-2a 到 L-2d 的直觉能力收束成一个设计入口：从今天开始，性能要求不再是验收结果，而是反推参数的起点。',
        sections: [
          {
            title: '当前位置',
            tone: 'cyan',
            bullets: ['L-2a 看时域响应', 'L-2b 看极点如何沿根轨迹迁移', 'L-2c 看频域余量与节拍选择', 'L-2d 把三域联动到一张界面里'],
          },
          {
            title: '本课任务',
            tone: 'sky',
            body: '把“三张图都看懂”升级为“面对一张验收单，能够直接判断 K 应该落在哪个允许范围”。',
          },
        ],
        controls: ['先回顾地图', '高亮 L-∑ 位置', '引出“从分析切到设计”'],
      };
    case 'step-02':
      return {
        kicker: 'Design Switch',
        intro: '过去四节课默认是“给 K 看结果”，这一页正式切换到“给性能找 K”。设计问题不追求唯一值，而追求一段允许范围。',
        sections: [
          {
            title: '分析问题',
            tone: 'slate',
            bullets: ['给定参数，看超调量、调节时间和频域指标', '答案往往是单点计算结果', '重点是理解系统会发生什么'],
          },
          {
            title: '设计问题',
            tone: 'amber',
            bullets: ['给定性能要求，反推出可接受的极点与参数范围', '答案通常是一段可行区间', '重点是把约束转成几何边界'],
          },
        ],
        controls: ['展示验收单', '停顿 30 秒', '让学生先说“从哪里找 K 的范围”'],
      };
    case 'step-03':
      return {
        kicker: 'Objectives',
        intro: '学生在离开这一课前，需要完成四件事：说清分析和设计的差异、能画可行域、能读根轨迹可行弧段、能把可行域投影回时域和频域。',
        sections: [
          {
            title: '四条学习目标',
            tone: 'emerald',
            bullets: ['解释“给 K 看性能”和“给性能找 K”的区别', '在复平面上画出超调量与调节时间边界', '在根轨迹上读出满足要求的 K 范围', '说出设计可行域在时域和频域上的投影'],
          },
        ],
        controls: ['逐条揭示目标', '提醒后测将逐条回收'],
      };
    case 'step-04':
      return {
        kicker: 'Pre-assessment',
        intro: '前测用于确认阻尼比、根轨迹与极点迁移是否还清楚。教师释放前测后，学生即可作答并在后续看到班级分布。',
        sections: [
          {
            title: '检测重点',
            tone: 'violet',
            bullets: ['阻尼比变化与超调量的方向关系', '极点沿根轨迹移动的判断', '为后续可行域画法预热'],
          },
        ],
        controls: ['释放前测', '显示答案', '根据统计决定是否补讲阻尼比射线'],
      };
    case 'step-05':
      return {
        kicker: 'Engineering Task',
        intro: '这里把一整节课压缩为一张工程验收单。系统模型和性能指标已经给定，课堂后续所有页面都在围绕“找到可行的 K 范围”服务。',
        sections: [
          {
            title: '任务单',
            tone: 'cyan',
            bullets: ['开环传递函数：G(s) = K / (s(s+2))', '超调量 Mp ≤ 20%', '调节时间 ts ≤ 5 s'],
          },
          {
            title: '设计问题',
            tone: 'amber',
            body: 'K 不需要逐个试，而是要先在复平面上画出“允许极点落点”，再回到根轨迹上读出允许的弧段。',
          },
        ],
        controls: ['固定任务背景', '强调“不逐个试 K”'],
      };
    case 'step-06':
      return {
        kicker: 'Prediction Sketch',
        intro: '学生先在纸面上或手机端留下自己的极点区域直觉。此时不要求对错，只要求把“超调量约束”和“调节时间约束”分开表达出来。',
        sections: [
          {
            title: '记录要求',
            tone: 'sky',
            bullets: ['极点区域画在复平面上', '写一句你认为约束对应哪条边界', '保留这份预测，后面要回来比对'],
          },
        ],
        controls: ['发出 90 秒计时', '收集草图', '展示 2-3 份代表性判断'],
      };
    case 'step-07':
      return {
        kicker: 'Feasible Domain',
        intro: '复平面可行域由两条边界拼成：阻尼比射线限制超调量，实部垂线限制调节时间。两者交集才是“可接受极点”的真正区域。',
        sections: [
          {
            title: '超调量约束',
            tone: 'sky',
            bullets: ['Mp ≤ 20% 对应阻尼比 ζ ≥ 0.45', '几何上是一条从原点出发的阻尼比射线', '射线下方代表阻尼更强、超调更小'],
          },
          {
            title: '调节时间约束',
            tone: 'amber',
            bullets: ['ts ≤ 5 s 对应 Re(s) ≤ -0.8', '几何上是一条垂直边界线', '垂线左侧代表衰减更快、收敛更快'],
          },
          {
            title: '交集判读',
            tone: 'emerald',
            body: '真正的设计可行域是“双重满足”的扇形区域。落在交集之外的极点，总有一个指标不达标。',
          },
        ],
        controls: ['揭示射线', '揭示垂线', '高亮交集可行域'],
      };
    case 'step-08':
      return {
        kicker: 'Root Locus Window',
        intro: '可行域画好后，还差一步：系统极点必须真的能沿根轨迹到达那里。于是“可行域”与“根轨迹”的交集，会变成 K 的允许范围。',
        sections: [
          {
            title: '读图方法',
            tone: 'cyan',
            bullets: ['先看根轨迹是否进入可行域', '进入点和离开点决定允许弧段', '弧段两端对应 K 的上下界'],
          },
          {
            title: '工程含义',
            tone: 'violet',
            body: '如果根轨迹只部分穿过可行域，那么 K 不是“任意满足”，而是必须落在一段有限区间内。',
          },
        ],
        controls: ['叠加根轨迹', '标注弧段端点', '读出 K 上下界'],
      };
    case 'step-09':
      return {
        kicker: 'Three-domain Projection',
        intro: '同一个 K 可以在三张图里被同时阅读。复平面告诉你“是否可行”，时域告诉你“波形是否验收通过”，频域告诉你“带宽和余量是否处于合理区间”。',
        sections: [
          {
            title: '复平面投影',
            tone: 'cyan',
            body: '极点是否位于扇形可行域，决定是否同时满足 Mp 与 ts。',
          },
          {
            title: '时域投影',
            tone: 'emerald',
            body: '同一组极点在时域上表现为包络快慢与超调大小的变化。',
          },
          {
            title: '频域投影',
            tone: 'violet',
            body: '随着 K 改变，带宽、交越频率与稳定余量会一起变化，形成“频域可行带”。',
          },
        ],
        controls: ['同步对比三张图', '强调“一组 K 的三张面孔”'],
      };
    case 'step-10':
      return {
        kicker: 'AI Reflection',
        intro: '这一步要求学生先写下自己的判断，再打开页内 AI 助手做对照。AI 不是给答案，而是帮助学生检查自己用的是哪条约束链路。',
        sections: [
          {
            title: '建议提问顺序',
            tone: 'violet',
            bullets: ['先描述你判断约束收紧后哪条边界会移动', '再问可行域是缩小、平移还是形状改变', '最后要求 AI 用复平面、时域、频域三个视角对照'],
          },
        ],
        controls: ['先写判断', '打开页内 AI', '对照自身推理链'],
      };
    case 'step-11':
      return {
        kicker: 'Worked Example',
        intro: '例题 1 让学生真正练一次“哪个约束咬住系统”的判断。重点不在大量计算，而在看出到底是哪条边界先起主导作用。',
        sections: [
          {
            title: '判读顺序',
            tone: 'amber',
            bullets: ['先看候选极点是否位于可行域', '再看其与根轨迹的对应关系', '最后回答是谁决定了 K 的边界'],
          },
          {
            title: '课堂结论',
            tone: 'emerald',
            body: '工程上常见的不是“所有约束同时同等重要”，而是某一条约束先把系统卡住，其余约束退居次要。',
          },
        ],
        controls: ['圈出主导约束', '连接回工程任务单'],
      };
    case 'step-12':
      return {
        kicker: 'Constraint Dominance',
        intro: '这一页把例题判断收束为一句工程语言：真正决定 K 边界的是哪条约束，取决于根轨迹先碰到谁。',
        sections: [
          {
            title: '一句话原则',
            tone: 'cyan',
            body: '根轨迹先碰到哪条约束边界，哪条边界就“咬住”系统，也就决定了允许 K 的主界限。',
          },
          {
            title: '迁移提示',
            tone: 'sky',
            bullets: ['换指标时先改边界，不先改 K', '换系统时先看根轨迹，不先猜波形', '设计判断要先画图再算值'],
          },
        ],
        controls: ['回扣例题', '为后测做一句话收束'],
      };
    case 'step-13':
      return {
        kicker: 'Post-assessment',
        intro: '后测回收三类核心判断：边界线怎么读、极点是否可行、约束收紧后哪条图形发生变化。题目答完后可显示答案与班级分布。',
        sections: [
          {
            title: '检测目标',
            tone: 'emerald',
            bullets: ['会把性能要求翻译成边界', '会判断某个候选极点是否在可行域内', '会描述可行域收紧时的几何变化'],
          },
        ],
        controls: ['释放后测', '显示答案', '依据统计回收薄弱点'],
      };
    case 'step-14':
      return {
        kicker: 'Five Intuitions',
        intro: '层 0 的最后一页不是再给一个公式，而是把“设计型直觉”压缩成五句课堂可带走的话，让学生知道以后遇到新系统也该先画哪张图。',
        sections: [
          {
            title: '五条设计直觉',
            tone: 'cyan',
            bullets: ['先把性能要求翻译成边界', '可行域是约束的交集', '根轨迹决定这些点能否被 K 走到', '谁先碰边界，谁就主导设计', '三域投影是在讲同一个 K'],
          },
        ],
        controls: ['请学生用自己的话复述', '总结课堂主线'],
      };
    case 'step-15':
    default:
      return {
        kicker: 'Next Lesson',
        intro: '下一课会把今天的设计直觉翻译成更系统的数学表达：如何从复平面边界正式推到时域和频域指标，以及如何让公式服务于判断而不是替代判断。',
        sections: [
          {
            title: '过渡关系',
            tone: 'slate',
            bullets: ['今天建立的是图像化设计直觉', '下一课会把这些直觉写成可计算的数学表达', '目标不是抛弃直觉，而是让计算更可靠'],
          },
        ],
        controls: ['呼应 1-1 数学精化', '留下“为什么公式仍然重要”'],
      };
  }
}

function getStepActivity(step: LSUMStepDefinition): ActivitySpec {
  switch (step.id) {
    case 'step-04':
      return {
        kind: 'quiz',
        releaseLabel: '释放前测',
        helper: '教师释放前测后，学生作答并等待教师统一显示答案。',
        submitLabel: '提交前测',
        questions: [
          {
            key: 'q1',
            prompt: '阻尼比 ζ = 0.3 和 ζ = 0.7，哪个超调量更大？',
            type: 'single',
            answer: 'A',
            options: [
              { value: 'A', label: 'ζ = 0.3 超调更大，极点更靠近虚轴' },
              { value: 'B', label: 'ζ = 0.3 超调更大，极点更靠近实轴' },
              { value: 'C', label: 'ζ = 0.7 超调更大，极点更靠近虚轴' },
              { value: 'D', label: 'ζ = 0.7 超调更大，极点更靠近实轴' },
            ],
          },
          {
            key: 'q2',
            prompt: 'K 从小变大时，下面哪句话最准确？',
            type: 'single',
            answer: 'B',
            options: [
              { value: 'A', label: '极点会随机散开，与开环零极点无关' },
              { value: 'B', label: '极点沿由开环零极点决定的根轨迹移动' },
              { value: 'C', label: '极点一定向原点回缩' },
              { value: 'D', label: '极点一定保持阻尼比不变' },
            ],
          },
        ],
      };
    case 'step-06':
      return {
        kind: 'form',
        helper: '先写下你的极点区域判断，不必追求标准答案，重点是保留推理起点。',
        submitLabel: '保存预测',
        fields: [
          {
            key: 'prediction',
            label: '我认为极点应该落在什么区域？为什么？',
            type: 'textarea',
            placeholder: '例如：我觉得极点应该在负实轴左侧并靠近阻尼比射线下方，因为这样既能压超调，又能保证收敛速度。',
          },
        ],
      };
    case 'step-10':
      return {
        kind: 'form',
        helper: '先写个人判断，再打开页内 AI 助手核对思路。教师端会看到词云和学生回复列表。',
        submitLabel: '提交判断',
        fields: [
          {
            key: 'firstJudgement',
            label: '如果把约束收紧，你认为可行域会怎么变？',
            type: 'textarea',
            placeholder: '先说出哪条边界会动，再说可行域是缩小、平移还是形状改变。',
          },
          {
            key: 'afterAi',
            label: '和 AI 对照后，你修正了哪一步推理？',
            type: 'textarea',
            placeholder: '记录你调整后的理解，方便课后复盘。',
          },
        ],
      };
    case 'step-13':
      return {
        kind: 'quiz',
        releaseLabel: '释放后测',
        helper: '后测用于回收三条设计判断。教师可释放后测并统一显示答案。',
        submitLabel: '提交后测',
        questions: [
          {
            key: 'q1',
            prompt: '调节时间约束对应复平面上的哪类边界？',
            type: 'single',
            answer: 'C',
            options: [
              { value: 'A', label: '从原点出发的阻尼比射线' },
              { value: 'B', label: '过虚轴的水平线' },
              { value: 'C', label: '实部为常数的垂线' },
              { value: 'D', label: '以原点为圆心的圆弧' },
            ],
          },
          {
            key: 'q2',
            prompt: '候选极点要满足设计要求，至少必须满足什么？',
            type: 'single',
            answer: 'D',
            options: [
              { value: 'A', label: '只在根轨迹上即可' },
              { value: 'B', label: '只在可行域内即可' },
              { value: 'C', label: '只要超调量合格即可' },
              { value: 'D', label: '既在可行域内，又能被根轨迹走到' },
            ],
          },
          {
            key: 'q3',
            prompt: '若超调量要求更严格，通常先变化的是哪条边界？',
            type: 'single',
            answer: 'A',
            options: [
              { value: 'A', label: '阻尼比射线会向负实轴方向收紧' },
              { value: 'B', label: '实部垂线会向右移动' },
              { value: 'C', label: '根轨迹必然消失' },
              { value: 'D', label: '频域可行带一定变宽' },
            ],
          },
        ],
      };
    case 'step-14':
      return {
        kind: 'form',
        helper: '用自己的话回收层 0 的五条设计直觉，教师端会看到词云与默认折叠的学生回复列表。',
        submitLabel: '提交总结',
        fields: [
          {
            key: 'confidence',
            label: '你觉得自己现在对“设计可行域”有多清晰？',
            type: 'radio',
            options: [
              { value: 'A', label: '已经能复述五条设计直觉' },
              { value: 'B', label: '基本明白，还需要例题巩固' },
              { value: 'C', label: '还停留在图像印象，需要再回看' },
            ],
          },
          {
            key: 'reflection',
            label: '请用自己的话写下今天最重要的一条设计型直觉。',
            type: 'textarea',
            placeholder: '例如：先把性能要求翻成边界，再去看根轨迹能否走到这些点。',
          },
        ],
      };
    default:
      return {
        kind: 'none',
        helper: '当前环节以教师讲解和图示引导为主。',
      };
  }
}

function tokenizeWordCloud(text: string) {
  return text
    .toLowerCase()
    .split(/[\s，。！？；：、,.!?:;()\[\]{}"'`/\\|<>《》【】\n\r\t]+/)
    .flatMap((token) => {
      const cleaned = token.trim();
      if (!cleaned) {
        return [];
      }
      const chinesePhrases = cleaned.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
      if (chinesePhrases.length) {
        return chinesePhrases;
      }
      return cleaned.length >= 2 ? [cleaned] : [];
    });
}

function buildWordCloudEntries(values: Array<{ text: string }>) {
  const counts = new Map<string, number>();
  for (const item of values) {
    for (const token of tokenizeWordCloud(item.text)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hans-CN'))
    .slice(0, 18);
}

function getChoiceLabel(options: ChoiceOption[], answer: string) {
  return options.find((option) => option.value === answer)?.label ?? '';
}

function getAiPrompts(step: LSUMStepDefinition) {
  if (step.id !== 'step-10') {
    return [];
  }

  return [
    '如果把超调量要求从 20% 收紧到 10%，请你先用复平面的边界变化解释可行域会怎样变化，再补一句对时域和频域的影响。',
    '请不要直接给结论，而是按“哪条边界变了 -> 可行域如何缩小 -> K 的允许范围如何变化”的顺序引导我自己说出来。',
  ];
}

function buildInteractiveAiConfig(step: LSUMStepDefinition): InteractiveConfig {
  return {
    resourceId: step.id,
    registryId: 'lsum-inline-ai',
    title: `${step.title} · 页内 AI 助手`,
    description: '围绕设计可行域课堂页面的即时追问助手',
    aiHints: getAiPrompts(step).join('\n\n'),
    config: {
      ai: {
        enabled: true,
        persona: 'analyst',
        hints: '围绕复平面可行域、根轨迹可行弧段以及三域投影来回答。',
      },
      layout: {
        showAIPanel: true,
        aiPanelPosition: 'right',
      },
    },
  };
}

function getDefaultDraft(activity: ActivitySpec, savedResponse?: LSUMStepResponse) {
  if (activity.kind === 'quiz') {
    return Object.fromEntries(activity.questions.map((question) => [question.key, savedResponse?.answers[question.key] ?? '']));
  }

  if (activity.kind === 'form') {
    return Object.fromEntries(activity.fields.map((field) => [field.key, savedResponse?.answers[field.key] ?? '']));
  }

  return {};
}

export function LSUMKnowledgeMapVisual() {
  return (
    <section className="premium-lesson-accent-panel">
      <div className="premium-lesson-kicker text-sm tracking-[0.24em]">Knowledge Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">L-∑ 当前位置：层 0 的设计收束页</h2>
      <p className="premium-lesson-body mt-2 text-sm leading-6">
        时域、根轨迹、频域和三域联动都已经学过，今天要把这些图像经验压缩成一套“先画边界，再找可行 K”的设计语言。
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {[
          { title: 'L-2a 时域直觉', status: '已完成' },
          { title: 'L-2b 根轨迹直觉', status: '已完成' },
          { title: 'L-2c 频域直觉', status: '已完成' },
          { title: 'L-2d 三域联动', status: '已完成' },
          { title: 'L-∑ 设计可行域', status: '当前高亮', active: true },
        ].map((node) => (
          <div
            key={node.title}
            className={
              node.active
                ? 'premium-lesson-selectable-card premium-lesson-selectable-card-active px-4 py-4'
                : 'premium-lesson-selectable-card px-4 py-4'
            }
          >
            <div className={node.active ? 'premium-lesson-kicker' : 'premium-lesson-caption text-xs uppercase tracking-[0.2em]'}>
              {node.status}
            </div>
            <div className="mt-2 text-base font-medium">{node.title}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        {['性能要求 → 边界', '边界交集 → 可行域', '可行域 ∩ 根轨迹 → K 范围', '同一 K 的三域投影'].map((item) => (
          <div key={item} className="premium-lesson-surface-elevated px-3 py-2 text-sm">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function LSUMStepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  rightSlot,
}: {
  step: LSUMStepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  rightSlot?: ReactNode;
}) {
  const content = getStepBlueprint(step);

  return (
    <section className="premium-lesson-panel">
      <div className="flex flex-wrap items-center gap-3">
        <span className="premium-lesson-tone-pill premium-tone-cyan">{content.kicker}</span>
        <span className="premium-lesson-tone-pill premium-tone-slate">{LSUM_STAGE_LABEL[step.stage]}</span>
        <span className="premium-lesson-tone-pill premium-tone-slate">⏱ {step.duration}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="premium-lesson-title text-2xl font-semibold sm:text-[2rem]">{step.title}</h2>
          <p className="premium-lesson-body mt-3 text-base leading-7 sm:text-lg sm:leading-8">{content.intro}</p>
        </div>
        {rightSlot ? <div className="flex shrink-0 items-center justify-end">{rightSlot}</div> : null}
      </div>

      <div className="mt-5 space-y-3">
        {content.sections.map((section) => (
          <article key={section.title} className={`rounded-2xl border p-4 ${toneClass(section.tone)}`}>
            <h3 className="text-lg font-semibold">{section.title}</h3>
            {section.body ? <p className="mt-2 text-base leading-7">{section.body}</p> : null}
            {section.bullets?.length ? (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-base leading-7">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      {mediaSrc ? (
        <div className="premium-lesson-panel-soft mt-5">
          <div className="premium-lesson-surface-elevated overflow-hidden rounded-[24px]">
            <Image
              src={mediaSrc}
              alt={mediaAlt ?? step.title}
              width={1600}
              height={960}
              className="h-auto w-full object-contain"
            />
          </div>
        </div>
      ) : null}

      {content.controls?.length ? (
        <div className="premium-lesson-panel-soft mt-5">
          <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
            <ClipboardList className="h-4 w-4" />
            教师操作建议
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {content.controls.map((control) => (
              <span key={control} className="premium-lesson-chip px-3 py-1 text-sm">
                {control}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FieldRenderer({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FieldSpec;
  value?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="premium-lesson-surface-elevated px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
      {field.type === 'radio' ? (
        <div className="mt-3 space-y-2">
          {(field.options ?? []).map((option) => (
            <label key={option.value} className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name={field.key}
                value={option.value}
                checked={value === option.value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
              />
              <span>
                {option.value}. {option.label}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="premium-lesson-input mt-3 min-h-[120px] w-full resize-y text-sm tracking-normal"
        />
      )}
    </div>
  );
}

function QuestionRenderer({
  question,
  value,
  answerVisible,
  disabled,
  onChange,
}: {
  question: QuestionSpec;
  value?: string;
  answerVisible: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (question.type === 'text') {
    return (
      <div className="premium-lesson-surface-elevated px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
        <textarea
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
          className="premium-lesson-input mt-3 min-h-[120px] w-full resize-y text-sm tracking-normal"
        />
      </div>
    );
  }

  return (
    <div className="premium-lesson-surface-elevated px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
      <div className="mt-3 space-y-2">
        {(question.options ?? []).map((option) => (
          <label key={option.value} className="flex items-center gap-3 text-sm">
            <input
              type="radio"
              name={question.key}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
            />
            <span>
              {option.value}. {option.label}
            </span>
          </label>
        ))}
        {answerVisible && question.answer ? (
          <div className="premium-lesson-tone-pill premium-tone-emerald mt-3 inline-flex">
            正确答案：{question.answer}. {getChoiceLabel(question.options ?? [], question.answer)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function LSUMStudentActivityForm({
  step,
  savedResponse,
  released = true,
  answerVisible = false,
  onSubmit,
}: {
  step: LSUMStepDefinition;
  savedResponse?: LSUMStepResponse;
  released?: boolean;
  answerVisible?: boolean;
  onSubmit: (response: LSUMStepResponse) => void;
}) {
  // 使用 useMemo 缓存 activity 对象，避免每次渲染创建新引用导致无限循环
  const activity = useMemo(() => getStepActivity(step), [step]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const isSubmitted = Boolean(savedResponse);

  useEffect(() => {
    setDraft(getDefaultDraft(activity, savedResponse));
  }, [activity, savedResponse, step.id]);

  if (activity.kind === 'none') {
    return null;
  }

  if (activity.kind === 'quiz' && !released) {
    return (
      <section className="premium-lesson-accent-panel">
        <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4" />
          学生任务提交区
        </div>
        <p className="premium-lesson-muted mt-2">{activity.helper}</p>
        <div className="premium-lesson-tone-block premium-tone-amber mt-4">
          等待教师开始{activity.releaseLabel === '释放前测' ? '前测' : '后测'}…
        </div>
      </section>
    );
  }

  return (
    <section className="premium-lesson-accent-panel">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <BookOpen className="h-4 w-4" />
        学生任务提交区
      </div>
      {activity.helper ? <p className="premium-lesson-muted mt-2">{activity.helper}</p> : null}
      {step.id === 'step-10' ? (
        <div className="premium-lesson-tone-card premium-tone-violet mt-4">
          先提交自己的判断，再打开页内 AI 助手做对照，避免把 AI 当成“先给答案”的捷径。
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {activity.kind === 'quiz'
          ? activity.questions.map((question) => (
              <QuestionRenderer
                key={question.key}
                question={question}
                value={draft[question.key]}
                answerVisible={answerVisible}
                disabled={isSubmitted}
                onChange={(value) => setDraft((prev) => ({ ...prev, [question.key]: value }))}
              />
            ))
          : activity.fields.map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={draft[field.key]}
                disabled={isSubmitted}
                onChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
              />
            ))}
      </div>

      <button
        type="button"
        disabled={isSubmitted}
        onClick={() =>
          onSubmit({
            stepId: step.id,
            submittedAt: Date.now(),
            answers: draft,
          })
        }
        className="premium-lesson-action-primary mt-4"
      >
        {isSubmitted ? '已提交' : activity.submitLabel ?? '提交'}
      </button>
      <SubmissionStatus submitted={isSubmitted} />
    </section>
  );
}

export function LSUMTeacherActivitySummary({
  step,
  responses,
  released = false,
  answerVisible = false,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: LSUMStepDefinition;
  responses: LSUMTeacherResponseItem[];
  released?: boolean;
  answerVisible?: boolean;
  onToggleRelease?: () => void;
  onToggleAnswerVisible?: () => void;
}) {
  const activity = getStepActivity(step);
  const [showTextResponses, setShowTextResponses] = useState(false);

  if (activity.kind === 'none') {
    return (
      <section className="premium-lesson-panel-soft">
        <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4" />
          教师端汇总
        </div>
        <p className="premium-lesson-muted mt-2">
          当前环节以讲授和图示为主，无需学生提交。教师可继续推进页面，并结合上方图示组织讨论。
        </p>
      </section>
    );
  }

  const choiceBlocks =
    activity.kind === 'quiz'
      ? activity.questions
          .filter((question) => question.type === 'single')
          .map((question) => {
            const options = question.options ?? [];
            const counts = Object.fromEntries(options.map((option) => [option.value, 0]));
            for (const item of responses) {
              const value = item.response.answers[question.key];
              if (typeof value === 'string' && value in counts) {
                counts[value] += 1;
              }
            }

            return (
              <article key={question.key} className="premium-lesson-surface-elevated px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="premium-lesson-title text-sm font-medium">{question.prompt}</h3>
                  {answerVisible && question.answer ? (
                    <span className="premium-lesson-tone-pill premium-tone-emerald">
                      正确答案：{question.answer}. {getChoiceLabel(options, question.answer)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {options.map((option) => {
                    const count = counts[option.value] ?? 0;
                    const ratio = responses.length ? (count / responses.length) * 100 : 0;
                    return (
                      <div key={option.value} className="space-y-1">
                        <div className="premium-lesson-caption flex items-center justify-between text-xs">
                          <span>
                            {option.value}. {option.label}
                          </span>
                          <span>{count} 人</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/70">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${ratio}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })
      : activity.fields
          .filter((field) => field.type === 'radio')
          .map((field) => {
            const options = field.options ?? [];
            const counts = Object.fromEntries(options.map((option) => [option.value, 0]));
            for (const item of responses) {
              const value = item.response.answers[field.key];
              if (typeof value === 'string' && value in counts) {
                counts[value] += 1;
              }
            }

            return (
              <article key={field.key} className="premium-lesson-surface-elevated px-4 py-4">
                <h3 className="premium-lesson-title text-sm font-medium">{field.label}</h3>
                <div className="mt-3 space-y-2">
                  {options.map((option) => {
                    const count = counts[option.value] ?? 0;
                    const ratio = responses.length ? (count / responses.length) * 100 : 0;
                    return (
                      <div key={option.value} className="space-y-1">
                        <div className="premium-lesson-caption flex items-center justify-between text-xs">
                          <span>
                            {option.value}. {option.label}
                          </span>
                          <span>{count} 人</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/70">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${ratio}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          });

  const textEntries =
    activity.kind === 'quiz'
      ? activity.questions
          .filter((question) => question.type === 'text')
          .flatMap((question) =>
            responses
              .map((item) => {
                const value = item.response.answers[question.key];
                return typeof value === 'string' && value.trim()
                  ? {
                      label: question.prompt,
                      studentName: item.studentName,
                      submittedAt: item.response.submittedAt,
                      text: value.trim(),
                    }
                  : null;
              })
              .filter(Boolean) as Array<{ label: string; studentName: string; submittedAt: number; text: string }>,
          )
      : activity.fields
          .filter((field) => field.type === 'textarea')
          .flatMap((field) =>
            responses
              .map((item) => {
                const value = item.response.answers[field.key];
                return typeof value === 'string' && value.trim()
                  ? {
                      label: field.label,
                      studentName: item.studentName,
                      submittedAt: item.response.submittedAt,
                      text: value.trim(),
                    }
                  : null;
              })
              .filter(Boolean) as Array<{ label: string; studentName: string; submittedAt: number; text: string }>,
          );

  const wordCloudEntries = buildWordCloudEntries(textEntries);
  const hasAnswer = activity.kind === 'quiz' && activity.questions.some((question) => question.answer);

  return (
    <section className="premium-lesson-panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
          <ClipboardList className="h-4 w-4" />
          教师端汇总
          <span className="premium-lesson-tone-pill premium-tone-cyan px-2.5 py-0.5">{responses.length} 份提交</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {activity.kind === 'quiz' ? (
            <button type="button" onClick={onToggleRelease} className="premium-lesson-action-tone premium-tone-cyan">
              {released ? `已${activity.releaseLabel}` : activity.releaseLabel}
            </button>
          ) : null}
          {hasAnswer ? (
            <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-tone premium-tone-emerald">
              {answerVisible ? '隐藏答案' : '显示答案'}
            </button>
          ) : null}
        </div>
      </div>

      {activity.helper ? <p className="premium-lesson-muted">{activity.helper}</p> : null}

      {activity.kind === 'quiz' && !released ? (
        <div className="premium-lesson-tone-block premium-tone-amber">
          当前题目尚未释放，学生端会看到等待状态。点击“{activity.releaseLabel}”后再开始收集班级作答数据。
        </div>
      ) : null}

      {(activity.kind !== 'quiz' || released) && !responses.length ? (
        <div className="premium-lesson-tone-block premium-tone-slate">暂无学生提交，教师推进到当前环节后，统计会显示在这里。</div>
      ) : null}

      {(activity.kind !== 'quiz' || released) && choiceBlocks.length ? <div className="grid gap-4 xl:grid-cols-2">{choiceBlocks}</div> : null}

      {(activity.kind !== 'quiz' || released) && textEntries.length ? (
        <article className="premium-lesson-surface-elevated px-4 py-4">
          <h3 className="premium-lesson-title text-sm font-medium">词云</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {wordCloudEntries.length ? (
              wordCloudEntries.map(([token, count]) => (
                <span
                  key={token}
                  className="premium-lesson-tone-pill premium-tone-violet shadow-sm"
                  style={{ fontSize: `${12 + Math.min(count, 5) * 2}px` }}
                >
                  {token} × {count}
                </span>
              ))
            ) : (
              <span className="premium-lesson-caption text-sm">暂无可聚合关键词。</span>
            )}
          </div>

          <div className="premium-lesson-surface-muted mt-4 px-4 py-3">
            <button
              type="button"
              onClick={() => setShowTextResponses((prev) => !prev)}
              className="premium-lesson-title flex w-full items-center justify-between gap-3 text-left text-sm font-medium"
            >
              <span>学生回复列表</span>
              <span className="premium-lesson-caption inline-flex items-center gap-1 text-xs">
                默认折叠 · 按提交时间排序
                {showTextResponses ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {showTextResponses ? (
              <div className="mt-3 space-y-3">
                {[...textEntries]
                  .sort((left, right) => left.submittedAt - right.submittedAt)
                  .map((item) => (
                    <div key={`${item.label}-${item.studentName}-${item.submittedAt}`} className="premium-lesson-surface-elevated px-3 py-3 text-sm">
                      <div className="premium-lesson-caption flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em]">
                        <span>{item.studentName}</span>
                        <span>{new Date(item.submittedAt).toLocaleString('zh-CN', { hour12: false })}</span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">{item.label}</div>
                      <div className="mt-2 whitespace-pre-wrap leading-6">{item.text}</div>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        </article>
      ) : null}
    </section>
  );
}

export function LSUMStudentSummaryPanel({
  responses,
}: {
  responses: Record<string, LSUMStepResponse>;
}) {
  const finishedSteps = LSUM_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        我的课堂回收单
      </div>
      <p className="premium-lesson-muted mt-2">当前已记录 {finishedSteps.length} 个环节的个人作答。进入下一单元前，可以先回看自己是如何逐步形成“设计可行域”直觉的。</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {finishedSteps.length ? (
          finishedSteps.map((step) => (
            <div key={step.id} className="premium-lesson-surface-elevated px-4 py-4">
              <div className="premium-lesson-kicker">{step.id}</div>
              <div className="premium-lesson-title mt-2 text-sm font-medium">{step.title}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                已保存 {Object.keys(responses[step.id]?.answers ?? {}).length} 条记录
              </div>
            </div>
          ))
        ) : (
          <div className="premium-lesson-tone-block premium-tone-slate md:col-span-2">还没有个人记录。可以先从前测、草图预测或总结页开始留下痕迹。</div>
        )}
      </div>
    </section>
  );
}

export function LSUMStepAiAssistant({
  step,
  onAiEvent,
}: {
  step: LSUMStepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: 'L-sum',
      stepId: step.id,
      prompts,
    },
    onEvent: onAiEvent,
  });

  useEffect(() => {
    if (!copiedPrompt) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopiedPrompt(null), 1500);
    return () => window.clearTimeout(timer);
  }, [copiedPrompt]);

  if (!prompts.length) {
    return null;
  }

  return (
    <section className="premium-lesson-panel-soft">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4" />
        页内 AI 助手
      </div>
      <p className="premium-lesson-muted mt-2">AI 助手仅围绕当前页面问题展开，不跳转离开课堂页。建议先写自己的判断，再用下面的提示词对照推理链。</p>
      <div className="mt-4 space-y-3">
        {prompts.map((prompt) => (
          <div key={prompt} className="premium-lesson-surface-elevated flex flex-wrap items-start justify-between gap-3 px-4 py-4">
            <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground">{prompt}</pre>
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
        打开控灵助手
      </button>

      <Dialog open={ai.isPanelOpen} onOpenChange={ai.togglePanel}>
        <DialogContent className="max-w-5xl border-border bg-background p-0 text-foreground">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="premium-lesson-title">L-∑ 页内控灵助手</DialogTitle>
            <DialogDescription className="premium-lesson-muted">
              围绕当前页面的可行域判断进行追问，不离开课程页。
            </DialogDescription>
          </DialogHeader>
          <div className="h-[560px] overflow-hidden">
            <InteractiveAIPanel ai={ai} title={`${step.title} · 控灵助手`} onClose={ai.togglePanel} position="right" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
