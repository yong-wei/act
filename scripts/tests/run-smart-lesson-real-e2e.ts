import 'dotenv/config';

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import process from 'node:process';

import Redis from 'ioredis';
import { Pool } from 'pg';
import type { Worker } from 'bullmq';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { assertCleanSourceRevision } from './smart-lesson-source-revision';

const resumedSchemaName = argumentValue('--resume-schema');
const schemaName = resumedSchemaName ?? `smart_lesson939_e2e_${process.pid}_${randomBytes(4).toString('hex')}`;
const redisPrefix = `smart-lesson939-e2e-${process.pid}-${randomBytes(4).toString('hex')}`;
let teacherId = `smart-lesson-real-e2e-teacher-${process.pid}`;
const courseBasisId = `smart-lesson-real-basis-${process.pid}`;
const documentId = `smart-lesson-real-document-${process.pid}`;
const versionId = `smart-lesson-real-version-${process.pid}`;
const segmentId = `smart-lesson-real-segment-${process.pid}`;
let realProviderTopic = `闭环稳定性真实提供商验收 ${process.pid}`;
const baseDatabaseUrl = process.env.SMART_LESSON_TEST_DATABASE_BASE_URL ?? process.env.DATABASE_URL;
const redisUrl = process.env.SMART_LESSON_TEST_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const nextAuthSecret = `smart-lesson-real-e2e-secret-${randomBytes(24).toString('hex')}`;
const publicationReviewSecret = `smart-courseware-review-${randomBytes(24).toString('hex')}`;
const coursewareOrderingSecret = `smart-courseware-ordering-${randomBytes(24).toString('hex')}`;
const realProviderMode = process.argv.includes('--real-provider');
const resumeMode = resumedSchemaName !== undefined;
let nextServer: ChildProcess | undefined;
let coursewareWorkerConnection: Redis | undefined;
let smartLessonWorkerConnection: Redis | undefined;
let coursewareWorker: Worker | undefined;
let smartLessonWorker: Worker | undefined;
let scopedDatabaseUrl = '';
let cleanupPromise: Promise<void> | undefined;
let shutdownPromise: Promise<never> | undefined;
let sourceRevision = '';

installShutdownHandlers();

