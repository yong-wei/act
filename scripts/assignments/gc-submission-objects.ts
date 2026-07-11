import { createSubmissionGcObjectStore } from '../../src/lib/assignments/submission-object-store';
import { garbageCollectQuarantine } from '../../src/lib/assignments/submission-service';
import { prisma } from '../../src/lib/prisma';

async function main() {
  const hours = Number(process.env.SUBMISSION_QUARANTINE_RETENTION_HOURS ?? '24');
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) throw new Error('invalid-quarantine-retention-hours');
  const store = createSubmissionGcObjectStore();
  await store.healthCheck();
  const result = await garbageCollectQuarantine(prisma, store, new Date(Date.now() - hours * 3_600_000));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().finally(() => prisma.$disconnect());
