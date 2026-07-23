import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  portrait: vi.fn(async () => ({
    written: true,
    mappingIssues: [],
    evidenceCount: 1,
    affectedDimensions: ['modeling'],
  })),
  classPortrait: vi.fn(async () => ({
    written: true,
    versionId: 'class-version-1',
    inputDigest: 'input-digest',
    memberSetDigest: 'member-digest',
    activeStudentCount: 1,
    totalStudentCount: 1,
  })),
  events: [] as Array<{ id: string; userId: string }>,
  markEventsProcessed: vi.fn(async () => undefined),
}));

vi.mock('../portrait-v2-materialization', () => ({
  materializeIncrementalPortraitV2: mocks.portrait,
}));
vi.mock('../cumulative-class-materialization', () => ({
  materializeCumulativeClassPortrait: mocks.classPortrait,
}));
vi.mock('../event-buffer', () => ({
  fetchSecondaryEvents: vi.fn(async () => mocks.events),
  markEventsProcessed: mocks.markEventsProcessed,
}));
vi.mock('../learning-fact-materialization', () => ({
  eventToLearningFactInput: (event: unknown) => event,
}));
vi.mock('../student-evidence-feature-cache', () => ({
  rebuildStudentEvidenceFeatureCache: vi.fn(),
  refreshStudentEvidenceFeatureCache: vi.fn(),
}));

import {
  configureDataGovernanceWorkerForTest,
  processClassSnapshotJob,
  processEventIngestionJob,
  processStudentSnapshotJob,
} from '../../../../scripts/workers/data-governance-worker';

const publication = {
  calculationVersion: 'portrait-v2.cumulative.v2',
  learnerGeneration: '11',
  classGeneration: '13',
  queueGeneration: '17',
  cutoverFence: '19',
  migrationRunId: 'run-989',
} as const;

function fence() {
  return {
    calculationVersion: publication.calculationVersion,
    learnerGeneration: BigInt(publication.learnerGeneration),
    classGeneration: BigInt(publication.classGeneration),
    queueGeneration: BigInt(publication.queueGeneration),
    fence: BigInt(publication.cutoverFence),
    activeMigrationRunId: publication.migrationRunId,
  };
}

function dbWithFence(overrides: Record<string, unknown> = {}) {
  return {
    cumulativePortraitCutoverFence: {
      findUnique: vi.fn(async () => fence()),
    },
    learningMaterializationRebuildRequest: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    ...overrides,
  } as any;
}

