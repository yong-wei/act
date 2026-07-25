import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import * as materialization from '../derived-learning-materialization';
import { buildClassScopedStudentProjections } from '../class-scoped-learning-materialization';

const { revokeDerivedLearningMaterializations } = materialization;

function rebuildRequestDb() {
  const rows = new Map<string, any>();
  const generations = new Map<string, number>();
  const delegate = {
    findUnique: vi.fn(async ({ where }: any) => rows.get(where.userId) ?? null),
    create: vi.fn(async ({ data }: any) => {
      const row = { generation: 1, attemptCount: 0, ...structuredClone(data) };
      rows.set(row.userId, row);
      return structuredClone(row);
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const row = rows.get(where.userId);
      if (!row || (where.generation !== undefined && row.generation !== where.generation)
        || (where.claimToken !== undefined && row.claimToken !== where.claimToken)
        || (where.status !== undefined && row.status !== where.status)
        || (where.claimExpiresAt?.gt && !(new Date(row.claimExpiresAt).getTime() > new Date(where.claimExpiresAt.gt).getTime()))) return { count: 0 };
      Object.assign(row, structuredClone(data));
      return { count: 1 };
    }),
    deleteMany: vi.fn(async ({ where }: any) => {
      const row = rows.get(where.userId);
      if (!row || row.generation !== where.generation || row.claimToken !== where.claimToken) return { count: 0 };
      rows.delete(where.userId);
      return { count: 1 };
    }),
  };
  const generationDelegate = {
    findUnique: vi.fn(async ({ where }: any) => generations.has(where.userId) ? { userId: where.userId, generation: generations.get(where.userId) } : null),
    upsert: vi.fn(async ({ where, create }: any) => {
      const generation = (generations.get(where.userId) ?? 0) + 1;
      generations.set(where.userId, generation);
      return { ...create, generation };
    }),
  };
  const db: any = { rows, generations, learningMaterializationGeneration: generationDelegate, learningMaterializationRebuildRequest: delegate };
  db.$transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback({ ...db, $transaction: undefined }));
  return db;
}

