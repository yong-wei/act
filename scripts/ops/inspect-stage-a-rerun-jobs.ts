import 'dotenv/config';

import { createHash } from 'node:crypto';

import { createPrismaClient } from '../../src/lib/prisma-client';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const anonymous = (value: string | null) => value ? createHash('sha256').update(value).digest('hex').slice(0, 12) : null;

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const batch = await prisma.gradingBatch.findFirstOrThrow({
    where: { assignmentRevisionId: revision.id, question: { stableQuestionId: 'O2' }, visualPolicyId: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, state: true },
  });
  const jobs = await prisma.gradingJob.findMany({
    where: { batchId: batch.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, kind: true, state: true, batchId: true, batchItemId: true, gradingRunId: true, lastErrorCode: true, workerLeaseExpiresAt: true },
  });
  console.log(JSON.stringify({
    scope: 'stage-a:T2S-20',
    question: 'O2',
    batch: { id: anonymous(batch.id), state: batch.state },
    jobs: jobs.map((job) => ({ id: anonymous(job.id), kind: job.kind, state: job.state, hasBatchItem: Boolean(job.batchItemId), hasRun: Boolean(job.gradingRunId), lastErrorCode: job.lastErrorCode, leaseExpired: job.workerLeaseExpiresAt ? job.workerLeaseExpiresAt < new Date() : null })),
  }));
}

void main().finally(() => prisma.$disconnect());
