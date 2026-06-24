import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/78-function-state-flows-batch43');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch43-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
  admin: { account: 'admin', password: 'admin@Just' },
};

const classId = 'cmma7g0590004g9q2nl2jyzdf';
const sessionId = 'cmqm6s1s1001f1wyf4ggkifs5';
const publicationId = 'cmqluwvqo0001pmyf34og34jy';

const results = [];
const routeResponses = [];
const apiChecks = [];
const downloads = [];
const optionalActions = [];
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
  await sleep(1400);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2800);
  if (page.url().includes('/login')) {
    await page.locator('form button[type="submit"], button[type="submit"]').first().click().catch((error) => {
      recordIgnoredError(`login ${role} submit fallback`, error, page.url());
    });
    await sleep(2800);
  }
  const session = await page.evaluate(async () => {
    const res = await fetch('/api/auth/session').catch(() => null);
    return res?.ok ? res.json().catch(() => null) : null;
  }).catch(() => null);
  optionalActions.push({
    action: `login ${role}`,
    status: page.url().includes('/login') ? 'still-on-login' : 'submitted',
    sessionRole: session?.user?.role || '',
    sessionUser: session?.user?.name || session?.user?.email || '',
    url: page.url(),
  });
}

async function gotoStable(page, route, waitMs = 2200) {
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
      !el ||
      el.hidden ||
      el.closest('[hidden]') ||
      getComputedStyle(el).display === 'none' ||
      getComputedStyle(el).visibility === 'hidden'
    );
    const controls = [...document.querySelectorAll('button, [role="button"], a[href], input, textarea, select, summary, [tabindex]:not([tabindex="-1"])')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      type: el.getAttribute('type') || '',
      name: name(el),
      href: el.getAttribute('href') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      hidden: !visible(el),
      inFloating: Boolean(el.closest('[data-page-floating-controls]')),
      reportSurface: el.closest('[data-report-ledger-surface]')?.getAttribute('data-report-ledger-surface') || '',
    }));
    const reportSurfaces = [...document.querySelectorAll('[data-report-ledger-surface]')].map((el) => ({
      surface: el.getAttribute('data-report-ledger-surface') || '',
      export: el.getAttribute('data-report-ledger-export') || '',
      privacy: el.getAttribute('data-report-ledger-privacy-scope') || '',
      unavailable: el.getAttribute('data-operations-unavailable-slot') || '',
      text: text(el).slice(0, 900),
    }));
    const statusRegions = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const tables = [...document.querySelectorAll('table')].map((table) => ({
      headers: [...table.querySelectorAll('th')].map(text).filter(Boolean),
      rowCount: table.querySelectorAll('tbody tr').length,
      caption: text(table.querySelector('caption')),
    }));
    const graphics = [...document.querySelectorAll('svg, canvas')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      role: el.getAttribute('role') || '',
      ariaHidden: el.getAttribute('aria-hidden') || '',
    }));
    const active = document.activeElement;
    const bodyText = text(document.body);
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 30),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        role: active?.getAttribute?.('role') || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
      },
      controls,
      visibleControls: controls.filter((control) => !control.hidden).slice(0, 80),
      alerts: statusRegions,
      reportSurfaces,
      tables,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: bodyText.slice(0, 18000),
      scroll: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
    };
  });
}

