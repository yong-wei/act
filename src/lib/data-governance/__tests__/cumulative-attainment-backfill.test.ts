import { describe, expect, it, vi } from 'vitest';

import {
  inventoryCumulativeBackfill,
  parseCumulativeBackfillArgs,
  runCumulativeBackfill,
  type CumulativeBackfillOptions,
} from '../../../../scripts/db/backfill-cumulative-attainment';
import { CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION } from '../cumulative-class-materialization';
import { PORTRAIT_V2_CALCULATION_VERSION } from '../portrait-v2-model';

const now = new Date('2026-07-23T00:00:00.000Z');

function options(input: Partial<CumulativeBackfillOptions> = {}): CumulativeBackfillOptions {
  return {
    mode: 'dry-run',
    runId: null,
    planRunId: null,
    expectedInputDigest: null,
    resume: false,
    wait: false,
    limit: null,
    ...input,
  };
}

function createDb(config: {
  invalidEvidence?: boolean;
  noFacts?: boolean;
  calculationVersion?: string;
} = {}) {
  const facts = config.noFacts ? [] : [{
    id: 'fact-1',
    userId: 'student-1',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:01.000Z'),
    outcome: 'success',
    score: 1,
    competencyContribution: config.invalidEvidence ? {} : { controlModeling: 1 },
    contextJson: { internalMarker: 'raw-fact-must-not-appear' },
    sourceEventId: 'adaptive-assessment:fact-1',
    sourceLogId: 'governed-log:fact-1',
    knowledgeRevisionRef: null,
  }];
  const users = [
    { id: 'student-1', profile: { classId: 'class-1' } },
    { id: 'student-no-fact', profile: { classId: 'class-1' } },
  ];
  const transitions: any[] = [];
  const runs = new Map<string, any>();
  const receipts: any[] = [];
  const learnerPointers = new Map<string, any>();
  const classPointers = new Map<string, any>();
  let fence: any = {
    id: 'global',
    fence: BigInt(4),
    calculationVersion: config.calculationVersion ?? PORTRAIT_V2_CALCULATION_VERSION,
    learnerGeneration: BigInt(7),
    classMaterializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
    classGeneration: BigInt(8),
    queueGeneration: BigInt(9),
    activeMigrationRunId: null,
    advancedAt: now,
  };
  const invalidated = { requests: 0, outbox: 0 };
  const db: any = {
    _state: {
      facts, users, transitions, runs, receipts, learnerPointers, classPointers, invalidated,
      get fence() { return fence; },
    },
    learningFact: {
      findMany: vi.fn(async (args: any) => {
        if (args.where?.userId?.in) {
          return facts.filter((fact) => args.where.userId.in.includes(fact.userId))
            .map((fact) => args.select?.userId ? { userId: fact.userId } : fact);
        }
        return facts;
      }),
    },
    user: {
      findMany: vi.fn(async () => users),
    },
    learnerFactTransition: {
      findMany: vi.fn(async () => transitions),
    },
    cumulativePortraitCutoverFence: {
      findUnique: vi.fn(async () => fence),
      upsert: vi.fn(async ({ create, update }: any) => {
        fence = fence ? { ...fence, ...update } : create;
        return fence;
      }),
    },
    cumulativePortraitMigrationRun: {
      findUnique: vi.fn(async ({ where }: any) => runs.get(where.id) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, verificationDigest: data.verificationDigest ?? null };
        runs.set(data.id, row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = { ...runs.get(where.id), ...data };
        runs.set(where.id, row);
        return row;
      }),
    },
    cumulativePortraitMigrationReceipt: {
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        const matches = receipts.filter((receipt) =>
          Object.entries(where).every(([key, value]) => receipt[key] === value));
        return orderBy?.attempt ? matches.sort((a, b) => b.attempt - a.attempt)[0] ?? null : matches[0] ?? null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `receipt-${receipts.length + 1}`, ...data };
        receipts.push(row);
        return row;
      }),
    },
    learningMaterializationRebuildRequest: {
      updateMany: vi.fn(async () => {
        invalidated.requests++;
        return { count: 2 };
      }),
    },
    learningMaterializationOutbox: {
      updateMany: vi.fn(async () => {
        invalidated.outbox++;
        return { count: 3 };
      }),
    },
    studentProfile: {
      findMany: vi.fn(async () => facts.length === 0 ? [] : [{ userId: 'student-1', classId: 'class-1' }]),
    },
    learnerPortraitCurrentState: {
      findUnique: vi.fn(async ({ where }: any) => learnerPointers.get(where.userId) ?? null),
    },
    classCumulativePortraitCurrentState: {
      findUnique: vi.fn(async ({ where }: any) => classPointers.get(where.classId) ?? null),
    },
    $executeRawUnsafe: vi.fn(async () => 1),
    $transaction: vi.fn(async (callback: any) => callback(db)),
  };
  return db;
}

