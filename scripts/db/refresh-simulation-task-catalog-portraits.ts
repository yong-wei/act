import { createHash } from 'node:crypto';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { findSimulationTaskProjectionCandidateUserIds } from '../../src/lib/data-governance/simulation-task-portrait-projection';
import { scheduleSimulationTaskCatalogRefresh } from '../../src/lib/data-governance/simulation-task-reconciliation';

const prisma = createPrismaClient();

async function main() {
  const argv = process.argv.slice(2);
  const historicalCandidatePlanDigest = argValue(argv, '--historical-plan-digest');
  if (!argv.includes('--apply')) {
    const userIds = await findSimulationTaskProjectionCandidateUserIds(prisma);
    console.log(JSON.stringify({
      mode: 'dry-run',
      candidateLearners: userIds.length,
      learners: userIds.map(pseudonymize),
    }));
    return;
  }
  const result = await scheduleSimulationTaskCatalogRefresh(prisma, {
    historicalCandidatePlanDigest,
  });
  console.log(JSON.stringify({
    mode: 'apply',
    catalogDigest: result.catalogDigest,
    candidateLearners: result.candidateLearners,
    scheduledLearners: result.scheduledLearners,
    targetGenerations: result.targetGenerations.map(({ userId, generation }) => ({
      learner: pseudonymize(userId),
      generation,
    })),
  }));
}

function argValue(argv: string[], name: string): string | null {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] ?? null : null;
  if (value?.startsWith('--')) throw new Error(`missing-required-argument:${name}`);
  return value;
}

function pseudonymize(userId: string): string {
  return `student:v1:${createHash('sha256').update(userId).digest('hex')}`;
}

main()
  .catch((error) => {
    console.error('[SimulationTaskCatalogRefresh] Failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
