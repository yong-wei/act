import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright';

const repoRoot = process.cwd();
const baseUrl = process.env.ISSUE_894_BASE_URL ?? 'http://localhost:3101';
const outputDir = path.join(repoRoot, 'artifacts/knowledge-graph-node-expansion-894');
const graphVersion = 'issue-894-visual-qa-v1';

const sourceFiles = [
  'src/features/knowledge/knowledge-graph-system.tsx',
  'src/features/knowledge/graph/knowledge-graph-2d.tsx',
  'src/features/knowledge/graph/knowledge-graph-canvas.tsx',
  'src/features/knowledge/graph/layout-engine.ts',
  'scripts/tests/capture-knowledge-graph-node-expansion-894.ts',
  'scripts/tests/test-knowledge-graph-node-expansion-894-governance.ts',
] as const;

type Theme = 'dark' | 'light';
type ViewMode = '2D' | '3D';
type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Point = { x: number; y: number };
type GraphPoint = Point & {
  zoomScale: number;
  screenX: number;
  screenY: number;
  controlDistancePixels: number;
  anchorClamped: boolean;
};
type CaptureRecord = Record<string, unknown>;

const parentNode = {
  id: 'chapter-node:第一章',
  name: '第一章根节点',
  nodeType: 'THEORY',
  description: '用于 Issue 894 视觉验证的第一章根节点',
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  chapter: 1,
  chapterName: '第一章',
  metadata: { isVirtualChapter: true, chapterName: '第一章' },
};

const unrelatedNode = {
  id: 'chapter-node:第二章',
  name: '第二章无关节点',
  nodeType: 'THEORY',
  description: '用于验证无关节点稳定性的第二章根节点',
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  chapter: 2,
  chapterName: '第二章',
  metadata: { isVirtualChapter: true, chapterName: '第二章' },
};

const childNodes = ['甲', '乙', '丙', '丁'].map((suffix, index) => ({
  id: `issue-894-child-${index + 1}`,
  name: `直接子节点${suffix}`,
  nodeType: 'THEORY',
  description: `第一章直接子节点${suffix}`,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  chapter: 1,
  chapterName: '第一章',
}));

const directLinks = childNodes.map((child, index) => ({
  id: `issue-894-link-${index + 1}`,
  sourceId: parentNode.id,
  targetId: child.id,
  relation: 'contains',
  relationType: 'contains',
  strength: 1,
}));

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function sha256(relativePath: string) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function sourceTreeSha256() {
  const hash = createHash('sha256');
  sourceFiles
    .filter((relativePath) => relativePath !== 'scripts/tests/test-knowledge-graph-node-expansion-894-governance.ts')
    .forEach((relativePath) => {
      hash.update(relativePath);
      hash.update(readFileSync(path.join(repoRoot, relativePath)));
    });
  return hash.digest('hex');
}

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function distance(left: Point, right: Point) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function rectsOverlap(left: Rect | null, right: Rect | null) {
  if (!left || !right) return false;
  return left.left < right.right && left.right > right.left
    && left.top < right.bottom && left.bottom > right.top;
}

function radialMetrics(parent: GraphPoint, children: GraphPoint[]) {
  const angles = children.map((child) => {
    const degrees = Math.atan2(child.y - parent.y, child.x - parent.x) * 180 / Math.PI;
    return degrees < 0 ? degrees + 360 : degrees;
  }).sort((left, right) => left - right);
  const gaps = angles.map((angle, index) => {
    const next = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? 360 : 0);
    return next - angle;
  });
  const radii = children.map((child) => distance(parent, child));
  const radiusMean = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  const radiusVariance = radii.reduce((sum, radius) => sum + (radius - radiusMean) ** 2, 0) / radii.length;
  const centroid = {
    x: children.reduce((sum, child) => sum + child.x, 0) / children.length,
    y: children.reduce((sum, child) => sum + child.y, 0) / children.length,
  };
  return {
    angularCoverageDegrees: round(360 - Math.max(...gaps)),
    centroidRatio: round(distance(parent, centroid) / radiusMean),
    radiusCoefficientOfVariation: round(Math.sqrt(radiusVariance) / radiusMean),
    childRadiiGraphUnits: radii.map((radius) => round(radius)),
  };
}

async function installGraphRoutes(page: Page) {
  const expansionDelay = deferred();
  const expansionRequested = deferred();
  let expansionRequestCount = 0;

  await page.route('**/api/knowledge/graph?*', async (route: Route) => {
    const url = new URL(route.request().url());
    const mode = url.searchParams.get('mode');
    const nodeId = url.searchParams.get('nodeId');
    if (mode === 'expansion' && nodeId === parentNode.id) {
      expansionRequestCount += 1;
      expansionRequested.release();
      await expansionDelay.promise;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode,
          graphVersion,
          shardKey: `${graphVersion}:shard:expansion:${parentNode.id}`,
          nodes: [parentNode, ...childNodes],
          links: directLinks,
          source: 'file',
        }),
      });
      return;
    }
    if (mode === 'expansion') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode,
          graphVersion,
          shardKey: `${graphVersion}:shard:expansion:${nodeId ?? 'unknown'}`,
          nodes: [],
          links: [],
          source: 'file',
        }),
      });
      return;
    }
    const nodes = mode === 'root' ? [parentNode, unrelatedNode] : [parentNode, unrelatedNode, ...childNodes];
    const links = mode === 'root' ? [] : directLinks;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode,
        graphVersion,
        shardKey: `${graphVersion}:shard:${mode ?? 'full'}:fixture`,
        nodes,
        links,
        rootSummaries: mode === 'root' ? nodes : undefined,
        source: 'file',
      }),
    });
  });

  return {
    releaseExpansion: expansionDelay.release,
    expansionRequested: expansionRequested.promise,
    expansionRequestCount: () => expansionRequestCount,
  };
}

async function openContext(browser: Browser, theme: Theme, width: number, height: number) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.addInitScript(({ selectedTheme }) => {
    (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA__?: boolean }).__ACT_KNOWLEDGE_PRODUCT_QA__ = true;
    window.localStorage.setItem('ai-obe-theme', selectedTheme);
    window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
    window.localStorage.setItem('act:knowledge-product-qa', 'true');
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(selectedTheme);
    document.documentElement.style.colorScheme = selectedTheme;
  }, { selectedTheme: theme });
  return context;
}

async function waitForReady(page: Page) {
  await page.waitForSelector('[data-knowledge-workspace="canvas-first"]', { timeout: 30_000 });
  await page.waitForSelector('[data-knowledge-canvas-primary="true"] canvas', { timeout: 30_000 });
  await page.waitForSelector('[data-knowledge-node-expansion-control="true"]', { state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(700);
}

async function focusExpansionControlWithKeyboard(page: Page) {
  for (let index = 0; index < 48; index += 1) {
    const focused = await page.evaluate(() => {
      const control = document.querySelector('[data-knowledge-node-expansion-control="true"]');
      return control === document.activeElement && control?.matches(':focus-visible');
    });
    if (focused) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Keyboard Tab traversal did not reach the visible node expansion control.');
}

async function readActiveElementDiagnostic(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    const dataMarkers = element ? Object.fromEntries(Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith('data-knowledge')
        || attribute.name.startsWith('data-platform')
        || attribute.name.startsWith('data-global'))
      .map((attribute) => [attribute.name, attribute.value])) : {};
    return {
      isTarget: element?.matches('[data-knowledge-node-expansion-control="true"]') ?? false,
      insideInspector: Boolean(element?.closest('[data-knowledge-inspector]')),
      isKnowledgeCanvas: element?.matches('[data-knowledge-canvas-primary="true"]') ?? false,
      tag: element?.tagName.toLowerCase() ?? '',
      role: element?.getAttribute('role') ?? null,
      ariaLabel: element?.getAttribute('aria-label') ?? null,
      text: (element?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
      dataMarkers,
    };
  });
}

function dedupeFocusStops(steps: Array<Awaited<ReturnType<typeof readActiveElementDiagnostic>> & { tabNumber: number }>) {
  const unique = new Map<string, Omit<(typeof steps)[number], 'tabNumber'> & { tabNumbers: number[] }>();
  for (const { tabNumber, ...step } of steps) {
    const signature = JSON.stringify(step);
    const existing = unique.get(signature);
    if (existing) existing.tabNumbers.push(tabNumber);
    else unique.set(signature, { ...step, tabNumbers: [tabNumber] });
  }
  return [...unique.values()];
}

async function tabToExpansionControl(page: Page, maxTabs = 120) {
  const steps: Array<Awaited<ReturnType<typeof readActiveElementDiagnostic>> & { tabNumber: number }> = [];
  const initial = await readActiveElementDiagnostic(page);
  if (initial.isTarget) return { reached: true, reachedAtTab: 0, uniqueFocusStops: [] };
  for (let tabNumber = 1; tabNumber <= maxTabs; tabNumber += 1) {
    await page.keyboard.press('Tab');
    const active = await readActiveElementDiagnostic(page);
    steps.push({ ...active, tabNumber });
    if (active.isTarget) {
      return { reached: true, reachedAtTab: tabNumber, uniqueFocusStops: dedupeFocusStops(steps) };
    }
  }
  return { reached: false, reachedAtTab: null, uniqueFocusStops: dedupeFocusStops(steps) };
}

async function diagnoseExpansionControlKeyboardReachability(page: Page, maxTabs = 120) {
  const target = await page.locator('[data-knowledge-node-expansion-control="true"]').evaluate((control) => {
    const element = control as HTMLButtonElement;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      visible: rect.width > 0 && rect.height > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden',
      tabIndex: element.tabIndex,
      disabled: element.disabled,
      ariaDisabled: element.getAttribute('aria-disabled'),
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      computed: {
        display: style.display,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
      },
    };
  });
  await page.waitForFunction(() => Boolean(
    document.activeElement?.closest('[data-knowledge-inspector]')
  ), undefined, { timeout: 2_000 });
  const trapSteps: Array<Awaited<ReturnType<typeof readActiveElementDiagnostic>> & { tabNumber: number }> = [];
  trapSteps.push({ ...(await readActiveElementDiagnostic(page)), tabNumber: 0 });
  for (let tabNumber = 1; tabNumber <= 12; tabNumber += 1) {
    await page.keyboard.press('Tab');
    trapSteps.push({ ...(await readActiveElementDiagnostic(page)), tabNumber });
  }
  const trapOnlyContainsInspectorStops = trapSteps.every((step) => step.insideInspector);
  const beforeEscape = await readActiveElementDiagnostic(page);
  await page.keyboard.press('Escape');
  await page.locator('[data-knowledge-inspector]').waitFor({ state: 'hidden', timeout: 2_000 });
  const afterEscape = await readActiveElementDiagnostic(page);
  const inspectorVisibleAfterEscape = await page.locator('[data-knowledge-inspector]')
    .isVisible({ timeout: 200 }).catch(() => false);
  const postEscapeSteps: Array<Awaited<ReturnType<typeof readActiveElementDiagnostic>> & { tabNumber: number }> = [];
  let reachedAtTab: number | null = afterEscape.isTarget ? 0 : null;
  for (let tabNumber = 1; reachedAtTab === null && tabNumber <= maxTabs; tabNumber += 1) {
    await page.keyboard.press('Tab');
    const active = await readActiveElementDiagnostic(page);
    postEscapeSteps.push({ ...active, tabNumber });
    if (active.isTarget) reachedAtTab = tabNumber;
  }
  return {
    maxTabs,
    reached: reachedAtTab !== null,
    reachedAtTab,
    target,
    inspectorTrap: {
      onlyContainsInspectorStops: trapOnlyContainsInspectorStops,
      uniqueFocusStops: dedupeFocusStops(trapSteps),
    },
    escapeReturn: {
      beforeEscape,
      afterEscape,
      inspectorVisibleAfterEscape,
      returnedToKnowledgeCanvas: afterEscape.isKnowledgeCanvas,
    },
    postEscapeUniqueFocusStops: dedupeFocusStops(postEscapeSteps),
  };
}

