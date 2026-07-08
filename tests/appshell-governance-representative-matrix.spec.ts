import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { UserRole } from '@prisma/client';

import {
  APP_SHELL_GOVERNANCE_REPRESENTATIVE_ROUTE_MATRIX,
  UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
} from '../src/lib/platform-appshell-contract';
import { getPlatformRouteNavigation } from '../src/lib/platform-role-navigation';

const evidenceDir = join(
  process.cwd(),
  'artifacts/commercial-ui/appshell-governance-representative-matrix/playwright',
);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3200}`;
const primaryAndRoleCategories = new Set(['primary', 'teacher', 'teacher-classes', 'admin']);
const routes = APP_SHELL_GOVERNANCE_REPRESENTATIVE_ROUTE_MATRIX.filter(
  (route) => !primaryAndRoleCategories.has(route.category),
);

async function addRoleSession(context: BrowserContext, role: 'student' | 'teacher' | 'admin' | 'guest') {
  if (role === 'guest') return;

  const authRole = {
    student: UserRole.STUDENT,
    teacher: UserRole.TEACHER,
    admin: UserRole.ADMIN,
  }[role];
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: `appshell-governance-${role}`,
      email: `appshell-governance-${role}@example.com`,
      name: `AppShell Governance ${role}`,
      role: authRole,
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

async function installGovernanceMocks(page: Page) {
  await page.route('**/api/user/profile', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'appshell-governance-student',
          name: 'AppShell Governance Student',
          email: 'appshell-governance-student@example.com',
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
        },
      }),
    });
  });
}

async function assertNoHorizontalOverflow(page: Page, routeLabel: string, width: number) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
  const maxScrollWidth = Math.max(metrics.bodyScrollWidth, metrics.documentScrollWidth);
  expect(maxScrollWidth, `${routeLabel} ${width}px horizontal overflow`).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

async function assertShellChrome(page: Page, route: typeof routes[number]) {
  const routeLabel = route.href;
  await expect(page.locator('[data-app-shell-header-action-pair="theme-switch personal-center"]').first()).toBeVisible();
  await expect(page.locator('[data-app-shell-header-action="theme-switch"]').first()).toBeVisible();
  const personalCenter = page.locator('[data-app-shell-header-action="personal-center"]').first();
  await expect(personalCenter).toBeVisible();
  await expect(page.locator('nav[aria-label="Breadcrumb"]').first(), `${routeLabel} breadcrumb`).toBeVisible();

  const order = await page.evaluate(() => {
    const theme = document.querySelector('[data-app-shell-header-action="theme-switch"]');
    const personal = document.querySelector('[data-app-shell-header-action="personal-center"]');
    if (!theme || !personal) return 0;
    return theme.compareDocumentPosition(personal) & Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(order, `${routeLabel} header action order`).toBeTruthy();

  if (route.viewerRole === 'teacher' || route.viewerRole === 'admin') {
    const expectedAccountHref = route.viewerRole === 'admin' ? '/admin' : '/teacher';
    const personalCenterLink = personalCenter.getByRole('link', { name: '个人中心' });
    if (!(await personalCenterLink.isVisible())) {
      await personalCenter.getByRole('button').click();
    }
    await expect(personalCenterLink).toHaveAttribute('href', expectedAccountHref);
    await expect(personalCenterLink).not.toHaveAttribute('href', '/profile');
  }
}

async function assertNavigation(page: Page, route: typeof routes[number], width: number) {
  const routeLabel = route.href;
  const openDrawer = page.getByRole('button', { name: '打开平台导航' });
  const shouldCloseDrawer = width < 1024 && await openDrawer.isVisible();
  if (shouldCloseDrawer) {
    await expect(async () => {
      await openDrawer.click();
      await expect(page.locator('[data-app-shell-mobile-drawer="open"]').first(), `${routeLabel} drawer`).toBeVisible();
    }).toPass();
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
  const finalPath = new URL(page.url()).pathname;
  const expectedHref = route.href === '/virtual-lab' && finalPath === '/simulations' ? finalPath : route.href;
  const expectedRole = route.href === '/virtual-lab' && finalPath === '/simulations' ? 'student' : route.viewerRole;
  const expectedLabels = getPlatformRouteNavigation(expectedHref, expectedRole).map((entry) => entry.label);
  expect(normalizedLabels.slice(0, expectedLabels.length), `${routeLabel} canonical navigation order`).toEqual(
    expectedLabels,
  );

  if (width >= 1024) {
    await expect(page.locator('[data-app-shell-layout]').first(), `${routeLabel} desktop shell layout`).toBeVisible();
    return;
  }

  if (shouldCloseDrawer) {
    await page.getByRole('button', { name: '关闭平台导航', exact: true }).click();
  }
}

function screenshotName(category: string, width: number) {
  return `${category}-${width}.png`;
}

test.describe.configure({ timeout: 240_000 });

test('AppShell governance representative routes load with shared shell chrome across required widths', async ({
  browser,
}) => {
  mkdirSync(evidenceDir, { recursive: true });
  const captured: string[] = [];
  const finalUrls: Record<string, string> = {};

  for (const route of routes) {
    const context = await browser.newContext({ baseURL });
    await addRoleSession(context, route.viewerRole);
    const page = await context.newPage();
    await installGovernanceMocks(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
    });

    for (const width of UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS) {
      await page.setViewportSize({ width, height: width <= 390 ? 800 : 900 });
      await page.goto(route.href, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login/);
      finalUrls[`${route.category}:${width}`] = page.url();
      await assertShellChrome(page, route);
      await assertNavigation(page, route, width);
      await assertNoHorizontalOverflow(page, route.href, width);

      const fileName = screenshotName(route.category, width);
      await page.screenshot({ path: join(evidenceDir, fileName), fullPage: true });
      captured.push(fileName);
    }

    await context.close();
  }

  writeFileSync(
    join(evidenceDir, 'screenshots.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      routeCount: routes.length,
      widths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
      finalUrls,
      captured,
    }, null, 2)}\n`,
  );
});
