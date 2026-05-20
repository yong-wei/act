import type { Prisma } from '@prisma/client';

import { buildManifestSubmissionTelemetry } from '@/features/interactive/shared/manifest-runtime/submission-telemetry';
import {
  getInteractiveRuntimeStep,
  type InteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';
import { generateSessionSummaryReports } from './session-reports';

export const COURSE_EVIDENCE_BACKFILL_VERSION = 'course-evidence-backfill-v1';

type JsonRecord = Record<string, unknown>;

export interface CourseEvidenceBackfillFilters {
  sessionIds?: string[];
  lessonKeys?: string[];
  from?: Date;
  to?: Date;
}

export interface CourseEvidenceBackfillResponseRow {
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

export interface CourseEvidenceBackfillStudentStateRow {
  sessionId: string;
  userId: string;
  stateKey: string;
  lessonKey: string | null;
  itemId: string | null;
  data: unknown;
  submittedAt: Date;
  lastClientEventAt: Date | null;
}

export interface CourseEvidenceBackfillLearningFactRow {
  id: string;
  userId: string;
  sessionId: string | null;
  lessonId: string | null;
  moduleId: string | null;
  sourceEventId: string | null;
  sourceLogId: string | null;
  score: number | null;
  outcome: string;
  contextJson: unknown;
}

export type CourseEvidenceResponseActionKind =
  | 'enrich'
  | 'mark-unrecoverable'
  | 'already-enriched'
  | 'already-unrecoverable';

export interface CourseEvidenceBackfillResponseAction {
  action: CourseEvidenceResponseActionKind;
  responseId: string;
  userId: string;
  sessionId: string;
  lessonKey: string | null;
  stepId: string;
  source: 'final-state-enriched' | 'legacy-envelope' | 'existing';
  reason?: string;
  nextResponseData?: JsonRecord;
}

export type CourseEvidenceFactActionKind = 'enrich-context' | 'mark-legacy-context';

export interface CourseEvidenceBackfillFactAction {
  action: CourseEvidenceFactActionKind;
  factId: string;
  responseId: string;
  nextContextJson: JsonRecord;
  nextScore?: number;
}

export interface CourseEvidenceBackfillCoverageMetrics {
  totalRows: number;
  answerAvailableRows: number;
  scoreAvailableRows: number;
  questionSummaryAvailableRows: number;
  richRows: number;
  partialRows: number;
  legacyRows: number;
  missingRows: number;
}

export interface CourseEvidenceBackfillPlan {
  generatedAt: string;
  mode: 'dry-run';
  filters: CourseEvidenceBackfillFilters;
  responseActions: CourseEvidenceBackfillResponseAction[];
  factActions: CourseEvidenceBackfillFactAction[];
  affectedSessionIds: string[];
  affectedUserIds: string[];
  coverage: {
    before: CourseEvidenceBackfillCoverageMetrics;
    after: CourseEvidenceBackfillCoverageMetrics;
  };
  totals: {
    candidateRows: number;
    recoverableRows: number;
    newlyEnrichableRows: number;
    alreadyEnrichedRows: number;
    unrecoverableRows: number;
    alreadyUnrecoverableRows: number;
    factRowsEnrichable: number;
    factRowsLegacyMarkable: number;
    affectedSessions: number;
    affectedUsers: number;
  };
}

export interface BuildCourseEvidenceBackfillPlanInput {
  generatedAt?: string;
  filters?: CourseEvidenceBackfillFilters;
  manifestsByLessonKey?: Record<string, InteractiveRuntimeManifest>;
  studentStepResponses: CourseEvidenceBackfillResponseRow[];
  studentStates: CourseEvidenceBackfillStudentStateRow[];
  learningFacts: CourseEvidenceBackfillLearningFactRow[];
}

type CourseEvidenceBackfillCollectDb = {
  studentStepResponse: {
    findMany(args: unknown): Promise<CourseEvidenceBackfillResponseRow[]>;
  };
  studentState: {
    findMany(args: unknown): Promise<CourseEvidenceBackfillStudentStateRow[]>;
  };
  learningFact: {
    findMany(args: unknown): Promise<CourseEvidenceBackfillLearningFactRow[]>;
  };
};

type CourseEvidenceBackfillApplyDb = {
  studentStepResponse: {
    update(args: unknown): Promise<unknown>;
  };
  learningFact: {
    update(args: unknown): Promise<unknown>;
  };
};

export interface CollectCourseEvidenceBackfillPlanInput {
  generatedAt?: string;
  filters?: CourseEvidenceBackfillFilters;
  manifestsByLessonKey?: Record<string, InteractiveRuntimeManifest>;
}

export interface CourseEvidenceBackfillApplyResult {
  responseRowsUpdated: number;
  factRowsUpdated: number;
  alreadyEnrichedRows: number;
  alreadyUnrecoverableRows: number;
}

export interface CourseEvidenceReportRegenerationResult {
  sessionsRequested: number;
  sessionsRegenerated: number;
  sessionsSkipped: number;
  classReports: number;
  studentReports: number;
}

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
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

function hasEntries(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);
}

function hasQuestionSummaries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function normalizeAnswers(value: unknown): Record<string, string> {
  const record = readRecord(value);
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, entry]) => [key, typeof entry === 'string' ? entry : entry == null ? '' : String(entry)] as const)
      .filter(([key, entry]) => key.trim().length > 0 && entry.trim().length > 0),
  );
}