async function selectNodeFromDirectory(page: Page, chapterName: string, nodeName: string) {
  const desktopPanel = page.locator('[data-knowledge-desktop-tool-panel="chapter-directory"]');
  if (!await desktopPanel.isVisible({ timeout: 200 }).catch(() => false)) {
    const desktopTrigger = page.locator('[data-knowledge-command-trigger="chapter-directory"]').first();
    if (await desktopTrigger.isVisible({ timeout: 200 }).catch(() => false)) {
      await desktopTrigger.click();
    } else {
      await page.locator('[data-knowledge-mobile-command-surface] button').filter({ hasText: '目录' }).first().click();
    }
  }
  const panel = await desktopPanel.isVisible({ timeout: 200 }).catch(() => false)
    ? desktopPanel
    : page.locator('[data-knowledge-mobile-tool-panel="chapter-directory"]');
  const nodeButton = panel.getByRole('button', { name: nodeName, exact: true });
  const chapterButton = panel.getByRole('button', { name: new RegExp(chapterName) }).first();
  if (!await nodeButton.isVisible({ timeout: 200 }).catch(() => false)) {
    if (await chapterButton.isVisible({ timeout: 200 }).catch(() => false)) {
      await chapterButton.click({ timeout: 2_000 });
    }
  }
  await nodeButton.click({ timeout: 2_000 });
  await page.waitForFunction((nodeId) => (
    document.querySelector('[data-knowledge-canvas-primary="true"]')?.getAttribute('data-knowledge-selected-node-id') === nodeId
  ), nodeName === parentNode.name ? parentNode.id
    : nodeName === unrelatedNode.name ? unrelatedNode.id
      : childNodes.find((node) => node.name === nodeName)?.id, { timeout: 3_000 });
}

async function selectedNodeGraphPoint(
  page: Page,
  nodeName: string,
  projectionAttempt = 0
): Promise<GraphPoint> {
  const candidates = await page.evaluate(() => {
    const qaWindow = window as Window & {
      __knowledgeGraphProductQaSelectedNodeDragPoints?: () => Point[];
    };
    return qaWindow.__knowledgeGraphProductQaSelectedNodeDragPoints?.() ?? [];
  });
  const control = page.locator('[data-knowledge-node-expansion-control="true"]');
  const controlRect = await control.boundingBox({ timeout: 1_000 });
  if (!controlRect) throw new Error(`Projected DOM control is missing for ${nodeName}.`);
  const controlCenter = {
    x: controlRect.x + controlRect.width / 2,
    y: controlRect.y + controlRect.height / 2,
  };
  const hasCandidate = (x: number, y: number) => candidates.some((candidate) => (
    Math.abs(candidate.x - x) <= 0.5 && Math.abs(candidate.y - y) <= 0.5
  ));
  const baseCandidates = candidates.filter((candidate) => (
    hasCandidate(candidate.x - 8, candidate.y)
    && hasCandidate(candidate.x + 8, candidate.y)
    && hasCandidate(candidate.x, candidate.y - 8)
    && hasCandidate(candidate.x, candidate.y + 8)
  ));
  const selected = baseCandidates
    .map((candidate) => ({ candidate, controlDistance: distance(candidate, controlCenter) }))
    .sort((left, right) => left.controlDistance - right.controlDistance)[0];
  if (!selected) throw new Error(`No base projection candidate was available for ${nodeName}.`);
  const anchorClamped = await control.getAttribute('data-anchor-clamped') === 'true';
  if (!anchorClamped && (selected.controlDistance < 24 || selected.controlDistance > 64)) {
    if (projectionAttempt < 20) {
      await page.waitForTimeout(100);
      return selectedNodeGraphPoint(page, nodeName, projectionAttempt + 1);
    }
    throw new Error(
      `${nodeName} control distance ${round(selected.controlDistance)}px is outside the required 24-64px range.`,
    );
  }
  const zoomScale = await page.locator('[data-knowledge-canvas-primary="true"] canvas').evaluate((canvas) => {
    const zoom = (canvas as HTMLCanvasElement & { __zoom?: { k?: number } }).__zoom;
    return Number(zoom?.k);
  });
  if (!Number.isFinite(zoomScale) || zoomScale <= 0) {
    throw new Error('2D canvas d3 zoom scale is not measurable from the real page.');
  }
  const zoomTransform = await currentZoomTransform(page);
  const canvasRect = await page.locator('[data-knowledge-canvas-primary="true"]').boundingBox({ timeout: 1_000 });
  if (!zoomTransform.measurable || !canvasRect) {
    throw new Error(`Graph coordinate transform is not measurable for ${nodeName}.`);
  }
  return {
    x: (selected.candidate.x - canvasRect.x - zoomTransform.x) / zoomScale,
    y: (selected.candidate.y - canvasRect.y - zoomTransform.y) / zoomScale,
    screenX: selected.candidate.x,
    screenY: selected.candidate.y,
    zoomScale,
    controlDistancePixels: round(selected.controlDistance),
    anchorClamped,
  };
}

async function currentZoomTransform(page: Page) {
  return page.locator('[data-knowledge-canvas-primary="true"] canvas').evaluate((canvas) => {
    const zoom = (canvas as HTMLCanvasElement & { __zoom?: { x?: number; y?: number; k?: number } }).__zoom;
    return {
      x: Number(zoom?.x),
      y: Number(zoom?.y),
      k: Number(zoom?.k),
      measurable: [zoom?.x, zoom?.y, zoom?.k].every((value) => Number.isFinite(Number(value))),
    };
  });
}

async function captureState(
  page: Page,
  name: string,
  theme: Theme,
  mode: ViewMode,
  width: number,
  height: number,
) {
  const screenshotName = `${width}x${height}-${theme}-${mode.toLowerCase()}-${name}.png`;
  const screenshotPath = path.join(outputDir, screenshotName);
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  }));
  await page.waitForTimeout(180);
  const screenshotMode = process.env.ISSUE_894_SCREENSHOT_MODE;
  if (screenshotMode === 'page' || (screenshotMode === 'hybrid' && name === 'expanded-pinned-child')) {
    await page.screenshot({ path: screenshotPath, fullPage: false });
  } else {
    await page.locator('html').screenshot({ path: screenshotPath });
  }
  const geometry = await page.evaluate(`(() => {
    const rectFor = (element) => {
      if (!element || window.getComputedStyle(element).display === 'none') return null;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const control = document.querySelector('[data-knowledge-node-expansion-control="true"]');
    const canvas = document.querySelector('[data-knowledge-canvas-primary="true"]');
    const active = document.activeElement;
    const style = control ? window.getComputedStyle(control) : null;
    const surfaceSelectors = {
      desktopTools: '[data-knowledge-desktop-command-system]',
      activeLocalPanel: '[data-knowledge-local-tool-panel]',
      desktopDirectory: '[data-knowledge-desktop-tool-panel="chapter-directory"]',
      inspector: '[data-knowledge-inspector]',
      dock: '[data-platform-floating-dock]',
      pageFloatingControls: '[data-page-floating-controls="true"]',
      konling: '[data-global-ai-sidebar="open"]',
      mobileTools: '[data-knowledge-mobile-command-surface] > div:first-child',
      mobilePanel: '[data-knowledge-mobile-tool-panel]',
    };
    return {
      title: document.title,
      url: window.location.href,
      htmlClass: document.documentElement.className,
      controlRect: rectFor(control),
      canvasRect: rectFor(canvas),
      surfaces: Object.fromEntries(Object.entries(surfaceSelectors).map(([key, selector]) => (
        [key, rectFor(document.querySelector(selector))]
      ))),
      control: control ? {
        state: control.getAttribute('data-state'),
        viewMode: control.getAttribute('data-view-mode'),
        anchorNodeId: control.getAttribute('data-anchor-node-id'),
        anchorClamped: control.getAttribute('data-anchor-clamped'),
        ariaExpanded: control.getAttribute('aria-expanded'),
        ariaBusy: control.getAttribute('aria-busy'),
        ariaDisabled: control.getAttribute('aria-disabled'),
        activeElement: active === control,
        focusVisible: control.matches(':focus-visible'),
        outlineStyle: style?.outlineStyle ?? '',
        outlineWidth: style?.outlineWidth ?? '',
        boxShadow: style?.boxShadow ?? '',
        offsetWidth: control.offsetWidth,
        offsetHeight: control.offsetHeight,
      } : null,
      canvas: canvas ? {
        selectedNodeId: canvas.getAttribute('data-knowledge-selected-node-id'),
        expandedNodeCount: Number(canvas.getAttribute('data-knowledge-expanded-node-count') ?? 0),
        pinnedNodeCount: Number(canvas.getAttribute('data-knowledge-pinned-node-count') ?? 0),
        pinnedSignature: canvas.getAttribute('data-knowledge-pinned-layout-signature') ?? '',
        visibleNodeCount: Number(canvas.getAttribute('data-knowledge-visible-node-count') ?? 0),
        visibleLinkCount: Number(canvas.getAttribute('data-knowledge-visible-link-count') ?? 0),
      } : null,
      scroll: {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      },
      frameworkOverlay: (() => {
        const portal = document.querySelector('nextjs-portal');
        const shadow = portal?.shadowRoot;
        if (!shadow) return false;
        const overlay = shadow.querySelector(
          '[data-nextjs-dialog-overlay], [data-nextjs-error-overlay], nextjs-errors-dialog'
        );
        return Boolean(overlay && shadow.textContent?.trim());
      })(),
    };
  })()`) as {
    title: string;
    url: string;
    htmlClass: string;
    controlRect: Rect | null;
    canvasRect: Rect | null;
    surfaces: Record<string, Rect | null>;
    control: null | {
      state: string | null;
      viewMode: string | null;
      anchorNodeId: string | null;
      anchorClamped: string | null;
      ariaExpanded: string | null;
      ariaBusy: string | null;
      ariaDisabled: string | null;
      activeElement: boolean;
      focusVisible: boolean;
      outlineStyle: string;
      outlineWidth: string;
      boxShadow: string;
      offsetWidth: number;
      offsetHeight: number;
    };
    canvas: null | {
      selectedNodeId: string | null;
      expandedNodeCount: number;
      pinnedNodeCount: number;
      pinnedSignature: string;
      visibleNodeCount: number;
      visibleLinkCount: number;
    };
    scroll: { viewportWidth: number; scrollWidth: number; bodyScrollWidth: number };
    frameworkOverlay: boolean;
  };
  const controlRect = geometry.controlRect;
  const canvasRect = geometry.canvasRect;
  const surfaces = geometry.surfaces as Record<string, Rect | null>;
  const edgeClearances = controlRect && canvasRect ? {
    left: round(controlRect.left - canvasRect.left),
    top: round(controlRect.top - canvasRect.top),
    right: round(canvasRect.right - controlRect.right),
    bottom: round(canvasRect.bottom - controlRect.bottom),
  } : null;
  const overlaps = Object.fromEntries(Object.entries(surfaces).map(([key, rect]) => (
    [key, rectsOverlap(controlRect, rect)]
  )));
  const relativePath = path.relative(repoRoot, screenshotPath);
  return {
    name,
    theme,
    mode,
    viewport: { width, height },
    screenshotPath: relativePath,
    screenshotSha256: sha256(relativePath),
    geometry,
    measurements: {
      edgeClearances,
      controlSurfaceOverlaps: overlaps,
      routeFitsViewport: geometry.scroll.scrollWidth <= geometry.scroll.viewportWidth
        && geometry.scroll.bodyScrollWidth <= geometry.scroll.viewportWidth,
      hitTargetAtLeast44: Boolean(
        geometry.control
        && geometry.control.offsetWidth >= 44
        && geometry.control.offsetHeight >= 44
      ),
      visibleFocusRing: Boolean(
        geometry.control
        && geometry.control.activeElement
        && geometry.control.focusVisible
        && (
          geometry.control.boxShadow !== 'none'
          || (geometry.control.outlineStyle !== 'none' && geometry.control.outlineWidth !== '0px')
        )
      ),
    },
  };
}

async function openDesktopTool(page: Page, tool: string) {
  const trigger = page.locator(`[data-knowledge-command-trigger="${tool}"]`).first();
  if (await trigger.isVisible({ timeout: 200 }).catch(() => false)) await trigger.click();
}

async function closeDirectoryAndClearHover(page: Page) {
  const panel = page.locator('[data-knowledge-desktop-tool-panel="chapter-directory"]');
  if (await panel.isVisible({ timeout: 200 }).catch(() => false)) {
    const trigger = page.locator('[data-knowledge-command-trigger="chapter-directory"]').first();
    if (await trigger.isVisible({ timeout: 200 }).catch(() => false)) {
      await trigger.click({ timeout: 2_000 });
    }
  }
  const canvasRect = await page.locator('[data-knowledge-canvas-primary="true"]').boundingBox({ timeout: 1_000 });
  if (canvasRect) {
    await page.mouse.move(canvasRect.x + canvasRect.width / 2, canvasRect.y + 16);
  }
  await page.waitForTimeout(120);
}

function writeIncrementalEvidence(progress: Record<string, unknown>) {
  writeFileSync(
    path.join(outputDir, 'browser-evidence.json'),
    `${JSON.stringify(progress, null, 2)}\n`,
    'utf8',
  );
}

async function pinSelectedNode(page: Page) {
  await openDesktopTool(page, 'view-layout');
  const pin = page.locator('[data-knowledge-layout-control="pin-selected"]').first();
  await pin.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-knowledge-layout-control="pin-selected"]');
    return Boolean(button && !button.disabled);
  });
  await pin.click();
}

