import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/77-function-state-flows-batch42');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch42-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  admin: { account: 'admin', password: 'admin@Just' },
};

const results = [];
const routeResponses = [];
const apiResponses = [];
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
  await sleep(800);
  await page.locator('form input[name="account"]').first().fill(account.account);
  await page.locator('form input[name="password"]').first().fill(account.password);
  await page.locator('form button[type="submit"]').first().click();
  await sleep(2400);
  optionalActions.push({
    action: `login ${role}`,
    status: page.url().includes('/login') ? 'still-on-login' : 'submitted',
    url: page.url(),
  });
}

async function gotoStable(page, route, waitMs = 1800) {
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

async function clickSelector(page, selector, actionLabel, waitMs = 700) {
  const locator = page.locator(selector).first();
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', selector, url: page.url() });
    return false;
  }
  const error = await locator.click({ timeout: 1800 }).then(() => null).catch((caught) => caught);
  optionalActions.push({
    action: actionLabel,
    status: error ? 'blocked' : 'attempted',
    selector,
    url: page.url(),
    message: error instanceof Error ? error.message.split('\n')[0] : undefined,
  });
  await sleep(waitMs);
  return !error;
}

async function clickRole(page, role, name, actionLabel, waitMs = 700) {
  const locator = page.getByRole(role, { name }).first();
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', url: page.url() });
    return false;
  }
  const error = await locator.click({ timeout: 1800 }).then(() => null).catch((caught) => caught);
  optionalActions.push({
    action: actionLabel,
    status: error ? 'blocked' : 'attempted',
    url: page.url(),
    message: error instanceof Error ? error.message.split('\n')[0] : undefined,
  });
  await sleep(waitMs);
  return !error;
}

async function openFloatingDock(page, label = 'open floating dock') {
  return clickSelector(page, '[data-page-floating-controls] button[data-platform-floating-dock-trigger-label]', label, 700);
}

async function openGlobalAIFromDock(page, label = 'open global AI from dock') {
  const opened = await openFloatingDock(page, `${label}: open dock first`);
  if (!opened) return false;
  return clickRole(page, 'button', /呼出控灵 AI助手|控灵 AI助手/, label, 900);
}

async function sendGlobalAIQuestion(page, question, label) {
  const input = page.locator('input[name="global-ai-sidebar-input"]').first();
  if (!(await input.count())) {
    optionalActions.push({ action: label, status: 'input-not-found', url: page.url() });
    return false;
  }
  await input.fill(question);
  await sleep(100);
  const sendButton = page.locator('form:has(input[name="global-ai-sidebar-input"]) button[type="submit"]').first();
  if (!(await sendButton.count())) {
    optionalActions.push({ action: label, status: 'send-button-not-found', url: page.url() });
    return false;
  }
  await sendButton.click().catch((error) => recordIgnoredError(label, error, page.url()));
  optionalActions.push({ action: label, status: 'attempted', question, url: page.url() });
  await sleep(500);
  return true;
}

async function waitForAISettled(page, label, timeoutMs = 16000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => {
      const text = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
      const sidebar = document.querySelector('[data-global-ai-sidebar]');
      const body = text(sidebar);
      return {
        loading: body.includes('控灵正在思考'),
        hasError: body.includes('出错了:'),
        assistantMessages: [...document.querySelectorAll('[data-global-ai-sidebar] .ai-message-content')].length,
        body,
      };
    }).catch(() => ({ loading: false, hasError: false, assistantMessages: 0, body: '' }));
    if (!state.loading && (state.hasError || state.assistantMessages > 0 || state.body.includes('智能助手暂时'))) {
      optionalActions.push({ action: label, status: 'settled', state });
      return state;
    }
    await sleep(700);
  }
  const state = await page.evaluate(() => {
    const text = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    const sidebar = document.querySelector('[data-global-ai-sidebar]');
    return { timedOut: true, body: text(sidebar).slice(0, 2000) };
  }).catch((error) => ({ timedOut: true, error: String(error) }));
  optionalActions.push({ action: label, status: 'timeout', state });
  return state;
}

