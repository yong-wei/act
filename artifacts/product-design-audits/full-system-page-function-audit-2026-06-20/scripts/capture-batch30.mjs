import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/65-function-state-flows-batch30');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch30-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };
const teacherAccount = { account: '201300000012', password: 'zyw1983@Just' };
const classId = 'cmma7g0590004g9q2nl2jyzdf';

const results = [];
const routeResponses = [];
const apiChecks = [];
const dialogs = [];
const downloads = [];
const errors = [];
const ignoredErrors = [];
let browser = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function recordError(action, error, url = '') {
  errors.push({ action, message: error instanceof Error ? error.message : String(error), url });
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(teacherAccount.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(teacherAccount.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2800);
}

async function gotoStable(page, route, expectedStatuses = [200], waitMs = 4200) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' }).catch((error) => {
    recordError(`goto ${route}`, error, page.url());
    return null;
  });
  const status = response?.status?.() ?? null;
  const accepted = status !== null && expectedStatuses.includes(status);
  routeResponses.push({ route, status, accepted, expectedStatuses, url: response?.url?.() ?? `${baseUrl}${route}` });
  if (status !== null && !accepted) recordError(`goto ${route}`, `unexpected status ${status}`, page.url());
  await sleep(waitMs);
  return response;
}

async function fetchApi(page, label, route, expectedStatuses = [200]) {
  const response = await page.evaluate(async (targetRoute) => {
    const res = await fetch(targetRoute, { headers: { accept: 'application/json' } });
    const contentType = res.headers.get('content-type') || '';
    const body = contentType.includes('json') ? await res.json().catch(() => ({})) : { text: await res.text().catch(() => '') };
    return { ok: res.ok, status: res.status, contentType, body };
  }, route);
  const accepted = expectedStatuses.includes(response.status);
  apiChecks.push({
    label,
    route,
    status: response.status,
    ok: response.ok,
    accepted,
    contentType: response.contentType,
    summary: JSON.stringify(response.body).slice(0, 1800),
  });
  if (!accepted) recordError(`api ${label}`, `unexpected status ${response.status}`, route);
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
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        bottom: Math.round(r.bottom),
        right: Math.round(r.right),
        visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth,
      };
    };
    const bodyText = text(document.body);
    const controls = [...document.querySelectorAll('button, [role="button"], a[href], summary')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      href: el.getAttribute('href') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      rect: rect(el),
    }));
    const statusRegions = [...document.querySelectorAll('[role="alert"], [aria-live], [role="status"]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const reportLedgerElements = [...document.querySelectorAll('[data-report-ledger-surface], [data-report-ledger-export], [data-operations-unavailable-slot]')].map((el) => ({
      surface: el.getAttribute('data-report-ledger-surface') || '',
      exportMode: el.getAttribute('data-report-ledger-export') || '',
      unavailableSlot: el.getAttribute('data-operations-unavailable-slot') || '',
      rect: rect(el),
      text: text(el).slice(0, 900),
    }));
    const tableSignals = {
      courseEnhancementPackText: bodyText.includes('CourseEnhancementPack'),
      prismaMissingTable: bodyText.includes('P2021') || bodyText.includes('does not exist') || bodyText.includes('The table'),
      nextError: bodyText.includes('Application error') || bodyText.includes('Runtime Error') || bodyText.includes('Unhandled Runtime Error'),
    };
    return {
      title: document.title,
      url: location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight, scrollY: window.scrollY },
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      alerts: statusRegions,
      buttons: controls.slice(0, 260),
      unnamedButtons: controls.filter((button) => !button.name).length,
      reportLedgerElements,
      bodyText: bodyText.slice(0, 14000),
      hits: {
        teacherDashboard: bodyText.includes('教师') && (bodyText.includes('课前包') || bodyText.includes('报告')),
        prepPackEntry: controls.some((control) => control.href.includes('/teacher/prep-packs')) || bodyText.includes('课前包复核'),
        prepPackReviewSurface: bodyText.includes('课前包复核') && bodyText.includes('CourseEnhancementPack'),
        blocker500: tableSignals.nextError || tableSignals.prismaMissingTable,
        reportLedgerSurface: reportLedgerElements.length > 0,
        liveStatus: statusRegions.length > 0,
      },
      tableSignals,
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
      alerts: audit.alerts,
      unnamedButtons: audit.unnamedButtons,
      hits: audit.hits,
      tableSignals: audit.tableSignals,
      reportLedgerElements: audit.reportLedgerElements,
      primaryControls: audit.buttons.slice(0, 30),
    },
  });
}

