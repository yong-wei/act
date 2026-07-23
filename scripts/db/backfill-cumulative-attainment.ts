import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Queue, type Job } from 'bullmq';
import { Redis } from 'ioredis';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
  materializeCumulativeClassPortrait,
} from '../../src/lib/data-governance/cumulative-class-materialization';
import {
  planMissingLearningFactUpserts,
  reduceLearnerFactTransitions,
} from '../../src/lib/data-governance/cumulative-learner-state';
import {
  isPortraitV2ProfileEvidence,
  mapLearningFactsToPortraitEvidence,
} from '../../src/lib/data-governance/portrait-v2-incremental-update';
import { materializeIncrementalPortraitV2 } from '../../src/lib/data-governance/portrait-v2-materialization';
import { PORTRAIT_V2_CALCULATION_VERSION } from '../../src/lib/data-governance/portrait-v2-model';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;
const INVALIDATABLE_QUEUE_STATES = ['wait', 'paused', 'prioritized', 'delayed'] as const;
const QUEUE_STATES = [...INVALIDATABLE_QUEUE_STATES, 'active'] as const;
const GLOBAL_FENCE_ID = 'global';
const GLOBAL_SUBJECT = 'global';
const SAFE_ERROR_CODES = new Set([
  'backfill-mode-must-be-exclusive',
  'invalid-stable-run-id',
  'apply-requires-stable-run-id',
  'apply-requires-plan-run-id',
  'apply-requires-expected-input-digest',
  'apply-requires-wait',
  'apply-forbids-limit',
  'limit-must-be-a-positive-integer',
  'dry-run-id-conflict',
  'completed-run-verify-only',
  'apply-run-exists-use-resume',
  'resume-run-mismatch',
  'plan-fence-drift',
  'apply-requires-redis-queues',
  'learner-current-pointer-verification-failed',
  'class-current-pointer-verification-failed',
  'cutover-fence-verification-failed',
  'learner-receipt-verification-failed',
  'class-receipt-verification-failed',
  'queue-invalidation-inventory-receipt-required',
  'queue-invalidation-inventory-invalid',
  'queue-invalidation-terminal-receipt-required',
  'queue-invalidation-terminal-invalid',
  'queue-job-id-required',
  'completion-receipt-verification-failed',
  'class-membership-drift',
  'completed-apply-run-required',
  'completed-plan-required',
  'verification-input-drift',
  'verification-digest-mismatch',
  'plan-input-drift',
]);
type BackfillDb = Record<string, any>;
type QueueState = typeof QUEUE_STATES[number];
type QueueName = 'student' | 'class';
type QueueInvalidationOutcome = 'removed' | 'active-fenced' | 'absent-after-interruption';

interface QueueInventoryItem {
  queue: QueueName;
  state: QueueState;
  jobRef: string;
}

interface QueueInvalidationInventory extends Record<string, unknown> {
  version: 1;
  items: QueueInventoryItem[];
  expectedByQueueState: Record<string, number>;
  total: number;
  inventoryDigest: string;
}

interface QueueInvalidationResult extends Record<string, unknown> {
  inventoryDigest: string;
  reconciliationDigest: string;
  outcomes: Array<QueueInventoryItem & { outcome: QueueInvalidationOutcome }>;
  counts: Record<string, number>;
}

export interface CumulativeBackfillOptions {
  mode: 'dry-run' | 'apply' | 'verify';
  runId: string | null;
  planRunId: string | null;
  expectedInputDigest: string | null;
  resume: boolean;
  wait: boolean;
  limit: number | null;
}

export interface CumulativeBackfillCandidate {
  userId: string;
  classId: string | null;
}

interface Inventory extends Record<string, unknown> {
  candidates: CumulativeBackfillCandidate[];
  selected: CumulativeBackfillCandidate[];
  noFactCount: number;
  currentClassCount: number;
  noEvidenceStateCount: number;
  inputDigest: string;
  baselineFence: ReturnType<typeof fenceDigestInput>;
}

export interface QueueInvalidationFacade {
  getJobs(states: QueueState[]): Promise<Array<Pick<Job, 'id' | 'remove' | 'getState'>>>;
}

interface Runtime {
  now?: () => Date;
  materializeLearner?: (db: BackfillDb, userId: string, options: Record<string, unknown>) => Promise<unknown>;
  materializeClass?: (db: BackfillDb, classId: string, options: Record<string, unknown>) => Promise<unknown>;
}

function argValue(argv: string[], name: string): string | null {
  const inline = argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] ?? null : null;
}

