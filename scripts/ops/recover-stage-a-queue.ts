import 'dotenv/config';

import { Queue } from 'bullmq';
import Redis from 'ioredis';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { recoverMathDocumentGradingQueue } from '../../src/lib/data-governance/math-document-grading-queue';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const queue = new Queue('math-document-grading', { connection: redis });

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const now = new Date();
  const requestedIds = (process.env.STAGE_A_RECOVERY_JOB_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const jobs = await prisma.gradingJob.findMany({
    where: {
      kind: 'RERUN',
      batch: { assignmentRevisionId: revision.id },
      ...(requestedIds.length > 0 ? { id: { in: requestedIds } } : { state: 'RUNNING', workerLeaseExpiresAt: { lte: now } }),
    },
    select: { id: true, state: true, workerLeaseExpiresAt: true, batchItemId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (jobs.length === 0) {
    console.log(JSON.stringify({ scope: 'stage-a:T2S-20', revisionId: revision.id, candidates: [], recovery: { scanned: 0, queued: 0, failed: 0 }, after: [] }));
    return;
  }
  const result = await recoverMathDocumentGradingQueue({
    db: prisma,
    jobIds: jobs.map((job) => job.id),
    now,
    limit: jobs.length,
    queue,
  });
  const after = await prisma.gradingJob.findMany({
    where: { id: { in: jobs.map((job) => job.id) } },
    select: { id: true, state: true, lastErrorCode: true, workerClaimToken: true, workerLeaseExpiresAt: true, batchItemId: true },
  });
  console.log(JSON.stringify({ scope: 'stage-a:T2S-20', revisionId: revision.id, candidates: jobs, recovery: result, after }));
}

void main().finally(async () => {
  await queue.close().catch(() => undefined);
  await redis.quit().catch(() => undefined);
  await prisma.$disconnect();
});
