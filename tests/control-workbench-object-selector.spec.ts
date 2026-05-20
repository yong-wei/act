import { expect, test } from '@playwright/test';

test('comprehensive simulation workbench object selector is collapsible and safe', async ({ page }) => {
  await page.goto('/interactive-learning/control-workbench?mode=explore&preset=classic-four-view', {
    waitUntil: 'networkidle',
  });

  await expect(page.getByRole('heading', { name: '综合仿真工作台' }).first()).toBeVisible();

  const selector = page.getByRole('button', { name: /对象选择/ }).first();
  await expect(selector).toHaveAttribute('aria-expanded', 'false');

  await selector.click();
  await expect(selector).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('典型对象').first()).toBeVisible();
  await expect(page.locator('.katex').first()).toBeVisible();
  const selectedObject = page.getByRole('button', { name: /二阶欠阻尼对象 当前/ });
  await expect(selectedObject).toContainText('当前');

  await page.getByRole('button', { name: /邮轮横摇黑箱对象/ }).click();
  await expect(page.getByRole('status')).toContainText('当前预设只支持公开传递函数的白箱对象');
  await expect(selectedObject).toContainText('当前');
});
