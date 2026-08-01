import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const captureEvidence = process.env.ISSUE_1040_CAPTURE_EVIDENCE === '1';
const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/issue-1040-arena-training-evidence');
const generatorPath = 'tests/arena-training-profile-1040.spec.ts';
const sourceFiles = [
  'src/app/(main)/profile/page.tsx',
  'src/app/api/user/profile/route.ts',
  'src/features/arena/profile.ts',
  'src/features/arena/blackbox/controller-preview.ts',
  'src/lib/data-governance/simulation-agent-evidence-materialization.ts',
] as const;
const fixtureAuthority = 'deterministic profile API projection; backend behavior separately verified by profile-route.test.ts';

type CaptureState = {
  sourceRevision: string;
  generatorSha256: string;
  sourceHashes: Record<string, string>;
};

type ScreenshotRecord = {
  path: string;
  sha256: string;
  viewport: { width: number; height: number };
  overflowMetrics: {
    innerWidth: number;
    bodyScrollWidth: number;
    documentScrollWidth: number;
  };
};

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(args: string[]): Buffer {
  return execFileSync('git', args, { cwd: process.cwd() });
}

function currentHead(): string {
  return git(['rev-parse', 'HEAD']).toString('utf8').trim();
}

function assertClean(label: string): void {
  const status = git(['status', '--porcelain', '--untracked-files=all']).toString('utf8');
  if (status.trim().length > 0) {
    throw new Error(`${label}: capture requires a clean worktree`);
  }
}

function readSourceHashes(head: string): CaptureState {
  const paths = [generatorPath, ...sourceFiles];
  const hashes = Object.fromEntries(paths.map((path) => {
    const worktreeBytes = readFileSync(join(process.cwd(), path));
    const committedBytes = git(['show', `HEAD:${path}`]);
    const worktreeHash = sha256(worktreeBytes);
    const committedHash = sha256(committedBytes);
    if (worktreeHash !== committedHash) {
      throw new Error(`capture source drift: ${path}`);
    }
    return [path, worktreeHash];
  }));

  return {
    sourceRevision: head,
    generatorSha256: hashes[generatorPath]!,
    sourceHashes: Object.fromEntries(sourceFiles.map((path) => [path, hashes[path]!])),
  };
}

function prepareCapture(): CaptureState {
  const beforeHead = currentHead();
  if (!/^[0-9a-f]{40}$/.test(beforeHead)) {
    throw new Error(`capture requires a 40-character HEAD, got ${beforeHead}`);
  }
  assertClean('before capture');
  return readSourceHashes(beforeHead);
}

function assertOnlyExpectedScreenshotChanges(expectedPaths: readonly string[]): void {
  const expected = new Set(expectedPaths);
  const statusLines = git(['status', '--porcelain', '--untracked-files=all'])
    .toString('utf8')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const actualPaths = new Set(statusLines.map((line) => line.slice(3)));
  const unexpected = statusLines.filter((line) => {
    const status = line.slice(0, 2);
    return (status !== '??' && status !== ' M') || !expected.has(line.slice(3));
  });
  if (unexpected.length > 0 || [...actualPaths].some((path) => !expected.has(path))) {
    throw new Error(`after screenshot capture only expected screenshot changes are allowed: ${statusLines.join(' | ')}`);
  }
}

function assertScreenshotBundle(screenshots: readonly ScreenshotRecord[]): void {
  const actualNames = readdirSync(evidenceDir)
    .filter((name) => name.endsWith('.png'))
    .sort();
  const expectedNames = screenshots
    .map((screenshot) => screenshot.path.split('/').pop()!)
    .sort();
  if (actualNames.length !== 3 || JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`expected exactly three evidence screenshots, got ${actualNames.join(', ')}`);
  }
  for (const screenshot of screenshots) {
    const absolutePath = join(process.cwd(), screenshot.path);
    if (sha256(readFileSync(absolutePath)) !== screenshot.sha256) {
      throw new Error(`evidence screenshot hash changed: ${screenshot.path}`);
    }
  }
}

