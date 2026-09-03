import 'dotenv/config';
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');
import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient({ log: ['warn', 'error'] });

/**
 * Read-only, privacy-safe stage-A queue diagnostics.
 *
 * Resolve the published stage-A revision first and project only aggregate
 * job/conversion states. Never load submission, answer, asset, evidence,
 * policy, or model output content here.
 */
async function main() {
  try {
    const revision = await prisma.assignmentRevision.findFirstOrThrow({
      where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const jobs = await prisma.gradingJob.findMany({
      where: {
        kind: 'CONVERSION',
        conversion: { attempt: { answer: { submission: { assignmentRevisionId: revision.id } } } },
      },
      select: { state: true, conversion: { select: { state: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const jobStates: Record<string, number> = {};
    const conversionStates: Record<string, number> = {};
    for (const job of jobs) {
      jobStates[job.state] = (jobStates[job.state] ?? 0) + 1;
      const conversionState = job.conversion?.state ?? 'MISSING';
      conversionStates[conversionState] = (conversionStates[conversionState] ?? 0) + 1;
    }

    console.log(JSON.stringify({
      scope: 'stage-a:T2S-20',
      publishedRevisionResolved: true,
      jobCount: jobs.length,
      jobStates,
      conversionStates,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

void main();