describe('derived learning materialization revocation', () => {
  it('derives each class only from that class facts and suppresses unscoped diagnostics', () => {
    const fact = (id: string, userId: string, score: number) => ({ id, userId, factType: 'document_rubric_grading', startedAt: new Date(), competencyContribution: { controlModeling: score / 100 }, contextJson: { rubricWeight: 1 }, score, outcome: score >= 60 ? 'success' : 'failure' });
    const classA = buildClassScopedStudentProjections(['student-1', 'student-2'], [fact('a-low', 'student-1', 20)] as any);
    const classB = buildClassScopedStudentProjections(['student-1', 'student-2'], [fact('b-high', 'student-1', 90), fact('b-other', 'student-2', 80)] as any);
    expect(classA.get('student-1')?.competencyVector.controlModeling.score).toBe(20);
    expect(classB.get('student-1')?.competencyVector.controlModeling.score).toBe(90);
    expect(classA.has('student-2')).toBe(false);
    expect(classA.get('student-1')).toMatchObject({ riskFlags: [], growthRecords: [], recommendations: [] });
  });
  it('preserves immutable history and invalidates only safely rebuildable current projections', async () => {
    const delegates: any = Object.fromEntries([
      'studentEvidenceFeatureCache', 'studentCompetencySnapshot', 'studentProfileSummary',
      'studentRiskFlag', 'growthRecord', 'learningRecommendation', 'classCompetencySnapshot', 'studentPortraitV2Snapshot', 'diagnosisReportSnapshot',
    ].map((name) => [name, { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) }]));
    Object.assign(delegates, { learningMaterializationRebuildRequest: { upsert: vi.fn().mockResolvedValue({}) } });
    await revokeDerivedLearningMaterializations(delegates, { userIds: ['student-1'], classIds: ['class-1'] });
    for (const name of ['studentEvidenceFeatureCache', 'studentProfileSummary']) {
      expect(delegates[name].deleteMany).toHaveBeenCalledWith({ where: { userId: { in: ['student-1'] } } });
    }
    for (const name of ['studentCompetencySnapshot', 'studentRiskFlag', 'studentPortraitV2Snapshot', 'classCompetencySnapshot']) {
      expect(delegates[name].deleteMany).not.toHaveBeenCalled();
    }
    expect(delegates.growthRecord.deleteMany).toHaveBeenCalledWith({ where: {
      userId: { in: ['student-1'] }, recordType: 'competency_evaluation', courseId: 'profile:growth-evaluation',
    } });
    expect(delegates.learningRecommendation.deleteMany).not.toHaveBeenCalled();
    expect(delegates.diagnosisReportSnapshot.deleteMany).toHaveBeenNthCalledWith(1, { where: { userId: { in: ['student-1'] }, subjectKind: { not: 'class' } } });
    expect(delegates.diagnosisReportSnapshot.deleteMany).toHaveBeenNthCalledWith(2, { where: { subjectKind: 'class', classId: { in: ['class-1'] } } });
    expect(delegates.learningMaterializationRebuildRequest.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'student-1' }, create: expect.objectContaining({ status: 'PENDING' }) }));
  });

  it('routes revocation through the cumulative request contract while its fence is active', async () => {
    const db = rebuildRequestDb();
    db.cumulativePortraitCutoverFence = {
      findUnique: vi.fn(async () => ({
        calculationVersion: 'portrait-v2.cumulative.v2',
        learnerGeneration: BigInt(3),
        classGeneration: BigInt(5),
        queueGeneration: BigInt(7),
        fence: BigInt(11),
        activeMigrationRunId: 'migration-989',
      })),
    };

    await revokeDerivedLearningMaterializations(db, {
      userIds: ['student-1'],
      classIds: ['class-1'],
    });

    expect(db.rows.get('student-1')).toEqual(expect.objectContaining({
      classIds: ['class-1'],
      reason: 'governed-fact-revoked',
      kind: 'CUMULATIVE_RECONCILIATION',
      migrationRunId: 'migration-989',
      calculationVersion: 'portrait-v2.cumulative.v2',
      learnerGeneration: BigInt(3),
      queueGeneration: BigInt(7),
      cutoverFence: BigInt(11),
      generation: 1,
      inputDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
  });

  it('keeps legacy SQL on the shared monotonic generation source and clears cumulative proof fields', async () => {
    const queries: any[] = [];
    const db: any = {
      $queryRaw: vi.fn(async (query: any) => {
        queries.push(query);
        return [{ generation: 8 }];
      }),
    };

    await expect((materialization as any).requestLearningMaterializationRebuild(db, {
      userId: 'student-legacy',
      classIds: ['class-legacy'],
      reason: 'legacy-rebuild',
    })).resolves.toBe(8);

    const sql = queries[0].strings.join('?');
    expect(queries[0].values).toContain('learning-materialization:student-legacy');
    expect(sql).toContain('request_generation AS');
    expect(sql).toContain('INSERT INTO "LearningMaterializationGeneration"');
    expect(sql).toContain('GREATEST(');
    expect(sql).toContain('"kind" = \'LEGACY\'');
    expect(sql).toContain('"migrationRunId" = NULL');
    expect(sql).toContain('"inputDigest" = NULL');
  });

  it('merges class ids and advances the request generation', async () => {
    const db = rebuildRequestDb();
    const request = (materialization as any).requestLearningMaterializationRebuild;

    await expect(request(db, { userId: 'student-1', classIds: ['class-1'], reason: 'first' })).resolves.toBe(1);
    await expect(request(db, { userId: 'student-1', classIds: ['class-2', 'class-1'], reason: 'second' })).resolves.toBe(2);

    expect(db.rows.get('student-1')).toEqual(expect.objectContaining({
      classIds: ['class-1', 'class-2'],
      generation: 2,
      status: 'PENDING',
      reason: 'second',
    }));
  });

  it('returns the fenced generation without discarding inherited class refresh responsibility', async () => {
    const db = rebuildRequestDb();
    const request = (materialization as any).requestLearningMaterializationRebuild;
    await request(db, { userId: 'student-1', classIds: ['recent-class'], reason: 'recent' });

    await expect(request(db, {
      userId: 'student-1',
      classIds: [],
      reason: 'cumulative',
    })).resolves.toBe(2);

    expect(db.rows.get('student-1')).toEqual(expect.objectContaining({
      classIds: ['recent-class'],
      generation: 2,
      status: 'PENDING',
    }));
  });

  it('does not let an old worker complete a newer concurrent generation', async () => {
    const db = rebuildRequestDb();
    const request = (materialization as any).requestLearningMaterializationRebuild;
    const claim = (materialization as any).claimLearningMaterializationRebuild;
    const complete = (materialization as any).completeLearningMaterializationRebuild;

    await request(db, { userId: 'student-1', classIds: ['class-1'], reason: 'first' });
    const oldClaim = await claim(db, { userId: 'student-1', expectedGeneration: 1, claimToken: 'old-worker', now: new Date('2026-07-15T00:00:00Z') });
    await request(db, { userId: 'student-1', classIds: ['class-2'], reason: 'concurrent' });

    await expect(complete(db, oldClaim)).resolves.toBe(false);
    expect(db.rows.get('student-1')).toEqual(expect.objectContaining({ generation: 2, status: 'PENDING', classIds: ['class-1', 'class-2'] }));
  });

  it('fences an expired same-generation owner before its persistence side effect', async () => {
    const db = rebuildRequestDb();
    await (materialization as any).requestLearningMaterializationRebuild(db, { userId: 'student-1', reason: 'first' });
    const oldClaim = await (materialization as any).claimLearningMaterializationRebuild(db, { userId: 'student-1', expectedGeneration: 1, claimToken: 'old', now: new Date('2026-07-15T00:00:00Z') });
    const newClaim = await (materialization as any).claimLearningMaterializationRebuild(db, { userId: 'student-1', expectedGeneration: 1, claimToken: 'new', now: new Date('2026-07-15T00:11:00Z') });
    const write = vi.fn(async () => undefined);

    await expect((materialization as any).runClaimedLearningMaterializationStage(db, oldClaim, write, new Date('2026-07-15T00:11:01Z'))).rejects.toThrow('learning-materialization-rebuild-fenced');
    expect(newClaim).toEqual(expect.objectContaining({ claimToken: 'new', generation: 1 }));
    expect(write).not.toHaveBeenCalled();
  });

  it('releases a claimed generation for retry when class enqueue fails', async () => {
    const db = rebuildRequestDb();
    const request = (materialization as any).requestLearningMaterializationRebuild;
    const claim = (materialization as any).claimLearningMaterializationRebuild;
    const settle = (materialization as any).settleLearningMaterializationRebuild;

    await request(db, { userId: 'student-1', classIds: ['class-1', 'class-2'], reason: 'rebuild' });
    const claimed = await claim(db, { userId: 'student-1', expectedGeneration: 1, claimToken: 'worker-1', now: new Date() });
    const enqueueClass = vi.fn(async (classId: string) => {
      if (classId === 'class-2') throw new Error('queue unavailable');
    });

    await expect(settle(db, claimed, enqueueClass)).rejects.toThrow('queue unavailable');
    expect(db.rows.get('student-1')).toEqual(expect.objectContaining({ status: 'PENDING', generation: 1, lastErrorCode: 'class-enqueue-failed' }));
  });

  it('treats a false completion CAS as a fenced worker', async () => {
    const db = rebuildRequestDb();
    await (materialization as any).requestLearningMaterializationRebuild(db, { userId: 'student-1', reason: 'rebuild' });
    const claimed = await (materialization as any).claimLearningMaterializationRebuild(db, { userId: 'student-1', expectedGeneration: 1, claimToken: 'worker-1', now: new Date('2026-07-15T00:00:00Z') });
    db.learningMaterializationRebuildRequest.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect((materialization as any).settleLearningMaterializationRebuild(db, claimed, vi.fn(), new Date('2026-07-15T00:01:00Z'))).rejects.toThrow('learning-materialization-rebuild-fenced');
    expect(db.rows.get('student-1')).toEqual(expect.objectContaining({ status: 'CLAIMED', claimToken: 'worker-1' }));
  });

  it('rejects settle after the claim lease expires even when an old snapshot time is supplied', async () => {
    vi.useFakeTimers();
    const db = rebuildRequestDb();
    await (materialization as any).requestLearningMaterializationRebuild(db, { userId: 'student-1', reason: 'rebuild' });
    const t0 = new Date('2026-07-15T00:00:00Z');
    const claimed = await (materialization as any).claimLearningMaterializationRebuild(db, { userId: 'student-1', expectedGeneration: 1, claimToken: 'worker', now: t0 });
    vi.setSystemTime(new Date('2026-07-15T00:11:00Z'));
    await expect((materialization as any).settleLearningMaterializationRebuild(db, claimed, vi.fn(), t0)).rejects.toThrow('learning-materialization-rebuild-fenced');
    vi.useRealTimers();
  });

  it('fences an ordinary snapshot write when a rebuild generation appears after facts are read', async () => {
    const db = rebuildRequestDb();
    const barrier = await (materialization as any).readLearningMaterializationGeneration(db, 'student-1');
    await (materialization as any).requestLearningMaterializationRebuild(db, { userId: 'student-1', classIds: ['class-1'], reason: 'fact-revoked' });
    const staleWrite = vi.fn(async () => undefined);

    await expect((materialization as any).runLearningMaterializationBarrierStage(db, { userId: 'student-1', observedGeneration: barrier }, staleWrite)).rejects.toThrow('learning-materialization-generation-advanced');
    expect(staleWrite).not.toHaveBeenCalled();
  });

  it('fences an unchanged-facts cache refresh when a rebuild generation advances', async () => {
    const db = rebuildRequestDb();
    const observedGeneration = await (materialization as any).readLearningMaterializationGeneration(db, 'student-1');
    await (materialization as any).requestLearningMaterializationRebuild(db, { userId: 'student-1', reason: 'fact-revoked' });
    const refreshUnchangedCache = vi.fn(async () => undefined);

    await expect((materialization as any).runLearningMaterializationBarrierStage(
      db,
      { userId: 'student-1', observedGeneration },
      refreshUnchangedCache,
    )).rejects.toThrow('learning-materialization-generation-advanced');
    expect(refreshUnchangedCache).not.toHaveBeenCalled();
  });

  it('commits portrait and compatibility projections in the same ordinary barrier transaction', async () => {
    const db = rebuildRequestDb();
    const writes: string[] = [];
    const observedGeneration = await (materialization as any).readLearningMaterializationGeneration(db, 'student-1');

    await (materialization as any).runLearningMaterializationBarrierStage(db, { userId: 'student-1', observedGeneration }, async () => {
      writes.push('portrait-v2', 'compatibility-and-cache');
    });

    expect(writes).toEqual(['portrait-v2', 'compatibility-and-cache']);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('routes learner snapshot jobs through the cumulative portrait materializer and publication fence', () => {
    const worker = readFileSync(new URL('../../../../scripts/workers/data-governance-worker.ts', import.meta.url), 'utf8');
    expect(worker).toContain('const expectation = readStudentPublicationExpectation(job.data);');
    expect(worker).toContain('if (!matchesStudentFence(expectation, fence))');
    expect(worker).toContain('const portraitV2 = await materializeIncrementalPortraitV2(db as any, userId, {');
    expect(worker).toContain('fullRebuild: reconciliationClaim ? true : job.data.fullRebuild');
    expect(worker).not.toContain('const executeStage');
  });

  it('routes class snapshot jobs exclusively through cumulative class materialization', () => {
    const worker = readFileSync(new URL('../../../../scripts/workers/data-governance-worker.ts', import.meta.url), 'utf8');
    expect(worker).toContain("if (requestedScope && requestedScope !== 'cumulative')");
    expect(worker).toContain('if (!matchesClassFence(expectation, fence))');
    expect(worker).toContain('const result = await materializeCumulativeClassPortrait(db as any, classId, {');
    expect(worker).toContain('return toJsonSafeWorkerResult(result);');
    expect(worker).not.toContain('classCompetencySnapshot.create(');
  });

  it('settles cumulative learner reconciliation only after portrait materialization and class enqueue', () => {
    const worker = readFileSync(new URL('../../../../scripts/workers/data-governance-worker.ts', import.meta.url), 'utf8');
    const branch = worker.slice(
      worker.indexOf('const portraitV2 = await materializeIncrementalPortraitV2'),
      worker.indexOf('export async function processClassSnapshotJob'),
    );
    expect(branch).toContain('await enqueueClassSnapshotForStudent(');
    expect(branch).toContain('await completeCumulativeLearnerReconciliation(db as any, reconciliationClaim)');
    expect(branch).toContain("'learner-materialization-or-class-enqueue-failed'");
    expect(branch).not.toContain('preparedGrowthEvaluationMatches');
  });

  it('rolls back all claimed projection writes when the single transaction fails', async () => {
    const db = rebuildRequestDb();
    await (materialization as any).requestLearningMaterializationRebuild(db, { userId: 'student-1', reason: 'rebuild' });
    const claim = await (materialization as any).claimLearningMaterializationRebuild(db, { userId: 'student-1', expectedGeneration: 1, claimToken: 'worker', now: new Date() });
    const projections: string[] = [];
    db.$executeRaw = vi.fn(async () => undefined);
    db.$transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
      const before = [...projections];
      try {
        return await callback({ ...db, $transaction: undefined, projection: { create: async ({ data }: any) => { projections.push(data.name); } } });
      } catch (error) {
        projections.splice(0, projections.length, ...before);
        throw error;
      }
    });
    await expect((materialization as any).runClaimedLearningMaterializationStage(db, claim, async (tx: any) => {
      await tx.projection.create({ data: { name: 'portrait' } });
      await tx.projection.create({ data: { name: 'compatibility' } });
      throw new Error('projection-write-failed');
    })).rejects.toThrow('projection-write-failed');
    expect(projections).toEqual([]);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not expose a class snapshot outbox event before its transaction commits', async () => {
    const committed: any[] = [];
    const staged: any[] = [];
    const tx: any = { learningMaterializationOutbox: { upsert: vi.fn(async ({ create }: any) => { staged.push(create); return create; }) } };
    await (materialization as any).stageClassSnapshotOutbox(tx, { userId: 'student-1', classId: 'class-1', generation: 4, now: new Date('2026-07-15T00:00:00Z') });
    expect(committed).toEqual([]);
    committed.push(...staged);
    expect(committed).toHaveLength(1);
  });

  it('leaves no orphan class task when the materialization transaction rolls back', async () => {
    const rows: any[] = [];
    const db: any = { $transaction: async (callback: any) => {
      const staged: any[] = [];
      try {
        return await callback({ learningMaterializationOutbox: { upsert: async ({ create }: any) => staged.push(create) } });
      } catch (error) { throw error; }
      finally { /* staged rows are never committed on failure */ }
    } };
    await expect(db.$transaction(async (tx: any) => {
      await (materialization as any).stageClassSnapshotOutbox(tx, { userId: 'student-1', classId: 'class-1', generation: 4 });
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    expect(rows).toEqual([]);
  });

  it('retries class snapshot outbox delivery without duplicating the BullMQ job identity', async () => {
    const row: any = { id: 'outbox-1', dedupeKey: 'student-1:4:class-1', userId: 'student-1', classId: 'class-1', generation: 4, status: 'PENDING', attemptCount: 0, availableAt: new Date(0), expiresAt: new Date('2099-01-01') };
    const db: any = { learningMaterializationOutbox: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      findMany: vi.fn(async () => row.status === 'DELIVERED' ? [] : [row]),
      updateMany: vi.fn(async ({ where, data }: any) => { if (where.status && row.status !== where.status) return { count: 0 }; Object.assign(row, data); return { count: 1 }; }),
    } };
    const enqueue = vi.fn().mockRejectedValueOnce(new Error('redis-down')).mockResolvedValueOnce(undefined);
    await (materialization as any).dispatchClassSnapshotOutbox(db, enqueue, new Date('2026-07-15T00:00:00Z'));
    expect(row.status).toBe('PENDING');
    await (materialization as any).dispatchClassSnapshotOutbox(db, enqueue, new Date('2026-07-15T00:01:00Z'));
    expect(row.status).toBe('DELIVERED');
    expect(enqueue.mock.calls[0][1]).toBe(enqueue.mock.calls[1][1]);
  });

  it.each(['PENDING', 'CLAIMED'])('recovers expired %s outbox rows instead of deleting them', async (status) => {
    const now = new Date('2026-07-15T00:00:00Z');
    const row: any = { id: 'expired', dedupeKey: 'transition-1', userId: 'student-1', classId: 'class-1', kind: 'CLASS_SNAPSHOT', status, availableAt: new Date(0), expiresAt: new Date(0), claimExpiresAt: new Date(0) };
    const db: any = { learningMaterializationOutbox: {
      findMany: vi.fn(async () => row.status === 'DELIVERED' ? [] : [row]),
      updateMany: vi.fn(async ({ data }: any) => { Object.assign(row, data); return { count: 1 }; }),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    } };
    const enqueue = vi.fn(async () => undefined);
    await (materialization as any).dispatchClassSnapshotOutbox(db, enqueue, now);
    expect(enqueue).toHaveBeenCalledOnce();
    expect(row.status).toBe('DELIVERED');
    expect(db.learningMaterializationOutbox.deleteMany).toHaveBeenCalledWith({ where: { status: 'DELIVERED', expiresAt: { lte: now } } });
  });

  it('continues aging pagination after a full active page to find the next stale student', async () => {
    const first = Array.from({ length: 500 }, (_, index) => ({ id: `s-${String(index).padStart(3, '0')}`, userId: `active-${index}`, factCount: 1, snapshotAt: new Date(), evidenceSummary: {} }));
    const stale = { id: 's-500', userId: 'stale-500', factCount: 1, snapshotAt: new Date(), evidenceSummary: {} };
    let page = 0;
    const db: any = {
      studentCompetencySnapshot: { findMany: vi.fn(async () => page++ === 0 ? first : page === 2 ? [stale] : []) },
      learningFact: { findMany: vi.fn(async ({ where }: any) => where.userId.in.filter((id: string) => id.startsWith('active-')).map((userId: string) => ({ userId }))) },
    };
    await expect((materialization as any).findAgingStudentSnapshotCandidates(db, new Date(), 1)).resolves.toEqual(['stale-500']);
  });

  it('appends a current empty compatibility snapshot without deleting history', async () => {
    const create = vi.fn(async ({ data }: any) => ({ id: 'snapshot-empty', ...data }));
    const db: any = { studentCompetencySnapshot: { create, deleteMany: vi.fn() } };
    const now = new Date('2026-07-15T03:00:00Z');

    await (materialization as any).appendEmptyStudentCompatibilitySnapshot(db, 'student-1', now);

    expect(db.studentCompetencySnapshot.deleteMany).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'student-1', snapshotAt: now, factCount: 0,
      evidenceSummary: { _derivation: { state: 'no-evidence-after-revocation', reason: 'governed-facts-revoked' } }, riskFlags: [],
      competencyVector: expect.objectContaining({ controlModeling: expect.objectContaining({ score: 0, evidenceCount: 0 }) }),
    }) });
  });

  it('marks no-recent evidence without converting historical ability into a current zero score', async () => {
    const create = vi.fn(async ({ data }: any) => data);
    const historicalVector = { controlModeling: { score: 72, evidenceCount: 3 } };
    await (materialization as any).appendNoRecentEvidenceCompatibilitySnapshot(
      { studentCompetencySnapshot: { create } }, 'student-1', historicalVector, new Date('2026-07-15T03:00:00Z'),
    );
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      factCount: 0,
      competencyVector: historicalVector,
      evidenceSummary: { _derivation: { state: 'no-recent-evidence', reason: 'no-governed-facts-in-30-day-window' } },
    }) });
  });

  it('reuses the current no-recent snapshot instead of appending duplicates on BullMQ redelivery', async () => {
    const current = { id: 'snapshot-empty', userId: 'student-1', factCount: 0, competencyVector: { controlModeling: { score: 72 } }, evidenceSummary: { _derivation: { state: 'no-recent-evidence' } } };
    const create = vi.fn();
    const db: any = { studentCompetencySnapshot: { findFirst: vi.fn(async () => current), create } };
    await expect((materialization as any).appendNoRecentEvidenceCompatibilitySnapshot(db, 'student-1', current.competencyVector, new Date())).resolves.toBe(current);
    expect(create).not.toHaveBeenCalled();
  });

  it('uses the concrete empty snapshot identity so a later evidence-expiry transition emits a new class task', async () => {
    const rows = new Map<string, any>();
    const db: any = { learningMaterializationOutbox: { upsert: vi.fn(async ({ where, create }: any) => {
      if (!rows.has(where.dedupeKey)) rows.set(where.dedupeKey, create);
      return rows.get(where.dedupeKey);
    }) } };
    await (materialization as any).stageClassSnapshotOutbox(db, { userId: 'student-1', classId: 'class-1', generation: 3, snapshotId: 'empty-transition-1' });
    rows.get('student-1:3:class-1:empty-transition-1').status = 'DELIVERED';
    await (materialization as any).stageClassSnapshotOutbox(db, { userId: 'student-1', classId: 'class-1', generation: 3, snapshotId: 'empty-transition-2' });
    expect([...rows.keys()]).toEqual(['student-1:3:class-1:empty-transition-1', 'student-1:3:class-1:empty-transition-2']);
  });

  it('stages a durable Growth recompute item when prepared input is fenced by a newer fact set', async () => {
    const upsert = vi.fn(async ({ create }: any) => create);
    await (materialization as any).stageGrowthRecomputeOutbox(
      { learningMaterializationOutbox: { upsert } },
      { userId: 'student-1', generation: 4, snapshotId: 'snapshot-new' },
    );
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({
      kind: 'GROWTH_RECOMPUTE', userId: 'student-1', classId: null, snapshotId: 'snapshot-new', status: 'PENDING',
    }) }));
  });

  it('excludes an empty rebuilt current snapshot from class aggregation instead of reviving history', () => {
    const currentSnapshots = [
      { userId: 'student-revoked', factCount: 0, competencyVector: { controlModeling: { score: 0 } } },
      { userId: 'student-active', factCount: 2, competencyVector: { controlModeling: { score: 80 } } },
    ];
    expect((materialization as any).selectCurrentClassCompetencySnapshots(currentSnapshots)).toEqual([currentSnapshots[1]]);
  });

  it('treats equal means with a changed active population as a changed class snapshot', () => {
    const sameAggregate = { controlModeling: { mean: 60, stdDev: 0 } };
    expect((materialization as any).isSameClassPopulationSignature(
      { aggregate: sameAggregate, distribution: { average: 1 }, risks: {}, activeStudentCount: 1, totalStudentCount: 2 },
      { aggregate: sameAggregate, distribution: { average: 2 }, risks: {}, activeStudentCount: 2, totalStudentCount: 2 },
    )).toBe(false);
  });

  it('deletes completed operational state but retains the durable generation barrier', async () => {
    const db = rebuildRequestDb();
    await (materialization as any).requestLearningMaterializationRebuild(db, { userId: 'student-1', classIds: ['class-1'], reason: 'rebuild' });
    const claimed = await (materialization as any).claimLearningMaterializationRebuild(db, { userId: 'student-1', expectedGeneration: 1, claimToken: 'worker', now: new Date('2026-07-15T00:00:00Z') });
    await expect((materialization as any).completeLearningMaterializationRebuild(db, claimed, new Date('2026-07-15T00:01:00Z'))).resolves.toBe(true);
    expect(db.rows.has('student-1')).toBe(false);
    expect(db.generations.get('student-1')).toBe(1);
  });

  it('releases a claimed generation when student materialization fails before class enqueue', async () => {
    const db = rebuildRequestDb();
    const request = (materialization as any).requestLearningMaterializationRebuild;
    const claim = (materialization as any).claimLearningMaterializationRebuild;
    const fail = (materialization as any).failLearningMaterializationRebuild;

    await request(db, { userId: 'student-1', classIds: ['class-1'], reason: 'rebuild' });
    const claimed = await claim(db, { userId: 'student-1', expectedGeneration: 1, claimToken: 'worker-1', now: new Date('2026-07-15T00:00:00Z') });
    await fail(db, claimed, 'student-materialization-failed', new Date('2026-07-15T00:01:00Z'));

    expect(db.rows.get('student-1')).toEqual(expect.objectContaining({ status: 'PENDING', generation: 1, lastErrorCode: 'student-materialization-failed' }));
  });

  it('preserves historical projections for an incremental window with only older facts', () => {
    const decide = (materialization as any).resolveCompatibilityNoFactsAction;
    expect(decide({ fullRebuild: false, hasAnyRemainingFact: true })).toBe('preserve');
    expect(decide({ fullRebuild: true, hasAnyRemainingFact: true })).toBe('rebuild-empty-window');
    expect(decide({ fullRebuild: true, hasAnyRemainingFact: false })).toBe('revoke');
  });

  it('finds compensating aging candidates after the service was stopped for 31 days', async () => {
    const now = new Date('2026-07-15T00:00:00Z');
    const snapshots = [
      { id: 'snapshot-1', userId: 'student-stale', factCount: 3, snapshotAt: new Date('2026-06-13T00:00:00Z'), evidenceSummary: {} },
      { id: 'snapshot-2', userId: 'student-empty', factCount: 0, snapshotAt: new Date('2026-07-14T00:00:00Z'), evidenceSummary: { _derivation: { state: 'no-recent-evidence' } } },
    ];
    const db: any = {
      studentCompetencySnapshot: { findMany: vi.fn().mockResolvedValueOnce(snapshots).mockResolvedValueOnce([]) },
      learningFact: { findMany: vi.fn(async () => []) },
    };
    await expect((materialization as any).findAgingStudentSnapshotCandidates(db, now, 500)).resolves.toEqual(['student-stale']);
    expect(db.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: { in: ['student-stale'] }, startedAt: { gte: new Date('2026-06-15T00:00:00Z') } } }));
  });

  it('does not schedule the same aging student again after a no-recent-evidence snapshot is written', async () => {
    const now = new Date('2026-07-15T00:00:00Z');
    let latest = { id: 'snapshot-old', userId: 'student-stale', factCount: 3, snapshotAt: new Date('2026-06-13T00:00:00Z'), evidenceSummary: {} };
    const db: any = {
      studentCompetencySnapshot: { findMany: vi.fn(async () => [latest]) },
      learningFact: { findMany: vi.fn(async () => []) },
    };
    await expect((materialization as any).findAgingStudentSnapshotCandidates(db, now, 500)).resolves.toEqual(['student-stale']);
    latest = { id: 'snapshot-empty', userId: 'student-stale', factCount: 0, snapshotAt: now, evidenceSummary: { _derivation: { state: 'no-recent-evidence' } } };
    await expect((materialization as any).findAgingStudentSnapshotCandidates(db, now, 500)).resolves.toEqual([]);
    expect(db.learningFact.findMany).toHaveBeenCalledTimes(1);
    expect(db.studentCompetencySnapshot.findMany.mock.calls[0][0].where).toEqual({});
  });
});
