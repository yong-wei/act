import { expect, test } from '@playwright/test';

test('incomplete cruise run fails closed without debrief conclusions', async ({ page }) => {
  await page.goto('/simulations/cruise', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '评估' }).click();
  const debrief = page.getByTestId('control-effect-debrief');
  await expect(debrief).toBeVisible();
  await expect(debrief.getByTestId('control-effect-debrief-unavailable')).toContainText('运行尚未完成');
  await expect(debrief).not.toContainText('转向超调要求');
  await expect(debrief).not.toContainText('表现良好');
  await expect(debrief).not.toContainText('需要关注');
  await expect(debrief).not.toContainText('优秀');
  await expect(debrief).not.toContainText('最优');
});
