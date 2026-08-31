import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  abortUnclaimedExecutions,
  claim,
  complete,
  createRunSet,
  fail,
  freezeConfig,
  recover,
  renew,
} from '../teacher-ai-grading-lab-run-store';
import {
  persistClaimedRawOutput,
  type TeacherAiGradingRawOutputMetadata,
  type TeacherAiGradingRawOutputWriter,
} from '../teacher-ai-grading-lab-runner';

function component(id: string, version = 'v1') {
  return { id, version, contentHash: `sha256:${id}-${version}` };
}

function rubric() {
  const content = { id: 'rubric', version: 'v1', criteria: [] as Array<Record<string, unknown>> };
  return { ...content, contentHash: hashJson(content) };
}

function question(questionId: string) {
  const rubricSnapshot = rubric();
  const questionContent = {
    assignmentRevisionId: null,
    origin: { kind: 'evaluation-package', datasetId: 'dataset', datasetVersion: 'v1' },
    questionId,
    stableQuestionId: questionId,
    prompt: `Prompt ${questionId}`,
    referenceAnswer: `Answer ${questionId}`,
    rubric: rubricSnapshot,
  };
  const questionSnapshotHash = hashJson(questionContent);
  return {
    questionId,
    inputHash: `sha256:input-${questionId}`,
    questionSnapshotHash,
    rubricId: rubricSnapshot.id,
    rubricVersion: rubricSnapshot.version,
    evaluatorId: 'configured-openai',
    evaluatorVersion: 'model.v1',
    questionSnapshot: { ...questionContent, contentHash: questionSnapshotHash },
    rubricSnapshot,
    referenceAnswer: `Answer ${questionId}`,
  };
}

function hashJson(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalize(item)]));
}

