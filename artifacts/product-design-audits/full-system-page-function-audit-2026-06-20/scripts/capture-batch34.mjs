import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/69-function-state-flows-batch34');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch34-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
  admin: { account: 'admin', password: 'admin@Just' },
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
  routeResponses.push({
    route,
    status: response?.status?.() ?? null,
    requestedUrl: `${baseUrl}${route}`,
    finalUrl: page.url(),
    responseUrl: response?.url?.() ?? '',
  });
  await sleep(waitMs);
  return response;
}

function summarizeJson(body) {
  if (!body || typeof body !== 'object') return { type: typeof body };
  return {
    keys: Object.keys(body).slice(0, 24),
    role: body.user?.role || body.role || '',
    user: body.user ? {
      role: body.user.role,
      account: body.user.account || body.user.email || body.user.name || '',
    } : undefined,
    sampleText: JSON.stringify(body).slice(0, 1000),
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
      ariaControls: el.getAttribute('aria-controls') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      hidden: !visible(el),
    }));
    const dialogs = [...document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]')].map((el) => ({
      name: name(el),
      role: el.getAttribute('role') || '',
      modal: el.getAttribute('aria-modal') || '',
      labelledBy: el.getAttribute('aria-labelledby') || '',
      text: text(el).slice(0, 700),
    }));
    const statusRegions = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const inputs = [...document.querySelectorAll('input, textarea, select')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      value: 'value' in el ? String(el.value || '').slice(0, 80) : '',
      hidden: !visible(el),
    }));
    const shell = {
      mobileDrawerOpen: Boolean(document.querySelector('[data-app-shell-mobile-drawer="open"]')),
      floatingDock: document.querySelector('[data-platform-floating-dock]')?.getAttribute('data-platform-floating-dock') || '',
      floatingDockOpen: Boolean(document.querySelector('[data-platform-floating-dock-expanded-panel]')),
      aiSidebar: document.querySelector('[data-global-ai-sidebar]')?.getAttribute('data-global-ai-sidebar') || '',
      theme: document.documentElement.className,
      bodyDataTheme: document.body.getAttribute('data-theme') || '',
    };
    const bodyText = text(document.body).slice(0, 14000);
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      h2: [...document.querySelectorAll('h2')].map(text).filter(Boolean).slice(0, 16),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        role: active?.getAttribute?.('role') || '',
        name: name(active),
      },
      controls,
      dialogs,
      alerts: statusRegions,
      inputs,
      unnamedControls: controls.filter((item) => !item.hidden && !item.name && ['button', 'a'].includes(item.tag)).length,
      shell,
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
    firstControls: audit.controls.filter((item) => !item.hidden && !item.disabled).slice(0, 22),
    dialogs: audit.dialogs,
    alerts: audit.alerts,
    inputs: audit.inputs.filter((item) => !item.hidden).slice(0, 10),
    unnamedControls: audit.unnamedControls,
    shell: audit.shell,
    hits: {
      login: /登录|账号|密码/.test(body),
      unauthorized: /无权限|未授权|权限|禁止|Forbidden|Unauthorized/.test(body),
      redirectedHome: /工作台|学习总览|教师工作台|管理控制台/.test(body),
      userMenu: /个人中心|修改密码|退出登录/.test(body),
      passwordError: /请输入当前密码与新密码|密码/.test(body),
      theme: /深色|浅色|主题/.test(body),
      ai: /控灵|AI助手|提问|发送/.test(body),
      navigation: /导航|平台导航/.test(body),
      logout: /登录|退出/.test(body),
      liveRegion: audit.alerts.length > 0,
      dialogSemantics: audit.dialogs.length > 0,
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
  const url = new URL(audit.url);
  results.push({
    step: results.length + 1,
    label,
    route: url.pathname + url.search,
    screenshot: path.relative(root, filePath),
    screenshotBytes: stat.size,
    a11y: path.relative(root, a11yPath),
    notes,
    auditSummary: summarizeAudit(audit),
  });
}

