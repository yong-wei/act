import 'dotenv/config';

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/teacher-assignment-authoring-901/playwright');
const desktopWidths = [768, 1024, 1440] as const;
const mobileWidths = [320, 375] as const;
const evidenceEntries: Array<{ name: string; viewport: number; screenshot: string; widthEvidence: string }> = [];
const savedDigest = `sha256:${'d'.repeat(64)}`;

function publicationResult(assignmentId: string, revisionId: string) {
  return {
    revision: { id: revisionId, state: 'PUBLISHED' },
    publication: { assignmentId, publishedRevisionId: revisionId, location: { assignmentId }, classes: [{ id: 'class-901', name: '自控 2401' }] },
    idempotentReplay: false,
  };
}

test.describe.configure({ timeout: 120_000, mode: 'serial' });
test.afterAll(() => {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'screenshots.json'), JSON.stringify({ generatedAt: new Date().toISOString(), entries: evidenceEntries }, null, 2));
});

async function addTeacherSession(context: BrowserContext) {
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret', token: { id: 'teacher-assignment-901', email: 'teacher-901@example.com', name: '作业验收教师', role: 'TEACHER' } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax', secure: false, expires: Math.floor(Date.now() / 1000) + 3600 }]);
  await context.route('**/api/teacher/assignments/managed-classes', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ classes: [{ id: 'class-901', name: '自控 2401', code: 'AC2401', year: '2026', semester: '春' }] }) }));
}

async function mockList(page: Page, mode: 'ready' | 'empty' | 'error' = 'ready') {
  await page.route('**/api/teacher/assignments', async (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ assignment: { id: 'assignment-created-901', revisions: [{ id: 'revision-created-901', version: 1, contentHash: savedDigest }] } }) });
    if (route.request().method() !== 'GET') return route.fallback();
    if (mode === 'error') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'temporary' }) });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ assignments: mode === 'empty' ? [] : [{ id: 'assignment-901', state: 'DRAFT', updatedAt: '2026-07-11T00:00:00.000Z', revisions: [{ id: 'revision-901', revisionNumber: 1, version: 3, title: '控制系统分析作业', state: 'DRAFT', audiences: [{ classId: 'class-901', class: { name: '自控 2401' }, availableAt: '2026-07-12T00:00:00.000Z', dueAt: '2026-07-19T00:00:00.000Z' }] }] }] }) });
  });
}

