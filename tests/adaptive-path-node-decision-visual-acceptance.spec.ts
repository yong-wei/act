import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const executionHref = '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution';
const generatorFile = 'tests/adaptive-path-node-decision-visual-acceptance.spec.ts';
const productionSourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
];
const trackedSourceFiles = [generatorFile, ...productionSourceFiles];
const evidenceDir = path.resolve(
  process.cwd(),
  'openspec/changes/explain-active-path-node-decisions/evidence/commercial-ui',
);
const manifestPath = path.join(evidenceDir, 'manifest.json');
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const;
const expectedScreenshotFiles = viewports.map((viewport) => path.posix.join(
  'openspec/changes/explain-active-path-node-decisions/evidence/commercial-ui',
  `${viewport.name}.png`,
));
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

test('evidence manifest fails closed when generator or production source changes', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    schemaVersion?: string;
    sourceRevision?: string;
    generator?: { file?: string; sha256?: string };
    productionSourceSha256?: Record<string, string>;
    screenshots?: Array<{ file: string; sha256: string; noHorizontalOverflow?: boolean }>;
    assertions?: Array<{ passed?: boolean }>;
  };
  expect(manifest.schemaVersion).toBe('commercial-ui-evidence.v1');
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
  expect(manifest.assertions).toHaveLength(viewports.length);
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
  const { width } = viewport;
  test(`node decisions remain usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 900 });
    await page.goto(`${executionHref}&nodeDecisionFixture=locked`, { waitUntil: 'domcontentloaded' });

    const execution = page.locator('[data-adaptive-path-execution-surface="active-route"]');
    const timeline = execution.locator('[data-adaptive-path-route-map="compact"]');
    const currentNode = timeline.locator('[data-adaptive-path-node="demo-current-quiz"]');
    await execution.waitFor({ state: 'visible' });
    await currentNode.waitFor({ state: 'visible' });
    const initialGeometry = await page.evaluate(() => {
      const executionSurface = document.querySelector('[data-adaptive-path-execution-surface="active-route"]');
      const current = document.querySelector('[data-adaptive-path-node="demo-current-quiz"]');
      return [executionSurface, current].map((element) => {
        const rect = element?.getBoundingClientRect();
        return rect ? { top: rect.top, bottom: rect.bottom } : null;
      });
    });
    expect(initialGeometry.every((rect) => rect && rect.top < (width === 1440 ? 1000 : 900) && rect.bottom > 0)).toBe(true);
    await currentNode.locator('[data-adaptive-path-node-selectable="true"]').click();
    await expect(currentNode.locator('[data-adaptive-path-node-selection-basis="recorded"]')).toContainText('入选依据');
    await expect(currentNode.locator('[data-adaptive-path-node-latest-adjustment="none"]')).toContainText('最近调整');
    await expect(currentNode.locator('[data-adaptive-path-node-actions="attached"]')).toBeVisible();

    const lockedNode = timeline.locator('[data-adaptive-path-node="demo-simulation"]');
    await expect(lockedNode.locator('[data-adaptive-path-node-status-badge="blocked"]')).toBeVisible();
    await lockedNode.locator('[data-adaptive-path-node-selectable="true"]').click();
    await expect(lockedNode.locator('[data-adaptive-path-node-current-lock="governed"]')).toContainText(
      '完成检查题后会自动解锁仿真验证。',
    );
    await expect(lockedNode.locator('[data-adaptive-path-node-selection-basis="recorded"]')).toBeVisible();

    const geometry = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      decisionRects: Array.from(document.querySelectorAll<HTMLElement>(
        '[data-adaptive-path-node-selection-basis], [data-adaptive-path-node-latest-adjustment], [data-adaptive-path-node-current-lock]',
      )).map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
      }),
    }));
    expect(geometry.documentScrollWidth).toBe(geometry.documentClientWidth);
    for (const rect of geometry.decisionRects) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(rect.scrollWidth).toBeLessThanOrEqual(rect.clientWidth);
    }

    if (updateEvidence) {
      mkdirSync(evidenceDir, { recursive: true });
    }
    const image = await page.screenshot({
      path: updateEvidence
        ? path.join(evidenceDir, `${viewport.name}.png`)
        : testInfo.outputPath(`node-decisions-${width}.png`),
      fullPage: false,
    });
    assertions.push({
      viewport: viewport.name,
      route: `${executionHref}&nodeDecisionFixture=locked`,
      passed: true,
      checks: [
        'blocked node retains governed readiness lock explanation',
        'recorded selection evidence remains visible',
        'attached node actions remain reachable',
        'no horizontal overflow',
      ],
    });
    if (updateEvidence) {
      screenshots.push({
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        route: `${executionHref}&nodeDecisionFixture=locked`,
        file: path.posix.join(
          'openspec/changes/explain-active-path-node-decisions/evidence/commercial-ui',
          `${viewport.name}.png`,
        ),
        sha256: sha256(image),
        noHorizontalOverflow: true,
      });
    }
  });
}

test('legacy, completed, and skipped nodes keep explicit decision states', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`${executionHref}&provenanceFixture=legacy`, { waitUntil: 'domcontentloaded' });

  let timeline = page.locator('[data-adaptive-path-route-map="compact"]');
  const currentNode = timeline.locator('[data-adaptive-path-node="demo-current-quiz"]');
  await currentNode.locator('[data-adaptive-path-node-selectable="true"]').click();
  await expect(currentNode.locator('[data-adaptive-path-node-selection-basis="unavailable"]')).toContainText(
    '该路径生成时尚未记录节点级入选依据',
  );

  const completedNode = timeline.locator('[data-adaptive-path-node="demo-foundation-card"]');
  await completedNode.locator('[data-adaptive-path-node-selectable="true"]').click();
  await expect(completedNode).toContainText('已完成');
  await expect(completedNode.locator('[data-adaptive-path-node-selection-basis="unavailable"]')).toBeVisible();

  await page.goto(executionHref, { waitUntil: 'domcontentloaded' });
  timeline = page.locator('[data-adaptive-path-route-map="compact"]');
  const skippedNode = timeline.locator('[data-adaptive-path-node="demo-simulation"]');
  await skippedNode.locator('[data-adaptive-path-node-selectable="true"]').click();
  await expect(skippedNode).toContainText('已跳过');
  await expect(skippedNode.locator('[data-adaptive-path-node-selection-basis="recorded"]')).toBeVisible();
  await expect(skippedNode.locator('[data-adaptive-path-node-current-lock="governed"]')).toHaveCount(0);
});

test.afterAll(() => {
  if (!updateEvidence || assertions.length !== viewports.length || screenshots.length !== viewports.length) return;
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 'commercial-ui-evidence.v1',
    capturedAt: new Date().toISOString(),
    sourceRevision,
    generator: { file: generatorFile, sha256: sourceHashAtCommit(sourceRevision, generatorFile) },
    productionSourceSha256: Object.fromEntries(
      productionSourceFiles.map((file) => [file, sourceHashAtCommit(sourceRevision, file)]),
    ),
    assertions,
    screenshots,
  }, null, 2)}\n`, 'utf8');
});
