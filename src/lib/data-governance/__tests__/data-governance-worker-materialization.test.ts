import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  portrait: vi.fn(async (): Promise<{
    written: boolean;
    mappingIssues: string[];
    evidenceCount?: number;
    affectedDimensions?: string[];
  }> => ({ written: true, mappingIssues: [] })),
  refreshCache: vi.fn(async () => undefined),
  prepareGrowth: vi.fn(),
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
vi.mock('../growth-evaluation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../growth-evaluation')>();
  mocks.prepareGrowth.mockImplementation(actual.prepareGrowthEvaluationDescription);
  return { ...actual, prepareGrowthEvaluationDescription: mocks.prepareGrowth };
});
vi.mock('../risk-detector', () => ({ detectRisks: () => [], getRecommendedScaffolding: () => [], getRiskLevelDescription: () => 'none' }));
vi.mock('../competency-engine', () => ({
  calculateCompetencyVector: () => ({ controlModeling: { score: 80, trend: 'stable', confidence: 1, evidenceCount: 1, lastUpdated: '' }, parameterDesign: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: '' }, crossDomainTransfer: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: '' }, engineeringDecision: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: '' }, inquiryReflection: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: '' }, selfDirectedLearning: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: '' } }),
  calculateTrendVector: (value: unknown) => value,
  generateEvidenceSummary: (facts: any[]) => ({ controlModeling: facts.map((fact) => ({ id: fact.id })) }),
  identifyStrengths: () => [], identifyWeaknesses: () => [],
}));