async function mockCatalog(page: Page) {
  await page.route('**/api/teacher/assignments/question-catalog', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [{ catalogItemId: 'catalog-1', sourceId: 'source-1', sourceFamily: 'checkpoint-authored-question', questionType: 'subjective-text', stemPreview: '请说明二阶系统阻尼比与超调量的关系。', knowledgeTags: ['二阶系统'], difficulty: 0.6, reviewState: 'path-eligible', rubricReadiness: 'needs-authoring', sourceVersion: 'catalog-v1', contentHash: `sha256:${'a'.repeat(64)}` }] }) }));
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
  test(`desktop editor and list remain complete at ${width}px`, async ({ page, context }) => {
    await addTeacherSession(context);
    await mockList(page);
    await mockCatalog(page);
    await page.route('**/api/teacher/assignments/assignment-created-901', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ revision: { id: 'revision-created-901', version: 2, contentHash: savedDigest } }) }));
    await page.route('**/api/teacher/assignments/assignment-created-901/publish', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(publicationResult('assignment-created-901', 'revision-created-901')) }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/teacher/assignments');
    await expect(page.getByRole('heading', { name: '作业', exact: true })).toBeVisible();
    await expect(page.getByText('控制系统分析作业')).toBeVisible();
    await capture(page, `list-${width}`);

    await page.goto('/teacher/assignments/new');
    await page.getByRole('button', { name: '新建题目' }).click();
    await expect(page.getByLabel('作业标题')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: '题面' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '参考答案' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '评分标准' })).toBeVisible();
    await expect(page.locator('[data-assignment-editor-field="question-prompt"]')).toBeVisible();
    await expect(page.locator('[data-assignment-editor-field="reference-answer"]')).toBeVisible();
    await expect(page.getByLabel('作业总分')).toHaveText('10.0');
    const firstCriterion = page.getByLabel('评分项 1 名称').locator('xpath=ancestor::article');
    await firstCriterion.getByRole('button', { name: '折叠评分项 1' }).click();
    await expect(firstCriterion.getByText('10 分')).toBeVisible();
    await expect(firstCriterion.getByText('评分标准', { exact: true })).toBeHidden();
    await firstCriterion.getByRole('button', { name: '展开评分项 1' }).click();
    if (width === 768) {
      await page.getByRole('button', { name: '添加评分项' }).click();
      const secondCriterionToggle = page.getByRole('button', {
        name: '折叠评分项 2',
      });
      await expect(secondCriterionToggle).toBeFocused();
      await page.getByRole('button', { name: '删除评分项 2' }).click();
      await expect(
        page.getByRole('button', { name: '折叠评分项 1' }),
      ).toBeFocused();

      await page.getByRole('button', { name: '新建题目' }).click();
      const outlineButtons = page.locator(
        'aside[aria-label="题目大纲"] button[data-question-id]',
      );
      const movedQuestionId = await outlineButtons.nth(1).getAttribute(
        'data-question-id',
      );
      const movedQuestion = page.locator(
        `aside[aria-label="题目大纲"] [data-question-id="${movedQuestionId}"]`,
      );
      await movedQuestion
        .locator('xpath=..')
        .getByRole('button', { name: '上移第 2 题' })
        .click();
      await expect(movedQuestion).toBeFocused();
      await movedQuestion
        .locator('xpath=..')
        .getByRole('button', { name: '删除第 1 题' })
        .click();
      await expect(outlineButtons.first()).toBeFocused();
    }
    await page.getByRole('button', { name: '从题库选择' }).click();
    await expect(page.getByRole('dialog', { name: '从受治理题库选题' })).toBeVisible();
    await expect(page.getByText('可选，发布前必须补全参考答案与评分标准')).toBeVisible();
    await page.getByRole('button', { name: '关闭受治理题库' }).click();
    await expect(page.getByRole('button', { name: '从题库选择' })).toBeFocused();
    await expect(page.getByRole('button', { name: '发布' })).toBeDisabled();
    const publicationSettings = page.locator('details[aria-label="发布设置"]');
    await expect(publicationSettings).not.toHaveAttribute('open', '');
    await publicationSettings.locator('summary').click();
    await page.locator('#assignment-validation-errors button').first().click();
    await expect(page.getByLabel('作业标题')).toBeFocused();
    await capture(page, `editor-${width}`);
    if (width === 768) {
      await page.getByLabel('作业标题').fill('控制系统分析作业');
      await page
        .locator('[data-assignment-editor-field="question-prompt"] [contenteditable="true"]')
        .fill('说明二阶系统阻尼比与超调量的关系。');
      await page
        .locator('[data-assignment-editor-field="reference-answer"] [contenteditable="true"]')
        .fill('阻尼比增大时，超调量通常减小。');
      await page.getByLabel('发布班级').selectOption('class-901');
      await page.getByLabel('开放时间').fill('2026-07-12T09:00');
      await page.getByLabel('截止时间').fill('2026-07-19T09:00');
      await page.getByRole('button', { name: '保存', exact: true }).click();
      await expect(page.getByText('自动保存：已保存')).toBeVisible();
      await page.getByRole('button', { name: '发布' }).click();
      await expect(page).toHaveURL(/\/teacher\/assignments\?highlight=assignment-created-901$/);
    }
  });
}

for (const width of mobileWidths) {
  test(`mobile editor is status-only at ${width}px`, async ({ page, context }) => {
    await addTeacherSession(context);
    await page.setViewportSize({ width, height: 760 });
    await page.goto('/teacher/assignments/new');
    await expect(page.getByText('请在平板或桌面端继续编辑。')).toBeVisible();
    await expect(page.getByRole('button', { name: '发布' })).toBeHidden();
    await expect(page.getByRole('button', { name: '新建题目' })).toBeHidden();
    await capture(page, `mobile-fallback-${width}`);
  });
}

test('loading an existing draft always passes through the server-side rubric migration boundary', async ({ page, context }) => {
  await addTeacherSession(context);
  let nextDraftCalls = 0;
  await page.route('**/api/teacher/assignments/legacy-assignment**', async (route) => {
    if (route.request().url().endsWith('/next-draft')) {
      nextDraftCalls += 1;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          revision: {
            id: 'legacy-revision',
            state: 'DRAFT',
            version: 4,
            contentHash: savedDigest,
            title: '已迁移作业',
            instructions: '完成迁移后的作业。',
            totalPoints: 10,
            latePolicy: { version: 1, mode: 'CLOSED' },
            responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT'] },
            resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true },
            solutionReleasePolicy: { version: 1, mode: 'PRIVATE' },
            questions: [{
              stableQuestionId: 'legacy-question',
              responseType: 'SUBJECTIVE_TEXT',
              points: 10,
              promptSnapshot: { text: '说明迁移后的评分标准。' },
              answerSnapshot: { text: '给出可复核证据。' },
              rubricSnapshot: {
                schemaVersion: 'assignment-scoring-rubric.v2',
                criteria: [{
                  id: 'quality',
                  label: '完成质量',
                  goalDimension: 'engineeringDecision',
                  maxPoints: 10,
                  scoringStandard: '依据证据评分。',
                  detailedRubricEnabled: false,
                  levels: [],
                }],
              },
              sourceFamily: 'MANUAL',
            }],
          },
        }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        assignment: {
          id: 'legacy-assignment',
          revisions: [{ id: 'legacy-revision', state: 'DRAFT' }],
        },
      }),
    });
  });

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/legacy-assignment/edit');

  await expect(page.getByLabel('作业标题')).toHaveValue('已迁移作业');
  await expect(page.getByLabel('启用详细评分细则')).not.toBeChecked();
  expect(nextDraftCalls).toBe(1);
});

