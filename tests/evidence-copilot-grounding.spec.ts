import { expect, test, type BrowserContext } from '@playwright/test';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 320, height: 900 },
]) {
  test(`Evidence Copilot shows truthful missing evidence and a real next action at ${viewport.name}`, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await establishAuthenticatedSession(page.context());
    await page.route('**/api/ai/evidence-copilot**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Evidence-Copilot-Status': 'missing' },
        body: JSON.stringify({
          version: 'evidence-copilot-context.v1',
          status: 'missing',
          limitations: ['当前没有可核验的学习证据。'],
          sourceCoverage: {},
          confidenceLevel: 'none',
          freshness: 'missing',
          preferredModalities: [],
          weakTargets: [],
          nextAction: {
            href: '/assessment/adaptive-practice?intent=practice',
            label: '去做一次自适应练习，补充学习证据',
          },
          navigationHint: { source: 'spoofed-source', assignment: null, intent: null },
        }),
      });
    });

    const response = await page.goto('/ai/copilot?context=evidence&source=spoofed-source', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    const evidencePanel = page.locator('main [data-ai-task-boundary="evidence-copilot-summary"]').first();
    await expect(evidencePanel).toBeVisible();
    await expect(evidencePanel).toHaveAttribute('data-evidence-copilot-status', 'missing');
    await expect(evidencePanel.getByText('暂无学习证据', { exact: true })).toBeVisible();
    await expect(evidencePanel.getByText('当前没有可核验的学习证据。', { exact: true })).toBeVisible();
    await expect(evidencePanel.locator('[data-evidence-copilot-next-action]')).toHaveAttribute(
      'href',
      '/assessment/adaptive-practice?intent=practice',
    );
    await expect(page.getByText('证据摘要：spoofed-source')).toHaveCount(0);

    const dimensions = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

    await page.screenshot({
      path: `artifacts/commercial-ui/issue-1563-evidence-copilot/evidence-copilot-${viewport.name}.png`,
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
      callbackUrl: '/ai/copilot',
      json: 'true',
    },
  });
  expect(loginResponse.ok(), `credentials login failed: ${loginResponse.status()}`).toBe(true);
}
