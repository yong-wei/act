import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/64-function-state-flows-batch29');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch29-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };
const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
};
const workbenchRoute = '/interactive-learning/control-workbench?preset=multi-representation-linkage&arenaTask=task-second-order-lead-pid';
const courseSlug = 'unit-4-1-design-task-expression';
const endedSessionId = 'cmqm6s1s1001f1wyf4ggkifs5';
const endedTeacherRoute = `/interactive-learning/courses/${courseSlug}/teacher/${endedSessionId}`;
const endedReviewRoute = `/classroom/teacher/${endedSessionId}/review`;

const results = [];
const apiChecks = [];
const routeResponses = [];
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

async function login(page, role) {
  const account = accounts[role];
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2800);
}

async function gotoStable(page, route, waitMs = 3600) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' }).catch((error) => {
    recordError(`goto ${route}`, error, page.url());
    return null;
  });
  routeResponses.push({ route, status: response?.status?.() ?? null, url: response?.url?.() ?? `${baseUrl}${route}` });
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
    const viewport = { width: window.innerWidth, height: window.innerHeight, scrollY: window.scrollY };
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
    const zoneElements = [...document.querySelectorAll('[data-commercial-workspace-zone], [data-task-workspace-zone]')];
    const zones = zoneElements.map((el) => ({
      commercialZone: el.getAttribute('data-commercial-workspace-zone') || '',
      taskZone: el.getAttribute('data-task-workspace-zone') || '',
      tag: el.tagName.toLowerCase(),
      rect: rect(el),
      text: text(el).slice(0, 600),
    }));
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
    const dockElements = [...document.querySelectorAll('[data-platform-floating-dock], [data-platform-floating-dock-expanded-panel]')];
    const docks = dockElements.map((el) => ({ tag: el.tagName.toLowerCase(), attrs: {
      dock: el.getAttribute('data-platform-floating-dock') || '',
      expanded: el.getAttribute('data-platform-floating-dock-expanded-panel') !== null ? 'true' : '',
    }, rect: rect(el), text: text(el).slice(0, 300) }));
    const zoneNames = new Set(zones.flatMap((zone) => [zone.commercialZone, zone.taskZone]).filter(Boolean));
    const requiredZones = ['context-strip', 'instrument-area', 'command-bar', 'evidence-rail', 'support-drawer', 'floating-dock-safe-area', 'bottom-tools'];
    const missingZones = requiredZones.filter((zone) => !zoneNames.has(zone));
    const bodyText = text(document.body);
    return {
      title: document.title,
      url: location.href,
      viewport,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      alerts: statusRegions,
      zones,
      missingZones,
      docks,
      buttons: controls.slice(0, 360),
      unnamedButtons: controls.filter((button) => !button.name).length,
      bodyText: bodyText.slice(0, 14000),
      hits: {
        controlWorkbench: bodyText.includes('控制工作台'),
        arenaOfficial: bodyText.includes('Arena') || bodyText.includes('官方评价') || bodyText.includes('挑战详情'),
        contextHeader: zoneNames.has('context-strip') || zoneNames.has('context-header'),
        instrumentArea: zoneNames.has('instrument-area'),
        bottomTools: zoneNames.has('bottom-tools'),
        floatingDockSafeArea: zoneNames.has('floating-dock-safe-area'),
        endedCopy: bodyText.includes('已结束') || bodyText.includes('FINISHED') || bodyText.includes('只读'),
        liveTeachingCopy: bodyText.includes('结束课堂') || bodyText.includes('发放作答') || bodyText.includes('已发放作答'),
        reviewAction: bodyText.includes('复盘') || bodyText.includes('报告') || bodyText.includes('课堂统计'),
        liveStatus: statusRegions.length > 0,
      },
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
      missingZones: audit.missingZones,
      zoneCount: audit.zones.length,
      dockCount: audit.docks.length,
      unnamedButtons: audit.unnamedButtons,
      hits: audit.hits,
      zoneRects: audit.zones.map((zone) => ({
        commercialZone: zone.commercialZone,
        taskZone: zone.taskZone,
        rect: zone.rect,
      })),
      dockRects: audit.docks.map((dock) => dock.rect),
    },
  });
}

