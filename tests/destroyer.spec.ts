import { test, expect } from '@playwright/test';

test('destroyer simulation loads without runtime errors', async ({ page }) => {
  test.setTimeout(120000);
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
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30000 });

  await expect(page.getByText('1.0x')).toBeVisible({ timeout: 30000 });
  for (const speedLabel of ['2.0x', '4.0x', '8.0x']) {
    await page.getByRole('button', { name: '加速' }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
    await expect(page.getByText(speedLabel)).toBeVisible({ timeout: 10000 });
  }
  await page.getByRole('button', { name: /开始/ }).evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByText('运行中')).toBeVisible();
  await page.waitForTimeout(12000);

  const simulationText = await page.locator('body').innerText();
  const simulationTime = Number(simulationText.match(/仿真时间\n([\d.]+) s/)?.[1] ?? 0);
  const rudderDeg = Math.abs(Number(simulationText.match(/舵角\n(-?[\d.]+)°/)?.[1] ?? 0));
  expect(simulationTime).toBeGreaterThan(55);
  expect(rudderDeg).toBeGreaterThan(1);

  await page.waitForTimeout(500);

  expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
