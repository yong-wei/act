/**
 * Risk Flag Scanner - standalone one-shot entry point.
 *
 * Usage:
 *   npx tsx scripts/workers/scan-risk-flags.ts --batch-size=100
 *   npx tsx scripts/workers/scan-risk-flags.ts --batch-size=100 --max-students=500
 */

import { scanAllStudentRisks } from '@/lib/risk-scanner';
import { prisma } from '@/lib/prisma';

function positiveIntegerArgument(name: string, fallback?: number) {
  const raw = process.argv.find((argument) => argument.startsWith(`--${name}=`))?.split('=')[1];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

async function main() {
  const pageSize = positiveIntegerArgument('batch-size', 100);
  const maxStudents = positiveIntegerArgument('max-students');
  console.log('[risk-scanner] Starting deterministic risk scan');

  const results = await scanAllStudentRisks({
    pageSize,
    maxStudents,
  });
  const totals = results.reduce(
    (summary, result) => ({
      created: summary.created + result.flagsCreated,
      updated: summary.updated + result.flagsUpdated,
      resolved: summary.resolved + result.flagsResolved,
      unchanged: summary.unchanged + result.unchanged,
      failures: summary.failures + result.failures,
    }),
    { created: 0, updated: 0, resolved: 0, unchanged: 0, failures: 0 },
  );

  console.log(
    `[risk-scanner] Completed ${results.length} students: `
    + `${totals.created} created, ${totals.updated} updated, `
    + `${totals.resolved} resolved, ${totals.unchanged} unchanged, `
    + `${totals.failures} failed rules`,
  );
}

main()
  .catch((error) => {
    console.error('[risk-scanner] Fatal error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
