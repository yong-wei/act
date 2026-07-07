import { promises as fs } from 'node:fs';
import path from 'node:path';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  applyYangFanDiagnosticFixture,
  buildYangFanDiagnosticFixturePlan,
  resetYangFanDiagnosticFixture,
  type YangFanDiagnosticFixtureMode,
} from '../../src/lib/data-governance/yangfan-diagnostic-fixture';

const DEFAULT_READINESS_SUMMARY_PATH = path.join(
  process.cwd(),
  'course-content/runtime/resource-governance/full-resource-path-readiness-gate-summary.json',
);

const prisma = createPrismaClient();

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function readOption(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function readMode(): YangFanDiagnosticFixtureMode {
  if (hasFlag('--reset')) return 'reset';
  if (hasFlag('--audit')) return 'audit';
  if (hasFlag('--apply')) return 'apply';
  return 'dry-run';
}

async function readReadinessSummary() {
  const summaryPath = readOption('--readiness-summary') ?? DEFAULT_READINESS_SUMMARY_PATH;
  const text = await fs.readFile(summaryPath, 'utf8');
  return JSON.parse(text);
}

async function main() {
  const mode = readMode();
  const readinessSummary = await readReadinessSummary();
  const options = {
    mode,
    apply: hasFlag('--apply'),
    confirmApply: hasFlag('--confirm-apply'),
    canonicalEmail: readOption('--canonical-email'),
    canonicalStudentNumber: readOption('--canonical-student-number'),
    databaseUrl: process.env.DATABASE_URL ?? '',
    nodeEnv: process.env.NODE_ENV ?? '',
    fixtureDbAllowlist: process.env.YANGFAN_FIXTURE_DB_ALLOWLIST ?? '',
    readinessSummary,
  };

  const plan = await buildYangFanDiagnosticFixturePlan(prisma, options);
  if (mode === 'apply') {
    const result = await applyYangFanDiagnosticFixture(prisma, plan, options);
    console.log(JSON.stringify(result, null, hasFlag('--compact') ? 0 : 2));
    return;
  }
  if (mode === 'reset') {
    const result = await resetYangFanDiagnosticFixture(prisma, plan, options);
    console.log(JSON.stringify(result, null, hasFlag('--compact') ? 0 : 2));
    return;
  }

  console.log(JSON.stringify(plan, null, hasFlag('--compact') ? 0 : 2));
  if (mode === 'dry-run' && plan.blockers.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[seed-yangfan-diagnostic-learning-state] failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