import { configureDataGovernanceWorkerForTest, processClassSnapshotJob, processEventIngestionJob, processStudentSnapshotJob } from '../../../../scripts/workers/data-governance-worker';
import { dispatchGrowthRecomputeOutbox } from '../derived-learning-materialization';
import { hasPortraitV2Evidence, resolvePrimaryPortraitV2 } from '../portrait-v2-consumer';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_DIMENSION_IDS,
  createPortraitV2Payload,
} from '../portrait-v2-model';

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

  it('aggregates the current roster latest valid native portraits without touching recent snapshots', async () => {
    const generatedAt = '2026-07-01T00:00:00.000Z';
    const payload = createPortraitV2Payload({
      userId: 'student-1',
      generatedAt,
      now: generatedAt,
      dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id) => ({
        id,
        score: 78,
        confidence: 0.8,
        freshness: { state: 'current' as const, asOf: generatedAt, evidenceAgeDays: 0 },
        evidenceSummary: { totalCount: 2, sourceFamilyCounts: { LearningFact: 2 } },
        lastPositiveEvidenceAt: generatedAt,
        lastNegativeEvidenceAt: null,
        rationale: 'Governed evidence supports the current score.',
        limitations: [],
        sourceLineage: [{ kind: 'evidence-family' as const, ref: 'LearningFact', privacyScope: 'student-visible' as const }],
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      })),
    });
    const nativeRow = {
      id: 'portrait-valid', userId: 'student-1', snapshotAt: new Date(generatedAt),
      payloadVersion: payload.payloadVersion, calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: payload.migrationVersion, derivationKind: 'native', payload,
    };
    const creates: any[] = [];
    const classSessionFindMany = vi.fn();
    const learningFactFindMany = vi.fn();
    const db: any = {
      studentProfile: { findMany: async () => [{ userId: 'student-1' }, { userId: 'student-2' }] },
      studentPortraitV2Snapshot: { findMany: async () => [
        { ...nativeRow, id: 'portrait-corrupt-newest', snapshotAt: new Date('2026-07-02T00:00:00Z'), payload: { invalid: true } },
        nativeRow,
      ] },
      classSession: { findMany: classSessionFindMany },
      learningFact: { findMany: learningFactFindMany },
      classCompetencySnapshot: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => { creates.push(data); return { id: 'cumulative-1', ...data }; }),
      },
    };
    configureDataGovernanceWorkerForTest({ db });

    const result = await processClassSnapshotJob({ data: {
      classId: 'class-a',
      scope: 'cumulative',
      runRef: 'run-opaque-1',
      requestedAfter: '2026-07-22T00:00:00.000Z',
    } } as any);

    expect(result).toMatchObject({ scope: 'cumulative', studentCount: 1, totalStudentCount: 2 });
    expect(classSessionFindMany).not.toHaveBeenCalled();
    expect(learningFactFindMany).not.toHaveBeenCalled();
    expect(db.classCompetencySnapshot.findFirst).not.toHaveBeenCalled();
    expect(creates[0]).toMatchObject({
      classId: 'class-a',
      materializationVersion: 'class-competency.cumulative.v1',
      activeStudentCount: 1,
      totalStudentCount: 2,
      aggregateJson: {
        scope: 'cumulative',
        coverage: { validNativePortraits: 1, totalRoster: 2, ratio: 0.5 },
        _materialization: { runRef: 'run-opaque-1', requestedAfter: '2026-07-22T00:00:00.000Z' },
      },
      trendJson: { _derivation: { state: 'not-applicable' } },
      riskSummaryJson: { _derivation: { state: 'not-applicable' } },
    });
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
    const learningFactFindMany = vi.fn(async () => [contextOnlyFact]);
    const db: any = {
      $transaction: async (callback: any) => callback(db),
      $executeRaw: async () => undefined,
      learningMaterializationGeneration: { findUnique: async () => null },
      learningMaterializationRebuildRequest: { findUnique: async () => null },
      learningFact: { findMany: learningFactFindMany },
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
    expect(mocks.portrait).toHaveBeenCalledTimes(1);
    expect(mocks.portrait).toHaveBeenCalledWith(db, 'student-1', expect.objectContaining({ dryRun: true }));
    expect(learningFactFindMany).not.toHaveBeenCalled();
    expect(snapshotCreate).not.toHaveBeenCalled();
    expect(profileUpsert).not.toHaveBeenCalled();
    expect(riskUpdate).not.toHaveBeenCalled();
    expect(mocks.refreshCache).not.toHaveBeenCalled();
    expect(mocks.prepareGrowth).not.toHaveBeenCalled();
    expect(outboxUpsert).not.toHaveBeenCalled();
    expect(classAdd).not.toHaveBeenCalled();
  });

  it('revokes old native and cached derived state when a full rebuild has only context evidence', async () => {
    const generatedAt = '2026-07-01T00:00:00.000Z';
    const oldPayload = createPortraitV2Payload({
      userId: 'student-1',
      generatedAt,
      now: generatedAt,
      dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id) => ({
        id,
        score: 78,
        confidence: 0.8,
        freshness: { state: 'current' as const, asOf: generatedAt, evidenceAgeDays: 0 },
        evidenceSummary: { totalCount: 1, sourceFamilyCounts: { LearningFact: 1 } },
        lastPositiveEvidenceAt: generatedAt,
        lastNegativeEvidenceAt: null,
        rationale: 'Governed evidence supports the current score.',
        limitations: [],
        sourceLineage: [{ kind: 'evidence-family' as const, ref: 'LearningFact', privacyScope: 'student-visible' as const }],
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      })),
    });
    let nativeRow: any = {
      id: 'old-native', userId: 'student-1', snapshotAt: new Date(generatedAt),
      payloadVersion: oldPayload.payloadVersion, calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: oldPayload.migrationVersion, derivationKind: 'native', payload: oldPayload,
    };
    let featureCache: any = { userId: 'student-1', featureJson: { portraitV2: oldPayload } };
    let rebuildRequest: any = {
      userId: 'student-1', classIds: [], generation: 4, status: 'PENDING',
      claimToken: null, claimExpiresAt: null, claimedGeneration: null,
    };
    let compatibilitySnapshot: any = null;
    const contextFact = {
      ...fact('context-only-full-rebuild'),
      contextJson: { evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 } },
    };
    const db: any = {
      $transaction: async (callback: any) => callback(db),
      $executeRaw: async () => undefined,
      learningMaterializationRebuildRequest: {
        findUnique: async () => rebuildRequest,
        updateMany: async ({ data }: any) => {
          if (!rebuildRequest) return { count: 0 };
          rebuildRequest = { ...rebuildRequest, ...data };
          return { count: 1 };
        },
        deleteMany: async () => { rebuildRequest = null; return { count: 1 }; },
      },
      learningMaterializationGeneration: { findUnique: async () => ({ generation: 4 }) },
      learningFact: { findMany: async () => [contextFact] },
      interactionLog: { findMany: async () => [] },
      studentPortraitV2Snapshot: {
        findFirst: async () => nativeRow,
        deleteMany: async () => { nativeRow = null; return { count: 1 }; },
      },
      studentEvidenceFeatureCache: {
        findUnique: async () => featureCache,
        deleteMany: async () => { featureCache = null; return { count: 1 }; },
      },
      studentCompetencySnapshot: {
        findFirst: async () => compatibilitySnapshot,
        create: async ({ data }: any) => (compatibilitySnapshot = { id: 'no-evidence-current', ...data }),
      },
      studentProfile: { findUnique: async () => ({ classId: 'class-1' }), findMany: async () => [{ classId: 'class-1' }] },
      studentProfileSummary: { deleteMany: vi.fn(async () => ({ count: 1 })) },
      growthRecord: { deleteMany: vi.fn(async () => ({ count: 1 })) },
      diagnosisReportSnapshot: { deleteMany: vi.fn(async () => ({ count: 1 })) },
      studentRiskFlag: { updateMany: vi.fn(async () => ({ count: 1 })) },
    };
    mocks.prepareGrowth.mockResolvedValueOnce(null);
    mocks.portrait
      .mockResolvedValueOnce({ written: false, mappingIssues: [], evidenceCount: 0, affectedDimensions: [] })
      .mockImplementationOnce(async () => {
        await db.studentPortraitV2Snapshot.deleteMany();
        return { written: false, mappingIssues: [], evidenceCount: 0, affectedDimensions: [] };
      });
    configureDataGovernanceWorkerForTest({ db });

    const result = await processStudentSnapshotJob({ data: {
      userId: 'student-1', fullRebuild: true, rebuildGeneration: 4,
    } } as any);
    const resolution = await resolvePrimaryPortraitV2(db, 'student-1', 'student', { now: new Date() });

    expect(result).toMatchObject({ attainmentOutcome: 'no-evidence', reason: 'no_portrait_evidence' });
    expect(nativeRow).toBeNull();
    expect(featureCache).toBeNull();
    expect(compatibilitySnapshot).toMatchObject({
      factCount: 0,
      evidenceSummary: { _derivation: { state: 'no-evidence-after-revocation', reason: 'no-governed-portrait-contribution' } },
    });
    expect(hasPortraitV2Evidence(resolution.primaryPortrait)).toBe(false);
    expect(db.diagnosisReportSnapshot.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.diagnosisReportSnapshot.deleteMany).toHaveBeenCalledWith({ where: {
      userId: { in: ['student-1'] },
      subjectKind: { not: 'class' },
    } });
    expect(db.learningFact.findMany()).resolves.toEqual([contextFact]);
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
      expect.objectContaining({ jobId: 'learning-materialization-outbox-f4021ce06a107fd95fb36daa5a959d4703ae4bc9079427b55841333f9e064350' }),
    );
    expect(classAdd).toHaveBeenCalledWith(
      'class-snapshot-class-1',
      { classId: 'class-1' },
      expect.objectContaining({ jobId: expect.not.stringContaining(':') }),
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
    const snapshotCreate = vi.fn(async ({ data }: any) => (latestSnapshot = { id: 'snapshot-b', ...data }));
    const profileUpsert = vi.fn(async () => undefined);
    const riskUpdate = vi.fn(async () => ({ count: 0 }));
    const riskCreate = vi.fn(async () => ({ count: 0 }));
    const outboxUpsert = vi.fn(async ({ create }: any) => { const existing = outboxRows.find((row) => row.dedupeKey === create.dedupeKey); if (existing) return existing; outboxRows.push({ ...create }); return create; });
    const outboxUpdate = vi.fn(async ({ where, data }: any) => { const row = outboxRows.find((item) => item.id === where.id); if (!row || (where.status && row.status !== where.status)) return { count: 0 }; Object.assign(row, data); return { count: 1 }; });
    let transactionDepth = 0;
    const db: any = {
      $transaction: async (callback: any) => {
        transactionDepth += 1;
        try {
          return await callback(db);
        } finally {
          transactionDepth -= 1;
        }
      },
      $executeRaw: async () => undefined,
      learningMaterializationGeneration: { findUnique: async () => null },
      learningMaterializationRebuildRequest: { findUnique: async () => null },
      learningFact: { findMany: async () => (++factReads === 1 ? factsA : factsB) },
      interactionLog: { findMany: async () => [] },
      studentCompetencySnapshot: {
        findFirst: async () => latestSnapshot,
        create: snapshotCreate,
      },
      studentProfile: { findUnique: async () => ({ classId: 'class-1' }), findMany: async () => [] },
      user: { findUnique: async () => { expect(transactionDepth).toBe(0); return { name: null, profile: { studentNumber: null } }; } },
      gradingProviderPolicy: { findFirst: async () => null },
      growthRecord: {
        findUnique: async () => null,
        findFirst: async () => null,
        create: async ({ data }: any) => { growthCreates.push(data); return data; },
        updateMany: async () => ({ count: 0 }),
      },
      studentProfileSummary: { upsert: profileUpsert },
      studentRiskFlag: { updateMany: riskUpdate, createMany: riskCreate },
      learningMaterializationOutbox: {
        upsert: outboxUpsert,
        deleteMany: async () => ({ count: 0 }),
        findMany: async ({ where }: any) => outboxRows.filter((row) => row.kind === where.kind && ['PENDING', 'CLAIMED'].includes(row.status)),
        updateMany: outboxUpdate,
      },
    };
    configureDataGovernanceWorkerForTest({ db, classJobQueue: { add: classAdd } as any });
    mocks.prepareGrowth.mockImplementationOnce(async () => {
      expect(transactionDepth).toBe(0);
      return null;
    });

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
      expect.objectContaining({ jobId: 'learning-materialization-outbox-6591f8e358f41edb8d5280b05c671f0a0ddb1fb7408e8b5c819db3484c3bde72' }),
    );
    expect(classAdd).toHaveBeenCalledWith(
      'class-snapshot-class-1',
      { classId: 'class-1' },
      expect.objectContaining({ jobId: expect.not.stringContaining(':') }),
    );

    const queued: any[] = [];
    await dispatchGrowthRecomputeOutbox(db, async (userId, snapshotId) => queued.push({ data: { userId, growthRecomputeForSnapshot: snapshotId } }), new Date('2026-07-15T00:01:00Z'));
    expect(queued).toHaveLength(1);
    factsB.push({
      ...fact('context-only-after-snapshot'),
      contextJson: { evidenceGovernance: { skipProfileContribution: true, profileWeight: 0 } },
    });
    const factReadsBeforeRetry = factReads;
    const writesBeforeRetry = {
      snapshot: snapshotCreate.mock.calls.length,
      profile: profileUpsert.mock.calls.length,
      riskUpdate: riskUpdate.mock.calls.length,
      riskCreate: riskCreate.mock.calls.length,
      outboxUpsert: outboxUpsert.mock.calls.length,
      outboxUpdate: outboxUpdate.mock.calls.length,
      classAdd: classAdd.mock.calls.length,
    };
    mocks.portrait.mockClear();
    mocks.refreshCache.mockClear();
    mocks.prepareGrowth.mockClear();
    mocks.portrait.mockResolvedValueOnce({ written: false, mappingIssues: [], evidenceCount: 0, affectedDimensions: [] });
    const recomputeResult = await processStudentSnapshotJob(queued[0]);
    expect(recomputeResult).toMatchObject({ skipped: false, reason: 'growth_created', snapshotId: 'snapshot-b', featureCacheRefreshed: false });
    expect(growthCreates).toHaveLength(1);
    expect(growthCreates[0]).toMatchObject({ userId: 'student-1', recordType: 'competency_evaluation' });
    expect(mocks.prepareGrowth).toHaveBeenCalledWith(db, expect.objectContaining({
      snapshot: expect.objectContaining({ id: 'snapshot-b', factCount: 2, evidenceSummary: { controlModeling: [{ id: 'fact-a' }, { id: 'fact-b' }] } }),
    }));
    expect(factReads).toBe(factReadsBeforeRetry);
    expect(mocks.portrait).not.toHaveBeenCalled();
    expect(mocks.refreshCache).not.toHaveBeenCalled();
    expect(snapshotCreate).toHaveBeenCalledTimes(writesBeforeRetry.snapshot);
    expect(profileUpsert).toHaveBeenCalledTimes(writesBeforeRetry.profile);
    expect(riskUpdate).toHaveBeenCalledTimes(writesBeforeRetry.riskUpdate);
    expect(riskCreate).toHaveBeenCalledTimes(writesBeforeRetry.riskCreate);
    expect(outboxUpsert).toHaveBeenCalledTimes(writesBeforeRetry.outboxUpsert);
    expect(outboxUpdate).toHaveBeenCalledTimes(writesBeforeRetry.outboxUpdate);
    expect(classAdd).toHaveBeenCalledTimes(writesBeforeRetry.classAdd);
  });

  it('skips a Growth retry when its specified snapshot is no longer current', async () => {
    const specifiedSnapshot = { id: 'snapshot-old', userId: 'student-1', snapshotAt: new Date('2026-07-15T00:00:00Z'), factCount: 1, competencyVector: {}, evidenceSummary: {} };
    const latestSnapshot = { id: 'snapshot-current', userId: 'student-1', snapshotAt: new Date('2026-07-15T00:01:00Z'), factCount: 1, competencyVector: {}, evidenceSummary: {} };
    const snapshotFindFirst = vi.fn()
      .mockResolvedValueOnce(specifiedSnapshot)
      .mockResolvedValueOnce(latestSnapshot);
    const db: any = {
      studentCompetencySnapshot: { findFirst: snapshotFindFirst },
    };
    configureDataGovernanceWorkerForTest({ db });

    const result = await processStudentSnapshotJob({ data: { userId: 'student-1', growthRecomputeForSnapshot: 'snapshot-old' } } as any);

    expect(result).toEqual({ skipped: true, reason: 'stale_growth_recompute_snapshot', userId: 'student-1', featureCacheRefreshed: false });
    expect(snapshotFindFirst).toHaveBeenNthCalledWith(1, { where: { id: 'snapshot-old', userId: 'student-1' } });
    expect(snapshotFindFirst).toHaveBeenNthCalledWith(2, { where: { userId: 'student-1' }, orderBy: { snapshotAt: 'desc' } });
    expect(mocks.prepareGrowth).not.toHaveBeenCalled();
    expect(mocks.portrait).not.toHaveBeenCalled();
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
