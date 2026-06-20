import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/94-function-state-flows-batch58-action-closure-a11y');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch58-manifest.json');
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
  await captureRoute(student, '/assessment/document-feedback?source=batch58&assignment=report-control-design&criterion=model-assumptions&status=returned&action=adopt', '01-student-feedback-returned-adopt-target.png', 'student feedback returned adopt target', 3200);
  await clickText(student, /采用|已读|完成|写回|练习|证据|反馈|返回/, 'student feedback adopt action batch58', 1800);
  await capture(student, '02-student-feedback-returned-after-adopt.png', 'student feedback returned after adopt action', { focusTrail: await focusTrail(student, 12) });
  await captureRoute(student, '/assessment/document-feedback?source=batch58&assignment=report-control-design&criterion=model-assumptions&status=completed&action=writeback', '03-student-feedback-completed-writeback-target.png', 'student feedback completed writeback target', 3200);
  await clickText(student, /写回|提交|完成|练习|证据|报告|返回/, 'student feedback completed writeback action batch58', 1800);
  await capture(student, '04-student-feedback-completed-after-action.png', 'student feedback completed after action', { focusTrail: await focusTrail(student, 12) });
  await captureRoute(student, '/missions?source=batch58&q=report-control-design&status=completed&returnTo=/assessment/document-feedback', '05-student-missions-feedback-returnto.png', 'student missions feedback returnTo', 2800);
  await fillVisibleInput(student, 'report-control-design', 'student missions feedback visible search batch58');
  await capture(student, '06-student-missions-feedback-after-search.png', 'student missions feedback after search', { focusTrail: await focusTrail(student, 12) });
  await captureRoute(student, '/profile/portfolio?source=batch58&assignment=report-control-design&intent=collect&status=completed', '07-student-portfolio-feedback-collect.png', 'student portfolio feedback collect', 2800);
  await clickText(student, /收录|添加|作品|证据|反思|课程|反馈/, 'student portfolio feedback collect action batch58', 1800);
  await capture(student, '08-student-portfolio-feedback-after-action.png', 'student portfolio feedback after action');
  await apiCheck(studentContext, 'learning evidence assignment returned batch58', '/api/learning-evidence?assignment=report-control-design&criterion=model-assumptions&status=returned&limit=5');
  await apiCheck(studentContext, 'missions feedback query batch58', '/api/missions?status=completed&q=report-control-design');
  await apiCheck(studentContext, 'latest path writeback batch58', '/api/learning-paths/latest?goal=control-correction');
  await safeCloseContext(studentContext, 'student context');

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  await captureRoute(teacher, `/teacher/classes/${classId}/analytics-v2?surface=report-ledger&report=control-correction&source=batch58&action=download&format=pdf`, '09-teacher-report-download-pdf.png', 'teacher report download pdf', 3600);
  await triggerDownload(teacher, /下载|导出|PDF|报告|快照|发送|交付/, 'teacher report download pdf batch58');
  await capture(teacher, '10-teacher-report-download-after-action.png', 'teacher report download after action', { focusTrail: await focusTrail(teacher, 12) });
  await captureRoute(teacher, `/teacher/classes/${classId}/analytics-v2?surface=report-ledger&report=control-correction&source=batch58&action=send&studentId=missing-batch58`, '11-teacher-report-send-missing-student.png', 'teacher report send missing student', 3600);
  await clickText(teacher, /发送|交付|学生|报告|返回|重试|证据/, 'teacher report send missing student action batch58', 2200);
  await capture(teacher, '12-teacher-report-send-after-action.png', 'teacher report send after action');
  await captureRoute(teacher, `/teacher/grading-workbench?classId=${classId}&assignment=report-control-design&source=batch58&gradingRunId=missing-batch58&action=approve`, '13-teacher-grading-approve-missing-run.png', 'teacher grading approve missing run', 2800);
  await clickText(teacher, /审批|通过|退回|写回|提交|评分|刷新|返回|报告/, 'teacher grading approve missing run action batch58', 2200);
  await capture(teacher, '14-teacher-grading-approve-after-action.png', 'teacher grading approve after action');
  await captureRoute(teacher, `/teacher/classes/${classId}/students?source=batch58&q=zzzz-batch58-no-match&action=add`, '15-teacher-class-students-no-match-add.png', 'teacher class students no-match add', 3000);
  await clickText(teacher, /添加|导入|学生|搜索|返回|重置/, 'teacher class students no-match add action batch58', 1800);
  await capture(teacher, '16-teacher-class-students-after-action.png', 'teacher class students after action');
  await apiCheck(teacherContext, 'document grading submissions approve GET batch58', `/api/teacher/document-grading/submissions?classId=${classId}&assignment=report-control-design&status=approved`);
  await apiRequestCheck(teacherContext, 'document grading writeback invalid approve POST batch58', '/api/teacher/document-grading/writeback', { method: 'POST', data: { gradingRunId: 'missing-batch58', action: 'approve' } });
  await apiCheck(teacherContext, 'teacher class students no-match API batch58', `/api/teacher/classes/${classId}/students?q=zzzz-batch58-no-match`);
  await safeCloseContext(teacherContext, 'teacher context');

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await captureRoute(admin, '/admin/users?source=batch58&role=STUDENT&q=zzzz-batch58-no-match&page=2&pageSize=5&action=reset', '17-admin-users-student-no-match-page-two.png', 'admin users student no-match page two', 2800);
  await clickText(admin, /重置|清空|刷新|搜索|新建|导入|下载/, 'admin users reset no-match action batch58', 1800);
  await capture(admin, '18-admin-users-after-reset-action.png', 'admin users after reset action', { focusTrail: await focusTrail(admin, 12) });
  await captureRoute(admin, '/admin/users?source=batch58&role=TEACHER&q=zzzz-batch58-no-match&page=2&pageSize=2&action=export', '19-admin-users-teacher-export-no-match.png', 'admin users teacher export no-match', 2800);
  await triggerDownload(admin, /导出|下载|模板|用户|账号/, 'admin users teacher export no-match batch58');
  await capture(admin, '20-admin-users-teacher-export-after-action.png', 'admin users teacher export after action');
  await apiCheck(adminContext, 'admin users student page two no-match API batch58', '/api/admin/users?role=STUDENT&q=zzzz-batch58-no-match&page=2&pageSize=5');
  await apiCheck(adminContext, 'admin users teacher export no-match API batch58', '/api/admin/users?role=TEACHER&q=zzzz-batch58-no-match&page=2&pageSize=2');

  await captureRoute(admin, '/admin/data-governance?tab=risks&action=assign&riskId=missing-batch58&assignee=missing-teacher&source=batch58', '21-admin-governance-assign-missing-assignee.png', 'admin governance assign missing assignee', 9000);
  await clickText(admin, /分派|处置|解决|标记|撤销|导出|刷新|证据|风险/, 'admin governance assign missing assignee action batch58', 2600);
  await capture(admin, '22-admin-governance-assign-after-action.png', 'admin governance assign after action');
  await captureRoute(admin, '/admin/data-governance?tab=risks&action=export&format=xlsx&source=batch58', '23-admin-governance-export-xlsx.png', 'admin governance export xlsx', 9000);
  await triggerDownload(admin, /导出|下载|XLSX|Excel|快照|风险/, 'admin governance export xlsx download batch58');
  await capture(admin, '24-admin-governance-export-xlsx-after-action.png', 'admin governance export xlsx after action');
  await captureRoute(admin, '/admin/config?source=batch58&focus=model-test&provider=SiliconFlow&model=missing-batch58&action=test', '25-admin-config-existing-provider-missing-model.png', 'admin config existing provider missing model', 3200);
  await clickText(admin, /测试|保存|重置|添加|审计|配置|模型/, 'admin config existing provider missing model action batch58', 2600);
  await capture(admin, '26-admin-config-existing-provider-after-action.png', 'admin config existing provider after action');
  await apiCheck(adminContext, 'admin governance status batch58', '/api/admin/data-governance/status');
  await safeCloseContext(adminContext, 'admin context');

  const mobileStudentContext = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileStudent = await mobileStudentContext.newPage();
  await login(mobileStudent, 'student');
  await captureRoute(mobileStudent, '/assessment/document-feedback?source=batch58&assignment=report-control-design&criterion=model-assumptions&status=returned&action=adopt', '27-mobile-390-student-feedback-adopt.png', 'mobile 390 student feedback adopt', 3200);
  await captureRoute(mobileStudent, '/missions?source=batch58&q=report-control-design&status=completed&returnTo=/assessment/document-feedback', '28-mobile-390-student-missions-feedback.png', 'mobile 390 student missions feedback', 3200);
  await safeCloseContext(mobileStudentContext, 'mobile student context');

  const mobileTeacherContext = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileTeacher = await mobileTeacherContext.newPage();
  await login(mobileTeacher, 'teacher');
  await captureRoute(mobileTeacher, `/teacher/classes/${classId}/analytics-v2?surface=report-ledger&report=control-correction&source=batch58&action=send&studentId=missing-batch58`, '29-mobile-390-teacher-report-send-missing.png', 'mobile 390 teacher report send missing', 3600);
  await captureRoute(mobileTeacher, `/teacher/grading-workbench?classId=${classId}&assignment=report-control-design&source=batch58&gradingRunId=missing-batch58&action=approve`, '30-mobile-390-teacher-grading-approve-missing.png', 'mobile 390 teacher grading approve missing', 3200);
  await safeCloseContext(mobileTeacherContext, 'mobile teacher context');

  const mobileAdminContext = await browser.newContext({ viewport: mobile320, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileAdmin = await mobileAdminContext.newPage();
  await login(mobileAdmin, 'admin');
  await captureRoute(mobileAdmin, '/admin/users?source=batch58&role=STUDENT&q=zzzz-batch58-no-match&page=2&pageSize=5&action=reset', '31-mobile-320-admin-users-reset-no-match.png', 'mobile 320 admin users reset no-match', 3200);
  await captureRoute(mobileAdmin, '/admin/data-governance?tab=risks&action=assign&riskId=missing-batch58&assignee=missing-teacher&source=batch58', '32-mobile-320-admin-governance-assign.png', 'mobile 320 admin governance assign', 9000);
  await captureRoute(mobileAdmin, '/admin/config?source=batch58&focus=model-test&provider=SiliconFlow&model=missing-batch58&action=test', '33-mobile-320-admin-config-existing-provider-missing-model.png', 'mobile 320 admin config existing provider missing model', 3200);
  await safeCloseContext(mobileAdminContext, 'mobile admin context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'Action-closure and accessibility follow-up for report feedback adoption/writeback, missions/portfolio handoff, teacher report download/send, grading approval, teacher class student search, admin user reset/export, governance assignment/export, config model tests, and 320px/390px mobile target pages',
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
