import { createSubmissionObjectScanner } from '../../src/lib/assignments/submission-object-store';
import { createSubmissionContentScanner, runSubmissionScanBatch } from '../../src/lib/assignments/submission-scanner';
import { prisma } from '../../src/lib/prisma';

async function main() {
  const scanner = createSubmissionObjectScanner(); const contentScanner = createSubmissionContentScanner();
  const result = await runSubmissionScanBatch(prisma, scanner, contentScanner, Number(process.env.SUBMISSION_SCAN_BATCH_SIZE ?? '25'));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
main().finally(() => prisma.$disconnect());
