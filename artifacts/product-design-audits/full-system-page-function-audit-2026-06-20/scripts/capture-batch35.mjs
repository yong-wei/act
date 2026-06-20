import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/70-function-state-flows-batch35');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch35-manifest.json');
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
    userId: body.user?.id || body.userId || '',
    role: body.user?.role || body.role || '',
    count: body.total ?? body.history?.length ?? body.sessions?.length ?? body.items?.length,
    sampleText: JSON.stringify(body).slice(0, 1200),
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
    const statusRegions = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const tables = [...document.querySelectorAll('table')].map((table) => ({
      headers: [...table.querySelectorAll('th')].map(text).filter(Boolean),
      rows: table.querySelectorAll('tbody tr').length,
      caption: text(table.querySelector('caption')),
    }));
    const dialogs = [...document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]')].map((el) => ({
      name: name(el),
      role: el.getAttribute('role') || '',
      modal: el.getAttribute('aria-modal') || '',
      text: text(el).slice(0, 600),
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
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 24),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        role: active?.getAttribute?.('role') || '',
        name: name(active),
      },
      controls,
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
    firstControls: audit.controls.filter((item) => !item.hidden && !item.disabled).slice(0, 24),
    inputs: audit.inputs.filter((item) => !item.hidden).slice(0, 16),
    alerts: audit.alerts,
    dialogs: audit.dialogs,
    tableCount: audit.tables.length,
    unnamedControls: audit.unnamedControls,
    graphicsCount: audit.graphicsCount,
    unnamedGraphics: audit.unnamedGraphics,
    hits: {
      aiWorkshop: /AI工坊|学习任务|成就徽章|学海罗盘/.test(body),
      taskSelected: /船舶航向控制仿真|开始学习|进阶/.test(body),
      copilot: /控灵|快捷问题|PID原理|请输入您的问题/.test(body),
      aiLoading: /正在思考|出错了|重试|停止/.test(body),
      promptAssessment: /元提示词评价|结构化提示词编辑器|提示词质量仪表盘/.test(body),
      promptResult: /综合得分|改进建议|一致性得分|常态化训练/.test(body),
      portfolio: /个人档案|提示词设计|学习反思|练习提示词设计|开始反思/.test(body),
      missingRoute: /404|This page could not be found|Not Found/.test(body),
      liveRegion: audit.alerts.length > 0,
      contextReturn: /返回AI工坊|返回首页|返回/.test(body),
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

async function clickRole(page, role, name, actionLabel, waitMs = 1000) {
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

async function fillByLabel(page, label, value, actionLabel) {
  const locator = page.getByLabel(label).first();
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', url: page.url() });
    return false;
  }
  await locator.fill(value).catch((error) => recordIgnoredError(actionLabel, error, page.url()));
  optionalActions.push({ action: actionLabel, status: 'attempted', url: page.url() });
  await sleep(300);
  return true;
}

async function newPage(viewport, role = null) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN' });
  const page = await context.newPage();
  page.on('pageerror', (error) => recordError('pageerror', error, page.url()));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    recordIgnoredError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  if (role) await login(page, role);
  return { context, page };
}

