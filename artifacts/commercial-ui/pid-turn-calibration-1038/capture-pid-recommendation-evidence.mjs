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

// 模拟真实 /api/simulation/optimize 响应结构：advice 在 result 外部
const resultBody = {
  success: true,
  result: {
    recommendedParams: { kp: 2.4, ki: 0.05, kd: 1.2 },
    score: 86,
    metrics: {
      avgError: 74.2,
      maxRudderRate: 4.2,
      settlingTime: 31,
      overshoot: 7.5,
    },
    searchInfo: { iterations: 50, timeMs: 312 },
  },
  advice: '当前推荐针对 90°右转目标；在 5°/s 舵角速度约束下保持稳定余量。',
};

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const captures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleErrors = [];
    let requestBody;

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.route('**/api/simulation/optimize', async (routeRequest) => {
      requestBody = routeRequest.request().postDataJSON();
      await routeRequest.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(resultBody),
      });
    });

    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '智能推荐' }).click();
    await page.getByText('得分: 86').waitFor();

    assert.deepEqual(requestBody.target, {
      targetHeading: 90,
      maxError: 150,
      maxRudderRate: 5,
      maxOvershoot: 20,
    });
    await assert.doesNotReject(async () => {
      await page.getByText('当前推荐针对 90°右转目标；在 5°/s 舵角速度约束下保持稳定余量。').waitFor();
    });

    const metrics = await page.evaluate(() => ({
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      panelVisible: Boolean([...document.querySelectorAll('h3')].find((node) => node.textContent === 'AI 参数推荐')),
      scoreVisible: document.body.textContent?.includes('得分: 86') ?? false,
      adviceVisible: document.body.textContent?.includes('90°右转目标') ?? false,
    }));
    assert.equal(metrics.documentScrollWidth <= metrics.viewportWidth, true, '页面存在横向溢出');
    assert.equal(metrics.panelVisible, true, '未渲染生产 PID 推荐面板');
    assert.equal(metrics.scoreVisible, true, '未显示校准评分');
    assert.equal(metrics.adviceVisible, true, '未显示与 90° 目标对应的建议');
    assert.deepEqual(consoleErrors, [], '浏览器控制台出现错误');

    const screenshot = `pid-recommendation-${viewport.name}.png`;
    const metricsFile = `pid-recommendation-${viewport.name}-metrics.json`;
    await page.screenshot({ path: join(outputDirectory, screenshot), fullPage: true });
    await writeFile(join(outputDirectory, metricsFile), `${JSON.stringify({
      route,
      viewport,
      requestBody,
      result: resultBody,
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
    sourceBlob: 'f799914f11c0db9f5e52cfaf4017634eaee25dad',
  },
  assertions: [
    '浏览器请求使用 targetHeading=90 和 maxRudderRate=5。',
    '返回的得分、指标和建议均在生产 PID 推荐面板中可见。',
    '1440px 与 320px 视口均无横向溢出和控制台错误。',
  ],
  limitations: [
    '测试路由仅作为确定性展示夹具，直接渲染与提交分支同 blob 的生产 AIRecommendPanel。',
    '优化接口由 Playwright 拦截为经校准场景契约的固定结果；算法正确性由 PID 定向单元与 Rust 测试覆盖。',
  ],
  captures,
}, null, 2)}\n`);
