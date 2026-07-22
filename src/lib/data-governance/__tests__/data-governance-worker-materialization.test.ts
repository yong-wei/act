import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  portrait: vi.fn(async (): Promise<{
    written: boolean;
    mappingIssues: string[];
    evidenceCount?: number;
    affectedDimensions?: string[];
  }> => ({ written: true, mappingIssues: [] })),
  refreshCache: vi.fn(async () => undefined),
  events: [] as any[],
  markEventsProcessed: vi.fn(async () => undefined),
}));

vi.mock('../portrait-v2-materialization', () => ({ materializeIncrementalPortraitV2: mocks.portrait }));
vi.mock('../event-buffer', () => ({
  fetchSecondaryEvents: vi.fn(async () => mocks.events),
  markEventsProcessed: mocks.markEventsProcessed,
}));
vi.mock('../learning-fact-materialization', () => ({ eventToLearningFactInput: (event: unknown) => event }));
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

import { configureDataGovernanceWorkerForTest, processClassSnapshotJob, processEventIngestionJob, processStudentSnapshotJob } from '../../../../scripts/workers/data-governance-worker';
import { dispatchGrowthRecomputeOutbox } from '../derived-learning-materialization';

function fact(id: string) {
  return { id, userId: 'student-1', sourceLogId: null, factType: 'assessment', outcome: 'success', score: 1, startedAt: new Date('2026-07-15T00:00:00Z'), createdAt: new Date('2026-07-15T00:00:01Z'), contextJson: {} };
}

