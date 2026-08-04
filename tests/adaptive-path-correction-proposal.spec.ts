import { expect, test } from '@playwright/test';

const journey = {
  path: { id: 'path-correction-1', title: '控制系统校正学习路径' },
  goal: { id: 'control-correction' },
  context: {
    pathId: 'path-correction-1',
    goalId: 'control-correction',
    requestedNodeId: 'checkpoint-1',
  },
  current: { nodeId: 'checkpoint-1', title: '校正检查点', type: 'checkpoint' },
  progress: { completed: 1, total: 3 },
  return: {
    label: '返回学习路径',
    href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-correction-1&nodeId=checkpoint-1',
  },
  pathStatus: 'active',
  nextAction: {
    state: 'blocked',
    nodeId: 'checkpoint-1',
    title: '校正检查点',
    type: 'checkpoint',
    href: null,
    reason: '当前检查点结果未通过。',
    recovery: {
      label: '返回学习路径',
      href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-correction-1&nodeId=checkpoint-1',
    },
  },
  correction: {
    proposal: {
      trigger: {
        kind: 'failed-checkpoint',
        nodeId: 'checkpoint-1',
        title: '校正检查点',
        reason: '检查点结果未通过。',
      },
      originalRemaining: [
        { nodeId: 'checkpoint-1', title: '校正检查点', type: 'checkpoint', estimatedTimeMinutes: 15 },
        { nodeId: 'review-1', title: '误差复习', type: 'knowledge_card', estimatedTimeMinutes: 20 },
      ],
      proposedRemaining: [
        { nodeId: 'review-1', title: '误差复习', type: 'knowledge_card', estimatedTimeMinutes: 20 },
        { nodeId: 'checkpoint-1', title: '校正检查点', type: 'checkpoint', estimatedTimeMinutes: 15 },
      ],
      changes: [{ kind: 'reordered', nodeId: 'checkpoint-1', title: '校正检查点', movedAfterNodeId: 'review-1' }],
      supportingFacts: [
        '“校正检查点”的检查点结果未通过。',
        '“误差复习”是当前路径中尚未完成的受治理学习节点。',
      ],
      estimatedRemainingWork: { originalMinutes: 35, proposedMinutes: 35, differenceMinutes: 0 },
    },
    unavailableReason: null,
  },
};

for (const width of [1440, 320]) {
  test(`shows the read-only correction proposal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/\/api\/learning-paths\/[^/]+\/journey(?:\?|$)/, async (route) => {
      await route.fulfill({ json: { journey } });
    });

    await page.goto(
      '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution&pathId=path-correction-1&nodeId=checkpoint-1',
      { waitUntil: 'domcontentloaded' },
    );

    const correction = page.locator('[data-adaptive-path-correction="available"]');
    await expect(correction).toBeVisible({ timeout: 30_000 });
    await correction.locator('summary').click();
    await expect(correction).toContainText('当前未完成路径');
    await expect(correction).toContainText('建议顺序');
    await expect(correction).toContainText('本方案仅供查看，尚未应用到当前学习路径。');

    const geometry = await correction.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
    expect(geometry.documentWidth).toBe(geometry.clientWidth);
    await page.screenshot({
      path: `test-results/adaptive-path-correction-proposal/${width}.png`,
      fullPage: true,
    });
  });
}
