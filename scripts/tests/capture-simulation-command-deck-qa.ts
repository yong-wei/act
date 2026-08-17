import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium, type Browser, type Page } from 'playwright';

import { toRepositoryArtifactPath } from '../../src/lib/evidence-artifact-path';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/simulation-command-deck-535');
const fullMatrixOutputDir = path.join(repoRoot, 'artifacts/commercial-ui/simulation-full-matrix-qa-537');
const fullMatrixReviewReport = 'artifacts/commercial-ui/simulation-full-matrix-qa-537/independent-review.md';
const baseUrl = process.env.SIMULATION_COMMAND_DECK_QA_BASE_URL ?? 'http://127.0.0.1:3001';

type Theme = 'light' | 'dark';
type RectEvidence = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type CaptureViewport = {
  width: 1440 | 1024 | 320;
  height: number;
  navigationState: 'desktop-expanded' | 'workspace-command-surface';
};
type RouteConfig = {
  href: string;
  routeFile: string;
};
type CommandDeckViewportEvidence = {
  width: 1440 | 1024 | 320;
  theme: Theme;
  screenshot: string;
  screenshotSha256: string;
  screenshotWidth: number;
  screenshotHeight: number;
  finalUrl: string;
  themeApplied: boolean;
  htmlClassName: string;
  bodyBackground: string;
  sceneChromeRemoved: boolean;
  inSceneBackControlCount: number;
  inSceneAbbreviationCount: number;
  collapseButtonCount: number;
  restoreHandleCount: number;
  panelsTopAligned: boolean;
  bottomToolsUnobscured: boolean;
  bottomToolsWithinViewport: boolean;
  bottomToolSegmentRoles: string[];
  konlingDockCollisionFree: boolean;
  restoreHandlesKeyboardReachable: boolean;
  primarySceneNonblank: boolean;
  structuredSurfacesBelowScene?: boolean;
  sceneRect?: RectEvidence;
  statusPanelRect?: RectEvidence;
  controlPanelRect?: RectEvidence;
  bottomToolRects?: RectEvidence[];
};
type CommandDeckInspectionMetrics = Pick<
  CommandDeckViewportEvidence,
  | 'sceneChromeRemoved'
  | 'inSceneBackControlCount'
  | 'inSceneAbbreviationCount'
  | 'collapseButtonCount'
  | 'restoreHandleCount'
  | 'panelsTopAligned'
  | 'bottomToolsUnobscured'
  | 'bottomToolsWithinViewport'
  | 'bottomToolSegmentRoles'
  | 'konlingDockCollisionFree'
  | 'restoreHandlesKeyboardReachable'
  | 'primarySceneNonblank'
  | 'structuredSurfacesBelowScene'
  | 'statusPanelRect'
  | 'controlPanelRect'
  | 'bottomToolRects'
> & {
  sceneRect?: RectEvidence;
  primarySceneRect?: RectEvidence;
  themeApplied: boolean;
  htmlClassName: string;
  bodyBackground: string;
};
type CommandDeckRouteEvidence = {
  href: string;
  routeFile: string;
  commandDeckGeometry: {
    change: 'unify-simulation-chrome-and-camera-views';
    generatedAt: string;
    sourceSha256: Record<string, string>;
    viewports: CommandDeckViewportEvidence[];
    cruiseComparison?: {
      comparedRoutes: string[];
      desktopSceneWidthRatioToMedian: number;
      desktopSceneHeightRatioToMedian: number;
      contextPlacement: 'below-primary-scene';
      mobileSceneFirst: boolean;
    };
  };
};
type ExistingRouteVisualQa = {
  sceneThemeParameters?: {
    lightTemplate?: boolean;
    darkTemplate?: boolean;
    labelHudContrastChecked?: boolean;
  };
  resourceInternalTheme?: {
    panelThemeParity?: boolean;
    localControlsThemeParity?: boolean;
    restoreHandlesThemeParity?: boolean;
  };
};
type ExistingCommercialEvidenceRoute = {
  href?: string;
  simulationVisualQa?: ExistingRouteVisualQa;
  simulationFullMatrixVisualQa?: Record<string, unknown>;
};
type RuntimeNoiseSummary = {
  pageErrors: string[];
  trackedConsoleWarnings: string[];
};

