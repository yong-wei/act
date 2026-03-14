'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Copy, Sparkles } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import type {
  L2CChoiceOption,
  L2CContentBlock,
  L2CFormField,
  L2CQuestion,
  L2CSection,
  L2CStepDefinition,
  L2CStepResponse,
  L2CStudentCourseState,
} from '@/lib/l2c-course';

function toneClass(tone: L2CSection['tone']) {
  switch (tone) {
    case 'sky':
      return 'premium-lesson-tone-block premium-tone-sky';
    case 'emerald':
      return 'premium-lesson-tone-block premium-tone-emerald';
    case 'amber':
      return 'premium-lesson-tone-block premium-tone-amber';
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

export function L2CKnowledgeMapVisual() {
  return (
    <section className="premium-lesson-accent-panel">
      <div className="premium-lesson-kicker text-sm tracking-[0.24em]">Knowledge Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">L-2c 当前位置：频域直觉层</h2>
      <p className="premium-lesson-body mt-2 text-sm leading-6">
        三次课知识地图已经来到“第三张面孔”：时域负责看响应，根轨迹负责看极点如何移动，频域负责看系统面对不同节拍时的选择性与余量。
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MapNode title="L-2a 时域直觉" status="已完成" />
        <MapNode title="L-2b 根轨迹直觉" status="已完成" />
        <MapNode title="L-2c 频域直觉" status="当前高亮" active />
        <MapNode title="L-2d 三域联动实操" status="下一课" />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        {['极点 → 响应', 'K → 极点 → 响应', '频域 → 快慢与余量', '一动三域同时变化'].map((item) => (
          <div key={item} className="premium-lesson-surface-elevated px-3 py-2 text-sm">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function MapNode({
  title,
  status,
  active = false,
}: {
  title: string;
  status: string;
  active?: boolean;
}) {
  return (
    <div
      className={`px-4 py-4 ${
        active ? 'premium-lesson-selectable-card premium-lesson-selectable-card-active' : 'premium-lesson-selectable-card'
      }`}
    >
      <div className={active ? 'premium-lesson-kicker' : 'premium-lesson-caption text-xs uppercase tracking-[0.2em]'}>{status}</div>
      <div className="mt-2 text-base font-medium">{title}</div>
    </div>
  );
}

export function L2CStepContentPanel({
  content,
  rightSlot,
  mediaSrc,
  mediaAlt,
}: {
  content: L2CContentBlock;
  rightSlot?: React.ReactNode;
  mediaSrc?: string | null;
  mediaAlt?: string;
}) {
  return (
    <section className="premium-lesson-panel">
      <div className="flex flex-wrap items-center gap-3">
        <span className="premium-lesson-tone-pill premium-tone-cyan">{content.kicker}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="premium-lesson-title text-2xl font-semibold sm:text-[2rem]">{content.title}</h2>
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
          <div className="premium-lesson-surface-elevated relative aspect-[16/10] overflow-hidden rounded-[24px]">
            <Image src={mediaSrc} alt={mediaAlt ?? content.title} fill className="object-contain" />
          </div>
        </div>
      ) : null}

      {content.controls?.length ? (
        <div className="premium-lesson-panel-soft mt-5">
          <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
            <ClipboardList className="h-4 w-4" />
            教学控制建议
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

function normalizeSavedValue(
  savedResponse: L2CStepResponse | undefined,
  key: string,
  field: L2CFormField | L2CQuestion,
) {
  const value = savedResponse?.answers[key];
  return typeof value === 'string' ? value : '';
}

export function L2CStudentActivityForm({
  step,
  savedResponse,
  courseState,
  answerVisible = false,
  onSubmit,
}: {
  step: L2CStepDefinition;
  savedResponse?: L2CStepResponse;
  courseState: L2CStudentCourseState;
  answerVisible?: boolean;
  onSubmit: (response: L2CStepResponse) => void;
}) {
  const activity = step.student.activity;
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activity || activity.kind === 'none') {
      setDraft({});
      return;
    }

    if (activity.kind === 'form') {
      setDraft(
        Object.fromEntries((activity.fields ?? []).map((field) => [field.key, normalizeSavedValue(savedResponse, field.key, field)])),
      );
      return;
    }

    setDraft(
      Object.fromEntries((activity.questions ?? []).map((question) => [question.key, normalizeSavedValue(savedResponse, question.key, question)])),
    );
  }, [activity, savedResponse, step.id]);

  if (!activity || activity.kind === 'none') {
    return null;
  }

  const submitCurrent = () => {
    onSubmit({
      stepId: step.id,
      submittedAt: Date.now(),
      answers: draft,
    });
  };

  return (
    <section className="premium-lesson-accent-panel">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <BookOpen className="h-4 w-4" />
        学生任务提交区
      </div>
      {activity.helper ? <p className="premium-lesson-muted mt-2">{activity.helper}</p> : null}

      {step.id === 'step-07' ? (
        <RecallCard
          title="回看你的前一页预判"
          text={courseState.responses['step-06']?.answers['speed-judgement'] ?? '上一页还没有保存预判。'}
        />
      ) : null}

      {step.id === 'step-17' ? (
        <RecallCard
          title="回看你在开场写下的直觉判断"
          text={courseState.responses['step-02']?.answers['prediction'] ?? '开场页还没有保存记录。'}
        />
      ) : null}

      <div className="mt-4 space-y-4">
        {activity.kind === 'form'
          ? (activity.fields ?? []).map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={draft[field.key]}
                onChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
              />
            ))
          : (activity.questions ?? []).map((question) => (
              <QuestionRenderer
                key={question.key}
                question={question}
                value={draft[question.key]}
                answerVisible={answerVisible}
                onChange={(value) => setDraft((prev) => ({ ...prev, [question.key]: value }))}
              />
            ))}
      </div>

      <button type="button" onClick={submitCurrent} className="premium-lesson-action-primary mt-4">
        {activity.submitLabel ?? '提交'}
      </button>
    </section>
  );
}

function RecallCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="premium-lesson-surface-elevated mt-4 px-4 py-4">
      <div className="premium-lesson-kicker">回看记录</div>
      <div className="premium-lesson-title mt-2 text-sm font-medium">{title}</div>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{text}</div>
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: L2CFormField;
  value?: string;
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
                onChange={(event) => onChange(event.target.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : field.type === 'textarea' ? (
        <textarea
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="premium-lesson-input mt-3 min-h-[120px] w-full resize-y text-sm tracking-normal"
        />
      ) : (
        <input
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="premium-lesson-input mt-3 w-full text-sm tracking-normal"
        />
      )}
    </div>
  );
}

function QuestionRenderer({
  question,
  value,
  answerVisible,
  onChange,
}: {
  question: L2CQuestion;
  value?: string;
  answerVisible: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="premium-lesson-surface-elevated px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
      {question.type === 'single' ? (
        <div className="mt-3 space-y-2">
          {(question.options ?? []).map((option) => (
            <label key={option.value} className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name={question.key}
                value={option.value}
                checked={value === option.value}
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
      ) : (
        <textarea
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
          className="premium-lesson-input mt-3 min-h-[120px] w-full resize-y text-sm tracking-normal"
        />
      )}
    </div>
  );
}

function getChoiceLabel(options: L2CChoiceOption[], answer: string) {
  return options.find((option) => option.value === answer)?.label ?? '';
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
      if (cleaned.length < 2) {
        return [];
      }
      return [cleaned];
    });
}

function buildWordCloudEntries(values: TextResponseItem[]) {
  const counts = new Map<string, number>();
  for (const item of values) {
    for (const token of tokenizeWordCloud(item.text)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hans-CN'))
    .slice(0, 16);
}

type TeacherResponseItem = {
  studentName: string;
  response: L2CStepResponse;
};

type TextResponseItem = {
  studentName: string;
  submittedAt: number;
  text: string;
};

export function L2CTeacherActivitySummary({
  activity,
  responses,
  answerVisible = false,
  onToggleAnswerVisible,
}: {
  activity?: L2CContentBlock['activity'];
  responses: TeacherResponseItem[];
  answerVisible?: boolean;
  onToggleAnswerVisible?: () => void;
}) {
  const [showTextResponses, setShowTextResponses] = useState(false);
  const showAnswerKey = Boolean(answerVisible);

  if (!activity || activity.kind === 'none') {
    return null;
  }

  const hasAnswer = activity.kind === 'quiz' && (activity.questions ?? []).some((question) => question.answer);

  if (!responses.length) {
    return (
      <section className="premium-lesson-panel-soft">
        <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4" />
          教师端汇总
        </div>
        <p className="premium-lesson-muted mt-2">暂无学生提交，切到当前环节后学生提交会显示在这里。</p>
      </section>
    );
  }

  const renderChoiceStats = (
    key: string,
    label: string,
    options: L2CChoiceOption[],
    answer?: string,
  ) => {
    const counts = Object.fromEntries(options.map((option) => [option.value, 0]));
    for (const item of responses) {
      const value = item.response.answers[key];
      if (typeof value === 'string' && value in counts) {
        counts[value] += 1;
      }
    }

    return (
      <article key={key} className="premium-lesson-surface-elevated px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="premium-lesson-title text-sm font-medium">{label}</h3>
          {showAnswerKey && answer ? (
            <span className="premium-lesson-tone-pill premium-tone-emerald">
              正确答案：{answer}. {getChoiceLabel(options, answer)}
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
  };

  const renderTextGroup = (label: string, values: TextResponseItem[]) => {
    if (!values.length) {
      return null;
    }

    const sortedValues = [...values].sort((left, right) => left.submittedAt - right.submittedAt);
    const wordCloudEntries = buildWordCloudEntries(sortedValues);

    return (
      <article key={label} className="premium-lesson-surface-elevated px-4 py-4">
        <h3 className="premium-lesson-title text-sm font-medium">{label}</h3>
        <div className="premium-lesson-tone-card premium-tone-violet mt-3">
          <div className="premium-lesson-kicker">词云</div>
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
              {sortedValues.map((item) => (
                <div key={`${label}-${item.studentName}-${item.submittedAt}`} className="premium-lesson-surface-elevated px-3 py-3 text-sm">
                  <div className="premium-lesson-caption flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em]">
                    <span>{item.studentName}</span>
                    <span>{new Date(item.submittedAt).toLocaleString('zh-CN', { hour12: false })}</span>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap leading-6">{item.text}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    );
  };

  const choiceSummaries =
    activity.kind === 'form'
      ? (activity.fields ?? [])
          .filter((field) => field.type === 'radio')
          .map((field) => renderChoiceStats(field.key, field.label, field.options ?? []))
      : (activity.questions ?? [])
          .filter((question) => question.type === 'single')
          .map((question) => renderChoiceStats(question.key, question.prompt, question.options ?? [], question.answer));

  const textSummaries =
    activity.kind === 'form'
      ? (activity.fields ?? [])
          .filter((field) => field.type === 'text' || field.type === 'textarea')
          .map((field) =>
            renderTextGroup(
              field.label,
              responses
                .map((item) => {
                  const value = item.response.answers[field.key];
                  return typeof value === 'string' && value.trim()
                    ? {
                        studentName: item.studentName,
                        submittedAt: item.response.submittedAt,
                        text: value.trim(),
                      }
                    : null;
                })
                .filter(Boolean) as TextResponseItem[],
            ),
          )
      : (activity.questions ?? [])
          .filter((question) => question.type === 'text')
          .map((question) =>
            renderTextGroup(
              question.prompt,
              responses
                .map((item) => {
                  const value = item.response.answers[question.key];
                  return typeof value === 'string' && value.trim()
                    ? {
                        studentName: item.studentName,
                        submittedAt: item.response.submittedAt,
                        text: value.trim(),
                      }
                    : null;
                })
                .filter(Boolean) as TextResponseItem[],
            ),
          );

  return (
    <section className="premium-lesson-panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
          <ClipboardList className="h-4 w-4" />
          教师端汇总
          <span className="premium-lesson-tone-pill premium-tone-cyan px-2.5 py-0.5">{responses.length} 份提交</span>
        </div>
        {hasAnswer ? (
          <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-tone premium-tone-emerald">
            {showAnswerKey ? '隐藏答案' : '显示答案'}
          </button>
        ) : null}
      </div>
      {choiceSummaries.length ? <div className="grid gap-4 xl:grid-cols-2">{choiceSummaries}</div> : null}
      <div className="space-y-4">{textSummaries}</div>
    </section>
  );
}

export function L2CStudentSummaryPanel({
  courseState,
}: {
  courseState: L2CStudentCourseState;
}) {
  return (
    <section className="premium-lesson-panel-soft">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        学习回顾
      </div>
      <p className="premium-lesson-muted mt-2">
        你已累计完成 {Object.keys(courseState.responses).length} 个环节记录，可在总结页对照自己最初的判断、AI 探索和最终结论。
      </p>
    </section>
  );
}

function buildInteractiveAiConfig(step: L2CStepDefinition) {
  return {
    resourceId: `l2c-${step.id}-ai`,
    registryId: 'l2c-frequency-bode-ai-dialog',
    title: `${step.title} · 页内 AI 助手`,
    description: step.hint,
    aiHints: (step.aiPrompts ?? []).join('\n'),
    config: {
      ai: {
        enabled: true,
        persona: 'tutor' as const,
      },
      layout: {
        showAIPanel: true,
        aiPanelPosition: 'floating' as const,
      },
    },
  };
}

export function L2CStepAiAssistant({
  step,
}: {
  step: L2CStepDefinition;
}) {
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: 'L-2c',
      stepId: step.id,
      prompts: step.aiPrompts ?? [],
    },
  });

  useEffect(() => {
    if (!copiedPrompt) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopiedPrompt(null), 1500);
    return () => window.clearTimeout(timer);
  }, [copiedPrompt]);

  if (!step.aiPrompts?.length) {
    return null;
  }

  return (
    <section className="premium-lesson-panel-soft">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4" />
        页内 AI 助手
      </div>
      <p className="premium-lesson-muted mt-2">先自己判断，再打开当前页面内的 AI 助手进行对照。推荐提示词如下：</p>
      <div className="mt-4 space-y-3">
        {step.aiPrompts.map((prompt) => (
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
        打开 AI 助手
      </button>

      <Dialog open={ai.isPanelOpen} onOpenChange={ai.togglePanel}>
        <DialogContent className="max-w-5xl border-border bg-background p-0 text-foreground">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="premium-lesson-title">L-2c 页内 AI 助手</DialogTitle>
            <DialogDescription className="premium-lesson-muted">
              仅围绕当前页面问题进行追问，不跳转离开课程页。
            </DialogDescription>
          </DialogHeader>
          <div className="h-[560px] overflow-hidden">
            <InteractiveAIPanel ai={ai} title={`${step.title} · AI 学习助手`} onClose={ai.togglePanel} position="right" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
