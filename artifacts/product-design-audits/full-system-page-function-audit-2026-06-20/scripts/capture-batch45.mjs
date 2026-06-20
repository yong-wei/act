import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/80-function-state-flows-batch45');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch45-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };
const noMatchQuery = 'zzzz-no-match-audit-20260620';

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
  await sleep(1200);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2400);
  if (page.url().includes('/login')) {
    await page.locator('form button[type="submit"], button[type="submit"]').first().click().catch((error) => {
      recordIgnoredError(`login ${role} submit fallback`, error, page.url());
    });
    await sleep(2400);
  }
  const session = await page.evaluate(async () => {
    const res = await fetch('/api/auth/session').catch(() => null);
    return res?.ok ? res.json().catch(() => null) : null;
  }).catch(() => null);
  optionalActions.push({
    action: `login ${role}`,
    status: page.url().includes('/login') ? 'still-on-login' : 'submitted',
    sessionRole: session?.user?.role || '',
    sessionUser: session?.user?.name || session?.user?.email || '',
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

async function domAudit(page) {
  return await page.evaluate(() => {
    const text = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    const name = (el) => (
      el?.getAttribute?.('aria-label') ||
      el?.getAttribute?.('title') ||
      el?.getAttribute?.('placeholder') ||
      el?.getAttribute?.('alt') ||
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
    const controls = [...document.querySelectorAll('button, [role="button"], a[href], input, textarea, select, summary, [tabindex]:not([tabindex="-1"])')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      type: el.getAttribute('type') || '',
      name: name(el),
      value: el.value || '',
      href: el.getAttribute('href') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      hidden: !visible(el),
      inFloating: Boolean(el.closest('[data-page-floating-controls]')),
    }));
    const statusRegions = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const tables = [...document.querySelectorAll('table')].map((table) => ({
      headers: [...table.querySelectorAll('th')].map(text).filter(Boolean),
      rowCount: table.querySelectorAll('tbody tr').length,
      caption: text(table.querySelector('caption')),
    }));
    const cards = [...document.querySelectorAll('[data-card], article, li, .card, [class*="rounded"]')]
      .filter(visible)
      .map((el) => text(el).slice(0, 260))
      .filter(Boolean)
      .slice(0, 24);
    const active = document.activeElement;
    const bodyText = text(document.body);
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
      },
      controls,
      visibleControls: controls.filter((control) => !control.hidden).slice(0, 90),
      alerts: statusRegions,
      tables,
      cards,
      bodyText: bodyText.slice(0, 18000),
      listSignals: {
        tableCount: tables.length,
        tableRows: tables.reduce((sum, table) => sum + table.rowCount, 0),
        cardCount: cards.length,
        noMatch: /无匹配|暂无|没有|未找到|空|0 个|0条|0 条/.test(bodyText),
        reset: /重置|清除|全部|返回/.test(bodyText),
        pagination: /上一页|下一页|第 \\d+ 页|page|分页|共 \\d+/.test(bodyText),
        sort: /排序|按|最新|最近|更新时间|创建时间/.test(bodyText),
        filter: /筛选|搜索|全部|状态|类型|角色|班级/.test(bodyText),
      },
      scroll: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
    };
  });
}

