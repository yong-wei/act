import fs from 'node:fs/promises';
import path from 'node:path';
import bcryptModule from 'bcryptjs';
import { chromium } from 'playwright';

import { createPrismaClient } from '../../../../scripts/lib/prisma-client.mjs';

const bcrypt = bcryptModule.default ?? bcryptModule;
const prisma = createPrismaClient();

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/59-function-state-flows-batch24');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch24-manifest.json');
const populatedLessonPlanId = 'cmqeakmuy0024cnyf1z2ttquo';
const populatedLessonTitle = '4-1：设计起点：性能指标体系、工程约束与可行域表达 (副本)';
const classId = 'cmma7g0590004g9q2nl2jyzdf';
const className = '2024自动化';
const courseSlug = 'unit-4-1-design-task-expression';
const targetStepId = 'step-03';
const auditPassword = 'AuditStudent@Just2026!';
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
  studentA: { account: '222210301333', password: auditPassword, name: '左乔生' },
  studentB: { account: '232210301121', password: auditPassword, name: '王旭东' },
};

const studentNumbers = [accounts.studentA.account, accounts.studentB.account];
const results = [];
const downloads = [];
const dialogs = [];
const errors = [];
const ignoredErrors = [];
const fallbackClicks = [];
const cleanupActions = [];
let createdSessionId = null;
let createdJoinCode = null;
let browser = null;
let studentBackups = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function recordError(action, error, url = '') {
  errors.push({
    action,
    message: error instanceof Error ? error.message : String(error),
    url,
  });
}

function recordIgnoredError(action, error, url = '') {
  ignoredErrors.push({
    action,
    message: error instanceof Error ? error.message : String(error),
    url,
  });
}

async function prepareStudents() {
  const students = await prisma.studentProfile.findMany({
    where: { studentNumber: { in: studentNumbers }, classId },
    select: {
      studentNumber: true,
      userId: true,
      classId: true,
      user: { select: { id: true, name: true, passwordHash: true } },
    },
  });
  if (students.length !== studentNumbers.length) {
    throw new Error(`expected ${studentNumbers.length} class students, found ${students.length}`);
  }

  const passwordHash = await bcrypt.hash(auditPassword, 10);
  studentBackups = students.map((student) => ({
    userId: student.userId,
    studentNumber: student.studentNumber,
    name: student.user.name,
    originalPasswordHash: student.user.passwordHash,
  }));
  await prisma.user.updateMany({
    where: { id: { in: studentBackups.map((student) => student.userId) } },
    data: { passwordHash },
  });
  cleanupActions.push('student-passwords-prepared');
  return students;
}

async function restoreStudents() {
  for (const backup of studentBackups) {
    await prisma.user.update({
      where: { id: backup.userId },
      data: { passwordHash: backup.originalPasswordHash },
    });
  }
  cleanupActions.push('student-passwords-restored');
}

async function finishCreatedSession() {
  if (!createdSessionId) return;
  await prisma.classSession.updateMany({
    where: { id: createdSessionId, status: { not: 'FINISHED' } },
    data: { status: 'FINISHED', endTime: new Date() },
  });
  cleanupActions.push('created-session-finished');
}

async function login(page, role) {
  const account = accounts[role];
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2800);
}

async function gotoStable(page, route, waitMs = 2600) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await sleep(waitMs);
}

async function domAudit(page) {
  return await page.evaluate(() => {
    const text = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    const name = (el) => (
      el?.getAttribute?.('aria-label') ||
      el?.getAttribute?.('title') ||
      el?.getAttribute?.('alt') ||
      text(el) ||
      ''
    ).trim();
    const active = document.activeElement;
    const controls = [...document.querySelectorAll('button, [role="button"], a[href]')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      href: el.getAttribute('href') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      selected: el.getAttribute('aria-selected') || '',
      pressed: el.getAttribute('aria-pressed') || '',
    }));
    const inputs = [...document.querySelectorAll('input, textarea, select')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      value: 'value' in el ? String(el.value || '').slice(0, 180) : '',
      hidden: Boolean(el.hidden || el.closest('[hidden]') || getComputedStyle(el).display === 'none'),
    }));
    const statusRegions = [...document.querySelectorAll('[role="alert"], [aria-live], [role="status"]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const graphics = [...document.querySelectorAll('svg, canvas')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      ariaHidden: el.getAttribute('aria-hidden') || '',
    }));
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 6),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
        placeholder: active?.getAttribute?.('placeholder') || '',
      },
      alerts: statusRegions,
      buttons: controls.slice(0, 260),
      inputs,
      unnamedButtons: controls.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 7600),
    };
  });
}

