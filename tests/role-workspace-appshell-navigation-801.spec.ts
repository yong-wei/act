import 'dotenv/config';

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const evidenceDir = join(
  process.cwd(),
  'artifacts/commercial-ui/role-workspace-appshell-navigation-801/playwright',
);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3200}`;

const routes = [
  { label: 'teacher-home', href: '/teacher', role: 'TEACHER' },
  { label: 'teacher-grading', href: '/teacher/grading-workbench?demo=1', role: 'TEACHER' },
  { label: 'admin-home', href: '/admin', role: 'ADMIN' },
  { label: 'admin-users', href: '/admin/users?role=STUDENT&q=zzzz-no-match&page=2', role: 'ADMIN' },
] as const;

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

async function captureRoute(page: Page, route: typeof routes[number]) {
  await page.addInitScript(() => {
    window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(route.href, { waitUntil: 'networkidle' });
  await expect(page.locator('[data-app-shell-layout="collapsible"]')).toBeVisible();
  await expect(page.locator('[data-app-shell-navigation-state="collapsed"]')).toBeVisible();
  await page.screenshot({ path: join(evidenceDir, `${route.label}-desktop-collapsed.png`), fullPage: true });

  await page.getByRole('button', { name: '展开平台导航' }).click();
  await expect(page.locator('[data-app-shell-navigation-state="expanded"]')).toBeVisible();
  await page.screenshot({ path: join(evidenceDir, `${route.label}-desktop-expanded.png`), fullPage: true });

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(route.href, { waitUntil: 'networkidle' });
  const openDrawer = page.getByRole('button', { name: '打开平台导航' });
  if (await openDrawer.isVisible()) {
    await openDrawer.click();
    await expect(page.locator('[data-app-shell-mobile-drawer="open"]')).toBeVisible();
  } else {
    await expect(page.getByRole('navigation', { name: '平台导航' })).toBeVisible();
  }
  await page.screenshot({ path: join(evidenceDir, `${route.label}-mobile-320.png`), fullPage: true });
}

test('role workspace AppShell navigation visual evidence for #801', async ({ browser }) => {
  ensureEvidenceDir();
  const captured: string[] = [];

  for (const route of routes) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await addSession(context, route.role);
    await mockAdminApis(page);
    await captureRoute(page, route);
    captured.push(
      `${route.label}-desktop-collapsed.png`,
      `${route.label}-desktop-expanded.png`,
      `${route.label}-mobile-320.png`,
    );
    await context.close();
  }

  writeFileSync(
    join(evidenceDir, 'screenshots.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), captured }, null, 2)}\n`,
  );
});
