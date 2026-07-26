import { deriveLegacyAssignmentAssetOrder } from '../../src/lib/assignments/submission-domain';
import { prisma } from '../../src/lib/prisma';

type Mode = 'dry-run' | 'apply';

async function main() {
  const mode: Mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
  const answers = await prisma.submissionAnswer.findMany({
    where: { assets: { some: {} } },
    select: {
      id: true,
      attachmentOrderProvenance: true,
      assets: {
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

  if (mode === 'apply') {
    for (const answer of answers) {
      if (answer.attachmentOrderProvenance === 'student-arranged') continue;
      const ordered = deriveLegacyAssignmentAssetOrder(answer.assets);
      await prisma.$transaction([
        ...ordered.map((asset, orderIndex) => prisma.submissionAsset.update({
          where: { id: asset.id },
          data: { orderIndex },
        })),
        prisma.submissionAnswer.update({
          where: { id: answer.id },
          data: { attachmentOrderProvenance: 'legacy-fallback' },
        }),
      ]);
    }
  }

  console.log(JSON.stringify({
    mode,
    answers: answers.length,
    explicitStudentOrder: explicit,
    legacyFallbackOrder: fallback,
    assetsToOrder,
  }));
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
