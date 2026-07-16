import { expect, test, type Page, type Route } from '@playwright/test';

const { PNG } = require('pngjs') as {
  PNG: { sync: { read: (buffer: Buffer) => { width: number; height: number; data: Uint8Array } } };
};
const axeSourcePath = require.resolve('axe-core/axe.min.js');

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
  name: '第二章超长语义焦点按钮名称用于移动端正常换行验证',
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
const rootCatalog = [
  { nodeId: leafNode.id, nodeName: leafNode.name, nodeType: leafNode.nodeType,
    domainId: expandableNode.id, chapterName: expandableNode.name },
];
const rootSummaries = [
  { rootId: expandableNode.id, rootName: expandableNode.name, nodeCount: 1, hasExpansion: true },
  { rootId: retryNode.id, rootName: retryNode.name, nodeCount: 0, hasExpansion: true },
];

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test('real reciprocal cross-family fixture keeps unique curved lanes and target arrows in 2D and 3D', async ({ page }) => {
  const root = { ...expandableNode, id: 'chapter-node:reciprocal-review', name: '互反关系终审夹具' };
  const nodeA = { ...leafNode, id: 'reciprocal-a', name: '互反节点 A', chapterName: root.name,
    metadata: { chapterName: root.name }, positionX: -80, positionY: 0 };
  const nodeB = { ...leafNode, id: 'reciprocal-b', name: '互反节点 B', chapterName: root.name,
    metadata: { chapterName: root.name }, positionX: 80, positionY: 0 };
  const fixtureLinks = [
    { id: 'child-reverse', sourceId: nodeB.id, targetId: nodeA.id, relation: 'contains', relationType: 'contains', strength: 1 },
    { id: 'post-forward', sourceId: nodeA.id, targetId: nodeB.id, relation: 'prerequisite', relationType: 'prerequisite', strength: 1 },
    { id: 'post-reverse', sourceId: nodeB.id, targetId: nodeA.id, relation: 'prerequisite', relationType: 'prerequisite', strength: 1 },
  ];
  await page.route('**/api/knowledge/graph?*', async (route) => {
    const expansion = route.request().url().includes('mode=expansion');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(expansion ? {
        mode: 'expansion', domainId: root.id, graphVersion, shardKey: `${graphVersion}:shard:expansion:${root.id}`,
        nodes: [root, nodeA, nodeB], links: fixtureLinks,
        membershipLinks: [nodeA, nodeB].map((node) => ({
          id: `chapter-link:${root.id}->${node.id}`,
          sourceId: root.id,
          targetId: node.id,
          relation: 'contains',
          relationType: 'contains',
          strength: 1,
        })),
        source: 'file',
        truncated: { nodes: false, links: false, membershipLinks: false },
      } : {
        mode: 'root', graphVersion, shardKey: `${graphVersion}:shard:root:chapters`, nodes: [root], links: [],
        rootCatalog: [nodeA, nodeB].map((node) => ({ nodeId: node.id, nodeName: node.name,
          nodeType: node.nodeType, domainId: root.id, chapterName: root.name })),
        rootSummaries: [{ rootId: root.id, rootName: root.name, nodeCount: 2, hasExpansion: true }],
        source: 'file', truncated: { nodes: false, links: false, membershipLinks: false },
      }),
    });
  });
  await page.goto('/knowledge?qa=reciprocal-renderer-contract');
  await expect(nodeControl(page, root.id)).toBeAttached();
  await activateWithKeyboard(page, root.id);
  await expect(nodeControl(page, nodeA.id)).toBeAttached();
  await page.locator('[data-knowledge-relation-family-control]').getByRole('checkbox', { name: /全部/ }).click();

  const readEdges = async () => JSON.parse(
    await page.locator('[data-knowledge-graph-renderer]').getAttribute('data-knowledge-edge-lanes') ?? '[]',
  ) as Array<{ id: string; curvature: number; targetArrow: boolean }>;
  await expect.poll(async () => (await readEdges()).length).toBe(3);
  const twoDimensional = (await readEdges()).filter(
    (edge) => ['child-reverse', 'post-forward', 'post-reverse'].includes(edge.id),
  );
  expect(twoDimensional, JSON.stringify(await readEdges())).toHaveLength(3);
  expect(new Set(twoDimensional.map((edge) => edge.curvature)).size).toBe(3);
  expect(twoDimensional.filter((edge) => edge.curvature === 0)).toHaveLength(1);
  expect(twoDimensional.every((edge) => edge.targetArrow)).toBe(true);
  const countRenderedInk = (buffer: Buffer) => {
    const png = PNG.sync.read(buffer);
    let ink = 0;
    for (let offset = 0; offset < png.data.length; offset += 4) {
      const spread = Math.max(png.data[offset], png.data[offset + 1], png.data[offset + 2])
        - Math.min(png.data[offset], png.data[offset + 1], png.data[offset + 2]);
      if (spread > 18 || Math.max(png.data[offset], png.data[offset + 1], png.data[offset + 2]) < 120) ink += 1;
    }
    return ink;
  };
  const twoDimensionalInk = countRenderedInk(await page.locator(
    '[data-knowledge-graph-renderer="2D"] canvas',
  ).screenshot());
  expect(twoDimensionalInk).toBeGreaterThan(40);

  await page.locator('[data-knowledge-command-trigger="view-layout"]').click();
  await page.locator('[data-knowledge-desktop-tool-panel="view-layout"]')
    .getByRole('button', { name: '3D 视图' }).click();
  await expect.poll(async () => (await readEdges()).length).toBe(3);
  const threeDimensional = (await readEdges()).filter(
    (edge) => ['child-reverse', 'post-forward', 'post-reverse'].includes(edge.id),
  );
  expect(threeDimensional).toEqual(twoDimensional);
  const threeDimensionalInk = countRenderedInk(await page.locator(
    '[data-knowledge-graph-renderer="3D"] canvas',
  ).screenshot());
  expect(threeDimensionalInk).toBeGreaterThan(40);
  const transparentCanvas = await page.locator('[data-knowledge-graph-renderer="3D"] canvas').evaluate((canvas) => {
    const webglCanvas = canvas as HTMLCanvasElement;
    const gl = webglCanvas.getContext('webgl2') ?? webglCanvas.getContext('webgl');
    return {
      alpha: gl?.getContextAttributes()?.alpha ?? false,
      backgroundColor: getComputedStyle(canvas).backgroundColor,
    };
  });
  expect(transparentCanvas.alpha).toBe(true);
  expect(transparentCanvas.backgroundColor).toBe('rgba(0, 0, 0, 0)');
});

