import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/72-function-state-flows-batch37');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch37-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
  admin: { account: 'admin', password: 'admin@Just' },
};

const fixtures = {
  classId: 'cmp1avdj30013e3jfje0h9aqp',
  studentUserId: 'cmp1axwmk0014e3jfdn5p58kt',
  studentName: '唐伟涵',
};

const results = [];
const routeResponses = [];
const apiChecks = [];
const optionalActions = [];
const downloads = [];
const errors = [];
const ignoredErrors = [];
let browser = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function recordError(action, error, url = '') {
  errors.push({ action, message: error instanceof Error ? error.message : String(error), url });
}

function recordIgnoredError(action, error, url = '') {
  ignoredErrors.push({ action, message: error instanceof Error ? error.message : String(error), url });
}

async function login(page, role) {
  const account = accounts[role];
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1000);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2400);
}

async function gotoStable(page, route, waitMs = 2800) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' }).catch((error) => {
    recordError(`goto ${route}`, error, page.url());
    return null;
  });
  await sleep(waitMs);
  routeResponses.push({
    route,
    status: response?.status?.() ?? null,
    requestedUrl: `${baseUrl}${route}`,
    finalUrl: page.url(),
    responseUrl: response?.url?.() ?? '',
  });
  return response;
}

function summarizeJson(body) {
  if (!body || typeof body !== 'object') return { type: typeof body };
  return {
    keys: Object.keys(body).slice(0, 24),
    count: body.total ?? body.items?.length ?? body.facts?.length ?? body.evidence?.length ?? body.records?.length,
    student: body.student ? {
      id: body.student.id,
      name: body.student.name,
      className: body.student.className,
    } : undefined,
    overview: body.overview ? {
      overallScore: body.overview.overallScore,
      factCount: body.overview.factCount,
      riskLabel: body.overview.riskLabel,
    } : undefined,
    sampleText: JSON.stringify(body).slice(0, 1400),
  };
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
    const visible = (el) => !(
      el.hidden ||
      el.closest('[hidden]') ||
      getComputedStyle(el).display === 'none' ||
      getComputedStyle(el).visibility === 'hidden'
    );
    const active = document.activeElement;
    const controls = [...document.querySelectorAll('button, [role="button"], a[href], input, textarea, select, summary, [tabindex]:not([tabindex="-1"])')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      name: name(el),
      type: el.getAttribute('type') || '',
      href: el.getAttribute('href') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      hidden: !visible(el),
    }));
    const alerts = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const graphics = [...document.querySelectorAll('svg, canvas')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      role: el.getAttribute('role') || '',
      ariaHidden: el.getAttribute('aria-hidden') || '',
    }));
    const bodyText = text(document.body).slice(0, 18000);
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 36),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        role: active?.getAttribute?.('role') || '',
        name: name(active),
      },
      controls,
      alerts,
      unnamedControls: controls.filter((item) => !item.hidden && !item.name && ['button', 'a'].includes(item.tag)).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText,
    };
  });
}

async function focusTrail(page, count = 10) {
  const trail = [];
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press('Tab').catch((error) => recordIgnoredError('tab focus', error, page.url()));
    await sleep(90);
    const item = await page.evaluate(() => {
      const el = document.activeElement;
      const text = (node) => (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        tag: el?.tagName?.toLowerCase() || '',
        type: el?.getAttribute?.('type') || '',
        role: el?.getAttribute?.('role') || '',
        name: el?.getAttribute?.('aria-label') || el?.getAttribute?.('title') || text(el) || el?.getAttribute?.('placeholder') || '',
        href: el?.getAttribute?.('href') || '',
      };
    });
    trail.push({ index: index + 1, ...item });
  }
  return trail;
}

