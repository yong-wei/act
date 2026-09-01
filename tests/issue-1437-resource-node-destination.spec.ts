import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';
const evidenceDir = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-1437-resource-node-destination');
const manifestPath = path.join(evidenceDir, 'evidence-manifest.json');
const sourceFiles = [
  'src/features/personalization/path-planning/adaptive-path-destination-contract.ts',
  'src/lib/resource-node-registry.ts',
  'src/features/personalization/path-planning/internal/assemble-plan.ts',
  'src/features/personalization/experience/adaptive-path-journey-contracts.ts',
  'src/app/assessment/adaptive-practice/page.tsx',
  'tests/issue-1437-resource-node-destination.spec.ts',
];
const expectedScreenshotFiles = [
  'execution-desktop-1440.png',
  'execution-mobile-320.png',
  'resource-desktop-1440.png',
  'resource-mobile-320.png',
].map((filename) => path.posix.join('artifacts/commercial-ui/issue-1437-resource-node-destination', filename));
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const screenshots: Array<Record<string, unknown>> = [];
const pathId = 'path-issue-1437-damping';
const nodeId = 'registry:lesson13-physics-builder-simple';
const resourcePath = '/interactive-learning/resources/lesson13-physics-builder-simple';

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
  generatedAt: '2026-08-22T00:00:00.000Z',
  authority: 'server-owned',
  roleScope: { role: 'student', classId: 'class-1437', privacyScopes: ['student-visible'] },
  clientHints: { received: false, authoritative: false, reason: 'client-hints-non-authoritative' },
  primaryCompetencies: { authority: 'legacy-compatibility-only', source: 'fallback-empty', vector: {} },
  secondaryDimensions: {},
  knowledgeMastery: { coverage: 'missing', tags: {} },
  pathContext: {
    activePathCount: 1,
    bookmarkedPathCount: 0,
    recentPathIds: [pathId],
    activeControlCorrectionPath: {
      state: 'active',
      pathId,
      status: 'active',
      currentNodeId: nodeId,
      terminalValidationState: null,
      lowConfidenceMarkers: [],
    },
    statusMarkers: ['available'],
  },
  assessmentState: { latestAbilityEstimate: null },
  evidence: {
    readState: 'ready',
    evidenceWindow: { firstStartedAt: null, lastStartedAt: null, daysCovered: 0 },
    sourceCounts: {},
    sourceCoverage: {},
    confidence: { level: 'medium', score: 0.7, evidenceCount: 1, sourceCompleteness: 0.5 },
    statusMarkers: [],
  },
  missingEvidence: [],
};

