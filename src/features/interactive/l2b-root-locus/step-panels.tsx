'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { BarChart3, BookOpen, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Copy, Sparkles } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import type {
  L2BChoiceOption,
  L2BContentBlock,
  L2BFormField,
  L2BQuestion,
  L2BSection,
  L2BStudentCourseState,
  L2BStepResponse,
} from '@/lib/l2b-course';
import {
  L2B_POST_ASSESSMENT_QUESTIONS,
  L2B_PRE_ASSESSMENT_QUESTIONS,
} from '@/lib/l2b-course';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';

function toneClass(tone: L2BSection['tone']) {
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

export function KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-accent-panel">
      <div className="premium-lesson-kicker text-sm tracking-[0.24em]">Knowledge Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">L-2b 当前位置：根轨迹直觉层</h2>
      <p className="premium-lesson-body mt-2 text-sm leading-6">
        延续 L-2a 的三次课知识地图结构：上一课看极点怎样决定响应，本课看增益怎样推动极点迁移，下节切到频域继续看同一系统。
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MapNode title="L-2a 时域直觉" status="上一课" />
        <MapNode title="L-2b 根轨迹直觉" status="当前高亮" active />
        <MapNode title="L-2c 频域直觉" status="下一课" />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {['极点 → 响应', 'K → 极点', '频域视角'].map((item) => (
          <div
            key={item}
            className="premium-lesson-surface-elevated px-3 py-2 text-sm"
          >
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
      className={`rounded-[24px] border px-4 py-4 transition ${
        active
          ? 'premium-tone-cyan shadow-[0_12px_36px_rgba(8,145,178,0.18)]'
          : 'premium-lesson-surface-elevated'
      }`}
    >
      <div className={active ? 'premium-lesson-kicker' : 'premium-lesson-caption text-xs uppercase tracking-[0.2em]'}>{status}</div>
      <div className="mt-2 text-base font-medium">{title}</div>
    </div>
  );
}

export function StepContentPanel({
  content,
  rightSlot,
  mediaSrc,
  mediaAlt,
}: {
  content: L2BContentBlock;
  rightSlot?: ReactNode;
  mediaSrc?: string | null;
  mediaAlt?: string;
}) {
  return (
    <section className="premium-lesson-panel">
      <div className="flex flex-wrap items-center gap-3">
        <span className="premium-lesson-tone-pill premium-tone-cyan">
          {content.kicker}
        </span>
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
  savedResponse: L2BStepResponse | undefined,
  key: string,
  field: L2BFormField | L2BQuestion,
) {
  const value = savedResponse?.answers[key];
  return typeof value === 'string' ? value : '';
}

export function StudentActivityForm({
  stepId,
  activity,
  savedResponse,
  courseState,
  answerVisible = false,
  onSubmit,
}: {
  stepId: string;
  activity: L2BContentBlock['activity'];
  savedResponse?: L2BStepResponse;
  courseState: L2BStudentCourseState;
  answerVisible?: boolean;
  onSubmit: (response: L2BStepResponse) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activity || activity.kind === 'none') {
      setDraft({});
      return;
    }

    if (activity.kind === 'form') {
      const nextDraft = Object.fromEntries(
        (activity.fields ?? []).map((field) => [field.key, normalizeSavedValue(savedResponse, field.key, field)]),
      );
      setDraft(nextDraft);
      return;
    }

    const nextDraft = Object.fromEntries(
      (activity.questions ?? []).map((question) => [question.key, normalizeSavedValue(savedResponse, question.key, question)]),
    );
    setDraft(nextDraft);
  }, [activity, savedResponse, stepId]);

  if (!activity || activity.kind === 'none') {
    return null;
  }

  const isSubmitted = Boolean(savedResponse);

  const submitCurrent = () => {
    onSubmit({
      stepId,
      submittedAt: Date.now(),
      answers: draft,
    });
  };

  const questions =
    stepId === 'precheck'
      ? L2B_PRE_ASSESSMENT_QUESTIONS
      : stepId === 'postcheck'
        ? L2B_POST_ASSESSMENT_QUESTIONS
        : activity.questions ?? [];

  return (
    <section className="premium-lesson-accent-panel">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <BookOpen className="h-4 w-4" />
        学生任务提交区
      </div>
      {activity.helper ? <p className="premium-lesson-muted mt-2">{activity.helper}</p> : null}

      {stepId === 'prediction' ? (
        <PriorIntuitionRecall courseState={courseState} />
      ) : null}

      {stepId === 'ai-compare' ? (
        <AIPromptComparePanel
          draft={draft}
          courseState={courseState}
          onChange={setDraft}
        />
      ) : null}

      {stepId === 'summary' ? <SummaryGoalReview courseState={courseState} /> : null}

      <div className="mt-4 space-y-4">
        {activity.kind === 'form'
          ? (activity.fields ?? []).map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={draft[field.key]}
                disabled={isSubmitted}
                onChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
              />
            ))
          : questions.map((question) => (
              <QuestionRenderer
                key={question.key}
                question={question}
                value={draft[question.key]}
                disabled={isSubmitted}
                onChange={(value) => setDraft((prev) => ({ ...prev, [question.key]: value }))}
              />
            ))}
      </div>

      {activity.kind === 'quiz' && answerVisible ? (
        <AnswerRevealPanel questions={questions} savedResponse={savedResponse} />
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submitCurrent}
          disabled={isSubmitted}
          className="premium-lesson-action-primary"
        >
          <CheckCircle2 className="h-4 w-4" />
          {isSubmitted ? '已提交' : activity.submitLabel ?? '保存'}
        </button>
      </div>
      <SubmissionStatus submitted={isSubmitted} />
    </section>
  );
}

