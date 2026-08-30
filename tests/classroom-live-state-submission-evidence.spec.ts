import { mkdirSync, writeFileSync } from 'node:fs';
import { join as pathJoin } from 'node:path';

import { UserRole } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import { createPrismaClient } from '../src/lib/prisma-client';

const slug = 'unit-1-2-modeling-from-object-to-system';
const evidenceDir = pathJoin(
  process.cwd(),
  'openspec/changes/archive/2026-08-28-separate-classroom-live-state-from-submission-evidence/evidence/browser',
);
const prisma = createPrismaClient();
const seed = {
  teacherId: 'issue-1573-teacher',
  studentId: 'issue-1573-student',
  classId: 'issue-1573-class',
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
    where: { id: seed.teacherId },
    update: { role: UserRole.TEACHER, name: '1573 教师', email: 'issue-1573-teacher@example.com' },
    create: {
      id: seed.teacherId,
      email: 'issue-1573-teacher@example.com',
      name: '1573 教师',
      role: UserRole.TEACHER,
    },
  });
  await prisma.user.upsert({
    where: { id: seed.studentId },
    update: { role: UserRole.STUDENT, name: '1573 学生', email: 'issue-1573-student@example.com' },
    create: {
      id: seed.studentId,
      email: 'issue-1573-student@example.com',
      name: '1573 学生',
      role: UserRole.STUDENT,
    },
  });
  await prisma.class.upsert({
    where: { id: seed.classId },
    update: { teacherId: seed.teacherId, name: '1573 证据班级', code: 'EV1573' },
    create: {
      id: seed.classId,
      name: '1573 证据班级',
      code: 'EV1573',
      teacherId: seed.teacherId,
      description: '课堂 live/evidence 浏览器验收班级',
    },
  });
  await prisma.studentProfile.upsert({
    where: { userId: seed.studentId },
    update: { classId: seed.classId, className: '1573 证据班级', studentNumber: '15730001' },
    create: {
      userId: seed.studentId,
      classId: seed.classId,
      className: '1573 证据班级',
      studentNumber: '15730001',
    },
  });
  await prisma.classSession.updateMany({
    where: { teacherId: seed.teacherId, status: { in: ['ACTIVE', 'PAUSED'] } },
    data: { status: 'FINISHED', endTime: new Date() },
  });
}

async function countDurableWrites() {
  const [states, logs, responses, facts] = await Promise.all([
    prisma.studentState.count({ where: { userId: seed.studentId } }),
    prisma.interactionLog.count({ where: { userId: seed.studentId } }),
    prisma.studentStepResponse.count({ where: { userId: seed.studentId } }),
    prisma.learningFact.count({ where: { userId: seed.studentId } }),
  ]);
  return { states, logs, responses, facts };
}

