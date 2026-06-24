import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import writeXlsxFile from 'write-excel-file/node';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/56-function-state-flows-batch21');
const fixtureDir = path.join(root, 'fixtures/batch21-teacher-class-roster');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch21-manifest.json');
const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 1100 };
const classId = 'cmma7g0590004g9q2nl2jyzdf';
const studentId = 'cmma7hck90005g9q21xy31um8';
const classCode = 'ZXVBP6';
const runStamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

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

async function waitForTextGone(page, text, timeout = 20000) {
  await page.waitForFunction((value) => !document.body.innerText.includes(value), text, { timeout }).catch(() => {});
  await sleep(700);
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
      buttons: buttons.slice(0, 200),
      inputs,
      tables,
      unnamedButtons: buttons.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 4600),
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
        classCode: body.includes(classCode) || body.includes('班级加入码') || body.includes('班级码'),
        addStudent: body.includes('添加学生') || body.includes('搜索添加'),
        import: body.includes('Excel') || body.includes('导入'),
        evidence: body.includes('证据') || body.includes('学习事实'),
        delete: body.includes('删除') || body.includes('移除'),
        status: body.includes('暂无') || body.includes('失败') || body.includes('未找到'),
      },
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

async function fillVisible(page, selector, value, waitMs = 1600) {
  const locator = page.locator(selector).filter({ visible: true });
  if (await locator.count()) {
    await locator.first().fill(value);
    await sleep(waitMs);
    return true;
  }
  errors.push({ action: `fill ${selector}`, message: 'visible locator not found', url: page.url() });
  return false;
}

async function setImportFile(page, filePath) {
  await page.locator('input[type="file"]').first().setInputFiles(filePath);
  await sleep(1000);
}

async function writeWorkbook(filePath, rows) {
  const buffer = await writeXlsxFile(rows, { sheet: '导入模板' }).toBuffer();
  await fs.writeFile(filePath, buffer);
}

