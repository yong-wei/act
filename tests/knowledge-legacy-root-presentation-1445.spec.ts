import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/issue-1445-legacy-root');

const rootShard = {
  shardClass: 'root',
  envelope: {
    contract: 'act-authority-shard-envelope/v1',
    authorityCatalogVersion: 'acv-playwright',
    teachingVersion: null,
    localeProfileVersion: 'alp-test-historical-zh-CN',
    match: { authority: true, catalog: true, teaching: null },
  },
  root: {
    kind: 'presentation-root-catalog',
    domains: [
      {
        kind: 'presentation-domain',
        order: 1,
        displayName: '系统建模',
        summary: '从对象到系统模型',
        presentationRole: 'domain',
        visualRole: 'modeling',
        memberCount: 2,
      },
    ],
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

const domainShard = {
  shardClass: 'domain-default',
  envelope: rootShard.envelope,
  visualRole: 'modeling',
  domainId: 'system-modeling',
  objects: [
    {
      id: 'node-concept',
      label: '稳定性',
      aliases: [],
      canonicalType: 'DomainConcept',
      description: '稳定性描述',
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true },
      memberships: [{ domainId: 'system-modeling', visualRole: 'modeling', preferred: true }],
    },
  ],
  teachingRelations: [
    {
      id: 'teaching-primary',
      predicate: 'PREREQUISITE',
      sourceId: 'node-concept',
      targetId: 'node-concept',
      direction: 'source_to_target',
      direct: null,
      qualityTier: 'GOLD',
      governance: { reviewStatus: null, publicationStatus: null },
      semanticSupport: { supported: true, readOnly: true },
      layer: 'ACT_TEACHING',
      relationFamily: 'teaching-prerequisite',
    },
  ],
  teachingCoverage: {
    status: 'partial',
    domainId: 'system-modeling',
    relationCount: 1,
    coreNodeCount: 1,
    uncoveredCoreNodeCount: 0,
    note: '教学关系部分可用',
  },
};

const nodeDetailShard = {
  shardClass: 'node-detail',
  envelope: rootShard.envelope,
  node: {
    id: 'node-concept',
    canonicalType: 'DomainConcept',
    label: '稳定性',
    aliases: [],
    description: '稳定性描述',
    teachingFields: {},
    governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
    adjacency: [],
    sources: [],
    semanticSupport: { supported: true, readOnly: true },
    media: { cardAvailable: false, infographAvailable: false },
    learningContent: {
      card: { state: 'missing', message: '当前节点暂无已发布学习卡片。' },
      infograph: { state: 'missing', message: '当前节点暂无可用信息图。' },
    },
  },
};

async function addStudentSession(context: BrowserContext) {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'playwright-local-auth-secret-at-least-32-bytes',
    token: {
      id: 'issue-1445-student',
      email: 'issue-1445-student@example.com',
      name: '1445学生',
      role: 'STUDENT',
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
    expires: Math.floor(Date.now() / 1000) + 3600,
  }]);
}

async function mockActiveShards(page: Page) {
  await page.route('**/api/knowledge/shards/active/nodes/**', async (route) => {
    await route.fulfill({ json: nodeDetailShard });
  });
  await page.route('**/api/knowledge/shards/active/domains/**', async (route) => {
    await route.fulfill({ json: domainShard });
  });
  await page.route('**/api/knowledge/shards/active', async (route) => {
    if (route.request().url().endsWith('/api/knowledge/shards/active')) {
      await route.fulfill({ json: rootShard });
      return;
    }
    await route.continue();
  });
}

test.describe('issue 1445 active circular root', () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  test('captures circular root, domain entry, and inspector without console errors', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await addStudentSession(context);
    await mockActiveShards(page);
    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-authority-root-canvas="true"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-authority-domain-entry="modeling"]')).toBeVisible();
    await expect(page.locator('line, [data-authority-root-edge]')).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: join(evidenceDir, 'root-desktop-light.png'), fullPage: true });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: join(evidenceDir, 'root-desktop-dark.png'), fullPage: true });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(evidenceDir, 'root-mobile-light.png'), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: '系统建模' }).click();
    await expect(page.locator('[data-active-graph-stage="authority"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '返回领域' })).toBeVisible();
    await page.screenshot({ path: join(evidenceDir, 'domain-desktop-light.png'), fullPage: true });

    const node = page.locator('[data-active-authority-node="node-concept"]');
    if (await node.count()) {
      await node.click();
      await expect(page.locator('[data-active-node-detail]')).toBeVisible();
      await page.screenshot({ path: join(evidenceDir, 'inspector-desktop-light.png'), fullPage: true });
    }

    await expect(page.getByRole('button', { name: '旧版' })).toBeVisible();
    expect(errors.filter((item) => !item.includes('favicon'))).toEqual([]);
  });
});
