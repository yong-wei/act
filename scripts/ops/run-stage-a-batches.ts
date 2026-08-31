import 'dotenv/config';
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');
import { createPrismaClient } from '../../src/lib/prisma-client';
import { createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';
import { processQuestionGradingBatch } from '../../src/lib/data-governance/math-document-grading-batch';
import { processDocumentConversionJob, writeRenderedObjectToSubmissionStore } from '../../src/lib/data-governance/math-document-grading-persistence';

const prisma = createPrismaClient({ log: ['warn', 'error'] });
async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({ where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } });
  const store = createSubmissionObjectStore();
  const requestedQuestion = process.env.STAGE_A_QUESTION_ID?.trim();
  const allBatches = await prisma.gradingBatch.findMany({ where: { assignmentRevisionId: revision.id, visualPolicyId: { not: null }, ...(requestedQuestion ? { question: { stableQuestionId: requestedQuestion } } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, questionId: true, jobs: { where: { kind: { in: ['BATCH', 'RETRY'] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { id: true } } } });
  const latestBatches = new Map<string, (typeof allBatches)[number]>();
  for (const batch of allBatches) if (!latestBatches.has(batch.questionId)) latestBatches.set(batch.questionId, batch);
  const requestedBatchLimit = Number(process.env.STAGE_A_MAX_BATCHES ?? '0');
  const batches = requestedBatchLimit > 0 ? [...latestBatches.values()].slice(0, requestedBatchLimit) : [...latestBatches.values()];
  const conversionResults = [];
  const batchResults = [];
  for (const batch of batches) {
    try { const processed = await processQuestionGradingBatch({ db: prisma, batchId: batch.id, jobId: batch.jobs[0]?.id, store }); batchResults.push({ batchId: batch.id, state: processed.batch.state, completed: processed.batch.completedItems, failed: processed.batch.failedItems, blocked: processed.batch.blockedItems }); }
    catch (error) { batchResults.push({ batchId: batch.id, error: error instanceof Error ? error.message : String(error) }); }
  }
  const final = await prisma.gradingBatch.findMany({ where: { assignmentRevisionId: revision.id }, select: { questionId: true, state: true, totalItems: true, completedItems: true, failedItems: true, blockedItems: true } });
  const conversionCount = await prisma.documentConversion.count({ where: { attempt: { answer: { submission: { assignmentRevisionId: revision.id } } } } });
  console.log(JSON.stringify({ revisionId: revision.id, conversionJobs: 0, conversionResults, batchResults, final, conversionCount }));
}
void main().finally(() => prisma.$disconnect());
