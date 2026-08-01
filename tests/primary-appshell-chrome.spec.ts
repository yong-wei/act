import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_ORDER } from '../src/lib/platform-appshell-contract';

type PrimaryAppShellRoute = {
  href: string;
  ready: string;
  auth?: boolean;
};

const routes = [
  { href: '/knowledge', ready: '[data-knowledge-data-map-surface="knowledge-graph"]' },
  { href: '/interactive-learning', ready: '[data-commercial-student-entry-route="/interactive-learning"]' },
  { href: '/assessment/adaptive-practice', ready: '[data-commercial-student-entry-route="/assessment/adaptive-practice"]' },
  { href: '/arena', ready: '[data-commercial-student-entry-route="/arena"]' },
  { href: '/simulations', ready: '[data-commercial-student-entry-route="/simulations"]' },
  { href: '/interactive-learning/control-workbench', ready: '[data-commercial-workspace="control-workbench"]' },
  { href: '/profile', ready: '[data-commercial-student-entry-route="/profile"]', auth: true },
] as const satisfies readonly PrimaryAppShellRoute[];

const widths = [1440, 1280, 1024, 768, 390, 320] as const;
const desktopWidths = new Set<number>([1440, 1280]);
const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/primary-appshell-chrome/playwright');

function buildMinimalProfilePayload() {
  return {
    user: {
      id: 'primary-appshell-student',
      name: 'Primary AppShell Student',
      email: 'primary-appshell-student@example.com',
      role: 'STUDENT',
    },
    profile: null,
    statistics: {
      totalSimulations: 0,
      completedMissions: 0,
      ethicalViolations: 0,
      totalSimulationTime: 0,
      averageScore: 0,
    },
    competency: {
      overallScore: 0,
      level: '证据不足',
      trend: '暂无趋势',
      strengths: [],
      weaknesses: [],
      dimensions: [],
    },
    recentActivity: { preview: [], grouped: [], total: 0 },
    missionProgress: { total: 0, completed: 0, unlocked: 0, locked: 0 },
    personalizedReinforcement: {
      resources: [],
      adaptivePractice: {
        estimatedAbility: null,
        confidenceInterval: null,
        weakAreas: [],
        recommendedFocus: [],
        questionCount: 0,
        actionUrl: '/assessment/adaptive-practice?intent=practice',
      },
    },
    evidenceStatus: {
      state: 'missing',
      confidence: {
        state: 'missing',
        level: 'low',
        score: 0,
        evidenceCount: 0,
        sourceCompleteness: 0,
      },
      evidenceWindow: { daysCovered: 0 },
      sourceCounts: {},
      statusMarkers: ['missing-source'],
      restrictedReason: null,
      staleReason: null,
      refreshedAt: null,
      generatedAt: new Date(0).toISOString(),
    },
    arenaPortfolio: {
      controllerCount: 0,
      identificationModels: [],
      submissionSummary: { total: 0, valid: 0, invalid: 0, pending: 0 },
      personalBestByTask: [],
      frequentFailureObjects: [],
      improvingMetrics: [],
      growth: {
        capabilityCoverage: { covered: 0, total: 0 },
        evidenceAvailable: false,
        weakCapabilities: [],
        improvingCapabilities: [],
        strongCapabilities: [],
        nextChallenges: [],
      },
      trainingSummary: {
        total: 0,
        previewCount: 0,
        recentRuns: [],
      },
    },
  };
}

async function addStudentSession(context: BrowserContext) {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: 'primary-appshell-student',
      email: 'primary-appshell-student@example.com',
      name: 'Primary AppShell Student',
      role: 'STUDENT',
    },
  });

  await context.addCookies([{
    name: 'next-auth.session-token',
    value: sessionToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  }]);
}

async function installRouteMocks(page: Page) {
  await page.route('**/api/user/profile', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(buildMinimalProfilePayload()),
    });
  });
}

async function assertNoHorizontalOverflow(page: Page, route: string, width: number) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
  const maxScrollWidth = Math.max(metrics.bodyScrollWidth, metrics.documentScrollWidth);
  expect(maxScrollWidth, `${route} ${width}px horizontal overflow`).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

