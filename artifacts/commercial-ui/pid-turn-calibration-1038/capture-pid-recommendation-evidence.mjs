import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  createPidRecommendationEvidenceStorageState,
  PID_RECOMMENDATION_EVIDENCE_USER_ID,
} from './pid-recommendation-evidence-session.mjs';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const baseUrl = process.env.PID_EVIDENCE_BASE_URL ?? 'http://localhost:3012';
const outputDirectory = currentDirectory;
const route = '/evidence-pid';
const viewports = [
  { width: 1440, height: 1000, name: '1440' },
  { width: 320, height: 900, name: '320' },
];

await mkdir(outputDirectory, { recursive: true });

// --- Pre-capture git state (fail-closed BEFORE browser launch) ---
const repoRoot = join(currentDirectory, '..', '..', '..');
let preCaptureHead;
let preCaptureClean;
try {
  preCaptureHead = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  const statusOutput = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8' }).trim();
  preCaptureClean = statusOutput.length === 0;
  console.log(`[evidence] Pre-capture HEAD: ${preCaptureHead}`);
  console.log(`[evidence] Pre-capture workspace clean: ${preCaptureClean}`);
} catch (err) {
  console.error('[evidence] Failed to read git state before capture:', err.message);
  process.exit(1);
}

// Fail-closed: workspace MUST be clean before starting capture
assert.equal(preCaptureClean, true, 'Workspace is dirty before capture — clean the working tree first');

const browser = await chromium.launch({ headless: true });
const captures = [];
const storageState = await createPidRecommendationEvidenceStorageState({ baseUrl });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, storageState });
    const page = await context.newPage();
    const consoleErrors = [];
    let requestBody;
    let responseBody;

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    // Intercept request body but let browser call real /api/simulation/optimize
    await page.route('**/api/simulation/optimize', async (routeRequest) => {
      requestBody = routeRequest.request().postDataJSON();
      await routeRequest.continue();
    });

    // Capture real API response
    page.on('response', async (response) => {
      if (response.url().includes('/api/simulation/optimize') && response.status() === 200) {
        try {
          responseBody = await response.json();
        } catch { /* non-JSON response */ }
      }
    });

    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '智能推荐' }).click();

    // Wait for recommendation result rendering
    await page.locator('text=/得分/').first().waitFor({ timeout: 60000 });

    assert.ok(requestBody, 'Browser did not send /api/simulation/optimize request');
    assert.equal(requestBody.target.targetHeading, 90, 'targetHeading should be 90');
    assert.equal(requestBody.target.maxRudderRate, 5, 'maxRudderRate should be 5');
    assert.ok(responseBody, 'No real /api/simulation/optimize response');
    assert.equal(responseBody.success, true, 'API response success should be true');

    const metrics = await page.evaluate(() => ({
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      panelVisible: Boolean([...document.querySelectorAll('h3')].find((node) => node.textContent === 'AI 参数推荐')),
      scoreVisible: document.body.textContent?.includes('得分') ?? false,
    }));
    assert.equal(metrics.documentScrollWidth <= metrics.viewportWidth, true, 'Page has horizontal overflow');
    assert.equal(metrics.panelVisible, true, 'Production PID recommendation panel not rendered');
    assert.equal(metrics.scoreVisible, true, 'Recommendation score not displayed');
    assert.deepEqual(consoleErrors, [], 'Browser console errors detected');

    const screenshot = `pid-recommendation-${viewport.name}.png`;
    const metricsFile = `pid-recommendation-${viewport.name}-metrics.json`;
    await page.screenshot({ path: join(outputDirectory, screenshot), fullPage: true });
    await writeFile(join(outputDirectory, metricsFile), `${JSON.stringify({
      route,
      viewport,
      requestBody,
      result: responseBody,
      consoleErrors,
      ...metrics,
    }, null, 2)}\n`);
    captures.push({
      viewport: viewport.width,
      screenshot: `artifacts/commercial-ui/pid-turn-calibration-1038/${screenshot}`,
      metrics: `artifacts/commercial-ui/pid-turn-calibration-1038/${metricsFile}`,
      request: requestBody,
      result: 'passed',
    });
    await context.close();
  }
} finally {
  await browser.close();
}

// --- Post-capture: verify HEAD unchanged (NOT workspace clean, evidence files changed it) ---
let postCaptureHead;
try {
  postCaptureHead = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  console.log(`[evidence] Post-capture HEAD: ${postCaptureHead}`);
} catch (err) {
  console.error('[evidence] Failed to read post-capture HEAD:', err.message);
  process.exit(1);
}

// Fail-closed: HEAD must not have changed during capture
assert.equal(postCaptureHead, preCaptureHead, 'HEAD changed during capture — aborting evidence');
console.log('[evidence] HEAD unchanged, evidence captured successfully');

await writeFile(join(outputDirectory, 'browser-evidence.json'), `${JSON.stringify({
  change: 'calibrate-pid-turn-scenario',
  headCommit: postCaptureHead,
  workspaceClean: preCaptureClean,
  capturedAt: new Date().toISOString(),
  server: baseUrl,
  browser: 'Playwright Chromium',
  evidenceMode: 'COMMERCIAL_UI_EVIDENCE=1',
  authentication: {
    mechanism: 'NextAuth JWT test fixture',
    userId: PID_RECOMMENDATION_EVIDENCE_USER_ID,
    storageState: 'in-memory only; token omitted from evidence',
  },
  route: {
    productionSurface: 'src/resources/simulations/ai-recommend-panel.tsx',
    testHarnessRoute: route,
  },
  assertions: [
    'Browser request uses targetHeading=90 and maxRudderRate=5.',
    'Real /api/simulation/optimize returns success=true and panel shows score.',
    '1440px and 320px viewports have no horizontal overflow or console errors.',
  ],
  limitations: [
    'Test route renders production AIRecommendPanel; optimize endpoint handled by real /api/simulation/optimize (requires Docker for WASM runtime).',
    'Algorithm correctness covered by PID unit and Rust tests; browser evidence validates integration reachability and UI rendering.',
    'Pre-capture workspace was clean (verified by git status --porcelain before browser launch).',
  ],
  captures,
}, null, 2)}\n`);
