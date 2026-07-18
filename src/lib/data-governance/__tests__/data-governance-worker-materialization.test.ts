import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  portrait: vi.fn(async () => ({ mappingIssues: [] })),
  refreshCache: vi.fn(async () => undefined),
}));

vi.mock('../portrait-v2-materialization', () => ({ materializeIncrementalPortraitV2: mocks.portrait }));
vi.mock('../student-evidence-feature-cache', () => ({
  rebuildStudentEvidenceFeatureCache: vi.fn(),
  refreshStudentEvidenceFeatureCache: mocks.refreshCache,
}));
vi.mock('../risk-detector', () => ({ detectRisks: () => [], getRecommendedScaffolding: () => [], getRiskLevelDescription: () => 'none' }));
vi.mock('../competency-engine', () => ({
  calculateCompetencyVector: () => ({ controlModeling: { score: 80, trend: 'stable', confidence: 1, evidenceCount: 1, lastUpdated: '' }, parameterDesign: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: '' }, crossDomainTransfer: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: '' }, engineeringDecision: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: '' }, inquiryReflection: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: '' }, selfDirectedLearning: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: '' } }),
  calculateTrendVector: (value: unknown) => value,
  generateEvidenceSummary: (facts: any[]) => ({ controlModeling: facts.map((fact) => ({ id: fact.id })) }),
  identifyStrengths: () => [], identifyWeaknesses: () => [],
}));

import { configureDataGovernanceWorkerForTest, processClassSnapshotJob, processStudentSnapshotJob } from '../../../../scripts/workers/data-governance-worker';
import { dispatchGrowthRecomputeOutbox } from '../derived-learning-materialization';

function fact(id: string) {
  return { id, userId: 'student-1', sourceLogId: null, factType: 'assessment', outcome: 'success', score: 1, startedAt: new Date('2026-07-15T00:00:00Z'), createdAt: new Date('2026-07-15T00:00:01Z'), contextJson: {} };
}

