import 'dotenv/config';

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/teacher-assignment-grading-closure-1731/playwright');
const desktopWidths = [768, 1024, 1440] as const;
const mobileWidths = [320, 375] as const;
const evidenceEntries: Array<{ name: string; viewport: number; screenshot: string; widthEvidence: string }> = [];

const assignmentId = 'assignment-1731';
const submissionId = 'submission-1731';
const snapshotId = 'snapshot-1731';

test.describe.configure({ timeout: 120_000, mode: 'serial' });
test.afterAll(() => {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'screenshots.json'), JSON.stringify({ generatedAt: new Date().toISOString(), entries: evidenceEntries }, null, 2));
});

async function addSession(context: BrowserContext, role: 'TEACHER' | 'STUDENT') {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: role === 'TEACHER'
      ? { id: 'teacher-grading-1731', email: 'grading-1731@example.com', name: '批改验收教师', role: 'TEACHER' }
      : { id: 'student-grading-1731', email: 'student-1731@example.com', name: '批改验收学生', role: 'STUDENT' },
  });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax', secure: false, expires: Math.floor(Date.now() / 1000) + 3600 }]);
}

const submissionsPayload = {
  items: [{
    submissionId,
    studentId: 'student-grading-1731',
    studentName: '陈同学',
    studentNumber: '24010201',
    classId: 'class-1731',
    state: 'SUBMITTED',
    reviewState: 'APPROVED_PENDING_RELEASE',
    approvedTotal: 9,
    requiredQuestionCount: 2,
    submittedRequiredCount: 2,
    pendingReviewCount: 0,
    approvedQuestionCount: 2,
    grading: {
      snapshotId,
      source: 'AI',
      state: 'AWAITING_CONFIRMATION',
      operationState: 'SUCCEEDED',
    },
    gradingDiagnostic: { code: 'GRADING_SNAPSHOT_EXISTS', message: '这份作业已有批改快照，请进入审阅或查看已确认结果。', canStartAi: false },
    questions: [
      { id: 'question-1731-1', questionId: 'question-1731-1', stableQuestionId: 'stable-q1', title: '说明二阶系统阻尼比与超调量的关系。', orderIndex: 0, responseKind: 'SUBJECTIVE_TEXT', status: 'APPROVED', reviewId: 'review-q1', gradingRunId: 'run-q1' },
      { id: 'question-1731-2', questionId: 'question-1731-2', stableQuestionId: 'stable-q2', title: '绘制系统根轨迹并说明稳定性条件。', orderIndex: 1, responseKind: 'SUBJECTIVE_TEXT', status: 'APPROVED', reviewId: 'review-q2', gradingRunId: 'run-q2' },
    ],
    updatedAt: '2026-08-31T10:00:00.000Z',
  }],
};

const closurePayload = {
  grade: {
    snapshotId,
    state: 'AWAITING_CONFIRMATION',
    totalScore: 9,
    overallComment: '第 1 题：推导完整，结论正确。\n第 2 题：根轨迹分析准确。',
    questionProjection: [
      { questionId: 'question-1731-1', snapshotItemId: 'item-1', attemptId: 'attempt-1', approvalSnapshotId: 'approval-1', status: 'COMPLETE', source: 'AI', score: 4, comment: '推导完整，结论正确。', criteria: [{ criterionId: 'c1', score: 4, comment: '建模正确' }], annotations: [] },
      { questionId: 'question-1731-2', snapshotItemId: 'item-2', attemptId: 'attempt-2', approvalSnapshotId: 'approval-2', status: 'COMPLETE', source: 'MANUAL', score: 5, comment: '根轨迹分析准确。', criteria: [], annotations: [{ id: 'a1', comment: '渐近线角度计算正确', status: 'ACTIVE', anchor: { precision: 'BLOCK' } }] },
    ],
    publishing: false,
  },
  snapshot: { id: snapshotId, attemptVectorHash: `sha256:${'v'.repeat(64)}`, originalDueAt: '2026-08-30T12:00:00.000Z' },
  questions: [
    { snapshotItemId: 'item-1', questionId: 'question-1731-1', promptSnapshot: { prompt: '说明二阶系统阻尼比与超调量的关系。' }, approvalHistory: [{ id: 'approval-1', source: 'AI', questionTotal: 4, overallComment: '推导完整，结论正确。', approvedAt: '2026-08-31T09:00:00.000Z', reviewedPdfId: null }] },
    { snapshotItemId: 'item-2', questionId: 'question-1731-2', promptSnapshot: { prompt: '绘制系统根轨迹并说明稳定性条件。' }, approvalHistory: [{ id: 'approval-2', source: 'MANUAL', questionTotal: 5, overallComment: '根轨迹分析准确。', approvedAt: '2026-08-31T09:30:00.000Z', reviewedPdfId: null }] },
  ],
};