export function parseCumulativeBackfillArgs(argv: string[]): CumulativeBackfillOptions {
  const apply = argv.includes('--apply');
  const dryRun = argv.includes('--dry-run');
  const verify = argv.includes('--verify');
  if ([apply, dryRun, verify].filter(Boolean).length > 1) throw new Error('backfill-mode-must-be-exclusive');
  const mode = verify ? 'verify' : apply ? 'apply' : 'dry-run';
  const runId = argValue(argv, '--run-id');
  const planRunId = argValue(argv, '--plan-run-id');
  const expectedInputDigest = argValue(argv, '--expected-input-digest');
  const rawLimit = argValue(argv, '--limit');
  const limit = rawLimit === null ? null : Number(rawLimit);
  if (runId && !RUN_ID_PATTERN.test(runId)) throw new Error('invalid-stable-run-id');
  if ((mode === 'apply' || mode === 'verify') && !runId) throw new Error('apply-requires-stable-run-id');
  if (mode === 'apply' && !planRunId) throw new Error('apply-requires-plan-run-id');
  if (mode === 'apply' && !expectedInputDigest) throw new Error('apply-requires-expected-input-digest');
  if (mode === 'apply' && !argv.includes('--wait')) throw new Error('apply-requires-wait');
  if (mode === 'apply' && rawLimit !== null) throw new Error('apply-forbids-limit');
  if (rawLimit !== null && (!Number.isSafeInteger(limit) || limit! <= 0)) {
    throw new Error('limit-must-be-a-positive-integer');
  }
  return {
    mode,
    runId,
    planRunId,
    expectedInputDigest,
    resume: argv.includes('--resume'),
    wait: argv.includes('--wait'),
    limit,
  };
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function subjectKey(kind: string, id: string): string {
  return hash({ kind, id });
}

function fenceDigestInput(fence: any) {
  return {
    fence: BigInt(fence?.fence ?? 0),
    calculationVersion: fence?.calculationVersion ?? null,
    learnerGeneration: BigInt(fence?.learnerGeneration ?? 0),
    classMaterializationVersion: fence?.classMaterializationVersion ?? null,
    classGeneration: BigInt(fence?.classGeneration ?? 0),
    queueGeneration: BigInt(fence?.queueGeneration ?? 0),
  };
}

function serializeFence(fence: ReturnType<typeof fenceDigestInput>) {
  return {
    fence: fence.fence.toString(),
    calculationVersion: fence.calculationVersion,
    learnerGeneration: fence.learnerGeneration.toString(),
    classMaterializationVersion: fence.classMaterializationVersion,
    classGeneration: fence.classGeneration.toString(),
    queueGeneration: fence.queueGeneration.toString(),
  };
}

function baselineFromPlan(plan: any): ReturnType<typeof fenceDigestInput> {
  const baseline = plan.summary?.baselineFence;
  return baseline ? fenceDigestInput(baseline) : {
    fence: BigInt(plan.cutoverFence),
    calculationVersion: plan.calculationVersion,
    learnerGeneration: BigInt(plan.learnerGeneration),
    classMaterializationVersion: plan.classMaterializationVersion,
    classGeneration: BigInt(plan.classGeneration),
    queueGeneration: BigInt(plan.queueGeneration),
  };
}

function canonicalTransition(row: any) {
  return {
    userId: row.userId,
    factId: row.factId,
    operation: row.operation,
    occurredAt: row.occurredAt,
    transitionPayload: row.transitionPayload ?? null,
    sourceReference: row.sourceReference ?? null,
    correctionOfSequence: row.correctionOfSequence ?? null,
  };
}

export async function inventoryCumulativeBackfill(
  db: BackfillDb,
  limit: number | null,
  baselineFence?: ReturnType<typeof fenceDigestInput>,
): Promise<Inventory> {
  const facts = await db.learningFact.findMany({
    orderBy: [{ userId: 'asc' }, { startedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true, userId: true, startedAt: true, outcome: true, score: true,
      competencyContribution: true, contextJson: true, createdAt: true,
    },
  });
  const ownerIds = [...new Set(facts.map((fact: any) => fact.userId))].sort();
  const users = await db.user.findMany({
    where: { role: 'STUDENT' },
    orderBy: { id: 'asc' },
    select: { id: true, profile: { select: { classId: true } } },
  });
  const ownerSet = new Set(ownerIds);
  const candidates: CumulativeBackfillCandidate[] = users
    .filter((user: any) => ownerSet.has(user.id))
    .map((user: any) => ({ userId: user.id, classId: user.profile?.classId ?? null }));
  const transitions = ownerIds.length === 0 ? [] : await db.learnerFactTransition.findMany({
    where: { userId: { in: ownerIds } },
    orderBy: [{ userId: 'asc' }, { sequence: 'asc' }],
  });
  const factsByUser = new Map<string, any[]>();
  for (const fact of facts) factsByUser.set(fact.userId, [...(factsByUser.get(fact.userId) ?? []), fact]);
  const transitionsByUser = new Map<string, any[]>();
  for (const transition of transitions) {
    transitionsByUser.set(transition.userId, [...(transitionsByUser.get(transition.userId) ?? []), transition]);
  }
  const selected = limit === null ? candidates : candidates.slice(0, limit);
  const canonicalTransitions: unknown[] = [];
  let noEvidenceStateCount = 0;
  for (const candidate of candidates) {
    const learnerFacts = factsByUser.get(candidate.userId) ?? [];
    const journal = transitionsByUser.get(candidate.userId) ?? [];
    const drafts = planMissingLearningFactUpserts({ userId: candidate.userId, facts: learnerFacts, transitions: journal });
    let sequence = journal.reduce((max, row) => row.sequence > max ? row.sequence : max, BigInt(0));
    const simulated = drafts.map((draft, index) => ({
      ...draft, id: `dry-run:${index}`, sequence: ++sequence, createdAt: draft.occurredAt,
    }));
    canonicalTransitions.push(...[...journal, ...simulated].map(canonicalTransition));
    const activeFacts = reduceLearnerFactTransitions({
      facts: learnerFacts,
      transitions: [...journal, ...simulated],
    }).activeFacts;
    if (selected.some((selectedCandidate) => selectedCandidate.userId === candidate.userId) &&
        mapLearningFactsToPortraitEvidence(activeFacts).evidence.filter(isPortraitV2ProfileEvidence).length === 0) {
      noEvidenceStateCount++;
    }
  }
  const fence = baselineFence ?? fenceDigestInput(await db.cumulativePortraitCutoverFence.findUnique({
    where: { id: GLOBAL_FENCE_ID },
  }));
  return {
    candidates,
    selected,
    noFactCount: users.length - candidates.length,
    currentClassCount: new Set(selected.flatMap((candidate) => candidate.classId ? [candidate.classId] : [])).size,
    noEvidenceStateCount,
    baselineFence: fence,
    inputDigest: hash({
      version: 1,
      candidates: selected,
      facts: facts.filter((fact: any) => selected.some((candidate) => candidate.userId === fact.userId)),
      transitions: canonicalTransitions.filter((row: any) =>
        selected.some((candidate) => candidate.userId === row.userId)),
      fence,
    }),
  };
}

async function writeReceipt(
  db: BackfillDb,
  runId: string,
  stage: string,
  kind: string,
  id: string,
  status: 'RECORDED' | 'VERIFIED' | 'SKIPPED' | 'FAILED' | 'INVALIDATED',
  inputDigest: string,
  counts: Record<string, number> = {},
  details: Record<string, unknown> = {},
) {
  const key = subjectKey(kind, id);
  const existing = await db.cumulativePortraitMigrationReceipt.findFirst({
    where: { runId, stage, subjectKind: kind, subjectKey: key, status },
    orderBy: { attempt: 'desc' },
  });
  if (existing && (status === 'VERIFIED' || status === 'SKIPPED')) return existing;
  const latest = await db.cumulativePortraitMigrationReceipt.findFirst({
    where: { runId, stage, subjectKind: kind, subjectKey: key },
    orderBy: { attempt: 'desc' },
  });
  return db.cumulativePortraitMigrationReceipt.create({
    data: {
      runId, stage, subjectKind: kind, subjectKey: key,
      attempt: (latest?.attempt ?? 0) + 1, status, inputDigest, counts, details,
    },
  });
}

async function persistDryRun(db: BackfillDb, runId: string, inventory: Inventory, now: Date) {
  const existing = await db.cumulativePortraitMigrationRun.findUnique({ where: { id: runId } });
  const fence = fenceDigestInput(await db.cumulativePortraitCutoverFence.findUnique({ where: { id: GLOBAL_FENCE_ID } }));
  if (existing) {
    if (existing.mode !== 'DRY_RUN' || existing.status !== 'COMPLETED' ||
        existing.inputDigest !== inventory.inputDigest) throw new Error('dry-run-id-conflict');
    return;
  }
  await db.cumulativePortraitMigrationRun.create({
    data: {
      id: runId, sourceDryRunId: null, mode: 'DRY_RUN', status: 'COMPLETED',
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      classMaterializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
      learnerGeneration: fence.learnerGeneration, classGeneration: fence.classGeneration,
      queueGeneration: fence.queueGeneration, cutoverFence: fence.fence,
      inputDigest: inventory.inputDigest,
      summary: {
        candidateCount: inventory.candidates.length, selectedCount: inventory.selected.length,
        noFactCount: inventory.noFactCount, noEvidenceStateCount: inventory.noEvidenceStateCount,
        currentClassCount: inventory.currentClassCount,
        baselineFence: serializeFence(inventory.baselineFence),
      },
      startedAt: now, completedAt: now,
    },
  });
  await writeReceipt(db, runId, 'inventory', 'global', GLOBAL_SUBJECT, 'RECORDED', inventory.inputDigest, {
    candidates: inventory.selected.length,
    noFact: inventory.noFactCount,
    noEvidence: inventory.noEvidenceStateCount,
    classes: inventory.currentClassCount,
  });
}

async function beginApply(
  db: BackfillDb,
  options: CumulativeBackfillOptions,
  plan: any,
  inventory: Inventory,
  now: Date,
) {
  return db.$transaction(async (tx: BackfillDb) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('cumulative-portrait-cutover'))");
    const existing = await tx.cumulativePortraitMigrationRun.findUnique({ where: { id: options.runId } });
    if (existing) {
      if (existing.status === 'COMPLETED') throw new Error('completed-run-verify-only');
      if (!options.resume) throw new Error('apply-run-exists-use-resume');
      const matches = existing.mode === 'APPLY' && existing.status === 'RUNNING' &&
        existing.sourceDryRunId === options.planRunId && existing.inputDigest === inventory.inputDigest &&
        existing.calculationVersion === PORTRAIT_V2_CALCULATION_VERSION &&
        existing.classMaterializationVersion === CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION;
      if (!matches) throw new Error('resume-run-mismatch');
      return existing;
    }
    const currentFence = await tx.cumulativePortraitCutoverFence.findUnique({ where: { id: GLOBAL_FENCE_ID } });
    if (hash(fenceDigestInput(currentFence)) !== hash(baselineFromPlan(plan))) {
      throw new Error('plan-fence-drift');
    }
    const next = {
      fence: BigInt(currentFence?.fence ?? 0) + BigInt(1),
      learnerGeneration: BigInt(currentFence?.learnerGeneration ?? 0) + BigInt(1),
      classGeneration: BigInt(currentFence?.classGeneration ?? 0) + BigInt(1),
      queueGeneration: BigInt(currentFence?.queueGeneration ?? 0) + BigInt(1),
    };
    const run = await tx.cumulativePortraitMigrationRun.create({
      data: {
        id: options.runId, sourceDryRunId: options.planRunId, mode: 'APPLY', status: 'RUNNING',
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        classMaterializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
        learnerGeneration: next.learnerGeneration,
        classGeneration: next.classGeneration,
        queueGeneration: next.queueGeneration,
        cutoverFence: next.fence,
        inputDigest: inventory.inputDigest,
        summary: {}, startedAt: now,
      },
    });
    await tx.cumulativePortraitCutoverFence.upsert({
      where: { id: GLOBAL_FENCE_ID },
      create: {
        id: GLOBAL_FENCE_ID, calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        classMaterializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
        ...next, activeMigrationRunId: options.runId, advancedAt: now,
      },
      update: {
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        classMaterializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
        ...next, activeMigrationRunId: options.runId, advancedAt: now,
      },
    });
    const requests = await tx.learningMaterializationRebuildRequest.updateMany({
      where: { status: { in: ['PENDING', 'CLAIMED'] } },
      data: { status: 'INVALIDATED', lastErrorCode: 'cumulative-cutover-fence-advanced', completedAt: now },
    });
    const outbox = await tx.learningMaterializationOutbox.updateMany({
      where: { status: { in: ['PENDING', 'CLAIMED'] } },
      data: { status: 'INVALIDATED', lastErrorCode: 'cumulative-cutover-fence-advanced', deliveredAt: now },
    });
    await writeReceipt(tx, options.runId!, 'invalidate-db-work', 'global', GLOBAL_SUBJECT, 'INVALIDATED',
      inventory.inputDigest, { rebuildRequests: requests.count, outbox: outbox.count });
    return run;
  });
}

