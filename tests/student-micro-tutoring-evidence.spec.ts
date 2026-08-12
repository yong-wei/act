import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';
const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/issue-1330-student-micro-tutoring-flow/playwright');
const manifestPath = join(process.cwd(), 'artifacts/commercial-ui/issue-1330-student-micro-tutoring-flow/evidence-manifest.json');
const screenshotsManifestPath = join(evidenceDir, 'screenshots.json');
const evidenceOutputPath = 'artifacts/commercial-ui/issue-1330-student-micro-tutoring-flow';
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const evidenceSourceFiles = [
  'src/app/api/assessment/remediation/interventions/validation/route.ts',
  'src/app/api/assessment/remediation/route.ts',
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/features/assessment/adaptive-engine.ts',
  'src/features/assessment/micro-intervention-outcomes.ts',
  'src/features/assessment/remediation-orchestration.ts',
  'src/features/assessment/student-micro-tutoring-panel.tsx',
  'src/features/assessment/wrong-answer-attribution.ts',
  'tests/student-micro-tutoring-evidence.spec.ts',
];
const expectedEvidenceFiles = [
  'available-full-loop-1440.png',
  'reference-drift-unavailable-1440.png',
  'reference-drift-recovered-1440.png',
  'available-full-loop-320.png',
  'reference-drift-unavailable-320.png',
  'reference-drift-recovered-320.png',
];

type SourceSnapshot = {
  revision: string;
  hashes: Record<string, string>;
};
type CapturedEvidence = {
  file: string;
  screenshotSha256: string;
  width: number;
  state: string;
  noHorizontalOverflow: boolean;
  assertions: Record<string, unknown>;
  image: Buffer;
};

const evidence: CapturedEvidence[] = [];

interface PersistedAnswerFixture {
  question: { question: { id: string; options: Array<{ label: string }> } };
  correct: { correctOption: string; durableAnswerId: string; adaptiveAssessmentRef: Record<string, string> };
  incorrect: { durableAnswerId: string; adaptiveAssessmentRef: Record<string, string> };
}

const AVAILABLE = {
  id: 'remediation-1330',
  status: 'AVAILABLE',
  task: {
    goal: '复盘相位裕度不足的证据链。',
    estimatedMinutes: 8,
    resources: [],
  },
};

const STARTED = {
  id: 'intervention-1330',
  status: 'STARTED',
  startedAt: '2026-08-10T00:00:00.000Z',
  progress: { resourceUseCount: 0, hintCount: 0, completedAt: null, durationSeconds: null },
  validation: null,
  recommendation: null,
};

function sha256(value: Buffer): string {
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
  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', '.', `:(exclude)${evidenceOutputPath}`]);
    return false;
  } catch {
    return true;
  }
}

function captureSourceSnapshot(): SourceSnapshot {
  if (hasWorkingTreeRuntimeDrift()) {
    throw new Error('Student micro-tutoring evidence capture requires clean tracked runtime inputs.');
  }
  const revision = currentHead();
  const hashes = Object.fromEntries(evidenceSourceFiles.map((file) => [file, sourceHash(file)]));
  for (const file of evidenceSourceFiles) {
    if (sourceHashAtRevision(revision, file) !== hashes[file]) {
      throw new Error(`Student micro-tutoring evidence capture source drift: ${file}`);
    }
  }
  return { revision, hashes };
}

