import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002';
const evidenceDir = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-1140-pr-a');
const manifestPath = path.join(evidenceDir, 'lifecycle-manifest.json');
const sourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/components/ai/global-ai-sidebar.tsx',
  'src/lib/path-generation-request-lifecycle.ts',
  'tests/adaptive-path-one-click-generation.spec.ts',
];
const expectedScreenshotFiles = [
  'lifecycle-success-desktop-1440.png',
  'lifecycle-success-mobile-320.png',
].map((filename) => path.posix.join('artifacts/commercial-ui/issue-1140-pr-a', filename));
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const screenshots: Array<Record<string, unknown>> = [];
const requestObservations: Array<Record<string, unknown>> = [];

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHashAtCommit(commitSha: string, file: string): string {
  return sha256(execFileSync('git', ['show', `${commitSha}:${file}`]));
}

function hasWorkingTreeSourceDrift(): boolean {
  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...sourceFiles]);
    return false;
  } catch {
    return true;
  }
}

async function login(context: BrowserContext) {
  const csrfResponse = await context.request.get(`${baseURL}/api/auth/csrf`);
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();
  const response = await context.request.post(`${baseURL}/api/auth/callback/credentials?json=true`, {
    form: {
      csrfToken: csrf.csrfToken!,
      email: 'demo',
      password: 'DemoStudent@Just2026!',
      callbackUrl: baseURL,
      json: 'true',
    },
  });
  expect(response.ok() || (response.status() >= 300 && response.status() < 400), await response.text()).toBe(true);
}

const learnerStateFixture = {
  userId: 'demo-student',
  payloadVersion: 'adaptive-learner-state.v1',
  generatedAt: '2026-08-01T00:00:00.000Z',
  authority: 'server-owned',
  roleScope: { role: 'student', classId: 'class-1140', privacyScopes: ['student-visible'] },
  clientHints: { received: false, authoritative: false, reason: 'client-hints-non-authoritative' },
  primaryCompetencies: { authority: 'legacy-compatibility-only', source: 'fallback-empty', vector: {} },
  secondaryDimensions: {},
  knowledgeMastery: { coverage: 'missing', tags: {} },
  pathContext: {
    activePathCount: 0,
    bookmarkedPathCount: 0,
    recentPathIds: [],
    activeControlCorrectionPath: {
      state: 'none',
      pathId: null,
      status: null,
      currentNodeId: null,
      terminalValidationState: null,
      lowConfidenceMarkers: [],
    },
    statusMarkers: ['missing'],
  },
  assessmentState: { latestAbilityEstimate: null },
  evidence: {
    readState: 'ready',
    evidenceWindow: { firstStartedAt: null, lastStartedAt: null, daysCovered: 0 },
    sourceCounts: {},
    sourceCoverage: {},
    confidence: { level: 'none', score: 0, evidenceCount: 0, sourceCompleteness: 0 },
    statusMarkers: [],
  },
  missingEvidence: [],
};

const generatedPathId = 'path-issue-1140';
const generatedLearnerStateFixture = {
  ...learnerStateFixture,
  pathContext: {
    ...learnerStateFixture.pathContext,
    activePathCount: 1,
    recentPathIds: [generatedPathId],
    activeControlCorrectionPath: {
      ...learnerStateFixture.pathContext.activeControlCorrectionPath,
      state: 'active',
      pathId: generatedPathId,
      status: 'active',
      currentNodeId: 'node-issue-1140',
    },
    statusMarkers: ['available'],
  },
};

