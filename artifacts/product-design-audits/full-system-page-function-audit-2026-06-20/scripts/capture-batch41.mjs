import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/76-function-state-flows-batch41');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch41-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: 'test_teacher', password: 'TestTeacher@Just2026!' },
  admin: { account: 'admin', password: 'admin@Just' },
};

const results = [];
const routeResponses = [];
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
  const accountInput = page.locator('form input[name="account"]').first();
  const passwordInput = page.locator('form input[name="password"]').first();
  await accountInput.fill(account.account);
  await passwordInput.fill(account.password);
  await page.locator('form button[type="submit"]').first().click();
  await sleep(2400);
  optionalActions.push({
    action: `login ${role}`,
    status: page.url().includes('/login') ? 'still-on-login' : 'submitted',
    url: page.url(),
  });
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

async function clickRole(page, role, name, actionLabel, waitMs = 900) {
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

async function clickSelector(page, selector, actionLabel, waitMs = 900) {
  const locator = page.locator(selector).first();
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', selector, url: page.url() });
    return false;
  }
  await locator.click().catch((error) => recordIgnoredError(actionLabel, error, page.url()));
  optionalActions.push({ action: actionLabel, status: 'attempted', selector, url: page.url() });
  await sleep(waitMs);
  return true;
}

async function openFloatingDock(page, label = 'open floating dock') {
  return clickSelector(page, '[data-page-floating-controls] button[data-platform-floating-dock-trigger-label]', label, 800);
}

async function openGlobalAIFromDock(page, label = 'open global AI from dock') {
  const opened = await openFloatingDock(page, `${label}: open dock first`);
  if (!opened) return false;
  return clickRole(page, 'button', /呼出控灵 AI助手|控灵 AI助手/, label, 1200);
}

async function toggleThemeFromDock(page, label = 'toggle theme from dock') {
  const opened = await openFloatingDock(page, `${label}: open dock first`);
  if (!opened) return false;
  return clickRole(page, 'button', '主题切换', label, 900);
}

