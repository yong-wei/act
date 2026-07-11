import path from 'node:path';

import { expect, test } from '@playwright/test';

const executionHref = '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution';
const evidenceDir = path.resolve(
  process.cwd(),
  'openspec/changes/redesign-adaptive-path-continuous-journey/evidence/visual-acceptance',
);

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 375, 320] as const) {
    test(`${theme} path execution is usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 900 });
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem('ai-obe-theme', selectedTheme);
      }, theme);
      await page.goto(executionHref, { waitUntil: 'domcontentloaded' });

      const execution = page.locator('[data-adaptive-path-execution-surface="active-route"]');
      const timeline = execution.locator('[data-adaptive-path-route-map="compact"]');
      const currentNode = timeline.locator('[data-adaptive-path-node-state="current"]');
      const actions = currentNode.locator('[data-adaptive-path-node-actions="attached"]');
      await expect(execution).toContainText('控制系统校正设计学习路径');
      await expect(timeline).toBeVisible();
      await expect(currentNode).toContainText('完成频域到时域检查题');
      await expect(actions).toBeVisible();
      await expect(page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));

      const geometry = await page.evaluate(() => {
        const executionSurface = document.querySelector<HTMLElement>('[data-adaptive-path-execution-surface="active-route"]')!;
        const timelineSurface = document.querySelector<HTMLElement>('[data-adaptive-path-route-map="compact"]')!;
        const current = document.querySelector<HTMLElement>('[data-adaptive-path-node-state="current"]')!;
        const attachedActions = current.querySelector<HTMLElement>('[data-adaptive-path-node-actions="attached"]')!;
        const rects = [executionSurface, timelineSurface, current, attachedActions].map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          };
        });
        return {
          viewportWidth: window.innerWidth,
          documentClientWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          rects,
        };
      });
      expect(geometry.documentScrollWidth).toBe(geometry.documentClientWidth);
      for (const rect of geometry.rects) {
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(rect.scrollWidth).toBeLessThanOrEqual(rect.clientWidth);
      }

      await page.screenshot({
        path: path.join(evidenceDir, `${theme}-${width}.png`),
        fullPage: true,
      });
    });
  }
}
