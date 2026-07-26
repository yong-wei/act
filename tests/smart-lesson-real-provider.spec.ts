import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type BrowserContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import { resolveSmartLessonEvidenceFile } from '../scripts/tests/smart-lesson-evidence-path';
import { createPrismaClient } from '../src/lib/prisma-client';

const teacherId = requiredEnv('SMART_LESSON_E2E_TEACHER_ID');
const topic = requiredEnv('SMART_LESSON_E2E_TOPIC');
const sourceRevision = requiredEnv('SMART_LESSON_E2E_SOURCE_REVISION');
const evidencePath = resolveSmartLessonEvidenceFile('real-provider-full-boppps.json');

test.describe.configure({ mode: 'serial' });

test('configured real provider completes and resumes a full BOPPPS generation', async ({ page, context }) => {
  expect(requiredEnv('SMART_LESSON_REAL_PROVIDER_REQUIRED')).toBe('1');
  expect(process.env.SMART_LESSON_E2E_FIXTURE_TOKEN).toBeUndefined();
  await addTeacherSession(context);

  await page.goto('/teacher/smart-prep');
  await expect(page.getByRole('heading', { name: '智能教案共创' })).toBeVisible();
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: topic }) });
  await expect(card).toContainText('来源已验证');
  await card.getByRole('button', { name: '开始生成' }).click();
  await expectPersistedJobState(['PAUSED'], 8 * 60_000);
  await expect(card).toContainText('提纲：等待教师确认');
  await expect(card).toContainText('提纲已持久化');

  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  let outlineAttemptIds: string[] = [];
  try {
    const paused = await loadPersistedTask(prisma);
    const pausedJob = paused.drafts[0].jobs[0];
    expect(pausedJob.state).toBe('PAUSED');
    expect(pausedJob.stages.find((stage) => stage.kind === 'OUTLINE')?.state).toBe('COMPLETED');
    outlineAttemptIds = pausedJob.stages
      .find((stage) => stage.kind === 'OUTLINE')!
      .attempts.map((attempt) => attempt.id);
  } finally {
    await prisma.$disconnect();
  }

  await card.getByRole('button', { name: '确认当前提纲并继续' }).click();
  const postResumeState = await expectPersistedJobState(['COMPLETED', 'RETRYABLE'], 15 * 60_000);
  let teacherRetryEvidence: {
    retriedStage: string;
    preservedCompletedStageAttemptIds: boolean;
  } | null = null;
  if (postResumeState === 'RETRYABLE') {
    const beforeRetryPrisma = createPrismaClient({ log: ['warn', 'error'] });
    let completedAttemptIds: string[] = [];
    let retriedStage = '';
    try {
      const retryable = await loadPersistedTask(beforeRetryPrisma);
      const retryableJob = retryable.drafts[0].jobs[0];
      retriedStage = retryableJob.firstIncompleteStage;
      completedAttemptIds = retryableJob.stages
        .filter((stage) => stage.state === 'COMPLETED')
        .flatMap((stage) => stage.attempts.map((attempt) => attempt.id));
    } finally {
      await beforeRetryPrisma.$disconnect();
    }
    await card.getByRole('button', { name: '恢复/重试' }).click();
    await expectPersistedJobState(['COMPLETED'], 15 * 60_000);
    const afterRetryPrisma = createPrismaClient({ log: ['warn', 'error'] });
    try {
      const completed = await loadPersistedTask(afterRetryPrisma);
      const completedJob = completed.drafts[0].jobs[0];
      const finalIds = new Set(completedJob.stages.flatMap((stage) => stage.attempts.map((attempt) => attempt.id)));
      teacherRetryEvidence = {
        retriedStage,
        preservedCompletedStageAttemptIds: completedAttemptIds.every((id) => finalIds.has(id)),
      };
      expect(teacherRetryEvidence.preservedCompletedStageAttemptIds).toBe(true);
    } finally {
      await afterRetryPrisma.$disconnect();
    }
  }
  await expect(card).toContainText('总结：已完成');

  const evidencePrisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const persisted = await loadPersistedTask(evidencePrisma);
    const job = persisted.drafts[0].jobs[0];
    expect(job.state).toBe('COMPLETED');
    expect(job.stages).toHaveLength(7);
    expect(job.stages.every((stage) => stage.state === 'COMPLETED')).toBe(true);
    expect(job.stages.flatMap((stage) => stage.attempts).every((attempt) =>
      attempt.providerKind !== 'fixture' && attempt.serviceId !== 'smart-lesson-fixture')).toBe(true);
    expect(job.stages.find((stage) => stage.kind === 'OUTLINE')?.attempts.map((attempt) => attempt.id))
      .toEqual(outlineAttemptIds);

    const attempts = job.stages.flatMap((stage) => stage.attempts.map((attempt) => ({
      stage: stage.kind,
      attemptNumber: attempt.attemptNumber,
      kind: attempt.kind,
      correctsAttemptId: attempt.correctsAttemptId,
      serviceId: attempt.serviceId,
      providerKind: attempt.providerKind,
      model: attempt.model,
      promptVersion: attempt.promptVersion,
      schemaVersion: attempt.schemaVersion,
      outcome: attempt.outcome,
      validationReceipt: attempt.validationReceipt,
      inputTokens: attempt.inputTokens,
      outputTokens: attempt.outputTokens,
      costMicros: attempt.costMicros === null ? null : attempt.costMicros.toString(),
      latencyMs: attempt.finishedAt
        ? attempt.finishedAt.getTime() - attempt.startedAt.getTime()
        : null,
    })));
    const evidence = {
      evidenceVersion: 'smart-lesson-real-provider-e2e.v1',
      generatedAt: new Date().toISOString(),
      sourceRevision,
      providerPolicy: {
        fixtureTokenPresent: false,
        allAttemptsUseNonFixtureProvider: true,
      },
      result: {
        jobState: job.state,
        stageCount: job.stages.length,
        completedStages: job.stages.map((stage) => stage.kind),
        correctionAttemptCount: attempts.filter((attempt) => attempt.kind === 'CORRECTION').length,
      },
      recovery: {
        mechanism: 'outline-confirmation-pause-resume',
        pausedAfterOutline: true,
        resumedToFirstIncompleteStage: 'BRIDGE_IN',
        completedOutlineAttemptIdsPreserved: true,
        teacherRetry: teacherRetryEvidence,
      },
      attempts,
      controlledRecoveryCoverage: {
        command: 'npx vitest run --config src/lib/smart-lesson-plan/vitest.config.ts src/lib/smart-lesson-plan/__tests__/worker.test.ts',
        purpose: '受控覆盖单次修正、二次非法暂停、显式教师重试与投递幂等；不替代真实提供商结果。',
      },
      privacy: {
        includesProviderSecret: false,
        includesRawPromptOrResponse: false,
        includesUserPayload: false,
      },
    };
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  } finally {
    await evidencePrisma.$disconnect();
  }
});

