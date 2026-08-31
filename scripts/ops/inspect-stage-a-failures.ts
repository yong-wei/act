import 'dotenv/config';

import { createHash } from 'node:crypto';

import { createPrismaClient } from '../../src/lib/prisma-client';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });

function anonymous(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const allBatches = await prisma.gradingBatch.findMany({
    where: { assignmentRevisionId: revision.id, visualPolicyId: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      questionId: true,
      state: true,
      totalItems: true,
      completedItems: true,
      failedItems: true,
      blockedItems: true,
      createdAt: true,
      items: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          conversion: { select: { state: true, failureCode: true, adapter: true, warningCodes: true, answerEvidence: { select: { readiness: true, limitationState: true, version: true } } } },
          gradingRun: { select: { state: true, provider: true, blockedReasons: true, lifecycleBlockReason: true } },
          jobs: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 4, select: { kind: true, state: true, lastErrorCode: true, attemptCount: true } },
        },
      },
      question: { select: { stableQuestionId: true } },
    },
  });
  const latest = new Map<string, (typeof allBatches)[number]>();
  for (const batch of allBatches) if (!latest.has(batch.questionId)) latest.set(batch.questionId, batch);
  const cleanupAudits = await prisma.gradingAuditEvent.findMany({ where: { action: 'document-conversion.rendered-orphan-cleanup-failed' }, orderBy: { createdAt: 'desc' }, take: 20, select: { resourceId: true, metadata: true, createdAt: true } });
  console.log(JSON.stringify({
    scope: 'stage-a:T2S-20',
    revision: anonymous(revision.id),
    cleanupAudits: cleanupAudits.map((audit) => ({ resourceId: anonymous(audit.resourceId), metadata: audit.metadata, createdAt: audit.createdAt.toISOString() })),
    batches: [...latest.values()].map((batch) => ({
      questionId: batch.question?.stableQuestionId ?? batch.questionId,
      batch: { id: anonymous(batch.id), state: batch.state, totalItems: batch.totalItems, completedItems: batch.completedItems, failedItems: batch.failedItems, blockedItems: batch.blockedItems, createdAt: batch.createdAt.toISOString() },
      items: batch.items.map((item) => ({
        item: anonymous(item.id),
        state: item.state,
        failureCode: item.failureCode,
        conversion: item.conversion ? { state: item.conversion.state, failureCode: item.conversion.failureCode, adapter: item.conversion.adapter, warningCodes: item.conversion.warningCodes, evidence: item.conversion.answerEvidence } : null,
        gradingRun: item.gradingRun,
        jobs: item.jobs,
      })),
    })),
  }));
}

void main().finally(() => prisma.$disconnect());
