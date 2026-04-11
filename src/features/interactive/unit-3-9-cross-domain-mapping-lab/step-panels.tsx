'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveConfig } from '@/features/interactive/types';
import {
  UNIT_3_9_COURSE_TITLE,
  type UNIT_3_9StepDefinition,
  type UNIT_3_9StepResponse,
} from '@/lib/unit-3-9-course';
import {
  MATRIX_WORKSPACE_COLUMNS,
  MATRIX_WORKSPACE_FIELDS,
  MATRIX_WORKSPACE_ROWS,
  POSTTEST_QUESTIONS,
  PRETEST_QUESTIONS,
  REASON_CHECK_OPTIONS,
  STRUCTURED_COMPARE_FIELDS,
  TABLE_BUILDER_COLUMNS,
  TABLE_BUILDER_FIELDS,
  TABLE_BUILDER_ROWS,
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

export interface UNIT_3_9TeacherResponseItem {
  studentName: string;
  response: UNIT_3_9StepResponse;
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
    kicker: 'Unified Object',
    intro:
      '3-9 的第一动作不是报控制器名称，而是把同一对象固定下来，再按“结构变化 -> 根轨迹第一信号 -> 时域结果 -> 频域解释 -> 任务标签”的顺序统一比较。',
    sections: [
      {
        title: '统一对象',
        tone: 'cyan',
        markdown:
          '$$P(s)=\\frac{0.01715}{s(s+0.1)(s+2.14375)}$$\n$$C_0(s)=2.25$$\n$$L_0(s)=C_0(s)P(s)=\\frac{0.0385875}{s(s+0.1)(s+2.14375)}$$',
      },
      {
        title: '比较顺序',
        tone: 'emerald',
        markdown:
          '$$\\text{结构变化} \\rightarrow \\text{根轨迹第一信号} \\rightarrow \\text{时域结果} \\rightarrow \\text{频域解释} \\rightarrow \\text{任务标签}$$',
      },
      {
        title: '边界提醒',
        tone: 'amber',
        bullets: ['本课只做首轮任务判断。', '不提前进入模块 4 的完整指标与可行域设计。'],
      },
    ],
    prompts: [
      '为什么模块 3 的出口课必须先固定同一个对象，再比较不同机制线？',
      '为什么 3-9 只做首轮任务判断，而不直接给完整设计方案？',
    ],
  },
  'step-02': {
    kicker: 'Pre-Assessment',
    intro:
      '前测的作用不是先猜控制器，而是把任务标签、机制线和收益/代价判断顺序钉死。四道题都围绕“先贴标签，再写机制线”这一约束展开。',
    sections: [
      {
        title: '三类任务标签',
        tone: 'violet',
        bullets: ['更偏动态改善', '更偏稳态改善', '更偏综合折中'],
      },
      {
        title: '固定提醒',
        tone: 'rose',
        body: '回答时先写任务标签，再写可能的机制线；不要一上来就报 PI、滞后或零点线。',
      },
    ],
    prompts: [
      '为什么在 3-9 里要先写任务标签，再谈机制线？',
      '如果一开始就报控制器名称，最容易漏掉哪一层判断？',
    ],
  },
  'step-03': {
    kicker: 'Baseline Anchor',
    intro:
      '基准版本是所有对照的统一锚点。本页先把“综合折中基线”钉住，再写任务标签、第一风险点和最先观察的域。',
    sections: [
      {
        title: '指标表要求',
        tone: 'slate',
        bullets: ['闭环极点', '超调量', '调节时间', '相角裕度', '增益裕度', '单位斜坡误差'],
      },
      {
        title: '结论锚点',
        tone: 'emerald',
        body: '基准版本更像综合折中基线，是后续所有补强路径的统一比较起点。',
      },
    ],
    prompts: [
      '为什么所有补强版本都必须先回到基准版本这个统一锚点？',
      '面对基准版本时，第一风险点应该优先从哪个域开始写，为什么？',
    ],
  },
  'step-04': {
    kicker: 'Zero-Line Variant',
    intro:
      '零点线补强是 3-9 中“更偏动态改善”的典型样例。页面必须同时保留控制器公式、2x2 图、关键指标表与收益/代价判断区。',
    sections: [
      {
        title: '控制器',
        tone: 'cyan',
        markdown: '$$C_z(s)=2.25\\frac{12.5s+1}{2s+1}$$',
      },
      {
        title: '固定判断',
        tone: 'amber',
        body: '这一版优先回答“更快一些该怎么办”，但不直接承担“更准一些”的任务。',
      },
    ],
    prompts: [
      '零点线补强为什么更像“更快一些”的样例，而不是同时解决更准问题？',
      '如果只写零点线带来的动态收益，不写代价域，会漏掉什么判断？',
    ],
  },
  'step-05': {
    kicker: 'Integral Family',
    intro:
      '积分家族页面不是只看“误差是不是更小了”，而是让低频收益、中频代价和任务标签在同一张矩阵里一起暴露。',
    sections: [
      {
        title: '三组控制器',
        tone: 'violet',
        markdown:
          '$$C_{i1}(s)=2.25\\left(1+\\frac{1}{200s}\\right)$$\n$$C_{i2}(s)=2.25\\left(1+\\frac{1}{40s}\\right)$$\n$$C_{ic}(s)=2.25\\left(1+\\frac{1}{40s}\\right)\\frac{20s+1}{2s+1}$$',
      },
      {
        title: '矩阵列',
        tone: 'emerald',
        bullets: MATRIX_WORKSPACE_COLUMNS.map((column) => column.label),
      },
    ],
    prompts: [
      '为什么积分路线既要看低频收益，也要单独回看中频和动态代价？',
      '积分校正为什么能说明“积分路线也需要中频整理”这件事？',
    ],
  },
  'step-06': {
    kicker: 'Lag Comparison',
    intro:
      '滞后对照页的重点不是把滞后当成“更弱一点的积分”，而是压实“压小误差”和“压到零”属于两种不同的稳态改善语言。',
    sections: [
      {
        title: '控制器',
        tone: 'cyan',
        markdown: '$$C_{\\mathrm{lag}}(s)=4.5\\frac{40s+1}{80s+1}$$',
      },
      {
        title: '固定对照维度',
        tone: 'slate',
        bullets: ['是否改型别', '误差改善程度', '中频代价', '调节时间变化'],
      },
      {
        title: '固定结论',
        tone: 'rose',
        body: '滞后能压小误差，但不等于像积分那样把某类误差直接压到零。',
      },
    ],
    prompts: [
      '为什么滞后不能直接等同于“更弱一点的积分”？',
      '为什么“误差压小”和“误差结构性压到零”必须分开判断？',
    ],
  },
  'step-07': {
    kicker: 'Mapping Workspace',
    intro:
      '综合映射工作区是模块 3 的出口产物。每个版本都要把结构变化、根轨迹第一信号、时域结果、频域解释、任务标签和主要风险写回同一套表头。',
    sections: [
      {
        title: '固定表头',
        tone: 'emerald',
        bullets: TABLE_BUILDER_COLUMNS.map((column) => column.label),
      },
      {
        title: '风险提醒',
        tone: 'amber',
        body: '每个版本都要写出最先暴露收益和代价的域，不能只写“更好了”却不写代价与边界。',
      },
    ],
    prompts: [
      '为什么模块 3 的出口必须把不同路线都写回同一套结构变化/三域读回/任务标签表头？',
      '如果综合映射表只写收益不写风险，会让 4-1 的任务表达丢掉什么信息？',
    ],
  },
  'step-08': {
    kicker: 'Module 4 Entry',
    intro:
      '3-9 的终点不是直接定参数，而是把问题写对。这里保留三类入口判断、后测题组和去向卡，把模块 3 的出口压成模块 4 的输入。',
    sections: [
      {
        title: '三类入口判断',
        tone: 'cyan',
        bullets: ['我希望它更快', '我希望它更准', '我希望既快又准但不能太冒进'],
      },
      {
        title: '去向卡',
        tone: 'violet',
        body: '3-9 输出首轮任务判断；4-1 才进入性能指标、约束与可行域。',
      },
    ],
    prompts: [
      '为什么 3-9 的终点是“先问对问题”，而不是直接给完整选型和整定？',
      '把“更快/更准/兼顾稳与快”带到 4-1 后，下一步会被改写成什么样的任务表达？',
    ],
  },
};

