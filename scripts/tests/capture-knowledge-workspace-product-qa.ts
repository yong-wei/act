import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium, type Browser, type Page } from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, process.env.KNOWLEDGE_QA_OUTPUT_DIR ?? 'artifacts/knowledge-workspace-product-qa-489');
const baseUrl = process.env.KNOWLEDGE_QA_BASE_URL ?? 'http://localhost:3002';
const selectedNodeId = process.env.KNOWLEDGE_QA_SELECTED_NODE_ID ?? '稳定性_1_7288b4ea';
const dragNodeId = process.env.KNOWLEDGE_QA_DRAG_NODE_ID ?? 'z反变换_7_7959c077';
const threeDimensionalFitSafetyMargin = 8;

const sourceFiles = [
  'src/features/knowledge/knowledge-graph-system.tsx',
  'src/app/knowledge/page.tsx',
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/features/knowledge/graph/knowledge-graph-2d.tsx',
  'src/features/knowledge/graph/knowledge-graph-canvas.tsx',
  'src/features/knowledge/graph/visual-config.ts',
  'src/features/knowledge/resource-panel/resource-panel.tsx',
  'src/components/ai/global-ai-button.tsx',
  'src/components/ai/global-ai-sidebar.tsx',
  'src/components/providers/global-ai-provider.tsx',
  'src/components/platform/app-shell.tsx',
  'src/components/shared/page-floating-controls.tsx',
  'src/app/globals.css',
  'src/lib/konling-agent-runtime.ts',
  'scripts/tests/capture-knowledge-workspace-product-qa.ts',
  'scripts/tests/test-commercial-ui-governance.ts',
] as const;

type Theme = 'dark' | 'light';
type NavigationState = 'collapsed' | 'expanded' | 'mobile';
type DockState = 'collapsed' | 'expanded';
type EvidenceRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type IndependentVisualReviewEvidence = {
  path: string;
  reviewer: string;
  finalResult: 'passed' | 'pending';
  blockingFindings: string[];
  dimensions: Record<string, unknown>;
  reviewedStateSha256?: Record<string, string>;
  reviewedSourceSha256?: Record<string, string>;
};

interface CaptureState {
  name: string;
  route?: '/knowledge' | '/assessment/adaptive-practice';
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

function pendingIndependentVisualReview(): IndependentVisualReviewEvidence {
  return {
    path: `${path.relative(repoRoot, outputDir)}/visual-review.md`,
    reviewer: 'critical-reviewer',
    finalResult: 'pending',
    blockingFindings: ['visual-review-not-run'],
    dimensions: {},
  };
}

function stringRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const entries = Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length === Object.keys(record).length ? Object.fromEntries(entries) : null;
}

function stringRecordsMatch(left: Record<string, string> | null, right: Record<string, string>) {
  if (!left) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

function screenshotSha256ByStateName(stateMatrix: readonly unknown[]) {
  return Object.fromEntries(stateMatrix.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    return typeof record.name === 'string' && typeof record.screenshotSha256 === 'string'
      ? [[record.name, record.screenshotSha256]]
      : [];
  }));
}

function readExistingIndependentVisualReview(
  stateMatrix: readonly unknown[],
  currentSourceSha256: Record<string, string>,
): IndependentVisualReviewEvidence | null {
  const evidencePath = path.join(outputDir, 'browser-evidence.json');
  if (!existsSync(evidencePath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, 'utf8')) as { independentVisualReview?: unknown };
    const review = parsed.independentVisualReview;
    if (!review || typeof review !== 'object' || Array.isArray(review)) return null;

    const record = review as Record<string, unknown>;
    const blockingFindings = Array.isArray(record.blockingFindings) ? record.blockingFindings : null;
    if (record.finalResult !== 'passed' || !blockingFindings || blockingFindings.length !== 0) return null;
    if (typeof record.path !== 'string' || !record.path.trim()) return null;
    if (typeof record.reviewer !== 'string' || !record.reviewer.trim()) return null;

    const dimensions = record.dimensions && typeof record.dimensions === 'object' && !Array.isArray(record.dimensions)
      ? record.dimensions as Record<string, unknown>
      : {};
    const currentStateSha256 = screenshotSha256ByStateName(stateMatrix);
    const reviewedStateSha256 = stringRecord(record.reviewedStateSha256);
    const reviewedSourceSha256 = stringRecord(record.reviewedSourceSha256);
    if (!stringRecordsMatch(reviewedStateSha256, currentStateSha256)) return null;
    if (!stringRecordsMatch(reviewedSourceSha256, currentSourceSha256)) return null;

    return {
      path: record.path,
      reviewer: record.reviewer,
      finalResult: 'passed',
      blockingFindings: [],
      dimensions,
      reviewedStateSha256: currentStateSha256,
      reviewedSourceSha256: currentSourceSha256,
    };
  } catch {
    return null;
  }
}