test('list distinguishes empty, filtered-empty, and recoverable error', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.setViewportSize({ width: 768, height: 800 });
  await mockList(page, 'empty');
  await page.goto('/teacher/assignments');
  await expect(page.getByRole('heading', { name: '暂无作业' })).toBeVisible();

  await page.unroute('**/api/teacher/assignments');
  await mockList(page, 'ready');
  await page.reload();
  await page.getByPlaceholder('搜索作业').fill('不存在的作业');
  await expect(page.getByRole('heading', { name: '没有匹配的作业' })).toBeVisible();

  await page.unroute('**/api/teacher/assignments');
  await mockList(page, 'error');
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: '作业列表暂时无法加载' })).toContainText('作业列表暂时无法加载');
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
});

test('list resolves the published assignment location with teacher-visible class names', async ({ page, context }) => {
  await addTeacherSession(context);
  await mockList(page);
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/teacher/assignments?highlight=assignment-901');

  await expect(page.locator('#assignment-assignment-901')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#assignment-assignment-901')).toContainText('自控 2401');
  await expect(page.getByLabel('按班级筛选').locator('option:checked')).toHaveText('全部班级');
  await expect(page.getByLabel('按班级筛选').locator('option')).toContainText(['全部班级', '自控 2401']);
});

test('autosave conflict preserves the active field focus', async ({ page, context }) => {
  await addTeacherSession(context);
  await mockList(page);
  let publishCount = 0;
  await page.route('**/api/teacher/assignments/assignment-created-901', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'version-conflict' }) }));
  await page.route('**/api/teacher/assignments/assignment-created-901/publish', (route) => { publishCount += 1; return route.fulfill({ status: 200, body: '{}' }); });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await fillRequiredQuestionContent(page);
  await fillPublicationSchedule(page);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('自动保存：已保存')).toBeVisible();
  const title = page.getByLabel('作业标题');
  await title.fill('触发并发冲突');
  const alert = page.getByRole('alert').filter({ hasText: '检测到新版本' });
  await expect(alert).toBeVisible();
  await expect(title).toBeFocused();
  await expect(page.getByRole('button', { name: '发布' })).toBeDisabled();
  await expect(page.locator('#assignment-publication-state')).toContainText('存在版本冲突');
  expect(publishCount).toBe(0);
});

test('publication waits for an explicit saved baseline after a rapid edit', async ({ page, context }) => {
  await addTeacherSession(context);
  let savedTitle = '';
  let publishVersion = 0;
  await page.route('**/api/teacher/assignments', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: '{"assignments":[]}' });
    const body = route.request().postDataJSON() as { draft: { title: string } };
    savedTitle = body.draft.title;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ assignment: { id: 'latest-assignment', revisions: [{ id: 'latest-revision', version: 1, contentHash: savedDigest }] } }) });
  });
  await page.route('**/api/teacher/assignments/latest-assignment/publish', async (route) => {
    publishVersion = (route.request().postDataJSON() as { expectedVersion: number }).expectedVersion;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(publicationResult('latest-assignment', 'latest-revision')) });
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await fillRequiredQuestionContent(page);
  await fillPublicationSchedule(page);
  await page.getByLabel('作业标题').fill('发布前最后一刻的新标题');
  await expect(page.getByRole('button', { name: '发布' })).toBeDisabled();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('自动保存：已保存')).toBeVisible();
  await page.getByRole('button', { name: '发布' }).click();
  await expect(page).toHaveURL(/highlight=latest-assignment/);
  expect(savedTitle).toBe('发布前最后一刻的新标题');
  expect(publishVersion).toBe(1);
});

test('publication remains unavailable until queued autosaves finish', async ({ page, context }) => {
  await addTeacherSession(context);
  let patchedTitle = '';
  let publishVersion = 0;
  await page.route('**/api/teacher/assignments', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: '{"assignments":[]}' });
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ assignment: { id: 'queued-assignment', revisions: [{ id: 'queued-revision', version: 1, contentHash: savedDigest }] } }) });
  });
  await page.route('**/api/teacher/assignments/queued-assignment', async (route) => {
    patchedTitle = (route.request().postDataJSON() as { draft: { title: string } }).draft.title;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ revision: { id: 'queued-revision', version: 2, contentHash: savedDigest } }) });
  });
  await page.route('**/api/teacher/assignments/queued-assignment/publish', async (route) => {
    publishVersion = (route.request().postDataJSON() as { expectedVersion: number }).expectedVersion;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(publicationResult('queued-assignment', 'queued-revision')) });
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await fillRequiredQuestionContent(page);
  await fillPublicationSchedule(page);
  await expect(page.getByText('自动保存：正在保存')).toBeVisible({ timeout: 5_000 });
  await page.getByLabel('作业标题').fill('排队期间的新标题');
  await expect(page.getByRole('button', { name: '发布' })).toBeDisabled();
  await expect(page.getByText('自动保存：已保存')).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: '发布' }).click();
  await expect(page).toHaveURL(/highlight=queued-assignment/);
  expect(patchedTitle).toBe('排队期间的新标题');
  expect(publishVersion).toBe(2);
});

