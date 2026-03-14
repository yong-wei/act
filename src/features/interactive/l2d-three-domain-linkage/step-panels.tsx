'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Sparkles } from 'lucide-react';

import type {
  L2DContentBlock,
  L2DQuestion,
  L2DReflectionSubmission,
  L2DStudentCourseState,
  L2DTaskOneSubmission,
  L2DTaskTwoRowSubmission,
} from '@/lib/l2d-course';
import {
  L2D_PRE_ASSESSMENT_QUESTIONS,
  L2D_TASK_TWO_ROWS,
  getCourseTotals,
  scoreReflection,
  scoreTaskOne,
  scoreTaskTwoRow,
} from '@/lib/l2d-course';
import type { WorkspaceMetrics } from './workspace';

function toneClass(tone?: L2DContentBlock['sections'][number]['tone']) {
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
    case 'orange':
      return 'premium-lesson-tone-block premium-tone-orange';
    case 'slate':
      return 'premium-lesson-tone-block premium-tone-slate';
    case 'cyan':
    default:
      return 'premium-lesson-tone-block premium-tone-cyan';
  }
}

export function L2DKnowledgeMapVisual() {
  return (
    <section className="premium-lesson-accent-panel">
      <div className="premium-lesson-kicker text-sm tracking-[0.24em]">Knowledge Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">L-2d 当前位置：三域联动实践节点</h2>
      <p className="premium-lesson-body mt-2 text-sm leading-6">
        L-2d 是层0速通链路的最后一站：前面三节课分别看三张图，这一课开始把三张图同时摆到手边操作。
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <MapNode title="L-2a 时域" status="已完成" />
        <MapNode title="L-2b 根轨迹" status="已完成" />
        <MapNode title="L-2c 频域" status="已完成" />
        <MapNode title="L-2d 实践" status="当前高亮" active />
        <MapNode title="L-sum 约束图" status="下一课" />
      </div>
    </section>
  );
}

function MapNode({ title, status, active = false }: { title: string; status: string; active?: boolean }) {
  return (
    <div className={active ? 'premium-tone-cyan rounded-[24px] border px-4 py-4' : 'premium-lesson-surface-elevated rounded-[24px] border px-4 py-4'}>
      <div className="premium-lesson-caption text-[11px] uppercase tracking-[0.18em]">{status}</div>
      <div className="mt-2 text-base font-medium">{title}</div>
    </div>
  );
}

