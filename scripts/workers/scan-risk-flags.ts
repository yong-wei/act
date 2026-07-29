/**
 * Risk Flag Scanner - standalone entry point
 * 
 * Usage: npx tsx scripts/worker/scan-risk-flags.ts [--batch-size 100]
 */

import { scanBatchRisks } from '@/lib/risk-scanner';
import { prisma } from '@/lib/prisma';

const BATCH_SIZE = parseInt(process.argv.find((a) => a.startsWith('--batch-size='))?.split('=')[1] ?? '100', 10);

async function main() {
  console.log('[risk-scanner] Starting scan...');

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true },
    take: BATCH_SIZE,
  });

  console.log([risk-scanner] Scanning  students...);
  const results = await scanBatchRisks(students.map((s) => s.id));

  const totalFlags = results.reduce((sum, r) => sum + r.flagsCreated, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  console.log([risk-scanner] Done:  flags created,  skipped (already flagged));

  await prisma.\();
}

main().catch((err) => {
  console.error('[risk-scanner] Fatal error:', err);
  prisma.\().then(() => process.exit(1));
});