async function loadDurableAttempts(sessionId: string) {
  return prisma.studentStepResponse.findMany({
    where: { sessionId, userId: seed.studentId },
    orderBy: { submittedAt: 'asc' },
    select: {
      id: true,
      stepId: true,
      submissionIdentity: true,
      submissionSequence: true,
      evidenceStatus: true,
      responseData: true,
    },
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe.configure({ mode: 'serial' });

test('preview demo does not write student state, events, submissions, or facts', async ({ context, page }) => {
  test.setTimeout(90_000);
  await seedActors();
  await addAuthCookie(context, {
    id: seed.studentId,
    email: 'issue-1573-student@example.com',
    name: '1573 学生',
    role: UserRole.STUDENT,
  });
  const before = await countDurableWrites();
  const writePosts: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (request.method() !== 'POST') return;
    if (
      url.includes('/api/interactive/events')
      || url.includes('/api/session/')
      || url.includes('/api/classroom/')
    ) {
      writePosts.push(url);
    }
  });

  await page.goto(`/interactive-learning/courses/${slug}/student/demo`, { waitUntil: 'domcontentloaded' });
  await expect(visible(page, '[data-lesson-runtime-shell="unified"]')).toBeVisible();
  await expect(page.getByText('演示模式不会写入课堂状态。').filter({ visible: true })).toBeVisible();
  await visibleRole(page, 'button', '下一页').click();
  await visibleRole(page, 'button', '下一页').click();
  const choice = page.locator('input[type="radio"], input[type="checkbox"]').filter({ visible: true }).first();
  if (await choice.count()) {
    await choice.check({ force: true });
  }
  const submit = visibleRole(page, 'button', '提交答案');
  if (await submit.count()) {
    await submit.first().click().catch(() => undefined);
  }
  await expect(page.getByText('演示模式不会写入课堂状态。').filter({ visible: true })).toBeVisible();
  const after = await countDurableWrites();
  expect(writePosts, writePosts.join('\n')).toEqual([]);
  expect(after).toEqual(before);
  recordEvidence('preview-zero-write.json', { before, after, writePosts });
});

test('submit, resubmit, refresh, overwrite, reconnect, review, and report phases keep durable attempts', async ({ browser }) => {
  test.setTimeout(180_000);
  await seedActors();

  const teacherContext = await browser.newContext();
  const studentContext = await browser.newContext();
  await addAuthCookie(teacherContext, {
    id: seed.teacherId,
    email: 'issue-1573-teacher@example.com',
    name: '1573 教师',
    role: UserRole.TEACHER,
  });
  await addAuthCookie(studentContext, {
    id: seed.studentId,
    email: 'issue-1573-student@example.com',
    name: '1573 学生',
    role: UserRole.STUDENT,
  });

  const teacherPage = await teacherContext.newPage();
  const studentPage = await studentContext.newPage();

  const clone = await teacherPage.request.post('/api/teacher/preset-lessons/clone', {
    data: { presetKey: 'unit-1-2-modeling-from-object-to-system-v1' },
  });
  const cloneBody = await clone.json() as { lessonPlanId?: string; error?: string };
  expect(clone.ok(), cloneBody.error ?? JSON.stringify(cloneBody)).toBeTruthy();

  const created = await teacherPage.request.post('/api/session', {
    data: {
      planId: cloneBody.lessonPlanId,
      classId: seed.classId,
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
  const joinCodeLocator = visible(teacherPage, '[data-classroom-code]');
  await expect.poll(async () => joinCodeLocator.getAttribute('data-classroom-code')).toMatch(/^\d{6}$/);
  const code = String(await joinCodeLocator.getAttribute('data-classroom-code'));

  const join = await studentPage.request.get(`/api/session/join?code=${code}`);
  expect(join.ok()).toBeTruthy();
  const joined = await join.json() as { id: string; studentHref: string };

  await visible(teacherPage, '[data-start-class-action="teacher-runtime"]').click();
  await teacherPage.waitForURL(new RegExp(`/interactive-learning/courses/${slug}/teacher/[^/]+$`));
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

  const eventPosts: Array<{ status: number; body: string; requestPreview: string }> = [];
  studentPage.on('response', (response) => {
    if (!response.url().includes('/api/interactive/events') || response.request().method() !== 'POST') {
      return;
    }
    const requestPreview = (response.request().postData() ?? '').slice(0, 800);
    void response.text().then((body) => {
      eventPosts.push({
        status: response.status(),
        body: body.slice(0, 2000),
        requestPreview,
      });
    }).catch(() => {
      eventPosts.push({ status: response.status(), body: '<unreadable>', requestPreview });
    });
  });

  await studentPage.goto(joined.studentHref, { waitUntil: 'domcontentloaded' });
  await expect(visible(studentPage, '[data-lesson-runtime-shell="unified"]')).toBeVisible();
  const syncButton = visibleRole(studentPage, 'button', '跳到教师当前页');
  if (await syncButton.count()) {
    await syncButton.click();
  }
  const choice = studentPage.locator('input[type="radio"], input[type="checkbox"]').filter({ visible: true }).first();
  await expect(choice).toBeVisible();
  await choice.check();
  const submitResponse = studentPage.waitForResponse(
    (response) => response.url().includes('/api/interactive/events') && response.request().method() === 'POST',
    { timeout: 20_000 },
  );
  await visibleRole(studentPage, 'button', '提交答案').first().click();
  await expect(studentPage.getByText('已提交，可修改后重提。').filter({ visible: true }).first()).toBeVisible();
  const submitEvents = await submitResponse.catch(() => null);

  await expect.poll(async () => {
    const state = await prisma.studentState.findFirst({
      where: { sessionId: joined.id, userId: seed.studentId, stateKey: 'course' },
      select: { data: true },
    });
    const data = state?.data as { responses?: Record<string, { answers?: Record<string, string> }> } | undefined;
    return Object.keys(data?.responses?.['step-03']?.answers ?? {}).length;
  }, { timeout: 20_000 }).toBeGreaterThan(0);

  const diagnostic = async () => {
    const [attempts, scopedLogs, allLogs, sessionRow, profile] = await Promise.all([
      loadDurableAttempts(joined.id),
      prisma.interactionLog.findMany({
        where: { sessionId: joined.id, userId: seed.studentId },
        select: { eventType: true, sessionId: true, invalidContextReason: true, learningContext: true },
      }),
      prisma.interactionLog.findMany({
        where: { userId: seed.studentId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          eventType: true,
          sessionId: true,
          stepId: true,
          invalidContextReason: true,
          learningContext: true,
          attemptKey: true,
        },
      }),
      prisma.classSession.findUnique({
        where: { id: joined.id },
        select: { id: true, classId: true, teacherId: true, status: true },
      }),
      prisma.studentProfile.findUnique({
        where: { userId: seed.studentId },
        select: { classId: true },
      }),
    ]);
    return {
      attempts: attempts.length,
      scopedLogCount: scopedLogs.length,
      allLogs,
      sessionRow,
      profile,
      submitEventsStatus: submitEvents?.status() ?? null,
      eventPosts,
    };
  };

  try {
    await expect.poll(async () => (await diagnostic()).attempts, {
      timeout: 20_000,
    }).toBe(1);
  } catch (error) {
    throw new Error(`durable attempts missing: ${JSON.stringify(await diagnostic(), null, 2)}\n${String(error)}`);
  }
  const firstAttempts = await loadDurableAttempts(joined.id);
  expect(firstAttempts[0]?.evidenceStatus).toBe('ACCEPTED');
  expect(firstAttempts[0]?.submissionSequence).not.toBeNull();
  const firstIdentity = firstAttempts[0]?.submissionIdentity;
  const firstId = firstAttempts[0]?.id;

  await choice.check();
  await visibleRole(studentPage, 'button', '提交答案').first().click();
  await expect.poll(async () => (await loadDurableAttempts(joined.id)).length, { timeout: 20_000 }).toBe(2);
  const afterResubmit = await loadDurableAttempts(joined.id);
  expect(afterResubmit.map((row) => row.id)).toContain(firstId);
  expect(afterResubmit.some((row) => row.submissionIdentity !== firstIdentity)).toBeTruthy();
  expect(afterResubmit.every((row) => row.evidenceStatus === 'ACCEPTED')).toBeTruthy();

  await studentPage.reload({ waitUntil: 'domcontentloaded' });
  await expect(visible(studentPage, '[data-lesson-runtime-shell="unified"]')).toBeVisible();
  await expect(studentPage.getByText('已提交', { exact: false }).filter({ visible: true }).first()).toBeVisible();
  expect((await loadDurableAttempts(joined.id)).map((row) => row.id).sort()).toEqual(
    afterResubmit.map((row) => row.id).sort(),
  );

  await visibleRole(studentPage, 'button', '下一页').click();
  await expect(studentPage.getByText('建模的两条路径', { exact: false }).filter({ visible: true }).first()).toBeVisible();
  await expect.poll(async () => (await loadDurableAttempts(joined.id)).length).toBe(2);
  const afterLiveOverwrite = await loadDurableAttempts(joined.id);
  expect(afterLiveOverwrite.map((row) => row.id).sort()).toEqual(afterResubmit.map((row) => row.id).sort());

  await studentContext.close();
  const reconnected = await browser.newContext();
  await addAuthCookie(reconnected, {
    id: seed.studentId,
    email: 'issue-1573-student@example.com',
    name: '1573 学生',
    role: UserRole.STUDENT,
  });
  const reconnectedPage = await reconnected.newPage();
  await reconnectedPage.goto(joined.studentHref, { waitUntil: 'domcontentloaded' });
  await expect(visible(reconnectedPage, '[data-lesson-runtime-shell="unified"]')).toBeVisible();
  const reconnectSync = visibleRole(reconnectedPage, 'button', '跳到教师当前页');
  if (await reconnectSync.count()) {
    await reconnectSync.click();
  }
  await expect(reconnectedPage.getByText('已提交', { exact: false }).filter({ visible: true }).first()).toBeVisible();
  expect((await loadDurableAttempts(joined.id)).length).toBe(2);

  await visible(teacherPage, '[data-lesson-runtime-local-tools] summary').click();
  await visibleRole(teacherPage, 'button', '结束课堂').click();
  await visibleRole(teacherPage, 'button', '确认结束').click();
  await expect.poll(async () => (
    await prisma.classSession.findUnique({ where: { id: joined.id }, select: { status: true, acceptedSubmissionWatermark: true } })
  )?.status).toBe('FINISHED');

  await expect.poll(async () => {
    const report = await prisma.classSessionReport.findUnique({
      where: { sessionId_reportType: { sessionId: joined.id, reportType: 'class-summary' } },
      select: { reportData: true, acceptedSubmissionWatermark: true },
    });
    const data = report?.reportData as { phases?: Record<string, { status?: string }> } | undefined;
    return data?.phases?.captured?.status ?? null;
  }).toBe('SUCCEEDED');

  const report = await prisma.classSessionReport.findUnique({
    where: { sessionId_reportType: { sessionId: joined.id, reportType: 'class-summary' } },
    select: { reportData: true, acceptedSubmissionWatermark: true },
  });
  const phases = (report?.reportData as { phases?: Record<string, { status?: string }> } | undefined)?.phases;
  expect(phases?.summarized?.status).toBe('SUCCEEDED');
  expect(phases?.materialized?.status === 'SUCCEEDED' || phases?.materialized?.status === 'NOT_APPLICABLE').toBeTruthy();

  await teacherPage.goto(`/classroom/teacher/${joined.id}/review`, { waitUntil: 'domcontentloaded' });
  await expect(teacherPage.getByText('课堂复盘', { exact: false }).filter({ visible: true }).first()).toBeVisible();
  await expect(teacherPage.getByText('有提交：1 人').filter({ visible: true })).toBeVisible();

  recordEvidence('journey.json', {
    sessionId: joined.id,
    joinCode: code,
    durableAttemptIds: afterLiveOverwrite.map((row) => row.id),
    reportPhases: phases,
    watermark: report?.acceptedSubmissionWatermark?.toString() ?? null,
  });

  await teacherContext.close();
  await reconnected.close();
});