async function clickFirst(page, selectors, actionLabel, waitMs = 1000) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      await locator.click().catch((error) => recordIgnoredError(actionLabel, error, page.url()));
      optionalActions.push({ action: actionLabel, selector, status: 'attempted', url: page.url() });
      await sleep(waitMs);
      return true;
    }
  }
  optionalActions.push({ action: actionLabel, selectors, status: 'not-found', url: page.url() });
  return false;
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
}

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const studentBoundary = await newPage(desktop, 'student');
  await fetchApi(studentBoundary.page, 'student auth session', '/api/auth/session', [200]);
  await gotoStable(studentBoundary.page, '/admin/users', 3000);
  await capture(studentBoundary.page, '01-student-admin-boundary-desktop.png', 'student admin permission boundary desktop', {
    expected: 'student entering admin users should see an explicit denied/redirect state and retain a safe return path',
  });
  await gotoStable(studentBoundary.page, '/teacher', 3000);
  await capture(studentBoundary.page, '02-student-teacher-boundary-desktop.png', 'student teacher permission boundary desktop', {
    expected: 'student entering teacher workspace should explain role mismatch instead of silently dropping context',
  });
  await studentBoundary.context.close();

  const teacherBoundary = await newPage(desktop, 'teacher');
  await fetchApi(teacherBoundary.page, 'teacher auth session', '/api/auth/session', [200]);
  await gotoStable(teacherBoundary.page, '/admin/data-governance', 3200);
  await capture(teacherBoundary.page, '03-teacher-admin-boundary-desktop.png', 'teacher admin permission boundary desktop', {
    expected: 'teacher entering admin governance should expose an explicit role boundary and return action',
  });
  await teacherBoundary.context.close();

  const adminBoundary = await newPage(desktop, 'admin');
  await fetchApi(adminBoundary.page, 'admin auth session', '/api/auth/session', [200]);
  await gotoStable(adminBoundary.page, '/teacher', 3200);
  await capture(adminBoundary.page, '04-admin-teacher-boundary-desktop.png', 'admin teacher permission boundary desktop', {
    expected: 'admin entering teacher workspace should clarify role boundary and keep admin return path',
  });
  await adminBoundary.context.close();

  const studentShell = await newPage(desktop, 'student');
  await gotoStable(studentShell.page, '/dashboard', 3600);
  await clickFirst(studentShell.page, ['div.relative.z-\\[70\\] > button', 'button:has-text("个人中心")'], 'open student user menu', 800);
  const userMenuTrail = await focusTrail(studentShell.page, 8);
  await capture(studentShell.page, '05-student-user-menu-open-desktop.png', 'student user menu open desktop', {
    expected: 'account menu should expose menu semantics, focus order, profile/password/logout grouping, and dismiss behavior',
    focusTrail: userMenuTrail,
  });
  await clickRole(studentShell.page, 'button', /修改密码/, 'open password modal from user menu', 800);
  await clickRole(studentShell.page, 'button', /确认修改/, 'submit empty password modal', 800);
  const passwordTrail = await focusTrail(studentShell.page, 8);
  await capture(studentShell.page, '06-student-password-empty-submit-desktop.png', 'student password empty submit desktop', {
    expected: 'password modal should be a real dialog with alert/status feedback after empty submit',
    focusTrail: passwordTrail,
  });
  await studentShell.context.close();

  const logoutShell = await newPage(desktop, 'student');
  await gotoStable(logoutShell.page, '/dashboard', 2600);
  await clickFirst(logoutShell.page, ['div.relative.z-\\[70\\] > button'], 'open logout user menu', 600);
  await clickRole(logoutShell.page, 'button', /退出登录/, 'click logout', 2200);
  await capture(logoutShell.page, '07-student-logout-redirect-desktop.png', 'student logout redirect desktop', {
    expected: 'logout should land on a clear login state without stale authenticated shell controls',
  });
  await logoutShell.context.close();

  const dockShell = await newPage(desktop, 'student');
  await gotoStable(dockShell.page, '/dashboard', 3600);
  await clickFirst(dockShell.page, ['[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]'], 'open floating dock menu', 900);
  const dockTrail = await focusTrail(dockShell.page, 10);
  await capture(dockShell.page, '08-dashboard-floating-dock-expanded-desktop.png', 'dashboard floating dock expanded desktop', {
    expected: 'global dock should expose page tools, theme, AI entry, menu role/state, and safe focus order',
    focusTrail: dockTrail,
  });
  await clickRole(dockShell.page, 'button', /深色|浅色|主题|切换/, 'toggle theme from floating dock', 1000);
  await clickFirst(dockShell.page, ['[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]'], 'reopen floating dock after theme toggle', 600);
  await capture(dockShell.page, '09-dashboard-theme-toggle-state-desktop.png', 'dashboard theme toggle state desktop', {
    expected: 'theme switch should make current theme and resulting state discoverable without relying only on color',
  });
  await clickRole(dockShell.page, 'button', /控灵|AI|助手|提问/, 'open AI sidebar from floating dock', 1200);
  const aiOpenTrail = await focusTrail(dockShell.page, 10);
  await capture(dockShell.page, '10-dashboard-ai-sidebar-open-desktop.png', 'dashboard AI sidebar open desktop', {
    expected: 'AI sidebar should behave as a modal or complementary region with close button, focus containment, and input semantics',
    focusTrail: aiOpenTrail,
  });
  await dockShell.page.keyboard.press('Escape');
  await sleep(900);
  const aiClosedTrail = await focusTrail(dockShell.page, 8);
  await capture(dockShell.page, '11-dashboard-ai-sidebar-esc-restore-desktop.png', 'dashboard AI sidebar escape restore desktop', {
    expected: 'ESC should close the AI sidebar and restore focus to the invoking dock control',
    focusTrail: aiClosedTrail,
  });
  await dockShell.context.close();

  const studentMobile = await newPage(mobile, 'student');
  await gotoStable(studentMobile.page, '/dashboard', 3600);
  await clickRole(studentMobile.page, 'button', /打开平台导航|导航/, 'open student mobile navigation drawer', 900);
  const studentMobileTrail = await focusTrail(studentMobile.page, 10);
  await capture(studentMobile.page, '12-student-mobile-navigation-drawer.png', 'student mobile navigation drawer', {
    expected: 'mobile app shell drawer should isolate background, trap focus, expose close action, and show current route',
    focusTrail: studentMobileTrail,
  });
  await studentMobile.context.close();

  const teacherMobile = await newPage(mobile, 'teacher');
  await gotoStable(teacherMobile.page, '/teacher', 3600);
  await clickRole(teacherMobile.page, 'button', /打开平台导航|导航/, 'open teacher mobile navigation drawer', 900);
  const teacherMobileTrail = await focusTrail(teacherMobile.page, 10);
  await capture(teacherMobile.page, '13-teacher-mobile-navigation-drawer.png', 'teacher mobile navigation drawer', {
    expected: 'teacher mobile navigation should keep class/session routes reachable and avoid conflict with floating dock controls',
    focusTrail: teacherMobileTrail,
  });
  await teacherMobile.context.close();
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
      batch: 'function-state-flows-batch34',
      scope: 'cross-role boundaries, user menu, password dialog, logout, floating dock, theme toggle, global AI sidebar, and mobile app shell navigation',
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
