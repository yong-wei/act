import 'dotenv/config';

import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { prisma } from '../src/lib/prisma';
import { projectSmartPreparationTask } from '../src/lib/smart-lesson-plan/workspace';

const teacherId = 'smart-lesson-playwright-teacher';
const courseBasisId = 'smart-lesson-playwright-basis';
const documentId = 'smart-lesson-playwright-document';
const versionId = 'smart-lesson-playwright-version';
const segmentId = 'smart-lesson-playwright-segment';

const outline = {
  keyContent: ['闭环特征方程与稳定性判据'],
  difficultContent: ['参数变化与稳定域'],
  limitations: ['教师创建内容仍需补充直接来源'],
  classAdaptation: null,
  coursewareStepOutline: [
    ['导入', 'bridgeIn'], ['目标', 'objectives'], ['前测', 'preAssessment'],
    ['参与式学习', 'participatoryLearning'], ['后测', 'postAssessment'], ['总结', 'summary'],
  ].map(([title, bopppsStage]) => ({ title, bopppsStage, minutes: 5 })),
};

const completedPlan = {
  schemaVersion: 'smart-lesson-plan.boppps.v1',
  course: '自动控制原理',
  topic: '闭环稳定性',
  audience: '自动化专业本科生',
  durationMinutes: 30,
  prerequisites: '传递函数',
  keyContent: outline.keyContent,
  difficultContent: outline.difficultContent,
  limitations: outline.limitations,
  classAdaptation: null,
  coursewareStepOutline: outline.coursewareStepOutline,
  goals: [{ id: 'goal-1', content: '判断闭环系统稳定性', sourceState: 'teacher_created_source_pending', sourceBindings: [], gapIdentity: 'smart-goal-gap:fixture', standardsMappings: [] }],
  knowledgePoints: [{ id: 'point-1', title: '稳定性判据', sourceState: 'teacher_created_source_pending', sourceBindings: [], gapIdentity: 'smart-goal-gap:fixture' }],
  sources: [],
  boppps: Object.fromEntries(['bridgeIn', 'objectives', 'preAssessment', 'participatoryLearning', 'postAssessment', 'summary'].map((key) => [key, {
    minutes: 5,
    teacherActivity: `${key} 教师活动`,
    studentActivity: `${key} 学生活动`,
    assessment: `${key} 形成性检查`,
    steps: [{ title: key, minutes: 5, teacherActivity: '引导', studentActivity: '练习', assessment: '检查', sourceBindings: [] }],
  }])),
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await prisma.courseBasisSegment.deleteMany({ where: { id: segmentId } });
  await prisma.courseBasisDocumentVersion.deleteMany({ where: { id: versionId } });
  await prisma.courseBasisDocument.deleteMany({ where: { id: documentId } });
  await prisma.courseBasis.deleteMany({ where: { id: courseBasisId } });
  await prisma.user.upsert({
    where: { id: teacherId },
    update: { role: 'TEACHER', name: '智能教案验收教师' },
    create: { id: teacherId, email: 'smart-lesson-playwright@example.com', name: '智能教案验收教师', role: 'TEACHER' },
  });
  await prisma.courseBasis.create({ data: { id: courseBasisId, ownerId: teacherId, courseIdentity: 'AUTO-CONTROL', title: '自动控制原理' } });
  await prisma.courseBasisDocument.create({ data: { id: documentId, courseBasisId, title: '课程标准', kind: 'STANDARD' } });
  await prisma.courseBasisDocumentVersion.create({ data: {
    id: versionId,
    documentId,
    versionNumber: 1,
    sourceType: 'PLAIN_TEXT',
    sourceName: '课程标准.txt',
    mimeType: 'text/plain',
    byteSize: 24,
    contentHash: 'a'.repeat(64),
    originalContent: Buffer.from('闭环系统稳定性判据'),
    normalizedText: '闭环系统稳定性判据',
    extractionState: 'EXTRACTED',
    extractionVersion: 'playwright.v1',
    reviewState: 'CONFIRMED',
    reviewedById: teacherId,
    reviewedAt: new Date(),
  } });
  await prisma.courseBasisSegment.create({ data: {
    id: segmentId,
    versionId,
    orderIndex: 0,
    stableAnchor: 'chapter-1',
    headingPath: ['第一章'],
    paragraphNumber: 1,
    text: '闭环系统稳定性判据',
    contentHash: 'b'.repeat(64),
  } });
});

