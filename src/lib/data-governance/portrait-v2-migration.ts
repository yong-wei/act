import { createHash } from 'node:crypto';

import type { CompetencyVector } from './competency-model';
import {
  mapLegacyCompetencyDimensionToPortraitV2,
  PORTRAIT_V2_DIMENSION_IDS,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_FRESHNESS_PARTIAL_MAX_AGE_DAYS,
  PORTRAIT_V2_MIGRATION_VERSION,
  PORTRAIT_V2_PAYLOAD_VERSION,
  createPortraitV2Payload,
  validatePortraitV2Payload,
  type PortraitV2Payload,
} from './portrait-v2-model';

export const LEGACY_PORTRAIT_MIGRATION_MAPPING_VERSION = 'legacy-six-to-portrait-v2.v1';

export interface LegacyPortraitSnapshot {
  id: string;
  userId: string;
  snapshotAt: Date;
  competencyVector: unknown;
  calculationVersion?: string;
}

interface ExistingPortraitSnapshot {
  id: string;
  userId: string;
  snapshotAt?: Date;
  derivationKind: string;
  payload: any;
}

export interface LegacyPortraitMigrationDb {
  studentCompetencySnapshot: { findMany(args?: Record<string, unknown>): Promise<LegacyPortraitSnapshot[]> };
  studentPortraitV2Snapshot: {
    findMany(args?: Record<string, unknown>): Promise<ExistingPortraitSnapshot[]>;
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    createMany?(args: { data: Record<string, unknown>[]; skipDuplicates: true }): Promise<{ count: number }>;
    findFirst?(args?: Record<string, unknown>): Promise<ExistingPortraitSnapshot | null>;
  };
  $transaction?<T>(fn: (tx: LegacyPortraitMigrationDb) => Promise<T>, options?: { isolationLevel: 'Serializable' }): Promise<T>;
}

type MigrationBucket = 'eligible' | 'migrated' | 'skipped' | 'conflicting' | 'unmigrated';

export function legacyPortraitMappingContract() {
  const sources = ['controlModeling', 'parameterDesign', 'crossDomainTransfer', 'engineeringDecision', 'inquiryReflection', 'selfDirectedLearning'];
  return sources.map((source) => {
    const mapped = mapLegacyCompetencyDimensionToPortraitV2(source);
    return {
      source,
      targets: mapped.targetDimensions,
      confidence: mapped.confidence,
      limitations: mapped.limitations,
    };
  });
}

export async function buildLegacyPortraitMigrationDryRun(
  db: LegacyPortraitMigrationDb,
  options: { now?: Date } = {},
) {
  const [legacyRows, portraitRows] = await Promise.all([
    db.studentCompetencySnapshot.findMany({ orderBy: [{ snapshotAt: 'asc' }, { id: 'asc' }] }),
    db.studentPortraitV2Snapshot.findMany({ orderBy: [{ snapshotAt: 'asc' }, { id: 'asc' }] }),
  ]);
  const byUser = groupBy(portraitRows, (row) => row.userId);
  const buckets = new Map<MigrationBucket, Array<{ learnerRef: string; snapshotRef: string; reason: string }>>(
    ['eligible', 'migrated', 'skipped', 'conflicting', 'unmigrated'].map((bucket) => [bucket as MigrationBucket, []]),
  );
  for (const row of legacyRows) {
    const existing = byUser.get(row.userId) ?? [];
    const alreadyMigrated = existing.some((item) => item.derivationKind === 'migrated' && item.payload?.derivation?.sourceLegacySnapshotId === row.id);
    const native = existing.some((item) => item.derivationKind === 'native');
    const bucket: MigrationBucket = alreadyMigrated
      ? 'migrated'
      : native
        ? 'conflicting'
        : !isCompetencyVector(row.competencyVector)
          ? 'unmigrated'
          : hasAnyLegacyEvidence(row.competencyVector)
            ? isMigratableSnapshot(row, options.now ?? new Date()) ? 'eligible' : 'unmigrated'
            : 'skipped';
    buckets.get(bucket)!.push({
      learnerRef: mask('learner', row.userId),
      snapshotRef: mask('legacy-snapshot', row.id),
      reason: bucketReason(bucket),
    });
  }
  return {
    contractVersion: 'portrait-v2-migration-report.v1' as const,
    mappingVersion: LEGACY_PORTRAIT_MIGRATION_MAPPING_VERSION,
    generatedAt: (options.now ?? new Date()).toISOString(),
    privacy: { minimized: true, rawIdentifiersIncluded: false, hash: 'sha256:12' as const },
    counts: Object.fromEntries([...buckets].map(([bucket, records]) => [bucket, records.length])) as Record<MigrationBucket, number>,
    records: [...buckets].map(([bucket, records]) => ({ bucket, records })),
    mapping: legacyPortraitMappingContract(),
  };
}

