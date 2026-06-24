import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/58-function-state-flows-batch23');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch23-manifest.json');
const populatedLessonPlanId = 'cmqeakmuy0024cnyf1z2ttquo';
const populatedLessonTitle = '4-1：设计起点：性能指标体系、工程约束与可行域表达 (副本)';
const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 1100 };

const accounts = {
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
};

const results = [];
const downloads = [];
const dialogs = [];
const errors = [];
const fallbackClicks = [];
let createdSessionId = null;
let createdJoinCode = null;

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
      buttons: buttons.slice(0, 240),
      inputs,
      tables,
      unnamedButtons: buttons.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 5600),
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
        lessonPlanList: body.includes('我的教案') || body.includes('开始上课'),
        teacherRuntime: body.includes('在线') && body.includes('课堂码'),
        directStart: body.includes('课堂码') && !body.includes('班级'),
        dataDashboard: body.includes('数据大屏') || body.includes('学生状态'),
        review: body.includes('课后分析') || body.includes('未绑定班级') || body.includes('课堂复盘'),
        history: body.includes('上课历史') || body.includes('课堂历史'),
        ended: body.includes('FINISHED') || body.includes('已结束') || body.includes('未绑定班级'),
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
  const jsClick = await page.evaluate(({ source, flags }) => {
    const matcher = new RegExp(source, flags);
    const elements = [...document.querySelectorAll('button, a, [role="button"]')];
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
    };
    const label = (el) => [
      el.getAttribute('aria-label') || '',
      el.getAttribute('title') || '',
      el.innerText || '',
      el.textContent || '',
    ].join(' ').replace(/\s+/g, ' ').trim();
    const target = elements.find((el) => isVisible(el) && matcher.test(label(el)));
    if (!target) return null;
    target.click();
    return { tag: target.tagName.toLowerCase(), label: label(target).slice(0, 120) };
  }, typeof name === 'string' ? { source: name, flags: '' } : { source: name.source, flags: name.flags });
  if (jsClick) {
    fallbackClicks.push({ role, name: String(name), mode: 'js-visible-text-click', target: jsClick, url: page.url() });
    await sleep(options.waitMs ?? 1300);
    return `js:${String(name)}`;
  }
  errors.push({ action: `click ${role}:${String(name)}`, message: 'locator not found', url: page.url() });
  return 'not-found';
}

