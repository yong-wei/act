import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

const repoRoot = path.resolve(__dirname, '../..');
const DEFAULT_DOCK_READY_TIMEOUT_MS = 30_000;
const DEFAULT_DOCK_POLL_INTERVAL_MS = 50;
export const DOCK_SELECTOR = '[data-platform-floating-dock]';
export const PRIMARY_KONLING_SELECTOR =
  '[data-platform-floating-dock] button[data-platform-floating-dock-primary="konling"]';
export const DOCK_REGISTRATION_SELECTOR = '[data-platform-floating-dock-registration="true"]';
export const CAPTURE_SOURCE_FILES = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/components/platform/app-shell.tsx',
  'src/components/shared/page-floating-controls.tsx',
  'scripts/tests/capture-adaptive-path-product-qa.ts',
] as const;

type Theme = 'light' | 'dark';
type CaptureState = {
  name: string;
  theme: Theme;
  width: number;
  height: number;
  query: string;
  selector?: string;
  beforeScreenshot?: (page: Page) => Promise<void>;
};

export type CaptureRevision = {
  commitSha: string;
  treeSha: string;
  sourceFiles: Record<string, string>;
};

export type DockReadinessSnapshot = {
  targetUrl: string;
  actualUrl: string;
  dockPresent: boolean;
  dockVisible: boolean;
  dockState: string | null;
  registrationPresent: boolean;
  registrationBehavior: string | null;
  registeredControls: string | null;
  primaryPresent: boolean;
  primaryVisible: boolean;
  primaryDisabled: boolean;
  primaryLabel: string | null;
  missingSelectors: string[];
};

