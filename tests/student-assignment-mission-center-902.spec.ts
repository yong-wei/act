import 'dotenv/config';

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/student-assignment-mission-center-902/playwright');
const evidence: Array<{ name: string; viewport: number; screenshot: string; metrics: string }> = [];

test.describe.configure({ timeout: 120_000, mode: 'serial' });
test.afterAll(() => {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'screenshots.json'), JSON.stringify({ generatedAt: new Date().toISOString(), evidenceBoundary: 'Authenticated UI with deterministic route mocks; production database and object store are not exercised.', entries: evidence }, null, 2));
});

async function addStudentSession(context: BrowserContext) {
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret', token: { id: 'student-902', email: 'student-902@example.com', name: '任务验收学生', role: 'STUDENT' } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax', secure: false, expires: Math.floor(Date.now() / 1000) + 3600 }]);
}

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'assignment-902',
    revisionId: 'revision-902',
    title: '闭环系统稳态误差分析',
    instructions: '逐题完成分析。文本与附件仅绑定当前题目。',
    availableAt: '2026-07-10T00:00:00.000Z',
    dueAt: '2026-07-20T10:00:00.000Z',
    state: 'IN_PROGRESS',
    nextAction: 'continue-answering',
    submittedRequiredCount: 0,
    requiredQuestionCount: 2,
    contextStatus: 'CURRENT',
    historicalOnly: false,
    canMutate: true,
    questions: [
      { id: 'question-text', stableQuestionId: 'stable-text', orderIndex: 0, promptText: '说明系统型别与阶跃输入稳态误差的关系。', responseType: 'SUBJECTIVE_TEXT', points: 10, required: true, state: 'DRAFT', version: 2, currentAttemptNumber: null, textDraft: '已有草稿' },
      { id: 'question-file', stableQuestionId: 'stable-file', orderIndex: 1, promptText: '上传本题计算过程，并简述关键结论。', responseType: 'SUBJECTIVE_FILE', points: 10, required: true, state: 'NOT_STARTED', version: 1, currentAttemptNumber: null, textDraft: '' },
    ],
    ...overrides,
  };
}

async function mockAssignmentRoutes(page: Page, list = [assignment()]) {
  let downloadGrantCalls = 0;
  let readyFinalizeCalls = 0;
  await page.route('**/api/student/assignments', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ assignments: list }) }));
  await page.route('**/api/student/assignments/assignment-902', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ assignment: assignment() }) }));
  await page.route('**/api/student/assignments/assignment-902/answers/question-text', async (route) => {
    if (route.request().method() === 'PATCH') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ answer: { id: 'answer-text', state: 'DRAFT', version: 3, textDraft: '更新后的草稿' } }) });
    return route.fallback();
  });
  await page.route('**/api/student/assignments/assignment-902/answers/question-text/submit', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ attempt: { id: 'attempt-1', attemptNumber: 1 }, assignmentState: 'IN_PROGRESS', submittedRequiredCount: 1 }) }));
  await page.route('**/api/student/assignments/assignment-902/answers/question-text/history', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ attempts: [{ id: 'attempt-1', attemptNumber: 1, submittedAt: '2026-07-11T08:00:00.000Z', textSnapshot: '正式提交内容', assets: [{ id: 'history-asset-1', displayName: 'submitted-calculation.pdf', mimeType: 'application/pdf', sizeBytes: 2048, canDownload: true }] }] }) }));
  await page.route('**/api/student/assignments/assignment-902/answers/question-text/assets/history-asset-1/read', (route) => {
    downloadGrantCalls += 1;
    return downloadGrantCalls === 1
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '下载服务暂不可用' }) })
      : route.fulfill({ contentType: 'application/json', body: JSON.stringify({ access: { url: '/api/student/assignment-assets/download?token=one-time-902', expiresAt: '2026-07-11T08:10:00.000Z' } }) });
  });
  await page.route('**/api/student/assignment-assets/download?token=one-time-902', (route) => route.fulfill({ contentType: 'application/pdf', body: 'safe-pdf-content' }));
  await page.route('**/api/student/assignments/assignment-902/answers/question-file/upload-sign', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ upload: { intentId: 'intent-ready-902', url: 'https://upload.test/opaque-902', expiresAt: '2026-07-11T08:10:00.000Z', requiredHeaders: { 'content-type': 'application/pdf' } } }) }));
  await page.route('https://upload.test/opaque-902', (route) => route.fulfill({ status: 200, body: '' }));
  await page.route('**/api/student/assignments/assignment-902/answers/question-file/finalize**', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'CLEAN', intentId: 'intent-ready-902' }) });
    readyFinalizeCalls += 1;
    return readyFinalizeCalls === 1
      ? route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ status: 'SCANNING', intentId: 'intent-ready-902' }) })
      : route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'READY', intentId: 'intent-ready-902', asset: { id: 'asset-902', displayName: 'calculation.pdf', mimeType: 'application/pdf', sizeBytes: 12, state: 'FINALIZED', finalizedAt: '2026-07-11T08:02:00.000Z' } }) });
  });
}

