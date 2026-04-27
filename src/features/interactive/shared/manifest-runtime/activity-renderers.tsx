'use client';

import { createElement, Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import {
  buildPerCardSubmissionAnswers,
  mergeSavedAnswersIntoDraft,
} from '@/features/interactive/shared/per-card-response-utils';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type {
  InteractiveRuntimeActivityCardManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';

export type StudentInteractiveActivityRendererProps<TStep, TResponse> = {
  step: TStep;
  stepManifest: InteractiveRuntimeStepManifest;
  savedResponse?: TResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: TResponse) => void;
};

export type StudentInteractiveActivityRegistry<TStep, TResponse> = Record<
  string,
  (props: StudentInteractiveActivityRendererProps<TStep, TResponse>) => ReactNode
>;

export function renderStudentInteractiveActivity<TStep, TResponse>({
  registry,
  step,
  stepManifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  registry: StudentInteractiveActivityRegistry<TStep, TResponse>;
  step: TStep;
  stepManifest: InteractiveRuntimeStepManifest;
  savedResponse?: TResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: TResponse) => void;
}) {
  const Renderer = registry[stepManifest.interactionSpec.interactionKind];
  if (!Renderer) {
    return null;
  }
  return createElement(Renderer, {
    step,
    stepManifest,
    savedResponse,
    released,
    browseEnabled,
    answerVisible,
    revealProgress,
    onSubmit,
  });
}

