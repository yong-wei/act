import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { materializeIncrementalPortraitV2 } from '../portrait-v2-materialization';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_DIMENSION_IDS,
  createPortraitV2Payload,
} from '../portrait-v2-model';

const baseAt = new Date('2026-05-01T00:00:00.000Z');

describe('cumulative evidence risk and growth materialization', () => {
  it('persists only cumulative evidence risk and a redacted meaningful growth event', async () => {
    const facts = constraintFacts();
    const fixture = materializationFixture({ facts, journal: [], current: null });

    const result = await materializeIncrementalPortraitV2(fixture.db, 'student-1');

    expect(result.written).toBe(true);
    expect(fixture.db.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ factType: true }),
    }));
    expect(fixture.riskCreate).toHaveBeenCalledTimes(1);
    expect(fixture.riskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riskKey: 'constraint',
        riskType: 'CONSTRAINT',
        isActive: true,
        severity: 'medium',
      }),
    });
    const stateData = fixture.stateCreate.mock.calls[0][0].data;
    expect(stateData.lastRisk).toEqual([expect.objectContaining({
      type: 'constraint',
      severity: 'medium',
    })]);
    expect(JSON.stringify(stateData.lastRisk)).not.toContain('constraint-1');
    const growth = fixture.growthUpsert.mock.calls[0][0].create;
    expect(growth).toMatchObject({
      recordType: 'portrait-state-change',
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      stateGeneration: BigInt(7),
      isPublic: true,
    });
    expect(growth.evidenceJson.factHashes).toHaveLength(3);
    expect(JSON.stringify({
      businessKey: growth.businessKey,
      description: growth.description,
      evidenceJson: growth.evidenceJson,
    })).not.toContain('constraint-1');
    expect(fixture.riskCreate.mock.calls.flatMap((call: any[]) =>
      [call[0].data.riskKey])).not.toEqual(expect.arrayContaining(['participation', 'ai_misuse']));
  });

  it('does not reset trend/risk or append risk/growth for an unrelated context-only fact', async () => {
    const support = constraintFacts();
    const context = learningFact('context-only', {
      factType: 'ai_intervention',
      outcome: 'success',
      competencyContribution: { controlModeling: 1 },
      contextJson: {
        evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 },
      },
      startedAt: new Date('2026-05-05T00:00:00.000Z'),
    });
    const journal = [...support.map((fact, index) => transition(
      index + 1,
      fact,
      'UPSERT',
    )), transition(4, context, 'UPSERT')];
    const current = currentState(nativePortrait(70), BigInt(3), {
      lastTrend: 'down',
      lastRisk: [{ type: 'constraint', severity: 'medium', occurredAt: baseAt.toISOString() }],
    });
    const fixture = materializationFixture({
      facts: [...support, context],
      journal,
      current,
      riskRows: [{
        id: 'risk-constraint-active',
        userId: 'student-1',
        riskKey: 'constraint',
        riskType: 'CONSTRAINT',
        severity: 'medium',
        isActive: true,
        supportFactIds: {
          factIds: support.map((fact) => fact.id),
          metricDigest: digest({ poorConstraintCount: 3, violationCount: 0 }),
        },
        sourceTransitionSequence: BigInt(3),
        occurredAt: support[2].startedAt,
      }],
    });

    await materializeIncrementalPortraitV2(fixture.db, 'student-1');

    expect(fixture.riskCreate).not.toHaveBeenCalled();
    expect(fixture.growthUpsert).not.toHaveBeenCalled();
    expect(fixture.stateCreate.mock.calls[0][0].data).toMatchObject({
      lastTrend: 'down',
      lastRisk: [expect.objectContaining({ type: 'constraint', severity: 'medium' })],
    });
  });

  it('clears constraint on revoke, invalidates supported growth, and retries without duplicates', async () => {
    const facts = constraintFacts();
    const revokeAt = new Date('2026-05-06T00:00:00.000Z');
    const journal = [
      ...facts.map((fact, index) => transition(index + 1, fact, 'UPSERT')),
      transition(4, facts[2], 'REVOKE', revokeAt),
    ];
    const fixture = materializationFixture({
      facts,
      journal,
      current: currentState(nativePortrait(45), BigInt(3), {
        lastTrend: 'down',
        lastRisk: [{ type: 'constraint', severity: 'medium', occurredAt: baseAt.toISOString() }],
      }),
      riskRows: [{
        id: 'risk-constraint-active',
        userId: 'student-1',
        riskKey: 'constraint',
        riskType: 'CONSTRAINT',
        severity: 'medium',
        isActive: true,
        supportFactIds: {
          factIds: facts.map((fact) => fact.id),
          metricDigest: digest({ poorConstraintCount: 3, violationCount: 0 }),
        },
        sourceTransitionSequence: BigInt(3),
        occurredAt: facts[2].startedAt,
      }],
      growthRecords: [{
        id: 'growth-supported',
        evidenceJson: { factHashes: [hash(facts[2].id)] },
      }],
    });

    const first = await materializeIncrementalPortraitV2(fixture.db, 'student-1');
    const second = await materializeIncrementalPortraitV2(fixture.db, 'student-1');

    expect(first.written).toBe(true);
    expect(second.written).toBe(false);
    expect(fixture.riskCreate).toHaveBeenCalledTimes(1);
    expect(fixture.riskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riskKey: 'constraint',
        riskType: 'CONSTRAINT',
        isActive: false,
        sourceTransitionSequence: BigInt(4),
        occurredAt: revokeAt,
      }),
    });
    expect(fixture.invalidationCreateMany).toHaveBeenCalledTimes(1);
    expect(fixture.invalidationCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        growthRecordId: 'growth-supported',
        reason: 'supporting-fact-revoked',
        sourceTransitionSequence: BigInt(4),
      })],
      skipDuplicates: true,
    });
    expect(fixture.stateCreate.mock.calls[0][0].data.lastRisk).toEqual([]);
  });
});

