import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/52-function-state-flows-batch17');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch17-manifest.json');
const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 1100 };
const sessionId = 'cmqea1d3n001euwyfoi7b6pru';
const joinCode = '129051';
const courseSlug = 'unit-4-1-design-task-expression';

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
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
  await sleep(2500);
}

async function gotoStable(page, route, waitMs = 2200) {
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
    }));
    const inputs = [...document.querySelectorAll('input, textarea, select')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      value: 'value' in el ? String(el.value || '').slice(0, 80) : '',
      hidden: Boolean(el.hidden || el.closest('[hidden]') || getComputedStyle(el).display === 'none'),
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
        type: active?.getAttribute?.('type') || '',
        name: name(active),
        placeholder: active?.getAttribute?.('placeholder') || '',
      },
      alerts: [...document.querySelectorAll('[role="alert"], [aria-live], [role="status"]')]
        .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
        .filter((item) => item.text),
      buttons: buttons.slice(0, 100),
      inputs,
      unnamedButtons: buttons.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 2000),
    };
  });
}

async function capture(page, fileName, label, notes = {}) {
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  const audit = await domAudit(page);
  const a11yPath = filePath.replace(/\.png$/, '.a11y.json');
  await fs.writeFile(a11yPath, JSON.stringify({ accessibilitySnapshotUnavailable: true, audit }, null, 2));
  results.push({
    step: results.length + 1,
    label,
    route: new URL(audit.url).pathname + new URL(audit.url).search,
    screenshot: path.relative(root, filePath),
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
    },
  });
}

async function clickRole(page, role, name, options = {}) {
  const locator = page.getByRole(role, { name });
  if (await locator.count()) {
    await locator.first().click(options).catch((error) => errors.push({ action: `click ${String(name)}`, message: error.message }));
    await sleep(options.waitMs ?? 1500);
    return `${role}:${String(name)}`;
  }
  return 'not-found';
}

async function clickText(page, name, options = {}) {
  const locator = page.getByText(name);
  if (await locator.count()) {
    await locator.first().click(options).catch((error) => errors.push({ action: `click text ${String(name)}`, message: error.message }));
    await sleep(options.waitMs ?? 1500);
    return `text:${String(name)}`;
  }
  return 'not-found';
}

async function fillFirstJoinCodeInput(page, code) {
  const input = page.locator('input[placeholder*="课堂码"], input[aria-label*="课堂码"], input[inputmode="numeric"], input').first();
  await input.fill(code);
  await sleep(300);
}

