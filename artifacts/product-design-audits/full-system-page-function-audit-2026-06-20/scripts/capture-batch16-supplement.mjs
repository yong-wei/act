import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/51-function-state-flows-batch16');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch16-manifest.json');
const mobile = { width: 390, height: 844 };
const accounts = {
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
  admin: { account: 'admin', password: 'admin@Just' },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function login(page, role) {
  const account = accounts[role];
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2500);
}

async function domAudit(page) {
  return await page.evaluate(() => {
    const text = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    const active = document.activeElement;
    const name = (el) => el?.getAttribute?.('aria-label') || el?.getAttribute?.('title') || text(el) || '';
    const buttons = [...document.querySelectorAll('button, [role="button"], a[href]')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      href: el.getAttribute('href') || '',
    }));
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
        name: name(active),
      },
      alerts: [...document.querySelectorAll('[role="alert"], [aria-live], [role="status"]')]
        .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
        .filter((item) => item.text),
      buttons: buttons.slice(0, 100),
      unnamedButtons: buttons.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 1800),
    };
  });
}

async function capture(page, manifest, fileName, label, notes = {}) {
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  const audit = await domAudit(page);
  const a11yPath = filePath.replace(/\.png$/, '.a11y.json');
  await fs.writeFile(a11yPath, JSON.stringify({ accessibilitySnapshotUnavailable: true, audit }, null, 2));
  manifest.results.push({
    step: manifest.results.length + 1,
    label,
    route: new URL(audit.url).pathname + new URL(audit.url).search,
    screenshot: path.relative(root, filePath),
    a11y: path.relative(root, a11yPath),
    notes,
    auditSummary: {
      h1: audit.h1,
      activeElement: audit.activeElement,
      alerts: audit.alerts,
      buttonCount: audit.buttons.length,
      unnamedButtons: audit.unnamedButtons,
      graphicsCount: audit.graphicsCount,
      unnamedGraphics: audit.unnamedGraphics,
    },
  });
}

async function clickFirst(page, name) {
  const button = page.getByRole('button', { name });
  if (await button.count()) {
    await button.first().click().catch(() => {});
    await sleep(1000);
    return `button:${String(name)}`;
  }
  const link = page.getByRole('link', { name });
  if (await link.count()) {
    await link.first().click().catch(() => {});
    await sleep(1600);
    return `link:${String(name)}`;
  }
  const text = page.getByText(name);
  if (await text.count()) {
    await text.first().click().catch(() => {});
    await sleep(1600);
    return `text:${String(name)}`;
  }
  return 'not-found';
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const browser = await chromium.launch({ headless: true });

  async function newPage(role) {
    const context = await browser.newContext({ viewport: mobile, locale: 'zh-CN', acceptDownloads: true });
    const page = await context.newPage();
    await login(page, role);
    return { context, page };
  }

  const admin = await newPage('admin');
  await admin.page.goto(`${baseUrl}/admin/data-governance`, { waitUntil: 'domcontentloaded' });
  await admin.page.waitForFunction(() => !document.body.innerText.includes('正在加载数据治理看板'), null, { timeout: 20000 }).catch(() => {});
  await sleep(1000);
  await capture(
    admin.page,
    manifest,
    '14-admin-data-governance-loaded-or-blocked-mobile.png',
    'admin data governance loaded or blocked mobile',
    { expected: 'governance page should leave loading state and expose status, error, or retry action' },
  );
  const refreshAction = await clickFirst(admin.page, /刷新状态/);
  await capture(
    admin.page,
    manifest,
    '15-admin-data-governance-refresh-action-mobile.png',
    'admin data governance refresh action mobile',
    { action: refreshAction, expected: 'refresh action should show progress and preserve prior status context' },
  );
  await admin.context.close();

  const teacher = await newPage('teacher');
  await teacher.page.goto(`${baseUrl}/teacher/history`, { waitUntil: 'domcontentloaded' });
  await sleep(2200);
  const statsAction = await clickFirst(teacher.page, /课堂统计/);
  await capture(
    teacher.page,
    manifest,
    '16-teacher-history-class-statistics-mobile.png',
    'teacher history class statistics mobile',
    { action: statsAction, expected: 'history statistics action should land on a readable report or explain missing data' },
  );
  await teacher.page.goto(`${baseUrl}/classroom/teacher/cmqea1d3n001euwyfoi7b6pru`, { waitUntil: 'domcontentloaded' });
  await sleep(2200);
  await capture(
    teacher.page,
    manifest,
    '17-teacher-active-session-runtime-mobile.png',
    'teacher active session runtime mobile',
    { expected: 'active session runtime should expose classroom code, controls, and projection state without requiring class binding' },
  );
  await teacher.context.close();

  await browser.close();
  manifest.generatedAt = new Date().toISOString();
  manifest.screenshotCount = manifest.results.length;
  manifest.supplemented = true;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ manifestPath, screenshotCount: manifest.screenshotCount }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
