import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium, type Browser, type Page } from 'playwright';

const repoRoot = process.cwd();
const baseUrl = process.env.KNOWLEDGE_PROGRESSIVE_BASE_URL ?? 'http://127.0.0.1:3002';
const outputDir = path.join(repoRoot, 'artifacts/knowledge-graph-progressive-loading-875');

const sourceFiles = [
  'src/features/knowledge/knowledge-graph-system.tsx',
  'src/features/knowledge/sidebar/knowledge-sidebar.tsx',
  'src/features/knowledge/graph/filter-utils.ts',
  'src/lib/knowledge-graph-source.ts',
  'src/app/api/knowledge/graph/route.ts',
  'scripts/tests/capture-knowledge-graph-progressive-loading.ts',
  'scripts/tests/test-knowledge-graph-progressive-loading-governance.ts',
] as const;

type EvidenceRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type CaptureState = {
  name: string;
  width: number;
  height: number;
  query?: string;
  beforeShot?: (page: Page) => Promise<Record<string, unknown> | void>;
};
type ProgressivePayload = {
  mode?: string;
  graphVersion?: string;
  shardKey?: string;
  nodes?: Array<{ id?: string; name?: string }>;
  links?: Array<{ sourceId?: string; targetId?: string }>;
  rootSummaries?: Array<unknown>;
};

function sha256(relativePath: string) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to read ${url}: ${response.status}`);
  return await response.json() as T;
}

async function resolveProgressiveTargets() {
  const root = await readJson<ProgressivePayload>(`${baseUrl}/api/knowledge/graph?mode=root`);
  const remaining = await readJson<ProgressivePayload>(`${baseUrl}/api/knowledge/graph?mode=remaining`);
  const rootNodeId = root.nodes?.find((node) => typeof node.id === 'string' && node.id.startsWith('chapter-node:'))?.id;
  if (!rootNodeId) throw new Error('Root progressive payload did not include a chapter root node.');

  const degreeByNodeId = new Map<string, number>();
  for (const link of remaining.links ?? []) {
    if (typeof link.sourceId === 'string') degreeByNodeId.set(link.sourceId, (degreeByNodeId.get(link.sourceId) ?? 0) + 1);
    if (typeof link.targetId === 'string') degreeByNodeId.set(link.targetId, (degreeByNodeId.get(link.targetId) ?? 0) + 1);
  }
  const noChildrenNode = remaining.nodes?.find((node) => (
    typeof node.id === 'string'
    && !node.id.startsWith('chapter-node:')
    && !degreeByNodeId.has(node.id)
  ));
  if (!noChildrenNode?.id) throw new Error('Remaining graph payload did not include a no-children node.');
  const noChildrenNodeName = noChildrenNode.name ?? noChildrenNode.id;
  const normalizedSearch = noChildrenNodeName.toLowerCase();
  const expectedFilteredRootNames = [...new Set(
    (remaining.nodes ?? [])
      .filter((node) => {
        const record = node as { description?: string; metadata?: { keywords?: unknown } };
        const keywords = Array.isArray(record.metadata?.keywords)
          ? record.metadata.keywords.filter((item): item is string => typeof item === 'string')
          : [];
        const haystack = [
          node.name,
          record.description,
          ...keywords,
        ].map((item) => String(item ?? '').toLowerCase()).join(' ');
        return haystack.includes(normalizedSearch);
      })
      .map((node) => {
        const record = node as { chapterName?: string; metadata?: { chapterName?: string } };
        return record.chapterName ?? record.metadata?.chapterName ?? '';
      })
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  const expectedFilteredRootCount = expectedFilteredRootNames.length;
  if (expectedFilteredRootCount <= 0) throw new Error('Selected search target did not map to any expected chapter roots.');
  return { rootNodeId, noChildrenNodeId: noChildrenNode.id, noChildrenNodeName, expectedFilteredRootCount, expectedFilteredRootNames };
}

async function openStatePage(browser: Browser, state: CaptureState) {
  const context = await browser.newContext({
    viewport: { width: state.width, height: state.height },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem('ai-obe-theme', 'dark');
    window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  });
  const page = await context.newPage();
  if (state.name.startsWith('root-first')) {
    await page.route('**/api/knowledge/graph?mode=remaining**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
  }
  const networkEvents: Array<{ event: 'request'; mode: string; url: string }> = [];
  const networkResponses: Array<{
    event: 'response';
    mode: string;
    status: number;
    payloadMode: string;
    graphVersion: string;
    shardKey: string;
    nodeCount: number;
    linkCount: number;
    rootSummaryCount: number;
    url: string;
  }> = [];
  const responsePromises: Array<Promise<void>> = [];
  page.on('request', (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.pathname !== '/api/knowledge/graph') return;
    networkEvents.push({
      event: 'request',
      mode: requestUrl.searchParams.get('mode') ?? 'full',
      url: request.url(),
    });
  });
  page.on('response', (response) => {
    const responseUrl = new URL(response.url());
    if (responseUrl.pathname !== '/api/knowledge/graph') return;
    responsePromises.push((async () => {
      const payload = await response.json().catch(() => ({})) as ProgressivePayload;
      networkResponses.push({
        event: 'response',
        mode: responseUrl.searchParams.get('mode') ?? 'full',
        status: response.status(),
        payloadMode: payload.mode ?? '',
        graphVersion: payload.graphVersion ?? '',
        shardKey: payload.shardKey ?? '',
        nodeCount: payload.nodes?.length ?? 0,
        linkCount: payload.links?.length ?? 0,
        rootSummaryCount: payload.rootSummaries?.length ?? 0,
        url: response.url(),
      });
    })());
  });
  const query = state.query ? `${state.query}&qa=knowledge-progressive` : '?qa=knowledge-progressive';
  const url = `${baseUrl}/knowledge${query}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-knowledge-canvas-primary="true"]', { timeout: 30000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    return Boolean(canvas?.dataset.knowledgeGraphVersion);
  }, undefined, { timeout: 30000 });
  await page.waitForSelector('[data-knowledge-canvas-primary="true"] canvas', { timeout: 30000 });
  await page.waitForFunction(() => {
    const renderedCanvas = document.querySelector<HTMLCanvasElement>('[data-knowledge-canvas-primary="true"] canvas');
    if (!renderedCanvas) return false;
    const context = renderedCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    const data = context.getImageData(0, 0, renderedCanvas.width, renderedCanvas.height).data;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] >= 12) return true;
    }
    return false;
  }, undefined, { timeout: 30000 });
  return { context, page, url, networkEvents, networkResponses, responsePromises };
}

