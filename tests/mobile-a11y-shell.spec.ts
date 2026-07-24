import 'dotenv/config';

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const evidenceDir = join(
  process.cwd(),
  'artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/remediation/audit-remediation-mobile-a11y-shell/playwright',
);

function ensureEvidenceDir() {
  mkdirSync(evidenceDir, { recursive: true });
}

async function addSession(context: BrowserContext, role: 'ADMIN' | 'TEACHER') {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: role === 'ADMIN' ? 'audit-admin-1' : 'audit-teacher-1',
      email: role === 'ADMIN' ? 'audit-admin@example.com' : 'audit-teacher@example.com',
      name: role === 'ADMIN' ? '审计管理员' : '审计教师',
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

async function recordJsonEvidence(filename: string, payload: Record<string, unknown>) {
  ensureEvidenceDir();
  writeFileSync(join(evidenceDir, filename), `${JSON.stringify(payload, null, 2)}\n`);
}

async function expectNoDocumentOverflow(page: Page, label: string, width: number) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  ensureEvidenceDir();
  const screenshotPath = join(evidenceDir, `${label}-${width}.png`);
  await page.screenshot({ path: screenshotPath });
  await recordJsonEvidence(`${label}-${width}-dom-width.json`, {
    label,
    viewportWidth: metrics.innerWidth,
    scrollWidth: metrics.scrollWidth,
    bodyScrollWidth: metrics.bodyScrollWidth,
    screenshotPath,
    capturedAt: new Date().toISOString(),
  });
}

async function expectFocusWithin(page: Page, selector: string) {
  const isWithin = await page.locator(selector).evaluate((element) => element.contains(document.activeElement));
  expect(isWithin).toBe(true);
}

async function focusLastEnabledControl(page: Page, selector: string) {
  await page.locator(selector).evaluate((element) => {
    const focusable = Array.from(element.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((item) => !item.hasAttribute('disabled') && item.offsetParent !== null);
    focusable[focusable.length - 1]?.focus();
  });
}

async function focusContainer(page: Page, selector: string) {
  await page.locator(selector).evaluate((element) => {
    (element as HTMLElement).focus();
  });
}

async function expectActiveElementName(page: Page, expected: RegExp) {
  await expect.poll(async () => page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return active?.getAttribute('aria-label') || active?.textContent?.trim() || '';
  })).toMatch(expected);
}

async function expectActiveElementMatches(page: Page, selector: string) {
  await expect.poll(async () => page.locator(selector).evaluate((element) => element === document.activeElement)).toBe(true);
}

async function mockAdminApis(page: Page) {
  await page.route('**/api/admin/overview', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        totals: {
          users: 0,
          students: 0,
          teachers: 0,
          admins: 1,
          missions: 0,
          simulations: 0,
          llmSessions: 0,
          ethicalLogs: 0,
        },
        activity: {
          newUsers7d: 0,
          activeSessions: 0,
          simulations7d: 0,
          violations7d: 0,
        },
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
          name: '移动端审计学生',
          email: 'student-audit-with-a-very-long-address-for-mobile-overflow-proof@example-university-control-systems.example.com',
          role: 'STUDENT',
          createdAt: '2026-06-21T08:00:00.000Z',
          profile: {
            studentNumber: '20260001-LONG-MOBILE-A11Y-OVERFLOW-CHECK',
            className: '控制一班-移动端长班级名称换行验证',
          },
        }],
        total: 1,
      }),
    });
  });
  await page.route('**/api/admin/data-governance/status**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'healthy',
        timestamp: '2026-06-21T08:00:00.000Z',
        freshness: { lastSnapshotMinutes: 8, status: 'fresh' },
        data: {
          studentSnapshots: 1,
          classSnapshots: 1,
          learningFacts: 12,
          activeRiskFlags: 1,
          bufferedEvents: 0,
        },
        queues: {
          eventIngestion: { waiting: 0, active: 0, completed: 3, failed: 0 },
          studentSnapshot: { waiting: 0, active: 0, completed: 2, failed: 0 },
          classSnapshot: { waiting: 0, active: 0, completed: 1, failed: 0 },
        },
        factTypeDistribution: [{ label: '仿真实验', count: 12 }],
        featureCache: {
          payloadVersion: 'student-evidence-features.v1',
          totalEntries: 1,
          staleEntries: 0,
          latestRefreshAt: '2026-06-21T07:50:00.000Z',
          totalSourceFacts: 12,
          totalRebuilds: 1,
          coverage: { SimulationRun: { available: 1 } },
        },
        sourceCoverage: {
          generatedAt: '2026-06-21T08:00:00.000Z',
          catalogVersion: '2026-06-21',
          totals: {
            totalRows: 12,
            eligibleRows: 12,
            excludedRows: 0,
            unsupportedRows: 0,
            affectedUsers: 1,
          },
          sources: [],
          exclusions: [],
        },
        sourceCatalog: {
          totalSources: 1,
          coverageCommand: 'npm run db:evidence-source-coverage -- --text',
          sources: [{
            id: 'SimulationRun',
            learningScope: 'historical-evidence-source-with-long-mobile-label',
            valueLevel: 'high',
            eligibility: 'eligible',
            materializationReadiness: 'ready',
            totalRows: 12,
            eligibleRows: 12,
            excludedRows: 0,
            unsupportedRows: 0,
            affectedUsers: 1,
          }],
        },
        sessionQualityReports: [],
        recentRiskFlags: [{
          id: 'risk-1',
          userId: 'student-1',
          userName: '张三',
          flagType: 'participation',
          severity: 'high',
          description: '参与度不足，需要在移动端风险表格中验证长风险说明不会撑开 document width。',
          triggeredAt: '2026-06-21T07:55:00.000Z',
          isResolved: false,
        }],
        targetRiskFlag: null,
        recentSnapshots: [],
        topSnapshotStudents: [],
      }),
    });
  });
}

