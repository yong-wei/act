import { expect, test } from '@playwright/test';

test('multi representation linkage page should not emit chart size warning on first load', async ({ page }) => {
  const chartSizeWarnings: string[] = [];
  const linkageRequests: string[] = [];

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
  page.on('request', (request) => {
    if (request.url().includes('/api/linkage/')) {
      linkageRequests.push(request.url());
    }
  });

  await page.goto('/interactive-learning/multi-representation-linkage', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '多表征联动可视化引擎' })).toBeVisible();
  await expect(page.getByTestId('metric-Mp')).toBeVisible();
  await expect(page.getByText('组合 Bode 图')).toBeVisible();
  await expect(page.getByText('根轨迹全览')).toBeVisible();
  await expect(page.getByText('Nyquist 图')).toBeVisible();
  await expect(page.getByText('拖动开环极点')).toHaveCount(0);

  const phaseMarginValue = page
    .getByTestId('metric-PM')
    .locator('.premium-lesson-title');
  await expect.poll(async () => {
    const text = (await phaseMarginValue.textContent())?.trim();
    return Boolean(text && text !== '--');
  }).toBe(true);

  const initialPhaseMargin = ((await phaseMarginValue.textContent()) ?? '').trim();
  await page.getByRole('button', { name: '参数抽屉' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const gainInput = page.getByLabel('增益 K（闭环极点联动）');
  await gainInput.fill('4.500');
  await gainInput.press('Tab');
  await page.keyboard.press('Escape');

  await expect.poll(async () => {
    const text = ((await phaseMarginValue.textContent()) ?? '').trim();
    return text !== '--' && text !== initialPhaseMargin;
  }).toBe(true);

  await page.waitForTimeout(600);

  expect(
    chartSizeWarnings,
    `Chart size warnings: ${chartSizeWarnings.join(' | ')}`
  ).toEqual([]);
  expect(
    linkageRequests,
    `Unexpected /api/linkage requests: ${linkageRequests.join(' | ')}`
  ).toEqual([]);
});
