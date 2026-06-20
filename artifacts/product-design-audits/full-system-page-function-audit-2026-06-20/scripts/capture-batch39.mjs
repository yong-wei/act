import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/74-function-state-flows-batch39');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch39-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
};

const fixtures = {
  cruiseArenaTaskId: 'task-cruise-roll-blackbox-identification',
  searchTerm: '动力定位',
  emptySearchTerm: '不存在的仿真对象',
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
    role: body.user?.role,
    userId: body.user?.id,
    count: body.items?.length ?? body.results?.length ?? body.total,
    sampleText: JSON.stringify(body).slice(0, 1200),
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
      width: el instanceof HTMLCanvasElement ? el.width : null,
      height: el instanceof HTMLCanvasElement ? el.height : null,
    }));
    const bodyText = text(document.body).slice(0, 18000);
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 10),
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 42),
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
        simulationsWorkspace: Boolean(document.querySelector('[data-commercial-workspace="simulations"]')),
        simulationScene: Boolean(document.querySelector('[data-commercial-workspace="simulation-scene"]')),
        instrumentArea: Boolean(document.querySelector('[data-commercial-workspace-zone="instrument-area"]')),
        bottomTools: Boolean(document.querySelector('[data-task-workspace-zone="bottom-tools"]')),
        visibleBottomTools: Boolean([...document.querySelectorAll('[data-task-workspace-zone="bottom-tools"]')].some(visible)),
        localPanels: [...document.querySelectorAll('[data-simulation-local-panel]')].map((el) => ({
          side: el.getAttribute('data-simulation-local-panel'),
          open: el.hasAttribute('open'),
          text: text(el).slice(0, 240),
          hidden: !visible(el),
        })),
        catalogView: document.querySelector('[data-simulation-catalog-view]')?.getAttribute('data-simulation-catalog-view') || '',
        scenarioRows: document.querySelectorAll('[data-simulation-scenario-row]').length,
        scenarioCards: document.querySelectorAll('[data-simulation-scenario-card]').length,
        dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
        arenaEvidenceRail: Boolean(document.querySelector('[data-commercial-workspace-zone="evidence-rail"], [data-app-shell-zone="evidence-rail"]')),
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
    firstControls: audit.controls.filter((item) => !item.hidden && !item.disabled).slice(0, 38),
    alerts: audit.alerts,
    unnamedControls: audit.unnamedControls,
    graphicsCount: audit.graphicsCount,
    canvasCount: audit.canvasCount,
    unnamedGraphics: audit.unnamedGraphics,
    markers: audit.markers,
    hits: {
      simulationsCatalog: /虚拟仿真|统一仿真目录|从任务、对象和控制主题进入仿真/.test(body),
      catalogFilters: /搜索仿真名称|难度|目录视图|当前结果|全部仿真|课程任务|自由探索/.test(body),
      courseDesign: /课程概述|学习目标|要点提示|开始仿真实验/.test(body),
      emptyCatalog: /没有匹配的仿真对象/.test(body),
      simulationScene: /仿真|场景|局部工具|状态遥测|控制与评价|舒适性状态|定位状态/.test(body),
      arenaContext: /竞技场|Arena|官方评价|预览|黑箱|提交|证据/.test(body),
      bottomToolsHidden: audit.markers.bottomTools && !audit.markers.visibleBottomTools,
      virtualLabRedirect: audit.url.endsWith('/simulations'),
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

async function clickText(page, text, actionLabel, waitMs = 1200) {
  const locator = page.locator(`text=${text}`).first();
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', text, url: page.url() });
    return false;
  }
  await locator.click().catch((error) => recordIgnoredError(actionLabel, error, page.url()));
  optionalActions.push({ action: actionLabel, status: 'attempted', text, url: page.url() });
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
  await apiCheck(page, '/api/auth/session', 'student auth session for batch39');

  await gotoStable(page, '/simulations');
  await capture(page, '01-student-simulations-catalog-default.png', 'student simulations catalog default', {
    expected: 'Simulation catalog should show task/object/control theme entry, search, difficulty, mode tabs, result count, and canonical launch actions.',
    focusTrail: await focusTrail(page, 12),
  });

  await page.locator('[data-simulation-catalog-search]').fill(fixtures.searchTerm);
  await sleep(1000);
  await capture(page, '02-student-simulations-catalog-search.png', 'student simulations catalog search', {
    expected: 'Search should reduce the catalog and announce/visibly show result count.',
    searchTerm: fixtures.searchTerm,
  });

  await page.locator('select').first().selectOption('advanced').catch((error) => recordIgnoredError('select challenge difficulty', error, page.url()));
  await clickRole(page, 'tab', '自由探索', 'switch catalog to explore mode', 900);
  await capture(page, '03-student-simulations-catalog-advanced-explore.png', 'student simulations catalog advanced explore filter', {
    expected: 'Advanced/free exploration filters should clarify what remains and why.',
  });

  await page.locator('[data-simulation-catalog-search]').fill('');
  await page.locator('select').first().selectOption('all').catch((error) => recordIgnoredError('reset difficulty', error, page.url()));
  await clickRole(page, 'tab', '全部仿真', 'switch catalog to all mode', 700);
  await clickRole(page, 'button', '卡片', 'switch catalog card view', 1000);
  await capture(page, '04-student-simulations-catalog-card-view.png', 'student simulations catalog card view', {
    expected: 'Card view should preserve launch and course-design actions with scenario previews.',
  });

  await clickRole(page, 'button', '课程设计', 'open course design modal from card view', 1200);
  await capture(page, '05-student-simulations-course-design-modal.png', 'student simulations course design modal', {
    expected: 'Course design modal should expose overview, objectives, key points, and a clear start experiment action.',
  });
  await page.keyboard.press('Escape');
  await sleep(700);

  await page.locator('[data-simulation-catalog-search]').fill(fixtures.emptySearchTerm);
  await sleep(1000);
  await capture(page, '06-student-simulations-empty-search.png', 'student simulations empty search state', {
    expected: 'Empty catalog state should show no matches and offer recovery actions or filter reset.',
    searchTerm: fixtures.emptySearchTerm,
  });

  await gotoStable(page, '/virtual-lab');
  await capture(page, '07-student-virtual-lab-redirect.png', 'student virtual lab compatibility redirect', {
    expected: 'Virtual lab compatibility route should land on the simulation catalog and preserve understandable context.',
  });

  await gotoStable(page, '/simulations/cruise', 6500);
  await capture(page, '08-student-cruise-simulation-standalone.png', 'student cruise simulation standalone', {
    expected: 'Cruise simulation should load a nonblank scene with comfort/frequency local tools and structured support surfaces.',
    focusTrail: await focusTrail(page, 10),
  });
  await clickText(page, '支持与证据状态', 'open cruise support drawer', 900);
  await capture(page, '09-student-cruise-support-drawer.png', 'student cruise support drawer', {
    expected: 'Support drawer should explain replay/Arena/evidence boundaries without hiding scene controls.',
  });

  await gotoStable(page, `/simulations/cruise?arenaTask=${fixtures.cruiseArenaTaskId}`, 7000);
  await capture(page, '10-student-cruise-arena-task-context.png', 'student cruise arena task context', {
    expected: 'Arena task launch should explain preview/official boundary and show the evidence/submission rail when applicable.',
    arenaTaskId: fixtures.cruiseArenaTaskId,
  });

  await gotoStable(page, '/simulations/destroyer', 6500);
  await capture(page, '11-student-destroyer-simulation-local-tools.png', 'student destroyer simulation local tools', {
    expected: 'Destroyer simulation should expose heading-control status, parameter/evaluation tools, and a stable scene.',
  });

  await gotoStable(page, '/simulations/drilling', 6500);
  await capture(page, '12-student-drilling-simulation-local-tools.png', 'student drilling simulation local tools', {
    expected: 'Drilling simulation should expose DP positioning status, thrust allocation tools, and a stable scene.',
  });
  await studentSession.context.close();

  const mobileCatalogSession = await newPage('student', mobile);
  const mobilePage = mobileCatalogSession.page;
  await gotoStable(mobilePage, '/simulations');
  await capture(mobilePage, '13-student-simulations-mobile-default.png', 'student simulations mobile default', {
    expected: 'Mobile simulation catalog should keep search, filters, view switch, scenario rows, and global dock from competing with main actions.',
    focusTrail: await focusTrail(mobilePage, 10),
  });
  await mobilePage.locator('[data-simulation-catalog-search]').fill(fixtures.searchTerm);
  await sleep(900);
  await clickRole(mobilePage, 'button', '卡片', 'mobile switch catalog card view', 900);
  await capture(mobilePage, '14-student-simulations-mobile-search-card.png', 'student simulations mobile search card view', {
    expected: 'Mobile search and card view should expose result count, matching cards, and clear launch actions.',
  });

  await gotoStable(mobilePage, '/simulations/cruise', 7000);
  await capture(mobilePage, '15-student-cruise-simulation-mobile.png', 'student cruise simulation mobile', {
    expected: 'Mobile cruise simulation should keep scene, local panels, hint strip, and global floating tools from overlapping critical controls.',
  });
  await mobileCatalogSession.context.close();

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png')).sort();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 'function-state-flows-batch39',
    scope: 'Simulation catalog search/filter/view/mode/course-design modal, virtual-lab redirect, cruise/destroyer/drilling simulation local tools, Arena task context, and mobile catalog/simulation states',
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
