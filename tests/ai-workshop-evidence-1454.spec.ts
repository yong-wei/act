import { expect, test, type BrowserContext } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:3101' });

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 320, height: 900 },
]) {
  test(`AI Workshop renders evidence state without overflow at ${viewport.name}`, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await establishAuthenticatedSession(page.context());
    const response = await page.goto('/ai', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    const metricValues = await page.locator('[data-ai-workshop-metric]').allTextContents();
    expect(metricValues).not.toEqual(expect.arrayContaining(['0', '0%']));
    expect(metricValues.some((value) => value.trim() === '0' || value.trim() === '0%' || value.trim().startsWith('0 '))).toBe(false);
    await expect(page.locator('[data-ai-workshop-metric="experiment-count"]')).not.toHaveText(/^0$/);
    await expect(page.locator('[data-ai-workshop-action="milestones"]')).toHaveAttribute('href', '/interactive-learning');
    await expect(page.locator('[data-ai-workshop-action="achievements"]')).toHaveAttribute('href', '/interactive-learning');
    await expect(page.locator('[data-ai-workshop-action="tasks"]')).toHaveAttribute('href', '/interactive-learning');
    await expect(page.locator('[data-ai-workshop-action="experiments"]')).toHaveAttribute('href', '/arena');
    await expect(page.locator('[data-ai-workshop-action="journals"]')).toHaveAttribute('href', '/ai/copilot?context=portfolio-reflection&source=learning-journal&intent=create');
    await expect(page.locator('[data-ai-workshop-source-coverage]')).toContainText('来源覆盖');
    await page.locator('nextjs-portal').evaluateAll((portals) => {
      portals.forEach((portal) => {
        (portal as HTMLElement).style.display = 'none';
      });
    });
    await expect(page.locator('[data-ai-workshop-empty="tasks"]')).toBeVisible();
    await expect(page.locator('text=120 分钟')).toHaveCount(0);
    await expect(page.locator('text=85%')).toHaveCount(0);

    const dimensions = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

    if (viewport.name === 'desktop') {
      const expandNavigation = page.getByRole('button', { name: '展开平台导航' });
      await expandNavigation.focus();
      await expect(expandNavigation).toBeFocused();
      await expandNavigation.click();
      await expect(page.locator('[data-app-shell-navigation-state="expanded"]')).toBeVisible();
      await page.screenshot({
        path: 'artifacts/commercial-ui/issue-1454-ai-workshop-evidence/ai-workshop-desktop.png',
        fullPage: false,
      });

      const collapseNavigation = page.getByRole('button', { name: '收起平台导航' });
      await collapseNavigation.focus();
      await expect(collapseNavigation).toBeFocused();
      await collapseNavigation.click();
      await expect(page.locator('[data-app-shell-navigation-state="collapsed"]')).toBeVisible();
      await page.screenshot({
        path: 'artifacts/commercial-ui/issue-1454-ai-workshop-evidence/ai-workshop-desktop-collapsed.png',
        fullPage: false,
      });
      return;
    }

    await page.screenshot({
      path: 'artifacts/commercial-ui/issue-1454-ai-workshop-evidence/ai-workshop-mobile.png',
      fullPage: false,
    });

    const openNavigation = page.getByRole('button', { name: '打开平台导航' });
    await openNavigation.focus();
    await expect(openNavigation).toBeFocused();
    await openNavigation.click();
    await expect(page.locator('[data-app-shell-mobile-drawer="open"]')).toBeVisible();
    await page.screenshot({
      path: 'artifacts/commercial-ui/issue-1454-ai-workshop-evidence/ai-workshop-mobile-drawer.png',
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
  expect(loginResponse.ok(), `credentials login failed: ${loginResponse.status()}`).toBe(true);
}