async function main() {
  await fs.mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  async function newPage(viewport, role) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      locale: 'zh-CN',
      acceptDownloads: true,
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseUrl }).catch(() => {});
    const page = await context.newPage();
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message(), url: page.url() });
      await dialog.dismiss().catch(() => {});
    });
    page.on('download', (download) => {
      downloads.push({ suggestedFilename: download.suggestedFilename(), url: page.url() });
    });
    page.on('pageerror', (error) => errors.push({ action: 'pageerror', message: error.message, url: page.url() }));
    if (role) await login(page, role);
    return { context, page };
  }

  const student = await newPage(mobile, 'student');
  await gotoStable(student.page, `/classroom/join?code=${joinCode}`);
  await capture(student.page, '01-student-classroom-join-prefilled-mobile.png', 'student classroom join prefilled mobile', {
    expected: 'QR/scanned join page should prefill or expose the active class code and next action',
    joinCode,
  });
  const joinScanAction = await clickRole(student.page, 'button', /加入|进入|查询|提交/);
  await capture(student.page, '02-student-classroom-join-result-mobile.png', 'student classroom join result mobile', {
    action: joinScanAction,
    expected: 'successful classroom join should route to the student runtime or show actionable error',
    joinCode,
  });

  await gotoStable(student.page, `/interactive-learning/courses/${courseSlug}`);
  await fillFirstJoinCodeInput(student.page, joinCode);
  await capture(student.page, '03-student-course-entry-valid-code-filled-mobile.png', 'student course entry valid code filled mobile', {
    joinCode,
  });
  const courseJoinAction = await clickRole(student.page, 'button', /加入课堂/);
  await sleep(2200);
  await capture(student.page, '04-student-course-entry-valid-code-result-mobile.png', 'student course entry valid code result mobile', {
    action: courseJoinAction,
    expected: 'course entry valid code should land in active student runtime',
    sessionId,
  });
  await student.context.close();

  const teacher = await newPage(mobile, 'teacher');
  await gotoStable(teacher.page, `/interactive-learning/courses/${courseSlug}/teacher/${sessionId}/waiting`, 3000);
  await capture(teacher.page, '05-teacher-waiting-real-session-mobile.png', 'teacher waiting real session mobile', {
    sessionId,
    joinCode,
  });
  const copyCodeAction = await clickRole(teacher.page, 'button', /复制课堂码/);
  await capture(teacher.page, '06-teacher-waiting-copy-code-feedback-mobile.png', 'teacher waiting copy code feedback mobile', {
    action: copyCodeAction,
    expected: 'copy code should show visible and announced feedback',
  });
  const copyLinkAction = await clickRole(teacher.page, 'button', /复制加入链接/);
  await capture(teacher.page, '07-teacher-waiting-copy-link-feedback-mobile.png', 'teacher waiting copy link feedback mobile', {
    action: copyLinkAction,
    expected: 'copy link should show visible and announced feedback',
  });
  const startAction = await clickRole(teacher.page, 'link', /开始上课/);
  if (startAction === 'not-found') {
    await clickRole(teacher.page, 'button', /开始上课/);
  }
  await sleep(2400);
  await capture(teacher.page, '08-teacher-waiting-start-class-result-mobile.png', 'teacher waiting start class result mobile', {
    action: startAction,
    expected: 'start class should route to teacher projection runtime',
  });

  const qrAction = await clickRole(teacher.page, 'button', /二维码/);
  await capture(teacher.page, '09-teacher-runtime-qr-dialog-mobile.png', 'teacher runtime QR dialog mobile', {
    action: qrAction,
    expected: 'runtime QR dialog should expose code/link copy without blocking projection context',
  });
  const dialogCopyAction = await clickRole(teacher.page, 'button', /复制课堂码/);
  await capture(teacher.page, '10-teacher-runtime-qr-dialog-copy-feedback-mobile.png', 'teacher runtime QR copy feedback mobile', {
    action: dialogCopyAction,
    expected: 'dialog copy should show status feedback',
  });
  await teacher.page.keyboard.press('Escape').catch(() => {});
  await sleep(800);
  const nextAction = await clickRole(teacher.page, 'button', /下一页/);
  await capture(teacher.page, '11-teacher-runtime-next-page-mobile.png', 'teacher runtime next page mobile', {
    action: nextAction,
    expected: 'next page should visibly update page number and content',
  });
  await teacher.context.close();

  const admin = await newPage(mobile, 'admin');
  await gotoStable(admin.page, '/admin/users', 2500);
  const downloadPromise = admin.page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  const downloadAction = await clickRole(admin.page, 'button', /下载模板/);
  const download = await downloadPromise;
  if (download) {
    downloads.push({ suggestedFilename: download.suggestedFilename(), url: admin.page.url(), source: 'awaited-download' });
  }
  await capture(admin.page, '12-admin-users-template-download-mobile.png', 'admin users template download mobile', {
    action: downloadAction,
    downloadObserved: Boolean(download),
    downloads,
    expected: 'template download should provide visible success/failure status, not only browser download',
  });
  await gotoStable(admin.page, '/admin/data-governance', 3000);
  await admin.page.waitForFunction(() => !document.body.innerText.includes('正在加载数据治理看板'), null, { timeout: 20000 }).catch(() => {});
  const qualityAction = await clickText(admin.page, '课堂质量');
  await capture(admin.page, '13-admin-data-governance-class-quality-tab-mobile.png', 'admin data governance class quality tab mobile', {
    action: qualityAction,
  });
  const sourcesAction = await clickText(admin.page, '证据源');
  await capture(admin.page, '14-admin-data-governance-sources-tab-mobile.png', 'admin data governance sources tab mobile', {
    action: sourcesAction,
  });
  const cacheAction = await clickText(admin.page, '缓存健康');
  await capture(admin.page, '15-admin-data-governance-cache-tab-mobile.png', 'admin data governance cache tab mobile', {
    action: cacheAction,
  });
  await admin.context.close();

  const adminDesktop = await newPage(desktop, 'admin');
  await gotoStable(adminDesktop.page, '/admin/data-governance', 3000);
  await adminDesktop.page.waitForFunction(() => !document.body.innerText.includes('正在加载数据治理看板'), null, { timeout: 20000 }).catch(() => {});
  await capture(adminDesktop.page, '16-admin-data-governance-overview-desktop.png', 'admin data governance overview desktop', {
    expected: 'desktop governance overview should preserve table readability and action hierarchy',
  });
  await adminDesktop.context.close();

  await browser.close();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 17,
    sessionId,
    joinCode,
    courseSlug,
    screenshotCount: results.length,
    downloads,
    dialogs,
    errors,
    results,
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ manifestPath, screenshotCount: results.length, downloads, dialogs, errors }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
