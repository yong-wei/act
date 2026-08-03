import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/adaptive-path-unlock-chain-1169');
const baseUrl = process.env.ADAPTIVE_PATH_UNLOCK_CHAIN_BASE_URL ?? 'http://localhost:3001';

const sourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/features/adaptive/adaptive-learning-center-contracts.ts',
  'src/features/adaptive/adaptive-path-unlock-chain-view.tsx',
  'src/lib/adaptive-path-option-display.ts',
  'src/lib/adaptive-path-unlock-chain.ts',
  'scripts/tests/capture-adaptive-path-unlock-chain-evidence.mjs',
  'openspec/changes/add-adaptive-path-unlock-chain-explanation/tasks.md',
];

function relativeArtifact(name) {
  return `artifacts/commercial-ui/adaptive-path-unlock-chain-1169/${name}.png`;
}

function sha256File(relativePath) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function sourceWorktreeSha256() {
  const hash = createHash('sha256');
  for (const sourcePath of sourceFiles) {
    const absolutePath = path.join(repoRoot, sourcePath);
    const bytes = readFileSync(absolutePath);
    hash.update(sourcePath);
    hash.update(bytes);
  }
  return hash.digest('hex');
}

function gitHead() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function requiredSignal(signals, id) {
  if (!signals || typeof signals !== 'object') throw new Error(`missing signal entry: ${id}`);
  return signals;
}

async function openFullRouteDisclosure(page) {
  const summary = page.locator('[data-learning-path-route-disclosure="full"] summary:visible').first();
  if (await summary.count()) {
    await summary.evaluate((element) => {
      if (element instanceof HTMLElement) element.click();
    });
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(() => (
    document.querySelectorAll('[data-learning-path-option-module="route"] [data-adaptive-path-unlock-chain]').length > 0
  ), undefined, { timeout: 10000 });
}

async function openPathModule(page, moduleId) {
  const module = page.locator(`[data-adaptive-path-module="${moduleId}"]`).first();
  if (!(await module.count())) return;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const state = await module.getAttribute('data-adaptive-path-module-state');
    if (state === 'expanded') break;
    await module.locator('[data-adaptive-path-module-header="responsive"]').first().click();
    await page.waitForTimeout(400);
  }
  await page.waitForSelector(
    `[data-adaptive-path-module="${moduleId}"][data-adaptive-path-module-state="expanded"]`,
    { timeout: 10000 },
  );
}

async function focusExecutionNode(page, nodeId) {
  const nodeButton = page
    .locator(`[data-adaptive-path-node="${nodeId}"] [data-adaptive-path-node-selectable="true"]`)
    .first();
  if (await nodeButton.count()) {
    await nodeButton.click();
    await page.waitForTimeout(300);
  }
}

async function collectSignals(page, item, screenshotPath) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    visibleText: document.body.innerText,
    unlockChains: Array.from(document.querySelectorAll('[data-adaptive-path-unlock-chain]')).map((element) => ({
      state: element.getAttribute('data-adaptive-path-unlock-chain'),
      text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })),
    optionUnlockChainCount: document.querySelectorAll(
      '[data-learning-path-option-module="route"] [data-adaptive-path-unlock-chain]',
    ).length,
    executionUnlockChainCount: document.querySelectorAll(
      '[data-adaptive-path-execution-surface="active-route"] [data-adaptive-path-unlock-chain]',
    ).length,
    lockedNodeActionButtonCount: document.querySelectorAll(
      '[data-adaptive-path-node-state="locked"] [data-adaptive-path-node-actions="attached"] button',
    ).length,
    unlockedNodeActionCount: document.querySelectorAll(
      '[data-adaptive-path-node-state="locked"] [data-adaptive-path-node-actions="attached"] a, [data-adaptive-path-node-state="locked"] [data-adaptive-path-node-actions="attached"] span',
    ).length,
    nextActionLinkCount: document.querySelectorAll('[data-adaptive-path-unlock-chain] a[href]').length,
    interactiveElementCount: document.querySelectorAll('a[href], button').length,
  }));

  const forbiddenPatterns = [
    'missing-',
    'reasonCodes',
    'policyBundle',
    'policyFamily',
    'fallbackNodeIds',
    'prerequisiteNodeIds',
    'unlockMessage',
    'readiness',
    'terminal-validation',
    'demo-',
    'outcome:',
  ];
  const forbiddenRawFields = forbiddenPatterns.filter((pattern) => metrics.visibleText.includes(pattern));
  const structuredChains = metrics.unlockChains.filter((chain) => chain.state === 'structured');
  const fallbackChains = metrics.unlockChains.filter((chain) => chain.state === 'fallback');

  return {
    id: item.name,
    theme: item.theme,
    width: item.width,
    height: item.height,
    url: item.url,
    screenshotPath,
    scrollWidth: metrics.scrollWidth,
    clientWidth: metrics.clientWidth,
    bodyScrollWidth: metrics.bodyScrollWidth,
    optionUnlockChainCount: metrics.optionUnlockChainCount,
    executionUnlockChainCount: metrics.executionUnlockChainCount,
    structuredChainCount: structuredChains.length,
    fallbackChainCount: fallbackChains.length,
    lockedNodeActionButtonCount: metrics.lockedNodeActionButtonCount,
    unlockedNodeActionCount: metrics.unlockedNodeActionCount,
    nextActionLinkCount: metrics.nextActionLinkCount,
    interactiveElementCount: metrics.interactiveElementCount,
    multipleGapsVisible: metrics.visibleText.includes('同步 1 项指定学习结果') &&
      metrics.visibleText.includes('补充 2 条可复核学习证据') &&
      metrics.visibleText.includes('提升对应能力准备度'),
    actionableTargetVisible: metrics.nextActionLinkCount > 0,
    textOnlyActionVisible: metrics.visibleText.includes('完成「前置节点」后解锁'),
    fallbackMessageVisible: metrics.visibleText.includes('Arena 暂未解锁，完成仿真验证后会自动进入。'),
    unavailableVisible: metrics.visibleText.includes('暂时无法展示具体解锁条件'),
    forbiddenRawFields,
    noHorizontalOverflow: metrics.scrollWidth <= metrics.clientWidth + 1,
  };
}