async function focusTrail(page, count = 8) {
  const trail = [];
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press('Tab').catch((error) => recordIgnoredError('tab focus', error, page.url()));
    await sleep(80);
    const item = await page.evaluate(() => {
      const el = document.activeElement;
      const text = (node) => (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        tag: el?.tagName?.toLowerCase() || '',
        type: el?.getAttribute?.('type') || '',
        role: el?.getAttribute?.('role') || '',
        name: el?.getAttribute?.('aria-label') || el?.getAttribute?.('title') || text(el) || el?.getAttribute?.('placeholder') || '',
        inFloating: Boolean(el?.closest?.('[data-page-floating-controls]')),
        inAiSidebar: Boolean(el?.closest?.('[data-global-ai-sidebar]')),
        href: el?.getAttribute?.('href') || '',
      };
    });
    trail.push({ index: index + 1, ...item });
  }
  return trail;
}

async function domAudit(page) {
  return await page.evaluate(() => {
    const text = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    const name = (el) => (
      el?.getAttribute?.('aria-label') ||
      el?.getAttribute?.('title') ||
      el?.getAttribute?.('placeholder') ||
      text(el) ||
      ''
    ).trim();
    const visible = (el) => !(
      !el ||
      el.hidden ||
      el.closest('[hidden]') ||
      getComputedStyle(el).display === 'none' ||
      getComputedStyle(el).visibility === 'hidden'
    );
    const controls = [...document.querySelectorAll('button, [role="button"], a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      name: name(el),
      type: el.getAttribute('type') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      hidden: !visible(el),
      inAiSidebar: Boolean(el.closest('[data-global-ai-sidebar]')),
      inFloating: Boolean(el.closest('[data-page-floating-controls]')),
    }));
    const aiSidebar = document.querySelector('[data-global-ai-sidebar]');
    const aiText = text(aiSidebar);
    const active = document.activeElement;
    const sendButton = document.querySelector('form:has(input[name="global-ai-sidebar-input"]) button[type="submit"]');
    const stopButton = [...document.querySelectorAll('[data-global-ai-sidebar] button')].find((el) => text(el) === '停止');
    const clearButton = [...document.querySelectorAll('[data-global-ai-sidebar] button')].find((el) => el.getAttribute('title') === '清空对话');
    const retryButton = [...document.querySelectorAll('[data-global-ai-sidebar] button')].find((el) => text(el).includes('重试'));
    const alerts = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const messages = [...document.querySelectorAll('[data-global-ai-sidebar] .ai-message-content')].map(text).filter(Boolean);
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 30),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        role: active?.getAttribute?.('role') || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
        inAiSidebar: Boolean(active?.closest?.('[data-global-ai-sidebar]')),
        inFloating: Boolean(active?.closest?.('[data-page-floating-controls]')),
      },
      controls,
      alerts,
      ai: {
        state: aiSidebar?.getAttribute('data-global-ai-sidebar') || '',
        role: aiSidebar?.getAttribute('role') || '',
        surface: aiSidebar?.getAttribute('data-konling-assistant-surface') || '',
        avoidance: aiSidebar?.getAttribute('data-konling-inspector-avoidance') || '',
        knowledgePolicy: aiSidebar?.getAttribute('data-knowledge-mobile-inspector-policy') || '',
        text: aiText.slice(0, 6000),
        hasWelcome: aiText.includes('你好，我是控灵'),
        hasKnowledgeContext: Boolean(aiSidebar?.querySelector('[data-konling-knowledge-context]')),
        knowledgeContextState: aiSidebar?.querySelector('[data-konling-knowledge-context]')?.getAttribute('data-konling-knowledge-context') || '',
        hasError: aiText.includes('出错了:'),
        hasRetry: Boolean(retryButton),
        hasLoading: aiText.includes('控灵正在思考'),
        messageCount: messages.length,
        messages: messages.slice(0, 5),
        quickQuestions: [...document.querySelectorAll('[data-global-ai-sidebar] button')]
          .map((el) => name(el))
          .filter((item) => item && !['关闭 (ESC)', '清空对话', '停止', '重试'].includes(item))
          .slice(0, 12),
        sendButtonName: name(sendButton),
        sendButtonDisabled: Boolean(sendButton?.disabled),
        stopButtonName: name(stopButton),
        clearButtonName: name(clearButton),
        inputDisabled: Boolean(document.querySelector('input[name="global-ai-sidebar-input"]')?.disabled),
      },
      routeMarkers: {
        routeFrame: document.querySelector('main')?.getAttribute('data-platform-route-frame') || '',
        floatingBehavior: document.querySelector('main')?.getAttribute('data-platform-floating-dock-behavior') || '',
        mobileNavigation: document.querySelector('main')?.getAttribute('data-platform-mobile-navigation') || '',
      },
    };
  });
}

