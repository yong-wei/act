import { mkdirSync, writeFileSync } from 'node:fs';
import { join as pathJoin } from 'node:path';

import { UserRole } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import { createPrismaClient } from '../src/lib/prisma-client';

const slug = 'unit-1-2-modeling-from-object-to-system';
const evidenceDir = pathJoin(
  process.cwd(),
  'openspec/changes/archive/2026-08-29-migrate-one-manifest-course-to-shared-classroom-shell/evidence/browser',
);
const prisma = createPrismaClient();
const seed = {
  adminId: 'issue-1574-admin',
  studentId: 'issue-1574-student',
};

function recordEvidence(filename: string, payload: Record<string, unknown>) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(pathJoin(evidenceDir, filename), `${JSON.stringify(payload, null, 2)}\n`);
}

function visible(page: Page, selector: string) {
  return page.locator(selector).filter({ visible: true });
}

function visibleRole(page: Page, role: Parameters<Page['getByRole']>[0], name: string | RegExp) {
  return page.getByRole(role, { name }).filter({ visible: true });
}

async function addAuthCookie(
  context: BrowserContext,
  user: { id: string; email: string; name: string; role: UserRole },
) {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'playwright-local-auth-secret-at-least-32-bytes',
    token: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: sessionToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  }]);
}