function AIPromptComparePanel({
  draft,
  courseState,
  onChange,
}: {
  draft: Record<string, string>;
  courseState: L2BStudentCourseState;
  onChange: (next: Record<string, string>) => void;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const prompt = `对于闭环系统特征方程 s²+2s+K=0，
当K等于多少时，阻尼比ζ=0.707？
请给出极点坐标和计算过程。`;
  const predictionResponse = courseState.responses['prediction'];
  const verifyResponse = courseState.responses['verify-and-ray'];
  const ai = useInteractiveAI({
    config: {
      resourceId: 'l2b-ai-compare-dialog',
      registryId: 'l2b-root-locus-ai-dialog',
      title: 'L-2b 根轨迹 AI 助手',
      aiHints: '请围绕根轨迹、阻尼比、45°射线和闭环极点计算给出简洁教学式回答，优先解释思路，再给出结果。',
      config: {
        ai: {
          enabled: true,
          persona: 'tutor',
        },
      },
    },
    contextData: {
      prompt,
      prediction: predictionResponse?.answers['prediction-choice'] ?? '',
      verifiedK: verifyResponse?.answers['ray-k'] ?? '',
      verifiedPole: verifyResponse?.answers['ray-pole'] ?? '',
    },
  });

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState('done');
      window.setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 1600);
    }
  };

  const openAssistant = () => {
    setAssistantOpen(true);
  };

  return (
    <div className="premium-lesson-panel-soft mt-4 space-y-4">
      <div>
        <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          向 AI 助手提问
        </div>
        <pre className="premium-lesson-input mt-3 whitespace-pre-wrap rounded-2xl px-3 py-3 text-sm">{prompt}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="premium-lesson-action-tone premium-tone-violet"
          >
            <Copy className="h-3.5 w-3.5" />
            {copyState === 'done' ? '已复制提示词' : copyState === 'failed' ? '复制失败，请重试' : '复制提示词'}
          </button>
          <button
            type="button"
            onClick={openAssistant}
            className="premium-lesson-action-secondary px-3 py-2 text-xs"
          >
            打开AI助手
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="premium-lesson-body block text-sm">
          <span className="premium-lesson-title mb-2 block font-medium">你的预测</span>
          <div className="premium-lesson-input rounded-2xl px-3 py-3 text-sm">
            {predictionResponse?.answers['prediction-choice'] || '将在此对照'}
          </div>
        </label>
        <label className="premium-lesson-body block text-sm">
          <span className="premium-lesson-title mb-2 block font-medium">平台验证</span>
          <div className="premium-lesson-input rounded-2xl px-3 py-3 text-sm">
            {verifyResponse?.answers['ray-k']
              ? `K ≈ ${verifyResponse.answers['ray-k']}，极点 ${verifyResponse.answers['ray-pole'] || '待补充'}`
              : '将在此对照'}
          </div>
        </label>
        <label className="premium-lesson-body block text-sm">
          <span className="premium-lesson-title mb-2 block font-medium">AI 给出的 K</span>
          <input
            className="premium-lesson-input w-full rounded-2xl px-3 py-3 text-sm"
            value={draft['ai-k'] ?? ''}
            onChange={(event) => onChange({ ...draft, 'ai-k': event.target.value })}
            placeholder="填写 AI 的结果"
          />
        </label>
      </div>

      <Dialog open={assistantOpen} onOpenChange={setAssistantOpen}>
        <DialogContent className="premium-lesson-panel max-w-5xl p-0 sm:max-h-[85vh] sm:overflow-hidden">
          <DialogHeader className="border-b border-border/70 px-5 py-4">
            <DialogTitle className="premium-lesson-title">L-2b 页内 AI 助手</DialogTitle>
            <DialogDescription className="premium-lesson-caption text-sm">
              页内 AI 助手用于在当前课程页内直接提问、对照预测与平台验证结果。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="premium-lesson-tone-block premium-tone-violet">
              <div className="font-medium">当前题目</div>
              <pre className="mt-2 whitespace-pre-wrap text-sm leading-6">{prompt}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void ai.sendMessage(prompt)}
                  disabled={ai.isLoading}
                  className="premium-lesson-action-tone premium-tone-violet"
                >
                  把当前题目发给 AI
                </button>
              </div>
            </div>
            <InteractiveAIPanel
              ai={ai}
              title="根轨迹 AI 助手"
              onClose={() => setAssistantOpen(false)}
              position="bottom"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PriorIntuitionRecall({ courseState }: { courseState: L2BStudentCourseState }) {
  const firstImpression = courseState.responses['scenario-question']?.answers['first-impression'];
  if (!firstImpression) {
    return null;
  }

  return (
    <div className="premium-lesson-tone-block premium-tone-sky mt-4 rounded-2xl">
      <div className="text-sm font-medium">你在 step-02 写下的初始直觉</div>
      <p className="mt-2 text-sm leading-6">💬 {firstImpression}</p>
    </div>
  );
}

