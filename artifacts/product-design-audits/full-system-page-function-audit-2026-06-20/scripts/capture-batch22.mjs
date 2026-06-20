import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/57-function-state-flows-batch22');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch22-manifest.json');
const populatedLessonPlanId = 'cmqeakmuy0024cnyf1z2ttquo';
const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 1100 };

const accounts = {
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
};

const results = [];
const downloads = [];
const dialogs = [];
const errors = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(page, role) {
  const account = accounts[role];
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2600);
}

async function gotoStable(page, route, waitMs = 2600) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await sleep(waitMs);
}

async function domAudit(page) {
  return await page.evaluate(() => {
    const text = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    const name = (el) => (
      el?.getAttribute?.('aria-label') ||
      el?.getAttribute?.('title') ||
      el?.getAttribute?.('alt') ||
      text(el) ||
      ''
    ).trim();
    const active = document.activeElement;
    const buttons = [...document.querySelectorAll('button, [role="button"], a[href]')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      href: el.getAttribute('href') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      selected: el.getAttribute('aria-selected') || '',
      pressed: el.getAttribute('aria-pressed') || '',
    }));
    const inputs = [...document.querySelectorAll('input, textarea, select')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      value: 'value' in el ? String(el.value || '').slice(0, 140) : '',
      hidden: Boolean(el.hidden || el.closest('[hidden]') || getComputedStyle(el).display === 'none'),
    }));
    const tables = [...document.querySelectorAll('table')].map((table) => ({
      headers: [...table.querySelectorAll('th')].map(text).filter(Boolean),
      rowCount: table.querySelectorAll('tbody tr').length,
    }));
    const statusRegions = [...document.querySelectorAll('[role="alert"], [aria-live], [role="status"]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const graphics = [...document.querySelectorAll('svg, canvas')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      ariaHidden: el.getAttribute('aria-hidden') || '',
    }));
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 6),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
        placeholder: active?.getAttribute?.('placeholder') || '',
      },
      alerts: statusRegions,
      buttons: buttons.slice(0, 220),
      inputs,
      tables,
      unnamedButtons: buttons.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 5200),
    };
  });
}

async function capture(page, fileName, label, notes = {}) {
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  const audit = await domAudit(page);
  const a11yPath = filePath.replace(/\.png$/, '.a11y.json');
  await fs.writeFile(a11yPath, JSON.stringify({ accessibilitySnapshotUnavailable: true, audit }, null, 2));
  const url = new URL(audit.url);
  const body = audit.bodyText;
  results.push({
    step: results.length + 1,
    label,
    route: url.pathname + url.search,
    screenshot: path.relative(root, filePath),
    a11y: path.relative(root, a11yPath),
    notes,
    auditSummary: {
      h1: audit.h1,
      activeElement: audit.activeElement,
      alerts: audit.alerts,
      inputCount: audit.inputs.length,
      buttonCount: audit.buttons.length,
      links: audit.buttons.filter((item) => item.tag === 'a').slice(0, 24),
      unnamedButtons: audit.unnamedButtons,
      tableCount: audit.tables.length,
      tables: audit.tables,
      graphicsCount: audit.graphicsCount,
      unnamedGraphics: audit.unnamedGraphics,
      hits: {
        lessonPlans: body.includes('我的教案') || body.includes('保存教案'),
        resourceLibrary: body.includes('资源库') || body.includes('教学资源管理'),
        boppps: body.includes('Bridge-in') || body.includes('BOPPPS') || body.includes('拖拽资源到此处'),
        delete: body.includes('删除教案') || body.includes('确认删除'),
        preview: body.includes('预览') || body.includes('编辑资源') || body.includes('编辑知识节点'),
        empty: body.includes('没有找到匹配') || body.includes('当前没有可显示'),
      },
    },
  });
}

async function clickRole(page, role, name, options = {}) {
  const locator = page.getByRole(role, { name });
  if (await locator.count()) {
    await locator.first().click(options).catch((error) => errors.push({ action: `click ${String(name)}`, message: error.message, url: page.url() }));
    await sleep(options.waitMs ?? 1300);
    return `${role}:${String(name)}`;
  }
  errors.push({ action: `click ${role}:${String(name)}`, message: 'locator not found', url: page.url() });
  return 'not-found';
}