async function createSessionFromPage(page) {
  const response = await page.evaluate(async (planId) => {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  }, populatedLessonPlanId);
  if (!response.ok) {
    errors.push({ action: 'create session', message: JSON.stringify(response), url: page.url() });
    throw new Error(`create session failed ${response.status}`);
  }
  createdSessionId = response.body.id;
  createdJoinCode = response.body.joinCode;
  return response.body;
}

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
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
      if (dialogMode === 'accept') {
        await dialog.accept().catch(() => {});
      } else {
        await dialog.dismiss().catch(() => {});
      }
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

  const teacherDesktop = await newPage(desktop, 'teacher', 'dismiss');
  await gotoStable(teacherDesktop.page, '/teacher/lesson-plans', 3600);
  await capture(teacherDesktop.page, '01-teacher-lesson-plan-start-entry-desktop.png', 'teacher lesson plan start entry desktop', {
    expected: 'teacher should understand class binding, active session conflicts, and launch impact before starting class',
    planId: populatedLessonPlanId,
  });

  const session = await createSessionFromPage(teacherDesktop.page);
  await gotoStable(teacherDesktop.page, `/classroom/teacher/${session.id}`, 4600);
  await capture(teacherDesktop.page, '02-teacher-direct-start-runtime-desktop.png', 'teacher direct-start runtime desktop', {
    expected: 'new direct-start class should expose join code, class binding status, online count, and first teaching item',
    createdSessionId,
    createdJoinCode,
    classId: session.classId ?? null,
  });

  const teacherMobile = await newPage(mobile, 'teacher', 'dismiss');
  await gotoStable(teacherMobile.page, `/classroom/teacher/${session.id}`, 4200);
  await capture(teacherMobile.page, '03-teacher-direct-start-runtime-mobile.png', 'teacher direct-start runtime mobile', {
    expected: 'mobile teacher runtime should keep current item, join code, navigation, and end action usable without overlap',
    createdSessionId,
    createdJoinCode,
  });

  await clickRole(teacherDesktop.page, 'button', /二维码/);
  await capture(teacherDesktop.page, '04-teacher-direct-start-qr-dialog-desktop.png', 'teacher direct-start QR dialog desktop', {
    expected: 'QR dialog should make join code, copy feedback, and class/session identity clear',
    createdSessionId,
    createdJoinCode,
  });
  await teacherDesktop.page.keyboard.press('Escape');
  await sleep(1000);

  await clickRole(teacherDesktop.page, 'button', /当前在线学生/);
  await capture(teacherDesktop.page, '05-teacher-direct-start-online-students-desktop.png', 'teacher direct-start online students desktop', {
    expected: 'online students panel should explain zero online, class binding, and what teacher can do before students join',
    createdSessionId,
    createdJoinCode,
  });
  await teacherDesktop.page.keyboard.press('Escape');
  await sleep(1000);

  await clickRole(teacherDesktop.page, 'button', /下一页/);
  await capture(teacherDesktop.page, '06-teacher-direct-start-next-item-desktop.png', 'teacher direct-start next item desktop', {
    expected: 'teacher should receive a visible sync/progress status after moving to next item',
    createdSessionId,
  });

  await clickRole(teacherDesktop.page, 'button', /结束课堂/);
  await capture(teacherDesktop.page, '07-teacher-direct-start-end-confirm-dismissed-desktop.png', 'teacher direct-start end confirm dismissed desktop', {
    expected: 'end-class confirm should explain students, evidence, reports, and recovery impact; this first attempt is dismissed',
    createdSessionId,
    dialogMessages: dialogs.map((item) => item.message),
  });

  const endContext = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, locale: 'zh-CN' });
  const endPage = await endContext.newPage();
  endPage.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message(), url: endPage.url(), mode: 'accept' });
    await dialog.accept().catch(() => {});
  });
  await login(endPage, 'teacher');
  await gotoStable(endPage, `/classroom/teacher/${session.id}`, 3000);
  await clickRole(endPage, 'button', /结束课堂/);
  await sleep(2600);
  await capture(endPage, '08-teacher-direct-start-ended-redirect-desktop.png', 'teacher direct-start ended redirect desktop', {
    expected: 'after ending a direct-start class, teacher should land on a clear success state with review/history paths',
    createdSessionId,
    createdJoinCode,
  });

  await gotoStable(endPage, '/teacher/history', 4200);
  await capture(endPage, '09-teacher-history-after-direct-start-end-desktop.png', 'teacher history after direct-start end desktop', {
    expected: 'history should make recently ended direct-start class discoverable and explain missing class binding',
    createdSessionId,
    createdJoinCode,
  });

  await gotoStable(endPage, `/classroom/teacher/${session.id}/review`, 4200);
  await capture(endPage, '10-teacher-review-after-direct-start-end-desktop.png', 'teacher review after direct-start end desktop', {
    expected: 'post-class review should handle direct-start unbound sessions with recovery or binding actions',
    createdSessionId,
    createdJoinCode,
  });

  const finalSessionState = await endPage.evaluate(async (sessionId) => {
    const res = await fetch(`/api/session/${sessionId}`, { headers: { accept: 'application/json' } });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  }, session.id);

  await browser.close();
  await fs.writeFile(manifestPath, JSON.stringify({
    baseUrl,
    generatedAt: new Date().toISOString(),
    populatedLessonPlanId,
    populatedLessonTitle,
    createdSessionId,
    createdJoinCode,
    finalSessionState: {
      ok: finalSessionState.ok,
      status: finalSessionState.status,
      classId: finalSessionState.body?.classId ?? null,
      sessionStatus: finalSessionState.body?.status ?? null,
      planTitle: finalSessionState.body?.planTitle ?? finalSessionState.body?.plan?.title ?? null,
    },
    screenshots: results.map((item) => item.screenshot),
    results,
    dialogs,
    downloads,
    fallbackClicks,
    errors,
  }, null, 2));

  console.log(JSON.stringify({
    manifestPath,
    createdSessionId,
    createdJoinCode,
    finalSessionStatus: finalSessionState.body?.status ?? null,
    screenshots: results.length,
    dialogs: dialogs.length,
    downloads: downloads.length,
    fallbackClicks: fallbackClicks.length,
    errors,
  }, null, 2));

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
