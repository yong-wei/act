import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/issue-1445-legacy-root');

const rootShard = {
  shardClass: 'root',
  envelope: {
    contract: 'act-authority-shard-envelope/v1',
    authorityCatalogVersion: 'acv-playwright',
    teachingVersion: null,
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
      canonicalId: 'node-concept',
      label: '稳定性',
      canonicalType: 'DomainConcept',
      description: '稳定性描述',
      memberships: [{ domainId: 'system-modeling', visualRole: 'modeling', preferred: true }],
    },
  ],
  relations: [
    {
      id: 'teaching-primary',
      layer: 'ACT_TEACHING',
      predicate: 'precedes',
      sourceId: 'node-concept',
      targetId: 'node-concept',
    },
  ],
  teachingCoverage: { status: 'partial', relationCount: 1, coreNodeCount: 1, note: '教学关系部分可用' },
};

async function mockActiveShards(page: Page) {
  await page.route('**/api/knowledge/shards/active', async (route) => {
    if (route.request().url().endsWith('/api/knowledge/shards/active')) {
      await route.fulfill({ json: rootShard });
      return;
    }
    await route.continue();
  });
  await page.route('**/api/knowledge/shards/active/domains/**', async (route) => {
    await route.fulfill({ json: domainShard });
  });
}

test.describe('issue 1445 active circular root', () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  test('captures circular root, domain entry, and inspector without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

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

    await expect(page.getByRole('button', { name: '历史 Legacy' })).toBeVisible();
    expect(errors.filter((item) => !item.includes('favicon'))).toEqual([]);
  });
});
