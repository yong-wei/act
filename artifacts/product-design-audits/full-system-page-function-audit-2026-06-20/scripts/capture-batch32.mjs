import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/67-function-state-flows-batch32');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch32-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
  admin: { account: 'admin', password: 'admin@Just' },
};

const classId = 'cmma7g0590004g9q2nl2jyzdf';
const populatedLessonPlanId = 'cmqeakmuy0024cnyf1z2ttquo';
const results = [];
const routeResponses = [];
const apiChecks = [];
const dialogs = [];
const downloads = [];
const optionalActions = [];
const errors = [];
const ignoredErrors = [];
let browser = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function recordError(action, error, url = '') {
  errors.push({ action, message: error instanceof Error ? error.message : String(error), url });
}

function recordIgnoredError(action, error, url = '') {
  ignoredErrors.push({ action, message: error instanceof Error ? error.message : String(error), url });
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

async function gotoStable(page, route, waitMs = 3000) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' }).catch((error) => {
    recordError(`goto ${route}`, error, page.url());
    return null;
  });
  routeResponses.push({ route, status: response?.status?.() ?? null, url: response?.url?.() ?? `${baseUrl}${route}` });
  await sleep(waitMs);
  return response;
}

async function waitForGovernanceLoaded(page) {
  await page.waitForFunction(() => !document.body.innerText.includes('正在加载数据治理看板'), null, { timeout: 20000 }).catch(() => {});
  await sleep(800);
}

function elementName(el) {
  return (
    el?.getAttribute?.('aria-label') ||
    el?.getAttribute?.('title') ||
    el?.getAttribute?.('alt') ||
    el?.innerText ||
    el?.textContent ||
    ''
  ).replace(/\s+/g, ' ').trim();
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
    const controls = [...document.querySelectorAll('button, [role="button"], a[href], input, textarea, select, summary, [tabindex]:not([tabindex="-1"])')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      name: name(el),
      type: el.getAttribute('type') || '',
      href: el.getAttribute('href') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      ariaExpanded: el.getAttribute('aria-expanded') || '',
      ariaSelected: el.getAttribute('aria-selected') || '',
      ariaInvalid: el.getAttribute('aria-invalid') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      hidden: Boolean(el.hidden || el.closest('[hidden]') || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden'),
    }));
    const inputs = [...document.querySelectorAll('input, textarea, select')].map((el) => {
      const id = el.getAttribute('id') || '';
      const labelledBy = el.getAttribute('aria-labelledby') || '';
      const labelText = id ? text(document.querySelector(`label[for="${CSS.escape(id)}"]`)) : '';
      const wrappedLabel = text(el.closest('label'));
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        name: el.getAttribute('name') || '',
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        ariaInvalid: el.getAttribute('aria-invalid') || '',
        ariaDescribedBy: el.getAttribute('aria-describedby') || '',
        ariaLabelledBy: labelledBy,
        labelText: labelText || wrappedLabel,
        accept: el.getAttribute('accept') || '',
        value: 'value' in el ? String(el.value || '').slice(0, 160) : '',
        hidden: Boolean(el.hidden || el.closest('[hidden]') || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden'),
      };
    });
    const tables = [...document.querySelectorAll('table')].map((table) => ({
      headers: [...table.querySelectorAll('th')].map(text).filter(Boolean),
      rowCount: table.querySelectorAll('tbody tr').length,
      caption: text(table.querySelector('caption')),
    }));
    const statusRegions = [...document.querySelectorAll('[role="alert"], [aria-live], [role="status"]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const dialogs = [...document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]')].map((el) => ({
      name: name(el),
      modal: el.getAttribute('aria-modal') || '',
      text: text(el).slice(0, 600),
    }));
    const graphics = [...document.querySelectorAll('svg, canvas')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      role: el.getAttribute('role') || '',
      ariaHidden: el.getAttribute('aria-hidden') || '',
    }));
    const focusable = controls.filter((item) => !item.hidden && !item.disabled).slice(0, 80);
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      h2: [...document.querySelectorAll('h2')].map(text).filter(Boolean).slice(0, 16),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        role: active?.getAttribute?.('role') || '',
        name: name(active),
        placeholder: active?.getAttribute?.('placeholder') || '',
      },
      controls: controls.slice(0, 360),
      inputs,
      tables,
      alerts: statusRegions,
      dialogs,
      focusable,
      unnamedControls: controls.filter((item) => !item.hidden && !item.name && ['button', 'a'].includes(item.tag)).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 14000),
    };
  });
}

