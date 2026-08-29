import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test.describe('interactive AI context continuity', () => {
  test('keeps explicit recovery states in the shipped panel and does not advertise persistence on login', async ({ page }) => {
    const panelSource = readFileSync(
      join(process.cwd(), 'src/features/interactive/InteractiveAIPanel.tsx'),
      'utf8',
    );
    expect(panelSource).toContain('data-interactive-ai-recovery="ephemeral"');
    expect(panelSource).toContain('当前为不可恢复的一轮兼容路径');
    expect(panelSource).toContain('data-interactive-ai-recovery="unavailable"');
    expect(panelSource).toContain('无法恢复学习对话');

    const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(response?.ok() ?? false).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('当前为不可恢复的一轮兼容路径')).toHaveCount(0);
  });
});
