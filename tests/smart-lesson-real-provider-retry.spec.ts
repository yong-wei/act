import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type BrowserContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import { resolveSmartLessonEvidenceFile } from '../scripts/tests/smart-lesson-evidence-path';
import { createPrismaClient } from '../src/lib/prisma-client';

const teacherId = requiredEnv('SMART_LESSON_E2E_TEACHER_ID');
const topic = requiredEnv('SMART_LESSON_E2E_TOPIC');
const jobId = requiredEnv('SMART_LESSON_E2E_JOB_ID');
const sourceRevision = requiredEnv('SMART_LESSON_E2E_SOURCE_REVISION');
const evidencePath = resolveSmartLessonEvidenceFile('real-provider-explicit-retry.json');

test('teacher explicitly retries the preserved real-provider job without changing completed stages', async ({ page, context }) => {
  expect(requiredEnv('SMART_LESSON_REAL_PROVIDER_REQUIRED')).toBe('1');
  expect(process.env.SMART_LESSON_E2E_FIXTURE_TOKEN).toBeUndefined();
  const before = await loadSnapshot();
  expect(before.job.state).toBe('RETRYABLE');
  expect(before.job.firstIncompleteStage).toBe('PARTICIPATORY_LEARNING');
  const preservedStages = before.stages.filter((stage) => stage.state === 'COMPLETED');
  expect(preservedStages.map((stage) => stage.kind)).toEqual([
    'OUTLINE',
    'BRIDGE_IN',
    'OBJECTIVES',
    'PRE_ASSESSMENT',
  ]);

  await addTeacherSession(context);
  await page.goto('/teacher/smart-prep');
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: topic }) });
  await expect(card).toContainText('生成服务响应超时，请重试当前阶段。');
  await card.getByRole('button', { name: '恢复/重试' }).click();

  const afterRetry = await waitForAttemptGeneration(
    'PARTICIPATORY_LEARNING',
    before.stages.find((stage) => stage.kind === 'PARTICIPATORY_LEARNING')!.providerAttemptGeneration,
  );
  const retryStageBefore = before.stages.find((stage) => stage.kind === 'PARTICIPATORY_LEARNING')!;
  const retryStageAfter = afterRetry.stages.find((stage) => stage.kind === 'PARTICIPATORY_LEARNING')!;
  expect(retryStageAfter.providerAttemptGeneration).toBeGreaterThan(retryStageBefore.providerAttemptGeneration);
  const oldAttempt = retryStageBefore.attempts.at(-1)!;
  const newAttempt = retryStageAfter.attempts.at(-1)!;
  expect(newAttempt.idempotencyKey).not.toBe(oldAttempt.idempotencyKey);
  expect(newAttempt.providerAttemptGeneration).toBeGreaterThan(oldAttempt.providerAttemptGeneration);
  assertCompletedStagesPreserved(preservedStages, afterRetry.stages);

  const terminal = await waitForState(['COMPLETED', 'RETRYABLE', 'FAILED'], 20 * 60_000);
  assertCompletedStagesPreserved(preservedStages, terminal.stages);
  expect(terminal.job.state).toBe('COMPLETED');
  expect(terminal.stages.every((stage) => stage.state === 'COMPLETED')).toBe(true);
  await expect(card).toContainText('总结：已完成');

  const attempts = terminal.stages.flatMap((stage) => stage.attempts.map((attempt) => ({
    stage: stage.kind,
    attemptNumber: attempt.attemptNumber,
    kind: attempt.kind,
    correctsAttemptId: attempt.correctsAttemptId,
    serviceId: attempt.serviceId,
    providerKind: attempt.providerKind,
    model: attempt.model,
    promptVersion: attempt.promptVersion,
    schemaVersion: attempt.schemaVersion,
    providerAttemptGeneration: attempt.providerAttemptGeneration,
    deliveryGeneration: attempt.deliveryGeneration,
    idempotencyKey: attempt.idempotencyKey,
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
    evidenceVersion: 'smart-lesson-real-provider-explicit-retry.v1',
    generatedAt: new Date().toISOString(),
    sourceRevision,
    providerPolicy: {
      fixtureTokenPresent: false,
      allAttemptsUseNonFixtureProvider: attempts.every((attempt) =>
        attempt.providerKind !== 'fixture' && attempt.serviceId !== 'smart-lesson-fixture'),
    },
    retry: {
      stage: 'PARTICIPATORY_LEARNING',
      providerAttemptGenerationBefore: oldAttempt.providerAttemptGeneration,
      providerAttemptGenerationAfter: newAttempt.providerAttemptGeneration,
      idempotencyKeyChanged: oldAttempt.idempotencyKey !== newAttempt.idempotencyKey,
      completedStageHashesAndAttemptIdsPreserved: true,
      preservedStages: preservedStages.map((stage) => ({
        stage: stage.kind,
        outputHash: stage.outputHash,
        attemptIds: stage.attempts.map((attempt) => attempt.id),
      })),
    },
    result: {
      jobState: terminal.job.state,
      completedStages: terminal.stages.map((stage) => stage.kind),
      correctionAttemptCount: attempts.filter((attempt) => attempt.kind === 'CORRECTION').length,
    },
    attempts,
    privacy: {
      includesProviderSecret: false,
      includesRawPromptOrResponse: false,
      includesUserPayload: false,
    },
  };
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
});

async function loadSnapshot() {
  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const job = await prisma.smartLessonGenerationJob.findFirstOrThrow({
      where: { id: jobId, ownerId: teacherId },
      select: { id: true, state: true, firstIncompleteStage: true, failureCode: true, deliveryGeneration: true },
    });
    const stages = await prisma.smartLessonGenerationStage.findMany({
      where: { jobId, ownerId: teacherId },
      orderBy: { orderIndex: 'asc' },
      select: {
        kind: true,
        state: true,
        outputHash: true,
        attemptGeneration: true,
        providerAttemptGeneration: true,
        attempts: {
          orderBy: { attemptNumber: 'asc' },
          select: {
            id: true,
            attemptNumber: true,
            kind: true,
            correctsAttemptId: true,
            serviceId: true,
            providerKind: true,
            model: true,
            promptVersion: true,
            schemaVersion: true,
            providerAttemptGeneration: true,
            deliveryGeneration: true,
            idempotencyKey: true,
            outcome: true,
            validationReceipt: true,
            inputTokens: true,
            outputTokens: true,
            costMicros: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
    });
    return { job, stages };
  } finally {
    await prisma.$disconnect();
  }
}

async function waitForAttemptGeneration(stageKind: string, previousGeneration: number) {
  let snapshot = await loadSnapshot();
  await expect.poll(async () => {
    snapshot = await loadSnapshot();
    return snapshot.stages.find((stage) => stage.kind === stageKind)?.providerAttemptGeneration ?? 0;
  }, {
    timeout: 30_000,
    intervals: [250, 500, 1_000],
  }).toBeGreaterThan(previousGeneration);
  return snapshot;
}

async function waitForState(states: string[], timeout: number) {
  let snapshot = await loadSnapshot();
  await expect.poll(async () => {
    snapshot = await loadSnapshot();
    return states.includes(snapshot.job.state);
  }, {
    timeout,
    intervals: [1_000, 2_500, 5_000],
  }).toBe(true);
  return snapshot;
}

function assertCompletedStagesPreserved(
  before: Awaited<ReturnType<typeof loadSnapshot>>['stages'],
  after: Awaited<ReturnType<typeof loadSnapshot>>['stages'],
) {
  for (const expected of before) {
    const actual = after.find((stage) => stage.kind === expected.kind);
    expect(actual?.state).toBe('COMPLETED');
    expect(actual?.outputHash).toBe(expected.outputHash);
    expect(actual?.attempts.map((attempt) => attempt.id))
      .toEqual(expected.attempts.map((attempt) => attempt.id));
  }
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
