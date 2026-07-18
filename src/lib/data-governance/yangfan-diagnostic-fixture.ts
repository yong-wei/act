import { createHash } from 'node:crypto';
import { ADAPTIVE_LEARNING_GOAL_DEFINITIONS } from '../adaptive-learning-path-planner';
import type { CompetencyVector } from './competency-model';
import {
  refreshStudentEvidenceFeatureCache,
  type StudentEvidenceFeatureCacheDb,
  type StudentEvidenceFeatureRefreshOptions,
} from './student-evidence-feature-cache';

export const YANGFAN_DIAGNOSTIC_FIXTURE_VERSION = 'yangfan-diagnostic-fixture.v1';
export const YANGFAN_DIAGNOSTIC_FIXTURE_STUDENT_NUMBER = '20230010102605';
export const YANGFAN_DIAGNOSTIC_FIXTURE_EMAIL = 'yangfan@example.test';
export const YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX = 'yangfan-diagnostic-fixture';

export type YangFanDiagnosticFixtureMode = 'dry-run' | 'apply' | 'reset' | 'audit';

export interface YangFanReadinessSummaryInput {
  status?: unknown;
  findings?: unknown;
  resourceCoverage?: unknown;
}

export interface YangFanDiagnosticFixtureOptions extends StudentEvidenceFeatureRefreshOptions {
  mode?: YangFanDiagnosticFixtureMode;
  apply?: boolean;
  confirmApply?: boolean;
  canonicalEmail?: string | null;
  canonicalStudentNumber?: string | null;
  databaseUrl?: string | null;
  nodeEnv?: string | null;
  fixtureDbAllowlist?: string | null;
  readinessSummary?: YangFanReadinessSummaryInput | null;
  allowFixtureReadinessBlockers?: boolean;
  replaceCanonicalProfileSummary?: boolean;
  now?: Date;
}

export interface YangFanDiagnosticFixtureAccount {
  maskedUserId: string;
  nameHash: string | null;
  emailHash: string | null;
  studentNumberHash: string | null;
  hasEmail: boolean;
}

export interface YangFanDiagnosticFixturePlan {
  mode: YangFanDiagnosticFixtureMode;
  generatedAt: string;
  canApply: boolean;
  blockers: string[];
  warnings: string[];
  privacy: {
    mode: 'minimized';
    rawIdentifiersIncluded: false;
    rawPayloadsIncluded: false;
    identifierHash: 'sha256:12';
  };
  canonical: YangFanDiagnosticFixtureAccount | null;
  duplicates: YangFanDiagnosticFixtureAccount[];
  duplicateDisposition: 'none' | 'blocked-unsafe';
  plannedCounts: Record<string, number>;
  safety: {
    dryRunDefault: boolean;
    applyConfirmed: boolean;
    productionProtected: boolean;
    databaseAllowed: boolean;
  };
  arenaBoundary: {
    officialArenaWrites: 0;
    fixtureArenaEvidenceScope: 'auxiliary-learning-context';
  };
}

type QueryResult = { count?: number } | number | null | undefined;