function assertCaptureSourceSnapshot(snapshot: SourceSnapshot) {
  if (currentHead() !== snapshot.revision) {
    throw new Error('Student micro-tutoring evidence capture HEAD changed.');
  }
  if (hasWorkingTreeRuntimeDrift()) {
    throw new Error('Student micro-tutoring evidence capture tracked runtime inputs changed.');
  }
  for (const file of evidenceSourceFiles) {
    if (sourceHash(file) !== snapshot.hashes[file]) {
      throw new Error(`Student micro-tutoring evidence capture content changed: ${file}`);
    }
    if (sourceHashAtRevision(snapshot.revision, file) !== snapshot.hashes[file]) {
      throw new Error(`Student micro-tutoring evidence capture revision mismatch: ${file}`);
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
    evidence?: Array<{ file: string; screenshotSha256: string }>;
  };
  expect(manifest.commitSha).toMatch(/^[0-9a-f]{40}$/);
  expect(screenshotsManifest.gitRevision).toBe(manifest.commitSha);
  expect(hasWorkingTreeRuntimeDrift(), 'tracked runtime inputs must match HEAD').toBe(false);
  for (const file of evidenceSourceFiles) {
    expect(manifest.sourceSha256?.[file], `${file} source hash missing`).toBe(sourceHash(file));
  }
  expect(manifest.screenshots?.map((entry) => entry.file).sort()).toEqual(
    expectedEvidenceFiles.map((file) => `playwright/${file}`).sort(),
  );
  expect(screenshotsManifest.evidence?.map((entry) => entry.file).sort()).toEqual([...expectedEvidenceFiles].sort());
  for (const screenshot of manifest.screenshots ?? []) {
    const file = join(process.cwd(), 'artifacts/commercial-ui/issue-1330-student-micro-tutoring-flow', screenshot.file);
    expect(existsSync(file), screenshot.file).toBe(true);
    expect(sha256(readFileSync(file))).toBe(screenshot.sha256);
  }
}

const captureSource = updateEvidence ? captureSourceSnapshot() : null;

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.beforeEach(async ({ context }) => {
  await establishAuthenticatedSession(context);
});

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
    route: '/assessment/adaptive-practice?goal=control-correction&intent=practice',
    fixtureAuthority: 'Authenticated local demo learner with a real persisted incorrect adaptive answer. Remediation endpoints are Playwright route fixtures so each commercial state is deterministic; route and component tests cover their server contracts.',
    evidence: evidence.map(({ image: _image, ...entry }) => entry),
  }, null, 2)}\n`;
  const manifest = `${JSON.stringify({
    capturedAt,
    commitSha: captureSource!.revision,
    route: '/assessment/adaptive-practice?goal=control-correction&intent=practice',
    captureMethod: 'Playwright with Google Chrome channel against local Next.js Webpack dev server',
    fixtureAuthority: 'Authenticated local demo learner with a real persisted incorrect adaptive answer. Remediation endpoints are scoped Playwright fixtures so available, unavailable, and retry states are deterministic; route and component tests cover the server contract.',
    sourceSha256: captureSource!.hashes,
    outcomes: {
      availableFullLoop: 'The persisted wrong-answer entry creates, starts, completes, answers validation, and renders the validated recommendation.',
      governedEntry: 'Only a reviewed catalog-backed wrong answer exposes the student micro-tutoring entry.',
      referenceDrift: 'A REFERENCE_DRIFT response hides stale task details and offers an explicit fresh orchestration retry.',
      referenceDriftRecovery: 'The explicit retry creates a current task and restores the start action.',
      accessibility: 'The changed primary entry owns an explicit focus-visible ring before activation; both viewports have no horizontal overflow.',
    },
    screenshots: evidence.map(({ image: _image, file, screenshotSha256, width, state }) => ({
      file: `playwright/${file}`,
      sha256: screenshotSha256,
      viewport: `${width}x${width === 320 ? 900 : 1000}`,
      state,
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
    const temporaryScreenshotsManifest = `${screenshotsManifestPath}.${randomUUID()}.tmp`;
    writeFileSync(temporaryScreenshotsManifest, screenshotsManifest, 'utf8');
    temporaryFiles.set(screenshotsManifestPath, temporaryScreenshotsManifest);
    const temporaryManifest = `${manifestPath}.${randomUUID()}.tmp`;
    writeFileSync(temporaryManifest, manifest, 'utf8');
    temporaryFiles.set(manifestPath, temporaryManifest);
    assertCaptureSourceSnapshot(captureSource!);
    for (const [target, temporary] of temporaryFiles) renameSync(temporary, target);
    assertCaptureSourceSnapshot(captureSource!);
  } finally {
    for (const temporary of temporaryFiles.values()) {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
});

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
    data: { sessionId: `micro-tutoring-evidence-${fixtureKey}`, goalId: 'control-correction', routeIntent: 'practice' },
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
  return {
    question,
    correct: { ...correct, adaptiveAssessmentRef },
    incorrect: { ...incorrect, adaptiveAssessmentRef },
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

async function installRemediationRoutes(page: Page, mode: 'available' | 'reference-drift') {
  let createAttempts = 0;
  await page.route('**/api/assessment/remediation**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    if (pathname.endsWith('/interventions/validation') && method === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'validation-1330', prompt: '应优先检查哪一项？', options: [{ label: 'A', text: '相位裕度' }] }) });
    }
    if (pathname.endsWith('/interventions/validation') && method === 'POST') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        ...STARTED,
        status: 'VALIDATED',
        validation: { isCorrect: true, submittedAt: '2026-08-10T00:02:00.000Z' },
        recommendation: { kind: 'TRANSFER_PRACTICE_UNAVAILABLE', basisSummary: '验证通过后可继续常规练习。', actions: [] },
      }) });
    }
    if (pathname.endsWith('/interventions/events') && method === 'POST') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        ...STARTED,
        status: 'COMPLETED',
        progress: { ...STARTED.progress, completedAt: '2026-08-10T00:01:00.000Z', durationSeconds: 60 },
      }) });
    }
    if (pathname.endsWith('/interventions') && method === 'POST') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(STARTED) });
    }
    if (pathname.endsWith('/remediation') && method === 'POST') {
      createAttempts += 1;
      if (mode === 'reference-drift' && createAttempts === 1) {
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ status: 'UNAVAILABLE', unavailableReason: 'REFERENCE_DRIFT' }) });
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(AVAILABLE) });
    }
    return route.continue();
  });
  return { createAttempts: () => createAttempts };
}

