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

  // 匿名仿真验收不包含需要登录的全局 AI 会话列表。
  await page.route('**/api/ai/sessions', (route) => route.fulfill({
    json: { conversations: [] },
  }));

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
  // body.innerText 会在重 3D 页面上强制整页排版，单次轮询就可能超过 10s；只读时间读数节点。
  const timeReadout = scene.locator('[data-destroyer-readout="time"]');
  await expect
    .poll(
      async () => Number(((await timeReadout.textContent()) ?? '').replace(/[^\d.]/g, '')),
      { timeout: 90000 },
    )
    // 1× 下无头软件渲染仅为实时的几分之一，只要求时钟确实在推进。
    .toBeGreaterThan(1);

  await expect(scene.getByText('舵角', { exact: true }).first()).toBeVisible();
  // 运行中每帧刷新读数与曲线，无头软件渲染下主线程饱和；暂停后再做画布像素校验。
  await scene.getByRole('button', { name: '暂停' }).click();
  await expect(scene.locator('[data-sim-status-strip="paused"]')).toBeVisible();

  await page.waitForTimeout(500);
  await expectRenderedCanvas(page);

  expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