function summarizeAudit(audit) {
  return {
    h1: audit.h1,
    h2: audit.h2,
    url: audit.url,
    activeElement: audit.activeElement,
    alerts: audit.alerts,
    ai: audit.ai,
    routeMarkers: audit.routeMarkers,
    unnamedVisibleAiButtons: audit.controls.filter((item) => item.inAiSidebar && !item.hidden && item.tag === 'button' && !item.name).length,
    visibleAiControls: audit.controls.filter((item) => item.inAiSidebar && !item.hidden).slice(0, 24),
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

async function newPage(role, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => recordError('pageerror', error, page.url()));
  page.on('response', async (response) => {
    if (!response.url().includes('/api/ai/chat')) return;
    let body = '';
    try {
      body = (await response.text()).slice(0, 2000);
    } catch (error) {
      body = `body-read-failed:${error instanceof Error ? error.message : String(error)}`;
    }
    apiResponses.push({
      url: response.url(),
      status: response.status(),
      method: response.request().method(),
      pageUrl: page.url(),
      body,
    });
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    recordIgnoredError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  await login(page, role);
  return { context, page };
}

async function main() {
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const studentDesktop = await newPage('student', desktop);
  const studentPage = studentDesktop.page;
  await gotoStable(studentPage, '/dashboard');
  await openGlobalAIFromDock(studentPage, 'dashboard open AI sidebar');
  await capture(studentPage, '01-dashboard-ai-initial.png', 'dashboard AI initial', {
    expected: 'Initial global AI sidebar should expose route context, visible input, named send button, and task-first focus behavior.',
    focusTrail: await focusTrail(studentPage, 8),
  });
  await sendGlobalAIQuestion(studentPage, '请根据当前页面说明我下一步应该先做什么。', 'dashboard send next-step question');
  await capture(studentPage, '02-dashboard-ai-submitted-loading.png', 'dashboard AI submitted/loading', {
    expected: 'Submitting a message should announce loading and expose stop control semantics.',
  });
  await waitForAISettled(studentPage, 'dashboard wait for AI response');
  await capture(studentPage, '03-dashboard-ai-response-or-error.png', 'dashboard AI response or error', {
    expected: 'AI response or service error should be visible, persistent, and announced.',
  });
  await clickRole(studentPage, 'button', '重试', 'dashboard retry after AI error', 1200);
  await capture(studentPage, '04-dashboard-ai-retry-state.png', 'dashboard AI retry state', {
    expected: 'Retry should either re-enter loading or clearly report persistent provider failure.',
  });
  await clickSelector(studentPage, '[data-global-ai-sidebar] button[title="清空对话"]', 'dashboard clear conversation', 800);
  await capture(studentPage, '05-dashboard-ai-cleared.png', 'dashboard AI cleared', {
    expected: 'Clear conversation should restore welcome/quick question state and announce the reset.',
  });

  await gotoStable(studentPage, '/knowledge?node=Bode图_1_1', 2600);
  await openGlobalAIFromDock(studentPage, 'knowledge open AI sidebar');
  await capture(studentPage, '06-knowledge-ai-degraded-context.png', 'knowledge AI degraded context', {
    expected: 'Knowledge deep link should expose degraded node context inside the AI sidebar.',
  });
  await sendGlobalAIQuestion(studentPage, '这个知识节点为什么没有解析？我应该怎么继续？', 'knowledge send degraded context question');
  await waitForAISettled(studentPage, 'knowledge wait for AI response');
  await capture(studentPage, '07-knowledge-ai-response-or-error.png', 'knowledge AI response or error', {
    expected: 'Knowledge AI response/error should preserve degraded context and recovery guidance.',
  });

  await gotoStable(studentPage, '/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation', 2600);
  await clickRole(studentPage, 'button', /打开控灵|控灵助手|呼出控灵 AI助手/, 'adaptive open AI/sidebar action', 1000);
  await capture(studentPage, '08-adaptive-path-ai-entry.png', 'adaptive path AI entry', {
    expected: 'Path generation surface should open AI with path-advisor context or explain why context is unavailable.',
  });
  await studentDesktop.context.close();

  const adminDesktop = await newPage('admin', desktop);
  const adminPage = adminDesktop.page;
  await gotoStable(adminPage, '/admin/data-governance');
  await openGlobalAIFromDock(adminPage, 'admin governance open AI sidebar');
  await sendGlobalAIQuestion(adminPage, '请总结当前数据治理风险优先级。', 'admin governance send AI question');
  await waitForAISettled(adminPage, 'admin governance wait for AI response');
  await capture(adminPage, '09-admin-governance-ai-response-or-error.png', 'admin governance AI response or error', {
    expected: 'Admin AI should distinguish governance context from student learning context and expose error status.',
  });
  await adminDesktop.context.close();

  const studentMobile = await newPage('student', mobile);
  const mobilePage = studentMobile.page;
  await gotoStable(mobilePage, '/dashboard');
  await openGlobalAIFromDock(mobilePage, 'mobile dashboard open AI sidebar');
  await capture(mobilePage, '10-mobile-dashboard-ai-initial.png', 'mobile dashboard AI initial', {
    expected: 'Mobile AI should behave as modal surface, keep input visible, and avoid background focus leakage.',
    focusTrail: await focusTrail(mobilePage, 8),
  });
  await sendGlobalAIQuestion(mobilePage, '请给我一个移动端下一步学习建议。', 'mobile dashboard send AI question');
  await waitForAISettled(mobilePage, 'mobile dashboard wait for AI response');
  await capture(mobilePage, '11-mobile-dashboard-ai-response-or-error.png', 'mobile dashboard AI response or error', {
    expected: 'Mobile AI response/error should keep controls reachable and announce completion.',
  });

  await gotoStable(mobilePage, '/knowledge?node=Bode图_1_1', 2600);
  await openGlobalAIFromDock(mobilePage, 'mobile knowledge open AI sidebar');
  await capture(mobilePage, '12-mobile-knowledge-ai-degraded-context.png', 'mobile knowledge AI degraded context', {
    expected: 'Mobile knowledge AI should preserve degraded node context without covering the whole page ambiguously.',
  });
  await studentMobile.context.close();

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png')).sort();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 'function-state-flows-batch42',
    scope: 'Global AI actual conversation and context states: dashboard, knowledge degraded node, adaptive path AI entry, admin governance AI, mobile AI input/response, API response status, focus and announcement semantics',
    routeResponses,
    apiResponses,
    results,
    optionalActions,
    errors,
    ignoredErrors,
    screenshotDir,
    pngFiles,
    summary: {
      resultCount: results.length,
      apiResponseCount: apiResponses.length,
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
    apiResponses: apiResponses.length,
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
