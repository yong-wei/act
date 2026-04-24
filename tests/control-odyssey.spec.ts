import { test, expect } from '@playwright/test';

test('control odyssey loads Rust runtime and keeps the game loop interactive', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('favicon.ico')) return;
    consoleErrors.push(text);
  });

  await page.goto('/interactive-learning/control-odyssey', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: '进入星域选择' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '进入星域选择' }).click();

  await page.getByRole('button', { name: /控制商店/ }).click();
  await expect(page.getByRole('heading', { name: '控制商店' })).toBeVisible();
  const shopShipPaths = page.locator('[role="dialog"] path[d^="M56 5 L56 -5"]');
  await expect(shopShipPaths.first()).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: '配置并开始' }).first().click();
  await page.getByText('PID 辅助 (PID Assist)').click();
  await expect(page.getByText('自动模式')).toBeVisible();

  const pidGainSlider = page.locator('input[type="range"]').nth(1);
  await expect(pidGainSlider).toHaveValue('0.05');
  await pidGainSlider.fill('0.08');
  await expect(page.getByText(/0\.08 \/ 0\.10/)).toBeVisible();

  await page.getByRole('button', { name: '启动引擎' }).click();
  await page.keyboard.press('Space');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(350);
  await page.keyboard.up('ArrowDown');
  await expect(page.getByText('Progress')).toBeVisible();
  await expect(page.locator('body')).toContainText(/\/ 3000m/);

  await expect(page.getByText('CONTROL ODYSSEY')).toBeVisible();
  await expect(page.locator('path[d^="M56 5 L56 -5"]').first()).toBeVisible();
  await expect(page.getByText('给定航线R(t)')).toBeVisible();
  await expect(page.getByText('实际航线Y(t)')).toBeVisible();
  await expect(page.getByText('控制信号U(t)')).toBeVisible();

  expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
