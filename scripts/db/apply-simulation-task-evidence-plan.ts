import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  applyHistoricalSimulationTaskPlan,
  type HistoricalSimulationTaskPlan,
} from '../../src/lib/data-governance/simulation-task-historical-application';

const prisma = createPrismaClient();

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.includes('--apply')) {
    throw new Error('historical-simulation-task-apply-requires-explicit-apply');
  }
  const planPath = requiredArg(argv, '--plan');
  const expectedPlanDigest = requiredArg(argv, '--expected-plan-digest');
  const plan = JSON.parse(await readFile(planPath, 'utf8')) as HistoricalSimulationTaskPlan;
  const result = await applyHistoricalSimulationTaskPlan(prisma, {
    plan,
    expectedPlanDigest,
  });
  console.log(JSON.stringify({
    mode: 'apply',
    planDigest: result.planDigest,
    candidateCount: result.candidateCount,
    affectedLearners: result.affectedLearners,
    created: result.created,
    targetGenerations: result.targetGenerations.map(({ userId, generation }) => ({
      learner: pseudonymize(userId),
      generation,
    })),
  }));
}

function requiredArg(argv: string[], name: string): string {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : null;
  if (!value || value.startsWith('--')) throw new Error(`missing-required-argument:${name}`);
  return value;
}

function pseudonymize(userId: string): string {
  return `student:v1:${createHash('sha256').update(userId).digest('hex')}`;
}

main()
  .catch((error) => {
    console.error('[SimulationTaskEvidenceApply] Failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