describe('data governance worker materialization recovery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries real Prisma facts with the target class/session scope and ignores legacy class snapshots', async () => {
    const factQueries: any[] = [];
    const snapshotReads: any[] = [];
    const creates: any[] = [];
    const db: any = {
      studentProfile: { findMany: async () => [{ userId: 'student-1' }] },
      classSession: { findMany: async () => [{ id: 'session-a' }] },
      learningFact: { findMany: async (args: any) => { factQueries.push(args); return [{ ...fact('a-low'), competencyContribution: { controlModeling: 0.2 }, contextJson: { classId: 'class-a' } }]; } },
      classCompetencySnapshot: {
        findFirst: async (args: any) => { snapshotReads.push(args); return null; },
        create: async ({ data }: any) => { creates.push(data); return { id: 'class-v2', ...data }; },
      },
    };
    configureDataGovernanceWorkerForTest({ db });
    await processClassSnapshotJob({ data: { classId: 'class-a' } } as any);
    expect(factQueries[0].where.OR).toEqual(expect.arrayContaining([{ sessionId: { in: ['session-a'] } }, { contextJson: { path: ['arena', 'classId'], equals: 'class-a' } }]));
    expect(snapshotReads[0].where).toEqual({ classId: 'class-a', materializationVersion: 'class-competency.v2' });
    expect(creates[0]).toMatchObject({ classId: 'class-a', materializationVersion: 'class-competency.v2' });
  });

  it('durably reschedules a Growth digest mismatch and the real worker eventually writes Growth', async () => {
    const factsA = [fact('fact-a')];
    const factsB = [fact('fact-a'), fact('fact-b')];
    let factReads = 0;
    let latestSnapshot: any = null;
    const growthCreates: any[] = [];
    const outboxRows: any[] = [];
    const db: any = {
      $transaction: async (callback: any) => callback(db),
      $executeRaw: async () => undefined,
      learningMaterializationGeneration: { findUnique: async () => null },
      learningMaterializationRebuildRequest: { findUnique: async () => null },
      learningFact: { findMany: async () => (++factReads === 1 ? factsA : factsB) },
      interactionLog: { findMany: async () => [] },
      studentCompetencySnapshot: {
        findFirst: async () => latestSnapshot,
        create: async ({ data }: any) => (latestSnapshot = { id: 'snapshot-b', ...data }),
      },
      studentProfile: { findUnique: async () => ({ classId: 'class-1' }), findMany: async () => [] },
      user: { findUnique: async () => ({ name: null, profile: { studentNumber: null } }) },
      gradingProviderPolicy: { findFirst: async () => null },
      growthRecord: {
        findUnique: async () => null,
        findFirst: async () => null,
        create: async ({ data }: any) => { growthCreates.push(data); return data; },
        updateMany: async () => ({ count: 0 }),
      },
      studentProfileSummary: { upsert: async () => undefined },
      studentRiskFlag: { updateMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }) },
      learningMaterializationOutbox: {
        upsert: async ({ create }: any) => { const existing = outboxRows.find((row) => row.dedupeKey === create.dedupeKey); if (existing) return existing; outboxRows.push({ ...create }); return create; },
        deleteMany: async () => ({ count: 0 }),
        findMany: async ({ where }: any) => outboxRows.filter((row) => row.kind === where.kind && row.status === 'PENDING'),
        updateMany: async ({ where, data }: any) => { const row = outboxRows.find((item) => item.id === where.id); if (!row || (where.status && row.status !== where.status)) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
      },
    };
    configureDataGovernanceWorkerForTest({ db });

    await processStudentSnapshotJob({ data: { userId: 'student-1' } } as any);
    expect(growthCreates).toHaveLength(0);
    expect(outboxRows).toEqual([expect.objectContaining({ kind: 'GROWTH_RECOMPUTE', snapshotId: 'snapshot-b', status: 'PENDING' })]);

    const queued: any[] = [];
    await dispatchGrowthRecomputeOutbox(db, async (userId, snapshotId) => queued.push({ data: { userId, growthRecomputeForSnapshot: snapshotId } }), new Date('2026-07-15T00:01:00Z'));
    expect(queued).toHaveLength(1);
    await processStudentSnapshotJob(queued[0]);
    expect(growthCreates).toHaveLength(1);
    expect(growthCreates[0]).toMatchObject({ userId: 'student-1', recordType: 'competency_evaluation' });
  });

  it('keeps repeated active no-recent jobs idempotent while retaining one delivered class transition', async () => {
    const latestSnapshot = { id: 'empty-transition-1', userId: 'student-1', snapshotAt: new Date('2026-07-15T00:00:00Z'), factCount: 0, competencyVector: {}, evidenceSummary: { _derivation: { state: 'no-recent-evidence' } } };
    const creates: any[] = [];
    const outboxRows: any[] = [];
    const db: any = {
      $transaction: async (callback: any) => callback(db), $executeRaw: async () => undefined,
      learningMaterializationGeneration: { findUnique: async () => null },
      learningMaterializationRebuildRequest: { findUnique: async () => null },
      learningFact: { findMany: async () => [] }, interactionLog: { findMany: async () => [] },
      studentCompetencySnapshot: { findFirst: async () => latestSnapshot, create: async ({ data }: any) => { creates.push(data); return data; } },
      studentProfile: { findMany: async () => [{ classId: 'class-1' }], findUnique: async () => ({ classId: 'class-1' }) },
      studentRiskFlag: { updateMany: async () => ({ count: 0 }) },
      learningMaterializationOutbox: { upsert: async ({ create }: any) => { const existing = outboxRows.find((row) => row.dedupeKey === create.dedupeKey); if (existing) return existing; outboxRows.push({ ...create, status: 'DELIVERED' }); return create; } },
    };
    configureDataGovernanceWorkerForTest({ db });
    await processStudentSnapshotJob({ data: { userId: 'student-1' } } as any);
    await processStudentSnapshotJob({ data: { userId: 'student-1' } } as any);
    expect(creates).toEqual([]);
    expect(outboxRows).toEqual([expect.objectContaining({ snapshotId: 'empty-transition-1', status: 'DELIVERED' })]);
  });
});