async function mockTeacherApis(page: Page) {
  let launchOptionsMode: 'active' | 'none' = 'active';
  const launchedSessions: Array<Record<string, unknown>> = [];
  let defaultSetterCalls = 0;

  await page.route('**/api/teacher/classes/launch-options', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(launchOptionsMode === 'active'
        ? {
            classes: [
              { id: 'class-1', name: '控制一班', code: '123456' },
              { id: 'class-2', name: '控制二班', code: '654321' },
            ],
            defaultClassId: 'class-1',
          }
        : {
            classes: [],
            defaultClassId: null,
          }),
    });
  });
  await page.route('**/api/teacher/classes/default', async (route) => {
    defaultSetterCalls += 1;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/session', async (route) => {
    launchedSessions.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: 'mobile-a11y-session' }),
    });
  });
  await page.route('**/classroom/teacher/mobile-a11y-session', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="zh-CN"><body><main>移动端课堂已创建</main></body></html>',
    });
  });
  await page.route('**/api/teacher/classes/class-1/insights**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        scope: 'cumulative',
        scopeLabel: '累计能力达成',
        availability: { state: 'available', reason: 'available' },
        classInfo: {
          id: 'class-1',
          name: '控制一班',
          code: '123456',
          description: '审计班级',
          semester: '春',
          year: '2026',
          studentCount: 1,
        },
        governance: {
          tone: 'healthy',
          label: '治理结果可用',
          detail: '1 名学生已有画像。',
          coveredStudents: 1,
          totalStudents: 1,
          coverageRatio: 1,
          lastUpdatedLabel: '刚刚更新',
          pendingStudents: 0,
          classSnapshotAt: '2026-06-21T08:00:00.000Z',
          latestStudentSnapshotAt: '2026-06-21T08:00:00.000Z',
        },
        overview: {
          overallIndex: 82,
          attentionStudents: 0,
          highRiskStudents: 0,
          mediumRiskStudents: 0,
          averageFactCount: 12,
        },
        ability: {
          state: 'ready',
          dimensions: [{
            dimension: 'control_design',
            label: '控制设计',
            mean: 82,
            meanConfidence: 0.9,
            includedCount: 1,
            missingCount: 0,
          }],
          levelDistribution: { excellent: 0, good: 1, fair: 0, weak: 0 },
        },
        trendDistribution: { up: 0, stable: 1, down: 0, 'not-comparable': 0 },
        riskDistribution: { bySeverity: { high: 0, medium: 0, low: 0 } },
        spotlightStudents: [],
        students: [],
        diagnosis: null,
        arena: null,
      }),
    });
  });
  await page.route('**/api/teacher/classes/class-1/heatmap**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ students: [], dimensions: [], matrix: [] }) });
  });
  await page.route('**/api/teacher/classes/class-1/sessions**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/lesson-plans', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'plan-1', title: '控制校正复习', description: null }]) });
  });
  await page.route('**/api/teacher/classes/class-1', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'class-1',
        name: '控制一班',
        code: '123456',
        description: '审计班级',
        year: '2026',
        semester: '春',
        isActive: true,
        students: [{
          id: 'enrollment-1',
          studentNumber: '20260001',
          techScore: 80,
          ethicsScore: 90,
          user: { id: 'student-1', name: '张三-移动端长姓名验证', email: 'student-with-long-email-for-mobile-card-overflow@example-university-control-systems.example.com' },
        }],
        _count: { students: 1 },
      }),
    });
  });

  return {
    launchedSessions,
    getDefaultSetterCalls: () => defaultSetterCalls,
    setLaunchOptionsMode: (mode: 'active' | 'none') => {
      launchOptionsMode = mode;
    },
  };
}