function queue(states: Array<'wait' | 'waiting' | 'paused' | 'prioritized' | 'delayed' | 'active'> = []) {
  const jobs = states.map((state, index) => ({
    id: `job-${index + 1}`,
    remove: vi.fn(async () => undefined),
    getState: vi.fn(async () => state),
  }));
  return { facade: { getJobs: vi.fn(async () => jobs) }, jobs };
}

function coordinatorQueue(state: 'wait' | 'paused' | 'prioritized' | 'delayed' | 'active' = 'delayed') {
  const job = {
    id: 'coordinator-job',
    data: { coordinator: true },
    remove: vi.fn(async () => undefined),
    getState: vi.fn(async () => state),
  };
  return { facade: { getJobs: vi.fn(async () => [job]) }, job };
}

function interruptibleQueue() {
  let removeAttempts = 0;
  let failSecondRemoval = true;
  const jobs = ['first-sensitive-job', 'second-sensitive-job'].map((id) => {
    const job: any = {
      id,
      removed: false,
      getState: vi.fn(async () => 'waiting'),
    };
    job.remove = vi.fn(async () => {
      removeAttempts++;
      if (failSecondRemoval && removeAttempts === 2) {
        failSecondRemoval = false;
        throw new Error('intentional-queue-invalidation-interruption');
      }
      job.removed = true;
    });
    return job;
  });
  return {
    facade: {
      getJobs: vi.fn(async () => jobs.filter((job) => !job.removed)),
    },
    jobs,
  };
}

function runtime(db: any, calls = { learners: 0, classes: 0 }) {
  return {
    now: () => now,
    materializeLearner: vi.fn(async (_client: any, userId: string, input: any) => {
      calls.learners++;
      if (!db._state.transitions.some((transition: any) =>
        transition.factId === db._state.facts[0]?.id)) {
        const fact = db._state.facts[0];
        db._state.transitions.push({
          id: 'journal-1',
          userId,
          sequence: BigInt(1),
          factId: fact.id,
          operation: 'UPSERT',
          occurredAt: fact.startedAt,
          transitionPayload: null,
          sourceReference: null,
          correctionOfSequence: null,
          createdAt: now,
        });
      }
      const stateKind = db._state.facts[0]?.competencyContribution?.controlModeling ? 'SNAPSHOT' : 'NO_EVIDENCE';
      const stateVersionId = `learner-version-${calls.learners}`;
      db._state.learnerPointers.set(userId, {
        userId,
        stateVersionId,
        calculationVersion: input.publication.calculationVersion,
        generation: input.publication.generation,
        queueGeneration: input.publication.queueGeneration,
        cutoverFence: input.publication.cutoverFence,
        stateWatermark: BigInt(1),
        stateVersion: {
          id: stateVersionId,
          stateKind,
          migrationRunId: input.publication.migrationRunId,
        },
      });
      return { written: true, evidenceCount: stateKind === 'SNAPSHOT' ? 1 : 0, affectedDimensions: [], mappingIssues: [] };
    }),
    materializeClass: vi.fn(async (_client: any, classId: string, input: any) => {
      calls.classes++;
      const versionId = `class-version-${calls.classes}`;
      db._state.classPointers.set(classId, {
        classId,
        versionId,
        materializationVersion: input.publication.materializationVersion,
        calculationVersion: input.publication.calculationVersion,
        generation: input.publication.generation,
        queueGeneration: input.publication.queueGeneration,
        migrationRunId: input.publication.migrationRunId,
        inputDigest: `class-input-${calls.classes}`,
        cutoverFence: input.publication.cutoverFence,
        version: {
          id: versionId,
          migrationRunId: input.publication.migrationRunId,
          materializationVersion: input.publication.materializationVersion,
        },
      });
      return { written: true, versionId, inputDigest: 'class-input', memberSetDigest: 'members', activeStudentCount: 1, totalStudentCount: 1 };
    }),
  };
}

