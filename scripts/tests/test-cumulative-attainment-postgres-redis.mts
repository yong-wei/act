import 'dotenv/config';

import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';

const adminDatabaseUrl = process.env.CUMULATIVE_ATTAINMENT_TEST_DATABASE_ADMIN_URL;
const redisUrl = process.env.CUMULATIVE_ATTAINMENT_TEST_REDIS_URL;

const nonce = `${process.pid}_${randomBytes(5).toString('hex')}`;
const databaseName = `cumulative_attainment_e2e_${nonce}`;
const queuePrefix = `cumulative-attainment-e2e-${nonce}`;
const studentQueueName = 'snapshot-student';
const classQueueName = 'snapshot-class';
const planRunId = `integration-plan-${nonce}`;
const applyRunId = `integration-apply-${nonce}`;
const teacherId = `teacher-${nonce}`;
const classId = `class-${nonce}`;
const studentIds = [`student-a-${nonce}`, `student-b-${nonce}`];
const noFactStudentId = `student-no-fact-${nonce}`;
const oldStudentJobId = `old-student-${nonce}`;

let scopedDatabaseUrl = '';
let db: any;
let redis: Redis | undefined;
let studentQueue: Queue | undefined;
let classQueue: Queue | undefined;
let activeAdminDatabaseUrl = '';
let ephemeralPostgresRoot: string | undefined;
let ephemeralPostgresDataDir: string | undefined;
let ephemeralPgCtl: string | undefined;
let ephemeralPostgresStarted = false;

