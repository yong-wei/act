import { expect, test, type Page, type Route } from '@playwright/test';

type ExpansionGate = {
  release: () => void;
  requested: Promise<void>;
  requestCount: () => number;
};

const graphVersion = 'issue-894-browser-v1';
const nodeA = {
  id: 'chapter-node:第一章',
  name: '节点 A',
  nodeType: 'THEORY',
  description: '第一章根节点',
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  chapter: 1,
  chapterName: '第一章',
  metadata: { isVirtualChapter: true, chapterName: '第一章' },
};
const nodeB = {
  id: 'chapter-node:第二章',
  name: '节点 B',
  nodeType: 'THEORY',
  description: '第二章根节点',
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  chapter: 2,
  chapterName: '第二章',
  metadata: { isVirtualChapter: true, chapterName: '第二章' },
};
const childA = {
  id: 'node-a-child',
  name: '节点 A 子节点',
  nodeType: 'THEORY',
  description: '第一章展开子节点',
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  chapter: 1,
  chapterName: '第一章',
};
const linkA = {
  id: 'link-a-child',
  sourceId: nodeA.id,
  targetId: childA.id,
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
  const expansionA = deferred();
  const expansionARequested = deferred();
  let expansionACount = 0;
  let expansionBAttempts = 0;

  await page.route('**/api/knowledge/graph?*', async (route: Route) => {
    const url = new URL(route.request().url());
    const mode = url.searchParams.get('mode');
    const nodeId = url.searchParams.get('nodeId');

    if (mode === 'expansion' && nodeId === nodeA.id) {
      expansionACount += 1;
      expansionARequested.release();
      await expansionA.promise;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode,
          graphVersion,
          shardKey: `${graphVersion}:shard:expansion:${nodeA.id}`,
          nodes: [nodeA, childA],
          links: [linkA],
          source: 'file',
        }),
      });
      return;
    }

    if (mode === 'expansion' && nodeId === nodeB.id) {
      expansionBAttempts += 1;
      if (expansionBAttempts === 1) {
        await route.fulfill({ status: 503, body: 'temporary failure' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode,
          graphVersion,
          shardKey: `${graphVersion}:shard:expansion:${nodeB.id}`,
          nodes: [nodeB],
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
        nodes: [nodeA, nodeB],
        links: [],
        source: 'file',
      }),
    });
  });

  return {
    release: expansionA.release,
    requested: expansionARequested.promise,
    requestCount: () => expansionACount,
  };
}

async function selectNodeFromDirectory(page: Page, chapterName: string, nodeName: string) {
  const panel = page.locator('[data-knowledge-desktop-tool-panel="chapter-directory"]');
  if (!await panel.isVisible()) {
    await page.locator(`[data-knowledge-command-trigger="chapter-directory"]`).click();
  }
  await panel.getByRole('button', { name: new RegExp(chapterName) }).first().click();
  const nodeButton = panel.getByRole('button', { name: nodeName, exact: true });
  await nodeButton.click();
  return nodeButton;
}

async function expectSameControl(page: Page) {
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __issue894Control?: Element }).__issue894Control
      === document.querySelector('[data-knowledge-node-expansion-control]')
  ))).toBe(true);
}

async function expectControlSize(page: Page, state: string) {
  const control = page.locator('[data-knowledge-node-expansion-control]');
  await expect(control).toHaveAttribute('data-state', state);
  const box = await control.boundingBox();
  expect(box, `${state} control must have a layout box`).not.toBeNull();
  expect(box!.width, `${state} width`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${state} height`).toBeGreaterThanOrEqual(44);
  const contentFits = await control.evaluate((button) => ({
    horizontal: button.scrollWidth <= button.clientWidth,
    vertical: button.scrollHeight <= button.clientHeight,
  }));
  expect(contentFits, `${state} label must fit its measured control`).toEqual({
    horizontal: true,
    vertical: true,
  });
}

test('node-local control keeps one real button through async, error, unavailable, and selection states', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1280, height: 820 });
  const expansionA = await installGraphRoutes(page);

  await page.goto(`/knowledge?node=${encodeURIComponent(nodeA.id)}&qa=knowledge-product`);
  const control = page.locator('[data-knowledge-node-expansion-control]');
  await expect(control).toBeVisible();
  await page.evaluate(() => {
    (window as Window & { __issue894Control?: Element }).__issue894Control =
      document.querySelector('[data-knowledge-node-expansion-control]') ?? undefined;
  });

  await expectControlSize(page, 'collapsed');
  await expect(control).toHaveAttribute('aria-expanded', 'false');
  await expect(control).toHaveAttribute('aria-busy', 'false');
  await expect(control).toHaveAttribute('aria-disabled', 'false');
  await expect(control).toHaveAttribute('aria-controls', 'knowledge-graph-canvas');
  await expect(control).toHaveAttribute('aria-describedby', 'knowledge-node-expansion-local-status');
  await control.click();
  await expansionA.requested;
  await expectControlSize(page, 'loading');
  await expect(control).toHaveAttribute('aria-busy', 'true');
  await expect(control).toHaveAttribute('aria-disabled', 'true');
  await expectSameControl(page);

  await control.dispatchEvent('click');
  await control.press('Enter');
  await page.waitForTimeout(100);
  expect(expansionA.requestCount()).toBe(1);

  const nodeBButton = await selectNodeFromDirectory(page, '第二章', nodeB.name);
  await expect(control).toHaveAttribute('data-anchor-node-id', nodeB.id);
  await expectSameControl(page);
  expansionA.release();
  await page.waitForTimeout(100);
  await expect(nodeBButton).toBeFocused();
  await expect(control).not.toBeFocused();

  await control.click();
  await expectControlSize(page, 'error');
  await expect(control).toHaveAttribute('aria-disabled', 'false');
  await expect(control).toHaveAccessibleName(`重试 ${nodeB.name}`);
  await expectSameControl(page);

  await control.focus();
  await control.press('Space');
  await expectControlSize(page, 'unavailable');
  await expect(control).toHaveAttribute('aria-disabled', 'true');
  await expectSameControl(page);

  await selectNodeFromDirectory(page, '第一章', nodeA.name);
  await expectControlSize(page, 'expanded');
  await expect(control).toHaveAttribute('aria-expanded', 'true');
  await expectSameControl(page);
  await control.press('Enter');
  await expectControlSize(page, 'collapsed');
  expect(expansionA.requestCount()).toBe(1);
});

test('node-local control remains the same projected button through 2D and 3D mode switches', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1280, height: 820 });
  await installGraphRoutes(page);
  await page.goto(`/knowledge?node=${encodeURIComponent(nodeA.id)}&qa=knowledge-product`);
  const control = page.locator('[data-knowledge-node-expansion-control]');
  await expect(control).toBeVisible();
  await page.evaluate(() => {
    (window as Window & { __issue894Control?: Element }).__issue894Control =
      document.querySelector('[data-knowledge-node-expansion-control]') ?? undefined;
  });

  await page.locator('[data-knowledge-command-trigger="view-layout"]').click();
  const viewPanel = page.locator('[data-knowledge-desktop-tool-panel="view-layout"]');
  await viewPanel.getByRole('button', { name: '3D 视图' }).click();
  await expect(control).toHaveAttribute('data-view-mode', '3D');
  await expectSameControl(page);
  await viewPanel.getByRole('button', { name: '2D 视图' }).click();
  await expect(control).toHaveAttribute('data-view-mode', '2D');
  await expect(control).toBeVisible();
  await expectSameControl(page);
});
