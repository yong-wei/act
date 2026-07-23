import { describe, expect, it, vi } from 'vitest';

import {
  CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
  materializeCumulativeClassPortrait,
} from '../cumulative-class-materialization';
import { PORTRAIT_V2_CALCULATION_VERSION } from '../portrait-v2-model';

const oldEvidenceAt = new Date('2024-01-01T00:00:00.000Z');

function portrait(userId: string, scores: Array<number | null>, trend = 'stable') {
  return {
    userId,
    stateVersionId: `state-${userId}`,
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    generation: BigInt(7),
    queueGeneration: BigInt(11),
    cutoverFence: BigInt(4),
    stateVersion: {
      id: `state-${userId}`,
      stateKind: 'SNAPSHOT' as const,
      evidenceAsOf: oldEvidenceAt,
      lastTrend: trend,
      lastRisk: null,
      snapshot: {
        derivationKind: 'native',
        payload: {
          userId,
          payloadVersion: 'portrait-v2',
          migrationVersion: 'portrait-v2-migration.v1',
          generatedAt: oldEvidenceAt.toISOString(),
          derivation: { kind: 'native', limitations: [] },
          dimensions: [
            'controlModelingRepresentation',
            'systemAnalysisInterpretation',
            'controllerDesignSynthesis',
            'simulationValidationEvidence',
            'engineeringConstraintSafety',
            'transferIntegratedApplication',
            'reflectionImprovementAiCollab',
          ].map((id, index) => ({
            id,
            label: id,
            score: scores[index] ?? 0,
            confidence: scores[index] === null ? 0 : 0.8,
            trend: 'stable',
            freshness: {
              state: scores[index] === null ? 'missing' : 'stale',
              asOf: scores[index] === null ? null : oldEvidenceAt.toISOString(),
              evidenceAgeDays: scores[index] === null ? null : 900,
            },
            evidenceSummary: {
              totalCount: scores[index] === null ? 0 : 2,
              sourceFamilyCounts: scores[index] === null ? {} : { LearningFact: 2 },
            },
            lastPositiveEvidenceAt: scores[index] === null ? null : oldEvidenceAt.toISOString(),
            lastNegativeEvidenceAt: null,
            rationale: 'historical governed evidence',
            limitations: [],
            sourceLineage: [],
            calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
          })),
        },
      },
    },
  };
}

function testDb(input: {
  roster?: string[];
  states?: ReturnType<typeof portrait>[];
  risks?: Array<Record<string, unknown>>;
  factUserIds?: string[];
}) {
  let roster = input.roster ?? ['student-1'];
  let states = input.states ?? [portrait('student-1', [80, 70, 60, 50, 90, 75, 65], 'up')];
  const factUserIds = input.factUserIds ?? states.map((state) => state.userId);
  let current: any = null;
  let nextVersion = 1;
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: `class-version-${nextVersion++}`,
    ...data,
  }));
  const classCompetencySnapshot = { findFirst: vi.fn() };
  const studentCompetencySnapshot = { findMany: vi.fn() };
  const db: any = {
    classCompetencySnapshot,
    studentCompetencySnapshot,
    studentProfile: {
      findMany: vi.fn(async () => roster.map((userId) => ({ userId }))),
    },
    learningFact: {
      findMany: vi.fn(async () => factUserIds
        .filter((userId) => roster.includes(userId))
        .map((userId) => ({ userId }))),
    },
    cumulativePortraitCutoverFence: {
      findUnique: vi.fn(async () => ({
        fence: BigInt(4),
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        learnerGeneration: BigInt(7),
        classMaterializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
        classGeneration: BigInt(9),
        queueGeneration: BigInt(11),
        activeMigrationRunId: 'run-1',
      })),
    },
    cumulativePortraitMigrationRun: {
      findUnique: vi.fn(async () => ({
        id: 'run-1',
        mode: 'APPLY',
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        classMaterializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
        learnerGeneration: BigInt(7),
        classGeneration: BigInt(9),
        queueGeneration: BigInt(11),
        cutoverFence: BigInt(4),
      })),
    },
    learnerPortraitCurrentState: {
      findMany: vi.fn(async () => structuredClone(states)),
    },
    learnerEvidenceRiskState: {
      findMany: vi.fn(async () => structuredClone(input.risks ?? [])),
    },
    classCumulativePortraitVersion: { create },
    classCumulativePortraitCurrentState: {
      findUnique: vi.fn(async () => structuredClone(current)),
      upsert: vi.fn(async ({ create: pointer }: any) => {
        current = structuredClone(pointer);
        return current;
      }),
    },
  };
  db.$transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(db));
  return {
    db,
    create,
    classCompetencySnapshot,
    studentCompetencySnapshot,
    setRoster: (next: string[]) => { roster = next; },
    setStates: (next: ReturnType<typeof portrait>[]) => { states = next; },
  };
}

