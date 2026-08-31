import 'dotenv/config';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

import { createDefaultReviewedDerivativeRenderer } from '../../src/lib/data-governance/teacher-assignment-review-derivative-storage';
import { defaultReviewedDerivativeOptions } from '../../src/lib/data-governance/teacher-assignment-review-derivative';
import { drainTeacherAssignmentReviewOutbox } from '../../src/lib/data-governance/teacher-assignment-review-outbox';
import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const before = await prisma.teacherAssignmentReviewOutbox.count({ where: { snapshot: { assignmentRevisionId: revision.id }, state: { in: ['PENDING', 'RETRYABLE', 'PROCESSING'] } } });
  const drained = await drainTeacherAssignmentReviewOutbox({
    db: prisma,
    limit: 100,
    handlers: {
      derivativeRenderer: createDefaultReviewedDerivativeRenderer(),
      derivativeOptions: defaultReviewedDerivativeOptions({
        generatorVersion: process.env.TEACHER_REVIEW_DERIVATIVE_GENERATOR_VERSION ?? '2-cjk-fonts',
        markitdownVersion: process.env.MARKITDOWN_VERSION,
        mathpixVersion: process.env.MATHPIX_VERSION,
      }),
    },
  });
  const after = await prisma.teacherAssignmentReviewOutbox.count({ where: { snapshot: { assignmentRevisionId: revision.id }, state: { in: ['PENDING', 'RETRYABLE', 'PROCESSING'] } } });
  console.log(JSON.stringify({ revisionId: revision.id, before, drained, after }));
  if (drained.blocked > 0 || drained.failed > 0) process.exitCode = 1;
}

void main().finally(() => prisma.$disconnect());
