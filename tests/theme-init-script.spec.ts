import { expect, test, type Page } from '@playwright/test';

import { verifiedCredentials } from './verified-test-credentials';

const themeScenarios = [
  { name: 'stored light', storedTheme: 'light', systemTheme: 'dark', expectedTheme: 'light' },
  { name: 'stored dark', storedTheme: 'dark', systemTheme: 'light', expectedTheme: 'dark' },
  { name: 'system fallback', storedTheme: null, systemTheme: 'light', expectedTheme: 'light' },
] as const;

const routes = ['/', '/login'] as const;

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 320, height: 800 },
] as const;

const themeConsoleError = /script tag while rendering React component|hydration (failed|mismatch)|hydrated but/i;
const studentAccount = verifiedCredentials('student');

type RootThemeState = {
  classes: string[];
  colorScheme: string;
  stored: string | null;
};

async function primeTheme(
  page: Page,
  storedTheme: string | null,
  systemTheme: 'light' | 'dark',
) {
  await page.emulateMedia({ colorScheme: systemTheme });
  await page.addInitScript(({ storedTheme: nextStoredTheme }) => {
    if (nextStoredTheme) {
      localStorage.setItem('ai-obe-theme', nextStoredTheme);
    } else {
      localStorage.removeItem('ai-obe-theme');
    }
  }, { storedTheme });
}

async function readRootTheme(page: Page): Promise<RootThemeState> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return {
      classes: ['light', 'dark'].filter((name) => root.classList.contains(name)),
      colorScheme: root.style.colorScheme,
      stored: localStorage.getItem('ai-obe-theme'),
    };
  });
}

async function assertFirstFrameTheme(page: Page, expectedTheme: 'light' | 'dark') {
  await expect(page.locator('#theme-init')).toHaveCount(1);
  const firstFrame = await readRootTheme(page);
  expect(firstFrame.classes).toEqual([expectedTheme]);
  expect(firstFrame.colorScheme).toBe(expectedTheme);
}

for (const viewport of viewports) {
  for (const route of routes) {
    for (const scenario of themeScenarios) {
      test(`${viewport.name} ${route}: ${scenario.name} initializes before hydration without a theme regression`, async ({ page }) => {
        const relevantConsoleErrors: string[] = [];

        await page.setViewportSize(viewport);
        await primeTheme(page, scenario.storedTheme, scenario.systemTheme);
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

        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await assertFirstFrameTheme(page, scenario.expectedTheme);

        await page.waitForLoadState('networkidle');
        await page.waitForFunction((theme) => {
          const root = document.documentElement;
          return root.classList.contains(theme)
            && !root.classList.contains(theme === 'light' ? 'dark' : 'light')
            && root.style.colorScheme === theme;
        }, scenario.expectedTheme);
        const hydratedState = await page.evaluate(() => ({
          className: document.documentElement.className,
          colorScheme: document.documentElement.style.colorScheme,
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          stored: localStorage.getItem('ai-obe-theme'),
        }));

        expect(hydratedState.className.split(' ')).toContain(scenario.expectedTheme);
        expect(hydratedState.className.split(' ').filter((name) => name === 'light' || name === 'dark')).toEqual([
          scenario.expectedTheme,
        ]);
        expect(hydratedState.colorScheme).toBe(scenario.expectedTheme);
        expect(hydratedState.scrollWidth).toBeLessThanOrEqual(hydratedState.clientWidth);
        expect(relevantConsoleErrors).toEqual([]);
        if (scenario.storedTheme) {
          expect(hydratedState.stored).toBe(scenario.storedTheme);
        }
      });
    }
  }
}

for (const expectedTheme of ['light', 'dark'] as const) {
  test(`login and sign-out keep ${expectedTheme} first-frame theme`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await primeTheme(page, expectedTheme, expectedTheme === 'light' ? 'dark' : 'light');

    await page.goto('/login?callbackUrl=%2Fprofile', { waitUntil: 'domcontentloaded' });
    await assertFirstFrameTheme(page, expectedTheme);
    await expect(page.getByRole('heading', { name: '账号登录' })).toBeVisible();

    await page.getByPlaceholder('学号/工号').fill(studentAccount.loginId);
    await page.getByPlaceholder('密码').fill(studentAccount.password);
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL(/\/profile/);
    const afterLogin = await readRootTheme(page);
    expect(afterLogin.classes).toEqual([expectedTheme]);
    expect(afterLogin.colorScheme).toBe(expectedTheme);
    expect(afterLogin.stored).toBe(expectedTheme);

    await page.locator('[data-platform-layer="account"] button').first().click();
    await page.getByRole('button', { name: '退出登录' }).click();
    await page.waitForURL(/\/login/);
    await assertFirstFrameTheme(page, expectedTheme);
    expect((await readRootTheme(page)).stored).toBe(expectedTheme);
    await expect(page.getByRole('heading', { name: '账号登录' })).toBeVisible();
  });
}
