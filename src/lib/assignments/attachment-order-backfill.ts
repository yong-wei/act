import { Prisma, type PrismaClient } from '@prisma/client';

import { deriveLegacyAssignmentAssetOrder } from './submission-domain';

export type AttachmentOrderBackfillMode = 'dry-run' | 'apply';

type BackfillHooks = {
  beforeApply?: (answerId: string) => Promise<void>;
};

export async function backfillAssignmentAttachmentOrder(
  prisma: PrismaClient,
  mode: AttachmentOrderBackfillMode,
  hooks: BackfillHooks = {},
) {
  const answers = await prisma.submissionAnswer.findMany({
    where: { assets: { some: { state: 'FINALIZED' } } },
    select: {
      id: true,
      attachmentOrderProvenance: true,
      assets: {
        where: { state: 'FINALIZED' },
        select: { id: true, version: true, createdAt: true, orderIndex: true },
      },
    },
  });
  const explicit = answers.filter((answer) =>
    answer.attachmentOrderProvenance === 'student-arranged').length;
  const fallback = answers.length - explicit;
  const assetsToOrder = answers
    .filter((answer) => answer.attachmentOrderProvenance !== 'student-arranged')
    .reduce((count, answer) => count + answer.assets.length, 0);
  let applied = 0;
  let skippedAfterDiscovery = 0;

  if (mode === 'apply') {
    for (const answer of answers) {
      if (answer.attachmentOrderProvenance === 'student-arranged') continue;
      await hooks.beforeApply?.(answer.id);
      const didApply = await prisma.$transaction(async (tx) => {
        await tx.$queryRawUnsafe(
          'SELECT "id" FROM "SubmissionAnswer" WHERE "id" = $1 FOR UPDATE',
          answer.id,
        );
        const current = await tx.submissionAnswer.findUnique({
          where: { id: answer.id },
          select: { id: true, attachmentOrderProvenance: true },
        });
        if (!current || current.attachmentOrderProvenance === 'student-arranged') {
          return false;
        }

        const currentAssets = await tx.submissionAsset.findMany({
          where: { answerId: answer.id, state: 'FINALIZED' },
          select: { id: true, version: true, createdAt: true },
        });
        const ordered = deriveLegacyAssignmentAssetOrder(currentAssets);
        for (const [orderIndex, asset] of ordered.entries()) {
          const updated = await tx.submissionAsset.updateMany({
            where: { id: asset.id, answerId: answer.id, state: 'FINALIZED' },
            data: { orderIndex },
          });
          if (updated.count !== 1) {
            throw new Error('attachment-order-backfill-asset-changed');
          }
        }
        await tx.submissionAnswer.update({
          where: { id: answer.id },
          data: { attachmentOrderProvenance: 'legacy-fallback' },
        });
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (didApply) applied += 1;
      else skippedAfterDiscovery += 1;
    }
  }

  return {
    mode,
    answers: answers.length,
    explicitStudentOrder: explicit,
    legacyFallbackOrder: fallback,
    assetsToOrder,
    applied,
    skippedAfterDiscovery,
  };
}