test.afterAll(async () => {
  await prisma.courseBasisSegment.deleteMany({ where: { id: segmentId } });
  await prisma.courseBasisDocumentVersion.deleteMany({ where: { id: versionId } });
  await prisma.courseBasisDocument.deleteMany({ where: { id: documentId } });
  await prisma.courseBasis.deleteMany({ where: { id: courseBasisId } });
  await prisma.user.deleteMany({ where: { id: teacherId } });
  await prisma.$disconnect();
});

async function addTeacherSession(context: BrowserContext) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: { id: teacherId, email: 'smart-lesson-playwright@example.com', name: '智能教案验收教师', role: 'TEACHER' },
  });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax', secure: false, expires: Math.floor(Date.now() / 1000) + 3600 }]);
}

type FixtureJob = { id: string; state: string; firstIncompleteStage?: string; stages: Array<Record<string, unknown>> };
type FixtureReview = { id: string; advisoryOnly: boolean; state: string; report: Record<string, unknown> };
type FixtureDraft = { id: string; state: string; version: number; content?: unknown; jobs: FixtureJob[]; reviews: FixtureReview[] };
type FixtureRevision = { id: string; displayName: string; revisionNumber: number };
type FixtureTask = {
  id: string; courseBasisId: string; revision: number; topic: string; audience: string; prerequisites: string;
  durationMinutes: number; outlineConfirmationRequired: boolean;
  archivedAt?: string | null;
  scopeConfirmedAt: string; goalsConfirmedAt: string; updatedAt: string;
  sources: Array<{ sourceVersionId: string; state: string }>;
  knowledgePoints: Array<Record<string, unknown>>; goals: Array<Record<string, unknown>>;
  drafts: FixtureDraft[]; revisions: FixtureRevision[];
};

function baseTask(): FixtureTask {
  return {
    id: 'task-939', courseBasisId, revision: 1, topic: '闭环稳定性', audience: '自动化专业本科生', prerequisites: '传递函数', durationMinutes: 30,
    outlineConfirmationRequired: true,
    scopeConfirmedAt: '2026-07-25T00:00:00.000Z',
    goalsConfirmedAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
    sources: [{ sourceVersionId: versionId, state: 'SELECTED' }],
    knowledgePoints: [{ id: 'point-1', lineageId: 'point-lineage-1', title: '稳定性判据', origin: 'TEACHER_CREATED', sourceState: 'teacher_created_source_pending', sourceBindings: [], state: 'CONFIRMED' }],
    goals: [{ id: 'goal-1', lineageId: 'goal-lineage-1', content: '判断闭环系统稳定性', sourceState: 'teacher_created_source_pending', sourceBindings: [], state: 'CONFIRMED' }],
    drafts: [{ id: 'draft-1', state: 'EDITABLE', version: 1, jobs: [], reviews: [] }],
    revisions: [],
  };
}

function publicTask(task: FixtureTask) {
  return { ...task, workspace: projectSmartPreparationTask(task as unknown as Record<string, unknown>) };
}

