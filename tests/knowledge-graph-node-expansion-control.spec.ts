import { expect, test, type Page, type Route } from '@playwright/test';

type ExpansionGate = {
  release: () => void;
  requested: Promise<void>;
  requestCount: () => number;
};

const graphVersion = 'knowledge-node-direct-activation-v1';
const expandableNode = {
  id: 'chapter-node:第一章',
  name: '第一章',
  nodeType: 'THEORY',
  description: '可直接展开的章节节点',
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  chapter: 1,
  chapterName: '第一章',
  metadata: { isVirtualChapter: true, chapterName: '第一章' },
  expansion: { state: 'expandable' as const, revealableNeighborCount: 1 },
};
const retryNode = {
  id: 'chapter-node:第二章',
  name: '第二章',
  nodeType: 'THEORY',
  description: '会先失败再重试的章节节点',
  positionX: 160,
  positionY: 0,
  positionZ: 0,
  chapter: 2,
  chapterName: '第二章',
  metadata: { isVirtualChapter: true, chapterName: '第二章' },
  expansion: { state: 'expandable' as const, revealableNeighborCount: 1 },
};
const leafNode = {
  id: 'leaf-node',
  name: '叶节点',
  nodeType: 'THEORY',
  description: '直接打开检查器的叶节点',
  positionX: 80,
  positionY: 100,
  positionZ: 0,
  chapter: 1,
  chapterName: '第一章',
  metadata: { chapterName: '第一章' },
  expansion: { state: 'leaf' as const },
};
const leafLink = {
  id: 'leaf-related',
  sourceId: expandableNode.id,
  targetId: leafNode.id,
  relation: 'contains',
  relationType: 'contains',
  strength: 1,
};

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function installGraphRoutes(page: Page): Promise<ExpansionGate> {
  const expandableDeferred = deferred();
  const expandableRequested = deferred();
  let expandableRequestCount = 0;
  let retryAttempts = 0;

  await page.route(`**/api/knowledge/nodes/${leafNode.id}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...leafNode,
        resources: [{ path: 'course-content/runtime/knowledge/cards/nodes/leaf-node.md' }],
        relatedNodes: [{
          id: expandableNode.id,
          name: expandableNode.name,
          nodeType: expandableNode.nodeType,
          relation: 'contains',
          category: 'related',
        }],
      }),
    });
  });

  await page.route('**/api/knowledge/graph?*', async (route: Route) => {
    const url = new URL(route.request().url());
    const mode = url.searchParams.get('mode');
    const nodeId = url.searchParams.get('nodeId');

    if (mode === 'expansion' && nodeId === expandableNode.id) {
      expandableRequestCount += 1;
      expandableRequested.release();
      await expandableDeferred.promise;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode,
          graphVersion,
          shardKey: `${graphVersion}:shard:expansion:${expandableNode.id}`,
          nodes: [expandableNode, leafNode],
          links: [leafLink],
          source: 'file',
        }),
      });
      return;
    }

    if (mode === 'expansion' && nodeId === retryNode.id) {
      retryAttempts += 1;
      if (retryAttempts === 1) {
        await route.fulfill({ status: 503, body: 'temporary failure' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode,
          graphVersion,
          shardKey: `${graphVersion}:shard:expansion:${retryNode.id}`,
          nodes: [retryNode],
          links: [],
          source: 'file',
        }),
      });
      return;
    }

    const shardName = mode === 'root' ? 'root' : mode ?? 'remaining';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode,
        graphVersion,
        shardKey: `${graphVersion}:shard:${shardName}:fixture`,
        nodes: [expandableNode, retryNode, leafNode],
        links: [leafLink],
        source: 'file',
      }),
    });
  });

  return {
    release: expandableDeferred.release,
    requested: expandableRequested.promise,
    requestCount: () => expandableRequestCount,
  };
}

function nodeControl(page: Page, nodeId: string) {
  return page.locator(`[data-knowledge-node-control="${nodeId}"]`);
}

async function waitForNodeControls(page: Page) {
  await expect(page.locator('[data-knowledge-canvas-primary="true"]')).toBeVisible();
  await expect(nodeControl(page, expandableNode.id)).toBeAttached();
}

async function activateWithKeyboard(page: Page, nodeId: string, key: 'Enter' | 'Space' = 'Enter') {
  const control = nodeControl(page, nodeId);
  await control.focus();
  await expect(control).toBeFocused();
  await control.press(key);
}

async function realCanvasNodePoints(page: Page, nodeId: string) {
  const pointHandle = await page.waitForFunction((expectedNodeId) => {
    const qa = (window as Window & {
      __knowledgeGraphQaNodePoints?: (id?: string) => Array<{ x: number; y: number }>;
    }).__knowledgeGraphQaNodePoints;
    const canvas = document.querySelector<HTMLCanvasElement>('[data-knowledge-canvas-primary="true"] canvas');
    const rect = canvas?.getBoundingClientRect();
    if (typeof qa !== 'function' || !rect) return false;
    const points = qa(expectedNodeId).filter((candidate) => (
      candidate.x >= rect.left && candidate.x <= rect.right
      && candidate.y >= rect.top && candidate.y <= rect.bottom
    ));
    return points.length > 0 ? points : false;
  }, nodeId, { timeout: 15_000 });
  const points = await pointHandle.jsonValue() as Array<{ x: number; y: number }>;
  await pointHandle.dispose();
  return points;
}

async function activateWithRealCanvas(page: Page, nodeId: string) {
  const points = await realCanvasNodePoints(page, nodeId);
  for (const point of points) {
    await page.mouse.click(point.x, point.y);
    try {
      await expect(page.locator('[data-knowledge-canvas-primary="true"]'))
        .toHaveAttribute('data-knowledge-selected-node-id', nodeId, { timeout: 2_000 });
      await expect(page.locator('[data-knowledge-inspector="floating-right-edge"]')).toBeVisible({ timeout: 2_000 });
      return point;
    } catch {
      // Try the neighboring QA candidate if the renderer's local hit radius differs.
    }
  }
  throw new Error(`Real Canvas inspection activation failed for ${nodeId}; points=${JSON.stringify(points)}.`);
}

async function activateExpandableWithRealCanvas(page: Page, nodeId: string) {
  const points = await realCanvasNodePoints(page, nodeId);
  for (const point of points) {
    await page.mouse.click(point.x, point.y);
    try {
      await expect(nodeControl(page, nodeId)).toHaveAttribute('aria-busy', 'true', { timeout: 2_000 });
      return point;
    } catch {
      // Try the neighboring QA candidate if the renderer's local hit radius differs.
    }
  }
  throw new Error(`Real Canvas expansion activation failed for ${nodeId}; points=${JSON.stringify(points)}.`);
}

async function centerRealCanvasNode(page: Page, nodeId: string) {
  await page.evaluate((expectedNodeId) => {
    (window as Window & { __knowledgeGraphQaResetViewport?: () => void }).__knowledgeGraphQaResetViewport?.();
    (window as Window & { __knowledgeGraphQaCenterNode?: (id: string) => void }).__knowledgeGraphQaCenterNode?.(expectedNodeId);
  }, nodeId);
  await page.waitForTimeout(180);
}

test('direct semantic node activation exposes busy, expanded, collapse, and cache reuse without a secondary control', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1280, height: 820 });
  const expansion = await installGraphRoutes(page);
  await page.goto('/knowledge?qa=knowledge-direct-activation');
  await waitForNodeControls(page);

  const control = nodeControl(page, expandableNode.id);
  await expect(control).toHaveAttribute('aria-expanded', 'false');
  await expect(control).toHaveAttribute('aria-busy', 'false');
  await expect(control).toHaveAttribute('data-error', 'false');

  await activateWithKeyboard(page, expandableNode.id);
  await expansion.requested;
  await expect(control).toHaveAttribute('aria-busy', 'true');
  await activateWithKeyboard(page, expandableNode.id, 'Space');
  expect(expansion.requestCount()).toBe(1);

  expansion.release();
  await expect(control).toHaveAttribute('aria-busy', 'false');
  await expect(control).toHaveAttribute('aria-expanded', 'true');
  await expect(control).toHaveAttribute('data-shard-cached', 'true');

  await activateWithKeyboard(page, expandableNode.id);
  await expect(control).toHaveAttribute('aria-expanded', 'false');
  await activateWithKeyboard(page, expandableNode.id);
  await expect(control).toHaveAttribute('aria-expanded', 'true');
  expect(expansion.requestCount()).toBe(1);
});

test('direct activation retains retry and filtered-empty states on the node itself', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await installGraphRoutes(page);
  await page.goto('/knowledge?qa=knowledge-direct-activation');
  await waitForNodeControls(page);

  const control = nodeControl(page, retryNode.id);
  await activateWithKeyboard(page, retryNode.id);
  await expect(control).toHaveAttribute('aria-busy', 'false');
  await expect(control).toHaveAttribute('data-error', 'true');

  await activateWithKeyboard(page, retryNode.id);
  await expect(control).toHaveAttribute('data-error', 'false');
  await expect(control).toHaveAttribute('aria-expanded', 'true');
  await expect(control).toHaveAttribute('data-filtered-empty', 'true');
  await expect(page.locator('[data-knowledge-filtered-empty-explanation="visible"]')).toBeVisible();
});

test('leaf activation selects the leaf directly without an expansion request', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  const expansion = await installGraphRoutes(page);
  await page.goto('/knowledge?qa=knowledge-direct-activation');
  await waitForNodeControls(page);

  await activateWithKeyboard(page, expandableNode.id);
  await expansion.requested;
  expansion.release();
  await expect(nodeControl(page, expandableNode.id)).toHaveAttribute('aria-expanded', 'true');
  await expect(nodeControl(page, leafNode.id)).toBeAttached();
  await nodeControl(page, leafNode.id).evaluate((control) => (control as HTMLButtonElement).click());
  await expect(page.locator('[data-knowledge-canvas-primary="true"]')).toHaveAttribute('data-knowledge-selected-node-id', leafNode.id);
  await expect(nodeControl(page, leafNode.id)).not.toHaveAttribute('aria-expanded', /.*/);
  expect(expansion.requestCount()).toBe(1);
});

test('real canvas pointers activate the leaf in both 2D and 3D renderers', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1280, height: 820 });
  const expansion = await installGraphRoutes(page);
  await page.goto('/knowledge?qa=issue-894-direct-activation');
  await waitForNodeControls(page);
  await page.locator('[data-knowledge-graph-renderer="2D"] canvas').waitFor({ state: 'attached' });
  await centerRealCanvasNode(page, expandableNode.id);
  await activateExpandableWithRealCanvas(page, expandableNode.id);
  await expansion.requested;
  expansion.release();
  await expect(nodeControl(page, expandableNode.id)).toHaveAttribute('aria-expanded', 'true');
  await centerRealCanvasNode(page, leafNode.id);

  const point2d = await activateWithRealCanvas(page, leafNode.id);
  expect(point2d.x).toBeGreaterThan(0);
  expect(point2d.y).toBeGreaterThan(0);

  const viewLayoutTrigger = page.locator('[data-knowledge-command-trigger="view-layout"]');
  const viewPanel = page.locator('[data-knowledge-desktop-tool-panel="view-layout"]');
  await viewLayoutTrigger.click();
  await viewPanel.getByRole('button', { name: '3D 视图' }).click();
  await page.locator('[data-knowledge-graph-renderer="3D"] canvas').waitFor({ state: 'attached' });
  if (await viewPanel.isVisible().catch(() => false)) {
    await viewLayoutTrigger.click();
    await viewPanel.waitFor({ state: 'hidden' });
  }
  await page.waitForTimeout(750);
  await centerRealCanvasNode(page, leafNode.id);

  const point3d = await activateWithRealCanvas(page, leafNode.id);
  expect(point3d.x).toBeGreaterThan(0);
  expect(point3d.y).toBeGreaterThan(0);
});

test('the same direct node control remains available while switching 2D and 3D renderers', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1280, height: 820 });
  const expansion = await installGraphRoutes(page);
  await page.goto('/knowledge?qa=knowledge-direct-activation');
  await waitForNodeControls(page);

  await page.locator('[data-knowledge-command-trigger="view-layout"]').click();
  const viewPanel = page.locator('[data-knowledge-desktop-tool-panel="view-layout"]');
  await viewPanel.getByRole('button', { name: '3D 视图' }).click();
  await activateWithKeyboard(page, expandableNode.id);
  await expansion.requested;
  expansion.release();
  await expect(nodeControl(page, expandableNode.id)).toHaveAttribute('aria-expanded', 'true');

  await viewPanel.getByRole('button', { name: '2D 视图' }).click();
  await expect(nodeControl(page, expandableNode.id)).toHaveAttribute('aria-expanded', 'true');
});