function SummaryGoalReview({ courseState }: { courseState: L2BStudentCourseState }) {
  const predictionChoice = courseState.responses['prediction']?.answers['prediction-choice'];
  const rayK = courseState.responses['verify-and-ray']?.answers['ray-k'];
  const aiK = courseState.responses['ai-compare']?.answers['ai-k'];

  return (
    <div className="premium-lesson-panel-soft mt-4 space-y-4">
      <div className="premium-lesson-tone-card premium-tone-emerald">
        <div className="text-sm font-medium">回到课前的三个目标</div>
        <div className="mt-3 grid gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 rounded border-border" />
            我能解释极点迁移
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 rounded border-border" />
            我能读根轨迹图
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 rounded border-border" />
            我能用45°射线定位 K
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="premium-lesson-surface-elevated px-4 py-3 text-sm">
          <div className="premium-lesson-title font-medium">step-13 预测</div>
          <div className="mt-2">{predictionChoice || '尚未记录'}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-4 py-3 text-sm">
          <div className="premium-lesson-title font-medium">step-14 平台验证</div>
          <div className="mt-2">{rayK ? `K ≈ ${rayK}` : '尚未记录'}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-4 py-3 text-sm">
          <div className="premium-lesson-title font-medium">step-15 AI 对比</div>
          <div className="mt-2">{aiK ? `AI 给出 K ≈ ${aiK}` : '尚未记录'}</div>
        </div>
      </div>
    </div>
  );
}

function getChoiceLabel(options: L2BChoiceOption[] | undefined, value: string) {
  return options?.find((option) => option.value === value)?.label ?? value;
}