const routes: RouteConfig[] = [
  { href: '/simulations/destroyer', routeFile: 'src/app/simulations/destroyer/page.tsx' },
  { href: '/simulations/lng', routeFile: 'src/app/simulations/lng/page.tsx' },
  { href: '/simulations/container', routeFile: 'src/app/simulations/container/page.tsx' },
  { href: '/simulations/cruise', routeFile: 'src/app/simulations/cruise/page.tsx' },
  { href: '/simulations/drilling', routeFile: 'src/app/simulations/drilling/page.tsx' },
  { href: '/simulations/icebreaker', routeFile: 'src/app/simulations/icebreaker/page.tsx' },
  { href: '/simulations/dredger', routeFile: 'src/app/simulations/dredger/page.tsx' },
];
const themes: Theme[] = ['light', 'dark'];
const viewports: CaptureViewport[] = [
  { width: 1440, height: 900, navigationState: 'desktop-expanded' },
  { width: 1024, height: 900, navigationState: 'desktop-expanded' },
  { width: 320, height: 900, navigationState: 'workspace-command-surface' },
];
const fullMatrixReviewInputs = {
  designHandoff: 'artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md',
  audit: 'artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/audit.md',
  conceptImages: [
    'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-2-command-deck-shell.png',
  ],
  contactSheets: [
    'artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/contact-light-desktop.jpg',
    'artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/contact-dark-desktop.jpg',
    'artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/contact-light-mobile.jpg',
    'artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/contact-dark-mobile.jpg',
  ],
};

function sha256(relativePath: string) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function gitSha256(relativePath: string) {
  return createHash('sha256').update(execFileSync(
    'git',
    ['show', `HEAD:${relativePath}`],
    { cwd: repoRoot, maxBuffer: 32 * 1024 * 1024 },
  )).digest('hex');
}

function artifactSha256(relativePath: string | undefined) {
  return relativePath && existsSync(path.join(repoRoot, relativePath)) ? sha256(relativePath) : undefined;
}

