import 'dotenv/config';
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

  await page.route('**/api/simulation/cruise-summary-insight', (route) => route.fulfill({ json: { designs: [] } }));
  await page.route('**/api/evaluation/prompt-history/**', (route) => route.fulfill({ json: { prompts: [] } }));
  await page.route('**/api/ethics/violation', (route) => route.fulfill({ json: { violations: [] } }));
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

  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/profile/portfolio?category=reflection&intent=create&source=portfolio&taskIntent=create-portfolio-reflection');
  const mobileEditor = page.locator('[data-portfolio-reflection-draft-editor]');
  await expect(mobileEditor).toBeVisible();
  await mobileEditor.focus();
  await expect(mobileEditor).toBeFocused();
  await expectNoHorizontalOverflow(page);

  await page.goto('/profile/portfolio?category=reflection&draftId=portfolio-draft-browser-1321');
  await page.getByRole('button', { name: '丢弃草稿', exact: true }).click();
  await expect(page.getByText('暂无AI协作反思', { exact: true })).toBeVisible();
});