async function capture(page, fileName, label, notes = {}) {
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  const audit = await domAudit(page);
  const a11yPath = filePath.replace(/\.png$/, '.a11y.json');
  await fs.writeFile(a11yPath, JSON.stringify({ accessibilitySnapshotUnavailable: true, audit }, null, 2));
  const url = new URL(audit.url);
  const body = audit.bodyText;
  results.push({
    step: results.length + 1,
    label,
    route: url.pathname + url.search,
    screenshot: path.relative(root, filePath),
    a11y: path.relative(root, a11yPath),
    notes,
    auditSummary: {
      h1: audit.h1,
      activeElement: audit.activeElement,
      alerts: audit.alerts,
      inputCount: audit.inputs.length,
      buttonCount: audit.buttons.length,
      unnamedButtons: audit.unnamedButtons,
      graphicsCount: audit.graphicsCount,
      unnamedGraphics: audit.unnamedGraphics,
      hits: {
        className: body.includes(className),
        joinCode: createdJoinCode ? body.includes(createdJoinCode) : false,
        onlineStudents: body.includes('在线') || body.includes('加入学生'),
        submitted: body.includes('已提交') || body.includes('提交总数') || body.includes('有提交学生'),
        release: body.includes('发放作答') || body.includes('已发放作答'),
        evidence: body.includes('学习档案') || body.includes('证据') || body.includes('课堂记录'),
        ended: body.includes('已结束') || body.includes('FINISHED') || body.includes('课堂复盘'),
      },
    },
  });
}

async function newPage(viewport, role, dialogMode = 'dismiss') {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseUrl }).catch(() => {});
  const page = await context.newPage();
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message(), url: page.url(), mode: dialogMode });
    if (dialogMode === 'accept') {
      await dialog.accept().catch(() => {});
    } else {
      await dialog.dismiss().catch(() => {});
    }
  });
  page.on('download', (download) => {
    downloads.push({ suggestedFilename: download.suggestedFilename(), url: page.url() });
  });
  page.on('pageerror', (error) => {
    if (error.message.includes("Failed to set the 'domain' property on 'Document'")) {
      recordIgnoredError('pageerror', error, page.url());
      return;
    }
    recordError('pageerror', error, page.url());
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    if (failure?.errorText === 'net::ERR_BLOCKED_BY_ORB' && request.url().includes('cldisk.com')) {
      recordIgnoredError('requestfailed', failure.errorText, request.url());
      return;
    }
    recordError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  if (role) await login(page, role);
  return { context, page };
}

async function clickControl(page, role, name, options = {}) {
  const locator = page.getByRole(role, { name });
  if (await locator.count()) {
    await locator.first().click(options).catch((error) => recordError(`click ${String(name)}`, error, page.url()));
    await sleep(options.waitMs ?? 1400);
    return `${role}:${String(name)}`;
  }
  const jsClick = await page.evaluate(({ source, flags }) => {
    const matcher = new RegExp(source, flags);
    const elements = [...document.querySelectorAll('button, a, [role="button"]')];
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
    };
    const label = (el) => [
      el.getAttribute('aria-label') || '',
      el.getAttribute('title') || '',
      el.innerText || '',
      el.textContent || '',
    ].join(' ').replace(/\s+/g, ' ').trim();
    const target = elements.find((el) => isVisible(el) && matcher.test(label(el)));
    if (!target) return null;
    target.click();
    return { tag: target.tagName.toLowerCase(), label: label(target).slice(0, 140) };
  }, typeof name === 'string' ? { source: name, flags: '' } : { source: name.source, flags: name.flags });
  if (jsClick) {
    fallbackClicks.push({ role, name: String(name), mode: 'js-visible-text-click', target: jsClick, url: page.url() });
    await sleep(options.waitMs ?? 1400);
    return `js:${String(name)}`;
  }
  recordError(`click ${role}:${String(name)}`, 'locator not found', page.url());
  return 'not-found';
}

