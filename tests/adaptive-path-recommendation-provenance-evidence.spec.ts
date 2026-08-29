import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3002';
const generatorFile = 'tests/adaptive-path-recommendation-provenance-evidence.spec.ts';
const productionSourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/features/adaptive/adaptive-learning-center-contracts.ts',
  'src/features/personalization/path-planning/internal/assemble-plan.ts',
  'src/lib/adaptive-path-round-restore.ts',
  'src/lib/adaptive-path-option-display.ts',
];
const trackedSourceFiles = [generatorFile, ...productionSourceFiles];
const evidenceDir = path.resolve(
  process.cwd(),
  'artifacts/commercial-ui/adaptive-path-recommendation-provenance-1186',
);
const manifestPath = path.join(evidenceDir, 'manifest.json');
const fixtures = ['sufficient', 'low', 'legacy'] as const;
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1100 },
  { name: 'mobile-320', width: 320, height: 1100 },
] as const;
const expectedScreenshotFiles = [
  ...viewports.flatMap((viewport) => fixtures.map((fixture) => (
    path.posix.join(
      'artifacts/commercial-ui/adaptive-path-recommendation-provenance-1186',
      `${viewport.name}-${fixture}.png`,
    )
  ))),
  ...viewports.map((viewport) => path.posix.join(
    'artifacts/commercial-ui/adaptive-path-recommendation-provenance-1186',
    `${viewport.name}-continue-existing-path.png`,
  )),
];
const persistedPathId = 'persisted-profile-path-1532';
const persistedNodeId = 'persisted-phase-margin-node';
const persistedPathTitle = '已保存的画像规划路径';
const persistedNodeTitle = '相位裕度校正节点-已保存';
const persistedPath = {
  path: {
    id: persistedPathId,
    userId: 'demo-student',
    title: persistedPathTitle,
    goalId: 'control-correction',
    plannerVersion: 'profile-consumption-persisted-v1',
    pathStatus: 'active',
    currentNodeId: persistedNodeId,
    pathPayload: {
      status: 'ready',
      planNodes: [{
        nodeId: persistedNodeId,
        title: persistedNodeTitle,
        type: 'checkpoint',
        status: 'current',
        target: '/assessment/adaptive-practice',
        estimatedTimeMinutes: 30,
        terminalConstraints: [],
      }],
      mainPathNodeIds: [persistedNodeId],
      pathOptions: [{
        optionId: 'persisted-option',
        styleId: 'persisted',
        label: persistedPathTitle,
        nodeIds: [persistedNodeId],
        recommendationProvenance: {
          summary: '依据已保存规划快照恢复本路径。',
          personalizationNotes: ['根据你的学习方式偏好，优先安排视频、讲义和仿真类学习资源。'],
          confidence: 'medium',
          evidenceReviewHref: '/profile/evidence',
          limitations: [],
        },
      }],
      visualization: {
        evidence: {
          learnerStateSnapshot: {
            payloadVersion: 'adaptive-learner-state.v1',
            generatedAt: '2026-08-20T00:00:00.000Z',
            authority: 'server-owned',
            evidenceWindow: {
              firstStartedAt: '2026-08-01T00:00:00.000Z',
              lastStartedAt: '2026-08-19T00:00:00.000Z',
              daysCovered: 18,
            },
            preferredModalities: ['video', 'handout', 'simulation'],
          },
        },
      },
      feedbackEvents: [],
      selectionHistory: [],
      activity: [],
      score: { total: 0.8, objectives: {} },
      confidence: { level: 'medium', score: 0.8, sourceCoverage: 0.8 },
    },
    explanationPayload: { explanations: { selectedReasons: [], fallbackReasons: [] }, selectedReasons: [], fallbackReasons: [] },
    alternativePayload: [],
    terminalValidation: {},
    lastExecutionMetadata: { adopted: true, completedNodeIds: [], activeNodeId: persistedNodeId },
    executions: [],
    deviations: [],
    interventions: [],
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
};
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
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...trackedSourceFiles]);
    return false;
  } catch {
    return true;
  }
}

function routeFor(fixture: typeof fixtures[number]): string {
  return `/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-selection&provenanceFixture=${fixture}`;
}

async function verifyNoHorizontalOverflow(page: Page, viewportName: string) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth, `${viewportName} must not overflow horizontally`).toBe(geometry.clientWidth);
}

async function capture(
  page: Page,
  viewport: typeof viewports[number],
  fixture: typeof fixtures[number] | 'continue-existing-path',
) {
  await verifyNoHorizontalOverflow(page, viewport.name);
  if (!updateEvidence) return;
  mkdirSync(evidenceDir, { recursive: true });
  const filename = `${viewport.name}-${fixture}.png`;
  const file = path.join(evidenceDir, filename);
  const image = await page.screenshot({ path: file, fullPage: true });
  screenshots.push({
    fixture,
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
    sha256: sha256(image),
    noHorizontalOverflow: true,
  });
}

