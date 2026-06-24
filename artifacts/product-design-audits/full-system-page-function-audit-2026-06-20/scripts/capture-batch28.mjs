import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/63-function-state-flows-batch28');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch28-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };
const student = { account: 'demo', password: 'DemoStudent@Just2026!' };

const results = [];
const apiChecks = [];
const routeResponses = [];
const dialogs = [];
const downloads = [];
const errors = [];
const ignoredErrors = [];
const notes = {};
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
  await page.locator('input[name="account"], input[type="text"], input').first().fill(student.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(student.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2800);
}

async function gotoStable(page, route, waitMs = 3200) {
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
    const controls = [...document.querySelectorAll('button, [role="button"], a[href]')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      href: el.getAttribute('href') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      selected: el.getAttribute('aria-selected') || '',
      live: el.getAttribute('aria-live') || '',
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
    const cards = [...document.querySelectorAll('article, [data-learner-record-surface], [data-learner-record-priority]')]
      .map((el) => text(el).slice(0, 900))
      .filter(Boolean)
      .slice(0, 20);
    const graphics = [...document.querySelectorAll('svg, canvas')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      ariaHidden: el.getAttribute('aria-hidden') || '',
    }));
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      alerts: statusRegions,
      buttons: controls.slice(0, 320),
      inputs,
      cards,
      unnamedButtons: controls.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 12000),
    };
  });
}

async function capture(page, fileName, label, extraNotes = {}) {
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
    notes: extraNotes,
    auditSummary: {
      h1: audit.h1,
      alerts: audit.alerts,
      inputCount: audit.inputs.length,
      buttonCount: audit.buttons.length,
      unnamedButtons: audit.unnamedButtons,
      graphicsCount: audit.graphicsCount,
      unnamedGraphics: audit.unnamedGraphics,
      hits: {
        evidenceList: body.includes('学习证据') || body.includes('课堂作答'),
        questionSummary: body.includes('作答') && body.includes('参考'),
        reviewAction: body.includes('复盘课堂作答'),
        adaptivePractice: body.includes('自适应练习') || body.includes('控制校正'),
        remediationAction: body.includes('补练') || body.includes('练习') || body.includes('路径'),
        liveStatus: audit.alerts.length > 0,
      },
      cardSamples: audit.cards.slice(0, 4),
    },
  });
}

async function newStudentPage(viewport) {
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
  await login(page);
  return { context, page };
}

async function fetchJson(page, label, route, expectedStatuses = [200]) {
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
  return response.body;
}

async function getFirstEvidenceReviewHref(page) {
  const href = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href]')];
    const link = links.find((item) => (item.innerText || item.textContent || '').includes('复盘课堂作答'));
    return link?.getAttribute('href') || '';
  });
  return href || '';
}

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const desktopPage = await newStudentPage(desktop);
  const defaultEvidence = await fetchJson(desktopPage.page, 'student evidence default', '/api/student/evidence?limit=20', [200]);
  const classroomEvidence = await fetchJson(
    desktopPage.page,
    'student evidence 4-1 lesson filter',
    '/api/student/evidence?lessonId=unit-4-1-design-task-expression-v1&limit=20',
    [200],
  );
  await fetchJson(
    desktopPage.page,
    'latest control-correction learning path',
    '/api/learning-paths/latest?goal=control-correction',
    [200, 404],
  );

  notes.defaultEvidenceItems = Array.isArray(defaultEvidence?.items) ? defaultEvidence.items.length : null;
  notes.classroomEvidenceItems = Array.isArray(classroomEvidence?.items) ? classroomEvidence.items.length : null;
  notes.firstDefaultNextAction = defaultEvidence?.items?.[0]?.learnerRecord?.nextAction ?? null;
  notes.firstClassroomNextAction = classroomEvidence?.items?.[0]?.learnerRecord?.nextAction ?? null;

  await gotoStable(desktopPage.page, '/profile/evidence', 4200);
  await capture(desktopPage.page, '01-student-evidence-default-desktop.png', 'student evidence default desktop', {
    expected: 'student evidence should expose item-level detail, source context, and next actions',
  });

  await gotoStable(desktopPage.page, '/profile/evidence?lessonId=unit-4-1-design-task-expression-v1', 4200);
  const reviewHref = await getFirstEvidenceReviewHref(desktopPage.page);
  notes.reviewHref = reviewHref;
  await capture(desktopPage.page, '02-student-evidence-lesson-filter-desktop.png', 'student evidence lesson filter desktop', {
    expected: 'lesson-filtered classroom evidence should show original question, answer, reference, and next remediation path',
    reviewHref,
  });

  if (reviewHref) {
    await gotoStable(desktopPage.page, reviewHref, 2600);
    await capture(desktopPage.page, '03-student-evidence-review-link-target-desktop.png', 'student evidence review link target desktop', {
      expected: 'review classroom answer should land on a question-level review surface, not only the same evidence list',
      reviewHref,
    });
  } else {
    recordError('find evidence review href', 'no visible 复盘课堂作答 link', desktopPage.page.url());
  }

  await gotoStable(desktopPage.page, '/assessment/adaptive-practice?intent=practice&goal=control-correction', 4200);
  await capture(desktopPage.page, '04-student-adaptive-practice-remediation-desktop.png', 'student adaptive practice remediation desktop', {
    expected: 'adaptive practice should clearly connect evidence gaps to generated remedial questions or path actions',
  });

  await gotoStable(desktopPage.page, '/assessment/adaptive-practice?intent=evidence-review&goal=control-correction', 4200);
  await capture(desktopPage.page, '05-student-adaptive-evidence-review-desktop.png', 'student adaptive evidence review intent desktop', {
    expected: 'evidence-review intent should preserve evidence context and offer a clear remediation next step',
  });

  const mobilePage = await newStudentPage(mobile);
  await gotoStable(mobilePage.page, '/profile/evidence?lessonId=unit-4-1-design-task-expression-v1', 4200);
  await capture(mobilePage.page, '06-student-evidence-lesson-filter-mobile.png', 'student evidence lesson filter mobile', {
    expected: 'mobile evidence review should keep source, answer, reference, and action visible without bottom-tool obstruction',
  });

  await gotoStable(mobilePage.page, '/assessment/adaptive-practice?intent=practice&goal=control-correction', 4200);
  await capture(mobilePage.page, '07-student-adaptive-practice-remediation-mobile.png', 'student adaptive practice remediation mobile', {
    expected: 'mobile remediation path should expose the active question/path action without excessive scrolling',
  });

  await desktopPage.context.close();
  await mobilePage.context.close();
}

async function main() {
  try {
    await runAudit();
  } finally {
    if (browser) await browser.close();
  }

  const pngCount = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png')).length;
  const jsonCount = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json')).length;
  await fs.writeFile(manifestPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 'function-state-flows-batch28',
    scope: 'student evidence detail, classroom-answer review target, and adaptive remediation entry paths',
    routeResponses,
    results,
    apiChecks,
    dialogs,
    downloads,
    errors,
    ignoredErrors,
    notes,
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
