import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { PORTRAIT_V2_DIMENSION_IDS } from '../kaq-objective-taxonomy';
import {
  applyLegacyPortraitMigration,
  auditPortraitMigrationCompleteness,
  buildLegacyPortraitMigrationDryRun,
  buildMigratedPortraitPayload,
  type LegacyPortraitMigrationDb,
} from '../portrait-v2-migration';
import { materializeIncrementalPortraitV2 } from '../portrait-v2-materialization';
import { buildYangFanPortraitV2FixtureFacts, resolveCanonicalYangFanAccount } from '../yangfan-diagnostic-fixture';
import { createPortraitV2Payload, PORTRAIT_V2_CALCULATION_VERSION, validatePortraitV2Payload } from '../portrait-v2-model';

const now = new Date('2026-07-11T00:00:00.000Z');

function legacy(id: string, userId = `user-${id}`, snapshotAt = new Date('2026-07-10T00:00:00.000Z')) {
  const score = (value: number) => ({ score: value, confidence: 0.8, evidenceCount: 3, trend: 'up', lastUpdated: snapshotAt.toISOString() });
  return {
    id,
    userId,
    snapshotAt,
    calculationVersion: 'legacy.v1',
    competencyVector: {
      controlModeling: score(70), parameterDesign: score(71), crossDomainTransfer: score(72),
      engineeringDecision: score(73), inquiryReflection: score(74), selfDirectedLearning: score(75),
    },
  };
}

function dbFor(rows: any[], existing: any[] = []): LegacyPortraitMigrationDb & { created: any[] } {
  const created: any[] = [];
  return {
    created,
    studentCompetencySnapshot: { findMany: async () => rows },
    studentPortraitV2Snapshot: {
      findMany: async () => [...existing, ...created],
      create: async ({ data }) => { created.push(data); return { id: `v2-${created.length}`, ...data }; },
      createMany: async ({ data }) => { created.push(...data); return { count: data.length }; },
    },
  };
}

