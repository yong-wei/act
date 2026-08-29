import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { POINTER_MOVE, publishCurrentPointer } from '@/features/learning-record/projections/public-api';

import {
  appendLearnerFactTransition,
  planMissingLearningFactUpserts,
  reduceLearnerFactTransitions,
  requiresFullLearnerRebuild,
  type LearnerFactTransitionDb,
  type LearnerFactTransitionRow,
} from './cumulative-learner-state';
import {
  isPortraitV2ProfileEvidence,
  mapLearningFactsToPortraitEvidence,
  orderAndDedupePortraitV2Evidence,
  updatePortraitV2Incrementally,
  type PortraitV2IncrementalEvidence,
  type PortraitV2IncrementalResult,
  type PortraitLearningFactDelta,
} from './portrait-v2-incremental-update';
import {
  isTrustedLearningFact,
  TRUSTED_LEARNING_FACT_POLICY_VERSION,
} from './trusted-learning-fact-filter';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  createPortraitV2Payload,
  summarizeCumulativePortraitV2,
  writePortraitV2Snapshot,
  type PortraitV2PayloadShape,
  type PortraitV2SnapshotReadDb,
  type PortraitV2SnapshotWriteDb,
} from './portrait-v2-model';
import {
  detectCumulativePortraitRisks,
  type CumulativeRiskFact,
  type CumulativeRiskType,
  type RiskFlag,
} from './risk-detector';
import {
  assertSimulationTaskInputIdentity,
  buildSimulationTaskInputIdentity,
  deriveHistoricalSimulationTaskPlanDigest,
  projectSimulationTaskAttainment,
  type SimulationTaskAttainmentProjection,
} from './simulation-task-portrait-projection';

interface CutoverFenceRow {
  fence: bigint;
  calculationVersion: string;
  learnerGeneration: bigint;
  queueGeneration: bigint;
  activeMigrationRunId: string | null;
}

interface CurrentStateRow {
  userId?: string;
  stateVersionId?: string;
  stateWatermark: bigint;
  taskInputDigest?: string;
  calculationVersion: string;
  generation: bigint;
  queueGeneration: bigint;
  cutoverFence: bigint;
  stateVersion: {
    overallScore: number | null;
    lastTrend: string | null;
    lastRisk: unknown;
    stateKind: 'SNAPSHOT' | 'NO_EVIDENCE';
    trustedFactPolicyVersion?: string;
    trustedInputDigest?: string;
    snapshot?: { id?: string; payload: unknown } | null;
  };
}

type PortraitRiskFactDelta = PortraitLearningFactDelta & CumulativeRiskFact;

interface EvidenceRiskStateRow {
  riskKey: string;
  riskType: 'CONSTRAINT' | 'STAGNATION' | 'CROSS_DOMAIN';
  severity: string;
  isActive: boolean;
  supportFactIds: unknown;
  sourceTransitionSequence: bigint;
  occurredAt: Date;
}