function summarizeAudit(audit) {
  const body = audit.bodyText;
  return {
    h1: audit.h1,
    h2: audit.h2,
    url: audit.url,
    activeElement: audit.activeElement,
    firstControls: audit.controls.filter((item) => !item.hidden && !item.disabled).slice(0, 32),
    alerts: audit.alerts,
    unnamedControls: audit.unnamedControls,
    graphicsCount: audit.graphicsCount,
    unnamedGraphics: audit.unnamedGraphics,
    hits: {
      dataCenter: /平台数据中心|数据来源说明|核心平台指标|导出演示快照/.test(body),
      dataCenterExport: /导出快照将自动移除|导出演示快照/.test(body),
      dataGovernanceTarget: /数据治理|风险|治理复核|待处理/.test(body),
      learnerEvidence: /学习证据|课堂作答|证据|学习事实/.test(body),
      teacherStudentDetail: /个体学情|画像摘要|证据治理|控制校正诊断/.test(body),
      teacherStudentEvidence: /学生证据|学习事实|作答摘要|证据时间线/.test(body),
      dashboard: /学习总览|今日学习|工作台|我的学习/.test(body),
      liveRegion: audit.alerts.length > 0,
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
  const url = audit.url.startsWith('http') ? new URL(audit.url) : null;
  results.push({
    step: results.length + 1,
    label,
    route: url ? url.pathname + url.search : audit.url,
    screenshot: path.relative(root, filePath),
    screenshotBytes: stat.size,
    a11y: path.relative(root, a11yPath),
    notes,
    auditSummary: summarizeAudit(audit),
  });
}

async function clickRole(page, role, name, actionLabel, waitMs = 1200) {
  const locator = page.getByRole(role, { name }).first();
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', url: page.url() });
    return false;
  }
  await locator.click().catch((error) => recordIgnoredError(actionLabel, error, page.url()));
  optionalActions.push({ action: actionLabel, status: 'attempted', url: page.url() });
  await sleep(waitMs);
  return true;
}

async function clickFirstLinkByText(page, text, actionLabel, waitMs = 1600) {
  const locator = page.getByRole('link', { name: text }).first();
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', url: page.url() });
    return false;
  }
  await locator.click().catch((error) => recordIgnoredError(actionLabel, error, page.url()));
  optionalActions.push({ action: actionLabel, status: 'attempted', url: page.url() });
  await sleep(waitMs);
  return true;
}

async function newPage(role, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => recordError('pageerror', error, page.url()));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    recordIgnoredError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  await login(page, role);
  return { context, page };
}

async function apiCheck(page, route, label) {
  const response = await page.request.get(`${baseUrl}${route}`).catch((error) => {
    recordError(`api ${label}`, error, route);
    return null;
  });
  if (!response) return;
  const contentType = response.headers()['content-type'] || '';
  let body = null;
  if (contentType.includes('application/json')) {
    body = await response.json().catch((error) => {
      recordIgnoredError(`api json parse ${label}`, error, route);
      return null;
    });
  } else {
    body = await response.text().catch(() => '');
  }
  apiChecks.push({
    label,
    route,
    status: response.status(),
    ok: response.ok(),
    accepted: response.ok(),
    contentType,
    summary: typeof body === 'string' ? { sampleText: body.slice(0, 1000) } : summarizeJson(body),
  });
}