async function main() {
  if (!adminDatabaseUrl || !redisUrl) {
    console.log(JSON.stringify({
      result: 'skipped',
      reason: 'CUMULATIVE_ATTAINMENT_TEST_DATABASE_ADMIN_URL and CUMULATIVE_ATTAINMENT_TEST_REDIS_URL are required',
    }));
    return;
  }
  assertSafeAdminUrl(adminDatabaseUrl!);
  assertTemporaryDatabase(databaseName);
  try {
    scopedDatabaseUrl = await createDatabase();
    process.env.DATABASE_URL = scopedDatabaseUrl;
    process.env.REDIS_URL = redisUrl;
    deployMigrations();

    const [{ createPrismaClient }, backfillModule, readModelModule, materializationModule] = await Promise.all([
      import('../../src/lib/prisma-client'),
      import('../db/backfill-cumulative-attainment'),
      import('../../src/lib/data-governance/cumulative-portrait-read-model'),
      import('../../src/lib/data-governance/portrait-v2-materialization'),
    ]);
    db = createPrismaClient({ log: ['warn', 'error'] });
    await seedFixtures();

    redis = new Redis(redisUrl!, { maxRetriesPerRequest: null });
    await redis.ping();
    const connection = redis;
    const queueOptions = { connection, prefix: queuePrefix };
    studentQueue = new Queue(studentQueueName, queueOptions);
    classQueue = new Queue(classQueueName, queueOptions);
    await Promise.all([studentQueue.waitUntilReady(), classQueue.waitUntilReady()]);
    await studentQueue.add('superseded-student-materialization', {
      userId: studentIds[0],
      calculationVersion: 'legacy-learner-snapshot.v0',
    }, {
      jobId: oldStudentJobId,
    });
    const legacyClassSnapshotCount = await db.classCompetencySnapshot.count({ where: { classId } });

    const dryRun = await backfillModule.runCumulativeBackfill(
      db,
      { student: studentQueue, class: classQueue },
      {
        mode: 'dry-run',
        runId: planRunId,
        planRunId: null,
        expectedInputDigest: null,
        resume: false,
        wait: false,
        limit: null,
      },
    );
    assert(dryRun.candidateCount === 2, 'historical candidate count must exclude the no-fact learner');
    assert(dryRun.currentClassCount === 1, 'dry run must inventory the current class');
    assert(dryRun.noFactCount === 1, 'dry run must account for the no-fact learner');
    assert(typeof dryRun.inputDigest === 'string' && dryRun.inputDigest.length === 64, 'dry run must return a stable input digest');
    const persistedPlan = await db.cumulativePortraitMigrationRun.findUnique({ where: { id: planRunId } });
    assert(persistedPlan?.inputDigest === dryRun.inputDigest, 'dry run must persist its plan digest');
    assert(await db.learnerPortraitCurrentState.count() === 0, 'dry run must not materialize learner state');
    assert(await db.classCumulativePortraitVersion.count() === 0, 'dry run must not materialize class state');
    assert(await studentQueue.getJob(oldStudentJobId), 'dry run must retain the superseded student job');

    let injectedFailure = false;
    await expectFailure(
      backfillModule.runCumulativeBackfill(
        db,
        { student: studentQueue, class: classQueue },
        {
          mode: 'apply',
          runId: applyRunId,
          planRunId,
          expectedInputDigest: dryRun.inputDigest,
          resume: false,
          wait: true,
          limit: null,
        },
        {
          materializeLearner: async (...args: any[]) => {
            if (!injectedFailure) {
              injectedFailure = true;
              throw new Error('intentional-stopped-service-materialization-failure');
            }
            return materializationModule.materializeIncrementalPortraitV2(...args);
          },
        },
      ),
      'intentional-stopped-service-materialization-failure',
    );
    const interruptedRun = await db.cumulativePortraitMigrationRun.findUnique({ where: { id: applyRunId } });
    assert(interruptedRun?.status === 'RUNNING', 'failed direct materialization must leave a resumable run');
    assert(await studentQueue.getJob(oldStudentJobId) === undefined, 'apply must invalidate the superseded student job');

    const result = await backfillModule.runCumulativeBackfill(
      db,
      { student: studentQueue, class: classQueue },
      {
        mode: 'apply',
        runId: applyRunId,
        planRunId,
        expectedInputDigest: dryRun.inputDigest,
        resume: true,
        wait: true,
        limit: null,
      },
    );
    assert(result.candidateCount === 2, 'resumed apply must complete both historical learners');
    assert(result.classCount === 1, 'resumed apply must directly materialize the current class');
    assert(result.queueJobsEnqueued === 0, 'stopped-service apply must not enqueue replacement work');

    const verified = await backfillModule.runCumulativeBackfill(
      db,
      { student: studentQueue, class: classQueue },
      {
        mode: 'verify',
        runId: applyRunId,
        planRunId: null,
        expectedInputDigest: null,
        resume: false,
        wait: false,
        limit: null,
      },
    );
    assert(verified.verificationDigest === result.verificationDigest, 'verify must reproduce the apply verification digest');

    for (const studentId of studentIds) {
      const portrait = await readModelModule.readCurrentCumulativePortrait(db, studentId);
      assert(portrait.stateKind === 'SNAPSHOT', `historical facts must produce a cumulative portrait for ${studentId}`);
      assert(portrait.availabilityReason === 'available' && portrait.payload, `cumulative portrait must be readable for ${studentId}`);
    }
    const noFactRead = await readModelModule.readCurrentCumulativePortrait(db, noFactStudentId);
    assert(noFactRead.stateKind === 'UNAVAILABLE', 'no-fact learner must not receive a fabricated portrait');
    assert(noFactRead.payload === null, 'no-fact learner must not expose a portrait payload');

    const classRead = await readModelModule.readCurrentCumulativeClassPortrait(db, classId);
    assert(classRead.stateKind === 'SNAPSHOT', 'current roster must have a cumulative class projection');
    assert(classRead.activeStudentCount === 2, 'class projection must cover two evidence-bearing learners');
    assert(classRead.totalStudentCount === 3, 'class projection must retain the complete current roster');
    assert(
      await db.classCompetencySnapshot.count({ where: { classId } }) === legacyClassSnapshotCount,
      'direct cumulative materialization must not write legacy ClassCompetencySnapshot rows',
    );

    console.log(JSON.stringify({
      result: 'passed', database: databaseName, queuePrefix,
      candidateCount: result.candidateCount,
      resumedAfterFailure: injectedFailure,
      personalPortraits: studentIds.length,
      cumulativeRoster: classRead.totalStudentCount,
    }));
  } finally {
    await cleanup();
  }
}

