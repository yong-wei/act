import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/66-function-state-flows-batch31');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch31-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const admin = { account: 'admin', password: 'admin@Just' };
const results = [];
const apiChecks = [];
const errors = [];
const ignoredErrors = [];
const dialogs = [];
const downloads = [];
const routeResponses = [];
const optionalActions = [];
let browser = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function recordError(action, error, url = '') {
  errors.push({ action, message: error instanceof Error ? error.message : String(error), url });
}

function recordIgnoredError(action, error, url = '') {
  ignoredErrors.push({ action, message: error instanceof Error ? error.message : String(error), url });
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(admin.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(admin.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2800);
}

async function gotoStable(page, route, waitMs = 3200) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' }).catch((error) => {
    recordError(`goto ${route}`, error, page.url());
    return null;
  });
  routeResponses.push({ route, status: response?.status?.() ?? null, url: response?.url?.() ?? `${baseUrl}${route}` });
  await sleep(waitMs);
  return response;
}

async function waitForGovernanceLoaded(page) {
  await page.waitForFunction(() => !document.body.innerText.includes('正在加载数据治理看板'), null, { timeout: 20000 }).catch(() => {});
  await sleep(800);
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
    const controls = [...document.querySelectorAll('button, [role="button"], a[href]')].map((el) => ({
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
      accept: el.getAttribute('accept') || '',
      value: 'value' in el ? String(el.value || '').slice(0, 180) : '',
      hidden: Boolean(el.hidden || el.closest('[hidden]') || getComputedStyle(el).display === 'none'),
    }));
    const tables = [...document.querySelectorAll('table')].map((table) => ({
      headers: [...table.querySelectorAll('th')].map(text).filter(Boolean),
      rowCount: table.querySelectorAll('tbody tr').length,
    }));
    const lists = [...document.querySelectorAll('ul, ol')].map((list) => ({
      itemCount: list.querySelectorAll('li').length,
      text: text(list).slice(0, 400),
    })).filter((item) => item.itemCount > 0).slice(0, 24);
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
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      h2: [...document.querySelectorAll('h2')].map(text).filter(Boolean).slice(0, 16),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
        placeholder: active?.getAttribute?.('placeholder') || '',
      },
      alerts: statusRegions,
      buttons: controls.slice(0, 360),
      inputs,
      tables,
      lists,
      unnamedButtons: controls.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 14000),
    };
  });
}

function deriveHits(audit) {
  const body = audit.bodyText;
  const buttonText = audit.buttons.map((button) => button.name).join(' ');
  const allText = `${body} ${buttonText}`;
  return {
    risk: /风险|告警|异常|缺口/.test(allText),
    disposition: /处置|分派|指派|修复|忽略|标记|创建待办|查看证据|定位/.test(buttonText),
    export: /导出|下载|模板|摘要/.test(allText),
    refresh: /刷新/.test(allText),
    undo: /撤销|回滚|恢复|反向/.test(allText),
    notify: /通知|发送|邮件|短信|复制登录信息/.test(allText),
    preview: /预览|校验|错误行|失败行/.test(allText),
    batchImport: /批量导入|导入用户|上传/.test(allText),
    configSave: /保存配置|测试模型|重置表单/.test(allText),
    liveStatus: audit.alerts.length > 0 || /保存成功|刷新完成|正在|已更新|失败|完成/.test(allText),
  };
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
    auditSummary: {
      h1: audit.h1,
      h2: audit.h2,
      activeElement: audit.activeElement,
      alerts: audit.alerts,
      inputCount: audit.inputs.length,
      fileInputs: audit.inputs.filter((input) => input.type === 'file'),
      buttonCount: audit.buttons.length,
      buttons: audit.buttons.slice(0, 80),
      unnamedButtons: audit.unnamedButtons,
      tableCount: audit.tables.length,
      tables: audit.tables,
      graphicsCount: audit.graphicsCount,
      unnamedGraphics: audit.unnamedGraphics,
      hits: deriveHits(audit),
    },
  });
}

async function maybeClick(page, role, name, actionLabel, waitMs = 1600) {
  const locator = page.getByRole(role, { name });
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', url: page.url() });
    return false;
  }
  await locator.first().click().catch((error) => {
    recordIgnoredError(actionLabel, error, page.url());
  });
  optionalActions.push({ action: actionLabel, status: 'attempted', url: page.url() });
  await sleep(waitMs);
  return true;
}

async function newAdminPage(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message(), url: page.url() });
    await dialog.dismiss().catch(() => {});
  });
  page.on('download', (download) => {
    downloads.push({ suggestedFilename: download.suggestedFilename(), url: page.url() });
  });
  page.on('pageerror', (error) => recordError('pageerror', error, page.url()));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    recordError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  await login(page);
  return { context, page };
}

