import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/62-function-state-flows-batch27');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch27-manifest.json');
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

async function gotoStable(page, route, waitMs = 3000) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' }).catch((error) => {
    recordError(`goto ${route}`, error, page.url());
    return null;
  });
  routeResponses.push({ route, status: response?.status?.() ?? null, url: response?.url?.() ?? `${baseUrl}${route}` });
  await sleep(waitMs);
  return response;
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
      value: 'value' in el ? String(el.value || '').slice(0, 180) : '',
      hidden: Boolean(el.hidden || el.closest('[hidden]') || getComputedStyle(el).display === 'none'),
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
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 8),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
        placeholder: active?.getAttribute?.('placeholder') || '',
      },
      alerts: statusRegions,
      buttons: controls.slice(0, 320),
      inputs,
      unnamedButtons: controls.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 10000),
    };
  });
}

async function capture(page, fileName, label, notes = {}) {
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = await fs.stat(filePath);
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
    screenshotBytes: stat.size,
    a11y: path.relative(root, a11yPath),
    notes,
    auditSummary: {
      h1: audit.h1,
      activeElement: audit.activeElement,
      alerts: audit.alerts,
      inputCount: audit.inputs.length,
      buttonCount: audit.buttons.length,
      unnamedButtons: audit.unnamedButtons,
      graphicsCount: audit.graphicsCount,
      unnamedGraphics: audit.unnamedGraphics,
      hits: {
        risk: body.includes('风险') || body.includes('告警'),
        resolve: body.includes('处置') || body.includes('分派') || body.includes('标记处理'),
        export: body.includes('导出') || body.includes('下载'),
        refresh: body.includes('刷新'),
        batchImport: body.includes('批量导入'),
        configSave: body.includes('保存配置'),
        liveStatus: audit.alerts.length > 0,
      },
    },
  });
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
    summary: JSON.stringify(response.body).slice(0, 1400),
  });
  if (!accepted) recordError(`api ${label}`, `unexpected status ${response.status}`, route);
}

async function runAudit() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const desktopPage = await newAdminPage(desktop);
  await gotoStable(desktopPage.page, '/admin', 3200);
  await capture(desktopPage.page, '01-admin-home-governance-overview-desktop.png', 'admin home governance overview desktop', {
    expected: 'admin home should turn risk, configuration, user batch, and governance into clear next actions',
  });

  await gotoStable(desktopPage.page, '/admin/data-governance', 4200);
  await capture(desktopPage.page, '02-admin-data-governance-overview-desktop.png', 'admin data governance overview desktop', {
    expected: 'data governance overview should show queue health, risks, refresh state, and risk disposition paths',
  });

  const refresh = desktopPage.page.getByRole('button', { name: /刷新状态|刷新数据|刷新/ });
  if (await refresh.count()) {
    await refresh.first().click().catch((error) => recordError('click admin governance refresh', error, desktopPage.page.url()));
    await sleep(1800);
  }
  await capture(desktopPage.page, '03-admin-data-governance-after-refresh-desktop.png', 'admin data governance after refresh desktop', {
    expected: 'refresh should produce visible completion state and preserve risk disposition actions',
  });

  await gotoStable(desktopPage.page, '/admin/users', 3600);
  await capture(desktopPage.page, '04-admin-users-batch-operations-desktop.png', 'admin users batch operations desktop', {
    expected: 'user management should expose batch import, template download, status, undo, and notification paths',
  });

  await gotoStable(desktopPage.page, '/admin/config', 3600);
  await capture(desktopPage.page, '05-admin-system-config-actions-desktop.png', 'admin system config actions desktop', {
    expected: 'system config should separate saved settings, unsaved drafts, provider validation, and test result states',
  });

  await fetchApi(desktopPage.page, 'admin overview', '/api/admin/overview', [200]);
  await fetchApi(desktopPage.page, 'admin data governance status', '/api/admin/data-governance/status', [200]);
  await fetchApi(desktopPage.page, 'admin system usage', '/api/admin/system-usage', [200]);
  await fetchApi(desktopPage.page, 'admin users search', '/api/admin/users?search=admin', [200]);
  await fetchApi(desktopPage.page, 'admin users template download', '/api/admin/users/template', [200]);

  const mobilePage = await newAdminPage(mobile);
  await gotoStable(mobilePage.page, '/admin/data-governance', 4200);
  await capture(mobilePage.page, '06-admin-data-governance-mobile.png', 'admin data governance mobile', {
    expected: 'mobile governance should keep risk table, refresh state, and disposition actions readable',
  });

  await gotoStable(mobilePage.page, '/admin/users', 3600);
  await capture(mobilePage.page, '07-admin-users-batch-operations-mobile.png', 'admin users batch operations mobile', {
    expected: 'mobile user management should keep batch import, template, and search usable without table compression',
  });

  await gotoStable(mobilePage.page, '/admin/config', 3600);
  await capture(mobilePage.page, '08-admin-system-config-actions-mobile.png', 'admin system config actions mobile', {
    expected: 'mobile config should preserve save/reset/provider actions and validation status',
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
      batch: 'function-state-flows-batch27',
      scope: 'admin overview, data governance risk disposition, user batch operations, system config actions, and admin APIs',
      routeResponses,
      results,
      apiChecks,
      dialogs,
      downloads,
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
