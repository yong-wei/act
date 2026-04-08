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
  UNIT_3_8_COURSE_TITLE,
  type UNIT_3_8StepDefinition,
  type UNIT_3_8StepResponse,
} from '@/lib/unit-3-8-course';
import {
  AI_COMPARE_FIELDS,
  CARD_SORT_ITEMS,
  HOTSPOT_FIELDS,
  POSTTEST_QUESTIONS,
  PRETEST_QUESTIONS,
  REASON_CHECK_FIELDS,
  SORT_BUCKETS,
  STRUCTURED_COMPARE_FIELDS,
  TRIPLE_MATCH_FIELDS,
  type WorkspaceParameterChange,
} from './workspace';

type Tone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

interface StepSection {
  title: string;
  tone?: Tone;
  body?: string;
  bullets?: string[];
  markdown?: string;
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

export interface UNIT_3_8TeacherResponseItem {
  studentName: string;
  response: UNIT_3_8StepResponse;
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

const STEP_BLUEPRINTS: Record<string, StepBlueprint> = {
  'step-01': {
    kicker: 'Module 3 Map',
    intro: '3-8 要把两条已经展开过的主线重新收回来：3-5 讨论结构变化怎样改动态，3-7 讨论低频补偿怎样改精度，到了这里它们都必须翻成统一的频域判断语言。',
    sections: [
      {
        title: '本课主问题',
        tone: 'cyan',
        bullets: [
          '同样是结构变了，为什么频域里看起来完全不同？',
          '为什么频域不只是判稳，还能读出收益与代价？',
        ],
      },
      {
        title: '边界提醒',
        tone: 'amber',
        bullets: [
          '本课不重讲 Bode / Nyquist 作图基础。',
          '本课不进入模块 4 的完整选型与整定。',
          '本课负责统一翻译、判稳和工程读回。',
        ],
      },
    ],
    prompts: [
      '为什么 3-5 的结构变化线和 3-7 的稳态改善线，最终都要在 3-8 收成同一个频域问题？',
      '3-8 和 3-9、4-1 的关系分别是什么？',
    ],
  },
  'step-02': {
    kicker: 'Fingerprint Gallery',
    intro: '四张图放在一起，不是为了记图，而是为了先打碎一个错误直觉：频域不是只看幅频曲线有没有抬高，真正的区别在于先改写哪一段频率、相位代价落在哪里。',
    sections: [
      {
        title: '两问清单',
        tone: 'rose',
        bullets: [
          '为什么同样是结构变化，首先改写的频率段却不同？',
          '为什么右半平面零点可能“看起来更强”，却不一定更好控？',
        ],
      },
      {
        title: '底线',
        tone: 'amber',
        body: '频域判断必须同时看幅值和相位，不能只看曲线有没有抬高。',
      },
    ],
    note: '四图与两问必须先于判断区完整可见。',
    prompts: [
      '为什么频域分析不能只盯着“幅值有没有抬高”？',
      '为什么右半平面零点常常先暴露相位代价，而不是只给你更快的错觉？',
    ],
  },
  'step-03': {
    kicker: 'Goals And Boundary',
    intro: '本页把 3-8 的四个固定产出一次钉死：会翻译四类结构变化、会做 P/N/Z 判稳、会读裕度、会按三频段读回工程后果。',
    sections: [
      {
        title: '四项目标',
        tone: 'emerald',
        bullets: ['会翻译四类结构变化。', '会做 P/N/Z 判稳。', '会读截止频率与稳定裕度。', '会按三频段读回工程后果。'],
      },
      {
        title: '负责 / 不负责',
        tone: 'slate',
        markdown:
          '| 本课负责 | 本课不负责 |\n| --- | --- |\n| 统一翻译、判稳、裕度、三频段与工程读回 | 作图基础重练、完整补偿参数计算、模块 4 方案排序 |',
      },
    ],
    prompts: [
      '本课四项目标为什么都围绕“统一翻译与判断”展开？',
      '为什么 3-8 不重练作图基础，也不进入完整整定？',
    ],
  },
  'step-04': {
    kicker: 'Pre-Assessment',
    intro: '前测的作用不是拉开成绩，而是先把四类高频误判暴露出来：频段优先级、P/N/Z 顺序、截止频率与带宽、非最小相边界。',
    sections: [
      {
        title: '常见误区',
        tone: 'rose',
        bullets: [
          '频域变化先看频段，不先看结论。',
          'Nyquist 判稳先数 P。',
          '开环读余量，闭环看带宽。',
          '非最小相不能只追更大带宽。',
        ],
      },
      {
        title: '教师观察点',
        tone: 'violet',
        bullets: ['区分首答与重提。', '先看错因分布，再看对错率。'],
      },
    ],
    prompts: [
      '为什么 Nyquist 快判时第一步必须先数 P？',
      '为什么截止频率不能直接等同于闭环带宽？',
    ],
  },
  'step-05': {
    kicker: 'Translation Table',
    intro: '结构变化的频域翻译，先问哪一段频率最先被改写，再问幅值与相位怎么动，最后才看收益与代价落到哪里。',
    sections: [
      {
        title: '频带说明',
        tone: 'cyan',
        bullets: ['增益提升更像整体抬高。', '左半平面零点更偏中频。', '积分 / 滞后优先低频。', '非最小相先暴露相位代价。'],
      },
      {
        title: '判断链',
        tone: 'amber',
        body: '先看哪一段频率，再看幅值和相位，最后看典型收益与代价。',
      },
    ],
    prompts: [
      '为什么积分或滞后优先改写低频，而左半平面零点更偏中频？',
      '为什么非最小相常常先暴露相位代价，而不是先送你免费收益？',
    ],
  },
  'step-06': {
    kicker: 'Nyquist Logic',
    intro: 'Nyquist 判稳不是一句“绕没绕 -1 点”的口号，而是一条从辅助函数、幅角原理到临界点几何意义的完整链条。',
    sections: [
      {
        title: '核心公式',
        tone: 'violet',
        markdown: '$$F(s)=1+L(s)$$\n$$\\Delta \\arg F(s)=2\\pi(Z-P)$$\n$$Z=P-N$$',
      },
      {
        title: '几何含义',
        tone: 'amber',
        body: '闭环稳定问题被改写成“Nyquist 曲线怎样对待 (-1,0)”这一几何问题。',
      },
    ],
    prompts: [
      '为什么闭环稳定问题会被改写成 Nyquist 曲线怎样对待 (-1,0) 这个点？',
      'Z=P-N 不是口号，它背后分别在数什么对象？',
    ],
  },
  'step-07': {
    kicker: 'Quick Check',
    intro: '快速判稳永远不靠图形感觉。固定顺序只有一条：先数 P，再数 N，最后算 Z。',
    sections: [
      {
        title: '边界提醒',
        tone: 'rose',
        body: '右半平面零点不等于右半平面极点。',
      },
      {
        title: '判稳口径',
        tone: 'emerald',
        bullets: ['Nyquist 快判不是“像不像稳”。', '对象、P、N、Z、结论必须同表出现。'],
      },
    ],
    prompts: [
      '为什么系统含右半平面零点时，不能直接把它判成闭环不稳定？',
      'Nyquist 快判里，N 到底是在数什么样的包围关系？',
    ],
  },
  'step-08': {
    kicker: 'Bode Judgment',
    intro: 'Bode 判稳不是另一套规则，而是在对数坐标上读同一临界边界。这里最容易错的，是把截止频率、穿越频率、相角裕度和增益裕度混成一团。',
    sections: [
      {
        title: '指标定义',
        tone: 'violet',
        markdown: '$$|L(j\\omega_c)|=1$$\n$$\\gamma = 180^\\circ + \\angle L(j\\omega_c)$$\n$$G_m = 1 / |L(j\\omega_\\pi)|$$',
      },
      {
        title: '结论句',
        tone: 'amber',
        body: 'Bode 判稳是在对数坐标上读同一临界边界；开环读余量，闭环看带宽。',
      },
    ],
    prompts: [
      '为什么 Bode 判稳不是另一套规则，而是在另一种坐标系上读同一临界边界？',
      '为什么开环截止频率不能直接等同于闭环带宽？',
    ],
  },
  'step-09': {
    kicker: 'Three Bands',
    intro: '三频段分工的核心不是背诵“低频、中频、高频”，而是在任务切换时先判断目标落在哪一段，再决定要不要问 AI。',
    sections: [
      {
        title: '任务切换',
        tone: 'cyan',
        bullets: ['任务 A：尽快跟踪。', '任务 B：优先减小超调并减轻执行器波动。'],
      },
      {
        title: 'AI 边界',
        tone: 'amber',
        body: '先人后 AI；AI 只做对照，不代做判断，不直接给补偿器参数。',
      },
    ],
    prompts: [
      '如果目标是尽快跟踪，为什么常常优先盯住中频而不是只盯低频？',
      '如果目标切到减小超调并减轻执行器波动，优先改写的频带为什么会变？',
    ],
  },
  'step-10': {
    kicker: 'Heading Control Case',
    intro: '航向控制案例要读出的不是“某个参数更大了”，而是中频超前怎样同时把相角裕度、截止频率、带宽、超调和调节时间联动到更合理的位置。',
    sections: [
      {
        title: '指标卡',
        tone: 'slate',
        bullets: ['相角裕度', '截止频率', '带宽', '谐振峰值', '超调量', '调节时间'],
      },
      {
        title: '结论锚点',
        tone: 'emerald',
        body: '本案例主要改写的是中频，不是低频。',
      },
    ],
    prompts: [
      '航向控制案例里，为什么说主要被改写的是中频，而不是低频？',
      '为什么中频超前有机会同时把速度和稳定裕度都往更好的方向推？',
    ],
  },
  'step-11': {
    kicker: 'Platform Case',
    intro: '稳定平台案例要把一个常见误判拆开来看：只降增益确实可能更稳，但它也可能把系统拖得过慢；真正有效的动作是中频定向补角。',
    sections: [
      {
        title: '三方案对照',
        tone: 'slate',
        bullets: ['激进基线', '仅降增益', '超前校正'],
      },
      {
        title: '结论锚点',
        tone: 'rose',
        body: '本案例说明只降增益虽能增大余量，但会过度牺牲速度；中频超前更能兼顾速度与平稳。',
      },
    ],
    prompts: [
      '为什么只降增益虽然可能提高余量，却常常会把速度牺牲得过头？',
      '为什么本案例里真正有效的是中频定向补角，而不是一味压低整体增益？',
    ],
  },
  'step-12': {
    kicker: 'Post-Assessment And Wrap-Up',
    intro: '3-8 的输出不是又多记了几张图，而是拿走一张统一判断地图：结构变化如何翻成频域指纹，Nyquist 与 Bode 怎样共指同一边界，三频段如何拆开收益与代价。',
    sections: [
      {
        title: '四条结论',
        tone: 'violet',
        bullets: [
          '频域是统一翻译器。',
          'Nyquist 与 Bode 描述同一临界边界。',
          '三频段分工帮助拆开收益与代价。',
          '工程判断应先定频带，再看校正。',
        ],
      },
      {
        title: '去向卡',
        tone: 'cyan',
        bullets: ['3-9：稳定—动态—稳态综合映射实验。', '4-1：设计起点，任务表达与约束语言。'],
      },
    ],
    prompts: [
      '为什么频域不是新章节，而是模块 3 各条主线的统一判断地图？',
      '3-9 和 4-1 分别会把这张频域判断地图往哪里继续推进？',
    ],
  },
};

function getStepBlueprint(step: UNIT_3_8StepDefinition) {
  return STEP_BLUEPRINTS[step.id] ?? STEP_BLUEPRINTS['step-01'];
}

function getAiPrompts(step: UNIT_3_8StepDefinition) {
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_3_8StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit38:${step.id}`,
    registryId: 'unit38-inline-ai',
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

function renderMarkdown(markdown: string) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={MARKDOWN_COMPONENTS}>
      {markdown}
    </ReactMarkdown>
  );
}

function InfoSection({ section }: { section: StepSection }) {
  return (
    <div className={`premium-lesson-tone-block ${getToneClass(section.tone)} h-full`}>
      <div className="premium-lesson-title text-sm font-semibold">{section.title}</div>
      {section.body ? <p className="mt-2 text-sm leading-7">{section.body}</p> : null}
      {section.bullets ? (
        <ul className="mt-3 grid gap-2 text-sm leading-7">
          {section.bullets.map((item) => (
            <li key={item} className="ml-4 list-disc">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {section.markdown ? <div className="mt-2">{renderMarkdown(section.markdown)}</div> : null}
    </div>
  );
}

function MediaPanel({
  src,
  alt,
  contain = false,
}: {
  src: string;
  alt: string;
  contain?: boolean;
}) {
  return (
    <div className="premium-lesson-surface-elevated overflow-hidden rounded-3xl">
      <Image
        src={src}
        alt={alt}
        width={1600}
        height={900}
        className={`h-auto w-full ${contain ? 'object-contain bg-background/70' : 'object-cover'}`}
        unoptimized
      />
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  multiline = true,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  if (!multiline) {
    return (
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="premium-lesson-input w-full"
      />
    );
  }

  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="premium-lesson-input min-h-[96px] w-full resize-y"
    />
  );
}

function ChoiceGroup({
  options,
  value,
  onChange,
}: {
  options: readonly ChoiceOption[];
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
          className={`premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-left text-sm transition ${
            value === option.value ? 'ring-2 ring-cyan-400' : ''
          }`}
        >
          <span className="font-medium">{option.value}.</span> {option.label}
        </button>
      ))}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly ChoiceOption[];
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="premium-lesson-select w-full">
      <option value="">请选择</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function getGalleryImages(stepId: string) {
  switch (stepId) {
    case 'step-02':
      return [
        { src: '/course-runtime/lessons/3-8/media/3-8-gain-effect.png', alt: '增益变化图' },
        { src: '/course-runtime/lessons/3-8/media/3-8-zero-effect.png', alt: '左半平面零点变化图' },
        { src: '/course-runtime/lessons/3-8/media/3-8-pole-effect.png', alt: '极点变化图' },
        { src: '/course-runtime/lessons/3-8/media/3-8-rhp-zero-effect.png', alt: '右半平面零点变化图' },
      ];
    case 'step-07':
      return [
        { src: '/course-runtime/lessons/3-8/media/3-8-nyquist-quickcheck.png', alt: 'Nyquist 快速判稳总图' },
        { src: '/course-runtime/lessons/3-8/media/3-8-nyquist-example.png', alt: 'Nyquist 设计型例题图' },
      ];
    case 'step-10':
      return [
        { src: '/course-runtime/lessons/3-8/media/3-8-heading-baseline.png', alt: '航向控制基线 2x2 图' },
        { src: '/course-runtime/lessons/3-8/media/3-8-heading-case.png', alt: '航向控制超前校正 2x2 图' },
      ];
    case 'step-11':
      return [
        { src: '/course-runtime/lessons/3-8/media/3-8-platform-block-diagram.png', alt: '稳定平台控制框图' },
        { src: '/course-runtime/lessons/3-8/media/3-8-platform-baseline.png', alt: '稳定平台激进基线图' },
        { src: '/course-runtime/lessons/3-8/media/3-8-platform-case.png', alt: '稳定平台三方案综合图' },
      ];
    default:
      return [];
  }
}

function getDefaultDraft(step: UNIT_3_8StepDefinition, savedResponse?: UNIT_3_8StepResponse) {
  if (savedResponse) {
    return savedResponse.answers;
  }

  switch (step.pageType) {
    case 'binary_choice':
      return { choice: '' };
    case 'quiz_group':
      return { q1: '', q2: '', q3: '', q4: '' };
    case 'triple_match':
      return Object.fromEntries(TRIPLE_MATCH_FIELDS.map((field) => [field.key, '']));
    case 'reason_check':
      return Object.fromEntries(REASON_CHECK_FIELDS.map((field) => [field.key, '']));
    case 'card_sort':
      return Object.fromEntries(CARD_SORT_ITEMS.map((item) => [item.key, '']));
    case 'hotspot_labeling':
      return Object.fromEntries(HOTSPOT_FIELDS.map((field) => [field.key, '']));
    case 'ai_compare_workspace':
      return Object.fromEntries(AI_COMPARE_FIELDS.map((field) => [field.key, '']));
    case 'structured_compare':
      return Object.fromEntries(
        STRUCTURED_COMPARE_FIELDS[step.id as 'step-10' | 'step-11'].map((field) => [field.key, '']),
      );
    default:
      return {};
  }
}

function supportsAnswerReveal(step: UNIT_3_8StepDefinition) {
  return step.pageType !== 'display' && step.pageType !== 'ai_compare_workspace';
}

function trimText(value: string, max = 64) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function getDistribution(entries: string[]) {
  const counts = new Map<string, number>();
  for (const item of entries) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function getRevealMarkdown(step: UNIT_3_8StepDefinition) {
  switch (step.id) {
    case 'step-02':
      return '正确判断是 **B：还要同时看相位代价和被改写的频段**。';
    case 'step-04':
      return PRETEST_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    case 'step-05':
      return '固定动作是：**先判断结构变化类型，再定位首要频带，最后把典型收益和代价配回去。**';
    case 'step-06':
      return '固定顺序是：**先写辅助函数 -> 先数 P -> 再数 N -> 最后下稳定结论**。';
    case 'step-07':
      return '边界提醒必须保留一句：**右半平面零点不等于右半平面极点。**';
    case 'step-08':
      return '本页核心是：**Bode 判稳是在对数坐标上读同一临界边界；开环读余量，闭环看带宽。**';
    case 'step-10':
      return '本案例的结论锚点是：**本案例主要改写的是中频，不是低频。**';
    case 'step-11':
      return '本页要保留完整结论：**只降增益虽能增大余量，但会过度牺牲速度；中频超前更能兼顾速度与平稳。**';
    case 'step-12':
      return POSTTEST_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    default:
      return '';
  }
}

function summarizeResponses(step: UNIT_3_8StepDefinition, responses: UNIT_3_8TeacherResponseItem[]) {
  switch (step.pageType) {
    case 'binary_choice':
      return getDistribution(responses.map((item) => item.response.answers.choice || '未作答'));
    case 'quiz_group':
      return getDistribution(
        responses.flatMap((item) =>
          Object.entries(item.response.answers)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}:${trimText(value)}`),
        ),
      );
    case 'triple_match':
    case 'reason_check':
    case 'card_sort':
    case 'hotspot_labeling':
    case 'ai_compare_workspace':
    case 'structured_compare':
      return responses.map((item) => [item.studentName, trimText(Object.values(item.response.answers).join(' / '))]);
    default:
      return [];
  }
}