async function assertHeaderChrome(page: Page, route: string) {
  const pair = page.locator('[data-app-shell-header-action-pair="theme-switch personal-center"]').first();
  await expect(pair, `${route} header action pair`).toBeVisible();
  await expect(page.locator('[data-app-shell-header-action="theme-switch"]').first()).toBeVisible();
  await expect(page.locator('[data-app-shell-header-action="personal-center"]').first()).toBeVisible();
  await expect(page.locator('nav[aria-label="Breadcrumb"]').first(), `${route} breadcrumb`).toBeVisible();

  const order = await page.evaluate(() => {
    const theme = document.querySelector('[data-app-shell-header-action="theme-switch"]');
    const personal = document.querySelector('[data-app-shell-header-action="personal-center"]');
    if (!theme || !personal) return 0;
    const position = theme.compareDocumentPosition(personal);
    return position & Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(order, `${route} header action order`).toBeTruthy();
}

async function assertNavigationState(page: Page, route: string, width: number) {
  await expect(page.locator('[data-platform-desktop-navigation="collapsible"]').first()).toBeVisible();
  await expect(page.locator('[data-platform-mobile-navigation="drawer"]').first()).toBeVisible();

  if (desktopWidths.has(width)) {
    await expect(page.locator('[data-app-shell-layout="collapsible"]').first(), `${route} desktop rail`).toBeVisible();
    await expect(page.locator('[data-shell-navigation-state="collapsed"]').first(), `${route} collapsed desktop rail`).toBeVisible();
    await expect(async () => {
      const expandButton = page
        .locator('[data-shell-navigation-state="collapsed"]')
        .getByRole('button', { name: '展开平台导航' });
      await expandButton.click();
      await expect(page.locator('[data-shell-navigation-state="expanded"]').first()).toBeVisible();
    }).toPass();
    await page
      .locator('[data-shell-navigation-state="expanded"]')
      .getByRole('button', { name: '收起平台导航' })
      .click();
    await expect(page.locator('[data-shell-navigation-state="collapsed"]').first(), `${route} restored desktop rail`).toBeVisible();
    return;
  }

  const openDrawer = page.getByRole('button', { name: '打开平台导航' });
  await expect(openDrawer, `${route} mobile drawer trigger`).toBeVisible();
  await expect(async () => {
    await openDrawer.click();
    await expect(page.locator('[data-app-shell-mobile-drawer="open"]').first(), `${route} open drawer`).toBeVisible();
  }).toPass();
  await page.getByRole('button', { name: '关闭平台导航', exact: true }).click();
  await expect(page.locator('[data-app-shell-mobile-drawer="open"]')).toHaveCount(0);
}

async function assertCanonicalNavigationOrder(page: Page, route: string) {
  const openDrawer = page.getByRole('button', { name: '打开平台导航' });
  const shouldCloseDrawer = await openDrawer.isVisible();
  if (shouldCloseDrawer) {
    await openDrawer.click();
    await expect(page.locator('[data-app-shell-mobile-drawer="open"]').first()).toBeVisible();
  }

  const links = page.locator('a[data-app-shell-nav-link-label], aside nav a, [data-app-shell-mobile-drawer] nav a');
  const normalizedLabels = (await links.evaluateAll((nodes) =>
    nodes.map((node) =>
      node.getAttribute('data-app-shell-nav-link-label') ||
      node.getAttribute('aria-label') ||
      node.getAttribute('title') ||
      node.textContent ||
      '',
    ),
  )).map((label) => label.trim()).filter(Boolean);
  const expectedLabels = Array.from(UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_ORDER);
  expect(normalizedLabels.slice(0, expectedLabels.length), `${route} canonical navigation order`).toEqual(
    expectedLabels,
  );

  if (shouldCloseDrawer) {
    await page.getByRole('button', { name: '关闭平台导航', exact: true }).click();
  }
}

function screenshotName(route: string, width: number) {
  const label = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-');
  return `${label}-${width}.png`;
}

test.describe.configure({ timeout: 180_000 });

for (const route of routes) {
  test(`primary AppShell chrome responsive matrix for ${route.href}`, async ({ context, page }) => {
    mkdirSync(evidenceDir, { recursive: true });
    const captured: string[] = [];
    if ('auth' in route && route.auth) await addStudentSession(context);
    await installRouteMocks(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
    });

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route.href, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(route.ready).first(), `${route.href} ready marker at ${width}px`).toBeVisible();
      await assertHeaderChrome(page, route.href);
      await assertNavigationState(page, route.href, width);
      await assertCanonicalNavigationOrder(page, route.href);
      await assertNoHorizontalOverflow(page, route.href, width);
      const fileName = screenshotName(route.href, width);
      await page.screenshot({ path: join(evidenceDir, fileName), fullPage: true });
      captured.push(fileName);
    }

    writeFileSync(
      join(evidenceDir, `${screenshotName(route.href, 0).replace(/-0\.png$/, '')}.json`),
      `${JSON.stringify({ route: route.href, widths, captured }, null, 2)}\n`,
    );
  });
}