function buildProfileFixture() {
  return {
    user: {
      id: 'issue-1040-fixture-student',
      name: 'Issue 1040 Fixture Student',
      email: 'issue-1040-fixture@example.com',
      role: 'STUDENT',
    },
    profile: null,
    statistics: {
      totalSimulations: 0,
      completedMissions: 0,
      ethicalViolations: 0,
      totalSimulationTime: 0,
      averageScore: 0,
    },
    competency: {
      model: 'portrait-v2-cumulative',
      availability: { state: 'NO_EVIDENCE', reason: 'no-eligible-evidence' },
      limitations: [],
      overallScore: null,
      level: null,
      confidence: null,
      lastTrend: null,
      lastRisk: [],
      evidenceAsOf: null,
      generatedAt: null,
      strengths: [],
      improvementAreas: [],
      dimensions: [],
    },
    latestActivity: { preview: [], grouped: [], total: 0 },
    missionProgress: { total: 0, completed: 0, unlocked: 0, locked: 0 },
    personalizedReinforcement: {
      resources: [],
      adaptivePractice: {
        estimatedAbility: null,
        confidenceInterval: null,
        weakAreas: [],
        recommendedFocus: [],
        questionCount: 0,
        actionUrl: '/assessment/adaptive-practice?intent=practice',
      },
    },
    arenaPortfolio: {
      userId: 'issue-1040-fixture-student',
      controllerCount: 0,
      methodDistribution: [],
      identificationModels: [],
      submissionSummary: { total: 0, valid: 0, invalid: 0 },
      recentSubmissions: [],
      personalBestByTask: [],
      frequentFailureObjects: [],
      improvingMetrics: [],
      growth: {
        evidenceAvailable: false,
        capabilityCoverage: { covered: 0, total: 0 },
        weakCapabilities: [],
        improvingCapabilities: [],
        strongCapabilities: [],
        capabilitySignals: [],
        nextChallenges: [],
      },
      trainingSummary: {
        total: 1,
        previewCount: 1,
        evidenceConfidence: 'low',
        latestTrainedAt: '2026-08-01T01:02:03.000Z',
        recentRuns: [{
          id: 'training-run-1040',
          taskId: 'task-second-order-lead-pid',
          taskTitle: '二阶对象快速稳定挑战',
          scenarioId: 'scenario-1040-coastal-surge',
          simulationRunId: null,
          qualityMetrics: {
            trackingError: 0.12,
            maxDeviation: 0.34,
            controlEnergy: 4.56,
            safetyViolations: 1,
            smoothness: 0.78,
          },
          preview: true,
          officialEligible: false,
          confidence: 'low',
          trainedAt: '2026-08-01T01:02:03.000Z',
        }],
      },
    },
  };
}

function buildDamagedProfileFixture() {
  const fixture = buildProfileFixture();
  return {
    ...fixture,
    arenaPortfolio: {
      ...fixture.arenaPortfolio,
      trainingSummary: {
        total: 1,
        previewCount: 1,
        evidenceConfidence: 'low',
        recentRuns: [],
      },
    },
  };
}

async function addStudentSession(context: BrowserContext): Promise<void> {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: 'issue-1040-fixture-student',
      email: 'issue-1040-fixture@example.com',
      name: 'Issue 1040 Fixture Student',
      role: 'STUDENT',
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 3600,
  }]);
}

async function installDeterministicFixture(page: Page, profileRef: { value: unknown }): Promise<void> {
  await page.route('**/api/user/profile', (route) => route.fulfill({
    contentType: 'application/json',
    headers: { 'x-act-fixture': 'issue-1040-deterministic-profile-api' },
    body: JSON.stringify(profileRef.value),
  }));
  await page.route('**/api/student/assignments', (route) => route.fulfill({
    contentType: 'application/json',
    headers: { 'x-act-fixture': 'issue-1040-deterministic-assignments-api' },
    body: JSON.stringify({ assignments: [] }),
  }));
}

async function readOverflowMetrics(page: Page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
}

test.describe.configure({ timeout: 180_000, mode: 'serial' });