async function fetchApi(page, label, route, expectedStatuses) {
  const response = await page.evaluate(async (targetRoute) => {
    const res = await fetch(targetRoute, { headers: { accept: 'application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
    const contentType = res.headers.get('content-type') || '';
    const disposition = res.headers.get('content-disposition') || '';
    let body = {};
    if (contentType.includes('json')) {
      body = await res.json().catch(() => ({}));
    } else {
      const buffer = await res.arrayBuffer();
      body = { byteLength: buffer.byteLength, contentType, disposition };
    }
    return { ok: res.ok, status: res.status, contentType, disposition, body };
  }, route);
  const accepted = expectedStatuses.includes(response.status);
  apiChecks.push({
    label,
    route,
    status: response.status,
    ok: response.ok,
    accepted,
    contentType: response.contentType,
    disposition: response.disposition,
    summary: JSON.stringify(response.body).slice(0, 1600),
  });
  if (!accepted) recordError(`api ${label}`, `unexpected status ${response.status}`, route);
}

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const desktopPage = await newAdminPage(desktop);
  await gotoStable(desktopPage.page, '/admin/data-governance', 4400);
  await waitForGovernanceLoaded(desktopPage.page);
  await capture(desktopPage.page, '01-admin-data-governance-overview-desktop.png', 'admin data governance overview desktop', {
    expected: 'governance dashboard should expose prioritized risks, disposition actions, export, refresh completion, and queue state',
  });

  await maybeClick(desktopPage.page, 'button', /刷新状态|刷新数据|刷新/, 'click admin data governance refresh');
  await capture(desktopPage.page, '02-admin-data-governance-after-refresh-desktop.png', 'admin data governance after refresh desktop', {
    expected: 'refresh should emit a visible completion/failure state and preserve remediation actions',
  });

  await maybeClick(desktopPage.page, 'button', /^课堂质量$/, 'open session quality governance tab');
  await capture(desktopPage.page, '03-admin-data-governance-session-quality-desktop.png', 'admin data governance session quality desktop', {
    expected: 'session-quality risks should expose owner, severity, evidence, and remediation action path',
  });

  await maybeClick(desktopPage.page, 'button', /^证据源$/, 'open evidence source governance tab');
  await capture(desktopPage.page, '04-admin-data-governance-evidence-source-desktop.png', 'admin data governance evidence source desktop', {
    expected: 'evidence-source risks should expose export, remediation, and stale-cache handling',
  });

  await gotoStable(desktopPage.page, '/admin/users', 3800);
  await capture(desktopPage.page, '05-admin-users-batch-operations-desktop.png', 'admin users batch operations desktop', {
    expected: 'user batch import should show template, preview, failed-row export, notification, undo, and batch audit trail paths',
  });

  await gotoStable(desktopPage.page, '/admin/config', 3800);
  await capture(desktopPage.page, '06-admin-system-config-actions-desktop.png', 'admin system config actions desktop', {
    expected: 'system config should separate draft, saved, impact, provider validation, and action feedback states',
  });

  await fetchApi(desktopPage.page, 'admin overview', '/api/admin/overview', [200]);
  await fetchApi(desktopPage.page, 'admin data governance status', '/api/admin/data-governance/status', [200]);
  await fetchApi(desktopPage.page, 'admin system usage', '/api/admin/system-usage', [200]);
  await fetchApi(desktopPage.page, 'admin users search', '/api/admin/users?search=admin', [200]);
  await fetchApi(desktopPage.page, 'admin users template download', '/api/admin/users/template', [200]);

  const mobilePage = await newAdminPage(mobile);
  await gotoStable(mobilePage.page, '/admin/data-governance', 4400);
  await waitForGovernanceLoaded(mobilePage.page);
  await capture(mobilePage.page, '07-admin-data-governance-mobile.png', 'admin data governance mobile', {
    expected: 'mobile governance should keep risk severity, refresh state, export, and disposition actions reachable',
  });

  await gotoStable(mobilePage.page, '/admin/users', 3800);
  await capture(mobilePage.page, '08-admin-users-batch-operations-mobile.png', 'admin users batch operations mobile', {
    expected: 'mobile user management should keep batch import, template, preview, failed-row export, and undo usable',
  });

  await gotoStable(mobilePage.page, '/admin/config', 3800);
  await capture(mobilePage.page, '09-admin-system-config-actions-mobile.png', 'admin system config actions mobile', {
    expected: 'mobile config should preserve save/reset/test actions plus status and impact feedback',
  });

  await desktopPage.context.close();
  await mobilePage.context.close();
}

async function main() {
  try {
    await runAudit();
  } finally {
    try {
      if (browser) await browser.close();
    } catch (error) {
      recordError('browser close', error);
    }
    const files = await fs.readdir(screenshotDir).catch(() => []);
    const manifest = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      batch: 'function-state-flows-batch31',
      scope: 'admin governance remediation, data export, user import reversibility, config save feedback, and mobile action reachability',
      routeResponses,
      results,
      apiChecks,
      dialogs,
      downloads,
      optionalActions,
      errors,
      ignoredErrors,
      pngCount: files.filter((file) => file.endsWith('.png')).length,
      jsonCount: files.filter((file) => file.endsWith('.json')).length,
    };
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ manifestPath, screenshotDir, results: results.length, apiChecks: apiChecks.length, errors: errors.length, ignoredErrors: ignoredErrors.length, pngCount: manifest.pngCount }, null, 2));
    if (errors.length > 0) process.exitCode = 1;
  }
}

main().catch(async (error) => {
  recordError('main', error);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true }).catch(() => {});
  await fs.writeFile(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), errors, ignoredErrors }, null, 2)).catch(() => {});
  console.error(error);
  process.exit(1);
});
