import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, test, type Page, type Route } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import {
  computeCaptureRevisionProof,
  DIAGNOSIS_REPORT_DELIVERY_CAPTURE_SOURCE_FILES,
  REVISION_PROBE_PATH,
  type CaptureRevisionProof,
} from '@/lib/commercial-ui-capture-revision';
import { assertDiagnosisDeliveryCaptureProofMatches } from '@/lib/diagnosis-report-delivery-evidence';

const captureEnabled = process.env.DIAGNOSIS_REPORT_DELIVERY_EVIDENCE_CAPTURE === '1';
const profile = process.env.ACT_LOCAL_QA_CAPTURE_PROFILE;
const repositoryRoot = process.cwd();
const artifactDirectory = path.resolve(repositoryRoot, 'artifacts/commercial-ui/diagnosis-report-delivery-1440/playwright');
const stagingDirectory = path.join(os.tmpdir(), `act-diagnosis-report-delivery-evidence-${process.pid}`);
const authSecret = process.env.NEXTAUTH_SECRET
  ?? process.env.AUTH_SECRET
  ?? 'playwright-local-auth-secret-at-least-32-bytes';
const classId = 'class-evidence';
const reportId = 'report-student-evidence';

type CapturedState = {
  file: string;
  sha256: string;
  viewport: { width: number; height: number };
  assertions: string[];
  bytes: Uint8Array;
};

let baseUrl = '';
let initialRevision: CaptureRevisionProof | null = null;
let initialServiceRevision: CaptureRevisionProof | null = null;
const capturedStates: CapturedState[] = [];

test.skip(!captureEnabled, 'run with DIAGNOSIS_REPORT_DELIVERY_EVIDENCE_CAPTURE=1');
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({}, testInfo) => {
  if (profile !== 'diagnosis-report-delivery') {
    throw new Error('Diagnosis delivery evidence requires ACT_LOCAL_QA_CAPTURE_PROFILE=diagnosis-report-delivery.');
  }
  if (typeof testInfo.project.use.baseURL !== 'string') {
    throw new Error('Diagnosis delivery evidence requires an explicit Playwright baseURL.');
  }
  baseUrl = testInfo.project.use.baseURL.replace(/\/$/u, '');
  initialRevision = computeCaptureRevisionProof(repositoryRoot, DIAGNOSIS_REPORT_DELIVERY_CAPTURE_SOURCE_FILES);
  if (!initialRevision.clean) throw new Error('Diagnosis delivery evidence requires a clean worktree before capture.');
  initialServiceRevision = await fetchRevisionProof(baseUrl);
  assertDiagnosisDeliveryCaptureProofMatches(initialRevision, initialServiceRevision, 'capture start');
  await mkdir(stagingDirectory, { recursive: true });
});

test.afterAll(async () => {
  if (!captureEnabled) return;
  if (!initialRevision || !initialServiceRevision || capturedStates.length !== 3) {
    throw new Error('Diagnosis delivery evidence did not complete every required capture state.');
  }
  const finalRevision = computeCaptureRevisionProof(repositoryRoot, DIAGNOSIS_REPORT_DELIVERY_CAPTURE_SOURCE_FILES);
  assertDiagnosisDeliveryCaptureProofMatches(initialRevision, finalRevision, 'capture end local revision');
  const finalServiceRevision = await fetchRevisionProof(baseUrl);
  assertDiagnosisDeliveryCaptureProofMatches(initialRevision, finalServiceRevision, 'capture end service revision');

  const sourceFiles = await Promise.all(DIAGNOSIS_REPORT_DELIVERY_CAPTURE_SOURCE_FILES.map(async (file) => ({
    file,
    gitBlobId: git('rev-parse', `${initialRevision!.commitSha}:${file}`),
    sha256: sha256(await readFile(path.join(repositoryRoot, file))),
  })));
  await mkdir(artifactDirectory, { recursive: true });
  for (const state of capturedStates) {
    await writeFile(path.join(artifactDirectory, state.file), state.bytes);
  }
  await writeFile(path.join(path.dirname(artifactDirectory), 'manifest.json'), `${JSON.stringify({
    schemaVersion: 'commercial-ui-evidence.v1',
    status: 'passed',
    captureProfile: profile,
    baseUrl,
    revisionProbePath: REVISION_PROBE_PATH,
    sourceRevision: initialRevision.commitSha,
    treeSha: initialRevision.treeSha,
    sourceFingerprint: initialRevision.sourceFingerprint,
    initialServiceRevision,
    finalServiceRevision,
    sourceFiles,
    provenance: 'The dedicated Playwright service is non-reusable. Capture reads the actual baseUrl revision probe before and after every state, rejects dirty or mismatched runtime bytes, and publishes output only after the final proof.',
    captures: capturedStates.map(({ bytes: _bytes, ...state }) => state),
  }, null, 2)}\n`);
});

