import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

import { createPrismaClient } from '../../../../scripts/lib/prisma-client.mjs';

const prisma = createPrismaClient();

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/60-function-state-flows-batch25');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch25-manifest.json');
const classId = 'cmma7g0590004g9q2nl2jyzdf';
const className = '2024自动化';
const sessionId = 'cmqm6s1s1001f1wyf4ggkifs5';
const sessionTitle = '4-1：设计起点：性能指标体系、工程约束与可行域表达 (副本)';
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
};

const results = [];
const errors = [];
const ignoredErrors = [];
const apiChecks = [];
const dialogs = [];
const downloads = [];
const routeResponses = [];
let browser = null;

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

function summarizeJson(body) {
  if (!body || typeof body !== 'object') return { type: typeof body };
  const report = body.report ?? body.effectReport ?? null;
  const exportPayload = body.export ?? null;
  return {
    keys: Object.keys(body).slice(0, 20),
    error: body.error || body.message || '',
    hasReport: Boolean(report),
    hasExport: Boolean(exportPayload),
    reportKeys: report && typeof report === 'object' ? Object.keys(report).slice(0, 20) : [],
    exportKeys: exportPayload && typeof exportPayload === 'object' ? Object.keys(exportPayload).slice(0, 20) : [],
    sessionCount: Array.isArray(body.sessions) ? body.sessions.length : null,
    includesSessionId: JSON.stringify(body).includes(sessionId),
    sampleText: JSON.stringify(body).slice(0, 1200),
  };
}

async function login(page) {
  const account = accounts.teacher;
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2800);
}

async function gotoStable(page, route, waitMs = 2600) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' }).catch((error) => {
    recordError(`goto ${route}`, error, page.url());
    return null;
  });
  routeResponses.push({
    route,
    status: response?.status?.() ?? null,
    url: response?.url?.() ?? `${baseUrl}${route}`,
  });
  await sleep(waitMs);
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
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
        placeholder: active?.getAttribute?.('placeholder') || '',
      },
      alerts: statusRegions,
      buttons: controls.slice(0, 300),
      inputs,
      unnamedButtons: controls.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 9000),
    };
  });
}

async function capture(page, fileName, label, notes = {}) {
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = await fs.stat(filePath);
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
    screenshotBytes: stat.size,
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
        sessionTitle: body.includes(sessionTitle.slice(0, 24)) || body.includes('4-1'),
        sessionId: body.includes(sessionId),
        export: body.includes('导出') || body.includes('下载') || body.includes('Export'),
        send: body.includes('发送') || body.includes('推送') || body.includes('分享'),
        report: body.includes('报告') || body.includes('复盘') || body.includes('统计'),
        reinforcement: body.includes('补强') || body.includes('路径'),
        demoOnly: body.includes('演示') || body.includes('demo'),
      },
    },
  });
}

async function newTeacherPage(viewport, dialogMode = 'dismiss') {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
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
  await login(page);
  return { context, page };
}