function queueJobRef(queue: QueueName, jobId: string): string {
  return hash({ version: 1, queue, jobId });
}

function normalizeQueueState(state: string): QueueState {
  const normalized = state === 'waiting' ? 'wait' : state;
  if (!QUEUE_STATES.includes(normalized as QueueState)) {
    throw new Error('queue-invalidation-inventory-invalid');
  }
  return normalized as QueueState;
}

function queueStateCounts(items: QueueInventoryItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const queue of ['student', 'class'] as const) {
    for (const state of QUEUE_STATES) counts[`${queue}.${state}`] = 0;
  }
  for (const item of items) counts[`${item.queue}.${item.state}`]++;
  return counts;
}

function validateQueueInventoryReceipt(receipt: any, inputDigest: string): QueueInvalidationInventory {
  const details = receipt?.details as QueueInvalidationInventory | undefined;
  if (!receipt || receipt.status !== 'RECORDED' || receipt.inputDigest !== inputDigest ||
      details?.version !== 1 || !Array.isArray(details.items) ||
      !details.expectedByQueueState || typeof details.inventoryDigest !== 'string') {
    throw new Error('queue-invalidation-inventory-invalid');
  }
  const items = [...details.items].sort((left, right) =>
    left.queue.localeCompare(right.queue) ||
    left.state.localeCompare(right.state) ||
    left.jobRef.localeCompare(right.jobRef));
  const expectedByQueueState = queueStateCounts(items);
  const digestInput = { version: 1 as const, items, expectedByQueueState, total: items.length };
  if (items.some((item) =>
    !['student', 'class'].includes(item.queue) ||
    !QUEUE_STATES.includes(item.state) ||
    !/^[a-f0-9]{64}$/.test(item.jobRef)) ||
      new Set(items.map((item) => item.jobRef)).size !== items.length ||
      canonicalJson(items) !== canonicalJson(details.items) ||
      canonicalJson(expectedByQueueState) !== canonicalJson(details.expectedByQueueState) ||
      details.total !== items.length ||
      receipt.counts?.expectedTotal !== items.length ||
      Object.entries(expectedByQueueState).some(([key, value]) => receipt.counts?.[key] !== value) ||
      details.inventoryDigest !== hash(digestInput)) {
    throw new Error('queue-invalidation-inventory-invalid');
  }
  return { ...digestInput, inventoryDigest: details.inventoryDigest };
}

