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
  const snapshots = await prisma.assignmentSubmissionSnapshot.findMany({
    where: { assignmentRevisionId: revision.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      submissionId: true,
      source: true,
      attemptVectorHash: true,
      grade: {
        select: {
          id: true,
          version: true,
          state: true,
          totalScore: true,
          confirmations: { orderBy: { version: 'desc' }, select: { id: true, version: true, idempotencyKey: true, requestHash: true } },
          release: { select: { id: true } },
        },
      },
    },
  });
  console.log(JSON.stringify({ revisionId: revision.id, count: snapshots.length, snapshots }));
}

void main().finally(() => prisma.$disconnect());
