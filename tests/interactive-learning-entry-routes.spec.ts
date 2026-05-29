import { expect, test } from '@playwright/test';

test('interactive learning should provide three top-level entries and route to dedicated pages', async ({ page }) => {
  await page.goto('/interactive-learning', { waitUntil: 'networkidle' });

  const crossDomainEntry = page.getByRole('link', { name: /跨域探索/i });
  const coursesEntry = page.getByRole('link', { name: /互动课程/i });
  const chapterComponentsEntry = page.getByRole('link', { name: /各章节互动组件/i });

  await expect(crossDomainEntry).toBeVisible();
  await expect(coursesEntry).toBeVisible();
  await expect(chapterComponentsEntry).toBeVisible();
  await expect(crossDomainEntry).toHaveAttribute('href', '/interactive-learning/cross-domain-exploration');

  await page.route('**/api/resources', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: [
        {
          id: 'control-odyssey-v1',
          title: 'Control Odyssey',
          displayName: 'Control Odyssey: 穿越误差带',
          description: '用游戏化任务观察控制参数与误差带的关系。',
          registryId: 'control-odyssey-v1',
          type: 'INTERACTIVE',
          category: 'FUN_EXPLORATION',
          displayOrder: 10,
        },
        {
          id: 'ten-drops-game-v1',
          title: 'Ten Drops',
          displayName: 'Ten Drops',
          description: '用连锁反应游戏练习跨域状态判断。',
          registryId: 'ten-drops-game-v1',
          type: 'INTERACTIVE',
          category: 'FUN_EXPLORATION',
          displayOrder: 20,
        },
      ],
    });
  });

  await page.goto('/interactive-learning/cross-domain-exploration', { waitUntil: 'networkidle' });
  await expect(page.getByRole('main').getByRole('heading', { name: '跨域探索' })).toBeVisible();
  await expect(page.getByText('正在加载跨域探索组件...')).toBeHidden();

  const linkageCard = page.getByRole('link', { name: /综合仿真工作台/i });
  await expect(linkageCard).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Control Odyssey/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Ten Drops/i })).toBeVisible();

  await page.goto('/interactive-learning/courses', { waitUntil: 'networkidle' });
  await expect(page.getByRole('main').getByRole('heading', { name: '互动课程' })).toBeVisible();

  await page.goto('/interactive-learning/chapter-components', { waitUntil: 'networkidle' });
  await expect(page.getByRole('main').getByRole('heading', { name: '各章节互动组件' })).toBeVisible();
});