async function loadPersistedTask(prisma: ReturnType<typeof createPrismaClient>) {
  return prisma.smartLessonTask.findFirstOrThrow({
    where: { ownerId: teacherId, topic },
    include: {
      drafts: {
        include: {
          jobs: {
            orderBy: { createdAt: 'desc' },
            include: {
              stages: {
                orderBy: { orderIndex: 'asc' },
                include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
              },
            },
          },
        },
      },
    },
  });
}

async function expectPersistedJobState(states: string[], timeout: number) {
  let observed: string | null = null;
  await expect.poll(async () => {
    const prisma = createPrismaClient({ log: ['warn', 'error'] });
    try {
      const task = await loadPersistedTask(prisma);
      observed = task.drafts[0].jobs[0]?.state ?? null;
      return states.includes(observed ?? '');
    } finally {
      await prisma.$disconnect();
    }
  }, {
    timeout,
    intervals: [1_000, 2_500, 5_000],
  }).toBe(true);
  return observed!;
}

async function addTeacherSession(context: BrowserContext) {
  const token = await encode({
    secret: requiredEnv('NEXTAUTH_SECRET'),
    token: {
      id: teacherId,
      email: 'smart-lesson-real-e2e@example.test',
      name: '智能教案真实验收教师',
      role: 'TEACHER',
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 3_600,
  }]);
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}-required`);
  return value;
}
