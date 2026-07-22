import { describe, expect, it, vi } from 'vitest';

import {
  buildCumulativeClassJobId,
  buildCumulativeStudentJobId,
  parseCumulativeBackfillArgs,
  runCumulativeBackfill,
  waitForRequestedClasses,
} from '../../../../scripts/db/backfill-cumulative-attainment';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_DIMENSION_IDS,
  createPortraitV2Payload,
} from '../portrait-v2-model';

function backfillDb(input: { withFact?: boolean } = {}) {
  const requests = new Map<string, any>();
  const generations = new Map<string, number>();
  const db: any = {
    learningFact: {
      findMany: vi.fn(async () => input.withFact === false ? [] : [{ userId: 'student-with-history' }]),
    },
    user: {
      findMany: vi.fn(async ({ where }: any) => where.id.in.includes('student-with-history')
        ? [{ id: 'student-with-history', profile: { classId: 'class-current' } }]
        : []),
      count: vi.fn(async () => 2),
    },
    learningMaterializationGeneration: {
      upsert: vi.fn(async ({ where }: any) => {
        const generation = (generations.get(where.userId) ?? 0) + 1;
        generations.set(where.userId, generation);
        return { userId: where.userId, generation };
      }),
      findUnique: vi.fn(async ({ where }: any) => generations.has(where.userId)
        ? { generation: generations.get(where.userId) }
        : null),
    },
    learningMaterializationRebuildRequest: {
      findUnique: vi.fn(async ({ where }: any) => requests.get(where.userId) ?? null),
      create: vi.fn(async ({ data }: any) => { requests.set(data.userId, { ...data }); return data; }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const current = requests.get(where.userId);
        if (!current || current.generation !== where.generation) return { count: 0 };
        requests.set(where.userId, { ...current, ...data });
        return { count: 1 };
      }),
    },
    studentPortraitV2Snapshot: { findMany: vi.fn(async () => []) },
    studentCompetencySnapshot: { findFirst: vi.fn(async () => null) },
    studentProfile: { findMany: vi.fn(async ({ where }: any) => where.userId.in.length > 0 ? [{ classId: 'class-current' }] : []) },
    classCompetencySnapshot: { findFirst: vi.fn(async () => null) },
  };
  return { db, requests, generations };
}