function profilePayload() {
  return {
    user: { id: 'student-902', name: '任务验收学生', email: 'student-902@example.com', role: 'STUDENT' },
    profile: { studentNumber: 'S902', classId: 'class-902', className: '自控 2402', techScore: 80, ethicsScore: 90 },
    statistics: { totalSimulations: 0, completedMissions: 0, ethicalViolations: 0, totalSimulationTime: 0, averageScore: 0 },
    competency: { overallScore: 70, level: '成长中', trend: '保持稳定', strengths: [], weaknesses: [], dimensions: [] },
    recentActivity: { preview: [], grouped: [], total: 0 },
    missionProgress: { total: 0, completed: 0, unlocked: 0, locked: 0 },
    personalizedReinforcement: { resources: [], adaptivePractice: { estimatedAbility: null, confidenceInterval: null, weakAreas: [], recommendedFocus: [], questionCount: 0, actionUrl: '/assessment/adaptive-practice?intent=practice' } },
    evidenceStatus: { state: 'missing', confidence: { state: 'missing', level: 'low', score: 0, evidenceCount: 0, sourceCompleteness: 0 }, evidenceWindow: { daysCovered: 0 }, sourceCounts: {}, statusMarkers: ['missing-source'], restrictedReason: null, staleReason: null, refreshedAt: null, generatedAt: new Date(0).toISOString() },
    arenaPortfolio: { controllerCount: 0, identificationModels: [], submissionSummary: { total: 0, valid: 0, invalid: 0, pending: 0 }, personalBestByTask: [], frequentFailureObjects: [], improvingMetrics: [], growth: { capabilityCoverage: { covered: 0, total: 0 }, evidenceAvailable: false, weakCapabilities: [], improvingCapabilities: [], strongCapabilities: [], nextChallenges: [] } },
  };
}

async function capture(page: Page, name: string) {
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: join(evidenceDir, `${name}.png`), fullPage: true });
  const metrics = await page.evaluate(() => ({ viewport: window.innerWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
  writeFileSync(join(evidenceDir, `${name}-metrics.json`), JSON.stringify(metrics, null, 2));
  evidence.push({ name, viewport: metrics.viewport, screenshot: `${name}.png`, metrics: `${name}-metrics.json` });
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport);
}

for (const width of [320, 375, 1024, 1440]) {
  test(`task center and assignment detail remain usable at ${width}px`, async ({ page, context }) => {
    await addStudentSession(context);
    await mockAssignmentRoutes(page);
    await page.setViewportSize({ width, height: width < 500 ? 760 : 900 });
    await page.goto('/missions');
    await expect(page.getByRole('link', { name: '主线作业' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('闭环系统稳态误差分析')).toBeVisible();
    await capture(page, `task-center-${width}`);
    await page.getByRole('link', { name: /继续作答/ }).click();
    await expect(page.getByRole('heading', { name: '说明系统型别与阶跃输入稳态误差的关系。' })).toBeVisible();
    await expect(page.getByText('每题独立正式提交。')).toBeVisible();
    await capture(page, `assignment-detail-${width}`);
  });
}

test('task center distinguishes loading, empty, filtered-empty, error recovery, and progression tab', async ({ page, context }) => {
  await addStudentSession(context);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/student/assignments', async (route) => { await gate; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ assignments: [] }) }); });
  await page.goto('/missions');
  await expect(page.getByLabel('正在加载主线作业')).toBeVisible();
  release();
  await expect(page.getByRole('heading', { name: '暂无主线作业' })).toBeVisible();
  await page.getByRole('link', { name: '任务进阶', exact: true }).click();
  await expect(page.getByRole('link', { name: '任务进阶', exact: true })).toHaveAttribute('aria-current', 'page');

  await page.unroute('**/api/student/assignments');
  await mockAssignmentRoutes(page, [assignment({ state: 'REVIEWED', nextAction: 'view-feedback' })]);
  await page.goto('/missions');
  await page.getByRole('button', { name: /待完成/ }).click();
  await expect(page.getByRole('heading', { name: '此筛选下没有作业' })).toBeVisible();

  await page.unroute('**/api/student/assignments');
  let calls = 0;
  await page.route('**/api/student/assignments', (route) => { calls += 1; return calls === 1 ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '服务暂不可用' }) }) : route.fulfill({ contentType: 'application/json', body: JSON.stringify({ assignments: [assignment()] }) }); });
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: '服务暂不可用' })).toContainText('服务暂不可用');
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.getByText('闭环系统稳态误差分析')).toBeVisible();
});