async function collectGraphPoints(page: Page) {
  const points: Record<string, GraphPoint> = {};
  const targets = [parentNode, ...childNodes, unrelatedNode];
  for (const target of targets) {
    await selectNodeFromDirectory(page, target.chapterName, target.name);
    await page.waitForTimeout(180);
    points[target.id] = await selectedNodeGraphPoint(page, target.name);
  }
  return points;
}

async function collectNarrowGraphPoints(page: Page) {
  const points: Record<string, GraphPoint> = {};
  const targets = [parentNode, ...childNodes, unrelatedNode];
  for (const target of targets) {
    await closeMobileInspector(page);
    await selectNodeFromDirectory(page, target.chapterName, target.name);
    await page.waitForTimeout(180);
    points[target.id] = await selectedNodeGraphPoint(page, target.name);
  }
  return points;
}

async function readPinnedSignature(page: Page) {
  return page.locator('[data-knowledge-canvas-primary="true"]').getAttribute('data-knowledge-pinned-layout-signature');
}

function pinnedCoordinateFromSignature(signature: string | null, nodeId: string) {
  const prefix = `${nodeId}:`;
  const encoded = signature?.split('|').find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
  const values = encoded?.split(',').map(Number) ?? [];
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) return null;
  return { x: values[0], y: values[1], z: values[2] };
}

async function childViewportMeasurements(page: Page, points: Record<string, GraphPoint>) {
  const canvasRect = await page.locator('[data-knowledge-canvas-primary="true"]').boundingBox({ timeout: 1_000 });
  if (!canvasRect) throw new Error('Graph canvas rectangle is unavailable for child containment measurement.');
  const textWidths = await page.evaluate((labels) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return labels.map(() => 0);
    context.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
    return labels.map((label) => context.measureText(label).width);
  }, childNodes.map((node) => node.name));
  const children = childNodes.map((child, index) => {
    const point = points[child.id];
    const halfLabelWidth = Math.max(16, textWidths[index] / 2 + 4);
    const conservativeLabelRect = {
      left: point.screenX - halfLabelWidth,
      right: point.screenX + halfLabelWidth,
      top: point.screenY - 16,
      bottom: point.screenY + 36,
    };
    const pointClearances = {
      left: round(point.screenX - canvasRect.x),
      top: round(point.screenY - canvasRect.y),
      right: round(canvasRect.x + canvasRect.width - point.screenX),
      bottom: round(canvasRect.y + canvasRect.height - point.screenY),
    };
    return {
      nodeId: child.id,
      name: child.name,
      screenPoint: { x: round(point.screenX), y: round(point.screenY) },
      pointClearances,
      anchorClamped: point.anchorClamped,
      controlDistancePixels: point.controlDistancePixels,
      nodeInsideCanvas: Object.values(pointClearances).every((clearance) => clearance >= 0),
      conservativeLabelRect: Object.fromEntries(Object.entries(conservativeLabelRect).map(
        ([key, value]) => [key, round(value)],
      )),
      labelEnvelopeInsideCanvas: conservativeLabelRect.left >= canvasRect.x
        && conservativeLabelRect.top >= canvasRect.y
        && conservativeLabelRect.right <= canvasRect.x + canvasRect.width
        && conservativeLabelRect.bottom <= canvasRect.y + canvasRect.height,
    };
  });
  return {
    canvasRect: {
      left: round(canvasRect.x),
      top: round(canvasRect.y),
      right: round(canvasRect.x + canvasRect.width),
      bottom: round(canvasRect.y + canvasRect.height),
      width: round(canvasRect.width),
      height: round(canvasRect.height),
    },
    children,
    allDirectChildrenAndLabelsInsideCanvas: children.every((child) => (
      child.nodeInsideCanvas && child.labelEnvelopeInsideCanvas
    )),
  };
}

async function captureStandaloneLoading(browser: Browser) {
  const context = await openContext(browser, 'dark', 1440, 960);
  const page = await context.newPage();
  const routes = await installGraphRoutes(page);
  try {
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    await focusExpansionControlWithKeyboard(page);
    const control = page.locator('[data-knowledge-node-expansion-control="true"]');
    await control.press('Enter');
    await routes.expansionRequested;
    await page.waitForFunction(() => {
      const expansionControl = document.querySelector('[data-knowledge-node-expansion-control="true"]');
      if (expansionControl !== document.activeElement || !expansionControl.matches(':focus-visible')) return false;
      return expansionControl.getAttribute('aria-busy') === 'true';
    }, undefined, { timeout: 2_000 });
    const state = await captureState(page, 'loading-focus', 'dark', '2D', 1440, 960);
    const response = page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return url.searchParams.get('mode') === 'expansion'
        && url.searchParams.get('nodeId') === parentNode.id;
    }, { timeout: 5_000 });
    routes.releaseExpansion();
    await response;
    return state;
  } finally {
    await context.close();
  }
}

async function captureStandalonePinned(browser: Browser) {
  const context = await openContext(browser, 'dark', 1440, 960);
  const page = await context.newPage();
  const routes = await installGraphRoutes(page);
  try {
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    await focusExpansionControlWithKeyboard(page);
    const response = page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return url.searchParams.get('mode') === 'expansion'
        && url.searchParams.get('nodeId') === parentNode.id;
    }, { timeout: 5_000 });
    await page.locator('[data-knowledge-node-expansion-control="true"]').press('Enter');
    await routes.expansionRequested;
    routes.releaseExpansion();
    await response;
    await page.waitForFunction(() => (
      document.querySelector('[data-knowledge-node-expansion-control="true"]')?.getAttribute('data-state') === 'expanded'
    ), undefined, { timeout: 5_000 });
    await page.waitForTimeout(900);
    await selectNodeFromDirectory(page, childNodes[0].chapterName, childNodes[0].name);
    await pinSelectedNode(page);
    await collectGraphPoints(page);
    await selectNodeFromDirectory(page, parentNode.chapterName, parentNode.name);
    await closeDirectoryAndClearHover(page);
    await page.waitForTimeout(350);
    return await captureState(page, 'expanded-pinned-child', 'dark', '2D', 1440, 960);
  } finally {
    await context.close();
  }
}

function replaceState(states: CaptureRecord[], replacement: CaptureRecord) {
  const name = replacement.name;
  const index = states.findIndex((state) => state.name === name);
  if (index < 0) throw new Error(`Cannot replace missing capture state ${String(name)}.`);
  states.splice(index, 1, replacement);
}

async function captureRepresentative(browser: Browser) {
  const theme: Theme = 'dark';
  const mode: ViewMode = '2D';
  const width = 1440;
  const height = 960;
  const context = await openContext(browser, theme, width, height);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const failedResponses: Array<{ status: number; url: string }> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
  });
  const routes = await installGraphRoutes(page);
  const states: CaptureRecord[] = [];
  const progress: Record<string, unknown> = {
    change: 'improve-knowledge-graph-node-expansion-interaction',
    issue: 894,
    captureScope: 'representative',
    status: 'running',
    sourceCwd: repoRoot,
    sourceGitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    sourceTreeSha256: sourceTreeSha256(),
    baseUrl,
    route: '/knowledge',
    states,
    metrics: null,
  };
  const recordState = async (name: string) => {
    states.push(await captureState(page, name, theme, mode, width, height));
    progress.lastCompletedState = name;
    writeIncrementalEvidence(progress);
  };
  writeIncrementalEvidence(progress);
  try {
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    const control = page.locator('[data-knowledge-node-expansion-control="true"]');
    await focusExpansionControlWithKeyboard(page);
    await recordState('collapsed-focus');

    const initialParent = await selectedNodeGraphPoint(page, parentNode.name);
    await selectNodeFromDirectory(page, unrelatedNode.chapterName, unrelatedNode.name);
    const unrelatedBefore = await selectedNodeGraphPoint(page, unrelatedNode.name);
    await selectNodeFromDirectory(page, parentNode.chapterName, parentNode.name);
    await closeDirectoryAndClearHover(page);
    const collapsedZoom = await currentZoomTransform(page);
    await focusExpansionControlWithKeyboard(page);
    await control.press('Enter');
    await routes.expansionRequested;
    await page.waitForFunction(() => {
      const expansionControl = document.querySelector('[data-knowledge-node-expansion-control="true"]');
      if (expansionControl !== document.activeElement || !expansionControl.matches(':focus-visible')) return false;
      const style = window.getComputedStyle(expansionControl);
      const visibleRing = style.boxShadow !== 'none'
        || (style.outlineStyle !== 'none' && style.outlineWidth !== '0px');
      return expansionControl.getAttribute('aria-busy') === 'true' && visibleRing;
    }, undefined, { timeout: 2_000 });
    await recordState('loading-focus');
    const expansionResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.searchParams.get('mode') === 'expansion'
        && url.searchParams.get('nodeId') === parentNode.id;
    }, { timeout: 5_000 });
    routes.releaseExpansion();
    await expansionResponse;
    await page.waitForFunction(() => (
      document.querySelector('[data-knowledge-node-expansion-control="true"]')?.getAttribute('data-state') === 'expanded'
    ));
    await page.waitForTimeout(900);
    await closeDirectoryAndClearHover(page);
    await recordState('expanded');
    const expandedZoom = await currentZoomTransform(page);
    const firstExpandedPoints = await collectGraphPoints(page);
    const childViewport = await childViewportMeasurements(page, firstExpandedPoints);

    await selectNodeFromDirectory(page, childNodes[0].chapterName, childNodes[0].name);
    await pinSelectedNode(page);
    await page.evaluate(() => new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    }));
    const pinnedBaselineSignature = await readPinnedSignature(page);
    const pinnedBaselineCoordinate = pinnedCoordinateFromSignature(pinnedBaselineSignature, childNodes[0].id);
    if (!pinnedBaselineCoordinate) throw new Error('Pinned baseline coordinate is missing after the pin action.');
    const pinnedPostPinPoints = await collectGraphPoints(page);
    const pinnedPostSamplingSignature = await readPinnedSignature(page);
    if (pinnedPostSamplingSignature !== pinnedBaselineSignature) {
      throw new Error('Pinned signature changed during the post-pin projection pass.');
    }
    await selectNodeFromDirectory(page, parentNode.chapterName, parentNode.name);
    await closeDirectoryAndClearHover(page);
    await page.waitForTimeout(350);
    await recordState('expanded-pinned-child');
    await control.click();
    await page.waitForFunction(() => (
      document.querySelector('[data-knowledge-node-expansion-control="true"]')?.getAttribute('data-state') === 'collapsed'
    ));
    await page.waitForTimeout(350);
    await recordState('collapsed-again');
    const collapsedAgainZoom = await currentZoomTransform(page);
    await control.click();
    await page.waitForFunction(() => (
      document.querySelector('[data-knowledge-node-expansion-control="true"]')?.getAttribute('data-state') === 'expanded'
    ));
    await page.waitForTimeout(900);
    const expandedAgainZoom = await currentZoomTransform(page);
    const secondExpandedPoints = await collectGraphPoints(page);
    const unrelatedAfter = secondExpandedPoints[unrelatedNode.id];
    const pinnedFinalSignature = await readPinnedSignature(page);
    const pinnedFinalCoordinate = pinnedCoordinateFromSignature(pinnedFinalSignature, childNodes[0].id);
    if (!pinnedFinalCoordinate) throw new Error('Pinned final coordinate is missing after re-expansion.');

    await selectNodeFromDirectory(page, parentNode.chapterName, parentNode.name);
    await closeDirectoryAndClearHover(page);
    await recordState('expanded-again');
    const finalParent = await selectedNodeGraphPoint(page, parentNode.name);
    const finalState = states.at(-1) as CaptureRecord;
    const geometry = finalState.geometry as { controlRect: Rect | null };
    const controlRect = geometry.controlRect;
    const controlCenter = controlRect ? {
      x: controlRect.left + controlRect.width / 2,
      y: controlRect.top + controlRect.height / 2,
    } : null;
    const parentScreen = { x: finalParent.screenX, y: finalParent.screenY };
    const automaticChildren = childNodes.slice(1);
    const pointDeltas = automaticChildren.map((child) => ({
      nodeId: child.id,
      displacementGraphUnits: round(distance(firstExpandedPoints[child.id], secondExpandedPoints[child.id])),
    }));
    const unrelatedDisplacement = round(distance(unrelatedBefore, unrelatedAfter));
    const pinnedDisplacement = round(Math.hypot(
      pinnedFinalCoordinate.x - pinnedBaselineCoordinate.x,
      pinnedFinalCoordinate.y - pinnedBaselineCoordinate.y,
      pinnedFinalCoordinate.z - pinnedBaselineCoordinate.z,
    ));
    const viewportShortEdge = Math.min(childViewport.canvasRect.width, childViewport.canvasRect.height);
    const viewTranslation = {
      x: round(expandedZoom.x - collapsedZoom.x),
      y: round(expandedZoom.y - collapsedZoom.y),
      magnitude: round(Math.hypot(expandedZoom.x - collapsedZoom.x, expandedZoom.y - collapsedZoom.y)),
      limit: round(viewportShortEdge * 0.2),
    };
    const interactionMetrics = {
      expansionRequestCount: routes.expansionRequestCount(),
      radial: {
        status: 'measurement-invalid',
        reason: 'Real-page child projections are selected serially rather than captured as one atomic graph snapshot.',
        preliminary: radialMetrics(firstExpandedPoints[parentNode.id], childNodes.map((child) => firstExpandedPoints[child.id])),
      },
      childViewport,
      repeatedAutomaticChildDisplacements: pointDeltas,
      maxRepeatedAutomaticChildDisplacement: Math.max(...pointDeltas.map((entry) => entry.displacementGraphUnits)),
      automaticRepeatWithinHalfGraphUnit: pointDeltas.every((entry) => entry.displacementGraphUnits <= 0.5),
      pinnedNodeDisplacementGraphUnits: pinnedDisplacement,
      pinnedNodeWithinHalfGraphUnit: pinnedDisplacement <= 0.5,
      pinnedBaselineSignature,
      pinnedPostSamplingSignature,
      pinnedFinalSignature,
      pinnedBaselineCoordinate,
      pinnedFinalCoordinate,
      pinnedCoordinateSource: 'data-knowledge-pinned-layout-signature',
      pinnedPostPinProjection: pinnedPostPinPoints[childNodes[0].id],
      pinnedSignatureStable: Boolean(pinnedBaselineSignature)
        && pinnedBaselineSignature === pinnedFinalSignature,
      unrelatedNodeDisplacementsGraphUnits: [unrelatedDisplacement],
      unrelatedNodeP95GraphUnits: unrelatedDisplacement,
      unrelatedNodeMaxGraphUnits: unrelatedDisplacement,
      controlNodeCenterDistancePixels: controlCenter ? round(distance(controlCenter, parentScreen)) : null,
      controlAnchorNearSelectedNode: controlCenter ? distance(controlCenter, parentScreen) >= 24
        && distance(controlCenter, parentScreen) <= 64 : false,
      initialToFinalSelectedNodeDisplacementGraphUnits: round(distance(initialParent, finalParent)),
      zoomTransforms: { collapsedZoom, expandedZoom, collapsedAgainZoom, expandedAgainZoom },
      viewTranslation,
      viewTranslationWithinBound: viewTranslation.magnitude <= viewTranslation.limit,
      zoomKStable: [expandedZoom, collapsedAgainZoom, expandedAgainZoom]
        .every((transform) => Math.abs(transform.k - collapsedZoom.k) <= 1e-9),
      directLinksVisible: Number(
        ((finalState.geometry as { canvas?: { visibleLinkCount?: number } }).canvas?.visibleLinkCount) ?? 0,
      ) >= directLinks.length,
      selectedProjectionControlDistances: Object.fromEntries(Object.entries(secondExpandedPoints).map(
        ([nodeId, point]) => [nodeId, point.controlDistancePixels],
      )),
    };
    replaceState(states, await captureStandaloneLoading(browser));
    replaceState(states, await captureStandalonePinned(browser));
    const result = {
      states,
      consoleErrors,
      failedResponses,
      interactionMetrics,
    };
    progress.status = 'representative-complete';
    progress.metrics = interactionMetrics;
    progress.consoleErrors = consoleErrors;
    progress.failedResponses = failedResponses;
    writeIncrementalEvidence(progress);
    return result;
  } catch (error) {
    progress.status = 'blocked';
    progress.failure = error instanceof Error ? { name: error.name, message: error.message } : String(error);
    progress.consoleErrors = consoleErrors;
    progress.failedResponses = failedResponses;
    writeIncrementalEvidence(progress);
    throw error;
  } finally {
    await context.close();
  }
}

