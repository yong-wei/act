import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import writeXlsxFile from 'write-excel-file/node';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/54-function-state-flows-batch19');
const fixtureDir = path.join(root, 'fixtures/batch19-admin-import');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch19-manifest.json');
const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 1100 };
const runStamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

const accounts = {
  admin: { account: 'admin', password: 'admin@Just' },
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

async function waitForGovernanceLoaded(page) {
  await page.waitForFunction(() => !document.body.innerText.includes('正在加载数据治理看板'), null, { timeout: 20000 }).catch(() => {});
  await sleep(1000);
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
      accept: el.getAttribute('accept') || '',
      value: 'value' in el ? String(el.value || '').slice(0, 120) : '',
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
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 5),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        name: name(active),
        placeholder: active?.getAttribute?.('placeholder') || '',
      },
      alerts: statusRegions,
      buttons: buttons.slice(0, 160),
      inputs,
      tables,
      unnamedButtons: buttons.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 3200),
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
      fileInputs: audit.inputs.filter((input) => input.type === 'file'),
      buttonCount: audit.buttons.length,
      unnamedButtons: audit.unnamedButtons,
      tableCount: audit.tables.length,
      tables: audit.tables,
      graphicsCount: audit.graphicsCount,
      unnamedGraphics: audit.unnamedGraphics,
    },
  });
}

async function clickRole(page, role, name, options = {}) {
  const locator = page.getByRole(role, { name });
  if (await locator.count()) {
    await locator.first().click(options).catch((error) => errors.push({ action: `click ${String(name)}`, message: error.message, url: page.url() }));
    await sleep(options.waitMs ?? 1400);
    return `${role}:${String(name)}`;
  }
  errors.push({ action: `click ${role}:${String(name)}`, message: 'locator not found', url: page.url() });
  return 'not-found';
}

async function clickText(page, name, options = {}) {
  const locator = page.getByText(name);
  if (await locator.count()) {
    await locator.first().click(options).catch((error) => errors.push({ action: `click text ${String(name)}`, message: error.message, url: page.url() }));
    await sleep(options.waitMs ?? 1200);
    return `text:${String(name)}`;
  }
  errors.push({ action: `click text:${String(name)}`, message: 'locator not found', url: page.url() });
  return 'not-found';
}

async function writeWorkbook(filePath, rows) {
  const buffer = await writeXlsxFile(rows, { sheet: '导入模板' }).toBuffer();
  await fs.writeFile(filePath, buffer);
}

async function createFixtures() {
  await fs.mkdir(fixtureDir, { recursive: true });
  const malformed = path.join(fixtureDir, `malformed-${runStamp}.xlsx`);
  const missingHeaders = path.join(fixtureDir, `missing-headers-${runStamp}.xlsx`);
  const mixed = path.join(fixtureDir, `mixed-valid-invalid-${runStamp}.xlsx`);
  const update = path.join(fixtureDir, `update-existing-${runStamp}.xlsx`);
  const createdAccount = `audit${runStamp}`;

  await fs.writeFile(malformed, 'not a workbook');
  await writeWorkbook(missingHeaders, [
    ['邮箱', '班级'],
    [`missing-${runStamp}@example.com`, '自动化2401'],
  ]);
  await writeWorkbook(mixed, [
    ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
    [createdAccount, `审计导入学生${runStamp}`, '学生', `${createdAccount}@example.com`, '审计班级', '自动化', '2026', 'Audit@123456'],
    [`badrole${runStamp}`, '审计错误角色', '访客', '', '审计班级', '自动化', '2026', 'Audit@123456'],
  ]);
  await writeWorkbook(update, [
    ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
    [createdAccount, `审计导入学生更新${runStamp}`, '学生', `${createdAccount}@example.com`, '审计班级二次', '自动化', '2026', 'Audit@123456'],
  ]);

  return { malformed, missingHeaders, mixed, update, createdAccount };
}

async function setImportFile(page, filePath) {
  await page.locator('input[type="file"]').first().setInputFiles(filePath);
  await sleep(3200);
}