async function main() {
  sourceRevision = assertCleanSourceRevision();
  if (!baseDatabaseUrl) throw new Error('smart-lesson-test-database-required');
  assertTemporarySchema(schemaName);

  try {
    scopedDatabaseUrl = resumeMode
      ? scopedDatabaseUrlFor(schemaName)
      : await createIsolatedDatabase();
    process.env.DATABASE_URL = scopedDatabaseUrl;
    process.env.REDIS_URL = redisUrl;
    process.env.SMART_LESSON_REDIS_PREFIX = redisPrefix;
    process.env.SMART_COURSEWARE_REDIS_PREFIX = redisPrefix;
    if (realProviderMode) {
      delete process.env.SMART_LESSON_E2E_FIXTURE_TOKEN;
      if (!process.env.AI_API_KEY?.trim()) throw new Error('smart-lesson-real-provider-api-key-required');
    } else {
      process.env.SMART_LESSON_E2E_FIXTURE_TOKEN = 'smart-lesson-real-browser-v1';
    }
    process.env.SMART_COURSEWARE_E2E_FIXTURE_TOKEN = 'smart-courseware-real-browser-v1';
    deployMigrations();
    if (resumeMode) await loadResumedAcceptanceData();
    else await seedAcceptanceData();
    coursewareWorkerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const { ensureCoursewareGenerationWorker } = await import('../../src/lib/smart-courseware/worker');
    coursewareWorker = await ensureCoursewareGenerationWorker(coursewareWorkerConnection);
    smartLessonWorkerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const { ensureSmartLessonGenerationWorker } = await import('../../src/lib/smart-lesson-plan/worker');
    smartLessonWorker = await ensureSmartLessonGenerationWorker(smartLessonWorkerConnection);

    const port = await availablePort();
    const baseURL = `http://127.0.0.1:${port}`;
    nextServer = spawn(process.execPath, ['./node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DATABASE_URL: scopedDatabaseUrl,
      REDIS_URL: redisUrl,
      SMART_LESSON_REDIS_PREFIX: redisPrefix,
      SMART_COURSEWARE_REDIS_PREFIX: redisPrefix,
      ...(realProviderMode ? {} : { SMART_LESSON_E2E_FIXTURE_TOKEN: 'smart-lesson-real-browser-v1' }),
      SMART_COURSEWARE_E2E_FIXTURE_TOKEN: 'smart-courseware-real-browser-v1',
      NEXTAUTH_SECRET: nextAuthSecret,
      NEXTAUTH_URL: baseURL,
      SMART_COURSEWARE_PUBLICATION_REVIEW_BASE_URL: baseURL,
      SMART_COURSEWARE_PUBLICATION_REVIEW_SECRET: publicationReviewSecret,
      SMART_COURSEWARE_ORDERING_SECRET: coursewareOrderingSecret,
    },
  });
    nextServer.stdout?.on('data', (chunk) => process.stdout.write(`[smart-lesson-next] ${chunk}`));
    nextServer.stderr?.on('data', (chunk) => process.stderr.write(`[smart-lesson-next] ${chunk}`));
    await waitForServer(`${baseURL}/api/auth/session`, nextServer);

    const playwrightExitCode = await runPlaywright({
      env: {
      ...process.env,
      DATABASE_URL: scopedDatabaseUrl,
      REDIS_URL: redisUrl,
      SMART_LESSON_REDIS_PREFIX: redisPrefix,
      SMART_COURSEWARE_REDIS_PREFIX: redisPrefix,
      ...(realProviderMode ? {} : { SMART_LESSON_E2E_FIXTURE_TOKEN: 'smart-lesson-real-browser-v1' }),
      SMART_COURSEWARE_E2E_FIXTURE_TOKEN: 'smart-courseware-real-browser-v1',
      SMART_LESSON_E2E_BASE_URL: baseURL,
      SMART_LESSON_E2E_TEACHER_ID: teacherId,
      SMART_LESSON_E2E_TOPIC: realProviderTopic,
      SMART_LESSON_E2E_SOURCE_REVISION: sourceRevision,
      SMART_LESSON_REAL_PROVIDER_REQUIRED: realProviderMode ? '1' : undefined,
      SMART_LESSON_E2E_SPEC: realProviderMode
        ? resumeMode
          ? 'smart-lesson-real-provider-retry.spec.ts'
          : 'smart-lesson-real-provider.spec.ts'
        : 'smart-lesson-plan-real-e2e.spec.ts',
      NEXTAUTH_SECRET: nextAuthSecret,
      NEXTAUTH_URL: baseURL,
      SMART_COURSEWARE_PUBLICATION_REVIEW_BASE_URL: baseURL,
      SMART_COURSEWARE_PUBLICATION_REVIEW_SECRET: publicationReviewSecret,
      SMART_COURSEWARE_ORDERING_SECRET: coursewareOrderingSecret,
      },
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    if (playwrightExitCode !== 0) process.exitCode = playwrightExitCode;
    else console.log(JSON.stringify({
      evidence: 'smart-lesson-real-browser-e2e',
      schema: schemaName,
      redisPrefix,
      server: baseURL,
      routeInterception: false,
      providerMode: realProviderMode ? 'configured-real-provider' : 'deterministic-fixture',
      result: 'passed',
    }));
  } finally {
    await cleanup();
  }
}

async function runPlaywright(options: { cwd: string; env: NodeJS.ProcessEnv; stdio: 'inherit' }) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn('npx', ['playwright', 'test', '--config', 'playwright.smart-lesson-real.config.ts'], options);
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

void main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

async function createIsolatedDatabase() {
  const admin = new URL(baseDatabaseUrl!);
  admin.searchParams.delete('schema');
  const pool = new Pool({ connectionString: admin.toString() });
  try {
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
  } finally {
    await pool.end();
  }
  const scoped = new URL(admin.toString());
  scoped.searchParams.set('schema', schemaName);
  return scoped.toString();
}

function scopedDatabaseUrlFor(schema: string) {
  const scoped = new URL(baseDatabaseUrl!);
  scoped.searchParams.set('schema', schema);
  return scoped.toString();
}

async function loadResumedAcceptanceData() {
  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const task = await prisma.smartLessonTask.findFirst({
      include: {
        drafts: {
          include: {
            jobs: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    const job = task?.drafts[0]?.jobs[0];
    if (!task || !job || job.state !== 'RETRYABLE') {
      throw new Error('smart-lesson-resume-retryable-job-required');
    }
    teacherId = task.ownerId;
    realProviderTopic = task.topic;
    process.env.SMART_LESSON_E2E_JOB_ID = job.id;
  } finally {
    await prisma.$disconnect();
  }
}

function deployMigrations() {
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: scopedDatabaseUrl },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('smart-lesson-migration-deploy-failed');
}

async function seedAcceptanceData() {
  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    await prisma.user.create({
      data: { id: teacherId, email: 'smart-lesson-real-e2e@example.test', name: '智能教案真实验收教师', role: 'TEACHER' },
    });
    await prisma.courseBasis.create({
      data: {
        id: courseBasisId,
        ownerId: teacherId,
        courseIdentity: 'AUTO-CONTROL',
        title: '自动控制原理',
        documents: {
          create: {
            id: documentId,
            title: '课程标准',
            kind: 'STANDARD',
            versions: {
              create: {
                id: versionId,
                versionNumber: 1,
                sourceType: 'PLAIN_TEXT',
                sourceName: '课程标准.txt',
                mimeType: 'text/plain',
                byteSize: 84,
                contentHash: 'a'.repeat(64),
                originalContent: Buffer.from('闭环系统稳定性判据、特征方程、劳斯判据与稳定裕度。'),
                normalizedText: '闭环系统稳定性判据、特征方程、劳斯判据与稳定裕度。',
                extractionState: 'EXTRACTED',
                extractionVersion: 'real-provider-e2e.v1',
                reviewState: 'CONFIRMED',
                reviewedById: teacherId,
                reviewedAt: new Date(),
                segments: {
                  create: {
                    id: segmentId,
                    orderIndex: 0,
                    stableAnchor: 'chapter-1-stability',
                    headingPath: ['闭环系统稳定性'],
                    paragraphNumber: 1,
                    text: '闭环系统稳定性判据、特征方程、劳斯判据与稳定裕度。',
                    contentHash: 'b'.repeat(64),
                  },
                },
              },
            },
          },
        },
      },
    });
    const corpusSourceId = `teacher-course-basis:${courseBasisId}:${versionId}:chapter-1-stability`;
    await prisma.courseBasisProjection.create({
      data: {
        versionId,
        segmentId,
        projectionKey: `course-basis-projection:${versionId}:chapter-1-stability`,
        corpusSourceId,
      },
    });
    if (realProviderMode) {
      const binding = {
        citationId: `course-basis:${versionId}:chapter-1-stability`,
        sourceVersionId: versionId,
        anchor: 'chapter-1-stability',
        contentHash: 'b'.repeat(64),
      };
      const { createSmartLessonTask } = await import('../../src/lib/smart-lesson-plan/service');
      const created = await createSmartLessonTask(prisma, {
        actor: { id: teacherId, role: 'TEACHER' },
        courseBasisId,
        topic: realProviderTopic,
        audience: '自动化专业本科生',
        prerequisites: '传递函数与特征方程',
        durationMinutes: 30,
        outlineConfirmationRequired: true,
        sourceVersionIds: [versionId],
        knowledgePoints: [{
          title: '闭环稳定性判据',
          content: '闭环稳定性判据',
          origin: 'TEACHER_CREATED',
          sourceState: 'teacher_created_source_pending',
          sourceBindings: [binding],
        }],
        goals: [{
          content: '能够依据特征方程判断闭环系统稳定性',
          sourceState: 'teacher_created_source_pending',
          sourceBindings: [binding],
          standardsMappings: [],
        }],
        confirmScope: true,
        confirmGoals: true,
      });
      const verified = await prisma.smartLessonTask.findUniqueOrThrow({
        where: { id: created.id },
        include: { knowledgePoints: true, goals: true },
      });
      if (!verified.knowledgePoints.every((item) => item.sourceState === 'VERIFIED')
        || !verified.goals.every((item) => item.sourceState === 'VERIFIED')) {
        throw new Error('smart-lesson-real-provider-source-verification-required');
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function availablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(url: string, child: ChildProcess) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`smart-lesson-next-exited:${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('smart-lesson-next-readiness-timeout');
}

async function cleanup() {
  cleanupPromise ??= cleanupResources();
  return cleanupPromise;
}

async function cleanupResources() {
  const errors: unknown[] = [];
  await coursewareWorker?.close(true).catch((error) => errors.push(error));
  await smartLessonWorker?.close(true).catch((error) => errors.push(error));
  await coursewareWorkerConnection?.quit().catch((error) => errors.push(error));
  await smartLessonWorkerConnection?.quit().catch((error) => errors.push(error));
  if (nextServer?.pid) {
    try { process.kill(-nextServer.pid, 'SIGTERM'); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
    try { process.kill(-nextServer.pid, 'SIGKILL'); } catch {}
  }

  const redis = new Redis(redisUrl, {
    connectTimeout: 2_000,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  try {
    await redis.connect();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${redisPrefix}:*`, 'COUNT', 500);
      cursor = nextCursor;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  } catch (error) {
    errors.push(error);
  } finally {
    await redis.quit().catch(() => undefined);
  }

  if (baseDatabaseUrl && !resumeMode) {
    const admin = new URL(baseDatabaseUrl);
    admin.searchParams.delete('schema');
    const pool = new Pool({ connectionString: admin.toString() });
    try {
      assertTemporarySchema(schemaName);
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } catch (error) {
      errors.push(error);
    } finally {
      await pool.end();
    }
  }

  if (errors.length) throw new AggregateError(errors, 'smart-lesson-e2e-cleanup-failed');
}

function installShutdownHandlers() {
  const shutdown = (exitCode: number, error?: unknown) => {
    if (error) console.error(error);
    shutdownPromise ??= cleanup()
      .catch((cleanupError) => console.error(cleanupError))
      .then(() => process.exit(exitCode));
    return shutdownPromise;
  };

  process.once('SIGINT', () => void shutdown(130));
  process.once('SIGTERM', () => void shutdown(143));
  process.once('SIGHUP', () => void shutdown(129));
  process.once('uncaughtException', (error) => void shutdown(1, error));
  process.once('unhandledRejection', (error) => void shutdown(1, error));
}

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1]?.trim();
  if (!value) throw new Error(`${name.slice(2)}-required`);
  return value;
}

function assertTemporarySchema(value: string) {
  if (!/^smart_lesson939_e2e_[a-zA-Z0-9_]+$/.test(value) || value === 'public') {
    throw new Error('unsafe-smart-lesson-e2e-schema');
  }
}
