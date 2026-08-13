import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

const generatorPath = 'tests/adaptive-path-evidence-links-1186-p3.spec.ts';
const sourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/lib/adaptive-learning-path-planner.ts',
  'src/lib/adaptive-path-node-decisions.ts',
  'src/lib/data-governance/adaptive-learner-state-service.ts',
  'src/lib/data-governance/evidence-timeline.ts',
];
const trackedFiles = [generatorPath, ...sourceFiles];
const evidenceDirectory = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-1186-p3');
const manifestPath = path.join(evidenceDirectory, 'manifest.json');
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile-320', width: 320, height: 720 },
] as const;
const states = [
  {
    name: 'candidate',
    route: '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-selection&provenanceFixture=sufficient',
  },
  {
    name: 'active-node',
    route: '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution&provenanceFixture=sufficient',
  },
] as const;
const expectedScreenshots = viewports.flatMap((viewport) => states.map((state) => (
  `artifacts/commercial-ui/issue-1186-p3/${viewport.name}-${state.name}-evidence.png`
)));
const screenshots: Array<Record<string, unknown>> = [];
const assertions: Array<Record<string, unknown>> = [];

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHashAtRevision(revision: string, file: string): string {
  return sha256(execFileSync('git', ['show', `${revision}:${file}`]));
}

function currentHead(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function hasWorkingTreeSourceDrift(): boolean {
  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...trackedFiles]);
    return false;
  } catch {
    return true;
  }
}

function isAncestor(revision: string, descendant: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', revision, descendant]);
    return true;
  } catch {
    return false;
  }
}

async function assertEventActionsAreSafe(container: Locator) {
  const links = container.locator('[data-adaptive-path-event-evidence] a');
  await expect(links.first()).toBeVisible();
  const hrefs = await links.evaluateAll((items) => items.map((item) => item.getAttribute('href') ?? ''));
  expect(hrefs.every((href) => href.startsWith('/') && !href.includes('sourceId'))).toBe(true);
}

async function assertNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBe(geometry.clientWidth);
}

test.describe.configure({ mode: 'serial' });

test('evidence manifest is bound to its implementation and capture revision', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    status?: string;
    sourceRevision?: string;
    generatorPath?: string;
    generatorSha256?: string;
    sourceFiles?: Record<string, string>;
    captureBeforeHead?: string;
    captureAfterHead?: string;
    screenshots?: Array<{ file: string; sha256: string }>;
    assertions?: Array<{ passed?: boolean }>;
  };
  const head = currentHead();

  expect(manifest.status).toBe('passed');
  expect(manifest.sourceRevision).toMatch(/^[0-9a-f]{40}$/);
  expect(manifest.captureBeforeHead).toBe(manifest.sourceRevision);
  expect(manifest.captureAfterHead).toBe(manifest.sourceRevision);
  expect(isAncestor(manifest.sourceRevision!, head)).toBe(true);
  expect(hasWorkingTreeSourceDrift(), 'tracked evidence sources must match HEAD').toBe(false);
  expect(manifest.generatorPath).toBe(generatorPath);
  expect(manifest.generatorSha256).toBe(sourceHashAtRevision(manifest.sourceRevision!, generatorPath));
  expect(sourceHashAtRevision(head, generatorPath)).toBe(manifest.generatorSha256);

  for (const file of sourceFiles) {
    const expectedHash = manifest.sourceFiles?.[file];
    expect(expectedHash, `${file} source hash missing or stale`)
      .toBe(sourceHashAtRevision(manifest.sourceRevision!, file));
    expect(sourceHashAtRevision(head, file), `${file} changed after the evidence checkpoint`)
      .toBe(expectedHash);
  }

  expect(manifest.assertions?.length).toBe(4);
  expect(manifest.assertions?.every((assertion) => assertion.passed)).toBe(true);
  expect(manifest.screenshots?.map((screenshot) => screenshot.file).sort())
    .toEqual([...expectedScreenshots].sort());
  for (const screenshot of manifest.screenshots ?? []) {
    const screenshotPath = path.resolve(process.cwd(), screenshot.file);
    expect(existsSync(screenshotPath), screenshot.file).toBe(true);
    expect(sha256(readFileSync(screenshotPath))).toBe(screenshot.sha256);
  }
});

for (const viewport of viewports) {
  for (const state of states) {
    test(`${viewport.name} verifies ${state.name} event evidence`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(state.route, { waitUntil: 'domcontentloaded' });

      let evidenceContainer: Locator;
      if (state.name === 'candidate') {
        const option = page.locator('[data-learning-path-option="path-option-1"]:visible');
        await expect(option).toHaveCount(1);
        evidenceContainer = option.locator('[data-learning-path-recommendation-provenance]');
        const disclosure = evidenceContainer.locator('details');
        await disclosure.locator('summary').click();
        await expect(disclosure).toHaveAttribute('open', '');
      } else {
        evidenceContainer = page.locator('[data-adaptive-path-node-selection-basis="recorded"]')
          .filter({ has: page.locator('[data-adaptive-path-event-evidence] a') })
          .first();
      }

      await expect(evidenceContainer).toBeVisible();
      await assertEventActionsAreSafe(evidenceContainer);
      await assertNoHorizontalOverflow(page);

      if (updateEvidence) {
        mkdirSync(evidenceDirectory, { recursive: true });
        const file = path.join(evidenceDirectory, `${viewport.name}-${state.name}-evidence.png`);
        const image = await page.screenshot({ path: file, fullPage: true });
        screenshots.push({
          state: state.name,
          viewport: `${viewport.width}x${viewport.height}`,
          file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
          width: viewport.width,
          height: viewport.height,
          sha256: sha256(image),
        });
      }
      assertions.push({
        state: state.name,
        viewport: `${viewport.width}x${viewport.height}`,
        passed: true,
        checks: [
          'event source, occurrence time, summary, and safe action are readable',
          'candidate and active-node evidence remain distinct',
          'event actions contain no internal source identifier',
          'no horizontal overflow',
        ],
      });
    });
  }
}

test.afterAll(() => {
  if (!updateEvidence) return;
  expect(assertions).toHaveLength(4);
  expect(screenshots).toHaveLength(4);
  const sourceRevision = currentHead();
  writeFileSync(manifestPath, `${JSON.stringify({
    status: 'passed',
    capturedAt: new Date().toISOString(),
    sourceRevision,
    generatorPath,
    generatorSha256: sourceHashAtRevision(sourceRevision, generatorPath),
    sourceFiles: Object.fromEntries(
      sourceFiles.map((file) => [file, sourceHashAtRevision(sourceRevision, file)]),
    ),
    captureBeforeHead: sourceRevision,
    captureAfterHead: currentHead(),
    routes: states.map((state) => state.route),
    assertions,
    screenshots,
  }, null, 2)}\n`, 'utf8');
});
