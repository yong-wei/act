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
  const dimensions = await control.evaluate((element) => {
    const button = element as HTMLElement;
    return {
      width: button.offsetWidth,
      height: button.offsetHeight,
      horizontal: button.scrollWidth <= button.clientWidth,
      vertical: button.scrollHeight <= button.clientHeight,
    };
  });
  expect(dimensions.width, `${state} width`).toBeGreaterThanOrEqual(44);
  expect(dimensions.height, `${state} height`).toBeGreaterThanOrEqual(44);
  expect(dimensions.horizontal, `${state} horizontal label fit`).toBe(true);
  expect(dimensions.vertical, `${state} vertical label fit`).toBe(true);
}

async function waitForFocusAnimationFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  }));
}

async function expectControlWithinViewport(page: Page) {
  const viewport = await page.locator('#knowledge-graph-canvas').boundingBox();
  const control = await page.locator('[data-knowledge-node-expansion-control]').boundingBox();
  expect(viewport).not.toBeNull();
  expect(control).not.toBeNull();
  const epsilon = 0.5;
  expect(control!.x).toBeGreaterThanOrEqual(viewport!.x + 8 - epsilon);
  expect(control!.y).toBeGreaterThanOrEqual(viewport!.y + 8 - epsilon);
  expect(control!.x + control!.width).toBeLessThanOrEqual(viewport!.x + viewport!.width - 8 + epsilon);
  expect(control!.y + control!.height).toBeLessThanOrEqual(viewport!.y + viewport!.height - 8 + epsilon);
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
  await waitForFocusAnimationFrame(page);
  expect(expansionA.requestCount()).toBe(1);

  const nodeBButton = await selectNodeFromDirectory(page, '第二章', nodeB.name);
  await expect(control).toHaveAttribute('data-anchor-node-id', nodeB.id);
  await expectSameControl(page);
  const expansionAResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.searchParams.get('mode') === 'expansion'
      && url.searchParams.get('nodeId') === nodeA.id;
  });
  expansionA.release();
  await expansionAResponse;
  await waitForFocusAnimationFrame(page);
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
  const expansionA = await installGraphRoutes(page);
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
  await expect(control).toBeVisible();
  await expectControlWithinViewport(page);
  await expectSameControl(page);
  await control.click();
  await expansionA.requested;
  expansionA.release();
  await expect(control).toHaveAttribute('data-state', 'expanded');
  await expect(control).toHaveAttribute('aria-expanded', 'true');
  await expectControlWithinViewport(page);
  await viewPanel.getByRole('button', { name: '2D 视图' }).click();
  await expect(control).toHaveAttribute('data-view-mode', '2D');
  await expect(control).toHaveAttribute('data-state', 'expanded');
  await expect(control).toBeVisible();
  await expectSameControl(page);
});

test('mobile keyboard expansion restores focus after the inspector closes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const expansion = await installGraphRoutes(page);
  await page.goto(`/knowledge?node=${encodeURIComponent(nodeA.id)}&qa=knowledge-product`);

  const inspector = page.locator('[data-knowledge-inspector]');
  const canvas = page.locator('[data-knowledge-canvas-primary="true"]');
  const control = page.locator('[data-knowledge-node-expansion-control]');
  await expect(inspector).toBeVisible();
  await expect(page.getByRole('button', { name: '关闭知识节点检查器' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(inspector).toBeHidden();
  await expect(canvas).toBeFocused();
  await page.evaluate(() => {
    (window as Window & { __issue894Control?: Element }).__issue894Control =
      document.querySelector('[data-knowledge-node-expansion-control]') ?? undefined;
  });

  for (let index = 0; index < 12; index += 1) {
    if (await control.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(control).toBeFocused();
  await page.keyboard.press('Enter');
  await expansion.requested;
  await expect(control).toHaveAttribute('aria-busy', 'true');
  expansion.release();
  await expect(control).toHaveAttribute('data-state', 'expanded');
  await expectSameControl(page);
  await waitForFocusAnimationFrame(page);
  await expect(control).toBeFocused();
  await expect.poll(() => control.evaluate((element) => element.matches(':focus-visible'))).toBe(true);

  await page.locator('[data-knowledge-mobile-command-surface] button').filter({ hasText: '筛选' }).click();
  const mobilePanel = page.locator('[data-knowledge-mobile-tool-panel="relation-filters"]');
  await expect(mobilePanel).toBeVisible();
  await expect(page.locator('[data-knowledge-expansion-panel="selected-node"]')).toBeHidden();
  await expect.poll(async () => {
    const [controlRect, panelRect] = await Promise.all([
      control.boundingBox(),
      mobilePanel.boundingBox(),
    ]);
    if (!controlRect || !panelRect) return false;
    return controlRect.x + controlRect.width <= panelRect.x
      || panelRect.x + panelRect.width <= controlRect.x
      || controlRect.y + controlRect.height <= panelRect.y
      || panelRect.y + panelRect.height <= controlRect.y;
  }).toBe(true);
});

test('async expansion does not steal focus after the user tabs away', async ({ page }) => {
  test.setTimeout(20_000);
  await page.setViewportSize({ width: 1440, height: 960 });
  const expansion = await installGraphRoutes(page);
  await page.goto(`/knowledge?node=${encodeURIComponent(nodeA.id)}&qa=knowledge-product`);
  const control = page.locator('[data-knowledge-node-expansion-control]');
  await page.getByRole('button', { name: '关闭知识节点检查器' }).click();
  await expect(page.locator('[data-knowledge-inspector]')).toBeHidden();
  await control.focus();
  await expect(control).toBeFocused();
  await page.keyboard.press('Enter');
  await expansion.requested;
  await expect(control).toHaveAttribute('aria-busy', 'true');
  await page.keyboard.press('Tab');
  await page.evaluate(() => {
    (window as Window & { __issue894UserFocus?: Element }).__issue894UserFocus = document.activeElement ?? undefined;
  });
  expansion.release();
  await expect(control).toHaveAttribute('data-state', 'expanded');
  await waitForFocusAnimationFrame(page);
  await expect.poll(() => page.evaluate(() => (
    document.activeElement === (window as Window & { __issue894UserFocus?: Element }).__issue894UserFocus
  ))).toBe(true);
  await expect(control).not.toBeFocused();
});