async function chooseStep(page, stepId) {
  const select = page.locator('select').filter({ has: page.locator(`option[value="${stepId}"]`) });
  if (await select.count()) {
    await select.first().selectOption(stepId).catch((error) => recordError(`select step ${stepId}`, error, page.url()));
    await sleep(1800);
    return 'select';
  }
  const changed = await page.evaluate((value) => {
    const found = [...document.querySelectorAll('select')].find((item) => [...item.options].some((option) => option.value === value));
    if (!found) return false;
    found.value = value;
    found.dispatchEvent(new Event('input', { bubbles: true }));
    found.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, stepId);
  await sleep(1800);
  if (!changed) recordError(`select step ${stepId}`, 'step select not found', page.url());
  return changed ? 'dom-select' : 'not-found';
}

async function answerFirstVisibleQuestion(page, label) {
  const before = await domAudit(page);
  const radio = page.locator('input[type="radio"]:visible, input[type="checkbox"]:visible');
  if (await radio.count()) {
    await radio.first().check({ force: true }).catch(async () => {
      await radio.first().click({ force: true }).catch((error) => recordError(`${label} answer radio/checkbox`, error, page.url()));
    });
    await sleep(500);
  }
  const textarea = page.locator('textarea:visible');
  if (await textarea.count()) {
    await textarea.first().fill(`审计样本：${label} 在真实班级课堂中提交性能指标表达判断。`);
    await sleep(400);
  }
  const textInput = page.locator('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="range"]):not([type="file"]):visible');
  if (await textInput.count()) {
    await textInput.first().fill(`${label} 审计样本答案`).catch(() => {});
    await sleep(400);
  }
  const optionButton = page.getByRole('button', { name: /A|B|C|D|正确|错误|选择|性能|约束|储备|可行域/ });
  if (await optionButton.count()) {
    await optionButton.first().click().catch(() => {});
    await sleep(600);
  }
  const submit = page.getByRole('button', { name: /提交答案|提交|保存作答/ });
  let submitDisabled = false;
  if (await submit.count()) {
    submitDisabled = await submit.first().isDisabled().catch(() => false);
    if (!submitDisabled) {
      await submit.first().click().catch((error) => recordError(`${label} submit answer`, error, page.url()));
      await sleep(2300);
    }
  } else {
    recordError(`${label} submit answer`, 'submit button not found', page.url());
  }
  return {
    beforeButtonCount: before.buttons.length,
    submitFound: Boolean(await submit.count()),
    submitDisabled,
  };
}

async function createClassSession(page) {
  const response = await page.evaluate(async ({ planId, classId: targetClassId }) => {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, classId: targetClassId }),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  }, { planId: populatedLessonPlanId, classId });
  if (!response.ok) {
    throw new Error(`create class session failed ${response.status}: ${JSON.stringify(response.body)}`);
  }
  createdSessionId = response.body.id;
  createdJoinCode = response.body.joinCode;
  return response.body;
}

