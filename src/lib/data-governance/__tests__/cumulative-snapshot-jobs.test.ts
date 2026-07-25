import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  buildCumulativeClassSnapshotJob,
  claimCumulativeLearnerReconciliations,
  completeCumulativeLearnerReconciliation,
  enqueueCumulativeClassReconciliation,
  requestCumulativeLearnerReconciliation,
} from '../cumulative-snapshot-jobs';
import { buildSimulationTaskInputIdentity } from '../simulation-task-portrait-projection';

const fence = {
  calculationVersion: 'portrait-v2.cumulative.v2',
  learnerGeneration: BigInt(3),
  classGeneration: BigInt(5),
  queueGeneration: BigInt(7),
  fence: BigInt(11),
  activeMigrationRunId: 'migration-989',
};

describe('cumulative class snapshot jobs', () => {
  it('deduplicates old and new classes and attaches the complete active fence', async () => {
    const add = vi.fn(async (
      _name: string,
      _data: unknown,
      _options: { jobId: string },
    ) => undefined);
    const db = {
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => fence),
      },
    };

    const result = await enqueueCumulativeClassReconciliation({
      classIds: ['class-old', 'class-new', 'class-old'],
      mutationIdentity: 'profile-mutation-1',
      db,
      queue: { add },
    });

    expect(result).toEqual({ scheduled: 2, skipped: false });
    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls.map((call) => call[1])).toEqual([
      buildCumulativeClassSnapshotJob('class-old', fence),
      buildCumulativeClassSnapshotJob('class-new', fence),
    ]);
    expect(add.mock.calls.map((call) => call[2].jobId)).toEqual([
      expect.stringMatching(/^class-reconcile-[0-9a-f]{64}$/),
      expect.stringMatching(/^class-reconcile-[0-9a-f]{64}$/),
    ]);
    expect(add.mock.calls[0][2].jobId).not.toBe(add.mock.calls[1][2].jobId);
  });

  it('does not enqueue or fail when no active fence exists', async () => {
    const add = vi.fn(async (
      _name: string,
      _data: unknown,
      _options: { jobId: string },
    ) => undefined);
    const db = {
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => ({
          ...fence,
          activeMigrationRunId: null,
        })),
      },
    };

    await expect(enqueueCumulativeClassReconciliation({
      classIds: ['class-1'],
      mutationIdentity: 'profile-mutation-2',
      db,
      queue: { add },
    })).resolves.toEqual({
      scheduled: 0,
      skipped: true,
      reason: 'no-active-fence',
    });
    expect(add).not.toHaveBeenCalled();
  });
});

