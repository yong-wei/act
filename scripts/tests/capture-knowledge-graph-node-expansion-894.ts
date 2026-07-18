import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium, type Page, type Route } from 'playwright';
import { PNG } from 'pngjs';

const repoRoot = process.cwd();
const baseUrl = process.env.ISSUE_894_BASE_URL ?? 'http://localhost:3101';
const outputDir = path.join(repoRoot, 'artifacts/knowledge-graph-node-expansion-894');
const graphVersion = 'knowledge-direct-activation-browser-v1';

const parentNode = {
  id: 'chapter-node:第一章', name: '第一章', nodeType: 'THEORY', description: '可展开章节节点',
  positionX: 0, positionY: 0, positionZ: 0, chapter: 1, chapterName: '第一章',
  metadata: { isVirtualChapter: true, chapterName: '第一章' },
  expansion: { state: 'expandable' as const, revealableNeighborCount: 1 },
};
const leafNode = {
  id: 'issue-894-leaf', name: '直接叶节点', nodeType: 'THEORY', description: '直接打开检查器的叶节点',
  positionX: 120, positionY: 80, positionZ: 0, chapter: 1, chapterName: '第一章',
  metadata: { chapterName: '第一章' }, expansion: { state: 'leaf' as const },
};
const link = {
  id: 'issue-894-contains', sourceId: parentNode.id, targetId: leafNode.id,
  relation: 'contains', relationType: 'contains', strength: 1,
};

function sha256(relativePath: string) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

async function installFixtureRoutes(page: Page) {
  const requestCounts = { leafDetail: 0 };
  await page.route(`**/api/knowledge/nodes/${leafNode.id}`, async (route: Route) => {
    requestCounts.leafDetail += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...leafNode,
        resources: [{ path: 'course-content/runtime/knowledge/cards/nodes/issue-894-leaf.md' }],
        relatedNodes: [{
          id: parentNode.id, name: parentNode.name, nodeType: parentNode.nodeType,
          relation: 'contains', category: 'related',
        }],
      }),
    });
  });
  await page.route('**/api/knowledge/graph?*', async (route: Route) => {
    const url = new URL(route.request().url());
    const mode = url.searchParams.get('mode');
    const nodeId = url.searchParams.get('nodeId');
    const expansion = mode === 'expansion' && nodeId === parentNode.id;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode,
        graphVersion,
        shardKey: `${graphVersion}:shard:${expansion ? 'expansion' : mode ?? 'root'}:${nodeId ?? 'fixture'}`,
        nodes: expansion ? [parentNode, leafNode] : [parentNode],
        links: expansion ? [link] : [],
        source: 'file',
      }),
    });
  });
  return requestCounts;
}

function nodeControl(page: Page, nodeId: string) {
  return page.locator(`[data-knowledge-node-control="${nodeId}"]`);
}

function graphPixelEvidence(buffer: Buffer) {
  const png = PNG.sync.read(buffer);
  const left = Math.min(png.width, 96);
  const top = Math.min(png.height, 260);
  const right = Math.max(left, png.width - 24);
  const bottom = Math.max(top, png.height - 100);
  let nodeColorPixels = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (png.width * y + x) * 4;
      const red = png.data[offset] ?? 0;
      const green = png.data[offset + 1] ?? 0;
      const blue = png.data[offset + 2] ?? 0;
      const alpha = png.data[offset + 3] ?? 0;
      const chromatic = Math.max(red, green, blue) - Math.min(red, green, blue) > 30;
      const neutralGraphTone = red < 190 && green < 200 && blue < 215;
      if (alpha > 0 && (chromatic || neutralGraphTone)) {
        nodeColorPixels += 1;
      }
    }
  }
  return { available: true, nodeColorPixels };
}