async function lookupStudentHref(page, joinCode) {
  const response = await page.evaluate(async (code) => {
    const res = await fetch(`/api/session/join?code=${code}`);
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  }, joinCode);
  if (!response.ok || !response.body.studentHref) {
    throw new Error(`join lookup failed ${response.status}: ${JSON.stringify(response.body)}`);
  }
  return response.body.studentHref;
}

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });

  const activeBefore = await prisma.classSession.findMany({
    where: { classId, status: 'ACTIVE' },
    select: { id: true, joinCode: true, plan: { select: { title: true } } },
  });
  if (activeBefore.length > 0) {
    throw new Error(`class already has active sessions: ${activeBefore.map((item) => item.id).join(', ')}`);
  }

  const preparedStudents = await prepareStudents();
  browser = await chromium.launch({ headless: true });

  const teacherDesktop = await newPage(desktop, 'teacher', 'dismiss');
  await gotoStable(teacherDesktop.page, `/teacher/classes/${classId}`, 3600);
  await capture(teacherDesktop.page, '01-teacher-class-detail-before-session-desktop.png', 'teacher class detail before session desktop', {
    expected: 'teacher should understand class roster, active sessions, and start-class paths before launching a live class',
    classId,
    className,
  });

  const session = await createClassSession(teacherDesktop.page);
  await gotoStable(teacherDesktop.page, `/interactive-learning/courses/${courseSlug}/teacher/${session.id}`, 4800);
  await capture(teacherDesktop.page, '02-teacher-class-bound-runtime-initial-desktop.png', 'teacher class-bound runtime initial desktop', {
    expected: 'class-bound teacher runtime should expose class name, join code, online count, and current step without raw-id-first copy',
    createdSessionId,
    createdJoinCode,
    classId: session.classId,
  });

  await clickControl(teacherDesktop.page, 'button', /二维码/);
  await capture(teacherDesktop.page, '03-teacher-class-bound-qr-dialog-desktop.png', 'teacher class-bound QR dialog desktop', {
    expected: 'QR dialog should show classroom identity, join code, copy feedback, and student restriction context',
    createdSessionId,
    createdJoinCode,
  });
  await teacherDesktop.page.keyboard.press('Escape');
  await sleep(900);

  const studentA = await newPage(mobile, 'studentA');
  await gotoStable(studentA.page, `/classroom/join?code=${createdJoinCode}`, 3600);
  await capture(studentA.page, '04-student-a-join-code-result-mobile.png', 'student A join code result mobile', {
    expected: 'class student should see target classroom, teacher, class name, and primary enter-class action',
    studentNumber: accounts.studentA.account,
    createdJoinCode,
  });
  await clickControl(studentA.page, 'button', /进入课堂|加入课堂/);
  await sleep(3200);
  const studentAHref = await lookupStudentHref(studentA.page, createdJoinCode);
  if (!studentA.page.url().includes(createdSessionId)) {
    await gotoStable(studentA.page, studentAHref, 3800);
  }
  await capture(studentA.page, '05-student-a-runtime-after-join-mobile.png', 'student A runtime after join mobile', {
    expected: 'joined student runtime should identify class-bound classroom and synchronized learning state',
    studentNumber: accounts.studentA.account,
    studentHref: studentAHref,
  });

  const studentB = await newPage(mobile, 'studentB');
  await gotoStable(studentB.page, `/classroom/join?code=${createdJoinCode}`, 3600);
  await capture(studentB.page, '06-student-b-join-code-result-mobile.png', 'student B join code result mobile', {
    expected: 'second student should join the same live classroom without class mismatch friction',
    studentNumber: accounts.studentB.account,
    createdJoinCode,
  });
  const studentBHref = await lookupStudentHref(studentB.page, createdJoinCode);
  await gotoStable(studentB.page, studentBHref, 3800);
  await capture(studentB.page, '07-student-b-runtime-after-join-mobile.png', 'student B runtime after join mobile', {
    expected: 'second joined student should render the same synchronized classroom state',
    studentNumber: accounts.studentB.account,
    studentHref: studentBHref,
  });

  await teacherDesktop.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(3200);
  await clickControl(teacherDesktop.page, 'button', /当前在线学生/);
  await capture(teacherDesktop.page, '08-teacher-online-students-after-two-joins-desktop.png', 'teacher online students after two joins desktop', {
    expected: 'teacher should see two real class students online with recency and identity sufficient for in-class decisions',
    students: preparedStudents.map((student) => student.studentNumber),
  });
  await teacherDesktop.page.keyboard.press('Escape');
  await sleep(900);

  const teacherStepAction = await chooseStep(teacherDesktop.page, targetStepId);
  await capture(teacherDesktop.page, '09-teacher-step03-before-release-desktop.png', 'teacher step03 before release desktop', {
    expected: 'teacher should see release state, submission summary, and answer visibility before releasing activity',
    action: teacherStepAction,
    targetStepId,
  });

  const releaseAction = await clickControl(teacherDesktop.page, 'button', /发放作答|已发放作答/);
  await capture(teacherDesktop.page, '10-teacher-step03-release-action-desktop.png', 'teacher step03 release action desktop', {
    expected: 'release action should make state explicit for teacher and students without requiring guesswork',
    action: releaseAction,
  });

  await studentA.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2400);
  await chooseStep(studentA.page, targetStepId);
  await capture(studentA.page, '11-student-a-step03-after-release-mobile.png', 'student A step03 after release mobile', {
    expected: 'released activity should expose controls and evidence copy on student A mobile runtime',
    targetStepId,
  });
  const studentASubmit = await answerFirstVisibleQuestion(studentA.page, 'student A');
  await capture(studentA.page, '12-student-a-step03-submit-result-mobile.png', 'student A step03 submit result mobile', {
    expected: 'student A submission should produce durable, visible completion feedback',
    submitMeta: studentASubmit,
  });

  await studentB.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2400);
  await chooseStep(studentB.page, targetStepId);
  await capture(studentB.page, '13-student-b-step03-after-release-mobile.png', 'student B step03 after release mobile', {
    expected: 'released activity should remain understandable for a second concurrent student',
    targetStepId,
  });
  const studentBSubmit = await answerFirstVisibleQuestion(studentB.page, 'student B');
  await capture(studentB.page, '14-student-b-step03-submit-result-mobile.png', 'student B step03 submit result mobile', {
    expected: 'student B submission should not overwrite or obscure student A state',
    submitMeta: studentBSubmit,
  });

  await teacherDesktop.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(3200);
  await chooseStep(teacherDesktop.page, targetStepId);
  await capture(teacherDesktop.page, '15-teacher-step03-two-submissions-summary-desktop.png', 'teacher step03 two submissions summary desktop', {
    expected: 'teacher should see two participating students and submission total with clear drill-down affordance',
    targetStepId,
  });
  const answerToggleAction = await clickControl(teacherDesktop.page, 'button', /显示参考答案|隐藏参考答案/);
  await capture(teacherDesktop.page, '16-teacher-step03-reference-answer-toggle-desktop.png', 'teacher step03 reference answer toggle desktop', {
    expected: 'reference answer visibility should be explicit for projection and student-facing timing',
    action: answerToggleAction,
  });

  const teacherMobile = await newPage(mobile, 'teacher', 'accept');
  await gotoStable(teacherMobile.page, `/interactive-learning/courses/${courseSlug}/teacher/${session.id}`, 3600);
  await capture(teacherMobile.page, '17-teacher-mobile-live-class-before-end.png', 'teacher mobile live class before end', {
    expected: 'mobile teacher runtime should keep live controls usable after two student submissions',
    createdSessionId,
    createdJoinCode,
  });
  await clickControl(teacherMobile.page, 'button', /结束课堂/, { waitMs: 2800 });
  await capture(teacherMobile.page, '18-teacher-mobile-end-class-result.png', 'teacher mobile end class result', {
    expected: 'ending a class-bound session should lead to class history, review, or report continuation',
    createdSessionId,
    createdJoinCode,
  });

  await studentA.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2600);
  await capture(studentA.page, '19-student-a-after-teacher-ended-mobile.png', 'student A after teacher ended mobile', {
    expected: 'student should see ended-state copy and a stable path to evidence after teacher ends class',
    studentNumber: accounts.studentA.account,
  });

  await gotoStable(studentA.page, '/profile/evidence', 3000);
  await capture(studentA.page, '20-student-a-profile-evidence-after-two-submissions-mobile.png', 'student A profile evidence after two submissions mobile', {
    expected: 'student profile evidence should make classroom submission discoverable after the class ends',
    studentNumber: accounts.studentA.account,
  });

  await gotoStable(teacherDesktop.page, `/classroom/teacher/${session.id}/review`, 4600);
  await capture(teacherDesktop.page, '21-teacher-review-after-class-bound-end-desktop.png', 'teacher review after class-bound end desktop', {
    expected: 'class-bound post-class review should show class, students, submissions, facts, and report next steps',
    createdSessionId,
    createdJoinCode,
  });

  await gotoStable(teacherDesktop.page, `/teacher/classes/${classId}`, 4200);
  await capture(teacherDesktop.page, '22-teacher-class-detail-after-ended-session-desktop.png', 'teacher class detail after ended session desktop', {
    expected: 'class detail should make the ended live session discoverable from teacher workflow',
    createdSessionId,
    createdJoinCode,
  });

  const finalSessionState = await prisma.classSession.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      joinCode: true,
      classId: true,
      status: true,
      endTime: true,
      studentStates: { select: { userId: true } },
      studentStepResponses: { select: { userId: true, stepId: true, createdAt: true } },
    },
  });

  await studentA.context.close();
  await studentB.context.close();
  await teacherDesktop.context.close();
  await teacherMobile.context.close();

  return { finalSessionState, preparedStudents };
}

