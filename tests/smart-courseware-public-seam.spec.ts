import 'dotenv/config';

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Browser, type BrowserContext, type Page, type Route, type TestInfo } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { prisma } from '../src/lib/prisma';
import { encodeKonlingE2ESourceBindingsMetadata } from '../src/lib/ai/konling-e2e-chat-model';
import {
  ROOT_LOCUS_AUTHORITATIVE_SOURCE_TEXT,
  ROOT_LOCUS_KONLING_TURNS,
  compareRootLocusManifestAgainstSource,
} from './fixtures/root-locus-publication';

const fixtureSuffix = `${Date.now()}-${process.pid}`;
const teacherId = `smart-courseware-playwright-teacher-${fixtureSuffix}`;
const secret = 'SERVER_ONLY_REFERENCE_ANSWER';
let basisId = '';
let versionId = '';
let taskId = '';
const teacherEmail = `courseware-${fixtureSuffix}@example.com`;
const studentId = `smart-courseware-playwright-student-${fixtureSuffix}`;
const studentEmail = `courseware-student-${fixtureSuffix}@example.com`;
let realDraftId = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: teacherId },
    update: { role: 'TEACHER', name: '课件验收教师' },
    create: { id: teacherId, email: teacherEmail, name: '课件验收教师', role: 'TEACHER' },
  });
  await prisma.user.upsert({
    where: { id: studentId },
    update: { role: 'STUDENT', name: '课件验收学生' },
    create: { id: studentId, email: studentEmail, name: '课件验收学生', role: 'STUDENT' },
  });
});

test.afterAll(async () => {
  // SmartLessonRevision and module revision rows are immutable audit records.
  // Unique fixture identities make retained lineage safe across repeated runs.
  await prisma.$disconnect();
});

async function addTeacherSession(context: BrowserContext) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: { id: teacherId, email: teacherEmail, name: '课件验收教师', role: 'TEACHER' },
  });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax', secure: false }]);
}

async function addStudentSession(context: BrowserContext) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: { id: studentId, email: studentEmail, name: '课件验收学生', role: 'STUDENT' },
  });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax', secure: false }]);
}

