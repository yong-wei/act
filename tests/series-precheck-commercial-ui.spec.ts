import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';
const evidenceDir = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-993-series-precheck');
const captureEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';

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

async function reachFinalQuestion(page: Page) {
  for (let index = 0; index < 4; index += 1) {
    await page.locator('.grid.gap-3 button').first().click();
    await page.getByRole('button', { name: '检查' }).click();
    if (index < 3) await page.getByRole('button', { name: '下一题' }).click();
  }
  await expect(page.getByText('进度 4/4')).toBeVisible();
  await expect(page.getByRole('button', { name: '完成检测' })).toBeVisible();
  await expect(page.getByRole('button', { name: '下一题' })).toHaveCount(0);
}

async function capture(page: Page, filename: string) {
  const outputDir = captureEvidence ? evidenceDir : path.resolve(process.cwd(), 'test-results/series-precheck-commercial-ui');
  mkdirSync(outputDir, { recursive: true });
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: true });
}

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const) {
  test(`${viewport.name} exposes final, failure, retry submission, and success states`, async ({ context, page }) => {
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    const returnHref = encodeURIComponent(
      '/assessment/adaptive-practice?goal=control-correction&pathId=evidence-path&nodeId=series-precheck&intent=path-execution',
    );
    await page.goto(
      `/interactive-learning/resources/lesson15-series-precheck?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=evidence-path&nodeId=series-precheck&intent=path-execution&returnHref=${returnHref}&resourceType=quiz`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.getByRole('heading', { name: '概念速判' })).toBeVisible();

    await reachFinalQuestion(page);
    await capture(page, `${viewport.name}-final-action.png`);

    await page.getByRole('button', { name: '完成检测' }).click();
    const failureMessage = page.getByText('检测结果提交失败');
    await expect(failureMessage).toBeVisible();
    await expect(page.getByRole('button', { name: '重试完成检测' })).toBeVisible();
    await failureMessage.scrollIntoViewIfNeeded();
    await capture(page, `${viewport.name}-failure-retry.png`);

    await page.getByRole('button', { name: '重试完成检测' }).click();
    await expect(page.getByRole('button', { name: '正在提交' })).toBeDisabled();
    await capture(page, `${viewport.name}-submitting.png`);
    releaseSuccess?.();

    const successMessage = page.getByText('检测结果已保存');
    await expect(successMessage).toBeVisible();
    await expect(page.getByRole('button', { name: '检测已完成' })).toBeDisabled();
    await successMessage.scrollIntoViewIfNeeded();
    await capture(page, `${viewport.name}-success.png`);

    const viewportGeometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(viewportGeometry.scrollWidth).toBe(viewportGeometry.clientWidth);
  });
}
