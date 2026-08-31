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
  const rows = await prisma.teacherAssignmentReviewOutbox.findMany({
    where: { snapshot: { assignmentRevisionId: revision.id } },
    select: { id: true, command: true, state: true, lastErrorCode: true },
    orderBy: [{ command: 'asc' }, { id: 'asc' }],
  });
  console.log(JSON.stringify({ revisionId: revision.id, count: rows.length, rows }));
}

void main().finally(() => prisma.$disconnect());
