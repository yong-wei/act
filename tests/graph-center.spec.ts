import { expect, test } from '@playwright/test';

test('graph center supports domain switching, filtering, and node detail inspection', async ({ page }) => {
  await page.goto('/graph-center');

  const surface = page.locator('[data-graph-center-surface="read-only"]');
  await expect(surface).toBeVisible();
  await expect(surface).toHaveAttribute('data-graph-center-domain', 'knowledge');
  await expect(page.locator('[data-graph-center-list-fallback="true"]')).toBeVisible();
  await expect(page.locator('[data-graph-center-detail="true"]')).toBeVisible();
  await expect(page.locator('[data-graph-center-knowledge-compatibility-link="true"]')).toHaveAttribute('href', '/knowledge');

  await page.getByRole('tab', { name: /能力/ }).click();
  await expect(surface).toHaveAttribute('data-graph-center-domain', 'capability');

  await page.locator('#graph-center-objective').selectOption('capability:autocontrol:validate-with-simulation-evidence');
  await page.locator('#graph-center-portrait').selectOption('simulationValidationEvidence');

  await expect(page.getByRole('button', { name: /用仿真证据验证方案/ })).toBeVisible();
  await page.getByRole('button', { name: /用仿真证据验证方案/ }).click();

  const detail = page.locator('[data-graph-center-detail="true"]');
  await expect(detail).toContainText('用仿真证据验证方案');
  await expect(detail).toContainText('资源绑定');
  await expect(detail).toContainText('kn:autocontrol:simulation-validation');
  await expect(detail).toContainText('校验');
  await expect(detail).toContainText('通过');
});
