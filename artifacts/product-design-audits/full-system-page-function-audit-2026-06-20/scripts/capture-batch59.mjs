import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/95-function-state-flows-batch59-final-closure');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch59-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile390 = { width: 390, height: 844 };
const mobile320 = { width: 320, height: 844 };
const classId = 'cmma7g0590004g9q2nl2jyzdf';
const studentId = 'demo';

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
    const active = document.activeElement;
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 40),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        role: active?.getAttribute?.('role') || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
      },
      visibleControls: controls.filter((control) => !control.hidden).slice(0, 180),
      controls,
      alerts,
      dialogs: [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].map((el) => ({
        role: el.getAttribute('role') || '',
        modal: el.getAttribute('aria-modal') || '',
        name: name(el).slice(0, 240),
      })),
      bodyText: bodyText.slice(0, 26000),
      actionSignals: {
        success: /成功|已保存|已提交|已完成|完成|已复制|已下载|导出完成|生成完成|共 0 条|暂无/.test(bodyText),
        loading: /加载|生成中|提交中|处理中|正在|等待|排队/.test(bodyText),
        failure: /失败|错误|异常|无法|不可用|未找到|无权限|重试|404|405/.test(bodyText),
        report: /报告|导出|发送|复制|下载|评分|复盘|补强|账本|草稿|反馈/.test(bodyText),
        governance: /治理|风险|处置|分派|标记|撤销|审计|证据源|质量|批次/.test(bodyText),
        mobileBurden: /筛选|分页|上一页|下一页|导入|导出|搜索|重置/.test(bodyText),
      },
      scroll: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        y: window.scrollY,
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
      mobileBurdenText: audit.actionSignals.mobileBurden,
      horizontalOverflow: audit.scroll.width > audit.scroll.viewportWidth + 8,
      longPage: audit.scroll.height > audit.scroll.viewportHeight * 4,
    },
  };
}

