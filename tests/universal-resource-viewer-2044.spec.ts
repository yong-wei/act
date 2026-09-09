import { expect, test, type BrowserContext } from '@playwright/test';

import { verifiedAuthForm } from './verified-test-credentials';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';

async function login(context: BrowserContext) {
  const csrfResponse = await context.request.get(`${baseURL}/api/auth/csrf`);
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();
  const response = await context.request.post(`${baseURL}/api/auth/callback/credentials?json=true`, {
    form: {
      csrfToken: csrf.csrfToken!,
      ...verifiedAuthForm('student'),
      callbackUrl: baseURL,
      json: 'true',
    },
  });
  expect(response.ok() || (response.status() >= 300 && response.status() < 400)).toBe(true);
}

test('adaptive path center mounts the shared resource viewer host', async ({ context, page }) => {
  await login(context);
  await page.goto(`${baseURL}/assessment/adaptive-practice?demo=1`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('[data-universal-resource-viewer-host="true"]')).toBeAttached();
});

test('knowledge workspace mounts the shared resource viewer host', async ({ context, page }) => {
  await login(context);
  await page.goto(`${baseURL}/knowledge`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('[data-universal-resource-viewer-host="true"]')).toBeAttached({ timeout: 60_000 });
});
