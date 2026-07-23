import 'dotenv/config';

import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { Queue, QueueEvents, Worker } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';

const adminDatabaseUrl = process.env.CUMULATIVE_ATTAINMENT_TEST_DATABASE_ADMIN_URL;
const redisUrl = process.env.CUMULATIVE_ATTAINMENT_TEST_REDIS_URL;
if (!adminDatabaseUrl) throw new Error('CUMULATIVE_ATTAINMENT_TEST_DATABASE_ADMIN_URL is required');
if (!redisUrl) throw new Error('CUMULATIVE_ATTAINMENT_TEST_REDIS_URL is required');

const nonce = `${process.pid}_${randomBytes(5).toString('hex')}`;
const databaseName = `cumulative_attainment_e2e_${nonce}`;
const queuePrefix = `cumulative-attainment-e2e-${nonce}`;
const studentQueueName = 'snapshot-student';
const classQueueName = 'snapshot-class';
const runId = `integration-${nonce}`;
const teacherId = `teacher-${nonce}`;
const classId = `class-${nonce}`;
const studentIds = [`student-a-${nonce}`, `student-b-${nonce}`];
const noEvidenceStudentId = `student-no-evidence-${nonce}`;

let scopedDatabaseUrl = '';
let db: any;
let redis: Redis | undefined;
let studentQueue: Queue | undefined;
let classQueue: Queue | undefined;
let studentEvents: QueueEvents | undefined;
let classEvents: QueueEvents | undefined;
let studentWorker: Worker | undefined;
let classWorker: Worker | undefined;

async function main() {
  assertSafeAdminUrl(adminDatabaseUrl!);
  assertTemporaryDatabase(databaseName);
  try {
    scopedDatabaseUrl = await createDatabase();
    process.env.DATABASE_URL = scopedDatabaseUrl;
    process.env.REDIS_URL = redisUrl;
    deployMigrations();

    const [{ createPrismaClient }, workerModule, backfillModule, portraitModule, portraitConsumerModule, materializationModule] = await Promise.all([
      import('../../src/lib/prisma-client'),
      import('../workers/data-governance-worker'),
      import('../db/backfill-cumulative-attainment'),
      import('../../src/lib/data-governance/portrait-v2-model'),
      import('../../src/lib/data-governance/portrait-v2-consumer'),
      import('../../src/lib/data-governance/derived-learning-materialization'),
    ]);
    db = createPrismaClient({ log: ['warn', 'error'] });
    await seedFixtures();

    redis = new Redis(redisUrl!, { maxRetriesPerRequest: null });
    await redis.ping();
    const connection = redis;
    const queueOptions = { connection, prefix: queuePrefix };
    studentQueue = new Queue(studentQueueName, queueOptions);
    classQueue = new Queue(classQueueName, queueOptions);
    studentEvents = new QueueEvents(studentQueueName, queueOptions);
    classEvents = new QueueEvents(classQueueName, queueOptions);
    await Promise.all([studentEvents.waitUntilReady(), classEvents.waitUntilReady()]);

    workerModule.configureDataGovernanceWorkerForTest({
      db,
      studentJobQueue: studentQueue,
      classJobQueue: classQueue,
    });
    let injectedRetry = false;
    studentWorker = new Worker(studentQueueName, async (job) => {
      if (!injectedRetry && job.data.userId === studentIds[0]) {
        injectedRetry = true;
        throw new Error('intentional-integration-retry');
      }
      return workerModule.processStudentSnapshotJob(job);
    }, { ...queueOptions, concurrency: 2 });
    classWorker = new Worker(classQueueName, workerModule.processClassSnapshotJob, queueOptions);

    const preexistingGeneration = await materializationModule.requestLearningMaterializationRebuild(db, {
      userId: studentIds[0], classIds: ['obsolete-class'], reason: 'integration-pre-fence',
    });
    assert(preexistingGeneration === 1, 'preexisting generation must be 1');

    const result = await backfillModule.runCumulativeBackfill(
      db,
      { student: studentQueue, class: classQueue },
      { apply: true, runId, wait: true, limit: null },
      { waitOptions: { timeoutMs: 90_000, pollMs: 100 } },
    );
    assert(result.candidateCount === 2, 'historical candidate count must exclude no-evidence learner');
    assert(result.learnerJobsEnqueued === 2, 'two fenced learner jobs must be enqueued');
    assert(result.classJobsEnqueued === 1, 'class work must follow learner completion');

    const firstJob = await studentQueue.getJob(backfillModule.buildCumulativeStudentJobId(runId, studentIds[0], 2));
    assert(firstJob !== undefined, 'generation-2 fenced job must exist');
    await firstJob.waitUntilFinished(studentEvents, 30_000);
    assert(firstJob.attemptsMade === 2, 'worker must recover through a real BullMQ retry');
    const secondGeneration = await materializationModule.readLearningMaterializationGeneration(db, studentIds[1]);
    assert(secondGeneration === 1, 'independent learner generation must be 1');

    const classJobId = backfillModule.buildCumulativeClassJobId(runId, classId, [2, 1]);
    const classJob = await classQueue.getJob(classJobId);
    assert(classJob !== undefined, 'cumulative class job must exist');
    await classJob.waitUntilFinished(classEvents, 30_000);

    const personalRead = await portraitModule.readLatestValidNativePortraitV2Snapshots(
      db, studentIds, 'student', { now: new Date() },
    );
    assert(personalRead.size === 2, 'personal portrait read must return both native portraits');
    for (const studentId of studentIds) {
      const portrait = personalRead.get(studentId);
      assert(portrait && portraitConsumerModule.hasPortraitV2Evidence(portrait), `portrait must contain evidence for ${studentId}`);
    }
    const noEvidenceRead = await portraitModule.readLatestValidNativePortraitV2Snapshots(
      db, [noEvidenceStudentId], 'student', { now: new Date() },
    );
    assert(noEvidenceRead.size === 0, 'no-evidence learner must not receive a fabricated portrait');

    const teacherRead = await db.classCompetencySnapshot.findFirst({
      where: { classId, materializationVersion: 'class-competency.cumulative.v1' },
      orderBy: { snapshotAt: 'desc' },
    });
    assert(teacherRead?.activeStudentCount === 2, 'teacher cumulative read must cover two evidence-bearing learners');
    assert(teacherRead?.totalStudentCount === 3, 'teacher cumulative read must retain the complete current roster');
    assert(teacherRead?.aggregateJson?.scope === 'cumulative', 'teacher read must use cumulative scope');
    const recentCount = await db.classCompetencySnapshot.count({
      where: { classId, materializationVersion: 'class-competency.v2' },
    });
    assert(recentCount === 0, 'cumulative class job must not write the recent snapshot version');

    console.log(JSON.stringify({
      result: 'passed', database: databaseName, queuePrefix,
      candidateCount: result.candidateCount, retryAttempts: firstJob.attemptsMade,
      personalPortraits: personalRead.size, cumulativeRoster: teacherRead.totalStudentCount,
    }));
  } finally {
    await cleanup();
  }
}

