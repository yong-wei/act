import { test, expect } from '@playwright/test';

test('destroyer simulation loads without runtime errors', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/simulations/destroyer', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '军用驱逐舰战术机动仿真' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);

  await page.waitForTimeout(1500);

  expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
