import { expect, test, type BrowserContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import { createPrismaClient } from '../src/lib/prisma-client';

const teacherId = requiredEnv('SMART_LESSON_E2E_TEACHER_ID');
const topic = `闭环稳定性真实端到端 ${process.pid}`;

test.describe.configure({ mode: 'serial' });

test('uses the real browser, API, worker, Source Pack and fixture provider through approval', async ({ page, context }) => {
  await addTeacherSession(context);
  const apiResponses: Array<{ method: string; path: string; status: number }> = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/teacher/smart-lesson-tasks')) {
      apiResponses.push({ method: response.request().method(), path: url.pathname, status: response.status() });
    }
  });

  await page.goto('/teacher/smart-prep');
  await expect(page.getByRole('heading', { name: '智能教案共创' })).toBeVisible();
  await page.getByPlaceholder('单课主题').fill(topic);
  await page.getByPlaceholder('授课对象').fill('自动化专业本科生');
  await page.getByPlaceholder('确认知识点').fill('闭环稳定性判据');
  await page.getByPlaceholder('确认教学目标').fill('判断闭环系统稳定性');
  await page.getByPlaceholder('先修要求（可选）').fill('传递函数与特征方程');
  await page.locator('select[name="durationMinutes"]').selectOption('30');
  await page.getByLabel('生成提纲后暂停确认').check();
  await page.getByRole('button', { name: '确认并创建单课任务' }).click();
  await expect(page.getByRole('status').filter({ hasText: '单课任务已确认' })).toBeVisible();

  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: topic }) });
  await expect(card).toContainText('教师创建，来源待补');
  await card.getByRole('button', { name: '开始生成' }).click();
  await expect(page.getByRole('status').filter({ hasText: '生成任务已进入队列' })).toBeVisible();
  await refreshUntil(card, '任务 PAUSED');
  await expect(card).toContainText('OUTLINE: COMPLETED');
  await expect(card).toContainText('闭环特征方程与稳定性判据');

  await card.getByRole('button', { name: '确认当前提纲并继续' }).click();
  await expect(page.getByRole('status').filter({ hasText: '生成任务已恢复' })).toBeVisible();
  await refreshUntil(card, '任务 COMPLETED');
  await card.getByText('查看完整教案').click();
  await expect(card).toContainText('smart-lesson-plan.boppps.v1');
  await expect(card).toContainText('PARTICIPATORY_LEARNING: COMPLETED');

  await card.getByRole('button', { name: 'AI 建议' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'AI 建议已生成' })).toBeVisible();
  await expect(card).toContainText('BOPPPS 六阶段结构完整');
  await card.getByRole('button', { name: '批准版本' }).click();
  await expect(page.getByRole('status').filter({ hasText: '教案第1版 已冻结' })).toBeVisible();
  await expect(card).toContainText('最新：教案第1版');

  expect(apiResponses).toEqual(expect.arrayContaining([
    expect.objectContaining({ method: 'POST', path: '/api/teacher/smart-lesson-tasks', status: 201 }),
    expect.objectContaining({ method: 'POST', path: expect.stringMatching(/\/drafts\/[^/]+\/generation$/), status: 202 }),
    expect.objectContaining({ method: 'POST', path: expect.stringMatching(/\/jobs\/[^/]+$/), status: 200 }),
    expect.objectContaining({ method: 'POST', path: expect.stringMatching(/\/advisory-reviews$/), status: 201 }),
    expect.objectContaining({ method: 'POST', path: expect.stringMatching(/\/approve$/), status: 201 }),
  ]));

  const prisma = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const persisted = await prisma.smartLessonTask.findFirstOrThrow({
      where: { ownerId: teacherId, topic },
      include: {
        revisions: true,
        drafts: {
          include: {
            reviews: true,
            jobs: { include: { stages: { include: { attempts: true } } } },
          },
        },
      },
    });
    const completedJob = persisted.drafts[0].jobs.find((job) => job.state === 'COMPLETED');
    expect(completedJob?.stages).toHaveLength(7);
    expect(completedJob?.stages.every((stage) => stage.state === 'COMPLETED')).toBe(true);
    expect(completedJob?.stages.flatMap((stage) => stage.attempts)).toHaveLength(7);
    expect(completedJob?.stages.flatMap((stage) => stage.attempts).every((attempt) =>
      attempt.serviceId === 'smart-lesson-fixture' && attempt.outcome === 'SUCCEEDED')).toBe(true);
    expect(JSON.stringify(completedJob?.stages[0].attempts[0].requestSnapshot)).toContain('sourcePackItems');
    expect(persisted.drafts[0].reviews).toEqual([
      expect.objectContaining({ state: 'COMPLETED', advisoryOnly: true }),
    ]);
    expect(persisted.revisions).toEqual([
      expect.objectContaining({ revisionNumber: 1, displayName: '教案第1版', approvedById: teacherId }),
    ]);
  } finally {
    await prisma.$disconnect();
  }
});

async function refreshUntil(card: ReturnType<typeof test['extend']> extends never ? never : import('@playwright/test').Locator, text: string) {
  await expect.poll(async () => {
    await card.getByRole('button', { name: '刷新进度' }).click();
    return card.innerText();
  }, { timeout: 30_000, intervals: [250, 500, 1_000] }).toContain(text);
}

async function addTeacherSession(context: BrowserContext) {
  const secret = requiredEnv('NEXTAUTH_SECRET');
  const token = await encode({
    secret,
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
