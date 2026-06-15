import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium, type Browser, type Page } from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/simulation-command-deck-535');
const baseUrl = process.env.SIMULATION_COMMAND_DECK_QA_BASE_URL ?? 'http://127.0.0.1:3001';

type Theme = 'light' | 'dark';
type RectEvidence = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type CaptureViewport = {
  width: 1440 | 320;
  height: number;
  navigationState: 'desktop-expanded' | 'workspace-command-surface';
};
type RouteConfig = {
  href: string;
  routeFile: string;
};
type CommandDeckViewportEvidence = {
  width: 1440 | 320;
  theme: Theme;
  screenshot: string;
  screenshotSha256: string;
  screenshotWidth: number;
  screenshotHeight: number;
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
type CommandDeckRouteEvidence = {
  href: string;
  routeFile: string;
  commandDeckGeometry: {
    change: 'normalize-simulation-command-deck-layout';
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
  { width: 320, height: 900, navigationState: 'workspace-command-surface' },
];

function sha256(relativePath: string) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function commandDeckGeometrySourcePaths(routeFile: string) {
  return [
    routeFile,
    'src/app/simulations/_components/simulation-shell.tsx',
    'src/resources/simulations/components/simulation-ui.tsx',
    'scripts/tests/capture-simulation-command-deck-qa.ts',
  ] as const;
}

function commandDeckGeometrySourceSha256(routeFile: string) {
  return Object.fromEntries(
    commandDeckGeometrySourcePaths(routeFile)
      .filter((sourcePath) => existsSync(path.join(repoRoot, sourcePath)))
      .map((sourcePath) => [sourcePath, sha256(sourcePath)]),
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
  await page.waitForSelector('[data-commercial-workspace="simulation-scene"]', { timeout: 30000 });
  if (viewport.width >= 1024) {
    await page.waitForSelector('[data-command-deck-panel-anchor="top-command-area"]', {
      state: 'visible',
      timeout: 20000,
    });
  }
  await page.waitForTimeout(500);
  return { context, page };
}

async function inspectCommandDeck(page: Page) {
  return page.evaluate(`(() => {
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
    return {
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
  })()`);
}

async function captureRouteViewport(
  browser: Browser,
  route: RouteConfig,
  theme: Theme,
  viewport: CaptureViewport,
): Promise<CommandDeckViewportEvidence> {
  const { context, page } = await openSimulationPage(browser, route, theme, viewport);
  try {
    const metrics = await inspectCommandDeck(page);
    const fileName = `${slug(route.href)}-${theme}-${viewport.width}.png`;
    const screenshotPath = path.join(outputDir, fileName);
    const client = await context.newCDPSession(page);
    const cdpScreenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(screenshotPath, Buffer.from(cdpScreenshot.data, 'base64'));
    await waitForFile(screenshotPath, 12000);
    const screenshot = path.relative(repoRoot, screenshotPath);
    return {
      width: viewport.width,
      theme,
      screenshot,
      screenshotSha256: sha256(screenshot),
      screenshotWidth: viewport.width,
      screenshotHeight: viewport.height,
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

function updateCommercialEvidence(routeEvidence: CommandDeckRouteEvidence[]) {
  const evidencePath = path.join(repoRoot, 'artifacts/commercial-ui/evidence.json');
  if (!existsSync(evidencePath)) return;
  const manifest = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
    routes?: Array<{ href?: string; simulationVisualQa?: Record<string, unknown> }>;
  };
  const evidenceByHref = new Map(routeEvidence.map((entry) => [entry.href, entry.commandDeckGeometry]));
  manifest.routes = (manifest.routes ?? []).map((route) => {
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
          change: 'normalize-simulation-command-deck-layout',
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
    change: 'normalize-simulation-command-deck-layout',
    baseUrl,
    routes: routeEvidence,
  };
  writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  updateCommercialEvidence(routeEvidence);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
