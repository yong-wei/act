import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/68-function-state-flows-batch33');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch33-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
  admin: { account: 'admin', password: 'admin@Just' },
};

const classId = 'cmma7g0590004g9q2nl2jyzdf';
const sessionId = 'cmqm6s1s1001f1wyf4ggkifs5';
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
  await sleep(1500);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2600);
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

async function waitUntilTextAbsent(page, text, timeout = 16000) {
  await page.waitForFunction((needle) => !document.body.innerText.includes(needle), text, { timeout }).catch(() => {});
  await sleep(600);
}

function summarizeJson(body) {
  if (!body || typeof body !== 'object') return { type: typeof body };
  return {
    keys: Object.keys(body).slice(0, 24),
    error: body.error || body.message || '',
    hasReport: Boolean(body.report || body.effectReport),
    hasExport: Boolean(body.export),
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
      const labelText = id ? text(document.querySelector(`label[for="${CSS.escape(id)}"]`)) : '';
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        name: el.getAttribute('name') || '',
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        ariaLabelledBy: el.getAttribute('aria-labelledby') || '',
        ariaDescribedBy: el.getAttribute('aria-describedby') || '',
        labelText: labelText || text(el.closest('label')),
        value: 'value' in el ? String(el.value || '').slice(0, 160) : '',
        hidden: Boolean(el.hidden || el.closest('[hidden]') || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden'),
      };
    });
    const statusRegions = [...document.querySelectorAll('[role="alert"], [aria-live], [role="status"]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const dialogs = [...document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]')].map((el) => ({
      name: name(el),
      modal: el.getAttribute('aria-modal') || '',
      text: text(el).slice(0, 500),
    }));
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
    const bodyText = text(document.body).slice(0, 15000);
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      h2: [...document.querySelectorAll('h2')].map(text).filter(Boolean).slice(0, 18),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        role: active?.getAttribute?.('role') || '',
        name: name(active),
        placeholder: active?.getAttribute?.('placeholder') || '',
      },
      controls: controls.slice(0, 420),
      inputs,
      alerts: statusRegions,
      dialogs,
      tables,
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
    await sleep(100);
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
    activeElement: audit.activeElement,
    inputCount: audit.inputs.length,
    fileInputs: audit.inputs.filter((input) => input.type === 'file'),
    inputsWithoutExplicitLabels: audit.inputs.filter((input) => !input.hidden && !input.ariaLabel && !input.ariaLabelledBy && !input.labelText).slice(0, 12),
    alerts: audit.alerts,
    dialogs: audit.dialogs,
    tableCount: audit.tables.length,
    tables: audit.tables.slice(0, 8),
    controlCount: audit.controls.length,
    firstControls: audit.controls.filter((item) => !item.hidden && !item.disabled).slice(0, 18),
    unnamedControls: audit.unnamedControls,
    graphicsCount: audit.graphicsCount,
    unnamedGraphics: audit.unnamedGraphics,
    hits: {
      export: /导出|下载|Export/.test(body),
      send: /发送|推送|分享|通知/.test(body),
      undo: /撤销|回滚|还原/.test(body),
      preview: /预览|diff|草稿/.test(body),
      completion: /完成|成功|已更新|已保存|已生成|提交/.test(body),
      liveRegion: audit.alerts.length > 0,
      batch: /批次|批量|导入|失败行/.test(body),
      governance: /治理|风险|证据|来源|处置/.test(body),
      report: /报告|复盘|评分/.test(body),
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

async function maybeClick(page, role, name, actionLabel, waitMs = 1200) {
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

async function newPage(viewport, role = null) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message(), url: page.url() });
    await dialog.dismiss().catch(() => {});
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
    summary: response.contentType.includes('json') ? summarizeJson(response.body) : JSON.stringify(response.body).slice(0, 1200),
  });
  if (!accepted) recordError(`api ${label}`, `unexpected status ${response.status}`, route);
}

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const teacherDesktop = await newPage(desktop, 'teacher');
  await gotoStable(teacherDesktop.page, `/classroom/teacher/${sessionId}/review`, 4800);
  const reviewTrail = await focusTrail(teacherDesktop.page, 12);
  await capture(teacherDesktop.page, '01-teacher-review-delivery-a11y-desktop.png', 'teacher review delivery accessibility desktop', {
    expected: 'post-class review should expose export, send, generate reinforcement, completion status, and readable chart alternatives',
    focusTrail: reviewTrail,
  });

  await maybeClick(teacherDesktop.page, 'link', /评审聚合|报告|评分|复盘|统计/, 'follow review report-like link', 1800);
  const reviewLinkedTrail = await focusTrail(teacherDesktop.page, 10);
  await capture(teacherDesktop.page, '02-teacher-review-linked-destination-a11y-desktop.png', 'teacher review linked destination accessibility desktop', {
    expected: 'review outbound destination should keep the same class/session context and not become an internal review dead end',
    focusTrail: reviewLinkedTrail,
  });

  await gotoStable(teacherDesktop.page, '/teacher', 4200);
  const teacherHomeTrail = await focusTrail(teacherDesktop.page, 12);
  await capture(teacherDesktop.page, '03-teacher-dashboard-report-ledger-a11y-desktop.png', 'teacher dashboard report ledger accessibility desktop', {
    expected: 'teacher dashboard report ledger should expose report delivery status and available exports from real class evidence',
    focusTrail: teacherHomeTrail,
  });

  await gotoStable(teacherDesktop.page, '/teacher/grading-workbench', 3600);
  const gradingTrail = await focusTrail(teacherDesktop.page, 12);
  await capture(teacherDesktop.page, '04-teacher-grading-workbench-empty-a11y-desktop.png', 'teacher grading workbench empty accessibility desktop', {
    expected: 'empty grading workbench should explain source path, draft state, writeback preview, approval, and export policy',
    focusTrail: gradingTrail,
  });

  await fetchApi(teacherDesktop.page, 'class control correction report export', `/api/teacher/classes/${classId}/control-correction-report?export=true`, [200]);
  await fetchApi(teacherDesktop.page, 'class assistant effect report export', `/api/teacher/classes/${classId}/assistant-effect-report?export=true`, [200, 404]);
  await fetchApi(teacherDesktop.page, 'teacher document grading submissions GET method boundary', '/api/teacher/document-grading/submissions', [200, 400, 404, 405]);
  await teacherDesktop.context.close();

  const studentDesktop = await newPage(desktop, 'student');
  await gotoStable(studentDesktop.page, '/assessment/document-feedback?demo=1', 4200);
  const docFeedbackTrail = await focusTrail(studentDesktop.page, 12);
  await capture(studentDesktop.page, '05-document-feedback-demo-a11y-desktop.png', 'document feedback demo accessibility desktop', {
    expected: 'document feedback demo should separate preview, approval, writeback, export, and demo-data boundaries',
    focusTrail: docFeedbackTrail,
  });
  await studentDesktop.context.close();

  const adminDesktop = await newPage(desktop, 'admin');
  await gotoStable(adminDesktop.page, '/admin/config', 4200);
  const configTrail = await focusTrail(adminDesktop.page, 12);
  await capture(adminDesktop.page, '06-admin-config-save-state-a11y-desktop.png', 'admin config save state accessibility desktop', {
    expected: 'config page should expose unsaved changes, save impact, test result, and completion live region without requiring a blind save',
    focusTrail: configTrail,
  });

  await gotoStable(adminDesktop.page, '/admin/users', 3600);
  const usersTrail = await focusTrail(adminDesktop.page, 14);
  await capture(adminDesktop.page, '07-admin-users-batch-state-a11y-desktop.png', 'admin users batch state accessibility desktop', {
    expected: 'user import should expose preview, failed-row export, notification, undo, and batch audit states before upload',
    focusTrail: usersTrail,
  });

  await gotoStable(adminDesktop.page, '/admin/data-governance', 4600);
  await waitUntilTextAbsent(adminDesktop.page, '正在加载数据治理看板');
  const governanceTrail = await focusTrail(adminDesktop.page, 12);
  await capture(adminDesktop.page, '08-admin-data-governance-action-state-a11y-desktop.png', 'admin data governance action state accessibility desktop', {
    expected: 'risk table should expose row-level disposition, export, refresh completion, and status announcements',
    focusTrail: governanceTrail,
  });

  await fetchApi(adminDesktop.page, 'admin data governance status', '/api/admin/data-governance/status', [200]);
  await fetchApi(adminDesktop.page, 'admin users template download', '/api/admin/users/template', [200]);
  await adminDesktop.context.close();

  const teacherMobile = await newPage(mobile, 'teacher');
  await gotoStable(teacherMobile.page, `/classroom/teacher/${sessionId}/review`, 4800);
  const mobileReviewTrail = await focusTrail(teacherMobile.page, 10);
  await capture(teacherMobile.page, '09-teacher-review-delivery-mobile-a11y.png', 'teacher review delivery mobile accessibility', {
    expected: 'mobile post-class review should keep delivery actions reachable without scrolling through the full report first',
    focusTrail: mobileReviewTrail,
  });
  await teacherMobile.context.close();

  const adminMobile = await newPage(mobile, 'admin');
  await gotoStable(adminMobile.page, '/admin/config', 4200);
  const mobileConfigTrail = await focusTrail(adminMobile.page, 10);
  await capture(adminMobile.page, '10-admin-config-mobile-action-zone-a11y.png', 'admin config mobile action zone accessibility', {
    expected: 'mobile config should keep save/test/reset actions and completion state stable in a long settings page',
    focusTrail: mobileConfigTrail,
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
      batch: 'function-state-flows-batch33',
      scope: 'report delivery, grading workbench, document feedback, admin batch/config/governance action states, and mobile action-zone accessibility',
      classId,
      sessionId,
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