type MatrixGroupRecord = {
  status: 'pending' | 'running' | 'passed' | 'blocked';
  states: CaptureRecord[];
  metrics: Record<string, unknown>;
  failure?: { name: string; message: string };
};

function readStateValidation(
  state: CaptureRecord,
  options: { expectedState: string; expanded: boolean; focus?: boolean; inspector?: boolean },
) {
  const geometry = state.geometry as {
    control: null | {
      state: string | null;
      viewMode: string | null;
      anchorClamped: string | null;
      ariaExpanded: string | null;
      activeElement: boolean;
      focusVisible: boolean;
    };
    canvas: null | {
      selectedNodeId: string | null;
      expandedNodeCount: number;
      visibleLinkCount: number;
    };
    surfaces: Record<string, Rect | null>;
    frameworkOverlay: boolean;
  };
  const measurements = state.measurements as {
    edgeClearances: Record<string, number> | null;
    controlSurfaceOverlaps: Record<string, boolean>;
    routeFitsViewport: boolean;
    hitTargetAtLeast44: boolean;
    visibleFocusRing: boolean;
  };
  const failures: string[] = [];
  if (!geometry.control) failures.push('control-missing');
  if (!geometry.canvas) failures.push('canvas-markers-missing');
  if (geometry.frameworkOverlay) failures.push('framework-overlay-visible');
  if (geometry.control?.state !== options.expectedState) failures.push(`state-${geometry.control?.state ?? 'missing'}`);
  if (geometry.control?.ariaExpanded !== String(options.expanded)) failures.push('aria-expanded-mismatch');
  if (geometry.canvas?.selectedNodeId !== parentNode.id) failures.push('selected-node-mismatch');
  if (options.expanded && Number(geometry.canvas?.expandedNodeCount ?? 0) < 1) failures.push('expanded-id-missing');
  if (options.expanded && Number(geometry.canvas?.visibleLinkCount ?? 0) < directLinks.length) failures.push('direct-links-missing');
  if (!measurements.hitTargetAtLeast44) failures.push('hit-target-under-44');
  if (!measurements.routeFitsViewport) failures.push('route-horizontal-overflow');
  if (measurements.edgeClearances && Object.values(measurements.edgeClearances).some((value) => value < 7.5)) {
    failures.push('control-edge-clearance-under-8');
  }
  const overlappingSurfaces = Object.entries(measurements.controlSurfaceOverlaps)
    .filter(([, overlaps]) => overlaps)
    .map(([surface]) => surface);
  if (overlappingSurfaces.length > 0) failures.push(`surface-overlap:${overlappingSurfaces.join(',')}`);
  if (options.focus && (!geometry.control?.activeElement || !geometry.control.focusVisible || !measurements.visibleFocusRing)) {
    failures.push('keyboard-focus-ring-missing');
  }
  if (options.inspector && !geometry.surfaces.inspector) failures.push('inspector-not-visible');
  return {
    passed: failures.length === 0,
    failures,
    anchorClamped: geometry.control?.anchorClamped === 'true',
    edgeClearances: measurements.edgeClearances,
    controlSurfaceOverlaps: measurements.controlSurfaceOverlaps,
    routeFitsViewport: measurements.routeFitsViewport,
    hitTargetAtLeast44: measurements.hitTargetAtLeast44,
    selectedNodeId: geometry.canvas?.selectedNodeId ?? null,
    expandedNodeCount: geometry.canvas?.expandedNodeCount ?? null,
    visibleLinkCount: geometry.canvas?.visibleLinkCount ?? null,
    ariaExpanded: geometry.control?.ariaExpanded ?? null,
  };
}

function readNarrowStateValidation(
  state: CaptureRecord,
  options: {
    expectedState: string;
    expanded: boolean;
    focus?: boolean;
    busy?: boolean;
    inspector?: boolean;
    inspectorClosed?: boolean;
    mobilePanel?: boolean;
  },
  controlDistancePixels: number,
) {
  const base = readStateValidation(state, options);
  const geometry = state.geometry as {
    surfaces: Record<string, Rect | null>;
    control: null | { ariaBusy: string | null; anchorClamped: string | null };
    scroll: { viewportWidth: number; scrollWidth: number; bodyScrollWidth: number };
  };
  const failures = [...base.failures];
  const controlDistanceWithinPolicy = base.anchorClamped
    || (controlDistancePixels >= 24 && controlDistancePixels <= 64);
  if (!controlDistanceWithinPolicy) failures.push('control-node-distance-outside-24-64');
  if (options.busy !== undefined && geometry.control?.ariaBusy !== String(options.busy)) {
    failures.push('aria-busy-mismatch');
  }
  if (options.mobilePanel && !geometry.surfaces.mobilePanel) failures.push('mobile-panel-not-visible');
  if (options.inspectorClosed && geometry.surfaces.inspector) failures.push('inspector-still-visible');
  const surfacePairOverlaps = {
    mobileToolsMobilePanel: rectsOverlap(geometry.surfaces.mobileTools, geometry.surfaces.mobilePanel),
    mobileToolsDock: rectsOverlap(geometry.surfaces.mobileTools, geometry.surfaces.dock),
    mobileToolsInspector: rectsOverlap(geometry.surfaces.mobileTools, geometry.surfaces.inspector),
    mobilePanelDock: rectsOverlap(geometry.surfaces.mobilePanel, geometry.surfaces.dock),
    mobilePanelInspector: rectsOverlap(geometry.surfaces.mobilePanel, geometry.surfaces.inspector),
    dockInspector: rectsOverlap(geometry.surfaces.dock, geometry.surfaces.inspector),
  };
  const presentSurfaceOverlaps = Object.entries(surfacePairOverlaps).filter(([, overlaps]) => overlaps);
  if (presentSurfaceOverlaps.length > 0) {
    failures.push(`mobile-surface-overlap:${presentSurfaceOverlaps.map(([pair]) => pair).join(',')}`);
  }
  return {
    ...base,
    passed: failures.length === 0,
    failures,
    controlDistancePixels,
    controlDistanceWithinPolicy,
    ariaBusy: geometry.control?.ariaBusy ?? null,
    surfacesPresent: Object.fromEntries(Object.entries(geometry.surfaces).map(([name, rect]) => [name, Boolean(rect)])),
    surfacePairOverlaps,
    scrollWidth: geometry.scroll.scrollWidth,
    bodyScrollWidth: geometry.scroll.bodyScrollWidth,
    viewportWidth: geometry.scroll.viewportWidth,
  };
}

async function closeMobileInspector(page: Page) {
  const inspector = page.locator('[data-knowledge-inspector]');
  if (!await inspector.isVisible({ timeout: 200 }).catch(() => false)) return;
  await inspector.getByRole('button', { name: '关闭知识节点检查器', exact: true }).click({ timeout: 2_000 });
  await inspector.waitFor({ state: 'hidden', timeout: 2_000 });
}

async function closeMobileToolPanel(page: Page) {
  const panel = page.locator('[data-knowledge-mobile-tool-panel]');
  if (!await panel.isVisible({ timeout: 200 }).catch(() => false)) return;
  await page.locator('[data-knowledge-mobile-panel-toggle="true"]').click({ timeout: 2_000 });
  await panel.waitFor({ state: 'hidden', timeout: 2_000 });
}

async function openMobileToolPanel(page: Page, label: string) {
  const trigger = page.locator('[data-knowledge-mobile-command-surface] button').filter({ hasText: label }).first();
  await trigger.click({ timeout: 2_000 });
  await page.locator('[data-knowledge-mobile-tool-panel]').waitFor({ state: 'visible', timeout: 2_000 });
}

function readNarrow3DStateValidation(
  state: CaptureRecord,
  options: { expectedState: string; expanded: boolean; focus?: boolean },
) {
  const base = readStateValidation(state, options);
  const geometry = state.geometry as {
    control: null | { viewMode: string | null };
    surfaces: Record<string, Rect | null>;
    scroll: { viewportWidth: number; scrollWidth: number; bodyScrollWidth: number };
  };
  const failures = [...base.failures];
  if (geometry.control?.viewMode !== '3D') failures.push('view-mode-not-3D');
  if (geometry.scroll.viewportWidth !== 320
    || geometry.scroll.scrollWidth !== 320
    || geometry.scroll.bodyScrollWidth !== 320) {
    failures.push('narrow-scroll-width-not-320');
  }
  const surfacePairOverlaps = {
    mobileToolsMobilePanel: rectsOverlap(geometry.surfaces.mobileTools, geometry.surfaces.mobilePanel),
    mobileToolsDock: rectsOverlap(geometry.surfaces.mobileTools, geometry.surfaces.dock),
    mobileToolsInspector: rectsOverlap(geometry.surfaces.mobileTools, geometry.surfaces.inspector),
    mobilePanelDock: rectsOverlap(geometry.surfaces.mobilePanel, geometry.surfaces.dock),
    mobilePanelInspector: rectsOverlap(geometry.surfaces.mobilePanel, geometry.surfaces.inspector),
    dockInspector: rectsOverlap(geometry.surfaces.dock, geometry.surfaces.inspector),
  };
  const overlappingPairs = Object.entries(surfacePairOverlaps).filter(([, overlaps]) => overlaps);
  if (overlappingPairs.length > 0) {
    failures.push(`mobile-surface-overlap:${overlappingPairs.map(([name]) => name).join(',')}`);
  }
  const auditedSurfaceRects = Object.fromEntries(
    ['mobileTools', 'mobilePanel', 'dock', 'inspector'].map((name) => [name, geometry.surfaces[name] ?? null]),
  );
  return {
    ...base,
    passed: failures.length === 0,
    failures,
    surfacePairOverlaps,
    auditedSurfaceRects,
    scrollWidth: geometry.scroll.scrollWidth,
    bodyScrollWidth: geometry.scroll.bodyScrollWidth,
    viewportWidth: geometry.scroll.viewportWidth,
    dockVerification: geometry.surfaces.dock
      ? 'verified-real-platform-floating-dock'
      : 'unverified-no-real-dock-surface-in-this-viewport-state',
    exactCameraVector: 'unverified-no-existing-page-read-hook',
  };
}

