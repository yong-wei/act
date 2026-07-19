import 'dotenv/config';

import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { prisma } from '../src/lib/prisma';
import { contentHash } from '../src/lib/smart-lesson-plan/domain';
import { validPlanFixture } from '../src/lib/smart-lesson-plan/__tests__/fixtures';
import { createSmartCoursewareDraft, updateSmartCoursewareComposition } from '../src/lib/smart-courseware';
import { validCompositionInput } from '../src/lib/smart-courseware/__tests__/fixtures';

const fixtureSuffix = `${Date.now()}-${process.pid}`;
const teacherId = `smart-courseware-playwright-teacher-${fixtureSuffix}`;
const secret = 'SERVER_ONLY_REFERENCE_ANSWER';
const basisId = `smart-courseware-playwright-basis-${fixtureSuffix}`;
const documentId = `smart-courseware-playwright-document-${fixtureSuffix}`;
const versionId = `smart-courseware-playwright-version-${fixtureSuffix}`;
const taskId = `smart-courseware-playwright-task-${fixtureSuffix}`;
const planDraftId = `smart-courseware-playwright-plan-draft-${fixtureSuffix}`;
const planRevisionId = `smart-courseware-playwright-plan-revision-${fixtureSuffix}`;
const teacherEmail = `courseware-${fixtureSuffix}@example.com`;
let realDraftId = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: teacherId },
    update: { role: 'TEACHER', name: '课件验收教师' },
    create: { id: teacherId, email: teacherEmail, name: '课件验收教师', role: 'TEACHER' },
  });
  await prisma.courseBasis.create({ data: { id: basisId, ownerId: teacherId, courseIdentity: 'COURSEWARE-E2E', title: '自动控制原理' } });
  await prisma.courseBasisDocument.create({ data: { id: documentId, courseBasisId: basisId, title: '课程标准', kind: 'STANDARD' } });
  await prisma.courseBasisDocumentVersion.create({ data: {
    id: versionId, documentId, versionNumber: 1, sourceType: 'PLAIN_TEXT', sourceName: '课程标准.txt', mimeType: 'text/plain', byteSize: 12,
    contentHash: 'a'.repeat(64), originalContent: Buffer.from('闭环稳定性'), normalizedText: '闭环稳定性', extractionState: 'EXTRACTED', extractionVersion: 'playwright.v1',
    reviewState: 'CONFIRMED', reviewedById: teacherId, reviewedAt: new Date(),
  } });
  await prisma.smartLessonTask.create({ data: {
    id: taskId, ownerId: teacherId, courseBasisId: basisId, topic: '闭环稳定性', audience: '自动化本科生', prerequisites: '传递函数', durationMinutes: 30,
  } });
  await prisma.smartLessonDraft.create({ data: { id: planDraftId, ownerId: teacherId, taskId, state: 'APPROVED', version: 1 } });
  const plan = replaceSourceVersion(validPlanFixture(), versionId);
  const planHash = contentHash(plan);
  await prisma.smartLessonRevision.create({ data: {
    id: planRevisionId, ownerId: teacherId, taskId, draftId: planDraftId, revisionNumber: 1, displayName: '课件测试教案', content: plan,
    contentHash: planHash, sourcesSnapshot: plan.sources, knowledgeSnapshot: plan.knowledgePoints, goalsSnapshot: plan.goals,
    provenanceSnapshot: {}, approvalIdempotencyKey: 'courseware-playwright-plan-approval', approvalRequestHash: planHash, approvedById: teacherId,
  } });
  const draft = await createSmartCoursewareDraft(prisma, {
    actor: { id: teacherId, role: 'TEACHER' }, planRevisionId, idempotencyKey: 'courseware-playwright-draft-create',
  });
  const composition = validCompositionInput();
  composition.moduleMetadata = replaceSourceVersion(composition.moduleMetadata, versionId);
  const runtimeModules = composition.runtimeManifest.stages.flatMap((stage) => stage.steps.flatMap((step) => step.modules));
  for (const metadata of composition.moduleMetadata) {
    const runtimeModule = runtimeModules.find((module) => module.id === metadata.moduleId);
    if (!runtimeModule || runtimeModule.canonicalClass !== 'activity.panel') continue;
    const options = Array.isArray(runtimeModule.payload.options) ? runtimeModule.payload.options : [];
    const firstOption = options[0] as { value?: unknown } | undefined;
    if ('referenceAnswer' in metadata.teacherFields && firstOption?.value !== undefined) {
      metadata.teacherFields.referenceAnswer = String(firstOption.value);
    }
    if ('explanation' in metadata.teacherFields) metadata.teacherFields.explanation = secret;
  }
  await updateSmartCoursewareComposition(prisma, {
    actor: { id: teacherId, role: 'TEACHER' }, draftId: draft.id, ...composition,
  });
  realDraftId = draft.id;
});

test.afterAll(async () => {
  // SmartLessonRevision and module revision rows are immutable audit records.
  // Unique fixture identities make retained lineage safe across repeated runs.
  await prisma.$disconnect();
});

function replaceSourceVersion<T>(value: T, sourceVersionId: string): T {
  return JSON.parse(JSON.stringify(value).replaceAll('version-1', sourceVersionId)) as T;
}

async function addTeacherSession(context: BrowserContext) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: { id: teacherId, email: teacherEmail, name: '课件验收教师', role: 'TEACHER' },
  });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax', secure: false }]);
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