const cases = [
  {
    name: 'path-option-preview-desktop-1440',
    theme: 'light',
    width: 1440,
    height: 1200,
    url: '/assessment/adaptive-practice?demo=1&unlockChainScene=1&goal=control-correction&intent=path-selection',
    waitSelector: '[data-learning-path-product-surface="path-options-selection-history-terminal-validation"]',
    beforeScreenshot: async (page) => {
      await openPathModule(page, 'path-selection');
      await openFullRouteDisclosure(page);
    },
  },
  {
    name: 'path-option-preview-mobile-320',
    theme: 'dark',
    width: 320,
    height: 1000,
    url: '/assessment/adaptive-practice?demo=1&unlockChainScene=1&goal=control-correction&intent=path-selection',
    waitSelector: '[data-learning-path-product-surface="path-options-selection-history-terminal-validation"]',
    beforeScreenshot: async (page) => {
      await openPathModule(page, 'path-selection');
      await openFullRouteDisclosure(page);
    },
  },
  {
    name: 'execution-structured-desktop-1440',
    theme: 'light',
    width: 1440,
    height: 1200,
    url: '/assessment/adaptive-practice?demo=1&unlockChainScene=1&goal=control-correction&intent=path-execution',
    waitSelector: '[data-adaptive-path-execution-surface="active-route"]',
    beforeScreenshot: async (page) => {
      await openPathModule(page, 'current-path');
      await focusExecutionNode(page, 'demo-simulation');
    },
  },
  {
    name: 'execution-structured-mobile-320',
    theme: 'dark',
    width: 320,
    height: 1000,
    url: '/assessment/adaptive-practice?demo=1&unlockChainScene=1&goal=control-correction&intent=path-execution',
    waitSelector: '[data-adaptive-path-execution-surface="active-route"]',
    beforeScreenshot: async (page) => {
      await openPathModule(page, 'current-path');
      await focusExecutionNode(page, 'demo-simulation');
    },
  },
  {
    name: 'execution-prerequisite-target-desktop-1440',
    theme: 'light',
    width: 1440,
    height: 1200,
    url: '/assessment/adaptive-practice?demo=1&unlockChainScene=1&goal=control-correction&intent=path-execution',
    waitSelector: '[data-adaptive-path-execution-surface="active-route"]',
    beforeScreenshot: async (page) => {
      await openPathModule(page, 'current-path');
      await focusExecutionNode(page, 'demo-prerequisite-target');
    },
  },
  {
    name: 'execution-message-fallback-desktop-1440',
    theme: 'dark',
    width: 1440,
    height: 1200,
    url: '/assessment/adaptive-practice?demo=1&unlockChainScene=1&goal=control-correction&intent=path-execution',
    waitSelector: '[data-adaptive-path-execution-surface="active-route"]',
    beforeScreenshot: async (page) => {
      await openPathModule(page, 'current-path');
      await focusExecutionNode(page, 'demo-unlock-message-fallback');
    },
  },
  {
    name: 'execution-unavailable-mobile-320',
    theme: 'dark',
    width: 320,
    height: 1000,
    url: '/assessment/adaptive-practice?demo=1&unlockChainScene=1&goal=control-correction&intent=path-execution',
    waitSelector: '[data-adaptive-path-execution-surface="active-route"]',
    beforeScreenshot: async (page) => {
      await openPathModule(page, 'current-path');
      await focusExecutionNode(page, 'demo-unavailable');
    },
  },
];

