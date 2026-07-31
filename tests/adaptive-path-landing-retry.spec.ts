import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002';
const evidenceDir = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-1141-adaptive-path-landing');
const manifestPath = path.join(evidenceDir, 'manifest.json');
const sourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/lib/adaptive-path-execution-state.ts',
  'tests/adaptive-path-landing-retry.spec.ts',
];
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const screenshots: Array<Record<string, unknown>> = [];
const assertions: Array<Record<string, unknown>> = [];

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

const learnerStateFixture = JSON.stringify({
  userId: 'demo-student',
  payloadVersion: 'adaptive-learner-state.v1',
  generatedAt: '2026-07-31T00:00:00.000Z',
  authority: 'server-owned',
  roleScope: {
    role: 'student',
    classId: null,
    privacyScopes: ['student-visible'],
  },
  clientHints: {
    received: false,
    authoritative: false,
    reason: 'client-hints-non-authoritative',
  },
  primaryCompetencies: {
    authority: 'legacy-compatibility-only',
    source: 'fallback-empty',
    vector: {},
  },
  secondaryDimensions: {},
  knowledgeMastery: {
    coverage: 'missing',
    tags: {},
  },
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
  assessmentState: {
    latestAbilityEstimate: null,
  },
  evidence: {
    readState: 'ready',
    evidenceWindow: {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    },
    sourceCounts: {},
    sourceCoverage: {},
    confidence: {
      level: 'none',
      score: 0,
      evidenceCount: 0,
      sourceCompleteness: 0,
    },
    statusMarkers: [],
  },
  missingEvidence: [],
});

const activePathId = 'path-active-1141';
const activeNodeTitle = '相位裕度校正基础';
const activeLearnerStateFixture = JSON.stringify({
  ...JSON.parse(learnerStateFixture),
  pathContext: {
    activePathCount: 1,
    bookmarkedPathCount: 0,
    recentPathIds: [activePathId],
    activeControlCorrectionPath: {
      state: 'active',
      pathId: activePathId,
      status: 'active',
      currentNodeId: 'node-active-1',
      terminalValidationState: null,
      lowConfidenceMarkers: [],
    },
    statusMarkers: ['available'],
  },
});
const activePathFixture = JSON.stringify({
  path: {
    id: activePathId,
    userId: 'demo-student',
    title: '控制系统校正学习路径',
    goalId: 'control-correction',
    plannerVersion: 'stage-1-rules-graph',
    pathStatus: 'active',
    currentNodeId: 'node-active-1',
    pathPayload: {
      policyFamily: 'rules-plus-graph-search',
      confidence: { level: 'medium', score: 0.78, sourceCoverage: 0.8 },
      score: { total: 0.82, objectives: {} },
      planNodes: [{
        nodeId: 'node-active-1',
        title: activeNodeTitle,
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
        score: 0.82,
        reasonCodes: ['active-path-evidence'],
        status: 'current',
      }],
      explanations: {
        selectedReasons: ['active-path-evidence'],
        rejectedAlternatives: [],
        fallbackReasons: [],
      },
      executionStatus: {
        adopted: true,
        completedNodeIds: [],
        activeNodeId: 'node-active-1',
        updatedAt: '2026-07-31T00:00:00.000Z',
      },
      deviations: [],
      corrections: [],
      feedbackEvents: [],
      visualization: {
        map: {
          mainPathNodeIds: ['node-active-1'],
          branchPaths: [],
          currentNodeId: 'node-active-1',
          completedNodeIds: [],
          riskNodeIds: [],
          blockedNodes: [],
          alternatives: [],
        },
        timeline: {
          generatedAt: '2026-07-31T00:00:00.000Z',
          windows: [{ days: 7, nodeIds: ['node-active-1'], estimatedMinutes: 20 }],
        },
        evidence: {
          evidenceBasis: 'adaptive-learner-state',
          confidence: { level: 'medium', score: 0.78, sourceCoverage: 0.8 },
          sourceCoverage: { learnerState: 'available' },
          learnerStateDeficits: [],
          prerequisiteReasons: [],
          teacherPolicy: [],
          alternatives: [],
        },
      },
    },
    explanationPayload: {
      selectedReasons: ['active-path-evidence'],
      rejectedAlternatives: [],
      fallbackReasons: [],
    },
    alternativePayload: [],
  },
});

