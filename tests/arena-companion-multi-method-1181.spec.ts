import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const captureEvidence = process.env.ISSUE_1181_CAPTURE_EVIDENCE === '1';
const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/issue-1181-multi-method-companion/playwright');
const generatorPath = 'tests/arena-companion-multi-method-1181.spec.ts';
const sourceFiles = [
  'src/features/ai/companion/ai-companion-panel.tsx',
  'src/features/ai/companion/arena-companion-context.ts',
  'src/features/ai/companion/intervention-engine.ts',
  'src/features/control-workbench/shell/control-workbench-shell.tsx',
  'src/app/api/ai/intervention/generate/route.ts',
  'src/lib/konling-agent-runtime.ts',
] as const;

type ScreenshotRecord = {
  path: string;
  sha256: string;
  viewport: { width: number; height: number };
  scenario: string;
  overflowMetrics: {
    innerWidth: number;
    bodyScrollWidth: number;
    documentScrollWidth: number;
  };
};

type CaptureState = {
  sourceRevision: string;
  generatorSha256: string;
  sourceHashes: Record<string, string>;
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

function repositoryPath(path: string): string {
  return relative(process.cwd(), path).replaceAll('\\', '/');
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
    const worktreeBlob = git(['hash-object', '--path', path, path]).toString('utf8').trim();
    const committedBlob = git(['rev-parse', `HEAD:${path}`]).toString('utf8').trim();
    if (worktreeBlob !== committedBlob) {
      throw new Error(`capture source drift: ${path}`);
    }
    return [path, worktreeBlob];
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

function assertOnlyExpectedEvidenceChanges(expectedPaths: readonly string[]): void {
  const expected = new Set(expectedPaths);
  const statusLines = git(['status', '--porcelain', '--untracked-files=all'])
    .toString('utf8')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const unexpected = statusLines.filter((line) => (
    line.slice(0, 2) !== '??' || !expected.has(line.slice(3))
  ));
  if (unexpected.length > 0 || statusLines.length !== expected.size) {
    throw new Error(`capture changed unexpected paths: ${statusLines.join(' | ')}`);
  }
}

function assertScreenshotBundle(screenshots: readonly ScreenshotRecord[]): void {
  const actualNames = readdirSync(evidenceDir)
    .filter((name) => name.endsWith('.png'))
    .sort();
  const expectedNames = screenshots
    .map((screenshot) => screenshot.path.split('/').pop()!)
    .sort();
  if (actualNames.length !== 6 || JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`expected six screenshots, got ${actualNames.join(', ')}`);
  }
  for (const screenshot of screenshots) {
    const absolutePath = join(process.cwd(), screenshot.path);
    if (sha256(readFileSync(absolutePath)) !== screenshot.sha256) {
      throw new Error(`evidence screenshot hash changed: ${screenshot.path}`);
    }
  }
}

async function readOverflowMetrics(page: Page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
}

async function recordPracticeAndGenerate(
  page: Page,
  expectedTaskId: string,
  expectedMethod: string,
  requests: unknown[],
) {
  const panel = page.locator('[aria-label="AI伴随探究"]');
  await panel.getByRole('radio', { name: '失败', exact: true }).check();
  await panel.getByRole('button', { name: '记录练习', exact: true }).click();
  const generate = panel.getByRole('button', { name: '生成介入建议', exact: true });
  await generate.focus();
  await expect(generate).toBeFocused();
  const requestCount = requests.length;
  await page.keyboard.press('Enter');
  await expect.poll(() => requests.length).toBe(requestCount + 1);
  expect(requests.at(-1)).toEqual(expect.objectContaining({
    arenaTaskId: expectedTaskId,
    method: expectedMethod,
  }));
  await expect(panel.getByText('介入判定：需要介入', { exact: false })).toBeVisible();
}

async function selectMethodAndWaitForField(
  methodSelect: ReturnType<Page['getByRole']>,
  panel: ReturnType<Page['locator']>,
  method: string,
  expectedField: string,
) {
  await expect(async () => {
    await methodSelect.selectOption(method);
    await expect(methodSelect).toHaveValue(method);
    await expect(panel.getByText(expectedField, { exact: true })).toBeVisible();
  }).toPass({ timeout: 30_000 });
}

test.describe.configure({ timeout: 180_000, mode: 'serial' });

test('Issue 1181 captures task-aware companion guidance across representative control methods', async ({ page }) => {
  const captureState = captureEvidence ? prepareCapture() : null;
  const screenshots: ScreenshotRecord[] = [];
  const requests: unknown[] = [];
  const domAssertions: Record<string, Record<string, boolean>> = {};

  try {
    if (captureEvidence) {
      rmSync(evidenceDir, { recursive: true, force: true });
    }
    await page.route('**/api/ai/intervention/generate', async (route) => {
      requests.push(JSON.parse(route.request().postData() ?? '{}'));
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          decision: {
            shouldIntervene: true,
            reason: 'fixture-risk',
            interventionType: 'constraint-hint',
          },
          intervention: {
            feedbackType: 'constraint-hint',
            content: '这是当前练习记录的建议。',
            suggestedNextSteps: ['比较本轮参数与指标。'],
            relatedConcepts: ['控制方法'],
            highlightParams: [],
            showTrendPrediction: true,
          },
          interventionId: 'issue-1181-browser-fixture',
          canSubmitFeedback: false,
        }),
      });
    });

    const scenarios = [
      {
        id: 'multi-method',
        taskId: 'task-second-order-lead-pid',
        initialMethod: 'pid',
        selectedMethod: 'serial-compensator',
        expectedParameter: '校正增益',
        expectedMetric: '调节时间(s)',
      },
      {
        id: 'mpc',
        taskId: 'task-ship-roll-mpc-hidden-scenarios',
        selectedMethod: 'mpc',
        expectedParameter: '预测时域',
        expectedMetric: '隐藏场景最差表现',
      },
      {
        id: 'black-box',
        taskId: 'task-cruise-roll-blackbox-identification',
        selectedMethod: 'black-box-control',
        expectedParameter: '辨识质量',
        expectedMetric: '最差场景偏差',
      },
    ] as const;

    for (const scenario of scenarios) {
      domAssertions[scenario.id] = {};
      for (const viewport of [{ width: 1440, height: 1000 }, { width: 320, height: 900 }]) {
        await page.setViewportSize(viewport);
        await page.goto(`/interactive-learning/control-workbench?arenaTask=${scenario.taskId}`, {
          waitUntil: 'domcontentloaded',
        });

        const panel = page.locator('[aria-label="AI伴随探究"]');
        await expect(panel).toBeVisible();
        if ('initialMethod' in scenario) {
          const methodSelect = panel.getByRole('combobox', { name: '当前控制方法', exact: true });
          await expect(methodSelect).toBeVisible();
          await methodSelect.focus();
          await expect(methodSelect).toBeFocused();
          await selectMethodAndWaitForField(methodSelect, panel, scenario.initialMethod, 'Kp');
          await selectMethodAndWaitForField(
            methodSelect,
            panel,
            scenario.selectedMethod,
            scenario.expectedParameter,
          );
          await expect(panel.getByText('Kp', { exact: true })).toHaveCount(0);
          domAssertions[scenario.id]![`methodSwitch:${viewport.width}`] = true;
        } else {
          await expect(panel.getByRole('combobox', { name: '当前控制方法', exact: true })).toHaveCount(0);
          domAssertions[scenario.id]![`singleMethod:${viewport.width}`] = true;
        }

        await expect(panel.getByText(scenario.expectedParameter, { exact: true })).toBeVisible();
        await expect(panel.getByText(scenario.expectedMetric, { exact: true })).toBeVisible();
        await recordPracticeAndGenerate(page, scenario.taskId, scenario.selectedMethod, requests);
        const overflowMetrics = await readOverflowMetrics(page);
        expect(overflowMetrics.bodyScrollWidth).toBeLessThanOrEqual(overflowMetrics.innerWidth);
        expect(overflowMetrics.documentScrollWidth).toBeLessThanOrEqual(overflowMetrics.innerWidth);
        expect(await page.locator('body').innerText()).not.toContain('undefined');

        domAssertions[scenario.id]![`panelVisible:${viewport.width}`] = true;
        domAssertions[scenario.id]![`methodSpecificFields:${viewport.width}`] = true;
        domAssertions[scenario.id]![`generateRequest:${viewport.width}`] = true;
        domAssertions[scenario.id]![`keyboardFocus:${viewport.width}`] = true;
        domAssertions[scenario.id]![`noHorizontalOverflow:${viewport.width}`] = true;

        if (captureState) {
          mkdirSync(evidenceDir, { recursive: true });
          const screenshotPath = join(evidenceDir, `${scenario.id}-${viewport.width}x${viewport.height}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          screenshots.push({
            path: repositoryPath(screenshotPath),
            sha256: sha256(readFileSync(screenshotPath)),
            viewport,
            scenario: scenario.id,
            overflowMetrics,
          });
        }
      }
    }

    if (captureState) {
      const captureAfterHead = currentHead();
      if (captureAfterHead !== captureState.sourceRevision) {
        throw new Error('capture HEAD changed during browser verification');
      }
      const finalHashes = readSourceHashes(captureAfterHead);
      if (finalHashes.generatorSha256 !== captureState.generatorSha256
        || JSON.stringify(finalHashes.sourceHashes) !== JSON.stringify(captureState.sourceHashes)) {
        throw new Error('capture source hashes changed during browser verification');
      }
      const manifestPath = join(evidenceDir, 'manifest.json');
      writeFileSync(manifestPath, `${JSON.stringify({
        status: 'passed',
        capturedAt: new Date().toISOString(),
        generatorPath,
        generatorSha256: captureState.generatorSha256,
        sourceRevision: captureState.sourceRevision,
        sourceFiles: finalHashes.sourceHashes,
        route: '/interactive-learning/control-workbench',
        scenarios: scenarios.map((scenario) => ({
          id: scenario.id,
          taskId: scenario.taskId,
          selectedMethod: scenario.selectedMethod,
        })),
        captureBeforeHead: captureState.sourceRevision,
        captureAfterHead,
        screenshots,
        requestCount: requests.length,
        domAssertions,
      }, null, 2)}\n`);
      assertScreenshotBundle(screenshots);
      assertOnlyExpectedEvidenceChanges([
        ...screenshots.map((screenshot) => screenshot.path),
        repositoryPath(manifestPath),
      ]);
    }
  } catch (error) {
    if (captureEvidence) rmSync(evidenceDir, { recursive: true, force: true });
    throw error;
  }
});
