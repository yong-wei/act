import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

const evidenceRoot = 'artifacts/commercial-ui/issue-1366-micro-tutoring-navigation';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';
const evidenceDir = join(process.cwd(), evidenceRoot, 'playwright');
const manifestPath = join(process.cwd(), evidenceRoot, 'evidence-manifest.json');
const screenshotsManifestPath = join(evidenceDir, 'screenshots.json');
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const;
const themes = ['light', 'dark'] as const;
const expectedEvidenceFiles = viewports.flatMap((viewport) => themes.flatMap((theme) => [
  `student-home-${theme}-${viewport.name}.png`,
  `adaptive-practice-${theme}-${viewport.name}.png`,
]));
const sourceFiles = [
  'src/app/layout.tsx',
  'src/app/(main)/profile/page.tsx',
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/components/providers/theme-provider.tsx',
  'src/features/assessment/micro-intervention-outcomes.ts',
  'src/features/assessment/remediation-orchestration.ts',
  'src/features/assessment/student-micro-tutoring-panel.tsx',
  'src/lib/theme-config.ts',
  'tests/micro-tutoring-navigation-commercial-ui.spec.ts',
] as const;

type Theme = typeof themes[number];
type SourceSnapshot = { revision: string; hashes: Record<string, string> };
type MicroTutoringProjection = {
  stage: string;
  qualified: boolean;
  unavailableReason: string | null;
  retryAttribution: boolean;
};
type PersistedAnswerFixture = {
  question: { question: { id: string; options: Array<{ label: string }> }; assessmentStage?: string };
  correct: {
    correctOption: string;
    durableAnswerId: string;
    adaptiveAssessmentRef: Record<string, string>;
    microTutoring?: MicroTutoringProjection;
  };
  incorrect: {
    durableAnswerId: string;
    adaptiveAssessmentRef: Record<string, string>;
    microTutoring?: MicroTutoringProjection;
  };
};
type CapturedEvidence = {
  file: string;
  route: string;
  theme: Theme;
  viewport: string;
  width: number;
  height: number;
  sha256: string;
  noHorizontalOverflow: boolean;
  clientNavigation: boolean;
  noReactScriptTagConsoleError: boolean;
  image: Buffer;
};

const evidence: CapturedEvidence[] = [];
const captureSource = updateEvidence ? captureSourceSnapshot() : null;

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function currentHead(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function sourceHash(file: string): string {
  return sha256(readFileSync(join(process.cwd(), file)));
}

function sourceHashAtRevision(revision: string, file: string): string {
  return sha256(execFileSync('git', ['show', `${revision}:${file}`]));
}

function hasWorkingTreeRuntimeDrift(): boolean {
  const changes = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    encoding: 'utf8',
  }).split('\n').filter(Boolean);
  return changes.some((change) => {
    const file = change.slice(3).replace(/^.* -> /, '');
    return file !== evidenceRoot && !file.startsWith(`${evidenceRoot}/`);
  });
}

function captureSourceSnapshot(): SourceSnapshot {
  if (hasWorkingTreeRuntimeDrift()) {
    throw new Error('Micro-tutoring navigation evidence capture requires clean tracked runtime inputs.');
  }
  const revision = currentHead();
  const hashes = Object.fromEntries(sourceFiles.map((file) => [file, sourceHash(file)]));
  for (const file of sourceFiles) {
    if (sourceHashAtRevision(revision, file) !== hashes[file]) {
      throw new Error(`Micro-tutoring navigation evidence capture source drift: ${file}`);
    }
  }
  return { revision, hashes };
}

