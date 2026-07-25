import { createHash } from 'node:crypto';

import {
  PORTRAIT_V2_DIMENSION_IDS,
  PORTRAIT_V2_DIMENSIONS,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';
import type { PortraitV2PayloadShape } from './portrait-v2-model';
import {
  computeSimulationTaskCatalogDigest,
  SIMULATION_TASK_PORTRAIT_CALCULATION_VERSION,
} from './simulation-task-portrait-projection';

export const CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION =
  'class-competency.cumulative.v2';

interface ClassPublicationFence {
  fence: bigint;
  calculationVersion: string;
  learnerGeneration: bigint;
  classMaterializationVersion: string;
  classGeneration: bigint;
  queueGeneration: bigint;
  activeMigrationRunId: string | null;
}

interface MigrationRun {
  id: string;
  mode: 'DRY_RUN' | 'APPLY';
  calculationVersion: string;
  classMaterializationVersion: string;
  learnerGeneration: bigint;
  classGeneration: bigint;
  queueGeneration: bigint;
  cutoverFence: bigint;
}

interface LearnerCurrentState {
  userId: string;
  stateVersionId: string;
  calculationVersion: string;
  generation: bigint;
  queueGeneration: bigint;
  cutoverFence: bigint;
  stateVersion: {
    id: string;
    stateKind: 'SNAPSHOT' | 'NO_EVIDENCE';
    evidenceAsOf: Date | null;
    lastTrend: string | null;
    lastRisk: unknown;
    snapshot: {
      derivationKind: string;
      payload: unknown;
    } | null;
  };
}

interface EvidenceRiskState {
  id: string;
  userId: string;
  riskKey: string;
  riskType: 'CONSTRAINT' | 'STAGNATION' | 'CROSS_DOMAIN';
  severity: string;
  isActive: boolean;
  sourceTransitionSequence: bigint;
}

export interface CumulativeClassMaterializationDb {
  studentProfile: {
    findMany: (args: Record<string, unknown>) => Promise<Array<{ userId: string }>>;
  };
  learningFact: {
    findMany: (args: Record<string, unknown>) => Promise<Array<{ userId: string }>>;
  };
  cumulativePortraitCutoverFence: {
    findUnique: (args: Record<string, unknown>) => Promise<ClassPublicationFence | null>;
  };
  cumulativePortraitMigrationRun: {
    findUnique: (args: Record<string, unknown>) => Promise<MigrationRun | null>;
  };
  learnerPortraitCurrentState: {
    findMany: (args: Record<string, unknown>) => Promise<LearnerCurrentState[]>;
  };
  learnerEvidenceRiskState?: {
    findMany: (args: Record<string, unknown>) => Promise<EvidenceRiskState[]>;
  };
  classCumulativePortraitCurrentState: {
    findUnique: (args: Record<string, unknown>) => Promise<{
      versionId: string;
      materializationVersion: string;
      calculationVersion: string;
      generation: bigint;
      queueGeneration: bigint;
      migrationRunId: string;
      inputDigest: string;
      cutoverFence: bigint;
    } | null>;
    upsert: (args: Record<string, unknown>) => Promise<unknown>;
  };
  classCumulativePortraitVersion: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  $transaction: (
    callback: (tx: CumulativeClassMaterializationDb) => Promise<unknown>,
    options?: { timeout?: number; isolationLevel?: 'Serializable' },
  ) => Promise<unknown>;
}

export interface CumulativeClassPublicationExpectation {
  calculationVersion: string;
  learnerGeneration: bigint;
  generation: bigint;
  cutoverFence: bigint;
  queueGeneration: bigint;
  migrationRunId: string;
  materializationVersion?: typeof CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION;
}

interface DimensionAggregate {
  mean: number | null;
  meanConfidence: number | null;
  includedCount: number;
  missingCount: number;
}

export interface CumulativeClassPortraitProjection {
  aggregate: {
    overall: DimensionAggregate;
    dimensions: Record<PortraitV2DimensionId, DimensionAggregate & { label: string }>;
    taskAttainment: {
      meanRatio: number | null;
      meanScore: number | null;
      usableMemberCount: number;
      rosterTotal: number;
      missingMemberCount: number;
      relatedTaskCount: number | null;
      calculationVersion: string | null;
      limitations: string[];
    };
  };
  dimensionCoverage: {
    totalMembers: number;
    portraitMembers: number;
    missingPortraitMembers: number;
    overall: Pick<DimensionAggregate, 'includedCount' | 'missingCount' | 'meanConfidence'>;
    dimensions: Record<
      PortraitV2DimensionId,
      Pick<DimensionAggregate, 'includedCount' | 'missingCount' | 'meanConfidence'>
    >;
  };
  trendDistribution: Record<'up' | 'stable' | 'down' | 'not-comparable', number>;
  riskDistribution: {
    membersWithRisk: number;
    membersWithoutRisk: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  diagnosis: {
    strengths: PortraitV2DimensionId[];
    improvementClusters: PortraitV2DimensionId[];
    limitations: string[];
  };
  evidenceAsOf: Date | null;
  sourcePortraitVersions: Array<{ userId: string; stateVersionId: string }>;
  memberSetDigest: string;
  inputDigest: string;
  activeStudentCount: number;
  totalStudentCount: number;
}

export interface CumulativeClassMaterializationResult {
  written: boolean;
  versionId: string;
  inputDigest: string;
  memberSetDigest: string;
  activeStudentCount: number;
  totalStudentCount: number;
}

interface CanonicalRisk {
  id: string;
  userId: string;
  type: 'constraint' | 'stagnation' | 'cross_domain';
  severity: string;
}

interface ClassInput {
  expectation: Required<CumulativeClassPublicationExpectation>;
  members: string[];
  states: LearnerCurrentState[];
  risks: CanonicalRisk[];
}

const TRANSACTION_TIMEOUT_MS = 120_000;
const CUMULATIVE_RISK_TYPES = new Set(['constraint', 'stagnation', 'cross_domain']);
const CUMULATIVE_RISK_ENUMS = ['CONSTRAINT', 'STAGNATION', 'CROSS_DOMAIN'] as const;

export async function materializeCumulativeClassPortrait(
  db: CumulativeClassMaterializationDb,
  classId: string,
  options: {
    now?: Date;
    publication?: CumulativeClassPublicationExpectation;
  } = {},
): Promise<CumulativeClassMaterializationResult> {
  return db.$transaction(async (tx) => {
    const initial = await readClassInput(tx, classId, options.publication);
    const projection = buildCumulativeClassPortraitProjection(classId, initial);
    const current = await tx.classCumulativePortraitCurrentState.findUnique({
      where: { classId },
      select: {
        versionId: true,
        materializationVersion: true,
        calculationVersion: true,
        generation: true,
        queueGeneration: true,
        migrationRunId: true,
        inputDigest: true,
        cutoverFence: true,
      },
    });
    if (isSamePublication(current, initial.expectation, projection.inputDigest)) {
      return result(false, current!.versionId, projection);
    }

    const revalidated = await readClassInput(tx, classId, initial.expectation);
    const revalidatedProjection = buildCumulativeClassPortraitProjection(classId, revalidated);
    if (
      projection.inputDigest !== revalidatedProjection.inputDigest ||
      projection.memberSetDigest !== revalidatedProjection.memberSetDigest
    ) {
      throw new Error('Cumulative class portrait input changed before publication.');
    }

    const generatedAt = options.now ?? new Date();
    const version = await tx.classCumulativePortraitVersion.create({
      data: {
        classId,
        materializationVersion: initial.expectation.materializationVersion,
        calculationVersion: initial.expectation.calculationVersion,
        generation: initial.expectation.generation,
        queueGeneration: initial.expectation.queueGeneration,
        migrationRunId: initial.expectation.migrationRunId,
        inputDigest: projection.inputDigest,
        memberSetDigest: projection.memberSetDigest,
        sourcePortraitVersions: projection.sourcePortraitVersions,
        evidenceAsOf: projection.evidenceAsOf,
        aggregateJson: projection.aggregate,
        dimensionCoverage: projection.dimensionCoverage,
        trendDistribution: projection.trendDistribution,
        riskDistribution: projection.riskDistribution,
        diagnosis: projection.diagnosis,
        activeStudentCount: projection.activeStudentCount,
        totalStudentCount: projection.totalStudentCount,
        cutoverFence: initial.expectation.cutoverFence,
        generatedAt,
      },
    });
    await tx.classCumulativePortraitCurrentState.upsert({
      where: { classId },
      create: currentPointer(classId, version.id, initial.expectation, projection.inputDigest),
      update: currentPointer(classId, version.id, initial.expectation, projection.inputDigest),
    });
    return result(true, version.id, projection);
  }, {
    timeout: TRANSACTION_TIMEOUT_MS,
    isolationLevel: 'Serializable',
  }) as Promise<CumulativeClassMaterializationResult>;
}

export function buildCumulativeClassPortraitProjection(
  classId: string,
  input: ClassInput,
): CumulativeClassPortraitProjection {
  const statesByUser = new Map(input.states.map((state) => [state.userId, state]));
  const portraits = input.members.flatMap((userId) => {
    const state = statesByUser.get(userId);
    const payload = readNativePayload(state);
    return state && payload ? [{ userId, state, payload }] : [];
  });
  const currentCatalogDigest = computeSimulationTaskCatalogDigest();
  const isCurrentTaskProjection = (payload: PortraitV2PayloadShape): boolean => {
    const taskAttainment = payload.dimensions.find((dimension) =>
      dimension.id === 'simulationValidationEvidence')?.taskAttainment;
    return taskAttainment?.state === 'EVIDENCE'
      && taskAttainment.relatedTaskCount > 0
      && taskAttainment.calculationVersion === SIMULATION_TASK_PORTRAIT_CALCULATION_VERSION
      && taskAttainment.catalogDigest === currentCatalogDigest;
  };
  const dimensions = Object.fromEntries(PORTRAIT_V2_DIMENSION_IDS.map((id) => {
    const values = portraits.flatMap(({ payload }) => {
      const dimension = payload.dimensions.find((item) =>
        item.id === id && item.evidenceSummary.totalCount > 0);
      return dimension
        && (id !== 'simulationValidationEvidence' || isCurrentTaskProjection(payload))
        ? [{ score: dimension.score, confidence: dimension.confidence }]
        : [];
    });
    return [id, {
      label: PORTRAIT_V2_DIMENSIONS.find((dimension) => dimension.id === id)?.label ?? id,
      mean: average(values.map((value) => value.score)),
      meanConfidence: average(values.map((value) => value.confidence)),
      includedCount: values.length,
      missingCount: input.members.length - values.length,
    }];
  })) as CumulativeClassPortraitProjection['aggregate']['dimensions'];
  const memberOverall = portraits.flatMap(({ payload }) => {
    const evidenced = payload.dimensions.filter((dimension) =>
      dimension.evidenceSummary.totalCount > 0
      && (
        dimension.id !== 'simulationValidationEvidence'
        || isCurrentTaskProjection(payload)
      ));
    const score = average(evidenced.map((dimension) => dimension.score));
    return score === null ? [] : [{
      score,
      confidence: average(evidenced.map((dimension) => dimension.confidence)),
    }];
  });
  const overall: DimensionAggregate = {
    mean: average(memberOverall.map((member) => member.score)),
    meanConfidence: average(memberOverall.flatMap((member) =>
      member.confidence === null ? [] : [member.confidence])),
    includedCount: memberOverall.length,
    missingCount: input.members.length - memberOverall.length,
  };
  const taskProjections = portraits.flatMap(({ payload }) => {
    const taskAttainment = payload.dimensions.find((dimension) =>
      dimension.id === 'simulationValidationEvidence')?.taskAttainment;
    return taskAttainment && isCurrentTaskProjection(payload)
      ? [taskAttainment]
      : [];
  });
  const taskRatios = taskProjections.map((projection) =>
    projection.completedTaskCount / projection.relatedTaskCount);
  const relatedTaskCounts = [...new Set(taskProjections.map((projection) =>
    projection.relatedTaskCount))];
  const taskAttainment = {
    meanRatio: average(taskRatios),
    meanScore: average(taskRatios.map((ratio) => ratio * 100)),
    usableMemberCount: taskProjections.length,
    rosterTotal: input.members.length,
    missingMemberCount: input.members.length - taskProjections.length,
    relatedTaskCount: relatedTaskCounts.length === 1 ? relatedTaskCounts[0] : null,
    calculationVersion: taskProjections[0]?.calculationVersion ?? null,
    limitations: [
      ...(taskProjections.length === 0 ? ['no-current-member-task-attainment'] : []),
      ...(relatedTaskCounts.length > 1 ? ['inconsistent-current-task-catalog-denominator'] : []),
      'missing-member-task-attainment-is-not-zero',
    ],
  };
  const trendDistribution = {
    up: 0,
    stable: 0,
    down: 0,
    'not-comparable': 0,
  };
  for (const userId of input.members) {
    const state = statesByUser.get(userId);
    const trend = readNativePayload(state) && isTrend(state?.stateVersion.lastTrend)
      ? state!.stateVersion.lastTrend
      : 'not-comparable';
    trendDistribution[trend]++;
  }
  const risksByUser = new Set(input.risks.map((risk) => risk.userId));
  const riskDistribution = {
    membersWithRisk: risksByUser.size,
    membersWithoutRisk: input.members.length - risksByUser.size,
    byType: countBy(input.risks.map((risk) => risk.type)),
    bySeverity: countBy(input.risks.map((risk) => risk.severity)),
  };
  const ranked = PORTRAIT_V2_DIMENSION_IDS
    .filter((id) => dimensions[id].mean !== null)
    .sort((left, right) => dimensions[right].mean! - dimensions[left].mean!);
  const strengthCount = Math.min(2, Math.ceil(ranked.length / 2));
  const improvementCount = Math.min(2, Math.floor(ranked.length / 2));
  const sourcePortraitVersions = portraits
    .map(({ userId, state }) => ({ userId, stateVersionId: state.stateVersionId }))
    .sort((left, right) => left.userId.localeCompare(right.userId));
  const evidenceTimes = portraits.flatMap(({ state, payload }) => [
    state.stateVersion.evidenceAsOf,
    ...payload.dimensions.flatMap((dimension) =>
      dimension.evidenceSummary.totalCount > 0 && dimension.freshness.asOf
        ? [new Date(dimension.freshness.asOf)]
        : []),
  ].filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime())));
  const memberSetDigest = digest(input.members);
  const inputDigest = digest({
    classId,
    expectation: serializeExpectation(input.expectation),
    members: input.members,
    sourcePortraitVersions,
    risks: input.risks,
  });
  return {
    aggregate: { overall, dimensions, taskAttainment },
    dimensionCoverage: {
      totalMembers: input.members.length,
      portraitMembers: portraits.length,
      missingPortraitMembers: input.members.length - portraits.length,
      overall: coverage(overall),
      dimensions: Object.fromEntries(PORTRAIT_V2_DIMENSION_IDS.map((id) =>
        [id, coverage(dimensions[id])])) as CumulativeClassPortraitProjection['dimensionCoverage']['dimensions'],
    },
    trendDistribution,
    riskDistribution,
    diagnosis: {
      strengths: ranked.slice(0, strengthCount),
      improvementClusters: improvementCount > 0 ? ranked.slice(-improvementCount) : [],
      limitations: portraits.length === 0 ? ['no-current-member-portrait-evidence'] : [],
    },
    evidenceAsOf: evidenceTimes.length === 0
      ? null
      : new Date(Math.max(...evidenceTimes.map((value) => value.getTime()))),
    sourcePortraitVersions,
    memberSetDigest,
    inputDigest,
    activeStudentCount: portraits.length,
    totalStudentCount: input.members.length,
  };
}