async function canvasNodePoints(page: Page, nodeId: string) {
  let pointsHandle;
  try {
    pointsHandle = await page.waitForFunction((expectedNodeId) => {
      const qa = (window as Window & {
        __knowledgeGraphQaNodePoints?: (id?: string) => Array<{ x: number; y: number }>;
      }).__knowledgeGraphQaNodePoints;
      const canvas = document.querySelector<HTMLCanvasElement>('[data-knowledge-canvas-primary="true"] canvas');
      const rect = canvas?.getBoundingClientRect();
      if (typeof qa !== 'function' || !rect) return false;
      const points = qa(expectedNodeId).filter((point) => (
        point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
      ));
      return points.length > 0 ? points : false;
    }, nodeId, { timeout: 15_000 });
  } catch (error) {
    const diagnostics = await page.evaluate((expectedNodeId) => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-knowledge-canvas-primary="true"] canvas');
      const rect = canvas?.getBoundingClientRect();
          const qa = (window as Window & {
            __knowledgeGraphQaNodePoints?: (id?: string) => Array<{ x: number; y: number }>;
            __knowledgeGraphQaNodeDebug?: (id?: string) => Array<Record<string, unknown>>;
            __knowledgeGraphQaPresentationDebug?: () => Record<string, unknown>;
          });
      return {
        renderer: document.querySelector<HTMLElement>('[data-knowledge-graph-renderer]')?.dataset.knowledgeGraphRenderer ?? '',
            rect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
            points: qa.__knowledgeGraphQaNodePoints?.(expectedNodeId) ?? [],
            debug: qa.__knowledgeGraphQaNodeDebug?.(expectedNodeId) ?? [],
            presentationDebug: qa.__knowledgeGraphQaPresentationDebug?.() ?? null,
          };
    }, nodeId);
    throw new Error(`Canvas point readiness timed out for ${nodeId}; diagnostics=${JSON.stringify(diagnostics)}; cause=${String(error)}`);
  }
  const points = await pointsHandle.jsonValue() as Array<{ x: number; y: number }>;
  await pointsHandle.dispose();
  return points;
}

async function activateCanvasNode(page: Page, nodeId: string, expectation: 'expanded' | 'inspected') {
  const points = await canvasNodePoints(page, nodeId);
  const diagnostics = await page.evaluate((expectedNodeId) => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-knowledge-canvas-primary="true"] canvas');
    const rect = canvas?.getBoundingClientRect();
    const qa = (window as Window & {
      __knowledgeGraphQaNodePoints?: (id?: string) => Array<{ x: number; y: number }>;
    }).__knowledgeGraphQaNodePoints;
    const points = qa?.(expectedNodeId) ?? [];
    return {
      viewMode: document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]')?.dataset.knowledgeKonlingViewMode ?? '',
      rect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
      canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null,
      points,
      hit: points[0] ? (() => {
        const element = document.elementFromPoint(points[0].x, points[0].y);
        return element ? {
          tag: element.tagName,
          className: element.getAttribute('class') ?? '',
          renderer: element.closest('[data-knowledge-graph-renderer]')?.getAttribute('data-knowledge-graph-renderer') ?? '',
          pointerEvents: getComputedStyle(element).pointerEvents,
        } : null;
      })() : null,
    };
  }, nodeId);
  for (const point of points) {
    await page.mouse.click(point.x, point.y);
    try {
      await page.waitForFunction(({ expectedNodeId, expectedState }) => {
        const control = document.querySelector<HTMLElement>(`[data-knowledge-node-control="${expectedNodeId}"]`);
        const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
        const selected = canvas?.dataset.knowledgeSelectedNodeId === expectedNodeId;
        const expanded = control?.getAttribute('aria-expanded') === 'true';
        const inspector = Boolean(document.querySelector('[data-knowledge-inspector="floating-right-edge"]'));
        return expectedState === 'expanded' ? expanded && !inspector : selected && inspector;
      }, { expectedNodeId: nodeId, expectedState: expectation }, { timeout: 2_000 });
      if (expectation === 'inspected') {
        await page.waitForFunction(() => (
          ['header', 'semantic-metadata', 'summary', 'evidence-sources', 'learning-actions']
            .every((section) => Boolean(document.querySelector(`[data-knowledge-inspector-section="${section}"]`)))
        ), undefined, { timeout: 8_000 });
      }
      return point;
    } catch {
      // Try the next candidate if the graph's local coordinate origin differs from the canvas box.
    }
  }
  const debug = await page.evaluate((expectedNodeId) => (
    (window as Window & {
      __knowledgeGraphQaNodeDebug?: (id?: string) => Array<Record<string, unknown>>;
    }).__knowledgeGraphQaNodeDebug?.(expectedNodeId) ?? []
  ), nodeId);
  throw new Error(`Real canvas activation failed for ${nodeId} (${expectation}); points=${JSON.stringify(points)}; diagnostics=${JSON.stringify(diagnostics)}; debug=${JSON.stringify(debug)}.`);
}

