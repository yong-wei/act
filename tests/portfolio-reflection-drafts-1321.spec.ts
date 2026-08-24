import 'dotenv/config';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

type Draft = {
  id: string;
  source: string;
  assignment: string | null;
  intent: string;
  title: string;
  content: string;
  status: 'DRAFT';
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

async function addStudentSession(context: BrowserContext) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: 'portfolio-draft-browser-student',
      email: 'portfolio-draft-browser-student@example.test',
      name: 'Portfolio Draft Browser Student',
      role: 'STUDENT',
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 3600,
  }]);
}

async function installPortfolioFixture(page: Page) {
  let draft: Draft | null = null;
  const now = '2026-08-11T08:00:00.000Z';

  await page.route('**/api/auth/session**', (route) => route.fulfill({
    json: {
      user: {
        id: 'portfolio-draft-browser-student',
        email: 'portfolio-draft-browser-student@example.test',
        name: 'Portfolio Draft Browser Student',
        role: 'STUDENT',
      },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    },
  }));
  await page.route('**/api/profile/portfolio-evidence', (route) => route.fulfill({
    json: {
      classroom: {
        state: 'available',
        total: 1,
        items: [{
          id: 'classroom-evidence-1321',
          title: 'unit-5-3 路 step-03',
          type: '课堂提交',
          content: '已提交课堂步骤 step-03，得分 92 分。',
          createdAt: now,
          sessionName: '控制系统辨识',
        }],
      },
      simulations: {
        state: 'available',
        total: 1,
        items: [{
          id: 'simulation-evidence-1321',
          name: 'PID 仿真设计',
          score: 86,
          parameters: { kp: 1.2, ki: 0.4, kd: 2.1 },
          createdAt: now,
        }],
      },
      ethics: {
        state: 'available',
        total: 1,
        items: [{
          id: 'ethics-evidence-1321',
          violationType: 'COLLISION_RISK',
          description: '存在碰撞风险',
          remediationAction: '我会先减速并重新规划航向。',
          isResolved: true,
          createdAt: now,
        }],
      },
    },
  }));
  await page.route('**/api/profile/portfolio-reflection-drafts**', async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === 'GET') {
      await route.fulfill({ json: { drafts: draft ? [draft] : [] } });
      return;
    }

    if (method === 'POST') {
      const input = request.postDataJSON() as Omit<Draft, 'id' | 'status' | 'createdAt' | 'updatedAt'>;
      draft = {
        id: 'portfolio-draft-browser-1321',
        ...input,
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
      };
      await route.fulfill({ json: { draft } });
      return;
    }

    if (method === 'PUT' && draft) {
      const input = request.postDataJSON() as Omit<Draft, 'id' | 'status' | 'createdAt' | 'updatedAt'>;
      draft = { ...draft, ...input, updatedAt: now };
      await route.fulfill({ json: { draft } });
      return;
    }

    if (method === 'DELETE' && draft) {
      const discardedId = draft.id;
      draft = null;
      await route.fulfill({ json: { discardedId } });
      return;
    }

    await route.fulfill({ status: 404, json: { error: '草稿不存在' } });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
}

async function captureEvidenceScreenshot(page: Page, filename: string) {
  const outputDirectory = process.env.PORTFOLIO_REFLECTION_DRAFT_EVIDENCE_DIR;
  if (!outputDirectory) return;

  await mkdir(outputDirectory, { recursive: true });
  await page.screenshot({ path: join(outputDirectory, filename), fullPage: true });
}

async function capturePortfolioEvidenceScreenshot(page: Page, filename: string) {
  const outputDirectory = process.env.PORTFOLIO_EVIDENCE_CAPTURE_DIR;
  if (!outputDirectory) return;

  await mkdir(outputDirectory, { recursive: true });
  await page.screenshot({ path: join(outputDirectory, filename), fullPage: true });
}

test('Issue 1321 persists, reopens, edits, and discards a portfolio reflection draft across desktop and mobile layouts', async ({
  context,
  page,
}) => {
  await addStudentSession(context);
  await installPortfolioFixture(page);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/profile/portfolio?category=reflection&intent=create&source=portfolio&assignment=PID%20%E5%8F%82%E6%95%B0%E6%95%B4%E5%AE%9A&taskIntent=create-portfolio-reflection');

  const candidateEditor = page.locator('[data-portfolio-reflection-draft-editor]');
  await expect(candidateEditor).toBeVisible();
  await candidateEditor.focus();
  await expect(candidateEditor).toBeFocused();
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();

  await expect(page.getByText('已保存草稿', { exact: true })).toBeVisible();
  const savedEditor = page.locator('[data-portfolio-reflection-draft-editor]');
  await expect(savedEditor).toHaveValue('记录本次 AI 协作的任务目标、采用建议、保留疑问和下一步验证。');
  await savedEditor.fill('我先核对了调节时间。\n下一步会比较超调量。');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(savedEditor).toHaveValue('我先核对了调节时间。\n下一步会比较超调量。');
  await expectNoHorizontalOverflow(page);
  await captureEvidenceScreenshot(page, 'portfolio-reflection-draft-1440.png');

  await page.goto('/profile/portfolio');
  await expect(page.getByText('unit-5-3 路 step-03', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /仿真设计/ }).click();
  await expect(page.getByText('PID 仿真设计', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /伦理整改/ }).click();
  await expect(page.getByText('存在碰撞风险', { exact: true })).toBeVisible();
  await capturePortfolioEvidenceScreenshot(page, 'portfolio-evidence-1440.png');

  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/profile/portfolio');
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: /课堂作品/ }).click();
  await expect(page.getByText('unit-5-3 路 step-03', { exact: true })).toBeVisible();
  await capturePortfolioEvidenceScreenshot(page, 'portfolio-evidence-320.png');

  await page.goto('/profile/portfolio?category=reflection&intent=create&source=portfolio&taskIntent=create-portfolio-reflection');
  const mobileEditor = page.locator('[data-portfolio-reflection-draft-editor]');
  await expect(mobileEditor).toBeVisible();
  await mobileEditor.focus();
  await expect(mobileEditor).toBeFocused();
  await expectNoHorizontalOverflow(page);

  await page.goto('/profile/portfolio?category=reflection&draftId=portfolio-draft-browser-1321');
  await expect(page.locator('[data-portfolio-reflection-draft-editor]')).toBeVisible();
  await captureEvidenceScreenshot(page, 'portfolio-reflection-draft-320.png');
  await page.getByRole('button', { name: '丢弃草稿', exact: true }).click();
  await expect(page.getByText('暂无AI协作反思', { exact: true })).toBeVisible();
});