async function readClassInput(
  db: CumulativeClassMaterializationDb,
  classId: string,
  requested?: CumulativeClassPublicationExpectation,
): Promise<ClassInput> {
  const fence = await db.cumulativePortraitCutoverFence.findUnique({
    where: { id: 'global' },
  });
  const expectation = validateFence(fence, requested);
  const run = await db.cumulativePortraitMigrationRun.findUnique({
    where: { id: expectation.migrationRunId },
  });
  validateRun(run, expectation);
  const members = (await db.studentProfile.findMany({
    where: { classId },
    select: { userId: true },
    orderBy: { userId: 'asc' },
  })).map((row) => row.userId).sort();
  const states = members.length === 0 ? [] : await db.learnerPortraitCurrentState.findMany({
    where: {
      userId: { in: members },
      calculationVersion: expectation.calculationVersion,
      generation: expectation.learnerGeneration,
      queueGeneration: expectation.queueGeneration,
      cutoverFence: expectation.cutoverFence,
    },
    select: {
      userId: true,
      stateVersionId: true,
      calculationVersion: true,
      generation: true,
      queueGeneration: true,
      cutoverFence: true,
      stateVersion: {
        select: {
          id: true,
          stateKind: true,
          evidenceAsOf: true,
          lastTrend: true,
          lastRisk: true,
          snapshot: { select: { derivationKind: true, payload: true } },
        },
      },
    },
  });
  const membersWithFacts = members.length === 0 ? [] : await db.learningFact.findMany({
    where: { userId: { in: members } },
    select: { userId: true },
    distinct: ['userId'],
  });
  const stateUsers = new Set(states.map((state) => state.userId));
  const missingFactMemberStates = membersWithFacts
    .map((row) => row.userId)
    .filter((userId) => !stateUsers.has(userId))
    .sort();
  if (missingFactMemberStates.length > 0) {
    throw new Error(
      `Cumulative class portrait has ${missingFactMemberStates.length} fact-bearing member(s) without current learner state.`,
    );
  }
  const riskRows = members.length === 0 || !db.learnerEvidenceRiskState
    ? []
    : await db.learnerEvidenceRiskState.findMany({
        where: {
          userId: { in: members },
          calculationVersion: expectation.calculationVersion,
          stateGeneration: expectation.learnerGeneration,
          riskType: { in: [...CUMULATIVE_RISK_ENUMS] },
        },
        orderBy: [{ sourceTransitionSequence: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          userId: true,
          riskKey: true,
          riskType: true,
          severity: true,
          isActive: true,
          sourceTransitionSequence: true,
        },
      });
  return {
    expectation,
    members,
    states,
    risks: normalizeRisks(members, states, riskRows),
  };
}

function validateFence(
  fence: ClassPublicationFence | null,
  requested?: CumulativeClassPublicationExpectation,
): Required<CumulativeClassPublicationExpectation> {
  if (
    !fence ||
    fence.classMaterializationVersion !== CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION ||
    !fence.activeMigrationRunId
  ) {
    throw new Error('No active cumulative class portrait publication fence is available.');
  }
  const expected = {
    calculationVersion: requested?.calculationVersion ?? fence.calculationVersion,
    learnerGeneration: requested?.learnerGeneration ?? fence.learnerGeneration,
    generation: requested?.generation ?? fence.classGeneration,
    cutoverFence: requested?.cutoverFence ?? fence.fence,
    queueGeneration: requested?.queueGeneration ?? fence.queueGeneration,
    migrationRunId: requested?.migrationRunId ?? fence.activeMigrationRunId,
    materializationVersion: requested?.materializationVersion ??
      CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
  };
  if (
    expected.calculationVersion !== fence.calculationVersion ||
    expected.learnerGeneration !== fence.learnerGeneration ||
    expected.generation !== fence.classGeneration ||
    expected.cutoverFence !== fence.fence ||
    expected.queueGeneration !== fence.queueGeneration ||
    expected.migrationRunId !== fence.activeMigrationRunId ||
    expected.materializationVersion !== fence.classMaterializationVersion
  ) {
    throw new Error('Cumulative class portrait publication fence is stale.');
  }
  return expected;
}

function validateRun(
  run: MigrationRun | null,
  expectation: Required<CumulativeClassPublicationExpectation>,
): void {
  if (
    !run ||
    run.mode !== 'APPLY' ||
    run.calculationVersion !== expectation.calculationVersion ||
    run.classMaterializationVersion !== expectation.materializationVersion ||
    run.learnerGeneration !== expectation.learnerGeneration ||
    run.classGeneration !== expectation.generation ||
    run.queueGeneration !== expectation.queueGeneration ||
    run.cutoverFence !== expectation.cutoverFence
  ) {
    throw new Error('Cumulative class portrait migration run does not match the publication fence.');
  }
}

function readNativePayload(state?: LearnerCurrentState): PortraitV2PayloadShape | null {
  if (
    !state ||
    state.stateVersion.stateKind !== 'SNAPSHOT' ||
    state.stateVersion.snapshot?.derivationKind !== 'native'
  ) return null;
  const payload = state.stateVersion.snapshot.payload;
  if (!isRecord(payload) || !isRecord(payload.derivation) || payload.derivation.kind !== 'native') {
    return null;
  }
  return payload as unknown as PortraitV2PayloadShape;
}

function normalizeRisks(
  members: string[],
  states: LearnerCurrentState[],
  rows: EvidenceRiskState[],
): CanonicalRisk[] {
  const memberSet = new Set(members);
  const latest = new Map<string, EvidenceRiskState>();
  for (const row of rows) {
    const key = `${row.userId}:${row.riskKey}`;
    if (memberSet.has(row.userId) && !latest.has(key)) latest.set(key, row);
  }
  const canonical = [...latest.values()]
    .filter((row) => row.isActive)
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      type: riskTypeKey(row.riskType),
      severity: row.severity,
    }));
  const usersWithEvidenceRiskState = new Set([...latest.values()].map((risk) => risk.userId));
  for (const state of states) {
    if (usersWithEvidenceRiskState.has(state.userId)) continue;
    canonical.push(...readFallbackRisks(state.userId, state.stateVersion.lastRisk));
  }
  return canonical.sort((left, right) =>
    left.userId.localeCompare(right.userId) || left.type.localeCompare(right.type));
}

