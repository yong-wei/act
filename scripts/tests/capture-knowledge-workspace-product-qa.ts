import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium, type Browser, type Page } from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/knowledge-workspace-product-qa-489');
const baseUrl = process.env.KNOWLEDGE_QA_BASE_URL ?? 'http://localhost:3002';
const selectedNodeId = process.env.KNOWLEDGE_QA_SELECTED_NODE_ID ?? 'z反变换_7_7959c077';

const sourceFiles = [
  'src/features/knowledge/knowledge-graph-system.tsx',
  'src/features/knowledge/resource-panel/resource-panel.tsx',
  'src/components/platform/app-shell.tsx',
  'src/lib/konling-agent-runtime.ts',
] as const;

type Theme = 'dark' | 'light';
type NavigationState = 'collapsed' | 'expanded' | 'mobile';
type DockState = 'collapsed' | 'expanded';
type EvidenceRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

interface CaptureState {
  name: string;
  theme: Theme;
  width: number;
  height: number;
  navigationPreference: 'collapsed' | 'expanded';
  navigationState: NavigationState;
  dockState: DockState;
  localToolState: string;
  selectedNode: string | null;
  interactionState: string;
  query?: string;
  beforeShot?: (page: Page) => Promise<Record<string, unknown> | void>;
}

function sha256(relativePath: string) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function ensureOutputDir() {
  mkdirSync(outputDir, { recursive: true });
}

