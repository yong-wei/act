import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import { createPrismaClient } from '../src/lib/prisma-client';
import { encodeKonlingE2ESourceBindingsMetadata } from '../src/lib/ai/konling-e2e-chat-model';
import {
  claimKonlingConversationTurn,
  completeKonlingConversationTurn,
} from '../src/lib/konling-conversation-library';
import { updateTaskSchema } from '../src/lib/smart-lesson-plan/task-input-schema';

const teacherId = requiredEnv('SMART_LESSON_E2E_TEACHER_ID');
const sourceRevision = requiredEnv('SMART_LESSON_E2E_SOURCE_REVISION');
const evidencePath = requiredEnv('SMART_LESSON_E2E_STRUCTURED_ACTION_EVIDENCE_PATH');
const realProvider = process.env.SMART_LESSON_REAL_PROVIDER_REQUIRED === '1';
const providerMode = realProvider ? 'configured-real-provider' : 'deterministic-fixture';
const MODEL_RESPONSE_TIMEOUT_MS = realProvider ? 6 * 60_000 : 30_000;
const UI_ACTION_TIMEOUT_MS = 10_000;

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
  await page.getByRole('button', { name: '用自然语言创建任务' }).click({ timeout: UI_ACTION_TIMEOUT_MS });
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
  await bootstrapCard.getByRole('button', { name: '应用' }).click({ timeout: UI_ACTION_TIMEOUT_MS });
  await expect(bootstrapCard).toHaveAttribute('data-action-state', 'applied');
  await expect(bootstrapCard.getByRole('status')).toContainText('已创建备课任务');

  const createdTask = await loadCreatedTask();
  const taskCard = page.locator('article').filter({
    has: page.getByRole('heading', { name: createdTask.topic }),
  });
  await expect(taskCard).toBeVisible();
  await expect(page.locator('[data-konling-highlighted-stage="topic-goals"]')).toBeVisible();

  await page.getByRole('button', { name: '最大化控灵工作区' }).click({ timeout: UI_ACTION_TIMEOUT_MS });
  await expect(sidebar).toHaveAttribute('data-konling-presentation-mode', 'maximized');
  await expect(sidebar.locator('[data-konling-conversation-library]')).toBeVisible();
  await expect(bootstrapCard).toHaveAttribute('data-action-state', 'applied');
  expect(await structuredToolRunCount()).toBe(toolRunsAfterBootstrap);
  await page.getByRole('button', { name: '恢复控灵侧栏' }).click({ timeout: UI_ACTION_TIMEOUT_MS });
  await expect(sidebar).toHaveAttribute('data-konling-presentation-mode', 'side');

  await page.reload();
  await expect(page.getByRole('heading', { name: '智能教案共创' })).toBeVisible();
  const globalKonlingEntry = page.getByRole('button', { name: '打开控灵', exact: true });
  await expect(globalKonlingEntry).toBeVisible({ timeout: UI_ACTION_TIMEOUT_MS });
  await globalKonlingEntry.click({ timeout: UI_ACTION_TIMEOUT_MS });
  const reloadedSidebar = page.locator('[data-konling-assistant-surface="global-sidebar"]');
  await expect(reloadedSidebar).toBeVisible({ timeout: UI_ACTION_TIMEOUT_MS });
  await expect(reloadedSidebar.locator('[data-konling-structured-action-card][data-action-state="applied"]')).toHaveCount(1, {
    timeout: UI_ACTION_TIMEOUT_MS,
  });
  expect(await structuredToolRunCount()).toBe(toolRunsAfterBootstrap);

  await seedGovernedRevisionProposal(page, createdTask.id, 'ignore');
  await reloadAndOpenGlobalKonling(page);
  const ignoredCard = latestActionCard(reloadedSidebar);
  await expect(ignoredCard).toHaveAttribute('data-action-state', 'pending', { timeout: UI_ACTION_TIMEOUT_MS });
  const taskBeforeIgnore = await loadCreatedTask();
  await ignoredCard.getByRole('button', { name: '忽略' }).click({ timeout: UI_ACTION_TIMEOUT_MS });
  await expect(ignoredCard).toHaveAttribute('data-action-state', 'ignored');
  expect((await loadCreatedTask()).revision).toBe(taskBeforeIgnore.revision);
  expect(await structuredToolRunCount()).toBe(toolRunsAfterBootstrap + 1);

  await seedGovernedRevisionProposal(page, createdTask.id, 'conflict');
  await reloadAndOpenGlobalKonling(page);
  const conflictCard = latestActionCard(reloadedSidebar);
  await expect(conflictCard).toHaveAttribute('data-action-state', 'pending', { timeout: UI_ACTION_TIMEOUT_MS });
  const toolRunsBeforeConflict = await structuredToolRunCount();
  expect(toolRunsBeforeConflict).toBe(toolRunsAfterBootstrap + 2);
  await advanceTaskRevision(createdTask.id);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(conflictCard).toBeVisible();
  await expect(conflictCard.getByRole('button', { name: '应用' })).toBeEnabled();
  await expect(reloadedSidebar.locator('[data-konling-chat-renderer="shared"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await conflictCard.getByRole('button', { name: '应用' }).click({ timeout: UI_ACTION_TIMEOUT_MS });
  await expect(conflictCard).toHaveAttribute('data-action-state', 'conflict');
  await expect(conflictCard.getByRole('button', { name: '刷新任务' })).toBeEnabled();
  await conflictCard.getByRole('button', { name: '刷新任务' }).click({ timeout: UI_ACTION_TIMEOUT_MS });
  await expect(reloadedSidebar.getByRole('status')).toContainText(/已刷新任务和会话状态|任务已发生变化/);
  expect(await structuredToolRunCount()).toBe(toolRunsBeforeConflict);
  await assertNoStructuredMarkupLeak(reloadedSidebar);

  await writeEvidence({
    evidenceVersion: 'konling-structured-action-real-provider-browser.v1',
    generatedAt: new Date().toISOString(),
    sourceRevision,
    providerMode,
    routeInterception: false,
    realProviderStructuredSuccessCount: realProvider ? 1 : 0,
    secondaryScenarioSource: 'seeded-governed-records',
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
      realProviderStructuredSuccessCount: realProvider ? 1 : 0,
      seededGovernedScenarioCount: 2,
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
  await page.getByRole('button', { name: '发送 AI 问题' }).click({ timeout: UI_ACTION_TIMEOUT_MS });
}

async function reloadAndOpenGlobalKonling(page: Page) {
  await page.reload();
  await expect(page.getByRole('heading', { name: '智能教案共创' })).toBeVisible({
    timeout: UI_ACTION_TIMEOUT_MS,
  });
  const entry = page.getByRole('button', { name: '打开控灵', exact: true });
  await expect(entry).toBeVisible({ timeout: UI_ACTION_TIMEOUT_MS });
  await entry.click({ timeout: UI_ACTION_TIMEOUT_MS });
  await expect(page.locator('[data-konling-assistant-surface="global-sidebar"]')).toBeVisible({
    timeout: UI_ACTION_TIMEOUT_MS,
  });
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

async function seedGovernedRevisionProposal(page: Page, taskId: string, scenario: 'ignore' | 'conflict') {
  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const taskResponse = await page.request.get(
      `/api/teacher/smart-lesson-tasks/${encodeURIComponent(taskId)}`,
    );
    expect(taskResponse.ok()).toBe(true);
    const task = recordValue(recordValue(await taskResponse.json()).task);
    const candidateSessions = await prisma.agentSession.findMany({
      where: {
        ownerUserId: teacherId,
        actorUserId: teacherId,
        konlingSessionId: { not: null },
        pageId: '/teacher/smart-prep',
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    const agentSession = candidateSessions.find((candidate) =>
      recordValue(recordValue(candidate.stateJson).smartPrepBinding).taskId === taskId);
    if (!agentSession?.konlingSessionId) throw new Error('structured-action-agent-session-not-found');
    const scope = {
      authenticatedUserId: teacherId,
      targetUserId: teacherId,
      role: 'teacher' as const,
      classId: agentSession.classId,
      courseId: agentSession.courseId,
      pageId: agentSession.pageId,
      resourceId: agentSession.resourceId,
      pathNodeId: agentSession.pathNodeId,
      privacyScopes: ['teacher-scoped' as const],
    };
    const actionId = `e2e-${scenario}-${randomUUID()}`;
    const toolRunId = `e2e-tool-run-${randomUUID()}`;
    const turnId = `e2e-turn-${scenario}-${randomUUID()}`;
    const now = new Date();
    const sessionState = recordValue(agentSession.stateJson);
    const proposedTask = {
      courseBasisId: stringValue(task.courseBasisId),
      topic: stringValue(task.topic),
      audience: stringValue(task.audience),
      prerequisites: scenario === 'ignore'
        ? '传递函数与复数基础'
        : stringValue(task.prerequisites),
      durationMinutes: scenario === 'conflict' ? 60 : Number(task.durationMinutes),
      outlineConfirmationRequired: task.outlineConfirmationRequired === true,
      sourceVersionIds: Array.isArray(task.sources)
        ? task.sources
            .map((source) => recordValue(source).sourceVersionId)
            .filter((value): value is string => typeof value === 'string')
        : [],
      textbookRanges: Array.isArray(task.textbookRanges) ? task.textbookRanges : [],
      selectedClassId: typeof task.selectedClassId === 'string' ? task.selectedClassId : null,
      knowledgePoints: Array.isArray(task.knowledgePoints) ? task.knowledgePoints : [],
      goals: Array.isArray(task.goals) ? task.goals : [],
      confirmScope: Boolean(task.scopeConfirmedAt),
      confirmGoals: Boolean(task.goalsConfirmedAt),
    };
    const expectedRevision = Number(task.revision);
    updateTaskSchema.parse({
      ...proposedTask,
      expectedRevision,
      confirmingTurnId: turnId,
      agentSessionId: agentSession.id,
    });
    const changedFields = scenario === 'ignore' ? ['prerequisites'] : ['durationMinutes'];
    const inputSummary = {
      operation: 'revise',
      publicActionId: actionId,
      taskId,
      expectedRevision,
      turnId,
      proposedTask,
      affectedStageId: 'topic-goals',
      changedFields,
    };
    const outputSummary = {
      suggestionId: actionId,
      operation: 'revise',
      taskId,
      expectedRevision,
      turnId,
      status: 'awaiting_teacher_confirmation',
    };
    const ownedTurnIds = Array.isArray(sessionState.ownedTurnIds)
      ? sessionState.ownedTurnIds.filter((value): value is string => typeof value === 'string')
      : [];
    const claimed = await claimKonlingConversationTurn(prisma, {
      conversationId: agentSession.konlingSessionId,
      ownerUserId: teacherId,
      currentScope: scope,
      userMessage: {
        id: turnId,
        role: 'user',
        content: `验收场景：${scenario === 'ignore' ? '忽略受治理修订建议' : '处理过期受治理修订建议'}。`,
      },
      now,
    });
    if (!claimed) throw new Error('structured-action-conversation-claim-failed');
    await prisma.agentSession.update({
      where: { id: agentSession.id },
      data: {
        stateJson: {
          ...sessionState,
          currentTurnId: turnId,
          ownedTurnIds: [...new Set([...ownedTurnIds, turnId])].slice(-50),
        },
      },
    });
    await prisma.agentToolRun.create({
      data: {
        id: toolRunId,
        agentSessionId: agentSession.id,
        ownerUserId: teacherId,
        actorUserId: teacherId,
        targetUserId: teacherId,
        classId: agentSession.classId,
        courseId: agentSession.courseId,
        pageId: agentSession.pageId,
        resourceId: agentSession.resourceId,
        pathNodeId: agentSession.pathNodeId,
        toolName: 'propose_smart_lesson_task_change',
        permissionTier: 'write',
        approvalState: 'not_required',
        status: 'succeeded',
        inputSummary,
        outputSummary,
        idempotencyKey: `e2e:${actionId}`,
        correlationId: actionId,
        completedAt: now,
        latencyMs: 0,
      },
    });
    await completeKonlingConversationTurn(prisma, {
      conversationId: agentSession.konlingSessionId,
      ownerUserId: teacherId,
      turnId,
      assistantMessage: {
        id: `assistant-${actionId}`,
        role: 'assistant',
        content: '',
      },
      now: new Date(now.getTime() + 1),
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

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}