function getStepBlueprint(step: UNIT_3_9StepDefinition) {
  return STEP_BLUEPRINTS[step.id] ?? STEP_BLUEPRINTS['step-01'];
}

function getAiPrompts(step: UNIT_3_9StepDefinition) {
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_3_9StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit39:${step.id}`,
    registryId: 'unit39-inline-ai',
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

function getGalleryImages(stepId: string) {
  switch (stepId) {
    case 'step-05':
      return [
        { src: '/course-runtime/lessons/3-9/media/3-9-integral-weak-quad.png', alt: '弱积分 2x2 对照图' },
        { src: '/course-runtime/lessons/3-9/media/3-9-integral-strong-quad.png', alt: '强积分 2x2 对照图' },
        { src: '/course-runtime/lessons/3-9/media/3-9-integral-corrected-quad.png', alt: '积分校正 2x2 对照图' },
      ];
    default:
      return [];
  }
}

function getDefaultDraft(step: UNIT_3_9StepDefinition, savedResponse?: UNIT_3_9StepResponse) {
  if (savedResponse) {
    return savedResponse.answers;
  }

  switch (step.pageType) {
    case 'quiz_group':
      return { q1: '', q2: '', q3: '', q4: '' };
    case 'structured_compare':
      return Object.fromEntries(
        STRUCTURED_COMPARE_FIELDS[step.id as 'step-03' | 'step-04'].map((field) => [field.key, '']),
      );
    case 'matrix_workspace':
      return Object.fromEntries(MATRIX_WORKSPACE_FIELDS.map((field) => [field.key, '']));
    case 'reason_check':
      return { choice: '' };
    case 'table_builder':
      return Object.fromEntries(TABLE_BUILDER_FIELDS.map((field) => [field.key, '']));
    default:
      return {};
  }
}

function supportsAnswerReveal(step: UNIT_3_9StepDefinition) {
  return step.pageType === 'quiz_group' || step.pageType === 'structured_compare' || step.pageType === 'reason_check';
}

function trimText(value: string, max = 48) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function getDistribution(entries: string[]) {
  const counts = new Map<string, number>();
  for (const item of entries) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function getRevealMarkdown(step: UNIT_3_9StepDefinition) {
  switch (step.id) {
    case 'step-02':
      return PRETEST_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    case 'step-03':
      return '基准版本要保留 **综合折中基线** 这一锚点，并同时写出任务标签、第一风险点和首先观察的域。';
    case 'step-04':
      return '零点线补强应写成 **更偏动态改善的样例**，不能把“更快一些”误写成同时解决更准问题。';
    case 'step-06':
      return '固定结论是：**滞后更接近压小有限误差，积分更接近把某类误差结构性压到零。**';
    case 'step-08':
      return POSTTEST_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    default:
      return '';
  }
}

function summarizeResponses(step: UNIT_3_9StepDefinition, responses: UNIT_3_9TeacherResponseItem[]) {
  switch (step.pageType) {
    case 'quiz_group':
      return getDistribution(
        responses.flatMap((item) =>
          Object.entries(item.response.answers)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}:${trimText(value)}`),
        ),
      );
    case 'structured_compare':
      return getDistribution(
        responses.flatMap((item) =>
          Object.entries(item.response.answers)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}:${trimText(value)}`),
        ),
      );
    case 'matrix_workspace':
    case 'table_builder':
      return getDistribution(
        responses.flatMap((item) =>
          Object.entries(item.response.answers)
            .filter(([, value]) => value)
            .map(([key]) => key),
        ),
      );
    case 'reason_check':
      return getDistribution(responses.map((item) => item.response.answers.choice || '未作答'));
    default:
      return [];
  }
}

function renderSummaryList(summary: Array<[string, number]>) {
  if (!summary.length) {
    return <div className="premium-lesson-muted text-sm">暂无学生作答。</div>;
  }

  return (
    <div className="mt-4 grid gap-2">
      {summary.map(([label, count]) => (
        <div key={label} className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">
          <div className="font-medium">{label}</div>
          <div className="premium-lesson-muted mt-1 text-xs">出现 {count} 次</div>
        </div>
      ))}
    </div>
  );
}

function MatrixPreview({ draft }: { draft: Record<string, string> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-background/55">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-background/70">
          <tr>
            <th className="border-b border-border/60 px-3 py-2 font-medium text-foreground/80">版本</th>
            {MATRIX_WORKSPACE_COLUMNS.map((column) => (
              <th key={column.key} className="border-b border-border/60 px-3 py-2 font-medium text-foreground/80">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIX_WORKSPACE_ROWS.map((row) => (
            <tr key={row.key}>
              <td className="border-b border-border/40 px-3 py-2 font-medium">{row.label}</td>
              {MATRIX_WORKSPACE_COLUMNS.map((column) => (
                <td key={`${row.key}.${column.key}`} className="border-b border-border/40 px-3 py-2 align-top">
                  {draft[`${row.key}.${column.key}`] || '待填写'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MappingTablePreview({ draft }: { draft: Record<string, string> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-background/55">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-background/70">
          <tr>
            <th className="border-b border-border/60 px-3 py-2 font-medium text-foreground/80">版本</th>
            {TABLE_BUILDER_COLUMNS.map((column) => (
              <th key={column.key} className="border-b border-border/60 px-3 py-2 font-medium text-foreground/80">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_BUILDER_ROWS.map((row) => (
            <tr key={row.key}>
              <td className="border-b border-border/40 px-3 py-2 font-medium">{row.label}</td>
              {TABLE_BUILDER_COLUMNS.map((column) => (
                <td key={`${row.key}.${column.key}`} className="border-b border-border/40 px-3 py-2 align-top">
                  {draft[`${row.key}.${column.key}`] || '待填写'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UNIT_3_9KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Exit Map</div>
      <div className="premium-lesson-title mt-2 text-lg font-semibold">3-8 -&gt; 3-9 -&gt; 4-1</div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          {
            title: '3-8',
            body: '把结构变化翻成频域语言，建立统一判断地图。',
          },
          {
            title: '3-9',
            body: '把稳定、动态、稳态三条机制线写回同一张综合映射表。',
          },
          {
            title: '4-1',
            body: '把“更快 / 更准 / 综合折中”改写成任务书、约束与可行域。',
          },
        ].map((item) => (
          <div key={item.title} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
            <div className="premium-lesson-title text-sm font-semibold">{item.title}</div>
            <p className="premium-lesson-muted mt-2 text-sm leading-7">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_3_9StepContentPanel({
  step,
  mediaSrc,
}: {
  step: UNIT_3_9StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);
  const galleryImages = getGalleryImages(step.id);

  return (
    <section className="premium-lesson-panel px-5 py-5">
      <div className="premium-lesson-kicker">{blueprint.kicker}</div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm leading-7 sm:text-base">{blueprint.intro}</p>

      {mediaSrc ? (
        <div className="mt-4">
          <MediaPanel src={mediaSrc} alt={step.title} contain={step.id === 'step-08'} />
        </div>
      ) : null}

      {galleryImages.length ? (
        <div className={`mt-4 grid gap-4 ${galleryImages.length === 3 ? 'md:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {galleryImages.map((image) => (
            <MediaPanel key={image.src} src={image.src} alt={image.alt} contain />
          ))}
        </div>
      ) : null}

      <div className={`mt-4 grid gap-4 ${blueprint.sections.length > 1 ? 'lg:grid-cols-2' : ''}`}>
        {blueprint.sections.map((section) => (
          <InfoSection key={section.title} section={section} />
        ))}
      </div>

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4">{blueprint.note}</div> : null}
    </section>
  );
}

