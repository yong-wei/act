import { expect, test } from '@playwright/test';

const themeScenarios = [
  { name: 'stored light', storedTheme: 'light', systemTheme: 'dark', expectedTheme: 'light' },
  { name: 'stored dark', storedTheme: 'dark', systemTheme: 'light', expectedTheme: 'dark' },
  { name: 'system fallback', storedTheme: null, systemTheme: 'light', expectedTheme: 'light' },
] as const;

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 320, height: 800 },
] as const;

const themeConsoleError = /script tag while rendering React component|hydration (failed|mismatch)|hydrated but/i;

for (const viewport of viewports) {
  for (const scenario of themeScenarios) {
    test(`${viewport.name}: ${scenario.name} initializes before hydration without a theme regression`, async ({ page }) => {
      const relevantConsoleErrors: string[] = [];

      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: scenario.systemTheme });
      await page.addInitScript(({ storedTheme }) => {
        if (storedTheme) {
          localStorage.setItem('ai-obe-theme', storedTheme);
        } else {
          localStorage.removeItem('ai-obe-theme');
        }
      }, scenario);
      page.on('console', (message) => {
        if (message.type() === 'error' && themeConsoleError.test(message.text())) {
          relevantConsoleErrors.push(message.text());
        }
      });
      page.on('pageerror', (error) => {
        if (themeConsoleError.test(error.message)) {
          relevantConsoleErrors.push(error.message);
        }
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('#theme-init')).toHaveCount(1);

      await page.waitForLoadState('networkidle');
      await page.waitForFunction((theme) => {
        const root = document.documentElement;
        return root.classList.contains(theme) && root.style.colorScheme === theme;
      }, scenario.expectedTheme);
      const hydratedState = await page.evaluate(() => ({
        className: document.documentElement.className,
        colorScheme: document.documentElement.style.colorScheme,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));

      expect(hydratedState.className.split(' ')).toContain(scenario.expectedTheme);
      expect(hydratedState.colorScheme).toBe(scenario.expectedTheme);
      expect(hydratedState.scrollWidth).toBeLessThanOrEqual(hydratedState.clientWidth);
      expect(relevantConsoleErrors).toEqual([]);
    });
  }
}
