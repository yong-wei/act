import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/85-function-state-flows-batch49-adaptive-report-governance');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch49-manifest.json');
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
const downloadEvents = [];
const dialogEvents = [];
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
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 30),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        role: active?.getAttribute?.('role') || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
      },
      visibleControls: controls.filter((control) => !control.hidden).slice(0, 130),
      controls,
      alerts: statusRegions,
      dialogs,
      tables: [...document.querySelectorAll('table')].map((table) => ({
        headers: [...table.querySelectorAll('th')].map(text).filter(Boolean),
        rowCount: table.querySelectorAll('tbody tr').length,
        caption: text(table.querySelector('caption')),
      })),
      bodyText: bodyText.slice(0, 20000),
      actionSignals: {
        success: /成功|已保存|已提交|已完成|完成|已复制|已下载|导出完成|生成完成|评价完成/.test(bodyText),
        loading: /加载|生成中|提交中|处理中|正在|等待|排队/.test(bodyText),
        failure: /失败|错误|异常|无法|不可用|未找到|无权限|重试/.test(bodyText),
        report: /报告|导出|发送|复制|下载|评分|复盘|补强/.test(bodyText),
        governance: /治理|风险|处置|分派|标记|撤销|审计|证据源/.test(bodyText),
        ai: /AI|Copilot|提示词|评价|校验|生成|引用|置信/.test(bodyText),
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
      aiText: audit.actionSignals.ai,
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

async function fillFirstVisibleInput(page, value, action, pattern = /(提示词|prompt|输入|搜索|标题|内容|答案|描述|评价|校验|文本|message|question)/i) {
  const candidates = page.locator('input:not([type="file"]):not([type="hidden"]), textarea');
  const count = await candidates.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const box = await candidate.boundingBox().catch(() => null);
    if (!box || box.width < 4 || box.height < 4) continue;
    const meta = await candidate.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        disabled: Boolean(el.disabled || el.readOnly || el.getAttribute('aria-disabled') === 'true'),
        display: style.display,
        visibility: style.visibility,
        name: el.getAttribute('name') || '',
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || '',
      };
    }).catch(() => null);
    if (!meta || meta.disabled || meta.display === 'none' || meta.visibility === 'hidden') continue;
    const searchableText = `${meta.name} ${meta.placeholder} ${meta.ariaLabel} ${meta.title}`;
    if (!pattern.test(searchableText)) continue;
    await candidate.fill(value).catch((error) => {
      recordIgnoredError(action, error, page.url());
    });
    await sleep(600);
    optionalActions.push({ action, status: 'filled', value, meta: searchableText.trim(), url: page.url() });
    return true;
  }
  optionalActions.push({ action, status: 'not-found', value, url: page.url() });
  return false;
}

async function clickFirstChoice(page, action) {
  const choice = page.locator('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]').first();
  if (!(await choice.count().catch(() => 0))) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  await choice.click({ timeout: 1600 }).catch((error) => {
    recordIgnoredError(action, error, page.url());
  });
  await sleep(500);
  optionalActions.push({ action, status: 'attempted', url: page.url() });
  return true;
}

async function triggerDownload(page, pattern, action) {
  const locator = page.getByText(pattern).first();
  if (!(await locator.count().catch(() => 0))) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  const downloadPromise = page.waitForEvent('download', { timeout: 2200 }).then((download) => {
    const event = { action, suggestedFilename: download.suggestedFilename(), url: page.url() };
    downloadEvents.push(event);
    return event;
  }).catch(() => null);
  await locator.click({ timeout: 1600 }).catch((error) => {
    recordIgnoredError(action, error, page.url());
  });
  await sleep(500);
  const event = await downloadPromise;
  optionalActions.push({ action, status: event ? 'downloaded' : 'clicked-no-download', url: page.url() });
  return Boolean(event);
}

async function triggerFileChooser(page, pattern, action) {
  const locator = page.getByText(pattern).first();
  if (!(await locator.count().catch(() => 0))) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 2200 }).catch(() => null);
  await locator.click({ timeout: 1600 }).catch((error) => {
    recordIgnoredError(action, error, page.url());
  });
  const chooser = await chooserPromise;
  optionalActions.push({
    action,
    status: chooser ? 'filechooser-opened' : 'clicked-no-filechooser',
    multiple: Boolean(chooser?.isMultiple?.()),
    url: page.url(),
  });
  await sleep(700);
  return Boolean(chooser);
}

