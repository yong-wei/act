import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const envelope = {
  contract: 'act-authority-shard-envelope/v1',
  authorityCatalogVersion: 'acv-1494',
  teachingVersion: null,
  localeProfileVersion: 'alp-test-historical-zh-CN',
  match: { authority: true, catalog: true, teaching: true },
};

const rootShard = {
  shardClass: 'root',
  envelope,
  localeCapability: {
    availableLocales: ['zh-CN'],
    bilingualReady: false,
    englishUnavailableReason: '当前发布尚未通过完整英文资格，暂不能切换到 English。',
    mode: 'historical',
    languageComponentDigest: null,
  },
  root: {
    kind: 'presentation-root-catalog',
    domains: [{
      kind: 'presentation-domain',
      order: 1,
      displayName: '系统建模',
      summary: '从对象到系统模型',
      presentationRole: 'domain',
      visualRole: 'modeling',
      memberCount: 1,
    }],
    aggregate: {
      kind: 'presentation-aggregate',
      order: 0,
      displayName: '控制理论综合',
      summary: '汇总入口',
      presentationRole: 'aggregate',
      visualRole: 'aggregate',
      domainCount: 1,
    },
  },
};

async function studentSession(context: BrowserContext) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'playwright-local-auth-secret-at-least-32-bytes',
    token: {
      id: 'issue-1494-student',
      email: 'issue-1494-student@example.com',
      name: '1494学生',
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

async function mockActiveShards(page: Page) {
  await page.route(/\/api\/knowledge\/shards\/active(?:\/|$|\?)/, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/api/knowledge/shards/active')) {
      await route.fulfill({ json: rootShard });
      return;
    }
    await route.continue();
  });
}

test.describe('issue 1494 locale switch gate', () => {
  test('defaults to Chinese and keeps English unavailable on the new graph', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await studentSession(context);
    await mockActiveShards(page);
    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: '新版' })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-active-authority-graph="true"]').first()).toBeVisible();
    await expect(page.locator('[data-graph-locale="zh-CN"]').first()).toBeVisible();
    await expect(page.locator('[data-graph-language="zh-CN"]').first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-graph-language="en"]').first()).toBeDisabled();
    await expect(page.locator('[data-graph-language-unavailable="en"]').first()).toContainText('English');
    const copy = await page.locator('[data-active-authority-graph="true"]').first().innerText();
    expect(copy).not.toMatch(/ctr:release|snap-|course-content\//u);
    expect(errors).toEqual([]);
  });
});
