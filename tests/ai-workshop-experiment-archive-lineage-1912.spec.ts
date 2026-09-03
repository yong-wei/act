import { expect, test, type BrowserContext } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:3101' });

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 320, height: 900 },
]) {
  test(`AI Workshop experiment archive renders lineage navigation at ${viewport.name} (Issue #1912)`, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await establishAuthenticatedSession(page.context());
    const response = await page.goto('/ai', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBe(200);

    const panel = page.locator('[data-ai-workshop-collection="experiments"]');
    await expect(panel).toBeVisible();
    const state = await panel.getAttribute('data-ai-workshop-collection-state');
    expect(['available', 'empty', 'unavailable']).toContain(state);

    if (state === 'available') {
      const itemCount = await panel.locator('[data-ai-workshop-experiment-item]').count();
      expect(itemCount).toBeGreaterThan(0);
      // 每个条目：主导航是卡内独立链接（卡片本身非链接，避免嵌套 <a>），
      // 或受限展示；被归并来源链接同样是卡内链接。
      const primaryNavLinks = panel.locator('a[data-ai-workshop-experiment-navigation][href]');
      const restrictedItems = panel.locator(
        '[data-ai-workshop-experiment-item]:has([data-ai-workshop-experiment-navigation="restricted"])',
      );
      const linkedCount = await primaryNavLinks.count();
      const restrictedCount = await restrictedItems.count();
      expect(linkedCount + restrictedCount).toBe(itemCount);
      for (let index = 0; index < linkedCount; index += 1) {
        const href = await primaryNavLinks.nth(index).getAttribute('href');
        expect(href?.startsWith('/')).toBe(true);
      }
      // 嵌套链接防护：卡片容器不是 <a>（Codex R3 review）。
      expect(await panel.locator('a[data-ai-workshop-experiment-item]').count()).toBe(0);
    }

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
      path: `artifacts/commercial-ui/issue-1912-ai-workshop-experiment-archive/experiment-archive-${viewport.name}.png`,
      fullPage: false,
    });
  });
}

test('verified experiment navigation enters its learning destination (Issue #1912)', async ({ page }) => {
  await establishAuthenticatedSession(page.context());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ai', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  const panel = page.locator('[data-ai-workshop-collection="experiments"]');
  const state = await panel.getAttribute('data-ai-workshop-collection-state');
  test.skip(state !== 'available', 'experiment archive has no populated items in this environment');

  const firstLink = panel.locator('a[data-ai-workshop-experiment-navigation][href]').first();
  test.skip((await firstLink.count()) === 0, 'no verified navigation target in this environment');
  const href = await firstLink.getAttribute('href');
  await firstLink.click();
  await page.waitForURL((url) => url.pathname === href, { timeout: 15000 });
  expect(page.url()).toContain(href ?? '__missing__');
});

async function establishAuthenticatedSession(context: BrowserContext) {
  const csrfResponse = await context.request.get('/api/auth/csrf');
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();

  const loginResponse = await context.request.post('/api/auth/callback/credentials?json=true', {
    form: {
      csrfToken: csrf.csrfToken!,
      email: 'demo',
      password: 'DemoStudent@Just2026!',
      callbackUrl: '/ai',
      json: 'true',
    },
  });
  expect(loginResponse.ok(), `credentials login failed: ${loginResponse.status}`).toBe(true);
}