async function installGraphRoutes(page: Page, options: { denseDomain?: boolean; launchTarget?: unknown } = {}): Promise<ExpansionGate> {
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
        metadata: {
          ...leafNode.metadata,
          launchTarget: options.launchTarget ?? '/adaptive-learning/path-node/opaque-leaf',
          renderTarget: '/safe-render-fallback-must-not-launch',
          lessonEntry: '/safe-lesson-fallback-must-not-launch',
          lessonId: '1-1',
        },
        resources: [{ path: 'course-content/runtime/knowledge/cards/nodes/leaf-node.md' }],
        relatedNodes: [
          {
            id: expandableNode.id,
            name: expandableNode.name,
            nodeType: expandableNode.nodeType,
            relation: 'contains',
            canonicalType: 'contains',
            category: 'membership',
            inspectionSentence: '本节点属于当前领域',
            evidenceState: 'unavailable',
            sourceId: expandableNode.id,
            targetId: leafNode.id,
          },
          {
            id: 'cycle-peer',
            name: '循环相邻节点',
            nodeType: 'THEORY',
            relation: 'prerequisite',
            canonicalType: 'prerequisite',
            category: 'follows',
            cycleState: 'cyclic',
            inspectionSentence: '本节点之后学习目标节点',
            evidenceState: 'unavailable',
            sourceId: leafNode.id,
            targetId: 'cycle-peer',
          },
          {
            id: 'provenance-peer',
            name: '有依据的关联节点',
            nodeType: 'THEORY',
            relation: 'supports',
            canonicalType: 'supports',
            category: 'related',
            inspectionSentence: '本节点支撑目标结论',
            evidenceState: 'available',
            rationale: '教材评审依据',
            sourceId: leafNode.id,
            targetId: 'provenance-peer',
          },
        ],
      }),
    });
  });

  await page.route('**/api/knowledge/graph?*', async (route: Route) => {
    const url = new URL(route.request().url());
    const mode = url.searchParams.get('mode');
    const domainId = url.searchParams.get('domainId');

    if (mode === 'expansion' && domainId === expandableNode.id) {
      expandableRequestCount += 1;
      expandableRequested.release();
      await expandableDeferred.promise;
      const denseNodes = options.denseDomain
        ? Array.from({ length: 75 }, (_, index) => ({
            ...leafNode,
            id: `dense-node-${index}`,
            name: `密集知识节点 ${index + 1}`,
            positionX: (index % 15) * 70 - 490,
            positionY: Math.floor(index / 15) * 70 - 140,
          }))
        : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode,
          domainId,
          graphVersion,
          shardKey: `${graphVersion}:shard:expansion:${expandableNode.id}`,
          nodes: [expandableNode, leafNode, ...denseNodes],
          links: [leafLink, ...denseNodes.map((node) => ({
            id: `dense-link-${node.id}`,
            sourceId: expandableNode.id,
            targetId: node.id,
            relation: 'contains',
            relationType: 'contains',
            strength: 1,
          }))],
          source: 'file',
          truncated: { nodes: false, links: false, membershipLinks: false },
        }),
      });
      return;
    }

    if (mode === 'expansion' && domainId === retryNode.id) {
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
          domainId,
          graphVersion,
          shardKey: `${graphVersion}:shard:expansion:${retryNode.id}`,
          nodes: [retryNode],
          links: [],
          source: 'file',
          truncated: { nodes: false, links: false, membershipLinks: false },
        }),
      });
      return;
    }

    const shardName = mode === 'root' ? 'root:chapters' : mode ?? 'remaining';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode,
        graphVersion,
        shardKey: mode === 'root'
          ? `${graphVersion}:shard:root:chapters`
          : `${graphVersion}:shard:${shardName}:fixture`,
        nodes: mode === 'root' ? [expandableNode, retryNode] : [],
        links: [],
        ...(mode === 'root' ? { rootCatalog, rootSummaries } : {}),
        source: 'file',
        truncated: { nodes: false, links: false, membershipLinks: false },
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

async function stableRealCanvasNodePoint(page: Page, nodeId: string) {
  let point = (await realCanvasNodePoints(page, nodeId))[0];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.mouse.move(point.x, point.y);
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    const nextPoint = (await realCanvasNodePoints(page, nodeId))[0];
    if (Math.hypot(nextPoint.x - point.x, nextPoint.y - point.y) < 0.75) return nextPoint;
    point = nextPoint;
  }
  return point;
}

async function activateWithRealCanvas(page: Page, nodeId: string) {
  const points: Array<{ x: number; y: number }> = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const point = await stableRealCanvasNodePoint(page, nodeId);
    points.push(point);
    await page.mouse.move(point.x, point.y);
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await page.mouse.down();
    await page.mouse.up();
    try {
      await expect(page.locator('[data-knowledge-canvas-primary="true"]'))
        .toHaveAttribute('data-knowledge-selected-node-id', nodeId, { timeout: 1_000 });
      await expect(page.locator('[data-knowledge-inspector="floating-right-edge"]')).toBeVisible({ timeout: 1_000 });
      return point;
    } catch {
      // Try the neighboring QA candidate if the renderer's local hit radius differs.
    }
  }
  throw new Error(`Real Canvas inspection activation failed for ${nodeId}; points=${JSON.stringify(points)}.`);
}

async function activateExpandableWithRealCanvas(page: Page, nodeId: string) {
  const points: Array<{ x: number; y: number }> = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const point = await stableRealCanvasNodePoint(page, nodeId);
    points.push(point);
    await page.mouse.move(point.x, point.y);
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await page.mouse.down();
    await page.mouse.up();
    try {
      await expect(nodeControl(page, nodeId)).toHaveAttribute('aria-busy', 'true', { timeout: 1_000 });
      return point;
    } catch {
      // Try the neighboring QA candidate if the renderer's local hit radius differs.
    }
  }
  throw new Error(`Real Canvas expansion activation failed for ${nodeId}; points=${JSON.stringify(points)}.`);
}

async function findRealCanvasBlankPoint(page: Page) {
  return page.locator('[data-knowledge-graph-renderer="2D"] canvas').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    const points = (window as Window & {
      __knowledgeGraphQaNodePoints?: () => Array<{ x: number; y: number }>;
    }).__knowledgeGraphQaNodePoints?.() ?? [];
    for (const xRatio of [0.88, 0.76, 0.64, 0.52]) {
      for (const yRatio of [0.18, 0.3, 0.42]) {
        const point = { x: rect.left + rect.width * xRatio, y: rect.top + rect.height * yRatio };
        const hit = document.elementFromPoint(point.x, point.y);
        const clearOfNodes = points.every((node) => Math.hypot(node.x - point.x, node.y - point.y) > 56);
        if (hit === canvas && clearOfNodes) return point;
      }
    }
    throw new Error('No real blank canvas point is available for dismissal acceptance.');
  });
}

test('direct semantic node activation exposes busy, expanded, root return, and cache reuse without a secondary control', async ({ page }) => {
  test.setTimeout(45_000);
  const viewportWidth = Number(process.env.KNOWLEDGE_RETURN_VIEWPORT_WIDTH ?? 1280);
  await page.setViewportSize({ width: viewportWidth, height: viewportWidth <= 390 ? 844 : 820 });
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

  const returnButton = page.locator('[data-knowledge-return-root="true"]');
  const returnHitTarget = await returnButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit?.closest('[data-knowledge-return-root="true"]') === button;
  });
  expect(returnHitTarget).toBe(true);

  await returnButton.click();
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