function assertCaptureSourceSnapshot(snapshot: SourceSnapshot) {
  if (currentHead() !== snapshot.revision) {
    throw new Error('Micro-tutoring navigation evidence capture HEAD changed.');
  }
  if (hasWorkingTreeRuntimeDrift()) {
    throw new Error('Micro-tutoring navigation evidence capture tracked runtime inputs changed.');
  }
  for (const file of sourceFiles) {
    if (sourceHash(file) !== snapshot.hashes[file]) {
      throw new Error(`Micro-tutoring navigation evidence capture content changed: ${file}`);
    }
    if (sourceHashAtRevision(snapshot.revision, file) !== snapshot.hashes[file]) {
      throw new Error(`Micro-tutoring navigation evidence capture revision mismatch: ${file}`);
    }
  }
}

function validatePersistedEvidence() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    commitSha?: string;
    sourceSha256?: Record<string, string>;
    screenshots?: Array<{ file: string; sha256: string }>;
  };
  const screenshotsManifest = JSON.parse(readFileSync(screenshotsManifestPath, 'utf8')) as {
    gitRevision?: string;
    evidence?: Array<{ file: string; sha256: string }>;
  };
  expect(manifest.commitSha).toMatch(/^[0-9a-f]{40}$/);
  expect(screenshotsManifest.gitRevision).toBe(manifest.commitSha);
  expect(hasWorkingTreeRuntimeDrift(), 'tracked runtime inputs must match HEAD').toBe(false);
  for (const file of sourceFiles) {
    expect(manifest.sourceSha256?.[file], `${file} source hash missing`).toBe(sourceHash(file));
  }
  expect(manifest.screenshots?.map((entry) => entry.file).sort()).toEqual(
    expectedEvidenceFiles.map((file) => `playwright/${file}`).sort(),
  );
  expect(screenshotsManifest.evidence?.map((entry) => entry.file).sort()).toEqual([...expectedEvidenceFiles].sort());
  for (const screenshot of manifest.screenshots ?? []) {
    const file = join(process.cwd(), evidenceRoot, screenshot.file);
    expect(existsSync(file), screenshot.file).toBe(true);
    expect(sha256(readFileSync(file))).toBe(screenshot.sha256);
  }
}

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
  expect(loginResponse.ok(), `credentials login failed: ${loginResponse.status()}`).toBe(true);
}

async function createPersistedAnswerFixture(context: BrowserContext): Promise<PersistedAnswerFixture> {
  const fixtureKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const questionResponse = await context.request.post(`${baseURL}/api/assessment/next-question`, {
    data: { sessionId: `micro-tutoring-navigation-${fixtureKey}`, goalId: 'control-correction', routeIntent: 'practice' },
  });
  expect(questionResponse.ok(), await questionResponse.text()).toBe(true);
  const question = await questionResponse.json() as PersistedAnswerFixture['question'];
  const firstOption = question.question.options[0]?.label;
  expect(firstOption).toBeTruthy();

  const submit = async (sessionId: string, selectedOption: string) => {
    const response = await context.request.post(`${baseURL}/api/assessment/submit-answer`, {
      data: { sessionId, questionId: question.question.id, selectedOption, timeSpent: 1, goalId: 'control-correction', routeIntent: 'practice' },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json() as Promise<{ isCorrect: boolean; correctOption: string; durableAnswerId: string }>;
  };

  const first = await submit(`micro-tutoring-probe-${fixtureKey}`, firstOption!);
  const incorrectOption = question.question.options.find((option) => option.label !== first.correctOption)?.label;
  expect(incorrectOption).toBeTruthy();
  const correct = first.isCorrect ? first : await submit(`micro-tutoring-correct-${fixtureKey}`, first.correctOption);
  const incorrect = first.isCorrect ? await submit(`micro-tutoring-incorrect-${fixtureKey}`, incorrectOption!) : first;
  const adaptiveAssessmentRef = {
    catalogItemId: 'adaptive-assessment-item:fixture:governed-wrong-answer',
    reviewState: 'reviewed',
  };
  const questionWithStage = {
    ...question,
    assessmentStage: 'practice' as const,
  };
  return {
    question: questionWithStage,
    correct: {
      ...correct,
      adaptiveAssessmentRef,
      microTutoring: {
        stage: 'practice',
        qualified: false,
        unavailableReason: null,
        retryAttribution: false,
      },
    },
    incorrect: {
      ...incorrect,
      adaptiveAssessmentRef,
      microTutoring: {
        stage: 'practice',
        qualified: true,
        unavailableReason: null,
        retryAttribution: false,
      },
    },
  };
}

async function installAssessmentFixtureRoutes(page: Page, fixture: PersistedAnswerFixture) {
  await page.route('**/api/assessment/diagnostic', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ knowledgeDimensions: { computational: 68 }, weakAreas: ['controller-tuning'], recommendedFocus: ['继续校正设计练习'] }),
  }));
  await page.route('**/api/assessment/next-question', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture.question) }));
  await page.route('**/api/assessment/submit-answer', async (route) => {
    const body = await route.request().postDataJSON() as { selectedOption?: string };
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(body.selectedOption === fixture.correct.correctOption ? fixture.correct : fixture.incorrect),
    });
  });
}