async function triggerConfirm(page, pattern, action) {
  const locator = page.getByText(pattern).first();
  if (!(await locator.count().catch(() => 0))) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  const dialogPromise = page.waitForEvent('dialog', { timeout: 2200 }).then(async (dialog) => {
    const event = { action, type: dialog.type(), message: dialog.message(), defaultValue: dialog.defaultValue(), url: page.url() };
    dialogEvents.push(event);
    await dialog.dismiss().catch(() => {});
    return event;
  }).catch(() => null);
  await locator.click({ timeout: 1600 }).catch((error) => {
    recordIgnoredError(action, error, page.url());
  });
  const event = await dialogPromise;
  optionalActions.push({ action, status: event ? 'dialog-dismissed' : 'clicked-no-dialog', url: page.url() });
  await sleep(700);
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
    summary: body.replace(/\s+/g, ' ').slice(0, 2000),
    parsedSummary: parsed && typeof parsed === 'object' ? {
      total: parsed.total,
      count: Array.isArray(parsed) ? parsed.length : undefined,
      items: Array.isArray(parsed.items) ? parsed.items.length : undefined,
      data: Array.isArray(parsed.data) ? parsed.data.length : undefined,
      error: parsed.error,
      status: parsed.status,
      activeRiskFlags: parsed.activeRiskFlags,
    } : null,
  };
  apiChecks.push(item);
  return parsed;
}