function readJsonIfExists<T>(relativePath: string): T | undefined {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return undefined;
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

function readRuntimeNoiseSummary(): RuntimeNoiseSummary {
  const report = readJsonIfExists<{
    summary?: {
      pageErrors?: unknown[];
      trackedConsoleWarnings?: unknown[];
    };
  }>('artifacts/commercial-ui/simulation-runtime-noise-536/runtime-noise.json');
  const stringify = (entry: unknown) => {
    if (typeof entry === 'string') return entry;
    if (!entry || typeof entry !== 'object') return JSON.stringify(entry);
    const record = entry as Record<string, unknown>;
    const detail = typeof record.message === 'string'
      ? record.message
      : typeof record.text === 'string'
        ? record.text
        : JSON.stringify(record);
    return typeof record.route === 'string' ? `${record.route}: ${detail}` : detail;
  };
  return {
    pageErrors: Array.isArray(report?.summary?.pageErrors)
      ? report.summary.pageErrors.map(stringify)
      : [],
    trackedConsoleWarnings: Array.isArray(report?.summary?.trackedConsoleWarnings)
      ? report.summary.trackedConsoleWarnings.map(stringify)
      : [],
  };
}

function reviewReportStatus() {
  if (!existsSync(path.join(repoRoot, fullMatrixReviewReport))) {
    return {
      status: 'not-run',
      unresolvedBlockers: 1,
    } as const;
  }
  const content = readFileSync(path.join(repoRoot, fullMatrixReviewReport), 'utf8');
  return {
    status: content.includes('Final result: PASS') ? 'passed' : 'failed',
    unresolvedBlockers: content.includes('Unresolved blockers: 0') ? 0 : 1,
  } as const;
}

function commandDeckGeometrySourcePaths(routeFile: string) {
  return [
    routeFile,
    'src/app/simulations/_components/simulation-shell.tsx',
    'src/resources/simulations/components/simulation-ui.tsx',
    'src/resources/simulations/components/camera-view-switcher.tsx',
    'src/lib/evidence-artifact-path.ts',
    'scripts/tests/capture-simulation-command-deck-qa.ts',
  ] as const;
}

function commandDeckGeometrySourceSha256(routeFile: string) {
  return Object.fromEntries(
    commandDeckGeometrySourcePaths(routeFile)
      .filter((sourcePath) => existsSync(path.join(repoRoot, sourcePath)))
      .map((sourcePath) => [sourcePath, gitSha256(sourcePath)]),
  );
}

async function waitForFile(pathname: string, timeoutMs: number) {
  const startedAt = Date.now();
  while (!existsSync(pathname)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`file was not created within ${timeoutMs}ms: ${pathname}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

async function closeContextSafely(context: Awaited<ReturnType<Browser['newContext']>>) {
  await Promise.race([
    context.close(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]).catch(() => undefined);
}

async function forceTheme(page: Page, theme: Theme, navigationState: CaptureViewport['navigationState']) {
  await page.evaluate(({ nextTheme, nextNavigationState }) => {
    window.localStorage.setItem('ai-obe-theme', nextTheme);
    window.localStorage.setItem(
      'act:app-shell:navigation-preference',
      nextNavigationState === 'desktop-expanded' ? 'expanded' : 'collapsed',
    );
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
  }, { nextTheme: theme, nextNavigationState: navigationState });
}

async function waitForThemeApplied(page: Page, theme: Theme) {
  await page.waitForFunction((expectedTheme) => {
    const root = document.documentElement;
    const background = getComputedStyle(document.body).backgroundColor;
    const channels = background.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [];
    const isDarkBackground = channels.length === 3
      ? channels.reduce((sum, channel) => sum + channel, 0) / 3 < 128
      : false;
    return root.classList.contains(expectedTheme)
      && root.style.colorScheme === expectedTheme
      && (expectedTheme === 'dark' ? isDarkBackground : true);
  }, theme, { timeout: 10000 });
}

function slug(input: string) {
  return input.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function openSimulationPage(
  browser: Browser,
  route: RouteConfig,
  theme: Theme,
  viewport: CaptureViewport,
) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    colorScheme: theme,
  });
  await context.addInitScript(({ currentTheme, navigationState }) => {
    Object.defineProperty(window, '__name', {
      value: (target: unknown) => target,
      configurable: true,
    });
    window.localStorage.setItem('ai-obe-theme', currentTheme);
    window.localStorage.setItem(
      'act:app-shell:navigation-preference',
      navigationState === 'desktop-expanded' ? 'expanded' : 'collapsed',
    );
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(currentTheme);
    document.documentElement.style.colorScheme = currentTheme;
  }, { currentTheme: theme, navigationState: viewport.navigationState });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${route.href}`, { waitUntil: 'domcontentloaded' });
  await forceTheme(page, theme, viewport.navigationState);
  await waitForThemeApplied(page, theme);
  await page.waitForSelector('[data-commercial-workspace="simulation-scene"]', { timeout: 30000 });
  await forceTheme(page, theme, viewport.navigationState);
  await waitForThemeApplied(page, theme);
  if (viewport.width === 1440) {
    await page.waitForSelector('[data-command-deck-panel-anchor="top-command-area"]', {
      state: 'visible',
      timeout: 20000,
    });
  } else {
    await page.waitForFunction(() => document.querySelectorAll('[data-simulation-panel-restore-handle]').length >= 2, undefined, {
      timeout: 20000,
    });
  }
  await forceTheme(page, theme, viewport.navigationState);
  await waitForThemeApplied(page, theme);
  await page.waitForTimeout(500);
  return { context, page };
}

async function inspectCommandDeck(page: Page, expectedTheme: Theme): Promise<CommandDeckInspectionMetrics> {
  return page.evaluate(`(() => {
    const expectedTheme = ${JSON.stringify(expectedTheme)};
    function rect(element) {
      if (!element) return undefined;
      const box = element.getBoundingClientRect();
      return {
        left: Math.round(box.left),
        top: Math.round(box.top),
        right: Math.round(box.right),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height)
      };
    }
    function visible(element) {
      if (!element || element.closest('.sr-only')) return false;
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && box.width > 2 && box.height > 2;
    }
    function overlaps(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }
    const scene = document.querySelector('[data-commercial-workspace="simulation-scene"]');
    const sceneRect = rect(scene);
    const sceneElements = Array.from(scene ? scene.querySelectorAll('*') : []).filter(visible);
    const backControlCount = sceneElements.filter((element) => (
      /^(A|BUTTON)$/i.test(element.tagName) && (element.textContent || '').includes('返回上一层')
    )).length;
    const abbreviationCount = sceneElements.filter((element) => /\\/\\s*OBE\\b|OBE\\s*船舶仿真/.test(element.textContent || '')).length;
    const panels = Array.from(scene ? scene.querySelectorAll('[data-command-deck-panel-anchor="top-command-area"]') : []).filter(visible).map(rect).filter(Boolean);
    const statusPanelRect = rect(scene ? scene.querySelector('[data-simulation-local-panel="left"][data-command-deck-panel-anchor="top-command-area"]') : null);
    const controlPanelRect = rect(scene ? scene.querySelector('[data-simulation-local-panel="right"][data-command-deck-panel-anchor="top-command-area"]') : null);
    const bottomToolElements = Array.from(scene ? scene.querySelectorAll('[data-simulation-local-bottom-tool-segment], [data-simulation-local-hint-strip]') : []).filter(visible);
    const bottomToolRects = bottomToolElements.map(rect).filter(Boolean);
    const bottomToolSegmentRoles = bottomToolElements
      .map((element) => element.getAttribute('data-simulation-local-bottom-tool-segment') || element.getAttribute('data-simulation-local-hint-strip') || '')
      .filter(Boolean);
    const floatingDockRects = Array.from(document.querySelectorAll('[data-page-floating-controls="true"], [data-global-ai-sidebar="open"]')).filter(visible).map(rect).filter(Boolean);
    const isDesktop = window.innerWidth >= 1024;
    const panelsTopAligned = isDesktop && sceneRect
      ? panels.length >= 2 && panels.every((panel) => panel.top - sceneRect.top <= 48)
      : panels.every((panel) => !sceneRect || panel.top >= sceneRect.top);
    const collapseButtons = Array.from(scene ? scene.querySelectorAll('[data-simulation-panel-collapse-button]') : []).filter(visible);
    const restoreHandles = Array.from(scene ? scene.querySelectorAll('[data-simulation-panel-restore-handle]') : []).filter(visible);
    const keyboardButtons = collapseButtons.concat(restoreHandles);
    const restoreHandlesKeyboardReachable = keyboardButtons.every((button) => {
      const name = button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '';
      return button.tabIndex >= 0 && name.trim().length > 0;
    });
    const primaryScene = scene ? (scene.querySelector('[data-instrument-nonblank-contract="simulation-scene"]') || scene) : null;
    const primarySceneRect = rect(primaryScene);
    const structuredRect = rect(document.querySelector('[data-simulation-shell-structured-surfaces="below-primary-scene"]'));
    const root = document.documentElement;
    const bodyBackground = window.getComputedStyle(document.body).backgroundColor;
    return {
      themeApplied: root.classList.contains(expectedTheme) && root.style.colorScheme === expectedTheme,
      htmlClassName: root.className,
      bodyBackground,
      sceneRect,
      primarySceneRect,
      statusPanelRect,
      controlPanelRect,
      bottomToolRects,
      sceneChromeRemoved: backControlCount === 0 && abbreviationCount === 0,
      inSceneBackControlCount: backControlCount,
      inSceneAbbreviationCount: abbreviationCount,
      collapseButtonCount: collapseButtons.length,
      restoreHandleCount: restoreHandles.length,
      panelsTopAligned,
      bottomToolsUnobscured: bottomToolRects.every((tool) => panels.every((panel) => !overlaps(tool, panel))),
      bottomToolsWithinViewport: bottomToolRects.every((tool) => (
        tool.left >= 0
        && tool.right <= window.innerWidth
        && tool.top >= 0
        && tool.bottom <= window.innerHeight
      )),
      bottomToolSegmentRoles,
      konlingDockCollisionFree: floatingDockRects.every((dock) => panels.concat(bottomToolRects).every((surface) => !overlaps(dock, surface))),
      restoreHandlesKeyboardReachable,
      primarySceneNonblank: Boolean(primarySceneRect && primarySceneRect.width > 260 && primarySceneRect.height > 420),
      structuredSurfacesBelowScene: !structuredRect || !sceneRect ? undefined : structuredRect.top >= sceneRect.bottom - 4
    };
  })()`) as Promise<CommandDeckInspectionMetrics>;
}

async function captureRouteViewport(
  browser: Browser,
  route: RouteConfig,
  theme: Theme,
  viewport: CaptureViewport,
): Promise<CommandDeckViewportEvidence> {
  const { context, page } = await openSimulationPage(browser, route, theme, viewport);
  try {
    const metrics = await inspectCommandDeck(page, theme);
    const fileName = `${slug(route.href)}-${theme}-${viewport.width}.png`;
    const screenshotPath = path.join(outputDir, fileName);
    const client = await context.newCDPSession(page);
    const cdpScreenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(screenshotPath, Buffer.from(cdpScreenshot.data, 'base64'));
    await waitForFile(screenshotPath, 12000);
    const screenshot = toRepositoryArtifactPath(repoRoot, screenshotPath);
    return {
      width: viewport.width,
      theme,
      screenshot,
      screenshotSha256: sha256(screenshot),
      screenshotWidth: viewport.width,
      screenshotHeight: viewport.height,
      finalUrl: page.url(),
      themeApplied: metrics.themeApplied,
      htmlClassName: metrics.htmlClassName,
      bodyBackground: metrics.bodyBackground,
      sceneChromeRemoved: metrics.sceneChromeRemoved,
      inSceneBackControlCount: metrics.inSceneBackControlCount,
      inSceneAbbreviationCount: metrics.inSceneAbbreviationCount,
      collapseButtonCount: metrics.collapseButtonCount,
      restoreHandleCount: metrics.restoreHandleCount,
      panelsTopAligned: metrics.panelsTopAligned,
      bottomToolsUnobscured: metrics.bottomToolsUnobscured,
      bottomToolsWithinViewport: metrics.bottomToolsWithinViewport,
      bottomToolSegmentRoles: metrics.bottomToolSegmentRoles,
      konlingDockCollisionFree: metrics.konlingDockCollisionFree,
      restoreHandlesKeyboardReachable: metrics.restoreHandlesKeyboardReachable,
      primarySceneNonblank: metrics.primarySceneNonblank,
      structuredSurfacesBelowScene: metrics.structuredSurfacesBelowScene,
      sceneRect: metrics.primarySceneRect ?? metrics.sceneRect,
      statusPanelRect: metrics.statusPanelRect,
      controlPanelRect: metrics.controlPanelRect,
      bottomToolRects: metrics.bottomToolRects,
    };
  } finally {
    void page;
    await closeContextSafely(context);
  }
}

function attachCruiseComparison(routeEvidence: CommandDeckRouteEvidence[]) {
  const cruise = routeEvidence.find((entry) => entry.href === '/simulations/cruise');
  if (!cruise) return;
  const comparisonRoutes = ['/simulations/destroyer', '/simulations/lng'];
  const desktopLightScene = (entry: CommandDeckRouteEvidence) => entry.commandDeckGeometry.viewports.find((viewport) => (
    viewport.width === 1440 && viewport.theme === 'light'
  ));
  const peers = routeEvidence.filter((entry) => comparisonRoutes.includes(entry.href)).map(desktopLightScene);
  const cruiseDesktop = desktopLightScene(cruise);
  const widthMedian = median(peers.map((entry) => entry?.sceneRect?.width ?? 0).filter((value) => value > 0));
  const heightMedian = median(peers.map((entry) => entry?.sceneRect?.height ?? 0).filter((value) => value > 0));
  const cruiseWidth = cruiseDesktop?.sceneRect?.width ?? 0;
  const cruiseHeight = cruiseDesktop?.sceneRect?.height ?? 0;
  const cruiseMobile = cruise.commandDeckGeometry.viewports.find((viewport) => viewport.width === 320 && viewport.theme === 'light');
  cruise.commandDeckGeometry.cruiseComparison = {
    comparedRoutes: comparisonRoutes,
    desktopSceneWidthRatioToMedian: widthMedian > 0 ? Number((cruiseWidth / widthMedian).toFixed(3)) : 0,
    desktopSceneHeightRatioToMedian: heightMedian > 0 ? Number((cruiseHeight / heightMedian).toFixed(3)) : 0,
    contextPlacement: 'below-primary-scene',
    mobileSceneFirst: cruiseMobile?.structuredSurfacesBelowScene !== false,
  };
}

function routeVisualQaByHref(routesFromEvidence: ExistingCommercialEvidenceRoute[]) {
  return new Map(routesFromEvidence.map((route) => [route.href, route.simulationVisualQa]));
}

function buildSimulationFullMatrixVisualQa(
  routeEvidence: CommandDeckRouteEvidence[],
  routesFromEvidence: ExistingCommercialEvidenceRoute[],
  generatedAt: string,
) {
  const runtimeNoise = readRuntimeNoiseSummary();
  const routeVisualQa = routeVisualQaByHref(routesFromEvidence);
  const implementationScreenshots = routeEvidence.flatMap((entry) => entry.commandDeckGeometry.viewports
    .filter((viewport) => viewport.width === 1440 || viewport.width === 320)
    .map((viewport) => viewport.screenshot));
  const reviewStatus = reviewReportStatus();
  const cruiseComparison = routeEvidence.find((entry) => entry.href === '/simulations/cruise')
    ?.commandDeckGeometry.cruiseComparison;
  const entries = routeEvidence.flatMap((entry) => {
    const routeQa = routeVisualQa.get(entry.href);
    const themeParity = routeQa?.resourceInternalTheme?.panelThemeParity === true
      && routeQa.resourceInternalTheme.localControlsThemeParity === true
      && routeQa.resourceInternalTheme.restoreHandlesThemeParity === true
      && routeQa.sceneThemeParameters?.lightTemplate === true
      && routeQa.sceneThemeParameters.darkTemplate === true;
    const contrastChecked = routeQa?.sceneThemeParameters?.labelHudContrastChecked === true;
    return entry.commandDeckGeometry.viewports
      .filter((viewport) => viewport.width === 1440 || viewport.width === 320)
      .map((viewport) => ({
        requestedRoute: entry.href,
        finalUrl: viewport.finalUrl,
        theme: viewport.theme,
        viewport: {
          width: viewport.width,
          height: viewport.screenshotHeight,
        },
        role: 'student',
        authState: 'public',
        screenshot: viewport.screenshot,
        screenshotSha256: viewport.screenshotSha256,
        screenshotWidth: viewport.screenshotWidth,
        screenshotHeight: viewport.screenshotHeight,
        runtimeErrors: runtimeNoise.pageErrors,
        trackedWarnings: runtimeNoise.trackedConsoleWarnings,
        checklist: {
          sceneFirstGeometry: viewport.primarySceneNonblank === true
            && viewport.structuredSurfacesBelowScene !== false
            && (viewport.width !== 1440 || viewport.panelsTopAligned === true),
          themeParity: themeParity && viewport.themeApplied === true,
          panelsTopAligned: viewport.width === 1440 ? viewport.panelsTopAligned === true : true,
          duplicateSceneChromeAbsent: viewport.sceneChromeRemoved === true
            && viewport.inSceneBackControlCount === 0
            && viewport.inSceneAbbreviationCount === 0,
          mobileReachability: viewport.width === 320
            ? viewport.restoreHandlesKeyboardReachable === true && viewport.bottomToolsWithinViewport === true
            : true,
          dockNonOverlap: viewport.konlingDockCollisionFree === true
            && viewport.bottomToolsUnobscured === true
            && viewport.bottomToolsWithinViewport === true,
          contrastChecked,
          runtimeNoiseClear: runtimeNoise.pageErrors.length === 0 && runtimeNoise.trackedConsoleWarnings.length === 0,
          inSceneBackControlAbsent: viewport.inSceneBackControlCount === 0,
          inSceneAbbreviationAbsent: viewport.inSceneAbbreviationCount === 0,
        },
      }));
  });

  return {
    change: 'govern-simulation-full-matrix-visual-qa',
    generatedAt,
    activeRouteSource: 'SIMULATION_VISUAL_QA_ROUTE_MATRIX.requiresNonblankScene',
    routeCount: routes.length,
    requiredThemes: themes,
    requiredWidths: [1440, 320],
    entries,
    cruiseComparison,
    independentReview: {
      status: reviewStatus.status,
      reviewer: 'ui-flow-reviewer',
      reviewedAt: reviewStatus.status === 'passed' ? generatedAt : undefined,
      report: fullMatrixReviewReport,
      reportSha256: artifactSha256(fullMatrixReviewReport),
      unresolvedBlockers: reviewStatus.unresolvedBlockers,
      inputs: {
        ...fullMatrixReviewInputs,
        implementationScreenshots,
      },
    },
  };
}

function writeSimulationFullMatrixManifest(fullMatrixVisualQa: Record<string, unknown>, generatedAt: string) {
  mkdirSync(fullMatrixOutputDir, { recursive: true });
  writeFileSync(
    path.join(fullMatrixOutputDir, 'manifest.json'),
    `${JSON.stringify({
      generatedAt,
      change: 'govern-simulation-full-matrix-visual-qa',
      baseUrl,
      simulationFullMatrixVisualQa: fullMatrixVisualQa,
    }, null, 2)}\n`,
  );
}

function updateCommercialEvidence(routeEvidence: CommandDeckRouteEvidence[], generatedAt: string) {
  const evidencePath = path.join(repoRoot, 'artifacts/commercial-ui/evidence.json');
  if (!existsSync(evidencePath)) return;
  const manifest = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
    routes?: ExistingCommercialEvidenceRoute[];
  };
  const routesFromEvidence = manifest.routes ?? [];
  const fullMatrixVisualQa = buildSimulationFullMatrixVisualQa(routeEvidence, routesFromEvidence, generatedAt);
  writeSimulationFullMatrixManifest(fullMatrixVisualQa, generatedAt);
  const evidenceByHref = new Map(routeEvidence.map((entry) => [entry.href, entry.commandDeckGeometry]));
  manifest.routes = (manifest.routes ?? []).map((route) => {
    if (route.href === '/simulations') {
      return {
        ...route,
        simulationFullMatrixVisualQa: fullMatrixVisualQa as Record<string, unknown>,
      };
    }
    if (!route.href || !evidenceByHref.has(route.href) || !route.simulationVisualQa) return route;
    return {
      ...route,
      simulationVisualQa: {
        ...route.simulationVisualQa,
        commandDeckGeometry: evidenceByHref.get(route.href),
      },
    };
  });
  writeFileSync(evidencePath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const generatedAt = new Date().toISOString();
  const routeEvidence: CommandDeckRouteEvidence[] = [];
  try {
    for (const route of routes) {
      const capturedViewports: CommandDeckViewportEvidence[] = [];
      for (const theme of themes) {
        for (const viewport of viewports) {
          console.log(`capture ${route.href} theme=${theme} width=${viewport.width}`);
          capturedViewports.push(await captureRouteViewport(browser, route, theme, viewport));
        }
      }
      routeEvidence.push({
        href: route.href,
        routeFile: route.routeFile,
        commandDeckGeometry: {
          change: 'unify-simulation-chrome-and-camera-views',
          generatedAt,
          sourceSha256: commandDeckGeometrySourceSha256(route.routeFile),
          viewports: capturedViewports,
        },
      });
    }
  } finally {
    await browser.close();
  }
  attachCruiseComparison(routeEvidence);
  const manifest = {
    generatedAt,
    change: 'unify-simulation-chrome-and-camera-views',
    baseUrl,
    routes: routeEvidence,
  };
  writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  updateCommercialEvidence(routeEvidence, generatedAt);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
