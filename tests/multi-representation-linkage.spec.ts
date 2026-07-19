import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

type SelectAppearance = {
  color: string;
  backgroundColor: string;
  borderColor: string;
  boxShadow: string;
  opacity: string;
};

async function selectAppearance(locator: Locator): Promise<SelectAppearance> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      opacity: style.opacity,
    };
  });
}

function parseRgb(color: string): [number, number, number] {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) {
    throw new Error(`Unsupported computed color: ${color}`);
  }
  return channels as [number, number, number];
}

function relativeLuminance(color: string): number {
  const linear = parseRgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function expectReadable(appearance: SelectAppearance, minimum = 4.5): void {
  expect(contrastRatio(appearance.color, appearance.backgroundColor)).toBeGreaterThanOrEqual(minimum);
}

async function setTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((activeTheme) => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(activeTheme);
  }, theme);
}

async function waitForAnimations(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    await Promise.allSettled(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
  });
}

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
  await expect(page.getByRole('heading', { name: 'Nyquist 图' })).toBeVisible();
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
  expect(Math.abs(Math.round(objectBoxAfter!.width) - Math.round(objectBoxBefore!.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(Math.round(correctionBoxAfter!.width) - Math.round(correctionBoxBefore!.width))).toBeLessThanOrEqual(1);
  await page.getByLabel('启用校正').check();
  const structureSelect = page.getByLabel('结构');
  await structureSelect.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('parameter-drawer-structure-popup')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: '超前', exact: true })).toHaveAttribute('data-highlighted', '');
  await page.keyboard.press('Enter');
  await expect(structureSelect).toContainText('超前');
  await expect(structureSelect).toBeFocused();
  await page.keyboard.press('Escape');

  await expect.poll(async () => {
    const text = ((await phaseMarginValue.textContent()) ?? '').trim();
    return text !== '--' && text !== initialPhaseMargin;
  }).toBe(true);
  const bodeSourceGroup = page.getByRole('group', { name: 'Bode 曲线' });
  const rootSourceGroup = page.getByRole('group', { name: '根轨迹来源' });
  const nyquistSourceGroup = page.getByRole('group', { name: 'Nyquist 来源' });
  await expect(bodeSourceGroup.getByRole('button', { name: '校正后开环' })).toHaveAttribute('aria-pressed', 'true');
  await expect(bodeSourceGroup.getByRole('button', { name: '校正装置' })).toHaveAttribute('aria-pressed', 'true');
  await rootSourceGroup.getByRole('button', { name: '校正后根轨迹' }).click();
  await expect(rootSourceGroup.getByRole('button', { name: '校正后根轨迹' })).toHaveAttribute('aria-pressed', 'true');
  await rootSourceGroup.getByRole('button', { name: '未校正根轨迹' }).click();
  await expect(rootSourceGroup.getByRole('button', { name: '未校正根轨迹' })).toHaveAttribute('aria-pressed', 'true');
  await nyquistSourceGroup.getByRole('button', { name: '校正后开环' }).click();
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

