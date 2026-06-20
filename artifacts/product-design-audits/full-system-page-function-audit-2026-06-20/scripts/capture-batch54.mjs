import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/90-function-state-flows-batch54-report-ai-feedback');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch54-manifest.json');
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


async function hrefForFirst(page, pattern, label) {
  const href = await page.evaluate((source) => {
    const regex = new RegExp(source, 'i');
    const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href') || '', text: (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim() }));
    return links.find((link) => regex.test(link.href) || regex.test(link.text))?.href || '';
  }, pattern.source).catch(() => '');
  optionalActions.push({ action: label, status: href ? 'found' : 'not-found', href, url: page.url() });
  return href;
}

async function fillVisibleEditableInput(page, value, action, pattern = /(搜索|查找|关键词|标题|名称|资源|教案|节点|query|search|q)/i) {
  const handles = await page.locator('input:not([type="hidden"]):not([type="file"]), textarea').all().catch(() => []);
  for (const locator of handles) {
    const meta = await locator.evaluate((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && !el.disabled;
      const text = (node) => (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        visible,
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
    await sleep(1400);
    optionalActions.push({ action, status: 'filled', value, meta: meta.descriptor.trim().slice(0, 240), url: page.url() });
    return true;
  }
  optionalActions.push({ action, status: 'not-found', value, url: page.url() });
  return false;
}

async function postJson(context, label, route, body = {}) {
  const response = await context.request.post(`${baseUrl}${route}`, {
    data: body,
    headers: { 'content-type': 'application/json' },
  }).catch((error) => {
    recordIgnoredError(`api ${label}`, error, route);
    return null;
  });
  if (!response) return null;
  const text = await response.text().catch(() => '');
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const item = {
    label,
    route,
    method: 'POST',
    status: response.status(),
    ok: response.ok(),
    contentType: response.headers()['content-type'] || '',
    summary: text.replace(/\s+/g, ' ').slice(0, 2400),
    parsedSummary: parsed && typeof parsed === 'object' ? {
      error: parsed.error,
      status: parsed.status,
      id: parsed.id,
      message: parsed.message,
      score: parsed.score,
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback.slice(0, 160) : undefined,
      items: Array.isArray(parsed.items) ? parsed.items.length : undefined,
      data: Array.isArray(parsed.data) ? parsed.data.length : undefined,
    } : null,
  };
  apiChecks.push(item);
  return parsed;
}

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const studentContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const student = await studentContext.newPage();
  await login(student, 'student');

  await captureRoute(student, '/assessment/document-feedback?demo=1&source=batch54', '01-student-document-feedback-default.png', 'student document feedback default', 3000);
  await clickText(student, /导出|下载|采用|练习|证据|已读|复制|下一步|返回/, 'student document feedback primary action', 2200);
  await capture(student, '02-student-document-feedback-after-action.png', 'student document feedback after action', { focusTrail: await focusTrail(student, 12) });

  await captureRoute(student, '/evaluation/prompt-assessment?source=batch54&autodemo=1', '03-student-prompt-assessment-default.png', 'student prompt assessment default', 3000);
  await fillVisibleEditableInput(student, '请评价这个控制系统提示词：目标是让学生解释阻尼比对超调量的影响。', 'student prompt assessment visible input', /(提示词|prompt|输入|内容|评价|文本|message|问题)/i);
  await clickText(student, /评价|评估|校验|生成|提交|保存|开始|演示/, 'student prompt assessment action', 2600);
  await capture(student, '04-student-prompt-assessment-after-action.png', 'student prompt assessment after action', { focusTrail: await focusTrail(student, 12) });
  await apiCheck(studentContext, 'prompt history api batch54', '/api/evaluation/prompt-history/demo');

  await captureRoute(student, '/ai?source=batch54', '05-student-ai-workshop-default.png', 'student ai workshop default', 2800);
  await fillVisibleEditableInput(student, '如何根据课堂证据安排一次补强练习？', 'student ai workshop input', /(输入|问题|消息|message|prompt|问控灵|搜索)/i);
  await clickText(student, /发送|提问|生成|开始|试试|建议|清空|停止/, 'student ai workshop action', 4500);
  await capture(student, '06-student-ai-workshop-after-action.png', 'student ai workshop after action', { focusTrail: await focusTrail(student, 12) });

  await captureRoute(student, '/ai/copilot?source=batch54&context=evidence', '07-student-copilot-default.png', 'student copilot default', 2800);
  await fillVisibleEditableInput(student, '基于我的证据，下一步该练什么？', 'student copilot input', /(输入|问题|消息|message|prompt|问控灵|搜索)/i);
  await clickText(student, /发送|提问|生成|开始|建议|清空|停止/, 'student copilot action', 4500);
  await capture(student, '08-student-copilot-after-action.png', 'student copilot after action', { focusTrail: await focusTrail(student, 12) });

  await captureRoute(student, '/profile/portfolio?source=batch54&category=reflection', '09-student-portfolio-reflection-default.png', 'student portfolio reflection default', 2600);
  await clickText(student, /反思|收录|添加|提交|编辑|进入|查看|课程/, 'student portfolio reflection action', 2200);
  await capture(student, '10-student-portfolio-reflection-after-action.png', 'student portfolio reflection after action');
  await safeCloseContext(studentContext, 'student context');

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');

  await captureRoute(teacher, `/teacher/classes/${classId}/analytics-v2?surface=report-ledger&source=batch54`, '11-teacher-analytics-report-ledger-default.png', 'teacher analytics report ledger default', 3600);
  await clickText(teacher, /报告|导出|发送|下载|复制|补强|评分|证据|账本|刷新/, 'teacher analytics report-ledger action', 2600);
  await capture(teacher, '12-teacher-analytics-report-ledger-after-action.png', 'teacher analytics report ledger after action', { focusTrail: await focusTrail(teacher, 12) });
  await apiCheck(teacherContext, 'teacher analytics api batch54', `/api/teacher/classes/${classId}/analytics`);

  await captureRoute(teacher, `/teacher/grading-workbench?classId=${classId}&source=batch54&status=ready`, '13-teacher-grading-workbench-ready-default.png', 'teacher grading workbench ready default', 2800);
  await clickText(teacher, /评分|写回|预览|提交|刷新|返回|报告|证据|草稿/, 'teacher grading workbench action', 2200);
  await capture(teacher, '14-teacher-grading-workbench-ready-after-action.png', 'teacher grading workbench ready after action', { focusTrail: await focusTrail(teacher, 12) });
  await apiCheck(teacherContext, 'document grading submissions GET batch54', `/api/teacher/document-grading/submissions?classId=${classId}`);
  await apiCheck(teacherContext, 'document grading writeback preview GET batch54', '/api/teacher/document-grading/writeback-preview');

  await captureRoute(teacher, `/data-center?role=teacher&source=batch54&returnTo=/teacher/classes/${classId}/analytics-v2`, '15-teacher-data-center-returnto-default.png', 'teacher data center returnTo default', 3000);
  await clickText(teacher, /导出|下载|治理|返回|刷新|快照|报告|证据/, 'teacher data center returnTo action', 2600);
  await capture(teacher, '16-teacher-data-center-returnto-after-action.png', 'teacher data center returnTo after action');
  await safeCloseContext(teacherContext, 'teacher context');

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');

  await captureRoute(admin, '/data-center?role=admin&source=batch54&returnTo=/admin/data-governance', '17-admin-data-center-returnto-default.png', 'admin data center returnTo default', 3000);
  await clickText(admin, /导出|下载|治理|返回|刷新|快照|风险|处置/, 'admin data center returnTo action', 2600);
  await capture(admin, '18-admin-data-center-returnto-after-action.png', 'admin data center returnTo after action');

  await captureRoute(admin, '/admin/data-governance?tab=risks&action=assign&source=batch54', '19-admin-governance-assign-default.png', 'admin governance assign default', 9000);
  await clickText(admin, /分派|处置|标记|撤销|导出|刷新|证据|风险/, 'admin governance assign action', 2800);
  await capture(admin, '20-admin-governance-assign-after-action.png', 'admin governance assign after action', { focusTrail: await focusTrail(admin, 12) });
  await apiCheck(adminContext, 'admin governance status batch54', '/api/admin/data-governance/status');

  await captureRoute(admin, '/admin/config?source=batch54&focus=audit', '21-admin-config-audit-default.png', 'admin config audit default', 2800);
  await clickText(admin, /保存|重置|测试|添加|审计|配置|模型/, 'admin config audit action', 2400);
  await capture(admin, '22-admin-config-audit-after-action.png', 'admin config audit after action');
  await safeCloseContext(adminContext, 'admin context');

  const mobileStudentContext = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileStudent = await mobileStudentContext.newPage();
  await login(mobileStudent, 'student');
  await captureRoute(mobileStudent, '/assessment/document-feedback?demo=1&source=batch54', '23-mobile-390-student-document-feedback.png', 'mobile 390 student document feedback', 3200);
  await captureRoute(mobileStudent, '/evaluation/prompt-assessment?source=batch54&autodemo=1', '24-mobile-390-student-prompt-assessment.png', 'mobile 390 student prompt assessment', 3200);
  await captureRoute(mobileStudent, '/ai/copilot?source=batch54&context=evidence', '25-mobile-390-student-copilot.png', 'mobile 390 student copilot', 3200);
  await safeCloseContext(mobileStudentContext, 'mobile student context');

  const mobileTeacherContext = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileTeacher = await mobileTeacherContext.newPage();
  await login(mobileTeacher, 'teacher');
  await captureRoute(mobileTeacher, `/teacher/classes/${classId}/analytics-v2?surface=report-ledger&source=batch54`, '26-mobile-390-teacher-analytics-report-ledger.png', 'mobile 390 teacher analytics report ledger', 3600);
  await captureRoute(mobileTeacher, `/teacher/grading-workbench?classId=${classId}&source=batch54&status=ready`, '27-mobile-390-teacher-grading-workbench.png', 'mobile 390 teacher grading workbench', 3200);
  await safeCloseContext(mobileTeacherContext, 'mobile teacher context');

  const mobileAdminContext = await browser.newContext({ viewport: mobile320, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileAdmin = await mobileAdminContext.newPage();
  await login(mobileAdmin, 'admin');
  await captureRoute(mobileAdmin, '/data-center?role=admin&source=batch54&returnTo=/admin/data-governance', '28-mobile-320-admin-data-center-returnto.png', 'mobile 320 admin data center returnTo', 3200);
  await captureRoute(mobileAdmin, '/admin/data-governance?tab=risks&action=assign&source=batch54', '29-mobile-320-admin-governance-assign.png', 'mobile 320 admin governance assign', 9000);
  await captureRoute(mobileAdmin, '/admin/config?source=batch54&focus=audit', '30-mobile-320-admin-config-audit.png', 'mobile 320 admin config audit', 3200);
  await safeCloseContext(mobileAdminContext, 'mobile admin context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'report delivery, document feedback, prompt assessment, AI/Copilot, portfolio reflection, grading workbench, data-center returnTo, governance assignment, config audit, related APIs, and mobile action-state regressions',
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
