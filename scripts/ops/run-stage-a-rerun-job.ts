import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';
import { processQuestionGradingBatch } from '../../src/lib/data-governance/math-document-grading-batch';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const batch = await prisma.gradingBatch.findFirstOrThrow({
    where: {
      assignmentRevisionId: revision.id,
      question: { stableQuestionId: 'O2' },
      visualPolicyId: { not: null },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const jobs = await prisma.gradingJob.findMany({
    where: { kind: 'RERUN', state: 'QUEUED', batchId: batch.id },
    select: { id: true, batchId: true, batchItemId: true, state: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (jobs.length !== 1 || !jobs[0]?.batchId) {
    throw new Error(`stage-a-o2-rerun-job-ambiguous:${jobs.length}`);
  }
  const job = jobs[0];
  const result = await processQuestionGradingBatch({
    db: prisma,
    batchId: batch.id,
    jobId: job.id,
    workerClaimToken: randomUUID(),
    itemId: job.batchItemId ?? undefined,
    store: createSubmissionObjectStore(),
  });
  console.log(JSON.stringify({
    scope: 'stage-a:T2S-20',
    question: 'O2',
    job: { id: job.id, state: job.state, batchItemId: job.batchItemId },
    batch: { id: result.batch.id, state: result.batch.state, completedItems: result.batch.completedItems, failedItems: result.batch.failedItems, blockedItems: result.batch.blockedItems },
    itemResults: result.itemResults,
  }));
}

void main().finally(() => prisma.$disconnect());
