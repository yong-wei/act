import { expect, test } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:3101' });

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 320, height: 900 },
]) {
  test(`AI Workshop renders evidence state without overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const response = await page.goto('/ai', { waitUntil: 'networkidle' });

    expect(response?.status()).toBe(200);
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

    await page.screenshot({
      path: `artifacts/commercial-ui/issue-1454-ai-workshop-evidence/ai-workshop-${viewport.name}.png`,
      fullPage: false,
    });
  });
}