export function UNIT_3_8KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Map</div>
      <div className="premium-lesson-title mt-2 text-lg font-semibold">3-5 -&gt; 3-7 -&gt; 3-8 -&gt; 3-9</div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ['3-5', '零点与动态改善', '先看结构变化怎样改动态。'],
          ['3-7', '稳态误差与低频补偿', '再看低频怎样改精度。'],
          ['3-8', '频域统一判断', '把收益、代价与边界收成同一种语言。'],
          ['3-9', '综合映射实验', '继续做跨域综合与实验读回。'],
        ].map(([label, title, body], index) => (
          <div key={label} className={`premium-lesson-tone-block ${index === 2 ? 'premium-tone-cyan' : 'premium-tone-slate'}`}>
            <div className="premium-lesson-kicker">{label}</div>
            <div className="premium-lesson-title mt-1 text-sm font-semibold">{title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_3_8StepContentPanel({
  step,
  mediaSrc,
}: {
  step: UNIT_3_8StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);
  const galleryImages = getGalleryImages(step.id);
  const useGalleryOnly = galleryImages.length > 0;

  return (
    <section className="premium-lesson-panel px-5 py-5">
      <div className="premium-lesson-kicker">{blueprint.kicker}</div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm leading-7 sm:text-base">{blueprint.intro}</p>

      {!useGalleryOnly && mediaSrc ? (
        <div className="mt-4">
          <MediaPanel src={mediaSrc} alt={step.title} contain={step.id === 'step-08' || step.id === 'step-12'} />
        </div>
      ) : null}

      {galleryImages.length ? (
        <div className={`mt-4 grid gap-4 ${galleryImages.length === 4 ? 'md:grid-cols-2 xl:grid-cols-4' : galleryImages.length === 3 ? 'md:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {galleryImages.map((image) => (
            <MediaPanel key={image.src} src={image.src} alt={image.alt} contain />
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {blueprint.sections.map((section) => (
          <InfoSection key={`${step.id}-${section.title}`} section={section} />
        ))}
      </div>

      {step.id === 'step-05' ? (
        <div className="premium-lesson-tone-block premium-tone-slate mt-4">
          <div className="premium-lesson-title text-sm font-semibold">频域翻译总表</div>
          <div className="mt-3">{renderMarkdown('| 变化类型 | 主要改写频带 | 幅值/相位主变化 | 典型收益 | 典型代价 |\n| --- | --- | --- | --- | --- |\n| 增益提升 | 全频段偏整体抬高 | 幅值整体变化为主 | 精度可能改善 | 裕量可能被压缩 |\n| 左半平面零点 | 中频优先 | 幅值与相位共同重排 | 速度和相角裕度可改善 | 高频噪声代价可能上升 |\n| 积分/滞后 | 低频优先 | 低频幅值重分配 | 精度改善 | 中频附近可能带来代价 |\n| 非最小相 | 相位代价先暴露 | 相位更敏感 | 边界意识增强 | 带宽推进受限 |')}</div>
        </div>
      ) : null}

      {step.id === 'step-08' ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4">
          <div className="premium-lesson-title text-sm font-semibold">指标表</div>
          <div className="mt-3">{renderMarkdown('| 指标 | 读图位置 |\n| --- | --- |\n| 截止频率 $\\omega_c$ | 幅值穿越 0 dB 处 |\n| 相位穿越频率 $\\omega_\\pi$ | 相位穿越 -180° 处 |\n| 相角裕度 $\\gamma$ | 截止频率处读相位余量 |\n| 增益裕度 $G_m$ | 相位穿越频率处读幅值余量 |')}</div>
        </div>
      ) : null}

      {step.id === 'step-10' ? (
        <div className="premium-lesson-tone-block premium-tone-violet mt-4">
          <div className="premium-lesson-title text-sm font-semibold">航向控制指标卡</div>
          <ul className="mt-3 grid gap-2 text-sm leading-7 md:grid-cols-2">
            {['相角裕度', '截止频率', '带宽', '谐振峰值', '超调量', '调节时间'].map((item) => (
              <li key={item} className="ml-4 list-disc">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {step.id === 'step-11' ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4">
          <div className="premium-lesson-title text-sm font-semibold">三方案对照表</div>
          <div className="mt-3">{renderMarkdown('| 方案 | 速度 | 超调 | 余量 | 高频代价 |\n| --- | --- | --- | --- | --- |\n| 激进基线 | 快 | 偏大 | 紧张 | 易被放大 |\n| 仅降增益 | 慢 | 下降 | 增大 | 速度牺牲明显 |\n| 超前校正 | 更快且更稳 | 更受控 | 更合理 | 代价可控 |')}</div>
        </div>
      ) : null}

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

export function UNIT_3_8StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_8StepDefinition;
  savedResponse?: UNIT_3_8StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_8StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(step, savedResponse));

  useEffect(() => {
    setDraft(getDefaultDraft(step, savedResponse));
  }, [savedResponse, step]);

  const submitted = Boolean(savedResponse);
  const locked = !released && !submitted && step.pageType !== 'display';
  const revealMarkdown = getRevealMarkdown(step);

  const updateDraft = (key: string, value: string, source = 'student') => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    onWorkspaceParameterChange?.({ key, value, source });
  };

  const submit = (answers: Record<string, string> = draft) => {
    onSubmit({
      stepId: step.id,
      submittedAt: Date.now(),
      answers,
    });
  };

  if (step.pageType === 'display') {
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
      <p className="premium-lesson-muted mt-2 text-sm">{locked ? '教师尚未释放本页互动，请先阅读上方静态内容。' : '先完成自己的判断，再提交到教师端汇总。'}</p>

      {locked ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">当前互动尚未释放。</div>
      ) : (
        <div className="mt-4 grid gap-4">
          {step.pageType === 'binary_choice' ? (
            <ChoiceGroup
              options={[
                { value: 'A', label: '只要幅频曲线抬高，系统一定更快更好' },
                { value: 'B', label: '还要同时看相位代价和被改写的频段' },
              ]}
              value={draft.choice ?? ''}
              onChange={(value) => updateDraft('choice', value)}
            />
          ) : null}

          {step.pageType === 'quiz_group' ? (
            (step.id === 'step-04' ? PRETEST_QUESTIONS : POSTTEST_QUESTIONS).map((question) => (
              <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                <div className="mt-3">
                  <ChoiceGroup options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} />
                </div>
              </div>
            ))
          ) : null}

          {step.pageType === 'triple_match' ? (
            <div className="grid gap-4 md:grid-cols-3">
              <label className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                <span className="premium-lesson-title text-sm font-medium">结构变化类型</span>
                <div className="mt-3">
                  <SelectField
                    value={draft.changeType ?? ''}
                    onChange={(value) => updateDraft('changeType', value, 'select')}
                    options={[
                      { value: 'gain', label: '增益提升' },
                      { value: 'lhp-zero', label: '左半平面零点' },
                      { value: 'integral-lag', label: '积分 / 滞后' },
                      { value: 'nmp', label: '非最小相' },
                    ]}
                  />
                </div>
              </label>
              <label className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                <span className="premium-lesson-title text-sm font-medium">首要频带</span>
                <div className="mt-3">
                  <SelectField
                    value={draft.band ?? ''}
                    onChange={(value) => updateDraft('band', value, 'select')}
                    options={[
                      { value: 'all', label: '更像整体抬高' },
                      { value: 'mid', label: '中频优先' },
                      { value: 'low', label: '低频优先' },
                      { value: 'phase-cost', label: '相位代价先暴露' },
                    ]}
                  />
                </div>
              </label>
              <label className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                <span className="premium-lesson-title text-sm font-medium">典型收益 / 代价</span>
                <div className="mt-3">
                  <SelectField
                    value={draft.tradeoff ?? ''}
                    onChange={(value) => updateDraft('tradeoff', value, 'select')}
                    options={[
                      { value: 'accuracy-vs-margin', label: '精度可能改善，但裕量可能被压缩' },
                      { value: 'speed-vs-noise', label: '速度改善，但高频噪声代价可能上升' },
                      { value: 'accuracy-vs-mid-cost', label: '低频精度改善，但中频附近可能带来代价' },
                      { value: 'boundary-first', label: '边界意识增强，但带宽推进受限' },
                    ]}
                  />
                </div>
              </label>
            </div>
          ) : null}

          {step.pageType === 'reason_check' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {REASON_CHECK_FIELDS.map((field) => (
                <label key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">{field.label}</span>
                  <div className="mt-3">
                    <SelectField
                      value={draft[field.key] ?? ''}
                      onChange={(value) => updateDraft(field.key, value, 'select')}
                      options={[
                        { value: '1', label: '第 1 步' },
                        { value: '2', label: '第 2 步' },
                        { value: '3', label: '第 3 步' },
                        { value: '4', label: '第 4 步' },
                      ]}
                    />
                  </div>
                </label>
              ))}
            </div>
          ) : null}

          {step.pageType === 'card_sort' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {CARD_SORT_ITEMS.map((item) => (
                <label key={item.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">{item.label}</span>
                  <div className="mt-3">
                    <SelectField
                      value={draft[item.key] ?? ''}
                      onChange={(value) => updateDraft(item.key, value, 'select')}
                      options={SORT_BUCKETS.map((bucket) => ({ value: bucket.key, label: bucket.label }))}
                    />
                  </div>
                </label>
              ))}
            </div>
          ) : null}

          {step.pageType === 'hotspot_labeling' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {HOTSPOT_FIELDS.map((field) => (
                <label key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4 text-sm">
                  <span className="premium-lesson-title text-sm font-medium">{field.label}</span>
                  <div className="mt-3">
                    <SelectField
                      value={draft[field.key] ?? ''}
                      onChange={(value) => updateDraft(field.key, value, 'select')}
                      options={[
                        { value: 'mag-cross', label: '幅值穿越 0 dB 位置' },
                        { value: 'phase-cross', label: '相位穿越 -180° 位置' },
                        { value: 'phase-margin', label: '在截止频率处读相位余量' },
                        { value: 'gain-margin', label: '在相位穿越频率处读幅值余量' },
                      ]}
                    />
                  </div>
                </label>
              ))}
            </div>
          ) : null}

          {step.pageType === 'ai_compare_workspace' ? (
            AI_COMPARE_FIELDS.map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.label} />
                </div>
              </div>
            ))
          ) : null}

          {step.pageType === 'structured_compare' ? (
            STRUCTURED_COMPARE_FIELDS[step.id as 'step-10' | 'step-11'].map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <TextInput value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value)} placeholder={field.label} />
                </div>
              </div>
            ))
          ) : null}

          <button type="button" onClick={() => submit()} className="premium-lesson-action-primary">
            {submitted ? '重新提交本页作答' : '提交本页作答'}
          </button>
        </div>
      )}

      <div className="mt-4">
        <SubmissionStatus
          submitted={submitted}
          submittedText="已提交本页作答，教师端将看到你的当前答案。"
          idleText="尚未提交本页作答。"
        />
      </div>

      {answerVisible && revealMarkdown ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4">
          <div className="premium-lesson-title text-sm font-semibold">参考答案</div>
          <div className="mt-2">{renderMarkdown(revealMarkdown)}</div>
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_3_8TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_3_8StepDefinition;
  responses: UNIT_3_8TeacherResponseItem[];
  released: boolean;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const summary = useMemo(() => summarizeResponses(step, responses), [responses, step]);
  const canReveal = supportsAnswerReveal(step);

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
            disabled={!canReveal}
            className="premium-lesson-action-primary disabled:opacity-40"
          >
            {answerVisible ? '隐藏参考答案' : '显示参考答案'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {summary.length ? (
          summary.slice(0, 12).map(([label, value]) => (
            <div key={`${label}-${value}`} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm">
              <span>{label}</span>
              <span className="premium-lesson-caption">{typeof value === 'number' ? `${value} 人` : value}</span>
            </div>
          ))
        ) : (
          <div className="premium-lesson-muted text-sm">本页暂无学生提交。</div>
        )}
      </div>
    </section>
  );
}

export function UNIT_3_8StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_3_8StepResponse>;
}) {
  const completed = Object.keys(responses).length;
  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-lg font-semibold">学习收束</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已经提交了 {completed} 个环节的作答。本课真正要带走的是一张统一判断地图：先把结构变化翻成频域指纹，再用 Nyquist 或 Bode 读同一临界边界，最后按三频段拆开收益、速度和代价。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          '频域是统一翻译器。',
          'Nyquist 与 Bode 描述同一临界边界。',
          '三频段分工帮助拆开收益与代价。',
          '工程判断应先定频带，再看校正。',
        ].map((item) => (
          <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_3_8StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_3_8StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '3-8',
      stepId: step.id,
      prompts,
    },
    onEvent: onAiEvent,
  });

  useEffect(() => {
    if (!copiedPrompt) return undefined;
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
      <p className="premium-lesson-muted mt-2 text-sm">先完成自己的频带判断，再使用下面的提示词与页内 AI 对照。AI 只核对“目标 -&gt; 频带 -&gt; 读回”的链条，不替你跳过第一步。</p>

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
        向 AI 核对推理链
      </button>

      <Dialog open={ai.isPanelOpen} onOpenChange={ai.togglePanel}>
        <DialogContent className="max-w-5xl border-border bg-background p-0 text-foreground">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>{UNIT_3_8_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription>当前只围绕 {step.title} 回答问题，帮助你核对“结构变化 -&gt; 频带 -&gt; 判稳 / 工程读回”的推理链。</DialogDescription>
          </DialogHeader>
          <div className="h-[75vh]">
            <InteractiveAIPanel ai={ai} title={`${step.title} · AI 对照`} position="right" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