async function closeWithEscape(page, label = 'close with escape', waitMs = 500) {
  await page.keyboard.press('Escape').catch((error) => recordIgnoredError(label, error, page.url()));
  optionalActions.push({ action: label, status: 'attempted', url: page.url() });
  await sleep(waitMs);
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
      !el ||
      el.hidden ||
      el.closest('[hidden]') ||
      getComputedStyle(el).display === 'none' ||
      getComputedStyle(el).visibility === 'hidden'
    );
    const rectOf = (el) => {
      if (!el || !visible(el)) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      };
    };
    const active = document.activeElement;
    const controls = [...document.querySelectorAll('button, [role="button"], a[href], input, textarea, select, summary, [tabindex]:not([tabindex="-1"])')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      name: name(el),
      type: el.getAttribute('type') || '',
      href: el.getAttribute('href') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      expanded: el.getAttribute('aria-expanded') || '',
      controls: el.getAttribute('aria-controls') || '',
      current: el.getAttribute('aria-current') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      hidden: !visible(el),
    }));
    const alerts = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const floating = document.querySelector('[data-page-floating-controls]');
    const floatingPanel = document.querySelector('[data-platform-floating-dock-expanded-panel]');
    const aiSidebar = document.querySelector('[data-global-ai-sidebar]');
    const mobileDrawer = document.querySelector('[data-app-shell-mobile-drawer]');
    const main = document.querySelector('main');
    const bodyText = text(document.body).slice(0, 24000);
    const floatingRect = rectOf(floating);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const floatingCenterHit = floatingRect
      ? document.elementFromPoint(
          Math.min(viewport.width - 1, Math.max(0, floatingRect.x + floatingRect.width / 2)),
          Math.min(viewport.height - 1, Math.max(0, floatingRect.y + floatingRect.height / 2)),
        )
      : null;
    const bottomRightHits = [
      [viewport.width - 48, viewport.height - 48],
      [viewport.width - 72, viewport.height - 96],
      [viewport.width - 120, viewport.height - 72],
    ].map(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return {
        x,
        y,
        tag: el?.tagName?.toLowerCase() || '',
        name: name(el),
        dataFloating: Boolean(el?.closest?.('[data-page-floating-controls]')),
        dataAi: Boolean(el?.closest?.('[data-global-ai-sidebar]')),
        className: typeof el?.className === 'string' ? el.className.slice(0, 160) : '',
      };
    });
    return {
      title: document.title,
      url: location.href,
      themeClass: document.documentElement.className,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 10),
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 50),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        role: active?.getAttribute?.('role') || '',
        name: name(active),
        inFloating: Boolean(active?.closest?.('[data-page-floating-controls]')),
        inAiSidebar: Boolean(active?.closest?.('[data-global-ai-sidebar]')),
        inMobileDrawer: Boolean(active?.closest?.('[data-app-shell-mobile-drawer]')),
      },
      controls,
      alerts,
      unnamedControls: controls.filter((item) => !item.hidden && !item.name && ['button', 'a'].includes(item.tag)).length,
      bodyText,
      geometry: {
        floatingRect,
        floatingPanelRect: rectOf(floatingPanel),
        aiSidebarRect: rectOf(aiSidebar),
        mobileDrawerRect: rectOf(mobileDrawer),
        mainRect: rectOf(main),
        floatingCenterHit: floatingCenterHit ? {
          tag: floatingCenterHit.tagName.toLowerCase(),
          name: name(floatingCenterHit),
          inFloating: Boolean(floatingCenterHit.closest('[data-page-floating-controls]')),
        } : null,
        bottomRightHits,
      },
      markers: {
        routeFrame: main?.getAttribute('data-platform-route-frame') || '',
        desktopNavigation: main?.getAttribute('data-platform-desktop-navigation') || '',
        mobileNavigation: main?.getAttribute('data-platform-mobile-navigation') || '',
        floatingBehavior: main?.getAttribute('data-platform-floating-dock-behavior') || '',
        floatingCollisionPolicy: main?.getAttribute('data-platform-floating-dock-collision-policy') || '',
        floatingMobileBehavior: main?.getAttribute('data-platform-floating-dock-mobile-behavior') || '',
        appShellLayout: document.querySelector('[data-app-shell-layout]')?.getAttribute('data-app-shell-layout') || '',
        appShellNavigationState: document.querySelector('[data-app-shell-navigation-state]')?.getAttribute('data-app-shell-navigation-state') || '',
        shellNavigationStates: [...document.querySelectorAll('[data-shell-navigation-state]')].map((el) => el.getAttribute('data-shell-navigation-state') || ''),
        mobileDrawerOpen: Boolean(mobileDrawer),
        mobileDrawerRole: mobileDrawer?.getAttribute('role') || '',
        mobileDrawerModal: mobileDrawer?.getAttribute('aria-modal') || '',
        floatingDockVisible: Boolean(floating && visible(floating)),
        floatingDockAttr: floating?.getAttribute('data-platform-floating-dock') || '',
        floatingSafeArea: floating?.getAttribute('data-platform-floating-dock-safe-area') || '',
        floatingTriggerLabel: document.querySelector('[data-page-floating-controls] button[data-platform-floating-dock-trigger-label]')?.getAttribute('data-platform-floating-dock-trigger-label') || '',
        floatingTriggerExpanded: document.querySelector('[data-page-floating-controls] button[data-platform-floating-dock-trigger-label]')?.getAttribute('aria-expanded') || '',
        floatingPanelOpen: Boolean(floatingPanel && visible(floatingPanel)),
        floatingPanelRole: floatingPanel?.getAttribute('role') || '',
        floatingPanelButtons: [...document.querySelectorAll('[data-platform-floating-dock-expanded-panel] button')].map((el) => ({
          name: name(el),
          disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
        })),
        aiSidebarState: aiSidebar?.getAttribute('data-global-ai-sidebar') || '',
        aiSidebarRole: aiSidebar?.getAttribute('role') || '',
        aiSidebarSurface: aiSidebar?.getAttribute('data-konling-assistant-surface') || '',
        aiSidebarAvoidance: aiSidebar?.getAttribute('data-konling-inspector-avoidance') || '',
        knowledgeInspector: Boolean(document.querySelector('[data-knowledge-inspector]')),
        simulationCollisionPolicy: document.querySelector('[data-simulation-dock-collision-policy]')?.getAttribute('data-simulation-dock-collision-policy') || '',
        adaptiveDockPolicy: document.querySelector('[data-adaptive-path-dock-collision-policy]')?.getAttribute('data-adaptive-path-dock-collision-policy') || '',
      },
    };
  });
}

