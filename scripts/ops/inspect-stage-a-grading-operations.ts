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
  const operations = await prisma.assignmentGradingOperation.findMany({
    where: { assignmentRevisionId: revision.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, idempotencyKey: true, dedupeKey: true, state: true, selectionSnapshot: true, snapshots: { select: { id: true, submissionId: true, source: true } } },
  });
  console.log(JSON.stringify({ revisionId: revision.id, count: operations.length, operations }));
}

void main().finally(() => prisma.$disconnect());