async function installSmartLessonRoutes(page: Page) {
  let task: FixtureTask = baseTask();
  const pausedStages = [{ id: 'stage-outline', kind: 'OUTLINE', state: 'COMPLETED', output: outline }];
  const completedStages = [
    ...pausedStages,
    ...['BRIDGE_IN', 'OBJECTIVES', 'PRE_ASSESSMENT', 'PARTICIPATORY_LEARNING', 'POST_ASSESSMENT', 'SUMMARY']
      .map((kind) => ({ id: `stage-${kind}`, kind, state: 'COMPLETED', output: { minutes: 5, teacherActivity: '引导', studentActivity: '练习', assessment: '检查', steps: [] } })),
  ];
  const fulfill = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/api/teacher/smart-lesson-tasks', async (route) => {
    if (route.request().method() === 'GET') {
      const archived = new URL(route.request().url()).searchParams.get('archived') === 'true';
      const taskIsArchived = Boolean(task.archivedAt);
      return fulfill(route, { tasks: archived === taskIsArchived ? [publicTask(task)] : [] });
    }
    if (route.request().method() !== 'POST') return route.fallback();
    task = baseTask();
    return fulfill(route, { task: publicTask(task) }, 201);
  });
  await page.route('**/api/teacher/smart-lesson-tasks/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/teacher/smart-lesson-tasks/task-939' && route.request().method() === 'GET') return fulfill(route, { task: publicTask(task) });
    if (path === '/api/teacher/smart-lesson-tasks/task-939' && route.request().method() === 'PUT') {
      const action = (await route.request().postDataJSON()) as { action: 'archive' | 'restore' };
      task = { ...task, archivedAt: action.action === 'archive' ? '2026-07-25T00:00:00.000Z' : null };
      return fulfill(route, { task: publicTask(task) });
    }
    if (path === '/api/teacher/smart-lesson-tasks/task-939' && route.request().method() === 'DELETE') {
      return fulfill(route, {
        error: {
          code: 'smart-lesson-task-delete-blocked',
          blockers: [{ category: 'publication', count: 1, managementPath: '/teacher/preset-lessons' }],
        },
      }, 409);
    }
    if (path === '/api/teacher/smart-lesson-tasks/drafts/draft-1/generation') {
      task = { ...task, drafts: [{ ...task.drafts[0], state: 'GENERATING', jobs: [{ id: 'job-1', state: 'PAUSED', firstIncompleteStage: 'BRIDGE_IN', stages: pausedStages }], reviews: [] }] };
      return fulfill(route, { job: task.drafts[0].jobs[0] }, 202);
    }
    if (path === '/api/teacher/smart-lesson-tasks/jobs/job-1') {
      task = { ...task, drafts: [{ ...task.drafts[0], state: 'READY', content: completedPlan, jobs: [{ id: 'job-1', state: 'COMPLETED', firstIncompleteStage: 'SUMMARY', stages: completedStages }], reviews: [] }] };
      return fulfill(route, { job: task.drafts[0].jobs[0] });
    }
    if (path === '/api/teacher/smart-lesson-tasks/drafts/draft-1/advisory-reviews') {
      task = { ...task, drafts: [{ ...task.drafts[0], reviews: [{ id: 'review-1', advisoryOnly: true, state: 'COMPLETED', report: { goalCoverage: '目标覆盖完整', sourceConsistency: '教师创建内容保持来源待补', bopppsStructure: '六阶段结构完整', findings: [], suggestions: ['批准前补充直接来源'] } }] }] };
      return fulfill(route, { review: task.drafts[0].reviews[0] }, 201);
    }
    if (path === '/api/teacher/smart-lesson-tasks/drafts/draft-1/approve') {
      const revision = { id: 'revision-1', displayName: '教案第1版', revisionNumber: 1 };
      task = { ...task, drafts: [{ ...task.drafts[0], state: 'APPROVED' }], revisions: [revision] };
      return fulfill(route, { revision }, 201);
    }
    if (path === '/api/teacher/smart-lesson-tasks/revisions/revision-1/drafts') {
      task = { ...task, drafts: [{ id: 'draft-2', state: 'EDITABLE', version: 1, content: completedPlan, jobs: [], reviews: [] }, ...task.drafts], revisions: task.revisions };
      return fulfill(route, { draft: task.drafts[0] }, 201);
    }
    return fulfill(route, { error: { code: `unhandled-test-route:${path}` } }, 500);
  });
  await page.route('**/api/teacher/smart-lesson-tasks?**', async (route) => {
    const archived = new URL(route.request().url()).searchParams.get('archived') === 'true';
    const taskIsArchived = Boolean(task.archivedAt);
    return fulfill(route, { tasks: archived === taskIsArchived ? [publicTask(task)] : [] });
  });
}

