import { defineConfig } from '@playwright/test';

const noProxyHosts = '127.0.0.1,localhost';
process.env.NO_PROXY = process.env.NO_PROXY ? `${process.env.NO_PROXY},${noProxyHosts}` : noProxyHosts;
process.env.no_proxy = process.env.no_proxy ? `${process.env.no_proxy},${noProxyHosts}` : noProxyHosts;

const port = Number(process.env.PLAYWRIGHT_KNOWLEDGE_PERFORMANCE_PORT ?? 3214);
const baseURL = `http://127.0.0.1:${port}`;
const serverMode = process.env.PLAYWRIGHT_KNOWLEDGE_PERFORMANCE_SERVER_MODE === 'dev'
  ? 'dev'
  : 'start';

export default defineConfig({
  testDir: './tests',
  testMatch: 'knowledge-graph-performance.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    browserName: 'chromium',
    headless: process.env.PLAYWRIGHT_HEADED !== '1',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node ./node_modules/next/dist/bin/next ${serverMode} --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