async function focusTrail(page, count = 10) {
  const trail = [];
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press('Tab').catch((error) => recordIgnoredError('tab focus', error, page.url()));
    await sleep(120);
    const item = await page.evaluate(() => {
      const el = document.activeElement;
      const text = (node) => (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        index: 0,
        tag: el?.tagName?.toLowerCase() || '',
        type: el?.getAttribute?.('type') || '',
        role: el?.getAttribute?.('role') || '',
        name: el?.getAttribute?.('aria-label') || el?.getAttribute?.('title') || text(el) || el?.getAttribute?.('placeholder') || '',
        href: el?.getAttribute?.('href') || '',
      };
    });
    item.index = index + 1;
    trail.push(item);
  }
  return trail;
}

function summarizeAudit(audit) {
  const body = audit.bodyText;
  return {
    h1: audit.h1,
    h2: audit.h2,
    activeElement: audit.activeElement,
    inputCount: audit.inputs.length,
    inputsWithoutExplicitLabels: audit.inputs.filter((input) => !input.hidden && !input.ariaLabel && !input.ariaLabelledBy && !input.labelText).slice(0, 12),
    fileInputs: audit.inputs.filter((input) => input.type === 'file'),
    focusableCount: audit.focusable.length,
    firstFocusable: audit.focusable.slice(0, 16),
    unnamedControls: audit.unnamedControls,
    alerts: audit.alerts,
    dialogs: audit.dialogs,
    tableCount: audit.tables.length,
    tables: audit.tables.slice(0, 8),
    graphicsCount: audit.graphicsCount,
    unnamedGraphics: audit.unnamedGraphics,
    hits: {
      error: /错误|失败|无效|不能为空|至少|无法|Not found|Error/.test(body),
      liveStatus: audit.alerts.length > 0 || /正在|成功|完成|已更新|失败|保存|提交/.test(body),
      download: /下载|导出|模板/.test(body),
      refresh: /刷新/.test(body),
      modal: audit.dialogs.length > 0,
      chart: audit.graphicsCount > 0,
      floatingDock: /控灵|Konling|助手/.test(body),
    },
  };
}

async function capture(page, fileName, label, notes = {}) {
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = await fs.stat(filePath);
  const audit = await domAudit(page);
  const a11yPath = filePath.replace(/\.png$/, '.a11y.json');
  await fs.writeFile(a11yPath, JSON.stringify({ accessibilitySnapshotUnavailable: true, audit }, null, 2));
  const url = new URL(audit.url);
  results.push({
    step: results.length + 1,
    label,
    route: url.pathname + url.search,
    screenshot: path.relative(root, filePath),
    screenshotBytes: stat.size,
    a11y: path.relative(root, a11yPath),
    notes,
    auditSummary: summarizeAudit(audit),
  });
}

async function maybeClick(page, role, name, actionLabel, waitMs = 1400) {
  const locator = page.getByRole(role, { name });
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', url: page.url() });
    return false;
  }
  await locator.first().click().catch((error) => recordIgnoredError(actionLabel, error, page.url()));
  optionalActions.push({ action: actionLabel, status: 'attempted', url: page.url() });
  await sleep(waitMs);
  return true;
}

async function maybeFill(page, selector, value, actionLabel, waitMs = 500) {
  const locator = page.locator(selector);
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', url: page.url() });
    return false;
  }
  await locator.first().fill(value).catch((error) => recordIgnoredError(actionLabel, error, page.url()));
  optionalActions.push({ action: actionLabel, status: 'attempted', url: page.url() });
  await sleep(waitMs);
  return true;
}

