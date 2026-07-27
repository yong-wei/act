import 'dotenv/config';

import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';

const nonce = `${process.pid}_${randomBytes(5).toString('hex')}`;
const postgresContainer = `act-1029-postgres-${nonce.replaceAll('_', '-')}`;
const redisContainer = `act-1029-redis-${nonce.replaceAll('_', '-')}`;
const queuePrefix = `act-1029-${nonce}`;
const databaseName = 'act_1029_e2e';
const postgresPassword = `act1029_${randomBytes(12).toString('hex')}`;
const studentQueueName = 'snapshot-student';
const classQueueName = 'snapshot-class';
const teacherId = `teacher-${nonce}`;
const classId = `class-${nonce}`;
const studentA = `student-a-${nonce}`;
const studentB = `student-b-${nonce}`;
const noFactStudent = `student-no-fact-${nonce}`;

let databaseUrl = '';
let redisUrl = '';
let db: any;
let redis: Redis | undefined;
let studentQueue: Queue | undefined;
let classQueue: Queue | undefined;
let studentWorker: Worker | undefined;
let classWorker: Worker | undefined;
const workerFailures: Array<{ queue: string; jobId: string | undefined; message: string }> = [];

async function main() {
  const postgresPort = await availablePort();
  const redisPort = await availablePort();
  startContainers(postgresPort, redisPort);
  databaseUrl =
    `postgresql://postgres:${postgresPassword}@127.0.0.1:${postgresPort}/${databaseName}`;
  redisUrl = `redis://127.0.0.1:${redisPort}`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.REDIS_URL = redisUrl;

  try {
    await waitForPostgres(databaseUrl);
    await waitForRedis(redisUrl);
    deployMigrations();

    const [
      { createPrismaClient },
      backfill,
      historical,
      readModel,
      catalog,
      workerModule,
    ] = await Promise.all([
      import('../../src/lib/prisma-client'),
      import('../db/backfill-cumulative-attainment'),
      import('../../src/lib/data-governance/simulation-task-historical-application'),
      import('../../src/lib/data-governance/cumulative-portrait-read-model'),
      import('../../src/lib/data-governance/simulation-task-catalog'),
      import('../workers/data-governance-worker'),
    ]);
    db = createPrismaClient({ log: ['warn', 'error'] });
    await seedFixtures();

    redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const connection = redis;
    const queueOptions = { connection, prefix: queuePrefix };
    studentQueue = new Queue(studentQueueName, queueOptions);
    classQueue = new Queue(classQueueName, queueOptions);
    await Promise.all([studentQueue.waitUntilReady(), classQueue.waitUntilReady()]);

    const baselinePlan = await backfill.runCumulativeBackfill(
      db,
      { student: studentQueue, class: classQueue },
      {
        mode: 'dry-run',
        runId: `baseline-plan-${nonce}`,
        planRunId: null,
        expectedInputDigest: null,
        resume: false,
        wait: false,
        limit: null,
      },
    );
    await backfill.runCumulativeBackfill(
      db,
      { student: studentQueue, class: classQueue },
      {
        mode: 'apply',
        runId: `baseline-apply-${nonce}`,
        planRunId: `baseline-plan-${nonce}`,
        expectedInputDigest: baselinePlan.inputDigest,
        resume: false,
        wait: true,
        limit: null,
      },
    );

    const plan = historical.buildHistoricalSimulationTaskPlan({
      generatedAt: '2026-07-25T00:00:00.000Z',
      catalogVersion: 'simulation-task-catalog.v1',
      totalRecords: 3,
      candidates: [0, 1, 2].map((index) => ({
        recordId: `SimulationRun:historical-${index}-${nonce}`,
        taskKey: catalog.GENERIC_VIRTUAL_SIMULATION_TASK_KEY,
        source: 'virtual-simulation',
        artifactKey: `historical-run-${index}-${nonce}`,
        tier: 'run',
        semanticFingerprint: `historical-run-${index}-${nonce}|||`,
        occurredAt: `2026-07-2${index + 1}T08:00:00.000Z`,
        userId: studentA,
      })),
      skips: [],
      affectedStudents: 1,
      candidateCountByTask: {
        [catalog.GENERIC_VIRTUAL_SIMULATION_TASK_KEY]: 3,
      },
      skipCountByReason: {},
    });

    const beforeTamper = await db.learningFact.count({ where: { userId: studentA } });
    const tampered = structuredClone(plan);
    tampered.candidates[0].userId = studentB;
    await expectFailure(
      historical.applyHistoricalSimulationTaskPlan(db, {
        plan: tampered,
        expectedPlanDigest: plan.planDigest,
      }),
      'historical-simulation-task-candidate-tamper',
    );
    assert(
      await db.learningFact.count({ where: { userId: studentA } }) === beforeTamper,
      'tampered plan must not write facts',
    );

    const firstApply = await historical.applyHistoricalSimulationTaskPlan(db, {
      plan,
      expectedPlanDigest: plan.planDigest,
    });
    const duplicateApply = await historical.applyHistoricalSimulationTaskPlan(db, {
      plan,
      expectedPlanDigest: plan.planDigest,
    });
    assert(firstApply.created === 3, 'first historical apply must create three run facts');
    assert(duplicateApply.created === 0, 'duplicate historical apply must be idempotent');

    workerModule.configureDataGovernanceWorkerForTest({
      db,
      studentJobQueue: studentQueue,
      classJobQueue: classQueue,
    });
    studentWorker = new Worker(
      studentQueueName,
      workerModule.processStudentSnapshotJob,
      { connection, prefix: queuePrefix, concurrency: 1 },
    );
    classWorker = new Worker(
      classQueueName,
      workerModule.processClassSnapshotJob,
      { connection, prefix: queuePrefix, concurrency: 1 },
    );
    studentWorker.on('failed', (job, error) => {
      workerFailures.push({ queue: studentQueueName, jobId: job?.id, message: error.message });
    });
    classWorker.on('failed', (job, error) => {
      workerFailures.push({ queue: classQueueName, jobId: job?.id, message: error.message });
    });
    await Promise.all([studentWorker.waitUntilReady(), classWorker.waitUntilReady()]);

    // Change the learner input after the request was written. The formal handler must
    // reject the stale expected digest and create a new durable generation.
    await db.learningFact.create({
      data: {
        id: `drift-fact-${nonce}`,
        userId: studentA,
        factType: 'question',
        moduleId: 'issue-1029-drift',
        startedAt: new Date('2026-07-24T10:00:00.000Z'),
        outcome: 'success',
        score: 0.9,
        competencyContribution: { controlModeling: 0.9 },
        contextJson: { rubricWeight: 1 },
      },
    });
    const staleGeneration = duplicateApply.targetGenerations[0].generation;
    await studentQueue.add(
      'issue-1029-coordinator-drift',
      { coordinator: true },
      { jobId: `coordinator-drift-${nonce}` },
    );
    const driftedRequest = await waitForRequest((request) =>
      request.generation > staleGeneration && request.status === 'PENDING');
    assert(
      driftedRequest.reason === 'simulation-task-input-drift',
      'worker must requeue an expected-input digest drift',
    );

    await studentQueue.add(
      'issue-1029-coordinator-retry',
      { coordinator: true },
      { jobId: `coordinator-retry-${nonce}` },
    );
    await waitForRequest((request) =>
      request.generation === driftedRequest.generation && request.status === 'COMPLETED');
    await waitForQueuesIdle();

    const publishedTaskCount = catalog.getPublishedTaskKeys().length;
    const studentRead = await readModel.readCurrentCumulativePortrait(db, studentA, 'student');
    const teacherRead = await readModel.readCurrentCumulativePortrait(db, studentA, 'reviewer');
    if (studentRead.stateKind !== 'SNAPSHOT' || !studentRead.payload) {
      throw new Error(`personal cumulative portrait diagnostic: ${stringifyDiagnostic({
        studentRead,
        currentState: await db.learnerPortraitCurrentState.findUnique({
          where: { userId: studentA },
          include: { stateVersion: true },
        }),
        request: await db.learningMaterializationRebuildRequest.findUnique({
          where: { userId: studentA },
        }),
        workerFailures,
      })}`);
    }
    const studentTask = taskAttainment(studentRead);
    const teacherTask = taskAttainment(teacherRead);
    const expectedTaskScore = Math.round((100 / publishedTaskCount) * 100) / 100;
    const expectedClassMeanScore =
      Math.round((100 / publishedTaskCount) * 10_000) / 10_000;
    assert(studentTask.completedTaskCount === 1, 'student must have one completed task');
    assert(studentTask.relatedTaskCount === publishedTaskCount, 'student denominator must match current catalog');
    assert(
      studentTask.score === expectedTaskScore,
      'student task ratio must use the current catalog denominator',
    );
    assert(
      JSON.stringify(studentTask) === JSON.stringify(teacherTask),
      'authorized teacher and student reads must expose the same bounded task projection',
    );

    const classRead = await readModel.readCurrentCumulativeClassPortrait(db, classId);
    assert(classRead.stateKind === 'SNAPSHOT', 'current roster class projection must be readable');
    assert(classRead.totalStudentCount === 3, 'class projection must retain the current roster');
    assert(classRead.activeStudentCount === 2, 'class projection must retain two evidence-bearing learners');
    assert(classRead.aggregate?.taskAttainment.usableMemberCount === 1,
      'class task coverage must include one available task projection');
    assert(classRead.aggregate?.taskAttainment.rosterTotal === 3,
      'class task coverage denominator must use the current roster');
    assert(classRead.aggregate?.taskAttainment.meanScore === expectedClassMeanScore,
      'class task mean must equal the available learner task ratio');

    const taskFactCount = await countHistoricalTaskFacts();
    const postCompletionApply = await historical.applyHistoricalSimulationTaskPlan(db, {
      plan,
      expectedPlanDigest: plan.planDigest,
    });
    assert(postCompletionApply.created === 0, 'post-completion plan apply must remain idempotent');
    await studentQueue.add(
      'issue-1029-coordinator-repeat',
      { coordinator: true },
      { jobId: `coordinator-repeat-${nonce}` },
    );
    await waitForRequest((request) =>
      request.generation === postCompletionApply.targetGenerations[0].generation &&
      request.status === 'COMPLETED');
    await waitForQueuesIdle();
    const repeatedRead = await readModel.readCurrentCumulativePortrait(db, studentA, 'student');
    assert(taskAttainment(repeatedRead).completedTaskCount === 1,
      'repeated execution must not duplicate task contribution');
    assert(await countHistoricalTaskFacts() === taskFactCount,
      'repeated execution must not duplicate historical facts');

    console.log(JSON.stringify({
      result: 'passed',
      postgresContainer,
      redisContainer,
      queuePrefix,
      planCreated: firstApply.created,
      duplicateCreated: duplicateApply.created,
      driftGeneration: driftedRequest.generation,
      completedTaskCount: studentTask.completedTaskCount,
      relatedTaskCount: studentTask.relatedTaskCount,
      classCoverage: {
        available: classRead.aggregate?.taskAttainment.usableMemberCount,
        roster: classRead.aggregate?.taskAttainment.rosterTotal,
      },
    }));
  } finally {
    await cleanup();
  }
}

