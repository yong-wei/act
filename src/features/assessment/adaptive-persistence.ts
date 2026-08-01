import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getRegisteredResourceMetadataByNodeId } from '@/lib/resource-registry-metadata';
import {
  authorizeServerVerifiedCompetencyContribution,
  persistCoreLearningFact,
} from '@/lib/data-governance/learning-fact-materialization';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import {
  buildKaqQuizQuestionMetadata,
  materializeKaqQuizOutcomeEvidence,
} from '@/features/adaptive-assessment/kaq-quiz-foundation';
import {
  findAdaptiveAssessmentCatalogSnapshot,
  type AdaptiveAssessmentCatalogSnapshot,
} from '@/features/adaptive-assessment/adaptive-assessment-catalog-selector';
import {
  evaluateAssessmentEvidenceSnapshotAuthority,
  evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority,
  isAssessmentSnapshotBeforeEnforcementEpoch,
  type AssessmentEvidenceCatalogSnapshot,
} from '@/features/adaptive-assessment/assessment-evidence-authority';
import { adaptiveAssessmentItemContentHash } from './adaptive-assessment-item-content-hash';

import {
  buildSubmitAnswerResult,
  createSubmitAnswerDetails,
  getAbilityReport,
  getAbilityReportFromAnswers,
  getDiagnostic,
  getDiagnosticFromAnswers,
  getAdaptiveQuestionSelectionById,
  selectNextQuestion,
  selectNextQuestionFromAnswers,
  submitAnswer,
  type AbilityReport,
  type AdaptiveAnswerRecord,
  type AdaptiveQuestionScope,
  type CompanionPracticeMetadata,
  type DiagnosticResult,
  type PublicQuestion,
  type SubmitAnswerParams,
  type SubmitAnswerResult,
  type SubmittedAnswerDetails,
} from './adaptive-engine';
import {
  ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
  ADAPTIVE_ASSESSMENT_BKT_PARAMETERS,
  rebuildMasteryUpdatesFromAnswers,
  type AdaptiveAssessmentBktParameters,
} from './adaptive-mastery';
import type { QuestionDomain, QuestionType } from './adaptive-question-bank';

type CreateManyResult = { count: number };

type PersistedAssessmentAnswerRow = {
  id: string;
  userId?: string;
  questionId: string;
  selectedOptionKey?: string;
  isCorrect: boolean;
  responseTimeSeconds?: number;
  createdAt?: Date;
  answeredAt: Date;
  session?: {
    id?: string;
    sessionKey?: string;
  };
  questionRef?: {
    difficulty?: number;
    questionType?: string;
    domains?: string[];
    knowledgeTags?: string[];
    metadata?: unknown;
  };
};

type PersistedAssessmentSessionRow = {
  id: string;
  selectedQuestionIds?: string[];
  metadata?: unknown;
};