test('publication waits for a second save when the draft changes during PATCH', async ({ page, context }) => {
  await addTeacherSession(context);
  let patchCount = 0;
  let releaseFirstPatch!: () => void;
  const firstPatchStarted = new Promise<void>((resolve) => { releaseFirstPatch = resolve; });
  let unblockFirstPatch!: () => void;
  const firstPatchGate = new Promise<void>((resolve) => { unblockFirstPatch = resolve; });
  let finalPatchedTitle = '';
  let publishVersion = 0;
  await page.route('**/api/teacher/assignments', (route) => route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body: '{"assignments":[]}' })
    : route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ assignment: { id: 'stable-assignment', revisions: [{ id: 'stable-revision', version: 1, contentHash: savedDigest }] } }) }));
  await page.route('**/api/teacher/assignments/stable-assignment', async (route) => {
    patchCount += 1;
    const title = (route.request().postDataJSON() as { draft: { title: string } }).draft.title;
    if (patchCount === 1) { releaseFirstPatch(); await firstPatchGate; } else { finalPatchedTitle = title; }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ revision: { id: 'stable-revision', version: patchCount + 1, contentHash: savedDigest } }) });
  });
  await page.route('**/api/teacher/assignments/stable-assignment/publish', async (route) => { publishVersion = (route.request().postDataJSON() as { expectedVersion: number }).expectedVersion; await route.fulfill({ contentType: 'application/json', body: JSON.stringify(publicationResult('stable-assignment', 'stable-revision')) }); });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await fillRequiredQuestionContent(page);
  await fillPublicationSchedule(page);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('自动保存：已保存')).toBeVisible();
  await page.getByLabel('作业标题').fill('发布点击时标题');
  await firstPatchStarted;
  await expect(page.getByRole('button', { name: '发布' })).toBeDisabled();
  await page.getByLabel('作业标题').fill('PATCH 在途编辑后的最终标题');
  unblockFirstPatch();
  await expect(page.getByText('自动保存：已保存')).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: '发布' }).click();
  await expect(page).toHaveURL(/highlight=stable-assignment/);
  expect(patchCount).toBe(2);
  expect(finalPatchedTitle).toBe('PATCH 在途编辑后的最终标题');
  expect(publishVersion).toBe(3);
});

test('schema blockers focus their exact fields', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.setViewportSize({ width: 1024, height: 900 });
  const cases = [
    { mutate: async () => page.getByLabel('作业标题').fill(''), target: () => page.getByLabel('作业标题') },
    { mutate: async () => page.getByLabel('最多提交次数').fill('0'), target: () => page.getByLabel('最多提交次数') },
    { mutate: async () => { await page.getByLabel('迟交策略').selectOption('ALLOW'); await page.getByLabel('每日扣分百分比').fill('101'); }, target: () => page.getByLabel('每日扣分百分比') },
    { mutate: async () => page.getByLabel('评分项 1 名称').fill(''), target: () => page.getByLabel('评分项 1 名称') },
    {
      mutate: async () => {
        await page.getByLabel('启用详细评分细则').check();
        await page.getByRole('button', { name: '添加评价级别' }).click();
        await page.getByLabel('评分项 1 级别 2 分值边界').fill('2.555');
      },
      target: () => page.getByLabel('评分项 1 级别 2 分值边界'),
    },
  ];
  for (const item of cases) {
    await page.goto('/teacher/assignments/new');
    await page.getByRole('button', { name: '新建题目' }).click();
    await fillRequiredQuestionContent(page);
    await fillPublicationSchedule(page);
    await item.mutate();
    await page.locator('#assignment-validation-errors button').first().click();
    await expect(item.target()).toBeFocused();
    await expect(item.target()).toHaveAttribute('aria-describedby', 'assignment-validation-errors');
  }
});

