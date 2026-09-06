import { expect, test } from '@playwright/test';

test.describe('protected-route login redirects preserve the full request target (Issue #1936)', () => {
  for (const target of [
    '/dashboard?tab=evidence',
    '/teacher/lesson-plans',
    '/playlists/new?nodeId=node-1',
  ]) {
    test(`unauthenticated visit to ${target} lands on /login with the full target as callbackUrl`, async ({ page }) => {
      await page.goto(target, { waitUntil: 'domcontentloaded' });

      const url = new URL(page.url());
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('callbackUrl')).toBe(target);
    });
  }

  test('the login page surfaces the preserved callback target', async ({ page }) => {
    await page.goto('/dashboard?tab=evidence', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/callbackUrl=%2Fdashboard%3Ftab%3Devidence/);
  });
});