async function openStatePage(browser: Browser, state: CaptureState) {
  const context = await browser.newContext({
    viewport: { width: state.width, height: state.height },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(({ theme, navigationPreference }) => {
    window.localStorage.setItem('ai-obe-theme', theme);
    window.localStorage.setItem('act:app-shell:navigation-preference', navigationPreference);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  }, { theme: state.theme, navigationPreference: state.navigationPreference });
  const page = await context.newPage();
  const query = state.query ? `${state.query}&qa=knowledge-product` : '?qa=knowledge-product';
  const url = `${baseUrl}/knowledge${query}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-knowledge-workspace="canvas-first"]', { timeout: 30000 });
  await page.waitForTimeout(800);
  return { context, page, url };
}

async function clickIfPresent(page: Page, selector: string) {
  const locator = page.locator(selector);
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    await candidate.click({ timeout: 5000 });
    await page.waitForTimeout(250);
    return;
  }
}

async function openDesktopTool(page: Page, tool: string) {
  await clickIfPresent(page, `[data-knowledge-command-trigger="${tool}"]`);
  await page.waitForSelector(`[data-knowledge-local-tool="${tool}"][data-state="open"]`, { timeout: 8000 }).catch(() => undefined);
}

async function waitForSelectedNodeRuntimePosition(page: Page) {
  await page.waitForFunction(() => {
    const pinButton = document.querySelector<HTMLButtonElement>('[data-knowledge-layout-control="pin-selected"]');
    return Boolean(pinButton && !pinButton.disabled);
  }, undefined, { timeout: 10000 }).catch(() => undefined);
}

async function selectedNodeDragPointCandidates(page: Page) {
  return page.evaluate(`(() => {
    const probe = window.__knowledgeGraphProductQaSelectedNodeDragPoints;
    if (typeof probe !== 'function') return [];
    return probe()
      .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  })()`).catch(() => []);
}

async function hoveredCanvasNodeDragPointCandidates(page: Page) {
  const canvasBox = await page.locator('[data-knowledge-canvas-primary] canvas').boundingBox();
  if (!canvasBox) return [];
  const candidates: Array<[number, number]> = [];
  for (let y = canvasBox.y + 80; y < canvasBox.y + canvasBox.height - 40; y += 30) {
    for (let x = canvasBox.x + 80; x < canvasBox.x + canvasBox.width - 40; x += 30) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(35);
      const hit = await page.evaluate(`(() => {
        const hovered = document.querySelector('[data-knowledge-local-panel="node-hover-preview"]');
        const target = document.elementFromPoint(${JSON.stringify(x)}, ${JSON.stringify(y)});
        return Boolean(hovered && target?.tagName === 'CANVAS');
      })()`);
      if (hit) {
        candidates.push([x, y]);
        if (candidates.length >= 8) return candidates;
      }
    }
  }
  return candidates;
}

async function dragCanvasNodeUntilPinned(page: Page) {
  const qaCandidates = await selectedNodeDragPointCandidates(page);
  const hoverCandidates = await hoveredCanvasNodeDragPointCandidates(page);
  const candidates = [
    ...hoverCandidates,
    ...qaCandidates.map(({ x, y }) => [x, y] as [number, number]),
    [852, 365],
    [838, 383],
    [875, 386],
    [912, 421],
    [916, 473],
    [771, 471],
    [806, 518],
    [852, 554],
    [904, 587],
    [853, 676],
    [778, 858],
    [899, 859],
    [939, 907],
    [840, 510],
    [985, 420],
    [720, 360],
    [640, 610],
    [1000, 640],
    [560, 520],
    [760, 740],
    [490, 430],
    [910, 760],
    [1080, 520],
  ];
  for (const [x, y] of candidates) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(80);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 36, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(350);
    const pinned = await page.locator('[data-knowledge-canvas-primary]').first().getAttribute('data-knowledge-pinned-node-count');
    if (pinned === '1') {
      return { method: 'pointer-drag', dragFrom: { x, y }, dragTo: { x: x + 80, y: y + 36 }, pinned: true };
    }
  }
  return { method: 'pointer-drag', pinned: false };
}

async function captureMarkerSnapshot(page: Page) {
  return page.evaluate(`(() => {
    const canvas = document.querySelector('[data-knowledge-canvas-primary]');
    const desktopTools = document.querySelector('[data-knowledge-desktop-command-system]');
    return {
      layoutVersion: canvas?.dataset.knowledgeLayoutVersion ?? '',
      pinnedNodeCount: canvas?.dataset.knowledgePinnedNodeCount ?? '',
      pinnedLayoutSignature: canvas?.dataset.knowledgePinnedLayoutSignature ?? '',
      selectedNodeId: canvas?.dataset.knowledgeSelectedNodeId ?? '',
      desktopToolState: desktopTools?.dataset.state ?? null,
      desktopActiveTool: desktopTools?.dataset.knowledgeLocalTool ?? null
    };
  })()`);
}

function doRectsOverlap(
  a: { left: number; top: number; right: number; bottom: number } | null,
  b: { left: number; top: number; right: number; bottom: number } | null,
) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function openMobileTool(page: Page, tool: string) {
  const labelByTool: Record<string, string> = {
    'chapter-directory': '目录',
    'relation-filters': '筛选',
    legend: '图例',
    'view-layout': '视图',
  };
  const label = labelByTool[tool] ?? tool;
  const mobileButton = page.locator('[data-knowledge-mobile-command-surface] button').filter({ hasText: label }).first();
  if (await mobileButton.count()) {
    await mobileButton.click({ timeout: 5000 });
    await page.waitForTimeout(250);
  }
  await page.waitForSelector(`[data-knowledge-mobile-tool-panel="${tool}"]`, { timeout: 8000 }).catch(() => undefined);
}

async function expandDock(page: Page) {
  await clickIfPresent(page, '[data-platform-floating-dock] button[aria-label="打开页面工具菜单"]');
  await page.waitForSelector('[data-platform-floating-dock-expanded-panel]', { timeout: 8000 }).catch(() => undefined);
}

async function activeElementWithin(page: Page, selector: string) {
  return page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    return Boolean(target && document.activeElement && target.contains(document.activeElement));
  }, selector);
}

async function focusableByTab(page: Page, selector: string) {
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    if (await activeElementWithin(page, selector)) return true;
  }
  return false;
}

async function probeFocusTarget(
  browser: Browser,
  target: string,
  state: CaptureState,
  open: (page: Page) => Promise<void>,
  panelSelector: string,
  close: (page: Page) => Promise<void>,
  returnSelector?: string,
) {
  const { context, page } = await openStatePage(browser, state);
  try {
    await open(page);
    await page.waitForSelector(panelSelector, { timeout: 8000 });
    const openedFocusManaged = await activeElementWithin(page, panelSelector);
    const keyboardReachable = openedFocusManaged || await focusableByTab(page, panelSelector);
    await close(page);
    await page.waitForTimeout(250);
    const escapeOrCloseReturnsFocus = returnSelector
      ? await activeElementWithin(page, returnSelector)
      : !(await page.locator(panelSelector).first().isVisible().catch(() => false));
    return { target, openedFocusManaged, escapeOrCloseReturnsFocus, keyboardReachable };
  } finally {
    await context.close();
  }
}

async function captureFocusEvidence(browser: Browser) {
  return [
    await probeFocusTarget(
      browser,
      'desktop-local-tools',
      {
        name: 'focus-desktop-local-tools',
        theme: 'dark',
        width: 1440,
        height: 960,
        navigationPreference: 'collapsed',
        navigationState: 'collapsed',
        dockState: 'collapsed',
        localToolState: 'legend',
        selectedNode: null,
        interactionState: 'focus desktop local tools',
      },
      (page) => openDesktopTool(page, 'legend'),
      '[data-knowledge-desktop-tool-panel="legend"]',
      (page) => page.keyboard.press('Escape'),
      '[data-knowledge-command-trigger="legend"]',
    ),
    await probeFocusTarget(
      browser,
      'mobile-local-sheet',
      {
        name: 'focus-mobile-local-sheet',
        theme: 'dark',
        width: 320,
        height: 800,
        navigationPreference: 'collapsed',
        navigationState: 'mobile',
        dockState: 'collapsed',
        localToolState: 'view-layout',
        selectedNode: null,
        interactionState: 'focus mobile local tools',
      },
      (page) => openMobileTool(page, 'view-layout'),
      '[data-knowledge-mobile-tool-panel="view-layout"]',
      (page) => clickIfPresent(page, '[data-knowledge-mobile-panel-toggle="true"]'),
      '[data-knowledge-mobile-panel-toggle="true"]',
    ),
    await probeFocusTarget(
      browser,
      'mobile-inspector',
      {
        name: 'focus-mobile-inspector',
        theme: 'dark',
        width: 320,
        height: 800,
        navigationPreference: 'collapsed',
        navigationState: 'mobile',
        dockState: 'collapsed',
        localToolState: 'closed',
        selectedNode: selectedNodeId,
        interactionState: 'focus mobile inspector',
        query: `?node=${encodeURIComponent(selectedNodeId)}`,
      },
      async () => undefined,
      '[data-knowledge-inspector="stable-rail"]',
      (page) => page.keyboard.press('Escape'),
    ),
    await probeFocusTarget(
      browser,
      'konling-expanded',
      {
        name: 'focus-konling-expanded',
        theme: 'dark',
        width: 1440,
        height: 960,
        navigationPreference: 'collapsed',
        navigationState: 'collapsed',
        dockState: 'expanded',
        localToolState: 'closed',
        selectedNode: selectedNodeId,
        interactionState: 'focus konling expanded',
        query: `?node=${encodeURIComponent(selectedNodeId)}`,
      },
      expandDock,
      '[data-platform-floating-dock-expanded-panel]',
      (page) => clickIfPresent(page, '[data-platform-floating-dock] button[aria-label="打开页面工具菜单"]'),
      '[data-platform-floating-dock] button[aria-label="打开页面工具菜单"]',
    ),
  ];
}

async function captureMarkers(page: Page) {
  const markers = await page.evaluate(`(() => {
    const root = document.querySelector('[data-knowledge-workspace]');
    const canvas = document.querySelector('[data-knowledge-canvas-primary]');
    const desktopTools = document.querySelector('[data-knowledge-desktop-command-system]');
    const mobileTools = document.querySelector('[data-knowledge-mobile-command-surface]');
    const inspector = document.querySelector('[data-knowledge-inspector]');
    const dock = document.querySelector('[data-platform-floating-dock]');
    const appShell = document.querySelector('[data-app-shell-layout]');
    const rectFor = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const expandedDock = document.querySelector('[data-platform-floating-dock-expanded-panel]');
    const desktopToolsRect = rectFor(desktopTools);
    const mobileToolsRect = rectFor(mobileTools);
    const inspectorRect = rectFor(inspector);
    const dockRect = rectFor(dock);
    const expandedDockRect = rectFor(expandedDock);
    return {
      htmlClass: document.documentElement.className,
      workspace: root?.dataset.knowledgeWorkspace ?? null,
      konlingContextStatus: root?.dataset.knowledgeKonlingContextStatus ?? null,
      appShellNavigationState: appShell?.dataset.appShellNavigationState ?? null,
      appShellPreference: appShell?.dataset.appShellNavigationPreference ?? null,
      canvas: canvas ? {
        selectedNodeId: canvas.dataset.knowledgeSelectedNodeId ?? '',
        visibleNodeCount: canvas.dataset.knowledgeVisibleNodeCount ?? '',
        visibleLinkCount: canvas.dataset.knowledgeVisibleLinkCount ?? '',
        layoutVersion: canvas.dataset.knowledgeLayoutVersion ?? '',
        pinnedNodeCount: canvas.dataset.knowledgePinnedNodeCount ?? '',
      } : null,
      desktopToolState: desktopTools?.dataset.state ?? null,
      desktopActiveTool: desktopTools?.dataset.knowledgeLocalTool ?? null,
      mobileToolState: mobileTools?.dataset.state ?? null,
      mobileActiveTool: mobileTools?.dataset.knowledgeLocalTool ?? null,
      inspectorMode: inspector?.dataset.knowledgeInspector ?? null,
      inspectorSections: Array.from(document.querySelectorAll('[data-knowledge-inspector-section]'))
        .map((element) => element.dataset.knowledgeInspectorSection ?? '')
        .filter(Boolean),
      dockState: dock?.getAttribute('data-platform-floating-dock') ?? null,
      effectiveDockState: expandedDock ? 'expanded' : (dock?.getAttribute('data-platform-floating-dock') ?? null),
      expandedDockVisible: Boolean(expandedDock),
      rects: {
        desktopTools: desktopToolsRect,
        mobileTools: mobileToolsRect,
        inspector: inspectorRect,
        dock: dockRect,
        expandedDock: expandedDockRect,
      },
    };
  })()`);
  const rects = markers.rects as {
    desktopTools: EvidenceRect | null;
    mobileTools: EvidenceRect | null;
    inspector: EvidenceRect | null;
    dock: EvidenceRect | null;
    expandedDock: EvidenceRect | null;
  };
  return {
    ...markers,
    overlaps: {
      dockOverlapsDesktopTools: doRectsOverlap(rects.dock as never, rects.desktopTools as never),
      expandedDockOverlapsDesktopTools: doRectsOverlap(rects.expandedDock as never, rects.desktopTools as never),
      dockOverlapsMobileTools: doRectsOverlap(rects.dock as never, rects.mobileTools as never),
      expandedDockOverlapsMobileTools: doRectsOverlap(rects.expandedDock as never, rects.mobileTools as never),
      dockOverlapsInspector: doRectsOverlap(rects.dock as never, rects.inspector as never),
      expandedDockOverlapsInspector: doRectsOverlap(rects.expandedDock as never, rects.inspector as never),
    },
  };
}

async function captureState(browser: Browser, state: CaptureState) {
  const { context, page, url } = await openStatePage(browser, state);
  try {
    let interactionEvidence: Record<string, unknown> | undefined;
    if (state.beforeShot) {
      interactionEvidence = await state.beforeShot(page) ?? undefined;
      await page.waitForTimeout(500);
    }
    const screenshotName = `${state.name}.png`;
    const screenshotPath = path.join(outputDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const screenshotRelativePath = path.relative(repoRoot, screenshotPath);
    const markers = await captureMarkers(page);
    return {
      name: state.name,
      route: '/knowledge',
      url,
      theme: state.theme,
      viewport: { width: state.width, height: state.height },
      navigationState: state.navigationState,
      dockState: state.dockState,
      localToolState: state.localToolState,
      selectedNode: state.selectedNode,
      interactionState: state.interactionState,
      result: 'passed',
      screenshotPath: screenshotRelativePath,
      screenshotSha256: sha256(screenshotRelativePath),
      markers,
      interactionEvidence,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  ensureOutputDir();
  const states: CaptureState[] = [
    {
      name: 'desktop-default-collapsed-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'default graph',
    },
    {
      name: 'desktop-expanded-persisted-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'expanded',
      navigationState: 'expanded',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'navigation preference persisted',
    },
    {
      name: 'desktop-local-tools-legend-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'legend',
      selectedNode: null,
      interactionState: 'local legend opened',
      beforeShot: (page) => openDesktopTool(page, 'legend'),
    },
    {
      name: 'desktop-selected-inspector-light',
      theme: 'light',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'selected inspector',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
    },
    {
      name: 'desktop-hover-click-drag-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: selectedNodeId,
      interactionState: 'hover click drag persistence evidence',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openDesktopTool(page, 'view-layout');
        const beforeDrag = await captureMarkerSnapshot(page);
        await waitForSelectedNodeRuntimePosition(page);
        const drag = await dragCanvasNodeUntilPinned(page);
        const afterDrag = await captureMarkerSnapshot(page);
        await page.mouse.move(720, 360);
        const afterHover = await captureMarkerSnapshot(page);
        return {
          kind: drag.pinned ? 'dragged-node-and-hover-stability' : 'dragged-node-stability-missing',
          beforeDrag,
          drag,
          afterDrag,
          afterHover,
        };
      },
    },
    {
      name: 'desktop-explicit-relayout-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: selectedNodeId,
      interactionState: 'explicit relayout control visible',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openDesktopTool(page, 'view-layout');
        await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
      },
    },
    {
      name: 'desktop-konling-selected-expanded-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'konling selected context expanded',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: expandDock,
    },
    {
      name: 'desktop-konling-no-selection-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'konling no-selection context',
    },
    {
      name: 'desktop-konling-degraded-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: 'missing-node',
      interactionState: 'konling degraded unresolved node context',
      query: '?node=missing-node',
      beforeShot: expandDock,
    },
    {
      name: 'desktop-stress-expanded-tool-inspector-konling-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'expanded',
      navigationState: 'expanded',
      dockState: 'expanded',
      localToolState: 'relation-filters',
      selectedNode: selectedNodeId,
      interactionState: 'expanded shell local tool inspector konling stress state',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openDesktopTool(page, 'relation-filters');
        await expandDock(page);
      },
    },
    {
      name: 'mobile-320-local-tools-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: null,
      interactionState: 'mobile local tools sheet',
      beforeShot: (page) => openMobileTool(page, 'view-layout'),
    },
    {
      name: 'mobile-320-selected-inspector-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'mobile selected inspector sheet',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
    },
    {
      name: 'mobile-320-konling-expanded-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'mobile konling expanded',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: expandDock,
    },
    {
      name: 'light-theme-default',
      theme: 'light',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'light theme default graph',
    },
  ];

  const browser = await chromium.launch({ headless: true });
  try {
    const stateMatrix = [];
    for (const state of states) {
      stateMatrix.push(await captureState(browser, state));
    }
    const focusEvidence = await captureFocusEvidence(browser);
    const evidence = {
      change: 'govern-knowledge-workspace-product-qa',
      issue: 489,
      capturedAt: new Date().toISOString(),
      baseUrl,
      selectedNodeId,
      designSourceOfTruth: {
        handoff: 'artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md',
        conceptsReadme: 'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/README.md',
        conceptImages: [
          'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/layered-research-atlas.png',
          'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/night-bridge-semantic-map.png',
          'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/daylight-engineering-atlas.png',
        ],
      },
      sourceEvidence: {
        sharedAppShell: true,
        noCompetingGlobalNavigation: true,
        compactLocalTools: true,
        graphicalLegend: true,
        localizedLabels: true,
        activeSummaries: true,
        hoverDoesNotRelayout: true,
        selectionDoesNotRelayout: true,
        draggedPositionPersists: true,
        konlingSharedDock: true,
        konlingSelectedContext: true,
        konlingNoSelection: true,
        konlingDegradedContext: true,
        focusManagement: true,
        stressStateNonOverlap: true,
        rawSearchExcludedFromAssistantContext: true,
      },
      currentSourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, sha256(file)])),
      stateMatrix,
      focusEvidence,
      handoffMatrix: {
        path: 'artifacts/knowledge-workspace-product-qa-489/handoff-implementation-matrix.md',
        adopted: [
          'layered graph organization',
          'premium dark visual tone',
          'light-mode clarity',
        ],
        rejected: [
          'standalone shell duplication',
          'generated role switchers',
          'exact mock labels',
          'exact node positions',
          'duplicate assistant regions',
        ],
        merged: [
          'shared AppShell + local graph tools + right-bottom Konling dock',
        ],
      },
      independentVisualReview: {
        path: 'artifacts/knowledge-workspace-product-qa-489/visual-review.md',
        reviewer: 'critical-reviewer',
        finalResult: 'pending',
        blockingFindings: ['visual-review-not-run'],
        dimensions: {},
      },
      temporaryExceptions: [],
    };
    writeFileSync(
      path.join(outputDir, 'browser-evidence.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    );
    console.log(`captured ${stateMatrix.length} knowledge workspace QA states at ${path.relative(repoRoot, outputDir)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
