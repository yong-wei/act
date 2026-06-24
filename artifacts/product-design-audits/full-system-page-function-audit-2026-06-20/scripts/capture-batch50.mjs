import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/86-function-state-flows-batch50-path-report-governance-regression');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch50-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile390 = { width: 390, height: 844 };
const mobile320 = { width: 320, height: 844 };
const classId = 'cmma7g0590004g9q2nl2jyzdf';

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
  admin: { account: 'admin', password: 'admin@Just' },
};

const results = [];
const routeResponses = [];
const apiChecks = [];
const optionalActions = [];
const downloadEvents = [];
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
    const response = await fetch('/api/auth/session').catch(() => null);
    return response?.ok ? response.json().catch(() => null) : null;
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
      inDialog: Boolean(el.closest('[role="dialog"], [aria-modal="true"]')),
      inFloating: Boolean(el.closest('[data-page-floating-controls]')),
    }));
    const statusRegions = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const dialogs = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].map((el) => ({
      role: el.getAttribute('role') || '',
      modal: el.getAttribute('aria-modal') || '',
      name: name(el).slice(0, 240),
    }));
    const bodyText = text(document.body);
    const active = document.activeElement;
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 35),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        role: active?.getAttribute?.('role') || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
      },
      visibleControls: controls.filter((control) => !control.hidden).slice(0, 150),
      controls,
      alerts: statusRegions,
      dialogs,
      tables: [...document.querySelectorAll('table')].map((table) => ({
        headers: [...table.querySelectorAll('th')].map(text).filter(Boolean),
        rowCount: table.querySelectorAll('tbody tr').length,
        caption: text(table.querySelector('caption')),
      })),
      bodyText: bodyText.slice(0, 22000),
      actionSignals: {
        success: /成功|已保存|已提交|已完成|完成|已复制|已下载|导出完成|生成完成/.test(bodyText),
        loading: /加载|生成中|提交中|处理中|正在|等待|排队/.test(bodyText),
        failure: /失败|错误|异常|无法|不可用|未找到|无权限|重试/.test(bodyText),
        report: /报告|导出|发送|复制|下载|评分|复盘|补强|账本/.test(bodyText),
        governance: /治理|风险|处置|分派|标记|撤销|审计|证据源|质量/.test(bodyText),
        adaptive: /路径|推荐|作答|练习|证据|节点|完成/.test(bodyText),
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
    dialogs: audit.dialogs,
    tables: audit.tables,
    visibleControls: audit.visibleControls,
    actionSignals: audit.actionSignals,
    scroll: audit.scroll,
    hits: {
      hasAlert: audit.alerts.length > 0,
      hasDialog: audit.dialogs.length > 0,
      successText: audit.actionSignals.success,
      loadingText: audit.actionSignals.loading,
      failureText: audit.actionSignals.failure,
      reportText: audit.actionSignals.report,
      governanceText: audit.actionSignals.governance,
      adaptiveText: audit.actionSignals.adaptive,
      horizontalOverflow: audit.scroll.width > audit.scroll.viewportWidth + 8,
    },
  };
}

async function focusTrail(page, steps = 10) {
  const trail = [];
  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press('Tab').catch(() => {});
    await sleep(80);
    trail.push(await page.evaluate(() => {
      const el = document.activeElement;
      const text = (node) => (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        tag: el?.tagName?.toLowerCase() || '',
        role: el?.getAttribute?.('role') || '',
        type: el?.getAttribute?.('type') || '',
        name: el?.getAttribute?.('aria-label') || el?.getAttribute?.('placeholder') || text(el).slice(0, 120),
      };
    }).catch(() => null));
  }
  return trail;
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

