import type { CompetencyVector } from './competency-model';
import { getProfileEligibleEvidenceSourceIds, type EvidenceSourceId } from './evidence-source-catalog';
import {
  PORTRAIT_V2_DIMENSIONS,
  PORTRAIT_V2_DIMENSION_IDS,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';
import type { SimulationTaskAttainmentProjection } from './simulation-task-portrait-projection';

export { PORTRAIT_V2_DIMENSION_IDS } from './kaq-objective-taxonomy';

export const PORTRAIT_V2_PAYLOAD_VERSION = 'learner-portrait.v2';
export const PORTRAIT_V2_CALCULATION_VERSION = 'portrait-v2-cumulative.v3';
export const PORTRAIT_V2_MIGRATION_VERSION: string = 'portrait-v2-cumulative-migration.v3';
// Compatibility-only thresholds for legacy consumers. Canonical cumulative
// portrait availability is evidence-backed and does not use calendar age.
export const PORTRAIT_V2_FRESHNESS_CURRENT_MAX_AGE_DAYS = 30;
export const PORTRAIT_V2_FRESHNESS_PARTIAL_MAX_AGE_DAYS = 90;
export const PORTRAIT_V2_MAX_FUTURE_SKEW_MS = 0;
export const PORTRAIT_V2_LEGACY_SNAPSHOT_CLOCK_SKEW_MS = 5 * 60 * 1000;
export const PORTRAIT_V2_EVIDENCE_FAMILIES: readonly EvidenceSourceId[] =
  getProfileEligibleEvidenceSourceIds();

const PORTRAIT_V2_PERSISTABLE_BRAND: unique symbol = Symbol('portrait-v2-persistable');
const PORTRAIT_V2_PROJECTED_BRAND: unique symbol = Symbol('portrait-v2-projected');
const PERSISTABLE_PORTRAIT_V2_PAYLOADS = new WeakSet<object>();

export type PortraitV2FreshnessState = 'current' | 'partial' | 'stale' | 'missing';
export type PortraitV2Trend = 'up' | 'stable' | 'down';
export type PortraitV2OverallTrend = PortraitV2Trend | 'not-comparable';
export type PortraitV2DerivationKind = 'native' | 'migrated' | 'compatibility-derived';
export type PortraitV2Consumer = 'student' | 'konling' | 'planner' | 'reviewer' | 'admin';
export type PortraitV2CompatibilitySourceFamily =
  | 'StudentCompetencySnapshot'
  | 'StudentEvidenceFeatureCache';
export type PortraitV2LineagePrivacyScope =
  | 'student-visible'
  | 'teacher-scoped'
  | 'admin-scoped'
  | 'audit-only'
  | 'system-internal';
export type PortraitV2LineageKind =
  | 'evidence-family'
  | 'citation'
  | 'aggregate'
  | 'hashed'
  | 'teacher-scoped'
  | 'private-fixture'
  | 'migration-snapshot'
  | 'raw-source';

export interface PortraitV2SourceLineageRef {
  kind: PortraitV2LineageKind;
  ref: string;
  privacyScope: PortraitV2LineagePrivacyScope;
}

export interface PortraitV2DimensionState {
  id: PortraitV2DimensionId;
  label: string;
  score: number;
  confidence: number;
  trend?: PortraitV2Trend;
  freshness: {
    state: PortraitV2FreshnessState;
    asOf: string | null;
    evidenceAgeDays: number | null;
  };
  evidenceSummary: {
    totalCount: number;
    sourceFamilyCounts: Record<string, number>;
  };
  lastPositiveEvidenceAt: string | null;
  lastNegativeEvidenceAt: string | null;
  rationale: string;
  limitations: string[];
  sourceLineage: PortraitV2SourceLineageRef[];
  calculationVersion: string;
  taskAttainment?: SimulationTaskAttainmentProjection;
}

export interface PortraitV2PayloadShape {
  userId: string;
  payloadVersion: typeof PORTRAIT_V2_PAYLOAD_VERSION;
  migrationVersion: typeof PORTRAIT_V2_MIGRATION_VERSION;
  generatedAt: string;
  derivation: {
    kind: PortraitV2DerivationKind;
    sourceLegacySnapshotId?: string;
    sourceLegacySnapshotAt?: string;
    mappingVersion?: string;
    mappingConfidence?: Partial<Record<PortraitV2DimensionId, 'high' | 'medium' | 'low' | 'none'>>;
    limitations: string[];
  };
  updateCursor?: {
    lastFactCreatedAt: string;
    lastFactId: string;
  };
  dimensions: PortraitV2DimensionState[];
}

export interface PortraitV2CumulativeSummary {
  overallScore: number | null;
  confidence: number | null;
  evidenceAsOf: string | null;
  trend: PortraitV2OverallTrend;
  evidencedDimensionIds: PortraitV2DimensionId[];
  missingDimensionIds: PortraitV2DimensionId[];
}

export type PortraitV2Payload = PortraitV2PayloadShape & {
  readonly [PORTRAIT_V2_PERSISTABLE_BRAND]: true;
};

export type PortraitV2ProjectedPayload = PortraitV2PayloadShape & {
  readonly [PORTRAIT_V2_PROJECTED_BRAND]: true;
};

export interface PortraitV2SnapshotRow {
  id: string;
  userId: string;
  snapshotAt: Date | string;
  payloadVersion: string;
  calculationVersion: string;
  migrationVersion: string;
  derivationKind: string;
  payload: unknown;
}

export interface PortraitV2SnapshotReadDb {
  studentPortraitV2Snapshot?: {
    findFirst?: (args: any) => PromiseLike<unknown | null>;
    findMany?: (args: any) => PromiseLike<unknown[]>;
  };
}

export interface PortraitV2SnapshotWriteDb {
  studentPortraitV2Snapshot?: {
    create?: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

export class PortraitV2SnapshotValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PortraitV2SnapshotValidationError';
  }
}

type PortraitV2DimensionInput = Omit<PortraitV2DimensionState, 'label'> & { label?: string };
type PortraitV2ClockOptions = { now?: Date | string };

const LABELS = new Map(PORTRAIT_V2_DIMENSIONS.map((dimension) => [dimension.id, dimension.label]));
const EVIDENCE_FAMILIES = new Set<string>(PORTRAIT_V2_EVIDENCE_FAMILIES);
const COMPATIBILITY_EVIDENCE_FAMILIES = new Set<PortraitV2CompatibilitySourceFamily>([
  'StudentCompetencySnapshot',
  'StudentEvidenceFeatureCache',
]);
const MIGRATED_EVIDENCE_FAMILIES = new Set<string>([
  ...EVIDENCE_FAMILIES,
  ...COMPATIBILITY_EVIDENCE_FAMILIES,
]);
const MISSING_EVIDENCE_RATIONALE = 'No safe legacy mapping exists.';
const MISSING_EVIDENCE_LIMITATION = 'missing-native-portrait-v2-evidence';
const NO_SAFE_LEGACY_MAPPING_LIMITATION = 'no-safe-legacy-mapping';
const GOVERNED_EVIDENCE_RATIONALE = 'Governed evidence supports the current score.';
const GOVERNED_NEGATIVE_EVIDENCE_RATIONALE = 'Governed negative evidence applied a bounded score correction.';
const COMPATIBILITY_RATIONALE = 'Compatibility projection from a legacy learner snapshot.';
const COMPATIBILITY_LIMITATION = 'compatibility-derived-not-native-portrait-v2-evidence';
const GOVERNED_SAFE_RATIONALES = new Set([
  GOVERNED_EVIDENCE_RATIONALE,
  GOVERNED_NEGATIVE_EVIDENCE_RATIONALE,
  COMPATIBILITY_RATIONALE,
  MISSING_EVIDENCE_RATIONALE,
]);
const GOVERNED_SAFE_LIMITATIONS = new Set([
  'legacy-six-dimensional-input-is-non-authoritative',
  'persisted-portrait-v2-invalid-or-incompatible',
  COMPATIBILITY_LIMITATION,
  MISSING_EVIDENCE_LIMITATION,
  NO_SAFE_LEGACY_MAPPING_LIMITATION,
  'bounded-negative-evidence-correction',
  'legacy-control-modeling-combines-representation-and-analysis',
  'legacy-self-directed-learning-partially-represents-reflection-ai-collaboration',
]);
const STUDENT_SAFE_LINEAGE_KINDS = new Set<PortraitV2LineageKind>([
  'evidence-family',
  'citation',
  'aggregate',
  'hashed',
]);
const CONSUMER_PRIVACY_SCOPES: Record<PortraitV2Consumer, Set<PortraitV2LineagePrivacyScope>> = {
  student: new Set(['student-visible']),
  konling: new Set(['student-visible']),
  planner: new Set(['student-visible']),
  reviewer: new Set(['student-visible', 'teacher-scoped']),
  admin: new Set(['student-visible', 'teacher-scoped', 'admin-scoped', 'audit-only']),
};

export function createPortraitV2Payload(input: {
  userId: string;
  generatedAt: string;
  dimensions: PortraitV2DimensionInput[];
  derivation?: Partial<PortraitV2PayloadShape['derivation']>;
  updateCursor?: PortraitV2PayloadShape['updateCursor'];
  now?: Date | string;
}): PortraitV2Payload {
  if (input.derivation?.kind === 'migrated' && !hasCompleteMigrationMetadata(input.derivation)) {
    throw new Error('New migrated portrait writes require complete migration metadata.');
  }
  const payload: PortraitV2PayloadShape = {
    userId: input.userId,
    payloadVersion: PORTRAIT_V2_PAYLOAD_VERSION,
    migrationVersion: PORTRAIT_V2_MIGRATION_VERSION,
    generatedAt: input.generatedAt,
    derivation: {
      kind: input.derivation?.kind ?? 'native',
      ...(input.derivation?.sourceLegacySnapshotId
        ? { sourceLegacySnapshotId: input.derivation.sourceLegacySnapshotId }
        : {}),
      ...(input.derivation?.sourceLegacySnapshotAt
        ? { sourceLegacySnapshotAt: input.derivation.sourceLegacySnapshotAt }
        : {}),
      ...(input.derivation?.mappingVersion ? { mappingVersion: input.derivation.mappingVersion } : {}),
      ...(input.derivation?.mappingConfidence
        ? { mappingConfidence: { ...input.derivation.mappingConfidence } }
        : {}),
      limitations: [...(input.derivation?.limitations ?? [])],
    },
    ...(input.updateCursor ? { updateCursor: { ...input.updateCursor } } : {}),
    dimensions: input.dimensions.map((dimension) => ({
      ...dimension,
      trend: dimension.trend ?? 'stable',
      label: LABELS.get(dimension.id) ?? dimension.label ?? '',
      evidenceSummary: {
        ...dimension.evidenceSummary,
        sourceFamilyCounts: { ...dimension.evidenceSummary.sourceFamilyCounts },
      },
      freshness: { ...dimension.freshness },
      limitations: [...dimension.limitations],
      sourceLineage: dimension.sourceLineage.map((ref) => ({ ...ref })),
      ...(dimension.taskAttainment
        ? { taskAttainment: structuredClone(dimension.taskAttainment) }
        : {}),
    })),
  };
  validatePortraitV2Payload(payload, { now: input.now });
  return markPersistable(payload);
}

export function summarizeCumulativePortraitV2(
  payload: PortraitV2PayloadShape,
  previous: PortraitV2PayloadShape | null = null,
): PortraitV2CumulativeSummary {
  const evidenced = payload.dimensions.filter((dimension) => dimension.evidenceSummary.totalCount > 0);
  const previousEvidenced = previous?.dimensions.filter((dimension) => dimension.evidenceSummary.totalCount > 0) ?? [];
  const overallScore = averageOrNull(evidenced.map((dimension) => dimension.score));
  const previousOverallScore = averageOrNull(previousEvidenced.map((dimension) => dimension.score));
  return {
    overallScore,
    confidence: averageOrNull(evidenced.map((dimension) => dimension.confidence)),
    evidenceAsOf: latestTimestamp(evidenced
      .map((dimension) => dimension.freshness.asOf)
      .filter((value): value is string => value !== null)),
    trend: overallScore === null || previousOverallScore === null
      ? 'not-comparable'
      : overallScore - previousOverallScore > 5
        ? 'up'
        : overallScore - previousOverallScore < -5
          ? 'down'
          : 'stable',
    evidencedDimensionIds: evidenced.map((dimension) => dimension.id),
    missingDimensionIds: PORTRAIT_V2_DIMENSION_IDS.filter((id) =>
      !evidenced.some((dimension) => dimension.id === id)),
  };
}

export function validatePortraitV2Payload(
  value: unknown,
  options: PortraitV2ClockOptions = {},
): asserts value is PortraitV2PayloadShape {
  validatePortraitV2Contract(value, options);
}

function validatePortraitV2Contract(
  value: unknown,
  options: PortraitV2ClockOptions,
  projectionConsumer?: PortraitV2Consumer,
): asserts value is PortraitV2ProjectedPayload {
  const payload = asRecord(value);
  assertExactKeys(payload, [
    'userId',
    'payloadVersion',
    'migrationVersion',
    'generatedAt',
    'derivation',
    'updateCursor',
    'dimensions',
  ], 'Portrait v2 payload');
  if (
    payload.payloadVersion !== PORTRAIT_V2_PAYLOAD_VERSION ||
    payload.migrationVersion !== PORTRAIT_V2_MIGRATION_VERSION ||
    !isNonEmptyString(payload.userId) ||
    !isIsoTimestamp(payload.generatedAt) ||
    !isWithinFutureBoundary(payload.generatedAt, options.now)
  ) {
    throw new Error('Expected a canonical portrait v2 payload with version metadata and no future timestamp.');
  }
  const derivation = asRecord(payload.derivation);
  assertExactKeys(derivation, ['kind', 'sourceLegacySnapshotId', 'sourceLegacySnapshotAt', 'mappingVersion', 'mappingConfidence', 'limitations'], 'Portrait v2 derivation');
  if (
    !isDerivationKind(derivation.kind) ||
    !isStringArray(derivation.limitations) ||
    (derivation.sourceLegacySnapshotId !== undefined && !isSafeIdentifier(derivation.sourceLegacySnapshotId)) ||
    (derivation.sourceLegacySnapshotAt !== undefined && (!isIsoTimestamp(derivation.sourceLegacySnapshotAt) || Date.parse(derivation.sourceLegacySnapshotAt) > Date.parse(payload.generatedAt))) ||
    (derivation.mappingVersion !== undefined && !isSafeIdentifier(derivation.mappingVersion)) ||
    (derivation.mappingConfidence !== undefined && !isValidMappingConfidence(derivation.mappingConfidence)) ||
    !hasConsistentDerivation(derivation, projectionConsumer)
  ) {
    throw new Error('Expected a canonical portrait v2 payload with derivation metadata.');
  }
  if (!hasGovernedSafeLimitations(derivation.limitations)) {
    throw new Error('Portrait v2 derivation must use a governed learner-safe summary.');
  }
  if (payload.updateCursor !== undefined) {
    const updateCursor = asRecord(payload.updateCursor);
    assertExactKeys(updateCursor, ['lastFactCreatedAt', 'lastFactId'], 'Portrait v2 update cursor');
    if (
      !isIsoTimestamp(updateCursor.lastFactCreatedAt) ||
      Date.parse(updateCursor.lastFactCreatedAt) > Date.parse(payload.generatedAt) ||
      !isSafeIdentifier(updateCursor.lastFactId)
    ) {
      throw new Error('Expected a valid portrait v2 incremental update cursor.');
    }
  }
  const dimensions = Array.isArray(payload.dimensions) ? payload.dimensions : [];
  const ids = dimensions.map((dimension) => asRecord(dimension).id);
  if (
    dimensions.length !== PORTRAIT_V2_DIMENSION_IDS.length ||
    new Set(ids).size !== PORTRAIT_V2_DIMENSION_IDS.length ||
    !PORTRAIT_V2_DIMENSION_IDS.every((id) => ids.includes(id))
  ) {
    throw new Error('Expected a canonical portrait v2 payload with exactly seven dimensions.');
  }
  for (const rawDimension of dimensions) {
    validateDimension(asRecord(rawDimension), payload.generatedAt, {
      kind: derivation.kind,
      sourceLegacySnapshotId: derivation.sourceLegacySnapshotId,
    }, projectionConsumer);
  }
}

export function validatePortraitV2Projection(
  value: unknown,
  consumer: PortraitV2Consumer,
  options: PortraitV2ClockOptions = {},
): asserts value is PortraitV2ProjectedPayload {
  validatePortraitV2Contract(value, options, consumer);
}

export async function writePortraitV2Snapshot(
  db: PortraitV2SnapshotWriteDb,
  payload: PortraitV2Payload,
  options: PortraitV2ClockOptions = {},
): Promise<{ id: string; payload: PortraitV2Payload }> {
  if (isIsoTimestamp(payload?.generatedAt) && !isWithinFutureBoundary(payload.generatedAt, options.now)) {
    throw new Error('Primary learner portrait writes reject a future generatedAt timestamp.');
  }
  try {
    validatePortraitV2Payload(payload, options);
  } catch (error) {
    throw new Error('Primary learner portrait writes require a canonical portrait v2 payload.', { cause: error });
  }
  if (payload.derivation.kind === 'compatibility-derived') {
    throw new Error('Compatibility-derived portrait values are read-only and cannot be written as primary truth.');
  }
  if (!isPersistable(payload)) {
    throw new Error('Primary learner portrait writes require a factory-sealed persistable payload.');
  }
  const create = db.studentPortraitV2Snapshot?.create;
  if (!create) {
    throw new Error('Portrait v2 persistence is unavailable.');
  }
  const row = asRecord(await create({
    data: {
      userId: payload.userId,
      snapshotAt: new Date(payload.generatedAt),
      payloadVersion: payload.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: payload.migrationVersion,
      derivationKind: payload.derivation.kind,
      sourceLegacySnapshotId: payload.derivation.kind === 'migrated'
        ? payload.derivation.sourceLegacySnapshotId
        : null,
      payload,
    },
  }));
  return {
    id: isNonEmptyString(row.id) ? row.id : '',
    payload: clonePayload(payload),
  };
}

export async function readLatestPortraitV2Snapshot(
  db: PortraitV2SnapshotReadDb,
  userId: string,
  consumer: PortraitV2Consumer,
  options: PortraitV2ClockOptions = {},
): Promise<PortraitV2ProjectedPayload | null> {
  const findFirst = db.studentPortraitV2Snapshot?.findFirst;
  if (!findFirst) return null;
  const rawRow = await findFirst({
    where: { userId },
    orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }],
  });
  if (rawRow === null || rawRow === undefined) return null;
  try {
    return projectPersistedPortraitV2Row(rawRow, userId, consumer, options);
  } catch (error) {
    throw new PortraitV2SnapshotValidationError('Invalid persisted portrait v2 snapshot.', { cause: error });
  }
}