test('teacher completes the visible smart lesson authoring flow through version 2 derivation', async ({ page, context }) => {
  await addTeacherSession(context);
  await installSmartLessonRoutes(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/teacher/smart-prep');

  const workspace = page.locator('[data-smart-lesson-plan-workspace]');
  await expect(workspace.getByRole('heading', { name: '智能教案共创' })).toBeVisible();
  await workspace.getByPlaceholder('单课主题').fill('闭环稳定性');
  await workspace.getByPlaceholder('授课对象').fill('自动化专业本科生');
  await workspace.getByPlaceholder('确认知识点').fill('稳定性判据');
  await workspace.getByPlaceholder('确认教学目标').fill('判断闭环系统稳定性');
  await workspace.getByPlaceholder('先修要求（可选）').fill('传递函数');
  await workspace.getByRole('combobox').nth(2).selectOption('30');
  await workspace.getByLabel('生成提纲后暂停确认').check();
  await workspace.getByRole('button', { name: '确认并创建单课任务' }).click();

  await expect(workspace.getByText('教师创建，来源待补')).toHaveCount(2);
  for (const stage of ['课程依据', '主题与目标', '班级学情', '生成与审核教案', '生成课件']) {
    await expect(workspace.getByText(stage, { exact: true })).toBeVisible();
  }
  await workspace.getByPlaceholder('搜索任务主题').fill('闭环');
  await page.getByRole('button', { name: '课程依据' }).click();
  await page.getByRole('button', { name: '备课任务' }).click();
  await expect(workspace.getByPlaceholder('搜索任务主题')).toHaveValue('闭环');
  await expect(workspace.getByRole('heading', { name: '闭环稳定性', level: 3 })).toBeVisible();
  await workspace.getByRole('button', { name: '开始生成' }).click();
  await expect(workspace.getByText('教学提纲：已完成')).toBeVisible();
  await expect(workspace.getByText('提纲已持久化。可先编辑，或明确确认当前提纲后继续生成。')).toBeVisible();
  await workspace.getByRole('button', { name: '确认当前提纲并继续' }).click();
  await expect(workspace.getByText('总结：已完成')).toBeVisible();
  await expect(workspace.getByRole('button', { name: '开始生成' })).toBeEnabled();

  await workspace.getByText('查看完整教案').click();
  await expect(workspace.getByRole('heading', { name: '闭环稳定性', level: 4 })).toBeVisible();
  await expect(workspace.getByRole('heading', { name: '总结' })).toBeVisible();
  await workspace.getByRole('button', { name: 'AI 建议' }).click();
  await expect(workspace.getByRole('heading', { name: 'AI 审核报告（仅建议）' })).toBeVisible();
  await expect(workspace.getByText('目标覆盖完整')).toBeVisible();
  await workspace.getByRole('button', { name: '批准版本' }).click();
  await expect(workspace.getByText('教案第1版 已冻结。')).toBeVisible();
  await workspace.getByRole('button', { name: '基于教案第1版继续修订' }).click();
  await expect(workspace.getByText('已从批准版本建立新的可编辑草稿。')).toBeVisible();
  await expect(workspace.getByText(/草稿 可编辑/)).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await workspace.getByRole('button', { name: '永久删除' }).click();
  await expect(workspace.getByText('无法永久删除：正式发布 1 项。请改为归档。')).toBeVisible();
  await workspace.getByRole('button', { name: '归档', exact: true }).click();
  await expect(workspace.getByText('任务已归档。')).toBeVisible();
  await workspace.getByRole('button', { name: '已归档' }).click();
  await expect(workspace.getByRole('heading', { name: '闭环稳定性', level: 3 })).toBeVisible();
  await workspace.getByRole('button', { name: '恢复' }).click();
  await expect(workspace.getByText('任务已恢复到进行中列表。')).toBeVisible();
  await workspace.getByRole('button', { name: '进行中' }).click();
  await expect(workspace.getByRole('heading', { name: '闭环稳定性', level: 3 })).toBeVisible();
});

test('narrow workspace uses a task drawer without horizontal page overflow', async ({ page, context }) => {
  await addTeacherSession(context);
  await installSmartLessonRoutes(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/teacher/smart-prep');

  const workspace = page.locator('[data-smart-lesson-plan-workspace]');
  await expect(workspace.getByRole('button', { name: '选择备课任务' })).toBeVisible();
  await workspace.getByRole('button', { name: '选择备课任务' }).click();
  await expect(workspace.getByRole('complementary', { name: '备课任务列表' })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
