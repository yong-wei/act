import { describe, expect, it } from 'vitest';

import {
  getTeacherAiGradingHiddenProjection,
  revealTeacherAiGradingHiddenAcceptance,
  startTeacherAiGradingHiddenAcceptance,
} from '../teacher-ai-grading-lab-evaluation-store';

function createMemoryDb() {
  const splits = [
    {
      id: 'split-a', datasetId: 'dataset', datasetVersion: 'v1', version: 1,
      seed: 'secret-seed', contentHash: 'secret-content', sampleCount: 2, tuningCount: 1, hiddenCount: 1,
    },
    {
      id: 'split-b', datasetId: 'dataset', datasetVersion: 'v1', version: 2,
      seed: 'other-seed', contentHash: 'other-content', sampleCount: 2, tuningCount: 1, hiddenCount: 1,
    },
  ];
  const members = [
    { splitId: 'split-a', sampleId: 'sample-hidden', partition: 'HIDDEN' },
    { splitId: 'split-a', sampleId: 'sample-tuning-a', partition: 'TUNING' },
    { splitId: 'split-b', sampleId: 'sample-hidden', partition: 'HIDDEN' },
    { splitId: 'split-b', sampleId: 'sample-tuning-b', partition: 'TUNING' },
  ];
  const acceptances = [
    acceptance('acceptance-a', 'split-a'),
    acceptance('acceptance-b', 'split-b'),
  ];
  const configs = [
    { id: 'config-a', splitId: 'split-a', modelId: 'secret-model' },
    { id: 'config-b', splitId: 'split-b', modelId: 'secret-model' },
  ];
  const batches: any[] = [];
  const ledger: any[] = [];
  const splitQueries: any[] = [];
  let transactionTail = Promise.resolve();

  const db: any = {
    splits,
    members,
    acceptances,
    configs,
    batches,
    ledger,
    splitQueries,
    $queryRawUnsafe: async () => [],
    $transaction: async (operation: (transaction: any) => Promise<any>) => {
      const previous = transactionTail;
      let release = () => {};
      transactionTail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const snapshot = structuredClone({ acceptances, batches, ledger });
      try {
        return await operation(db);
      } catch (error) {
        replaceRows(acceptances, snapshot.acceptances);
        replaceRows(batches, snapshot.batches);
        replaceRows(ledger, snapshot.ledger);
        throw error;
      } finally {
        release();
      }
    },
    teacherAiGradingLabSplit: {
      findUnique: async ({ where, select }: any) => {
        splitQueries.push(structuredClone(select));
        const split = splits.find((row) => row.id === where.id);
        if (!split) return null;
        const result = selectFields(split, select);
        if (select.hiddenAcceptance) {
          const row = acceptances.find((item) => item.splitId === split.id);
          result.hiddenAcceptance = row ? selectFields(row, select.hiddenAcceptance.select) : null;
        }
        if (select.members) {
          result.members = members
            .filter((row) => row.splitId === split.id && (!select.members.where?.partition || row.partition === select.members.where.partition))
            .sort((left, right) => left.sampleId.localeCompare(right.sampleId))
            .map((row) => selectFields(row, select.members.select));
        }
        return result;
      },
    },
    teacherAiGradingHiddenAcceptance: {
      findUnique: async ({ where, select }: any) => {
        const row = acceptances.find((item) => item.id === where.id);
        return row ? selectFields(row, select) : null;
      },
      updateMany: async ({ where, data }: any) => {
        const row = acceptances.find((item) => (
          item.id === where.id
          && (!where.state || item.state === where.state)
          && (!where.configId || item.configId === where.configId)
          && (!where.batchId || item.batchId === where.batchId)
        ));
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    teacherAiGradingExperimentConfig: {
      findUnique: async ({ where, select }: any) => {
        const row = configs.find((item) => item.id === where.id);
        return row ? selectFields(row, select) : null;
      },
    },
    teacherAiGradingExperimentBatch: {
      create: async ({ data }: any) => {
        batches.push({ ...data });
        return { ...data };
      },
      findUnique: async ({ where, select }: any) => {
        const row = batches.find((item) => item.id === where.id);
        return row ? selectFields(row, select) : null;
      },
    },
    teacherAiGradingHiddenSampleLedger: {
      createMany: async ({ data }: any) => {
        for (const row of data) {
          const duplicate = ledger.some((item) => (
            item.datasetId === row.datasetId
            && item.datasetVersion === row.datasetVersion
            && item.sampleId === row.sampleId
          ));
          if (duplicate) throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        ledger.push(...data.map((row: any) => ({ ...row })));
        return { count: data.length };
      },
    },
  };
  return db;
}

function acceptance(id: string, splitId: string) {
  return {
    id,
    splitId,
    state: 'SEALED',
    configId: null,
    batchId: null,
    startKey: null,
    startRequestHash: null,
    startedAt: null,
    consumedAt: null,
  };
}

function selectFields(row: any, select: Record<string, unknown> | undefined): any {
  if (!select) return { ...row };
  return Object.fromEntries(Object.entries(select)
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => [key, row[key]]));
}

function replaceRows(target: any[], source: any[]): void {
  target.splice(0, target.length, ...source.map((row) => ({ ...row })));
}

function createBatch(id: string, state = 'QUEUED') {
  return async (db: any, context: { splitId: string; configId: string; hiddenSampleIds: string[] }) => db.teacherAiGradingExperimentBatch.create({
    data: {
      id,
      splitId: context.splitId,
      configId: context.configId,
      state,
      sampleSetSnapshot: context.hiddenSampleIds.map((sampleId) => ({ sampleId, questions: [] })),
    },
  });
}

describe('teacher AI grading hidden acceptance store', () => {
  it('uses a query-layer safe projection before reveal', async () => {
    const db = createMemoryDb();
    const projection = await getTeacherAiGradingHiddenProjection(db, 'split-a');

    expect(projection).toEqual({
      splitId: 'split-a',
      datasetId: 'dataset',
      datasetVersion: 'v1',
      splitVersion: 1,
      sampleCount: 2,
      tuningCount: 1,
      hiddenCount: 1,
      acceptanceId: 'acceptance-a',
      state: 'SEALED',
      startedAt: null,
      consumedAt: null,
    });
    expect(db.splitQueries[0]).not.toHaveProperty('members');
    expect(db.splitQueries[0]).not.toHaveProperty('seed');
    expect(JSON.stringify(db.splitQueries[0])).not.toMatch(/baseline|model|batch|execution|repetition/i);
  });

  it('rejects hidden execution and reveal before a frozen configuration exists', async () => {
    const db = createMemoryDb();
    let batchCreations = 0;
    await expect(startTeacherAiGradingHiddenAcceptance({
      db,
      acceptanceId: 'acceptance-a',
      configId: 'missing-config',
      startKey: 'start-a',
      request: {},
      createBatch: async () => {
        batchCreations += 1;
        return { id: 'forbidden' };
      },
    })).rejects.toThrow('grading-lab-hidden-configuration-not-frozen');
    await expect(revealTeacherAiGradingHiddenAcceptance({
      db,
      acceptanceId: 'acceptance-a',
      configId: 'config-a',
      loadRevealed: async () => null,
    })).rejects.toThrow('grading-lab-hidden-configuration-not-frozen');
    expect(batchCreations).toBe(0);
  });

  it('allows only one concurrent start and replays the bound acceptance without a second batch', async () => {
    const db = createMemoryDb();
    let batchCreations = 0;
    const start = (startKey: string, batchId: string) => startTeacherAiGradingHiddenAcceptance({
      db,
      acceptanceId: 'acceptance-a',
      configId: 'config-a',
      startKey,
      request: { partition: 'hidden' },
      createBatch: async (transaction, context) => {
        expect(transaction.acceptances.find((row: any) => row.id === 'acceptance-a')).toMatchObject({
          state: 'RUNNING',
          configId: 'config-a',
          batchId: null,
        });
        batchCreations += 1;
        return createBatch(batchId)(transaction, context);
      },
    });

    const concurrent = await Promise.allSettled([start('start-a', 'batch-a'), start('start-b', 'batch-b')]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(batchCreations).toBe(1);
    expect(db.batches).toHaveLength(1);

    const replay = await start('start-a', 'unused-batch');
    expect(replay).toMatchObject({ batchId: 'batch-a', replay: true });
    expect(batchCreations).toBe(1);
    expect(db.batches).toHaveLength(1);
  });

  it('prevents a sample that ever ran hidden from becoming hidden in another split', async () => {
    const db = createMemoryDb();
    await startTeacherAiGradingHiddenAcceptance({
      db,
      acceptanceId: 'acceptance-a',
      configId: 'config-a',
      startKey: 'start-a',
      request: {},
      createBatch: createBatch('batch-a'),
    });
    await expect(startTeacherAiGradingHiddenAcceptance({
      db,
      acceptanceId: 'acceptance-b',
      configId: 'config-b',
      startKey: 'start-b',
      request: {},
      createBatch: createBatch('batch-b'),
    })).rejects.toThrow('grading-lab-hidden-sample-previously-used');

    expect(db.acceptances.find((row: any) => row.id === 'acceptance-b').state).toBe('SEALED');
    expect(db.batches.map((row: any) => row.id)).toEqual(['batch-a']);
    expect(db.ledger).toHaveLength(1);
  });

  it('rolls back when the created batch omits a hidden member', async () => {
    const db = createMemoryDb();
    db.members.push({ splitId: 'split-a', sampleId: 'sample-hidden-2', partition: 'HIDDEN' });

    await expect(startTeacherAiGradingHiddenAcceptance({
      db,
      acceptanceId: 'acceptance-a',
      configId: 'config-a',
      startKey: 'start-partial',
      request: {},
      createBatch: async (transaction, context) => transaction.teacherAiGradingExperimentBatch.create({
        data: {
          id: 'batch-partial',
          splitId: context.splitId,
          configId: context.configId,
          state: 'QUEUED',
          sampleSetSnapshot: [{ sampleId: context.hiddenSampleIds[0], questions: [] }],
        },
      }),
    })).rejects.toThrow('grading-lab-hidden-batch-sample-set-mismatch');

    expect(db.acceptances.find((row: any) => row.id === 'acceptance-a')).toMatchObject({
      state: 'SEALED',
      configId: null,
      batchId: null,
    });
    expect(db.batches).toHaveLength(0);
    expect(db.ledger).toHaveLength(0);
  });

  it('commits CONSUMED before loading failed or passing revealed results', async () => {
    const db = createMemoryDb();
    await startTeacherAiGradingHiddenAcceptance({
      db,
      acceptanceId: 'acceptance-a',
      configId: 'config-a',
      startKey: 'start-a',
      request: {},
      createBatch: createBatch('batch-a', 'FAILED'),
    });

    await expect(revealTeacherAiGradingHiddenAcceptance({
      db,
      acceptanceId: 'acceptance-a',
      configId: 'config-a',
      loadRevealed: async () => {
        expect(db.acceptances[0].state).toBe('CONSUMED');
        throw new Error('threshold-report-failed');
      },
    })).rejects.toThrow('threshold-report-failed');
    expect(db.acceptances[0].state).toBe('CONSUMED');

    const replay = await revealTeacherAiGradingHiddenAcceptance({
      db,
      acceptanceId: 'acceptance-a',
      configId: 'config-a',
      loadRevealed: async () => ({ passed: false }),
    });
    expect(replay).toEqual({ result: { passed: false }, replay: true });
  });
});
