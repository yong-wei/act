import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  readCurrentCumulativeClassPortrait,
  readCurrentCumulativePortrait,
  type CumulativeClassPortraitReadDb,
  type CumulativePortraitReadDb,
} from '@/lib/data-governance/cumulative-portrait-read-model';
import { PORTRAIT_V2_DIMENSIONS } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  createPortraitV2Payload,
  PORTRAIT_V2_CALCULATION_VERSION,
} from '@/lib/data-governance/portrait-v2-model';
import { projectSimulationTaskAttainment } from '@/lib/data-governance/simulation-task-portrait-projection';

const GENERATED_AT = new Date('2025-12-01T08:00:00.000Z');

function nativePayload() {
  return createPortraitV2Payload({
    userId: 'student-1',
    generatedAt: GENERATED_AT.toISOString(),
    now: GENERATED_AT,
    dimensions: PORTRAIT_V2_DIMENSIONS.map(({ id }, index) => ({
      id,
      score: 70 + index,
      confidence: 0.8,
      trend: 'stable',
      freshness: {
        state: 'current',
        asOf: GENERATED_AT.toISOString(),
        evidenceAgeDays: 0,
      },
      evidenceSummary: {
        totalCount: 2,
        sourceFamilyCounts: { LearningFact: 2 },
      },
      lastPositiveEvidenceAt: GENERATED_AT.toISOString(),
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [
        {
          kind: 'evidence-family',
          ref: 'LearningFact',
          privacyScope: 'student-visible',
        },
        {
          kind: 'citation',
          ref: `citation-target:sha256:${String(index).padStart(64, '0')}`,
          privacyScope: 'student-visible',
        },
        {
          kind: 'hashed',
          ref: `sar:evidence:sha256:${String(index).padStart(64, '0')}`,
          privacyScope: 'student-visible',
        },
        {
          kind: 'aggregate',
          ref: `aggregate:sha256:${String(index).padStart(64, '0')}`,
          privacyScope: 'student-visible',
        },
        {
          kind: 'raw-source',
          ref: 'raw-source:fact-raw-id-must-not-leak',
          privacyScope: 'system-internal',
        },
      ],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
  });
}

function fixture(overrides: {
  current?: Record<string, unknown> | null;
  fence?: Record<string, unknown> | null;
  pendingReconciliation?: boolean;
  run?: Record<string, unknown> | null;
} = {}) {
  const payload = nativePayload();
  const fence = overrides.fence === undefined
    ? {
        fence: BigInt(7),
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        learnerGeneration: BigInt(4),
        queueGeneration: BigInt(9),
        activeMigrationRunId: 'migration-989',
      }
    : overrides.fence;
  const stateVersion = {
    id: 'state-1',
    userId: 'student-1',
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    generation: BigInt(4),
    queueGeneration: BigInt(9),
    stateWatermark: BigInt(12),
    taskInputDigest: 'task-input-1',
    stateKind: 'SNAPSHOT',
    snapshotId: 'snapshot-1',
    overallScore: 73,
    dimensionCoverage: {
      evidencedDimensionIds: PORTRAIT_V2_DIMENSIONS.map(({ id }) => id),
      missingDimensionIds: [],
    },
    evidenceAsOf: GENERATED_AT,
    confidence: 0.8,
    lastTrend: 'stable',
    lastRisk: [
      { type: 'constraint', severity: 'medium', occurredAt: GENERATED_AT.toISOString() },
      { type: 'participation', severity: 'high', supportFactIds: ['fact-1'] },
    ],
    availabilityReason: 'available',
    generatedAt: new Date('2026-07-23T08:00:00.000Z'),
    cutoverFence: BigInt(7),
    migrationRunId: 'migration-989',
    snapshot: {
      id: 'snapshot-1',
      userId: 'student-1',
      snapshotAt: GENERATED_AT,
      payloadVersion: payload.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: payload.migrationVersion,
      derivationKind: 'native',
      payload,
    },
  };
  const current = overrides.current === undefined
    ? {
        userId: 'student-1',
        stateVersionId: 'state-1',
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        generation: BigInt(4),
        queueGeneration: BigInt(9),
        stateWatermark: BigInt(12),
        taskInputDigest: 'task-input-1',
        cutoverFence: BigInt(7),
        stateVersion,
      }
    : overrides.current;
  const run = overrides.run === undefined
    ? {
        id: 'migration-989',
        mode: 'APPLY',
        status: 'COMPLETED',
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        learnerGeneration: BigInt(4),
        queueGeneration: BigInt(9),
        cutoverFence: BigInt(7),
      }
    : overrides.run;
  const db = {
    cumulativePortraitCutoverFence: {
      findUnique: vi.fn().mockResolvedValue(fence),
    },
    cumulativePortraitMigrationRun: {
      findUnique: vi.fn().mockResolvedValue(run),
    },
    learnerPortraitCurrentState: {
      findUnique: vi.fn().mockResolvedValue(current),
    },
    learningMaterializationRebuildRequest: {
      findFirst: vi.fn().mockResolvedValue(
        overrides.pendingReconciliation ? { userId: 'student-1' } : null,
      ),
    },
  } as unknown as CumulativePortraitReadDb;
  return { db, current, stateVersion };
}

describe('readCurrentCumulativePortrait', () => {
  it.each(['RUNNING', 'PLANNED', 'FAILED'] as const)(
    'fails closed while the active migration run is %s',
    async (status) => {
      const { db } = fixture({
        run: {
          id: 'migration-989',
          mode: 'APPLY',
          status,
          calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
          learnerGeneration: BigInt(4),
          queueGeneration: BigInt(9),
          cutoverFence: BigInt(7),
        },
      });

      await expect(readCurrentCumulativePortrait(db, 'student-1')).resolves.toMatchObject({
        stateKind: 'UNAVAILABLE',
        payload: null,
        availabilityReason: 'migration-in-progress',
      });
      expect(db.learnerPortraitCurrentState.findUnique).not.toHaveBeenCalled();
    },
  );

  it('accepts the current portrait only after the matching APPLY run is completed', async () => {
    const { db } = fixture();

    await expect(readCurrentCumulativePortrait(db, 'student-1')).resolves.toMatchObject({
      stateKind: 'SNAPSHOT',
      availabilityReason: 'available',
    });
    expect(db.cumulativePortraitMigrationRun.findUnique).toHaveBeenCalledWith({
      where: { id: 'migration-989' },
    });
  });

  it('fails closed while an active cumulative reconciliation is pending', async () => {
    const { db } = fixture({ pendingReconciliation: true });

    await expect(readCurrentCumulativePortrait(db, 'student-1')).resolves.toMatchObject({
      stateKind: 'UNAVAILABLE',
      payload: null,
      availabilityReason: 'reconciliation-pending',
    });
    expect(db.learnerPortraitCurrentState.findUnique).not.toHaveBeenCalled();
  });

  it('returns an old but still current native cumulative portrait without time decay', async () => {
    const { db } = fixture();

    const result = await readCurrentCumulativePortrait(db, 'student-1');

    expect(result).toMatchObject({
      stateKind: 'SNAPSHOT',
      overallScore: 73,
      evidenceAsOf: GENERATED_AT.toISOString(),
      availabilityReason: 'available',
      lastTrend: 'stable',
      lastRisk: [{
        type: 'constraint',
        severity: 'medium',
        occurredAt: GENERATED_AT.toISOString(),
      }],
    });
    expect(result.payload?.derivation.kind).toBe('native');
    expect(result.publication).toEqual({
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      generation: '4',
      queueGeneration: '9',
      cutoverFence: '7',
      stateWatermark: '12',
      processingWatermark: '9',
      captureRevision: 'state-1',
      inputDigest: 'task-input-1',
    });
    expect(JSON.stringify(result)).not.toContain('fact-raw-id-must-not-leak');
    expect(JSON.stringify(result)).not.toContain('participation');
    expect(db.learnerPortraitCurrentState.findUnique).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the current pointer generation differs from the active fence', async () => {
    const base = fixture();
    const { db } = fixture({
      current: {
        ...(base.current as Record<string, unknown>),
        queueGeneration: BigInt(8),
      },
    });

    await expect(readCurrentCumulativePortrait(db, 'student-1')).resolves.toMatchObject({
      stateKind: 'UNAVAILABLE',
      payload: null,
      availabilityReason: 'current-state-version-mismatch',
    });
  });

  it('fails closed when the task input identity differs from the selected state version', async () => {
    const base = fixture();
    const { db } = fixture({
      current: {
        ...(base.current as Record<string, unknown>),
        taskInputDigest: 'task-input-drifted',
      },
    });

    await expect(readCurrentCumulativePortrait(db, 'student-1')).resolves.toMatchObject({
      stateKind: 'UNAVAILABLE',
      payload: null,
      availabilityReason: 'current-state-version-mismatch',
    });
  });

  it('fails closed when persisted task attainment uses a stale catalog digest', async () => {
    const base = fixture();
    const payload = structuredClone(
      (base.stateVersion.snapshot as { payload: ReturnType<typeof nativePayload> }).payload,
    );
    const simulation = payload.dimensions.find((dimension) =>
      dimension.id === 'simulationValidationEvidence')!;
    simulation.taskAttainment = {
      ...projectSimulationTaskAttainment([]),
      catalogDigest: '0'.repeat(64),
    };
    const stateVersion = {
      ...base.stateVersion,
      snapshot: {
        ...(base.stateVersion.snapshot as Record<string, unknown>),
        payload,
      },
    };
    const { db } = fixture({
      current: {
        ...(base.current as Record<string, unknown>),
        stateVersion,
      },
    });

    await expect(readCurrentCumulativePortrait(db, 'student-1')).resolves.toMatchObject({
      stateKind: 'UNAVAILABLE',
      payload: null,
      availabilityReason: 'current-state-version-mismatch',
    });
  });

  it('returns the current no-evidence tombstone without scanning historical snapshots', async () => {
    const base = fixture();
    const stateVersion = {
      ...base.stateVersion,
      stateKind: 'NO_EVIDENCE',
      snapshotId: null,
      snapshot: null,
      overallScore: null,
      evidenceAsOf: null,
      confidence: null,
      dimensionCoverage: {
        evidencedDimensionIds: [],
        missingDimensionIds: PORTRAIT_V2_DIMENSIONS.map(({ id }) => id),
      },
      availabilityReason: 'no-evidence-after-revocation',
    };
    const { db } = fixture({
      current: {
        ...(base.current as Record<string, unknown>),
        stateVersion,
      },
    });

    await expect(readCurrentCumulativePortrait(db, 'student-1')).resolves.toMatchObject({
      stateKind: 'NO_EVIDENCE',
      payload: null,
      overallScore: null,
      availabilityReason: 'no-evidence-after-revocation',
    });
  });

  it('rejects a compatibility-derived snapshot referenced by the current pointer', async () => {
    const base = fixture();
    const stateVersion = {
      ...base.stateVersion,
      snapshot: {
        ...(base.stateVersion.snapshot as Record<string, unknown>),
        derivationKind: 'compatibility-derived',
      },
    };
    const { db } = fixture({
      current: {
        ...(base.current as Record<string, unknown>),
        stateVersion,
      },
    });

    await expect(readCurrentCumulativePortrait(db, 'student-1')).resolves.toMatchObject({
      stateKind: 'UNAVAILABLE',
      payload: null,
      availabilityReason: 'invalid-current-snapshot',
    });
  });
});

function classFixture(overrides: {
  current?: Record<string, unknown> | null;
  fence?: Record<string, unknown> | null;
  memberIds?: string[];
} = {}) {
  const aggregateDimension = {
    label: '维度',
    mean: 75,
    meanConfidence: 0.8,
    includedCount: 1,
    missingCount: 0,
  };
  const coverageDimension = {
    includedCount: 1,
    missingCount: 0,
    meanConfidence: 0.8,
  };
  const fence = overrides.fence === undefined
    ? {
        fence: BigInt(7),
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        learnerGeneration: BigInt(4),
        classMaterializationVersion: 'class-competency.cumulative.v2',
        classGeneration: BigInt(5),
        queueGeneration: BigInt(9),
        activeMigrationRunId: 'migration-989',
      }
    : overrides.fence;
  const version = {
    id: 'class-version-1',
    classId: 'class-1',
    materializationVersion: 'class-competency.cumulative.v2',
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    generation: BigInt(5),
    queueGeneration: BigInt(9),
    migrationRunId: 'migration-989',
    inputDigest: 'digest-1',
    memberSetDigest: createHash('sha256')
      .update(JSON.stringify(['student-1']))
      .digest('hex'),
    sourcePortraitVersions: [{ userId: 'student-1', stateVersionId: 'state-1' }],
    evidenceAsOf: GENERATED_AT,
    aggregateJson: {
      overall: {
        mean: 75,
        meanConfidence: 0.8,
        includedCount: 1,
        missingCount: 0,
      },
      dimensions: Object.fromEntries(PORTRAIT_V2_DIMENSIONS.map(({ id, label }) => [
        id,
        { ...aggregateDimension, label },
      ])),
    },
    dimensionCoverage: {
      totalMembers: 1,
      portraitMembers: 1,
      missingPortraitMembers: 0,
      overall: coverageDimension,
      dimensions: Object.fromEntries(PORTRAIT_V2_DIMENSIONS.map(({ id }) => [
        id,
        coverageDimension,
      ])),
    },
    trendDistribution: { up: 1, stable: 0, down: 0, 'not-comparable': 0 },
    riskDistribution: {
      membersWithRisk: 1,
      membersWithoutRisk: 0,
      byType: { constraint: 1, participation: 9 },
      bySeverity: { medium: 1 },
    },
    diagnosis: {
      strengths: ['controlModelingRepresentation'],
      improvementClusters: ['engineeringConstraintSafety'],
      limitations: [],
    },
    activeStudentCount: 1,
    totalStudentCount: 1,
    cutoverFence: BigInt(7),
    generatedAt: new Date('2026-07-23T08:00:00.000Z'),
  };
  const current = overrides.current === undefined
    ? {
        classId: 'class-1',
        versionId: 'class-version-1',
        materializationVersion: 'class-competency.cumulative.v2',
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        generation: BigInt(5),
        queueGeneration: BigInt(9),
        migrationRunId: 'migration-989',
        inputDigest: 'digest-1',
        cutoverFence: BigInt(7),
        version,
      }
    : overrides.current;
  const db = {
    studentProfile: {
      findMany: vi.fn().mockResolvedValue(
        (overrides.memberIds ?? ['student-1']).map((userId) => ({ userId })),
      ),
    },
    cumulativePortraitCutoverFence: {
      findUnique: vi.fn().mockResolvedValue(fence),
    },
    cumulativePortraitMigrationRun: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'migration-989',
        mode: 'APPLY',
        status: 'COMPLETED',
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        classMaterializationVersion: 'class-competency.cumulative.v2',
        learnerGeneration: BigInt(4),
        classGeneration: BigInt(5),
        queueGeneration: BigInt(9),
        cutoverFence: BigInt(7),
      }),
    },
    classCumulativePortraitCurrentState: {
      findUnique: vi.fn().mockResolvedValue(current),
    },
  } as unknown as CumulativeClassPortraitReadDb;
  return { db, current, version };
}

