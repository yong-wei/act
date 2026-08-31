import 'dotenv/config';
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');
import { createPrismaClient } from '../../src/lib/prisma-client';
import { createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';
import { processQuestionGradingBatch } from '../../src/lib/data-governance/math-document-grading-batch';

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const allBatches = await prisma.gradingBatch.findMany({
    where: { assignmentRevisionId: revision.id, visualPolicyId: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, questionId: true },
  });
  const latestBatches = new Map<string, (typeof allBatches)[number]>();
  for (const batch of allBatches) if (!latestBatches.has(batch.questionId)) latestBatches.set(batch.questionId, batch);
  const requestedJobIds = (process.env.STAGE_A_RETRY_JOB_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const jobs = await prisma.gradingJob.findMany({
    where: { id: requestedJobIds.length > 0 ? { in: requestedJobIds } : undefined, kind: 'RETRY', state: { in: ['QUEUED', 'RETRYABLE'] }, batchId: { in: [...latestBatches.values()].map((batch) => batch.id) } },
    select: { id: true, batchId: true, batchItemId: true, state: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const store = createSubmissionObjectStore();
  const results: unknown[] = [];
  for (const job of jobs) {
    try {
      const processed = await processQuestionGradingBatch({ db: prisma, batchId: job.batchId!, jobId: job.id, itemId: job.batchItemId!, store });
      results.push({ job: job.id, previousState: job.state, item: job.batchItemId, batchState: processed.batch.state, itemResults: processed.itemResults });
    } catch (error) {
      results.push({ job: job.id, previousState: job.state, item: job.batchItemId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(JSON.stringify({ revisionId: revision.id, jobs: jobs.length, results }));
}

void main().finally(() => prisma.$disconnect());
