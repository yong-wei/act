import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {} from './fixtures/marine-model-delivery';

const APP_ORIGIN = 'https://act.adapt-learn.online';
const ESA_ORIGIN = 'https://static.adapt-learn.online';
// 本机TUN的fake-IP会被Chrome判为本地地址；显式使用既有HTTP代理，无需关闭浏览器保护。
test.use({ proxy: process.env.PLAYWRIGHT_ESA_PROXY ? { server: process.env.PLAYWRIGHT_ESA_PROXY } : undefined });
let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: [path.resolve('tests/fixtures/marine-model-delivery.tsx')], bundle: true,
    write: false, minify: true, format: 'esm', platform: 'browser', alias: { '@': path.resolve('src') } });
  bundle = result.outputFiles[0].text;
});
for (const api of ['webgl', 'webgpu'] as const) for (const unavailable of [false, true]) {
  test(`${api}: configured Origin loads the current consumer with ESA proxy fallback=${unavailable}`, async ({ page }, info) => {
    test.setTimeout(60000);
    // 当前加载器直接打包到允许Origin；ESA请求走真实网络，不表示生产应用已部署。
    await page.route(APP_ORIGIN + '/__model-delivery', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
    await page.route(APP_ORIGIN + '/__model-delivery.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }));
    await page.route(APP_ORIGIN + '/assets/model-releases/**', async route => {
      const relative = new URL(route.request().url()).pathname;
      const file = path.resolve('public' + relative);
      if (!file.startsWith(path.resolve('public/assets/model-releases') + path.sep)) throw new Error('fallback outside model package');
      await route.fulfill({ contentType: file.endsWith('.glb') ? 'model/gltf-binary' : 'image/png', body: readFileSync(file) });
    });
    const errors: string[] = [], requests: string[] = [], failedDelivery: string[] = [];
    const responses: { url: string; status: number; mime: string; origin: string }[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => {
      if (request.method() === 'GET' && request.url().startsWith(ESA_ORIGIN)) failedDelivery.push(request.url());
    });
    page.on('request', request => { if (request.method() === 'GET' && request.url().endsWith('.glb')) requests.push(request.url()); });
    page.on('response', response => {
      if (response.request().method() === 'GET' && response.url().startsWith(ESA_ORIGIN) && response.url().endsWith('.glb')) {
        const headers = response.headers();
        responses.push({ url: response.url(), status: response.status(), mime: headers['content-type'], origin: headers['access-control-allow-origin'] });
      }
    });
    if (unavailable) await page.route(ESA_ORIGIN + '/**/*ship-proxy.glb', route => route.fulfill({
      status: 503, headers: { 'Access-Control-Allow-Origin': APP_ORIGIN }, body: 'temporary proxy delivery failure',
    }));
    let release!: () => void;
    const lowGate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*ship-lod2.glb', async route => {
      if (route.request().method() === 'GET') await lowGate;
      await route.continue();
    });
    try {
      await page.goto(APP_ORIGIN + '/__model-delivery');
      await page.evaluate(async api => { const fixture = await import('/__model-delivery.js'); await fixture.mount(api); }, api);
      await page.waitForFunction(() => window.__modelDelivery?.url.endsWith('ship-proxy.glb'));
      expect(requests[0]).toBe(ESA_ORIGIN + '/model-releases/type055-nanchang-101/v2.3.0/models/type055-nanchang-101-ship-proxy.glb');
      const proxy = await page.evaluate(() => window.__modelDelivery!);
      expect(proxy.url.startsWith(unavailable ? '/assets/' : ESA_ORIGIN)).toBe(true);
      expect(proxy.api).toBe(api === 'webgl' ? 'WebGLBackend' : 'WebGPUBackend');
      release();
      await page.waitForFunction(() => window.__modelDelivery?.url.endsWith('ship-lod2.glb'));
      const low = await page.evaluate(() => window.__modelDelivery!);
      expect(low.url.startsWith(ESA_ORIGIN)).toBe(true); expect(low.matrix).toEqual(proxy.matrix);
      const successful = responses.filter(response => response.status === 200);
      expect(successful.length).toBeGreaterThan(0);
      expect(successful.every(response => response.mime.split(';')[0] === 'model/gltf-binary' && response.origin === APP_ORIGIN)).toBe(true);
      expect(failedDelivery).toEqual([]);
      await page.screenshot({ path: info.outputPath('esa-model.png') });
      expect(errors.filter(message => !(unavailable && message.includes('ship-proxy.glb') && message.includes('503: Service Unavailable')))).toEqual([]);
    } finally { release(); await page.evaluate(() => window.__disposeModelDelivery?.()); }
  });
}