async function seedFixtures() {
  await db.user.create({ data: { id: teacherId, email: `${teacherId}@example.test`, role: 'TEACHER' } });
  await db.class.create({ data: { id: classId, code: `E2E${nonce}`.slice(0, 30), name: '累计达成集成测试班', teacherId } });
  for (const studentId of [...studentIds, noEvidenceStudentId]) {
    await db.user.create({ data: { id: studentId, email: `${studentId}@example.test`, role: 'STUDENT' } });
    await db.studentProfile.create({ data: { userId: studentId, classId } });
  }
  const historicalAt = new Date('2025-01-15T08:00:00.000Z');
  for (const [index, studentId] of studentIds.entries()) {
    await db.learningFact.create({ data: {
      id: `historical-fact-${index}-${nonce}`, userId: studentId, factType: 'question',
      moduleId: 'historical-control-modeling', startedAt: historicalAt, outcome: 'success', score: 0.8,
      competencyContribution: { controlModeling: 0.8 }, contextJson: { rubricWeight: 1 },
      createdAt: historicalAt,
    } });
  }
}

async function createDatabase() {
  const admin = new URL(adminDatabaseUrl!);
  admin.searchParams.delete('schema');
  const pool = new Pool({ connectionString: admin.toString() });
  try { await pool.query(`CREATE DATABASE "${databaseName}"`); } finally { await pool.end(); }
  const target = new URL(admin.toString());
  target.pathname = `/${databaseName}`;
  target.searchParams.delete('schema');
  return target.toString();
}

function deployMigrations() {
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: scopedDatabaseUrl }, stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('cumulative-attainment-migration-deploy-failed');
}

async function cleanup() {
  const errors: unknown[] = [];
  for (const resource of [studentWorker, classWorker, studentEvents, classEvents, studentQueue, classQueue]) {
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
    } catch (error) { errors.push(error); }
    await redis.quit().catch((error: unknown) => errors.push(error));
  }
  if (adminDatabaseUrl) {
    const admin = new URL(adminDatabaseUrl); admin.searchParams.delete('schema');
    const pool = new Pool({ connectionString: admin.toString() });
    try {
      assertTemporaryDatabase(databaseName);
      await pool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    }
    catch (error) { errors.push(error); }
    finally { await pool.end(); }
  }
  if (errors.length) throw new AggregateError(errors, 'cumulative-attainment-integration-cleanup-failed');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertSafeAdminUrl(value: string) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('test database URL must be PostgreSQL');
  if (url.searchParams.has('schema')) throw new Error('admin test database URL must not select a schema');
}

function assertTemporaryDatabase(value: string) {
  if (!/^cumulative_attainment_e2e_[A-Za-z0-9_]+$/.test(value) || value === 'public') {
    throw new Error('unsafe cumulative attainment test database');
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
