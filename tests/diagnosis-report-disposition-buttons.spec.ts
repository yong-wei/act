import { expect, test, type Page, type Route } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const authSecret = process.env.NEXTAUTH_SECRET
  ?? process.env.AUTH_SECRET
  ?? 'playwright-local-auth-secret-at-least-32-bytes';
const classId = 'class-disposition-buttons';
const reportId = 'report-disposition-buttons';

test('teacher disposition controls have opaque chrome and a light-theme screenshot', async ({ page }, testInfo) => {
  const baseUrl = String(testInfo.project.use.baseURL).replace(/\/$/u, '');
  await page.addInitScript(() => localStorage.setItem('ai-obe-theme', 'light'));
  await installSession(page, baseUrl);
  await installFixture(page);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(`/teacher/classes/${classId}/diagnosis-reports/${reportId}`, { waitUntil: 'networkidle' });

  const root = page.locator('[data-diagnosis-delivery-role="teacher"]');
  await expect(root).toBeVisible();
  await expect(page.getByRole('link', { name: '进入备课工作台' }).first()).toBeVisible();
  await expect(page.getByText('暂无已注册补练资源')).toHaveCount(0);

  const controls = page.locator('[data-disposition-control]');
  await expect(controls).toHaveCount(8);

  const chromes = await controls.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    const backgroundColor = style.backgroundColor;
    const slash = backgroundColor.match(/\/\s*([0-9.]+)\s*\)/u);
    const comma = backgroundColor.match(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*([0-9.]+))?\s*\)/u);
    const backgroundAlpha = backgroundColor === 'transparent'
      ? 0
      : slash
        ? (Number(slash[1]) > 1 ? Number(slash[1]) / 100 : Number(slash[1]))
        : comma?.[1] === undefined ? 1 : Number(comma[1]);
    return {
      className: (element as HTMLElement).className,
      backgroundColor,
      backgroundAlpha,
      borderWidth: Number.parseFloat(style.borderTopWidth),
      borderStyle: style.borderTopStyle,
    };
  }));
  expect(chromes).toHaveLength(8);
  for (const chrome of chromes) {
    expect(chrome.backgroundAlpha, `${chrome.className} ${chrome.backgroundColor}`).toBe(1);
    expect(chrome.borderWidth).toBeGreaterThan(0);
    expect(chrome.borderStyle).not.toBe('none');
  }

  const pending = page.locator('[data-disposition-control="pending"]').first();
  await pending.focus();
  const focusVisible = await pending.evaluate((element) => {
    const style = getComputedStyle(element);
    return element.matches(':focus-visible') && (
      style.boxShadow !== 'none'
      || (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0)
    );
  });
  expect(focusVisible).toBe(true);

  await page.getByRole('button', { name: '待处理' }).first().click();
  await expect(page.getByText('处置状态已记录；诊断风险判断保持不变。')).toBeVisible();
  await expect(page.locator('[data-disposition-control="pending"][aria-pressed="true"]')).toHaveCount(1);

  const evidencePath = testInfo.outputPath('disposition-buttons-light.png');
  await root.screenshot({ path: evidencePath });
  await testInfo.attach('disposition-buttons-light', { path: evidencePath, contentType: 'image/png' });
});

async function installSession(page: Page, baseUrl: string) {
  const token = await encode({
    secret: authSecret,
    maxAge: 3600,
    token: { id: 'teacher-disposition', sub: 'teacher-disposition', role: 'TEACHER', name: '教师', email: 'teacher-disposition@example.invalid' },
  });
  await page.context().addCookies([{ name: 'next-auth.session-token', value: token, url: baseUrl, httpOnly: true, sameSite: 'Lax' }]);
}

async function installFixture(page: Page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/auth/session') {
      return fulfill(route, { user: { id: 'teacher-disposition', role: 'TEACHER' }, expires: '2026-09-10T12:00:00.000Z' });
    }
    if (pathname.endsWith(`/diagnosis-reports/${reportId}`) && request.method() === 'GET') {
      return fulfill(route, {
        projection: {
          reportId,
          projectionVersion: 'diagnosis-delivery.v1',
          roleVersion: 'teacher-report.v1',
          audienceUserId: null,
          role: 'teacher',
          scopeType: 'student',
          classId,
          targetUserId: 'student-disposition',
          title: '学生学情诊断报告（教师版）',
          summary: '稳定裕度判断仍需加强。',
          findings: [{
            targetKey: 'finding:1',
            title: '稳定裕度判断薄弱',
            summary: '相位裕度与增益裕度仍需辨析。',
            riskType: 'constraint',
            severity: 'medium',
            confidence: 'medium',
            evidence: { state: 'available', total: 1, sources: [{ kind: 'progress', label: '知识点学习进度', count: 1 }] },
            hasPreparationEntry: true,
          }],
          suggestions: [{ targetKey: 'finding:1', source: 'finding', text: '完成一次针对性练习后查看新的诊断。' }],
          confidence: 'medium',
          limitations: ['作业证据尚未接入。'],
          evidenceCutoff: '2026-08-19T08:00:00.000Z',
          generatedAt: '2026-08-19T08:05:00.000Z',
          generatorVersion: 'teacher-diagnosis.v1',
          ruleVersion: 'teacher-diagnosis-preflight.v1',
          privacyNotice: '教师内部受控材料。',
          riskSummary: { total: 1, byType: { stagnation: 0, constraint: 1, cross_domain: 0 }, bySeverity: { low: 0, medium: 1, high: 0 } },
          generationReason: 'new-evidence',
          forceReason: null,
        },
        actions: [
          { kind: 'preparation', label: '进入备课工作台', href: '/teacher/smart-prep', targetKey: 'report' },
          { kind: 'student', label: '查看学生详情', href: `/teacher/classes/${classId}/students/student-disposition`, targetKey: 'report' },
          { kind: 'preparation', label: '进入备课工作台', href: '/teacher/smart-prep', targetKey: 'finding:1' },
        ],
        dispositionEvents: [],
      });
    }
    if (pathname.endsWith('/dispositions') && request.method() === 'POST') {
      return fulfill(route, {
        event: {
          id: 'event-disposition',
          targetKind: 'finding',
          targetKey: 'finding:1',
          action: 'pending',
          actionRef: null,
          result: 'recorded',
          createdAt: '2026-09-10T12:00:00.000Z',
        },
      }, 201);
    }
    return route.abort('blockedbyclient');
  });
}

function fulfill(route: Route, json: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
}