async function apiPostCheck(context, label, route, data) {
  const response = await context.request.post(`${baseUrl}${route}`, { data }).catch((error) => {
    recordIgnoredError(`api post ${label}`, error, route);
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
    method: 'POST',
    route,
    status: response.status(),
    ok: response.ok(),
    contentType: response.headers()['content-type'] || '',
    summary: body.replace(/\s+/g, ' ').slice(0, 2000),
    parsedSummary: parsed && typeof parsed === 'object' ? {
      error: parsed.error,
      status: parsed.status,
      gradingRunId: parsed.gradingRunId,
      wouldCreateFacts: parsed.wouldCreateFacts,
      blockedFacts: parsed.blockedFacts,
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
  await captureRoute(student, '/missions', '01-student-missions-default.png', 'student missions default');
  await clickText(student, /全部|进行中|待完成|已完成|控制|仿真|伦理/, 'student missions filter action');
  await capture(student, '02-student-missions-after-filter.png', 'student missions after filter', { focusTrail: await focusTrail(student, 10) });
  await clickText(student, /开始|继续|启动|查看|加入|去完成|进入/, 'student missions launch action', 2400);
  await capture(student, '03-student-missions-after-launch-action.png', 'student missions after launch action');
  await captureRoute(student, '/profile/portfolio', '04-student-portfolio-default.png', 'student portfolio default');
  await clickText(student, /课堂作品|仿真设计|伦理整改|提示词|反思|全部/, 'student portfolio category action');
  await capture(student, '05-student-portfolio-after-category.png', 'student portfolio after category');
  await clickText(student, /查看|继续|创建|添加|保存|收录|详情|编辑/, 'student portfolio item/action');
  await capture(student, '06-student-portfolio-after-item-action.png', 'student portfolio after item action', { focusTrail: await focusTrail(student, 10) });
  await apiCheck(studentContext, 'student learning evidence portfolio-like list', '/api/learning-evidence?limit=10');
  await safeCloseContext(studentContext, 'student context');

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  await captureRoute(teacher, '/teacher/grading-workbench', '07-teacher-grading-workbench-default.png', 'teacher grading workbench default', 2600);
  await clickText(teacher, /评分|写回|批准|提交|导出|查看|报告|刷新/, 'teacher grading workbench primary action', 2200);
  await capture(teacher, '08-teacher-grading-workbench-after-primary-action.png', 'teacher grading workbench after primary action', { focusTrail: await focusTrail(teacher, 10) });
  await captureRoute(teacher, '/teacher/grading-workbench?gradingRunId=missing-grading-run', '09-teacher-grading-workbench-missing-run.png', 'teacher grading workbench missing run', 2200);
  await clickText(teacher, /返回|刷新|重新|导入|上传|评分|写回/, 'teacher grading workbench recovery action', 1600);
  await capture(teacher, '10-teacher-grading-workbench-after-recovery-action.png', 'teacher grading workbench after recovery action');
  await apiPostCheck(teacherContext, 'teacher document grading empty submission', '/api/teacher/document-grading/submissions', {});
  await apiPostCheck(teacherContext, 'teacher document grading writeback preview missing run', '/api/teacher/document-grading/writeback-preview', { gradingRunId: 'missing-grading-run' });
  await apiCheck(teacherContext, 'teacher control correction report api', '/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/control-correction-report?export=true');
  await apiCheck(teacherContext, 'teacher assistant effect report api', '/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/assistant-effect-report');
  await safeCloseContext(teacherContext, 'teacher context');

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await captureRoute(admin, '/admin/users', '11-admin-users-default.png', 'admin users default', 2600);
  await triggerDownload(admin, /下载模板|模板|导出/, 'admin users template/download action');
  await capture(admin, '12-admin-users-after-template-download.png', 'admin users after template download', { focusTrail: await focusTrail(admin, 10) });
  await triggerFileChooser(admin, /批量导入|导入|上传/, 'admin users batch import file chooser');
  await capture(admin, '13-admin-users-after-import-entry.png', 'admin users after import entry');
  await fillFirstVisibleInput(admin, 'definitely-no-user-match-20260621', 'admin users search no-match', /(搜索|账号|姓名|邮箱|用户|关键字|search)/i);
  await clickText(admin, /搜索|查询|筛选|应用/, 'admin users execute search');
  await capture(admin, '14-admin-users-after-no-match-search.png', 'admin users after no-match search');
  await clickText(admin, /全部|学生|教师|管理员|角色/, 'admin users role filter action');
  await capture(admin, '15-admin-users-after-role-filter.png', 'admin users after role filter');
  await apiCheck(adminContext, 'admin users no match api', '/api/admin/users?search=definitely-no-user-match-20260621&page=1&pageSize=12');
  await apiCheck(adminContext, 'admin users teacher role api', '/api/admin/users?role=TEACHER&page=1&pageSize=12');
  await apiCheck(adminContext, 'admin users template api', '/api/admin/users/template');
  await safeCloseContext(adminContext, 'admin context');

  const mobileStudentContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true });
  const mobileStudent = await mobileStudentContext.newPage();
  await login(mobileStudent, 'student');
  await captureRoute(mobileStudent, '/missions', '16-mobile-student-missions-default.png', 'mobile student missions default', 2400, { focusTrail: await focusTrail(mobileStudent, 10) });
  await clickText(mobileStudent, /开始|继续|启动|查看|进入|全部|进行中|待完成/, 'mobile student missions action', 1600);
  await capture(mobileStudent, '17-mobile-student-missions-after-action.png', 'mobile student missions after action');
  await captureRoute(mobileStudent, '/profile/portfolio', '18-mobile-student-portfolio-default.png', 'mobile student portfolio default', 2400);
  await clickText(mobileStudent, /课堂作品|仿真设计|伦理整改|提示词|反思|查看|继续|添加/, 'mobile student portfolio action', 1600);
  await capture(mobileStudent, '19-mobile-student-portfolio-after-action.png', 'mobile student portfolio after action');
  await safeCloseContext(mobileStudentContext, 'mobile student context');

  const mobileTeacherContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileTeacher = await mobileTeacherContext.newPage();
  await login(mobileTeacher, 'teacher');
  await captureRoute(mobileTeacher, '/teacher/grading-workbench', '20-mobile-teacher-grading-workbench-default.png', 'mobile teacher grading workbench default', 2600, { focusTrail: await focusTrail(mobileTeacher, 10) });
  await clickText(mobileTeacher, /评分|写回|批准|提交|导出|查看|报告|刷新/, 'mobile teacher grading action', 1800);
  await capture(mobileTeacher, '21-mobile-teacher-grading-workbench-after-action.png', 'mobile teacher grading workbench after action');
  await safeCloseContext(mobileTeacherContext, 'mobile teacher context');

  const mobileAdminContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileAdmin = await mobileAdminContext.newPage();
  await login(mobileAdmin, 'admin');
  await captureRoute(mobileAdmin, '/admin/users', '22-mobile-admin-users-default.png', 'mobile admin users default', 2600);
  await triggerFileChooser(mobileAdmin, /批量导入|导入|上传/, 'mobile admin users batch import file chooser');
  await capture(mobileAdmin, '23-mobile-admin-users-after-import-entry.png', 'mobile admin users after import entry');
  await clickText(mobileAdmin, /全部|学生|教师|管理员|角色|搜索|查询/, 'mobile admin users filter/search action', 1600);
  await capture(mobileAdmin, '24-mobile-admin-users-after-filter-action.png', 'mobile admin users after filter action');
  await safeCloseContext(mobileAdminContext, 'mobile admin context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'student missions and portfolio return flow, teacher grading/report writeback workbench, admin user import batch governance, related APIs, downloads, uploads, and mobile completion-state surfaces',
    screenshotDir: path.relative(root, screenshotDir),
    results,
    routeResponses,
    apiChecks,
    optionalActions,
    downloadEvents,
    dialogEvents,
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
    dialogEvents: dialogEvents.length,
    errors: errors.length,
    ignoredErrors: ignoredErrors.length,
    pngCount: pngFiles.length,
  }, null, 2));
}

