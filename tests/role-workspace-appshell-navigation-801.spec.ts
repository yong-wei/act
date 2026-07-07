import 'dotenv/config';

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import { getPlatformRouteNavigation } from '../src/lib/platform-role-navigation';

const evidenceDir = join(
  process.cwd(),
  'artifacts/commercial-ui/role-workspace-appshell-navigation-801/playwright',
);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3200}`;

const routes = [
  { label: 'teacher-home', href: '/teacher', role: 'TEACHER' },
  { label: 'teacher-classes', href: '/teacher/classes', role: 'TEACHER' },
  { label: 'teacher-grading', href: '/teacher/grading-workbench?demo=1', role: 'TEACHER' },
  { label: 'admin-home', href: '/admin', role: 'ADMIN' },
  { label: 'admin-users', href: '/admin/users?role=STUDENT&q=zzzz-no-match&page=2', role: 'ADMIN' },
] as const;
const viewportWidths = [1440, 1280, 1024, 768, 390, 320] as const;
const desktopWidths = new Set<number>([1440, 1280]);

test.describe.configure({ timeout: 120_000 });

function ensureEvidenceDir() {
  mkdirSync(evidenceDir, { recursive: true });
}

async function addSession(context: BrowserContext, role: 'ADMIN' | 'TEACHER') {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: role === 'ADMIN' ? 'role-shell-admin-801' : 'role-shell-teacher-801',
      email: role === 'ADMIN' ? 'role-shell-admin@example.com' : 'role-shell-teacher@example.com',
      name: role === 'ADMIN' ? '导航验收管理员' : '导航验收教师',
      role,
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

async function mockAdminApis(page: Page) {
  await page.route('**/api/admin/overview', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        totals: { users: 1, students: 1, teachers: 0, admins: 1, missions: 0, simulations: 0, llmSessions: 0, ethicalLogs: 0 },
        activity: { newUsers7d: 0, activeSessions: 0, simulations7d: 0, violations7d: 0 },
        recentViolations: [],
      }),
    });
  });
  await page.route('**/api/admin/users**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        users: [{
          id: 'user-1',
          name: '验收学生',
          email: 'student-role-shell@example.com',
          role: 'STUDENT',
          createdAt: '2026-07-04T00:00:00.000Z',
          profile: { studentNumber: '2026801', className: '控制验收班' },
        }],
        total: 1,
      }),
    });
  });
}

async function mockTeacherApis(page: Page) {
  await page.route('**/api/teacher/classes', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'class-appshell-governance',
        name: 'AppShell 治理验收班',
        code: 'SHELL801',
        description: '用于 AppShell 治理视觉矩阵的班级',
        year: '2026',
        semester: 'summer',
        isActive: true,
        createdAt: '2026-07-04T00:00:00.000Z',
        _count: { students: 2 },
      }]),
    });
  });
}

async function assertRoleSafeHeaderChrome(page: Page, route: typeof routes[number]) {
  await expect(page.locator('nav[aria-label="Breadcrumb"]').first(), `${route.label} breadcrumb`).toBeVisible();
  await expect(page.locator('[data-app-shell-header-action-pair="theme-switch personal-center"]').first()).toBeVisible();
  await expect(page.locator('[data-app-shell-header-action="theme-switch"]').first()).toBeVisible();

  const personalCenter = page.locator('[data-app-shell-header-action="personal-center"]').first();
  await expect(personalCenter, `${route.label} personal center action`).toBeVisible();

  const order = await page.evaluate(() => {
    const theme = document.querySelector('[data-app-shell-header-action="theme-switch"]');
    const personal = document.querySelector('[data-app-shell-header-action="personal-center"]');
    if (!theme || !personal) return 0;
    return theme.compareDocumentPosition(personal) & Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(order, `${route.label} header action order`).toBeTruthy();

  await personalCenter.getByRole('button').click();
  const expectedAccountHref = route.role === 'ADMIN' ? '/admin' : '/teacher';
  await expect(personalCenter.getByRole('link', { name: '个人中心' })).toHaveAttribute('href', expectedAccountHref);
  await expect(personalCenter.getByRole('link', { name: '个人中心' })).not.toHaveAttribute('href', '/profile');
}

async function assertRoleNavigationOrder(page: Page, route: typeof routes[number], width: number) {
  const openDrawer = page.getByRole('button', { name: '打开平台导航' });
  const useMobileDrawer = await openDrawer.isVisible();
  const mobileInlineNavigation = page.locator('nav[aria-label="平台导航"]').filter({
    has: page.locator('a[data-app-shell-nav-link-label]'),
  });
  const useMobileInlineNavigation = !useMobileDrawer && await mobileInlineNavigation.first().isVisible();
  if (useMobileDrawer) {
    await expect(async () => {
      await openDrawer.click();
      await expect(page.locator('[data-app-shell-mobile-drawer="open"]').first()).toBeVisible();
    }).toPass();
  }

  const navigationLinks = useMobileDrawer
    ? page.locator('[data-app-shell-mobile-drawer="open"] nav a[data-app-shell-nav-link-label]')
    : useMobileInlineNavigation
      ? mobileInlineNavigation.locator('a[data-app-shell-nav-link-label]')
      : page.locator('[data-shell-navigation-state] aside nav a[data-app-shell-nav-link-label]');
  const labels = (await navigationLinks.evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const style = window.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
      })
      .map((node) =>
        node.getAttribute('data-app-shell-nav-link-label') ||
        node.getAttribute('aria-label') ||
        node.getAttribute('title') ||
        node.textContent ||
        '',
      ),
  ))
    .map((label) => label.trim())
    .filter(Boolean);
  const role = route.role === 'ADMIN' ? 'admin' : 'teacher';
  const expectedLabels = getPlatformRouteNavigation(route.href, role).map((entry) => entry.label);
  expect(labels.length, `${route.label} ${width}px visible navigation links`).toBeGreaterThanOrEqual(
    expectedLabels.length,
  );
  expect(labels.slice(0, expectedLabels.length), `${route.label} ${width}px navigation order`).toEqual(expectedLabels);

  if (useMobileDrawer) {
    await page.getByRole('button', { name: '关闭平台导航', exact: true }).click();
    await expect(page.locator('[data-app-shell-mobile-drawer="open"]')).toHaveCount(0);
  }
}

async function assertNoHorizontalOverflow(page: Page, route: typeof routes[number], width: number) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
  const maxScrollWidth = Math.max(metrics.bodyScrollWidth, metrics.documentScrollWidth);
  expect(maxScrollWidth, `${route.label} ${width}px horizontal overflow`).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

async function captureRoute(page: Page, route: typeof routes[number]) {
  await page.addInitScript(() => {
    window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
  });

  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: width <= 390 ? 800 : 900 });
    await page.goto(route.href, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-app-shell-layout="collapsible"]')).toBeVisible();
    await assertRoleSafeHeaderChrome(page, route);
    await assertRoleNavigationOrder(page, route, width);
    await assertNoHorizontalOverflow(page, route, width);

    if (desktopWidths.has(width)) {
      await expect(page.locator('[data-app-shell-navigation-state="collapsed"]')).toBeVisible();
      await page.screenshot({ path: join(evidenceDir, `${route.label}-${width}-collapsed.png`), fullPage: true });

      await page.getByRole('button', { name: '展开平台导航' }).click();
      await expect(page.locator('[data-app-shell-navigation-state="expanded"]')).toBeVisible();
      await page.screenshot({ path: join(evidenceDir, `${route.label}-${width}-expanded.png`), fullPage: true });
      continue;
    }

    const openDrawer = page.getByRole('button', { name: '打开平台导航' });
    if (await openDrawer.isVisible()) {
      await openDrawer.click();
      await expect(page.locator('[data-app-shell-mobile-drawer="open"]')).toBeVisible();
    } else {
      await expect(page.getByRole('navigation', { name: '平台导航' })).toBeVisible();
    }
    await page.screenshot({ path: join(evidenceDir, `${route.label}-${width}.png`), fullPage: true });
  }
}

test('role workspace AppShell navigation visual evidence for #801', async ({ browser }) => {
  ensureEvidenceDir();
  const captured: string[] = [];

  for (const route of routes) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await addSession(context, route.role);
    await mockAdminApis(page);
    await mockTeacherApis(page);
    await captureRoute(page, route);
    captured.push(...viewportWidths.flatMap((width) =>
      desktopWidths.has(width)
        ? [`${route.label}-${width}-collapsed.png`, `${route.label}-${width}-expanded.png`]
        : [`${route.label}-${width}.png`],
    ));
    await context.close();
  }

  writeFileSync(
    join(evidenceDir, 'screenshots.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), captured }, null, 2)}\n`,
  );
});