function AnswerRevealPanel({
  questions,
  savedResponse,
}: {
  questions: L2BQuestion[];
  savedResponse?: L2BStepResponse;
}) {
  const answeredQuestions = questions.filter((question) => question.answer);

  if (!answeredQuestions.length) {
    return null;
  }

  return (
    <div className="premium-lesson-tone-card premium-tone-emerald mt-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        正确答案
      </div>
      <div className="space-y-3">
        {answeredQuestions.map((question) => {
          const currentAnswer = savedResponse?.answers[question.key];
          const answer = question.answer ?? '';
          const correctLabel = getChoiceLabel(question.options, answer);
          const currentLabel =
            typeof currentAnswer === 'string' && currentAnswer
              ? getChoiceLabel(question.options, currentAnswer)
              : '尚未作答';

          return (
            <div key={question.key} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
              <div className="premium-lesson-title font-medium">{question.prompt}</div>
              <div className="mt-2">{`正确答案：${answer}. ${correctLabel}`}</div>
              <div className="premium-lesson-caption mt-1">你的作答：{currentLabel}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  disabled,
  onChange,
}: {
  field: L2BFormField;
  value: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (field.type === 'radio' && field.options) {
    return (
      <div className="space-y-2">
        <p className="premium-lesson-title text-sm font-medium">{field.label}</p>
        <div className="grid gap-2">
          {field.options.map((option) => {
            const checked = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={`premium-lesson-choice ${checked ? 'premium-lesson-choice-active' : ''}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="premium-lesson-body block text-sm">
        <span className="premium-lesson-title mb-2 block font-medium">{field.label}</span>
        <textarea
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="premium-lesson-input min-h-[120px] w-full rounded-2xl px-3 py-3 text-sm"
        />
      </label>
    );
  }

  return (
    <label className="premium-lesson-body block text-sm">
      <span className="premium-lesson-title mb-2 block font-medium">{field.label}</span>
      <input
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        className="premium-lesson-input w-full rounded-2xl px-3 py-3 text-sm"
      />
    </label>
  );
}

function QuestionRenderer({
  question,
  value,
  disabled,
  onChange,
}: {
  question: L2BQuestion;
  value: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (question.type === 'text') {
    return (
      <label className="premium-lesson-body block text-sm">
        <span className="premium-lesson-title mb-2 block font-medium">{question.prompt}</span>
        <textarea
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          placeholder={question.placeholder}
          className="premium-lesson-input min-h-[120px] w-full rounded-2xl px-3 py-3 text-sm"
        />
      </label>
    );
  }

  return (
    <div className="space-y-2">
      <p className="premium-lesson-title text-sm font-medium">{question.prompt}</p>
      <div className="grid gap-2">
        {(question.options ?? []).map((option) => {
          const checked = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`premium-lesson-choice ${checked ? 'premium-lesson-choice-active' : ''}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type TeacherResponseItem = {
  studentName: string;
  response: L2BStepResponse;
};

type TextResponseItem = {
  studentName: string;
  submittedAt: number;
  text: string;
};

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

export function TeacherActivitySummary({
  activity,
  responses,
  answerVisible = false,
  onToggleAnswerVisible,
}: {
  activity?: L2BContentBlock['activity'];
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
    options: L2BChoiceOption[],
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
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${ratio}%` }}
                  />
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
          <span className="premium-lesson-tone-pill premium-tone-cyan px-2.5 py-0.5">
            {responses.length} 份提交
          </span>
        </div>
        {hasAnswer ? (
          <button
            type="button"
            onClick={onToggleAnswerVisible}
            className="premium-lesson-action-tone premium-tone-emerald"
          >
            {showAnswerKey ? '隐藏答案' : '显示答案'}
          </button>
        ) : null}
      </div>
      {choiceSummaries.length ? <div className="grid gap-4 xl:grid-cols-2">{choiceSummaries}</div> : null}
      <div className="space-y-4">{textSummaries}</div>
    </section>
  );
}

export function StudentSummaryPanel({
  courseState,
}: {
  courseState: L2BStudentCourseState;
}) {
  return (
    <section className="premium-lesson-panel-soft">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        学习回顾
      </div>
      <p className="premium-lesson-muted mt-2">
        你已累计完成 {Object.keys(courseState.responses).length} 个环节记录，可在总结时回看自己的预测、验证和 AI 对照结果。
      </p>
    </section>
  );
}