export type TeacherInteractiveActivityRendererProps<TStep, TResponse> = {
  step: TStep;
  stepManifest: InteractiveRuntimeStepManifest;
  responses: TResponse[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
};

export type TeacherInteractiveActivityRegistry<TStep, TResponse> = Record<
  string,
  (props: TeacherInteractiveActivityRendererProps<TStep, TResponse>) => ReactNode
>;

export function renderTeacherInteractiveActivity<TStep, TResponse>({
  registry,
  step,
  stepManifest,
  responses,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  registry: TeacherInteractiveActivityRegistry<TStep, TResponse>;
  step: TStep;
  stepManifest: InteractiveRuntimeStepManifest;
  responses: TResponse[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const Renderer = registry[stepManifest.interactionSpec.interactionKind];
  if (!Renderer) {
    return null;
  }
  return createElement(Renderer, {
    step,
    stepManifest,
    responses,
    released,
    browseEnabled,
    answerVisible,
    revealProgress,
    onToggleRelease,
    onToggleBrowse,
    onToggleAnswerVisible,
    onAdvanceReveal,
    onResetReveal,
  });
}

export interface ManifestStepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

type TeacherResponseItem = {
  studentName: string;
  response: ManifestStepResponse;
};

function normalizeMath(value: string) {
  return value
    .trim()
    .replace(/^\$/, '')
    .replace(/\$$/, '')
    .replace(/\\\\/g, '\\');
}

function renderActivityInlineContent(text: string) {
  const parts = text.split(/(\$[^$]+\$)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      return <InlineMath key={`${part}-${index}`} math={normalizeMath(part)} />;
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function cardsFor(stepManifest: InteractiveRuntimeStepManifest) {
  return stepManifest.interactionSpec.activityCards ?? [];
}

function cardTitle(card: InteractiveRuntimeActivityCardManifest, index: number) {
  return card.title?.trim() || `作答 ${index + 1}`;
}

function ReferenceAnswer({
  card,
}: {
  card: InteractiveRuntimeActivityCardManifest;
}) {
  if (card.referenceAnswer?.trim()) {
    return (
      <span>
        <strong>参考解释：</strong>
        {renderActivityInlineContent(card.referenceAnswer)}
      </span>
    );
  }

  return (
    <span data-manifest-missing-field={`${card.id}:referenceAnswer`}>
      manifest 未提供本卡参考答案，请在 activity_cards[].reference_answer 中补齐。
    </span>
  );
}

function isSingleChoiceCard(card: InteractiveRuntimeActivityCardManifest) {
  return card.responseKind === 'single_choice' || card.responseKind === 'binary_choice';
}

function isMultiSelectCard(card: InteractiveRuntimeActivityCardManifest) {
  return card.responseKind === 'multi_select';
}

function StudentCardAnswerInput({
  card,
  value,
  onChange,
}: {
  card: InteractiveRuntimeActivityCardManifest;
  value: string;
  onChange: (value: string) => void;
}) {
  if (isMultiSelectCard(card)) {
    if (!card.options.length) {
      return (
        <div
          className="premium-lesson-tone-block premium-tone-amber mt-3 text-sm leading-7"
          data-manifest-missing-field={`${card.id}:options`}
        >
          manifest 未提供本多选题选项，请在 activity_cards[].options 中补齐。
        </div>
      );
    }

    const selectedValues = new Set(value.split('|').filter(Boolean));
    return (
      <fieldset className="mt-3 space-y-2">
        <legend className="sr-only">{card.title ?? card.prompt}</legend>
        {card.options.map((option) => {
          const selected = selectedValues.has(option.value);
          return (
            <label
              key={option.value}
              className="premium-lesson-surface-elevated flex cursor-pointer items-start gap-3 px-4 py-3 text-sm leading-6"
            >
              <input
                type="checkbox"
                value={option.value}
                checked={selected}
                onChange={() => {
                  const next = new Set(selectedValues);
                  if (selected) {
                    next.delete(option.value);
                  } else {
                    next.add(option.value);
                  }
                  onChange(Array.from(next).join('|'));
                }}
                className="mt-1"
              />
              <span>{renderActivityInlineContent(option.label)}</span>
            </label>
          );
        })}
      </fieldset>
    );
  }

  if (isSingleChoiceCard(card)) {
    if (!card.options.length) {
      return (
        <div
          className="premium-lesson-tone-block premium-tone-amber mt-3 text-sm leading-7"
          data-manifest-missing-field={`${card.id}:options`}
        >
          manifest 未提供本选择题选项，请在 activity_cards[].options 中补齐。
        </div>
      );
    }

    return (
      <fieldset className="mt-3 space-y-2">
        <legend className="sr-only">{card.title ?? card.prompt}</legend>
        {card.options.map((option) => (
          <label
            key={option.value}
            className="premium-lesson-surface-elevated flex cursor-pointer items-start gap-3 px-4 py-3 text-sm leading-6"
          >
            <input
              type="radio"
              name={card.id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1"
            />
            <span>{renderActivityInlineContent(option.label)}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="写出判断依据。"
      className="premium-lesson-input mt-3 min-h-[120px] w-full"
    />
  );
}

function StudentCards({
  stepManifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  onSubmit,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  const cards = useMemo(() => cardsFor(stepManifest), [stepManifest]);
  const cardKeys = useMemo(() => cards.map((card) => card.id), [cards]);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>(savedResponse?.answers ?? {});

  useEffect(() => {
    setDraftAnswers((currentDraft) =>
      mergeSavedAnswersIntoDraft({
        savedAnswers: savedResponse?.answers,
        currentDraft,
        keys: cardKeys,
      }),
    );
  }, [cardKeys, savedResponse]);

  if (!cards.length) return null;

  if (!released) {
    return (
      <div className="premium-lesson-panel">
        <div className="premium-lesson-kicker">本页作答</div>
        <div className="premium-lesson-tone-block premium-tone-amber mt-3">教师尚未发放本页作答卡，请先阅读上方证据。</div>
      </div>
    );
  }

  if (!browseEnabled && stepManifest.interactionSpec.interactionKind === 'quiz_group') {
    return (
      <div className="premium-lesson-panel">
        <div className="premium-lesson-kicker">本页作答</div>
        <div className="premium-lesson-tone-block premium-tone-amber mt-3">教师尚未开放浏览，请等待课堂推进。</div>
      </div>
    );
  }

  const submittedKeys = new Set(Object.keys(savedResponse?.answers ?? {}));

  return (
    <div className="space-y-4">
      <div className={`grid gap-4 ${cards.every((card) => card.layoutSpan === 'half') ? 'md:grid-cols-2' : ''}`}>
        {cards.map((card, index) => (
          <div key={card.id} className="premium-lesson-panel">
            <div className="premium-lesson-kicker">{cardTitle(card, index)}</div>
            <p className="premium-lesson-title mt-2 text-sm leading-7">{renderActivityInlineContent(card.prompt)}</p>
            <StudentCardAnswerInput
              card={card}
              value={draftAnswers[card.id] ?? ''}
              onChange={(value) => setDraftAnswers((prev) => ({ ...prev, [card.id]: value }))}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  onSubmit({
                    stepId: stepManifest.id,
                    submittedAt: Date.now(),
                    answers: buildPerCardSubmissionAnswers({
                      savedAnswers: savedResponse?.answers,
                      currentDraft: draftAnswers,
                      targetKey: card.id,
                    }),
                  })
                }
                disabled={!draftAnswers[card.id]?.trim()}
                className="premium-lesson-action-primary disabled:opacity-40"
              >
                提交答案
              </button>
              <span className="premium-lesson-caption text-xs">
                {submittedKeys.has(card.id) ? '已提交，可修改后重提。' : '独立提交本卡。'}
              </span>
            </div>
            {answerVisible ? (
              <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm leading-7">
                <ReferenceAnswer card={card} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="premium-lesson-panel">
        <div className="premium-lesson-kicker">提交状态</div>
        <SubmissionStatus
          submitted={cards.every((card) => submittedKeys.has(card.id))}
          submittedText="本页作答卡已至少提交一次，可继续修改并逐卡重提。"
          idleText="各作答卡独立提交，教师端会按卡汇总。"
        />
      </div>
    </div>
  );
}

function TeacherControls({
  stepManifest,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const controls = stepManifest.teacherControls;
  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">教师控制</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {controls.releaseActivity !== 'not_applicable' ? (
          <button
            type="button"
            onClick={onToggleRelease}
            className={`premium-lesson-action-tone ${released ? 'premium-tone-emerald' : 'premium-tone-slate'}`}
          >
            {released ? '已发放作答' : '发放作答'}
          </button>
        ) : null}
        {controls.openBrowse !== 'not_applicable' && controls.openBrowse !== 'page_load_open' ? (
          <button
            type="button"
            onClick={onToggleBrowse}
            className={`premium-lesson-action-tone ${browseEnabled ? 'premium-tone-cyan' : 'premium-tone-slate'}`}
          >
            {browseEnabled ? '已开放浏览' : '开放浏览'}
          </button>
        ) : null}
        {controls.revealReferenceAnswer !== 'not_applicable' ? (
          <button
            type="button"
            onClick={onToggleAnswerVisible}
            className={`premium-lesson-action-tone ${answerVisible ? 'premium-tone-amber' : 'premium-tone-slate'}`}
          >
            {answerVisible ? '隐藏参考答案' : '显示参考答案'}
          </button>
        ) : null}
        {controls.teacherStepReveal === 'teacher_only' ? (
          <>
            <button type="button" onClick={onAdvanceReveal} className="premium-lesson-action-tone premium-tone-cyan">
              推进显影
            </button>
            <button type="button" onClick={onResetReveal} className="premium-lesson-action-tone premium-tone-slate">
              重置显影
            </button>
          </>
        ) : null}
      </div>
      {controls.teacherStepReveal === 'teacher_only' ? (
        <p className="premium-lesson-muted mt-3 text-sm">当前教师显影层级：{revealProgress + 1}</p>
      ) : null}
    </div>
  );
}

function TeacherSummary({
  stepManifest,
  responses,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  responses: TeacherResponseItem[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const cards = cardsFor(stepManifest);
  return (
    <div className="space-y-4">
      <TeacherControls
        stepManifest={stepManifest}
        released={released}
        browseEnabled={browseEnabled}
        answerVisible={answerVisible}
        revealProgress={revealProgress}
        onToggleRelease={onToggleRelease}
        onToggleBrowse={onToggleBrowse}
        onToggleAnswerVisible={onToggleAnswerVisible}
        onAdvanceReveal={onAdvanceReveal}
        onResetReveal={onResetReveal}
      />
      {cards.length ? (
        <div className="premium-lesson-panel">
          <div className="premium-lesson-kicker">学生提交汇总</div>
          <div className="mt-3 space-y-3">
            {cards.map((card, index) => {
              const cardResponses = responses.filter((item) => item.response.answers?.[card.id]);
              return (
                <div key={card.id} className="premium-lesson-surface-elevated px-4 py-3">
                  <div className="premium-lesson-title text-sm font-semibold">{cardTitle(card, index)}</div>
                  <div className="premium-lesson-muted mt-1 text-xs">已提交 {cardResponses.length} 人</div>
                  {cardResponses.slice(0, 4).map((item) => (
                    <p key={`${card.id}-${item.studentName}`} className="premium-lesson-muted mt-2 text-sm leading-6">
                      <strong>{item.studentName}：</strong>
                      {item.response.answers[card.id]}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function createManifestStudentActivityRegistry<TStep>(): StudentInteractiveActivityRegistry<TStep, ManifestStepResponse> {
  return {
    single_choice: (props) => <StudentCards {...props} />,
    binary_choice: (props) => <StudentCards {...props} />,
    activity_card_set: (props) => <StudentCards {...props} />,
    task_card_workspace: (props) => <StudentCards {...props} />,
    quiz_group: (props) => <StudentCards {...props} />,
    multi_select_matrix: (props) => <StudentCards {...props} />,
    quiz_card_grid: (props) => <StudentCards {...props} />,
    teacher_reveal_only: (props) => <StudentCards {...props} />,
  };
}

export function createManifestTeacherActivityRegistry<TStep>(): TeacherInteractiveActivityRegistry<TStep, TeacherResponseItem> {
  return {
    single_choice: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    binary_choice: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    activity_card_set: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    task_card_workspace: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    quiz_group: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    multi_select_matrix: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    quiz_card_grid: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    teacher_reveal_only: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
  };
}
