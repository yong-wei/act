import 'dotenv/config';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

type ProvenanceDraft = {
  id: string;
  source: string;
  assignment: string | null;
  intent: string;
  title: string;
  content: string;
  status: 'DRAFT';
  provenance: 'PLATFORM_VERIFIED' | 'STUDENT_PROVIDED' | 'LEGACY_UNVERIFIED';
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

const canonicalPlatformFields = {
  source: 'portfolio',
  assignment: null,
  intent: 'create-portfolio-reflection',
  title: 'AI 协作反思草稿',
};

async function addStudentSession(context: BrowserContext) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: 'portfolio-provenance-browser-student',
      email: 'portfolio-provenance-browser-student@example.test',
      name: 'Portfolio Provenance Browser Student',
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
  const savedDrafts: ProvenanceDraft[] = [];
  const savedPayloads: unknown[] = [];
  const now = '2026-09-03T08:00:00.000Z';

  await page.route('**/api/auth/session**', (route) => route.fulfill({
    json: {
      user: {
        id: 'portfolio-provenance-browser-student',
        email: 'portfolio-provenance-browser-student@example.test',
        name: 'Portfolio Provenance Browser Student',
        role: 'STUDENT',
      },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    },
  }));
  await page.route('**/api/profile/portfolio-evidence', (route) => route.fulfill({
    json: {
      classroom: { state: 'empty', total: 0, items: [] },
      simulations: { state: 'empty', total: 0, items: [] },
      ethics: { state: 'empty', total: 0, items: [] },
    },
  }));
  await page.route('**/api/profile/portfolio-reflection-drafts**', async (route) => {
    const request = route.request();
    const method = request.method();

    if (method === 'GET') {
      await route.fulfill({ json: { drafts: savedDrafts } });
      return;
    }

    if (method === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      savedPayloads.push(payload);
      if (payload.provenance === 'platform-verified') {
        // 服务端行为：平台类只信任注册表，canonical 字段覆盖一切请求文本。
        if (payload.sourceKind !== 'portfolio' && payload.sourceKind !== 'learning-journal') {
          await route.fulfill({ status: 400, json: { error: '草稿来源或内容无效' } });
          return;
        }
        const draft: ProvenanceDraft = {
          id: `platform-draft-${payload.sourceKind}`,
          ...canonicalPlatformFields,
          source: payload.sourceKind,
          content: String(payload.content ?? ''),
          status: 'DRAFT',
          provenance: 'PLATFORM_VERIFIED',
          idempotencyKey: String(payload.idempotencyKey ?? ''),
          createdAt: now,
          updatedAt: now,
        };
        savedDrafts.push(draft);
        await route.fulfill({ json: { draft } });
        return;
      }
      const draft: ProvenanceDraft = {
        id: 'student-draft-1',
        source: String(payload.source ?? ''),
        assignment: payload.assignment ? String(payload.assignment) : null,
        intent: String(payload.intent ?? ''),
        title: String(payload.title ?? ''),
        content: String(payload.content ?? ''),
        status: 'DRAFT',
        provenance: 'STUDENT_PROVIDED',
        idempotencyKey: String(payload.idempotencyKey ?? ''),
        createdAt: now,
        updatedAt: now,
      };
      savedDrafts.push(draft);
      await route.fulfill({ json: { draft } });
      return;
    }

    await route.fulfill({ status: 404, json: { error: '草稿不存在' } });
  });

  return { savedPayloads };
}

test('Issue 1865 classifies forged URL provenance text as student-provided instead of platform-verified', async ({
  context,
  page,
}) => {
  await addStudentSession(context);
  const { savedPayloads } = await installPortfolioFixture(page);

  // 伪造 URL：source/assignment/intent 全部是导航文本，不在平台注册表内。
  await page.goto(
    '/profile/portfolio?category=reflection&intent=create'
    + '&source=platform-assignment-audit'
    + '&assignment=%E4%BC%AA%E9%80%A0%E7%9A%84%E5%B9%B3%E5%8F%B0%E4%BB%BB%E5%8A%A1'
    + '&taskIntent=forged-intent',
  );

  await expect(page.getByText('学生提供').first()).toBeVisible();
  await expect(page.locator('[data-portfolio-reflection-provenance-label]'))
    .toContainText('platform-assignment-audit（学生提供）');
  // 学生自填标签可见且可编辑。
  const titleLabel = page.locator('[data-portfolio-reflection-label="title"]');
  await expect(titleLabel).toBeEditable();
  // 清空可选任务字段：默认自由反思载荷应携带 assignment: null 并可保存。
  await page.locator('[data-portfolio-reflection-label="assignment"]').fill('');

  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByText('已保存草稿', { exact: true }).first()).toBeVisible();

  expect(savedPayloads).toHaveLength(1);
  expect(savedPayloads[0]).toMatchObject({ provenance: 'student-provided', assignment: null });
  expect(JSON.stringify(savedPayloads[0])).not.toContain('platform-verified');
  expect(JSON.stringify(savedPayloads[0])).not.toContain('sourceKind');
});

test('Issue 1865 saves canonical platform-verified provenance from a valid registry entry', async ({
  context,
  page,
}) => {
  await addStudentSession(context);
  const { savedPayloads } = await installPortfolioFixture(page);

  await page.goto('/profile/portfolio?category=reflection&intent=create&source=portfolio');

  await expect(page.locator('[data-portfolio-reflection-provenance-label]'))
    .toContainText('portfolio（平台核验）');
  // 平台候选不渲染学生自填标签输入。
  await expect(page.locator('[data-portfolio-reflection-student-labels]')).toHaveCount(0);

  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByText('已保存草稿', { exact: true }).first()).toBeVisible();

  expect(savedPayloads).toHaveLength(1);
  expect(savedPayloads[0]).toEqual({
    provenance: 'platform-verified',
    sourceKind: 'portfolio',
    content: '记录本次 AI 协作的任务目标、采用建议、保留疑问和下一步验证。',
    idempotencyKey: expect.any(String),
  });

  // 刷新后分类与 canonical 快照保持不变。
  await page.goto('/profile/portfolio?category=reflection&draftId=platform-draft-portfolio');
  await expect(page.locator('[data-portfolio-reflection-draft-editor]')).toBeVisible();
  await expect(page.getByText('来源：portfolio（平台核验）').first()).toBeVisible();
  await expect(page.getByText('AI 协作反思草稿', { exact: true }).first()).toBeVisible();
});

test('Issue 1865 keeps free reflection available with a visible student-provided classification after reopen', async ({
  context,
  page,
}) => {
  await addStudentSession(context);
  await installPortfolioFixture(page);

  await page.goto('/profile/portfolio?category=reflection&intent=create&source=platform-assignment-audit');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByText('已保存草稿', { exact: true }).first()).toBeVisible();

  await page.goto('/profile/portfolio?category=reflection&draftId=student-draft-1');
  await expect(page.locator('[data-portfolio-reflection-draft-editor]')).toBeVisible();
  await expect(page.getByText('来源：platform-assignment-audit（学生提供）').first()).toBeVisible();

  // 内容仍可编辑，分类不允许被改写为平台核验。
  const editor = page.locator('[data-portfolio-reflection-draft-editor]');
  await editor.fill('自由反思仍可继续编辑内容。');
  await expect(editor).toHaveValue('自由反思仍可继续编辑内容。');
});