test('parameter drawer Radix selects expose readable popup and keyboard behavior in both themes', async ({ page }, testInfo) => {
  await page.goto('/interactive-learning/control-workbench?preset=classic-four-view', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('metric-PM').locator('.premium-lesson-title')).not.toHaveText('--');
  await page.getByRole('button', { name: '参数抽屉' }).click();

  const responseSelect = page.getByTestId('parameter-drawer-response-select');
  const correctionTab = page.getByTestId('parameter-drawer-correction-tab');
  await expect(responseSelect).toHaveRole('combobox');
  await expect(responseSelect).toHaveAccessibleName('响应类型');
  await expect(responseSelect).toContainText('阶跃响应');

  for (const theme of ['dark', 'light'] as const) {
    await setTheme(page, theme);
    await responseSelect.click({ force: true });
    const popup = page.getByTestId('parameter-drawer-response-popup');
    await expect(popup).toBeVisible();
    const options = popup.getByRole('option');
    await expect(options).toHaveCount(3);

    const popupAppearance = await selectAppearance(popup);
    expectReadable(popupAppearance);
    for (const option of await options.all()) {
      expectReadable(await selectAppearance(option));
    }

    const selectedOption = popup.getByRole('option', { name: '阶跃响应' });
    await expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    const selectedAppearance = await selectAppearance(selectedOption);
    expectReadable(selectedAppearance);
    expect(contrastRatio(selectedAppearance.backgroundColor, popupAppearance.backgroundColor)).toBeGreaterThanOrEqual(1.2);

    const hoveredOption = popup.getByRole('option', { name: '斜坡响应' });
    await hoveredOption.hover({ force: true });
    await expect(hoveredOption).toHaveAttribute('data-highlighted', '');
    const hoveredAppearance = await selectAppearance(hoveredOption);
    expectReadable(hoveredAppearance);
    expect(contrastRatio(hoveredAppearance.backgroundColor, popupAppearance.backgroundColor)).toBeGreaterThanOrEqual(1.15);
    await waitForAnimations(popup);
    await page.screenshot({
      path: testInfo.outputPath(`response-popup-${theme}.png`),
      fullPage: true,
    });

    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await expect(page.getByRole('dialog'), `drawer should remain open after closing the ${theme} response popup`).toBeVisible();
  }

  await responseSelect.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('parameter-drawer-response-popup')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: '脉冲响应' })).toHaveAttribute('data-highlighted', '');
  await page.keyboard.press('Enter');
  await expect(responseSelect).toContainText('脉冲响应');
  await expect(responseSelect).toBeFocused();
  const responseFocusedAppearance = await selectAppearance(responseSelect);
  expectReadable(responseFocusedAppearance);
  expect(contrastRatio(responseFocusedAppearance.borderColor, responseFocusedAppearance.backgroundColor)).toBeGreaterThanOrEqual(1.4);
  expect(responseFocusedAppearance.boxShadow).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('parameter-drawer-response-popup')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('parameter-drawer-response-popup')).toBeHidden();
  await expect(responseSelect).toContainText('脉冲响应');

  await correctionTab.click({ force: true });
  const structureSelect = page.getByTestId('parameter-drawer-structure-select');
  await expect(structureSelect).toHaveRole('combobox');
  await expect(structureSelect).toHaveAccessibleName('结构');
  await expect(structureSelect).toBeDisabled();
  for (const theme of ['dark', 'light'] as const) {
    await setTheme(page, theme);
    const disabledAppearance = await selectAppearance(structureSelect);
    expectReadable(disabledAppearance, 3);
    expect(contrastRatio(disabledAppearance.borderColor, disabledAppearance.backgroundColor)).toBeGreaterThanOrEqual(1.2);
    expect(Number(disabledAppearance.opacity)).toBeLessThan(1);
  }
  await expect(structureSelect).toContainText('PID');
  await structureSelect.click({ force: true });
  await expect(page.getByTestId('parameter-drawer-structure-popup')).toHaveCount(0);
  await expect(structureSelect).toContainText('PID');

  await page.getByLabel('启用校正').check({ force: true });
  await expect(structureSelect).toBeEnabled();
  for (const theme of ['dark', 'light'] as const) {
    await setTheme(page, theme);
    await structureSelect.click({ force: true });
    const popup = page.getByTestId('parameter-drawer-structure-popup');
    await expect(popup).toBeVisible();
    const options = popup.getByRole('option');
    await expect(options).toHaveCount(6);

    const popupAppearance = await selectAppearance(popup);
    expectReadable(popupAppearance);
    for (const option of await options.all()) {
      expectReadable(await selectAppearance(option));
    }

    const selectedOption = popup.getByRole('option', { name: 'PID', exact: true });
    await expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    const selectedAppearance = await selectAppearance(selectedOption);
    expectReadable(selectedAppearance);
    expect(contrastRatio(selectedAppearance.backgroundColor, popupAppearance.backgroundColor)).toBeGreaterThanOrEqual(1.2);

    const hoveredOption = popup.getByRole('option', { name: '滞后', exact: true });
    await hoveredOption.hover({ force: true });
    await expect(hoveredOption).toHaveAttribute('data-highlighted', '');
    const hoveredAppearance = await selectAppearance(hoveredOption);
    expectReadable(hoveredAppearance);
    expect(contrastRatio(hoveredAppearance.backgroundColor, popupAppearance.backgroundColor)).toBeGreaterThanOrEqual(1.15);
    await waitForAnimations(popup);
    await page.screenshot({
      path: testInfo.outputPath(`structure-popup-${theme}.png`),
      fullPage: true,
    });

    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await expect(page.getByRole('dialog'), `drawer should remain open after closing the ${theme} structure popup`).toBeVisible();
  }

  await structureSelect.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('parameter-drawer-structure-popup')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: '超前', exact: true })).toHaveAttribute('data-highlighted', '');
  await page.keyboard.press('Enter');
  await expect(structureSelect).toContainText('超前');
  await expect(structureSelect).toBeFocused();
  const structureFocusedAppearance = await selectAppearance(structureSelect);
  expectReadable(structureFocusedAppearance);
  expect(contrastRatio(structureFocusedAppearance.borderColor, structureFocusedAppearance.backgroundColor)).toBeGreaterThanOrEqual(1.4);
  expect(structureFocusedAppearance.boxShadow).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('parameter-drawer-structure-popup')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('parameter-drawer-structure-popup')).toBeHidden();
  await expect(structureSelect).toContainText('超前');
});

test('parameter drawer keeps rapid select Escape cycles isolated from the drawer', async ({ page }) => {
  await page.goto('/interactive-learning/control-workbench?preset=classic-four-view', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('metric-PM').locator('.premium-lesson-title')).not.toHaveText('--');
  await page.getByRole('button', { name: '参数抽屉' }).click();

  const drawer = page.getByRole('dialog');
  const responseSelect = page.getByTestId('parameter-drawer-response-select');
  const responsePopup = page.getByTestId('parameter-drawer-response-popup');

  for (let cycle = 0; cycle < 5; cycle += 1) {
    await responseSelect.click();
    await expect(responsePopup, `response popup should open in cycle ${cycle + 1}`).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(responsePopup, `response popup should close in cycle ${cycle + 1}`).toBeHidden();
    await expect(drawer, `drawer should remain open in cycle ${cycle + 1}`).toBeVisible();
    await expect(responseSelect, `focus should return in cycle ${cycle + 1}`).toBeFocused();
  }

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});