export async function applyLegacyPortraitMigration(db: LegacyPortraitMigrationDb, options: { now?: Date } = {}) {
  const execute = async (tx: LegacyPortraitMigrationDb) => {
    const report = await buildLegacyPortraitMigrationDryRun(tx, options);
    const eligibleRefs = new Set(report.records.find((item) => item.bucket === 'eligible')!.records.map((item) => item.snapshotRef));
    const rows = await tx.studentCompetencySnapshot.findMany({ orderBy: [{ snapshotAt: 'asc' }, { id: 'asc' }] });
    const data = rows.filter((row) => eligibleRefs.has(mask('legacy-snapshot', row.id)))
      .map((row) => portraitRowData(buildMigratedPortraitPayload(row, options.now ?? new Date())));
    if (!tx.studentPortraitV2Snapshot.createMany) throw new Error('Atomic portrait migration createMany is unavailable.');
    const write = await tx.studentPortraitV2Snapshot.createMany({ data, skipDuplicates: true });
    const after = await tx.studentPortraitV2Snapshot.findMany({
      where: { OR: data.map((item) => ({ userId: item.userId, sourceLegacySnapshotId: item.sourceLegacySnapshotId })) },
    });
    const persisted = new Set(after.map((row) => `${row.userId}:${row.payload?.derivation?.sourceLegacySnapshotId ?? ''}`));
    if (data.some((item) => !persisted.has(`${item.userId}:${item.sourceLegacySnapshotId ?? ''}`))) {
      throw new Error('Portrait migration post-write verification failed.');
    }
    const summary = { applied: write.count, existing: report.counts.migrated + data.length - write.count, conflict: report.counts.conflicting, failure: 0 };
    return { created: summary.applied, summary, report, idempotent: true, overwroteExistingRows: false };
  };
  if (!db.$transaction) return execute(db);
  try {
    return await db.$transaction(execute, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (isSerializationConflict(error)) {
      return db.$transaction(execute, { isolationLevel: 'Serializable' });
    }
    throw error;
  }
}

export function buildMigratedPortraitPayload(row: LegacyPortraitSnapshot, now: Date): PortraitV2Payload {
  if (!isMigratableSnapshot(row, now)) throw new Error('Legacy portrait has an invalid or future-dated six-dimensional competency vector.');
  const vector = row.competencyVector;
  const contributors = new Map<PortraitV2DimensionId, Array<{ source: keyof CompetencyVector; score: CompetencyVector[keyof CompetencyVector] }>>();
  for (const source of Object.keys(vector) as Array<keyof CompetencyVector>) {
    for (const target of mapLegacyCompetencyDimensionToPortraitV2(source).targetDimensions) {
      const current = contributors.get(target) ?? [];
      current.push({ source, score: vector[source] });
      contributors.set(target, current);
    }
  }
  return createPortraitV2Payload({
    userId: row.userId,
    generatedAt: now.toISOString(),
    now,
    derivation: {
      kind: 'migrated',
      sourceLegacySnapshotId: row.id,
      sourceLegacySnapshotAt: row.snapshotAt.toISOString(),
      mappingVersion: LEGACY_PORTRAIT_MIGRATION_MAPPING_VERSION,
      mappingConfidence: Object.fromEntries(PORTRAIT_V2_DIMENSION_IDS.map((id) => [
        id,
        id === 'simulationValidationEvidence' ? 'none' : id === 'reflectionImprovementAiCollab' ? 'medium' : 'high',
      ])),
      limitations: ['legacy-six-dimensional-input-is-non-authoritative'],
    },
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id) => {
      const sources = (contributors.get(id) ?? []).filter((item) => item.score.evidenceCount > 0);
      const hasEvidence = sources.length > 0;
      const lastUpdated = hasEvidence ? latest(sources.map((item) => item.score.lastUpdated)) : null;
      const evidenceCount = hasEvidence ? Math.max(...sources.map((item) => item.score.evidenceCount)) : 0;
      const age = lastUpdated ? Math.max(0, Math.floor((now.getTime() - Date.parse(lastUpdated)) / 86_400_000)) : null;
      return {
        id,
        score: hasEvidence ? average(sources.map((item) => item.score.score)) : 0,
        confidence: hasEvidence ? average(sources.map((item) => item.score.confidence)) * 0.7 : 0,
        trend: hasEvidence ? sources[0].score.trend : 'stable' as const,
        freshness: { state: hasEvidence ? age! <= 30 ? 'current' as const : age! <= PORTRAIT_V2_FRESHNESS_PARTIAL_MAX_AGE_DAYS ? 'partial' as const : 'stale' as const : 'missing' as const, asOf: lastUpdated, evidenceAgeDays: age },
        evidenceSummary: { totalCount: evidenceCount, sourceFamilyCounts: hasEvidence ? { StudentCompetencySnapshot: evidenceCount } : {} as Record<string, number> },
        lastPositiveEvidenceAt: hasEvidence && sources.some((item) => item.score.trend === 'up') ? latest(sources.filter((item) => item.score.trend === 'up').map((item) => item.score.lastUpdated)) : null,
        lastNegativeEvidenceAt: hasEvidence && sources.some((item) => item.score.trend === 'down') ? latest(sources.filter((item) => item.score.trend === 'down').map((item) => item.score.lastUpdated)) : null,
        rationale: hasEvidence ? 'Governed evidence supports the current score.' : 'No safe legacy mapping exists.',
        limitations: hasEvidence ? migrationLimitationsFor(id) : ['missing-native-portrait-v2-evidence'],
        sourceLineage: hasEvidence ? [
          { kind: 'evidence-family' as const, ref: 'StudentCompetencySnapshot', privacyScope: 'student-visible' as const },
          { kind: 'migration-snapshot' as const, ref: `legacy-snapshot:${row.id}`, privacyScope: 'audit-only' as const },
        ] : [],
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      };
    }),
  });
}