async function main49() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const studentContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const student = await studentContext.newPage();
  await login(student, 'student');
  await captureRoute(student, '/assessment/adaptive-practice?demo=1&scene=stable', '01-student-adaptive-stable-default.png', 'student adaptive stable default', 2600);
  await clickButton(student, /生成练习题|展开练习题|重试下一题|打开下一步/, 'student adaptive stable generate or expand', 2400);
  await capture(student, '02-student-adaptive-stable-after-expand.png', 'student adaptive stable after expand', { focusTrail: await focusTrail(student, 10) });
  await clickFirstChoice(student, 'student adaptive stable choose first option');
  await clickButton(student, /提交答案|提交|完成/, 'student adaptive stable submit answer', 2200);
  await capture(student, '03-student-adaptive-stable-after-submit.png', 'student adaptive stable after submit');
  await captureRoute(student, '/assessment/adaptive-practice?demo=1&scene=generate', '04-student-adaptive-generate-default.png', 'student adaptive generate default', 2600);
  await clickButton(student, /生成练习题|展开练习题|重试下一题|打开下一步/, 'student adaptive generate action', 2600);
  await capture(student, '05-student-adaptive-generate-after-action.png', 'student adaptive generate after action');
  await captureRoute(student, '/evaluation/prompt-assessment?autodemo=1', '06-student-prompt-autodemo-default.png', 'student prompt autodemo default', 2600);
  await fillFirstVisibleInput(student, '请从控制目标、约束、证据来源三个方面评价这个提示词。', 'student prompt autodemo fill visible input', /prompt|提示词|评价|文本|内容|输入|global-ai-sidebar-input/i);
  await clickButton(student, /评价提示词质量|过程一致性校验|生成常态化演示轨迹|评价|校验|生成/, 'student prompt autodemo action', 2800);
  await capture(student, '07-student-prompt-autodemo-after-action.png', 'student prompt autodemo after action', { focusTrail: await focusTrail(student, 10) });
  await captureRoute(student, '/profile?from=batch49', '08-student-profile-default.png', 'student profile default', 2200);
  await clickText(student, /执行下一步练习|复盘证据来源|继续练习|自适应|证据|成长|查看/, 'student profile next learning action', 2000);
  await capture(student, '09-student-profile-after-next-action.png', 'student profile after next action');
  await apiCheck(studentContext, 'student recommendations api', '/api/student/recommendations');
  await apiCheck(studentContext, 'student evidence api', '/api/student/evidence');
  await apiCheck(studentContext, 'student competency snapshot api', '/api/student/competency-snapshot');
  await apiCheck(studentContext, 'student latest learning path control correction', '/api/learning-paths/latest?goal=control-correction');
  await safeCloseContext(studentContext, 'student context');

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  await captureRoute(teacher, '/teacher', '10-teacher-dashboard-default.png', 'teacher dashboard default', 2600);
  await clickText(teacher, /报告账本|历史报告|证据与学生|查看证据入口|班级分析|进入/, 'teacher dashboard report or evidence action', 1800);
  await capture(teacher, '11-teacher-dashboard-after-action.png', 'teacher dashboard after action', { focusTrail: await focusTrail(teacher, 10) });
  await captureRoute(teacher, '/teacher/classes/cmma7g0590004g9q2nl2jyzdf', '12-teacher-class-detail-default.png', 'teacher class detail default', 3200);
  await clickText(teacher, /课堂统计|学生清单|证据|画像|详情|分析|报告|查看/, 'teacher class detail evidence/report action', 2200);
  await capture(teacher, '13-teacher-class-detail-after-action.png', 'teacher class detail after action');
  await captureRoute(teacher, '/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics-v2', '14-teacher-class-analytics-default.png', 'teacher class analytics default', 3200);
  await clickText(teacher, /报告|导出|发送|课前包|补强|生成|刷新/, 'teacher class analytics report/remediation action', 2200);
  await capture(teacher, '15-teacher-class-analytics-after-action.png', 'teacher class analytics after action');
  await captureRoute(teacher, '/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/control-correction-report?export=true', '16-teacher-control-report-api-route.png', 'teacher control report api route', 1600);
  await captureRoute(teacher, '/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/assistant-effect-report?export=true', '17-teacher-assistant-effect-report-api-route.png', 'teacher assistant effect report api route', 1600);
  await captureRoute(teacher, '/teacher/prep-packs?classId=cmma7g0590004g9q2nl2jyzdf', '18-teacher-prep-packs-class-default.png', 'teacher prep packs class default', 2600);
  await apiCheck(teacherContext, 'teacher control correction report api', '/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/control-correction-report?export=true');
  await apiCheck(teacherContext, 'teacher assistant effect report api', '/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/assistant-effect-report?export=true');
  await apiCheck(teacherContext, 'teacher class insights api', '/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/insights');
  await safeCloseContext(teacherContext, 'teacher context');

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await captureRoute(admin, '/admin/data-governance?surface=risk-flags', '19-admin-governance-risk-default.png', 'admin governance risk default', 14000);
  await clickText(admin, /课堂质量|证据源|缓存健康|风险类型|学生|来源|详情|查看|证据|刷新|队列|快照/, 'admin governance drilldown action', 2600);
  await capture(admin, '20-admin-governance-after-drilldown.png', 'admin governance after drilldown');
  await captureRoute(admin, '/admin/states', '21-admin-states-default.png', 'admin states default', 2600);
  await clickText(admin, /数据治理|证据浏览器|系统状态|查看|刷新|受限/, 'admin states governance action', 2200);
  await capture(admin, '22-admin-states-after-action.png', 'admin states after action');
  await captureRoute(admin, '/data-center?source=governance-admin', '23-admin-data-center-default.png', 'admin data center default', 2600);
  await triggerDownload(admin, /导出演示快照|导出|下载/, 'admin data center export/download action');
  await clickText(admin, /进入治理复核|查看修复动作|导出可用性|治理/, 'admin data center governance action', 2200);
  await capture(admin, '24-admin-data-center-after-actions.png', 'admin data center after actions');
  await apiCheck(adminContext, 'admin governance status api deep', '/api/admin/data-governance/status');
  await apiCheck(adminContext, 'admin overview api', '/api/admin/overview');
  await safeCloseContext(adminContext, 'admin context');

  const mobileStudentContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true });
  const mobileStudent = await mobileStudentContext.newPage();
  await login(mobileStudent, 'student');
  await captureRoute(mobileStudent, '/assessment/adaptive-practice?demo=1&scene=stable', '25-mobile-student-adaptive-default.png', 'mobile student adaptive default', 2600);
  await clickButton(mobileStudent, /生成练习题|展开练习题|打开下一步/, 'mobile student adaptive action', 2200);
  await capture(mobileStudent, '26-mobile-student-adaptive-after-action.png', 'mobile student adaptive after action', { focusTrail: await focusTrail(mobileStudent, 10) });
  await captureRoute(mobileStudent, '/evaluation/prompt-assessment?autodemo=1', '27-mobile-student-prompt-autodemo-default.png', 'mobile student prompt autodemo default', 2400);
  await captureRoute(mobileStudent, '/profile?from=batch49', '28-mobile-student-profile-default.png', 'mobile student profile default', 2400);
  await safeCloseContext(mobileStudentContext, 'mobile student context');

  const mobileTeacherContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileTeacher = await mobileTeacherContext.newPage();
  await login(mobileTeacher, 'teacher');
  await captureRoute(mobileTeacher, '/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics-v2', '29-mobile-teacher-class-analytics-default.png', 'mobile teacher class analytics default', 3200);
  await captureRoute(mobileTeacher, '/teacher/prep-packs?classId=cmma7g0590004g9q2nl2jyzdf', '30-mobile-teacher-prep-packs-default.png', 'mobile teacher prep packs default', 2600);
  await safeCloseContext(mobileTeacherContext, 'mobile teacher context');

  const mobileAdminContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileAdmin = await mobileAdminContext.newPage();
  await login(mobileAdmin, 'admin');
  await captureRoute(mobileAdmin, '/admin/data-governance?surface=risk-flags', '31-mobile-admin-governance-default.png', 'mobile admin governance default', 12000);
  await captureRoute(mobileAdmin, '/data-center?source=governance-admin', '32-mobile-admin-data-center-default.png', 'mobile admin data center default', 2600);
  await safeCloseContext(mobileAdminContext, 'mobile admin context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'adaptive-practice demo completion, prompt assessment autodemo, student profile next action, teacher report/class analytics/prep-pack states, admin governance/data-center states, related APIs, exports, and mobile completion-state surfaces',
    screenshotDir: path.relative(root, screenshotDir),
    results,
    routeResponses,
    apiChecks,
    optionalActions,
    downloadEvents,
    dialogEvents,
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
    dialogEvents: dialogEvents.length,
    errors: errors.length,
    ignoredErrors: ignoredErrors.length,
    pngCount: pngFiles.length,
  }, null, 2));
}

main49()
  .catch((error) => {
    recordError('main', error);
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {});
  });
