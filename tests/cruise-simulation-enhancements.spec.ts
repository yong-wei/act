import { expect, test } from '@playwright/test';

test('cruise simulation course mode should expose speed controls', async ({ page }) => {
  test.skip(
    true,
    'React Three Fiber 8 simulation runtime is isolated until the React/Three upgrade lane restores Next 16 dev coverage.',
  );

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

  await expect(page.getByRole('main').getByText('把工程需求翻译为可计算约束。')).toBeVisible();
  await expect(page.getByRole('main').getByText('舒适线和安全红线要进入约束表达。')).toBeVisible();
});