function materializationFixture(input: {
  facts: ReturnType<typeof learningFact>[];
  journal: ReturnType<typeof transition>[];
  current: ReturnType<typeof currentState> | null;
  riskRows?: Array<Record<string, unknown>>;
  growthRecords?: Array<{ id: string; evidenceJson: unknown }>;
}) {
  const journal = [...input.journal];
  const riskRows = [...(input.riskRows ?? [])];
  const growthRecords = [...(input.growthRecords ?? [])];
  let current = input.current;
  let sequence = journal.reduce((maximum, row) =>
    row.sequence > maximum ? row.sequence : maximum, BigInt(0));
  let snapshotSequence = 0;
  let stateSequence = 0;
  const snapshots = new Map<string, unknown>();
  const stateCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: `state-${++stateSequence}`,
    ...data,
  }));
  const riskCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    riskRows.unshift({ id: `risk-${riskRows.length + 1}`, ...data });
    return data;
  });
  const growthUpsert = vi.fn(async ({ where, create }: any) => {
    if (!growthRecords.some((record: any) => record.derivedIdentity === where.derivedIdentity)) {
      growthRecords.push({ id: `growth-${growthRecords.length + 1}`, ...create });
    }
    return create;
  });
  const invalidationCreateMany = vi.fn(async () => ({ count: 1 }));
  const db: any = {
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
    learningFact: { findMany: vi.fn(async () => structuredClone(input.facts)) },
    learnerFactTransition: {
      findMany: vi.fn(async () => structuredClone(journal)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `transition-${String(data.sequence)}`,
          createdAt: new Date(),
          ...data,
        } as ReturnType<typeof transition>;
        journal.push(row);
        return row;
      }),
    },
    learnerFactTransitionSequence: {
      upsert: vi.fn(async () => ({})),
      update: vi.fn(async () => ({ lastSequence: ++sequence })),
    },
    cumulativePortraitCutoverFence: {
      findUnique: vi.fn(async () => ({
        fence: BigInt(4),
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        learnerGeneration: BigInt(7),
        queueGeneration: BigInt(11),
        activeMigrationRunId: 'run-1',
      })),
    },
    learnerPortraitCurrentState: {
      findUnique: vi.fn(async () => structuredClone(current)),
      upsert: vi.fn(async ({ create, update }: any) => {
        const pointer = current ? update : create;
        const stateData = stateCreate.mock.calls.at(-1)?.[0].data;
        const snapshotId = stateData?.snapshotId as string | null;
        current = {
          ...pointer,
          stateVersion: {
            overallScore: stateData?.overallScore ?? null,
            lastTrend: stateData?.lastTrend ?? null,
            lastRisk: stateData?.lastRisk ?? [],
            stateKind: stateData?.stateKind,
            trustedFactPolicyVersion: stateData?.trustedFactPolicyVersion ?? null,
            trustedInputDigest: stateData?.trustedInputDigest ?? null,
            snapshot: snapshotId
              ? { id: snapshotId, payload: snapshots.get(snapshotId) }
              : null,
          },
        };
        return current;
      }),
    },
    learnerPortraitStateVersion: { create: stateCreate },
    learnerEvidenceRiskState: {
      findMany: vi.fn(async () => structuredClone(riskRows)),
      create: riskCreate,
    },
    growthRecord: {
      findMany: vi.fn(async () => structuredClone(growthRecords)),
      upsert: growthUpsert,
    },
    growthRecordInvalidation: { createMany: invalidationCreateMany },
    studentPortraitV2Snapshot: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `snapshot-${++snapshotSequence}`;
        snapshots.set(id, structuredClone(data.payload));
        return { id, ...data };
      }),
    },
  };
  if (current?.stateVersion.snapshot?.id) {
    snapshots.set(current.stateVersion.snapshot.id, current.stateVersion.snapshot.payload);
  }
  return { db, riskCreate, growthUpsert, invalidationCreateMany, stateCreate };
}