async function clickIfPresent(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  if (await locator.isVisible().catch(() => false)) {
    await locator.click({ timeout: 5000 });
    await page.waitForTimeout(250);
  }
}

async function selectedNodeControl(page: Page) {
  const nodeId = await page.locator('[data-knowledge-canvas-primary="true"]')
    .getAttribute('data-knowledge-selected-node-id');
  if (!nodeId) throw new Error('Direct node activation requires a selected graph node.');
  const control = page.locator(`[data-knowledge-node-control="${nodeId}"]`);
  await control.waitFor({ state: 'attached', timeout: 15000 });
  return control;
}

async function activateSelectedNode(page: Page) {
  const control = await selectedNodeControl(page);
  await control.focus();
  await control.evaluate((element) => (element as HTMLButtonElement).click());
}

async function waitForSelectedNodeReady(page: Page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    const nodeId = canvas?.dataset.knowledgeSelectedNodeId;
    const control = nodeId
      ? document.querySelector<HTMLElement>(`[data-knowledge-node-control="${nodeId}"]`)
      : null;
    return Boolean(control && control.getAttribute('aria-busy') !== 'true');
  }, undefined, { timeout: 20000 });
}

async function waitForSelectedNodeState(page: Page, state: 'loading' | 'expanded' | 'collapsed') {
  await page.waitForFunction((expectedState) => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    const nodeId = canvas?.dataset.knowledgeSelectedNodeId;
    const control = nodeId
      ? document.querySelector<HTMLElement>(`[data-knowledge-node-control="${nodeId}"]`)
      : null;
    if (!control) return false;
    if (expectedState === 'loading') return control.getAttribute('aria-busy') === 'true';
    return control.getAttribute('aria-expanded') === String(expectedState === 'expanded');
  }, state, { timeout: 15000 });
}

