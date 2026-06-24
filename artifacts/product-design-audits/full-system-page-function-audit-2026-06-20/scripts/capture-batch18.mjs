import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/53-function-state-flows-batch18');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch18-manifest.json');
const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 1100 };
const sessionId = 'cmqea1d3n001euwyfoi7b6pru';
const joinCode = '129051';
const courseSlug = 'unit-4-1-design-task-expression';
const targetStepId = 'step-03';

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
};

const results = [];
const downloads = [];
const dialogs = [];
const errors = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(page, role) {
  const account = accounts[role];
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2600);
}

async function gotoStable(page, route, waitMs = 2400) {
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
    const buttons = [...document.querySelectorAll('button, [role="button"], a[href]')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      href: el.getAttribute('href') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
    }));
    const inputs = [...document.querySelectorAll('input, textarea, select')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      value: 'value' in el ? String(el.value || '').slice(0, 120) : '',
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
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 5),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
        placeholder: active?.getAttribute?.('placeholder') || '',
      },
      alerts: statusRegions,
      buttons: buttons.slice(0, 140),
      inputs,
      unnamedButtons: buttons.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 2600),
    };
  });
}

async function capture(page, fileName, label, notes = {}) {
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  const audit = await domAudit(page);
  const a11yPath = filePath.replace(/\.png$/, '.a11y.json');
  await fs.writeFile(a11yPath, JSON.stringify({ accessibilitySnapshotUnavailable: true, audit }, null, 2));
  results.push({
    step: results.length + 1,
    label,
    route: new URL(audit.url).pathname + new URL(audit.url).search,
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
    },
  });
}

async function clickRole(page, role, name, options = {}) {
  const locator = page.getByRole(role, { name });
  if (await locator.count()) {
    await locator.first().click(options).catch((error) => errors.push({ action: `click ${String(name)}`, message: error.message, url: page.url() }));
    await sleep(options.waitMs ?? 1400);
    return `${role}:${String(name)}`;
  }
  errors.push({ action: `click ${role}:${String(name)}`, message: 'locator not found', url: page.url() });
  return 'not-found';
}

async function clickText(page, name, options = {}) {
  const locator = page.getByText(name);
  if (await locator.count()) {
    await locator.first().click(options).catch((error) => errors.push({ action: `click text ${String(name)}`, message: error.message, url: page.url() }));
    await sleep(options.waitMs ?? 1200);
    return `text:${String(name)}`;
  }
  errors.push({ action: `click text:${String(name)}`, message: 'locator not found', url: page.url() });
  return 'not-found';
}

