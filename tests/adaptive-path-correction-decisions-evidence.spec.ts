import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page, type Route } from '@playwright/test';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-1284-p2');
const manifestPath = path.join(evidenceDir, 'manifest.json');
const generatorFile = 'tests/adaptive-path-correction-decisions-evidence.spec.ts';
const productionSourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/features/personalization/experience/adaptive-path-journey-control.tsx',
  'src/features/personalization/experience/adaptive-path-journey-contracts.ts',
  'src/features/personalization/path-planning/adaptive-path-correction-decisions.ts',
  'src/app/api/learning-paths/[id]/correction-decisions/route.ts',
];
const trackedSourceFiles = [generatorFile, ...productionSourceFiles];
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const;
const scenarios = ['confirmed', 'rejected', 'deferred', 'skip-confirmed', 'replacement-confirmed', 'abandonment-confirmed', 'stale-409', 'retry-failed'] as const;
type Scenario = typeof scenarios[number];
const expectedScreenshotFiles = viewports.flatMap((viewport) => scenarios.map((scenario) => path.posix.join(
  'artifacts/commercial-ui/issue-1284-p2',
  `${scenario}-${viewport.name}.png`,
)));
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

function routeFor(scenario: Scenario): string {
  return `/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution&pathId=path-correction-1&nodeId=node-3&correctionFixture=${scenario}`;
}

function proposal(scenario: Scenario) {
  const skipped = scenario === 'skip-confirmed';
  const replacement = scenario === 'replacement-confirmed';
  const abandonment = scenario === 'abandonment-confirmed';
  const governedDeviation = skipped || replacement || abandonment;
  return {
    trigger: {
      kind: 'deviation',
      nodeId: governedDeviation ? 'node-2' : 'node-4',
      title: governedDeviation ? '节点 2' : '节点 4',
      reason: skipped
        ? '节点 2 已跳过，当前节点已推进至节点 3。'
        : replacement
          ? '节点 2 已替换为受治理的后续节点。'
          : abandonment
            ? '节点 2 已明确放弃，当前路径需要移除该未完成节点。'
            : '检查点结果提示后续路径可调整。',
    },
    originalRemaining: [
      { nodeId: 'node-4', title: '节点 4', type: 'knowledge_card', estimatedTimeMinutes: 10 },
      { nodeId: 'node-5', title: '节点 5', type: 'checkpoint', estimatedTimeMinutes: 10 },
    ],
    proposedRemaining: [
      { nodeId: 'node-5', title: '节点 5', type: 'checkpoint', estimatedTimeMinutes: 10 },
      { nodeId: 'node-4', title: '节点 4', type: 'knowledge_card', estimatedTimeMinutes: 10 },
    ],
    changes: replacement
      ? [{ kind: 'replaced', nodeId: 'node-2', title: '节点 2', replacementNodeId: 'node-5', replacementTitle: '节点 5' }]
      : abandonment
        ? [{ kind: 'removed', nodeId: 'node-2', title: '节点 2', reason: '已记录放弃执行事实。' }]
        : [{ kind: 'reordered', nodeId: 'node-5', title: '节点 5', movedAfterNodeId: 'node-3' }],
    supportingFacts: [skipped
      ? '已记录节点 2 的跳过执行事实。'
      : replacement
        ? '已记录节点 2 的替换执行事实。'
        : abandonment
          ? '已记录节点 2 的放弃执行事实。'
          : '已记录可核验的检查点结果。'],
    estimatedRemainingWork: { originalMinutes: 20, proposedMinutes: 20, differenceMinutes: 0 },
  };
}