async function openIncorrectAnswer(page: Page, fixture: PersistedAnswerFixture, width: number): Promise<Locator> {
  await page.setViewportSize({ width, height: width === 320 ? 900 : 1000 });
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

async function capture(page: Page, name: string, state: string, assertions: Record<string, unknown>) {
  const screenshot = await page.screenshot({ fullPage: true });
  const metrics = await page.evaluate(() => ({ viewport: window.innerWidth, bodyWidth: document.body.scrollWidth, documentWidth: document.documentElement.scrollWidth }));
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
  if (updateEvidence) {
    evidence.push({
      file: `${name}.png`,
      screenshotSha256: sha256(screenshot),
      width: metrics.viewport,
      state,
      noHorizontalOverflow: true,
      assertions,
      image: screenshot,
    });
  }
}

for (const width of [1440, 320]) {
  test(`captures available full loop with visible keyboard focus at ${width}px`, async ({ context, page }) => {
    const fixture = await createPersistedAnswerFixture(context);
    await installAssessmentFixtureRoutes(page, fixture);
    await installRemediationRoutes(page, 'available');
    const panel = await openIncorrectAnswer(page, fixture, width);
    const create = panel.getByRole('button', { name: '开始微辅导' });
    await create.focus();
    await expect(create).toBeFocused();
    await expect(create).toHaveClass(/focus-visible:ring-2/);
    await create.click();
    await panel.getByRole('button', { name: '开始本次辅导' }).click();
    await panel.getByRole('button', { name: '完成学习，进入验证' }).click();
    await panel.getByRole('button', { name: '获取验证题' }).click();
    await panel.getByRole('radio', { name: /相位裕度/ }).check();
    await panel.getByRole('button', { name: '提交验证' }).click();
    await expect(panel.getByRole('status')).toContainText('验证通过');
    await capture(page, `available-full-loop-${width}`, 'validated', { focusVisibleBeforeActivation: true, validationTerminal: 'passed' });
  });

  test(`captures reference-drift retry and recovery at ${width}px`, async ({ context, page }) => {
    const fixture = await createPersistedAnswerFixture(context);
    await installAssessmentFixtureRoutes(page, fixture);
    const retry = await installRemediationRoutes(page, 'reference-drift');
    const panel = await openIncorrectAnswer(page, fixture, width);
    await panel.getByRole('button', { name: '开始微辅导' }).click();
    await expect(panel.getByRole('status')).toContainText('任务内容已更新，请返回练习后重新开始。');
    await expect(panel.getByRole('button', { name: '重新尝试微辅导' })).toBeVisible();
    await expect(panel.getByRole('button', { name: '开始本次辅导' })).toHaveCount(0);
    await capture(page, `reference-drift-unavailable-${width}`, 'reference-drift', {
      retryAvailable: true,
      staleTaskHidden: true,
      unavailableReason: 'REFERENCE_DRIFT',
    });

    await panel.getByRole('button', { name: '重新尝试微辅导' }).click();
    await expect(panel.getByRole('button', { name: '开始本次辅导' })).toBeVisible();
    await capture(page, `reference-drift-recovered-${width}`, 'recovered', {
      createAttempts: retry.createAttempts(),
      retryAvailable: true,
      startActionRestored: true,
    });
  });
}