async function seedActors() {
  await prisma.user.upsert({
    where: { id: seed.adminId },
    update: { role: UserRole.ADMIN, name: '1574 管理员', email: 'issue-1574-admin@example.com' },
    create: {
      id: seed.adminId,
      email: 'issue-1574-admin@example.com',
      name: '1574 管理员',
      role: UserRole.ADMIN,
    },
  });
  await prisma.user.upsert({
    where: { id: seed.studentId },
    update: { role: UserRole.STUDENT, name: '1574 学生', email: 'issue-1574-student@example.com' },
    create: {
      id: seed.studentId,
      email: 'issue-1574-student@example.com',
      name: '1574 学生',
      role: UserRole.STUDENT,
    },
  });
  await prisma.classSession.updateMany({
    where: { teacherId: seed.adminId, status: { in: ['ACTIVE', 'PAUSED'] } },
    data: { status: 'FINISHED', endTime: new Date() },
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe.configure({ mode: 'serial' });

test('1-2 demo student and teacher shells keep optional media failures off the critical path', async ({ context, page }) => {
  test.setTimeout(90_000);
  await page.route('**/api/course-runtime/assets/**', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"missing-optional-asset"}' });
  });

  await page.goto(`/interactive-learning/courses/${slug}/student/demo`, { waitUntil: 'domcontentloaded' });
  await expect(visible(page, '[data-lesson-runtime-shell="unified"]')).toBeVisible();
  await expect(visible(page, '[data-runtime-manifest-truth="1-2"]')).toBeVisible();
  await expect(visible(page, '[data-activity-submission-contract="manifest-runtime"]')).toBeVisible();
  await expect(page.getByText('演示模式已开启').filter({ visible: true })).toBeVisible();
  await expect(page.getByText('演示模式不会写入课堂状态。').filter({ visible: true })).toBeVisible();
  await visibleRole(page, 'button', '下一页').click();
  await expect(visible(page, '[data-lesson-runtime-shell="unified"]')).toBeVisible();
  await page.screenshot({ path: pathJoin(evidenceDir, 'student-demo.png') });

  await addAuthCookie(context, {
    id: seed.adminId,
    email: 'issue-1574-admin@example.com',
    name: '1574 管理员',
    role: UserRole.ADMIN,
  });
  await page.goto(`/interactive-learning/courses/${slug}/teacher/demo`, { waitUntil: 'domcontentloaded' });
  await expect(visible(page, '[data-lesson-runtime-shell="unified"][data-lesson-runtime-mode="teacher"]')).toBeVisible();
  await expect(visible(page, '[data-teacher-projection-runtime="compact-navigation"]')).toBeVisible();
  await visible(page, '[data-lesson-runtime-page-jump]').selectOption('step-03');
  await expect(page.getByText('前测——进入建模专题前的准备').filter({ visible: true }).first()).toBeVisible();
  await expect(visibleRole(page, 'button', '发放作答')).toBeVisible();
  await visibleRole(page, 'button', '发放作答').click();
  await expect(visibleRole(page, 'button', '已发放作答')).toBeVisible();
  await visibleRole(page, 'button', '显示参考答案').click();
  await expect(visibleRole(page, 'button', '隐藏参考答案')).toBeVisible();
  await page.screenshot({ path: pathJoin(evidenceDir, 'teacher-demo.png') });
});

test('1-2 teacher waiting, student join, submit/resubmit, reveal, refresh, and finish', async ({ browser }) => {
  test.setTimeout(180_000);
  await seedActors();

  const teacherContext = await browser.newContext();
  const studentContext = await browser.newContext();
  await addAuthCookie(teacherContext, {
    id: seed.adminId,
    email: 'issue-1574-admin@example.com',
    name: '1574 管理员',
    role: UserRole.ADMIN,
  });
  await addAuthCookie(studentContext, {
    id: seed.studentId,
    email: 'issue-1574-student@example.com',
    name: '1574 学生',
    role: UserRole.STUDENT,
  });

  const teacherPage = await teacherContext.newPage();
  const studentPage = await studentContext.newPage();

  await teacherPage.goto(`/interactive-learning/courses/${slug}`, { waitUntil: 'domcontentloaded' });
  await expect(visible(teacherPage, '[data-course-entry-shell="app-shell"]')).toBeVisible();
  await expect(visibleRole(teacherPage, 'button', '创建临时课堂')).toBeVisible();

  const clone = await teacherPage.request.post('/api/teacher/preset-lessons/clone', {
    data: { presetKey: 'unit-1-2-modeling-from-object-to-system-v1' },
  });
  const cloneBody = await clone.json() as { lessonPlanId?: string; error?: string };
  expect(clone.ok(), cloneBody.error ?? JSON.stringify(cloneBody)).toBeTruthy();
  expect(cloneBody.lessonPlanId).toBeTruthy();

  const created = await teacherPage.request.post('/api/session', {
    data: {
      planId: cloneBody.lessonPlanId,
      sourcePresetKey: 'unit-1-2-modeling-from-object-to-system-v1',
      duplicateAction: 'new-session',
    },
  });
  const createdBody = await created.json() as { id?: string; joinCode?: string; error?: string };
  expect(created.ok(), createdBody.error ?? JSON.stringify(createdBody)).toBeTruthy();
  expect(createdBody.id).toBeTruthy();

  await teacherPage.goto(`/interactive-learning/courses/${slug}/teacher/${createdBody.id}/waiting`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(visible(teacherPage, '[data-teacher-classroom-waiting="standard"]')).toBeVisible();
  const joinCodeLocator = visible(teacherPage, '[data-classroom-code]');
  await expect.poll(async () => joinCodeLocator.getAttribute('data-classroom-code')).toMatch(/^\d{6}$/);
  const joinCode = await joinCodeLocator.getAttribute('data-classroom-code');
  expect(joinCode).toMatch(/^\d{6}$/);
  const code = String(joinCode);
  await teacherPage.screenshot({ path: pathJoin(evidenceDir, 'teacher-waiting.png') });

  const join = await studentPage.request.get(`/api/session/join?code=${code}`);
  expect(join.ok()).toBeTruthy();
  const joined = await join.json() as { id: string; studentHref: string };
  expect(joined.studentHref).toContain(`/interactive-learning/courses/${slug}/student/`);

  await visible(teacherPage, '[data-start-class-action="teacher-runtime"]').click();
  await teacherPage.waitForURL(new RegExp(`/interactive-learning/courses/${slug}/teacher/[^/]+$`));
  await expect(visible(teacherPage, '[data-lesson-runtime-shell="unified"][data-lesson-runtime-mode="teacher"]')).toBeVisible();
  await visible(teacherPage, '[data-lesson-runtime-page-jump]').selectOption('step-03');
  await visibleRole(teacherPage, 'button', '发放作答').click();
  await expect(visibleRole(teacherPage, 'button', '已发放作答')).toBeVisible();
  const browse = visibleRole(teacherPage, 'button', /开放浏览|已开放浏览/);
  if (await browse.count()) {
    const browseLabel = await browse.first().innerText();
    if (browseLabel.includes('开放浏览') && !browseLabel.includes('已开放')) {
      await browse.first().click();
    }
  }

  await studentPage.goto(joined.studentHref, { waitUntil: 'domcontentloaded' });
  await expect(visible(studentPage, '[data-lesson-runtime-shell="unified"]')).toBeVisible();
  const syncButton = visibleRole(studentPage, 'button', '跳到教师当前页');
  if (await syncButton.count()) {
    await syncButton.click();
  }
  await expect(studentPage.getByText('教师尚未发放本页作答卡', { exact: false }).filter({ visible: true })).toHaveCount(0);
  const choice = studentPage.locator('input[type="radio"], input[type="checkbox"]').filter({ visible: true }).first();
  await expect(choice).toBeVisible();
  await choice.check();
  await visibleRole(studentPage, 'button', '提交答案').first().click();
  await expect(studentPage.getByText('已提交，可修改后重提。').filter({ visible: true }).first()).toBeVisible();
  await choice.check();
  await visibleRole(studentPage, 'button', '提交答案').first().click();
  await expect.poll(async () => {
    const state = await prisma.studentState.findFirst({
      where: { sessionId: joined.id, userId: seed.studentId, stateKey: 'course' },
      select: { data: true },
    });
    const data = state?.data as { responses?: Record<string, { answers?: Record<string, string> }> } | undefined;
    return Object.keys(data?.responses?.['step-03']?.answers ?? {}).length;
  }).toBeGreaterThan(0);

  await visibleRole(teacherPage, 'button', '显示参考答案').click();
  await expect(visibleRole(teacherPage, 'button', '隐藏参考答案')).toBeVisible();
  await studentPage.reload({ waitUntil: 'domcontentloaded' });
  await expect(visible(studentPage, '[data-lesson-runtime-shell="unified"]')).toBeVisible();
  await expect(studentPage.getByText('已提交', { exact: false }).filter({ visible: true }).first()).toBeVisible();
  await studentPage.screenshot({ path: pathJoin(evidenceDir, 'student-live.png') });

  await visible(teacherPage, '[data-lesson-runtime-local-tools] summary').click();
  await visibleRole(teacherPage, 'button', '结束课堂').click();
  await visibleRole(teacherPage, 'button', '确认结束').click();
  await teacherPage.waitForURL(/\/(teacher\/lesson-plans|admin|interactive-learning\/courses\/unit-1-2-modeling-from-object-to-system)/, { timeout: 30_000 });
  await expect.poll(async () => (
    await prisma.classSession.findUnique({ where: { id: joined.id }, select: { status: true } })
  )?.status).toBe('FINISHED');
  await studentPage.reload({ waitUntil: 'domcontentloaded' });
  await expect(studentPage).toHaveURL(new RegExp(`/interactive-learning/courses/${slug}/?(?:\\?.*)?$`));
  await expect(visible(studentPage, '[data-course-entry-shell="app-shell"]')).toBeVisible();

  recordEvidence('journey.json', {
    sessionId: joined.id,
    joinCode: code,
    studentHref: joined.studentHref,
    screenshots: ['student-demo.png', 'teacher-demo.png', 'teacher-waiting.png', 'student-live.png'],
  });

  await teacherContext.close();
  await studentContext.close();
});
