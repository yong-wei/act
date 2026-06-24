import { createHash } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { persistCoreLearningFact } from '@/lib/data-governance/learning-fact-materialization';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import {
  buildKaqQuizQuestionMetadata,
  materializeKaqQuizOutcomeEvidence,
} from '@/features/adaptive-assessment/kaq-quiz-foundation';

import {
  buildSubmitAnswerResult,
  createSubmitAnswerDetails,
  getAbilityReport,
  getAbilityReportFromAnswers,
  getDiagnostic,
  getDiagnosticFromAnswers,
  selectNextQuestion,
  selectNextQuestionFromAnswers,
  submitAnswer,
  type AbilityReport,
  type AdaptiveAnswerRecord,
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
  answeredAt: Date;
  session?: {
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
}

type AdaptiveAssessmentPersistenceEnv = Record<string, string | undefined>;

interface PersistedSubmission {
  durableSessionId: string;
  durableAnswerId: string;
  algorithmVersion: string;
  masteryUpdateCount: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function questionSource(questionId: string): string {
  return questionId.startsWith('generated-q-') ? 'generated' : 'preset';
}

function questionMetadataContentHash(question: SubmittedAnswerDetails['question']): string {
  const snapshot = {
    source: questionSource(question.id),
    questionType: question.type,
    domains: [...question.domains].sort(),
    knowledgeTags: [...question.knowledgeTags].sort(),
    difficulty: Number(question.difficulty.toFixed(6)),
    optionCount: question.options.length,
    kaq: buildKaqQuizQuestionMetadata(question).immutableContentHash,
  };

  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
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
  const kaqMetadata = toRecord(toRecord(row.questionRef?.metadata).kaq);
  const review = toRecord(kaqMetadata.review);
  if (kaqMetadata.learningFactEligible === false) return false;
  return review.state === 'reviewed';
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

async function persistAdaptiveAssessmentSubmission(
  details: SubmittedAnswerDetails,
  db: AdaptiveAssessmentPersistenceDb,
): Promise<PersistedSubmission & { result: SubmitAnswerResult }> {
  const execute = async (tx: AdaptiveAssessmentPersistenceTx): Promise<PersistedSubmission & { result: SubmitAnswerResult }> => {
  const answeredAt = new Date(details.record.createdAt);
  const score = details.record.isCorrect ? 100 : 0;

  const algorithm = await upsertAdaptiveAssessmentAlgorithmVersion(tx, answeredAt);
  await lockAdaptiveAssessmentUserWrites(tx, details.record.userId);

  const session = await tx.adaptiveAssessmentSession.upsert({
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
    },
  });

  const contentHash = questionMetadataContentHash(details.question);
  const kaqMetadata = buildKaqQuizQuestionMetadata(details.question);
  const questionRef = await tx.adaptiveAssessmentItemRef.upsert({
    where: {
      questionId_algorithmVersion_contentHash: {
        questionId: details.question.id,
        algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
        contentHash,
      },
    },
    update: {},
    create: {
      questionId: details.question.id,
      contentHash,
      source: questionSource(details.question.id),
      questionType: details.question.type,
      domains: details.question.domains,
      knowledgeTags: details.question.knowledgeTags,
      difficulty: details.question.difficulty,
      optionCount: details.question.options.length,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      metadata: {
        kaq: kaqMetadata,
        ...(details.question.generatedMetadata ? { generatedMetadata: details.question.generatedMetadata } : {}),
      },
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
        questionId: details.question.id,
      },
    },
  });
  const eligiblePersistedAnswersBefore = persistedAnswersBefore.filter(isMasteryEligiblePersistedAnswer);
  const persistedAnswerRecords = toAdaptiveAnswerRecords(eligiblePersistedAnswersBefore);
  const answerHistory = existingAnswer
    ? persistedAnswerRecords
    : [...persistedAnswerRecords, details.record];
  const result = buildSubmitAnswerResult(details, answerHistory);

  const answer = await tx.adaptiveAssessmentAnswer.upsert({
    where: {
      sessionId_questionId: {
        sessionId: session.id,
        questionId: details.question.id,
      },
    },
    update: {},
    create: {
      userId: details.record.userId,
      sessionId: session.id,
      questionRefId: questionRef.id,
      questionId: details.question.id,
      selectedOptionKey: details.selectedOptionKey,
      correctOptionKey: details.correctOptionKey,
      isCorrect: details.record.isCorrect,
      score,
      responseTimeSeconds: details.record.timeSpent,
      abilityEstimate: result.estimatedAbility,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      answeredAt,
    },
  });
  const createdAnswer = !existingAnswer && answer.answeredAt.getTime() === answeredAt.getTime();
  if (!createdAnswer) {
    return {
      durableSessionId: session.id,
      durableAnswerId: answer.id,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      masteryUpdateCount: 0,
      result,
    };
  }
  const kaqQuizEvidence = materializeKaqQuizOutcomeEvidence({
    question: details.question,
    sessionId: details.record.sessionId,
    answerId: answer.id,
    isCorrect: details.record.isCorrect,
    score,
    scoringVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
    occurredAt: answeredAt.toISOString(),
  });
  if (!kaqQuizEvidence.learningFactEligible) {
    return {
      durableSessionId: session.id,
      durableAnswerId: answer.id,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      masteryUpdateCount: 0,
      result,
    };
  }

  const confidenceInterval = abilityConfidenceInterval(result.estimatedAbility, answerHistory.length);

  await tx.adaptiveAssessmentAbilityEstimate.create({
    data: {
      userId: details.record.userId,
      sessionId: session.id,
      answerId: answer.id,
      theta: result.estimatedAbility,
      confidenceLow: confidenceInterval[0],
      confidenceHigh: confidenceInterval[1],
      dimensions: {
        source: 'adaptive-assessment',
        answerCount: answerHistory.length,
        ...(details.pathContext ? {
          pathExecution: details.pathContext,
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
      questionId: details.question.id,
      isCorrect: details.record.isCorrect,
      answeredAt,
      knowledgeTags: details.question.knowledgeTags,
    },
  ], {
    algorithmVersion: algorithm.version,
    parameters: readBktParameters(algorithm.parameters),
  });
  const currentUpdates = rebuiltUpdates.filter((update) => update.answerId === answer.id);
  const masteryResult = await tx.adaptiveMasteryUpdate.createMany({
    data: currentUpdates.map((update) => ({
      userId: details.record.userId,
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
    ...details,
    result,
  };

  await persistCoreLearningFact(
    tx,
    buildAssessmentLearningEvent({
      details: durableDetails,
      answerId: answer.id,
      questionRefId: questionRef.id,
      score,
      masteryPosterior,
      masteryConfidence,
    }),
  );

  return {
    durableSessionId: session.id,
    durableAnswerId: answer.id,
    algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
    masteryUpdateCount: masteryResult.count,
    result,
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
  params: { userId: string; sessionId: string },
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
    },
    select: {
      id: true,
      selectedQuestionIds: true,
    },
  });

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
  params: { userId: string; sessionId: string; goalId?: string | null },
  db: AdaptiveAssessmentPersistenceDb = prisma as unknown as AdaptiveAssessmentPersistenceDb,
  env: AdaptiveAssessmentPersistenceEnv = process.env,
): Promise<{
  question: PublicQuestion;
  estimatedAbility: number;
  confidenceInterval: [number, number];
}> {
  if (!isAdaptiveAssessmentPersistenceEnabled(env)) {
    return selectNextQuestion(params);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const answers = await loadPersistedAnswerRecords(params.userId, db);
    const session = await loadPersistedSessionSelection(params, db);
    const persistedQuestionIds = session.selectedQuestionIds ?? [];
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