async function chooseStep(page, stepId) {
  const select = page.locator('select').filter({ has: page.locator(`option[value="${stepId}"]`) });
  if (await select.count()) {
    await select.first().selectOption(stepId).catch((error) => errors.push({ action: `select step ${stepId}`, message: error.message, url: page.url() }));
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
  if (!changed) errors.push({ action: `select step ${stepId}`, message: 'step select not found', url: page.url() });
  return changed ? 'dom-select' : 'not-found';
}

async function answerFirstVisibleQuestion(page) {
  const before = await domAudit(page);
  const radio = page.locator('input[type="radio"]:visible, input[type="checkbox"]:visible');
  if (await radio.count()) {
    await radio.first().check({ force: true }).catch(async () => {
      await radio.first().click({ force: true }).catch((error) => errors.push({ action: 'answer first radio/checkbox', message: error.message, url: page.url() }));
    });
    await sleep(600);
  }
  const textarea = page.locator('textarea:visible');
  if (await textarea.count()) {
    await textarea.first().fill('审计样本：学生在真实课堂中提交同图异读判断。');
    await sleep(400);
  }
  const textInput = page.locator('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="range"]):not([type="file"]):visible');
  if (await textInput.count()) {
    await textInput.first().fill('审计样本答案').catch(() => {});
    await sleep(400);
  }
  const optionButton = page.getByRole('button', { name: /A|B|C|D|正确|错误|选择|平顺|速度|储备/ });
  if (await optionButton.count()) {
    await optionButton.first().click().catch(() => {});
    await sleep(600);
  }
  const submit = page.getByRole('button', { name: /提交答案|提交/ });
  let submitDisabled = false;
  if (await submit.count()) {
    submitDisabled = await submit.first().isDisabled().catch(() => false);
    if (!submitDisabled) {
      await submit.first().click().catch((error) => errors.push({ action: 'submit student answer', message: error.message, url: page.url() }));
      await sleep(2200);
    }
  } else {
    errors.push({ action: 'submit student answer', message: 'submit button not found', url: page.url() });
  }
  return {
    beforeButtonCount: before.buttons.length,
    submitFound: Boolean(await submit.count()),
    submitDisabled,
  };
}

async function main() {
  await fs.mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

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
    page.on('pageerror', (error) => errors.push({ action: 'pageerror', message: error.message, url: page.url() }));
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      errors.push({ action: 'requestfailed', url: request.url(), message: failure?.errorText || 'unknown' });
    });
    if (role) await login(page, role);
    return { context, page };
  }

  const student = await newPage(mobile, 'student');
  await gotoStable(student.page, `/interactive-learning/courses/${courseSlug}/student/${sessionId}`);
  await capture(student.page, '01-student-runtime-active-initial-mobile.png', 'student runtime active initial mobile', {
    sessionId,
    joinCode,
    expected: 'active student runtime should identify classroom state without exposing raw IDs as primary copy',
  });
  const studentStepAction = await chooseStep(student.page, targetStepId);
  await capture(student.page, '02-student-step03-before-release-mobile.png', 'student step 03 before release mobile', {
    action: studentStepAction,
    targetStepId,
    expected: 'student card should explain whether teacher has released the activity',
  });

  const teacher = await newPage(mobile, 'teacher', 'accept');
  await gotoStable(teacher.page, `/interactive-learning/courses/${courseSlug}/teacher/${sessionId}`);
  await capture(teacher.page, '03-teacher-runtime-active-initial-mobile.png', 'teacher runtime active initial mobile', {
    sessionId,
    joinCode,
  });
  const teacherStepAction = await chooseStep(teacher.page, targetStepId);
  await capture(teacher.page, '04-teacher-step03-before-release-mobile.png', 'teacher step 03 before release mobile', {
    action: teacherStepAction,
    targetStepId,
    expected: 'teacher should see release controls and submission summary in context',
  });
  const releaseAction = await clickRole(teacher.page, 'button', /发放作答|已发放作答/);
  await capture(teacher.page, '05-teacher-step03-release-action-mobile.png', 'teacher step 03 release action mobile', {
    action: releaseAction,
    expected: 'release action should update visible state and not require student refresh without explanation',
  });

  await student.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2400);
  await chooseStep(student.page, targetStepId);
  await capture(student.page, '06-student-step03-after-release-mobile.png', 'student step 03 after release mobile', {
    targetStepId,
    expected: 'student should see answer controls after teacher release',
  });
  const submitMeta = await answerFirstVisibleQuestion(student.page);
  await capture(student.page, '07-student-step03-submit-result-mobile.png', 'student step 03 submit result mobile', {
    action: 'answer and submit first visible question',
    submitMeta,
    expected: 'student submit should produce visible status and a path back to learning evidence',
  });

  await teacher.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2400);
  await chooseStep(teacher.page, targetStepId);
  await capture(teacher.page, '08-teacher-step03-submission-summary-mobile.png', 'teacher step 03 submission summary mobile', {
    expected: 'teacher should see submitted count and answer detail after student submits',
  });
  const answerToggleAction = await clickRole(teacher.page, 'button', /显示参考答案|隐藏参考答案/);
  await capture(teacher.page, '09-teacher-step03-reference-answer-toggle-mobile.png', 'teacher step 03 reference answer toggle mobile', {
    action: answerToggleAction,
    expected: 'answer visibility should be explicit for projection and students',
  });

  const toolAction = await clickText(teacher.page, '本页工具');
  await capture(teacher.page, '10-teacher-runtime-tools-before-end-mobile.png', 'teacher runtime tools before end mobile', {
    action: toolAction,
    expected: 'end-class action should be discoverable with current session context',
  });
  const endAction = await clickRole(teacher.page, 'button', /结束课堂/);
  await sleep(2800);
  await capture(teacher.page, '11-teacher-end-class-result-mobile.png', 'teacher end class result mobile', {
    action: endAction,
    expected: 'end confirmation should lead to a clear post-class route with report/review next step',
  });

  await student.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2600);
  await capture(student.page, '12-student-runtime-after-teacher-ended-mobile.png', 'student runtime after teacher ended mobile', {
    expected: 'student should see ended-state copy and a stable evidence/profile return path',
  });
  await gotoStable(student.page, '/profile/evidence', 2600);
  await capture(student.page, '13-student-profile-evidence-after-submit-mobile.png', 'student profile evidence after submit mobile', {
    expected: 'submitted classroom evidence should be findable from the student profile evidence path',
  });
  await student.context.close();

  await capture(teacher.page, '14-teacher-post-end-current-route-mobile.png', 'teacher post end current route mobile', {
    expected: 'teacher post-end route should expose report/review continuation without requiring memory of prior route',
  });
  const reviewAction = await clickRole(teacher.page, 'link', /报告|复盘|统计|查看|课堂/);
  if (reviewAction === 'not-found') {
    await clickRole(teacher.page, 'button', /报告|复盘|统计|查看|课堂/);
  }
  await capture(teacher.page, '15-teacher-post-end-review-click-result-mobile.png', 'teacher post end review click result mobile', {
    action: reviewAction,
    expected: 'post-class review affordance should route to report or session evidence, if present',
  });
  await teacher.context.close();

  const teacherDesktop = await newPage(desktop, 'teacher');
  await gotoStable(teacherDesktop.page, `/interactive-learning/courses/${courseSlug}/teacher/${sessionId}`);
  await capture(teacherDesktop.page, '16-teacher-ended-session-desktop.png', 'teacher ended session desktop', {
    expected: 'desktop ended classroom route should preserve clear next actions and not masquerade as live projection',
  });
  await teacherDesktop.context.close();

  await browser.close();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 18,
    sessionId,
    joinCode,
    courseSlug,
    targetStepId,
    screenshotCount: results.length,
    downloads,
    dialogs,
    errors,
    results,
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ manifestPath, screenshotCount: results.length, dialogs, errors }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
