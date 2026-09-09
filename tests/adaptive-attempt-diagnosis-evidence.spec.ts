import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { verifiedAuthForm } from './verified-test-credentials';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';
const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/adaptive-attempt-diagnosis-1102/playwright');
const evidence: Array<{
  name: string;
  viewport: number;
  screenshot: string;
  screenshotSha256: string;
  metrics: string;
  assertions: Record<string, unknown>;
}> = [];

interface PersistedAnswerFixture {
  question: {
    question: { id: string; options: Array<{ label: string }> };
    estimatedAbility: number;
    confidenceInterval: [number, number];
  };
  correct: Record<string, unknown> & { correctOption: string; durableAnswerId: string };
  incorrect: Record<string, unknown> & { durableAnswerId: string };
}

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.beforeEach(async ({ context }) => {
  await establishAuthenticatedSession(context);
});

test.afterAll(() => {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'screenshots.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    gitRevision: process.env.EVIDENCE_GIT_REVISION ?? 'working-tree',
    representativeRoute: '/assessment/adaptive-practice?goal=control-correction&intent=practice',
    evidenceBoundary: 'Real Next.js page, authenticated student, persisted adaptive answer, and persisted diagnosis conversation; only the first conversation failure and model stream are deterministic browser intercepts.',
    entries: evidence,
  }, null, 2));
});

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
  expect(loginResponse.ok(), `credentials login failed: ${loginResponse.status()}`).toBe(true);
}

async function createPersistedAnswerFixture(context: BrowserContext): Promise<PersistedAnswerFixture> {
  const fixtureKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const questionResponse = await context.request.post(`${baseURL}/api/assessment/next-question`, {
    data: { sessionId: `evidence-probe-${fixtureKey}`, goalId: 'control-correction', routeIntent: 'practice' },
  });
  expect(questionResponse.ok(), await questionResponse.text()).toBe(true);
  const question = await questionResponse.json() as PersistedAnswerFixture['question'];
  const firstOption = question.question.options[0]?.label;
  expect(firstOption).toBeTruthy();

  const submit = async (sessionId: string, selectedOption: string) => {
    const response = await context.request.post(`${baseURL}/api/assessment/submit-answer`, {
      data: {
        sessionId,
        questionId: question.question.id,
        selectedOption,
        timeSpent: 1,
        goalId: 'control-correction',
        routeIntent: 'practice',
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json() as Promise<Record<string, unknown> & {
      isCorrect: boolean;
      correctOption: string;
      durableAnswerId: string;
    }>;
  };

  const probe = await submit(`evidence-probe-${fixtureKey}`, firstOption!);
  const incorrectOption = question.question.options.find((option) => option.label !== probe.correctOption)?.label;
  expect(incorrectOption).toBeTruthy();
  const correct = probe.isCorrect
    ? probe
    : await submit(`evidence-correct-${fixtureKey}`, probe.correctOption);
  const incorrect = probe.isCorrect
    ? await submit(`evidence-incorrect-${fixtureKey}`, incorrectOption!)
    : probe;
  return { question, correct, incorrect };
}

async function installAssessmentFixtureRoutes(page: Page, fixture: PersistedAnswerFixture) {
  await page.route('**/api/assessment/diagnostic', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      knowledgeDimensions: { computational: 68, crossDomain: 71, design: 64 },
      weakAreas: ['controller-tuning'],
      recommendedFocus: ['继续校正设计练习'],
    }),
  }));
  await page.route('**/api/assessment/next-question', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(fixture.question),
  }));
  await page.route('**/api/assessment/submit-answer', async (route) => {
    const body = await route.request().postDataJSON() as { selectedOption?: string };
    const feedback = body.selectedOption === fixture.correct.correctOption
      ? fixture.correct
      : fixture.incorrect;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(feedback) });
  });
}

async function mockAssistantRoutes(page: Page) {
  let createCalls = 0;
  let createdConversationId: string | null = null;
  const chatBodies: unknown[] = [];

  await page.route('**/api/ai/sessions', async (route) => {
    if (route.request().method() === 'GET') return route.continue();
    createCalls += 1;
    if (createCalls === 1) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: '会话服务暂时不可用' }),
      });
    }
    const response = await route.fetch();
    const created = await response.json() as { id?: string };
    createdConversationId = created.id ?? null;
    return route.fulfill({ response });
  });
  await page.route('**/api/ai/chat', async (route) => {
    chatBodies.push(await route.request().postDataJSON());
    const body = [
      'data: {"type":"start","messageId":"assistant-1102"}',
      'data: {"type":"text-start","id":"text-1102"}',
      'data: {"type":"text-delta","id":"text-1102","delta":"已加载本题作答快照。"}',
      'data: {"type":"text-end","id":"text-1102"}',
      'data: {"type":"finish","finishReason":"stop"}',
      'data: [DONE]',
      '',
    ].join('\n\n');
    return route.fulfill({
      headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body,
    });
  });

  return {
    createCalls: () => createCalls,
    createdConversationId: () => createdConversationId,
    chatBodies,
  };
}