const generatedPathFixture = {
  path: {
    id: generatedPathId,
    userId: 'demo-student',
    title: 'Issue 1140 generated path',
    goalId: 'control-correction',
    plannerVersion: 'e2e-governed-fixture',
    pathStatus: 'active',
    currentNodeId: 'node-issue-1140',
    pathPayload: {
      policyFamily: 'rules-plus-graph-search',
      confidence: { level: 'medium', score: 0.8, sourceCoverage: 0.8 },
      score: { total: 0.8, objectives: {} },
      planNodes: [{
        nodeId: 'node-issue-1140',
        title: 'Phase margin correction',
        type: 'knowledge_card',
        sourceKind: 'resource_node',
        sourceRef: 'phase-margin-correction-card',
        target: 'course-content/runtime/knowledge/cards/nodes/phase-margin-correction.md',
        estimatedTimeMinutes: 20,
        prerequisiteNodeIds: [],
        knowledgeCoverage: ['control-correction:phase-margin'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: [],
        score: 0.8,
        reasonCodes: ['governed-e2e-fixture'],
        status: 'current',
      }],
      explanations: { selectedReasons: ['governed-e2e-fixture'], rejectedAlternatives: [], fallbackReasons: [] },
      executionStatus: {
        adopted: true,
        completedNodeIds: [],
        activeNodeId: 'node-issue-1140',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      deviations: [],
      corrections: [],
      feedbackEvents: [],
    },
    explanationPayload: {
      selectedReasons: ['governed-e2e-fixture'],
      rejectedAlternatives: [],
      fallbackReasons: [],
    },
    alternativePayload: [],
  },
};

async function capture(page: Page, viewport: { name: string; width: number; height: number }) {
  if (!updateEvidence) return;
  mkdirSync(evidenceDir, { recursive: true });
  const filename = `lifecycle-success-${viewport.name}.png`;
  const file = path.join(evidenceDir, filename);
  const image = await page.screenshot({ path: file, fullPage: true });
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBe(geometry.clientWidth);
  screenshots.push({
    file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
    sha256: sha256(image),
    width: viewport.width,
    height: viewport.height,
    state: 'succeeded-with-konling-visible',
    noHorizontalOverflow: true,
  });
}

test.describe.configure({ mode: 'serial' });

test('lifecycle evidence stays bound to its committed sources and screenshots', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    commitSha?: string;
    sourceSha256?: Record<string, string>;
    screenshots?: Array<{ file: string; sha256: string; noHorizontalOverflow?: boolean }>;
    requestObservations?: Array<{ requestIds?: string[] }>;
  };
  expect(manifest.commitSha).toMatch(/^[0-9a-f]{40}$/);
  expect(hasWorkingTreeSourceDrift(), 'tracked evidence sources must match HEAD').toBe(false);
  for (const file of sourceFiles) {
    const expectedHash = manifest.sourceSha256?.[file];
    expect(expectedHash, `${file} source hash missing or stale`).toBe(sourceHashAtCommit(manifest.commitSha!, file));
    expect(sourceHashAtCommit('HEAD', file), `${file} changed after evidence capture`).toBe(expectedHash);
  }
  expect(manifest.requestObservations).toHaveLength(2);
  for (const observation of manifest.requestObservations ?? []) {
    expect(observation.requestIds).toHaveLength(4);
  }
  const manifestScreenshots = manifest.screenshots ?? [];
  expect(manifestScreenshots.map((item) => item.file).sort()).toEqual([...expectedScreenshotFiles].sort());
  for (const screenshot of manifestScreenshots) {
    const screenshotPath = path.resolve(process.cwd(), screenshot.file);
    expect(existsSync(screenshotPath), screenshot.file).toBe(true);
    expect(sha256(readFileSync(screenshotPath))).toBe(screenshot.sha256);
    expect(screenshot.noHorizontalOverflow).toBe(true);
  }
});

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const) {
  test(`${viewport.name} closes the one-click generation lifecycle`, async ({ context, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(context);

    let generationSucceeded = false;
    let learnerStateCalls = 0;
    let pathRefreshCalls = 0;
    let releaseLostResponse!: () => void;
    const lostResponseGate = new Promise<void>((resolve) => { releaseLostResponse = resolve; });
    const requestIds: string[] = [];

    await page.route('**/api/adaptive/path-advisor-context**', async (route: Route) => {
      await route.fulfill({
        json: {
          goalId: 'control-correction',
          classId: 'class-1140',
          courseTitle: 'Control correction',
          topic: 'Phase margin',
          learningObjectives: ['Close the governed generation lifecycle'],
          modeContextToken: 'governed-e2e-mode-token',
          readiness: { status: 'ready', reason: 'ready', source: 'path-advisor', studentAction: 'generate', studentMessage: 'Ready' },
        },
      });
    });
    await page.route('**/api/adaptive/learner-state**', async (route: Route) => {
      learnerStateCalls += 1;
      await route.fulfill({ json: generationSucceeded ? generatedLearnerStateFixture : learnerStateFixture });
    });
    await page.route('**/api/learning-paths?**', async (route: Route) => {
      pathRefreshCalls += 1;
      await route.fulfill({ json: generationSucceeded ? generatedPathFixture : { path: null } });
    });
    await page.route(`**/api/learning-paths/${generatedPathId}`, async (route: Route) => {
      pathRefreshCalls += 1;
      await route.fulfill({ json: generatedPathFixture });
    });
    await page.route('**/api/adaptive/path-advisor-tool', async (route: Route) => {
      const body = route.request().postDataJSON() as { generationRequestId?: string };
      expect(body.generationRequestId).toMatch(/^[0-9a-f-]{36}$/);
      requestIds.push(body.generationRequestId!);
      if (requestIds.length === 1) {
        await lostResponseGate;
        await route.abort('connectionreset');
        return;
      }
      if (requestIds.length === 2) {
        await route.fulfill({
          json: { generationRequest: { id: body.generationRequestId, status: 'running' } },
        });
        return;
      }
      if (requestIds.length === 3) {
        await route.fulfill({
          status: 409,
          json: {
            error: 'Governed generation failed definitively',
            generationRequest: { id: body.generationRequestId, status: 'failed' },
          },
        });
        return;
      }
      generationSucceeded = true;
      await route.fulfill({
        json: {
          agentSessionId: 'agent-session-1140',
          generationRequest: { id: body.generationRequestId, status: 'succeeded' },
          result: { generationStatus: 'succeeded' },
        },
      });
    });

    await page.goto('/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation', {
      waitUntil: 'domcontentloaded',
    });
    const primaryAction = page.locator('[data-adaptive-path-generation-action="open-in-page-path-advisor"]');
    const panel = page.locator('[data-adaptive-path-generation-panel="editable"]');
    const targetControl = panel.locator('select').first();
    const sidebar = page.locator('[data-global-ai-sidebar="open"]');
    await expect(primaryAction).toBeEnabled();
    await expect(panel).toHaveAttribute('data-adaptive-generation-readiness-status', 'ready');

    await primaryAction.evaluate((element) => {
      (element as HTMLButtonElement).click();
      (element as HTMLButtonElement).click();
    });
    await expect.poll(() => requestIds.length).toBe(1);
    await expect(sidebar).toBeVisible();
    await expect(targetControl).toBeDisabled();
    await expect(sidebar.getByText('已接收路径生成请求，正在准备生成。', { exact: true })).toBeVisible();
    releaseLostResponse();
    await expect(primaryAction).toBeEnabled();

    await sidebar.getByRole('button', { name: '关闭 AI 侧栏' }).click();
    await primaryAction.click();
    await expect.poll(() => requestIds.length).toBe(2);
    expect(requestIds[1]).toBe(requestIds[0]);
    await expect(targetControl).toBeDisabled();
    await expect(sidebar.getByText('生成仍在进行中，稍后可再次查看结果。', { exact: true })).toBeVisible();

    await sidebar.getByRole('button', { name: '关闭 AI 侧栏' }).click();
    await primaryAction.click();
    await expect.poll(() => requestIds.length).toBe(3);
    expect(requestIds[2]).toBe(requestIds[0]);
    await expect(sidebar.getByText('Governed generation failed definitively', { exact: true })).toBeVisible();
    await expect(targetControl).toBeEnabled();

    const learnerCallsBeforeSuccess = learnerStateCalls;
    const pathRefreshCallsBeforeSuccess = pathRefreshCalls;
    await sidebar.getByRole('button', { name: '关闭 AI 侧栏' }).click();
    await primaryAction.click();
    await expect.poll(() => requestIds.length).toBe(4);
    expect(requestIds[3]).not.toBe(requestIds[0]);
    await expect(sidebar.getByText('学习路径已生成，请比较候选方案。', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/assessment\/adaptive-practice/);
    await expect.poll(() => learnerStateCalls).toBeGreaterThan(learnerCallsBeforeSuccess);
    await expect.poll(() => pathRefreshCalls).toBeGreaterThan(pathRefreshCallsBeforeSuccess);
    await expect(page.getByText('学习路径已生成，请选择一个方案开始执行。', { exact: true })).toBeVisible();
    await capture(page, viewport);

    requestObservations.push({
      viewport: viewport.name,
      requestCount: requestIds.length,
      requestIds,
      duplicateActivationCount: 1,
      unknownOutcomeReusedId: requestIds[1] === requestIds[0],
      runningRetryReusedId: requestIds[2] === requestIds[0],
      definitiveTerminalCreatedNewId: requestIds[3] !== requestIds[0],
      lifecycleStatusesObserved: ['pending', 'failed-unknown', 'running', 'failed-definitive', 'succeeded'],
      learnerStateRefreshesAfterSuccess: learnerStateCalls - learnerCallsBeforeSuccess,
      pathRefreshesAfterSuccess: pathRefreshCalls - pathRefreshCallsBeforeSuccess,
    });
  });
}

test.afterAll(() => {
  if (!updateEvidence) return;
  expect(requestObservations).toHaveLength(2);
  expect(screenshots).toHaveLength(2);
  mkdirSync(evidenceDir, { recursive: true });
  const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(manifestPath, `${JSON.stringify({
    capturedAt: new Date().toISOString(),
    commitSha,
    route: '/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation',
    fixtureAuthority: 'Playwright route fixtures scoped to the authenticated demo learner and control-correction goal',
    sourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, sourceHashAtCommit(commitSha, file)])),
    requestObservations,
    screenshots,
  }, null, 2)}\n`, 'utf8');
});