test('historical submission keeps an exact read-only revision link', async ({ page, context }) => {
  await addStudentSession(context);
  await mockAssignmentRoutes(page, [assignment({
    revisionId: 'revision/history-902',
    contextStatus: 'HISTORICAL',
    historicalOnly: true,
    canMutate: false,
  })]);
  await page.goto('/missions');
  await expect(page.getByRole('link', { name: '查看历史提交' }))
    .toHaveAttribute('href', '/missions/assignments/assignment-902?revisionId=revision%2Fhistory-902');
});

test('question change, submit result, retry, and history return restore exact focus', async ({ page, context }) => {
  await addStudentSession(context);
  await mockAssignmentRoutes(page);
  let submitCalls = 0;
  await page.unroute('**/api/student/assignments/assignment-902/answers/question-text/submit');
  await page.route('**/api/student/assignments/assignment-902/answers/question-text/submit', (route) => { submitCalls += 1; return submitCalls === 1 ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: '草稿版本已变化，请保存后重试' }) }) : route.fulfill({ contentType: 'application/json', body: JSON.stringify({ attempt: { id: 'attempt-1', attemptNumber: 1 }, assignmentState: 'IN_PROGRESS', submittedRequiredCount: 1 }) }); });
  await page.goto('/missions/assignments/assignment-902');
  await page.getByRole('button', { name: /第 2 题/ }).click();
  await expect(page.getByRole('heading', { name: '上传本题计算过程，并简述关键结论。' })).toBeFocused();
  await page.getByRole('button', { name: /第 1 题/ }).click();
  await page.getByRole('button', { name: '提交本题' }).click();
  const error = page.getByRole('alert').filter({ hasText: '草稿版本已变化' });
  await expect(error).toBeFocused();
  await error.getByRole('link', { name: '前往受影响的控件' }).click();
  await expect(page.getByRole('button', { name: '提交本题' })).toBeFocused();
  await page.getByRole('button', { name: '提交本题' }).click();
  const success = page.getByRole('status').filter({ hasText: '本题已正式提交' });
  const nextQuestion = success.getByRole('button', { name: '前往下一未提交题' });
  await expect(success).toBeFocused();
  await expect(nextQuestion).toBeVisible();
  await nextQuestion.click();
  await expect(page.getByRole('heading', { name: '上传本题计算过程，并简述关键结论。' })).toBeFocused();
  await page.getByRole('button', { name: /第 1 题/ }).click();
  await page.getByRole('button', { name: '提交历史' }).click();
  await expect(page.getByRole('heading', { name: '本题提交历史' })).toBeFocused();
  const download = page.getByRole('button', { name: '下载附件：submitted-calculation.pdf' });
  await expect(download).toBeVisible();
  await download.click();
  const downloadError = page.getByRole('alert').filter({ hasText: '下载服务暂不可用' });
  await expect(downloadError).toBeFocused();
  await downloadError.getByRole('link', { name: '前往受影响的控件' }).click();
  await expect(download).toBeFocused();
  await download.click();
  await expect(page.getByRole('status').filter({ hasText: 'submitted-calculation.pdf' })).toContainText('已开始下载');
  await page.getByRole('button', { name: '返回本题' }).click();
  await expect(page.getByRole('button', { name: '提交历史' })).toBeFocused();
});

test('profile task-center action exposes authoritative pending count while class join remains available', async ({ page, context }) => {
  await addStudentSession(context);
  await page.route('**/api/user/profile', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(profilePayload()) }));
  await page.route('**/api/student/assignments', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ assignments: [assignment(), assignment({ id: 'assignment-902-b' }), assignment({ id: 'assignment-902-c', state: 'SUBMITTED', nextAction: 'view-history', canMutate: false })] }) }));
  await page.goto('/profile');
  const taskCenter = page.getByRole('link', { name: '任务中心，2 项待完成' });
  await expect(taskCenter).toBeVisible();
  await expect(taskCenter.getByRole('status')).toHaveText('2 项待完成');
  await expect(page.getByRole('link', { name: '加入课堂 / 班级' })).toHaveAttribute('href', '/classroom/join');
  await capture(page, 'profile-task-center-pending');
});

test('keyboard user can save text and upload one question attachment without a whole-assignment action', async ({ page, context }) => {
  await addStudentSession(context);
  await mockAssignmentRoutes(page);
  await page.goto('/missions/assignments/assignment-902');
  await page.getByLabel('文本作答').fill('更新后的草稿');
  await page.getByRole('button', { name: '保存本题草稿' }).click();
  await expect(page.getByRole('status').filter({ hasText: '本题草稿已保存' })).toContainText('本题草稿已保存');
  await page.getByRole('button', { name: /第 2 题/ }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'calculation.pdf', mimeType: 'application/pdf', buffer: Buffer.from('calculation') });
  await expect(page.getByText('calculation.pdf', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /提交整份|整份提交|封卷/ })).toHaveCount(0);
});