export function auditPortraitMigrationCompleteness(input: {
  now?: Date;
  legacySnapshots: LegacyPortraitSnapshot[];
  portraitSnapshots: ExistingPortraitSnapshot[];
  fixture?: {
    canonicalUserId: string | null;
    duplicateNameOnlyCount: number;
    workerStable: boolean;
    portrait?: ExistingPortraitSnapshot | null;
  };
}) {
  const now = input.now ?? new Date();
  const latestByUser = new Map<string, ExistingPortraitSnapshot>();
  for (const row of input.portraitSnapshots) {
    const current = latestByUser.get(row.userId);
    if (!current || (row.snapshotAt?.getTime() ?? 0) > (current.snapshotAt?.getTime() ?? 0)) latestByUser.set(row.userId, row);
  }
  const records: Array<{ state: 'native' | 'migrated' | 'stale' | 'unmigrated'; learnerRef: string; blocker?: string }> = [...latestByUser.values()].map((row) => {
    const stale = !row.snapshotAt || now.getTime() - row.snapshotAt.getTime() > PORTRAIT_V2_FRESHNESS_PARTIAL_MAX_AGE_DAYS * 86_400_000;
    const valid = isValidPortraitRow(row, now);
    if (!valid) return { state: 'unmigrated' as const, learnerRef: mask('learner', row.userId), blocker: 'invalid-portrait-v2-row' };
    if (stale) return { state: 'stale' as const, learnerRef: mask('learner', row.userId) };
    if (row.derivationKind === 'native') return { state: 'native' as const, learnerRef: mask('learner', row.userId) };
    if (row.derivationKind === 'migrated') return {
      state: 'migrated' as const,
      learnerRef: mask('learner', row.userId),
      ...(!row.payload.derivation.sourceLegacySnapshotAt ? { blocker: 'legacy-incomplete-migration-metadata' } : {}),
    };
    return { state: 'unmigrated' as const, learnerRef: mask('learner', row.userId), blocker: 'non-primary-derivation' };
  });
  const represented = new Set(latestByUser.keys());
  records.push(...input.legacySnapshots.filter((row) => !represented.has(row.userId)).map((row) => ({ state: 'unmigrated' as const, learnerRef: mask('learner', row.userId) })));
  const fixtureBlockers = [
    ...(!input.fixture?.canonicalUserId ? ['canonical-fixture-account-missing'] : []),
    ...(input.fixture?.canonicalUserId && !hasAllPortraitDimensions(input.fixture.portrait?.payload)
      ? ['canonical-fixture-seven-dimension-coverage-missing'] : []),
    ...(input.fixture?.canonicalUserId && !hasPortraitEvidenceLineage(input.fixture.portrait?.payload)
      ? ['canonical-fixture-evidence-lineage-missing'] : []),
    ...(input.fixture && !input.fixture.workerStable ? ['worker-recomputation-not-verified'] : []),
  ];
  return {
    contractVersion: 'portrait-v2-migration-completeness.v1' as const,
    privacy: { minimized: true, rawIdentifiersIncluded: false },
    counts: {
      native: records.filter((item) => item.state === 'native').length,
      migrated: records.filter((item) => item.state === 'migrated').length,
      stale: records.filter((item) => item.state === 'stale').length,
      unmigrated: records.filter((item) => item.state === 'unmigrated').length,
      fixtureBlocked: fixtureBlockers.length > 0 ? 1 : 0,
    },
    records,
    fixtureBlockers,
    duplicateNameOnlyAccountsIgnored: input.fixture?.duplicateNameOnlyCount ?? 0,
  };
}