async function openDiagnosisQuestion(page: Page, width: number) {
  await page.setViewportSize({ width, height: width === 320 ? 800 : 900 });
  const nextQuestionResponse = page.waitForResponse((response) => (
    response.url().endsWith('/api/assessment/next-question') && response.ok()
  ));
  await page.goto('/assessment/adaptive-practice?goal=control-correction&intent=practice', { waitUntil: 'domcontentloaded' });
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
  if (await expandQuestion.isVisible()) {
    await expandQuestion.click({ noWaitAfter: true });
  }
  await expect(resourceModule.getByRole('radio').first()).toBeVisible();
  return resourceModule;
}

async function submitAnswer(page: Page, resourceModule: Locator, label: string) {
  await resourceModule.getByRole('radio', { name: new RegExp(`^${label}\\.`) }).check();
  const responsePromise = page.waitForResponse((response) => (
    response.url().endsWith('/api/assessment/submit-answer') && response.request().method() === 'POST'
  ));
  await resourceModule.getByRole('button', { name: '提交答案' }).click();
  const response = await responsePromise;
  const body = await response.json() as {
    isCorrect: boolean;
    correctOption: string;
    durableAnswerId: string;
  };
  expect(response.ok(), JSON.stringify(body)).toBe(true);
  expect(body.durableAnswerId).toBeTruthy();
  return body;
}

async function capture(page: Page, name: string, assertions: Record<string, unknown>) {
  mkdirSync(evidenceDir, { recursive: true });
  const screenshot = join(evidenceDir, `${name}.png`);
  const metricsPath = join(evidenceDir, `${name}-metrics.json`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
  evidence.push({
    name,
    viewport: metrics.viewport,
    screenshot: `${name}.png`,
    screenshotSha256: createHash('sha256').update(readFileSync(screenshot)).digest('hex'),
    metrics: `${name}-metrics.json`,
    assertions,
  });
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
}

for (const width of [320, 1440]) {
  test(`correct and incorrect diagnosis actions preserve hierarchy at ${width}px`, async ({ context, page }) => {
    const fixture = await createPersistedAnswerFixture(context);
    await installAssessmentFixtureRoutes(page, fixture);
    const resourceModule = await openDiagnosisQuestion(page, width);
    await submitAnswer(page, resourceModule, fixture.correct.correctOption);
    const diagnosis = resourceModule.getByRole('button', { name: '请控灵解析本题' });

    await expect(resourceModule.getByText('回答正确')).toBeVisible();
    await expect(diagnosis).toHaveClass(/border-border/);
    await expect(diagnosis).not.toHaveClass(/bg-primary/);
    await capture(page, `correct-secondary-${width}`, { answerPersisted: true, hierarchy: 'secondary' });

    const incorrectOption = fixture.question.question.options
      .find((option) => option.label !== fixture.correct.correctOption)!.label;
    const incorrectResult = await submitAnswer(page, resourceModule, incorrectOption);
    expect(incorrectResult.isCorrect).toBe(false);
    await expect(resourceModule.getByText('需要复盘')).toBeVisible();
    await expect(diagnosis).toHaveClass(/bg-primary/);
    await capture(page, `incorrect-primary-${width}`, { answerPersisted: true, hierarchy: 'primary' });
  });
}

test('diagnosis conversation retries after failure and sends isolated context without removing path advising', async ({ context, page }) => {
  const fixture = await createPersistedAnswerFixture(context);
  await installAssessmentFixtureRoutes(page, fixture);
  const assistant = await mockAssistantRoutes(page);
  const resourceModule = await openDiagnosisQuestion(page, 1440);
  const persistedAnswer = await submitAnswer(page, resourceModule, fixture.correct.correctOption);
  const diagnosis = resourceModule.getByRole('button', { name: '请控灵解析本题' });

  await diagnosis.click();
  await expect(resourceModule.getByRole('alert')).toHaveText('解析请求失败，请重试');
  await capture(page, 'retryable-error-1440', { firstCreateStatus: 503, retryAvailable: true });

  await diagnosis.click();
  await expect.poll(assistant.createCalls).toBe(2);
  await expect.poll(assistant.createdConversationId).not.toBeNull();
  await expect.poll(() => assistant.chatBodies.length).toBe(1);
  expect(assistant.chatBodies[0]).toMatchObject({
    conversationId: assistant.createdConversationId(),
    teachingAssistantModeId: 'diagnosis-explainer',
    modeClientContextHints: { answerId: persistedAnswer.durableAnswerId },
  });

  await page.goto('/assessment/adaptive-practice?goal=control-correction&intent=path-generation', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-adaptive-path-generation-action]').first()).toBeVisible();
  await capture(page, 'path-advisor-entry-1440', {
    persistedAnswerId: persistedAnswer.durableAnswerId,
    persistedConversationId: assistant.createdConversationId(),
    initialDiagnosisRequestSent: true,
    pathAdvisorAvailable: true,
  });
});