function summarizeAudit(audit) {
  return {
    h1: audit.h1,
    h2: audit.h2,
    activeElement: audit.activeElement,
    alerts: audit.alerts,
    tables: audit.tables,
    visibleControls: audit.visibleControls,
    listSignals: audit.listSignals,
    scroll: audit.scroll,
    hits: {
      searchValueVisible: audit.visibleControls.some((control) => control.value?.includes('zzzz') || control.name?.includes('zzzz')),
      noMatch: audit.listSignals.noMatch,
      reset: audit.listSignals.reset,
      pagination: audit.listSignals.pagination,
      status: audit.alerts.length > 0 || /加载|成功|失败|完成|正在|暂无|无匹配/.test(audit.bodyText),
      floating: audit.controls.some((control) => control.inFloating && !control.hidden),
      horizontalOverflow: audit.scroll.width > audit.scroll.viewportWidth + 8,
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

async function captureRoute(page, route, fileName, label, waitMs = 1800, notes = {}) {
  await gotoStable(page, route, waitMs);
  await capture(page, fileName, label, { requestedRoute: route, ...notes });
}

async function fillFirstSearch(page, action, query = noMatchQuery) {
  const candidates = page.locator('input:not([type="file"]):not([type="hidden"]), textarea');
  const count = await candidates.count().catch(() => 0);
  let input = null;
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const box = await candidate.boundingBox().catch(() => null);
    if (!box || box.width < 4 || box.height < 4) continue;
    const meta = await candidate.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true' || el.readOnly),
        display: style.display,
        visibility: style.visibility,
        type: el.getAttribute('type') || '',
        name: el.getAttribute('name') || '',
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || '',
      };
    }).catch(() => null);
    if (!meta || meta.disabled || meta.display === 'none' || meta.visibility === 'hidden') continue;
    const searchableText = `${meta.type} ${meta.name} ${meta.placeholder} ${meta.ariaLabel} ${meta.title}`;
    if (!/(search|query|\bq\b|搜索|查找|关键词|名称|班级|资源|历史|用户|账号|邮箱|工号|学号)/i.test(searchableText)) continue;
    input = candidate;
    break;
  }
  if (!input) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  try {
    await input.fill(query);
  } catch (error) {
    recordIgnoredError(action, error, page.url());
    optionalActions.push({ action, status: 'fill-failed', query, url: page.url() });
    return false;
  }
  await sleep(1200);
  optionalActions.push({ action, status: 'filled', query, url: page.url() });
  return true;
}

async function clickByName(page, name, action, waitMs = 1000) {
  const locator = page.getByRole('button', { name }).first();
  if (!(await locator.count())) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  await locator.click({ timeout: 1800 }).catch((error) => {
    recordIgnoredError(action, error, page.url());
  });
  await sleep(waitMs);
  optionalActions.push({ action, status: 'attempted', url: page.url() });
  return true;
}

