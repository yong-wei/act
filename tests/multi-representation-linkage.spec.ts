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
  const objectTab = page.getByTestId('parameter-drawer-object-tab');
  const correctionTab = page.getByTestId('parameter-drawer-correction-tab');
  await expect(objectTab).toHaveAttribute('data-state', 'active');
  await expect(correctionTab).toHaveAttribute('data-state', 'inactive');
  await expect(objectTab).toHaveClass(/w-full min-w-0/);
  await expect(objectTab).toHaveClass(/overflow-hidden/);
  const objectBoxBefore = await objectTab.boundingBox();
  const correctionBoxBefore = await correctionTab.boundingBox();
  expect(objectBoxBefore).not.toBeNull();
  expect(correctionBoxBefore).not.toBeNull();
  const gainInput = page.getByLabel('开环增益 K');
  await gainInput.fill('4.500');
  await gainInput.press('Tab');
  await correctionTab.click();
  await expect(objectTab).toHaveAttribute('data-state', 'inactive');
  await expect(correctionTab).toHaveAttribute('data-state', 'active');
  const objectBoxAfter = await objectTab.boundingBox();
  const correctionBoxAfter = await correctionTab.boundingBox();
  expect(objectBoxAfter).not.toBeNull();
  expect(correctionBoxAfter).not.toBeNull();
  expect(Math.round(objectBoxAfter!.height)).toBe(Math.round(objectBoxBefore!.height));
  expect(Math.round(correctionBoxAfter!.height)).toBe(Math.round(correctionBoxBefore!.height));
  expect(Math.round(objectBoxAfter!.width)).toBe(Math.round(objectBoxBefore!.width));
  expect(Math.round(correctionBoxAfter!.width)).toBe(Math.round(correctionBoxBefore!.width));
  await page.getByLabel('启用校正').check();
  await page.getByLabel('结构').selectOption('lead');
  await page.keyboard.press('Escape');

  await expect.poll(async () => {
    const text = ((await phaseMarginValue.textContent()) ?? '').trim();
    return text !== '--' && text !== initialPhaseMargin;
  }).toBe(true);
  await expect(page.getByText('校正后开环', { exact: true })).toBeVisible();
  await expect(page.getByText('校正装置', { exact: true })).toBeVisible();
  const rootSourceGroup = page.getByRole('group', { name: '根轨迹来源' });
  const nyquistSourceGroup = page.getByRole('group', { name: 'Nyquist 来源' });
  await expect(rootSourceGroup.getByRole('button', { name: '校正后根轨迹' })).toHaveAttribute('aria-pressed', 'true');
  await rootSourceGroup.getByRole('button', { name: '未校正根轨迹' }).click();
  await expect(rootSourceGroup.getByRole('button', { name: '未校正根轨迹' })).toHaveAttribute('aria-pressed', 'true');
  await expect(nyquistSourceGroup.getByRole('button', { name: '校正后开环' })).toHaveAttribute('aria-pressed', 'true');
  await nyquistSourceGroup.getByRole('button', { name: '未校正开环' }).click();
  await expect(nyquistSourceGroup.getByRole('button', { name: '未校正开环' })).toHaveAttribute('aria-pressed', 'true');

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