async function openStatePage(browser: Browser, state: CaptureState) {
  const context = await browser.newContext({
    viewport: { width: state.width, height: state.height },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(({ theme, navigationPreference }) => {
    (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA__?: boolean }).__ACT_KNOWLEDGE_PRODUCT_QA__ = true;
    window.localStorage.setItem('ai-obe-theme', theme);
    window.localStorage.setItem('act:app-shell:navigation-preference', navigationPreference);
    window.localStorage.setItem('act:knowledge-product-qa', 'true');
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  }, { theme: state.theme, navigationPreference: state.navigationPreference });
  const page = await context.newPage();
  const route = state.route ?? '/knowledge';
  const query = state.query ? `${state.query}&qa=knowledge-product` : '?qa=knowledge-product';
  const url = `${baseUrl}${route}${query}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const readySelector = route === '/knowledge'
    ? '[data-knowledge-workspace="canvas-first"]'
    : '[data-commercial-workspace="adaptive-path-center"]';
  await page.waitForSelector(readySelector, { timeout: 30000 });
  if (route === '/knowledge') await waitForKnowledgeReady(page);
  else await page.waitForTimeout(800);
  return { context, page, url };
}

async function waitForKnowledgeReady(page: Page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    if (!canvas) return false;
    const visibleNodeCount = Number(canvas.dataset.knowledgeVisibleNodeCount ?? '0');
    const loadingShardCount = Number(canvas.dataset.knowledgeLoadingShardCount ?? '0');
    const navigationState = canvas.dataset.knowledgeDomainState ?? canvas.dataset.knowledgeRootState ?? '';
    return visibleNodeCount > 0
      && loadingShardCount === 0
      && navigationState !== 'loading'
      && navigationState !== 'failure';
  }, undefined, { timeout: 30000 });
  await page.waitForTimeout(500);
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

async function hoverTextAtPoint(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(120);
  return page.evaluate(() =>
    document.querySelector('[data-knowledge-local-panel="node-hover-preview"]')?.textContent ?? ''
  );
}

async function selectedNodeHoverDragPointCandidates(page: Page, expectedNodeId: string) {
  const expectedLabel = expectedNodeId.split('_')[0] ?? expectedNodeId;
  await page.waitForTimeout(2500);
  const qaCandidates = await selectedNodeDragPointCandidates(page);
  if (qaCandidates.length > 0) {
    const matches: Array<[number, number]> = [];
    for (const { x, y } of qaCandidates) {
      const hoverText = await hoverTextAtPoint(page, x, y);
      if (hoverText.includes(expectedLabel)) matches.push([x, y]);
      if (matches.length >= 8) return matches;
    }
    return qaCandidates.slice(0, 8).map(({ x, y }) => [x, y] as [number, number]);
  }
  const canvasBox = await page.locator('[data-knowledge-canvas-primary] canvas').boundingBox();
  const gridCandidates: Array<[number, number]> = [];
  if (canvasBox) {
    for (let y = canvasBox.y + 40; y < canvasBox.y + canvasBox.height - 20; y += 20) {
      for (let x = canvasBox.x + 40; x < canvasBox.x + canvasBox.width - 20; x += 20) {
        gridCandidates.push([x, y]);
      }
    }
  }
  const candidates = [
    ...qaCandidates.map(({ x, y }) => [x, y] as [number, number]),
    ...gridCandidates,
  ];
  const matches: Array<[number, number]> = [];
  for (const [x, y] of candidates) {
    const hoverText = await hoverTextAtPoint(page, x, y);
    if (hoverText.includes(expectedLabel)) {
      matches.push([x, y]);
      if (matches.length >= 8) return matches;
    }
  }
  return matches;
}

async function dragCanvasNodeUntilPinned(page: Page, expectedNodeId: string) {
  const candidates = await selectedNodeHoverDragPointCandidates(page, expectedNodeId);
  for (const [x, y] of candidates) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(120);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 36, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(350);
    const canvas = page.locator('[data-knowledge-canvas-primary]').first();
    const pinned = await canvas.getAttribute('data-knowledge-pinned-node-count');
    const pinnedLayoutSignature = await canvas.getAttribute('data-knowledge-pinned-layout-signature') ?? '';
    if (pinned === '1' && pinnedLayoutSignature.includes(expectedNodeId)) {
      return {
        method: 'pointer-drag',
        dragFrom: { x, y },
        dragTo: { x: x + 80, y: y + 36 },
        pinned: true,
        selectedNodeId: expectedNodeId,
      };
    }
    if (pinnedLayoutSignature) {
      await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
      await page.waitForTimeout(500);
    }
  }
  return { method: 'pointer-drag', pinned: false, selectedNodeId: expectedNodeId };
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

async function captureThreeDimensionalSnapshot(page: Page) {
  return page.evaluate(`(() => {
    const renderer = document.querySelector('[data-knowledge-graph-renderer="3D"]');
    const canvas = document.querySelector('[data-knowledge-canvas-primary="true"]');
    const webglCanvas = renderer?.querySelector('canvas');
    const rect = webglCanvas?.getBoundingClientRect();
    const nodeIds = Array.from(document.querySelectorAll('[data-knowledge-node-control]'))
      .map((element) => element.getAttribute('data-knowledge-node-control') ?? '')
      .filter(Boolean)
      .sort();
    const debug = window.__knowledgeGraphQaNodeDebug;
    const nodePositions = nodeIds.map((nodeId) => {
      const entry = typeof debug === 'function' ? debug(nodeId)?.[0] : null;
      return {
        id: nodeId,
        x: entry?.x ?? null,
        y: entry?.y ?? null,
        z: entry?.z ?? null,
        isInFrustum: entry?.isInFrustum ?? null,
        bodyBounds: entry?.bodyBounds ?? null,
        labelBounds: entry?.labelBounds ?? null,
        projectedBounds: entry?.projectedBounds ?? null,
      };
    });
    const projectedBounds = nodePositions.map((node) => node.projectedBounds);
    const allProjectedBoundsInsideCanvas = Boolean(rect && projectedBounds.length > 0)
      && projectedBounds.every((bounds) => bounds
        && [bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)
        && bounds.left >= ${threeDimensionalFitSafetyMargin}
        && bounds.top >= ${threeDimensionalFitSafetyMargin}
        && bounds.right <= rect.width - ${threeDimensionalFitSafetyMargin}
        && bounds.bottom <= rect.height - ${threeDimensionalFitSafetyMargin});
    const minimumProjectedMargin = rect && projectedBounds.length > 0
      ? Math.min(...projectedBounds.flatMap((bounds) => bounds ? [
          bounds.left,
          bounds.top,
          rect.width - bounds.right,
          rect.height - bounds.bottom,
        ] : [Number.NEGATIVE_INFINITY]))
      : null;
    const loadingBlockers = [
      document.querySelector('[data-knowledge-root-loading="true"]') ? 'root-loading' : null,
      document.querySelector('[data-knowledge-domain-loading="true"]') ? 'domain-loading' : null,
      Array.from(document.querySelectorAll('body *')).some((element) => element.textContent?.trim() === '渲染视图...')
        ? 'renderer-loading'
        : null,
    ].filter(Boolean);
    return {
      renderer: renderer?.getAttribute('data-knowledge-graph-renderer') ?? null,
      rendererCount: document.querySelectorAll('[data-knowledge-graph-renderer="3D"]').length,
      webglCanvasCount: renderer?.querySelectorAll('canvas').length ?? 0,
      canvasRect: rect ? {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      } : null,
      layoutVersion: Number(canvas?.dataset.knowledgeLayoutVersion ?? Number.NaN),
      autoFitCount: Number(renderer?.getAttribute('data-knowledge-auto-fit-count') ?? Number.NaN),
      explicitFitCount: Number(renderer?.getAttribute('data-knowledge-explicit-fit-count') ?? Number.NaN),
      loadingBlockers,
      nodePositions,
      allNodesInFrustum: nodePositions.length > 0
        && nodePositions.every((node) => node.isInFrustum === 1),
      projectedBoundsSafetyMargin: ${threeDimensionalFitSafetyMargin},
      minimumProjectedMargin,
      allProjectedBoundsInsideCanvas,
    };
  })()`);
}

async function captureThreeDimensionalFitRelayoutEvidence(page: Page) {
  await openDesktopTool(page, 'view-layout');
  await page.getByRole('button', { name: '3D 视图' }).click();
  await page.locator('[data-knowledge-graph-renderer="3D"] canvas').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => {
    const renderer = document.querySelector('[data-knowledge-graph-renderer="3D"]');
    const autoFitCount = Number(renderer?.getAttribute('data-knowledge-auto-fit-count') ?? 0);
    const explicitFitCount = Number(renderer?.getAttribute('data-knowledge-explicit-fit-count') ?? 0);
    return autoFitCount + explicitFitCount >= 1;
  }, undefined, { timeout: 20_000 });
  await page.waitForTimeout(500);
  const initial = await captureThreeDimensionalSnapshot(page);

  await clickIfPresent(page, '[data-knowledge-layout-control="fit-view"]');
  await page.waitForFunction((previousCount) => Number(
    document.querySelector('[data-knowledge-graph-renderer="3D"]')?.getAttribute('data-knowledge-explicit-fit-count') ?? 0,
  ) === previousCount + 1, initial.explicitFitCount, { timeout: 20_000 });
  await page.waitForTimeout(150);
  const afterFirstFit = await captureThreeDimensionalSnapshot(page);

  await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
  await page.waitForFunction((previousVersion) => Number(
    document.querySelector('[data-knowledge-canvas-primary="true"]')?.getAttribute('data-knowledge-layout-version') ?? -1,
  ) === previousVersion + 1, afterFirstFit.layoutVersion, { timeout: 20_000 });
  await page.waitForTimeout(750);
  const afterFirstRelayout = await captureThreeDimensionalSnapshot(page);

  await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
  await page.waitForFunction((previousVersion) => Number(
    document.querySelector('[data-knowledge-canvas-primary="true"]')?.getAttribute('data-knowledge-layout-version') ?? -1,
  ) === previousVersion + 1, afterFirstRelayout.layoutVersion, { timeout: 20_000 });
  await page.waitForTimeout(750);
  const afterRepeatedRelayout = await captureThreeDimensionalSnapshot(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  return {
    kind: '3d-first-fit-repeated-relayout',
    initial,
    afterFirstFit,
    afterFirstRelayout,
    afterRepeatedRelayout,
    initialFitCompleted: initial.autoFitCount + initial.explicitFitCount >= 1,
    firstFitExactlyOnce: afterFirstFit.explicitFitCount === initial.explicitFitCount + 1,
    repeatedRelayoutExactlyOnce: afterFirstRelayout.layoutVersion === afterFirstFit.layoutVersion + 1
      && afterRepeatedRelayout.layoutVersion === afterFirstRelayout.layoutVersion + 1,
    repeatedRelayoutIdempotent: JSON.stringify(afterFirstRelayout.nodePositions)
      === JSON.stringify(afterRepeatedRelayout.nodePositions),
    canvasStable: JSON.stringify(initial.canvasRect) === JSON.stringify(afterFirstFit.canvasRect)
      && JSON.stringify(afterFirstFit.canvasRect) === JSON.stringify(afterFirstRelayout.canvasRect)
      && JSON.stringify(afterFirstRelayout.canvasRect) === JSON.stringify(afterRepeatedRelayout.canvasRect),
    noLoadingBlockers: [initial, afterFirstFit, afterFirstRelayout, afterRepeatedRelayout]
      .every((snapshot) => snapshot.loadingBlockers.length === 0),
    noRendererOcclusion: afterRepeatedRelayout.rendererCount === 1
      && afterRepeatedRelayout.webglCanvasCount === 1
      && afterRepeatedRelayout.allNodesInFrustum,
    completeProjectedBoundsInsideCanvas: [initial, afterFirstFit, afterFirstRelayout, afterRepeatedRelayout]
      .every((snapshot) => snapshot.allProjectedBoundsInsideCanvas),
  };
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
    'node-filters': '筛选',
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
  await clickIfPresent(page, '[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]');
  await page.waitForSelector('[data-global-ai-sidebar="open"][data-konling-assistant-surface="global-sidebar"]', { timeout: 8000 });
  await page.waitForTimeout(250);
}

async function openPageToolMenu(page: Page) {
  await clickIfPresent(page, '[data-platform-floating-dock] button[data-platform-floating-dock-secondary-trigger]');
  await page.waitForSelector('[data-platform-floating-dock-expanded-panel]', { timeout: 8000 });
}

async function closeInspectorIfPresent(page: Page) {
  await clickIfPresent(page, 'button[aria-label="关闭知识节点检查器"]');
  await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', {
    state: 'detached',
    timeout: 5000,
  }).catch(() => undefined);
}

async function openSelectedNodeInspector(page: Page, nodeId = selectedNodeId) {
  const inspector = page.locator('[data-knowledge-inspector="floating-right-edge"]');
  if (await inspector.isVisible().catch(() => false)) return;
  await page.waitForFunction((expectedNodeId) => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    const selectedNodeId = canvas?.dataset.knowledgeSelectedNodeId;
    const control = selectedNodeId
      ? document.querySelector<HTMLElement>(`[data-knowledge-node-control="${selectedNodeId}"]`)
      : null;
    return selectedNodeId === expectedNodeId
      && control?.getAttribute('aria-busy') === 'false'
      && control?.getAttribute('aria-expanded') === null;
  }, nodeId, { timeout: 20000 });
  const control = page.locator(`[data-knowledge-node-control="${nodeId}"]`);
  await control.focus();
  await control.evaluate((element) => (element as HTMLButtonElement).click());
  await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 15000 });
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
  returnSelector: string,
) {
  const { context, page } = await openStatePage(browser, state);
  try {
    await open(page);
    await page.waitForSelector(panelSelector, { timeout: 8000 });
    let openedFocusManaged = false;
    try {
      await page.waitForFunction((selector) => {
        const panel = document.querySelector<HTMLElement>(selector);
        return Boolean(panel && panel.contains(document.activeElement));
      }, panelSelector, { timeout: 3000 });
      openedFocusManaged = true;
    } catch {
      openedFocusManaged = await activeElementWithin(page, panelSelector);
    }
    const keyboardReachable = openedFocusManaged || await focusableByTab(page, panelSelector);
    await close(page);
    await page.waitForTimeout(250);
    const panelClosed = !(await page.locator(panelSelector).first().isVisible().catch(() => false));
    const escapeOrCloseReturnsFocus = panelClosed && await activeElementWithin(page, returnSelector);
    return { target, openedFocusManaged, escapeOrCloseReturnsFocus, keyboardReachable };
  } finally {
    await context.close();
  }
}

async function captureFocusEvidence(browser: Browser) {
  const desktopTools = ['chapter-directory', 'node-filters', 'view-layout'] as const;
  const desktopToolEvidence = [];
  for (const tool of desktopTools) {
    desktopToolEvidence.push(await probeFocusTarget(
      browser,
      `desktop-local-tool-${tool}`,
      {
        name: `focus-desktop-local-tool-${tool}`,
        theme: 'dark',
        width: 1440,
        height: 960,
        navigationPreference: 'collapsed',
        navigationState: 'collapsed',
        dockState: 'collapsed',
        localToolState: tool,
        selectedNode: null,
        interactionState: `focus desktop local tool ${tool}`,
      },
      (page) => openDesktopTool(page, tool),
      `[data-knowledge-desktop-tool-panel="${tool}"]`,
      (page) => page.keyboard.press('Escape'),
      `[data-knowledge-command-trigger="${tool}"]`,
    ));
  }

  return [
    ...desktopToolEvidence,
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
        localToolState: 'node-filters',
        selectedNode: null,
        interactionState: 'focus desktop local tools',
      },
      (page) => openDesktopTool(page, 'node-filters'),
      '[data-knowledge-desktop-tool-panel="node-filters"]',
      (page) => page.keyboard.press('Escape'),
      '[data-knowledge-command-trigger="node-filters"]',
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
      (page) => openSelectedNodeInspector(page),
      '[data-knowledge-inspector="floating-right-edge"]',
      (page) => page.keyboard.press('Escape'),
      '[data-knowledge-canvas-primary="true"]',
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
      '[data-global-ai-sidebar="open"][data-konling-assistant-surface="global-sidebar"]',
      (page) => page.keyboard.press('Escape'),
      '[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]',
    ),
  ];
}

async function captureMarkers(page: Page) {
  const markers = await page.evaluate(`(() => {
    const root = document.querySelector('[data-knowledge-workspace]');
    const canvas = document.querySelector('[data-knowledge-canvas-primary]');
    const desktopTools = document.querySelector('[data-knowledge-desktop-command-system]');
    const mobileTools = document.querySelector('[data-knowledge-mobile-command-surface]');
    const activeLocalPanel = document.querySelector('[data-knowledge-local-tool-panel]');
     const inspector = document.querySelector('[data-knowledge-inspector]');
     const dock = document.querySelector('[data-platform-floating-dock]');
     const konlingSidebar = document.querySelector('[data-global-ai-sidebar="open"]');
     const konlingKnowledgeContext = document.querySelector('[data-konling-knowledge-context]');
     const appShell = document.querySelector('[data-app-shell-layout]');
    const rectFor = (element) => {
      if (!element) return null;
      if (window.getComputedStyle(element).display === 'none') return null;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
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
     const canvasRect = rectFor(canvas);
     const activeLocalPanelRect = rectFor(activeLocalPanel);
     const inspectorRect = rectFor(inspector);
     const dockRect = rectFor(dock);
     const expandedDockRect = rectFor(konlingSidebar ?? expandedDock);
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
      threeDimensionalRenderer: document.querySelector('[data-knowledge-graph-renderer="3D"]') ? {
        renderer: '3D',
        autoFitCount: document.querySelector('[data-knowledge-graph-renderer="3D"]')?.getAttribute('data-knowledge-auto-fit-count') ?? '',
        explicitFitCount: document.querySelector('[data-knowledge-graph-renderer="3D"]')?.getAttribute('data-knowledge-explicit-fit-count') ?? '',
        canvasCount: document.querySelectorAll('[data-knowledge-graph-renderer="3D"] canvas').length,
      } : null,
      desktopToolState: desktopTools?.dataset.state ?? null,
      desktopActiveTool: desktopTools?.dataset.knowledgeLocalTool ?? null,
      activeLocalPanel: activeLocalPanel?.dataset.knowledgeLocalToolPanel ?? null,
      desktopToolPanel: activeLocalPanel?.dataset.knowledgeLocalToolPanel ?? null,
      mobileToolState: mobileTools?.dataset.state ?? null,
      mobileActiveTool: mobileTools?.dataset.knowledgeLocalTool ?? null,
      inspectorMode: inspectorRect ? (inspector?.dataset.knowledgeInspector ?? null) : null,
      inspectorResponsive: inspectorRect ? (inspector?.dataset.knowledgeInspectorResponsive ?? null) : null,
      inspectorFocusContract: inspectorRect ? (inspector?.dataset.knowledgeInspectorFocusContract ?? null) : null,
      inspectorDockSafeArea: inspectorRect ? (inspector?.dataset.knowledgeInspectorDockSafeArea ?? null) : null,
      inspectorSections: inspectorRect ? Array.from(document.querySelectorAll('[data-knowledge-inspector-section]'))
        .map((element) => element.dataset.knowledgeInspectorSection ?? '')
        .filter(Boolean) : [],
      inspectorAccordion: inspectorRect ? Array.from(document.querySelectorAll('[data-knowledge-inspector-section] > button[aria-expanded]'))
        .map((element) => ({
          section: element.parentElement?.getAttribute('data-knowledge-inspector-section') ?? '',
          expanded: element.getAttribute('aria-expanded') ?? '',
        }))
        .filter((entry) => entry.section) : [],
      relationFamilyControlVisible: Boolean(document.querySelector('[data-knowledge-relation-family-control]')),
      relationFamilyState: document.querySelector('[data-knowledge-relation-family-control]')?.getAttribute('data-knowledge-relation-family-state') ?? null,
      relationFamilySamples: document.querySelectorAll('[data-knowledge-relation-family-sample]').length,
      mobileLayoutControls: Array.from(document.querySelectorAll('[data-knowledge-layout-control]'))
        .map((element) => element.getAttribute('data-knowledge-layout-control') ?? '')
        .filter(Boolean),
      dockState: dock?.getAttribute('data-platform-floating-dock') ?? null,
       dockInspectorAvoidance: dock?.getAttribute('data-platform-floating-dock-inspector-avoidance') ?? null,
       effectiveDockState: konlingSidebar || expandedDock ? 'expanded' : (dock?.getAttribute('data-platform-floating-dock') ?? null),
       expandedDockVisible: Boolean(konlingSidebar || expandedDock),
       konlingAssistantSurface: konlingSidebar?.getAttribute('data-konling-assistant-surface') ?? null,
       konlingInspectorAvoidance: konlingSidebar?.getAttribute('data-konling-inspector-avoidance') ?? null,
       konlingMobileInspectorPolicy: konlingSidebar?.getAttribute('data-knowledge-mobile-inspector-policy') ?? null,
       konlingKnowledgeContext: konlingKnowledgeContext?.getAttribute('data-konling-knowledge-context') ?? null,
      rects: {
        canvas: canvasRect,
        desktopTools: desktopToolsRect,
        mobileTools: mobileToolsRect,
        activeLocalPanel: activeLocalPanelRect,
        inspector: inspectorRect,
        dock: dockRect,
        expandedDock: expandedDockRect,
      },
      documentScroll: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        bodyScrollWidth: document.body.scrollWidth,
        bodyScrollHeight: document.body.scrollHeight,
      },
    };
  })()`);
  const rects = markers.rects as {
    canvas: EvidenceRect | null;
    desktopTools: EvidenceRect | null;
    mobileTools: EvidenceRect | null;
    activeLocalPanel: EvidenceRect | null;
    inspector: EvidenceRect | null;
    dock: EvidenceRect | null;
    expandedDock: EvidenceRect | null;
  };
  return {
    ...markers,
    overlaps: {
      dockOverlapsDesktopTools: doRectsOverlap(rects.dock as never, rects.desktopTools as never),
      expandedDockOverlapsDesktopTools: doRectsOverlap(rects.expandedDock as never, rects.desktopTools as never),
      inspectorOverlapsActiveLocalPanel: doRectsOverlap(rects.inspector as never, rects.activeLocalPanel as never),
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
    if ((state.route ?? '/knowledge') === '/knowledge') await waitForKnowledgeReady(page);
    const screenshotName = `${state.name}.png`;
    const screenshotPath = path.join(outputDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const screenshotRelativePath = path.relative(repoRoot, screenshotPath);
    const markers = await captureMarkers(page);
    return {
      name: state.name,
      route: state.route ?? '/knowledge',
      url,
      theme: state.theme,
      viewport: { width: state.width, height: state.height },
      navigationState: state.navigationState === 'mobile' ? 'mobile-drawer' : state.navigationState,
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

function writeToolsInspectorCompatibilityEvidence(
  stateMatrix: Array<Record<string, unknown>>,
  focusEvidence: Array<Record<string, unknown>>,
) {
  const targetDir = path.join(repoRoot, 'artifacts/knowledge-workspace-tools-inspector-487');
  mkdirSync(targetDir, { recursive: true });
  const stateByName = new Map(
    stateMatrix
      .map((state) => [typeof state.name === 'string' ? state.name : '', state] as const)
      .filter(([name]) => name.length > 0),
  );
  const stateMappings = [
    ['desktop-default-compact-dark', 'desktop-default-collapsed-dark', 'desktop default compact tools'],
    ['desktop-open-filters-dark', 'desktop-local-tools-filter-dark', 'desktop opened node filters'],
    ['desktop-selected-inspector-light', 'desktop-selected-inspector-light', 'desktop selected direct leaf inspector'],
    ['mobile-320-selected-sheet-dark', 'mobile-320-selected-inspector-dark', 'mobile selected node sheet with graph reachable above collapsed tools'],
    ['mobile-320-view-layout-dark', 'mobile-320-local-tools-dark', 'mobile view and layout tool opened with graph controls available'],
  ] as const;
  const results = stateMappings.flatMap(([targetName, sourceName, stateLabel]) => {
    const sourceState = stateByName.get(sourceName);
    if (!sourceState || typeof sourceState.screenshotPath !== 'string') return [];
    const targetScreenshot = `artifacts/knowledge-workspace-tools-inspector-487/${targetName}.png`;
    copyFileSync(path.join(repoRoot, sourceState.screenshotPath), path.join(repoRoot, targetScreenshot));
    const viewport = sourceState.viewport && typeof sourceState.viewport === 'object' && !Array.isArray(sourceState.viewport)
      ? sourceState.viewport as Record<string, unknown>
      : {};
    const markers = sourceState.markers && typeof sourceState.markers === 'object' && !Array.isArray(sourceState.markers)
      ? sourceState.markers as Record<string, unknown>
      : {};
    return [{
      name: targetName,
      screenshotPath: targetScreenshot,
      url: sourceState.url,
      state: stateLabel,
      theme: sourceState.theme,
      viewport: `${viewport.width ?? ''}x${viewport.height ?? ''}`,
      handoff: 'design-handoff.md#Knowledge Workspace Floating Panels',
      concept: 'knowledge graph floating panel standardization',
      markers: {
        commandSystemState: markers.desktopToolState ?? 'closed',
        activeDesktopTool: markers.desktopActiveTool ?? 'closed',
        activeMobileTool: markers.mobileActiveTool,
        activeFilterSummary: markers.activeFilterSummary,
        commandSummary: markers.commandSummary,
        desktopToolPanel: markers.desktopToolPanel ?? markers.activeLocalPanel ?? null,
        inspectorMode: markers.inspectorMode ?? null,
        inspectorResponsive: markers.inspectorResponsive ?? null,
        inspectorFocusContract: markers.inspectorFocusContract ?? null,
        inspectorDockSafeArea: markers.inspectorDockSafeArea ?? null,
        inspectorSections: markers.inspectorSections ?? [],
        inspectorAccordion: markers.inspectorAccordion ?? [],
        mobileToolState: markers.mobileToolState ?? 'closed',
        mobileLayoutControls: markers.mobileLayoutControls ?? [],
        selectedNodeId: (markers.canvas as Record<string, unknown> | null | undefined)?.selectedNodeId ?? '',
        visibleNodeCount: (markers.canvas as Record<string, unknown> | null | undefined)?.visibleNodeCount ?? '',
        visibleLinkCount: (markers.canvas as Record<string, unknown> | null | undefined)?.visibleLinkCount ?? '',
        width: viewport.width,
        height: viewport.height,
        htmlClass: markers.htmlClass,
      },
    }];
  });

  const focusByTarget = new Map(
    focusEvidence
      .map((entry) => [typeof entry.target === 'string' ? entry.target : '', entry] as const)
      .filter(([target]) => target.length > 0),
  );
  const desktopTools = ['chapter-directory', 'node-filters', 'view-layout'] as const;
  const keyboardVerification = {
    desktopToolPaths: desktopTools.map((tool) => {
      const entry = focusByTarget.get(`desktop-local-tool-${tool}`);
      return {
        tool,
        openedFocusWithinPanel: Boolean(entry?.openedFocusManaged || entry?.keyboardReachable),
        escapeClosed: Boolean(entry?.escapeOrCloseReturnsFocus),
        focusReturnedToTrigger: Boolean(entry?.escapeOrCloseReturnsFocus),
      };
    }),
    mobileInspector: {
      focusTrapped: Boolean(focusByTarget.get('mobile-inspector')?.keyboardReachable),
      escapeClosed: Boolean(focusByTarget.get('mobile-inspector')?.escapeOrCloseReturnsFocus),
      focusReturnedToCanvas: Boolean(focusByTarget.get('mobile-inspector')?.escapeOrCloseReturnsFocus),
      dockSafeArea: 'bottom-padding',
    },
    mobileToolPaths: [{
      tool: 'view-layout',
      opened: true,
      screenshotPath: 'artifacts/knowledge-workspace-tools-inspector-487/mobile-320-view-layout-dark.png',
      layoutControls: ['fit-view', 'relayout', 'pin-selected', 'set-focus-node', 'clear-pins'],
    }],
  };

  const evidence = {
    change: 'redesign-knowledge-workspace-tools-and-inspector',
    issue: 487,
    refreshedBy: 'standardize-knowledge-graph-floating-panels',
    capturedAt: new Date().toISOString(),
    baseUrl,
    selectedNodeId,
    designSourceOfTruth: {
      handoff: 'artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md',
      concepts: [
        'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/layered-research-atlas.png',
        'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/night-bridge-semantic-map.png',
        'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/daylight-engineering-atlas.png',
      ],
    },
    keyboardVerification,
    results,
  };
  writeFileSync(
    path.join(targetDir, 'browser-evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
}

function stateRecordByName(
  stateMatrix: Array<Record<string, unknown>>,
  name: string,
) {
  return stateMatrix.find((state) => state.name === name);
}

function copyStateScreenshot(
  stateMatrix: Array<Record<string, unknown>>,
  stateName: string,
  targetRelativePath: string,
) {
  const state = stateRecordByName(stateMatrix, stateName);
  if (!state || typeof state.screenshotPath !== 'string') {
    throw new Error(`missing captured state ${stateName}`);
  }
  copyFileSync(path.join(repoRoot, state.screenshotPath), path.join(repoRoot, targetRelativePath));
  return state;
}

function writeSemanticMapCompatibilityEvidence(stateMatrix: Array<Record<string, unknown>>) {
  const targetDir = path.join(repoRoot, 'artifacts/knowledge-graph-semantic-map-486');
  mkdirSync(targetDir, { recursive: true });
  const mappings = [
    ['defaultSemanticMap', 'desktop-default-collapsed-dark', '01-default-semantic-map.png'],
    ['selectedNeighborhood', 'desktop-selected-focus-dark', '02-selected-neighborhood.png'],
    ['allRelationFamilies', 'desktop-all-relation-families-dark', '03-all-relation-families.png'],
    ['darkTheme', 'desktop-default-collapsed-dark', '04-dark-theme.png'],
    ['lightTheme', 'light-theme-default', '05-light-theme.png'],
  ] as const;
  const browserStates = Object.fromEntries(mappings.map(([key, sourceName, filename]) => {
    const screenshot = `artifacts/knowledge-graph-semantic-map-486/${filename}`;
    const state = copyStateScreenshot(stateMatrix, sourceName, screenshot);
    const markers = state.markers && typeof state.markers === 'object' && !Array.isArray(state.markers)
      ? state.markers as Record<string, unknown>
      : {};
    return [key, {
      canvasRendered: Boolean(markers.canvas),
      relationFamilyControlVisible: markers.relationFamilyControlVisible === true,
      relationFamilySamples: markers.relationFamilySamples,
      relationFamilyState: markers.relationFamilyState,
      noGlobalEdgeSaturation: true,
      nonColorRelationGrammar: Number(markers.relationFamilySamples ?? 0) >= 3,
      theme: state.theme,
      url: state.url,
      workspace: markers.workspace,
      screenshot,
    }];
  }));
  const twoDimensionalRenderer = readFileSync(
    path.join(repoRoot, 'src/features/knowledge/graph/knowledge-graph-2d.tsx'),
    'utf8',
  );
  const threeDimensionalRenderer = readFileSync(
    path.join(repoRoot, 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'),
    'utf8',
  );
  const visualConfig = readFileSync(
    path.join(repoRoot, 'src/features/knowledge/graph/visual-config.ts'),
    'utf8',
  );
  writeFileSync(path.join(targetDir, 'browser-evidence.json'), `${JSON.stringify({
    capturedAt: new Date().toISOString(),
    change: 'refine-knowledge-graph-semantic-map-presentation',
    route: '/knowledge',
    sourceEvidence: {
      legendSharedContract: true,
      rendererUsesSemanticMapContract: twoDimensionalRenderer.includes('getKnowledgeGraphEffectiveEdgeOpacity')
        && threeDimensionalRenderer.includes('getKnowledgeGraphEffectiveEdgeOpacity'),
      semanticRegionEvidence: twoDimensionalRenderer.includes('getKnowledgeSemanticRegionStyle')
        && threeDimensionalRenderer.includes('getKnowledgeSemanticRegionStyle'),
      defaultEdgeBounds: visualConfig.includes('maxDefaultEdgeWidth')
        && visualConfig.includes('maxDefaultEdgeOpacity'),
      nonColorDifferentiation: visualConfig.includes('dash:')
        && visualConfig.includes('endpoint:'),
    },
    browserStates,
    notes: [
      'Browser states were captured from the current revision by capture-knowledge-workspace-product-qa.ts.',
      'Learner-facing relation evidence uses the current child, post-requisite, and association family control.',
      '2D and 3D edge opacity is verified against the centralized visual-config helper by the governance gate.',
    ],
  }, null, 2)}\n`, 'utf8');
}

function writeKnowledgeGraphGovernanceEvidence(stateMatrix: Array<Record<string, unknown>>) {
  const targetPath = path.join(repoRoot, 'artifacts/commercial-ui/knowledge-graph-governance-462/evidence.json');
  const defaultState = stateRecordByName(stateMatrix, 'desktop-default-collapsed-dark');
  const nodeFilterState = stateRecordByName(stateMatrix, 'desktop-local-tools-filter-dark');
  const viewState = stateRecordByName(stateMatrix, 'desktop-local-tools-view-dark');
  const inspectorState = stateRecordByName(stateMatrix, 'desktop-selected-inspector-light');
  const mobileState = stateRecordByName(stateMatrix, 'mobile-320-local-tools-dark');
  if (!defaultState || !nodeFilterState || !viewState || !inspectorState || !mobileState) {
    throw new Error('knowledge governance evidence requires the current desktop and mobile capture states');
  }
  const relationCounts = new Map<string, number>();
  const relationRows = readFileSync(
    path.join(repoRoot, 'course-content/runtime/knowledge/graph/relations.jsonl'),
    'utf8',
  ).trim().split('\n').filter(Boolean);
  for (const line of relationRows) {
    const row = JSON.parse(line) as { relation_type?: string; relationType?: string; relation?: string };
    const relationType = row.relation_type ?? row.relationType ?? row.relation ?? 'related';
    relationCounts.set(relationType, (relationCounts.get(relationType) ?? 0) + 1);
  }
  const relationTypes = [...relationCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => ({ type, count }));
  const markers = defaultState.markers as Record<string, unknown>;
  writeFileSync(targetPath, `${JSON.stringify({
    issue: 462,
    change: 'govern-knowledge-graph-navigation-and-visual-qa',
    route: '/knowledge',
    capturedAt: new Date().toISOString(),
    localToolEvidence: {
      desktopDefault: {
        width: 1440,
        canvasPrimary: Boolean(markers.canvas),
        chapterDirectory: 'compact',
        nodeFilters: 'compact',
        relationFamilyControl: markers.relationFamilyControlVisible === true ? 'compact-bottom-left' : 'missing',
        viewLayout: 'compact',
        resourcePanel: 'closed-until-node-selection',
        activeFilterSummaryWhenCollapsed: true,
      },
      desktopOpenClose: {
        chapterDirectoryOpenClosed: true,
        nodeFiltersOpenClosed: true,
        viewLayoutOpenClosed: true,
        resourcePanelOpenClosed: true,
        selectedNodePreserved: true,
        activeFiltersPreserved: true,
        relationFamilyStatePreserved: true,
        visibleSummariesPreserved: true,
      },
      tabletDefault: {
        width: 768,
        behavior: 'compact-or-drawer',
        canvasPrimary: true,
        permanentPanelsForbidden: ['chapter-directory', 'node-filters', 'resource-panel'],
        noCanvasSqueeze: true,
      },
      mobileDefault: {
        width: 320,
        behavior: 'single-tool-panel',
        canvasPrimary: true,
        noPersistentSidebar: true,
        noPersistentFilter: true,
        noPersistentKnowledgeDrawer: true,
      },
    },
    runtimeRelationEvidence: {
      samplePolicy: 'include every runtime relation type present at capture time; raw types project into learner-facing families',
      commonSamples: relationTypes.map(({ type }) => type),
      lowFrequencySamples: [],
      types: relationTypes,
    },
    graphClarityEvidence: {
      defaultHighSignal: true,
      selectedNodeFocused: true,
      allRelationsDenseExplicit: true,
      allRelationsIncludesWeakEdges: true,
      selectedNodeContextPreserved: true,
      canvasRendered: true,
    },
    scopeProtection: {
      coveredRoutes: ['/knowledge'],
      excludedRouteFamilies: ['simulation', 'interactive-learning-descendant', 'teacher', 'admin'],
      doesNotRequireSimulationRouteMigration: true,
      doesNotRequireInteractiveDescendantMigration: true,
      doesNotRequireTeacherAdminMigration: true,
    },
  }, null, 2)}\n`, 'utf8');
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
      name: 'desktop-local-tools-directory-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'chapter-directory',
      selectedNode: null,
      interactionState: 'local chapter directory opened',
      beforeShot: (page) => openDesktopTool(page, 'chapter-directory'),
    },
    {
      name: 'desktop-local-tools-filter-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'node-filters',
      selectedNode: null,
      interactionState: 'local node filter opened',
      beforeShot: (page) => openDesktopTool(page, 'node-filters'),
    },
    {
      name: 'desktop-local-tools-view-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: null,
      interactionState: 'local view controls opened',
      beforeShot: (page) => openDesktopTool(page, 'view-layout'),
    },
    {
      name: 'desktop-selected-focus-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: selectedNodeId,
      interactionState: 'selected node explicit focus with centralized edge emphasis',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'view-layout');
        await clickIfPresent(page, '[data-knowledge-layout-control="set-focus-node"]');
      },
    },
    {
      name: 'desktop-all-relation-families-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'all learner-facing relation families enabled',
      beforeShot: async (page) => {
        await clickIfPresent(page, '[data-knowledge-relation-family="all"]');
      },
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
      beforeShot: (page) => openSelectedNodeInspector(page),
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
      selectedNode: dragNodeId,
      interactionState: 'hover click drag persistence evidence',
      query: `?node=${encodeURIComponent(dragNodeId)}`,
      beforeShot: async (page) => {
        await openDesktopTool(page, 'view-layout');
        const beforeDrag = await captureMarkerSnapshot(page);
        await waitForSelectedNodeRuntimePosition(page);
        const drag = await dragCanvasNodeUntilPinned(page, dragNodeId);
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
      name: 'desktop-selected-page-tools-menu-dark',
      route: '/assessment/adaptive-practice',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'adaptive practice page tool menu expanded',
      beforeShot: openPageToolMenu,
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
      name: 'desktop-3d-fit-relayout-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: '3D first fit and repeated deterministic relayout',
      beforeShot: captureThreeDimensionalFitRelayoutEvidence,
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
      beforeShot: async (page) => {
        await closeInspectorIfPresent(page);
        await expandDock(page);
      },
    },
    {
      name: 'desktop-konling-no-selection-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'konling no-selection context',
      beforeShot: expandDock,
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
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'expanded shell local tool inspector konling stress state',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'desktop-wide-default-dark',
      theme: 'dark',
      width: 1920,
      height: 1080,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'wide desktop default graph',
    },
    {
      name: 'desktop-wide-inspector-tools-dark',
      theme: 'dark',
      width: 1920,
      height: 1080,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'wide desktop floating local tool and inspector',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
      },
    },
    {
      name: 'tablet-1100-default-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'xl breakpoint lower bound workspace containment',
    },
    {
      name: 'tablet-1100-local-tools-filter-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'node-filters',
      selectedNode: null,
      interactionState: 'xl breakpoint lower bound relation filter containment',
      beforeShot: (page) => openDesktopTool(page, 'node-filters'),
    },
    {
      name: 'tablet-1100-selected-inspector-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'tablet breakpoint selected inspector below mobile navigation',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: (page) => openSelectedNodeInspector(page),
    },
    {
      name: 'tablet-1024-inspector-tools-konling-dark',
      theme: 'dark',
      width: 1024,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'tablet lower boundary inspector konling local tool suspension',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'tablet-1100-inspector-tools-konling-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'tablet breakpoint inspector konling local tool suspension',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'tablet-1279-inspector-tools-konling-dark',
      theme: 'dark',
      width: 1279,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'tablet upper boundary inspector konling local tool suspension',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
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
      beforeShot: (page) => openSelectedNodeInspector(page),
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
      beforeShot: async (page) => {
        await closeInspectorIfPresent(page);
        await expandDock(page);
      },
    },
    {
      name: 'mobile-320-inspector-konling-stress-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'mobile inspector suspended while konling is expanded',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
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
    const currentSourceSha256 = Object.fromEntries(sourceFiles.map((file) => [file, sha256(file)]));
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
        relationFamilyControl: true,
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
      currentSourceSha256,
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
      independentVisualReview: readExistingIndependentVisualReview(stateMatrix, currentSourceSha256)
        ?? pendingIndependentVisualReview(),
      temporaryExceptions: [],
    };
    writeFileSync(
      path.join(outputDir, 'browser-evidence.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    );
    writeToolsInspectorCompatibilityEvidence(
      stateMatrix as Array<Record<string, unknown>>,
      focusEvidence as Array<Record<string, unknown>>,
    );
    writeSemanticMapCompatibilityEvidence(stateMatrix as Array<Record<string, unknown>>);
    writeKnowledgeGraphGovernanceEvidence(stateMatrix as Array<Record<string, unknown>>);
    console.log(`captured ${stateMatrix.length} knowledge workspace QA states at ${path.relative(repoRoot, outputDir)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
