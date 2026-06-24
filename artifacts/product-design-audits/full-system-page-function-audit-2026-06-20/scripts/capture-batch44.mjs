import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/79-function-state-flows-batch44');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch44-manifest.json');
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
  return session?.user?.role || '';
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
      href: el.getAttribute('href') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      hidden: !visible(el),
      inFloating: Boolean(el.closest('[data-page-floating-controls]')),
    }));
    const statusRegions = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const main = document.querySelector('main');
    const active = document.activeElement;
    const bodyText = text(document.body);
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 24),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        role: active?.getAttribute?.('role') || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
      },
      controls,
      visibleControls: controls.filter((control) => !control.hidden).slice(0, 80),
      alerts: statusRegions,
      mainText: text(main).slice(0, 4000),
      bodyText: bodyText.slice(0, 14000),
      errorSignals: {
        nextNotFound: bodyText.includes('This page could not be found'),
        notFoundZh: /未找到|不存在|找不到|无效|已失效|无法访问|没有权限/.test(bodyText),
        classNotFound: bodyText.includes('Class not found'),
        loginRedirect: location.pathname === '/login',
        dashboardRedirect: location.pathname === '/dashboard',
        adminRedirect: location.pathname === '/admin',
        homeRedirect: location.pathname === '/',
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
  const allText = `${audit.bodyText} ${audit.controls.map((item) => item.name).join(' ')}`;
  return {
    h1: audit.h1,
    h2: audit.h2,
    activeElement: audit.activeElement,
    alerts: audit.alerts,
    visibleControls: audit.visibleControls,
    errorSignals: audit.errorSignals,
    scroll: audit.scroll,
    hits: {
      notFound: audit.errorSignals.nextNotFound || audit.errorSignals.notFoundZh || audit.errorSignals.classNotFound,
      permission: /没有权限|无权|请登录|登录|403|Unauthorized|Forbidden/.test(allText),
      recovery: /返回|回到|重试|重新|首页|工作台|列表|课程|班级|Dashboard|登录/.test(allText),
      diagnostic: /id|ID|session|class|publication|task|slug|参数|错误码|404|500/.test(allText),
      status: audit.alerts.length > 0 || /成功|失败|错误|正在|已|未找到|不存在|无效/.test(allText),
      floating: audit.controls.some((control) => control.inFloating && !control.hidden),
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

async function apiCheck(context, label, route, acceptedStatuses = [200]) {
  const response = await context.request.get(`${baseUrl}${route}`).catch((error) => {
    recordError(`api ${label}`, error, route);
    return null;
  });
  if (!response) return;
  const contentType = response.headers()['content-type'] || '';
  const body = await response.text().catch(() => '');
  apiChecks.push({
    label,
    route,
    status: response.status(),
    ok: response.ok(),
    accepted: acceptedStatuses.includes(response.status()),
    contentType,
    summary: body.replace(/\s+/g, ' ').slice(0, 1400),
  });
}

async function captureRoute(page, route, fileName, label, waitMs = 1800, notes = {}) {
  await gotoStable(page, route, waitMs);
  await capture(page, fileName, label, { requestedRoute: route, ...notes });
}

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const visitorContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const visitor = await visitorContext.newPage();
  await captureRoute(visitor, '/this-route-does-not-exist', '01-public-not-found-desktop.png', 'public unknown route not found');
  await visitorContext.close();

  const studentContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const student = await studentContext.newPage();
  await login(student, 'student');
  await captureRoute(student, '/interactive-learning/resources/not-a-real-resource', '02-student-invalid-resource.png', 'student invalid interactive resource');
  await captureRoute(student, '/interactive-learning/courses/not-a-real-course', '03-student-invalid-course.png', 'student invalid course route');
  await captureRoute(student, '/simulations/not-a-real-simulation', '04-student-invalid-simulation.png', 'student invalid simulation route');
  await captureRoute(student, '/arena/challenges/not-a-real-task', '05-student-invalid-arena-task.png', 'student invalid arena task');
  await captureRoute(student, '/playlists/not-a-real-playlist/play', '06-student-invalid-playlist-play.png', 'student invalid playlist play');
  await captureRoute(student, '/profile/evidence?lessonId=not-a-real-lesson', '07-student-evidence-invalid-lesson-filter.png', 'student evidence invalid lesson filter');
  await captureRoute(student, '/assessment/adaptive-practice?goal=control-correction&pathId=not-a-real-path&nodeId=not-a-real-node&intent=path-execution', '08-student-invalid-adaptive-path-context.png', 'student invalid adaptive path context');
  await apiCheck(studentContext, 'invalid latest learning path goal', '/api/learning-paths/latest?goal=not-a-real-goal', [400, 404]);
  await studentContext.close();

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  await captureRoute(teacher, '/teacher/classes/not-a-real-class', '09-teacher-invalid-class-detail.png', 'teacher invalid class detail');
  await captureRoute(teacher, '/teacher/classes/not-a-real-class/analytics-v2', '10-teacher-invalid-class-analytics.png', 'teacher invalid class analytics');
  await captureRoute(teacher, '/teacher/classes/cmma7g0590004g9q2nl2jyzdf/students/not-a-real-student', '11-teacher-invalid-student-insight.png', 'teacher invalid student insight');
  await captureRoute(teacher, '/teacher/lesson-plans/not-a-real-plan/edit', '12-teacher-invalid-lesson-plan-edit.png', 'teacher invalid lesson plan edit');
  await captureRoute(teacher, '/teacher/arena/publications/not-a-real-publication', '13-teacher-invalid-arena-publication.png', 'teacher invalid arena publication report');
  await captureRoute(teacher, '/classroom/teacher/not-a-real-session/review', '14-teacher-invalid-classroom-review.png', 'teacher invalid classroom review');
  await apiCheck(teacherContext, 'invalid class insights', '/api/teacher/classes/not-a-real-class/insights', [400, 403, 404, 500]);
  await apiCheck(teacherContext, 'invalid control correction report', '/api/teacher/classes/not-a-real-class/control-correction-report?export=true', [400, 403, 404, 500]);
  await teacherContext.close();

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await captureRoute(admin, '/admin/lesson-plans/not-a-real-plan/edit', '15-admin-invalid-lesson-plan-edit.png', 'admin invalid lesson plan edit');
  await apiCheck(adminContext, 'admin invalid user search', '/api/admin/users?page=1&pageSize=12&q=not-a-real-user-zzzz', [200]);
  await adminContext.close();

  const studentMobileContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true });
  const studentMobile = await studentMobileContext.newPage();
  await login(studentMobile, 'student');
  await captureRoute(studentMobile, '/interactive-learning/resources/not-a-real-resource', '16-mobile-student-invalid-resource.png', 'mobile student invalid resource');
  await studentMobileContext.close();

  const teacherMobileContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true });
  const teacherMobile = await teacherMobileContext.newPage();
  await login(teacherMobile, 'teacher');
  await captureRoute(teacherMobile, '/teacher/classes/not-a-real-class', '17-mobile-teacher-invalid-class.png', 'mobile teacher invalid class');
  await teacherMobileContext.close();

  const adminMobileContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true });
  const adminMobile = await adminMobileContext.newPage();
  await login(adminMobile, 'admin');
  await captureRoute(adminMobile, '/admin/lesson-plans/not-a-real-plan/edit', '18-mobile-admin-invalid-lesson-plan.png', 'mobile admin invalid lesson plan');
  await adminMobileContext.close();

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'invalid deep links, stale object routes, recovery affordances, status/live coverage, mobile overflow',
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