export function L2DStepContentPanel({
  content,
  rightSlot,
}: {
  content: L2DContentBlock;
  rightSlot?: ReactNode;
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

export function L2DStudentActivityForm({
  stepId,
  activity,
  courseState,
  metrics,
  answerVisible = false,
  onSavePreAssessment,
  onSaveTaskOne,
  onSaveTaskTwoRow,
  onSaveReflection,
  onSavePostAssessment,
}: {
  stepId: string;
  activity: L2DContentBlock['activity'];
  courseState: L2DStudentCourseState;
  metrics: WorkspaceMetrics;
  answerVisible?: boolean;
  onSavePreAssessment: (answers: Record<string, string>) => void;
  onSaveTaskOne: (submission: Omit<L2DTaskOneSubmission, 'score' | 'feedback' | 'submittedAt'>) => void;
  onSaveTaskTwoRow: (row: Omit<L2DTaskTwoRowSubmission, 'score' | 'checks' | 'feedback' | 'submittedAt'>) => void;
  onSaveReflection: (input: Omit<L2DReflectionSubmission, 'score' | 'feedback' | 'submittedAt'>) => void;
  onSavePostAssessment: (range: { lowerBound: string; upperBound: string }) => void;
}) {
  const [quizDraft, setQuizDraft] = useState<Record<string, string>>({});
  const [taskOneDraft, setTaskOneDraft] = useState({ kCritical: '', gammaApprox: '', observation: '' });
  const [reflectionDraft, setReflectionDraft] = useState({ surpriseText: '', selectedOption: '' as '' | 'A' | 'B', answerText: '' });
  const [postRangeDraft, setPostRangeDraft] = useState({ lowerBound: '', upperBound: '' });

  useEffect(() => {
    setQuizDraft(courseState.preAssessment?.answers ?? {});
    setTaskOneDraft({
      kCritical: courseState.taskOne ? String(courseState.taskOne.kCritical) : '',
      gammaApprox: courseState.taskOne?.gammaApprox ?? '',
      observation: courseState.taskOne?.observation ?? '',
    });
    setReflectionDraft({
      surpriseText: courseState.reflection?.surpriseText ?? '',
      selectedOption: courseState.reflection?.selectedOption ?? '',
      answerText: courseState.reflection?.answerText ?? '',
    });
    setPostRangeDraft({
      lowerBound: courseState.postAssessment?.lowerBound ?? '',
      upperBound: courseState.postAssessment?.upperBound ?? '',
    });
  }, [courseState.postAssessment?.lowerBound, courseState.postAssessment?.upperBound, courseState.preAssessment?.answers, courseState.reflection?.answerText, courseState.reflection?.selectedOption, courseState.reflection?.surpriseText, courseState.taskOne]);

  if (!activity || activity.kind === 'none') {
    return null;
  }

  return (
    <section className="premium-lesson-accent-panel">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <BookOpen className="h-4 w-4" />
        学生活动与提交区
      </div>
      {activity.helper ? <p className="premium-lesson-muted mt-2">{activity.helper}</p> : null}

      {activity.kind === 'quiz' ? (
        <div className="mt-4 space-y-4">
          {(activity.questions ?? L2D_PRE_ASSESSMENT_QUESTIONS).map((question) => (
            <QuestionRenderer
              key={question.key}
              question={question}
              value={quizDraft[question.key] ?? ''}
              answerVisible={answerVisible}
              onChange={(value) => setQuizDraft((prev) => ({ ...prev, [question.key]: value }))}
            />
          ))}
          <button type="button" onClick={() => onSavePreAssessment(quizDraft)} className="premium-lesson-action-primary">
            {activity.submitLabel ?? '提交'}
          </button>
        </div>
      ) : null}

      {activity.kind === 'taskOne' ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="premium-lesson-control block">
              <span className="mb-2 block text-sm font-medium">我找到的临界 K 值</span>
              <input
                value={taskOneDraft.kCritical}
                onChange={(event) => setTaskOneDraft((prev) => ({ ...prev, kCritical: event.target.value }))}
                className="premium-lesson-input"
                placeholder="例如 41.8"
              />
            </label>
            <label className="premium-lesson-control block">
              <span className="mb-2 block text-sm font-medium">此时 γ ≈</span>
              <input
                value={taskOneDraft.gammaApprox}
                onChange={(event) => setTaskOneDraft((prev) => ({ ...prev, gammaApprox: event.target.value }))}
                className="premium-lesson-input"
                placeholder="例如 1.2°"
              />
            </label>
          </div>
          <label className="premium-lesson-control block">
            <span className="mb-2 block text-sm font-medium">我观察到的时域变化</span>
            <textarea
              value={taskOneDraft.observation}
              onChange={(event) => setTaskOneDraft((prev) => ({ ...prev, observation: event.target.value }))}
              className="premium-lesson-input min-h-[96px]"
              placeholder="例如：响应从收敛振荡变成接近等幅振荡。"
            />
          </label>
          <div className="premium-lesson-tone-block premium-tone-slate">
            当前工作区读数：K={metrics.gain.toFixed(2)}，γ={metrics.gamma.toFixed(1)}°，主极点 σ={metrics.sigma.toFixed(3)}，ω={metrics.omega.toFixed(3)}
          </div>
          <button
            type="button"
            onClick={() =>
              onSaveTaskOne({
                kCritical: Number(taskOneDraft.kCritical),
                gammaApprox: taskOneDraft.gammaApprox,
                observation: taskOneDraft.observation,
              })
            }
            className="premium-lesson-action-primary"
          >
            提交任务一
          </button>
          {courseState.taskOne ? (
            <FeedbackBox title={`当前最高分：${courseState.taskOne.score} / 30`} tone={courseState.taskOne.score >= 30 ? 'emerald' : courseState.taskOne.score > 0 ? 'amber' : 'rose'}>
              {courseState.taskOne.feedback}
            </FeedbackBox>
          ) : null}
        </div>
      ) : null}

      {activity.kind === 'taskTwo' ? (
        <div className="mt-4 space-y-4">
          <div className="premium-lesson-tone-block premium-tone-slate">
            当前工作区读数可直接抄入：σ={metrics.sigma.toFixed(3)}，ω={metrics.omega.toFixed(3)}，超调量={metrics.mp.toFixed(1)}%，调节时间={metrics.ts.toFixed(2)} s，相位裕度={metrics.gamma.toFixed(1)}°。
          </div>
          <div className="space-y-3">
            {L2D_TASK_TWO_ROWS.map((rowId, index) => (
              <TaskTwoRowEditor
                key={rowId}
                rowId={rowId}
                index={index}
                savedRow={courseState.taskTwoRows[rowId]}
                metrics={metrics}
                previousRow={index > 0 ? courseState.taskTwoRows[L2D_TASK_TWO_ROWS[index - 1]] : undefined}
                onSave={onSaveTaskTwoRow}
              />
            ))}
          </div>
        </div>
      ) : null}

      {activity.kind === 'reflection' ? (
        <div className="mt-4 space-y-4">
          <label className="premium-lesson-control block">
            <span className="mb-2 block text-sm font-medium">描述一个今天让你意外的现象</span>
            <textarea
              value={reflectionDraft.surpriseText}
              onChange={(event) => setReflectionDraft((prev) => ({ ...prev, surpriseText: event.target.value }))}
              className="premium-lesson-input min-h-[120px]"
              placeholder="至少写满一句话。"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setReflectionDraft((prev) => ({ ...prev, selectedOption: prev.selectedOption === 'A' ? '' : 'A', answerText: prev.selectedOption === 'A' ? prev.answerText : '' }))}
              className={`premium-lesson-selectable-card text-left ${reflectionDraft.selectedOption === 'A' ? 'premium-lesson-selectable-card-active' : ''}`}
            >
              <div className="text-sm font-semibold">选题 A</div>
              <div className="mt-1 text-sm">用一句话总结 Mp 和 γ 之间的规律。</div>
            </button>
            <button
              type="button"
              onClick={() => setReflectionDraft((prev) => ({ ...prev, selectedOption: prev.selectedOption === 'B' ? '' : 'B', answerText: prev.selectedOption === 'B' ? prev.answerText : '' }))}
              className={`premium-lesson-selectable-card text-left ${reflectionDraft.selectedOption === 'B' ? 'premium-lesson-selectable-card-active' : ''}`}
            >
              <div className="text-sm font-semibold">选题 B</div>
              <div className="mt-1 text-sm">用你的对照表数据验证 γ≈100ζ° 是否近似成立。</div>
            </button>
          </div>
          <label className="premium-lesson-control block">
            <span className="mb-2 block text-sm font-medium">选答内容</span>
            <textarea
              value={reflectionDraft.answerText}
              onChange={(event) => setReflectionDraft((prev) => ({ ...prev, answerText: event.target.value }))}
              className="premium-lesson-input min-h-[120px]"
              placeholder="如果选 B，建议带入具体数值。"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              onSaveReflection({
                surpriseText: reflectionDraft.surpriseText,
                selectedOption: reflectionDraft.selectedOption,
                answerText: reflectionDraft.answerText,
              })
            }
            className="premium-lesson-action-primary"
          >
            提交反思
          </button>
          {courseState.reflection ? (
            <FeedbackBox title={`本项得分：${courseState.reflection.score} / 30`} tone={courseState.reflection.score >= 30 ? 'emerald' : courseState.reflection.score >= 20 ? 'amber' : 'rose'}>
              {courseState.reflection.feedback.length ? courseState.reflection.feedback.join('；') : '已提交，你可以继续向页内 AI 助手追问自己的发现。'}
            </FeedbackBox>
          ) : null}
        </div>
      ) : null}

      {activity.kind === 'postRange' ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="premium-lesson-control block">
              <span className="mb-2 block text-sm font-medium">区间下界</span>
              <input
                value={postRangeDraft.lowerBound}
                onChange={(event) => setPostRangeDraft((prev) => ({ ...prev, lowerBound: event.target.value }))}
                className="premium-lesson-input"
                placeholder="例如 1"
              />
            </label>
            <label className="premium-lesson-control block">
              <span className="mb-2 block text-sm font-medium">区间上界</span>
              <input
                value={postRangeDraft.upperBound}
                onChange={(event) => setPostRangeDraft((prev) => ({ ...prev, upperBound: event.target.value }))}
                className="premium-lesson-input"
                placeholder="例如 8"
              />
            </label>
          </div>
          <button type="button" onClick={() => onSavePostAssessment(postRangeDraft)} className="premium-lesson-action-primary">
            {activity.submitLabel ?? '提交'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function QuestionRenderer({
  question,
  value,
  answerVisible,
  onChange,
}: {
  question: L2DQuestion;
  value: string;
  answerVisible: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="premium-lesson-surface-elevated rounded-[22px] px-4 py-4">
      <div className="text-sm font-semibold">{question.prompt}</div>
      {question.type === 'single' ? (
        <div className="mt-3 grid gap-2">
          {question.options?.map((option) => {
            const selected = value === option.value;
            const correct = answerVisible && question.answer === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={`premium-lesson-selectable-card text-left ${selected ? 'premium-lesson-selectable-card-active' : ''} ${correct ? 'ring-2 ring-emerald-400/70' : ''}`}
              >
                <div className="text-sm font-medium">{option.label}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="premium-lesson-input mt-3 min-h-[96px]"
          placeholder={question.placeholder}
        />
      )}
    </div>
  );
}

function TaskTwoRowEditor({
  rowId,
  index,
  savedRow,
  metrics,
  previousRow,
  onSave,
}: {
  rowId: string;
  index: number;
  savedRow?: L2DTaskTwoRowSubmission;
  metrics: WorkspaceMetrics;
  previousRow?: L2DTaskTwoRowSubmission;
  onSave: (row: Omit<L2DTaskTwoRowSubmission, 'score' | 'checks' | 'feedback' | 'submittedAt'>) => void;
}) {
  const [draft, setDraft] = useState({
    k: '',
    sigma: '',
    omega: '',
    mp: '',
    ts: '',
    gamma: '',
  });

  useEffect(() => {
    setDraft({
      k: savedRow ? String(savedRow.k) : '',
      sigma: savedRow ? String(savedRow.sigma) : '',
      omega: savedRow ? String(savedRow.omega) : '',
      mp: savedRow ? String(savedRow.mp) : '',
      ts: savedRow ? String(savedRow.ts) : '',
      gamma: savedRow ? String(savedRow.gamma) : '',
    });
  }, [savedRow]);

  const preview = useMemo(
    () =>
      scoreTaskTwoRow(
        {
          rowId,
          k: Number(draft.k),
          sigma: Number(draft.sigma),
          omega: Number(draft.omega),
          mp: Number(draft.mp),
          ts: Number(draft.ts),
          gamma: Number(draft.gamma),
        },
        previousRow ?? null,
      ),
    [draft.gamma, draft.k, draft.mp, draft.omega, draft.sigma, draft.ts, previousRow, rowId],
  );

  return (
    <div className="premium-lesson-surface-elevated rounded-[24px] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">第 {index + 1} 行</div>
        {savedRow ? <span className="premium-lesson-chip">最高分 {savedRow.score} / 10</span> : null}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SmallField label="K" value={draft.k} onChange={(value) => setDraft((prev) => ({ ...prev, k: value }))} />
        <SmallField label="σ" value={draft.sigma} onChange={(value) => setDraft((prev) => ({ ...prev, sigma: value }))} />
        <SmallField label="ω" value={draft.omega} onChange={(value) => setDraft((prev) => ({ ...prev, omega: value }))} />
        <SmallField label="Mp (%)" value={draft.mp} onChange={(value) => setDraft((prev) => ({ ...prev, mp: value }))} />
        <SmallField label="ts (s)" value={draft.ts} onChange={(value) => setDraft((prev) => ({ ...prev, ts: value }))} />
        <SmallField label="γ (°)" value={draft.gamma} onChange={(value) => setDraft((prev) => ({ ...prev, gamma: value }))} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setDraft({
              k: metrics.gain.toFixed(2),
              sigma: metrics.sigma.toFixed(3),
              omega: metrics.omega.toFixed(3),
              mp: metrics.mp.toFixed(1),
              ts: metrics.ts.toFixed(2),
              gamma: metrics.gamma.toFixed(1),
            })
          }
          className="premium-lesson-action-secondary"
        >
          读取当前工作区
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              rowId,
              k: Number(draft.k),
              sigma: Number(draft.sigma),
              omega: Number(draft.omega),
              mp: Number(draft.mp),
              ts: Number(draft.ts),
              gamma: Number(draft.gamma),
            })
          }
          className="premium-lesson-action-primary"
        >
          记录这一行
        </button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {preview.checks.map((check) => (
          <div key={check.label} className="premium-lesson-tone-block premium-tone-slate">
            <div className="text-sm font-semibold">{check.label}</div>
            <div className="mt-1 text-sm">{check.score} 分</div>
            {check.feedback ? <div className="mt-2 text-sm leading-6">{check.feedback}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SmallField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="premium-lesson-control block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="premium-lesson-input" />
    </label>
  );
}

function FeedbackBox({ title, children, tone }: { title: string; children: string; tone: 'emerald' | 'amber' | 'rose' }) {
  const className = tone === 'emerald' ? 'premium-tone-emerald' : tone === 'amber' ? 'premium-tone-amber' : 'premium-tone-rose';
  return (
    <div className={`premium-lesson-tone-block ${className}`}>
      <div className="font-semibold">{title}</div>
      <div className="mt-2 leading-6">{children}</div>
    </div>
  );
}

type TeacherStudentRecord = {
  studentName: string;
  state: L2DStudentCourseState;
};

export function L2DTeacherActivitySummary({
  stepId,
  studentStates,
  answerVisible,
  onToggleAnswerVisible,
}: {
  stepId: string;
  studentStates: TeacherStudentRecord[];
  answerVisible: boolean;
  onToggleAnswerVisible: () => void;
}) {
  if (stepId === 'step-04') {
    const counts = L2D_PRE_ASSESSMENT_QUESTIONS.map((question) => {
      const tally = new Map<string, number>();
      for (const student of studentStates) {
        const answer = student.state.preAssessment?.answers?.[question.key];
        if (answer) {
          tally.set(answer, (tally.get(answer) ?? 0) + 1);
        }
      }
      return { question, tally };
    });

    return (
      <section className="premium-lesson-panel-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4" />
            前测统计
          </div>
          <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-secondary">
            {answerVisible ? '隐藏答案' : '显示答案'}
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {counts.map(({ question, tally }) => (
            <div key={question.key} className="premium-lesson-surface-elevated rounded-[22px] px-4 py-4">
              <div className="text-sm font-semibold">{question.prompt}</div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {question.options?.map((option) => (
                  <div key={option.value} className={`rounded-2xl border px-3 py-3 ${answerVisible && option.value === question.answer ? 'premium-tone-emerald' : 'premium-lesson-surface-elevated'}`}>
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="mt-2 text-sm">{tally.get(option.value) ?? 0} 人</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (stepId === 'step-07') {
    const submissions = studentStates
      .map((item) => ({ studentName: item.studentName, submission: item.state.taskOne }))
      .filter((item): item is { studentName: string; submission: L2DTaskOneSubmission } => Boolean(item.submission));

    const bands = {
      full: submissions.filter((item) => item.submission.score === 30).length,
      partial: submissions.filter((item) => item.submission.score === 15).length,
      zero: submissions.filter((item) => item.submission.score === 0).length,
    };

    return (
      <section className="premium-lesson-panel-soft">
        <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4" />
          任务一监控（OBS-01）
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <MetricTile label="已提交人数" value={`${submissions.length}`} />
          <MetricTile label="30 分" value={`${bands.full}`} />
          <MetricTile label="15 / 0 分" value={`${bands.partial + bands.zero}`} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {submissions.slice(0, 8).map((item) => (
            <div key={item.studentName} className="premium-lesson-surface-elevated rounded-[18px] px-3 py-3 text-sm">
              <div className="font-semibold">{item.studentName}</div>
              <div className="mt-1">K={item.submission.kCritical.toFixed(2)} · {item.submission.score} 分</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (stepId === 'step-10') {
    const stats = L2D_TASK_TWO_ROWS.map((rowId) => {
      const rows = studentStates
        .map((item) => item.state.taskTwoRows[rowId])
        .filter((row): row is L2DTaskTwoRowSubmission => Boolean(row));
      const average = rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : 0;
      return { rowId, count: rows.length, average };
    });

    return (
      <section className="premium-lesson-panel-soft">
        <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4" />
          任务二监控（OBS-02）
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {stats.map((item, index) => (
            <div key={item.rowId} className="premium-lesson-surface-elevated rounded-[18px] px-3 py-3">
              <div className="text-sm font-semibold">第 {index + 1} 行</div>
              <div className="mt-2 text-sm">{item.count} 人提交</div>
              <div className="mt-1 text-sm">平均 {item.average.toFixed(1)} / 10</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (stepId === 'step-12') {
    const reflections = studentStates
      .map((item) => ({ studentName: item.studentName, reflection: item.state.reflection }))
      .filter((item): item is { studentName: string; reflection: L2DReflectionSubmission } => Boolean(item.reflection));
    const words = buildWordCloud(reflections.map((item) => item.reflection.surpriseText));

    return (
      <section className="premium-lesson-panel-soft">
        <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          发现与反思（OBS-03）
        </div>
        <div className="mt-4 rounded-[22px] border border-border/70 px-4 py-4">
          <div className="text-sm font-semibold">词云</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {words.length ? (
              words.map((word) => (
                <span
                  key={word.text}
                  className="premium-lesson-surface-elevated rounded-full px-3 py-1"
                  style={{ fontSize: `${12 + word.weight * 2}px` }}
                >
                  {word.text}
                </span>
              ))
            ) : (
              <span className="premium-lesson-muted text-sm">暂无文本提交。</span>
            )}
          </div>
        </div>
        <ResponseList title="学生回复列表" items={reflections.map((item) => ({ label: item.studentName, body: item.reflection.surpriseText }))} />
      </section>
    );
  }

  if (stepId === 'step-13') {
    const intervals = studentStates
      .map((item) => ({ studentName: item.studentName, value: item.state.postAssessment }))
      .filter((item): item is { studentName: string; value: NonNullable<L2DStudentCourseState['postAssessment']> } => Boolean(item.value));

    return (
      <section className="premium-lesson-panel-soft">
        <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4" />
          后测区间统计（OBS-POST）
        </div>
        <ResponseList
          title="学生区间"
          items={intervals.map((item) => ({
            label: item.studentName,
            body: `K ∈ [${item.value.lowerBound || '—'}, ${item.value.upperBound || '—'}]`,
          }))}
        />
      </section>
    );
  }

  return (
    <section className="premium-lesson-panel-soft">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        当前环节提示
      </div>
      <p className="premium-lesson-muted mt-3 text-sm">这一页以讲授或探索为主，教师端重点关注学生是否进入状态、是否能顺利读取三域指标。</p>
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="premium-lesson-surface-elevated rounded-[18px] px-3 py-3">
      <div className="premium-lesson-caption text-[11px] uppercase tracking-[0.16em]">{label}</div>
      <div className="premium-lesson-title mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

function ResponseList({ title, items }: { title: string; items: Array<{ label: string; body: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-[22px] border border-border/70 px-4 py-4">
      <button type="button" onClick={() => setOpen((prev) => !prev)} className="premium-lesson-title flex w-full items-center justify-between gap-3 text-left text-sm font-medium">
        <span>{title}</span>
        <span className="premium-lesson-caption inline-flex items-center gap-1 text-xs">
          {items.length} 条
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2">
          {items.length ? (
            items.map((item, index) => (
              <div key={`${item.label}-${index}`} className="premium-lesson-surface-elevated rounded-[18px] px-3 py-3">
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="mt-1 text-sm leading-6">{item.body}</div>
              </div>
            ))
          ) : (
            <div className="premium-lesson-muted text-sm">暂无内容。</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function buildWordCloud(texts: string[]) {
  const count = new Map<string, number>();
  for (const text of texts) {
    const tokens = text.match(/[\u4e00-\u9fa5]{2,6}|[A-Za-z][A-Za-z-]+|\d+(?:\.\d+)?/g) ?? [];
    for (const token of tokens) {
      count.set(token, (count.get(token) ?? 0) + 1);
    }
  }
  return Array.from(count.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 16)
    .map(([text, weight]) => ({ text, weight }));
}

export function L2DStudentSummaryPanel({ courseState }: { courseState: L2DStudentCourseState }) {
  const totals = getCourseTotals(courseState);
  return (
    <section className="premium-lesson-accent-panel">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        个人成绩概览
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricTile label="任务一" value={`${totals.taskOne} / 30`} />
        <MetricTile label="任务二" value={`${totals.taskTwo} / 40`} />
        <MetricTile label="任务三" value={`${totals.reflection} / 30`} />
        <MetricTile label="总分" value={`${totals.total} / 100`} />
      </div>
    </section>
  );
}