type AdaptiveAssessmentPersistenceTx = {
  $executeRawUnsafe?<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  adaptiveAssessmentAlgorithmVersion: {
    upsert(args: Record<string, unknown>): Promise<{ version: string; parameters?: unknown }>;
  };
  adaptiveAssessmentSession: {
    upsert(args: Record<string, unknown>): Promise<PersistedAssessmentSessionRow>;
    updateMany(args: Record<string, unknown>): Promise<CreateManyResult>;
  };
  adaptiveAssessmentItemRef: {
    upsert(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  adaptiveAssessmentAnswer: {
    findUnique(args: Record<string, unknown>): Promise<{
      id: string;
      userId: string;
      questionId: string;
      selectedOptionKey: string;
      isCorrect: boolean;
      score: number;
      responseTimeSeconds: number;
      abilityEstimate: number;
      algorithmVersion: string;
      answeredAt: Date;
    } | null>;
    upsert(args: Record<string, unknown>): Promise<{
      id: string;
      userId: string;
      questionId: string;
      isCorrect: boolean;
      score: number;
      responseTimeSeconds: number;
      abilityEstimate: number;
      algorithmVersion: string;
      answeredAt: Date;
    }>;
    findMany(args: Record<string, unknown>): Promise<PersistedAssessmentAnswerRow[]>;
  };
  adaptiveAssessmentAbilityEstimate: {
    create(args: Record<string, unknown>): Promise<unknown>;
  };
  adaptiveMasteryUpdate: {
    createMany(args: Record<string, unknown>): Promise<CreateManyResult>;
  };
  learningFact: {
    createMany(args: {
      data: Prisma.LearningFactCreateManyInput[];
      skipDuplicates?: boolean;
    }): Promise<CreateManyResult>;
  };
};

type AdaptiveAssessmentPersistenceDb = AdaptiveAssessmentPersistenceTx & {
  $transaction?<T>(callback: (tx: AdaptiveAssessmentPersistenceTx) => Promise<T>): Promise<T>;
};

export interface DurableSubmitAnswerResult extends SubmitAnswerResult {
  durableSessionId?: string;
  durableAnswerId?: string;
  algorithmVersion?: string;
  adaptiveAssessmentRef?: AdaptiveAssessmentOutcomeRef;
}

export interface AdaptiveAssessmentOutcomeRef {
  kind: 'AdaptiveAssessmentAnswer';
  provenance: 'official';
  id: string;
  answerId: string;
  sourceId: string;
  questionId: string;
  questionRefId: string;
  catalogItemId?: string;
  contentHash?: string;
  score: number;
  isCorrect: boolean;
  reviewState: 'reviewed' | 'provisional' | 'legacy';
  eligibilityState: string;
  readinessGateEligible: boolean;
  terminalValidationEligible: boolean;
  pathCompletionEligible: boolean;
  evidenceAuthority: 'path-assessment' | 'low-stakes-practice-only' | 'legacy-compatible';
  algorithmVersion: string;
  answeredAt: string;
}

type AdaptiveAssessmentPersistenceEnv = Record<string, string | undefined>;

interface PersistedSubmission {
  durableSessionId: string;
  durableAnswerId: string;
  algorithmVersion: string;
  masteryUpdateCount: number;
  adaptiveAssessmentRef?: AdaptiveAssessmentOutcomeRef;
}

type PersistedAssessmentAnswerWithSession = PersistedAssessmentAnswerRow & {
  session?: {
    id?: string;
    sessionKey?: string;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function assertImmutableCompanionMetadata(existing: unknown, requested: CompanionPracticeMetadata | undefined) {
  const existingRecord = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? existing as Record<string, unknown>
    : {};
  if (!requested) {
    if (existingRecord.origin === 'konling-companion-practice') {
      throw new Error('Companion-practice metadata is required for this session.');
    }
    return;
  }
  if (Object.keys(existingRecord).length === 0) return;
  if (JSON.stringify(existingRecord) !== JSON.stringify(requested)) {
    throw new Error('Companion-practice session metadata is immutable.');
  }
}

function assertSelectedCompanionQuestion(
  session: PersistedAssessmentSessionRow,
  questionId: string,
  continuity: CompanionPracticeMetadata | undefined,
) {
  if (!continuity) return;
  const selectedQuestionIds = Array.isArray(session.selectedQuestionIds) ? session.selectedQuestionIds : [];
  if (selectedQuestionIds.length !== 1 || selectedQuestionIds[0] !== questionId) {
    throw new Error('Companion-practice answer does not match the selected question.');
  }
}

function questionSource(questionId: string): string {
  if (questionId.startsWith('checkpoint-authored-question:')) return 'checkpoint-authored-question';
  return questionId.startsWith('generated-q-') ? 'generated' : 'preset';
}

function questionMetadataContentHash(
  details: SubmittedAnswerDetails,
  catalogSnapshot: AdaptiveAssessmentCatalogSnapshot | null,
): string {
  const question = details.question;
  const kaqMetadata = buildKaqQuizQuestionMetadata(question);
  return adaptiveAssessmentItemContentHash({
    source: questionSource(question.id),
    questionType: question.type,
    domains: question.domains,
    knowledgeTags: question.knowledgeTags,
    difficulty: question.difficulty,
    optionCount: question.options.length,
    kaqImmutableContentHash: kaqMetadata.immutableContentHash,
    adaptiveAssessmentItemRef: buildAdaptiveAssessmentItemRefMetadata({
      kaqMetadata,
      catalogSnapshot,
      generatedMetadata: question.generatedMetadata,
    }),
    questionSnapshot: buildAdaptiveQuestionSnapshot(details, kaqMetadata, catalogSnapshot),
  });
}

function buildAdaptiveAssessmentItemRefMetadata(params: {
  kaqMetadata: ReturnType<typeof buildKaqQuizQuestionMetadata>;
  catalogSnapshot: AdaptiveAssessmentCatalogSnapshot | null;
  generatedMetadata: SubmittedAnswerDetails['question']['generatedMetadata'];
}) {
  if (params.catalogSnapshot) {
    return {
      catalogBacked: true,
      snapshotVersion: params.catalogSnapshot.versionRefs.adaptiveAssessmentSnapshotVersion ?? 'adaptive-assessment-item-ref.v1',
      catalogItemId: params.catalogSnapshot.catalogItemId,
      sourceFamily: params.catalogSnapshot.sourceFamily,
      sourceId: params.catalogSnapshot.sourceId,
      sourceAnchor: params.catalogSnapshot.sourceAnchor,
      sourceLineage: params.catalogSnapshot.sourceLineage,
      contentHash: params.catalogSnapshot.contentHash,
      contentHashAlgorithm: params.catalogSnapshot.contentHashAlgorithm,
      reviewState: params.catalogSnapshot.reviewState,
      eligibilityState: params.catalogSnapshot.eligibilityState,
      allowedStages: params.catalogSnapshot.allowedStages,
      questionRefs: params.catalogSnapshot.questionRefs,
      semanticRefs: params.catalogSnapshot.semanticRefs,
      limitations: params.catalogSnapshot.limitations,
      reviewDecision: params.catalogSnapshot.reviewDecision,
      versionRefs: params.catalogSnapshot.versionRefs,
      relationship: params.catalogSnapshot.relationship,
      catalogUpdatesRewriteHistoricalAnswers: false,
    };
  }

  return {
    catalogBacked: false,
    snapshotVersion: 'adaptive-assessment-item-ref.v1',
    catalogItemId: null,
    contentHash: null,
    reviewState: params.kaqMetadata.review.state,
    eligibilityState: params.generatedMetadata ? 'generated-provisional' : 'legacy-compatible',
    evidenceAuthority: params.generatedMetadata ? 'low-stakes-practice-only' : 'legacy-compatible',
    relationship: {
      relationship: 'answer-time-snapshot',
      immutable: true,
      mayReferenceCatalogItemId: false,
      mayReferenceContentHash: false,
      catalogUpdatesRewriteHistoricalAnswers: false,
    },
  };
}

function buildAdaptiveQuestionSnapshot(
  details: SubmittedAnswerDetails,
  kaqMetadata: ReturnType<typeof buildKaqQuizQuestionMetadata>,
  catalogSnapshot: AdaptiveAssessmentCatalogSnapshot | null,
) {
  const correctOption = details.question.options.find((option) => option.isCorrect);
  const remediationResources = catalogSnapshot?.reviewDecision.outcome === 'approved'
    ? catalogSnapshot.reviewDecision.remediationRefs.flatMap((id) => {
        const resource = getRegisteredResourceMetadataByNodeId(id);
        const href = resource?.launchTarget ?? resource?.renderTarget;
        return resource && href
          ? [{
              id,
              title: resource.label,
              href,
              governanceState: 'reviewed' as const,
            }]
          : [];
      })
    : [];
  return {
    version: 'adaptive-question-snapshot.v1' as const,
    prompt: details.question.stem,
    options: details.question.options.map((option, index) => ({
      key: String.fromCharCode(65 + index),
      label: option.label,
      text: option.text,
      explanation: option.explanation,
    })),
    correctOptionKey: details.correctOptionKey,
    explanation: correctOption?.explanation ?? details.result.explanation,
    knowledgeTags: [...details.question.knowledgeTags],
    misconceptionTags: [...kaqMetadata.misconceptionTags],
    remediationResources,
  };
}

function buildAdaptiveAssessmentOutcomeRef(params: {
  details: SubmittedAnswerDetails;
  answerId: string;
  questionRefId: string;
  score: number;
  answeredAt: Date;
  catalogSnapshot: AdaptiveAssessmentCatalogSnapshot | null;
  kaqQuizEvidence: ReturnType<typeof materializeKaqQuizOutcomeEvidence>;
}): AdaptiveAssessmentOutcomeRef {
  const catalogSnapshot = params.catalogSnapshot;
  const requestedStage = pathContextCatalogStage(params.details.pathContext);
  const authority = evaluateAssessmentEvidenceSnapshotAuthority(catalogSnapshot, {
    learningGoalId: params.details.pathContext?.goalId,
    requestedStage,
  });
  const reviewState = catalogSnapshot
    ? 'reviewed'
    : params.kaqQuizEvidence.learningFactEligible
      ? 'legacy'
      : 'provisional';
  const pathAssessmentEligible = requestedStage !== null &&
    catalogSnapshot !== null &&
    authority[requestedStage] &&
    catalogSnapshotMatchesPathContext(catalogSnapshot, params.details.pathContext);
  const readinessGateEligible = requestedStage === 'readiness' && pathAssessmentEligible &&
    params.kaqQuizEvidence.readinessGateEligible;
  const terminalValidationEligible = authority.terminalValidation &&
    params.kaqQuizEvidence.terminalValidationEligible;

  return {
    kind: 'AdaptiveAssessmentAnswer',
    provenance: 'official',
    id: params.answerId,
    answerId: params.answerId,
    sourceId: params.answerId,
    questionId: params.details.question.id,
    questionRefId: params.questionRefId,
    ...(catalogSnapshot ? {
      catalogItemId: catalogSnapshot.catalogItemId,
      contentHash: catalogSnapshot.contentHash,
    } : {}),
    score: params.score,
    isCorrect: params.details.record.isCorrect,
    reviewState,
    eligibilityState: catalogSnapshot?.eligibilityState ??
      (params.kaqQuizEvidence.learningFactEligible ? 'legacy-compatible' : 'generated-provisional'),
    readinessGateEligible,
    terminalValidationEligible,
    pathCompletionEligible: pathAssessmentEligible,
    evidenceAuthority: authority.mastery ? 'path-assessment' :
      params.kaqQuizEvidence.learningFactEligible ? 'legacy-compatible' : 'low-stakes-practice-only',
    algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
    answeredAt: params.answeredAt.toISOString(),
  };
}

function pathContextCatalogStage(
  pathContext: SubmittedAnswerDetails['pathContext'],
): 'readiness' | 'checkpoint' | 'remediation' | null {
  return pathContext?.questionScope === 'readiness' ||
    pathContext?.questionScope === 'checkpoint' ||
    pathContext?.questionScope === 'remediation'
    ? pathContext.questionScope
    : null;
}

function catalogSnapshotMatchesPathContext(
  snapshot: AdaptiveAssessmentCatalogSnapshot,
  pathContext: SubmittedAnswerDetails['pathContext'],
): boolean {
  if (!pathContext) return false;
  const goalId = typeof pathContext.goalId === 'string' && pathContext.goalId.trim().length > 0
    ? pathContext.goalId.trim()
    : null;
  if (!goalId) return false;
  if (goalId && !snapshot.semanticRefs.learningGoalIds.includes(goalId)) return false;
  const questionScope = pathContext.questionScope;
  if (
    questionScope === 'readiness' ||
    questionScope === 'checkpoint' ||
    questionScope === 'remediation'
  ) {
    return snapshot.allowedStages.includes(questionScope);
  }
  return false;
}

const QUESTION_TYPES = new Set<QuestionType>([
  'pole-to-behavior',
  'bode-to-stability',
  'design-tradeoff',
  'multi-criteria',
]);

const QUESTION_DOMAINS = new Set<QuestionDomain>([
  'time',
  'frequency',
  'complex',
  'physical',
]);

function toQuestionType(value: unknown): QuestionType | undefined {
  return typeof value === 'string' && QUESTION_TYPES.has(value as QuestionType)
    ? value as QuestionType
    : undefined;
}

function toQuestionDomains(value: unknown): QuestionDomain[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const domains = value.filter((entry): entry is QuestionDomain => (
    typeof entry === 'string' && QUESTION_DOMAINS.has(entry as QuestionDomain)
  ));
  return domains.length > 0 ? domains : undefined;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isMasteryEligiblePersistedAnswer(row: PersistedAssessmentAnswerRow): boolean {
  const metadata = toRecord(row.questionRef?.metadata);
  const kaqMetadata = toRecord(metadata.kaq);
  if (kaqMetadata.learningFactEligible === false) return false;
  const currentSnapshot = findAdaptiveAssessmentCatalogSnapshot(row.questionId);
  const isBeforeEnforcementEpoch = isAssessmentSnapshotBeforeEnforcementEpoch(
    row.createdAt,
    row.answeredAt,
  );
  if (!Object.hasOwn(metadata, 'adaptiveAssessmentItemRef')) {
    return isBeforeEnforcementEpoch &&
      evaluateAssessmentEvidenceSnapshotAuthority(currentSnapshot).mastery;
  }
  const snapshot = toRecord(metadata.adaptiveAssessmentItemRef);
  const persistedSnapshot = snapshot as unknown as AssessmentEvidenceCatalogSnapshot;
  return evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority(
    persistedSnapshot,
    currentSnapshot,
    {
      allowHistoricalIncompleteSnapshotRecovery: isBeforeEnforcementEpoch,
    },
  ).mastery;
}

function abilityConfidenceInterval(theta: number, answerCount: number): [number, number] {
  const width = clamp(1 / Math.sqrt(Math.max(answerCount, 1)), 0.18, 1.2);
  return [
    Number((theta - width).toFixed(2)),
    Number((theta + width).toFixed(2)),
  ];
}

function toAdaptiveAnswerRecords(rows: PersistedAssessmentAnswerRow[]): AdaptiveAnswerRecord[] {
  return rows.map((row) => {
    const questionType = toQuestionType(row.questionRef?.questionType);
    const domains = toQuestionDomains(row.questionRef?.domains);

    return {
      sessionId: row.session?.sessionKey ?? 'adaptive-assessment',
      userId: row.userId ?? 'unknown',
      id: row.id,
      questionId: row.questionId,
      isCorrect: row.isCorrect,
      timeSpent: Math.max(1, Math.round(row.responseTimeSeconds ?? 1)),
      selectedOption: row.selectedOptionKey ?? 'UNKNOWN',
      difficulty: typeof row.questionRef?.difficulty === 'number' ? row.questionRef.difficulty : 0.5,
      knowledgeTags: Array.isArray(row.questionRef?.knowledgeTags) ? row.questionRef.knowledgeTags : [],
      questionType,
      domains,
      createdAt: row.answeredAt.getTime(),
    };
  });
}

function toMasteryAnswers(rows: PersistedAssessmentAnswerRow[]) {
  return rows.map((row) => ({
    id: row.id,
    questionId: row.questionId,
    isCorrect: row.isCorrect,
    answeredAt: row.answeredAt,
    knowledgeTags: Array.isArray(row.questionRef?.knowledgeTags) ? row.questionRef.knowledgeTags : [],
  }));
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function readBktParameters(value: unknown): AdaptiveAssessmentBktParameters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ADAPTIVE_ASSESSMENT_BKT_PARAMETERS;
  }

  const record = value as Record<string, unknown>;
  const next = {
    initialMastery: record.initialMastery,
    learnProbability: record.learnProbability,
    slipProbability: record.slipProbability,
    guessProbability: record.guessProbability,
  };

  return Object.values(next).every((entry) => typeof entry === 'number' && Number.isFinite(entry))
    ? next as AdaptiveAssessmentBktParameters
    : ADAPTIVE_ASSESSMENT_BKT_PARAMETERS;
}

async function upsertAdaptiveAssessmentAlgorithmVersion(
  db: Pick<AdaptiveAssessmentPersistenceTx, 'adaptiveAssessmentAlgorithmVersion'>,
  releasedAt: Date,
) {
  return db.adaptiveAssessmentAlgorithmVersion.upsert({
    where: { version: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION },
    update: {},
    create: {
      version: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      family: 'bkt-compatible',
      parameters: ADAPTIVE_ASSESSMENT_BKT_PARAMETERS,
      status: 'active',
      releasedAt,
    },
  });
}

async function lockAdaptiveAssessmentUserWrites(
  db: Pick<AdaptiveAssessmentPersistenceTx, '$executeRawUnsafe'>,
  userId: string,
): Promise<void> {
  if (!db.$executeRawUnsafe) {
    return;
  }

  await db.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    `adaptive-assessment:${ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION}:${userId}`,
  );
}

function buildAssessmentLearningEvent(params: {
  details: SubmittedAnswerDetails;
  answerId: string;
  questionRefId: string;
  score: number;
  adaptiveAssessmentRef: AdaptiveAssessmentOutcomeRef;
  masteryPosterior?: number;
  masteryConfidence?: number;
}): LearningEvent {
  const occurredAt = new Date(params.details.record.createdAt).toISOString();
  const kaqQuizEvidence = materializeKaqQuizOutcomeEvidence({
    question: params.details.question,
    sessionId: params.details.record.sessionId,
    answerId: params.answerId,
    isCorrect: params.details.record.isCorrect,
    score: params.score,
    scoringVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
    occurredAt,
  });

  return {
    eventId: `adaptive-assessment:${params.answerId}`,
    occurredAt,
    userId: params.details.record.userId,
    role: 'student',
    courseId: 'adaptive-assessment',
    sessionId: params.details.record.sessionId,
    pagePath: '/assessment/adaptive-practice',
    pageType: 'quiz',
    moduleId: 'adaptive-assessment',
    actionType: 'answer_submit',
    targetType: 'question',
    targetId: params.details.question.id,
    payload: {
      eventType: 'answer_submit',
      assessmentSource: 'adaptive_assessment',
      moduleId: 'adaptive-assessment',
      sessionId: params.details.record.sessionId,
      answerId: params.answerId,
      questionId: params.details.question.id,
      questionRefId: params.questionRefId,
      adaptiveAssessmentRef: params.adaptiveAssessmentRef,
      questionSnapshotId: kaqQuizEvidence.questionSnapshotId,
      quizSetId: kaqQuizEvidence.quizSetId,
      attemptKey: kaqQuizEvidence.attemptKey,
      selectedOptionKey: params.details.selectedOptionKey,
      correctOptionKey: params.details.correctOptionKey,
      isCorrect: params.details.record.isCorrect,
      score: params.score,
      denominator: kaqQuizEvidence.denominator,
      retryPolicy: kaqQuizEvidence.retryPolicy,
      scoringVersion: kaqQuizEvidence.scoringVersion,
      rubricVersion: kaqQuizEvidence.rubricVersion,
      durationSeconds: params.details.record.timeSpent,
      knowledgeTags: params.details.question.knowledgeTags,
      abilityEstimate: params.details.result.estimatedAbility,
      masteryPosterior: params.masteryPosterior,
      masteryConfidence: params.masteryConfidence,
      confidence: params.masteryConfidence,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      eventSource: kaqQuizEvidence.eventSource,
      sourceLogId: kaqQuizEvidence.sourceLogId,
      dedupeKey: kaqQuizEvidence.dedupeKey,
      learningFactEligible: kaqQuizEvidence.learningFactEligible,
      readinessGateEligible: kaqQuizEvidence.readinessGateEligible,
      terminalValidationEligible: kaqQuizEvidence.terminalValidationEligible,
      studentCompetencySnapshotEffect: kaqQuizEvidence.studentCompetencySnapshotEffect,
      learningGoalIds: kaqQuizEvidence.learningGoalIds,
      kaqObjectiveIds: kaqQuizEvidence.kaqObjectiveIds,
      knowledgeObjectiveIds: kaqQuizEvidence.knowledgeObjectiveIds,
      applicationObjectiveIds: kaqQuizEvidence.applicationObjectiveIds,
      qualityObjectiveIds: kaqQuizEvidence.qualityObjectiveIds,
      graphNodeIds: kaqQuizEvidence.graphNodeIds,
      capabilityTargetIds: kaqQuizEvidence.capabilityTargetIds,
      qualityTargetIds: kaqQuizEvidence.qualityTargetIds,
      misconceptionTags: kaqQuizEvidence.misconceptionTags,
      remediationResourceNodeIds: kaqQuizEvidence.remediationResourceNodeIds,
      kaqQuizEvidence,
      ...(params.details.pathContext ? { pathExecution: params.details.pathContext } : {}),
      privacyLevel: 'restricted',
    },
    source: 'web',
    priority: 'core',
  };
}

async function findMatchingPathRetryAnswer(
  tx: AdaptiveAssessmentPersistenceTx,
  details: SubmittedAnswerDetails,
): Promise<PersistedAssessmentAnswerWithSession | null> {
  const retrySessionPrefix = `${details.record.sessionId}:retry-`;
  const retryAnswers = await tx.adaptiveAssessmentAnswer.findMany({
    where: {
      userId: details.record.userId,
      questionId: details.question.id,
      selectedOptionKey: details.selectedOptionKey,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      session: {
        sessionKey: {
          startsWith: retrySessionPrefix,
        },
      },
    },
    include: {
      session: {
        select: {
          id: true,
          sessionKey: true,
        },
      },
    },
    orderBy: [
      { answeredAt: 'desc' },
      { id: 'desc' },
    ],
  });

  return retryAnswers.find((answer) => answer.session?.id && answer.session.sessionKey) ?? null;
}

async function persistAdaptiveAssessmentSubmission(
  details: SubmittedAnswerDetails,
  db: AdaptiveAssessmentPersistenceDb,
): Promise<PersistedSubmission & { result: SubmitAnswerResult }> {
  const execute = async (tx: AdaptiveAssessmentPersistenceTx): Promise<PersistedSubmission & { result: SubmitAnswerResult }> => {
  const answeredAt = new Date(details.record.createdAt);
  const score = details.record.isCorrect ? 100 : 0;

  const algorithm = await upsertAdaptiveAssessmentAlgorithmVersion(tx, answeredAt);
  await lockAdaptiveAssessmentUserWrites(tx, details.record.userId);

  let session = await tx.adaptiveAssessmentSession.upsert({
    where: {
      userId_sessionKey: {
        userId: details.record.userId,
        sessionKey: details.record.sessionId,
      },
    },
    update: {
      lastAnsweredAt: answeredAt,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
    },
    create: {
      userId: details.record.userId,
      sessionKey: details.record.sessionId,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      startedAt: answeredAt,
      lastAnsweredAt: answeredAt,
      metadata: details.continuity ?? {},
    },
  });
  assertImmutableCompanionMetadata(session.metadata, details.continuity);
  assertSelectedCompanionQuestion(session, details.question.id, details.continuity);

  let effectiveDetails = details;
  if (details.pathContext) {
    const existingPathAnswer = await tx.adaptiveAssessmentAnswer.findUnique({
      where: {
        sessionId_questionId: {
          sessionId: session.id,
          questionId: details.question.id,
        },
      },
    });
    if (
      existingPathAnswer &&
      !existingPathAnswer.isCorrect &&
      existingPathAnswer.selectedOptionKey !== details.selectedOptionKey
    ) {
      const matchingRetryAnswer = await findMatchingPathRetryAnswer(tx, details);
      const retrySessionId = matchingRetryAnswer?.session?.sessionKey ??
        `${details.record.sessionId}:retry-${answeredAt.getTime()}`;
      session = await tx.adaptiveAssessmentSession.upsert({
        where: {
          userId_sessionKey: {
            userId: details.record.userId,
            sessionKey: retrySessionId,
          },
        },
        update: {
          lastAnsweredAt: answeredAt,
          algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
        },
        create: {
          userId: details.record.userId,
          sessionKey: retrySessionId,
          algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
          startedAt: answeredAt,
          lastAnsweredAt: answeredAt,
          metadata: details.continuity ?? {},
        },
      });
      assertImmutableCompanionMetadata(session.metadata, details.continuity);
      effectiveDetails = {
        ...details,
        record: {
          ...details.record,
          sessionId: retrySessionId,
        },
      };
    }
  }

  const catalogSnapshot = findAdaptiveAssessmentCatalogSnapshot(effectiveDetails.question.id);
  const kaqMetadata = buildKaqQuizQuestionMetadata(effectiveDetails.question);
  const contentHash = questionMetadataContentHash(effectiveDetails, catalogSnapshot);
  const itemRefMetadata = {
    kaq: kaqMetadata,
    adaptiveAssessmentItemRef: buildAdaptiveAssessmentItemRefMetadata({
      kaqMetadata,
      catalogSnapshot,
      generatedMetadata: effectiveDetails.question.generatedMetadata,
    }),
    questionSnapshot: buildAdaptiveQuestionSnapshot(effectiveDetails, kaqMetadata, catalogSnapshot),
    ...(effectiveDetails.question.generatedMetadata ? { generatedMetadata: effectiveDetails.question.generatedMetadata } : {}),
  };
  const questionRef = await tx.adaptiveAssessmentItemRef.upsert({
    where: {
      questionId_algorithmVersion_contentHash: {
        questionId: effectiveDetails.question.id,
        algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
        contentHash,
      },
    },
    update: {},
    create: {
      questionId: effectiveDetails.question.id,
      contentHash,
      source: questionSource(effectiveDetails.question.id),
      questionType: effectiveDetails.question.type,
      domains: effectiveDetails.question.domains,
      knowledgeTags: effectiveDetails.question.knowledgeTags,
      difficulty: effectiveDetails.question.difficulty,
      optionCount: effectiveDetails.question.options.length,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      metadata: itemRefMetadata,
    },
  });

  const persistedAnswersBefore = await tx.adaptiveAssessmentAnswer.findMany({
    where: {
      userId: details.record.userId,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
    },
    include: {
      session: {
        select: {
          sessionKey: true,
        },
      },
      questionRef: {
        select: {
          difficulty: true,
          questionType: true,
          domains: true,
          knowledgeTags: true,
          metadata: true,
        },
      },
    },
    orderBy: [
      { answeredAt: 'asc' },
      { id: 'asc' },
    ],
  });

  const existingAnswer = await tx.adaptiveAssessmentAnswer.findUnique({
    where: {
      sessionId_questionId: {
        sessionId: session.id,
        questionId: effectiveDetails.question.id,
      },
    },
  });
  const eligiblePersistedAnswersBefore = persistedAnswersBefore.filter(isMasteryEligiblePersistedAnswer);
  const persistedAnswerRecords = toAdaptiveAnswerRecords(eligiblePersistedAnswersBefore);
  const answerHistory = existingAnswer
    ? persistedAnswerRecords
    : [...persistedAnswerRecords, effectiveDetails.record];
  const result = buildSubmitAnswerResult(effectiveDetails, answerHistory);

  const answer = await tx.adaptiveAssessmentAnswer.upsert({
    where: {
      sessionId_questionId: {
        sessionId: session.id,
        questionId: effectiveDetails.question.id,
      },
    },
    update: {},
    create: {
      userId: effectiveDetails.record.userId,
      sessionId: session.id,
      questionRefId: questionRef.id,
      questionId: effectiveDetails.question.id,
      selectedOptionKey: effectiveDetails.selectedOptionKey,
      correctOptionKey: effectiveDetails.correctOptionKey,
      isCorrect: effectiveDetails.record.isCorrect,
      score,
      responseTimeSeconds: effectiveDetails.record.timeSpent,
      abilityEstimate: result.estimatedAbility,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      answeredAt,
    },
  });
  const createdAnswer = !existingAnswer && answer.answeredAt.getTime() === answeredAt.getTime();
  if (!createdAnswer) {
    const kaqQuizEvidence = materializeKaqQuizOutcomeEvidence({
      question: effectiveDetails.question,
      sessionId: effectiveDetails.record.sessionId,
      answerId: answer.id,
      isCorrect: effectiveDetails.record.isCorrect,
      score,
      scoringVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      occurredAt: answeredAt.toISOString(),
    });
    return {
      durableSessionId: session.id,
      durableAnswerId: answer.id,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      masteryUpdateCount: 0,
      result,
      adaptiveAssessmentRef: buildAdaptiveAssessmentOutcomeRef({
        details: effectiveDetails,
        answerId: answer.id,
        questionRefId: questionRef.id,
        score,
        answeredAt,
        catalogSnapshot,
        kaqQuizEvidence,
      }),
    };
  }
  const kaqQuizEvidence = materializeKaqQuizOutcomeEvidence({
    question: effectiveDetails.question,
    sessionId: effectiveDetails.record.sessionId,
    answerId: answer.id,
    isCorrect: effectiveDetails.record.isCorrect,
    score,
    scoringVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
    occurredAt: answeredAt.toISOString(),
  });
  const evidenceAuthority = evaluateAssessmentEvidenceSnapshotAuthority(catalogSnapshot, {
    learningGoalId: effectiveDetails.pathContext?.goalId,
    requestedStage: pathContextCatalogStage(effectiveDetails.pathContext),
  });
  if (!kaqQuizEvidence.learningFactEligible || !evidenceAuthority.mastery) {
    return {
      durableSessionId: session.id,
      durableAnswerId: answer.id,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      masteryUpdateCount: 0,
      result,
      adaptiveAssessmentRef: buildAdaptiveAssessmentOutcomeRef({
        details: effectiveDetails,
        answerId: answer.id,
        questionRefId: questionRef.id,
        score,
        answeredAt,
        catalogSnapshot,
        kaqQuizEvidence,
      }),
    };
  }

  const confidenceInterval = abilityConfidenceInterval(result.estimatedAbility, answerHistory.length);

  await tx.adaptiveAssessmentAbilityEstimate.create({
    data: {
      userId: effectiveDetails.record.userId,
      sessionId: session.id,
      answerId: answer.id,
      theta: result.estimatedAbility,
      confidenceLow: confidenceInterval[0],
      confidenceHigh: confidenceInterval[1],
      dimensions: {
        source: 'adaptive-assessment',
        answerCount: answerHistory.length,
        ...(effectiveDetails.pathContext ? {
          pathExecution: effectiveDetails.pathContext,
        } : {}),
      },
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      estimatedAt: answeredAt,
    },
  });

  const rebuiltUpdates = rebuildMasteryUpdatesFromAnswers([
    ...toMasteryAnswers(eligiblePersistedAnswersBefore),
    {
      id: answer.id,
      questionId: effectiveDetails.question.id,
      isCorrect: effectiveDetails.record.isCorrect,
      answeredAt,
      knowledgeTags: effectiveDetails.question.knowledgeTags,
    },
  ], {
    algorithmVersion: algorithm.version,
    parameters: readBktParameters(algorithm.parameters),
  });
  const currentUpdates = rebuiltUpdates.filter((update) => update.answerId === answer.id);
  const masteryResult = await tx.adaptiveMasteryUpdate.createMany({
    data: currentUpdates.map((update) => ({
      userId: effectiveDetails.record.userId,
      sessionId: session.id,
      answerId: answer.id,
      questionId: update.questionId,
      knowledgeTag: update.knowledgeTag,
      priorMastery: update.priorMastery,
      posteriorMastery: update.posteriorMastery,
      confidence: update.confidence,
      evidenceKind: update.evidenceKind,
      algorithmVersion: update.algorithmVersion,
      updateReason: 'adaptive_assessment_answer',
      prerequisiteState: update.prerequisiteEvidence,
    })),
    skipDuplicates: true,
  });

  const masteryPosterior = average(currentUpdates.map((update) => update.posteriorMastery));
  const masteryConfidence = average(currentUpdates.map((update) => update.confidence));
  const durableDetails = {
    ...effectiveDetails,
    result,
  };
  const adaptiveAssessmentRef = buildAdaptiveAssessmentOutcomeRef({
    details: durableDetails,
    answerId: answer.id,
    questionRefId: questionRef.id,
    score,
    answeredAt,
    catalogSnapshot,
    kaqQuizEvidence,
  });

  const learningEvent = authorizeServerVerifiedCompetencyContribution(
    buildAssessmentLearningEvent({
      details: durableDetails,
      answerId: answer.id,
      questionRefId: questionRef.id,
      score,
      adaptiveAssessmentRef,
      masteryPosterior,
      masteryConfidence,
    }),
  );
  await persistCoreLearningFact(tx, learningEvent);

  return {
    durableSessionId: session.id,
    durableAnswerId: answer.id,
    algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
    masteryUpdateCount: masteryResult.count,
    result,
    adaptiveAssessmentRef,
  };
  };

  return db.$transaction ? db.$transaction(execute) : execute(db);
}

export async function submitAnswerDurably(
  params: SubmitAnswerParams,
  db: AdaptiveAssessmentPersistenceDb = prisma as unknown as AdaptiveAssessmentPersistenceDb,
): Promise<DurableSubmitAnswerResult> {
  const details = createSubmitAnswerDetails(params);
  const persisted = await persistAdaptiveAssessmentSubmission(details, db);

  return {
    ...persisted.result,
    durableSessionId: persisted.durableSessionId,
    durableAnswerId: persisted.durableAnswerId,
    algorithmVersion: persisted.algorithmVersion,
    adaptiveAssessmentRef: persisted.adaptiveAssessmentRef,
  };
}

export function isAdaptiveAssessmentPersistenceEnabled(
  env: AdaptiveAssessmentPersistenceEnv = process.env,
): boolean {
  return env.ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED !== 'false';
}

export async function submitAnswerWithPersistenceFallback(
  params: SubmitAnswerParams,
  db: AdaptiveAssessmentPersistenceDb = prisma as unknown as AdaptiveAssessmentPersistenceDb,
  env: AdaptiveAssessmentPersistenceEnv = process.env,
): Promise<DurableSubmitAnswerResult> {
  if (!isAdaptiveAssessmentPersistenceEnabled(env)) {
    if (params.continuity) {
      throw new Error('Companion practice requires adaptive-assessment persistence.');
    }
    return submitAnswer(params);
  }

  return submitAnswerDurably(params, db);
}

async function loadPersistedAnswerRecords(
  userId: string,
  db: AdaptiveAssessmentPersistenceDb,
): Promise<AdaptiveAnswerRecord[]> {
  const rows = await db.adaptiveAssessmentAnswer.findMany({
    where: {
      userId,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
    },
    include: {
      session: {
        select: {
          sessionKey: true,
        },
      },
      questionRef: {
        select: {
          difficulty: true,
          questionType: true,
          domains: true,
          knowledgeTags: true,
          metadata: true,
        },
      },
    },
    orderBy: [
      { answeredAt: 'asc' },
      { id: 'asc' },
    ],
  });

  return toAdaptiveAnswerRecords(rows);
}

async function loadPersistedSessionSelection(
  params: { userId: string; sessionId: string; continuity?: CompanionPracticeMetadata },
  db: AdaptiveAssessmentPersistenceDb,
): Promise<PersistedAssessmentSessionRow> {
  const now = new Date();
  await upsertAdaptiveAssessmentAlgorithmVersion(db, now);

  const session = await db.adaptiveAssessmentSession.upsert({
    where: {
      userId_sessionKey: {
        userId: params.userId,
        sessionKey: params.sessionId,
      },
    },
    update: {
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
    },
    create: {
      userId: params.userId,
      sessionKey: params.sessionId,
      selectedQuestionIds: [],
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      startedAt: now,
      metadata: params.continuity ?? {},
    },
    select: {
      id: true,
      selectedQuestionIds: true,
      metadata: true,
    },
  });
  assertImmutableCompanionMetadata(session.metadata, params.continuity);

  return {
    id: session.id,
    selectedQuestionIds: Array.isArray(session.selectedQuestionIds) ? session.selectedQuestionIds : [],
  };
}

async function recordPersistedQuestionSelection(
  session: PersistedAssessmentSessionRow,
  previousQuestionIds: string[],
  questionIds: Iterable<string>,
  db: AdaptiveAssessmentPersistenceDb,
): Promise<boolean> {
  const result = await db.adaptiveAssessmentSession.updateMany({
    where: {
      id: session.id,
      selectedQuestionIds: {
        equals: previousQuestionIds,
      },
    },
    data: {
      selectedQuestionIds: Array.from(new Set(questionIds)),
    },
  });

  return result.count === 1;
}

export async function getAbilityReportWithPersistenceFallback(
  userId: string,
  db: AdaptiveAssessmentPersistenceDb = prisma as unknown as AdaptiveAssessmentPersistenceDb,
  env: AdaptiveAssessmentPersistenceEnv = process.env,
): Promise<AbilityReport> {
  if (!isAdaptiveAssessmentPersistenceEnabled(env)) {
    return getAbilityReport(userId);
  }

  return getAbilityReportFromAnswers(userId, await loadPersistedAnswerRecords(userId, db));
}

export async function getDiagnosticWithPersistenceFallback(
  userId: string,
  db: AdaptiveAssessmentPersistenceDb = prisma as unknown as AdaptiveAssessmentPersistenceDb,
  env: AdaptiveAssessmentPersistenceEnv = process.env,
): Promise<DiagnosticResult> {
  if (!isAdaptiveAssessmentPersistenceEnabled(env)) {
    return getDiagnostic(userId);
  }

  return getDiagnosticFromAnswers(await loadPersistedAnswerRecords(userId, db));
}

export async function selectNextQuestionWithPersistenceFallback(
  params: { userId: string; sessionId: string; goalId?: string | null; questionScope?: AdaptiveQuestionScope; continuity?: CompanionPracticeMetadata },
  db: AdaptiveAssessmentPersistenceDb = prisma as unknown as AdaptiveAssessmentPersistenceDb,
  env: AdaptiveAssessmentPersistenceEnv = process.env,
): Promise<{
  question: PublicQuestion;
  estimatedAbility: number;
  confidenceInterval: [number, number];
}> {
  if (!isAdaptiveAssessmentPersistenceEnabled(env)) {
    if (params.continuity) {
      throw new Error('Companion practice requires adaptive-assessment persistence.');
    }
    return selectNextQuestion(params);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const answers = await loadPersistedAnswerRecords(params.userId, db);
    const session = await loadPersistedSessionSelection(params, db);
    const persistedQuestionIds = session.selectedQuestionIds ?? [];
    if (params.continuity && persistedQuestionIds.length > 0) {
      return getAdaptiveQuestionSelectionById({
        userId: params.userId,
        sessionId: params.sessionId,
        questionId: persistedQuestionIds[0],
      }, answers);
    }
    const askedQuestionIds = new Set([
      ...persistedQuestionIds,
      ...answers
        .filter((answer) => answer.sessionId === params.sessionId)
        .map((answer) => answer.questionId),
    ]);
    const result = selectNextQuestionFromAnswers(params, answers, askedQuestionIds);
    const persisted = await recordPersistedQuestionSelection(
      session,
      persistedQuestionIds,
      [...Array.from(askedQuestionIds), result.question.id],
      db,
    );

    if (persisted) {
      return result;
    }
  }

  throw new Error('题目选择状态发生并发更新，请重试获取下一题');
}
