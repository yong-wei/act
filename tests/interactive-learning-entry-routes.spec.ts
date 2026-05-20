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

  await page.goto('/interactive-learning/cross-domain-exploration', { waitUntil: 'networkidle' });
  await expect(page.getByRole('main').getByRole('heading', { name: '跨域探索' })).toBeVisible();
  await expect(page.getByText('正在加载跨域探索组件...')).toBeHidden();

  const linkageCard = page.getByRole('link', { name: /综合仿真工作台/i });
  await expect(linkageCard).toBeVisible();
  await expect(linkageCard).toContainText('综合仿真工作台');
  await expect(linkageCard).toHaveAttribute('href', '/interactive-learning/control-workbench?mode=explore&preset=classic-four-view');

  await page.goto('/interactive-learning/courses', { waitUntil: 'networkidle' });
  await expect(page.getByRole('main').getByRole('heading', { name: '互动课程' })).toBeVisible();

  await page.goto('/interactive-learning/chapter-components', { waitUntil: 'networkidle' });
  await expect(page.getByRole('main').getByRole('heading', { name: '各章节互动组件' })).toBeVisible();
});
