import { expect, test } from '@playwright/test';

const handoutPath = '/interactive-learning/lessons/1-3/handout-print';
const coursePath = '/interactive-learning/courses/unit-1-3-parameter-pole-migration?media=1-3-audio&t=12&sha=aaaaaaaaaaaa';
const stepPath = '/interactive-learning/courses/unit-1-3-parameter-pole-migration/student/demo?step=step-04';

test.describe('anchored resource binding navigation', () => {
  test('handout print exposes stable heading ids', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const response = await page.goto(handoutPath);
    expect(response?.ok() ?? response?.status() === 304).toBeTruthy();
    const heading = page.locator('h2[id^="h"], h3[id^="h"]').first();
    await expect(heading).toBeVisible({ timeout: 20_000 });
    const headingId = await heading.getAttribute('id');
    expect(headingId).toBeTruthy();
    await page.goto(`${handoutPath}#${headingId}`);
    await expect(heading).toBeInViewport();
    expect(errors.filter((line) => !/favicon|hydration|401|Unauthorized|net::ERR/i.test(line))).toEqual([]);
  });

  test('course media deep link and step query load without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const media = await page.goto(coursePath);
    expect(media?.ok() ?? media?.status() === 304).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('media=1-3-audio');
    expect(page.url()).toContain('t=12');

    const step = await page.goto(stepPath);
    expect(step?.ok() ?? step?.status() === 304).toBeTruthy();
    expect(page.url()).toContain('step=step-04');
    expect(errors.filter((line) => !/favicon|hydration|401|Unauthorized|net::ERR/i.test(line))).toEqual([]);
  });
});
