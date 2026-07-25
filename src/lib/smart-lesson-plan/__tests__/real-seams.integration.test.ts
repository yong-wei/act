import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';

import { createPrismaClient } from '@/lib/prisma-client';

import { enqueueSmartLessonGenerationJob } from '../queue';
import { deleteSmartLessonTask } from '../lifecycle';
import {
  cancelGenerationJob,
  createSmartLessonTask,
  resumeGenerationJob,
  startGenerationJob,
  updateSmartLessonTask,
} from '../service';
import { SMART_LESSON_GENERATION_QUEUE } from '../worker';

const enabled = process.env.SMART_LESSON_REAL_SEAM_TEST === '1';
const schemaName = `smart_lesson939_it_${process.pid}_${randomBytes(4).toString('hex')}`;
const actor = { id: `smart-lesson-teacher-${process.pid}`, role: 'TEACHER' as const };
const redisUrl = process.env.SMART_LESSON_TEST_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

let adminUrl = '';
let courseBasisId = '';
let sourceVersionId = '';
let redis: Redis;
let prisma!: ReturnType<typeof createPrismaClient>;

describe.runIf(enabled)('smart lesson real PostgreSQL and BullMQ seams', () => {
  beforeAll(async () => {
    const baseUrl = process.env.SMART_LESSON_TEST_DATABASE_BASE_URL ?? process.env.DATABASE_URL;
    if (!baseUrl) throw new Error('smart-lesson-test-database-required');
    assertTemporarySchema(schemaName);

    const admin = new URL(baseUrl);
    admin.searchParams.delete('schema');
    adminUrl = admin.toString();
    const scoped = new URL(adminUrl);
    scoped.searchParams.set('schema', schemaName);

    const pool = new Pool({ connectionString: adminUrl });
    try {
      await pool.query(`CREATE SCHEMA "${schemaName}"`);
      process.env.DATABASE_URL = scoped.toString();
      execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'pipe',
      });
      prisma = createPrismaClient({ log: ['warn', 'error'] });
    } catch (error) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      throw error;
    } finally {
      await pool.end();
    }

    redis = new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
    await redis.ping();

    await prisma.user.create({ data: { id: actor.id, role: 'TEACHER', name: 'Smart Lesson seam teacher' } });
    const basis = await prisma.courseBasis.create({
      data: {
        ownerId: actor.id,
        courseIdentity: `smart-lesson-seam-${process.pid}`,
        title: '控制系统设计',
        documents: {
          create: {
            title: '课程标准',
            kind: 'STANDARD',
            versions: {
              create: {
                versionNumber: 1,
                sourceType: 'PLAIN_TEXT',
                sourceName: 'seam-test.txt',
                mimeType: 'text/plain',
                byteSize: 12,
                contentHash: 'a'.repeat(64),
                originalContent: Buffer.from('seam fixture'),
                normalizedText: '闭环稳定性与稳定判据',
                extractionState: 'EXTRACTED',
                extractionVersion: 'seam-v1',
                reviewState: 'CONFIRMED',
                reviewedById: actor.id,
                reviewedAt: new Date(),
              },
            },
          },
        },
      },
      include: { documents: { include: { versions: true } } },
    });
    courseBasisId = basis.id;
    sourceVersionId = basis.documents[0].versions[0].id;
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await redis?.quit().catch(() => undefined);
    if (!adminUrl) return;
    assertTemporarySchema(schemaName);
    const pool = new Pool({ connectionString: adminUrl });
    try {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await pool.end();
    }
  });

  it('applies the real migration and preserves one active generation job under concurrent starts', async () => {
    const applied = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      WHERE migration_name = '20260719180000_add_smart_lesson_plan_core'
    `;
    expect(applied).toEqual([{ migration_name: '20260719180000_add_smart_lesson_plan_core', finished_at: expect.any(Date) }]);

    const task = await createTask('single-active-job');
    const draftId = task.drafts[0].id;
    const results = await Promise.all([
      startGenerationJob(prisma, { actor, draftId, idempotencyKey: 'real-start-left-0001' }),
      startGenerationJob(prisma, { actor, draftId, idempotencyKey: 'real-start-right-0001' }),
    ]);

    expect(results[0].id).toBe(results[1].id);
    expect(await prisma.smartLessonGenerationJob.count({ where: { draftId } })).toBe(1);
    expect(await prisma.smartLessonGenerationJob.count({ where: { draftId, activeIdentity: `draft:${draftId}` } })).toBe(1);
  });

  it('allows only one concurrent expectedRevision update', async () => {
    const task = await createTask('expected-revision');
    const update = (suffix: string) => updateSmartLessonTask(prisma, {
      actor,
      taskId: task.id,
      expectedRevision: task.revision,
      confirmingTurnId: `real-turn-${suffix}`,
      topic: `闭环稳定性 ${suffix}`,
      audience: task.audience,
      prerequisites: task.prerequisites,
      durationMinutes: task.durationMinutes,
      outlineConfirmationRequired: task.outlineConfirmationRequired,
      sourceVersionIds: [sourceVersionId],
      confirmScope: true,
      confirmGoals: true,
      knowledgePoints: task.knowledgePoints.map((point) => ({
        id: point.id,
        content: point.title,
        title: point.title,
        origin: 'TEACHER_CREATED' as const,
        sourceState: 'TEACHER_CREATED_SOURCE_PENDING' as const,
        sourceBindings: [],
      })),
      goals: task.goals.map((goal) => ({
        id: goal.id,
        content: goal.content,
        origin: 'TEACHER_CREATED' as const,
        sourceState: 'TEACHER_CREATED_SOURCE_PENDING' as const,
        sourceBindings: [],
      })),
    });

    const results = await Promise.allSettled([update('left'), update('right')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: 'task-revision-conflict', status: 409 });
    expect(await prisma.smartLessonTask.findUniqueOrThrow({ where: { id: task.id }, select: { revision: true } }))
      .toEqual({ revision: task.revision + 1 });
    expect(await prisma.agentToolRun.count({ where: { toolName: 'smart_lesson_task_confirm', correlationId: { in: ['real-turn-left', 'real-turn-right'] } } }))
      .toBe(1);
  });

  it('redelivers with a new deliveryGeneration when cancellation happens before and after BullMQ claim', async () => {
    await verifyCancellationRedelivery('before-claim');
    await verifyCancellationRedelivery('after-claim');
  }, 30_000);

  it('deletes an unpublished approved lesson and courseware graph through the fenced transaction', async () => {
    const task = await createTask('lifecycle-delete');
    const approvedDraft = task.drafts[0];
    const lessonRevision = await prisma.smartLessonRevision.create({
      data: {
        ownerId: actor.id,
        taskId: task.id,
        draftId: approvedDraft.id,
        revisionNumber: 1,
        displayName: '教案第1版',
        content: { topic: task.topic },
        contentHash: 'lesson-content-hash',
        sourcesSnapshot: [],
        knowledgeSnapshot: [],
        goalsSnapshot: [],
        provenanceSnapshot: {},
        approvalIdempotencyKey: `approval-${task.id}`,
        approvalRequestHash: 'lesson-approval-request',
        approvedById: actor.id,
      },
    });
    await prisma.smartLessonDraft.create({
      data: {
        ownerId: actor.id,
        taskId: task.id,
        basedOnRevisionId: lessonRevision.id,
        content: { topic: task.topic },
        contentHash: 'derived-content-hash',
      },
    });
    const coursewareDraft = await prisma.smartCoursewareDraft.create({
      data: {
        ownerId: actor.id,
        planRevisionId: lessonRevision.id,
        planRevisionNumber: 1,
        planContentHash: lessonRevision.contentHash,
        state: 'ACCEPTED',
        creationIdempotencyKey: `courseware-${task.id}`,
        creationRequestHash: 'courseware-request-hash',
      },
    });
    const coursewareModule = await prisma.smartCoursewareModule.create({
      data: {
        ownerId: actor.id,
        draftId: coursewareDraft.id,
        runtimeModuleId: 'module-1',
        activeIdentity: `${coursewareDraft.id}:module-1`,
        contentHash: 'module-content-hash',
        sourceState: 'TEACHER_CREATED_SOURCE_PENDING',
        sourceBindings: [],
        sourceBindingSetHash: 'module-binding-hash',
        gapIdentity: `module-gap:${coursewareDraft.id}`,
        provenance: 'TEACHER_CREATED',
      },
    });
    await prisma.smartCoursewareModuleRevision.create({
      data: {
        ownerId: actor.id,
        moduleRecordId: coursewareModule.id,
        revisionNumber: 1,
        changeKind: 'CREATE',
        runtimeModuleSnapshot: { type: 'text' },
        teacherMetadataSnapshot: {},
        contentHash: coursewareModule.contentHash,
        sourceState: coursewareModule.sourceState,
        sourceBindings: [],
        sourceBindingSetHash: coursewareModule.sourceBindingSetHash,
        gapIdentity: coursewareModule.gapIdentity,
        provenance: coursewareModule.provenance,
        actorId: actor.id,
      },
    });
    const coursewareRevision = await prisma.smartCoursewareRevision.create({
      data: {
        ownerId: actor.id,
        draftId: coursewareDraft.id,
        planRevisionId: lessonRevision.id,
        planRevisionNumber: 1,
        planContentHash: lessonRevision.contentHash,
        manifestSnapshot: {},
        manifestHash: 'manifest-hash',
        moduleMetadataSnapshot: {},
        moduleMetadataHash: 'module-metadata-hash',
        gapsSnapshot: [],
        provenanceSnapshot: {},
        validationSnapshot: {},
        contentHash: 'courseware-content-hash',
        approvalIdempotencyKey: `courseware-approval-${task.id}`,
        approvalRequestHash: 'courseware-approval-request',
        approvedById: actor.id,
      },
    });
    await prisma.smartCoursewarePublicationReceipt.create({
      data: {
        ownerId: actor.id,
        sourceRevisionId: coursewareRevision.id,
        kind: 'STATIC',
        contentHash: coursewareRevision.contentHash,
        validatorVersion: 'test.v1',
        profileHash: 'profile-hash',
        completedById: actor.id,
      },
    });
    const [trigger] = await prisma.$queryRaw<Array<{ definition: string }>>`
      SELECT pg_get_functiondef(trigger.tgfoid) AS definition
      FROM pg_trigger trigger
      JOIN pg_class relation ON relation.oid = trigger.tgrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE relation.relname = 'SmartCoursewarePublicationReceipt'
        AND namespace.nspname = ${schemaName}
        AND NOT trigger.tgisinternal
    `;
    expect(trigger.definition).toContain("current_setting('app.smart_lesson_task_delete', true)");

    await expect(deleteSmartLessonTask(prisma, { actor, taskId: task.id })).resolves.toEqual({
      deleted: true,
      blockers: [],
    });
    expect(await prisma.smartLessonTask.findUnique({ where: { id: task.id } })).toBeNull();
    expect(await prisma.smartLessonRevision.count({ where: { taskId: task.id } })).toBe(0);
    expect(await prisma.smartCoursewareDraft.count({ where: { id: coursewareDraft.id } })).toBe(0);
  });
});

async function createTask(label: string) {
  return createSmartLessonTask(prisma, {
    actor,
    courseBasisId,
    topic: `闭环稳定性 ${label}`,
    audience: '自动化专业本科生',
    prerequisites: '复数与传递函数',
    durationMinutes: 45,
    sourceVersionIds: [sourceVersionId],
    confirmScope: true,
    confirmGoals: true,
    knowledgePoints: [{
      content: '稳定性判据',
      origin: 'TEACHER_CREATED',
      sourceState: 'TEACHER_CREATED_SOURCE_PENDING',
      sourceBindings: [],
    }],
    goals: [{
      content: '判断闭环系统稳定性',
      origin: 'TEACHER_CREATED',
      sourceState: 'TEACHER_CREATED_SOURCE_PENDING',
      sourceBindings: [],
    }],
  });
}

async function verifyCancellationRedelivery(timing: 'before-claim' | 'after-claim') {
  const task = await createTask(`bullmq-${timing}`);
  const draftId = task.drafts[0].id;
  const durable = await startGenerationJob(prisma, {
    actor,
    draftId,
    idempotencyKey: `real-${timing}-start-0001`,
  });
  const prefix = `${schemaName}-${timing}`;
  const queue = new Queue<{ jobId: string }>(SMART_LESSON_GENERATION_QUEUE, { connection: redis, prefix });
  const processed: string[] = [];
  let releaseClaim: (() => void) | undefined;
  let claimed: Promise<void> | undefined;
  let worker: Worker<{ jobId: string }> | undefined;

  try {
    const first = await enqueueSmartLessonGenerationJob(prisma, durable.id, queue);
    expect(first).toMatchObject({ queued: true, job: { deliveryGeneration: 1 } });
    const firstQueueId = queueJobId(durable.id, 1);
    expect(await queue.getJob(firstQueueId)).not.toBeNull();

    if (timing === 'after-claim') {
      let signalClaim: (() => void) | undefined;
      claimed = new Promise<void>((resolve) => { signalClaim = resolve; });
      const hold = new Promise<void>((resolve) => { releaseClaim = resolve; });
      worker = new Worker<{ jobId: string }>(SMART_LESSON_GENERATION_QUEUE, async (job) => {
        processed.push(job.id ?? 'missing-id');
        signalClaim?.();
        await hold;
      }, { connection: redis.duplicate({ maxRetriesPerRequest: null }), prefix });
      await worker.waitUntilReady();
      await claimed;
    }

    await cancelGenerationJob(prisma, {
      actor,
      jobId: durable.id,
      idempotencyKey: `real-${timing}-cancel-0001`,
    });
    releaseClaim?.();
    if (worker) await waitUntil(async () => (await queue.getJob(firstQueueId))?.isCompleted() ?? false);

    const resumed = await resumeGenerationJob(prisma, {
      actor,
      jobId: durable.id,
      idempotencyKey: `real-${timing}-resume-0001`,
    }) as { deliveryGeneration: number };
    expect(resumed.deliveryGeneration).toBe(2);
    const second = await enqueueSmartLessonGenerationJob(prisma, durable.id, queue);
    expect(second).toMatchObject({ queued: true, job: { deliveryGeneration: 2 } });
    const secondQueueId = queueJobId(durable.id, 2);
    expect(secondQueueId).not.toBe(firstQueueId);
    expect(await queue.getJob(secondQueueId)).not.toBeNull();

    if (!worker) {
      worker = new Worker<{ jobId: string }>(SMART_LESSON_GENERATION_QUEUE, async (job) => {
        processed.push(job.id ?? 'missing-id');
      }, { connection: redis.duplicate({ maxRetriesPerRequest: null }), prefix });
      await worker.waitUntilReady();
    }
    await waitUntil(() => Promise.resolve(processed.includes(secondQueueId)));
    expect(processed).toContain(firstQueueId);
    expect(processed).toContain(secondQueueId);
  } finally {
    releaseClaim?.();
    await worker?.close(true).catch(() => undefined);
    await queue.obliterate({ force: true }).catch(() => undefined);
    await queue.close();
  }
}

function queueJobId(jobId: string, deliveryGeneration: number) {
  return `smart-lesson-${jobId}-OUTLINE-${deliveryGeneration}`;
}

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('smart-lesson-seam-timeout');
}

function assertTemporarySchema(value: string) {
  if (!/^smart_lesson939_it_[a-zA-Z0-9_]+$/.test(value) || value === 'public') {
    throw new Error('unsafe-smart-lesson-test-schema');
  }
}