function portraitRowData(payload: PortraitV2Payload) {
  return { userId: payload.userId, snapshotAt: new Date(payload.generatedAt), payloadVersion: PORTRAIT_V2_PAYLOAD_VERSION, calculationVersion: PORTRAIT_V2_CALCULATION_VERSION, migrationVersion: PORTRAIT_V2_MIGRATION_VERSION, derivationKind: payload.derivation.kind, sourceLegacySnapshotId: payload.derivation.sourceLegacySnapshotId, payload };
}

function isCompetencyVector(value: unknown): value is CompetencyVector {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return ['controlModeling', 'parameterDesign', 'crossDomainTransfer', 'engineeringDecision', 'inquiryReflection', 'selfDirectedLearning'].every((key) => {
    const score = (value as any)[key];
    return score && Number.isFinite(score.score) && score.score >= 0 && score.score <= 100 && Number.isFinite(score.confidence) && score.confidence >= 0 && score.confidence <= 1 && Number.isInteger(score.evidenceCount) && score.evidenceCount >= 0 && ['up', 'stable', 'down'].includes(score.trend) && Number.isFinite(Date.parse(score.lastUpdated));
  });
}

function isMigratableSnapshot(row: LegacyPortraitSnapshot, now: Date): row is LegacyPortraitSnapshot & { competencyVector: CompetencyVector } {
  if (!isCompetencyVector(row.competencyVector) || row.snapshotAt.getTime() > now.getTime()) return false;
  const maxEvidenceAt = row.snapshotAt.getTime() + 5 * 60 * 1000;
  return Object.values(row.competencyVector).every((score) => Date.parse(score.lastUpdated) <= Math.min(maxEvidenceAt, now.getTime()));
}
function hasAnyLegacyEvidence(vector: CompetencyVector) { return Object.values(vector).some((score) => score.evidenceCount > 0); }
function migrationLimitationsFor(id: PortraitV2DimensionId) {
  return [
    ...(['controlModelingRepresentation', 'systemAnalysisInterpretation'].includes(id)
      ? ['legacy-control-modeling-combines-representation-and-analysis'] : []),
    ...(id === 'reflectionImprovementAiCollab'
      ? ['legacy-self-directed-learning-partially-represents-reflection-ai-collaboration'] : []),
  ];
}
function isSerializationConflict(error: unknown) { return Boolean(error && typeof error === 'object' && (error as any).code === 'P2034'); }
function isValidPortraitRow(row: ExistingPortraitSnapshot, now: Date) {
  try {
    validatePortraitV2Payload(row.payload, { now });
    return row.payload.userId === row.userId && row.payload.derivation.kind === row.derivationKind &&
      row.payload.generatedAt === row.snapshotAt?.toISOString();
  } catch { return false; }
}

function groupBy<T>(rows: T[], key: (row: T) => string) { const map = new Map<string, T[]>(); for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]); return map; }
function mask(kind: string, value: string) { return `${kind}:sha256:${createHash('sha256').update(value).digest('hex').slice(0, 12)}`; }
function average(values: number[]) { return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100; }
function latest(values: string[]) { return [...values].sort((a, b) => Date.parse(b) - Date.parse(a))[0]; }
function bucketReason(bucket: MigrationBucket) { return ({ eligible: 'valid-legacy-snapshot-no-primary-conflict', migrated: 'source-snapshot-already-migrated', skipped: 'explicitly-out-of-scope', conflicting: 'native-primary-portrait-exists-no-overwrite', unmigrated: 'invalid-or-incomplete-legacy-vector' } as const)[bucket]; }
function hasAllPortraitDimensions(payload: any) { const ids = Array.isArray(payload?.dimensions) ? payload.dimensions.map((item: any) => item.id) : []; return PORTRAIT_V2_DIMENSION_IDS.every((id) => ids.includes(id)); }
function hasPortraitEvidenceLineage(payload: any) { return Array.isArray(payload?.dimensions) && payload.dimensions.every((item: any) => item.freshness?.state === 'missing' || (Array.isArray(item.sourceLineage) && item.sourceLineage.length > 0)); }
