import { expect, test } from '@playwright/test';

test('courses page should expose L-sum premium course entry', async ({ page }) => {
  await page.goto('/interactive-learning/courses', { waitUntil: 'networkidle' });

  const premiumLink = page.locator('a[href="/interactive-learning/courses/lsum-design-feasible-domain"]:visible').first();
  await expect(premiumLink).toBeVisible();
  await expect(premiumLink).toContainText('L-sum：设计可行域——让约束成为指南针');
  await expect(premiumLink).toHaveAttribute('href', '/interactive-learning/courses/lsum-design-feasible-domain');

  await page.goto('/interactive-learning/courses/lsum-design-feasible-domain', { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/interactive-learning\/courses\/lsum-design-feasible-domain$/);
  await expect(page.getByRole('heading', { name: 'L-sum：设计可行域——让约束成为指南针' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '输入课堂码加入课堂' })).toBeVisible();
});

test('L-sum demo student route should show knowledge drawer and inline AI entry', async ({ page }) => {
  await page.goto('/interactive-learning/courses/lsum-design-feasible-domain/student/demo?step=step-10', {
    waitUntil: 'networkidle',
  });

  await expect(page.getByRole('heading', { name: 'L-sum：设计可行域——让约束成为指南针' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '知识卡片' })).toBeVisible();
  await expect(page.getByRole('button', { name: '打开控灵助手' })).toBeVisible();
});