function createJourney(scenario: Scenario, decision: 'confirmed' | 'rejected' | 'deferred' | null) {
  const decided = decision ? {
    decision,
    candidateFingerprint: 'correction-1284-p2',
    applied: decision === 'confirmed',
    createdAt: '2026-08-05T01:00:00.000Z',
  } : null;
  return {
    path: { id: 'path-correction-1', title: '控制系统校正学习路径' },
    goal: { id: 'control-correction' },
    context: { pathId: 'path-correction-1', goalId: 'control-correction', requestedNodeId: 'node-3' },
    current: { nodeId: 'node-3', title: '节点 3', type: 'checkpoint' },
    progress: { completed: 1, total: scenario === 'skip-confirmed' && decision === 'confirmed' ? 3 : 4 },
    return: {
      label: '返回学习路径',
      href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-correction-1&nodeId=node-3',
    },
    pathStatus: 'active',
    nextAction: {
      state: 'blocked', nodeId: 'node-3', title: '节点 3', type: 'checkpoint', href: null,
      reason: '当前检查点等待纠偏决定。',
      recovery: {
        label: '刷新路径状态',
        href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-correction-1&nodeId=node-3',
      },
    },
    correction: {
      proposal: proposal(scenario),
      candidateFingerprint: 'correction-1284-p2',
      pathUpdatedAt: '2026-08-05T01:00:00.000Z',
      decision: decision ? { decision, applied: decision === 'confirmed' } : null,
      history: decided ? [decided] : [],
    },
  };
}

async function verifyNoHorizontalOverflow(page: Page, viewport: typeof viewports[number]) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth, `${viewport.name} must not overflow horizontally`).toBe(geometry.clientWidth);
}

async function openCorrectionDetails(correction: ReturnType<Page['locator']>) {
  await expect(correction).toBeVisible();
  if (!await correction.evaluate((element) => (element as HTMLDetailsElement).open)) {
    await correction.locator('summary').click();
  }
}

async function expectCorrectionDecision(
  correction: ReturnType<Page['locator']>,
  decision: 'confirmed' | 'rejected',
) {
  const receipt = correction.locator(`[data-adaptive-path-correction-decision="${decision}"]`);
  await expect(receipt).toBeAttached();
  await openCorrectionDetails(correction);
  await expect(receipt).toBeVisible();
}

async function capture(page: Page, viewport: typeof viewports[number], scenario: Scenario) {
  await verifyNoHorizontalOverflow(page, viewport);
  if (!updateEvidence) return;
  mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `${scenario}-${viewport.name}.png`);
  const image = await page.screenshot({ path: file, fullPage: true });
  screenshots.push({
    scenario,
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
    sha256: sha256(image),
    noHorizontalOverflow: true,
  });
}

test.describe.configure({ mode: 'serial' });

test('evidence manifest fails closed when generator or production source changes', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    sourceRevision?: string;
    generator?: { file?: string; sha256?: string };
    productionSourceSha256?: Record<string, string>;
    assertions?: Array<{ passed?: boolean }>;
    screenshots?: Array<{ file: string; sha256: string; noHorizontalOverflow?: boolean }>;
  };
  expect(manifest.sourceRevision).toMatch(/^[0-9a-f]{40}$/);
  expect(hasWorkingTreeSourceDrift(), 'tracked evidence sources must match HEAD').toBe(false);
  expect(manifest.generator?.file).toBe(generatorFile);
  expect(manifest.generator?.sha256).toBe(sourceHashAtCommit(manifest.sourceRevision!, generatorFile));
  expect(sourceHashAtCommit('HEAD', generatorFile)).toBe(manifest.generator?.sha256);
  for (const file of productionSourceFiles) {
    const expectedHash = manifest.productionSourceSha256?.[file];
    expect(expectedHash, `${file} source hash missing or stale`).toBe(sourceHashAtCommit(manifest.sourceRevision!, file));
    expect(sourceHashAtCommit('HEAD', file), `${file} changed after evidence capture`).toBe(expectedHash);
  }
  expect(manifest.assertions).toHaveLength(viewports.length * scenarios.length);
  expect(manifest.assertions?.every((assertion) => assertion.passed)).toBe(true);
  expect(manifest.screenshots?.map((screenshot) => screenshot.file).sort()).toEqual([...expectedScreenshotFiles].sort());
  for (const screenshot of manifest.screenshots ?? []) {
    const screenshotPath = path.resolve(process.cwd(), screenshot.file);
    expect(existsSync(screenshotPath), screenshot.file).toBe(true);
    expect(sha256(readFileSync(screenshotPath))).toBe(screenshot.sha256);
    expect(screenshot.noHorizontalOverflow).toBe(true);
  }
});