export async function readLatestValidNativePortraitV2Snapshots(
  db: PortraitV2SnapshotReadDb,
  userIds: string[],
  consumer: PortraitV2Consumer,
  options: PortraitV2ClockOptions = {},
): Promise<Map<string, PortraitV2ProjectedPayload>> {
  const findMany = db.studentPortraitV2Snapshot?.findMany;
  const uniqueUserIds = [...new Set(userIds)].sort();
  if (!findMany || uniqueUserIds.length === 0) return new Map();
  const rows = await findMany({
    where: { userId: { in: uniqueUserIds }, derivationKind: 'native' },
    orderBy: [{ userId: 'asc' }, { snapshotAt: 'desc' }, { id: 'desc' }],
  });
  const selected = new Map<string, PortraitV2ProjectedPayload>();
  for (const rawRow of rows) {
    const row = asRecord(rawRow);
    const userId = typeof row.userId === 'string' ? row.userId : '';
    if (!userId || selected.has(userId)) continue;
    try {
      const payload = projectPersistedPortraitV2Row(rawRow, userId, consumer, options);
      if (payload.derivation.kind === 'native') selected.set(userId, payload);
    } catch {
      // A corrupt newest row must not hide an older canonical native portrait.
    }
  }
  return selected;
}

function projectPersistedPortraitV2Row(
  rawRow: unknown,
  userId: string,
  consumer: PortraitV2Consumer,
  options: PortraitV2ClockOptions,
): PortraitV2ProjectedPayload {
  const row = asRecord(rawRow);
  validatePortraitV2Payload(row.payload, options);
  const payload = markPersistable(row.payload);
  const normalizedSnapshotAt = normalizedIsoTimestamp(row.snapshotAt);
  const normalizedGeneratedAt = normalizedIsoTimestamp(payload.generatedAt);
  if (
    row.userId !== userId ||
    payload.userId !== userId ||
    normalizedSnapshotAt === null ||
    !isWithinFutureBoundary(normalizedSnapshotAt, options.now) ||
    normalizedSnapshotAt !== normalizedGeneratedAt ||
    row.payloadVersion !== payload.payloadVersion ||
    row.calculationVersion !== PORTRAIT_V2_CALCULATION_VERSION ||
    row.migrationVersion !== payload.migrationVersion ||
    row.derivationKind !== payload.derivation.kind
  ) {
    throw new Error('Persisted portrait metadata does not match the requested learner or payload.');
  }
  return projectPortraitV2ForConsumer(payload, consumer, options);
}