const pathFixture = {
  path: {
    id: pathId,
    userId: 'demo-student',
    title: '阻尼调节资源节点路径',
    goalId: 'control-correction',
    plannerVersion: 'issue-1437-destination-contract',
    pathStatus: 'active',
    currentNodeId: nodeId,
    pathPayload: {
      policyFamily: 'rules-plus-graph-search',
      confidence: { level: 'medium', score: 0.8, sourceCoverage: 0.8 },
      score: { total: 0.8, objectives: {} },
      planNodes: [{
        nodeId,
        title: '阻尼调节实验',
        type: 'lesson_step',
        sourceKind: 'resource_registry',
        sourceRef: 'lesson13-physics-builder-simple',
        target: resourcePath,
        estimatedTimeMinutes: 20,
        prerequisiteNodeIds: [],
        knowledgeCoverage: ['对象化三域验证_3_56cb3a4e'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: [],
        score: 0.8,
        reasonCodes: ['issue-1437-fixture'],
        status: 'current',
        readiness: { state: 'ready', reasonCodes: [], missingCompletedNodeIds: [] },
      }],
      explanations: { selectedReasons: ['issue-1437-fixture'], rejectedAlternatives: [], fallbackReasons: [] },
      executionStatus: {
        adopted: true,
        completedNodeIds: [],
        activeNodeId: nodeId,
        updatedAt: '2026-08-22T00:00:00.000Z',
      },
      deviations: [],
      corrections: [],
      feedbackEvents: [],
      visualization: {
        map: {
          mainPathNodeIds: [nodeId],
          branchPaths: [],
          currentNodeId: nodeId,
          completedNodeIds: [],
          riskNodeIds: [],
          blockedNodes: [],
          alternatives: [],
        },
        timeline: {
          generatedAt: '2026-08-22T00:00:00.000Z',
          windows: [{ days: 7, nodeIds: [nodeId], estimatedMinutes: 20 }],
        },
        evidence: {
          evidenceBasis: 'adaptive-learner-state',
          confidence: { level: 'medium', score: 0.8, sourceCoverage: 0.8 },
          sourceCoverage: { learnerState: 'available' },
          learnerStateDeficits: [],
          prerequisiteReasons: [],
          teacherPolicy: [],
          alternatives: [],
        },
      },
    },
    explanationPayload: {
      selectedReasons: ['issue-1437-fixture'],
      rejectedAlternatives: [],
      fallbackReasons: [],
    },
    alternativePayload: [],
  },
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installPathMocks(page: Page) {
  await page.route('**/api/adaptive/learner-state**', (route) => fulfillJson(route, learnerStateFixture));
  await page.route('**/api/adaptive/path-advisor-context**', (route) => fulfillJson(route, { ready: true }));
  await page.route('**/api/learning-paths/latest**', (route) => fulfillJson(route, pathFixture));
  await page.route(`**/api/learning-paths/${encodeURIComponent(pathId)}/execute`, (route) => {
    if (route.request().method() === 'POST') {
      return fulfillJson(route, { ok: true, path: pathFixture.path });
    }
    return route.fallback();
  });
  await page.route(`**/api/learning-paths/${encodeURIComponent(pathId)}**`, (route) => {
    if (route.request().url().includes('/execute')) return route.fallback();
    return fulfillJson(route, pathFixture);
  });
}

async function capture(page: Page, filename: string, viewport: { width: number; height: number }) {
  if (!updateEvidence) return;
  mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, filename);
  const image = await page.screenshot({ path: file, fullPage: true });
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth, `${filename} must not overflow horizontally`).toBe(geometry.clientWidth);
  screenshots.push({
    file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
    sha256: sha256(image),
    width: viewport.width,
    height: viewport.height,
    noHorizontalOverflow: true,
  });
}

test.describe.configure({ mode: 'serial' });

test('evidence manifest stays bound to committed destination-contract sources', () => {
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
    expect(expectedHash, `${file} source hash missing or stale`).toBe(sourceHashAtCommit(manifest.commitSha!, file));
    expect(sourceHashAtCommit('HEAD', file), `${file} changed after evidence capture`).toBe(expectedHash);
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
  test(`${viewport.name} launches 阻尼调节实验 through the shared destination contract`, async ({ context, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(context);
    await installPathMocks(page);

    await page.goto(`${baseURL}/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=${encodeURIComponent(pathId)}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByText('阻尼调节实验').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('路径资源地址未通过平台验证')).toHaveCount(0);
    await capture(page, `execution-${viewport.name}.png`, viewport);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForURL((url) => url.pathname === resourcePath, { timeout: 20000 });
    await expect(page.getByRole('heading', { name: '阻尼调节实验' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('调节阻尼系数，让小球在受力后最快平稳下来', { exact: false })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('路径资源地址未通过平台验证')).toHaveCount(0);
    await capture(page, `resource-${viewport.name}.png`, viewport);
  });
}

test.afterAll(() => {
  if (!updateEvidence) return;
  const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 'commercial-ui-evidence.v1',
    status: 'passed',
    capturedAt: new Date().toISOString(),
    commitSha,
    sourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, sourceHashAtCommit(commitSha, file)])),
    screenshots,
    route: `/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=${pathId}`,
    launchedResource: resourcePath,
    assertions: {
      destinationContractAllowsLaunch: true,
      resourceHeadingVisible: true,
      blockedMessageAbsent: true,
    },
  }, null, 2)}\n`);
});
