import { test, expect } from '@playwright/test';

test('control odyssey shop and in-level ship are visible', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('favicon.ico')) return;
    consoleErrors.push(text);
  });

  await page.goto('/interactive-learning/control-odyssey', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '进入星域选择' }).click();

  await page.getByRole('button', { name: /控制商店/ }).click();
  await expect(page.getByRole('heading', { name: '控制商店' })).toBeVisible();
  const shopShipPaths = page.locator('[role="dialog"] path[d^="M56 5 L56 -5"]');
  await expect(shopShipPaths.first()).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: '配置并开始' }).first().click();
  await page.getByRole('button', { name: '启动引擎' }).click();

  await expect(page.getByText('CONTROL ODYSSEY')).toBeVisible();
  await expect(page.locator('path[d^="M56 5 L56 -5"]').first()).toBeVisible();

  expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