test('admin mobile pages keep 320px and 390px document width with announced table states', async ({ context, page }) => {
  await addSession(context, 'ADMIN');
  await mockAdminApis(page);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/admin/users?role=STUDENT&q=zzzz-no-match&page=2&action=export', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-admin-users-list-status]')).toBeAttached();
    await expect(page.locator('table[data-admin-mobile-cards="true"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '修改账号 移动端审计学生 的密码' })).toBeVisible();
    if (width === 320) {
      const createOpener = page.getByRole('button', { name: '新建用户账号' });
      await createOpener.first().click();
      const createDialog = page.getByRole('dialog', { name: '新建账号' });
      await expect(createDialog).toBeVisible();
      await expectFocusWithin(page, '[aria-labelledby="admin-create-user-title"]');
      await focusLastEnabledControl(page, '[aria-labelledby="admin-create-user-title"]');
      await page.keyboard.press('Tab');
      await expectFocusWithin(page, '[aria-labelledby="admin-create-user-title"]');
      await expectActiveElementName(page, /关闭新建账号对话框/);
      await focusContainer(page, '[aria-labelledby="admin-create-user-title"]');
      await page.keyboard.press('Shift+Tab');
      await expectFocusWithin(page, '[aria-labelledby="admin-create-user-title"]');
      await page.keyboard.press('Escape');
      await expect(createDialog).toBeHidden();
      await expectActiveElementMatches(page, 'button[aria-label="新建用户账号"]');

      const resetOpener = page.getByRole('button', { name: '修改账号 移动端审计学生 的密码' });
      await resetOpener.click();
      const resetDialog = page.getByRole('dialog', { name: '修改密码' });
      await expect(resetDialog).toBeVisible();
      await expectFocusWithin(page, '[aria-labelledby="admin-reset-password-title"]');
      await focusLastEnabledControl(page, '[aria-labelledby="admin-reset-password-title"]');
      await page.keyboard.press('Tab');
      await expectActiveElementName(page, /关闭修改密码对话框/);
      await focusContainer(page, '[aria-labelledby="admin-reset-password-title"]');
      await page.keyboard.press('Shift+Tab');
      await expectFocusWithin(page, '[aria-labelledby="admin-reset-password-title"]');
      await page.keyboard.press('Escape');
      await expect(resetDialog).toBeHidden();
      await expectActiveElementMatches(page, 'button[aria-label="修改账号 移动端审计学生 的密码"]');
      await recordJsonEvidence('admin-users-dialog-keyboard-320.json', {
        label: 'admin-users-dialog-keyboard',
        viewportWidth: 320,
        createDialog: ['initial focus inside', 'forward Tab wraps', 'container Shift+Tab wraps', 'Escape closes', 'opener restored'],
        resetDialog: ['initial focus inside', 'forward Tab wraps', 'container Shift+Tab wraps', 'Escape closes', 'opener restored'],
        capturedAt: new Date().toISOString(),
      });
    }
    await expectNoDocumentOverflow(page, 'admin-users', width);

    await page.goto('/admin/data-governance?riskId=missing-mobile-a11y&action=resolve', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-admin-governance-status]')).toBeAttached();
    await expect(page.locator('table[data-admin-mobile-cards="true"]').first()).toBeVisible();
    await expectNoDocumentOverflow(page, 'admin-data-governance', width);

    if (width === 320) {
      const dockTrigger = page.locator('[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]');
      await expect(dockTrigger).toBeVisible();
      await dockTrigger.click();
      const sidebar = page.locator('[data-global-ai-sidebar="open"]');
      await expect(sidebar).toBeVisible();
      await expectFocusWithin(page, '[data-global-ai-sidebar="open"]');
      await focusLastEnabledControl(page, '[data-global-ai-sidebar="open"]');
      await page.keyboard.press('Tab');
      await expectFocusWithin(page, '[data-global-ai-sidebar="open"]');
      await focusContainer(page, '[data-global-ai-sidebar="open"]');
      await page.keyboard.press('Shift+Tab');
      await expectFocusWithin(page, '[data-global-ai-sidebar="open"]');
      await page.keyboard.press('Escape');
      await expect(sidebar).toBeHidden();
      await expectActiveElementMatches(page, '[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]');
      await recordJsonEvidence('global-ai-sidebar-keyboard-320.json', {
        label: 'global-ai-sidebar-keyboard',
        viewportWidth: 320,
        interaction: ['opened from shared floating dock', 'initial focus inside', 'forward Tab wraps', 'container Shift+Tab wraps', 'Escape closes', 'dock trigger restored'],
        capturedAt: new Date().toISOString(),
      });
    }
  }
});

