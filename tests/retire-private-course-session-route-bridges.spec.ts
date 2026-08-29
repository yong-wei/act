import { expect, test, type Page } from '@playwright/test';

const slug = 'unit-1-2-modeling-from-object-to-system';

async function expectRetiredCourseNotFound(page: Page, pathname: string) {
  await expect(page.locator('[data-platform-route-recovery="global-not-found"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(new URL(page.url()).pathname).toBe(pathname);
  expect(page.url()).not.toContain('/classroom/');
}

test.describe('retired private course session routes', () => {
  test('unknown routeSegment is not found and does not redirect to another course', async ({ page }) => {
    const pathname = '/interactive-learning/courses/not-a-registered-course';
    await page.goto(pathname, {
      waitUntil: 'domcontentloaded',
    });

    await expectRetiredCourseNotFound(page, pathname);
    expect(page.url()).not.toContain('/interactive-learning/courses/unit-');
  });

  test('retired private folder slug is not found', async ({ page }) => {
    const pathname = '/interactive-learning/courses/unit-1-1-laplace-transfer-function';
    await page.goto(pathname, {
      waitUntil: 'domcontentloaded',
    });

    await expectRetiredCourseNotFound(page, pathname);
    expect(page.url()).not.toContain('/interactive-learning/courses/unit-1-1-see-the-full-picture');
  });

  test('canonical 1-2 entry remains on the shared public URL', async ({ page }) => {
    const response = await page.goto(`/interactive-learning/courses/${slug}`, {
      waitUntil: 'domcontentloaded',
    });

    expect(response?.ok()).toBeTruthy();
    expect(new URL(page.url()).pathname).toBe(`/interactive-learning/courses/${slug}`);
    await expect(page.locator('[data-course-entry-shell="app-shell"]').filter({ visible: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