export interface YangFanDiagnosticFixtureDb {
  user: {
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, any>>>;
    deleteMany?(args: Record<string, unknown>): Promise<QueryResult>;
  };
  userAnswer?: {
    findMany(args?: Record<string, unknown>): Promise<Array<Record<string, any>>>;
  };
  knowledgeNode?: {
    findMany(args?: Record<string, unknown>): Promise<Array<Record<string, any>>>;
  };
  learningFact: {
    findMany(args?: Record<string, unknown>): Promise<Array<Record<string, any>>>;
    createMany(args: Record<string, unknown>): Promise<QueryResult>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
  };
  knowledgeProgress?: {
    createMany(args: Record<string, unknown>): Promise<QueryResult>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany?: (args?: Record<string, unknown>) => Promise<Array<Record<string, any>>>;
  };
  learningPath?: {
    upsert(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany?: (args?: Record<string, unknown>) => Promise<Array<Record<string, any>>>;
  };
  learningPathExecution?: {
    createMany(args: Record<string, unknown>): Promise<QueryResult>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany(args?: Record<string, unknown>): Promise<Array<Record<string, any>>>;
  };
  learningPathDeviation?: {
    createMany(args: Record<string, unknown>): Promise<QueryResult>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany(args?: Record<string, unknown>): Promise<Array<Record<string, any>>>;
  };
  learningPathIntervention?: {
    createMany(args: Record<string, unknown>): Promise<QueryResult>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany(args?: Record<string, unknown>): Promise<Array<Record<string, any>>>;
  };
  studentCompetencySnapshot?: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany?: (args?: Record<string, unknown>) => Promise<Array<Record<string, any>>>;
    findFirst(args?: Record<string, unknown>): Promise<Record<string, any> | null>;
  };
  studentProfileSummary?: {
    upsert(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany?: (args?: Record<string, unknown>) => Promise<Array<Record<string, any>>>;
    findUnique(args?: Record<string, unknown>): Promise<Record<string, any> | null>;
  };
  studentEvidenceFeatureCache: {
    upsert(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany?: (args?: Record<string, unknown>) => Promise<Array<Record<string, any>>>;
    findUnique?: (args?: Record<string, unknown>) => Promise<Record<string, any> | null>;
    count?: (args?: Record<string, unknown>) => Promise<number>;
  };
  adaptiveAssessmentAlgorithmVersion?: {
    upsert(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  adaptiveAssessmentSession?: {
    upsert(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany?: (args?: Record<string, unknown>) => Promise<Array<Record<string, any>>>;
  };
  adaptiveAssessmentItemRef?: {
    upsert(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  adaptiveAssessmentAnswer?: {
    upsert(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany?: (args?: Record<string, unknown>) => Promise<Array<Record<string, any>>>;
  };
  adaptiveAssessmentAbilityEstimate?: {
    upsert(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany?: (args?: Record<string, unknown>) => Promise<Array<Record<string, any>>>;
  };
  adaptiveMasteryUpdate?: {
    createMany(args: Record<string, unknown>): Promise<QueryResult>;
    deleteMany(args: Record<string, unknown>): Promise<QueryResult>;
    findMany?: (args?: Record<string, unknown>) => Promise<Array<Record<string, any>>>;
  };
  $transaction?<T>(fn: (tx: YangFanDiagnosticFixtureDb) => Promise<T>): Promise<T>;
}

export interface YangFanDiagnosticFixtureApplyResult {
  mode: 'apply' | 'reset';
  generatedAt: string;
  canonicalMaskedUserId: string | null;
  affected: Record<string, number>;
  warnings: string[];
  privacy: YangFanDiagnosticFixturePlan['privacy'];
  arenaBoundary: YangFanDiagnosticFixturePlan['arenaBoundary'];
}

const FIXTURE_FACT_IDS = [
  'yangfan-fixture-fact-assessment',
  'yangfan-fixture-fact-path',
  'yangfan-fixture-fact-konling',
  'yangfan-fixture-fact-arena-preview',
] as const;
const FIXTURE_PATH_ID = 'yangfan-fixture-control-correction-path';
const FIXTURE_ARENA_TASK_ID = 'task-second-order-lead-pid';
const FIXTURE_ARENA_NODE_ID = `arena-task:${FIXTURE_ARENA_TASK_ID}`;
const FIXTURE_ARENA_TARGET = `/arena/challenges/${FIXTURE_ARENA_TASK_ID}`;
const FIXTURE_ALGORITHM_VERSION = 'yangfan-diagnostic-fixture-algorithm-v1';
const FIXTURE_SESSION_ID = 'yangfan-diagnostic-fixture-session';
const FIXTURE_SESSION_KEY = 'yangfan-diagnostic-fixture-session';
const FIXTURE_ITEM_REF_ID = 'yangfan-diagnostic-fixture-item-ref';
const FIXTURE_ANSWER_ID = 'yangfan-diagnostic-fixture-answer';
const FIXTURE_ABILITY_ESTIMATE_ID = 'yangfan-diagnostic-fixture-ability-estimate';
const FIXTURE_MASTERY_UPDATE_ID = 'yangfan-diagnostic-fixture-mastery-update';
const FIXTURE_KNOWLEDGE_PROGRESS_ID_PREFIX = `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:knowledge-progress:`;
const FIXTURE_QUESTION_ID = 'yangfan-diagnostic-fixture-question';
const FIXTURE_CONTENT_HASH = 'sha256:yangfan-diagnostic-fixture-question';
const FIXTURE_KNOWLEDGE_NODE_IDS = [
  '性能指标_1_1',
  '根轨迹_1_1',
  '传统设计四联图校正_4_47004',
] as const;

export const YANGFAN_DIAGNOSTIC_FIXTURE_GOVERNED_RESOURCE_IDS = [
  'yangfan-diagnostic-fixture:knowledge-progress:2e6a2cf5d76b',
  'yangfan-diagnostic-fixture:knowledge-progress:ff8ef10e4870',
  'yangfan-diagnostic-fixture:knowledge-progress:5c29bbb95ddf',
  FIXTURE_ALGORITHM_VERSION,
  FIXTURE_SESSION_ID,
  FIXTURE_QUESTION_ID,
  FIXTURE_ITEM_REF_ID,
  FIXTURE_ANSWER_ID,
  FIXTURE_ABILITY_ESTIMATE_ID,
  FIXTURE_MASTERY_UPDATE_ID,
  FIXTURE_PATH_ID,
  'yangfan-diagnostic-fixture:exec-start',
  'yangfan-diagnostic-fixture:exec-terminal',
  'yangfan-diagnostic-fixture:deviation-low-confidence',
  'yangfan-diagnostic-fixture:intervention-konling',
  'yangfan-diagnostic-fixture:snapshot',
  'yangfan-diagnostic-fixture:student-profile-summary',
  'yangfan-diagnostic-fixture:student-evidence-feature-cache',
  ...FIXTURE_FACT_IDS,
] as const;

export const YANGFAN_DIAGNOSTIC_FIXTURE_GOVERNANCE = {
  sourcePathOrUrl: 'src/lib/data-governance/yangfan-diagnostic-fixture.ts',
  sourceVersionRef: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION,
  reviewerId: 'codex:issue-884-yangfan-fixture-governance-review',
  reviewedAt: '2026-07-18T04:35:00.000Z',
  reviewBatchId: 'yangfan-diagnostic-fixture-governance-884.v1',
  independentEvidenceRef: 'src/lib/data-governance/yangfan-diagnostic-fixture.ts#applyYangFanDiagnosticFixture',
  evidenceContract: {
    eventType: 'fixture entity-specific create/upsert event',
    clientEventIdPolicy: 'deterministic fixture-owned id',
    attemptKey: 'canonical user id plus fixture version',
    sourceLogId: 'fixture entity id',
    dedupeKey: 'fixture entity primary or compound key',
    timestamps: 'the confirmed fixture apply timestamp',
    learningFactPolicy: 'fixture writes are linked to deterministic LearningFact evidence',
    learningFactMaterializationPolicy: 'materialized-learning-fact',
    confidencePolicy: 'fixture-owned deterministic confidence only',
    privacyScope: 'minimized; raw identifiers and payloads excluded from governance output',
  },
  resourceIds: YANGFAN_DIAGNOSTIC_FIXTURE_GOVERNED_RESOURCE_IDS,
} as const;

export async function buildYangFanDiagnosticFixturePlan(
  db: YangFanDiagnosticFixtureDb,
  options: YangFanDiagnosticFixtureOptions = {},
): Promise<YangFanDiagnosticFixturePlan> {
  const mode = options.mode ?? 'dry-run';
  const now = options.now ?? new Date();
  const canonicalStudentNumber = options.canonicalStudentNumber ?? YANGFAN_DIAGNOSTIC_FIXTURE_STUDENT_NUMBER;
  const canonicalEmail = options.canonicalEmail ?? YANGFAN_DIAGNOSTIC_FIXTURE_EMAIL;
  const candidates = await loadYangFanCandidates(db, {
    canonicalEmail,
    canonicalStudentNumber,
  });
  const canonical = resolveCanonicalYangFanAccount(candidates, canonicalEmail, canonicalStudentNumber);
  const duplicates = canonical ? candidates.filter((candidate) => candidate.id !== canonical.id) : candidates;
  const duplicateSafety = canonical
    ? classifyDuplicateSafety(canonical, duplicates)
    : { unsafe: [], sameNameOnly: [] };
  const knowledgeNodeIds = canonical ? await loadFixtureKnowledgeNodeIds(db) : [];
  const canonicalSafety = mode !== 'reset' && canonical
    ? await classifyCanonicalWriteSafety(db, canonical.id, knowledgeNodeIds, options)
    : { blockers: [], warnings: [] };
  const readinessBlockers = mode === 'reset' ? [] : readinessSummaryBlockers(options.readinessSummary, options);
  const readinessWarnings = mode === 'reset' ? [] : readinessSummaryWarnings(options.readinessSummary, options);
  const safetyBlockers = safetyBlockersForMode(mode, options);
  const knowledgeNodeBlockers = mode !== 'reset' && canonical && !hasCompleteFixtureKnowledgeNodes(knowledgeNodeIds)
    ? ['fixture-knowledge-nodes-missing']
    : [];
  const blockers = [
    ...readinessBlockers,
    ...safetyBlockers,
    ...(!canonical ? ['canonical-yangfan-account-missing'] : []),
    ...(duplicateSafety.unsafe.length ? ['duplicate-yangfan-account-has-unsafe-records'] : []),
    ...knowledgeNodeBlockers,
    ...canonicalSafety.blockers,
  ];

  return {
    mode,
    generatedAt: now.toISOString(),
    canApply: mode === 'apply' && blockers.length === 0,
    blockers,
    warnings: unique([
      ...(duplicateSafety.unsafe.length ? ['duplicate-yangfan-account-manual-review-required'] : []),
      ...(duplicateSafety.sameNameOnly.length ? ['same-name-yangfan-accounts-treated-as-distinct'] : []),
      ...readinessWarnings,
      ...canonicalSafety.warnings,
    ]),
    privacy: privacySummary(),
    canonical: canonical ? maskAccount(canonical) : null,
    duplicates: duplicates.map(maskAccount),
    duplicateDisposition: duplicateSafety.unsafe.length
      ? 'blocked-unsafe'
      : 'none',
    plannedCounts: {
      LearningFact: FIXTURE_FACT_IDS.length,
      KnowledgeProgress: canonical ? knowledgeNodeIds.length : 0,
      LearningPath: canonical ? 1 : 0,
      LearningPathExecution: canonical ? 2 : 0,
      LearningPathDeviation: canonical ? 1 : 0,
      LearningPathIntervention: canonical ? 1 : 0,
      AdaptiveAssessmentState: canonical ? 6 : 0,
      StudentCompetencySnapshot: canonical ? 1 : 0,
      StudentProfileSummary: canonical ? 1 : 0,
      StudentEvidenceFeatureCache: canonical ? 1 : 0,
      ArenaSubmission: 0,
    },
    safety: {
      dryRunDefault: mode === 'dry-run' && options.apply !== true,
      applyConfirmed: (mode !== 'apply' && mode !== 'reset') || (options.apply === true && options.confirmApply === true),
      productionProtected: !isProductionLike(options),
      databaseAllowed: isFixtureDatabaseAllowed(options),
    },
    arenaBoundary: arenaBoundary(),
  };
}

export async function applyYangFanDiagnosticFixture(
  db: YangFanDiagnosticFixtureDb,
  plan: YangFanDiagnosticFixturePlan,
  options: YangFanDiagnosticFixtureOptions = {},
): Promise<YangFanDiagnosticFixtureApplyResult> {
  if (!plan.canonical) {
    throw new Error('Cannot apply Yang Fan diagnostic fixture without a canonical account.');
  }
  if (!plan.canApply) {
    throw new Error(`Cannot apply Yang Fan diagnostic fixture: ${plan.blockers.join(', ') || 'apply gate not satisfied'}`);
  }
  const applySafetyBlockers = safetyBlockersForMode('apply', { ...options, mode: 'apply' });
  if (applySafetyBlockers.length > 0) {
    throw new Error(`Cannot apply Yang Fan diagnostic fixture: ${applySafetyBlockers.join(', ')}`);
  }
  const applyReadinessBlockers = readinessSummaryBlockers(options.readinessSummary, options);
  if (applyReadinessBlockers.length > 0) {
    throw new Error(`Cannot apply Yang Fan diagnostic fixture: ${applyReadinessBlockers.join(', ')}`);
  }
  const applyWarnings = unique([
    ...plan.warnings.filter((warning) => warning !== 'yang-fan-fixture-limited-coverage'),
    ...readinessSummaryWarnings(options.readinessSummary, options),
  ]);

  const write = async (tx: YangFanDiagnosticFixtureDb) => {
    const now = options.now ?? new Date();
    const resolved = await resolveWritableAccounts(tx, options);
    const canonicalUserId = resolved.canonical.id;
    const knowledgeNodeIds = await loadFixtureKnowledgeNodeIds(tx);
    if (!hasCompleteFixtureKnowledgeNodes(knowledgeNodeIds)) {
      throw new Error('Cannot apply Yang Fan diagnostic fixture: fixture-knowledge-nodes-missing');
    }
    await resetFixtureRows(tx, canonicalUserId);

    const startedAt = new Date(now.getTime() - 60 * 60 * 1000);
    const facts = buildYangFanPortraitV2FixtureFacts(canonicalUserId, startedAt);
    await tx.learningFact.createMany({ data: facts, skipDuplicates: true });

    await tx.knowledgeProgress?.createMany({
      data: knowledgeNodeIds.map((nodeId) => ({
          id: fixtureKnowledgeProgressId(nodeId),
          userId: canonicalUserId,
          nodeId,
          status: 'IN_PROGRESS',
          progress: 68,
          timeSpent: 1800,
          lastVisited: now,
      })),
      skipDuplicates: true,
    });

    await upsertPathEvidence(tx, canonicalUserId, knowledgeNodeIds, now);
    await upsertAdaptiveAssessmentState(tx, canonicalUserId, now);
    await tx.studentCompetencySnapshot?.create({
      data: {
        id: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:snapshot`,
        userId: canonicalUserId,
        snapshotAt: now,
        competencyVector: fixtureCompetencyVector(now),
        evidenceSummary: {
          fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION,
          sourceFactIds: FIXTURE_FACT_IDS,
          privacy: 'minimized',
        },
        riskFlags: ['fixture-diagnostic-only'],
        trajectoryVector: { trend: 'stable-up', confidence: 'medium' },
        calculationVersion: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION,
        factCount: facts.length,
      },
    });
    await tx.studentProfileSummary?.upsert({
      where: { userId: canonicalUserId },
      create: profileSummaryData(canonicalUserId, now),
      update: profileSummaryData(canonicalUserId, now),
    });

    // The fixture DB shape models only fields used here; Prisma delegates satisfy the cache helper contract at runtime.
    await refreshStudentEvidenceFeatureCache(tx as unknown as StudentEvidenceFeatureCacheDb, canonicalUserId, {
      now,
      staleAfterDays: options.staleAfterDays,
    });

    return {
      mode: 'apply' as const,
      generatedAt: now.toISOString(),
      canonicalMaskedUserId: plan.canonical?.maskedUserId ?? null,
      affected: plan.plannedCounts,
      warnings: applyWarnings,
      privacy: plan.privacy,
      arenaBoundary: plan.arenaBoundary,
    };
  };

  return db.$transaction ? db.$transaction(write) : write(db);
}

export async function resetYangFanDiagnosticFixture(
  db: YangFanDiagnosticFixtureDb,
  plan: YangFanDiagnosticFixturePlan,
  options: YangFanDiagnosticFixtureOptions = {},
): Promise<YangFanDiagnosticFixtureApplyResult> {
  if (plan.mode !== 'reset') {
    throw new Error(`Cannot reset Yang Fan diagnostic fixture with a ${plan.mode} plan.`);
  }
  const resetSafetyBlockers = safetyBlockersForMode('reset', { ...options, mode: 'reset' });
  if (resetSafetyBlockers.length > 0) {
    throw new Error(`Cannot reset Yang Fan diagnostic fixture: ${resetSafetyBlockers.join(', ')}`);
  }
  if (!plan.canonical) {
    throw new Error('Cannot reset Yang Fan diagnostic fixture without a canonical account.');
  }
  if (plan.blockers.length > 0) {
    throw new Error(`Cannot reset Yang Fan diagnostic fixture: ${plan.blockers.join(', ')}`);
  }
  const now = new Date(plan.generatedAt);
  const write = async (tx: YangFanDiagnosticFixtureDb) => {
    const resolved = await resolveResettableAccount(tx, options);
    await resetFixtureRows(tx, resolved.canonical.id);
    await refreshOrDeleteEvidenceFeatureCacheAfterReset(tx, resolved.canonical.id, {
      now,
      staleAfterDays: options.staleAfterDays,
    });
  };
  await (db.$transaction ? db.$transaction(write) : write(db));

  return {
    mode: 'reset',
    generatedAt: now.toISOString(),
    canonicalMaskedUserId: plan.canonical?.maskedUserId ?? null,
    affected: {
      LearningFact: FIXTURE_FACT_IDS.length,
      LearningPath: 1,
      LearningPathExecution: 2,
      LearningPathDeviation: 1,
      LearningPathIntervention: 1,
      AdaptiveAssessmentState: 6,
      StudentCompetencySnapshot: 1,
      StudentEvidenceFeatureCache: 1,
    },
    warnings: plan.warnings,
    privacy: plan.privacy,
    arenaBoundary: plan.arenaBoundary,
  };
}

export function buildYangFanPortraitV2FixtureFacts(userId: string, startedAt: Date) {
  const base = {
    userId,
    courseId: 'control-correction',
    lessonId: 'yangfan-diagnostic-fixture',
    sessionId: FIXTURE_SESSION_KEY,
    createdAt: startedAt,
  };
  return [
    {
      ...base,
      competencyContribution: {
        controlModelingRepresentation: 0.35,
        systemAnalysisInterpretation: 0.35,
      },
      id: FIXTURE_FACT_IDS[0],
      factType: 'question',
      moduleId: 'adaptive-assessment',
      startedAt,
      finishedAt: new Date(startedAt.getTime() + 120_000),
      outcome: 'success',
      score: 0.82,
      timeSpent: 120,
      sourceEventId: `adaptive-assessment:${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:adaptive-answer`,
      sourceLogId: null,
      contextJson: {
        fixture: fixtureProvenance('adaptive-assessment'),
        adaptiveAssessment: {
          masteryPosterior: 0.68,
          masteryConfidence: 0.72,
          questionId: FIXTURE_QUESTION_ID,
        },
      },
    },
    {
      ...base,
      competencyContribution: {
        transferIntegratedApplication: 0.32,
        reflectionImprovementAiCollab: 0.28,
      },
      id: FIXTURE_FACT_IDS[1],
      factType: 'resource',
      moduleId: 'path-planning',
      startedAt: new Date(startedAt.getTime() + 180_000),
      finishedAt: new Date(startedAt.getTime() + 420_000),
      outcome: 'partial',
      score: 0.64,
      timeSpent: 240,
      sourceEventId: `learning-path:${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:path-execution`,
      sourceLogId: null,
      contextJson: {
        fixture: fixtureProvenance('path-execution'),
        pathExecution: {
          pathId: FIXTURE_PATH_ID,
          evidenceRefs: [{ sourceType: 'LearningPathExecution', sourceId: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:exec-start` }],
        },
      },
    },
    {
      ...base,
      competencyContribution: {
        reflectionImprovementAiCollab: 0.36,
        engineeringConstraintSafety: 0.24,
      },
      id: FIXTURE_FACT_IDS[2],
      factType: 'ai_intervention',
      moduleId: 'konling',
      startedAt: new Date(startedAt.getTime() + 480_000),
      finishedAt: new Date(startedAt.getTime() + 540_000),
      outcome: 'success',
      score: 0.76,
      timeSpent: 60,
      sourceEventId: `learning-path:${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:konling-tool-run`,
      sourceLogId: null,
      contextJson: {
        fixture: fixtureProvenance('konling'),
        konling: {
          citationRefs: ['LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal'],
          privacy: 'minimized',
        },
      },
    },
    {
      ...base,
      competencyContribution: {
        controllerDesignSynthesis: 0.34,
        simulationValidationEvidence: 0.4,
        engineeringConstraintSafety: 0.22,
      },
      id: FIXTURE_FACT_IDS[3],
      factType: 'simulation',
      moduleId: 'arena-preview',
      startedAt: new Date(startedAt.getTime() + 600_000),
      finishedAt: new Date(startedAt.getTime() + 900_000),
      outcome: 'partial',
      score: 0.58,
      timeSpent: 300,
      sourceEventId: `control-correction-path:${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:arena-preview`,
      sourceLogId: null,
      contextJson: {
        fixture: fixtureProvenance('arena-preview'),
        arena: {
          official: false,
          preview: true,
          scoreAuthority: 'fixture-auxiliary-learning-context',
          trace: { sourceType: 'LearningFact', sourceId: FIXTURE_FACT_IDS[3], privacyLevel: 'student-visible' },
        },
      },
    },
  ];
}

async function upsertPathEvidence(
  db: YangFanDiagnosticFixtureDb,
  userId: string,
  nodeIds: string[],
  now: Date,
) {
  const entryNodeId = nodeIds[0] ?? 'yangfan-fixture-entry-node';
  const terminalNodeId = FIXTURE_ARENA_NODE_ID;
  await db.learningPath?.upsert({
    where: { id: FIXTURE_PATH_ID },
    create: pathData(userId, entryNodeId, terminalNodeId, now),
    update: pathData(userId, entryNodeId, terminalNodeId, now),
  });
  await db.learningPathExecution?.createMany({
    data: [
      {
        id: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:exec-start`,
        pathId: FIXTURE_PATH_ID,
        userId,
        nodeId: entryNodeId,
        resourceType: 'knowledge_card',
        status: 'completed',
        startedAt: new Date(now.getTime() - 50 * 60_000),
        completedAt: new Date(now.getTime() - 44 * 60_000),
        evidenceRefs: [{ sourceType: 'LearningFact', sourceId: FIXTURE_FACT_IDS[1], fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION }],
        liftMetadata: { fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION, privacy: 'minimized' },
        idempotencyKey: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:exec-start`,
        createdAt: new Date(now.getTime() - 44 * 60_000),
      },
      {
        id: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:exec-terminal`,
        pathId: FIXTURE_PATH_ID,
        userId,
        nodeId: terminalNodeId,
        resourceType: 'arena_task',
        status: 'started',
        startedAt: new Date(now.getTime() - 40 * 60_000),
        completedAt: null,
        evidenceRefs: [{ sourceType: 'LearningFact', sourceId: FIXTURE_FACT_IDS[3], fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION }],
        liftMetadata: { fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION, activityKind: 'terminal-validation-preview' },
        arenaRef: { official: false, preview: true, traceReference: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:arena-preview` },
        idempotencyKey: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:exec-terminal`,
        createdAt: new Date(now.getTime() - 40 * 60_000),
      },
    ],
    skipDuplicates: true,
  });
  await db.learningPathDeviation?.createMany({
    data: [{
      id: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:deviation-low-confidence`,
      pathId: FIXTURE_PATH_ID,
      userId,
      deviationType: 'low-confidence-terminal-validation',
      priorNodeId: entryNodeId,
      targetNodeId: terminalNodeId,
      context: { fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION, privacy: 'minimized' },
      evidenceConfidence: 'low',
      idempotencyKey: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:deviation-low-confidence`,
      createdAt: new Date(now.getTime() - 39 * 60_000),
    }],
    skipDuplicates: true,
  });
  await db.learningPathIntervention?.createMany({
    data: [{
      id: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:intervention-konling`,
      pathId: FIXTURE_PATH_ID,
      userId,
      interventionKind: 'konling-citation-guidance',
      citedEvidence: [{ sourceType: 'LearningFact', sourceId: FIXTURE_FACT_IDS[2] }],
      suggestedAction: 'Use governed citations before continuing the diagnostic path.',
      studentOutcome: 'accepted',
      privacySafeSummary: 'Accepted citation-guided remediation.',
      idempotencyKey: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:intervention-konling`,
      createdAt: new Date(now.getTime() - 38 * 60_000),
    }],
    skipDuplicates: true,
  });
}

async function upsertAdaptiveAssessmentState(db: YangFanDiagnosticFixtureDb, userId: string, now: Date) {
  await db.adaptiveAssessmentAlgorithmVersion?.upsert({
    where: { version: FIXTURE_ALGORITHM_VERSION },
    create: {
      version: FIXTURE_ALGORITHM_VERSION,
      family: 'diagnostic-fixture',
      parameters: { fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION },
      status: 'active',
      releasedAt: now,
    },
    update: {
      parameters: { fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION },
      status: 'active',
    },
  });
  await db.adaptiveAssessmentItemRef?.upsert({
    where: {
      questionId_algorithmVersion_contentHash: {
        questionId: FIXTURE_QUESTION_ID,
        algorithmVersion: FIXTURE_ALGORITHM_VERSION,
        contentHash: FIXTURE_CONTENT_HASH,
      },
    },
    create: {
      id: FIXTURE_ITEM_REF_ID,
      questionId: FIXTURE_QUESTION_ID,
      contentHash: FIXTURE_CONTENT_HASH,
      source: 'diagnostic-fixture',
      questionType: 'single-choice',
      domains: ['control-correction'],
      knowledgeTags: ['controlModeling'],
      difficulty: 0.58,
      optionCount: 4,
      algorithmVersion: FIXTURE_ALGORITHM_VERSION,
      metadata: { fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION, privacy: 'minimized' },
    },
    update: {
      metadata: { fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION, privacy: 'minimized' },
    },
  });
  await db.adaptiveAssessmentSession?.upsert({
    where: { userId_sessionKey: { userId, sessionKey: FIXTURE_SESSION_KEY } },
    create: {
      id: FIXTURE_SESSION_ID,
      userId,
      sessionKey: FIXTURE_SESSION_KEY,
      selectedQuestionIds: [FIXTURE_QUESTION_ID],
      algorithmVersion: FIXTURE_ALGORITHM_VERSION,
      startedAt: new Date(now.getTime() - 60 * 60_000),
      lastAnsweredAt: new Date(now.getTime() - 58 * 60_000),
    },
    update: {
      selectedQuestionIds: [FIXTURE_QUESTION_ID],
      lastAnsweredAt: new Date(now.getTime() - 58 * 60_000),
    },
  });
  await db.adaptiveAssessmentAnswer?.upsert({
    where: { sessionId_questionId: { sessionId: FIXTURE_SESSION_ID, questionId: FIXTURE_QUESTION_ID } },
    create: {
      id: FIXTURE_ANSWER_ID,
      userId,
      sessionId: FIXTURE_SESSION_ID,
      questionRefId: FIXTURE_ITEM_REF_ID,
      questionId: FIXTURE_QUESTION_ID,
      selectedOptionKey: 'B',
      correctOptionKey: 'B',
      isCorrect: true,
      score: 1,
      responseTimeSeconds: 120,
      abilityEstimate: 0.68,
      algorithmVersion: FIXTURE_ALGORITHM_VERSION,
      answeredAt: new Date(now.getTime() - 58 * 60_000),
    },
    update: {
      selectedOptionKey: 'B',
      correctOptionKey: 'B',
      isCorrect: true,
      score: 1,
      responseTimeSeconds: 120,
      abilityEstimate: 0.68,
      answeredAt: new Date(now.getTime() - 58 * 60_000),
    },
  });
  await db.adaptiveAssessmentAbilityEstimate?.upsert({
    where: { answerId: FIXTURE_ANSWER_ID },
    create: {
      id: FIXTURE_ABILITY_ESTIMATE_ID,
      userId,
      sessionId: FIXTURE_SESSION_ID,
      answerId: FIXTURE_ANSWER_ID,
      theta: 0.68,
      confidenceLow: 0.52,
      confidenceHigh: 0.82,
      dimensions: { controlModeling: 0.68, diagnosticAssessment: 0.72, fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION },
      algorithmVersion: FIXTURE_ALGORITHM_VERSION,
      estimatedAt: new Date(now.getTime() - 58 * 60_000),
    },
    update: {
      theta: 0.68,
      confidenceLow: 0.52,
      confidenceHigh: 0.82,
      dimensions: { controlModeling: 0.68, diagnosticAssessment: 0.72, fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION },
      estimatedAt: new Date(now.getTime() - 58 * 60_000),
    },
  });
  await db.adaptiveMasteryUpdate?.deleteMany({
    where: { id: FIXTURE_MASTERY_UPDATE_ID },
  });
  await db.adaptiveMasteryUpdate?.createMany({
    data: [{
      id: FIXTURE_MASTERY_UPDATE_ID,
      userId,
      sessionId: FIXTURE_SESSION_ID,
      answerId: FIXTURE_ANSWER_ID,
      questionId: FIXTURE_QUESTION_ID,
      knowledgeTag: 'controlModeling',
      priorMastery: 0.48,
      posteriorMastery: 0.68,
      confidence: 0.72,
      evidenceKind: 'diagnostic-fixture',
      algorithmVersion: FIXTURE_ALGORITHM_VERSION,
      updateReason: 'yangfan-diagnostic-fixture',
      prerequisiteState: { fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION, privacy: 'minimized' },
    }],
    skipDuplicates: true,
  });
}

async function resetFixtureRows(
  db: YangFanDiagnosticFixtureDb,
  canonicalUserId: string,
) {
  await Promise.all([
    db.learningFact.deleteMany({ where: { OR: [{ id: { in: [...FIXTURE_FACT_IDS] } }, { sourceEventId: { startsWith: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:` } }] } }),
    db.knowledgeProgress?.deleteMany({
      where: {
        userId: canonicalUserId,
        id: { startsWith: FIXTURE_KNOWLEDGE_PROGRESS_ID_PREFIX },
      },
    }),
    db.learningPathExecution?.deleteMany({ where: { pathId: FIXTURE_PATH_ID } }),
    db.learningPathDeviation?.deleteMany({ where: { pathId: FIXTURE_PATH_ID } }),
    db.learningPathIntervention?.deleteMany({ where: { pathId: FIXTURE_PATH_ID } }),
    db.learningPath?.deleteMany({ where: { id: FIXTURE_PATH_ID } }),
    db.studentCompetencySnapshot?.deleteMany({ where: { id: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:snapshot` } }),
    db.adaptiveMasteryUpdate?.deleteMany({ where: { userId: canonicalUserId, algorithmVersion: FIXTURE_ALGORITHM_VERSION } }),
    db.adaptiveAssessmentAbilityEstimate?.deleteMany({ where: { userId: canonicalUserId, algorithmVersion: FIXTURE_ALGORITHM_VERSION } }),
    db.adaptiveAssessmentAnswer?.deleteMany({ where: { userId: canonicalUserId, algorithmVersion: FIXTURE_ALGORITHM_VERSION } }),
    db.adaptiveAssessmentSession?.deleteMany({ where: { userId: canonicalUserId, sessionKey: FIXTURE_SESSION_KEY } }),
  ]);
  const profileSummary = await db.studentProfileSummary?.findUnique({ where: { userId: canonicalUserId } });
  if (isFixtureProfileSummary(profileSummary)) {
    await db.studentProfileSummary?.deleteMany({ where: { userId: canonicalUserId } });
  }
}

async function refreshOrDeleteEvidenceFeatureCacheAfterReset(
  db: YangFanDiagnosticFixtureDb,
  canonicalUserId: string,
  options: StudentEvidenceFeatureRefreshOptions,
) {
  if (await hasRemainingEvidenceFeatureSources(db, canonicalUserId)) {
    await refreshStudentEvidenceFeatureCache(db as unknown as StudentEvidenceFeatureCacheDb, canonicalUserId, options);
    return;
  }
  await db.studentEvidenceFeatureCache.deleteMany({ where: { userId: canonicalUserId } });
}

async function hasRemainingEvidenceFeatureSources(db: YangFanDiagnosticFixtureDb, canonicalUserId: string) {
  const [
    facts,
    snapshots,
    profileSummary,
    pathExecutions,
    pathDeviations,
    pathInterventions,
  ] = await Promise.all([
    db.learningFact.findMany({ where: { userId: canonicalUserId }, select: { id: true }, take: 1 }),
    db.studentCompetencySnapshot?.findMany?.({ where: { userId: canonicalUserId }, select: { id: true }, take: 1 }) ?? [],
    db.studentProfileSummary?.findUnique({ where: { userId: canonicalUserId }, select: { userId: true } }) ?? null,
    db.learningPathExecution?.findMany({ where: { userId: canonicalUserId, ...REGISTERED_LEARNING_PATH_EVIDENCE_WHERE }, select: { id: true }, take: 1 }) ?? [],
    db.learningPathDeviation?.findMany({ where: { userId: canonicalUserId, ...REGISTERED_LEARNING_PATH_EVIDENCE_WHERE }, select: { id: true }, take: 1 }) ?? [],
    db.learningPathIntervention?.findMany({ where: { userId: canonicalUserId, ...REGISTERED_LEARNING_PATH_EVIDENCE_WHERE }, select: { id: true }, take: 1 }) ?? [],
  ]);
  return facts.length > 0
    || snapshots.length > 0
    || Boolean(profileSummary)
    || pathExecutions.length > 0
    || pathDeviations.length > 0
    || pathInterventions.length > 0;
}

const REGISTERED_LEARNING_PATH_EVIDENCE_WHERE = {
  path: { goalId: { in: Object.keys(ADAPTIVE_LEARNING_GOAL_DEFINITIONS) } },
} as const;

function pathData(userId: string, entryNodeId: string, terminalNodeId: string, now: Date) {
  const completedAt = new Date(now.getTime() - 44 * 60_000).toISOString();
  const updatedAt = new Date(now.getTime() - 40 * 60_000).toISOString();
  const pathPayload = fixturePathPayload(entryNodeId, terminalNodeId, completedAt, updatedAt);

  return {
    id: FIXTURE_PATH_ID,
    userId,
    title: 'Yang Fan diagnostic control-correction path',
    description: 'Diagnostic-only fixture path with governed evidence references.',
    estimatedTime: 35,
    nodeIds: [entryNodeId, terminalNodeId],
    isAiGenerated: true,
    isBookmarked: false,
    goalId: 'control-correction',
    plannerVersion: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION,
    pathStatus: 'active',
    currentNodeId: terminalNodeId,
    learnerStateRef: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:learner-state`,
    inputSnapshot: { fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION, privacy: 'minimized' },
    pathPayload,
    explanationPayload: {
      explanations: pathPayload.explanations,
      fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION,
      citationRefs: [`LearningFact:${FIXTURE_FACT_IDS[1]}`],
      privacy: 'minimized',
    },
    alternativePayload: [],
    entryNodeId,
    terminalValidation: {
      nodeId: terminalNodeId,
      sourceKind: 'arena_task',
      sourceRef: FIXTURE_ARENA_TASK_ID,
      taskId: FIXTURE_ARENA_TASK_ID,
      target: FIXTURE_ARENA_TARGET,
      state: 'low-confidence',
      fallbackRequired: true,
      lowConfidenceMarkers: ['fixture-terminal-preview'],
    },
    lastExecutionMetadata: {
      refreshedAt: now.toISOString(),
      fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION,
      completedNodeIds: [entryNodeId],
      failedNodeIds: [],
      lowConfidenceMarkers: ['fixture-terminal-preview'],
    },
  };
}

function fixturePathPayload(entryNodeId: string, terminalNodeId: string, completedAt: string, updatedAt: string) {
  const planNodes = [
    {
      nodeId: entryNodeId,
      title: '性能指标学习记录复盘',
      type: 'knowledge_card',
      pathNodeType: 'knowledge_card',
      displayName: '知识卡',
      iconKey: 'knowledge-card',
      shapeHint: 'card',
      evidenceBehavior: 'view',
      evidenceStatus: 'instrumented',
      externalResource: null,
      checkpoint: null,
      sourceKind: 'knowledge_graph',
      sourceRef: entryNodeId,
      target: `/knowledge?nodeId=${encodeURIComponent(entryNodeId)}`,
      estimatedTimeMinutes: 12,
      prerequisiteNodeIds: [],
      knowledgeCoverage: [entryNodeId],
      teacherPolicy: 'allowed',
      privacyLevel: 'student-visible',
      terminalConstraints: [],
      score: 0.72,
      reasonCodes: ['fixture-learning-record', 'low-confidence-learner-state'],
      status: 'completed',
      readiness: {
        state: 'ready',
        message: '已有学习记录可用于路径恢复。',
        unlockMessage: null,
        reasonCodes: ['fixture-learning-record'],
        fallbackNodeIds: [],
        missingCompetencies: [],
        missingEvidenceCount: 0,
        missingCompletedNodeIds: [],
        missingOutcomeRefs: [],
      },
    },
    {
      nodeId: terminalNodeId,
      title: '二阶对象快速稳定挑战',
      type: 'arena_task',
      pathNodeType: 'arena_task',
      displayName: 'Arena 挑战',
      iconKey: 'arena',
      shapeHint: 'challenge',
      evidenceBehavior: 'judged_submission',
      evidenceStatus: 'instrumented',
      externalResource: null,
      checkpoint: null,
      sourceKind: 'arena_task',
      sourceRef: FIXTURE_ARENA_TASK_ID,
      target: FIXTURE_ARENA_TARGET,
      estimatedTimeMinutes: 23,
      prerequisiteNodeIds: [entryNodeId],
      knowledgeCoverage: ['根轨迹_1_1'],
      teacherPolicy: 'allowed',
      privacyLevel: 'student-visible',
      terminalConstraints: ['terminal-validation'],
      score: 0.64,
      reasonCodes: ['fixture-terminal-validation', 'learner-evidence-low-confidence'],
      status: 'current',
      readiness: {
        state: 'ready',
        message: '可继续完成终点检查以更新学习路径。',
        unlockMessage: null,
        reasonCodes: ['fixture-terminal-validation'],
        fallbackNodeIds: [],
        missingCompetencies: [],
        missingEvidenceCount: 0,
        missingCompletedNodeIds: [],
        missingOutcomeRefs: [],
      },
    },
  ];

  return {
    fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION,
    policyFamily: 'rules-plus-graph-search',
    mainPathNodeIds: [entryNodeId, terminalNodeId],
    planNodes,
    alternatives: [],
    explanations: {
      selectedReasons: ['LearningFact', 'low-confidence-learner-state'],
      rejectedAlternatives: [],
      fallbackReasons: ['learner-evidence-low-confidence'],
    },
    score: {
      total: 0.68,
      objectives: {
        learningGain: 0.7,
        engagement: 0.55,
        constraintSatisfaction: 0.8,
        diversity: 0.3,
        fatigue: 0.2,
        dropoutRisk: 0.25,
      },
    },
    confidence: {
      level: 'low',
      score: 0.42,
      sourceCoverage: 0.35,
    },
    executionStatus: {
      adopted: true,
      completedNodeIds: [entryNodeId],
      activeNodeId: terminalNodeId,
      updatedAt,
    },
    deviations: [],
    corrections: [],
    feedbackEvents: [{
      id: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:feedback-restore`,
      type: 'selection',
      nodeId: entryNodeId,
      createdAt: completedAt,
      context: { selectedStyleId: 'path-option-1', fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION },
    }],
    visualization: {
      map: {
        mainPathNodeIds: [entryNodeId, terminalNodeId],
        branchPaths: [],
        currentNodeId: terminalNodeId,
        completedNodeIds: [entryNodeId],
        riskNodeIds: [terminalNodeId],
        blockedNodes: [],
        alternatives: [],
      },
      timeline: {
        generatedAt: updatedAt,
        windows: [{ days: 7, nodeIds: [entryNodeId, terminalNodeId], estimatedMinutes: 35 }],
      },
      evidence: {
        evidenceBasis: 'LearningFact',
        learnerStateDeficits: [],
        sourceCoverage: 0.35,
        limitations: ['fixture-terminal-preview'],
      },
    },
  };
}

function profileSummaryData(userId: string, now: Date) {
  return {
    userId,
    overallLevel: 'diagnostic-fixture',
    overallScore: 0.66,
    strengthsJson: ['governed-path-evidence', 'citation-aware-konling'],
    weaknessesJson: ['terminal-validation-confidence'],
    recentTrend: 'fixture-stable',
    trendDirection: 'stable',
    riskFlagsJson: ['fixture-diagnostic-only'],
    riskLevel: 'low',
    recommendedScaffolding: 'Use governed citations and terminal-validation review before remediation.',
    recentActivityJson: { fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION, rawPayloadsIncluded: false },
    cacheExpiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
  };
}

function fixtureCompetencyVector(now: Date): CompetencyVector {
  const lastUpdated = now.toISOString();
  return {
    controlModeling: { score: 68, trend: 'up', confidence: 0.72, evidenceCount: 3, lastUpdated },
    parameterDesign: { score: 58, trend: 'stable', confidence: 0.64, evidenceCount: 2, lastUpdated },
    crossDomainTransfer: { score: 61, trend: 'stable', confidence: 0.58, evidenceCount: 1, lastUpdated },
    engineeringDecision: { score: 63, trend: 'stable', confidence: 0.62, evidenceCount: 2, lastUpdated },
    inquiryReflection: { score: 55, trend: 'up', confidence: 0.56, evidenceCount: 1, lastUpdated },
    selfDirectedLearning: { score: 66, trend: 'up', confidence: 0.68, evidenceCount: 3, lastUpdated },
  };
}

function isFixtureProfileSummary(row: Record<string, any> | null | undefined) {
  return recordValue(row?.recentActivityJson).fixtureScope === YANGFAN_DIAGNOSTIC_FIXTURE_VERSION;
}

function fixtureKnowledgeProgressId(nodeId: string) {
  return `${FIXTURE_KNOWLEDGE_PROGRESS_ID_PREFIX}${hashIdentifier(nodeId)?.slice('sha256:'.length) ?? 'unknown'}`;
}

function hasCompleteFixtureKnowledgeNodes(knowledgeNodeIds: string[]) {
  return knowledgeNodeIds.length === FIXTURE_KNOWLEDGE_NODE_IDS.length;
}

async function loadYangFanCandidates(
  db: YangFanDiagnosticFixtureDb,
  input: { canonicalEmail?: string | null; canonicalStudentNumber?: string | null },
) {
  return db.user.findMany({
    where: {
      role: 'STUDENT',
      OR: [
        { name: { contains: 'Yang Fan', mode: 'insensitive' } },
        { name: { contains: 'YangFan', mode: 'insensitive' } },
        { name: { contains: '杨帆' } },
        ...(input.canonicalEmail ? [{ email: input.canonicalEmail }] : []),
        ...(input.canonicalStudentNumber ? [{ profile: { is: { studentNumber: input.canonicalStudentNumber } } }] : []),
      ],
    },
    select: { id: true, name: true, email: true, profile: { select: { studentNumber: true } } },
  });
}

export function resolveCanonicalYangFanAccount(
  candidates: Array<Record<string, any>>,
  canonicalEmail?: string | null,
  canonicalStudentNumber?: string | null,
) {
  if (!canonicalEmail || !canonicalStudentNumber) return null;
  const exact = candidates.filter((candidate) =>
    candidate.email === canonicalEmail && candidate.profile?.studentNumber === canonicalStudentNumber
  );
  return exact.length === 1 ? exact[0] : null;
}

function classifyDuplicateSafety(
  canonical: Record<string, any>,
  duplicates: Array<Record<string, any>>,
) {
  const unsafe: string[] = [];
  const sameNameOnly: string[] = [];
  for (const duplicate of duplicates) {
    if (hasConflictingCanonicalIdentifier(canonical, duplicate)) {
      unsafe.push(duplicate.id);
    } else {
      sameNameOnly.push(duplicate.id);
    }
  }
  return { unsafe, sameNameOnly };
}

async function classifyCanonicalWriteSafety(
  db: YangFanDiagnosticFixtureDb,
  canonicalUserId: string,
  knowledgeNodeIds: string[],
  options: YangFanDiagnosticFixtureOptions,
) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const existingKnowledgeProgress = await db.knowledgeProgress?.findMany?.({
    where: {
      userId: canonicalUserId,
      nodeId: { in: knowledgeNodeIds },
    },
    select: { id: true, status: true, progress: true, timeSpent: true },
  }) ?? [];
  if (existingKnowledgeProgress.some((row) => !isFixtureKnowledgeProgress(row))) {
    blockers.push('canonical-knowledge-progress-already-exists');
  }
  const profileSummary = await db.studentProfileSummary?.findUnique({ where: { userId: canonicalUserId } });
  if (profileSummary && !isFixtureProfileSummary(profileSummary)) {
    if (options.replaceCanonicalProfileSummary === true) {
      warnings.push('canonical-profile-summary-replace-requested');
    } else {
      blockers.push('canonical-profile-summary-already-exists');
    }
  }
  return { blockers, warnings };
}

async function loadFixtureKnowledgeNodeIds(db: YangFanDiagnosticFixtureDb) {
  const nodes = await db.knowledgeNode?.findMany({
    where: {
      id: { in: [...FIXTURE_KNOWLEDGE_NODE_IDS] },
      isActive: true,
    },
    select: { id: true },
  }) ?? [];
  const available = new Set(nodes.map((node) => String(node.id)).filter(Boolean));
  return FIXTURE_KNOWLEDGE_NODE_IDS.filter((nodeId) => available.has(nodeId));
}

function readinessSummaryBlockers(
  summary?: YangFanReadinessSummaryInput | null,
  options: YangFanDiagnosticFixtureOptions = {},
): string[] {
  if (!summary) return ['readiness-summary-missing'];
  const resourceCoverage = recordValue(summary.resourceCoverage);
  const fixtureBlockers = recordValue(resourceCoverage.yangFanFixtureBlockers);
  if (!('blocked' in fixtureBlockers)) {
    const status = typeof summary.status === 'string' ? summary.status : '';
    return status === 'passed' ? [] : ['readiness-summary-not-passed'];
  }
  const blockingFindings: string[] = [];
  if (fixtureBlockers.blocked === true && options.allowFixtureReadinessBlockers !== true) {
    blockingFindings.push('yang-fan-fixture-blockers');
  }
  return unique(blockingFindings);
}

function readinessSummaryWarnings(
  summary?: YangFanReadinessSummaryInput | null,
  options: YangFanDiagnosticFixtureOptions = {},
): string[] {
  if (!summary) return [];
  const resourceCoverage = recordValue(summary.resourceCoverage);
  const fixtureBlockers = recordValue(resourceCoverage.yangFanFixtureBlockers);
  const findings = Array.isArray(summary.findings) ? summary.findings : [];
  const hasLimitedCoverageFinding = findings.some((finding) =>
    recordValue(finding).id === 'yang-fan-fixture-limited-coverage'
  );
  const globalLimitationCount = Number(fixtureBlockers.globalLimitationCount || 0);
  const warnings = hasLimitedCoverageFinding || globalLimitationCount > 0
    ? ['yang-fan-fixture-limited-coverage']
    : [];
  if (fixtureBlockers.blocked === true && options.allowFixtureReadinessBlockers === true) {
    warnings.push('yang-fan-fixture-blockers-overridden');
  }
  return unique(warnings);
}

function safetyBlockersForMode(
  mode: YangFanDiagnosticFixtureMode,
  options: YangFanDiagnosticFixtureOptions,
): string[] {
  if (mode !== 'apply' && mode !== 'reset') return [];
  return [
    options.apply !== true || options.confirmApply !== true ? 'explicit-apply-confirmation-missing' : '',
    isProductionLike(options) ? 'production-like-environment' : '',
    !isFixtureDatabaseAllowed(options) ? 'fixture-database-not-allowlisted' : '',
  ].filter(Boolean);
}

function isProductionLike(options: YangFanDiagnosticFixtureOptions) {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? '';
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL ?? '';
  return nodeEnv === 'production' || /prod|production/i.test(databaseUrl);
}

function isFixtureDatabaseAllowed(options: YangFanDiagnosticFixtureOptions) {
  const allowlist = (options.fixtureDbAllowlist ?? process.env.YANGFAN_FIXTURE_DB_ALLOWLIST ?? '').trim().toLowerCase();
  if (allowlist === '1' || allowlist === 'true') return true;
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL ?? '';
  if (databaseUrl.startsWith('file:')) return true;
  try {
    const parsed = new URL(databaseUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1') {
      return true;
    }
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '')).toLowerCase();
    return databaseName === 'act_dev' || databaseName === 'act_test';
  } catch {
    return false;
  }
}

function isFixtureKnowledgeProgress(row: Record<string, any>) {
  return typeof row.id === 'string' && row.id.startsWith(FIXTURE_KNOWLEDGE_PROGRESS_ID_PREFIX);
}

function maskAccount(candidate: Record<string, any>): YangFanDiagnosticFixtureAccount {
  return {
    maskedUserId: hashIdentifier(candidate.id) ?? 'sha256:unknown',
    nameHash: hashIdentifier(candidate.name),
    emailHash: hashIdentifier(candidate.email),
    studentNumberHash: hashIdentifier(candidate.profile?.studentNumber),
    hasEmail: Boolean(candidate.email),
  };
}

async function resolveWritableAccounts(
  db: YangFanDiagnosticFixtureDb,
  options: YangFanDiagnosticFixtureOptions,
) {
  const canonicalStudentNumber = options.canonicalStudentNumber ?? YANGFAN_DIAGNOSTIC_FIXTURE_STUDENT_NUMBER;
  const canonicalEmail = options.canonicalEmail ?? YANGFAN_DIAGNOSTIC_FIXTURE_EMAIL;
  const candidates = await loadYangFanCandidates(db, {
    canonicalEmail,
    canonicalStudentNumber,
  });
  const canonical = resolveCanonicalYangFanAccount(candidates, canonicalEmail, canonicalStudentNumber);
  if (!canonical) throw new Error('Cannot resolve canonical Yang Fan account for fixture write.');
  const duplicates = candidates.filter((candidate) => candidate.id !== canonical.id);
  const duplicateSafety = classifyDuplicateSafety(canonical, duplicates);
  if (duplicateSafety.unsafe.length > 0) {
    throw new Error('Cannot write fixture while unsafe duplicate Yang Fan accounts remain.');
  }
  const knowledgeNodeIds = await loadFixtureKnowledgeNodeIds(db);
  const canonicalSafety = await classifyCanonicalWriteSafety(db, canonical.id, knowledgeNodeIds, options);
  if (canonicalSafety.blockers.length > 0) {
    throw new Error(`Cannot write fixture while canonical learner records are unsafe: ${canonicalSafety.blockers.join(', ')}`);
  }
  return {
    canonical,
  };
}

async function resolveResettableAccount(
  db: YangFanDiagnosticFixtureDb,
  options: YangFanDiagnosticFixtureOptions,
) {
  const canonicalStudentNumber = options.canonicalStudentNumber ?? YANGFAN_DIAGNOSTIC_FIXTURE_STUDENT_NUMBER;
  const canonicalEmail = options.canonicalEmail ?? YANGFAN_DIAGNOSTIC_FIXTURE_EMAIL;
  const candidates = await loadYangFanCandidates(db, {
    canonicalEmail,
    canonicalStudentNumber,
  });
  const canonical = resolveCanonicalYangFanAccount(candidates, canonicalEmail, canonicalStudentNumber);
  if (!canonical) throw new Error('Cannot resolve canonical Yang Fan account for fixture reset.');
  const duplicates = candidates.filter((candidate) => candidate.id !== canonical.id);
  const duplicateSafety = classifyDuplicateSafety(canonical, duplicates);
  if (duplicateSafety.unsafe.length > 0) {
    throw new Error('Cannot reset fixture while unsafe duplicate Yang Fan accounts remain.');
  }
  return {
    canonical,
  };
}

function hasConflictingCanonicalIdentifier(
  canonical: Record<string, any>,
  duplicate: Record<string, any>,
) {
  const canonicalEmail = normalizeIdentityValue(canonical.email);
  const duplicateEmail = normalizeIdentityValue(duplicate.email);
  if (canonicalEmail && duplicateEmail && canonicalEmail === duplicateEmail) {
    return true;
  }

  const canonicalStudentNumber = normalizeIdentityValue(canonical.profile?.studentNumber);
  const duplicateStudentNumber = normalizeIdentityValue(duplicate.profile?.studentNumber);
  if (canonicalStudentNumber && duplicateStudentNumber && canonicalStudentNumber === duplicateStudentNumber) {
    return true;
  }

  return false;
}

function normalizeIdentityValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function fixtureProvenance(source: string) {
  return {
    scope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION,
    source,
    synthetic: true,
    privacy: 'minimized',
    rawPayloadsIncluded: false,
    ordinaryMetricsExcluded: true,
  };
}

function privacySummary(): YangFanDiagnosticFixturePlan['privacy'] {
  return {
    mode: 'minimized',
    rawIdentifiersIncluded: false,
    rawPayloadsIncluded: false,
    identifierHash: 'sha256:12',
  };
}

function arenaBoundary(): YangFanDiagnosticFixturePlan['arenaBoundary'] {
  return {
    officialArenaWrites: 0,
    fixtureArenaEvidenceScope: 'auxiliary-learning-context',
  };
}

function hashIdentifier(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  return `sha256:${createHash('sha256').update(text).digest('hex').slice(0, 12)}`;
}

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}
