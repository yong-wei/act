import { expect, test } from '@playwright/test';

test('cruise simulation course mode should expose speed controls', async ({ page }) => {
  await page.goto(
    '/simulations/cruise?courseMode=cruise-boppps&role=student&sessionId=demo&embed=1',
    { waitUntil: 'domcontentloaded' }
  );

  await expect(page.getByText('邮轮模型加载中')).toBeHidden({ timeout: 20000 });
  await expect(page.getByRole('button', { name: '减速' })).toBeVisible();
  await expect(page.getByRole('button', { name: '加速' })).toBeVisible();
});

test('student classroom page should show precise engineering-target guidance copy', async ({ page }) => {
  await page.goto('/interactive-learning/courses/cruise-comfort-boppps/student/demo?step=engineering-target', {
    waitUntil: 'domcontentloaded',
  });

  await expect(
    page.getByText('在仿真界面右侧面板的「评估」标签下，填写性能指标约束')
  ).toBeVisible();
});
