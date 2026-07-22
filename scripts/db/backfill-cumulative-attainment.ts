import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  readLearningMaterializationGeneration,
  requestLearningMaterializationRebuild,
} from '../../src/lib/data-governance/derived-learning-materialization';
import { hasPortraitV2Evidence } from '../../src/lib/data-governance/portrait-v2-consumer';
import { readLatestValidNativePortraitV2Snapshots } from '../../src/lib/data-governance/portrait-v2-model';
import type { ClassSnapshotJob, StudentSnapshotJob } from '../workers/types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WAIT_TIMEOUT_MS = Number(process.env.CUMULATIVE_ATTAINMENT_WAIT_TIMEOUT_MS ?? 30 * 60_000);
const WAIT_POLL_MS = Number(process.env.CUMULATIVE_ATTAINMENT_WAIT_POLL_MS ?? 2_000);
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;
const JOB_HISTORY_OPTIONS = {
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 200 },
} as const;

type BackfillDb = Record<string, any>;

export interface CumulativeBackfillOptions {
  apply: boolean;
  runId: string | null;
  wait: boolean;
  limit: number | null;
}

export interface CumulativeBackfillCandidate {
  userId: string;
  classId: string | null;
}

export interface RequestedCandidate extends CumulativeBackfillCandidate {
  generation: number;
  requestedAt: Date;
  jobId: string;
}

interface RequestedClass {
  classId: string;
  jobId: string;
  requestedAt: Date;
  runRef: string;
}

function argValue(argv: string[], name: string): string | null {
  const inline = argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] ?? null : null;
}

export function parseCumulativeBackfillArgs(argv: string[]): CumulativeBackfillOptions {
  const apply = argv.includes('--apply');
  const runId = argValue(argv, '--run-id');
  const rawLimit = argValue(argv, '--limit');
  const limit = rawLimit === null ? null : Number(rawLimit);
  if (apply && (!runId || !RUN_ID_PATTERN.test(runId))) {
    throw new Error('apply-requires-stable-run-id');
  }
  if (apply && !argv.includes('--wait')) {
    throw new Error('apply-requires-wait');
  }
  if (rawLimit !== null && (!Number.isSafeInteger(limit) || limit! <= 0)) {
    throw new Error('limit-must-be-a-positive-integer');
  }
  return { apply, runId, wait: argv.includes('--wait'), limit };
}

export async function inventoryCumulativeBackfill(
  db: BackfillDb,
  limit: number | null,
): Promise<{
  candidates: CumulativeBackfillCandidate[];
  selected: CumulativeBackfillCandidate[];
  noEvidenceCount: number;
  currentClassCount: number;
}> {
  const factOwners = await db.learningFact.findMany({
    distinct: ['userId'],
    orderBy: { userId: 'asc' },
    select: { userId: true },
  });
  const users = factOwners.length === 0 ? [] : await db.user.findMany({
    where: { role: 'STUDENT', id: { in: factOwners.map((row: { userId: string }) => row.userId) } },
    orderBy: { id: 'asc' },
    select: { id: true, profile: { select: { classId: true } } },
  });
  const candidates: CumulativeBackfillCandidate[] = users.map((user: any) => ({
    userId: user.id,
    classId: user.profile?.classId ?? null,
  }));
  const studentCount = await db.user.count({ where: { role: 'STUDENT' } });
  return {
    candidates,
    selected: limit === null ? candidates : candidates.slice(0, limit),
    noEvidenceCount: Math.max(0, studentCount - candidates.length),
    currentClassCount: new Set(candidates.map((candidate) => candidate.classId).filter(Boolean)).size,
  };
}