const studentDetailPayload = {
  id: assignmentId,
  revisionId: 'revision-1731',
  title: '控制系统综合分析作业',
  instructions: '完成下列分析题。',
  availableAt: '2026-08-20T00:00:00.000Z',
  dueAt: '2026-08-30T12:00:00.000Z',
  state: 'REVIEWED',
  nextAction: 'view-feedback',
  contextStatus: 'CURRENT',
  historicalOnly: false,
  canMutate: false,
  submittedRequiredCount: 2,
  requiredQuestionCount: 2,
  approvedTotal: 9,
  feedbackStatus: 'PUBLISHED',
  resultPackage: {
    version: 'assignment-student-result.v1',
    totalScore: 9,
    overallComment: '第 1 题：推导完整，结论正确。\n第 2 题：根轨迹分析准确。',
    releasedAt: '2026-08-31T10:00:00.000Z',
    questions: [
      { questionId: 'question-1731-1', score: 4, comment: '推导完整，结论正确。', criteria: [{ criterionId: 'c1', score: 4, comment: '建模正确' }], annotations: [], referenceAnswer: '阻尼比增大超调量减小。', scoringStandard: '建模与结论各 2 分。' },
      { questionId: 'question-1731-2', score: 5, comment: '根轨迹分析准确。', criteria: [], annotations: [], referenceAnswer: '渐近线交于负实轴。', scoringStandard: '方向、渐近线与稳定性各占分。' },
    ],
  },
  questions: [
    { id: 'question-1731-1', stableQuestionId: 'stable-q1', title: '说明二阶系统阻尼比与超调量的关系。', orderIndex: 0, responseKind: 'SUBJECTIVE_TEXT', state: 'REVIEWED', points: 4, textDraft: null, assets: [] },
    { id: 'question-1731-2', stableQuestionId: 'stable-q2', title: '绘制系统根轨迹并说明稳定性条件。', orderIndex: 1, responseKind: 'SUBJECTIVE_TEXT', state: 'REVIEWED', points: 5, textDraft: null, assets: [] },
  ],
  feedback: [],
  policyReason: undefined,
};

async function mockTeacherConsole(page: Page) {
  await page.route(`**/api/teacher/assignments/${assignmentId}/submissions`, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(submissionsPayload) }));
}

async function mockGradeWorkspace(page: Page) {
  await page.route(`**/api/teacher/assignments/${assignmentId}/submissions/${submissionId}/grade*`, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(closurePayload) });
    const body = JSON.parse(route.request().postData() ?? '{}');
    if (body.action === 'CONFIRM') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ submissionId, confirmation: { id: 'confirmation-1731', totalScore: 9, questionProjection: closurePayload.grade.questionProjection }, replay: true }) });
    }
    if (body.action === 'RELEASE') {
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ submissionId, release: { snapshotId, state: 'AWAITING_CONFIRMATION', publishing: true, retriedApprovals: ['approval-1', 'approval-2'], publishedApprovals: [] }, replay: false }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ submissionId, grade: closurePayload.grade }) });
  });
}

async function capture(page: Page, name: string) {
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: join(evidenceDir, `${name}.png`), fullPage: true });
  const width = await page.evaluate(() => ({ viewport: window.innerWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
  writeFileSync(join(evidenceDir, `${name}-width.json`), JSON.stringify(width, null, 2));
  evidenceEntries.push({ name, viewport: width.viewport, screenshot: `${name}.png`, widthEvidence: `${name}-width.json` });
  expect(width.body).toBeLessThanOrEqual(width.viewport);
  expect(width.document).toBeLessThanOrEqual(width.viewport);
}

for (const width of desktopWidths) {
  test(`desktop grading console remains complete at ${width}px`, async ({ page, context }) => {
    await addSession(context, 'TEACHER');
    await mockTeacherConsole(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/teacher/assignments/${assignmentId}/grading`);

    await expect(page.getByText('陈同学')).toBeVisible();
    await expect(page.getByText('待教师确认')).toBeVisible();
    await expect(page.getByText('这份作业已有批改快照，请进入审阅或查看已确认结果。')).toBeVisible();
    await capture(page, `grading-console-${width}`);
  });
}

for (const width of [...desktopWidths, ...mobileWidths]) {
  test(`grade workspace supports confirm and release at ${width}px`, async ({ page, context }) => {
    await addSession(context, 'TEACHER');
    await mockGradeWorkspace(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/teacher/assignments/${assignmentId}/submissions/${submissionId}/grade?snapshotId=${snapshotId}`);

    await expect(page.getByRole('heading', { name: '整份作业审阅' })).toBeVisible();
    await expect(page.getByText('总分 9')).toBeVisible();
    await expect(page.getByText('第 1 题：推导完整，结论正确。')).toBeVisible();

    const confirm = page.getByRole('button', { name: '确认结果' });
    await expect(confirm).toBeVisible();
    await capture(page, `grade-workspace-awaiting-${width}`);
    await confirm.click();
    await expect(page.getByText('教师确认已记录，可逐份发布。')).toBeVisible();

    const release = page.getByRole('button', { name: '发布给学生' });
    await expect(release).toBeVisible();
    await release.click();
    await expect(page.getByText('已向该学生发布结果包。')).toBeVisible();
    await capture(page, `grade-workspace-released-${width}`);
  });
}

for (const width of [...desktopWidths, ...mobileWidths]) {
  test(`student workspace shows the released result at ${width}px`, async ({ page, context }) => {
    await addSession(context, 'STUDENT');
    await page.route(`**/api/student/assignments/${assignmentId}*`, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ assignment: studentDetailPayload }) }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/missions/assignments/${assignmentId}`);

    await expect(page.getByText('成绩、批注、参考答案和评分标准将在教师确认并发布后显示。')).toHaveCount(0);
    await expect(page.getByText('总分')).toBeVisible();
    await expect(page.getByText('推导完整，结论正确。', { exact: true })).toBeVisible();
    await expect(page.getByText('评分标准').first()).toBeVisible();
    await expect(page.getByLabel('作业结果').getByRole('button', { name: '第 2 题' })).toBeVisible();
    await capture(page, `student-result-${width}`);
  });
}
