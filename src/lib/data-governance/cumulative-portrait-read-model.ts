import { createHash } from 'node:crypto';

import {
  PORTRAIT_V2_CALCULATION_VERSION,
  projectPortraitV2ForConsumer,
  summarizeCumulativePortraitV2,
  validatePortraitV2Payload,
  type PortraitV2Payload,
  type PortraitV2Consumer,
  type PortraitV2ProjectedPayload,
} from './portrait-v2-model';
import {
  PORTRAIT_V2_DIMENSION_IDS,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';
import {
  CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
  type CumulativeClassPortraitProjection,
} from './cumulative-class-materialization';
import {
  computeSimulationTaskCatalogDigest,
  SIMULATION_TASK_PORTRAIT_CALCULATION_VERSION,
} from './simulation-task-portrait-projection';

export type CumulativePortraitAvailabilityReason =
  | 'available'
  | 'no-eligible-evidence'
  | 'no-evidence-after-revocation'
  | 'migration-in-progress'
  | 'reconciliation-pending'
  | 'current-state-unavailable'
  | 'current-state-version-mismatch'
  | 'invalid-current-snapshot';

interface CutoverFenceRow {
  fence: bigint;
  calculationVersion: string;
  learnerGeneration: bigint;
  queueGeneration: bigint;
  activeMigrationRunId: string | null;
}

interface CurrentPortraitStateRow {
  userId: string;
  stateVersionId: string;
  calculationVersion: string;
  generation: bigint;
  queueGeneration: bigint;
  stateWatermark: bigint;
  taskInputDigest?: string;
  cutoverFence: bigint;
  stateVersion: {
    id: string;
    userId: string;
    calculationVersion: string;
    generation: bigint;
    queueGeneration: bigint;
    stateWatermark: bigint;
    taskInputDigest?: string;
    stateKind: 'SNAPSHOT' | 'NO_EVIDENCE';
    snapshotId: string | null;
    overallScore: number | null;
    dimensionCoverage: unknown;
    evidenceAsOf: Date | null;
    confidence: number | null;
    lastTrend: string | null;
    lastRisk: unknown;
    availabilityReason: string;
    generatedAt: Date;
    cutoverFence: bigint;
    migrationRunId: string | null;
    snapshot: {
      id: string;
      userId: string;
      snapshotAt: Date;
      payloadVersion: string;
      calculationVersion: string;
      migrationVersion: string;
      derivationKind: string;
      payload: unknown;
    } | null;
  };
}

export interface CumulativePortraitReadDb {
  cumulativePortraitCutoverFence: {
    findUnique: (args: any) => PromiseLike<CutoverFenceRow | null>;
  };
  cumulativePortraitMigrationRun: {
    findUnique: (args: any) => PromiseLike<{
      id: string;
      mode: 'DRY_RUN' | 'APPLY';
      status: 'PLANNED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
      calculationVersion: string;
      learnerGeneration: bigint;
      queueGeneration: bigint;
      cutoverFence: bigint;
    } | null>;
  };
  learnerPortraitCurrentState: {
    findUnique: (args: any) => PromiseLike<CurrentPortraitStateRow | null>;
  };
  learningMaterializationRebuildRequest?: {
    findFirst: (args: any) => PromiseLike<{ userId: string } | null>;
  };
  learnerFactTransitionSequence?: {
    findUnique: (args: any) => PromiseLike<{ lastSequence: bigint } | null>;
  };
}

interface CurrentClassPortraitStateRow {
  classId: string;
  versionId: string;
  materializationVersion: string;
  calculationVersion: string;
  generation: bigint;
  queueGeneration: bigint;
  migrationRunId: string;
  inputDigest: string;
  cutoverFence: bigint;
  version: {
    id: string;
    classId: string;
    materializationVersion: string;
    calculationVersion: string;
    generation: bigint;
    queueGeneration: bigint;
    migrationRunId: string;
    inputDigest: string;
    memberSetDigest: string;
    sourcePortraitVersions: unknown;
    evidenceAsOf: Date | null;
    aggregateJson: unknown;
    dimensionCoverage: unknown;
    trendDistribution: unknown;
    riskDistribution: unknown;
    diagnosis: unknown;
    activeStudentCount: number;
    totalStudentCount: number;
    cutoverFence: bigint;
    generatedAt: Date;
  };
}

export interface CumulativeClassPortraitReadDb {
  studentProfile: {
    findMany: (args: any) => PromiseLike<Array<{ userId: string }>>;
  };
  cumulativePortraitCutoverFence: {
    findUnique: (args: any) => PromiseLike<(CutoverFenceRow & {
      classMaterializationVersion: string;
      classGeneration: bigint;
    }) | null>;
  };
  classCumulativePortraitCurrentState: {
    findUnique: (args: any) => PromiseLike<CurrentClassPortraitStateRow | null>;
  };
  cumulativePortraitMigrationRun: {
    findUnique: (args: any) => PromiseLike<{
      id: string;
      mode: 'DRY_RUN' | 'APPLY';
      status: 'PLANNED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
      calculationVersion: string;
      classMaterializationVersion: string;
      learnerGeneration: bigint;
      classGeneration: bigint;
      queueGeneration: bigint;
      cutoverFence: bigint;
    } | null>;
  };
}

export interface CumulativePortraitPublication {
  calculationVersion: string;
  generation: string;
  queueGeneration: string;
  cutoverFence: string;
  stateWatermark: string;
  processingWatermark: string;
  captureRevision: string;
  inputDigest: string | null;
}

export interface CumulativePortraitReadModel {
  stateKind: 'SNAPSHOT' | 'NO_EVIDENCE' | 'UNAVAILABLE';
  payload: PortraitV2ProjectedPayload | null;
  overallScore: number | null;
  dimensionCoverage: {
    evidencedDimensionIds: PortraitV2DimensionId[];
    missingDimensionIds: PortraitV2DimensionId[];
  };
  evidenceAsOf: string | null;
  confidence: number | null;
  lastTrend: 'up' | 'stable' | 'down' | 'not-comparable' | null;
  lastRisk: Array<{
    type: 'constraint' | 'stagnation' | 'cross_domain';
    severity: 'low' | 'medium' | 'high';
    occurredAt: string | null;
  }>;
  availabilityReason: CumulativePortraitAvailabilityReason;
  generatedAt: string | null;
  publication: CumulativePortraitPublication | null;
}

export interface CumulativeClassPortraitReadModel {
  stateKind: 'SNAPSHOT' | 'UNAVAILABLE';
  availabilityReason:
    | 'available'
    | 'migration-in-progress'
    | 'reconciliation-pending'
    | 'current-state-unavailable'
    | 'current-state-version-mismatch'
    | 'invalid-current-snapshot';
  materializationVersion: typeof CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION | null;
  aggregate: CumulativeClassPortraitProjection['aggregate'] | null;
  dimensionCoverage: CumulativeClassPortraitProjection['dimensionCoverage'] | null;
  trendDistribution: CumulativeClassPortraitProjection['trendDistribution'] | null;
  riskDistribution: CumulativeClassPortraitProjection['riskDistribution'] | null;
  diagnosis: CumulativeClassPortraitProjection['diagnosis'] | null;
  evidenceAsOf: string | null;
  generatedAt: string | null;
  activeStudentCount: number;
  totalStudentCount: number;
}

const EMPTY_COVERAGE = {
  evidencedDimensionIds: [],
  missingDimensionIds: [],
};

export async function readCurrentCumulativePortrait(
  database: unknown,
  userId: string,
  consumer: PortraitV2Consumer = 'student',
): Promise<CumulativePortraitReadModel> {
  const db = database as CumulativePortraitReadDb;
  const fence = await db.cumulativePortraitCutoverFence.findUnique({
    where: { id: 'global' },
  });
  if (
    !fence ||
    fence.calculationVersion !== PORTRAIT_V2_CALCULATION_VERSION ||
    !fence.activeMigrationRunId
  ) {
    return unavailable('migration-in-progress');
  }
  const run = await db.cumulativePortraitMigrationRun.findUnique({
    where: { id: fence.activeMigrationRunId },
  });
  if (
    !run ||
    run.mode !== 'APPLY' ||
    run.status !== 'COMPLETED' ||
    run.calculationVersion !== fence.calculationVersion ||
    run.learnerGeneration !== fence.learnerGeneration ||
    run.queueGeneration !== fence.queueGeneration ||
    run.cutoverFence !== fence.fence
  ) {
    return unavailable('migration-in-progress');
  }

  const pendingReconciliation = await db.learningMaterializationRebuildRequest?.findFirst({
    where: {
      userId,
      kind: 'CUMULATIVE_RECONCILIATION',
      migrationRunId: fence.activeMigrationRunId,
      calculationVersion: fence.calculationVersion,
      learnerGeneration: fence.learnerGeneration,
      queueGeneration: fence.queueGeneration,
      cutoverFence: fence.fence,
      status: { in: ['PENDING', 'CLAIMED'] },
    },
    select: { userId: true },
  });
  if (pendingReconciliation) {
    return unavailable('reconciliation-pending');
  }

  const current = await db.learnerPortraitCurrentState.findUnique({
    where: { userId },
    include: {
      stateVersion: {
        include: { snapshot: true },
      },
    },
  });
  if (!current) return unavailable('current-state-unavailable');
  if (!matchesActiveFence(current, fence, userId)) {
    return unavailable('current-state-version-mismatch');
  }

  const processingRow = await db.learnerFactTransitionSequence?.findUnique({
    where: { userId },
    select: { lastSequence: true },
  });
  const publication = publicationFromCurrent(current, processingRow?.lastSequence);

  const state = current.stateVersion;
  const coverage = readCoverage(state.dimensionCoverage);
  const lastTrend = readTrend(state.lastTrend);
  const lastRisk = readSafeRisks(state.lastRisk);
  const generatedAt = toIso(state.generatedAt);
  const evidenceAsOf = toIso(state.evidenceAsOf);

  if (state.stateKind === 'NO_EVIDENCE') {
    return {
      stateKind: 'NO_EVIDENCE',
      payload: null,
      overallScore: null,
      dimensionCoverage: coverage,
      evidenceAsOf,
      confidence: null,
      lastTrend,
      lastRisk,
      availabilityReason: state.availabilityReason === 'no-evidence-after-revocation'
        ? 'no-evidence-after-revocation'
        : 'no-eligible-evidence',
      generatedAt,
      publication,
    };
  }

  const snapshot = state.snapshot;
  if (!snapshot || snapshot.id !== state.snapshotId) {
    return unavailable('invalid-current-snapshot');
  }
  try {
    validatePortraitV2Payload(snapshot.payload);
    const payload = snapshot.payload as PortraitV2Payload;
    if (
      snapshot.userId !== userId ||
      payload.userId !== userId ||
      snapshot.calculationVersion !== PORTRAIT_V2_CALCULATION_VERSION ||
      snapshot.derivationKind !== 'native' ||
      payload.derivation.kind !== 'native' ||
      snapshot.payloadVersion !== payload.payloadVersion ||
      snapshot.migrationVersion !== payload.migrationVersion ||
      toIso(snapshot.snapshotAt) !== payload.generatedAt
    ) {
      return unavailable('invalid-current-snapshot');
    }
    const taskAttainment = payload.dimensions.find((dimension) =>
      dimension.id === 'simulationValidationEvidence')?.taskAttainment;
    if (
      taskAttainment
      && (
        taskAttainment.calculationVersion !== SIMULATION_TASK_PORTRAIT_CALCULATION_VERSION
        || taskAttainment.catalogDigest !== computeSimulationTaskCatalogDigest()
      )
    ) {
      return unavailable('current-state-version-mismatch');
    }
    const projected = projectPortraitV2ForConsumer(payload, consumer);
    const summary = summarizeCumulativePortraitV2(projected);
    return {
      stateKind: 'SNAPSHOT',
      payload: projected,
      overallScore: state.overallScore ?? summary.overallScore,
      dimensionCoverage: coverage,
      evidenceAsOf: evidenceAsOf ?? summary.evidenceAsOf,
      confidence: state.confidence ?? summary.confidence,
      lastTrend,
      lastRisk,
      availabilityReason: 'available',
      generatedAt,
      publication,
    };
  } catch {
    return unavailable('invalid-current-snapshot');
  }
}

export async function readCurrentCumulativeClassPortrait(
  database: unknown,
  classId: string,
): Promise<CumulativeClassPortraitReadModel> {
  const db = database as CumulativeClassPortraitReadDb;
  const fence = await db.cumulativePortraitCutoverFence.findUnique({
    where: { id: 'global' },
  });
  if (
    !fence ||
    fence.calculationVersion !== PORTRAIT_V2_CALCULATION_VERSION ||
    fence.classMaterializationVersion !== CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION ||
    !fence.activeMigrationRunId
  ) {
    return unavailableClass('migration-in-progress');
  }
  const run = await db.cumulativePortraitMigrationRun.findUnique({
    where: { id: fence.activeMigrationRunId },
  });
  if (!run || run.mode !== 'APPLY' || run.status !== 'COMPLETED') {
    return unavailableClass('migration-in-progress');
  }
  if (
    run.calculationVersion !== fence.calculationVersion ||
    run.classMaterializationVersion !== fence.classMaterializationVersion ||
    run.learnerGeneration !== fence.learnerGeneration ||
    run.classGeneration !== fence.classGeneration ||
    run.queueGeneration !== fence.queueGeneration ||
    run.cutoverFence !== fence.fence
  ) {
    return unavailableClass('current-state-version-mismatch');
  }

  const current = await db.classCumulativePortraitCurrentState.findUnique({
    where: { classId },
    include: { version: true },
  });
  if (!current) return unavailableClass('current-state-unavailable');
  if (!matchesActiveClassFence(current, fence, classId)) {
    return unavailableClass('current-state-version-mismatch');
  }

  const version = current.version;
  if (!isValidClassProjection(version)) {
    return unavailableClass('invalid-current-snapshot');
  }
  const currentMemberIds = (await db.studentProfile.findMany({
    where: { classId },
    select: { userId: true },
    orderBy: { userId: 'asc' },
  })).map(({ userId }) => userId).sort();
  if (digestClassMemberSet(currentMemberIds) !== version.memberSetDigest) {
    return unavailableClass('reconciliation-pending');
  }
  return {
    stateKind: 'SNAPSHOT',
    availabilityReason: 'available',
    materializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
    aggregate: version.aggregateJson as CumulativeClassPortraitProjection['aggregate'],
    dimensionCoverage: version.dimensionCoverage as CumulativeClassPortraitProjection['dimensionCoverage'],
    trendDistribution: version.trendDistribution as CumulativeClassPortraitProjection['trendDistribution'],
    riskDistribution: sanitizeClassRiskDistribution(version.riskDistribution),
    diagnosis: version.diagnosis as CumulativeClassPortraitProjection['diagnosis'],
    evidenceAsOf: toIso(version.evidenceAsOf),
    generatedAt: toIso(version.generatedAt),
    activeStudentCount: version.activeStudentCount,
    totalStudentCount: version.totalStudentCount,
  };
}

function digestClassMemberSet(memberIds: string[]): string {
  return createHash('sha256').update(JSON.stringify(memberIds)).digest('hex');
}

function matchesActiveFence(
  current: CurrentPortraitStateRow,
  fence: CutoverFenceRow,
  userId: string,
): boolean {
  const state = current.stateVersion;
  return current.userId === userId &&
    current.stateVersionId === state.id &&
    current.calculationVersion === fence.calculationVersion &&
    current.generation === fence.learnerGeneration &&
    current.queueGeneration === fence.queueGeneration &&
    current.cutoverFence === fence.fence &&
    state.userId === userId &&
    state.calculationVersion === fence.calculationVersion &&
    state.generation === fence.learnerGeneration &&
    state.queueGeneration === fence.queueGeneration &&
    state.cutoverFence === fence.fence &&
    state.migrationRunId === fence.activeMigrationRunId &&
    state.stateWatermark === current.stateWatermark &&
    (state.taskInputDigest ?? '') === (current.taskInputDigest ?? '');
}

function matchesActiveClassFence(
  current: CurrentClassPortraitStateRow,
  fence: CutoverFenceRow & {
    classMaterializationVersion: string;
    classGeneration: bigint;
  },
  classId: string,
): boolean {
  const version = current.version;
  return current.classId === classId &&
    current.versionId === version.id &&
    current.materializationVersion === CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION &&
    current.materializationVersion === fence.classMaterializationVersion &&
    current.calculationVersion === fence.calculationVersion &&
    current.generation === fence.classGeneration &&
    current.queueGeneration === fence.queueGeneration &&
    current.migrationRunId === fence.activeMigrationRunId &&
    current.cutoverFence === fence.fence &&
    version.classId === classId &&
    version.materializationVersion === current.materializationVersion &&
    version.calculationVersion === current.calculationVersion &&
    version.generation === current.generation &&
    version.queueGeneration === current.queueGeneration &&
    version.migrationRunId === current.migrationRunId &&
    version.inputDigest === current.inputDigest &&
    version.cutoverFence === current.cutoverFence;
}

function publicationFromCurrent(
  current: CurrentPortraitStateRow,
  processingSequence?: bigint | null,
): CumulativePortraitPublication {
  return {
    calculationVersion: current.calculationVersion,
    generation: String(current.generation),
    queueGeneration: String(current.queueGeneration),
    cutoverFence: String(current.cutoverFence),
    stateWatermark: String(current.stateWatermark),
    processingWatermark: String(processingSequence ?? current.stateWatermark),
    captureRevision: current.stateVersion.id,
    inputDigest: current.taskInputDigest || current.stateVersion.taskInputDigest || null,
  };
}

function unavailable(
  availabilityReason: Extract<
    CumulativePortraitAvailabilityReason,
    'migration-in-progress' | 'reconciliation-pending' | 'current-state-unavailable' | 'current-state-version-mismatch' | 'invalid-current-snapshot'
  >,
): CumulativePortraitReadModel {
  return {
    stateKind: 'UNAVAILABLE',
    payload: null,
    overallScore: null,
    dimensionCoverage: EMPTY_COVERAGE,
    evidenceAsOf: null,
    confidence: null,
    lastTrend: null,
    lastRisk: [],
    availabilityReason,
    generatedAt: null,
    publication: null,
  };
}

function unavailableClass(
  availabilityReason: Exclude<CumulativeClassPortraitReadModel['availabilityReason'], 'available'>,
): CumulativeClassPortraitReadModel {
  return {
    stateKind: 'UNAVAILABLE',
    availabilityReason,
    materializationVersion: null,
    aggregate: null,
    dimensionCoverage: null,
    trendDistribution: null,
    riskDistribution: null,
    diagnosis: null,
    evidenceAsOf: null,
    generatedAt: null,
    activeStudentCount: 0,
    totalStudentCount: 0,
  };
}

function isValidClassProjection(
  version: CurrentClassPortraitStateRow['version'],
): boolean {
  return isAggregate(version.aggregateJson) &&
    isDimensionCoverage(version.dimensionCoverage) &&
    isTrendDistribution(version.trendDistribution) &&
    isRiskDistribution(version.riskDistribution) &&
    isDiagnosis(version.diagnosis) &&
    Number.isInteger(version.activeStudentCount) &&
    version.activeStudentCount >= 0 &&
    Number.isInteger(version.totalStudentCount) &&
    version.totalStudentCount >= version.activeStudentCount;
}

function isAggregate(value: unknown): boolean {
  if (!isRecord(value) || !isDimensionAggregate(value.overall)) {
    return false;
  }
  const dimensions = value.dimensions;
  if (!isRecord(dimensions)) return false;
  return PORTRAIT_V2_DIMENSION_IDS.every((id) => {
    const dimension = dimensions[id];
    return isRecord(dimension) &&
      typeof dimension.label === 'string' &&
      isDimensionAggregate(dimension);
  });
}

function isDimensionCoverage(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.totalMembers) ||
    !isNonNegativeInteger(value.portraitMembers) ||
    !isNonNegativeInteger(value.missingPortraitMembers) ||
    !isCoverageEntry(value.overall)
  ) return false;
  const dimensions = value.dimensions;
  return isRecord(dimensions) &&
    PORTRAIT_V2_DIMENSION_IDS.every((id) => isCoverageEntry(dimensions[id]));
}