describe('data governance worker materialization recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.events = [];
  });

  it('schedules each affected learner once after a batch creates facts', async () => {
    mocks.events = [
      { id: 'fact-1', userId: 'student-1' },
      { id: 'fact-2', userId: 'student-1' },
      { id: 'fact-3', userId: 'student-2' },
    ];
    const add = vi.fn(async (_name: string, _data: unknown, _options: unknown) => undefined);
    const db: any = {
      learningEventBatch: { create: vi.fn(async () => undefined) },
      learningFact: { createMany: vi.fn(async () => ({ count: 3 })) },
    };
    configureDataGovernanceWorkerForTest({ db, studentJobQueue: { add } as any });

    await processEventIngestionJob({ id: 'batch-job-1', data: { batchDate: '2026-07-15' } } as any);

    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls.map((call) => call[1])).toEqual([
      { userId: 'student-1' },
      { userId: 'student-2' },
    ]);
  });

  it('retries learner scheduling when a repeated batch creates no new facts', async () => {
    mocks.events = [{ id: 'fact-1', userId: 'student-1' }];
    const add = vi.fn(async () => undefined);
    const db: any = {
      learningEventBatch: { create: vi.fn(async () => undefined) },
      learningFact: { createMany: vi.fn(async () => ({ count: 0 })) },
    };
    configureDataGovernanceWorkerForTest({ db, studentJobQueue: { add } as any });

    await processEventIngestionJob({ id: 'batch-job-repeat', data: { batchDate: '2026-07-15' } } as any);

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      'student-snapshot-student-1',
      { userId: 'student-1' },
      expect.objectContaining({ jobId: 'student-snapshot-student-1-batch-job-repeat' }),
    );
  });

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

  it('returns before compatibility and dependent writes for first-run context-only evidence', async () => {
    mocks.portrait.mockResolvedValueOnce({ written: false, mappingIssues: [], evidenceCount: 0, affectedDimensions: [] });
    const contextOnlyFact = {
      ...fact('context-only-first'),
      competencyContribution: { controlModeling: 1 },
      contextJson: { evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 } },
    };
    const snapshotCreate = vi.fn();
    const profileUpsert = vi.fn();
    const riskUpdate = vi.fn();
    const outboxUpsert = vi.fn();
    const classAdd = vi.fn(async () => undefined);
    const db: any = {
      $transaction: async (callback: any) => callback(db),
      $executeRaw: async () => undefined,
      learningMaterializationGeneration: { findUnique: async () => null },
      learningMaterializationRebuildRequest: { findUnique: async () => null },
      learningFact: { findMany: async () => [contextOnlyFact] },
      studentProfile: { findUnique: async () => ({ classId: 'class-1' }) },
      user: { findUnique: async () => ({ name: null, profile: { studentNumber: null } }) },
      gradingProviderPolicy: { findFirst: async () => null },
      growthRecord: { findUnique: async () => null, findFirst: async () => null },
      studentCompetencySnapshot: { create: snapshotCreate },
      studentProfileSummary: { upsert: profileUpsert },
      studentRiskFlag: { updateMany: riskUpdate },
      learningMaterializationOutbox: { upsert: outboxUpsert },
    };
    configureDataGovernanceWorkerForTest({ db, classJobQueue: { add: classAdd } as any });

    const result = await processStudentSnapshotJob({ data: { userId: 'student-1' } } as any);

    expect(result).toMatchObject({ skipped: true, reason: 'no_portrait_state_change', featureCacheRefreshed: false });
    expect(snapshotCreate).not.toHaveBeenCalled();
    expect(profileUpsert).not.toHaveBeenCalled();
    expect(riskUpdate).not.toHaveBeenCalled();
    expect(mocks.refreshCache).not.toHaveBeenCalled();
    expect(outboxUpsert).not.toHaveBeenCalled();
    expect(classAdd).not.toHaveBeenCalled();
  });

  it('immediately enqueues the class when a late portrait fact leaves the compatibility window empty', async () => {
    const outboxRows: any[] = [];
    const classAdd = vi.fn(async () => undefined);
    const db: any = {
      $transaction: async (callback: any) => callback(db),
      $executeRaw: async () => undefined,
      learningMaterializationGeneration: { findUnique: async () => null },
      learningMaterializationRebuildRequest: { findUnique: async () => null },
      learningFact: { findMany: async () => [] },
      interactionLog: { findMany: async () => [] },
      studentCompetencySnapshot: {
        findFirst: async () => null,
        create: async ({ data }: any) => ({ id: 'late-empty-snapshot', ...data }),
      },
      studentProfile: {
        findMany: async () => [{ classId: 'class-1' }],
        findUnique: async () => ({ classId: 'class-1' }),
      },
      studentRiskFlag: { updateMany: async () => ({ count: 0 }) },
      learningMaterializationOutbox: {
        upsert: async ({ create }: any) => {
          const existing = outboxRows.find((row) => row.dedupeKey === create.dedupeKey);
          if (existing) return existing;
          outboxRows.push(create);
          return create;
        },
        updateMany: async ({ where, data }: any) => {
          const row = outboxRows.find((item) => item.id === where.id && item.status === where.status);
          if (!row) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
      },
    };
    configureDataGovernanceWorkerForTest({ db, classJobQueue: { add: classAdd } as any });

    const result = await processStudentSnapshotJob({ data: { userId: 'student-1' } } as any);

    expect(result).toMatchObject({ reason: 'no_recent_evidence', snapshotId: 'late-empty-snapshot' });
    expect(classAdd).toHaveBeenCalledWith(
      'class-snapshot-class-1',
      { classId: 'class-1' },
      expect.objectContaining({ jobId: 'learning-materialization-outbox:student-1:class-1:late-empty-snapshot' }),
    );
    expect(outboxRows).toEqual([
      expect.objectContaining({ snapshotId: 'late-empty-snapshot', status: 'DELIVERED' }),
    ]);
  });

  it('does not discover a learner from an aged snapshot alone', async () => {
    const agedSnapshotRead = vi.fn(async () => [{ userId: 'aged-student' }]);
    const studentAdd = vi.fn(async () => undefined);
    const db: any = {
      learningMaterializationOutbox: {
        deleteMany: async () => ({ count: 0 }),
        findMany: async () => [],
      },
      growthRecord: { deleteMany: async () => ({ count: 0 }) },
      learningMaterializationRebuildRequest: { findMany: async () => [] },
      interactionLog: { findMany: async () => [] },
      learningFact: { findMany: async () => [] },
      studentProfile: { findMany: vi.fn(async () => []) },
      studentCompetencySnapshot: { findMany: agedSnapshotRead },
    };
    configureDataGovernanceWorkerForTest({ db, studentJobQueue: { add: studentAdd } as any });

    const result = await processStudentSnapshotJob({ data: { coordinator: true } } as any);

    expect(result).toEqual({ scheduled: 0 });
    expect(agedSnapshotRead).not.toHaveBeenCalled();
    expect(studentAdd).not.toHaveBeenCalled();
  });

  it('durably reschedules a Growth digest mismatch and the real worker eventually writes Growth', async () => {
    const factsA = [fact('fact-a')];
    const factsB = [fact('fact-a'), fact('fact-b')];
    let factReads = 0;
    let latestSnapshot: any = null;
    const growthCreates: any[] = [];
    const outboxRows: any[] = [];
    const classAdd = vi.fn(async () => undefined);
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
        findMany: async ({ where }: any) => outboxRows.filter((row) => row.kind === where.kind && ['PENDING', 'CLAIMED'].includes(row.status)),
        updateMany: async ({ where, data }: any) => { const row = outboxRows.find((item) => item.id === where.id); if (!row || (where.status && row.status !== where.status)) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
      },
    };
    configureDataGovernanceWorkerForTest({ db, classJobQueue: { add: classAdd } as any });

    await processStudentSnapshotJob({ data: { userId: 'student-1' } } as any);
    expect(growthCreates).toHaveLength(0);
    expect(outboxRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'GROWTH_RECOMPUTE', snapshotId: 'snapshot-b', status: 'PENDING' }),
      expect.objectContaining({ kind: 'CLASS_SNAPSHOT', classId: 'class-1', snapshotId: 'snapshot-b', status: 'DELIVERED' }),
    ]));
    expect(classAdd).toHaveBeenCalledTimes(1);
    expect(classAdd).toHaveBeenCalledWith(
      'class-snapshot-class-1',
      { classId: 'class-1' },
      expect.objectContaining({ jobId: 'learning-materialization-outbox:student-1:class-1:snapshot-b' }),
    );

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
    const classAdd = vi.fn(async () => undefined);
    const db: any = {
      $transaction: async (callback: any) => callback(db), $executeRaw: async () => undefined,
      learningMaterializationGeneration: { findUnique: async () => null },
      learningMaterializationRebuildRequest: { findUnique: async () => null },
      learningFact: { findMany: async () => [] }, interactionLog: { findMany: async () => [] },
      studentCompetencySnapshot: { findFirst: async () => latestSnapshot, create: async ({ data }: any) => { creates.push(data); return data; } },
      studentProfile: { findMany: async () => [{ classId: 'class-1' }], findUnique: async () => ({ classId: 'class-1' }) },
      studentRiskFlag: { updateMany: async () => ({ count: 0 }) },
      learningMaterializationOutbox: {
        upsert: async ({ create }: any) => { const existing = outboxRows.find((row) => row.dedupeKey === create.dedupeKey); if (existing) return existing; outboxRows.push({ ...create, status: 'DELIVERED' }); return create; },
        updateMany: async () => ({ count: 0 }),
      },
    };
    configureDataGovernanceWorkerForTest({ db, classJobQueue: { add: classAdd } as any });
    await processStudentSnapshotJob({ data: { userId: 'student-1' } } as any);
    await processStudentSnapshotJob({ data: { userId: 'student-1' } } as any);
    expect(creates).toEqual([]);
    expect(outboxRows).toEqual([expect.objectContaining({ snapshotId: 'empty-transition-1', status: 'DELIVERED' })]);
  });
});