export async function readLatestPortraitV2SnapshotForUpdate(
  db: PortraitV2SnapshotReadDb,
  userId: string,
  options: PortraitV2ClockOptions = {},
): Promise<PortraitV2Payload | null> {
  const findFirst = db.studentPortraitV2Snapshot?.findFirst;
  if (!findFirst) return null;
  const rawRow = await findFirst({
    where: { userId },
    orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }],
  });
  if (rawRow === null || rawRow === undefined) return null;
  try {
    const row = asRecord(rawRow);
    validatePortraitV2Payload(row.payload, options);
    const payload = markPersistable(row.payload);
    const normalizedSnapshotAt = normalizedIsoTimestamp(row.snapshotAt);
    const normalizedGeneratedAt = normalizedIsoTimestamp(payload.generatedAt);
    if (
      row.userId !== userId ||
      payload.userId !== userId ||
      normalizedSnapshotAt === null ||
      !isWithinFutureBoundary(normalizedSnapshotAt, options.now) ||
      normalizedSnapshotAt !== normalizedGeneratedAt ||
      row.payloadVersion !== payload.payloadVersion ||
      row.calculationVersion !== PORTRAIT_V2_CALCULATION_VERSION ||
      row.migrationVersion !== payload.migrationVersion ||
      row.derivationKind !== payload.derivation.kind
    ) {
      throw new Error('Persisted portrait metadata does not match the requested learner or payload.');
    }
    return clonePayload(payload);
  } catch (error) {
    throw new PortraitV2SnapshotValidationError('Invalid persisted portrait v2 snapshot.', { cause: error });
  }
}

