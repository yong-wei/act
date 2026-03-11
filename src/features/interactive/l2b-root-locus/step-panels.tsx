'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, ClipboardList, Copy, Sparkles } from 'lucide-react';

import type {
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

function toneClass(tone: L2BSection['tone']) {
  switch (tone) {
    case 'sky':
      return 'border-sky-200 bg-sky-50 text-sky-900';
    case 'emerald':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'violet':
      return 'border-violet-200 bg-violet-50 text-violet-900';
    case 'rose':
      return 'border-rose-200 bg-rose-50 text-rose-900';
    case 'slate':
      return 'border-slate-200 bg-slate-50 text-slate-900';
    case 'cyan':
    default:
      return 'border-cyan-200 bg-cyan-50 text-cyan-900';
  }
}

export function KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel">
      <div className="premium-lesson-kicker">Knowledge Map</div>
      <h2 className="mt-1 text-xl font-semibold text-slate-900">L-2b 当前位置：根轨迹直觉层</h2>
      <div className="premium-lesson-panel-soft mt-4 overflow-x-auto">
        <div className="min-w-[540px] rounded-[24px] border border-cyan-100 bg-white px-4 py-5 text-sm text-slate-700">
          L-0 → L-1 → L-2a ✓ → <span className="font-semibold text-cyan-700">[L-2b 你在这里]</span> → L-2c → L-∑
        </div>
      </div>
    </section>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="premium-lesson-kicker rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-700">
          {content.kicker}
        </span>
        {rightSlot}
      </div>

      <div className="mt-4">
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-[2rem]">{content.title}</h2>
        <p className="mt-3 text-base leading-7 text-slate-700 sm:text-lg sm:leading-8">{content.intro}</p>
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
          <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <Image src={mediaSrc} alt={mediaAlt ?? content.title} fill className="object-contain" />
          </div>
        </div>
      ) : null}

      {content.controls?.length ? (
        <div className="premium-lesson-panel-soft mt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-cyan-700">
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
  onSubmit,
}: {
  stepId: string;
  activity: L2BContentBlock['activity'];
  savedResponse?: L2BStepResponse;
  courseState: L2BStudentCourseState;
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
      <div className="flex items-center gap-2 text-sm font-medium text-cyan-700">
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
                onChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
              />
            ))
          : questions.map((question) => (
              <QuestionRenderer
                key={question.key}
                question={question}
                value={draft[question.key]}
                onChange={(value) => setDraft((prev) => ({ ...prev, [question.key]: value }))}
              />
            ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submitCurrent}
          className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
        >
          <CheckCircle2 className="h-4 w-4" />
          {activity.submitLabel ?? '保存'}
        </button>
        <span className="premium-lesson-muted">提交后会同步到教师端汇总。</span>
      </div>
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
  const prompt = `对于闭环系统特征方程 s²+2s+K=0，
当K等于多少时，阻尼比ζ=0.707？
请给出极点坐标和计算过程。`;
  const predictionResponse = courseState.responses['prediction'];
  const verifyResponse = courseState.responses['verify-and-ray'];

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
    window.open('/ai', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="premium-lesson-panel-soft mt-4 space-y-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-violet-700">
          <Sparkles className="h-4 w-4" />
          向 AI 助手提问
        </div>
        <pre className="premium-lesson-input mt-3 whitespace-pre-wrap rounded-2xl px-3 py-3 text-sm">{prompt}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="inline-flex items-center gap-2 rounded-full border border-violet-200 px-3 py-2 text-xs text-violet-700"
          >
            <Copy className="h-3.5 w-3.5" />
            {copyState === 'done' ? '已复制提示词' : copyState === 'failed' ? '复制失败，请重试' : '复制提示词'}
          </button>
          <button
            type="button"
            onClick={openAssistant}
            className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700"
          >
            打开AI助手
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm text-slate-700">
          <span className="mb-2 block font-medium text-slate-900">你的预测</span>
          <div className="premium-lesson-input rounded-2xl px-3 py-3 text-sm">
            {predictionResponse?.answers['prediction-choice'] || '将在此对照'}
          </div>
        </label>
        <label className="block text-sm text-slate-700">
          <span className="mb-2 block font-medium text-slate-900">平台验证</span>
          <div className="premium-lesson-input rounded-2xl px-3 py-3 text-sm">
            {verifyResponse?.answers['ray-k']
              ? `K ≈ ${verifyResponse.answers['ray-k']}，极点 ${verifyResponse.answers['ray-pole'] || '待补充'}`
              : '将在此对照'}
          </div>
        </label>
        <label className="block text-sm text-slate-700">
          <span className="mb-2 block font-medium text-slate-900">AI 给出的 K</span>
          <input
            className="premium-lesson-input w-full rounded-2xl px-3 py-3 text-sm"
            value={draft['ai-k'] ?? ''}
            onChange={(event) => onChange({ ...draft, 'ai-k': event.target.value })}
            placeholder="填写 AI 的结果"
          />
        </label>
      </div>
    </div>
  );
}

