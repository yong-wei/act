'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { BarChart3, BookOpen, CheckCircle2, ClipboardList, Sparkles } from 'lucide-react';

import type {
  L2AChoiceOption,
  L2AContentSection,
  L2AFormField,
  L2AQuestion,
  L2AStepContent,
  L2AStudentCourseState,
  L2AStepResponse,
} from '@/lib/l2a-course';

function toneClass(tone: L2AContentSection['tone']) {
  switch (tone) {
    case 'sky':
      return 'border-sky-300/30 bg-sky-500/10 text-sky-100';
    case 'emerald':
      return 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100';
    case 'amber':
      return 'border-amber-300/30 bg-amber-500/10 text-amber-100';
    case 'violet':
      return 'border-violet-300/30 bg-violet-500/10 text-violet-100';
    case 'rose':
      return 'border-rose-300/30 bg-rose-500/10 text-rose-100';
    case 'slate':
      return 'border-white/10 bg-slate-950/60 text-slate-100';
    case 'cyan':
    default:
      return 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100';
  }
}

export function StepContentPanel({
  content,
  rightSlot,
}: {
  content: L2AStepContent;
  rightSlot?: ReactNode;
}) {
  return (
    <section className="premium-lesson-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="premium-lesson-kicker rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1">
          {content.kicker}
        </span>
        {rightSlot}
      </div>

      <div className="mt-4">
        <h2 className="text-2xl font-semibold text-slate-100 sm:text-[2rem]">{content.title}</h2>
        <p className="mt-3 text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">{content.intro}</p>
      </div>

      <div className="mt-5 space-y-3">
        {content.sections.map((section) => (
          <article key={section.title} className={`rounded-2xl border p-4 ${toneClass(section.tone)}`}>
            <h3 className="text-lg font-semibold text-slate-100">{section.title}</h3>
            {section.body ? <p className="mt-2 text-base leading-7 text-slate-100">{section.body}</p> : null}
            {section.bullets?.length ? (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-base leading-7 text-slate-100">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      {content.controls?.length ? (
        <div className="premium-lesson-panel-soft mt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
            <ClipboardList className="h-4 w-4" />
            教学控制建议
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {content.controls.map((control) => (
              <span
                key={control}
                className="premium-lesson-chip px-3 py-1 text-sm"
              >
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
  savedResponse: L2AStepResponse | undefined,
  key: string,
  field: L2AFormField | L2AQuestion,
) {
  const value = savedResponse?.answers[key];
  if (field.type === 'multi' || field.type === 'checkbox-group') {
    return Array.isArray(value) ? value : [];
  }
  return typeof value === 'string' ? value : '';
}

export function StudentActivityForm({
  stepId,
  activity,
  savedResponse,
  onSubmit,
}: {
  stepId: string;
  activity: L2AStepContent['activity'];
  savedResponse?: L2AStepResponse;
  onSubmit: (response: L2AStepResponse) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string | string[]>>({});

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

  const isSubmitted = Boolean(savedResponse);

  if (!activity || activity.kind === 'none') {
    return null;
  }

  const updateValue = (key: string, value: string | string[]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const submitCurrent = () => {
    onSubmit({
      stepId,
      submittedAt: Date.now(),
      answers: draft,
    });
  };

  return (
    <section className="premium-lesson-accent-panel">
      <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
        <BookOpen className="h-4 w-4" />
        学生任务提交区
      </div>
      {activity.helper ? <p className="premium-lesson-muted mt-2">{activity.helper}</p> : null}

      <div className="mt-4 space-y-4">
        {activity.kind === 'form'
          ? (activity.fields ?? []).map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={draft[field.key]}
                disabled={false}
                onChange={(value) => updateValue(field.key, value)}
              />
            ))
          : (activity.questions ?? []).map((question) => (
              <QuestionRenderer
                key={question.key}
                question={question}
                value={draft[question.key]}
                disabled={false}
                onChange={(value) => updateValue(question.key, value)}
              />
            ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submitCurrent}
          className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-200"
        >
          <CheckCircle2 className="h-4 w-4" />
          {activity.submitLabel ?? '保存'}
        </button>
        {isSubmitted ? (
          <span className="text-sm text-emerald-200">已保存于当前课堂记录中，可重复覆盖更新。</span>
        ) : (
          <span className="premium-lesson-muted">提交后会同步到教师端汇总。</span>
        )}
      </div>
    </section>
  );
}

function FieldRenderer({
  field,
  value,
  disabled,
  onChange,
}: {
  field: L2AFormField;
  value: string | string[] | undefined;
  disabled: boolean;
  onChange: (value: string | string[]) => void;
}) {
  if (field.type === 'radio' && field.options) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-white">{field.label}</p>
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

  if (field.type === 'checkbox-group' && field.options) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-white">{field.label}</p>
        <div className="grid gap-2">
          {field.options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (checked) {
                    onChange(selected.filter((item) => item !== option.value));
                  } else {
                    onChange([...selected, option.value]);
                  }
                }}
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
      <label className="block">
        <div className="text-sm font-medium text-slate-100">{field.label}</div>
        {field.help ? <div className="mt-1 text-xs text-slate-400">{field.help}</div> : null}
        <textarea
          rows={4}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="premium-lesson-input"
        />
      </label>
    );
  }

  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-100">{field.label}</div>
      {field.help ? <div className="mt-1 text-xs text-slate-400">{field.help}</div> : null}
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        className="premium-lesson-input"
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
  question: L2AQuestion;
  value: string | string[] | undefined;
  disabled: boolean;
  onChange: (value: string | string[]) => void;
}) {
  if (question.type === 'text') {
    return (
      <label className="block">
        <div className="text-sm font-medium text-slate-100">{question.prompt}</div>
        <textarea
          rows={3}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
          className="premium-lesson-input"
        />
      </label>
    );
  }

  if (question.type === 'multi') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-100">{question.prompt}</p>
        {question.options?.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (checked) {
                  onChange(selected.filter((item) => item !== option.value));
                } else {
                  onChange([...selected, option.value]);
                }
              }}
              className={`premium-lesson-choice block w-full ${checked ? 'premium-lesson-choice-active' : ''}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-100">{question.prompt}</p>
      {question.options?.map((option) => {
        const checked = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`premium-lesson-choice block w-full ${checked ? 'premium-lesson-choice-active' : ''}`}
          >
            {option.value}. {option.label}
          </button>
        );
      })}
    </div>
  );
}

type TeacherResponseItem = {
  studentName: string;
  response: L2AStepResponse;
};

export function TeacherActivitySummary({
  activity,
  responses,
}: {
  activity: L2AStepContent['activity'];
  responses: TeacherResponseItem[];
}) {
  if (!activity || activity.kind === 'none') {
    return null;
  }

  if (responses.length === 0) {
    return (
      <section className="premium-lesson-panel-soft">
        <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
          <BarChart3 className="h-4 w-4" />
          实时课堂响应
        </div>
        <p className="mt-3 text-sm text-slate-300">暂无学生提交，教师切换到当前环节后学生提交会显示在这里。</p>
      </section>
    );
  }

  const renderChoiceStats = (key: string, label: string, options: L2AChoiceOption[]) => {
    const counts = Object.fromEntries(options.map((option) => [option.value, 0]));
    for (const item of responses) {
      const value = item.response.answers[key];
      if (typeof value === 'string' && value in counts) {
        counts[value] += 1;
      }
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry in counts) {
            counts[entry] += 1;
          }
        });
      }
    }

    return (
      <article className="premium-lesson-panel-soft rounded-2xl p-4">
        <h3 className="text-sm font-medium text-slate-100">{label}</h3>
        <div className="mt-3 space-y-2">
          {options.map((option) => {
            const count = counts[option.value] ?? 0;
            const ratio = responses.length ? (count / responses.length) * 100 : 0;
            return (
              <div key={option.value} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>{option.label}</span>
                  <span>{count} 人</span>
                </div>
                <div className="h-2 rounded-full bg-slate-700/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
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

  const renderTextSamples = (items: Array<{ label: string; values: Array<{ studentName: string; text: string }> }>) => (
    <div className="space-y-4">
      {items.map((group) => (
        <article key={group.label} className="premium-lesson-panel-soft rounded-2xl p-4">
          <h3 className="text-sm font-medium text-slate-100">{group.label}</h3>
          <div className="mt-3 space-y-3">
            {group.values.slice(0, 4).map((item) => (
              <div key={`${group.label}-${item.studentName}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-200">{item.studentName}</div>
                <div className="mt-1 text-sm leading-6 text-slate-200">{item.text}</div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );

  if (activity.kind === 'form') {
    const fields = activity.fields ?? [];
    const choiceFields = fields.filter((field) => field.type === 'radio' || field.type === 'checkbox-group');
    const textGroups = fields
      .filter((field) => field.type !== 'radio' && field.type !== 'checkbox-group')
      .map((field) => ({
        label: field.label,
        values: responses
          .map((entry) => {
            const value = entry.response.answers[field.key];
            return typeof value === 'string' && value.trim()
              ? { studentName: entry.studentName, text: value.trim() }
              : null;
          })
          .filter(Boolean) as Array<{ studentName: string; text: string }>,
      }))
      .filter((group) => group.values.length > 0);

    return (
      <section className="premium-lesson-panel space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
          <BarChart3 className="h-4 w-4" />
          实时课堂响应（{responses.length} 人）
        </div>
        {choiceFields.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {choiceFields.map((field) => renderChoiceStats(field.key, field.label, field.options ?? []))}
          </div>
        ) : null}
        {textGroups.length ? renderTextSamples(textGroups) : null}
      </section>
    );
  }

  const questions = activity.questions ?? [];
  const choiceQuestions = questions.filter((question) => question.type !== 'text');
  const textQuestions = questions
    .filter((question) => question.type === 'text')
    .map((question) => ({
      label: question.prompt,
      values: responses
        .map((entry) => {
          const value = entry.response.answers[question.key];
          return typeof value === 'string' && value.trim()
            ? { studentName: entry.studentName, text: value.trim() }
            : null;
        })
        .filter(Boolean) as Array<{ studentName: string; text: string }>,
    }))
    .filter((group) => group.values.length > 0);

  return (
    <section className="premium-lesson-panel space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
        <Sparkles className="h-4 w-4" />
        题目汇总（{responses.length} 人）
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {choiceQuestions.map((question) => renderChoiceStats(question.key, question.prompt, question.options ?? []))}
      </div>
      {textQuestions.length ? renderTextSamples(textQuestions) : null}
    </section>
  );
}

export function KnowledgeMapVisual() {
  return (
    <div className="premium-lesson-accent-panel">
      <div className="premium-lesson-kicker text-sm tracking-[0.24em]">Knowledge Map</div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MapNode title="L-1 传递函数与极点" status="已掌握" />
        <MapNode title="L-2a 时域直觉" status="当前高亮" active />
        <MapNode title="L-2b 根轨迹 / L-2c 频域" status="下一站" />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {['阶跃响应', 'Mₚ', 'tₛ', 'tᵣ', 'ζ', 'ωₙ'].map((item) => (
          <div key={item} className="premium-lesson-panel-soft rounded-2xl px-3 py-2 text-sm">
            {item}
          </div>
        ))}
      </div>
    </div>
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
      className={`rounded-[24px] border px-4 py-4 ${
        active
          ? 'premium-lesson-choice-active shadow-[0_12px_36px_rgba(34,211,238,0.18)]'
          : 'premium-lesson-panel-soft'
      }`}
    >
      <div className="text-xs uppercase tracking-[0.2em] text-slate-300">{status}</div>
      <div className="mt-2 text-base font-medium">{title}</div>
    </div>
  );
}

export function StudentSummaryPanel({
  courseState,
}: {
  courseState: L2AStudentCourseState;
}) {
  const prediction = courseState.responses['participatory-intro-3'];
  const measurement = courseState.responses['participatory-metrics-2'];
  const exploration = courseState.responses['participatory-families-2'];

  return (
    <section className="premium-lesson-summary-panel">
      <div className="flex items-center gap-2 text-sm font-medium text-violet-100">
        <Sparkles className="h-4 w-4" />
        你的学习记录
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <SummaryCard
          title="参数预测"
          value={
            prediction
              ? `ζ 预测：${String(prediction.answers.zetaPrediction ?? '未填写')}；ωₙ 预测：${String(prediction.answers.wnPrediction ?? '未填写')}`
              : '你还没有保存参数预测。'
          }
        />
        <SummaryCard
          title="三指标测量"
          value={
            measurement
              ? `Mₚ≈${String(measurement.answers.mp ?? '--')}%，tₛ≈${String(measurement.answers.ts ?? '--')}s，tᵣ≈${String(measurement.answers.tr ?? '--')}s`
              : '你还没有保存三指标测量。'
          }
        />
        <SummaryCard
          title="工作区当前状态"
          value={`ζ=${courseState.workspace.zeta.toFixed(2)}，ωₙ=${courseState.workspace.wn.toFixed(2)} rad/s`}
        />
        <SummaryCard
          title="探索中最有趣的发现"
          value={String(exploration?.answers.discovery ?? '还没有填写探索发现。')}
        />
      </div>
    </section>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="premium-lesson-panel-soft rounded-2xl p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-violet-200">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-100">{value}</div>
    </div>
  );
}