async function focusTrail(page, steps = 12) {
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
  apiChecks.push({
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
      report: parsed.report ? 'present' : undefined,
      export: parsed.export ? 'present' : undefined,
    } : null,
  });
  return parsed;
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
  await captureRoute(student, '/assessment/document-feedback?demo=1&source=batch59&assignment=report-control-design&criterion=model-assumptions&status=returned&intent=revise', '01-student-feedback-demo-revise-entry.png', 'student feedback demo revise entry', 3200);
  await clickText(student, /修订|采用|完成|写回|练习|证据|任务|反馈|返回/, 'student feedback revise primary action batch59', 1800);
  await capture(student, '02-student-feedback-after-revise-action.png', 'student feedback after revise action', { focusTrail: await focusTrail(student, 12) });
  await captureRoute(student, '/assessment/adaptive-practice?source=batch59&intent=document-feedback&assignment=report-control-design&criterion=model-assumptions&returnTo=/assessment/document-feedback', '03-student-adaptive-feedback-returnto.png', 'student adaptive feedback returnTo', 3000);
  await clickText(student, /开始|练习|提交|完成|生成|证据|返回|反馈/, 'student adaptive feedback execute batch59', 1800);
  await capture(student, '04-student-adaptive-feedback-after-action.png', 'student adaptive feedback after action');
  await captureRoute(student, '/missions?source=batch59&assignment=report-control-design&intent=start&status=returned&returnTo=/assessment/document-feedback', '05-student-missions-feedback-start-entry.png', 'student missions feedback start entry', 2800);
  await fillVisibleInput(student, 'report-control-design', 'student missions feedback task search batch59');
  await clickText(student, /开始|继续|挑战|完成|证据|返回|任务/, 'student missions feedback start action batch59', 1800);
  await capture(student, '06-student-missions-feedback-after-start.png', 'student missions feedback after start');
  await captureRoute(student, '/profile/evidence?source=batch59&assignment=report-control-design&status=completed&returnTo=/assessment/document-feedback', '07-student-evidence-feedback-writeback-target.png', 'student evidence feedback writeback target', 2800);
  await captureRoute(student, '/profile/growth?source=batch59&assignment=report-control-design&status=completed&returnTo=/assessment/document-feedback', '08-student-growth-feedback-writeback-target.png', 'student growth feedback writeback target', 2800);
  await captureRoute(student, '/profile/portfolio?source=batch59&assignment=report-control-design&intent=collect&status=completed&returnTo=/assessment/document-feedback', '09-student-portfolio-feedback-writeback-target.png', 'student portfolio feedback writeback target', 2800);
  await apiRequestCheck(studentContext, 'student evidence assignment completed batch59', '/api/student/evidence?assignment=report-control-design&status=completed&limit=5');
  await apiRequestCheck(studentContext, 'learning evidence assignment completed batch59', '/api/learning-evidence?assignment=report-control-design&status=completed&limit=5');
  await apiRequestCheck(studentContext, 'missions assignment start batch59', '/api/missions?assignment=report-control-design&status=returned');
  await apiRequestCheck(studentContext, 'latest path document feedback batch59', '/api/learning-paths/latest?goal=control-correction&intent=document-feedback');
  await safeCloseContext(studentContext, 'student context');

  const teacherContext = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  await captureRoute(teacher, `/teacher/classes/${classId}?source=batch59&mobile=390&focus=students-actions`, '10-mobile-390-teacher-class-detail-actions.png', 'mobile 390 teacher class detail actions', 3200);
  await fillVisibleInput(teacher, 'zzzz-batch59-no-match', 'mobile teacher class search no-match batch59');
  await capture(teacher, '11-mobile-390-teacher-class-after-search.png', 'mobile 390 teacher class after search', { focusTrail: await focusTrail(teacher, 12) });
  await captureRoute(teacher, `/teacher/classes/${classId}/analytics-v2?source=batch59&mobile=390&surface=long-report&action=export`, '12-mobile-390-teacher-analytics-long-report.png', 'mobile 390 teacher analytics long report', 4200);
  await triggerDownload(teacher, /导出|下载|报告|PDF|快照|发送/, 'mobile teacher analytics export batch59');
  await capture(teacher, '13-mobile-390-teacher-analytics-after-export.png', 'mobile 390 teacher analytics after export');
  await captureRoute(teacher, `/teacher/grading-workbench?demo=1&source=batch59&mobile=390&assignment=report-control-design&status=draft&action=approve`, '14-mobile-390-teacher-grading-draft-approve.png', 'mobile 390 teacher grading draft approve', 3200);
  await clickText(teacher, /审批|通过|退回|写回|提交|评分|反馈|刷新/, 'mobile teacher grading draft approve batch59', 2000);
  await capture(teacher, '15-mobile-390-teacher-grading-after-approve.png', 'mobile 390 teacher grading after approve');
  await captureRoute(teacher, `/teacher/students/${studentId}/evidence?source=batch59&assignment=report-control-design&returnTo=/teacher/grading-workbench`, '16-mobile-390-teacher-student-evidence-returnto.png', 'mobile 390 teacher student evidence returnTo', 3200);
  await apiRequestCheck(teacherContext, 'teacher class insights mobile batch59', `/api/teacher/classes/${classId}/insights`);
  await apiRequestCheck(teacherContext, 'teacher control correction report export batch59', `/api/teacher/classes/${classId}/control-correction-report?export=true`);
  await apiRequestCheck(teacherContext, 'document grading submissions mobile batch59', `/api/teacher/document-grading/submissions?classId=${classId}&assignment=report-control-design`);
  await safeCloseContext(teacherContext, 'mobile teacher context');

  const adminContext = await browser.newContext({ viewport: mobile320, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await captureRoute(admin, '/admin/users?source=batch59&mobile=320&role=STUDENT&q=zzzz-batch59-no-match&page=2&pageSize=5&action=export', '17-mobile-320-admin-users-no-match-export.png', 'mobile 320 admin users no-match export', 3200);
  await fillVisibleInput(admin, 'zzzz-batch59-no-match', 'mobile admin users visible no-match search batch59');
  await triggerDownload(admin, /导出|下载|模板|用户|账号/, 'mobile admin users export batch59');
  await capture(admin, '18-mobile-320-admin-users-after-export.png', 'mobile 320 admin users after export', { focusTrail: await focusTrail(admin, 12) });
  await captureRoute(admin, '/admin/data-governance?source=batch59&mobile=320&tab=risks&riskId=missing-batch59&action=resolve', '19-mobile-320-admin-governance-risk-resolve.png', 'mobile 320 admin governance risk resolve', 9000);
  await clickText(admin, /处置|解决|分派|撤销|导出|刷新|风险|证据/, 'mobile admin governance risk resolve batch59', 2400);
  await capture(admin, '20-mobile-320-admin-governance-after-resolve.png', 'mobile 320 admin governance after resolve');
  await captureRoute(admin, '/admin/config?source=batch59&mobile=320&focus=audit&provider=SiliconFlow&model=missing-batch59&action=test', '21-mobile-320-admin-config-audit-model-test.png', 'mobile 320 admin config audit model test', 3200);
  await clickText(admin, /测试|保存|重置|添加|审计|配置|模型/, 'mobile admin config model test batch59', 2400);
  await capture(admin, '22-mobile-320-admin-config-after-model-test.png', 'mobile 320 admin config after model test');
  await captureRoute(admin, '/admin/states?source=batch59&mobile=320&focus=usage-export', '23-mobile-320-admin-states-usage-export.png', 'mobile 320 admin states usage export', 3200);
  await triggerDownload(admin, /导出|下载|报告|统计|快照/, 'mobile admin states export batch59');
  await capture(admin, '24-mobile-320-admin-states-after-export.png', 'mobile 320 admin states after export');
  await apiRequestCheck(adminContext, 'admin users mobile no-match batch59', '/api/admin/users?role=STUDENT&q=zzzz-batch59-no-match&page=2&pageSize=5');
  await apiRequestCheck(adminContext, 'admin governance status mobile batch59', '/api/admin/data-governance/status');
  await apiRequestCheck(adminContext, 'admin system usage mobile batch59', '/api/admin/system-usage');
  await safeCloseContext(adminContext, 'mobile admin context');

  const mobileStudentContext = await browser.newContext({ viewport: mobile320, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileStudent = await mobileStudentContext.newPage();
  await login(mobileStudent, 'student');
  await captureRoute(mobileStudent, '/assessment/document-feedback?demo=1&source=batch59&mobile=320&assignment=report-control-design&status=returned&intent=revise', '25-mobile-320-student-feedback-revise.png', 'mobile 320 student feedback revise', 3200);
  await captureRoute(mobileStudent, '/profile/portfolio?source=batch59&mobile=320&assignment=report-control-design&intent=collect&status=completed&returnTo=/assessment/document-feedback', '26-mobile-320-student-portfolio-feedback-collect.png', 'mobile 320 student portfolio feedback collect', 3200);
  await safeCloseContext(mobileStudentContext, 'mobile student context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'Final closure audit for remaining long-list mobile operability and student feedback task vertical flow: document feedback revision, adaptive/missions/evidence/portfolio writeback, teacher mobile reports/grading/student evidence, admin mobile users/governance/config/states, and supporting API contracts.',
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
