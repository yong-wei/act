import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { verifiedAuthForm } from './verified-test-credentials';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';
const handoutPath = '/interactive-learning/lessons/1-3/handout-print';
const handoutHeadingId = 'h1-模块1-导论串讲-控制系统的完整图像';
const coursePath = '/interactive-learning/courses/unit-1-1-see-the-full-picture?media=1-1-audio&t=220';
const stepPath = '/interactive-learning/courses/unit-1-3-parameter-pole-migration/student/demo?step=step-04';
const pathExecutionHref = '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution&anchoredLaunchFixture=1';
const timeConstantNodeId = 'ctkg:v3e-canonical-3311578f3f7796d3b9ff0830';

const IGNORABLE_CONSOLE = /favicon|hydration|401|Unauthorized|net::ERR|Failed to load resource/i;

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return () => errors.filter((line) => !IGNORABLE_CONSOLE.test(line));
}

async function activateOverlayControl(page: Page, selector: string) {
  const locator = page.locator(selector);
  await expect(locator).toHaveCount(1);
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error(`Expected HTMLElement for ${selector}`);
    element.click();
  });
}

async function enterDomainAndSearch(page: Page, domainEntry: string, query: string, nodeId?: string) {
  await activateOverlayControl(page, `[data-authority-domain-entry="${domainEntry}"]`);
  const search = page.locator('#active-authority-search');
  await expect(search).toBeVisible({ timeout: 60_000 });
  await search.fill(query);
  await expect(page.locator('[data-active-search-results]')).toBeVisible({ timeout: 30_000 });
  const hitSelector = nodeId
    ? `[data-active-authority-search-result="${nodeId}"]`
    : '[data-active-authority-search-result]';
  await expect(page.locator(hitSelector).first()).toBeVisible();
  await activateOverlayControl(page, nodeId ? hitSelector : `${hitSelector} >> nth=0`);
  const inspector = page.locator('[data-active-inspector-resources="true"]');
  await expect(inspector).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-active-inspector-loading="true"]')).toHaveCount(0, { timeout: 30_000 });
  return inspector;
}

async function login(context: BrowserContext) {
  const csrfResponse = await context.request.get(`${baseURL}/api/auth/csrf`);
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();
  const response = await context.request.post(`${baseURL}/api/auth/callback/credentials?json=true`, {
    form: {
      csrfToken: csrf.csrfToken!,
      ...verifiedAuthForm('student'),
      callbackUrl: baseURL,
      json: 'true',
    },
  });
  expect(response.ok() || (response.status() >= 300 && response.status() < 400)).toBe(true);
}

test.describe('anchored resource binding navigation', () => {
  test('handout print exposes stable heading ids', async ({ page }) => {
    const relevantErrors = collectPageErrors(page);
    const response = await page.goto(handoutPath);
    expect(response?.ok() ?? response?.status() === 304).toBeTruthy();
    const heading = page.locator('h2[id^="h"], h3[id^="h"]').first();
    await expect(heading).toBeVisible({ timeout: 20_000 });
    const headingId = await heading.getAttribute('id');
    expect(headingId).toBeTruthy();
    await page.goto(`${handoutPath}#${headingId}`);
    await expect(heading).toBeInViewport();
    expect(relevantErrors()).toEqual([]);
  });

  test('course media deep link and step query load without console errors', async ({ page }) => {
    const relevantErrors = collectPageErrors(page);
    const media = await page.goto(coursePath);
    expect(media?.ok() ?? media?.status() === 304).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('media=1-1-audio');
    expect(page.url()).toContain('t=220');

    const step = await page.goto(stepPath);
    expect(step?.ok() ?? step?.status() === 304).toBeTruthy();
    expect(page.url()).toContain('step=step-04');
    expect(relevantErrors()).toEqual([]);
  });
});

