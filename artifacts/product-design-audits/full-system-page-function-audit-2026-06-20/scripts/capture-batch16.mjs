import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/51-function-state-flows-batch16');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch16-manifest.json');

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
  admin: { account: 'admin', password: 'admin@Just' },
};

const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 1200 };
const results = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir() {
  await fs.mkdir(screenshotDir, { recursive: true });
}

async function login(page, role) {
  const { account, password } = accounts[role];
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2500);
}

async function gotoStable(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await sleep(2200);
}

async function domAudit(page) {
  return await page.evaluate(() => {
    const text = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    const accessibleName = (el) => {
      if (!el) return '';
      return (
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.getAttribute('alt') ||
        text(el) ||
        ''
      ).trim();
    };
    const active = document.activeElement;
    const inputs = [...document.querySelectorAll('input, textarea, select')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      valueLength: 'value' in el ? String(el.value || '').length : 0,
      hidden: Boolean(el.hidden || el.closest('[hidden]') || getComputedStyle(el).display === 'none'),
    }));
    const buttons = [...document.querySelectorAll('button, [role="button"], a[href]')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: accessibleName(el),
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      href: el.getAttribute('href') || '',
    }));
    const unnamedButtons = buttons.filter((button) => !button.name).length;
    const graphics = [...document.querySelectorAll('svg, canvas')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: accessibleName(el),
      role: el.getAttribute('role') || '',
      ariaHidden: el.getAttribute('aria-hidden') || '',
    }));
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 5),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        name: accessibleName(active),
        placeholder: active?.getAttribute?.('placeholder') || '',
      },
      alerts: [...document.querySelectorAll('[role="alert"], [aria-live], [role="status"]')]
        .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
        .filter((item) => item.text),
      inputs,
      buttons: buttons.slice(0, 80),
      unnamedButtons,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 1600),
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

async function clickAny(page, patterns, options = {}) {
  for (const pattern of patterns) {
    const locator = page.getByRole('button', { name: pattern });
    if (await locator.count()) {
      await locator.first().click(options).catch(() => {});
      await sleep(1400);
      return `button:${pattern}`;
    }
    const textLocator = page.getByText(pattern);
    if (await textLocator.count()) {
      await textLocator.first().click(options).catch(() => {});
      await sleep(1400);
      return `text:${pattern}`;
    }
  }
  return 'not-found';
}

async function fillClassroomCode(page, value) {
  const input = page
    .locator('input[placeholder*="课堂码"], input[aria-label*="课堂码"], input')
    .last();
  await input.fill(value);
  await sleep(300);
}

async function recordFocusSequence(page, count = 8) {
  const sequence = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press('Tab');
    await sleep(150);
    sequence.push(await page.evaluate(() => {
      const el = document.activeElement;
      const text = (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        tag: el?.tagName?.toLowerCase() || '',
        type: el?.getAttribute?.('type') || '',
        name: el?.getAttribute?.('aria-label') || el?.getAttribute?.('placeholder') || text || '',
      };
    }));
  }
  return sequence;
}

