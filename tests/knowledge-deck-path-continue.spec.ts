import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

import { verifiedAuthForm } from './verified-test-credentials';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';

const nextHref = '/interactive-learning/resources/lesson01-component-role-match?source=adaptive-path-center&goal=control-feedback&pathId=evidence-path&nodeId=registry%3Alesson01-component-role-match&intent=path-execution';

const successfulJourney = {
  journey: {
    path: { id: 'evidence-path', title: '反馈控制路径' },
    goal: { id: 'control-feedback' },
    context: {
      pathId: 'evidence-path',
      goalId: 'control-feedback',
      requestedNodeId: 'registry:lesson01-feedback-knowledge-deck-v1',
    },
    current: {
      nodeId: 'registry:lesson01-component-role-match',
      title: '系统组成角色匹配',
      type: 'quiz',
    },
    progress: { completed: 1, total: 3 },
    return: {
      label: '返回学习路径',
      href: '/assessment/adaptive-practice?goal=control-feedback',
    },
    pathStatus: 'active',
    nextAction: {
      state: 'ready',
      nodeId: 'registry:lesson01-component-role-match',
      title: '系统组成角色匹配',
      type: 'quiz',
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
      ...verifiedAuthForm('student'),
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
    '/assessment/adaptive-practice?goal=control-feedback&pathId=evidence-path&nodeId=registry%3Alesson01-feedback-knowledge-deck-v1&intent=path-execution',
  );
  return `/interactive-learning/resources/lesson01-feedback-knowledge-deck-v1?source=adaptive-path-center&goal=control-feedback&goalId=control-feedback&pathId=evidence-path&nodeId=registry%3Alesson01-feedback-knowledge-deck-v1&intent=path-execution&returnHref=${returnHref}&resourceType=knowledge_card`;
}

async function visitAllKnowledgeCards(page: Page) {
  await expect(page.getByRole('heading', { name: '反馈控制知识卡片' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('已浏览 1/4')).toBeVisible();
  await expect(page.getByRole('button', { name: '继续下一步' })).toHaveCount(0);

  await page.getByRole('button', { name: '2. 控制系统四要素' }).click();
  await page.getByRole('button', { name: '3. 开环 vs 闭环' }).click();
  await page.getByRole('button', { name: '4. 反馈带来的价值' }).click();

  await expect(page.getByText('已浏览 4/4')).toBeVisible();
  await expect(page.getByRole('button', { name: '继续下一步' })).toBeVisible();
}

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const) {
  test(`${viewport.name} path-launched knowledge deck waits for continue, retries failure, then follows the journey`, async ({ context, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await establishAuthenticatedSession(context);

    let attempt = 0;
    let releaseSuccess: (() => void) | undefined;
    await page.route('**/api/learning-paths/**/execute', async (route: Route) => {
      attempt += 1;
      if (attempt === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"temporary"}' });
        return;
      }
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
    await visitAllKnowledgeCards(page);

    await page.getByRole('button', { name: '继续下一步' }).click();
    await expect(page.getByText('路径进度未能确认，请重试。')).toBeVisible();
    await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
    expect(page.url()).toContain('/interactive-learning/resources/lesson01-feedback-knowledge-deck-v1');

    await page.getByRole('button', { name: '重试' }).click();
    await expect(page.getByRole('button', { name: '正在提交' })).toBeDisabled();
    releaseSuccess?.();

    await expect(page).toHaveURL(/lesson01-component-role-match/, { timeout: 10_000 });
  });
}

test('ordinary interactive-learning knowledge deck entry does not call path execute', async ({ context, page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await establishAuthenticatedSession(context);

  let executeCalls = 0;
  await page.route('**/api/learning-paths/**/execute', async (route: Route) => {
    executeCalls += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"should-not-run"}' });
  });

  await page.goto('/interactive-learning/resources/lesson01-feedback-knowledge-deck-v1', { waitUntil: 'domcontentloaded' });
  await visitAllKnowledgeCards(page);
  await page.getByRole('button', { name: '继续下一步' }).click();
  await expect(page.getByRole('button', { name: '继续下一步' })).toBeDisabled();
  await expect(page).toHaveURL(/\/interactive-learning\/resources\/lesson01-feedback-knowledge-deck-v1/);
  expect(executeCalls).toBe(0);
});