function isTrendDistribution(value: unknown): boolean {
  return isRecord(value) &&
    ['up', 'stable', 'down', 'not-comparable'].every((key) => isNonNegativeInteger(value[key]));
}

function isRiskDistribution(value: unknown): boolean {
  return isRecord(value) &&
    isNonNegativeInteger(value.membersWithRisk) &&
    isNonNegativeInteger(value.membersWithoutRisk) &&
    isRecord(value.byType) &&
    isRecord(value.bySeverity) &&
    Object.values(value.byType).every(isNonNegativeInteger) &&
    Object.values(value.bySeverity).every(isNonNegativeInteger);
}

function isDiagnosis(value: unknown): boolean {
  return isRecord(value) &&
    isDimensionIdArray(value.strengths) &&
    isDimensionIdArray(value.improvementClusters) &&
    Array.isArray(value.limitations) &&
    value.limitations.every((item) => typeof item === 'string');
}

function isDimensionAggregate(value: unknown): boolean {
  return isRecord(value) &&
    (value.mean === null || isFiniteNumber(value.mean)) &&
    (value.meanConfidence === null || isFiniteNumber(value.meanConfidence)) &&
    isNonNegativeInteger(value.includedCount) &&
    isNonNegativeInteger(value.missingCount);
}

function isCoverageEntry(value: unknown): boolean {
  return isRecord(value) &&
    isNonNegativeInteger(value.includedCount) &&
    isNonNegativeInteger(value.missingCount) &&
    (value.meanConfidence === null || isFiniteNumber(value.meanConfidence));
}

