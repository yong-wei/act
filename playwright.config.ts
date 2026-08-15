import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

config({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' });

const noProxyHosts = '127.0.0.1,localhost';
process.env.NO_PROXY = process.env.NO_PROXY ? `${process.env.NO_PROXY},${noProxyHosts}` : noProxyHosts;
process.env.no_proxy = process.env.no_proxy ? `${process.env.no_proxy},${noProxyHosts}` : noProxyHosts;

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3200);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const devServerCommand = `node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`;
const authSecret = process.env.NEXTAUTH_SECRET
  ?? process.env.AUTH_SECRET
  ?? 'playwright-local-auth-secret-at-least-32-bytes';

process.env.NEXTAUTH_SECRET = authSecret;

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
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
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