export function projectPortraitV2ForConsumer(
  payload: PortraitV2Payload,
  consumer: PortraitV2Consumer,
  options: PortraitV2ClockOptions = {},
): PortraitV2ProjectedPayload {
  validatePortraitV2Payload(payload, options);
  const allowedScopes = CONSUMER_PRIVACY_SCOPES[consumer];
  const learnerFacing = consumer === 'student' || consumer === 'konling' || consumer === 'planner';
  const canReadAuditOnly = allowedScopes.has('audit-only');
  const projected: PortraitV2PayloadShape = {
    userId: payload.userId,
    payloadVersion: payload.payloadVersion,
    migrationVersion: payload.migrationVersion,
    generatedAt: payload.generatedAt,
    derivation: {
      kind: payload.derivation.kind,
      ...(!canReadAuditOnly || !payload.derivation.sourceLegacySnapshotId
        ? {}
        : { sourceLegacySnapshotId: payload.derivation.sourceLegacySnapshotId }),
      ...(!canReadAuditOnly || !payload.derivation.sourceLegacySnapshotAt ? {} : { sourceLegacySnapshotAt: payload.derivation.sourceLegacySnapshotAt }),
      ...(!canReadAuditOnly || !payload.derivation.mappingVersion ? {} : { mappingVersion: payload.derivation.mappingVersion }),
      ...(!canReadAuditOnly || !payload.derivation.mappingConfidence ? {} : { mappingConfidence: { ...payload.derivation.mappingConfidence } }),
      limitations: [...payload.derivation.limitations],
    },
    dimensions: payload.dimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      score: dimension.score,
      confidence: dimension.confidence,
      trend: dimension.trend,
      freshness: {
        state: dimension.freshness.state,
        asOf: dimension.freshness.asOf,
        evidenceAgeDays: dimension.freshness.evidenceAgeDays,
      },
      evidenceSummary: {
        totalCount: dimension.evidenceSummary.totalCount,
        sourceFamilyCounts: rebuildSourceFamilyCounts(dimension.evidenceSummary.sourceFamilyCounts),
      },
      lastPositiveEvidenceAt: dimension.lastPositiveEvidenceAt,
      lastNegativeEvidenceAt: dimension.lastNegativeEvidenceAt,
      rationale: dimension.rationale,
      limitations: [...dimension.limitations],
      sourceLineage: dimension.sourceLineage
        .filter((ref) =>
          ref.kind !== 'raw-source' &&
          allowedScopes.has(ref.privacyScope) &&
          (!learnerFacing || STUDENT_SAFE_LINEAGE_KINDS.has(ref.kind)))
        .map((ref) => ({
          kind: ref.kind,
          ref: ref.ref,
          privacyScope: ref.privacyScope,
        })),
      calculationVersion: dimension.calculationVersion,
      ...(dimension.taskAttainment
        ? {
            taskAttainment: {
              ...structuredClone(dimension.taskAttainment),
              sourceLineage: dimension.taskAttainment.sourceLineage.filter((ref) =>
                ref.privacyScope === 'student-visible'),
            },
          }
        : {}),
    })),
  };
  validatePortraitV2Projection(projected, consumer, options);
  return markProjected(projected);
}

