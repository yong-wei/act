import 'dotenv/config';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';
import { processQuestionGradingBatch } from '../../src/lib/data-governance/math-document-grading-batch';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const questionId = process.env.STAGE_A_QUESTION_ID?.trim();
  if (!questionId) throw new Error('stage-a-question-required');
  const requestedItemId = process.env.STAGE_A_ITEM_ID?.trim();
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const batch = await prisma.gradingBatch.findFirstOrThrow({
    where: { assignmentRevisionId: revision.id, question: { stableQuestionId: questionId }, visualPolicyId: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
  });
  const item = requestedItemId
    ? batch.items.find((candidate) => candidate.id === requestedItemId)
    : batch.items.find((candidate) => ['QUEUED', 'CONVERTING', 'GRADING', 'RETRYABLE'].includes(candidate.state));
  if (!item) throw new Error('stage-a-item-not-found');
  const result = await processQuestionGradingBatch({ db: prisma, batchId: batch.id, itemId: item.id, store: createSubmissionObjectStore() });
  console.log(JSON.stringify({ questionId, batchId: batch.id, itemId: item.id, result }));
}

void main().finally(() => prisma.$disconnect());