async function main() {
  await fs.mkdir(screenshotDir, { recursive: true });
  const fixtures = await createFixtures();
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
      dialogs.push({ type: dialog.type(), message: dialog.message(), url: page.url() });
      await dialog.dismiss().catch(() => {});
    });
    page.on('download', (download) => {
      downloads.push({ suggestedFilename: download.suggestedFilename(), url: page.url() });
    });
    page.on('pageerror', (error) => errors.push({ action: 'pageerror', message: error.message, url: page.url() }));
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      errors.push({ action: 'requestfailed', url: request.url(), message: failure?.errorText || 'unknown' });
    });
    if (role) await login(page, role);
    return { context, page };
  }

  const adminMobile = await newPage(mobile, 'admin');
  await gotoStable(adminMobile.page, '/admin/data-governance', 3000);
  await waitForGovernanceLoaded(adminMobile.page);
  await capture(adminMobile.page, '01-admin-data-governance-overview-mobile.png', 'admin data governance overview mobile', {
    expected: 'admin should see prioritized risks and next actions before dense tables',
  });
  const refreshAction = await clickRole(adminMobile.page, 'button', /刷新状态/);
  await capture(adminMobile.page, '02-admin-data-governance-refresh-result-mobile.png', 'admin data governance refresh result mobile', {
    action: refreshAction,
    expected: 'refresh should show started/completed/failed status, not only update timestamp silently',
  });
  const sessionsAction = await clickRole(adminMobile.page, 'button', /^课堂质量$/);
  await capture(adminMobile.page, '03-admin-data-governance-session-quality-mobile.png', 'admin data governance session quality mobile', {
    action: sessionsAction,
    expected: 'session quality tab should expose selected state, title sync, and readable rows',
  });
  const sourcesAction = await clickRole(adminMobile.page, 'button', /^证据源$/);
  await capture(adminMobile.page, '04-admin-data-governance-source-catalog-mobile.png', 'admin data governance source catalog mobile', {
    action: sourcesAction,
    expected: 'source catalog should convert table data into mobile-readable action summaries',
  });
  const cacheAction = await clickRole(adminMobile.page, 'button', /^缓存健康$/);
  await capture(adminMobile.page, '05-admin-data-governance-cache-health-mobile.png', 'admin data governance cache health mobile', {
    action: cacheAction,
    expected: 'cache health should explain stale entries and next refresh action',
  });
  await adminMobile.context.close();

  const adminDesktop = await newPage(desktop, 'admin');
  await gotoStable(adminDesktop.page, '/admin/data-governance', 3000);
  await waitForGovernanceLoaded(adminDesktop.page);
  await capture(adminDesktop.page, '06-admin-data-governance-overview-desktop.png', 'admin data governance overview desktop', {
    expected: 'desktop should expose risk handling, export, and refresh completion affordances',
  });
  await clickRole(adminDesktop.page, 'button', /^课堂质量$/);
  await capture(adminDesktop.page, '07-admin-data-governance-session-quality-desktop.png', 'admin data governance session quality desktop', {
    expected: 'desktop session quality should support follow-up actions from each row',
  });
  await adminDesktop.context.close();

  const users = await newPage(mobile, 'admin');
  await gotoStable(users.page, '/admin/users', 3000);
  await capture(users.page, '08-admin-users-import-entry-mobile.png', 'admin users import entry mobile', {
    expected: 'bulk import should expose preview/field/impact information before file chooser',
  });
  const chooserPromise = users.page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null);
  const importClickAction = await clickRole(users.page, 'button', /批量导入/);
  const chooser = await chooserPromise;
  await capture(users.page, '09-admin-users-import-filechooser-trigger-mobile.png', 'admin users import file chooser trigger mobile', {
    action: importClickAction,
    fileChooserObserved: Boolean(chooser),
    expected: 'file chooser should not be the first visible confirmation layer for a bulk operation',
  });
  if (chooser) {
    await chooser.setFiles(fixtures.malformed);
    await sleep(3200);
  } else {
    await setImportFile(users.page, fixtures.malformed);
  }
  await capture(users.page, '10-admin-users-import-malformed-workbook-mobile.png', 'admin users malformed workbook mobile', {
    fixture: path.relative(root, fixtures.malformed),
    expected: 'malformed workbook should explain recovery and link official template',
  });
  await setImportFile(users.page, fixtures.missingHeaders);
  await capture(users.page, '11-admin-users-import-missing-headers-mobile.png', 'admin users import missing headers mobile', {
    fixture: path.relative(root, fixtures.missingHeaders),
    expected: 'missing headers should show required columns near the import result, not only a transient notice',
  });
  await setImportFile(users.page, fixtures.mixed);
  await capture(users.page, '12-admin-users-import-mixed-result-mobile.png', 'admin users import mixed result mobile', {
    fixture: path.relative(root, fixtures.mixed),
    createdAccount: fixtures.createdAccount,
    expected: 'mixed result should preserve success count, failed rows, rollback/export actions, and batch identity',
  });
  await setImportFile(users.page, fixtures.update);
  await capture(users.page, '13-admin-users-import-update-existing-mobile.png', 'admin users import update existing mobile', {
    fixture: path.relative(root, fixtures.update),
    createdAccount: fixtures.createdAccount,
    expected: 'repeat import should distinguish update from duplicate and expose batch history',
  });
  const search = users.page.locator('input:visible:not([type="file"])').filter({ hasNotText: /^$/ }).first();
  const visibleSearch = users.page.locator('input[placeholder*="搜索"]:visible, input[type="search"]:visible').first();
  if (await visibleSearch.count()) {
    await visibleSearch.fill(fixtures.createdAccount).catch((error) => errors.push({ action: 'search imported account', message: error.message, url: users.page.url() }));
  } else if (await search.count()) {
    await search.fill(fixtures.createdAccount).catch((error) => errors.push({ action: 'search imported account fallback', message: error.message, url: users.page.url() }));
  } else {
    errors.push({ action: 'search imported account', message: 'visible search input not found', url: users.page.url() });
  }
  await sleep(1400);
  await capture(users.page, '14-admin-users-imported-account-search-mobile.png', 'admin users imported account search mobile', {
    createdAccount: fixtures.createdAccount,
    expected: 'after import, admin should be able to isolate this batch or account without manual global search',
  });
  await users.context.close();

  const usersDesktop = await newPage(desktop, 'admin');
  await gotoStable(usersDesktop.page, '/admin/users', 3000);
  await capture(usersDesktop.page, '15-admin-users-import-state-desktop.png', 'admin users import state desktop', {
    expected: 'desktop import area should keep template, import, result, and search/batch management visible',
  });
  await usersDesktop.context.close();

  await browser.close();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 19,
    runStamp,
    fixtures: {
      malformed: path.relative(root, fixtures.malformed),
      missingHeaders: path.relative(root, fixtures.missingHeaders),
      mixed: path.relative(root, fixtures.mixed),
      update: path.relative(root, fixtures.update),
      createdAccount: fixtures.createdAccount,
    },
    screenshotCount: results.length,
    downloads,
    dialogs,
    errors,
    results,
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ manifestPath, screenshotCount: results.length, fixtures: manifest.fixtures, downloads, dialogs, errors }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
