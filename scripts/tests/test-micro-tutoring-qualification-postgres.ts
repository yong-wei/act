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
  const marker = `v2-qualify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let createdId: string | null = null;
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

    const seed = await prisma.wrongAnswerAttribution.findFirst({
      select: { id: true, userId: true },
    });
    if (!seed) {
      if (required) {
        throw new Error('postgres qualification requires at least one WrongAnswerAttribution row for write/replay');
      }
      console.log(JSON.stringify({
        orchestrationSamples: orchestration.length,
        interventionSamples: outcomes.length,
        learnerSafe: true,
        writeReplay: 'skipped-empty',
      }));
      return;
    }

    const created = await prisma.remediationOrchestrationResult.create({
      data: {
        wrongAnswerAttributionId: seed.id,
        orchestratorVersion: marker,
        userId: seed.userId,
        status: 'UNAVAILABLE',
        unavailableReason: 'RESOURCE_UNAVAILABLE',
        taskSnapshot: { marker, learnerSafe: true },
      },
      select: { id: true, status: true, taskSnapshot: true },
    });
    createdId = created.id;
    const replay = await prisma.remediationOrchestrationResult.findUnique({
      where: { id: created.id },
      select: { id: true, status: true, taskSnapshot: true, orchestratorVersion: true },
    });
    if (!replay || replay.orchestratorVersion !== marker || replay.status !== 'UNAVAILABLE') {
      throw new Error('postgres qualification failed to replay the written orchestration row');
    }
    let conflicted = false;
    try {
      await prisma.remediationOrchestrationResult.create({
        data: {
          wrongAnswerAttributionId: seed.id,
          orchestratorVersion: marker,
          userId: seed.userId,
          status: 'UNAVAILABLE',
          unavailableReason: 'RESOURCE_UNAVAILABLE',
          taskSnapshot: { marker, duplicate: true },
        },
      });
    } catch {
      conflicted = true;
    }
    if (!conflicted) {
      throw new Error('postgres qualification expected unique orchestration writes to conflict');
    }
    await Promise.all([
      prisma.remediationOrchestrationResult.findUnique({ where: { id: created.id } }),
      prisma.remediationOrchestrationResult.findUnique({ where: { id: created.id } }),
    ]);
    console.log(JSON.stringify({
      orchestrationSamples: orchestration.length,
      interventionSamples: outcomes.length,
      learnerSafe: true,
      writeReplay: true,
      idempotentConflict: true,
    }));
  } finally {
    if (createdId) {
      await prisma.remediationOrchestrationResult.delete({ where: { id: createdId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
