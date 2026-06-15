'use client';

import { createElement, Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import {
  buildStepActivityIdentity,
  buildPerCardSubmissionAnswers,
  resolveStudentCardDraftEnvelope,
  type StudentCardDraftEnvelope,
} from '@/features/interactive/shared/per-card-response-utils';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type {
  InteractiveRuntimeActivityCardManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import {
  getInteractiveResponseKindMetadata,
  isChoiceMultiResponseKind,
  isChoiceSingleResponseKind,
  isMatchingResponseKind,
  isOrderingResponseKind,
  isParameterSetResponseKind,
} from '@/lib/interactive-response-contracts';

export type StudentInteractiveActivityRendererProps<TStep, TResponse> = {
  step: TStep;
  stepManifest: InteractiveRuntimeStepManifest;
  savedResponse?: TResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  workspaceParameters?: Record<string, string | number | boolean>;
  readOnly?: boolean;
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
  workspaceParameters,
  readOnly,
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
  workspaceParameters?: Record<string, string | number | boolean>;
  readOnly?: boolean;
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
    workspaceParameters,
    readOnly,
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

type ParameterField = { key: string; label: string; unit?: string };

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
    .map((item) => String(item));
}

function parameterSubmitFields(stepManifest: InteractiveRuntimeStepManifest) {
  const figureSpec = asRecord(stepManifest.interactiveFigureSpec);
  const snakeSpec = asRecord(figureSpec.parameter_submit_spec);
  const camelSpec = asRecord(figureSpec.parameterSubmitSpec);
  return asStringArray(snakeSpec.submit_fields ?? camelSpec.submitFields ?? stepManifest.interactionSpec.submitFields);
}

function parameterControlFields(stepManifest: InteractiveRuntimeStepManifest): ParameterField[] {
  const figureSpec = asRecord(stepManifest.interactiveFigureSpec);
  const controls = Array.isArray(figureSpec.parameter_controls)
    ? figureSpec.parameter_controls
    : Array.isArray(figureSpec.parameterControls)
      ? figureSpec.parameterControls
      : Array.isArray(figureSpec.controls)
        ? figureSpec.controls
        : [];
  return controls.reduce<ParameterField[]>((fields, value) => {
      const item = asRecord(value);
      const key = [item.key, item.id, item.field, item.name].find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);
      if (!key) return fields;
      const label = [item.label, item.title].find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0) ?? key;
      const unit = typeof item.unit === 'string' && item.unit.trim() ? item.unit : undefined;
      fields.push({ key, label, unit });
      return fields;
    }, []);
}

function parameterFieldsForCard(
  stepManifest: InteractiveRuntimeStepManifest,
  card: InteractiveRuntimeActivityCardManifest,
): ParameterField[] {
  if (!isParameterSetResponseKind(card.responseKind) && !card.structuredFields?.length) return [];
  const submitFields = card.structuredFields?.length ? card.structuredFields : parameterSubmitFields(stepManifest);
  if (!submitFields.length) return [];
  const controlFields = parameterControlFields(stepManifest);
  return submitFields.map((key) => {
    const control = controlFields.find((item) => item.key === key);
    return control ?? { key, label: key };
  });
}

function cardsFor(stepManifest: InteractiveRuntimeStepManifest) {
  const activityCards = stepManifest.interactionSpec.activityCards ?? [];
  if (activityCards.length) {
    return activityCards.map((card) => {
      const parameterFields = parameterFieldsForCard(stepManifest, card);
      if (!parameterFields.length) return card;
      return {
        ...card,
        structuredFields: parameterFields.map((field) => field.key),
        parameterFields,
      };
    });
  }

  return (stepManifest.interactionSpec.submitFields ?? []).map((field) => ({
    id: field,
    title: field,
    prompt: `提交${field}。`,
    responseKind: 'text.short',
    responseCategory: getInteractiveResponseKindMetadata('text.short').category,
    responseScoringMode: getInteractiveResponseKindMetadata('text.short').scoring,
    submitScope: 'per_card',
    layoutSpan: 'half',
    options: [],
  }));
}

function hasAnswerPrefix(title: string) {
  return /^作答\s*\d+\s*[：:]/.test(title) || /^作答\s*\d+\b/.test(title);
}

function cardTitle(card: InteractiveRuntimeActivityCardManifest, index: number) {
  const baseTitle = card.title?.trim() ?? '';
  if (hasAnswerPrefix(baseTitle)) return baseTitle;
  const prefix = `作答${index + 1}`;
  return baseTitle ? `${prefix}：${baseTitle}` : prefix;
}

