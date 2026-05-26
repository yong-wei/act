import type { Prisma } from '@prisma/client';

import { buildManifestSubmissionTelemetry } from '@/features/interactive/shared/manifest-runtime/submission-telemetry';
import {
  getInteractiveRuntimeStep,
  type InteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';
import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';
import { MANIFEST_OBJECTIVE_SCORING_VERSION } from '@/lib/manifest-objective-scoring';
import { deriveFactOutcome } from './event-normalization';
import { summarizeSubmissionEvidencePayload } from './submission-evidence-quality';

export const INTERACTIVE_EVIDENCE_SCORING_RECOMPUTE_VERSION = 'interactive-evidence-scoring-recompute-v1';

type JsonRecord = Record<string, unknown>;

export interface InteractiveEvidenceScoringRecomputeFilters {
  sessionIds?: string[];
  lessonKeys?: string[];
  from?: Date;
  to?: Date;
}

export interface InteractiveEvidenceScoringResponseRow {
  id: string;
  userId: string;
  sessionId: string;
  lessonKey: string | null;
  stepId: string;
  attemptKey: string | null;
  sourceLogId: string | null;
  clientEventId: string | null;
  submittedAt: Date;
  responseData: unknown;
}

export interface InteractiveEvidenceScoringInteractionLogRow {
  id: string;
  userId: string;
  sessionId: string | null;
  lessonKey: string | null;
  stepId: string | null;
  attemptKey: string | null;
  eventType: string;
  clientEventId: string | null;
  eventData: unknown;
  createdAt: Date;
  clientEventAt: Date | null;
}

export interface InteractiveEvidenceScoringLearningFactRow {
  id: string;
  userId: string;
  factType: string;
  sessionId: string | null;
  lessonId: string | null;
  moduleId: string | null;
  sourceEventId: string | null;
  sourceLogId: string | null;
  score: number | null;
  outcome: string;
  contextJson: unknown;
}

export interface InteractiveEvidenceScoringPrerequisiteError {
  responseId: string;
  lessonKey: string | null;
  stepId: string;
  reason: 'missing_scoring_version' | 'missing_lesson_key' | 'missing_manifest' | 'missing_step_manifest';
}

export interface InteractiveEvidenceScoringResponseAction {
  action: 'update-derived-scoring' | 'already-current' | 'skip';
  responseId: string;
  userId: string;
  sessionId: string;
  lessonKey: string | null;
  stepId: string;
  questionKinds: string[];
  oldScore: number | null;
  newScore: number | null;
  oldCorrectCount: number | null;
  newCorrectCount: number | null;
  reason?: string;
  nextResponseData?: JsonRecord;
}

export interface InteractiveEvidenceScoringFactAction {
  action: 'update-derived-context';
  factId: string;
  responseId: string;
  oldScore: number | null;
  newScore: number | null;
  oldOutcome: string;
  newOutcome: string;
  oldSourceLogId: string | null;
  nextSourceLogId?: string;
  nextContextJson: JsonRecord;
}

export interface InteractiveEvidenceScoringSourceLogDiagnostic {
  factId: string;
  responseId: string;
  lessonKey: string | null;
  sessionId: string;
  stepId: string;
  sourceEventId: string | null;
  reason: 'missing_source_event_id' | 'missing_matching_interaction_log' | 'ambiguous_matching_interaction_log';
}

export interface InteractiveEvidenceScoringAuditDelta {
  lessonKey: string | null;
  sessionId: string;
  stepId: string;
  questionKinds: string[];
  oldScore: number | null;
  newScore: number | null;
  oldCorrectCount: number | null;
  newCorrectCount: number | null;
  affectedUsers: number;
}

export interface InteractiveEvidenceScoringRecomputePlan {
  generatedAt: string;
  mode: 'dry-run';
  filters: InteractiveEvidenceScoringRecomputeFilters;
  prerequisiteErrors: InteractiveEvidenceScoringPrerequisiteError[];
  responseActions: InteractiveEvidenceScoringResponseAction[];
  factActions: InteractiveEvidenceScoringFactAction[];
  sourceLogDiagnostics: InteractiveEvidenceScoringSourceLogDiagnostic[];
  auditDeltas: InteractiveEvidenceScoringAuditDelta[];
  affectedSessionIds: string[];
  affectedUserIds: string[];
  affectedLessonKeys: string[];
  totals: {
    candidateRows: number;
    responseRowsChanged: number;
    responseRowsCurrent: number;
    responseRowsSkipped: number;
    factRowsChanged: number;
    sourceLogRepairs: number;
    scoreChanges: number;
    affectedLessons: number;
    affectedSessions: number;
    affectedUsers: number;
  };
}

export interface BuildInteractiveEvidenceScoringRecomputePlanInput {
  generatedAt?: string;
  filters?: InteractiveEvidenceScoringRecomputeFilters;
  manifestsByLessonKey?: Record<string, InteractiveRuntimeManifest>;
  studentStepResponses: InteractiveEvidenceScoringResponseRow[];
  interactionLogs: InteractiveEvidenceScoringInteractionLogRow[];
  learningFacts: InteractiveEvidenceScoringLearningFactRow[];
}

type CollectInteractiveEvidenceScoringRecomputeDb = {
  studentStepResponse: {
    findMany(args: unknown): Promise<InteractiveEvidenceScoringResponseRow[]>;
  };
  interactionLog: {
    findMany(args: unknown): Promise<InteractiveEvidenceScoringInteractionLogRow[]>;
  };
  learningFact: {
    findMany(args: unknown): Promise<InteractiveEvidenceScoringLearningFactRow[]>;
  };
};

type ApplyInteractiveEvidenceScoringRecomputeDb = {
  studentStepResponse: {
    update(args: unknown): Promise<unknown>;
  };
  learningFact: {
    update(args: unknown): Promise<unknown>;
  };
};

interface InteractiveEvidenceScoringInteractionLogSourceIndex {
  logsBySourceId: Map<string, InteractiveEvidenceScoringInteractionLogRow[]>;
}

export interface CollectInteractiveEvidenceScoringRecomputePlanInput {
  generatedAt?: string;
  filters?: InteractiveEvidenceScoringRecomputeFilters;
  manifestsByLessonKey?: Record<string, InteractiveRuntimeManifest>;
}

export interface InteractiveEvidenceScoringApplyResult {
  responseRowsUpdated: number;
  factRowsUpdated: number;
  sourceLogIdsRepaired: number;
}

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function compactRecord(value: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function normalizeAnswers(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(readRecord(value))
      .map(([key, entry]) => [key, typeof entry === 'string' ? entry : entry == null ? '' : String(entry)] as const)
      .filter(([key, entry]) => key.trim().length > 0 && entry.trim().length > 0),
  );
}

function readDurableAnswers(data: JsonRecord): Record<string, string> {
  const answers = normalizeAnswers(data.answers);
  if (Object.keys(answers).length > 0) return answers;
  const answerDigest = normalizeAnswers(data.answerDigest);
  if (Object.keys(answerDigest).length > 0) return answerDigest;
  return normalizeAnswers(data.answerKeys);
}

function buildManifestMap(manifestsByLessonKey: Record<string, InteractiveRuntimeManifest> = {}) {
  const map = new Map<string, InteractiveRuntimeManifest>();
  for (const [key, manifest] of Object.entries(manifestsByLessonKey)) {
    for (const alias of [
      key,
      manifest.lessonId,
      manifest.courseRouteSegment,
      manifest.courseRouteSegment ? `${manifest.courseRouteSegment}-v1` : null,
    ]) {
      if (alias) map.set(alias, manifest);
    }
  }
  return map;
}

function getScoringVersion(data: JsonRecord): string | null {
  return readArray(data.questionSummaries)
    .map((summary) => readString(readRecord(summary).scoringVersion))
    .find((value): value is string => Boolean(value))
    ?? readString(readRecord(readRecord(data.interactiveQuiz).scoring).scoringVersion)
    ?? null;
}

function getCorrectCount(data: JsonRecord): number | null {
  const explicit = readNumber(data.correctCount);
  if (explicit !== null) return explicit;
  const summaries = readArray(data.questionSummaries).map(readRecord);
  if (summaries.length === 0) return null;
  return summaries.filter((summary) => summary.isCorrect === true).length;
}

function getQuestionKinds(data: JsonRecord): string[] {
  return uniqueSorted(
    readArray(data.questionSummaries)
      .map((summary) => readString(readRecord(summary).responseKind)),
  );
}

function scoringSnapshot(data: JsonRecord) {
  return {
    score: readNumber(data.score),
    scoringSupported: data.scoringSupported === true,
    correctCount: getCorrectCount(data),
    objectiveTotal: readNumber(data.objectiveTotal),
    scoringVersion: getScoringVersion(data),
    questionSummaries: readArray(data.questionSummaries).map((entry) => {
      const summary = readRecord(entry);
      return {
        questionId: readString(summary.questionId) ?? readString(summary.cardId) ?? readString(summary.id),
        responseKind: readString(summary.responseKind),
        studentAnswer: summary.studentAnswer ?? null,
        referenceValue: summary.referenceValue,
        answered: summary.answered,
        isCorrect: summary.isCorrect,
        score: readNumber(summary.score),
        scoringVersion: readString(summary.scoringVersion),
        normalizedSubmitted: summary.normalizedSubmitted,
        normalizedReference: summary.normalizedReference,
        scoringDetail: summary.scoringDetail ?? summary.detail,
        unsupportedReason: readString(summary.unsupportedReason),
      };
    }),
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function withEvidenceSummaryFields(data: JsonRecord): JsonRecord {
  const summary = summarizeSubmissionEvidencePayload(data);
  return compactRecord({
    ...data,
    evidenceQuality: summary.payloadEvidenceQuality,
    evidenceQualityReason: summary.reason,
    evidenceSourceState: summary.sourceState,
  });
}

function buildNextResponseData(
  response: InteractiveEvidenceScoringResponseRow,
  manifest: InteractiveRuntimeManifest,
  generatedAt: string,
): JsonRecord {
  const data = readRecord(response.responseData);
  const answers = readDurableAnswers(data);
  const stepManifest = getInteractiveRuntimeStep(manifest, response.stepId);
  const telemetry = buildManifestSubmissionTelemetry(
    {
      stepId: response.stepId,
      submittedAt: response.submittedAt.getTime(),
      answers,
    },
    stepManifest,
  );

  return withEvidenceSummaryFields(compactRecord({
    ...data,
    schemaVersion: 'manifest-submission-v2',
    stepId: response.stepId,
    lessonKey: response.lessonKey,
    attemptKey: response.attemptKey,
    clientEventId: response.clientEventId,
    sourceLogId: response.sourceLogId,
    responseKind: telemetry.responseKind,
    interactionKind: telemetry.interactionKind,
    answers: data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers)
      ? data.answers
      : telemetry.answers,
    answerDigest: telemetry.answerDigest,
    questionSummaries: telemetry.questionSummaries,
    scoringSupported: telemetry.scoringSupported,
    correctCount: telemetry.correctCount,
    objectiveTotal: telemetry.objectiveTotal,
    score: telemetry.score,
    subjectiveCompleteness: telemetry.subjectiveCompleteness,
    scoringRecompute: compactRecord({
      version: INTERACTIVE_EVIDENCE_SCORING_RECOMPUTE_VERSION,
      scoringVersion: MANIFEST_OBJECTIVE_SCORING_VERSION,
      responseId: response.id,
      generatedAt,
    }),
  }));
}

function createPrerequisiteError(
  response: InteractiveEvidenceScoringResponseRow,
  reason: InteractiveEvidenceScoringPrerequisiteError['reason'],
): InteractiveEvidenceScoringPrerequisiteError {
  return {
    responseId: response.id,
    lessonKey: response.lessonKey,
    stepId: response.stepId,
    reason,
  };
}

function buildStableResponseSourceEventIds(response: InteractiveEvidenceScoringResponseRow) {
  return new Set([
    response.clientEventId,
    response.sourceLogId ? `interaction-log:${response.sourceLogId}` : null,
    response.sourceLogId ? `historical:InteractionLog:${response.sourceLogId}:lesson_submit` : null,
    response.sourceLogId ? `historical:InteractionLog:${response.sourceLogId}:lesson_resubmit` : null,
    `historical:StudentStepResponse:${response.id}:lesson_submit`,
    `historical:StudentStepResponse:${response.id}:lesson_resubmit`,
    `historical:StudentStepResponse:${response.id}:student_step_response`,
  ].filter((value): value is string => Boolean(value)));
}

function buildResponseFallbackKey(response: Pick<
  InteractiveEvidenceScoringResponseRow,
  'sessionId' | 'userId' | 'lessonKey' | 'stepId'
>) {
  return [
    response.sessionId,
    response.userId,
    response.lessonKey ?? '',
    response.stepId,
  ].join('\u0000');
}

function buildResponseFallbackCounts(responses: InteractiveEvidenceScoringResponseRow[]) {
  const counts = new Map<string, number>();
  for (const response of responses) {
    const key = buildResponseFallbackKey(response);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function addLessonAlias(aliases: Set<string>, value: string | null | undefined) {
  const alias = String(value ?? '').trim();
  if (alias) aliases.add(alias);
}

function buildLessonAliases(lessonKey: string | null) {
  const aliases = new Set<string>();
  addLessonAlias(aliases, lessonKey);
  if (!lessonKey) return aliases;

  const resolved = resolveInteractiveLessonIdentity(lessonKey);
  if (resolved.status === 'resolved') {
    addLessonAlias(aliases, resolved.record.canonicalId);
    addLessonAlias(aliases, resolved.record.runtimeLessonDir);
    for (const alias of resolved.record.routeSegments) addLessonAlias(aliases, alias);
    for (const alias of resolved.record.lessonKeys) addLessonAlias(aliases, alias);
    for (const alias of resolved.record.presetKeys) addLessonAlias(aliases, alias);
    for (const alias of resolved.record.evidenceAliases) addLessonAlias(aliases, alias);
  }

  return aliases;
}

function findMatchingFacts(
  response: InteractiveEvidenceScoringResponseRow,
  learningFacts: InteractiveEvidenceScoringLearningFactRow[],
  fallbackResponseCount: number,
) {
  const stableSourceEventIds = buildStableResponseSourceEventIds(response);
  const lessonAliases = buildLessonAliases(response.lessonKey);
  const belongsToResponse = (fact: InteractiveEvidenceScoringLearningFactRow) => (
    fact.userId === response.userId && fact.sessionId === response.sessionId
  );
  const matchesLesson = (fact: InteractiveEvidenceScoringLearningFactRow) => (
    !response.lessonKey || lessonAliases.has(String(fact.lessonId ?? '').trim())
  );
  const isInteractiveQuestionFact = (fact: InteractiveEvidenceScoringLearningFactRow) => (
    fact.factType === 'question'
    && fact.moduleId === response.stepId
    && matchesLesson(fact)
  );
  const preciseMatches = learningFacts.filter((fact) => (
    belongsToResponse(fact)
    && isInteractiveQuestionFact(fact)
    && (
      Boolean(response.sourceLogId && fact.sourceLogId === response.sourceLogId)
      || Boolean(fact.sourceEventId && stableSourceEventIds.has(fact.sourceEventId))
    )
  ));
  if (preciseMatches.length > 0) return preciseMatches;
  if (fallbackResponseCount !== 1) return [];

  const fallbackMatches = learningFacts.filter((fact) => (
    belongsToResponse(fact)
    && isInteractiveQuestionFact(fact)
  ));
  return fallbackMatches.length === 1 ? fallbackMatches : [];
}

function buildInteractionLogSourceIndex(
  logs: InteractiveEvidenceScoringInteractionLogRow[],
): InteractiveEvidenceScoringInteractionLogSourceIndex {
  const logsBySourceId = new Map<string, InteractiveEvidenceScoringInteractionLogRow[]>();
  for (const log of logs) {
    const payload = readRecord(log.eventData);
    const canonicalEventType = readString(payload.eventType) ?? (log.eventType === 'submit' ? 'lesson_submit' : log.eventType);
    for (const key of [
      log.id,
      `interaction-log:${log.id}`,
      `historical:InteractionLog:${log.id}:${canonicalEventType}`,
      log.clientEventId,
      readString(payload.clientEventId),
    ]) {
      if (!key) continue;
      const existingLogs = logsBySourceId.get(key) ?? [];
      if (!existingLogs.some((entry) => entry.id === log.id)) {
        logsBySourceId.set(key, [...existingLogs, log]);
      }
    }
  }
  return { logsBySourceId };
}

function buildInteractiveQuizContext(responseData: JsonRecord) {
  const summaries = readArray(responseData.questionSummaries).map(readRecord);
  const scoreableCards = summaries.filter((card) => typeof card.score === 'number' || typeof card.isCorrect === 'boolean');
  const answeredCount = summaries.filter((card) => card.answered === true || card.studentAnswer != null).length;
  const correctCount = scoreableCards.filter((card) => card.isCorrect === true).length;
  const totalScore = scoreableCards.reduce((sum, card) => sum + (readNumber(card.score) ?? (card.isCorrect === true ? 1 : 0)), 0);
  const scoringVersion = summaries
    .map((card) => readString(card.scoringVersion))
    .find((value): value is string => Boolean(value));
  const score = readNumber(responseData.score);

  return compactRecord({
    schemaVersion: responseData.schemaVersion,
    evidenceQuality: responseData.evidenceQuality,
    evidenceQualityReason: responseData.evidenceQualityReason,
    evidenceSourceState: responseData.evidenceSourceState,
    answers: responseData.answers,
    answerDigest: responseData.answerDigest,
    questionSummaries: responseData.questionSummaries,
    scoring: compactRecord({
      supported: scoreableCards.length > 0,
      evidenceQuality: responseData.evidenceQuality,
      answeredCount,
      correctCount,
      totalCount: scoreableCards.length,
      totalScore,
      score,
      scoringVersion,
      basis: 'questionSummaries',
    }),
    cards: summaries,
    recompute: compactRecord({
      version: INTERACTIVE_EVIDENCE_SCORING_RECOMPUTE_VERSION,
      scoringVersion,
    }),
  });
}

function findOwnedInteractionLogs(
  response: InteractiveEvidenceScoringResponseRow,
  fact: InteractiveEvidenceScoringLearningFactRow,
  sourceIndex: InteractiveEvidenceScoringInteractionLogSourceIndex,
) {
  if (!fact.sourceEventId) return [];
  return (sourceIndex.logsBySourceId.get(fact.sourceEventId) ?? [])
    .filter((log) => log.userId === response.userId && log.sessionId === response.sessionId);
}

function findOwnedInteractionLog(
  response: InteractiveEvidenceScoringResponseRow,
  fact: InteractiveEvidenceScoringLearningFactRow,
  sourceIndex: InteractiveEvidenceScoringInteractionLogSourceIndex,
) {
  const ownedLogs = findOwnedInteractionLogs(response, fact, sourceIndex);
  return ownedLogs.length === 1 ? ownedLogs[0] : null;
}

function buildFactAction(
  response: InteractiveEvidenceScoringResponseRow,
  responseData: JsonRecord,
  fact: InteractiveEvidenceScoringLearningFactRow,
  sourceIndex: InteractiveEvidenceScoringInteractionLogSourceIndex,
): InteractiveEvidenceScoringFactAction | null {
  const context = readRecord(fact.contextJson);
  const nextScore = readNumber(responseData.score);
  const oldScore = fact.score;
  const newOutcome = nextScore === null ? fact.outcome : deriveFactOutcome('lesson_submit', { score: nextScore });
  const matchingLog = fact.sourceLogId
    ? null
    : findOwnedInteractionLog(response, fact, sourceIndex);
  const nextSourceLogId = matchingLog?.id;
  const nextContextJson = compactRecord({
    ...context,
    interactiveQuiz: buildInteractiveQuizContext(responseData),
    interactiveEvidenceScoringRecompute: compactRecord({
      version: INTERACTIVE_EVIDENCE_SCORING_RECOMPUTE_VERSION,
      responseId: response.id,
      lessonKey: response.lessonKey,
      stepId: response.stepId,
      sourceLogId: nextSourceLogId ?? fact.sourceLogId ?? response.sourceLogId,
    }),
  });
  const contextChanged = !sameJson(context.interactiveQuiz, nextContextJson.interactiveQuiz)
    || !sameJson(context.interactiveEvidenceScoringRecompute, nextContextJson.interactiveEvidenceScoringRecompute);
  const scoreChanged = nextScore !== null && oldScore !== nextScore;
  const outcomeChanged = fact.outcome !== newOutcome;
  const sourceLogChanged = Boolean(nextSourceLogId && fact.sourceLogId !== nextSourceLogId);

  if (!contextChanged && !scoreChanged && !outcomeChanged && !sourceLogChanged) {
    return null;
  }

  return {
    action: 'update-derived-context',
    factId: fact.id,
    responseId: response.id,
    oldScore,
    newScore: nextScore,
    oldOutcome: fact.outcome,
    newOutcome,
    oldSourceLogId: fact.sourceLogId,
    nextSourceLogId,
    nextContextJson,
  };
}

function buildSourceLogDiagnostic(
  response: InteractiveEvidenceScoringResponseRow,
  fact: InteractiveEvidenceScoringLearningFactRow,
  sourceIndex: InteractiveEvidenceScoringInteractionLogSourceIndex,
): InteractiveEvidenceScoringSourceLogDiagnostic | null {
  if (fact.sourceLogId) return null;
  if (!fact.sourceEventId) {
    return {
      factId: fact.id,
      responseId: response.id,
      lessonKey: response.lessonKey,
      sessionId: response.sessionId,
      stepId: response.stepId,
      sourceEventId: null,
      reason: 'missing_source_event_id',
    };
  }
  const ownedLogs = findOwnedInteractionLogs(response, fact, sourceIndex);
  if (ownedLogs.length > 1) {
    return {
      factId: fact.id,
      responseId: response.id,
      lessonKey: response.lessonKey,
      sessionId: response.sessionId,
      stepId: response.stepId,
      sourceEventId: fact.sourceEventId,
      reason: 'ambiguous_matching_interaction_log',
    };
  }
  if (ownedLogs.length === 1) return null;
  return {
    factId: fact.id,
    responseId: response.id,
    lessonKey: response.lessonKey,
    sessionId: response.sessionId,
    stepId: response.stepId,
    sourceEventId: fact.sourceEventId,
    reason: 'missing_matching_interaction_log',
  };
}

function buildAuditDeltas(actions: InteractiveEvidenceScoringResponseAction[]): InteractiveEvidenceScoringAuditDelta[] {
  return actions
    .filter((action) => action.action === 'update-derived-scoring')
    .map((action) => ({
      lessonKey: action.lessonKey,
      sessionId: action.sessionId,
      stepId: action.stepId,
      questionKinds: action.questionKinds,
      oldScore: action.oldScore,
      newScore: action.newScore,
      oldCorrectCount: action.oldCorrectCount,
      newCorrectCount: action.newCorrectCount,
      affectedUsers: 1,
    }));
}

export function buildInteractiveEvidenceScoringRecomputePlan(
  input: BuildInteractiveEvidenceScoringRecomputePlanInput,
): InteractiveEvidenceScoringRecomputePlan {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const manifestMap = buildManifestMap(input.manifestsByLessonKey);
  const prerequisiteErrors: InteractiveEvidenceScoringPrerequisiteError[] = [];
  const responseActions: InteractiveEvidenceScoringResponseAction[] = [];

  for (const response of input.studentStepResponses) {
    const data = readRecord(response.responseData);
    const answers = readDurableAnswers(data);
    const oldScore = readNumber(data.score);
    const oldCorrectCount = getCorrectCount(data);

    if (!MANIFEST_OBJECTIVE_SCORING_VERSION) {
      prerequisiteErrors.push(createPrerequisiteError(response, 'missing_scoring_version'));
      responseActions.push({
        action: 'skip',
        responseId: response.id,
        userId: response.userId,
        sessionId: response.sessionId,
        lessonKey: response.lessonKey,
        stepId: response.stepId,
        questionKinds: getQuestionKinds(data),
        oldScore,
        newScore: null,
        oldCorrectCount,
        newCorrectCount: null,
        reason: 'missing_scoring_version',
      });
      continue;
    }
    if (!response.lessonKey) {
      prerequisiteErrors.push(createPrerequisiteError(response, 'missing_lesson_key'));
      responseActions.push({
        action: 'skip',
        responseId: response.id,
        userId: response.userId,
        sessionId: response.sessionId,
        lessonKey: response.lessonKey,
        stepId: response.stepId,
        questionKinds: getQuestionKinds(data),
        oldScore,
        newScore: null,
        oldCorrectCount,
        newCorrectCount: null,
        reason: 'missing_lesson_key',
      });
      continue;
    }
    const manifest = manifestMap.get(response.lessonKey);
    if (!manifest) {
      prerequisiteErrors.push(createPrerequisiteError(response, 'missing_manifest'));
      responseActions.push({
        action: 'skip',
        responseId: response.id,
        userId: response.userId,
        sessionId: response.sessionId,
        lessonKey: response.lessonKey,
        stepId: response.stepId,
        questionKinds: getQuestionKinds(data),
        oldScore,
        newScore: null,
        oldCorrectCount,
        newCorrectCount: null,
        reason: 'missing_manifest',
      });
      continue;
    }
    if (!getInteractiveRuntimeStep(manifest, response.stepId)) {
      prerequisiteErrors.push(createPrerequisiteError(response, 'missing_step_manifest'));
      responseActions.push({
        action: 'skip',
        responseId: response.id,
        userId: response.userId,
        sessionId: response.sessionId,
        lessonKey: response.lessonKey,
        stepId: response.stepId,
        questionKinds: getQuestionKinds(data),
        oldScore,
        newScore: null,
        oldCorrectCount,
        newCorrectCount: null,
        reason: 'missing_step_manifest',
      });
      continue;
    }
    if (Object.keys(answers).length === 0) {
      responseActions.push({
        action: 'skip',
        responseId: response.id,
        userId: response.userId,
        sessionId: response.sessionId,
        lessonKey: response.lessonKey,
        stepId: response.stepId,
        questionKinds: getQuestionKinds(data),
        oldScore,
        newScore: null,
        oldCorrectCount,
        newCorrectCount: null,
        reason: 'missing_durable_answers',
      });
      continue;
    }

    const nextResponseData = buildNextResponseData(response, manifest, generatedAt);
    const nextScore = readNumber(nextResponseData.score);
    const nextCorrectCount = getCorrectCount(nextResponseData);
    const questionKinds = getQuestionKinds(nextResponseData);
    const changed = !sameJson(scoringSnapshot(data), scoringSnapshot(nextResponseData));
    responseActions.push({
      action: changed ? 'update-derived-scoring' : 'already-current',
      responseId: response.id,
      userId: response.userId,
      sessionId: response.sessionId,
      lessonKey: response.lessonKey,
      stepId: response.stepId,
      questionKinds,
      oldScore,
      newScore: nextScore,
      oldCorrectCount,
      newCorrectCount: nextCorrectCount,
      ...(changed ? { nextResponseData } : {}),
    });
  }

  const responseById = new Map(input.studentStepResponses.map((response) => [response.id, response]));
  const responseFallbackCounts = buildResponseFallbackCounts(input.studentStepResponses);
  const nextResponseDataById = new Map(
    responseActions
      .filter((action) => action.action === 'update-derived-scoring' && action.nextResponseData)
      .map((action) => [action.responseId, action.nextResponseData as JsonRecord]),
  );
  for (const action of responseActions) {
    if (action.action === 'already-current') {
      const response = responseById.get(action.responseId);
      if (response) nextResponseDataById.set(action.responseId, readRecord(response.responseData));
    }
  }

  const sourceIndex = buildInteractionLogSourceIndex(input.interactionLogs);
  const factActions: InteractiveEvidenceScoringFactAction[] = [];
  const seenFactIds = new Set<string>();
  const sourceLogDiagnostics: InteractiveEvidenceScoringSourceLogDiagnostic[] = [];
  const seenSourceLogDiagnosticFactIds = new Set<string>();
  if (prerequisiteErrors.length === 0) {
    for (const action of responseActions) {
      if (action.action !== 'update-derived-scoring' && action.action !== 'already-current') continue;
      const response = responseById.get(action.responseId);
      const responseData = nextResponseDataById.get(action.responseId);
      if (!response || !responseData) continue;

      for (const fact of findMatchingFacts(
        response,
        input.learningFacts,
        responseFallbackCounts.get(buildResponseFallbackKey(response)) ?? 0,
      )) {
        const sourceLogDiagnostic = buildSourceLogDiagnostic(response, fact, sourceIndex);
        if (sourceLogDiagnostic && !seenSourceLogDiagnosticFactIds.has(fact.id)) {
          seenSourceLogDiagnosticFactIds.add(fact.id);
          sourceLogDiagnostics.push(sourceLogDiagnostic);
        }
        if (seenFactIds.has(fact.id)) continue;
        const factAction = buildFactAction(response, responseData, fact, sourceIndex);
        if (!factAction) continue;
        seenFactIds.add(fact.id);
        factActions.push(factAction);
      }
    }
  }

  const affectedSessionIds = uniqueSorted(input.studentStepResponses.map((response) => response.sessionId));
  const affectedUserIds = uniqueSorted(input.studentStepResponses.map((response) => response.userId));
  const affectedLessonKeys = uniqueSorted(input.studentStepResponses.map((response) => response.lessonKey));
  const auditDeltas = buildAuditDeltas(responseActions);

  return {
    generatedAt,
    mode: 'dry-run',
    filters: input.filters ?? {},
    prerequisiteErrors,
    responseActions,
    factActions,
    sourceLogDiagnostics,
    auditDeltas,
    affectedSessionIds,
    affectedUserIds,
    affectedLessonKeys,
    totals: {
      candidateRows: input.studentStepResponses.length,
      responseRowsChanged: responseActions.filter((action) => action.action === 'update-derived-scoring').length,
      responseRowsCurrent: responseActions.filter((action) => action.action === 'already-current').length,
      responseRowsSkipped: responseActions.filter((action) => action.action === 'skip').length,
      factRowsChanged: factActions.length,
      sourceLogRepairs: factActions.filter((action) => action.nextSourceLogId && action.oldSourceLogId !== action.nextSourceLogId).length,
      scoreChanges: responseActions.filter((action) => (
        action.action === 'update-derived-scoring' && action.oldScore !== action.newScore
      )).length,
      affectedLessons: affectedLessonKeys.length,
      affectedSessions: affectedSessionIds.length,
      affectedUsers: affectedUserIds.length,
    },
  };
}

function buildResponseWhere(filters: InteractiveEvidenceScoringRecomputeFilters = {}) {
  return compactRecord({
    ...(filters.sessionIds?.length ? { sessionId: { in: filters.sessionIds } } : {}),
    ...(filters.lessonKeys?.length ? { lessonKey: { in: filters.lessonKeys } } : {}),
    ...((filters.from || filters.to) ? {
      submittedAt: compactRecord({
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      }),
    } : {}),
  });
}

export async function collectInteractiveEvidenceScoringRecomputePlan(
  db: CollectInteractiveEvidenceScoringRecomputeDb,
  input: CollectInteractiveEvidenceScoringRecomputePlanInput,
): Promise<InteractiveEvidenceScoringRecomputePlan> {
  const filters = input.filters ?? {};
  const studentStepResponses = await db.studentStepResponse.findMany({
    where: buildResponseWhere(filters),
    orderBy: { submittedAt: 'asc' },
    select: {
      id: true,
      userId: true,
      sessionId: true,
      lessonKey: true,
      stepId: true,
      attemptKey: true,
      sourceLogId: true,
      clientEventId: true,
      submittedAt: true,
      responseData: true,
    },
  });
  const sessionIds = uniqueSorted(studentStepResponses.map((response) => response.sessionId));
  const userIds = uniqueSorted(studentStepResponses.map((response) => response.userId));
  const sourceLogIds = uniqueSorted(studentStepResponses.map((response) => response.sourceLogId));
  const clientEventIds = uniqueSorted(studentStepResponses.map((response) => response.clientEventId));

  let interactionLogs: InteractiveEvidenceScoringInteractionLogRow[] = [];
  let learningFacts: InteractiveEvidenceScoringLearningFactRow[] = [];

  if (sessionIds.length > 0 && userIds.length > 0) {
    [interactionLogs, learningFacts] = await Promise.all([
      db.interactionLog.findMany({
        where: {
          OR: [
            ...(sourceLogIds.length ? [{ id: { in: sourceLogIds } }] : []),
            ...(clientEventIds.length ? [{ clientEventId: { in: clientEventIds } }] : []),
            { sessionId: { in: sessionIds }, userId: { in: userIds } },
          ],
        },
        select: {
          id: true,
          userId: true,
          sessionId: true,
          lessonKey: true,
          stepId: true,
          attemptKey: true,
          eventType: true,
          clientEventId: true,
          eventData: true,
          createdAt: true,
          clientEventAt: true,
        },
      }),
      db.learningFact.findMany({
        where: {
          sessionId: { in: sessionIds },
          userId: { in: userIds },
        },
        select: {
          id: true,
          userId: true,
          factType: true,
          sessionId: true,
          lessonId: true,
          moduleId: true,
          sourceEventId: true,
          sourceLogId: true,
          score: true,
          outcome: true,
          contextJson: true,
        },
      }),
    ]);
  }

  return buildInteractiveEvidenceScoringRecomputePlan({
    generatedAt: input.generatedAt,
    filters,
    manifestsByLessonKey: input.manifestsByLessonKey,
    studentStepResponses,
    interactionLogs,
    learningFacts,
  });
}

export async function applyInteractiveEvidenceScoringRecomputePlan(
  db: ApplyInteractiveEvidenceScoringRecomputeDb,
  plan: InteractiveEvidenceScoringRecomputePlan,
): Promise<InteractiveEvidenceScoringApplyResult> {
  if (plan.prerequisiteErrors.length > 0) {
    const reasons = uniqueSorted(plan.prerequisiteErrors.map((error) => error.reason));
    throw new Error(`Cannot apply interactive evidence scoring recompute: ${reasons.join(', ')}`);
  }

  let responseRowsUpdated = 0;
  let factRowsUpdated = 0;
  let sourceLogIdsRepaired = 0;

  for (const action of plan.responseActions) {
    if (action.action !== 'update-derived-scoring' || !action.nextResponseData) continue;
    await db.studentStepResponse.update({
      where: { id: action.responseId },
      data: { responseData: action.nextResponseData as Prisma.InputJsonValue },
    });
    responseRowsUpdated += 1;
  }

  for (const action of plan.factActions) {
    const data: JsonRecord = {
      contextJson: action.nextContextJson as Prisma.InputJsonValue,
    };
    if (action.newScore !== null && action.oldScore !== action.newScore) {
      data.score = action.newScore;
    }
    if (action.oldOutcome !== action.newOutcome) {
      data.outcome = action.newOutcome;
    }
    if (action.nextSourceLogId && action.oldSourceLogId !== action.nextSourceLogId) {
      data.sourceLogId = action.nextSourceLogId;
      sourceLogIdsRepaired += 1;
    }
    await db.learningFact.update({
      where: { id: action.factId },
      data,
    });
    factRowsUpdated += 1;
  }

  return {
    responseRowsUpdated,
    factRowsUpdated,
    sourceLogIdsRepaired,
  };
}