async function switchMobileView(page: Page, mode: ViewMode) {
  await closeMobileInspector(page);
  await openMobileToolPanel(page, '视图');
  const panel = page.locator('[data-knowledge-mobile-tool-panel="view-layout"]');
  await panel.getByRole('button', { name: `${mode} 视图`, exact: true }).click({ timeout: 2_000 });
  await page.waitForFunction((expectedMode) => (
    document.querySelector('[data-knowledge-node-expansion-control="true"]')?.getAttribute('data-view-mode') === expectedMode
  ), mode, { timeout: 5_000 });
  await closeMobileToolPanel(page);
  await page.waitForTimeout(mode === '3D' ? 700 : 250);
}

async function readContinuity(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-knowledge-canvas-primary="true"]');
    const control = document.querySelector('[data-knowledge-node-expansion-control="true"]');
    return {
      selectedNodeId: canvas?.getAttribute('data-knowledge-selected-node-id') ?? '',
      expandedNodeCount: canvas?.getAttribute('data-knowledge-expanded-node-count') ?? '',
      pinnedSignature: canvas?.getAttribute('data-knowledge-pinned-layout-signature') ?? '',
      viewMode: canvas?.getAttribute('data-knowledge-konling-view-mode') ?? '',
      ariaExpanded: control?.getAttribute('aria-expanded') ?? '',
      controlState: control?.getAttribute('data-state') ?? '',
    };
  });
}

function continuityMatches(left: Awaited<ReturnType<typeof readContinuity>>, right: Awaited<ReturnType<typeof readContinuity>>) {
  return left.selectedNodeId === right.selectedNodeId
    && left.expandedNodeCount === right.expandedNodeCount
    && left.pinnedSignature === right.pinnedSignature
    && left.ariaExpanded === right.ariaExpanded
    && left.controlState === right.controlState;
}

async function switchDesktopView(page: Page, mode: ViewMode) {
  const trigger = page.locator('[data-knowledge-command-trigger="view-layout"]').first();
  await trigger.click({ timeout: 2_000 });
  const panel = page.locator('[data-knowledge-desktop-tool-panel="view-layout"]');
  await panel.waitFor({ state: 'visible', timeout: 2_000 });
  await panel.getByRole('button', { name: `${mode} 视图`, exact: true }).click({ timeout: 2_000 });
  await page.waitForFunction((expectedMode) => (
    document.querySelector('[data-knowledge-node-expansion-control="true"]')?.getAttribute('data-view-mode') === expectedMode
  ), mode, { timeout: 5_000 });
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => undefined);
  await page.waitForTimeout(mode === '3D' ? 700 : 250);
}

async function expandCurrentNode(page: Page, routes: Awaited<ReturnType<typeof installGraphRoutes>>) {
  await focusExpansionControlWithKeyboard(page);
  const response = page.waitForResponse((candidate) => {
    const url = new URL(candidate.url());
    return url.searchParams.get('mode') === 'expansion'
      && url.searchParams.get('nodeId') === parentNode.id;
  }, { timeout: 5_000 });
  await page.locator('[data-knowledge-node-expansion-control="true"]').press('Enter');
  await routes.expansionRequested;
  routes.releaseExpansion();
  await response;
  await page.waitForFunction(() => (
    document.querySelector('[data-knowledge-node-expansion-control="true"]')?.getAttribute('data-state') === 'expanded'
  ), undefined, { timeout: 5_000 });
  await page.waitForTimeout(900);
}

async function controlCenter(page: Page) {
  const rect = await page.locator('[data-knowledge-node-expansion-control="true"]').boundingBox({ timeout: 2_000 });
  if (!rect) throw new Error('Expansion control rectangle is unavailable.');
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, rect };
}

function writeMatrixEvidence(evidence: Record<string, unknown>) {
  writeFileSync(
    path.join(outputDir, 'matrix-evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
}

async function captureDesktopLight2D(
  browser: Browser,
  group: MatrixGroupRecord,
  persist: () => void,
) {
  const context = await openContext(browser, 'light', 1440, 960);
  const page = await context.newPage();
  const routes = await installGraphRoutes(page);
  group.status = 'running';
  persist();
  try {
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    await focusExpansionControlWithKeyboard(page);
    const collapsed = await captureState(page, 'desktop-light-collapsed-focus', 'light', '2D', 1440, 960);
    const collapsedPoint = await selectedNodeGraphPoint(page, parentNode.name);
    const collapsedValidation = readStateValidation(collapsed, { expectedState: 'collapsed', expanded: false, focus: true, inspector: true });
    group.states.push(collapsed);
    group.metrics.collapsed = { ...collapsedValidation, controlDistancePixels: collapsedPoint.controlDistancePixels };
    persist();
    if (!collapsedValidation.passed) throw new Error(`desktop light collapsed failed: ${collapsedValidation.failures.join(', ')}`);

    await expandCurrentNode(page, routes);
    await closeDirectoryAndClearHover(page);
    const expanded = await captureState(page, 'desktop-light-expanded-inspector', 'light', '2D', 1440, 960);
    const expandedPoint = await selectedNodeGraphPoint(page, parentNode.name);
    const expandedValidation = readStateValidation(expanded, { expectedState: 'expanded', expanded: true, inspector: true });
    group.states.push(expanded);
    group.metrics.expanded = { ...expandedValidation, controlDistancePixels: expandedPoint.controlDistancePixels };
    persist();
    if (!expandedValidation.passed) throw new Error(`desktop light expanded failed: ${expandedValidation.failures.join(', ')}`);
    group.status = 'passed';
    persist();
  } catch (error) {
    group.status = 'blocked';
    group.failure = error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) };
    persist();
    throw error;
  } finally {
    await context.close();
  }
}

async function captureDesktopDark3D(
  browser: Browser,
  group: MatrixGroupRecord,
  persist: () => void,
) {
  const context = await openContext(browser, 'dark', 1440, 960);
  const page = await context.newPage();
  const routes = await installGraphRoutes(page);
  group.status = 'running';
  persist();
  try {
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    const before3D = await readContinuity(page);
    await switchDesktopView(page, '3D');
    const after3D = await readContinuity(page);
    const collapsed = await captureState(page, 'desktop-dark-collapsed', 'dark', '3D', 1440, 960);
    const collapsedValidation = readStateValidation(collapsed, { expectedState: 'collapsed', expanded: false, inspector: true });
    group.states.push(collapsed);
    group.metrics.collapsed = {
      ...collapsedValidation,
      modeSwitchContinuity: continuityMatches(before3D, after3D),
      before3D,
      after3D,
      controlDistancePolicy: collapsedValidation.anchorClamped ? 'clamped' : '3d-exact-node-vector-unverified',
    };
    persist();
    if (!collapsedValidation.passed || !continuityMatches(before3D, after3D)) {
      throw new Error(`desktop dark 3D collapsed failed: ${collapsedValidation.failures.join(', ') || 'mode continuity'}`);
    }

    await expandCurrentNode(page, routes);
    const expandedContinuity = await readContinuity(page);
    const expanded = await captureState(page, 'desktop-dark-expanded', 'dark', '3D', 1440, 960);
    const expandedValidation = readStateValidation(expanded, { expectedState: 'expanded', expanded: true, inspector: true });
    group.states.push(expanded);
    group.metrics.expanded = {
      ...expandedValidation,
      continuity: expandedContinuity,
      controlDistancePolicy: expandedValidation.anchorClamped ? 'clamped' : '3d-exact-node-vector-unverified',
    };
    persist();
    if (!expandedValidation.passed) throw new Error(`desktop dark 3D expanded failed: ${expandedValidation.failures.join(', ')}`);

    await switchDesktopView(page, '2D');
    const expanded2D = await readContinuity(page);
    await switchDesktopView(page, '3D');
    const expanded3DAgain = await readContinuity(page);
    const continuityPassed = continuityMatches(expandedContinuity, expanded2D)
      && continuityMatches(expandedContinuity, expanded3DAgain);
    const parentBeforeOrbit = await controlCenter(page);
    const canvasRect = await page.locator('[data-knowledge-canvas-primary="true"] canvas').boundingBox({ timeout: 2_000 });
    if (!canvasRect) throw new Error('3D canvas rectangle unavailable for orbit.');
    await page.mouse.move(canvasRect.x + canvasRect.width * 0.44, canvasRect.y + canvasRect.height * 0.44);
    await page.mouse.down();
    await page.mouse.move(canvasRect.x + canvasRect.width * 0.56, canvasRect.y + canvasRect.height * 0.54, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    let orbitBefore = parentBeforeOrbit;
    let orbitAfter = await controlCenter(page);
    let probeNodeId = parentNode.id;
    let movement = distance(orbitBefore, orbitAfter);
    if (movement <= 1) {
      await selectNodeFromDirectory(page, childNodes[0].chapterName, childNodes[0].name);
      await closeDirectoryAndClearHover(page);
      orbitBefore = await controlCenter(page);
      probeNodeId = childNodes[0].id;
      await page.mouse.move(canvasRect.x + canvasRect.width * 0.42, canvasRect.y + canvasRect.height * 0.42);
      await page.mouse.down();
      await page.mouse.move(canvasRect.x + canvasRect.width * 0.54, canvasRect.y + canvasRect.height * 0.52, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(700);
      orbitAfter = await controlCenter(page);
      movement = distance(orbitBefore, orbitAfter);
      await selectNodeFromDirectory(page, parentNode.chapterName, parentNode.name);
      await closeDirectoryAndClearHover(page);
    }
    const orbitState = await captureState(page, 'desktop-dark-expanded-orbit', 'dark', '3D', 1440, 960);
    const orbitValidation = readStateValidation(orbitState, { expectedState: 'expanded', expanded: true, inspector: true });
    group.states.push(orbitState);
    group.metrics.orbit = {
      ...orbitValidation,
      probeNodeId,
      controlCenterBefore: { x: round(orbitBefore.x), y: round(orbitBefore.y) },
      controlCenterAfter: { x: round(orbitAfter.x), y: round(orbitAfter.y) },
      controlMovementPixels: round(movement),
      controlFollowedOrbit: movement > 1,
      expandedModeSwitchContinuity: continuityPassed,
      expandedContinuity,
      expanded2D,
      expanded3DAgain,
      exactCameraVector: 'unverified-no-existing-page-read-hook',
    };
    persist();
    if (!orbitValidation.passed || movement <= 1 || !continuityPassed) {
      throw new Error(`desktop dark 3D orbit failed: ${orbitValidation.failures.join(', ') || 'projection/mode continuity'}`);
    }
    group.status = 'passed';
    persist();
  } catch (error) {
    group.status = 'blocked';
    group.failure = error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) };
    persist();
    throw error;
  } finally {
    await context.close();
  }
}

async function captureMatrixA(browser: Browser) {
  const groups: Record<'desktopLight2D' | 'desktopDark3D', MatrixGroupRecord> = {
    desktopLight2D: { status: 'pending', states: [], metrics: {} },
    desktopDark3D: { status: 'pending', states: [], metrics: {} },
  };
  const evidence: Record<string, unknown> = {
    change: 'improve-knowledge-graph-node-expansion-interaction',
    issue: 894,
    captureScope: 'matrix-a',
    status: 'running',
    capturedAt: new Date().toISOString(),
    sourceCwd: repoRoot,
    sourceGitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    sourceTreeSha256: sourceTreeSha256(),
    baseUrl,
    browser: 'chromium-headed',
    screenshotMode: process.env.ISSUE_894_SCREENSHOT_MODE ?? 'hybrid',
    groups,
    unverified: ['Exact 3D camera and OrbitControls target vectors are not exposed by an existing page read hook.'],
  };
  const persist = () => writeMatrixEvidence(evidence);
  persist();
  try {
    await captureDesktopLight2D(browser, groups.desktopLight2D, persist);
    await captureDesktopDark3D(browser, groups.desktopDark3D, persist);
    evidence.status = 'passed';
    evidence.completedAt = new Date().toISOString();
    persist();
    return evidence;
  } catch (error) {
    evidence.status = 'blocked';
    evidence.failure = error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) };
    evidence.completedAt = new Date().toISOString();
    persist();
    throw error;
  }
}

