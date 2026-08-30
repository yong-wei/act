import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const evidenceDir = join(process.cwd(), 'artifacts/align-active-authority-legacy-experience-1493');
const envelope = {
  contract: 'act-authority-shard-envelope/v1',
  authorityCatalogVersion: 'acv-1493',
  teachingVersion: 'teaching-1493',
  localeProfileVersion: 'alp-test-historical-zh-CN',
  match: { authority: true, catalog: true, teaching: true },
};

const rootShard = {
  shardClass: 'root',
  envelope,
  root: {
    kind: 'presentation-root-catalog',
    domains: [
      {
        kind: 'presentation-domain',
        order: 1,
        displayName: '传递函数建模与系统表示基础',
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
  envelope,
  visualRole: 'modeling',
  domainId: 'system-modeling',
  objects: [
    {
      id: 'node-concept',
      label: '传递函数',
      aliases: [],
      canonicalType: 'DomainConcept',
      description: '用传递函数描述系统输入输出关系',
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true },
      memberships: [{ domainId: 'system-modeling', visualRole: 'modeling', preferred: true }],
    },
    {
      id: 'node-formula',
      label: 'G(s)',
      aliases: [],
      canonicalType: 'Formula',
      description: '传递函数表达式',
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
      targetId: 'node-formula',
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
    coreNodeCount: 2,
    uncoveredCoreNodeCount: 0,
    note: '教学关系部分可用',
  },
};

const associationFamily = {
  shardClass: 'relation-family',
  envelope,
  family: 'association',
  domainId: 'system-modeling',
  objects: domainShard.objects,
  relations: [
    {
      id: 'relation-association',
      predicate: 'association',
      sourceId: 'node-concept',
      targetId: 'node-formula',
      direction: 'unordered',
      direct: null,
      qualityTier: 'GOLD',
      governance: { reviewStatus: null, publicationStatus: null },
      semanticSupport: { supported: true, readOnly: true },
      layer: 'ENGINEERING',
      relationFamily: 'association',
    },
  ],
  boundaries: [],
};

function neighborhoodShard(nodeId: string) {
  return {
    shardClass: 'node-neighborhood',
    envelope,
    nodeId,
    limit: 32,
    truncated: false,
    objects: domainShard.objects,
    relations: [...domainShard.teachingRelations, ...associationFamily.relations],
    boundaries: [],
  };
}

const nodeDetailShard = {
  shardClass: 'node-detail',
  envelope,
  node: {
    id: 'node-concept',
    canonicalType: 'DomainConcept',
    label: '传递函数',
    aliases: [],
    description: '用传递函数描述系统输入输出关系',
    teachingFields: {},
    mathematics: { state: 'available', expression: 'G(s)=\\frac{1}{s+1}', display: 'block' },
    resourceBindings: {
      state: 'available',
      items: [
        {
          title: '看见全貌',
          bindingRole: '讲解',
          resourceKind: '课程',
          availability: 'available',
          launch: {
            kind: 'registry-resource',
            href: '/interactive-learning/courses/unit-1-1-see-the-full-picture',
          },
        },
      ],
    },
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
      id: 'issue-1493-student',
      email: 'issue-1493-student@example.com',
      name: '1493学生',
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
  await page.route(/\/api\/knowledge\/shards\/active(?:\/|$)/, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.includes('/families/')) {
      await route.fulfill({ json: associationFamily });
      return;
    }
    if (pathname.includes('/neighborhoods/')) {
      const nodeId = decodeURIComponent(pathname.split('/').pop() ?? 'node-concept');
      await route.fulfill({ json: neighborhoodShard(nodeId) });
      return;
    }
    if (pathname.includes('/nodes/')) {
      await route.fulfill({ json: nodeDetailShard });
      return;
    }
    if (pathname.includes('/domains/')) {
      await route.fulfill({ json: domainShard });
      return;
    }
    if (pathname.endsWith('/api/knowledge/shards/active')) {
      await route.fulfill({ json: rootShard });
      return;
    }
    await route.continue();
  });
}

test.describe('issue 1493 active graph presentation', () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  test('captures root, domain teaching edges, filters, inspector resources and formulas', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await addStudentSession(context);
    await mockActiveShards(page);
    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: '新版' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: '旧版' })).toBeVisible();
    await expect(page.locator('[data-authority-root-canvas="true"]')).toBeVisible();
    await expect(page.locator('[data-authority-root-label="name"]')).toHaveCount(2);
    await expect(page.locator('line, [data-authority-root-edge]')).toHaveCount(0);
    await expect(page.locator('[data-knowledge-workspace-toolbar="true"]')).toBeVisible();
    await expect(page.locator('[data-knowledge-layout-control="fit-view"]')).toBeVisible();
    await expect(page.locator('button[data-active-authority-dimension="2d"]')).toBeVisible();

    const workspaceBox = await page.locator('[data-knowledge-session="active"]').boundingBox();
    const canvasBox = await page.locator('[data-knowledge-runtime-canvas]').first().boundingBox();
    expect(canvasBox?.height ?? 0).toBeGreaterThan((workspaceBox?.height ?? 0) * 0.55);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: join(evidenceDir, 'root-desktop-light.png'), fullPage: false });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: join(evidenceDir, 'root-desktop-dark.png'), fullPage: false });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.screenshot({ path: join(evidenceDir, 'root-mobile-light.png'), fullPage: false });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-authority-domain-entry="modeling"]').click();
    await expect(page.locator('[data-active-graph-stage="authority"]')).toBeVisible();
    await expect(page.locator('[data-active-authority-relation]')).toHaveCount(1);
    await expect(page.locator('[data-active-authority-node-type-label]')).toHaveCount(0);
    await expect(page.locator('[data-active-authority-node-label-placement="below"]')).not.toHaveCount(0);
    await expect(page.locator('[data-authority-relation-family="association"]')).toBeVisible();
    await page.screenshot({ path: join(evidenceDir, 'domain-teaching-desktop-light.png'), fullPage: false });

    await page.locator('[data-authority-relation-family="association"]').click();
    await expect(page.locator('[data-authority-relation-family="association"]')).toHaveAttribute('data-authority-family-enabled', 'true');
    await expect(page.locator('[data-active-authority-relation="relation-association"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-active-authority-relation]')).toHaveCount(2);
    await page.screenshot({ path: join(evidenceDir, 'domain-engineering-filter-desktop-light.png'), fullPage: false });

    await page.locator('[data-active-authority-node="node-concept"]').click();
    await expect(page.locator('[data-active-inspector-surface="desktop-overlay"]')).toBeVisible();
    await expect(page.locator('[data-active-inspector-math="true"]')).toBeVisible();
    await expect(page.locator('[data-active-inspector-resources="true"]')).toBeVisible();
    await expect(page.getByRole('link', { name: /看见全貌/ })).toBeVisible();
    await page.screenshot({ path: join(evidenceDir, 'inspector-resource-formula-desktop-light.png'), fullPage: false });

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.locator('[data-active-authority-node="node-concept"]').click();
    await expect(page.locator('[data-active-inspector-surface="mobile-drawer"]')).toBeVisible();
    await page.screenshot({ path: join(evidenceDir, 'inspector-mobile-dark.png'), fullPage: false });

    writeFileSync(join(evidenceDir, 'browser-evidence.json'), `${JSON.stringify({
      change: 'align-active-authority-with-legacy-graph-experience',
      issue: 1493,
      capturedAt: new Date().toISOString(),
      states: [
        'root-desktop-light',
        'root-desktop-dark',
        'root-mobile-light',
        'domain-teaching-desktop-light',
        'domain-engineering-filter-desktop-light',
        'inspector-resource-formula-desktop-light',
        'inspector-mobile-dark',
      ],
      deferred: ['upstream localization / language switching'],
    }, null, 2)}\n`);

    expect(errors.filter((item) => !item.includes('favicon'))).toEqual([]);
  });

  test('keeps shared runtime controls, fills the workspace, and restores isolated sessions', async ({ page, context }) => {
    await addStudentSession(context);
    await mockActiveShards(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-authority-root-canvas="true"]')).toBeVisible({ timeout: 20_000 });

    await page.locator('[data-authority-domain-entry="modeling"]').click();
    await expect(page.locator('[data-active-graph-stage="authority"]')).toBeVisible();
    await expect(page.locator('[data-knowledge-workspace-toolbar="true"] [data-active-authority-toolbar="true"]')).toBeVisible();
    await expect(page.locator('[data-knowledge-layout-control="relayout"]')).toBeVisible();

    const toolbar = page.locator('[data-knowledge-workspace-toolbar="true"]');
    const title = page.locator('[data-active-authority-title="true"]');
    const language = page.locator('[data-graph-language-switch="true"]');
    const toolbarBox = await toolbar.boundingBox();
    const titleBox = await title.boundingBox();
    const languageBox = await language.boundingBox();
    if (toolbarBox && titleBox) {
      const overlapX = Math.min(toolbarBox.x + toolbarBox.width, titleBox.x + titleBox.width)
        - Math.max(toolbarBox.x, titleBox.x);
      const overlapY = Math.min(toolbarBox.y + toolbarBox.height, titleBox.y + titleBox.height)
        - Math.max(toolbarBox.y, titleBox.y);
      expect(overlapX <= 0 || overlapY <= 0).toBeTruthy();
    }
    expect(languageBox).toBeTruthy();
    if (toolbarBox && languageBox) {
      const overlapX = Math.min(toolbarBox.x + toolbarBox.width, languageBox.x + languageBox.width)
        - Math.max(toolbarBox.x, languageBox.x);
      const overlapY = Math.min(toolbarBox.y + toolbarBox.height, languageBox.y + languageBox.height)
        - Math.max(toolbarBox.y, languageBox.y);
      expect(overlapX <= 0 || overlapY <= 0).toBeTruthy();
    }

    await page.locator('button[data-active-authority-dimension="3d"]').click();
    await expect(page.locator('[data-active-authority-runtime="force-graph"]')).toHaveAttribute('data-active-authority-dimension', '3d');
    await page.locator('button[data-active-authority-dimension="2d"]').click();
    await expect(page.locator('[data-active-authority-runtime="force-graph"]')).toHaveAttribute('data-active-authority-dimension', '2d');
    await expect(page.locator('[data-active-authority-relation="teaching-primary"]')).toHaveCount(1);

    await page.getByRole('button', { name: '旧版' }).click();
    await expect(page.locator('[data-knowledge-session="legacy"]')).toBeVisible();
    await page.getByRole('button', { name: '新版' }).click();
    await expect(page.locator('[data-knowledge-session="active"]')).toBeVisible();
    await expect(page.locator('[data-active-authority-relation="teaching-primary"]')).toHaveCount(1);
  });
});