test('a collapsed scoring item expands and focuses its exact invalid detail field', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await fillRequiredQuestionContent(page);
  await fillPublicationSchedule(page);

  const criterion = page.getByLabel('评分项 1 名称').locator('xpath=ancestor::article');
  const maximum = criterion.getByLabel('最高分');
  await maximum.fill('0');
  await criterion.getByRole('button', { name: '折叠评分项 1' }).click();
  await expect(criterion.getByRole('button', { name: '展开评分项 1' }))
    .toHaveAttribute('aria-expanded', 'false');

  await page
    .locator('#assignment-validation-errors button')
    .filter({ hasText: '补全评分项名称、分值与评分标准' })
    .first()
    .click();

  await expect(criterion.getByRole('button', { name: '折叠评分项 1' }))
    .toHaveAttribute('aria-expanded', 'true');
  await expect(maximum).toBeFocused();
});

test('invalid decimal rubric never reaches save or publish', async ({ page, context }) => {
  await addTeacherSession(context);
  let mutationCount = 0;
  await page.route('**/api/teacher/assignments**', async (route) => { if (route.request().method() === 'GET') return route.fallback(); mutationCount += 1; await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await fillRequiredQuestionContent(page);
  await fillPublicationSchedule(page);
  await page.getByLabel('启用详细评分细则').check();
  await page.getByRole('button', { name: '添加评价级别' }).click();
  await page.getByLabel('评分项 1 级别 2 分值边界').fill('2.555');
  await expect(page.getByRole('button', { name: '发布' })).toBeDisabled();
  expect(mutationCount).toBe(0);
});

test('rubric boundary conflict never reaches save or publish', async ({ page, context }) => {
  await addTeacherSession(context);
  let mutationCount = 0;
  await page.route('**/api/teacher/assignments**', async (route) => { if (route.request().method() === 'GET') return route.fallback(); mutationCount += 1; await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await fillRequiredQuestionContent(page);
  await fillPublicationSchedule(page);
  await page.getByLabel('启用详细评分细则').check();
  await page.getByRole('button', { name: '添加评价级别' }).click();
  await page.getByLabel('评分项 1 级别 2 分值边界').fill('10');
  await expect(page.getByRole('button', { name: '发布' })).toBeDisabled();
  expect(mutationCount).toBe(0);
});

test('five-level shortcut isolates edited state to the current scoring item', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();

  await page.getByLabel('启用详细评分细则').check();
  await page.getByLabel('评分项 1 档位 1 名称').fill('教师自定义优秀');
  await page.getByRole('button', { name: '添加评分项' }).click();

  const secondCriterion = page.getByLabel('评分项 2 名称').locator('xpath=ancestor::article');
  await secondCriterion.getByLabel('启用详细评分细则').check();
  await secondCriterion.getByRole('button', { name: '五级制' }).click();

  await expect(page.getByLabel('评分项 2 档位 1 名称')).toHaveValue('优秀');
  await expect(page.getByLabel('评分项 2 档位 2 名称')).toHaveValue('良好');
  await expect(page.getByLabel('评分项 2 档位 3 名称')).toHaveValue('中等');
  await expect(page.getByLabel('评分项 2 档位 4 名称')).toHaveValue('及格');
  await expect(page.getByLabel('评分项 2 档位 5 名称')).toHaveValue('不及格');
  await expect(page.getByLabel('评分项 2 级别 3 分值边界')).toHaveValue('0.8');
  await expect(page.getByLabel('评分项 2 级别 4 分值边界')).toHaveValue('0.7');
  await expect(page.getByLabel('评分项 2 级别 5 分值边界')).toHaveValue('0.6');
});

test('first input replaces publishable default rubric text and score', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await page.getByLabel('启用详细评分细则').check();

  const label = page.getByLabel('评分项 1 档位 1 名称');
  await label.click();
  await page.keyboard.type('卓越');
  await expect(label).toHaveValue('卓越');

  const guideline = page.getByLabel('评分项 1 级别 1 评分准则');
  await guideline.click();
  await page.keyboard.type('证据完整且可复核');
  await expect(guideline).toHaveValue('证据完整且可复核');

  await page.getByRole('button', { name: '添加评价级别' }).click();
  const boundary = page.getByLabel('评分项 1 级别 2 分值边界');
  await boundary.click();
  await page.keyboard.type('8.5');
  await expect(boundary).toHaveValue('8.5');
});

test('moving rubric levels keeps the derived range and highest-score lock with the level identity', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await page.getByLabel('启用详细评分细则').check();
  await page.getByRole('button', { name: '添加评价级别' }).click();

  await expect(page.getByLabel('评分项 1 级别 1 分值边界')).toHaveValue('10');
  await expect(page.getByLabel('评分项 1 级别 1 分值边界')).toBeDisabled();
  await expect(page.getByLabel('评分项 1 级别 2 分值边界')).toHaveValue('9');
  await expect(page.getByLabel('评分项 1 级别 2 分值边界')).toBeEnabled();

  await page.getByRole('button', { name: '下移档位 1' }).click();

  await expect(page.getByLabel('评分项 1 级别 1 分值边界')).toHaveValue('9');
  await expect(page.getByLabel('评分项 1 级别 1 分值边界')).toBeEnabled();
  await expect(page.getByLabel('评分项 1 级别 2 分值边界')).toHaveValue('10');
  await expect(page.getByLabel('评分项 1 级别 2 分值边界')).toBeDisabled();
});

test('lowering a criterion maximum keeps level boundaries strictly descending', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await page.getByLabel('启用详细评分细则').check();
  await page.getByRole('button', { name: '添加评价级别' }).click();

  await page.getByLabel('最高分').fill('8');

  await expect(page.getByLabel('评分项 1 级别 1 分值边界')).toHaveValue('8');
  await expect(page.getByLabel('评分项 1 级别 1 分值边界')).toBeDisabled();
  await expect(page.getByLabel('评分项 1 级别 2 分值边界')).toHaveValue('7.9');
  await expect(page.getByLabel('评分项 1 级别 2 分值边界')).toBeEnabled();
});