async function fetchApi(page, label, route, expectedStatuses) {
  const response = await page.evaluate(async (targetRoute) => {
    const res = await fetch(targetRoute, { headers: { accept: 'application/json' } });
    const contentType = res.headers.get('content-type') || '';
    let body = {};
    if (contentType.includes('json')) body = await res.json().catch(() => ({}));
    else body = { text: (await res.text()).slice(0, 600) };
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
    summary: summarizeJson(response.body),
  });
  if (!accepted) recordError(`api ${label}`, `unexpected status ${response.status}`, route);
  return response;
}

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const aiDesktop = await newPage(desktop, 'student');
  await fetchApi(aiDesktop.page, 'student auth session for batch35', '/api/auth/session', [200]);
  await gotoStable(aiDesktop.page, '/ai', 3600);
  const aiTrail = await focusTrail(aiDesktop.page, 12);
  await capture(aiDesktop.page, '01-ai-workshop-desktop.png', 'AI workshop desktop', {
    expected: 'AI workshop should orient the student, expose task states, and provide clear next actions back to learning work',
    focusTrail: aiTrail,
  });
  await clickRole(aiDesktop.page, 'button', /船舶航向控制仿真/, 'select AI workshop in-progress task', 900);
  const selectedTaskTrail = await focusTrail(aiDesktop.page, 8);
  await capture(aiDesktop.page, '02-ai-workshop-task-selected-desktop.png', 'AI workshop selected task desktop', {
    expected: 'selecting a learning task should reveal task details, start action, and return-to-course context',
    focusTrail: selectedTaskTrail,
  });
  await aiDesktop.context.close();

  const copilotDesktop = await newPage(desktop, 'student');
  await gotoStable(copilotDesktop.page, '/ai/copilot', 3600);
  const copilotTrail = await focusTrail(copilotDesktop.page, 12);
  await capture(copilotDesktop.page, '03-copilot-empty-desktop.png', 'copilot empty desktop', {
    expected: 'standalone Copilot should expose prompt, quick questions, return context, and keyboard-friendly input order',
    focusTrail: copilotTrail,
  });
  await clickRole(copilotDesktop.page, 'button', /PID原理/, 'ask copilot quick PID question', 1200);
  await sleep(7000);
  const copilotAfterAskTrail = await focusTrail(copilotDesktop.page, 10);
  await capture(copilotDesktop.page, '04-copilot-after-quick-question-desktop.png', 'copilot after quick question desktop', {
    expected: 'quick question should produce clear sending/loading/result/error state and keep controls reachable',
    focusTrail: copilotAfterAskTrail,
  });
  await copilotDesktop.context.close();

  const promptDesktop = await newPage(desktop, 'student');
  await gotoStable(promptDesktop.page, '/evaluation/prompt-assessment', 4200);
  const promptEmptyTrail = await focusTrail(promptDesktop.page, 12);
  await capture(promptDesktop.page, '05-prompt-assessment-empty-desktop.png', 'prompt assessment empty desktop', {
    expected: 'prompt assessment should explain required fields, history source, and how it connects to current learning goals',
    focusTrail: promptEmptyTrail,
  });
  await fillByLabel(promptDesktop.page, /控制对象/, '邮轮航向控制系统', 'fill control object');
  await fillByLabel(promptDesktop.page, /性能目标/, '超调 < 15%，调节时间 < 20s，稳态误差 < 2%', 'fill performance goals');
  await fillByLabel(promptDesktop.page, /约束条件/, '稳定裕度 > 30°，满足舒适度约束', 'fill constraints');
  await fillByLabel(promptDesktop.page, /设计背景/, '风浪扰动 + 参数不确定条件', 'fill design context');
  await fillByLabel(promptDesktop.page, /额外说明/, '按约束优先、跨域映射和参数迭代顺序输出调参方案。', 'fill extra prompt note');
  await clickRole(promptDesktop.page, 'button', /评价提示词质量/, 'run prompt quality assessment', 3200);
  const promptResultTrail = await focusTrail(promptDesktop.page, 12);
  await capture(promptDesktop.page, '06-prompt-assessment-quality-result-desktop.png', 'prompt assessment quality result desktop', {
    expected: 'quality assessment should show scored result, improvement guidance, persistence state, and accessible completion announcement',
    focusTrail: promptResultTrail,
  });
  await clickRole(promptDesktop.page, 'button', /过程一致性校验/, 'run prompt consistency check', 3200);
  await capture(promptDesktop.page, '07-prompt-assessment-consistency-result-desktop.png', 'prompt assessment consistency result desktop', {
    expected: 'consistency check should explain design-action trace, mismatches, and whether the result is saved to portfolio',
  });
  await clickRole(promptDesktop.page, 'button', /生成常态化演示轨迹/, 'seed prompt demo history', 5200);
  await capture(promptDesktop.page, '08-prompt-assessment-demo-history-desktop.png', 'prompt assessment demo history desktop', {
    expected: 'demo history should distinguish generated demo records from real learner records and expose refresh/completion status',
  });
  const sessionResponse = await fetchApi(promptDesktop.page, 'student auth session after prompt assessment', '/api/auth/session', [200]);
  const userId = sessionResponse.body?.user?.id || '';
  if (userId) {
    await fetchApi(promptDesktop.page, 'student prompt history after assessment', `/api/evaluation/prompt-history/${encodeURIComponent(userId)}`, [200]);
  }
  await promptDesktop.context.close();

  const portfolioDesktop = await newPage(desktop, 'student');
  await gotoStable(portfolioDesktop.page, '/profile/portfolio', 4200);
  await clickRole(portfolioDesktop.page, 'button', /提示词设计/, 'open portfolio prompt designs tab', 1000);
  const portfolioPromptTrail = await focusTrail(portfolioDesktop.page, 10);
  await capture(portfolioDesktop.page, '09-portfolio-prompt-designs-tab-desktop.png', 'portfolio prompt designs tab desktop', {
    expected: 'portfolio prompt tab should show saved prompt results or route the student to the correct prompt-assessment page',
    focusTrail: portfolioPromptTrail,
  });
  const clickedPromptAction = await clickRole(portfolioDesktop.page, 'link', /练习提示词设计/, 'follow portfolio prompt practice action', 1800);
  if (clickedPromptAction) {
    await capture(portfolioDesktop.page, '10-portfolio-prompt-practice-action-target-desktop.png', 'portfolio prompt practice action target desktop', {
      expected: 'portfolio prompt practice action should land on the active prompt-assessment route, not a missing or generic page',
    });
  }
  await gotoStable(portfolioDesktop.page, '/profile/portfolio', 2800);
  await clickRole(portfolioDesktop.page, 'button', /学习反思/, 'open portfolio reflections tab', 1000);
  const reflectionTrail = await focusTrail(portfolioDesktop.page, 10);
  await capture(portfolioDesktop.page, '11-portfolio-reflections-tab-desktop.png', 'portfolio reflections tab desktop', {
    expected: 'portfolio reflection empty state should explain what will be saved and route to Copilot with reflection context',
    focusTrail: reflectionTrail,
  });
  await clickRole(portfolioDesktop.page, 'link', /开始反思/, 'follow portfolio reflection action', 1800);
  await capture(portfolioDesktop.page, '12-portfolio-reflection-action-copilot-target-desktop.png', 'portfolio reflection action Copilot target desktop', {
    expected: 'reflection action should open Copilot with reflection intent or task context preserved',
  });
  await portfolioDesktop.context.close();

  const promptMobile = await newPage(mobile, 'student');
  await gotoStable(promptMobile.page, '/evaluation/prompt-assessment?autodemo=1', 7000);
  const promptMobileTrail = await focusTrail(promptMobile.page, 10);
  await capture(promptMobile.page, '13-prompt-assessment-autodemo-mobile.png', 'prompt assessment autodemo mobile', {
    expected: 'mobile prompt assessment should keep editor, results, history, and completion state usable without global overlays covering controls',
    focusTrail: promptMobileTrail,
  });
  await promptMobile.context.close();

  const copilotMobile = await newPage(mobile, 'student');
  await gotoStable(copilotMobile.page, '/ai/copilot', 3600);
  const copilotMobileTrail = await focusTrail(copilotMobile.page, 10);
  await capture(copilotMobile.page, '14-copilot-mobile-empty.png', 'copilot mobile empty', {
    expected: 'mobile Copilot should keep input, quick questions, and return navigation visible and not compete with global floating controls',
    focusTrail: copilotMobileTrail,
  });
  await copilotMobile.context.close();
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
      batch: 'function-state-flows-batch35',
      scope: 'AI workshop, standalone Copilot, prompt assessment quality/consistency/demo history, portfolio prompt/reflection handoffs, and mobile AI input states',
      routeResponses,
      results,
      apiChecks,
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