function riskTypeKey(
  type: EvidenceRiskState['riskType'],
): 'constraint' | 'stagnation' | 'cross_domain' {
  if (type === 'CONSTRAINT') return 'constraint';
  if (type === 'STAGNATION') return 'stagnation';
  return 'cross_domain';
}

function readFallbackRisks(userId: string, value: unknown): CanonicalRisk[] {
  const values = Array.isArray(value) ? value : isRecord(value) ? [value] : [];
  return values.flatMap((item, index) => {
    if (!isRecord(item) || item.isActive === false) return [];
    const type = typeof item.riskType === 'string'
      ? item.riskType
      : typeof item.type === 'string' ? item.type : null;
    if (!isCumulativeRiskKey(type)) return [];
    return [{
      id: `state-last-risk:${userId}:${type}:${index}`,
      userId,
      type,
      severity: typeof item.severity === 'string' ? item.severity : 'unknown',
    }];
  });
}

function isCumulativeRiskKey(
  value: string | null,
): value is CanonicalRisk['type'] {
  return value !== null && CUMULATIVE_RISK_TYPES.has(value);
}

function currentPointer(
  classId: string,
  versionId: string,
  expectation: Required<CumulativeClassPublicationExpectation>,
  inputDigest: string,
) {
  return {
    classId,
    versionId,
    materializationVersion: expectation.materializationVersion,
    calculationVersion: expectation.calculationVersion,
    generation: expectation.generation,
    queueGeneration: expectation.queueGeneration,
    migrationRunId: expectation.migrationRunId,
    inputDigest,
    cutoverFence: expectation.cutoverFence,
  };
}