export function derivePortraitV2Compatibility(input: {
  userId: string;
  snapshotId?: string | null;
  snapshotAt: string;
  sourceFamily?: PortraitV2CompatibilitySourceFamily | null;
  vector: CompetencyVector;
  limitations?: string[];
  now?: Date | string;
}): PortraitV2Payload {
  const values: Record<PortraitV2DimensionId, Array<keyof CompetencyVector>> = {
    controlModelingRepresentation: ['controlModeling'],
    systemAnalysisInterpretation: ['controlModeling'],
    controllerDesignSynthesis: ['parameterDesign'],
    simulationValidationEvidence: [],
    engineeringConstraintSafety: ['engineeringDecision'],
    transferIntegratedApplication: ['crossDomainTransfer'],
    reflectionImprovementAiCollab: ['inquiryReflection', 'selfDirectedLearning'],
  };
  const generatedAt = clockTimestamp(input.now);
  const snapshotAt = normalizedIsoTimestamp(input.snapshotAt);
  if (snapshotAt === null || !isWithinFutureBoundary(snapshotAt, input.now)) {
    throw new Error('Legacy compatibility snapshotAt must be a valid timestamp at or before now.');
  }
  return createPortraitV2Payload({
    userId: input.userId,
    generatedAt,
    now: input.now,
    derivation: {
      kind: 'compatibility-derived',
      ...(input.snapshotId ? { sourceLegacySnapshotId: input.snapshotId } : {}),
      limitations: [
        'legacy-six-dimensional-input-is-non-authoritative',
        ...(input.limitations ?? []),
      ],
    },
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id) => {
      const legacyScores = values[id]
        .map((dimension) => input.vector[dimension])
        .filter((item) => item.evidenceCount > 0);
      const evidenceCount = legacyScores.length > 0
        ? Math.max(...legacyScores.map((item) => item.evidenceCount))
        : 0;
      const hasMapping = evidenceCount > 0;
      if (hasMapping && !input.sourceFamily) {
        throw new Error('Legacy compatibility evidence requires an explicit source family.');
      }
      const evidenceTimestamps = legacyScores.map((item) => normalizedIsoTimestamp(item.lastUpdated));
      const compatibilityEvidenceUpperBound = Math.min(
        Date.parse(snapshotAt) + PORTRAIT_V2_LEGACY_SNAPSHOT_CLOCK_SKEW_MS,
        Date.parse(generatedAt),
      );
      if (hasMapping && evidenceTimestamps.some((timestamp) =>
        timestamp === null || Date.parse(timestamp) > compatibilityEvidenceUpperBound)) {
        throw new Error('Legacy compatibility evidence lastUpdated exceeds the bounded snapshot clock skew or portrait generation time.');
      }
      const asOf = hasMapping
        ? latestTimestamp(evidenceTimestamps.filter((timestamp): timestamp is string => timestamp !== null))
        : null;
      const evidenceAgeDays = asOf === null
        ? null
        : Math.floor((Date.parse(generatedAt) - Date.parse(asOf)) / 86_400_000);
      const lastPositiveEvidenceAt = latestTimestamp(legacyScores
        .filter((item) => item.trend === 'up')
        .map((item) => normalizedIsoTimestamp(item.lastUpdated))
        .filter((timestamp): timestamp is string => timestamp !== null));
      const lastNegativeEvidenceAt = latestTimestamp(legacyScores
        .filter((item) => item.trend === 'down')
        .map((item) => normalizedIsoTimestamp(item.lastUpdated))
        .filter((timestamp): timestamp is string => timestamp !== null));
      const sourceFamilyCounts: Record<string, number> = hasMapping
        ? { [input.sourceFamily!]: evidenceCount }
        : {};
      return {
        id,
        score: hasMapping ? average(legacyScores.map((item) => item.score)) : 0,
        confidence: hasMapping ? average(legacyScores.map((item) => item.confidence)) * 0.7 : 0,
        freshness: {
          state: hasMapping ? freshnessStateForAge(evidenceAgeDays!) : 'missing' as const,
          asOf,
          evidenceAgeDays,
        },
        evidenceSummary: {
          totalCount: evidenceCount,
          sourceFamilyCounts,
        },
        lastPositiveEvidenceAt,
        lastNegativeEvidenceAt,
        rationale: hasMapping ? COMPATIBILITY_RATIONALE : MISSING_EVIDENCE_RATIONALE,
        limitations: hasMapping
          ? [COMPATIBILITY_LIMITATION]
          : [MISSING_EVIDENCE_LIMITATION, NO_SAFE_LEGACY_MAPPING_LIMITATION],
        sourceLineage: hasMapping ? [
          {
            kind: 'evidence-family' as const,
            ref: input.sourceFamily!,
            privacyScope: 'student-visible' as const,
          },
          ...(input.snapshotId ? [{
            kind: 'migration-snapshot' as const,
            ref: `legacy-snapshot:${input.snapshotId}`,
            privacyScope: 'audit-only' as const,
          }] : []),
        ] : [],
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      };
    }),
  });
}

function validateDimension(
  dimension: Record<string, unknown>,
  generatedAt: string,
  derivation: Pick<PortraitV2Payload['derivation'], 'kind' | 'sourceLegacySnapshotId'>,
  projectionConsumer?: PortraitV2Consumer,
): void {
  assertExactKeys(dimension, [
    'id',
    'label',
    'score',
    'confidence',
    'trend',
    'freshness',
    'evidenceSummary',
    'lastPositiveEvidenceAt',
    'lastNegativeEvidenceAt',
    'rationale',
    'limitations',
    'sourceLineage',
    'calculationVersion',
    'taskAttainment',
  ], 'Portrait v2 dimension');
  const id = dimension.id as PortraitV2DimensionId;
  if (!PORTRAIT_V2_DIMENSION_IDS.includes(id) || dimension.label !== LABELS.get(id)) {
    throw new Error('Portrait v2 dimension id and label must be canonical.');
  }
  if (!inRange(dimension.score, 0, 100) || !inRange(dimension.confidence, 0, 1)) {
    throw new Error(`Portrait v2 dimension ${id} has an invalid score or confidence.`);
  }
  if (dimension.trend !== undefined && !isPortraitTrend(dimension.trend)) {
    throw new Error(`Portrait v2 dimension ${id} has an invalid trend.`);
  }
  const freshness = asRecord(dimension.freshness);
  assertExactKeys(freshness, ['state', 'asOf', 'evidenceAgeDays'], `Portrait v2 dimension ${id} freshness`);
  if (
    !isFreshnessState(freshness.state) ||
    !isNullableIsoTimestamp(freshness.asOf) ||
    !isNullableNonNegativeNumber(freshness.evidenceAgeDays) ||
    !hasConsistentFreshness(freshness, generatedAt)
  ) {
    throw new Error(`Portrait v2 dimension ${id} has invalid freshness metadata.`);
  }
  const evidenceSummary = asRecord(dimension.evidenceSummary);
  assertExactKeys(evidenceSummary, ['totalCount', 'sourceFamilyCounts'], `Portrait v2 dimension ${id} evidence summary`);
  const sourceFamilyCounts = asRecord(evidenceSummary.sourceFamilyCounts);
  const allowedEvidenceFamilies = derivation.kind === 'compatibility-derived'
    ? COMPATIBILITY_EVIDENCE_FAMILIES
    : derivation.kind === 'migrated'
      ? MIGRATED_EVIDENCE_FAMILIES
      : EVIDENCE_FAMILIES;
  if (
    !isNonNegativeInteger(evidenceSummary.totalCount) ||
    !isRecord(evidenceSummary.sourceFamilyCounts) ||
    !Object.entries(sourceFamilyCounts).every(([family, count]) =>
      allowedEvidenceFamilies.has(family as PortraitV2CompatibilitySourceFamily) &&
        isNonNegativeInteger(count) && Number(count) > 0) ||
    Object.values(sourceFamilyCounts).reduce((sum, count) => sum + Number(count), 0) !== evidenceSummary.totalCount ||
    (freshness.state === 'missing'
      ? evidenceSummary.totalCount !== 0 || Object.keys(sourceFamilyCounts).length !== 0
      : evidenceSummary.totalCount === 0)
  ) {
    throw new Error(`Portrait v2 dimension ${id} has invalid evidence counts.`);
  }
  if (
    !isNullableIsoTimestamp(dimension.lastPositiveEvidenceAt) ||
    !isNullableIsoTimestamp(dimension.lastNegativeEvidenceAt) ||
    !isNonEmptyString(dimension.rationale) ||
    !isStringArray(dimension.limitations) ||
    dimension.calculationVersion !== PORTRAIT_V2_CALCULATION_VERSION
  ) {
    if (dimension.calculationVersion !== PORTRAIT_V2_CALCULATION_VERSION) {
      throw new Error(`Portrait v2 dimension ${id} has an invalid calculation version.`);
    }
    throw new Error(`Portrait v2 dimension ${id} is missing required metadata.`);
  }
  if (
    !GOVERNED_SAFE_RATIONALES.has(dimension.rationale) ||
    !hasGovernedSafeLimitations(dimension.limitations)
  ) {
    throw new Error(`Portrait v2 dimension ${id} must use a governed learner-safe summary.`);
  }
  if (!hasConsistentEvidenceTimestamps(dimension, freshness, generatedAt)) {
    throw new Error(`Portrait v2 dimension ${id} has invalid evidence timestamps.`);
  }
  const lineage = Array.isArray(dimension.sourceLineage) ? dimension.sourceLineage : [];
  if (
    !Array.isArray(dimension.sourceLineage) ||
    !lineage.every(isLineageRef) ||
    (projectionConsumer !== undefined && !lineage.every((ref) => isLineageVisibleToConsumer(ref, projectionConsumer))) ||
    !hasValidLineageForDerivation(evidenceSummary, lineage, derivation, projectionConsumer)
  ) {
    throw new Error(`Portrait v2 dimension ${id} has invalid source lineage.`);
  }
  if (!hasConsistentDimensionSummary(dimension, freshness.state, derivation.kind)) {
    throw new Error(`Portrait v2 dimension ${id} with missing evidence must use the canonical zero-value summary.`);
  }
  validateSimulationTaskAttainment(dimension, id);
}

