import { describe, expect, it, vi } from 'vitest';
import {
  PORTRAIT_V2_INCREMENTAL_NEGATIVE_LIMITATION,
  PORTRAIT_V2_INCREMENTAL_NEGATIVE_RATIONALE,
  isPortraitV2ProfileEvidence,
  mapLearningFactsToPortraitEvidence,
  orderAndDedupePortraitV2Evidence,
  updatePortraitV2Incrementally,
} from '../portrait-v2-incremental-update';
import { materializeIncrementalPortraitV2 } from '../portrait-v2-materialization';
import { TRUSTED_LEARNING_FACT_POLICY_VERSION } from '../trusted-learning-fact-filter';
import { buildGovernedTaskEvidence } from '../simulation-task-evidence';
import {
  buildSimulationTaskInputIdentity,
  computeSimulationTaskCatalogDigest,
  deriveHistoricalSimulationTaskPlanDigest,
} from '../simulation-task-portrait-projection';
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
  it('aggregates rubric performance by rubricWeight within a mapped dimension', () => {
    const result = updatePortraitV2Incrementally({
      userId: 'student-rubric', previous: null, generatedAt: '2026-05-02T00:00:00.000Z',
      evidence: [
        { id: 'heavy-half', occurredAt: baselineAt, sourceFamily: 'LearningFact', outcome: 'positive', contributions: { controlModelingRepresentation: 0.5 }, rubricWeight: 0.9, normalizedPerformance: true },
        { id: 'light-full', occurredAt: baselineAt, sourceFamily: 'LearningFact', outcome: 'positive', contributions: { controlModelingRepresentation: 1 }, rubricWeight: 0.1, normalizedPerformance: true },
      ],
    });
    expect(result.payload.dimensions.find((item) => item.id === 'controlModelingRepresentation')?.score).toBe(55);
  });
  it('keeps zero and partial normalized rubric performances without outcome rescaling', () => {
    const weighted = updatePortraitV2Incrementally({
      userId: 'student-zero-rubric', previous: null, generatedAt: '2026-05-02T00:00:00.000Z',
      evidence: [
        { id: 'zero-heavy', occurredAt: baselineAt, sourceFamily: 'LearningFact', outcome: 'negative', contributions: { controlModelingRepresentation: 0 }, rubricWeight: 0.9, normalizedPerformance: true },
        { id: 'full-light', occurredAt: baselineAt, sourceFamily: 'LearningFact', outcome: 'positive', contributions: { controlModelingRepresentation: 1 }, rubricWeight: 0.1, normalizedPerformance: true },
      ],
    });
    expect(weighted.payload.dimensions.find((item) => item.id === 'controlModelingRepresentation')?.score).toBe(10);

    const partial = updatePortraitV2Incrementally({
      userId: 'student-half-rubric', previous: null, generatedAt: '2026-05-02T00:00:00.000Z',
      evidence: [{ id: 'half', occurredAt: baselineAt, sourceFamily: 'LearningFact', outcome: 'partial', contributions: { controlModelingRepresentation: 0.5 }, rubricWeight: 1, normalizedPerformance: true }],
    });
    expect(partial.payload.dimensions.find((item) => item.id === 'controlModelingRepresentation')?.score).toBe(50);
  });
  it('normalizes mixed legacy and rubric evidence before weighting', () => {
    const result = updatePortraitV2Incrementally({
      userId: 'student-mixed', previous: null, generatedAt: '2026-05-02T00:00:00.000Z',
      evidence: [
        { id: 'legacy-full', occurredAt: baselineAt, sourceFamily: 'LearningFact', outcome: 'positive', contributions: { controlModelingRepresentation: 1 } },
        { id: 'rubric-zero', occurredAt: baselineAt, sourceFamily: 'LearningFact', outcome: 'negative', contributions: { controlModelingRepresentation: 0 }, rubricWeight: 1, normalizedPerformance: true },
      ],
    });
    expect(result.payload.dimensions.find((item) => item.id === 'controlModelingRepresentation')?.score).toBe(50);
  });

  it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN])('uses a safe weight for invalid rubricWeight %s', (rubricWeight) => {
    const result = updatePortraitV2Incrementally({
      userId: 'student-invalid-weight', previous: null, generatedAt: '2026-05-02T00:00:00.000Z',
      evidence: [{ id: 'full', occurredAt: baselineAt, sourceFamily: 'LearningFact', outcome: 'positive', contributions: { controlModelingRepresentation: 1 }, rubricWeight, normalizedPerformance: true }],
    });
    expect(result.payload.dimensions.find((item) => item.id === 'controlModelingRepresentation')?.score).toBe(100);
  });
  it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN])('reports governed mapping issues for invalid fact rubricWeight %s', (rubricWeight) => {
    const mapped = mapLearningFactsToPortraitEvidence([{ id: 'invalid-weight', startedAt: new Date(baselineAt), createdAt: new Date(baselineAt), outcome: 'success', score: 1, competencyContribution: { controlModeling: 1 }, contextJson: governedContext({ rubricWeight }) }]);
    expect(mapped.mappingIssues).toContain('invalid-rubric-weight:invalid-weight');
    expect(mapped.evidence[0].rubricWeight).toBe(1);
  });
  it('preserves the complete evidence-backed state when only calendar time advances', () => {
    const previous = baseline();
    const result = updatePortraitV2Incrementally({
      userId: previous.userId,
      previous,
      evidence: [],
      generatedAt: '2026-08-15T00:00:00.000Z',
    });

    expect(result.payload.dimensions.map((item) => item.score)).toEqual(previous.dimensions.map((item) => item.score));
    expect(result.payload.dimensions.map((item) => item.freshness)).toEqual(previous.dimensions.map((item) => item.freshness));
    expect(result.payload.dimensions.map((item) => item.confidence)).toEqual(previous.dimensions.map((item) => item.confidence));
    expect(result.payload.generatedAt).toBe(previous.generatedAt);
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

  it('does not decay confidence before applying the first new evidence after worker downtime', () => {
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

    expect(dimension.confidence).toBe(0.88);
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

    expect(mapped.evidence.find((item) => item.id === 'path-only')?.outcome).toBe('context-only');
    expect(mapped.evidence.find((item) => item.id === 'known')?.contributions.controllerDesignSynthesis).toBe(0.8);
    expect(mapped.mappingIssues).toEqual(['unknown-portrait-dimension:futureDimension']);
  });

  it('does not produce profile evidence or change scores for a materialized client fact without a contribution', () => {
    const previous = baseline();
    const mapped = mapLearningFactsToPortraitEvidence([
      fact('forged-client-contribution', {}, {
        interactiveQuiz: { score: 100, cards: [{ cardId: 'q1', answered: true, isCorrect: true }] },
      }),
    ]);
    const result = updatePortraitV2Incrementally({
      userId: previous.userId,
      previous,
      evidence: mapped.evidence,
      generatedAt: '2026-05-02T00:00:00.000Z',
    });

    expect(mapped.evidence).toHaveLength(1);
    expect(mapped.evidence[0]?.contributions).toEqual({});
    expect(mapped.evidence.filter(isPortraitV2ProfileEvidence)).toEqual([]);
    expect(result.affectedDimensions).toEqual([]);
    expect(result.payload.dimensions.map((item) => item.score)).toEqual(
      previous.dimensions.map((item) => item.score),
    );
  });

  it('maps a LearningFact without evidence governance as context-only', () => {
    const mapped = mapLearningFactsToPortraitEvidence([{
      id: 'unmanaged',
      startedAt: new Date('2026-05-02T00:00:00.000Z'),
      createdAt: new Date('2026-05-02T00:00:01.000Z'),
      outcome: 'success',
      score: 1,
      competencyContribution: { controlModeling: 1 },
      contextJson: {},
    }]);

    expect(mapped.evidence).toMatchObject([{ id: 'unmanaged', outcome: 'context-only' }]);
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

  it('does not replace an existing portrait when the incremental delta is empty', async () => {
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

    expect(result).toMatchObject({ written: false, evidenceCount: 0, affectedDimensions: [] });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: previous.userId },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    }));
    expect(create).not.toHaveBeenCalled();
  });

  it('does not replace an existing portrait for context-only input', async () => {
    const previous = baseline();
    previous.updateCursor = { lastFactCreatedAt: baselineAt, lastFactId: 'fact-boundary-001' };
    const contextFact = fact('context-next', { controlModeling: 1 }, {
      evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 },
    });
    const create = vi.fn();
    const result = await materializeIncrementalPortraitV2({
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
      learningFact: { findMany: vi.fn(async () => [contextFact]) },
    }, previous.userId, { now: new Date('2026-05-02T00:00:02.000Z') });

    expect(result).toMatchObject({ written: false, evidenceCount: 0, affectedDimensions: [] });
    expect(create).not.toHaveBeenCalled();
  });

  it('does not create an empty portrait for context-only first-run facts', async () => {
    const contextFact = fact('context-first', { controlModeling: 1 }, {
      evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 },
    });
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'portrait-context', ...data }));
    const result = await materializeIncrementalPortraitV2({
      studentPortraitV2Snapshot: { findFirst: vi.fn(async () => null), create },
      learningFact: { findMany: vi.fn(async () => [contextFact]) },
    }, 'student-context', { now: new Date('2026-05-02T00:00:02.000Z') });

    expect(result).toMatchObject({ written: false, evidenceCount: 0, affectedDimensions: [] });
    expect(create).not.toHaveBeenCalled();
  });

  it('dry-runs state-changing evidence under the advisory lock without writing a portrait', async () => {
    const create = vi.fn();
    const executeRaw = vi.fn(async () => 1);
    const db: any = {
      $executeRaw: executeRaw,
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
      studentPortraitV2Snapshot: { findFirst: vi.fn(async () => null), create },
      learningFact: { findMany: vi.fn(async () => [fact('dry-run-state-change', { controlModeling: 1 }, {})]) },
    };

    const result = await materializeIncrementalPortraitV2(db, 'student-dry-run', {
      now: new Date('2026-05-02T00:00:02.000Z'),
      dryRun: true,
    });

    expect(result).toMatchObject({ written: true, evidenceCount: 1, affectedDimensions: [] });
    expect(result).not.toHaveProperty('snapshotId');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('reports full-rebuild context-only input as explicit no-evidence without writing a portrait', async () => {
    const contextFact = fact('context-rebuild-dry-run', { controlModeling: 1 }, {
      evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 },
    });
    const create = vi.fn();
    const db: any = {
      $executeRaw: vi.fn(async () => 1),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
      studentPortraitV2Snapshot: { findFirst: vi.fn(), create },
      learningFact: { findMany: vi.fn(async () => [contextFact]) },
    };

    const result = await materializeIncrementalPortraitV2(db, 'student-context-rebuild', {
      now: new Date('2026-05-02T00:00:02.000Z'),
      fullRebuild: true,
      dryRun: true,
    });

    expect(result).toMatchObject({ written: false, evidenceCount: 0, affectedDimensions: [] });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.studentPortraitV2Snapshot.findFirst).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('does not create a synthetic zero portrait for full-rebuild context-only facts', async () => {
    const contextFact = fact('context-rebuild', { controlModeling: 1 }, {
      evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 },
    });
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'portrait-rebuilt-empty', ...data }));
    const deleteMany = vi.fn(async () => ({ count: 1 }));
    const result = await materializeIncrementalPortraitV2({
      studentPortraitV2Snapshot: { findFirst: vi.fn(async () => null), create, deleteMany },
      learningFact: { findMany: vi.fn(async () => [contextFact]) },
    }, 'student-context-rebuild', {
      now: new Date('2026-05-02T00:00:02.000Z'),
      fullRebuild: true,
    });

    expect(result).toMatchObject({ written: false, evidenceCount: 0, affectedDimensions: [] });
    expect(create).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('full rebuild resets the cursor and derives the portrait from all remaining mixed-source facts', async () => {
    const remaining = fact('remaining-non-rubric', { controlModeling: 0.7 }, {});
    const deleteMany = vi.fn(async () => ({ count: 1 }));
    const findMany = vi.fn(async () => [remaining]);
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'portrait-rebuilt', ...data }));
    await materializeIncrementalPortraitV2({
      studentPortraitV2Snapshot: { findFirst: vi.fn(async () => { throw new Error('incremental cursor must not be read'); }), create, deleteMany },
      learningFact: { findMany },
    }, 'student-1', { now: new Date('2026-05-03T00:00:00.000Z'), fullRebuild: true });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1' },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    }));
    const payload = create.mock.calls[0][0].data.payload as PortraitV2Payload;
    expect(payload.updateCursor).toBeUndefined();
    expect(payload.dimensions.some((dimension) => dimension.score > 0)).toBe(true);
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
    expect(callOrder).toEqual(['lock']);
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

  it('publishes an explicit no-evidence state without deleting historical snapshots', async () => {
    const stateCreate = vi.fn(async () => ({ id: 'state-no-evidence' }));
    const pointerUpsert = vi.fn(async () => ({}));
    const snapshotCreate = vi.fn();
    const db: any = {
      $executeRaw: vi.fn(async () => 1),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
      learningFact: { findMany: vi.fn(async () => []) },
      learnerFactTransition: {
        findMany: vi.fn(async () => []),
        create: vi.fn(),
      },
      learnerFactTransitionSequence: {
        upsert: vi.fn(),
        update: vi.fn(),
      },
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => ({
          fence: BigInt(4),
          calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
          learnerGeneration: BigInt(7),
          queueGeneration: BigInt(11),
          activeMigrationRunId: 'migration-1',
        })),
      },
      learnerPortraitCurrentState: {
        findUnique: vi.fn(async () => null),
        upsert: pointerUpsert,
      },
      learnerPortraitStateVersion: { create: stateCreate },
      studentPortraitV2Snapshot: { create: snapshotCreate },
    };

    const result = await materializeIncrementalPortraitV2(db, 'student-no-evidence', {
      now: new Date('2026-05-02T00:00:00.000Z'),
    });

    expect(result).toMatchObject({
      written: true,
      stateKind: 'NO_EVIDENCE',
      stateVersionId: 'state-no-evidence',
    });
    expect(stateCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        stateKind: 'NO_EVIDENCE',
        snapshotId: null,
        queueGeneration: BigInt(11),
      }),
    }));
    expect(pointerUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ queueGeneration: BigInt(11) }),
      update: expect.objectContaining({ queueGeneration: BigInt(11) }),
    }));
    expect(snapshotCreate).not.toHaveBeenCalled();
  });

  it('publishes the requested task input identity for a learner without simulation task evidence', async () => {
    const stateCreate = vi.fn(async () => ({ id: 'state-no-task-evidence' }));
    const pointerUpsert = vi.fn(async () => ({}));
    const simulationTaskInput = buildSimulationTaskInputIdentity({
      factWatermark: BigInt(0),
      catalogDigest: computeSimulationTaskCatalogDigest(),
      historicalCandidatePlanDigest: null,
    });
    const db: any = {
      $executeRaw: vi.fn(async () => 1),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
      learningFact: { findMany: vi.fn(async () => []) },
      learnerFactTransition: {
        findMany: vi.fn(async () => []),
        create: vi.fn(),
      },
      learnerFactTransitionSequence: {
        upsert: vi.fn(),
        update: vi.fn(),
      },
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => ({
          fence: BigInt(4),
          calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
          learnerGeneration: BigInt(7),
          queueGeneration: BigInt(11),
          activeMigrationRunId: 'migration-1',
        })),
      },
      learnerPortraitCurrentState: {
        findUnique: vi.fn(async () => null),
        upsert: pointerUpsert,
      },
      learnerPortraitStateVersion: { create: stateCreate },
      studentPortraitV2Snapshot: { create: vi.fn() },
    };

    await materializeIncrementalPortraitV2(db, 'student-no-task-evidence', {
      now: new Date('2026-05-02T00:00:00.000Z'),
      simulationTaskInput: {
        expectedInputDigest: simulationTaskInput.inputDigest,
      },
    });

    expect(stateCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        stateKind: 'NO_EVIDENCE',
        taskInputDigest: simulationTaskInput.inputDigest,
      }),
    }));
    expect(pointerUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        taskInputDigest: simulationTaskInput.inputDigest,
      }),
      update: expect.objectContaining({
        taskInputDigest: simulationTaskInput.inputDigest,
      }),
    }));
  });

  it('rejects a stale publication fence before writing state or pointer', async () => {
    const stateCreate = vi.fn();
    const pointerUpsert = vi.fn();
    const db: any = {
      $executeRaw: vi.fn(async () => 1),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
      learningFact: { findMany: vi.fn(async () => []) },
      learnerFactTransition: {
        findMany: vi.fn(async () => []),
        create: vi.fn(),
      },
      learnerFactTransitionSequence: {
        upsert: vi.fn(),
        update: vi.fn(),
      },
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => ({
          fence: BigInt(4),
          calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
          learnerGeneration: BigInt(7),
          queueGeneration: BigInt(11),
          activeMigrationRunId: 'migration-1',
        })),
      },
      learnerPortraitCurrentState: {
        findUnique: vi.fn(async () => null),
        upsert: pointerUpsert,
      },
      learnerPortraitStateVersion: { create: stateCreate },
      studentPortraitV2Snapshot: { create: vi.fn() },
    };

    await expect(materializeIncrementalPortraitV2(db, 'student-stale-fence', {
      publication: {
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        generation: BigInt(6),
        queueGeneration: BigInt(11),
        cutoverFence: BigInt(3),
        migrationRunId: 'migration-1',
      },
    })).rejects.toThrow('publication fence is stale');
    expect(stateCreate).not.toHaveBeenCalled();
    expect(pointerUpsert).not.toHaveBeenCalled();
  });

  it('rejects a stale queue generation before writing state or pointer', async () => {
    const stateCreate = vi.fn();
    const pointerUpsert = vi.fn();
    const db: any = {
      $executeRaw: vi.fn(async () => 1),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
      learningFact: { findMany: vi.fn(async () => []) },
      learnerFactTransition: {
        findMany: vi.fn(async () => []),
        create: vi.fn(),
      },
      learnerFactTransitionSequence: {
        upsert: vi.fn(),
        update: vi.fn(),
      },
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => ({
          fence: BigInt(4),
          calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
          learnerGeneration: BigInt(7),
          queueGeneration: BigInt(12),
          activeMigrationRunId: 'migration-1',
        })),
      },
      learnerPortraitCurrentState: {
        findUnique: vi.fn(async () => null),
        upsert: pointerUpsert,
      },
      learnerPortraitStateVersion: { create: stateCreate },
      studentPortraitV2Snapshot: { create: vi.fn() },
    };

    await expect(materializeIncrementalPortraitV2(db, 'student-stale-queue-generation', {
      publication: {
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        generation: BigInt(7),
        queueGeneration: BigInt(11),
        cutoverFence: BigInt(4),
        migrationRunId: 'migration-1',
      },
    })).rejects.toThrow('publication fence is stale');
    await expect(materializeIncrementalPortraitV2(db, 'student-missing-queue-generation', {
      publication: {
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        generation: BigInt(7),
        cutoverFence: BigInt(4),
        migrationRunId: 'migration-1',
      } as any,
    })).rejects.toThrow('publication fence is stale');
    expect(stateCreate).not.toHaveBeenCalled();
    expect(pointerUpsert).not.toHaveBeenCalled();
  });

  it('incrementally applies an on-time UPSERT without rebuilding unrelated dimensions', async () => {
    const previous = baseline();
    const untouched = previous.dimensions.find((dimension) =>
      dimension.id === 'engineeringConstraintSafety')!;
    untouched.score = 87;
    const existing = {
      ...fact('fact-existing', { engineeringDecision: 0.2 }, {}),
      startedAt: new Date('2026-05-01T00:00:00.000Z'),
    };
    const appended = {
      ...fact('fact-on-time', { controlModeling: 1 }, {}),
      startedAt: new Date('2026-05-03T00:00:00.000Z'),
    };
    const { db, snapshotCreate } = cumulativeMaterializationDb(previous, [existing, appended]);

    const result = await materializeIncrementalPortraitV2(db, previous.userId, {
      now: new Date('2026-05-03T00:00:01.000Z'),
    });

    expect(result.rebuildRequired).toBe(false);
    const payload = snapshotCreate.mock.calls[0][0].data.payload as PortraitV2Payload;
    expect(payload.dimensions.find((dimension) =>
      dimension.id === 'engineeringConstraintSafety')?.score).toBe(87);
    expect(result.affectedDimensions).toEqual([
      'controlModelingRepresentation',
      'systemAnalysisInterpretation',
    ]);
  });

  it('projects governed task evidence into only the seventh dimension in the fenced learner lane', async () => {
    const previous = baseline();
    const existing = {
      ...fact('fact-existing', { engineeringDecision: 0.2 }, {}),
      startedAt: new Date('2026-05-01T00:00:00.000Z'),
    };
    const taskFact = fact('fact-task-complete', {}, {
      evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 },
      simulationTaskEvidence: buildGovernedTaskEvidence({
        studentUserId: previous.userId,
        taskKey: 'odyssey:level-1',
        source: 'odyssey',
        tier: 'clear',
        occurredAt: '2026-05-03T00:00:00.000Z',
        normalizedSourceArtifactId: 'odyssey-clear-1',
        semanticFingerprint: { keyInputHash: 'odyssey-clear-1' },
        summary: {
          sourceRef: 'odyssey-clear-1',
          qualityBand: 'full',
        },
        completionAuthority: 'odyssey-persistent-clear',
      }),
    });
    taskFact.startedAt = new Date('2026-05-03T00:00:00.000Z');
    const { db, snapshotCreate, stateCreate } = cumulativeMaterializationDb(
      previous,
      [existing, taskFact],
    );

    const result = await materializeIncrementalPortraitV2(db, previous.userId, {
      now: new Date('2026-05-03T00:00:01.000Z'),
    });

    const payload = snapshotCreate.mock.calls[0][0].data.payload as PortraitV2Payload;
    const simulation = payload.dimensions.find((dimension) =>
      dimension.id === 'simulationValidationEvidence')!;
    expect(result.affectedDimensions).toEqual(['simulationValidationEvidence']);
    expect(simulation.taskAttainment).toMatchObject({
      state: 'EVIDENCE',
      completedTaskCount: 1,
      relatedTaskCount: expect.any(Number),
      score: expect.any(Number),
    });
    expect(stateCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        taskInputDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    }));
    for (const dimension of payload.dimensions) {
      if (dimension.id === 'simulationValidationEvidence') continue;
      expect(dimension.score).toBe(
        previous.dimensions.find((item) => item.id === dimension.id)?.score,
      );
    }
  });

  it('recomputes an existing task projection when only its durable input identity drifts', async () => {
    const previous = baseline();
    const taskFact = fact('fact-task-current', {}, {
      evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 },
      simulationTaskEvidence: buildGovernedTaskEvidence({
        studentUserId: previous.userId,
        taskKey: 'odyssey:level-1',
        source: 'odyssey',
        tier: 'clear',
        occurredAt: '2026-05-03T00:00:00.000Z',
        normalizedSourceArtifactId: 'odyssey-clear-current',
        semanticFingerprint: { keyInputHash: 'odyssey-clear-current' },
        summary: {
          sourceRef: 'odyssey-clear-current',
          qualityBand: 'full',
        },
        completionAuthority: 'odyssey-persistent-clear',
      }),
    });
    taskFact.startedAt = new Date('2026-05-03T00:00:00.000Z');
    const initial = cumulativeMaterializationDb(previous, [taskFact], 0);
    await materializeIncrementalPortraitV2(initial.db, previous.userId, {
      now: new Date('2026-05-03T00:00:01.000Z'),
    });
    const projected = initial.snapshotCreate.mock.calls[0][0].data.payload as PortraitV2Payload;
    const drifted = cumulativeMaterializationDb(projected, [taskFact], 1);
    drifted.currentState.taskInputDigest = 'stale-catalog-input';

    const result = await materializeIncrementalPortraitV2(drifted.db, previous.userId, {
      now: new Date('2026-05-03T00:00:01.000Z'),
    });

    expect(result).toMatchObject({
      written: true,
      stateWatermark: BigInt(1),
      affectedDimensions: ['simulationValidationEvidence'],
    });
    expect(drifted.stateCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        stateWatermark: BigInt(1),
        taskInputDigest: expect.not.stringMatching(/^stale-catalog-input$/),
      }),
    }));
  });

  it('derives historical plan identity from active facts on an ordinary snapshot', async () => {
    const previous = baseline();
    const planDigest = 'a'.repeat(64);
    const taskFact = fact('fact-task-historical', {}, {
      evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 },
      simulationTaskHistoricalCandidate: {
        schemaVersion: 'simulation-task-historical-candidate.v1',
        planDigest,
      },
      simulationTaskEvidence: buildGovernedTaskEvidence({
        studentUserId: previous.userId,
        taskKey: 'odyssey:level-1',
        source: 'odyssey',
        tier: 'clear',
        occurredAt: '2026-05-03T00:00:00.000Z',
        normalizedSourceArtifactId: 'historical-clear-1',
        semanticFingerprint: { keyInputHash: 'historical-clear-1' },
        summary: { sourceRef: 'historical-clear-1', qualityBand: 'full' },
        completionAuthority: 'odyssey-persistent-clear',
      }),
    });
    const fixture = cumulativeMaterializationDb(previous, [taskFact], 0);
    const historicalPlanSetDigest = deriveHistoricalSimulationTaskPlanDigest([taskFact]);
    const expectedIdentity = buildSimulationTaskInputIdentity({
      factWatermark: BigInt(1),
      catalogDigest: computeSimulationTaskCatalogDigest(),
      historicalCandidatePlanDigest: historicalPlanSetDigest,
    });

    await materializeIncrementalPortraitV2(fixture.db, previous.userId, {
      now: new Date('2026-05-03T00:00:01.000Z'),
    });

    expect(fixture.stateCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        taskInputDigest: expectedIdentity.inputDigest,
      }),
    }));
  });

  it('requires a learner-scoped rebuild for a late UPSERT', async () => {
    const previous = baseline();
    const existing = {
      ...fact('fact-existing', { engineeringDecision: 0.2 }, {}),
      startedAt: new Date('2026-05-03T00:00:00.000Z'),
    };
    const late = {
      ...fact('fact-late', { controlModeling: 1 }, {}),
      startedAt: new Date('2026-05-02T00:00:00.000Z'),
    };
    const { db } = cumulativeMaterializationDb(previous, [existing, late]);

    const result = await materializeIncrementalPortraitV2(db, previous.userId, {
      now: new Date('2026-05-03T00:00:01.000Z'),
    });

    expect(result.rebuildRequired).toBe(true);
  });

  it('requires a full rebuild when only the trusted fact policy version changes', async () => {
    const previous = baseline();
    const existing = {
      ...fact('fact-existing', { engineeringDecision: 0.2 }, {}),
      startedAt: new Date('2026-05-01T00:00:00.000Z'),
    };
    const { db, snapshotCreate, stateCreate } = cumulativeMaterializationDb(
      previous,
      [existing],
      1,
      BigInt(7),
      'trusted-learning-fact-policy.v0',
    );

    const result = await materializeIncrementalPortraitV2(db, previous.userId, {
      now: new Date('2026-05-01T00:00:01.000Z'),
    });

    expect(result.rebuildRequired).toBe(true);
    expect(snapshotCreate).toHaveBeenCalled();
    expect(stateCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        snapshotId: 'portrait-incremental',
        trustedFactPolicyVersion: TRUSTED_LEARNING_FACT_POLICY_VERSION,
        trustedFactIds: [existing.id],
      }),
    }));
  });

  it('folds an ordinary multi-fact materialization like consecutive single-fact updates', async () => {
    const previous = baseline();
    const existing = {
      ...fact('fact-existing', { engineeringDecision: 0.2 }, {}),
      startedAt: new Date('2026-05-01T00:00:00.000Z'),
    };
    const negative = {
      ...fact('fact-z-negative', { controlModeling: 1 }, {}),
      outcome: 'failure',
    };
    const positive = fact('fact-a-positive', { controlModeling: 1 }, {});
    const { db, snapshotCreate } = cumulativeMaterializationDb(
      previous,
      [existing, negative, positive],
    );

    const result = await materializeIncrementalPortraitV2(db, previous.userId, {
      now: new Date('2026-05-02T00:00:02.000Z'),
    });

    expect(result.rebuildRequired).toBe(false);
    const materialized = snapshotCreate.mock.calls[0][0].data.payload as PortraitV2Payload;
    const evidence = orderAndDedupePortraitV2Evidence(
      mapLearningFactsToPortraitEvidence([negative, positive]).evidence
        .filter(isPortraitV2ProfileEvidence),
    );
    let expected = previous;
    for (const item of evidence) {
      expected = updatePortraitV2Incrementally({
        userId: previous.userId,
        previous: expected,
        evidence: [item],
        generatedAt: '2026-05-02T00:00:00.000Z',
      }).payload;
    }

    expect(evidence.map((item) => item.id)).toEqual([
      'fact-a-positive',
      'fact-z-negative',
    ]);
    expect(materialized).toEqual(expected);
  });

  it('publishes the same last fact trend for one batch and consecutive materializations', async () => {
    const allDimensions = Object.fromEntries(
      PORTRAIT_V2_DIMENSION_IDS.map((id) => [id, 1]),
    );
    const positive = fact('fact-a-positive', allDimensions, {});
    const negative = {
      ...fact('fact-z-negative', allDimensions, {}),
      outcome: 'failure',
    };
    const evidence = orderAndDedupePortraitV2Evidence(
      mapLearningFactsToPortraitEvidence([positive, negative]).evidence
        .filter(isPortraitV2ProfileEvidence),
    );
    let finalPayload: PortraitV2Payload | null = null;
    for (const item of evidence) {
      finalPayload = updatePortraitV2Incrementally({
        userId: 'student-1',
        previous: finalPayload,
        evidence: [item],
        generatedAt: '2026-05-02T00:00:00.000Z',
      }).payload;
    }
    const batched = cumulativeMaterializationDb(
      finalPayload!,
      [positive, negative],
      2,
      BigInt(6),
    );

    await materializeIncrementalPortraitV2(batched.db, 'student-1', {
      now: new Date('2026-05-02T00:00:02.000Z'),
      fullRebuild: true,
    });

    const afterPositive = updatePortraitV2Incrementally({
      userId: 'student-1',
      previous: null,
      evidence: [evidence[0]],
      generatedAt: '2026-05-02T00:00:00.000Z',
    }).payload;
    const second = cumulativeMaterializationDb(afterPositive, [positive, negative]);
    await materializeIncrementalPortraitV2(second.db, 'student-1', {
      now: new Date('2026-05-02T00:00:02.000Z'),
    });

    expect(batched.snapshotCreate).not.toHaveBeenCalled();
    expect(second.stateCreate.mock.calls[0][0].data.lastTrend).toBe('down');
    expect(batched.stateCreate.mock.calls[0][0].data.lastTrend).toBe(
      second.stateCreate.mock.calls[0][0].data.lastTrend,
    );
  });

  it('folds a full rebuild one stable mixed-sign fact at a time', async () => {
    const negative = {
      ...fact('fact-z-negative', { controlModeling: 1 }, {}),
      outcome: 'failure',
    };
    const positive = fact('fact-a-positive', { controlModeling: 1 }, {});
    const facts = [negative, positive];
    const { db, snapshotCreate } = cumulativeMaterializationDb(baseline(), facts);

    await materializeIncrementalPortraitV2(db, 'student-1', {
      now: new Date('2026-05-02T00:00:02.000Z'),
      fullRebuild: true,
    });

    const rebuilt = snapshotCreate.mock.calls[0][0].data.payload as PortraitV2Payload;
    const evidence = orderAndDedupePortraitV2Evidence(
      mapLearningFactsToPortraitEvidence(facts).evidence
        .filter(isPortraitV2ProfileEvidence),
    );
    let expected: PortraitV2Payload | null = null;
    for (const item of evidence) {
      expected = updatePortraitV2Incrementally({
        userId: 'student-1',
        previous: expected,
        evidence: [item],
        generatedAt: '2026-05-02T00:00:00.000Z',
      }).payload;
    }

    expect(evidence.map((item) => item.id)).toEqual([
      'fact-a-positive',
      'fact-z-negative',
    ]);
    expect(rebuilt).toEqual(expected);
  });
});

