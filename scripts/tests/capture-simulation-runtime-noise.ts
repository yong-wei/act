import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium, type ConsoleMessage, type Page } from 'playwright';

const repoRoot = path.resolve(__dirname, '../..');
const baseUrl = process.env.SIMULATION_RUNTIME_NOISE_BASE_URL ?? 'http://localhost:3002';
const outputDir = path.resolve(
  repoRoot,
  process.env.SIMULATION_RUNTIME_NOISE_OUTPUT_DIR ?? 'artifacts/commercial-ui/simulation-runtime-noise-536',
);
const routes = [
  '/simulations/destroyer',
  '/simulations/lng',
  '/simulations/container',
  '/simulations/drilling',
  '/simulations/cruise',
  '/simulations/icebreaker',
  '/simulations/dredger',
] as const;
const viewport = { width: 1440, height: 1000 };
const theme = 'dark' as const;
const trackedConsoleWarningPatterns = [
  /THREE\.Clock: This module has been deprecated/i,
  /THREE\.WebGLShadowMap: PCFSoftShadowMap has been deprecated/i,
  /PCFSoftShadowMap has been deprecated/i,
] as const;

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

function relativeArtifactPath(absolutePath: string) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function trackedConsoleWarning(message: ConsoleMessage) {
  const text = message.text();
  if (!trackedConsoleWarningPatterns.some((pattern) => pattern.test(text))) return null;
  return {
    type: message.type(),
    text,
    location: message.location(),
  };
}

async function prepareTheme(page: Page) {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('ai-obe-theme', selectedTheme);
  }, theme);
}

async function captureRoute(browser: Awaited<ReturnType<typeof chromium.launch>>, route: string) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await prepareTheme(page);

  const pageErrors: Array<{ message: string; stack?: string }> = [];
  const trackedConsoleWarnings: Array<NonNullable<ReturnType<typeof trackedConsoleWarning>>> = [];

  page.on('pageerror', (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack,
    });
  });
  page.on('console', (message) => {
    const warning = trackedConsoleWarning(message);
    if (warning) trackedConsoleWarnings.push(warning);
  });

  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('[data-commercial-workspace="simulation-scene"]', { timeout: 30_000 });
  await page.waitForTimeout(5_000);

  const filename = `${route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-${theme}-${viewport.width}.png`;
  const screenshotPath = path.join(outputDir, filename);
  const screenshot = await page.screenshot({ path: screenshotPath, fullPage: false });
  const themeState = await page.evaluate(() => ({
    className: document.documentElement.className,
    colorScheme: document.documentElement.style.colorScheme,
    storedTheme: localStorage.getItem('ai-obe-theme'),
  }));

  await context.close();

  return {
    route,
    theme,
    viewport,
    screenshotPath: relativeArtifactPath(screenshotPath),
    screenshotSha256: sha256(screenshot),
    pageErrors,
    trackedConsoleWarnings,
    themeState,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    mkdirSync(outputDir, { recursive: true });
    const results = [];
    for (const route of routes) {
      results.push(await captureRoute(browser, route));
    }

    const pageErrors = results.flatMap((result) => result.pageErrors.map((error) => ({
      route: result.route,
      ...error,
    })));
    const trackedConsoleWarnings = results.flatMap((result) => result.trackedConsoleWarnings.map((warning) => ({
      route: result.route,
      ...warning,
    })));
    const report = {
      capturedAt: new Date().toISOString(),
      baseUrl,
      routes: [...routes],
      results,
      summary: {
        routesChecked: results.length,
        pageErrorCount: pageErrors.length,
        trackedConsoleWarningCount: trackedConsoleWarnings.length,
        pageErrors,
        trackedConsoleWarnings,
        passed: pageErrors.length === 0 && trackedConsoleWarnings.length === 0,
      },
    };
    const reportPath = path.join(outputDir, 'runtime-noise.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({
      report: relativeArtifactPath(reportPath),
      reportSha256: sha256(JSON.stringify(report, null, 2) + '\n'),
      routesChecked: report.summary.routesChecked,
      pageErrorCount: report.summary.pageErrorCount,
      trackedConsoleWarningCount: report.summary.trackedConsoleWarningCount,
    }, null, 2));
    if (!report.summary.passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