async function newPage(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message(), url: page.url() });
    await dialog.dismiss().catch(() => {});
  });
  page.on('download', (download) => downloads.push({ suggestedFilename: download.suggestedFilename(), url: page.url() }));
  page.on('pageerror', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('CourseEnhancementPack') || message.includes('does not exist') || message.includes('P2021')) {
      ignoredErrors.push({ action: 'pageerror', message, url: page.url(), reason: 'known prep-pack migration/table blocker under audit' });
      return;
    }
    recordError('pageerror', error, page.url());
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    recordError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  await login(page);
  return { context, page };
}

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const dashboardDesktop = await newPage(desktop);
  await gotoStable(dashboardDesktop.page, '/teacher', [200], 3600);
  await fetchApi(dashboardDesktop.page, 'teacher session auth', '/api/auth/session', [200]);
  await capture(dashboardDesktop.page, '01-teacher-dashboard-prep-pack-entry-desktop.png', 'teacher dashboard prep-pack entry desktop', {
    expected: 'teacher dashboard should expose prep-pack/reports entry without requiring internal route knowledge',
  });

  const analyticsDesktop = await newPage(desktop);
  await gotoStable(analyticsDesktop.page, `/teacher/classes/${classId}/analytics-v2`, [200], 4600);
  await capture(analyticsDesktop.page, '02-teacher-class-analytics-prep-pack-source-desktop.png', 'teacher class analytics prep-pack source desktop', {
    expected: 'class analytics should be a source surface for prep-pack review when diagnosis clusters are available',
    classId,
  });

  const prepDesktop = await newPage(desktop);
  await gotoStable(prepDesktop.page, '/teacher/prep-packs', [200, 500], 4200);
  await capture(prepDesktop.page, '03-teacher-prep-packs-direct-desktop.png', 'teacher prep-packs direct desktop', {
    expected: 'prep-pack review page should render review-ready or empty state; 500 is accepted as blocker evidence',
  });

  const prepClusterDesktop = await newPage(desktop);
  await gotoStable(prepClusterDesktop.page, '/teacher/prep-packs?cluster=cluster-1', [200, 500], 4200);
  await capture(prepClusterDesktop.page, '04-teacher-prep-packs-cluster-deeplink-desktop.png', 'teacher prep-packs cluster deeplink desktop', {
    expected: 'cluster deeplink should either load targeted review context or graceful empty state',
  });

  const dashboardMobile = await newPage(mobile);
  await gotoStable(dashboardMobile.page, '/teacher', [200], 3600);
  await capture(dashboardMobile.page, '05-teacher-dashboard-prep-pack-entry-mobile.png', 'teacher dashboard prep-pack entry mobile', {
    expected: 'mobile teacher dashboard should keep prep-pack/report entry discoverable',
  });

  const prepMobile = await newPage(mobile);
  await gotoStable(prepMobile.page, '/teacher/prep-packs', [200, 500], 4200);
  await capture(prepMobile.page, '06-teacher-prep-packs-direct-mobile.png', 'teacher prep-packs direct mobile', {
    expected: 'mobile prep-pack review should not collapse into opaque runtime error',
  });

  await browser.close();
  browser = null;
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 30,
    scope: 'teacher prep-pack review route blocker and source entry discoverability',
    classId,
    routeResponses,
    results,
    apiChecks,
    dialogs,
    downloads,
    errors,
    ignoredErrors,
    pngCount: results.filter((result) => result.screenshot.endsWith('.png')).length,
    jsonCount: results.filter((result) => result.a11y.endsWith('.json')).length,
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({
    manifestPath,
    pngCount: manifest.pngCount,
    jsonCount: manifest.jsonCount,
    apiChecks: manifest.apiChecks.length,
    errors: manifest.errors.length,
    ignoredErrors: manifest.ignoredErrors.length,
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

runAudit().catch(async (error) => {
  recordError('runAudit', error);
  if (browser) await browser.close().catch(() => {});
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 30,
    scope: 'teacher prep-pack review route blocker and source entry discoverability',
    routeResponses,
    results,
    apiChecks,
    dialogs,
    downloads,
    errors,
    ignoredErrors,
    pngCount: results.filter((result) => result.screenshot.endsWith('.png')).length,
    jsonCount: results.filter((result) => result.a11y.endsWith('.json')).length,
  }, null, 2));
  console.error(error);
  process.exitCode = 1;
});