async function login(context: BrowserContext) {
  const csrfResponse = await context.request.get('/api/auth/csrf');
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();
  const response = await context.request.post('/api/auth/callback/credentials?json=true', {
    form: {
      csrfToken: csrf.csrfToken!,
      email: 'demo',
      password: 'DemoStudent@Just2026!',
      callbackUrl: '/',
      json: 'true',
    },
  });
  expect(response.ok() || (response.status() >= 300 && response.status() < 400), await response.text()).toBe(true);
}

async function installPersistedPathRoutes(page: Page, generationRequests: { count: number }) {
  await page.route('**/api/adaptive/path-advisor-context**', (route) => route.fulfill({
    json: {
      goalId: 'control-correction',
      classId: 'class-profile-consumption',
      courseTitle: 'Control correction',
      topic: 'Continue persisted path',
      learningObjectives: ['Resume the saved planning snapshot'],
      modeContextToken: 'profile-consumption-mode-context',
      readiness: {
        status: 'ready',
        reason: 'ready',
        source: 'path-advisor',
        studentAction: 'generate',
        studentMessage: 'Ready',
      },
    },
  }));
  await page.route('**/api/adaptive/path-advisor-tool', async (route) => {
    if (route.request().method() === 'POST') generationRequests.count += 1;
    await route.fulfill({
      status: 500,
      json: { error: 'path generation must not run when continuing a persisted path' },
    });
  });
  await page.route('**/api/adaptive/learner-state**', (route) => route.fulfill({
    json: {
      userId: 'demo-student',
      payloadVersion: 'adaptive-learner-state.v1',
      generatedAt: '2026-08-26T00:00:00.000Z',
      authority: 'server-owned',
      roleScope: { role: 'student', classId: 'class-profile-consumption', privacyScopes: ['student-visible'] },
      clientHints: { received: false, authoritative: false, reason: 'client-hints-non-authoritative' },
      primaryCompetencies: { authority: 'legacy-compatibility-only', source: 'fallback-empty', vector: {} },
      secondaryDimensions: {},
      knowledgeMastery: { coverage: 'missing', tags: {} },
      pathContext: {
        activePathCount: 1,
        bookmarkedPathCount: 0,
        recentPathIds: [persistedPathId],
        activeControlCorrectionPath: {
          state: 'active',
          pathId: persistedPathId,
          status: 'active',
          currentNodeId: persistedNodeId,
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
        confidence: { level: 'none', score: 0, evidenceCount: 0, sourceCompleteness: 0 },
        statusMarkers: [],
      },
      missingEvidence: [],
    },
  }));
  await page.route('**/api/learning-paths/latest?**', (route) => route.fulfill({ json: persistedPath }));
  await page.route(`**/api/learning-paths/${persistedPathId}`, (route) => route.fulfill({ json: persistedPath }));
  await page.route('**/api/learning-paths/candidate-batches/latest?**', (route) => (
    route.fulfill({ json: { batch: null } })
  ));
}

test.describe.configure({ mode: 'serial' });

test('evidence manifest fails closed when generator or production source changes', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    commitSha?: string;
    generator?: { file?: string; sha256?: string };
    productionSourceSha256?: Record<string, string>;
    screenshots?: Array<{ file: string; sha256: string; noHorizontalOverflow?: boolean }>;
    assertions?: Array<{ passed?: boolean }>;
  };
  expect(manifest.commitSha).toMatch(/^[0-9a-f]{40}$/);
  expect(hasWorkingTreeSourceDrift(), 'tracked evidence sources must match HEAD').toBe(false);
  expect(manifest.generator?.file).toBe(generatorFile);
  expect(manifest.generator?.sha256).toBe(sourceHashAtCommit(manifest.commitSha!, generatorFile));
  expect(sourceHashAtCommit('HEAD', generatorFile)).toBe(manifest.generator?.sha256);
  for (const file of productionSourceFiles) {
    const expectedHash = manifest.productionSourceSha256?.[file];
    expect(expectedHash, `${file} production source hash missing or stale`)
      .toBe(sourceHashAtCommit(manifest.commitSha!, file));
    expect(sourceHashAtCommit('HEAD', file), `${file} changed after the evidence checkpoint`)
      .toBe(expectedHash);
  }
  expect(manifest.assertions?.length).toBe(8);
  expect(manifest.assertions?.every((assertion) => assertion.passed)).toBe(true);
  expect(manifest.screenshots?.map((screenshot) => screenshot.file).sort())
    .toEqual([...expectedScreenshotFiles].sort());
  for (const screenshot of manifest.screenshots ?? []) {
    const screenshotPath = path.resolve(process.cwd(), screenshot.file);
    expect(existsSync(screenshotPath), screenshot.file).toBe(true);
    expect(sha256(readFileSync(screenshotPath))).toBe(screenshot.sha256);
    expect(screenshot.noHorizontalOverflow).toBe(true);
  }
});

