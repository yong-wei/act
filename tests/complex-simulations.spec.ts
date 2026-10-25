import { test, expect } from '@playwright/test';

import { expectRenderedCanvas } from './simulation-canvas-assertions';

test.describe.configure({ mode: 'serial' });

const pages = [
  {
    path: '/simulations/dredger',
    title: '挖泥船工况切换实验',
    startName: /开始/,
    runningText: '运行中',
  },
  {
    path: '/simulations/drilling',
    title: '钻井平台动力定位实验',
    startName: /开始/,
    runningText: '运行中',
  },
  {
    path: '/simulations/icebreaker',
    title: '破冰船吊舱与冰区实验',
    startName: /运行/,
    runningText: '暂停',
  },
  {
    path: '/simulations/container',
    title: '集装箱船航速与准点实验',
    startName: /开始仿真/,
    runningText: '暂停',
  },
  {
    path: '/simulations/lng',
    title: '液化气船大惯性操纵实验',
    startName: /开始/,
    runningText: '暂停',
  },
  {
    path: '/simulations/cruise',
    title: '邮轮舒适性操纵实验',
    startName: /开始仿真/,
    runningText: '暂停',
  },
];

for (const scenario of pages) {
  test(`${scenario.path} loads and starts without runtime errors`, async ({ page }) => {
    test.setTimeout(180000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.goto(scenario.path, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: scenario.title })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30000 });
    await expectRenderedCanvas(page);

    await page.getByRole('button', { name: scenario.startName }).first().click();
    await expect(page.getByText(scenario.runningText).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    await expectRenderedCanvas(page);

    expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
}

test('/simulations/cruise keeps a nonblank 3D canvas on mobile', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/simulations/cruise', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '邮轮舒适性操纵实验' })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30000 });
  await expectRenderedCanvas(page);

  await page.getByRole('button', { name: /开始仿真/ }).first().click();
  await expect(page.getByText('暂停').first()).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(3000);
  await expectRenderedCanvas(page);
});