async function verifyIndependentThemeMatrix(input: {
  browser: Browser;
  testInfo: TestInfo;
  role: 'publication' | 'teacher' | 'student';
  path: string;
  readySelector: string;
  authenticate: (context: BrowserContext) => Promise<void>;
}) {
  const hashes = new Map<string, string>();
  const colors = new Map<string, string>();
  for (const viewport of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 390, height: 844 }]) {
    for (const theme of ['light', 'dark'] as const) {
      const context = await input.browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      await context.addInitScript(({ selectedTheme }) => {
        localStorage.setItem('ai-obe-theme', selectedTheme);
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(selectedTheme);
        document.documentElement.style.colorScheme = selectedTheme;
      }, { selectedTheme: theme });
      await input.authenticate(context);
      const page = await context.newPage();
      await page.goto(input.path);
      const surface = page.locator(input.readySelector);
      await expect(surface).toBeVisible();
      await expect(page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));
      expect(await surface.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      colors.set(`${viewport.name}:${theme}`, await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
      const screenshotPath = input.testInfo.outputPath(`${input.role}-${viewport.name}-${theme}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      hashes.set(`${viewport.name}:${theme}`, createHash('sha256').update(await readFile(screenshotPath)).digest('hex'));
      await context.close();
    }
    expect(colors.get(`${viewport.name}:light`)).not.toBe(colors.get(`${viewport.name}:dark`));
    expect(hashes.get(`${viewport.name}:light`)).not.toBe(hashes.get(`${viewport.name}:dark`));
  }
}

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installPublicCoursewareSeam(page: Page) {
  let draftVersion = 2;
  let jobState = 'RETRYABLE';
  const teacherManifest = { lessonId: 'lesson-1', stages: [{ steps: [{ modules: [{ id: 'module-1', payload: { text: 'before' } }, { id: 'module-2', payload: { text: 'unchanged' } }] }] }] };
  const studentRuntime = { lessonId: 'lesson-1', stepOrder: ['step-1'], steps: [{ id: 'step-1', title: '公开步骤', modules: [{ id: 'module-1', region: 'main', kind: 'content.rich', mustBeVisible: true, payload: { text: 'student-safe' } }] }] };
  await page.route('**/api/teacher/smart-courseware/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/previews/teacher')) return fulfill(route, { preview: { draftId: 'draft-1', version: draftVersion, runtimeManifest: teacherManifest, moduleMetadata: [{ moduleId: 'module-1', teacherFields: { referenceAnswer: secret } }] } });
    if (path.endsWith('/previews/student')) return fulfill(route, { preview: { draftId: 'draft-1', version: draftVersion, runtimeManifest: studentRuntime, notice: 'ai-assisted-teacher-reviewed' } });
    if (path.endsWith('/generation')) return fulfill(route, { job: { id: 'job-1', draftId: 'draft-1', state: jobState, units: [] } }, 202);
    if (path.endsWith('/jobs/job-1')) {
      jobState = 'COMPLETED';
      return fulfill(route, { job: { id: 'job-1', draftId: 'draft-1', state: jobState, units: [] } });
    }
    if (path.endsWith('/modules/module-1/regeneration')) return fulfill(route, { job: { id: 'module-job-1', draftId: 'draft-1', mode: 'MODULE', state: 'QUEUED', targetModuleId: 'module-1', targetModuleHash: 'before-hash' } }, 202);
    if (path.endsWith('/jobs/module-job-1/accept')) {
      draftVersion += 1;
      return fulfill(route, { job: { id: 'module-job-1', state: 'COMPLETED', acceptedAt: new Date().toISOString() }, preview: { draftId: 'draft-1', version: draftVersion, runtimeManifest: { ...teacherManifest, stages: [{ steps: [{ modules: [{ id: 'module-1', payload: { text: 'after' } }, { id: 'module-2', payload: { text: 'unchanged' } }] }] }] } } });
    }
    if (path.endsWith('/drafts/draft-1') && route.request().method() === 'PATCH') {
      const input = route.request().postDataJSON();
      if (!input.runtimeManifest) return fulfill(route, { error: { code: 'invalid-input' } }, 400);
      draftVersion += 1;
      return fulfill(route, { draft: { id: 'draft-1', version: draftVersion }, preview: { draftId: 'draft-1', version: draftVersion, runtimeManifest: input.runtimeManifest, moduleMetadata: input.moduleMetadata, validation: { valid: true, issues: [] } } });
    }
    return fulfill(route, { error: { code: `unhandled-public-seam:${path}` } }, 500);
  });
}

test('courseware public seams preserve authorization projections and target-only regeneration', async ({ page, context }) => {
  await addTeacherSession(context);
  await installPublicCoursewareSeam(page);
  await page.goto('/teacher/smart-prep');

  const result = await page.evaluate(async () => {
    const json = async (path: string, init?: RequestInit) => fetch(path, init).then((response) => response.json());
    const teacher = await json('/api/teacher/smart-courseware/drafts/draft-1/previews/teacher');
    const student = await json('/api/teacher/smart-courseware/drafts/draft-1/previews/student');
    const started = await json('/api/teacher/smart-courseware/drafts/draft-1/generation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'start-public-seam' }) });
    const resumed = await json('/api/teacher/smart-courseware/jobs/job-1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'resume', idempotencyKey: 'resume-public-seam' }) });
    const regeneration = await json('/api/teacher/smart-courseware/drafts/draft-1/modules/module-1/regeneration', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'module-public-seam' }) });
    const accepted = await json('/api/teacher/smart-courseware/jobs/module-job-1/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedDraftVersion: 2, expectedModuleHash: 'before-hash', idempotencyKey: 'accept-public-seam' }) });
    return { teacher, student, started, resumed, regeneration, accepted };
  });

  expect(JSON.stringify(result.teacher)).toContain(secret);
  expect(JSON.stringify(result.student)).not.toContain(secret);
  expect(result.started.job.state).toBe('RETRYABLE');
  expect(result.resumed.job.state).toBe('COMPLETED');
  expect(result.regeneration.job.state).toBe('QUEUED');
  expect(result.accepted.preview.runtimeManifest.stages[0].steps[0].modules[1].payload.text).toBe('unchanged');
});

test('builds the approved plan and generated courseware through ordinary APIs and the real workers', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.goto('/teacher/smart-prep');

  const setup = await page.evaluate(async ({ suffix, sourceText }) => {
    async function api(path: string, init?: RequestInit) {
      const response = await fetch(path, init);
      const body = await response.json();
      if (!response.ok) throw new Error(`${path}:${response.status}:${JSON.stringify(body)}`);
      return body;
    }
    const json = (value: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    const basis = await api('/api/teacher/course-bases', json({ courseIdentity: `ROOT-LOCUS-${suffix}`, title: '自动控制原理' }));
    const document = await api(`/api/teacher/course-bases/${basis.courseBasis.id}/documents`, json({ title: '根轨迹权威课程依据', kind: 'STANDARD' }));
    const version = await api(`/api/teacher/course-bases/documents/${document.document.id}/versions`, json({
      sourceType: 'PASTED_TEXT', sourceName: '根轨迹课程依据.txt', mimeType: 'text/plain', content: sourceText,
    }));
    await api(`/api/teacher/course-bases/versions/${version.version.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'confirm' }) });
    const preview = await api(`/api/teacher/course-bases/versions/${version.version.id}`);
    const chat = await api('/api/ai/sessions', json({ courseId: basis.courseBasis.id, pageId: '/teacher/smart-prep', title: '根轨迹共创验收' }));
    return { basisId: basis.courseBasis.id, versionId: version.version.id, preview: preview.preview, chatId: chat.id };
  }, {
    suffix: fixtureSuffix,
    sourceText: ROOT_LOCUS_AUTHORITATIVE_SOURCE_TEXT,
  });
  basisId = setup.basisId;
  versionId = setup.versionId;
  const sourceSegments = (setup.preview.segments as Array<{ stableAnchor: string; contentHash: string; text: string }>)
    .filter((segment) => [
      '根轨迹上的点满足开环相角为奇数倍180度。',
      '由幅值条件计算指定根轨迹点对应的增益。',
      '分支起于开环极点并终止于开环零点或无穷远。',
    ].some((claim) => segment.text.includes(claim)));
  expect(sourceSegments).toHaveLength(3);
  const sourceBindingMetadata = encodeKonlingE2ESourceBindingsMetadata({
    sourceVersionId: versionId,
    bindings: sourceSegments.map((segment) => ({ stableAnchor: segment.stableAnchor, contentHash: segment.contentHash })),
  });

  async function sendKonling(content: string, options: { agentSessionId?: string; taskId?: string } = {}) {
    return page.evaluate(async ({ chatId, basis, text, agentSessionId, smartTaskId }) => {
      const response = await fetch(`/api/ai/sessions/${chatId}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: text, teachingAssistantModeId: 'prep-coauthor', agentSessionId,
          modeClientContextHints: smartTaskId ? { smartTaskId } : { smartPrepBootstrap: 'true' },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(`konling:${response.status}:${JSON.stringify(body)}`);
      return body;
    }, { chatId: setup.chatId, basis: basisId, text: content, agentSessionId: options.agentSessionId, smartTaskId: options.taskId });
  }

  const clarificationReply = await sendKonling(`${ROOT_LOCUS_KONLING_TURNS[0].user} courseBasisId=${basisId} sourceVersionId=${versionId} ${sourceBindingMetadata}`);
  const suggestionsAfterClarification = await page.evaluate(() => fetch('/api/teacher/smart-lesson-tasks/konling-suggestions').then((response) => response.json()));
  expect(suggestionsAfterClarification.suggestions).toEqual(expect.arrayContaining([
    expect.objectContaining({ agentSessionId: clarificationReply.agentSessionId, clarification: expect.objectContaining({ question: expect.any(String) }) }),
  ]));

  const proposalReply = await sendKonling(`${ROOT_LOCUS_KONLING_TURNS[1].user} courseBasisId=${basisId} sourceVersionId=${versionId} ${sourceBindingMetadata}`);
  const bootstrapSuggestions = await page.evaluate(() => fetch('/api/teacher/smart-lesson-tasks/konling-suggestions').then((response) => response.json()));
  const proposal = bootstrapSuggestions.suggestions.find((item: { agentSessionId: string; proposedTask?: unknown }) => item.agentSessionId === proposalReply.agentSessionId && item.proposedTask);
  expect(proposal).toBeTruthy();
  const confirmed = await page.evaluate(async (input) => {
    const response = await fetch(`/api/teacher/smart-lesson-tasks/konling-suggestions/${input.id}/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentSessionId: input.agentSessionId, turnId: input.turnId }),
    });
    return { status: response.status, body: await response.json() };
  }, proposal);
  expect(confirmed.status).toBe(201);
  taskId = confirmed.body.task.id;

  const revisionReply = await sendKonling(`${ROOT_LOCUS_KONLING_TURNS[2].user} courseBasisId=${basisId} sourceVersionId=${versionId} taskId=${taskId} ${sourceBindingMetadata}`, {
    agentSessionId: proposalReply.agentSessionId, taskId,
  });
  const revisionSuggestions = await page.evaluate((id) => fetch(`/api/teacher/smart-lesson-tasks/${id}/konling-suggestions`).then((response) => response.json()), taskId);
  const revision = revisionSuggestions.suggestions.find((item: { agentSessionId: string }) => item.agentSessionId === revisionReply.agentSessionId);
  expect(revision).toMatchObject({ expectedRevision: 1, proposedTask: expect.objectContaining({ goals: expect.any(Array) }) });
  const revised = await page.evaluate(async ({ id, suggestion }) => {
    const response = await fetch(`/api/teacher/smart-lesson-tasks/${id}/konling-suggestions/${suggestion.id}/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentSessionId: suggestion.agentSessionId, turnId: suggestion.turnId }),
    });
    return { status: response.status, body: await response.json() };
  }, { id: taskId, suggestion: revision });
  expect(revised.status).toBe(200);
  expect(revised.body.task).toMatchObject({ revision: 2, durationMinutes: 45 });

  await page.reload();
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: '根轨迹幅值条件、相角条件与基本绘图规则' }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '开始生成' }).click();
  await expect.poll(async () => { await card.getByRole('button', { name: '刷新进度' }).click(); return card.innerText(); }, { timeout: 30_000 }).toContain('任务 PAUSED');
  await card.getByRole('button', { name: '确认当前提纲并继续' }).click();
  await expect.poll(async () => { await card.getByRole('button', { name: '刷新进度' }).click(); return card.innerText(); }, { timeout: 30_000 }).toContain('任务 COMPLETED');
  await card.getByRole('button', { name: 'AI 建议' }).click();
  await card.getByRole('button', { name: '批准版本' }).click();
  await expect(card).toContainText('最新：教案第1版');

  const approvedPlan = await prisma.smartLessonRevision.findFirstOrThrow({ where: { ownerId: teacherId, taskId }, orderBy: { revisionNumber: 'desc' } });
  const created = await page.evaluate(async ({ planRevisionId, suffix }) => {
    const response = await fetch('/api/teacher/smart-courseware/drafts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planRevisionId, idempotencyKey: `root-locus-courseware-${suffix}` }),
    });
    return { status: response.status, body: await response.json() };
  }, { planRevisionId: approvedPlan.id, suffix: fixtureSuffix });
  expect(created.status).toBe(201);
  realDraftId = created.body.draft.id;
  const generated = await page.evaluate(async ({ draftId, suffix }) => {
    const started = await fetch(`/api/teacher/smart-courseware/drafts/${draftId}/generation`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: `generate-${suffix}` }),
    }).then((response) => response.json());
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await fetch(`/api/teacher/smart-courseware/jobs/${started.job.id}`);
      const body = await response.json();
      if (body.job.state === 'COMPLETED') return body.job;
      if (['FAILED', 'RETRYABLE', 'CANCELLED'].includes(body.job.state)) throw new Error(JSON.stringify(body));
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('courseware-generation-timeout');
  }, { draftId: realDraftId, suffix: fixtureSuffix });
  expect(generated.state).toBe('COMPLETED');
  expect(generated.units).toHaveLength(6);
});

test('real courseware editor renders the shared student activity seam and submits composition edits', async ({ page, context }) => {
  const draftId = realDraftId;
  await addTeacherSession(context);
  let patchBody: Record<string, unknown> | null = null;
  await page.route(`**/api/teacher/smart-courseware/drafts/${draftId}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    patchBody = route.request().postDataJSON() as Record<string, unknown>;
    return fulfill(route, {
      draft: { id: draftId, version: 3 },
      preview: {
        draftId, version: 3, planRevisionId: 'fixture-plan-revision',
        runtimeManifest: patchBody.runtimeManifest,
        moduleMetadata: patchBody.moduleMetadata,
        validation: { valid: true, issues: [] },
      },
    });
  });
  await page.route(`**/api/teacher/smart-courseware/drafts/${draftId}/previews/student`, (route) => route.fallback());

  await page.goto(`/teacher/smart-prep/courseware/${draftId}`);
  const editor = page.locator('[data-smart-courseware-editor]');
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: '学生预览' }).click();
  const student = editor.locator('[data-courseware-preview="student"]');
  await expect(student.locator('[data-courseware-student-runtime]')).toBeVisible();
  await expect(student.locator('[data-courseware-student-activity]:visible').first()).toBeVisible();
  const interactiveControl = student.locator('input:visible:not([type="hidden"]), textarea:visible, button:visible').first();
  await expect(interactiveControl).toBeEnabled();
  expect(await student.textContent()).not.toContain(secret);

  await editor.getByRole('button', { name: '教师预览' }).click();
  await editor.getByRole('button', { name: '拆分当前步骤' }).click();
  await expect.poll(() => patchBody).not.toBeNull();
  if (!patchBody) throw new Error('Expected the split-step action to submit a composition patch.');
  const submitted: { runtimeManifest: { durationSeconds: number; stages: Array<{ durationSeconds: number; steps: Array<{ modules: unknown[] }> }> } } = patchBody;
  expect(submitted.runtimeManifest.stages[0].steps[1].modules.length).toBeGreaterThan(0);
});