async function openIncorrectAnswer(page: Page, fixture: PersistedAnswerFixture): Promise<Locator> {
  const nextQuestionResponse = page.waitForResponse((response) => (
    response.url().endsWith('/api/assessment/next-question') && response.ok()
  ));
  await page.goto('/assessment/adaptive-practice?goal=control-correction&intent=practice', { waitUntil: 'domcontentloaded' });
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
  expect(wrongOption).toBeTruthy();
  await resourceModule.getByRole('radio', { name: new RegExp(`^${wrongOption}\\.`) }).check();
  await resourceModule.getByRole('button', { name: '提交答案' }).click();
  const panel = page.locator('[data-student-micro-tutoring="panel"]');
  await expect(panel).toBeVisible();
  await panel.scrollIntoViewIfNeeded();
  return panel;
}

async function assertTheme(page: Page, theme: Theme) {
  await expect(page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));
  await expect.poll(() => page.evaluate(() => document.documentElement.style.colorScheme)).toBe(theme);
}

async function capture(
  page: Page,
  file: string,
  route: string,
  theme: Theme,
  viewport: typeof viewports[number],
  consoleErrors: string[],
  clientNavigation: boolean,
) {
  const screenshot = await page.screenshot({ fullPage: true });
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  const scriptTagErrors = consoleErrors.filter((message) => (
    /Encountered a script tag while rendering React component/i.test(message)
  ));
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
  expect(scriptTagErrors).toEqual([]);
  if (updateEvidence) {
    evidence.push({
      file,
      route,
      theme,
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      sha256: sha256(screenshot),
      noHorizontalOverflow: true,
      clientNavigation,
      noReactScriptTagConsoleError: true,
      image: screenshot,
    });
  }
}

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.afterAll(() => {
  if (!updateEvidence) {
    validatePersistedEvidence();
    return;
  }
  expect(captureSource).not.toBeNull();
  expect(evidence).toHaveLength(expectedEvidenceFiles.length);
  assertCaptureSourceSnapshot(captureSource!);
  mkdirSync(evidenceDir, { recursive: true });
  const capturedAt = new Date().toISOString();
  const screenshotsManifest = `${JSON.stringify({
    capturedAt,
    gitRevision: captureSource!.revision,
    evidence: evidence.map(({ image: _image, ...entry }) => entry),
  }, null, 2)}\n`;
  const manifest = `${JSON.stringify({
    schemaVersion: 'commercial-ui-evidence.v1',
    capturedAt,
    commitSha: captureSource!.revision,
    captureMethod: 'Playwright with Google Chrome channel against local Next.js Webpack dev server',
    sourceSha256: captureSource!.hashes,
    routes: [
      { route: '/profile', purpose: 'Student shell entry and client-side practice navigation' },
      { route: '/assessment/adaptive-practice?intent=practice', purpose: 'Adaptive practice and micro-tutoring entry surface' },
    ],
    assertions: {
      initialThemeAndClientNavigationRemainConsistent: true,
      reactScriptTagConsoleErrorAbsent: true,
      noHorizontalOverflow: true,
    },
    screenshots: evidence.map(({ image: _image, file, sha256: hash, route, theme, viewport, width, height, clientNavigation }) => ({
      file: `playwright/${file}`,
      sha256: hash,
      route,
      theme,
      viewport,
      width,
      height,
      clientNavigation,
    })),
  }, null, 2)}\n`;
  const temporaryFiles = new Map<string, string>();
  try {
    for (const entry of evidence) {
      const target = join(evidenceDir, entry.file);
      const temporary = `${target}.${randomUUID()}.tmp`;
      writeFileSync(temporary, entry.image);
      temporaryFiles.set(target, temporary);
    }
    const screenshotsTemporary = `${screenshotsManifestPath}.${randomUUID()}.tmp`;
    writeFileSync(screenshotsTemporary, screenshotsManifest, 'utf8');
    temporaryFiles.set(screenshotsManifestPath, screenshotsTemporary);
    const manifestTemporary = `${manifestPath}.${randomUUID()}.tmp`;
    writeFileSync(manifestTemporary, manifest, 'utf8');
    temporaryFiles.set(manifestPath, manifestTemporary);
    assertCaptureSourceSnapshot(captureSource!);
    for (const [target, temporary] of temporaryFiles) renameSync(temporary, target);
    assertCaptureSourceSnapshot(captureSource!);
  } finally {
    for (const temporary of temporaryFiles.values()) {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
});

for (const viewport of viewports) {
  for (const theme of themes) {
    test(`captures ${theme} ${viewport.name} student entry and client navigation`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      await page.addInitScript(({ storedTheme }) => {
        localStorage.setItem('ai-obe-theme', storedTheme);
      }, { storedTheme: theme });
      await establishAuthenticatedSession(context);

      await page.goto('/profile', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('link', { name: '执行下一步练习' })).toBeVisible();
      await assertTheme(page, theme);
      await capture(
        page,
        `student-home-${theme}-${viewport.name}.png`,
        '/profile',
        theme,
        viewport,
        consoleErrors,
        false,
      );

      await page.getByRole('link', { name: '执行下一步练习' }).click();
      await expect(page).toHaveURL(/\/assessment\/adaptive-practice/);
      await expect(page.locator('[data-commercial-student-entry-route="/assessment/adaptive-practice"]')).toBeVisible();
      await assertTheme(page, theme);
      await capture(
        page,
        `adaptive-practice-${theme}-${viewport.name}.png`,
        '/assessment/adaptive-practice?intent=practice',
        theme,
        viewport,
        consoleErrors,
        true,
      );
      await context.close();
    });
  }
}

test('opens the practice workspace from the micro-tutoring fallback link', async ({ context, page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await establishAuthenticatedSession(context);
  const fixture = await createPersistedAnswerFixture(context);
  await installAssessmentFixtureRoutes(page, fixture);
  await page.route('**/api/assessment/remediation', (route) => route.fulfill({
    status: 409,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'UNAVAILABLE',
      unavailableReason: 'ATTRIBUTION_UNAVAILABLE',
      manualPracticePath: '/assessment/adaptive-practice?intent=practice',
    }),
  }));

  const panel = await openIncorrectAnswer(page, fixture);
  await panel.getByRole('button', { name: '开始微辅导' }).click();
  const fallbackLink = panel.getByRole('link', { name: '进入常规练习' });
  await expect(fallbackLink).toHaveAttribute('href', '/assessment/adaptive-practice?intent=practice');
  await Promise.all([
    page.waitForURL(/\/assessment\/adaptive-practice\?intent=practice$/),
    fallbackLink.click(),
  ]);
  await expect(page.locator('[data-adaptive-practice-resource="path-node"]')).toBeVisible();
  expect(consoleErrors.filter((message) => /Encountered a script tag while rendering React component/i.test(message))).toEqual([]);
});