async function seedFixtures() {
  await db.user.create({ data: { id: teacherId, email: `${teacherId}@example.test`, role: 'TEACHER' } });
  await db.class.create({ data: { id: classId, code: `I1029${nonce}`.slice(0, 30), name: 'Issue 1029 集成班', teacherId } });
  for (const studentId of [studentA, studentB, noFactStudent]) {
    await db.user.create({ data: { id: studentId, email: `${studentId}@example.test`, role: 'STUDENT' } });
    await db.studentProfile.create({ data: { userId: studentId, classId } });
  }
  for (const [index, studentId] of [studentA, studentB].entries()) {
    await db.learningFact.create({
      data: {
        id: `baseline-fact-${index}-${nonce}`,
        userId: studentId,
        factType: 'question',
        moduleId: 'issue-1029-baseline',
        startedAt: new Date('2026-07-20T08:00:00.000Z'),
        outcome: 'success',
        score: 0.8,
        competencyContribution: { controlModeling: 0.8 },
        contextJson: { rubricWeight: 1 },
      },
    });
  }
}

function taskAttainment(read: any) {
  assert(
    read.stateKind === 'SNAPSHOT' && read.payload,
    `personal cumulative portrait must be readable: ${JSON.stringify(read)}`,
  );
  const value = read.payload.dimensions.find((dimension: any) =>
    dimension.id === 'simulationValidationEvidence')?.taskAttainment;
  assert(value?.state === 'EVIDENCE', 'personal portrait must expose available task attainment');
  return value;
}