async function fitGraphToViewport(page: Page) {
  const controls = page.locator('[data-knowledge-layout-control="fit-view"]');
  for (let index = 0; index < await controls.count(); index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible().catch(() => false))) continue;
    await control.click();
    await page.waitForTimeout(350);
    return;
  }
}

async function resetGraphViewport(page: Page) {
  await page.evaluate(() => {
    (window as Window & { __knowledgeGraphQaResetViewport?: () => void }).__knowledgeGraphQaResetViewport?.();
  });
  await page.waitForTimeout(180);
}

async function centerGraphNode(page: Page, nodeId: string) {
  await page.evaluate((expectedNodeId) => {
    (window as Window & { __knowledgeGraphQaCenterNode?: (id: string) => void }).__knowledgeGraphQaCenterNode?.(expectedNodeId);
  }, nodeId);
  await page.waitForTimeout(180);
}

async function fitGraphAfterExpansion(page: Page) {
  const trigger = page.locator('[data-knowledge-command-trigger="view-layout"]');
  const panel = page.locator('[data-knowledge-desktop-tool-panel="view-layout"]');
  if (!(await panel.isVisible().catch(() => false))) {
    await trigger.click();
  }
  await panel.waitFor({ state: 'visible', timeout: 8_000 });
  await fitGraphToViewport(page);
  if (await panel.isVisible().catch(() => false)) await trigger.click();
  await page.waitForTimeout(350);
}

