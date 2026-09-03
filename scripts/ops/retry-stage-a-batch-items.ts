import 'dotenv/config';
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');
import { createPrismaClient } from '../../src/lib/prisma-client';
import { retryQuestionGradingBatchItem } from '../../src/lib/data-governance/math-document-grading-batch';

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const retryRunId = process.env.STAGE_A_RETRY_RUN_ID?.trim() || 'default';
const requestedItemId = process.env.STAGE_A_ITEM_ID?.trim();

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, assignment: { select: { authorId: true } } },
  });
  const allBatches = await prisma.gradingBatch.findMany({
    where: { assignmentRevisionId: revision.id, visualPolicyId: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, questionId: true },
  });
  const latestBatches = new Map<string, (typeof allBatches)[number]>();
  for (const batch of allBatches) if (!latestBatches.has(batch.questionId)) latestBatches.set(batch.questionId, batch);
  const items = await prisma.gradingBatchItem.findMany({
    where: {
      batchId: { in: [...latestBatches.values()].map((batch) => batch.id) },
      ...(requestedItemId ? { id: requestedItemId } : {}),
      state: { in: ['BLOCKED', 'FAILED', 'RETRYABLE'] },
      retryCount: { lt: 2 },
    },
    select: { id: true, batchId: true, state: true, retryCount: true, failureCode: true },
    orderBy: { id: 'asc' },
  });
  const results: unknown[] = [];
  for (const item of items) {
    try {
      const result = await retryQuestionGradingBatchItem({
        db: prisma,
        batchId: item.batchId,
        itemId: item.id,
        actor: { id: revision.assignment.authorId, role: 'TEACHER' },
        idempotencyKey: `stage-a-runtime-retry-${retryRunId}-${item.id}`,
        reason: 'local conversion runtime repaired; retry controlled stage A item',
      });
      results.push({ item: item.id, previousState: item.state, previousRetryCount: item.retryCount, job: result.job.id, replay: result.replay });
    } catch (error) {
      results.push({ item: item.id, previousState: item.state, previousRetryCount: item.retryCount, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(JSON.stringify({ revisionId: revision.id, candidates: items.length, results }));
}

void main().finally(() => prisma.$disconnect());