async function countHistoricalTaskFacts() {
  return db.learningFact.count({
    where: {
      userId: studentA,
      sourceLogId: { startsWith: 'SimulationRun:historical-' },
    },
  });
}

async function waitForRequest(predicate: (request: any) => boolean) {
  const deadline = Date.now() + 45_000;
  let lastRequest: any = null;
  while (Date.now() < deadline) {
    const request = await db.learningMaterializationRebuildRequest.findUnique({
      where: { userId: studentA },
    });
    lastRequest = request;
    if (request && predicate(request)) return request;
    await delay(100);
  }
  throw new Error(
    `timed out waiting for learner reconciliation request: ${JSON.stringify({
      generation: lastRequest?.generation,
      status: lastRequest?.status,
      reason: lastRequest?.reason,
      lastErrorCode: lastRequest?.lastErrorCode,
      simulationTaskInput: lastRequest?.simulationTaskInput,
      workerFailures,
    })}`,
  );
}

async function waitForQueuesIdle() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const [studentCounts, classCounts] = await Promise.all([
      studentQueue!.getJobCounts('active', 'waiting', 'delayed'),
      classQueue!.getJobCounts('active', 'waiting', 'delayed'),
    ]);
    if (
      studentCounts.active + studentCounts.waiting + studentCounts.delayed === 0 &&
      classCounts.active + classCounts.waiting + classCounts.delayed === 0
    ) return;
    await delay(100);
  }
  throw new Error('timed out waiting for BullMQ queues to become idle');
}