async function main() {
  await ensureDir();
  const browser = await chromium.launch({ headless: true });
  const dialogs = [];
  const downloads = [];
  const fileChoosers = [];

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
    if (role) await login(page, role);
    return { context, page };
  }

  const studentMobile = await newPage(mobile, 'student');
  await gotoStable(studentMobile.page, '/interactive-learning/courses/unit-1-1-see-the-full-picture');
  await fillClassroomCode(studentMobile.page, '123');
  const shortJoin = await clickAny(studentMobile.page, [/加入课堂|进入课堂|查询|提交/]);
  await capture(
    studentMobile.page,
    '01-course-entry-short-classroom-code-mobile.png',
    'student course entry short classroom code mobile',
    { action: shortJoin, expected: 'course entry should show field-level 6-digit guidance' },
  );

  await fillClassroomCode(studentMobile.page, '123456');
  const invalidJoin = await clickAny(studentMobile.page, [/加入课堂|进入课堂|查询|提交/]);
  await capture(
    studentMobile.page,
    '02-course-entry-invalid-classroom-code-mobile.png',
    'student course entry invalid classroom code mobile',
    { action: invalidJoin, expected: 'course entry should show invalid-code feedback' },
  );

  await gotoStable(studentMobile.page, '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo');
  const runtimeAction = await clickAny(studentMobile.page, [/下一页|继续|提交|完成|下一步|开始/]);
  await capture(
    studentMobile.page,
    '03-student-course-demo-after-primary-action-mobile.png',
    'student course demo after primary action mobile',
    { action: runtimeAction, expected: 'student runtime should make action state and next step visible' },
  );

  await gotoStable(studentMobile.page, '/interactive-learning/courses/unit-1-1-see-the-full-picture');
  const exportAction = await clickAny(studentMobile.page, [/导出 PDF|下载 PDF|下载讲义|导出/]);
  await capture(
    studentMobile.page,
    '04-course-entry-handout-export-action-mobile.png',
    'course entry handout export action mobile',
    { action: exportAction, downloadsObserved: downloads.length },
  );
  await studentMobile.context.close();

  const teacherMobile = await newPage(mobile, 'teacher');
  await gotoStable(teacherMobile.page, '/teacher/classes/cmma7g0590004g9q2nl2jyzdf');
  const copyAction = await clickAny(teacherMobile.page, [/复制课堂码|复制|课堂码/]);
  await capture(
    teacherMobile.page,
    '05-teacher-class-code-copy-mobile.png',
    'teacher class code copy mobile',
    { action: copyAction, expected: 'copy action should have visible confirmation' },
  );

  const resetAction = await clickAny(teacherMobile.page, [/重新生成|重置课堂码/]);
  await capture(
    teacherMobile.page,
    '06-teacher-class-code-reset-native-dialog-mobile.png',
    'teacher class code reset native dialog mobile',
    { action: resetAction, dialogsObserved: dialogs.slice() },
  );

  await gotoStable(teacherMobile.page, '/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics-v2');
  const analyticsAction = await clickAny(teacherMobile.page, [/导出|下载|报告|查看报告/]);
  await capture(
    teacherMobile.page,
    '07-teacher-class-analytics-export-inventory-mobile.png',
    'teacher class analytics export inventory mobile',
    { action: analyticsAction, expected: 'analytics page should expose report/export path if available' },
  );

  await gotoStable(teacherMobile.page, '/teacher/history');
  const historyAction = await clickAny(teacherMobile.page, [/查看报告|课堂报告|报告|复盘/]);
  await capture(
    teacherMobile.page,
    '08-teacher-history-report-action-mobile.png',
    'teacher history report action mobile',
    { action: historyAction, expected: 'history should route teachers to report/replay with clear state' },
  );
  await teacherMobile.context.close();

  const adminMobile = await newPage(mobile, 'admin');
  await gotoStable(adminMobile.page, '/admin/users');
  const newAccountAction = await clickAny(adminMobile.page, [/新建账号|添加账号/]);
  const focusSequence = await recordFocusSequence(adminMobile.page, 10);
  await capture(
    adminMobile.page,
    '09-admin-new-account-focus-sequence-mobile.png',
    'admin new account modal focus sequence mobile',
    { action: newAccountAction, focusSequence },
  );

  await adminMobile.page.keyboard.press('Escape');
  await sleep(700);
  await capture(
    adminMobile.page,
    '10-admin-new-account-escape-state-mobile.png',
    'admin new account modal escape state mobile',
    { expected: 'Escape should close modal or keep focus contained with explicit handling' },
  );

  await gotoStable(adminMobile.page, '/admin/users');
  const fileChooserPromise = adminMobile.page.waitForEvent('filechooser', { timeout: 2000 })
    .then((chooser) => {
      fileChoosers.push({
        isMultiple: chooser.isMultiple(),
        element: 'batch import file input',
      });
      return chooser;
    })
    .catch(() => null);
  const importAction = await clickAny(adminMobile.page, [/批量导入/]);
  await fileChooserPromise;
  const fileInputs = await adminMobile.page.evaluate(() => [...document.querySelectorAll('input[type="file"]')].map((input) => ({
    accept: input.getAttribute('accept') || '',
    ariaLabel: input.getAttribute('aria-label') || '',
    hidden: Boolean(input.hidden || input.closest('[hidden]') || getComputedStyle(input).display === 'none'),
  })));
  await capture(
    adminMobile.page,
    '11-admin-batch-import-filechooser-mobile.png',
    'admin batch import file chooser mobile',
    { action: importAction, fileChoosers, fileInputs },
  );

  await gotoStable(adminMobile.page, '/admin/data-governance');
  const governanceAction = await clickAny(adminMobile.page, [/刷新队列|查看风险|导出摘要|刷新|导出/]);
  await capture(
    adminMobile.page,
    '12-admin-data-governance-action-mobile.png',
    'admin data governance action mobile',
    { action: governanceAction, expected: 'governance actions should expose progress/result states' },
  );
  await adminMobile.context.close();

  const adminDesktop = await newPage(desktop, 'admin');
  await gotoStable(adminDesktop.page, '/admin');
  await capture(
    adminDesktop.page,
    '13-admin-overview-action-density-desktop.png',
    'admin overview action density desktop',
    { expected: 'admin overview should explain next operational action and alert scope' },
  );
  await adminDesktop.context.close();

  await browser.close();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 16,
    destination: screenshotDir,
    screenshotCount: results.length,
    dialogs,
    downloads,
    fileChoosers,
    results,
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ manifestPath, screenshotCount: results.length, dialogs, downloads, fileChoosers }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
