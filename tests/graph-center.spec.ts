import { expect, test, type BrowserContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';

async function addSession(context: BrowserContext, role: 'STUDENT' | 'TEACHER' | 'ADMIN') {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: `graph-center-${role.toLowerCase()}-1`,
      email: `graph-center-${role.toLowerCase()}@example.com`,
      name: role === 'TEACHER' ? '图谱教师' : role === 'ADMIN' ? '图谱管理员' : '图谱学生',
      role,
    },
  });

  await context.addCookies([{
    name: 'next-auth.session-token',
    value: sessionToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  }]);
}

test('graph center supports domain switching, filtering, and node detail inspection', async ({ context, page }) => {
  await addSession(context, 'STUDENT');
  await page.goto('/graph-center');

  const surface = page.locator('[data-graph-center-surface="read-only"]');
  await expect(surface).toBeVisible();
  await expect(surface).toHaveAttribute('data-graph-center-domain', 'knowledge');
  await expect(page.locator('[data-graph-center-list-fallback="true"]')).toBeVisible();
  await expect(page.locator('[data-graph-center-detail="true"]')).toBeVisible();
  await expect(page.locator('[data-graph-center-knowledge-compatibility-link="true"]')).toHaveAttribute('href', '/knowledge');
  await expect(page.locator('[data-graph-center-actions="true"]')).toBeVisible();
  await expect(page.locator('[data-graph-center-detail="true"]')).toContainText('进入学习路径');
  await expect(page.locator('[data-graph-center-detail="true"]')).toContainText('向 Konling 提问');
  await expect(page.locator('[data-graph-center-list-fallback="true"] [data-graph-center-node-actions]').first()).toBeVisible();

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
  await expect(detail.locator('[data-graph-center-actions="true"]')).toContainText('进入学习路径');
});

test('graph center learner mode keeps action reasons explicit', async ({ context, page }) => {
  await addSession(context, 'STUDENT');
  await page.goto('/graph-center?nodeId=kn:autocontrol:controller-correction');

  const detail = page.locator('[data-graph-center-detail="true"]');
  await page.getByRole('tab', { name: /学习者/ }).click();

  await expect(detail).toContainText('控制器与校正');
  await expect(detail).toContainText('复查个人证据');
  await expect(detail).toContainText('学习者 overlay 不可用，暂不能复查个人证据。');
  await expect(detail.locator('[data-action-status="disabled"]')).toBeVisible();
});

test('graph center teacher coverage mode exposes teacher action surface', async ({ context, page }) => {
  await addSession(context, 'TEACHER');
  await page.goto('/graph-center?domain=knowledge&nodeId=kn:autocontrol:feedback-loop&classId=class-1');

  const detail = page.locator('[data-graph-center-detail="true"]');
  await page.getByRole('tab', { name: /班级/ }).click();

  await expect(detail).toContainText('反馈与闭环控制');
  await expect(detail.locator('[data-graph-center-actions="true"]')).toBeVisible();
  await expect(detail).toContainText('诊断薄弱节点');
  await expect(detail).toContainText('查看影响学生');
  await expect(detail).toContainText('检查资源缺口');
  await expect(detail).toContainText('生成备课包');
});

test('graph center mobile drawer detail keeps node actions reachable', async ({ context, page }) => {
  await addSession(context, 'STUDENT');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/graph-center?nodeId=kn:autocontrol:controller-correction');

  const fallback = page.locator('[data-graph-center-list-fallback="true"]');
  const detail = page.locator('[data-graph-center-detail="true"]');

  await expect(fallback).toBeVisible();
  await expect(fallback.locator('[data-graph-center-node-actions="kn:autocontrol:controller-correction"]')).toBeVisible();
  await expect(fallback.locator('[data-action-reason="missing-overlay-context"]').first()).toBeVisible();
  await expect(fallback).toContainText('学习者 overlay 不可用，暂不能复查个人证据。');
  await expect(detail.locator('[data-graph-center-actions="true"]')).toBeVisible();
  await expect(detail).toContainText('进入学习路径');
  await expect(detail).toContainText('查看推荐资源');
});
