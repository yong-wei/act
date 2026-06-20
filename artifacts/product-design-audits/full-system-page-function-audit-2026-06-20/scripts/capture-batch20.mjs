import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/55-function-state-flows-batch20');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch20-manifest.json');
const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 1100 };

const validReviewSessionId = 'cmplw3180000kuhvl8qzopj5j';
const unboundReviewSessionId = 'cmqea1d3n001euwyfoi7b6pru';
const validClassId = 'cmma7g0590004g9q2nl2jyzdf';
const evidenceLessonId = 'unit-4-1-design-task-expression';

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
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
      buttons: buttons.slice(0, 180),
      inputs,
      tables,
      unnamedButtons: buttons.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 4200),
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
      links: audit.buttons.filter((item) => item.tag === 'a').slice(0, 20),
      unnamedButtons: audit.unnamedButtons,
      tableCount: audit.tables.length,
      tables: audit.tables,
      graphicsCount: audit.graphicsCount,
      unnamedGraphics: audit.unnamedGraphics,
      hits: {
        review: body.includes('课堂复盘'),
        export: body.includes('导出') || body.includes('下载'),
        classDetail: body.includes('返回班级详情'),
        reviewHub: body.includes('评审聚合入口'),
        evidence: body.includes('课堂作答') || body.includes('学习证据'),
        empty: body.includes('暂无') || body.includes('未绑定班级'),
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

async function optionalClickRole(page, role, name, options = {}) {
  const locator = page.getByRole(role, { name });
  if (await locator.count()) {
    await locator.first().click(options).catch((error) => errors.push({ action: `click optional ${String(name)}`, message: error.message, url: page.url() }));
    await sleep(options.waitMs ?? 1400);
    return `${role}:${String(name)}`;
  }
  return 'missing';
}

async function fillFirstVisible(page, selector, value) {
  const locator = page.locator(selector).filter({ visible: true });
  if (await locator.count()) {
    await locator.first().fill(value);
    await sleep(1800);
    return true;
  }
  errors.push({ action: `fill ${selector}`, message: 'visible locator not found', url: page.url() });
  return false;
}

async function selectByLabelText(page, labelText, value) {
  const labels = await page.locator('label').all();
  for (const label of labels) {
    const text = (await label.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (!text.includes(labelText)) continue;
    const select = label.locator('select');
    if (await select.count()) {
      await select.first().selectOption(value).catch((error) => errors.push({ action: `select ${labelText}`, message: error.message, url: page.url() }));
      await sleep(1700);
      return true;
    }
  }
  errors.push({ action: `select ${labelText}`, message: 'label/select not found', url: page.url() });
  return false;
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
      if (dialogMode === 'accept') await dialog.accept().catch(() => {});
      else await dialog.dismiss().catch(() => {});
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

  const teacherMobile = await newPage(mobile, 'teacher', 'dismiss');
  await gotoStable(teacherMobile.page, '/teacher/history', 3200);
  await waitForTextGone(teacherMobile.page, '加载课堂历史');
  await capture(teacherMobile.page, '01-teacher-history-mobile.png', 'teacher history mobile', {
    expected: 'teacher should identify finished classes, class archive state, and post-class report entry',
  });

  await fillFirstVisible(teacherMobile.page, 'input[placeholder*="搜索教案"]', '5-3');
  await capture(teacherMobile.page, '02-teacher-history-search-53-mobile.png', 'teacher history search 5-3 mobile', {
    action: 'search:5-3',
    expected: 'search result should make the target finished class easy to isolate',
  });

  const editAction = await clickRole(teacherMobile.page, 'button', /^编辑$/);
  await capture(teacherMobile.page, '03-teacher-history-archive-edit-mobile.png', 'teacher history archive edit mobile', {
    action: editAction,
    expected: 'archive edit should explain impact and current class before saving',
  });

  const deleteAction = await clickRole(teacherMobile.page, 'button', /^删除课堂$/);
  await capture(teacherMobile.page, '04-teacher-history-delete-dismissed-mobile.png', 'teacher history delete dismissed mobile', {
    action: deleteAction,
    expected: 'delete should show impact range without relying only on a native confirm',
  });

  await gotoStable(teacherMobile.page, `/classroom/teacher/${validReviewSessionId}/review`, 4200);
  await capture(teacherMobile.page, '05-teacher-valid-review-mobile.png', 'teacher valid review mobile', {
    sessionId: validReviewSessionId,
    expected: 'post-class review should turn submitted evidence into next teaching actions',
  });

  const reviewHubAction = await clickRole(teacherMobile.page, 'link', /前往评审聚合入口/);
  await capture(teacherMobile.page, '06-teacher-review-hub-exit-mobile.png', 'teacher review hub exit mobile', {
    action: reviewHubAction,
    expected: 'review exit should preserve teacher post-class context instead of jumping to internal review surfaces',
  });
  await teacherMobile.context.close();

  const teacherDesktop = await newPage(desktop, 'teacher', 'dismiss');
  await gotoStable(teacherDesktop.page, `/classroom/teacher/${validReviewSessionId}/review`, 4200);
  await capture(teacherDesktop.page, '07-teacher-valid-review-desktop.png', 'teacher valid review desktop', {
    sessionId: validReviewSessionId,
    expected: 'desktop review should expose export/share/report actions near evidence summaries',
  });

  const classDetailAction = await clickRole(teacherDesktop.page, 'link', /返回班级详情/);
  await capture(teacherDesktop.page, '08-teacher-review-return-class-detail-desktop.png', 'teacher review return class detail desktop', {
    action: classDetailAction,
    classId: validClassId,
    expected: 'return target should help continue class-level review, not lose the report context',
  });

  await gotoStable(teacherDesktop.page, `/classroom/teacher/${unboundReviewSessionId}/review`, 3200);
  await capture(teacherDesktop.page, '09-teacher-unbound-review-blocked-desktop.png', 'teacher unbound review blocked desktop', {
    sessionId: unboundReviewSessionId,
    expected: 'unbound finished session should explain how to archive it before review',
  });
  await teacherDesktop.context.close();

  const studentMobile = await newPage(mobile, 'student', 'dismiss');
  await gotoStable(studentMobile.page, '/profile/evidence', 4200);
  await waitForTextGone(studentMobile.page, '加载中');
  await capture(studentMobile.page, '10-student-evidence-default-mobile.png', 'student evidence default mobile', {
    expected: 'student should see recent learning evidence before applying filters',
  });

  await selectByLabelText(studentMobile.page, '事实类型', 'question');
  await capture(studentMobile.page, '11-student-evidence-default-question-filter-mobile.png', 'student evidence default question filter mobile', {
    action: 'factType=question',
    expected: 'question filter should keep evidence visible and announce filtered result count',
  });

  const defaultNextAction = await optionalClickRole(studentMobile.page, 'link', /复盘课堂作答|查看|继续|回顾/);
  await capture(studentMobile.page, '12-student-evidence-default-next-action-mobile.png', 'student evidence default next action mobile', {
    action: defaultNextAction,
    expected: 'evidence next action should lead to a meaningful review or remediation path',
  });

  await gotoStable(studentMobile.page, `/profile/evidence?lessonId=${evidenceLessonId}`, 4200);
  await waitForTextGone(studentMobile.page, '加载中');
  await capture(studentMobile.page, '13-student-evidence-lesson-filter-mobile.png', 'student evidence lesson filter mobile', {
    lessonId: evidenceLessonId,
    expected: 'student should see evidence produced by the classroom session and understand source quality',
  });

  const refreshEvidenceAction = await optionalClickRole(studentMobile.page, 'button', /^刷新$/);
  await capture(studentMobile.page, '14-student-evidence-refresh-mobile.png', 'student evidence refresh mobile', {
    action: refreshEvidenceAction,
    expected: 'evidence refresh should show started/completed/failed status',
  });

  await selectByLabelText(studentMobile.page, '事实类型', 'question');
  await capture(studentMobile.page, '15-student-evidence-question-filter-mobile.png', 'student evidence question filter mobile', {
    action: 'factType=question',
    expected: 'question filter should announce filtered result count and preserve lesson context',
  });

  const nextAction = await optionalClickRole(studentMobile.page, 'link', /复盘课堂作答|查看|继续|回顾/);
  await capture(studentMobile.page, '16-student-evidence-next-action-mobile.png', 'student evidence next action mobile', {
    action: nextAction,
    expected: 'evidence next action should lead to a meaningful review or remediation path',
  });

  await gotoStable(studentMobile.page, '/profile/evidence?lessonId=no-such-lesson-audit', 3200);
  await waitForTextGone(studentMobile.page, '加载中');
  await capture(studentMobile.page, '17-student-evidence-empty-filter-mobile.png', 'student evidence empty filter mobile', {
    action: 'lessonId=no-such-lesson-audit',
    expected: 'empty filter should explain the active condition and provide recovery with live/status semantics',
  });
  await studentMobile.context.close();

  await browser.close();

  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 20,
    validReviewSessionId,
    unboundReviewSessionId,
    evidenceLessonId,
    screenshotCount: results.length,
    downloads,
    dialogs,
    errors,
    results,
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({
    screenshotDir: path.relative(process.cwd(), screenshotDir),
    manifestPath: path.relative(process.cwd(), manifestPath),
    screenshotCount: results.length,
    dialogs,
    downloads,
    errors,
  }, null, 2));
}

main().catch(async (error) => {
  errors.push({ action: 'fatal', message: error.message, stack: error.stack });
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 20,
    validReviewSessionId,
    unboundReviewSessionId,
    evidenceLessonId,
    screenshotCount: results.length,
    downloads,
    dialogs,
    errors,
    results,
  }, null, 2));
  console.error(error);
  process.exit(1);
});