function createMemoryDb() {
  const configs: any[] = [];
  const batches: any[] = [];
  const executions: any[] = [];
  const gradingRuns: any[] = [];
  const members = [
    { splitId: 'split', sampleId: 'sample-a', partition: 'TUNING' },
    { splitId: 'split', sampleId: 'sample-b', partition: 'TUNING' },
    { splitId: 'split', sampleId: 'sample-hidden', partition: 'HIDDEN' },
  ];
  const hiddenAcceptances = [
    { id: 'acceptance', splitId: 'split', state: 'SEALED', configId: null, batchId: null },
  ];
  const findExecution = (id: string) => executions.find((row) => row.id === id) ?? null;
  const attachBatch = (row: any) => row ? { ...row, batch: batches.find((batch) => batch.id === row.batchId) } : null;
  let transactionTail = Promise.resolve();

  const db: any = {
    configs,
    batches,
    executions,
    gradingRuns,
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      const previous = transactionTail;
      let release!: () => void;
      transactionTail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const snapshot = structuredClone({ configs, batches, executions, gradingRuns });
      try {
        return await callback(db);
      } catch (error) {
        replaceRows(configs, snapshot.configs);
        replaceRows(batches, snapshot.batches);
        replaceRows(executions, snapshot.executions);
        replaceRows(gradingRuns, snapshot.gradingRuns);
        throw error;
      } finally {
        release();
      }
    },
    $queryRawUnsafe: async () => [],
    teacherAiGradingExperimentConfig: {
      findUnique: async ({ where }: any) => configs.find((row) => row.id === where.id || row.idempotencyKey === where.idempotencyKey) ?? null,
      aggregate: async ({ where }: any) => ({ _max: { version: Math.max(0, ...configs.filter((row) => row.datasetId === where.datasetId).map((row) => row.version)) || null } }),
      create: async ({ data }: any) => {
        const row = { ...data };
        configs.push(row);
        return row;
      },
    },
    gradingRun: {
      findUnique: async ({ where }: any) => gradingRuns.find((run) => run.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const row = { assessments: [], annotations: [], answerEvidence: null, ...data };
        gradingRuns.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const row = gradingRuns.find((run) => run.id === where.id);
        if (!row) return { count: 0 };
        if (db.failNextGradingRunUpdate) {
          db.failNextGradingRunUpdate = false;
          return { count: 0 };
        }
        const allowedStates = where.state?.in ?? (where.state ? [where.state] : null);
        if (allowedStates && !allowedStates.includes(row.state)) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    teacherAiGradingLabSplitMember: {
      findMany: async ({ where }: any) => members.filter((row) => (
        row.splitId === where.splitId
        && (!where.sampleId?.in || where.sampleId.in.includes(row.sampleId))
        && (!where.partition || row.partition === where.partition)
      )),
    },
    teacherAiGradingHiddenAcceptance: {
      findUnique: async ({ where }: any) => hiddenAcceptances.find((row) => row.splitId === where.splitId || row.id === where.id) ?? null,
    },
    teacherAiGradingExperimentBatch: {
      findUnique: async ({ where, include }: any) => {
        const batch = batches.find((row) => row.id === where.id || row.idempotencyKey === where.idempotencyKey) ?? null;
        if (!batch || !include) return batch;
        return {
          ...batch,
          config: configs.find((row) => row.id === batch.configId),
          executions: executions
            .filter((row) => row.batchId === batch.id)
            .sort((left, right) => left.sampleId.localeCompare(right.sampleId)
              || left.questionId.localeCompare(right.questionId)
              || left.repetitionOrdinal - right.repetitionOrdinal)
            .map((row) => ({ ...row, gradingRun: gradingRuns.find((run) => run.id === row.gradingRunId) })),
        };
      },
      create: async ({ data }: any) => {
        const row = { completedCount: 0, failedCount: 0, retryableCount: 0, startedAt: null, completedAt: null, ...data };
        batches.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        if (db.failNextBatchRefresh) {
          db.failNextBatchRefresh = false;
          const error = Object.assign(new Error('Transaction failed due to a write conflict or a deadlock.'), { code: 'P2034' });
          throw error;
        }
        const row = batches.find((batch) => batch.id === where.id);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    teacherAiGradingExperimentExecution: {
      createMany: async ({ data }: any) => {
        executions.push(...data.map((row: any) => ({ attemptCount: 0, claimToken: null, leaseExpiresAt: null, startedAt: null, completedAt: null, ...row })));
        return { count: data.length };
      },
      findFirst: async ({ where }: any) => executions.find((row) => {
        const states = where.state?.in ?? (where.state ? [where.state] : []);
        return (
        (!where.batchId || row.batchId === where.batchId)
        && (!states.length || states.includes(row.state))
        && (!where.failureStage || row.failureStage === where.failureStage)
        && row.claimToken === null
        );
      }) ?? null,
      findUnique: async ({ where, include }: any) => include?.batch ? attachBatch(findExecution(where.id)) : findExecution(where.id),
      findMany: async ({ where }: any) => executions.filter((row) => {
        if (where.batchId) return row.batchId === where.batchId;
        if (where.state === 'RUNNING') return row.state === 'RUNNING' && row.leaseExpiresAt <= where.leaseExpiresAt.lte;
        return true;
      }).map((row) => where.state === 'RUNNING' ? attachBatch(row) : row),
      updateMany: async ({ where, data }: any) => {
        const row = findExecution(where.id);
        if (!row) return { count: 0 };
        const allowedStates = where.state?.in ?? (where.state ? [where.state] : null);
        if (allowedStates && !allowedStates.includes(row.state)) return { count: 0 };
        if (where.claimToken !== undefined && row.claimToken !== where.claimToken) return { count: 0 };
        if (where.leaseExpiresAt?.gt && !(row.leaseExpiresAt > where.leaseExpiresAt.gt)) return { count: 0 };
        if (where.leaseExpiresAt?.lte && !(row.leaseExpiresAt <= where.leaseExpiresAt.lte)) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in value) row[key] += (value as any).increment;
          else row[key] = value;
        }
        return { count: 1 };
      },
    },
  };
  return db;
}

function freezeInput(db: any, overrides: Record<string, unknown> = {}) {
  return {
    db,
    idempotencyKey: 'freeze-1',
    dataset: component('dataset'),
    split: component('split'),
    prompt: component('prompt'),
    model: { ...component('configured-openai', 'model.v1'), parameters: { temperature: 0 } },
    rubric: rubric(),
    processor: component('processor'),
    metric: component('metric'),
    seed: 42,
    now: new Date('2026-07-27T00:00:00.000Z'),
    ...overrides,
  };
}

async function createBatch(db: any, idempotencyKey = 'batch-1') {
  const { config } = await freezeConfig(freezeInput(db));
  return createRunSet({
    db,
    configId: config.id,
    splitId: 'split',
    idempotencyKey,
    samples: [{ sampleId: 'sample-a', questions: [question('T1-1')] }],
  });
}

function markDraftPersisted(db: any, execution: any): void {
  const run = db.gradingRuns.find((candidate: any) => candidate.id === execution.gradingRunId);
  if (!run) throw new Error('test-grading-run-not-found');
  run.state = 'AWAITING_REVIEW';
}

describe('teacher AI grading lab run store', () => {
  it('does not expose low-level run mutations from the public data-governance API', () => {
    const publicApi = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    expect(publicApi).not.toContain("export * from './teacher-ai-grading-lab-run-store'");
  });

  it('concurrently replays config freezes and versions changed factors', async () => {
    const db = createMemoryDb();
    const [first, replay] = await Promise.all([freezeConfig(freezeInput(db)), freezeConfig(freezeInput(db))]);
    expect([first.replay, replay.replay].sort()).toEqual([false, true]);
    await expect(freezeConfig(freezeInput(db, { seed: 43 }))).rejects.toThrow('experiment-config-idempotency-conflict');

    const changed = await freezeConfig(freezeInput(db, { idempotencyKey: 'freeze-2', prompt: component('prompt', 'v2') }));
    expect(changed.config.version).toBe(2);
    expect(changed.config.contentHash).not.toBe(first.config.contentHash);
  });

  it('creates two samples by two questions by three repetitions atomically and replays concurrently', async () => {
    const db = createMemoryDb();
    const { config } = await freezeConfig(freezeInput(db));
    const request = () => createRunSet({
      db,
      configId: config.id,
      splitId: 'split',
      idempotencyKey: 'batch-12',
      samples: [
        { sampleId: 'sample-b', questions: [question('T1-2'), question('T1-1')] },
        { sampleId: 'sample-a', questions: [question('T1-1'), question('T1-2')] },
      ],
    });
    const [first, replay] = await Promise.all([request(), request()]);

    expect([first.replay, replay.replay].sort()).toEqual([false, true]);
    expect(first.batch.executions).toHaveLength(12);
    expect(db.gradingRuns).toHaveLength(12);
    expect(db.executions).toHaveLength(12);
    expect(new Set(db.executions.map((row: any) => `${row.sampleId}:${row.questionId}:${row.repetitionOrdinal}`)).size).toBe(12);
    expect(db.gradingRuns.every((run: any) => run.answerAttemptId === null && run.answerEvidenceId === null && run.questionId === null)).toBe(true);
    expect(db.gradingRuns[0].authorizationSnapshot.origin).toEqual({ kind: 'evaluation-package', datasetId: 'dataset', datasetVersion: 'v1' });
  });

  it('creates a distinct auditable batch when a frozen evaluation is retried with a new idempotency key', async () => {
    const db = createMemoryDb();

    const first = await createBatch(db, 'batch-retry-1');
    const retried = await createBatch(db, 'batch-retry-2');

    expect(first.replay).toBe(false);
    expect(retried.replay).toBe(false);
    expect(retried.batch.id).not.toBe(first.batch.id);
    expect(db.batches).toHaveLength(2);
  });

  it('rejects direct hidden execution while its acceptance is sealed', async () => {
    const db = createMemoryDb();
    const { config } = await freezeConfig(freezeInput(db));

    await expect(createRunSet({
      db,
      configId: config.id,
      splitId: 'split',
      idempotencyKey: 'batch-hidden-bypass',
      samples: [{ sampleId: 'sample-hidden', questions: [question('T1-1')] }],
    })).rejects.toThrow('experiment-hidden-acceptance-not-running');
    expect(db.batches).toHaveLength(0);
  });

  it('rejects samples outside the frozen split and frozen grading identity drift', async () => {
    const db = createMemoryDb();
    const { config } = await freezeConfig(freezeInput(db));
    const request = (idempotencyKey: string, sampleId: string, seed: ReturnType<typeof question>) => createRunSet({
      db,
      configId: config.id,
      splitId: 'split',
      idempotencyKey,
      samples: [{ sampleId, questions: [seed] }],
    });

    await expect(request('batch-unknown-sample', 'sample-unknown', question('T1-1')))
      .rejects.toThrow('experiment-sample-split-membership-mismatch');
    await expect(request('batch-evaluator-drift', 'sample-a', { ...question('T1-1'), evaluatorVersion: 'model.v2' }))
      .rejects.toThrow('experiment-evaluator-config-mismatch');
    await expect(request('batch-rubric-drift', 'sample-a', {
      ...question('T1-1'),
      rubricSnapshot: { ...question('T1-1').rubricSnapshot, contentHash: 'sha256:changed-rubric' },
    })).rejects.toThrow('experiment-rubric-config-mismatch');
    await expect(request('batch-question-drift', 'sample-a', {
      ...question('T1-1'),
      questionSnapshotHash: 'sha256:changed-question',
    })).rejects.toThrow('experiment-question-snapshot-hash-mismatch');
    const promptDrift = question('T1-1');
    promptDrift.questionSnapshot = { ...promptDrift.questionSnapshot, prompt: 'Tampered prompt' };
    await expect(request('batch-question-content-drift', 'sample-a', promptDrift))
      .rejects.toThrow('experiment-question-snapshot-hash-mismatch');
    const rubricDrift = question('T1-1');
    rubricDrift.rubricSnapshot = {
      ...rubricDrift.rubricSnapshot,
      criteria: [{ id: 'tampered', points: 10 }],
    };
    rubricDrift.questionSnapshot = { ...rubricDrift.questionSnapshot, rubric: rubricDrift.rubricSnapshot };
    await expect(request('batch-rubric-content-drift', 'sample-a', rubricDrift))
      .rejects.toThrow('experiment-rubric-config-mismatch');
    expect(db.batches).toHaveLength(0);
  });

  it('fences stale owners, prioritizes queued work over a retry, and preserves a successful raw output reference', async () => {
    const db = createMemoryDb();
    await createBatch(db, 'batch-claims');
    const now = new Date('2026-07-27T01:00:00.000Z');
    const first = await claim({ db, batchId: db.batches[0].id, claimToken: 'owner-1', now, leaseMs: 1_000 });
    expect(first?.execution.attemptCount).toBe(1);
    await expect(renew({ db, executionId: first!.execution.id, claimToken: 'owner-1', now, leaseMs: 0 }))
      .rejects.toThrow('experiment-lease-duration-invalid');
    await expect(renew({ db, executionId: first!.execution.id, claimToken: 'stale-owner', now })).rejects.toThrow('experiment-execution-fenced');

    await fail({ db, executionId: first!.execution.id, claimToken: 'owner-1', failureStage: 'provider', errorCode: 'provider-timeout', retryable: true, now });
    const second = await claim({ db, batchId: db.batches[0].id, claimToken: 'owner-2', now, leaseMs: 1_000 });
    expect(second!.execution.id).not.toBe(first!.execution.id);
    expect(second!.execution.attemptCount).toBe(1);
    markDraftPersisted(db, second!.execution);
    await complete({ db, executionId: second!.execution.id, claimToken: 'owner-2', rawOutputObjectKey: 'grading-lab/raw/run-1.json', rawOutputChecksum: 'sha256:raw-output', now });
    expect(second!.execution).toMatchObject({ state: 'SUCCEEDED', rawOutputObjectKey: 'grading-lab/raw/run-1.json' });
    await expect(complete({ db, executionId: second!.execution.id, claimToken: 'owner-2', rawOutputObjectKey: 'other', rawOutputChecksum: 'other', now })).rejects.toThrow('experiment-execution-fenced');
  });

  it('aborts only unclaimed executions after a preflight terminal failure', async () => {
    const db = createMemoryDb();
    await createBatch(db, 'batch-preflight-abort');
    const now = new Date('2026-07-27T01:05:00.000Z');
    const claimed = await claim({ db, batchId: db.batches[0].id, claimToken: 'active-owner', now });

    const aborted = await abortUnclaimedExecutions({ db, batchId: db.batches[0].id, errorCode: 'preflight-terminal-failure', now });

    expect(aborted).toBe(2);
    expect(db.executions.find((execution: any) => execution.id === claimed!.execution.id)).toMatchObject({ state: 'RUNNING', claimToken: 'active-owner' });
    expect(db.executions.filter((execution: any) => execution.id !== claimed!.execution.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'FAILED', failureStage: 'preflight', errorCode: 'preflight-terminal-failure' }),
    ]));
    expect(db.gradingRuns.filter((run: any) => run.id !== claimed!.execution.gradingRunId).every((run: any) => run.state === 'FAILED')).toBe(true);
  });

  it('retries a transient serialization conflict while refreshing a claimed batch', async () => {
    const db = createMemoryDb();
    await createBatch(db, 'batch-refresh-retry');
    db.failNextBatchRefresh = true;

    const claimed = await claim({
      db,
      batchId: db.batches[0].id,
      claimToken: 'refresh-owner',
      now: new Date('2026-07-27T01:05:00.000Z'),
    });

    expect(claimed?.execution.state).toBe('RUNNING');
    expect(db.batches[0]).toMatchObject({ state: 'RUNNING', completedCount: 0, failedCount: 0 });
  });

  it('resumes raw-output without resetting the persisted draft', async () => {
    const db = createMemoryDb();
    await createBatch(db, 'batch-raw-resume');
    const now = new Date('2026-07-27T01:15:00.000Z');
    const first = await claim({ db, batchId: db.batches[0].id, claimToken: 'raw-owner-1', now });
    markDraftPersisted(db, first!.execution);
    const run = db.gradingRuns.find((candidate: any) => candidate.id === first!.execution.gradingRunId);
    run.draftTotalScore = 7;

    await fail({
      db,
      executionId: first!.execution.id,
      claimToken: 'raw-owner-1',
      failureStage: 'raw-output',
      errorCode: 'raw-output-write-failed',
      retryable: true,
      now,
    });
    const resumed = await claim({ db, batchId: db.batches[0].id, claimToken: 'raw-owner-2', now });

    expect(resumed).toMatchObject({ resumeStage: 'raw-output' });
    expect(run).toMatchObject({ state: 'AWAITING_REVIEW', draftTotalScore: 7 });
    expect(resumed!.execution.failureStage).toBe('raw-output');
  });

  it('rolls back fail when the grading-run transition is fenced', async () => {
    const db = createMemoryDb();
    await createBatch(db, 'batch-fail-rollback');
    const now = new Date('2026-07-27T01:20:00.000Z');
    const claimed = await claim({ db, batchId: db.batches[0].id, claimToken: 'owner', now });
    markDraftPersisted(db, claimed!.execution);
    db.failNextGradingRunUpdate = true;

    await expect(fail({
      db,
      executionId: claimed!.execution.id,
      claimToken: 'owner',
      failureStage: 'raw-output',
      errorCode: 'raw-output-write-failed',
      retryable: true,
      now,
    })).rejects.toThrow('experiment-grading-run-fenced');
    expect(db.executions[0]).toMatchObject({ state: 'RUNNING', claimToken: 'owner' });
    expect(db.gradingRuns[0].state).toBe('AWAITING_REVIEW');
  });

  it('recomputes concurrent batch completions without losing counts', async () => {
    const db = createMemoryDb();
    await createBatch(db, 'batch-aggregate');
    const now = new Date('2026-07-27T01:30:00.000Z');
    const first = await claim({ db, batchId: db.batches[0].id, claimToken: 'aggregate-1', now });
    const second = await claim({ db, batchId: db.batches[0].id, claimToken: 'aggregate-2', now });
    markDraftPersisted(db, first!.execution);
    markDraftPersisted(db, second!.execution);
    await Promise.all([
      complete({ db, executionId: first!.execution.id, claimToken: 'aggregate-1', rawOutputObjectKey: 'raw/1', rawOutputChecksum: 'sha256:1', now }),
      complete({ db, executionId: second!.execution.id, claimToken: 'aggregate-2', rawOutputObjectKey: 'raw/2', rawOutputChecksum: 'sha256:2', now }),
    ]);
    expect(db.batches[0]).toMatchObject({ completedCount: 2, failedCount: 0, state: 'RUNNING' });
  });

  it('does not complete an execution before its grading draft is persisted', async () => {
    const db = createMemoryDb();
    await createBatch(db, 'batch-unpersisted-draft');
    const now = new Date('2026-07-27T01:45:00.000Z');
    const claimed = await claim({ db, batchId: db.batches[0].id, claimToken: 'unpersisted-owner', now });

    await expect(complete({
      db,
      executionId: claimed!.execution.id,
      claimToken: 'unpersisted-owner',
      rawOutputObjectKey: 'raw/unpersisted',
      rawOutputChecksum: 'sha256:unpersisted',
      now,
    })).rejects.toThrow('experiment-grading-run-not-persisted');

    expect(claimed!.execution.state).toBe('RUNNING');
    expect(claimed!.execution.rawOutputObjectKey).toBeUndefined();
    expect(db.batches[0]).toMatchObject({ completedCount: 0, state: 'RUNNING' });
  });

  it('recovers expired leases independently and exhausts only the affected execution', async () => {
    const db = createMemoryDb();
    const batch = { id: 'batch-recovery', totalExecutions: 3, maxAttempts: 2, state: 'RUNNING', startedAt: new Date(), completedAt: null };
    db.batches.push(batch);
    const expiredAt = new Date('2026-07-27T02:00:00.000Z');
    db.gradingRuns.push(
      { id: 'run-retry', state: 'RUNNING' },
      { id: 'run-exhausted', state: 'RUNNING' },
    );
    db.executions.push(
      { id: 'execution-retry', gradingRunId: 'run-retry', batchId: batch.id, state: 'RUNNING', attemptCount: 1, claimToken: 'owner-a', leaseExpiresAt: expiredAt, sampleId: 'sample-a', questionId: 'T1-1', repetitionOrdinal: 1 },
      { id: 'execution-exhausted', gradingRunId: 'run-exhausted', batchId: batch.id, state: 'RUNNING', attemptCount: 2, claimToken: 'owner-b', leaseExpiresAt: expiredAt, sampleId: 'sample-a', questionId: 'T1-1', repetitionOrdinal: 2 },
      { id: 'execution-unaffected', batchId: batch.id, state: 'QUEUED', attemptCount: 0, claimToken: null, leaseExpiresAt: null, sampleId: 'sample-b', questionId: 'T1-1', repetitionOrdinal: 1 },
    );

    const result = await recover({ db, now: new Date('2026-07-27T02:00:01.000Z') });
    expect(result).toEqual({ scanned: 2, retryable: 1, failed: 1 });
    expect(db.executions.find((row: any) => row.id === 'execution-retry')).toMatchObject({ state: 'RETRYABLE', errorCode: 'worker-lease-expired' });
    expect(db.executions.find((row: any) => row.id === 'execution-exhausted')).toMatchObject({ state: 'FAILED', errorCode: 'worker-lease-retry-exhausted' });
    expect(batch.state).toBe('RETRYABLE');
  });

  it('rolls back lease recovery when the grading-run transition is fenced', async () => {
    const db = createMemoryDb();
    const now = new Date('2026-07-27T02:15:00.000Z');
    db.batches.push({ id: 'batch-recover-rollback', totalExecutions: 1, maxAttempts: 2, state: 'RUNNING', startedAt: now });
    db.gradingRuns.push({ id: 'run-recover-rollback', state: 'RUNNING' });
    db.executions.push({
      id: 'execution-recover-rollback',
      gradingRunId: 'run-recover-rollback',
      batchId: 'batch-recover-rollback',
      state: 'RUNNING',
      attemptCount: 1,
      claimToken: 'expired-owner',
      leaseExpiresAt: now,
      sampleId: 'sample-a',
      questionId: 'T1-1',
      repetitionOrdinal: 1,
    });
    db.failNextGradingRunUpdate = true;

    await expect(recover({ db, now: new Date(now.getTime() + 1) }))
      .rejects.toThrow('experiment-grading-run-fenced');
    expect(db.executions[0]).toMatchObject({ state: 'RUNNING', claimToken: 'expired-owner' });
    expect(db.gradingRuns[0].state).toBe('RUNNING');
  });

  it('cleans a late stale-lease raw output without overwriting the current owner', async () => {
    const db = createMemoryDb();
    await createBatch(db, 'batch-raw-output');
    let currentTime = new Date('2026-07-27T03:00:00.000Z');
    const first = await claim({ db, batchId: db.batches[0].id, claimToken: 'raw-owner-1', now: currentTime, leaseMs: 1_000 });
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const objects = new Map<string, TeacherAiGradingRawOutputMetadata>();
    const writer: TeacherAiGradingRawOutputWriter = {
      write: async (input) => {
        if (input.attempt === 1) await firstGate;
        objects.set(input.key, { key: input.key, ownerId: input.ownerId, checksum: input.checksum, claimFingerprint: input.claimFingerprint, attempt: input.attempt });
        return input.key;
      },
      head: async (key) => objects.get(key) ?? null,
      delete: async (key) => { objects.delete(key); },
    };
    const staleWrite = persistClaimedRawOutput({
      db,
      executionId: first!.execution.id,
      claimToken: 'raw-owner-1',
      bytes: Buffer.from('{"owner":1}'),
      writer,
      clock: () => currentTime,
    });

    currentTime = new Date('2026-07-27T03:00:02.000Z');
    await recover({ db, now: currentTime });
    const second = await claim({ db, batchId: db.batches[0].id, claimToken: 'raw-owner-2', now: currentTime, leaseMs: 10_000 });
    markDraftPersisted(db, second!.execution);
    const current = await persistClaimedRawOutput({
      db,
      executionId: second!.execution.id,
      claimToken: 'raw-owner-2',
      bytes: Buffer.from('{"owner":2}'),
      writer,
      clock: () => currentTime,
    });
    releaseFirst();
    await expect(staleWrite).rejects.toThrow('experiment-execution-fenced');

    expect(current.rawOutputObjectKey).toContain('/2/');
    expect(objects.size).toBe(1);
    expect(objects.has(current.rawOutputObjectKey)).toBe(true);
  });
});

function replaceRows(target: any[], source: any[]): void {
  target.splice(0, target.length, ...source.map((row) => ({ ...row })));
}