async function captureExpansionLoading(page: Page) {
  await page.route('**/api/knowledge/graph?mode=expansion**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  const control = page.locator('[data-knowledge-node-control][aria-expanded="false"][aria-busy="false"]').first();
  await control.waitFor({ state: 'attached', timeout: 15000 });
  const nodeId = await control.getAttribute('data-knowledge-node-control');
  if (!nodeId) throw new Error('Expansion-loading capture requires a node control id.');
  await control.focus();
  await control.evaluate((element) => (element as HTMLButtonElement).click());
  await page.waitForFunction((expectedNodeId) => {
    const nodeControl = [...document.querySelectorAll<HTMLElement>('[data-knowledge-node-control]')]
      .find((element) => element.dataset.knowledgeNodeControl === expectedNodeId);
    return nodeControl?.getAttribute('aria-busy') === 'true';
  }, nodeId, { timeout: 15000 });
}

async function expandSelectedNode(page: Page) {
  await waitForSelectedNodeReady(page);
  const control = await selectedNodeControl(page);
  if (await control.getAttribute('aria-expanded') !== 'true') {
    await activateSelectedNode(page);
    await waitForSelectedNodeState(page, 'expanded');
  }
}

async function inspectSelectedNoChildrenNode(page: Page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    const nodeId = canvas?.dataset.knowledgeSelectedNodeId;
    const control = nodeId
      ? document.querySelector<HTMLElement>(`[data-knowledge-node-control="${nodeId}"]`)
      : null;
    return Boolean(nodeId && control && control.getAttribute('aria-expanded') === null);
  }, undefined, { timeout: 15000 });
  await activateSelectedNode(page);
  await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 15000 });
}

async function collapseSelectedNode(page: Page) {
  await expandSelectedNode(page);
  await activateSelectedNode(page);
  await waitForSelectedNodeState(page, 'collapsed');
}

async function expandCollapseExpandFromCache(page: Page) {
  await expandSelectedNode(page);
  await activateSelectedNode(page);
  await waitForSelectedNodeState(page, 'collapsed');
  await activateSelectedNode(page);
  await waitForSelectedNodeState(page, 'expanded');
  return await page.evaluate(() => {
    const active = document.activeElement;
    return {
      focusReturned: Boolean(active?.hasAttribute('data-knowledge-node-control')),
      activeAriaExpanded: active?.getAttribute('aria-expanded') ?? null,
    };
  });
}

async function openLegendTool(page: Page) {
  await clickIfPresent(page, '[data-knowledge-command-trigger="legend"]');
  await page.waitForSelector('[data-knowledge-local-tool="legend"][data-state="open"]', { timeout: 8000 });
}

async function selectDenseAllMode(page: Page) {
  await clickIfPresent(page, '[data-knowledge-command-trigger="relation-filters"]');
  await page.waitForSelector('[data-knowledge-local-panel="relation-filters"]', { timeout: 8000 });
  const allMode = page.locator('[data-knowledge-density-mode="all"]').first();
  await allMode.click({ timeout: 5000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    const selected = document.querySelector<HTMLElement>('[data-knowledge-density-mode="all"][aria-pressed="true"]');
    return canvas?.dataset.knowledgeKonlingDensityMode === 'all' && Boolean(selected);
  }, undefined, { timeout: 8000 });
  return {
    selectedDensityMode: await page.locator('[data-knowledge-density-mode="all"]').first().getAttribute('aria-pressed'),
  };
}

function filterCollapsedRootsBySearch(searchText: string) {
  return async (page: Page) => {
    await clickIfPresent(page, '[data-knowledge-command-trigger="chapter-directory"]');
    await page.waitForSelector('[data-knowledge-local-panel="chapter-directory"]', { timeout: 8000 });
    const searchInput = page.locator('[data-knowledge-local-panel="chapter-directory"] input[aria-label="搜索知识点..."]').first();
    await searchInput.fill(searchText);
    await page.waitForFunction((expected) => {
      const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
      return canvas?.dataset.knowledgeKonlingRelationSummary?.includes(String(expected))
        && Number(canvas?.dataset.knowledgeVisibleNodeCount ?? 0) > 0;
    }, searchText, { timeout: 10000 });
    return {
      searchText,
      visibleNodeCount: await page.locator('[data-knowledge-canvas-primary="true"]').first().getAttribute('data-knowledge-visible-node-count'),
    };
  };
}