async function findReceipt(
  db: BackfillDb,
  runId: string,
  stage: string,
  status: 'RECORDED' | 'VERIFIED',
) {
  return db.cumulativePortraitMigrationReceipt.findFirst({
    where: {
      runId,
      stage,
      subjectKind: 'global',
      subjectKey: subjectKey('global', GLOBAL_SUBJECT),
      status,
    },
    orderBy: { attempt: 'desc' },
  });
}

async function loadOrCaptureQueueInventory(
  db: BackfillDb,
  run: any,
  queues: Record<QueueName, QueueInvalidationFacade>,
): Promise<QueueInvalidationInventory> {
  const existing = await findReceipt(db, run.id, 'queue-invalidation-inventory', 'RECORDED');
  if (existing) return validateQueueInventoryReceipt(existing, run.inputDigest);

  const items: QueueInventoryItem[] = [];
  for (const queueName of ['student', 'class'] as const) {
    const jobs = await queues[queueName].getJobs([...QUEUE_STATES]);
    for (const job of jobs) {
      if (job.id === undefined || job.id === null) throw new Error('queue-job-id-required');
      const state = normalizeQueueState(await job.getState());
      items.push({ queue: queueName, state, jobRef: queueJobRef(queueName, String(job.id)) });
    }
  }
  items.sort((left, right) =>
    left.queue.localeCompare(right.queue) ||
    left.state.localeCompare(right.state) ||
    left.jobRef.localeCompare(right.jobRef));
  const expectedByQueueState = queueStateCounts(items);
  const digestInput = { version: 1 as const, items, expectedByQueueState, total: items.length };
  const inventory = { ...digestInput, inventoryDigest: hash(digestInput) };
  await writeReceipt(
    db,
    run.id,
    'queue-invalidation-inventory',
    'global',
    GLOBAL_SUBJECT,
    'RECORDED',
    run.inputDigest,
    { expectedTotal: items.length, ...expectedByQueueState },
    inventory,
  );
  return inventory;
}

