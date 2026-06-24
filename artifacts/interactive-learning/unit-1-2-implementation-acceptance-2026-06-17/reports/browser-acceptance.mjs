import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const baseUrl = process.env.UNIT_1_2_ACCEPTANCE_BASE_URL ?? 'http://localhost:3001';
const outDir = resolve('artifacts/interactive-learning/unit-1-2-implementation-acceptance-2026-06-17');
const screenshotDir = join(outDir, 'screenshots');
const reportPath = join(outDir, 'reports/browser-acceptance-report.json');
const route = '/interactive-learning/courses/unit-1-2-modeling-from-object-to-system';

const TEACHER = { account: 'test_teacher', password: 'TestTeacher@Just2026!' };
const STUDENT = { account: 'demo', password: 'DemoStudent@Just2026!' };

function pageLogBucket(label) {
  const bucket = {
    label,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };
  return bucket;
}

function attachPageLogging(page, bucket) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      bucket.consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    bucket.pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('/_next/webpack-hmr')) return;
    bucket.failedRequests.push(`${request.method()} ${url} ${request.failure()?.errorText ?? ''}`.trim());
  });
}

function isBenignBrowserLogIssue(issue) {
  return issue.includes('pan-yz.cldisk.com')
    || issue.includes('s2.cldisk.com')
    || issue.includes("Failed to set the 'domain' property on 'Document': Assignment is forbidden for sandboxed iframes");
}

async function openPage(context, label) {
  const page = await context.newPage();
  const logs = pageLogBucket(label);
  attachPageLogging(page, logs);
  page.on('dialog', (dialog) => dialog.accept());
  return { page, logs };
}

async function screenshot(page, name) {
  const path = join(screenshotDir, name);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function assertVisible(page, selector, label) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 20000 });
  return label;
}

async function assertText(page, text) {
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    text,
    { timeout: 20000 },
  );
  return text;
}

async function login(page, account) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[name="account"]').fill(account.account);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForFunction(() => !window.location.pathname.startsWith('/login'), null, { timeout: 20000 });
}

async function createClassroom(page) {
  return page.evaluate(async () => {
    const cloneRes = await fetch('/api/teacher/preset-lessons/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetKey: 'unit-1-2-modeling-from-object-to-system-v1' }),
    });
    const clone = await cloneRes.json();
    if (!cloneRes.ok || !clone.lessonPlanId) {
      throw new Error(`clone failed: ${cloneRes.status} ${clone.error ?? ''}`);
    }

    const createRes = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: clone.lessonPlanId }),
    });
    const session = await createRes.json();
    if (!createRes.ok || !session.id || !session.joinCode) {
      throw new Error(`create session failed: ${createRes.status} ${session.error ?? ''}`);
    }
    return {
      sessionId: session.id,
      joinCode: session.joinCode,
      planTitle: session.plan?.title ?? null,
    };
  });
}

async function joinClassroom(page, joinCode) {
  return page.evaluate(async (code) => {
    const response = await fetch(`/api/session/join?code=${code}`);
    const payload = await response.json();
    if (!response.ok || !payload.studentHref) {
      throw new Error(`join failed: ${response.status} ${payload.error ?? ''}`);
    }
    return payload;
  }, joinCode);
}

async function waitForSessionFinished(page, sessionId) {
  return page.waitForFunction(
    async (id) => {
      const response = await fetch(`/api/session/${id}`, { cache: 'no-store' });
      if (!response.ok) return false;
      const payload = await response.json();
      return payload.status === 'FINISHED';
    },
    sessionId,
    { timeout: 20000 },
  );
}

async function runDemoChecks(browser, report) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const { page, logs } = await openPage(context, 'demo-student-entry');
  report.logs.push(logs);

  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  await assertText(page, '1-2：建模——从真实对象到可分析的系统');
  await assertText(page, '14');
  report.screenshots.entry = await screenshot(page, 'entry-page.png');

  await page.goto(`${baseUrl}${route}/student/demo?step=step-09`, { waitUntil: 'networkidle' });
  await assertVisible(page, '[data-static-surface-3d-panel="magnitude-surface"]', 'step-09 static surface');
  await assertText(page, '重置视角');
  report.screenshots.studentStep09 = await screenshot(page, 'student-step-09-static-surface-3d.png');

  await page.goto(`${baseUrl}${route}/student/demo?step=step-10`, { waitUntil: 'networkidle' });
  await assertVisible(page, '[data-interactive-figure-panel="drag_pole_s_plane"]', 'step-10 interactive figure');
  await page.getByRole('button', { name: '提交当前参数' }).first().click();
  await assertText(page, '拖动极点看响应');
  report.screenshots.studentStep10 = await screenshot(page, 'student-step-10-interactive-figure.png');

  await page.goto(`${baseUrl}${route}/student/demo?step=step-11`, { waitUntil: 'networkidle' });
  await assertVisible(page, '[data-interactive-figure-panel="three_ships_case"]', 'step-11 interactive figure');
  await assertText(page, '三艘船响应仿真');
  report.screenshots.studentStep11 = await screenshot(page, 'student-step-11-interactive-figure.png');

  await context.close();
}