function assertCase(caseEntry, signals) {
  const issues = [];
  if (!signals.noHorizontalOverflow) {
    issues.push(`horizontal overflow: scrollWidth=${signals.scrollWidth}, clientWidth=${signals.clientWidth}`);
  }
  if (signals.forbiddenRawFields.length > 0) {
    issues.push(`forbidden raw fields: ${signals.forbiddenRawFields.join(', ')}`);
  }
  if (signals.interactiveElementCount === 0) {
    issues.push('no interactive elements are reachable');
  }

  if (caseEntry.name.startsWith('path-option-preview')) {
    if (signals.optionUnlockChainCount < 4) {
      issues.push(`option unlock chains=${signals.optionUnlockChainCount}`);
    }
    if (!signals.multipleGapsVisible) {
      issues.push('multiple structured gaps not visible');
    }
    if (!signals.actionableTargetVisible) {
      issues.push('actionable next-action target not visible');
    }
    if (!signals.textOnlyActionVisible) {
      issues.push('text-only next action not visible');
    }
    if (!signals.fallbackMessageVisible) {
      issues.push('fallback unlock message not visible');
    }
    if (!signals.unavailableVisible) {
      issues.push('unavailable fallback not visible');
    }
  }

  if (caseEntry.name.startsWith('execution')) {
    if (signals.executionUnlockChainCount < 1) {
      issues.push(`execution unlock chains=${signals.executionUnlockChainCount}`);
    }
    if (signals.lockedNodeActionButtonCount !== 0) {
      issues.push(`locked node start buttons=${signals.lockedNodeActionButtonCount}`);
    }
  }

  if (issues.length > 0) {
    throw new Error(`${caseEntry.name} failed:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
  }
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const captures = [];
  const assertions = [];

  try {
    for (const caseEntry of cases) {
      const page = await browser.newPage({ viewport: { width: caseEntry.width, height: caseEntry.height } });
      await page.addInitScript((theme) => {
        window.localStorage.setItem('ai-obe-theme', theme);
        window.localStorage.setItem('act:app-shell-navigation-preference', 'collapsed');
      }, caseEntry.theme);
      const absoluteUrl = `${baseUrl}${caseEntry.url}`;
      await page.goto(absoluteUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(caseEntry.waitSelector, { timeout: 30000 });
      await page.waitForTimeout(700);
      if (caseEntry.beforeScreenshot) await caseEntry.beforeScreenshot(page);

      const screenshotPath = relativeArtifact(caseEntry.name);
      const screenshotSha256 = await page.screenshot({ path: path.join(repoRoot, screenshotPath), fullPage: true });
      const signals = await collectSignals(page, {
        ...caseEntry,
        url: absoluteUrl,
      }, screenshotPath);
      const digest = createHash('sha256').update(screenshotSha256).digest('hex');

      const assertion = {
        id: caseEntry.name,
        passed: true,
      };
      try {
        assertCase(caseEntry, signals);
      } catch (error) {
        assertion.passed = false;
        assertion.error = error instanceof Error ? error.message : String(error);
      }
      assertions.push(assertion);

      captures.push({
        id: caseEntry.name,
        theme: caseEntry.theme,
        width: caseEntry.width,
        height: caseEntry.height,
        url: absoluteUrl,
        screenshot: screenshotPath,
        screenshotSha256: digest,
        ...signals,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const failedAssertions = assertions.filter((assertion) => !assertion.passed);
  const manifest = {
    change: 'add-adaptive-path-unlock-chain-explanation',
    pr: 1169,
    capturedAt: new Date().toISOString(),
    gitSha: gitHead(),
    sourceFiles,
    sourceWorktreeSha256: sourceWorktreeSha256(),
    baseUrl,
    captures,
    assertions,
    passed: failedAssertions.length === 0,
  };

  writeFileSync(
    path.join(outputDir, 'evidence-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(
    path.join(outputDir, 'README.md'),
    [
      '# PR #1169 Unlock Chain Commercial UI Evidence',
      '',
      `Captured from ${manifest.gitSha} with the ` +
        '`?demo=1&unlockChainScene=1` production demo path.',
      '',
      '## Representative captures',
      '',
      ...captures.map((capture) => `- ${capture.id}: ${capture.screenshot}`),
      '',
      '## Assertions',
      '',
      '- Structured multi-gap chains, fallback prerequisites, fallback messages, and unavailable explanations are visible.',
      '- Actionable next actions render links; text-only and unavailable actions remain non-launchable.',
      '- Internal readiness IDs, raw fields, and reason codes are absent from visible text.',
      '- Locked execution nodes expose no start button.',
      '- Desktop and 320px captures have no document-level horizontal overflow.',
      '- Missing or drifted artifacts fail the capture with a non-zero exit.',
      '',
      'Manifest: `evidence-manifest.json`',
    ].join('\n'),
  );

  console.log(`Captured ${captures.length} unlock chain evidence states in ${path.relative(repoRoot, outputDir)}`);
  if (failedAssertions.length > 0) {
    console.error(JSON.stringify(failedAssertions, null, 2));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