for (const viewport of viewports) {
  for (const fixture of fixtures) {
    test(`${viewport.name} verifies ${fixture} recommendation-basis state`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(routeFor(fixture), { waitUntil: 'domcontentloaded' });

      const optionCard = page.locator('[data-learning-path-option="path-option-1"]:visible');
      await expect(optionCard).toHaveCount(1);
      const provenance = optionCard.locator('[data-learning-path-recommendation-provenance]');

      if (fixture === 'legacy') {
        await expect(provenance).toHaveCount(0);
        await expect(optionCard).toContainText('推荐学习路径');
      } else {
        await expect(provenance).toHaveCount(1);
        await expect(provenance).toContainText('推荐依据');
        const disclosure = provenance.locator('details');
        const disclosureSummary = disclosure.locator('summary');
        await disclosureSummary.focus();
        await page.keyboard.press('Enter');
        await expect(disclosure).toHaveAttribute('open', '');
        await expect(provenance).toContainText('学习证据');
        await expect(provenance).toContainText('能力判断与路径影响');
        const evidenceLink = provenance.getByRole('link', { name: '查看学习记录并复核证据' });
        await page.keyboard.press('Tab');
        await expect(evidenceLink).toBeFocused();
        await expect(evidenceLink).toHaveAttribute('href', '/profile/evidence');

        if (fixture === 'low') {
          await expect(provenance).toContainText('低置信度');
          await expect(provenance).toContainText('课程结构、先修规则和可用资源');
          await expect(provenance).toContainText('完成诊断或练习，补充有效学习证据');
        } else {
          await expect(provenance).toContainText('中等置信度');
          await expect(provenance).toContainText('受影响的推荐资源');
          if (fixture === 'sufficient') {
            await expect(provenance).toContainText('根据你的学习方式偏好，优先安排视频、讲义和仿真类学习资源。');
          }
        }
      }

      if (fixture === 'low') {
        await expect(optionCard).toContainText('当前学习记录较少，这条路径会先从基础内容开始。');
      } else if (fixture === 'sufficient') {
        await expect(optionCard).toContainText('这条路径结合你的学习记录生成。');
      }

      await capture(page, viewport, fixture);
      assertions.push({
        viewport: viewport.name,
        fixture,
        passed: true,
        checks: fixture === 'legacy'
          ? ['legacy fallback remains usable', 'no synthesized provenance', 'no horizontal overflow']
          : [
              'aggregate recommendation basis visible',
              'keyboard disclosure',
              'evidence link keyboard focus',
              'governed learning-record href',
              fixture === 'low' ? 'mixed evidence downgrades path confidence' : 'affected resources visible',
              fixture === 'sufficient' ? 'learner modality preference is readable' : null,
              'no horizontal overflow',
            ].filter((item): item is string => Boolean(item)),
      });
    });
  }
}

for (const viewport of viewports) {
  test(`${viewport.name} continues the persisted path without invoking generation`, async ({ context, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const generationRequests = { count: 0 };
    await login(context);
    await installPersistedPathRoutes(page, generationRequests);
    await page.goto(
      '/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation',
      { waitUntil: 'domcontentloaded' },
    );

    const continueAction = page.locator('[data-adaptive-path-continue-action="current-path"]');
    await expect(continueAction).toBeVisible();
    await expect(continueAction).toHaveAttribute('href', new RegExp(`intent=path-execution`));
    await expect(continueAction).toHaveAttribute('href', new RegExp(`pathId=${persistedPathId}`));
    await continueAction.click();

    await expect(page).toHaveURL(new RegExp(`intent=path-execution`));
    await expect(page).toHaveURL(new RegExp(`pathId=${persistedPathId}`));
    const activeRoute = page.locator('[data-adaptive-path-execution-surface="active-route"]');
    await expect(activeRoute).toBeVisible();
    await expect(activeRoute).toContainText(persistedPathTitle);
    await expect(activeRoute).toContainText(persistedNodeTitle);
    await expect(page.locator('[data-learning-path-options-layout="route-modules"]')).toHaveCount(0);
    expect(generationRequests.count).toBe(0);
    await capture(page, viewport, 'continue-existing-path');
    assertions.push({
      viewport: viewport.name,
      fixture: 'continue-existing-path',
      passed: true,
      checks: [
        'continue action is clicked from the loaded persisted path',
        'path-execution restore uses the original planning snapshot',
        'candidate comparison stays hidden',
        'path generation endpoint is not invoked',
      ],
    });
  });
}

test.afterAll(() => {
  if (!updateEvidence) return;
  expect(assertions).toHaveLength(8);
  expect(screenshots).toHaveLength(8);
  mkdirSync(evidenceDir, { recursive: true });
  const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(manifestPath, `${JSON.stringify({
    capturedAt: new Date().toISOString(),
    commitSha,
    generator: {
      file: generatorFile,
      sha256: sourceHashAtCommit(commitSha, generatorFile),
    },
    productionSourceSha256: Object.fromEntries(
      productionSourceFiles.map((file) => [file, sourceHashAtCommit(commitSha, file)]),
    ),
    routes: [
      ...fixtures.map(routeFor),
      '/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation',
    ],
    assertions,
    screenshots,
  }, null, 2)}\n`, 'utf8');
});
