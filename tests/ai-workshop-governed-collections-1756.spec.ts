import { expect, test, type BrowserContext, type Page } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:3101' });

const COLLECTIONS = ['tasks', 'milestones', 'achievements', 'experiments', 'journals'] as const;

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 320, height: 900 },
]) {
  test(`AI Workshop governed collections render independent states at ${viewport.name} (Issue #1756)`, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await establishAuthenticatedSession(page.context());
    const response = await page.goto('/ai', { waitUntil: 'domcontentloaded' });
    // 页面经 Suspense 流式渲染：等待流结束，避免隐藏的未揭示段被计入定位。
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBe(200);

    // 五个集合独立携带受治理状态；任何状态组合都不得整页回退。
    for (const name of COLLECTIONS) {
      const panel = page.locator(`[data-ai-workshop-collection="${name}"]`);
      await expect(panel).toBeVisible();
      const state = await panel.getAttribute('data-ai-workshop-collection-state');
      expect(['available', 'empty', 'unavailable']).toContain(state);
      if (state === 'available') {
        // 可用集合渲染真实记录，不出现空态文案。
        await expect(panel.locator('[data-ai-workshop-empty]')).toHaveCount(0);
      } else {
        // 空态/不可用态提供学生可理解的说明与邻近行动。
        await expect(panel.locator(`[data-ai-workshop-action="${name}"]`)).toBeVisible();
      }
    }

    // 键盘可达性：集合行动与日志轮播控制可聚焦且有可访问名。
    const firstAction = page.locator('[data-ai-workshop-action]').first();
    await firstAction.focus();
    await expect(firstAction).toBeFocused();
    const journalPanel = page.locator('[data-ai-workshop-collection="journals"]');
    if ((await journalPanel.getAttribute('data-ai-workshop-collection-state')) === 'available') {
      await expect(journalPanel.getByRole('button', { name: '上一条日志' })).toBeVisible();
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
      path: `artifacts/commercial-ui/issue-1756-ai-workshop-collections/ai-workshop-collections-${viewport.name}.png`,
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
      email: 'demo',
      password: 'DemoStudent@Just2026!',
      callbackUrl: '/ai',
      json: 'true',
    },
  });
  expect(loginResponse.ok(), `credentials login failed: ${loginResponse.status}`).toBe(true);
}