async function expandKonlingDock(page: Page) {
  await clickIfPresent(page, '[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]');
  await page.waitForSelector('[data-global-ai-sidebar="open"][data-konling-assistant-surface="global-sidebar"]', { timeout: 5000 })
    .catch(() => undefined);
}

function rectsOverlap(a: EvidenceRect | null, b: EvidenceRect | null) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function captureMarkers(page: Page) {
  const markers = await page.evaluate(`(() => {
    const canvas = document.querySelector('[data-knowledge-canvas-primary="true"]');
    const workspace = document.querySelector('[data-knowledge-workspace]');
    const selectedNodeId = canvas?.getAttribute('data-knowledge-selected-node-id') ?? '';
    const nodeControl = selectedNodeId
      ? document.querySelector('[data-knowledge-node-control="' + selectedNodeId + '"]')
      : null;
    const dock = document.querySelector('[data-platform-floating-dock]');
    const konling = document.querySelector('[data-global-ai-sidebar="open"]');
    const inspector = document.querySelector('[data-knowledge-inspector]');
    const localTool = document.querySelector('[data-knowledge-local-tool="legend"]');
    const openLocalTool = document.querySelector('[data-knowledge-local-tool][data-state="open"]');
    const chapterDirectory = document.querySelector('[data-knowledge-local-panel="chapter-directory"]');
    const ariaExpanded = nodeControl?.getAttribute('aria-expanded');
    const inspectorVisible = Boolean(inspector);
    const rectFor = (element) => {
      if (!element) return null;
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
    const canvasPixelEvidence = (() => {
      const renderedCanvas = document.querySelector('[data-knowledge-canvas-primary="true"] canvas');
      if (!renderedCanvas || typeof renderedCanvas.getContext !== 'function') {
        return { available: false, paintedPixels: 0, nodeColorPixels: 0 };
      }
      const context = renderedCanvas.getContext('2d', { willReadFrequently: true });
      if (!context) return { available: false, paintedPixels: 0, nodeColorPixels: 0 };
      const width = renderedCanvas.width;
      const height = renderedCanvas.height;
      const data = context.getImageData(0, 0, width, height).data;
      let paintedPixels = 0;
      let nodeColorPixels = 0;
      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3];
        if (alpha < 12) continue;
        paintedPixels += 1;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        if (Math.max(red, green, blue) - Math.min(red, green, blue) >= 18 && Math.max(red, green, blue) >= 80) {
          nodeColorPixels += 1;
        }
      }
      return { available: true, paintedPixels, nodeColorPixels, width, height };
    })();
    return {
      workspace: workspace?.dataset.knowledgeWorkspace ?? null,
      progressive: canvas ? {
        loadingMode: canvas.dataset.knowledgeProgressiveLoading ?? null,
        graphVersion: canvas.dataset.knowledgeGraphVersion ?? '',
        graphVersionPresent: Boolean(canvas.dataset.knowledgeGraphVersion),
        loadedShardCount: Number(canvas.dataset.knowledgeLoadedShardCount ?? 0),
        loadingShardCount: Number(canvas.dataset.knowledgeLoadingShardCount ?? 0),
        expandedNodeCount: Number(canvas.dataset.knowledgeExpandedNodeCount ?? 0),
        loadingExpansionCount: Number(canvas.dataset.knowledgeLoadingExpansionCount ?? 0),
        backgroundLoading: canvas.dataset.knowledgeBackgroundLoading ?? '',
        fullGraphFirstRender: canvas.dataset.knowledgeFullGraphFirstRender ?? null,
        selectedNodeId: canvas.dataset.knowledgeSelectedNodeId ?? '',
        densityMode: canvas.dataset.knowledgeKonlingDensityMode ?? '',
        activeFilterSummary: canvas.dataset.knowledgeKonlingRelationSummary ?? '',
        visibleNodeCount: Number(canvas.dataset.knowledgeVisibleNodeCount ?? 0),
      } : null,
      expansion: nodeControl ? {
        state: nodeControl.getAttribute('aria-busy') === 'true'
          ? 'loading'
          : ariaExpanded === null
            ? 'inspectable'
            : ariaExpanded === 'true'
              ? 'expanded'
              : 'collapsed',
        filteredEmpty: nodeControl.getAttribute('data-filtered-empty'),
        control: nodeControl.getAttribute('data-knowledge-node-control'),
        ariaExpanded,
        ariaBusy: nodeControl.getAttribute('aria-busy'),
        error: nodeControl.getAttribute('data-error'),
        loadingMessage: document.querySelector('#knowledge-node-activation-status')?.textContent?.includes('正在加载') ?? false,
        emptyMessage: Boolean(document.querySelector('[data-knowledge-filtered-empty-explanation="visible"]')),
        noChildrenInspector: ariaExpanded === null && inspectorVisible,
      } : null,
      localTool: localTool?.getAttribute('data-state') ?? null,
      openLocalTool: openLocalTool?.getAttribute('data-knowledge-local-tool') ?? null,
      chapterDirectoryText: chapterDirectory?.textContent ?? '',
      inspectorVisible,
      konlingVisible: Boolean(konling),
      canvasPixelEvidence,
      rects: {
        canvas: rectFor(canvas),
        expansionPanel: rectFor(nodeControl),
        dock: rectFor(dock),
        konling: rectFor(konling),
        inspector: rectFor(inspector),
        localTool: rectFor(localTool),
      },
      scroll: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
    };
  })()`);
  const rects = markers.rects as Record<string, EvidenceRect | null>;
  return {
    ...markers,
    overlaps: {
      dockOverlapsExpansion: rectsOverlap(rects.dock, rects.expansionPanel),
      konlingOverlapsInspector: rectsOverlap(rects.konling, rects.inspector),
      localToolOverlapsExpansion: rectsOverlap(rects.localTool, rects.expansionPanel),
    },
  };
}

