import type { Prisma } from '@prisma/client';

import type { LearningEvent } from './event-protocol';
import { isCoreEvent } from './event-types';
import {
  deriveFactOutcome,
  deriveFactScore,
  deriveFactTimeSpent,
  mapActionTypeToFactType,
  resolveCanonicalEventType,
  resolveCompetencyContribution,
} from './event-normalization';
import { resolveLearningFactEvidenceGovernance } from './learning-fact-quality-weight';

type LearningFactCreateManyDelegate = {
  createMany(args: {
    data: Prisma.LearningFactCreateManyInput[];
    skipDuplicates?: boolean;
  }): Promise<{ count: number }>;
};

export interface LearningFactPersistenceResult {
  created: number;
  skipped: boolean;
  actionType: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readJsonObject(value: unknown): Prisma.InputJsonValue | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.InputJsonValue;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Prisma.InputJsonValue
      : undefined;
  } catch {
    return undefined;
  }
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readAnswerValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && !(typeof value === 'string' && value.trim().length === 0)) {
      return value;
    }
  }
  return undefined;
}

function normalizeComparableAnswer(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .filter((item) => item !== undefined && item !== null)
    .flatMap((item) => String(item).split(/\s*(?:\|+|[,，、;；/])\s*/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function isOrderedObjectiveResponseKind(value: unknown): boolean {
  return value === 'drag_match'
    || value === 'triple_match'
    || value === 'drag_sort'
    || value === 'card_sort';
}

function answersMatch(studentAnswer: unknown, referenceAnswer: unknown, ordered: boolean): boolean {
  const studentValues = normalizeComparableAnswer(studentAnswer);
  const referenceValues = normalizeComparableAnswer(referenceAnswer);
  const comparableStudentValues = ordered ? studentValues : [...studentValues].sort();
  const comparableReferenceValues = ordered ? referenceValues : [...referenceValues].sort();
  if (studentValues.length === 0 || referenceValues.length === 0) return false;
  return comparableStudentValues.length === comparableReferenceValues.length
    && comparableStudentValues.every((value, index) => value === comparableReferenceValues[index]);
}

function compactJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Prisma.InputJsonObject;
}

function buildQuestionSummaryEvidence(payload: Record<string, unknown>) {
  const summaryEntries = readArray(payload.questionSummaries);
  const cards = summaryEntries
    .map((entry) => {
      const record = readRecord(entry);
      if (!record) return null;
      const cardId = readString(record.questionId)
        ?? readString(record.cardId)
        ?? readString(record.id);
      const selectedValue = readAnswerValue(record, ['studentAnswer', 'selectedValue', 'answer', 'value']);
      const referenceAnswer = readAnswerValue(record, ['referenceValue', 'referenceAnswer', 'reference_answer', 'correctAnswer', 'correct_answer']);
      const explicitCorrect = typeof record.isCorrect === 'boolean' ? record.isCorrect : undefined;
      if (!cardId) return null;
      if (selectedValue === undefined && explicitCorrect === undefined && referenceAnswer === undefined) return null;
      const ordered = isOrderedObjectiveResponseKind(record.responseKind);
      return compactJsonObject({
        cardId,
        selectedValue: selectedValue ?? null,
        referenceAnswer,
        answered: selectedValue !== undefined,
        isCorrect: explicitCorrect ?? (
          referenceAnswer !== undefined
            ? selectedValue !== undefined && answersMatch(selectedValue, referenceAnswer, ordered)
            : undefined
        ),
      });
    })
    .filter((item): item is Prisma.InputJsonObject => Boolean(item));

  if (cards.length === 0) return null;

  const scoreableCards = cards.filter((card) => typeof card.isCorrect === 'boolean');
  if (scoreableCards.length === 0) return null;
  const correctCount = scoreableCards.filter((card) => card.isCorrect === true).length;
  const totalCount = scoreableCards.length;
  const answeredCount = cards.filter((card) => card.answered === true).length;
  const score = Math.round((correctCount / totalCount) * 1000) / 10;

  return {
    basis: 'questionSummaries',
    cards,
    answeredCount,
    correctCount,
    totalCount,
    score,
  };
}

function countAnsweredAnswers(payload: Record<string, unknown>): number {
  const answers = readRecord(payload.answers) ?? readRecord(payload.answerDigest) ?? readRecord(payload.answerKeys);
  return answers ? Object.keys(answers).length : 0;
}

function resolveEvidenceQuality(payload: Record<string, unknown>): string | undefined {
  const explicit = readString(payload.evidenceQuality);
  if (explicit) return explicit;
  if (payload.schemaVersion === 'manifest-submission-v2') {
    if (buildQuestionSummaryEvidence(payload)) return 'rich';
    if (countAnsweredAnswers(payload) > 0) return 'partial';
    return 'missing';
  }
  return undefined;
}

function buildInteractiveQuizContext(actionType: string, payload: Record<string, unknown>) {
  if (actionType !== 'lesson_submit' && actionType !== 'lesson_resubmit') {
    return null;
  }

  const questionSummaryEvidence = buildQuestionSummaryEvidence(payload);
  const evidenceQuality = resolveEvidenceQuality(payload);
  const lessonKey = readString(payload.lessonKey);
  const stepId = readString(payload.stepId);
  const baseContext = {
    lessonKey,
    stepId,
    attemptKey: readString(payload.attemptKey),
    clientEventId: readString(payload.clientEventId),
    sourceLogId: readString(payload.sourceLogId),
  };

  if (questionSummaryEvidence) {
    return {
      score: questionSummaryEvidence.score,
      context: compactJsonObject({
        ...baseContext,
        scoring: compactJsonObject({
          supported: true,
          evidenceQuality,
          answeredCount: questionSummaryEvidence.answeredCount,
          correctCount: questionSummaryEvidence.correctCount,
          totalCount: questionSummaryEvidence.totalCount,
          score: questionSummaryEvidence.score,
          basis: questionSummaryEvidence.basis,
        }),
        cards: questionSummaryEvidence.cards,
      }),
    };
  }

  const answeredCount = countAnsweredAnswers(payload);
  if (answeredCount > 0) {
    return {
      score: undefined,
      context: compactJsonObject({
        ...baseContext,
        scoring: compactJsonObject({
          supported: false,
          evidenceQuality,
          reason: 'missing_objective_answer_keys',
          answeredCount,
        }),
      }),
    };
  }

  if (evidenceQuality) {
    return {
      score: undefined,
      context: compactJsonObject({
        ...baseContext,
        scoring: compactJsonObject({
          supported: false,
          evidenceQuality,
          reason: evidenceQuality === 'legacy-envelope'
            ? 'legacy_submit_envelope'
            : 'missing_answer_evidence',
        }),
      }),
    };
  }

  return null;
}

function buildArenaLearningContext(actionType: string, payload: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!actionType.startsWith('arena_')) return undefined;
  const taskId = readString(payload.taskId);
  if (!taskId) return undefined;
  const metrics = readJsonObject(payload.metrics) ?? readJsonObject(payload.metricsJson);
  return {
    arena: {
      taskId,
      objectId: readString(payload.objectId),
      method: readString(payload.method),
      score: typeof payload.score === 'number' && Number.isFinite(payload.score) ? payload.score : undefined,
      valid: typeof payload.valid === 'boolean' ? payload.valid : undefined,
      artifactHash: readString(payload.artifactHash),
      metricProfileId: readString(payload.metricProfileId),
      leaderboardPolicyId: readString(payload.leaderboardPolicyId),
      publicationId: readString(payload.publicationId),
      classId: readString(payload.classId),
      seasonId: readString(payload.seasonId),
      metrics,
    },
  };
}

export function resolveLearningFactActionType(event: LearningEvent): string {
  const payload =
    event.payload && typeof event.payload === 'object'
      ? event.payload
      : {};

  return resolveCanonicalEventType(event.actionType, payload);
}

export function shouldMaterializeLearningFact(actionType: string, payload: Record<string, unknown>): boolean {
  if (payload.skipLearningFact === true) {
    return false;
  }

  if (
    actionType === 'arena_challenge_open' ||
    actionType === 'arena_workspace_start' ||
    actionType === 'arena_result_view' ||
    actionType === 'arena_leaderboard_view' ||
    actionType === 'arena_feedback_view'
  ) {
    return false;
  }

  if (isCoreEvent(actionType)) {
    return true;
  }

  return actionType === 'workspace_param_change' && payload.sampled === true;
}

export function eventToLearningFactInput(event: LearningEvent): Prisma.LearningFactCreateManyInput | null {
  const actionType = resolveLearningFactActionType(event);
  const payload =
    event.payload && typeof event.payload === 'object'
      ? event.payload
      : {};

  if (!shouldMaterializeLearningFact(actionType, payload)) {
    return null;
  }

  if (payload.afterSessionEnd === true && payload.countAfterSessionEnd !== true) {
    return null;
  }

  const interactiveQuizContext = buildInteractiveQuizContext(actionType, payload);
  const score = interactiveQuizContext?.score ?? deriveFactScore(payload);
  const payloadWithDerivedScore =
    typeof score === 'number'
      ? { ...payload, score }
      : payload;
  const fact: Prisma.LearningFactCreateManyInput & { contextJson?: Prisma.InputJsonValue } = {
    userId: event.userId,
    factType: mapActionTypeToFactType(actionType),
    moduleId: event.moduleId ?? readString(payload.moduleId) ?? readString(payload.taskId) ?? readString(payload.stepId),
    sessionId: event.sessionId ?? readString(payload.sessionId),
    startedAt: new Date(event.occurredAt),
    finishedAt: new Date(event.occurredAt),
    outcome: deriveFactOutcome(actionType, payloadWithDerivedScore),
    score,
    timeSpent: deriveFactTimeSpent(payload),
    competencyContribution: resolveCompetencyContribution(
      actionType,
      payload,
      event.derivedMetrics,
    ) as Prisma.InputJsonValue,
    sourceEventId: event.eventId,
    sourceLogId: readString(payload.sourceLogId),
    courseId: event.courseId ?? readString(payload.courseId),
    lessonId: event.lessonId ?? readString(payload.lessonId) ?? readString(payload.lessonKey),
  };
  const arenaContext = buildArenaLearningContext(actionType, payload);
  const evidenceGovernance = resolveLearningFactEvidenceGovernance(actionType, payload);
  const contextJson = compactJsonObject({
    ...(readRecord(arenaContext) ?? {}),
    ...(interactiveQuizContext ? { interactiveQuiz: interactiveQuizContext.context } : {}),
    ...(evidenceGovernance ? { evidenceGovernance } : {}),
  });
  if (Object.keys(contextJson).length > 0) {
    fact.contextJson = contextJson;
  }
  return fact;
}

export async function persistCoreLearningFact(
  db: { learningFact: LearningFactCreateManyDelegate },
  event: LearningEvent,
): Promise<LearningFactPersistenceResult> {
  const actionType = resolveLearningFactActionType(event);
  const fact = eventToLearningFactInput(event);
  if (!fact) {
    return { created: 0, skipped: true, actionType };
  }

  const result = await db.learningFact.createMany({
    data: [fact],
    skipDuplicates: true,
  });

  return {
    created: result.count,
    skipped: result.count === 0,
    actionType,
  };
}
