import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import { createPrismaClient } from '../src/lib/prisma-client';

const teacherId = requiredEnv('SMART_LESSON_E2E_TEACHER_ID');
const classId = requiredEnv('SMART_LESSON_E2E_CLASS_ID');
const topic = requiredEnv('SMART_LESSON_E2E_TOPIC');
const sourceRevision = requiredEnv('SMART_LESSON_E2E_SOURCE_REVISION');
const evidencePath = path.join(
  process.cwd(),
  'openspec/changes/integrate-smart-preparation-rag-grounding/evidence/real-provider-continuous-teacher-flow.json',
);

test('continuous real-teacher preparation flow uses governed sources, current portrait and real provider', async ({ page, context }) => {
  expect(requiredEnv('SMART_LESSON_REAL_PROVIDER_REQUIRED')).toBe('1');
  expect(process.env.SMART_LESSON_E2E_FIXTURE_TOKEN).toBeUndefined();
  await addTeacherSession(context);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto('/teacher/smart-prep');
  await expect(page.getByRole('heading', { name: '智能教案共创' })).toBeVisible();
  await createCourseBasisAndUpload(page);
  await page.getByRole('button', { name: '备课任务' }).click();
  await createTask(page);

  let card = taskCard(page);
  await expect(card).toContainText('已确认 1 个平台教材结构范围');
  await expect(card).toContainText('来源已验证');
  await card.getByRole('button', { name: '开始生成' }).click();
  await expectPersistedJobState(['PAUSED'], 8 * 60_000);
  await card.getByRole('button', { name: '刷新进度' }).click();
  await expect(card).toContainText('提纲：等待教师确认');

  const beforeFailure = await generationSnapshot();
  const outlineAttemptIds = beforeFailure.job.stages
    .find((stage) => stage.kind === 'OUTLINE')!.attempts.map((attempt) => attempt.id);
  await card.getByRole('button', { name: '确认当前提纲并继续' }).click();
  await expectPersistedJobState(['RETRYABLE'], 60_000);
  const failedSnapshot = await generationSnapshot();
  const failedBridgeAttempt = failedSnapshot.job.stages
    .find((stage) => stage.kind === 'BRIDGE_IN')!.attempts.at(-1)!;
  expect(failedBridgeAttempt.outcome).toBe('RETRYABLE_FAILURE');
  expect(failedSnapshot.job.failureCode).toBe('provider-timeout');
  await page.reload();
  card = taskCard(page);
  await expect(card).toContainText('生成服务响应超时，请重试当前阶段。');
  await card.getByRole('button', { name: '恢复/重试' }).click();
  await expectPersistedJobState(['COMPLETED'], 20 * 60_000);
  await card.getByRole('button', { name: '刷新进度' }).click();
  await expect(card).toContainText('总结：已完成');

  await card.getByRole('button', { name: '编辑教案' }).click();
  await expect(page.getByText(`${topic} · BOPPPS 教案`)).toBeVisible();
  const teacherActivity = page.getByLabel('教师活动').first();
  await teacherActivity.fill(`${await teacherActivity.inputValue()}\n教师补充：比较稳定与临界稳定结果。`);
  await expect(page.getByRole('status')).toContainText('修改已可靠保存', { timeout: 30_000 });
  await page.getByRole('button', { name: '返回备课任务' }).click();

  card = taskCard(page);
  await card.getByRole('button', { name: '编辑教案' }).click();
  await expect(page.getByLabel('教师活动').first()).toHaveValue(/教师补充：比较稳定与临界稳定结果。/);
  await page.getByRole('button', { name: '返回备课任务' }).click();
  card = taskCard(page);
  await card.getByRole('button', { name: 'AI 建议' }).click();
  await expect(page.getByRole('status')).toContainText('AI 建议已生成', { timeout: 8 * 60_000 });
  await page.reload();
  card = taskCard(page);
  await expect(card).toContainText('审核建议已生成');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  card = taskCard(page);
  await expect(card.getByRole('heading', { name: topic })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await card.getByRole('button', { name: '编辑教案' }).click();
  await expect(page.getByRole('button', { name: '返回备课任务' })).toBeVisible();
  await expect(page.getByLabel('教师活动').first()).toHaveValue(/教师补充：比较稳定与临界稳定结果。/);
  await page.getByRole('button', { name: '返回备课任务' }).click();
  card = taskCard(page);

  const snapshot = await acceptanceSnapshot();
  expect(snapshot.task.selectedClassId).toBe(classId);
  expect(snapshot.task.aggregateClassContextRef).toMatch(/^cumulative-class-portrait:/);
  expect(snapshot.task.textbookRanges).toHaveLength(1);
  expect(snapshot.version.reviewState).toBe('CONFIRMED');
  expect(snapshot.job.stages).toHaveLength(7);
  expect(snapshot.job.stages.every((stage) => stage.state === 'COMPLETED')).toBe(true);
  expect(snapshot.job.stages.find((stage) => stage.kind === 'OUTLINE')?.attempts.map((attempt) => attempt.id))
    .toEqual(outlineAttemptIds);
  const finalBridgeAttempt = snapshot.job.stages
    .find((stage) => stage.kind === 'BRIDGE_IN')!.attempts.at(-1)!;
  expect(finalBridgeAttempt.id).not.toBe(failedBridgeAttempt.id);
  expect(finalBridgeAttempt.outcome).toBe('SUCCEEDED');
  const attempts = snapshot.job.stages.flatMap((stage) => stage.attempts);
  expect(attempts.length).toBeGreaterThanOrEqual(7);
  expect(attempts.every((attempt) =>
    attempt.providerKind !== 'fixture' && attempt.serviceId !== 'smart-lesson-fixture')).toBe(true);

  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', { name: '永久删除' }).click();
  await expect(page.getByRole('status')).toContainText('任务已永久删除');
  await expect.poll(async () => deletedTaskCount()).toBe(0);

  await writeEvidence({
    sourceRevision,
    providerMode: 'configured-real-provider',
    routeInterception: false,
    acceptance: {
      courseBasisCreatedInBrowser: true,
      documentUploadedInBrowser: true,
      confirmedTextbookRange: true,
      currentCumulativeDefaultClassPortrait: true,
      fullBopppsCompleted: true,
      injectedFailureRecovered: true,
      editorSavePersisted: true,
      aiSuggestionsPersisted: true,
      reopenedTask: true,
      deletedUnpublishedTask: true,
      desktopViewport: '1440x1000',
      narrowViewport: '390x844',
    },
    recovery: {
      injectedAtStage: 'BRIDGE_IN',
      failurePath: 'worker-beginProviderAttempt-to-failGenerationStage',
      failureCode: failedSnapshot.job.failureCode,
      failedAttemptOutcome: failedBridgeAttempt.outcome,
      retryCreatedNewAttempt: finalBridgeAttempt.id !== failedBridgeAttempt.id,
      completedOutlineAttemptIdsPreserved: true,
    },
    result: {
      stageCount: snapshot.job.stages.length,
      completedStages: snapshot.job.stages.map((stage) => stage.kind),
      allAttemptsUseNonFixtureProvider: true,
    },
    attempts: attempts.map((attempt) => ({
      stage: attempt.stage.kind,
      attemptNumber: attempt.attemptNumber,
      kind: attempt.kind,
      serviceId: attempt.serviceId,
      providerKind: attempt.providerKind,
      model: attempt.model,
      outcome: attempt.outcome,
      inputTokens: attempt.inputTokens,
      outputTokens: attempt.outputTokens,
      latencyMs: attempt.finishedAt
        ? attempt.finishedAt.getTime() - attempt.startedAt.getTime()
        : null,
    })),
    privacy: {
      includesProviderSecret: false,
      includesRawPromptOrResponse: false,
      includesPersonalData: false,
    },
  });
});

async function createCourseBasisAndUpload(page: Page) {
  await page.getByRole('button', { name: '课程依据' }).click();
  await page.getByPlaceholder('课程标识，如 AUTO-101').fill(`AUTO-${process.pid}`);
  await page.getByPlaceholder('课程依据名称').fill('自动控制原理真实验收依据');
  await page.getByRole('button', { name: '新建课程依据' }).click();
  await expect(page.getByRole('status')).toContainText('课程依据已创建');
  await page.getByPlaceholder('文档名称').fill('闭环稳定性课程标准');
  await page.getByRole('button', { name: '添加文档' }).click();
  await expect(page.getByRole('status')).toContainText('文档已创建');
  const documentCard = page.locator('article').filter({ has: page.getByRole('heading', { name: /闭环稳定性课程标准/ }) });
  await documentCard.locator('input[type="file"]').setInputFiles({
    name: 'closed-loop-stability.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('闭环稳定性判据包括特征方程、劳斯判据、临界稳定与稳定裕度。'),
  });
  await documentCard.getByRole('button', { name: '导入新版本' }).click();
  await expect(page.getByRole('status')).toContainText('版本已提取');
}

async function createTask(page: Page) {
  await page.getByPlaceholder('单课主题').fill(topic);
  await page.getByPlaceholder('授课对象').fill('自动化专业本科生');
  await page.getByPlaceholder('确认知识点').fill('闭环稳定性判据');
  await page.getByPlaceholder('确认教学目标').fill('能够依据特征方程判断闭环系统稳定性');
  await page.getByPlaceholder('先修要求（可选）').fill('传递函数与特征方程');
  const textbookRange = page.getByText('平台教材建议范围', { exact: true }).locator('..').locator('select');
  await textbookRange.selectOption({ index: 1 });
  await page.getByLabel('确认采用此教材范围').check();
  await expect(page.locator('select[name="selectedClassId"]')).toHaveValue(classId);
  await page.locator('select[name="durationMinutes"]').selectOption('30');
  await page.getByLabel('生成提纲后暂停确认').check();
  await page.getByRole('button', { name: '确认并创建单课任务' }).click();
  await expect(page.getByRole('status')).toContainText('单课任务已确认');
}

function taskCard(page: Page) {
  return page.locator('article').filter({ has: page.getByRole('heading', { name: topic }) });
}

async function acceptanceSnapshot() {
  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const task = await loadPersistedTask(prisma);
    const version = await prisma.courseBasisDocumentVersion.findFirstOrThrow({
      where: { document: { courseBasis: { ownerId: teacherId } } },
      select: { reviewState: true },
    });
    return { task, job: task.drafts[0].jobs[0], version };
  } finally {
    await prisma.$disconnect();
  }
}

async function generationSnapshot() {
  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const task = await loadPersistedTask(prisma);
    return { task, job: task.drafts[0].jobs[0] };
  } finally {
    await prisma.$disconnect();
  }
}

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
                include: { attempts: { orderBy: { attemptNumber: 'asc' }, include: { stage: true } } },
              },
            },
          },
        },
      },
    },
  });
}

async function expectPersistedJobState(states: string[], timeout: number) {
  await expect.poll(async () => {
    const prisma = createPrismaClient({ log: ['warn', 'error'] });
    try {
      const task = await loadPersistedTask(prisma);
      return states.includes(task.drafts[0].jobs[0]?.state ?? '');
    } finally {
      await prisma.$disconnect();
    }
  }, { timeout, intervals: [1_000, 2_500, 5_000] }).toBe(true);
}

async function deletedTaskCount() {
  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    return prisma.smartLessonTask.count({ where: { ownerId: teacherId, topic } });
  } finally {
    await prisma.$disconnect();
  }
}

async function writeEvidence(value: Record<string, unknown>) {
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify({
    evidenceVersion: 'smart-lesson-real-provider-continuous-teacher-flow.v1',
    generatedAt: new Date().toISOString(),
    ...value,
  }, null, 2)}\n`, 'utf8');
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