async function focusTrail(page, count = 12) {
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
        href: el?.getAttribute?.('href') || '',
        inFloating: Boolean(el?.closest?.('[data-page-floating-controls]')),
        inAiSidebar: Boolean(el?.closest?.('[data-global-ai-sidebar]')),
        inMobileDrawer: Boolean(el?.closest?.('[data-app-shell-mobile-drawer]')),
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
    themeClass: audit.themeClass,
    activeElement: audit.activeElement,
    firstControls: audit.controls.filter((item) => !item.hidden && !item.disabled).slice(0, 42),
    alerts: audit.alerts,
    unnamedControls: audit.unnamedControls,
    geometry: audit.geometry,
    markers: audit.markers,
    hits: {
      appShell: /学习工作台|教师工作台|管理员|平台导航|自适应学习路径|虚拟仿真|知识资源|竞技场/.test(body),
      floatingDock: audit.markers.floatingDockVisible,
      floatingPanelOpen: audit.markers.floatingPanelOpen,
      aiSidebarOpen: audit.markers.aiSidebarState === 'open',
      mobileDrawerOpen: audit.markers.mobileDrawerOpen,
      statusRegion: audit.alerts.length > 0,
      themeToggleText: /主题切换|浅色|深色/.test(body),
      drawerSemantic: audit.markers.mobileDrawerRole === 'dialog' && audit.markers.mobileDrawerModal === 'true',
      floatingPanelHasNoRole: audit.markers.floatingPanelOpen && !audit.markers.floatingPanelRole,
      aiSidebarHasNoRole: audit.markers.aiSidebarState === 'open' && !audit.markers.aiSidebarRole,
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

  const studentDesktop = await newPage('student', desktop);
  const studentPage = studentDesktop.page;
  await gotoStable(studentPage, '/dashboard');
  await capture(studentPage, '01-student-dashboard-shell-default.png', 'student dashboard shell default', {
    expected: 'Student dashboard should expose AppShell navigation, theme control, and shared floating dock without stealing the first task focus.',
    focusTrail: await focusTrail(studentPage, 12),
  });
  await openFloatingDock(studentPage, 'student dashboard open floating dock');
  await capture(studentPage, '02-student-dashboard-floating-dock-open.png', 'student dashboard floating dock open', {
    expected: 'Floating dock expanded panel should have clear semantics, focus order, and non-overlapping placement.',
  });
  await closeWithEscape(studentPage, 'student dashboard close floating dock');
  await openGlobalAIFromDock(studentPage, 'student dashboard open global AI sidebar');
  await capture(studentPage, '03-student-dashboard-ai-sidebar-open.png', 'student dashboard global AI sidebar open', {
    expected: 'AI sidebar should expose complementary/dialog semantics, focus containment, and return focus to the trigger on Escape.',
    focusTrail: await focusTrail(studentPage, 8),
  });
  await closeWithEscape(studentPage, 'student dashboard close AI sidebar');
  await capture(studentPage, '04-student-dashboard-after-ai-close.png', 'student dashboard after AI sidebar close', {
    expected: 'Escape should close AI sidebar and restore focus to the floating dock trigger.',
  });
  await toggleThemeFromDock(studentPage, 'student dashboard toggle theme from dock');
  await capture(studentPage, '05-student-dashboard-theme-toggled.png', 'student dashboard theme toggled from dock', {
    expected: 'Theme toggle should visibly switch theme and communicate completion or current mode.',
  });

  await gotoStable(studentPage, '/knowledge?node=Bode图_1_1', 3200);
  await openFloatingDock(studentPage, 'knowledge page open dock beside inspector');
  await capture(studentPage, '06-student-knowledge-floating-dock-inspector.png', 'student knowledge dock beside inspector', {
    expected: 'Knowledge graph dock should avoid stable inspector rail and explain selected/degraded node context.',
  });
  await closeWithEscape(studentPage, 'knowledge close floating dock');
  await openGlobalAIFromDock(studentPage, 'knowledge open global AI sidebar');
  await capture(studentPage, '07-student-knowledge-ai-sidebar-open.png', 'student knowledge AI sidebar open', {
    expected: 'Knowledge AI sidebar should not cover stable inspector on desktop and should expose degraded node context.',
  });
  await studentDesktop.context.close();

  const teacherDesktop = await newPage('teacher', desktop);
  const teacherPage = teacherDesktop.page;
  await gotoStable(teacherPage, '/teacher');
  await openFloatingDock(teacherPage, 'teacher dashboard open floating dock');
  await capture(teacherPage, '08-teacher-dashboard-floating-dock-open.png', 'teacher dashboard floating dock open', {
    expected: 'Teacher cockpit floating dock should not obscure operational actions and should expose menu semantics.',
    focusTrail: await focusTrail(teacherPage, 10),
  });
  await teacherDesktop.context.close();

  const adminDesktop = await newPage('admin', desktop);
  const adminPage = adminDesktop.page;
  await gotoStable(adminPage, '/admin/data-governance');
  await openFloatingDock(adminPage, 'admin data governance open floating dock');
  await capture(adminPage, '09-admin-data-governance-floating-dock-open.png', 'admin data governance floating dock open', {
    expected: 'Admin governance dock should not cover export/remediation commands and should expose state semantics.',
    focusTrail: await focusTrail(adminPage, 10),
  });
  await adminDesktop.context.close();

  const studentMobile = await newPage('student', mobile);
  const mobileStudentPage = studentMobile.page;
  await gotoStable(mobileStudentPage, '/arena');
  await capture(mobileStudentPage, '10-mobile-arena-drawer-default.png', 'mobile arena drawer default', {
    expected: 'Arena mobile route should expose a single drawer navigation trigger and not duplicate top navigation.',
    focusTrail: await focusTrail(mobileStudentPage, 8),
  });
  await clickRole(mobileStudentPage, 'button', '打开平台导航', 'mobile arena open app shell drawer', 900);
  await capture(mobileStudentPage, '11-mobile-arena-drawer-open.png', 'mobile arena drawer open', {
    expected: 'Mobile AppShell drawer should have dialog semantics, focus trap, and background inertness.',
    focusTrail: await focusTrail(mobileStudentPage, 10),
  });
  await closeWithEscape(mobileStudentPage, 'mobile arena close drawer');

  await gotoStable(mobileStudentPage, '/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation');
  await capture(mobileStudentPage, '12-mobile-adaptive-path-shell-default.png', 'mobile adaptive path shell default', {
    expected: 'Adaptive path mobile shell should place dock outside learning record and primary generation controls.',
    focusTrail: await focusTrail(mobileStudentPage, 10),
  });
  await openFloatingDock(mobileStudentPage, 'mobile adaptive path open floating dock');
  await capture(mobileStudentPage, '13-mobile-adaptive-path-floating-dock-open.png', 'mobile adaptive path floating dock open', {
    expected: 'Mobile adaptive path floating dock should not cover current recommendation, inputs, or primary generation action.',
  });
  await closeWithEscape(mobileStudentPage, 'mobile adaptive close floating dock');

  await gotoStable(mobileStudentPage, '/dashboard');
  await openGlobalAIFromDock(mobileStudentPage, 'mobile dashboard open global AI sidebar');
  await capture(mobileStudentPage, '14-mobile-dashboard-ai-sidebar-open.png', 'mobile dashboard AI sidebar open', {
    expected: 'Mobile AI sidebar should behave as a modal surface with clear close path and background containment.',
    focusTrail: await focusTrail(mobileStudentPage, 8),
  });
  await closeWithEscape(mobileStudentPage, 'mobile dashboard close AI sidebar');
  await capture(mobileStudentPage, '15-mobile-dashboard-after-ai-close.png', 'mobile dashboard after AI sidebar close', {
    expected: 'Mobile AI sidebar Escape should restore focus to the launch control and keep the dock from covering main tasks.',
  });
  await studentMobile.context.close();

  const adminMobile = await newPage('admin', mobile);
  const mobileAdminPage = adminMobile.page;
  await gotoStable(mobileAdminPage, '/admin/users');
  await capture(mobileAdminPage, '16-mobile-admin-users-shell-default.png', 'mobile admin users shell default', {
    expected: 'Admin mobile shell should keep navigation, search/import actions, and floating tools separated.',
    focusTrail: await focusTrail(mobileAdminPage, 10),
  });
  await openFloatingDock(mobileAdminPage, 'mobile admin users open floating dock');
  await capture(mobileAdminPage, '17-mobile-admin-users-floating-dock-open.png', 'mobile admin users floating dock open', {
    expected: 'Mobile admin floating dock should not cover search, import, batch operations, or table controls.',
  });
  await adminMobile.context.close();

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png')).sort();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 'function-state-flows-batch41',
    scope: 'Global AppShell, shared floating dock, Global AI sidebar, theme toggle, mobile drawer navigation, focus restoration, safe-area and status semantics across student, teacher, and admin routes',
    routeResponses,
    results,
    optionalActions,
    errors,
    ignoredErrors,
    screenshotDir,
    pngFiles,
    summary: {
      resultCount: results.length,
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