for (const viewport of [{ width: 1280, height: 820 }, { width: 390, height: 844 }]) {
  test(`inspector preserves read-only learning context at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const nonGetRequests: string[] = [];
    const allowedNonGetRequests = new Set<string>();
    page.on('request', (request) => {
      if (request.method() !== 'GET') nonGetRequests.push(`${request.method()} ${request.url()}`);
    });
    const expansion = await installGraphRoutes(page);
    await page.goto('/knowledge?qa=task-73-read-only-inspector');
    await waitForNodeControls(page);

    await activateWithKeyboard(page, expandableNode.id);
    await expansion.requested;
    expansion.release();
    await expect(nodeControl(page, leafNode.id)).toBeAttached();
    await activateWithKeyboard(page, leafNode.id);

    const workspace = page.locator('[data-knowledge-workspace="canvas-first"]');
    const canvas = page.locator('[data-knowledge-canvas-primary="true"]');
    const inspector = page.locator('[data-knowledge-inspector="floating-right-edge"]');
    await expect(inspector).toBeVisible();
    await expect(workspace).toHaveAttribute('data-knowledge-konling-context-status', 'selected-node');
    await expect(inspector).toContainText('知识卡片');
    await expect(inspector.locator('[data-resource-node-action="launch"]'))
      .toHaveAttribute('href', '/adaptive-learning/path-node/opaque-leaf');
    await expect(inspector.locator('[data-resource-node-action="review-evidence"]'))
      .toHaveAttribute('href', '/profile/evidence?lessonId=1-1');
    await expect(inspector).toHaveAttribute('aria-modal', 'false');
    await expect(canvas).toBeVisible();
    const membershipGroup = inspector.getByRole('button', { name: /层级与包含关系/ });
    const followsGroup = inspector.getByRole('button', { name: /后续关系/ });
    const relatedGroup = inspector.getByRole('button', { name: /关联关系/ });
    await expect(membershipGroup).toHaveAttribute('aria-expanded', 'true');
    await expect(inspector).toContainText('本节点属于当前领域');
    await followsGroup.click();
    await expect(inspector).toContainText('需共同理解或待审查');
    await relatedGroup.click();
    await expect(inspector).toContainText('教材评审依据');

    const scrollTop = await inspector.evaluate((element) => {
      const body = element.querySelector<HTMLElement>('[data-knowledge-detail-owner]');
      if (body) body.style.minHeight = '1600px';
      element.scrollTop = 160;
      return element.scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);
    const familyControl = page.locator('[data-knowledge-relation-family-control]').first();
    await familyControl.locator('[data-knowledge-relation-family="child"]').click();
    await expect.poll(() => inspector.evaluate((element) => element.scrollTop)).toBe(scrollTop);
    await expect(membershipGroup).toHaveAttribute('aria-expanded', 'true');
    expect(nonGetRequests.filter((request) => !allowedNonGetRequests.has(request))).toEqual([]);

    if (viewport.width === 390) {
      await page.addScriptTag({ path: axeSourcePath });
      const axeViolations = await inspector.evaluate(async (element) => {
        const axe = (window as unknown as {
          axe: { run: (
            target: Element,
            options: { runOnly: { type: 'rule'; values: string[] } }
          ) => Promise<{ violations: Array<{ id: string }> }> };
        }).axe;
        return (await axe.run(element, {
          runOnly: {
            type: 'rule',
            values: ['aria-allowed-role', 'aria-dialog-name', 'aria-valid-attr', 'aria-valid-attr-value'],
          },
        })).violations.map((violation) => violation.id);
      });
      expect(axeViolations).toEqual([]);
      await expect(page.locator('[data-knowledge-mobile-command-surface="single-tool-panel"]'))
        .toHaveAttribute('data-state', 'closed');
      const close = page.getByRole('button', { name: '关闭知识节点检查器' });
      await close.focus();
      await expect(close).toBeFocused();
      await close.press('Shift+Tab');
      expect(await inspector.evaluate((element) => element.contains(document.activeElement))).toBe(false);
      await close.focus();
      await close.press('Escape');
      await expect(inspector).toHaveCount(0);
      await expect(nodeControl(page, leafNode.id)).toBeFocused();
    }
  });
}

test('unsafe opaque launch target never becomes a real inspector anchor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  const expansion = await installGraphRoutes(page, { launchTarget: 'javascript:alert(document.domain)' });
  await page.goto('/knowledge?qa=task-62-unsafe-launch');
  await waitForNodeControls(page);

  await activateWithKeyboard(page, expandableNode.id);
  await expansion.requested;
  expansion.release();
  await expect(nodeControl(page, leafNode.id)).toBeAttached();
  await activateWithKeyboard(page, leafNode.id);

  const launch = page.locator('[data-resource-node-action="launch"]');
  await expect(launch).toHaveAttribute('aria-disabled', 'true');
  await expect(launch).toContainText('资源启动地址未通过安全校验，当前不可启动。');
  await expect(page.locator('a[data-resource-node-action="launch"]')).toHaveCount(0);
});

for (const [caseName, launchTarget] of [
  ['blank', ''],
  ['newline', '\n'],
  ['numeric', 42],
  ['object', { href: '/safe-looking-object' }],
] as const) {
  test(`invalid ${caseName} authoritative launch target blocks every safe fallback anchor`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    const expansion = await installGraphRoutes(page, { launchTarget });
    await page.goto(`/knowledge?qa=task-74-invalid-authoritative-${caseName}`);
    await waitForNodeControls(page);

    await activateWithKeyboard(page, expandableNode.id);
    await expansion.requested;
    expansion.release();
    await expect(nodeControl(page, leafNode.id)).toBeAttached();
    await activateWithKeyboard(page, leafNode.id);

    const launch = page.locator('[data-resource-node-action="launch"]');
    await expect(launch).toHaveAttribute('aria-disabled', 'true');
    await expect(launch).toContainText('资源启动地址未通过安全校验，当前不可启动。');
    await expect(page.locator('a[data-resource-node-action="launch"]')).toHaveCount(0);
  });
}

test('real 2D pan and blank activation dismiss inspection without leaving the domain', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  const expansion = await installGraphRoutes(page);
  await page.goto('/knowledge?qa=task-73-canvas-dismissal');
  await waitForNodeControls(page);
  await activateWithKeyboard(page, expandableNode.id);
  await expansion.requested;
  expansion.release();
  await expect(nodeControl(page, leafNode.id)).toBeAttached();
  await activateWithKeyboard(page, leafNode.id);

  const canvas = page.locator('[data-knowledge-canvas-primary="true"]');
  const inspector = page.locator('[data-knowledge-inspector="floating-right-edge"]');
  await expect(inspector).toBeVisible();
  const blank = await findRealCanvasBlankPoint(page);
  await page.mouse.move(blank.x, blank.y);
  await page.mouse.down();
  await page.mouse.move(blank.x + 32, blank.y + 12, { steps: 4 });
  await page.mouse.up();
  await expect(inspector).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-knowledge-active-domain-id', expandableNode.id);
  await expect(canvas).toHaveAttribute('data-knowledge-selected-node-id', leafNode.id);

  await activateWithKeyboard(page, leafNode.id);
  await expect(inspector).toBeVisible();
  const secondBlank = await findRealCanvasBlankPoint(page);
  await page.mouse.click(secondBlank.x, secondBlank.y);
  await expect(inspector).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-knowledge-active-domain-id', expandableNode.id);
  await expect(canvas).toHaveAttribute('data-knowledge-selected-node-id', '');
});

test('selected-node association presentation is capped at 24 edges in the browser', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  const root = { ...expandableNode, id: 'chapter-node:association-cap', name: '关联密度领域' };
  const selected = { ...leafNode, id: 'association-center', name: '关联中心', chapterName: root.name };
  const peers = Array.from({ length: 30 }, (_, index) => ({
    ...leafNode,
    id: `association-peer-${String(index).padStart(2, '0')}`,
    name: `关联节点 ${index + 1}`,
    chapterName: root.name,
  }));
  const links = peers.map((peer, index) => ({
    id: `association-${String(index).padStart(2, '0')}`,
    sourceId: selected.id,
    targetId: peer.id,
    relation: 'related',
    relationType: 'related',
    strength: 1 - index / 100,
  }));
  await page.route('**/api/knowledge/graph?*', async (route) => {
    const mode = new URL(route.request().url()).searchParams.get('mode');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mode === 'root' ? {
        mode: 'root', graphVersion, shardKey: `${graphVersion}:shard:root:chapters`,
        nodes: [root], links: [],
        rootCatalog: [selected, ...peers].map((node) => ({
          nodeId: node.id, nodeName: node.name, nodeType: node.nodeType,
          domainId: root.id, chapterName: root.name,
        })),
        rootSummaries: [{ rootId: root.id, rootName: root.name, nodeCount: 31, hasExpansion: true }],
        source: 'file', truncated: { nodes: false, links: false, membershipLinks: false },
      } : {
        mode: 'expansion', domainId: root.id, graphVersion,
        shardKey: `${graphVersion}:shard:expansion:${root.id}`,
        nodes: [root, selected, ...peers], links,
        source: 'file', truncated: { nodes: false, links: false, membershipLinks: false },
      }),
    });
  });

  await page.goto('/knowledge?qa=task-73-association-cap');
  await activateWithKeyboard(page, root.id);
  await expect(nodeControl(page, selected.id)).toBeAttached();
  await activateWithKeyboard(page, selected.id);
  const renderer = page.locator('[data-knowledge-graph-renderer="2D"]');
  await expect.poll(async () => {
    const lanes = JSON.parse(await renderer.getAttribute('data-knowledge-edge-lanes') ?? '[]');
    return lanes.length;
  }).toBe(24);
  const laneIds = JSON.parse(await renderer.getAttribute('data-knowledge-edge-lanes') ?? '[]')
    .map((lane: { id: string }) => lane.id);
  expect(laneIds).toEqual(links.slice(0, 24).map((link) => link.id));
});

test('adjacent corridor navigation switches domain, selects its target, and ignores stale detail', async ({ page }) => {
  const viewportWidth = Number(process.env.KNOWLEDGE_INSPECTOR_VIEWPORT_WIDTH ?? 1280);
  await page.setViewportSize({ width: viewportWidth, height: viewportWidth <= 390 ? 844 : 820 });
  const domainA = { ...expandableNode, id: 'chapter-node:domain-a', name: '领域 A' };
  const domainB = { ...retryNode, id: 'chapter-node:domain-b', name: '领域 B' };
  const nodeA = { ...leafNode, id: 'node-a', name: '节点 A', chapterName: domainA.name,
    metadata: { chapterName: domainA.name } };
  const nodeB = { ...leafNode, id: 'node-b', name: '节点 B', chapterName: domainB.name,
    metadata: { chapterName: domainB.name } };
  const detailA = deferred();
  const detailB = deferred();

  await page.route('**/api/knowledge/nodes/node-a', async (route) => {
    await detailA.promise;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ...nodeA, description: '过期的节点 A 详情', relatedNodes: [], resources: [],
    }) });
  });
  await page.route('**/api/knowledge/nodes/node-b', async (route) => {
    await detailB.promise;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ...nodeB, description: '节点 B 的当前详情', relatedNodes: [], resources: [],
    }) });
  });
  await page.route('**/api/knowledge/graph?*', async (route) => {
    const url = new URL(route.request().url());
    const mode = url.searchParams.get('mode');
    const domainId = url.searchParams.get('domainId');
    if (mode === 'root') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        mode, graphVersion, shardKey: `${graphVersion}:shard:root:chapters`,
        nodes: [domainA, domainB], links: [],
        rootCatalog: [
          { nodeId: nodeA.id, nodeName: nodeA.name, nodeType: nodeA.nodeType, domainId: domainA.id, chapterName: domainA.name },
          { nodeId: nodeB.id, nodeName: nodeB.name, nodeType: nodeB.nodeType, domainId: domainB.id, chapterName: domainB.name },
        ],
        rootSummaries: [
          { rootId: domainA.id, rootName: domainA.name, nodeCount: 1, hasExpansion: true },
          { rootId: domainB.id, rootName: domainB.name, nodeCount: 1, hasExpansion: true },
        ],
        source: 'file', truncated: { nodes: false, links: false, membershipLinks: false },
      }) });
      return;
    }
    const activeDomain = domainId === domainA.id ? domainA : domainB;
    const activeNode = domainId === domainA.id ? nodeA : nodeB;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      mode: 'expansion', domainId, graphVersion,
      shardKey: `${graphVersion}:shard:expansion:${domainId}`,
      nodes: [activeDomain, activeNode], links: [],
      corridorLinks: [{
        id: 'cross-post', sourceId: nodeA.id, targetId: nodeB.id,
        relation: 'prerequisite', relationType: 'prerequisite', strength: 1,
      }],
      membershipLinks: [{
        id: `chapter-link:${activeDomain.id}->${activeNode.id}`,
        sourceId: activeDomain.id, targetId: activeNode.id,
        relation: 'contains', relationType: 'contains', strength: 1,
      }],
      source: 'file',
      truncated: { nodes: false, links: false, membershipLinks: false, corridorLinks: false },
    }) });
  });

  await page.goto('/knowledge?qa=inspector-cross-domain-owner');
  await activateWithKeyboard(page, domainA.id);
  await expect(page.locator('[data-knowledge-inspector="floating-right-edge"]')).toHaveCount(0);
  await expect(nodeControl(page, nodeA.id)).toBeAttached();
  await activateWithKeyboard(page, nodeA.id);
  const inspector = page.locator('[data-knowledge-inspector="floating-right-edge"]');
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('节点 A');
  const adjacent = inspector.locator('[data-knowledge-adjacent-domain-id="chapter-node:domain-b"]');
  await expect(adjacent).toContainText('进入相邻领域的后续概念');
  await adjacent.click();

  await expect(page.locator('[data-knowledge-canvas-primary="true"]'))
    .toHaveAttribute('data-knowledge-active-domain-id', domainB.id);
  await expect(page.locator('[data-knowledge-canvas-primary="true"]'))
    .toHaveAttribute('data-knowledge-selected-node-id', nodeB.id);
  await expect(inspector).toContainText('节点 B');
  const scrollTopBeforeDetail = await inspector.evaluate((element) => {
    const detailBody = element.querySelector<HTMLElement>('[data-knowledge-detail-owner]');
    if (detailBody) detailBody.style.minHeight = '1600px';
    element.scrollTop = 180;
    return element.scrollTop;
  });
  expect(scrollTopBeforeDetail).toBeGreaterThan(0);
  detailB.release();
  await expect(inspector).toContainText('节点 B 的当前详情');
  await expect.poll(() => inspector.evaluate((element) => element.scrollTop)).toBe(scrollTopBeforeDetail);
  detailA.release();
  await expect(inspector).not.toContainText('过期的节点 A 详情');
  await expect(inspector).toContainText('节点 B 的当前详情');
});

test('real canvas pointers activate the leaf in both 2D and 3D renderers', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1280, height: 820 });
  const expansion = await installGraphRoutes(page);
  await page.goto('/knowledge?qa=issue-894-direct-activation');
  await waitForNodeControls(page);
  await page.locator('[data-knowledge-graph-renderer="2D"] canvas').waitFor({ state: 'attached' });
  await activateExpandableWithRealCanvas(page, expandableNode.id);
  await expect(page.locator('[data-knowledge-canvas-primary="true"]'))
    .toHaveAttribute('data-knowledge-active-domain-id', expandableNode.id);
  await expansion.requested;
  expansion.release();
  await expect(nodeControl(page, expandableNode.id)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-knowledge-graph-renderer="2D"]'))
    .toHaveAttribute('data-knowledge-graph-presentation-phase', 'idle');
  const inspectorClose = page.getByRole('button', { name: '关闭知识节点检查器' });
  if (await inspectorClose.isVisible().catch(() => false)) await inspectorClose.click();

  const point2d = await activateWithRealCanvas(page, leafNode.id);
  expect(point2d.x).toBeGreaterThan(0);
  expect(point2d.y).toBeGreaterThan(0);
  await inspectorClose.click();
  await expect(page.locator('[data-knowledge-inspector="floating-right-edge"]')).toHaveCount(0);

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

test('domain default, fit, and theme switching keep light 2D/3D canvases free of black overlays', async ({ page }) => {
  test.setTimeout(300_000);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const expansion = await installGraphRoutes(page, { denseDomain: true });
    await page.goto('/knowledge?qa=task-42-webgl-acceptance');
    await waitForNodeControls(page);
    await activateWithKeyboard(page, expandableNode.id);
    await expansion.requested;
    expansion.release();
    await expect(nodeControl(page, leafNode.id)).toBeAttached();
    await page.waitForTimeout(3000);

    const chooseView = async (label: '2D 视图' | '3D 视图', fit = true) => {
      if (viewport.width < 1024) {
        const panel = page.locator('[data-knowledge-mobile-tool-panel="view-layout"]');
        if (!await panel.isVisible()) await page.getByRole('button', { name: '视图', exact: true }).click();
        await panel.getByRole('button', { name: label }).click();
        if (fit) await panel.locator('[data-knowledge-layout-control="fit-view"]').click();
        await page.locator('[data-knowledge-mobile-panel-toggle="true"]').click();
      } else {
        const panel = page.locator('[data-knowledge-desktop-tool-panel="view-layout"]');
        if (!await panel.isVisible()) await page.locator('[data-knowledge-command-trigger="view-layout"]').click();
        await panel.getByRole('button', { name: label }).click();
        if (fit) await panel.locator('[data-knowledge-layout-control="fit-view"]').click();
      }
      await page.waitForTimeout(3000);
    };
    const fitCurrentView = async () => {
      if (viewport.width < 1024) {
        const panel = page.locator('[data-knowledge-mobile-tool-panel="view-layout"]');
        if (!await panel.isVisible()) await page.getByRole('button', { name: '视图', exact: true }).click();
        await panel.locator('[data-knowledge-layout-control="fit-view"]').click();
        await page.locator('[data-knowledge-mobile-panel-toggle="true"]').click();
      } else {
        const panel = page.locator('[data-knowledge-desktop-tool-panel="view-layout"]');
        if (!await panel.isVisible()) await page.locator('[data-knowledge-command-trigger="view-layout"]').click();
        await panel.locator('[data-knowledge-layout-control="fit-view"]').click();
      }
      await page.waitForTimeout(3000);
    };
    const assertNoBlackOverlay = async (renderer: '2D' | '3D') => {
      const canvas = page.locator(`[data-knowledge-graph-renderer="${renderer}"] canvas`);
      await canvas.waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
      const png = PNG.sync.read(await canvas.screenshot());
      let nearBlackPixels = 0;
      for (let offset = 0; offset < png.data.length; offset += 4) {
        if (png.data[offset] < 8 && png.data[offset + 1] < 8 && png.data[offset + 2] < 8
          && png.data[offset + 3] > 240) nearBlackPixels += 1;
      }
      expect(nearBlackPixels / (png.width * png.height)).toBeLessThan(0.35);
      const pagePng = PNG.sync.read(await page.screenshot());
      let longestHorizontalRun = 0;
      let longestVerticalRun = 0;
      for (let y = 0; y < pagePng.height; y += 1) {
        let run = 0;
        for (let x = 0; x < pagePng.width; x += 1) {
          const offset = (y * pagePng.width + x) * 4;
          const black = pagePng.data[offset] < 8 && pagePng.data[offset + 1] < 8
            && pagePng.data[offset + 2] < 8 && pagePng.data[offset + 3] > 240;
          run = black ? run + 1 : 0;
          longestHorizontalRun = Math.max(longestHorizontalRun, run);
        }
      }
      for (let x = 0; x < pagePng.width; x += 1) {
        let run = 0;
        for (let y = 0; y < pagePng.height; y += 1) {
          const offset = (y * pagePng.width + x) * 4;
          const black = pagePng.data[offset] < 8 && pagePng.data[offset + 1] < 8
            && pagePng.data[offset + 2] < 8 && pagePng.data[offset + 3] > 240;
          run = black ? run + 1 : 0;
          longestVerticalRun = Math.max(longestVerticalRun, run);
        }
      }
      expect(longestHorizontalRun).toBeLessThan(pagePng.width * 0.5);
      expect(longestVerticalRun).toBeLessThan(pagePng.height * 0.5);
    };

    await chooseView('2D 视图');
    await assertNoBlackOverlay('2D');
    await chooseView('3D 视图', false);
    await assertNoBlackOverlay('3D');
    const debug = await page.evaluate(() => (window as Window & {
      __knowledgeGraphQaPresentationDebug?: () => {
        graphNodes?: Array<{ id: string }>;
        sceneGroups?: Array<Record<string, unknown>>;
        retainedObjects?: Array<Record<string, unknown>>;
        componentCache?: Array<Record<string, unknown>>;
      };
    }).__knowledgeGraphQaPresentationDebug?.());
    expect(debug?.sceneGroups?.length).toBe(debug?.graphNodes?.length);
    expect(debug?.retainedObjects?.length).toBeGreaterThan(0);
    expect(debug?.retainedObjects?.length).toBe(debug?.graphNodes?.length);
    for (const object of debug?.retainedObjects ?? []) {
      expect(Number(object.objectScale)).toBeLessThanOrEqual(4);
      expect(Number(object.childCount)).toBeGreaterThan(0);
      expect(Number(object.visibleChildren)).toBeGreaterThan(0);
      expect(object.hasBody).toBe(true);
    }
    await expect(page.locator('[data-knowledge-3d-dom-label-layer="true"]')).toBeAttached();
    const persistentLabels = page.locator('[data-knowledge-3d-node-label]');
    expect(await persistentLabels.count()).toBeGreaterThan(0);
    expect(await persistentLabels.count()).toBeLessThanOrEqual(debug?.graphNodes?.length ?? 0);
    await fitCurrentView();
    await page.getByRole('button', { name: '切换到深色模式' }).click();
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: '切换到浅色模式' }).click();
    await page.waitForTimeout(3000);
    await assertNoBlackOverlay('3D');
    await nodeControl(page, leafNode.id).evaluate((control) => (control as HTMLButtonElement).click());
    await page.waitForTimeout(3000);
    const selectedLabel = page.locator(`[data-knowledge-3d-node-label="${leafNode.id}"]`);
    await expect(selectedLabel).toBeVisible();
    expect(Number(await selectedLabel.getAttribute('data-knowledge-screen-font-size'))).toBeGreaterThanOrEqual(12);
    const selectedLabelBox = await selectedLabel.boundingBox();
    const selectedCanvasBox = await page.locator('[data-knowledge-graph-renderer="3D"] canvas').boundingBox();
    expect(selectedLabelBox).not.toBeNull();
    expect(selectedCanvasBox).not.toBeNull();
    const safeTop = viewport.width < 1024 ? 120 : 16;
    const safeBottom = viewport.width < 1024 ? 96 : 72;
    const safeLeft = viewport.width < 1024 ? 16 : 512;
    expect(selectedLabelBox!.x).toBeGreaterThanOrEqual(selectedCanvasBox!.x + safeLeft - 1);
    expect(selectedLabelBox!.x + selectedLabelBox!.width)
      .toBeLessThanOrEqual(selectedCanvasBox!.x + selectedCanvasBox!.width - 16 + 1);
    expect(selectedLabelBox!.y).toBeGreaterThanOrEqual(selectedCanvasBox!.y + safeTop - 1);
    expect(selectedLabelBox!.y + selectedLabelBox!.height)
      .toBeLessThanOrEqual(selectedCanvasBox!.y + selectedCanvasBox!.height - safeBottom + 1);
    if (viewport.width < 1024) {
      await page.getByRole('button', { name: '筛选', exact: true }).click();
      await page.locator('#knowledge-node-filter-search-mobile').fill('叶节点');
      await page.locator('[data-knowledge-mobile-panel-toggle="true"]').click();
    } else {
      await page.locator('[data-knowledge-command-trigger="node-filters"]').click();
      await page.locator('#knowledge-node-filter-search-desktop').fill('叶节点');
    }
    await page.waitForTimeout(3000);
    await expect(selectedLabel).toBeVisible();
    const relationControlOverflow = await page.locator(
      '[data-knowledge-relation-family-control]',
    ).first().evaluate((control) => ({ scrollWidth: control.scrollWidth, clientWidth: control.clientWidth }));
    expect(relationControlOverflow.scrollWidth).toBeLessThanOrEqual(relationControlOverflow.clientWidth);
    const inspector = page.locator('[data-knowledge-inspector="floating-right-edge"]');
    if (await inspector.isVisible().catch(() => false)) {
      await inspector.getByRole('button', { name: '关闭知识节点检查器' }).click();
      await inspector.waitFor({ state: 'hidden' });
    }
    await chooseView('2D 视图');
    await expect(page.locator('[data-knowledge-graph-renderer="3D"] canvas')).toHaveCount(0);
    await expect(page.locator('[data-knowledge-3d-dom-label-layer="true"]')).toHaveCount(0);
    await expect(page.locator('[data-knowledge-graph-renderer="2D"] canvas')).toBeVisible();
    await assertNoBlackOverlay('2D');
  }
});

test('long semantic focus controls stay inside 320 and 390 viewports without covering mobile tools', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 270 : 844 });
    await installGraphRoutes(page);
    await page.goto('/knowledge?qa=semantic-focus-mobile');
    await waitForNodeControls(page);
    const control = nodeControl(page, retryNode.id);
    await control.focus();
    await expect(control).toBeFocused();
    const controlBox = await control.boundingBox();
    const toolsBox = await page.locator('[data-knowledge-mobile-command-surface="single-tool-panel"]').boundingBox();
    expect(controlBox).not.toBeNull();
    expect(toolsBox).not.toBeNull();
    expect(controlBox!.x).toBeGreaterThanOrEqual(0);
    expect(controlBox!.x + controlBox!.width).toBeLessThanOrEqual(width);
    expect(controlBox!.y).toBeGreaterThanOrEqual(0);
    expect(controlBox!.y + controlBox!.height).toBeLessThanOrEqual(width === 320 ? 270 : 844);
    const overlap = controlBox!.x < toolsBox!.x + toolsBox!.width
      && controlBox!.x + controlBox!.width > toolsBox!.x
      && controlBox!.y < toolsBox!.y + toolsBox!.height
      && controlBox!.y + controlBox!.height > toolsBox!.y;
    expect(overlap).toBe(false);
  }
});

test('compact relation family control preserves tri-state keyboard behavior on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const gate = await installGraphRoutes(page);
  await page.goto('/knowledge?qa=relation-family-control');
  await waitForNodeControls(page);

  await activateWithKeyboard(page, expandableNode.id);
  await gate.requested;
  gate.release();
  await expect(nodeControl(page, leafNode.id)).toBeAttached();
  await activateWithKeyboard(page, leafNode.id);
  const inspector = page.locator('[data-knowledge-inspector="floating-right-edge"]');
  await expect(inspector).toBeVisible();

  await expect(page.locator('[data-knowledge-relation-family-control="compact-bottom-left"]')).toHaveCount(0);
  const control = inspector.locator('[data-knowledge-relation-family-control="inspector-header"]');
  const all = control.locator('[data-knowledge-relation-family="all"]');
  const child = control.locator('[data-knowledge-relation-family="child"]');
  const post = control.locator('[data-knowledge-relation-family="post-requisite"]');
  const association = control.locator('[data-knowledge-relation-family="association"]');
  await expect(control).toBeVisible();
  await expect(all).toHaveAttribute('aria-checked', 'mixed');
  await expect(child).toHaveAttribute('aria-checked', 'false');
  await expect(post).toHaveAttribute('aria-checked', 'true');
  await expect(association).toHaveAttribute('aria-checked', 'true');
  await expect(control.locator('[data-knowledge-relation-family-sample]')).toHaveCount(3);

  await child.click();
  await expect(all).toHaveAttribute('aria-checked', 'true');
  await expect(child).toHaveAttribute('aria-checked', 'true');
  await expect(inspector).toBeVisible();
  await child.press('Enter');
  await expect(all).toHaveAttribute('aria-checked', 'mixed');
  await expect(child).toHaveAttribute('aria-checked', 'false');

  await all.focus();
  await page.keyboard.press('Tab');
  await expect(child).toBeFocused();
  await child.press('Space');
  await post.click();
  await association.click();
  await expect(child).toHaveAttribute('aria-checked', 'true');
  await expect(post).toHaveAttribute('aria-checked', 'false');
  await expect(association).toHaveAttribute('aria-checked', 'false');
  await all.click();
  await expect(all).toHaveAttribute('aria-checked', 'true');
  await all.press('Enter');
  await expect(all).toHaveAttribute('aria-checked', 'mixed');
  await expect(child).toHaveAttribute('aria-checked', 'false');
  await expect(post).toHaveAttribute('aria-checked', 'true');
  await expect(association).toHaveAttribute('aria-checked', 'true');
  await expect(inspector).toBeVisible();

  const mobileSurface = page.locator('[data-knowledge-mobile-command-surface="single-tool-panel"]');
  await mobileSurface.getByRole('button', { name: '筛选', exact: true }).click();
  await expect(page.locator('[aria-label="关系族显示"]')).toHaveCount(1);
  await expect(control).toBeVisible();
  const search = mobileSurface.getByRole('textbox', { name: '关键词搜索' });
  await search.fill('不存在的节点');
  await expect(inspector).toBeVisible();
  const toolControl = mobileSurface.locator('[data-knowledge-relation-family-control="tool-panel-header"]');
  await expect(toolControl).toBeVisible();
  await expect(page.locator('[aria-label="关系族显示"]')).toHaveCount(1);
  await expect(toolControl.locator('[data-knowledge-relation-family="all"]')).toHaveAttribute('aria-checked', 'mixed');
  await search.fill('');
  await expect(inspector).toBeVisible();
  await expect(toolControl).toHaveCount(0);
  await expect(page.locator('[aria-label="关系族显示"]')).toHaveCount(1);

  const box = await control.boundingBox();
  const inspectorBox = await inspector.boundingBox();
  expect(box).not.toBeNull();
  expect(inspectorBox).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThanOrEqual(inspectorBox!.y);
  expect(box!.y + box!.height).toBeLessThanOrEqual(inspectorBox!.y + inspectorBox!.height);
});

test('mobile tool panels host the only relation control without blocking directory entries', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const gate = await installGraphRoutes(page);
  await page.goto('/knowledge?qa=relation-family-mobile-tools');
  await waitForNodeControls(page);

  const mobileSurface = page.locator('[data-knowledge-mobile-command-surface="single-tool-panel"]');
  await mobileSurface.getByRole('button', { name: '目录', exact: true }).click();
  const directoryPanel = mobileSurface.locator('[data-knowledge-mobile-tool-panel="chapter-directory"]');
  const toolControl = directoryPanel.locator('[data-knowledge-relation-family-control="tool-panel-header"]');
  await expect(toolControl).toBeVisible();
  await expect(page.locator('[data-knowledge-relation-family-control="compact-bottom-left"]')).toHaveCount(0);
  await expect(page.locator('[aria-label="关系族显示"]')).toHaveCount(1);

  const child = toolControl.locator('[data-knowledge-relation-family="child"]');
  await child.click();
  await expect(child).toHaveAttribute('aria-checked', 'true');
  await child.press('Enter');
  await expect(child).toHaveAttribute('aria-checked', 'false');
  await child.press('Space');
  await expect(child).toHaveAttribute('aria-checked', 'true');

  const directory = directoryPanel.locator('[data-knowledge-local-panel="chapter-directory"]');
  await directory.getByRole('button', { name: /第一章/ }).click();
  const directoryEntry = directory.getByRole('button', { name: /叶节点/ });
  await expect(directoryEntry).toBeVisible();
  const relationBox = await toolControl.boundingBox();
  const entryBox = await directoryEntry.boundingBox();
  expect(relationBox).not.toBeNull();
  expect(entryBox).not.toBeNull();
  expect(relationBox!.y + relationBox!.height).toBeLessThanOrEqual(entryBox!.y);
  await directoryEntry.click();
  await gate.requested;
  gate.release();
  const inspector = page.locator('[data-knowledge-inspector="floating-right-edge"]');
  await expect(inspector).toBeVisible();
  const inspectorClose = page.getByRole('button', { name: '关闭知识节点检查器' });
  await expect(inspectorClose).toHaveAttribute('data-knowledge-inspector-close-priority', 'above-mobile-tools');
  await inspectorClose.focus();
  await inspectorClose.press('Tab');
  expect(await page.evaluate(() => {
    const active = document.activeElement;
    const inspectorElement = document.querySelector('[data-knowledge-inspector="floating-right-edge"]');
    const close = document.querySelector('[aria-label="关闭知识节点检查器"]');
    return active === close || inspectorElement?.contains(active);
  })).toBe(false);
  await inspectorClose.focus();

  const panelToggle = mobileSurface.locator('[data-knowledge-mobile-panel-toggle="true"]');
  await panelToggle.click();
  await expect(directoryPanel).toHaveCount(0);
  await expect(inspectorClose).toHaveAttribute('data-knowledge-inspector-close-priority', 'inline');
  await expect(panelToggle).toBeFocused();
  await panelToggle.click();
  await expect(directoryPanel).toBeVisible();
  await expect(inspectorClose).toHaveAttribute('data-knowledge-inspector-close-priority', 'above-mobile-tools');
  await expect(directoryPanel).toBeFocused();
  expect(await inspectorClose.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit === button || button.contains(hit);
  })).toBe(true);
  await inspectorClose.focus();
  await page.setViewportSize({ width: 1280, height: 844 });
  await expect(inspectorClose).toHaveAttribute('data-knowledge-inspector-close-priority', 'inline');
  await expect(inspectorClose).toBeVisible();
  await expect(inspectorClose).toBeFocused();
  expect(await inspectorClose.evaluate((button) => (
    document.querySelector('[data-knowledge-inspector="floating-right-edge"]')?.contains(button) ?? false
  ))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(inspectorClose).toHaveAttribute('data-knowledge-inspector-close-priority', 'above-mobile-tools');
  await expect(inspectorClose).toBeFocused();
  await inspectorClose.click();
  await expect(inspector).toHaveCount(0);
  await expect(directoryPanel).toBeVisible();
  await directory.getByRole('button', { name: /第一章/ }).click();
  await expect(directory.getByRole('button', { name: /叶节点/ })).toBeVisible();

  const returnAction = page.getByRole('button', { name: '返回全部领域' });
  const domainToolControl = page.locator('[data-knowledge-relation-family-control="tool-panel-header"]');
  await expect(returnAction).toBeVisible();
  await expect(domainToolControl).toBeVisible();
  await expect(directoryPanel).toHaveAttribute('data-knowledge-mobile-tool-return-safe-area', 'reserved');
  const returnBox = await returnAction.boundingBox();
  const domainControlBox = await domainToolControl.boundingBox();
  expect(returnBox).not.toBeNull();
  expect(domainControlBox).not.toBeNull();
  const returnOverlapsControl = returnBox!.x < domainControlBox!.x + domainControlBox!.width
    && returnBox!.x + returnBox!.width > domainControlBox!.x
    && returnBox!.y < domainControlBox!.y + domainControlBox!.height
    && returnBox!.y + returnBox!.height > domainControlBox!.y;
  expect(returnOverlapsControl).toBe(false);

  for (const tool of ['筛选', '视图']) {
    await mobileSurface.getByRole('button', { name: tool, exact: true }).click();
    await expect(page.locator('[data-knowledge-relation-family-control="tool-panel-header"]')).toBeVisible();
    await expect(page.locator('[aria-label="关系族显示"]')).toHaveCount(1);
  }

  await mobileSurface.locator('[data-knowledge-mobile-panel-toggle="true"]').click();
  const canvasControl = page.locator('[data-knowledge-relation-family-control="compact-bottom-left"]');
  await expect(canvasControl).toBeVisible();
  await expect(canvasControl.locator('[data-knowledge-relation-family="child"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[aria-label="关系族显示"]')).toHaveCount(1);
});

test('desktop inspector keeps one canvas relation family control', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const gate = await installGraphRoutes(page);
  await page.goto('/knowledge?qa=relation-family-control-desktop');
  await waitForNodeControls(page);
  await activateWithKeyboard(page, expandableNode.id);
  await gate.requested;
  gate.release();
  await expect(nodeControl(page, leafNode.id)).toBeAttached();
  await activateWithKeyboard(page, leafNode.id);

  await expect(page.locator('[data-knowledge-inspector="floating-right-edge"]')).toBeVisible();
  await expect(page.locator('[data-knowledge-relation-family-control="compact-bottom-left"]')).toBeVisible();
  await expect(page.locator('[data-knowledge-relation-family-control="inspector-header"]')).toHaveCount(0);
  await expect(page.locator('[aria-label="关系族显示"]')).toHaveCount(1);
  await page.getByRole('button', { name: '关闭知识节点检查器' }).click();
  await expect(page.locator('[data-knowledge-inspector="floating-right-edge"]')).toHaveCount(0);
  await expect(page.locator('[data-knowledge-relation-family-control="compact-bottom-left"]')).toBeVisible();
  await expect(page.locator('[aria-label="关系族显示"]')).toHaveCount(1);
});

test('3D auto fit waits for domain readiness and keeps the parent manipulation lock across remount', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const gate = await installGraphRoutes(page, { denseDomain: true });
  await page.goto('/knowledge?qa=task-42-webgl-acceptance');
  await waitForNodeControls(page);
  await activateWithKeyboard(page, expandableNode.id);
  await gate.requested;

  const viewPanel = page.locator('[data-knowledge-desktop-tool-panel="view-layout"]');
  await page.locator('[data-knowledge-command-trigger="view-layout"]').click();
  await viewPanel.getByRole('button', { name: '3D 视图' }).click();
  let renderer = page.locator('[data-knowledge-graph-renderer="3D"]');
  await expect(renderer).toHaveAttribute('data-knowledge-auto-fit-count', '0');
  await page.waitForTimeout(500);
  await expect(renderer).toHaveAttribute('data-knowledge-auto-fit-count', '0');

  gate.release();
  await expect(nodeControl(page, leafNode.id)).toBeAttached();
  await expect(renderer).toHaveAttribute('data-knowledge-auto-fit-count', '1');
  await expect(renderer.locator('[data-knowledge-3d-node-label]').first()).toBeVisible();

  const canvas = renderer.locator('canvas');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  const x = canvasBox!.x + canvasBox!.width * 0.72;
  const y = canvasBox!.y + canvasBox!.height * 0.58;
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(x - 80, y + 35, { steps: 8 });
  await page.mouse.up({ button: 'left' });
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x + 55, y + 25, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -300);
  await expect(renderer).toHaveAttribute('data-knowledge-camera-manipulated', 'true');
  await page.waitForTimeout(250);
  const readPose = () => page.evaluate((nodeId) => {
    const value = (window as Window & {
      __knowledgeGraphQaNodeDebug?: (id: string) => Array<Record<string, number | null>>;
    }).__knowledgeGraphQaNodeDebug?.(nodeId)?.[0];
    return value ? {
      cameraX: Number(value.cameraX), cameraY: Number(value.cameraY), cameraZ: Number(value.cameraZ),
      targetX: Number(value.targetX), targetY: Number(value.targetY), targetZ: Number(value.targetZ),
      screenX: Number(value.screenX), screenY: Number(value.screenY),
    } : null;
  }, expandableNode.id);
  const expectPoseClose = (actual: Awaited<ReturnType<typeof readPose>>, expected: NonNullable<Awaited<ReturnType<typeof readPose>>>) => {
    expect(actual).not.toBeNull();
    for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
      expect(Math.abs(actual![key] - expected[key]), key).toBeLessThan(3);
    }
  };
  const waitForStablePose = async () => {
    let previous: Awaited<ReturnType<typeof readPose>> = null;
    let stableSamples = 0;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await page.waitForTimeout(100);
      const current = await readPose();
      if (current && previous) {
        const maximumDelta = Math.max(...(
          Object.keys(current) as Array<keyof typeof current>
        ).map((key) => Math.abs(current[key] - previous![key])));
        stableSamples = maximumDelta < 0.5 ? stableSamples + 1 : 0;
        if (stableSamples >= 2) return current;
      }
      previous = current;
    }
    throw new Error('3D camera pose did not settle before remount verification.');
  };
  const manipulatedPose = await waitForStablePose();
  expect(manipulatedPose).not.toBeNull();

  await viewPanel.getByRole('button', { name: '2D 视图' }).click();
  await viewPanel.getByRole('button', { name: '3D 视图' }).click();
  renderer = page.locator('[data-knowledge-graph-renderer="3D"]');
  await expect(renderer).toHaveAttribute('data-knowledge-camera-manipulated', 'true');
  await expect(renderer).toHaveAttribute('data-knowledge-auto-fit-count', '0');
  await page.waitForTimeout(500);
  await expect(renderer).toHaveAttribute('data-knowledge-auto-fit-count', '0');
  const restoredPoseContract = JSON.parse(
    await renderer.getAttribute('data-knowledge-restored-camera-pose') ?? 'null',
  ) as { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; up: { x: number; y: number; z: number } } | null;
  expect(restoredPoseContract).not.toBeNull();
  expect(Math.abs(restoredPoseContract!.position.x - manipulatedPose!.cameraX)).toBeLessThan(3);
  expectPoseClose(await readPose(), manipulatedPose!);

  await viewPanel.locator('[data-knowledge-layout-control="fit-view"]').click();
  await expect(renderer).toHaveAttribute('data-knowledge-explicit-fit-count', '1');
  await expect(renderer).toHaveAttribute('data-knowledge-camera-manipulated', 'true');
  await page.waitForTimeout(250);
  const fittedPose = await readPose();
  expect(fittedPose).not.toBeNull();
  await viewPanel.getByRole('button', { name: '2D 视图' }).click();
  await viewPanel.getByRole('button', { name: '3D 视图' }).click();
  renderer = page.locator('[data-knowledge-graph-renderer="3D"]');
  await page.waitForTimeout(250);
  expectPoseClose(await readPose(), fittedPose!);
  await expect(renderer).toHaveAttribute('data-knowledge-auto-fit-count', '0');

  await page.getByRole('button', { name: '返回全部领域' }).click();
  await expect(nodeControl(page, retryNode.id)).toBeAttached();
  await activateWithKeyboard(page, retryNode.id);
  await expect(page.locator('[data-knowledge-domain-retry="true"]')).toBeVisible();
  await page.locator('[data-knowledge-domain-retry="true"]').click();
  await expect(page.locator('[data-knowledge-canvas-primary="true"]')).toHaveAttribute('data-knowledge-domain-state', 'filtered-empty');
  await expect(renderer).toHaveAttribute('data-knowledge-auto-fit-count', '1');
});

test('mobile view panel stays operable above a non-modal inspector without clearing selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const gate = await installGraphRoutes(page);
  await page.goto('/knowledge?qa=task-42-webgl-acceptance');
  await waitForNodeControls(page);
  await activateWithKeyboard(page, expandableNode.id);
  await gate.requested;
  gate.release();
  await expect(nodeControl(page, leafNode.id)).toBeAttached();
  await activateWithKeyboard(page, leafNode.id);

  const canvasShell = page.locator('[data-knowledge-canvas-primary="true"]');
  const inspector = page.locator('[data-knowledge-inspector="floating-right-edge"]');
  await expect(inspector).toBeVisible();
  await expect(canvasShell).toHaveAttribute('data-knowledge-selected-node-id', leafNode.id);

  const mobileSurface = page.locator('[data-knowledge-mobile-command-surface="single-tool-panel"]');
  await mobileSurface.getByRole('button', { name: '视图', exact: true }).click();
  const panel = mobileSurface.locator('[data-knowledge-mobile-tool-panel="view-layout"]');
  await expect(panel).toBeVisible();
  const layers = await page.evaluate(() => ({
    panel: Number.parseInt(getComputedStyle(document.querySelector<HTMLElement>('[data-knowledge-mobile-command-surface]')!).zIndex, 10),
    inspector: Number.parseInt(getComputedStyle(document.querySelector<HTMLElement>('[data-knowledge-inspector="floating-right-edge"]')!).zIndex, 10),
  }));
  expect(layers.panel).toBeGreaterThan(layers.inspector);
  await expect(page.locator('[aria-label="关系族显示"]')).toHaveCount(1);

  await panel.getByRole('button', { name: '3D 视图' }).click();
  const fitButton = panel.locator('[data-knowledge-layout-control="fit-view"]');
  const fitRequestBefore = Number(await canvasShell.getAttribute('data-knowledge-fit-request-id'));
  await fitButton.click();
  await expect(canvasShell).toHaveAttribute('data-knowledge-fit-request-id', String(fitRequestBefore + 1));
  await expect(inspector).toBeVisible();
  await expect(canvasShell).toHaveAttribute('data-knowledge-selected-node-id', leafNode.id);

  const toggle = mobileSurface.locator('[data-knowledge-mobile-panel-toggle="true"]');
  await toggle.click();
  await expect(panel).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(inspector).toBeVisible();
  await expect(canvasShell).toHaveAttribute('data-knowledge-selected-node-id', leafNode.id);
  await expect(page.locator('[aria-label="关系族显示"]')).toHaveCount(1);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
test(`3D orbit rotation, pan, and wheel update camera and projected nodes at ${viewport.width}x${viewport.height}`, async ({ page }) => {
  test.setTimeout(60_000);
  const readDebug = () => page.evaluate((nodeId) => {
    const debug = (window as Window & {
      __knowledgeGraphQaNodeDebug?: (id: string) => Array<Record<string, number | null>>;
    }).__knowledgeGraphQaNodeDebug?.(nodeId);
    return debug?.[0] ?? null;
  }, expandableNode.id);
  const waitForDebug = async () => {
    const handle = await page.waitForFunction((nodeId) => {
      const debug = (window as Window & {
        __knowledgeGraphQaNodeDebug?: (id: string) => Array<Record<string, number | null>>;
      }).__knowledgeGraphQaNodeDebug?.(nodeId);
      return debug?.[0] ?? false;
    }, expandableNode.id);
    const value = await handle.jsonValue() as Record<string, number | null>;
    await handle.dispose();
    return value;
  };
  const assertRenderedLabelsInFrustum = async () => {
    const labels = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-knowledge-3d-node-label]')]
      .map((label) => label.getAttribute('data-knowledge-3d-node-label'))
      .filter((id): id is string => Boolean(id))
      .map((id) => ({
        id,
        debug: (window as Window & {
          __knowledgeGraphQaNodeDebug?: (nodeId: string) => Array<Record<string, number | null>>;
        }).__knowledgeGraphQaNodeDebug?.(id)?.[0] ?? null,
      })));
    for (const label of labels) {
      expect(label.debug, label.id).not.toBeNull();
      expect(label.debug?.isInFrustum, label.id).toBe(1);
      expect(Number(label.debug?.depth), label.id).toBeGreaterThan(0);
    }
  };
    await page.setViewportSize(viewport);
    await installGraphRoutes(page);
    await page.goto('/knowledge?qa=three-orbit-controls');
    await waitForNodeControls(page);
    if (viewport.width < 1024) {
      await page.getByRole('button', { name: '视图', exact: true }).click();
      await page.locator('[data-knowledge-mobile-tool-panel="view-layout"]')
        .getByRole('button', { name: '3D 视图' }).click();
      await page.locator('[data-knowledge-mobile-panel-toggle="true"]').click();
    } else {
      await page.locator('[data-knowledge-command-trigger="view-layout"]').click();
      await page.locator('[data-knowledge-desktop-tool-panel="view-layout"]')
        .getByRole('button', { name: '3D 视图' }).click();
    }
    const canvas = page.locator('[data-knowledge-graph-renderer="3D"] canvas');
    await canvas.waitFor({ state: 'visible' });
    await nodeControl(page, expandableNode.id).evaluate((control) => (control as HTMLButtonElement).click());
    await expect(page.locator(`[data-knowledge-3d-node-label="${expandableNode.id}"]`)).toBeVisible();
    await page.waitForTimeout(750);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width * (viewport.width >= 1024 ? 0.92 : 0.76);
    const y = box!.y + box!.height * (viewport.width >= 1024 ? 0.82 : 0.62);
    const before = await waitForDebug();
    await page.mouse.move(x, y);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(x - 90, y + 45, { steps: 8 });
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(120);
    const rotated = await readDebug();
    expect(rotated).not.toBeNull();
    expect([rotated!.cameraX, rotated!.cameraY, rotated!.cameraZ]).not.toEqual([
      before!.cameraX, before!.cameraY, before!.cameraZ,
    ]);
    expect([rotated!.screenX, rotated!.screenY]).not.toEqual([before!.screenX, before!.screenY]);
    await assertRenderedLabelsInFrustum();

    const panX = x;
    const panY = y;
    const panTarget = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return {
        tagName: element?.tagName ?? null,
        renderer: element?.closest('[data-knowledge-graph-renderer]')
          ?.getAttribute('data-knowledge-graph-renderer') ?? null,
      };
    }, { x: panX, y: panY });
    expect(panTarget).toEqual({ tagName: 'CANVAS', renderer: '3D' });
    expect({
      enablePan: rotated!.enablePan,
      rightMouseAction: rotated!.rightMouseAction,
    }).toEqual({ enablePan: 1, rightMouseAction: 2 });
    await page.mouse.move(panX, panY);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(panX + 70, panY + 35, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(120);
    const panned = await readDebug();
    expect(
      [panned!.targetX, panned!.targetY, panned!.targetZ],
      JSON.stringify({ rotated, panned }),
    ).not.toEqual([
      rotated!.targetX, rotated!.targetY, rotated!.targetZ,
    ]);
    await assertRenderedLabelsInFrustum();

    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(120);
    const zoomed = await readDebug();
    expect([zoomed!.cameraX, zoomed!.cameraY, zoomed!.cameraZ]).not.toEqual([
      panned!.cameraX, panned!.cameraY, panned!.cameraZ,
    ]);
    await assertRenderedLabelsInFrustum();
});
}
