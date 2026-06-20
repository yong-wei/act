import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/81-function-state-flows-batch46');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch46-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };
const noMatchQuery = 'zzzz-action-audit-20260620';

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
  admin: { account: 'admin', password: 'admin@Just' },
};

const results = [];
const routeResponses = [];
const apiChecks = [];
const optionalActions = [];
const dialogEvents = [];
const downloadEvents = [];
const fileChooserEvents = [];
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
    const tables = [...document.querySelectorAll('table')].map((table) => ({
      headers: [...table.querySelectorAll('th')].map(text).filter(Boolean),
      rowCount: table.querySelectorAll('tbody tr').length,
      caption: text(table.querySelector('caption')),
    }));
    const cards = [...document.querySelectorAll('[data-card], article, li, .card, [class*="rounded"]')]
      .filter(visible)
      .map((el) => text(el).slice(0, 220))
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
      visibleControls: controls.filter((control) => !control.hidden).slice(0, 110),
      alerts: statusRegions,
      dialogs,
      tables,
      cards,
      bodyText: bodyText.slice(0, 18000),
      actionSignals: {
        validation: /必填|不能为空|请输入|格式|错误|失败|无效|请选择|不能/.test(bodyText),
        success: /成功|已保存|已复制|已下载|完成|已刷新|已提交/.test(bodyText),
        destructive: /删除|移除|撤销|重置|确认|危险|不可恢复/.test(bodyText),
        batch: /批量|导入|模板|预览|失败行|通知|撤销|审计|下载/.test(bodyText),
        status: statusRegions.length > 0 || /加载|成功|失败|完成|正在|暂无|无匹配|已刷新/.test(bodyText),
        dialogOpen: dialogs.length > 0,
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
      dialogOpen: audit.dialogs.length > 0,
      hasAlert: audit.alerts.length > 0,
      validationText: audit.actionSignals.validation,
      successText: audit.actionSignals.success,
      batchText: audit.actionSignals.batch,
      destructiveText: audit.actionSignals.destructive,
      horizontalOverflow: audit.scroll.width > audit.scroll.viewportWidth + 8,
    },
  };
}

