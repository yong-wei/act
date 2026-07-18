import { createSubmissionGcObjectStore } from '../../src/lib/assignments/submission-object-store';
import { garbageCollectQuarantine, garbageCollectSourceAssets } from '../../src/lib/assignments/submission-service';
import { runGradingRetentionGc } from '../../src/lib/data-governance/math-document-grading-lifecycle';
import { prisma } from '../../src/lib/prisma';

async function main() {
  const hours = Number(process.env.SUBMISSION_QUARANTINE_RETENTION_HOURS ?? '24');
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) throw new Error('invalid-quarantine-retention-hours');
  const store = createSubmissionGcObjectStore();
  await store.healthCheck();
  const result = await garbageCollectQuarantine(prisma, store, new Date(Date.now() - hours * 3_600_000));
  const sourceAssets = await garbageCollectSourceAssets(prisma, store, new Date());
  const policies = await prisma.gradingLifecyclePolicy.findMany({
    where: {
      enabled: true,
      dataClass: { in: ['answer-evidence', 'document-conversion', 'ai-draft', 'grading-run'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  const grading = await runGradingRetentionGc({ db: prisma, store, policies, now: new Date() });
  process.stdout.write(`${JSON.stringify({ submission: result, sourceAssets, grading })}\n`);
}

main().finally(() => prisma.$disconnect());