async function main() {
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const teacherSession = await newPage('teacher', desktop);
  const teacherPage = teacherSession.page;
  await apiCheck(teacherPage, '/api/auth/session', 'teacher auth session for batch37');
  await apiCheck(teacherPage, `/api/teacher/classes/${fixtures.classId}/students/${fixtures.studentUserId}/insights`, 'teacher student insights API');
  await apiCheck(teacherPage, `/api/teacher/classes/${fixtures.classId}/students/${fixtures.studentUserId}/evidence`, 'teacher student evidence API');

  await gotoStable(teacherPage, '/data-center');
  await capture(teacherPage, '01-teacher-data-center-desktop.png', 'teacher data center desktop', {
    expected: 'Teacher data center should show source quality, metrics, chart panels, governance links, and export command.',
    focusTrail: await focusTrail(teacherPage, 12),
  });

  await clickFirstLinkByText(teacherPage, '进入治理复核', 'teacher data-center governance link', 1600);
  await capture(teacherPage, '02-teacher-data-center-governance-link-target.png', 'teacher data center governance link target', {
    expected: 'Teacher governance context card should land on a task-specific governance or review surface.',
  });

  await gotoStable(teacherPage, '/data-center');
  const downloadPromise = teacherPage.waitForEvent('download', { timeout: 4000 }).catch((error) => {
    recordIgnoredError('teacher data-center export download', error, teacherPage.url());
    return null;
  });
  await clickRole(teacherPage, 'button', '导出演示快照', 'teacher data-center export snapshot', 800);
  const download = await downloadPromise;
  if (download) {
    downloads.push({
      label: 'teacher data center export snapshot',
      suggestedFilename: download.suggestedFilename(),
    });
  }
  await capture(teacherPage, '03-teacher-data-center-after-export-click.png', 'teacher data center after export click', {
    expected: 'Export should produce a safe snapshot and give visible feedback or a discoverable downloaded artifact.',
    downloads: downloads.slice(),
  });

  await gotoStable(teacherPage, `/teacher/students/${fixtures.studentUserId}/diagnosis`);
  await capture(teacherPage, '04-teacher-legacy-diagnosis-redirect.png', 'teacher legacy diagnosis redirect', {
    expected: 'Legacy diagnosis route should redirect to canonical class-scoped student insight page without losing student context.',
  });
  await clickRole(teacherPage, 'button', '刷新数据', 'teacher student detail refresh data', 1200);
  await capture(teacherPage, '05-teacher-student-detail-after-refresh.png', 'teacher student detail after refresh', {
    expected: 'Refreshing student insight should expose loading/completion state and keep the student context stable.',
  });

  await gotoStable(teacherPage, `/teacher/students/${fixtures.studentUserId}/evidence`);
  await capture(teacherPage, '06-teacher-legacy-evidence-redirect.png', 'teacher legacy evidence redirect', {
    expected: 'Legacy evidence route should redirect to canonical class-scoped evidence timeline.',
  });
  await teacherSession.context.close();

  const adminSession = await newPage('admin', desktop);
  const adminPage = adminSession.page;
  await apiCheck(adminPage, '/api/auth/session', 'admin auth session for batch37');
  await gotoStable(adminPage, '/data-center');
  await capture(adminPage, '07-admin-data-center-desktop.png', 'admin data center desktop', {
    expected: 'Admin data center should use the same presentation surface but route governance actions into admin data governance.',
    focusTrail: await focusTrail(adminPage, 12),
  });
  await clickFirstLinkByText(adminPage, '进入治理复核', 'admin data-center governance link', 1800);
  await capture(adminPage, '08-admin-data-center-governance-link-target.png', 'admin data center governance link target', {
    expected: 'Admin governance context card should land on the actual data-governance queue.',
  });
  await adminSession.context.close();

  const studentSession = await newPage('student', desktop);
  const studentPage = studentSession.page;
  await apiCheck(studentPage, '/api/auth/session', 'student auth session for batch37');
  await gotoStable(studentPage, '/data-center');
  await capture(studentPage, '09-student-data-center-default-redirect.png', 'student data center default redirect', {
    expected: 'Student direct access to operations data center should redirect to learner evidence, with no data-center navigation exposure.',
  });
  await gotoStable(studentPage, '/data-center?returnTo=/dashboard');
  await capture(studentPage, '10-student-data-center-returnto-dashboard.png', 'student data center returnTo dashboard', {
    expected: 'Student returnTo should stay internal and should not silently hide the blocked data-center intent.',
  });
  await gotoStable(studentPage, '/data-center?returnTo=https%3A%2F%2Fexample.com');
  await capture(studentPage, '11-student-data-center-unsafe-returnto.png', 'student data center unsafe returnTo', {
    expected: 'Unsafe returnTo should fall back to learner evidence instead of external navigation.',
  });
  await gotoStable(studentPage, `/teacher/students/${fixtures.studentUserId}/diagnosis`);
  await capture(studentPage, '12-student-legacy-teacher-diagnosis-denied.png', 'student legacy teacher diagnosis denied', {
    expected: 'Student should be denied from teacher legacy routes and routed back to learner dashboard.',
  });
  await studentSession.context.close();

  const mobileTeacherSession = await newPage('teacher', mobile);
  const mobileTeacherPage = mobileTeacherSession.page;
  await gotoStable(mobileTeacherPage, '/data-center');
  await capture(mobileTeacherPage, '13-teacher-data-center-mobile.png', 'teacher data center mobile', {
    expected: 'Mobile teacher data center should keep the source cards, charts, and export action reachable without overlap.',
    focusTrail: await focusTrail(mobileTeacherPage, 10),
  });
  await gotoStable(mobileTeacherPage, `/teacher/classes/${fixtures.classId}/students/${fixtures.studentUserId}/evidence`);
  await capture(mobileTeacherPage, '14-teacher-student-evidence-mobile.png', 'teacher student evidence mobile', {
    expected: 'Mobile student evidence timeline should keep filters and evidence records usable in a narrow viewport.',
  });
  await mobileTeacherSession.context.close();

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png')).sort();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 'function-state-flows-batch37',
    scope: 'Data center teacher/admin/student role states, data-center returnTo redirects, legacy teacher student diagnosis/evidence redirects, canonical student insight/evidence states, and mobile data-center/evidence surfaces',
    fixtures,
    routeResponses,
    results,
    apiChecks,
    optionalActions,
    downloads,
    errors,
    ignoredErrors,
    screenshotDir,
    pngFiles,
    summary: {
      resultCount: results.length,
      apiCheckCount: apiChecks.length,
      downloadCount: downloads.length,
      errorCount: errors.length,
      ignoredErrorCount: ignoredErrors.length,
      pngCount: pngFiles.length,
    },
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({
    manifestPath,
    screenshotDir,
    results: results.length,
    apiChecks: apiChecks.length,
    downloads: downloads.length,
    errors: errors.length,
    ignoredErrors: ignoredErrors.length,
    pngCount: pngFiles.length,
  }, null, 2));
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {});
  });