async function apiCheck(context, label, route) {
  const response = await context.request.get(`${baseUrl}${route}`).catch((error) => {
    recordError(`api ${label}`, error, route);
    return null;
  });
  if (!response) return;
  const body = await response.text().catch(() => '');
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  apiChecks.push({
    label,
    route,
    status: response.status(),
    ok: response.ok(),
    contentType: response.headers()['content-type'] || '',
    summary: body.replace(/\s+/g, ' ').slice(0, 1800),
    parsedSummary: parsed && typeof parsed === 'object' ? {
      total: parsed.total,
      count: Array.isArray(parsed) ? parsed.length : undefined,
      users: Array.isArray(parsed.users) ? parsed.users.length : undefined,
      items: Array.isArray(parsed.items) ? parsed.items.length : undefined,
      data: Array.isArray(parsed.data) ? parsed.data.length : undefined,
    } : null,
  });
}

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const studentContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const student = await studentContext.newPage();
  await login(student, 'student');
  await captureRoute(student, '/missions', '01-student-missions-default.png', 'student missions default list');
  await fillFirstSearch(student, 'student missions search no match');
  await capture(student, '02-student-missions-search-no-match.png', 'student missions search no match');
  await gotoStable(student, '/profile/evidence', 1400);
  await fillFirstSearch(student, 'student evidence search no match');
  await capture(student, '03-student-evidence-search-or-filter-state.png', 'student evidence search or filter state');
  await studentContext.close();

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  await captureRoute(teacher, '/teacher/classes', '04-teacher-classes-default.png', 'teacher classes default list');
  await fillFirstSearch(teacher, 'teacher classes search no match');
  await capture(teacher, '05-teacher-classes-search-no-match.png', 'teacher classes search no match');
  await captureRoute(teacher, '/teacher/lesson-plans', '06-teacher-lesson-plans-default.png', 'teacher lesson plans default list');
  await fillFirstSearch(teacher, 'teacher lesson plans search no match');
  await capture(teacher, '07-teacher-lesson-plans-search-no-match.png', 'teacher lesson plans search no match');
  await captureRoute(teacher, '/teacher/resources', '08-teacher-resources-default.png', 'teacher resources default list');
  await fillFirstSearch(teacher, 'teacher resources search no match');
  await capture(teacher, '09-teacher-resources-search-no-match.png', 'teacher resources search no match');
  await captureRoute(teacher, '/teacher/history', '10-teacher-history-default.png', 'teacher history default list');
  await fillFirstSearch(teacher, 'teacher history search no match');
  await capture(teacher, '11-teacher-history-search-no-match.png', 'teacher history search no match');
  await apiCheck(teacherContext, 'teacher classes API', '/api/teacher/classes');
  await apiCheck(teacherContext, 'teacher lesson plans API', '/api/lesson-plans');
  await teacherContext.close();

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await captureRoute(admin, '/admin/users', '12-admin-users-default.png', 'admin users default list');
  await fillFirstSearch(admin, 'admin users search no match');
  await capture(admin, '13-admin-users-search-no-match.png', 'admin users search no match');
  await clickByName(admin, /教师|TEACHER/i, 'admin users role filter teacher');
  await capture(admin, '14-admin-users-role-filter-state.png', 'admin users role filter state');
  await captureRoute(admin, '/admin/lesson-plans', '15-admin-lesson-plans-default.png', 'admin lesson plans default list');
  await fillFirstSearch(admin, 'admin lesson plans search no match');
  await capture(admin, '16-admin-lesson-plans-search-no-match.png', 'admin lesson plans search no match');
  await apiCheck(adminContext, 'admin users no match API', `/api/admin/users?page=1&pageSize=12&q=${encodeURIComponent(noMatchQuery)}`);
  await adminContext.close();

  const teacherMobileContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true });
  const teacherMobile = await teacherMobileContext.newPage();
  await login(teacherMobile, 'teacher');
  await captureRoute(teacherMobile, '/teacher/resources', '17-mobile-teacher-resources-default.png', 'mobile teacher resources default');
  await fillFirstSearch(teacherMobile, 'mobile teacher resources search no match');
  await capture(teacherMobile, '18-mobile-teacher-resources-search-no-match.png', 'mobile teacher resources search no match');
  await teacherMobileContext.close();

  const adminMobileContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true });
  const adminMobile = await adminMobileContext.newPage();
  await login(adminMobile, 'admin');
  await captureRoute(adminMobile, '/admin/users', '19-mobile-admin-users-default.png', 'mobile admin users default');
  await fillFirstSearch(adminMobile, 'mobile admin users search no match');
  await capture(adminMobile, '20-mobile-admin-users-search-no-match.png', 'mobile admin users search no match');
  await adminMobileContext.close();

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'cross-role list search, filters, no-match states, pagination signals, status/live coverage, mobile overflow',
    noMatchQuery,
    screenshotDir: path.relative(root, screenshotDir),
    results,
    routeResponses,
    apiChecks,
    optionalActions,
    errors,
    ignoredErrors,
    pngCount: pngFiles.length,
    jsonCount: jsonFiles.length,
  }, null, 2));
  console.log(JSON.stringify({
    manifestPath,
    screenshotDir,
    results: results.length,
    routeResponses: routeResponses.length,
    apiChecks: apiChecks.length,
    optionalActions: optionalActions.length,
    errors: errors.length,
    ignoredErrors: ignoredErrors.length,
    pngCount: pngFiles.length,
  }, null, 2));
}

main()
  .catch((error) => {
    recordError('main', error);
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {});
  });
