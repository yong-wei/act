import { describe, expect, it, vi } from 'vitest';
import {
  PORTRAIT_V2_INCREMENTAL_NEGATIVE_LIMITATION,
  PORTRAIT_V2_INCREMENTAL_NEGATIVE_RATIONALE,
  mapLearningFactsToPortraitEvidence,
  updatePortraitV2Incrementally,
} from '../portrait-v2-incremental-update';
import { materializeIncrementalPortraitV2 } from '../portrait-v2-materialization';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_DIMENSION_IDS,
  createPortraitV2Payload,
  projectPortraitV2ForConsumer,
  type PortraitV2Payload,
} from '../portrait-v2-model';

const baselineAt = '2026-05-01T00:00:00.000Z';

function baseline(): PortraitV2Payload {
  return createPortraitV2Payload({
    userId: 'student-1',
    generatedAt: baselineAt,
    now: baselineAt,
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id, index) => ({
      id,
      score: 60 + index,
      confidence: 0.8,
      freshness: { state: 'current', asOf: baselineAt, evidenceAgeDays: 0 },
      evidenceSummary: { totalCount: 4, sourceFamilyCounts: { LearningFact: 4 } },
      lastPositiveEvidenceAt: baselineAt,
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [
        { kind: 'evidence-family', ref: 'LearningFact', privacyScope: 'student-visible' },
        { kind: 'raw-source', ref: `raw-source:${id}`, privacyScope: 'system-internal' },
      ],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
  });
}

describe('portrait v2 incremental updates', () => {
  it('preserves all scores without new evidence while aging freshness and confidence', () => {
    const previous = baseline();
    const result = updatePortraitV2Incrementally({
      userId: previous.userId,
      previous,
      evidence: [],
      generatedAt: '2026-08-15T00:00:00.000Z',
    });

    expect(result.payload.dimensions.map((item) => item.score)).toEqual(previous.dimensions.map((item) => item.score));
    expect(result.payload.dimensions.every((item) => item.freshness.state === 'stale')).toBe(true);
    expect(result.payload.dimensions[0].confidence).toBeLessThan(previous.dimensions[0].confidence);
  });

  it('updates only the dimension named by sparse evidence', () => {
    const previous = baseline();
    const result = updatePortraitV2Incrementally({
      userId: previous.userId,
      previous,
      evidence: [{
        id: 'fact-1',
        occurredAt: '2026-05-02T00:00:00.000Z',
        sourceFamily: 'LearningFact',
        outcome: 'positive',
        contributions: { simulationValidationEvidence: 0.9 },
      }],
      generatedAt: '2026-05-02T00:00:00.000Z',
    });

    expect(result.affectedDimensions).toEqual(['simulationValidationEvidence']);
    for (const dimension of result.payload.dimensions) {
      const before = previous.dimensions.find((item) => item.id === dimension.id)!;
      if (dimension.id === 'simulationValidationEvidence') expect(dimension.score).toBeGreaterThan(before.score);
      else expect(dimension.score).toBe(before.score);
    }
  });

  it('applies explicit negative evidence as a bounded decrease with governed rationale', () => {
    const previous = baseline();
    const before = previous.dimensions.find((item) => item.id === 'engineeringConstraintSafety')!;
    const result = updatePortraitV2Incrementally({
      userId: previous.userId,
      previous,
      evidence: [{
        id: 'unsafe-action',
        occurredAt: '2026-05-02T00:00:00.000Z',
        sourceFamily: 'LearningFact',
        outcome: 'negative',
        contributions: { engineeringConstraintSafety: 1 },
      }],
      generatedAt: '2026-05-02T00:00:00.000Z',
    });
    const after = result.payload.dimensions.find((item) => item.id === 'engineeringConstraintSafety')!;

    expect(after.score).toBeLessThan(before.score);
    expect(after.trend).toBe('down');
    expect(before.score - after.score).toBeLessThanOrEqual(12);
    expect(after.rationale).toBe(PORTRAIT_V2_INCREMENTAL_NEGATIVE_RATIONALE);
    expect(after.limitations).toEqual([PORTRAIT_V2_INCREMENTAL_NEGATIVE_LIMITATION]);
    expect(after.lastNegativeEvidenceAt).toBe('2026-05-02T00:00:00.000Z');
    expect(after.sourceLineage).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'raw-source', privacyScope: 'system-internal' }),
    ]));
    expect(projectPortraitV2ForConsumer(result.payload, 'student', {
      now: '2026-05-02T00:00:00.000Z',
    }).dimensions.find((item) => item.id === 'engineeringConstraintSafety')?.trend).toBe('down');
  });

  it('deduplicates repeated evidence ids within one update', () => {
    const previous = baseline();
    const evidence = {
      id: 'fact-repeat',
      occurredAt: '2026-05-02T00:00:00.000Z',
      sourceFamily: 'LearningFact' as const,
      outcome: 'positive' as const,
      contributions: { controllerDesignSynthesis: 0.8 },
    };
    const once = updatePortraitV2Incrementally({
      userId: previous.userId,
      previous,
      evidence: [evidence, evidence],
      generatedAt: '2026-05-02T00:00:00.000Z',
    }).payload;
    const onceDimension = once.dimensions.find((item) => item.id === 'controllerDesignSynthesis')!;

    expect(onceDimension.evidenceSummary.totalCount).toBe(5);
    expect(onceDimension.sourceLineage.filter((item) =>
      item.kind === 'raw-source' && item.ref.startsWith('raw-source:LearningFact:'),
    )).toHaveLength(1);
  });

  it('ages confidence before applying the first new evidence after worker downtime', () => {
    const previous = baseline();
    const result = updatePortraitV2Incrementally({
      userId: previous.userId,
      previous,
      evidence: [{
        id: 'after-downtime',
        occurredAt: '2026-08-15T00:00:00.000Z',
        sourceFamily: 'LearningFact',
        outcome: 'positive',
        contributions: { controllerDesignSynthesis: 0.5 },
      }],
      generatedAt: '2026-08-15T00:00:00.000Z',
    });
    const dimension = result.payload.dimensions.find((item) => item.id === 'controllerDesignSynthesis')!;

    expect(dimension.confidence).toBe(0.77);
    expect(dimension.freshness.state).toBe('current');
  });

  it('bounds fact-level lineage independently from the durable evidence cursor', () => {
    const previous = baseline();
    const evidence = Array.from({ length: 50 }, (_, index) => ({
      id: `fact-scale-${index}`,
      occurredAt: '2026-05-02T00:00:00.000Z',
      sourceFamily: 'LearningFact' as const,
      outcome: 'positive' as const,
      contributions: { controllerDesignSynthesis: 0.5 },
    }));
    const result = updatePortraitV2Incrementally({
      userId: previous.userId,
      previous,
      evidence,
      generatedAt: '2026-05-02T00:00:00.000Z',
      updateCursor: { lastFactCreatedAt: '2026-05-02T00:00:00.000Z', lastFactId: 'fact-scale-49' },
    });
    const dimension = result.payload.dimensions.find((item) => item.id === 'controllerDesignSynthesis')!;

    expect(dimension.sourceLineage.filter((item) =>
      item.kind === 'raw-source' && item.ref.startsWith('raw-source:LearningFact:'),
    )).toHaveLength(20);
    expect(result.payload.updateCursor).toEqual({
      lastFactCreatedAt: '2026-05-02T00:00:00.000Z',
      lastFactId: 'fact-scale-49',
    });
    expect(projectPortraitV2ForConsumer(result.payload, 'student', {
      now: '2026-05-02T00:00:00.000Z',
    }).updateCursor).toBeUndefined();

    const next = updatePortraitV2Incrementally({
      userId: previous.userId,
      previous: result.payload,
      evidence: [{
        id: 'fact-scale-50',
        occurredAt: '2026-05-03T00:00:00.000Z',
        sourceFamily: 'LearningFact',
        outcome: 'positive',
        contributions: { controllerDesignSynthesis: 0.4 },
      }],
      generatedAt: '2026-05-03T00:00:00.000Z',
      updateCursor: { lastFactCreatedAt: '2026-05-03T00:00:00.000Z', lastFactId: 'fact-scale-50' },
    });
    const nextRefs = next.payload.dimensions.find((item) => item.id === 'controllerDesignSynthesis')!
      .sourceLineage.filter((item) => item.kind === 'raw-source' && item.ref.startsWith('raw-source:LearningFact:'));
    const previousRefs = new Set(dimension.sourceLineage.map((item) => item.ref));
    expect(nextRefs).toHaveLength(20);
    expect(nextRefs.filter((item) => previousRefs.has(item.ref))).toHaveLength(19);
  });

  it('rejects an incremental cursor later than the generated portrait', () => {
    expect(() => updatePortraitV2Incrementally({
      userId: 'student-1',
      previous: null,
      evidence: [],
      generatedAt: '2026-05-02T00:00:00.000Z',
      updateCursor: { lastFactCreatedAt: '2026-05-03T00:00:00.000Z', lastFactId: 'future-fact' },
    })).toThrow('incremental update cursor');
  });

  it('maps legacy contributions, reports unknown dimensions, and ignores context-only facts', () => {
    const mapped = mapLearningFactsToPortraitEvidence([
      fact('path-only', { controlModeling: 1 }, {
        evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 },
      }),
      fact('unknown', { futureDimension: 1 }, {}),
      fact('known', { parameterDesign: 0.8 }, {}),
    ]);

    expect(mapped.evidence[0].outcome).toBe('context-only');
    expect(mapped.evidence[2].contributions.controllerDesignSynthesis).toBe(0.8);
    expect(mapped.mappingIssues).toEqual(['unknown-portrait-dimension:futureDimension']);
  });

  it('keeps a Yang Fan-style rich baseline intact when a sparse path-selection fact is context-only', () => {
    const previous = baseline();
    const mapped = mapLearningFactsToPortraitEvidence([
      fact('yang-fan-path-selection', { selfDirectedLearning: 1 }, {
        evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 },
      }),
    ]);
    const result = updatePortraitV2Incrementally({
      userId: previous.userId,
      previous,
      evidence: mapped.evidence,
      generatedAt: '2026-05-02T00:00:00.000Z',
    });

    expect(result.affectedDimensions).toEqual([]);
    expect(result.payload.dimensions.map((item) => item.score)).toEqual(previous.dimensions.map((item) => item.score));
  });

  it('materializes from facts newer than the prior portrait and writes an aged snapshot when the delta is empty', async () => {
    const previous = baseline();
    previous.updateCursor = { lastFactCreatedAt: baselineAt, lastFactId: 'fact-boundary-001' };
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'portrait-next', ...data }));
    const findMany = vi.fn(async () => []);
    const db = {
      studentPortraitV2Snapshot: {
        findFirst: vi.fn(async () => ({
          id: 'portrait-old',
          userId: previous.userId,
          snapshotAt: new Date(previous.generatedAt),
          payloadVersion: previous.payloadVersion,
          calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
          migrationVersion: previous.migrationVersion,
          derivationKind: previous.derivation.kind,
          payload: structuredClone(previous),
        })),
        create,
      },
      learningFact: { findMany },
    };

    const result = await materializeIncrementalPortraitV2(db, previous.userId, {
      now: new Date('2026-06-15T00:00:00.000Z'),
    });

    expect(result).toMatchObject({ written: true, evidenceCount: 0, affectedDimensions: [] });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: previous.userId,
        createdAt: { lte: new Date('2026-06-15T00:00:00.000Z') },
        OR: [
          { createdAt: { gt: new Date(baselineAt) } },
          { createdAt: new Date(baselineAt), id: { gt: 'fact-boundary-001' } },
        ],
      },
    }));
    const written = create.mock.calls[0][0].data.payload as PortraitV2Payload;
    expect(written.dimensions.map((item) => item.score)).toEqual(previous.dimensions.map((item) => item.score));
    expect(written.dimensions[0].freshness.state).toBe('partial');
    expect(written.dimensions[0].sourceLineage).toContainEqual({
      kind: 'raw-source',
      ref: `raw-source:${written.dimensions[0].id}`,
      privacyScope: 'system-internal',
    });
  });

  it('persists an empty seven-dimension cursor baseline for context-only first-run facts', async () => {
    const contextFact = fact('context-first', { controlModeling: 1 }, {
      evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 },
    });
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'portrait-context', ...data }));
    const result = await materializeIncrementalPortraitV2({
      studentPortraitV2Snapshot: { findFirst: vi.fn(async () => null), create },
      learningFact: { findMany: vi.fn(async () => [contextFact]) },
    }, 'student-context', { now: new Date('2026-05-02T00:00:02.000Z') });

    expect(result).toMatchObject({ written: true, evidenceCount: 0, affectedDimensions: [] });
    const payload = create.mock.calls[0][0].data.payload as PortraitV2Payload;
    expect(payload.updateCursor).toEqual({
      lastFactCreatedAt: contextFact.createdAt.toISOString(),
      lastFactId: contextFact.id,
    });
    expect(payload.dimensions).toHaveLength(7);
    expect(payload.dimensions.every((item) => item.score === 0)).toBe(true);
  });

  it('serializes per-student materialization behind a transaction-scoped advisory lock', async () => {
    const executeRaw = vi.fn(async () => 1);
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'portrait-locked', ...data }));
    const callOrder: string[] = [];
    const db: any = {
      $executeRaw: vi.fn(async () => {
        callOrder.push('lock');
        return executeRaw();
      }),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
      studentPortraitV2Snapshot: { findFirst: vi.fn(async () => { callOrder.push('read'); return null; }), create },
      learningFact: { findMany: vi.fn(async () => []) },
    };

    await materializeIncrementalPortraitV2(db, 'student-locked', { now: new Date('2026-05-02T00:00:00.000Z') });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 120_000 });
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['lock', 'read']);
    expect(db.$executeRaw).toHaveBeenCalledWith(expect.anything());
  });

  it('fails closed when a transaction cannot acquire the portrait advisory lock', async () => {
    const db: any = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
        studentPortraitV2Snapshot: { findFirst: vi.fn(async () => null), create: vi.fn() },
        learningFact: { findMany: vi.fn(async () => []) },
      })),
    };

    await expect(materializeIncrementalPortraitV2(db, 'student-without-lock'))
      .rejects.toThrow('transaction advisory-lock support');
  });

  it('does not read or write a snapshot when advisory-lock acquisition fails', async () => {
    const findFirst = vi.fn(async () => null);
    const create = vi.fn();
    const db: any = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
        $executeRaw: vi.fn(async () => { throw new Error('lock unavailable'); }),
        studentPortraitV2Snapshot: { findFirst, create },
        learningFact: { findMany: vi.fn(async () => []) },
      })),
    };

    await expect(materializeIncrementalPortraitV2(db, 'student-lock-error')).rejects.toThrow('lock unavailable');
    expect(findFirst).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

function fact(id: string, contribution: Record<string, number>, contextJson: unknown) {
  return {
    id,
    startedAt: new Date('2026-05-02T00:00:00.000Z'),
    outcome: 'success',
    score: 1,
    competencyContribution: contribution,
    contextJson,
    createdAt: new Date('2026-05-02T00:00:01.000Z'),
  };
}
