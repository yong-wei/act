import { test, expect } from '@playwright/test';

import { expectRenderedCanvas } from './simulation-canvas-assertions';

test.describe.configure({ mode: 'serial' });

const pages = [
  {
    path: '/simulations/dredger',
    title: '天鲸号挖泥船动力定位仿真',
    startName: /开始/,
    runningText: '运行中',
  },
  {
    path: '/simulations/drilling',
    title: '海洋石油981 深水钻井平台',
    startName: /开始/,
    runningText: '运行中',
  },
  {
    path: '/simulations/icebreaker',
    title: '雪龙2号极地科考破冰船仿真',
    startName: /运行/,
    runningText: '暂停',
  },
  {
    path: '/simulations/container',
    title: 'MSC Tessa 超大型集装箱船',
    startName: /开始仿真/,
    runningText: '暂停',
  },
  {
    path: '/simulations/lng',
    title: '长恒系列 LNG 运输船',
    startName: /开始/,
    runningText: '暂停',
  },
  {
    path: '/simulations/cruise',
    title: '邮轮仿真',
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
    await expect(page.getByText(scenario.title)).toBeVisible({ timeout: 30000 });
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
  await expect(page.getByText('邮轮仿真')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30000 });
  await expectRenderedCanvas(page);

  await page.getByRole('button', { name: /开始仿真/ }).first().click();
  await expect(page.getByText('暂停').first()).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(3000);
  await expectRenderedCanvas(page);
});
