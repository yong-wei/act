'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import 'katex/dist/katex.min.css';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import { renderInteractiveManifestStep } from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveConfig } from '@/features/interactive/types';
import {
  getInteractiveRuntimeStep,
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeModuleManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import {
  UNIT_1_1_COURSE_TITLE,
  UNIT_1_1_LESSON_STEPS,
  UNIT_1_1_STAGE_LABEL,
  type UNIT_1_1StepDefinition,
  type UNIT_1_1StepResponse,
} from '@/lib/unit-1-1-course';

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

interface MatchingPair {
  key: string;
  left: string;
  right: string;
}

interface ActivitySpec {
  kind: 'none' | 'quiz' | 'binary_choice' | 'matching';
  helper: string;
  submitLabel?: string;
  releaseLabel?: string;
  questions?: QuizQuestion[];
  fields?: FormField[];
  pairs?: MatchingPair[];
}

export interface UNIT_1_1TeacherResponseItem {
  studentName: string;
  response: UNIT_1_1StepResponse;
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

function getWordCloudEntries(responses: UNIT_1_1TeacherResponseItem[]) {
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

const UNIT_1_1_ACTIVITY_MODULE_KINDS = new Set([
  'activity.panel',
  'activity.workspace',
  'activity-card',
  'activity-card-grid',
  'activity-card-row',
  'activity-card-set',
  'binary-choice',
  'card-sort',
  'drag-match',
  'hotspot-labeling',
  'multi-select-matrix',
  'quiz-card',
  'quiz-group',
  'reason-chain',
  'single-choice-card',
  'table-builder',
  'task-card-workspace',
  'teacher-reveal-only',
  'triple-match',
]);

function isContentRuntimeModule(module: InteractiveRuntimeModuleManifest) {
  return !UNIT_1_1_ACTIVITY_MODULE_KINDS.has(module.kind);
}

function filterManifestContentStep(step: InteractiveRuntimeStepManifest): InteractiveRuntimeStepManifest {
  return {
    ...step,
    modules: step.modules.filter(isContentRuntimeModule),
  };
}

function getStepActivity(step: UNIT_1_1StepDefinition): ActivitySpec {
  switch (step.id) {
    case 'step-03':
      return {
        kind: 'quiz',
        helper: '这是开课前的三道速测题，用来暴露你在反馈直觉和基础概念上的边界。',
        submitLabel: '提交前测',
        releaseLabel: '释放前测',
        questions: [
          {
            key: 'feedbackIntuition',
            prompt: '想象你正在淋浴。你想把水温调到舒适的温度，你用手感知水温，然后调节旋钮。这是否涉及"反馈"？',
            options: [
              { value: 'A', label: '是，用手感知水温就是"测量输出"，调节旋钮是"根据误差行动"' },
              { value: 'B', label: '否，这只是一个简单的调节动作' },
              { value: 'C', label: '只有用自动控制器才算反馈' },
              { value: 'D', label: '只有工业系统才有反馈' },
            ],
            answer: 'A',
            explanation:
              '是的！用手感知水温就是"测量输出"，将感知到的温度与舒适温度比较就是"计算误差"，调节旋钮就是"根据误差行动"。这就是反馈的雏形。',
          },
          {
            key: 'openLoopLimit',
            prompt: '一个水泵以恒定功率向水箱注水，没有水位传感器。如果出水管意外堵塞，会发生什么？',
            options: [
              { value: 'A', label: '系统会自动减小流量' },
              { value: 'B', label: '水箱最终会溢出' },
              { value: 'C', label: '系统会发出警告' },
              { value: 'D', label: '水泵会自动关闭' },
            ],
            answer: 'B',
            explanation:
              '没有水位传感器（没有反馈），系统不知道出水管堵塞了，会继续以恒定功率注水，最终水箱溢出。开环系统无法感知和处理未预见的扰动。',
          },
          {
            key: 'derivativeConcept',
            prompt: '温度传感器显示当前温度每分钟上升 2°C。这个"每分钟上升 2°C"描述的是什么？',
            options: [
              { value: 'A', label: '当前温度值' },
              { value: 'B', label: '温度的变化率（导数）' },
              { value: 'C', label: '温度的平均值' },
              { value: 'D', label: '温度的累积量' },
            ],
            answer: 'B',
            explanation:
              '"每分钟上升 2°C"是在描述温度随时间的变化率，也就是导数。导数是控制理论的重要工具——它不仅告诉你"现在是多少"，还告诉你"趋势是什么"。',
          },
        ],
      };
    case 'step-09':
      return {
        kind: 'binary_choice',
        helper: '请基于本课的学习来判断：反馈控制最主要的优势是什么？',
        submitLabel: '提交选择',
        releaseLabel: '释放题目',
        fields: [
          {
            key: 'feedbackAdvantage',
            label: '反馈控制最主要的优势是什么？',
            type: 'radio',
            options: [
              { value: 'faster', label: '让所有系统都变快' },
              { value: 'robust', label: '使系统对扰动和模型不确定性更鲁棒' },
              { value: 'simpler', label: '比开环控制更简单' },
              { value: 'cheaper', label: '成本更低' },
            ],
            answer: 'robust',
          },
        ],
      };
    case 'step-14':
      return {
        kind: 'matching',
        helper: '请将左侧的控制概念/函数与右侧的正确描述配对。',
        submitLabel: '提交配对',
        releaseLabel: '释放后测',
        pairs: [
          { key: 'tf', left: 'tf()', right: '创建传递函数对象' },
          { key: 'step', left: 'step()', right: '画阶跃响应曲线' },
          { key: 'rlocus', left: 'rlocus()', right: '画根轨迹图' },
          { key: 'bode', left: 'bode()', right: '画 Bode 图' },
          { key: 'feedback', left: 'feedback()', right: '创建闭环系统' },
          { key: 'openLoop', left: '开环诊断', right: '先看清对象，再讨论怎样干预' },
          { key: 'closedLoop', left: '闭环校正', right: '根据误差行动，改写系统行为' },
        ],
      };
    default:
      return {
        kind: 'none',
        helper: '本页以教师讲授、观察和板书推进为主。',
      };
  }
}

function getAiPrompts(step: UNIT_1_1StepDefinition) {
  if (step.id !== 'step-09') {
    return [];
  }

  return [
    '请用最简单的话解释：为什么"把输出送回输入端"就能让系统表现更好？',
    '请比较开环控制与闭环控制的根本区别。如果我不能用一句话说清，请帮我精简。',
  ];
}

function buildInteractiveAiConfig(step: UNIT_1_1StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit11:${step.id}`,
    registryId: 'unit11-inline-ai',
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

function getDefaultDraft(activity: ActivitySpec, savedResponse?: UNIT_1_1StepResponse) {
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
  for (const pair of activity.pairs ?? []) {
    defaults[pair.key] = '';
  }
  return defaults;
}

// ---- Knowledge Map ----

export function UNIT_1_1KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft px-4 py-5">
      <div className="premium-lesson-kicker">Course Bridge</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 1-1 到 2-1：先看见全景，再深入细节</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['1-1 看见整门课', '从反馈思想出发，90 分钟闪电遍历建模、时域、稳定、根轨迹、频域、反馈校正全部核心主题。'],
          ['2-1 建模与变换语言', '深入第一步：怎样把真实对象写成一个标准的数学对象？'],
          ['2-2 时域响应基础', '深入第二步：阶跃响应之下，一阶/二阶的每一项指标如何推导与使用？'],
        ].map(([title, body], index) => (
          <div
            key={title}
            className={`premium-lesson-surface-elevated px-4 py-4 ${index === 0 ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            <div className="premium-lesson-title text-base font-semibold">{title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Step Content Panel ----

export function UNIT_1_1StepContentPanel({
  step,
  manifest,
}: {
  step: UNIT_1_1StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
}) {
  const manifestStep = manifest ? getInteractiveRuntimeStep(manifest, step.id) : null;
  const contentOnlyStep = useMemo(
    () => (manifestStep ? filterManifestContentStep(manifestStep) : null),
    [manifestStep],
  );
  const moduleRegistry = useMemo(
    () =>
      createManifestContentModuleRegistry({
        allowInlineReveal: true,
        revealProgress: 1,
      }),
    [],
  );

  if (!manifest || !contentOnlyStep) {
    throw new Error('Unit 1-1 runtime manifest is required for page rendering.');
  }

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="premium-lesson-tone-pill premium-tone-slate">{UNIT_1_1_STAGE_LABEL[step.stage]}</span>
        <span className="premium-lesson-tone-pill premium-tone-amber">⏱ {step.duration}</span>
      </div>
      <div className="mt-5">
        {renderInteractiveManifestStep({
          manifest,
          step: contentOnlyStep,
          moduleRegistry,
          extra: {
            allowInlineReveal: true,
            revealProgress: 1,
          },
        })}
      </div>
    </section>
  );
}

// ---- Student Activity Form ----

export function UNIT_1_1StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
}: {
  step: UNIT_1_1StepDefinition;
  savedResponse?: UNIT_1_1StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_1_1StepResponse) => void;
}) {
  const activity = useMemo(() => getStepActivity(step), [step]);
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(activity, savedResponse));
  const [matchingDraft, setMatchingDraft] = useState<Record<string, string>>(() => {
    if (savedResponse) return savedResponse.answers;
    const initial: Record<string, string> = {};
    for (const pair of activity.pairs ?? []) {
      initial[pair.key] = '';
    }
    return initial;
  });

  useEffect(() => {
    setDraft(getDefaultDraft(activity, savedResponse));
    if (activity.kind === 'matching') {
      if (savedResponse) {
        setMatchingDraft(savedResponse.answers);
      } else {
        const initial: Record<string, string> = {};
        for (const pair of activity.pairs ?? []) {
          initial[pair.key] = '';
        }
        setMatchingDraft(initial);
      }
    }
  }, [activity, savedResponse]);

  const answerFields = (activity.fields ?? []).filter((field) => field.answer);
  const shuffledPairs = useMemo<{
    lefts: MatchingPair[];
    shuffledRights: { key: string; text: string }[];
  } | null>(() => {
    if (activity.kind !== 'matching' || !activity.pairs) return null;
    const rights = activity.pairs.map((pair) => ({ key: pair.key, text: pair.right }));
    // Shuffle the right-side options.
    const shuffled = [...rights].sort(() => Math.random() - 0.5);
    return { lefts: activity.pairs, shuffledRights: shuffled };
  }, [activity]);

  if (activity.kind === 'none') {
    return null;
  }

  if (!released) {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">等待教师释放</div>
        <div className="premium-lesson-muted mt-2 text-sm">本题尚未开放，请先跟随教师讲解，等待教师释放后再作答。</div>
      </section>
    );
  }

  // Quiz / Binary_choice rendering
  if (activity.kind === 'quiz' || activity.kind === 'binary_choice') {
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
              {answerVisible ? (
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
                htmlFor={buildStudentFieldId(step.id, field.key)}
                className="premium-lesson-title block text-sm font-medium"
              >
                {field.label}
              </label>
              {field.type === 'radio' ? (
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
                <textarea
                  id={buildStudentFieldId(step.id, field.key)}
                  name={field.key}
                  aria-label={field.label}
                  value={draft[field.key] ?? ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  placeholder={field.placeholder}
                  className="premium-lesson-input mt-3 min-h-[120px]"
                />
              )}
              {answerVisible && field.answer ? (
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
      </section>
    );
  }

  // Matching pairs rendering
  if (activity.kind === 'matching' && shuffledPairs) {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
        <div className="premium-lesson-muted mt-2 text-sm">{activity.helper}</div>

        <div className="mt-4 grid gap-4">
          {shuffledPairs.lefts.map((pair) => (
            <div key={pair.key} className="premium-lesson-surface-elevated px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium mb-2">{pair.left}</div>
              <select
                aria-label={`配对：${pair.left}`}
                value={matchingDraft[pair.key] ?? ''}
                onChange={(event) =>
                  setMatchingDraft((prev) => ({ ...prev, [pair.key]: event.target.value }))
                }
                className="premium-lesson-select w-full"
              >
                <option value="" disabled>
                  选择配对项...
                </option>
                {shuffledPairs.shuffledRights.map((right) => (
                  <option key={right.key} value={right.key}>
                    {right.text}
                  </option>
                ))}
              </select>
              {answerVisible ? (
                <div className="premium-lesson-tone-block premium-tone-emerald mt-3 text-sm">
                  正确配对：{pair.right}
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
              answers: matchingDraft,
            })
          }
          className="premium-lesson-action-primary mt-4"
        >
          {activity.submitLabel ?? '提交作答'}
        </button>

        <SubmissionStatus submitted={Boolean(savedResponse)} />
      </section>
    );
  }

  return null;
}

// ---- Teacher Activity Summary ----

export function UNIT_1_1TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_1_1StepDefinition;
  responses: UNIT_1_1TeacherResponseItem[];
  released: boolean;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const activity = getStepActivity(step);
  const wordCloud = getWordCloudEntries(responses);
  const answerFields = (activity.fields ?? []).filter((field) => field.answer);

  if (activity.kind === 'none') {
    return null;
  }

  // Quiz / Binary choice summary
  if (activity.kind === 'quiz' || activity.kind === 'binary_choice') {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="premium-lesson-title text-sm font-medium">教师端汇总</div>
            <div className="premium-lesson-muted mt-1 text-sm">当前步骤已收到 {responses.length} 份提交。</div>
          </div>
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
                        <div className="mt-1 h-2 rounded-full bg-platform-surface-muted">
                          <div className="h-2 rounded-full bg-platform-accent" style={{ width: `${(count / total) * 100}%` }} />
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
                          const question = (activity.questions ?? []).find((entry) => entry.key === key);
                          return (
                            <div key={key}>
                              <span className="premium-lesson-muted">{field?.label ?? question?.prompt ?? key}：</span>
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
      </section>
    );
  }

  // Matching pairs summary
  if (activity.kind === 'matching' && activity.pairs) {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="premium-lesson-title text-sm font-medium">教师端汇总</div>
            <div className="premium-lesson-muted mt-1 text-sm">当前步骤已收到 {responses.length} 份提交。</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
              {released ? '已释放活动' : activity.releaseLabel ?? '释放活动'}
            </button>
            <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-secondary">
              {answerVisible ? '已显示答案' : '显示答案'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">正确配对</div>
            <div className="mt-3 grid gap-3">
              {activity.pairs.map((pair) => (
                <div key={pair.key} className="text-sm">
                  <div className="font-medium">{pair.left}</div>
                  <div className="premium-lesson-muted mt-1">{pair.right}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">最近提交</div>
            <div className="mt-3 grid gap-3">
              {responses.length ? (
                responses.slice(0, 6).map((item) => {
                  const correctCount = activity.pairs!.filter(
                    (pair) => item.response.answers[pair.key] === pair.key
                  ).length;
                  return (
                    <div key={`${item.studentName}-${item.response.submittedAt}`} className="rounded-2xl border border-border/60 px-3 py-3 text-sm">
                      <div className="font-medium">{item.studentName}</div>
                      <div className="premium-lesson-muted mt-1">
                        正确 {correctCount} / {activity.pairs!.length}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="premium-lesson-muted text-sm">暂无提交。</div>
              )}
            </div>
          </div>
        </div>

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

  return null;
}

// ---- Student Summary Panel ----

export function UNIT_1_1StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_1_1StepResponse>;
}) {
  const finishedSteps = UNIT_1_1_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_1_1_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {['反馈思想', '传递函数', '时域指标', '根轨迹', 'Bode 图'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是本课认知地图上的关键节点。</div>
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
        你已经走通了“诊断 → 校正 → 验证”的完整闭环。接下来的课程会带你深入每一个主题——从建模语言到时域分析、从稳定判据到校正设计。
      </div>
    </section>
  );
}

// ---- Step AI Assistant ----

export function UNIT_1_1StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_1_1StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '1-1',
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
        先仔细阅读页面内容，再使用下面的提示词与 AI 进行对话。AI 帮助你检验理解、澄清概念。
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
            <DialogTitle>{UNIT_1_1_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription>
              当前只围绕 {step.title} 回答问题，帮助你巩固“反馈思想 → 开环诊断 → 闭环校正”的认知骨架。
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