function getStateStepResponse(state: CourseEvidenceBackfillStudentStateRow | undefined, stepId: string) {
  const responses = readRecord(readRecord(state?.data).responses);
  return readRecord(responses[stepId]);
}

function getResponseAnswersFromState(state: CourseEvidenceBackfillStudentStateRow | undefined, stepId: string) {
  return normalizeAnswers(getStateStepResponse(state, stepId).answers);
}

function getStateStepSubmittedAt(state: CourseEvidenceBackfillStudentStateRow | undefined, stepId: string) {
  return readNumber(getStateStepResponse(state, stepId).submittedAt);
}

function getStateStepAttemptKey(state: CourseEvidenceBackfillStudentStateRow | undefined, stepId: string) {
  return readString(getStateStepResponse(state, stepId).attemptKey);
}

function getStateSubmittedAt(state: CourseEvidenceBackfillStudentStateRow | undefined, stepId: string) {
  const submittedAt = getStateStepSubmittedAt(state, stepId);
  return submittedAt ?? state?.lastClientEventAt?.getTime() ?? state?.submittedAt.getTime() ?? Date.now();
}

function createStateKey(row: { sessionId: string; userId: string }) {
  return `${row.sessionId}\u0000${row.userId}`;
}

function sortStateRows(rows: CourseEvidenceBackfillStudentStateRow[]) {
  return [...rows].sort((left, right) => {
    const leftTime = (left.lastClientEventAt ?? left.submittedAt).getTime();
    const rightTime = (right.lastClientEventAt ?? right.submittedAt).getTime();
    return rightTime - leftTime;
  });
}