test.describe('logged-in anchored resource launches', () => {
  test.describe.configure({ timeout: 120_000 });

  test('drawer audio and handout open anchored launches', async ({ context, page }) => {
    const relevantErrors = collectPageErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(context);
    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-authority-domain-entry="time"]')).toBeVisible({ timeout: 60_000 });
    const inspector = await enterDomainAndSearch(page, 'time', '时间常数', timeConstantNodeId);

    const audio = inspector.locator('[data-active-resource-kind="音频"] button[data-active-resource-anchor]').first();
    await expect(audio).toBeVisible({ timeout: 30_000 });
    await audio.click();
    const viewer = page.locator('[data-universal-resource-viewer="true"]');
    await expect(viewer).toBeVisible();
    const audioFrame = viewer.locator('iframe');
    await expect(audioFrame).toHaveAttribute('src', /media=.+&t=\d+/);
    await viewer.getByRole('button', { name: '打开完整页' }).click();
    await expect(page).toHaveURL(/media=.+/);
    expect(page.url()).toMatch(/[?&]t=\d+/);
    const seekSurface = page.locator('[data-media-deep-link-notice="seek"], [data-media-deep-link="seek"], [data-deep-link-seeked]');
    if (await page.locator('audio, [data-media-deep-link]').count()) {
      await expect(seekSurface.first()).toBeVisible({ timeout: 20_000 });
    }

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-authority-domain-entry="time"]')).toBeVisible({ timeout: 60_000 });
    const handoutInspector = await enterDomainAndSearch(page, 'time', '时间常数', timeConstantNodeId);
    const handout = handoutInspector.locator('[data-active-resource-kind="讲义"] button[data-active-resource-anchor]').first();
    await expect(handout).toBeVisible();
    await handout.click();
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('iframe')).toHaveAttribute('src', /handout-print#/);
    await viewer.getByRole('button', { name: '打开完整页' }).click();
    await expect(page).toHaveURL(/handout-print#/);
    const headingId = decodeURIComponent(new URL(page.url()).hash.slice(1));
    expect(headingId).toBeTruthy();
    await expect(page.locator(`[id="${headingId}"]`)).toBeInViewport({ timeout: 20_000 });
    expect(relevantErrors()).toEqual([]);
  });

  test('step query lands on the requested lesson page', async ({ context, page }) => {
    const relevantErrors = collectPageErrors(page);
    await login(context);
    const response = await page.goto(stepPath, { waitUntil: 'domcontentloaded' });
    expect(response?.ok() ?? response?.status() === 304).toBeTruthy();
    await expect(page.locator('[data-lesson-runtime-page-jump]')).toHaveValue('step-04', { timeout: 20_000 });
    expect(page.url()).toContain('step=step-04');
    expect(relevantErrors()).toEqual([]);
  });

  test('handout heading deep link scrolls to the bound chapter', async ({ context, page }) => {
    const relevantErrors = collectPageErrors(page);
    await login(context);
    const response = await page.goto(`${handoutPath}#${handoutHeadingId}`, { waitUntil: 'domcontentloaded' });
    expect(response?.ok() ?? response?.status() === 304).toBeTruthy();
    await expect(page.locator('[data-handout-print-ready="true"]')).toBeVisible({ timeout: 20_000 });
    const heading = page.locator(`[id="${handoutHeadingId}"]`);
    await expect(heading).toBeVisible();
    await expect(heading).toBeInViewport({ timeout: 20_000 });
    expect(relevantErrors()).toEqual([]);
  });

  test('path node launch keeps media time anchors', async ({ context, page }) => {
    const relevantErrors = collectPageErrors(page);
    await login(context);
    await context.route('**/api/learning-paths/**/execute', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.goto(pathExecutionHref, { waitUntil: 'domcontentloaded' });
    const current = page.locator('[data-adaptive-path-node-state="current"]');
    await expect(current).toBeVisible({ timeout: 20_000 });
    await expect(current.locator('[data-adaptive-path-node-anchor]')).toHaveText('3:40–4:05');
    await current.locator('[data-adaptive-path-node-selectable="true"]').click();
    await current.getByRole('button', { name: '开始学习' }).click();
    await expect(page).toHaveURL(/media=1-1-audio/, { timeout: 20_000 });
    expect(page.url()).toMatch(/[?&]t=220/);
    expect(relevantErrors()).toEqual([]);
  });
});
