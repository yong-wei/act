import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';

const question = {
  assessmentStage: 'checkpoint',
  estimatedAbility: 0.42,
  confidenceInterval: [0.2, 0.7],
  question: {
    id: 'eligibility-checkpoint-01',
    stem: '相位裕度下降后，时域超调通常如何变化？',
    domains: ['frequency', 'time'],
    type: 'bode-to-stability',
    difficulty: 0.5,
    knowledgeTags: ['phase-margin'],
    options: [
      { label: 'A', text: '超调下降', explanation: '不符' },
      { label: 'B', text: '超调升高', explanation: '相位裕度下降通常对应超调升高。' },
      { label: 'C', text: '完全不变', explanation: '不符' },
    ],
  },
};

function submitPayload(kind: 'qualified' | 'uncovered') {
  return {
    isCorrect: false,
    correctOption: 'B',
    explanation: '相位裕度下降通常对应阻尼降低、超调升高。',
    estimatedAbility: 0.4,
    recommendedFocus: ['继续校正设计练习'],
    durableAnswerId: `answer-${kind}`,
    adaptiveAssessmentRef: { catalogItemId: 'catalog-reviewed', reviewState: 'reviewed' },
    microTutoring: kind === 'qualified'
      ? {
        stage: 'checkpoint',
        qualified: true,
        unavailableReason: null,
        retryAttribution: false,
      }
      : {
        stage: 'checkpoint',
        qualified: false,
        unavailableReason: 'NOT_COVERED',
        retryAttribution: true,
      },
  };
}

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

async function installRoutes(page: Page, kind: 'qualified' | 'uncovered') {
  await page.route('**/api/assessment/diagnostic', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      knowledgeDimensions: { computational: 68, crossDomain: 60, design: 55 },
      weakAreas: ['controller-tuning'],
      recommendedFocus: ['继续校正设计练习'],
    }),
  }));
  await page.route('**/api/assessment/next-question', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(question),
  }));
  await page.route('**/api/assessment/submit-answer', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(submitPayload(kind)),
  }));
}

async function openQuestion(page: Page, width: number) {
  await page.setViewportSize({ width, height: width === 320 ? 900 : 1000 });
  const nextQuestionResponse = page.waitForResponse((response) => (
    response.url().endsWith('/api/assessment/next-question') && response.ok()
  ));
  await page.goto('/assessment/adaptive-practice?goal=control-correction&intent=practice', {
    waitUntil: 'domcontentloaded',
  });
  await nextQuestionResponse;
  const resourceModule = page.locator('[data-adaptive-practice-resource="path-node"]');
  await expect(resourceModule).toBeVisible();
  const moduleHeader = resourceModule.locator('[data-adaptive-path-module-header="responsive"]');
  await expect(async () => {
    if (await moduleHeader.getAttribute('aria-expanded') !== 'true') {
      await moduleHeader.click({ noWaitAfter: true });
    }
    await expect(moduleHeader).toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 });
  }).toPass({ timeout: 10_000 });
  const expandQuestion = resourceModule.getByRole('button', { name: '展开练习题' }).first();
  if (await expandQuestion.isVisible()) await expandQuestion.click({ noWaitAfter: true });
  const activeQuestion = page.locator('[data-adaptive-practice-question="active"]');
  await expect(activeQuestion).toBeVisible();
  return { resourceModule, activeQuestion };
}

async function assertNoOverflow(page: Page, width: number) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.viewport).toBe(width);
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
}

test.beforeEach(async ({ context }) => {
  await login(context);
});

for (const width of [1440, 320] as const) {
  test(`shows the checkpoint stage and qualified tutoring entry at ${width}px`, async ({ page }) => {
    await installRoutes(page, 'qualified');
    const { resourceModule, activeQuestion } = await openQuestion(page, width);
    await expect(activeQuestion).toHaveAttribute('data-adaptive-practice-stage', 'checkpoint');
    await expect(activeQuestion.getByText('检查点练习', { exact: true })).toBeVisible();
    await expect(activeQuestion.getByText('检查节点练习')).toHaveCount(0);
    await resourceModule.getByRole('radio', { name: /^A\./ }).check();
    await resourceModule.getByRole('button', { name: '提交答案' }).click();
    await expect(page.locator('[data-student-micro-tutoring="panel"]')).toBeVisible();
    await expect(page.locator('[data-micro-tutoring-unavailable]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '开始微辅导' })).toBeVisible();
    await assertNoOverflow(page, width);
  });

  test(`hides tutoring and offers retry when the server reports uncovered at ${width}px`, async ({ page }) => {
    await installRoutes(page, 'uncovered');
    const { resourceModule, activeQuestion } = await openQuestion(page, width);
    await resourceModule.getByRole('radio', { name: /^A\./ }).check();
    await resourceModule.getByRole('button', { name: '提交答案' }).click();
    await expect(page.locator('[data-student-micro-tutoring="panel"]')).toHaveCount(0);
    await expect(page.locator('[data-micro-tutoring-unavailable="NOT_COVERED"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '重新作答' })).toBeVisible();
    await expect(activeQuestion).toHaveAttribute('data-adaptive-practice-stage', 'checkpoint');
    await assertNoOverflow(page, width);
  });
}