async function runTeacherDemoChecks(browser, report) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const { page, logs } = await openPage(context, 'teacher-demo');
  report.logs.push(logs);
  await login(page, TEACHER);

  await page.goto(`${baseUrl}${route}/teacher/demo`, { waitUntil: 'networkidle' });
  await page.locator('select[name="lessonStep"]').selectOption('step-10');
  await assertVisible(page, '[data-interactive-figure-panel="drag_pole_s_plane"]', 'teacher step-10 interactive figure');
  await assertText(page, '发放作答');
  report.screenshots.teacherStep10 = await screenshot(page, 'teacher-step-10-controls.png');

  await context.close();
}

async function runLiveClassroomChecks(browser, report) {
  const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const studentContext = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const { page: teacherPage, logs: teacherLogs } = await openPage(teacherContext, 'teacher-live');
  const { page: studentPage, logs: studentLogs } = await openPage(studentContext, 'student-live');
  report.logs.push(teacherLogs, studentLogs);

  await login(teacherPage, TEACHER);
  const classroom = await createClassroom(teacherPage);
  report.classroom = classroom;

  await teacherPage.goto(`${baseUrl}${route}/teacher/${classroom.sessionId}`, { waitUntil: 'networkidle' });
  await assertText(teacherPage, `课堂码：${classroom.joinCode}`);
  await teacherPage.locator('select[name="lessonStep"]').selectOption('step-10');
  await assertVisible(teacherPage, '[data-interactive-figure-panel="drag_pole_s_plane"]', 'live teacher step-10 figure');
  const releaseButton = teacherPage.getByRole('button', { name: /发放作答|收回作答/ }).first();
  if (await releaseButton.count()) await releaseButton.click();

  await login(studentPage, STUDENT);
  const joinPayload = await joinClassroom(studentPage, classroom.joinCode);
  report.classroom.studentHref = joinPayload.studentHref;
  await studentPage.goto(`${baseUrl}${joinPayload.studentHref}`, { waitUntil: 'networkidle' });
  await assertText(studentPage, '拖动极点看响应');
  await assertVisible(studentPage, '[data-interactive-figure-panel="drag_pole_s_plane"]', 'live student step-10 figure');
  await studentPage.getByRole('button', { name: '提交当前参数' }).first().click();
  await assertText(studentPage, '拖动极点看响应');
  report.screenshots.studentClassroomSubmission = await screenshot(studentPage, 'student-classroom-submission.png');

  await teacherPage.reload({ waitUntil: 'networkidle' });
  await teacherPage.locator('select[name="lessonStep"]').selectOption('step-10');
  await assertText(teacherPage, '累计提交 1 次');
  report.screenshots.teacherClassroomAggregation = await screenshot(teacherPage, 'teacher-classroom-aggregation.png');

  const finishResponse = teacherPage.waitForResponse((response) => {
    return response.url().includes(`/api/session/${classroom.sessionId}`) &&
      response.request().method() === 'PATCH';
  });
  await teacherPage.getByRole('button', { name: '结束课堂' }).first().click();
  const finished = await finishResponse;
  if (!finished.ok()) {
    throw new Error(`finish session failed: ${finished.status()} ${await finished.text()}`);
  }
  const finishedPayload = await finished.json();
  if (finishedPayload.status !== 'FINISHED' || !finishedPayload.endTime) {
    throw new Error(`finish session did not persist FINISHED: ${JSON.stringify(finishedPayload)}`);
  }
  await waitForSessionFinished(teacherPage, classroom.sessionId);
  await teacherPage.waitForLoadState('networkidle');
  report.classroom.ended = true;
  report.classroom.endTime = finishedPayload.endTime;

  await teacherContext.close();
  await studentContext.close();
}

async function main() {
  const report = {
    status: 'pass',
    baseUrl,
    checkedAt: new Date().toISOString(),
    screenshots: {},
    classroom: null,
    logs: [],
    checks: [],
  };

  const browser = await chromium.launch({ headless: true });
  try {
    await runDemoChecks(browser, report);
    report.checks.push('entry and student demo step-09/10/11 passed');
    await runTeacherDemoChecks(browser, report);
    report.checks.push('teacher demo step-10 controls passed');
    await runLiveClassroomChecks(browser, report);
    report.checks.push('live teacher/student classroom submission and aggregation passed');
  } catch (error) {
    report.status = 'fail';
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    await browser.close();
    const allLogIssues = report.logs.flatMap((entry) => [
      ...entry.consoleErrors.map((message) => `${entry.label}: console error: ${message}`),
      ...entry.pageErrors.map((message) => `${entry.label}: page error: ${message}`),
      ...entry.failedRequests.map((message) => `${entry.label}: request failed: ${message}`),
    ]);
    report.benignLogIssues = allLogIssues.filter(isBenignBrowserLogIssue);
    report.blockingLogIssues = allLogIssues.filter((issue) => !isBenignBrowserLogIssue(issue));
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    if (report.blockingLogIssues.length > 0 && report.status === 'pass') {
      report.status = 'fail';
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      throw new Error(`blocking browser log issues:\n${report.blockingLogIssues.join('\n')}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