async function captureNarrowDark2D(
  browser: Browser,
  group: MatrixGroupRecord,
  persist: () => void,
  includeStress: boolean,
) {
  const width = 320;
  const height = 800;
  const context = await openContext(browser, 'dark', width, height);
  const page = await context.newPage();
  const routes = await installGraphRoutes(page);
  group.status = 'running';
  persist();
  try {
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    const keyboardReachability = await diagnoseExpansionControlKeyboardReachability(page);
    group.metrics.focusDiagnostics = keyboardReachability;
    persist();
    const focusFailures: string[] = [];
    if (!keyboardReachability.inspectorTrap.onlyContainsInspectorStops) focusFailures.push('inspector-focus-trap-leaked');
    if (keyboardReachability.escapeReturn.inspectorVisibleAfterEscape) focusFailures.push('inspector-still-visible-after-escape');
    if (!keyboardReachability.escapeReturn.returnedToKnowledgeCanvas) focusFailures.push('escape-focus-did-not-return-to-canvas');
    if (!keyboardReachability.reached) {
      focusFailures.push(`control-unreachable-after-${keyboardReachability.maxTabs}-tabs`);
    }
    if (focusFailures.length > 0) {
      throw new Error(`narrow dark keyboard flow failed: ${focusFailures.join(', ')}`);
    }
    const collapsedPoint = await selectedNodeGraphPoint(page, parentNode.name);
    const collapsed = await captureState(page, 'narrow-dark-collapsed-focus', 'dark', '2D', width, height);
    const collapsedValidation = readNarrowStateValidation(
      collapsed,
      { expectedState: 'collapsed', expanded: false, focus: true, inspectorClosed: true },
      collapsedPoint.controlDistancePixels,
    );
    group.states.push(collapsed);
    group.metrics.collapsed = collapsedValidation;
    persist();
    if (!collapsedValidation.passed) {
      throw new Error(`narrow dark collapsed failed: ${collapsedValidation.failures.join(', ')}`);
    }

    const control = page.locator('[data-knowledge-node-expansion-control="true"]');
    await control.press('Enter');
    await routes.expansionRequested;
    await page.waitForFunction(() => (
      document.querySelector('[data-knowledge-node-expansion-control="true"]')?.getAttribute('aria-busy') === 'true'
    ), undefined, { timeout: 2_000 });
    const loadingPoint = await selectedNodeGraphPoint(page, parentNode.name);
    const loading = await captureState(page, 'narrow-dark-loading-focus', 'dark', '2D', width, height);
    const loadingValidation = readNarrowStateValidation(
      loading,
      { expectedState: 'loading', expanded: false, focus: true, busy: true, inspectorClosed: true },
      loadingPoint.controlDistancePixels,
    );
    group.states.push(loading);
    group.metrics.loading = loadingValidation;
    persist();
    if (!loadingValidation.passed) {
      throw new Error(`narrow dark loading failed: ${loadingValidation.failures.join(', ')}`);
    }

    const expansionResponse = page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return url.searchParams.get('mode') === 'expansion'
        && url.searchParams.get('nodeId') === parentNode.id;
    }, { timeout: 5_000 });
    routes.releaseExpansion();
    await expansionResponse;
    await page.waitForFunction(() => (
      document.querySelector('[data-knowledge-node-expansion-control="true"]')?.getAttribute('data-state') === 'expanded'
    ), undefined, { timeout: 5_000 });
    await page.waitForTimeout(900);
    const expandedPoint = await selectedNodeGraphPoint(page, parentNode.name);
    const expanded = await captureState(page, 'narrow-dark-expanded-focus', 'dark', '2D', width, height);
    const expandedValidation = readNarrowStateValidation(
      expanded,
      { expectedState: 'expanded', expanded: true, focus: true, busy: false, inspectorClosed: true },
      expandedPoint.controlDistancePixels,
    );
    group.states.push(expanded);
    group.metrics.expanded = expandedValidation;
    persist();
    if (!expandedValidation.passed) {
      throw new Error(`narrow dark expanded failed: ${expandedValidation.failures.join(', ')}`);
    }

    if (includeStress) {
      const childPoints = await collectNarrowGraphPoints(page);
      const childViewport = await childViewportMeasurements(page, childPoints);
      await closeMobileInspector(page);
      await selectNodeFromDirectory(page, parentNode.chapterName, parentNode.name);
      await closeMobileInspector(page);
      await closeMobileToolPanel(page);
      await openMobileToolPanel(page, '筛选');
      const stressPoint = await selectedNodeGraphPoint(page, parentNode.name);
      const stress = await captureState(page, 'narrow-dark-mobile-tool-dock-stress', 'dark', '2D', width, height);
      const stressValidation = readNarrowStateValidation(
        stress,
        { expectedState: 'expanded', expanded: true, mobilePanel: true },
        stressPoint.controlDistancePixels,
      );
      const stressGeometry = stress.geometry as { surfaces: Record<string, Rect | null> };
      const auditedSurfaceRects = Object.fromEntries(
        ['mobileTools', 'mobilePanel', 'dock', 'pageFloatingControls', 'inspector']
          .map((name) => [name, stressGeometry.surfaces[name] ?? null]),
      );
      const missingDockSurfaces = ['dock', 'pageFloatingControls']
        .filter((name) => !stressGeometry.surfaces[name]);
      const stressFailures = [...stressValidation.failures];
      if (missingDockSurfaces.length > 0) {
        stressFailures.push(`required-surface-missing:${missingDockSurfaces.join(',')}`);
      }
      const directChildVisibility = {
        ...childViewport,
        allDirectChildNodesInsideCanvas: childViewport.children.every((child) => child.nodeInsideCanvas),
        allDirectChildLabelsInsideCanvas: childViewport.children.every((child) => child.labelEnvelopeInsideCanvas),
        narrowViewportPolicy: childViewport.allDirectChildrenAndLabelsInsideCanvas
          ? 'all-direct-children-and-label-envelopes-visible'
          : 'partial-label-envelope-visibility-accepted-if-nodes-and-links-remain-recoverable',
        measurementLimitation: 'Child projections are sampled serially through the real mobile directory.',
      };
      group.states.push(stress);
      group.metrics.stress = {
        ...stressValidation,
        passed: stressFailures.length === 0,
        failures: stressFailures,
        auditedSurfaceRects,
        dockVerification: stressGeometry.surfaces.dock && stressGeometry.surfaces.pageFloatingControls
          ? 'verified-real-platform-floating-dock'
          : 'unverified-no-real-dock-surface-in-this-viewport-state',
        directChildVisibility,
      };
      persist();
      if (stressFailures.length > 0 || !directChildVisibility.allDirectChildNodesInsideCanvas) {
        const reasons = [...stressFailures];
        if (!directChildVisibility.allDirectChildNodesInsideCanvas) reasons.push('direct-child-node-outside-canvas');
        throw new Error(`narrow dark stress failed: ${reasons.join(', ')}`);
      }

      await closeMobileToolPanel(page);
      const konlingAttempt = await openRealKonlingSurface(page);
      const konlingState = await captureState(page, 'narrow-dark-konling-modal-stress', 'dark', '2D', width, height);
      const konlingGeometry = konlingState.geometry as {
        controlRect: Rect | null;
        canvas: { selectedNodeId: string | null; expandedNodeCount: number } | null;
        surfaces: Record<string, Rect | null>;
        scroll: { viewportWidth: number; scrollWidth: number; bodyScrollWidth: number };
      };
      const konlingModal = await page.locator('[data-global-ai-sidebar="open"]').evaluate((element) => ({
        role: element.getAttribute('role'),
        ariaModal: element.getAttribute('aria-modal'),
      }));
      const konlingRect = konlingGeometry.surfaces.konling;
      const konlingFailures: string[] = [];
      if (!konlingAttempt.verified) konlingFailures.push(`konling:${konlingAttempt.reason ?? 'not-opened'}`);
      if (!konlingRect) konlingFailures.push('required-surface-missing:konling');
      if (konlingModal.role !== 'dialog' || konlingModal.ariaModal !== 'true') {
        konlingFailures.push('konling-mobile-surface-not-modal');
      }
      if (konlingGeometry.controlRect) konlingFailures.push('underlying-expansion-control-not-suspended');
      if (konlingGeometry.canvas?.selectedNodeId !== parentNode.id) konlingFailures.push('selected-node-context-lost');
      if (Number(konlingGeometry.canvas?.expandedNodeCount ?? 0) < 1) konlingFailures.push('expanded-state-lost');
      if (
        konlingGeometry.scroll.viewportWidth !== width
        || konlingGeometry.scroll.scrollWidth !== width
        || konlingGeometry.scroll.bodyScrollWidth !== width
      ) konlingFailures.push('narrow-scroll-width-not-320');
      const modalCoversViewport = Boolean(
        konlingRect
        && konlingRect.left <= 0.5
        && konlingRect.top <= 0.5
        && konlingRect.right >= width - 0.5
        && konlingRect.bottom >= height - 0.5
      );
      if (!modalCoversViewport) konlingFailures.push('konling-mobile-modal-does-not-cover-viewport');
      group.states.push(konlingState);
      group.metrics.konlingModalStress = {
        passed: konlingFailures.length === 0,
        failures: konlingFailures,
        konlingAttempt,
        konlingModal,
        modalCoversViewport,
        underlyingExpansionControlSuspended: !konlingGeometry.controlRect,
        selectedNodeId: konlingGeometry.canvas?.selectedNodeId ?? null,
        expandedNodeCount: konlingGeometry.canvas?.expandedNodeCount ?? null,
        dockLifecycle: konlingGeometry.surfaces.dock || konlingGeometry.surfaces.pageFloatingControls
          ? 'unexpectedly-visible-behind-mobile-modal'
          : 'hidden-while-full-screen-Konling-dialog-is-open',
        auditedSurfaceRects: Object.fromEntries(
          ['mobileTools', 'dock', 'pageFloatingControls', 'konling']
            .map((name) => [name, konlingGeometry.surfaces[name] ?? null]),
        ),
      };
      persist();
      if (konlingFailures.length > 0) {
        throw new Error(`narrow dark Konling/dock stress failed: ${konlingFailures.join(', ')}`);
      }
    }
    group.status = 'passed';
    persist();
  } catch (error) {
    group.status = 'blocked';
    group.failure = error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) };
    persist();
    throw error;
  } finally {
    await context.close();
  }
}

async function captureNarrowLight2D(browser: Browser, group: MatrixGroupRecord, persist: () => void) {
  const width = 320;
  const height = 800;
  const context = await openContext(browser, 'light', width, height);
  const page = await context.newPage();
  const routes = await installGraphRoutes(page);
  group.status = 'running';
  persist();
  try {
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    const keyboardReachability = await diagnoseExpansionControlKeyboardReachability(page);
    group.metrics.focusDiagnostics = keyboardReachability;
    persist();
    if (!keyboardReachability.inspectorTrap.onlyContainsInspectorStops
      || keyboardReachability.escapeReturn.inspectorVisibleAfterEscape
      || !keyboardReachability.escapeReturn.returnedToKnowledgeCanvas
      || !keyboardReachability.reached) {
      throw new Error('narrow light keyboard focus flow failed before expansion');
    }
    await expandCurrentNode(page, routes);
    const expandedFocusReachability = await tabToExpansionControl(page);
    group.metrics.expandedFocusReachability = expandedFocusReachability;
    persist();
    if (!expandedFocusReachability.reached) {
      throw new Error('narrow light expanded control is not keyboard reachable after 120 Tab presses');
    }
    const point = await selectedNodeGraphPoint(page, parentNode.name);
    const expanded = await captureState(page, 'narrow-light-expanded-focus', 'light', '2D', width, height);
    const validation = readNarrowStateValidation(
      expanded,
      { expectedState: 'expanded', expanded: true, focus: true, busy: false, inspectorClosed: true },
      point.controlDistancePixels,
    );
    group.states.push(expanded);
    group.metrics.expanded = {
      ...validation,
      htmlClass: (expanded.geometry as { htmlClass?: string }).htmlClass ?? null,
    };
    persist();
    if (!validation.passed) throw new Error(`narrow light expanded failed: ${validation.failures.join(', ')}`);
    group.status = 'passed';
    persist();
  } catch (error) {
    group.status = 'blocked';
    group.failure = error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) };
    persist();
    throw error;
  } finally {
    await context.close();
  }
}