function sanitizeClassRiskDistribution(
  value: unknown,
): CumulativeClassPortraitProjection['riskDistribution'] {
  const distribution = value as CumulativeClassPortraitProjection['riskDistribution'];
  return {
    membersWithRisk: distribution.membersWithRisk,
    membersWithoutRisk: distribution.membersWithoutRisk,
    byType: Object.fromEntries(Object.entries(distribution.byType).filter(([type]) =>
      type === 'constraint' || type === 'stagnation' || type === 'cross_domain')),
    bySeverity: { ...distribution.bySeverity },
  };
}

function isDimensionIdArray(value: unknown): boolean {
  const allowed = new Set<string>(PORTRAIT_V2_DIMENSION_IDS);
  return Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && allowed.has(item));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readCoverage(value: unknown): CumulativePortraitReadModel['dimensionCoverage'] {
  if (!isRecord(value)) return EMPTY_COVERAGE;
  return {
    evidencedDimensionIds: readDimensionIds(value.evidencedDimensionIds),
    missingDimensionIds: readDimensionIds(value.missingDimensionIds),
  };
}

function readTrend(value: unknown): CumulativePortraitReadModel['lastTrend'] {
  return value === 'up' || value === 'stable' || value === 'down' || value === 'not-comparable'
    ? value
    : null;
}

function readSafeRisks(value: unknown): CumulativePortraitReadModel['lastRisk'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const type = item.type;
    const severity = item.severity;
    if (
      (type !== 'constraint' && type !== 'stagnation' && type !== 'cross_domain') ||
      (severity !== 'low' && severity !== 'medium' && severity !== 'high')
    ) {
      return [];
    }
    return [{
      type,
      severity,
      occurredAt: typeof item.occurredAt === 'string' && Number.isFinite(Date.parse(item.occurredAt))
        ? new Date(item.occurredAt).toISOString()
        : null,
    }];
  });
}

function readDimensionIds(value: unknown): PortraitV2DimensionId[] {
  const allowed = new Set<string>(PORTRAIT_V2_DIMENSION_IDS);
  return Array.isArray(value)
    ? value.filter((item): item is PortraitV2DimensionId =>
        typeof item === 'string' && allowed.has(item))
    : [];
}

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
