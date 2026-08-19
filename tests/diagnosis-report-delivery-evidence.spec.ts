import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page, type Route } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const captureEnabled = process.env.DIAGNOSIS_REPORT_DELIVERY_EVIDENCE_CAPTURE === '1';
const artifactDirectory = path.resolve(process.cwd(), 'artifacts/commercial-ui/diagnosis-report-delivery-1440/playwright');
const authSecret = 'diagnosis-delivery-evidence-secret';
const classId = 'class-evidence';
const reportId = 'report-student-evidence';

test.skip(!captureEnabled, 'run with DIAGNOSIS_REPORT_DELIVERY_EVIDENCE_CAPTURE=1');
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => mkdirSync(artifactDirectory, { recursive: true }));

test('captures teacher delivery, evidence, registered action and disposition at 1440px', async ({ page }) => {
  await installSession(page, 'TEACHER', 'teacher-evidence');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await installFixture(page, 'teacher');
  await page.goto(`/teacher/classes/${classId}/diagnosis-reports/${reportId}`, { waitUntil: 'networkidle' });
  await expect(page.locator('[data-diagnosis-delivery-role="teacher"]')).toBeVisible();
  await page.getByText('查看允许的证据摘要').click();
  await expect(page.getByText('知识点学习进度：1 项')).toBeVisible();
  await page.getByRole('button', { name: '待处理' }).first().click();
  await expect(page.getByText('处置状态已记录；诊断风险判断保持不变。')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(artifactDirectory, 'teacher-delivery-1440-light.png'), fullPage: true });
});

test('captures an explicit PDF recovery state', async ({ page }) => {
  await installSession(page, 'TEACHER', 'teacher-evidence');
  await page.setViewportSize({ width: 1440, height: 900 });
  await installFixture(page, 'pdf-failure');
  await page.goto(`/teacher/classes/${classId}/diagnosis-reports/${reportId}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '导出 PDF' }).click();
  await expect(page.getByText('PDF 生成失败，请返回报告后重试。', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(artifactDirectory, 'teacher-export-failure-1440-light.png'), fullPage: true });
});

test('captures the student-safe report without teacher controls at 320px', async ({ page }) => {
  await installSession(page, 'STUDENT', 'student-evidence');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await installFixture(page, 'student');
  await page.goto(`/diagnosis-reports/${reportId}`, { waitUntil: 'networkidle' });
  await expect(page.locator('[data-diagnosis-delivery-role="student"]')).toBeVisible();
  await expect(page.getByText('报告处置')).toHaveCount(0);
  await expect(page.getByText('教师强制生成')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(artifactDirectory, 'student-safe-delivery-320-dark.png'), fullPage: true });
});

async function installFixture(page: Page, mode: 'teacher' | 'student' | 'pdf-failure') {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/auth/session') return route.continue();
    if (pathname.endsWith('/student-safe') && request.method() === 'GET') {
      return fulfill(route, { projection: studentProjection(), actions: [], dispositionEvents: [] });
    }
    if (pathname.endsWith(`/diagnosis-reports/${reportId}`) && request.method() === 'GET') {
      return fulfill(route, { projection: teacherProjection(), actions: teacherActions(), dispositionEvents: [] });
    }
    if (pathname.endsWith('/dispositions') && request.method() === 'POST') {
      return fulfill(route, { event: {
        id: 'event-evidence', targetKind: 'finding', targetKey: 'finding:1', action: 'pending',
        actionRef: null, result: 'recorded', createdAt: '2026-08-19T09:00:00.000Z',
      } }, 201);
    }
    if (pathname.endsWith('/pdf')) {
      if (mode === 'pdf-failure') return fulfill(route, { error: 'PDF 生成失败，请返回报告后重试。' }, 503);
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.7\n' });
    }
    return route.abort('blockedbyclient');
  });
}

function teacherProjection() {
  return {
    ...baseProjection(),
    role: 'teacher',
    roleVersion: 'teacher-report.v1',
    audienceUserId: null,
    title: '学生学情诊断报告（教师版）',
    privacyNotice: '教师内部受控材料；不得包含原始答案、私密对话或隐藏评测内容。',
    riskSummary: { total: 1, byType: { stagnation: 0, constraint: 1, cross_domain: 0 }, bySeverity: { low: 0, medium: 1, high: 0 } },
    generationReason: 'new-evidence',
    forceReason: null,
  };
}

function studentProjection() {
  return {
    ...baseProjection(),
    role: 'student',
    roleVersion: 'student-safe-report.v1',
    audienceUserId: 'student-evidence',
    title: '个人学情诊断报告',
    privacyNotice: '本报告仅呈现你的个人结论和安全证据摘要，不包含同伴数据或教师内部说明。',
  };
}

function baseProjection() {
  return {
    reportId,
    projectionVersion: 'diagnosis-delivery.v1',
    scopeType: 'student',
    classId,
    targetUserId: 'student-evidence',
    summary: '稳定裕度判断仍需加强，建议结合已学知识复核关键定义。',
    findings: [{
      targetKey: 'finding:1',
      title: '稳定裕度判断薄弱',
      summary: '当前证据支持在相位裕度与增益裕度辨析上继续练习。',
      riskType: 'constraint',
      severity: 'medium',
      confidence: 'medium',
      evidence: { state: 'available', total: 1, sources: [{ kind: 'progress', label: '知识点学习进度', count: 1 }] },
      hasPreparationEntry: true,
    }],
    confidence: 'medium',
    limitations: ['作业和测验证据尚未接入当前诊断结构。'],
    evidenceCutoff: '2026-08-19T08:00:00.000Z',
    generatedAt: '2026-08-19T08:05:00.000Z',
    generatorVersion: 'teacher-diagnosis.v1',
    ruleVersion: 'teacher-diagnosis-preflight.v1',
  };
}

function teacherActions() {
  return [
    { kind: 'student', label: '查看学生详情', href: `/teacher/classes/${classId}/students/student-evidence`, targetKey: 'report' },
    { kind: 'preparation', label: '进入备课工作台', href: '/teacher/preparation?knowledgeNodeId=node-margin', targetKey: 'finding:1' },
    { kind: 'remediation', label: '已注册补练资源：稳定裕度补练', href: '/teacher/resources/resource-nodes?q=margin', targetKey: 'finding:1' },
  ];
}

async function installSession(page: Page, role: 'TEACHER' | 'STUDENT', id: string) {
  const token = await encode({ secret: authSecret, maxAge: 3600, token: { id, sub: id, role, name: '证据用户', email: `${id}@example.invalid` } });
  await page.context().addCookies([{ name: 'next-auth.session-token', value: token, url: 'http://localhost:3219', httpOnly: true, sameSite: 'Lax' }]);
}

function fulfill(route: Route, json: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}