function validateQueueTerminalReceipt(
  receipt: any,
  inputDigest: string,
  inventory: QueueInvalidationInventory,
): QueueInvalidationResult {
  const details = receipt?.details as QueueInvalidationResult | undefined;
  if (!receipt || receipt.status !== 'VERIFIED' || receipt.inputDigest !== inputDigest ||
      details?.inventoryDigest !== inventory.inventoryDigest ||
      typeof details.reconciliationDigest !== 'string' || !Array.isArray(details.outcomes)) {
    throw new Error('queue-invalidation-terminal-invalid');
  }
  const outcomes = [...details.outcomes].sort((left, right) =>
    left.queue.localeCompare(right.queue) ||
    left.state.localeCompare(right.state) ||
    left.jobRef.localeCompare(right.jobRef));
  const expectedItems = inventory.items.map(({ queue, state, jobRef }) => ({ queue, state, jobRef }));
  const outcomeItems = outcomes.map(({ queue, state, jobRef }) => ({ queue, state, jobRef }));
  const validOutcomes = new Set<QueueInvalidationOutcome>([
    'removed', 'active-fenced', 'absent-after-interruption',
  ]);
  const counts = details.counts;
  const expectedCounts = {
    expectedTotal: inventory.total,
    accountedTotal: outcomes.length,
    removed: outcomes.filter((item) => item.outcome === 'removed').length,
    activeFenced: outcomes.filter((item) => item.outcome === 'active-fenced').length,
    absentAfterInterruption: outcomes.filter((item) => item.outcome === 'absent-after-interruption').length,
    waiting: inventory.items.filter((item) => item.state === 'wait').length,
    paused: inventory.items.filter((item) => item.state === 'paused').length,
    prioritized: inventory.items.filter((item) => item.state === 'prioritized').length,
    delayed: inventory.items.filter((item) => item.state === 'delayed').length,
    active: inventory.items.filter((item) => item.state === 'active').length,
  };
  if (canonicalJson(expectedItems) !== canonicalJson(outcomeItems) ||
      outcomes.some((item) => !validOutcomes.has(item.outcome)) ||
      canonicalJson(counts) !== canonicalJson(expectedCounts) ||
      canonicalJson(receipt.counts) !== canonicalJson(expectedCounts) ||
      details.reconciliationDigest !== hash({
        inventoryDigest: inventory.inventoryDigest,
        outcomes,
        counts,
      })) {
    throw new Error('queue-invalidation-terminal-invalid');
  }
  return { ...details, outcomes };
}