function PriorIntuitionRecall({ courseState }: { courseState: L2BStudentCourseState }) {
  const firstImpression = courseState.responses['scenario-question']?.answers['first-impression'];
  if (!firstImpression) {
    return null;
  }

  return (
    <div className="premium-lesson-panel-soft mt-4 rounded-2xl border border-sky-200 bg-sky-50">
      <div className="text-sm font-medium text-sky-700">你在 step-02 写下的初始直觉</div>
      <p className="mt-2 text-sm leading-6 text-slate-700">💬 {firstImpression}</p>
    </div>
  );
}

function SummaryGoalReview({ courseState }: { courseState: L2BStudentCourseState }) {
  const predictionChoice = courseState.responses['prediction']?.answers['prediction-choice'];
  const rayK = courseState.responses['verify-and-ray']?.answers['ray-k'];
  const aiK = courseState.responses['ai-compare']?.answers['ai-k'];

  return (
    <div className="premium-lesson-panel-soft mt-4 space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
        <div className="text-sm font-medium text-emerald-700">回到课前的三个目标</div>
        <div className="mt-3 grid gap-2 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 rounded border-slate-300" />
            我能解释极点迁移
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 rounded border-slate-300" />
            我能读根轨迹图
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 rounded border-slate-300" />
            我能用45°射线定位 K
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <div className="font-medium text-slate-900">step-13 预测</div>
          <div className="mt-2">{predictionChoice || '尚未记录'}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <div className="font-medium text-slate-900">step-14 平台验证</div>
          <div className="mt-2">{rayK ? `K ≈ ${rayK}` : '尚未记录'}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <div className="font-medium text-slate-900">step-15 AI 对比</div>
          <div className="mt-2">{aiK ? `AI 给出 K ≈ ${aiK}` : '尚未记录'}</div>
        </div>
      </div>
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: L2BFormField;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  if (field.type === 'radio' && field.options) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-900">{field.label}</p>
        <div className="grid gap-2">
          {field.options.map((option) => {
            const checked = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
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
      <label className="block text-sm text-slate-700">
        <span className="mb-2 block font-medium text-slate-900">{field.label}</span>
        <textarea
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="premium-lesson-input min-h-[120px] w-full rounded-2xl px-3 py-3 text-sm"
        />
      </label>
    );
  }

  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-2 block font-medium text-slate-900">{field.label}</span>
      <input
        value={value ?? ''}
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
  onChange,
}: {
  question: L2BQuestion;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  if (question.type === 'text') {
    return (
      <label className="block text-sm text-slate-700">
        <span className="mb-2 block font-medium text-slate-900">{question.prompt}</span>
        <textarea
          value={value ?? ''}
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
      <p className="text-sm font-medium text-slate-900">{question.prompt}</p>
      <div className="grid gap-2">
        {(question.options ?? []).map((option) => {
          const checked = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
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

export function TeacherActivitySummary({
  responses,
}: {
  responses: Array<{ studentName: string; response: L2BStudentCourseState['responses'][string] }>;
}) {
  return (
    <section className="premium-lesson-panel-soft">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <ClipboardList className="h-4 w-4 text-cyan-700" />
        教师端汇总
      </div>
      <p className="premium-lesson-muted mt-2">本环节已收到 {responses.length} 份学生提交。</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {responses.length ? (
          responses.map((item) => (
            <span key={`${item.studentName}-${item.response.stepId}`} className="premium-lesson-chip">
              {item.studentName}
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-500">暂无学生提交。</span>
        )}
      </div>
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
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        学习回顾
      </div>
      <p className="premium-lesson-muted mt-2">
        你已累计完成 {Object.keys(courseState.responses).length} 个环节记录，可在总结时回看自己的预测、验证和 AI 对照结果。
      </p>
    </section>
  );
}