describe('cumulative attainment backfill command', () => {
  it('defaults to dry run and validates apply run ids and deterministic limits', () => {
    expect(parseCumulativeBackfillArgs([])).toEqual({ apply: false, runId: null, wait: false, limit: null });
    expect(parseCumulativeBackfillArgs(['--apply', '--run-id=semester-end-2026', '--limit=5', '--wait']))
      .toEqual({ apply: true, runId: 'semester-end-2026', wait: true, limit: 5 });
    expect(() => parseCumulativeBackfillArgs(['--apply'])).toThrow('apply-requires-stable-run-id');
    expect(() => parseCumulativeBackfillArgs(['--apply', '--run-id=semester-end-2026']))
      .toThrow('apply-requires-wait');
    expect(() => parseCumulativeBackfillArgs(['--limit=0'])).toThrow('limit-must-be-a-positive-integer');
  });

  it('inventories students with historical facts without requesting or queueing writes', async () => {
    const { db, requests } = backfillDb();
    const studentAdd = vi.fn();
    const classAdd = vi.fn();

    const result = await runCumulativeBackfill(
      db,
      { student: { add: studentAdd } as any, class: { add: classAdd } as any },
      { apply: false, runId: null, wait: false, limit: null },
    );

    expect(result).toEqual({
      mode: 'dry-run', candidateCount: 1, selectedCount: 1, currentClassCount: 1, noEvidenceCount: 1,
    });
    expect(requests.size).toBe(0);
    expect(studentAdd).not.toHaveBeenCalled();
    expect(classAdd).not.toHaveBeenCalled();
  });

  it('does not request a portrait for students without any historical fact', async () => {
    const { db, requests } = backfillDb({ withFact: false });
    const studentAdd = vi.fn();
    const result = await runCumulativeBackfill(
      db,
      { student: { add: studentAdd } as any, class: { add: vi.fn() } as any },
      { apply: true, runId: 'semester-end-2026', wait: true, limit: 5 },
    );

    expect(result).toMatchObject({ candidateCount: 0, selectedCount: 0, learnerJobsEnqueued: 0 });
    expect(requests.size).toBe(0);
    expect(studentAdd).not.toHaveBeenCalled();
  });

  it('preserves an existing pending class refresh when requesting the cumulative generation', async () => {
    const { db, requests } = backfillDb();
    requests.set('student-with-history', {
      userId: 'student-with-history', classIds: ['class-recent'], generation: 0, status: 'PENDING',
    });
    const studentAdd = vi.fn(async () => undefined);
    const classAdd = vi.fn();
    await expect(runCumulativeBackfill(
      db,
      {
        student: { add: studentAdd, getJob: vi.fn(async () => ({ getState: async () => 'waiting' })) } as any,
        class: { add: classAdd } as any,
      },
      { apply: true, runId: 'semester-end-2026', wait: true, limit: 5 },
      { waitOptions: { timeoutMs: 0, pollMs: 0, sleep: async () => undefined } },
    )).rejects.toThrow('learner-rebuild-pending');

    expect(requests.get('student-with-history')).toMatchObject({ classIds: ['class-recent'], generation: 1, status: 'PENDING' });
    expect(studentAdd).toHaveBeenCalledWith(
      'cumulative-attainment-full-rebuild',
      { userId: 'student-with-history', fullRebuild: true, rebuildGeneration: 1 },
      expect.objectContaining({ jobId: buildCumulativeStudentJobId('semester-end-2026', 'student-with-history', 1) }),
    );
    expect(classAdd).not.toHaveBeenCalled();
  });

  it('keeps the durable request and does not enqueue classes when wait is incomplete', async () => {
    const { db, requests } = backfillDb();
    const studentAdd = vi.fn(async () => undefined);
    const classAdd = vi.fn();
    await expect(runCumulativeBackfill(
      db,
      {
        student: { add: studentAdd, getJob: vi.fn(async () => ({ getState: async () => 'waiting' })) } as any,
        class: { add: classAdd } as any,
      },
      { apply: true, runId: 'semester-end-2026', wait: true, limit: 5 },
      { waitOptions: { timeoutMs: 0, pollMs: 0, sleep: async () => undefined } },
    )).rejects.toThrow('learner-rebuild-pending');

    expect(requests.has('student-with-history')).toBe(true);
    expect(classAdd).not.toHaveBeenCalled();
  });

  it('enqueues deduplicated current-class cumulative work only after a valid native portrait completes', async () => {
    const { db, requests } = backfillDb();
    const portraitRows: any[] = [];
    db.studentPortraitV2Snapshot.findMany = vi.fn(async () => portraitRows);
    const studentAdd = vi.fn(async (_name: string, data: any) => {
      const generatedAt = new Date().toISOString();
      const payload = createPortraitV2Payload({
        userId: data.userId,
        generatedAt,
        now: generatedAt,
        dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id) => ({
          id,
          score: 72,
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
      portraitRows.push({
        id: 'portrait-complete', userId: data.userId, snapshotAt: new Date(generatedAt),
        payloadVersion: payload.payloadVersion, calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        migrationVersion: payload.migrationVersion, derivationKind: 'native', payload,
      });
      requests.delete(data.userId);
    });
    let classRequestedAfter = '';
    const classAdd = vi.fn(async (_name: string, data: any) => {
      classRequestedAfter = data.requestedAfter;
      db.classCompetencySnapshot.findFirst.mockResolvedValue({
        id: 'class-cumulative-current-run',
        aggregateJson: { _materialization: { runRef: data.runRef } },
      });
    });
    const classGetJob = vi.fn(async () => ({
      getState: async () => 'completed',
      returnvalue: { snapshotId: 'class-cumulative-current-run' },
    }));

    const result = await runCumulativeBackfill(
      db,
      {
        student: { add: studentAdd, getJob: vi.fn() } as any,
        class: { add: classAdd, getJob: classGetJob } as any,
      },
      { apply: true, runId: 'semester-end-2026', wait: true, limit: 5 },
      { waitOptions: { timeoutMs: 0 }, classWaitOptions: { timeoutMs: 0 } },
    );

    expect(result).toMatchObject({ learnerJobsEnqueued: 1, classJobsEnqueued: 1 });
    expect(classAdd).toHaveBeenCalledWith(
      'cumulative-class-snapshot',
      {
        classId: 'class-current',
        scope: 'cumulative',
        requestedAfter: expect.any(String),
        runRef: expect.stringMatching(/^run-/),
      },
      expect.objectContaining({ jobId: buildCumulativeClassJobId('semester-end-2026', 'class-current', [1]) }),
    );
    expect(db.classCompetencySnapshot.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'class-cumulative-current-run',
        classId: 'class-current',
        materializationVersion: 'class-competency.cumulative.v1',
        snapshotAt: { gte: new Date(classRequestedAfter) },
      },
      orderBy: { snapshotAt: 'desc' },
      select: { id: true, aggregateJson: true },
    });
  });

  it('uses durable no-evidence and class markers after completed jobs are trimmed', async () => {
    const { db, requests } = backfillDb();
    const studentAdd = vi.fn(async () => {
      requests.delete('student-with-history');
      db.studentCompetencySnapshot.findFirst.mockResolvedValue({
        factCount: 0,
        snapshotAt: new Date(),
        evidenceSummary: { _derivation: { state: 'no-evidence-after-revocation' } },
      });
    });
    const studentGetJob = vi.fn(async () => null);
    const classAdd = vi.fn(async (_name: string, data: any) => {
      db.classCompetencySnapshot.findFirst.mockResolvedValue({
        id: 'class-no-evidence-run',
        aggregateJson: { _materialization: { runRef: data.runRef } },
      });
    });
    const classGetJob = vi.fn(async () => null);

    const result = await runCumulativeBackfill(
      db,
      {
        student: { add: studentAdd, getJob: studentGetJob } as any,
        class: { add: classAdd, getJob: classGetJob } as any,
      },
      { apply: true, runId: 'context-only-2026', wait: true, limit: null },
      { waitOptions: { timeoutMs: 0 }, classWaitOptions: { timeoutMs: 0 } },
    );

    expect(result).toMatchObject({ candidateCount: 1, learnerJobsEnqueued: 1, classJobsEnqueued: 1 });
    expect(classAdd).toHaveBeenCalledWith(
      'cumulative-class-snapshot',
      expect.objectContaining({ classId: 'class-current', scope: 'cumulative', runRef: expect.stringMatching(/^run-/) }),
      expect.any(Object),
    );
    expect(db.studentPortraitV2Snapshot.findMany).toHaveBeenCalled();
  });

  it('does not accept an older cumulative snapshot as completion for the current class job', async () => {
    const db: any = {
      classCompetencySnapshot: { findFirst: vi.fn(async () => null) },
    };
    const requestedAt = new Date('2026-07-22T00:00:00.000Z');

    await expect(waitForRequestedClasses(
      db,
      {
        getJob: vi.fn(async () => ({
          getState: async () => 'completed',
          returnvalue: { snapshotId: 'old-cumulative-snapshot' },
        })),
      } as any,
      [{ classId: 'class-current', jobId: 'class-job-current-run', requestedAt, runRef: 'run-current' }],
      { timeoutMs: 0 },
    )).rejects.toThrow('class-rebuild-failed');

    expect(db.classCompetencySnapshot.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'old-cumulative-snapshot',
        classId: 'class-current',
        materializationVersion: 'class-competency.cumulative.v1',
        snapshotAt: { gte: requestedAt },
      },
      orderBy: { snapshotAt: 'desc' },
      select: { id: true, aggregateJson: true },
    });
  });

  it('finds the current run marker when a later run snapshot exists and its class job was trimmed', async () => {
    const requestedAt = new Date('2026-07-22T00:00:00.000Z');
    const snapshots = [
      {
        id: 'snapshot-run-a',
        classId: 'class-current',
        materializationVersion: 'class-competency.cumulative.v1',
        snapshotAt: new Date('2026-07-22T00:01:00.000Z'),
        aggregateJson: { _materialization: { runRef: 'run-a' } },
      },
      {
        id: 'snapshot-run-b',
        classId: 'class-current',
        materializationVersion: 'class-competency.cumulative.v1',
        snapshotAt: new Date('2026-07-22T00:02:00.000Z'),
        aggregateJson: { _materialization: { runRef: 'run-b' } },
      },
    ];
    const findFirst = vi.fn(async ({ where }: any) => snapshots
      .filter((snapshot) => snapshot.classId === where.classId
        && snapshot.materializationVersion === where.materializationVersion
        && snapshot.snapshotAt >= where.snapshotAt.gte
        && (!where.id || snapshot.id === where.id)
        && (!where.aggregateJson
          || snapshot.aggregateJson._materialization.runRef === where.aggregateJson.equals))
      .sort((left, right) => right.snapshotAt.getTime() - left.snapshotAt.getTime())[0] ?? null);

    await expect(waitForRequestedClasses(
      { classCompetencySnapshot: { findFirst } } as any,
      { getJob: vi.fn(async () => null) } as any,
      [{ classId: 'class-current', jobId: 'class-job-run-a', requestedAt, runRef: 'run-a' }],
      { timeoutMs: 0 },
    )).resolves.toBeUndefined();

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        classId: 'class-current',
        materializationVersion: 'class-competency.cumulative.v1',
        snapshotAt: { gte: requestedAt },
        aggregateJson: { path: ['_materialization', 'runRef'], equals: 'run-a' },
      },
      orderBy: { snapshotAt: 'desc' },
      select: { id: true, aggregateJson: true },
    });
  });

  it('uses stable opaque run, entity, and generation job identities', () => {
    expect(buildCumulativeStudentJobId('semester-end-2026', 'student-1', 4))
      .toBe(buildCumulativeStudentJobId('semester-end-2026', 'student-1', 4));
    expect(buildCumulativeStudentJobId('semester-end-2026', 'student-1', 4)).not.toContain('student-1');
    expect(buildCumulativeClassJobId('semester-end-2026', 'class-1', [4, 2]))
      .toBe(buildCumulativeClassJobId('semester-end-2026', 'class-1', [2, 4]));
  });
});