function validateSimulationTaskAttainment(
  dimension: Record<string, unknown>,
  id: PortraitV2DimensionId,
): void {
  if (dimension.taskAttainment === undefined) return;
  if (id !== 'simulationValidationEvidence') {
    throw new Error('Only the simulation validation dimension may contain task attainment.');
  }
  const taskAttainment = asRecord(dimension.taskAttainment);
  assertExactKeys(taskAttainment, [
    'state',
    'score',
    'completedTaskCount',
    'relatedTaskCount',
    'groupedTaskSummary',
    'evidenceAsOf',
    'sourceLineage',
    'calculationVersion',
    'catalogDigest',
    'limitations',
    'hasGovernedTaskEvidence',
  ], 'Simulation task attainment');
  const completedTaskCount = Number(taskAttainment.completedTaskCount);
  const relatedTaskCount = Number(taskAttainment.relatedTaskCount);
  const groups = Array.isArray(taskAttainment.groupedTaskSummary)
    ? taskAttainment.groupedTaskSummary
    : [];
  const groupCountsAreValid = groups.every((value) => {
    const group = asRecord(value);
    const tasks = Array.isArray(group.tasks) ? group.tasks : [];
    return typeof group.source === 'string' &&
      typeof group.displayGroup === 'string' &&
      isNonNegativeInteger(group.completedTaskCount) &&
      isNonNegativeInteger(group.relatedTaskCount) &&
      Number(group.completedTaskCount) <= Number(group.relatedTaskCount) &&
      tasks.length === Number(group.relatedTaskCount) &&
      tasks.every((taskValue) => {
        const task = asRecord(taskValue);
        return isNonEmptyString(task.taskKey) &&
          isNonEmptyString(task.displayName) &&
          typeof task.completed === 'boolean';
      });
  });
  const completedFromGroups = groups.reduce((sum, value) =>
    sum + Number(asRecord(value).completedTaskCount), 0);
  const relatedFromGroups = groups.reduce((sum, value) =>
    sum + Number(asRecord(value).relatedTaskCount), 0);
  if (
    (taskAttainment.state !== 'EVIDENCE' && taskAttainment.state !== 'NO_EVIDENCE') ||
    !isNonNegativeInteger(completedTaskCount) ||
    !isNonNegativeInteger(relatedTaskCount) ||
    completedTaskCount > relatedTaskCount ||
    completedFromGroups !== completedTaskCount ||
    relatedFromGroups !== relatedTaskCount ||
    !groupCountsAreValid ||
    !isNullableIsoTimestamp(taskAttainment.evidenceAsOf) ||
    !isStringArray(taskAttainment.limitations) ||
    !isNonEmptyString(taskAttainment.calculationVersion) ||
    !/^[0-9a-f]{64}$/u.test(String(taskAttainment.catalogDigest)) ||
    typeof taskAttainment.hasGovernedTaskEvidence !== 'boolean' ||
    !Array.isArray(taskAttainment.sourceLineage) ||
    !taskAttainment.sourceLineage.every(isLineageRef) ||
    (taskAttainment.state === 'EVIDENCE'
      ? !inRange(taskAttainment.score, 0, 100) ||
        completedTaskCount === 0 ||
        taskAttainment.evidenceAsOf === null
      : taskAttainment.score !== null ||
        completedTaskCount !== 0 ||
        taskAttainment.evidenceAsOf !== null)
  ) {
    throw new Error('Simulation task attainment metadata is invalid.');
  }
}

function isLineageVisibleToConsumer(
  ref: PortraitV2SourceLineageRef,
  consumer: PortraitV2Consumer,
): boolean {
  if (ref.kind === 'raw-source' || !CONSUMER_PRIVACY_SCOPES[consumer].has(ref.privacyScope)) return false;
  return consumer === 'student' || consumer === 'konling' || consumer === 'planner'
    ? STUDENT_SAFE_LINEAGE_KINDS.has(ref.kind)
    : true;
}

function clonePayload(payload: PortraitV2Payload): PortraitV2Payload {
  return markPersistable(structuredClone(payload));
}

function markPersistable(payload: PortraitV2PayloadShape): PortraitV2Payload {
  PERSISTABLE_PORTRAIT_V2_PAYLOADS.add(payload);
  return payload as PortraitV2Payload;
}

function markProjected(payload: PortraitV2PayloadShape): PortraitV2ProjectedPayload {
  return payload as PortraitV2ProjectedPayload;
}

