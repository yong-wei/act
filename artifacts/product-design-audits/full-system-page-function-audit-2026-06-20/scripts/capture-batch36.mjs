import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/71-function-state-flows-batch36');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch36-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
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

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1000);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(accounts.student.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(accounts.student.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2200);
}

async function gotoStable(page, route, waitMs = 2600) {
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
    count: body.total ?? body.history?.length ?? body.missions?.length ?? body.items?.length,
    statistics: body.statistics ?? null,
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
      ariaExpanded: el.getAttribute('aria-expanded') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      hidden: !visible(el),
    }));
    const inputs = [...document.querySelectorAll('input, textarea, select')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      labelText: text(el.closest('label')),
      value: 'value' in el ? String(el.value || '').slice(0, 240) : '',
      hidden: !visible(el),
    }));
    const alerts = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const dialogs = [...document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]')].map((el) => ({
      name: name(el),
      role: el.getAttribute('role') || '',
      modal: el.getAttribute('aria-modal') || '',
      text: text(el).slice(0, 600),
    }));
    const tables = [...document.querySelectorAll('table')].map((table) => ({
      headers: [...table.querySelectorAll('th')].map(text).filter(Boolean),
      rows: table.querySelectorAll('tbody tr').length,
      caption: text(table.querySelector('caption')),
    }));
    const graphics = [...document.querySelectorAll('svg, canvas')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      role: el.getAttribute('role') || '',
      ariaHidden: el.getAttribute('aria-hidden') || '',
    }));
    const bodyText = text(document.body).slice(0, 16000);
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 28),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        role: active?.getAttribute?.('role') || '',
        name: name(active),
      },
      controls,
      inputs,
      alerts,
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
    firstControls: audit.controls.filter((item) => !item.hidden && !item.disabled).slice(0, 28),
    inputs: audit.inputs.filter((item) => !item.hidden).slice(0, 16),
    alerts: audit.alerts,
    dialogs: audit.dialogs,
    tableCount: audit.tables.length,
    unnamedControls: audit.unnamedControls,
    graphicsCount: audit.graphicsCount,
    unnamedGraphics: audit.unnamedGraphics,
    hits: {
      missions: /任务大厅|学习路径|全部任务|可挑战|已完成/.test(body),
      missionEmpty: /暂无任务|当前没有可挑战的任务|你还没有完成任何任务/.test(body),
      missionStartTarget: /驱逐舰|仿真|Simulation|destroyer|海况/.test(body),
      portfolio: /我的学习档案|课堂作品|提示词设计|仿真设计|伦理整改|学习反思/.test(body),
      classWorks: /暂无课堂作品|进入互动课程/.test(body),
      promptDesigns: /暂无高质量提示词|练习提示词设计/.test(body),
      simulations: /暂无仿真设计记录|开始仿真/.test(body),
      ethics: /暂无伦理整改记录|了解工程伦理/.test(body),
      missingRoute: /404|This page could not be found|Not Found/.test(body),
      liveRegion: audit.alerts.length > 0,
      globalAiFocus: /全局 AI 问题输入框|打开控灵与页面工具菜单/.test(body),
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

async function clickText(page, text, actionLabel, waitMs = 1200) {
  const locator = page.getByText(text, { exact: true }).first();
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', url: page.url() });
    return false;
  }
  await locator.click().catch((error) => recordIgnoredError(actionLabel, error, page.url()));
  optionalActions.push({ action: actionLabel, status: 'attempted', url: page.url() });
  await sleep(waitMs);
  return true;
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

async function newPage(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN' });
  const page = await context.newPage();
  page.on('pageerror', (error) => recordError('pageerror', error, page.url()));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    recordIgnoredError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  await login(page);
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

  const desktopSession = await newPage(desktop);
  const page = desktopSession.page;

  await apiCheck(page, '/api/auth/session', 'student auth session for batch36');
  await apiCheck(page, '/api/missions', 'student missions API');
  await apiCheck(page, '/api/evaluation/prompt-history/cmjm5lkjk0000t69bqiupz5am', 'student prompt history before portfolio check');

  await gotoStable(page, '/missions');
  await capture(page, '01-missions-default-desktop.png', 'missions default desktop', {
    expected: 'Mission hall should show mission counts, filters, cards, clear start actions, and learning-path progress.',
    focusTrail: await focusTrail(page, 12),
  });

  await clickRole(page, 'button', /已完成/, 'missions completed filter', 1000);
  await capture(page, '02-missions-completed-filter-desktop.png', 'missions completed filter desktop', {
    expected: 'Completed filter should show completed missions or a clear empty state with recovery action.',
  });

  await clickRole(page, 'button', /可挑战/, 'missions unlocked filter', 1000);
  await capture(page, '03-missions-unlocked-filter-desktop.png', 'missions unlocked filter desktop', {
    expected: 'Unlocked filter should keep playable tasks and preserve count/status semantics.',
  });

  await clickRole(page, 'link', /开始挑战|再次挑战/, 'missions start first playable task', 1800);
  await capture(page, '04-missions-start-target-desktop.png', 'missions start target desktop', {
    expected: 'Starting a mission should land on a task-aware simulation surface that preserves mission context.',
  });

  await gotoStable(page, '/missions?project=goal');
  await capture(page, '05-missions-query-context-desktop.png', 'missions query context desktop', {
    expected: 'Mission links generated by learning-path APIs with query context should preserve or explain that context.',
  });

  await gotoStable(page, '/profile/portfolio');
  await capture(page, '06-portfolio-classworks-empty-desktop.png', 'portfolio class works empty desktop', {
    expected: 'Portfolio class works empty state should explain what counts as a work and route to a task that can create one.',
    focusTrail: await focusTrail(page, 10),
  });

  await clickRole(page, 'link', '进入互动课程', 'portfolio class works action', 1300);
  await capture(page, '07-portfolio-classworks-action-target-desktop.png', 'portfolio class works action target desktop', {
    expected: 'Class works action should land on an interaction flow that can produce portfolio artifacts.',
  });

  await gotoStable(page, '/profile/portfolio');
  await clickText(page, '仿真设计', 'portfolio simulations tab', 800);
  await capture(page, '08-portfolio-simulations-tab-desktop.png', 'portfolio simulations tab desktop', {
    expected: 'Simulation designs tab should show saved designs or route to a simulation that can produce one.',
  });

  await clickRole(page, 'link', '开始仿真', 'portfolio simulation action', 1500);
  await capture(page, '09-portfolio-simulation-action-target-desktop.png', 'portfolio simulation action target desktop', {
    expected: 'Simulation portfolio action should land on a clear simulation task with save-back context.',
  });

  await gotoStable(page, '/profile/portfolio');
  await clickText(page, '伦理整改', 'portfolio ethics tab', 800);
  await capture(page, '10-portfolio-ethics-tab-desktop.png', 'portfolio ethics tab desktop', {
    expected: 'Ethics tab should show remediated cases or clearly explain how to create a remediation record.',
  });

  await clickRole(page, 'link', '了解工程伦理', 'portfolio ethics action', 1500);
  await capture(page, '11-portfolio-ethics-action-target-desktop.png', 'portfolio ethics action target desktop', {
    expected: 'Ethics action should land on a surface that can create or explain remediation evidence.',
  });

  await gotoStable(page, '/profile/portfolio');
  await clickText(page, '提示词设计', 'portfolio prompts tab after prompt history', 800);
  await capture(page, '12-portfolio-prompts-tab-after-history-desktop.png', 'portfolio prompts tab after history desktop', {
    expected: 'Prompt tab should reconcile existing prompt-history API records with portfolio visible records.',
  });

  const mobileSession = await newPage(mobile);
  const mobilePage = mobileSession.page;
  await gotoStable(mobilePage, '/missions');
  await capture(mobilePage, '13-missions-default-mobile.png', 'missions default mobile', {
    expected: 'Mobile missions should keep filter, first task, and start action usable without global overlays hiding controls.',
    focusTrail: await focusTrail(mobilePage, 10),
  });
  await gotoStable(mobilePage, '/profile/portfolio');
  await clickText(mobilePage, '仿真设计', 'mobile portfolio simulations tab', 800);
  await capture(mobilePage, '14-portfolio-simulations-tab-mobile.png', 'portfolio simulations tab mobile', {
    expected: 'Mobile portfolio tabs should remain scannable and keep empty-state action visible.',
  });
  await mobileSession.context.close();

  await desktopSession.context.close();

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png')).sort();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 'function-state-flows-batch36',
    scope: 'Student mission hall filters/start target, portfolio classwork/simulation/ethics empty states, portfolio prompt history reconciliation, and mobile mission/portfolio states',
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
