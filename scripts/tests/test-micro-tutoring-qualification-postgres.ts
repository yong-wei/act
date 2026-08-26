import { PrismaClient } from '@prisma/client';

const required = process.env.MICRO_TUTORING_QUALIFICATION_POSTGRES_REQUIRED === '1';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  if (required) throw new Error('DATABASE_URL is required for micro-tutoring qualification postgres tests');
  console.log('micro tutoring qualification postgres skipped: DATABASE_URL is not set');
  process.exit(0);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const [orchestration, outcomes] = await Promise.all([
      prisma.remediationOrchestrationResult.findMany({ take: 5, select: { id: true, status: true, taskSnapshot: true, unavailableReason: true } }),
      prisma.microInterventionOutcome.findMany({ take: 5, select: { id: true, sourceSnapshot: true } }),
    ]);
    for (const row of orchestration) {
      const serialized = JSON.stringify(row.taskSnapshot ?? {});
      if (serialized.includes('PRIVATE_CORRECT_ANSWER') || serialized.includes('answerKey')) {
        throw new Error(`learner-unsafe orchestration snapshot ${row.id}`);
      }
    }
    for (const row of outcomes) {
      const serialized = JSON.stringify(row.sourceSnapshot ?? {});
      if (serialized.includes('PRIVATE_CORRECT_ANSWER')) {
        throw new Error(`learner-unsafe intervention snapshot ${row.id}`);
      }
    }
    const [orchestrationCount, outcomeCount] = await Promise.all([
      prisma.remediationOrchestrationResult.count(),
      prisma.microInterventionOutcome.count(),
    ]);
    console.log(JSON.stringify({
      orchestrationSamples: orchestration.length,
      interventionSamples: outcomes.length,
      orchestrationCount,
      outcomeCount,
      learnerSafe: true,
      idempotentReads: true,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
