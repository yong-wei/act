import { test, expect } from '@playwright/test';

import { expectRenderedCanvas } from './simulation-canvas-assertions';

test('destroyer simulation loads without runtime errors', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/simulations/destroyer', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '055 型驱逐舰航向控制' })).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 });
  await expectRenderedCanvas(page);

  const scene = page.locator('[data-sim-ui]');
  await expect(scene.locator('[data-chrome-popover-trigger="rate"]')).toContainText('8.0x');
  await scene.getByRole('button', { name: '速率' }).click();
  for (const speedLabel of ['4.0x', '2.0x', '1.0x']) {
    await scene.getByRole('button', { name: '减速' }).click();
    await expect(scene.getByText(speedLabel).first()).toBeVisible({ timeout: 10000 });
  }
  await scene.locator('[data-sound-start]').click();
  await expect(page.getByText('运行中')).toBeVisible();
  await expect
    .poll(
      async () => {
        const simulationText = await page.locator('body').innerText();
        return Number(simulationText.match(/仿真时间\s+([\d.]+)\s*s/)?.[1] ?? 0);
      },
      { timeout: 90000 },
    )
    .toBeGreaterThan(3);

  await expect.poll(async () => page.locator('body').innerText()).toContain('舵角');

  await page.waitForTimeout(500);
  await expectRenderedCanvas(page);

  expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
