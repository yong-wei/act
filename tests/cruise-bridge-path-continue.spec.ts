import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

import { verifiedAuthForm } from './verified-test-credentials';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';

const nextHref = '/interactive-learning/resources/lesson13-phase-concept-quiz?source=adaptive-path-center&goal=control-correction&pathId=evidence-path&nodeId=registry%3Alesson13-phase-concept-quiz&intent=path-execution';

const successfulJourney = {
  journey: {
    path: { id: 'evidence-path', title: '控制系统校正路径' },
    goal: { id: 'control-correction' },
    context: {
      pathId: 'evidence-path',
      goalId: 'control-correction',
      requestedNodeId: 'registry:lesson13-cruise-bridge',
    },
    current: {
      nodeId: 'registry:lesson13-phase-concept-quiz',
      title: '幅相概念速判',
      type: 'quiz',
    },
    progress: { completed: 1, total: 3 },
    return: {
      label: '返回学习路径',
      href: '/assessment/adaptive-practice?goal=control-correction',
    },
    pathStatus: 'active',
    nextAction: {
      state: 'ready',
      nodeId: 'registry:lesson13-phase-concept-quiz',
      title: '幅相概念速判',
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
    '/assessment/adaptive-practice?goal=control-correction&pathId=evidence-path&nodeId=registry%3Alesson13-cruise-bridge&intent=path-execution',
  );
  return `/interactive-learning/resources/lesson13-cruise-bridge?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=evidence-path&nodeId=registry%3Alesson13-cruise-bridge&intent=path-execution&returnHref=${returnHref}&resourceType=knowledge_card`;
}

async function waitForContinueButton(page: Page) {
  await expect(page.getByRole('button', { name: '继续下一步' })).toBeVisible({ timeout: 15_000 });
}

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const) {
  test(`${viewport.name} keeps narration off the scene center and continues the path after retry`, async ({ context, page }) => {
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
    await expect(page.getByRole('heading', { name: /快艇 vs/ })).toBeVisible();

    const root = page.locator('[data-cruise-bridge-root]');
    const narration = page.locator('[data-cruise-bridge-narration]');
    await expect(narration).toBeVisible({ timeout: 4_000 });
    const rootBox = await root.boundingBox();
    const narrationBox = await narration.boundingBox();
    expect(rootBox).not.toBeNull();
    expect(narrationBox).not.toBeNull();
    expect((narrationBox?.y ?? 0) + (narrationBox?.height ?? 0)).toBeLessThan(
      (rootBox?.y ?? 0) + (rootBox?.height ?? 0) * 0.45,
    );

    await waitForContinueButton(page);
    await expect(narration).toHaveCount(0);

    await page.getByRole('button', { name: '继续下一步' }).click();
    await expect(page.getByText('路径进度未能确认，请重试。')).toBeVisible();
    await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
    expect(page.url()).toContain('/interactive-learning/resources/lesson13-cruise-bridge');

    await page.getByRole('button', { name: '重试' }).click();
    await expect(page.getByRole('button', { name: '正在提交' })).toBeDisabled();
    releaseSuccess?.();

    await expect(page).toHaveURL(/lesson13-phase-concept-quiz/, { timeout: 10_000 });
  });
}

test('ordinary interactive-learning entry stays on the resource after continue', async ({ context, page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await establishAuthenticatedSession(context);

  let executeCalls = 0;
  await page.route('**/api/learning-paths/**/execute', async (route: Route) => {
    executeCalls += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"should-not-run"}' });
  });

  await page.goto('/interactive-learning/resources/lesson13-cruise-bridge', { waitUntil: 'domcontentloaded' });
  await waitForContinueButton(page);
  await page.getByRole('button', { name: '继续下一步' }).click();
  await expect(page.getByRole('button', { name: '继续下一步' })).toBeDisabled();
  await expect(page).toHaveURL(/\/interactive-learning\/resources\/lesson13-cruise-bridge/);
  expect(executeCalls).toBe(0);
});