describe('data governance cumulative materialization worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.events = [];
  });

  it('adds the active cutover fence to student jobs created by event ingestion', async () => {
    mocks.events = [
      { id: 'fact-1', userId: 'student-1' },
      { id: 'fact-2', userId: 'student-1' },
      { id: 'fact-3', userId: 'student-2' },
    ];
    const add = vi.fn(async (_name: string, _data: unknown, _options: unknown) => undefined);
    const db = dbWithFence({
      learningEventBatch: { create: vi.fn(async () => undefined) },
      learningFact: { createMany: vi.fn(async () => ({ count: 3 })) },
    });
    configureDataGovernanceWorkerForTest({ db, studentJobQueue: { add } as any });

    await processEventIngestionJob({
      id: 'batch-1',
      data: { batchDate: '2026-07-23' },
    } as any);

    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls.map((call) => call[1])).toEqual([
      {
        userId: 'student-1',
        calculationVersion: publication.calculationVersion,
        learnerGeneration: publication.learnerGeneration,
        queueGeneration: publication.queueGeneration,
        cutoverFence: publication.cutoverFence,
        migrationRunId: publication.migrationRunId,
      },
      {
        userId: 'student-2',
        calculationVersion: publication.calculationVersion,
        learnerGeneration: publication.learnerGeneration,
        queueGeneration: publication.queueGeneration,
        cutoverFence: publication.cutoverFence,
        migrationRunId: publication.migrationRunId,
      },
    ]);
  });

  it('drops a legacy student job before reading or writing portrait state', async () => {
    const db = dbWithFence();
    configureDataGovernanceWorkerForTest({ db });

    const result = await processStudentSnapshotJob({
      data: { userId: 'student-1' },
    } as any);

    expect(result).toEqual({
      skipped: true,
      reason: 'missing_cumulative_publication_fence',
      userId: 'student-1',
    });
    expect(db.cumulativePortraitCutoverFence.findUnique).not.toHaveBeenCalled();
    expect(mocks.portrait).not.toHaveBeenCalled();
  });

  it('drops a stale student job and never publishes it', async () => {
    const db = dbWithFence();
    configureDataGovernanceWorkerForTest({ db });

    const result = await processStudentSnapshotJob({
      data: {
        userId: 'student-1',
        ...publication,
        queueGeneration: '16',
      },
    } as any);

    expect(result).toEqual({
      skipped: true,
      reason: 'stale_cumulative_publication_fence',
      userId: 'student-1',
    });
    expect(mocks.portrait).not.toHaveBeenCalled();
  });

  it('passes the complete publication fence to the learner materializer and class job', async () => {
    const classAdd = vi.fn(async () => undefined);
    const db = dbWithFence({
      studentProfile: {
        findUnique: vi.fn(async () => ({ classId: 'class-1' })),
      },
    });
    configureDataGovernanceWorkerForTest({
      db,
      classJobQueue: { add: classAdd } as any,
    });

    const result = await processStudentSnapshotJob({
      data: {
        userId: 'student-1',
        ...publication,
      },
    } as any);

    expect(result).toMatchObject({
      skipped: false,
      reason: 'cumulative_portrait_materialized',
    });
    expect(mocks.portrait).toHaveBeenCalledWith(
      db,
      'student-1',
      expect.objectContaining({
        publication: {
          calculationVersion: publication.calculationVersion,
          generation: BigInt(publication.learnerGeneration),
          queueGeneration: BigInt(publication.queueGeneration),
          cutoverFence: BigInt(publication.cutoverFence),
          migrationRunId: publication.migrationRunId,
        },
      }),
    );
    expect(classAdd).toHaveBeenCalledWith(
      'class-snapshot-class-1',
      {
        classId: 'class-1',
        scope: 'cumulative',
        ...publication,
      },
      expect.objectContaining({
        jobId: expect.stringMatching(/^class-reconcile-[0-9a-f]{64}$/),
      }),
    );
  });

  it('rejects the removed recent class scope without reading the cutover fence', async () => {
    const db = dbWithFence();
    configureDataGovernanceWorkerForTest({ db });

    const result = await processClassSnapshotJob({
      data: {
        classId: 'class-1',
        scope: 'recent',
        ...publication,
      },
    } as any);

    expect(result).toEqual({
      skipped: true,
      reason: 'unsupported_scope',
      classId: 'class-1',
      scope: 'recent',
    });
    expect(db.cumulativePortraitCutoverFence.findUnique).not.toHaveBeenCalled();
    expect(mocks.classPortrait).not.toHaveBeenCalled();
  });

  it('passes the complete publication fence to the cumulative class materializer', async () => {
    const db = dbWithFence();
    configureDataGovernanceWorkerForTest({ db });

    await processClassSnapshotJob({
      data: {
        classId: 'class-1',
        scope: 'cumulative',
        ...publication,
      },
    } as any);

    expect(mocks.classPortrait).toHaveBeenCalledWith(
      db,
      'class-1',
      expect.objectContaining({
        publication: {
          calculationVersion: publication.calculationVersion,
          learnerGeneration: BigInt(publication.learnerGeneration),
          generation: BigInt(publication.classGeneration),
          queueGeneration: BigInt(publication.queueGeneration),
          cutoverFence: BigInt(publication.cutoverFence),
          migrationRunId: publication.migrationRunId,
        },
      }),
    );
  });

  it('coordinators only create fully fenced cumulative jobs', async () => {
    const studentAdd = vi.fn(async (_name: string, _data: unknown) => undefined);
    const classAdd = vi.fn(async () => undefined);
    const db = dbWithFence({
      interactionLog: {
        findMany: vi.fn(async () => [{ userId: 'student-1' }]),
      },
      learningFact: {
        findMany: vi.fn(async () => []),
      },
      studentProfile: {
        findMany: vi.fn(async () => [{ userId: 'student-1' }]),
      },
      class: {
        findMany: vi.fn(async () => [{ id: 'class-1' }]),
      },
    });
    configureDataGovernanceWorkerForTest({
      db,
      studentJobQueue: { add: studentAdd } as any,
      classJobQueue: { add: classAdd } as any,
    });

    await processStudentSnapshotJob({ data: { coordinator: true } } as any);
    await processClassSnapshotJob({ data: { coordinator: true } } as any);

    expect(studentAdd).toHaveBeenCalledWith(
      'student-snapshot-student-1',
      {
        userId: 'student-1',
        calculationVersion: publication.calculationVersion,
        learnerGeneration: publication.learnerGeneration,
        queueGeneration: publication.queueGeneration,
        cutoverFence: publication.cutoverFence,
        migrationRunId: publication.migrationRunId,
      },
      expect.any(Object),
    );
    expect(classAdd).toHaveBeenCalledWith(
      'class-snapshot-class-1',
      {
        classId: 'class-1',
        scope: 'cumulative',
        ...publication,
      },
      expect.any(Object),
    );
  });

  it('claims a durable cumulative request, dispatches its fenced generation, and completes it after class enqueue', async () => {
    let request: any = {
      userId: 'student-1',
      classIds: ['class-1'],
      kind: 'CUMULATIVE_RECONCILIATION',
      migrationRunId: publication.migrationRunId,
      calculationVersion: publication.calculationVersion,
      learnerGeneration: BigInt(publication.learnerGeneration),
      queueGeneration: BigInt(publication.queueGeneration),
      cutoverFence: BigInt(publication.cutoverFence),
      status: 'PENDING',
      generation: 3,
      attemptCount: 0,
      updatedAt: new Date('2026-07-23T00:00:00Z'),
    };
    const requestDelegate = {
      findMany: vi.fn(async () => [request]),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (
          request.userId !== where.userId ||
          request.generation !== where.generation ||
          (where.status && request.status !== where.status) ||
          (where.claimToken && request.claimToken !== where.claimToken)
        ) return { count: 0 };
        request = {
          ...request,
          ...data,
          attemptCount: data.attemptCount?.increment
            ? request.attemptCount + data.attemptCount.increment
            : request.attemptCount,
        };
        return { count: 1 };
      }),
    };
    const studentAdd = vi.fn<(name: string, data: unknown) => Promise<undefined>>(
      async () => undefined,
    );
    const classAdd = vi.fn(async () => undefined);
    const db = dbWithFence({
      learningMaterializationRebuildRequest: requestDelegate,
      interactionLog: { findMany: vi.fn(async () => []) },
      learningFact: { findMany: vi.fn(async () => []) },
      studentProfile: {
        findMany: vi.fn(async () => []),
        findUnique: vi.fn(async () => ({ classId: 'class-1' })),
      },
    });
    configureDataGovernanceWorkerForTest({
      db,
      studentJobQueue: { add: studentAdd } as any,
      classJobQueue: { add: classAdd } as any,
    });

    await processStudentSnapshotJob({ data: { coordinator: true } } as any);
    const learnerJob = studentAdd.mock.calls[0][1] as any;
    expect(learnerJob).toMatchObject({
      userId: 'student-1',
      fullRebuild: true,
      calculationVersion: publication.calculationVersion,
      learnerGeneration: publication.learnerGeneration,
      queueGeneration: publication.queueGeneration,
      cutoverFence: publication.cutoverFence,
      migrationRunId: publication.migrationRunId,
      reconciliationRequestGeneration: 3,
      reconciliationClaimToken: expect.any(String),
      reconciliationClassIds: ['class-1'],
    });

    await processStudentSnapshotJob({ id: 'request-job-3', data: learnerJob } as any);

    expect(classAdd).toHaveBeenCalled();
    expect(request).toMatchObject({
      status: 'COMPLETED',
      generation: 3,
      claimToken: null,
    });
  });
});
