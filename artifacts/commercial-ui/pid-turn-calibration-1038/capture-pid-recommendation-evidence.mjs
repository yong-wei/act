import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
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

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const captures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleErrors = [];
    let requestBody;
    let responseBody;

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    // 拦截请求以记录请求体，但不拦截响应——让浏览器调用真实 /api/simulation/optimize
    await page.route('**/api/simulation/optimize', async (routeRequest) => {
      requestBody = routeRequest.request().postDataJSON();
      await routeRequest.continue();
    });

    // 捕获真实 API 响应
    page.on('response', async (response) => {
      if (response.url().includes('/api/simulation/optimize') && response.status() === 200) {
        try {
          responseBody = await response.json();
        } catch { /* non-JSON response */ }
      }
    });

    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '智能推荐' }).click();

    // 等待推荐结果渲染（得分文本不固定，由真实 API 返回）
    await page.locator('text=/得分/').first().waitFor({ timeout: 60000 });

    assert.ok(requestBody, '浏览器未发出 /api/simulation/optimize 请求');
    assert.equal(requestBody.target.targetHeading, 90, 'targetHeading 应为 90');
    assert.equal(requestBody.target.maxRudderRate, 5, 'maxRudderRate 应为 5');
    assert.ok(responseBody, '未收到真实 /api/simulation/optimize 响应');
    assert.equal(responseBody.success, true, 'API 响应 success 应为 true');

    const metrics = await page.evaluate(() => ({
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      panelVisible: Boolean([...document.querySelectorAll('h3')].find((node) => node.textContent === 'AI 参数推荐')),
      scoreVisible: document.body.textContent?.includes('得分') ?? false,
    }));
    assert.equal(metrics.documentScrollWidth <= metrics.viewportWidth, true, '页面存在横向溢出');
    assert.equal(metrics.panelVisible, true, '未渲染生产 PID 推荐面板');
    assert.equal(metrics.scoreVisible, true, '未显示推荐评分');
    assert.deepEqual(consoleErrors, [], '浏览器控制台出现错误');

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

await writeFile(join(outputDirectory, 'browser-evidence.json'), `${JSON.stringify({
  change: 'calibrate-pid-turn-scenario',
  capturedAt: new Date().toISOString(),
  server: baseUrl,
  browser: 'Playwright Chromium',
  evidenceMode: 'COMMERCIAL_UI_EVIDENCE=1',
  route: {
    productionSurface: 'src/resources/simulations/ai-recommend-panel.tsx',
    testHarnessRoute: route,
  },
  assertions: [
    '浏览器请求使用 targetHeading=90 和 maxRudderRate=5。',
    '真实 /api/simulation/optimize 返回 success=true 且面板显示得分。',
    '1440px 与 320px 视口均无横向溢出和控制台错误。',
  ],
  limitations: [
    '测试路由渲染生产 AIRecommendPanel 组件，优化接口由真实 /api/simulation/optimize 处理（需要 Docker 环境运行 WASM 运行时）。',
    '算法正确性由 PID 定向单元与 Rust 测试覆盖；浏览器证据验证集成链路可达性和 UI 渲染。',
  ],
  captures,
}, null, 2)}\n`);
