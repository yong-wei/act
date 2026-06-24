import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/75-function-state-flows-batch40');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch40-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
};

const fixtures = {
  coreGoal: 'control-correction',
  secondaryGoal: 'frequency-response-foundations',
  generationIntentText: '我希望 90 分钟内先补齐根轨迹和校正设计，再进入一次检查练习。',
};

const results = [];
const routeResponses = [];
const apiChecks = [];
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
  await sleep(1000);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2400);
}

async function gotoStable(page, route, waitMs = 3000) {
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
    role: body.user?.role,
    userId: body.user?.id,
    pathState: body.path === null ? 'null' : (body.path?.pathStatus ?? body.path?.id ?? undefined),
    goalId: body.goalId ?? body.path?.goalId,
    count: body.items?.length ?? body.results?.length ?? body.total,
    sampleText: JSON.stringify(body).slice(0, 1400),
  };
}

async function apiCheck(page, route, label) {
  const response = await page.request.get(`${baseUrl}${route}`).catch((error) => {
    recordError(`api ${label}`, error, route);
    return null;
  });
  if (!response) return null;
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
    contentType,
    summary: typeof body === 'string' ? { sampleText: body.slice(0, 1000) } : summarizeJson(body),
  });
  return body;
}

async function domAudit(page) {
  return await page.evaluate(() => {
    const text = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    const name = (el) => (
      el?.getAttribute?.('aria-label') ||
      el?.getAttribute?.('title') ||
      el?.getAttribute?.('alt') ||
      el?.getAttribute?.('placeholder') ||
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
      pressed: el.getAttribute('aria-pressed') || '',
      selected: el.getAttribute('aria-selected') || '',
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
    const bodyText = text(document.body).slice(0, 22000);
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 10),
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 48),
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
      canvasCount: graphics.filter((item) => item.tag === 'canvas').length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText,
      markers: {
        adaptiveWorkspace: Boolean(document.querySelector('[data-commercial-workspace="adaptive-path-center"]')),
        workspaceIntent: document.querySelector('[data-adaptive-path-workspace-intent]')?.getAttribute('data-adaptive-path-workspace-intent') || '',
        controlCorrectionGoal: document.querySelector('[data-control-correction-goal]')?.getAttribute('data-control-correction-goal') || '',
        controlCorrectionIntent: document.querySelector('[data-control-correction-intent]')?.getAttribute('data-control-correction-intent') || '',
        controlCorrectionReady: document.querySelector('[data-control-correction-ready]')?.getAttribute('data-control-correction-ready') || '',
        alternativeCount: document.querySelector('[data-control-correction-alternative-count]')?.getAttribute('data-control-correction-alternative-count') || '',
        overview: Boolean(document.querySelector('[data-adaptive-path-overview]')),
        generationPanel: Boolean(document.querySelector('[data-adaptive-path-generation-panel]')),
        generationRequest: Boolean(document.querySelector('[data-adaptive-path-generation-request]')),
        selectionSurface: Boolean(document.querySelector('[data-learning-path-product-surface]')),
        selectionHistory: Boolean(document.querySelector('[data-learning-path-history]')),
        executionSurface: Boolean(document.querySelector('[data-adaptive-path-execution-surface]')),
        evidenceSurface: Boolean(document.querySelector('[data-adaptive-path-history-surface]')),
        practiceResource: Boolean(document.querySelector('[data-adaptive-practice-resource]')),
        practiceQuestionActive: Boolean(document.querySelector('[data-adaptive-practice-question="active"]')),
        practiceQuestionSummary: Boolean(document.querySelector('[data-adaptive-practice-question="summary"]')),
        routeNodes: document.querySelectorAll('[data-adaptive-path-node]').length,
        routeOptionModules: document.querySelectorAll('[data-learning-path-option-module="route"]').length,
        mobileSummary: Boolean(document.querySelector('[data-learning-path-mobile-summary]')),
        dockPlacement: document.querySelector('[data-konling-dock-placement]')?.getAttribute('data-konling-dock-placement') || '',
      },
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
    firstControls: audit.controls.filter((item) => !item.hidden && !item.disabled).slice(0, 42),
    alerts: audit.alerts,
    unnamedControls: audit.unnamedControls,
    graphicsCount: audit.graphicsCount,
    canvasCount: audit.canvasCount,
    unnamedGraphics: audit.unnamedGraphics,
    markers: audit.markers,
    hits: {
      adaptiveCenter: /自适应学习路径中心|生成、比较并继续执行个人学习路径/.test(body),
      learningOverview: /学习概况|当前目标|已完成节点时长|证据覆盖|下一步/.test(body),
      generationSettings: /生成设置|调整路径生成方案|可用时间|资源偏好|检查点密度/.test(body),
      pathComparison: /选择你的学习路径|Path comparison|可比较路径/.test(body),
      activeRoute: /当前学习路径|完整路线|当前节点|检查点状态/.test(body),
      evidenceRecord: /路径完成与证据|Evidence Record|时间线/.test(body),
      practiceResource: /自适应练习|路径资源入口|检查节点练习/.test(body),
      loginRequired: /登录后可以继续当前路径和练习任务/.test(body),
      emptyTimeline: /路径执行、回顾、继续互动、跳过、检查点和控灵建议会在这里形成时间线/.test(body),
      noLiveRegion: audit.alerts.length === 0,
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

async function newPage(role, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => recordError('pageerror', error, page.url()));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    if (request.url().includes('/_next/image')) {
      recordIgnoredError('image optimizer requestfailed', failure?.errorText || 'unknown', request.url());
      return;
    }
    recordIgnoredError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  await login(page, role);
  return { context, page };
}

async function main() {
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const studentSession = await newPage('student', desktop);
  const page = studentSession.page;
  await apiCheck(page, '/api/auth/session', 'student auth session for batch40');
  await apiCheck(page, `/api/learning-paths/latest?goal=${fixtures.coreGoal}`, 'latest control-correction path');
  await apiCheck(page, `/api/learning-paths/latest?goal=${fixtures.secondaryGoal}`, 'latest frequency-response path');
  await apiCheck(page, `/api/adaptive/learner-state?goal=${fixtures.coreGoal}`, 'control-correction learner state');
  await apiCheck(page, `/api/adaptive/path-advisor-context?goal=${fixtures.coreGoal}`, 'path advisor context');

  await gotoStable(page, '/assessment/adaptive-practice');
  await capture(page, '01-student-adaptive-path-default-landing.png', 'student adaptive path default landing', {
    expected: 'Default student landing should restore latest path when present, otherwise explain cold-start next action and evidence need.',
    focusTrail: await focusTrail(page, 12),
  });

  await gotoStable(page, `/assessment/adaptive-practice?goal=${fixtures.coreGoal}&intent=practice`, 3600);
  await capture(page, '02-student-adaptive-practice-core-goal.png', 'student adaptive practice core goal', {
    expected: 'Practice intent should show adaptive practice resource and learner/path context for the selected goal.',
  });

  await clickRole(page, 'button', /生成练习题|展开练习题/, 'practice generate or expand question', 2200);
  await capture(page, '03-student-adaptive-practice-question-action.png', 'student adaptive practice after question action', {
    expected: 'Question action should either expose a usable question or a recoverable loading state with clear next step.',
  });

  await gotoStable(page, `/assessment/adaptive-practice?goal=${fixtures.coreGoal}&intent=evidence-review`, 3200);
  await capture(page, '04-student-adaptive-path-evidence-review-intent.png', 'student adaptive path evidence-review intent', {
    expected: 'Evidence-review intent should land in a visible evidence workspace even when latest path data is missing.',
  });

  await gotoStable(page, `/assessment/adaptive-practice?goal=${fixtures.coreGoal}&intent=contextual-recommendation`, 3200);
  await capture(page, '05-student-adaptive-path-generation-panel.png', 'student adaptive path generation panel', {
    expected: 'Generation intent should expose goal, time, rhythm, resource preference, checkpoint, and natural language controls.',
  });

  await page.locator('textarea[data-adaptive-path-generation-intent]').fill(fixtures.generationIntentText);
  await page.locator('input[type="range"]').first().evaluate((node) => {
    node.value = '90';
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }).catch((error) => recordIgnoredError('adjust generation time range', error, page.url()));
  await clickRole(page, 'button', '仿真', 'toggle simulation resource preference', 700);
  await capture(page, '06-student-adaptive-path-generation-edited.png', 'student adaptive path generation edited controls', {
    expected: 'Edited generation controls should keep the request readable and action affordances visible without submitting.',
  });

  await gotoStable(page, `/assessment/adaptive-practice?intent=contextual-recommendation`, 2800);
  await capture(page, '07-student-adaptive-path-generic-generation.png', 'student adaptive path generic generation without goal', {
    expected: 'Generic generation entry should not strand the learner when no explicit goal query is present.',
  });

  await gotoStable(page, `/assessment/adaptive-practice?goal=${fixtures.coreGoal}&intent=path-selection`, 3200);
  await capture(page, '08-student-adaptive-path-selection-without-path.png', 'student adaptive path selection without path', {
    expected: 'Path-selection intent should explain missing generated options and provide a route back to generation.',
  });

  await gotoStable(page, `/assessment/adaptive-practice?goal=${fixtures.coreGoal}&intent=path-execution`, 3200);
  await capture(page, '09-student-adaptive-path-execution-without-path.png', 'student adaptive path execution without path', {
    expected: 'Path-execution intent should explain missing active route instead of only showing unrelated practice state.',
  });

  await gotoStable(page, `/assessment/adaptive-practice?demo=1&scene=stable&goal=${fixtures.coreGoal}&intent=path-selection`, 2200);
  await capture(page, '10-demo-adaptive-path-selection-options.png', 'demo adaptive path selection options', {
    expected: 'Demo path-selection should expose route modules, comparison fields, and selection history affordances.',
  });

  await gotoStable(page, `/assessment/adaptive-practice?demo=1&scene=stable&goal=${fixtures.coreGoal}&intent=path-execution`, 2200);
  await capture(page, '11-demo-adaptive-path-execution-route.png', 'demo adaptive path execution route', {
    expected: 'Demo path-execution should expose active route, node detail, evidence summary, and practice resource entry.',
  });

  await clickRole(page, 'button', '展开练习题', 'demo execution expand practice question', 900);
  await capture(page, '12-demo-adaptive-path-execution-question-expanded.png', 'demo adaptive path execution question expanded', {
    expected: 'Expanded route practice should keep node context and answer controls usable together.',
  });

  await gotoStable(page, `/assessment/adaptive-practice?demo=1&scene=stable&goal=${fixtures.coreGoal}&intent=evidence-review`, 2200);
  await capture(page, '13-demo-adaptive-path-evidence-review.png', 'demo adaptive path evidence review', {
    expected: 'Demo evidence-review should show evidence record and selection history without requiring route execution controls.',
  });
  await studentSession.context.close();

  const mobileSession = await newPage('student', mobile);
  const mobilePage = mobileSession.page;
  await gotoStable(mobilePage, '/assessment/adaptive-practice');
  await capture(mobilePage, '14-mobile-adaptive-path-default-landing.png', 'mobile adaptive path default landing', {
    expected: 'Mobile default landing should keep primary path actions and dock controls from competing with the overview.',
    focusTrail: await focusTrail(mobilePage, 10),
  });

  await gotoStable(mobilePage, `/assessment/adaptive-practice?goal=${fixtures.coreGoal}&intent=contextual-recommendation`, 2800);
  await capture(mobilePage, '15-mobile-adaptive-path-generation-panel.png', 'mobile adaptive path generation panel', {
    expected: 'Mobile generation panel should keep inputs, textarea, and primary actions in a coherent order.',
  });

  await gotoStable(mobilePage, `/assessment/adaptive-practice?demo=1&scene=stable&goal=${fixtures.coreGoal}&intent=path-selection`, 2200);
  await capture(mobilePage, '16-mobile-demo-adaptive-path-selection-options.png', 'mobile demo adaptive path selection options', {
    expected: 'Mobile selection should show horizontal summary, route cards, and primary/secondary actions without overlong controls.',
  });

  await gotoStable(mobilePage, `/assessment/adaptive-practice?demo=1&scene=stable&goal=${fixtures.coreGoal}&intent=path-execution`, 2200);
  await capture(mobilePage, '17-mobile-demo-adaptive-path-execution-route.png', 'mobile demo adaptive path execution route', {
    expected: 'Mobile execution should keep route map, node detail, evidence record, and practice entry scannable.',
  });
  await mobileSession.context.close();

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png')).sort();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 'function-state-flows-batch40',
    scope: 'Student adaptive practice and learning path center: landing, practice, generation, selection, execution, evidence-review, latest path APIs, and mobile states',
    fixtures,
    routeResponses,
    results,
    apiChecks,
    optionalActions,
    errors,
    ignoredErrors,
    screenshotDir,
    pngFiles,
    summary: {
      resultCount: results.length,
      apiCheckCount: apiChecks.length,
      optionalActionCount: optionalActions.length,
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
    optionalActions: optionalActions.length,
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