for (const viewport of viewports) {
  for (const scenario of scenarios) {
    test(`${viewport.name} verifies ${scenario} correction decision behavior`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      let decision: 'confirmed' | 'rejected' | 'deferred' | null = null;
      let decisionAttempts = 0;
      await page.route(/\/api\/learning-paths\/[^/]+\/journey(?:\?|$)/, async (route: Route) => {
        await route.fulfill({ json: { journey: createJourney(scenario, decision) } });
      });
      await page.route(/\/api\/learning-paths\/[^/]+\/correction-decisions$/, async (route: Route) => {
        decisionAttempts += 1;
        const request = route.request().postDataJSON() as Record<string, unknown>;
        expect(request).not.toHaveProperty('nodeIds');
        expect(request).not.toHaveProperty('proposedRemaining');
        expect(request.candidateFingerprint).toBe('correction-1284-p2');
        if (scenario === 'stale-409' && decisionAttempts === 1) {
          await route.fulfill({ status: 409, json: { refreshRequired: true } });
          return;
        }
        if (scenario === 'retry-failed' && decisionAttempts === 1) {
          await route.fulfill({ status: 500, json: { error: 'temporary' } });
          return;
        }
        decision = request.decision as typeof decision;
        await route.fulfill({ json: { decision: { id: 'decision-1284-p2', decision, applied: decision === 'confirmed' } } });
      });
      await page.goto(routeFor(scenario), { waitUntil: 'domcontentloaded' });

      const correction = page.locator('[data-adaptive-path-correction="available"]');
      await expect(correction).toBeVisible({ timeout: 30_000 });
      const summary = correction.locator('summary');
      await summary.focus();
      await expect(summary).toBeFocused();
      await page.keyboard.press('Enter');
      const actions = correction.locator('[data-adaptive-path-correction-actions="available"]');
      await expect(actions).toBeVisible();

      if (scenario === 'rejected') {
        await page.getByRole('button', { name: '不采用' }).click();
        await expectCorrectionDecision(correction, 'rejected');
        await expect(actions).toHaveCount(0);
      } else if (scenario === 'deferred') {
        await page.getByRole('button', { name: '暂不处理' }).click();
        await openCorrectionDetails(correction);
        await expect(correction).toContainText('已暂缓，可在此后继续决定。');
        await expect(actions).toBeVisible();
      } else {
        const confirm = page.getByRole('button', { name: '确认调整' });
        await confirm.focus();
        await expect(confirm).toBeFocused();
        await confirm.click();
        if (scenario === 'stale-409') {
          await expect(correction).toContainText('方案已更新，请刷新后重新查看。');
        } else if (scenario === 'retry-failed') {
          await expect(correction).toContainText('暂时无法记录纠偏决策，请稍后重试。');
          await confirm.click();
          await expectCorrectionDecision(correction, 'confirmed');
        } else {
          await expectCorrectionDecision(correction, 'confirmed');
          if (scenario === 'skip-confirmed') {
            await expect(correction).toContainText('节点 2 已跳过，当前节点已推进至节点 3。');
          }
        }
      }

      await capture(page, viewport, scenario);
      assertions.push({
        viewport: viewport.name,
        scenario,
        passed: true,
        checks: [
          'student submits only decision identity and idempotency data',
          'keyboard focus reaches correction controls',
          'no horizontal overflow',
          scenario === 'skip-confirmed' ? 'skip advance candidate confirms' : scenario,
        ],
      });
    });
  }
}

test.afterAll(() => {
  if (!updateEvidence) return;
  if (assertions.length !== viewports.length * scenarios.length || screenshots.length !== viewports.length * scenarios.length) return;
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 'commercial-ui-evidence.v1',
    capturedAt: new Date().toISOString(),
    sourceRevision,
    generator: { file: generatorFile, sha256: sourceHashAtCommit(sourceRevision, generatorFile) },
    productionSourceSha256: Object.fromEntries(productionSourceFiles.map((file) => [file, sourceHashAtCommit(sourceRevision, file)])),
    routes: scenarios.map(routeFor),
    assertions,
    screenshots,
  }, null, 2)}\n`, 'utf8');
});
