import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';

const nextHref = '/interactive-learning/resources/lesson09-correction-strategy?source=adaptive-path-center&goal=control-correction&pathId=evidence-path&nodeId=registry%3Alesson09-correction-strategy&intent=path-execution';

const successfulJourney = {
  journey: {
    path: { id: 'evidence-path', title: '校正路径' },
    goal: { id: 'control-correction' },
    context: {
      pathId: 'evidence-path',
      goalId: 'control-correction',
      requestedNodeId: 'registry:lesson09-correction-precheck',
    },
    current: {
      nodeId: 'registry:lesson09-correction-strategy',
      title: '校正策略',
      type: 'interactive_lesson',
    },
    progress: { completed: 1, total: 3 },
    return: {
      label: '返回学习路径',
      href: '/assessment/adaptive-practice?goal=control-correction',
    },
    pathStatus: 'active',
    nextAction: {
      state: 'ready',
      nodeId: 'registry:lesson09-correction-strategy',
      title: '校正策略',
      type: 'interactive_lesson',
      href: nextHref,
      reason: null,
      recovery: null,
    },
  },
};

async function establishAuthenticatedSession(context: BrowserContext) {
  const csrfResponse = await context.request.get(`${baseURL}/api/auth/csrf`);
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();

  const loginResponse = await context.request.post(`${baseURL}/api/auth/callback/credentials?json=true`, {
    form: {
      csrfToken: csrf.csrfToken!,
      email: 'demo',
      password: 'DemoStudent@Just2026!',
      callbackUrl: baseURL,
      json: 'true',
    },
  });
  expect(
    loginResponse.ok(),
    `credentials login failed: ${loginResponse.status()} ${await loginResponse.text()}`,
  ).toBe(true);
}

function launchUrl() {
  const returnHref = encodeURIComponent(
    '/assessment/adaptive-practice?goal=control-correction&pathId=evidence-path&nodeId=registry%3Alesson09-correction-precheck&intent=path-execution',
  );
  return `/interactive-learning/resources/lesson09-correction-precheck?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=evidence-path&nodeId=registry%3Alesson09-correction-precheck&intent=path-execution&returnHref=${returnHref}&resourceType=quiz`;
}

async function completeAllQuestions(page: Page) {
  await expect(page.getByRole('heading', { name: '串联校正要点' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: '继续下一步' })).toHaveCount(0);

  for (let index = 0; index < 5; index += 1) {
    await page.getByRole('button', { name: /^A\./ }).click();
    await page.getByRole('button', { name: '提交' }).click();
    if (index < 4) {
      await page.getByRole('button', { name: '下一题' }).click();
    }
  }

  await expect(page.getByRole('button', { name: '继续下一步' })).toBeVisible();
}

test('path-launched correction precheck waits for continue, retries failure, then follows the journey', async ({ context, page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await establishAuthenticatedSession(context);

  let completionAttempts = 0;
  let releaseSuccess: (() => void) | undefined;
  let resolveSecondAttemptStarted: (() => void) | undefined;
  const secondAttemptStarted = new Promise<void>((resolve) => {
    resolveSecondAttemptStarted = resolve;
  });
  await page.route('**/api/learning-paths/**/execute', async (route: Route) => {
    const body = route.request().postDataJSON() as { status?: string } | null;
    if (body?.status !== 'completed') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(successfulJourney),
      });
      return;
    }

    completionAttempts += 1;
    if (completionAttempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"temporary"}' });
      return;
    }
    resolveSecondAttemptStarted?.();
    await new Promise<void>((resolve) => {
      releaseSuccess = resolve;
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(successfulJourney),
    });
  });

  await page.goto(launchUrl(), { waitUntil: 'domcontentloaded' });
  await completeAllQuestions(page);

  await page.getByRole('button', { name: '继续下一步' }).click();
  await expect(page.getByText('路径进度未能确认，请重试。')).toBeVisible();
  await expect(page.locator('[data-path-resource-continue="error"] button')).toHaveText('重试');
  expect(page.url()).toContain('/interactive-learning/resources/lesson09-correction-precheck');

  await page.locator('[data-path-resource-continue="error"] button').click({ force: true });
  await secondAttemptStarted;
  await expect(page.locator('[data-path-resource-continue="pending"]')).toBeVisible();
  releaseSuccess?.();

  await expect(page).toHaveURL(/lesson09-correction-strategy/, { timeout: 10_000 });
});