function governedContext(context: Record<string, unknown> = {}) {
  const declaredGovernance = context.evidenceGovernance;
  const evidenceGovernance = declaredGovernance && typeof declaredGovernance === 'object' && !Array.isArray(declaredGovernance)
    ? declaredGovernance
    : {};
  return {
    ...context,
    evidenceGovernance: {
      evidenceQuality: 'rich',
      profileWeight: 1,
      skipProfileContribution: false,
      policyReason: 'rich_objective_evidence',
      ...evidenceGovernance,
    },
  };
}

function fact(id: string, contribution: Record<string, number>, contextJson: Record<string, unknown>) {
  return {
    id,
    sourceEventId: `adaptive-assessment:${id}`,
    sourceLogId: `governed-log:${id}`,
    knowledgeRevisionRef: null,
    startedAt: new Date('2026-05-02T00:00:00.000Z'),
    outcome: 'success',
    score: 1,
    competencyContribution: contribution,
    contextJson: governedContext(contextJson),
    createdAt: new Date('2026-05-02T00:00:01.000Z'),
  };
}

function cumulativeMaterializationDb(
  previous: PortraitV2Payload,
  facts: ReturnType<typeof fact>[],
  processedFactCount = 1,
  currentGeneration = BigInt(7),
  trustedFactPolicyVersion: string = TRUSTED_LEARNING_FACT_POLICY_VERSION,
) {
  const journal = facts.slice(0, processedFactCount).map((item, index) => ({
    id: `transition-${item.id}`,
    userId: previous.userId,
    sequence: BigInt(index + 1),
    factId: item.id,
    operation: 'UPSERT' as const,
    occurredAt: item.startedAt,
    transitionPayload: null,
    sourceReference: null,
    correctionOfSequence: null,
    createdAt: item.createdAt,
  }));
  const snapshotCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'portrait-incremental',
    ...data,
  }));
  const stateCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'state-incremental',
    ...data,
  }));
  let lastSequence = BigInt(processedFactCount);
  const currentState: any = {
    stateWatermark: BigInt(processedFactCount),
    taskInputDigest: '',
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    generation: currentGeneration,
    queueGeneration: BigInt(11),
    cutoverFence: BigInt(4),
    stateVersion: {
      overallScore: 70,
      lastTrend: 'stable',
      lastRisk: null,
      stateKind: 'SNAPSHOT',
      trustedFactPolicyVersion,
      snapshot: { id: 'portrait-existing', payload: structuredClone(previous) },
    },
  };
  const db: any = {
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
    learningFact: { findMany: vi.fn(async () => facts) },
    learnerFactTransition: {
      findMany: vi.fn(async () => journal),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `transition-${String(data.factId)}`,
          createdAt: new Date(),
          ...data,
        };
        journal.push(row as typeof journal[number]);
        return row;
      }),
    },
    learnerFactTransitionSequence: {
      upsert: vi.fn(async () => ({})),
      update: vi.fn(async () => ({ lastSequence: ++lastSequence })),
    },
    cumulativePortraitCutoverFence: {
      findUnique: vi.fn(async () => ({
        fence: BigInt(4),
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        learnerGeneration: BigInt(7),
        queueGeneration: BigInt(11),
        activeMigrationRunId: null,
      })),
    },
    learnerPortraitCurrentState: {
      findUnique: vi.fn(async () => currentState),
      upsert: vi.fn(async () => ({})),
    },
    learnerPortraitStateVersion: {
      create: stateCreate,
    },
    studentPortraitV2Snapshot: { create: snapshotCreate },
  };
  return { db, snapshotCreate, stateCreate, currentState };
}