test('disabling an edited detailed rubric confirms the full deleted content', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  const detailed = page.getByLabel('启用详细评分细则');
  await detailed.check();
  await page.getByLabel('评分项 1 档位 1 名称').fill('教师高档');
  await page.getByLabel('评分项 1 级别 1 评分准则').fill('教师自定义准则');

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('教师高档（10 分；教师自定义准则）');
    await dialog.dismiss();
  });
  await detailed.click();
  await expect(detailed).toBeChecked();
  await expect(page.getByLabel('评分项 1 档位 1 名称')).toHaveValue('教师高档');

  page.once('dialog', (dialog) => dialog.accept());
  await detailed.click();
  await expect(detailed).not.toBeChecked();
});

test('shortening a rubric confirms every field of the trailing levels', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await page.getByLabel('启用详细评分细则').check();
  await page.getByRole('button', { name: '五级制' }).click();
  await page.getByLabel('评分项 1 档位 3 名称').fill('教师中档');
  await page.getByLabel('评分项 1 级别 3 分值边界').fill('7.5');
  await page.getByLabel('评分项 1 级别 3 评分准则').fill('教师中档完整准则');

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('教师中档（7.5 分；教师中档完整准则）');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: '两级制' }).click();
  await expect(page.getByLabel('评分项 1 档位 3 名称')).toHaveValue('教师中档');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '两级制' }).click();
  await expect(page.getByLabel('评分项 1 档位 3 名称')).toHaveCount(0);
});

test('an edited single level keeps its content while the two-level shortcut uses the 60 percent boundary', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await expect(page.getByLabel('作业总分')).toHaveText('10.0');
  await page.getByLabel('启用详细评分细则').check();
  await page.getByLabel('评分项 1 档位 1 名称').fill('教师高档');

  await page.getByRole('button', { name: '两级制' }).click();

  await expect(page.getByLabel('评分项 1 档位 1 名称')).toHaveValue('教师高档');
  await expect(page.getByLabel('评分项 1 档位 2 名称')).toHaveValue('不通过');
  await expect(page.getByLabel('评分项 1 级别 2 分值边界')).toHaveValue('6');
});

test('autosave 400 prevents publish and focuses the blocker', async ({ page, context }) => {
  await addTeacherSession(context);
  let publishCount = 0;
  await page.route('**/api/teacher/assignments', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid-payload' }) }));
  await page.route('**/api/teacher/assignments/**/publish', (route) => { publishCount += 1; return route.fulfill({ status: 200, body: '{}' }); });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await fillRequiredQuestionContent(page);
  await fillPublicationSchedule(page);
  await expect(page.getByText('自动保存：保存失败')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('button', { name: '发布' })).toBeDisabled();
  // invalid-payload 的 sr-only 公告是具体保存失败文案（SAVE_FAILURE_MESSAGES），不是通用恢复提示。
  await expect(page.locator('#assignment-publication-state')).toContainText('作业内容未通过保存校验');
  expect(publishCount).toBe(0);
});

test('aborted publish is recoverable and retry succeeds', async ({ page, context }) => {
  await addTeacherSession(context);
  let publishCount = 0;
  await page.route('**/api/teacher/assignments', (route) => route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body: '{"assignments":[]}' })
    : route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ assignment: { id: 'retry-assignment', revisions: [{ id: 'retry-revision', version: 1, contentHash: savedDigest }] } }) }));
  await page.route('**/api/teacher/assignments/retry-assignment', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ revision: { id: 'retry-revision', version: 2, contentHash: savedDigest } }) }));
  await page.route('**/api/teacher/assignments/retry-assignment/publish', async (route) => {
    publishCount += 1;
    if (publishCount === 1) return route.abort('failed');
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(publicationResult('retry-assignment', 'retry-revision')) });
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await fillRequiredQuestionContent(page);
  await fillPublicationSchedule(page);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('自动保存：已保存')).toBeVisible();
  await page.getByRole('button', { name: '发布' }).click();
  const error = page.getByRole('alert').filter({ hasText: '发布请求失败，请检查网络后重试。' });
  await expect(error).toBeVisible();
  await expect(error).toBeFocused();
  await expect(page.getByRole('button', { name: '发布' })).toBeEnabled();
  await page.getByRole('button', { name: '发布' }).click();
  await expect(page).toHaveURL(/highlight=retry-assignment/);
  expect(publishCount).toBe(2);
});

