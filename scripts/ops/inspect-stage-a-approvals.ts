import 'dotenv/config';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const rows = await prisma.teacherAssignmentApprovalSnapshot.findMany({
    where: { assignmentRevisionId: revision.id },
    orderBy: [{ attemptId: 'asc' }, { approvedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, attemptId: true, submissionId: true, questionId: true, approvedAt: true, reviewedDerivatives: { where: { state: 'READY', outputKind: 'REVIEWED_PDF' }, orderBy: { readyAt: 'desc' }, take: 1, select: { id: true, outputChecksum: true, outputObjectKey: true } }, feedbackRelease: { select: { id: true, derivativeId: true, releasedAt: true } } },
  });
  console.log(JSON.stringify({ revisionId: revision.id, rows }));
}

void main().finally(() => prisma.$disconnect());