test('captures teacher delivery, evidence, registered action and disposition at 1440px', async ({ page }) => {
  await installSession(page, 'TEACHER', 'teacher-evidence');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await installFixture(page, 'TEACHER');
  await page.goto(`/teacher/classes/${classId}/diagnosis-reports/${reportId}`, { waitUntil: 'networkidle' });
  await expect(page.locator('[data-diagnosis-delivery-role="teacher"]')).toBeVisible();
  await page.getByText('查看允许的证据摘要').click();
  await expect(page.getByText('知识点学习进度：1 项')).toBeVisible();
  await expect(page.getByText('完成一次针对性练习后查看新的诊断。')).toBeVisible();
  await expect(page.getByRole('link', { name: '进入备课工作台' })).toBeVisible();
  await page.getByRole('button', { name: '待处理' }).first().click();
  await expect(page.getByText('处置状态已记录；诊断风险判断保持不变。')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, 'teacher-delivery-1440-light.png', { width: 1440, height: 1050 }, [
    'teacher projection visible', 'bounded evidence visible', 'report-level preparation entry visible', 'suggestion visible', 'disposition recorded', 'no horizontal overflow',
  ]);
});

test('captures the teacher print-only delivery controls', async ({ page }) => {
  await installSession(page, 'TEACHER', 'teacher-evidence');
  await page.setViewportSize({ width: 1440, height: 900 });
  await installFixture(page, 'TEACHER');
  await page.goto(`/teacher/classes/${classId}/diagnosis-reports/${reportId}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: '打印' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 PDF' })).toHaveCount(0);
  await capture(page, 'teacher-print-only-1440-light.png', { width: 1440, height: 900 }, [
    'print control visible', 'PDF export control absent',
  ]);
});

test('captures the student-safe report without teacher controls at 320px', async ({ page }) => {
  await installSession(page, 'TEACHER', 'teacher-evidence');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await installFixture(page, 'STUDENT');
  await page.goto(`/diagnosis-reports/${reportId}`, { waitUntil: 'networkidle' });
  await expect(page.locator('[data-diagnosis-delivery-role="student"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '打印' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 PDF' })).toHaveCount(0);
  await expect(page.getByText('学习建议')).toBeVisible();
  await expect(page.getByText('报告处置')).toHaveCount(0);
  await expect(page.getByText('教师强制生成')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await capture(page, 'student-safe-delivery-320-dark.png', { width: 320, height: 844 }, [
    'student-safe projection visible', 'print control visible', 'PDF export control absent', 'teacher controls absent', 'force reason absent', 'no horizontal overflow',
  ]);
});

async function capture(page: Page, file: string, viewport: { width: number; height: number }, assertions: string[]) {
  const bytes = await page.screenshot({ path: path.join(stagingDirectory, file), fullPage: true });
  capturedStates.push({ file, sha256: sha256(bytes), viewport, assertions, bytes });
}

async function installFixture(page: Page, role: 'TEACHER' | 'STUDENT') {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/auth/session') {
      return fulfill(route, { user: { id: role === 'TEACHER' ? 'teacher-evidence' : 'student-evidence', role }, expires: '2026-08-19T10:00:00.000Z' });
    }
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
    suggestions: [{
      targetKey: 'finding:1',
      source: 'finding',
      text: '建议围绕“稳定裕度判断薄弱”复核关联知识点，并完成一次针对性练习后查看新的诊断。',
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
    { kind: 'preparation', label: '进入备课工作台', href: '/teacher/smart-prep', targetKey: 'report' },
    { kind: 'remediation', label: '已注册补练资源：稳定裕度补练', href: '/teacher/resources/resource-nodes?q=margin', targetKey: 'finding:1' },
  ];
}

async function installSession(page: Page, role: 'TEACHER' | 'STUDENT', id: string) {
  const token = await encode({ secret: authSecret, maxAge: 3600, token: { id, sub: id, role, name: '证据用户', email: `${id}@example.invalid` } });
  await page.context().addCookies([{ name: 'next-auth.session-token', value: token, url: baseUrl, httpOnly: true, sameSite: 'Lax' }]);
}

function fulfill(route: Route, json: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
}

async function fetchRevisionProof(targetBaseUrl: string): Promise<CaptureRevisionProof> {
  const response = await fetch(new URL(REVISION_PROBE_PATH, `${targetBaseUrl}/`), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Diagnosis delivery revision probe failed: ${response.status}`);
  return await response.json() as CaptureRevisionProof;
}

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
}

function sha256(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}