async function clickSelector(page, selector, label, options = {}) {
  const locator = page.locator(selector);
  if (await locator.count()) {
    await locator.first().click({ force: true, ...options }).catch((error) => errors.push({ action: `click ${label}`, message: error.message, url: page.url() }));
    await sleep(options.waitMs ?? 1400);
    return `selector:${label}`;
  }
  errors.push({ action: `click ${label}`, message: 'selector not found', url: page.url() });
  return 'not-found';
}

async function fillVisible(page, selector, value, waitMs = 1200) {
  const locator = page.locator(selector).filter({ visible: true });
  if (await locator.count()) {
    await locator.first().fill(value);
    await sleep(waitMs);
    return true;
  }
  errors.push({ action: `fill ${selector}`, message: 'visible locator not found', url: page.url() });
  return false;
}

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  async function newPage(viewport, role) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      locale: 'zh-CN',
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message(), url: page.url(), mode: 'dismiss' });
      await dialog.dismiss().catch(() => {});
    });
    page.on('download', (download) => {
      downloads.push({ suggestedFilename: download.suggestedFilename(), url: page.url() });
    });
    page.on('pageerror', (error) => errors.push({ action: 'pageerror', message: error.message, url: page.url() }));
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      if (failure?.errorText === 'net::ERR_ABORTED') return;
      errors.push({ action: 'requestfailed', url: request.url(), message: failure?.errorText || 'unknown' });
    });
    if (role) await login(page, role);
    return { context, page };
  }

  const teacherDesktop = await newPage(desktop, 'teacher');
  await gotoStable(teacherDesktop.page, '/teacher/lesson-plans', 3600);
  await capture(teacherDesktop.page, '01-teacher-lesson-plans-list-desktop.png', 'teacher lesson plans list desktop', {
    expected: 'teacher should identify owned plans, item counts, edit, start class, and safe deletion from the list',
  });
  await clickRole(teacherDesktop.page, 'button', /更多操作/);
  await capture(teacherDesktop.page, '02-teacher-lesson-plan-more-menu-desktop.png', 'teacher lesson plan more menu desktop', {
    expected: 'more menu should make delete scope and plan identity clear before opening destructive flow',
  });
  await clickRole(teacherDesktop.page, 'button', /删除教案/);
  await capture(teacherDesktop.page, '03-teacher-lesson-plan-delete-dialog-desktop.png', 'teacher lesson plan delete dialog desktop', {
    expected: 'delete dialog should explain item/session/history impact and reversibility, not only plan title',
  });
  await clickRole(teacherDesktop.page, 'button', /^取消$/);

  await gotoStable(teacherDesktop.page, '/teacher/lesson-plans/new?returnTo=%2Fteacher%2Flesson-plans', 4200);
  await capture(teacherDesktop.page, '04-teacher-new-lesson-builder-empty-desktop.png', 'teacher new lesson builder empty desktop', {
    expected: 'new lesson builder should expose title, resource search, BOPPPS stages, and how to add items without relying only on drag',
  });
  await clickRole(teacherDesktop.page, 'button', /保存教案/);
  await capture(teacherDesktop.page, '05-teacher-new-lesson-save-empty-title-alert-desktop.png', 'teacher new lesson save empty title desktop', {
    expected: 'empty title validation should be inline and accessible; current native alert is recorded separately in manifest',
  });

  await gotoStable(teacherDesktop.page, `/teacher/lesson-plans/${populatedLessonPlanId}/edit?returnTo=%2Fteacher%2Flesson-plans`, 4800);
  await capture(teacherDesktop.page, '06-teacher-edit-populated-lesson-builder-desktop.png', 'teacher edit populated lesson builder desktop', {
    lessonPlanId: populatedLessonPlanId,
    expected: 'populated builder should make stage order, item counts, duration controls, item edit/remove, and save state clear',
  });
  await clickSelector(teacherDesktop.page, 'button[title="编辑"]', 'first lesson item edit');
  await capture(teacherDesktop.page, '07-teacher-lesson-item-edit-dialog-desktop.png', 'teacher lesson item edit dialog desktop', {
    expected: 'item edit dialog should clarify whether overrides affect this lesson only and provide accessible labels',
  });
  await clickRole(teacherDesktop.page, 'button', /^取消$/);
  await fillVisible(teacherDesktop.page, 'input[placeholder*="搜索资源"]', 'zzzz-no-resource', 1200);
  await capture(teacherDesktop.page, '08-teacher-builder-resource-search-empty-desktop.png', 'teacher builder resource search empty desktop', {
    action: 'search:zzzz-no-resource',
    expected: 'resource library empty search should explain no match and how to recover; not leave canvas as the only signal',
  });
  await fillVisible(teacherDesktop.page, 'input[placeholder*="搜索资源"]', '', 1800);
  await clickSelector(teacherDesktop.page, 'button[title="预览资源"]', 'first builder resource preview');
  await capture(teacherDesktop.page, '09-teacher-builder-resource-preview-desktop.png', 'teacher builder resource preview desktop', {
    expected: 'resource preview should show what students will see and how it fits before dragging into a stage',
  });
  await teacherDesktop.context.close();

  const resourcesDesktop = await newPage(desktop, 'teacher');
  await gotoStable(resourcesDesktop.page, '/teacher/resources', 4200);
  await capture(resourcesDesktop.page, '10-teacher-resources-interactive-default-desktop.png', 'teacher resources interactive default desktop', {
    expected: 'resource manager should expose interactive components, categories, edit scope, and ResourceNode handoff',
  });
  await fillVisible(resourcesDesktop.page, 'input[placeholder*="搜索资源"]', 'zzzz-no-resource', 1200);
  await capture(resourcesDesktop.page, '11-teacher-resources-empty-search-desktop.png', 'teacher resources empty search desktop', {
    action: 'search:zzzz-no-resource',
    expected: 'empty resource search should expose result count and clear filter state',
  });
  await fillVisible(resourcesDesktop.page, 'input[placeholder*="搜索资源"]', '', 1200);
  await clickSelector(resourcesDesktop.page, 'button[title="编辑"]', 'first interactive resource edit');
  await capture(resourcesDesktop.page, '12-teacher-resource-edit-dialog-desktop.png', 'teacher resource edit dialog desktop', {
    expected: 'resource edit should clarify original title, display name, public impact, and save status',
  });
  await clickRole(resourcesDesktop.page, 'button', /^取消$/);
  await clickRole(resourcesDesktop.page, 'button', /^课堂组件$/);
  await capture(resourcesDesktop.page, '13-teacher-resources-classroom-tab-desktop.png', 'teacher resources classroom tab desktop', {
    expected: 'classroom tab should clearly mark view-only development status and what teachers can do next',
  });
  await clickRole(resourcesDesktop.page, 'button', /^知识图谱$/);
  await capture(resourcesDesktop.page, '14-teacher-resources-knowledge-tab-desktop.png', 'teacher resources knowledge tab desktop', {
    expected: 'knowledge tab should support preview/edit discovery without hidden hover-only controls',
  });
  await clickSelector(resourcesDesktop.page, 'button[title="预览"]', 'first knowledge preview');
  await capture(resourcesDesktop.page, '15-teacher-knowledge-preview-dialog-desktop.png', 'teacher knowledge preview dialog desktop', {
    expected: 'knowledge preview should support teacher review before editing or using it in lesson orchestration',
  });
  await resourcesDesktop.context.close();

  const resourcesMobile = await newPage(mobile, 'teacher');
  await gotoStable(resourcesMobile.page, '/teacher/resources', 4200);
  await capture(resourcesMobile.page, '16-teacher-resources-interactive-mobile.png', 'teacher resources interactive mobile', {
    expected: 'mobile resource manager should keep search, tabs, cards, and edit actions scannable without hover dependency',
  });
  await resourcesMobile.context.close();

  await browser.close();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    populatedLessonPlanId,
    screenshotDir: path.relative(root, screenshotDir),
    screenshots: results.length,
    results,
    downloads,
    dialogs,
    errors,
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ manifestPath, screenshots: results.length, dialogs: dialogs.length, downloads: downloads.length, errors }, null, 2));
}

main().catch(async (error) => {
  errors.push({ action: 'fatal', message: error.message, stack: error.stack });
  await fs.mkdir(path.dirname(manifestPath), { recursive: true }).catch(() => {});
  await fs.writeFile(manifestPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    populatedLessonPlanId,
    screenshotDir: path.relative(root, screenshotDir),
    screenshots: results.length,
    results,
    downloads,
    dialogs,
    errors,
  }, null, 2)).catch(() => {});
  console.error(error);
  process.exit(1);
});