function learningFact(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    sourceEventId: `governed-event:${id}`,
    sourceLogId: `governed-log:${id}`,
    knowledgeRevisionRef: null,
    factType: 'question',
    startedAt: baseAt,
    outcome: 'success',
    score: 1,
    competencyContribution: { controlModeling: 1 },
    contextJson: {},
    createdAt: baseAt,
    ...overrides,
  };
}

function constraintFacts() {
  return [1, 2, 3].map((index) => learningFact(`constraint-${index}`, {
    factType: 'simulation',
    outcome: 'failure',
    competencyContribution: { engineeringDecision: -1 },
    startedAt: new Date(`2026-05-0${index}T00:00:00.000Z`),
  }));
}

function transition(
  sequence: number,
  fact: ReturnType<typeof learningFact>,
  operation: 'UPSERT' | 'CORRECT' | 'REVOKE',
  occurredAt = fact.startedAt,
) {
  return {
    id: `transition-${sequence}`,
    userId: 'student-1',
    sequence: BigInt(sequence),
    factId: fact.id,
    operation,
    occurredAt,
    transitionPayload: null,
    sourceReference: null,
    correctionOfSequence: operation === 'UPSERT' ? null : BigInt(sequence - 1),
    createdAt: occurredAt,
  };
}

function currentState(
  payload: ReturnType<typeof nativePortrait>,
  stateWatermark: bigint,
  state: { lastTrend: string; lastRisk: unknown },
) {
  return {
    stateWatermark,
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    generation: BigInt(7),
    queueGeneration: BigInt(11),
    cutoverFence: BigInt(4),
    stateVersion: {
      overallScore: 70,
      lastTrend: state.lastTrend,
      lastRisk: state.lastRisk,
      stateKind: 'SNAPSHOT' as const,
      snapshot: { id: 'snapshot-current', payload },
    },
  };
}

function nativePortrait(score: number) {
  return createPortraitV2Payload({
    userId: 'student-1',
    generatedAt: baseAt.toISOString(),
    now: baseAt,
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id) => ({
      id,
      score,
      confidence: 0.8,
      freshness: { state: 'current', asOf: baseAt.toISOString(), evidenceAgeDays: 0 },
      evidenceSummary: { totalCount: 3, sourceFamilyCounts: { LearningFact: 3 } },
      lastPositiveEvidenceAt: baseAt.toISOString(),
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [{
        kind: 'evidence-family',
        ref: 'LearningFact',
        privacyScope: 'student-visible',
      }],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
  });
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function digest(value: unknown): string {
  return hash(JSON.stringify(value));
}