async function clickText(page, pattern, action, waitMs = 1200) {
  const locator = page.getByText(pattern).first();
  if (!(await locator.count().catch(() => 0))) {
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

async function clickButton(page, pattern, action, waitMs = 1200) {
  const locator = page.getByRole('button', { name: pattern }).first();
  if (!(await locator.count().catch(() => 0))) {
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

async function triggerDownload(page, pattern, action) {
  const locator = page.getByText(pattern).first();
  if (!(await locator.count().catch(() => 0))) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  const downloadPromise = page.waitForEvent('download', { timeout: 2400 }).then((download) => {
    const event = { action, suggestedFilename: download.suggestedFilename(), url: page.url() };
    downloadEvents.push(event);
    return event;
  }).catch(() => null);
  await locator.click({ timeout: 1800 }).catch((error) => {
    recordIgnoredError(action, error, page.url());
  });
  await sleep(700);
  const event = await downloadPromise;
  optionalActions.push({ action, status: event ? 'downloaded' : 'clicked-no-download', url: page.url() });
  return Boolean(event);
}

async function apiCheck(context, label, route) {
  const response = await context.request.get(`${baseUrl}${route}`).catch((error) => {
    recordIgnoredError(`api ${label}`, error, route);
    return null;
  });
  if (!response) return null;
  const body = await response.text().catch(() => '');
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  const item = {
    label,
    route,
    status: response.status(),
    ok: response.ok(),
    contentType: response.headers()['content-type'] || '',
    summary: body.replace(/\s+/g, ' ').slice(0, 2400),
    parsedSummary: parsed && typeof parsed === 'object' ? {
      total: parsed.total,
      count: Array.isArray(parsed) ? parsed.length : undefined,
      items: Array.isArray(parsed.items) ? parsed.items.length : undefined,
      data: Array.isArray(parsed.data) ? parsed.data.length : undefined,
      error: parsed.error,
      status: parsed.status,
      activeRiskFlags: parsed.activeRiskFlags,
      path: parsed.path ? 'present' : parsed.path === null ? null : undefined,
      id: parsed.id,
    } : null,
  };
  apiChecks.push(item);
  return parsed;
}

async function safeCloseContext(context, label) {
  await Promise.race([
    context.close(),
    sleep(2500).then(() => {
      ignoredErrors.push({ action: `close ${label}`, message: 'context close timed out after 2500ms', url: '' });
    }),
  ]).catch((error) => {
    recordIgnoredError(`close ${label}`, error);
  });
}

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const studentContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const student = await studentContext.newPage();
  await login(student, 'student');
  await captureRoute(student, '/assessment/adaptive-practice?goal=control-correction', '01-student-real-path-default.png', 'student real path default', 2600);
  await captureRoute(student, '/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation', '02-student-real-path-contextual-default.png', 'student real path contextual default', 2600);
  await clickButton(student, /请控灵生成路径|生成路径|生成|打开下一步|刷新/, 'student real path contextual action', 3200);
  await capture(student, '03-student-real-path-contextual-after-action.png', 'student real path contextual after action', { focusTrail: await focusTrail(student, 10) });
  await captureRoute(student, '/assessment/adaptive-practice?goal=control-correction&intent=path-selection', '04-student-real-path-selection-default.png', 'student real path selection default', 2600);
  await clickText(student, /采用|选择|比较|解释|重新生成|生成路径|继续/, 'student real path selection action', 2400);
  await capture(student, '05-student-real-path-selection-after-action.png', 'student real path selection after action');
  await captureRoute(student, '/assessment/adaptive-practice?goal=control-correction&intent=path-execution', '06-student-real-path-execution-default.png', 'student real path execution default', 2600);
  await clickText(student, /标记完成|完成当前节点|开始|继续|进入|查看证据|下一步/, 'student real path execution action', 2400);
  await capture(student, '07-student-real-path-execution-after-action.png', 'student real path execution after action');
  await captureRoute(student, '/assessment/adaptive-practice?goal=control-correction&intent=evidence-review', '08-student-real-path-evidence-review.png', 'student real path evidence review', 2600);
  await captureRoute(student, '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=missing-control-correction-path', '09-student-real-path-missing-path.png', 'student real path missing path', 2600);
  await apiCheck(studentContext, 'student latest path control correction', '/api/learning-paths/latest?goal=control-correction');
  await apiCheck(studentContext, 'student learner state control correction', '/api/adaptive/learner-state?goal=control-correction');
  await apiCheck(studentContext, 'student path advisor context control correction', '/api/adaptive/path-advisor-context?goal=control-correction');
  await safeCloseContext(studentContext, 'student context');

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  const classStudents = await apiCheck(teacherContext, 'teacher class students api', `/api/teacher/classes/${classId}/students?page=1&pageSize=5`);
  const studentId = (
    Array.isArray(classStudents) ? classStudents[0]?.id : classStudents?.students?.[0]?.id || classStudents?.items?.[0]?.id
  ) || 'missing-student';
  await captureRoute(teacher, `/teacher/classes/${classId}/analytics`, '10-teacher-class-analytics-legacy-default.png', 'teacher class analytics legacy default', 3000);
  await clickText(teacher, /报告|导出|发送|补强|学生|证据|刷新|查看/, 'teacher legacy analytics report action', 2200);
  await capture(teacher, '11-teacher-class-analytics-legacy-after-action.png', 'teacher class analytics legacy after action', { focusTrail: await focusTrail(teacher, 10) });
  await captureRoute(teacher, `/teacher/classes/${classId}/analytics-v2?surface=report-ledger`, '12-teacher-class-analytics-v2-report-surface.png', 'teacher analytics v2 report surface', 3200);
  await clickButton(teacher, /变化|风险|分数|刷新数据|刷新/, 'teacher analytics v2 heatmap action', 2200);
  await capture(teacher, '13-teacher-class-analytics-v2-after-heatmap-action.png', 'teacher analytics v2 after heatmap action');
  await clickText(teacher, /高风险|重点关注|学生|查看画像|证据|详情/, 'teacher analytics v2 student drilldown action', 2200);
  await capture(teacher, '14-teacher-class-analytics-v2-after-student-action.png', 'teacher analytics v2 after student action');
  await captureRoute(teacher, `/teacher/classes/${classId}/students/${studentId}/evidence?source=report-ledger`, '15-teacher-student-evidence-from-report-ledger.png', 'teacher student evidence from report ledger', 2800, { resolvedStudentId: studentId });
  await captureRoute(teacher, `/teacher/grading-workbench?classId=${classId}&source=report-ledger`, '16-teacher-grading-workbench-class-report-source.png', 'teacher grading workbench class report source', 2600);
  await clickText(teacher, /评分|写回|批准|提交|导出|查看|报告|刷新/, 'teacher grading class report action', 2200);
  await capture(teacher, '17-teacher-grading-workbench-class-after-action.png', 'teacher grading workbench class after action');
  await apiCheck(teacherContext, 'teacher class insights api', `/api/teacher/classes/${classId}/insights`);
  await apiCheck(teacherContext, 'teacher class heatmap api', `/api/teacher/classes/${classId}/heatmap`);
  await apiCheck(teacherContext, 'teacher class risk students api', `/api/teacher/classes/${classId}/risk-students`);
  await apiCheck(teacherContext, 'teacher control correction report api non-export', `/api/teacher/classes/${classId}/control-correction-report`);
  await apiCheck(teacherContext, 'teacher assistant effect report api non-export', `/api/teacher/classes/${classId}/assistant-effect-report`);
  await safeCloseContext(teacherContext, 'teacher context');

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await captureRoute(admin, '/admin', '18-admin-dashboard-risk-actions-default.png', 'admin dashboard risk actions default', 2600);
  await clickText(admin, /查看风险队列|风险队列|数据治理|治理|查看|刷新/, 'admin dashboard risk action', 2200);
  await capture(admin, '19-admin-dashboard-after-risk-action.png', 'admin dashboard after risk action');
  await captureRoute(admin, '/admin/data-governance?surface=risk-flags&tab=risks', '20-admin-governance-risk-tab-default.png', 'admin governance risk tab default', 14000);
  await clickText(admin, /高|中|低|风险|学生|来源|详情|证据|刷新|队列|快照/, 'admin governance risk row action', 2600);
  await capture(admin, '21-admin-governance-risk-tab-after-action.png', 'admin governance risk tab after action', { focusTrail: await focusTrail(admin, 10) });
  await captureRoute(admin, '/admin/data-governance?surface=quality&tab=reports', '22-admin-governance-quality-tab-default.png', 'admin governance quality tab default', 14000);
  await clickButton(admin, /刷新治理状态|刷新|重试/, 'admin governance refresh action', 3000);
  await capture(admin, '23-admin-governance-quality-after-refresh.png', 'admin governance quality after refresh');
  await captureRoute(admin, '/admin/states?surface=governance', '24-admin-states-governance-default.png', 'admin states governance default', 2800);
  await clickText(admin, /启用演示数据|关闭演示数据|刷新|数据治理|证据浏览器|查看/, 'admin states governance action', 2400);
  await capture(admin, '25-admin-states-governance-after-action.png', 'admin states governance after action');
  await captureRoute(admin, '/data-center?source=batch50&returnTo=/admin/data-governance', '26-admin-data-center-return-target-default.png', 'admin data center return target default', 2600);
  await triggerDownload(admin, /导出演示快照|导出|下载/, 'admin data center batch50 export action');
  await clickText(admin, /进入治理复核|查看修复动作|导出可用性|治理/, 'admin data center batch50 governance action', 2200);
  await capture(admin, '27-admin-data-center-return-target-after-actions.png', 'admin data center return target after actions');
  await apiCheck(adminContext, 'admin governance status api', '/api/admin/data-governance/status');
  await apiCheck(adminContext, 'admin overview api', '/api/admin/overview');
  await safeCloseContext(adminContext, 'admin context');

  const mobileStudent320Context = await browser.newContext({ viewport: mobile320, deviceScaleFactor: 1, isMobile: true });
  const mobileStudent320 = await mobileStudent320Context.newPage();
  await login(mobileStudent320, 'student');
  await captureRoute(mobileStudent320, '/assessment/adaptive-practice?goal=control-correction&intent=path-execution', '28-mobile-320-student-real-path-execution.png', 'mobile 320 student real path execution', 3000, { focusTrail: await focusTrail(mobileStudent320, 10) });
  await safeCloseContext(mobileStudent320Context, 'mobile student 320 context');

  const mobileTeacher390Context = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileTeacher390 = await mobileTeacher390Context.newPage();
  await login(mobileTeacher390, 'teacher');
  await captureRoute(mobileTeacher390, `/teacher/classes/${classId}/analytics-v2?surface=report-ledger`, '29-mobile-390-teacher-analytics-v2-report.png', 'mobile 390 teacher analytics v2 report', 3400);
  await captureRoute(mobileTeacher390, `/teacher/classes/${classId}/students/${studentId}/evidence?source=report-ledger`, '30-mobile-390-teacher-student-evidence.png', 'mobile 390 teacher student evidence', 2800, { resolvedStudentId: studentId });
  await safeCloseContext(mobileTeacher390Context, 'mobile teacher 390 context');

  const mobileAdmin320Context = await browser.newContext({ viewport: mobile320, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileAdmin320 = await mobileAdmin320Context.newPage();
  await login(mobileAdmin320, 'admin');
  await captureRoute(mobileAdmin320, '/admin/data-governance?surface=risk-flags&tab=risks', '31-mobile-320-admin-governance-risk-tab.png', 'mobile 320 admin governance risk tab', 14000);
  await captureRoute(mobileAdmin320, '/data-center?source=batch50&returnTo=/admin/data-governance', '32-mobile-320-admin-data-center-return-target.png', 'mobile 320 admin data center return target', 2600);
  await safeCloseContext(mobileAdmin320Context, 'mobile admin 320 context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'student real learning path empty/execution/evidence states, teacher analytics/report/student evidence/grading surfaces, admin governance risk/quality/status/data-center actions, and 320/390 mobile regression states',
    screenshotDir: path.relative(root, screenshotDir),
    results,
    routeResponses,
    apiChecks,
    optionalActions,
    downloadEvents,
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
    downloadEvents: downloadEvents.length,
    errors: errors.length,
    ignoredErrors: ignoredErrors.length,
    pngCount: pngFiles.length,
    jsonCount: jsonFiles.length,
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
