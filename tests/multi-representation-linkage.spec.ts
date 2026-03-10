import { expect, test } from '@playwright/test';

test('multi representation linkage page should not emit chart size warning on first load', async ({ page }) => {
  const chartSizeWarnings: string[] = [];

  page.on('console', (message) => {
    const text = message.text();
    if (
      text.includes('The width(-1) and height(-1) of chart should be greater than 0') ||
      text.includes('width(-1)') ||
      text.includes('height(-1)')
    ) {
      chartSizeWarnings.push(text);
    }
  });

  await page.goto('/interactive-learning/multi-representation-linkage', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '多表征联动可视化引擎' })).toBeVisible();

  await page.waitForTimeout(1200);

  expect(
    chartSizeWarnings,
    `Chart size warnings: ${chartSizeWarnings.join(' | ')}`
  ).toEqual([]);
});
