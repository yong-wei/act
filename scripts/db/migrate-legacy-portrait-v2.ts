import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  applyLegacyPortraitMigration,
  auditPortraitMigrationCompleteness,
  buildLegacyPortraitMigrationDryRun,
  type LegacyPortraitMigrationDb,
} from '../../src/lib/data-governance/portrait-v2-migration';

const prisma = createPrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');
  const audit = process.argv.includes('--audit');
  if (apply && !process.argv.includes('--confirm-apply')) {
    throw new Error('Migration apply requires --apply --confirm-apply. Dry-run is the default.');
  }
  const db = prisma as unknown as LegacyPortraitMigrationDb;
  if (audit) {
    const [legacySnapshots, portraitSnapshots] = await Promise.all([
      prisma.studentCompetencySnapshot.findMany({
        select: { id: true, userId: true, snapshotAt: true, competencyVector: true, calculationVersion: true },
      }),
      prisma.studentPortraitV2Snapshot.findMany({
        select: { id: true, userId: true, snapshotAt: true, derivationKind: true, payload: true },
      }),
    ]);
    console.log(JSON.stringify(auditPortraitMigrationCompleteness({
      legacySnapshots,
      portraitSnapshots,
    } as Parameters<typeof auditPortraitMigrationCompleteness>[0]), null, 2));
    return;
  }
  const result = apply
    ? await applyLegacyPortraitMigration(db)
    : await buildLegacyPortraitMigrationDryRun(db);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error('[PortraitV2Migration] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
