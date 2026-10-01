import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';

// 真实 Three.js + 共享水面材质：压缩类名后，两种后端仍须初始化并保留负浪高。
let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: [path.resolve('tests/fixtures/marine-bounds-probe.ts')],
    bundle: true,
    write: false,
    minify: true,
    format: 'esm',
    platform: 'browser',
    alias: { '@': path.resolve('src') },
  });
  bundle = result.outputFiles[0].text;
});
for (const api of ['webgl', 'webgpu'] as const) {
  test(`minified ${api}: initialize and keep troughs below the far plane`, async ({
    page,
  }) => {
    await page.route('**/__marine-probe', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }),
    );
    await page.route('**/__marine-probe.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: bundle }),
    );
    await page.goto('/__marine-probe');
    const result = await page.evaluate(async (api) => {
      // 动态 URL 由 Playwright 提供压缩后的真实实现，不经过开发服务器的模块转换。
      const url = '/__marine-probe.js';
      const probeModule = await import(url);
      return probeModule.probe(api);
    }, api);
    expect(result.identity.api).toBe(
      api === 'webgl' ? 'WebGLBackend' : 'WebGPUBackend',
    );
    expect(result.fftMaxError).toBeLessThan(0.0001);
    expect(result.centerWithFar).toEqual(result.centerWithoutFar);
    expect(result.centerWithFar[3]).toBe(255);
    expect(result.outsideWithFar[3]).toBe(255);
    expect(result.outsideWithoutFar[3]).toBe(0);
  });
}