async function reconcileQueueInventory(
  queues: Record<QueueName, QueueInvalidationFacade>,
  inventory: QueueInvalidationInventory,
): Promise<QueueInvalidationResult> {
  const current = new Map<string, Pick<Job, 'id' | 'remove' | 'getState'>>();
  for (const queueName of ['student', 'class'] as const) {
    for (const job of await queues[queueName].getJobs([...QUEUE_STATES])) {
      if (job.id === undefined || job.id === null) throw new Error('queue-job-id-required');
      current.set(queueJobRef(queueName, String(job.id)), job);
    }
  }
  const outcomes: QueueInvalidationResult['outcomes'] = [];
  for (const item of inventory.items) {
    const job = current.get(item.jobRef);
    let outcome: QueueInvalidationOutcome;
    if (!job) {
      outcome = 'absent-after-interruption';
    } else if (normalizeQueueState(await job.getState()) === 'active') {
      outcome = 'active-fenced';
    } else {
      await job.remove();
      outcome = 'removed';
    }
    outcomes.push({ ...item, outcome });
  }
  const counts = {
    expectedTotal: inventory.total,
    accountedTotal: outcomes.length,
    removed: outcomes.filter((item) => item.outcome === 'removed').length,
    activeFenced: outcomes.filter((item) => item.outcome === 'active-fenced').length,
    absentAfterInterruption: outcomes.filter((item) => item.outcome === 'absent-after-interruption').length,
    waiting: inventory.items.filter((item) => item.state === 'wait').length,
    paused: inventory.items.filter((item) => item.state === 'paused').length,
    prioritized: inventory.items.filter((item) => item.state === 'prioritized').length,
    delayed: inventory.items.filter((item) => item.state === 'delayed').length,
    active: inventory.items.filter((item) => item.state === 'active').length,
  };
  const reconciliationDigest = hash({ inventoryDigest: inventory.inventoryDigest, outcomes, counts });
  return { inventoryDigest: inventory.inventoryDigest, reconciliationDigest, outcomes, counts };
}

async function requireQueueInvalidationReceipts(db: BackfillDb, run: any) {
  const inventoryReceipt = await findReceipt(
    db, run.id, 'queue-invalidation-inventory', 'RECORDED',
  );
  if (!inventoryReceipt) throw new Error('queue-invalidation-inventory-receipt-required');
  const inventory = validateQueueInventoryReceipt(inventoryReceipt, run.inputDigest);
  const terminalReceipt = await findReceipt(db, run.id, 'invalidate-queue-work', 'VERIFIED');
  if (!terminalReceipt) throw new Error('queue-invalidation-terminal-receipt-required');
  return {
    inventory,
    terminal: validateQueueTerminalReceipt(terminalReceipt, run.inputDigest, inventory),
  };
}

function publication(run: any) {
  return {
    calculationVersion: run.calculationVersion,
    generation: run.learnerGeneration,
    queueGeneration: run.queueGeneration,
    cutoverFence: run.cutoverFence,
    migrationRunId: run.id,
  };
}

async function validateLearnerPointer(db: BackfillDb, userId: string, run: any) {
  const pointer = await db.learnerPortraitCurrentState.findUnique({
    where: { userId },
    include: { stateVersion: true },
  });
  if (!pointer ||
      pointer.calculationVersion !== run.calculationVersion ||
      pointer.generation !== run.learnerGeneration ||
      pointer.queueGeneration !== run.queueGeneration ||
      pointer.cutoverFence !== run.cutoverFence ||
      pointer.stateVersion?.migrationRunId !== run.id) {
    throw new Error('learner-current-pointer-verification-failed');
  }
  return pointer;
}

async function validateClassPointer(db: BackfillDb, classId: string, run: any) {
  const pointer = await db.classCumulativePortraitCurrentState.findUnique({
    where: { classId },
    include: { version: true },
  });
  if (!pointer ||
      pointer.materializationVersion !== CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION ||
      pointer.calculationVersion !== run.calculationVersion ||
      pointer.generation !== run.classGeneration ||
      pointer.queueGeneration !== run.queueGeneration ||
      pointer.cutoverFence !== run.cutoverFence ||
      pointer.migrationRunId !== run.id ||
      pointer.version?.migrationRunId !== run.id ||
      pointer.version?.materializationVersion !== CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION) {
    throw new Error('class-current-pointer-verification-failed');
  }
  return pointer;
}

async function alreadyVerified(db: BackfillDb, runId: string, stage: string, kind: string, id: string) {
  return Boolean(await db.cumulativePortraitMigrationReceipt.findFirst({
    where: {
      runId, stage, subjectKind: kind, subjectKey: subjectKey(kind, id), status: 'VERIFIED',
    },
  }));
}

