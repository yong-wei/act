import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const axeSourcePath = require.resolve('axe-core/axe.min.js');

test('teacher and student embedded assignment hosts expose accessible bounded reading states', async ({ page }) => {
  // tsx 默认走根 tsconfig（Next 保留 JSX）；示例渲染脚本需要 react-jsx 自动运行时。
  const markup = execFileSync(process.execPath, [
    '--import',
    'tsx',
    path.join(process.cwd(), 'scripts/tests/render-assignment-embedded-editor-example.ts'),
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH: path.join(process.cwd(), 'scripts/tests/tsconfig.render-example.json'),
    },
  });
  await page.setContent(`<!doctype html><html lang="zh-CN"><head><title>作业内容编辑器示例</title></head><body>${markup}</body></html>`);
  await page.addScriptTag({ path: axeSourcePath });

  await expect(page.locator('[data-assignment-editor-mode="assignment-embedded"]')).toHaveCount(2);
  await expect(page.getByRole('region', { name: '作业题目内容' })).toBeVisible();
  await expect(page.getByRole('region', { name: '作业正文' })).toBeVisible();
  await expect(page.getByRole('button', { name: '编辑' })).toHaveCount(2);

  const violations = await page.evaluate(async () => {
    const result = await (globalThis as typeof globalThis & {
      axe: { run: (root: Document) => Promise<{ violations: Array<{ id: string; impact: string | null }> }> };
    }).axe.run(document);
    return result.violations.filter((violation) => (
      violation.impact === 'critical' || violation.impact === 'serious'
    ));
  });
  expect(violations).toEqual([]);
});
