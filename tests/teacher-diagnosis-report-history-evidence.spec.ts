import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page, type Route } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import {
  classDetailFixture,
  classReportsPayload,
  EVIDENCE_CLASS_ID,
  EVIDENCE_STUDENT_ID,
  PRIVATE_EVIDENCE_MARKERS,
  studentInsightsFixture,
  studentReportsPayload,
} from './fixtures/teacher-diagnosis-report-history';

const artifactDirectory = path.resolve(
  process.cwd(),
  'artifacts/commercial-ui/teacher-diagnosis-report-history-1177/playwright',
);
const captureEnabled = process.env.TEACHER_DIAGNOSIS_REPORT_EVIDENCE_CAPTURE === '1';
const authSecret = 'teacher-diagnosis-evidence-secret';

test.skip(!captureEnabled, 'run with TEACHER_DIAGNOSIS_REPORT_EVIDENCE_CAPTURE=1');
test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  mkdirSync(artifactDirectory, { recursive: true });
});

test('captures the class production route with loading, history selection, and preparation navigation', async ({ page }) => {
  await installTeacherSession(page);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.emulateMedia({ colorScheme: 'light' });
  const diagnostics = collectDiagnostics(page);
  const requests = await installAuthorizedFixture(page, 'class', 'ready', 3_000);

  await page.goto(`/teacher/classes/${EVIDENCE_CLASS_ID}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-report-history-state="loading"]')).toBeVisible();
  await expect(page.locator('[data-report-history-state="ready"]')).toBeVisible();
  await page.waitForLoadState('networkidle');

  await expect(page.locator('[data-report-history-item]')).toHaveCount(2);
  await page.locator('[data-report-history-item="report-class-older"]').click();
  await expect(page.locator('[data-selected-diagnosis-report="report-class-older"]')).toBeVisible();
  await expect(page.locator(`a[href*="/teacher/preparation?"]`)).toBeVisible();
  await assertPrivateEvidenceHidden(page);
  await expectNoHorizontalOverflow(page);
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.pageErrors).toEqual([]);

  const screenshot = path.join(artifactDirectory, 'class-history-1440-light.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  writeCaptureRecord('class-history-1440-light.json', {
    routePath: `/teacher/classes/${EVIDENCE_CLASS_ID}`,
    viewport: page.viewportSize(),
    requests,
    selectedReportId: 'report-class-older',
    consoleErrors: diagnostics.consoleErrors,
    pageErrors: diagnostics.pageErrors,
    horizontalOverflow: false,
  });
});

test('distinguishes empty and failed report history on the class production route', async ({ page }) => {
  await installTeacherSession(page);
  await installAuthorizedFixture(page, 'class', 'empty');
  await page.goto(`/teacher/classes/${EVIDENCE_CLASS_ID}`, { waitUntil: 'networkidle' });
  await expect(page.locator('[data-report-history-empty]')).toBeVisible();

  await page.unrouteAll({ behavior: 'wait' });
  await installAuthorizedFixture(page, 'class', 'failure');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('[data-report-history-state="error"]')).toBeVisible();
});

test('captures degraded student history at the 320px production route', async ({ page }) => {
  await installTeacherSession(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  const diagnostics = collectDiagnostics(page);
  const requests = await installAuthorizedFixture(page, 'student', 'ready');

  await page.goto(
    `/teacher/classes/${EVIDENCE_CLASS_ID}/students/${EVIDENCE_STUDENT_ID}`,
    { waitUntil: 'networkidle' },
  );
  await expect(page.locator('[data-report-history-scope="student"]')).toBeVisible();
  await expect(page.locator('[data-report-degraded="true"]')).toBeVisible();
  await expect(page.locator(`a[href*="/teacher/preparation?"]`)).toBeVisible();
  await assertPrivateEvidenceHidden(page);
  await expectNoHorizontalOverflow(page);
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.pageErrors).toEqual([]);

  const screenshot = path.join(artifactDirectory, 'student-history-320-dark.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  writeCaptureRecord('student-history-320-dark.json', {
    routePath: `/teacher/classes/${EVIDENCE_CLASS_ID}/students/${EVIDENCE_STUDENT_ID}`,
    viewport: page.viewportSize(),
    requests,
    degraded: true,
    consoleErrors: diagnostics.consoleErrors,
    pageErrors: diagnostics.pageErrors,
    horizontalOverflow: false,
  });
});

test('the real diagnosis-report API fails closed without an authenticated teacher', async ({ request }) => {
  const response = await request.get(`/api/teacher/classes/${EVIDENCE_CLASS_ID}/diagnosis-reports`);
  expect(response.status()).toBe(401);
});

async function installAuthorizedFixture(
  page: Page,
  scope: 'class' | 'student',
  reportState: 'ready' | 'empty' | 'failure',
  reportDelayMs = 300,
) {
  const requests: string[] = [];
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    requests.push(pathname);
    if (pathname === '/api/auth/session') return route.continue();
    if (pathname === `/api/teacher/classes/${EVIDENCE_CLASS_ID}`) return fulfill(route, classDetailFixture);
    if (pathname === `/api/teacher/classes/${EVIDENCE_CLASS_ID}/sessions`) return fulfill(route, []);
    if (pathname === `/api/teacher/classes/${EVIDENCE_CLASS_ID}/insights`) return fulfill(route, null);
    if (pathname === '/api/lesson-plans') return fulfill(route, []);
    if (pathname === `/api/teacher/classes/${EVIDENCE_CLASS_ID}/students/${EVIDENCE_STUDENT_ID}/insights`) {
      return fulfill(route, studentInsightsFixture);
    }
    if (pathname === `/api/teacher/classes/${EVIDENCE_CLASS_ID}/diagnosis-reports`) {
      await new Promise((resolve) => setTimeout(resolve, reportDelayMs));
      if (reportState === 'failure') return fulfill(route, { error: '受控证据读取失败' }, 503);
      if (reportState === 'empty') return fulfill(route, { reports: [] });
      return fulfill(route, scope === 'student' ? studentReportsPayload : classReportsPayload);
    }
    return route.abort('blockedbyclient');
  });
  return requests;
}

async function installTeacherSession(page: Page) {
  const token = await encode({
    secret: authSecret,
    maxAge: 60 * 60,
    token: {
      id: 'teacher-evidence',
      sub: 'teacher-evidence',
      name: '证据教师',
      email: 'evidence-teacher@example.invalid',
      role: 'TEACHER',
    },
  });
  await page.context().addCookies([{
    name: 'next-auth.session-token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
}

function fulfill(route: Route, json: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
}

function collectDiagnostics(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
}

async function assertPrivateEvidenceHidden(page: Page) {
  const html = await page.content();
  for (const marker of PRIVATE_EVIDENCE_MARKERS) expect(html).not.toContain(marker);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((rect) => rect.right > document.documentElement.clientWidth + 1 || rect.left < -1)
      .sort((left, right) => right.width - left.width)
      .slice(0, 8),
  }));
  expect(dimensions, JSON.stringify(dimensions.offenders, null, 2)).toMatchObject({
    scrollWidth: dimensions.clientWidth,
  });
}

function writeCaptureRecord(file: string, value: unknown) {
  writeFileSync(path.join(artifactDirectory, file), `${JSON.stringify(value, null, 2)}\n`);
}
