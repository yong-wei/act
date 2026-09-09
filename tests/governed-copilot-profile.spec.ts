import { expect, test, type BrowserContext } from '@playwright/test';

import { verifiedAuthForm } from './verified-test-credentials';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 320, height: 900 },
]) {
  test(`generic Copilot shows governed profile limits without fabricated facts at ${viewport.name}`, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await establishAuthenticatedSession(page.context());
    await page.route('**/api/ai/copilot-profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Governed-Copilot-Profile-Status': 'missing' },
        body: JSON.stringify({
          version: 'governed-copilot-profile-context.v1',
          status: 'missing',
          authenticatedUserId: 'student-1',
          displayName: '张三',
          limitations: ['当前没有可核验的学习画像。'],
          nextAction: {
            href: '/assessment/adaptive-practice?intent=practice',
            label: '去做一次自适应练习，补充学习证据',
          },
        }),
      });
    });

    const response = await page.goto('/ai/copilot', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    const profilePanel = page.locator('main [data-copilot-profile-status]').first();
    await expect(profilePanel).toBeVisible();
    await expect(profilePanel).toHaveAttribute('data-copilot-profile-status', 'missing');
    await expect(profilePanel.getByText('暂无受治理学习画像', { exact: true })).toBeVisible();
    await expect(profilePanel.getByText('当前没有可核验的学习画像。', { exact: true })).toBeVisible();
    await expect(profilePanel.locator('[data-copilot-profile-next-action]')).toHaveAttribute(
      'href',
      '/assessment/adaptive-practice?intent=practice',
    );
    await expect(page.getByText('视觉型')).toHaveCount(0);
    await expect(page.getByText('综合能力均衡发展')).toHaveCount(0);
    await expect(page.getByText('L3水平')).toHaveCount(0);

    const dimensions = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

    await page.screenshot({
      path: `artifacts/commercial-ui/issue-1699-governed-copilot-profile/copilot-${viewport.name}.png`,
      fullPage: false,
    });
  });

  test(`AI workshop does not render fabricated personal profile facts at ${viewport.name}`, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await establishAuthenticatedSession(page.context());
    const response = await page.goto('/ai', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await expect(page.getByText('视觉型')).toHaveCount(0);
    await expect(page.getByText('综合能力均衡发展')).toHaveCount(0);
    await expect(page.locator('text=120 分钟')).toHaveCount(0);
    await expect(page.locator('text=85%')).toHaveCount(0);

    await page.screenshot({
      path: `artifacts/commercial-ui/issue-1699-governed-copilot-profile/workshop-${viewport.name}.png`,
      fullPage: false,
    });
  });
}

async function establishAuthenticatedSession(context: BrowserContext) {
  const csrfResponse = await context.request.get('/api/auth/csrf');
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();

  const loginResponse = await context.request.post('/api/auth/callback/credentials?json=true', {
    form: {
      csrfToken: csrf.csrfToken!,
      ...verifiedAuthForm('student'),
      callbackUrl: '/ai/copilot',
      json: 'true',
    },
  });
  expect(loginResponse.ok(), `credentials login failed: ${loginResponse.status()}`).toBe(true);
}
