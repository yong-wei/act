import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/path-execution-409-error-995');
const baseUrl = process.env.ADAPTIVE_PATH_QA_BASE_URL ?? 'http://localhost:3000';

const commitHash = process.env.CAPTURE_COMMIT ?? 'HEAD';

function sha256File(relativePath) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

const states = [
  {
    name: 'path-execution-409-desktop',
    width: 1280,
    height: 900,
    query: '?goal=control-correction',
    theme: 'light',
  },
  {
    name: 'path-execution-409-mobile',
    width: 320,
    height: 812,
    query: '?goal=control-correction',
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
      await page.goto(`${baseUrl}/assessment/adaptive-practice${state.query}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      // Wait for the page to settle — demo fixture or error state
      await page.waitForTimeout(3000);

      const relativePath = `artifacts/commercial-ui/path-execution-409-error-995/${state.name}.png`;
      const absolutePath = path.join(repoRoot, relativePath);
      await page.screenshot({ path: absolutePath, fullPage: true });

      const signals = await page.evaluate(() => ({
        executionError: document.querySelector('[data-adaptive-path-execution-error="visible"]') !== null,
        executionSurface: document.querySelector('[data-adaptive-path-execution-surface="active-route"]') !== null,
        nodeActions: document.querySelectorAll('[data-adaptive-path-node-actions="attached"]').length,
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
