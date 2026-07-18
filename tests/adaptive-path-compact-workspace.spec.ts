import { expect, test, type Page } from '@playwright/test';

const executionHref = '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution';
const expectedDemoPathTitle = '控制系统校正设计学习路径';
const expectedDemoNodeIds = ['demo-foundation-card', 'demo-current-quiz', 'demo-simulation'] as const;

async function openModule(page: Page, moduleId: 'current-path' | 'learning-record') {
  const moduleElement = page.locator(`[data-adaptive-path-module="${moduleId}"]`);
  await expect(moduleElement).toBeVisible();
  if (await moduleElement.getAttribute('data-adaptive-path-module-state') !== 'expanded') {
    await moduleElement.getByRole('button').first().click();
  }
  await expect(moduleElement).toHaveAttribute('data-adaptive-path-module-state', 'expanded');
  return moduleElement;
}

async function expectNoHorizontalOverflow(page: Page, moduleId: 'current-path' | 'learning-record') {
  const moduleElement = await openModule(page, moduleId);
  const metrics = await moduleElement.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      moduleLeft: rect.left,
      moduleRight: rect.right,
      moduleWidth: rect.width,
      viewportWidth: window.innerWidth,
    };
  });
  expect(metrics.documentScrollWidth).toBe(metrics.documentClientWidth);
  expect(metrics.moduleLeft).toBeGreaterThanOrEqual(0);
  expect(metrics.moduleRight).toBeLessThanOrEqual(metrics.viewportWidth);
  const minimumUsableWidth = metrics.viewportWidth <= 375
    ? metrics.viewportWidth - 56
    : metrics.viewportWidth - 160;
  expect(metrics.moduleWidth).toBeGreaterThanOrEqual(minimumUsableWidth);
}

async function expectReadableFocusedNode(page: Page) {
  const currentNode = page.locator('[data-adaptive-path-node-state="current"]').first();
  const title = currentNode.locator('[data-adaptive-path-node-title]');
  const badge = currentNode.locator('[data-adaptive-path-node-status-badge]');
  const detail = currentNode.locator('[data-adaptive-path-node-detail="inline"]');
  const actions = detail.locator('[data-adaptive-path-node-actions="attached"]');

  await expect(title).toBeVisible();
  await expect(badge).toBeVisible();
  await expect(detail).toBeVisible();
  await expect(actions).toBeVisible();
  await title.evaluate((element) => {
    element.textContent = '完成一个用于验证频域到时域映射与校正结果的长标题学习节点';
  });

  const metrics = await currentNode.evaluate((element) => {
    const titleElement = element.querySelector<HTMLElement>('[data-adaptive-path-node-title]')!;
    const badgeElement = element.querySelector<HTMLElement>('[data-adaptive-path-node-status-badge]')!;
    const detailElement = element.querySelector<HTMLElement>('[data-adaptive-path-node-detail="inline"]')!;
    const actionsElement = element.querySelector<HTMLElement>('[data-adaptive-path-node-actions="attached"]')!;
    const titleRect = titleElement.getBoundingClientRect();
    const badgeRect = badgeElement.getBoundingClientRect();
    const detailRect = detailElement.getBoundingClientRect();
    const actionsRect = actionsElement.getBoundingClientRect();
    const lineHeight = Number.parseFloat(getComputedStyle(titleElement).lineHeight);
    return {
      titleWidth: titleRect.width,
      titleHeight: titleRect.height,
      titleLineHeight: lineHeight,
      badgeRight: badgeRect.right,
      detailClientWidth: detailElement.clientWidth,
      detailScrollWidth: detailElement.scrollWidth,
      detailRight: detailRect.right,
      actionsClientWidth: actionsElement.clientWidth,
      actionsScrollWidth: actionsElement.scrollWidth,
      actionsRight: actionsRect.right,
      viewportWidth: window.innerWidth,
    };
  });
  expect(metrics.titleWidth).toBeGreaterThanOrEqual(96);
  expect(metrics.titleHeight).toBeLessThanOrEqual(metrics.titleLineHeight * 6);
  expect(metrics.badgeRight).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.detailScrollWidth).toBeLessThanOrEqual(metrics.detailClientWidth);
  expect(metrics.detailRight).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.actionsScrollWidth).toBeLessThanOrEqual(metrics.actionsClientWidth);
  expect(metrics.actionsRight).toBeLessThanOrEqual(metrics.viewportWidth);
}

test('compact path execution modules remain inside 320px, 375px, and desktop viewports', async ({ page }) => {
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(executionHref, { waitUntil: 'networkidle' });
    const executionSurface = page.locator('[data-adaptive-path-execution-surface="active-route"]');
    await expect(executionSurface).toBeVisible();
    await expect(executionSurface).toContainText(expectedDemoPathTitle);
    await expect(executionSurface.locator('[data-adaptive-path-node]')).toHaveCount(expectedDemoNodeIds.length);
    for (const nodeId of expectedDemoNodeIds) {
      await expect(executionSurface.locator(`[data-adaptive-path-node="${nodeId}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-adaptive-practice-resource="path-node"]')).toHaveCount(1);
    await expect(page.locator('[data-adaptive-path-dock-collision-policy="avoid-learning-record"]')).toBeVisible();

    await expectNoHorizontalOverflow(page, 'current-path');
    await expectReadableFocusedNode(page);
    await expectNoHorizontalOverflow(page, 'learning-record');
  }
});
