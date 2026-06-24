import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/91-function-state-flows-batch55-follow-up-targets');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch55-manifest.json');
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

  await captureRoute(student, '/assessment/document-feedback?demo=1&source=batch55&followup=targets', '01-student-document-feedback-followup-source.png', 'student document feedback follow-up source', 3000);
  const feedbackLinks = [
    ['/profile/evidence?assignment=report-control-design&criterion=model-assumptions&source=batch55', '02-student-feedback-evidence-target.png', 'student feedback evidence target'],
    ['/assessment/adaptive-practice?assignment=report-control-design&criterion=model-assumptions&source=batch55', '03-student-feedback-adaptive-target.png', 'student feedback adaptive target'],
    ['/assessment/adaptive-practice?intent=practice&assignment=report-control-design&criterion=model-assumptions&source=batch55', '04-student-feedback-practice-intent-target.png', 'student feedback practice intent target'],
    ['/interactive-learning/resources/lesson09-correction-precheck?assignment=report-control-design&criterion=model-assumptions&source=batch55', '05-student-feedback-resource-target.png', 'student feedback resource target'],
  ];
  for (const [route, fileName, label] of feedbackLinks) {
    await captureRoute(student, route, fileName, label, 3000);
  }
  await apiCheck(studentContext, 'learning evidence assignment target batch55', '/api/learning-evidence?assignment=report-control-design&criterion=model-assumptions&limit=5');
  await apiCheck(studentContext, 'latest path assignment target batch55', '/api/learning-paths/latest?goal=control-correction');

  await captureRoute(student, '/evaluation/prompt-assessment?source=batch55&autodemo=0&mode=history', '06-student-prompt-history-real-default.png', 'student prompt history real default', 3000);
  await fillVisibleEditableInput(student, '请生成一个用于评价根轨迹报告的提示词版本。', 'student prompt real visible input batch55', /(提示词|prompt|输入|内容|评价|文本|message|问题)/i);
  await clickText(student, /评价|评估|校验|生成|提交|保存|开始|历史/, 'student prompt real action batch55', 2600);
  await capture(student, '07-student-prompt-history-real-after-action.png', 'student prompt history real after action', { focusTrail: await focusTrail(student, 12) });
  await apiCheck(studentContext, 'prompt history demo api batch55', '/api/evaluation/prompt-history/demo');

  await captureRoute(student, '/ai?source=batch55&task=report-feedback', '08-student-ai-report-task-default.png', 'student ai report task default', 2800);
  await fillVisibleEditableInput(student, '把报告反馈转成三个练习任务。', 'student ai report task input batch55', /(输入|问题|消息|message|prompt|问控灵|搜索)/i);
  await clickText(student, /发送|提问|生成|开始|试试|建议|清空|停止/, 'student ai report task action batch55', 4500);
  await capture(student, '09-student-ai-report-task-after-action.png', 'student ai report task after action');

  await captureRoute(student, '/ai/copilot?source=batch55&context=portfolio-reflection', '10-student-copilot-reflection-default.png', 'student copilot reflection default', 2800);
  await fillVisibleEditableInput(student, '请把这次 AI 协作写成一段作品集反思。', 'student copilot reflection input batch55', /(输入|问题|消息|message|prompt|问控灵|搜索)/i);
  await clickText(student, /发送|提问|生成|开始|建议|清空|停止/, 'student copilot reflection action batch55', 4500);
  await capture(student, '11-student-copilot-reflection-after-action.png', 'student copilot reflection after action');

  await captureRoute(student, '/profile/portfolio?source=batch55&category=reflection&intent=create', '12-student-portfolio-reflection-create-default.png', 'student portfolio reflection create default', 2800);
  await clickText(student, /开始反思|反思|创建|收录|添加|编辑|保存|AI协作/, 'student portfolio reflection create action batch55', 2400);
  await capture(student, '13-student-portfolio-reflection-create-after-action.png', 'student portfolio reflection create after action', { focusTrail: await focusTrail(student, 12) });
  await safeCloseContext(studentContext, 'student context');

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');

  const teacherRoutes = [
    [`/teacher/classes/${classId}/analytics-v2?surface=report-ledger&report=control-correction&source=batch55`, '14-teacher-report-ledger-report-param.png', 'teacher report ledger report param'],
    [`/teacher/classes/${classId}/analytics-v2?surface=remediation&cluster=cluster-1&source=batch55`, '15-teacher-analytics-remediation-cluster.png', 'teacher analytics remediation cluster'],
    [`/teacher/classes/${classId}/analytics-v2?surface=student-evidence&studentId=demo&source=batch55`, '16-teacher-analytics-student-evidence-param.png', 'teacher analytics student evidence param'],
    [`/teacher/grading-workbench?classId=${classId}&assignment=report-control-design&source=batch55&status=ready`, '17-teacher-grading-assignment-ready.png', 'teacher grading assignment ready'],
    [`/teacher/grading-workbench?gradingRunId=missing-batch55&classId=${classId}&source=batch55`, '18-teacher-grading-missing-run-with-class.png', 'teacher grading missing run with class'],
  ];
  for (const [route, fileName, label] of teacherRoutes) {
    await captureRoute(teacher, route, fileName, label, 3600);
    await clickText(teacher, /报告|导出|发送|评分|写回|证据|补强|刷新|返回|草稿/, `${label} action`, 1600);
    await capture(teacher, fileName.replace('.png', '-after-action.png'), `${label} after action`);
  }
  await apiCheck(teacherContext, 'teacher analytics batch55', `/api/teacher/classes/${classId}/analytics`);
  await apiCheck(teacherContext, 'document grading submissions assignment GET batch55', `/api/teacher/document-grading/submissions?classId=${classId}&assignment=report-control-design`);
  await safeCloseContext(teacherContext, 'teacher context');

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');

  const adminRoutes = [
    ['/admin/data-governance?tab=risks&action=assign&riskId=missing-batch55&source=batch55', '24-admin-governance-assign-risk-param.png', 'admin governance assign risk param'],
    ['/admin/data-governance?tab=risks&action=resolve&riskId=missing-batch55&source=batch55', '25-admin-governance-resolve-risk-param.png', 'admin governance resolve risk param'],
    ['/admin/data-governance?tab=evidence-source&action=export&source=batch55', '26-admin-governance-evidence-export-param.png', 'admin governance evidence export param'],
    ['/admin/config?source=batch55&focus=audit&changed=ai-provider', '27-admin-config-audit-provider-param.png', 'admin config audit provider param'],
    ['/admin/config?source=batch55&focus=model-test&provider=missing-batch55', '28-admin-config-model-test-missing-provider.png', 'admin config model test missing provider'],
  ];
  for (const [route, fileName, label] of adminRoutes) {
    await captureRoute(admin, route, fileName, label, route.includes('data-governance') ? 9000 : 3200);
    await clickText(admin, /分派|处置|标记|撤销|导出|刷新|证据|风险|保存|测试|重置|审计|配置/, `${label} action`, 2200);
    await capture(admin, fileName.replace('.png', '-after-action.png'), `${label} after action`);
  }
  await apiCheck(adminContext, 'admin governance status batch55', '/api/admin/data-governance/status');
  await apiCheck(adminContext, 'admin users no-match batch55', '/api/admin/users?q=zzzz-batch55-no-match&page=1&pageSize=5');
  await safeCloseContext(adminContext, 'admin context');

  const mobileStudentContext = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileStudent = await mobileStudentContext.newPage();
  await login(mobileStudent, 'student');
  await captureRoute(mobileStudent, '/profile/evidence?assignment=report-control-design&criterion=model-assumptions&source=batch55', '34-mobile-390-student-feedback-evidence-target.png', 'mobile 390 student feedback evidence target', 3200);
  await captureRoute(mobileStudent, '/profile/portfolio?source=batch55&category=reflection&intent=create', '35-mobile-390-student-portfolio-reflection-create.png', 'mobile 390 student portfolio reflection create', 3200);
  await safeCloseContext(mobileStudentContext, 'mobile student context');

  const mobileTeacherContext = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileTeacher = await mobileTeacherContext.newPage();
  await login(mobileTeacher, 'teacher');
  await captureRoute(mobileTeacher, `/teacher/classes/${classId}/analytics-v2?surface=remediation&cluster=cluster-1&source=batch55`, '36-mobile-390-teacher-remediation-cluster.png', 'mobile 390 teacher remediation cluster', 3600);
  await captureRoute(mobileTeacher, `/teacher/grading-workbench?classId=${classId}&assignment=report-control-design&source=batch55&status=ready`, '37-mobile-390-teacher-grading-assignment-ready.png', 'mobile 390 teacher grading assignment ready', 3200);
  await safeCloseContext(mobileTeacherContext, 'mobile teacher context');

  const mobileAdminContext = await browser.newContext({ viewport: mobile320, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileAdmin = await mobileAdminContext.newPage();
  await login(mobileAdmin, 'admin');
  await captureRoute(mobileAdmin, '/admin/data-governance?tab=risks&action=assign&riskId=missing-batch55&source=batch55', '38-mobile-320-admin-governance-assign-risk.png', 'mobile 320 admin governance assign risk', 9000);
  await captureRoute(mobileAdmin, '/admin/config?source=batch55&focus=audit&changed=ai-provider', '39-mobile-320-admin-config-audit-provider.png', 'mobile 320 admin config audit provider', 3200);
  await safeCloseContext(mobileAdminContext, 'mobile admin context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'follow-up targets from report feedback, Prompt/AI/portfolio creation, teacher report/grading parameterized links, admin governance/config parameterized actions, related APIs, and mobile follow-up regressions',
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