function isPersistable(payload: unknown): payload is PortraitV2Payload {
  return isRecord(payload) && PERSISTABLE_PORTRAIT_V2_PAYLOADS.has(payload);
}

function asRecord(value: unknown): Record<string, any> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function averageOrNull(values: number[]): number | null {
  return values.length === 0 ? null : average(values);
}

function clockTimestamp(now: Date | string | undefined): string {
  const value = now ?? new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function latestTimestamp(values: string[]): string | null {
  return values.length === 0
    ? null
    : values.reduce((latest, value) => Date.parse(value) > Date.parse(latest) ? value : latest);
}

function isLineageRef(value: unknown): value is PortraitV2SourceLineageRef {
  const ref = asRecord(value);
  assertExactKeys(ref, ['kind', 'ref', 'privacyScope'], 'Portrait v2 lineage ref');
  return isNonEmptyString(ref.ref) &&
    isLineageKind(ref.kind) &&
    isPrivacyScope(ref.privacyScope) &&
    hasGovernedLineageShape(ref.kind, ref.ref, ref.privacyScope);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth;
}

function isNullableIsoTimestamp(value: unknown): boolean {
  return value === null || isIsoTimestamp(value);
}

function isNonNegativeInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isNullableNonNegativeNumber(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function hasConsistentFreshness(freshness: Record<string, unknown>, generatedAt: string): boolean {
  if (freshness.state === 'missing') {
    return freshness.asOf === null && freshness.evidenceAgeDays === null;
  }
  if (typeof freshness.asOf !== 'string' || typeof freshness.evidenceAgeDays !== 'number') {
    return false;
  }
  const ageMilliseconds = Date.parse(generatedAt) - Date.parse(freshness.asOf);
  if (ageMilliseconds < 0) return false;
  const evidenceAgeDays = Math.floor(ageMilliseconds / 86_400_000);
  return freshness.evidenceAgeDays === evidenceAgeDays;
}

function freshnessStateForAge(_evidenceAgeDays: number): Exclude<PortraitV2FreshnessState, 'missing'> {
  return 'current';
}

function hasConsistentEvidenceTimestamps(
  dimension: Record<string, unknown>,
  freshness: Record<string, unknown>,
  generatedAt: string,
): boolean {
  const timestamps = [dimension.lastPositiveEvidenceAt, dimension.lastNegativeEvidenceAt]
    .filter((value): value is string => typeof value === 'string');
  if (freshness.state === 'missing') return timestamps.length === 0;
  if (typeof freshness.asOf !== 'string') return false;
  const generatedAtMs = Date.parse(generatedAt);
  const asOfMs = Date.parse(freshness.asOf);
  return timestamps.every((timestamp) => {
    const timestampMs = Date.parse(timestamp);
    return timestampMs <= asOfMs && timestampMs <= generatedAtMs;
  });
}

function hasConsistentDerivation(
  derivation: Record<string, unknown>,
  projectionConsumer?: PortraitV2Consumer,
): boolean {
  const limitations = derivation.limitations as string[];
  if (!limitations.every(isNonEmptyString)) return false;
  const hasMigrationMetadata = derivation.sourceLegacySnapshotAt !== undefined || derivation.mappingVersion !== undefined || derivation.mappingConfidence !== undefined;
  if (derivation.kind === 'native') return derivation.sourceLegacySnapshotId === undefined && !hasMigrationMetadata;
  if (derivation.kind === 'migrated') {
    const sourceIdentityIsValid = projectionConsumer === undefined ||
      CONSUMER_PRIVACY_SCOPES[projectionConsumer].has('audit-only')
      ? isSafeIdentifier(derivation.sourceLegacySnapshotId)
      : derivation.sourceLegacySnapshotId === undefined;
    const canReadAuditOnly = projectionConsumer === undefined || CONSUMER_PRIVACY_SCOPES[projectionConsumer].has('audit-only');
    const metadataIsValid = canReadAuditOnly
      ? !hasMigrationMetadata || (
          derivation.sourceLegacySnapshotAt !== undefined &&
          derivation.mappingVersion !== undefined &&
          hasCompleteMappingConfidence(derivation.mappingConfidence)
        )
      : !hasMigrationMetadata;
    return sourceIdentityIsValid && metadataIsValid && limitations.length > 0;
  }
  if (derivation.kind !== 'compatibility-derived' || limitations.length === 0) return false;
  return !hasMigrationMetadata && (projectionConsumer === undefined ||
    CONSUMER_PRIVACY_SCOPES[projectionConsumer].has('audit-only') ||
    derivation.sourceLegacySnapshotId === undefined);
}

function isValidMappingConfidence(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, confidence]) =>
    PORTRAIT_V2_DIMENSION_IDS.includes(id as PortraitV2DimensionId) &&
    ['high', 'medium', 'low', 'none'].includes(String(confidence))
  );
}