async function main() {
  let runResult = null;
  try {
    runResult = await runAudit();
  } finally {
    try {
      if (browser) await browser.close();
    } catch (error) {
      recordError('browser close', error);
    }
    try {
      await finishCreatedSession();
    } catch (error) {
      recordError('finish created session cleanup', error);
    }
    try {
      await restoreStudents();
    } catch (error) {
      recordError('restore student passwords cleanup', error);
    }

    const restoredStudents = studentBackups.length
      ? await prisma.user.findMany({
        where: { id: { in: studentBackups.map((student) => student.userId) } },
        select: { id: true, passwordHash: true },
      }).catch((error) => {
        recordError('verify restored student passwords', error);
        return [];
      })
      : [];
    const sessionAfterCleanup = createdSessionId
      ? await prisma.classSession.findUnique({
        where: { id: createdSessionId },
        select: { id: true, status: true, classId: true, joinCode: true, endTime: true },
      }).catch((error) => {
        recordError('verify created session cleanup', error);
        return null;
      })
      : null;

    await fs.writeFile(manifestPath, JSON.stringify({
      baseUrl,
      generatedAt: new Date().toISOString(),
      batch: 24,
      populatedLessonPlanId,
      populatedLessonTitle,
      classId,
      className,
      courseSlug,
      targetStepId,
      createdSessionId,
      createdJoinCode,
      auditStudentNumbers: studentNumbers,
      studentPasswordRestored: studentBackups.every((backup) => {
        const restored = restoredStudents.find((student) => student.id === backup.userId);
        return restored?.passwordHash === backup.originalPasswordHash;
      }),
      sessionAfterCleanup,
      finalSessionState: runResult?.finalSessionState ?? null,
      cleanupActions,
      screenshotCount: results.length,
      screenshots: results.map((item) => item.screenshot),
      results,
      dialogs,
      downloads,
      fallbackClicks,
      ignoredErrors,
      errors,
    }, null, 2));

    await prisma.$disconnect();
  }

  console.log(JSON.stringify({
    manifestPath,
    createdSessionId,
    createdJoinCode,
    screenshots: results.length,
    dialogs: dialogs.length,
    downloads: downloads.length,
    fallbackClicks: fallbackClicks.length,
    cleanupActions,
    ignoredErrors,
    errors,
  }, null, 2));

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  recordError('fatal', error);
  try {
    await finishCreatedSession();
    await restoreStudents();
  } catch {
    // Manifest writing in main records cleanup errors; this catch only prevents masking the fatal error.
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
  console.error(error);
  process.exit(1);
});