test('approved publication surface remains identifiable and overflow-free across desktop/mobile and light/dark', async ({ page, context, browser }, testInfo) => {
  await addTeacherSession(context);
  await page.goto(`/teacher/smart-prep/courseware/${realDraftId}`);
  await page.getByRole('button', { name: '批准整课版本' }).click();
  await expect(page.getByRole('status').filter({ hasText: '课件版本 1 已批准' })).toBeVisible();

  await verifyIndependentThemeMatrix({
    browser, testInfo, role: 'publication', path: `/teacher/smart-prep/courseware/${realDraftId}`,
    readySelector: '[data-courseware-publication]', authenticate: addTeacherSession,
  });
});

test('ordinary publication API projects to catalog, binds a generated classroom, serves student interaction, and finalizes exact identity', async ({ page, context, browser }, testInfo) => {
  await addTeacherSession(context);
  await page.goto('/teacher/smart-prep');
  let sourceRevision = await prisma.smartCoursewareRevision.findFirst({ where: { ownerId: teacherId, draftId: realDraftId } });
  if (!sourceRevision) {
    await page.goto(`/teacher/smart-prep/courseware/${realDraftId}`);
    await page.getByRole('button', { name: '批准整课版本' }).click();
    await expect(page.getByRole('status').filter({ hasText: '已批准' })).toBeVisible();
    sourceRevision = await prisma.smartCoursewareRevision.findFirstOrThrow({ where: { ownerId: teacherId, draftId: realDraftId } });
  }
  await page.goto(`/teacher/smart-prep/courseware/${realDraftId}`);

  const publicationAction = (body: Record<string, unknown>) => page.evaluate(async ({ revisionId, input }) => {
    const response = await fetch(`/api/teacher/smart-courseware/revisions/${revisionId}/publication`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
    });
    return { status: response.status, body: await response.json() };
  }, { revisionId: sourceRevision!.id, input: body });

  expect((await publicationAction({ action: 'validate-static' })).status).toBe(200);
  const browserValidated = await publicationAction({ action: 'validate-browser' });
  expect(browserValidated.status).toBe(200);
  expect(browserValidated.body.publication.pendingGaps).toEqual([]);
  const stalePlan = browserValidated.body.publication.stalePlan as { acknowledged: boolean; newestPlanRevisionId: string } | null;
  if (stalePlan && !stalePlan.acknowledged) {
    expect((await publicationAction({
      action: 'acknowledge-stale-plan', newestPlanRevisionId: stalePlan.newestPlanRevisionId,
      reason: '教师已核对当前课件与最新批准教案的差异。',
    })).status).toBe(200);
  }
  const published = await publicationAction({ action: 'publish', idempotencyKey: `root-locus-publication:${fixtureSuffix}` });
  expect(published.status).toBe(201);
  const publication = published.body.publication.publication as { id: string; displayName: string; manifestHash: string };
  expect(publication.displayName).toBe('互动课件第1版（基于教案第1版）');
  const immutablePublication = await prisma.smartCoursewarePublicationRevision.findUniqueOrThrow({
    where: { id: publication.id }, select: { manifestSnapshot: true },
  });
  const sourceComparisons = compareRootLocusManifestAgainstSource(
    ROOT_LOCUS_AUTHORITATIVE_SOURCE_TEXT,
    immutablePublication.manifestSnapshot,
  );
  expect(sourceComparisons).toHaveLength(3);
  expect(sourceComparisons.every((comparison) => comparison.matches)).toBe(true);

  const catalog = await page.evaluate(async () => fetch('/api/lesson-plans').then((response) => response.json()));
  expect(catalog).toEqual(expect.arrayContaining([expect.objectContaining({ title: publication.displayName, authorId: teacherId })]));

  const createdSession = await page.evaluate(async (publicationRevisionId) => {
    const response = await fetch('/api/session', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ coursewarePublicationRevisionId: publicationRevisionId, duplicateAction: 'new-session' }),
    });
    return { status: response.status, body: await response.json() };
  }, publication.id);
  expect(createdSession.status).toBe(200);
  expect(createdSession.body).toMatchObject({
    coursewarePublicationRevisionId: publication.id,
    manifestHash: publication.manifestHash,
    lessonVersion: publication.displayName,
  });

  const activityItem = await prisma.lessonItem.findFirstOrThrow({
    where: { generatedCoursewarePublicationId: publication.id, stage: 'PRE_ASSESSMENT' },
    select: { id: true },
  });
  const released = await page.evaluate(async ({ sessionId, itemId }) => {
    const response = await fetch(`/api/session/${sessionId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentItemId: itemId, currentStage: 'PRE_ASSESSMENT' }),
    });
    return response.status;
  }, { sessionId: createdSession.body.id, itemId: activityItem.id });
  expect(released).toBe(200);

  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  await addStudentSession(studentContext);
  const studentPage = await studentContext.newPage();
  const join = await studentPage.request.get(`/api/session/join?code=${createdSession.body.joinCode}`);
  expect(join.status()).toBe(200);
  await verifyIndependentThemeMatrix({
    browser, testInfo, role: 'teacher', path: `/classroom/teacher/${createdSession.body.id}`,
    readySelector: `[data-generated-courseware-resource="${publication.id}"]`, authenticate: addTeacherSession,
  });
  await verifyIndependentThemeMatrix({
    browser, testInfo, role: 'student', path: `/classroom/student/${createdSession.body.id}`,
    readySelector: `[data-generated-courseware-resource="${publication.id}"]`, authenticate: addStudentSession,
  });
  await studentPage.goto(`/classroom/student/${createdSession.body.id}`);
  const generatedResource = studentPage.locator(`[data-generated-courseware-resource="${publication.id}"]`);
  await expect(generatedResource).toBeVisible();
  await expect(generatedResource).toHaveAttribute('data-generated-courseware-manifest-hash', publication.manifestHash);
  const control = generatedResource.locator('input:visible, textarea:visible, button:visible').first();
  await expect(control).toBeEnabled();
  if (await control.getAttribute('type') === 'radio') await control.check();
  const submit = generatedResource.getByRole('button', { name: /提交|确认/ }).first();
  if (await submit.count()) await submit.click();
  await studentContext.close();

  const finalized = await page.evaluate(async (sessionId) => {
    const response = await fetch(`/api/session/${sessionId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'FINISHED' }),
    });
    return { status: response.status, body: await response.json() };
  }, createdSession.body.id);
  expect(finalized.status).toBe(200);
  expect(finalized.body).toMatchObject({
    status: 'FINISHED',
    coursewarePublicationRevisionId: publication.id,
    manifestHash: publication.manifestHash,
    lessonVersion: publication.displayName,
  });
});