async function focusTrail(page, steps = 10) {
  const trail = [];
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab').catch(() => {});
    await sleep(80);
    const active = await page.evaluate(() => {
      const el = document.activeElement;
      const text = (node) => (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        tag: el?.tagName?.toLowerCase() || '',
        role: el?.getAttribute?.('role') || '',
        type: el?.getAttribute?.('type') || '',
        name: el?.getAttribute?.('aria-label') || el?.getAttribute?.('placeholder') || text(el).slice(0, 120),
      };
    }).catch(() => null);
    trail.push(active);
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

async function clickByRoleName(page, name, action, waitMs = 1000) {
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

async function clickText(page, pattern, action, waitMs = 1000) {
  const locator = page.getByText(pattern).first();
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

async function fillVisibleTextInput(page, action, value, pattern = /(搜索|查找|账号|姓名|学号|课堂码|班级|学生|标题|名称|备注|邮箱|密码|工号|关键词|code|name|search|query|q)/i) {
  const candidates = page.locator('input:not([type="file"]):not([type="hidden"]), textarea');
  const count = await candidates.count().catch(() => 0);
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

async function triggerNativeConfirm(page, pattern, action) {
  const locator = page.getByText(pattern).first();
  if (!(await locator.count())) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  const dialogPromise = page.waitForEvent('dialog', { timeout: 1800 }).then(async (dialog) => {
    const event = { action, type: dialog.type(), message: dialog.message(), defaultValue: dialog.defaultValue(), url: page.url() };
    dialogEvents.push(event);
    await dialog.dismiss().catch(() => {});
    return event;
  }).catch(() => {
    return null;
  });
  let clicked = true;
  await locator.click({ timeout: 1200 }).catch(() => {
    clicked = false;
  });
  const event = await dialogPromise;
  optionalActions.push({ action, status: clicked ? (event ? 'dialog-dismissed' : 'clicked-no-dialog') : 'not-found', url: page.url() });
  await sleep(900);
  return Boolean(event);
}

async function triggerDownload(page, pattern, action) {
  const locator = page.getByText(pattern).first();
  if (!(await locator.count())) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  const downloadPromise = page.waitForEvent('download', { timeout: 1800 }).then((download) => {
    const event = { action, suggestedFilename: download.suggestedFilename(), url: page.url() };
    downloadEvents.push(event);
    return event;
  }).catch(() => {
    return null;
  });
  let clicked = true;
  await locator.click({ timeout: 1200 }).catch(() => {
    clicked = false;
  });
  await sleep(400);
  const event = await downloadPromise;
  optionalActions.push({ action, status: clicked ? (event ? 'downloaded' : 'clicked-no-download') : 'click-failed', url: page.url() });
  return Boolean(event);
}

async function triggerFileChooser(page, pattern, action) {
  const locator = page.getByText(pattern).first();
  if (!(await locator.count())) {
    optionalActions.push({ action, status: 'not-found', url: page.url() });
    return false;
  }
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 1800 }).then((chooser) => {
    const event = { action, isMultiple: chooser.isMultiple(), url: page.url() };
    fileChooserEvents.push(event);
    return event;
  }).catch(() => {
    return null;
  });
  let clicked = true;
  await locator.click({ timeout: 1200 }).catch(() => {
    clicked = false;
  });
  await sleep(400);
  const event = await chooserPromise;
  optionalActions.push({ action, status: clicked ? (event ? 'filechooser-opened' : 'clicked-no-filechooser') : 'click-failed', url: page.url() });
  return Boolean(event);
}

async function apiCheck(context, label, route) {
  const response = await context.request.get(`${baseUrl}${route}`).catch((error) => {
    recordError(`api ${label}`, error, route);
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
    summary: body.replace(/\s+/g, ' ').slice(0, 1800),
    parsedSummary: parsed && typeof parsed === 'object' ? {
      total: parsed.total,
      count: Array.isArray(parsed) ? parsed.length : undefined,
      users: Array.isArray(parsed.users) ? parsed.users.length : undefined,
      items: Array.isArray(parsed.items) ? parsed.items.length : undefined,
      data: Array.isArray(parsed.data) ? parsed.data.length : undefined,
      id: parsed.id,
      code: parsed.code,
      error: parsed.error,
    } : null,
  };
  apiChecks.push(item);
  return parsed;
}

async function firstTeacherClassId(context) {
  const parsed = await apiCheck(context, 'teacher classes for action audit', '/api/teacher/classes');
  const preferred = 'cmma7g0590004g9q2nl2jyzdf';
  if (Array.isArray(parsed) && parsed.some((item) => item?.id === preferred)) return preferred;
  return preferred;
}

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const studentContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const student = await studentContext.newPage();
  await login(student, 'student');
  await captureRoute(student, '/classroom/join', '01-student-classroom-join-default.png', 'student classroom join default');
  await clickByRoleName(student, /加入|进入|查询|提交/i, 'student join empty code');
  await capture(student, '02-student-classroom-join-empty-submit.png', 'student classroom join empty submit', { focusTrail: await focusTrail(student, 8) });
  await fillVisibleTextInput(student, 'student join short classroom code', '123', /(课堂码|code|加入|班级|输入6位数字|数字)/i);
  await clickByRoleName(student, /加入|进入|查询|提交/i, 'student join short code submit');
  await capture(student, '03-student-classroom-join-short-code.png', 'student classroom join short code');
  await fillVisibleTextInput(student, 'student join invalid six digit code', '999999', /(课堂码|code|加入|班级|输入6位数字|数字)/i);
  await clickByRoleName(student, /加入|进入|查询|提交/i, 'student join invalid six digit submit');
  await capture(student, '04-student-classroom-join-invalid-six-digit.png', 'student classroom join invalid six digit');
  await studentContext.close();

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  const classId = await firstTeacherClassId(teacherContext);
  if (classId) {
    await captureRoute(teacher, `/teacher/classes/${classId}`, '05-teacher-class-members-default.png', 'teacher class members default', 2400, { classId });
    await clickText(teacher, /添加学生|新增学生|邀请学生/, 'teacher open add student dialog');
    await capture(teacher, '06-teacher-add-student-dialog.png', 'teacher add student dialog', { focusTrail: await focusTrail(teacher, 10), classId });
    await fillVisibleTextInput(teacher, 'teacher add student no match search', noMatchQuery, /(搜索|学生|姓名|学号|账号)/i);
    await capture(teacher, '07-teacher-add-student-no-match.png', 'teacher add student no match', { classId });
    await teacher.keyboard.press('Escape').catch(() => {});
    await sleep(600);
    await capture(teacher, '08-teacher-after-add-student-escape.png', 'teacher after add student escape', { classId });
    await triggerFileChooser(teacher, /导入|Excel|批量/, 'teacher class student import file chooser');
    await capture(teacher, '09-teacher-class-student-import-entry.png', 'teacher class student import entry', { classId });
    await triggerNativeConfirm(teacher, /移除|删除/, 'teacher class student remove confirm');
    await capture(teacher, '10-teacher-class-student-remove-confirm-dismissed.png', 'teacher class student remove confirm dismissed', { classId });
  } else {
    optionalActions.push({ action: 'teacher class detail audit', status: 'no-class-id', url: teacher.url() });
  }
  await teacherContext.close();

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await captureRoute(admin, '/admin/users', '11-admin-users-action-area-default.png', 'admin users action area default');
  await clickText(admin, /新建账号/, 'admin open create account modal');
  await capture(admin, '12-admin-create-account-modal.png', 'admin create account modal', { focusTrail: await focusTrail(admin, 10) });
  await clickByRoleName(admin, /创建|保存|确认|提交/, 'admin submit empty create account modal');
  await capture(admin, '13-admin-create-account-empty-validation.png', 'admin create account empty validation');
  await gotoStable(admin, '/admin/users', 1600);
  await triggerDownload(admin, /下载模板/, 'admin users template download');
  await capture(admin, '14-admin-users-template-download-state.png', 'admin users template download state');
  await gotoStable(admin, '/admin/users', 1600);
  await triggerFileChooser(admin, /批量导入|导入/, 'admin users import file chooser');
  await capture(admin, '15-admin-users-import-entry.png', 'admin users import entry');
  await captureRoute(admin, '/admin/config', '16-admin-config-default.png', 'admin config default', 2400);
  await clickText(admin, /保存配置/, 'admin config save attempt');
  await capture(admin, '17-admin-config-after-save-attempt.png', 'admin config after save attempt', { focusTrail: await focusTrail(admin, 8) });
  await clickText(admin, /测试模型|测试连接|模型测试/, 'admin config model test attempt');
  await capture(admin, '18-admin-config-after-model-test.png', 'admin config after model test');
  await captureRoute(admin, '/admin/data-governance', '19-admin-data-governance-default.png', 'admin data governance default', 9000);
  await clickText(admin, /刷新数据|刷新|重新扫描|重新检查/, 'admin data governance refresh', 2400);
  await capture(admin, '20-admin-data-governance-after-refresh.png', 'admin data governance after refresh');
  await clickText(admin, /证据源|课堂质量|缓存健康|风险|队列/, 'admin data governance tab switch', 1800);
  await capture(admin, '21-admin-data-governance-after-tab-switch.png', 'admin data governance after tab switch');
  await apiCheck(adminContext, 'admin users template download api', '/api/admin/users/template');
  await apiCheck(adminContext, 'admin data governance status api', '/api/admin/data-governance/status');
  await adminContext.close();

  const adminMobileContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const adminMobile = await adminMobileContext.newPage();
  await login(adminMobile, 'admin');
  await captureRoute(adminMobile, '/admin/config', '22-mobile-admin-config-default.png', 'mobile admin config default', 2400, { focusTrail: await focusTrail(adminMobile, 10) });
  await captureRoute(adminMobile, '/admin/data-governance', '23-mobile-admin-data-governance-default.png', 'mobile admin data governance default', 9000);
  await adminMobileContext.close();

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'cross-role validation, destructive confirmations, batch/download/file chooser states, governance/config completion feedback, and mobile action surfaces',
    screenshotDir: path.relative(root, screenshotDir),
    results,
    routeResponses,
    apiChecks,
    optionalActions,
    dialogEvents,
    downloadEvents,
    fileChooserEvents,
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
    dialogEvents: dialogEvents.length,
    downloadEvents: downloadEvents.length,
    fileChooserEvents: fileChooserEvents.length,
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
