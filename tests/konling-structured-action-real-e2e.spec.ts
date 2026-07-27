import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import { createPrismaClient } from '../src/lib/prisma-client';
import { encodeKonlingE2ESourceBindingsMetadata } from '../src/lib/ai/konling-e2e-chat-model';

const teacherId = requiredEnv('SMART_LESSON_E2E_TEACHER_ID');
const sourceRevision = requiredEnv('SMART_LESSON_E2E_SOURCE_REVISION');
const evidencePath = requiredEnv('SMART_LESSON_E2E_STRUCTURED_ACTION_EVIDENCE_PATH');
const realProvider = process.env.SMART_LESSON_REAL_PROVIDER_REQUIRED === '1';
const providerMode = realProvider ? 'configured-real-provider' : 'deterministic-fixture';
const MODEL_RESPONSE_TIMEOUT_MS = realProvider ? 5 * 60_000 : 30_000;

test('real provider structured actions persist across desktop, maximized history, reload and mobile', async ({ page, context }) => {
  if (realProvider) {
    expect(process.env.SMART_LESSON_E2E_FIXTURE_TOKEN).toBeUndefined();
  } else {
    expect(requiredEnv('SMART_LESSON_E2E_FIXTURE_TOKEN')).toBe('smart-lesson-real-browser-v1');
  }
  await addTeacherSession(context);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/teacher/smart-prep');
  await expect(page.getByRole('heading', { name: '智能教案共创' })).toBeVisible();

  const courseBasis = await loadCourseBasisFixture();
  await page.getByRole('button', { name: '用自然语言创建任务' }).click();
  const sidebar = page.locator('[data-konling-assistant-surface="global-sidebar"]');
  await expect(sidebar).toHaveAttribute('data-konling-presentation-mode', 'side');

  await sendPrompt(page, bootstrapPrompt(courseBasis));
  const bootstrapCard = latestActionCard(sidebar);
  await expect(bootstrapCard).toBeVisible({ timeout: MODEL_RESPONSE_TIMEOUT_MS });
  await assertNoStructuredMarkupLeak(sidebar);
  await expect(bootstrapCard.getByRole('button', { name: '应用' })).toBeEnabled();
  await expect(bootstrapCard.getByRole('button', { name: '忽略' })).toBeEnabled();

  const toolRunsAfterBootstrap = await structuredToolRunCount();
  expect(toolRunsAfterBootstrap).toBe(1);
  await bootstrapCard.getByRole('button', { name: '应用' }).click();
  await expect(bootstrapCard).toHaveAttribute('data-action-state', 'applied');
  await expect(bootstrapCard.getByRole('status')).toContainText('已创建备课任务');

  const createdTask = await loadCreatedTask();
  const taskCard = page.locator('article').filter({
    has: page.getByRole('heading', { name: createdTask.topic }),
  });
  await expect(taskCard).toBeVisible();
  await expect(page.locator('[data-konling-highlighted-stage="topic-goals"]')).toBeVisible();

  await page.getByRole('button', { name: '最大化控灵工作区' }).click();
  await expect(sidebar).toHaveAttribute('data-konling-presentation-mode', 'maximized');
  await expect(sidebar.locator('[data-konling-conversation-library]')).toBeVisible();
  await expect(bootstrapCard).toHaveAttribute('data-action-state', 'applied');
  expect(await structuredToolRunCount()).toBe(toolRunsAfterBootstrap);
  await page.getByRole('button', { name: '恢复控灵侧栏' }).click();
  await expect(sidebar).toHaveAttribute('data-konling-presentation-mode', 'side');

  await page.reload();
  await expect(page.getByRole('heading', { name: '智能教案共创' })).toBeVisible();
  const reloadedTaskCard = page.locator('article').filter({
    has: page.getByRole('heading', { name: createdTask.topic }),
  });
  await reloadedTaskCard.getByRole('button', { name: '与控灵共创' }).click();
  const reloadedSidebar = page.locator('[data-konling-assistant-surface="global-sidebar"]');
  await expect(reloadedSidebar.locator('[data-konling-structured-action-card][data-action-state="applied"]')).toHaveCount(1);
  expect(await structuredToolRunCount()).toBe(toolRunsAfterBootstrap);

  await sendPrompt(page, revisionPrompt(createdTask.id, '请把先修要求改为传递函数与复数基础。'));
  const ignoredCard = latestActionCard(reloadedSidebar);
  await expect(ignoredCard).toHaveAttribute('data-action-state', 'pending', { timeout: MODEL_RESPONSE_TIMEOUT_MS });
  const taskBeforeIgnore = await loadCreatedTask();
  await ignoredCard.getByRole('button', { name: '忽略' }).click();
  await expect(ignoredCard).toHaveAttribute('data-action-state', 'ignored');
  expect((await loadCreatedTask()).revision).toBe(taskBeforeIgnore.revision);

  await sendPrompt(page, revisionPrompt(createdTask.id, '请把课时调整为六十分钟。'));
  const conflictCard = latestActionCard(reloadedSidebar);
  await expect(conflictCard).toHaveAttribute('data-action-state', 'pending', { timeout: MODEL_RESPONSE_TIMEOUT_MS });
  const toolRunsBeforeConflict = await structuredToolRunCount();
  await advanceTaskRevision(createdTask.id);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(conflictCard).toBeVisible();
  await expect(conflictCard.getByRole('button', { name: '应用' })).toBeEnabled();
  await expect(reloadedSidebar.locator('[data-konling-chat-renderer="shared"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await conflictCard.getByRole('button', { name: '应用' }).click();
  await expect(conflictCard).toHaveAttribute('data-action-state', 'conflict');
  await expect(conflictCard.getByRole('button', { name: '刷新任务' })).toBeEnabled();
  await conflictCard.getByRole('button', { name: '刷新任务' }).click();
  await expect(reloadedSidebar.getByRole('status')).toContainText(/已刷新任务和会话状态|任务已发生变化/);
  expect(await structuredToolRunCount()).toBe(toolRunsBeforeConflict);
  await assertNoStructuredMarkupLeak(reloadedSidebar);

  await writeEvidence({
    evidenceVersion: 'konling-structured-action-real-provider-browser.v1',
    generatedAt: new Date().toISOString(),
    sourceRevision,
    providerMode,
    routeInterception: false,
    desktop: {
      viewport: '1440x1000',
      sideCardReadableAndActionable: true,
      maximizedHistoryRestoredAppliedCard: true,
      reloadRestoredAppliedCard: true,
    },
    mobile: {
      viewport: '390x844',
      cardReadableAndActionable: true,
      singleSharedRendererMount: true,
      noHorizontalOverflow: true,
    },
    toolRuns: {
      afterFirstProposal: toolRunsAfterBootstrap,
      final: toolRunsBeforeConflict,
      noRerunAfterApplyReloadHistoryOrRefresh: true,
    },
    actions: {
      apply: 'applied',
      ignore: 'ignored',
      conflict: 'conflict',
      refresh: 'completed',
    },
    persistence: {
      taskAndAccordionUpdated: true,
      appliedStateRestored: true,
    },
    privacy: {
      containsUserIdentifiers: false,
      containsProviderSecret: false,
      containsRawProviderPayload: false,
      rawToolMarkupVisible: false,
    },
    cleanup: {
      completed: false,
      finalizedByRunnerAfterResourceCleanup: true,
    },
  });
});

function latestActionCard(sidebar: Locator) {
  return sidebar.locator('[data-konling-structured-action-card]').last();
}

async function sendPrompt(page: Page, prompt: string) {
  const input = page.getByLabel('全局 AI 问题输入框');
  await expect(input).toBeEnabled();
  await input.fill(prompt);
  await page.getByRole('button', { name: '发送 AI 问题' }).click();
}

async function assertNoStructuredMarkupLeak(sidebar: Locator) {
  const visibleText = await sidebar.locator('[data-konling-message-content]').allTextContents();
  const encoded = visibleText.join('\n');
  expect(encoded).not.toMatch(/<tool_call|<\/tool_call>|<function_calls|dsml|propose_smart_lesson_task_change/i);
}

function bootstrapPrompt(courseBasis: Awaited<ReturnType<typeof loadCourseBasisFixture>>) {
  const metadata = encodeKonlingE2ESourceBindingsMetadata({
    sourceVersionId: courseBasis.versionId,
    bindings: courseBasis.bindings,
  });
  return [
    '请用自然语言创建一项自动控制原理备课任务，并生成可确认的结构化建议。',
    '主题为根轨迹幅值条件、相角条件与基本绘图规则，面向自动化专业本科生，先修要求为传递函数，课时45分钟，生成提纲后暂停确认。',
    '知识点包括相角条件、幅值条件和基本绘图规则；教学目标是学生能运用相角条件判断候选点。范围与目标均已确认。',
    '选择幅值与相角条件。',
    `courseBasisId=${courseBasis.courseBasisId}; sourceVersionId=${courseBasis.versionId}`,
    metadata,
  ].join(' ');
}

function revisionPrompt(taskId: string, request: string) {
  return `修订约束 taskId=${taskId}。${request} 请生成一条可确认的结构化修订建议，不要直接修改任务。`;
}

async function loadCourseBasisFixture() {
  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const basis = await prisma.courseBasis.findFirstOrThrow({
      where: { ownerId: teacherId },
      include: {
        documents: {
          include: {
            versions: {
              include: { segments: { orderBy: { orderIndex: 'asc' } } },
              orderBy: { versionNumber: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    const version = basis.documents[0]?.versions[0];
    if (!version || version.segments.length < 1) throw new Error('structured-action-course-basis-fixture-incomplete');
    const seedBindings = version.segments.map((segment) => ({
      stableAnchor: segment.stableAnchor,
      contentHash: segment.contentHash,
    }));
    while (seedBindings.length < 3) seedBindings.push(seedBindings[0]);
    return {
      courseBasisId: basis.id,
      versionId: version.id,
      bindings: seedBindings.slice(0, 3),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function structuredToolRunCount() {
  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    return await prisma.agentToolRun.count({
      where: { ownerUserId: teacherId, toolName: 'propose_smart_lesson_task_change' },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function loadCreatedTask() {
  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    return await prisma.smartLessonTask.findFirstOrThrow({
      where: { ownerId: teacherId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, topic: true, revision: true },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function advanceTaskRevision(taskId: string) {
  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    await prisma.smartLessonTask.update({
      where: { id: taskId },
      data: { revision: { increment: 1 } },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function writeEvidence(value: Record<string, unknown>) {
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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
