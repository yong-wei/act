import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';
const domainGoals = [
  'control-correction',
  'frequency-response-foundations',
  'time-domain-response-analysis',
  'transfer-function-modeling-foundations',
] as const;

type AnswerFixture = {
  question: { question: { id: string; options: Array<{ label: string }> } };
  correct: { isCorrect: boolean; correctOption: string };
  incorrect: { isCorrect: boolean; correctOption: string };
};

const STARTED = {
  id: 'intervention-1396',
  status: 'STARTED',
  startedAt: '2026-08-21T00:00:00.000Z',
  progress: { resourceUseCount: 0, hintCount: 0, completedAt: null, durationSeconds: null },
  validation: null,
  recommendation: null,
};

async function login(context: BrowserContext) {
  const csrfResponse = await context.request.get(`${baseURL}/api/auth/csrf`);
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  const loginResponse = await context.request.post(`${baseURL}/api/auth/callback/credentials?json=true`, {
    form: {
      csrfToken: csrf.csrfToken!,
      email: 'demo',
      password: 'DemoStudent@Just2026!',
      callbackUrl: baseURL,
      json: 'true',
    },
  });
  expect(loginResponse.ok(), `login failed: ${loginResponse.status()}`).toBe(true);
}

async function persistWrongAnswer(
  context: BrowserContext,
  goalId: string,
  routeIntent = 'practice',
): Promise<AnswerFixture> {
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const questionResponse = await context.request.post(`${baseURL}/api/assessment/next-question`, {
    data: { sessionId: `micro-tutoring-qualify-${goalId}-${key}`, goalId, routeIntent },
  });
  expect(questionResponse.ok(), await questionResponse.text()).toBe(true);
  const question = await questionResponse.json() as AnswerFixture['question'];
  const firstOption = question.question.options[0]?.label;
  expect(firstOption).toBeTruthy();
  const submit = async (sessionId: string, selectedOption: string) => {
    const response = await context.request.post(`${baseURL}/api/assessment/submit-answer`, {
      data: { sessionId, questionId: question.question.id, selectedOption, timeSpent: 1, goalId, routeIntent },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json() as Promise<{ isCorrect: boolean; correctOption: string }>;
  };
  const first = await submit(`probe-${key}`, firstOption!);
  const incorrectOption = question.question.options.find((option) => option.label !== first.correctOption)?.label;
  expect(incorrectOption).toBeTruthy();
  const correct = first.isCorrect ? first : await submit(`correct-${key}`, first.correctOption);
  const incorrect = first.isCorrect ? await submit(`incorrect-${key}`, incorrectOption!) : first;
  return { question, correct, incorrect };
}

async function installRoutes(page: Page, fixture: AnswerFixture, mode: 'success' | 'failure' | 'unavailable' | 'drift') {
  await page.route('**/api/assessment/diagnostic', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ knowledgeDimensions: { computational: 68 }, weakAreas: ['controller-tuning'], recommendedFocus: ['继续练习'] }),
  }));
  await page.route('**/api/assessment/next-question', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(fixture.question),
  }));
  await page.route('**/api/assessment/submit-answer', async (route) => {
    const body = await route.request().postDataJSON() as { selectedOption?: string };
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(body.selectedOption === fixture.correct.correctOption ? fixture.correct : fixture.incorrect),
    });
  });
  let createAttempts = 0;
  await page.route('**/api/assessment/remediation**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (mode === 'unavailable' && pathname.endsWith('/remediation') && method === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'UNAVAILABLE',
          unavailableReason: 'RESOURCE_UNAVAILABLE',
          manualPracticePath: '/assessment/adaptive-practice?intent=practice',
        }),
      });
    }
    if (pathname.endsWith('/interventions/validation') && method === 'GET') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ id: 'validation-1396', prompt: '应优先检查哪一项？', options: [{ label: 'A', text: '相位裕度' }, { label: 'B', text: '采样间隔' }] }),
      });
    }
    if (pathname.endsWith('/interventions/validation') && method === 'POST') {
      const passed = mode === 'success';
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ...STARTED,
          status: 'VALIDATED',
          validation: { isCorrect: passed, submittedAt: '2026-08-21T00:02:00.000Z' },
          recommendation: passed
            ? { kind: 'TRANSFER_PRACTICE_UNAVAILABLE', basisSummary: '验证通过后可继续常规练习。', actions: [] }
            : { kind: 'ADJUST_TUTORING_STRATEGY', basisSummary: '验证未通过，请回到常规练习。', manualPracticePath: '/assessment/adaptive-practice?intent=practice' },
        }),
      });
    }
    if (pathname.endsWith('/interventions/events') && method === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ...STARTED,
          status: 'COMPLETED',
          progress: { ...STARTED.progress, completedAt: '2026-08-21T00:01:00.000Z', durationSeconds: 60 },
        }),
      });
    }
    if (pathname.endsWith('/interventions') && method === 'POST') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(STARTED) });
    }
    if (pathname.endsWith('/remediation') && method === 'POST') {
      createAttempts += 1;
      if (mode === 'drift' && createAttempts === 1) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'UNAVAILABLE', unavailableReason: 'REFERENCE_DRIFT' }),
        });
      }
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'remediation-1396',
          status: 'AVAILABLE',
          task: { goal: '复盘刚选错的概念。', estimatedMinutes: 8, resources: [{ id: 'resource-1', title: '受治理资源', estimatedMinutes: 6, actionPath: '/interactive-learning/resources/lesson15-series-precheck' }] },
        }),
      });
    }
    return route.continue();
  });
}