function native(userId: string, generatedAt: Date) {
  return createPortraitV2Payload({
    userId, generatedAt: generatedAt.toISOString(), now,
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id) => ({
      id, score: 0, confidence: 0, freshness: { state: 'missing', asOf: null, evidenceAgeDays: null },
      evidenceSummary: { totalCount: 0, sourceFamilyCounts: {} }, lastPositiveEvidenceAt: null,
      lastNegativeEvidenceAt: null, rationale: 'No safe legacy mapping exists.',
      limitations: ['missing-native-portrait-v2-evidence'], sourceLineage: [],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
  });
}

describe('portrait v2 legacy migration', () => {
  it('does not report fixture blockers when fixture auditing is not requested', () => {
    const report = auditPortraitMigrationCompleteness({
      now,
      legacySnapshots: [],
      portraitSnapshots: [],
    });

    expect(report.counts.fixtureBlocked).toBe(0);
    expect(report.fixtureBlockers).toEqual([]);
  });

  it('reports every dry-run bucket with privacy-minimized ids and explicit mappings', async () => {
    const skipped = legacy('skipped');
    Object.values(skipped.competencyVector).forEach((score) => { score.evidenceCount = 0; });
    const rows = [legacy('eligible'), legacy('migrated'), legacy('conflict'), { ...legacy('invalid'), competencyVector: {} }, skipped];
    const db = dbFor(rows, [
      { id: 'v2-a', userId: 'user-migrated', derivationKind: 'migrated', payload: { derivation: { sourceLegacySnapshotId: 'migrated' } } },
      { id: 'v2-b', userId: 'user-conflict', derivationKind: 'native', payload: { derivation: { kind: 'native' } } },
    ]);
    const report = await buildLegacyPortraitMigrationDryRun(db, { now });

    expect(report.counts).toEqual({ eligible: 1, migrated: 1, skipped: 1, conflicting: 1, unmigrated: 1 });
    expect(report.records.flatMap((bucket) => bucket.records).every((item) => item.learnerRef.startsWith('learner:sha256:'))).toBe(true);
    expect(JSON.stringify(report)).not.toContain('user-eligible');
    expect(report.mapping.every((item) => item.confidence && Array.isArray(item.limitations))).toBe(true);
  });

  it('requires complete migrated metadata and rejects it on native payloads', () => {
    const migrated = buildMigratedPortraitPayload(legacy('metadata'), now);
    for (const field of ['sourceLegacySnapshotId', 'sourceLegacySnapshotAt', 'mappingVersion', 'mappingConfidence'] as const) {
      const invalid = structuredClone(migrated) as any;
      delete invalid.derivation[field];
      expect(() => validatePortraitV2Payload(invalid, { now })).toThrow('derivation metadata');
    }
    const incomplete = structuredClone(migrated) as any;
    delete incomplete.derivation.mappingConfidence[PORTRAIT_V2_DIMENSION_IDS[0]];
    expect(() => validatePortraitV2Payload(incomplete, { now })).toThrow('derivation metadata');
    const invalidNative = native('native-with-migration', now) as any;
    invalidNative.derivation.mappingVersion = 'forbidden';
    expect(() => validatePortraitV2Payload(invalidNative, { now })).toThrow('derivation metadata');

    const legacyIncomplete = structuredClone(migrated) as any;
    delete legacyIncomplete.derivation.sourceLegacySnapshotAt;
    delete legacyIncomplete.derivation.mappingVersion;
    delete legacyIncomplete.derivation.mappingConfidence;
    expect(() => validatePortraitV2Payload(legacyIncomplete, { now })).not.toThrow();
    expect(() => createPortraitV2Payload({
      userId: 'new-incomplete', generatedAt: now.toISOString(), now,
      derivation: legacyIncomplete.derivation,
      dimensions: legacyIncomplete.dimensions,
    })).toThrow('complete migration metadata');
  });

  it('creates one row under concurrent apply and reports the loser as existing', async () => {
    const created: any[] = [];
    const db: LegacyPortraitMigrationDb = {
      studentCompetencySnapshot: { findMany: async () => [legacy('race')] },
      studentPortraitV2Snapshot: {
        findMany: async () => created,
        findFirst: async () => created[0] ?? null,
        create: async ({ data }) => {
          await Promise.resolve();
          if (created.length) throw Object.assign(new Error('unique'), { code: 'P2002' });
          const row = { id: 'race-v2', ...data } as any; created.push(row); return row;
        },
        createMany: async ({ data }) => {
          await Promise.resolve();
          const fresh = data.filter((item: any) => !created.some((row) => row.userId === item.userId && row.sourceLegacySnapshotId === item.sourceLegacySnapshotId));
          created.push(...fresh); return { count: fresh.length };
        },
      },
    };
    const results = await Promise.all([
      applyLegacyPortraitMigration(db, { now }),
      applyLegacyPortraitMigration(db, { now }),
    ]);
    expect(created).toHaveLength(1);
    expect(results.reduce((sum, item) => sum + item.summary.applied, 0)).toBe(1);
    expect(results.reduce((sum, item) => sum + item.summary.existing, 0)).toBe(1);
  });

  it('propagates unknown batch errors so the transaction can roll back and the CLI exits nonzero', async () => {
    const db = dbFor([legacy('boom')]);
    db.studentPortraitV2Snapshot.createMany = async () => { throw new Error('database unavailable'); };
    await expect(applyLegacyPortraitMigration(db, { now })).rejects.toThrow('database unavailable');
  });

  it('marks readable legacy-incomplete migrated rows with an explicit completeness blocker', () => {
    const payload = structuredClone(buildMigratedPortraitPayload(legacy('old-source', 'old-user'), now)) as any;
    delete payload.derivation.sourceLegacySnapshotAt;
    delete payload.derivation.mappingVersion;
    delete payload.derivation.mappingConfidence;
    const report = auditPortraitMigrationCompleteness({
      now, legacySnapshots: [],
      portraitSnapshots: [{ id: 'old', userId: 'old-user', snapshotAt: now, derivationKind: 'migrated', payload }],
    });
    expect(report.records[0]).toMatchObject({ state: 'migrated', blocker: 'legacy-incomplete-migration-metadata' });
  });

  it('backfills lineage before duplicate detection and unique-index creation', () => {
    const sql = readFileSync('prisma/migrations/20260711183000_harden_portrait_v2_migration_idempotency/migration.sql', 'utf8');
    expect(sql.indexOf('UPDATE "StudentPortraitV2Snapshot"')).toBeLessThan(sql.indexOf('DO $$'));
    expect(sql.indexOf('DO $$')).toBeLessThan(sql.indexOf('CREATE UNIQUE INDEX'));
    expect(sql).toContain("RAISE EXCEPTION 'duplicate migrated portrait lineage detected");
  });

  it('applies once, retains source lineage, and never overwrites native rows', async () => {
    const db = dbFor([legacy('a')]);
    const first = await applyLegacyPortraitMigration(db, { now });
    const payload = db.created[0].payload;
    expect(first.created).toBe(1);
    expect(payload.derivation).toMatchObject({
      kind: 'migrated',
      sourceLegacySnapshotId: 'a',
      sourceLegacySnapshotAt: '2026-07-10T00:00:00.000Z',
      mappingVersion: 'legacy-six-to-portrait-v2.v1',
    });
    expect(Object.keys(payload.derivation.mappingConfidence)).toEqual(PORTRAIT_V2_DIMENSION_IDS);
    expect(payload.dimensions.flatMap((item: any) => item.sourceLineage).some((ref: any) => ref.ref === 'legacy-snapshot:a')).toBe(true);

    db.studentPortraitV2Snapshot.findMany = async () => db.created;
    const second = await applyLegacyPortraitMigration(db, { now });
    expect(second.created).toBe(0);
    expect(db.created).toHaveLength(1);
  });

  it('maps a legacy snapshot into all seven governed dimensions', () => {
    const payload = buildMigratedPortraitPayload(legacy('all-seven'), now);
    expect(payload.dimensions.map((item) => item.id)).toEqual(PORTRAIT_V2_DIMENSION_IDS);
    expect(payload.dimensions.find((item) => item.id === 'simulationValidationEvidence')).toMatchObject({ score: 0, confidence: 0 });
  });

  it('classifies native, migrated, stale, unmigrated, and fixture-blocked without raw identifiers', () => {
    const nativePayload = native('native-user', now);
    const migratedPayload = buildMigratedPortraitPayload(legacy('migrated-source', 'migrated-user'), now);
    const staleAt = new Date('2026-01-01T00:00:00.000Z');
    const stalePayload = native('stale-user', staleAt);
    const report = auditPortraitMigrationCompleteness({
      now,
      legacySnapshots: [legacy('legacy-only')],
      portraitSnapshots: [
        { id: 'native', userId: 'native-user', snapshotAt: now, derivationKind: 'native', payload: nativePayload },
        { id: 'migrated', userId: 'migrated-user', snapshotAt: now, derivationKind: 'migrated', payload: migratedPayload },
        { id: 'stale', userId: 'stale-user', snapshotAt: staleAt, derivationKind: 'native', payload: stalePayload },
      ],
      fixture: { canonicalUserId: null, duplicateNameOnlyCount: 1, workerStable: false },
    });
    expect(report.counts).toEqual({ native: 1, migrated: 1, stale: 1, unmigrated: 1, fixtureBlocked: 1 });
    expect(report.fixtureBlockers).toEqual(expect.arrayContaining(['canonical-fixture-account-missing', 'worker-recomputation-not-verified']));
    expect(JSON.stringify(report)).not.toContain('native-user');
  });

  it('does not turn Yang Fan fixture facts into a trusted native portrait', async () => {
    const facts = buildYangFanPortraitV2FixtureFacts('canonical-yangfan', new Date('2026-07-10T22:00:00.000Z'))
      .map((fact) => ({ ...fact, createdAt: fact.createdAt as Date }));
    let written: any = null;
    const result = await materializeIncrementalPortraitV2({
      learningFact: { findMany: async () => facts },
      studentPortraitV2Snapshot: {
        findFirst: async () => null,
        create: async ({ data }) => { written = data; return { id: 'yangfan-v2', ...data }; },
      },
    }, 'canonical-yangfan', { now });

    expect(result.written).toBe(false);
    expect(result.evidenceCount).toBe(0);
    expect(written).toBeNull();
    expect(auditPortraitMigrationCompleteness({
      now,
      legacySnapshots: [],
      portraitSnapshots: [],
      fixture: {
        canonicalUserId: 'canonical-yangfan',
        duplicateNameOnlyCount: 2,
        workerStable: true,
      },
    }).fixtureBlockers).toEqual(expect.arrayContaining([
      'canonical-fixture-seven-dimension-coverage-missing',
      'canonical-fixture-evidence-lineage-missing',
    ]));
  });

  it('resolves Yang Fan only when canonical email and student number match one account', () => {
    const exact = { id: 'exact', email: 'yangfan@example.test', profile: { studentNumber: '20230010102605' }, name: '杨帆' };
    expect(resolveCanonicalYangFanAccount([exact], exact.email, exact.profile.studentNumber)?.id).toBe('exact');
    expect(resolveCanonicalYangFanAccount([{ ...exact, email: 'other@example.test' }], exact.email, exact.profile.studentNumber)).toBeNull();
    expect(resolveCanonicalYangFanAccount([{ ...exact, profile: { studentNumber: 'other' } }], exact.email, exact.profile.studentNumber)).toBeNull();
    expect(resolveCanonicalYangFanAccount([exact, { ...exact, id: 'duplicate' }], exact.email, exact.profile.studentNumber)).toBeNull();
    expect(resolveCanonicalYangFanAccount([{ ...exact, id: 'same-name', email: null, profile: null }], exact.email, exact.profile.studentNumber)).toBeNull();
  });
});
