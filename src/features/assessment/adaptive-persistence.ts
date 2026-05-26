import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { persistCoreLearningFact } from '@/lib/data-governance/learning-fact-materialization';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';

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
    knowledgeTags?: string[];
  };
};

type AdaptiveAssessmentPersistenceTx = {
  adaptiveAssessmentAlgorithmVersion: {
    upsert(args: Record<string, unknown>): Promise<{ version: string; parameters?: unknown }>;
  };
  adaptiveAssessmentSession: {
    upsert(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  adaptiveAssessmentItemRef: {
    upsert(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  adaptiveAssessmentAnswer: {
    create(args: Record<string, unknown>): Promise<{
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

function abilityConfidenceInterval(theta: number, answerCount: number): [number, number] {
  const width = clamp(1 / Math.sqrt(Math.max(answerCount, 1)), 0.18, 1.2);
  return [
    Number((theta - width).toFixed(2)),
    Number((theta + width).toFixed(2)),
  ];
}

function toAdaptiveAnswerRecords(rows: PersistedAssessmentAnswerRow[]): AdaptiveAnswerRecord[] {
  return rows.map((row) => ({
    sessionId: row.session?.sessionKey ?? 'adaptive-assessment',
    userId: row.userId ?? 'unknown',
    id: row.id,
    questionId: row.questionId,
    isCorrect: row.isCorrect,
    timeSpent: Math.max(1, Math.round(row.responseTimeSeconds ?? 1)),
    selectedOption: row.selectedOptionKey ?? 'UNKNOWN',
    difficulty: typeof row.questionRef?.difficulty === 'number' ? row.questionRef.difficulty : 0.5,
    knowledgeTags: Array.isArray(row.questionRef?.knowledgeTags) ? row.questionRef.knowledgeTags : [],
    createdAt: row.answeredAt.getTime(),
  }));
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

function buildAssessmentLearningEvent(params: {
  details: SubmittedAnswerDetails;
  answerId: string;
  questionRefId: string;
  score: number;
  masteryPosterior?: number;
  masteryConfidence?: number;
}): LearningEvent {
  const occurredAt = new Date(params.details.record.createdAt).toISOString();

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
      selectedOptionKey: params.details.selectedOptionKey,
      correctOptionKey: params.details.correctOptionKey,
      isCorrect: params.details.record.isCorrect,
      score: params.score,
      durationSeconds: params.details.record.timeSpent,
      knowledgeTags: params.details.question.knowledgeTags,
      abilityEstimate: params.details.result.estimatedAbility,
      masteryPosterior: params.masteryPosterior,
      masteryConfidence: params.masteryConfidence,
      confidence: params.masteryConfidence,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
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

  const algorithm = await tx.adaptiveAssessmentAlgorithmVersion.upsert({
    where: { version: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION },
    update: {},
    create: {
      version: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      family: 'bkt-compatible',
      parameters: ADAPTIVE_ASSESSMENT_BKT_PARAMETERS,
      status: 'active',
      releasedAt: answeredAt,
    },
  });

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

  const questionRef = await tx.adaptiveAssessmentItemRef.upsert({
    where: {
      questionId_algorithmVersion: {
        questionId: details.question.id,
        algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      },
    },
    update: {
      questionType: details.question.type,
      domains: details.question.domains,
      knowledgeTags: details.question.knowledgeTags,
      difficulty: details.question.difficulty,
      optionCount: details.question.options.length,
    },
    create: {
      questionId: details.question.id,
      source: questionSource(details.question.id),
      questionType: details.question.type,
      domains: details.question.domains,
      knowledgeTags: details.question.knowledgeTags,
      difficulty: details.question.difficulty,
      optionCount: details.question.options.length,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      metadata: details.question.generatedMetadata
        ? { generatedMetadata: details.question.generatedMetadata }
        : {},
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
          knowledgeTags: true,
        },
      },
    },
    orderBy: [
      { answeredAt: 'asc' },
      { id: 'asc' },
    ],
  });
  const answerHistory = [
    ...toAdaptiveAnswerRecords(persistedAnswersBefore),
    details.record,
  ];
  const result = buildSubmitAnswerResult(details, answerHistory);

  const answer = await tx.adaptiveAssessmentAnswer.create({
    data: {
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
      },
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      estimatedAt: answeredAt,
    },
  });

  const rebuiltUpdates = rebuildMasteryUpdatesFromAnswers([
    ...toMasteryAnswers(persistedAnswersBefore),
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
          knowledgeTags: true,
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
  params: { userId: string; sessionId: string },
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

  const answers = await loadPersistedAnswerRecords(params.userId, db);
  return selectNextQuestionFromAnswers(params, answers);
}
