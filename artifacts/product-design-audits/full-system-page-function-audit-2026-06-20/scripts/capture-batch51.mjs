import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/87-function-state-flows-batch51-delivery-batch-governance-completion');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch51-manifest.json');
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


async function fillVisibleInput(page, value, action, pattern = /(搜索|查找|关键词|账号|姓名|学号|标题|名称|query|search|q)/i) {
  const candidates = await page.locator('input:not([type="hidden"]):not([type="file"]), textarea').all().catch(() => []);
  for (const locator of candidates) {
    const meta = await locator.evaluate((el) => {
      const text = (node) => (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return [
        el.getAttribute('aria-label') || '',
        el.getAttribute('placeholder') || '',
        el.getAttribute('name') || '',
        el.getAttribute('id') || '',
        text(el.closest('label')),
        text(el.parentElement),
        rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' ? 'visible' : 'hidden',
      ].join(' ');
    }).catch(() => '');
    if (!/\bvisible\b/.test(meta)) continue;
    if (!pattern.test(meta)) continue;
    await locator.fill(value, { timeout: 1800 }).catch((error) => recordIgnoredError(action, error, page.url()));
    await locator.press('Enter').catch(() => {});
    await sleep(1400);
    optionalActions.push({ action, status: 'filled', value, meta: meta.trim().slice(0, 240), url: page.url() });
    return true;
  }
  optionalActions.push({ action, status: 'not-found', value, url: page.url() });
  return false;
}

async function triggerFileChooser(page, pattern, action) {
  const locator = page.getByText(pattern).first();
  if (!(await locator.count().catch(() => 0))) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 2200 }).then((chooser) => {
    const event = { action, isMultiple: chooser.isMultiple(), url: page.url() };
    return event;
  }).catch(() => null);
  await locator.click({ timeout: 1800 }).catch((error) => recordIgnoredError(action, error, page.url()));
  const event = await chooserPromise;
  optionalActions.push({ action, status: event ? 'filechooser-opened' : 'clicked-no-filechooser', event, url: page.url() });
  await sleep(900);
  return Boolean(event);
}

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const studentContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const student = await studentContext.newPage();
  await login(student, 'student');
  await captureRoute(student, '/missions?source=batch51&status=active', '01-student-missions-active-default.png', 'student missions active default', 2600);
  await clickText(student, /开始任务|继续任务|进入|启动|查看|筛选|全部/, 'student missions start or filter action', 2200);
  await capture(student, '02-student-missions-after-action.png', 'student missions after action', { focusTrail: await focusTrail(student, 10) });
  await captureRoute(student, '/profile/evidence?status=completed&source=batch51', '03-student-evidence-completed-filter.png', 'student evidence completed filter', 2600);
  await clickText(student, /复盘|补练|查看|继续|证据|筛选|课堂作答/, 'student evidence completion action', 2200);
  await capture(student, '04-student-evidence-after-completion-action.png', 'student evidence after completion action');
  await captureRoute(student, '/profile/growth?source=batch51&focus=completion', '05-student-growth-completion-default.png', 'student growth completion default', 2600);
  await clickText(student, /下一步|继续学习|补强|查看建议|生成路径|开始练习/, 'student growth completion next action', 2200);
  await capture(student, '06-student-growth-after-next-action.png', 'student growth after next action');
  await captureRoute(student, '/profile/portfolio?category=coursework&source=batch51', '07-student-portfolio-coursework-default.png', 'student portfolio coursework default', 2600);
  await clickText(student, /添加|收录|继续完善|查看|反思|课堂作品|仿真设计/, 'student portfolio collection action', 2200);
  await capture(student, '08-student-portfolio-after-collection-action.png', 'student portfolio after collection action');
  await apiCheck(studentContext, 'student missions api batch51', '/api/missions');
  await apiCheck(studentContext, 'student evidence api batch51', '/api/student/evidence');
  await apiCheck(studentContext, 'student growth records api batch51', '/api/student/growth-records');
  await apiCheck(studentContext, 'student recommendations api batch51', '/api/student/recommendations');
  await safeCloseContext(studentContext, 'student context');

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  const classStudents = await apiCheck(teacherContext, 'teacher class students api batch51', `/api/teacher/classes/${classId}/students?page=1&pageSize=5`);
  const studentId = (Array.isArray(classStudents) ? classStudents[0]?.id : classStudents?.students?.[0]?.id || classStudents?.items?.[0]?.id) || 'missing-student';
  await captureRoute(teacher, '/teacher?source=batch51&surface=report-delivery', '09-teacher-dashboard-report-delivery-default.png', 'teacher dashboard report delivery default', 2600);
  await clickText(teacher, /报告|证据|复盘|导出|发送|补强|评分|查看/, 'teacher dashboard report delivery action', 2200);
  await capture(teacher, '10-teacher-dashboard-after-report-action.png', 'teacher dashboard after report action');
  await captureRoute(teacher, `/teacher/classes/${classId}?source=batch51&surface=delivery`, '11-teacher-class-delivery-default.png', 'teacher class delivery default', 2800);
  await clickText(teacher, /报告|分析|学生|证据|复盘|发起|导出|发送|补强/, 'teacher class delivery action', 2200);
  await capture(teacher, '12-teacher-class-after-delivery-action.png', 'teacher class after delivery action', { focusTrail: await focusTrail(teacher, 10) });
  await captureRoute(teacher, `/teacher/classes/${classId}/students/${studentId}?source=batch51`, '13-teacher-student-profile-source-default.png', 'teacher student profile source default', 2600, { resolvedStudentId: studentId });
  await clickText(teacher, /证据|诊断|补强|生成|报告|查看|复盘/, 'teacher student profile remediation action', 2200);
  await capture(teacher, '14-teacher-student-profile-after-action.png', 'teacher student profile after action');
  await captureRoute(teacher, `/teacher/classes/${classId}/students/${studentId}/evidence?source=batch51&status=completed`, '15-teacher-student-evidence-completed-default.png', 'teacher student evidence completed default', 2600, { resolvedStudentId: studentId });
  await clickText(teacher, /审核|采用|驳回|补强|留在|报告|查看|复盘/, 'teacher student evidence handling action', 2200);
  await capture(teacher, '16-teacher-student-evidence-after-handling-action.png', 'teacher student evidence after handling action');
  await captureRoute(teacher, `/teacher/grading-workbench?classId=${classId}&source=batch51&status=ready`, '17-teacher-grading-ready-source-default.png', 'teacher grading ready source default', 2600);
  await clickText(teacher, /评分|写回|批准|提交|导入|报告|刷新|查看/, 'teacher grading ready action', 2200);
  await capture(teacher, '18-teacher-grading-ready-after-action.png', 'teacher grading ready after action');
  await captureRoute(teacher, `/teacher/prep-packs?classId=${classId}&source=batch51`, '19-teacher-prep-pack-source-default.png', 'teacher prep pack source default', 3600);
  await apiCheck(teacherContext, 'teacher document grading submissions api batch51', `/api/teacher/document-grading/submissions?classId=${classId}`);
  await apiCheck(teacherContext, 'teacher document grading writeback preview api batch51', '/api/teacher/document-grading/writeback-preview');
  await apiCheck(teacherContext, 'teacher control correction report export api batch51', `/api/teacher/classes/${classId}/control-correction-report?export=true`);
  await apiCheck(teacherContext, 'teacher student insights api batch51', `/api/teacher/classes/${classId}/students/${studentId}/insights`);
  await safeCloseContext(teacherContext, 'teacher context');

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await captureRoute(admin, '/admin/users?source=batch51', '20-admin-users-batch-default.png', 'admin users batch default', 2600);
  await triggerDownload(admin, /下载模板|模板/, 'admin users template download batch51');
  await triggerFileChooser(admin, /批量导入|导入|上传/, 'admin users batch import chooser batch51');
  await capture(admin, '21-admin-users-after-template-import-actions.png', 'admin users after template import actions', { focusTrail: await focusTrail(admin, 10) });
  await captureRoute(admin, '/admin/users?source=batch51&q=zzzz-batch51-no-match', '22-admin-users-no-match-query.png', 'admin users no match query', 2600);
  await fillVisibleInput(admin, 'zzzz-batch51-no-match', 'admin users no match search input');
  await capture(admin, '23-admin-users-after-no-match-search.png', 'admin users after no match search');
  await captureRoute(admin, '/admin/config?source=batch51', '24-admin-config-default.png', 'admin config default', 2600);
  await clickButton(admin, /保存|测试|重置|添加|校验/, 'admin config save or test action', 2400);
  await capture(admin, '25-admin-config-after-action.png', 'admin config after action');
  await captureRoute(admin, '/admin/data-governance?tab=risks&action=resolve&source=batch51', '26-admin-governance-resolve-query-default.png', 'admin governance resolve query default', 12000);
  await clickText(admin, /处置|分派|标记|撤销|导出|证据|风险|刷新/, 'admin governance resolve action', 2600);
  await capture(admin, '27-admin-governance-after-resolve-action.png', 'admin governance after resolve action');
  await captureRoute(admin, '/admin/lesson-plans?source=batch51&q=zzzz-batch51-no-match', '28-admin-lesson-plans-search-default.png', 'admin lesson plans search default', 2600);
  await fillVisibleInput(admin, 'zzzz-batch51-no-match', 'admin lesson plans no match search input');
  await capture(admin, '29-admin-lesson-plans-after-search.png', 'admin lesson plans after search');
  await apiCheck(adminContext, 'admin users no match api batch51', '/api/admin/users?q=zzzz-batch51-no-match&page=1&pageSize=5');
  await apiCheck(adminContext, 'admin users template api batch51', '/api/admin/users/template');
  await apiCheck(adminContext, 'admin platform settings api batch51', '/api/admin/platform-settings');
  await apiCheck(adminContext, 'admin governance status api batch51', '/api/admin/data-governance/status');
  await safeCloseContext(adminContext, 'admin context');

  const mobileStudent390Context = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true });
  const mobileStudent390 = await mobileStudent390Context.newPage();
  await login(mobileStudent390, 'student');
  await captureRoute(mobileStudent390, '/missions?source=batch51&status=active', '30-mobile-390-student-missions.png', 'mobile 390 student missions', 3000, { focusTrail: await focusTrail(mobileStudent390, 10) });
  await captureRoute(mobileStudent390, '/profile/portfolio?category=coursework&source=batch51', '31-mobile-390-student-portfolio.png', 'mobile 390 student portfolio', 3000);
  await safeCloseContext(mobileStudent390Context, 'mobile student 390 context');

  const mobileTeacher390Context = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileTeacher390 = await mobileTeacher390Context.newPage();
  await login(mobileTeacher390, 'teacher');
  await captureRoute(mobileTeacher390, `/teacher/grading-workbench?classId=${classId}&source=batch51&status=ready`, '32-mobile-390-teacher-grading-ready.png', 'mobile 390 teacher grading ready', 3000);
  await safeCloseContext(mobileTeacher390Context, 'mobile teacher 390 context');

  const mobileAdmin320Context = await browser.newContext({ viewport: mobile320, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileAdmin320 = await mobileAdmin320Context.newPage();
  await login(mobileAdmin320, 'admin');
  await captureRoute(mobileAdmin320, '/admin/users?source=batch51', '33-mobile-320-admin-users-batch.png', 'mobile 320 admin users batch', 3200);
  await captureRoute(mobileAdmin320, '/admin/config?source=batch51', '34-mobile-320-admin-config.png', 'mobile 320 admin config', 3000);
  await captureRoute(mobileAdmin320, '/admin/data-governance?tab=risks&action=resolve&source=batch51', '35-mobile-320-admin-governance-resolve.png', 'mobile 320 admin governance resolve', 12000);
  await safeCloseContext(mobileAdmin320Context, 'mobile admin 320 context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'student completion and portfolio return states, teacher report delivery/grading/prep-pack surfaces, admin batch import/config/governance resolve states, related APIs, downloads, uploads, and mobile completion/governance regressions',
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
