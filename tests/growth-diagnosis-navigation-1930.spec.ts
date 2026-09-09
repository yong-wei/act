import { expect, test, type BrowserContext } from '@playwright/test';

import { verifiedAuthForm } from './verified-test-credentials';

test.use({ baseURL: 'http://127.0.0.1:3101' });

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 320, height: 900 },
]) {
  test(`growth center recommendations and diagnosis enter the formal learning entry at ${viewport.name} (Issue #1930)`, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await establishAuthenticatedSession(page.context());
    const response = await page.goto('/profile/growth', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBe(200);

    // 推荐卡片：有行动地址的渲染为进入正式互动课程目录的链接；
    // 缺失地址的渲染不可用状态，绝不产生 `#` 空链接。
    const recommendationLinks = page.locator('a[data-growth-recommendation]');
    const recommendationCount = await recommendationLinks.count();
    for (let index = 0; index < recommendationCount; index += 1) {
      const href = await recommendationLinks.nth(index).getAttribute('href');
      expect(href?.startsWith('/')).toBe(true);
      expect(href).not.toBe('#');
    }
    const unavailableCards = page.locator('[data-growth-recommendation-unavailable]');
    expect(await unavailableCards.locator('a').count()).toBe(0);

    // 水平溢出检查。
    const dimensions = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

    await page.locator('nextjs-portal').evaluateAll((portals) => {
      portals.forEach((portal) => {
        (portal as HTMLElement).style.display = 'none';
      });
    });
    await page.screenshot({
      path: `artifacts/commercial-ui/issue-1930-growth-navigation/growth-navigation-${viewport.name}.png`,
      fullPage: false,
    });
  });
}

test('growth recommendation navigation reaches the formal interactive course entry (Issue #1930)', async ({ page }) => {
  await establishAuthenticatedSession(page.context());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/profile/growth', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  const firstRecommendation = page.locator('a[data-growth-recommendation]').first();
  test.skip((await firstRecommendation.count()) === 0, 'no actionable recommendation in this environment');
  await firstRecommendation.click();
  await page.waitForURL((url) => url.pathname.startsWith('/interactive-learning'), { timeout: 15000 });
  expect(page.url()).toContain('/interactive-learning');
});

test('diagnosis continue-learning actions use the formal entry instead of legacy /courses (Issue #1930)', async ({ page }) => {
  await establishAuthenticatedSession(page.context());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/profile/growth', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  // 诊断卡的"继续学习"不得指向旧路由 /courses。
  const legacyLinks = await page.locator('a[href="/courses"]').count();
  expect(legacyLinks).toBe(0);
});

async function establishAuthenticatedSession(context: BrowserContext) {
  const csrfResponse = await context.request.get('/api/auth/csrf');
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();

  const loginResponse = await context.request.post('/api/auth/callback/credentials?json=true', {
    form: {
      csrfToken: csrf.csrfToken!,
      ...verifiedAuthForm('student'),
      callbackUrl: '/profile/growth',
      json: 'true',
    },
  });
  expect(loginResponse.ok(), `credentials login failed: ${loginResponse.status}`).toBe(true);
}
