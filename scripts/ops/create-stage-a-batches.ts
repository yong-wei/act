import 'dotenv/config';
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');
import { createPrismaClient } from '../../src/lib/prisma-client';
import { createQuestionScopedGradingBatch } from '../../src/lib/data-governance/math-document-grading-batch';

const prisma = createPrismaClient({ log: ['warn', 'error'] });
async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({ where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } }, orderBy: { createdAt: 'desc' }, include: { assignment: { select: { id: true } }, questions: { orderBy: { orderIndex: 'asc' }, select: { id: true, stableQuestionId: true } }, audiences: { select: { classId: true } } } });
  await prisma.assignmentAudience.updateMany({ where: { assignmentRevisionId: revision.id }, data: { dueAt: new Date(Date.now() - 60_000) } });
  const teacher = await prisma.assignment.findUniqueOrThrow({ where: { id: revision.assignment.id }, select: { authorId: true } });
  const policy = await prisma.gradingProviderPolicy.findFirst({ where: { enabled: true, purpose: 'rubric-grading', provider: 'siliconflow' }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  const outputs = [];
  for (const question of revision.questions) {
    const result = await createQuestionScopedGradingBatch({ db: prisma, request: { assignmentRevisionId: revision.id, questionId: question.id, classId: revision.audiences[0].classId, actor: { id: teacher.authorId, role: 'TEACHER' }, policyId: policy?.id ?? null, idempotencyKey: `stage-a-batch-${revision.id}-${question.id}`, maxItems: 20 } });
    outputs.push({ questionId: question.stableQuestionId, batchId: result.batch.id, state: result.batch.state, totalItems: result.items.length, replay: result.replay });
  }
  console.log(JSON.stringify({ revisionId: revision.id, policyId: policy?.id ?? null, outputs }));
}
void main().finally(() => prisma.$disconnect());
