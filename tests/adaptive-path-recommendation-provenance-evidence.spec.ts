import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3002';
const generatorFile = 'tests/adaptive-path-recommendation-provenance-evidence.spec.ts';
const productionSourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/features/adaptive/adaptive-learning-center-contracts.ts',
  'src/lib/adaptive-learning-path-planner.ts',
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
const expectedScreenshotFiles = viewports.flatMap((viewport) => fixtures.map((fixture) => (
  path.posix.join(
    'artifacts/commercial-ui/adaptive-path-recommendation-provenance-1186',
    `${viewport.name}-${fixture}.png`,
  )
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
  fixture: typeof fixtures[number],
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
  expect(manifest.assertions?.length).toBe(6);
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
        }
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
              'no horizontal overflow',
            ],
      });
    });
  }
}

test.afterAll(() => {
  if (!updateEvidence) return;
  expect(assertions).toHaveLength(6);
  expect(screenshots).toHaveLength(6);
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
    routes: fixtures.map(routeFor),
    assertions,
    screenshots,
  }, null, 2)}\n`, 'utf8');
});
