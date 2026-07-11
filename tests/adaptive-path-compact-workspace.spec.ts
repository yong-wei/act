import { expect, test, type Page } from '@playwright/test';

const executionHref = '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution';

async function openModule(page: Page, moduleId: 'current-path' | 'learning-record') {
  const moduleElement = page.locator(`[data-adaptive-path-module="${moduleId}"]`);
  await expect(moduleElement).toBeVisible();
  if (await moduleElement.getAttribute('data-adaptive-path-module-state') !== 'expanded') {
    await moduleElement.getByRole('button').first().click();
  }
  await expect(moduleElement).toHaveAttribute('data-adaptive-path-module-state', 'expanded');
  return moduleElement;
}

async function expectNoHorizontalOverflow(page: Page, moduleId: 'current-path' | 'learning-record') {
  const moduleElement = await openModule(page, moduleId);
  const metrics = await moduleElement.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      moduleLeft: rect.left,
      moduleRight: rect.right,
      viewportWidth: window.innerWidth,
    };
  });
  expect(metrics.documentScrollWidth).toBe(metrics.documentClientWidth);
  expect(metrics.moduleLeft).toBeGreaterThanOrEqual(0);
  expect(metrics.moduleRight).toBeLessThanOrEqual(metrics.viewportWidth);
}

test('compact path execution modules remain inside 320px, 375px, and desktop viewports', async ({ page }) => {
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(executionHref, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-adaptive-path-execution-surface="active-route"]')).toBeVisible();

    await expectNoHorizontalOverflow(page, 'current-path');
    await expectNoHorizontalOverflow(page, 'learning-record');
  }
});
