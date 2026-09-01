import { expect, test } from '@playwright/test';

test('retired client-authored companion panel is not mounted on Arena workbench tasks', async ({ page }) => {
  for (const taskId of [
    'task-second-order-lead-pid',
    'task-ship-roll-mpc-hidden-scenarios',
    'task-cruise-roll-blackbox-identification',
  ]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/interactive-learning/control-workbench?arenaTask=${taskId}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('[aria-label="AI伴随探究"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '记录练习' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '生成介入建议' })).toHaveCount(0);
  }
});