async function buildVerificationDigest(db: BackfillDb, run: any, inventory: Inventory) {
  const fence = await db.cumulativePortraitCutoverFence.findUnique({ where: { id: GLOBAL_FENCE_ID } });
  if (!fence ||
      fence.fence !== run.cutoverFence ||
      fence.learnerGeneration !== run.learnerGeneration ||
      fence.classGeneration !== run.classGeneration ||
      fence.queueGeneration !== run.queueGeneration ||
      fence.activeMigrationRunId !== run.id) throw new Error('cutover-fence-verification-failed');
  const queueInvalidation = await requireQueueInvalidationReceipts(db, run);
  const learnerPointers = [];
  for (const candidate of inventory.candidates) {
    if (!(await alreadyVerified(db, run.id, 'learner', 'learner', candidate.userId))) {
      throw new Error('learner-receipt-verification-failed');
    }
    const pointer = await validateLearnerPointer(db, candidate.userId, run);
    learnerPointers.push({
      subjectKey: subjectKey('learner', candidate.userId),
      stateVersionId: pointer.stateVersionId,
      stateKind: pointer.stateVersion.stateKind,
      stateWatermark: pointer.stateWatermark,
    });
  }
  const classIds = [...new Set(inventory.candidates.flatMap((candidate) =>
    candidate.classId ? [candidate.classId] : []))].sort();
  const classPointers = [];
  for (const classId of classIds) {
    if (!(await alreadyVerified(db, run.id, 'class', 'class', classId))) {
      throw new Error('class-receipt-verification-failed');
    }
    const pointer = await validateClassPointer(db, classId, run);
    classPointers.push({
      subjectKey: subjectKey('class', classId),
      versionId: pointer.versionId,
      inputDigest: pointer.inputDigest,
    });
  }
  return hash({
    runId: subjectKey('run', run.id),
    inputDigest: inventory.inputDigest,
    fence: fenceDigestInput(fence),
    queueInvalidation: {
      inventoryDigest: queueInvalidation.inventory.inventoryDigest,
      reconciliationDigest: queueInvalidation.terminal.reconciliationDigest,
      counts: queueInvalidation.terminal.counts,
    },
    learnerPointers,
    classPointers,
  });
}

async function executeApply(
  db: BackfillDb,
  queues: { student: QueueInvalidationFacade; class: QueueInvalidationFacade },
  options: CumulativeBackfillOptions,
  inventory: Inventory,
  plan: any,
  runtime: Runtime,
) {
  if (!queues.student || !queues.class) throw new Error('apply-requires-redis-queues');
  const now = runtime.now?.() ?? new Date();
  const run = await beginApply(db, options, plan, inventory, now);
  const queueInventory = await loadOrCaptureQueueInventory(db, run, queues);
  const terminalReceipt = await findReceipt(db, run.id, 'invalidate-queue-work', 'VERIFIED');
  if (terminalReceipt) {
    validateQueueTerminalReceipt(terminalReceipt, run.inputDigest, queueInventory);
  } else {
    const invalidation = await reconcileQueueInventory(queues, queueInventory);
    await writeReceipt(db, run.id, 'invalidate-queue-work', 'global', GLOBAL_SUBJECT, 'VERIFIED',
      inventory.inputDigest, invalidation.counts, invalidation);
  }
  const materializeLearner = runtime.materializeLearner ??
    (materializeIncrementalPortraitV2 as unknown as NonNullable<Runtime['materializeLearner']>);
  let noEvidence = 0;
  for (const candidate of inventory.candidates) {
    const complete = await alreadyVerified(db, run.id, 'learner', 'learner', candidate.userId);
    if (complete) {
      const pointer = await validateLearnerPointer(db, candidate.userId, run);
      if (pointer.stateVersion.stateKind === 'NO_EVIDENCE') noEvidence++;
    } else {
      await materializeLearner(db, candidate.userId, {
        now, fullRebuild: true, publication: publication(run),
      });
      const pointer = await validateLearnerPointer(db, candidate.userId, run);
      if (pointer.stateVersion.stateKind === 'NO_EVIDENCE') noEvidence++;
      await writeReceipt(db, run.id, 'learner', 'learner', candidate.userId, 'VERIFIED',
        inventory.inputDigest, {
          snapshot: pointer.stateVersion.stateKind === 'SNAPSHOT' ? 1 : 0,
          noEvidence: pointer.stateVersion.stateKind === 'NO_EVIDENCE' ? 1 : 0,
        });
    }
  }
  const profiles = await db.studentProfile.findMany({
    where: {
      userId: { in: inventory.candidates.map((candidate) => candidate.userId) },
      classId: { not: null },
    },
    orderBy: [{ classId: 'asc' }, { userId: 'asc' }],
    select: { userId: true, classId: true },
  });
  const actualMembership = profiles.map((profile: any) => ({
    userId: profile.userId,
    classId: profile.classId,
  })).sort((left: CumulativeBackfillCandidate, right: CumulativeBackfillCandidate) =>
    left.userId.localeCompare(right.userId));
  const expectedMembership = inventory.candidates.flatMap((candidate) =>
    candidate.classId ? [candidate] : []).sort((left, right) => left.userId.localeCompare(right.userId));
  if (hash(actualMembership) !== hash(expectedMembership)) throw new Error('class-membership-drift');
  const classIds: string[] = [...new Set<string>(profiles.flatMap((profile: any) =>
    profile.classId ? [profile.classId] : []))].sort();
  const materializeClass = runtime.materializeClass ??
    (materializeCumulativeClassPortrait as unknown as NonNullable<Runtime['materializeClass']>);
  for (const classId of classIds) {
    const complete = await alreadyVerified(db, run.id, 'class', 'class', classId);
    if (!complete) {
      await materializeClass(db, classId, {
        now,
        publication: {
          calculationVersion: run.calculationVersion,
          learnerGeneration: run.learnerGeneration,
          generation: run.classGeneration,
          queueGeneration: run.queueGeneration,
          cutoverFence: run.cutoverFence,
          migrationRunId: run.id,
          materializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
        },
      });
      await validateClassPointer(db, classId, run);
      await writeReceipt(db, run.id, 'class', 'class', classId, 'VERIFIED', inventory.inputDigest);
    }
  }
  const verificationDigest = await buildVerificationDigest(db, run, inventory);
  await writeReceipt(db, run.id, 'complete', 'global', GLOBAL_SUBJECT, 'VERIFIED',
    inventory.inputDigest, { learners: inventory.candidates.length, classes: classIds.length });
  await db.cumulativePortraitMigrationRun.update({
    where: { id: run.id },
    data: {
      status: 'COMPLETED', verificationDigest, completedAt: now,
      summary: {
        candidateCount: inventory.candidates.length, classCount: classIds.length,
        noFactCount: inventory.noFactCount, noEvidenceStateCount: noEvidence,
      },
    },
  });
  return {
    mode: 'apply',
    candidateCount: inventory.candidates.length,
    classCount: classIds.length,
    noFactCount: inventory.noFactCount,
    noEvidenceStateCount: noEvidence,
    queueJobsEnqueued: 0,
    verificationDigest,
  };
}