interface PortraitV2MaterializationDb extends Partial<LearnerFactTransitionDb> {
  studentPortraitV2Snapshot?: NonNullable<PortraitV2SnapshotReadDb['studentPortraitV2Snapshot']> &
    NonNullable<PortraitV2SnapshotWriteDb['studentPortraitV2Snapshot']> & {
      deleteMany?: (args: { where: { userId: string; derivationKind?: 'native' } }) => Promise<unknown>;
    };
  learningFact: {
    findMany: (args: Record<string, unknown>) => Promise<PortraitRiskFactDelta[]>;
  };
  cumulativePortraitCutoverFence?: {
    findUnique: (args: Record<string, unknown>) => Promise<CutoverFenceRow | null>;
  };
  learnerPortraitCurrentState?: {
    findUnique: (args: Record<string, unknown>) => Promise<CurrentStateRow | null>;
    upsert?: (args: Record<string, unknown>) => Promise<unknown>;
    create?: (args: Record<string, unknown>) => Promise<unknown>;
    updateMany?: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  learnerPortraitStateVersion?: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  learnerEvidenceRiskState?: {
    findMany: (args: Record<string, unknown>) => Promise<EvidenceRiskStateRow[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  growthRecord?: {
    findMany: (args: Record<string, unknown>) => Promise<Array<{
      id: string;
      evidenceJson: unknown;
    }>>;
    upsert: (args: Record<string, unknown>) => Promise<unknown>;
  };
  growthRecordInvalidation?: {
    createMany: (args: Record<string, unknown>) => Promise<unknown>;
  };
  $transaction?: (
    fn: (tx: unknown) => Promise<unknown>,
    options?: { timeout?: number },
  ) => Promise<unknown>;
  $executeRaw?: (...args: unknown[]) => Promise<unknown>;
}

export interface PortraitV2PublicationExpectation {
  calculationVersion: string;
  generation: bigint;
  queueGeneration: bigint;
  cutoverFence: bigint;
  migrationRunId?: string | null;
}

export interface PortraitV2MaterializationResult {
  written: boolean;
  snapshotId?: string;
  stateVersionId?: string;
  stateKind?: 'SNAPSHOT' | 'NO_EVIDENCE';
  evidenceCount: number;
  affectedDimensions: string[];
  mappingIssues: string[];
  stateWatermark?: bigint;
  rebuildRequired?: boolean;
}

const PORTRAIT_V2_MATERIALIZATION_TRANSACTION_TIMEOUT_MS = 120_000;

export async function materializeIncrementalPortraitV2(
  db: PortraitV2MaterializationDb,
  userId: string,
  options: {
    now?: Date;
    fullRebuild?: boolean;
    dryRun?: boolean;
    publication?: PortraitV2PublicationExpectation;
    simulationTaskInput?: {
      expectedInputDigest?: string;
    };
  } = {},
): Promise<PortraitV2MaterializationResult> {
  const materialize = async (
    transactionDb: PortraitV2MaterializationDb,
  ): Promise<PortraitV2MaterializationResult> => {
    const now = options.now ?? new Date();
    const facts = (await transactionDb.learningFact.findMany({
      where: { userId },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        factType: true,
        startedAt: true,
        outcome: true,
        score: true,
        competencyContribution: true,
        contextJson: true,
        createdAt: true,
        sourceEventId: true,
        sourceLogId: true,
        knowledgeRevisionRef: true,
      },
    })).filter(isTrustedLearningFact);

    if (!hasCumulativeStateDb(transactionDb)) {
      return materializeLegacyCompatibleSnapshot(transactionDb, userId, facts, now, options.dryRun === true);
    }

    const journal = await transactionDb.learnerFactTransition.findMany({
      where: { userId },
      orderBy: [{ sequence: 'asc' }],
    });
    const drafts = planMissingLearningFactUpserts({ userId, facts, transitions: journal });
    const appended = options.dryRun
      ? simulatedTransitions(userId, drafts, journal)
      : await appendDrafts(transactionDb, drafts);
    const transitions = [...journal, ...appended];
    const reduction = reduceLearnerFactTransitions({ facts, transitions });
    const trustedFactIds = reduction.activeFacts
      .map((fact) => fact.id)
      .sort();
    const mapped = mapLearningFactsToPortraitEvidence(reduction.activeFacts);
    const profileEvidence = mapped.evidence.filter(isPortraitV2ProfileEvidence);
    const current = await transactionDb.learnerPortraitCurrentState.findUnique({
      where: { userId },
      include: {
        stateVersion: {
          include: { snapshot: true },
        },
      },
    });
    const fence = await transactionDb.cumulativePortraitCutoverFence.findUnique({
      where: { id: 'global' },
    });
    const expectation = validatePublicationFence(fence, options.publication);
    const trustedInputDigest = buildTrustedInputDigest({
      policyVersion: TRUSTED_LEARNING_FACT_POLICY_VERSION,
      calculationVersion: expectation.calculationVersion,
      stateWatermark: reduction.stateWatermark,
      factIds: trustedFactIds,
    });
    const currentPayload = readCurrentPayload(current);
    const taskProjection = projectSimulationTaskAttainment(reduction.activeFacts);
    const taskProjectionActive = taskProjection.hasGovernedTaskEvidence ||
      hasPersistedTaskProjection(currentPayload);
    const taskInputIdentity = buildSimulationTaskInputIdentity({
      factWatermark: reduction.stateWatermark,
      catalogDigest: taskProjection.catalogDigest,
      historicalCandidatePlanDigest:
        deriveHistoricalSimulationTaskPlanDigest(reduction.activeFacts),
    });
    assertSimulationTaskInputIdentity(
      options.simulationTaskInput?.expectedInputDigest,
      taskInputIdentity,
    );
    const taskInputDigest = taskProjectionActive ||
      Boolean(options.simulationTaskInput?.expectedInputDigest)
      ? taskInputIdentity.inputDigest
      : '';
    const currentReduction = reduceLearnerFactTransitions({
      facts,
      transitions: journal.filter((transition) =>
        transition.sequence <= (current?.stateWatermark ?? BigInt(0))),
    });
    const rebuildRequired = options.fullRebuild === true || requiresFullLearnerRebuild({
      transitions,
      currentWatermark: current?.stateWatermark ?? BigInt(0),
      currentCalculationVersion: current?.calculationVersion ?? null,
      targetCalculationVersion: expectation.calculationVersion,
      currentTrustedFactPolicyVersion: current?.stateVersion.trustedFactPolicyVersion ?? null,
      targetTrustedFactPolicyVersion: TRUSTED_LEARNING_FACT_POLICY_VERSION,
      currentLatestOccurredAt: currentReduction.latestOccurredAt,
      currentLatestFactId: currentReduction.latestFactId,
    });
    const incrementalFactIds = new Set(
      transitions
        .filter((transition) =>
          transition.sequence > (current?.stateWatermark ?? BigInt(0)) &&
          transition.operation === 'UPSERT')
        .map((transition) => transition.factId),
    );
    const updateMapped = rebuildRequired
      ? mapped
      : mapLearningFactsToPortraitEvidence(
        reduction.activeFacts.filter((fact) => incrementalFactIds.has(fact.id)),
      );
    const updateEvidence = updateMapped.evidence.filter(isPortraitV2ProfileEvidence);
    const unchanged = current !== null &&
      current.stateWatermark === reduction.stateWatermark &&
      current.calculationVersion === expectation.calculationVersion &&
      current.generation === expectation.generation &&
      current.queueGeneration === expectation.queueGeneration &&
      current.cutoverFence === expectation.cutoverFence &&
      (current.taskInputDigest ?? '') === taskInputDigest &&
      current.stateVersion.trustedFactPolicyVersion === TRUSTED_LEARNING_FACT_POLICY_VERSION &&
      current.stateVersion.trustedInputDigest === trustedInputDigest;
    if (unchanged) {
      return {
        written: false,
        evidenceCount: profileEvidence.length,
        affectedDimensions: [],
        mappingIssues: mapped.mappingIssues,
        stateWatermark: reduction.stateWatermark,
        rebuildRequired,
      };
    }
    if (options.dryRun) {
      return {
        written: true,
        stateKind: profileEvidence.length > 0 ||
          (taskProjectionActive && taskProjection.state === 'EVIDENCE')
          ? 'SNAPSHOT'
          : 'NO_EVIDENCE',
        evidenceCount: profileEvidence.length,
        affectedDimensions: [],
        mappingIssues: mapped.mappingIssues,
        stateWatermark: reduction.stateWatermark,
        rebuildRequired,
      };
    }

    if (
      profileEvidence.length === 0 &&
      (!taskProjectionActive || taskProjection.state === 'NO_EVIDENCE')
    ) {
      const lastRisk = await materializeEvidenceRisks(transactionDb, {
        userId,
        expectation,
        transitions,
        currentWatermark: current?.stateWatermark ?? BigInt(0),
        current: [],
      });
      await invalidateDerivedGrowthRecords(transactionDb, {
        userId,
        expectation,
        transitions,
        currentWatermark: current?.stateWatermark ?? BigInt(0),
      });
      return publishState(transactionDb, {
        userId,
        expectation,
        stateWatermark: reduction.stateWatermark,
        taskInputDigest,
        stateKind: 'NO_EVIDENCE',
        snapshotId: null,
        summary: null,
        lastTrend: current?.stateVersion.lastTrend ?? null,
        lastRisk,
        availabilityReason: transitions.some((transition) =>
          transition.operation === 'CORRECT' || transition.operation === 'REVOKE')
          ? 'no-evidence-after-revocation'
          : 'no-eligible-evidence',
        generatedAt: now,
        evidenceCount: 0,
        affectedDimensions: [],
        mappingIssues: mapped.mappingIssues,
        trustedFactIds,
        trustedFactPolicyVersion: TRUSTED_LEARNING_FACT_POLICY_VERSION,
        trustedInputDigest,
        rebuildRequired,
      });
    }

    const evidenceAt = latestEvidenceDate(
      reduction.latestOccurredAt,
      taskProjection.evidenceAsOf,
      now,
    );
    const trustedPolicyChanged = current !== null
      && current.stateVersion.trustedFactPolicyVersion !== TRUSTED_LEARNING_FACT_POLICY_VERSION;
    const comparisonPayload = rebuildRequired && current && !trustedPolicyChanged
      ? buildPortraitFromFacts(userId, currentReduction.activeFacts as PortraitRiskFactDelta[])
      : currentPayload;
    const updated = foldPortraitEvidence(
      userId,
      rebuildRequired ? null : currentPayload,
      updateEvidence,
      evidenceAt,
    );
    const projectedPayload = taskProjectionActive
      ? applySimulationTaskProjection(updated.payload, taskProjection, evidenceAt)
      : updated.payload;
    const meaningfulStateChange = !comparisonPayload ||
      portraitStateDigest(projectedPayload) !== portraitStateDigest(comparisonPayload);
    const summary = summarizeCumulativePortraitV2(projectedPayload, comparisonPayload);
    const currentRisks = detectCumulativePortraitRisks({
      userId,
      facts: reduction.activeFacts as PortraitRiskFactDelta[],
      currentPortrait: projectedPayload,
      previousPortrait: comparisonPayload,
    });
    const lastRisk = await materializeEvidenceRisks(transactionDb, {
      userId,
      expectation,
      transitions,
      currentWatermark: current?.stateWatermark ?? BigInt(0),
      current: currentRisks,
    });
    await invalidateDerivedGrowthRecords(transactionDb, {
      userId,
      expectation,
      transitions,
      currentWatermark: current?.stateWatermark ?? BigInt(0),
    });
    if (meaningfulStateChange) {
      await materializeGrowthRecord(transactionDb, {
        userId,
        expectation,
        stateWatermark: reduction.stateWatermark,
        occurredAt: evidenceAt,
        summary,
        transitions,
        currentWatermark: current?.stateWatermark ?? BigInt(0),
      });
    }
    const existingSnapshotId = current?.stateVersion.snapshot?.id;
    const persisted = meaningfulStateChange || trustedPolicyChanged || !existingSnapshotId
      ? await writePortraitV2Snapshot(transactionDb, projectedPayload, { now })
      : { id: existingSnapshotId };
    return publishState(transactionDb, {
      userId,
      expectation,
      stateWatermark: reduction.stateWatermark,
      taskInputDigest,
      stateKind: 'SNAPSHOT',
      snapshotId: persisted.id,
      summary,
      lastTrend: updateEvidence.length > 0
        ? updated.lastTrend
        : current?.stateVersion.lastTrend ?? summary.trend,
      lastRisk,
      availabilityReason: 'available',
      generatedAt: now,
      evidenceCount: profileEvidence.length,
      affectedDimensions: taskProjectionActive
        ? [...new Set([...updated.affectedDimensions, 'simulationValidationEvidence'])]
        : updated.affectedDimensions,
      mappingIssues: [...new Set([
        ...mapped.mappingIssues,
        ...updateMapped.mappingIssues,
        ...updated.mappingIssues,
      ])],
      trustedFactIds,
      trustedFactPolicyVersion: TRUSTED_LEARNING_FACT_POLICY_VERSION,
      trustedInputDigest,
      rebuildRequired,
    });
  };

  if (!db.$transaction && (!hasCumulativeStateDb(db) || options.dryRun)) return materialize(db);
  if (!db.$transaction) {
    throw new Error('Cumulative portrait publication requires transaction advisory-lock support.');
  }
  return db.$transaction(
    async (tx) => {
      const transactionDb = tx as PortraitV2MaterializationDb;
      if (typeof transactionDb.$executeRaw !== 'function') {
        throw new Error('Cumulative portrait publication requires transaction advisory-lock support.');
      }
      await transactionDb.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'portrait-v2:' + userId}))`,
      );
      return materialize(transactionDb);
    },
    { timeout: PORTRAIT_V2_MATERIALIZATION_TRANSACTION_TIMEOUT_MS },
  ) as Promise<PortraitV2MaterializationResult>;
}

function hasCumulativeStateDb(db: PortraitV2MaterializationDb): db is PortraitV2MaterializationDb &
LearnerFactTransitionDb & {
  cumulativePortraitCutoverFence: NonNullable<PortraitV2MaterializationDb['cumulativePortraitCutoverFence']>;
  learnerPortraitCurrentState: NonNullable<PortraitV2MaterializationDb['learnerPortraitCurrentState']>;
  learnerPortraitStateVersion: NonNullable<PortraitV2MaterializationDb['learnerPortraitStateVersion']>;
} {
  return Boolean(
    db.learnerFactTransition &&
    db.learnerFactTransitionSequence &&
    db.cumulativePortraitCutoverFence &&
    db.learnerPortraitCurrentState &&
    db.learnerPortraitStateVersion,
  );
}

async function appendDrafts(
  db: LearnerFactTransitionDb,
  drafts: ReturnType<typeof planMissingLearningFactUpserts>,
): Promise<LearnerFactTransitionRow[]> {
  const appended: LearnerFactTransitionRow[] = [];
  for (const draft of drafts) appended.push(await appendLearnerFactTransition(db, draft));
  return appended;
}

function simulatedTransitions(
  userId: string,
  drafts: ReturnType<typeof planMissingLearningFactUpserts>,
  journal: LearnerFactTransitionRow[],
): LearnerFactTransitionRow[] {
  let sequence = journal.reduce((maximum, transition) =>
    transition.sequence > maximum ? transition.sequence : maximum, BigInt(0));
  return drafts.map((draft, index) => ({
    id: `dry-run:${userId}:${index}`,
    sequence: ++sequence,
    createdAt: draft.occurredAt,
    ...draft,
  }));
}

function validatePublicationFence(
  fence: CutoverFenceRow | null,
  requested?: PortraitV2PublicationExpectation,
): PortraitV2PublicationExpectation {
  if (!fence || fence.calculationVersion !== PORTRAIT_V2_CALCULATION_VERSION) {
    throw new Error('No active cumulative portrait cutover fence is available.');
  }
  const expectation = requested ?? {
    calculationVersion: fence.calculationVersion,
    generation: fence.learnerGeneration,
    queueGeneration: fence.queueGeneration,
    cutoverFence: fence.fence,
    migrationRunId: fence.activeMigrationRunId,
  };
  if (
    expectation.calculationVersion !== fence.calculationVersion ||
    expectation.generation !== fence.learnerGeneration ||
    expectation.queueGeneration !== fence.queueGeneration ||
    expectation.cutoverFence !== fence.fence ||
    (expectation.migrationRunId !== undefined &&
      expectation.migrationRunId !== fence.activeMigrationRunId)
  ) {
    throw new Error('Cumulative portrait publication fence is stale.');
  }
  return expectation;
}

async function publishState(
  db: PortraitV2MaterializationDb & {
    learnerPortraitCurrentState: NonNullable<PortraitV2MaterializationDb['learnerPortraitCurrentState']>;
    learnerPortraitStateVersion: NonNullable<PortraitV2MaterializationDb['learnerPortraitStateVersion']>;
  },
  input: {
    userId: string;
    expectation: PortraitV2PublicationExpectation;
    stateWatermark: bigint;
    taskInputDigest: string;
    stateKind: 'SNAPSHOT' | 'NO_EVIDENCE';
    snapshotId: string | null;
    summary: ReturnType<typeof summarizeCumulativePortraitV2> | null;
    lastTrend: string | null;
    lastRisk: unknown;
    availabilityReason: string;
    generatedAt: Date;
    evidenceCount: number;
    affectedDimensions: string[];
    mappingIssues: string[];
    trustedFactIds: string[];
    trustedFactPolicyVersion: string;
    trustedInputDigest: string;
    rebuildRequired: boolean;
  },
): Promise<PortraitV2MaterializationResult> {
  const state = await db.learnerPortraitStateVersion.create({
    data: {
      userId: input.userId,
      calculationVersion: input.expectation.calculationVersion,
      generation: input.expectation.generation,
      queueGeneration: input.expectation.queueGeneration,
      stateWatermark: input.stateWatermark,
      taskInputDigest: input.taskInputDigest,
      stateKind: input.stateKind,
      snapshotId: input.snapshotId,
      overallScore: input.summary?.overallScore ?? null,
      dimensionCoverage: input.summary
        ? {
            evidencedDimensionIds: input.summary.evidencedDimensionIds,
            missingDimensionIds: input.summary.missingDimensionIds,
          }
        : { evidencedDimensionIds: [], missingDimensionIds: [] },
      evidenceAsOf: input.summary?.evidenceAsOf ? new Date(input.summary.evidenceAsOf) : null,
      confidence: input.summary?.confidence ?? null,
      lastTrend: input.lastTrend,
      lastRisk: input.lastRisk,
      availabilityReason: input.availabilityReason,
      generatedAt: input.generatedAt,
      cutoverFence: input.expectation.cutoverFence,
      migrationRunId: input.expectation.migrationRunId ?? null,
      trustedFactIds: input.trustedFactIds,
      trustedFactPolicyVersion: input.trustedFactPolicyVersion,
      trustedInputDigest: input.trustedInputDigest,
    },
  });
  const pointer = await publishCurrentPointer({
    findUnique: async ({ where }) => {
      const row = await db.learnerPortraitCurrentState.findUnique({
        where: { userId: where.userId },
      });
      if (!row) return null;
      return {
        subjectUserId: row.userId ?? input.userId,
        versionId: row.stateVersionId ?? '',
        calculationVersion: row.calculationVersion,
        generation: row.generation,
        queueGeneration: row.queueGeneration,
        stateWatermark: row.stateWatermark,
        cutoverFence: row.cutoverFence,
        inputDigest: row.taskInputDigest ?? input.taskInputDigest,
      };
    },
    create: db.learnerPortraitCurrentState.create
      ? async (args) => db.learnerPortraitCurrentState.create!(args)
      : undefined,
    updateMany: db.learnerPortraitCurrentState.updateMany
      ? async (args) => db.learnerPortraitCurrentState.updateMany!(args)
      : undefined,
    upsert: db.learnerPortraitCurrentState.upsert
      ? async (args) => db.learnerPortraitCurrentState.upsert!(args)
      : undefined,
  }, {
    subjectUserId: input.userId,
    versionId: state.id,
    calculationVersion: input.expectation.calculationVersion,
    generation: input.expectation.generation,
    queueGeneration: input.expectation.queueGeneration,
    stateWatermark: input.stateWatermark,
    cutoverFence: input.expectation.cutoverFence,
    inputDigest: input.taskInputDigest,
  });
  if (pointer.move === POINTER_MOVE.stale || pointer.move === POINTER_MOVE.conflict) {
    return {
      written: false,
      ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
      stateVersionId: state.id,
      stateKind: input.stateKind,
      evidenceCount: input.evidenceCount,
      affectedDimensions: input.affectedDimensions,
      mappingIssues: input.mappingIssues,
      stateWatermark: input.stateWatermark,
      rebuildRequired: input.rebuildRequired,
    };
  }
  return {
    written: true,
    ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
    stateVersionId: state.id,
    stateKind: input.stateKind,
    evidenceCount: input.evidenceCount,
    affectedDimensions: input.affectedDimensions,
    mappingIssues: input.mappingIssues,
    stateWatermark: input.stateWatermark,
    rebuildRequired: input.rebuildRequired,
  };
}

async function materializeEvidenceRisks(
  db: PortraitV2MaterializationDb,
  input: {
    userId: string;
    expectation: PortraitV2PublicationExpectation;
    transitions: LearnerFactTransitionRow[];
    currentWatermark: bigint;
    current: RiskFlag[];
  },
): Promise<Array<{
  type: CumulativeRiskType;
  severity: string;
  occurredAt: string;
}>> {
  const current = input.current
    .filter((risk): risk is RiskFlag & { type: CumulativeRiskType } =>
      risk.type === 'constraint' || risk.type === 'stagnation' || risk.type === 'cross_domain')
    .sort((left, right) => left.type.localeCompare(right.type));
  if (!db.learnerEvidenceRiskState) return summarizeActiveRisks(current);

  const rows = await db.learnerEvidenceRiskState.findMany({
    where: {
      userId: input.userId,
      calculationVersion: input.expectation.calculationVersion,
      stateGeneration: input.expectation.generation,
      riskType: { in: ['CONSTRAINT', 'STAGNATION', 'CROSS_DOMAIN'] },
    },
    orderBy: [{ sourceTransitionSequence: 'desc' }, { id: 'desc' }],
  });
  const latest = new Map<CumulativeRiskType, EvidenceRiskStateRow>();
  for (const row of rows) {
    const type = fromRiskEnum(row.riskType);
    if (!latest.has(type)) latest.set(type, row);
  }
  const currentByType = new Map(current.map((risk) => [risk.type, risk]));
  const newTransitions = input.transitions.filter((transition) =>
    transition.sequence > input.currentWatermark);

  for (const type of ['constraint', 'stagnation', 'cross_domain'] as const) {
    const previous = latest.get(type);
    const next = currentByType.get(type);
    if (!previous && !next) continue;
    if (!next && previous && !previous.isActive) continue;

    const nextSupport = next ? readRiskSupportFactIds(next) : readStoredRiskSupport(previous?.supportFactIds);
    const nextMetricDigest = next ? riskMetricDigest(next) : readStoredMetricDigest(previous?.supportFactIds);
    if (
      previous &&
      next &&
      previous.isActive &&
      previous.severity === next.severity &&
      sameStrings(readStoredRiskSupport(previous.supportFactIds), nextSupport) &&
      readStoredMetricDigest(previous.supportFactIds) === nextMetricDigest
    ) {
      continue;
    }

    const sourceTransition = selectRiskSourceTransition({
      transitions: input.transitions,
      newTransitions,
      supportFactIds: nextSupport,
      clearing: !next,
    });
    if (!sourceTransition) continue;
    await db.learnerEvidenceRiskState.create({
      data: {
        userId: input.userId,
        riskKey: type,
        riskType: toRiskEnum(type),
        severity: next?.severity ?? previous?.severity ?? 'medium',
        isActive: Boolean(next),
        supportFactIds: {
          factIds: nextSupport,
          metricDigest: nextMetricDigest,
        },
        calculationVersion: input.expectation.calculationVersion,
        stateGeneration: input.expectation.generation,
        sourceTransitionSequence: sourceTransition.sequence,
        occurredAt: next?.triggeredAt ?? sourceTransition.occurredAt,
      },
    });
  }
  return summarizeActiveRisks(current);
}

async function materializeGrowthRecord(
  db: PortraitV2MaterializationDb,
  input: {
    userId: string;
    expectation: PortraitV2PublicationExpectation;
    stateWatermark: bigint;
    occurredAt: Date;
    summary: NonNullable<ReturnType<typeof summarizeCumulativePortraitV2>>;
    transitions: LearnerFactTransitionRow[];
    currentWatermark: bigint;
  },
): Promise<void> {
  if (!db.growthRecord) return;
  const supportingTransitions = input.transitions.filter((transition) =>
    transition.sequence > input.currentWatermark);
  const factHashes = [...new Set(supportingTransitions.map((transition) =>
    hashIdentity(transition.factId)))].sort();
  const stateDigest = hashJson({
    overallScore: input.summary.overallScore,
    confidence: input.summary.confidence,
    trend: input.summary.trend,
    evidencedDimensionIds: input.summary.evidencedDimensionIds,
    missingDimensionIds: input.summary.missingDimensionIds,
  });
  const derivedIdentity = hashJson({
    kind: 'cumulative-portrait-state-change',
    userId: input.userId,
    calculationVersion: input.expectation.calculationVersion,
    stateGeneration: input.expectation.generation.toString(),
    stateWatermark: input.stateWatermark.toString(),
    stateDigest,
  });
  const data = {
    userId: input.userId,
    businessKey: `cumulative-portrait:${derivedIdentity}`,
    recordType: 'portrait-state-change',
    title: '累计能力画像更新',
    description: '累计能力状态发生证据支持的变化。',
    evidenceJson: {
      factHashes,
      stateDigest,
      stateWatermark: input.stateWatermark.toString(),
    },
    mediaUrls: [],
    occurredAt: input.occurredAt,
    courseId: null,
    isPublic: true,
    sourceSnapshotAt: input.occurredAt,
    sourceInputDigest: stateDigest,
    expiresAt: null,
    calculationVersion: input.expectation.calculationVersion,
    stateGeneration: input.expectation.generation,
    derivedIdentity,
  };
  await db.growthRecord.upsert({
    where: { derivedIdentity },
    create: data,
    update: {},
  });
}

async function invalidateDerivedGrowthRecords(
  db: PortraitV2MaterializationDb,
  input: {
    userId: string;
    expectation: PortraitV2PublicationExpectation;
    transitions: LearnerFactTransitionRow[];
    currentWatermark: bigint;
  },
): Promise<void> {
  if (!db.growthRecord || !db.growthRecordInvalidation) return;
  const corrective = input.transitions.filter((transition) =>
    transition.sequence > input.currentWatermark &&
    (transition.operation === 'CORRECT' || transition.operation === 'REVOKE'));
  if (corrective.length === 0) return;
  const records = await db.growthRecord.findMany({
    where: {
      userId: input.userId,
      derivedIdentity: { not: null },
    },
    select: { id: true, evidenceJson: true },
  });
  const data = corrective.flatMap((transition) => {
    const factHash = hashIdentity(transition.factId);
    return records
      .filter((record) => readGrowthFactHashes(record.evidenceJson).includes(factHash))
      .map((record) => ({
        growthRecordId: record.id,
        userId: input.userId,
        reason: transition.operation === 'REVOKE'
          ? 'supporting-fact-revoked'
          : 'supporting-fact-corrected',
        calculationVersion: input.expectation.calculationVersion,
        stateGeneration: input.expectation.generation,
        sourceTransitionSequence: transition.sequence,
      }));
  });
  if (data.length === 0) return;
  await db.growthRecordInvalidation.createMany({
    data,
    skipDuplicates: true,
  });
}

function buildPortraitFromFacts(
  userId: string,
  facts: PortraitRiskFactDelta[],
): PortraitV2PayloadShape | null {
  const mapped = mapLearningFactsToPortraitEvidence(facts);
  const evidence = mapped.evidence.filter(isPortraitV2ProfileEvidence);
  if (evidence.length === 0) return null;
  const generatedAt = facts.reduce<Date | null>((latest, fact) =>
    !latest || fact.startedAt > latest ? fact.startedAt : latest, null) ?? new Date(0);
  return foldPortraitEvidence(userId, null, evidence, generatedAt).payload;
}

function foldPortraitEvidence(
  userId: string,
  initial: PortraitV2PayloadShape | null,
  evidence: PortraitV2IncrementalEvidence[],
  generatedAt: Date | string,
): PortraitV2IncrementalResult & {
  lastTrend: ReturnType<typeof summarizeCumulativePortraitV2>['trend'];
} {
  let previous = initial;
  let payload: PortraitV2IncrementalResult['payload'] | null = null;
  let lastTrend: ReturnType<typeof summarizeCumulativePortraitV2>['trend'] = 'not-comparable';
  const affectedDimensions = new Set<PortraitV2IncrementalResult['affectedDimensions'][number]>();
  const mappingIssues = new Set<string>();
  for (const item of orderAndDedupePortraitV2Evidence(evidence)) {
    const updated = updatePortraitV2Incrementally({
      userId,
      previous,
      evidence: [item],
      generatedAt,
    });
    lastTrend = summarizeCumulativePortraitV2(updated.payload, previous).trend;
    previous = updated.payload;
    payload = updated.payload;
    updated.affectedDimensions.forEach((dimension) => affectedDimensions.add(dimension));
    updated.mappingIssues.forEach((issue) => mappingIssues.add(issue));
  }
  if (!payload) {
    const updated = updatePortraitV2Incrementally({
      userId,
      previous: initial,
      evidence: [],
      generatedAt,
    });
    return {
      ...updated,
      lastTrend: initial
        ? summarizeCumulativePortraitV2(updated.payload, initial).trend
        : 'not-comparable',
    };
  }
  return {
    payload,
    lastTrend,
    affectedDimensions: payload.dimensions
      .map((dimension) => dimension.id)
      .filter((dimension) => affectedDimensions.has(dimension)),
    mappingIssues: [...mappingIssues],
  };
}

function portraitStateDigest(payload: PortraitV2PayloadShape): string {
  return hashJson(payload.dimensions.map((dimension) => ({
    id: dimension.id,
    score: dimension.score,
    confidence: dimension.confidence,
    evidenceCount: dimension.evidenceSummary.totalCount,
    lastPositiveEvidenceAt: dimension.lastPositiveEvidenceAt,
    lastNegativeEvidenceAt: dimension.lastNegativeEvidenceAt,
    taskAttainment: dimension.taskAttainment ?? null,
  })));
}

function hasPersistedTaskProjection(payload: PortraitV2PayloadShape | null): boolean {
  return Boolean(payload?.dimensions.find((dimension) =>
    dimension.id === 'simulationValidationEvidence')?.taskAttainment);
}

function latestEvidenceDate(
  factEvidenceAt: Date | null,
  taskEvidenceAt: string | null,
  fallback: Date,
): Date {
  const candidates = [
    factEvidenceAt,
    taskEvidenceAt ? new Date(taskEvidenceAt) : null,
  ].filter((value): value is Date => value !== null);
  return candidates.reduce<Date>((latest, value) =>
    value.getTime() > latest.getTime() ? value : latest, candidates[0] ?? fallback);
}

function applySimulationTaskProjection(
  payload: PortraitV2PayloadShape,
  projection: SimulationTaskAttainmentProjection,
  generatedAt: Date,
): ReturnType<typeof createPortraitV2Payload> {
  const generatedAtIso = generatedAt.toISOString();
  const dimensions = payload.dimensions.map((rawDimension) => {
    const dimension = rawDimension.freshness.asOf === null
      ? rawDimension
      : {
          ...rawDimension,
          freshness: {
            ...rawDimension.freshness,
            evidenceAgeDays: Math.max(
              0,
              Math.floor(
                (generatedAt.getTime() - Date.parse(rawDimension.freshness.asOf)) /
                  86_400_000,
              ),
            ),
          },
        };
    if (dimension.id !== 'simulationValidationEvidence') return dimension;
    if (projection.state === 'NO_EVIDENCE') {
      return {
        ...dimension,
        score: 0,
        confidence: 0,
        trend: 'stable' as const,
        freshness: { state: 'missing' as const, asOf: null, evidenceAgeDays: null },
        evidenceSummary: { totalCount: 0, sourceFamilyCounts: {} },
        lastPositiveEvidenceAt: null,
        lastNegativeEvidenceAt: null,
        rationale: 'No safe legacy mapping exists.',
        limitations: ['missing-native-portrait-v2-evidence'],
        sourceLineage: [],
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        taskAttainment: projection,
      };
    }
    const evidenceAgeDays = Math.max(
      0,
      Math.floor(
        (generatedAt.getTime() - Date.parse(projection.evidenceAsOf!)) / 86_400_000,
      ),
    );
    return {
      ...dimension,
      score: projection.score!,
      confidence: 1,
      trend: projection.score! > dimension.score
        ? 'up' as const
        : projection.score! < dimension.score
          ? 'down' as const
          : 'stable' as const,
      freshness: {
        state: 'current' as const,
        asOf: projection.evidenceAsOf,
        evidenceAgeDays,
      },
      evidenceSummary: {
        totalCount: projection.completedTaskCount,
        sourceFamilyCounts: { LearningFact: projection.completedTaskCount },
      },
      lastPositiveEvidenceAt: projection.evidenceAsOf,
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [{
        kind: 'evidence-family' as const,
        ref: 'LearningFact',
        privacyScope: 'student-visible' as const,
      }],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      taskAttainment: projection,
    };
  });
  return createPortraitV2Payload({
    userId: payload.userId,
    generatedAt: generatedAtIso,
    now: generatedAt,
    dimensions,
    derivation: payload.derivation,
    updateCursor: payload.updateCursor,
  });
}

function summarizeActiveRisks(risks: Array<RiskFlag & { type: CumulativeRiskType }>) {
  return risks.map((risk) => ({
    type: risk.type,
    severity: risk.severity,
    occurredAt: risk.triggeredAt.toISOString(),
  }));
}

function readRiskSupportFactIds(risk: RiskFlag): string[] {
  return Array.isArray(risk.evidence.supportFactIds)
    ? risk.evidence.supportFactIds.filter((value): value is string => typeof value === 'string').sort()
    : [];
}

function readStoredRiskSupport(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').sort();
  }
  if (!isRecord(value) || !Array.isArray(value.factIds)) return [];
  return value.factIds.filter((item): item is string => typeof item === 'string').sort();
}

function readStoredMetricDigest(value: unknown): string {
  return isRecord(value) && typeof value.metricDigest === 'string'
    ? value.metricDigest
    : '';
}

function riskMetricDigest(risk: RiskFlag): string {
  const { supportFactIds: _supportFactIds, ...metrics } = risk.evidence;
  return hashJson(metrics);
}

function selectRiskSourceTransition(input: {
  transitions: LearnerFactTransitionRow[];
  newTransitions: LearnerFactTransitionRow[];
  supportFactIds: string[];
  clearing: boolean;
}): LearnerFactTransitionRow | null {
  const clearing = input.clearing
    ? input.newTransitions.filter((transition) =>
        transition.operation === 'CORRECT' || transition.operation === 'REVOKE')
    : [];
  if (clearing.length > 0) return latestTransition(clearing);
  const supporting = input.transitions.filter((transition) =>
    input.supportFactIds.includes(transition.factId));
  return latestTransition(supporting) ??
    latestTransition(input.newTransitions) ??
    latestTransition(input.transitions);
}

function latestTransition(transitions: LearnerFactTransitionRow[]): LearnerFactTransitionRow | null {
  return transitions.reduce<LearnerFactTransitionRow | null>((latest, transition) =>
    !latest || transition.sequence > latest.sequence ? transition : latest, null);
}

function toRiskEnum(type: CumulativeRiskType): EvidenceRiskStateRow['riskType'] {
  if (type === 'constraint') return 'CONSTRAINT';
  if (type === 'stagnation') return 'STAGNATION';
  return 'CROSS_DOMAIN';
}

function fromRiskEnum(type: EvidenceRiskStateRow['riskType']): CumulativeRiskType {
  if (type === 'CONSTRAINT') return 'constraint';
  if (type === 'STAGNATION') return 'stagnation';
  return 'cross_domain';
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function readGrowthFactHashes(value: unknown): string[] {
  return isRecord(value) && Array.isArray(value.factHashes)
    ? value.factHashes.filter((item): item is string => typeof item === 'string')
    : [];
}

function hashIdentity(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function buildTrustedInputDigest(input: {
  policyVersion: string;
  calculationVersion: string;
  stateWatermark: bigint;
  factIds: string[];
}): string {
  return hashJson({
    policyVersion: input.policyVersion,
    calculationVersion: input.calculationVersion,
    stateWatermark: input.stateWatermark.toString(),
    factIds: input.factIds,
  });
}

function stableJson(value: unknown): string {
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function materializeLegacyCompatibleSnapshot(
  db: PortraitV2MaterializationDb,
  userId: string,
  facts: PortraitLearningFactDelta[],
  now: Date,
  dryRun: boolean,
): Promise<PortraitV2MaterializationResult> {
  const mapped = mapLearningFactsToPortraitEvidence(facts);
  const evidence = mapped.evidence.filter(isPortraitV2ProfileEvidence);
  if (evidence.length === 0 || dryRun) {
    return {
      written: evidence.length > 0,
      evidenceCount: evidence.length,
      affectedDimensions: [],
      mappingIssues: mapped.mappingIssues,
    };
  }
  const evidenceAt = facts.at(-1)?.startedAt ?? now;
  const updated = updatePortraitV2Incrementally({
    userId,
    previous: null,
    evidence,
    generatedAt: evidenceAt,
  });
  const persisted = await writePortraitV2Snapshot(db, updated.payload, { now });
  return {
    written: true,
    snapshotId: persisted.id,
    evidenceCount: evidence.length,
    affectedDimensions: updated.affectedDimensions,
    mappingIssues: [...mapped.mappingIssues, ...updated.mappingIssues],
  };
}

function readCurrentPayload(current: CurrentStateRow | null): PortraitV2PayloadShape | null {
  const payload = current?.stateVersion.snapshot?.payload;
  return payload && typeof payload === 'object' ? payload as PortraitV2PayloadShape : null;
}
