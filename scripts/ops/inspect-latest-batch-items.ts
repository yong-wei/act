import 'dotenv/config';
import { createPrismaClient } from '../../src/lib/prisma-client';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const questionId = process.env.STAGE_A_QUESTION_ID?.trim();

async function main() {
  if (!questionId) throw new Error('stage-a-question-required');
  const revision = await prisma.assignmentRevision.findFirstOrThrow({ where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } });
  const batch = await prisma.gradingBatch.findFirstOrThrow({ where: { assignmentRevisionId: revision.id, question: { stableQuestionId: questionId }, visualPolicyId: { not: null } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, state: true, attemptId: true } } } });
  console.log(JSON.stringify({ batchId: batch.id, items: batch.items }));
}

void main().finally(() => prisma.$disconnect());
