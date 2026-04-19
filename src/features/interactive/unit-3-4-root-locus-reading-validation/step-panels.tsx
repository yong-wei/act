'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import {
  getUNIT_3_4PageContract,
  UNIT_3_4_LESSON_STEPS,
  UNIT_3_4_STAGE_LABEL,
  type UNIT_3_4PageContract,
  type UNIT_3_4StepDefinition,
  type UNIT_3_4StepResponse,
} from '@/lib/unit-3-4-course';
import {
  ACTIVITY_CARD_FIELDS,
  BINARY_CHOICE_OPTIONS,
  HOTSPOT_LABEL_FIELDS,
  POST_QUIZ_QUESTIONS,
  PRE_QUIZ_QUESTIONS,
  READING_SEQUENCE_OPTIONS,
  TRIPLE_MATCH_FIELDS,
  WORKED_EXAMPLE_FIELDS,
  type ActivityCardField,
  type ChoiceOption,
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
}

interface ProgressiveRevealData {
  promptTitle: string;
  promptBody: string[];
  steps: string[];
}

export interface UNIT_3_4TeacherResponseItem {
  studentName: string;
  response: UNIT_3_4StepResponse;
}

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function getStepBlueprint(step: UNIT_3_4StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Map',
        intro: '3-4 接在 3-3 之后，不再重讲法则证明，而是把法则压成可以直接执行的判断动作链。',
        sections: [
          {
            title: '路径定位',
            tone: 'cyan',
            bullets: ['3-3：建立根轨迹法则。', '3-4：读图、窗口、换算、三域与广义参数。', '3-5：才进入结构改变。'],
          },
          {
            title: '本课边界',
            tone: 'rose',
            bullets: ['不重讲 3-3 的法则证明。', '不进入零点、PD 与模块 4 设计任务。'],
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Goal',
        intro: '本课不是再听一遍法则，而是把“会背法则”推进成“会按图做判断”。',
        sections: [
          {
            title: '三张记录表',
            tone: 'emerald',
            bullets: ['关键节点读图记录', '参数窗口判断表', '对象化验证记录'],
          },
          {
            title: '判断链',
            tone: 'amber',
            bullets: ['关键节点读图', '参数窗口判断', '对象化三域验证', '广义参数验证'],
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Versions',
        intro: '对象、记号和 A/B/C 三版本必须同页出现，才能暴露“稳定=可用”的第一误判。',
        sections: [
          {
            title: '对象与记号',
            tone: 'violet',
            formula: 'G(s)=\\frac{0.01715K}{s(s+0.1)(s+2.14375)},\\qquad k=0.01715K',
          },
          {
            title: '三个版本',
            tone: 'cyan',
            bullets: ['A：保守、慢。', 'B：更像参考工作点。', 'C：仍稳定，但风险感更强。'],
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Workflow',
        intro: '固定读图顺序：先骨架，再关键节点，再窗口，再后果。',
        sections: [
          {
            title: '误判提醒',
            tone: 'amber',
            body: '不能因为某个点“看起来顺眼”，就跳过前两步直接说哪个版本更好。',
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Evidence',
        intro: '关键节点证据板：分离点、虚轴交点与参考工作点 B 必须回到同一张主图。',
        sections: [
          {
            title: '三条关键证据',
            tone: 'cyan',
            bullets: [
              '分离点把“实极点主导”与“共轭极点主导”分开。',
              '虚轴交点给出稳定窗口上界。',
              '参考工作点 B 既越过分离点，又远离虚轴边界。',
            ],
          },
        ],
      };
    case 'step-06':
      return {
        kicker: 'Record',
        intro: '关键节点读图记录：把主图证据写成一句工程判断。',
        sections: [
          {
            title: '写法提醒',
            tone: 'emerald',
            bullets: ['必须同时写位置与后果。', '不能只剩“更靠左”或“更危险”这样的碎句。'],
          },
        ],
      };
    case 'step-07':
      return {
        kicker: 'Windows',
        intro: '稳定窗口不等于可接受窗口；它们回答的是两层不同问题，不能混写。',
        sections: [
          {
            title: '两层窗口语言',
            tone: 'amber',
            bullets: ['稳定窗口：还能不能工作。', '可接受窗口：值不值得继续推进。'],
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Worked Example',
        intro: '增益换算链：从图上的 k 落回工程参数 K。',
        sections: [
          {
            title: '换算关系',
            tone: 'violet',
            formula: 'k = 0.01715K,\\qquad K=\\frac{k}{0.01715}',
          },
        ],
      };
    case 'step-09':
      return {
        kicker: 'Three Domains',
        intro: '为什么必须三域互证：主图、时域、频域先并排对齐。',
        sections: [
          {
            title: '三域角色',
            tone: 'cyan',
            bullets: [
              '主图回答关键节点、极点迁移和窗口边界。',
              '时域回答快慢、振荡、拖尾与参考工作点后果。',
              '频域回答带宽、相位变化、高频差异与风险暴露。',
            ],
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'Time Domain',
        intro: '时域验证：版本 B 为什么能够作为参考工作点。',
        sections: [
          {
            title: '时域读法',
            tone: 'emerald',
            bullets: ['先看快慢与振荡。', '再看拖尾与近似误差。', '最后写出“可信但有限”的结论。'],
          },
        ],
      };
    case 'step-11':
      return {
        kicker: 'Frequency Domain',
        intro: '频域验证：低中频近似成立，高频差异仍要单列记录。',
        sections: [
          {
            title: '频域结论',
            tone: 'amber',
            bullets: ['低中频可支撑近似结论。', '高频差异不能被当作“无关紧要”。'],
          },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Dual Evidence',
        intro: '版本 C 的收益与代价：Bode 与航迹不能只保留一边。',
        sections: [
          {
            title: '双证据要求',
            tone: 'rose',
            bullets: ['先写收益。', '再写代价。', '两句话都必须绑定到具体证据。'],
          },
        ],
      };
    case 'step-13':
      return {
        kicker: 'Generalized Root Locus',
        intro: '广义根轨迹入口：局部反馈系数 a 为什么不是“再调一次 K”。',
        sections: [
          {
            title: '新问题',
            tone: 'violet',
            body: '当 a 进入局部反馈结构时，变的不只是数值，而是对象和特征方程的写法。',
          },
        ],
      };
    case 'step-14':
      return {
        kicker: 'Rewrite',
        intro: '改写链：从给定局部反馈结构走到等效根轨迹。',
        sections: [
          {
            title: '法则不变，对象先改写',
            tone: 'cyan',
            bullets: ['先写局部反馈结构。', '再写新特征方程。', '最后把它改成等效根轨迹问题。'],
          },
        ],
      };
    case 'step-15':
      return {
        kicker: 'Parameter Window',
        intro: '非增益参数窗口记录：a 从 0 到 1 怎样改写主导极点。',
        sections: [
          {
            title: '广义根轨迹',
            tone: 'emerald',
            bullets: ['比较基线。', '写实践窗口。', '补边界提醒。'],
          },
        ],
      };
    case 'step-16':
      return {
        kicker: 'Posttest',
        intro: '后测：读图、换算、三域与广义参数是否已经成链。',
        sections: [
          {
            title: '本页任务',
            tone: 'amber',
            body: '只检查完整判断链，不重新引入新的结构设计任务。',
          },
        ],
      };
    case 'step-17':
      return {
        kicker: 'Wrap-up',
        intro: '收束与去向：沿既有结构分析的能力与边界。',
        sections: [
          {
            title: '五条带走',
            tone: 'cyan',
            bullets: ['会按图抓关键节点。', '会区分稳定与可接受窗口。', '会完成 k 到 K 换算。', '会用三域证据闭合判断。', '知道 a 不是再调一次 K。'],
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

function getProgressiveRevealData(stepId: string): ProgressiveRevealData | null {
  switch (stepId) {
    case 'step-08':
      return {
        promptTitle: '增益换算题面',
        promptBody: [
          '已知参考工作点 B 在主图上对应的根轨迹增益为 k=0.0104。',
          '请把图上读到的 k 换算为工程控制器增益 K，并说明为什么不能把 k 直接当成 K。',
        ],
        steps: [
          '先固定关系式：k=0.01715K，所以 K=k/0.01715。',
          '再代入 B 点数值：K=0.0104/0.01715≈0.6064。',
          '最后补一句解释：图上先读到的是根轨迹增益，不是工程控制器增益。',
        ],
      };
    case 'step-14':
      return {
        promptTitle: '广义根轨迹改写题面',
        promptBody: [
          '已知局部反馈系数 a 进入对象内环，需要把该结构改写成可继续使用根轨迹法则的等效问题。',
          '请说明为什么这里不是“再调一次 K”，而是对象先被改写。',
        ],
        steps: [
          '先写局部反馈后的特征方程：B(s)+aA(s)=0。',
          '再改写为 1+aA(s)/B(s)=0，把 A(s)/B(s) 视作等效开环对象。',
          '最后指出：根轨迹法则仍然是 180° 条件，只是先换了要研究的对象。',
        ],
      };
    default:
      return null;
  }
}

function parseList(value?: string) {
  return String(value ?? '')
    .split('||')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDefaultDraft(step: UNIT_3_4StepDefinition, savedResponse?: UNIT_3_4StepResponse) {
  if (savedResponse) {
    return savedResponse.answers;
  }

  switch (step.pageType) {
    case 'quiz_group':
      return Object.fromEntries((step.id === 'step-03' ? PRE_QUIZ_QUESTIONS : POST_QUIZ_QUESTIONS).map((question) => [question.key, '']));
    case 'sequence_sort':
      return { sortOrder: READING_SEQUENCE_OPTIONS.map((item) => item.value).join('||') };
    case 'hotspot_labeling':
      return Object.fromEntries(HOTSPOT_LABEL_FIELDS.map((field) => [field.key, '']));
    case 'activity_cards':
      return Object.fromEntries((ACTIVITY_CARD_FIELDS[step.id] ?? []).map((field) => [field.key, '']));
    case 'worked_example_workspace':
      return Object.fromEntries((WORKED_EXAMPLE_FIELDS[step.id] ?? []).map((field) => [field.key, '']));
    case 'triple_match':
      return Object.fromEntries(TRIPLE_MATCH_FIELDS.map((field) => [field.key, '']));
    case 'binary_choice':
      return { choice: '' };
    default:
      return {};
  }
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
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
          className={`premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-left text-sm ${
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

function InfoSection({ section }: { section: StepSection }) {
  return (
    <div className={`premium-lesson-tone-block ${getToneClass(section.tone)}`}>
      <div className="premium-lesson-title text-sm font-semibold">{section.title}</div>
      {section.body ? <div className="mt-3 text-sm leading-7">{section.body}</div> : null}
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
  );
}

function MediaPanel({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="premium-lesson-surface-elevated overflow-hidden rounded-3xl px-4 py-4">
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/60 bg-background/70">
        <Image src={src} alt={alt} fill className="object-contain" unoptimized />
      </div>
      <figcaption className="premium-lesson-muted mt-2 text-xs">图示用于支撑本页判断，不替代正文证据链。</figcaption>
    </figure>
  );
}

function ProgressiveRevealPanel({
  stepId,
  browseEnabled,
  revealProgress,
  allowInlineReveal,
}: {
  stepId: string;
  browseEnabled: boolean;
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const data = getProgressiveRevealData(stepId);
  const [localRevealCount, setLocalRevealCount] = useState(0);

  useEffect(() => {
    setLocalRevealCount(0);
  }, [stepId]);

  if (!data) {
    return null;
  }

  const syncedRevealCount = Math.max(revealProgress, localRevealCount);
  const visibleCount = browseEnabled ? Math.min(data.steps.length, syncedRevealCount) : 0;
  const canAdvance = browseEnabled && allowInlineReveal && visibleCount < data.steps.length;

  const advance = () => {
    if (!canAdvance) {
      return;
    }
    setLocalRevealCount((prev) => Math.min(data.steps.length, Math.max(prev, revealProgress) + 1));
  };

  const reset = () => {
    if (!allowInlineReveal) {
      return;
    }
    setLocalRevealCount(0);
  };

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-base font-semibold">{data.promptTitle}</div>
      <div className="mt-3 grid gap-2 text-sm leading-7">
        {data.promptBody.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {!browseEnabled ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">
          教师尚未开放浏览与显影链，请先阅读题面和换算关系。
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {data.steps.slice(0, visibleCount).map((item, index) => {
          const isLastVisible = index === visibleCount - 1;
          return (
            <button
              key={item}
              type="button"
              onClick={isLastVisible ? advance : undefined}
              className={`premium-lesson-surface-elevated rounded-2xl px-4 py-4 text-left text-sm ${
                isLastVisible && canAdvance ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="font-medium">步骤 {index + 1}</div>
              <div className="mt-2 leading-7">{item}</div>
              {isLastVisible && canAdvance ? (
                <div className="premium-lesson-caption mt-3 text-xs">点击当前步骤可继续显影下一层。</div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={advance}
          disabled={!canAdvance}
          className="premium-lesson-action-secondary disabled:opacity-40"
        >
          显示下一步
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!allowInlineReveal || visibleCount === 0}
          className="premium-lesson-action-secondary disabled:opacity-40"
        >
          重置步骤
        </button>
      </div>
      <div className="premium-lesson-caption mt-2 text-xs">题面已固定显示。点击此处或上方“显示下一步”，逐步展开求解链。</div>
    </section>
  );
}

function getRevealContent(stepId: string) {
  switch (stepId) {
    case 'step-03':
      return PRE_QUIZ_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    case 'step-04':
      return '参考顺序：先骨架，再关键节点，再窗口，最后才谈工程后果。';
    case 'step-05':
      return '参考口径：分离点分开主导机制，虚轴交点给稳定上界，B 兼顾两侧边界。';
    case 'step-07':
      return '参考提醒：稳定窗口只回答“还能不能工作”，可接受窗口才回答“值不值得继续推进”。';
    case 'step-08':
      return '参考换算：K = 0.0104 / 0.01715 ≈ 0.6064。';
    case 'step-09':
      return '参考角色：主图看节点与窗口，时域看波形后果，频域看带宽与高频风险。';
    case 'step-13':
      return '参考答案：a 改写了对象与特征方程，所以这里不是“再调一次 K”。';
    case 'step-16':
      return POST_QUIZ_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    default:
      return '';
  }
}

function countAnswers(responses: UNIT_3_4TeacherResponseItem[]) {
  const counts = new Map<string, number>();
  for (const item of responses) {
    for (const value of Object.values(item.response.answers)) {
      for (const token of parseList(value)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function getWordCloudEntries(responses: UNIT_3_4TeacherResponseItem[]) {
  const counts = new Map<string, number>();
  for (const item of responses) {
    const words = Object.values(item.response.answers)
      .join(' ')
      .split(/[\s,，。；;:：/|()（）]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2);
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
}

function renderActivityCard(field: ActivityCardField, value: string, onChange: (value: string) => void) {
  if (field.inputKind === 'single_choice' && field.options) {
    return <ChoiceGroup options={field.options} value={value} onChange={onChange} />;
  }
  return <TextInput value={value} onChange={onChange} placeholder={field.placeholder ?? field.prompt} />;
}

export function UNIT_3_4KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 3-3 法则走向 3-4 判断，再走向 3-5 结构改变</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { label: '3-3', title: '根轨迹法则', body: '负责解释参数变化时极点怎样迁移。', active: false },
          { label: '3-4', title: '读图与验证', body: '负责把法则压成关键节点、窗口、换算、三域与广义参数判断。', active: true },
          { label: '3-5', title: '结构改变', body: '才进入零点、PD 与结构调整。', active: false },
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

export function UNIT_3_4StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  browseEnabled = true,
  revealProgress = 0,
  allowInlineReveal = false,
}: {
  step: UNIT_3_4StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  browseEnabled?: boolean;
  revealProgress?: number;
  allowInlineReveal?: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">
        {blueprint.kicker} · {UNIT_3_4_STAGE_LABEL[step.stage]}
      </div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>

      {mediaSrc ? (
        <div className="mt-4">
          <MediaPanel src={mediaSrc} alt={mediaAlt ?? step.title} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {blueprint.sections.map((section) => (
          <InfoSection key={`${step.id}-${section.title}`} section={section} />
        ))}
      </div>

      {step.pageType === 'worked_example_workspace' ? (
        <div className="mt-4">
          <ProgressiveRevealPanel
            stepId={step.id}
            browseEnabled={browseEnabled}
            revealProgress={revealProgress}
            allowInlineReveal={allowInlineReveal}
          />
        </div>
      ) : null}

      {step.id === 'step-09' ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ['主图 / 根轨迹', '看关键节点、极点迁移和窗口边界。'],
            ['时域', '看快慢、振荡、拖尾和参考工作点后果。'],
            ['频域', '看带宽、相位变化、高频差异与风险暴露。'],
          ].map(([title, body]) => (
            <div key={title} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4 text-sm">
              <div className="font-medium">{title}</div>
              <div className="premium-lesson-muted mt-2">{body}</div>
            </div>
          ))}
        </div>
      ) : null}

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

export function UNIT_3_4StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  browseEnabled,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_4StepDefinition;
  savedResponse?: UNIT_3_4StepResponse;
  released: boolean;
  answerVisible: boolean;
  browseEnabled?: boolean;
  onSubmit: (response: UNIT_3_4StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(getDefaultDraft(step, savedResponse));

  useEffect(() => {
    setDraft(getDefaultDraft(step, savedResponse));
  }, [savedResponse, step]);

  if (step.pageType === 'display' || step.pageType === 'summary') {
    return null;
  }

  const submitted = Boolean(savedResponse);
  const locked = !released;

  const updateDraft = (key: string, value: string, source: WorkspaceParameterChange['source'] = 'input') => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    onWorkspaceParameterChange?.({ key, value, source });
  };

  const submit = () => {
    onSubmit({
      stepId: step.id,
      submittedAt: Date.now(),
      answers: draft,
    });
  };

  const renderBody = () => {
    switch (step.pageType) {
      case 'quiz_group': {
        const questions = step.id === 'step-03' ? PRE_QUIZ_QUESTIONS : POST_QUIZ_QUESTIONS;
        return (
          <div className="grid gap-4">
            {questions.map((question) => (
              <div key={question.key} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                <div className="mt-3">
                  {'options' in question ? (
                    <ChoiceGroup
                      options={question.options}
                      value={draft[question.key] ?? ''}
                      onChange={(value) => updateDraft(question.key, value, 'button')}
                    />
                  ) : (
                    <TextInput
                      value={draft[question.key] ?? ''}
                      onChange={(value) => updateDraft(question.key, value)}
                      placeholder="写出你的解释。"
                    />
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={submit} className="premium-lesson-action-primary">
              提交答案
            </button>
          </div>
        );
      }
      case 'sequence_sort': {
        const order = parseList(draft.sortOrder) || READING_SEQUENCE_OPTIONS.map((item) => item.value);
        return (
          <div className="grid gap-4">
            {order.map((value, index) => {
              const item = READING_SEQUENCE_OPTIONS.find((entry) => entry.value === value);
              if (!item) return null;
              return (
                <div key={value} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-4 py-4 text-sm">
                  <span>
                    {index + 1}. {item.label}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      className="premium-lesson-control disabled:opacity-40"
                      onClick={() => {
                        const next = [...order];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        updateDraft('sortOrder', next.join('||'), 'button');
                      }}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      disabled={index === order.length - 1}
                      className="premium-lesson-control disabled:opacity-40"
                      onClick={() => {
                        const next = [...order];
                        [next[index], next[index + 1]] = [next[index + 1], next[index]];
                        updateDraft('sortOrder', next.join('||'), 'button');
                      }}
                    >
                      下移
                    </button>
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={submit} className="premium-lesson-action-primary">
              提交答案
            </button>
          </div>
        );
      }
      case 'hotspot_labeling':
        return (
          <div className="grid gap-4">
            {HOTSPOT_LABEL_FIELDS.map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <TextInput
                    value={draft[field.key] ?? ''}
                    onChange={(value) => updateDraft(field.key, value)}
                    placeholder={`写出 ${field.label} 的图上位置或判据。`}
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={submit} className="premium-lesson-action-primary">
              提交答案
            </button>
          </div>
        );
      case 'activity_cards':
        return (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(ACTIVITY_CARD_FIELDS[step.id] ?? []).map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="premium-lesson-muted mt-2 text-sm">{field.prompt}</div>
                <div className="mt-3">{renderActivityCard(field, draft[field.key] ?? '', (value) => updateDraft(field.key, value))}</div>
              </div>
            ))}
            <div className="md:col-span-2">
              <button type="button" onClick={submit} className="premium-lesson-action-primary">
                提交答案
              </button>
            </div>
          </div>
        );
      case 'worked_example_workspace':
        return (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(WORKED_EXAMPLE_FIELDS[step.id] ?? []).map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="premium-lesson-muted mt-2 text-sm">{field.prompt}</div>
                <div className="mt-3">{renderActivityCard(field, draft[field.key] ?? '', (value) => updateDraft(field.key, value))}</div>
              </div>
            ))}
            <div className="md:col-span-2">
              {!browseEnabled ? (
                <div className="premium-lesson-tone-block premium-tone-amber mb-4 text-sm">教师尚未开放显影浏览，但你可以先阅读题面并整理思路。</div>
              ) : null}
              <button type="button" onClick={submit} className="premium-lesson-action-primary">
                提交答案
              </button>
            </div>
          </div>
        );
      case 'triple_match':
        return (
          <div className="grid gap-4">
            {TRIPLE_MATCH_FIELDS.map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="premium-lesson-muted mt-2 text-sm">{field.prompt}</div>
                <div className="mt-3">
                  <SelectField value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value, 'select')} options={field.options} />
                </div>
              </div>
            ))}
            <button type="button" onClick={submit} className="premium-lesson-action-primary">
              提交答案
            </button>
          </div>
        );
      case 'binary_choice':
        return (
          <div className="grid gap-4">
            <ChoiceGroup options={BINARY_CHOICE_OPTIONS} value={draft.choice ?? ''} onChange={(value) => updateDraft('choice', value, 'button')} />
            <button type="button" onClick={submit} className="premium-lesson-action-primary">
              提交答案
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
      <p className="premium-lesson-muted mt-2 text-sm">{locked ? '教师尚未释放本页互动，请先阅读上方静态内容。' : '按本页任务完成判断与提交。'}</p>
      {locked ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">当前互动尚未释放。</div> : <div className="mt-4">{renderBody()}</div>}
      <SubmissionStatus submitted={submitted} />
      {answerVisible && getRevealContent(step.id) ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4 whitespace-pre-line text-sm leading-7">{getRevealContent(step.id)}</div>
      ) : null}
    </section>
  );
}

export function UNIT_3_4TeacherActivitySummary({
  step,
  pageContract,
  responses,
  released,
  browseEnabled,
  revealProgress,
  answerVisible,
  onToggleRelease,
  onToggleBrowse,
  onAdvanceReveal,
  onResetReveal,
  onToggleAnswerVisible,
}: {
  step: UNIT_3_4StepDefinition;
  pageContract: UNIT_3_4PageContract;
  responses: UNIT_3_4TeacherResponseItem[];
  released: boolean;
  browseEnabled: boolean;
  revealProgress: number;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const counts = useMemo(() => countAnswers(responses), [responses]);
  const wordCloud = useMemo(() => getWordCloudEntries(responses), [responses]);
  const revealSteps = getProgressiveRevealData(step.id)?.steps.length ?? 0;

  if (step.pageType === 'display' || step.pageType === 'summary') {
    return null;
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-medium">教师汇总</div>
          <div className="premium-lesson-muted mt-1 text-sm">本页收到 {responses.length} 份学生提交。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {pageContract.teacherControls.releaseActivity === 'separate_toggle' ? (
            <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
              {released ? '撤回互动' : '释放互动'}
            </button>
          ) : null}
          {pageContract.teacherControls.openBrowse === 'separate_toggle' ? (
            <button type="button" onClick={onToggleBrowse} className="premium-lesson-action-secondary">
              {browseEnabled ? '关闭浏览' : '开放浏览'}
            </button>
          ) : null}
          {pageContract.teacherControls.teacherStepReveal === 'separate_toggle' ? (
            <>
              <button
                type="button"
                onClick={onAdvanceReveal}
                disabled={!browseEnabled || revealProgress >= revealSteps}
                className="premium-lesson-action-secondary disabled:opacity-40"
              >
                推进显影
              </button>
              <button
                type="button"
                onClick={onResetReveal}
                disabled={revealProgress === 0}
                className="premium-lesson-action-secondary disabled:opacity-40"
              >
                重置显影
              </button>
            </>
          ) : null}
          {pageContract.teacherControls.revealReferenceAnswer === 'separate_toggle' ? (
            <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-primary">
              {answerVisible ? '隐藏参考答案' : '显示参考答案'}
            </button>
          ) : null}
        </div>
      </div>

      {pageContract.teacherControls.teacherStepReveal === 'separate_toggle' ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">
          当前显影进度：{revealProgress} / {revealSteps}。
        </div>
      ) : null}

      {counts.length ? (
        <div className="mt-4 grid gap-2">
          {counts.slice(0, 8).map(([label, count]) => (
            <div key={label} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm">
              <span>{label}</span>
              <span className="premium-lesson-caption">{count} 人</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="premium-lesson-muted mt-4 text-sm">本页暂无学生提交。</div>
      )}

      {responses.length && wordCloud.length ? (
        <div className="mt-4">
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

export function UNIT_3_4StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_3_4StepResponse>;
}) {
  const finishedSteps = UNIT_3_4_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_3_4_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {['关键节点', '参数窗口', '增益换算', '三域互证', '广义参数'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是 3-4 最终要带走的判断锚点。</div>
          </div>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
        你已经把“关键节点 -&gt; 窗口 -&gt; 换算 -&gt; 三域 -&gt; 广义参数”串成一条完整判断链，下一课才进入结构改变。
      </div>
    </section>
  );
}

export function getUNIT_3_4DemoPageContract(stepId: string) {
  return getUNIT_3_4PageContract(stepId);
}