type DockReadinessWaitOptions = {
  targetUrl: string;
  actualUrl: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

function gitOutput(repositoryRoot: string, args: string[]) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitBlob(repositoryRoot: string, revision: string, relativePath: string) {
  return execFileSync('git', ['show', `${revision}:${relativePath}`], {
    cwd: repositoryRoot,
    encoding: null,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function pathIsWithin(candidate: string, parent: string) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function untrackedOrModifiedPaths(repositoryRoot: string, ignoredPaths: readonly string[]) {
  const status = gitOutput(repositoryRoot, ['status', '--porcelain', '--untracked-files=all']);
  return status
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      const statusPath = line.slice(3).trim().replace(/^"|"$/gu, '');
      const absolutePath = path.resolve(repositoryRoot, statusPath);
      return !ignoredPaths.some((ignoredPath) => pathIsWithin(absolutePath, ignoredPath));
    });
}

export function resolveTargetBaseUrl(rawValue = process.env.ADAPTIVE_PATH_QA_BASE_URL) {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error(
      'ADAPTIVE_PATH_QA_BASE_URL is required; refusing to fall back to an implicit local service.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid adaptive-path QA target URL: ${value}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Adaptive-path QA target URL must use http or https: ${value}`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Adaptive-path QA target URL must not contain credentials, query, or hash.');
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/u, '');
  return parsed.toString().replace(/\/$/u, '');
}

export function resolveOutputDirectory(
  rawValue = process.env.ADAPTIVE_PATH_QA_OUTPUT_DIR,
  repositoryRoot = repoRoot,
) {
  const value = rawValue?.trim();
  if (!value) {
    return path.join(os.tmpdir(), `act-adaptive-path-product-qa-${process.pid}`);
  }
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(repositoryRoot, value);
}

export function assertSourcePathsExcludeOutput(
  sourceFiles: readonly string[],
  outputDirectory: string,
  repositoryRoot = repoRoot,
) {
  const outputAbsolutePath = path.resolve(outputDirectory);
  for (const sourceFile of sourceFiles) {
    const sourceAbsolutePath = path.resolve(repositoryRoot, sourceFile);
    if (pathIsWithin(sourceAbsolutePath, outputAbsolutePath)) {
      throw new Error(`Capture source list must not include output artifacts: ${sourceFile}`);
    }
  }
}

export function readCaptureRevision(
  repositoryRoot = repoRoot,
  sourceFiles: readonly string[] = CAPTURE_SOURCE_FILES,
  ignoredPaths: readonly string[] = [],
): CaptureRevision {
  const dirtyPaths = untrackedOrModifiedPaths(repositoryRoot, ignoredPaths);
  if (dirtyPaths.length > 0) {
    throw new Error(`Capture requires a clean source tree:\n${dirtyPaths.join('\n')}`);
  }

  const commitSha = gitOutput(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}']);
  const treeSha = gitOutput(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{tree}']);
  const sourceHashes: Record<string, string> = {};
  for (const sourceFile of sourceFiles) {
    gitOutput(repositoryRoot, ['ls-files', '--error-unmatch', '--', sourceFile]);
    const sourcePath = path.join(repositoryRoot, sourceFile);
    if (!existsSync(sourcePath)) throw new Error(`Capture source file is missing: ${sourceFile}`);

    const workingTreeSha = createHash('sha256').update(readFileSync(sourcePath)).digest('hex');
    const committedSha = createHash('sha256').update(gitBlob(repositoryRoot, 'HEAD', sourceFile)).digest('hex');
    if (workingTreeSha !== committedSha) {
      throw new Error(`Capture source file drifted from HEAD: ${sourceFile}`);
    }
    sourceHashes[sourceFile] = workingTreeSha;
  }

  return { commitSha, treeSha, sourceFiles: sourceHashes };
}

export function assertCaptureRevisionUnchanged(
  initialRevision: CaptureRevision,
  currentRevision: CaptureRevision,
) {
  if (currentRevision.commitSha !== initialRevision.commitSha) {
    throw new Error(`Capture HEAD drifted: ${initialRevision.commitSha}->${currentRevision.commitSha}`);
  }
  if (currentRevision.treeSha !== initialRevision.treeSha) {
    throw new Error(`Capture tree drifted: ${initialRevision.treeSha}->${currentRevision.treeSha}`);
  }
  for (const [sourceFile, sourceSha] of Object.entries(initialRevision.sourceFiles)) {
    if (currentRevision.sourceFiles[sourceFile] !== sourceSha) {
      throw new Error(`Capture source file drifted during capture: ${sourceFile}`);
    }
  }
}

export function createCaptureUrl(baseUrl: string, query: string) {
  const url = new URL('/assessment/adaptive-practice', `${baseUrl}/`);
  url.search = query.startsWith('?') ? query.slice(1) : query;
  return url.toString();
}

export function assertCapturePageUrl(expectedUrl: string, actualUrl: string) {
  const expected = new URL(expectedUrl);
  const actual = new URL(actualUrl);
  if (
    actual.origin !== expected.origin
    || actual.pathname !== expected.pathname
    || actual.search !== expected.search
  ) {
    throw new Error(`Capture navigated away from declared target: expected=${expectedUrl} actual=${actualUrl}`);
  }
}

export async function assertTargetServiceReachable(
  targetUrl: string,
  fetcher: (input: string, init?: RequestInit) => Promise<{ status: number }> = fetch,
) {
  try {
    const response = await fetcher(targetUrl, { redirect: 'manual' });
    if (response.status >= 500) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Adaptive-path QA target is unreachable: ${targetUrl} (${detail})`);
  }
}

export function dockReadinessSatisfied(snapshot: DockReadinessSnapshot) {
  return snapshot.dockPresent
    && snapshot.dockVisible
    && snapshot.registrationPresent
    && snapshot.primaryPresent
    && snapshot.primaryVisible
    && snapshot.primaryDisabled;
}

export function createDockReadinessTimeoutMessage(snapshot: DockReadinessSnapshot, timeoutMs: number) {
  return [
    `Shared Konling Dock readiness timed out after ${timeoutMs}ms.`,
    `targetUrl=${snapshot.targetUrl}`,
    `actualUrl=${snapshot.actualUrl}`,
    `observedDock=${JSON.stringify({
      dockPresent: snapshot.dockPresent,
      dockVisible: snapshot.dockVisible,
      dockState: snapshot.dockState,
      registrationPresent: snapshot.registrationPresent,
      registrationBehavior: snapshot.registrationBehavior,
      registeredControls: snapshot.registeredControls,
      primaryPresent: snapshot.primaryPresent,
      primaryVisible: snapshot.primaryVisible,
      primaryDisabled: snapshot.primaryDisabled,
      primaryLabel: snapshot.primaryLabel,
    })}`,
    `missingSelectors=${snapshot.missingSelectors.join(',') || 'none'}`,
  ].join(' ');
}

export async function waitForDockReadiness(
  readSnapshot: () => Promise<DockReadinessSnapshot>,
  options: DockReadinessWaitOptions,
) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_DOCK_READY_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_DOCK_POLL_INTERVAL_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = now() + timeoutMs;
  let snapshot = await readSnapshot();

  while (!dockReadinessSatisfied(snapshot)) {
    const remainingMs = deadline - now();
    if (remainingMs <= 0) {
      throw new Error(createDockReadinessTimeoutMessage(snapshot, timeoutMs));
    }
    await sleep(Math.min(pollIntervalMs, remainingMs));
    snapshot = await readSnapshot();
  }

  return snapshot;
}

function sha256File(absolutePath: string) {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function manifestFilePath(absolutePath: string, repositoryRoot = repoRoot) {
  return pathIsWithin(absolutePath, repositoryRoot)
    ? path.relative(repositoryRoot, absolutePath)
    : absolutePath;
}

async function setTheme(page: Page, theme: Theme) {
  await page.addInitScript((nextTheme) => {
    window.localStorage.setItem('ai-obe-theme', nextTheme);
    window.localStorage.setItem('act:app-shell-navigation-preference', 'collapsed');
  }, theme);
}

async function readDockReadiness(page: Page, targetUrl: string): Promise<DockReadinessSnapshot> {
  return page.evaluate(({ targetUrl, actualUrl, dockSelector, primarySelector, registrationSelector }) => {
    const dock = document.querySelector(dockSelector);
    const registration = document.querySelector(registrationSelector);
    const primary = document.querySelector(primarySelector);
    const isVisible = (element: Element | null) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const primaryButton = primary instanceof HTMLButtonElement ? primary : null;
    const dockPresent = Boolean(dock);
    const dockVisible = isVisible(dock);
    const registrationPresent = Boolean(registration);
    const primaryPresent = Boolean(primaryButton);
    const primaryVisible = isVisible(primaryButton);
    const primaryDisabled = primaryButton?.disabled === true;
    const missingSelectors = [
      !dockPresent || !dockVisible ? dockSelector : null,
      !registrationPresent ? registrationSelector : null,
      !primaryPresent || !primaryVisible ? primarySelector : null,
      primaryPresent && primaryVisible && !primaryDisabled ? `${primarySelector}[disabled]` : null,
    ].filter((selector): selector is string => Boolean(selector));

    return {
      targetUrl,
      actualUrl,
      dockPresent,
      dockVisible,
      dockState: dock?.getAttribute('data-platform-floating-dock') ?? null,
      registrationPresent,
      registrationBehavior: registration?.getAttribute('data-platform-floating-dock-behavior') ?? null,
      registeredControls: registration?.getAttribute('data-platform-floating-dock-controls') ?? null,
      primaryPresent,
      primaryVisible,
      primaryDisabled,
      primaryLabel: primary?.getAttribute('data-platform-floating-dock-trigger-label') ?? null,
      missingSelectors,
    };
  }, {
    targetUrl,
    actualUrl: page.url(),
    dockSelector: DOCK_SELECTOR,
    primarySelector: PRIMARY_KONLING_SELECTOR,
    registrationSelector: DOCK_REGISTRATION_SELECTOR,
  });
}

async function assertDisabledDock(page: Page) {
  const targetUrl = page.url();
  await waitForDockReadiness(
    () => readDockReadiness(page, targetUrl),
    { targetUrl, actualUrl: page.url() },
  );
}

async function openPathModule(page: Page, moduleId: string) {
  const modulePanel = page.locator(`[data-adaptive-path-module="${moduleId}"]`).first();
  if (!await modulePanel.count()) return;
  if (await modulePanel.getAttribute('data-adaptive-path-module-state') === 'expanded') return;
  await modulePanel.getByRole('button').first().click();
  await page.waitForFunction((id) => {
    return document.querySelector(`[data-adaptive-path-module="${id}"]`)?.getAttribute('data-adaptive-path-module-state') === 'expanded';
  }, moduleId, { timeout: 10_000, polling: 'raf' });
}

async function openPathSelectionModule(page: Page) {
  await openPathModule(page, 'path-selection');
}

async function openCurrentPathModule(page: Page) {
  await openPathModule(page, 'current-path');
}

async function openLearningRecordModule(page: Page) {
  await openPathModule(page, 'learning-record');
}

async function selectCompletedNode(page: Page) {
  await openCurrentPathModule(page);
  const completed = page.locator('[data-adaptive-path-node-state="completed"]').first();
  if (await completed.count()) {
    await completed.click();
    await page.waitForSelector('[data-adaptive-path-node-detail="inline"]', { timeout: 10_000 });
  }
}

async function openSkipWarning(page: Page) {
  await openCurrentPathModule(page);
  const current = page.locator('[data-adaptive-path-node-state="current"]').first();
  if (await current.count()) {
    await current.click();
    await page.waitForSelector('[data-adaptive-path-node-detail="inline"]', { timeout: 10_000 });
  }
  const skipButton = page
    .locator('[data-adaptive-path-node-detail="inline"]')
    .getByRole('button', { name: '跳过', exact: true })
    .first();
  if (await skipButton.count()) {
    await skipButton.click();
    await page.waitForSelector('[data-adaptive-path-skip-warning="visible"]', { timeout: 10_000 });
  }
}

const states: CaptureState[] = [
  {
    name: 'generation-main-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
  },
  {
    name: 'generation-main-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
  },
  {
    name: 'konling-parameter-panel-desktop-dark',
    theme: 'dark',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
    beforeScreenshot: assertDisabledDock,
    selector: '[data-platform-floating-dock]',
  },
  {
    name: 'cold-start-starter-paths-mobile-light',
    theme: 'light',
    width: 320,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
  },
  {
    name: 'path-comparison-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-selection',
    beforeScreenshot: openPathSelectionModule,
    selector: '[data-learning-path-product-surface]',
  },
  {
    name: 'path-comparison-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-selection',
    beforeScreenshot: openPathSelectionModule,
    selector: '[data-learning-path-product-surface]',
  },
  {
    name: 'active-path-execution-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: openCurrentPathModule,
    selector: '[data-adaptive-path-execution-surface="active-route"]',
  },
  {
    name: 'active-path-execution-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1200,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: openCurrentPathModule,
    selector: '[data-adaptive-path-execution-surface="active-route"]',
  },
  {
    name: 'node-detail-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: selectCompletedNode,
    selector: '[data-adaptive-path-node-detail="inline"]',
  },
  {
    name: 'skip-warning-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: openSkipWarning,
    selector: '[data-adaptive-path-skip-warning="visible"]',
  },
  {
    name: 'history-evidence-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1200,
    query: '?demo=1&goal=control-correction&intent=evidence-review',
    beforeScreenshot: openLearningRecordModule,
    selector: '[data-adaptive-path-history-surface]',
  },
  {
    name: 'history-evidence-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1200,
    query: '?demo=1&goal=control-correction&intent=evidence-review',
    beforeScreenshot: openLearningRecordModule,
    selector: '[data-adaptive-path-history-surface]',
  },
  {
    name: 'app-shell-expanded-dock-desktop-dark',
    theme: 'dark',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: async (page) => {
      await page.evaluate(() => {
        window.localStorage.setItem('act:app-shell-navigation-preference', 'expanded');
      });
      await page.reload({ waitUntil: 'networkidle' });
      await assertDisabledDock(page);
    },
  },
];

async function collectSignals(page: Page, state: CaptureState, screenshotPath: string) {
  return page.evaluate(({ name, theme, width, screenshotPath }) => {
    const routeMap = document.querySelector('[data-adaptive-path-route-map="complete"]');
    const question = document.querySelector('[data-adaptive-practice-question="active"]');
    const questionSummary = document.querySelector('[data-adaptive-practice-question="summary"]');
    const dock = document.querySelector('[data-page-floating-controls], [data-platform-floating-dock]');
    const routeFlow = document.querySelector('[data-adaptive-path-route-flow="connected"]');
    const comparison = document.querySelector('[data-learning-path-options-layout="route-modules"]');
    const routeModules = Array.from(document.querySelectorAll('[data-learning-path-option-module="route"]'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
    const attachedActionGroups = routeModules
      .map((module) => module.querySelector('[data-learning-path-option-actions="attached"]'))
      .filter((element): element is Element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
    const forbiddenPatterns = [
      'Readiness Gate',
      'missing-rules-graph-path-payload',
      'missing-konling-context',
      'terminal-validation-unavailable',
      'policyFamily',
      'stage',
      'no-path',
      'low-evidence',
    ];
    const text = document.body.innerText;
    const missingRaw = Array.from(text.matchAll(/\bmissing-[a-z0-9-]+/gi)).map((match) => match[0]);
    return {
      name,
      theme,
      width,
      screenshotPath,
      title: document.querySelector('h1')?.textContent?.trim() ?? '',
      htmlClass: document.documentElement.className,
      colorScheme: document.documentElement.style.colorScheme,
      storedTheme: window.localStorage.getItem('ai-obe-theme'),
      routeMapPresent: Boolean(routeMap),
      routeFlowConnected: routeFlow?.getAttribute('data-adaptive-path-route-flow') === 'connected',
      routeNodeCount: document.querySelectorAll('[data-adaptive-path-node]').length,
      questionActive: Boolean(question),
      questionSummary: Boolean(questionSummary),
      comparisonLayout: comparison?.getAttribute('data-learning-path-options-layout') ?? '',
      routeModuleCount: routeModules.length,
      attachedActionGroupCount: attachedActionGroups.length,
      routeModulesAttached: routeModules.length > 0 && routeModules.length === attachedActionGroups.length,
      dockPresent: Boolean(dock),
      dockRect: dock ? (() => {
        const rect = dock.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })() : null,
      bodyWidth: document.body.getBoundingClientRect().width,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      forbidden: [
        ...forbiddenPatterns.filter((pattern) => text.includes(pattern)),
        ...missingRaw,
      ],
    };
  }, { name: state.name, theme: state.theme, width: state.width, screenshotPath });
}

type CaptureSignal = Awaited<ReturnType<typeof collectSignals>>;

function assertPathComparisonSignals(signals: CaptureSignal[]) {
  const requiredStates = ['path-comparison-desktop-light', 'path-comparison-mobile-dark'];
  const failures: Array<{ name: string; issues: string[]; signal?: CaptureSignal }> = [];

  for (const stateName of requiredStates) {
    const signal = signals.find((entry) => entry.name === stateName);
    if (!signal) {
      failures.push({ name: stateName, issues: ['missing-signal'] });
      continue;
    }

    const issues: string[] = [];
    if (signal.comparisonLayout !== 'route-modules') {
      issues.push(`comparisonLayout=${signal.comparisonLayout || 'missing'}`);
    }
    if (signal.routeModuleCount < 1) {
      issues.push(`routeModuleCount=${signal.routeModuleCount}`);
    }
    if (signal.attachedActionGroupCount !== signal.routeModuleCount) {
      issues.push(`attachedActionGroupCount=${signal.attachedActionGroupCount}`);
    }
    if (!signal.routeModulesAttached) {
      issues.push('routeModulesAttached=false');
    }

    if (issues.length > 0) {
      failures.push({ name: stateName, issues, signal });
    }
  }

  if (failures.length > 0) {
    throw new Error(`Adaptive path comparison route modules failed validation:\n${JSON.stringify(failures, null, 2)}`);
  }
}

async function main() {
  const targetBaseUrl = resolveTargetBaseUrl();
  const outputDir = resolveOutputDirectory();
  assertSourcePathsExcludeOutput(CAPTURE_SOURCE_FILES, outputDir);
  await assertTargetServiceReachable(targetBaseUrl);
  const initialRevision = readCaptureRevision(repoRoot, CAPTURE_SOURCE_FILES);
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const captures = [];
  const signals: CaptureSignal[] = [];
  try {
    for (const state of states) {
      const page = await browser.newPage({ viewport: { width: state.width, height: state.height } });
      await setTheme(page, state.theme);
      const targetUrl = createCaptureUrl(targetBaseUrl, state.query);
      const response = await page.goto(targetUrl, { waitUntil: 'networkidle' });
      if (!response || response.status() >= 400) {
        throw new Error(
          `Adaptive-path QA navigation failed: targetUrl=${targetUrl} actualUrl=${page.url()} status=${response?.status() ?? 'no-response'}`,
        );
      }
      assertCapturePageUrl(targetUrl, page.url());
      await page.waitForSelector('[data-adaptive-path-center="generation-selection"]', { timeout: 30000 });
      await waitForDockReadiness(
        () => readDockReadiness(page, targetUrl),
        { targetUrl, actualUrl: page.url() },
      );
      if (state.beforeScreenshot) await state.beforeScreenshot(page);
      const absolutePath = path.join(outputDir, `${state.name}.png`);
      const manifestPath = manifestFilePath(absolutePath);
      if (state.selector) {
        await page.locator(state.selector).first().screenshot({ path: absolutePath });
      } else {
        await page.screenshot({ path: absolutePath, fullPage: true });
      }
      const sha256 = sha256File(absolutePath);
      captures.push({
        name: state.name,
        theme: state.theme,
        width: state.width,
        height: state.height,
        url: page.url(),
        targetUrl,
        selector: state.selector,
        file: manifestPath,
        sha256,
      });
      signals.push(await collectSignals(page, state, manifestPath));
      await page.close();
    }
  } finally {
    await browser.close();
  }

  assertPathComparisonSignals(signals);

  const finalRevision = readCaptureRevision(
    repoRoot,
    CAPTURE_SOURCE_FILES,
    pathIsWithin(outputDir, repoRoot) ? [outputDir] : [],
  );
  assertCaptureRevisionUnchanged(initialRevision, finalRevision);

  writeFileSync(path.join(outputDir, 'capture-manifest.json'), `${JSON.stringify({
    schemaVersion: 'adaptive-path-product-qa-capture.v2',
    capturedAt: new Date().toISOString(),
    baseUrl: targetBaseUrl,
    targetBaseUrl,
    workspaceClean: true,
    captureRevision: initialRevision.commitSha,
    captureTreeSha: initialRevision.treeSha,
    captureSourceFiles: initialRevision.sourceFiles,
    sourceFiles: Object.keys(initialRevision.sourceFiles),
    outputDirectory: manifestFilePath(outputDir),
    captures,
  }, null, 2)}\n`);
  writeFileSync(path.join(outputDir, 'visual-signals.json'), `${JSON.stringify(signals, null, 2)}\n`);
  console.log(`Captured ${captures.length} adaptive path QA states in ${manifestFilePath(outputDir)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
