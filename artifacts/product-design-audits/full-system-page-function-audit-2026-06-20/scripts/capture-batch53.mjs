import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/89-function-state-flows-batch53-direct-deep-links');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch53-manifest.json');
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

async function firstRecord(value) {
  if (Array.isArray(value)) return value[0] || null;
  if (Array.isArray(value?.items)) return value.items[0] || null;
  if (Array.isArray(value?.data)) return value.data[0] || null;
  if (Array.isArray(value?.lessonPlans)) return value.lessonPlans[0] || null;
  if (Array.isArray(value?.playlists)) return value.playlists[0] || null;
  if (Array.isArray(value?.nodes)) return value.nodes[0] || null;
  return null;
}

function idOf(record) {
  return record?.id || record?.lessonPlanId || record?.playlistId || record?.nodeId || record?.slug || '';
}

async function captureIfRoute(page, route, fileName, label, waitMs = 2200, notes = {}) {
  if (!route) {
    optionalActions.push({ action: label, status: 'skipped-missing-route', url: page.url() });
    return;
  }
  await captureRoute(page, route, fileName, label, waitMs, notes);
}

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const teacherContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const teacher = await teacherContext.newPage();
  await login(teacher, 'teacher');
  const teacherPlans = await apiCheck(teacherContext, 'lesson plans api teacher batch53', '/api/lesson-plans');
  const teacherPlan = await firstRecord(teacherPlans);
  const teacherPlanId = idOf(teacherPlan);
  optionalActions.push({ action: 'teacher lesson plan id from api', status: teacherPlanId ? 'found' : 'missing', id: teacherPlanId, sample: teacherPlan ? JSON.stringify(teacherPlan).slice(0, 500) : '', url: teacher.url() });

  await captureIfRoute(teacher, teacherPlanId ? `/teacher/lesson-plans/${teacherPlanId}/edit?source=batch53&direct=api` : '', '01-teacher-lesson-plan-edit-direct-default.png', 'teacher lesson plan edit direct default', 3600, { teacherPlanId });
  await clickText(teacher, /添加环节|添加资源|资源库|预览|上移|下移|删除|保存|返回/, 'teacher direct edit primary action', 2200);
  await capture(teacher, '02-teacher-lesson-plan-edit-direct-after-action.png', 'teacher lesson plan edit direct after action', { teacherPlanId, focusTrail: await focusTrail(teacher, 12) });
  if (teacherPlanId) await apiCheck(teacherContext, 'lesson plan detail api teacher batch53', `/api/lesson-plans/${teacherPlanId}`);

  await captureRoute(teacher, '/teacher/lesson-plans/new?templateId=batch53-missing-template&source=batch53', '03-teacher-new-lesson-missing-template.png', 'teacher new lesson missing template state', 2600);
  await clickText(teacher, /返回|取消|保存|创建|添加环节|开始上课/, 'teacher missing-template new action', 1800);
  await capture(teacher, '04-teacher-new-lesson-missing-template-after-action.png', 'teacher new lesson missing template after action');

  await captureRoute(teacher, '/teacher/resources/resource-nodes?source=batch53&status=blocked', '05-teacher-resource-nodes-blocked-filter.png', 'teacher resource nodes blocked filter', 3000);
  await clickText(teacher, /告警|阻断|可规划|未映射|刷新|导出|查看|预览/, 'teacher resource nodes blocked action', 2200);
  await capture(teacher, '06-teacher-resource-nodes-blocked-after-action.png', 'teacher resource nodes blocked after action');
  await safeCloseContext(teacherContext, 'teacher context');

  const adminContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, acceptDownloads: true });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  const adminPlans = await apiCheck(adminContext, 'lesson plans api admin batch53', '/api/lesson-plans');
  const adminPlan = await firstRecord(adminPlans);
  const adminPlanId = idOf(adminPlan) || teacherPlanId;
  optionalActions.push({ action: 'admin lesson plan id from api', status: adminPlanId ? 'found' : 'missing', id: adminPlanId, sample: adminPlan ? JSON.stringify(adminPlan).slice(0, 500) : '', url: admin.url() });

  await captureIfRoute(admin, adminPlanId ? `/admin/lesson-plans/${adminPlanId}/edit?source=batch53&direct=api` : '', '07-admin-lesson-plan-edit-direct-default.png', 'admin lesson plan edit direct default', 3400, { adminPlanId });
  await clickText(admin, /添加环节|预览|保存|删除|上移|下移|资源|返回|取消/, 'admin direct edit primary action', 2200);
  await capture(admin, '08-admin-lesson-plan-edit-direct-after-action.png', 'admin lesson plan edit direct after action', { adminPlanId, focusTrail: await focusTrail(admin, 12) });
  if (adminPlanId) await apiCheck(adminContext, 'lesson plan detail api admin batch53', `/api/lesson-plans/${adminPlanId}`);

  await captureRoute(admin, '/admin/lesson-plans/missing-batch53/edit?source=batch53', '09-admin-lesson-plan-edit-missing.png', 'admin lesson plan edit missing id', 2800);
  await clickText(admin, /返回|重试|教案|列表|新建|首页/, 'admin missing lesson edit recovery action', 1800);
  await capture(admin, '10-admin-lesson-plan-edit-missing-after-action.png', 'admin lesson plan edit missing after action');

  await captureRoute(admin, '/admin/data-governance?surface=authoring&tab=reports&lessonPlanId=missing-batch53&source=batch53', '11-admin-governance-authoring-missing-plan.png', 'admin governance authoring missing plan', 9000);
  await clickText(admin, /刷新|风险|教案|资源|报告|证据|导出|处置/, 'admin governance missing-plan action', 2400);
  await capture(admin, '12-admin-governance-authoring-missing-plan-after-action.png', 'admin governance authoring missing plan after action');
  await safeCloseContext(adminContext, 'admin context');

  const studentContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const student = await studentContext.newPage();
  await login(student, 'student');
  const playlists = await apiCheck(studentContext, 'knowledge playlists api batch53', '/api/knowledge/playlists');
  const playlist = await firstRecord(playlists);
  const playlistId = idOf(playlist);
  optionalActions.push({ action: 'playlist id from api', status: playlistId ? 'found' : 'missing', id: playlistId, sample: playlist ? JSON.stringify(playlist).slice(0, 500) : '', url: student.url() });

  await captureRoute(student, '/playlists?source=batch53', '13-student-playlists-list-default.png', 'student playlists list default', 2600);
  await clickText(student, /开始上课|播放|查看|编辑|创建|新建|继续/, 'student playlists list primary action', 2200);
  await capture(student, '14-student-playlists-list-after-action.png', 'student playlists list after action');
  await captureIfRoute(student, playlistId ? `/playlists/${playlistId}/play?source=batch53&direct=api` : '', '15-student-playlist-play-direct-default.png', 'student playlist play direct default', 3200, { playlistId });
  await clickText(student, /开始|继续|返回|课程|播放|学习|创建/, 'student playlist play primary action', 2200);
  await capture(student, '16-student-playlist-play-direct-after-action.png', 'student playlist play direct after action', { playlistId, focusTrail: await focusTrail(student, 12) });

  const nodes = await apiCheck(studentContext, 'knowledge nodes api batch53', '/api/knowledge/nodes');
  const node = await firstRecord(nodes);
  const nodeId = idOf(node);
  optionalActions.push({ action: 'knowledge node id from api', status: nodeId ? 'found' : 'missing', id: nodeId, sample: node ? JSON.stringify(node).slice(0, 500) : '', url: student.url() });
  await captureIfRoute(student, nodeId ? `/knowledge?nodeId=${encodeURIComponent(nodeId)}&source=batch53&direct=api` : '/knowledge?nodeId=missing-batch53&source=batch53', '17-student-knowledge-node-direct.png', 'student knowledge node direct state', 2800, { nodeId });
  await clickText(student, /查看|学习|加入|课程流|布局|搜索|返回|节点/, 'student knowledge node primary action', 2200);
  await capture(student, '18-student-knowledge-node-after-action.png', 'student knowledge node after action');
  if (nodeId) await apiCheck(studentContext, 'knowledge node detail api batch53', `/api/knowledge/nodes/${encodeURIComponent(nodeId)}`);
  await safeCloseContext(studentContext, 'student context');

  const mobileTeacherContext = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileTeacher = await mobileTeacherContext.newPage();
  await login(mobileTeacher, 'teacher');
  await captureIfRoute(mobileTeacher, teacherPlanId ? `/teacher/lesson-plans/${teacherPlanId}/edit?source=batch53&direct=api` : '', '19-mobile-390-teacher-lesson-plan-edit-direct.png', 'mobile 390 teacher lesson plan edit direct', 3600, { teacherPlanId });
  await captureRoute(mobileTeacher, '/teacher/resources/resource-nodes?source=batch53&status=blocked', '20-mobile-390-teacher-resource-nodes-blocked.png', 'mobile 390 teacher resource nodes blocked', 3600);
  await safeCloseContext(mobileTeacherContext, 'mobile teacher context');

  const mobileAdminContext = await browser.newContext({ viewport: mobile320, deviceScaleFactor: 1, isMobile: true, acceptDownloads: true });
  const mobileAdmin = await mobileAdminContext.newPage();
  await login(mobileAdmin, 'admin');
  await captureIfRoute(mobileAdmin, adminPlanId ? `/admin/lesson-plans/${adminPlanId}/edit?source=batch53&direct=api` : '', '21-mobile-320-admin-lesson-plan-edit-direct.png', 'mobile 320 admin lesson plan edit direct', 3400, { adminPlanId });
  await captureRoute(mobileAdmin, '/admin/data-governance?surface=authoring&tab=reports&lessonPlanId=missing-batch53&source=batch53', '22-mobile-320-admin-governance-authoring-missing-plan.png', 'mobile 320 admin governance authoring missing plan', 9000);
  await safeCloseContext(mobileAdminContext, 'mobile admin context');

  const mobileStudentContext = await browser.newContext({ viewport: mobile390, deviceScaleFactor: 1, isMobile: true });
  const mobileStudent = await mobileStudentContext.newPage();
  await login(mobileStudent, 'student');
  await captureIfRoute(mobileStudent, playlistId ? `/playlists/${playlistId}/play?source=batch53&direct=api` : '', '23-mobile-390-student-playlist-play-direct.png', 'mobile 390 student playlist play direct', 3200, { playlistId });
  await captureIfRoute(mobileStudent, nodeId ? `/knowledge?nodeId=${encodeURIComponent(nodeId)}&source=batch53&direct=api` : '/knowledge?nodeId=missing-batch53&source=batch53', '24-mobile-390-student-knowledge-node-direct.png', 'mobile 390 student knowledge node direct', 3000, { nodeId });
  await safeCloseContext(mobileStudentContext, 'mobile student context');

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png'));
  const jsonFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.json'));
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    createdAt: new Date().toISOString(),
    scope: 'direct deep-link states for lesson-plan editors, missing authoring ids, ResourceNode blocked filters, playlist play, knowledge node direct states, related APIs, and mobile direct-link regressions',
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