async function plan(db: any, runId = 'plan-2026') {
  const result = await runCumulativeBackfill(db, { student: null as never, class: null as never }, options({ runId }), {
    now: () => now,
  });
  return result.inputDigest as string;
}

async function apply(db: any, digest: string, queues?: any, extra: Partial<CumulativeBackfillOptions> = {}, calls?: any) {
  const student = queues?.student ?? queue().facade;
  const classes = queues?.class ?? queue().facade;
  return runCumulativeBackfill(db, { student, class: classes }, options({
    mode: 'apply',
    runId: 'apply-2026',
    planRunId: 'plan-2026',
    expectedInputDigest: digest,
    wait: true,
    ...extra,
  }), runtime(db, calls));
}

describe('cumulative attainment stopped-service migration', () => {
  it('parses the explicit maintenance modes and apply confirmation gate', () => {
    expect(parseCumulativeBackfillArgs([]).mode).toBe('dry-run');
    expect(parseCumulativeBackfillArgs(['--verify', '--run-id=apply-2026']).mode).toBe('verify');
    expect(() => parseCumulativeBackfillArgs(['--apply', '--run-id=apply-2026']))
      .toThrow('apply-requires-plan-run-id');
    expect(() => parseCumulativeBackfillArgs([
      '--apply', '--run-id=apply-2026', '--plan-run-id=plan-2026',
      '--expected-input-digest=x',
    ])).toThrow('apply-requires-wait');
    expect(() => parseCumulativeBackfillArgs([
      '--apply', '--run-id=apply-2026', '--plan-run-id=plan-2026',
      '--expected-input-digest=x', '--wait', '--limit=1',
    ])).toThrow('apply-forbids-limit');
  });

  it('builds a stable canonical plan and only persists plan audit rows', async () => {
    const db = createDb();
    const first = await inventoryCumulativeBackfill(db, null);
    const second = await inventoryCumulativeBackfill(db, null);
    expect(first.inputDigest).toBe(second.inputDigest);

    const digest = await plan(db);
    expect(digest).toBe(first.inputDigest);
    expect(db._state.runs.get('plan-2026')).toMatchObject({ mode: 'DRY_RUN', status: 'COMPLETED' });
    expect(db._state.learnerPointers.size).toBe(0);
    expect(db._state.classPointers.size).toBe(0);
    expect(db._state.receipts).toHaveLength(1);
    expect(JSON.stringify(db._state.receipts)).not.toContain('student-1');
    expect(JSON.stringify(db._state.receipts)).not.toContain('class-1');
  });

  it('reports students without facts separately and predicts NO_EVIDENCE state', async () => {
    const db = createDb({ invalidEvidence: true });
    const result = await runCumulativeBackfill(db, { student: null as never, class: null as never }, options());
    expect(result).toMatchObject({
      candidateCount: 1,
      noFactCount: 1,
      noEvidenceStateCount: 1,
    });
  });

  it('rejects source drift and does not advance the cutover fence', async () => {
    const db = createDb();
    const digest = await plan(db);
    db._state.facts[0].score = 0.5;
    await expect(apply(db, digest)).rejects.toThrow('plan-input-drift');
    expect(db._state.fence.fence).toBe(BigInt(4));
  });

  it('rejects trusted-anchor drift that would change the filtered fact set', async () => {
    const db = createDb();
    const digest = await plan(db);
    db._state.facts[0].sourceLogId = '';
    await expect(apply(db, digest)).rejects.toThrow('plan-input-drift');
    expect(db._state.fence.fence).toBe(BigInt(4));
  });

  it('upgrades a v2 fence, invalidates old work, and publishes current-version pointers', async () => {
    const db = createDb({ calculationVersion: 'portrait-v2-cumulative.v2' });
    const digest = await plan(db);
    const student = queue(['waiting', 'active']);
    const classes = queue(['delayed', 'paused']);
    const result = await apply(db, digest, { student: student.facade, class: classes.facade });

    expect(result).toMatchObject({
      mode: 'apply',
      candidateCount: 1,
      classCount: 1,
      queueJobsEnqueued: 0,
    });
    expect(db._state.fence).toMatchObject({
      fence: BigInt(5),
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      learnerGeneration: BigInt(8),
      classGeneration: BigInt(9),
      queueGeneration: BigInt(10),
      activeMigrationRunId: 'apply-2026',
    });
    expect(db._state.invalidated).toEqual({ requests: 1, outbox: 1 });
    expect(db.learningMaterializationRebuildRequest.updateMany).toHaveBeenCalledWith({
      where: { status: { in: ['PENDING', 'CLAIMED'] } },
      data: {
        status: 'INVALIDATED',
        lastErrorCode: 'cumulative-cutover-fence-advanced',
        completedAt: now,
      },
    });
    expect(student.jobs[0].remove).toHaveBeenCalledOnce();
    expect(student.jobs[1].remove).not.toHaveBeenCalled();
    expect(classes.jobs.every((job) => job.remove.mock.calls.length === 1)).toBe(true);
    expect(db._state.receipts.find((receipt: any) =>
      receipt.stage === 'invalidate-queue-work')).toMatchObject({
      counts: { waiting: 1, paused: 1, prioritized: 0, delayed: 1, active: 1 },
    });
    expect(db._state.classPointers.get('class-1')).toMatchObject({
      materializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationRunId: 'apply-2026',
    });
    expect(db._state.learnerPointers.get('student-1')).toMatchObject({
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      stateVersion: {
        migrationRunId: 'apply-2026',
      },
    });
    expect(JSON.stringify(db._state.receipts)).not.toContain('student-1');
    expect(JSON.stringify(db._state.receipts)).not.toContain('class-1');
    expect(JSON.stringify(db._state.receipts)).not.toContain('raw-fact-must-not-appear');
  });

  it('keeps recurring coordinator jobs outside the superseded materialization inventory', async () => {
    const db = createDb();
    const digest = await plan(db);
    const student = coordinatorQueue();
    const classes = queue(['wait']);

    await apply(db, digest, { student: student.facade, class: classes.facade });

    expect(student.job.remove).not.toHaveBeenCalled();
    expect(classes.jobs[0].remove).toHaveBeenCalledOnce();
    expect(db._state.receipts.find((receipt: any) =>
      receipt.stage === 'queue-invalidation-inventory')).toMatchObject({
      counts: { expectedTotal: 1, 'class.wait': 1, 'student.delayed': 0 },
    });
  });

  it('publishes an explicit NO_EVIDENCE current state without inventing a snapshot', async () => {
    const db = createDb({ invalidEvidence: true });
    const digest = await plan(db);
    const result = await apply(db, digest);
    expect(result.noEvidenceStateCount).toBe(1);
    expect(db._state.learnerPointers.get('student-1').stateVersion.stateKind).toBe('NO_EVIDENCE');
  });

  it('requires Redis queue access instead of silently skipping invalidation', async () => {
    const db = createDb();
    const digest = await plan(db);
    await expect(runCumulativeBackfill(db, { student: null as never, class: null as never }, options({
      mode: 'apply', runId: 'apply-2026', planRunId: 'plan-2026',
      expectedInputDigest: digest, wait: true,
    }), runtime(db))).rejects.toThrow('apply-requires-redis-queues');
  });

  it('resumes a RUNNING run without advancing generations or duplicating verified learner/class versions', async () => {
    const db = createDb();
    const digest = await plan(db);
    const calls = { learners: 0, classes: 0 };
    await apply(db, digest, undefined, {}, calls);
    db._state.runs.get('apply-2026').status = 'RUNNING';
    const beforeFence = db._state.fence.fence;
    await apply(db, digest, undefined, { resume: true }, calls);
    expect(db._state.fence.fence).toBe(beforeFence);
    expect(calls).toEqual({ learners: 1, classes: 1 });
    expect(db._state.receipts.filter((receipt: any) =>
      receipt.stage === 'learner' && receipt.status === 'VERIFIED')).toHaveLength(1);
  });

  it('reuses the durable nonzero queue inventory after interruption and closes every original item', async () => {
    const db = createDb();
    const digest = await plan(db);
    const student = interruptibleQueue();
    const classes = queue();

    await expect(apply(db, digest, {
      student: student.facade,
      class: classes.facade,
    })).rejects.toThrow('intentional-queue-invalidation-interruption');

    const inventoryReceipt = db._state.receipts.find((receipt: any) =>
      receipt.stage === 'queue-invalidation-inventory');
    expect(inventoryReceipt).toMatchObject({
      status: 'RECORDED',
      counts: { expectedTotal: 2, 'student.wait': 2 },
    });
    expect(db._state.receipts.some((receipt: any) =>
      receipt.stage === 'invalidate-queue-work')).toBe(false);
    expect(student.jobs.filter((job) => job.removed)).toHaveLength(1);
    expect(JSON.stringify(inventoryReceipt)).not.toContain('first-sensitive-job');
    expect(JSON.stringify(inventoryReceipt)).not.toContain('second-sensitive-job');

    await expect(apply(db, digest, {
      student: student.facade,
      class: classes.facade,
    }, { resume: true })).resolves.toMatchObject({ mode: 'apply' });

    const terminalReceipt = db._state.receipts.find((receipt: any) =>
      receipt.stage === 'invalidate-queue-work');
    expect(terminalReceipt).toMatchObject({
      status: 'VERIFIED',
      counts: {
        expectedTotal: 2,
        accountedTotal: 2,
        removed: 1,
        absentAfterInterruption: 1,
      },
    });
    expect(terminalReceipt.details.inventoryDigest).toBe(inventoryReceipt.details.inventoryDigest);
    await expect(runCumulativeBackfill(
      db,
      { student: null as never, class: null as never },
      options({ mode: 'verify', runId: 'apply-2026' }),
    )).resolves.toMatchObject({ mode: 'verify' });
  });

  it('fails verification when queue inventory or terminal receipts are missing or tampered', async () => {
    async function completedDb() {
      const db = createDb();
      const digest = await plan(db);
      await apply(db, digest, {
        student: queue(['wait']).facade,
        class: queue(['delayed']).facade,
      });
      return db;
    }
    const verify = (db: any) => runCumulativeBackfill(
      db,
      { student: null as never, class: null as never },
      options({ mode: 'verify', runId: 'apply-2026' }),
    );

    const missingInventory = await completedDb();
    missingInventory._state.receipts.splice(
      missingInventory._state.receipts.findIndex((receipt: any) =>
        receipt.stage === 'queue-invalidation-inventory'),
      1,
    );
    await expect(verify(missingInventory))
      .rejects.toThrow('queue-invalidation-inventory-receipt-required');

    const tamperedInventory = await completedDb();
    tamperedInventory._state.receipts.find((receipt: any) =>
      receipt.stage === 'queue-invalidation-inventory').details.items[0].jobRef = 'tampered';
    await expect(verify(tamperedInventory))
      .rejects.toThrow('queue-invalidation-inventory-invalid');

    const missingTerminal = await completedDb();
    missingTerminal._state.receipts.splice(
      missingTerminal._state.receipts.findIndex((receipt: any) =>
        receipt.stage === 'invalidate-queue-work'),
      1,
    );
    await expect(verify(missingTerminal))
      .rejects.toThrow('queue-invalidation-terminal-receipt-required');

    const tamperedTerminal = await completedDb();
    tamperedTerminal._state.receipts.find((receipt: any) =>
      receipt.stage === 'invalidate-queue-work').details.inventoryDigest = 'tampered';
    await expect(verify(tamperedTerminal))
      .rejects.toThrow('queue-invalidation-terminal-invalid');
  });

  it('verifies only the durable v2 run, fence and current pointers and rejects a missing class pointer', async () => {
    const db = createDb();
    const digest = await plan(db);
    await apply(db, digest);
    await expect(runCumulativeBackfill(db, { student: null as never, class: null as never }, options({
      mode: 'verify', runId: 'apply-2026',
    }))).resolves.toMatchObject({ mode: 'verify', candidateCount: 1 });

    db._state.classPointers.clear();
    await expect(runCumulativeBackfill(db, { student: null as never, class: null as never }, options({
      mode: 'verify', runId: 'apply-2026',
    }))).rejects.toThrow('class-current-pointer-verification-failed');
  });

  it('does not accept a legacy v1 class pointer during durable verification', async () => {
    const db = createDb();
    const digest = await plan(db);
    await apply(db, digest);
    db._state.classPointers.get('class-1').materializationVersion = 'class-competency.cumulative.v1';
    await expect(runCumulativeBackfill(db, { student: null as never, class: null as never }, options({
      mode: 'verify', runId: 'apply-2026',
    }))).rejects.toThrow('class-current-pointer-verification-failed');
  });
});
