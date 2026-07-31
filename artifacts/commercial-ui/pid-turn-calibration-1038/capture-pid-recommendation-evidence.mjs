import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const baseUrl = process.env.PID_EVIDENCE_BASE_URL ?? 'http://localhost:3012';
const outputDirectory = currentDirectory;
const route = '/evidence-pid';
const viewports = [
  { width: 1440, height: 1000, name: '1440' },
  { width: 320, height: 900, name: '320' },
];

const gitSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const captures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleErrors = [];
    let requestBody;
    let apiResponse = null;
    let apiResponseError = null;

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/simulation/optimize')) {
        try {
          const body = await response.json();
          apiResponse = { status: response.status(), body };
        } catch {
          apiResponseError = `Failed to parse response from ${url}`;
        }
      }
    });

    page.on('request', (request) => {
      if (request.url().includes('/api/simulation/optimize')) {
        requestBody = request.postDataJSON();
      }
    });

    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '智能推荐' }).click();

    try {
      await page.waitForFunction(() => {
        const text = document.body.innerText;
        return text.includes('得分:') || text.includes('优化失败') || text.includes('服务器错误');
      }, { timeout: 30000 });
    } catch {
      // fail-closed: do not continue silently
      assert.fail(`Viewport ${viewport.name}: timeout waiting for recommendation result — no API response received within 30s`);
    }

    const metrics = await page.evaluate(() => ({
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      panelVisible: !!document.querySelector('[class*="recommend"]') || document.body.innerText.includes('得分'),
      adviceVisible: document.body.innerText.includes('AI 建议'),
    }));

    // ── fail-closed assertions ──────────────────────────────────────
    assert.ok(!consoleErrors.length, `Console errors: ${consoleErrors.join(', ')}`);
    assert.equal(metrics.documentScrollWidth, viewport.width, 'No horizontal overflow');
    assert.ok(metrics.panelVisible, 'Recommendation panel is visible');
    assert.ok(metrics.adviceVisible, 'AI advice is visible');

    // API request must have been sent
    assert.ok(requestBody, `Viewport ${viewport.name}: no /api/simulation/optimize request was intercepted`);

    // API response must exist and be HTTP 200
    assert.ok(apiResponse, `Viewport ${viewport.name}: no API response captured`);
    assert.equal(apiResponse.status, 200, `Viewport ${viewport.name}: API returned non-200 status ${apiResponse.status}`);
    assert.ok(!apiResponseError, `Viewport ${viewport.name}: ${apiResponseError}`);

    // Response must contain a score >= 60
    const body = apiResponse.body;
    assert.ok(body && typeof body === 'object', `Viewport ${viewport.name}: API response body is not an object`);
    assert.ok(typeof body.result?.score === 'number', `Viewport ${viewport.name}: response missing numeric score`);
    assert.ok(body.result.score >= 60, `Viewport ${viewport.name}: score ${body.score} < 60`);

    // Request should use v2 calibrated semantics (targetHeading and maxRudderRate)
    assert.ok(
    assert.ok(
      requestBody && requestBody.target?.targetHeading === 90,
      `Viewport : request missing target.targetHeading=90`
    );
    assert.ok(
      requestBody && requestBody.target?.maxRudderRate === 5,
      `Viewport : request missing target.maxRudderRate=5`
    );
    // Screenshot and metrics
    const screenshotFile = `pid-recommendation-${viewport.name}.png`;
    const metricsFile = `pid-recommendation-${viewport.name}-metrics.json`;
    await page.screenshot({ path: join(outputDirectory, screenshotFile), fullPage: true });

    // Compute SHA-256 of screenshot
    const screenshotBytes = await readFile(join(outputDirectory, screenshotFile));
    const screenshotSha256 = createHash('sha256').update(screenshotBytes).digest('hex');

    await writeFile(join(outputDirectory, metricsFile), JSON.stringify({
      route,
      viewport,
      requestBody,
      apiResponse,
      apiResponseError,
      consoleErrors,
      gitSha,
      screenshotSha256,
      ...metrics,
    }, null, 2));

    captures.push({
      viewport: viewport.width,
      screenshot: `artifacts/commercial-ui/pid-turn-calibration-1038/${screenshotFile}`,
      metrics: `artifacts/commercial-ui/pid-turn-calibration-1038/${metricsFile}`,
      screenshotSha256,
      apiStatus: apiResponse?.status ?? null,
      apiResponseBody: apiResponse?.body ?? null,
      result: 'passed',
    });
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(join(outputDirectory, 'browser-evidence.json'), JSON.stringify({
  change: 'calibrate-pid-turn-scenario',
  capturedAt: new Date().toISOString(),
  server: baseUrl,
  browser: 'Playwright Chromium',
  evidenceMode: 'COMMERCIAL_UI_EVIDENCE=1',
  gitSha,
  route: {
    productionSurface: 'src/resources/simulations/ai-recommend-panel.tsx',
    testHarnessRoute: route,
  },
  assertions: [
    '浏览器请求使用 targetHeading=90 和 maxRudderRate=5。',
    '返回的得分、指标和建议均在生产 PID 推荐面板中可见。',
    '1440px 与 320px 视口均无横向溢出和控制台错误。',
  ],
  limitations: [
    '测试路由仅作为确定性展示夹具，直接渲染与提交分支同 blob 的生产 AIRecommendPanel。',
    '浏览器证据验证 UI 渲染和 API 请求参数；算法正确性由 PID 定向单元测试与 Rust 测试覆盖。',
  ],
  captures,
}, null, 2));
