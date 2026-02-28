import { expect, test } from '@playwright/test';

test('courses page should expose premium cruise classroom flow at first section', async ({ page }) => {
  await page.goto('/interactive-learning/courses', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: '精品课程' })).toBeVisible();

  const premiumLink = page.getByRole('link', { name: /柔性之海：豪华邮轮舒适度控制课堂实录/i });
  await expect(premiumLink).toBeVisible();

  await premiumLink.click();
  await expect(page).toHaveURL(/\/interactive-learning\/courses\/cruise-comfort-boppps$/);
  await expect(page.getByRole('heading', { name: '柔性之海：豪华邮轮舒适度控制' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '输入课堂码加入课堂' })).toBeVisible();
  await expect(page.getByPlaceholder('输入6位课堂码')).toBeVisible();
  await expect(page.getByText('课堂视角')).toHaveCount(0);
});

test('student demo route should be isolated without teacher-student split screen', async ({ page }) => {
  await page.goto('/interactive-learning/courses/cruise-comfort-boppps/student/demo', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '柔性之海：豪华邮轮舒适度控制' })).toBeVisible();
  await expect(page.getByText('演示模式：可自由切换环节')).toBeVisible();
  await expect(page.getByText('课堂视角')).toHaveCount(0);
});