test('teacher mobile report and class detail pages expose fixed actions and mobile student cards', async ({ context, page }) => {
  await addSession(context, 'TEACHER');
  const teacherApi = await mockTeacherApis(page);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/teacher/classes/class-1/analytics-v2?action=export', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-teacher-report-delivery-status]')).toBeAttached();
    await expect(page.locator('[data-teacher-report-delivery="mobile-fixed-actions"]')).toBeVisible();
    await expectNoDocumentOverflow(page, 'teacher-report', width);

    await page.goto('/teacher/classes/class-1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-teacher-class-detail-status]')).toBeAttached();
    await expect(page.locator('table[data-teacher-mobile-cards="true"]')).toBeVisible();
    if (width === 320) {
      const startOpener = page.getByRole('button', { name: '打开开始上课对话框' });
      await startOpener.focus();
      await page.keyboard.press('Enter');
      const startDialog = page.getByRole('dialog', { name: '选择班级并开始上课' });
      await expect(startDialog).toBeVisible();
      const classSelect = startDialog.getByRole('combobox', { name: '本次课堂班级' });
      await expect(classSelect).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(startDialog).toBeHidden();
      await expect(startOpener).toBeFocused();

      await startOpener.click();
      await expect(startDialog).toBeVisible();
      await startDialog.getByRole('button', { name: '取消' }).click();
      await expect(startDialog).toBeHidden();
      await expect(startOpener).toBeFocused();

      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async () => undefined },
        });
      });
      await page.getByRole('button', { name: '复制班级加入码' }).click();
      await expect(page.locator('[data-teacher-class-visible-status]')).toContainText('班级加入码已复制');

      await startOpener.focus();
      await page.keyboard.press('Enter');
      await expect(classSelect).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(classSelect).toHaveValue('class-2');
      await expect(startDialog.getByRole('status')).toContainText('已更新本次课堂班级');
      await expectNoDocumentOverflow(page, 'teacher-class-detail', width);
      await startDialog.getByRole('button', { name: '开始上课' }).focus();
      await page.keyboard.press('Enter');
      await expect.poll(() => teacherApi.launchedSessions.length).toBe(1);
      expect(teacherApi.launchedSessions[0]).toMatchObject({
        planId: 'plan-1',
        classId: 'class-2',
        launchContext: 'class-bound',
      });
      expect(teacherApi.getDefaultSetterCalls()).toBe(0);
      await recordJsonEvidence('teacher-class-dialog-keyboard-320.json', {
        label: 'teacher-class-dialog-keyboard',
        viewportWidth: 320,
        startDialog: [
          'accessible shared dialog name',
          'class selector receives initial focus',
          'Escape and cancel restore opener',
          'keyboard selects alternate class',
          'class-bound launch preserves default class',
        ],
        launchPayload: teacherApi.launchedSessions[0],
        visibleStatus: '班级加入码已复制',
        capturedAt: new Date().toISOString(),
      });
      continue;
    }

    const pointerOpener = page.getByRole('button', { name: '打开开始上课对话框' });
    await pointerOpener.click();
    const pointerDialog = page.getByRole('dialog', { name: '选择班级并开始上课' });
    await expect(pointerDialog.getByRole('combobox', { name: '本次课堂班级' })).toBeFocused();
    await pointerDialog.getByRole('button', { name: '取消' }).click();
    await expect(pointerOpener).toBeFocused();
    await expectNoDocumentOverflow(page, 'teacher-class-detail', width);
  }

  teacherApi.setLaunchOptionsMode('none');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/teacher/classes/class-1', { waitUntil: 'domcontentloaded' });
  const noClassOpener = page.getByRole('button', { name: '打开开始上课对话框' });
  await noClassOpener.click();
  const noClassDialog = page.getByRole('dialog', { name: '选择班级并开始上课' });
  await expect(noClassDialog.getByText('当前没有可用于开课的已启用班级。')).toBeVisible();
  await expect(noClassDialog.getByRole('link', { name: '前往班级管理' })).toBeFocused();
  await expect(noClassDialog.getByRole('button', { name: '开始上课' })).toBeDisabled();
  expect(teacherApi.launchedSessions).toHaveLength(1);
  expect(teacherApi.getDefaultSetterCalls()).toBe(0);
});
