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
];
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const screenshots: Array<Record<string, unknown>> = [];

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHash(file: string): string {
  return sha256(readFileSync(path.resolve(process.cwd(), file)));
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

async function capture(page: Page, viewport: { name: string; width: number; height: number }, state: string) {
  mkdirSync(evidenceDir, { recursive: true });
  const filename = `${viewport.name}-${state}.png`;
  const file = path.join(evidenceDir, filename);
  const image = await page.screenshot({ path: file, fullPage: true });
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  screenshots.push({
    name: filename,
    width: viewport.width,
    height: viewport.height,
    file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
    sha256: sha256(image),
    state,
    noHorizontalOverflow: geometry.clientWidth === geometry.scrollWidth,
  });
}

test.describe.configure({ mode: 'serial' });

test('evidence manifest fails closed when tracked source changes', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    commitSha?: string;
    sourceSha256?: Record<string, string>;
    screenshots?: Array<{ file: string; sha256: string }>;
  };
  expect(manifest.commitSha).toMatch(/^[0-9a-f]{40}$/);
  for (const file of sourceFiles) {
    expect(manifest.sourceSha256?.[file], `${file} source hash missing or stale`).toBe(sourceHash(file));
  }
  for (const screenshot of manifest.screenshots ?? []) {
    const screenshotPath = path.resolve(process.cwd(), screenshot.file);
    expect(existsSync(screenshotPath), screenshot.file).toBe(true);
    expect(sha256(readFileSync(screenshotPath))).toBe(screenshot.sha256);
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
  });
}

test.afterAll(() => {
  if (!updateEvidence) return;
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify({
    capturedAt: new Date().toISOString(),
    commitSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    route: '/assessment/adaptive-practice?goal=control-correction',
    sourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, sourceHash(file)])),
    screenshots,
  }, null, 2)}\n`, 'utf8');
});