function opaqueRef(kind: string, value: string): string {
  return `${kind}-${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;
}

export function buildCumulativeStudentJobId(runId: string, userId: string, generation: number): string {
  return `cumulative-attainment-${opaqueRef('run', runId)}-${opaqueRef('student', userId)}-g${generation}`;
}

export function buildCumulativeClassJobId(
  runId: string,
  classId: string,
  generations: number[],
): string {
  const generationRef = createHash('sha256').update([...generations].sort((a, b) => a - b).join(',')).digest('hex').slice(0, 16);
  return `cumulative-class-${opaqueRef('run', runId)}-${opaqueRef('class', classId)}-g${generationRef}`;
}

async function requestAndEnqueueStudents(
  db: BackfillDb,
  queue: Pick<Queue<StudentSnapshotJob>, 'add'>,
  selected: CumulativeBackfillCandidate[],
  runId: string,
): Promise<RequestedCandidate[]> {
  const requested: RequestedCandidate[] = [];
  for (const candidate of selected) {
    const requestedAt = new Date();
    const generation = await requestLearningMaterializationRebuild(db, {
      userId: candidate.userId,
      classIds: [],
      reason: `cumulative-attainment:${opaqueRef('run', runId)}`,
      now: requestedAt,
    });
    const jobId = buildCumulativeStudentJobId(runId, candidate.userId, generation);
    await queue.add(
      'cumulative-attainment-full-rebuild',
      { userId: candidate.userId, fullRebuild: true, rebuildGeneration: generation },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        jobId,
        ...JOB_HISTORY_OPTIONS,
      },
    );
    requested.push({ ...candidate, generation, requestedAt, jobId });
  }
  return requested;
}

async function allRequestedPortraitsCompleted(
  db: BackfillDb,
  queue: Pick<Queue<StudentSnapshotJob>, 'getJob'>,
  requested: RequestedCandidate[],
  now: Date,
): Promise<'complete' | 'pending' | 'failed'> {
  const userIds = requested.map((candidate) => candidate.userId);
  const portraits = await readLatestValidNativePortraitV2Snapshots(db, userIds, 'admin', { now });
  for (const candidate of requested) {
    const generation = await readLearningMaterializationGeneration(db, candidate.userId);
    if (generation !== candidate.generation) return 'failed';
    const request = await db.learningMaterializationRebuildRequest.findUnique({
      where: { userId: candidate.userId },
      select: { generation: true },
    });
    if (request) {
      const queuedJob = await queue.getJob(candidate.jobId);
      if (queuedJob && await queuedJob.getState() === 'failed') return 'failed';
      return 'pending';
    }
    const queuedJob = await queue.getJob(candidate.jobId);
    const queuedJobState = queuedJob ? await queuedJob.getState() : null;
    if (queuedJobState === 'failed') return 'failed';
    if (queuedJobState === 'completed') continue;
    const portrait = portraits.get(candidate.userId);
    if (portrait
      && hasPortraitV2Evidence(portrait)
      && Date.parse(portrait.generatedAt) >= candidate.requestedAt.getTime()) {
      continue;
    }
    const compatibilityState = await db.studentCompetencySnapshot.findFirst({
      where: { userId: candidate.userId, snapshotAt: { gte: candidate.requestedAt } },
      orderBy: { snapshotAt: 'desc' },
      select: { factCount: true, evidenceSummary: true, snapshotAt: true },
    });
    const derivationState = compatibilityState?.evidenceSummary?._derivation?.state;
    if (compatibilityState?.factCount === 0
      && derivationState === 'no-evidence-after-revocation') {
      continue;
    }
    return queuedJobState === 'active' || queuedJobState === 'waiting' || queuedJobState === 'delayed'
      ? 'pending'
      : 'failed';
  }
  return 'complete';
}

export async function waitForRequestedPortraits(
  db: BackfillDb,
  queue: Pick<Queue<StudentSnapshotJob>, 'getJob'>,
  requested: RequestedCandidate[],
  options: { timeoutMs?: number; pollMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? WAIT_TIMEOUT_MS;
  const pollMs = options.pollMs ?? WAIT_POLL_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await allRequestedPortraitsCompleted(db, queue, requested, new Date());
    if (state === 'complete') return;
    if (state === 'failed' || Date.now() >= deadline) throw new Error(`learner-rebuild-${state}`);
    await sleep(pollMs);
  }
}

async function enqueueCurrentCumulativeClasses(
  db: BackfillDb,
  queue: Pick<Queue<ClassSnapshotJob>, 'add'>,
  requested: RequestedCandidate[],
  runId: string,
): Promise<RequestedClass[]> {
  const profiles = await db.studentProfile.findMany({
    where: { userId: { in: requested.map((candidate) => candidate.userId) }, classId: { not: null } },
    orderBy: { classId: 'asc' },
    select: { classId: true },
  });
  const classIds: string[] = [...new Set((profiles as Array<{ classId: string | null }>)
    .flatMap((profile) => profile.classId ? [profile.classId] : []))];
  const generations = requested.map((candidate) => candidate.generation);
  const runRef = opaqueRef('run', runId);
  const classRequests: RequestedClass[] = [];
  for (const classId of classIds) {
    const requestedAt = new Date();
    const jobId = buildCumulativeClassJobId(runId, classId, generations);
    await queue.add(
      'cumulative-class-snapshot',
      { classId, scope: 'cumulative', requestedAfter: requestedAt.toISOString(), runRef },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 15_000 },
        jobId,
        ...JOB_HISTORY_OPTIONS,
      },
    );
    classRequests.push({ classId, jobId, requestedAt, runRef });
  }
  return classRequests;
}

async function allRequestedClassesCompleted(
  db: BackfillDb,
  queue: Pick<Queue<ClassSnapshotJob>, 'getJob'>,
  requested: RequestedClass[],
): Promise<'complete' | 'pending' | 'failed'> {
  for (const target of requested) {
    const job = await queue.getJob(target.jobId);
    const state = job ? await job.getState() : null;
    if (state === 'failed') return 'failed';
    const returnedSnapshotId = typeof job?.returnvalue?.snapshotId === 'string'
      ? job.returnvalue.snapshotId
      : undefined;
    const snapshotWhere = {
      classId: target.classId,
      materializationVersion: 'class-competency.cumulative.v1',
      snapshotAt: { gte: target.requestedAt },
    };
    const readSnapshot = (snapshotId?: string, runRef?: string) => db.classCompetencySnapshot.findFirst({
      where: {
        ...(snapshotId ? { id: snapshotId } : {}),
        ...snapshotWhere,
        ...(runRef ? {
          aggregateJson: { path: ['_materialization', 'runRef'], equals: runRef },
        } : {}),
      },
      orderBy: { snapshotAt: 'desc' },
      select: { id: true, aggregateJson: true },
    });
    let snapshot = await readSnapshot(returnedSnapshotId);
    if (snapshot?.aggregateJson?._materialization?.runRef !== target.runRef) {
      snapshot = await readSnapshot(undefined, target.runRef);
    }
    const marker = snapshot?.aggregateJson?._materialization;
    if (marker?.runRef === target.runRef) continue;
    if (state === 'completed') return 'failed';
    return 'pending';
  }
  return 'complete';
}

export async function waitForRequestedClasses(
  db: BackfillDb,
  queue: Pick<Queue<ClassSnapshotJob>, 'getJob'>,
  requested: RequestedClass[],
  options: { timeoutMs?: number; pollMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? WAIT_TIMEOUT_MS;
  const pollMs = options.pollMs ?? WAIT_POLL_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await allRequestedClassesCompleted(db, queue, requested);
    if (state === 'complete') return;
    if (state === 'failed' || Date.now() >= deadline) throw new Error(`class-rebuild-${state}`);
    await sleep(pollMs);
  }
}

export async function runCumulativeBackfill(
  db: BackfillDb,
  queues: {
    student: Pick<Queue<StudentSnapshotJob>, 'add' | 'getJob'>;
    class: Pick<Queue<ClassSnapshotJob>, 'add' | 'getJob'>;
  },
  options: CumulativeBackfillOptions,
  runtime: {
    waitOptions?: Parameters<typeof waitForRequestedPortraits>[3];
    classWaitOptions?: Parameters<typeof waitForRequestedClasses>[3];
  } = {},
): Promise<Record<string, number | string>> {
  if (options.apply && !options.wait) throw new Error('apply-requires-wait');
  const inventory = await inventoryCumulativeBackfill(db, options.limit);
  const baseResult = {
    mode: options.apply ? 'apply' : 'dry-run',
    candidateCount: inventory.candidates.length,
    selectedCount: inventory.selected.length,
    currentClassCount: inventory.currentClassCount,
    noEvidenceCount: inventory.noEvidenceCount,
  };
  if (!options.apply) return baseResult;
  const runId = options.runId!;
  const requested = await requestAndEnqueueStudents(db, queues.student, inventory.selected, runId);
  await waitForRequestedPortraits(db, queues.student, requested, runtime.waitOptions);
  const requestedClasses = await enqueueCurrentCumulativeClasses(db, queues.class, requested, runId);
  await waitForRequestedClasses(db, queues.class, requestedClasses, runtime.classWaitOptions);
  return { ...baseResult, learnerJobsEnqueued: requested.length, classJobsEnqueued: requestedClasses.length };
}

async function main() {
  const options = parseCumulativeBackfillArgs(process.argv.slice(2));
  const db = createPrismaClient();
  let redis: Redis | null = null;
  let studentQueue: Queue<StudentSnapshotJob> | null = null;
  let classQueue: Queue<ClassSnapshotJob> | null = null;
  try {
    if (!options.apply) {
      const result = await runCumulativeBackfill(db, { student: null as never, class: null as never }, options);
      console.log(JSON.stringify(result));
      return;
    }
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    studentQueue = new Queue<StudentSnapshotJob>('snapshot-student', { connection: redis });
    classQueue = new Queue<ClassSnapshotJob>('snapshot-class', { connection: redis });
    const result = await runCumulativeBackfill(db, { student: studentQueue, class: classQueue }, options);
    console.log(JSON.stringify({ ...result, runRef: opaqueRef('run', options.runId!) }));
  } finally {
    await studentQueue?.close();
    await classQueue?.close();
    await redis?.quit();
    await db.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : '';
    const code = [
      'apply-requires-stable-run-id',
      'apply-requires-wait',
      'limit-must-be-a-positive-integer',
      'learner-rebuild-pending',
      'learner-rebuild-failed',
      'class-rebuild-pending',
      'class-rebuild-failed',
    ].includes(message) ? message : 'operation-failed';
    console.error(JSON.stringify({ status: 'failed', code }));
    process.exitCode = 1;
  });
}