async function verifyRun(db: BackfillDb, runId: string) {
  const run = await db.cumulativePortraitMigrationRun.findUnique({ where: { id: runId } });
  if (!run || run.mode !== 'APPLY' || run.status !== 'COMPLETED' || !run.sourceDryRunId) {
    throw new Error('completed-apply-run-required');
  }
  const plan = await db.cumulativePortraitMigrationRun.findUnique({ where: { id: run.sourceDryRunId } });
  if (!plan || plan.mode !== 'DRY_RUN' || plan.status !== 'COMPLETED') throw new Error('completed-plan-required');
  const baseline = baselineFromPlan(plan);
  const inventory = await inventoryCumulativeBackfill(db, null, baseline);
  if (inventory.inputDigest !== plan.inputDigest || run.inputDigest !== plan.inputDigest) {
    throw new Error('verification-input-drift');
  }
  if (!(await alreadyVerified(db, run.id, 'complete', 'global', GLOBAL_SUBJECT))) {
    throw new Error('completion-receipt-verification-failed');
  }
  const verificationDigest = await buildVerificationDigest(db, run, inventory);
  if (verificationDigest !== run.verificationDigest) throw new Error('verification-digest-mismatch');
  return {
    mode: 'verify',
    candidateCount: inventory.candidates.length,
    currentClassCount: inventory.currentClassCount,
    verificationDigest,
  };
}

export async function runCumulativeBackfill(
  db: BackfillDb,
  queues: { student: QueueInvalidationFacade; class: QueueInvalidationFacade },
  options: CumulativeBackfillOptions,
  runtime: Runtime = {},
): Promise<Record<string, number | string>> {
  if (options.mode === 'verify') return verifyRun(db, options.runId!);
  const plan = options.mode === 'apply'
    ? await db.cumulativePortraitMigrationRun.findUnique({ where: { id: options.planRunId } })
    : null;
  if (options.mode === 'apply' &&
      (!plan || plan.mode !== 'DRY_RUN' || plan.status !== 'COMPLETED')) {
    throw new Error('completed-plan-required');
  }
  const baseline = plan ? baselineFromPlan(plan) : undefined;
  const inventory = await inventoryCumulativeBackfill(db, options.limit, baseline);
  const result = {
    mode: 'dry-run',
    candidateCount: inventory.candidates.length,
    selectedCount: inventory.selected.length,
    currentClassCount: inventory.currentClassCount,
    noFactCount: inventory.noFactCount,
    noEvidenceStateCount: inventory.noEvidenceStateCount,
    inputDigest: inventory.inputDigest,
  };
  if (options.mode === 'dry-run') {
    if (options.runId) await persistDryRun(db, options.runId, inventory, runtime.now?.() ?? new Date());
    return result;
  }
  if (!options.wait) throw new Error('apply-requires-wait');
  if (plan.inputDigest !== options.expectedInputDigest ||
      inventory.inputDigest !== options.expectedInputDigest) throw new Error('plan-input-drift');
  return executeApply(db, queues, options, inventory, plan, runtime);
}

async function main() {
  const options = parseCumulativeBackfillArgs(process.argv.slice(2));
  const db = createPrismaClient();
  let redis: Redis | null = null;
  let studentQueue: Queue | null = null;
  let classQueue: Queue | null = null;
  try {
    if (options.mode === 'apply') {
      redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
      await redis.ping();
      studentQueue = new Queue('snapshot-student', { connection: redis });
      classQueue = new Queue('snapshot-class', { connection: redis });
    }
    const result = await runCumulativeBackfill(
      db,
      { student: studentQueue as never, class: classQueue as never },
      options,
    );
    console.log(JSON.stringify(result));
  } finally {
    await studentQueue?.close();
    await classQueue?.close();
    await redis?.quit();
    await db.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'operation-failed';
    console.error(JSON.stringify({
      status: 'failed',
      code: SAFE_ERROR_CODES.has(message) ? message : 'operation-failed',
    }));
    process.exitCode = 1;
  });
}