function hasCompleteMappingConfidence(value: unknown): boolean {
  if (!isValidMappingConfidence(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length === PORTRAIT_V2_DIMENSION_IDS.length &&
    PORTRAIT_V2_DIMENSION_IDS.every((id) => keys.includes(id));
}

function hasCompleteMigrationMetadata(value: Partial<PortraitV2PayloadShape['derivation']>): boolean {
  return isSafeIdentifier(value.sourceLegacySnapshotId) &&
    typeof value.sourceLegacySnapshotAt === 'string' && isIsoTimestamp(value.sourceLegacySnapshotAt) &&
    isSafeIdentifier(value.mappingVersion) && hasCompleteMappingConfidence(value.mappingConfidence);
}

function hasConsistentDimensionSummary(
  dimension: Record<string, unknown>,
  freshnessState: unknown,
  derivationKind: PortraitV2DerivationKind,
): boolean {
  const limitations = dimension.limitations as string[];
  if (freshnessState === 'missing') {
    const expectedLimitations = derivationKind === 'compatibility-derived'
      ? [MISSING_EVIDENCE_LIMITATION, NO_SAFE_LEGACY_MAPPING_LIMITATION]
      : [MISSING_EVIDENCE_LIMITATION];
    return dimension.score === 0 &&
      dimension.confidence === 0 &&
      dimension.rationale === MISSING_EVIDENCE_RATIONALE &&
      sameOrderedStrings(limitations, expectedLimitations);
  }
  const expectedRationale = derivationKind === 'compatibility-derived'
    ? COMPATIBILITY_RATIONALE
    : dimension.rationale === GOVERNED_NEGATIVE_EVIDENCE_RATIONALE
      ? GOVERNED_NEGATIVE_EVIDENCE_RATIONALE
      : GOVERNED_EVIDENCE_RATIONALE;
  const expectedLimitations = derivationKind === 'compatibility-derived'
    ? [COMPATIBILITY_LIMITATION]
    : expectedRationale === GOVERNED_NEGATIVE_EVIDENCE_RATIONALE
      ? ['bounded-negative-evidence-correction']
      : [];
  return dimension.rationale === expectedRationale && (
    derivationKind === 'migrated'
      ? limitations.every((item) => GOVERNED_SAFE_LIMITATIONS.has(item))
      : sameOrderedStrings(limitations, expectedLimitations)
  );
}

function sameOrderedStrings(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function rebuildSourceFamilyCounts(sourceFamilyCounts: Record<string, number>): Record<string, number> {
  return Object.fromEntries([...PORTRAIT_V2_EVIDENCE_FAMILIES, ...COMPATIBILITY_EVIDENCE_FAMILIES].flatMap((family) =>
    Object.prototype.hasOwnProperty.call(sourceFamilyCounts, family)
      ? [[family, sourceFamilyCounts[family]]]
      : []));
}

function hasGovernedSafeLimitations(value: unknown): value is string[] {
  return isStringArray(value) && value.every((limitation) => GOVERNED_SAFE_LIMITATIONS.has(limitation));
}

function hasValidLineageForDerivation(
  evidenceSummary: Record<string, unknown>,
  lineage: PortraitV2SourceLineageRef[],
  derivation: Pick<PortraitV2Payload['derivation'], 'kind' | 'sourceLegacySnapshotId'>,
  projectionConsumer?: PortraitV2Consumer,
): boolean {
  const sourceFamilyCounts = asRecord(evidenceSummary.sourceFamilyCounts);
  const totalCount = Number(evidenceSummary.totalCount);
  const countedFamilies = Object.entries(sourceFamilyCounts)
    .filter(([, count]) => Number(count) > 0)
    .map(([family]) => family);
  const lineageFamilies = lineage
    .filter((ref) => ref.kind === 'evidence-family')
    .map((ref) => ref.ref);
  if (
    lineageFamilies.length !== new Set(lineageFamilies).size ||
    countedFamilies.length !== lineageFamilies.length ||
    !countedFamilies.every((family) => lineageFamilies.includes(family))
  ) {
    return false;
  }
  if (totalCount === 0) return lineage.length === 0;

  const migrationLineage = lineage.filter((ref) => ref.kind === 'migration-snapshot');
  if (derivation.kind === 'native') {
    return migrationLineage.length === 0 &&
      lineageFamilies.every((family) => !COMPATIBILITY_EVIDENCE_FAMILIES.has(
        family as PortraitV2CompatibilitySourceFamily,
      ));
  }

  const expectedMigrationRef = derivation.sourceLegacySnapshotId
    ? `legacy-snapshot:${derivation.sourceLegacySnapshotId}`
    : null;
  const canReadAuditOnly = projectionConsumer === undefined ||
    CONSUMER_PRIVACY_SCOPES[projectionConsumer].has('audit-only');
  if (derivation.kind === 'migrated') {
    const hasExpectedMigrationLineage = canReadAuditOnly
      ? expectedMigrationRef !== null && migrationLineage.length === 1 && migrationLineage[0].ref === expectedMigrationRef
      : expectedMigrationRef === null && migrationLineage.length === 0;
    return hasExpectedMigrationLineage && lineageFamilies.every((family) => MIGRATED_EVIDENCE_FAMILIES.has(family));
  }

  return lineage.every((ref) => ref.kind === 'evidence-family' || ref.kind === 'migration-snapshot') &&
    lineageFamilies.every((family) => COMPATIBILITY_EVIDENCE_FAMILIES.has(
      family as PortraitV2CompatibilitySourceFamily,
    )) &&
    (!canReadAuditOnly || expectedMigrationRef === null
      ? migrationLineage.length === 0
      : migrationLineage.length === 1 && migrationLineage[0].ref === expectedMigrationRef);
}

function hasGovernedLineageShape(
  kind: PortraitV2LineageKind,
  ref: string,
  privacyScope: PortraitV2LineagePrivacyScope,
): boolean {
  if (kind === 'evidence-family') {
    return privacyScope === 'student-visible' &&
      (EVIDENCE_FAMILIES.has(ref) || COMPATIBILITY_EVIDENCE_FAMILIES.has(ref as PortraitV2CompatibilitySourceFamily));
  }
  if (kind === 'citation') {
    return privacyScope === 'student-visible' &&
      /^(?:citation|citation-target):sha256:[a-f0-9]{64}$/.test(ref);
  }
  if (kind === 'aggregate') {
    return privacyScope === 'student-visible' && /^aggregate:sha256:[a-f0-9]{64}$/.test(ref);
  }
  if (kind === 'hashed') {
    return privacyScope === 'student-visible' &&
      /^sar:(?:[a-z][a-z0-9-]{0,31}|entity:(?:student|class)):sha256:[a-f0-9]{64}$/.test(ref);
  }
  if (kind === 'teacher-scoped') {
    return privacyScope === 'teacher-scoped' && /^teacher-evidence:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(ref);
  }
  if (kind === 'private-fixture') {
    return privacyScope === 'admin-scoped' && /^private-fixture:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(ref);
  }
  if (kind === 'migration-snapshot') {
    return privacyScope === 'audit-only' && /^legacy-snapshot:[A-Za-z0-9][A-Za-z0-9._-]*$/.test(ref);
  }
  return privacyScope === 'system-internal' && /^raw-source:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(ref);
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/.test(value);
}

function normalizedIsoTimestamp(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return isIsoTimestamp(value) ? new Date(value).toISOString() : null;
}

function isWithinFutureBoundary(timestamp: string, now: Date | string | undefined): boolean {
  const nowMs = now === undefined
    ? Date.now()
    : now instanceof Date
      ? now.getTime()
      : Date.parse(now);
  return Number.isFinite(nowMs) && Date.parse(timestamp) <= nowMs + PORTRAIT_V2_MAX_FUTURE_SKEW_MS;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`${label} contains unknown fields: ${unknownKeys.join(', ')}.`);
  }
}

function inRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isDerivationKind(value: unknown): value is PortraitV2DerivationKind {
  return value === 'native' || value === 'migrated' || value === 'compatibility-derived';
}

function isFreshnessState(value: unknown): value is PortraitV2FreshnessState {
  return value === 'current' || value === 'partial' || value === 'stale' || value === 'missing';
}

function isPortraitTrend(value: unknown): value is PortraitV2Trend {
  return value === 'up' || value === 'stable' || value === 'down';
}

function isPrivacyScope(value: unknown): value is PortraitV2LineagePrivacyScope {
  return value === 'student-visible' || value === 'teacher-scoped' || value === 'admin-scoped' || value === 'audit-only' || value === 'system-internal';
}

function isLineageKind(value: unknown): value is PortraitV2LineageKind {
  return value === 'evidence-family' || value === 'citation' || value === 'aggregate' || value === 'hashed' || value === 'teacher-scoped' || value === 'private-fixture' || value === 'migration-snapshot' || value === 'raw-source';
}
