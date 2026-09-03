import 'dotenv/config';

import { createPrismaClient } from '../../src/lib/prisma-client';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const questionId = process.env.STAGE_A_QUESTION_ID?.trim() ?? 'T2-2';

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const batch = await prisma.gradingBatch.findFirstOrThrow({
    where: { assignmentRevisionId: revision.id, question: { stableQuestionId: questionId }, visualPolicyId: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, attemptId: true, state: true, failureCode: true, conversionId: true, gradingRunId: true } } },
  });
  for (const item of batch.items) {
    const attempt = item.attemptId
      ? await prisma.submissionAttempt.findUnique({ where: { id: item.attemptId }, select: { id: true, answer: { select: { assets: { orderBy: [{ orderIndex: 'asc' }, { version: 'asc' }], select: { id: true, originalName: true, mimeType: true, sizeBytes: true, checksum: true, assetRole: true } } } } } })
      : null;
    const conversions = item.attemptId
      ? await prisma.documentConversion.findMany({
        where: { attemptId: item.attemptId },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, version: true, state: true, failureCode: true, adapter: true, sourceChecksum: true, renderedObjectKey: true, renderedChecksum: true, outputChecksum: true, renderedPageCount: true, canonicalMarkdown: true, answerEvidence: { select: { id: true, version: true, readiness: true, limitationState: true, sourceManifest: true } }, jobs: { orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, state: true, lastErrorCode: true, attemptCount: true } } },
      })
      : [];
    console.log(JSON.stringify({ item, assets: attempt?.answer.assets ?? [], conversions: conversions.map((conversion) => ({ ...conversion, hasMarkdown: Boolean(conversion.canonicalMarkdown), canonicalMarkdown: undefined })) }));
  }
}

void main().finally(() => prisma.$disconnect());
