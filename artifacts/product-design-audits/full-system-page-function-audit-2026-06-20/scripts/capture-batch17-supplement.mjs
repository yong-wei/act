import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/52-function-state-flows-batch17');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch17-manifest.json');
const mobile = { width: 390, height: 844 };
const sessionId = 'cmqea1d3n001euwyfoi7b6pru';
const joinCode = '129051';
const courseSlug = 'unit-4-1-design-task-expression';

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
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
    const name = (el) => el?.getAttribute?.('aria-label') || el?.getAttribute?.('title') || el?.getAttribute?.('alt') || text(el) || '';
    const active = document.activeElement;
    const buttons = [...document.querySelectorAll('button, [role="button"], a[href]')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      href: el.getAttribute('href') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
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
      },
      alerts: [...document.querySelectorAll('[role="alert"], [aria-live], [role="status"]')]
        .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
        .filter((item) => item.text),
      buttons: buttons.slice(0, 120),
      unnamedButtons: buttons.filter((button) => !button.name).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText: text(document.body).slice(0, 2000),
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

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const browser = await chromium.launch({ headless: true });

  async function newPage(role) {
    const context = await browser.newContext({
      viewport: mobile,
      locale: 'zh-CN',
      acceptDownloads: true,
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseUrl }).catch(() => {});
    const page = await context.newPage();
    await login(page, role);
    return { context, page };
  }

  const student = await newPage('student');
  await student.page.goto(`${baseUrl}/classroom/join?code=${joinCode}`, { waitUntil: 'domcontentloaded' });
  await sleep(2200);
  await student.page.getByRole('button', { name: /加入课堂/ }).last().click().catch(() => {});
  await sleep(2200);
  await capture(student.page, manifest, '17-student-classroom-join-second-step-result-mobile.png', 'student classroom join second-step result mobile', {
    action: 'last button:/加入课堂/',
    expected: 'second step after QR lookup should route into active student runtime',
    joinCode,
    sessionId,
  });
  await student.context.close();

  const teacher = await newPage('teacher');
  await teacher.page.goto(`${baseUrl}/interactive-learning/courses/${courseSlug}/teacher/${sessionId}`, { waitUntil: 'domcontentloaded' });
  await sleep(2400);
  const toolButton = teacher.page.getByRole('button', { name: /本页工具|默认折叠/ });
  if (await toolButton.count()) {
    await toolButton.first().click().catch(() => {});
  } else {
    await teacher.page.getByText('本页工具').first().click().catch(() => {});
  }
  await sleep(1200);
  await capture(teacher.page, manifest, '18-teacher-runtime-local-tools-expanded-mobile.png', 'teacher runtime local tools expanded mobile', {
    action: 'expand local tools',
    expected: 'local tools should reveal classroom code, QR entry, and end-session action',
  });
  const qrButton = teacher.page.getByRole('button', { name: /二维码/ });
  if (await qrButton.count()) {
    await qrButton.first().click().catch(() => {});
  }
  await sleep(1500);
  await capture(teacher.page, manifest, '19-teacher-runtime-local-tools-qr-dialog-mobile.png', 'teacher runtime local tools QR dialog mobile', {
    action: 'button:/二维码/',
    expected: 'QR dialog should expose code, QR image, copy code, and copy link',
  });
  const copyButton = teacher.page.getByRole('button', { name: /复制课堂码/ });
  if (await copyButton.count()) {
    await copyButton.last().click().catch(() => {});
  }
  await sleep(800);
  await capture(teacher.page, manifest, '20-teacher-runtime-local-tools-copy-feedback-mobile.png', 'teacher runtime local tools copy feedback mobile', {
    action: 'button:/复制课堂码/',
    expected: 'copy action should show visible status feedback',
  });
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