async function seedFixtures() {
  await db.user.create({ data: { id: teacherId, email: `${teacherId}@example.test`, role: 'TEACHER' } });
  await db.class.create({ data: { id: classId, code: `E2E${nonce}`.slice(0, 30), name: '累计达成集成测试班', teacherId } });
  for (const studentId of [...studentIds, noFactStudentId]) {
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
  activeAdminDatabaseUrl = admin.toString();
  const pool = new Pool({ connectionString: admin.toString() });
  try {
    await pool.query(`CREATE DATABASE "${databaseName}"`);
  } catch (error) {
    if ((error as { code?: string }).code !== '42501') throw error;
    await startEphemeralPostgres();
    const ephemeralPool = new Pool({ connectionString: activeAdminDatabaseUrl });
    try {
      await ephemeralPool.query(`CREATE DATABASE "${databaseName}"`);
    } finally {
      await ephemeralPool.end();
    }
    const target = new URL(activeAdminDatabaseUrl);
    target.pathname = `/${databaseName}`;
    return target.toString();
  } finally {
    await pool.end();
  }
  const target = new URL(activeAdminDatabaseUrl);
  target.pathname = `/${databaseName}`;
  return target.toString();
}

async function startEphemeralPostgres() {
  ephemeralPostgresRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cumulative-attainment-e2e-'));
  const bindir = spawnSync('pg_config', ['--bindir'], { encoding: 'utf8' });
  assert(bindir.status === 0, bindir.stderr || bindir.stdout || 'pg_config --bindir failed');
  const postgresBin = bindir.stdout.trim();
  const initdb = path.join(postgresBin, 'initdb');
  ephemeralPgCtl = path.join(postgresBin, 'pg_ctl');
  ephemeralPostgresDataDir = path.join(ephemeralPostgresRoot, 'postgres-data');
  const initialized = spawnSync(initdb, [
    '-D', ephemeralPostgresDataDir,
    '--auth=trust',
    '--username=postgres',
    '--no-locale',
  ], { encoding: 'utf8' });
  assert(initialized.status === 0, initialized.stderr || initialized.stdout || 'initdb failed');
  const port = await availablePort();
  const started = spawnSync(ephemeralPgCtl, [
    '-D', ephemeralPostgresDataDir,
    '-l', path.join(ephemeralPostgresRoot, 'postgres.log'),
    '-o', `-p ${port} -h 127.0.0.1`,
    '-w',
    'start',
  ], { encoding: 'utf8' });
  assert(started.status === 0, started.stderr || started.stdout || 'ephemeral PostgreSQL start failed');
  ephemeralPostgresStarted = true;
  activeAdminDatabaseUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`;
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

function deployMigrations() {
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: scopedDatabaseUrl }, stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('cumulative-attainment-migration-deploy-failed');
}

async function cleanup() {
  const errors: unknown[] = [];
  for (const resource of [studentQueue, classQueue]) {
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
  if (activeAdminDatabaseUrl) {
    const pool = new Pool({ connectionString: activeAdminDatabaseUrl });
    try {
      assertTemporaryDatabase(databaseName);
      await pool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    }
    catch (error) { errors.push(error); }
    finally { await pool.end(); }
  }
  if (ephemeralPostgresStarted && ephemeralPgCtl && ephemeralPostgresDataDir) {
    const stopped = spawnSync(ephemeralPgCtl, [
      '-D', ephemeralPostgresDataDir,
      '-m', 'fast',
      '-w',
      'stop',
    ], { encoding: 'utf8' });
    if (stopped.status !== 0) errors.push(new Error(stopped.stderr || stopped.stdout || 'ephemeral PostgreSQL stop failed'));
  }
  if (ephemeralPostgresRoot) {
    try {
      fs.rmSync(ephemeralPostgresRoot, { recursive: true, force: true });
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, 'cumulative-attainment-integration-cleanup-failed');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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
