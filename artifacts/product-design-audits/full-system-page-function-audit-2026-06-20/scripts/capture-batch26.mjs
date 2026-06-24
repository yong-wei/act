import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

import { createPrismaClient } from '../../../../scripts/lib/prisma-client.mjs';

const prisma = createPrismaClient();

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/61-function-state-flows-batch26');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch26-manifest.json');
const publicationId = 'cmqluwvqo0001pmyf34og34jy';
const expiredPublicationId = 'audit-publication-expired-full-system-2026-06-20';
const taskId = 'task-second-order-lead-pid';
const classId = 'cmma7g0590004g9q2nl2jyzdf';
const className = '2024自动化';
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
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
  return {
    keys: Object.keys(body).slice(0, 20),
    error: body.error || body.message || '',
    publicationsCount: Array.isArray(body.publications) ? body.publications.length : null,
    submissionsCount: Array.isArray(body.submissions) ? body.submissions.length : null,
    viewerUserId: body.viewerUserId || '',
    includesPublicationId: JSON.stringify(body).includes(publicationId),
    includesExpiredPublicationId: JSON.stringify(body).includes(expiredPublicationId),
    sampleText: JSON.stringify(body).slice(0, 1400),
  };
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

async function gotoStable(page, route, waitMs = 2800) {
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
      buttons: controls.slice(0, 320),
      inputs,
      unnamedButtons: controls.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 10000),
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
        className: body.includes(className) || body.includes('ZXVBP6'),
        publicationId: body.includes(publicationId),
        expiredPublicationId: body.includes(expiredPublicationId),
        taskId: body.includes(taskId),
        leaderboard: body.includes('榜单') || body.includes('排名') || body.includes('Leaderboard'),
        report: body.includes('报告') || body.includes('复盘'),
        submission: body.includes('提交') || body.includes('官方评测'),
        late: body.includes('逾期') || body.includes('已截止') || body.includes('late'),
        scoreZero: body.includes('0') && body.includes('优秀方案'),
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
  if (role) await login(page, role);
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

  const publicationBefore = await prisma.arenaChallengePublication.findUnique({
    where: { id: publicationId },
    select: {
      id: true,
      taskId: true,
      classId: true,
      visibility: true,
      status: true,
      deadline: true,
      leaderboardPolicyId: true,
      submissions: {
        select: { id: true, userId: true, studentLabel: true, score: true, valid: true, isLate: true, submittedAt: true },
        orderBy: { submittedAt: 'desc' },
      },
    },
  });
  if (!publicationBefore) {
    throw new Error(`expected Arena publication ${publicationId} to exist`);
  }
  if (publicationBefore.taskId !== taskId || publicationBefore.classId !== classId) {
    throw new Error(`unexpected publication context: ${publicationBefore.taskId} ${publicationBefore.classId}`);
  }

  browser = await chromium.launch({ headless: true });

  const teacherDesktop = await newPage(desktop, 'teacher');
  await gotoStable(teacherDesktop.page, '/teacher/arena', 4400);
  await capture(teacherDesktop.page, '01-teacher-arena-publications-list-desktop.png', 'teacher Arena publications list desktop', {
    expected: 'teacher should see active publication, class, deadline, status, and report entry without needing raw ids',
    publicationId,
  });

  await gotoStable(teacherDesktop.page, `/teacher/arena/publications/${publicationId}`, 4400);
  await capture(teacherDesktop.page, '02-teacher-arena-publication-report-active-desktop.png', 'teacher Arena publication report active desktop', {
    expected: 'teacher report should explain participation, scoring, leaderboard visibility, repeated submissions, and next actions',
    publicationId,
  });

  await gotoStable(teacherDesktop.page, `/teacher/arena/publications/${expiredPublicationId}`, 4400);
  await capture(teacherDesktop.page, '03-teacher-arena-publication-report-expired-desktop.png', 'teacher Arena publication report expired desktop', {
    expected: 'expired report should distinguish deadline, late submissions, final leaderboard policy, and report export/delivery actions',
    expiredPublicationId,
  });

  await fetchApi(teacherDesktop.page, 'teacher Arena publications list', '/api/teacher/arena/publications?status=active', [200]);
  await fetchApi(teacherDesktop.page, 'teacher active publication status update without method', `/api/teacher/arena/publications/${publicationId}/status`, [405]);

  const studentDesktop = await newPage(desktop, 'student');
  await gotoStable(studentDesktop.page, '/arena', 3800);
  await capture(studentDesktop.page, '04-student-arena-hall-desktop.png', 'student Arena hall desktop', {
    expected: 'student Arena hall should reveal official challenges, leaderboard meaning, and current class-bound publication path',
  });

  await gotoStable(studentDesktop.page, `/arena/challenges/${taskId}?publicationId=${publicationId}`, 4600);
  await capture(studentDesktop.page, '05-student-arena-publication-challenge-desktop.png', 'student Arena publication challenge desktop', {
    expected: 'class-bound challenge should show official evaluation context, leaderboard, and workbench entry tied to publication',
    publicationId,
  });

  await gotoStable(studentDesktop.page, `/arena/challenges/${taskId}?publicationId=${expiredPublicationId}`, 4600);
  await capture(studentDesktop.page, '06-student-arena-expired-publication-challenge-desktop.png', 'student Arena expired publication challenge desktop', {
    expected: 'expired challenge should make deadline and late/final leaderboard policy understandable before workbench entry',
    expiredPublicationId,
  });

  await fetchApi(studentDesktop.page, 'student active publication submissions', `/api/arena/submissions?taskId=${taskId}&publicationId=${publicationId}`, [200]);
  await fetchApi(studentDesktop.page, 'student expired publication submissions', `/api/arena/submissions?taskId=${taskId}&publicationId=${expiredPublicationId}`, [200]);
  await fetchApi(studentDesktop.page, 'student task submissions all visible', `/api/arena/submissions?taskId=${taskId}`, [200]);

  const teacherMobile = await newPage(mobile, 'teacher');
  await gotoStable(teacherMobile.page, '/teacher/arena', 4200);
  await capture(teacherMobile.page, '07-teacher-arena-publications-list-mobile.png', 'teacher Arena publications list mobile', {
    expected: 'mobile teacher Arena config should keep publication status and report entry legible',
    publicationId,
  });

  await gotoStable(teacherMobile.page, `/teacher/arena/publications/${publicationId}`, 4400);
  await capture(teacherMobile.page, '08-teacher-arena-publication-report-mobile.png', 'teacher Arena publication report mobile', {
    expected: 'mobile teacher publication report should preserve summary, non-submitters, leaderboard, and export/delivery actions',
    publicationId,
  });

  const studentMobile = await newPage(mobile, 'student');
  await gotoStable(studentMobile.page, `/arena/challenges/${taskId}?publicationId=${publicationId}`, 4600);
  await capture(studentMobile.page, '09-student-arena-publication-challenge-mobile.png', 'student Arena publication challenge mobile', {
    expected: 'mobile class-bound challenge should surface workbench entry and leaderboard without hiding official context',
    publicationId,
  });

  await gotoStable(studentMobile.page, `/arena/challenges/${taskId}?publicationId=${expiredPublicationId}`, 4600);
  await capture(studentMobile.page, '10-student-arena-expired-publication-challenge-mobile.png', 'student Arena expired publication challenge mobile', {
    expected: 'mobile expired publication should communicate deadline and leaderboard finality before entry',
    expiredPublicationId,
  });

  await teacherDesktop.context.close();
  await studentDesktop.context.close();
  await teacherMobile.context.close();
  await studentMobile.context.close();

  const publicationAfter = await prisma.arenaChallengePublication.findUnique({
    where: { id: publicationId },
    select: {
      id: true,
      taskId: true,
      classId: true,
      status: true,
      submissions: {
        select: { id: true, score: true, valid: true, isLate: true, submittedAt: true },
        orderBy: { submittedAt: 'desc' },
      },
    },
  });

  return { publicationBefore, publicationAfter };
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
    const files = await fs.readdir(screenshotDir).catch(() => []);
    const manifest = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      batch: 'function-state-flows-batch26',
      scope: 'Arena formal publication, student leaderboard, active/expired report surfaces, and related APIs',
      publicationId,
      expiredPublicationId,
      taskId,
      classId,
      className,
      routeResponses,
      results,
      apiChecks,
      dialogs,
      downloads,
      errors,
      ignoredErrors,
      pngCount: files.filter((file) => file.endsWith('.png')).length,
      jsonCount: files.filter((file) => file.endsWith('.json')).length,
      publicationBefore: runResult?.publicationBefore ?? null,
      publicationAfter: runResult?.publicationAfter ?? null,
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