function buildStateMap(rows: CourseEvidenceBackfillStudentStateRow[]) {
  const map = new Map<string, CourseEvidenceBackfillStudentStateRow>();
  for (const row of sortStateRows(rows)) {
    const key = createStateKey(row);
    if (!map.has(key)) map.set(key, row);
  }
  return map;
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

function getManifestForResponse(
  response: CourseEvidenceBackfillResponseRow,
  manifestMap: Map<string, InteractiveRuntimeManifest>,
) {
  return response.lessonKey ? manifestMap.get(response.lessonKey) ?? null : null;
}

function isManifestSubmissionV2(data: JsonRecord) {
  return data.schemaVersion === 'manifest-submission-v2';
}

function hasUsableSubmissionEvidence(data: JsonRecord) {
  return hasEntries(data.answers)
    || hasEntries(data.answerDigest)
    || hasQuestionSummaries(data.questionSummaries)
    || typeof data.score === 'number';
}

function isAlreadyBackfilled(data: JsonRecord, status?: string) {
  const backfill = readRecord(data.backfill);
  return backfill.version === COURSE_EVIDENCE_BACKFILL_VERSION
    && (!status || backfill.status === status);
}

function buildBackfillMetadata(
  response: CourseEvidenceBackfillResponseRow,
  state: CourseEvidenceBackfillStudentStateRow | undefined,
  status: 'final-state-enriched' | 'legacy-unrecoverable',
  generatedAt: string,
  reason?: string,
) {
  return compactRecord({
    version: COURSE_EVIDENCE_BACKFILL_VERSION,
    status,
    source: status === 'final-state-enriched' ? 'final-state' : 'legacy-envelope',
    reason,
    responseId: response.id,
    sessionId: response.sessionId,
    userId: response.userId,
    lessonKey: response.lessonKey,
    stepId: response.stepId,
    sourceLogId: response.sourceLogId,
    studentStateKey: state?.stateKey,
    studentStateItemId: state?.itemId,
    studentStateSubmittedAt: state?.submittedAt.toISOString(),
    studentStateLastClientEventAt: state?.lastClientEventAt?.toISOString(),
    generatedAt,
  });
}

function buildEnrichedResponseData(
  response: CourseEvidenceBackfillResponseRow,
  state: CourseEvidenceBackfillStudentStateRow,
  manifest: InteractiveRuntimeManifest | null,
  generatedAt: string,
) {
  const answers = getResponseAnswersFromState(state, response.stepId);
  const stepManifest = manifest ? getInteractiveRuntimeStep(manifest, response.stepId) : null;
  const backfill = buildBackfillMetadata(response, state, 'final-state-enriched', generatedAt);
  const telemetry = buildManifestSubmissionTelemetry(
    {
      stepId: response.stepId,
      submittedAt: getStateSubmittedAt(state, response.stepId),
      answers,
    },
    stepManifest,
    {
      extraEvidence: {
        backfillSource: 'final-state-enriched',
        manifestLessonId: manifest?.lessonId,
      },
    },
  );

  return compactRecord({
    ...readRecord(response.responseData),
    ...telemetry,
    eventType: readString(readRecord(response.responseData).eventType) ?? 'lesson_submit',
    lessonKey: response.lessonKey,
    stepId: response.stepId,
    attemptKey: response.attemptKey,
    clientEventId: response.clientEventId,
    sourceLogId: response.sourceLogId,
    backfill,
  });
}

function buildLegacyResponseData(
  response: CourseEvidenceBackfillResponseRow,
  state: CourseEvidenceBackfillStudentStateRow | undefined,
  generatedAt: string,
  reason = 'missing_durable_answers',
) {
  return compactRecord({
    ...readRecord(response.responseData),
    eventType: readString(readRecord(response.responseData).eventType) ?? 'lesson_submit',
    evidenceQuality: 'legacy-envelope',
    lessonKey: response.lessonKey,
    stepId: response.stepId,
    attemptKey: response.attemptKey,
    clientEventId: response.clientEventId,
    sourceLogId: response.sourceLogId,
    backfill: buildBackfillMetadata(
      response,
      state,
      'legacy-unrecoverable',
      generatedAt,
      reason,
    ),
  });
}

function summarizeCoverage(rows: JsonRecord[]): CourseEvidenceBackfillCoverageMetrics {
  const metrics: CourseEvidenceBackfillCoverageMetrics = {
    totalRows: rows.length,
    answerAvailableRows: 0,
    scoreAvailableRows: 0,
    questionSummaryAvailableRows: 0,
    richRows: 0,
    partialRows: 0,
    legacyRows: 0,
    missingRows: 0,
  };

  for (const row of rows) {
    if (hasEntries(row.answers) || hasEntries(row.answerDigest)) metrics.answerAvailableRows += 1;
    if (typeof row.score === 'number') metrics.scoreAvailableRows += 1;
    if (hasQuestionSummaries(row.questionSummaries)) metrics.questionSummaryAvailableRows += 1;
    if (row.evidenceQuality === 'rich') metrics.richRows += 1;
    else if (row.evidenceQuality === 'partial') metrics.partialRows += 1;
    else if (row.evidenceQuality === 'missing') metrics.missingRows += 1;
    else metrics.legacyRows += 1;
  }

  return metrics;
}

function resolveResponseEventType(response: CourseEvidenceBackfillResponseRow) {
  const eventType = readString(readRecord(response.responseData).eventType);
  return eventType === 'lesson_resubmit' ? 'lesson_resubmit' : 'lesson_submit';
}

function buildStableResponseSourceEventIds(response: CourseEvidenceBackfillResponseRow) {
  const eventType = resolveResponseEventType(response);
  return new Set([
    response.clientEventId,
    response.sourceLogId ? `interaction-log:${response.sourceLogId}` : null,
    response.sourceLogId ? `historical:InteractionLog:${response.sourceLogId}:${eventType}` : null,
    `historical:StudentStepResponse:${response.id}:${eventType}`,
    `historical:StudentStepResponse:${response.id}:student_step_response`,
  ].filter((value): value is string => Boolean(value)));
}

function buildResponseFallbackKey(response: Pick<
  CourseEvidenceBackfillResponseRow,
  'sessionId' | 'userId' | 'lessonKey' | 'stepId'
>) {
  return [
    response.sessionId,
    response.userId,
    response.lessonKey ?? '',
    response.stepId,
  ].join('\u0000');
}

function buildResponseFallbackCounts(responses: CourseEvidenceBackfillResponseRow[]) {
  const counts = new Map<string, number>();
  for (const response of responses) {
    const key = buildResponseFallbackKey(response);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function latestUniqueResponse(responses: CourseEvidenceBackfillResponseRow[]) {
  let latest: CourseEvidenceBackfillResponseRow | null = null;
  let tied = false;

  for (const response of responses) {
    const submittedAt = response.submittedAt.getTime();
    const latestSubmittedAt = latest?.submittedAt.getTime();
    if (!latest || latestSubmittedAt === undefined || submittedAt > latestSubmittedAt) {
      latest = response;
      tied = false;
    } else if (submittedAt === latestSubmittedAt) {
      tied = true;
    }
  }

  return tied ? null : latest;
}

function closestUniqueResponse(
  responses: CourseEvidenceBackfillResponseRow[],
  targetSubmittedAt: number,
) {
  let closest: CourseEvidenceBackfillResponseRow | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  let tied = false;

  for (const response of responses) {
    const distance = Math.abs(response.submittedAt.getTime() - targetSubmittedAt);
    if (distance < closestDistance) {
      closest = response;
      closestDistance = distance;
      tied = false;
    } else if (distance === closestDistance) {
      tied = true;
    }
  }

  return tied ? null : closest;
}

function findFinalStateResponse(
  responses: CourseEvidenceBackfillResponseRow[],
  state: CourseEvidenceBackfillStudentStateRow | undefined,
) {
  if (responses.length === 0) return null;
  if (responses.length === 1) return responses[0];

  const stepId = responses[0].stepId;
  const stateAttemptKey = getStateStepAttemptKey(state, stepId);
  if (stateAttemptKey) {
    const attemptMatches = responses.filter((response) => response.attemptKey === stateAttemptKey);
    const latestAttemptMatch = latestUniqueResponse(attemptMatches);
    if (latestAttemptMatch) return latestAttemptMatch;
  }

  const stateSubmittedAt = getStateStepSubmittedAt(state, stepId);
  if (stateSubmittedAt !== null) {
    const notAfterState = responses.filter((response) => response.submittedAt.getTime() <= stateSubmittedAt);
    const latestNotAfterState = latestUniqueResponse(notAfterState);
    if (latestNotAfterState) return latestNotAfterState;
    return closestUniqueResponse(responses, stateSubmittedAt);
  }

  return latestUniqueResponse(responses);
}

function buildFinalStateResponseIds(
  responses: CourseEvidenceBackfillResponseRow[],
  stateMap: Map<string, CourseEvidenceBackfillStudentStateRow>,
) {
  const responseGroups = new Map<string, CourseEvidenceBackfillResponseRow[]>();
  for (const response of responses) {
    const key = buildResponseFallbackKey(response);
    responseGroups.set(key, [...(responseGroups.get(key) ?? []), response]);
  }

  const finalStateResponseIds = new Set<string>();
  responseGroups.forEach((group) => {
    const finalStateResponse = findFinalStateResponse(group, stateMap.get(createStateKey(group[0])));
    if (finalStateResponse) finalStateResponseIds.add(finalStateResponse.id);
  });
  return finalStateResponseIds;
}

function findMatchingFacts(
  response: CourseEvidenceBackfillResponseRow,
  learningFacts: CourseEvidenceBackfillLearningFactRow[],
  fallbackResponseCount: number,
) {
  const stableSourceEventIds = buildStableResponseSourceEventIds(response);
  const preciseMatches = learningFacts.filter((fact) => (
    Boolean(response.sourceLogId && fact.sourceLogId === response.sourceLogId)
    || Boolean(fact.sourceEventId && stableSourceEventIds.has(fact.sourceEventId))
  ));
  if (preciseMatches.length > 0) return preciseMatches;
  if (fallbackResponseCount !== 1) return [];

  const fallbackMatches = learningFacts.filter((fact) => {
    return fact.sessionId === response.sessionId
      && fact.userId === response.userId
      && fact.moduleId === response.stepId
      && (!response.lessonKey || fact.lessonId === response.lessonKey);
  });
  return fallbackMatches.length === 1 ? fallbackMatches : [];
}

function buildInteractiveQuizContext(responseData: JsonRecord) {
  return compactRecord({
    schemaVersion: responseData.schemaVersion,
    evidenceQuality: responseData.evidenceQuality,
    answers: responseData.answers,
    answerDigest: responseData.answerDigest,
    questionSummaries: responseData.questionSummaries,
    scoringSupported: responseData.scoringSupported,
    correctCount: responseData.correctCount,
    objectiveTotal: responseData.objectiveTotal,
    score: responseData.score,
  });
}

function createFactAction(
  action: CourseEvidenceBackfillResponseAction,
  fact: CourseEvidenceBackfillLearningFactRow,
) {
  const context = readRecord(fact.contextJson);
  const existingBackfill = readRecord(context.courseEvidenceBackfill);
  if (existingBackfill.version === COURSE_EVIDENCE_BACKFILL_VERSION) return null;

  if ((action.action === 'enrich' || action.action === 'already-enriched') && action.nextResponseData) {
    const score = readNumber(action.nextResponseData.score);
    const responseBackfill = readRecord(action.nextResponseData.backfill);
    const nextContextJson = compactRecord({
      ...context,
      interactiveQuiz: buildInteractiveQuizContext(action.nextResponseData),
      courseEvidenceBackfill: responseBackfill.version === COURSE_EVIDENCE_BACKFILL_VERSION
        ? responseBackfill
        : compactRecord({
          version: COURSE_EVIDENCE_BACKFILL_VERSION,
          status: 'already-manifest-enriched',
          source: 'student-step-response',
          responseId: action.responseId,
          sessionId: action.sessionId,
          userId: action.userId,
          lessonKey: action.lessonKey,
          stepId: action.stepId,
        }),
    });
    return {
      action: 'enrich-context' as const,
      factId: fact.id,
      responseId: action.responseId,
      nextContextJson,
      ...(score !== null && fact.score === null ? { nextScore: score } : {}),
    };
  }

  if (action.action === 'mark-unrecoverable' && action.nextResponseData) {
    return {
      action: 'mark-legacy-context' as const,
      factId: fact.id,
      responseId: action.responseId,
      nextContextJson: compactRecord({
        ...context,
        courseEvidenceBackfill: action.nextResponseData.backfill,
      }),
    };
  }

  return null;
}

export function buildCourseEvidenceBackfillPlan(
  input: BuildCourseEvidenceBackfillPlanInput,
): CourseEvidenceBackfillPlan {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const stateMap = buildStateMap(input.studentStates);
  const manifestMap = buildManifestMap(input.manifestsByLessonKey);
  const finalStateResponseIds = buildFinalStateResponseIds(input.studentStepResponses, stateMap);
  const responseActions: CourseEvidenceBackfillResponseAction[] = [];

  for (const response of input.studentStepResponses) {
    const data = readRecord(response.responseData);
    const state = stateMap.get(createStateKey(response));
    const alreadyEnriched = isAlreadyBackfilled(data, 'final-state-enriched')
      || (isManifestSubmissionV2(data) && hasUsableSubmissionEvidence(data));
    const alreadyUnrecoverable = isAlreadyBackfilled(data, 'legacy-unrecoverable');

    if (alreadyEnriched) {
      responseActions.push({
        action: 'already-enriched',
        responseId: response.id,
        userId: response.userId,
        sessionId: response.sessionId,
        lessonKey: response.lessonKey,
        stepId: response.stepId,
        source: 'existing',
        nextResponseData: data,
      });
      continue;
    }

    if (alreadyUnrecoverable) {
      responseActions.push({
        action: 'already-unrecoverable',
        responseId: response.id,
        userId: response.userId,
        sessionId: response.sessionId,
        lessonKey: response.lessonKey,
        stepId: response.stepId,
        source: 'existing',
        reason: 'missing_durable_answers',
      });
      continue;
    }

    const answers = getResponseAnswersFromState(state, response.stepId);
    if (state && Object.keys(answers).length > 0) {
      if (!finalStateResponseIds.has(response.id)) {
        const reason = 'final_state_not_attempt_safe';
        responseActions.push({
          action: 'mark-unrecoverable',
          responseId: response.id,
          userId: response.userId,
          sessionId: response.sessionId,
          lessonKey: response.lessonKey,
          stepId: response.stepId,
          source: 'legacy-envelope',
          reason,
          nextResponseData: buildLegacyResponseData(response, state, generatedAt, reason),
        });
        continue;
      }

      const manifest = getManifestForResponse(response, manifestMap);
      responseActions.push({
        action: 'enrich',
        responseId: response.id,
        userId: response.userId,
        sessionId: response.sessionId,
        lessonKey: response.lessonKey,
        stepId: response.stepId,
        source: 'final-state-enriched',
        nextResponseData: buildEnrichedResponseData(response, state, manifest, generatedAt),
      });
      continue;
    }

    responseActions.push({
      action: 'mark-unrecoverable',
      responseId: response.id,
      userId: response.userId,
      sessionId: response.sessionId,
      lessonKey: response.lessonKey,
      stepId: response.stepId,
      source: 'legacy-envelope',
      reason: 'missing_durable_answers',
      nextResponseData: buildLegacyResponseData(response, state, generatedAt),
    });
  }

  const responseById = new Map(input.studentStepResponses.map((response) => [response.id, response]));
  const responseFallbackCounts = buildResponseFallbackCounts(input.studentStepResponses);
  const factActions: CourseEvidenceBackfillFactAction[] = [];
  const seenFactIds = new Set<string>();

  for (const action of responseActions) {
    if (
      action.action !== 'enrich'
      && action.action !== 'mark-unrecoverable'
      && action.action !== 'already-enriched'
    ) {
      continue;
    }
    const response = responseById.get(action.responseId);
    if (!response) continue;
    for (const fact of findMatchingFacts(
      response,
      input.learningFacts,
      responseFallbackCounts.get(buildResponseFallbackKey(response)) ?? 0,
    )) {
      if (seenFactIds.has(fact.id)) continue;
      const factAction = createFactAction(action, fact);
      if (!factAction) continue;
      seenFactIds.add(fact.id);
      factActions.push(factAction);
    }
  }

  const nextResponseDataById = new Map(
    responseActions
      .filter((action) => action.nextResponseData)
      .map((action) => [action.responseId, action.nextResponseData as JsonRecord]),
  );
  const beforeRows = input.studentStepResponses.map((response) => readRecord(response.responseData));
  const afterRows = input.studentStepResponses.map((response) => (
    nextResponseDataById.get(response.id) ?? readRecord(response.responseData)
  ));
  const affectedSessionIds = uniqueSorted(input.studentStepResponses.map((response) => response.sessionId));
  const affectedUserIds = uniqueSorted(input.studentStepResponses.map((response) => response.userId));

  return {
    generatedAt,
    mode: 'dry-run',
    filters: input.filters ?? {},
    responseActions,
    factActions,
    affectedSessionIds,
    affectedUserIds,
    coverage: {
      before: summarizeCoverage(beforeRows),
      after: summarizeCoverage(afterRows),
    },
    totals: {
      candidateRows: input.studentStepResponses.length,
      recoverableRows: responseActions.filter((action) => action.action === 'enrich').length,
      newlyEnrichableRows: responseActions.filter((action) => action.action === 'enrich').length,
      alreadyEnrichedRows: responseActions.filter((action) => action.action === 'already-enriched').length,
      unrecoverableRows: responseActions.filter((action) => action.action === 'mark-unrecoverable').length,
      alreadyUnrecoverableRows: responseActions.filter((action) => action.action === 'already-unrecoverable').length,
      factRowsEnrichable: factActions.filter((action) => action.action === 'enrich-context').length,
      factRowsLegacyMarkable: factActions.filter((action) => action.action === 'mark-legacy-context').length,
      affectedSessions: affectedSessionIds.length,
      affectedUsers: affectedUserIds.length,
    },
  };
}

function buildResponseWhere(filters: CourseEvidenceBackfillFilters = {}) {
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

export async function collectCourseEvidenceBackfillPlan(
  db: CourseEvidenceBackfillCollectDb,
  input: CollectCourseEvidenceBackfillPlanInput,
): Promise<CourseEvidenceBackfillPlan> {
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
  const [studentStates, learningFacts] = sessionIds.length === 0 || userIds.length === 0
    ? [[], []]
    : await Promise.all([
      db.studentState.findMany({
        where: {
          sessionId: { in: sessionIds },
          userId: { in: userIds },
          NOT: { stateKey: { startsWith: 'teacher' } },
        },
        orderBy: [{ lastClientEventAt: 'desc' }, { submittedAt: 'desc' }],
        select: {
          sessionId: true,
          userId: true,
          stateKey: true,
          lessonKey: true,
          itemId: true,
          data: true,
          submittedAt: true,
          lastClientEventAt: true,
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

  return buildCourseEvidenceBackfillPlan({
    generatedAt: input.generatedAt,
    filters,
    manifestsByLessonKey: input.manifestsByLessonKey,
    studentStepResponses,
    studentStates,
    learningFacts,
  });
}

export async function applyCourseEvidenceBackfillPlan(
  db: CourseEvidenceBackfillApplyDb,
  plan: CourseEvidenceBackfillPlan,
): Promise<CourseEvidenceBackfillApplyResult> {
  let responseRowsUpdated = 0;
  let factRowsUpdated = 0;

  for (const action of plan.responseActions) {
    if ((action.action !== 'enrich' && action.action !== 'mark-unrecoverable') || !action.nextResponseData) {
      continue;
    }
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
    if (action.nextScore !== undefined) {
      data.score = action.nextScore;
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
    alreadyEnrichedRows: plan.totals.alreadyEnrichedRows,
    alreadyUnrecoverableRows: plan.totals.alreadyUnrecoverableRows,
  };
}

export async function regenerateCourseEvidenceReports(
  db: Parameters<typeof generateSessionSummaryReports>[0],
  sessionIds: string[],
  options: {
    generateReports?: typeof generateSessionSummaryReports;
  } = {},
): Promise<CourseEvidenceReportRegenerationResult> {
  const generateReports = options.generateReports ?? generateSessionSummaryReports;
  const uniqueSessionIds = uniqueSorted(sessionIds);
  let sessionsRegenerated = 0;
  let sessionsSkipped = 0;
  let classReports = 0;
  let studentReports = 0;

  for (const sessionId of uniqueSessionIds) {
    const result = await generateReports(db, sessionId);
    classReports += result.classReports;
    studentReports += result.studentReports;
    if (result.skipped) sessionsSkipped += 1;
    else sessionsRegenerated += 1;
  }

  return {
    sessionsRequested: uniqueSessionIds.length,
    sessionsRegenerated,
    sessionsSkipped,
    classReports,
    studentReports,
  };
}