function isSamePublication(
  current: Awaited<ReturnType<CumulativeClassMaterializationDb['classCumulativePortraitCurrentState']['findUnique']>>,
  expectation: Required<CumulativeClassPublicationExpectation>,
  inputDigest: string,
): boolean {
  return Boolean(
    current &&
    current.materializationVersion === expectation.materializationVersion &&
    current.calculationVersion === expectation.calculationVersion &&
    current.generation === expectation.generation &&
    current.queueGeneration === expectation.queueGeneration &&
    current.migrationRunId === expectation.migrationRunId &&
    current.inputDigest === inputDigest &&
    current.cutoverFence === expectation.cutoverFence
  );
}

function result(
  written: boolean,
  versionId: string,
  projection: CumulativeClassPortraitProjection,
): CumulativeClassMaterializationResult {
  return {
    written,
    versionId,
    inputDigest: projection.inputDigest,
    memberSetDigest: projection.memberSetDigest,
    activeStudentCount: projection.activeStudentCount,
    totalStudentCount: projection.totalStudentCount,
  };
}

function serializeExpectation(expectation: Required<CumulativeClassPublicationExpectation>) {
  return {
    ...expectation,
    learnerGeneration: expectation.learnerGeneration.toString(),
    generation: expectation.generation.toString(),
    cutoverFence: expectation.cutoverFence.toString(),
    queueGeneration: expectation.queueGeneration.toString(),
  };
}

function coverage(value: DimensionAggregate) {
  return {
    includedCount: value.includedCount,
    missingCount: value.missingCount,
    meanConfidence: value.meanConfidence,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isTrend(value: unknown): value is 'up' | 'stable' | 'down' {
  return value === 'up' || value === 'stable' || value === 'down';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