export function UNIT_3_9StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_9StepDefinition;
  savedResponse?: UNIT_3_9StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_9StepResponse) => void;
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
          {step.pageType === 'quiz_group'
            ? (step.id === 'step-02' ? PRETEST_QUESTIONS : POSTTEST_QUESTIONS).map((question) => (
                <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                  <div className="mt-3">
                    <ChoiceGroup options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} />
                  </div>
                </div>
              ))
            : null}

          {step.pageType === 'structured_compare'
            ? STRUCTURED_COMPARE_FIELDS[step.id as 'step-03' | 'step-04'].map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="mt-3">
                    <TextInput
                      value={draft[field.key] ?? ''}
                      onChange={(value) => updateDraft(field.key, value)}
                      placeholder={`填写${field.label}`}
                    />
                  </div>
                </div>
              ))
            : null}

          {step.pageType === 'matrix_workspace' ? (
            <>
              <MatrixPreview draft={draft} />
              {MATRIX_WORKSPACE_ROWS.map((row) => (
                <div key={row.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{row.label}</div>
                  <div className="mt-3 grid gap-3">
                    {MATRIX_WORKSPACE_COLUMNS.map((column) => {
                      const fieldKey = `${row.key}.${column.key}`;
                      return (
                        <div key={fieldKey}>
                          <div className="premium-lesson-muted text-xs">{column.label}</div>
                          <div className="mt-2">
                            <TextInput
                              value={draft[fieldKey] ?? ''}
                              onChange={(value) => updateDraft(fieldKey, value)}
                              placeholder={`填写${row.label}的${column.label}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : null}

          {step.pageType === 'reason_check' ? (
            <ChoiceGroup options={REASON_CHECK_OPTIONS} value={draft.choice ?? ''} onChange={(value) => updateDraft('choice', value)} />
          ) : null}

          {step.pageType === 'table_builder' ? (
            <>
              <MappingTablePreview draft={draft} />
              {TABLE_BUILDER_ROWS.map((row) => (
                <div key={row.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{row.label}</div>
                  <div className="mt-3 grid gap-3">
                    {TABLE_BUILDER_COLUMNS.map((column) => {
                      const fieldKey = `${row.key}.${column.key}`;
                      return (
                        <div key={fieldKey}>
                          <div className="premium-lesson-muted text-xs">{column.label}</div>
                          <div className="mt-2">
                            <TextInput
                              value={draft[fieldKey] ?? ''}
                              onChange={(value) => updateDraft(fieldKey, value)}
                              placeholder={`填写${row.label}的${column.label}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => submit()} className="premium-lesson-action-primary">
              {submitted ? '重新提交' : '提交本页作答'}
            </button>
          </div>
        </div>
      )}

      {submitted ? (
        <div className="mt-4">
          <SubmissionStatus submitted idleText="已记录你的作答，可按需修改后重新提交。" />
        </div>
      ) : null}

      {answerVisible && revealMarkdown ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4">{renderMarkdown(revealMarkdown)}</div>
      ) : null}
    </section>
  );
}

export function UNIT_3_9StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_3_9StepResponse>;
}) {
  const completed = Object.keys(responses).length;
  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-lg font-semibold">学习收束</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已经提交了 {completed} 个环节的作答。本课真正要带走的是一张统一的综合映射表：先看结构变化，再看根轨迹第一信号、时域结果和频域解释，最后把任务标签与风险一起写清楚。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          '基准版本是统一锚点。',
          '零点线更偏动态改善。',
          '积分与滞后都走稳态改善线，但分工不同。',
          '3-9 的终点是先问对问题，再把问题带到 4-1。',
        ].map((item) => (
          <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_3_9TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_3_9StepDefinition;
  responses: UNIT_3_9TeacherResponseItem[];
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
            className="premium-lesson-action-secondary disabled:opacity-40"
          >
            {answerVisible ? '隐藏参考答案' : '显示参考答案'}
          </button>
        </div>
      </div>
      {renderSummaryList(summary)}
    </section>
  );
}

export function UNIT_3_9StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_3_9StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '3-9',
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
      <p className="premium-lesson-muted mt-2 text-sm">
        先完成自己的任务标签、收益域/代价域或综合映射判断，再使用下面的提示词和页内 AI 对照。AI 只检查链条是否连贯，不代替你完成整页答案。
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

      <div className="mt-4">
        <InteractiveAIPanel ai={ai} title={`${step.title} · AI 对照`} position="right" />
      </div>
    </section>
  );
}