async function fetchApi(page, label, route, expectedStatuses) {
  const response = await page.evaluate(async (targetRoute) => {
    const res = await fetch(targetRoute, { headers: { accept: 'application/json' } });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 1200) };
    }
    return { ok: res.ok, status: res.status, body };
  }, route);
  const accepted = expectedStatuses.includes(response.status);
  apiChecks.push({
    label,
    route,
    status: response.status,
    ok: response.ok,
    accepted,
    summary: summarizeJson(response.body),
  });
  if (!accepted) {
    recordError(`api ${label}`, `unexpected status ${response.status}`, route);
  }
  return response;
}

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });

  const sessionBefore = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      classId: true,
      joinCode: true,
      plan: { select: { title: true } },
      studentStates: { select: { userId: true } },
      studentStepResponses: { select: { userId: true, stepId: true } },
    },
  });
  if (!sessionBefore) {
    throw new Error(`expected batch24 session ${sessionId} to exist`);
  }
  if (sessionBefore.classId !== classId) {
    throw new Error(`expected session class ${classId}, got ${sessionBefore.classId}`);
  }

  browser = await chromium.launch({ headless: true });
  const teacherDesktop = await newTeacherPage(desktop);

  await gotoStable(teacherDesktop.page, `/teacher/classes/${classId}`, 3600);
  await capture(teacherDesktop.page, '01-teacher-class-detail-history-report-entry-desktop.png', 'teacher class detail history report entry desktop', {
    expected: 'class detail should let teachers find ended sessions and continue to report delivery without scanning raw history',
    classId,
    sessionId,
  });

  await gotoStable(teacherDesktop.page, `/classroom/teacher/${sessionId}/review`, 4600);
  await capture(teacherDesktop.page, '02-teacher-review-deep-actions-desktop.png', 'teacher review deep actions desktop', {
    expected: 'post-class review should expose export, send, copy summary, and reinforcement path actions beside analytics',
    classId,
    sessionId,
  });

  const aggregationLink = teacherDesktop.page.getByRole('link', { name: /前往评审聚合入口|评审聚合入口/ });
  if (await aggregationLink.count()) {
    await aggregationLink.first().click().catch((error) => recordError('click review aggregation entry', error, teacherDesktop.page.url()));
    await sleep(3200);
  } else {
    await gotoStable(teacherDesktop.page, '/review/extracurricular-showcase', 3200);
  }
  await capture(teacherDesktop.page, '03-review-aggregation-entry-result-desktop.png', 'review aggregation entry result desktop', {
    expected: 'review aggregation entry should be understandable as teacher-facing continuation or clearly marked as internal review surface',
    launchedFrom: `/classroom/teacher/${sessionId}/review`,
  });

  await gotoStable(teacherDesktop.page, '/teacher', 3600);
  await capture(teacherDesktop.page, '04-teacher-dashboard-report-ledger-desktop.png', 'teacher dashboard report ledger desktop', {
    expected: 'teacher dashboard report ledger slots should separate real export actions, deferred states, and demo-only reports',
  });

  await gotoStable(teacherDesktop.page, '/teacher/grading-workbench', 3200);
  await capture(teacherDesktop.page, '05-teacher-grading-workbench-empty-desktop.png', 'teacher grading workbench empty desktop', {
    expected: 'grading workbench empty state should explain how teachers arrive from a real class review or report run',
  });

  await gotoStable(teacherDesktop.page, '/teacher/grading-workbench?demo=1', 4200);
  await capture(teacherDesktop.page, '06-teacher-grading-workbench-demo-desktop.png', 'teacher grading workbench demo desktop', {
    expected: 'demo grading workbench should be visibly separated from real class report delivery',
  });

  await fetchApi(
    teacherDesktop.page,
    'control correction report real class export',
    `/api/teacher/classes/${classId}/control-correction-report?export=true`,
    [200],
  );
  await fetchApi(
    teacherDesktop.page,
    'assistant effect report real class export',
    `/api/teacher/classes/${classId}/assistant-effect-report?export=true`,
    [404],
  );
  await fetchApi(
    teacherDesktop.page,
    'finished classroom history includes batch24 session',
    `/api/teacher/classes/${classId}/sessions?status=FINISHED&search=4-1`,
    [200],
  );

  const teacherMobile = await newTeacherPage(mobile);
  await gotoStable(teacherMobile.page, `/teacher/classes/${classId}`, 3600);
  await capture(teacherMobile.page, '07-teacher-class-detail-report-entry-mobile.png', 'teacher class detail report entry mobile', {
    expected: 'mobile class detail should keep ended-session review entry and report actions discoverable',
    classId,
    sessionId,
  });

  await gotoStable(teacherMobile.page, `/classroom/teacher/${sessionId}/review`, 4400);
  await capture(teacherMobile.page, '08-teacher-review-deep-actions-mobile.png', 'teacher review deep actions mobile', {
    expected: 'mobile post-class review should preserve report delivery and reinforcement actions without burying them after long analytics',
    classId,
    sessionId,
  });

  await gotoStable(teacherMobile.page, '/teacher', 3600);
  await capture(teacherMobile.page, '09-teacher-dashboard-report-ledger-mobile.png', 'teacher dashboard report ledger mobile', {
    expected: 'mobile teacher dashboard should make report-ledger states legible and actionable',
  });

  await gotoStable(teacherMobile.page, '/teacher/grading-workbench', 3200);
  await capture(teacherMobile.page, '10-teacher-grading-workbench-empty-mobile.png', 'teacher grading workbench empty mobile', {
    expected: 'mobile grading workbench empty state should provide a path back to real review or report source',
  });

  await teacherDesktop.context.close();
  await teacherMobile.context.close();

  const sessionAfter = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      classId: true,
      joinCode: true,
      endTime: true,
      studentStates: { select: { userId: true } },
      studentStepResponses: { select: { userId: true, stepId: true, createdAt: true } },
    },
  });

  return { sessionBefore, sessionAfter };
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

    const pngFiles = await fs.readdir(screenshotDir).catch(() => []);
    const manifest = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      batch: 'function-state-flows-batch25',
      scope: 'post-class review deep actions, report export/send surfaces, and grading/report ledger states',
      classId,
      className,
      sessionId,
      routeResponses,
      results,
      apiChecks,
      dialogs,
      downloads,
      errors,
      ignoredErrors,
      pngCount: pngFiles.filter((file) => file.endsWith('.png')).length,
      jsonCount: pngFiles.filter((file) => file.endsWith('.json')).length,
      sessionBefore: runResult?.sessionBefore ?? null,
      sessionAfter: runResult?.sessionAfter ?? null,
    };
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await prisma.$disconnect();
    console.log(JSON.stringify({
      manifestPath,
      screenshotDir,
      results: results.length,
      apiChecks: apiChecks.length,
      errors: errors.length,
      ignoredErrors: ignoredErrors.length,
      pngCount: manifest.pngCount,
    }, null, 2));
    if (errors.length > 0) {
      process.exitCode = 1;
    }
  }
}

main().catch(async (error) => {
  recordError('main', error);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true }).catch(() => {});
  await fs.writeFile(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), errors, ignoredErrors }, null, 2)).catch(() => {});
  await prisma.$disconnect().catch(() => {});
  console.error(error);
  process.exit(1);
});
