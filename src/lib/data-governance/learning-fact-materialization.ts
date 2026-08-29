import type { Prisma } from '@prisma/client';

import {
  selectLearningFactAuthority,
  writeKnowledgeScopedLearningFacts,
  type LearningFactWriteRow,
} from '@/lib/canonical-learning-fact-identity';
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
import { isMatchingResponseKind, isOrderingResponseKind } from '../interactive-response-contracts';
import { resolveLearningFactEvidenceGovernance } from './learning-fact-quality-weight';
import { resolveActiveKnowledgeRevision } from './knowledge-truth-revision';

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

const authorizedCompetencyContributionEvents = new WeakSet<LearningEvent>();

export function authorizeServerVerifiedCompetencyContribution(
  event: LearningEvent,
): LearningEvent {
  authorizedCompetencyContributionEvents.add(event);
  return event;
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

function readStringArray(value: unknown): string[] {
  return readArray(value)
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
  return isMatchingResponseKind(typeof value === 'string' ? value : undefined)
    || isOrderingResponseKind(typeof value === 'string' ? value : undefined);
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
      const explicitScore = readFiniteNumber(record.score);
      const unsupportedReason = readString(record.unsupportedReason);
      if (!cardId) return null;
      if (
        selectedValue === undefined
        && explicitCorrect === undefined
        && explicitScore === undefined
        && referenceAnswer === undefined
        && unsupportedReason === undefined
      ) {
        return null;
      }
      const ordered = isOrderedObjectiveResponseKind(record.responseKind);
      const scoringVersion = readString(record.scoringVersion);
      const scoringDetail = readRecord(record.scoringDetail) ?? readRecord(record.detail);
      return compactJsonObject({
        cardId,
        answered: selectedValue !== undefined,
        isCorrect: explicitCorrect ?? (
          referenceAnswer !== undefined
            ? selectedValue !== undefined && answersMatch(selectedValue, referenceAnswer, ordered)
            : undefined
        ),
        score: explicitScore,
        scoringVersion,
        normalizedSubmitted: record.normalizedSubmitted,
        normalizedReference: record.normalizedReference,
        detail: scoringDetail,
        unsupportedReason,
      });
    })
    .filter((item): item is Prisma.InputJsonObject => Boolean(item));

  if (cards.length === 0) return null;

  const answeredCount = cards.filter((card) => card.answered === true).length;
  const scoreableCards = cards.filter((card) => typeof card.score === 'number' || typeof card.isCorrect === 'boolean');
  const scoringVersion = cards
    .map((card) => readString(card.scoringVersion))
    .find((value): value is string => Boolean(value));
  if (scoreableCards.length === 0) {
    const unsupportedReasons = cards
      .map((card) => readString(card.unsupportedReason))
      .filter((value): value is string => Boolean(value));
    return {
      basis: 'questionSummaries',
      supported: false,
      cards,
      answeredCount,
      correctCount: 0,
      totalCount: 0,
      totalScore: 0,
      score: undefined,
      scoringVersion,
      unsupportedReason: unsupportedReasons[0],
    };
  }
  const correctCount = scoreableCards.filter((card) => card.isCorrect === true).length;
  const totalCount = scoreableCards.length;
  const totalScore = scoreableCards.reduce((sum, card) => (
    sum + (typeof card.score === 'number' ? card.score : card.isCorrect === true ? 1 : 0)
  ), 0);
  const score = Math.round((totalScore / totalCount) * 1000) / 10;

  return {
    basis: 'questionSummaries',
    supported: true,
    cards,
    answeredCount,
    correctCount,
    totalCount,
    totalScore,
    score,
    scoringVersion,
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
          supported: questionSummaryEvidence.supported,
          evidenceQuality,
          answeredCount: questionSummaryEvidence.answeredCount,
          correctCount: questionSummaryEvidence.correctCount,
          totalCount: questionSummaryEvidence.totalCount,
          totalScore: questionSummaryEvidence.totalScore,
          score: questionSummaryEvidence.score,
          scoringVersion: questionSummaryEvidence.scoringVersion,
          basis: questionSummaryEvidence.basis,
          reason: questionSummaryEvidence.unsupportedReason,
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

function buildKaqQuizEvidenceContext(payload: Record<string, unknown>): Prisma.InputJsonObject | undefined {
  const evidence = readRecord(payload.kaqQuizEvidence);
  if (!evidence) return undefined;
  const confidence = readRecord(evidence.confidence) ?? {};
  const retryPolicy = readRecord(evidence.retryPolicy) ?? {};
  const reviewAudit = readRecord(evidence.reviewAudit) ?? {};

  return compactJsonObject({
    questionSnapshotId: readString(evidence.questionSnapshotId),
    quizSetId: readString(evidence.quizSetId),
    questionId: readString(evidence.questionId),
    answerId: readString(evidence.answerId),
    sessionId: readString(evidence.sessionId),
    attemptKey: readString(evidence.attemptKey),
    scoringVersion: readString(evidence.scoringVersion),
    rubricVersion: readString(evidence.rubricVersion),
    denominator: readFiniteNumber(evidence.denominator),
    retryPolicy: compactJsonObject({
      maxAttemptsAffectingMastery: readFiniteNumber(retryPolicy.maxAttemptsAffectingMastery),
      idempotencyScope: readString(retryPolicy.idempotencyScope),
    }),
    eventSource: readString(evidence.eventSource),
    eventType: readString(evidence.eventType),
    clientEventId: readString(evidence.clientEventId),
    sourceLogId: readString(evidence.sourceLogId),
    dedupeKey: readString(evidence.dedupeKey),
    occurredAt: readString(evidence.occurredAt),
    score: readFiniteNumber(evidence.score),
    isCorrect: typeof evidence.isCorrect === 'boolean' ? evidence.isCorrect : undefined,
    confidence: compactJsonObject({
      level: readString(confidence.level),
      score: readFiniteNumber(confidence.score),
      basis: readString(confidence.basis),
    }),
    reviewState: readString(evidence.reviewState),
    reviewAudit: compactJsonObject({
      state: readString(reviewAudit.state),
      reviewerId: readString(reviewAudit.reviewerId),
      reviewerRole: readString(reviewAudit.reviewerRole),
      reviewedAt: readString(reviewAudit.reviewedAt),
      reviewBatchId: readString(reviewAudit.reviewBatchId),
      sourceHash: readString(reviewAudit.sourceHash),
      metadataVersionRef: readString(reviewAudit.metadataVersionRef),
      generationTool: readString(reviewAudit.generationTool),
      generationModel: readString(reviewAudit.generationModel),
      generationPromptVersion: readString(reviewAudit.generationPromptVersion),
      staleInvalidationRules: readStringArray(reviewAudit.staleInvalidationRules),
    }),
    learningGoalIds: readStringArray(evidence.learningGoalIds),
    kaqObjectiveIds: readStringArray(evidence.kaqObjectiveIds),
    knowledgeObjectiveIds: readStringArray(evidence.knowledgeObjectiveIds),
    applicationObjectiveIds: readStringArray(evidence.applicationObjectiveIds),
    qualityObjectiveIds: readStringArray(evidence.qualityObjectiveIds),
    knowledgeNodeIds: readStringArray(evidence.knowledgeNodeIds),
    graphNodeIds: readStringArray(evidence.graphNodeIds),
    capabilityTargetIds: readStringArray(evidence.capabilityTargetIds),
    qualityTargetIds: readStringArray(evidence.qualityTargetIds),
    misconceptionTags: readStringArray(evidence.misconceptionTags),
    learningFactEligible: typeof evidence.learningFactEligible === 'boolean' ? evidence.learningFactEligible : undefined,
    readinessGateEligible: typeof evidence.readinessGateEligible === 'boolean' ? evidence.readinessGateEligible : undefined,
    terminalValidationEligible: typeof evidence.terminalValidationEligible === 'boolean' ? evidence.terminalValidationEligible : undefined,
    studentCompetencySnapshotEffect: readString(evidence.studentCompetencySnapshotEffect),
    outcomeRefs: readStringArray(evidence.outcomeRefs),
    remediationResourceNodeIds: readStringArray(evidence.remediationResourceNodeIds),
    versionRefs: readJsonObject(evidence.versionRefs),
  });
}

function buildAdaptiveAssessmentRefContext(payload: Record<string, unknown>): Prisma.InputJsonObject | undefined {
  const ref = readRecord(payload.adaptiveAssessmentRef);
  if (!ref) return undefined;
  return compactJsonObject({
    kind: readString(ref.kind),
    provenance: readString(ref.provenance),
    id: readString(ref.id),
    answerId: readString(ref.answerId),
    sourceId: readString(ref.sourceId),
    questionId: readString(ref.questionId),
    questionRefId: readString(ref.questionRefId),
    catalogItemId: readString(ref.catalogItemId),
    contentHash: readString(ref.contentHash),
    score: readFiniteNumber(ref.score),
    isCorrect: typeof ref.isCorrect === 'boolean' ? ref.isCorrect : undefined,
    reviewState: readString(ref.reviewState),
    eligibilityState: readString(ref.eligibilityState),
    readinessGateEligible: typeof ref.readinessGateEligible === 'boolean' ? ref.readinessGateEligible : undefined,
    terminalValidationEligible: typeof ref.terminalValidationEligible === 'boolean' ? ref.terminalValidationEligible : undefined,
    pathCompletionEligible: typeof ref.pathCompletionEligible === 'boolean' ? ref.pathCompletionEligible : undefined,
    evidenceAuthority: readString(ref.evidenceAuthority),
    algorithmVersion: readString(ref.algorithmVersion),
    answeredAt: readString(ref.answeredAt),
  });
}

function buildAdaptiveAssessmentContext(
  actionType: string,
  payload: Record<string, unknown>,
): Prisma.InputJsonValue | undefined {
  if (actionType !== 'answer_submit' || payload.assessmentSource !== 'adaptive_assessment') {
    return undefined;
  }

  const questionId = readString(payload.questionId);
  const answerId = readString(payload.answerId);
  if (!questionId || !answerId) {
    return undefined;
  }

  return {
    adaptiveAssessment: compactJsonObject({
      answerId,
      questionId,
      questionRefId: readString(payload.questionRefId),
      selectedOptionKey: readString(payload.selectedOptionKey),
      correctOptionKey: readString(payload.correctOptionKey),
      knowledgeTags: readStringArray(payload.knowledgeTags),
      algorithmVersion: readString(payload.algorithmVersion),
      abilityEstimate: typeof payload.abilityEstimate === 'number' ? payload.abilityEstimate : undefined,
      derivedScore: typeof payload.score === 'number' ? payload.score : undefined,
      masteryPosterior: typeof payload.masteryPosterior === 'number' ? payload.masteryPosterior : undefined,
      masteryConfidence: typeof payload.masteryConfidence === 'number' ? payload.masteryConfidence : undefined,
      confidence: typeof payload.confidence === 'number' ? payload.confidence : undefined,
      adaptiveAssessmentRef: buildAdaptiveAssessmentRefContext(payload),
      kaqQuizEvidence: buildKaqQuizEvidenceContext(payload),
      privacyLevel: readString(payload.privacyLevel) ?? 'restricted',
    }),
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
  const evidenceGovernance = resolveLearningFactEvidenceGovernance(actionType, payload);
  const suppressCompetencyContribution = !authorizedCompetencyContributionEvents.has(event);
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
    competencyContribution: suppressCompetencyContribution
      ? {}
      : resolveCompetencyContribution(
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
  const adaptiveAssessmentContext = buildAdaptiveAssessmentContext(actionType, payload);
  const contextJson = compactJsonObject({
    ...(readRecord(arenaContext) ?? {}),
    ...(readRecord(adaptiveAssessmentContext) ?? {}),
    ...(interactiveQuizContext ? { interactiveQuiz: interactiveQuizContext.context } : {}),
    ...(evidenceGovernance ? { evidenceGovernance } : {}),
    goalId: readString(payload.goalId),
    adapter: readRecord(payload.adapter),
  });
  if (Object.keys(contextJson).length > 0) {
    fact.contextJson = contextJson;
  }
  return fact;
}

/** Production callers must go through `ingestLearningFact`; do not add a second writer. */
export async function persistCoreLearningFact(
  db: { learningFact: LearningFactCreateManyDelegate },
  event: LearningEvent,
): Promise<LearningFactPersistenceResult> {
  const actionType = resolveLearningFactActionType(event);
  const fact = eventToLearningFactInput(event);
  if (!fact) {
    return { created: 0, skipped: true, actionType };
  }

  // Knowledge-scoped formal writes resolve the active authority selector and
  // use the fixed-identity adapter. Pre-cutover selector is always LEGACY.
  const selector = selectLearningFactAuthority('FORMAL_PRODUCTION');
  const activeRevision = await resolveActiveKnowledgeRevision(db as never);
  const writeResult = await writeKnowledgeScopedLearningFacts(
    {
      learningFact: {
        createMany: async (args) => db.learningFact.createMany({
          data: args.data as Prisma.LearningFactCreateManyInput[],
          skipDuplicates: args.skipDuplicates,
        }),
      },
    },
    {
      rows: [fact as LearningFactWriteRow],
      knowledgeScoped: true,
    },
    {
      selector,
      knowledgeRevisionRef: activeRevision.id,
    },
  );

  return {
    created: writeResult.written,
    skipped: writeResult.skipped,
    actionType,
  };
}