test('Issue 1040 profile exposes training-only Arena evidence at desktop and mobile widths', async ({
  context,
  page,
}) => {
  const captureState = captureEvidence ? prepareCapture() : null;
  const screenshots: ScreenshotRecord[] = [];
  const domAssertions: Record<string, Record<string, boolean>> = {};

  try {
    await addStudentSession(context);
    const scenarios = [
      {
        id: 'complete',
        fixture: buildProfileFixture(),
        viewports: [{ width: 1440, height: 1000 }, { width: 320, height: 900 }],
      },
      {
        id: 'damaged',
        fixture: buildDamagedProfileFixture(),
        viewports: [{ width: 320, height: 900 }],
      },
    ] as const;
    const profileRef: { value: unknown } = { value: scenarios[0].fixture };
    await installDeterministicFixture(page, profileRef);

    for (const scenario of scenarios) {
      profileRef.value = scenario.fixture;
      const scenarioAssertions: Record<string, boolean> = {};
      domAssertions[scenario.id] = scenarioAssertions;
      for (const viewport of scenario.viewports) {
        await page.setViewportSize(viewport);
        await page.goto(`/profile?issue-1040-state=${scenario.id}`, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-commercial-student-entry-route="/profile"]')).toBeVisible();
        await expect(page.getByRole('heading', { name: '竞技场画像' })).toBeVisible();
        await expect(page.getByText('暂无竞技场提交记录。', { exact: true })).toBeVisible();
        await expect(page.getByText('暂无官方证据', { exact: true })).toBeVisible();
        await expect(page.getByText('虚拟训练', { exact: true })).toBeVisible();
        await expect(page.getByText('预览', { exact: true })).toBeVisible();
        await expect(page.getByText('非官方', { exact: true })).toBeVisible();
        await expect(page.getByText('低置信度学习观察', { exact: true })).toBeVisible();

        const key = `${viewport.width}x${viewport.height}`;
        scenarioAssertions[`profileVisible:${key}`] = true;
        scenarioAssertions[`officialSubmissionEmpty:${key}`] = true;
        scenarioAssertions[`officialEvidenceEmpty:${key}`] = true;
        scenarioAssertions[`trainingCard:${key}`] = true;
        scenarioAssertions[`previewAndUnofficial:${key}`] = true;
        scenarioAssertions[`lowConfidence:${key}`] = true;

        if (scenario.id === 'complete') {
          if (viewport.width === 1440) {
            await expect(page.locator('[data-platform-desktop-navigation="collapsible"]').first()).toBeVisible();
            scenarioAssertions['navigationState:desktop-collapsible'] = true;
          } else if (viewport.width === 320) {
            await expect(page.locator('[data-platform-mobile-navigation="drawer"]').first()).toBeVisible();
            const openDrawer = page.getByRole('button', { name: '打开平台导航' });
            await expect(openDrawer).toBeVisible();
            await openDrawer.click();
            await expect(page.locator('[data-app-shell-mobile-drawer="open"]').first()).toBeVisible();
            await page.getByRole('button', { name: '关闭平台导航', exact: true }).click();
            await expect(page.locator('[data-app-shell-mobile-drawer="open"]')).toHaveCount(0);
            scenarioAssertions['navigationState:mobile-drawer'] = true;
          }
          await expect(page.getByText('二阶对象快速稳定挑战', { exact: true })).toBeVisible();
          await expect(page.getByText('场景 scenario-1040-coastal-surge', { exact: false })).toBeVisible();
          for (const metric of [
            '跟踪误差 0.12',
            '最大偏差 0.34',
            '控制能量 4.56',
            '安全违规 1',
            '平滑度 0.78',
          ]) {
            await expect(page.getByText(metric, { exact: false })).toBeVisible();
          }
          scenarioAssertions[`completeQualityMetrics:${key}`] = true;
        } else {
          await expect(page.getByText('暂无可展示的完整训练质量摘要', { exact: true })).toBeVisible();
          for (const metricLabel of ['跟踪误差', '最大偏差', '控制能量', '安全违规', '平滑度']) {
            await expect(page.getByText(metricLabel, { exact: false })).toHaveCount(0);
          }
          scenarioAssertions[`unavailableQualitySummary:${key}`] = true;
          scenarioAssertions[`noRawQualityMetricLabels:${key}`] = true;
        }

        const bodyText = await page.locator('body').innerText();
        expect(bodyText).not.toContain('undefined');
        const overflowMetrics = await readOverflowMetrics(page);
        expect(overflowMetrics.bodyScrollWidth).toBeLessThanOrEqual(overflowMetrics.innerWidth);
        expect(overflowMetrics.documentScrollWidth).toBeLessThanOrEqual(overflowMetrics.innerWidth);
        scenarioAssertions[`noUndefined:${key}`] = true;
        scenarioAssertions[`noHorizontalOverflow:${key}`] = true;

        if (captureState) {
          const screenshotPath = join(evidenceDir, `profile-training-${scenario.id}-${viewport.width}x${viewport.height}.png`);
          mkdirSync(evidenceDir, { recursive: true });
          await page.screenshot({ path: screenshotPath, fullPage: true });
          screenshots.push({
            path: relative(process.cwd(), screenshotPath),
            sha256: sha256(readFileSync(screenshotPath)),
            viewport,
            overflowMetrics,
          });
        }
      }
    }

    if (captureState) {
      assertOnlyExpectedScreenshotChanges(screenshots.map((screenshot) => screenshot.path));
      const captureAfterHead = currentHead();
      if (captureAfterHead !== captureState.sourceRevision) {
        throw new Error('capture HEAD changed during browser verification');
      }
      const finalHashes = readSourceHashes(captureAfterHead);
      if (finalHashes.generatorSha256 !== captureState.generatorSha256
        || JSON.stringify(finalHashes.sourceHashes) !== JSON.stringify(captureState.sourceHashes)) {
        throw new Error('capture source hashes changed during browser verification');
      }
      writeFileSync(join(evidenceDir, 'manifest.json'), JSON.stringify({
        status: 'passed',
        capturedAt: new Date().toISOString(),
        generatorPath,
        generatorSha256: captureState.generatorSha256,
        sourceRevision: captureState.sourceRevision,
        sourceFiles: finalHashes.sourceHashes,
        fixtureAuthority,
        route: '/profile',
        role: 'STUDENT',
        captureBeforeHead: captureState.sourceRevision,
        captureAfterHead,
        screenshots,
        overflowMetrics: screenshots.map((entry) => ({ viewport: entry.viewport, ...entry.overflowMetrics })),
        domAssertions,
      }, null, 2));
      assertScreenshotBundle(screenshots);
    }
  } catch (error) {
    if (captureEvidence) rmSync(evidenceDir, { recursive: true, force: true });
    throw error;
  }
});
