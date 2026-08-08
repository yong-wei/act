import { expect, test } from '@playwright/test';

const executionHref = '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution';

for (const width of [1440, 320] as const) {
  test(`node decisions remain usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 900 });
    await page.goto(`${executionHref}&nodeDecisionFixture=locked`, { waitUntil: 'domcontentloaded' });

    const execution = page.locator('[data-adaptive-path-execution-surface="active-route"]');
    const timeline = execution.locator('[data-adaptive-path-route-map="compact"]');
    const currentNode = timeline.locator('[data-adaptive-path-node="demo-current-quiz"]');
    await execution.waitFor({ state: 'visible' });
    await currentNode.waitFor({ state: 'visible' });
    const initialGeometry = await page.evaluate(() => {
      const executionSurface = document.querySelector('[data-adaptive-path-execution-surface="active-route"]');
      const current = document.querySelector('[data-adaptive-path-node="demo-current-quiz"]');
      return [executionSurface, current].map((element) => {
        const rect = element?.getBoundingClientRect();
        return rect ? { top: rect.top, bottom: rect.bottom } : null;
      });
    });
    expect(initialGeometry.every((rect) => rect && rect.top < (width === 1440 ? 1000 : 900) && rect.bottom > 0)).toBe(true);
    await currentNode.locator('[data-adaptive-path-node-selectable="true"]').click();
    await expect(currentNode.locator('[data-adaptive-path-node-selection-basis="recorded"]')).toContainText('入选依据');
    await expect(currentNode.locator('[data-adaptive-path-node-latest-adjustment="none"]')).toContainText('最近调整');
    await expect(currentNode.locator('[data-adaptive-path-node-actions="attached"]')).toBeVisible();

    const lockedNode = timeline.locator('[data-adaptive-path-node="demo-simulation"]');
    await expect(lockedNode.locator('[data-adaptive-path-node-status-badge="blocked"]')).toBeVisible();
    await lockedNode.locator('[data-adaptive-path-node-selectable="true"]').click();
    await expect(lockedNode.locator('[data-adaptive-path-node-current-lock="governed"]')).toContainText(
      '完成检查题后会自动解锁仿真验证。',
    );
    await expect(lockedNode.locator('[data-adaptive-path-node-selection-basis="recorded"]')).toBeVisible();

    const geometry = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      decisionRects: Array.from(document.querySelectorAll<HTMLElement>(
        '[data-adaptive-path-node-selection-basis], [data-adaptive-path-node-latest-adjustment], [data-adaptive-path-node-current-lock]',
      )).map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
      }),
    }));
    expect(geometry.documentScrollWidth).toBe(geometry.documentClientWidth);
    for (const rect of geometry.decisionRects) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(rect.scrollWidth).toBeLessThanOrEqual(rect.clientWidth);
    }

    await page.screenshot({ path: testInfo.outputPath(`node-decisions-${width}.png`), fullPage: false });
  });
}

test('legacy, completed, and skipped nodes keep explicit decision states', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`${executionHref}&provenanceFixture=legacy`, { waitUntil: 'domcontentloaded' });

  let timeline = page.locator('[data-adaptive-path-route-map="compact"]');
  const currentNode = timeline.locator('[data-adaptive-path-node="demo-current-quiz"]');
  await currentNode.locator('[data-adaptive-path-node-selectable="true"]').click();
  await expect(currentNode.locator('[data-adaptive-path-node-selection-basis="unavailable"]')).toContainText(
    '该路径生成时尚未记录节点级入选依据',
  );

  const completedNode = timeline.locator('[data-adaptive-path-node="demo-foundation-card"]');
  await completedNode.locator('[data-adaptive-path-node-selectable="true"]').click();
  await expect(completedNode).toContainText('已完成');
  await expect(completedNode.locator('[data-adaptive-path-node-selection-basis="unavailable"]')).toBeVisible();

  await page.goto(executionHref, { waitUntil: 'domcontentloaded' });
  timeline = page.locator('[data-adaptive-path-route-map="compact"]');
  const skippedNode = timeline.locator('[data-adaptive-path-node="demo-simulation"]');
  await skippedNode.locator('[data-adaptive-path-node-selectable="true"]').click();
  await expect(skippedNode).toContainText('已跳过');
  await expect(skippedNode.locator('[data-adaptive-path-node-selection-basis="recorded"]')).toBeVisible();
  await expect(skippedNode.locator('[data-adaptive-path-node-current-lock="governed"]')).toHaveCount(0);
});