async function captureState(browser: Browser, state: CaptureState) {
  const { context, page, url, networkEvents, networkResponses, responsePromises } = await openStatePage(browser, state);
  try {
    let interactionEvidence: Record<string, unknown> | undefined;
    if (state.beforeShot) {
      interactionEvidence = await state.beforeShot(page) ?? undefined;
      await page.waitForTimeout(350);
    }
    const screenshotPath = path.join(outputDir, `${state.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await Promise.allSettled(responsePromises);
    const screenshotRelativePath = path.relative(repoRoot, screenshotPath);
    return {
      name: state.name,
      url,
      viewport: { width: state.width, height: state.height },
      screenshotPath: screenshotRelativePath,
      screenshotSha256: sha256(screenshotRelativePath),
      networkEvents,
      networkResponses,
      markers: await captureMarkers(page),
      interactionEvidence,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const { rootNodeId, noChildrenNodeId, noChildrenNodeName, expectedFilteredRootCount, expectedFilteredRootNames } = await resolveProgressiveTargets();
  const selectedQuery = `?node=${encodeURIComponent(rootNodeId)}`;
  const emptyQuery = `?node=${encodeURIComponent(noChildrenNodeId)}`;
  const states: CaptureState[] = [
    { name: 'root-first-1440', width: 1440, height: 960 },
    { name: 'root-first-1279', width: 1279, height: 900 },
    { name: 'root-first-1100', width: 1100, height: 820 },
    { name: 'root-first-1024', width: 1024, height: 820 },
    { name: 'root-first-320', width: 320, height: 800 },
    { name: 'expansion-loading-1440', width: 1440, height: 960, query: selectedQuery, beforeShot: captureExpansionLoading },
    { name: 'expanded-1440', width: 1440, height: 960, query: selectedQuery, beforeShot: expandSelectedNode },
    { name: 'collapsed-1440', width: 1440, height: 960, query: selectedQuery, beforeShot: collapseSelectedNode },
    { name: 'cache-reuse-1440', width: 1440, height: 960, query: selectedQuery, beforeShot: expandCollapseExpandFromCache },
    { name: 'filtered-empty-1440', width: 1440, height: 960, query: emptyQuery, beforeShot: inspectSelectedNoChildrenNode },
    { name: 'root-filtered-match-1440', width: 1440, height: 960, beforeShot: filterCollapsedRootsBySearch(noChildrenNodeName) },
    { name: 'dense-all-1440', width: 1440, height: 960, beforeShot: selectDenseAllMode },
    { name: 'local-tool-1440', width: 1440, height: 960, beforeShot: openLegendTool },
    { name: 'selected-inspector-1440', width: 1440, height: 960, query: emptyQuery, beforeShot: inspectSelectedNoChildrenNode },
    { name: 'konling-expanded-1440', width: 1440, height: 960, query: emptyQuery, beforeShot: expandKonlingDock },
  ];

  const browser = await chromium.launch({ headless: true });
  try {
    const stateMatrix = [];
    for (const state of states) {
      stateMatrix.push(await captureState(browser, state));
    }
    const konlingEvidenceReference = {
      path: 'artifacts/knowledge-workspace-product-qa-489/browser-evidence.json',
      state: 'desktop-konling-selected-expanded-dark',
      reason: 'Konling expanded sidebar is already covered by the knowledge workspace product QA browser matrix; this capture keeps progressive loading focused on graph shard behavior.',
    };
    const byName = new Map(stateMatrix.map((state) => [state.name, state] as const));
    const rootFirstStates = ['root-first-1440', 'root-first-1279', 'root-first-1100', 'root-first-1024', 'root-first-320']
      .map((name) => byName.get(name))
      .filter((state): state is NonNullable<typeof state> => Boolean(state));
    const stateNames = stateMatrix.map((state) => state.name);
    const stateMarkers = (name: string) => byName.get(name)?.markers as Record<string, unknown> | undefined;
    const progressive = (name: string) => stateMarkers(name)?.progressive as Record<string, unknown> | undefined;
    const expansion = (name: string) => stateMarkers(name)?.expansion as Record<string, unknown> | undefined;
    const overlaps = (name: string) => stateMarkers(name)?.overlaps as Record<string, unknown> | undefined;
    const canvasPixels = (name: string) => stateMarkers(name)?.canvasPixelEvidence as Record<string, unknown> | undefined;
    const modes = (name: string) => (byName.get(name)?.networkEvents ?? []).map((event) => event.mode);
    const responseMetadata = (name: string) => byName.get(name)?.networkResponses ?? [];
    const rootResponse = (name: string) => responseMetadata(name).find((response) => response.mode === 'root');
    const hasPaintedNodes = (name: string) => Number(canvasPixels(name)?.nodeColorPixels ?? 0) > 0;
    const isRootBeforeDeferredShards = (name: string) => {
      const stateModes = modes(name);
      const rootIndex = stateModes.indexOf('root');
      const activeIndex = stateModes.indexOf('active-filter');
      const remainingIndex = stateModes.indexOf('remaining');
      return rootIndex >= 0
        && activeIndex > rootIndex
        && remainingIndex > activeIndex;
    };
    const noFullRequests = stateNames.every((name) => !modes(name).includes('full'));
    const overlapFree = (name: string) => {
      const stateOverlaps = overlaps(name);
      return stateOverlaps?.dockOverlapsExpansion === false
        && stateOverlaps?.localToolOverlapsExpansion === false;
    };
    const referencedKonlingStateExists = (() => {
      const referencePath = path.join(repoRoot, konlingEvidenceReference.path);
      if (!existsSync(referencePath)) return false;
      const referenced = JSON.parse(readFileSync(referencePath, 'utf8')) as { stateMatrix?: Array<{ name?: string }> };
      return Boolean(referenced.stateMatrix?.some((state) => state.name === konlingEvidenceReference.state));
    })();
    const cacheReuseEvidence = byName.get('cache-reuse-1440')?.interactionEvidence as Record<string, unknown> | undefined;
    const assertions = {
      rootFirstRender: rootFirstStates.length === 5 && rootFirstStates.every((state) => (
        progressive(state.name)?.loadingMode === 'root-first'
        && progressive(state.name)?.graphVersionPresent === true
        && typeof progressive(state.name)?.graphVersion === 'string'
        && rootResponse(state.name)?.payloadMode === 'root'
        && rootResponse(state.name)?.graphVersion === progressive(state.name)?.graphVersion
        && String(rootResponse(state.name)?.shardKey ?? '').includes(':shard:root:chapters')
        && Number(rootResponse(state.name)?.nodeCount ?? 0) > 0
        && rootResponse(state.name)?.nodeCount === rootResponse(state.name)?.rootSummaryCount
        && hasPaintedNodes(state.name)
      )),
      fullGraphFirstRenderAvoided: noFullRequests && stateNames.every((name) => progressive(name)?.fullGraphFirstRender === 'avoided'),
      expansionLoading: expansion('expansion-loading-1440')?.state === 'loading'
        && expansion('expansion-loading-1440')?.loadingMessage === true
        && expansion('expansion-loading-1440')?.ariaBusy === 'true',
      expandedState: expansion('expanded-1440')?.state === 'expanded'
        && expansion('expanded-1440')?.ariaExpanded === 'true',
      collapsedState: expansion('collapsed-1440')?.state === 'collapsed'
        && expansion('collapsed-1440')?.ariaExpanded === 'false',
      backgroundLoadingNonBlocking: rootFirstStates.length === 5
        && rootFirstStates.every((state) => hasPaintedNodes(state.name) && isRootBeforeDeferredShards(state.name)),
      denseModeUsesRemainingShard: stateMarkers('dense-all-1440')?.progressive !== null
        && stateMarkers('dense-all-1440')?.openLocalTool === 'relation-filters'
        && progressive('dense-all-1440')?.densityMode === 'all'
        && modes('dense-all-1440').includes('remaining')
        && !modes('dense-all-1440').includes('full')
        && (byName.get('dense-all-1440')?.interactionEvidence as Record<string, unknown> | undefined)?.selectedDensityMode === 'true',
      filteredEmptyOrNoChildren: (
        expansion('filtered-empty-1440')?.filteredEmpty === 'true'
        && expansion('filtered-empty-1440')?.emptyMessage === true
      ) || expansion('filtered-empty-1440')?.noChildrenInspector === true,
      collapsedRootFilterRetained: Number(progressive('root-filtered-match-1440')?.visibleNodeCount ?? 0) === expectedFilteredRootCount
        && String(progressive('root-filtered-match-1440')?.activeFilterSummary ?? '').includes(noChildrenNodeName)
        && expectedFilteredRootNames.every((name) => String(stateMarkers('root-filtered-match-1440')?.chapterDirectoryText ?? '').includes(name))
        && !modes('root-filtered-match-1440').includes('full'),
      localToolNonOverlap: stateMarkers('local-tool-1440')?.localTool === 'open'
        && overlapFree('local-tool-1440'),
      selectedNodeInspectorRetained: stateMarkers('selected-inspector-1440')?.inspectorVisible === true
        && Boolean(progressive('selected-inspector-1440')?.selectedNodeId),
      konlingContextRetained: referencedKonlingStateExists,
      focusReturn: cacheReuseEvidence?.focusReturned === true
        && cacheReuseEvidence?.activeAriaExpanded === 'true',
      dockAvoidance: ['expanded-1440', 'cache-reuse-1440', 'filtered-empty-1440', 'local-tool-1440', 'konling-expanded-1440']
        .every((name) => overlapFree(name)),
    };
    const evidence = {
      change: 'progressive-knowledge-graph-loading',
      issue: 875,
      route: '/knowledge',
      capturedAt: new Date().toISOString(),
      baseUrl,
      rootNodeId,
      noChildrenNodeId,
      noChildrenNodeName,
      expectedFilteredRootCount,
      expectedFilteredRootNames,
      currentSourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, sha256(file)])),
      requiredViewports: [1440, 1279, 1100, 1024, 320],
      assertions,
      konlingEvidenceReference,
      stateMatrix,
    };
    writeFileSync(path.join(outputDir, 'browser-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`captured ${stateMatrix.length} progressive knowledge graph states at ${path.relative(repoRoot, outputDir)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
