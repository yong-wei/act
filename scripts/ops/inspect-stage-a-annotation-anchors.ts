import 'dotenv/config';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const rows = await prisma.teacherAssignmentApprovalSnapshot.findMany({
    where: { assignmentRevisionId: revision.id },
    orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
    select: {
      submissionId: true,
      questionId: true,
      annotationSnapshot: true,
      answerEvidence: { select: { blocks: { select: { id: true, questionId: true, pageNumber: true } } } },
      feedbackRelease: {
        select: {
          derivativeId: true,
          derivative: { select: { id: true, outputKind: true, generatorVersion: true, anchorPrecision: true, outputSizeBytes: true, limitations: true } },
        },
      },
      reviewedDerivatives: {
        where: { state: 'READY', outputKind: 'REVIEWED_PDF' },
        orderBy: { readyAt: 'desc' },
        take: 1,
        select: { id: true, outputKind: true, generatorVersion: true, anchorPrecision: true, outputSizeBytes: true, limitations: true },
      },
    },
  });
  const latest = rows.filter((row, index, all) => all.findIndex((candidate) => candidate.submissionId === row.submissionId && candidate.questionId === row.questionId) === index);
  const summary = latest.flatMap((row) => (Array.isArray(row.annotationSnapshot) ? row.annotationSnapshot : []).filter((annotation: any) => annotation?.status !== 'SUPPRESSED').map((annotation: any) => ({
    precision: String(annotation?.anchor?.precision ?? 'GENERAL').toUpperCase(),
    hasPage: Number.isInteger(annotation?.anchor?.pageNumber),
    hasBlock: typeof annotation?.anchor?.blockId === 'string',
    hasBBox: Array.isArray(annotation?.anchor?.bbox),
    hasMatchingBlock: row.answerEvidence?.blocks.some((block) => block.id === annotation?.anchor?.blockId) ?? false,
    hasEvidencePage: row.answerEvidence?.blocks.some((block) => block.pageNumber === annotation?.anchor?.pageNumber) ?? false,
    hasQuestionPage: row.answerEvidence?.blocks.some((block) => block.questionId === row.questionId && Number.isInteger(block.pageNumber)) ?? false,
  })));
  const counts = summary.reduce<Record<string, number>>((result, item) => {
    const key = `${item.precision}:page=${item.hasPage}:block=${item.hasBlock}:bbox=${item.hasBBox}:matchingBlock=${item.hasMatchingBlock}:evidencePage=${item.hasEvidencePage}:questionPage=${item.hasQuestionPage}`;
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
  const derivativeCounts = latest.reduce<Record<string, number>>((result, row) => {
    const released = row.feedbackRelease?.derivative;
    const newest = row.reviewedDerivatives[0];
    const key = `released=${released?.id === newest?.id}:released=${released?.outputKind ?? 'none'}:${released?.generatorVersion ?? 'none'}:${released?.anchorPrecision ?? 'none'}:${released?.outputSizeBytes ?? 'none'}:newest=${newest?.outputKind ?? 'none'}:${newest?.generatorVersion ?? 'none'}:${newest?.anchorPrecision ?? 'none'}:${newest?.outputSizeBytes ?? 'none'}`;
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
  console.log(JSON.stringify({ approvals: latest.length, annotations: summary.length, counts, derivativeCounts }));
}

void main().finally(() => prisma.$disconnect());