async function createFixtures() {
  await fs.mkdir(fixtureDir, { recursive: true });
  const invalidStudent = path.join(fixtureDir, `invalid-student-${runStamp}.xlsx`);
  await writeWorkbook(invalidStudent, [
    ['学号'],
    [`missing-${runStamp}`],
  ]);
  return { invalidStudent };
}

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  const fixtures = await createFixtures();
  const browser = await chromium.launch({ headless: true });

  async function newPage(viewport, role, dialogMode = 'dismiss') {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      locale: 'zh-CN',
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message(), url: page.url(), mode: dialogMode });
      if (dialogMode === 'accept') await dialog.accept().catch(() => {});
      else await dialog.dismiss().catch(() => {});
    });
    page.on('download', (download) => {
      downloads.push({ suggestedFilename: download.suggestedFilename(), url: page.url() });
    });
    page.on('pageerror', (error) => errors.push({ action: 'pageerror', message: error.message, url: page.url() }));
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      if (failure?.errorText === 'net::ERR_ABORTED' && request.url().includes('/api/teacher/students/search')) {
        return;
      }
      errors.push({ action: 'requestfailed', url: request.url(), message: failure?.errorText || 'unknown' });
    });
    if (role) await login(page, role);
    return { context, page };
  }

  const teacherDesktop = await newPage(desktop, 'teacher', 'dismiss');
  await gotoStable(teacherDesktop.page, `/teacher/classes/${classId}`, 4200);
  await waitForTextGone(teacherDesktop.page, '加载班级详情');
  await capture(teacherDesktop.page, '01-teacher-class-detail-roster-desktop.png', 'teacher class detail roster desktop', {
    classId,
    expected: 'teacher should understand class code, roster status, evidence status, and safe member actions',
  });

  await clickRole(teacherDesktop.page, 'button', /添加学生/);
  await capture(teacherDesktop.page, '02-teacher-add-students-modal-default-desktop.png', 'teacher add students modal default desktop', {
    expected: 'add-students modal should announce purpose, class, default candidates, and selected search tab',
  });
  await fillVisible(teacherDesktop.page, 'input[placeholder*="姓名"], input[aria-label*="姓名"]', 'd', 1200);
  await capture(teacherDesktop.page, '03-teacher-add-students-one-char-error-desktop.png', 'teacher add students one char error desktop', {
    action: 'type:d',
    expected: 'one-character validation should be announced and keep focus near the field',
  });
  await fillVisible(teacherDesktop.page, 'input[placeholder*="姓名"], input[aria-label*="姓名"]', 'demo', 1800);
  await clickRole(teacherDesktop.page, 'button', /^搜索$/);
  await capture(teacherDesktop.page, '04-teacher-add-students-search-demo-desktop.png', 'teacher add students search demo desktop', {
    action: 'search:demo',
    expected: 'candidate result should explain current class binding and impact before adding',
  });
  await clickRole(teacherDesktop.page, 'button', /^Excel导入$/);
  await capture(teacherDesktop.page, '05-teacher-add-students-import-default-desktop.png', 'teacher add students import default desktop', {
    expected: 'Excel import tab should expose required schema, template, preview, and impact controls',
  });
  await setImportFile(teacherDesktop.page, fixtures.invalidStudent);
  await capture(teacherDesktop.page, '06-teacher-add-students-import-file-selected-desktop.png', 'teacher add students import file selected desktop', {
    fixture: path.relative(root, fixtures.invalidStudent),
    expected: 'selected file state should show row count, validation preview, and undo/change affordance',
  });
  await clickRole(teacherDesktop.page, 'button', /开始导入/);
  await capture(teacherDesktop.page, '07-teacher-add-students-import-invalid-result-desktop.png', 'teacher add students import invalid result desktop', {
    fixture: path.relative(root, fixtures.invalidStudent),
    expected: 'invalid import should persist failed row details and next recovery actions inline',
  });
  await clickRole(teacherDesktop.page, 'button', /^关闭$/);
  await capture(teacherDesktop.page, '08-teacher-class-after-add-modal-close-desktop.png', 'teacher class after add modal close desktop', {
    expected: 'after closing member modal, teacher should see whether any roster data changed',
  });
  await clickRole(teacherDesktop.page, 'button', /^删除$/);
  await capture(teacherDesktop.page, '09-teacher-class-delete-student-confirm-dismissed-desktop.png', 'teacher class delete student confirm dismissed desktop', {
    expected: 'remove student should explain evidence, classroom history, and report impact before confirmation',
  });
  await teacherDesktop.context.close();

  const teacherMobile = await newPage(mobile, 'teacher', 'dismiss');
  await gotoStable(teacherMobile.page, `/teacher/classes/${classId}`, 4200);
  await waitForTextGone(teacherMobile.page, '加载班级详情');
  await capture(teacherMobile.page, '10-teacher-class-detail-roster-mobile.png', 'teacher class detail roster mobile', {
    classId,
    expected: 'mobile class detail should keep class code, roster, and evidence status readable without horizontal loss',
  });
  await clickRole(teacherMobile.page, 'button', /添加学生/);
  await capture(teacherMobile.page, '11-teacher-add-students-modal-mobile.png', 'teacher add students modal mobile', {
    expected: 'mobile add-students modal should keep close, tabs, search field, and action buttons visible',
  });
  await clickRole(teacherMobile.page, 'button', /^Excel导入$/);
  await capture(teacherMobile.page, '12-teacher-add-students-import-mobile.png', 'teacher add students import mobile', {
    expected: 'mobile import should not bury schema, file chooser, and close action in a cramped panel',
  });
  await teacherMobile.context.close();

  const studentDesktop = await newPage(desktop, 'teacher', 'dismiss');
  await gotoStable(studentDesktop.page, `/teacher/classes/${classId}/students/${studentId}`, 4200);
  await waitForTextGone(studentDesktop.page, '加载学生画像');
  await capture(studentDesktop.page, '13-teacher-student-insights-desktop.png', 'teacher student insights desktop', {
    classId,
    studentId,
    expected: 'student detail should convert evidence governance into teacher action and explain confidence',
  });
  await clickRole(studentDesktop.page, 'link', /查看完整证据/);
  await capture(studentDesktop.page, '14-teacher-student-evidence-desktop.png', 'teacher student evidence desktop', {
    classId,
    studentId,
    expected: 'teacher evidence drawer should support evidence source tracing, filtering, and export/report handoff',
  });
  await studentDesktop.context.close();

  const studentMobile = await newPage(mobile, 'teacher', 'dismiss');
  await gotoStable(studentMobile.page, `/teacher/classes/${classId}/students/${studentId}`, 4200);
  await waitForTextGone(studentMobile.page, '加载学生画像');
  await capture(studentMobile.page, '15-teacher-student-insights-mobile.png', 'teacher student insights mobile', {
    classId,
    studentId,
    expected: 'mobile student insight should expose risk, evidence confidence, and next intervention without long-scroll ambiguity',
  });
  await gotoStable(studentMobile.page, `/teacher/classes/${classId}/students/${studentId}/evidence`, 4200);
  await capture(studentMobile.page, '16-teacher-student-evidence-mobile.png', 'teacher student evidence mobile', {
    classId,
    studentId,
    expected: 'mobile evidence page should keep filters, source labels, and back path visible',
  });
  await studentMobile.context.close();

  await browser.close();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    classId,
    classCode,
    studentId,
    fixtureDir: path.relative(root, fixtureDir),
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
    classId,
    classCode,
    studentId,
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