function summarizeAudit(audit) {
  const allText = `${audit.bodyText} ${audit.controls.map((item) => item.name).join(' ')}`;
  return {
    h1: audit.h1,
    h2: audit.h2,
    activeElement: audit.activeElement,
    alerts: audit.alerts,
    reportSurfaces: audit.reportSurfaces,
    tableCount: audit.tables.length,
    tables: audit.tables.slice(0, 8),
    visibleControls: audit.visibleControls,
    graphicsCount: audit.graphicsCount,
    unnamedGraphics: audit.unnamedGraphics,
    scroll: audit.scroll,
    hits: {
      export: /导出|下载|Export|export/.test(allText),
      send: /发送|推送|通知|分享/.test(allText),
      copy: /复制|摘要/.test(allText),
      reinforcement: /补强|练习|路径/.test(allText),
      status: audit.alerts.length > 0 || /成功|完成|失败|正在|已下载|已导出|已发送|已保存/.test(allText),
      batch: /批次|批量|导入|失败行|预览|撤销/.test(allText),
      riskDisposition: /处置|分派|标记|查看证据|创建待办/.test(allText),
      reportLedger: audit.reportSurfaces.length > 0,
      unavailable: /不可用|受限|deferred|restricted|未开放|不存在/.test(allText),
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

async function focusTrail(page, count = 8) {
  const trail = [];
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press('Tab').catch((error) => recordIgnoredError('tab focus', error, page.url()));
    await sleep(80);
    const item = await page.evaluate(() => {
      const el = document.activeElement;
      const text = (node) => (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        tag: el?.tagName?.toLowerCase() || '',
        role: el?.getAttribute?.('role') || '',
        type: el?.getAttribute?.('type') || '',
        name: el?.getAttribute?.('aria-label') || el?.getAttribute?.('title') || text(el) || el?.getAttribute?.('placeholder') || '',
        href: el?.getAttribute?.('href') || '',
        reportSurface: el?.closest?.('[data-report-ledger-surface]')?.getAttribute('data-report-ledger-surface') || '',
      };
    });
    trail.push({ index: index + 1, ...item });
  }
  return trail;
}

async function tryDownloadByRole(page, role, name, action, waitMs = 1800) {
  const locator = page.getByRole(role, { name }).first();
  if (!(await locator.count())) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  const downloadPromise = page.waitForEvent('download', { timeout: 3500 }).catch((error) => error);
  const clickError = await locator.click({ timeout: 1800 }).then(() => null).catch((error) => error);
  await sleep(waitMs);
  const download = await downloadPromise;
  const record = {
    action,
    status: clickError ? 'blocked' : download && !(download instanceof Error) ? 'downloaded' : 'clicked-no-download',
    url: page.url(),
    message: clickError instanceof Error ? clickError.message.split('\n')[0] : download instanceof Error ? download.message.split('\n')[0] : undefined,
  };
  optionalActions.push(record);
  if (download && !(download instanceof Error)) {
    downloads.push({ action, suggestedFilename: download.suggestedFilename(), pageUrl: page.url(), url: download.url() });
  }
  return record.status === 'downloaded';
}

async function clickByRole(page, role, name, action, waitMs = 1000) {
  const locator = page.getByRole(role, { name }).first();
  if (!(await locator.count())) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  const error = await locator.click({ timeout: 1800 }).then(() => null).catch((caught) => caught);
  optionalActions.push({
    action,
    status: error ? 'blocked' : 'attempted',
    url: page.url(),
    message: error instanceof Error ? error.message.split('\n')[0] : undefined,
  });
  await sleep(waitMs);
  return !error;
}

async function fetchApi(page, label, route, expectedStatuses) {
  const response = await page.evaluate(async (targetRoute) => {
    const res = await fetch(targetRoute, { headers: { accept: 'application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
    const contentType = res.headers.get('content-type') || '';
    const disposition = res.headers.get('content-disposition') || '';
    let body;
    if (contentType.includes('json')) {
      body = await res.json().catch(() => ({}));
    } else {
      const buffer = await res.arrayBuffer();
      body = { byteLength: buffer.byteLength };
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
    summary: JSON.stringify(response.body).slice(0, 1800),
  });
  if (!accepted) recordError(`api ${label}`, `unexpected status ${response.status}`, route);
}

async function scrollIntoView(page, selector, action) {
  const found = await page.locator(selector).first().count();
  if (!found) {
    optionalActions.push({ action, status: 'not-found', selector, url: page.url() });
    return false;
  }
  await page.locator(selector).first().scrollIntoViewIfNeeded().catch((error) => recordIgnoredError(action, error, page.url()));
  await sleep(500);
  optionalActions.push({ action, status: 'scrolled', selector, url: page.url() });
  return true;
}

async function waitForGovernanceContent(page) {
  await page.waitForFunction(() => {
    const body = document.body.innerText;
    return /待处理风险|最近风险|课堂质量|数据新鲜度|刷新状态|风险标记/.test(body);
  }, null, { timeout: 20000 }).catch((error) => {
    recordIgnoredError('wait admin governance content', error, page.url());
  });
  await sleep(1200);
}

async function newPage(role, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.on('download', (download) => {
    downloads.push({ action: 'page download event', suggestedFilename: download.suggestedFilename(), pageUrl: page.url(), url: download.url() });
  });
  page.on('pageerror', (error) => {
    if (error.message.includes("Failed to set the 'domain' property on 'Document'")) {
      recordIgnoredError('pageerror', error, page.url());
      return;
    }
    recordIgnoredError('pageerror', error, page.url());
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    if (failure?.errorText === 'net::ERR_BLOCKED_BY_ORB' && request.url().includes('cldisk.com')) {
      recordIgnoredError('requestfailed', failure.errorText, request.url());
      return;
    }
    recordIgnoredError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  if (role) await login(page, role);
  return { context, page };
}

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const teacher = await newPage('teacher', desktop);
  await gotoStable(teacher.page, `/classroom/teacher/${sessionId}/review`, 4200);
  await capture(teacher.page, '01-teacher-review-delivery-desktop.png', 'teacher review delivery desktop', {
    expected: 'post-class review should surface export/send/copy/reinforcement delivery actions near the report summary',
    focusTrail: await focusTrail(teacher.page, 10),
  });
  await clickByRole(teacher.page, 'link', /评审聚合|报告|评分|复盘|统计/, 'teacher review outbound report link', 1500);
  await capture(teacher.page, '02-teacher-review-linked-destination.png', 'teacher review linked destination', {
    expected: 'outbound report link should preserve classroom/session context and identify whether it is an internal review page',
  });
  await gotoStable(teacher.page, '/teacher', 3600);
  await scrollIntoView(teacher.page, '[data-report-ledger-surface]', 'scroll teacher dashboard report ledger');
  await capture(teacher.page, '03-teacher-dashboard-report-ledger.png', 'teacher dashboard report ledger', {
    expected: 'teacher dashboard should expose section-level delivery status for reports and assistant-effect exports',
  });
  await gotoStable(teacher.page, `/teacher/classes/${classId}/analytics-v2`, 4200);
  await scrollIntoView(teacher.page, '[data-report-ledger-surface="teacher-class-analytics-report"]', 'scroll class analytics report ledger');
  await capture(teacher.page, '04-teacher-class-analytics-report-ledger.png', 'teacher class analytics report ledger', {
    expected: 'class analytics report ledger should explain restricted export, available handoffs, and next actions',
  });
  await gotoStable(teacher.page, `/teacher/arena/publications/${publicationId}`, 3600);
  await capture(teacher.page, '05-teacher-arena-publication-report-delivery.png', 'teacher Arena publication report delivery', {
    expected: 'Arena publication report should distinguish report reading from export/send/lock/review delivery work',
  });
  await gotoStable(teacher.page, '/data-center', 3600);
  await scrollIntoView(teacher.page, '[data-report-ledger-surface="data-center-platform-snapshot"]', 'scroll teacher data center export surface');
  await tryDownloadByRole(teacher.page, 'button', /导出演示快照|导出/, 'teacher data center export download');
  await capture(teacher.page, '06-teacher-data-center-export-attempt.png', 'teacher data center export attempt', {
    expected: 'data-center export should trigger a download and visible completion/failure state without dock interception',
  });
  await fetchApi(teacher.page, 'class control correction report export', `/api/teacher/classes/${classId}/control-correction-report?export=true`, [200]);
  await fetchApi(teacher.page, 'class assistant effect report export', `/api/teacher/classes/${classId}/assistant-effect-report?export=true`, [200, 404]);
  await teacher.context.close();

  const student = await newPage('student', desktop);
  await gotoStable(student.page, '/assessment/document-feedback?demo=1', 3600);
  await capture(student.page, '07-student-document-feedback-delivery.png', 'student document feedback delivery', {
    expected: 'student feedback report should clarify preview/demo boundaries, export policy, and next learning actions',
    focusTrail: await focusTrail(student.page, 10),
  });
  await student.context.close();

  const admin = await newPage('admin', desktop);
  await gotoStable(admin.page, '/admin/users', 3600);
  await tryDownloadByRole(admin.page, 'button', /下载模板/, 'admin users template download');
  await capture(admin.page, '08-admin-users-template-download-state.png', 'admin users template download state', {
    expected: 'template download should produce a download event and page-visible completion status tied to batch import',
  });
  await gotoStable(admin.page, '/admin/data-governance', 4600);
  await waitForGovernanceContent(admin.page);
  await clickByRole(admin.page, 'button', /刷新状态|刷新数据|刷新/, 'admin governance refresh before export review', 1500);
  await waitForGovernanceContent(admin.page);
  await capture(admin.page, '09-admin-governance-export-disposition-state.png', 'admin governance export and disposition state', {
    expected: 'governance risk table should expose row-level disposition, export, and refresh completion state',
  });
  await gotoStable(admin.page, '/admin/config', 3600);
  await capture(admin.page, '10-admin-config-save-export-state.png', 'admin config save/export state', {
    expected: 'config save/test/reset controls should expose impact, completion status, and audit trail before changing runtime configuration',
  });
  await fetchApi(admin.page, 'admin users template API', '/api/admin/users/template', [200]);
  await fetchApi(admin.page, 'admin data governance status API', '/api/admin/data-governance/status', [200]);
  await admin.context.close();

  const teacherMobile = await newPage('teacher', mobile);
  await gotoStable(teacherMobile.page, `/classroom/teacher/${sessionId}/review`, 4200);
  await capture(teacherMobile.page, '11-mobile-teacher-review-delivery.png', 'mobile teacher review delivery', {
    expected: 'mobile post-class review should keep delivery actions reachable before the full long report',
    focusTrail: await focusTrail(teacherMobile.page, 8),
  });
  await teacherMobile.context.close();

  const adminMobile = await newPage('admin', mobile);
  await gotoStable(adminMobile.page, '/admin/users', 3600);
  await capture(adminMobile.page, '12-mobile-admin-users-template-import.png', 'mobile admin users template and import', {
    expected: 'mobile user management should keep template download, import status, undo, and notification actions usable without horizontal overflow',
    focusTrail: await focusTrail(adminMobile.page, 8),
  });
  await adminMobile.context.close();
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
      batch: 'function-state-flows-batch43',
      scope: 'report ledger, export/download, teacher review delivery, data-center snapshot export, admin template download, governance disposition, document feedback, and mobile delivery states',
      classId,
      sessionId,
      publicationId,
      routeResponses,
      results,
      apiChecks,
      downloads,
      optionalActions,
      errors,
      ignoredErrors,
      pngCount: files.filter((file) => file.endsWith('.png')).length,
      jsonCount: files.filter((file) => file.endsWith('.json')).length,
    };
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({
      manifestPath,
      screenshotDir,
      results: results.length,
      apiChecks: apiChecks.length,
      downloads: downloads.length,
      optionalActions: optionalActions.length,
      errors: errors.length,
      ignoredErrors: ignoredErrors.length,
      pngCount: manifest.pngCount,
    }, null, 2));
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