async function openPanel(page: Page, fixture: AnswerFixture, goalId: string, width: number, intent = 'practice') {
  await page.setViewportSize({ width, height: width === 320 ? 900 : 1000 });
  const nextQuestionResponse = page.waitForResponse((response) => (
    response.url().endsWith('/api/assessment/next-question') && response.ok()
  ));
  await page.goto(`/assessment/adaptive-practice?goal=${goalId}&intent=${intent}`, { waitUntil: 'domcontentloaded' });
  await nextQuestionResponse;
  const resourceModule = page.locator('[data-adaptive-practice-resource="path-node"]');
  await expect(resourceModule).toBeVisible();
  const moduleHeader = resourceModule.locator('[data-adaptive-path-module-header="responsive"]');
  await expect(async () => {
    if (await moduleHeader.getAttribute('aria-expanded') !== 'true') await moduleHeader.click({ noWaitAfter: true });
    await expect(moduleHeader).toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 });
  }).toPass({ timeout: 10_000 });
  const expandQuestion = resourceModule.getByRole('button', { name: '展开练习题' }).first();
  if (await expandQuestion.isVisible()) await expandQuestion.click({ noWaitAfter: true });
  await expect(resourceModule.getByRole('radio').first()).toBeVisible();
  const wrongOption = fixture.question.question.options.find((option) => option.label !== fixture.correct.correctOption)?.label;
  await resourceModule.getByRole('radio', { name: new RegExp(`^${wrongOption}\\.`) }).check();
  await resourceModule.getByRole('button', { name: '提交答案' }).click();
  const panel = page.locator('[data-student-micro-tutoring="panel"]');
  await expect(panel).toBeVisible();
  return panel;
}

test.beforeEach(async ({ context }) => {
  await login(context);
});

