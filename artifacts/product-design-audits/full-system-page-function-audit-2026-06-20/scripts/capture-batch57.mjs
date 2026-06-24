import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/93-function-state-flows-batch57-search-filter-methods');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch57-manifest.json');
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
    const bodyText = text(document.body);
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
    const alerts = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const dialogs = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].map((el) => ({
      role: el.getAttribute('role') || '',
      modal: el.getAttribute('aria-modal') || '',
      name: name(el).slice(0, 240),
    }));
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
      visibleControls: controls.filter((control) => !control.hidden).slice(0, 160),
      controls,
      alerts,
      dialogs,
      bodyText: bodyText.slice(0, 24000),
      actionSignals: {
        success: /成功|已保存|已提交|已完成|完成|已复制|已下载|导出完成|生成完成|共 0 条|暂无/.test(bodyText),
        loading: /加载|生成中|提交中|处理中|正在|等待|排队/.test(bodyText),
        failure: /失败|错误|异常|无法|不可用|未找到|无权限|重试|404|405/.test(bodyText),
        report: /报告|导出|发送|复制|下载|评分|复盘|补强|账本|草稿/.test(bodyText),
        governance: /治理|风险|处置|分派|标记|撤销|审计|证据源|质量/.test(bodyText),
        adaptive: /路径|推荐|作答|练习|证据|节点|完成|assignment|criterion/.test(bodyText),
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

async function fillVisibleInput(page, value, action, pattern = /(搜索|查找|关键词|账号|姓名|学号|标题|名称|query|search|q)/i) {
  const candidates = await page.locator('input:not([type="hidden"]):not([type="file"]), textarea').all().catch(() => []);
  for (const locator of candidates) {
    const meta = await locator.evaluate((el) => {
      const text = (node) => (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !el.disabled,
        descriptor: [
          el.getAttribute('aria-label') || '',
          el.getAttribute('placeholder') || '',
          el.getAttribute('name') || '',
          el.getAttribute('id') || '',
          text(el.closest('label')),
          text(el.parentElement),
        ].join(' '),
      };
    }).catch(() => ({ visible: false, descriptor: '' }));
    if (!meta.visible || !pattern.test(meta.descriptor)) continue;
    await locator.fill(value, { timeout: 1800 }).catch((error) => recordIgnoredError(action, error, page.url()));
    await locator.press('Enter').catch(() => {});
    await sleep(1600);
    optionalActions.push({ action, status: 'filled', value, meta: meta.descriptor.trim().slice(0, 240), url: page.url() });
    return true;
  }
  optionalActions.push({ action, status: 'not-found', value, url: page.url() });
  return false;
}

async function apiRequestCheck(context, label, route, options = {}) {
  const method = options.method ?? 'GET';
  const response = await context.request.fetch(`${baseUrl}${route}`, {
    method,
    data: options.data,
    headers: options.data ? { 'content-type': 'application/json' } : undefined,
  }).catch((error) => {
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
    method,
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
      path: parsed.path ? 'present' : parsed.path === null ? null : undefined,
      activeRiskFlags: parsed.activeRiskFlags,
    } : null,
  };
  apiChecks.push(item);
  return parsed;
}

async function apiCheck(context, label, route) {
  return apiRequestCheck(context, label, route);
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
  await locator.click({ timeout: 1800 }).catch((error) => recordIgnoredError(action, error, page.url()));
  await sleep(900);
  const event = await downloadPromise;
  optionalActions.push({ action, status: event ? 'downloaded' : 'clicked-no-download', url: page.url() });
  return Boolean(event);
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

  const studentContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const student = await studentContext.newPage();
  await login(student, 'student');
  await captureRoute(student, '/assessment/document-feedback?source=batch57&assignment=report-control-design&criterion=model-assumptions&status=actionable', '01-student-document-feedback-target.png', 'student document feedback target', 3200);
  await clickText(student, /证据|练习|采用|完成|反馈|报告|返回|补强/, 'student document feedback target action batch57', 1800);
  await capture(student, '02-student-document-feedback-after-action.png', 'student document feedback after action', { focusTrail: await focusTrail(student, 12) });
  await captureRoute(student, '/profile/evidence?source=batch57&assignment=report-control-design&criterion=model-assumptions&status=completed', '03-student-evidence-assignment-completed.png', 'student evidence assignment completed', 2800);
  await fillVisibleInput(student, 'model-assumptions', 'student evidence completed visible search batch57');
  await capture(student, '04-student-evidence-completed-after-search.png', 'student evidence completed after search', { focusTrail: await focusTrail(student, 12) });
  await captureRoute(student, '/profile/evidence?source=batch57&lessonId=missing-batch57&status=actionable', '05-student-evidence-missing-lesson.png', 'student evidence missing lesson', 2800);
  await captureRoute(student, '/profile/evidence?source=batch57&sourceEventId=missing-batch57&status=actionable', '06-student-evidence-missing-source-event.png', 'student evidence missing source event', 2800);
  await captureRoute(student, '/assessment/adaptive-practice?source=batch57&assignment=report-control-design&criterion=model-assumptions&intent=writeback&status=completed', '07-student-adaptive-writeback-completed.png', 'student adaptive writeback completed', 2800);
  await apiCheck(studentContext, 'learning evidence assignment completed batch57', '/api/learning-evidence?assignment=report-control-design&criterion=model-assumptions&status=completed&limit=5');
  await apiCheck(studentContext, 'learning evidence missing lesson batch57', '/api/learning-evidence?lessonId=missing-batch57&status=actionable&limit=5');
  await apiCheck(studentContext, 'learning evidence missing source event batch57', '/api/learning-evidence?sourceEventId=missing-batch57&status=actionable&limit=5');
  await apiCheck(studentContext, 'latest path writeback completed batch57', '/api/learning-paths/latest?goal=control-correction');
  await safeCloseContext(studentContext, 'student context');

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  await captureRoute(teacher, `/teacher/classes/${classId}/analytics-v2?surface=report-ledger&report=control-correction&source=batch57&action=export`, '08-teacher-report-ledger-export.png', 'teacher report ledger export', 3600);
  await triggerDownload(teacher, /导出|下载|报告|快照|发送|交付/, 'teacher report ledger export download batch57');
  await capture(teacher, '09-teacher-report-ledger-export-after-action.png', 'teacher report ledger export after action', { focusTrail: await focusTrail(teacher, 12) });
  await captureRoute(teacher, `/teacher/classes/${classId}/analytics-v2?surface=remediation&report=control-correction&source=batch57&action=create-task`, '10-teacher-report-remediation-task.png', 'teacher report remediation task', 3600);
  await clickText(teacher, /补强|任务|生成|发送|练习|证据|报告|评分/, 'teacher remediation create task action batch57', 2200);
  await capture(teacher, '11-teacher-report-remediation-after-action.png', 'teacher report remediation after action');
  await captureRoute(teacher, `/teacher/grading-workbench?classId=${classId}&assignment=report-control-design&source=batch57&status=draft&method=post-preview`, '12-teacher-grading-draft-post-preview.png', 'teacher grading draft post preview', 2800);
  await clickText(teacher, /草稿|评分|写回|预览|提交|刷新|返回|报告|证据/, 'teacher grading draft post preview action batch57', 2200);
  await capture(teacher, '13-teacher-grading-draft-after-action.png', 'teacher grading draft after action');
  await captureRoute(teacher, `/teacher/grading-workbench?classId=${classId}&assignment=missing-batch57&source=batch57&runId=missing-batch57&status=ready`, '14-teacher-grading-missing-run.png', 'teacher grading missing run', 2800);
  await apiCheck(teacherContext, 'document grading submissions assignment GET batch57', `/api/teacher/document-grading/submissions?classId=${classId}&assignment=report-control-design`);
  await apiRequestCheck(teacherContext, 'document grading submissions invalid POST batch57', '/api/teacher/document-grading/submissions', { method: 'POST', data: { classId, assignment: 'missing-batch57' } });
  await apiCheck(teacherContext, 'document grading writeback preview GET batch57', '/api/teacher/document-grading/writeback-preview?assignment=report-control-design');
  await apiRequestCheck(teacherContext, 'document grading writeback preview invalid POST batch57', '/api/teacher/document-grading/writeback-preview', { method: 'POST', data: { assignment: 'missing-batch57', evidenceIds: [] } });
  await safeCloseContext(teacherContext, 'teacher context');

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await captureRoute(admin, '/admin/users?source=batch57&role=STUDENT&q=zzzz-batch57-no-match&page=1&pageSize=5', '15-admin-users-student-no-match.png', 'admin users student no-match', 2800);
  await fillVisibleInput(admin, 'zzzz-batch57-no-match', 'admin users student visible no-match search batch57');
  await capture(admin, '16-admin-users-student-after-visible-search.png', 'admin users student after visible search', { focusTrail: await focusTrail(admin, 12) });
  await captureRoute(admin, '/admin/users?source=batch57&role=TEACHER&page=2&pageSize=2', '17-admin-users-teacher-page-two.png', 'admin users teacher page two', 2800);
  await captureRoute(admin, '/admin/users?source=batch57&role=ADMIN&q=zzzz-batch57-no-match&page=1&pageSize=5', '18-admin-users-admin-no-match.png', 'admin users admin no-match', 2800);
  await apiCheck(adminContext, 'admin users student no-match API batch57', '/api/admin/users?role=STUDENT&q=zzzz-batch57-no-match&page=1&pageSize=5');
  await apiCheck(adminContext, 'admin users teacher page two API batch57', '/api/admin/users?role=TEACHER&page=2&pageSize=2');
  await apiCheck(adminContext, 'admin users admin no-match API batch57', '/api/admin/users?role=ADMIN&q=zzzz-batch57-no-match&page=1&pageSize=5');

  await captureRoute(admin, '/admin/data-governance?tab=risks&action=resolve&riskId=missing-batch57&status=open&source=batch57', '19-admin-governance-resolve-missing-risk.png', 'admin governance resolve missing risk', 9000);
  await clickText(admin, /处置|解决|标记|分派|撤销|导出|刷新|证据|风险/, 'admin governance resolve missing action batch57', 2600);
  await capture(admin, '20-admin-governance-resolve-after-action.png', 'admin governance resolve after action');
  await captureRoute(admin, '/admin/data-governance?tab=risks&action=export&format=json&source=batch57', '21-admin-governance-export-json.png', 'admin governance export json', 9000);
  await triggerDownload(admin, /导出|下载|JSON|快照|风险/, 'admin governance export json download batch57');
  await capture(admin, '22-admin-governance-export-json-after-action.png', 'admin governance export json after action');
  await captureRoute(admin, '/admin/config?source=batch57&focus=model-test&provider=missing-batch57&model=missing-batch57&action=test', '23-admin-config-missing-model-test.png', 'admin config missing model test', 3200);
  await clickText(admin, /测试|保存|重置|添加|审计|配置|模型/, 'admin config missing model test action batch57', 2600);
  await capture(admin, '24-admin-config-missing-model-after-action.png', 'admin config missing model after action');
  await apiCheck(adminContext, 'admin governance status batch57', '/api/admin/data-governance/status');
  await safeCloseContext(adminContext, 'admin context');

  const mobileStudentContext = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileStudent = await mobileStudentContext.newPage();
  await login(mobileStudent, 'student');
  await captureRoute(mobileStudent, '/assessment/document-feedback?source=batch57&assignment=report-control-design&criterion=model-assumptions&status=actionable', '25-mobile-390-student-document-feedback-target.png', 'mobile 390 student document feedback target', 3200);
  await captureRoute(mobileStudent, '/profile/evidence?source=batch57&lessonId=missing-batch57&status=actionable', '26-mobile-390-student-evidence-missing-lesson.png', 'mobile 390 student evidence missing lesson', 3200);
  await safeCloseContext(mobileStudentContext, 'mobile student context');

  const mobileTeacherContext = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileTeacher = await mobileTeacherContext.newPage();
  await login(mobileTeacher, 'teacher');
  await captureRoute(mobileTeacher, `/teacher/classes/${classId}/analytics-v2?surface=remediation&report=control-correction&source=batch57&action=create-task`, '27-mobile-390-teacher-report-remediation-task.png', 'mobile 390 teacher report remediation task', 3600);
  await captureRoute(mobileTeacher, `/teacher/grading-workbench?classId=${classId}&assignment=report-control-design&source=batch57&status=draft&method=post-preview`, '28-mobile-390-teacher-grading-draft.png', 'mobile 390 teacher grading draft', 3200);
  await safeCloseContext(mobileTeacherContext, 'mobile teacher context');

  const mobileAdminContext = await browser.newContext({ viewport: mobile320, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileAdmin = await mobileAdminContext.newPage();
  await login(mobileAdmin, 'admin');
  await captureRoute(mobileAdmin, '/admin/users?source=batch57&role=STUDENT&q=zzzz-batch57-no-match&page=1&pageSize=5', '29-mobile-320-admin-users-student-no-match.png', 'mobile 320 admin users student no-match', 3200);
  await captureRoute(mobileAdmin, '/admin/users?source=batch57&role=TEACHER&page=2&pageSize=2', '30-mobile-320-admin-users-teacher-page-two.png', 'mobile 320 admin users teacher page two', 3200);
  await captureRoute(mobileAdmin, '/admin/data-governance?tab=risks&action=resolve&riskId=missing-batch57&status=open&source=batch57', '31-mobile-320-admin-governance-resolve.png', 'mobile 320 admin governance resolve', 9000);
  await captureRoute(mobileAdmin, '/admin/config?source=batch57&focus=model-test&provider=missing-batch57&model=missing-batch57&action=test', '32-mobile-320-admin-config-missing-model.png', 'mobile 320 admin config missing model', 3200);
  await safeCloseContext(mobileAdminContext, 'mobile admin context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'Search/filter/method-boundary follow-up for report feedback targets, student evidence filters, teacher report export/remediation, grading draft and invalid methods, admin user role filters and pagination, governance resolve/export, config model tests, and 320px/390px mobile target pages',
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