async function expectColdStartContentHidden(page: Page) {
  await expect(page.locator('[data-adaptive-path-cold-start]')).toHaveCount(0);
  await expect(page.locator('[data-adaptive-path-module="learning-overview"]')).toHaveCount(0);
  await expect(page.locator('[data-adaptive-path-generation-action]')).toHaveCount(0);
  await expect(page.getByText('入门诊断', { exact: true })).toHaveCount(0);
}

async function capture(page: Page, viewport: { name: string; width: number; height: number }, state: string) {
  if (!updateEvidence) return;
  mkdirSync(evidenceDir, { recursive: true });
  const filename = `${viewport.name}-${state}.png`;
  const file = path.join(evidenceDir, filename);
  const image = await page.screenshot({ path: file, fullPage: true });
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    geometry.scrollWidth,
    `${viewport.name}-${state} must not overflow horizontally`,
  ).toBe(geometry.clientWidth);
  screenshots.push({
    name: filename,
    width: viewport.width,
    height: viewport.height,
    file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
    sha256: sha256(image),
    state,
    noHorizontalOverflow: true,
  });
}

test.describe.configure({ mode: 'serial' });

test('evidence manifest fails closed when tracked source changes', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    commitSha?: string;
    sourceSha256?: Record<string, string>;
    screenshots?: Array<{ file: string; sha256: string; noHorizontalOverflow?: boolean }>;
  };
  expect(manifest.commitSha).toMatch(/^[0-9a-f]{40}$/);
  expect(hasWorkingTreeSourceDrift(), 'tracked evidence sources must match HEAD').toBe(false);
  for (const file of sourceFiles) {
    const expectedHash = manifest.sourceSha256?.[file];
    expect(expectedHash, `${file} source hash missing or stale`).toBe(
      sourceHashAtCommit(manifest.commitSha!, file),
    );
    expect(sourceHashAtCommit('HEAD', file), `${file} changed after the evidence checkpoint`).toBe(expectedHash);
  }
  for (const screenshot of manifest.screenshots ?? []) {
    const screenshotPath = path.resolve(process.cwd(), screenshot.file);
    expect(existsSync(screenshotPath), screenshot.file).toBe(true);
    expect(sha256(readFileSync(screenshotPath))).toBe(screenshot.sha256);
    expect(screenshot.noHorizontalOverflow, `${screenshot.file} records horizontal overflow`).toBe(true);
  }
});

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const) {
  test(`${viewport.name} verifies landing retry behavior`, async ({ context, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(context);
    const pathBody = '{"path":null}';

    let learnerCalls = 0;
    let pathCalls = 0;
    let releaseRetry!: () => void;
    const retryGate = new Promise<void>((resolve) => { releaseRetry = resolve; });
    await page.route('**/api/adaptive/learner-state**', async (route: Route) => {
      learnerCalls += 1;
      if (learnerCalls === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"temporary"}' });
        return;
      }
      await retryGate;
      await route.fulfill({ status: 200, contentType: 'application/json', body: learnerStateFixture });
    });
    await page.route('**/api/learning-paths/**', async (route: Route) => {
      pathCalls += 1;
      if (pathCalls === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"temporary"}' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: pathBody });
    });

    await page.goto('/assessment/adaptive-practice?goal=control-correction', { waitUntil: 'domcontentloaded' });
    const workspace = page.locator('[data-commercial-workspace="adaptive-path-center"]');
    await expect(workspace).toHaveAttribute('data-adaptive-path-landing-state', 'failed');
    await expect(page.locator('[data-adaptive-path-retry="landing"]')).toHaveCount(1);
    await expect(page.locator('[data-adaptive-path-module="learning-overview"]')).toHaveCount(0);
    expect(learnerCalls).toBe(1);
    expect(pathCalls).toBeGreaterThanOrEqual(1);
    await capture(page, viewport, 'failed');

    await page.locator('[data-adaptive-path-retry="landing"]').click();
    await expect(workspace).toHaveAttribute('data-adaptive-path-landing-state', 'loading');
    await expect(page.locator('[data-adaptive-path-module="learning-overview"]')).toHaveCount(0);
    await capture(page, viewport, 'loading');
    releaseRetry();

    await expect(workspace).toHaveAttribute('data-adaptive-path-landing-state', /^(active|cold-start)$/);
    await expect(page.locator('[data-adaptive-path-retry="landing"]')).toHaveCount(0);
    expect(learnerCalls).toBe(2);
    expect(pathCalls).toBeGreaterThanOrEqual(2);
    await capture(page, viewport, 'recovered');
    assertions.push({
      viewport: viewport.name,
      scenario: 'failed-retry-cold-start',
      passed: true,
      checks: ['failed state', 'retry loading state', 'cold-start recovery'],
    });
  });

  test(`${viewport.name} keeps the active path hidden until both responses finish`, async ({ context, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(context);

    let learnerCalls = 0;
    let pathCalls = 0;
    let releaseLearner!: () => void;
    let releasePath!: () => void;
    const learnerGate = new Promise<void>((resolve) => { releaseLearner = resolve; });
    const pathGate = new Promise<void>((resolve) => { releasePath = resolve; });

    await page.route('**/api/adaptive/learner-state**', async (route: Route) => {
      learnerCalls += 1;
      await learnerGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: activeLearnerStateFixture,
      });
    });
    await page.route(`**/api/learning-paths/${activePathId}`, async (route: Route) => {
      pathCalls += 1;
      await pathGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: activePathFixture,
      });
    });

    await page.goto('/assessment/adaptive-practice?goal=control-correction', { waitUntil: 'domcontentloaded' });
    const workspace = page.locator('[data-commercial-workspace="adaptive-path-center"]');
    await expect.poll(() => learnerCalls).toBe(1);
    await expect(workspace).toHaveAttribute('data-adaptive-path-landing-state', 'loading');
    await expectColdStartContentHidden(page);
    expect(pathCalls).toBe(0);

    releaseLearner();
    await expect.poll(() => pathCalls).toBe(1);
    await expect(workspace).toHaveAttribute('data-adaptive-path-landing-state', 'loading');
    await expectColdStartContentHidden(page);
    await capture(page, viewport, 'active-loading');

    releasePath();
    await expect(workspace).toHaveAttribute('data-adaptive-path-landing-state', 'active');
    const currentPathModule = page.locator('[data-adaptive-path-module="current-path"]');
    await expect(currentPathModule).toBeVisible();
    await currentPathModule.locator('[data-adaptive-path-module-header="responsive"]').click();
    await expect(currentPathModule).toHaveAttribute('data-adaptive-path-module-state', 'expanded');
    await expect(page.locator('[data-adaptive-path-node="node-active-1"]')).toBeVisible();
    await expect(page.getByText(activeNodeTitle, { exact: true }).first()).toBeVisible();
    await expectColdStartContentHidden(page);
    await capture(page, viewport, 'active');

    expect(learnerCalls).toBe(1);
    expect(pathCalls).toBe(1);
    assertions.push({
      viewport: viewport.name,
      scenario: 'delayed-active-path',
      passed: true,
      checks: [
        'loading while learner state is pending',
        'loading while path response is pending',
        'strict active landing state',
        'active path and node visible',
        'cold-start content hidden',
      ],
    });
  });
}

test.afterAll(() => {
  if (!updateEvidence) return;
  expect(assertions).toHaveLength(4);
  expect(screenshots).toHaveLength(10);
  mkdirSync(evidenceDir, { recursive: true });
  const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(manifestPath, `${JSON.stringify({
    capturedAt: new Date().toISOString(),
    commitSha,
    route: '/assessment/adaptive-practice?goal=control-correction',
    sourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, sourceHashAtCommit(commitSha, file)])),
    assertions,
    screenshots,
  }, null, 2)}\n`, 'utf8');
});
