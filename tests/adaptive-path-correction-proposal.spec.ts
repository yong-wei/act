import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-1284-adaptive-path-correction-proposal');
const manifestPath = path.join(evidenceDir, 'manifest.json');
const generatorFile = 'tests/adaptive-path-correction-proposal.spec.ts';
const productionSourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/features/personalization/experience/adaptive-path-journey-control.tsx',
  'src/features/personalization/experience/adaptive-path-journey-contracts.ts',
];
const trackedSourceFiles = [generatorFile, ...productionSourceFiles];
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const;
const expectedScreenshotFiles = viewports.flatMap((viewport) => [
  `failed-checkpoint-${viewport.name}.png`,
  `recorded-deviation-${viewport.name}.png`,
].map((file) => path.posix.join('artifacts/commercial-ui/issue-1284-adaptive-path-correction-proposal', file)));
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

function routeFor(fixture: 'failed-checkpoint' | 'recorded-deviation') {
  return `/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution&pathId=path-correction-1&nodeId=checkpoint-1&correctionFixture=${fixture}`;
}

function createJourney(fixture: 'failed-checkpoint' | 'recorded-deviation') {
  const originalRemaining = [
    { nodeId: 'checkpoint-1', title: '校正检查点', type: 'checkpoint', estimatedTimeMinutes: 15 },
    { nodeId: 'review-1', title: '误差复习', type: 'knowledge_card', estimatedTimeMinutes: 20 },
  ];
  const correction = fixture === 'failed-checkpoint'
    ? {
        proposal: null,
        unavailableReason: '检查点未通过，但当前路径未提供可核验的补救关系，暂时无法生成可靠的纠偏方案。',
      }
    : {
        proposal: {
          trigger: {
            kind: 'deviation',
            nodeId: 'review-1',
            title: '误差复习',
            reason: '路径执行记录显示该节点已被跳过。',
          },
          originalRemaining,
          proposedRemaining: [originalRemaining[0]],
          changes: [{ kind: 'removed', nodeId: 'review-1', title: '误差复习', reason: '已记录的跳过执行事实。' }],
          supportingFacts: ['“误差复习”存在已记录的跳过执行事实。'],
          estimatedRemainingWork: { originalMinutes: 35, proposedMinutes: 15, differenceMinutes: -20 },
        },
        unavailableReason: null,
      };

  return {
    path: { id: 'path-correction-1', title: '控制系统校正学习路径' },
    goal: { id: 'control-correction' },
    context: {
      pathId: 'path-correction-1',
      goalId: 'control-correction',
      requestedNodeId: 'checkpoint-1',
    },
    current: { nodeId: 'checkpoint-1', title: '校正检查点', type: 'checkpoint' },
    progress: { completed: 1, total: 3 },
    return: {
      label: '返回学习路径',
      href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-correction-1&nodeId=checkpoint-1',
    },
    pathStatus: 'active',
    nextAction: {
      state: 'blocked',
      nodeId: 'checkpoint-1',
      title: '校正检查点',
      type: 'checkpoint',
      href: null,
      reason: '当前检查点结果未通过。',
      recovery: {
        label: '返回学习路径',
        href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-correction-1&nodeId=checkpoint-1',
      },
    },
    correction,
  };
}

async function verifyNoHorizontalOverflow(page: import('@playwright/test').Page, viewportName: string) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth, `${viewportName} must not overflow horizontally`).toBe(geometry.clientWidth);
}

async function capture(
  page: import('@playwright/test').Page,
  viewport: typeof viewports[number],
  fixture: 'failed-checkpoint' | 'recorded-deviation',
) {
  await verifyNoHorizontalOverflow(page, viewport.name);
  if (!updateEvidence) return;
  mkdirSync(evidenceDir, { recursive: true });
  const filename = `${fixture}-${viewport.name}.png`;
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

test.describe.configure({ mode: 'serial' });

test('evidence manifest fails closed when generator or production source changes', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    commitSha?: string;
    generator?: { file?: string; sha256?: string };
    productionSourceSha256?: Record<string, string>;
    assertions?: Array<{ passed?: boolean }>;
    screenshots?: Array<{ file: string; sha256: string; noHorizontalOverflow?: boolean }>;
  };
  expect(manifest.commitSha).toMatch(/^[0-9a-f]{40}$/);
  expect(hasWorkingTreeSourceDrift(), 'tracked evidence sources must match HEAD').toBe(false);
  expect(manifest.generator?.file).toBe(generatorFile);
  expect(manifest.generator?.sha256).toBe(sourceHashAtCommit(manifest.commitSha!, generatorFile));
  expect(sourceHashAtCommit('HEAD', generatorFile)).toBe(manifest.generator?.sha256);
  for (const file of productionSourceFiles) {
    const expectedHash = manifest.productionSourceSha256?.[file];
    expect(expectedHash, `${file} production source hash missing or stale`).toBe(sourceHashAtCommit(manifest.commitSha!, file));
    expect(sourceHashAtCommit('HEAD', file), `${file} changed after the evidence checkpoint`).toBe(expectedHash);
  }
  expect(manifest.assertions?.length).toBe(4);
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
  for (const fixture of ['failed-checkpoint', 'recorded-deviation'] as const) {
    test(`${viewport.name} verifies ${fixture} correction state`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.route(/\/api\/learning-paths\/[^/]+\/journey(?:\?|$)/, async (route) => {
        await route.fulfill({ json: { journey: createJourney(fixture) } });
      });
      await page.goto(routeFor(fixture), { waitUntil: 'domcontentloaded' });

      if (fixture === 'failed-checkpoint') {
        const unavailable = page.locator('[data-adaptive-path-correction="unavailable"]');
        await expect(unavailable).toBeVisible({ timeout: 30_000 });
        await expect(unavailable).toContainText('当前路径未提供可核验的补救关系');
        await expect(page.locator('[data-adaptive-path-correction="available"]')).toHaveCount(0);
        await expect(page.getByRole('button', { name: /确认方案|应用方案|拒绝方案/ })).toHaveCount(0);
      } else {
        const correction = page.locator('[data-adaptive-path-correction="available"]');
        await expect(correction).toBeVisible({ timeout: 30_000 });
        await correction.locator('summary').click();
        await expect(correction).toContainText('路径执行记录显示该节点已被跳过');
        await expect(correction).toContainText('当前未完成路径');
        await expect(correction).toContainText('建议顺序');
        await expect(correction).toContainText('本方案仅供查看，尚未应用到当前学习路径。');
        await expect(page.getByRole('button', { name: /确认方案|应用方案|拒绝方案/ })).toHaveCount(0);
      }

      await capture(page, viewport, fixture);
      assertions.push({
        viewport: viewport.name,
        fixture,
        passed: true,
        checks: fixture === 'failed-checkpoint'
          ? ['failed checkpoint is unavailable without a verifiable remediation relationship', 'no proposal rendered', 'no apply interaction', 'no horizontal overflow']
          : ['recorded deviation renders a reliable proposal', 'original path remains a read-only comparison', 'no apply interaction', 'no horizontal overflow'],
      });
    });
  }
}

test.afterAll(() => {
  if (!updateEvidence) return;
  expect(assertions).toHaveLength(4);
  expect(screenshots).toHaveLength(4);
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
    routes: ['failed-checkpoint', 'recorded-deviation'].flatMap((fixture) => [
      routeFor(fixture as 'failed-checkpoint' | 'recorded-deviation'),
    ]),
    assertions,
    screenshots,
  }, null, 2)}\n`, 'utf8');
});
