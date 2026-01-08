import { defineConfig } from '@playwright/test';

const noProxyHosts = '127.0.0.1,localhost';
process.env.NO_PROXY = process.env.NO_PROXY ? `${process.env.NO_PROXY},${noProxyHosts}` : noProxyHosts;
process.env.no_proxy = process.env.no_proxy ? `${process.env.no_proxy},${noProxyHosts}` : noProxyHosts;

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3200);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const devServerCommand = `node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: devServerCommand,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