function startContainers(postgresPort: number, redisPort: number) {
  runDocker([
    'run', '-d', '--name', postgresContainer,
    '-e', `POSTGRES_PASSWORD=${postgresPassword}`,
    '-e', `POSTGRES_DB=${databaseName}`,
    '-p', `127.0.0.1:${postgresPort}:5432`,
    'postgres:16-alpine',
  ]);
  try {
    runDocker([
      'run', '-d', '--name', redisContainer,
      '-p', `127.0.0.1:${redisPort}:6379`,
      'redis:7-alpine',
    ]);
  } catch (error) {
    removeContainer(postgresContainer);
    throw error;
  }
}

function runDocker(args: string[]) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `docker ${args[0]} failed`);
}

async function waitForPostgres(url: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const pool = new Pool({ connectionString: url });
    try {
      await pool.query('SELECT 1');
      await pool.end();
      return;
    } catch {
      await pool.end().catch(() => undefined);
      await delay(200);
    }
  }
  throw new Error('temporary PostgreSQL did not become ready');
}

async function waitForRedis(url: string) {
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  const deadline = Date.now() + 30_000;
  try {
    while (Date.now() < deadline) {
      try {
        await client.connect();
        await client.ping();
        return;
      } catch {
        client.disconnect();
        await delay(200);
      }
    }
  } finally {
    client.disconnect();
  }
  throw new Error('temporary Redis did not become ready');
}

function deployMigrations() {
  const generated = spawnSync('npx', ['prisma', 'generate'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  if (generated.status !== 0) throw new Error('issue-1029-prisma-generate-failed');
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('issue-1029-migration-deploy-failed');
}

async function cleanup() {
  const errors: unknown[] = [];
  for (const resource of [studentWorker, classWorker, studentQueue, classQueue]) {
    if (resource) await resource.close().catch((error: unknown) => errors.push(error));
  }
  await db?.$disconnect().catch((error: unknown) => errors.push(error));
  if (redis) {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `${queuePrefix}:*`, 'COUNT', 500);
        cursor = next;
        if (keys.length) await redis.del(...keys);
      } while (cursor !== '0');
    } catch (error) {
      errors.push(error);
    }
    await redis.quit().catch((error: unknown) => errors.push(error));
  }
  for (const name of [redisContainer, postgresContainer]) {
    try {
      removeContainer(name);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, 'issue-1029-integration-cleanup-failed');
}

function removeContainer(name: string) {
  const result = spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' });
  if (result.status !== 0 && !result.stderr.includes('No such container')) {
    throw new Error(result.stderr || result.stdout || `failed to remove ${name}`);
  }
}

function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function expectFailure(promise: Promise<unknown>, message: string) {
  try {
    await promise;
  } catch (error) {
    assert(error instanceof Error && error.message === message, `expected ${message}`);
    return;
  }
  throw new Error(`expected ${message}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringifyDiagnostic(value: unknown) {
  return JSON.stringify(value, (_key, entry) =>
    typeof entry === 'bigint' ? entry.toString() : entry);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
