import { chromium } from 'playwright';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/path-execution-409-error-995');
const baseUrl = process.env.ADAPTIVE_PATH_QA_BASE_URL ?? 'http://localhost:3000';

const commitHash = process.env.CAPTURE_COMMIT ?? 'HEAD';

function sha256File(relativePath) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

async function setTheme(page, theme) {
  await page.addInitScript((nextTheme) => {
    window.localStorage.setItem('ai-obe-theme', nextTheme);
    window.localStorage.setItem('act:app-shell-navigation-preference', 'expanded');
  }, theme);
}

const states = [
  {
    name: 'path-execution-409-desktop',
    width: 1280,
    height: 900,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    theme: 'light',
  },
  {
    name: 'path-execution-409-mobile',
    width: 320,
    height: 812,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    theme: 'dark',
  },
];

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const captures = [];

  try {
    for (const state of states) {
      const page = await browser.newPage({ viewport: { width: state.width, height: state.height } });
      await setTheme(page, state.theme);
      await page.goto(`${baseUrl}/assessment/adaptive-practice${state.query}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      // Give client-side React time to hydrate
      await page.waitForTimeout(5000);
      // Expand the current-path module if collapsed
      await page.evaluate(() => {
        const pathModule = document.querySelector('[data-adaptive-path-module-id="current-path"]');
        if (pathModule) {
          const toggle = pathModule.querySelector('button[aria-expanded]');
          if (toggle && toggle.getAttribute('aria-expanded') === 'false') toggle.click();
        }
      });
      // Capture screenshot after module expansion
      await page.waitForTimeout(1000);

      const relativePath = `artifacts/commercial-ui/path-execution-409-error-995/${state.name}.png`;
      const absolutePath = path.join(repoRoot, relativePath);
      await page.screenshot({ path: absolutePath, fullPage: true });

      const signals = await page.evaluate(() => ({
        pageTitle: document.title,
        mainHeading: document.querySelector('h1')?.textContent?.trim() ?? '(none)',
        executionError: document.querySelector('[data-adaptive-path-execution-error="visible"]') !== null,
        executionSurface: document.querySelector('[data-adaptive-path-execution-surface="active-route"]') !== null,
        nodeActions: document.querySelectorAll('[data-adaptive-path-node-actions="attached"]').length,
        pathNodeCount: document.querySelectorAll('[data-adaptive-path-node]').length,
        demoHeading: document.body.innerText.includes('演示') || document.body.innerText.includes('Demo'),
        practiceError: document.querySelector('[data-adaptive-practice-error-state="recoverable"]') !== null,
        bodyWidth: document.body.getBoundingClientRect().width,
        scrollWidth: document.documentElement.scrollWidth,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
      }));

      captures.push({
        name: state.name,
        width: state.width,
        theme: state.theme,
        file: relativePath,
        sha256: sha256File(relativePath),
        signals,
      });

      await page.close();
    }
  } finally {
    await browser.close();
  }

  writeFileSync(
    path.join(outputDir, 'capture-manifest.json'),
    JSON.stringify({
      capturedAt: new Date().toISOString(),
      commit: commitHash,
      baseUrl,
      captures,
    }, null, 2) + '\n'
  );

  console.log(`Captured ${captures.length} states. See ${outputDir}/capture-manifest.json`);
}

main().catch((err) => { console.error(err); process.exit(1); });
