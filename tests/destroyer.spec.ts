import { test, expect } from '@playwright/test';

test.skip(
  true,
  'React Three Fiber 8 simulation runtime is isolated until the React/Three upgrade lane restores Next 16 dev coverage.',
);

test('destroyer simulation loads without runtime errors', async ({ page }) => {
  test.setTimeout(180000);
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
  await expect
    .poll(
      async () => {
        const simulationText = await page.locator('body').innerText();
        return Number(simulationText.match(/仿真时间\n([\d.]+) s/)?.[1] ?? 0);
      },
      { timeout: 90000 },
    )
    .toBeGreaterThan(65);

  await expect
    .poll(
      async () => {
        const simulationText = await page.locator('body').innerText();
        return Math.abs(Number(simulationText.match(/舵角\n(-?[\d.]+)°/)?.[1] ?? 0));
      },
      { timeout: 30000 },
    )
    .toBeGreaterThan(1);

  await page.waitForTimeout(500);

  expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