async function readState(page: Page) {
  return await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    const viewMode = canvas?.dataset.knowledgeKonlingViewMode ?? '2D';
    const rendererCandidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-knowledge-graph-renderer="${viewMode}"]`));
    const renderer = rendererCandidates.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) ?? rendererCandidates[0];
    const selectedNodeId = canvas?.dataset.knowledgeSelectedNodeId ?? '';
    const control = selectedNodeId
      ? document.querySelector<HTMLElement>('[data-knowledge-node-control="' + selectedNodeId + '"]')
      : null;
    const inspector = document.querySelector<HTMLElement>('[data-knowledge-inspector="floating-right-edge"]');
    return {
      selectedNodeId,
      expandedNodeCount: canvas?.dataset.knowledgeExpandedNodeCount ?? '',
      visibleNodeCount: canvas?.dataset.knowledgeVisibleNodeCount ?? '',
      visibleLinkCount: canvas?.dataset.knowledgeVisibleLinkCount ?? '',
      viewMode,
      presentation: {
        phase: renderer?.dataset.knowledgeGraphPresentationPhase ?? '',
        elapsedMs: Number(renderer?.dataset.knowledgeGraphPresentationElapsedMs ?? 0),
        animatedNodeCount: Number(renderer?.dataset.knowledgeGraphAnimatedNodeCount ?? 0),
        animatedRelationCount: Number(renderer?.dataset.knowledgeGraphAnimatedRelationCount ?? 0),
      },
      rendererStates: rendererCandidates.map((candidate) => ({
        renderer: candidate.dataset.knowledgeGraphRenderer ?? '',
        phase: candidate.dataset.knowledgeGraphPresentationPhase ?? '',
        width: candidate.getBoundingClientRect().width,
        height: candidate.getBoundingClientRect().height,
      })),
      directControl: control ? {
        nodeId: control.dataset.knowledgeNodeControl ?? '',
        expanded: control.getAttribute('aria-expanded'),
        busy: control.getAttribute('aria-busy'),
        error: control.getAttribute('data-error'),
        filteredEmpty: control.getAttribute('data-filtered-empty'),
      } : null,
      inspectorVisible: Boolean(inspector),
      inspectorSections: Array.from(inspector?.querySelectorAll('[data-knowledge-inspector-section]') ?? [])
        .map((element) => element.getAttribute('data-knowledge-inspector-section')),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  });
}

async function waitForPresentationReveal(page: Page, mode: '2D' | '3D') {
  return await page.evaluate((expectedMode) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const renderer = document.querySelector<HTMLElement>(`[data-knowledge-graph-renderer="${expectedMode}"]`);
    let timeout = 0;
    let observer: MutationObserver | null = null;
    timeout = window.setTimeout(() => {
      observer?.disconnect();
      reject(new Error(`Presentation reveal marker timed out for ${expectedMode}.`));
    }, 8_000);
    if (renderer?.dataset.knowledgeGraphPresentationPhase === 'revealing') {
      window.clearTimeout(timeout);
      resolve({
        phase: renderer.dataset.knowledgeGraphPresentationPhase,
        elapsedMs: Number(renderer.dataset.knowledgeGraphPresentationElapsedMs ?? 0),
        animatedNodeCount: Number(renderer.dataset.knowledgeGraphAnimatedNodeCount ?? 0),
        animatedRelationCount: Number(renderer.dataset.knowledgeGraphAnimatedRelationCount ?? 0),
      });
      return;
    }
    observer = renderer ? new MutationObserver(() => {
      if (renderer.dataset.knowledgeGraphPresentationPhase !== 'revealing') return;
      observer?.disconnect();
      window.clearTimeout(timeout);
      resolve({
        phase: renderer.dataset.knowledgeGraphPresentationPhase,
        elapsedMs: Number(renderer.dataset.knowledgeGraphPresentationElapsedMs ?? 0),
        animatedNodeCount: Number(renderer.dataset.knowledgeGraphAnimatedNodeCount ?? 0),
        animatedRelationCount: Number(renderer.dataset.knowledgeGraphAnimatedRelationCount ?? 0),
      });
    }) : null;
    observer?.observe(renderer!, { attributes: true, attributeFilter: [
      'data-knowledge-graph-presentation-phase',
      'data-knowledge-graph-presentation-elapsed-ms',
      'data-knowledge-graph-animated-node-count',
      'data-knowledge-graph-animated-relation-count',
    ] });
  }), mode);
}

async function capture(mode: '2D' | '3D', reducedMotion: boolean) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await context.addInitScript(({ reduced }) => {
    window.matchMedia = ((query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
    })) as typeof window.matchMedia;
  }, { reduced: reducedMotion });
  const page = await context.newPage();
  try {
    const requestCounts = await installFixtureRoutes(page);
    await page.goto(`${baseUrl}/knowledge?qa=issue-894-direct-activation`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-knowledge-canvas-primary="true"]', { timeout: 30_000 });
    await nodeControl(page, parentNode.id).waitFor({ state: 'attached', timeout: 30_000 });
    if (mode === '3D') {
      const viewLayoutTrigger = page.locator('[data-knowledge-command-trigger="view-layout"]');
      const viewLayoutPanel = page.locator('[data-knowledge-desktop-tool-panel="view-layout"]');
      await viewLayoutTrigger.click();
      await viewLayoutPanel.getByRole('button', { name: '3D 视图' }).click();
      await page.locator('[data-knowledge-graph-renderer="3D"] canvas').waitFor({ state: 'attached', timeout: 15_000 });
      if (await viewLayoutPanel.isVisible().catch(() => false)) {
        await viewLayoutTrigger.click();
        await viewLayoutPanel.waitFor({ state: 'hidden', timeout: 8_000 });
      }
      await page.waitForTimeout(750);
    } else {
      await page.locator('[data-knowledge-graph-renderer="2D"] canvas').waitFor({ state: 'attached', timeout: 15_000 });
    }
    await page.evaluate((expectedMode) => {
      const renderer = document.querySelector<HTMLElement>(`[data-knowledge-graph-renderer="${expectedMode}"]`);
      const history: Array<Record<string, unknown>> = [];
      history.push({
        at: performance.now(),
        phase: renderer?.dataset.knowledgeGraphPresentationPhase ?? '',
        elapsedMs: Number(renderer?.dataset.knowledgeGraphPresentationElapsedMs ?? 0),
        animatedNodeCount: Number(renderer?.dataset.knowledgeGraphAnimatedNodeCount ?? 0),
        animatedRelationCount: Number(renderer?.dataset.knowledgeGraphAnimatedRelationCount ?? 0),
      });
      const observer = renderer ? new MutationObserver(() => history.push({
        at: performance.now(),
        phase: renderer.dataset.knowledgeGraphPresentationPhase ?? '',
        elapsedMs: Number(renderer.dataset.knowledgeGraphPresentationElapsedMs ?? 0),
        animatedNodeCount: Number(renderer.dataset.knowledgeGraphAnimatedNodeCount ?? 0),
        animatedRelationCount: Number(renderer.dataset.knowledgeGraphAnimatedRelationCount ?? 0),
      })) : null;
      observer?.observe(renderer!, { attributes: true, attributeFilter: [
        'data-knowledge-graph-presentation-phase',
        'data-knowledge-graph-presentation-elapsed-ms',
        'data-knowledge-graph-animated-node-count',
        'data-knowledge-graph-animated-relation-count',
      ] });
      (window as Window & {
        __knowledgeGraphQaPresentationHistory?: Array<Record<string, unknown>>;
        __knowledgeGraphQaPresentationObserver?: MutationObserver | null;
      }).__knowledgeGraphQaPresentationHistory = history;
      (window as Window & {
        __knowledgeGraphQaPresentationObserver?: MutationObserver | null;
      }).__knowledgeGraphQaPresentationObserver = observer;
    }, mode);
    await resetGraphViewport(page);
    await centerGraphNode(page, parentNode.id);
    const parentCanvasPoint = await activateCanvasNode(page, parentNode.id, 'expanded');
    const transitionScreenshotPath = path.join(outputDir, `${mode.toLowerCase()}-${reducedMotion ? 'reduced' : 'motion'}-transition.png`);
    const transitionPresentation = reducedMotion
      ? (await readState(page)).presentation
      : await waitForPresentationReveal(page, mode);
    const presentationHistory = await page.evaluate(() => {
      const pageWindow = window as Window & {
        __knowledgeGraphQaPresentationHistory?: Array<Record<string, unknown>>;
        __knowledgeGraphQaPresentationObserver?: MutationObserver | null;
      };
      pageWindow.__knowledgeGraphQaPresentationObserver?.disconnect();
      return pageWindow.__knowledgeGraphQaPresentationHistory ?? [];
    });
    const transitionBuffer = await page.screenshot({ path: transitionScreenshotPath });
    const expanded = await readState(page);
    await page.waitForTimeout(reducedMotion ? 80 : 420);
    await fitGraphAfterExpansion(page);
    const leafCanvasPoint = await activateCanvasNode(page, leafNode.id, 'inspected');
    const inspected = await readState(page);
    const requestsBeforeRepeatLeafClick = requestCounts.leafDetail;
    const repeatedLeafCanvasPoint = await activateCanvasNode(page, leafNode.id, 'inspected');
    const leafClickStable = requestCounts.leafDetail === requestsBeforeRepeatLeafClick;
    const canvas = page.locator('[data-knowledge-canvas-primary="true"] canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas dismissal capture requires a visible graph canvas.');
    await page.mouse.move(canvasBox.x + 4, canvasBox.y + 4);
    await page.mouse.down();
    await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { state: 'hidden', timeout: 15_000 });
    const dismissal = { trigger: 'canvas-blank-pointerdown', inspectorClosed: true };
    await page.mouse.up();
    const dismissed = await readState(page);
    const name = `${mode.toLowerCase()}-${reducedMotion ? 'reduced' : 'motion'}`;
    const screenshotPath = path.join(outputDir, `${name}.png`);
    const screenshotBuffer = await page.screenshot({ path: screenshotPath });
    return {
      name,
      screenshotPath: path.relative(repoRoot, screenshotPath),
      transitionScreenshotPath: path.relative(repoRoot, transitionScreenshotPath),
      transitionPresentation,
      presentationHistory,
      transitionPixelEvidence: graphPixelEvidence(transitionBuffer),
      canvasPixelEvidence: graphPixelEvidence(screenshotBuffer),
      expanded,
      inspected,
      realCanvas: {
        parentCanvasPoint,
        leafCanvasPoint,
        repeatedLeafCanvasPoint,
        leafClickStable,
        leafDetailRequests: requestCounts.leafDetail,
      },
      dismissal,
      dismissed,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const states = [
    await capture('2D', false),
    await capture('3D', false),
    await capture('2D', true),
  ];
  const sourceFiles = [
    'src/features/knowledge/knowledge-graph-system.tsx',
    'src/features/knowledge/resource-panel/resource-panel.tsx',
    'src/features/knowledge/graph/knowledge-graph-2d.tsx',
    'src/features/knowledge/graph/knowledge-graph-canvas.tsx',
    'src/features/knowledge/graph/motion.ts',
    'src/features/knowledge/graph/camera-transition.ts',
    'src/features/knowledge/graph/layout-engine.ts',
    'src/features/knowledge/graph/layout-state.ts',
    'src/features/knowledge/graph/node-activation.ts',
    'src/features/knowledge/progressive-graph-cache.ts',
    'scripts/tests/capture-knowledge-graph-node-expansion-894.ts',
  ];
  writeFileSync(path.join(outputDir, 'browser-evidence.json'), `${JSON.stringify({
    change: 'redesign-knowledge-graph-direct-manipulation',
    capturedAt: new Date().toISOString(),
    sourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, sha256(file)])),
    states,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