function CardTitleWithPrompt({ card, index }: { card: InteractiveRuntimeActivityCardManifest; index: number }) {
  const baseTitle = cardTitle(card, index);
  const prompt = card.prompt.trim();

  if (!prompt || baseTitle.includes(prompt)) {
    return <>{renderActivityInlineContent(baseTitle)}</>;
  }

  return (
    <>
      {renderActivityInlineContent(baseTitle)}
      ：
      {renderActivityInlineContent(card.prompt)}
    </>
  );
}

function ManifestSectionTitle({ children }: { children: ReactNode }) {
  return <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">{children}</div>;
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

function CardPrompt({ card }: { card: InteractiveRuntimeActivityCardManifest }) {
  if (card.prompt.trim()) {
    return null;
  }

  return (
    <div
      className="premium-lesson-tone-block premium-tone-amber mt-2 text-sm leading-7"
      data-manifest-missing-field={`${card.id}:prompt`}
    >
      manifest 未提供本卡题面，请在 activity_cards[].prompt 中补齐。
    </div>
  );
}

function isSingleChoiceCard(card: InteractiveRuntimeActivityCardManifest) {
  return isChoiceSingleResponseKind(card.responseKind);
}

function isMultiSelectCard(card: InteractiveRuntimeActivityCardManifest) {
  return isChoiceMultiResponseKind(card.responseKind);
}

function isDragSortCard(card: InteractiveRuntimeActivityCardManifest) {
  return isOrderingResponseKind(card.responseKind);
}

function isDragMatchCard(card: InteractiveRuntimeActivityCardManifest) {
  return isMatchingResponseKind(card.responseKind);
}

function isParameterSetCard(card: InteractiveRuntimeActivityCardManifest) {
  return isParameterSetResponseKind(card.responseKind) && Boolean(card.parameterFields?.length);
}

function parseParameterAnswer(value: string): Record<string, string> {
  if (!value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, item]) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
        .map(([key, item]) => [key, String(item)]),
    );
  } catch {
    return {};
  }
}

function formatParameterAnswer(card: InteractiveRuntimeActivityCardManifest, value: string) {
  const parsed = parseParameterAnswer(value);
  const fields = card.parameterFields ?? [];
  if (!fields.length || !Object.keys(parsed).length) return value;
  return fields
    .filter((field) => parsed[field.key]?.trim())
    .map((field) => `${field.label}：${parsed[field.key]}${field.unit ? ` ${field.unit}` : ''}`)
    .join('；');
}

function formatAnswerValue(card: InteractiveRuntimeActivityCardManifest, value: string) {
  if (!value.trim()) return '已提交空白内容';
  if (isParameterSetCard(card)) {
    return formatParameterAnswer(card, value);
  }
  const answerOptions = card.matchOptions?.length ? card.matchOptions : card.options;
  if (!answerOptions.length) return value;

  const labelFor = (optionValue: string) =>
    answerOptions.find((option) => option.value === optionValue)?.label ?? optionValue;

  if (value.includes('|')) {
    return value.split('|').filter(Boolean).map(labelFor).join(' / ');
  }

  return labelFor(value);
}

function TeacherCardOptions({ card }: { card: InteractiveRuntimeActivityCardManifest }) {
  if (!card.options.length) return null;

  if (isDragMatchCard(card)) {
    return <DragMatchPreview card={card} />;
  }

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {card.options.map((option) => (
        <div key={option.value} className="rounded-2xl border border-border/50 bg-background/60 px-3 py-2 text-sm leading-6">
          {renderActivityInlineContent(option.label)}
        </div>
      ))}
    </div>
  );
}

