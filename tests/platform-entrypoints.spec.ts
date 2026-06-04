import { expect, test } from '@playwright/test';

const studentEntryLabels = [
  '虚拟仿真',
  '知识资源',
  '竞技场',
  '控制工作台',
  '自适应学习',
  '互动学习',
] as const;

test('homepage exposes the shared student entry drawer at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');

  await page.getByRole('button', { name: '打开平台入口菜单' }).click();
  const mobileNav = page.getByRole('navigation', { name: '移动平台入口菜单' });
  await expect(mobileNav).toBeVisible();

  for (const label of studentEntryLabels) {
    await expect(mobileNav.getByRole('link', { name: label })).toBeVisible();
  }
});

test('login page keeps the shared credential form on desktop and 320px callback routes', async ({ page }) => {
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/login?callbackUrl=%2Fprofile');

    await expect(page.locator('[data-commercial-student-entry-route="/login"]')).toBeVisible();
    await expect(page.locator('[data-auth-callback-target="/profile"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: '账号登录' })).toBeVisible();
    await expect(page.getByPlaceholder('学号/工号')).toBeVisible();
    await expect(page.getByPlaceholder('密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  }
});

test('profile unauthenticated state links back to login with profile callback at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/profile');

  await expect(page.getByText('请先登录')).toBeVisible();
  await expect(page.getByRole('link', { name: '前往登录' })).toHaveAttribute(
    'href',
    '/login?callbackUrl=%2Fprofile',
  );
});

test('simulations hub remains reachable without opening 3D runtimes', async ({ page }) => {
  await page.goto('/simulations', { waitUntil: 'networkidle' });

  await expect(page.locator('[data-simulation-entry-map="scenario-fleet"]')).toBeVisible();
  await expect(page.locator('[data-simulation-scenario-card]')).toHaveCount(7);
  await expect(page.locator('[data-simulation-scenario-fit]')).toHaveCount(7);
  await expect(page.locator('[data-simulation-task-status]')).toHaveCount(7);
  await expect(page.getByRole('heading', { name: '虚拟仿真实验室' })).toBeVisible();
  await expect(page.getByText('7 个仿真场景')).toBeVisible();
  await expect(page.getByRole('heading', { name: '052D驱逐舰' })).toBeVisible();
});
