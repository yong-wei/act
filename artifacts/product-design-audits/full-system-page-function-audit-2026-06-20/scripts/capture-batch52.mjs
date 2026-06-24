import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/88-function-state-flows-batch52-teacher-authoring-resource-prep');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch52-manifest.json');
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

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');

  await captureRoute(teacher, '/teacher/preset-lessons?source=batch52', '01-teacher-preset-lessons-default.png', 'teacher preset lessons default', 2600);
  await clickText(teacher, /使用|克隆|预览|查看|导入|复制|创建/, 'teacher preset lesson primary action', 2200);
  await capture(teacher, '02-teacher-preset-lessons-after-action.png', 'teacher preset lessons after action', { focusTrail: await focusTrail(teacher, 10) });
  await apiCheck(teacherContext, 'teacher preset lessons clone GET contract', '/api/teacher/preset-lessons/clone');

  await captureRoute(teacher, '/teacher/lesson-plans?source=batch52', '03-teacher-lesson-plans-default.png', 'teacher lesson plans default', 2600);
  const editHref = await hrefForFirst(teacher, /\/teacher\/lesson-plans\/[^/]+\/edit/, 'teacher lesson plan first edit href');
  await fillVisibleEditableInput(teacher, 'zzzz-batch52-no-match', 'teacher lesson plans search input');
  await capture(teacher, '04-teacher-lesson-plans-after-search-probe.png', 'teacher lesson plans after search probe', { editHref });

  await captureRoute(teacher, '/teacher/lesson-plans/new?returnTo=%2Fteacher%2Flesson-plans&source=batch52', '05-teacher-lesson-plan-new-default.png', 'teacher lesson plan new default', 2600);
  await fillVisibleEditableInput(teacher, '', 'teacher new lesson empty title probe', /(标题|名称|title|name)/i);
  await clickText(teacher, /保存|创建|发布|开始上课|添加环节|返回/, 'teacher new lesson non-destructive action', 1800);
  await capture(teacher, '06-teacher-lesson-plan-new-after-action.png', 'teacher lesson plan new after action', { focusTrail: await focusTrail(teacher, 10) });

  if (editHref) {
    const normalizedEditHref = editHref.startsWith('http') ? new URL(editHref).pathname + new URL(editHref).search : editHref;
    await captureRoute(teacher, `${normalizedEditHref}${normalizedEditHref.includes('?') ? '&' : '?'}source=batch52`, '07-teacher-lesson-plan-edit-default.png', 'teacher lesson plan edit default', 3200, { editHref: normalizedEditHref });
    await clickText(teacher, /添加环节|添加资源|搜索资源|资源库|预览|上移|下移|删除|保存/, 'teacher lesson plan edit action', 2200);
    await capture(teacher, '08-teacher-lesson-plan-edit-after-action.png', 'teacher lesson plan edit after action', { focusTrail: await focusTrail(teacher, 10) });
  } else {
    optionalActions.push({ action: 'teacher lesson plan edit skipped', status: 'no-edit-href', url: teacher.url() });
  }

  await captureRoute(teacher, '/teacher/resources?source=batch52', '09-teacher-resources-default.png', 'teacher resources default', 2600);
  await fillVisibleEditableInput(teacher, 'zzzz-batch52-no-match', 'teacher resources search input', /(搜索|查找|资源|标题|名称|关键词|search|q)/i);
  await capture(teacher, '10-teacher-resources-after-search-probe.png', 'teacher resources after search probe');
  await clickText(teacher, /预览|编辑|查看|使用|加入|资源节点|刷新|全部/, 'teacher resources primary action', 2200);
  await capture(teacher, '11-teacher-resources-after-primary-action.png', 'teacher resources after primary action');

  await captureRoute(teacher, '/teacher/resources/resource-nodes?source=batch52', '12-teacher-resource-nodes-default.png', 'teacher resource nodes default', 3200);
  await fillVisibleEditableInput(teacher, 'zzzz-batch52-no-match', 'teacher resource nodes search input', /(搜索|查找|节点|资源|关键词|search|q)/i);
  await capture(teacher, '13-teacher-resource-nodes-after-search-probe.png', 'teacher resource nodes after search probe');
  await clickText(teacher, /预览|查看|编辑|知识节点|资源|筛选|刷新/, 'teacher resource nodes primary action', 2200);
  await capture(teacher, '14-teacher-resource-nodes-after-primary-action.png', 'teacher resource nodes after primary action');

  await apiCheck(teacherContext, 'lesson plans api teacher batch52', '/api/lesson-plans');
  await apiCheck(teacherContext, 'resources api teacher batch52', '/api/resources');
  await apiCheck(teacherContext, 'teacher resource nodes api batch52', '/api/teacher/resource-nodes');
  await safeCloseContext(teacherContext, 'teacher context');

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');

  await captureRoute(admin, '/admin/lesson-plans?source=batch52', '15-admin-lesson-plans-default.png', 'admin lesson plans default', 2800);
  await fillVisibleEditableInput(admin, 'zzzz-batch52-no-match', 'admin lesson plans search input', /(搜索|查找|教案|标题|名称|关键词|search|q)/i);
  await capture(admin, '16-admin-lesson-plans-after-search-probe.png', 'admin lesson plans after search probe');
  const adminEditHref = await hrefForFirst(admin, /\/admin\/lesson-plans\/[^/]+\/edit|编辑/, 'admin lesson plan first edit href');

  await captureRoute(admin, '/admin/lesson-plans/new?source=batch52', '17-admin-lesson-plan-new-default.png', 'admin lesson plan new default', 2600);
  await clickText(admin, /保存|创建|添加环节|返回|取消/, 'admin lesson plan new non-destructive action', 1800);
  await capture(admin, '18-admin-lesson-plan-new-after-action.png', 'admin lesson plan new after action', { focusTrail: await focusTrail(admin, 10) });

  if (adminEditHref) {
    const normalizedAdminEditHref = adminEditHref.startsWith('http') ? new URL(adminEditHref).pathname + new URL(adminEditHref).search : adminEditHref;
    await captureRoute(admin, `${normalizedAdminEditHref}${normalizedAdminEditHref.includes('?') ? '&' : '?'}source=batch52`, '19-admin-lesson-plan-edit-default.png', 'admin lesson plan edit default', 3000, { adminEditHref: normalizedAdminEditHref });
    await clickText(admin, /添加环节|预览|保存|删除|上移|下移|资源|返回/, 'admin lesson plan edit action', 2200);
    await capture(admin, '20-admin-lesson-plan-edit-after-action.png', 'admin lesson plan edit after action');
  } else {
    optionalActions.push({ action: 'admin lesson plan edit skipped', status: 'no-edit-href', url: admin.url() });
  }

  await captureRoute(admin, '/admin/data-governance?surface=authoring&tab=reports&source=batch52', '21-admin-governance-authoring-report-default.png', 'admin governance authoring report default', 10000);
  await clickText(admin, /教案|资源|报告|质量|风险|刷新|证据|导出/, 'admin governance authoring action', 2400);
  await capture(admin, '22-admin-governance-authoring-after-action.png', 'admin governance authoring after action');
  await apiCheck(adminContext, 'lesson plans api admin batch52', '/api/lesson-plans');
  await apiCheck(adminContext, 'resources api admin batch52', '/api/resources');
  await apiCheck(adminContext, 'admin governance status batch52', '/api/admin/data-governance/status');
  await safeCloseContext(adminContext, 'admin context');

  const studentContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const student = await studentContext.newPage();
  await login(student, 'student');
  await captureRoute(student, '/interactive-learning/courses?source=batch52&q=zzzz-batch52-no-match', '23-student-course-catalog-search-default.png', 'student course catalog search default', 2600);
  await fillVisibleEditableInput(student, 'zzzz-batch52-no-match', 'student course catalog search input', /(搜索|查找|课程|关键词|search|q)/i);
  await capture(student, '24-student-course-catalog-after-search-probe.png', 'student course catalog after search probe');
  await captureRoute(student, '/playlists/new?source=batch52', '25-student-playlist-new-default.png', 'student playlist new default', 2800);
  await fillVisibleEditableInput(student, 'Batch52 审计课程流', 'student playlist title input', /(标题|名称|课程流|playlist|title|name)/i);
  await clickText(student, /添加知识点|保存|预览|搜索|返回|删除|上移|下移/, 'student playlist builder action', 2200);
  await capture(student, '26-student-playlist-new-after-action.png', 'student playlist new after action', { focusTrail: await focusTrail(student, 10) });
  await apiCheck(studentContext, 'knowledge playlists api GET batch52', '/api/knowledge/playlists');
  await apiCheck(studentContext, 'knowledge nodes api batch52', '/api/knowledge/nodes');
  await safeCloseContext(studentContext, 'student context');

  const mobileTeacher390Context = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileTeacher390 = await mobileTeacher390Context.newPage();
  await login(mobileTeacher390, 'teacher');
  await captureRoute(mobileTeacher390, '/teacher/preset-lessons?source=batch52', '27-mobile-390-teacher-preset-lessons.png', 'mobile 390 teacher preset lessons', 3200);
  await captureRoute(mobileTeacher390, '/teacher/lesson-plans?source=batch52', '28-mobile-390-teacher-lesson-plans.png', 'mobile 390 teacher lesson plans', 3200);
  await captureRoute(mobileTeacher390, '/teacher/resources?source=batch52', '29-mobile-390-teacher-resources.png', 'mobile 390 teacher resources', 3200, { focusTrail: await focusTrail(mobileTeacher390, 10) });
  await captureRoute(mobileTeacher390, '/teacher/resources/resource-nodes?source=batch52', '30-mobile-390-teacher-resource-nodes.png', 'mobile 390 teacher resource nodes', 3600);
  await safeCloseContext(mobileTeacher390Context, 'mobile teacher 390 context');

  const mobileAdmin320Context = await browser.newContext({ viewport: mobile320, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileAdmin320 = await mobileAdmin320Context.newPage();
  await login(mobileAdmin320, 'admin');
  await captureRoute(mobileAdmin320, '/admin/lesson-plans?source=batch52', '31-mobile-320-admin-lesson-plans.png', 'mobile 320 admin lesson plans', 3400);
  await captureRoute(mobileAdmin320, '/admin/lesson-plans/new?source=batch52', '32-mobile-320-admin-lesson-plan-new.png', 'mobile 320 admin lesson plan new', 3000);
  await captureRoute(mobileAdmin320, '/admin/data-governance?surface=authoring&tab=reports&source=batch52', '33-mobile-320-admin-governance-authoring.png', 'mobile 320 admin governance authoring', 10000);
  await safeCloseContext(mobileAdmin320Context, 'mobile admin 320 context');

  const mobileStudent390Context = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true });
  const mobileStudent390 = await mobileStudent390Context.newPage();
  await login(mobileStudent390, 'student');
  await captureRoute(mobileStudent390, '/interactive-learning/courses?source=batch52&q=zzzz-batch52-no-match', '34-mobile-390-student-course-catalog-search.png', 'mobile 390 student course catalog search', 3200);
  await captureRoute(mobileStudent390, '/playlists/new?source=batch52', '35-mobile-390-student-playlist-new.png', 'mobile 390 student playlist new', 3200);
  await safeCloseContext(mobileStudent390Context, 'mobile student 390 context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'teacher authoring and resource preparation states, admin lesson-plan governance states, student course catalog and playlist builder states, related APIs, and mobile authoring/resource regressions',
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