function aggregateCardAnswers(
  card: InteractiveRuntimeActivityCardManifest,
  cardResponses: TeacherResponseItem[],
) {
  const counts = new Map<string, number>();

  for (const item of cardResponses) {
    const formatted = formatAnswerValue(card, item.response.answers[card.id] ?? '');
    counts.set(formatted, (counts.get(formatted) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([answer, count]) => ({
      answer,
      count,
      ratio: cardResponses.length ? count / cardResponses.length : 0,
    }))
    .sort((left, right) => right.count - left.count || left.answer.localeCompare(right.answer, 'zh-Hans-CN'));
}

function TeacherCardAnswerSummary({
  card,
  index,
  responses,
  answerVisible,
}: {
  card: InteractiveRuntimeActivityCardManifest;
  index: number;
  responses: TeacherResponseItem[];
  answerVisible: boolean;
}) {
  const [detailsVisible, setDetailsVisible] = useState(false);
  const cardResponses = responses.filter((item) => item.response.answers?.[card.id]);
  const aggregateRows = aggregateCardAnswers(card, cardResponses);

  return (
    <div className="premium-lesson-surface-elevated px-4 py-3">
      <ManifestSectionTitle>
        <CardTitleWithPrompt card={card} index={index} />
      </ManifestSectionTitle>
      <CardPrompt card={card} />
      <TeacherCardOptions card={card} />
      {answerVisible ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-3 text-sm leading-7">
          <ReferenceAnswer card={card} />
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="premium-lesson-muted text-xs">已提交 {cardResponses.length} 人</div>
        {cardResponses.length ? (
          <button
            type="button"
            onClick={() => setDetailsVisible((value) => !value)}
            aria-expanded={detailsVisible}
            className="premium-lesson-action-tone premium-tone-slate text-xs"
          >
            {detailsVisible ? '收起细节' : '查看细节'}
          </button>
        ) : null}
      </div>
      <div className="mt-3 space-y-2" aria-label="答案统计">
        {aggregateRows.length ? (
          aggregateRows.map((row) => (
            <div key={`${card.id}-${row.answer}`} className="rounded-2xl border border-border/50 bg-background/60 px-3 py-2">
              <div className="flex items-start justify-between gap-3 text-sm leading-6">
                <span className="premium-lesson-title">{renderActivityInlineContent(row.answer)}</span>
                <span className="premium-lesson-caption shrink-0 text-xs">
                  {row.count} 人 · {Math.round(row.ratio * 100)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
                <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.round(row.ratio * 100)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <div className="premium-lesson-muted rounded-2xl border border-dashed border-border/60 px-3 py-2 text-sm">
            暂无提交，答案统计将在学生提交后显示。
          </div>
        )}
      </div>
      {detailsVisible ? (
        <div className="premium-lesson-tone-block premium-tone-slate mt-3 text-sm leading-7">
          <ManifestSectionTitle>提交细节</ManifestSectionTitle>
          <div className="mt-2 space-y-2">
            {cardResponses.map((item) => (
              <p key={`${card.id}-${item.studentName}-${item.response.submittedAt}`} className="premium-lesson-muted leading-6">
                <strong>{item.studentName}：</strong>
                {renderActivityInlineContent(formatAnswerValue(card, item.response.answers[card.id] ?? ''))}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function splitMatchLabel(label: string) {
  const [source, target] = label.split(/\s*(?:->|→|=>|⇒)\s*/);
  return {
    source: source?.trim() || label,
    target: target?.trim() || label,
  };
}

function dragMatchItems(card: InteractiveRuntimeActivityCardManifest) {
  return card.matchItems?.length ? card.matchItems : card.options;
}

function dragMatchOptions(card: InteractiveRuntimeActivityCardManifest) {
  return card.matchOptions?.length ? card.matchOptions : card.options;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableShuffleOptions<T extends { value: string }>(items: T[], seed: string) {
  const ranked = items
    .map((item, index) => ({
      item,
      index,
      rank: stableHash(`${seed}:${item.value}`),
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ item }) => item);

  const unchanged = ranked.every((item, index) => item.value === items[index]?.value);
  if (unchanged && ranked.length > 1) {
    return [...ranked.slice(1), ranked[0]];
  }
  return ranked;
}

function matchOptionSeed(card: InteractiveRuntimeActivityCardManifest) {
  return `${card.id}:${card.options.map((option) => option.value).join('|')}`;
}

function normalizeDragMatchAssignments(value: string, optionValues: string[]) {
  const raw = value.trim() ? value.split('|') : [];
  const padded = raw.slice(0, optionValues.length);
  while (padded.length < optionValues.length) {
    padded.push('');
  }

  const seen = new Set<string>();
  return optionValues.map((_, index) => {
    const candidate = padded[index] ?? '';
    if (!candidate || !optionValues.includes(candidate) || seen.has(candidate)) {
      return '';
    }
    seen.add(candidate);
    return candidate;
  });
}

function DragMatchPreview({ card }: { card: InteractiveRuntimeActivityCardManifest }) {
  const items = dragMatchItems(card);
  const options = dragMatchOptions(card);
  const explicitPairs = Boolean(card.matchItems?.length && card.matchOptions?.length);
  const shuffledOptions = stableShuffleOptions(options, matchOptionSeed(card));

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[2fr_1fr]">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <ManifestSectionTitle>待配对项</ManifestSectionTitle>
        <ManifestSectionTitle>配对空槽</ManifestSectionTitle>
        {items.map((item) => (
          <Fragment key={item.value}>
            <div className="premium-lesson-surface-elevated flex min-h-[64px] items-center px-4 py-3 text-sm leading-6">
              {renderActivityInlineContent(explicitPairs ? item.label : splitMatchLabel(item.label).source)}
            </div>
            <div className="premium-lesson-muted flex min-h-[64px] items-center rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-3 text-sm leading-6">
              待学生拖入
            </div>
          </Fragment>
        ))}
      </div>
      <div className="space-y-2">
        <ManifestSectionTitle>备选项</ManifestSectionTitle>
        {shuffledOptions.map((option) => (
          <div
            key={option.value}
            className="premium-lesson-surface-elevated flex min-h-[64px] w-full items-center px-4 py-3 text-left text-sm leading-6"
          >
            {renderActivityInlineContent(explicitPairs ? option.label : splitMatchLabel(option.label).target)}
          </div>
        ))}
      </div>
    </div>
  );
}

function DragMatchAnswerInput({
  card,
  value,
  onChange,
}: {
  card: InteractiveRuntimeActivityCardManifest;
  value: string;
  onChange: (value: string) => void;
}) {
  const items = useMemo(() => dragMatchItems(card), [card]);
  const options = useMemo(() => dragMatchOptions(card), [card]);
  const explicitPairs = Boolean(card.matchItems?.length && card.matchOptions?.length);
  const optionValues = useMemo(() => options.map((option) => option.value), [options]);
  const [draggedValue, setDraggedValue] = useState<string | null>(null);
  const draggedValueRef = useRef<string | null>(null);
  const normalizedAssignments = useMemo(() => {
    return normalizeDragMatchAssignments(value, optionValues);
  }, [optionValues, value]);
  const assignments = normalizedAssignments;
  const assignedValues = new Set(assignments.filter(Boolean));
  const shuffledOptions = useMemo(() => stableShuffleOptions(options, matchOptionSeed(card)), [card, options]);
  const availableOptions = shuffledOptions.filter((option) => !assignedValues.has(option.value));
  const labelFor = (optionValue: string) =>
    options.find((option) => option.value === optionValue)?.label ?? optionValue;
  const sourceLabelFor = (label: string) => explicitPairs ? label : splitMatchLabel(label).source;
  const targetLabelFor = (optionValue: string) => explicitPairs ? labelFor(optionValue) : splitMatchLabel(labelFor(optionValue)).target;
  const commitAssignments = (next: string[]) => {
    onChange(next.join('|'));
  };
  const assignToSlot = (slotIndex: number, optionValue: string | null) => {
    if (!optionValue || !optionValues.includes(optionValue)) return;
    const next = assignments.map((item) => (item === optionValue ? '' : item));
    next[slotIndex] = optionValue;
    commitAssignments(next);
    draggedValueRef.current = null;
    setDraggedValue(null);
  };

  if (!items.length || !options.length) {
    return (
      <div
        className="premium-lesson-tone-block premium-tone-amber mt-3 text-sm leading-7"
        data-manifest-missing-field={`${card.id}:matchItemsOrOptions`}
      >
        manifest 未提供本配对题的左侧现象或右侧类别，请在 activity_cards[].match_items / match_options 中补齐。
      </div>
    );
  }

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[2fr_1fr]">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <ManifestSectionTitle>待配对项</ManifestSectionTitle>
        <ManifestSectionTitle>配对空槽</ManifestSectionTitle>
        {items.map((item, index) => {
          const assigned = assignments[index];
          return (
            <Fragment key={item.value}>
              <div className="premium-lesson-surface-elevated flex min-h-[64px] items-center px-4 py-3 text-sm leading-6">
                {renderActivityInlineContent(sourceLabelFor(item.label))}
              </div>
              <button
                type="button"
                onDragOver={(event) => event.preventDefault()}
                onDragEnter={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const droppedValue = event.dataTransfer.getData('text/plain') || draggedValueRef.current || draggedValue;
                  assignToSlot(index, droppedValue);
                }}
                onMouseUp={() => assignToSlot(index, draggedValueRef.current || draggedValue)}
                onClick={() => {
                  if (!assigned) return;
                  const next = [...assignments];
                  next[index] = '';
                  commitAssignments(next);
                }}
                className={`flex min-h-[64px] w-full items-center rounded-2xl border px-4 py-3 text-left text-sm leading-6 ${
                  assigned ? 'border-cyan-300/60 bg-cyan-500/10' : 'premium-lesson-muted border-dashed border-border/60 bg-background/40'
                }`}
                aria-label={`${sourceLabelFor(item.label)} 的配对空槽`}
              >
                {assigned ? renderActivityInlineContent(targetLabelFor(assigned)) : '拖入对应备选项'}
              </button>
            </Fragment>
          );
        })}
      </div>
      <div className="space-y-2">
        <ManifestSectionTitle>备选项</ManifestSectionTitle>
        {availableOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            draggable
            onMouseDown={() => {
              draggedValueRef.current = option.value;
              setDraggedValue(option.value);
            }}
            onDragStart={(event) => {
              draggedValueRef.current = option.value;
              setDraggedValue(option.value);
              event.dataTransfer.setData('text/plain', option.value);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              draggedValueRef.current = null;
              setDraggedValue(null);
            }}
            onClick={() => {
              const firstEmptyIndex = assignments.findIndex((item) => !item);
              if (firstEmptyIndex < 0) return;
              const next = [...assignments];
              next[firstEmptyIndex] = option.value;
              commitAssignments(next);
            }}
            className="premium-lesson-surface-elevated flex min-h-[64px] w-full cursor-grab items-center px-4 py-3 text-left text-sm leading-6 active:cursor-grabbing"
          >
            {renderActivityInlineContent(explicitPairs ? option.label : splitMatchLabel(option.label).target)}
          </button>
        ))}
        {!availableOptions.length ? (
          <div className="premium-lesson-muted rounded-2xl border border-dashed border-border/60 px-4 py-3 text-sm">
            所有备选项已放入空槽，点击空槽可撤回。
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DragSortAnswerInput({
  card,
  value,
  onChange,
}: {
  card: InteractiveRuntimeActivityCardManifest;
  value: string;
  onChange: (value: string) => void;
}) {
  const optionValues = useMemo(() => card.options.map((option) => option.value), [card.options]);
  const [draggedValue, setDraggedValue] = useState<string | null>(null);
  const currentOrder = useMemo(() => {
    const saved = value.split('|').filter(Boolean);
    const ordered = saved.filter((item) => optionValues.includes(item));
    const rest = optionValues.filter((item) => !ordered.includes(item));
    return [...ordered, ...rest];
  }, [optionValues, value]);

  const commitOrder = (order: string[]) => onChange(order.join('|'));
  const labelFor = (optionValue: string) =>
    card.options.find((option) => option.value === optionValue)?.label ?? optionValue;

  if (!card.options.length) {
    return (
      <div
        className="premium-lesson-tone-block premium-tone-amber mt-3 text-sm leading-7"
        data-manifest-missing-field={`${card.id}:options`}
      >
        manifest 未提供本排序题选项，请在 activity_cards[].options 中补齐。
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {currentOrder.map((optionValue, index) => (
        <button
          key={optionValue}
          type="button"
          draggable
          onDragStart={() => setDraggedValue(optionValue)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (!draggedValue || draggedValue === optionValue) return;
            const next = currentOrder.filter((item) => item !== draggedValue);
            next.splice(index, 0, draggedValue);
            commitOrder(next);
            setDraggedValue(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            const nextIndex = event.key === 'ArrowUp' ? Math.max(0, index - 1) : Math.min(currentOrder.length - 1, index + 1);
            if (nextIndex === index) return;
            const next = [...currentOrder];
            const [moved] = next.splice(index, 1);
            next.splice(nextIndex, 0, moved);
            commitOrder(next);
          }}
          className="premium-lesson-surface-elevated flex w-full cursor-grab items-start gap-3 px-4 py-3 text-left text-sm leading-6 active:cursor-grabbing"
          aria-label={`排序项 ${index + 1}，可拖拽或用方向键调整`}
        >
          <span className="premium-lesson-caption min-w-8 rounded-full bg-background/80 px-2 py-0.5 text-center text-xs">
            {index + 1}
          </span>
          <span>{renderActivityInlineContent(labelFor(optionValue))}</span>
        </button>
      ))}
      <p className="premium-lesson-muted text-xs">拖动卡片调整顺序，也可以聚焦后使用上下方向键移动。</p>
    </div>
  );
}

function ParameterSetAnswerInput({
  card,
  value,
  onChange,
}: {
  card: InteractiveRuntimeActivityCardManifest;
  value: string;
  onChange: (value: string) => void;
}) {
  const fields = card.parameterFields ?? [];
  const parsed = parseParameterAnswer(value);
  const commit = (key: string, nextValue: string) => {
    onChange(JSON.stringify({ ...parsed, [key]: nextValue }));
  };

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {fields.map((field) => (
        <label key={field.key} className="premium-lesson-surface-elevated block px-4 py-3 text-sm leading-6">
          <span className="premium-lesson-title block font-medium">{field.label}</span>
          <span className="premium-lesson-muted mt-1 block text-xs">{field.unit ? `单位：${field.unit}` : '记录当前参数值'}</span>
          <input
            type="text"
            value={parsed[field.key] ?? ''}
            onChange={(event) => commit(field.key, event.target.value)}
            className="premium-lesson-input mt-2 w-full"
          />
        </label>
      ))}
    </div>
  );
}

function parameterSetDraftValue(
  card: InteractiveRuntimeActivityCardManifest,
  workspaceParameters?: Record<string, string | number | boolean>,
) {
  if (!isParameterSetCard(card) || !workspaceParameters) return '';
  const values = Object.fromEntries(
    (card.parameterFields ?? [])
      .map((field) => [field.key, workspaceParameters[field.key]])
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim()),
  );
  return Object.keys(values).length ? JSON.stringify(values) : '';
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
  if (isDragSortCard(card)) {
    return <DragSortAnswerInput card={card} value={value} onChange={onChange} />;
  }

  if (isDragMatchCard(card)) {
    return <DragMatchAnswerInput card={card} value={value} onChange={onChange} />;
  }

  if (isParameterSetCard(card)) {
    return <ParameterSetAnswerInput card={card} value={value} onChange={onChange} />;
  }

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
        <legend className="sr-only">选择答案</legend>
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
        <legend className="sr-only">选择答案</legend>
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
    <textarea aria-label="写出判断依据。"
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
  workspaceParameters,
  readOnly = false,
  onSubmit,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  workspaceParameters?: Record<string, string | number | boolean>;
  readOnly?: boolean;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  const cards = useMemo(() => cardsFor(stepManifest), [stepManifest]);
  const cardKeys = useMemo(() => cards.map((card) => card.id), [cards]);
  const stepActivityIdentity = buildStepActivityIdentity(stepManifest.id, cardKeys);
  const [draftEnvelope, setDraftEnvelope] = useState<StudentCardDraftEnvelope>(() => ({
    identity: stepActivityIdentity,
    draftAnswers: savedResponse?.answers ?? {},
    touchedKeys: new Set(),
    localSubmittedKeys: new Set(),
  }));
  const {
    identityChanged,
    nextEnvelope,
    mergedDraftAnswers,
  } = resolveStudentCardDraftEnvelope({
    identity: stepActivityIdentity,
    savedAnswers: savedResponse?.answers,
    cardKeys,
    envelope: draftEnvelope,
  });
  if (identityChanged) {
    setDraftEnvelope(nextEnvelope);
  }
  const effectiveLocalSubmittedKeys = nextEnvelope.localSubmittedKeys;

  if (!cards.length) return null;

  if (!released) {
    return (
        <div className="premium-lesson-panel">
        <ManifestSectionTitle>本页作答</ManifestSectionTitle>
        <div className="premium-lesson-tone-block premium-tone-amber mt-3">教师尚未发放本页作答卡，请先阅读上方证据。</div>
      </div>
    );
  }

  if (!browseEnabled && stepManifest.interactionSpec.interactionKind === 'quiz_group') {
    return (
        <div className="premium-lesson-panel">
        <ManifestSectionTitle>本页作答</ManifestSectionTitle>
        <div className="premium-lesson-tone-block premium-tone-amber mt-3">教师尚未开放浏览，请等待课堂推进。</div>
      </div>
    );
  }

  const submittedKeys = new Set([...Object.keys(savedResponse?.answers ?? {}), ...Array.from(effectiveLocalSubmittedKeys)]);
  const draftValueForCard = (card: InteractiveRuntimeActivityCardManifest) => {
    const currentParameterValue = parameterSetDraftValue(card, workspaceParameters);
    if (currentParameterValue) return currentParameterValue;
    return mergedDraftAnswers[card.id] ?? '';
  };

  return (
    <div className="space-y-4">
      <div className={`grid gap-4 ${cards.every((card) => card.layoutSpan === 'half') ? 'md:grid-cols-2' : ''}`}>
        {cards.map((card, index) => (
          <div key={card.id} className="premium-lesson-panel">
            <ManifestSectionTitle>
              <CardTitleWithPrompt card={card} index={index} />
            </ManifestSectionTitle>
            <CardPrompt card={card} />
            <StudentCardAnswerInput
              card={card}
              value={draftValueForCard(card)}
                onChange={(value) => {
                setDraftEnvelope((previous) => ({
                  ...previous,
                  draftAnswers: { ...previous.draftAnswers, [card.id]: value },
                  touchedKeys: new Set(previous.touchedKeys).add(card.id),
                }));
              }}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const currentDraft = {
                    ...mergedDraftAnswers,
                    [card.id]: draftValueForCard(card),
                  };
                  setDraftEnvelope((previous) => {
                    const nextTouchedKeys = new Set(previous.touchedKeys);
                    nextTouchedKeys.delete(card.id);
                    return {
                      ...previous,
                      localSubmittedKeys: new Set(previous.localSubmittedKeys).add(card.id),
                      touchedKeys: nextTouchedKeys,
                    };
                  });
                  onSubmit({
                    stepId: stepManifest.id,
                    submittedAt: Date.now(),
                    answers: buildPerCardSubmissionAnswers({
                      savedAnswers: savedResponse?.answers,
                      currentDraft,
                      targetKey: card.id,
                    }),
                  });
                }}
                disabled={!draftValueForCard(card).trim()}
                className="premium-lesson-action-primary disabled:opacity-40"
              >
                提交答案
              </button>
              <span className="premium-lesson-caption text-xs">
                {submittedKeys.has(card.id) ? '已提交，可修改后重提。' : '独立提交本卡。'}
              </span>
            </div>
            <SubmissionStatus
              submitted={submittedKeys.has(card.id)}
              submittedText="本卡已提交，修改后可以再次提交。"
              idleText={readOnly ? '演示模式仅本机预览，不会同步到教师端汇总。' : '提交后会同步到教师端汇总。'}
              showLock={false}
            />
            {answerVisible ? (
              <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm leading-7">
                <ReferenceAnswer card={card} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="premium-lesson-panel">
        <ManifestSectionTitle>提交状态</ManifestSectionTitle>
        <SubmissionStatus
          submitted={cards.every((card) => submittedKeys.has(card.id))}
          submittedText="本页作答卡已至少提交一次，可继续修改并逐卡重提。"
          idleText={readOnly ? '演示模式会展示作答流程，但不会写入课堂汇总。' : '各作答卡独立提交，教师端会按卡汇总。'}
          showLock={false}
        />
      </div>
    </div>
  );
}

function hasTeacherRevealControl(stepManifest: InteractiveRuntimeStepManifest) {
  const mode = String(stepManifest.teacherControls.teacherStepReveal);
  return mode === 'teacher_only'
    || mode === 'teacher_direct'
    || mode === 'enabled';
}

function revealLayerCountFromValue(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') {
    const record = value as { layers?: unknown[]; items?: unknown[]; steps?: unknown[]; bullets?: unknown[] };
    for (const key of ['layers', 'items', 'steps', 'bullets'] as const) {
      if (Array.isArray(record[key])) return record[key]?.length ?? 0;
    }
  }
  return 0;
}

function revealBlockKey(module: InteractiveRuntimeModuleManifest) {
  const key = module.payload.block_key ?? module.payload.blockKey;
  return typeof key === 'string' && key.trim() ? key : null;
}

export function getInteractiveRevealLayerCount(stepManifest: InteractiveRuntimeStepManifest) {
  const directCount = Math.max(
    revealLayerCountFromValue(stepManifest.contentBlocks.reveal_layers),
    revealLayerCountFromValue(stepManifest.contentBlocks.reveal_steps),
  );
  const moduleCount = stepManifest.modules.reduce((maxCount, module) => {
    if (!module.kind.includes('reveal')) return maxCount;
    const key = revealBlockKey(module);
    const blockCount = key ? revealLayerCountFromValue(stepManifest.contentBlocks[key]) : 0;
    const payloadCount = Math.max(
      revealLayerCountFromValue(module.payload.items),
      revealLayerCountFromValue(module.payload.layers),
      revealLayerCountFromValue(module.payload.steps),
    );
    return Math.max(maxCount, blockCount, payloadCount);
  }, 0);
  return Math.max(directCount, moduleCount);
}

export function ManifestTeacherControls({
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
  const layerCount = getInteractiveRevealLayerCount(stepManifest);
  const maxRevealProgress = Math.max(0, layerCount - 1);
  const normalizedRevealProgress = layerCount ? Math.min(revealProgress, maxRevealProgress) : revealProgress;
  const canAdvanceReveal = !layerCount || revealProgress < maxRevealProgress;
  return (
    <div className="premium-lesson-panel">
      <ManifestSectionTitle>教师控制</ManifestSectionTitle>
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
        {hasTeacherRevealControl(stepManifest) ? (
          <>
            <button
              type="button"
              onClick={onAdvanceReveal}
              disabled={!canAdvanceReveal}
              className="premium-lesson-action-tone premium-tone-cyan disabled:cursor-not-allowed disabled:opacity-40"
            >
              推进显影
            </button>
            <button type="button" onClick={onResetReveal} className="premium-lesson-action-tone premium-tone-slate">
              重置显影
            </button>
          </>
        ) : null}
      </div>
      {hasTeacherRevealControl(stepManifest) ? (
        <p className="premium-lesson-muted mt-3 text-sm">
          当前教师显影层级：{normalizedRevealProgress + 1}{layerCount ? ` / ${layerCount}` : ''}
        </p>
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
      <ManifestTeacherControls
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
          <ManifestSectionTitle>学生提交汇总</ManifestSectionTitle>
          <div className="mt-3 space-y-3">
            {cards.map((card, index) => (
              <TeacherCardAnswerSummary
                key={card.id}
                card={card}
                index={index}
                responses={responses}
                answerVisible={answerVisible}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TeacherRevealOnlySummary({
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
  return (
    <ManifestTeacherControls
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
  );
}

function renderStudentCardsActivity<TStep>(
  props: StudentInteractiveActivityRendererProps<TStep, ManifestStepResponse>,
) {
  return <StudentCards {...props} />;
}

function renderNullStudentActivity<TStep>(
  _props: StudentInteractiveActivityRendererProps<TStep, ManifestStepResponse>,
) {
  return null;
}

export function createManifestStudentActivityRegistry<TStep>(): StudentInteractiveActivityRegistry<TStep, ManifestStepResponse> {
  const renderCards = renderStudentCardsActivity as StudentInteractiveActivityRegistry<
    TStep,
    ManifestStepResponse
  >[string];
  const renderNull = renderNullStudentActivity as StudentInteractiveActivityRegistry<
    TStep,
    ManifestStepResponse
  >[string];

  return {
    row_focus_toggle: renderCards,
    curve_compare_panel: renderCards,
    activity_cards: renderCards,
    step_reveal: renderCards,
    reason_chain: renderCards,
    matrix_choice_cards: renderCards,
    hotspot_labeling: renderCards,
    band_focus_panel: renderCards,
    goal_cards: renderCards,
    goal_cards_plus_ai: renderCards,
    evidence_mark_cards: renderCards,
    scheme_vote_cards: renderCards,
    reflection_card: renderCards,
    single_choice: renderCards,
    multi_select: renderCards,
    interactive_figure_submit: renderCards,
    binary_choice: renderCards,
    card_sort: renderCards,
    triple_match: renderCards,
    drag_match: renderCards,
    structured_compare: renderCards,
    parameter_slider: renderCards,
    activity_card_set: renderCards,
    table_builder: renderCards,
    task_card_workspace: renderCards,
    quiz_group: renderCards,
    multi_select_matrix: renderCards,
    quiz_card_grid: renderCards,
    teacher_reveal_only: renderNull,
    rust_toy_training_panel: renderNull,
    rust_heading_rl_training_panel: renderNull,
    worked_example_reveal: renderCards,
  };
}

export function createManifestTeacherActivityRegistry<TStep>(): TeacherInteractiveActivityRegistry<TStep, TeacherResponseItem> {
  return {
    row_focus_toggle: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    curve_compare_panel: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    activity_cards: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    step_reveal: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    reason_chain: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    matrix_choice_cards: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    hotspot_labeling: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    band_focus_panel: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    goal_cards: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    goal_cards_plus_ai: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    evidence_mark_cards: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    scheme_vote_cards: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    reflection_card: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    single_choice: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    multi_select: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    interactive_figure_submit: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    binary_choice: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    card_sort: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    triple_match: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    drag_match: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    structured_compare: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    parameter_slider: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    activity_card_set: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    table_builder: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    task_card_workspace: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    quiz_group: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    multi_select_matrix: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    quiz_card_grid: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    teacher_reveal_only: (props) => <TeacherRevealOnlySummary {...props} />,
    rust_toy_training_panel: (props) => <TeacherRevealOnlySummary {...props} />,
    rust_heading_rl_training_panel: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    worked_example_reveal: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
  };
}
