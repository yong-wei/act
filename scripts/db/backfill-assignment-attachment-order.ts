import {
  backfillAssignmentAttachmentOrder,
  type AttachmentOrderBackfillMode,
} from '../../src/lib/assignments/attachment-order-backfill';
import { prisma } from '../../src/lib/prisma';

async function main() {
  const mode: AttachmentOrderBackfillMode =
    process.argv.includes('--apply') ? 'apply' : 'dry-run';
  console.log(JSON.stringify(
    await backfillAssignmentAttachmentOrder(prisma, mode),
  ));
}

main()
  .catch(() => {
    console.error(JSON.stringify({
      error: 'attachment-order-backfill-failed',
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