for (const goalId of domainGoals) {
  test(`completes a successful micro-tutoring loop for ${goalId}`, async ({ context, page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await persistWrongAnswer(context, goalId);
    await installRoutes(page, fixture, 'success');
    const panel = await openPanel(page, fixture, goalId, 1440);
    await panel.getByRole('button', { name: '开始微辅导' }).click();
    await panel.getByRole('button', { name: '开始本次辅导' }).click();
    await panel.getByRole('button', { name: '完成学习，进入验证' }).click();
    await panel.getByRole('button', { name: '获取验证题' }).click();
    await panel.getByRole('radio', { name: /相位裕度/ }).check();
    await panel.getByRole('button', { name: '提交验证' }).click();
    await expect(panel.getByRole('status')).toContainText('验证通过');
    expect(JSON.stringify(await panel.innerText())).not.toContain('PRIVATE');
    expect(errors.filter((message) => /ChunkLoadError|React/.test(message))).toEqual([]);
  });
}

test('shows a governed recommendation after validation failure', async ({ context, page }) => {
  const fixture = await persistWrongAnswer(context, 'control-correction');
  await installRoutes(page, fixture, 'failure');
  const panel = await openPanel(page, fixture, 'control-correction', 1440);
  await panel.getByRole('button', { name: '开始微辅导' }).click();
  await panel.getByRole('button', { name: '开始本次辅导' }).click();
  await panel.getByRole('button', { name: '完成学习，进入验证' }).click();
  await panel.getByRole('button', { name: '获取验证题' }).click();
  await panel.getByRole('radio', { name: /采样间隔/ }).check();
  await panel.getByRole('button', { name: '提交验证' }).click();
  await expect(panel.getByRole('status')).toContainText('验证未通过');
  await expect(panel.getByRole('link', { name: '进入常规练习' })).toBeVisible();
});

test('surfaces unavailable state and the regular practice recovery path', async ({ context, page }) => {
  const fixture = await persistWrongAnswer(context, 'control-correction');
  await installRoutes(page, fixture, 'unavailable');
  const panel = await openPanel(page, fixture, 'control-correction', 1440);
  await panel.getByRole('button', { name: '开始微辅导' }).click();
  await expect(panel.getByRole('link', { name: '进入常规练习' })).toHaveAttribute('href', '/assessment/adaptive-practice?intent=practice');
});

test('recovers from REFERENCE_DRIFT by re-orchestrating', async ({ context, page }) => {
  const fixture = await persistWrongAnswer(context, 'control-correction');
  await installRoutes(page, fixture, 'drift');
  const panel = await openPanel(page, fixture, 'control-correction', 1440);
  await panel.getByRole('button', { name: '开始微辅导' }).click();
  await expect(panel.getByRole('status')).toContainText('任务内容已更新，请返回练习后重新开始。');
  await panel.getByRole('button', { name: '重新尝试微辅导' }).click();
  await expect(panel.getByRole('button', { name: '开始本次辅导' })).toBeVisible();
});

test('keeps 320px dark theme free of horizontal overflow', async ({ context, page }) => {
  await page.addInitScript(() => localStorage.setItem('ai-obe-theme', 'dark'));
  const fixture = await persistWrongAnswer(context, 'control-correction');
  await installRoutes(page, fixture, 'success');
  const panel = await openPanel(page, fixture, 'control-correction', 320);
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
  await expect(panel).toBeVisible();
});

const v2Entries = ['practice', 'checkpoint', 'readiness', 'remediation'] as const;

for (const routeIntent of v2Entries) {
  test(`covers a v2-entry ${routeIntent} wrong-answer loop for control-correction`, async ({ context, page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await persistWrongAnswer(context, 'control-correction', routeIntent);
    await installRoutes(page, fixture, 'success');
    const panel = await openPanel(page, fixture, 'control-correction', 1440, routeIntent);
    await panel.getByRole('button', { name: '开始微辅导' }).click();
    await panel.getByRole('button', { name: '开始本次辅导' }).click();
    await panel.getByRole('button', { name: '完成学习，进入验证' }).click();
    await panel.getByRole('button', { name: '获取验证题' }).click();
    await panel.getByRole('radio', { name: /相位裕度/ }).check();
    await panel.getByRole('button', { name: '提交验证' }).click();
    await expect(panel.getByRole('status')).toContainText('验证通过');
    expect(errors.filter((message) => /ChunkLoadError|React/.test(message))).toEqual([]);
  });
}