async function newPage(viewport, role) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message(), url: page.url() });
    await dialog.dismiss().catch(() => {});
  });
  page.on('download', (download) => {
    downloads.push({ suggestedFilename: download.suggestedFilename(), url: page.url() });
  });
  page.on('pageerror', (error) => recordError('pageerror', error, page.url()));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    recordError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  await login(page, role);
  return { context, page };
}

async function fetchApi(page, label, route, expectedStatuses) {
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

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const studentDesktop = await newPage(desktop, 'student');
  await gotoStable(studentDesktop.page, workbenchRoute, 4800);
  await capture(studentDesktop.page, '01-control-workbench-official-desktop.png', 'control workbench official desktop', {
    expected: 'desktop workbench should expose context, primary instrument, command/evidence/support zones, and official Arena context',
  });

  await fetchApi(studentDesktop.page, 'student arena task submissions', '/api/arena/submissions?taskId=task-second-order-lead-pid', [200]);

  const studentMobile = await newPage(mobile, 'student');
  await gotoStable(studentMobile.page, workbenchRoute, 5200);
  await capture(studentMobile.page, '02-control-workbench-official-mobile-top.png', 'control workbench official mobile top', {
    expected: 'mobile workbench top should keep current context and next action visible without floating dock collision',
  });
  await studentMobile.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(1200);
  await capture(studentMobile.page, '03-control-workbench-official-mobile-bottom.png', 'control workbench official mobile bottom', {
    expected: 'mobile workbench bottom should preserve command/evidence/support actions and floating-dock safe area',
  });

  const teacherDesktop = await newPage(desktop, 'teacher');
  await fetchApi(teacherDesktop.page, 'ended session metadata', `/api/session/${endedSessionId}`, [200]);
  await fetchApi(teacherDesktop.page, 'ended session teacher-view state', `/api/session/${endedSessionId}/state?scope=teacher-view`, [200]);
  await gotoStable(teacherDesktop.page, endedTeacherRoute, 4200);
  await capture(teacherDesktop.page, '04-ended-teacher-runtime-desktop.png', 'ended teacher runtime desktop', {
    expected: 'direct access to an ended teacher runtime should show read-only status and post-class actions, not live teaching controls',
    endedSessionId,
  });
  await gotoStable(teacherDesktop.page, endedReviewRoute, 4200);
  await capture(teacherDesktop.page, '05-ended-teacher-review-desktop.png', 'ended teacher review desktop', {
    expected: 'ended class review should be the primary continuation path and should connect to report delivery',
    endedSessionId,
  });

  const teacherMobile = await newPage(mobile, 'teacher');
  await gotoStable(teacherMobile.page, endedTeacherRoute, 4200);
  await capture(teacherMobile.page, '06-ended-teacher-runtime-mobile.png', 'ended teacher runtime mobile', {
    expected: 'mobile direct access to ended teacher runtime should be read-only and expose review/report navigation',
    endedSessionId,
  });

  await studentDesktop.context.close();
  await studentMobile.context.close();
  await teacherDesktop.context.close();
  await teacherMobile.context.close();
}

async function main() {
  try {
    await runAudit();
  } finally {
    if (browser) await browser.close();
  }

  const files = await fs.readdir(screenshotDir);
  const pngCount = files.filter((file) => file.endsWith('.png')).length;
  const jsonCount = files.filter((file) => file.endsWith('.json')).length;
  await fs.writeFile(manifestPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 'function-state-flows-batch29',
    scope: 'task workspace zones, control workbench mobile safe area, and ended classroom read-only state',
    workbenchRoute,
    endedSessionId,
    routeResponses,
    results,
    apiChecks,
    dialogs,
    downloads,
    errors,
    ignoredErrors,
    pngCount,
    jsonCount,
  }, null, 2));

  if (errors.length > 0) {
    console.error(JSON.stringify({ manifestPath, errors }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ manifestPath, pngCount, jsonCount, apiChecks: apiChecks.length, errors: errors.length }, null, 2));
}

await main();
