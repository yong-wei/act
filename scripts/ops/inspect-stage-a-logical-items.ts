import 'dotenv/config';

import { createHash } from 'node:crypto';

import { createPrismaClient } from '../../src/lib/prisma-client';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });

function anonymous(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

async function main() {
  const settingsRow = await prisma.platformSetting.findUnique({ where: { key: 'ai_provider_settings' }, select: { value: true } });
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, questions: { orderBy: { orderIndex: 'asc' }, select: { id: true, stableQuestionId: true } }, audiences: { select: { classId: true }, take: 1 } },
  });
  const batches = await prisma.gradingBatch.findMany({
    where: { assignmentRevisionId: revision.id, visualPolicyId: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: {
      question: { select: { stableQuestionId: true } },
      policy: { select: { provider: true, model: true, version: true, enabled: true } },
      visualPolicy: { select: { provider: true, model: true, version: true, enabled: true } },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          conversion: { select: { state: true, failureCode: true, version: true, answerEvidence: { select: { readiness: true, limitationState: true, version: true } } } },
          gradingRun: { select: { state: true, lifecycleBlockReason: true, blockedReasons: true, provider: true, evaluatorId: true, evaluatorVersion: true, policySnapshot: true, providerRequestId: true } },
          jobs: { orderBy: { createdAt: 'desc' }, take: 4, select: { kind: true, state: true, lastErrorCode: true, attemptCount: true } },
        },
      },
    },
  });
  const latest = new Map<string, (typeof batches)[number]>();
  for (const batch of batches) {
    const question = batch.question?.stableQuestionId ?? batch.questionId;
    if (!latest.has(question)) latest.set(question, batch);
  }

  const output = [...latest.entries()].map(([questionId, batch]) => ({
    questionId,
    batch: { id: anonymous(batch.id), state: batch.state, createdAt: batch.createdAt.toISOString(), totalItems: batch.totalItems, completedItems: batch.completedItems, failedItems: batch.failedItems, blockedItems: batch.blockedItems },
    policy: batch.policy,
    visualPolicy: batch.visualPolicy,
    items: batch.items.map((item) => ({
      item: anonymous(item.id),
      state: item.state,
      retryCount: item.retryCount,
      failureCode: item.failureCode,
      conversion: item.conversion ? { state: item.conversion.state, failureCode: item.conversion.failureCode, version: item.conversion.version, evidence: item.conversion.answerEvidence ? { readiness: item.conversion.answerEvidence.readiness, limitationState: item.conversion.answerEvidence.limitationState, version: item.conversion.answerEvidence.version } : null } : null,
      gradingRun: item.gradingRun ? { state: item.gradingRun.state, lifecycleBlockReason: item.gradingRun.lifecycleBlockReason, blockedReasons: item.gradingRun.blockedReasons, provider: item.gradingRun.provider, evaluatorId: item.gradingRun.evaluatorId, evaluatorVersion: item.gradingRun.evaluatorVersion, policy: item.gradingRun.policySnapshot && typeof item.gradingRun.policySnapshot === 'object' ? { provider: (item.gradingRun.policySnapshot as Record<string, unknown>).provider, model: (item.gradingRun.policySnapshot as Record<string, unknown>).model, version: (item.gradingRun.policySnapshot as Record<string, unknown>).version } : null, hasProviderRequest: Boolean(item.gradingRun.providerRequestId) } : null,
      jobs: item.jobs,
    })),
  }));
  const settings = settingsRow?.value && typeof settingsRow.value === 'object' ? settingsRow.value as Record<string, unknown> : null;
  const providers = Array.isArray(settings?.providers)
    ? settings.providers.map((provider) => {
      const value = provider && typeof provider === 'object' ? provider as Record<string, unknown> : {};
      return { id: value.id, selectedModel: value.selectedModel, enabled: value.enabled, secretRef: value.secretRef, baseURL: value.baseURL };
    })
    : [];
  const allBatches = batches.map((batch) => ({
    questionId: batch.question?.stableQuestionId ?? batch.questionId,
    batch: { id: anonymous(batch.id), state: batch.state, createdAt: batch.createdAt.toISOString(), totalItems: batch.totalItems, itemCount: batch.items.length },
    items: batch.items.map((item) => ({ item: anonymous(item.id), answer: item.answerId ? anonymous(item.answerId) : null, attempt: item.attemptId ? anonymous(item.attemptId) : null, state: item.state, retryCount: item.retryCount, failureCode: item.failureCode })),
  }));
  const classId = revision.audiences[0]?.classId;
  const attemptDiagnostics = await Promise.all(revision.questions.map(async (question) => {
    const attempts = await prisma.submissionAttempt.findMany({
      where: {
        answer: {
          assignmentQuestionId: question.id,
          submission: { assignmentRevisionId: revision.id },
        },
      },
      orderBy: [{ answer: { submission: { studentId: 'asc' } } }, { submittedAt: 'desc' }],
      include: {
        answer: { select: { submission: { select: { studentId: true, frozenAudienceClassId: true } } } },
        gradingRuns: { orderBy: { createdAt: 'desc' }, select: { state: true, provider: true, evaluatorId: true, evaluatorVersion: true, rerunIdentity: true, rerunReason: true, lifecycleBlockReason: true, blockedReasons: true } },
        gradingBatchItems: { orderBy: { createdAt: 'desc' }, select: { state: true, failureCode: true, batch: { select: { id: true, rerunReason: true, createdAt: true } } } },
      },
    });
    return {
      questionId: question.stableQuestionId,
      attempts: attempts
        .filter((attempt) => attempt.answer.submission.frozenAudienceClassId === classId)
        .map((attempt) => ({
          attempt: anonymous(attempt.id),
          answer: anonymous(attempt.answerId),
          student: anonymous(attempt.answer.submission.studentId),
          attemptNumber: attempt.attemptNumber,
          answerVersion: attempt.answerVersion,
          submittedAt: attempt.submittedAt.toISOString(),
          gradingRuns: attempt.gradingRuns,
          gradingBatchItems: attempt.gradingBatchItems.map((item) => ({ ...item, batch: { ...item.batch, id: anonymous(item.batch.id), createdAt: item.batch.createdAt.toISOString() } })),
        })),
    };
  }));
  console.log(JSON.stringify({ scope: 'stage-a:T2S-20', revision: anonymous(revision.id), providerSettings: { activeProvider: settings?.activeProvider ?? null, providers }, latestBatches: output, allBatches, attemptDiagnostics }));
}

void main().finally(() => prisma.$disconnect());