describe('cumulative class materialization', () => {
  it('includes historical native portraits without a recent evidence cutoff', async () => {
    const { db, create } = testDb({});
    const result = await materializeCumulativeClassPortrait(db, 'class-1', {
      now: new Date('2026-07-23T00:00:00.000Z'),
    });

    expect(result).toMatchObject({ written: true, activeStudentCount: 1, totalStudentCount: 1 });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      evidenceAsOf: oldEvidenceAt,
      materializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
      aggregateJson: expect.objectContaining({
        overall: expect.objectContaining({ mean: expect.any(Number), includedCount: 1 }),
      }),
    }) });
    expect(db.learnerPortraitCurrentState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          generation: BigInt(7),
          queueGeneration: BigInt(11),
        }),
      }),
    );
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      isolationLevel: 'Serializable',
    }));
  });

  it('uses dimension-specific denominators instead of replacing missing values with zero', async () => {
    const { db, create } = testDb({
      roster: ['student-1', 'student-2'],
      states: [
        portrait('student-1', [80, null, null, null, null, null, null]),
        portrait('student-2', [60, 90, null, null, null, null, null]),
      ],
    });
    await materializeCumulativeClassPortrait(db, 'class-1');

    const data = create.mock.calls[0][0].data as any;
    expect(data.aggregateJson.dimensions.controlModelingRepresentation).toMatchObject({
      mean: 70,
      includedCount: 2,
      missingCount: 0,
    });
    expect(data.aggregateJson.dimensions.systemAnalysisInterpretation).toMatchObject({
      mean: 90,
      includedCount: 1,
      missingCount: 1,
    });
    expect(data.aggregateJson.overall).toMatchObject({
      mean: 77.5,
      includedCount: 2,
    });
  });

  it('recomputes the member set and input digest after current membership changes', async () => {
    const fixture = testDb({
      roster: ['student-1'],
      states: [portrait('student-1', [80, null, null, null, null, null, null])],
    });
    const first = await materializeCumulativeClassPortrait(fixture.db, 'class-1');
    fixture.setRoster(['student-2']);
    fixture.setStates([portrait('student-2', [40, null, null, null, null, null, null])]);
    const second = await materializeCumulativeClassPortrait(fixture.db, 'class-1');

    expect(second.written).toBe(true);
    expect(second.memberSetDigest).not.toBe(first.memberSetDigest);
    expect(second.inputDigest).not.toBe(first.inputDigest);
    expect(fixture.create.mock.calls[1][0].data.sourcePortraitVersions).toEqual([
      { userId: 'student-2', stateVersionId: 'state-student-2' },
    ]);
  });

  it('never reads v1 or compatibility snapshot delegates', async () => {
    const fixture = testDb({});
    await materializeCumulativeClassPortrait(fixture.db, 'class-1');

    expect(fixture.classCompetencySnapshot.findFirst).not.toHaveBeenCalled();
    expect(fixture.studentCompetencySnapshot.findMany).not.toHaveBeenCalled();
    expect(fixture.db.learnerPortraitCurrentState.findMany).toHaveBeenCalled();
  });

  it('rejects a stale fence before creating a version', async () => {
    const fixture = testDb({});
    await expect(materializeCumulativeClassPortrait(fixture.db, 'class-1', {
      publication: {
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        learnerGeneration: BigInt(7),
        generation: BigInt(8),
        cutoverFence: BigInt(3),
        queueGeneration: BigInt(10),
        migrationRunId: 'old-run',
      },
    })).rejects.toThrow('publication fence is stale');
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it('rejects a stale queue generation independently of the class generation', async () => {
    const fixture = testDb({});
    await expect(materializeCumulativeClassPortrait(fixture.db, 'class-1', {
      publication: {
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        learnerGeneration: BigInt(7),
        generation: BigInt(9),
        cutoverFence: BigInt(4),
        queueGeneration: BigInt(10),
        migrationRunId: 'run-1',
      },
    })).rejects.toThrow('publication fence is stale');
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it('retains risks when learner and class generations differ', async () => {
    const { db, create } = testDb({
      roster: ['student-1', 'student-2'],
      states: [
        portrait('student-1', [80, null, null, null, null, null, null], 'up'),
        portrait('student-2', [60, null, null, null, null, null, null], 'down'),
      ],
      risks: [
        {
          id: 'risk-active',
          userId: 'student-1',
          riskKey: 'constraint',
          riskType: 'CONSTRAINT',
          severity: 'high',
          isActive: true,
          sourceTransitionSequence: BigInt(3),
        },
        {
          id: 'risk-cleared',
          userId: 'student-2',
          riskKey: 'stagnation',
          riskType: 'STAGNATION',
          severity: 'medium',
          isActive: false,
          sourceTransitionSequence: BigInt(4),
        },
      ],
    });
    await materializeCumulativeClassPortrait(db, 'class-1');

    expect(db.learnerEvidenceRiskState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stateGeneration: BigInt(7),
          riskType: { in: ['CONSTRAINT', 'STAGNATION', 'CROSS_DOMAIN'] },
        }),
      }),
    );
    expect(create.mock.calls[0][0].data).toMatchObject({
      trendDistribution: { up: 1, stable: 0, down: 1, 'not-comparable': 0 },
      riskDistribution: {
        membersWithRisk: 1,
        membersWithoutRisk: 1,
        byType: { constraint: 1 },
        bySeverity: { high: 1 },
      },
    });
  });

  it('does not publish a duplicate version for an unchanged input and queue generation', async () => {
    const fixture = testDb({});
    const first = await materializeCumulativeClassPortrait(fixture.db, 'class-1');
    const second = await materializeCumulativeClassPortrait(fixture.db, 'class-1');

    expect(first.written).toBe(true);
    expect(second).toMatchObject({
      written: false,
      versionId: first.versionId,
      inputDigest: first.inputDigest,
    });
    expect(fixture.create).toHaveBeenCalledTimes(1);
    expect(fixture.db.classCumulativePortraitCurrentState.findUnique).toHaveBeenLastCalledWith({
      where: { classId: 'class-1' },
      select: expect.objectContaining({ queueGeneration: true }),
    });
  });

  it('rejects publication when a fact-bearing member has no matching current state', async () => {
    const { db, create } = testDb({
      roster: ['student-1'],
      states: [],
      factUserIds: ['student-1'],
    });

    await expect(materializeCumulativeClassPortrait(db, 'class-1'))
      .rejects.toThrow('1 fact-bearing member(s) without current learner state');
    expect(create).not.toHaveBeenCalled();
  });

  it('allows an explicit zero-coverage version when missing members have no facts', async () => {
    const { db, create } = testDb({
      roster: ['student-1'],
      states: [],
      factUserIds: [],
    });
    const result = await materializeCumulativeClassPortrait(db, 'class-1');

    expect(result).toMatchObject({ written: true, activeStudentCount: 0, totalStudentCount: 1 });
    expect(create.mock.calls[0][0].data).toMatchObject({
      aggregateJson: { overall: { mean: null, includedCount: 0, missingCount: 1 } },
      dimensionCoverage: {
        totalMembers: 1,
        portraitMembers: 0,
        missingPortraitMembers: 1,
      },
      diagnosis: { limitations: ['no-current-member-portrait-evidence'] },
    });
  });
});