async function captureMatrixB1(browser: Browser, stage: 'dark-core' | 'complete') {
  const groups: Record<'narrowDark2D' | 'narrowLight2D', MatrixGroupRecord> = {
    narrowDark2D: { status: 'pending', states: [], metrics: {} },
    narrowLight2D: { status: 'pending', states: [], metrics: {} },
  };
  const evidence: Record<string, unknown> = {
    change: 'improve-knowledge-graph-node-expansion-interaction',
    issue: 894,
    captureScope: stage === 'dark-core' ? 'matrix-b1-dark-core' : 'matrix-b1',
    status: 'running',
    capturedAt: new Date().toISOString(),
    sourceCwd: repoRoot,
    sourceGitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    sourceTreeSha256: sourceTreeSha256(),
    baseUrl,
    browser: 'chromium-headed',
    screenshotMode: process.env.ISSUE_894_SCREENSHOT_MODE ?? 'hybrid',
    groups,
  };
  const persist = () => writeFileSync(
    path.join(outputDir, 'matrix-evidence-b1.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
  persist();
  const failures: Array<{ group: string; name: string; message: string }> = [];
  try {
    await captureNarrowDark2D(browser, groups.narrowDark2D, persist, stage === 'complete');
  } catch (error) {
    failures.push({
      group: 'narrowDark2D',
      name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (stage === 'complete') {
    try {
      await captureNarrowLight2D(browser, groups.narrowLight2D, persist);
    } catch (error) {
      failures.push({
        group: 'narrowLight2D',
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  try {
    if (failures.length > 0) throw new Error(failures.map((failure) => `${failure.group}: ${failure.message}`).join('; '));
    evidence.status = 'passed';
    evidence.completedAt = new Date().toISOString();
    persist();
    return evidence;
  } catch (error) {
    evidence.status = 'blocked';
    evidence.failure = error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) };
    evidence.failures = failures;
    evidence.completedAt = new Date().toISOString();
    persist();
    throw error;
  }
}

async function captureNarrowDark3D(browser: Browser, group: MatrixGroupRecord, persist: () => void) {
  const width = 320;
  const height = 800;
  const context = await openContext(browser, 'dark', width, height);
  const page = await context.newPage();
  const routes = await installGraphRoutes(page);
  group.status = 'running';
  persist();
  try {
    const stateFailures: string[] = [];
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    const keyboardFlow = await diagnoseExpansionControlKeyboardReachability(page);
    group.metrics.focusDiagnostics = keyboardFlow;
    persist();
    if (!keyboardFlow.inspectorTrap.onlyContainsInspectorStops
      || keyboardFlow.escapeReturn.inspectorVisibleAfterEscape
      || !keyboardFlow.escapeReturn.returnedToKnowledgeCanvas
      || !keyboardFlow.reached) {
      throw new Error('narrow dark 3D keyboard flow failed before mode switch');
    }
    const before3D = await readContinuity(page);
    await switchMobileView(page, '3D');
    const after3D = await readContinuity(page);
    const collapsed = await captureState(page, 'narrow-dark-3d-collapsed', 'dark', '3D', width, height);
    const collapsedValidation = readNarrow3DStateValidation(collapsed, { expectedState: 'collapsed', expanded: false });
    group.states.push(collapsed);
    group.metrics.collapsed = {
      ...collapsedValidation,
      modeSwitchContinuity: continuityMatches(before3D, after3D),
      before3D,
      after3D,
    };
    persist();
    if (!collapsedValidation.passed || !continuityMatches(before3D, after3D)) {
      stateFailures.push(`collapsed:${collapsedValidation.failures.join(', ') || 'mode continuity'}`);
    }

    await expandCurrentNode(page, routes);
    const expandedContinuity = await readContinuity(page);
    const expanded = await captureState(page, 'narrow-dark-3d-expanded', 'dark', '3D', width, height);
    const expandedValidation = readNarrow3DStateValidation(expanded, { expectedState: 'expanded', expanded: true });
    group.states.push(expanded);
    group.metrics.expanded = { ...expandedValidation, continuity: expandedContinuity };
    persist();
    if (!expandedValidation.passed) {
      stateFailures.push(`expanded:${expandedValidation.failures.join(', ')}`);
    }

    await switchMobileView(page, '2D');
    const expanded2D = await readContinuity(page);
    await switchMobileView(page, '3D');
    const expanded3DAgain = await readContinuity(page);
    const continuityPassed = continuityMatches(expandedContinuity, expanded2D)
      && continuityMatches(expandedContinuity, expanded3DAgain);
    const orbitBefore = await controlCenter(page);
    const canvasRect = await page.locator('[data-knowledge-canvas-primary="true"] canvas').boundingBox({ timeout: 2_000 });
    if (!canvasRect) throw new Error('Narrow 3D canvas rectangle unavailable for orbit.');
    await page.mouse.move(canvasRect.x + canvasRect.width * 0.44, canvasRect.y + canvasRect.height * 0.44);
    await page.mouse.down();
    await page.mouse.move(canvasRect.x + canvasRect.width * 0.56, canvasRect.y + canvasRect.height * 0.54, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    const orbitAfter = await controlCenter(page);
    const movement = distance(orbitBefore, orbitAfter);
    const orbit = await captureState(page, 'narrow-dark-3d-expanded-orbit', 'dark', '3D', width, height);
    const orbitValidation = readNarrow3DStateValidation(orbit, { expectedState: 'expanded', expanded: true });
    const orbitContinuity = await readContinuity(page);
    const orbitStateContinuity = continuityMatches(expandedContinuity, orbitContinuity);
    group.states.push(orbit);
    group.metrics.orbit = {
      ...orbitValidation,
      controlCenterBefore: { x: round(orbitBefore.x), y: round(orbitBefore.y) },
      controlCenterAfter: { x: round(orbitAfter.x), y: round(orbitAfter.y) },
      controlMovementPixels: round(movement),
      controlFollowedOrbit: movement > 1,
      expandedModeSwitchContinuity: continuityPassed,
      orbitStateContinuity,
      expandedContinuity,
      expanded2D,
      expanded3DAgain,
      orbitContinuity,
    };
    persist();
    if (!orbitValidation.passed || movement <= 1 || !continuityPassed || !orbitStateContinuity) {
      const reasons = [...orbitValidation.failures];
      if (movement <= 1) reasons.push('control-did-not-follow-orbit');
      if (!continuityPassed) reasons.push('mode-switch-continuity');
      if (!orbitStateContinuity) reasons.push('orbit-state-continuity');
      stateFailures.push(`orbit:${reasons.join(', ')}`);
    }
    if (stateFailures.length > 0) {
      throw new Error(`narrow dark 3D states failed: ${stateFailures.join('; ')}`);
    }
    group.status = 'passed';
    persist();
  } catch (error) {
    group.status = 'blocked';
    group.failure = error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) };
    persist();
    throw error;
  } finally {
    await context.close();
  }
}

async function captureNarrowLight3D(browser: Browser, group: MatrixGroupRecord, persist: () => void) {
  const width = 320;
  const height = 800;
  const context = await openContext(browser, 'light', width, height);
  const page = await context.newPage();
  const routes = await installGraphRoutes(page);
  group.status = 'running';
  persist();
  try {
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    const keyboardFlow = await diagnoseExpansionControlKeyboardReachability(page);
    group.metrics.focusDiagnostics = keyboardFlow;
    persist();
    if (!keyboardFlow.inspectorTrap.onlyContainsInspectorStops
      || keyboardFlow.escapeReturn.inspectorVisibleAfterEscape
      || !keyboardFlow.escapeReturn.returnedToKnowledgeCanvas
      || !keyboardFlow.reached) {
      throw new Error('narrow light 3D keyboard flow failed before mode switch');
    }
    const before3D = await readContinuity(page);
    await switchMobileView(page, '3D');
    const after3D = await readContinuity(page);
    await expandCurrentNode(page, routes);
    const expandedFocus = await tabToExpansionControl(page);
    group.metrics.expandedFocusReachability = expandedFocus;
    persist();
    if (!expandedFocus.reached) throw new Error('narrow light 3D expanded control is not keyboard reachable');
    const expanded = await captureState(page, 'narrow-light-3d-expanded-focus', 'light', '3D', width, height);
    const validation = readNarrow3DStateValidation(expanded, { expectedState: 'expanded', expanded: true, focus: true });
    group.states.push(expanded);
    group.metrics.expanded = {
      ...validation,
      htmlClass: (expanded.geometry as { htmlClass?: string }).htmlClass ?? null,
      modeSwitchContinuity: continuityMatches(before3D, after3D),
      before3D,
      after3D,
      continuity: await readContinuity(page),
    };
    persist();
    if (!validation.passed || !continuityMatches(before3D, after3D)) {
      throw new Error(`narrow light 3D expanded failed: ${validation.failures.join(', ') || 'mode continuity'}`);
    }
    group.status = 'passed';
    persist();
  } catch (error) {
    group.status = 'blocked';
    group.failure = error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) };
    persist();
    throw error;
  } finally {
    await context.close();
  }
}

async function captureMatrixB2(browser: Browser) {
  const groups: Record<'narrowDark3D' | 'narrowLight3D', MatrixGroupRecord> = {
    narrowDark3D: { status: 'pending', states: [], metrics: {} },
    narrowLight3D: { status: 'pending', states: [], metrics: {} },
  };
  const evidence: Record<string, unknown> = {
    change: 'improve-knowledge-graph-node-expansion-interaction',
    issue: 894,
    captureScope: 'matrix-b2',
    status: 'running',
    capturedAt: new Date().toISOString(),
    sourceCwd: repoRoot,
    sourceGitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    sourceTreeSha256: sourceTreeSha256(),
    baseUrl,
    browser: 'chromium-headed',
    screenshotMode: process.env.ISSUE_894_SCREENSHOT_MODE ?? 'hybrid',
    groups,
    unverified: ['Exact 3D camera and OrbitControls target vectors are not exposed by an existing page read hook.'],
  };
  const persist = () => writeFileSync(
    path.join(outputDir, 'matrix-evidence-b2.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
  const failures: Array<{ group: string; name: string; message: string }> = [];
  persist();
  for (const [name, capture] of [
    ['narrowDark3D', () => captureNarrowDark3D(browser, groups.narrowDark3D, persist)],
    ['narrowLight3D', () => captureNarrowLight3D(browser, groups.narrowLight3D, persist)],
  ] as const) {
    try {
      await capture();
    } catch (error) {
      failures.push({
        group: name,
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  evidence.completedAt = new Date().toISOString();
  evidence.failures = failures;
  evidence.status = failures.length === 0 ? 'passed' : 'blocked';
  persist();
  if (failures.length > 0) {
    throw new Error(failures.map((failure) => `${failure.group}: ${failure.message}`).join('; '));
  }
  return evidence;
}

async function openRealKonlingSurface(page: Page) {
  const entry = page.locator('[data-platform-floating-dock-primary="konling"]').first();
  if (!await entry.isVisible({ timeout: 500 }).catch(() => false)) {
    return { verified: false, reason: 'no-visible-real-konling-entry' };
  }
  try {
    await entry.click({ timeout: 2_000 });
    await page.locator('[data-global-ai-sidebar="open"]').waitFor({ state: 'visible', timeout: 3_000 });
    await page.waitForTimeout(500);
    return { verified: true, reason: null };
  } catch (error) {
    return {
      verified: false,
      reason: error instanceof Error ? `real-entry-open-failed:${error.message}` : 'real-entry-open-failed',
    };
  }
}

async function captureDesktopLight3DMatrixC(browser: Browser, group: MatrixGroupRecord, persist: () => void) {
  const width = 1440;
  const height = 960;
  const context = await openContext(browser, 'light', width, height);
  const page = await context.newPage();
  const routes = await installGraphRoutes(page);
  group.status = 'running';
  persist();
  try {
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    const before3D = await readContinuity(page);
    await switchDesktopView(page, '3D');
    const after3D = await readContinuity(page);
    await expandCurrentNode(page, routes);
    const expandedFocus = await tabToExpansionControl(page);
    group.metrics.expandedFocusReachability = expandedFocus;
    persist();
    if (!expandedFocus.reached) throw new Error('desktop light 3D expanded control is not keyboard reachable');
    const state = await captureState(page, 'desktop-light-3d-expanded-focus', 'light', '3D', width, height);
    const validation = readStateValidation(state, { expectedState: 'expanded', expanded: true, focus: true, inspector: true });
    group.states.push(state);
    group.metrics.expanded = {
      ...validation,
      htmlClass: (state.geometry as { htmlClass?: string }).htmlClass ?? null,
      modeSwitchContinuity: continuityMatches(before3D, after3D),
      continuity: await readContinuity(page),
      exactCameraVector: 'unverified-no-existing-page-read-hook',
    };
    persist();
    if (!validation.passed || !continuityMatches(before3D, after3D)) {
      throw new Error(`desktop light 3D expanded failed: ${validation.failures.join(', ') || 'mode continuity'}`);
    }
    group.status = 'passed';
    persist();
  } catch (error) {
    group.status = 'blocked';
    group.failure = error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) };
    persist();
    throw error;
  } finally {
    await context.close();
  }
}

async function captureDesktopDarkStressMatrixC(browser: Browser, group: MatrixGroupRecord, persist: () => void) {
  const width = 1440;
  const height = 960;
  const context = await openContext(browser, 'dark', width, height);
  const page = await context.newPage();
  const routes = await installGraphRoutes(page);
  group.status = 'running';
  persist();
  try {
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    await expandCurrentNode(page, routes);
    await openDesktopTool(page, 'relation-filters');
    const filterPanel = page.locator('[data-knowledge-desktop-tool-panel="relation-filters"]');
    await filterPanel.waitFor({ state: 'visible', timeout: 2_000 });
    const localPanelState = await captureState(page, 'desktop-dark-2d-expanded-local-panel-stress', 'dark', '2D', width, height);
    const localPanelValidation = readStateValidation(
      localPanelState,
      { expectedState: 'expanded', expanded: true, inspector: true },
    );
    const localPanelGeometry = localPanelState.geometry as {
      surfaces: Record<string, Rect | null>;
      scroll: { scrollWidth: number; viewportWidth: number };
    };
    const missingLocalSurfaces = ['activeLocalPanel', 'inspector', 'dock', 'pageFloatingControls']
      .filter((name) => !localPanelGeometry.surfaces[name]);
    const localPanelFailures = [...localPanelValidation.failures];
    if (missingLocalSurfaces.length > 0) {
      localPanelFailures.push(`required-surface-missing:${missingLocalSurfaces.join(',')}`);
    }
    group.states.push(localPanelState);
    group.metrics.localPanelStress = {
      ...localPanelValidation,
      passed: localPanelFailures.length === 0,
      failures: localPanelFailures,
      auditedSurfaceRects: Object.fromEntries(
        ['activeLocalPanel', 'inspector', 'dock', 'pageFloatingControls']
          .map((name) => [name, localPanelGeometry.surfaces[name] ?? null]),
      ),
      scrollWidth: localPanelGeometry.scroll.scrollWidth,
      viewportWidth: localPanelGeometry.scroll.viewportWidth,
    };
    persist();
    if (localPanelFailures.length > 0) {
      throw new Error(`desktop dark 2D local-panel stress failed: ${localPanelFailures.join(', ')}`);
    }

    const konlingAttempt = await openRealKonlingSurface(page);
    const konlingState = await captureState(page, 'desktop-dark-2d-expanded-konling-dock-stress', 'dark', '2D', width, height);
    const konlingValidation = readStateValidation(konlingState, { expectedState: 'expanded', expanded: true });
    const konlingGeometry = konlingState.geometry as {
      surfaces: Record<string, Rect | null>;
      scroll: { scrollWidth: number; viewportWidth: number };
    };
    const missingKonlingSurfaces = ['konling']
      .filter((name) => !konlingGeometry.surfaces[name]);
    const konlingFailures = [...konlingValidation.failures];
    if (!konlingAttempt.verified) konlingFailures.push(`konling:${konlingAttempt.reason ?? 'not-opened'}`);
    if (missingKonlingSurfaces.length > 0) {
      konlingFailures.push(`required-surface-missing:${missingKonlingSurfaces.join(',')}`);
    }
    group.states.push(konlingState);
    group.metrics.konlingDockStress = {
      ...konlingValidation,
      passed: konlingFailures.length === 0,
      failures: konlingFailures,
      konlingAttempt,
      auditedSurfaceRects: Object.fromEntries(
        ['activeLocalPanel', 'inspector', 'dock', 'pageFloatingControls', 'konling']
          .map((name) => [name, konlingGeometry.surfaces[name] ?? null]),
      ),
      scrollWidth: konlingGeometry.scroll.scrollWidth,
      viewportWidth: konlingGeometry.scroll.viewportWidth,
      dockLifecycleWhileKonlingOpen: konlingGeometry.surfaces.dock || konlingGeometry.surfaces.pageFloatingControls
        ? 'visible-and-validated'
        : 'suspended-as-expected-while-sidebar-open',
      continuity: await readContinuity(page),
    };
    persist();
    if (konlingFailures.length > 0) {
      throw new Error(`desktop dark 2D Konling/dock stress failed: ${konlingFailures.join(', ')}`);
    }
    group.status = 'passed';
    persist();
  } catch (error) {
    group.status = 'blocked';
    group.failure = error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) };
    persist();
    throw error;
  } finally {
    await context.close();
  }
}

async function captureIntermediateExpandedMatrixC(
  browser: Browser,
  width: 1279 | 1100 | 1024,
  group: MatrixGroupRecord,
  persist: () => void,
) {
  const height = 800;
  const context = await openContext(browser, 'dark', width, height);
  const page = await context.newPage();
  const routes = await installGraphRoutes(page);
  group.status = 'running';
  persist();
  try {
    await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(parentNode.id)}&qa=knowledge-product`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);
    await expandCurrentNode(page, routes);
    await closeDirectoryAndClearHover(page);
    const point = await selectedNodeGraphPoint(page, parentNode.name);
    const state = await captureState(page, `intermediate-${width}-dark-expanded`, 'dark', '2D', width, height);
    const validation = readNarrowStateValidation(
      state,
      { expectedState: 'expanded', expanded: true, inspector: true },
      point.controlDistancePixels,
    );
    const geometry = state.geometry as { surfaces: Record<string, Rect | null> };
    group.states.push(state);
    group.metrics.expanded = {
      ...validation,
      auditedSurfaceRects: Object.fromEntries(
        ['desktopTools', 'activeLocalPanel', 'inspector', 'dock', 'pageFloatingControls']
          .map((name) => [name, geometry.surfaces[name] ?? null]),
      ),
    };
    persist();
    if (!validation.passed) {
      throw new Error(`intermediate ${width} dark expanded failed: ${validation.failures.join(', ')}`);
    }
    group.status = 'passed';
    persist();
  } catch (error) {
    group.status = 'blocked';
    group.failure = error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) };
    persist();
    throw error;
  } finally {
    await context.close();
  }
}

async function captureMatrixC(browser: Browser) {
  const groups: Record<string, MatrixGroupRecord> = {
    desktopLight3D: { status: 'pending', states: [], metrics: {} },
    desktopDarkStress2D: { status: 'pending', states: [], metrics: {} },
    dark1279Expanded2D: { status: 'pending', states: [], metrics: {} },
    dark1100Expanded2D: { status: 'pending', states: [], metrics: {} },
    dark1024Expanded2D: { status: 'pending', states: [], metrics: {} },
  };
  const evidence: Record<string, unknown> = {
    change: 'improve-knowledge-graph-node-expansion-interaction',
    issue: 894,
    captureScope: 'matrix-c',
    status: 'running',
    capturedAt: new Date().toISOString(),
    sourceCwd: repoRoot,
    sourceGitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    sourceTreeSha256: sourceTreeSha256(),
    baseUrl,
    browser: 'chromium-headed',
    screenshotMode: process.env.ISSUE_894_SCREENSHOT_MODE ?? 'hybrid',
    groups,
  };
  const persist = () => writeFileSync(
    path.join(outputDir, 'matrix-evidence-c.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
  const groupTimeoutMs = Number(process.env.ISSUE_894_MATRIX_GROUP_TIMEOUT_MS ?? 120_000);
  const failures: Array<{ group: string; name: string; message: string }> = [];
  const captures: Array<[string, () => Promise<void>]> = [
    ['desktopLight3D', () => captureDesktopLight3DMatrixC(browser, groups.desktopLight3D, persist)],
    ['desktopDarkStress2D', () => captureDesktopDarkStressMatrixC(browser, groups.desktopDarkStress2D, persist)],
    ['dark1279Expanded2D', () => captureIntermediateExpandedMatrixC(browser, 1279, groups.dark1279Expanded2D, persist)],
    ['dark1100Expanded2D', () => captureIntermediateExpandedMatrixC(browser, 1100, groups.dark1100Expanded2D, persist)],
    ['dark1024Expanded2D', () => captureIntermediateExpandedMatrixC(browser, 1024, groups.dark1024Expanded2D, persist)],
  ];
  persist();
  for (const [name, capture] of captures) {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(`${name} exceeded ${groupTimeoutMs}ms hard limit`)), groupTimeoutMs);
    });
    try {
      await Promise.race([capture(), timeout]);
    } catch (error) {
      failures.push({
        group: name,
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }
  evidence.completedAt = new Date().toISOString();
  evidence.failures = failures;
  evidence.status = failures.length === 0 ? 'passed' : 'blocked';
  persist();
  if (failures.length > 0) throw new Error(failures.map((failure) => `${failure.group}: ${failure.message}`).join('; '));
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
  const browser = await chromium.launch({ headless });
  try {
    if (process.env.ISSUE_894_CAPTURE_SCOPE === 'matrix-a') {
      const timeoutMs = Number(process.env.ISSUE_894_MATRIX_TIMEOUT_MS ?? 120_000);
      let matrixTimeout: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        matrixTimeout = setTimeout(() => reject(new Error(
          `Issue 894 matrix A capture exceeded ${timeoutMs}ms hard limit.`,
        )), timeoutMs);
      });
      await Promise.race([captureMatrixA(browser), timeoutPromise]).finally(() => {
        if (matrixTimeout) clearTimeout(matrixTimeout);
      });
      console.log(`Issue 894 matrix A evidence written to ${path.relative(repoRoot, path.join(outputDir, 'matrix-evidence.json'))}`);
      return;
    }
    if (process.env.ISSUE_894_CAPTURE_SCOPE === 'matrix-b1') {
      const timeoutMs = Number(process.env.ISSUE_894_MATRIX_TIMEOUT_MS ?? 120_000);
      const stage = process.env.ISSUE_894_MATRIX_B1_STAGE === 'dark-core' ? 'dark-core' : 'complete';
      let matrixTimeout: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        matrixTimeout = setTimeout(() => reject(new Error(
          `Issue 894 matrix B1 capture exceeded ${timeoutMs}ms hard limit.`,
        )), timeoutMs);
      });
      await Promise.race([captureMatrixB1(browser, stage), timeoutPromise]).finally(() => {
        if (matrixTimeout) clearTimeout(matrixTimeout);
      });
      console.log(`Issue 894 matrix B1 evidence written to ${path.relative(repoRoot, path.join(outputDir, 'matrix-evidence-b1.json'))}`);
      return;
    }
    if (process.env.ISSUE_894_CAPTURE_SCOPE === 'matrix-b2') {
      const timeoutMs = Number(process.env.ISSUE_894_MATRIX_TIMEOUT_MS ?? 120_000);
      let matrixTimeout: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        matrixTimeout = setTimeout(() => reject(new Error(
          `Issue 894 matrix B2 capture exceeded ${timeoutMs}ms hard limit.`,
        )), timeoutMs);
      });
      await Promise.race([captureMatrixB2(browser), timeoutPromise]).finally(() => {
        if (matrixTimeout) clearTimeout(matrixTimeout);
      });
      console.log(`Issue 894 matrix B2 evidence written to ${path.relative(repoRoot, path.join(outputDir, 'matrix-evidence-b2.json'))}`);
      return;
    }
    if (process.env.ISSUE_894_CAPTURE_SCOPE === 'matrix-c') {
      await captureMatrixC(browser);
      console.log(`Issue 894 matrix C evidence written to ${path.relative(repoRoot, path.join(outputDir, 'matrix-evidence-c.json'))}`);
      return;
    }
    const representativeTimeoutMs = Number(process.env.ISSUE_894_REPRESENTATIVE_TIMEOUT_MS ?? 75_000);
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(
          `Issue 894 representative capture exceeded ${representativeTimeoutMs}ms hard limit.`,
      )), representativeTimeoutMs);
    });
    const representative = await Promise.race([captureRepresentative(browser), timeoutPromise])
      .finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      });
    const manifest = {
      change: 'improve-knowledge-graph-node-expansion-interaction',
      issue: 894,
      captureScope: 'representative',
      capturedAt: new Date().toISOString(),
      sourceCwd: repoRoot,
      sourceGitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
      sourceTreeSha256: sourceTreeSha256(),
      baseUrl,
      route: '/knowledge',
      browser: headless ? 'chromium-headless' : 'chromium-headed',
      currentSourceSha256: Object.fromEntries(sourceFiles
        .filter((file) => file !== 'scripts/tests/test-knowledge-graph-node-expansion-894-governance.ts')
        .map((file) => [file, sha256(file)])),
      representative,
      unverified: [
        '3D camera vector is not exposed by an existing production or QA hook.',
        'Full desktop/narrow light/dark 2D/3D matrix has not run in representative mode.',
      ],
    };
    writeFileSync(path.join(outputDir, 'browser-evidence.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Issue 894 representative evidence written to ${path.relative(repoRoot, outputDir)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