test('successful publication leaves the editor through one completion flow', async ({ page, context }) => {
  await addTeacherSession(context);
  let saveCount = 0;
  let publishCount = 0;
  await page.route('**/api/teacher/assignments', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: '{"assignments":[]}' });
    saveCount += 1;
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ assignment: { id: 'frozen-assignment', revisions: [{ id: 'frozen-revision', version: 1, contentHash: savedDigest }] } }) });
  });
  await page.route('**/api/teacher/assignments/frozen-assignment', (route) => { saveCount += 1; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ revision: { id: 'frozen-revision', version: 2, contentHash: savedDigest } }) }); });
  await page.route('**/api/teacher/assignments/frozen-assignment/publish', (route) => { publishCount += 1; return route.fulfill({ contentType: 'application/json', body: JSON.stringify(publicationResult('frozen-assignment', 'frozen-revision')) }); });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  await fillRequiredQuestionContent(page);
  await fillPublicationSchedule(page);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('自动保存：已保存')).toBeVisible();
  await page.getByRole('button', { name: '发布' }).click();
  await expect(page).toHaveURL(/highlight=frozen-assignment/);
  expect(saveCount).toBe(1);
  expect(publishCount).toBe(1);
});

test('autosave completion preserves the active input focus', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.route('**/api/teacher/assignments', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ assignment: { id: 'focus-assignment', revisions: [{ id: 'focus-revision', version: 1, contentHash: savedDigest }] } }) }));
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '新建题目' }).click();
  const title = page.getByLabel('作业标题');
  await title.fill('持续');
  await expect(title).toBeFocused();
  await expect(page.getByText('自动保存：已保存')).toBeVisible({ timeout: 5_000 });
  await expect(title).toBeFocused();
  await title.pressSequentially('输入');
  await expect(title).toHaveValue('持续输入');
});

test('semantic publication blockers resolve colon ids to exact authoring fields', async ({ page, context }) => {
  await addTeacherSession(context);
  const revision = {
    id: 'semantic-revision',
    state: 'DRAFT',
    version: 1,
    contentHash: savedDigest,
    title: '语义阻断定位',
    instructions: '',
    totalPoints: 10,
    latePolicy: { version: 1, mode: 'CLOSED' },
    responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT'] },
    resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true },
    solutionReleasePolicy: { version: 1, mode: 'PRIVATE' },
    questions: [{
      stableQuestionId: 'question:with:colon',
      orderIndex: 0,
      responseType: 'SUBJECTIVE_TEXT',
      points: 10,
      promptSnapshot: {
        text: '完整题面\n\n![受保护题图](/api/assignments/semantic-assignment/content-assets/prompt-asset "asset:prompt-asset")',
      },
      answerSnapshot: { text: '完整参考答案' },
      rubricSnapshot: {
        schemaVersion: 'assignment-scoring-rubric.v2',
        criteria: [
          {
            id: 'standard:criterion',
            label: '标准评分项',
            maxPoints: 5,
            scoringStandard: '',
            detailedRubricEnabled: false,
            levels: [],
          },
          {
            id: 'detail:criterion',
            label: '详细评分项',
            maxPoints: 4,
            scoringStandard: '按级别评分',
            detailedRubricEnabled: true,
            levels: [{
              id: 'level:one',
              label: '达成',
              maxPoints: 4,
              guideline: '',
            }],
          },
        ],
      },
      sourceFamily: 'MANUAL',
      sourceHash: `sha256:${'a'.repeat(64)}`,
      sourceReviewState: 'author-owned',
      sourceLineage: { marker: 'assignment-authoring' },
    }],
  };
  await page.route('**/api/teacher/assignments/semantic-assignment**', (route) => {
    if (route.request().url().endsWith('/next-draft')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ revision }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ assignment: { id: 'semantic-assignment', revisions: [revision] } }),
    });
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.route(
    '**/api/assignments/semantic-assignment/content-assets/prompt-asset',
    (route) => route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.goto('/teacher/assignments/semantic-assignment/edit');
  await page.getByRole('button', { name: '预览' }).click();
  const preview = page.locator('[aria-label="作业预览"]');
  await expect(preview.getByRole('img', { name: '受保护题图' })).toBeVisible();
  await expect(preview.getByRole('img', { name: '受保护题图' })).toHaveAttribute(
    'src',
    '/api/assignments/semantic-assignment/content-assets/prompt-asset',
  );
  const settings = page.locator('details[aria-label="发布设置"]');
  await settings.locator('summary').click();

  await page.getByRole('button', { name: '补全评分标准' }).click();
  await expect(page.getByLabel('评分项 1 评分标准')).toBeFocused();

  await page.getByRole('button', { name: '补全评价级别评分准则' }).click();
  await expect(page.getByLabel('评分项 2 级别 1 评分准则')).toBeFocused();

  await page.getByRole('button', {
    name: '题目分值与评分标准合计不一致',
  }).click();
  await expect(page.getByLabel('题目分值')).toBeFocused();
});