describe('cumulative learner reconciliation requests', () => {
  it('declares the pgcrypto migration required by the atomic digest SQL', () => {
    const migration = readFileSync(
      'prisma/migrations/20260723221000_enable_pgcrypto_for_cumulative_reconciliation/migration.sql',
      'utf8',
    );

    expect(migration.trim()).toBe('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  });

  it('atomically merges concurrent class requests and advances generation on the transaction client', async () => {
    let generation = 0;
    const queries: any[] = [];
    const queryRaw = vi.fn(async (query: any) => {
      queries.push(query);
      generation += 1;
      return [{ generation }];
    });
    const db: any = {
      $queryRaw: queryRaw,
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => fence),
      },
      learningMaterializationRebuildRequest: {
        findUnique: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    const generations = await Promise.all([
      requestCumulativeLearnerReconciliation(db, {
        userId: 'student-concurrent',
        classIds: ['class-b'],
        reason: 'member-change-b',
        now: new Date('2026-07-23T01:00:00Z'),
      }),
      requestCumulativeLearnerReconciliation(db, {
        userId: 'student-concurrent',
        classIds: ['class-a'],
        reason: 'member-change-a',
        now: new Date('2026-07-23T01:00:01Z'),
      }),
    ]);

    expect(generations).toEqual([1, 2]);
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(db.learningMaterializationRebuildRequest.findUnique).not.toHaveBeenCalled();
    const sql = queries.map((query) => query.strings.join('?')).join('\n');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('request_generation AS');
    expect(sql).toContain('INSERT INTO "LearningMaterializationGeneration"');
    expect(sql).toContain(
      'GREATEST(',
    );
    expect(sql).toContain('"LearningMaterializationGeneration"."generation"');
    expect(sql).toContain('(SELECT "generation" FROM request_generation)');
    expect(sql).toContain('ON CONFLICT ("userId") DO UPDATE');
    expect(sql).toContain('jsonb_array_elements_text');
    expect(sql).toContain('SELECT DISTINCT value');
    expect(sql).toContain("digest(");
    expect(sql).toContain("'sha256'");
    expect(sql).not.toContain('sha256(string_agg');
    expect(sql).toContain('"generation" = EXCLUDED."generation"');
    expect(sql).not.toContain(
      '"generation" = "LearningMaterializationRebuildRequest"."generation" + 1',
    );
    const parameters = queries.flatMap((query) => query.values);
    expect(parameters).toEqual(expect.arrayContaining([
      '["class-a"]',
      '["class-b"]',
      'member-change-a',
      'member-change-b',
      fence.activeMigrationRunId,
      fence.calculationVersion,
      'learning-materialization:student-concurrent',
    ]));
  });

  it.each([
    { requestGeneration: 10, counterGeneration: null, expected: 11 },
    { requestGeneration: 10, counterGeneration: 5, expected: 11 },
    { requestGeneration: 5, counterGeneration: 10, expected: 11 },
  ])(
    'upgrades seeded request $requestGeneration and counter $counterGeneration to $expected',
    async ({ requestGeneration, counterGeneration, expected }) => {
      let request: any = {
        userId: 'student-upgrade',
        classIds: ['class-old'],
        generation: requestGeneration,
      };
      let counter = counterGeneration;
      const db: any = {
        cumulativePortraitCutoverFence: {
          findUnique: vi.fn(async () => fence),
        },
        learningMaterializationGeneration: {
          upsert: vi.fn(async ({ create }: any) => {
            counter = counter === null ? create.generation : counter + 1;
            return { generation: counter };
          }),
        },
        learningMaterializationRebuildRequest: {
          findUnique: vi.fn(async () => request),
          create: vi.fn(),
          updateMany: vi.fn(async ({ data }: any) => {
            request = { ...request, ...data };
            return { count: 1 };
          }),
        },
      };

      await expect(requestCumulativeLearnerReconciliation(db, {
        userId: request.userId,
        classIds: ['class-new'],
        reason: 'upgrade-seeded-request',
      })).resolves.toBe(expected);
      expect(request).toEqual(expect.objectContaining({
        generation: expected,
        classIds: ['class-new', 'class-old'],
      }));
    },
  );

  it('advances the request when only the task catalog digest changes', async () => {
    let request: any = null;
    let counter = 0;
    const db: any = {
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => fence),
      },
      learningMaterializationGeneration: {
        upsert: vi.fn(async () => ({ generation: ++counter })),
      },
      learningMaterializationRebuildRequest: {
        findUnique: vi.fn(async () => request),
        create: vi.fn(async ({ data }) => {
          request = data;
          return data;
        }),
        updateMany: vi.fn(async ({ where, data }) => {
          if (!request || request.generation !== where.generation) return { count: 0 };
          request = { ...request, ...data };
          return { count: 1 };
        }),
      },
    };
    const firstInput = buildSimulationTaskInputIdentity({
      factWatermark: BigInt(9),
      catalogDigest: 'a'.repeat(64),
      historicalCandidatePlanDigest: 'plan-1029',
    });
    const secondInput = buildSimulationTaskInputIdentity({
      factWatermark: BigInt(9),
      catalogDigest: 'b'.repeat(64),
      historicalCandidatePlanDigest: 'plan-1029',
    });

    await requestCumulativeLearnerReconciliation(db, {
      userId: 'student-catalog-drift',
      reason: 'simulation-task-catalog-refresh',
      simulationTaskInput: firstInput,
    });
    const firstRequestDigest = request.inputDigest;
    await expect(requestCumulativeLearnerReconciliation(db, {
      userId: 'student-catalog-drift',
      reason: 'simulation-task-catalog-refresh',
      simulationTaskInput: secondInput,
    })).resolves.toBe(2);

    expect(request.generation).toBe(2);
    expect(request.inputDigest).not.toBe(firstRequestDigest);
    expect(request.simulationTaskInput).toEqual(secondInput);
  });

  it('casts JSON and simulation identity parameters in the PostgreSQL upsert contract', async () => {
    const queries: any[] = [];
    const db: any = {
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => fence),
      },
      $queryRaw: vi.fn(async (query) => {
        queries.push(query);
        return [{ generation: 1 }];
      }),
    };
    const simulationTaskInput = buildSimulationTaskInputIdentity({
      factWatermark: BigInt(9),
      catalogDigest: 'a'.repeat(64),
      historicalCandidatePlanDigest: 'plan-1029',
    });

    await requestCumulativeLearnerReconciliation(db, {
      userId: 'student-sql-contract',
      reason: 'simulation-task-catalog-refresh',
      simulationTaskInput,
    });
    await requestCumulativeLearnerReconciliation(db, {
      userId: 'student-sql-contract',
      reason: 'manual-refresh-without-task-input',
    });

    expect(queries[0].sql).toContain('?::jsonb');
    expect(queries[0].sql.match(/\?::text/gu)).toHaveLength(24);
    expect(queries[1].sql).toContain('NULL::jsonb');
  });

  it('creates, claims, and CAS-completes a request bound to the active fence', async () => {
    let request: any = null;
    const db: any = {
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => fence),
      },
      learningMaterializationRebuildRequest: {
        findUnique: vi.fn(async () => request),
        findMany: vi.fn(async () => request ? [request] : []),
        create: vi.fn(async ({ data }) => {
          request = data;
          return data;
        }),
        updateMany: vi.fn(async ({ where, data }) => {
          if (
            !request ||
            request.userId !== where.userId ||
            request.generation !== where.generation ||
            (where.status && request.status !== where.status) ||
            (where.claimToken && request.claimToken !== where.claimToken)
          ) return { count: 0 };
          request = {
            ...request,
            ...data,
            attemptCount: typeof data.attemptCount === 'object'
              ? request.attemptCount + data.attemptCount.increment
              : data.attemptCount ?? request.attemptCount,
          };
          return { count: 1 };
        }),
      },
    };

    const simulationTaskInput = buildSimulationTaskInputIdentity({
      factWatermark: BigInt(9),
      catalogDigest: 'a'.repeat(64),
      historicalCandidatePlanDigest: 'plan-1029',
    });
    await expect(requestCumulativeLearnerReconciliation(db, {
      userId: 'student-1',
      classIds: ['class-1'],
      reason: 'document-rubric-grading-approved',
      now: new Date('2026-07-23T01:00:00Z'),
      simulationTaskInput,
    })).resolves.toBe(1);
    expect(request).toMatchObject({
      userId: 'student-1',
      classIds: ['class-1'],
      kind: 'CUMULATIVE_RECONCILIATION',
      migrationRunId: fence.activeMigrationRunId,
      calculationVersion: fence.calculationVersion,
      learnerGeneration: fence.learnerGeneration,
      queueGeneration: fence.queueGeneration,
      cutoverFence: fence.fence,
      status: 'PENDING',
      generation: 1,
      simulationTaskInput,
    });

    const [claim] = await claimCumulativeLearnerReconciliations(db, fence);
    expect(claim).toMatchObject({
      userId: 'student-1',
      classIds: ['class-1'],
      generation: 1,
      fence,
      simulationTaskInput,
    });
    await expect(completeCumulativeLearnerReconciliation(
      db,
      claim,
      new Date('2026-07-23T01:02:00Z'),
    )).resolves.toBe(true);
    expect(request).toMatchObject({
      status: 'COMPLETED',
      generation: 1,
      claimToken: null,
    });
  });
});