async function newPage(viewport, role = null, dialogAction = 'dismiss') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message(), url: page.url() });
    if (dialogAction === 'accept') {
      await dialog.accept().catch(() => {});
    } else {
      await dialog.dismiss().catch(() => {});
    }
  });
  page.on('download', (download) => {
    downloads.push({ suggestedFilename: download.suggestedFilename(), url: page.url() });
  });
  page.on('pageerror', (error) => {
    if (page.url().includes('/register') && error.message.includes('Objects are not valid as a React child')) {
      recordIgnoredError('register short-password pageerror', error, page.url());
      return;
    }
    recordError('pageerror', error, page.url());
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    recordError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  if (role) await login(page, role);
  return { context, page };
}

async function fetchApi(page, label, route, expectedStatuses) {
  const response = await page.evaluate(async (targetRoute) => {
    const res = await fetch(targetRoute, { headers: { accept: 'application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
    const contentType = res.headers.get('content-type') || '';
    const disposition = res.headers.get('content-disposition') || '';
    let body = {};
    if (contentType.includes('json')) {
      body = await res.json().catch(() => ({}));
    } else {
      const buffer = await res.arrayBuffer();
      body = { byteLength: buffer.byteLength, contentType, disposition };
    }
    return { ok: res.ok, status: res.status, contentType, disposition, body };
  }, route);
  const accepted = expectedStatuses.includes(response.status);
  apiChecks.push({
    label,
    route,
    status: response.status,
    ok: response.ok,
    accepted,
    contentType: response.contentType,
    disposition: response.disposition,
    summary: JSON.stringify(response.body).slice(0, 1600),
  });
  if (!accepted) recordError(`api ${label}`, `unexpected status ${response.status}`, route);
}

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const publicDesktop = await newPage(desktop);
  await gotoStable(publicDesktop.page, '/register', 2600);
  await publicDesktop.page.locator('input[name="name"]').fill(`a11y-${Date.now()}`).catch((error) => recordIgnoredError('fill register name', error, publicDesktop.page.url()));
  await publicDesktop.page.locator('input[name="email"]').fill(`a11y-${Date.now()}@example.com`).catch((error) => recordIgnoredError('fill register email', error, publicDesktop.page.url()));
  await publicDesktop.page.locator('input[name="password"]').fill('short').catch((error) => recordIgnoredError('fill register password', error, publicDesktop.page.url()));
  const registerTrail = await focusTrail(publicDesktop.page, 8);
  await publicDesktop.page.getByRole('button', { name: /^创建账号$/ }).click().catch((error) => recordIgnoredError('submit register short password', error, publicDesktop.page.url()));
  await sleep(2200);
  await capture(publicDesktop.page, '01-register-short-password-a11y-desktop.png', 'register short-password accessibility desktop', {
    expected: 'short password should produce a field-level accessible error without runtime overlay',
    focusTrail: registerTrail,
  });

  await publicDesktop.context.close();

  const studentDesktop = await newPage(desktop, 'student');
  await gotoStable(studentDesktop.page, '/classroom/join?code=999999', 3600);
  const joinTrail = await focusTrail(studentDesktop.page, 8);
  await capture(studentDesktop.page, '02-classroom-join-invalid-code-a11y-desktop.png', 'classroom join invalid code accessibility desktop', {
    expected: 'invalid classroom code should announce error and keep next action clear',
    focusTrail: joinTrail,
  });

  await gotoStable(studentDesktop.page, '/assessment/adaptive-practice?intent=practice&goal=control-correction', 4200);
  await maybeClick(studentDesktop.page, 'button', /开始练习|继续练习|展开|答题|开始/, 'open adaptive practice action', 1400);
  await maybeClick(studentDesktop.page, 'radio', /.*/, 'select adaptive practice radio', 800);
  await maybeClick(studentDesktop.page, 'button', /提交答案|提交|完成/, 'submit adaptive practice answer', 2000);
  const practiceTrail = await focusTrail(studentDesktop.page, 10);
  await capture(studentDesktop.page, '03-adaptive-practice-action-a11y-desktop.png', 'adaptive practice action accessibility desktop', {
    expected: 'practice result should announce success/failure, score, and next remediation action',
    focusTrail: practiceTrail,
  });

  await gotoStable(studentDesktop.page, '/profile/evidence?lessonId=unit-4-1-design-task-expression-v1', 4200);
  const evidenceTrail = await focusTrail(studentDesktop.page, 12);
  await capture(studentDesktop.page, '04-profile-evidence-filtered-a11y-desktop.png', 'profile evidence filtered accessibility desktop', {
    expected: 'filtered evidence should expose source lesson, result count, review target, and remediation action',
    focusTrail: evidenceTrail,
  });
  await fetchApi(studentDesktop.page, 'latest learning path control correction', '/api/learning-paths/latest?goal=control-correction', [200]);
  await studentDesktop.context.close();

  const teacherDesktop = await newPage(desktop, 'teacher');
  await gotoStable(teacherDesktop.page, `/teacher/classes/${classId}/analytics-v2`, 5200);
  const analyticsTrail = await focusTrail(teacherDesktop.page, 12);
  await capture(teacherDesktop.page, '05-teacher-class-analytics-chart-a11y-desktop.png', 'teacher class analytics chart accessibility desktop', {
    expected: 'analytics charts should expose text alternatives, data tables, and report actions',
    focusTrail: analyticsTrail,
  });

  await gotoStable(teacherDesktop.page, `/teacher/classes/${classId}`, 4200);
  await maybeClick(teacherDesktop.page, 'button', /添加学生/, 'open add-students modal');
  const addStudentsTrail = await focusTrail(teacherDesktop.page, 14);
  await capture(teacherDesktop.page, '06-teacher-add-students-modal-focus-a11y-desktop.png', 'teacher add-students modal focus accessibility desktop', {
    expected: 'modal should trap focus, announce dialog purpose, and keep close/search/import controls reachable',
    focusTrail: addStudentsTrail,
  });

  await gotoStable(teacherDesktop.page, `/teacher/lesson-plans/${populatedLessonPlanId}/edit?returnTo=%2Fteacher%2Flesson-plans`, 5200);
  await maybeFill(teacherDesktop.page, 'input[placeholder*="搜索资源"], input[aria-label*="搜索资源"]', 'zzzz-no-resource', 'fill builder empty resource search', 1200);
  const builderTrail = await focusTrail(teacherDesktop.page, 12);
  await capture(teacherDesktop.page, '07-teacher-lesson-builder-empty-search-a11y-desktop.png', 'teacher lesson builder empty search accessibility desktop', {
    expected: 'builder empty search should announce zero results and provide non-drag alternatives',
    focusTrail: builderTrail,
  });
  await fetchApi(teacherDesktop.page, 'teacher class analytics', `/api/teacher/classes/${classId}/analytics`, [200]);
  await teacherDesktop.context.close();

  const adminDesktop = await newPage(desktop, 'admin');
  await gotoStable(adminDesktop.page, '/admin/data-governance', 4400);
  await waitForGovernanceLoaded(adminDesktop.page);
  await maybeClick(adminDesktop.page, 'button', /刷新状态|刷新数据|刷新/, 'refresh admin data governance', 1600);
  await waitForGovernanceLoaded(adminDesktop.page);
  const governanceTrail = await focusTrail(adminDesktop.page, 12);
  await capture(adminDesktop.page, '08-admin-data-governance-refresh-a11y-desktop.png', 'admin data governance refresh accessibility desktop', {
    expected: 'refresh should announce completion and risk table should expose remediation controls',
    focusTrail: governanceTrail,
  });

  await gotoStable(adminDesktop.page, '/admin/users', 3600);
  const adminUsersTrail = await focusTrail(adminDesktop.page, 14);
  await capture(adminDesktop.page, '09-admin-users-import-a11y-desktop.png', 'admin users import accessibility desktop', {
    expected: 'user import should expose upload semantics, batch status, and reversible governance actions',
    focusTrail: adminUsersTrail,
  });
  await fetchApi(adminDesktop.page, 'admin users template download', '/api/admin/users/template', [200]);
  await adminDesktop.context.close();

  const reviewMobile = await newPage(mobile);
  await gotoStable(reviewMobile.page, '/review/adaptive-assessment-figures', 4200);
  const reviewTrail = await focusTrail(reviewMobile.page, 10);
  await capture(reviewMobile.page, '10-review-adaptive-assessment-figures-mobile-a11y.png', 'review adaptive assessment figures mobile accessibility', {
    expected: 'internal review formulas should not be treated as student mobile proof and should expose readable figure semantics',
    focusTrail: reviewTrail,
  });
  await reviewMobile.context.close();
}

async function main() {
  try {
    await runAudit();
  } finally {
    try {
      if (browser) await browser.close();
    } catch (error) {
      recordError('browser close', error);
    }
    const files = await fs.readdir(screenshotDir).catch(() => []);
    const manifest = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      batch: 'function-state-flows-batch32',
      scope: 'cross-role accessibility, keyboard focus, live-region, chart alternative text, modal focus, and upload semantics checks',
      routeResponses,
      results,
      apiChecks,
      dialogs,
      downloads,
      optionalActions,
      errors,
      ignoredErrors,
      pngCount: files.filter((file) => file.endsWith('.png')).length,
      jsonCount: files.filter((file) => file.endsWith('.json')).length,
    };
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ manifestPath, screenshotDir, results: results.length, apiChecks: apiChecks.length, errors: errors.length, ignoredErrors: ignoredErrors.length, pngCount: manifest.pngCount }, null, 2));
    if (errors.length > 0) process.exitCode = 1;
  }
}

main().catch(async (error) => {
  recordError('main', error);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true }).catch(() => {});
  await fs.writeFile(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), errors, ignoredErrors }, null, 2)).catch(() => {});
  console.error(error);
  process.exit(1);
});