describe('readCurrentCumulativeClassPortrait', () => {
  it('returns only a current fenced cumulative v2 class portrait', async () => {
    const { db } = classFixture();

    const result = await readCurrentCumulativeClassPortrait(db, 'class-1');

    expect(result).toMatchObject({
      stateKind: 'SNAPSHOT',
      availabilityReason: 'available',
      materializationVersion: 'class-competency.cumulative.v2',
      evidenceAsOf: GENERATED_AT.toISOString(),
      trendDistribution: { up: 1, stable: 0, down: 0, 'not-comparable': 0 },
      riskDistribution: {
        membersWithRisk: 1,
        byType: { constraint: 1 },
      },
    });
    expect(JSON.stringify(result)).not.toContain('participation');
  });

  it('fails closed when the class current pointer generation differs from the active fence', async () => {
    const base = classFixture();
    const { db } = classFixture({
      current: {
        ...(base.current as Record<string, unknown>),
        generation: BigInt(4),
      },
    });

    await expect(readCurrentCumulativeClassPortrait(db, 'class-1')).resolves.toMatchObject({
      stateKind: 'UNAVAILABLE',
      availabilityReason: 'current-state-version-mismatch',
      aggregate: null,
    });
  });

  it('fails closed while the current roster differs from the immutable member set', async () => {
    const { db } = classFixture({
      memberIds: ['student-1', 'student-2'],
    });

    await expect(readCurrentCumulativeClassPortrait(db, 'class-1')).resolves.toMatchObject({
      stateKind: 'UNAVAILABLE',
      availabilityReason: 'reconciliation-pending',
      aggregate: null,
    });
  });

  it('fails closed when the migration run learner generation differs from the active fence', async () => {
    const { db } = classFixture();
    vi.mocked(db.cumulativePortraitMigrationRun.findUnique).mockResolvedValue({
      id: 'migration-989',
      mode: 'APPLY',
      status: 'COMPLETED',
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      classMaterializationVersion: 'class-competency.cumulative.v2',
      learnerGeneration: BigInt(3),
      classGeneration: BigInt(5),
      queueGeneration: BigInt(9),
      cutoverFence: BigInt(7),
    });

    await expect(readCurrentCumulativeClassPortrait(db, 'class-1')).resolves.toMatchObject({
      stateKind: 'UNAVAILABLE',
      availabilityReason: 'current-state-version-mismatch',
    });
  });

  it('does not accept a legacy cumulative v1 row as the current version', async () => {
    const base = classFixture();
    const { db } = classFixture({
      current: {
        ...(base.current as Record<string, unknown>),
        materializationVersion: 'class-competency.cumulative.v1',
      },
    });

    await expect(readCurrentCumulativeClassPortrait(db, 'class-1')).resolves.toMatchObject({
      stateKind: 'UNAVAILABLE',
      availabilityReason: 'current-state-version-mismatch',
    });
  });

  it('fails closed when the pointed immutable class projection is malformed', async () => {
    const base = classFixture();
    const { db } = classFixture({
      current: {
        ...(base.current as Record<string, unknown>),
        version: {
          ...base.version,
          trendDistribution: { up: 1 },
        },
      },
    });

    await expect(readCurrentCumulativeClassPortrait(db, 'class-1')).resolves.toMatchObject({
      stateKind: 'UNAVAILABLE',
      availabilityReason: 'invalid-current-snapshot',
    });
  });
});
