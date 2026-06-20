import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/82-function-state-flows-batch47');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch47-manifest.json');
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
  await captureRoute(student, '/assessment/adaptive-practice', '01-student-adaptive-practice-default.png', 'student adaptive practice default');
  await clickFirstChoice(student, 'student adaptive practice choose first answer');
  await clickButton(student, /提交|完成|下一步/, 'student adaptive practice submit');
  await capture(student, '02-student-adaptive-practice-after-submit.png', 'student adaptive practice after submit', { focusTrail: await focusTrail(student, 10) });
  await captureRoute(student, '/evaluation/prompt-assessment', '03-student-prompt-assessment-default.png', 'student prompt assessment default');
  await fillFirstVisibleInput(student, '请评价这个控制系统提示词是否能引导学生解释稳态误差。', 'student prompt assessment fill prompt');
  await clickButton(student, /评价|校验|生成|提交|开始/, 'student prompt assessment async action', 2600);
  await capture(student, '04-student-prompt-assessment-after-action.png', 'student prompt assessment after action', { focusTrail: await focusTrail(student, 10) });
  await captureRoute(student, '/profile/evidence', '05-student-evidence-default.png', 'student evidence default');
  await clickText(student, /查看|详情|复盘|补练|继续练习/, 'student evidence follow-up action');
  await capture(student, '06-student-evidence-after-follow-up.png', 'student evidence after follow-up action');
  await apiCheck(studentContext, 'student latest learning path control correction', '/api/learning-paths/latest?goal=control-correction');
  await safeCloseContext(studentContext, 'student context');

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  await captureRoute(teacher, '/teacher/history', '07-teacher-history-default.png', 'teacher history default');
  await clickText(teacher, /复盘|报告|查看|导出|发送/, 'teacher history report/review action');
  await capture(teacher, '08-teacher-history-after-report-action.png', 'teacher history after report action', { focusTrail: await focusTrail(teacher, 10) });
  await captureRoute(teacher, '/classroom/teacher/cmqm6s1s1001f1wyf4ggkifs5/review', '09-teacher-finished-class-review-default.png', 'teacher finished class review default', 2600);
  await clickText(teacher, /导出|发送|复制|补强|生成|报告/, 'teacher finished review delivery action', 2000);
  await capture(teacher, '10-teacher-finished-class-review-after-delivery-action.png', 'teacher finished class review after delivery action');
  await captureRoute(teacher, '/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics-v2', '11-teacher-class-analytics-default.png', 'teacher class analytics default', 2600);
  await clickText(teacher, /导出|报告|补强|课前包|生成|发送/, 'teacher class analytics delivery/remediation action', 2000);
  await capture(teacher, '12-teacher-class-analytics-after-action.png', 'teacher class analytics after action');
  await captureRoute(teacher, '/data-center', '13-teacher-data-center-default.png', 'teacher data center default', 2600);
  await triggerDownload(teacher, /导出|下载/, 'teacher data center export/download action');
  await capture(teacher, '14-teacher-data-center-after-export.png', 'teacher data center after export action');
  await apiCheck(teacherContext, 'teacher class detail api', '/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf');
  await safeCloseContext(teacherContext, 'teacher context');

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await captureRoute(admin, '/admin', '15-admin-overview-default.png', 'admin overview default', 2600);
  await clickText(admin, /刷新|导出|查看|治理|风险|异常/, 'admin overview action');
  await capture(admin, '16-admin-overview-after-action.png', 'admin overview after action', { focusTrail: await focusTrail(admin, 10) });
  await captureRoute(admin, '/admin/data-governance', '17-admin-data-governance-deep-default.png', 'admin data governance deep default', 14000);
  await clickText(admin, /查看证据|处置|分派|标记|导出|刷新|课堂质量|证据源|缓存健康/, 'admin governance disposition/export action', 2400);
  await capture(admin, '18-admin-data-governance-after-disposition-action.png', 'admin data governance after disposition/export action');
  await triggerConfirm(admin, /撤销|重置|删除|清空/, 'admin destructive/reversal confirm');
  await capture(admin, '19-admin-after-destructive-confirm-attempt.png', 'admin after destructive confirm attempt');
  await apiCheck(adminContext, 'admin governance status api', '/api/admin/data-governance/status');
  await apiCheck(adminContext, 'admin overview api', '/api/admin/overview');
  await safeCloseContext(adminContext, 'admin context');

  const mobileStudentContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true });
  const mobileStudent = await mobileStudentContext.newPage();
  await login(mobileStudent, 'student');
  await captureRoute(mobileStudent, '/evaluation/prompt-assessment', '20-mobile-student-prompt-assessment-default.png', 'mobile student prompt assessment default', 2400, { focusTrail: await focusTrail(mobileStudent, 10) });
  await captureRoute(mobileStudent, '/profile/evidence', '21-mobile-student-evidence-default.png', 'mobile student evidence default', 2400);
  await safeCloseContext(mobileStudentContext, 'mobile student context');

  const mobileTeacherContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileTeacher = await mobileTeacherContext.newPage();
  await login(mobileTeacher, 'teacher');
  await captureRoute(mobileTeacher, '/classroom/teacher/cmqm6s1s1001f1wyf4ggkifs5/review', '22-mobile-teacher-review-default.png', 'mobile teacher review default', 2600, { focusTrail: await focusTrail(mobileTeacher, 10) });
  await safeCloseContext(mobileTeacherContext, 'mobile teacher context');

  const mobileAdminContext = await browser.newContext({ viewport: mobile, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileAdmin = await mobileAdminContext.newPage();
  await login(mobileAdmin, 'admin');
  await captureRoute(mobileAdmin, '/admin/data-governance', '23-mobile-admin-governance-deep-default.png', 'mobile admin governance deep default', 12000);
  await clickText(mobileAdmin, /查看证据|处置|分派|标记|导出|刷新|课堂质量|证据源|缓存健康/, 'mobile admin governance action', 2000);
  await capture(mobileAdmin, '24-mobile-admin-governance-after-action.png', 'mobile admin governance after action');
  await safeCloseContext(mobileAdminContext, 'mobile admin context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'completion feedback, report delivery, export/download, governance disposition, prompt assessment, evidence follow-up, and mobile completion-state surfaces',
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

main()
  .catch((error) => {
    recordError('main', error);
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {});
  });