test('pending scan preserves intent, times out recoverably, retries to ready, and blocks unsafe submission', async ({ page, context }) => {
  await addStudentSession(context);
  await mockAssignmentRoutes(page);
  let mode: 'SCANNING' | 'READY' | 'UNSAFE' = 'SCANNING';
  let failStatusOnce = false;
  let intentCounter = 0;
  const finalizeCalls = new Map<string, number>();
  const finalizeKeys = new Map<string, string[]>();
  await page.unroute('**/api/student/assignments/assignment-902/answers/question-file/upload-sign');
  await page.unroute('**/api/student/assignments/assignment-902/answers/question-file/finalize**');
  await page.route('**/api/student/assignments/assignment-902/answers/question-file/upload-sign', (route) => {
    intentCounter += 1;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ upload: { intentId: `intent-round3-${intentCounter}`, url: 'https://upload.test/opaque-902', expiresAt: '2026-07-11T08:10:00.000Z', requiredHeaders: { 'content-type': 'application/pdf' } } }) });
  });
  await page.route('**/api/student/assignments/assignment-902/answers/question-file/finalize**', (route) => {
    const intentId = `intent-round3-${intentCounter}`;
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { idempotencyKey: string };
      finalizeKeys.set(intentId, [...(finalizeKeys.get(intentId) ?? []), body.idempotencyKey]);
      const calls = (finalizeCalls.get(intentId) ?? 0) + 1;
      finalizeCalls.set(intentId, calls);
      if (mode === 'UNSAFE') return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ status: 'UNSAFE', intentId }) });
      if (mode === 'READY' && calls > 1) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'READY', intentId, asset: { id: `asset-${intentId}`, displayName: 'round3.pdf', mimeType: 'application/pdf', sizeBytes: 10, state: 'FINALIZED', finalizedAt: '2026-07-11T08:03:00.000Z' } }) });
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ status: 'SCANNING', intentId }) });
    }
    if (failStatusOnce) { failStatusOnce = false; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '扫描服务暂不可用' }) }); }
    return route.fulfill({ status: mode === 'UNSAFE' ? 422 : 200, contentType: 'application/json', body: JSON.stringify(mode === 'READY' ? { status: 'CLEAN', intentId } : { status: mode, intentId }) });
  });
  await page.goto('/missions/assignments/assignment-902');
  await page.getByRole('button', { name: /第 2 题/ }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'round3.pdf', mimeType: 'application/pdf', buffer: Buffer.from('round3') });
  const timeout = page.getByRole('status').filter({ hasText: '安全扫描仍在进行' });
  await expect(timeout).toBeFocused({ timeout: 8_000 });
  await expect(timeout).toContainText('intent-r…');
  await expect(page.getByRole('button', { name: '提交本题' })).toBeDisabled();
  mode = 'READY';
  await timeout.getByRole('button', { name: '重新检查扫描状态' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已通过安全扫描并就绪' })).toBeFocused();
  expect(finalizeCalls.get('intent-round3-1')).toBe(2);
  expect(new Set(finalizeKeys.get('intent-round3-1')).size).toBe(1);
  await expect(page.getByRole('button', { name: '提交本题' })).toBeEnabled();

  await page.reload();
  await page.getByRole('button', { name: /第 2 题/ }).click();
  mode = 'UNSAFE';
  await page.locator('input[type=file]').setInputFiles({ name: 'unsafe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('unsafe') });
  const unsafe = page.getByRole('status').filter({ hasText: '未通过安全扫描' });
  await expect(unsafe).toBeFocused();
  await expect(page.getByRole('button', { name: '提交本题' })).toBeDisabled();
  await expect(unsafe.getByRole('button', { name: '重新检查扫描状态' })).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: /第 2 题/ }).click();
  mode = 'READY';
  failStatusOnce = true;
  await page.locator('input[type=file]').setInputFiles({ name: 'network-retry.pdf', mimeType: 'application/pdf', buffer: Buffer.from('network') });
  const networkError = page.getByRole('status').filter({ hasText: '扫描服务暂不可用' });
  await expect(networkError).toBeFocused();
  await expect(networkError).toContainText('上传意图');
  await networkError.getByRole('button', { name: '重新检查扫描状态' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已通过安全扫描并就绪' })).toBeFocused();
  expect(finalizeCalls.get('intent-round3-3')).toBe(2);
  expect(new Set(finalizeKeys.get('intent-round3-3')).size).toBe(1);
});