test('catalog selection abort keeps the picker open and retry succeeds', async ({ page, context }) => {
  await addTeacherSession(context);
  let selectionAttempts = 0;
  await page.route('**/api/teacher/assignments/question-catalog', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [{ catalogItemId: 'retry-catalog', sourceId: 'retry-source', sourceFamily: 'preset-adaptive-question', questionType: 'subjective-text', stemPreview: '可恢复选择题', knowledgeTags: ['控制'], difficulty: 0.5, reviewState: 'path-eligible', rubricReadiness: 'ready', sourceVersion: 'v1', contentHash: `sha256:${'a'.repeat(64)}` }] }) });
    selectionAttempts += 1;
    if (selectionAttempts === 1) return route.abort('failed');
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ question: { stableQuestionId: 'selected-retry-question', responseType: 'SUBJECTIVE_TEXT', points: 10, prompt: '重试成功后的完整题面', referenceAnswer: '完整参考答案', rubric: { schemaVersion: 'assignment-analytic-rubric.v1', criteria: [{ id: 'criterion-1', label: '完成质量', maxPoints: 10, evidenceDescription: '可复核证据', feedbackGuidance: '反馈指导', levels: [{ id: 'level-1', label: '达成', minPoints: 0, maxPoints: 10, description: '完整档位' }] }] }, source: { family: 'MANUAL', authoringMarker: 'assignment-authoring' } } }) });
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.getByRole('button', { name: '从题库选择' }).click();
  await page.getByRole('button', { name: '选择此题' }).click();
  const error = page.getByRole('alert').filter({ hasText: '题库题目载入失败，请重试。' });
  await expect(error).toBeVisible();
  await expect(error).toBeFocused();
  await expect(page.getByRole('dialog', { name: '从受治理题库选题' })).toBeVisible();
  await page.getByRole('button', { name: '选择此题' }).click();
  await expect(page.getByRole('dialog', { name: '从受治理题库选题' })).toBeHidden();
  await expect(
    page.locator('[data-assignment-editor-field="question-prompt"] [contenteditable="true"]'),
  ).toHaveText('重试成功后的完整题面');
  expect(selectionAttempts).toBe(2);
});

test('managed class picker exposes loading, error recovery, empty state, and selection', async ({ page, context }) => {
  await addTeacherSession(context);
  let calls = 0;
  await page.route('**/api/teacher/assignments/managed-classes', async (route) => {
    calls += 1;
    if (calls === 1) { await new Promise((resolve) => setTimeout(resolve, 200)); return route.fulfill({ status: 503, body: '{}' }); }
    if (calls === 2) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ classes: [] }) });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ classes: [{ id: 'managed-1', name: '受管班级', code: 'MGD001', year: '2026', semester: '秋' }] }) });
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/teacher/assignments/new');
  await page.locator('details[aria-label="发布设置"] summary').click();
  await expect(page.getByText('正在加载可管理班级……')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '可管理班级加载失败' })).toBeVisible();
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.getByText('暂无可发布的活跃班级')).toBeVisible();
  await page.reload();
  await page.locator('details[aria-label="发布设置"] summary').click();
  await expect(page.getByLabel('发布班级')).toBeVisible();
  await page.getByLabel('发布班级').selectOption('managed-1');
  await expect(page.getByLabel('发布班级')).toHaveValue('managed-1');
});

async function fillPublicationSchedule(page: Page) {
  const settings = page.locator('details[aria-label="发布设置"]');
  if (!(await settings.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await settings.locator('summary').click();
  }
  await page.getByLabel('发布班级').selectOption('class-901');
  await page.getByLabel('开放时间').fill('2099-01-01T09:00');
  await page.getByLabel('截止时间').fill('2099-01-02T09:00');
}

async function fillRequiredQuestionContent(page: Page) {
  await page.getByLabel('作业标题').fill('初始作业');
  await page
    .locator(
      '[data-assignment-editor-field="question-prompt"] [contenteditable="true"]',
    )
    .fill('说明二阶系统阻尼比与超调量的关系。');
  await page
    .locator(
      '[data-assignment-editor-field="reference-answer"] [contenteditable="true"]',
    )
    .fill('阻尼比增大时，超调量通常减小。');
}
