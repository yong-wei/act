import { chromium } from 'playwright';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/path-execution-409-error-995');
const baseUrl = process.env.ADAPTIVE_PATH_QA_BASE_URL ?? 'http://localhost:3000';
const commitHash = (process.env.CAPTURE_COMMIT || execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim());

function sha256File(relativePath) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function assert(condition, message) {
  if (!condition) { console.error('FAIL: ' + message); process.exit(1); }
}

async function setTheme(page, theme) {
  await page.addInitScript((nextTheme) => {
    window.localStorage.setItem('ai-obe-theme', nextTheme);
    window.localStorage.setItem('act:app-shell-navigation-preference', 'expanded');
  }, theme);
}

async function expandCurrentPath(page) {
  await page.evaluate(() => {
    const toggle = document.querySelector('[data-adaptive-path-module-id="current-path"] button[aria-expanded]');
    if (toggle && toggle.getAttribute('aria-expanded') === 'false') toggle.click();
  });
  await page.waitForTimeout(1000);
}

async function clickStartLearning(page) {
  const btn = page.locator('[data-adaptive-path-node-actions="attached"] button:has-text("开始学习")');
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  await btn.click();
}

async function clickRefresh(page) {
  const btn = page.locator('[data-adaptive-path-execution-error="visible"] button:has-text("刷新路径状态")');
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(2000);
}

async function captureAndSignal(page, name) {
  const relativePath = 'artifacts/commercial-ui/path-execution-409-error-995/' + name + '.png';
  const absolutePath = path.join(repoRoot, relativePath);
  await page.screenshot({ path: absolutePath, fullPage: true });
  const signals = await page.evaluate(() => ({
    executionError: document.querySelector('[data-adaptive-path-execution-error="visible"]') !== null,
    errorText: document.querySelector('[data-adaptive-path-execution-error="visible"]')?.textContent?.trim() ?? null,
    refreshButton: document.querySelector('[data-adaptive-path-execution-error="visible"] button') !== null,
    executionSurface: document.querySelector('[data-adaptive-path-execution-surface="active-route"]') !== null,
    nodeActions: document.querySelectorAll('[data-adaptive-path-node-actions="attached"]').length,
    pathNodeCount: document.querySelectorAll('[data-adaptive-path-node]').length,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  return { name, file: relativePath, sha256: sha256File(relativePath), signals };
}

async function runDesktop() {
  const page = await chromium.launch({ headless: true }).then(b => b.newPage({ viewport: { width: 1280, height: 900 } }));
  await setTheme(page, 'light');
  await page.route('**/api/learning-paths/*/execute', (route) => {
    route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: '执行事件只能写入当前路径节点' }) });
  });
  await page.goto(baseUrl + '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await expandCurrentPath(page);
  await clickStartLearning(page);
  await page.waitForTimeout(1000);
  const c1 = await captureAndSignal(page, 'path-execution-409-desktop');
  assert(c1.signals.executionError, 'desktop: no error container');
  assert(c1.signals.errorText && c1.signals.errorText.includes('执行事件'), 'desktop: missing error reason');
  assert(c1.signals.refreshButton, 'desktop: missing refresh button');
  assert(!c1.signals.overflowX, 'desktop: overflow');
  await page.unroute('**/api/learning-paths/*/execute');
  await clickRefresh(page);
  const c2 = await captureAndSignal(page, 'path-refresh-success');
  assert(!c2.signals.executionError, 'desktop: error not cleared after refresh');
  assert(c2.signals.nodeActions >= 1, 'desktop: node actions hidden after refresh');
  assert(!c2.signals.overflowX, 'desktop: overflow after refresh');
  await page.close();
  return [c1, c2];
}

async function runMobile() {
  const page = await chromium.launch({ headless: true }).then(b => b.newPage({ viewport: { width: 320, height: 812 } }));
  await setTheme(page, 'dark');
  await page.route('**/api/learning-paths/*/execute', (route) => {
    route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: '执行事件只能写入当前路径节点' }) });
  });
  await page.goto(baseUrl + '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await expandCurrentPath(page);
  await clickStartLearning(page);
  await page.waitForTimeout(1000);
  const c = await captureAndSignal(page, 'path-execution-409-mobile');
  assert(c.signals.executionError, 'mobile: no error container');
  assert(c.signals.errorText && c.signals.errorText.includes('执行事件'), 'mobile: missing error reason');
  assert(c.signals.refreshButton, 'mobile: missing refresh button');
  assert(!c.signals.overflowX, 'mobile: overflow');
  await page.close();
  return [c];
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const all = [...await runDesktop(), ...await runMobile()];
  writeFileSync(path.join(outputDir, 'capture-manifest.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    commit: commitHash,
    baseUrl: baseUrl,
    captures: all,
  }, null, 2) + '\n');
  console.log('OK: captured ' + all.length + ' states. commit=' + commitHash);
  console.log('All UI assertions passed.');
}

main().catch((err) => { console.error(err); process.exit(1); });
